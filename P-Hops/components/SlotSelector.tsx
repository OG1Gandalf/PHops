"use client";

import { useTranslations } from "next-intl";

import { useApp } from "@/components/AppProvider";
import { SLOT_ORDER } from "@/lib/timeSlot";

const HOURS = {
  morning: "hoursMorning",
  afternoon: "hoursAfternoon",
  evening: "hoursEvening",
  night: "hoursNight",
} as const;

/** Morning / Afternoon / Evening / Late night. Defaults to the current slot in Asia/Kolkata. */
export function SlotSelector({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const t = useTranslations("slots");
  const a11y = useTranslations("a11y");
  const { slot, currentSlot, slotReady, setSlot } = useApp();

  return (
    <div
      role="radiogroup"
      aria-label={a11y("timeSlotGroup")}
      className={`inline-flex rounded-2xl border border-line bg-surface-2/95 p-1 shadow-lg backdrop-blur ${className}`}
    >
      {SLOT_ORDER.map((s) => {
        // the prerendered HTML cannot know the visitor's time: show nothing selected (and no "Now") until the clock is read
        const selected = slotReady && s === slot;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            title={t(HOURS[s])}
            onClick={() => setSlot(s)}
            className={`relative min-h-11 rounded-xl px-2.5 text-[13px] font-semibold leading-tight transition-colors sm:px-4 sm:text-sm ${
              selected ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-3"
            }`}
          >
            {t(s)}
            {!compact && (
              <span className={`block text-[10px] font-medium ${selected ? "opacity-90" : "text-muted"}`}>
                {slotReady && s === currentSlot ? t("now") : "\u00a0"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
