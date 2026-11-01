// Executives and the board of directors.
//
// Every company has five executives. Each has a skill (1–5) and a trait or two that change
// how the company runs. The board watches the stock and the CEO; it has to approve big moves,
// gets replaced at the annual meeting if shareholders are unhappy, and activist funds show up
// when the stock lags its peers.
import { personName } from "./names";
import { cultureFor } from "./names";
import { notePoach } from "./people";
import type { Company, GameState } from "./types";
import { clamp, rand } from "./util";

export type ExecRole = "ceo" | "cfo" | "coo" | "cto" | "cmo";
export const ROLES: ExecRole[] = ["ceo", "cfo", "coo", "cto", "cmo"];
export const ROLE_NAME: Record<ExecRole, string> = {
  ceo: "Chief Executive", cfo: "Chief Financial Officer", coo: "Chief Operating Officer", cto: "Chief Technology Officer", cmo: "Chief Marketing Officer",
};
export const ROLE_SHORT: Record<ExecRole, string> = { ceo: "CEO", cfo: "CFO", coo: "COO", cto: "CTO", cmo: "CMO" };
export const ROLE_EFFECT: Record<ExecRole, string> = {
  ceo: "Investor confidence, public image and the board's trust",
  cfo: "Borrowing costs and credit limit",
  coo: "Output per worker at every site",
  cto: "Research output",
  cmo: "How far marketing spend goes",
};

export type TraitId =
  | "visionary" | "cost_cutter" | "dealmaker" | "celebrity" | "operator" | "builder" | "penny_pincher" | "sandbagger"
  | "growth_hacker" | "brand_steward" | "engineer" | "scandal_prone" | "loyal" | "union_friendly" | "connected" | "steady";

export const TRAITS: Record<TraitId, { name: string; effect: string; roles?: ExecRole[]; bad?: boolean }> = {
  visionary: { name: "Visionary", effect: "Research +10%, investors pay a little more", roles: ["ceo", "cto"] },
  cost_cutter: { name: "Cost cutter", effect: "Running costs −4%; workers like you less", roles: ["ceo", "coo", "cfo"] },
  dealmaker: { name: "Dealmaker", effect: "Target boards accept 8 points less premium", roles: ["ceo", "cfo"] },
  celebrity: { name: "Celebrity", effect: "Marketing +15% and a brighter image, but scandals happen", roles: ["ceo", "cmo"] },
  operator: { name: "Operator", effect: "Output per worker +2%", roles: ["coo", "ceo"] },
  builder: { name: "Builder", effect: "Construction 20% faster", roles: ["coo"] },
  penny_pincher: { name: "Penny pincher", effect: "Interest rate −0.4 points", roles: ["cfo"] },
  sandbagger: { name: "Sandbagger", effect: "Wall Street expects 2% less, so you beat more often", roles: ["cfo", "ceo"] },
  growth_hacker: { name: "Growth hacker", effect: "Marketing +20%", roles: ["cmo"] },
  brand_steward: { name: "Brand steward", effect: "Public image recovers faster", roles: ["cmo", "ceo"] },
  engineer: { name: "Engineer at heart", effect: "Research +15%", roles: ["cto"] },
  scandal_prone: { name: "Scandal-prone", effect: "Sooner or later, a headline", bad: true },
  loyal: { name: "Loyal", effect: "Won't take a rival's offer" },
  union_friendly: { name: "Union-friendly", effect: "Workers like you more; wages +1%", roles: ["coo", "ceo"] },
  connected: { name: "Politically connected", effect: "Lobbying goes 20% further", roles: ["ceo"] },
  steady: { name: "Steady hand", effect: "The board trusts them a bit more" },
};

export interface Exec {
  id: number;
  name: string;
  role: ExecRole;
  age: number;
  skill: number;
  traits: TraitId[];
  /** Annual pay, USD (salary, bonus and stock). */
  pay: number;
  hiredMonth: number;
  from?: string;
  /** People: beliefs, background, opinion of the player (rival CEOs) and morale (your own team). */
  beliefs?: import("./people").Beliefs;
  bio?: import("./people").Bio;
  regard?: import("./people").Regard;
  morale?: number;
}

export type BoardKind = "founder" | "insider" | "independent" | "institutional" | "activist";
export const BOARD_KIND: Record<BoardKind, string> = {
  founder: "Founder", insider: "Insider", independent: "Independent", institutional: "Institutional investor", activist: "Activist",
};

export interface Director {
  id: number;
  name: string;
  kind: BoardKind;
  /** Inclination to back management, 0–1. */
  loyalty: number;
  since: number;
}

export type ActivistDemand = "buyback" | "dividend" | "cut_costs" | "replace_ceo";
export const DEMAND_TEXT: Record<ActivistDemand, string> = {
  buyback: "Buy back stock worth 5% of the company",
  dividend: "Pay out at least 30% of profit as dividends",
  cut_costs: "Cut marketing to 3% of revenue or less and stop paying above market",
  replace_ceo: "Replace the CEO",
};

export interface Activist {
  fund: string;
  stake: number;
  demand: ActivistDemand;
  startMonth: number;
  startCeo: number;
  buybackTarget: number;
  boughtBack: number;
}

export interface Board {
  members: Director[];
  /** Confidence in management, 0–1. */
  confidence: number;
  /** Month of the next annual shareholder meeting. */
  nextMeeting: number;
  activist?: Activist;
  votes: { month: number; text: string; yes: number; no: number }[];
}

export interface Leadership {
  execs: Exec[];
  board: Board;
  /** Player only: candidates by role. */
  candidates?: Partial<Record<ExecRole, Exec[]>>;
  /** Player only: a rival is trying to hire away an executive. */
  poach?: { execId: number; rival: string; rivalId: number; pay: number; deadlineDay: number };
}

const FUNDS = ["Elm Street Capital", "Blackwater Partners", "Corvid Value Fund", "Trident Activist Partners", "Starboard Hill", "Third Rail Capital", "Pershing Bay", "Iron Gate Advisors"];


function execPay(role: ExecRole, skill: number, c: Company): number {
  const base = { ceo: 3e6, cfo: 1.4e6, coo: 1.4e6, cto: 1.3e6, cmo: 1e6 }[role];
  const size = clamp(Math.sqrt(Math.max(c.marketCap, 1e8) / 10e9), 0.15, 8);
  return base * (0.4 + 0.3 * skill) * size;
}

function pickTraits(s: GameState, role: ExecRole): TraitId[] {
  const pool = (Object.keys(TRAITS) as TraitId[]).filter((t) => !TRAITS[t].roles || TRAITS[t].roles!.includes(role));
  const out: TraitId[] = [];
  const n = rand(s) < 0.35 ? 2 : 1;
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const t = pool[Math.floor(rand(s) * pool.length)];
    if (t === "scandal_prone" && rand(s) < 0.6) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function makeExec(s: GameState, c: Company, role: ExecRole, skillBias = 0, from?: string): Exec {
  const state = s.cities[c.hqSite.city]?.state ?? c.hq;
  const female = rand(s) < (role === "cmo" ? 0.45 : role === "cfo" ? 0.25 : role === "ceo" ? 0.1 : 0.2);
  const skill = clamp(Math.round((2.2 + rand(s) * 2.6 + skillBias) * 2) / 2, 1, 5);
  const e: Exec = {
    id: s.nextId++, name: personName(s, cultureFor(s, state, 1), state, female), role,
    age: 38 + Math.floor(rand(s) * 26), skill, traits: pickTraits(s, role), pay: 0, hiredMonth: s.month, from,
  };
  e.pay = execPay(role, skill, c) * (0.85 + rand(s) * 0.3);
  return e;
}

function makeDirector(s: GameState, c: Company, kind: BoardKind): Director {
  const state = s.cities[c.hqSite.city]?.state ?? c.hq;
  const loyalty = { founder: 0.9, insider: 0.75, independent: 0.5, institutional: 0.4, activist: 0.05 }[kind];
  return { id: s.nextId++, name: personName(s, cultureFor(s, state, 1), state, rand(s) < 0.3), kind, loyalty: clamp(loyalty + (rand(s) - 0.5) * 0.2, 0, 1), since: s.month - Math.floor(rand(s) * 60) };
}

/** Set up executives and a board for a company (new game, startups, spin-ups). */
export function initLeadership(s: GameState, c: Company) {
  const bias = c.kind === "incumbent" ? 0.4 : c.kind === "startup" ? -0.3 : 0;
  const execs = ROLES.map((r) => {
    const e = makeExec(s, c, r, bias);
    e.hiredMonth = s.month - Math.floor(rand(s) * 72);
    return e;
  });
  const members: Director[] = [];
  if (c.kind === "startup") {
    members.push(makeDirector(s, c, "founder"), makeDirector(s, c, "founder"), makeDirector(s, c, "institutional"), makeDirector(s, c, "institutional"), makeDirector(s, c, "independent"));
  } else {
    const n = c.kind === "incumbent" ? 11 : 9;
    members.push(makeDirector(s, c, rand(s) < 0.4 ? "founder" : "insider"), makeDirector(s, c, "insider"));
    members.push(makeDirector(s, c, "institutional"));
    while (members.length < n) members.push(makeDirector(s, c, "independent"));
  }
  c.leadership = {
    execs, board: { members, confidence: 0.65, nextMeeting: nextMeetingMonth(s.month, c.id), votes: [] },
  };
}

function nextMeetingMonth(from: number, id: number): number {
  // Annual meetings run April–June, staggered by company.
  const want = 3 + (id % 3);
  let m = from + 1;
  while ((((m % 12) + 12) % 12) !== want) m++;
  return m;
}

// ---------------------------------------------------------------- effects

function execOf(c: Company, r: ExecRole): Exec | undefined {
  return c.leadership?.execs.find((e) => e.role === r);
}
/** −1 (terrible or vacant-ish) … +1 (superb). A vacancy counts as −1.5. */
export function roleFactor(c: Company, r: ExecRole): number {
  if (!c.leadership) return 0;
  const e = execOf(c, r);
  // Happy executives play above their résumé; miserable ones coast.
  return e ? (e.skill - 3) / 2 + clamp(((e.morale ?? 65) - 65) / 100, -0.25, 0.15) : -1.5;
}
export function hasTrait(c: Company, t: TraitId, roles?: ExecRole[]): boolean {
  return !!c.leadership?.execs.some((e) => e.traits.includes(t) && (!roles || roles.includes(e.role)));
}

export const leadEffects = {
  research: (c: Company) => (1 + 0.12 * roleFactor(c, "cto") + (hasTrait(c, "visionary") ? 0.1 : 0) + (hasTrait(c, "engineer") ? 0.15 : 0)) * (c.allyBoost ?? 1),
  efficiency: (c: Company) => 1 + 0.03 * roleFactor(c, "coo") + (hasTrait(c, "operator") ? 0.02 : 0),
  runningCost: (c: Company) => (hasTrait(c, "cost_cutter") ? 0.96 : 1) * (hasTrait(c, "union_friendly") ? 1.01 : 1),
  marketing: (c: Company) => (1 + 0.12 * roleFactor(c, "cmo") + (hasTrait(c, "growth_hacker") ? 0.2 : 0) + (hasTrait(c, "celebrity") ? 0.15 : 0)) * (c.allyBoost ?? 1),
  interest: (c: Company) => -0.004 * roleFactor(c, "cfo") - (hasTrait(c, "penny_pincher") ? 0.004 : 0),
  credit: (c: Company) => 1 + 0.08 * roleFactor(c, "cfo"),
  valuation: (c: Company) => 1 + 0.04 * roleFactor(c, "ceo") + (hasTrait(c, "visionary", ["ceo"]) ? 0.03 : 0),
  expectations: (c: Company) => (hasTrait(c, "sandbagger") ? 0.98 : 1),
  premium: (c: Company) => (hasTrait(c, "dealmaker") ? -0.08 : 0),
  construction: (c: Company) => (hasTrait(c, "builder") ? 0.8 : 1),
  image: (c: Company) => 0.02 * roleFactor(c, "ceo") + (hasTrait(c, "celebrity") ? 0.02 : 0) + (hasTrait(c, "brand_steward") ? 0.02 : 0),
  workers: (c: Company) => (hasTrait(c, "cost_cutter") ? -0.05 : 0) + (hasTrait(c, "union_friendly") ? 0.05 : 0),
  lobbying: (c: Company) => (hasTrait(c, "connected") ? 1.2 : 1),
};

/** Monthly pay for executives and directors. */
export function leadershipCost(c: Company): number {
  if (!c.leadership) return 0;
  const execs = c.leadership.execs.reduce((a, e) => a + e.pay, 0);
  const fees = c.leadership.board.members.length * 300_000 * clamp(Math.sqrt(Math.max(c.marketCap, 1e8) / 10e9), 0.2, 3);
  return (execs + fees) / 12;
}

// ---------------------------------------------------------------- board votes

export type VoteKind = "acquisition" | "issuance" | "relocation" | "megaproject";
const VOTE_TEXT: Record<VoteKind, string> = {
  acquisition: "acquisition", issuance: "share issuance", relocation: "headquarters move", megaproject: "major construction project",
};

/** The board votes on a big move. Returns whether it passed and the tally. */
export function boardVote(s: GameState, c: Company, kind: VoteKind, what: string): { ok: boolean; yes: number; no: number; message: string } {
  const b = c.leadership?.board;
  if (!b) return { ok: true, yes: 0, no: 0, message: "" };
  let yes = 0, no = 0;
  for (const d of b.members) {
    let p = 0.25 + 0.45 * d.loyalty + 0.5 * (b.confidence - 0.5);
    if (d.kind === "activist") p = kind === "issuance" || kind === "acquisition" || kind === "megaproject" ? 0.05 : 0.4;
    if (d.kind === "founder") p += 0.15;
    if (kind === "issuance" && d.kind === "institutional") p -= 0.15;
    if (rand(s) < clamp(p, 0.02, 0.98)) yes++; else no++;
  }
  const ok = yes > no;
  b.votes.unshift({ month: s.month, text: `${VOTE_TEXT[kind]}: ${what}`, yes, no });
  b.votes = b.votes.slice(0, 12);
  return { ok, yes, no, message: ok ? `The board approved the ${VOTE_TEXT[kind]} ${yes}–${no}.` : `The board voted down the ${VOTE_TEXT[kind]} ${no}–${yes}. Win back its confidence and try again.` };
}

/** Does this move need the board? */
export function needsVote(c: Company, kind: VoteKind, amount: number): boolean {
  if (!c.isPlayer || !c.leadership) return false;
  if (kind === "relocation") return true;
  if (kind === "acquisition") return amount > c.marketCap * 0.05;
  if (kind === "issuance") return amount > 0.05;
  return amount > c.marketCap * 0.15;
}

// ---------------------------------------------------------------- hiring and firing (player)

export function refreshCandidates(s: GameState, c: Company, role: ExecRole) {
  if (!c.leadership) return;
  const out: Exec[] = [];
  for (let i = 0; i < 4; i++) out.push(makeExec(s, c, role, (rand(s) - 0.4) * 1.2));
  // Sometimes a rival's executive is open to a move, for a price.
  const rivals = s.companies.filter((o) => o.alive && o !== c && o.leadership && o.marketCap > c.marketCap * 0.2);
  if (rivals.length && rand(s) < 0.7) {
    const o = rivals[Math.floor(rand(s) * rivals.length)];
    const e = o.leadership!.execs.find((x) => x.role === role);
    if (e && !e.traits.includes("loyal")) out.push({ ...e, pay: Math.max(e.pay, execPay(role, e.skill, c)) * 1.3, from: o.name });
  }
  c.leadership.candidates = { ...(c.leadership.candidates ?? {}), [role]: out };
}

export function hireExec(s: GameState, c: Company, role: ExecRole, candidateId: number): { ok: boolean; message: string } {
  const L = c.leadership;
  const cand = L?.candidates?.[role]?.find((e) => e.id === candidateId);
  if (!L || !cand) return { ok: false, message: "That candidate is no longer available." };
  const old = L.execs.find((e) => e.role === role);
  let severance = 0;
  if (old) { severance = old.pay; L.execs = L.execs.filter((e) => e !== old); }
  // Poached from a rival: they need a replacement.
  if (cand.from) {
    notePoach(s, cand.from);
    const o = s.companies.find((x) => x.name === cand.from);
    if (o?.leadership) {
      o.leadership.execs = o.leadership.execs.filter((e) => e.id !== cand.id);
      o.leadership.execs.push(makeExec(s, o, role, -0.3));
    }
  }
  const hired: Exec = { ...cand, hiredMonth: s.month, morale: 75, regard: undefined };
  L.execs.push(hired);
  L.candidates![role] = L.candidates![role]!.filter((e) => e.id !== candidateId);
  c.cash -= severance + hired.pay * 0.25; // severance for the old one, a signing bonus for the new
  if (role === "ceo") L.board.confidence = clamp(L.board.confidence + (L.board.confidence < 0.5 ? 0.12 : -0.03) + 0.04 * (hired.skill - 3), 0, 1);
  return { ok: true, message: `${hired.name} is your new ${ROLE_SHORT[role]}${cand.from ? `, hired away from ${cand.from}` : ""}.${severance ? ` Severance for ${old!.name}: $${(severance / 1e6).toFixed(1)}M.` : ""}` };
}

export function fireExec(_s: GameState, c: Company, execId: number): { ok: boolean; message: string } {
  const L = c.leadership;
  const e = L?.execs.find((x) => x.id === execId);
  if (!L || !e) return { ok: false, message: "No such executive." };
  L.execs = L.execs.filter((x) => x !== e);
  c.cash -= e.pay;
  if (e.role === "ceo") L.board.confidence = clamp(L.board.confidence + (L.board.confidence < 0.45 ? 0.08 : -0.08), 0, 1);
  return { ok: true, message: `${e.name} is out as ${ROLE_SHORT[e.role]}, with $${(e.pay / 1e6).toFixed(1)}M in severance. Hire a replacement soon: the seat is empty.` };
}

export function answerPoach(s: GameState, c: Company, match: boolean): { ok: boolean; message: string } {
  const L = c.leadership;
  const p = L?.poach;
  if (!L || !p) return { ok: false, message: "No offer is pending." };
  const e = L.execs.find((x) => x.id === p.execId);
  L.poach = undefined;
  if (!e) return { ok: false, message: "They already left." };
  if (match) { e.pay = p.pay; e.morale = Math.min(100, (e.morale ?? 60) + 15); return { ok: true, message: `${e.name} is staying, now earning $${(e.pay / 1e6).toFixed(1)}M a year.` }; }
  return { ok: true, message: departTo(s, c, e, p.rivalId) };
}

function departTo(s: GameState, c: Company, e: Exec, rivalId: number): string {
  const L = c.leadership!;
  L.execs = L.execs.filter((x) => x !== e);
  const o = s.companies.find((x) => x.id === rivalId);
  if (o?.leadership) {
    o.leadership.execs = o.leadership.execs.filter((x) => x.role !== e.role);
    o.leadership.execs.push({ ...e, from: c.name, hiredMonth: s.month });
  }
  if (!c.isPlayer) L.execs.push(makeExec(s, c, e.role, -0.2));
  return `${e.name} left to become ${o?.name ?? "a rival"}'s ${ROLE_SHORT[e.role]}.`;
}

// ---------------------------------------------------------------- monthly

export interface LeadLog { (text: string, kind: "info" | "good" | "bad" | "deal", tag?: "leadership"): void }

export function updateLeadership(s: GameState, c: Company, peerReturn: number, log: LeadLog) {
  const L = c.leadership;
  if (!L) return;
  const b = L.board;
  const ceo = L.execs.find((e) => e.role === "ceo");

  // Birthdays and retirements.
  if (s.month % 12 === 0) for (const e of L.execs) e.age++;
  for (const e of [...L.execs]) {
    if (e.age >= 64 && rand(s) < 0.012) {
      L.execs = L.execs.filter((x) => x !== e);
      if (c.isPlayer) log(`${e.name}, your ${ROLE_SHORT[e.role]}, is retiring. Hire a replacement on the Leadership tab.`, "info", "leadership");
      else L.execs.push(makeExec(s, c, e.role));
    }
  }
  // AI companies fill vacancies right away.
  if (!c.isPlayer) for (const r of ROLES) if (!L.execs.some((e) => e.role === r)) L.execs.push(makeExec(s, c, r));

  // Scandals.
  for (const e of L.execs) {
    const p = 0.0008 + (e.traits.includes("scandal_prone") ? 0.012 : 0) + (e.traits.includes("celebrity") ? 0.003 : 0);
    if (rand(s) < p) {
      c.image = clamp(c.image - 0.08, 0, 1);
      c.hype *= 0.95;
      b.confidence = clamp(b.confidence - (e.role === "ceo" ? 0.2 : 0.1), 0, 1);
      if (c.isPlayer || c.marketCap > 300e9) log(`Scandal at ${c.name}: ${ROLE_SHORT[e.role]} ${e.name} is in the headlines for all the wrong reasons.`, "bad", c.isPlayer ? "leadership" : undefined);
    }
  }

  // Poaching attempts on the player's best people.
  if (c.isPlayer && !L.poach) {
    for (const e of L.execs) {
      const unhappy = (e.morale ?? 65) < 40 ? 3 : (e.morale ?? 65) > 80 ? 0.4 : 1;
      if (e.skill < 3.5 || e.traits.includes("loyal") || rand(s) > 0.012 * unhappy) continue;
      const rivals = s.companies.filter((o) => o.alive && o !== c && o.marketCap > c.marketCap * 0.3);
      if (!rivals.length) break;
      const o = rivals[Math.floor(rand(s) * rivals.length)];
      L.poach = { execId: e.id, rival: o.name, rivalId: o.id, pay: e.pay * (1.25 + rand(s) * 0.2), deadlineDay: s.day + 20 };
      log(`${o.name} is trying to hire away your ${ROLE_SHORT[e.role]}, ${e.name}. Match their offer or let them go (Leadership tab).`, "info", "leadership");
      break;
    }
  }
  if (L.poach && s.day >= L.poach.deadlineDay) {
    const e = L.execs.find((x) => x.id === L.poach!.execId);
    const rid = L.poach.rivalId;
    L.poach = undefined;
    if (e) log(departTo(s, c, e, rid), "bad", "leadership");
  }

  // Board confidence follows the stock against peers, results and the CEO.
  const h = c.history;
  const ret = h.length >= 13 && h[h.length - 13].marketCap > 0 ? c.marketCap / h[h.length - 13].marketCap - 1 : 0;
  const rel = clamp(ret - peerReturn, -0.6, 0.6);
  const target = clamp(0.6 + 0.8 * rel + 0.08 * roleFactor(c, "ceo") + (hasTrait(c, "steady") ? 0.05 : 0) - (c.distressMonths > 0 ? 0.25 : 0) - (ceo ? 0 : 0.1), 0.02, 0.98);
  b.confidence = clamp(b.confidence + (target - b.confidence) * 0.15, 0, 1);

  // Activists target laggards.
  if (!b.activist && c.marketCap > 2e9 && rel < -0.15 && rand(s) < (c.isPlayer ? 0.05 : 0.015)) {
    const demands: ActivistDemand[] = ["buyback", "dividend", "cut_costs", "replace_ceo"];
    const demand = demands[Math.floor(rand(s) * demands.length)];
    b.activist = {
      fund: FUNDS[Math.floor(rand(s) * FUNDS.length)], stake: 0.04 + rand(s) * 0.05, demand, startMonth: s.month, startCeo: ceo?.id ?? 0,
      buybackTarget: c.marketCap * 0.05, boughtBack: 0,
    };
    b.confidence = clamp(b.confidence - 0.05, 0, 1);
    if (c.isPlayer || c.marketCap > 300e9) log(`${b.activist.fund} disclosed a ${(b.activist.stake * 100).toFixed(1)}% stake in ${c.name} and demands: ${DEMAND_TEXT[demand].replace(/^./, (x) => x.toLowerCase())}.`, "deal", c.isPlayer ? "leadership" : undefined);
  }
  if (b.activist && activistSatisfied(c)) {
    if (c.isPlayer) log(`${b.activist.fund} says it's satisfied and is standing down.`, "good", "leadership");
    b.activist = undefined;
    b.confidence = clamp(b.confidence + 0.08, 0, 1);
  }
  // AI companies give activists what they want, eventually.
  if (!c.isPlayer && b.activist && s.month - b.activist.startMonth > 6) {
    if (b.activist.demand === "dividend") c.dividendPct = Math.max(c.dividendPct, 0.3);
    if (b.activist.demand === "cut_costs") { c.marketingPct = Math.min(c.marketingPct, 0.03); c.wagePolicy = Math.min(c.wagePolicy, 1); }
    if (b.activist.demand === "replace_ceo") { L.execs = L.execs.filter((e) => e.role !== "ceo"); L.execs.push(makeExec(s, c, "ceo", 0.3)); }
    b.activist = undefined;
  }

  // Annual meeting: directors stand for election.
  if (s.month >= b.nextMeeting) {
    b.nextMeeting = nextMeetingMonth(s.month, c.id);
    annualMeeting(s, c, log);
  }
}

function activistSatisfied(c: Company): boolean {
  const a = c.leadership?.board.activist;
  if (!a) return false;
  const ceo = c.leadership!.execs.find((e) => e.role === "ceo");
  switch (a.demand) {
    case "buyback": return a.boughtBack >= a.buybackTarget;
    case "dividend": return c.dividendPct >= 0.3;
    case "cut_costs": return c.marketingPct <= 0.03 && c.wagePolicy <= 1.0;
    case "replace_ceo": return !!ceo && ceo.id !== a.startCeo;
  }
}

function annualMeeting(s: GameState, c: Company, log: LeadLog) {
  const L = c.leadership!;
  const b = L.board;
  let replaced = 0;
  // Unhappy shareholders vote out independents.
  for (const d of b.members) {
    if (d.kind !== "independent" && d.kind !== "insider") continue;
    if (rand(s) < (0.55 - b.confidence) * 0.6) {
      Object.assign(d, makeDirector(s, c, "independent"), { loyalty: clamp(0.25 + b.confidence * 0.4, 0, 1), since: s.month });
      replaced++;
    }
  }
  // Proxy fight.
  const a = b.activist;
  if (a && s.month - a.startMonth >= 3) {
    const seats = Math.max(0, Math.round(1 + 4 * (0.6 - b.confidence)));
    let won = 0;
    for (const d of b.members) {
      if (won >= seats) break;
      if (d.kind === "independent" || d.kind === "institutional") { Object.assign(d, makeDirector(s, c, "activist"), { since: s.month }); won++; }
    }
    const activists = b.members.filter((d) => d.kind === "activist").length;
    if (c.isPlayer) log(won ? `Proxy fight: ${a.fund} won ${won} board seat${won > 1 ? "s" : ""}.` : `Proxy fight: shareholders backed management against ${a.fund}.`, won ? "bad" : "good", "leadership");
    if (activists > b.members.length / 2) {
      // The activists control the board: they get their way.
      if (a.demand === "dividend") c.dividendPct = Math.max(c.dividendPct, 0.3);
      if (a.demand === "cut_costs") { c.marketingPct = Math.min(c.marketingPct, 0.03); c.wagePolicy = Math.min(c.wagePolicy, 1); }
      if (a.demand === "buyback") c.cash = Math.max(0, c.cash - (a.buybackTarget - a.boughtBack));
      L.execs = L.execs.filter((e) => e.role !== "ceo");
      L.execs.push(makeExec(s, c, "ceo", 0));
      if (c.isPlayer) log(`${a.fund} now controls ${c.name}'s board. It forced through its demand and installed a new CEO.`, "bad", "leadership");
      b.activist = undefined;
    }
  }
  // The board fires a CEO it has lost faith in.
  if (b.confidence < 0.18 && L.execs.some((e) => e.role === "ceo")) {
    const ceo = L.execs.find((e) => e.role === "ceo")!;
    L.execs = L.execs.filter((e) => e !== ceo);
    L.execs.push(makeExec(s, c, "ceo", 0.2));
    b.confidence = 0.45;
    if (c.isPlayer) log(`The board fired CEO ${ceo.name} and named a replacement.`, "bad", "leadership");
  }
  if (c.isPlayer) log(`Annual meeting: board confidence ${(b.confidence * 100).toFixed(0)}%${replaced ? `; shareholders replaced ${replaced} director${replaced > 1 ? "s" : ""}` : ""}.`, "info");
}

export function recordBuyback(c: Company, amount: number) {
  const a = c.leadership?.board.activist;
  if (a) a.boughtBack += amount;
}
