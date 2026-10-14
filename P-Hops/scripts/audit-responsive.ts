/**
 * Responsive sweep: every page x {320, 375, 414, 768, 1280} px, light and dark.
 * Reports horizontal scroll, interactive elements smaller than 44x44 CSS px, and unlabelled controls.
 * Needs Google Chrome (CHROME_PATH to override) and a running server:   BASE=http://localhost:3200 npm run audit:responsive
 * Screenshots go to reports/screens/.
 */
import { mkdirSync } from "node:fs";

import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3200";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = ["/", "/pandals", "/eateries", "/events", "/parking", "/restrooms", "/near-me", "/more", "/bn", "/bn/pandals", "/does-not-exist"];
const WIDTHS = [320, 375, 414, 768, 1280];
const MIN = 44;
const SHOTS = process.env.SHOTS === "1";

type Finding = { page: string; width: number; scheme: string; kind: string; detail: string };

async function main() {
  mkdirSync("reports/screens", { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const findings: Finding[] = [];
  for (const scheme of ["light", "dark"] as const) {
    for (const width of WIDTHS) {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument('window.__name = (f) => f;'); // tsx/esbuild injects __name into evaluate() callbacks
      const mobile = width < 800;
      await page.setViewport({ width, height: mobile ? 740 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      for (const path of PAGES) {
        const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null);
        await new Promise((r) => setTimeout(r, 2200));
        // dismiss the automatic location card so it does not hide the page under test
        const result = await page.evaluate((MIN: number) => {
          const vis = (e: Element) => {
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && r.bottom > 0 && r.right > 0 && r.top < innerHeight * 3;
          };
          const name = (e: Element) =>
            (e.getAttribute("aria-label") || e.getAttribute("title") || (e.textContent ?? "").replace(/\s+/g, " ") || e.getAttribute("alt") || "").trim().slice(0, 40);
          // compare with clientWidth: in mobile emulation innerWidth silently grows to fit overflowing content
          const hscroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          const small: string[] = [];
          const unlabelled: string[] = [];
          for (const e of document.querySelectorAll("a[href], button, input, select, textarea, [role=button], [role=radio], [role=tab], [tabindex='0']")) {
            if (!vis(e)) continue;
            if (e.closest(".leaflet-control-attribution")) continue; // OSM-mandated attribution link
            if (e.closest("[data-nextjs-toast], nextjs-portal")) continue; // dev overlay
            const r = e.getBoundingClientRect();
            if (e.matches("a.sr-only, a[href='#main']") || r.left < -50) continue; // skip link lives offscreen until focused
            // inline text links inside a paragraph are exempt (WCAG 2.5.8)
            const inline = e.tagName === "A" && getComputedStyle(e).display === "inline" && e.closest("p, li");
            if (!inline && (r.width < MIN - 0.5 || r.height < MIN - 0.5)) small.push(`${e.tagName.toLowerCase()}[${name(e)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
            const labelled = name(e) || e.getAttribute("aria-labelledby") || (e as HTMLInputElement).labels?.length;
            if (!labelled) unlabelled.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`);
          }
          return { hscroll, small, unlabelled, h1: document.querySelectorAll("h1").length, title: document.title };
        }, MIN);
        const tag = { page: path, width, scheme };
        if (res && res.status() >= 500) findings.push({ ...tag, kind: "http", detail: String(res.status()) });
        if (result.hscroll > 1) findings.push({ ...tag, kind: "hscroll", detail: `${result.hscroll}px` });
        for (const s of [...new Set(result.small)]) findings.push({ ...tag, kind: "tap<44", detail: s });
        for (const u of [...new Set(result.unlabelled)]) findings.push({ ...tag, kind: "unlabelled", detail: u });
        if (result.h1 !== 1 && path !== "/does-not-exist") findings.push({ ...tag, kind: "h1", detail: `${result.h1} h1 elements` });
        if (SHOTS && (width === 375 || width === 1280) && scheme === "light") {
          await page.screenshot({ path: `reports/screens/${path.replace(/\W+/g, "_") || "home"}-${width}.png` });
        }
      }
      await page.close();
    }
  }
  await browser.close();

  // collapse identical findings across widths/schemes
  const grouped = new Map<string, { f: Finding; widths: Set<number>; schemes: Set<string> }>();
  for (const f of findings) {
    const key = `${f.page}|${f.kind}|${f.detail}`;
    const g = grouped.get(key) ?? { f, widths: new Set(), schemes: new Set() };
    g.widths.add(f.width);
    g.schemes.add(f.scheme);
    grouped.set(key, g);
  }
  for (const { f, widths, schemes } of grouped.values()) {
    console.log(`${f.kind.padEnd(10)} ${f.page.padEnd(14)} ${f.detail}   @${[...widths].join("/")} ${[...schemes].join("+")}`);
  }
  console.log(`\n${grouped.size} distinct findings (${PAGES.length} pages x ${WIDTHS.length} widths x 2 schemes)`);
  if (grouped.size) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
