import { COMMENT_RULES } from "@/config/puja";

import { BENGALI_WORDS, LATIN_STEMS, LATIN_WORDS_RAW, SPAM_PHRASES } from "./wordlist";

export type ModerationCode = "empty" | "too_long" | "link" | "language" | "spam";

const collapse = (s: string) => s.replace(/(.)\1+/g, "$1");
const LATIN_WORDS = new Set(LATIN_WORDS_RAW.map(collapse));
// Input tokens go through NFKD (see deobfuscate), which splits Bengali vowel signs such as "ো" into two code points and
// "য়" into "য" + nukta. The word list must be decomposed the same way or those words can never match.
const BENGALI = new Set(BENGALI_WORDS.map((w) => w.normalize("NFKD")));
const SPAM = SPAM_PHRASES.map((p) => p.toLowerCase());

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

/**
 * Plain text only: strip HTML tags, angle brackets, control and zero-width characters, collapse
 * whitespace. (React escapes on render, and nothing here is ever used as HTML, so this is defence in depth.)
 */
export function sanitizeText(input: string, { multiline = true }: { multiline?: boolean } = {}): string {
  let s = String(input ?? "")
    .normalize("NFC")
    .replace(/<[^>]*>?/g, " ") // tags (including unterminated)
    .replace(/[<>]/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, " "); // html entities can smuggle < or javascript:
  s = multiline ? s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  return s.trim();
}

export function sanitizeName(input: unknown): string {
  const s = typeof input === "string" ? sanitizeText(input, { multiline: false }).slice(0, COMMENT_RULES.maxNameLength) : "";
  return s || "Visitor";
}

const toAsciiDigits = (s: string) => s.replace(/[\u09e6-\u09ef]/g, (d) => String(d.charCodeAt(0) - 0x09e6));

const LINK_PATTERNS: RegExp[] = [
  /\b(?:https?|ftp):\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]{2,}\.(?:com|in|net|org|co|io|xyz|me|info|biz|ly|gl|app|link|shop|site|online|top|click|live|tv|us|uk|bd|ru|cn|tk|ml|ga|cf|gq|page|store|fun|vip|bet)\b/i,
  /\b(?:t\.me|wa\.me|bit\.ly|tinyurl|goo\.gl|instagr\.am)\b/i,
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i, // e-mail
  /\b(?:dot|\(dot\)|\[dot\])\s*(?:com|in|net|org|co)\b/i,
];

export function containsLink(text: string): boolean {
  const t = toAsciiDigits(text);
  if (LINK_PATTERNS.some((re) => re.test(t))) return true;
  // phone numbers: 10+ digits possibly separated
  const digits = t.replace(/[^\d]/g, "");
  return /(?:\+?\d[\s().-]?){10,}/.test(t) && digits.length >= 10;
}

/** Lowercase, strip accents, join spaced-out letters ("f.u.c.k" -> "fuck"). */
function deobfuscate(text: string): string {
  const s = text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return s.replace(/\b(?:[a-z][\s._*-]+){2,}[a-z]\b/g, (m) => m.replace(/[\s._*-]+/g, ""));
}

/** "sh1t", "@ss": swap look-alike characters, but only inside tokens that also contain a letter. */
function unleet(token: string): string {
  return /[a-z]/.test(token) ? token.replace(/[013457@$]/g, (c) => LEET[c] ?? c) : token;
}

export function containsProfanity(text: string): boolean {
  const norm = deobfuscate(text);
  const tokens = norm
    .split(/[\s.,!?;:"'()[\]{}\-\u2013\u2014_/\\|*~`^+=#%&\u2026\u0964\u0965]+/u)
    .filter(Boolean)
    .map(unleet);
  for (const tok of tokens) {
    if (LATIN_WORDS.has(collapse(tok)) || BENGALI.has(tok)) return true;
  }
  const joined = tokens.join(" ");
  return LATIN_STEMS.some((stem) => joined.includes(stem));
}

export function looksLikeSpam(text: string): boolean {
  const lower = text.toLowerCase();
  if (SPAM.some((p) => lower.includes(p))) return true;
  if (/(.)\1{9,}/u.test(text)) return true; // aaaaaaaaaa
  if (/[!?]{6,}/.test(text)) return true;
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length >= 6) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    if (Math.max(...counts.values()) / words.length > 0.5) return true; // same word repeated
  }
  return false;
}

export function checkComment(text: string, name?: string): { ok: true } | { ok: false; code: ModerationCode } {
  if (!text) return { ok: false, code: "empty" };
  if ([...text].length > COMMENT_RULES.maxLength) return { ok: false, code: "too_long" };
  const all = name ? `${text}\n${name}` : text;
  if (containsLink(all)) return { ok: false, code: "link" };
  if (containsProfanity(all)) return { ok: false, code: "language" };
  if (looksLikeSpam(all)) return { ok: false, code: "spam" };
  return { ok: true };
}
