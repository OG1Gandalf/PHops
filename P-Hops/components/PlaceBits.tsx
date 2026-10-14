"use client";

import { useTranslations } from "next-intl";

import { useApp } from "@/components/AppProvider";
import { useLocation } from "@/components/LocationProvider";
import { LocationFallback } from "@/components/location/LocationFallback";
import { useLocationErrorMessage } from "@/components/location/useLocationMessage";
import { Icon } from "@/components/ui/Icon";
import { appleMapsUrl, googleMapsUrl } from "@/lib/directions";
import { formatDistance, walkingKm, walkingMinutes } from "@/lib/geo";
import type { LatLng } from "@/lib/types";

/** "~1.2 km · 15 min walk" from the visitor's location (renders nothing without one). */
export function Away({ to, className = "" }: { to: LatLng; className?: string }) {
  const t = useTranslations("common");
  const { location } = useApp();
  if (!location) return null;
  const km = walkingKm(location, to);
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium text-ink ${className}`}>
      <Icon name="walk" className="size-4 text-muted" />
      {t("away", { distance: formatDistance(km), minutes: walkingMinutes(km) })}
    </span>
  );
}

/** Google / Apple Maps direction links. */
export function DirectionLinks({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const t = useTranslations("common");
  // Apple Maps links only make sense on Apple devices and desktops; on Android they open a web page in the browser
  const { env } = useLocation();
  const target = { name, lat, lng };
  const cls =
    "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold text-ink hover:bg-surface-3";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={googleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className={cls}>
        <Icon name="navigation" className="size-4 text-brand" />
        {t("googleMaps")}
        <span className="sr-only"> – {t("directions")}: {name}</span>
      </a>
      {env.platform !== "android" && (
        <a href={appleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className={cls}>
          <Icon name="navigation" className="size-4 text-muted" />
          {t("appleMaps")}
          <span className="sr-only"> – {t("directions")}: {name}</span>
        </a>
      )}
    </div>
  );
}

/** Shown on distance-sorted lists when no location is known: ask again, or pick an area / a map point. */
export function LocationPrompt() {
  const t = useTranslations("common");
  const tl = useTranslations("location");
  const { point, ask, locating, status, error } = useLocation();
  const describe = useLocationErrorMessage();
  if (point) return null;
  const message = status === "denied" || status === "unavailable" || status === "error" ? describe(error) : null;
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3 text-sm">
      <p className="text-muted">{message ?? t("needLocationForDistance")}</p>
      <button
        type="button"
        onClick={ask}
        disabled={locating}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60"
      >
        <Icon name="locate" className="size-4" />
        {locating ? tl("finding") : t("useMyLocation")}
      </button>
      <LocationFallback />
      <p className="text-xs text-muted">{tl("privacy")}</p>
    </div>
  );
}

export function Unverified() {
  const t = useTranslations("common");
  return <p className="text-xs leading-snug text-muted">{t("verifyNote")}</p>;
}
