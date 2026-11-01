// The election cycle: every House district with its real 2024 partisanship, a third of the
// Senate (plus specials), state primary calendars, primary challenges, ratings, and the general.
import { APPORTIONMENT, type Faction } from "./data/congress";
import { DISTRICTS_2024, NATIONAL_PRES_2024, STATE_PRES_2024 } from "./data/districts";
import { candidateName } from "./names";
import { POLITICIAN_POOL } from "./data/politicianPool";
import { SENATE_CONTENDERS_2026 } from "./data/contenders2026";
import type { PartyId } from "./data/laws";
import type { Candidate, GameState, Politician, Race } from "./types";
import { clamp, dateOfDay, rand, randNormal, START_YEAR } from "./util";

/** Shift so a seat's lean is its result in a nationally tied year. */
const NEUTRAL = 0.5 - NATIONAL_PRES_2024;
export const seatLeanHouse = (st: string, d: number) => {
  const row = DISTRICTS_2024.find((r) => r[0] === st && r[1] === d);
  return clamp((row ? row[2] : STATE_PRES_2024[st] ?? 0.5) + NEUTRAL, 0.05, 0.95);
};
export const seatLeanState = (st: string) => clamp((STATE_PRES_2024[st] ?? 0.5) + NEUTRAL, 0.05, 0.95);

/** Senators who announced they wouldn't run in 2026. */
const RETIRING_2026_SENATE = ["NC-Tillis", "KY-McConnell", "IL-Durbin", "MI-Peters", "NH-Shaheen", "MN-Smith", "IA-Ernst", "AL-Tuberville", "WY-Lummis"];

/** Approximate primary dates (month, day) used in every even year. */
const PRIMARY: Record<string, [number, number]> = {
  TX: [3, 3], NC: [3, 3], AR: [3, 3], MS: [3, 10], IL: [3, 17], LA: [4, 18], IN: [5, 5], OH: [5, 5], NE: [5, 12], WV: [5, 12],
  KY: [5, 19], OR: [5, 19], PA: [5, 19], ID: [5, 19], GA: [5, 19], AL: [5, 19], CA: [6, 2], IA: [6, 2], MT: [6, 2], NJ: [6, 2],
  NM: [6, 2], SD: [6, 2], ME: [6, 9], NV: [6, 9], ND: [6, 9], SC: [6, 9], VA: [6, 16], OK: [6, 16], NY: [6, 23], UT: [6, 23],
  MD: [6, 23], CO: [6, 30], KS: [8, 4], MI: [8, 4], MO: [8, 4], WA: [8, 4], AZ: [8, 4], TN: [8, 6], HI: [8, 8], WI: [8, 11],
  MN: [8, 11], VT: [8, 11], CT: [8, 11], WY: [8, 18], AK: [8, 18], FL: [8, 18], MA: [9, 1], NH: [9, 8], DE: [9, 8], RI: [9, 8],
};

function dayOf(year: number, m: number, d: number) {
  return Math.round((Date.UTC(year, m - 1, d) - Date.UTC(START_YEAR, 0, 1)) / 86400000);
}

function lastName(full: string) {
  const parts = full.replace(/,? (Jr\.|Sr\.|II|III|IV)$/, "").split(" ");
  return parts[parts.length - 1].toUpperCase();
}

/** Real seat leans and each incumbent's personal vote (how far they ran ahead of the top of the ticket in 2024). */
export function initElectionData(s: GameState) {
  for (const p of s.politicians) {
    if (p.chamber === "house") {
      p.lean = seatLeanHouse(p.state, p.district ?? 0);
      const row = DISTRICTS_2024.find((r) => r[0] === p.state && r[1] === (p.district ?? 0));
      if (row && row[3] !== null && row[4] && lastName(p.name) === lastName(row[4].replace(/\b(JR|SR|II|III)\.?$/, "").trim())) {
        p.personal = clamp(row[3] - row[2], -0.08, 0.08);
      } else p.personal = 0;
    } else {
      p.lean = seatLeanState(p.state);
      p.personal = 0;
    }
    p.retiring = false;
  }
  // House members running for Senate in 2026 aren't running for their own seats.
  for (const [st, parties] of Object.entries(SENATE_CONTENDERS_2026)) {
    for (const names of Object.values(parties)) for (const n of names ?? []) {
      const m = s.politicians.find((p) => p.chamber === "house" && p.state === st && p.name.toUpperCase() === n.toUpperCase());
      if (m) m.retiring = true;
    }
  }
  for (const key of RETIRING_2026_SENATE) {
    const [st, last] = key.split("-");
    const m = s.politicians.find((p) => p.chamber === "senate" && p.state === st && lastName(p.name) === last.toUpperCase());
    if (m) m.retiring = true;
  }
  // About 6% of House members retire or run for something else each cycle.
  for (const p of s.politicians) if (p.chamber === "house" && rand(s) < 0.06) p.retiring = true;
  s.races = buildRaces(s, START_YEAR);
}

export function senateClassUp(year: number): number {
  return [2, 3, 1][Math.round((year - 2026) / 2) % 3];
}

export function buildRaces(s: GameState, year: number): Race[] {
  const races: Race[] = [];
  const houseBy = new Map<string, Politician>();
  for (const p of s.politicians) if (p.chamber === "house") houseBy.set(`${p.state}-${p.district}`, p);
  for (const [st, n] of Object.entries(APPORTIONMENT)) {
    const [pm, pd] = PRIMARY[st] ?? [6, 1];
    for (const d of n === 1 ? [0] : Array.from({ length: n }, (_, i) => i + 1)) {
      const inc = houseBy.get(`${st}-${d}`);
      races.push(newRace(`${st}-${d === 0 ? "AL" : d}`, "house", st, d, undefined, false, seatLeanHouse(st, d), inc, dayOf(year, pm, pd)));
    }
  }
  const cls = senateClassUp(year);
  for (const p of s.politicians) {
    if (p.chamber !== "senate") continue;
    const special = year === 2026 && p.cls === 3 && (p.state === "FL" || p.state === "OH");
    if (p.cls !== cls && !special) continue;
    const [pm, pd] = PRIMARY[p.state] ?? [6, 1];
    races.push(newRace(`${p.state}-S${p.cls}${special ? "-special" : ""}`, "senate", p.state, undefined, p.cls, special, p.lean, p, dayOf(year, pm, pd)));
  }
  return races;
}

function newRace(id: string, chamber: "senate" | "house", state: string, district: number | undefined, cls: number | undefined, special: boolean,
  lean: number, inc: Politician | undefined, primaryDay: number): Race {
  const running = inc && !inc.retiring;
  const nominees: Race["nominees"] = {};
  if (running && inc) nominees[inc.party] = { name: inc.name, faction: inc.faction, personal: inc.personal, politicianId: inc.id, incumbent: true };
  return { id, chamber, state, district, cls, special, lean, incumbentId: inc?.id, open: !running, primaryDay, primaryDone: false, nominees, pac: {}, proj: lean };
}

function pickFaction(s: GameState, party: "D" | "R", lean: number): Faction {
  const r = rand(s);
  if (party === "D") {
    if (lean > 0.7) return r < 0.2 ? "socialist" : r < 0.65 ? "progressive" : "liberal";
    if (lean > 0.55) return r < 0.3 ? "progressive" : r < 0.8 ? "liberal" : "moderate";
    return r < 0.6 ? "moderate" : "bluedog";
  }
  if (lean < 0.3) return r < 0.55 ? "maga" : r < 0.75 ? "populist" : r < 0.85 ? "libertarian" : "corporate";
  if (lean < 0.45) return r < 0.45 ? "maga" : r < 0.8 ? "corporate" : r < 0.9 ? "populist" : "libertarian";
  return r < 0.6 ? "moderate" : "corporate";
}

function usedNames(s: GameState): Set<string> {
  const used = new Set(s.politicians.map((p) => p.name.toUpperCase()));
  for (const r of s.races) for (const c of Object.values(r.nominees)) if (c) used.add(c.name.toUpperCase());
  for (const n of s.politicsUsedNames ?? []) used.add(n);
  return used;
}

/**
 * A name for a new candidate: a real declared 2026 Senate contender if there is one, otherwise usually a real
 * politician from the state (a former member of Congress for Senate races and their old House seat, statewide
 * officials, state legislators), otherwise a generated name.
 */
function freshName(s: GameState, state: string, party: "D" | "R", race?: Race): string {
  const used = usedNames(s);
  const take = (n: string) => { (s.politicsUsedNames ??= []).push(n.toUpperCase()); return n; };
  if (race?.chamber === "senate" && cycleYearOf(s) === 2026) {
    // Declared contenders may be sitting House members (they gave up their seats to run).
    const taken = new Set(s.politicsUsedNames ?? []);
    for (const r of s.races) for (const c of Object.values(r.nominees)) if (c && r.chamber === "senate") taken.add(c.name.toUpperCase());
    const list = (SENATE_CONTENDERS_2026[state]?.[party] ?? []).filter((n) => !taken.has(n.toUpperCase()));
    if (list.length) return take(list[Math.floor(Math.pow(rand(s), 1.5) * list.length)]);
  }
  if (rand(s) < 0.85) {
    const pool = POLITICIAN_POOL.filter((r) => r[1] === state && r[2] === party && !used.has(r[0].toUpperCase()));
    if (pool.length) {
      const weight = (r: (typeof pool)[number]) => {
        if (race?.chamber === "senate") return r[3] === "fmr" ? 4 : r[3] === "gov" ? 5 : r[3] === "ss" ? 1 : 0.3;
        if (r[3] === "fmr") return race?.district !== undefined && r[4] === race.district ? 12 : 1;
        return r[3] === "ss" ? 2 : r[3] === "sh" ? 1.5 : 0.6;
      };
      const tot = pool.reduce((a, r) => a + weight(r), 0);
      let x = rand(s) * tot;
      for (const r of pool) { x -= weight(r); if (x <= 0) return take(r[0]); }
    }
  }
  for (let i = 0; i < 40; i++) {
    const n = candidateName(s, state, party);
    if (!used.has(n.toUpperCase())) return take(n);
  }
  return take(candidateName(s, state, party) + " Jr.");
}

function cycleYearOf(s: GameState): number {
  return dateOfDay(s.politics.nextElectionDay).getUTCFullYear();
}

const CENTRIST: Faction[] = ["moderate", "bluedog", "corporate"];

function pacEdge(r: Race, party: "D" | "R"): number {
  const unit = r.chamber === "senate" ? 5e6 : 1e6;
  let x = 0;
  for (const v of Object.values(r.pac)) x += v[party];
  return Math.min(0.04, 0.01 * Math.sqrt(x / unit));
}

/** Run any primaries scheduled for today. */
export function runPrimaries(s: GameState, log: (t: string) => void) {
  for (const r of s.races) {
    if (r.primaryDone || s.day < r.primaryDay) continue;
    r.primaryDone = true;
    for (const party of ["D", "R"] as const) {
      const cur = r.nominees[party];
      if (cur?.incumbent) {
        // Centrists in safe seats are vulnerable; money spent against them in the other column helps the challenger.
        const safe = party === "D" ? r.lean > 0.65 : r.lean < 0.35;
        let lose = (r.chamber === "senate" ? 0.002 : 0.006) + (safe && (cur.faction === "moderate" || cur.faction === "bluedog") ? 0.05 : safe && CENTRIST.includes(cur.faction) ? 0.008 : 0);
        lose += Math.min(0.15, pacEdge(r, party === "D" ? "R" : "D") * 2);
        if (rand(s) < lose) {
          const challenger: Candidate = { name: freshName(s, r.state, party, r), faction: pickFaction(s, party, r.lean), personal: 0, incumbent: false };
          r.nominees[party] = challenger;
          r.open = true;
          log(`Primary upset in ${r.id}: ${cur.name} lost the ${party === "D" ? "Democratic" : "Republican"} primary to ${challenger.name}.`);
        }
      } else if (!cur) {
        r.nominees[party] = { name: freshName(s, r.state, party, r), faction: pickFaction(s, party, r.lean), personal: 0, incumbent: false };
      }
    }
  }
}

/** Projected Democratic share for every race given the national environment. */
export function updateProjections(s: GameState) {
  const swing = s.politics.poll - 0.5;
  for (const r of s.races) {
    let x = r.lean + swing;
    for (const party of ["D", "R"] as const) {
      const c = r.nominees[party];
      if (c?.incumbent) x += (party === "D" ? 1 : -1) * (0.02 + c.personal);
    }
    x += pacEdge(r, "D") - pacEdge(r, "R");
    r.proj = clamp(x, 0.02, 0.98);
  }
}

export function rating(proj: number): { label: string; party: "D" | "R" | null } {
  const m = Math.abs(proj - 0.5) * 2;
  const party = proj >= 0.5 ? "D" : "R";
  if (m < 0.03) return { label: "Toss-up", party: null };
  if (m < 0.07) return { label: `Lean ${party}`, party };
  if (m < 0.14) return { label: `Likely ${party}`, party };
  return { label: `Safe ${party}`, party };
}

/** Probability Democrats win, accounting for polling error. */
export function winProb(proj: number): number {
  const z = (proj - 0.5) / 0.04;
  return 1 / (1 + Math.exp(-1.7 * z));
}

export interface GeneralResult {
  houseD: number; houseR: number; senateD: number; senateR: number; flips: string[]; ecD?: number; ecR?: number; presidentParty?: PartyId;
}

export function holdGeneral(s: GameState, year: number, presidential: boolean): GeneralResult {
  updateProjections(s);
  const national = 0.015 * randNormal(s);
  const flips: string[] = [];
  const byId = new Map(s.politicians.map((p) => [p.id, p]));
  const replace = new Map<string, Politician>();
  const added: Politician[] = [];
  for (const r of s.races) if (!r.primaryDone) r.primaryDay = Math.min(r.primaryDay, s.day);
  runPrimaries(s, () => {});
  for (const r of s.races) {
    const dShare = clamp(r.proj + national + 0.03 * randNormal(s), 0.01, 0.99);
    const winner: "D" | "R" = dShare >= 0.5 ? "D" : "R";
    r.result = { dShare, winner };
    const nom = r.nominees[winner] ?? { name: freshName(s, r.state, winner, r), faction: pickFaction(s, winner, r.lean), personal: 0, incumbent: false };
    const inc = r.incumbentId ? byId.get(r.incumbentId) : undefined;
    if (inc && inc.party !== winner && flips.length < 14) flips.push(r.id);
    if (nom.incumbent && nom.politicianId && inc) {
      inc.pacFor = 0; inc.pacAgainst = 0; inc.retiring = false;
      for (const [cid, v] of Object.entries(r.pac)) inc.friends[Number(cid)] = (inc.friends[Number(cid)] ?? 0) + v[winner];
      continue;
    }
    const p: Politician = {
      id: `gen-${year}-${r.id}`, name: nom.name, party: winner, label: winner, faction: nom.faction, chamber: r.chamber, state: r.state,
      district: r.district, cls: r.cls, lean: r.lean, real: false, sinceYear: year + 1, friends: {}, pacFor: 0, pacAgainst: 0,
      personal: clamp(0.01 * randNormal(s), -0.03, 0.03),
    };
    for (const [cid, v] of Object.entries(r.pac)) if (v[winner]) p.friends[Number(cid)] = v[winner];
    if (inc) replace.set(inc.id, p);
    else added.push(p);
  }
  s.politicians = s.politicians.map((p) => replace.get(p.id) ?? p).concat(added);
  s.vacancies = [];
  // Next cycle: a few new retirements.
  for (const p of s.politicians) p.retiring = p.chamber === "house" ? rand(s) < 0.06 : rand(s) < 0.08;
  // State legislatures drift with the national mood.
  const swing = s.politics.poll - 0.5 + national;
  for (const [st, leg] of Object.entries(s.stateLegs)) {
    const target = 1 / (1 + Math.exp(-(seatLeanState(st) + swing - 0.5) * 10));
    const move = (d: number, r: number): [number, number] => {
      const tot = d + r;
      if (!tot) return [0, 0];
      const nd = clamp(Math.round(d + (target * tot - d) * 0.35 + randNormal(s) * tot * 0.01), 0, tot);
      return [nd, tot - nd];
    };
    [leg.senateD, leg.senateR] = move(leg.senateD, leg.senateR);
    [leg.houseD, leg.houseR] = move(leg.houseD, leg.houseR);
  }
  let hD = 0, hR = 0, sD = 0, sR = 0;
  for (const p of s.politicians) p.chamber === "house" ? (p.party === "D" ? hD++ : hR++) : (p.party === "D" ? sD++ : sR++);
  const res: GeneralResult = { houseD: hD, houseR: hR, senateD: sD, senateR: sR, flips };
  if (presidential) {
    let ecD = 0;
    for (const [st, n] of Object.entries(APPORTIONMENT)) if (seatLeanState(st) + swing + 0.02 * randNormal(s) >= 0.5) ecD += n + 2;
    ecD += 3; // DC
    res.ecD = ecD;
    res.ecR = 538 - ecD;
    res.presidentParty = ecD >= 270 ? "commonwealth" : "frontier";
  }
  s.races = buildRaces(s, year + 2);
  return res;
}

export function raceLabel(r: Race): string {
  if (r.chamber === "senate") return `${r.state} Senate${r.special ? " (special)" : ""}`;
  return r.id;
}

export function cycleYear(s: GameState): number {
  return dateOfDay(s.politics.nextElectionDay).getUTCFullYear();
}
