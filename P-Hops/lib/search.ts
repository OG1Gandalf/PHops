import type { Pandal } from "@/lib/types";

/** lowercase, strip punctuation / diacritics so "Md. Ali" matches "mohammad ali" prefixes etc. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0980-\u09ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES: [RegExp, string][] = [
  [/\bmd\b/g, "mohammad"],
  [/\bmohammed\b/g, "mohammad"],
  [/\bbaghbazar\b/g, "bagbazar"],
  [/\bsovabazar\b/g, "shobhabazar"],
  [/\bshovabazar\b/g, "shobhabazar"],
  [/\bpalli\b/g, "pally"],
  [/\bsarbojonin\b/g, "sarbojanin"],
];
const canon = (s: string) => ALIASES.reduce((acc, [re, to]) => acc.replace(re, to), normalize(s));

/**
 * Every query token must appear (as a prefix of a word) in name + area.
 * An empty query lists everything; a query made only of punctuation ("???", "%") matches nothing.
 */
export function searchPandals(pandals: readonly Pandal[], query: string): Pandal[] {
  if (!query.trim()) return [...pandals];
  const tokens = canon(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  return pandals.filter((p) => {
    const hay = canon(`${p.name} ${p.area}`);
    const words = hay.split(" ");
    return tokens.every((t) => words.some((w) => w.startsWith(t)) || hay.includes(t));
  });
}
