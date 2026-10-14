"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { AttributionControl, Circle, MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";

import type { MapFocus } from "@/components/AppProvider";
import type { UserLocation } from "@/components/LocationProvider";
import { MAP_CONFIG } from "@/config/puja";
import type { DisplayedCrowd } from "@/lib/crowdService";
import { googleMapsUrl } from "@/lib/directions";
import type { CrowdLevel, Eatery, Pandal, Parking, PujaEvent, Restroom } from "@/lib/types";

import { ClusterLayer, type MarkerItem } from "./ClusterLayer";
import { layerIcon, pandalIcon, popupHtml, userIcon, type LayerKey } from "./markers";

export interface PopupContent {
  title: string;
  lines?: (string | undefined)[];
}

export interface MapViewProps {
  visible: Record<LayerKey, boolean>;
  pandals: Pandal[];
  restrooms: Restroom[];
  parking: Parking[];
  eateries: Eatery[];
  events: PujaEvent[];
  getCrowd: (p: Pandal) => DisplayedCrowd;
  crowdLabel: (level: CrowdLevel) => string;
  selectedPandalId: string | null;
  onSelectPandal: (id: string) => void;
  userLocation: UserLocation | null;
  focus: MapFocus | null;
  describe: {
    restroom: (r: Restroom) => PopupContent;
    parking: (p: Parking) => PopupContent;
    eatery: (e: Eatery) => PopupContent;
    event: (e: PujaEvent) => PopupContent;
  };
  directionsLabel: string;
  mapLabel: string;
  /** When set, a tap on the map reports its position (used by "pick a point on the map"). */
  onMapClick?: (p: { lat: number; lng: number }) => void;
  /** Fit the viewport to these points whenever `key` changes (list-page maps). */
  fit?: { key: string; points: { lat: number; lng: number }[] } | null;
  className?: string;
}

function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function FitController({ fit }: { fit: MapViewProps["fit"] }) {
  const map = useMap();
  useEffect(() => {
    if (!fit || fit.points.length === 0) return;
    const bounds = L.latLngBounds(fit.points.map((p) => L.latLng(p.lat, p.lng)));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: !reduce });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit?.key]);
  return null;
}

function ClickCatcher({ onMapClick }: { onMapClick?: MapViewProps["onMapClick"] }) {
  useMapEvents({
    click: (e) => onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

function FocusController({ focus }: { focus: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const zoom = focus.zoom ?? Math.max(map.getZoom(), 14);
    let target = L.latLng(focus.lat, focus.lng);
    if (focus.withSheet) {
      // Shift the map centre so the point is not hidden behind the bottom sheet / side panel.
      const size = map.getSize();
      const wide = window.innerWidth >= 768;
      const shift = wide ? L.point(Math.min(210, size.x * 0.2), 0) : L.point(0, size.y * 0.22);
      target = map.unproject(map.project(target, zoom).add(shift), zoom);
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) map.setView(target, zoom, { animate: false });
    else map.flyTo(target, zoom, { duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq]);
  return null;
}

function placeItems<T extends { id: string; name?: string; lat: number; lng: number }>(
  layer: Exclude<LayerKey, "pandals">,
  list: readonly T[],
  describe: (x: T) => PopupContent,
  directionsLabel: string,
  famous?: (x: T) => boolean,
): MarkerItem[] {
  return list.map((x) => {
    const c = describe(x);
    return {
      id: x.id,
      lat: x.lat,
      lng: x.lng,
      icon: layerIcon(layer, { famous: famous?.(x) }),
      title: c.title,
      popup: popupHtml({
        title: c.title,
        lines: c.lines,
        url: googleMapsUrl({ name: c.title, lat: x.lat, lng: x.lng }),
        urlLabel: directionsLabel,
      }),
    };
  });
}

export default function MapView(props: MapViewProps) {
  const { visible, getCrowd, crowdLabel, selectedPandalId, onSelectPandal, describe, directionsLabel } = props;

  const pandalItems = useMemo<MarkerItem[]>(
    () =>
      props.pandals.map((p) => {
        const crowd = getCrowd(p);
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          icon: pandalIcon(crowd.level, false),
          selectedIcon: pandalIcon(crowd.level, true),
          title: `${p.name} – ${crowdLabel(crowd.level)}`,
          onClick: () => onSelectPandal(p.id),
        };
      }),
    [props.pandals, getCrowd, crowdLabel, onSelectPandal],
  );

  const restroomItems = useMemo(
    () => placeItems("restrooms", props.restrooms, describe.restroom, directionsLabel),
    [props.restrooms, describe, directionsLabel],
  );
  const parkingItems = useMemo(
    () => placeItems("parking", props.parking, describe.parking, directionsLabel),
    [props.parking, describe, directionsLabel],
  );
  const eateryItems = useMemo(
    () => placeItems("eateries", props.eateries, describe.eatery, directionsLabel, (e) => !!e.famousFor),
    [props.eateries, describe, directionsLabel],
  );
  const eventItems = useMemo(
    () => placeItems("events", props.events, describe.event, directionsLabel),
    [props.events, describe, directionsLabel],
  );

  return (
    <MapContainer
      center={MAP_CONFIG.center}
      zoom={MAP_CONFIG.zoom}
      minZoom={MAP_CONFIG.minZoom}
      maxZoom={MAP_CONFIG.maxZoom}
      maxBounds={MAP_CONFIG.maxBounds}
      maxBoundsViscosity={1}
      zoomControl={false}
      attributionControl={false}
      className={props.className ?? "size-full"}
      aria-label={props.mapLabel}
      keyboard
    >
      <TileLayer
        url={MAP_CONFIG.tileUrl}
        attribution={MAP_CONFIG.attribution}
        maxZoom={MAP_CONFIG.maxZoom}
        keepBuffer={2}
        updateWhenIdle
      />
      <AttributionControl position="bottomleft" prefix={false} />
      <ZoomControl position="bottomright" />
      <ResizeWatcher />
      <FocusController focus={props.focus} />
      <FitController fit={props.fit} />
      <ClickCatcher onMapClick={props.onMapClick} />

      {visible.pandals && <ClusterLayer layer="pandals" items={pandalItems} selectedId={selectedPandalId} />}
      {visible.restrooms && <ClusterLayer layer="restrooms" items={restroomItems} />}
      {visible.parking && <ClusterLayer layer="parking" items={parkingItems} />}
      {visible.eateries && <ClusterLayer layer="eateries" items={eateryItems} />}
      {visible.events && <ClusterLayer layer="events" items={eventItems} />}

      {props.userLocation?.source === "gps" && props.userLocation.accuracy ? (
        <Circle
          center={[props.userLocation.lat, props.userLocation.lng]}
          radius={Math.min(props.userLocation.accuracy, 5000)}
          interactive={false}
          pathOptions={{ color: "#2563eb", weight: 1, opacity: 0.5, fillColor: "#2563eb", fillOpacity: 0.12 }}
        />
      ) : null}
      {props.userLocation && (
        <Marker
          position={[props.userLocation.lat, props.userLocation.lng]}
          icon={userIcon}
          interactive={false}
          keyboard={false}
          zIndexOffset={900}
        />
      )}
    </MapContainer>
  );
}
