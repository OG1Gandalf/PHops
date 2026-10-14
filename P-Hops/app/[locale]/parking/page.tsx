import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/PageContainer";
import { ParkingClient } from "@/components/pages/ParkingClient";
import { resolveLocale } from "@/i18n/pageLocale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/parking">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/parking",
    title: t("parkingTitle"),
    description: t("parkingDescription"),
    siteName: t("siteName"),
  });
}

export default async function Page({ params }: PageProps<"/[locale]/parking">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "parking" });
  return (
    <PageContainer title={t("title")} intro={t("intro")}>
      <ParkingClient />
    </PageContainer>
  );
}
