"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { PlacesMap } from "@/components/map/PlacesMap";
import { Away, DirectionLinks, LocationPrompt, Unverified } from "@/components/PlaceBits";
import { Chip, ChipRow, Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadRestrooms } from "@/lib/data";
import { walkingKm } from "@/lib/geo";
import type { Restroom } from "@/lib/types";
import { useLazy } from "@/lib/useLazy";

const TYPES = ["all", "public", "paid", "venue"] as const;

export function RestroomsClient() {
  const t = useTranslations("restrooms");
  const tc = useTranslations("common");
  const { location } = useApp();
  const { data, status, retry } = useLazy(loadRestrooms, true);
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<"distance" | "name">("name");

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = data.filter((r) => (type === "all" || r.type === type) && (!accessibleOnly || r.accessible));
    if (sort === "distance" && location) return list.sort((a, b) => walkingKm(location, a) - walkingKm(location, b));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, type, accessibleOnly, sort, location]);

  return (
    <>
      <ChipRow label={t("title")}>
        {TYPES.map((k) => (
          <Chip key={k} pressed={type === k} onClick={() => setType(k)}>
            {t(`types.${k}`)}
          </Chip>
        ))}
        <Chip pressed={accessibleOnly} onClick={() => setAccessibleOnly((v) => !v)}>
          <Icon name="wheelchair" className="size-4" />
          {t("accessibleOnly")}
        </Chip>
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
          value={location ? sort : "name"}
          onChange={setSort}
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
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="rounded-2xl border border-line p-4 text-center">
          <p className="text-sm text-muted">{tc("error")}</p>
          <button type="button" onClick={retry} className="mt-2 min-h-11 rounded-xl bg-brand px-4 font-semibold text-brand-ink">
            {tc("retry")}
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink">{tc("noResults")}</p>
      ) : view === "map" ? (
        <PlacesMap restrooms={sorted} />
      ) : (
        <>
          <p className="text-sm font-medium text-muted" aria-live="polite">
            {tc("count", { count: sorted.length })}
          </p>
          <ul className="space-y-3">
            {sorted.map((r) => (
              <RestroomCard key={r.id} r={r} />
            ))}
          </ul>
        </>
      )}
      <Unverified />
    </>
  );
}

function RestroomCard({ r }: { r: Restroom }) {
  const t = useTranslations("restrooms");
  return (
    <li className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold leading-snug text-ink">{r.name}</h2>
        <Away to={r} className="shrink-0 text-right" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-ink">{t(`types.${r.type}`)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 text-ink">
          <Icon name="wheelchair" className="size-3.5" />
          {r.accessible ? t("accessible") : t("accessibilityUnknown")}
        </span>
      </div>
      {r.notes && <p className="mt-2 text-sm text-muted">{r.notes}</p>}
      <div className="mt-3">
        <DirectionLinks name={r.name} lat={r.lat} lng={r.lng} />
      </div>
    </li>
  );
}
