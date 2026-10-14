/**
 * Data integrity check for everything in /data. Run it before every deploy:
 *
 *   npm run data:validate            # prints problems, exits 1 if any ERROR was found
 *   npm run data:validate -- --report  # also (re)writes reports/unverified-records.csv
 *
 * What it checks
 *   - every record against a zod schema that is tied to the TypeScript types in lib/types.ts
 *   - duplicate ids, duplicate names, near-duplicate places, clusters of identical coordinates
 *   - coordinates inside the Kolkata bounding box (config/puja.ts) and not inside the Hooghly river
 *     (OSM water polygon in scripts/geo/hooghly-water.json; it covers the river north of 22.5465 only)
 *   - event -> pandal links, event times
 *   - `verified` / `source` presence, and the list of unverified records
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { MAP_CONFIG, ZONES } from "../config/puja";
import { haversineKm } from "../lib/geo";
import type { Eatery, Parking, Pandal, PujaEventRecord, Restroom } from "../lib/types";

const ROOT = process.cwd();
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) as T;

// ---------------------------------------------------------------- schemas (kept assignable to lib/types.ts)
const [[S, W], [N, E]] = MAP_CONFIG.maxBounds;
const lat = z.number().min(S).max(N);
const lng = z.number().min(W).max(E);
const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id must be a lowercase slug");
const level = z.enum(["low", "medium", "high"]);
const provenance = { verified: z.boolean(), source: text };

const PandalSchema: z.ZodType<Pandal> = z.strictObject({
  id,
  name: text,
  area: text,
  zone: z.enum(ZONES as [string, ...string[]]) as z.ZodType<Pandal["zone"]>,
  lat,
  lng,
  theme: z.string().optional(),
  description: text.optional(),
  openingHours: z.string().optional(),
  locationPrecision: z.enum(["venue", "area", "zone"]),
  crowdByTimeSlot: z.strictObject({ morning: level, afternoon: level, evening: level, night: level }),
  tags: z.array(text),
  ...provenance,
});

const RestroomSchema: z.ZodType<Restroom> = z.strictObject({
  id,
  name: text,
  lat,
  lng,
  type: z.enum(["public", "paid", "venue"]),
  accessible: z.boolean(),
  notes: z.string().optional(),
  ...provenance,
});

const ParkingSchema: z.ZodType<Parking> = z.strictObject({
  id,
  name: text,
  lat,
  lng,
  capacity: z.number().int().positive().optional(),
  fee: z.string().optional(),
  openHours: z.string().optional(),
  notes: z.string().optional(),
  ...provenance,
});

const EaterySchema: z.ZodType<Eatery> = z.strictObject({
  id,
  name: text,
  lat,
  lng,
  cuisineType: z.enum(["street_food", "bengali", "sweets", "cafe", "biryani", "other"]),
  priceRange: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  isVeg: z.boolean(),
  openHours: z.string().optional(),
  famousFor: z.string().optional(),
  ...provenance,
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm (24h)");
const EventSchema: z.ZodType<PujaEventRecord> = z.strictObject({
  id,
  title: text,
  description: text,
  day: z.enum(["shashthi", "saptami", "ashtami", "navami", "dashami", "bhasan"]),
  startTime: hhmm,
  endTime: hhmm,
  locationName: text,
  lat,
  lng,
  pandalId: id.optional(),
  area: text,
  confirmed: z.boolean(),
  ...provenance,
});

const AreaSchema = z.strictObject({ id, name: text, lat, lng });

// ---------------------------------------------------------------- reporting
type Severity = "ERROR" | "WARN";
interface Finding {
  severity: Severity;
  file: string;
  id: string;
  message: string;
}
const findings: Finding[] = [];
const add = (severity: Severity, file: string, rid: string, message: string) => findings.push({ severity, file, id: rid, message });

// ---------------------------------------------------------------- geometry helpers
interface WaterFile {
  outer: [number, number][][];
  inner: [number, number][][];
}
const water = read<WaterFile>("scripts/geo/hooghly-water.json");
const WATER_MIN_LAT = 22.5465;

/** Even-odd ray casting over every ring edge. The OSM multipolygon is stored as closed pieces, so edges alone are enough. */
function inWater(p: { lat: number; lng: number }): boolean {
  let inside = false;
  for (const ring of [...water.outer, ...water.inner]) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i];
      const [yj, xj] = ring[j];
      if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Distance in metres from a point to the nearest edge of the river polygon (flat-earth approximation, fine at city scale). */
function metresToBank(p: { lat: number; lng: number }): number {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110_540;
  let best = Infinity;
  for (const ring of [...water.outer, ...water.inner]) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][1] - p.lng) * kx;
      const ay = (ring[j][0] - p.lat) * ky;
      const bx = (ring[i][1] - p.lng) * kx;
      const by = (ring[i][0] - p.lat) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}
/** Ghats, jetties and riverside pandals sit on the waterline; the OSM outline is only accurate to a few tens of metres. */
const BANK_TOLERANCE_M = 50;

// Self-test so a bad polygon can never silently pass everything.
const KNOWN_WATER = [
  { name: "Hooghly under Howrah Bridge", lat: 22.5851, lng: 88.3468 },
  { name: "Hooghly mid-stream near Babughat", lat: 22.5646, lng: 88.334 },
  { name: "Hooghly near Dakshineswar", lat: 22.65, lng: 88.3545 },
];
const KNOWN_LAND = [
  { name: "Esplanade", lat: 22.5646, lng: 88.3503 },
  { name: "College Street", lat: 22.5744, lng: 88.3629 },
  { name: "Salt Lake Sector V", lat: 22.5726, lng: 88.4326 },
];
for (const w of KNOWN_WATER) if (!inWater(w)) throw new Error(`water polygon self-test failed: ${w.name} should be water`);
for (const l of KNOWN_LAND) if (inWater(l)) throw new Error(`water polygon self-test failed: ${l.name} should be land`);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, " ").trim();
const key5 = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

// ---------------------------------------------------------------- per-collection checks
interface Rec {
  id: string;
  name: string;
  lat: number;
  lng: number;
  verified?: boolean;
  source?: string;
}

function checkCollection<T extends Rec>(
  file: string,
  rows: unknown[],
  schema: z.ZodType<T>,
  opts: { clusterWarnAt?: number; dupMeters?: number; checkWater?: boolean; nameField?: "name" | "title" } = {},
): T[] {
  const ok: T[] = [];
  rows.forEach((row, i) => {
    const rid = (row as { id?: string })?.id ?? `#${i}`;
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) add("ERROR", file, rid, `${issue.path.join(".") || "(record)"}: ${issue.message}`);
      return;
    }
    ok.push(parsed.data);
  });

  // duplicate ids
  const seen = new Map<string, number>();
  for (const r of ok) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
  for (const [rid, n] of seen) if (n > 1) add("ERROR", file, rid, `duplicate id (${n} records)`);

  // river / sea
  if (opts.checkWater !== false) {
    const uncovered: T[] = [];
    for (const r of ok) {
      if (inWater(r)) {
        const m = Math.round(metresToBank(r));
        if (m > BANK_TOLERANCE_M) add("ERROR", file, r.id, `"${r.name}" (${r.lat}, ${r.lng}) is ${m} m inside the Hooghly river`);
        else add("WARN", file, r.id, `"${r.name}" (${r.lat}, ${r.lng}) is on the waterline (${m} m inside the OSM outline); fine for a ghat, check anything else`);
      } else if (r.lat < WATER_MIN_LAT && r.lng < 88.31) {
        uncovered.push(r);
      }
    }
    if (uncovered.length) {
      add("WARN", file, "(summary)", `${uncovered.length} record(s) lie south-west of the covered river polygon, so the river check cannot clear them: ${uncovered.map((u) => u.id).join(", ")}`);
    }
  }

  // identical coordinates
  const byCoord = new Map<string, T[]>();
  for (const r of ok) byCoord.set(key5(r), [...(byCoord.get(key5(r)) ?? []), r]);
  for (const [k, list] of byCoord) {
    if (list.length >= (opts.clusterWarnAt ?? 2)) {
      add("WARN", file, list.map((x) => x.id).join(" | "), `${list.length} records share the exact coordinate ${k}: ${list.map((x) => x.name).join("; ")}`);
    }
  }

  // same name + very close, or the same normalised name appearing twice anywhere
  const limit = (opts.dupMeters ?? 40) / 1000;
  for (let a = 0; a < ok.length; a++) {
    for (let b = a + 1; b < ok.length; b++) {
      if (norm(ok[a].name) !== norm(ok[b].name)) continue;
      const km = haversineKm(ok[a], ok[b]);
      if (km <= limit) add("ERROR", file, `${ok[a].id} | ${ok[b].id}`, `same name "${ok[a].name}" only ${Math.round(km * 1000)} m apart (duplicate)`);
    }
  }

  // (`verified` and `source` are required by every schema above, so a missing one is reported as a schema error)
  return ok;
}

// ---------------------------------------------------------------- run
const pandals = checkCollection("data/pandals.json", read<unknown[]>("data/pandals.json"), PandalSchema, { clusterWarnAt: 3, dupMeters: 150 });
const restrooms = checkCollection("data/restrooms.json", read<unknown[]>("data/restrooms.json"), RestroomSchema, { dupMeters: 15 });
const parking = checkCollection("data/parking.json", read<unknown[]>("data/parking.json"), ParkingSchema, { dupMeters: 30 });
const eateries = checkCollection("data/eateries.json", read<unknown[]>("data/eateries.json"), EaterySchema, { dupMeters: 40 });
const eventRows = read<unknown[]>("data/events.json");
// events have `title`, the generic checks look at `name`
const events = checkCollection<PujaEventRecord & { name: string }>(
  "data/events.json",
  eventRows,
  EventSchema.transform((e) => ({ ...e, name: e.title })) as unknown as z.ZodType<PujaEventRecord & { name: string }>,
  { clusterWarnAt: 99, dupMeters: 0 },
);
const areas = checkCollection("data/areas.json", read<unknown[]>("data/areas.json"), AreaSchema as unknown as z.ZodType<Rec>, { clusterWarnAt: 2 });

// pandals: distinct normalised names (a repeated name is almost always a data-entry duplicate)
{
  const names = new Map<string, string[]>();
  for (const p of pandals) names.set(norm(p.name), [...(names.get(norm(p.name)) ?? []), p.id]);
  for (const [n, ids] of names) if (ids.length > 1) add("ERROR", "data/pandals.json", ids.join(" | "), `duplicate pandal name "${n}"`);
}

// pandal precision honesty: how many pins are neighbourhood centroids
const approx = pandals.filter((p) => p.locationPrecision !== "venue");
if (approx.length) {
  add("WARN", "data/pandals.json", "(summary)", `${approx.length}/${pandals.length} pandals have an approximate (area/zone) pin, not a venue pin; directions search by name for these`);
}

// events: links, timing
const pandalIds = new Set(pandals.map((p) => p.id));
for (const e of events) {
  if (e.pandalId && !pandalIds.has(e.pandalId)) add("ERROR", "data/events.json", e.id, `pandalId "${e.pandalId}" does not exist in pandals.json`);
  if (e.pandalId) {
    const p = pandals.find((x) => x.id === e.pandalId);
    if (p && haversineKm(p, e) > 1.5) add("WARN", "data/events.json", e.id, `event is ${haversineKm(p, e).toFixed(1)} km from its linked pandal "${p.name}"`);
  }
  if (e.startTime === e.endTime) add("ERROR", "data/events.json", e.id, "startTime equals endTime");
  else if (e.endTime < e.startTime) add("WARN", "data/events.json", e.id, `endTime ${e.endTime} is before startTime ${e.startTime} (treated as running past midnight)`);
  if (!e.confirmed) add("WARN", "data/events.json", e.id, "event time/venue is not confirmed");
}
void areas;

// ---------------------------------------------------------------- unverified list
const all: { file: string; list: Rec[] }[] = [
  { file: "pandals", list: pandals },
  { file: "restrooms", list: restrooms },
  { file: "parking", list: parking },
  { file: "eateries", list: eateries },
  { file: "events", list: events.map((e) => ({ id: e.id, name: e.title, lat: e.lat, lng: e.lng, verified: e.verified, source: e.source })) },
];
const unverified = all.flatMap(({ file, list }) => list.filter((r) => !r.verified).map((r) => ({ file, ...r })));

if (process.argv.includes("--report")) {
  mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = ["file,id,name,lat,lng,source", ...unverified.map((r) => [r.file, r.id, r.name, r.lat, r.lng, r.source].map(csv).join(","))];
  writeFileSync(path.join(ROOT, "reports/unverified-records.csv"), `${lines.join("\n")}\n`);
  console.log(`wrote reports/unverified-records.csv (${unverified.length} rows)`);
}

// ---------------------------------------------------------------- output
const errors = findings.filter((f) => f.severity === "ERROR");
const warns = findings.filter((f) => f.severity === "WARN");
for (const f of [...errors, ...warns]) console.log(`${f.severity.padEnd(5)} ${f.file} [${f.id}] ${f.message}`);

console.log("\nRecords checked");
for (const { file, list } of all) {
  const un = list.filter((r) => !r.verified).length;
  console.log(`  ${file.padEnd(10)} ${String(list.length).padStart(4)}   verified ${list.length - un}   unverified ${un}`);
}
console.log(`\n${errors.length} error(s), ${warns.length} warning(s), ${unverified.length} unverified record(s)`);
process.exitCode = errors.length ? 1 : 0;
