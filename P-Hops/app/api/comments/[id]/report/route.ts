import type { NextRequest } from "next/server";

import { COMMENT_RULES } from "@/config/puja";
import { deviceHash, errorJson, ipKey, json } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/comments/:id/report - one report per device per comment; auto-hides at 3 reports. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/comments/[id]/report">) {
  const store = getStore();
  if (!store) return errorJson(503, "not_configured");

  const { id } = await ctx.params;
  if (!UUID.test(id)) return errorJson(400, "invalid");

  const rl = rateLimit(`comments:report:${ipKey(request)}`, 200, 10 * 60_000);
  if (!rl.ok) return errorJson(429, "rate_limited", { retryAfterSec: rl.retryAfterSec });
  // The device id header is client-chosen, so also allow each network only one report per comment per hour;
  // otherwise three made-up ids could hide anyone's comment.
  const perComment = rateLimit(`comments:report:${ipKey(request)}:${id}`, 1, 60 * 60_000);
  if (!perComment.ok) return errorJson(429, "rate_limited", { retryAfterSec: perComment.retryAfterSec });

  try {
    const result = await store.reportComment(id, deviceHash(request), COMMENT_RULES.hideAfterReports);
    if (!result) return errorJson(404, "not_found");
    return json({ ok: true, hidden: result.hidden });
  } catch (err) {
    console.error("[api/comments report]", err);
    return errorJson(500, "server_error");
  }
}
