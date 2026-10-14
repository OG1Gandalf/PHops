/**
 * axe-core (WCAG 2.x A/AA + best practices) on every page, English and Bengali, light and dark, at phone width.
 * Colour contrast is checked in BOTH themes (Lighthouse only sees the default one).
 * axe-core ships with lighthouse, so there is nothing extra to install.
 *
 * Needs a server:   BASE=http://localhost:3200 npm run audit:a11y
 * Plain .mjs on purpose (tsx/esbuild helpers break code that is injected into the page).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import puppeteer from "puppeteer-core";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3200";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = ["/", "/pandals", "/eateries", "/events", "/parking", "/restrooms", "/near-me", "/more", "/bn", "/bn/pandals", "/bn/events"];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const found = new Map();
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await new Promise((r) => setTimeout(r, 2200));
    await page.evaluate(AXE);
    const result = await page.evaluate(async () => {
      const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
      return {
        dark: document.documentElement.classList.contains("dark"),
        violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary || "").split("\n").slice(1, 3).join(" ").slice(0, 160) })), count: v.nodes.length })),
      };
    });
    if (scheme === "dark" && !result.dark) console.log(`  (!) ${path}: dark scheme requested but the page did not switch to dark`);
    for (const v of result.violations) {
      const key = `${v.id}|${path}`;
      const e = found.get(key) ?? { ...v, path, schemes: new Set() };
      e.schemes.add(scheme);
      found.set(key, e);
    }
  }
  await page.close();
}
await browser.close();

for (const e of found.values()) {
  console.log(`${String(e.impact).padEnd(9)} ${e.id.padEnd(22)} ${e.path.padEnd(12)} ${[...e.schemes].join("+").padEnd(10)} x${e.count}  ${e.help}`);
  for (const n of e.nodes) console.log(`            ${n.target.slice(0, 90)} :: ${n.summary}`);
}
console.log(`\n${found.size} distinct violation(s) across ${PAGES.length} pages x light/dark`);
process.exit(found.size ? 1 : 0);
