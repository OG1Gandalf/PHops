"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { useLocation } from "@/components/LocationProvider";
import { PandalSearchBox } from "@/components/PandalSearchBox";
import { SlotSelector } from "@/components/SlotSelector";
import { useToast } from "@/components/ToastProvider";
import { CrowdBars } from "@/components/ui/CrowdBadge";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/i18n/navigation";
import { EVENTS, loadEateries, loadParking, loadRestrooms, PANDALS } from "@/lib/data";
import { useLazy } from "@/lib/useLazy";
import type { Pandal } from "@/lib/types";

import { MapViewLazy } from "./MapLoader";
import { LAYER_META, LAYER_ORDER, type LayerKey } from "./layers";
import { useDescribe } from "./useDescribe";

// The map is this page's main content. next/dynamic only starts fetching its chunk after hydration and a first client
// render; starting the download as soon as this module runs overlaps it with hydration (home page only: the list pages
// that embed a map must not pay for Leaflet up front).
if (typeof window !== "undefined") void import("./MapView");

const EMPTY: never[] = [];

export function MapScreen() {
  const t = useTranslations("layers");
  const tm = useTranslations("map");
  const tc = useTranslations("crowd");
  const a11y = useTranslations("a11y");
  const app = useApp();
  const { describe, crowdLabel } = useDescribe();

  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    pandals: true,
    restrooms: false,
    parking: false,
    eateries: false,
    events: false,
  });
  const [legendOpen, setLegendOpen] = useState(false);

  // Larger datasets are loaded only when their layer is switched on (separate JS chunks).
  const restrooms = useLazy(loadRestrooms, visible.restrooms);
  const parking = useLazy(loadParking, visible.parking);
  const eateries = useLazy(loadEateries, visible.eateries);
  const status: Partial<Record<LayerKey, { status: string; retry: () => void }>> = {
    restrooms,
    parking,
    eateries,
  };

  const toggle = (k: LayerKey) => {
    if (status[k]?.status === "error") {
      status[k]!.retry();
      return;
    }
    setVisible((v) => ({ ...v, [k]: !v[k] }));
  };

  // ---- location: auto-centre once on the first fix, "Locate me" button, pick-a-point mode
  const loc = useLocation();
  const { focusMap, selectPandal } = app;
  const { point, consumeAutoCenter, picking, stopPicking, setManual } = loc;
  const tl = useTranslations("location");
  const toast = useToast();
  const wantsLocate = useRef(false);

  useEffect(() => {
    if (!point) return;
    if (wantsLocate.current) {
      wantsLocate.current = false;
      focusMap(point, 15);
    } else if (point.source === "gps" && consumeAutoCenter()) {
      focusMap(point, 14); // first fix after load: show what is near the visitor
    } else if (point.manualKind === "area") {
      focusMap(point, 14); // the visitor picked an area from the list
    }
  }, [point, focusMap, consumeAutoCenter]);

  // a failed attempt must not leave a stale "fly there when found" request behind
  useEffect(() => {
    if (!loc.locating && !point) wantsLocate.current = false;
  }, [loc.locating, point]);

  const onLocate = () => {
    if (point) {
      focusMap(point, 15); // re-centre (on the device fix, or the point the visitor picked)
      return;
    }
    wantsLocate.current = true;
    loc.ask();
  };

  const onMapClick = useCallback(
    (p: { lat: number; lng: number }) => {
      setManual({ lat: p.lat, lng: p.lng, kind: "pin" });
      toast({ emoji: "📍", text: tl("pickedToast"), tone: "good" });
    },
    [setManual, toast, tl],
  );

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopPicking();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking, stopPicking]);

  const onPickPandal = useCallback(
    (p: Pandal) => {
      selectPandal(p.id);
      focusMap(p, 16, true);
    },
    [selectPandal, focusMap],
  );
  const onMarkerSelect = useCallback(
    (id: string) => {
      selectPandal(id);
      const p = PANDALS.find((x) => x.id === id);
      if (p) focusMap(p, undefined, true);
    },
    [selectPandal, focusMap],
  );

  const layerLabel = (k: LayerKey) => t(k);

  return (
    <section
      aria-label={a11y("mapRegion")}
      className="relative h-[calc(100dvh-var(--header-h)-var(--nav-h))] w-full overflow-hidden md:h-[calc(100dvh-var(--header-h))]"
    >
      <MapViewLazy
        visible={visible}
        pandals={PANDALS}
        restrooms={restrooms.data ?? EMPTY}
        parking={parking.data ?? EMPTY}
        eateries={eateries.data ?? EMPTY}
        events={EVENTS}
        getCrowd={app.getCrowd}
        crowdLabel={crowdLabel}
        selectedPandalId={app.selectedPandalId}
        onSelectPandal={onMarkerSelect}
        userLocation={app.location}
        onMapClick={picking ? onMapClick : undefined}
        className={picking ? "size-full !cursor-crosshair" : undefined}
        focus={app.mapFocus}
        describe={describe}
        directionsLabel={tm("popupDirections")}
        mapLabel={a11y("mapRegion")}
      />

      {/* Top overlay: search + layer toggles */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-2 md:right-auto md:max-w-xl md:p-3">
        <PandalSearchBox onPick={onPickPandal} className="pointer-events-auto" />
        <div
          role="group"
          aria-label={a11y("layerToggles")}
          className="no-scrollbar pointer-events-auto -mx-2 flex gap-2 overflow-x-auto px-2 pb-1 md:mx-0 md:px-0"
        >
          {LAYER_ORDER.map((k) => {
            const on = visible[k];
            const st = status[k]?.status;
            const color = LAYER_META[k].color;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(k)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold shadow-md transition-colors ${
                  on ? "text-white" : "border-line bg-surface-2 text-ink"
                }`}
                style={on ? { background: color, borderColor: color } : undefined}
              >
                <Icon name={st === "error" ? "alert" : LAYER_META[k].icon} className="size-4" />
                {layerLabel(k)}
                {on && st === "loading" && (
                  <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" role="status" aria-label={t("loading", { layer: layerLabel(k) })} />
                )}
                {st === "error" && <span className="sr-only">{t("loadFailed", { layer: layerLabel(k) })}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right column: locate + legend + least crowded */}
      <div className="pointer-events-none absolute right-2 top-[7.25rem] z-[1000] flex flex-col gap-2 md:right-3">
        <button
          type="button"
          onClick={onLocate}
          aria-label={tm("locate")}
          title={tm("locate")}
          className="pointer-events-auto grid size-12 place-items-center rounded-full border border-line bg-surface-2 text-ink shadow-lg hover:bg-surface-3"
        >
          {loc.locating ? (
            <span className="size-5 animate-spin rounded-full border-2 border-line border-t-brand" />
          ) : (
            <Icon name="locate" className="size-6" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          aria-label={tm("legendToggle")}
          title={tm("legendToggle")}
          className="pointer-events-auto grid size-12 place-items-center rounded-full border border-line bg-surface-2 text-ink shadow-lg hover:bg-surface-3"
        >
          <Icon name="info" className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => app.spinSurprise()}
          aria-label={tm("surprise")}
          title={tm("surprise")}
          className="pointer-events-auto grid size-12 place-items-center rounded-full border-2 border-gold bg-surface-2 text-2xl shadow-lg hover:bg-surface-3"
        >
          <span aria-hidden="true">🎲</span>
        </button>
        <Link
          href="/pandals?tab=least"
          aria-label={tm("leastCrowdedLink")}
          title={tm("leastCrowdedLink")}
          className="pointer-events-auto grid size-12 place-items-center rounded-full bg-brand text-brand-ink shadow-lg hover:bg-brand-hover"
        >
          <CrowdBars level="low" className="scale-125" />
        </Link>
      </div>

      {legendOpen && (
        <div className="absolute right-16 top-[7.25rem] z-[1000] w-64 rounded-2xl border border-line bg-surface-2 p-3 text-sm shadow-xl md:right-[4.5rem]">
          <p className="mb-2 font-semibold text-ink">{tc("legend")}</p>
          <ul className="space-y-1.5">
            {(["low", "medium", "high"] as const).map((l) => (
              <li key={l} className="flex items-center gap-2">
                <span className={`crowd-${l} inline-flex min-w-24 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold`}>
                  <CrowdBars level={l} />
                  {tc(l)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-snug text-muted">{tc("disclaimer")}</p>
          <p className="mt-2 text-xs leading-snug text-muted">{tm("datesNote")}</p>
        </div>
      )}

      {/* "Pick a point" mode: instruction bar over the search box */}
      {picking && (
        <div
          role="status"
          className="pop absolute inset-x-2 top-2 z-[1100] mx-auto flex max-w-md items-start gap-3 rounded-2xl border-2 border-brand bg-surface-2 p-3 shadow-xl md:left-3 md:mx-0"
        >
          <span aria-hidden="true" className="text-2xl leading-none">
            📍
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{tl("pickTitle")}</p>
            <p className="mt-0.5 text-xs text-muted">{tl("pickHelp")}</p>
          </div>
          <button
            type="button"
            onClick={stopPicking}
            className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-3"
          >
            {tl("pickCancel")}
          </button>
        </div>
      )}

      {/* Bottom: time-slot selector */}
      <div className="pointer-events-none absolute inset-x-0 bottom-7 z-[1000] flex justify-center px-2">
        <SlotSelector className="pointer-events-auto" />
      </div>
    </section>
  );
}
