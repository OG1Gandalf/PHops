/**
 * Black-box tests for the API routes. Run against a server that uses the in-memory store, i.e. `npm run dev`
 * (production without Supabase env vars answers 503 by design - see the 503 test below, run with EXPECT_503=1).
 *
 *   npm run dev -- -p 3100        # terminal 1
 *   npm run test:api              # terminal 2   (BASE=http://localhost:3100 by default)
 *
 * Every run uses fresh device ids and a fresh pandal pair, but the in-process rate limiter is per server process:
 * restart the dev server if you run this more than a couple of times in a row.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const EXPECT_503 = process.env.EXPECT_503 === "1";
const pandals = JSON.parse(readFileSync(new URL("../data/pandals.json", import.meta.url), "utf8")) as { id: string }[];
const [P1, P2, P3] = [pandals[3].id, pandals[4].id, pandals[5].id];

let failed = 0;
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${(e as Error).message.split("\n").slice(0, 4).join("\n      ")}`);
  }
}

const device = () => randomUUID();
type Res = { status: number; body: unknown; raw: string; headers: Headers };
async function call(method: string, path: string, opts: { body?: unknown; raw?: string; device?: string; ip?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined || opts.raw !== undefined) headers["content-type"] = "application/json";
  if (opts.device) headers["x-device-id"] = opts.device;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    redirect: "manual",
  });
  const raw = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body, raw, headers: res.headers };
}
const b = (r: Res) => r.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Responses must never leak internals. */
const clean = (r: Res) => {
  assert.ok(!/node_modules|\bat\s+\S+\s+\(|stack|ECONN|supabase\.co|SUPABASE|at Object\./i.test(r.raw), `leaky body: ${r.raw.slice(0, 200)}`);
};

async function main() {
  console.log(`API tests against ${BASE}\n`);

  if (EXPECT_503) {
    await test("without Supabase env in production every data route answers 503 not_configured", async () => {
      for (const [m, p, body] of [
        ["GET", "/api/crowd", undefined],
        ["GET", `/api/comments?pandalId=${P1}`, undefined],
        ["POST", "/api/crowd", { pandalId: P1, level: "low" }],
        ["POST", "/api/comments", { pandalId: P1, text: "hello there" }],
      ] as const) {
        const r = await call(m, p, { body });
        assert.equal(r.status, 503, `${m} ${p}`);
        assert.equal(b(r).code, "not_configured");
        clean(r);
      }
    });
    return;
  }

  // ---------------------------------------------------------------- crowd
  console.log("crowd");
  await test("GET /api/crowd -> 200 with an aggregates array and a short CDN cache", async () => {
    const r = await call("GET", "/api/crowd");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(b(r).aggregates));
    assert.match(r.headers.get("cache-control") ?? "", /s-maxage=20/);
  });

  await test("POST /api/crowd rejects bad input with 400 and no internals", async () => {
    const d = device();
    const cases: Res[] = [
      await call("POST", "/api/crowd", { body: { pandalId: "nope", level: "low" }, device: d }),
      await call("POST", "/api/crowd", { body: { pandalId: P1, level: "extreme" }, device: d }),
      await call("POST", "/api/crowd", { body: { pandalId: P1 }, device: d }),
      await call("POST", "/api/crowd", { body: { pandalId: { $ne: "" }, level: "low" }, device: d }),
      await call("POST", "/api/crowd", { body: [1, 2], device: d }),
      await call("POST", "/api/crowd", { raw: "{not json", device: d }),
      await call("POST", "/api/crowd", { raw: JSON.stringify({ pandalId: P1, level: "low", pad: "x".repeat(5000) }), device: d }),
      await call("POST", "/api/crowd", { raw: "", device: d }),
    ];
    cases.forEach((r, i) => {
      assert.equal(r.status, 400, `case ${i} -> ${r.status} ${r.raw.slice(0, 80)}`);
      assert.equal(b(r).code, "invalid");
      clean(r);
    });
  });

  await test("a valid report is stored (201), the same device is on cooldown (429) for that pandal only", async () => {
    const d = device();
    const first = await call("POST", "/api/crowd", { body: { pandalId: P1, level: "high" }, device: d });
    assert.equal(first.status, 201, first.raw);
    assert.equal(b(first).ok, true);
    const again = await call("POST", "/api/crowd", { body: { pandalId: P1, level: "low" }, device: d });
    assert.equal(again.status, 429);
    assert.equal(b(again).code, "cooldown");
    assert.ok(b(again).retryAfterMinutes >= 1 && b(again).retryAfterMinutes <= 10);
    const other = await call("POST", "/api/crowd", { body: { pandalId: P2, level: "low" }, device: d });
    assert.equal(other.status, 201, "a different pandal is not on cooldown");
  });

  await test("aggregates: majority wins, one vote per device, counts are reported", async () => {
    const [d1, d2, d3] = [device(), device(), device()];
    await call("POST", "/api/crowd", { body: { pandalId: P3, level: "medium" }, device: d1 });
    await call("POST", "/api/crowd", { body: { pandalId: P3, level: "medium" }, device: d2 });
    await call("POST", "/api/crowd", { body: { pandalId: P3, level: "high" }, device: d3 });
    const r = await call("GET", "/api/crowd");
    const agg = (b(r).aggregates as { pandalId: string; level: string; count: number }[]).find((a) => a.pandalId === P3);
    assert.ok(agg, "aggregate exists");
    assert.equal(agg.level, "medium");
    assert.equal(agg.count, 3);
  });

  await test("a rotated device id from the same network cannot stuff the ballot for one pandal (429 after 25)", async () => {
    const ip = `203.0.113.${1 + Math.floor(Math.random() * 250)}`;
    const target = pandals[10].id;
    let last = 0;
    for (let i = 0; i < 27; i++) {
      last = (await call("POST", "/api/crowd", { body: { pandalId: target, level: "high" }, device: device(), ip })).status;
    }
    assert.equal(last, 429);
  });

  await test("unsupported methods answer 405, unknown routes 404", async () => {
    assert.equal((await call("DELETE", "/api/crowd")).status, 405);
    assert.equal((await call("PUT", "/api/comments", { body: {} })).status, 405);
    assert.equal((await call("GET", "/api/admin")).status, 404);
    assert.equal((await call("GET", "/api/crowd/../../etc/passwd")).status === 200, false);
  });

  // ---------------------------------------------------------------- comments
  console.log("comments");
  await test("GET /api/comments validates pandalId and cursor", async () => {
    assert.equal((await call("GET", "/api/comments")).status, 400);
    assert.equal((await call("GET", "/api/comments?pandalId=nope")).status, 400);
    assert.equal((await call("GET", `/api/comments?pandalId=${encodeURIComponent("' OR 1=1 --")}`)).status, 400);
    assert.equal((await call("GET", `/api/comments?pandalId=${P1}&cursor=garbage`)).status, 400);
    const ok = await call("GET", `/api/comments?pandalId=${P1}&limit=9999`);
    assert.equal(ok.status, 200);
    assert.ok((b(ok).comments as unknown[]).length <= 20, "limit is capped");
  });

  await test("POST /api/comments rejects malformed bodies (400) and bad content (422)", async () => {
    const d = device();
    assert.equal((await call("POST", "/api/comments", { raw: "nope", device: d })).status, 400);
    assert.equal((await call("POST", "/api/comments", { body: { pandalId: "nope", text: "hello there" }, device: d })).status, 400);
    assert.equal((await call("POST", "/api/comments", { body: { pandalId: P1, text: 42 }, device: d })).status, 400);
    const empty = await call("POST", "/api/comments", { body: { pandalId: P1, text: "   " }, device: d });
    assert.equal(empty.status, 422);
    const long = await call("POST", "/api/comments", { body: { pandalId: P1, text: "abcdefghij".repeat(31) }, device: d });
    assert.equal(long.status, 422);
    assert.equal(b(long).code, "too_long");
    const link = await call("POST", "/api/comments", { body: { pandalId: P1, text: "visit www.example.com now" }, device: d });
    assert.equal(link.status, 422);
    assert.equal(b(link).code, "link");
    const phone = await call("POST", "/api/comments", { body: { pandalId: P1, text: "call me on 98300 12345 please" }, device: d });
    assert.equal(phone.status, 422);
    for (const r of [empty, long, link, phone]) clean(r);
  });

  await test("a clean comment is stored (201), XSS and markup are neutralised, name defaults to Visitor", async () => {
    const d = device();
    const r = await call("POST", "/api/comments", {
      body: { pandalId: P2, name: `<img src=x onerror=alert(1)>Rimi`, text: `<script>alert(1)</script>Lovely lighting &lt;b&gt; <b>bold</b> ok` },
      device: d,
    });
    assert.equal(r.status, 201, r.raw);
    const c = b(r).comment;
    for (const field of [c.text, c.name]) assert.ok(!/[<>]/.test(field), `markup left in ${JSON.stringify(field)}`);
    assert.ok(!("device_hash" in c), "device hash is never returned");
    assert.match(c.text, /Lovely lighting/);
    const anon = await call("POST", "/api/comments", { body: { pandalId: P2, text: "Great crowd management today" }, device: d });
    assert.equal(anon.status, 201);
    assert.equal(b(anon).comment.name, "Visitor");
  });

  await test("comments list: newest first, hidden fields absent, paging with a cursor", async () => {
    const pid = pandals[20].id;
    for (let i = 0; i < 3; i++) {
      const r = await call("POST", "/api/comments", { body: { pandalId: pid, text: `Visit number ${i} was wonderful` }, device: device(), ip: `198.51.100.${10 + i}` });
      assert.equal(r.status, 201, r.raw);
      await new Promise((res) => setTimeout(res, 15));
    }
    const page1 = await call("GET", `/api/comments?pandalId=${pid}&limit=2`);
    assert.equal(page1.status, 200);
    const list1 = b(page1).comments as { text: string; created_at: string }[];
    assert.equal(list1.length, 2);
    assert.match(list1[0].text, /number 2/);
    assert.ok(Date.parse(list1[0].created_at) >= Date.parse(list1[1].created_at));
    assert.ok(b(page1).nextCursor, "there is another page");
    const page2 = await call("GET", `/api/comments?pandalId=${pid}&limit=2&cursor=${encodeURIComponent(b(page1).nextCursor)}`);
    const list2 = b(page2).comments as { text: string }[];
    assert.equal(list2.length, 1);
    assert.match(list2[0].text, /number 0/);
    assert.equal(b(page2).nextCursor ?? null, null);
    for (const c of [...list1, ...list2]) assert.ok(!("device_hash" in c) && !("hidden" in c));
  });

  await test("duplicate text from one device is 409; the 4th comment within an hour is 429", async () => {
    const d = device();
    const pid = pandals[30].id;
    const post = (text: string) => call("POST", "/api/comments", { body: { pandalId: pid, text }, device: d });
    assert.equal((await post("Beautiful idol this year")).status, 201);
    assert.equal((await post("Beautiful idol this year")).status, 409);
    assert.equal((await post("Very peaceful in the morning")).status, 201);
    assert.equal((await post("Queue moved quickly for us")).status, 201);
    const fourth = await post("One more thing about the bhog");
    assert.equal(fourth.status, 429);
    clean(fourth);
  });

  await test("reporting a comment: 400 for a bad id, 404 for an unknown one, once per network, hides after 3 (store rule)", async () => {
    assert.equal((await call("POST", "/api/comments/not-a-uuid/report", { device: device() })).status, 400);
    assert.equal((await call("POST", `/api/comments/${randomUUID()}/report`, { device: device() })).status, 404);
    const pid = pandals[40].id;
    const posted = await call("POST", "/api/comments", { body: { pandalId: pid, text: "Please report this one" }, device: device() });
    const id = b(posted).comment.id as string;
    const r1 = await call("POST", `/api/comments/${id}/report`, { device: device(), ip: "192.0.2.50" });
    assert.equal(r1.status, 200);
    assert.equal(b(r1).hidden, false);
    const r2 = await call("POST", `/api/comments/${id}/report`, { device: device(), ip: "192.0.2.50" });
    assert.equal(r2.status, 429, "same network cannot report the same comment twice in an hour");
    const r3 = await call("POST", `/api/comments/${id}/report`, { device: device(), ip: "192.0.2.51" });
    const r4 = await call("POST", `/api/comments/${id}/report`, { device: device(), ip: "192.0.2.52" });
    assert.equal(b(r3).hidden, false);
    assert.equal(b(r4).hidden, true, "third distinct reporter hides it");
    const list = await call("GET", `/api/comments?pandalId=${pid}`);
    assert.ok(!(b(list).comments as { id: string }[]).some((c) => c.id === id), "hidden comment no longer listed");
  });

  console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ""}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
