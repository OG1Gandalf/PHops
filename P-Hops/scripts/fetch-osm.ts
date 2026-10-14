/**
 * Fetches restrooms, parking and eateries inside the Kolkata bounding box from the
 * OpenStreetMap Overpass API and writes cleaned JSON into /data.
 *
 *   npm run data:osm                 # fetch all three
 *   npm run data:osm -- toilets      # only one of: toilets | parking | eateries
 *
 * Output: data/restrooms.json, data/parking.json, data/eateries.json
 * Hand-curated Puja-time food spots live in data/curated-eateries.json and are
 * merged into eateries.json (matched against OSM by name+distance to snap coordinates).
 *
 * Data (c) OpenStreetMap contributors, ODbL. Keep the attribution in the app footer.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CuisineType,
  Eatery,
  Parking,
  PriceRange,
  Restroom,
} from "../lib/types";

// south, west, north, east  (Overpass order) - same box as MAP_CONFIG.maxBounds
const BBOX = "22.35,88.18,22.80,88.52";
const DATA_DIR = path.resolve(process.cwd(), "data");
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const SOURCE = "OpenStreetMap (Overpass API)";

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function overpass(query: string): Promise<OsmElement[]> {
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`  -> ${new URL(url).host} (attempt ${attempt})`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "kolkata-pujo-guide/0.1 (data build script)",
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { elements: OsmElement[] };
        return json.elements;
      } catch (err) {
        lastErr = err;
        console.warn(`     failed: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  throw new Error(`All Overpass endpoints failed: ${String(lastErr)}`);
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;
const prefix = (e: OsmElement) => (e.type === "node" ? "n" : e.type === "way" ? "w" : "r");
const pos = (e: OsmElement) => ({
  lat: e.lat ?? e.center?.lat,
  lng: e.lon ?? e.center?.lon,
});
const inBox = (lat: number, lng: number) =>
  lat >= 22.35 && lat <= 22.8 && lng >= 88.18 && lng <= 88.52;
/** Strip control chars / angle brackets so data can never carry markup. */
const clean = (s: string | undefined) =>
  s?.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 120) || undefined;

// ---------------------------------------------------------------- restrooms
function toRestroom(e: OsmElement): Restroom | null {
  const t = e.tags ?? {};
  const { lat, lng } = pos(e);
  if (lat == null || lng == null || !inBox(lat, lng)) return null;
  if (t.access === "private") return null;
  const type: Restroom["type"] =
    t.fee === "yes"
      ? "paid"
      : t.access === "customers" || t.access === "permissive"
        ? "venue"
        : "public";
  const notes = [
    t.operator && `Operator: ${clean(t.operator)}`,
    t.opening_hours && `Hours: ${clean(t.opening_hours)}`,
    t.male === "yes" && t.female !== "yes" ? "Men only" : undefined,
    t.female === "yes" && t.male !== "yes" ? "Women only" : undefined,
  ]
    .filter(Boolean)
    .join("; ");
  return {
    id: `osm-${prefix(e)}${e.id}`,
    name: clean(t.name ?? t["name:en"]) ?? "Public toilet",
    lat: round(lat),
    lng: round(lng),
    type,
    accessible: t.wheelchair === "yes" || t.wheelchair === "designated",
    ...(notes ? { notes } : {}),
    verified: false,
    source: SOURCE,
  };
}

// ------------------------------------------------------------------ parking
function toParking(e: OsmElement): Parking | null {
  const t = e.tags ?? {};
  const { lat, lng } = pos(e);
  if (lat == null || lng == null || !inBox(lat, lng)) return null;
  // Skip private / permit-only / staff-only / delivery parking: useless to visitors.
  if (["private", "no", "permit", "delivery", "customers", "residents", "employees"].includes(t.access ?? "")) return null;
  if (t.parking === "garage_boxes" || t.parking === "carports") return null;
  const capacity = t.capacity ? Number.parseInt(t.capacity, 10) : undefined;
  const name = clean(t.name ?? t["name:en"]);
  const kind =
    t.parking === "multi-storey"
      ? "Multi-storey"
      : t.parking === "underground"
        ? "Underground"
        : t.parking === "street_side" || t.parking === "lane"
          ? "On-street"
          : t.parking === "surface"
            ? "Surface lot"
            : undefined;
  const notes = [kind, t.operator && `Operator: ${clean(t.operator)}`]
    .filter(Boolean)
    .join("; ");
  return {
    id: `osm-${prefix(e)}${e.id}`,
    name: name ?? "Parking",
    lat: round(lat),
    lng: round(lng),
    ...(Number.isFinite(capacity) ? { capacity } : {}),
    ...(t.fee ? { fee: t.fee === "yes" ? (clean(t.charge) ?? "Paid") : t.fee === "no" ? "Free" : clean(t.fee) } : {}),
    ...(t.opening_hours ? { openHours: clean(t.opening_hours) } : {}),
    ...(notes ? { notes } : {}),
    verified: false,
    source: SOURCE,
  };
}

// ----------------------------------------------------------------- eateries
const STREET_RE = /\b(roll|kathi|phuchka|puchka|fuchka|chaat|chat|momo|cabin|ghugni|jhal ?muri|tea|chai|stall|dhaba)\b/i;
const SWEET_RE = /\b(sweet|mishti|misthi|mithai|sandesh|rosogolla|roshogolla|confection|mistanna|bhandar)\b/i;
const BENGALI_RE = /\b(bengali|bangla|bhojohori|bhojo|kasundi|ilish|hilsa|annapurna|aaheli|oh! ?calcutta|sonar|ranna)\b/i;
const BIRYANI_RE = /\b(biryani|biriyani|dum|kebab|kabab|mughlai|awadhi)\b/i;

function cuisineOf(e: OsmElement): CuisineType {
  const t = e.tags ?? {};
  const name = `${t.name ?? ""} ${t["name:en"] ?? ""}`;
  const cuisine = (t.cuisine ?? "").toLowerCase();
  if (t.shop === "confectionery" || t.shop === "pastry" || SWEET_RE.test(name) || /sweet|dessert/.test(cuisine)) return "sweets";
  if (/bengali|bangladeshi/.test(cuisine) || BENGALI_RE.test(name)) return "bengali";
  if (/biryani|mughlai|kebab/.test(cuisine) || BIRYANI_RE.test(name)) return "biryani";
  if (/street_food|snack|roll|chaat/.test(cuisine) || STREET_RE.test(name)) return "street_food";
  if (t.amenity === "cafe" || /coffee|tea|cafe/.test(cuisine)) return "cafe";
  if (t.amenity === "fast_food") return "street_food";
  return "other";
}

function priceOf(e: OsmElement): PriceRange {
  const t = e.tags ?? {};
  if (t["payment:cash"] === "only" && t.amenity === "fast_food") return 1;
  if (t.amenity === "fast_food" || t.amenity === "food_court") return 1;
  if (t.stars || t.internet_access === "wlan" && t.amenity === "restaurant") return 3;
  return 2; // restaurants & cafes: unknown, assume mid
}

function toEatery(e: OsmElement): Eatery | null {
  const t = e.tags ?? {};
  const { lat, lng } = pos(e);
  if (lat == null || lng == null || !inBox(lat, lng)) return null;
  const name = clean(t.name ?? t["name:en"]);
  if (!name) return null; // unnamed eateries are useless in a guide
  return {
    id: `osm-${prefix(e)}${e.id}`,
    name,
    lat: round(lat),
    lng: round(lng),
    cuisineType: cuisineOf(e),
    priceRange: priceOf(e),
    isVeg: t["diet:vegetarian"] === "only" || t["diet:vegan"] === "only",
    ...(t.opening_hours ? { openHours: clean(t.opening_hours) } : {}),
    verified: false,
    source: `${SOURCE}; priceRange estimated from amenity type`,
  };
}

// ------------------------------------------------------------------ curated
function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Placed = { id: string; name: string; lat: number; lng: number; source: string; verified: boolean };
type Curated<T extends Placed> = Omit<T, "verified">;

/**
 * Cross-check each curated spot against OSM. If an OSM element with a similar name exists
 * within 400m of the curated coordinates we snap to the OSM coordinates and note it in `source`.
 * Spots with no OSM match keep the hand-entered coordinates and stay \`verified: false\`.
 */
function mergeCurated<T extends Placed>(curated: Curated<T>[], osm: T[], label: string): { merged: T[]; report: string[] } {
  const report: string[] = [];
  const consumed = new Set<string>();
  const merged = curated.map((c) => {
    const key = norm(c.name);
    const match = osm
      .filter((o) => {
        const k = norm(o.name);
        return k.length >= 4 && (k.includes(key.slice(0, 8)) || key.includes(k.slice(0, 8))) && distM(c, o) <= 400;
      })
      .sort((a, b) => distM(c, a) - distM(c, b))[0];
    if (match) {
      consumed.add(match.id);
      report.push(`MATCH  ${c.name}  ~ OSM "${match.name}" (${Math.round(distM(c, match))} m)`);
      return {
        ...match,
        ...c,
        lat: match.lat,
        lng: match.lng,
        verified: false,
        source: `${c.source}; coordinates snapped to OSM ${match.id}`,
      } as unknown as T;
    }
    report.push(`NO OSM MATCH  ${c.name}  (kept curated coordinates - spot-check!)`);
    return { ...c, verified: false } as unknown as T;
  });
  console.log(`  ${label}: ${merged.length} curated, ${consumed.size} snapped to OSM`);
  return { merged: [...merged, ...osm.filter((o) => !consumed.has(o.id))], report };
}

/**
 * Clean-up for eateries:
 *  - drop entries whose "name" has no letters at all (phone numbers / ids mis-tagged as names in OSM)
 *  - drop near-duplicates (same name within 60 m, or within 400 m for long, specific names such as
 *    "6 Ballygunge Place" that OSM sometimes holds as two objects). The first entry wins, and curated
 *    entries come first in the merged list.
 *
 * `fixedRadius` (metres) replaces both radii above. Restrooms and parking use 25 m: OSM often maps one
 * toilet block as several "Public toilet" nodes a few metres apart, and one car park as several "Parking" ways.
 */
function tidy<T extends Placed>(list: T[], label: string, opts: { fixedRadius?: number } = {}): T[] {
  const key = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const kept: T[] = [];
  let noLetters = 0;
  let dupes = 0;
  for (const p of list) {
    if (!/\p{L}/u.test(p.name)) {
      noLetters++;
      continue;
    }
    const k = key(p.name);
    const radius = opts.fixedRadius ?? (k.length >= 10 ? 400 : 60);
    const twin = kept.find((q) => key(q.name) === k && distM(p, q) <= radius);
    if (twin) {
      dupes++;
      // keep the useful facts of the dropped twin (a block is accessible if any of its nodes is)
      const a = twin as unknown as { accessible?: boolean };
      if ((p as unknown as { accessible?: boolean }).accessible) a.accessible = true;
      continue;
    }
    kept.push(p);
  }
  console.log(`  ${label}: tidy dropped ${noLetters} without letters + ${dupes} near-duplicates -> ${kept.length}`);
  return kept;
}

async function readCurated<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
  } catch {
    console.warn(`  (no data/${file} found, skipping curated merge)`);
    return [];
  }
}

// --------------------------------------------------------------------- main
async function write(file: string, data: unknown) {
  await mkdir(DATA_DIR, { recursive: true });
  const p = path.join(DATA_DIR, file);
  await writeFile(p, JSON.stringify(data) + "\n");
  console.log(`  wrote ${path.relative(process.cwd(), p)}`);
}

async function main() {
  const only = process.argv[2];
  const want = (k: string) => (!only && k !== "tidy") || only === k;

  if (want("toilets")) {
    console.log("Restrooms (amenity=toilets)…");
    const els = await overpass(`[out:json][timeout:180];nwr["amenity"="toilets"](${BBOX});out center tags;`);
    const rows = els.map(toRestroom).filter((x): x is Restroom => !!x);
    console.log(`  ${els.length} raw -> ${rows.length} kept`);
    await write("restrooms.json", tidy(rows, "restrooms", { fixedRadius: 25 }));
  }

  if (want("parking")) {
    console.log("Parking (amenity=parking)…");
    const els = await overpass(`[out:json][timeout:180];nwr["amenity"="parking"](${BBOX});out center tags;`);
    const rows = els.map(toParking).filter((x): x is Parking => !!x);
    console.log(`  ${els.length} raw -> ${rows.length} kept`);
    const curatedP = await readCurated<Curated<Parking>>("curated-parking.json");
    const { merged, report } = mergeCurated<Parking>(curatedP, rows, "parking");
    console.log(report.map((l) => "  " + l).join("\n"));
    await write("parking.json", tidy(merged, "parking", { fixedRadius: 25 }));
  }

  if (want("eateries")) {
    console.log("Eateries (restaurant|cafe|fast_food|food_court + shop=confectionery)…");
    const els = await overpass(
      `[out:json][timeout:240];(nwr["amenity"~"^(restaurant|cafe|fast_food|food_court)$"](${BBOX});nwr["shop"="confectionery"](${BBOX}););out center tags;`,
    );
    const osm = els.map(toEatery).filter((x): x is Eatery => !!x);
    console.log(`  ${els.length} raw -> ${osm.length} kept (named only)`);
    const curated = await readCurated<Curated<Eatery>>("curated-eateries.json");
    const { merged, report } = mergeCurated<Eatery>(curated, osm, "eateries");
    console.log(report.map((l) => "  " + l).join("\n"));
    await write("eateries.json", tidy(merged, "eateries"));
  }

  if (only === "tidy") {
    // offline: re-apply the clean-up to the files already in /data (no Overpass calls)
    const existing = await readCurated<Eatery>("eateries.json");
    await write("eateries.json", tidy(existing as unknown as Placed[], "eateries"));
    const restrooms = await readCurated<Restroom>("restrooms.json");
    await write("restrooms.json", tidy(restrooms as unknown as Placed[], "restrooms", { fixedRadius: 25 }));
    const parking = await readCurated<Parking>("parking.json");
    await write("parking.json", tidy(parking as unknown as Placed[], "parking", { fixedRadius: 25 }));
  }
  console.log("Done. Spot-check data per README before launch.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
