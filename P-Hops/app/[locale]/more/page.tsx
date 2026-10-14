import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/PageContainer";
import { MoreClient } from "@/components/pages/MoreClient";
import { resolveLocale } from "@/i18n/pageLocale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/more">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/more",
    title: t("moreTitle"),
    description: t("moreDescription"),
    siteName: t("siteName"),
  });
}

export default async function Page({ params }: PageProps<"/[locale]/more">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "more" });
  return (
    <PageContainer title={t("title")}>
      <MoreClient />
    </PageContainer>
  );
}
