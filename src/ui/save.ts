import { SAVE_VERSION } from "../sim/engine";
import type { GameState } from "../sim/types";

const KEY = "american-century-save";

export function saveLocal(s: GameState): boolean {
  recordRun(s);
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

export function hasLocal(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function exportFile(s: GameState) {
  const blob = new Blob([JSON.stringify(s)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `american-century-${s.month}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importFile(): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      try {
        const f = input.files?.[0];
        if (!f) return reject(new Error("No file"));
        const s = JSON.parse(await f.text()) as GameState;
        if (s.version !== SAVE_VERSION) return reject(new Error("Save is from another version"));
        resolve(s);
      } catch (e) { reject(e); }
    };
    input.click();
  });
}

// ---------------------------------------------------------------- past runs

const RUNS = "american-century-runs";
export interface RunRecord {
  id: string; name: string; ticker: string; color: string; startedAs: "startup" | "incumbent" | "challenger";
  scenario: string; difficulty: string; goal: string; result?: "won" | "lost";
  startCap: number; peakCap: number; lastCap: number; month: number; updated: number;
}

export function loadRuns(): RunRecord[] {
  try { return JSON.parse(localStorage.getItem(RUNS) ?? "[]") as RunRecord[]; } catch { return []; }
}

/** Keep a short record of each company the player has run (best ten by peak value). */
export function recordRun(s: GameState) {
  try {
    const me = s.companies.find((c) => c.id === s.playerId);
    if (!me) return;
    const runs = loadRuns();
    const id = `${s.seed}:${s.playerId}`;
    let r = runs.find((x) => x.id === id);
    if (!r) {
      r = { id, name: me.name, ticker: me.ticker, color: me.color, startedAs: me.kind, scenario: s.setup?.scenario ?? "standard", difficulty: s.setup?.difficulty ?? "normal", goal: s.setup?.goal ?? "sandbox",
        startCap: me.history.find((h) => h.month >= 0)?.marketCap ?? me.marketCap, peakCap: 0, lastCap: 0, month: 0, updated: 0 };
      runs.push(r);
    }
    r.name = me.name;
    r.peakCap = Math.max(r.peakCap, me.marketCap);
    r.lastCap = me.alive ? me.marketCap : 0;
    r.month = s.month;
    r.result = s.setup?.result;
    r.updated = Date.now();
    runs.sort((a, b) => b.updated - a.updated);
    localStorage.setItem(RUNS, JSON.stringify(runs.slice(0, 12)));
  } catch { /* storage unavailable */ }
}
