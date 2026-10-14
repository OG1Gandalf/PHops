"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { SaveButton } from "@/components/SaveButton";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { PANDAL_BY_ID } from "@/lib/data";

// The panel body (comments, nearby facilities...) is only needed once a pandal is opened.
const PandalDetail = dynamic(() => import("@/components/PandalDetail").then((m) => m.PandalDetail), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 p-4" role="status" aria-busy="true">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  ),
});

/** Bottom sheet on mobile, side panel on desktop. Non-modal: the map stays usable behind it. */
export function DetailSheet() {
  const t = useTranslations("pandal");
  const { selectedPandalId, selectPandal } = useApp();
  const pandal = selectedPandalId ? PANDAL_BY_ID.get(selectedPandalId) : undefined;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expanded = expandedId !== null && expandedId === pandal?.id;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ y: number; raw: number; moved: boolean } | null>(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!pandal) return;
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectPandal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pandal, selectPandal]);

  if (!pandal) return null;

  const closeOrCollapse = (raw: number, moved: boolean) => {
    if (!moved) {
      setExpandedId(expanded ? null : pandal.id);
    } else if (raw < -50 && !expanded) {
      setExpandedId(pandal.id);
    } else if (raw > 70) {
      if (expanded) setExpandedId(null);
      else selectPandal(null);
    }
  };

  // Swipe handling on the header strip. Buttons inside keep working (drags that start on them are ignored),
  // and the expand/close buttons remain the keyboard + one-tap alternative.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 768) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone; the drag simply won't be captured */
    }
    gesture.current = { y: e.clientY, raw: 0, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    g.raw = e.clientY - g.y;
    if (Math.abs(g.raw) > 6) g.moved = true;
    // down follows the finger; up is a small rubber band (the sheet grows on release)
    setDy(g.raw > 0 ? g.raw : Math.max(g.raw * 0.3, -40));
  };
  const endGesture = (cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(false);
    setDy(0);
    if (g && !cancelled) closeOrCollapse(g.raw, g.moved);
  };

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={t("detailsFor", { name: pandal.name })}
      style={dy !== 0 ? { transform: `translateY(${dy}px)` } : undefined}
      className={`sheet fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-[1150] flex flex-col overflow-hidden rounded-t-3xl border border-b-0 border-line bg-surface-2 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] md:inset-x-auto md:bottom-0 md:right-0 md:top-[var(--header-h)] md:h-auto md:w-[27rem] md:rounded-none md:border-b-0 md:border-r-0 md:shadow-2xl ${
        dragging ? "" : "transition-[height,transform] duration-200 ease-out"
      } ${expanded ? "h-[calc(100dvh-var(--header-h)-var(--nav-h)-env(safe-area-inset-bottom))]" : "h-[52dvh]"}`}
    >
      <div
        className="shrink-0 touch-none md:touch-auto"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endGesture(false)}
        onPointerCancel={() => endGesture(true)}
      >
        {/* Grab handle (mobile). Decorative: drag it, or tap it; the buttons on the right do the same for keyboards. */}
        <div className="mx-auto flex h-7 w-24 cursor-grab items-center justify-center md:hidden" aria-hidden="true">
          <span className={`h-1.5 rounded-full bg-line transition-all ${dragging ? "w-16 bg-muted" : "w-12"}`} />
        </div>

        <div className="flex items-start gap-1.5 px-4 pb-2 pt-1 md:pt-4">
          <div className="min-w-0 flex-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold leading-tight text-ink outline-none">
              {pandal.name}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{pandal.area}</p>
          </div>
          <SaveButton pandalId={pandal.id} name={pandal.name} />
          <button
            type="button"
            onClick={() => setExpandedId(expanded ? null : pandal.id)}
            aria-label={expanded ? t("collapse") : t("expand")}
            aria-expanded={expanded}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-ink hover:bg-line md:hidden"
          >
            <Icon name={expanded ? "down" : "up"} />
          </button>
          <button
            type="button"
            onClick={() => selectPandal(null)}
            aria-label={t("closePanel")}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-ink hover:bg-line"
          >
            <Icon name="x" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <PandalDetail key={pandal.id} pandal={pandal} />
      </div>
    </aside>
  );
}
