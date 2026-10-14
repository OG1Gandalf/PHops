# Kolkata Pujo Guide

A mobile-first, weak-network-friendly pandal-hopping guide for Kolkata's Durga Puja: map with toggleable layers
(pandals, restrooms, parking, eateries, events), crowd levels from estimates + visitor reports, comments,
"near me", and English / Bengali.

> **Unofficial.** Everything here is built from open data and visitor input. No record is verified yet
> (`verified: false` everywhere). Read [Spot-check before launch](#spot-check-before-launch).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind v4 · Leaflet + react-leaflet + leaflet.markercluster (OSM tiles) ·
next-intl (en default, bn) · Supabase (comments + crowd reports) · static JSON in `/data` · deploys on Vercel.

> Next.js 16 differs from older versions (`cacheComponents`, `proxy.ts` instead of `middleware.ts`, async `params`).
> `AGENTS.md` points at the bundled docs in `node_modules/next/dist/docs/` – read them before changing routing/caching code.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional for local dev, see below
npm run dev                    # http://localhost:3000   (Bengali: /bn)
```

**Without Supabase credentials** the app still runs in development: crowd reports and comments use an
**in-memory store** (lost on restart) so you can try every flow offline. In **production** without credentials the
API answers `503 not_configured` and the UI says reports/comments are unavailable (the rest of the site keeps
working with estimates).

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm run i18n:check` | Fails if `messages/bn.json` and `messages/en.json` keys differ |
| `npm run test:logic` | Unit tests: Haversine, IST time slots, crowd voting rules, rate limiter, moderation, opening hours, search, directions |
| `npm run test:location` | Geolocation flow scenarios against a mock environment |
| `npm run test:api` | Black-box API tests (validation, XSS, cooldown, rate limits, paging). Needs `npm run dev -- -p 3100` (in-memory store) |
| `npm run data:validate` | Zod validation of every `/data` file + duplicates, bounds, river check, identical coordinates. `-- --report` writes `reports/unverified-records.csv` |
| `npm run audit:responsive` · `npm run audit:lighthouse` | Browser sweeps (320–1280 px, light/dark; Lighthouse mobile). Need Chrome and a **production** server (`PORT=3200 npm start`) |
| `npm run data:osm` | Re-fetch restrooms / parking / eateries from OpenStreetMap (see [Data pipeline](#data-pipeline)) |
| `npm run data:tidy` | Re-apply the eatery clean-up to the existing JSON, offline |
| `npm run data:pandals` · `npm run data:areas` | Rebuild `pandals.json` / `areas.json` (Nominatim geocoding, cached) |

---

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query →** paste the whole of [`supabase/schema.sql`](supabase/schema.sql) → Run (safe to re-run).
   It creates `crowd_reports`, `comments`, `comment_reports`, the indexes, the RLS policies and the `report_comment` function.
3. **Project Settings → API** and copy the values into `.env.local` (and Vercel, see below):

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_ANON_KEY` | public key; used only for read queries, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret**, server only. Used by the API routes for writes. Never expose it or prefix it with `NEXT_PUBLIC_` |
| `DEVICE_HASH_SALT` | random string (`openssl rand -hex 32`); salts the hash of anonymous device ids |
| `NEXT_PUBLIC_SITE_URL` | canonical origin for SEO / Open Graph / sitemap, e.g. `https://pujo.example.com` (falls back to the Vercel production URL, then `VERCEL_URL`) |
| `SITE_NOINDEX` | optional. `true` keeps the whole site out of search engines (robots.txt disallow + `noindex` meta + empty sitemap). Vercel **preview** deployments are always noindex |

All variables are read on the server only, except `NEXT_PUBLIC_SITE_URL` (not secret). Missing Supabase variables are not fatal: the map,
all static data and crowd estimates keep working, and the crowd/comment panels show a gentle "unavailable" notice.

### Tables and security model

```
crowd_reports(id, pandal_id, level low|medium|high, created_at, device_hash)
comments(id, pandal_id, name, text<=300, created_at, reported_count, hidden, device_hash)
comment_reports(comment_id, device_hash)            -- one report per device per comment
```

* **Browsers never write to the database.** All inserts go through `app/api/**` route handlers that validate, moderate,
  rate-limit and then write with the service-role key.
* **RLS:** `anon` can only `select` **non-hidden comments**, and only the public columns
  (`device_hash` is not granted). There are **no insert/update/delete policies** for `anon`/`authenticated`, so those are denied.
  `crowd_reports` and `comment_reports` are not readable by `anon` at all; the API aggregates them.
* `report_comment()` (security definer, executable by `service_role` only) records a report once per device and
  auto-hides the comment at 3 reports.
* `device_hash = sha256(DEVICE_HASH_SALT + random id kept in the browser's localStorage)`. Raw IPs and device ids are never stored.
* Input is sanitised as plain text (tags, entities, control characters stripped) and rendered through React (escaped).

Optional housekeeping (in `schema.sql`, commented out): a `pg_cron` job that deletes `crowd_reports` older than 24 h.

---

## How crowd levels work

All logic is in [`lib/crowdService.ts`](lib/crowdService.ts) (pure functions shared by the API and the UI).

1. **Visitor reports:** majority vote of the reports from the **last 60 minutes**, needing **at least 2** reports; ties go to the
   most recent report among the tied levels. Shown as "Based on N reports, updated X min ago".
2. **Estimate:** otherwise `crowdByTimeSlot[slot]` from `data/pandals.json`, labelled **Estimated**.
3. Visitor reports describe "right now", so they only apply when the selected time slot is the **current** slot (Asia/Kolkata).
4. One report per pandal per device per **10 minutes** (checked in `localStorage` *and* against the database), plus IP/device
   rate limits. 3 comments per device per hour (database check).
5. **Plug in live traffic later:** call `registerCrowdProvider(...)` in `lib/crowdService.ts` (TomTom / Google Routes etc.).
   Nothing else in the app needs to change; the provider sits between visitor reports and estimates.

The UI states clearly: *"Crowd levels are estimates plus visitor reports, not official or live traffic data."*

> **The built-in estimates are editorial guesses** (a typical-pattern per pandal "tier" in `data/pandals.seed.json`,
> e.g. evenings busier than mornings). They are not measured data. Replace them when you have better information.

---

## Data pipeline

All data lives in `/data` and is read only through [`lib/data.ts`](lib/data.ts) (no hard-coded data in components).
Pandals and events are bundled; restrooms, parking and eateries are **lazy-loaded** chunks (weak networks only pay for them when needed).

| File | Source | How to update |
| --- | --- | --- |
| `pandals.seed.json` → `pandals.json` | 92 pandals compiled by hand from public 2026 listings; coordinates via Nominatim | edit the seed, run `npm run data:pandals` |
| `restrooms.json`, `parking.json`, `eateries.json` | OpenStreetMap via the Overpass API | `npm run data:osm` (or `… toilets` / `parking` / `eateries`) |
| `curated-eateries.json`, `curated-parking.json` | hand-curated famous Puja-time food spots / parking; merged into the OSM data (snapped to an OSM point when a similar name is within 400 m) | edit, then `npm run data:osm` |
| `events.json` | typical Puja events by day, **all marked `confirmed: false` ("to confirm")** | edit by hand |
| `areas.json` | landmark hubs for the manual "pick your area" fallback | `npm run data:areas` |

**Dates** (Shashthi–Dashami + Bhasan) live in one file: [`config/puja.ts`](config/puja.ts) (`PUJA_DAYS`). Events store only the
day name and derive the calendar date from it. When the dates are confirmed, edit them there and set `PUJA_DATES_APPROXIMATE = false`
(removes the "approximate" banner and labels).

`scripts/fetch-osm.ts` queries Overpass for `amenity=toilets`, `amenity=parking`, `amenity=restaurant|cafe|fast_food|food_court` and
`shop=confectionery` inside the Kolkata bounding box (`22.35,88.18,22.80,88.52`), tries three public Overpass mirrors, and drops unnamed
eateries, entries whose "name" has no letters (phone numbers tagged as names) and near-duplicates. The Overpass API is rate-limited: if a run
fails, wait a minute and use `npm run data:osm -- toilets` (or `parking` / `eateries`) to retry one dataset.

Current data (as shipped): 92 pandals · 64 restrooms · 48 parking · 650 eateries (20 hand-curated "famous" spots) · 23 events · 34 area hubs.

### Updating data: the steps

1. Edit the seed/curated file (or run `npm run data:osm` / `data:pandals` / `data:areas`).
2. `npm run data:validate`. Must print **0 errors**. It checks every record against zod schemas typed to `lib/types.ts`, duplicate ids and same-name
   neighbours, the Kolkata bounds, **points that fall in the Hooghly river** (OSM polygon, 50 m bank tolerance), identical-coordinate clusters, event to pandal
   links and event times. Warnings are worth a look but do not fail the run.
3. `npm run data:validate -- --report` refreshes `reports/unverified-records.csv` (every record with `verified: false`, with its source).
4. `npm run test:logic && npm run build`, then commit `data/*.json` together with the seed.

### Every record carries `verified: false` and a `source`

Open `data/*.json` to see where each record came from. Flip `verified` to `true` only after someone has checked it on the ground.

---

## Spot-check before launch

Please do this before sharing the site widely. These are the known weak points:

1. **Pandal coordinates (most important).** Only **25 of 92** pandals have a venue-level pin (a park/club OSM knows about). **67 are pinned to the
   neighbourhood** (`locationPrecision: "area"`); the detail panel says "The pin shows the neighbourhood, not the exact lane" and
   Directions search **by name** for those. Pandals are temporary structures, so check the location of each pandal against the committee's page
   or Google Maps, and fix it by adding `lat` / `lng` to its record in `pandals.seed.json` and running `npm run data:pandals`.
2. **Parking availability.** Parking points come from OSM (+5 hand-curated). Capacity and fees are mostly **not listed**, and **availability on Puja nights is
   unknown**: many car parks close or are taken over for crowd control. The page says so; confirm key lots with local volunteers.
3. **Event dates and times.** Every event is `confirmed: false`. Times are typical patterns, not published schedules. Sandhi Puja timing in
   particular is set by the *panjika* every year.
4. **Puja date discrepancy.** The brief assumed Shashthi ≈ Oct 16 – Dashami ≈ Oct 20, 2026; some aggregator sites list Oct 17–21. The config uses the
   brief's dates (and the committee site we checked agrees), flagged as approximate in the UI. Confirm against the 2026 panjika.
5. **Curated eatery / parking coordinates.** Hand-entered; those that matched an OSM point were snapped to it, the rest keep approximate coordinates
   (see the `source` field on each record).
6. **OSM coverage is thin.** Restrooms (64) and parking (48) are far fewer than reality, and OSM rarely says whether a toilet is wheelchair
   accessible ("Accessibility not listed" does *not* mean inaccessible). Opening hours exist for only ~124 eateries; "Open now" only reflects those.
7. **Crowd estimates are editorial** (see above); only visitor reports are real-time.
8. **Bengali translation is machine-drafted.** `messages/bn.json` carries a `_meta.reviewed: false` flag, and the More page shows a notice in Bengali.
   Have a native speaker review it, then set `reviewed` to `true` and remove the notice (`more.translationNote`).
9. **Moderation word list is a starter list** (`lib/server/wordlist.ts`, English + Bengali + romanised Bengali). Extend it after seeing real comments; the
   in-app Report button (auto-hide at 3) is the second line of defence. There is no admin page yet (see Phase 2).
10. **Rate limiting caveat.** The per-IP limiter (`lib/server/rateLimit.ts`) is in-memory, so on Vercel each serverless instance has its own counters.
    The *hard* limits (1 crowd report / pandal / device / 10 min, 3 comments / device / hour, duplicate comments) are enforced against the database. For
    stricter global limits swap the limiter for Upstash Redis / Vercel KV (same function signature). The limiter keys on the first `x-forwarded-for` entry,
    which Vercel sets itself; if you host elsewhere, put a proxy in front that overwrites that header or the limits can be sidestepped.
11. **Device ids are client-chosen** (`x-device-id`), so a determined person can rotate them. Brakes that do not depend on the id: per-network limits per pandal and
    per comment report. Crowd data is crowd-sourced and can be gamed; treat it as a hint.
12. **No data is verified.** `verified: false` on every record (see `reports/unverified-records.csv`).

---

## Deploy on Vercel

**Keep the folder tree.** Next.js needs `app/`, `i18n/request.ts`, `messages/`, `data/` and so on. If you upload files through the GitHub website by selecting everything *inside* the project, GitHub stores them **all at the repo root** (`request.ts` instead of `i18n/request.ts`). Vercel then fails with `[next-intl] Could not find i18n config at ./i18n/request.ts`. Drag the **`P-Hops` folder** (or `git add` from inside it) so paths like `i18n/request.ts` and `app/[locale]/page.tsx` survive.

1. Push the repo to GitHub/GitLab (folders intact) and **Import Project** in Vercel (framework preset: Next.js, defaults are fine). Root Directory stays empty if `next.config.ts` is at the repo root.
2. **Settings → Environment Variables:** add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_HASH_SALT`, `NEXT_PUBLIC_SITE_URL`
   (Production *and* Preview). Mark the service-role key as sensitive.
3. Deploy. All pages prerender statically (partial prerender); only `/api/*` is dynamic. `GET /api/crowd` and `GET /api/comments` send a short
   CDN cache header (`s-maxage` 10–20 s) so many phones polling collapse into few database reads.
4. Run the SQL in `supabase/schema.sql` (once) **before** the first real traffic.

**No Git repo? Deploy from the command line instead:**

```bash
npm i -g vercel          # or prefix the commands below with npx
vercel login
vercel link              # create / pick the project
# add each variable from .env.example (Production, Preview); the CLI prompts for the value so it never lands in shell history
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
vercel env add DEVICE_HASH_SALT production
vercel --prod            # the printed URL is the shareable link
vercel env add NEXT_PUBLIC_SITE_URL production   # set to that URL, then redeploy: vercel --prod
```

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` work as alternative names for the first two variables (the server reads them; use one spelling).
There is no `vercel.json`: the security headers, including `Permissions-Policy: geolocation=(self)`, are set in `next.config.ts`.

Nothing needs a build-time network call, so builds are deterministic and fast.

---

## Launch checklist

- [ ] `npm run lint && npm run typecheck && npm run i18n:check && npm run test:logic && npm run test:location && npm run data:validate && npm run build` all clean
- [ ] Supabase project created, `supabase/schema.sql` run, RLS confirmed in the dashboard (Table editor shows RLS enabled on all three tables)
- [ ] Vercel env vars set for Production (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_HASH_SALT`, `NEXT_PUBLIC_SITE_URL`); service-role key marked sensitive; `SITE_NOINDEX` unset (or `true` until go-live)
- [ ] After the first deploy: `curl -s https://<site>/api/crowd` returns `{"aggregates":[]}` (not `503 not_configured`), a test comment posts and shows up, then delete it in Supabase
- [ ] `curl -sI https://<site>/` shows `Content-Security-Policy`, `Permissions-Policy: geolocation=(self)`, `X-Content-Type-Options`, `Referrer-Policy`; open the site with DevTools and confirm no CSP violations in the console
- [ ] Real-phone test (Android Chrome and iPhone Safari): location prompt, Near me, bottom sheet with the keyboard open, Bengali text, dark mode, airplane mode (offline banner)
- [ ] Confirm Puja dates in `config/puja.ts` against the 2026 panjika, then set `PUJA_DATES_APPROXIMATE = false`
- [ ] Spot-check pandal pins and event times (see [Spot-check before launch](#spot-check-before-launch)); native-speaker review of `messages/bn.json`
- [ ] Share the link on WhatsApp / Facebook once to check the preview card (`/og` image, title, description) in both languages
- [ ] Run `npm run audit:lighthouse` against the production URL (`BASE=https://<site>`)

---

## Project layout

```
app/[locale]/…        pages (map home, pandals, eateries, events, parking, restrooms, near-me, more)
app/api/…             crowd + comments route handlers (server-side writes)
components/           UI; components/map/* is the Leaflet code (client-only chunk), components/pages/* the list pages
config/puja.ts        dates, map config, time slots, crowd/comment rules, walking assumptions
lib/                  types, geo (Haversine), crowdService, data access, directions, search, moderation + store (lib/server)
messages/             en.json, bn.json (all UI strings)
data/                 static JSON datasets
scripts/              OSM / pandal / area builders, i18n check
supabase/schema.sql   tables + RLS
```

Notes for contributors:

* Leaflet touches `window` at import time. Only import `components/map/markers.ts`, `MapView.tsx` and `ClusterLayer.tsx` from client-only code
  (`MapViewLazy` loads them with `ssr: false`). Server-renderable code should import layer definitions from `components/map/layers.ts`.
* Distances are straight-line Haversine × 1.3 (street detour), at 4.5 km/h, shown with "~". They are estimates, not routing.
* Accessibility: every control has a label, filters use `aria-pressed`, crowd level is always icon bars **plus text** (never colour only),
  min touch target 44 px, `prefers-reduced-motion` respected, skip link, keyboard-reachable map markers.

---

## Playful touches

- **Surprise me** (dice button on the map, button on the Pandals page): a weighted random pick that leans quiet and, with a location, close. "Spin again" never repeats the pandal you just saw.
- **My evening** (Pandals page, third tab): up to three pandals that aren't busy, ordered by short walking hops, plus a famous snack stop. Assumes about 30 minutes per pandal and the same walking-speed estimate as everywhere else. It is a suggestion, not a route planner (that is still Phase 2).
- **Saved pandals**: heart toggle on rows, the detail sheet and suggestions. Stored in `localStorage` on the device only; a "Saved" chip filters the Pandals list.
- **Detail sheet on phones**: drag the handle or title up to expand, down to collapse or close. The chevron and close buttons do the same for keyboard and screen-reader users.
- **Crowd meter**, toasts, confetti on crowd reports, and a press effect on buttons. All motion is short and CSS-only, and `prefers-reduced-motion` switches it off.

## Location (geolocation flow)

**Privacy:** coordinates live in memory only. They are never sent to our API, never stored in Supabase, never written to `localStorage`, and a manually picked point is not persisted either. The only thing remembered is a flag that the "location is blocked" help was dismissed (`pujo.locHelpSeen`). Our two API routes only receive `pandalId`, `level`/comment text and a random device id.
One honest caveat: the map downloads OpenStreetMap tiles (`/z/x/y.png`) for the area on screen, so the tile server can infer a coarse area. "Directions" links carry only the destination.

**Flow** (`lib/locationController.ts`, framework-free and unit-tested; `lib/useUserLocation.ts` and `components/LocationProvider.tsx` expose it):

1. On first load the Permissions API is queried (in try/catch, because older Safari lacks it or throws).
   - `granted`: start silently. `prompt`: show the friendly banner and call `getCurrentPosition` right away. `denied`: never call the API again; show browser-specific re-enable steps once.
2. If the prompt hasn't resolved after 6 s (some iOS versions need a gesture), a prominent **Use my location** button appears.
3. After the first fix, `watchPosition` runs with `enableHighAccuracy`, `maximumAge: 10000`, `timeout: 15000`. Updates are throttled to about 5 s or 20 m (`shouldEmitFix`). The watch stops when the tab is hidden and resumes when visible.
4. `permissionStatus.onchange` is honoured, so denied to allowed works without a reload (and allowed to denied stops the watch).
5. Every `GeolocationPositionError` has an en/bn message (`messages/*.json` > `location.errors`). A TIMEOUT retries once with `enableHighAccuracy: false`. A dismissed prompt is treated as "not now", not as blocked.
6. Fallbacks: a Kolkata area dropdown and "pick a point on the map". Everything location-based (distances, Near me, Surprise me, My evening) works with the manual point.
7. A GPS fix outside `[22.35, 88.18]..[22.80, 88.52]` shows "You appear to be outside Kolkata" and does not centre the map or draw a dot; the user can browse normally or choose an area.
8. In-app browsers (WhatsApp, Instagram, Facebook) are detected from the user agent and get a "open in Chrome or Safari" banner with a copy-link button. Detection is best effort: user agents change and some apps don't identify themselves.

**Headers:** `next.config.ts` sends `Permissions-Policy: geolocation=(self)`. There is no `vercel.json`.

**Testing:** `npm run test:location` runs 22 scenario tests against a mock environment (allow, deny, dismiss, denied to allowed, timeouts, throttling, visibility, no Permissions API, insecure context, stalled prompt). In development the controller is exposed as `window.__locationController` (never in production) so a browser session can inject a mock `GeoEnv` and fake fixes.

**Map note:** with Cache Components, routes are kept alive in `<Activity>`, which runs effect cleanups when a route is hidden. react-leaflet's cleanup would destroy the map and then re-run against the dead instance, crashing on return to `/`. `MapViewLazy` (`components/map/MapLoader.tsx`) therefore unmounts the map while hidden and remounts it on show.

## Phase 2 (not built)

* **My Plan:** route planner (pick pandals → ordered walking route, estimated time, share link).
* **PWA / offline:** service worker with cached tiles for the Kolkata bounds + data chunks, install prompt. (An "offline" banner already ships; the app does not cache map tiles yet.)
* **Live traffic crowd source:** implement a provider for TomTom / Google and register it via `registerCrowdProvider` in `lib/crowdService.ts`.
* **Admin moderation page:** list reported/hidden comments, unhide/delete, ban a device hash, purge old crowd reports.
* **Photos:** visitor photo uploads per pandal (Supabase Storage, moderation queue, EXIF stripping).

---

Map data © OpenStreetMap contributors (ODbL). Geocoding via Nominatim; facility data via the Overpass API.
