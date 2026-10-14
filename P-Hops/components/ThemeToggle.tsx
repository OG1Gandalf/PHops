"use client";

import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui/Icon";

import { useTheme } from "./theme";

export function ThemeToggle() {
  const t = useTranslations("header");
  const { isDark, set } = useTheme();
  return (
    <button
      type="button"
      onClick={() => set(isDark ? "light" : "dark")}
      aria-label={t("theme")}
      aria-pressed={isDark}
      className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-3"
    >
      <Icon name={isDark ? "sun" : "moon"} className="size-5" />
    </button>
  );
}
