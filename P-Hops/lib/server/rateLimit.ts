/**
 * Minimal fixed-window rate limiter held in process memory.
 *
 * Good enough as a first brake on bursts. NOTE: on Vercel every serverless instance has its own
 * memory, so this is best-effort; the hard limits (1 crowd report / pandal / device / 10 min, 3
 * comments / device / hour) are enforced against the database in the API routes. For stricter
 * global limits swap this for Upstash Redis / Vercel KV (same function signature).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __pujoRL?: Map<string, Bucket> };
const buckets = (g.__pujoRL ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.count += 1;
  return b.count <= limit
    ? { ok: true, retryAfterSec: 0 }
    : { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}
