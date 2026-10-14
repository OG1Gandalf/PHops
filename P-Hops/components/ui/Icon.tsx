import type { SVGProps } from "react";

/** Minimal inline SVG icon set (24x24, stroke based). Decorative: always paired with text. */
export const ICON_PATHS = {
  map: "M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3zM9 3v15M15 6v15",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  utensils: "M5 3v7a3 3 0 0 0 3 3v8M8 3v7M11 3v7a3 3 0 0 1-3 3M18 3c-2.5 1.5-3.5 5-3.5 8H18v10",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  person: "M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 22v-7H7l2-7h6l2 7h-2v7",
  parking: "M5 3h14v18H5zM9 17V7h4a3 3 0 0 1 0 6H9",
  temple: "M12 3 4 9h16L12 3zM6 9v11M18 9v11M10 20v-5a2 2 0 0 1 4 0v5M3 20h18",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z",
  locate: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  x: "M6 6l12 12M18 6 6 18",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  right: "m9 6 6 6-6 6",
  navigation: "M3 11 21 3l-8 18-2-8-8-2z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  walk: "M13.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 22l2-7-3-3 1-5 3-1 2 4 3 1M15 22l-3-7",
  check: "m5 12 5 5 9-10",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  alert: "M12 3 2 20h20L12 3zM12 10v4M12 17h.01",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  layers: "m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01",
  wheelchair: "M10 4a1.5 1.5 0 1 0 0-3M10 6v7h6l3 6M8 11a5 5 0 1 0 6 7",
  rupee: "M7 5h10M7 9h10M7 5c5 0 7 2 7 4s-2 4-7 4l7 7",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className = "size-5", ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
