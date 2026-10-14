import { useTranslations } from "next-intl";

import type { DisplayedCrowd } from "@/lib/crowdService";
import type { CrowdLevel } from "@/lib/types";

/** Decorative faces; the level is always also given as text and bar count. */
export const CROWD_FACE: Record<CrowdLevel, string> = { low: "😌", medium: "😅", high: "🥵" };

const FILLED: Record<CrowdLevel, number> = { low: 1, medium: 2, high: 3 };

/** Signal-style bars: the number of filled bars encodes the level without relying on colour. */
export function CrowdBars({ level, className = "" }: { level: CrowdLevel; className?: string }) {
  return (
    <span className={`inline-flex items-end gap-[2px] ${className}`} aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <i
          key={n}
          className="block w-[4px] rounded-[1px] bg-current"
          style={{ height: 4 + n * 3, opacity: n <= FILLED[level] ? 1 : 0.25 }}
        />
      ))}
    </span>
  );
}

export function CrowdBadge({
  level,
  source,
  size = "md",
}: {
  level: CrowdLevel;
  source?: DisplayedCrowd["source"];
  size?: "sm" | "md" | "lg";
}) {
  const t = useTranslations("crowd");
  const text = t(level);
  const pad = size === "lg" ? "px-3 py-1.5 text-base" : size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`crowd-${level} inline-flex items-center gap-1.5 rounded-full border font-semibold ${pad}`}
      title={t("label", { level: text })}
    >
      <span aria-hidden="true">{CROWD_FACE[level]}</span>
      <CrowdBars level={level} />
      <span>{text}</span>
      {source === "estimate" && <span className="font-normal opacity-80">· {t("estimated")}</span>}
    </span>
  );
}
