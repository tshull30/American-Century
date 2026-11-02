// Local politics: mayors, city councils and county commissions, governors and statehouses.
//
// Every city and region has a mayor (or commission chair) and a council of five to nine members,
// each with a party, beliefs, a temperament and an opinion of the player. Councils propose and
// vote on ordinances, and ordinances are what change local policy. States have a governor and
// pass bills through their legislatures. All local officials are fictional.
import { STATES, STATE_BY_CODE } from "./data/states";
import { cultureFor, personName } from "./names";
import { AXES, type Beliefs, type Regard } from "./people";
import type { CityState, Company, GameEvent, GameState } from "./types";
import { clamp, fmtMoney, rand } from "./util";

export type Temperament = "dealmaker" | "ideologue" | "populist" | "technocrat" | "booster";
export const TEMPERAMENT: Record<Temperament, string> = {
  dealmaker: "Dealmaker: open to a good offer from either side",
  ideologue: "Ideologue: votes their beliefs, ignores lobbyists",
  populist: "Populist: suspicious of big companies, loves a fight with one",
  technocrat: "Technocrat: wants the numbers, moved by evidence and jobs",
  booster: "Booster: wants growth and ribbon-cuttings above all",
};

export interface LocalOfficial {
  id: number;
  name: string;
  role: "mayor" | "council" | "governor";
  party: "D" | "R" | "I";
  /** 0 = right, 1 = left. */
  lean: number;
  beliefs: Beliefs;
  temperament: Temperament;
  regard: Regard;
  since: number;
  seat?: number;
  /** Player campaign money this cycle (+ for them, − for their opponent). */
  backing?: number;
}

export type OrdinanceKind = "min_wage" | "abatement_up" | "abatement_down" | "permit_reform" | "dc_moratorium" | "dc_lift" | "dc_incentives"
  | "water_rules" | "fossil_ban" | "fossil_repeal" | "labor_peace" | "head_tax" | "head_tax_repeal" | "company_deal";

export interface Ordinance {
  id: number;
  kind: OrdinanceKind;
  title: string;
  detail: string;
  proposedBy: number;
  proposedMonth: number;
  voteMonth: number;
  /** Signed player lobbying spend: + for, − against. */
  lobby: number;
  companyId?: number;
}

export interface VoteRecord { month: number; title: string; passed: boolean; yes: number; no: number; mine?: boolean }

export interface CityGov {
  mayor: LocalOfficial;
  council: LocalOfficial[];
  nextElection: number;
  pending?: Ordinance;
  history: VoteRecord[];
  /** Extra tax abatement the council granted specific companies. */
  deals?: Record<number, number>;
  /** Monthly tax per employee on big employers. */
  headTax?: number;
}

export type StateBillKind = "right_to_work" | "rtw_repeal" | "state_min_wage" | "corp_tax_cut" | "corp_tax_hike" | "dc_exemption" | "mega_fund";
export interface StatePolicy { rightToWork: boolean; minWage: number; corpTaxAdj: number; dcExempt: boolean; megaFund: boolean }
export interface StateBill { id: number; kind: StateBillKind; title: string; detail: string; voteMonth: number; lobby: number }
export interface StateGov { governor: LocalOfficial; policy: StatePolicy; pending?: StateBill; history: VoteRecord[]; nextElection: number }

type Log = (text: string, kind: GameEvent["kind"], mine: boolean, extra?: Pick<GameEvent, "headline" | "deck">) => void;

const pick = <T,>(s: GameState, xs: T[]) => xs[Math.floor(rand(s) * xs.length)];
const hourly = (monthly: number) => `$${(monthly / 173).toFixed(2)}`;

// ---------------------------------------------------------------- people

function makeOfficial(s: GameState, state: string, role: LocalOfficial["role"], lean: number, lib: number, seat?: number): LocalOfficial {
  const l = clamp(lean + (rand(s) - 0.5) * 0.35, 0.03, 0.97);
  const party: LocalOfficial["party"] = rand(s) < 0.07 ? "I" : l > 0.5 ? "D" : "R";
  const left = (l - 0.5) * 2;
  const b = {} as Beliefs;
  b.econ = clamp(-left * 0.8 + (lib - 0.45) * 0.8 + (rand(s) - 0.5) * 0.4, -1, 1);
  b.labor = clamp(left * 0.8 + (rand(s) - 0.5) * 0.4, -1, 1);
  b.climate = clamp(left * 0.9 + (rand(s) - 0.5) * 0.4, -1, 1);
  b.trade = clamp((rand(s) - 0.5) * 0.8 - left * 0.1 + (party === "R" ? 0.2 : 0), -1, 1);
  b.tech = clamp((rand(s) - 0.5) * 0.9 + (lib - 0.45), -1, 1);
  const temps: Temperament[] = ["dealmaker", "ideologue", "populist", "technocrat", "booster"];
  const female = rand(s) < 0.42;
  return {
    id: s.nextId++, name: personName(s, cultureFor(s, state, 1.4), state, female), role, party, lean: l, beliefs: b,
    temperament: pick(s, temps), regard: { score: 0, why: {} }, since: -Math.floor(rand(s) * 96), seat,
  };
}

export function initLocal(s: GameState) {
  s.cityGov = {};
  for (const city of Object.values(s.cities)) {
    if (city.foreign) continue;
    const n = city.rest ? 5 : (city.share > 0.25 ? 9 : 7);
    s.cityGov[city.id] = {
      mayor: makeOfficial(s, city.state, "mayor", city.council, city.lib),
      council: Array.from({ length: n }, (_, i) => makeOfficial(s, city.state, "council", city.council, city.lib, i + 1)),
      nextElection: nextNovember(s.month, (city.id.length % 2) === 0 ? 1 : 0),
      history: [],
    };
    syncCouncil(city, s.cityGov[city.id]);
  }
  s.stateGov = {};
  for (const st of STATES) {
    const leg = s.stateLegs[st.code];
    const lean = leg ? (leg.senateD + leg.houseD) / Math.max(1, leg.senateD + leg.senateR + leg.houseD + leg.houseR) : 0.5;
    const rtw = RTW_STATES.includes(st.code);
    s.stateGov[st.code] = {
      governor: makeOfficial(s, st.code, "governor", lean, 0.45),
      policy: { rightToWork: rtw, minWage: STATE_MIN_WAGE[st.code] ?? 0, corpTaxAdj: 0, dcExempt: DC_EXEMPT.includes(st.code), megaFund: false },
      history: [], nextElection: nextNovember(s.month, ["VA", "NJ"].includes(st.code) ? 1 : 0, 4),
    };
  }
}

function nextNovember(from: number, parity: number, every = 2): number {
  let m = Math.max(0, from + 1);
  while (!((((m % 12) + 12) % 12) === 10 && Math.floor(m / 12) % every === parity % every)) m++;
  return m;
}

// Right-to-work states as of 2026, rough state minimum wages (monthly, full time) and data-center sales-tax exemptions.
const RTW_STATES = ["AL", "AZ", "AR", "FL", "GA", "ID", "IN", "IA", "KS", "KY", "LA", "MS", "NE", "NV", "NC", "ND", "OK", "SC", "SD", "TN", "TX", "UT", "VA", "WV", "WI", "WY"];
const STATE_MIN_WAGE: Record<string, number> = { CA: 2860, WA: 2860, NY: 2700, NJ: 2650, CT: 2850, MA: 2600, IL: 2600, MD: 2600, CO: 2550, AZ: 2550, OR: 2550, DE: 2600, RI: 2600, ME: 2550, VT: 2400, MO: 2350, FL: 2400, VA: 2100, NM: 2100, NE: 2600, MI: 2200, OH: 1900, MN: 1900, HI: 2800, AK: 2100, MT: 1800, NV: 2100, SD: 1950, DC: 3100 };
const DC_EXEMPT = ["VA", "TX", "GA", "OH", "IA", "NV", "AZ", "NC", "OR", "UT", "IL", "IN", "MS", "AL", "SC", "TN", "WA"];

/** The council's average lean feeds the city's politics. */
function syncCouncil(city: CityState, g: CityGov) {
  const all = [...g.council, g.mayor, g.mayor];
  city.council = all.reduce((a, o) => a + o.lean, 0) / all.length;
}

export const officials = (g: CityGov) => [g.mayor, ...g.council];

// ---------------------------------------------------------------- ordinances

interface OrdDef { title: (city: CityState) => string; detail: (city: CityState) => string; side: number; axis: keyof Beliefs; valid: (s: GameState, city: CityState, g: CityGov) => boolean; apply: (s: GameState, city: CityState, g: CityGov, o: Ordinance) => void }

export const ORD: Record<OrdinanceKind, OrdDef> = {
  min_wage: { side: 1, axis: "labor", title: (c) => `Raise ${c.name}'s minimum wage to ${hourly(Math.max(c.minWage, 2400) + 260)}`, detail: () => "Low-wage workers get a raise; restaurants, stores and warehouses pay more.",
    valid: (_s, c) => c.minWage < 3800, apply: (_s, c) => { c.minWage = Math.max(c.minWage, 2400) + 260; } },
  abatement_up: { side: -1, axis: "econ", title: () => "Expand tax abatements for new investment", detail: () => "Bigger property-tax breaks for companies that build here.",
    valid: (_s, c) => c.taxBreak < 0.32, apply: (_s, c) => { c.taxBreak = clamp(c.taxBreak + 0.06, 0, 0.35); } },
  abatement_down: { side: 1, axis: "econ", title: () => "Claw back corporate tax abatements", detail: () => "No more giveaways: smaller tax breaks for new projects.",
    valid: (_s, c) => c.taxBreak > 0.04, apply: (_s, c) => { c.taxBreak = clamp(c.taxBreak - 0.06, 0, 0.35); } },
  permit_reform: { side: -1, axis: "econ", title: () => "Fast-track permitting reform", detail: () => "Shot clocks on permit reviews: everything gets built faster.",
    valid: (_s, c) => c.permitSpeed > 0.72, apply: (_s, c) => { c.permitSpeed = clamp(c.permitSpeed - 0.12, 0.6, 1.5); } },
  dc_moratorium: { side: 1, axis: "climate", title: () => "Moratorium on new data centers", detail: (c) => `The grid is at ${Math.round((c.dcLoadMW / c.gridMW) * 100)}% of capacity. No new data centers until it isn't.`,
    valid: (_s, c) => c.dcStance !== "moratorium" && c.dcLoadMW / c.gridMW > 0.6, apply: (_s, c) => { c.dcStance = "moratorium"; } },
  dc_lift: { side: -1, axis: "tech", title: () => "Lift the data-center moratorium", detail: () => "Reopen the city to data centers.",
    valid: (_s, c) => c.dcStance === "moratorium", apply: (_s, c) => { c.dcStance = "neutral"; } },
  dc_incentives: { side: -1, axis: "tech", title: () => "Power-bill incentives for data centers", detail: () => "Abate data centers' electricity taxes to lure them here.",
    valid: (_s, c) => c.dcStance !== "moratorium" && c.dcTaxBreak < 0.25 && c.dcLoadMW / c.gridMW < 0.8, apply: (_s, c) => { c.dcTaxBreak = clamp(c.dcTaxBreak + 0.1, -0.15, 0.3); c.dcStance = "welcome"; } },
  water_rules: { side: 1, axis: "climate", title: () => "Water-use rules for data centers", detail: () => "Data centers must recycle cooling water. Cooling costs more.",
    valid: (_s, c) => !c.dcWaterRules && c.dcLoadMW > 0, apply: (_s, c) => { c.dcWaterRules = true; } },
  fossil_ban: { side: 1, axis: "climate", title: () => "Ban new oil and gas projects", detail: () => "No new wells, refineries or gas plants inside city limits.",
    valid: (_s, c) => !c.fossilBan, apply: (_s, c) => { c.fossilBan = true; } },
  fossil_repeal: { side: -1, axis: "climate", title: () => "Repeal the oil and gas ban", detail: () => "Reopen the city to energy projects.",
    valid: (_s, c) => !!c.fossilBan, apply: (_s, c) => { c.fossilBan = false; } },
  labor_peace: { side: 1, axis: "labor", title: () => "Labor-peace ordinance", detail: () => "Companies with city contracts or abatements must stay neutral in union drives. Unions get stronger.",
    valid: (_s, c) => c.union < 0.9, apply: (_s, c) => { c.union = clamp(c.union + 0.15, 0, 1); } },
  head_tax: { side: 1, axis: "econ", title: (c) => `A head tax on ${c.name}'s biggest employers`, detail: () => "$150 a month for each worker at companies with over 2,000 local employees, to fund housing.",
    valid: (_s, _c, g) => !g.headTax, apply: (_s, _c, g) => { g.headTax = 150; } },
  head_tax_repeal: { side: -1, axis: "econ", title: () => "Repeal the employer head tax", detail: () => "Big employers stop paying the per-worker tax.",
    valid: (_s, _c, g) => !!g.headTax, apply: (_s, _c, g) => { g.headTax = 0; } },
  company_deal: { side: -1, axis: "econ", title: () => "An incentive package", detail: () => "Extra tax abatements for one company's projects here, for as long as it stays.",
    valid: () => false, apply: (_s, _c, g, o) => { if (o.companyId !== undefined) (g.deals ??= {})[o.companyId] = 0.12; } },
};

/** Will this official vote yes? Returns a probability. */
export function voteOdds(s: GameState, city: CityState, o: LocalOfficial, ord: Ordinance): number {
  const d = ORD[ord.kind];
  const belief = o.beliefs[d.axis] * (d.axis === "econ" ? -1 : 1) * d.side; // econ axis: + = markets; side +1 = left-leaning measure
  let x = 0.5 + belief * 0.45;
  if (ord.kind === "company_deal") {
    const co = s.companies.find((c) => c.id === ord.companyId);
    x = 0.45 + (o.regard.score / 120) + (o.temperament === "booster" ? 0.2 : o.temperament === "populist" ? -0.2 : 0) + ((city.opinion[co?.id ?? -1] ?? 0.5) - 0.5) * 0.6 - (o.lean - 0.5) * 0.3;
  }
  if (ord.kind === "dc_moratorium") x += clamp((city.dcLoadMW / city.gridMW - 1) * 0.5, -0.2, 0.3);
  // Lobbying: dealmakers listen, ideologues don't, populists punish it.
  const weight = { dealmaker: 1.3, technocrat: 0.8, booster: 1, populist: -0.4, ideologue: 0.15 }[o.temperament];
  const size = Math.max(0.3, Math.sqrt((STATE_BY_CODE[city.state]?.population ?? 2e6) * city.share / 1e6));
  x += clamp(ord.lobby / (2e6 * size), -1, 1) * 0.3 * weight;
  x += (o.regard.score / 400) * Math.sign(ord.lobby);
  return clamp(x, 0.03, 0.97);
}

function propose(s: GameState, city: CityState, g: CityGov): Ordinance | undefined {
  const who = pick(s, officials(g));
  const left = who.lean > 0.5;
  const strain = city.dcLoadMW / Math.max(1, city.gridMW);
  const pool: OrdinanceKind[] = left
    ? ["min_wage", "abatement_down", "labor_peace", "head_tax", "fossil_ban", "water_rules", ...(strain > 0.9 ? ["dc_moratorium", "dc_moratorium"] as OrdinanceKind[] : [])]
    : ["abatement_up", "permit_reform", "dc_incentives", "dc_lift", "fossil_repeal", "head_tax_repeal", "permit_reform"];
  const options = pool.filter((k) => ORD[k].valid(s, city, g) && !(k === "fossil_ban" && city.lean < 0.62) && !(k === "head_tax" && (city.rest || city.lean < 0.6)));
  if (!options.length) return undefined;
  const kind = pick(s, options);
  return { id: s.nextId++, kind, title: ORD[kind].title(city), detail: ORD[kind].detail(city), proposedBy: who.id, proposedMonth: s.month, voteMonth: s.month + 2, lobby: 0 };
}

/** Does this ordinance touch the player's business here? */
export function affectsPlayer(_s: GameState, city: CityState, me: Company | undefined, kind: OrdinanceKind): boolean {
  if (!me) return false;
  let emp = 0;
  for (const k in me.employees) if (k.startsWith(city.id + ":")) emp += me.employees[k];
  const has = (pred: (t: string, m: string) => boolean) => me.buildings.some((b) => b.city === city.id && b.level > 0 && pred(b.type, b.method));
  switch (kind) {
    case "head_tax": case "head_tax_repeal": return emp > 2000;
    case "dc_moratorium": case "dc_lift": case "dc_incentives": case "water_rules": return has((t) => t === "datacenter");
    case "fossil_ban": case "fossil_repeal": return has((t, m) => ["oilfield", "gasfield", "refinery", "coalmine"].includes(t) || (t === "power" && (m === "gas" || m === "coal")));
    case "min_wage": case "labor_peace": return emp > 1500;
    case "company_deal": return true;
    default: return me.hqSite.city === city.id;
  }
}

function holdVote(s: GameState, city: CityState, g: CityGov, me: Company | undefined, log: Log) {
  const o = g.pending!;
  let yes = 0, no = 0;
  for (const m of g.council) if (rand(s) < voteOdds(s, city, m, o)) yes++; else no++;
  let passed = yes > no;
  // The mayor can veto; a two-thirds council overrides.
  const veto = passed && rand(s) > voteOdds(s, city, g.mayor, o) + 0.25 && yes < Math.ceil(g.council.length * 2 / 3);
  if (veto) passed = false;
  const mine = !!me && (o.companyId === me.id || o.lobby !== 0 || affectsPlayer(s, city, me, o.kind));
  if (passed) ORD[o.kind].apply(s, city, g, o);
  g.history.unshift({ month: s.month, title: o.title, passed, yes, no, mine: o.companyId === me?.id || o.lobby !== 0 });
  g.history = g.history.slice(0, 12);
  // Officials remember who lobbied them, and which way.
  if (me && o.lobby !== 0) for (const m of officials(g)) {
    const agrees = (voteOdds(s, city, m, { ...o, lobby: 0 }) > 0.5) === o.lobby > 0;
    bumpWhy(m, `ord`, agrees ? 3 : m.temperament === "populist" ? -6 : -3);
  }
  const verdict = veto ? `passed ${yes}–${no} but the mayor vetoed it` : passed ? `passed ${yes}–${no}` : `failed ${yes}–${no}`;
  if (mine) {
    log(`${city.name} council: "${o.title}" ${verdict}.`, passed ? (o.companyId === me?.id ? "good" : "info") : "info", true,
      o.companyId === me?.id ? { headline: passed ? `${city.name} approves incentives for ${me?.name}` : `${city.name} council rejects ${me?.name} incentive deal`, deck: `The vote was ${yes}–${no}${veto ? ", then a mayoral veto" : ""}` } : undefined);
  }
  g.pending = undefined;
}

const bumpWhy = (o: LocalOfficial, k: string, d: number, cap = 30) => { o.regard.why[k] = clamp((o.regard.why[k] ?? 0) + d, -cap, cap); };
function settle(o: LocalOfficial) {
  let sum = 0;
  for (const k in o.regard.why) { if (Math.abs(o.regard.why[k]) < 0.3) delete o.regard.why[k]; else sum += o.regard.why[k]; }
  o.regard.score = clamp(sum, -100, 100);
}

// ---------------------------------------------------------------- elections

function cityElection(s: GameState, city: CityState, g: CityGov, me: Company | undefined, log: Log) {
  const mood = ((s.politics?.poll ?? 0.5) - 0.5) * 0.5;
  const before = g.council.filter((m) => m.lean > 0.5).length;
  let flips = 0;
  // Half the council (and the mayor every other cycle) stands for election.
  const up = g.council.filter((m) => (m.seat ?? 0) % 2 === Math.floor(s.month / 24) % 2);
  if (Math.floor(s.month / 24) % 2 === 0) up.push(g.mayor);
  for (const m of up) {
    const backing = m.backing ?? 0;
    const incumbent = 0.08 + m.regard.score * 0.0005;
    const keep = rand(s) < clamp(0.62 + incumbent + clamp(backing / 2e6, -0.25, 0.25) - Math.abs(m.lean - (city.lean + mood)) * 0.8, 0.1, 0.95);
    if (!keep) {
      const fresh = makeOfficial(s, city.state, m.role, clamp(city.lean + mood + (rand(s) - 0.5) * 0.2, 0.05, 0.95), city.lib, m.seat);
      fresh.since = s.month;
      if (backing < 0) bumpWhy(fresh, "campaign", 12);
      if ((fresh.lean > 0.5) !== (m.lean > 0.5)) flips++;
      if (m.role === "mayor") g.mayor = fresh; else g.council[g.council.indexOf(m)] = fresh;
    } else if (backing > 0) bumpWhy(m, "campaign", 10);
    m.backing = 0;
  }
  for (const m of officials(g)) m.backing = 0;
  syncCouncil(city, g);
  const after = g.council.filter((m) => m.lean > 0.5).length;
  const majority = (n: number) => (n > g.council.length / 2 ? "progressive" : "business-friendly");
  if (me && (me.buildings.some((b) => b.city === city.id) || me.hqSite.city === city.id) && (flips || majority(before) !== majority(after))) {
    log(`${city.name} local elections: ${flips} seat${flips === 1 ? "" : "s"} changed hands; the council now has a ${majority(after)} majority (${after}–${g.council.length - after}).`, "politics", true);
  }
  g.nextElection = s.month + 24;
}

// ---------------------------------------------------------------- states

const STATE_BILLS: Record<StateBillKind, { title: (st: string) => string; detail: string; party: "D" | "R" | "both"; valid: (p: StatePolicy) => boolean; apply: (p: StatePolicy) => void }> = {
  right_to_work: { title: (st) => `${st} right-to-work law`, detail: "Workers can't be required to pay union dues. Unions weaken statewide.", party: "R", valid: (p) => !p.rightToWork, apply: (p) => { p.rightToWork = true; } },
  rtw_repeal: { title: (st) => `Repeal ${st}'s right-to-work law`, detail: "Unions can negotiate dues from everyone they represent.", party: "D", valid: (p) => p.rightToWork, apply: (p) => { p.rightToWork = false; } },
  state_min_wage: { title: (st) => `Raise ${st}'s minimum wage`, detail: "A statewide wage floor $1.50 an hour higher.", party: "D", valid: (p) => p.minWage < 3300, apply: (p) => { p.minWage = Math.max(p.minWage, 1255) + 260; } },
  corp_tax_cut: { title: (st) => `Cut ${st}'s corporate income tax`, detail: "One point off the state corporate tax rate.", party: "R", valid: (p) => p.corpTaxAdj > -3, apply: (p) => { p.corpTaxAdj -= 1; } },
  corp_tax_hike: { title: (st) => `Raise ${st}'s corporate income tax`, detail: "One point onto the state corporate tax rate, for schools and roads.", party: "D", valid: (p) => p.corpTaxAdj < 3, apply: (p) => { p.corpTaxAdj += 1; } },
  dc_exemption: { title: (st) => `${st} data-center sales-tax exemption`, detail: "No sales tax on servers and equipment: data centers get cheaper to run statewide.", party: "both", valid: (p) => !p.dcExempt, apply: (p) => { p.dcExempt = true; } },
  mega_fund: { title: (st) => `${st} megaproject incentive fund`, detail: "Cash grants for big plants and offices: bigger tax breaks in every city.", party: "both", valid: (p) => !p.megaFund, apply: (p) => { p.megaFund = true; } },
};
export { STATE_BILLS };

export function stateCorpTax(s: GameState, st: string): number {
  return Math.max(0, (STATE_BY_CODE[st]?.corpTax ?? 6) + (s.stateGov?.[st]?.policy.corpTaxAdj ?? 0));
}

export function stateBillOdds(s: GameState, st: string, b: StateBill): { leg: number; governor: number } {
  const leg = s.stateLegs[st];
  const def = STATE_BILLS[b.kind];
  const dShare = leg ? (leg.senateD + leg.houseD) / Math.max(1, leg.senateD + leg.senateR + leg.houseD + leg.houseR) : 0.5;
  const lobby = clamp(b.lobby / 20e6, -1, 1) * 0.2;
  const legOdds = clamp((def.party === "D" ? (dShare - 0.5) * 6 + 0.5 : def.party === "R" ? (0.5 - dShare) * 6 + 0.5 : 0.65) + lobby, 0.03, 0.97);
  const g = s.stateGov![st].governor;
  const govOdds = clamp((def.party === "both" ? 0.8 : (def.party === "D") === (g.lean > 0.5) ? 0.95 : 0.15) + lobby * 0.5 + g.regard.score / 400 * Math.sign(b.lobby), 0.03, 0.98);
  return { leg: legOdds, governor: govOdds };
}

function stateMonth(s: GameState, st: string, sg: StateGov, me: Company | undefined, log: Log) {
  const name = STATE_BY_CODE[st]?.name ?? st;
  let emp = 0;
  if (me) for (const k in me.employees) if (s.cities[k.slice(0, k.lastIndexOf(":"))]?.state === st) emp += me.employees[k];
  const present = !!me && (me.hq === st || emp > 5000);
  if (sg.pending && s.month >= sg.pending.voteMonth) {
    const b = sg.pending;
    const odds = stateBillOdds(s, st, b);
    const passedLeg = rand(s) < odds.leg;
    const signed = passedLeg && rand(s) < odds.governor;
    if (signed) STATE_BILLS[b.kind].apply(sg.policy);
    sg.history.unshift({ month: s.month, title: b.title, passed: signed, yes: passedLeg ? 1 : 0, no: 0, mine: b.lobby !== 0 });
    sg.history = sg.history.slice(0, 10);
    if (present || b.lobby !== 0) log(`${name}: ${b.title} ${signed ? "is now law" : passedLeg ? `was vetoed by Governor ${sg.governor.name}` : "died in the legislature"}.`, "politics", true,
      signed ? { headline: `${b.title} becomes law`, deck: b.detail } : undefined);
    sg.pending = undefined;
  } else if (!sg.pending && rand(s) < 1 / 20) {
    const leg = s.stateLegs[st];
    const dCtrl = leg ? leg.senateD > leg.senateR && leg.houseD > leg.houseR : false;
    const rCtrl = leg ? leg.senateR > leg.senateD && leg.houseR > leg.houseD : false;
    const opts = (Object.keys(STATE_BILLS) as StateBillKind[]).filter((k) => STATE_BILLS[k].valid(sg.policy) && (STATE_BILLS[k].party === "both" || (STATE_BILLS[k].party === "D" ? dCtrl : rCtrl)));
    if (opts.length) {
      const kind = pick(s, opts);
      sg.pending = { id: s.nextId++, kind, title: STATE_BILLS[kind].title(name), detail: STATE_BILLS[kind].detail, voteMonth: s.month + 3, lobby: 0 };
      if (present) log(`${name} legislature takes up: ${sg.pending.title}.`, "politics", true);
    }
  }
  if (s.month >= sg.nextElection) {
    const mood = ((s.politics?.poll ?? 0.5) - 0.5) * 0.6;
    const leg = s.stateLegs[st];
    const lean = leg ? (leg.senateD + leg.houseD) / Math.max(1, leg.senateD + leg.senateR + leg.houseD + leg.houseR) : 0.5;
    const old = sg.governor;
    if (rand(s) > 0.55 + old.regard.score * 0.0003 - Math.abs(old.lean - (lean + mood)) * 0.6) {
      sg.governor = makeOfficial(s, st, "governor", clamp(lean + mood, 0.05, 0.95), 0.45);
      sg.governor.since = s.month;
      if (present) log(`${name} elected a new governor: ${sg.governor.name} (${sg.governor.party}).`, "politics", true);
    }
    sg.nextElection = s.month + 48;
  }
}

/** State policy flows down into its cities. */
function applyStatePolicy(s: GameState, st: string, sg: StateGov) {
  for (const city of Object.values(s.cities)) {
    if (city.state !== st || city.foreign) continue;
    if (sg.policy.minWage > city.minWage) city.minWage = sg.policy.minWage;
    if (sg.policy.rightToWork && city.union > 0.45) city.union = clamp(city.union - 0.02, 0.05, 1);
  }
}

// ---------------------------------------------------------------- monthly

export function updateLocal(s: GameState, log: Log, warm: boolean) {
  if (!s.cityGov || !s.stateGov) initLocal(s);
  const me = s.companies.find((c) => c.isPlayer && c.alive);
  const empHere = new Map<string, number>();
  if (me) for (const k in me.employees) { const cid = k.slice(0, k.lastIndexOf(":")); empHere.set(cid, (empHere.get(cid) ?? 0) + me.employees[k]); }
  for (const city of Object.values(s.cities)) {
    const g = s.cityGov![city.id];
    if (!g) continue;
    // What local officials think of the player.
    if (me) for (const o of officials(g)) {
      o.regard.why.local = ((city.opinion[me.id] ?? me.image) - 0.5) * 50;
      const e = empHere.get(city.id) ?? 0;
      o.regard.why.jobs = e > 100 ? clamp(6 * Math.log10(e / 100), 0, 20) * (o.temperament === "booster" ? 1.5 : 1) : 0;
      if (o.temperament === "populist" && me.marketCap > 500e9) o.regard.why.size = -12;
      for (const k of ["ord", "meeting", "campaign", "deal"]) if (o.regard.why[k]) o.regard.why[k] *= 0.97;
      settle(o);
    }
    // Head tax on big employers.
    if (g.headTax && !warm) for (const c of s.companies) {
      if (!c.alive) continue;
      let n = 0;
      for (const k in c.employees) if (k.startsWith(city.id + ":")) n += c.employees[k];
      if (n > 2000) { const t = n * g.headTax; c.cash -= t; c.current.sgaCost += t; }
    }
    if (warm) continue;
    if (g.pending && s.month >= g.pending.voteMonth) holdVote(s, city, g, me, log);
    else if (!g.pending && rand(s) < 1 / 16) {
      g.pending = propose(s, city, g);
      if (g.pending && affectsPlayer(s, city, me, g.pending.kind)) log(`${city.name} council will vote on "${g.pending.title}" in ${monthName(g.pending.voteMonth)}.`, "politics", true);
    }
    if (s.month >= g.nextElection) cityElection(s, city, g, me, log);
  }
  for (const [st, sg] of Object.entries(s.stateGov!)) {
    if (me) {
      const g = sg.governor;
      let e = 0;
      for (const [cid, n] of empHere) if (s.cities[cid]?.state === st) e += n;
      g.regard.why.jobs = e > 200 ? clamp(7 * Math.log10(e / 200), 0, 25) : 0;
      g.regard.why.hq = me.hq === st ? 10 : 0;
      for (const k of ["meeting", "lobby"]) if (g.regard.why[k]) g.regard.why[k] *= 0.97;
      settle(g);
    }
    if (!warm) stateMonth(s, st, sg, me, log);
    applyStatePolicy(s, st, sg);
  }
}

const monthName = (m: number) => ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][((m % 12) + 12) % 12] + " " + (2026 + Math.floor(m / 12));

/** Extra abatement from a city deal or a state megaproject fund. */
export function localIncentiveBonus(s: GameState, cityId: string, c: Company | undefined): number {
  const city = s.cities[cityId];
  if (!city) return 0;
  const deal = c ? s.cityGov?.[cityId]?.deals?.[c.id] ?? 0 : 0;
  const mega = s.stateGov?.[city.state]?.policy.megaFund ? 0.05 : 0;
  return deal + mega;
}
export function stateDcBonus(s: GameState, cityId: string): number {
  const city = s.cities[cityId];
  return city && s.stateGov?.[city.state]?.policy.dcExempt ? 0.08 : 0;
}

// ---------------------------------------------------------------- player actions

export interface Result { ok: boolean; message: string }

export function lobbyOrdinance(s: GameState, cityId: string, dir: 1 | -1): Result {
  const me = s.companies.find((c) => c.isPlayer)!;
  const g = s.cityGov?.[cityId];
  const city = s.cities[cityId];
  if (!g?.pending || !city) return { ok: false, message: "Nothing is up for a vote." };
  const amount = Math.round(Math.max(250e3, 1e6 * Math.sqrt((STATE_BY_CODE[city.state]?.population ?? 2e6) * city.share / 1e6)) / 1e4) * 1e4;
  if (me.cash < amount) return { ok: false, message: `Lobbying here costs ${fmtMoney(amount)}.` };
  me.cash -= amount;
  me.current.lobbying += amount;
  g.pending.lobby += dir * amount;
  return { ok: true, message: `You spent ${fmtMoney(amount)} lobbying ${dir > 0 ? "for" : "against"} "${g.pending.title}".` };
}

export function requestDeal(s: GameState, cityId: string): Result {
  const me = s.companies.find((c) => c.isPlayer)!;
  const g = s.cityGov?.[cityId];
  const city = s.cities[cityId];
  if (!g || !city) return { ok: false, message: "No such city." };
  if (g.pending) return { ok: false, message: `The council is busy with "${g.pending.title}". Wait for that vote.` };
  if (g.deals?.[me.id]) return { ok: false, message: "You already have a deal here." };
  if (g.history.some((h) => h.mine && h.title.startsWith("Incentives for") && s.month - h.month < 12)) return { ok: false, message: "The council turned you down recently. Give it a year." };
  g.pending = { id: s.nextId++, kind: "company_deal", title: `Incentives for ${me.name}`, detail: `An extra 12% abatement on ${me.name}'s projects here, for as long as it stays.`, proposedBy: g.mayor.id, proposedMonth: s.month, voteMonth: s.month + 1, lobby: 0, companyId: me.id };
  return { ok: true, message: `The council will vote on your incentive package next month.` };
}

export function meetOfficial(s: GameState, o: LocalOfficial): Result {
  const rec = s.record;
  const key = `local:${o.id}`;
  if (rec?.meetings[key] !== undefined && s.month - rec.meetings[key] < 6) return { ok: false, message: `You met ${o.name} recently.` };
  if (rec) rec.meetings[key] = s.month;
  const gain = o.temperament === "populist" ? 2 : o.temperament === "booster" || o.temperament === "dealmaker" ? 8 : 5;
  bumpWhy(o, "meeting", gain, 16);
  settle(o);
  return { ok: true, message: gain >= 8 ? `${o.name} loved the meeting.` : gain <= 2 ? `${o.name} met you, then told a reporter about it.` : `A good meeting with ${o.name}.` };
}

export function backCampaign(s: GameState, o: LocalOfficial, oppose: boolean): Result {
  const me = s.companies.find((c) => c.isPlayer)!;
  const amount = o.role === "governor" ? 2e6 : 250e3;
  if (me.cash < amount) return { ok: false, message: `That costs ${fmtMoney(amount)}.` };
  me.cash -= amount;
  me.current.lobbying += amount;
  o.backing = (o.backing ?? 0) + (oppose ? -amount : amount);
  bumpWhy(o, "campaign", oppose ? -15 : 6, 30);
  settle(o);
  return { ok: true, message: oppose ? `You put ${fmtMoney(amount)} behind ${o.name}'s next opponent. They'll find out.` : `${fmtMoney(amount)} to ${o.name}'s campaign.` };
}

export function lobbyStateBill(s: GameState, st: string, dir: 1 | -1): Result {
  const me = s.companies.find((c) => c.isPlayer)!;
  const sg = s.stateGov?.[st];
  if (!sg?.pending) return { ok: false, message: "Nothing is up for a vote." };
  const amount = 5e6;
  if (me.cash < amount) return { ok: false, message: `Lobbying a statehouse costs ${fmtMoney(amount)}.` };
  me.cash -= amount;
  me.current.lobbying += amount;
  sg.pending.lobby += dir * amount;
  const agrees = (STATE_BILLS[sg.pending.kind].party === "D") === (sg.governor.lean > 0.5) || STATE_BILLS[sg.pending.kind].party === "both";
  bumpWhy(sg.governor, "lobby", (agrees === dir > 0) ? 3 : -4, 20);
  settle(sg.governor);
  return { ok: true, message: `You spent ${fmtMoney(amount)} lobbying ${dir > 0 ? "for" : "against"} the ${sg.pending.title.toLowerCase()}.` };
}

export function reasonLocal(k: string): string {
  return ({ local: "How the town feels about you", jobs: "Jobs you provide here", ord: "Your lobbying at city hall", meeting: "Meeting with your CEO", campaign: "Your campaign money", deal: "Your incentive deal", size: "You're too big for their taste", hq: "Your headquarters is in their state", lobby: "Your lobbying in the statehouse" } as Record<string, string>)[k] ?? k;
}

export { AXES };
