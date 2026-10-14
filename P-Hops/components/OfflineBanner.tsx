"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/Icon";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Gentle notice while the browser reports no connection. The server (and first client render) assume online. */
export function OfflineBanner() {
  const t = useTranslations("offline");
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p role="status" className="flex items-start gap-2 border-b border-line bg-[var(--gold-soft)] px-4 py-2 text-sm font-medium text-ink">
      <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" />
      {t("banner")}
    </p>
  );
}
