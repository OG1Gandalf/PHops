import type { Metadata } from "next";
import { preconnect, preload } from "react-dom";
import { getTranslations } from "next-intl/server";

import { MapScreen } from "@/components/map/MapScreen";
import { resolveLocale } from "@/i18n/pageLocale";
import { MAP_CONFIG } from "@/config/puja";
import { pageMetadata } from "@/lib/seo";
import { initialTileUrls } from "@/lib/tiles";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  // absolute: the home page title is already complete (no "| site name" suffix)
  return {
    ...pageMetadata({ locale, path: "/", title: t("title"), description: t("description"), siteName: t("siteName") }),
    title: { absolute: t("title") },
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  // The first map paint waits for JS (map chunk) and then for tiles from another origin. Opening that connection and
  // fetching the four tiles around the default view now, while the scripts load, shortens the chain.
  preconnect(new URL(MAP_CONFIG.tileUrl).origin);
  for (const href of initialTileUrls(MAP_CONFIG)) preload(href, { as: "image", fetchPriority: "high" });
  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <MapScreen />
    </>
  );
}
