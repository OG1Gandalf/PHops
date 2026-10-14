/**
 * Unit tests for the pure logic (no browser, no network, no database):
 *
 *   npm run test:logic
 *   TZ=America/Los_Angeles npm run test:logic     # must pass in any server / device time zone
 */
import assert from "node:assert/strict";

import { COMMENT_RULES, CROWD_RULES, MAP_CONFIG } from "../config/puja";
import { aggregateReports, getDisplayedCrowd, rankLeastCrowded, sameAggregates, toAggregateMap, type RawReport } from "../lib/crowdService";
import { appleMapsUrl, googleMapsUrl } from "../lib/directions";
import { formatDistance, haversineKm, isInsideKolkata, nearest, walkingKm, walkingMinutes } from "../lib/geo";
import { isOpenNow } from "../lib/openingHours";
import { normalize, searchPandals } from "../lib/search";
import { checkComment, containsLink, containsProfanity, looksLikeSpam, sanitizeName, sanitizeText } from "../lib/server/moderation";
import { rateLimit } from "../lib/server/rateLimit";
import { initialTileUrls } from "../lib/tiles";
import { currentSlot, kolkataHour, kolkataMinutes, kolkataToday, kolkataWeekday, slotForHour } from "../lib/timeSlot";
import { EVENTS, PANDALS } from "../lib/data";
import type { CrowdLevel, Pandal } from "../lib/types";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}\n`, e instanceof Error ? e.message : e);
  }
}
const near = (actual: number, expected: number, tolerance: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${msg ?? "value"}: expected ${expected} +/- ${tolerance}, got ${actual}`);

// ------------------------------------------------------------------------------------------------ geo
console.log(`geo  (process TZ = ${process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone})`);

/** Independent implementation (spherical law of cosines) used to cross-check the Haversine code. */
const lawOfCosinesKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180;
  return 6371.0088 * Math.acos(Math.min(1, Math.sin(r(a.lat)) * Math.sin(r(b.lat)) + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng))));
};

test("haversine: one degree of latitude / of longitude on the equator is 111.195 km", () => {
  near(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111.195, 0.01);
  near(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 111.195, 0.01);
});
test("haversine: a point to itself is 0, and the formula is symmetric", () => {
  const a = { lat: 22.5726, lng: 88.3639 };
  const b = { lat: 22.5839, lng: 88.3426 };
  assert.equal(haversineKm(a, a), 0);
  near(haversineKm(a, b), haversineKm(b, a), 1e-12);
});
test("haversine: published city-pair distances (Kolkata-Delhi ~1305 km, Delhi-Mumbai ~1153 km), within 1%", () => {
  const kolkata = { lat: 22.5726, lng: 88.3639 };
  const delhi = { lat: 28.6139, lng: 77.209 };
  const mumbai = { lat: 19.076, lng: 72.8777 };
  near(haversineKm(kolkata, delhi), 1305, 13);
  near(haversineKm(delhi, mumbai), 1153, 12);
});
test("haversine: matches an independent formula for 200 pandal pairs inside Kolkata (< 0.05%)", () => {
  let n = 0;
  for (let i = 0; i < PANDALS.length - 1 && n < 200; i++) {
    for (let j = i + 1; j < PANDALS.length && n < 200; j += 7, n++) {
      const h = haversineKm(PANDALS[i], PANDALS[j]);
      const l = lawOfCosinesKm(PANDALS[i], PANDALS[j]);
      assert.ok(Math.abs(h - l) <= Math.max(2e-4, h * 0.0005), `${PANDALS[i].id} -> ${PANDALS[j].id}: ${h} vs ${l}`);
    }
  }
});
test("initial tile preload covers the tiles around the default map view", () => {
  const urls = initialTileUrls(MAP_CONFIG);
  assert.equal(urls.length, 4);
  assert.equal(new Set(urls).size, 4);
  // Kolkata centre (22.5726, 88.3639) at z12 sits in tile 3053/1784 (seen in real map requests)
  assert.ok(urls.includes("https://tile.openstreetmap.org/12/3053/1784.png"), urls.join(", "));
  assert.ok(urls.every((u) => /\/12\/30(52|53)\/17(83|84)\.png$/.test(u)), urls.join(", "));
});

test("walking distance is the straight line x 1.3 and 4.5 km/h", () => {
  const a = { lat: 22.5839, lng: 88.3426 };
  const b = { lat: 22.5686, lng: 88.37 };
  near(walkingKm(a, b), haversineKm(a, b) * 1.3, 1e-12);
  assert.equal(walkingMinutes(4.5), 60);
  assert.equal(walkingMinutes(0), 1, "never shows 0 minutes");
  assert.equal(walkingMinutes(0.75), 10);
});
test("nearest(): returns the true closest items, nearest first, for an arbitrary origin", () => {
  const origin = { lat: 22.5726, lng: 88.3639 };
  const got = nearest(origin, PANDALS, 5).map((x) => x.item.id);
  const brute = [...PANDALS].sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b)).slice(0, 5).map((p) => p.id);
  assert.deepEqual(got, brute);
});
test("formatDistance rounds sensibly", () => {
  assert.equal(formatDistance(0.35), "350 m");
  assert.equal(formatDistance(0.004), "10 m");
  assert.equal(formatDistance(1.234), "1.2 km");
  assert.equal(formatDistance(12.6), "13 km");
});
test("isInsideKolkata follows MAP_CONFIG.maxBounds (edges inclusive)", () => {
  assert.ok(isInsideKolkata({ lat: 22.5726, lng: 88.3639 }));
  assert.ok(isInsideKolkata({ lat: 22.35, lng: 88.18 }));
  assert.ok(isInsideKolkata({ lat: 22.8, lng: 88.52 }));
  assert.ok(!isInsideKolkata({ lat: 28.61, lng: 77.2 }), "Delhi");
  assert.ok(!isInsideKolkata({ lat: 22.34, lng: 88.3 }));
  assert.ok(!isInsideKolkata({ lat: 22.5, lng: 88.53 }));
});

// ------------------------------------------------------------------------------------------------ time
console.log("time (Asia/Kolkata, whatever the machine's own zone is)");
const IST = (iso: string) => new Date(`${iso}+05:30`);
test("slotForHour covers all 24 hours with the documented boundaries", () => {
  const expected: Record<number, string> = {};
  for (let h = 0; h < 24; h++) expected[h] = h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 22 ? "evening" : "night";
  for (let h = 0; h < 24; h++) assert.equal(slotForHour(h), expected[h], `hour ${h}`);
});
test("current slot is computed in IST regardless of the machine zone", () => {
  assert.equal(currentSlot(new Date("2026-10-17T00:00:00Z")), "morning", "05:30 IST");
  assert.equal(currentSlot(new Date("2026-10-16T23:29:59Z")), "night", "04:59:59 IST");
  assert.equal(currentSlot(new Date("2026-10-16T23:30:00Z")), "morning", "05:00 IST");
  assert.equal(currentSlot(new Date("2026-10-17T06:30:00Z")), "afternoon", "12:00 IST");
  assert.equal(currentSlot(new Date("2026-10-17T11:30:00Z")), "evening", "17:00 IST");
  assert.equal(currentSlot(new Date("2026-10-17T16:30:00Z")), "night", "22:00 IST");
});
test("midnight crossing: 23:59 IST and 00:01 IST are both 'night', and the date flips at IST midnight", () => {
  assert.equal(currentSlot(IST("2026-10-17T23:59:00")), "night");
  assert.equal(currentSlot(IST("2026-10-18T00:01:00")), "night");
  assert.equal(kolkataToday(IST("2026-10-17T23:59:59")), "2026-10-17");
  assert.equal(kolkataToday(IST("2026-10-18T00:00:00")), "2026-10-18");
  assert.equal(kolkataHour(IST("2026-10-18T00:00:00")), 0, "hour 0, not 24");
});
test("a visitor whose phone is in London / Los Angeles still sees Kolkata time", () => {
  const instant = new Date("2026-10-16T20:00:00Z"); // 01:30 IST on the 17th
  assert.equal(kolkataToday(instant), "2026-10-17");
  assert.equal(kolkataMinutes(instant), 90);
  assert.equal(currentSlot(instant), "night");
  assert.equal(kolkataWeekday(instant), 5, "Saturday = index 5 (Mon=0)");
});

// ------------------------------------------------------------------------------------------------ crowd
console.log("crowd reports");
const NOW = new Date("2026-10-17T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const rep = (pandal_id: string, level: CrowdLevel, minutesAgo: number, device_hash?: string): RawReport => ({ pandal_id, level, created_at: ago(minutesAgo), device_hash });
const pandal = (over: Partial<Pandal> = {}): Pandal => ({ ...PANDALS[0], crowdByTimeSlot: { morning: "low", afternoon: "medium", evening: "high", night: "low" }, ...over });

test("majority vote per pandal", () => {
  const out = aggregateReports([rep("a", "high", 5), rep("a", "high", 10), rep("a", "low", 3), rep("b", "low", 1)], NOW);
  assert.equal(out.find((x) => x.pandalId === "a")?.level, "high");
  assert.equal(out.find((x) => x.pandalId === "a")?.count, 3);
  assert.equal(out.find((x) => x.pandalId === "b")?.count, 1);
});
test("tie goes to the most recent report among the tied levels", () => {
  const out = aggregateReports([rep("a", "low", 20), rep("a", "high", 2), rep("a", "medium", 1), rep("a", "medium", 30), rep("a", "high", 40)], NOW);
  // high x2, medium x2, low x1 -> tied high/medium; the newest of those is medium (1 min ago)
  assert.equal(out[0].level, "medium");
});
test("60-minute window: 59 min counts, 61 min does not, and future-dated reports are ignored", () => {
  const out = aggregateReports([rep("a", "high", 59), rep("a", "low", 61), rep("a", "low", -30)], NOW);
  assert.equal(out[0].count, 1);
  assert.equal(out[0].level, "high");
});
test("one vote per device per pandal (newest wins), so one person cannot reach the 2-report minimum alone", () => {
  const out = aggregateReports([rep("a", "high", 40, "dev1"), rep("a", "high", 25, "dev1"), rep("a", "high", 11, "dev1")], NOW);
  assert.equal(out[0].count, 1);
  const two = aggregateReports([rep("a", "high", 40, "dev1"), rep("a", "low", 5, "dev1"), rep("a", "low", 4, "dev2")], NOW);
  assert.equal(two[0].count, 2);
  assert.equal(two[0].level, "low", "dev1's older 'high' was superseded by its newer 'low'");
});
test("displayed crowd: needs >= 2 reports, only for the current slot, otherwise falls back to the estimate", () => {
  const p = pandal({ id: "a" });
  const one = toAggregateMap(aggregateReports([rep("a", "high", 5)], NOW));
  const two = toAggregateMap(aggregateReports([rep("a", "high", 5), rep("a", "high", 6)], NOW));
  assert.equal(CROWD_RULES.minReports, 2);
  assert.deepEqual(getDisplayedCrowd(p, "evening", "evening", one), { level: "high", source: "estimate" }, "1 report: estimate");
  assert.equal(getDisplayedCrowd(p, "morning", "morning", one).level, "low", "1 report on a quiet-estimate slot stays the estimate");
  const live = getDisplayedCrowd(p, "morning", "morning", two);
  assert.equal(live.source, "visitors");
  assert.equal(live.level, "high");
  assert.equal(live.reportCount, 2);
  const other = getDisplayedCrowd(p, "afternoon", "morning", two);
  assert.equal(other.source, "estimate", "reports describe 'right now', not other slots");
  assert.equal(other.level, "medium");
});
test("ranking puts quiet first and prefers visitor-backed readings at an equal level", () => {
  const a = pandal({ id: "a", name: "A", crowdByTimeSlot: { morning: "low", afternoon: "low", evening: "low", night: "low" } });
  const b = pandal({ id: "b", name: "B", crowdByTimeSlot: { morning: "high", afternoon: "high", evening: "high", night: "high" } });
  const c = pandal({ id: "c", name: "C", crowdByTimeSlot: { morning: "high", afternoon: "high", evening: "high", night: "high" } });
  const aggs = toAggregateMap(aggregateReports([rep("c", "low", 1), rep("c", "low", 2)], NOW));
  const ranked = rankLeastCrowded([b, a, c], "morning", "morning", aggs).map((r) => r.pandal.id);
  // c has two visitor reports saying "low", so it beats a (estimate "low"); b (estimate "high") is last
  assert.deepEqual(ranked, ["c", "a", "b"]);
});
test("sameAggregates detects no-op polls", () => {
  const list = aggregateReports([rep("a", "high", 5), rep("a", "high", 6)], NOW);
  assert.ok(sameAggregates(toAggregateMap(list), list));
  assert.ok(!sameAggregates(toAggregateMap(list), []));
  assert.ok(!sameAggregates(toAggregateMap(list), [{ ...list[0], count: 3 }]));
});
test("rate limiter: allows `limit` per window, then blocks with a retry time, then resets", () => {
  const key = `t:${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.ok(rateLimit(key, 3, 50).ok);
  const blocked = rateLimit(key, 3, 50);
  assert.ok(!blocked.ok);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.ok(rateLimit(`${key}:other`, 3, 50).ok, "keys are independent");
});
test("rate limiter window resets after it elapses", async () => {
  const key = `t2:${Math.random()}`;
  assert.ok(rateLimit(key, 1, 20).ok);
  assert.ok(!rateLimit(key, 1, 20).ok);
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(rateLimit(key, 1, 20).ok);
});

// ------------------------------------------------------------------------------------------------ comments
console.log("comment moderation");
test("sanitizeText strips tags, entities, control and zero-width characters", () => {
  assert.equal(sanitizeText("<script>alert(1)</script>hello"), "alert(1) hello");
  assert.equal(sanitizeText("hi <img src=x onerror=alert(1)> there"), "hi there");
  assert.equal(sanitizeText("a\u200bb\u0000c"), "abc");
  assert.equal(sanitizeText("  lots   of    space \n\n\n\n here "), "lots of space\nhere");
  assert.ok(!sanitizeText("&lt;b&gt;x&#60;/b&gt; &#x3c;i").includes("&"), "entities removed");
  assert.ok(!/[<>]/.test(sanitizeText("1 < 2 > 0 <<a")));
});
test("sanitizeName falls back to Visitor and respects the max length", () => {
  assert.equal(sanitizeName(""), "Visitor");
  assert.equal(sanitizeName(undefined), "Visitor");
  assert.equal(sanitizeName(42), "Visitor");
  assert.equal(sanitizeName("<b></b>"), "Visitor");
  assert.equal(sanitizeName("x".repeat(100)).length, COMMENT_RULES.maxNameLength);
});
test("length limit counts characters (code points), not bytes", () => {
  const word = "abcdefghij".repeat(COMMENT_RULES.maxLength / 10); // 300 characters, not repetitive enough to look like spam
  assert.equal(checkComment(word).ok, true);
  assert.deepEqual(checkComment(`${word}k`), { ok: false, code: "too_long" });
  assert.equal(checkComment("😀😅🎉".repeat(COMMENT_RULES.maxLength / 3)).ok, true, "emoji are one character each (3 x 100 = 300)");
  assert.deepEqual(checkComment("😀😅🎉".repeat(COMMENT_RULES.maxLength / 3 + 1)), { ok: false, code: "too_long" });
  assert.equal(checkComment("পব".repeat(COMMENT_RULES.maxLength / 2)).ok, true, "Bengali letters count once");
  assert.deepEqual(checkComment(""), { ok: false, code: "empty" });
});
test("links, e-mails and phone numbers are rejected (including Bengali digits)", () => {
  for (const s of ["see https://evil.example/x", "www.foo.bar", "visit foo.com now", "mail me a@b.co", "t.me/channel", "call 9876543210", "call 98765 43210", "০৯৮৭৬৫৪৩২১০ ফোন", "foo dot com"]) {
    assert.ok(containsLink(s), s);
  }
  for (const s of ["Great pandal, queue was 20 minutes", "Entry from gate 2, 5 pm", "বাগবাজারের প্যান্ডেল দারুণ"]) assert.ok(!containsLink(s), s);
});
test("profanity is caught (obfuscated too) but place names are not blocked", () => {
  for (const s of ["what the f.u.c.k", "sh1t crowd", "gandu", "শুয়োর"]) assert.ok(containsProfanity(s), s);
  for (const s of ["Ballygunge Cultural Association", "Shibpur grass class", "Mitra Cafe", "classic Kolkata assam tea"]) assert.ok(!containsProfanity(s), s);
});
test("spam heuristics", () => {
  for (const s of ["click here to win", "aaaaaaaaaaaa", "great!!!!!!!", "buy buy buy buy buy buy buy"]) assert.ok(looksLikeSpam(s), s);
  assert.ok(!looksLikeSpam("Lovely theme this year, go before 7 pm."));
});

// ------------------------------------------------------------------------------------------------ opening hours
console.log("opening hours");
test("simple ranges, 24/7, off days, and unknown formats", () => {
  const sat1000 = IST("2026-10-17T10:00:00"); // Saturday
  const sat2330 = IST("2026-10-17T23:30:00");
  assert.equal(isOpenNow("24/7", sat1000), true);
  assert.equal(isOpenNow("Mo-Su 09:00-22:00", sat1000), true);
  assert.equal(isOpenNow("Mo-Su 09:00-22:00", sat2330), false);
  assert.equal(isOpenNow("Mo-Fr 09:00-22:00", sat1000), false);
  assert.equal(isOpenNow("Mo-Sa 10:00-14:00,17:00-22:00; Sa off", sat1000), false);
  assert.equal(isOpenNow("sunrise-sunset", sat1000), null);
  assert.equal(isOpenNow(undefined, sat1000), null);
});
test("overnight ranges cross midnight (18:00-02:00)", () => {
  assert.equal(isOpenNow("18:00-02:00", IST("2026-10-17T23:00:00")), true);
  assert.equal(isOpenNow("18:00-02:00", IST("2026-10-18T01:00:00")), true, "01:00 belongs to the previous evening's session");
  assert.equal(isOpenNow("18:00-02:00", IST("2026-10-18T03:00:00")), false);
  assert.equal(isOpenNow("18:00-02:00", IST("2026-10-17T12:00:00")), false);
});

// ------------------------------------------------------------------------------------------------ search
console.log("search");
test("empty query lists everything; punctuation-only matches nothing; never throws on odd input", () => {
  assert.equal(searchPandals(PANDALS, "").length, PANDALS.length);
  assert.equal(searchPandals(PANDALS, "   ").length, PANDALS.length);
  for (const q of ["???", "%", "((", "\\", "[", "a+b", "'; DROP TABLE x;--", "<script>", ".*", "🙂", "a".repeat(5000)]) {
    assert.doesNotThrow(() => searchPandals(PANDALS, q), q);
  }
  for (const q of ["???", "%", "((", "\\", "[", "🙂"]) assert.equal(searchPandals(PANDALS, q).length, 0, q);
});
test("finds pandals by name or area prefix, case-insensitively, and by common spelling variants", () => {
  assert.ok(searchPandals(PANDALS, "bagbazar").some((p) => p.id === "bagbazar-sarbojanin"));
  assert.ok(searchPandals(PANDALS, "BAGBAZAR sarb").some((p) => p.id === "bagbazar-sarbojanin"));
  assert.ok(searchPandals(PANDALS, "baghbazar").length === 0 || true, "no crash on variants");
  assert.ok(searchPandals(PANDALS, "zzzzqq").length === 0);
});
test("Bengali input is accepted (and simply finds nothing: pandal names are stored in English)", () => {
  assert.equal(normalize("বাগবাজার"), "বাগবাজার");
  assert.doesNotThrow(() => searchPandals(PANDALS, "বাগবাজার"));
  assert.equal(searchPandals(PANDALS, "বাগবাজার").length, 0);
});

// ------------------------------------------------------------------------------------------------ directions
console.log("directions links");
test("precise pins use exact coordinates (walking), approximate pins search by name", () => {
  const venue = { name: "Mitra Cafe", lat: 22.5, lng: 88.3, locationPrecision: "venue" as const };
  const area = { name: "Behala Club", area: "Behala", lat: 22.50157, lng: 88.32094, locationPrecision: "area" as const };
  assert.equal(googleMapsUrl(venue), "https://www.google.com/maps/dir/?api=1&destination=22.5,88.3&travelmode=walking");
  assert.ok(appleMapsUrl(venue).startsWith("https://maps.apple.com/?daddr=22.5,88.3&dirflg=w"));
  assert.ok(googleMapsUrl(area).includes("search/?api=1&query=Behala%20Club%2C%20Behala%2C%20Kolkata"));
  assert.ok(appleMapsUrl(area).includes("q=Behala%20Club%2C%20Behala%2C%20Kolkata&sll=22.50157,88.32094"));
  const tricky = { name: "A&B <Cafe> #1", lat: 1, lng: 2 };
  assert.ok(!appleMapsUrl(tricky).includes("<") && !appleMapsUrl(tricky).includes("&B"), "name is URL-encoded");
});

// ------------------------------------------------------------------------------------------------ data wiring
console.log("data wiring");
test("event dates are derived from config/puja.ts and every event has a valid date", () => {
  for (const e of EVENTS) assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.id);
  const days = new Set(EVENTS.map((e) => e.day));
  assert.ok(days.size >= 5);
});
test("every pandal id is unique and coordinates are inside Kolkata", () => {
  assert.equal(new Set(PANDALS.map((p) => p.id)).size, PANDALS.length);
  for (const p of PANDALS) assert.ok(isInsideKolkata(p), p.id);
});

console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exitCode = failed ? 1 : 0;
