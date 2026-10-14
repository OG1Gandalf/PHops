"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { useApp } from "@/components/AppProvider";
import { useLocation } from "@/components/LocationProvider";
import { CommentsSection } from "@/components/CommentsSection";
import { CrowdReport } from "@/components/CrowdReport";
import { CrowdBadge } from "@/components/ui/CrowdBadge";
import { CrowdMeter } from "@/components/ui/CrowdMeter";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { minutesAgo } from "@/lib/crowdService";
import { loadEateries, loadParking, loadRestrooms } from "@/lib/data";
import { appleMapsUrl, googleMapsUrl } from "@/lib/directions";
import { formatDistance, nearest } from "@/lib/geo";
import type { Pandal } from "@/lib/types";
import { useLazy } from "@/lib/useLazy";

export function PandalDetail({ pandal }: { pandal: Pandal }) {
  const t = useTranslations("pandal");
  const tc = useTranslations("crowd");
  const ts = useTranslations("slots");
  const tz = useTranslations("zones");
  const tth = useTranslations("themes");
  const tcm = useTranslations("common");
  const { slot, currentSlot, getCrowd, aggregates, crowdAvailable } = useApp();
  const { env } = useLocation();
  const showApple = env.platform !== "android"; // Apple Maps links are pointless on Android

  const displayed = getCrowd(pandal);
  const estimate = pandal.crowdByTimeSlot[slot];
  const agg = aggregates.get(pandal.id);
  const liveOk = slot === currentSlot && displayed.source === "visitors";
  const approx = pandal.locationPrecision !== "venue";

  const tags = pandal.tags.filter((x) => x === "theme" || x === "traditional" || x === "heritage" || x === "headline");

  return (
    <div className="space-y-5 px-4 pb-8 pt-1">
      {/* About */}
      <section aria-label={t("area")} className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{tz(pandal.zone)}</span>
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-semibold text-gold">
              {tth(tag)}
            </span>
          ))}
        </div>
        {pandal.description && <p className="text-[15px] leading-relaxed text-ink">{pandal.description}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="font-semibold text-muted">{t("theme")}</dt>
          <dd className="text-ink">{pandal.theme ?? t("themeUnknown")}</dd>
          <dt className="font-semibold text-muted">{t("hours")}</dt>
          <dd className="text-ink">{pandal.openingHours ?? t("hoursDefault")}</dd>
        </dl>
        {approx && (
          <p className="flex gap-2 rounded-lg bg-surface-3 p-2.5 text-xs leading-snug text-muted">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            {t("approxNote")}
          </p>
        )}
      </section>

      {/* Crowd */}
      <section aria-labelledby="crowd-h" className="space-y-3 rounded-2xl border border-line bg-surface p-3.5">
        <h3 id="crowd-h" className="text-base font-bold text-ink">
          {t("crowdHeading")}
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted">{tc("typicalFor", { slot: ts(slot) })}</span>
              <CrowdBadge level={estimate} source="estimate" size="sm" />
            </div>
            <CrowdMeter level={estimate} muted />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted">{tc("rightNow")}</span>
              {liveOk ? (
                <CrowdBadge level={displayed.level} size="sm" />
              ) : (
                <span className="text-sm text-muted">{tc("noLiveData")}</span>
              )}
            </div>
            <CrowdMeter level={liveOk ? displayed.level : null} muted={!liveOk} />
          </div>
          <p className="text-xs leading-snug text-muted" aria-live="polite">
            {liveOk
              ? tc("basedOn", { count: displayed.reportCount ?? agg?.count ?? 0, minutes: minutesAgo(displayed.updatedAt) })
              : slot !== currentSlot
                ? tc("onlyForCurrentSlot")
                : crowdAvailable
                  ? tc("noRecentReports")
                  : tc("reportUnavailable")}
          </p>
        </div>
        <CrowdReport pandal={pandal} />
        <p className="text-xs leading-snug text-muted">{tc("disclaimer")}</p>
      </section>

      {/* Directions */}
      <section aria-labelledby="dir-h" className="space-y-2">
        <h3 id="dir-h" className="text-base font-bold text-ink">
          {t("directionsHeading")}
        </h3>
        <div className={`grid gap-2 ${showApple ? "grid-cols-2" : "grid-cols-1"}`}>
          <a
            href={googleMapsUrl(pandal)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
          >
            <Icon name="navigation" className="size-4 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-medium opacity-90">{tcm("directions")}</span>
              {tcm("googleMaps")}
            </span>
          </a>
          {showApple && (
          <a
            href={appleMapsUrl(pandal)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-ink hover:bg-surface-3"
          >
            <Icon name="navigation" className="size-4 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-medium text-muted">{tcm("directions")}</span>
              {tcm("appleMaps")}
            </span>
          </a>
          )}
        </div>
      </section>

      <NearbyFacilities pandal={pandal} />
      <CommentsSection pandalId={pandal.id} />
    </div>
  );

}

function NearbyFacilities({ pandal }: { pandal: Pandal }) {
  const t = useTranslations("pandal");
  const tr = useTranslations("restrooms");
  const te = useTranslations("eateries");
  const tcm = useTranslations("common");
  const rest = useLazy(loadRestrooms, true);
  const park = useLazy(loadParking, true);
  const eat = useLazy(loadEateries, true);

  const nearestRestroom = useMemo(() => (rest.data ? nearest(pandal, rest.data)[0] : undefined), [rest.data, pandal]);
  const nearestParking = useMemo(() => (park.data ? nearest(pandal, park.data)[0] : undefined), [park.data, pandal]);
  const nearestEatery = useMemo(() => (eat.data ? nearest(pandal, eat.data)[0] : undefined), [eat.data, pandal]);

  const failed = rest.status === "error" || park.status === "error" || eat.status === "error";
  const loading = [rest, park, eat].some((x) => x.status === "loading" || x.status === "idle");

  const rows = [
    {
      key: "restroom",
      label: t("nearestRestroom"),
      icon: "person" as const,
      hit: nearestRestroom,
      sub: nearestRestroom ? `${tr(`types.${nearestRestroom.item.type}`)}${nearestRestroom.item.accessible ? ` · ${tr("accessible")}` : ""}` : "",
    },
    {
      key: "parking",
      label: t("nearestParking"),
      icon: "parking" as const,
      hit: nearestParking,
      sub: nearestParking?.item.fee ?? "",
    },
    {
      key: "eatery",
      label: t("nearestEatery"),
      icon: "utensils" as const,
      hit: nearestEatery,
      sub: nearestEatery ? te(`types.${nearestEatery.item.cuisineType}`) : "",
    },
  ];

  return (
    <section aria-labelledby="near-h" className="space-y-2">
      <h3 id="near-h" className="text-base font-bold text-ink">
        {t("nearbyHeading")}
      </h3>
      {failed && <p className="text-sm text-muted">{t("nearbyFailed")}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-brand">
                <Icon name={r.icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{r.label}</p>
                {r.hit ? (
                  <>
                    <p className="truncate text-sm font-semibold text-ink">{r.hit.item.name}</p>
                    {r.sub && <p className="text-xs text-muted">{r.sub}</p>}
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-ink">
                      <Icon name="walk" className="size-4" />
                      {tcm("away", { distance: formatDistance(r.hit.km), minutes: r.hit.minutes })}
                    </p>
                  </>
                ) : loading ? (
                  <Skeleton className="mt-1 h-4 w-2/3" />
                ) : (
                  <p className="text-sm text-muted">{t("nearbyNone")}</p>
                )}
              </div>
              {r.hit && (
                <a
                  href={googleMapsUrl(r.hit.item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${tcm("directions")}: ${r.hit.item.name}`}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-brand hover:bg-line"
                >
                  <Icon name="navigation" className="size-5" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
