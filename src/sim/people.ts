// People: what executives, rival CEOs and members of Congress believe, and what they think of you.
//
// Everyone has beliefs on five axes. Members of Congress take theirs from their real caucus
// faction (with a little personal variation); executives are fictional and get a background.
// Each person keeps a running tally of reasons to like or dislike the player's company, and
// those opinions change votes, hearings, feuds, partnerships and who stays on your team.
import { BUILDING_BY_ID } from "./data/buildings";
import type { GoodId } from "./data/goods";
import { LAW_BY_ID, type LawId } from "./data/laws";
import { factionDef, FACTIONS } from "./data/factions";
import { REGIONS } from "./data/regions";
import { STATE_BY_CODE } from "./data/states";
import { ROLE_SHORT, type Exec, type ExecRole } from "./leadership";
import type { Company, GameEvent, GameState, Politician } from "./types";
import { clamp, fmtMoney, rand } from "./util";

export type Axis = "econ" | "labor" | "climate" | "trade" | "tech";
export type Beliefs = Record<Axis, number>;
export const AXES: { id: Axis; name: string; lo: string; hi: string }[] = [
  { id: "econ", name: "Economy", lo: "Government should steer", hi: "Markets know best" },
  { id: "labor", name: "Labor", lo: "Business first", hi: "Workers first" },
  { id: "climate", name: "Climate", lo: "Drill, baby, drill", hi: "Climate emergency" },
  { id: "trade", name: "Trade", lo: "Free trade", hi: "America first" },
  { id: "tech", name: "Big Tech", lo: "Rein it in", hi: "Let it build" },
];

/** Opinion of the player's company, −100…100, with the reasons behind it. */
export interface Regard {
  score: number;
  why: Record<string, number>;
}

export interface Bio {
  hometown: string;
  school: string;
  career: string;
  /** What they say they care about, in their own words (executives are fictional). */
  motto: string;
}

export interface Relation {
  truceUntil?: number;
  partnerUntil?: number;
  lastContact?: number;
  lastJab?: number;
}

/** Things the player has done that people remember. */
export interface Record_ {
  unionStance: number;
  poached: Record<number, number>;
  meetings: Record<string, number>;
  openings: Record<string, number>;
  meetingsMonth: number;
  meetingsUsed: number;
  stateEmp: Record<string, number>;
}

const SCHOOLS = ["Stanford", "Harvard", "MIT", "Wharton", "the University of Michigan", "Ohio State", "Georgia Tech", "UT Austin", "Purdue", "Berkeley", "Notre Dame", "Texas A&M",
  "the University of Illinois", "Carnegie Mellon", "Howard", "the Naval Academy", "West Point", "Arizona State", "the University of Florida", "Penn State", "a state school nobody asks about",
  "Northwestern", "Columbia", "Vanderbilt", "the University of Washington", "Clemson", "BYU", "community college, then night school"];
const FIRST_JOBS = ["started on a factory floor", "sold copiers door to door", "was a Navy officer", "began as an auditor", "spent a decade in consulting", "came up through engineering",
  "ran a food truck", "worked in private equity", "was a management trainee", "drove trucks to pay for school", "was a software engineer", "worked on Capitol Hill",
  "was a pharmacist", "began in the oil fields", "taught high school math", "was a startup founder twice over"];

const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const noise = (key: string, axis: string) => ((hash(key + axis) % 1000) / 1000 - 0.5) * 0.3;

// ---------------------------------------------------------------- beliefs

/** Beliefs from the member's caucus faction, plus a little personal variation. */
export function politicianBeliefs(p: Politician): Beliefs {
  const f = factionDef(p.faction, p.party).prefs;
  const b: Beliefs = {
    econ: 1 - (f.corporate_tax + f.minimum_wage) / 3,
    labor: f.labor_unions / 2 + f.minimum_wage / 3 - 1,
    climate: f.climate - 1,
    trade: f.tariffs / 1.5 - 1,
    tech: 1 - (f.data_privacy + f.antitrust) / 2,
  };
  if (p.faction === "maga") b.tech -= 0.6;
  if (p.faction === "populist") b.tech -= 0.5;
  for (const a of AXES) b[a.id] = clamp(b[a.id] + noise(p.id, a.id), -1, 1);
  return b;
}

function sectorLean(c: Company): Partial<Beliefs> {
  const secs = new Set(c.buildings.map((b) => BUILDING_BY_ID[b.type].sector).filter(Boolean));
  const out: Partial<Beliefs> = {};
  if (secs.has("oilgas") || secs.has("mining")) out.climate = -0.5;
  if (secs.has("power")) out.climate = 0.2;
  if (secs.has("software") || secs.has("cloud") || secs.has("semis")) out.tech = 0.6;
  if (secs.has("materials") || secs.has("autos")) out.trade = 0.3;
  if (secs.has("retail") || secs.has("consumer")) out.trade = -0.3;
  return out;
}

export function ensurePersona(s: GameState, c: Company, e: Exec) {
  if (e.beliefs && e.bio) return;
  const lean = sectorLean(c);
  const b = {} as Beliefs;
  for (const a of AXES) b[a.id] = clamp((lean[a.id] ?? 0) * 0.6 + (rand(s) - 0.5) * 1.3 + (a.id === "econ" ? 0.35 : 0) + (a.id === "labor" ? -0.2 : 0), -1, 1);
  if (e.traits.includes("union_friendly")) b.labor = Math.max(b.labor, 0.5);
  if (e.traits.includes("cost_cutter")) b.labor = Math.min(b.labor, -0.3);
  if (e.traits.includes("visionary")) b.tech = Math.max(b.tech, 0.4);
  e.beliefs = b;
  const states = Object.keys(REGIONS);
  const st = rand(s) < 0.5 ? (s.cities[c.hqSite.city]?.state ?? c.hq) : states[Math.floor(rand(s) * states.length)];
  const regions = REGIONS[st] ?? [];
  const county = regions.length ? regions[Math.floor(rand(s) * regions.length)][1] : "";
  e.bio = {
    hometown: `${county ? county + ", " : ""}${STATE_BY_CODE[st]?.name ?? st}`,
    school: SCHOOLS[Math.floor(rand(s) * SCHOOLS.length)],
    career: FIRST_JOBS[Math.floor(rand(s) * FIRST_JOBS.length)],
    motto: mottoFor(s, e),
  };
}

function mottoFor(s: GameState, e: Exec): string {
  const b = e.beliefs!;
  const strongest = AXES.slice().sort((x, y) => Math.abs(b[y.id]) - Math.abs(b[x.id]))[0];
  const v = b[strongest.id];
  const lines: Record<Axis, [string[], string[]]> = {
    econ: [["Some things are too important to leave to the market.", "Capitalism needs guardrails, and I'm fine with that."],
      ["Get out of the way and let people build.", "Every regulation is a tax on the people who make things."]],
    labor: [["Payroll is a cost like any other.", "Nobody ever got rich overpaying."],
      ["Treat people right and they'll run through walls for you.", "The people on the line are the company."]],
    climate: [["The world runs on oil and gas, and it will for a long time.", "Energy policy should be about cheap power, not virtue."],
      ["We have about one decade to get this right.", "Every plant we build should be cleaner than the last."]],
    trade: [["Sell to the whole world, buy from the whole world.", "Tariffs are a tax on your own customers."],
      ["If it matters, make it in America.", "We gave away our industrial base once. Never again."]],
    tech: [["Software has eaten enough. Something has to push back.", "I don't trust anyone who calls themselves a platform."],
      ["The future gets built by people who ship.", "Every problem is an engineering problem if you look at it right."]],
  };
  const pool = lines[strongest.id][v >= 0 ? 1 : 0];
  return pool[Math.floor(rand(s) * pool.length)];
}

// ---------------------------------------------------------------- the player's record

export function playerRecord(s: GameState): Record_ {
  return (s.record ??= { unionStance: 0, poached: {}, meetings: {}, openings: {}, meetingsMonth: s.month, meetingsUsed: 0, stateEmp: {} });
}

function employeesByState(s: GameState, c: Company): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k in c.employees) {
    const city = s.cities[k.slice(0, k.lastIndexOf(":"))];
    if (!city) continue;
    out[city.state] = (out[city.state] ?? 0) + c.employees[k];
  }
  return out;
}

function layoffsByState(s: GameState, c: Company): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [cid, n] of Object.entries(c.layoffsByCity)) {
    const st = s.cities[cid]?.state;
    if (st) out[st] = (out[st] ?? 0) + n;
  }
  return out;
}

const FOSSIL = new Set(["coalmine", "oilfield", "gasfield", "refinery"]);
const GREEN = new Set(["solarfab", "turbines"]);
function energyMix(c: Company): { fossil: number; green: number } {
  let f = 0, g = 0, t = 0;
  for (const b of c.buildings) {
    if (b.type === "hq" || b.type === "rnd" || b.level <= 0) continue;
    t += b.level;
    if (FOSSIL.has(b.type) || (b.type === "power" && (b.method === "gas" || b.method === "coal"))) f += b.level;
    if (GREEN.has(b.type) || (b.type === "power" && ["solar", "wind", "nuclear"].includes(b.method))) g += b.level;
  }
  return { fossil: t ? f / t : 0, green: t ? g / t : 0 };
}

const DIGITAL: GoodId[] = ["software", "cloud", "digital_ads", "data_platforms", "streaming", "video_games", "ecommerce", "rideshare", "payments", "cybersecurity"];
function bigTechWeight(c: Company): number {
  const last = c.history.slice(-3);
  const tot = last.reduce((a, h) => a + h.revenue, 0);
  if (tot <= 0) return 0;
  const dig = last.reduce((a, h) => a + DIGITAL.reduce((x, g) => x + (h.revenueByGood[g] ?? 0), 0), 0);
  return (dig / tot) * clamp(c.marketCap / 500e9, 0, 1);
}

function foreignShare(s: GameState, c: Company): number {
  let f = 0, t = 0;
  for (const k in c.employees) { const n = c.employees[k]; t += n; if (s.cities[k.slice(0, k.lastIndexOf(":"))]?.foreign) f += n; }
  return t ? f / t : 0;
}

// ---------------------------------------------------------------- regard

const reg = (x: { regard?: Regard }): Regard => (x.regard ??= { score: 0, why: {} });
function settle(r: Regard) {
  let sum = 0;
  for (const k in r.why) { if (Math.abs(r.why[k]) < 0.3) delete r.why[k]; else sum += r.why[k]; }
  r.score = clamp(sum, -100, 100);
}
/** Move a level-type reason toward a target. */
const toward = (r: Regard, k: string, target: number, rate = 0.25) => { r.why[k] = (r.why[k] ?? 0) + (target - (r.why[k] ?? 0)) * rate; };
/** Add to an event-type reason (decays elsewhere). */
const bump = (r: Regard, k: string, d: number, cap = 40) => { r.why[k] = clamp((r.why[k] ?? 0) + d, -cap, cap); };
const EVENT_KEYS = ["layoffs", "meeting", "opening", "hearing", "union", "poach", "jab", "deal", "pricecut", "golf", "truce", "lobby:"];
function decayEvents(r: Regard, rate: number) {
  for (const k in r.why) if (EVENT_KEYS.some((e) => k === e || (e.endsWith(":") && k.startsWith(e)))) r.why[k] *= 1 - rate;
}

export function lawPref(p: Politician, law: LawId): number { return factionDef(p.faction, p.party).prefs[law]; }

/** Monthly: every member of Congress and every rival CEO updates what they think of you; your executives update their morale. */
export function updatePeople(s: GameState, log: (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void, warm: boolean) {
  const me = s.companies.find((c) => c.isPlayer);
  if (!me || !me.alive) return;
  const rec = playerRecord(s);
  if (rec.meetingsMonth !== s.month) { rec.meetingsMonth = s.month; rec.meetingsUsed = 0; }
  const emp = employeesByState(s, me);
  const laid = layoffsByState(s, me);
  const mix = energyMix(me);
  const tech = bigTechWeight(me);
  const abroad = foreignShare(s, me);
  const districts: Record<string, number> = {};
  for (const p of s.politicians) if (p.chamber === "house") districts[p.state] = (districts[p.state] ?? 0) + 1;

  for (const p of s.politicians) {
    const r = reg(p);
    const b = politicianBeliefs(p);
    decayEvents(r, 0.04);
    // Jobs at home (a House member counts a share of the state).
    const share = p.chamber === "senate" ? 1 : 1 / Math.max(1, districts[p.state] ?? 1);
    const local = (emp[p.state] ?? 0) * share;
    toward(r, "jobs", local > 50 ? clamp(9 * Math.log10(local / 50), 0, 30) : 0);
    const cut = (laid[p.state] ?? 0) * share;
    if (cut > 100) bump(r, "layoffs", -clamp(4 * Math.log10(cut / 100) + 2, 0, 12) * (1 + Math.max(0, b.labor) * 0.5), 30);
    // Lobbying: pushing toward what they want earns goodwill; against it, the opposite.
    for (const l of me.lobbying) {
      const cur = s.politics.laws[l.law], pref = lawPref(p, l.law);
      const max = (LAW_BY_ID[l.law]?.levels.length ?? 4) - 1;
      const target = cur + l.dir;
      const strength = clamp(Math.sqrt(l.monthly / 1e6), 0.3, 3);
      // At the end of the scale the lobbying only defends the status quo.
      const v = target < 0 || target > max ? (pref === cur ? 0.6 : Math.sign(cur - pref) === l.dir ? -1.2 : 0.4)
        : Math.abs(target - pref) < Math.abs(cur - pref) ? 1 : Math.abs(target - pref) === Math.abs(cur - pref) ? -0.3 : -1.2;
      bump(r, `lobby:${l.law}`, v * strength, 30);
    }
    // PAC money for or against them.
    const friend = p.friends[me.id] ?? 0;
    toward(r, "pac", clamp((friend / (p.chamber === "senate" ? 1e6 : 0.25e6)) * 8, -40, 30), 0.5);
    // Offshoring, energy, Big Tech and the company's public image.
    toward(r, "offshore", b.trade > 0.1 ? -b.trade * 35 * abroad : 0);
    toward(r, "climate", mix.fossil + mix.green > 0.02 ? b.climate * (mix.green - mix.fossil) * 30 : 0);
    toward(r, "bigtech", tech > 0.05 ? b.tech * 18 * tech : 0);
    toward(r, "image", (me.image - 0.6) * 25);
    if (rec.unionStance) toward(r, "union", b.labor * 12 * clamp(rec.unionStance, -1, 1), 0.3);
    settle(r);
  }

  // Rival CEOs.
  for (const c of s.companies) {
    if (!c.alive || c.isPlayer || !c.leadership) continue;
    const ceo = c.leadership.execs.find((e) => e.role === "ceo");
    if (!ceo) continue;
    ensurePersona(s, c, ceo);
    const r = reg(ceo);
    decayEvents(r, 0.03);
    const rel = relationWith(s, c.id);
    const ov = overlapShare(s, me, c);
    toward(r, "rivalry", ov > 0.01 ? -clamp(ov * 60, 2, 30) : 0);
    // Undercutting them in markets you share.
    let undercut = 0;
    for (const g of Object.keys(c.prices) as GoodId[]) {
      const mp = me.prices[g], cp = c.prices[g];
      const avg = s.markets[g]?.avgPrice ?? cp ?? 0;
      if (mp && cp && (s.markets[g]?.sales[me.id]?.share ?? 0) > 0.005 && (s.markets[g]?.sales[c.id]?.share ?? 0) > 0.005 && mp < cp * 0.9 && mp < avg * 0.95) undercut++;
    }
    if (undercut && !(rel.truceUntil && rel.truceUntil > s.month)) bump(r, "pricecut", -Math.min(2, 0.8 * undercut), 25);
    if (rec.poached[c.id]) { bump(r, "poach", -rec.poached[c.id], 45); delete rec.poached[c.id]; }
    // Respect for success and shared outlook.
    const myCeo = me.leadership?.execs.find((e) => e.role === "ceo");
    if (myCeo) { ensurePersona(s, me, myCeo); toward(r, "outlook", 10 - 6 * beliefDistance(ceo.beliefs!, myCeo.beliefs!), 0.2); }
    toward(r, "respect", me.marketCap > c.marketCap * 3 && ov < 0.05 ? 8 : 0, 0.1);
    if (rel.partnerUntil && rel.partnerUntil > s.month) toward(r, "partner", 20, 0.3); else toward(r, "partner", 0, 0.3);
    settle(r);
    if (!warm) rivalBehavior(s, me, c, ceo, r, rel, log);
  }

  // Your executives.
  if (me.leadership) {
    const h = me.history;
    const ret = h.length >= 13 && h[h.length - 13].marketCap > 0 ? me.marketCap / h[h.length - 13].marketCap - 1 : 0;
    for (const e of me.leadership.execs) {
      ensurePersona(s, me, e);
      const m = moraleDrivers(s, me, e, ret, mix);
      const target = clamp(60 + m.reduce((a, x) => a + x.v, 0), 0, 100);
      e.morale = clamp((e.morale ?? 65) + (target - (e.morale ?? 65)) * 0.2, 0, 100);
      if (!warm && e.morale < 30 && rand(s) < 0.025) {
        me.leadership.execs = me.leadership.execs.filter((x) => x !== e);
        log(`${e.name}, your ${ROLE_SHORT[e.role]}, has resigned. ${m.sort((a, b) => a.v - b.v)[0]?.text ?? ""}`, "bad", { headline: `${ROLE_SHORT[e.role]} ${e.name} quits ${me.name}`, deck: m.sort((a, b) => a.v - b.v)[0]?.text ?? "Morale had been sinking for months" });
        continue;
      }
      // Raise requests from the underpaid and unhappy.
      if (!warm && e.morale < 50 && e.pay < marketPay(me, e.role, e.skill) * 0.95 && rand(s) < 0.08 && !(s.decisions ?? []).some((d) => d.kind === "exec_raise" && d.data.exec === e.id)) {
        const ask = Math.round(Math.max(e.pay * 1.15, marketPay(me, e.role, e.skill)) / 1e4) * 1e4;
        (s.decisions ??= []).push({
          id: s.nextId++, kind: "exec_raise", companyId: me.id, deadlineDay: s.day + 30,
          headline: `Your ${ROLE_SHORT[e.role]} wants a raise`,
          deck: `${e.name} says rivals are calling and wants ${fmtMoney(ask)} a year, up from ${fmtMoney(e.pay)}.`,
          options: [{ id: "give", label: "Give the raise", detail: `${fmtMoney(ask)} a year; morale jumps` }, { id: "refuse", label: "Say no", detail: "Morale drops; they may walk" }],
          data: { exec: e.id, ask },
        });
        log(`${e.name}, your ${ROLE_SHORT[e.role]}, is asking for a raise to ${fmtMoney(ask)}.`, "info", { headline: `Your ${ROLE_SHORT[e.role]} wants a raise`, deck: `${e.name} says rivals are calling` });
      }
    }
  }

  // Hearings: a hostile member with a reason calls you to testify.
  if (!warm) maybeHearing(s, me, log);
  rec.stateEmp = emp;
}

export function marketPay(c: Company, role: ExecRole, skill: number): number {
  const base = { ceo: 3e6, cfo: 1.4e6, coo: 1.4e6, cto: 1.3e6, cmo: 1e6 }[role];
  const size = clamp(Math.sqrt(Math.max(c.marketCap, 1e8) / 10e9), 0.15, 8);
  return base * (0.4 + 0.3 * skill) * size;
}

export function moraleDrivers(s: GameState, c: Company, e: Exec, ret: number, mix = energyMix(c)): { v: number; text: string }[] {
  const out: { v: number; text: string }[] = [];
  const payRatio = e.pay / marketPay(c, e.role, e.skill);
  if (payRatio < 0.92) out.push({ v: clamp((payRatio - 1) * 70, -25, 0), text: "Underpaid, and they know what rivals pay." });
  else if (payRatio > 1.1) out.push({ v: clamp((payRatio - 1) * 30, 0, 10), text: "Well paid, and grateful for it." });
  if (ret > 0.15) out.push({ v: clamp(ret * 25, 0, 15), text: "Their stock grants are worth a lot more than a year ago." });
  else if (ret < -0.1) out.push({ v: clamp(ret * 40, -18, 0), text: "Their stock grants are underwater." });
  const conf = c.leadership?.board.confidence ?? 0.6;
  if (conf < 0.4) out.push({ v: (conf - 0.4) * 50, text: "The board is breathing down everyone's neck." });
  const b = e.beliefs;
  if (b) {
    if (b.climate > 0.4 && mix.fossil > 0.15) out.push({ v: -b.climate * 18 * Math.min(1, mix.fossil * 2), text: "Uneasy about how much coal, oil and gas the company runs on." });
    if (b.climate > 0.4 && mix.green > 0.15) out.push({ v: b.climate * 8, text: "Proud of the clean-energy business." });
    const rec = s.record;
    if (rec && b.labor > 0.3 && rec.unionStance < 0) out.push({ v: -b.labor * 15, text: "Didn't like how the company fought the union." });
    if (rec && b.labor < -0.3 && rec.unionStance > 0) out.push({ v: b.labor * 10, text: "Thinks recognizing the union was a mistake." });
    if (b.trade > 0.4 && foreignShare(s, c) > 0.2) out.push({ v: -b.trade * 12, text: "Thinks the company has moved too much work overseas." });
  }
  if (e.traits.includes("loyal")) out.push({ v: 10, text: "Loyal to the company, whatever happens." });
  const tenure = s.month - e.hiredMonth;
  if (tenure < 6) out.push({ v: 8, text: "Still in the honeymoon period." });
  return out;
}

function beliefDistance(a: Beliefs, b: Beliefs): number {
  let d = 0;
  for (const x of AXES) d += Math.abs(a[x.id] - b[x.id]);
  return d / AXES.length;
}

/** Largest combined share in markets both companies sell in. */
function overlapShare(s: GameState, a: Company, b: Company): number {
  let best = 0;
  for (const g of Object.keys(b.prices) as GoodId[]) {
    const snap = s.markets[g];
    if (!snap) continue;
    const x = snap.sales[a.id]?.share ?? 0, y = snap.sales[b.id]?.share ?? 0;
    if (x > 0.005 && y > 0.005) best = Math.max(best, Math.min(x, y) + 0.5 * Math.max(x, y));
  }
  return best;
}

export function relationWith(s: GameState, cid: number): Relation {
  const rels = (s.relations ??= {});
  return (rels[cid] ??= {});
}

export function activePartners(s: GameState): number[] {
  return Object.entries(s.relations ?? {}).filter(([, r]) => r.partnerUntil && r.partnerUntil > s.month).map(([k]) => Number(k));
}

/** Feuding rivals undercut you a little in markets you share. */
export function feudPriceMult(s: GameState, rival: Company, g: GoodId): number {
  const me = s.companies.find((c) => c.isPlayer);
  if (!me || !me.prices[g]) return 1;
  const ceo = rival.leadership?.execs.find((e) => e.role === "ceo");
  const rel = s.relations?.[rival.id];
  if (!ceo?.regard || ceo.regard.score > -40 || (rel?.truceUntil && rel.truceUntil > s.month)) return 1;
  return 0.96;
}

/** Friendly boards accept a lower premium. */
export function friendlyPremium(_s: GameState, buyer: Company, target: Company): number {
  if (!buyer.isPlayer) return 0;
  const score = target.leadership?.execs.find((e) => e.role === "ceo")?.regard?.score ?? 0;
  return clamp(-score / 400, -0.12, 0.08);
}

// ---------------------------------------------------------------- rival behavior and quotes

const JABS_TECH = ["They make a nice brochure. We make the product.", "Ask their customers how the last update went.", "Big company, small ideas.", "I'd worry about them if they ever shipped on time."];
const JABS_PRICE = ["They're buying market share with shareholders' money. That never ends well.", "Race to the bottom? We'll be waiting at the finish line.", "Cheap is a strategy until it isn't."];
const JABS_GENERAL = ["We don't think about them much.", "Their board must be very patient people.", "I wish them luck. They'll need it.", "Some companies build. Some companies acquire. Some do press releases."];

function rivalBehavior(s: GameState, me: Company, c: Company, ceo: Exec, r: Regard, rel: Relation, log: (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void) {
  const big = c.marketCap > me.marketCap * 0.05 || c.marketCap > 50e9;
  // Public jabs from rivals who can't stand you.
  if (r.score < -45 && big && rand(s) < 0.04 && (!rel.lastJab || s.month - rel.lastJab > 8)) {
    rel.lastJab = s.month;
    const pool = r.why.pricecut && r.why.pricecut < -6 ? JABS_PRICE : (ceo.beliefs?.tech ?? 0) > 0.3 ? JABS_TECH : JABS_GENERAL;
    const q = pool[Math.floor(rand(s) * pool.length)];
    log(`${c.name} CEO ${ceo.name} on ${me.name}: "${q}"`, "info", { headline: `${ceo.name} takes a swipe at ${me.name}`, deck: `"${q}" said the ${c.name} chief` });
  }
  // Friendly rivals propose a partnership.
  const partners = activePartners(s);
  if (r.score > 35 && big && partners.length < 3 && !partners.includes(c.id) && rand(s) < 0.03 && !(s.decisions ?? []).some((d) => d.kind === "partner_offer")) {
    (s.decisions ??= []).push({
      id: s.nextId++, kind: "partner_offer", companyId: me.id, deadlineDay: s.day + 30,
      headline: `${c.name} proposes an alliance`,
      deck: `${ceo.name} wants a two-year partnership: shared research and co-marketing.`,
      options: [{ id: "accept", label: "Shake on it", detail: "Two years of +5% research and +5% marketing reach for both" }, { id: "decline", label: "Politely decline", detail: `${ceo.name} will be a little hurt` }],
      data: { rival: c.id },
    });
    log(`${ceo.name} of ${c.name} proposes a partnership with ${me.name}.`, "deal", { headline: `${c.name} proposes an alliance`, deck: `${ceo.name} wants shared research and co-marketing` });
  }
}

/** What a person would say about you, if asked. Executives only: they're fictional. */
export function quoteOnYou(_s: GameState, me: Company, _c: Company, e: Exec): string {
  const r = e.regard?.score ?? 0;
  const top = Object.entries(e.regard?.why ?? {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]?.[0];
  if (r > 40) return top === "partner" ? `"Best partnership we've ever had. ${me.name} keeps its word."` : `"${me.name}? Smart people. I'd do business with them any day."`;
  if (r > 10) return `"Good competitors make you better. ${me.name} is a good competitor."`;
  if (r > -15) return `"${me.name} runs its business, we run ours."`;
  if (r > -45) return top === "pricecut" ? `"They're pricing like they don't need to make money. Their shareholders might disagree."` : top === "poach" ? `"They took one of our best people. We noticed."` : `"I respect them. I don't have to like them."`;
  return top === "poach" ? `"Stealing our people is the only innovation ${me.name} has managed this year."` : top === "pricecut" ? `"They want a price war? They'll get one."` : `"I'd rather sell the company for scrap than sell it to ${me.name}."`;
}

/** What your own executive is thinking (fictional people, so first person is fine). */
export function execThought(s: GameState, c: Company, e: Exec): string {
  const m = moraleDrivers(s, c, e, (() => { const h = c.history; return h.length >= 13 && h[h.length - 13].marketCap > 0 ? c.marketCap / h[h.length - 13].marketCap - 1 : 0; })());
  if (!m.length) return (e.morale ?? 65) > 60 ? "Happy where they are." : "Keeping their head down.";
  return m.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0].text;
}

// ---------------------------------------------------------------- reasons, in words

export function reasonText(_s: GameState, key: string, p?: Politician): string {
  if (key.startsWith("lobby:")) {
    const law = key.slice(6) as LawId;
    return `Your lobbying on ${LAW_BY_ID[law]?.name.toLowerCase() ?? law}`;
  }
  const st = p ? STATE_BY_CODE[p.state]?.name ?? p.state : "";
  const map: Record<string, string> = {
    jobs: p ? `Jobs you provide in ${st}` : "Jobs",
    layoffs: p ? `Layoffs in ${st}` : "Layoffs",
    pac: "Your PAC's money",
    offshore: "Work you've moved overseas",
    climate: "Your energy footprint",
    bigtech: "Big Tech's power",
    image: "Your public image",
    union: "How you handled the union",
    meeting: "Meeting with your CEO",
    opening: "The plant opening you invited them to",
    hearing: "Your testimony",
    rivalry: "You compete head to head",
    pricecut: "You undercut their prices",
    poach: "You hired away their people",
    outlook: "How much they agree with your CEO",
    respect: "Respect for your success",
    partner: "Your partnership",
    golf: "A round of golf with your CEO",
    truce: "The truce you offered",
    jab: "Your public jab",
    deal: "Past dealings",
  };
  return map[key] ?? key;
}

// ---------------------------------------------------------------- hearings

const TOPIC: Record<string, string> = {
  layoffs: "layoffs", offshore: "offshoring American jobs", climate: "its emissions", bigtech: "Big Tech's power", image: "its recent scandals", union: "its labor practices", pac: "its political spending",
};

function maybeHearing(s: GameState, me: Company, log: (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void) {
  if ((s.decisions ?? []).some((d) => d.kind === "hearing")) return;
  if (me.marketCap < 20e9) return;
  const hostile = s.politicians.filter((p) => (p.regard?.score ?? 0) < -40);
  if (!hostile.length || rand(s) > Math.min(0.06, 0.01 + hostile.length * 0.0015)) return;
  const p = hostile.sort((a, b) => (a.regard!.score - b.regard!.score))[0];
  const worst = Object.entries(p.regard!.why).filter(([k]) => k !== "jobs").sort((a, b) => a[1] - b[1])[0]?.[0] ?? "image";
  const topic = worst.startsWith("lobby:") ? `its lobbying on ${LAW_BY_ID[worst.slice(6) as LawId]?.name.toLowerCase() ?? "policy"}` : TOPIC[worst] ?? "its business practices";
  const title = `${p.chamber === "senate" ? "Sen." : "Rep."} ${p.name} (${p.label}-${p.state})`;
  const ceo = me.leadership?.execs.find((e) => e.role === "ceo");
  (s.decisions ??= []).push({
    id: s.nextId++, kind: "hearing", companyId: me.id, deadlineDay: s.day + 30,
    headline: `${title} calls ${me.name} to testify`,
    deck: `A ${p.chamber === "senate" ? "Senate" : "House"} committee hearing on ${topic}.`,
    options: [
      { id: "testify", label: ceo ? `Send ${ceo.name}` : "Send the CEO", detail: "A strong performance helps your image; a bad one hurts the stock" },
      { id: "deputy", label: "Send a deputy", detail: "Safe, but members read it as contempt" },
      { id: "concede", label: "Make concessions", detail: `Drop the lobbying and pay into a ${STATE_BY_CODE[p.state]?.name ?? p.state} jobs fund` },
    ],
    data: { pol: p.id, topic: worst },
  });
  log(`${title} has called ${me.name} to testify on ${topic}.`, "politics", { headline: `${title} calls ${me.name} to testify`, deck: `Hearing on ${topic}` });
}

// ---------------------------------------------------------------- player actions

export interface Result { ok: boolean; message: string }

export function meetPolitician(s: GameState, pid: string): Result {
  const me = s.companies.find((c) => c.isPlayer)!;
  const rec = playerRecord(s);
  const p = s.politicians.find((x) => x.id === pid);
  if (!p) return { ok: false, message: "They're no longer in office." };
  if (rec.meetingsMonth !== s.month) { rec.meetingsMonth = s.month; rec.meetingsUsed = 0; }
  if (rec.meetingsUsed >= 3) return { ok: false, message: "Your CEO has no more time for meetings this month." };
  if (rec.meetings[pid] && s.month - rec.meetings[pid] < 6) return { ok: false, message: `You met ${p.name} recently. Try again in ${6 - (s.month - rec.meetings[pid])} months.` };
  rec.meetings[pid] = s.month;
  rec.meetingsUsed++;
  const r = reg(p);
  const ceo = me.leadership?.execs.find((e) => e.role === "ceo");
  const skill = ceo ? (ceo.skill - 3) / 2 : -1;
  const gain = 5 + 3 * skill + (ceo?.traits.includes("connected") ? 4 : 0) + (r.score < -50 ? -3 : 0);
  bump(r, "meeting", gain, 20);
  settle(r);
  return { ok: true, message: gain > 4 ? `${p.name} took the meeting. It went well.` : `${p.name} took the meeting, but it was frosty.` };
}

export function inviteToOpening(s: GameState, pid: string): Result {
  const me = s.companies.find((c) => c.isPlayer)!;
  const rec = playerRecord(s);
  const p = s.politicians.find((x) => x.id === pid);
  if (!p) return { ok: false, message: "They're no longer in office." };
  const site = me.buildings.find((b) => b.type !== "hq" && b.level > 0 && s.cities[b.city]?.state === p.state);
  if (!site) return { ok: false, message: `You have nothing to open in ${STATE_BY_CODE[p.state]?.name ?? p.state}.` };
  if (rec.openings[pid] && s.month - rec.openings[pid] < 12) return { ok: false, message: `${p.name} came to an opening this year already.` };
  rec.openings[pid] = s.month;
  const r = reg(p);
  const b = politicianBeliefs(p);
  const fossil = FOSSIL.has(site.type) || (site.type === "power" && (site.method === "coal" || site.method === "gas"));
  const gain = 9 + (fossil ? -b.climate * 6 : 0) + (s.cities[site.city]?.foreign ? -10 : 0);
  bump(r, "opening", gain, 20);
  settle(r);
  const city = s.cities[site.city];
  if (city) city.opinion[me.id] = clamp((city.opinion[me.id] ?? 0.5) + 0.03, 0, 1);
  return { ok: true, message: `${p.name} cut the ribbon at your ${BUILDING_BY_ID[site.type].name.toLowerCase()} in ${city?.name ?? p.state}.` };
}

export function golfWith(s: GameState, cid: number): Result {
  const c = s.companies.find((x) => x.id === cid);
  const ceo = c?.leadership?.execs.find((e) => e.role === "ceo");
  if (!c || !ceo) return { ok: false, message: "No one to call." };
  const rel = relationWith(s, cid);
  if (rel.lastContact && s.month - rel.lastContact < 6) return { ok: false, message: `${ceo.name} isn't taking your calls again so soon.` };
  rel.lastContact = s.month;
  const r = reg(ceo);
  bump(r, "golf", r.score < -60 ? 3 : 8, 16);
  settle(r);
  return { ok: true, message: r.score < -60 ? `${ceo.name} showed up, but barely spoke.` : `A good round with ${ceo.name}. Relations are warmer.` };
}

export function proposeTruce(s: GameState, cid: number): Result {
  const c = s.companies.find((x) => x.id === cid);
  const ceo = c?.leadership?.execs.find((e) => e.role === "ceo");
  if (!c || !ceo) return { ok: false, message: "No one to call." };
  const rel = relationWith(s, cid);
  if (rel.truceUntil && rel.truceUntil > s.month) return { ok: false, message: "You already have a truce." };
  if (rel.lastContact && s.month - rel.lastContact < 3) return { ok: false, message: `${ceo.name} needs time before talking again.` };
  rel.lastContact = s.month;
  const r = reg(ceo);
  const p = clamp(0.65 + r.score / 150, 0.1, 0.95);
  if (rand(s) < p) {
    rel.truceUntil = s.month + 12;
    r.why.pricecut = (r.why.pricecut ?? 0) * 0.3;
    bump(r, "truce", 10, 15);
    settle(r);
    return { ok: true, message: `${ceo.name} agreed to a truce: no price war for a year.` };
  }
  bump(r, "truce", -4, 15);
  settle(r);
  return { ok: false, message: `${ceo.name} turned you down.` };
}

export function proposePartnership(s: GameState, cid: number): Result {
  const c = s.companies.find((x) => x.id === cid);
  const ceo = c?.leadership?.execs.find((e) => e.role === "ceo");
  if (!c || !ceo) return { ok: false, message: "No one to call." };
  const rel = relationWith(s, cid);
  if (rel.partnerUntil && rel.partnerUntil > s.month) return { ok: false, message: "You're already partners." };
  if (activePartners(s).length >= 3) return { ok: false, message: "You can run three partnerships at most." };
  const r = reg(ceo);
  if (r.score < 15) return { ok: false, message: `${ceo.name} doesn't trust you enough yet (needs a warmer relationship).` };
  if (rel.lastContact && s.month - rel.lastContact < 3) return { ok: false, message: `${ceo.name} needs time before talking again.` };
  rel.lastContact = s.month;
  rel.partnerUntil = s.month + 24;
  settle(r);
  return { ok: true, message: `${c.name} and your company are now partners for two years.` };
}

export function publicJab(s: GameState, cid: number): Result {
  const me = s.companies.find((x) => x.isPlayer)!;
  const c = s.companies.find((x) => x.id === cid);
  const ceo = c?.leadership?.execs.find((e) => e.role === "ceo");
  if (!c || !ceo) return { ok: false, message: "No one to insult." };
  const myCeo = me.leadership?.execs.find((e) => e.role === "ceo");
  const rel = relationWith(s, cid);
  if (rel.partnerUntil && rel.partnerUntil > s.month) rel.partnerUntil = s.month;
  rel.truceUntil = undefined;
  const r = reg(ceo);
  bump(r, "jab", -25, 50);
  settle(r);
  const showman = !!myCeo && (myCeo.traits.includes("celebrity") || myCeo.traits.includes("visionary") || myCeo.skill >= 4);
  if (showman) { me.hype *= 1.015; return { ok: true, message: `${myCeo!.name}'s jab at ${c.name} went viral. Investors loved it; ${ceo.name} did not.` }; }
  me.image = clamp(me.image - 0.01, 0, 1);
  return { ok: true, message: `The jab at ${c.name} landed flat. ${ceo.name} won't forget it.` };
}

// ---------------------------------------------------------------- decisions

export function applyPeopleDecision(s: GameState, me: Company, kind: string, opt: string, data: Record<string, string | number>, log: (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void): string {
  if (kind === "exec_raise") {
    const e = me.leadership?.execs.find((x) => x.id === Number(data.exec));
    if (!e) return "They've already gone.";
    if (opt === "give") { e.pay = Number(data.ask); e.morale = clamp((e.morale ?? 50) + 25, 0, 100); return `${e.name} got the raise and is back on board.`; }
    e.morale = clamp((e.morale ?? 50) - 15, 0, 100);
    return `${e.name} took the news badly.`;
  }
  if (kind === "partner_offer") {
    const c = s.companies.find((x) => x.id === Number(data.rival));
    const ceo = c?.leadership?.execs.find((x) => x.role === "ceo");
    if (!c || !ceo) return "The offer lapsed.";
    if (opt === "accept") {
      if (activePartners(s).length >= 3) return "You already run three partnerships.";
      relationWith(s, c.id).partnerUntil = s.month + 24;
      log(`${me.name} and ${c.name} announced a two-year alliance.`, "deal", { headline: `${me.name} and ${c.name} join forces`, deck: "Shared research and co-marketing for two years" });
      return `You're partners with ${c.name} for two years.`;
    }
    bump(reg(ceo), "deal", -6, 20);
    return `You turned down ${ceo.name}.`;
  }
  if (kind === "hearing") {
    const p = s.politicians.find((x) => x.id === String(data.pol));
    const ceo = me.leadership?.execs.find((x) => x.role === "ceo");
    const board = me.leadership?.board;
    if (!p) return "The hearing was cancelled.";
    const r = reg(p);
    if (opt === "testify") {
      const pGood = clamp(0.35 + 0.12 * ((ceo?.skill ?? 2) - 3) + (ceo?.traits.includes("celebrity") ? 0.1 : 0) + (ceo?.traits.includes("steady") ? 0.1 : 0) + (ceo?.traits.includes("scandal_prone") ? -0.15 : 0), 0.1, 0.85);
      if (rand(s) < pGood) {
        me.image = clamp(me.image + 0.04, 0, 1);
        me.hype *= 1.02;
        bump(r, "hearing", 6, 20);
        for (const q of s.politicians) if (q !== p && q.party !== p.party) bump(reg(q), "hearing", 2, 20);
        log(`${ceo?.name ?? "The CEO"} held firm at the hearing, and the clips played well.`, "good", { headline: `${ceo?.name ?? me.name} parries hostile questions`, deck: "Markets shrug off the hearing" });
        return "The testimony went well.";
      }
      me.image = clamp(me.image - 0.06, 0, 1);
      me.hype *= 0.97;
      if (board) board.confidence = clamp(board.confidence - 0.08, 0, 1);
      bump(r, "hearing", -6, 20);
      log(`${ceo?.name ?? "The CEO"} stumbled through the hearing. The clips are everywhere.`, "bad", { headline: `${ceo?.name ?? me.name} stumbles under questioning`, deck: "Shares slip; the board is not amused" });
      return "The testimony went badly.";
    }
    if (opt === "deputy") {
      me.image = clamp(me.image - 0.02, 0, 1);
      bump(r, "hearing", -10, 20);
      for (const q of s.politicians) if (q.faction === p.faction && q !== p) bump(reg(q), "hearing", -3, 20);
      return "Your deputy got through it. Members noticed who didn't come.";
    }
    const topic = String(data.topic);
    if (topic.startsWith("lobby:")) me.lobbying = me.lobbying.filter((l) => l.law !== topic.slice(6));
    const fund = Math.max(5e6, me.history.slice(-12).reduce((a, h) => a + h.revenue, 0) * 0.001);
    me.cash -= fund;
    bump(r, "hearing", 15, 20);
    return `You made concessions and put ${fmtMoney(fund)} into a jobs fund.`;
  }
  return "";
}

/** Called when the player hires a rival's executive. */
export function notePoach(s: GameState, rivalName: string) {
  const c = s.companies.find((x) => x.name === rivalName);
  if (c) { const rec = playerRecord(s); rec.poached[c.id] = (rec.poached[c.id] ?? 0) + 30; }
}

export function noteUnion(s: GameState, recognized: boolean) {
  const rec = playerRecord(s);
  rec.unionStance = clamp(rec.unionStance * 0.7 + (recognized ? 1 : -1), -2, 2);
}

/** The people worth listing for the player, most relevant first. */
export function relevantPoliticians(s: GameState, me: Company): Politician[] {
  const rec = playerRecord(s);
  const states = new Set(Object.keys(rec.stateEmp).filter((st) => rec.stateEmp[st] > 50));
  return s.politicians
    .filter((p) => states.has(p.state) || Math.abs(p.regard?.score ?? 0) > 12 || (p.friends[me.id] ?? 0) !== 0)
    .sort((a, b) => Math.abs(b.regard?.score ?? 0) - Math.abs(a.regard?.score ?? 0) || (a.chamber === "senate" ? -1 : 1));
}

export function factionBlurb(p: Politician): string {
  return factionDef(p.faction, p.party).blurb;
}

export { FACTIONS };

export function giveRaise(s: GameState, execId: number): Result {
  const me = s.companies.find((c) => c.isPlayer)!;
  const e = me.leadership?.execs.find((x) => x.id === execId);
  if (!e) return { ok: false, message: "No such executive." };
  e.pay = Math.round(e.pay * 1.1 / 1e4) * 1e4;
  e.morale = clamp((e.morale ?? 60) + 12, 0, 100);
  void s;
  return { ok: true, message: `${e.name} now earns ${fmtMoney(e.pay)} a year, and is noticeably happier.` };
}
