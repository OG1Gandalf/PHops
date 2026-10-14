"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageToggle() {
  const t = useTranslations("header");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === "en" ? "bn" : "en";
  return (
    <button
      type="button"
      lang={next}
      style={{ fontFamily: "var(--font-bn-toggle), var(--font-inter), system-ui, sans-serif" }}
      onClick={() => router.replace(pathname, { locale: next })}
      // WCAG 2.5.3 label-in-name: the accessible name starts with the visible text
      aria-label={`${t("switchLanguageShort")} – ${t("switchLanguage")}`}
      className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-line px-3 text-sm font-semibold text-ink hover:bg-surface-3"
    >
      {t("switchLanguageShort")}
    </button>
  );
}
