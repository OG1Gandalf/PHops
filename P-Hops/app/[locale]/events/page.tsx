import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/PageContainer";
import { EventsClient } from "@/components/pages/EventsClient";
import { resolveLocale } from "@/i18n/pageLocale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/events">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/events",
    title: t("eventsTitle"),
    description: t("eventsDescription"),
    siteName: t("siteName"),
  });
}

export default async function Page({ params }: PageProps<"/[locale]/events">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "events" });
  return (
    <PageContainer title={t("title")} intro={t("intro")}>
      <EventsClient />
    </PageContainer>
  );
}
