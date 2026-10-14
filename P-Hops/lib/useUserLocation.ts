"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { INITIAL_LOCATION, LocationController, type LocationSnapshot } from "@/lib/locationController";

export type { LocationSnapshot, LocationStatus, PermissionState } from "@/lib/locationController";

export interface UserLocationApi extends LocationSnapshot {
  /** Ask (again). Call it from a click handler. */
  request: () => "started" | "blocked" | "unsupported";
}

/**
 * Device location with the full permission/watch lifecycle:
 * `status` is "idle" | "prompting" | "granted" | "denied" | "unavailable" | "error".
 * Starts automatically on mount; use `request()` for the "Use my location" / "Locate me" buttons.
 * Coordinates live in memory only.
 */
export function useUserLocation(): UserLocationApi {
  const [controller] = useState(() => new LocationController());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => INITIAL_LOCATION);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Dev-only handle so the behaviour can be exercised with a mocked browser (stripped from production builds).
      (window as unknown as { __locationController?: LocationController }).__locationController = controller;
    }
    void controller.start();
    return () => controller.stop();
  }, [controller]);

  const request = useCallback(() => controller.request(), [controller]);
  return useMemo(() => ({ ...snapshot, request }), [snapshot, request]);
}
