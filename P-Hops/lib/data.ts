/**
 * Data access layer. Components never import /data/*.json directly.
 *
 * - Pandals + events are small and bundled (needed on first paint).
 * - Restrooms / parking / eateries are larger, so they are loaded on demand through dynamic
 *   import() and become separate JS chunks; weak networks only pay for them when a layer / page
 *   / detail panel actually needs them.
 */
import { PUJA_DATE_BY_DAY } from "@/config/puja";
import eventsJson from "@/data/events.json";
import pandalsJson from "@/data/pandals.json";
import type { Eatery, Parking, Pandal, PujaEvent, PujaEventRecord, Restroom } from "@/lib/types";

export const PANDALS = pandalsJson as unknown as Pandal[];
export const PANDAL_BY_ID: ReadonlyMap<string, Pandal> = new Map(PANDALS.map((p) => [p.id, p]));

export const EVENTS: PujaEvent[] = (eventsJson as unknown as PujaEventRecord[]).map((e) => ({
  ...e,
  date: PUJA_DATE_BY_DAY[e.day],
}));

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    promise ??= load().catch((err) => {
      promise = null; // allow retry after a network failure
      throw err;
    });
    return promise;
  };
}

export const loadRestrooms = once(
  async () => (await import("@/data/restrooms.json")).default as unknown as Restroom[],
);
export const loadParking = once(
  async () => (await import("@/data/parking.json")).default as unknown as Parking[],
);
export const loadEateries = once(
  async () => (await import("@/data/eateries.json")).default as unknown as Eatery[],
);
export const loadAreas = once(
  async () => (await import("@/data/areas.json")).default as unknown as AreaHub[],
);

export interface AreaHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
}
