import {
  shouldEmitFix,
  type Fix,
  type GeoError,
  type GeoErrorCode,
} from "@/lib/locationUtils";
import type { LatLng } from "@/lib/types";

export type LocationStatus = "idle" | "prompting" | "granted" | "denied" | "unavailable" | "error";
export type PermissionState = "granted" | "prompt" | "denied" | "unknown";

export interface LocationSnapshot {
  status: LocationStatus;
  coords: LatLng | null;
  /** metres */
  accuracy: number | null;
  /** epoch ms of the last accepted fix */
  lastUpdated: number | null;
  error: GeoError | null;
  /** what the Permissions API says ("unknown" where it is unsupported, e.g. older Safari) */
  permission: PermissionState;
  /** the prompt looks stuck: the browser may need a tap (some iOS versions) before it will ask */
  needsGesture: boolean;
}

function classifyPermission(s: string): PermissionState {
  return s === "granted" || s === "prompt" || s === "denied" ? s : "unknown";
}

/** The browser objects the controller talks to. Injectable so tests (and the dev-only lab) can fake them. */
export interface GeoEnv {
  nav: Pick<Navigator, "geolocation" | "permissions" | "onLine"> | { geolocation?: undefined; permissions?: undefined; onLine: boolean };
  doc: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;
  isSecureContext: boolean;
}

export const INITIAL_LOCATION: LocationSnapshot = {
  status: "idle",
  coords: null,
  accuracy: null,
  lastUpdated: null,
  error: null,
  permission: "unknown",
  needsGesture: false,
};

const FIRST_FIX: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 };
/** Used once if the first attempt times out. */
const RETRY_FIX: PositionOptions = { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 };
const WATCH: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 };
/** If nothing happens this long after we asked, show a button (the browser may want a user gesture). */
export const GESTURE_STALL_MS = 6_000;

/**
 * Owns the whole geolocation lifecycle outside React, so it can be tested on its own:
 * permission check, first fix (+ one low-accuracy retry), throttled watch, tab-visibility pause/resume,
 * and live reaction to the user changing the permission without reloading.
 *
 * Privacy: coordinates only ever live in this object (memory). Nothing here touches the network or storage.
 */
export class LocationController {
  constructor(private envOverride?: GeoEnv) {}

  /** Swap the browser objects (tests only). Call reset() afterwards. */
  setEnv(env: GeoEnv | undefined) {
    this.envOverride = env;
  }
  private get nav(): GeoEnv["nav"] {
    return this.envOverride?.nav ?? navigator;
  }
  private get doc(): GeoEnv["doc"] {
    return this.envOverride?.doc ?? document;
  }
  private get secure(): boolean {
    return this.envOverride?.isSecureContext ?? (typeof window === "undefined" ? true : window.isSecureContext !== false);
  }

  private snapshot: LocationSnapshot = INITIAL_LOCATION;
  private listeners = new Set<() => void>();
  private run = 0; // bumped to invalidate callbacks from an older start()/stop()
  private watchId: number | null = null;
  private lastEmitted: Fix | null = null;
  private hasFix = false;
  private permStatus: PermissionStatus | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | undefined;
  private attached = false;
  private pendingFirst = false; // a getCurrentPosition call is waiting for the browser/user

  getSnapshot = () => this.snapshot;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  private set(patch: Partial<LocationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  // ---------------------------------------------------------------- lifecycle

  /** Automatic flow on first load. */
  async start(): Promise<void> {
    this.stopWatch();
    const id = ++this.run;
    this.hasFix = false;
    this.lastEmitted = null;
    this.pendingFirst = false;
    this.attachDocumentListeners();

    const problem = this.supportProblem();
    if (problem) {
      this.set({ status: "unavailable", error: this.err(problem), needsGesture: false });
      return;
    }

    const permission = await this.queryPermission();
    if (id !== this.run) return;
    this.set({ permission });

    if (permission === "denied") {
      // Do not call the API again: it can only fail, and some browsers count repeats against the site.
      this.set({ status: "denied", error: this.err("permission_denied") });
      return;
    }
    if (permission === "granted") {
      this.set({ status: "granted", error: null });
      this.getFirstFix(id, false);
      return;
    }
    // "prompt" or unknown: ask right away so the browser popup appears without a second tap.
    this.set({ status: "prompting", error: null, needsGesture: false });
    this.getFirstFix(id, false);
    this.armStallTimer(id);
  }

  /**
   * Explicit user action ("Use my location", "Locate me"). Runs synchronously inside the click so
   * browsers that require a user gesture will show their prompt.
   * Returns "blocked" when the browser already says the site is blocked (nothing to ask).
   */
  request(): "started" | "blocked" | "unsupported" {
    const problem = this.supportProblem();
    if (problem) {
      this.set({ status: "unavailable", error: this.err(problem) });
      return "unsupported";
    }
    if (this.snapshot.permission === "denied") {
      void this.reconcilePermission(); // the user may have just fixed it in settings
      return "blocked";
    }
    this.stopWatch(); // restarted by the new first fix; the old watch's callbacks would be stale
    const id = ++this.run;
    this.attachDocumentListeners();
    this.set({
      status: this.snapshot.permission === "granted" ? "granted" : "prompting",
      error: null,
      needsGesture: false,
    });
    this.getFirstFix(id, true);
    return "started";
  }

  /** Forget everything, including the last position (tests / lab). */
  reset() {
    this.stop();
    this.hasFix = false;
    this.lastEmitted = null;
    this.pendingFirst = false;
    this.snapshot = INITIAL_LOCATION;
    this.listeners.forEach((l) => l());
  }

  /** Tear everything down (unmount). Safe to call start() again afterwards. */
  stop() {
    this.run++;
    this.stopWatch();
    clearTimeout(this.stallTimer);
    if (this.attached) {
      this.doc.removeEventListener("visibilitychange", this.onVisibility);
      this.attached = false;
    }
    if (this.permStatus) this.permStatus.onchange = null;
    this.permStatus = null;
  }

  // ---------------------------------------------------------------- positions

  private getFirstFix(id: number, forced: boolean, retried = false) {
    this.pendingFirst = true;
    this.nav.geolocation!.getCurrentPosition(
      (pos) => this.onPosition(id, pos, true),
      (err) => {
        if (id !== this.run) return;
        if (err.code === err.TIMEOUT && !retried) {
          // slow GPS: fall back once to a quick, coarse (network/cell) fix
          this.getFirstFix(id, forced, true);
          return;
        }
        void this.onError(id, err, false);
      },
      retried ? RETRY_FIX : FIRST_FIX,
    );
  }

  private onPosition(id: number, pos: GeolocationPosition, first: boolean) {
    if (id !== this.run) return;
    clearTimeout(this.stallTimer);
    if (first) this.pendingFirst = false;
    const fix: Fix = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      time: Date.now(),
    };
    if (first || shouldEmitFix(this.lastEmitted, fix)) {
      this.lastEmitted = fix;
      this.hasFix = true;
      this.set({
        status: "granted",
        permission: "granted",
        coords: { lat: fix.lat, lng: fix.lng },
        accuracy: fix.accuracy,
        lastUpdated: fix.time,
        error: null,
        needsGesture: false,
      });
    }
    if (first) this.startWatch(id);
  }

  private async onError(id: number, err: GeolocationPositionError, fromWatch: boolean) {
    if (id !== this.run) return;
    clearTimeout(this.stallTimer);
    if (!fromWatch) this.pendingFirst = false;

    if (err.code === err.PERMISSION_DENIED) {
      this.stopWatch();
      // Chrome reports a dismissed prompt as PERMISSION_DENIED too. If the permission is still "prompt"
      // the user simply closed the popup, so we can ask again later.
      const perm = await this.queryPermission();
      if (id !== this.run) return;
      const code: GeoErrorCode = perm === "prompt" ? "dismissed" : "permission_denied";
      this.hasFix = false;
      this.lastEmitted = null;
      this.set({
        status: "denied",
        permission: perm,
        coords: null,
        accuracy: null,
        lastUpdated: null,
        error: this.err(code),
        needsGesture: false,
      });
      return;
    }

    const code: GeoErrorCode = err.code === err.TIMEOUT ? "timeout" : "position_unavailable";
    if (fromWatch && this.hasFix) {
      // Keep showing the last good position; just note the hiccup.
      this.set({ error: this.err(code) });
      return;
    }
    this.set({
      status: code === "timeout" ? "error" : "unavailable",
      error: this.err(code),
      needsGesture: false,
    });
  }

  // ---------------------------------------------------------------- watching

  private startWatch(id: number) {
    if (this.watchId !== null || this.doc.hidden) return;
    this.watchId = this.nav.geolocation!.watchPosition(
      (pos) => this.onPosition(id, pos, false),
      (err) => void this.onError(id, err, true),
      WATCH,
    );
  }

  private stopWatch() {
    if (this.watchId !== null) this.nav.geolocation?.clearWatch(this.watchId);
    this.watchId = null;
  }

  private onVisibility = () => {
    if (this.doc.hidden) {
      this.stopWatch(); // no GPS drain in the background
      return;
    }
    // Back on screen: the user may have changed the permission in system settings meanwhile.
    void this.reconcilePermission().then(() => {
      if (this.hasFix && this.snapshot.status === "granted") this.startWatch(this.run);
    });
  };

  private attachDocumentListeners() {
    if (this.attached) return;
    this.doc.addEventListener("visibilitychange", this.onVisibility);
    this.attached = true;
  }

  // ---------------------------------------------------------------- permission

  private async queryPermission(): Promise<PermissionState> {
    try {
      if (!this.nav.permissions?.query) return "unknown";
      const status = await this.nav.permissions.query({ name: "geolocation" as PermissionName });
      if (this.permStatus && this.permStatus !== status) this.permStatus.onchange = null;
      this.permStatus = status;
      status.onchange = () => void this.onPermissionChange(classifyPermission(status.state));
      return classifyPermission(status.state);
    } catch {
      return "unknown"; // older Safari throws or lacks the API
    }
  }

  /** Re-read the permission and react if it changed while we were not looking. */
  private async reconcilePermission() {
    const id = this.run;
    const perm = await this.queryPermission();
    if (id !== this.run || perm === "unknown") return;
    if (perm !== this.snapshot.permission) await this.onPermissionChange(perm);
  }

  private async onPermissionChange(perm: PermissionState) {
    if (perm === this.snapshot.permission && this.snapshot.status !== "denied") return;
    this.set({ permission: perm });
    if (perm === "denied") {
      ++this.run;
      this.stopWatch();
      clearTimeout(this.stallTimer);
      this.pendingFirst = false;
      this.hasFix = false;
      this.lastEmitted = null;
      this.set({
        status: "denied",
        coords: null,
        accuracy: null,
        lastUpdated: null,
        error: this.err("permission_denied"),
        needsGesture: false,
      });
      return;
    }
    if (perm === "granted" && !this.hasFix) {
      if (this.pendingFirst) {
        // the user just tapped "Allow" and our request is already waiting: let it finish
        this.set({ status: "granted", error: null, needsGesture: false });
        return;
      }
      const id = ++this.run;
      this.set({ status: "granted", error: null, needsGesture: false });
      this.getFirstFix(id, false);
      return;
    }
    if (perm === "prompt") {
      // reset to "ask again": behave like a fresh first load
      this.stopWatch();
      await this.start();
    }
  }

  // ---------------------------------------------------------------- helpers

  private armStallTimer(id: number) {
    clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      if (id === this.run && this.snapshot.status === "prompting" && !this.hasFix) this.set({ needsGesture: true });
    }, GESTURE_STALL_MS);
  }

  private supportProblem(): GeoErrorCode | null {
    if (typeof navigator === "undefined" && !this.envOverride) return "unsupported";
    if (!this.nav.geolocation) return "unsupported";
    if (!this.secure) return "insecure_context";
    return null;
  }

  private err(code: GeoErrorCode): GeoError {
    return { code, offline: this.nav.onLine === false };
  }
}
