import { kolkataMinutes, kolkataWeekday } from "@/lib/timeSlot";

/**
 * Tiny parser for the common subset of OSM `opening_hours`:
 *   24/7 | Mo-Su 09:00-22:00 | Mo-Sa 10:00-14:00,17:00-22:00; Su off | 18:00-02:00
 * Anything fancier (PH, sunrise, week numbers...) returns `null` = "unknown".
 */
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface Rule {
  days: Set<number>;
  ranges: [number, number][]; // minutes since midnight
  off: boolean;
}

function parseDays(spec: string): Set<number> | null {
  const days = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.trim().split("-");
    const i = DAYS.indexOf(a);
    if (i < 0) return null;
    if (!b) {
      days.add(i);
      continue;
    }
    const j = DAYS.indexOf(b);
    if (j < 0) return null;
    for (let d = i; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === j) break;
    }
  }
  return days;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function parseRule(raw: string): Rule | null {
  const s = raw.trim();
  const m = s.match(/^(?:([A-Za-z,\-\s]+?)\s+)?(off|closed|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/i);
  if (!m) return null;
  const days = m[1] ? parseDays(m[1].replace(/\s/g, "")) : new Set([0, 1, 2, 3, 4, 5, 6]);
  if (!days) return null;
  if (/^(off|closed)$/i.test(m[2])) return { days, ranges: [], off: true };
  const ranges = m[2].split(",").map((r) => {
    const [a, b] = r.split("-").map((x) => x.trim());
    return [toMin(a), toMin(b)] as [number, number];
  });
  return { days, ranges, off: false };
}

export function isOpenNow(oh: string | undefined, now: Date = new Date()): boolean | null {
  if (!oh) return null;
  const text = oh.trim();
  if (text === "24/7") return true;
  const rules: Rule[] = [];
  for (const part of text.split(";")) {
    if (!part.trim()) continue;
    const r = parseRule(part);
    if (!r) return null;
    rules.push(r);
  }
  if (!rules.length) return null;

  const day = kolkataWeekday(now);
  const prev = (day + 6) % 7;
  const minutes = kolkataMinutes(now);

  let open: boolean | null = null;
  for (const r of rules) {
    if (r.days.has(day)) {
      open = r.off ? false : r.ranges.some(([s, e]) => (s <= e ? minutes >= s && minutes < e : minutes >= s));
    }
  }
  if (open) return true;
  // overnight spill-over from yesterday's rule (e.g. 18:00-02:00)
  for (const r of rules) {
    if (r.days.has(prev) && !r.off && r.ranges.some(([s, e]) => s > e && minutes < e)) return true;
  }
  return open ?? false;
}
