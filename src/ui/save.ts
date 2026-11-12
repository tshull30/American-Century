import { SAVE_VERSION } from "../sim/engine";
import type { GameState } from "../sim/types";

const KEY = "american-century-save";

// Games are far bigger than localStorage allows (several megabytes), so they live in IndexedDB.
// The save is read once at startup and kept here so the start screen can check it synchronously.
let cache: GameState | null = null;
let present = false;

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("american-century", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("saves");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Load the saved game, if any. Call once before the app renders. */
export async function initSaves(): Promise<void> {
  try {
    const d = await db();
    const s = await new Promise<GameState | undefined>((resolve, reject) => {
      const req = d.transaction("saves").objectStore("saves").get(KEY);
      req.onsuccess = () => resolve(req.result as GameState | undefined);
      req.onerror = () => reject(req.error);
    });
    if (s) { present = true; cache = s.version === SAVE_VERSION ? s : null; return; }
  } catch { /* fall through to the old store */ }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { present = true; const s = JSON.parse(raw) as GameState; cache = s.version === SAVE_VERSION ? s : null; }
  } catch { /* nothing saved */ }
}

/** Save the game in this browser. Resolves false if the browser refused. */
export async function saveLocal(s: GameState): Promise<boolean> {
  recordRun(s);
  try {
    const d = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("saves", "readwrite");
      tx.objectStore("saves").put(s, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    try { localStorage.removeItem(KEY); } catch { /* fine */ }
    present = true;
    cache = s;
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(): GameState | null {
  return cache;
}

export function hasLocal(): boolean {
  return present;
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
