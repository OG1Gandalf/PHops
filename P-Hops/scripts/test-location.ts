/**
 * Behavioural tests for the geolocation state machine (no browser or GPS needed).
 * Run: npm run test:location
 */
import assert from "node:assert/strict";

import { LocationController, GESTURE_STALL_MS, type GeoEnv } from "../lib/locationController";
import { detectEnvironment, shouldEmitFix, type Fix } from "../lib/locationUtils";

type Cb = (p: GeolocationPosition) => void;
type EcB = (e: GeolocationPositionError) => void;

class FakeGeo {
  calls: { ok: Cb; err: EcB; opts: PositionOptions }[] = [];
  watchers = new Map<number, { ok: Cb; err: EcB; opts: PositionOptions }>();
  cleared: number[] = [];
  private n = 0;
  getCurrentPosition(ok: Cb, err: EcB, opts: PositionOptions) {
    this.calls.push({ ok, err, opts });
  }
  watchPosition(ok: Cb, err: EcB, opts: PositionOptions) {
    this.watchers.set(++this.n, { ok, err, opts });
    return this.n;
  }
  clearWatch(id: number) {
    this.watchers.delete(id);
    this.cleared.push(id);
  }
}
class FakePerm {
  onchange: (() => void) | null = null;
  constructor(public state: string) {}
  set(state: string) {
    this.state = state;
    this.onchange?.();
  }
}
const pos = (lat: number, lng: number, accuracy = 20): GeolocationPosition =>
  ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: Date.now() }) as GeolocationPosition;
const perr = (code: number): GeolocationPositionError =>
  ({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" }) as GeolocationPositionError;
const tick = () => new Promise((r) => setTimeout(r, 5));

interface Env {
  env: GeoEnv;
  geo: FakeGeo;
  perm: FakePerm | null;
  doc: { hidden: boolean; fire: () => void };
  nav: Record<string, unknown>;
}
function setup(opts: { permission?: string | null; secure?: boolean; geolocation?: boolean; throwOnQuery?: boolean; online?: boolean } = {}): Env {
  const geo = new FakeGeo();
  const perm = opts.permission === null ? null : new FakePerm(opts.permission ?? "prompt");
  const listeners = new Set<() => void>();
  const doc = {
    hidden: false,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    fire: () => listeners.forEach((l) => l()),
  };
  const nav: Record<string, unknown> = {
    onLine: opts.online ?? true,
    permissions: opts.throwOnQuery
      ? { query: async () => { throw new TypeError("unsupported"); } }
      : perm
        ? { query: async () => perm }
        : undefined,
  };
  if (opts.geolocation !== false) nav.geolocation = geo;
  const env: GeoEnv = { nav: nav as GeoEnv["nav"], doc: doc as unknown as GeoEnv["doc"], isSecureContext: opts.secure ?? true };
  return { geo, perm, doc, nav, env };
}

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n`, e);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("LocationController");

  await test("permission granted: starts silently, high-accuracy first fix, then a watch with the spec options", async () => {
    const { env, geo } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    assert.equal(c.getSnapshot().status, "granted");
    assert.equal(geo.calls.length, 1);
    assert.deepEqual(geo.calls[0].opts, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
    geo.calls[0].ok(pos(22.57, 88.36, 12.4));
    const s = c.getSnapshot();
    assert.deepEqual(s.coords, { lat: 22.57, lng: 88.36 });
    assert.equal(s.accuracy, 12);
    assert.ok(s.lastUpdated);
    assert.equal(geo.watchers.size, 1);
    assert.deepEqual([...geo.watchers.values()][0].opts, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
    c.stop();
  });

  await test("permission prompt: status 'prompting' and the browser popup is requested right away", async () => {
    const { env, geo } = setup({ permission: "prompt" });
    const c = new LocationController(env);
    await c.start();
    assert.equal(c.getSnapshot().status, "prompting");
    assert.equal(geo.calls.length, 1, "getCurrentPosition called without waiting for a tap");
    c.stop();
  });

  await test("user taps Allow: no duplicate request, fix arrives", async () => {
    const { env, geo, perm } = setup({ permission: "prompt" });
    const c = new LocationController(env);
    await c.start();
    perm!.set("granted");
    await tick();
    assert.equal(geo.calls.length, 1, "the pending request is reused");
    assert.equal(c.getSnapshot().status, "granted");
    geo.calls[0].ok(pos(22.57, 88.36));
    assert.ok(c.getSnapshot().coords);
    c.stop();
  });

  await test("user taps Block: 'denied' / permission_denied, API is not called again", async () => {
    const { env, geo, perm } = setup({ permission: "prompt" });
    const c = new LocationController(env);
    await c.start();
    perm!.state = "denied";
    geo.calls[0].err(perr(1));
    await tick();
    const s = c.getSnapshot();
    assert.equal(s.status, "denied");
    assert.equal(s.error?.code, "permission_denied");
    assert.equal(geo.calls.length, 1);
    assert.equal(c.request(), "blocked");
    assert.equal(geo.calls.length, 1, "request() does not hit the API while blocked");
    c.stop();
  });

  await test("user closes the prompt: reported as 'dismissed' (permission still 'prompt'), and Use my location can ask again", async () => {
    const { env, geo } = setup({ permission: "prompt" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].err(perr(1)); // Chrome reports a dismissed prompt as PERMISSION_DENIED
    await tick();
    assert.equal(c.getSnapshot().status, "denied");
    assert.equal(c.getSnapshot().error?.code, "dismissed");
    assert.equal(c.request(), "started");
    assert.equal(geo.calls.length, 2);
    c.stop();
  });

  await test("already denied on load: no API call, status 'denied'", async () => {
    const { env, geo } = setup({ permission: "denied" });
    const c = new LocationController(env);
    await c.start();
    assert.equal(c.getSnapshot().status, "denied");
    assert.equal(c.getSnapshot().error?.code, "permission_denied");
    assert.equal(geo.calls.length, 0);
    c.stop();
  });

  await test("denied -> allowed in settings without reloading: reacts to permissionStatus.onchange", async () => {
    const { env, geo, perm } = setup({ permission: "denied" });
    const c = new LocationController(env);
    await c.start();
    perm!.set("granted");
    await tick();
    assert.equal(c.getSnapshot().status, "granted");
    assert.equal(geo.calls.length, 1);
    geo.calls[0].ok(pos(22.58, 88.37));
    assert.deepEqual(c.getSnapshot().coords, { lat: 22.58, lng: 88.37 });
    c.stop();
  });

  await test("allowed -> blocked while the app is open: coordinates dropped, watch cleared", async () => {
    const { env, geo, perm } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].ok(pos(22.57, 88.36));
    assert.equal(geo.watchers.size, 1);
    perm!.set("denied");
    await tick();
    const s = c.getSnapshot();
    assert.equal(s.status, "denied");
    assert.equal(s.coords, null);
    assert.equal(geo.watchers.size, 0);
    c.stop();
  });

  await test("returning to the tab re-checks the permission (user fixed it in system settings)", async () => {
    const { env, geo, perm, doc } = setup({ permission: "denied" });
    const c = new LocationController(env);
    await c.start();
    perm!.state = "granted"; // changed silently, no event
    doc.hidden = false;
    doc.fire();
    await tick();
    await tick();
    assert.equal(c.getSnapshot().status, "granted");
    assert.equal(geo.calls.length, 1);
    c.stop();
  });

  await test("slow GPS: TIMEOUT retries once with enableHighAccuracy:false, and a coarse fix is accepted", async () => {
    const { env, geo } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].err(perr(3));
    assert.equal(geo.calls.length, 2);
    assert.equal(geo.calls[1].opts.enableHighAccuracy, false);
    assert.equal(c.getSnapshot().status, "granted", "still waiting, no error shown yet");
    geo.calls[1].ok(pos(22.57, 88.36, 900));
    assert.equal(c.getSnapshot().accuracy, 900);
    c.stop();
  });

  await test("slow GPS: two timeouts in a row end as status 'error' / timeout (only one retry)", async () => {
    const { env, geo } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].err(perr(3));
    geo.calls[1].err(perr(3));
    await tick();
    assert.equal(geo.calls.length, 2);
    assert.equal(c.getSnapshot().status, "error");
    assert.equal(c.getSnapshot().error?.code, "timeout");
    c.stop();
  });

  await test("POSITION_UNAVAILABLE while offline is flagged so the UI can say so", async () => {
    const { env, geo } = setup({ permission: "granted", online: false });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].err(perr(2));
    await tick();
    assert.equal(c.getSnapshot().status, "unavailable");
    assert.equal(c.getSnapshot().error?.code, "position_unavailable");
    assert.equal(c.getSnapshot().error?.offline, true);
    c.stop();
  });

  await test("watch hiccups after a good fix keep the last position", async () => {
    const { env, geo } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].ok(pos(22.57, 88.36));
    [...geo.watchers.values()][0].err(perr(3));
    await tick();
    assert.equal(c.getSnapshot().status, "granted");
    assert.ok(c.getSnapshot().coords);
    c.stop();
  });

  await test("throttle: jitter ignored, 20 m move or 5 s + real movement accepted", async () => {
    const t0 = 1_000_000;
    const base: Fix = { lat: 22.57, lng: 88.36, accuracy: 20, time: t0 };
    assert.equal(shouldEmitFix(null, base), true);
    assert.equal(shouldEmitFix(base, { ...base, time: t0 + 1000 }), false, "1 s later, same spot");
    assert.equal(shouldEmitFix(base, { ...base, time: t0 + 6000 }), false, "5 s later but standing still");
    assert.equal(shouldEmitFix(base, { ...base, lat: 22.57 + 0.00023, time: t0 + 1000 }), true, "about 25 m: immediately");
    assert.equal(shouldEmitFix(base, { ...base, lat: 22.57 + 0.00008, time: t0 + 1000 }), false, "about 9 m after 1 s: wait");
    assert.equal(shouldEmitFix(base, { ...base, lat: 22.57 + 0.00008, time: t0 + 5200 }), true, "about 9 m after 5 s: update");
    assert.equal(shouldEmitFix(base, { ...base, accuracy: 60, time: t0 + 5200 }), true, "accuracy changed a lot");
  });

  await test("throttle through the controller: tiny watch updates do not change the snapshot", async () => {
    const { env, geo } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].ok(pos(22.57, 88.36));
    const before = c.getSnapshot();
    [...geo.watchers.values()][0].ok(pos(22.570001, 88.360001));
    assert.equal(c.getSnapshot(), before);
    [...geo.watchers.values()][0].ok(pos(22.5703, 88.36)); // ~33 m
    assert.notEqual(c.getSnapshot(), before);
    c.stop();
  });

  await test("tab hidden clears the watch, visible resumes it", async () => {
    const { env, geo, doc } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].ok(pos(22.57, 88.36));
    assert.equal(geo.watchers.size, 1);
    doc.hidden = true;
    doc.fire();
    assert.equal(geo.watchers.size, 0);
    doc.hidden = false;
    doc.fire();
    await tick();
    await tick();
    assert.equal(geo.watchers.size, 1);
    c.stop();
  });

  await test("stop() (unmount) clears the watch, ignores late callbacks and removes listeners", async () => {
    const { env, geo, doc } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].ok(pos(22.57, 88.36));
    c.stop();
    assert.equal(geo.watchers.size, 0);
    const snap = c.getSnapshot();
    geo.calls[0].ok(pos(22.6, 88.4));
    assert.equal(c.getSnapshot(), snap);
    doc.hidden = false;
    doc.fire(); // no listener left, must not throw or restart a watch
    await tick();
    assert.equal(geo.watchers.size, 0);
  });

  await test("older Safari (no Permissions API / query throws): still asks, and a denial is treated as blocked", async () => {
    for (const o of [{ permission: null }, { throwOnQuery: true }]) {
      const { env, geo } = setup(o);
      const c = new LocationController(env);
      await c.start();
      assert.equal(c.getSnapshot().permission, "unknown");
      assert.equal(c.getSnapshot().status, "prompting");
      assert.equal(geo.calls.length, 1);
      geo.calls[0].err(perr(1));
      await tick();
      assert.equal(c.getSnapshot().error?.code, "permission_denied");
      c.stop();
    }
  });

  await test("no geolocation API / insecure page: 'unavailable' with a clear code, no API call", async () => {
    let t = setup({ geolocation: false });
    let c = new LocationController(t.env);
    await c.start();
    assert.equal(c.getSnapshot().status, "unavailable");
    assert.equal(c.getSnapshot().error?.code, "unsupported");
    t = setup({ secure: false });
    c = new LocationController(t.env);
    await c.start();
    assert.equal(c.getSnapshot().error?.code, "insecure_context");
    assert.equal(t.geo.calls.length, 0);
    c.stop();
  });

  await test(`stalled prompt (>${GESTURE_STALL_MS} ms, iOS-style): needsGesture turns on; a tap re-asks`, async () => {
    const { env, geo } = setup({ permission: "prompt" });
    const c = new LocationController(env);
    await c.start();
    assert.equal(c.getSnapshot().needsGesture, false);
    await new Promise((r) => setTimeout(r, GESTURE_STALL_MS + 200));
    assert.equal(c.getSnapshot().needsGesture, true);
    c.request();
    assert.equal(geo.calls.length, 2);
    assert.equal(c.getSnapshot().needsGesture, false);
    c.stop();
  });

  await test("a fresh request() after a fix keeps exactly one watch", async () => {
    const { env, geo } = setup({ permission: "granted" });
    const c = new LocationController(env);
    await c.start();
    geo.calls[0].ok(pos(22.57, 88.36));
    c.request();
    geo.calls[1].ok(pos(22.571, 88.361));
    assert.equal(geo.watchers.size, 1);
    c.stop();
  });

  console.log("detectEnvironment");
  await test("in-app browsers and platforms", async () => {
    const wa = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 WhatsApp/2.23";
    const ig = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0";
    const fb = "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/118 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/430.0]";
    const chrome = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
    const desktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
    assert.deepEqual(detectEnvironment(wa), { inApp: "whatsapp", platform: "android" });
    assert.deepEqual(detectEnvironment(ig), { inApp: "instagram", platform: "ios" });
    assert.deepEqual(detectEnvironment(fb), { inApp: "facebook", platform: "android" });
    assert.deepEqual(detectEnvironment(chrome), { inApp: null, platform: "android" });
    assert.deepEqual(detectEnvironment(safari), { inApp: null, platform: "ios" });
    assert.deepEqual(detectEnvironment(desktop), { inApp: null, platform: "desktop" });
    assert.equal(detectEnvironment(desktop, 5).platform, "ios", "iPadOS reports a Mac UA but has touch");
  });

  console.log(`\n${passed} passed${process.exitCode ? ", with failures" : ""}`);
}
void main();
