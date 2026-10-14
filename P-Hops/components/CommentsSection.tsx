"use client";

import { useNow, useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { COMMENT_RULES } from "@/config/puja";
import { getDeviceId, getReportedComments, getSavedName, markCommentReported, saveName } from "@/lib/device";
import type { CommentDTO } from "@/lib/types";

type LoadState = "idle" | "loading" | "error" | "unavailable";

export function CommentsSection({ pandalId }: { pandalId: string }) {
  const t = useTranslations("comments");
  const tcm = useTranslations("common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [loadedOnce, setLoadedOnce] = useState(false);

  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [reported, setReported] = useState<string[]>([]);
  const toast = useToast();

  const abort = useRef<AbortController | null>(null);

  const load = useCallback(
    async (after: string | null) => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setState("loading");
      try {
        const qs = new URLSearchParams({ pandalId, limit: String(COMMENT_RULES.pageSize) });
        if (after) qs.set("cursor", after);
        const res = await fetch(`/api/comments?${qs}`, { signal: ctl.signal });
        if (res.status === 503) {
          setState("unavailable");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { comments: CommentDTO[]; nextCursor: string | null };
        setComments((prev) => (after ? [...prev, ...json.comments] : json.comments));
        setCursor(json.nextCursor);
        setState("idle");
        setLoadedOnce(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setState("error");
      }
    },
    [pandalId],
  );

  useEffect(() => {
    // localStorage is only readable after hydration, so these must be set from an effect
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(getSavedName());
    setReported(getReportedComments());
    void load(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => abort.current?.abort();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (posting) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setFeedback({ kind: "error", text: t("errorEmpty") });
      return;
    }
    setPosting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({ pandalId, name: name.trim(), text: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        saveName(name.trim());
        setComments((prev) => [json.comment as CommentDTO, ...prev]);
        setText("");
        setFeedback(null);
        toast({ emoji: "💬", text: t("posted"), tone: "good" });
        return;
      }
      const map: Record<string, string> = {
        empty: t("errorEmpty"),
        too_long: t("errorTooLong", { max: COMMENT_RULES.maxLength }),
        link: t("errorLink"),
        language: t("errorLanguage"),
        spam: t("errorSpam"),
        duplicate: t("errorDuplicate"),
        rate_limited: t("errorRateLimited", { limit: COMMENT_RULES.perDevicePerHour }),
        not_configured: t("errorUnavailable"),
      };
      setFeedback({ kind: "error", text: map[json.code as string] ?? t("errorGeneric") });
    } catch {
      setFeedback({ kind: "error", text: t("errorGeneric") });
    } finally {
      setPosting(false);
    }
  }

  async function report(id: string) {
    markCommentReported(id);
    setReported((r) => [...r, id]);
    try {
      const res = await fetch(`/api/comments/${id}/report`, {
        method: "POST",
        headers: { "x-device-id": getDeviceId() },
      });
      const json = await res.json().catch(() => ({}));
      if (json.hidden) setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* the local "reported" state is enough feedback */
    }
  }

  const remaining = COMMENT_RULES.maxLength - text.length;

  return (
    <section aria-labelledby="comments-h" className="space-y-3">
      <h3 id="comments-h" className="text-base font-bold text-ink">
        {t("heading")}
      </h3>

      {state === "unavailable" ? (
        <p className="rounded-lg bg-surface-3 p-3 text-sm text-muted">{t("errorUnavailable")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-2 rounded-2xl border border-line bg-surface p-3" noValidate>
          <div>
            <label htmlFor={`cn-${pandalId}`} className="mb-1 block text-xs font-semibold text-muted">
              {t("nameLabel")}
            </label>
            <input
              id={`cn-${pandalId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={COMMENT_RULES.maxNameLength}
              placeholder={t("namePlaceholder")}
              autoComplete="nickname"
              className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base text-ink placeholder:text-muted"
            />
          </div>
          <div>
            <label htmlFor={`ct-${pandalId}`} className="mb-1 block text-xs font-semibold text-muted">
              {t("textLabel")}
            </label>
            <textarea
              id={`ct-${pandalId}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={COMMENT_RULES.maxLength}
              rows={3}
              placeholder={t("textPlaceholder")}
              className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2 text-base text-ink placeholder:text-muted"
              aria-describedby={`cr-${pandalId}`}
            />
            <div id={`cr-${pandalId}`} className="mt-1 flex items-start justify-between gap-2 text-xs text-muted">
              <span>{t("rules")}</span>
              <span className={remaining < 20 ? "font-semibold text-[var(--crowd-high)]" : ""}>
                {t("counter", { count: text.length, max: COMMENT_RULES.maxLength })}
              </span>
            </div>
          </div>
          <button
            type="submit"
            disabled={posting}
            className="min-h-12 w-full rounded-xl bg-brand px-4 text-base font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60"
          >
            {posting ? t("posting") : t("post")}
          </button>
          <p
            role="status"
            aria-live="polite"
            className={`text-sm font-medium ${feedback?.kind === "ok" ? "text-[var(--crowd-low)]" : "text-[var(--crowd-high)]"}`}
          >
            {feedback?.text}
          </p>
        </form>
      )}

      <ul className="space-y-2">
        {comments.map((c) => {
          const done = reported.includes(c.id);
          return (
            <li key={c.id} className="rise rounded-xl border border-line bg-surface p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">{c.name || t("anonymous")}</span>
                <time dateTime={c.created_at} className="shrink-0 text-xs text-muted">
                  {/* a phone clock running behind the server must not render "in 2 minutes" */}
                  {format.relativeTime(new Date(Math.min(Date.parse(c.created_at), now.getTime())), now)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-[15px] leading-snug text-ink">{c.text}</p>
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  disabled={done}
                  onClick={() => report(c.id)}
                  className="min-h-11 rounded-lg px-3 text-xs font-semibold text-muted hover:bg-surface-3 hover:text-ink disabled:opacity-60"
                >
                  {done ? t("reported") : t("report")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {state === "loading" && !loadedOnce && (
        <div className="space-y-2" role="status" aria-busy="true">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      )}
      {state === "idle" && comments.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-surface-3 p-3 text-sm text-muted">
          <span aria-hidden="true" className="text-xl">
            💭
          </span>
          {t("empty")}
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-[var(--crowd-high)]">
          {t("loadFailed")}{" "}
          <button type="button" className="font-semibold underline" onClick={() => load(null)}>
            {tcm("retry")}
          </button>
        </p>
      )}
      {cursor && state !== "unavailable" && (
        <button
          type="button"
          disabled={state === "loading"}
          onClick={() => load(cursor)}
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 text-sm font-semibold text-ink hover:bg-surface-3 disabled:opacity-60"
        >
          {state === "loading" ? t("loadingMore") : t("loadMore")}
        </button>
      )}
    </section>
  );
}
