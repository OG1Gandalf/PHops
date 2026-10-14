"use client";

import { useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";

import { useApp } from "@/components/AppProvider";
import { useLocation } from "@/components/LocationProvider";
import { LocationFallback } from "@/components/location/LocationFallback";
import { useLocationErrorMessage } from "@/components/location/useLocationMessage";
import { DirectionLinks } from "@/components/PlaceBits";
import { CrowdBadge } from "@/components/ui/CrowdBadge";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import { loadEateries, loadParking, loadRestrooms, PANDALS } from "@/lib/data";
import { formatDistance, nearest, type Nearby } from "@/lib/geo";
import type { LatLng } from "@/lib/types";
import { useLazy } from "@/lib/useLazy";

const LIMIT = 5;

export function NearMeClient() {
  const t = useTranslations("nearMe");
  const tp = useTranslations("pandalsPage");
  const app = useApp();
  const loc = useLocation();
  const tl = useTranslations("location");
  const describe = useLocationErrorMessage();
  const { location } = app;
  const has = !!location;
  const restrooms = useLazy(loadRestrooms, has);
  const parking = useLazy(loadParking, has);
  const eateries = useLazy(loadEateries, has);

  const pandals = useMemo(() => (location ? nearest(location, PANDALS, LIMIT) : []), [location]);
  const nearRest = useMemo(() => (location && restrooms.data ? nearest(location, restrooms.data, LIMIT) : []), [location, restrooms.data]);
  const nearPark = useMemo(() => (location && parking.data ? nearest(location, parking.data, LIMIT) : []), [location, parking.data]);
  const nearEat = useMemo(() => (location && eateries.data ? nearest(location, eateries.data, LIMIT) : []), [location, eateries.data]);

  const problem =
    !loc.coords && (loc.status === "denied" || loc.status === "unavailable" || loc.status === "error")
      ? describe(loc.error)
      : null;

  return (
    <>
      <section aria-labelledby="loc-h" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="loc-h" className="sr-only">{t("title")}</h2>
        <button
          type="button"
          onClick={loc.ask}
          disabled={loc.locating}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60 sm:w-auto"
        >
          {loc.locating ? (
            <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          ) : (
            <Icon name="locate" className="size-5" />
          )}
          {loc.locating ? t("locating") : t("enable")}
        </button>

        <div role="status" aria-live="polite" className="space-y-1 text-sm">
          {problem && <p className="font-medium text-[var(--crowd-high)]">{problem}</p>}
          {location?.source === "gps" && <p className="text-muted">{t("located", { accuracy: Math.round(location.accuracy ?? 0) })}</p>}
          {location?.manualKind === "area" && <p className="text-muted">{t("locatedManual", { area: location.label ?? "" })}</p>}
          {location?.manualKind === "pin" && <p className="text-muted">{t("locatedPin")}</p>}
          {loc.outsideKolkata && (
            <p className="font-medium text-[var(--gold)]">
              {tl("outsideTitle")} {tl("outsideBody")}
            </p>
          )}
        </div>

        {/* Manual options: always available, and the main path when permission is denied. */}
        <LocationFallback />
        <p className="text-xs text-muted">{tl("privacy")}</p>

        {loc.manual && (
          <button type="button" onClick={loc.clearManual} className="min-h-11 rounded-lg px-1 text-sm font-semibold text-brand underline">
            {t("clear")}
          </button>
        )}
      </section>

      {!location ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{t("needLocation")}</p>
      ) : (
        <>
          <NearSection title={t("nearestPandals")} href="/pandals">
            {pandals.map(({ item, km, minutes }) => (
              <NearRow key={item.id} name={item.name} sub={item.area} km={km} minutes={minutes} point={item}>
                <CrowdBadge level={app.getCrowd(item).level} source={app.getCrowd(item).source} size="sm" />
                <button
                  type="button"
                  onClick={() => app.selectPandal(item.id)}
                  className="min-h-11 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
                >
                  <Icon name="info" className="mr-1 inline size-4 align-text-bottom" />
                  {tp("viewDetails")}
                  <span className="sr-only">: {item.name}</span>
                </button>
              </NearRow>
            ))}
          </NearSection>

          <LazySection title={t("nearestRestrooms")} href="/restrooms" state={restrooms} rows={nearRest} sub={() => ""} />
          <LazySection title={t("nearestParking")} href="/parking" state={parking} rows={nearPark} sub={() => ""} />
          <LazySection title={t("nearestEateries")} href="/eateries" state={eateries} rows={nearEat} sub={(e) => e.famousFor ?? ""} />
        </>
      )}
    </>
  );
}

function NearSection({ title, href, children }: { title: string; href: "/pandals" | "/restrooms" | "/parking" | "/eateries"; children: ReactNode }) {
  const t = useTranslations("nearMe");
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">
          {t("seeAll")}
        </Link>
      </div>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function LazySection<T extends LatLng & { id: string; name: string }>({
  title,
  href,
  state,
  rows,
  sub,
}: {
  title: string;
  href: "/restrooms" | "/parking" | "/eateries";
  state: { status: string; retry: () => void };
  rows: Nearby<T>[];
  sub: (item: T) => string;
}) {
  const t = useTranslations("nearMe");
  const tc = useTranslations("common");
  if (state.status === "error") {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <button type="button" onClick={state.retry} className="min-h-11 rounded-xl border border-line px-4 font-semibold text-brand">
          {tc("error")} {tc("retry")}
        </button>
      </section>
    );
  }
  if (state.status !== "ready") {
    return (
      <section className="space-y-2" aria-busy="true">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <p className="sr-only" role="status">{t("loadingData")}</p>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </section>
    );
  }
  return (
    <NearSection title={title} href={href}>
      {rows.length === 0 && <li className="text-sm text-muted">{t("none")}</li>}
      {rows.map(({ item, km, minutes }) => (
        <NearRow key={item.id} name={item.name} sub={sub(item)} km={km} minutes={minutes} point={item} />
      ))}
    </NearSection>
  );
}

function NearRow({
  name,
  sub,
  km,
  minutes,
  point,
  children,
}: {
  name: string;
  sub?: string;
  km: number;
  minutes: number;
  point: LatLng;
  children?: ReactNode;
}) {
  const tc = useTranslations("common");
  return (
    <li className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-ink">{name}</h3>
          {sub && <p className="text-sm text-muted">{sub}</p>}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
          <Icon name="walk" className="size-4 text-muted" />
          {tc("away", { distance: formatDistance(km), minutes })}
        </span>
      </div>
      {children && <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>}
      <div className="mt-3">
        <DirectionLinks name={name} lat={point.lat} lng={point.lng} />
      </div>
    </li>
  );
}
