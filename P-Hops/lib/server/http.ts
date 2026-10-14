import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export const errorJson = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  json({ code, ...extra }, status);

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Salt for device / IP hashes. In production a missing DEVICE_HASH_SALT must not silently fall back to a salt that is
 * public in the repo, so we derive one from the service-role secret instead (stable across instances, never exposed).
 */
const SALT = (() => {
  if (process.env.DEVICE_HASH_SALT) return process.env.DEVICE_HASH_SALT;
  if (process.env.NODE_ENV === "production") {
    // only worth a warning when the server can actually store something
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) console.warn("[config] DEVICE_HASH_SALT is not set; deriving the salt from SUPABASE_SERVICE_ROLE_KEY. Set DEVICE_HASH_SALT.");
    return `derived:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`;
  }
  return "dev-only-salt-change-me";
})();

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);

/** Stable per-IP key for rate limiting. Never stored in the database. */
export const ipKey = (request: Request) => `ip:${sha(`${SALT}:${clientIp(request)}`)}`;

/**
 * Anonymous device hash stored with reports/comments. Derived from the random device id the browser
 * keeps in localStorage (primary) - IP alone would punish everyone behind the same mobile carrier NAT.
 * Falls back to IP+User-Agent when the header is missing.
 */
export function deviceHash(request: Request): string {
  const id = request.headers.get("x-device-id") ?? "";
  if (/^[A-Za-z0-9-]{16,64}$/.test(id)) return sha(`${SALT}:dev:${id}`);
  return sha(`${SALT}:ipua:${clientIp(request)}:${request.headers.get("user-agent") ?? ""}`);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > 4000) return null;
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
