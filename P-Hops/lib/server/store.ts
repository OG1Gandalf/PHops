import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { RawReport } from "@/lib/crowdService";
import type { CommentDTO, CrowdLevel } from "@/lib/types";

/**
 * Persistence for crowd reports and comments.
 *
 * - Production: Supabase (service-role key, server only, for writes; anon key + RLS for public reads).
 * - Local dev without Supabase env vars: an in-memory store so the whole flow can be tried offline.
 * - Production without env vars: `getStore()` returns null and the API answers 503 `not_configured`.
 */
export interface Store {
  kind: "supabase" | "memory";
  insertCrowdReport(r: { pandal_id: string; level: CrowdLevel; device_hash: string }): Promise<void>;
  lastCrowdReportAt(deviceHash: string, pandalId: string): Promise<string | null>;
  recentCrowdReports(sinceIso: string): Promise<RawReport[]>;
  insertComment(c: { pandal_id: string; name: string; text: string; device_hash: string }): Promise<CommentDTO>;
  listComments(pandalId: string, beforeIso: string | null, limit: number): Promise<{ comments: CommentDTO[]; nextCursor: string | null }>;
  countRecentComments(deviceHash: string, sinceIso: string): Promise<number>;
  hasDuplicateComment(deviceHash: string, pandalId: string, text: string, sinceIso: string): Promise<boolean>;
  reportComment(commentId: string, deviceHash: string, threshold: number): Promise<{ reported_count: number; hidden: boolean } | null>;
}

const COMMENT_COLUMNS = "id,pandal_id,name,text,created_at,reported_count";

// --------------------------------------------------------------------------
// Supabase
// --------------------------------------------------------------------------
function supabaseStore(url: string, serviceKey: string, anonKey?: string): Store {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin: SupabaseClient = createClient(url, serviceKey, opts);
  // Public reads go through the anon key so Row Level Security stays in force even if a query is wrong.
  const reader: SupabaseClient = anonKey ? createClient(url, anonKey, opts) : admin;

  const fail = (op: string, error: { message: string } | null) => {
    if (error) throw new Error(`supabase ${op}: ${error.message}`);
  };

  return {
    kind: "supabase",

    async insertCrowdReport(r) {
      const { error } = await admin.from("crowd_reports").insert(r);
      fail("insert crowd_report", error);
    },

    async lastCrowdReportAt(deviceHash, pandalId) {
      const { data, error } = await admin
        .from("crowd_reports")
        .select("created_at")
        .eq("device_hash", deviceHash)
        .eq("pandal_id", pandalId)
        .order("created_at", { ascending: false })
        .limit(1);
      fail("last crowd_report", error);
      return data?.[0]?.created_at ?? null;
    },

    async recentCrowdReports(sinceIso) {
      const { data, error } = await admin
        .from("crowd_reports")
        .select("pandal_id,level,created_at,device_hash")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(5000);
      fail("recent crowd_reports", error);
      return (data ?? []) as RawReport[];
    },

    async insertComment(c) {
      const { data, error } = await admin.from("comments").insert(c).select(COMMENT_COLUMNS).single();
      fail("insert comment", error);
      return data as CommentDTO;
    },

    async listComments(pandalId, beforeIso, limit) {
      let q = reader
        .from("comments")
        .select(COMMENT_COLUMNS)
        .eq("pandal_id", pandalId)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (beforeIso) q = q.lt("created_at", beforeIso);
      const { data, error } = await q;
      fail("list comments", error);
      const rows = (data ?? []) as CommentDTO[];
      const page = rows.slice(0, limit);
      return { comments: page, nextCursor: rows.length > limit ? page[page.length - 1].created_at : null };
    },

    async countRecentComments(deviceHash, sinceIso) {
      // hidden comments count too, so a muted spammer can't just keep trying
      const { count, error } = await admin
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("device_hash", deviceHash)
        .gte("created_at", sinceIso);
      fail("count comments", error);
      return count ?? 0;
    },

    async hasDuplicateComment(deviceHash, pandalId, text, sinceIso) {
      const { count, error } = await admin
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("device_hash", deviceHash)
        .eq("pandal_id", pandalId)
        .eq("text", text)
        .gte("created_at", sinceIso);
      fail("duplicate comment", error);
      return (count ?? 0) > 0;
    },

    async reportComment(commentId, deviceHash, threshold) {
      const { data, error } = await admin.rpc("report_comment", {
        p_comment_id: commentId,
        p_device_hash: deviceHash,
        p_threshold: threshold,
      });
      fail("report_comment", error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return { reported_count: Number(row.reported_count), hidden: Boolean(row.hidden) };
    },
  };
}

// --------------------------------------------------------------------------
// In-memory (dev only)
// --------------------------------------------------------------------------
interface MemComment extends CommentDTO {
  device_hash: string;
  hidden: boolean;
}
interface MemState {
  reports: (RawReport & { device_hash: string })[];
  comments: MemComment[];
  commentReports: Set<string>;
}

function memoryStore(): Store {
  const g = globalThis as unknown as { __pujoMem?: MemState };
  const s = (g.__pujoMem ??= { reports: [], comments: [], commentReports: new Set() });
  const ms = (iso: string) => Date.parse(iso);

  return {
    kind: "memory",
    async insertCrowdReport(r) {
      s.reports.push({ ...r, created_at: new Date().toISOString() });
    },
    async lastCrowdReportAt(deviceHash, pandalId) {
      const mine = s.reports.filter((r) => r.device_hash === deviceHash && r.pandal_id === pandalId);
      return mine.length ? mine[mine.length - 1].created_at : null;
    },
    async recentCrowdReports(sinceIso) {
      return s.reports.filter((r) => ms(r.created_at) >= ms(sinceIso));
    },
    async insertComment(c) {
      const created_at = new Date().toISOString();
      const row: MemComment = { id: randomUUID(), ...c, created_at, reported_count: 0, hidden: false };
      s.comments.push(row);
      const { device_hash: _d, hidden: _h, ...dto } = row;
      void _d;
      void _h;
      return dto;
    },
    async listComments(pandalId, beforeIso, limit) {
      const rows = s.comments
        .filter((c) => c.pandal_id === pandalId && !c.hidden && (!beforeIso || ms(c.created_at) < ms(beforeIso)))
        .sort((a, b) => ms(b.created_at) - ms(a.created_at));
      const page = rows.slice(0, limit).map(({ device_hash: _d, hidden: _h, ...dto }) => {
        void _d;
        void _h;
        return dto;
      });
      return { comments: page, nextCursor: rows.length > limit ? page[page.length - 1].created_at : null };
    },
    async countRecentComments(deviceHash, sinceIso) {
      return s.comments.filter((c) => c.device_hash === deviceHash && ms(c.created_at) >= ms(sinceIso)).length;
    },
    async hasDuplicateComment(deviceHash, pandalId, text, sinceIso) {
      return s.comments.some((c) => c.device_hash === deviceHash && c.pandal_id === pandalId && c.text === text && ms(c.created_at) >= ms(sinceIso));
    },
    async reportComment(commentId, deviceHash, threshold) {
      const c = s.comments.find((x) => x.id === commentId);
      if (!c) return null;
      const key = `${commentId}:${deviceHash}`;
      if (!s.commentReports.has(key)) {
        s.commentReports.add(key);
        c.reported_count += 1;
        if (c.reported_count >= threshold) c.hidden = true;
      }
      return { reported_count: c.reported_count, hidden: c.hidden };
    },
  };
}

// --------------------------------------------------------------------------
let cached: Store | null | undefined;

export function getStore(): Store | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && service) cached = supabaseStore(url, service, anon);
  else if (process.env.NODE_ENV !== "production") cached = memoryStore();
  else cached = null;
  return cached;
}
