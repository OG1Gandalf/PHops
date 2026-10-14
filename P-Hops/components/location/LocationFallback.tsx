"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { useLocation } from "@/components/LocationProvider";
import { Icon } from "@/components/ui/Icon";
import { usePathname, useRouter } from "@/i18n/navigation";
import { loadAreas } from "@/lib/data";
import { useLazy } from "@/lib/useLazy";

/** Dropdown of Kolkata neighbourhoods. Picking one sets the point used for every "near me" feature. */
export function AreaPicker({ label, className = "" }: { label?: string; className?: string }) {
  const t = useTranslations("location");
  const { manual, setManual } = useLocation();
  const areas = useLazy(loadAreas, true);
  const id = useId();
  const value = manual?.kind === "area" ? (manual.areaId ?? "") : "";

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted">
        {label ?? t("pickerLabel")}
      </label>
      <select
        id={id}
        disabled={!areas.data}
        value={value}
        onChange={(e) => {
          const a = areas.data?.find((x) => x.id === e.target.value);
          if (a) setManual({ lat: a.lat, lng: a.lng, kind: "area", label: a.name, areaId: a.id });
        }}
        className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-base text-ink disabled:opacity-60"
      >
        <option value="">{t("pickerPlaceholder")}</option>
        {areas.data?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Starts "tap the map to set your point" (taking you to the map first if you are elsewhere). */
export function PickOnMapButton({ className = "" }: { className?: string }) {
  const t = useTranslations("location");
  const { startPicking } = useLocation();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      onClick={() => {
        startPicking();
        if (pathname !== "/") router.push("/");
      }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold text-ink hover:bg-surface-3 ${className}`}
    >
      <Icon name="map" className="size-4" />
      {t("pickOnMap")}
    </button>
  );
}

/** Both manual options together: used wherever location is denied, unavailable or simply not given yet. */
export function LocationFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <AreaPicker />
      <PickOnMapButton className="w-full sm:w-auto" />
    </div>
  );
}
