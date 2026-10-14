"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { useApp } from "@/components/AppProvider";
import type { Eatery, Pandal, Parking, PujaEvent, Restroom } from "@/lib/types";

import { MapViewLazy } from "./MapLoader";
import { useDescribe } from "./useDescribe";

const EMPTY: never[] = [];

/**
 * Compact, single-purpose map used by the list pages' "Map" view: shows only the given places and
 * fits the viewport to them. The heavy map chunk is only downloaded when this component mounts.
 */
export function PlacesMap({
  pandals = EMPTY,
  restrooms = EMPTY,
  parking = EMPTY,
  eateries = EMPTY,
  events = EMPTY,
  className = "h-[62dvh] min-h-80",
}: {
  pandals?: Pandal[];
  restrooms?: Restroom[];
  parking?: Parking[];
  eateries?: Eatery[];
  events?: PujaEvent[];
  className?: string;
}) {
  const tm = useTranslations("map");
  const a11y = useTranslations("a11y");
  const app = useApp();
  const { describe, crowdLabel } = useDescribe();

  const visible = {
    pandals: pandals.length > 0,
    restrooms: restrooms.length > 0,
    parking: parking.length > 0,
    eateries: eateries.length > 0,
    events: events.length > 0,
  };

  // refit when the set of places changes (filters), not on every re-render
  const fit = useMemo(() => {
    const points = [...pandals, ...restrooms, ...parking, ...eateries, ...events];
    const key = `${points.length}:${points[0]?.lat ?? 0}:${points[points.length - 1]?.lng ?? 0}`;
    return { key, points };
  }, [pandals, restrooms, parking, eateries, events]);

  const onSelectPandal = useCallback((id: string) => app.selectPandal(id), [app]);

  return (
    <div className={`relative isolate overflow-hidden rounded-2xl border border-line ${className}`}>
      <MapViewLazy
        visible={visible}
        pandals={pandals}
        restrooms={restrooms}
        parking={parking}
        eateries={eateries}
        events={events}
        getCrowd={app.getCrowd}
        crowdLabel={crowdLabel}
        selectedPandalId={app.selectedPandalId}
        onSelectPandal={onSelectPandal}
        userLocation={app.location}
        focus={null}
        fit={fit}
        describe={describe}
        directionsLabel={tm("popupDirections")}
        mapLabel={a11y("mapRegion")}
      />
    </div>
  );
}
