import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/PageContainer";
import { NearMeClient } from "@/components/pages/NearMeClient";
import { resolveLocale } from "@/i18n/pageLocale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/near-me">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/near-me",
    title: t("nearMeTitle"),
    description: t("nearMeDescription"),
    siteName: t("siteName"),
  });
}

export default async function Page({ params }: PageProps<"/[locale]/near-me">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "nearMe" });
  return (
    <PageContainer title={t("title")} intro={t("intro")}>
      <NearMeClient />
    </PageContainer>
  );
}
