"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { PANDALS } from "@/lib/data";
import { searchPandals } from "@/lib/search";
import type { Pandal } from "@/lib/types";

/** Search by pandal name or area with a suggestion list (used on the map). */
export function PandalSearchBox({ onPick, className = "" }: { onPick: (p: Pandal) => void; className?: string }) {
  const t = useTranslations("pandalsPage");
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const listId = useId();
  const results = useMemo(() => (q.trim() ? searchPandals(PANDALS, q).slice(0, 6) : []), [q]);
  const open = focused && results.length > 0;
  const empty = focused && q.trim() !== "" && results.length === 0;

  return (
    <div className={`relative ${className}`}>
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2/95 px-3 shadow-lg backdrop-blur">
        <Icon name="search" className="size-5 shrink-0 text-muted" />
        <input
          type="search"
          role="combobox"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
      </div>
      {empty && (
        <p role="status" className="absolute inset-x-0 top-12 z-10 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted shadow-xl">
          {t("empty")}
        </p>
      )}
      {open && (
        <ul
          id={listId}
          className="absolute inset-x-0 top-12 z-10 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-xl"
        >
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(p);
                  setQ("");
                  setFocused(false);
                }}
                className="flex min-h-12 w-full flex-col items-start justify-center px-4 py-2 text-left hover:bg-surface-3"
              >
                <span className="text-sm font-semibold text-ink">{p.name}</span>
                <span className="text-xs text-muted">{p.area}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
