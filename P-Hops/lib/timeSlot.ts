import { TIME_SLOTS, TIMEZONE } from "@/config/puja";
import type { TimeSlot } from "@/lib/types";

export const SLOT_ORDER: TimeSlot[] = ["morning", "afternoon", "evening", "night"];

/** Current hour (0-23) in Asia/Kolkata, regardless of the device's own time zone. */
export function kolkataHour(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: TIMEZONE,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number.parseInt(h, 10) % 24;
}

export function slotForHour(hour: number): TimeSlot {
  for (const s of TIME_SLOTS) {
    // "night" wraps midnight (22 -> 5)
    const inSlot = s.start < s.end ? hour >= s.start && hour < s.end : hour >= s.start || hour < s.end;
    if (inSlot) return s.key;
  }
  return "night";
}

export function currentSlot(date: Date = new Date()): TimeSlot {
  return slotForHour(kolkataHour(date));
}

/** ISO date (YYYY-MM-DD) "today" in Asia/Kolkata. */
export function kolkataToday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

/** Minutes since midnight in Asia/Kolkata. */
export function kolkataMinutes(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone: TIMEZONE,
  }).formatToParts(date);
  const h = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const m = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return h * 60 + m;
}

/** Weekday index 0 (Mon) .. 6 (Sun) in Asia/Kolkata. */
export function kolkataWeekday(date: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIMEZONE }).format(date);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd);
}
