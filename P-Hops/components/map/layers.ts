import type { IconName } from "@/components/ui/Icon";

/**
 * Layer definitions. Kept free of any `leaflet` import so server-rendered pages / components can use
 * them (leaflet touches `window` at import time and must only be loaded inside the client-only map chunk).
 */
export type LayerKey = "pandals" | "restrooms" | "parking" | "eateries" | "events";

export const LAYER_ORDER: LayerKey[] = ["pandals", "restrooms", "parking", "eateries", "events"];

/** Layer identity: icon + chip colour (Tailwind classes use these) */
export const LAYER_META: Record<LayerKey, { icon: IconName; color: string }> = {
  pandals: { icon: "temple", color: "#8c1515" },
  restrooms: { icon: "person", color: "#0369a1" },
  parking: { icon: "parking", color: "#4338ca" },
  eateries: { icon: "utensils", color: "#c2410c" },
  events: { icon: "star", color: "#7e22ce" },
};
