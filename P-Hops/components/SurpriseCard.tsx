"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { SaveButton } from "@/components/SaveButton";
import { CrowdBadge } from "@/components/ui/CrowdBadge";
import { Icon } from "@/components/ui/Icon";
import { PANDALS } from "@/lib/data";
import { pickSurprise } from "@/lib/discover";
import { formatDistance, walkingMinutes } from "@/lib/geo";

/** "Surprise me": suggests a pandal (leaning quiet and close), with a spin-again button. */
export function SurpriseCard() {
  const t = useTranslations("surprise");
  const tz = useTranslations("zones");
  const tcr = useTranslations("crowd");
  const app = useApp();
  const { surprise, spinSurprise, closeSurprise, selectPandal, focusMap, getCrowd, location } = app;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Pick once per spin and keep it: a background crowd refresh must not swap the card under the user's thumb.
  const [shown, setShown] = useState<{ seed: number; result: ReturnType<typeof pickSurprise> } | null>(null);
  if (surprise && shown?.seed !== surprise.seed) {
    const candidates = PANDALS.map((pandal) => ({ pandal, crowd: getCrowd(pandal) }));
    setShown({ seed: surprise.seed, result: pickSurprise({ candidates, origin: location, seed: surprise.seed, skip: surprise.skip }) });
  }
  const result = surprise && shown?.seed === surprise.seed ? shown.result : null;

  useEffect(() => {
    if (!surprise) return;
    headingRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSurprise();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [surprise, closeSurprise]);

  if (!surprise || !result) return null;
  const { pick, km } = result;
  const { pandal, crowd } = pick;

  const reasons: string[] = [];
  if (crowd.level === "low") reasons.push(t("reasonQuiet"));
  if (km !== null) reasons.push(t("reasonWalk", { minutes: walkingMinutes(km), distance: formatDistance(km) }));
  if (pandal.tags.includes("heritage")) reasons.push(t("reasonHeritage"));
  if (pandal.tags.includes("theme")) reasons.push(t("reasonTheme"));

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="surprise-h"
      className="pop fixed inset-x-3 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+0.75rem)] z-[1300] mx-auto max-w-sm rounded-3xl border-2 border-gold bg-surface-2 p-4 shadow-2xl md:inset-x-auto md:bottom-6 md:left-6 md:mx-0"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-gold">
          <span key={surprise.seed} aria-hidden="true" className="inline-block text-2xl leading-none [animation:roll_0.5s_ease-in-out]">
            🎲
          </span>
          {t("kicker")}
        </p>
        <button
          type="button"
          onClick={closeSurprise}
          aria-label={t("close")}
          className="grid size-11 place-items-center rounded-full bg-surface-3 text-ink hover:bg-line"
        >
          <Icon name="x" className="size-5" />
        </button>
      </div>

      <div key={surprise.seed} className="pop mt-2">
        <h2 id="surprise-h" ref={headingRef} tabIndex={-1} className="text-xl font-extrabold leading-tight text-ink outline-none">
          {pandal.name}
        </h2>
        <p className="text-sm text-muted">
          {pandal.area} · {tz(pandal.zone)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CrowdBadge level={crowd.level} source={crowd.source} size="sm" />
          {reasons.map((r) => (
            <span key={r} className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold">
              {r}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">{crowd.source === "visitors" ? tcr("sourceVisitors") : tcr("sourceEstimate")}</p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            selectPandal(pandal.id);
            focusMap(pandal, 16, true);
            closeSurprise();
          }}
          className="min-h-11 flex-1 rounded-xl bg-brand px-3 text-sm font-bold text-brand-ink hover:bg-brand-hover"
        >
          {t("go")}
        </button>
        <button
          type="button"
          onClick={() => spinSurprise(pandal.id)}
          className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink hover:bg-surface-3"
        >
          {t("again")}
        </button>
        <SaveButton pandalId={pandal.id} name={pandal.name} />
      </div>
    </section>
  );
}
