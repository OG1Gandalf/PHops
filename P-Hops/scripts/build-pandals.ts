/**
 * Builds data/pandals.json from data/pandals.seed.json.
 *
 *   npm run data:pandals
 *
 * What it does
 *  1. Expands the per-tier crowd pattern (seed.crowdPatterns) into crowdByTimeSlot.
 *  2. Geocodes each pandal through OpenStreetMap Nominatim (1 request/second, cached in
 *     data/.geocode-cache.json):
 *       - `venueQuery` (a park / club / street that OSM knows)  -> locationPrecision "venue"
 *       - otherwise `areaQuery` (the neighbourhood centroid)     -> locationPrecision "area"
 *       - otherwise the zone centroid                            -> locationPrecision "zone"
 *     Pandals are temporary committee setups, so many only resolve to the neighbourhood.
 *     The UI shows an "approximate location" note for non-venue pins and the Directions
 *     button searches by name for them. Fix a pin by adding `lat`/`lng` to the seed record.
 *  3. Writes data/pandals.json (verified:false on every record).
 *
 * Geocoding (c) OpenStreetMap contributors, ODbL.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, ".geocode-cache.json");
const VIEWBOX = "88.18,22.80,88.52,22.35"; // left,top,right,bottom
const UA = "kolkata-pujo-guide/0.1 (data build script; contact via repo)";

type Level = "low" | "medium" | "high";
type Slots = Record<"morning" | "afternoon" | "evening" | "night", Level>;

interface Seed {
  id: string;
  name: string;
  area: string;
  zone: string;
  tier: string;
  tags: string[];
  theme?: string;
  description?: string;
  openingHours?: string;
  venueQuery?: string;
  areaQuery?: string;
  lat?: number;
  lng?: number;
  /** Override for manual coordinates: "venue" (default) or "area". */
  precision?: "venue" | "area";
}

const ZONE_CENTROIDS: Record<string, [number, number]> = {
  north: [22.6, 88.3665],
  central: [22.5735, 88.365],
  south: [22.5165, 88.3585],
  saltlake: [22.5867, 88.4135],
  howrah: [22.585, 88.3],
  behala: [22.4985, 88.32],
  east: [22.603, 88.405],
};

type Cache = Record<string, { lat: number; lng: number; display: string } | null>;
let cache: Cache = {};
let lastCall = 0;

async function geocode(q: string): Promise<{ lat: number; lng: number; display: string } | null> {
  if (q in cache) return cache[q];
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "1",
    viewbox: VIEWBOX,
    bounded: "1",
  })}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const hit = rows[0];
    cache[q] = hit
      ? { lat: Math.round(+hit.lat * 1e5) / 1e5, lng: Math.round(+hit.lon * 1e5) / 1e5, display: hit.display_name.slice(0, 90) }
      : null;
  } catch (err) {
    console.warn(`  geocode failed for "${q}": ${(err as Error).message} (not cached)`);
    return null;
  }
  return cache[q];
}

const withCity = (q: string) => (/kolkata|howrah|salt lake|new town/i.test(q) ? q : `${q}, Kolkata`);

async function main() {
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    cache = {};
  }
  const seed = JSON.parse(await readFile(path.join(DATA_DIR, "pandals.seed.json"), "utf8")) as {
    crowdPatterns: Record<string, Slots>;
    pandals: Seed[];
  };

  const out: unknown[] = [];
  const stats = { venue: 0, area: 0, zone: 0 };
  for (const s of seed.pandals) {
    let lat = s.lat;
    let lng = s.lng;
    let precision: "venue" | "area" | "zone" = "venue";
    let how = "manual coordinates in seed (checked against OSM place/street search)";

    if (lat != null && lng != null) {
      precision = s.precision ?? "venue";
    } else {
      let hit = s.venueQuery ? await geocode(withCity(s.venueQuery)) : null;
      if (hit) {
        how = `OSM Nominatim venue match "${s.venueQuery}" -> ${hit.display}`;
      } else {
        precision = "area";
        hit = await geocode(withCity(s.areaQuery ?? s.area));
        how = hit ? `OSM Nominatim neighbourhood centroid "${s.areaQuery ?? s.area}"` : "";
      }
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
      } else {
        precision = "zone";
        [lat, lng] = ZONE_CENTROIDS[s.zone];
        how = `zone centroid (${s.zone}) - geocoding failed, please fix`;
      }
    }
    stats[precision]++;
    const pattern = seed.crowdPatterns[s.tier];
    out.push({
      id: s.id,
      name: s.name,
      area: s.area,
      zone: s.zone,
      lat,
      lng,
      locationPrecision: precision,
      ...(s.theme ? { theme: s.theme } : {}),
      ...(s.description ? { description: s.description } : {}),
      ...(s.openingHours ? { openingHours: s.openingHours } : {}),
      crowdByTimeSlot: pattern,
      tags: s.tags,
      verified: false,
      source: `Name/zone compiled from public 2026 pandal listings (pandalhoppings.com, pujomap.com, thepujo.com, durgapujaguide.in, culturetoday.in); location: ${how}; crowdByTimeSlot: editorial estimate for tier "${s.tier}" (typical peak times, not measured data)`,
    });
    console.log(`${precision.padEnd(5)} ${s.name}  ${lat},${lng}`);
  }
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 1) + "\n");
  await writeFile(path.join(DATA_DIR, "pandals.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`\nWrote ${out.length} pandals`, stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
