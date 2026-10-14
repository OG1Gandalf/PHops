/**
 * Small, deliberately conservative word lists for the comment filter.
 * Matching is token based (exact word, after de-obfuscation) so innocent words and place names such as
 * "Ballygunge" or the Bengali word for fourteen are not blocked. `STEMS` match as substrings and are
 * limited to strings that are never innocent. This is a first line of defence: the Report button
 * (auto-hide after 3 reports) is the second.
 *
 * Extend freely - lowercase latin entries, Bengali script entries as-is.
 */

/** Exact-token matches (latin, lowercase, repeated letters collapsed to one: "fuuck" -> "fuk"). */
export const LATIN_WORDS_RAW = [
  // English
  "shit", "shits", "shitty", "bullshit", "bitch", "bitches", "bastard", "bastards", "asshole", "assholes",
  "dickhead", "slut", "sluts", "whore", "whores", "retard", "retarded", "wanker", "douche", "douchebag",
  // Romanised Bengali / Hindi
  "harami", "haramkhor", "haramzada", "haramjada", "haramzadi", "gandu", "gaandu", "bessha", "beshya",
  "randi", "raandi", "shuor", "shuorer", "kuttar", "khanki", "khankir", "khankirchele", "bokachoda",
  "bokachuda", "bhenchod", "behenchod", "madarchod", "maderchod", "bhosdi", "bhosda", "lauda", "loda",
];

/** Substring matches (after de-obfuscation, repeated letters NOT collapsed). */
export const LATIN_STEMS = ["fuck", "cunt", "nigger", "faggot", "bhenchod", "behenchod", "madarchod", "bokachoda"];

/** Exact-token matches in Bengali script. */
export const BENGALI_WORDS = [
  "মাগি", "মাগী", "মাগির", "খানকি", "খানকী", "খানকির", "চুদি", "চুদে", "চুদিস", "চোদা", "চোদনা", "চোদন",
  "হারামি", "হারামী", "হারামজাদা", "হারামজাদি", "হারামজাদী", "বোকাচোদা", "বোকাচুদা", "মাদারচোদ", "বেজন্মা",
  "গান্ডু", "গাণ্ডু", "শুয়োর", "শুয়োরের", "কুত্তা", "কুত্তার", "বেশ্যা", "বেশ্যার", "রান্ডি", "রাণ্ডি",
  "বালের", "ভোদা", "ধোন", "ধোনের",
];

/** Spam / solicitation words (exact tokens or phrases, lowercase). */
export const SPAM_PHRASES = [
  "click here", "buy now", "free money", "earn money", "work from home", "whatsapp", "telegram", "subscribe",
  "follow me", "follow for follow", "crypto", "casino", "betting", "lottery", "escort", "viagra", "porn",
  "xxx", "investment plan", "loan offer", "dm me", "call me", "contact me",
];
