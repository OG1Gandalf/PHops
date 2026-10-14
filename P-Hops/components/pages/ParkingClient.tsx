"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { PlacesMap } from "@/components/map/PlacesMap";
import { Away, DirectionLinks, LocationPrompt, Unverified } from "@/components/PlaceBits";
import { Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadParking, PANDALS } from "@/lib/data";
import { formatDistance, nearest, walkingKm } from "@/lib/geo";
import type { Parking } from "@/lib/types";
import { useLazy } from "@/lib/useLazy";

export function ParkingClient() {
  const t = useTranslations("parking");
  const tc = useTranslations("common");
  const { location } = useApp();
  const { data, status, retry } = useLazy(loadParking, true);
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<"distance" | "name">("name");
  const effectiveSort = sort === "distance" && !location ? "name" : sort;

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = [...data];
    if (effectiveSort === "distance" && location) {
      return list.sort((a, b) => walkingKm(location, a) - walkingKm(location, b));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, effectiveSort, location]);

  return (
    <>
      <p className="rounded-2xl border border-[var(--gold)] bg-[var(--gold-soft)] p-3 text-sm font-medium text-ink">
        <Icon name="alert" className="mr-1.5 inline size-4 align-text-bottom text-[var(--gold)]" />
        {t("caution")}
      </p>

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
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="rounded-2xl border border-line p-4 text-center">
          <p className="text-sm text-muted">{tc("error")}</p>
          <button type="button" onClick={retry} className="mt-2 min-h-11 rounded-xl bg-brand px-4 font-semibold text-brand-ink">
            {tc("retry")}
          </button>
        </div>
      ) : view === "map" ? (
        <PlacesMap parking={sorted} />
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => (
            <ParkingCard key={p.id} p={p} />
          ))}
        </ul>
      )}
      <Unverified />
    </>
  );
}

function ParkingCard({ p }: { p: Parking }) {
  const t = useTranslations("parking");
  const tc = useTranslations("common");
  // nearest 3 pandals by (approximate) walking distance
  const near = useMemo(() => nearest(p, PANDALS, 3), [p]);
  return (
    <li className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold leading-snug text-ink">{p.name}</h2>
        <Away to={p} className="shrink-0 text-right" />
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">{t("capacity")}</dt>
        <dd className="text-ink">{p.capacity ? t("spaces", { count: p.capacity }) : t("capacityUnknown")}</dd>
        <dt className="text-muted">{t("fee")}</dt>
        <dd className="text-ink">{p.fee ?? t("feeUnknown")}</dd>
        {p.openHours && (
          <>
            <dt className="text-muted">{t("hours")}</dt>
            <dd className="text-ink">{p.openHours}</dd>
          </>
        )}
        {p.notes && (
          <>
            <dt className="text-muted">{t("notes")}</dt>
            <dd className="text-ink">{p.notes}</dd>
          </>
        )}
      </dl>
      <div className="mt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("nearPandals")}</p>
        <ul className="mt-1 space-y-0.5 text-sm text-ink">
          {near.map(({ item, km, minutes }) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="shrink-0 text-muted">{tc("away", { distance: formatDistance(km), minutes })}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3">
        <DirectionLinks name={p.name} lat={p.lat} lng={p.lng} />
      </div>
    </li>
  );
}
