"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { LocationPrompt } from "@/components/PlaceBits";
import { SaveButton } from "@/components/SaveButton";
import { CrowdBadge } from "@/components/ui/CrowdBadge";
import { Icon } from "@/components/ui/Icon";
import { loadEateries, PANDALS } from "@/lib/data";
import { MINUTES_PER_STOP, planEvening } from "@/lib/discover";
import { formatDistance } from "@/lib/geo";
import { useLazy } from "@/lib/useLazy";

/** "Plan my evening": three quieter pandals in a sensible walking order, then a snack. A suggestion, not a route engine. */
export function EveningPlan() {
  const t = useTranslations("plan");
  const tz = useTranslations("zones");
  const { getCrowd, location, selectPandal, focusMap } = useApp();
  const [seed, setSeed] = useState(0); // 0 = the best plan; shuffle picks a new seed from the click handler
  const eateries = useLazy(loadEateries, true);

  const plan = useMemo(
    () =>
      planEvening({
        candidates: PANDALS.map((pandal) => ({ pandal, crowd: getCrowd(pandal) })),
        origin: location,
        seed,
        eateries: eateries.data,
      }),
    [getCrowd, location, seed, eateries.data],
  );

  const hours = Math.floor(plan.totalMinutes / 60);
  const minutes = plan.totalMinutes % 60;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-gold bg-gold-soft p-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <span aria-hidden="true">🗺️</span>
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-ink">{location ? t("introNear") : t("introAnywhere")}</p>
        <p className="mt-1 text-xs text-muted">{t("timeNote", { hours, minutes, perStop: MINUTES_PER_STOP })}</p>
        <button
          type="button"
          onClick={() => setSeed(Math.max(Date.now(), seed + 1))}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-bold text-ink hover:bg-surface-3"
        >
          <span aria-hidden="true">🔀</span>
          {t("shuffle")}
        </button>
      </div>

      <LocationPrompt />

      <ol key={seed} className="space-y-0">
        {plan.stops.map((s, i) => (
          <li key={s.pandal.id} className="rise" style={{ ["--i" as string]: i }}>
            {s.walkMin !== null && (
              <p className="ml-4 flex items-center gap-2 border-l-2 border-dashed border-line py-2 pl-6 text-xs font-semibold text-muted">
                <Icon name="walk" className="size-4" />
                {i === 0 ? t("walkToFirst", { minutes: s.walkMin, distance: formatDistance(s.walkKm ?? 0) }) : t("walkNext", { minutes: s.walkMin, distance: formatDistance(s.walkKm ?? 0) })}
              </p>
            )}
            <div className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-base font-extrabold text-brand-ink" aria-label={t("stopNumber", { n: i + 1 })}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-snug text-ink">{s.pandal.name}</h3>
                <p className="text-sm text-muted">
                  {s.pandal.area} · {tz(s.pandal.zone)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CrowdBadge level={s.crowd.level} source={s.crowd.source} size="sm" />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      selectPandal(s.pandal.id);
                      focusMap(s.pandal, 16, true);
                    }}
                    className="min-h-11 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
                  >
                    {t("details")}
                    <span className="sr-only">: {s.pandal.name}</span>
                  </button>
                  <SaveButton pandalId={s.pandal.id} name={s.pandal.name} />
                </div>
              </div>
            </div>
          </li>
        ))}

        {plan.eatery && (
          <li className="rise" style={{ ["--i" as string]: plan.stops.length }}>
            <p className="ml-4 flex items-center gap-2 border-l-2 border-dashed border-line py-2 pl-6 text-xs font-semibold text-muted">
              <Icon name="walk" className="size-4" />
              {t("walkNext", { minutes: plan.eatery.walkMin, distance: formatDistance(plan.eatery.km) })}
            </p>
            <div className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft text-lg">
                🍧
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-gold">{t("snackStop")}</p>
                <h3 className="text-base font-bold leading-snug text-ink">{plan.eatery.eatery.name}</h3>
                {plan.eatery.eatery.famousFor && <p className="text-sm text-muted">{plan.eatery.eatery.famousFor}</p>}
                <p className="mt-1 text-xs text-muted">{t("verifyNote")}</p>
              </div>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
