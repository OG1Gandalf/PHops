import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/PageContainer";
import { EateriesClient } from "@/components/pages/EateriesClient";
import { resolveLocale } from "@/i18n/pageLocale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/eateries">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/eateries",
    title: t("eateriesTitle"),
    description: t("eateriesDescription"),
    siteName: t("siteName"),
  });
}

export default async function Page({ params }: PageProps<"/[locale]/eateries">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "eateries" });
  return (
    <PageContainer title={t("title")} intro={t("intro")}>
      <EateriesClient />
    </PageContainer>
  );
}
