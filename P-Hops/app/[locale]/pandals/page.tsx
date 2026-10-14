import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageContainer } from "@/components/PageContainer";
import { PandalsClient } from "@/components/pages/PandalsClient";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { resolveLocale } from "@/i18n/pageLocale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/pandals">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/pandals",
    title: t("pandalsTitle"),
    description: t("pandalsDescription"),
    siteName: t("siteName"),
  });
}

export default async function Page({ params }: PageProps<"/[locale]/pandals">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pandalsPage" });
  return (
    <PageContainer title={t("title")}>
      {/* PandalsClient reads ?tab= from the URL, so it must sit in a Suspense boundary (static shell + client fill-in) */}
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <PandalsClient />
      </Suspense>
    </PageContainer>
  );
}
