import { SAVE_VERSION } from "../sim/engine";
import type { GameState } from "../sim/types";

const KEY = "american-century-save";

export function saveLocal(s: GameState): boolean {
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
