/**
 * Shared domain types. These mirror the schemas in README.md ("Data schemas").
 * Every static record carries `verified` + `source` so reviewers can audit it.
 */

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";
export type CrowdLevel = "low" | "medium" | "high";

export type Zone =
  | "north"
  | "central"
  | "south"
  | "saltlake"
  | "howrah"
  | "behala"
  | "east";

export interface LatLng {
  lat: number;
  lng: number;
}

export type LocationPrecision = "venue" | "area" | "zone";

export interface Pandal extends LatLng {
  id: string;
  name: string;
  area: string;
  zone: Zone;
  theme?: string;
  description?: string;
  openingHours?: string;
  /** "venue" = a mapped park/club/street; "area" = neighbourhood centroid (approximate). */
  locationPrecision: LocationPrecision;
  crowdByTimeSlot: Record<TimeSlot, CrowdLevel>;
  tags: string[];
  verified: boolean;
  source: string;
}

export type RestroomType = "public" | "paid" | "venue";

export interface Restroom extends LatLng {
  id: string;
  name: string;
  type: RestroomType;
  accessible: boolean;
  notes?: string;
  verified: boolean;
  source: string;
}

export interface Parking extends LatLng {
  id: string;
  name: string;
  capacity?: number;
  fee?: string;
  openHours?: string;
  notes?: string;
  verified: boolean;
  source: string;
}

export type CuisineType =
  | "street_food"
  | "bengali"
  | "sweets"
  | "cafe"
  | "biryani"
  | "other";

export type PriceRange = 1 | 2 | 3; // ₹ / ₹₹ / ₹₹₹

export interface Eatery extends LatLng {
  id: string;
  name: string;
  cuisineType: CuisineType;
  priceRange: PriceRange;
  isVeg: boolean;
  openHours?: string;
  /** Present for hand-curated Puja-time favourites. */
  famousFor?: string;
  verified: boolean;
  source: string;
}

export type PujaDay =
  | "shashthi"
  | "saptami"
  | "ashtami"
  | "navami"
  | "dashami"
  | "bhasan";

export interface PujaEvent extends LatLng {
  id: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD). Derived from the day in config/puja.ts when omitted at build time. */
  date: string;
  startTime: string; // HH:mm (24h)
  endTime: string; // HH:mm (24h)
  locationName: string;
  pandalId?: string;
  /** false => "to confirm" */
  confirmed: boolean;
  /** Extra metadata (not in the original schema, kept for filtering). */
  day: PujaDay;
  area: string;
  verified: boolean;
  source: string;
}

/** Shape stored in data/events.json: `date` is derived from `day` via config/puja.ts. */
export type PujaEventRecord = Omit<PujaEvent, "date">;

export interface CrowdAggregate {
  pandalId: string;
  level: CrowdLevel;
  count: number;
  /** ISO timestamp of the most recent report in the window. */
  lastReportAt: string;
}

export interface CommentDTO {
  id: string;
  pandal_id: string;
  name: string;
  text: string;
  created_at: string;
  reported_count: number;
}
