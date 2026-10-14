"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

function apply(choice: ThemeChoice) {
  const dark =
    choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Theme preference persisted in localStorage ("system" when nothing stored). */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [isDark, setIsDark] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage / matchMedia are only readable after hydration */
  useEffect(() => {
    let stored: ThemeChoice = "system";
    try {
      const v = localStorage.getItem("theme");
      if (v === "light" || v === "dark") stored = v;
    } catch {
      /* ignore */
    }
    setChoice(stored);
    setIsDark(document.documentElement.classList.contains("dark"));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem("theme")) {
        apply("system");
        setIsDark(document.documentElement.classList.contains("dark"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = useCallback((next: ThemeChoice) => {
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    apply(next);
    setChoice(next);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  return { choice, isDark, set };
}

/** Inline script (runs before first paint) so there is no light/dark flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
