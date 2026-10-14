/**
 * CROWD SERVICE - the single place all crowd / traffic logic lives.
 *
 * Priority of sources for the level displayed for a pandal:
 *   1. Visitor reports   - majority vote of the last 60 min, needs >= 2 reports
 *                          (only applied when the selected slot is the current slot, because
 *                          reports describe "right now")
 *   2. External provider - OPTIONAL plug-in (see `registerCrowdProvider`) for live traffic such as
 *                          TomTom / Google. Nothing is registered by default.
 *   3. Historic estimate - `pandal.crowdByTimeSlot[slot]`, labelled "Estimated"
 *
 * This file is pure (no React / no browser APIs) except for the two `fetch` helpers at the bottom,
 * so the API routes and the UI share exactly the same voting logic.
 */
import { CROWD_RULES } from "@/config/puja";
import type { CrowdAggregate, CrowdLevel, Pandal, TimeSlot } from "@/lib/types";

export const CROWD_LEVELS: CrowdLevel[] = ["low", "medium", "high"];
export const CROWD_RANK: Record<CrowdLevel, number> = { low: 0, medium: 1, high: 2 };

export type CrowdSource = "visitors" | "provider" | "estimate";

export interface DisplayedCrowd {
  level: CrowdLevel;
  source: CrowdSource;
  /** number of visitor reports behind the level (visitors source only) */
  reportCount?: number;
  /** ISO timestamp of the most recent report / provider update */
  updatedAt?: string;
}

// --------------------------------------------------------------------------
// Historic estimate
// --------------------------------------------------------------------------
export function historicLevel(pandal: Pick<Pandal, "crowdByTimeSlot">, slot: TimeSlot): CrowdLevel {
  return pandal.crowdByTimeSlot[slot];
}

// --------------------------------------------------------------------------
// Visitor reports -> aggregate (used server-side by GET /api/crowd)
// --------------------------------------------------------------------------
export interface RawReport {
  pandal_id: string;
  level: CrowdLevel;
  created_at: string;
  /** Server only (never sent to browsers). When present, each device counts once per pandal. */
  device_hash?: string;
}

/**
 * Majority vote per pandal over the reports inside the window.
 *
 * - One vote per device per pandal: when the same device reported more than once in the window (the 10-minute
 *   cooldown still allows up to six reports an hour), only its newest report counts. Otherwise one person could
 *   satisfy the "at least 2 reports" rule alone.
 * - Ties are broken in favour of the level of the most recent report among the tied levels.
 */
export function aggregateReports(
  reports: readonly RawReport[],
  now: Date = new Date(),
  windowMinutes: number = CROWD_RULES.windowMinutes,
): CrowdAggregate[] {
  const cutoff = now.getTime() - windowMinutes * 60_000;
  const byPandal = new Map<string, RawReport[]>();
  const seenDevice = new Set<string>();
  const newestFirst = [...reports].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const r of newestFirst) {
    const t = Date.parse(r.created_at);
    if (!Number.isFinite(t) || t < cutoff || t > now.getTime() + 60_000) continue;
    if (!(r.level in CROWD_RANK)) continue;
    if (r.device_hash) {
      const k = `${r.pandal_id}|${r.device_hash}`;
      if (seenDevice.has(k)) continue;
      seenDevice.add(k);
    }
    const list = byPandal.get(r.pandal_id);
    if (list) list.push(r);
    else byPandal.set(r.pandal_id, [r]);
  }

  const out: CrowdAggregate[] = [];
  for (const [pandalId, list] of byPandal) {
    list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)); // newest first
    const tally: Record<CrowdLevel, number> = { low: 0, medium: 0, high: 0 };
    for (const r of list) tally[r.level]++;
    const max = Math.max(...Object.values(tally));
    const tied = CROWD_LEVELS.filter((l) => tally[l] === max);
    const level = tied.length === 1 ? tied[0] : (list.find((r) => tied.includes(r.level))?.level ?? tied[0]);
    out.push({ pandalId, level, count: list.length, lastReportAt: list[0].created_at });
  }
  return out;
}

// --------------------------------------------------------------------------
// Optional live-traffic plug-in point
// --------------------------------------------------------------------------
export interface ProviderReading {
  level: CrowdLevel;
  updatedAt: string;
}
export interface CrowdProvider {
  name: string;
  /** Return a reading per pandal id; omit pandals you have no data for. */
  getLevels(pandals: readonly Pandal[], slot: TimeSlot): Promise<Record<string, ProviderReading>>;
}

let provider: CrowdProvider | null = null;
let providerCache: Record<string, ProviderReading> = {};

/**
 * Phase 2 hook. Register a TomTom/Google traffic adapter at app start-up and the rest of the app
 * (map markers, lists, "least crowded" ranking) will pick the readings up automatically.
 */
export function registerCrowdProvider(p: CrowdProvider | null) {
  provider = p;
  providerCache = {};
}

export async function refreshProvider(pandals: readonly Pandal[], slot: TimeSlot) {
  if (!provider) return;
  try {
    providerCache = await provider.getLevels(pandals, slot);
  } catch {
    providerCache = {};
  }
}

// --------------------------------------------------------------------------
// Displayed level
// --------------------------------------------------------------------------
export type AggregateMap = ReadonlyMap<string, CrowdAggregate>;

export function toAggregateMap(list: readonly CrowdAggregate[]): Map<string, CrowdAggregate> {
  return new Map(list.map((a) => [a.pandalId, a]));
}

/** True when a fresh poll carries exactly what we already hold (so the UI need not re-render or rebuild markers). */
export function sameAggregates(prev: AggregateMap, next: readonly CrowdAggregate[]): boolean {
  if (prev.size !== next.length) return false;
  return next.every((a) => {
    const p = prev.get(a.pandalId);
    return !!p && p.level === a.level && p.count === a.count && p.lastReportAt === a.lastReportAt;
  });
}

export function getDisplayedCrowd(
  pandal: Pandal,
  slot: TimeSlot,
  currentSlot: TimeSlot,
  aggregates: AggregateMap,
): DisplayedCrowd {
  if (slot === currentSlot) {
    const agg = aggregates.get(pandal.id);
    if (agg && agg.count >= CROWD_RULES.minReports) {
      return { level: agg.level, source: "visitors", reportCount: agg.count, updatedAt: agg.lastReportAt };
    }
    const ext = providerCache[pandal.id];
    if (ext) return { level: ext.level, source: "provider", updatedAt: ext.updatedAt };
  }
  return { level: historicLevel(pandal, slot), source: "estimate" };
}

/** Least crowded first; visitor-backed readings win over estimates at equal level. */
export function rankLeastCrowded(
  pandals: readonly Pandal[],
  slot: TimeSlot,
  currentSlot: TimeSlot,
  aggregates: AggregateMap,
): { pandal: Pandal; crowd: DisplayedCrowd }[] {
  const sourceRank: Record<CrowdSource, number> = { visitors: 0, provider: 1, estimate: 2 };
  return pandals
    .map((pandal) => ({ pandal, crowd: getDisplayedCrowd(pandal, slot, currentSlot, aggregates) }))
    .sort(
      (a, b) =>
        CROWD_RANK[a.crowd.level] - CROWD_RANK[b.crowd.level] ||
        sourceRank[a.crowd.source] - sourceRank[b.crowd.source] ||
        a.pandal.name.localeCompare(b.pandal.name),
    );
}

export function minutesAgo(iso: string | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
}

// --------------------------------------------------------------------------
// Client-side API helpers
// --------------------------------------------------------------------------
export async function fetchCrowdAggregates(signal?: AbortSignal): Promise<CrowdAggregate[]> {
  const res = await fetch("/api/crowd", { signal });
  if (!res.ok) throw new Error(`crowd ${res.status}`);
  const json = (await res.json()) as { aggregates: CrowdAggregate[] };
  return json.aggregates;
}

export type SubmitResult =
  | { ok: true; aggregate: CrowdAggregate | null }
  | { ok: false; code: string; retryAfterMinutes?: number };

export async function submitCrowdReport(pandalId: string, level: CrowdLevel, deviceId: string): Promise<SubmitResult> {
  try {
    const res = await fetch("/api/crowd", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ pandalId, level }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, aggregate: json.aggregate ?? null };
    return { ok: false, code: json.code ?? "error", retryAfterMinutes: json.retryAfterMinutes };
  } catch {
    return { ok: false, code: "network" };
  }
}
