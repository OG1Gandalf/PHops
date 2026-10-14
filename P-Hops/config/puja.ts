import type { PujaDay, TimeSlot, Zone } from "@/lib/types";

/**
 * ONE PLACE TO CORRECT DATES.
 *
 * Durga Puja 2026 dates below are APPROXIMATE: Shashthi Oct 16 -> Dashami Oct 20, with
 * Bhasan (immersion) on Dashami evening. At the time of writing, some committee sites
 * (e.g. haritakibagandurgapuja.in) list 16-20 Oct while several aggregator sites list 17-21 Oct,
 * so confirm against the official panjika / local clubs and edit here. Event dates in
 * /data/events.json are derived from this file at load time, so nothing else needs to change.
 */
export const PUJA_YEAR = 2026;
/** Set to false once the dates below are confirmed. Shows a "dates approximate" banner. */
export const PUJA_DATES_APPROXIMATE = true;

export const PUJA_DAYS: { key: PujaDay; date: string }[] = [
  { key: "shashthi", date: "2026-10-16" },
  { key: "saptami", date: "2026-10-17" },
  { key: "ashtami", date: "2026-10-18" },
  { key: "navami", date: "2026-10-19" },
  { key: "dashami", date: "2026-10-20" },
  { key: "bhasan", date: "2026-10-20" }, // evening of Dashami; some clubs immerse a day later
];

export const PUJA_DATE_BY_DAY: Record<PujaDay, string> = Object.fromEntries(
  PUJA_DAYS.map((d) => [d.key, d.date]),
) as Record<PujaDay, string>;

/** Map configuration - restricted to Kolkata. */
export const MAP_CONFIG = {
  center: [22.5726, 88.3639] as [number, number],
  zoom: 12,
  minZoom: 11,
  maxZoom: 18,
  maxBounds: [
    [22.35, 88.18],
    [22.8, 88.52],
  ] as [[number, number], [number, number]],
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/** Hour ranges in Asia/Kolkata, [startHour, endHour). "night" wraps past midnight. */
export const TIME_SLOTS: { key: TimeSlot; start: number; end: number }[] = [
  { key: "morning", start: 5, end: 12 },
  { key: "afternoon", start: 12, end: 17 },
  { key: "evening", start: 17, end: 22 },
  { key: "night", start: 22, end: 5 },
];

export const TIMEZONE = "Asia/Kolkata";

/** Crowd reporting rules (also enforced server-side). */
export const CROWD_RULES = {
  windowMinutes: 60,
  minReports: 2,
  cooldownMinutes: 10,
};

export const COMMENT_RULES = {
  maxLength: 300,
  maxNameLength: 40,
  perDevicePerHour: 3,
  hideAfterReports: 3,
  pageSize: 10,
};

export const ZONES: Zone[] = [
  "north",
  "central",
  "south",
  "saltlake",
  "howrah",
  "behala",
  "east",
];

/** Walking assumptions for "approximate walking distance and time". */
export const WALKING = {
  speedKmh: 4.5,
  /** Streets are not straight lines; inflate haversine distance. */
  detourFactor: 1.3,
};
