"use client";

import { useCallback, useEffect, useState } from "react";

export type LazyStatus = "idle" | "loading" | "ready" | "error";

/** Loads a (module-cached) dataset on demand. `enabled` flips true when the data is first needed. */
export function useLazy<T>(loader: () => Promise<T>, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LazyStatus>("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async load
    setStatus("loading");
    loader().then(
      (d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
      },
      () => {
        if (!cancelled) setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, status, retry };
}
