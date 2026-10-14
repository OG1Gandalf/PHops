/** Client-only helpers for the anonymous device id and local abuse-prevention state. */
const DEVICE_KEY = "pujo.deviceId";

/** `crypto.randomUUID` only exists in secure contexts (HTTPS / localhost); some in-app browsers and LAN test URLs lack it. */
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    // the server accepts [A-Za-z0-9-]{16,64}; anything else (hand-edited storage) is replaced
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = newId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked: fall back to a per-session id.
    return (globalThis as { __pujoDevice?: string }).__pujoDevice ??= newId();
  }
}

const reportKey = (pandalId: string) => `pujo.crowd.${pandalId}`;

/** Minutes left on the local 10-minute cooldown for this pandal (0 = can report). */
export function crowdCooldownLeft(pandalId: string, cooldownMinutes: number, now = Date.now()): number {
  try {
    const last = Number(localStorage.getItem(reportKey(pandalId)) ?? 0);
    if (!last) return 0;
    return Math.max(0, Math.ceil((last + cooldownMinutes * 60_000 - now) / 60_000));
  } catch {
    return 0;
  }
}

/** Remember a report; `ageMinutes` back-dates it (used when the server says a report was made earlier). */
export function markCrowdReported(pandalId: string, ageMinutes = 0) {
  try {
    localStorage.setItem(reportKey(pandalId), String(Date.now() - ageMinutes * 60_000));
  } catch {
    /* ignore */
  }
}

const REPORTED_COMMENTS = "pujo.reportedComments";

export function getReportedComments(): string[] {
  try {
    return JSON.parse(localStorage.getItem(REPORTED_COMMENTS) ?? "[]");
  } catch {
    return [];
  }
}

export function markCommentReported(id: string) {
  try {
    const list = new Set(getReportedComments());
    list.add(id);
    localStorage.setItem(REPORTED_COMMENTS, JSON.stringify([...list].slice(-200)));
  } catch {
    /* ignore */
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem("pujo.name") ?? "";
  } catch {
    return "";
  }
}
export function saveName(name: string) {
  try {
    localStorage.setItem("pujo.name", name);
  } catch {
    /* ignore */
  }
}

// ---- saved ("favourite") pandals, stored on the device only
const SAVED_KEY = "pujo.saved";

export function getSavedPandals(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setSavedPandals(ids: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids.slice(0, 200)));
  } catch {
    /* ignore */
  }
}
