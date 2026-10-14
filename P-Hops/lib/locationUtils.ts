import { haversineKm } from "@/lib/geo";
import type { LatLng } from "@/lib/types";

/** Map updates are throttled: at most one per 5 s, or sooner after a real 20 m move. */
export const FIX_MIN_INTERVAL_MS = 5_000;
export const FIX_MIN_MOVE_M = 20;
/** Below this the device is "standing still": GPS jitter alone does not repaint the map. */
export const FIX_JITTER_M = 5;

export interface Fix extends LatLng {
  accuracy: number;
  /** epoch ms when we accepted this fix */
  time: number;
}

/**
 * Decides whether a new reading from `watchPosition` should update the UI.
 * - moved 20 m or more: yes, immediately
 * - 5 s since the last update and moved a little or accuracy changed a lot: yes
 * - otherwise: no (GPS fires about once a second; repainting that often wastes battery)
 */
export function shouldEmitFix(prev: Fix | null, next: Fix): boolean {
  if (!prev) return true;
  const movedM = haversineKm(prev, next) * 1000;
  if (movedM >= FIX_MIN_MOVE_M) return true;
  if (next.time - prev.time < FIX_MIN_INTERVAL_MS) return false;
  const accuracyChanged = Math.abs(next.accuracy - prev.accuracy) >= Math.max(10, prev.accuracy * 0.3);
  return movedM >= FIX_JITTER_M || accuracyChanged;
}

export type GeoErrorCode =
  | "permission_denied" // blocked in browser/site settings
  | "dismissed" // the prompt was closed without an answer (permission is still "prompt")
  | "position_unavailable"
  | "timeout"
  | "unsupported"
  | "insecure_context";

export interface GeoError {
  code: GeoErrorCode;
  /** the browser reported no network when the error happened (helps explain POSITION_UNAVAILABLE) */
  offline: boolean;
}

export type InAppBrowser = "whatsapp" | "instagram" | "facebook";
export type Platform = "ios" | "android" | "desktop";

export interface BrowserEnv {
  inApp: InAppBrowser | null;
  platform: Platform;
}

/**
 * Best-effort user-agent sniffing. In-app browsers (WhatsApp, Instagram, Facebook/Messenger) frequently
 * block geolocation or fail silently. Some of them (e.g. WhatsApp on iOS) send an ordinary Safari UA, so a
 * `null` here does not prove we are in a normal browser.
 */
export function detectEnvironment(ua: string, maxTouchPoints = 0): BrowserEnv {
  const inApp: InAppBrowser | null = /Instagram/i.test(ua)
    ? "instagram"
    : /FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)
      ? "facebook"
      : /WhatsApp/i.test(ua)
        ? "whatsapp"
        : null;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1); // iPadOS reports a Mac UA
  const platform: Platform = ios ? "ios" : /Android/i.test(ua) ? "android" : "desktop";
  return { inApp, platform };
}
