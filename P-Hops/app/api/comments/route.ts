import type { NextRequest } from "next/server";

import { COMMENT_RULES } from "@/config/puja";
import { PANDAL_BY_ID } from "@/lib/data";
import { deviceHash, errorJson, ipKey, json, readJson } from "@/lib/server/http";
import { checkComment, sanitizeName, sanitizeText } from "@/lib/server/moderation";
import { rateLimit } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";

const HOUR = 60 * 60_000;

/** GET /api/comments?pandalId=..&cursor=<ISO created_at>&limit=10 -> newest first, hidden ones excluded. */
export async function GET(request: NextRequest) {
  const store = getStore();
  if (!store) return errorJson(503, "not_configured");

  const rl = rateLimit(`comments:get:${ipKey(request)}`, 600, 60_000);
  if (!rl.ok) return errorJson(429, "rate_limited", { retryAfterSec: rl.retryAfterSec });

  const sp = request.nextUrl.searchParams;
  const pandalId = sp.get("pandalId") ?? "";
  if (!PANDAL_BY_ID.has(pandalId)) return errorJson(400, "invalid");
  const cursorRaw = sp.get("cursor");
  if (cursorRaw && Number.isNaN(Date.parse(cursorRaw))) return errorJson(400, "invalid");
  const limit = Math.min(20, Math.max(1, Number.parseInt(sp.get("limit") ?? "", 10) || COMMENT_RULES.pageSize));

  try {
    const page = await store.listComments(pandalId, cursorRaw, limit);
    return json(page, 200, { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" });
  } catch (err) {
    console.error("[api/comments GET]", err);
    return errorJson(500, "server_error");
  }
}

/** POST /api/comments { pandalId, name?, text } */
export async function POST(request: NextRequest) {
  const store = getStore();
  if (!store) return errorJson(503, "not_configured");

  // generous: many phones share one carrier-NAT IP at a busy pandal; the per-device limit below is the real control
  const ipRl = rateLimit(`comments:post:${ipKey(request)}`, 200, HOUR);
  if (!ipRl.ok) return errorJson(429, "rate_limited", { retryAfterSec: ipRl.retryAfterSec });

  const body = await readJson(request);
  const pandalId = typeof body?.pandalId === "string" ? body.pandalId : "";
  if (!body || !PANDAL_BY_ID.has(pandalId) || typeof body.text !== "string") return errorJson(400, "invalid");

  const text = sanitizeText(body.text);
  const name = sanitizeName(body.name);
  const verdict = checkComment(text, name === "Visitor" ? undefined : name);
  if (!verdict.ok) return errorJson(422, verdict.code);

  const hash = deviceHash(request);
  const since = new Date(Date.now() - HOUR).toISOString();

  try {
    // authoritative per-device limit, checked against the database
    if ((await store.countRecentComments(hash, since)) >= COMMENT_RULES.perDevicePerHour) {
      return errorJson(429, "rate_limited");
    }
    if (await store.hasDuplicateComment(hash, pandalId, text, since)) return errorJson(409, "duplicate");

    const comment = await store.insertComment({ pandal_id: pandalId, name, text, device_hash: hash });
    return json({ ok: true, comment }, 201);
  } catch (err) {
    console.error("[api/comments POST]", err);
    return errorJson(500, "server_error");
  }
}
