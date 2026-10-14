import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DetailSheet } from "@/components/DetailSheet";
import { Header } from "@/components/Header";
import { LocationBanners } from "@/components/location/LocationBanners";
import { MainNav } from "@/components/Nav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SurpriseCard } from "@/components/SurpriseCard";

export function Shell({ children }: { children: ReactNode }) {
  const a11y = useTranslations("a11y");
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[2000] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-3 focus:text-brand-ink"
      >
        {a11y("skipToContent")}
      </a>
      <Header />
      <OfflineBanner />
      <LocationBanners />
      <main id="main" className="flex-1 pb-[var(--nav-h)] md:pb-0">
        {children}
      </main>
      <MainNav variant="bottom" />
      <DetailSheet />
      <SurpriseCard />
    </div>
  );
}
