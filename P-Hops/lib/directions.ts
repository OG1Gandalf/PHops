import type { LatLng } from "@/lib/types";

interface Target extends LatLng {
  name: string;
  area?: string;
  /** "venue" pins are precise; "area" pins are only a neighbourhood centroid. */
  locationPrecision?: "venue" | "area" | "zone";
}

function isApprox(t: Target) {
  return t.locationPrecision === "area" || t.locationPrecision === "zone";
}

const text = (t: Target) => [t.name, t.area, "Kolkata"].filter(Boolean).join(", ");

/**
 * Exact-coordinate directions for precise points. For pandals whose pin is only a neighbourhood
 * centroid we search by name instead, so Maps does not route people to the wrong lane.
 */
export function googleMapsUrl(t: Target): string {
  if (isApprox(t)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text(t))}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=walking`;
}

export function appleMapsUrl(t: Target): string {
  if (isApprox(t)) {
    return `https://maps.apple.com/?q=${encodeURIComponent(text(t))}&sll=${t.lat},${t.lng}`;
  }
  return `https://maps.apple.com/?daddr=${t.lat},${t.lng}&dirflg=w&q=${encodeURIComponent(t.name)}`;
}
