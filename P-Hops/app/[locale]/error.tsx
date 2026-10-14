"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Error boundary for every page under a locale. The header, bottom navigation and language toggle live in the layout
 * above it, so they stay usable; only the broken page is replaced by this message. `error.message` is never shown.
 */
export default function LocaleError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errors");
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-14 text-center">
      <p aria-hidden="true" className="text-5xl">
        🪔
      </p>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">{t("title")}</h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">{t("body")}</p>
      <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-12 rounded-xl bg-brand px-6 font-semibold text-brand-ink hover:bg-brand-hover"
        >
          {t("retry")}
        </button>
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 px-6 font-semibold text-ink hover:bg-surface-3">
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
