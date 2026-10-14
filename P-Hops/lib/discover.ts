import { CROWD_RANK, type DisplayedCrowd } from "@/lib/crowdService";
import { walkingKm, walkingMinutes } from "@/lib/geo";
import type { Eatery, LatLng, Pandal } from "@/lib/types";

/** Small deterministic PRNG so "random" picks are pure functions of a seed (no Math.random in render). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Candidate {
  pandal: Pandal;
  crowd: DisplayedCrowd;
}

const LEVEL_WEIGHT = { low: 6, medium: 2, high: 0.4 } as const;

/**
 * "Surprise me": a weighted random pandal. Quieter ones are more likely, nearer ones are more likely
 * when we know where the visitor is, and pandals they already saved or just saw are skipped.
 */
export function pickSurprise(opts: {
  candidates: readonly Candidate[];
  origin: LatLng | null;
  seed: number;
  skip?: string;
}): { pick: Candidate; km: number | null } | null {
  const { candidates, origin, seed, skip } = opts;
  const pool = candidates.filter((c) => c.pandal.id !== skip);
  if (pool.length === 0) return null;
  const rand = seededRandom(seed);
  const weights = pool.map((c) => {
    const km = origin ? walkingKm(origin, c.pandal) : null;
    const near = km === null ? 1 : 1 / (1 + km / 2.5);
    return LEVEL_WEIGHT[c.crowd.level] * near;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  let idx = 0;
  for (; idx < pool.length - 1; idx++) {
    r -= weights[idx];
    if (r <= 0) break;
  }
  const pick = pool[idx];
  return { pick, km: origin ? walkingKm(origin, pick.pandal) : null };
}

export interface PlanStop {
  pandal: Pandal;
  crowd: DisplayedCrowd;
  /** walking minutes from the previous stop (or from the visitor for the first stop; null if unknown) */
  walkMin: number | null;
  walkKm: number | null;
}

export interface EveningPlanResult {
  stops: PlanStop[];
  eatery: { eatery: Eatery; walkMin: number; km: number } | null;
  totalMinutes: number;
}

/** Assumption surfaced in the UI: time spent at each pandal (queues and photos included). */
export const MINUTES_PER_STOP = 30;
export const PLAN_STOPS = 3;

/**
 * A light "plan my evening": up to three pandals that aren't busy right now, chosen so the walking hops are
 * short, then a famous snack stop near the last pandal. Seed 0 gives the best plan, other seeds shuffle it.
 */
export function planEvening(opts: {
  candidates: readonly Candidate[];
  origin: LatLng | null;
  seed: number;
  eateries: readonly Eatery[] | null;
}): EveningPlanResult {
  const { candidates, origin, seed, eateries } = opts;
  const rand = seed === 0 ? () => 0 : seededRandom(seed);
  const jitter = seed === 0 ? 0 : 1;

  let pool = candidates.filter((c) => c.crowd.level !== "high");
  if (pool.length < PLAN_STOPS) pool = [...candidates];

  const stops: PlanStop[] = [];
  let here: LatLng | null = origin;
  const remaining = [...pool];

  while (stops.length < PLAN_STOPS && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;
    remaining.forEach((c, i) => {
      const km = here ? walkingKm(here, c.pandal) : 0;
      // quiet matters most for the first stop; after that short hops matter more
      const crowdPenalty = CROWD_RANK[c.crowd.level] * (stops.length === 0 ? 1.2 : 0.6);
      const distPenalty = here ? km * (stops.length === 0 ? 0.35 : 1) : 0;
      const score = crowdPenalty + distPenalty + rand() * 1.2 * jitter;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    const [chosen] = remaining.splice(bestIdx, 1);
    const km = here ? walkingKm(here, chosen.pandal) : null;
    stops.push({ pandal: chosen.pandal, crowd: chosen.crowd, walkKm: km, walkMin: km === null ? null : walkingMinutes(km) });
    here = chosen.pandal;
  }

  let eatery: EveningPlanResult["eatery"] = null;
  if (eateries && here) {
    const famous = eateries.filter((e) => e.famousFor);
    const list = famous.length ? famous : eateries;
    let best: Eatery | null = null;
    let bestKm = Infinity;
    for (const e of list) {
      const km = walkingKm(here, e);
      if (km < bestKm) {
        bestKm = km;
        best = e;
      }
    }
    if (best) eatery = { eatery: best, km: bestKm, walkMin: walkingMinutes(bestKm) };
  }

  const walking = stops.reduce((s, x) => s + (x.walkMin ?? 0), 0) + (eatery?.walkMin ?? 0);
  return { stops, eatery, totalMinutes: walking + stops.length * MINUTES_PER_STOP };
}
