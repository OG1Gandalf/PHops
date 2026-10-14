"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface ToastInput {
  /** a single emoji, purely decorative */
  emoji?: string;
  text: string;
  tone?: "default" | "good" | "warn";
}
interface ToastItem extends ToastInput {
  id: number;
}

const Ctx = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(Ctx);

const LIFETIME_MS = 3800;

/**
 * Small friendly toasts. The container is always mounted and is a polite live region, so screen
 * readers announce each message; sighted users see it above the bottom nav.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-1), { ...t, id }]); // at most 2 on screen
    setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), LIFETIME_MS);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+0.75rem)] z-[1400] flex flex-col items-center gap-2 px-3 md:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${
              t.tone === "good"
                ? "border-[var(--crowd-low)] bg-[var(--crowd-low-bg)] text-[var(--crowd-low-ink)]"
                : t.tone === "warn"
                  ? "border-[var(--gold)] bg-[var(--gold-soft)] text-ink"
                  : "border-line bg-surface-2 text-ink"
            }`}
          >
            {t.emoji && (
              <span aria-hidden="true" className="text-xl leading-none">
                {t.emoji}
              </span>
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
