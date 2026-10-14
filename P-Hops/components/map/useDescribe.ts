"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { TIMEZONE } from "@/config/puja";
import type { CrowdLevel } from "@/lib/types";

import type { MapViewProps } from "./MapView";

/** Translated popup content + crowd labels for the Leaflet layers (memoised: marker rebuilds are not free). */
export function useDescribe() {
  const tCrowd = useTranslations("crowd");
  const tRest = useTranslations("restrooms");
  const tPark = useTranslations("parking");
  const tEat = useTranslations("eateries");
  const tEv = useTranslations("events");
  const fmt = useFormatter();

  const crowdLabel = useCallback((l: CrowdLevel) => tCrowd(l), [tCrowd]);

  const describe = useMemo<MapViewProps["describe"]>(
    () => ({
      restroom: (r) => ({
        title: r.name,
        lines: [
          tRest(`types.${r.type}`),
          r.accessible ? tRest("accessible") : undefined,
          r.notes,
        ],
      }),
      parking: (p) => ({
        title: p.name,
        lines: [
          p.capacity ? tPark("spaces", { count: p.capacity }) : undefined,
          p.fee ? `${tPark("fee")}: ${p.fee}` : undefined,
          p.notes,
        ],
      }),
      eatery: (e) => ({
        title: e.name,
        lines: [
          `${tEat(`types.${e.cuisineType}`)} · ${"₹".repeat(e.priceRange)}`,
          e.famousFor ? `★ ${e.famousFor}` : undefined,
          e.isVeg ? tEat("vegOnly") : undefined,
        ],
      }),
      event: (e) => ({
        title: e.title,
        lines: [
          `${tEv(`days.${e.day}`)} · ${fmt.dateTime(new Date(`${e.date}T12:00:00+05:30`), { day: "numeric", month: "short", timeZone: TIMEZONE })} · ${tEv("timeRange", { start: e.startTime, end: e.endTime })}`,
          e.locationName,
          e.confirmed ? undefined : tEv("toConfirm"),
        ],
      }),
    }),
    [tRest, tPark, tEat, tEv, fmt],
  );

  return { describe, crowdLabel };
}
