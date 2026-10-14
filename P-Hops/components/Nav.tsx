"use client";

import { useTranslations } from "next-intl";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS: { href: "/" | "/pandals" | "/eateries" | "/events" | "/more"; key: "map" | "pandals" | "eateries" | "events" | "more"; icon: IconName }[] = [
  { href: "/", key: "map", icon: "map" },
  { href: "/pandals", key: "pandals", icon: "temple" },
  { href: "/eateries", key: "eateries", icon: "utensils" },
  { href: "/events", key: "events", icon: "calendar" },
  { href: "/more", key: "more", icon: "grid" },
];

/** `bottom` = mobile tab bar, `top` = desktop links inside the header. */
export function MainNav({ variant }: { variant: "bottom" | "top" }) {
  const t = useTranslations("nav");
  const a11y = useTranslations("a11y");
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  if (variant === "top") {
    return (
      <nav aria-label={a11y("mainNav")} className="ml-4 hidden items-center gap-1 md:flex">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive(i.href) ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
              isActive(i.href) ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface-3"
            }`}
          >
            <Icon name={i.icon} className="size-4" />
            {t(i.key)}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label={a11y("mainNav")}
      className="fixed inset-x-0 bottom-0 z-[1200] border-t border-line bg-surface-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid h-[var(--nav-h)] grid-cols-5">
        {ITEMS.map((i) => {
          const active = isActive(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                <span
                  className={`grid h-7 w-14 place-items-center rounded-full transition-colors ${active ? "bg-brand-soft" : ""}`}
                >
                  <Icon name={i.icon} className="size-5" />
                </span>
                {t(i.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
