"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { useToast } from "@/components/ToastProvider";
import { CROWD_FACE, CrowdBars } from "@/components/ui/CrowdBadge";
import { CROWD_RULES } from "@/config/puja";
import { CROWD_LEVELS, submitCrowdReport } from "@/lib/crowdService";
import { crowdCooldownLeft, getDeviceId, markCrowdReported } from "@/lib/device";
import type { CrowdLevel, Pandal } from "@/lib/types";

type Msg = { kind: "ok" | "error"; text: string } | null;

/** "Report crowd now": three large Low / Medium / High buttons. */
export function CrowdReport({ pandal }: { pandal: Pandal }) {
  const t = useTranslations("crowd");
  const { refreshCrowd } = useApp();
  const [sending, setSending] = useState<CrowdLevel | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const [burst, setBurst] = useState<CrowdLevel | null>(null);
  const toast = useToast();

  // Local (client-side) 10-minute cooldown; the server enforces the same rule independently.
  useEffect(() => {
    const update = () => setCooldown(crowdCooldownLeft(pandal.id, CROWD_RULES.cooldownMinutes));
    update();
    const id = setInterval(update, 15_000);
    return () => clearInterval(id);
  }, [pandal.id]);

  async function report(level: CrowdLevel) {
    if (sending) return;
    const left = crowdCooldownLeft(pandal.id, CROWD_RULES.cooldownMinutes);
    if (left > 0) {
      setCooldown(left);
      setMsg({ kind: "error", text: t("reportCooldown", { minutes: left }) });
      return;
    }
    setSending(level);
    setMsg(null);
    const res = await submitCrowdReport(pandal.id, level, getDeviceId());
    setSending(null);
    if (res.ok) {
      markCrowdReported(pandal.id);
      setCooldown(CROWD_RULES.cooldownMinutes);
      setMsg(null);
      setBurst(level);
      setTimeout(() => setBurst(null), 700);
      toast({ emoji: "🙌", text: t("reportThanks"), tone: "good" });
      void refreshCrowd();
      return;
    }
    if (res.code === "cooldown") {
      const mins = res.retryAfterMinutes ?? CROWD_RULES.cooldownMinutes;
      markCrowdReported(pandal.id, CROWD_RULES.cooldownMinutes - mins);
      setCooldown(mins);
      setMsg({ kind: "error", text: t("reportCooldown", { minutes: mins }) });
    } else if (res.code === "rate_limited") {
      setMsg({ kind: "error", text: t("reportRateLimited") });
    } else if (res.code === "not_configured") {
      setMsg({ kind: "error", text: t("reportUnavailable") });
    } else {
      setMsg({ kind: "error", text: t("reportFailed") });
    }
  }

  const disabled = cooldown > 0 || sending !== null;

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div>
        <h4 className="text-sm font-bold text-ink">{t("reportTitle")}</h4>
        <p className="text-xs text-muted">{t("reportHelp")}</p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("reportTitle")}>
        {CROWD_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => report(level)}
            className={`crowd-${level} relative flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-2 text-base font-bold disabled:cursor-not-allowed disabled:opacity-55`}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {CROWD_FACE[level]}
            </span>
            <span className="flex items-center gap-1.5">
              <CrowdBars level={level} />
              {sending === level ? t("reporting") : t(level)}
            </span>
            {burst === level && (
              <span className="burst" aria-hidden="true">
                {[0, 60, 120, 180, 240, 300].map((a, i) => (
                  <i key={a} style={{ ["--a" as string]: `${a}deg`, ["--c" as string]: i % 2 ? "var(--gold)" : "var(--crowd-low)" }} />
                ))}
              </span>
            )}
          </button>
        ))}
      </div>
      {cooldown > 0 && !msg && <p className="text-xs text-muted">{t("reportCooldown", { minutes: cooldown })}</p>}
      <p
        role="status"
        aria-live="polite"
        className={`text-sm font-medium ${msg?.kind === "ok" ? "text-[var(--crowd-low)]" : "text-[var(--crowd-high)]"}`}
      >
        {msg?.text}
      </p>
    </div>
  );
}
