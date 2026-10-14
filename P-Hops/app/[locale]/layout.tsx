import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppProvider } from "@/components/AppProvider";
import { LocationProvider } from "@/components/LocationProvider";
import { Shell } from "@/components/Shell";
import { ToastProvider } from "@/components/ToastProvider";
import { THEME_INIT_SCRIPT } from "@/components/theme";
import { routing } from "@/i18n/routing";
import { OG_IMAGE } from "@/lib/seo";
import { INDEXABLE, SITE_URL } from "@/lib/site";

import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Bengali glyphs are only downloaded when a Bengali character is actually rendered.
const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
  preload: false,
});
// 2 KB subset of Noto Sans Bengali holding only the letters of the language toggle ("বাংলা"). Without it the English
// pages would download the whole 106 KB Bengali font just to draw that one button. Regenerate with pyftsubset if the label changes.
const bengaliToggle = localFont({ src: "../fonts/bengali-toggle.woff2", variable: "--font-bn-toggle", weight: "100 900", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s | ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    alternates: {
      canonical: locale === routing.defaultLocale ? "/" : `/${locale}`,
      languages: { en: "/", bn: "/bn", "x-default": "/" },
    },
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("title"),
      description: t("description"),
      locale: locale === "bn" ? "bn_IN" : "en_IN",
      alternateLocale: locale === "bn" ? ["en_IN"] : ["bn_IN"],
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: [OG_IMAGE] },
    robots: { index: INDEXABLE, follow: INDEXABLE },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#a81d1d" },
    { media: "(prefers-color-scheme: dark)", color: "#17100d" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Enables static rendering for this locale (no per-request header reads)
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${inter.variable} ${bengali.variable} ${bengaliToggle.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <ToastProvider>
            <LocationProvider>
              <AppProvider>
                <Shell>{children}</Shell>
              </AppProvider>
            </LocationProvider>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
