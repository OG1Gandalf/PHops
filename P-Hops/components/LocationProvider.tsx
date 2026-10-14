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

import { isInsideKolkata } from "@/lib/geo";
import { detectEnvironment, type BrowserEnv } from "@/lib/locationUtils";
import { useUserLocation, type UserLocationApi } from "@/lib/useUserLocation";
import type { LatLng } from "@/lib/types";

/** A point the user chose by hand (kept in memory only). */
export interface ManualPoint extends LatLng {
  kind: "area" | "pin";
  /** area name for kind "area" */
  label?: string;
  areaId?: string;
}

/** The point the rest of the app uses for "near me" features. */
export interface UserLocation extends LatLng {
  source: "gps" | "manual";
  accuracy?: number;
  label?: string;
  /** "pin" = dropped on the map by the user; "area" = picked from the list */
  manualKind?: ManualPoint["kind"];
}

export type BannerKind = "prompt" | "dismissed" | "blocked" | "unavailable" | "outside";

interface LocationContextValue extends UserLocationApi {
  /** Is the device fix inside the Kolkata bounding box? null while there is no fix. */
  gpsInsideKolkata: boolean | null;
  /** The device is somewhere outside Kolkata (and the user has not picked a point by hand). */
  outsideKolkata: boolean;
  manual: ManualPoint | null;
  setManual: (p: ManualPoint) => void;
  clearManual: () => void;
  /** Effective point for distances and sorting: a manual pick, else a device fix inside Kolkata. */
  point: UserLocation | null;
  /** waiting for a first fix */
  locating: boolean;
  /** Tap on "Use my location" / "Locate me": asks again, and brings help back if it fails. */
  ask: () => void;
  // "pick a point on the map" mode
  picking: boolean;
  startPicking: () => void;
  stopPicking: () => void;
  // banners
  banner: BannerKind | null;
  dismissBanner: (k: BannerKind) => void;
  /** The first fix after load may centre the map once; returns true only the first time. */
  consumeAutoCenter: () => boolean;
  env: BrowserEnv;
}

const Ctx = createContext<LocationContextValue | null>(null);

export function useLocation(): LocationContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocation must be used inside <LocationProvider>");
  return v;
}

const BLOCKED_SEEN_KEY = "pujo.locHelpSeen"; // remembers only that the help message was dismissed, never a position
const SERVER_ENV: BrowserEnv = { inApp: null, platform: "desktop" };

export function LocationProvider({ children }: { children: ReactNode }) {
  const device = useUserLocation();
  const { status, coords, accuracy, error, request } = device;

  const [manual, setManualState] = useState<ManualPoint | null>(null);
  const [picking, setPicking] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<BannerKind>>(() => new Set());
  const [env, setEnv] = useState<BrowserEnv>(SERVER_ENV);
  const autoCentered = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only values, readable only after hydration */
    setEnv(detectEnvironment(navigator.userAgent, navigator.maxTouchPoints));
    try {
      if (localStorage.getItem(BLOCKED_SEEN_KEY) === "1") setDismissed((s) => new Set(s).add("blocked"));
    } catch {
      /* private mode: the message just shows again */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const gpsInsideKolkata = coords ? isInsideKolkata(coords) : null;
  const outsideKolkata = !!coords && gpsInsideKolkata === false && !manual;

  const point = useMemo<UserLocation | null>(() => {
    if (manual) return { lat: manual.lat, lng: manual.lng, source: "manual", label: manual.label, manualKind: manual.kind };
    if (coords && gpsInsideKolkata) return { lat: coords.lat, lng: coords.lng, source: "gps", accuracy: accuracy ?? undefined };
    return null;
  }, [manual, coords, gpsInsideKolkata, accuracy]);

  const locating = status === "prompting" || (status === "granted" && !coords);

  const setManual = useCallback((p: ManualPoint) => {
    setManualState(p);
    setPicking(false);
  }, []);
  const clearManual = useCallback(() => setManualState(null), []);

  const ask = useCallback(() => {
    // An explicit tap should always bring the help back if it still does not work.
    setDismissed(new Set());
    setManualState(null);
    request();
  }, [request]);

  const dismissBanner = useCallback((k: BannerKind) => {
    setDismissed((s) => new Set(s).add(k));
    if (k === "blocked") {
      try {
        localStorage.setItem(BLOCKED_SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Which (single) location banner applies right now?
  let banner: BannerKind | null = null;
  if (!manual && !picking) {
    if (outsideKolkata) banner = "outside";
    else if (!coords) {
      if (status === "prompting") banner = "prompt";
      else if (status === "denied") banner = error?.code === "dismissed" ? "dismissed" : "blocked";
      else if (status === "unavailable" || status === "error") banner = "unavailable";
    }
  }
  if (banner && dismissed.has(banner)) banner = null;

  const value = useMemo<LocationContextValue>(
    () => ({
      ...device,
      gpsInsideKolkata,
      outsideKolkata,
      manual,
      setManual,
      clearManual,
      point,
      locating,
      ask,
      picking,
      startPicking: () => setPicking(true),
      stopPicking: () => setPicking(false),
      banner,
      dismissBanner,
      consumeAutoCenter: () => {
        if (autoCentered.current) return false;
        autoCentered.current = true;
        return true;
      },
      env,
    }),
    [device, gpsInsideKolkata, outsideKolkata, manual, setManual, clearManual, point, locating, ask, picking, banner, dismissBanner, env],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
