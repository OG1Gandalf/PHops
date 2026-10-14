import { useTranslations } from "next-intl";

import { LanguageToggle } from "@/components/LanguageToggle";
import { MainNav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/i18n/navigation";

export function Header() {
  const t = useTranslations("meta");
  return (
    <header className="sticky top-0 z-[1200] flex h-[var(--header-h)] items-center gap-2 border-b border-line bg-surface-2/95 px-3 backdrop-blur md:px-5">
      <Link href="/" className="wiggle-hover flex min-h-11 items-center gap-2 rounded-lg pr-2 font-bold text-brand">
        <span className="wiggle-target grid size-8 place-items-center rounded-lg bg-brand text-brand-ink">
          <Icon name="temple" className="size-5" />
        </span>
        <span className="text-base leading-tight md:text-lg">{t("siteName")}</span>
      </Link>
      <MainNav variant="top" />
      <div className="ml-auto flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
