import type { CultureId } from "./data/cultures";
import { LAST, MEN, WOMEN, type NamePool } from "./data/names";
import type { GameState } from "./types";
import { rand } from "./util";

const cache = new Map<string, string[]>();
function list(pool: NamePool, key: string, tag: string): string[] {
  const k = tag + key;
  let v = cache.get(k);
  if (!v) { v = (pool[key] ?? "").split("|").filter(Boolean); cache.set(k, v); }
  return v;
}

/** Ranked lists: favor the top (position = length × random^2.2). Unranked lists: uniform. */
function pick(s: GameState, pool: NamePool, key: string, tag: string, ranked: boolean): string {
  const l = list(pool, key, tag);
  if (!l.length) return list(pool, "white", tag)[0] ?? "Smith";
  const u = rand(s);
  return l[Math.min(l.length - 1, Math.floor(l.length * (ranked ? Math.pow(u, 2.2) : u)))];
}

const RANKED = new Set(["white", "black", "hispanic", "asian", "mixed"]);

/** Which name pools a culture draws from: [first-name pool, last-name pool], with the chance of each option. */
function sources(culture: CultureId, state: string): [string, string, number][] {
  switch (culture) {
    case "white": return [["white", "white", 1]];
    case "black": return [["black", "black", 1]];
    case "mexican": case "latino": return [["hispanic", "hispanic", 1]];
    case "chinese": return [["asian", "china", 0.65], ["china", "china", 0.35]];
    case "indian": return [["india", "india", 0.85], ["asian", "india", 0.15]];
    case "filipino": return [["asian", "philippines", 0.6], ["philippines", "philippines", 0.4]];
    case "vietnamese": return [["asian", "vietnam", 0.5], ["vietnam", "vietnam", 0.5]];
    case "korean": return [["asian", "korea", 0.6], ["korea", "korea", 0.4]];
    case "asian_other": return [["asian", "asian", 0.8], ["japan", "japan", 0.2]];
    case "native": return state === "HI" ? [["hawaii", "hawaii", 0.6], ["samoa", "samoa", 0.25], ["tonga", "tonga", 0.15]] : [["mixed", "mixed", 1]];
    default: return [["mixed", "mixed", 1]];
  }
}

export function personName(s: GameState, culture: CultureId, state: string, female: boolean): string {
  const opts = sources(culture, state);
  let r = rand(s), o = opts[0];
  for (const x of opts) { if (r < x[2]) { o = x; break; } r -= x[2]; }
  const [fk, lk] = o;
  const first = female
    ? pick(s, WOMEN, fk, "f", false)
    : pick(s, MEN, fk, "m", RANKED.has(fk));
  const last = pick(s, LAST, lk, "l", RANKED.has(lk));
  return `${first} ${last}`;
}

const stateMix = new WeakMap<GameState, Map<string, [CultureId, number][]>>();
/** A culture for someone from this state, weighted by the state's workforce. */
export function cultureFor(s: GameState, state: string, diversity = 1): CultureId {
  let m = stateMix.get(s);
  if (!m) { m = new Map(); stateMix.set(s, m); }
  let mix = m.get(state);
  if (!mix) {
    const tot = new Map<CultureId, number>();
    for (const p of s.pops) if (p.state === state) tot.set(p.culture, (tot.get(p.culture) ?? 0) + p.workers);
    mix = [...tot.entries()];
    m.set(state, mix);
  }
  const w = mix.map(([c, n]) => n * (c === "white" ? 1 : diversity));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand(s) * total;
  for (let i = 0; i < mix.length; i++) { if (r < w[i]) return mix[i][0]; r -= w[i]; }
  return "white";
}

/** A name for a new candidate. Women are about 42% of Democratic and 17% of Republican nominees. */
export function candidateName(s: GameState, state: string, party: "D" | "R"): string {
  const culture = cultureFor(s, state, party === "D" ? 1.1 : 0.55);
  return personName(s, culture, state, rand(s) < (party === "D" ? 0.42 : 0.17));
}
