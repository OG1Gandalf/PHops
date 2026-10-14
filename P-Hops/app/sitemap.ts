import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { INDEXABLE, SITE_URL } from "@/lib/site";

const PATHS = ["/", "/pandals", "/eateries", "/events", "/parking", "/restrooms", "/near-me", "/more"];

const url = (locale: string, path: string) => {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${SITE_URL}${path === "/" ? prefix || "/" : `${prefix}${path}`}`;
};

export default function sitemap(): MetadataRoute.Sitemap {
  if (!INDEXABLE) return [];
  return routing.locales.flatMap((locale) =>
    PATHS.map((path) => ({
      url: url(locale, path),
      changeFrequency: "daily" as const,
      priority: path === "/" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])),
      },
    })),
  );
}
