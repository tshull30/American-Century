import type { GameState } from "./types";

export const START_YEAR = 2026;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month 0 = January 2026. Negative months are the 2025 warm-up year. */
export function dateLabel(month: number): string {
  const y = START_YEAR + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return `${MONTHS[m]} ${y}`;
}

/** Deterministic PRNG (mulberry32) stored in the game state so saves replay identically. */
export function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randNormal(s: GameState): number {
  const u = Math.max(1e-9, rand(s));
  const v = rand(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function pick<T>(s: GameState, arr: T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}

export function shuffle<T>(s: GameState, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function fmtMoney(x: number, digits = 1): string {
  const sign = x < 0 ? "-" : "";
  const a = Math.abs(x);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(digits)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(digits)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export function fmtNum(x: number, digits = 1): string {
  const sign = x < 0 ? "-" : "";
  const a = Math.abs(x);
  if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(digits)}T`;
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e4) return `${sign}${(a / 1e3).toFixed(digits)}K`;
  return `${sign}${Math.round(a).toLocaleString("en-US")}`;
}

export function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtPrice(x: number): string {
  if (x >= 1e6) return fmtMoney(x, 2);
  if (x >= 1000) return `$${Math.round(x).toLocaleString("en-US")}`;
  if (x >= 100) return `$${x.toFixed(0)}`;
  return `$${x.toFixed(2)}`;
}

export const laborKey = (state: string, job: string) => `${state}:${job}`;
