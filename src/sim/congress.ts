// Congress: real members at game start, faction-driven votes, the filibuster and veto,
// seat-by-seat elections, state legislatures and PACs.
import { APPORTIONMENT, MEMBERS_2026, STATE_LEAN, STATE_LEGS, VACANCIES_2026, type Faction } from "./data/congress";
import { factionDef, FIRST_NAMES, LAST_NAMES } from "./data/factions";
import { LAW_BY_ID, type LawId, type PartyId } from "./data/laws";
import type { Company, GameState, Politician, VoteResult } from "./types";
import { clamp, dateOfDay, fmtMoney, rand, randNormal } from "./util";

export const toParty = (p: "D" | "R"): PartyId => (p === "D" ? "commonwealth" : "frontier");
export const fromParty = (p: PartyId): "D" | "R" => (p === "commonwealth" ? "D" : "R");

/** Laws that can pass the Senate by simple majority through budget reconciliation. */
const RECONCILIATION: LawId[] = ["corporate_tax", "industrial_policy"];

export function initCongress(s: GameState) {
  s.politicians = MEMBERS_2026.map((m) => {
    const base = STATE_LEAN[m.state] ?? 0.5;
    const lean = m.chamber === "senate" ? base : clamp(base + (m.party === "D" ? 0.12 : -0.12) + 0.05 * randNormal(s), 0.12, 0.92);
    return {
      id: m.id, name: m.name, party: m.party, label: m.label, faction: m.faction, chamber: m.chamber, state: m.state,
      district: m.district, cls: m.cls, lean, real: true, sinceYear: 2025, friends: {}, pacFor: 0, pacAgainst: 0,
    };
  });
  s.vacancies = VACANCIES_2026.map((v) => ({ ...v }));
  s.stateLegs = {};
  for (const [st, [sd, sr, hd, hr]] of Object.entries(STATE_LEGS)) s.stateLegs[st] = { senateD: sd, senateR: sr, houseD: hd, houseR: hr };
}

export function seats(s: GameState, chamber: "senate" | "house") {
  let D = 0, R = 0;
  for (const p of s.politicians) if (p.chamber === chamber) p.party === "D" ? D++ : R++;
  return { D, R };
}

export function refreshMajorities(s: GameState) {
  const h = seats(s, "house"), se = seats(s, "senate");
  s.politics.congress = h.D > h.R ? "commonwealth" : "frontier";
  // A 50-50 Senate goes to the vice president's party.
  s.politics.senate = se.D > se.R ? "commonwealth" : se.R > se.D ? "frontier" : s.politics.president;
}

// ---------------------------------------------------------------- votes

const influence = (dollars: number) => Math.sqrt(Math.max(0, dollars) / 10e6);

/** Net pressure on a member to vote for moving `law` in direction `dir`: their PAC friends' lobbying, plus industry lobbying for swayable members. */
function pull(s: GameState, m: Politician, law: LawId, dir: 1 | -1): number {
  let p = 0;
  const unit = m.chamber === "senate" ? 2e6 : 0.5e6;
  for (const c of s.companies) {
    if (!c.alive) continue;
    const friend = m.friends[c.id] ?? 0;
    if (Math.abs(friend) < 1) continue;
    for (const l of c.lobbying) if (l.law === law) p += (l.dir === dir ? 1 : -1) * (friend / unit);
  }
  let forD = 0, against = 0;
  for (const c of s.companies) if (c.alive) for (const l of c.lobbying) if (l.law === law) (l.dir === dir ? (forD += l.monthly) : (against += l.monthly));
  p += ((influence(forD) - influence(against)) / 3) * factionDef(m.faction, m.party).swayable;
  return p;
}

export function memberVote(s: GameState, m: Politician, law: LawId, cur: number, target: number, sponsor: PartyId): boolean {
  const pref = factionDef(m.faction, m.party).prefs[law];
  const dCur = Math.abs(cur - pref), dTar = Math.abs(target - pref);
  let yes = dTar < dCur ? 1 : dTar > dCur ? -1 : toParty(m.party) === sponsor ? 1 : -1;
  // Only mild opposition (or mild support) can be bought or lobbied away.
  if (Math.abs(dTar - dCur) <= 1) {
    const pr = pull(s, m, law, (target > cur ? 1 : -1) as 1 | -1);
    if (yes < 0 && pr > 1) yes = 1;
    else if (yes > 0 && pr < -1) yes = -1;
  }
  return yes > 0;
}

export interface Whip {
  house: { yes: number; no: number; need: number };
  senate: { yes: number; no: number; need: number; rule: "majority" | "cloture" };
  vetoed: boolean;
  override: boolean;
  passes: boolean;
}

export function whip(s: GameState, law: LawId, target: number, sponsor: PartyId): Whip {
  const cur = s.politics.laws[law];
  let hy = 0, hn = 0, sy = 0, sn = 0;
  for (const m of s.politicians) {
    const v = memberVote(s, m, law, cur, target, sponsor);
    if (m.chamber === "house") v ? hy++ : hn++;
    else v ? sy++ : sn++;
  }
  const seated = hy + hn;
  const rule: "majority" | "cloture" = RECONCILIATION.includes(law) ? "majority" : "cloture";
  const houseNeed = Math.floor(seated / 2) + 1;
  let senateNeed = rule === "majority" ? 51 : 60;
  // Vice president breaks 50-50 ties on majority votes, siding with the president's platform.
  const presWants = LAW_BY_ID[law].platform[s.politics.president];
  if (rule === "majority" && sy === 50 && Math.abs(target - presWants) < Math.abs(cur - presWants)) senateNeed = 50;
  const passedCongress = hy >= houseNeed && sy >= senateNeed;
  const vetoed = passedCongress && Math.abs(target - presWants) > Math.abs(cur - presWants);
  const override = vetoed && hy >= Math.ceil((seated * 2) / 3) && sy >= 67;
  return {
    house: { yes: hy, no: hn, need: houseNeed },
    senate: { yes: sy, no: sn, need: senateNeed, rule },
    vetoed, override, passes: passedCongress && (!vetoed || override),
  };
}

export function recordVote(s: GameState, law: LawId, target: number, w: Whip): VoteResult {
  const outcome: VoteResult["outcome"] = w.house.yes < w.house.need ? "failed-house" : w.senate.yes < w.senate.need ? "failed-senate" : w.vetoed && !w.override ? "vetoed" : "passed";
  const v: VoteResult = { day: s.day, law, target, house: w.house, senate: w.senate, outcome };
  s.politics.lastVote = v;
  return v;
}

// ---------------------------------------------------------------- elections

function newName(s: GameState, used: Set<string>): string {
  for (let i = 0; i < 30; i++) {
    const n = `${FIRST_NAMES[Math.floor(rand(s) * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand(s) * LAST_NAMES.length)]}`;
    if (!used.has(n)) return n;
  }
  return `${FIRST_NAMES[0]} ${LAST_NAMES[0]} ${Math.floor(rand(s) * 99)}`;
}

function pickFaction(s: GameState, party: "D" | "R", lean: number): Faction {
  const r = rand(s);
  if (party === "D") {
    if (lean > 0.7) return r < 0.15 ? "socialist" : r < 0.6 ? "progressive" : "liberal";
    if (lean > 0.55) return r < 0.3 ? "progressive" : r < 0.8 ? "liberal" : "moderate";
    return r < 0.6 ? "moderate" : "bluedog";
  }
  if (lean < 0.3) return r < 0.55 ? "maga" : r < 0.75 ? "populist" : r < 0.85 ? "libertarian" : "corporate";
  if (lean < 0.45) return r < 0.4 ? "maga" : r < 0.8 ? "corporate" : r < 0.9 ? "populist" : "libertarian";
  return r < 0.6 ? "moderate" : "corporate";
}

/** PAC money moves the needle a little, with diminishing returns. */
function pacEdge(m: Politician): number {
  const unit = m.chamber === "senate" ? 5e6 : 1e6;
  const f = (x: number) => Math.min(0.04, 0.01 * Math.sqrt(x / unit));
  const towardIncumbent = f(m.pacFor) - f(m.pacAgainst);
  return m.party === "D" ? towardIncumbent : -towardIncumbent;
}

function contest(s: GameState, used: Set<string>, swing: number, year: number, seat: { chamber: "senate" | "house"; state: string; district?: number; cls?: number; lean: number }, inc?: Politician): Politician {
  const running = inc && rand(s) > 0.06;
  let dShare = seat.lean + swing + 0.03 * randNormal(s);
  if (inc) dShare += pacEdge(inc);
  if (running && inc) dShare += inc.party === "D" ? 0.02 : -0.02;
  const winner: "D" | "R" = dShare >= 0.5 ? "D" : "R";
  if (running && inc && inc.party === winner) { inc.pacFor = 0; inc.pacAgainst = 0; return inc; }
  const name = newName(s, used);
  used.add(name);
  return {
    id: `gen-${s.day}-${Math.floor(rand(s) * 1e9)}`, name, party: winner, label: winner, faction: pickFaction(s, winner, seat.lean),
    chamber: seat.chamber, state: seat.state, district: seat.district, cls: seat.cls, lean: seat.lean, real: false, sinceYear: year + 1,
    friends: {}, pacFor: 0, pacAgainst: 0,
  };
}

export interface CongressResult {
  houseD: number; houseR: number; senateD: number; senateR: number; flips: string[]; ecD?: number; ecR?: number; presidentName?: string; presidentParty?: PartyId;
}

export function holdCongressElections(s: GameState, dShare: number, year: number, presidential: boolean): CongressResult {
  const swing = dShare - 0.5;
  const used = new Set(s.politicians.map((p) => p.name));
  const flips: string[] = [];
  const next: Politician[] = [];
  // House: every seat.
  const byDistrict = new Map<string, Politician>();
  for (const p of s.politicians) if (p.chamber === "house") byDistrict.set(`${p.state}-${p.district}`, p);
  for (const [st, n] of Object.entries(APPORTIONMENT)) {
    for (const d of n === 1 ? [0] : Array.from({ length: n }, (_, i) => i + 1)) {
      const inc = byDistrict.get(`${st}-${d}`);
      const lean = inc?.lean ?? clamp((STATE_LEAN[st] ?? 0.5) + 0.05 * randNormal(s), 0.15, 0.9);
      const w = contest(s, used, swing, year, { chamber: "house", state: st, district: d, lean }, inc);
      if (inc && w.party !== inc.party && flips.length < 12) flips.push(`${st}-${d === 0 ? "AL" : d}`);
      next.push(w);
    }
  }
  // Senate: one class.
  const cls = [2, 3, 1][Math.round((year - 2026) / 2) % 3];
  for (const p of s.politicians) {
    if (p.chamber !== "senate") continue;
    if (p.cls !== cls) { next.push(p); continue; }
    const w = contest(s, used, swing, year, { chamber: "senate", state: p.state, cls: p.cls, lean: p.lean }, p);
    if (w.party !== p.party) flips.push(`${p.state} Senate`);
    next.push(w);
  }
  s.politicians = next;
  s.vacancies = [];
  // State legislatures drift toward what the national mood and state lean imply.
  for (const [st, leg] of Object.entries(s.stateLegs)) {
    const target = 1 / (1 + Math.exp(-((STATE_LEAN[st] ?? 0.5) + swing - 0.5) * 10));
    const move = (d: number, r: number) => {
      const tot = d + r;
      if (!tot) return [0, 0];
      const nd = Math.round(d + (target * tot - d) * 0.35 + randNormal(s) * tot * 0.01);
      return [clamp(nd, 0, tot), tot - clamp(nd, 0, tot)];
    };
    [leg.senateD, leg.senateR] = move(leg.senateD, leg.senateR);
    [leg.houseD, leg.houseR] = move(leg.houseD, leg.houseR);
  }
  const h = seats(s, "house"), se = seats(s, "senate");
  const res: CongressResult = { houseD: h.D, houseR: h.R, senateD: se.D, senateR: se.R, flips };
  if (presidential) {
    let ecD = 3; // DC
    for (const [st, n] of Object.entries(APPORTIONMENT)) {
      const share = (STATE_LEAN[st] ?? 0.5) + swing + 0.02 * randNormal(s);
      if (share >= 0.5) ecD += n + 2;
    }
    res.ecD = ecD;
    res.ecR = 538 - ecD;
    res.presidentParty = ecD >= 270 ? "commonwealth" : "frontier";
  }
  return res;
}

/** A new president: the incumbent if eligible and their party held on, otherwise a senator of the winning party. */
export function pickPresident(s: GameState, party: PartyId): { name: string; vp: string } {
  const p = fromParty(party);
  const pool = s.politicians.filter((m) => m.chamber === "senate" && m.party === p && m.real);
  const any = s.politicians.filter((m) => m.chamber === "senate" && m.party === p);
  const list = pool.length ? pool : any;
  const a = list[Math.floor(rand(s) * list.length)];
  const rest = s.politicians.filter((m) => m.party === p && m !== a && (m.chamber === "house" || m.real));
  const b = rest[Math.floor(rand(s) * rest.length)];
  return { name: a?.name ?? "A. Candidate", vp: b?.name ?? "B. Running-mate" };
}

export function decayFriendship(s: GameState) {
  for (const p of s.politicians) for (const k of Object.keys(p.friends)) {
    p.friends[Number(k)] *= 0.98;
    if (Math.abs(p.friends[Number(k)]) < 1000) delete p.friends[Number(k)];
  }
}

export function electionYearOf(day: number) {
  return dateOfDay(day).getUTCFullYear();
}

// ---------------------------------------------------------------- PACs

export function foundPac(s: GameState, c: Company, name: string): string {
  const cost = 2e6;
  c.cash -= cost;
  c.current.lobbying += cost;
  c.pac = { name, funds: 0, foundedDay: s.day, raised: 0, spent: 0 };
  return `${name} registered with the FEC (${fmtMoney(cost)} in legal fees).`;
}

export function fundPac(c: Company, amount: number): string {
  if (!c.pac) return "No PAC.";
  c.cash -= amount;
  c.current.lobbying += amount;
  c.pac.funds += amount;
  c.pac.raised += amount;
  c.image = clamp(c.image - amount / 20e9, 0, 1);
  return `Moved ${fmtMoney(amount)} into ${c.pac.name}.`;
}

export function pacSpend(s: GameState, c: Company, pid: string, amount: number, mode: "support" | "oppose"): string {
  const p = s.politicians.find((x) => x.id === pid);
  if (!c.pac || !p) return "Nothing happened.";
  c.pac.funds -= amount;
  c.pac.spent += amount;
  if (mode === "support") {
    p.pacFor += amount;
    p.friends[c.id] = (p.friends[c.id] ?? 0) + amount;
    return `${c.pac.name} spent ${fmtMoney(amount)} backing ${p.name}.`;
  }
  p.pacAgainst += amount;
  p.friends[c.id] = (p.friends[c.id] ?? 0) - amount * 0.5;
  return `${c.pac.name} spent ${fmtMoney(amount)} on ads against ${p.name}.`;
}
