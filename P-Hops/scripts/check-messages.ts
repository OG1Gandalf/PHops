/** Fails if messages/bn.json is missing or has extra keys compared to messages/en.json. */
import { readFileSync } from "node:fs";

type Tree = { [k: string]: string | Tree };
const load = (f: string) => JSON.parse(readFileSync(new URL(`../messages/${f}.json`, import.meta.url), "utf8")) as Tree;

function flatten(t: Tree, prefix = ""): string[] {
  return Object.entries(t).flatMap(([k, v]) =>
    k === "_meta" ? [] : typeof v === "string" ? [prefix + k] : flatten(v, `${prefix}${k}.`),
  );
}

const en = new Set(flatten(load("en")));
const bn = new Set(flatten(load("bn")));
const missing = [...en].filter((k) => !bn.has(k));
const extra = [...bn].filter((k) => !en.has(k));
if (missing.length || extra.length) {
  console.error("Missing in bn.json:", missing, "\nExtra in bn.json:", extra);
  process.exit(1);
}
console.log(`i18n OK: ${en.size} keys in both languages.`);
