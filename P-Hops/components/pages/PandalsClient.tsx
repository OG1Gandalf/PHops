"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { useLocation } from "@/components/LocationProvider";
import { EveningPlan } from "@/components/EveningPlan";
import { Away, LocationPrompt } from "@/components/PlaceBits";
import { SaveButton } from "@/components/SaveButton";
import { SlotSelector } from "@/components/SlotSelector";
import { Chip, ChipRow, SearchField, SelectField, Segmented } from "@/components/ui/controls";
import { CrowdBadge } from "@/components/ui/CrowdBadge";
import { Icon } from "@/components/ui/Icon";
import { ZONES } from "@/config/puja";
import { CROWD_LEVELS, minutesAgo, rankLeastCrowded, type DisplayedCrowd } from "@/lib/crowdService";
import { PANDALS } from "@/lib/data";
import { walkingKm } from "@/lib/geo";
import { searchPandals } from "@/lib/search";
import type { CrowdLevel, Pandal, Zone } from "@/lib/types";
import { usePathname, useRouter } from "@/i18n/navigation";

type Tab = "all" | "least" | "plan";
type Sort = "az" | "nearest" | "least";
const STYLES = ["all", "theme", "traditional", "heritage", "headline"] as const;
const PAGE = 25;

export function PandalsClient() {
  const t = useTranslations("pandalsPage");
  const tc = useTranslations("common");
  const tz = useTranslations("zones");
  const ts = useTranslations("themes");
  const tcr = useTranslations("crowd");
  const tsl = useTranslations("slots");
  const app = useApp();
  const loc = useLocation();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = tabParam === "least" ? "least" : tabParam === "plan" ? "plan" : "all";

  const [q, setQ] = useState("");
  const [zone, setZone] = useState<"all" | Zone>("all");
  const [crowd, setCrowd] = useState<"any" | CrowdLevel>("any");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("all");
  const [sort, setSort] = useState<Sort>("az");
  const [shown, setShown] = useState(PAGE);
  const [onlySaved, setOnlySaved] = useState(false);

  const setTab = (next: Tab) => {
    // keep the URL shareable: /pandals?tab=least
    router.replace(next === "all" ? pathname : `${pathname}?tab=${next}`);
    setShown(PAGE);
  };

  const base = useMemo(() => {
    let list = q.trim() ? searchPandals(PANDALS, q) : [...PANDALS];
    if (zone !== "all") list = list.filter((p) => p.zone === zone);
    if (style !== "all") list = list.filter((p) => p.tags.includes(style));
    if (onlySaved) list = list.filter((p) => app.saved.has(p.id));
    return list;
  }, [q, zone, style, onlySaved, app.saved]);

  const rows = useMemo(() => {
    const ranked = rankLeastCrowded(base, app.slot, app.currentSlot, app.aggregates);
    if (tab === "least") return ranked;
    let list = crowd === "any" ? ranked : ranked.filter((r) => r.crowd.level === crowd);
    const { location } = app;
    if (sort === "nearest" && location) list = [...list].sort((a, b) => walkingKm(location, a.pandal) - walkingKm(location, b.pandal));
    else if (sort === "least") list = [...list];
    else list = [...list].sort((a, b) => a.pandal.name.localeCompare(b.pandal.name));
    return list;
  }, [base, tab, crowd, sort, app]);

  const filtersActive = q || zone !== "all" || style !== "all" || crowd !== "any" || onlySaved;
  const clear = () => {
    setQ("");
    setZone("all");
    setStyle("all");
    setCrowd("any");
    setOnlySaved(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-ink">
          {t("greeting", { slot: app.currentSlot })}
        </p>
        <button
          type="button"
          onClick={() => app.spinSurprise()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-gold bg-surface-2 px-3 text-sm font-bold text-ink hover:bg-surface-3"
        >
          <span aria-hidden="true">🎲</span>
          {t("surpriseMe")}
        </button>
      </div>

      <div role="tablist" aria-label={t("title")} className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface-2 p-1">
        {(["all", "least", "plan"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`min-h-11 rounded-xl px-2 text-sm font-bold transition-colors ${
              tab === k ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-3"
            }`}
          >
            {k === "all" ? t("tabAll") : k === "least" ? t("tabLeast") : t("tabPlan")}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-muted">{t("selectedSlot")}</p>
        <SlotSelector compact className="w-full [&>button]:flex-1" />
      </div>

      {tab === "plan" ? (
        <EveningPlan />
      ) : (
        <>
      {tab === "least" && (
        <div className="rounded-2xl border border-line bg-surface p-3 text-sm">
          <h2 className="font-bold text-ink">{tcr("leastCrowdedTitle")}</h2>
          <p className="mt-0.5 text-muted">
            {app.slot === app.currentSlot
              ? tcr("leastCrowdedHelp")
              : tcr("leastCrowdedForSlot", { slot: tsl(app.slot) })}
          </p>
        </div>
      )}

      <SearchField label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={q} onChange={(v) => { setQ(v); setShown(PAGE); }} />

      <ChipRow label={t("savedFilter")}>
        <Chip pressed={onlySaved} onClick={() => { setOnlySaved((v) => !v); setShown(PAGE); }}>
          <span aria-hidden="true">❤️</span> {t("savedChip", { count: app.saved.size })}
        </Chip>
      </ChipRow>

      <details className="group rounded-2xl border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold text-ink">
          <span>{t("filters")}</span>
          <Icon name="down" className="size-5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t("zone")}
              value={zone}
              onChange={(v) => { setZone(v); setShown(PAGE); }}
              options={[{ value: "all", label: tz("all") }, ...ZONES.map((z) => ({ value: z, label: tz(z) }))]}
            />
            <SelectField
              label={t("themeFilter")}
              value={style}
              onChange={(v) => { setStyle(v); setShown(PAGE); }}
              options={STYLES.map((s) => ({ value: s, label: ts(s) }))}
            />
          </div>
          {tab === "all" && (
            <>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">{t("crowdFilter")}</p>
                <ChipRow label={t("crowdFilter")}>
                  <Chip pressed={crowd === "any"} onClick={() => { setCrowd("any"); setShown(PAGE); }}>
                    {t("crowdAny")}
                  </Chip>
                  {CROWD_LEVELS.map((l) => (
                    <Chip key={l} pressed={crowd === l} onClick={() => { setCrowd(l); setShown(PAGE); }}>
                      {tcr(l)}
                    </Chip>
                  ))}
                </ChipRow>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">{tc("sortBy")}</p>
                <Segmented
                  label={tc("sortBy")}
                  value={sort === "nearest" && !app.location ? "az" : sort}
                  onChange={(v) => {
                    setSort(v);
                    if (v === "nearest" && !app.location) loc.ask(); // ask right away; the prompt below offers fallbacks
                  }}
                  options={[
                    { value: "az", label: t("sortAZ") },
                    { value: "nearest", label: t("sortNearest") },
                    { value: "least", label: t("sortLeast") },
                  ]}
                />
              </div>
            </>
          )}
        </div>
      </details>

      {(sort === "nearest" || tab === "least") && <LocationPrompt />}

      <p className="text-sm font-medium text-muted" aria-live="polite">
        {t("results", { count: rows.length })}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="text-ink">{t("empty")}</p>
          {filtersActive && (
            <button type="button" onClick={clear} className="mt-2 min-h-11 rounded-xl border border-line px-4 font-semibold text-brand">
              {tc("clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <ol className="space-y-3">
          {rows.slice(0, shown).map(({ pandal, crowd: c }, i) => (
            <PandalRow key={pandal.id} pandal={pandal} crowd={c} index={i} rank={tab === "least" ? i + 1 : undefined} />
          ))}
        </ol>
      )}
      {shown < rows.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 font-semibold text-ink hover:bg-surface-3"
        >
          {tc("showMore")}
        </button>
      )}

        </>
      )}

      <p className="rounded-xl bg-surface-3 p-3 text-xs leading-snug text-muted">{tcr("disclaimer")}</p>
    </>
  );
}

function PandalRow({ pandal, crowd, rank, index }: { pandal: Pandal; crowd: DisplayedCrowd; rank?: number; index: number }) {
  const t = useTranslations("pandalsPage");
  const tz = useTranslations("zones");
  const tcr = useTranslations("crowd");
  const { selectPandal, focusMap, selectedPandalId } = useApp();
  const router = useRouter();
  const selected = selectedPandalId === pandal.id;

  return (
    <li style={{ ["--i" as string]: index }} className={`rise rounded-2xl border bg-surface p-3.5 transition-shadow hover:shadow-md ${selected ? "border-brand" : "border-line"}`}>
      <div className="flex items-start gap-3">
        {rank !== undefined && (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-extrabold text-brand" aria-label={`#${rank}`}>
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-snug text-ink">{pandal.name}</h2>
          <p className="text-sm text-muted">
            {pandal.area} · {tz(pandal.zone)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <SaveButton pandalId={pandal.id} name={pandal.name} />
          <Away to={pandal} className="text-right" />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CrowdBadge level={crowd.level} source={crowd.source} />
        <span className="text-xs text-muted">{crowd.source === "visitors" ? tcr("sourceVisitors") : tcr("sourceEstimate")}</span>
      </div>
      {crowd.source === "visitors" && crowd.reportCount !== undefined && (
        <p className="mt-1 text-xs text-muted">{tcr("basedOn", { count: crowd.reportCount, minutes: minutesAgo(crowd.updatedAt) })}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectPandal(pandal.id)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
        >
          <Icon name="info" className="size-4" />
          {t("viewDetails")}
          <span className="sr-only">: {pandal.name}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            selectPandal(pandal.id);
            focusMap(pandal, 16, true);
            router.push("/");
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 text-sm font-semibold text-ink hover:bg-surface-3"
        >
          <Icon name="map" className="size-4" />
          {t("showOnMap")}
          <span className="sr-only">: {pandal.name}</span>
        </button>
      </div>
    </li>
  );
}
