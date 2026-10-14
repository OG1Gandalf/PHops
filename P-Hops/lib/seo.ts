import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/** Social preview image (app/og/route.tsx). Pages that define their own openGraph/twitter must repeat it: those objects replace the layout's. */
export const OG_IMAGE = { url: "/og", width: 1200, height: 630, alt: "Kolkata Pujo Guide – Durga Puja pandal hopping map" } as const;

/** Per-page metadata with correct canonical / hreflang for the as-needed locale prefix. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  siteName,
}: {
  locale: string;
  /** path without locale, "/" or "/eateries" */
  path: string;
  title: string;
  description: string;
  siteName: string;
}): Metadata {
  const withLocale = (l: string) => {
    const prefix = l === routing.defaultLocale ? "" : `/${l}`;
    return path === "/" ? prefix || "/" : `${prefix}${path}`;
  };
  return {
    title,
    description,
    alternates: {
      canonical: withLocale(locale),
      languages: { en: withLocale("en"), bn: withLocale("bn"), "x-default": withLocale("en") },
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: withLocale(locale),
      locale: locale === "bn" ? "bn_IN" : "en_IN",
      alternateLocale: locale === "bn" ? ["en_IN"] : ["bn_IN"],
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}
