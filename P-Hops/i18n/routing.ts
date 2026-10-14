import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
  // English lives at "/", Bengali at "/bn"
  localePrefix: "as-needed",
  // Never guess from Accept-Language: keep URLs predictable & cacheable on the CDN.
  localeDetection: false,
  // hreflang is declared once, in the page metadata (lib/seo.ts), against the canonical site URL. next-intl's own Link
  // header would be built from the request host and can disagree with the canonical URL (Lighthouse: "points to another hreflang location").
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
