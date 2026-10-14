"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { useLocation } from "@/components/LocationProvider";
import { useToast } from "@/components/ToastProvider";
import { Icon } from "@/components/ui/Icon";

import { LocationFallback } from "./LocationFallback";
import { useLocationErrorMessage } from "./useLocationMessage";

/**
 * Banners under the header: the in-app-browser warning and (at most one) location banner.
 * Each is dismissible, none blocks the page.
 */
export function LocationBanners() {
  const { banner, env, picking } = useLocation();
  const [inAppClosed, setInAppClosed] = useState(false);
  const showInApp = !!env.inApp && !inAppClosed;
  if (picking || (!banner && !showInApp)) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[var(--header-h)] z-[1250] flex max-h-[calc(100dvh-var(--header-h)-var(--nav-h))] flex-col items-center gap-2 overflow-y-auto p-2 md:max-h-[calc(100dvh-var(--header-h))]">
      {showInApp && <InAppBanner onClose={() => setInAppClosed(true)} />}
      {banner && <LocationBanner kind={banner} />}
    </div>
  );
}

function Card({ children, tone = "default", label }: { children: ReactNode; tone?: "default" | "warn"; label: string }) {
  return (
    <section
      role="region"
      aria-label={label}
      aria-live="polite"
      className={`pop pointer-events-auto w-full max-w-md rounded-2xl border-2 bg-surface-2 p-3.5 shadow-xl ${
        tone === "warn" ? "border-gold" : "border-line"
      }`}
    >
      {children}
    </section>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("location");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("close")}
      className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-3"
    >
      <Icon name="x" className="size-5" />
    </button>
  );
}

/** "Pick your area instead" collapsed by default so the banner stays short on a phone. */
function FallbackToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("location");
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-11 rounded-lg px-1 text-sm font-semibold text-brand underline"
      >
        {t("pickAreaInstead")}
      </button>
      {open && <LocationFallback className="mt-1" />}
    </div>
  );
}

function Privacy() {
  const t = useTranslations("location");
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-muted">
      <span aria-hidden="true">🔒</span>
      {t("privacy")}
    </p>
  );
}

function PrimaryButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60"
    >
      <Icon name="locate" className="size-5" />
      {children}
    </button>
  );
}

function LocationBanner({ kind }: { kind: NonNullable<ReturnType<typeof useLocation>["banner"]> }) {
  const t = useTranslations("location");
  const { ask, dismissBanner, needsGesture, error, env, locating } = useLocation();
  const describe = useLocationErrorMessage();
  const close = () => dismissBanner(kind);

  if (kind === "prompt") {
    return (
      <Card label={t("promptTitle")}>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl leading-none">
            📍
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-ink">{t("promptTitle")}</p>
            <p className="mt-1 text-xs text-muted">{needsGesture ? t("promptWaiting") : t("finding")}</p>
          </div>
          <CloseButton onClick={close} />
        </div>
        {needsGesture && (
          <div className="mt-3">
            <PrimaryButton onClick={ask}>{t("useMyLocation")}</PrimaryButton>
          </div>
        )}
        <FallbackToggle className="mt-1" />
        <Privacy />
      </Card>
    );
  }

  if (kind === "dismissed") {
    return (
      <Card label={t("dismissedTitle")}>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl leading-none">
            🙂
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-ink">{t("dismissedTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("dismissedBody")}</p>
          </div>
          <CloseButton onClick={close} />
        </div>
        <div className="mt-3">
          <PrimaryButton onClick={ask} disabled={locating}>
            {t("useMyLocation")}
          </PrimaryButton>
        </div>
        <FallbackToggle className="mt-1" />
        <Privacy />
      </Card>
    );
  }

  if (kind === "blocked") {
    const platform = env.platform === "ios" ? "Ios" : env.platform === "android" ? "Android" : "Desktop";
    return (
      <Card label={t("blockedTitle")} tone="warn">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl leading-none">
            🚫
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-ink">{t("blockedTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("blockedBody")}</p>
          </div>
          <CloseButton onClick={close} />
        </div>
        <details className="group mt-3 rounded-xl bg-surface-3 px-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
            {t("stepsHeading")}
            <Icon name="down" className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <p className="text-sm font-semibold text-ink">{t(`steps${platform}Title`)}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>{t(`steps${platform}1`)}</li>
            <li>{t(`steps${platform}2`)}</li>
            <li>{t(`steps${platform}3`)}</li>
          </ol>
          <div className="h-3" />
        </details>
        <div className="mt-3">
          <button
            type="button"
            onClick={ask}
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-3"
          >
            {t("tryAgain")}
          </button>
        </div>
        <FallbackToggle className="mt-1" />
        <Privacy />
      </Card>
    );
  }

  if (kind === "unavailable") {
    const retryable = error?.code !== "unsupported" && error?.code !== "insecure_context";
    return (
      <Card label={t("unavailableTitle")}>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl leading-none">
            🛰️
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-ink">{t("unavailableTitle")}</p>
            <p className="mt-1 text-sm text-muted">{describe(error)}</p>
          </div>
          <CloseButton onClick={close} />
        </div>
        {retryable && (
          <div className="mt-3">
            <PrimaryButton onClick={ask} disabled={locating}>
              {locating ? t("finding") : t("tryAgain")}
            </PrimaryButton>
          </div>
        )}
        <FallbackToggle className="mt-1" />
      </Card>
    );
  }

  // outside Kolkata
  return (
    <Card label={t("outsideTitle")} tone="warn">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          🌏
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-ink">{t("outsideTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("outsideBody")}</p>
        </div>
        <CloseButton onClick={close} />
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={close}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-bold text-brand-ink hover:bg-brand-hover"
        >
          <Icon name="map" className="size-5" />
          {t("browseMap")}
        </button>
      </div>
      <FallbackToggle className="mt-1" />
    </Card>
  );
}

function InAppBanner({ onClose }: { onClose: () => void }) {
  const t = useTranslations("location");
  const { env } = useLocation();
  const toast = useToast();

  async function copy() {
    const url = window.location.href; // the page address only: no coordinates are ever part of it
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API is often missing in in-app browsers: fall back to a hidden textarea
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("copy failed");
      } catch {
        toast({ emoji: "⚠️", text: t("copyFailed"), tone: "warn" });
        return;
      }
    }
    toast({ emoji: "🔗", text: t("linkCopied"), tone: "good" });
  }

  return (
    <Card label={t("inAppTitle")} tone="warn">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          🌐
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-ink">{t("inAppTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("inAppBody", { app: env.inApp ?? "other" })}</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-3"
      >
        <Icon name="external" className="size-4" />
        {t("copyLink")}
      </button>
    </Card>
  );
}
