"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { PlacesMap } from "@/components/map/PlacesMap";
import { Away, DirectionLinks, LocationPrompt, Unverified } from "@/components/PlaceBits";
import { Chip, ChipRow, SearchField, Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadEateries } from "@/lib/data";
import { walkingKm } from "@/lib/geo";
import { isOpenNow } from "@/lib/openingHours";
import { normalize } from "@/lib/search";
import type { CuisineType, Eatery } from "@/lib/types";
import { useLazy } from "@/lib/useLazy";

const TYPES: ("all" | CuisineType)[] = ["all", "street_food", "bengali", "sweets", "cafe", "biryani", "other"];
const PAGE = 30;
const MAP_LIMIT = 300;

type Diet = "all" | "veg" | "nonveg";
type Sort = "smart" | "distance" | "name";

export function EateriesClient() {
  const t = useTranslations("eateries");
  const tc = useTranslations("common");
  const { location } = useApp();
  const { data, status, retry } = useLazy(loadEateries, true);

  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | CuisineType>("all");
  const [diet, setDiet] = useState<Diet>("all");
  const [price, setPrice] = useState<0 | 1 | 2 | 3>(0);
  const [openOnly, setOpenOnly] = useState(false);
  const [famousOnly, setFamousOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("smart");
  const [view, setView] = useState<"list" | "map">("list");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    if (!data) return [];
    const nq = normalize(q);
    const list = data.filter((e) => {
      if (type !== "all" && e.cuisineType !== type) return false;
      if (diet === "veg" && !e.isVeg) return false;
      if (diet === "nonveg" && e.isVeg) return false;
      if (price && e.priceRange !== price) return false;
      if (famousOnly && !e.famousFor) return false;
      if (openOnly && isOpenNow(e.openHours) !== true) return false;
      // a query made only of punctuation normalises to "" and must match nothing, not everything
      if (q.trim() && (!nq || !normalize(`${e.name} ${e.famousFor ?? ""}`).includes(nq))) return false;
      return true;
    });
    const withKm = list.map((e) => ({ e, km: location ? walkingKm(location, e) : Infinity }));
    withKm.sort((a, b) => {
      if (sort === "name") return a.e.name.localeCompare(b.e.name);
      if (sort === "distance" && location) return a.km - b.km;
      // smart: famous Puja spots first, then nearest (or A–Z without a location)
      const f = Number(!!b.e.famousFor) - Number(!!a.e.famousFor);
      if (f) return f;
      return location ? a.km - b.km : a.e.name.localeCompare(b.e.name);
    });
    return withKm.map((x) => x.e);
  }, [data, q, type, diet, price, famousOnly, openOnly, sort, location]);

  const reset = () => {
    setQ("");
    setType("all");
    setDiet("all");
    setPrice(0);
    setOpenOnly(false);
    setFamousOnly(false);
  };
  const filtersActive = q || type !== "all" || diet !== "all" || price || openOnly || famousOnly;

  return (
    <>
      <SearchField label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} value={q} onChange={(v) => { setQ(v); setShown(PAGE); }} />

      <ChipRow label={t("typeFilter")}>
        {TYPES.map((k) => (
          <Chip key={k} pressed={type === k} onClick={() => { setType(k); setShown(PAGE); }}>
            {t(`types.${k}`)}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label={t("diet")}>
        <Chip pressed={famousOnly} onClick={() => { setFamousOnly((v) => !v); setShown(PAGE); }}>
          <Icon name="star" className="size-3.5" />
          {t("famousOnly")}
        </Chip>
        <Chip pressed={openOnly} onClick={() => { setOpenOnly((v) => !v); setShown(PAGE); }}>
          <Icon name="clock" className="size-3.5" />
          {t("openNow")}
        </Chip>
        <Chip pressed={diet === "veg"} onClick={() => { setDiet(diet === "veg" ? "all" : "veg"); setShown(PAGE); }}>
          {t("veg")}
        </Chip>
        <Chip pressed={diet === "nonveg"} onClick={() => { setDiet(diet === "nonveg" ? "all" : "nonveg"); setShown(PAGE); }}>
          {t("nonVeg")}
        </Chip>
        {([1, 2, 3] as const).map((p) => (
          <Chip key={p} pressed={price === p} onClick={() => { setPrice(price === p ? 0 : p); setShown(PAGE); }}>
            <span aria-hidden="true">{"₹".repeat(p)}</span>
            <span className="sr-only">{t("priceLabel", { level: p })}</span>
          </Chip>
        ))}
      </ChipRow>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label={tc("view")}
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: tc("list"), icon: "list" },
            { value: "map", label: tc("map"), icon: "map" },
          ]}
        />
        <Segmented
          label={tc("sortBy")}
          value={sort === "smart" ? (location ? "distance" : "name") : sort}
          onChange={(v) => setSort(v)}
          options={[
            { value: "distance", label: tc("sortDistance") },
            { value: "name", label: tc("sortName") },
          ]}
        />
      </div>

      <LocationPrompt />

      {status === "loading" || status === "idle" ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">{tc("loading")}</span>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="rounded-2xl border border-line p-4 text-center">
          <p className="text-sm text-muted">{tc("error")}</p>
          <button type="button" onClick={retry} className="mt-2 min-h-11 rounded-xl bg-brand px-4 font-semibold text-brand-ink">
            {tc("retry")}
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-muted" aria-live="polite">
            {tc("count", { count: filtered.length })}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center">
              <p className="text-ink">{tc("noResults")}</p>
              {filtersActive && (
                <button type="button" onClick={reset} className="mt-2 min-h-11 rounded-xl border border-line px-4 font-semibold text-brand">
                  {tc("clearFilters")}
                </button>
              )}
            </div>
          ) : view === "map" ? (
            <>
              {filtered.length > MAP_LIMIT && <p className="text-sm text-muted">{t("mapLimit", { count: MAP_LIMIT })}</p>}
              <PlacesMap eateries={filtered.slice(0, MAP_LIMIT)} />
            </>
          ) : (
            <>
              <ul className="space-y-3">
                {filtered.slice(0, shown).map((e) => (
                  <EateryCard key={e.id} e={e} />
                ))}
              </ul>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted">{t("showing", { shown: Math.min(shown, filtered.length), total: filtered.length })}</p>
                {shown < filtered.length && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE)}
                    className="min-h-12 w-full max-w-xs rounded-xl border border-line bg-surface-2 font-semibold text-ink hover:bg-surface-3"
                  >
                    {t("showMore")}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
      <Unverified />
    </>
  );
}

function EateryCard({ e }: { e: Eatery }) {
  const t = useTranslations("eateries");
  const tc = useTranslations("common");
  // evaluated at render time on the client (the list only exists after the lazy data has loaded)
  const open = isOpenNow(e.openHours);
  return (
    <li
      className={`rounded-2xl border bg-surface p-3.5 ${
        e.famousFor ? "border-[var(--gold)] shadow-[0_0_0_1px_var(--gold)]" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold leading-snug text-ink">{e.name}</h2>
        <Away to={e} className="shrink-0 text-right" />
      </div>
      {e.famousFor && (
        <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-ink">
          <Icon name="star" className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" />
          <span>
            <span className="font-bold">{t("famous")}</span> – {e.famousFor}
          </span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-ink">{t(`types.${e.cuisineType}`)}</span>
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-ink" title={t("priceLabel", { level: e.priceRange })}>
          <span aria-hidden="true">{"₹".repeat(e.priceRange)}</span>
          <span className="sr-only">{t("priceLabel", { level: e.priceRange })}</span>
        </span>
        {e.isVeg && <span className="rounded-full bg-[var(--crowd-low-bg)] px-2.5 py-1 text-[var(--crowd-low)]">{t("vegOnly")}</span>}
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-muted">
          {open === null ? t("hoursUnknown") : open ? t("open") : t("closed")}
        </span>
        {!e.verified && <span className="rounded-full border border-line px-2.5 py-1 text-muted">{tc("unverified")}</span>}
      </div>
      <div className="mt-3">
        <DirectionLinks name={e.name} lat={e.lat} lng={e.lng} />
      </div>
    </li>
  );
}
