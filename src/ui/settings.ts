import type { EventTag } from "../sim/types";

export const PAUSE_TAGS: { tag: EventTag; label: string; on: boolean }[] = [
  { tag: "election", label: "Election results", on: true },
  { tag: "law", label: "A bill becomes law, fails or is vetoed", on: true },
  { tag: "deal", label: "Your takeover closes or is blocked, or someone bids for you", on: true },
  { tag: "finance", label: "Your quarterly earnings, debt over the credit limit", on: true },
  { tag: "tier", label: "You move to a new market-cap tier", on: true },
  { tag: "city", label: "City council and statehouse votes that affect you", on: false },
  { tag: "macro", label: "World events and recessions", on: true },
  { tag: "news", label: "Company news: fires, viral hits, verdicts", on: true },
  { tag: "leadership", label: "Executives leave or get poached, scandals, activists, proxy fights", on: true },
  { tag: "build", label: "Construction finishes", on: false },
];

export type Autosave = "month" | "quarter" | "year" | "off";

export interface Settings {
  pause: Partial<Record<EventTag, boolean>>;
  autosave: Autosave;
}

const KEY = "american-century-settings";

export function loadSettings(): Settings {
  const d: Settings = { pause: Object.fromEntries(PAUSE_TAGS.map((p) => [p.tag, p.on])), autosave: "quarter" };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const x = JSON.parse(raw) as Partial<Settings>; return { pause: { ...d.pause, ...x.pause }, autosave: x.autosave ?? d.autosave }; }
  } catch { /* storage unavailable */ }
  return d;
}

export function saveSettings(x: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(x)); } catch { /* storage unavailable */ }
}

export function autosaveDue(a: Autosave, month: number): boolean {
  if (a === "off" || month < 0) return false;
  if (a === "month") return true;
  if (a === "quarter") return month % 3 === 0;
  return month % 12 === 0;
}

export function loadUi<T>(key: string, init: T): T {
  try { const raw = localStorage.getItem("american-century-ui-" + key); return raw ? (JSON.parse(raw) as T) : init; } catch { return init; }
}
export function saveUi(key: string, v: unknown) {
  try { localStorage.setItem("american-century-ui-" + key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}
