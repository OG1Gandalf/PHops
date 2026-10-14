import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/PageContainer";
import { RestroomsClient } from "@/components/pages/RestroomsClient";
import { resolveLocale } from "@/i18n/pageLocale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/restrooms">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/restrooms",
    title: t("restroomsTitle"),
    description: t("restroomsDescription"),
    siteName: t("siteName"),
  });
}

export default async function Page({ params }: PageProps<"/[locale]/restrooms">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "restrooms" });
  return (
    <PageContainer title={t("title")} intro={t("intro")}>
      <RestroomsClient />
    </PageContainer>
  );
}
