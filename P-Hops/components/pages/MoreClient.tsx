"use client";

import { useLocale, useTranslations } from "next-intl";

import { Segmented } from "@/components/ui/controls";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTheme, type ThemeChoice } from "@/components/theme";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const LINKS: { href: "/parking" | "/restrooms" | "/near-me"; key: "parking" | "restrooms" | "nearMe"; icon: IconName }[] = [
  { href: "/near-me", key: "nearMe", icon: "locate" },
  { href: "/parking", key: "parking", icon: "parking" },
  { href: "/restrooms", key: "restrooms", icon: "person" },
];

export function MoreClient() {
  const t = useTranslations("more");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { choice, set } = useTheme();

  return (
    <>
      <section aria-labelledby="more-explore" className="space-y-2">
        <h2 id="more-explore" className="text-lg font-extrabold text-ink">{t("explore")}</h2>
        <ul className="space-y-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:bg-surface-3"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon name={l.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">{t(l.key)}</span>
                  <span className="block text-sm text-muted">{t(`${l.key}Desc`)}</span>
                </span>
                <Icon name="right" className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="more-settings" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="more-settings" className="text-lg font-extrabold text-ink">{t("settings")}</h2>
        <div>
          <p className="mb-1 text-sm font-semibold text-muted">{t("language")}</p>
          <Segmented<Locale>
            label={t("language")}
            value={locale}
            onChange={(next) => router.replace(pathname, { locale: next })}
            options={[
              { value: "en", label: t("english") },
              { value: "bn", label: t("bengali") },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-muted">{t("theme")}</p>
          <Segmented<ThemeChoice>
            label={t("theme")}
            value={choice}
            onChange={set}
            options={[
              { value: "system", label: t("themeSystem") },
              { value: "light", label: t("themeLight"), icon: "sun" },
              { value: "dark", label: t("themeDark"), icon: "moon" },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="more-about" className="space-y-2 text-[15px] leading-snug text-ink">
        <h2 id="more-about" className="text-lg font-extrabold">{t("about")}</h2>
        <p>{t("aboutText")}</p>
        <h3 className="pt-2 font-bold">{t("dataHeading")}</h3>
        <p className="text-muted">{t("dataText")}</p>
        {locale === "bn" && <p className="rounded-xl bg-[var(--gold-soft)] p-3 text-sm font-medium">{t("translationNote")}</p>}
        <p className="text-sm text-muted">{t("credits")}</p>
      </section>
    </>
  );
}
