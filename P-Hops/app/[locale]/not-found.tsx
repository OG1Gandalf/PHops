import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <div className="mx-auto max-w-md px-4 py-14 text-center">
      <p aria-hidden="true" className="text-6xl font-bold text-brand">
        404
      </p>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">{t("notFoundBody")}</p>
      <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-brand px-6 font-semibold text-brand-ink hover:bg-brand-hover">
        {t("home")}
      </Link>
    </div>
  );
}
