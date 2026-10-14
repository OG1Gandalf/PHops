import { MAP_CONFIG, WALKING } from "@/config/puja";
import type { LatLng } from "@/lib/types";

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in kilometres (Haversine formula). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Approximate walking distance (km): straight line inflated for street layout. */
export function walkingKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * WALKING.detourFactor;
}

export function walkingMinutes(km: number): number {
  return Math.max(1, Math.round((km / WALKING.speedKmh) * 60));
}

export interface Nearby<T> {
  item: T;
  /** approximate walking distance in km */
  km: number;
  minutes: number;
}

/** Returns the `limit` closest items to `origin`, ordered nearest first. */
export function nearest<T extends LatLng>(origin: LatLng, items: readonly T[], limit = 1): Nearby<T>[] {
  const scored: Nearby<T>[] = [];
  for (const item of items) {
    const km = walkingKm(origin, item);
    scored.push({ item, km, minutes: walkingMinutes(km) });
  }
  scored.sort((a, b) => a.km - b.km);
  return scored.slice(0, limit);
}

/** "350 m" / "1.2 km" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** Inside the area the map is restricted to (config/puja.ts MAP_CONFIG.maxBounds). */
export function isInsideKolkata(p: LatLng): boolean {
  const [[south, west], [north, east]] = MAP_CONFIG.maxBounds;
  return p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east;
}
