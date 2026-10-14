/**
 * Lighthouse, mobile preset (Moto G Power, simulated Slow 4G, 4x CPU slowdown = "low-end phone on a bad network").
 * Plain .mjs on purpose: tsx/esbuild injects helpers that break inside Lighthouse's in-browser code.
 *
 * Needs a PRODUCTION server:   npm run build && PORT=3200 npm run start
 * then:                        BASE=http://localhost:3200 npm run audit:lighthouse
 * Optional: PAGES=/,/pandals   RUNS=3 (median of N)   CHROME_PATH=...
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.env.BASE ?? "http://localhost:3200";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = (process.env.PAGES ?? "/,/pandals,/eateries,/events,/bn,/near-me").split(",");
const RUNS = Number(process.env.RUNS ?? 1);
const CATS = ["performance", "accessibility", "best-practices", "seo"];

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

mkdirSync("reports/lighthouse", { recursive: true });
const chrome = await launch({ chromePath: CHROME, chromeFlags: ["--headless=new", "--no-sandbox"] });
const rows = [];
try {
  for (const path of PAGES) {
    const scores = Object.fromEntries(CATS.map((c) => [c, []]));
    const metrics = { FCP: [], LCP: [], TBT: [], CLS: [], SI: [] };
    let lastLhr;
    for (let i = 0; i < RUNS; i++) {
      const r = await lighthouse(BASE + path, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: CATS });
      if (!r) throw new Error("no result for " + path);
      lastLhr = r.lhr;
      for (const c of CATS) scores[c].push(Math.round((lastLhr.categories[c].score ?? 0) * 100));
      const a = lastLhr.audits;
      metrics.FCP.push(a["first-contentful-paint"].numericValue);
      metrics.LCP.push(a["largest-contentful-paint"].numericValue);
      metrics.TBT.push(a["total-blocking-time"].numericValue);
      metrics.CLS.push(a["cumulative-layout-shift"].numericValue);
      metrics.SI.push(a["speed-index"].numericValue);
    }
    writeFileSync(`reports/lighthouse/${path.replace(/\W+/g, "_") || "home"}.json`, JSON.stringify(lastLhr));
    const s = Object.fromEntries(CATS.map((c) => [c, median(scores[c])]));
    rows.push(
      `${path.padEnd(11)} perf ${s.performance} a11y ${s.accessibility} bp ${s["best-practices"]} seo ${s.seo} | FCP ${(median(metrics.FCP) / 1000).toFixed(1)}s LCP ${(median(metrics.LCP) / 1000).toFixed(1)}s TBT ${Math.round(median(metrics.TBT))}ms CLS ${median(metrics.CLS).toFixed(3)} SI ${(median(metrics.SI) / 1000).toFixed(1)}s`,
    );
    console.log(rows.at(-1));
    // everything that scored below 0.9, worst first
    const bad = Object.values(lastLhr.audits)
      .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual")
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);
    for (const a of bad) console.log(`    - ${a.id} (${Math.round(a.score * 100)}): ${a.title}${a.displayValue ? ` [${a.displayValue}]` : ""}`);
  }
} finally {
  await chrome.kill();
}
writeFileSync("reports/lighthouse/summary.txt", rows.join("\n") + "\n");
