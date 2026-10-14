"use client";

import L from "leaflet";

import { ICON_PATHS, type IconName } from "@/components/ui/Icon";
import type { CrowdLevel } from "@/lib/types";

import { LAYER_META, type LayerKey } from "./layers";

export type { LayerKey } from "./layers";

const svg = (name: IconName, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`;

const BARS: Record<CrowdLevel, number> = { low: 1, medium: 2, high: 3 };

/** Pandal pin: colour AND number of bars encode the crowd level. */
export function pandalIcon(level: CrowdLevel, selected: boolean): L.DivIcon {
  const n = BARS[level];
  const bars = [1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("");
  return L.divIcon({
    className: "pujo-marker",
    html: `<div class="pm pm-${level}${selected ? " pm-selected" : ""}"><div class="pm-body"></div>${svg("temple", "pm-icon")}<span class="pm-bars">${bars}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -34],
  });
}

export function layerIcon(layer: Exclude<LayerKey, "pandals">, opts: { famous?: boolean } = {}): L.DivIcon {
  const inner =
    layer === "restrooms"
      ? "WC"
      : layer === "parking"
        ? "P"
        : svg(LAYER_META[layer].icon);
  return L.divIcon({
    className: "pujo-marker pujo-marker-c",
    html: `<div class="lm lm-${layer}${opts.famous ? " famous" : ""}">${inner}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -12],
  });
}

export function clusterIcon(layer: LayerKey, count: number): L.DivIcon {
  return L.divIcon({
    className: "pujo-marker pujo-marker-c",
    html: `<div class="cl cl-${layer}">${count}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export const userIcon = L.divIcon({
  className: "pujo-marker",
  html: `<div class="user-dot"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** All dynamic text that reaches Leaflet popups is escaped here. */
const esc = (s: string | number | undefined | null) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export function popupHtml(opts: { title: string; lines?: (string | undefined)[]; url?: string; urlLabel?: string }): string {
  const lines = (opts.lines ?? [])
    .filter(Boolean)
    .map((l) => `<div style="color:var(--muted);font-size:13px">${esc(l)}</div>`)
    .join("");
  const link = opts.url
    ? `<div style="margin-top:8px"><a href="${esc(opts.url)}" target="_blank" rel="noopener noreferrer">${esc(opts.urlLabel)} →</a></div>`
    : "";
  return `<div><strong>${esc(opts.title)}</strong>${lines}${link}</div>`;
}
