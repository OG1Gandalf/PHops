"use client";

import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import { clusterIcon, type LayerKey } from "./markers";

export interface MarkerItem {
  id: string;
  lat: number;
  lng: number;
  icon: L.DivIcon;
  /** icon used while this marker is selected (pandals) */
  selectedIcon?: L.DivIcon;
  title: string;
  /** pre-escaped HTML */
  popup?: string;
  onClick?: () => void;
}

/**
 * One clustered layer. Rebuilds its markers whenever `items` changes (cheap for <= ~700 markers),
 * while selection changes only swap the icon so spiderfied clusters do not collapse.
 */
export function ClusterLayer({
  layer,
  items,
  selectedId,
}: {
  layer: LayerKey;
  items: MarkerItem[];
  selectedId?: string | null;
}) {
  const map = useMap();
  const markers = useRef(new Map<string, { marker: L.Marker; item: MarkerItem }>());
  const selectedRef = useRef<string | null | undefined>(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 46,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => clusterIcon(layer, c.getChildCount()),
    });
    const index = markers.current;
    index.clear();
    const list = items.map((item) => {
      const m = L.marker([item.lat, item.lng], {
        icon: item.id === selectedRef.current && item.selectedIcon ? item.selectedIcon : item.icon,
        title: item.title,
        alt: item.title,
        riseOnHover: true,
        keyboard: true,
      });
      if (item.popup) m.bindPopup(item.popup, { maxWidth: 260 });
      if (item.onClick) m.on("click", item.onClick);
      index.set(item.id, { marker: m, item });
      return m;
    });
    group.addLayers(list);
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      index.clear();
    };
  }, [map, items, layer]);

  // Selection only swaps icons
  const prev = useRef<string | null | undefined>(null);
  useEffect(() => {
    const index = markers.current;
    const old = prev.current ? index.get(prev.current) : undefined;
    if (old) old.marker.setIcon(old.item.icon);
    const cur = selectedId ? index.get(selectedId) : undefined;
    if (cur?.item.selectedIcon) cur.marker.setIcon(cur.item.selectedIcon);
    prev.current = selectedId;
  }, [selectedId, items]);

  return null;
}
