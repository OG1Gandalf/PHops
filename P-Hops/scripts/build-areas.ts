/**
 * Builds data/areas.json - the landmark hubs used by the manual "pick your area" fallback on
 * the Near me page when geolocation is denied/unavailable. Geocoded via OSM Nominatim.
 *   npm run data:areas
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const HUBS: [id: string, name: string, query: string][] = [
  ["esplanade", "Esplanade / Dharmatala", "Esplanade, Kolkata"],
  ["park-street", "Park Street", "Park Street, Kolkata"],
  ["college-street", "College Street", "College Square, Kolkata"],
  ["sealdah", "Sealdah", "Sealdah railway station, Kolkata"],
  ["howrah-station", "Howrah Station", "Howrah Junction railway station"],
  ["shyambazar", "Shyambazar", "Shyambazar, Kolkata"],
  ["hatibagan", "Hatibagan", "Hatibagan, Kolkata"],
  ["bagbazar", "Bagbazar", "Bagbazar Street, Kolkata"],
  ["sovabazar", "Sovabazar", "Sovabazar, Kolkata"],
  ["ultadanga", "Ultadanga", "Ultadanga, Kolkata"],
  ["park-circus", "Park Circus", "Park Circus, Kolkata"],
  ["gariahat", "Gariahat", "Gariahat, Kolkata"],
  ["ballygunge", "Ballygunge", "Ballygunge, Kolkata"],
  ["rashbehari", "Rashbehari / Deshapriya Park", "Deshapriya Park, Kolkata"],
  ["kalighat", "Kalighat", "Kalighat, Kolkata"],
  ["bhowanipore", "Bhowanipore", "Bhowanipore, Kolkata"],
  ["alipore", "Alipore", "Alipore, Kolkata"],
  ["jadavpur", "Jadavpur", "Jadavpur, Kolkata"],
  ["dhakuria", "Dhakuria", "Dhakuria, Kolkata"],
  ["lake-gardens", "Lake Gardens", "Lake Gardens, Kolkata"],
  ["kasba", "Kasba", "Kasba, Kolkata"],
  ["garia", "Garia", "Garia, Kolkata"],
  ["tollygunge", "Tollygunge", "Tollygunge, Kolkata"],
  ["behala", "Behala", "Behala, Kolkata"],
  ["barisha", "Barisha", "Barisha Baro Bari Rd, Thakurpukur, Kolkata"],
  ["kidderpore", "Kidderpore", "Kidderpore, Kolkata"],
  ["salt-lake-sector-v", "Salt Lake Sector V", "Salt Lake Sector V, Kolkata"],
  ["salt-lake-city-centre", "Salt Lake City Centre", "City Centre Salt Lake, Kolkata"],
  ["new-town", "New Town", "New Town Action Area I, Kolkata"],
  ["lake-town", "Lake Town", "Lake Town, Kolkata"],
  ["dum-dum", "Dum Dum", "Dum Dum, Kolkata"],
  ["shibpur", "Shibpur (Howrah)", "Shibpur, Howrah"],
  ["salkia", "Salkia (Howrah)", "Salkia, Howrah"],
  ["santragachi", "Santragachi (Howrah)", "Santragachi, Howrah"],
];

async function main() {
  const out = [];
  for (const [id, name, q] of HUBS) {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      q,
      format: "jsonv2",
      limit: "1",
      viewbox: "88.18,22.80,88.52,22.35",
      bounded: "1",
    })}`;
    const res = await fetch(url, { headers: { "User-Agent": "kolkata-pujo-guide/0.1 (data build script)" } });
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (!hit) {
      console.warn(`no result: ${name}`);
    } else {
      out.push({ id, name, lat: Math.round(+hit.lat * 1e5) / 1e5, lng: Math.round(+hit.lon * 1e5) / 1e5 });
      console.log(`${name.padEnd(26)} ${hit.lat}, ${hit.lon}`);
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
  await writeFile(path.resolve(process.cwd(), "data/areas.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote ${out.length} areas`);
}
main();
