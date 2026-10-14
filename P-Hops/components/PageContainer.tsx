import type { ReactNode } from "react";

/** Standard page chrome for non-map pages (server-safe: no hooks). */
export function PageContainer({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
      {intro && <p className="mt-1 text-[15px] leading-snug text-muted">{intro}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}
