import { useTranslations } from "next-intl";

import { CROWD_FACE } from "@/components/ui/CrowdBadge";
import type { CrowdLevel } from "@/lib/types";

const POS: Record<CrowdLevel, string> = { low: "16.67%", medium: "50%", high: "83.33%" };

/**
 * A three-zone gauge (Low | Medium | High) with a face that slides to the current level.
 * The zones are labelled with text and the marker has a face, so colour is never the only signal.
 * The slide is a one-off CSS animation (disabled for reduced-motion users).
 */
export function CrowdMeter({ level, muted = false }: { level: CrowdLevel | null; muted?: boolean }) {
  const t = useTranslations("crowd");
  return (
    <div role="img" aria-label={level ? t("label", { level: t(level) }) : t("noLiveData")} className="select-none">
      <div className="relative h-3 rounded-full" style={{ background: "var(--meter-track)" }}>
        <div className="absolute inset-0 grid grid-cols-3 gap-[3px] overflow-hidden rounded-full">
          <i className="block" style={{ background: "var(--crowd-low)", opacity: muted ? 0.35 : 0.9 }} />
          <i className="block" style={{ background: "var(--crowd-medium)", opacity: muted ? 0.35 : 0.9 }} />
          <i className="block" style={{ background: "var(--crowd-high)", opacity: muted ? 0.35 : 0.9 }} />
        </div>
        {level && (
          <span
            key={level}
            className={`meter-marker absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-surface-2 text-lg shadow-md crowd-${level}`}
            style={{ ["--to" as string]: POS[level] }}
          >
            <span aria-hidden="true">{CROWD_FACE[level]}</span>
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 text-center text-[11px] font-semibold text-muted" aria-hidden="true">
        <span>{t("low")}</span>
        <span>{t("medium")}</span>
        <span>{t("high")}</span>
      </div>
    </div>
  );
}
