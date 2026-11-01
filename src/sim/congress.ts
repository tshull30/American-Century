// Congress: real members at game start, faction-driven votes, the filibuster and veto,
// seat-by-seat elections, state legislatures and PACs.
import { MEMBERS_2026, STATE_LEAN, STATE_LEGS, VACANCIES_2026 } from "./data/congress";
import { factionDef } from "./data/factions";
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
      district: m.district, cls: m.cls, lean, real: true, sinceYear: 2025, friends: {}, pacFor: 0, pacAgainst: 0, personal: 0,
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

/** Spend PAC money on a member's race: backing them, or backing their opponent. Builds (or burns) goodwill either way. */
export function pacSpend(s: GameState, c: Company, pid: string, amount: number, mode: "support" | "oppose"): string {
  const p = s.politicians.find((x) => x.id === pid);
  if (!c.pac || !p) return "Nothing happened.";
  c.pac.funds -= amount;
  c.pac.spent += amount;
  const race = s.races.find((r) => r.incumbentId === p.id);
  const side: "D" | "R" = mode === "support" ? p.party : p.party === "D" ? "R" : "D";
  if (race) {
    const v = race.pac[c.id] ?? (race.pac[c.id] = { D: 0, R: 0 });
    v[side] += amount;
  }
  if (mode === "support") {
    p.pacFor += amount;
    p.friends[c.id] = (p.friends[c.id] ?? 0) + amount;
    return `${c.pac.name} spent ${fmtMoney(amount)} backing ${p.name}${race ? "" : " (issue ads; their seat isn't up this cycle)"}.`;
  }
  p.pacAgainst += amount;
  p.friends[c.id] = (p.friends[c.id] ?? 0) - amount * 0.5;
  return race ? `${c.pac.name} spent ${fmtMoney(amount)} against ${p.name}.` : `${c.pac.name} ran ${fmtMoney(amount)} of attack ads on ${p.name}; their seat isn't up this cycle.`;
}

/** Spend PAC money directly in a race, for one party's nominee. */
export function pacRace(s: GameState, c: Company, raceId: string, side: "D" | "R", amount: number): string {
  const r = s.races.find((x) => x.id === raceId);
  if (!c.pac || !r) return "Nothing happened.";
  c.pac.funds -= amount;
  c.pac.spent += amount;
  const v = r.pac[c.id] ?? (r.pac[c.id] = { D: 0, R: 0 });
  v[side] += amount;
  const nom = r.nominees[side];
  if (nom?.politicianId) {
    const p = s.politicians.find((x) => x.id === nom.politicianId);
    if (p) p.friends[c.id] = (p.friends[c.id] ?? 0) + amount;
  }
  return `${c.pac.name} spent ${fmtMoney(amount)} for the ${side === "D" ? "Democrat" : "Republican"}${nom ? `, ${nom.name},` : ""} in ${r.id}.`;
}
