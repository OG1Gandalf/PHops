"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CROWD_RULES } from "@/config/puja";
import {
  fetchCrowdAggregates,
  getDisplayedCrowd,
  sameAggregates,
  toAggregateMap,
  type AggregateMap,
  type DisplayedCrowd,
} from "@/lib/crowdService";
import { getSavedPandals, setSavedPandals } from "@/lib/device";
import { useLocation, type UserLocation } from "@/components/LocationProvider";
import { currentSlot as computeCurrentSlot } from "@/lib/timeSlot";
import type { LatLng, Pandal, TimeSlot } from "@/lib/types";

export type { UserLocation };

export interface MapFocus extends LatLng {
  zoom?: number;
  /** keep the point visible above the bottom sheet / beside the side panel */
  withSheet?: boolean;
  /** bump to re-trigger the same coordinates */
  seq: number;
}

interface AppState {
  // time slot
  slot: TimeSlot;
  currentSlot: TimeSlot;
  /** False for the prerendered HTML and first paint, until the real Asia/Kolkata slot has been read from the clock. */
  slotReady: boolean;
  setSlot: (s: TimeSlot) => void;
  // selection
  selectedPandalId: string | null;
  selectPandal: (id: string | null) => void;
  // crowd
  aggregates: AggregateMap;
  crowdAvailable: boolean;
  refreshCrowd: () => Promise<void>;
  getCrowd: (p: Pandal) => DisplayedCrowd;
  /** Effective "near me" point (a manual pick, else a device fix inside Kolkata). Details live in useLocation(). */
  location: UserLocation | null;
  // map
  mapFocus: MapFocus | null;
  focusMap: (p: LatLng, zoom?: number, withSheet?: boolean) => void;
  // saved ("favourite") pandals, kept on this device
  saved: ReadonlySet<string>;
  toggleSaved: (id: string) => boolean; // returns the new state
  // "Surprise me" card
  surprise: { seed: number; skip?: string } | null;
  /** open the card (or spin again, skipping the pandal currently shown) */
  spinSurprise: (skip?: string) => void;
  closeSurprise: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

const POLL_MS = 60_000;

export function AppProvider({ children }: { children: ReactNode }) {
  // Server + first client render use the same value ("evening"); the real slot is set after mount.
  const [currentSlot, setCurrentSlot] = useState<TimeSlot>("evening");
  const [slotReady, setSlotReady] = useState(false);
  const [slotOverride, setSlotOverride] = useState<TimeSlot | null>(null);
  const [selectedPandalId, setSelectedPandalId] = useState<string | null>(null);
  const [aggregates, setAggregates] = useState<AggregateMap>(() => new Map());
  const [crowdAvailable, setCrowdAvailable] = useState(true);
  const { point: location } = useLocation();
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const seq = useRef(0);
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
  const [surprise, setSurprise] = useState<{ seed: number; skip?: string } | null>(null);
  const spinSurprise = useCallback((skip?: string) => {
    // called from click handlers only, so reading the clock here is fine
    setSurprise((cur) => ({ seed: Math.max(Date.now(), (cur?.seed ?? 0) + 1), skip }));
  }, []);
  const closeSurprise = useCallback(() => setSurprise(null), []);

  // saved pandals live in localStorage, which only exists after hydration
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from localStorage
    setSaved(new Set(getSavedPandals()));
  }, []);

  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);
  const toggleSaved = useCallback((id: string) => {
    const next = new Set(savedRef.current);
    const nowSaved = !next.has(id);
    if (nowSaved) next.add(id);
    else next.delete(id);
    savedRef.current = next;
    setSaved(next);
    setSavedPandals([...next]);
    return nowSaved;
  }, []);

  // ---- current slot (device time, converted to Asia/Kolkata), refreshed every minute
  useEffect(() => {
    const tick = () => {
      setCurrentSlot(computeCurrentSlot());
      setSlotReady(true);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ---- crowd aggregates: poll while the tab is visible
  const lastCrowdOk = useRef(0);
  const refreshCrowd = useCallback(async () => {
    try {
      const list = await fetchCrowdAggregates();
      lastCrowdOk.current = Date.now();
      // keep the same Map when nothing changed: a new one would rebuild every marker on the map once a minute
      setAggregates((prev) => (sameAggregates(prev, list) ? prev : toAggregateMap(list)));
      setCrowdAvailable(true);
    } catch {
      setCrowdAvailable(false);
      // offline / backend down: readings older than the voting window must not keep passing as "live"
      if (Date.now() - lastCrowdOk.current > CROWD_RULES.windowMinutes * 60_000) {
        setAggregates((prev) => (prev.size ? new Map() : prev));
      }
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const loop = async () => {
      if (document.visibilityState === "visible") await refreshCrowd();
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshCrowd();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshCrowd]);

  const focusMap = useCallback((p: LatLng, zoom?: number, withSheet?: boolean) => {
    seq.current += 1;
    setMapFocus({ lat: p.lat, lng: p.lng, zoom, withSheet, seq: seq.current });
  }, []);

  const slot = slotOverride ?? currentSlot;

  const getCrowd = useCallback(
    (p: Pandal) => getDisplayedCrowd(p, slot, currentSlot, aggregates),
    [slot, currentSlot, aggregates],
  );

  const value = useMemo<AppState>(
    () => ({
      slot,
      currentSlot,
      slotReady,
      setSlot: (s) => setSlotOverride(s === currentSlot ? null : s),
      selectedPandalId,
      selectPandal: setSelectedPandalId,
      aggregates,
      crowdAvailable,
      refreshCrowd,
      getCrowd,
      location,
      mapFocus,
      focusMap,
      saved,
      toggleSaved,
      surprise,
      spinSurprise,
      closeSurprise,
    }),
    [
      slot,
      currentSlot,
      slotReady,
      selectedPandalId,
      aggregates,
      crowdAvailable,
      refreshCrowd,
      getCrowd,
      location,
      mapFocus,
      focusMap,
      saved,
      toggleSaved,
      surprise,
      spinSurprise,
      closeSurprise,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
