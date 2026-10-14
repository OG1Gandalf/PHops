"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";

import type { MapViewProps } from "./MapView";

function MapSkeleton() {
  const t = useTranslations("map");
  return (
    <div className="skeleton grid size-full place-items-center rounded-none" role="status">
      <span className="flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-muted shadow">
        <Icon name="map" className="size-4 animate-pulse" />
        {t("loading")}
      </span>
    </div>
  );
}

const MapViewDynamic = dynamic(() => import("./MapView"), { ssr: false, loading: () => <MapSkeleton /> });

/**
 * True while this part of the tree is on screen.
 *
 * Next.js (Cache Components) keeps visited routes alive inside React <Activity>: when you leave a page its DOM
 * stays but every effect is cleaned up, and the effects run again when you return. react-leaflet tears the map
 * down in that cleanup (`map.remove()`), so on return the layers would be added to a dead map and the page
 * crashed ("Map container is being reused by another instance"). Rendering the map only while visible makes it
 * unmount cleanly on hide and start fresh on show.
 */
function useIsOnScreen() {
  const [onScreen, setOnScreen] = useState(false);
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors Activity visibility (effects re-run on show, clean up on hide)
    setOnScreen(true);
    return () => setOnScreen(false);
  }, []);
  return onScreen;
}

/** Leaflet touches `window`, so the map is client-only and its JS is split into its own chunk. */
export function MapViewLazy(props: MapViewProps) {
  const onScreen = useIsOnScreen();
  return onScreen ? <MapViewDynamic {...props} /> : <MapSkeleton />;
}
