import type { NextRequest } from "next/server";

import { CROWD_RULES } from "@/config/puja";
import { aggregateReports, CROWD_LEVELS } from "@/lib/crowdService";
import { PANDAL_BY_ID } from "@/lib/data";
import { deviceHash, errorJson, ipKey, json, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import type { CrowdLevel } from "@/lib/types";

const windowIso = () => new Date(Date.now() - CROWD_RULES.windowMinutes * 60_000).toISOString();

/** GET /api/crowd -> majority-vote aggregates (last 60 min) for every pandal that has reports. */
export async function GET(request: NextRequest) {
  const store = getStore();
  if (!store) return errorJson(503, "not_configured", { aggregates: [] });

  const rl = rateLimit(`crowd:get:${ipKey(request)}`, 600, 60_000);
  if (!rl.ok) return errorJson(429, "rate_limited", { retryAfterSec: rl.retryAfterSec });

  try {
    const reports = await store.recentCrowdReports(windowIso());
    const aggregates = aggregateReports(reports);
    // Short CDN cache: thousands of phones polling every minute collapse into a handful of DB reads.
    return json({ aggregates }, 200, { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" });
  } catch (err) {
    console.error("[api/crowd GET]", err);
    return errorJson(500, "server_error", { aggregates: [] });
  }
}

/** POST /api/crowd { pandalId, level } - one report / pandal / device / 10 min. */
export async function POST(request: NextRequest) {
  const store = getStore();
  if (!store) return errorJson(503, "not_configured");

  const ipRl = rateLimit(`crowd:post:${ipKey(request)}`, 500, 10 * 60_000);
  if (!ipRl.ok) return errorJson(429, "rate_limited", { retryAfterSec: ipRl.retryAfterSec });

  const body = await readJson(request);
  const pandalId = typeof body?.pandalId === "string" ? body.pandalId : "";
  const level = body?.level as CrowdLevel;
  if (!PANDAL_BY_ID.has(pandalId) || !CROWD_LEVELS.includes(level)) return errorJson(400, "invalid");

  const hash = deviceHash(request);
  const devRl = rateLimit(`crowd:dev:${hash}`, 40, 60 * 60_000);
  if (!devRl.ok) return errorJson(429, "rate_limited", { retryAfterSec: devRl.retryAfterSec });
  // The device id is chosen by the client, so it can be rotated. This per-network brake on a single pandal
  // (generous: a crowded pandal shares a few carrier-NAT addresses) stops one source from stuffing the ballot.
  const pandalRl = rateLimit(`crowd:pandal:${ipKey(request)}:${pandalId}`, 25, CROWD_RULES.cooldownMinutes * 60_000);
  if (!pandalRl.ok) return errorJson(429, "rate_limited", { retryAfterSec: pandalRl.retryAfterSec });

  try {
    // authoritative cooldown check (the browser's localStorage check is only a convenience)
    const last = await store.lastCrowdReportAt(hash, pandalId);
    if (last) {
      const elapsedMin = (Date.now() - Date.parse(last)) / 60_000;
      if (elapsedMin < CROWD_RULES.cooldownMinutes) {
        return errorJson(429, "cooldown", { retryAfterMinutes: Math.max(1, Math.ceil(CROWD_RULES.cooldownMinutes - elapsedMin)) });
      }
    }
    await store.insertCrowdReport({ pandal_id: pandalId, level, device_hash: hash });
    const reports = await store.recentCrowdReports(windowIso());
    const aggregate = aggregateReports(reports).find((a) => a.pandalId === pandalId) ?? null;
    return json({ ok: true, aggregate }, 201);
  } catch (err) {
    console.error("[api/crowd POST]", err);
    return errorJson(500, "server_error");
  }
}
