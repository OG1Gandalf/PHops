"use client";

import { useId, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

/** Toggle chip (filter). `aria-pressed` carries the state, a check mark repeats it for non-colour cues. */
export function Chip({
  pressed,
  onClick,
  children,
  className = "",
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
        pressed ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface-2 text-ink hover:bg-surface-3"
      } ${className}`}
    >
      {pressed && <Icon name="check" className="size-3.5" />}
      {children}
    </button>
  );
}

/** Horizontally scrollable chip row (no wrapping, hidden scrollbar) - keeps filters to one line on phones. */
export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {children}
    </div>
  );
}

/** Two- or three-way segmented control (radio semantics). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: IconName }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
              on ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-3"
            }`}
          >
            {o.icon && <Icon name={o.icon} className="size-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SearchField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className="min-h-12 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-3 text-base text-ink placeholder:text-muted"
      />
    </div>
  );
}
