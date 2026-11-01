import { BUILDINGS, BUILDING_BY_ID, methodOf, type BuildingTypeId, type MethodDef } from "./data/buildings";
import { COMPANY_SEEDS, STARTUP_PREFIX, STARTUP_SUFFIX, type CompanySeed } from "./data/companies";
import { rollRoster } from "./roster";
import { GOOD_BY_ID, MARKET_GOODS, TECHS, type GoodId, type TechId } from "./data/goods";
import { BLUE_COLLAR, JOBS, JOB_BY_ID, LOW_WAGE, type JobId } from "./data/jobs";
import { NEED_OF_GOOD } from "./data/needs";
import { STATES, STATE_BY_CODE } from "./data/states";
import { activePartners, updatePeople } from "./people";
import { checkMilestones } from "./milestones";
import { calibrateConsumers, driftPreferences, updateConsumers } from "./consumers";
import { initMacro, updateMacro, updateWorldEvents } from "./macro";
import {
  aiLobbying, carbonCost, corpTax, exportMult, foreignPriceMult, immigrationMult, importMult, initPolitics,
  maybeHoldElection, minWageFloor, subsidyRate, unionPressure, unionWageMult, updatePolitics,
} from "./politics";
import { generatePops } from "./pops";
import { assignHomes, cityIncentive, cityLabel, computeStateWages, initCities, defaultCity, spreadInState, distributeWorkforce, dcPowerCost, permitMult, setHqOpinionHook, updateCities } from "./geo";
import { hqAdminMult, hqCityOpinion, hqHireRateMult, hqHiringMult, hqImageBonus, hqReputationMult, hqResearchMult, hqUpkeep, HQ_FORMS } from "./hq";
import { updateJobOpinion, updatePopulation } from "./population";
import { initElectionData, runPrimaries, updateProjections } from "./elections";
import { homeCostShare, initWorld, updateWorld } from "./intl";
import { rollStories } from "./stories";
import { headlineFor } from "./headlines";
import { initLeadership, leadEffects, leadershipCost, updateLeadership } from "./leadership";
import { complexityMult, conglomerateDiscount, industryMult, learningOverhead, noteEntry, sectorLevels, siteMult, siteMultFor, updateKnowhow } from "./sectors";
import { RESOURCES, resourceMult, type ResourceId } from "./data/resources";
import { processDeals } from "./actions";
import { tierOf } from "./tiers";
import type { Building, Company, EventTag, GameEvent, GameState, GoodMap, MarketSnapshot, MonthReport } from "./types";
import {
  clamp, dateLabel, dayLabel, dayOfMonthStart, DAYS_PER_MONTH, fmtMoney, laborKey, monthOfDay, pick, rand, randNormal, shuffle,
} from "./util";
import { runAI, autoPrice, maintainHQ } from "./ai";

export const SAVE_VERSION = 9;
export const BASELINE_TECH_START = 10;
const DT = 1 / DAYS_PER_MONTH;
const DEPRECIATION = 0.006;
/** Share of a labor pool not already working for a game company that can be hired in one month. */
const HIRE_RATE = 0.05;
const WARMUP_MONTHS = 12;
/** Units imported today, by good. */
let dayImports: GoodMap = {};

// ---------------------------------------------------------------- new game

export type PlayerChoice =
  | { kind: "incumbent"; key: string }
  | { kind: "startup"; name: string; ticker: string; good: GoodId; hq: string; city?: string };

export function newGame(choice: PlayerChoice, seed = Math.floor(Math.random() * 1e9), roster?: CompanySeed[]): GameState {
  const seeds = [...(roster ?? rollRoster(seed).companies)];
  if (choice.kind === "incumbent" && !seeds.some((d) => d.key === choice.key)) {
    const d = COMPANY_SEEDS.find((x) => x.key === choice.key);
    if (d) seeds.push(d);
  }
  const pops = generatePops();

  const startDay = dayOfMonthStart(-WARMUP_MONTHS);
  const s: GameState = {
    version: SAVE_VERSION, seed, rng: seed | 0, day: startDay, month: -WARMUP_MONTHS, playerId: -1,
    pops, labor: {}, companies: [], demandScale: {}, needShare: {}, needPref: {}, needStats: {}, usDemand: {},
    othersWeight: {}, othersPrice: {}, othersShareStart: {}, marketGrowth: {}, baselineTech: {}, markets: {},
    baseRate: 0.05, macro: initMacro(), worldEvents: [], politics: undefined as never, politicians: [], vacancies: [], stateLegs: {}, races: [], cities: {}, stateWage: {}, deals: [], statePopStart: {},
    sol: 100, solNorm: 1, events: [], nextId: 1,
  };
  initCities(s);
  initWorld(s);
  s.politics = initPolitics(s);
  initElectionData(s);
  refreshWorkforce(s);
  assignHomes(s);
  for (const cell of Object.values(s.labor)) cell.wage = JOB_BY_ID[cell.job].baseWage * (s.cities[cell.city]?.col ?? 1);
  computeStateWages(s);
  for (const p of s.pops) s.statePopStart[p.state] = (s.statePopStart[p.state] ?? 0) + p.workers + p.dependents;
  for (const t of TECHS) s.baselineTech[t.id] = BASELINE_TECH_START;
  for (const g of MARKET_GOODS) { s.othersPrice[g.id] = g.refPrice; s.marketGrowth[g.id] = 1; }

  for (const seedDef of seeds) {
    const c = companyFromSeed(s, seedDef);
    if (choice.kind === "incumbent" && choice.key === seedDef.key) { c.isPlayer = true; s.playerId = c.id; }
    s.companies.push(c);
  }
  for (const c of s.companies) initLeadership(s, c);
  let startupValuation = 0;
  if (choice.kind === "startup") {
    const c = createStartup(s, { name: choice.name, ticker: choice.ticker, good: choice.good, hq: choice.hq, city: choice.city, cash: 80e6, isPlayer: true });
    startupValuation = 160e6;
    s.companies.push(c);
    s.playerId = c.id;
  }

  // Everyone starts staffed, up to what each local labor market can supply.
  const demand: Record<string, number> = {};
  for (const c of s.companies) for (const [k, need] of Object.entries(staffNeeds(c))) demand[k] = (demand[k] ?? 0) + need;
  for (const c of s.companies) {
    for (const [k, need] of Object.entries(staffNeeds(c))) {
      const cell = s.labor[k];
      const cap = cell ? Math.min(1, (cell.workforce * 0.6) / Math.max(1, demand[k])) : 0;
      c.employees[k] = need * cap;
      if (cell) cell.gameEmployed += need * cap;
    }
  }

  calibrateConsumers(s);
  updateConsumers(s);
  seedBrands(s);
  calibrateOthers(s);
  presolvePrices(s);

  // Warm-up year (2025): the economy runs so every company has a year of history.
  warmup = true;
  while (s.day < 0) tick(s);
  warmup = false;
  for (const g of MARKET_GOODS) s.othersShareStart[g.id] = s.markets[g.id]?.othersShare ?? 1;
  // The player's startup is founded now, not a year ago: fresh books and current technology.
  if (choice.kind === "startup") {
    const p = s.companies.find((c) => c.id === s.playerId)!;
    p.cash = 80e6;
    p.debt = 0;
    p.history = [];
    p.rndCum = 0;
    p.foundedMonth = 0;
    const t = GOOD_BY_ID[choice.good].tech;
    if (t) { p.tech[t] = (s.baselineTech[t] ?? BASELINE_TECH_START) + 0.5; p.researchPoints = {}; }
  }

  // Anchor sentiment so opening market caps match the seeds.
  for (const c of s.companies) {
    const seedDef = seeds.find((d) => d.name === c.name);
    const target = seedDef ? seedDef.marketCap : c.isPlayer ? startupValuation : c.marketCap;
    const fundamental = fundamentalValue(s, c, 1);
    const core = fundamental - (c.cash - c.debt);
    c.hype = core > 0 ? clamp((target - (c.cash - c.debt)) / core, 0.2, 60) : 1;
    c.hypeAnchor = c.hype;
    c.marketCap = target;
    c.valuationTarget = target;
    // Rescale the warm-up year's valuations so the chart ends at today's value instead of jumping to it.
    const last = c.history[c.history.length - 1];
    if (last) {
      // Warm-up valuations are noisy calibration; replace them with a path that follows smoothed revenue.
      const smooth = (i: number) => { const w = c.history.slice(Math.max(0, i - 2), i + 1); return w.reduce((a, h) => a + h.revenue, 0) / w.length; };
      const end = smooth(c.history.length - 1);
      c.history.forEach((h, i) => {
        const r = end > 0 ? clamp(smooth(i) / end, 0.85, 1.1) : 1;
        h.marketCap = target * r;
        h.sharePrice = h.marketCap / c.shares;
      });
    }
  }
  for (const c of s.companies) if (c.leadership) c.leadership.board.nextMeeting = 3 + (c.id % 3);
  s.macro.history = [];
  s.events = [];
  log(s, `Welcome to ${dayLabel(0)}. You are running ${player(s).name}.`, "info", s.playerId);
  return s;
}

let warmup = false;

/** Average 12-month stock return in each market-cap tier. */
function peerReturns(alive: Company[]): Map<string, number> {
  const acc = new Map<string, [number, number]>();
  for (const c of alive) {
    const h = c.history;
    if (h.length < 13 || !(h[h.length - 13].marketCap > 0)) continue;
    const t = tierOf(c.marketCap).id;
    const a = acc.get(t) ?? [0, 0];
    a[0] += Math.max(-0.9, Math.min(3, c.marketCap / h[h.length - 13].marketCap - 1));
    a[1]++;
    acc.set(t, a);
  }
  const out = new Map<string, number>();
  for (const [t, [sum, n]] of acc) out.set(t, sum / n);
  return out;
}

function bestResourceState(r: ResourceId): string {
  return Object.entries(RESOURCES[r]).sort((a, b) => b[1] - a[1])[0][0];
}
setHqOpinionHook(hqCityOpinion);

function emptyReport(month: number, c: Company): MonthReport {
  return {
    month, revenue: 0, revenueByGood: {}, unitsSold: {}, inputCosts: 0, wages: 0, rdCost: 0, sgaCost: 0,
    marketing: 0, lobbying: 0, depreciation: 0, interest: 0, taxes: 0, netIncome: 0, dividends: 0, capex: 0, cash: 0, debt: 0,
    marketCap: c.marketCap, sharePrice: 0, employees: 0,
  };
}

function blankCompany(s: GameState, name: string, ticker: string, hq: string): Company {
  const c: Company = {
    id: s.nextId++, name, ticker, color: "#cccccc", tagline: "", hq, isPlayer: false, alive: true, foundedMonth: s.month,
    cash: 0, debt: 0, shares: 1e8, marketCap: 0, valuationTarget: 0, hype: 1, hypeAnchor: 1, ppe: 0, reputation: {}, buildings: [],
    inventory: {}, prices: {}, autoPrice: {}, wagePolicy: 1, marketingPct: 0.03, dividendPct: 0, brand: {}, tech: { ...s.baselineTech },
    researchPoints: {}, researchAlloc: {}, employees: {}, history: [], current: undefined as never, distressMonths: 0, unitCost: {},
    inputUse: {}, dayProduced: {}, daySold: {}, growthHint: 0.1, rndIntensity: 0.1, rndCum: 0, kind: "startup", image: 0.6,
    lobbying: [], donations: {}, layoffs: 0, layoffsByJob: {}, layoffsByCity: {}, jobOpinion: {},
    hqSite: { city: defaultCity(s, hq, "hq"), form: "campus", amenities: [] },
  };
  c.current = emptyReport(s.month, c);
  return c;
}

export function addBuilding(s: GameState, c: Company, type: BuildingTypeId, city: string, level: number, method?: string): Building {
  const def = BUILDING_BY_ID[type];
  const state = s.cities[city]?.state ?? c.hq;
  const b: Building = {
    id: s.nextId++, type, state, city, method: method ?? def.methods[0].id, level, construction: [],
    staffRatio: 1, efficiency: 1, lastOutput: {}, lastWages: 0, profitMTD: 0, lastProfit: 0,
  };
  c.buildings.push(b);
  c.ppe += buildCostPerLevel(s, type, city, b.method, false) * level;
  noteEntry(c, def.sector);
  return b;
}

/** Cost to build one level in a city: local costs, method, HQ form, and (optionally) federal subsidies and city incentives. */
export function buildCostPerLevel(s: GameState, type: BuildingTypeId, city: string, method?: string, subsidized = true, c?: Company): number {
  const def = BUILDING_BY_ID[type];
  const m = methodOf(type, method ?? def.methods[0].id);
  const col = s.cities[city]?.col ?? 1;
  let base = def.cost * (m.costMult ?? 1) * (0.6 + 0.4 * col);
  if (type === "hq" && c) base *= HQ_FORMS[c.hqSite.form].costMult;
  return subsidized ? base * (1 - subsidyRate(s, type, m.id)) * (1 - cityIncentive(s, city, c, type)) : base;
}

function spread(total: number, shares: Record<string, number>): [string, number][] {
  const entries = Object.entries(shares);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  return entries.map(([st, v]) => [st, Math.max(1, Math.round((total * v) / sum))]);
}

function companyFromSeed(s: GameState, d: CompanySeed): Company {
  const c = blankCompany(s, d.name, d.ticker, d.hq);
  Object.assign(c, {
    color: d.color, tagline: d.tagline, cash: d.cash, debt: d.debt, shares: d.shares, marketCap: d.marketCap,
    wagePolicy: d.wagePolicy, marketingPct: d.marketingPct, rndIntensity: d.rndIntensity || 0.1, kind: d.tier,
    inspiredBy: d.inspiredBy, foundedMonth: -120, dividendPct: d.tier === "incumbent" ? 0.2 : 0,
  });
  c.current = emptyReport(s.month, c);
  for (const t of TECHS) c.tech[t.id] = BASELINE_TECH_START + (d.techEdge[t.id] ?? 0);
  let annualRevenue = 0;
  for (const p of d.produce) {
    const g = GOOD_BY_ID[p.good];
    const price = g.refPrice * (d.priceMult[p.good] ?? 1);
    c.prices[p.good] = price;
    c.autoPrice[p.good] = true;
    c.reputation[p.good] = 0.5 + 0.5 * (d.brand[p.good] ?? 1);
    const units = p.annualUnits ?? (p.annualRevenue ?? 0) / price;
    annualRevenue += p.annualRevenue ?? 0;
    const prod = producerFor(p.good, p.method);
    const out = methodOf(prod.type, prod.method).output[p.good]!;
    const levels = Math.ceil(units / 12 / out / 0.95);
    for (const [st, lvRaw] of spread(levels, p.states)) {
      const pdef = BUILDING_BY_ID[prod.type];
      const sm = siteMultFor(prod.type, prod.method ?? pdef.methods[0].id, st);
      if (sm <= 0) continue;
      const lvState = Math.max(1, Math.round(lvRaw / sm));
      for (const [city, lv] of spreadInState(s, st, prod.type, lvState, prod.method)) {
        const b = addBuilding(s, c, prod.type, city, lv, prod.method);
        if (p.building) queueConstruction(s, c, b, Math.round((p.building.levels * lv) / levels) || 1, p.building.monthsLeft);
      }
    }
    c.inventory[p.good] = (c.inventory[p.good] ?? 0) + (units / 12) * 0.3;
  }
  for (const e of d.extraBuildings ?? []) {
    const b = addBuilding(s, c, e.type, defaultCity(s, e.state, e.type), e.levels, e.method);
    if (e.underConstruction) queueConstruction(s, c, b, e.underConstruction, e.monthsLeft ?? 6);
    for (const g of Object.keys(methodOf(e.type, b.method).output) as GoodId[]) {
      c.prices[g] = GOOD_BY_ID[g].refPrice * (d.priceMult[g] ?? 1);
      c.autoPrice[g] = true;
      c.reputation[g] = 0.5 + 0.5 * (d.brand[g] ?? 1);
    }
  }
  const labCost = labMonthlyCost();
  // Small firms in low-research industries run no lab at all; a lab level costs millions a month.
  const rndLevels = d.rndLevels ?? Math.round((d.rndIntensity * annualRevenue) / 12 / labCost);
  if (rndLevels > 0) for (const [st, lvState] of spread(rndLevels, d.rndStates)) {
    if (st === d.hq && lvState < 200) { addBuilding(s, c, "rnd", c.hqSite.city, lvState); continue; }
    for (const [city, lv] of spreadInState(s, st, "rnd", lvState)) addBuilding(s, c, "rnd", city, lv);
  }
  c.hqSite.form = d.marketCap > 500e9 ? "campus" : towerFor(s, c.hqSite.city) ? "tower" : "block";
  if (d.tier === "incumbent") c.hqSite.amenities = d.marketCap > 1e12 ? ["cafeteria", "fitness", "innovation_lab", "shuttle"] : ["cafeteria"];
  c.knowhow = {};
  for (const b of c.buildings) { const sec = BUILDING_BY_ID[b.type].sector; if (sec) c.knowhow[sec] = 1; }
  ensureHQ(s, c);
  for (const p of d.produce) {
    const t = GOOD_BY_ID[p.good].tech;
    if (t) c.researchAlloc[t] = (c.researchAlloc[t] ?? 0) + (p.annualRevenue ?? 1e9);
  }
  if (Object.keys(c.researchAlloc).length === 0) {
    for (const e of d.extraBuildings ?? []) {
      for (const g of Object.keys(methodOf(e.type, e.method ?? BUILDING_BY_ID[e.type].methods[0].id).output) as GoodId[]) {
        const t = GOOD_BY_ID[g].tech;
        if (t) c.researchAlloc[t] = 1;
      }
    }
  }
  const maxW = Math.max(0, ...Object.values(c.researchAlloc).map((w) => w ?? 0));
  if (maxW > 0) for (const t of Object.keys(c.researchAlloc) as TechId[]) c.researchAlloc[t] = Math.max(1, Math.round((c.researchAlloc[t]! / maxW) * 10));
  const hints: Record<string, number> = { verdant: 0.5, seerstone: 0.4, cumulus: 0.8, cascade: 0.35, lumiverse: 0.15, summit: 0.12, marquee: 0.12 };
  c.growthHint = d.tier === "startup" ? 0.6 : hints[d.key] ?? 0.06;
  return c;
}

function producerFor(good: GoodId, method?: string): { type: BuildingTypeId; method: string } {
  for (const b of BUILDINGS) for (const m of b.methods) {
    if (m.output[good] && (!method || m.id === method)) return { type: b.id, method: m.id };
  }
  throw new Error(`No producer for ${good}`);
}

function labMonthlyCost(m = methodOf("rnd", "rnd")): number {
  let w = m.upkeep ?? 0;
  for (const [j, n] of Object.entries(m.staff)) w += (n ?? 0) * JOB_BY_ID[j as JobId].baseWage * 1.1;
  return w;
}

export function adminCapacity(c: Company): number {
  let cap = 0;
  for (const b of c.buildings) cap += (methodOf(b.type, b.method).admin ?? 0) * b.level;
  return 5 + cap * hqAdminMult(c);
}
export function adminLoad(c: Company): number {
  let load = 0;
  for (const b of c.buildings) if (BUILDING_BY_ID[b.type].usesAdmin) load += b.level + b.construction.reduce((a, x) => a + x.levels, 0);
  return Math.round(load * complexityMult(c));
}

function ensureHQ(s: GameState, c: Company) {
  const needed = Math.ceil(Math.max(0, adminLoad(c) * 1.05 - 5) / 15);
  addBuilding(s, c, "hq", c.hqSite.city, Math.max(1, needed));
}

function towerFor(s: GameState, city: string) { return !!s.cities[city]?.flags.includes("tower"); }

export function createStartup(
  s: GameState,
  o: { name: string; ticker: string; good: GoodId; hq: string; city?: string; cash: number; isPlayer?: boolean },
): Company {
  const c = blankCompany(s, o.name, o.ticker, o.hq);
  if (o.city && s.cities[o.city]) c.hqSite.city = o.city;
  c.hqSite.form = "block";
  c.isPlayer = !!o.isPlayer;
  c.cash = o.cash;
  c.shares = 20e6;
  c.marketCap = o.cash * 2;
  c.valuationTarget = c.marketCap;
  c.kind = "startup";
  c.color = o.isPlayer ? "#1c3329" : `hsl(${Math.floor(rand(s) * 360)} 35% 42%)`;
  c.tagline = o.isPlayer ? "Your company. Two rooms, a whiteboard and a lot of ambition." : "A venture-backed upstart.";
  c.marketingPct = 0.08;
  c.wagePolicy = 1.05;
  c.growthHint = 0.8;
  c.rndIntensity = 0.2;
  const prod = producerFor(o.good);
  const g = GOOD_BY_ID[o.good];
  c.prices[o.good] = g.refPrice;
  c.autoPrice[o.good] = true;
  c.reputation[o.good] = 1;
  if (g.tech) { c.researchAlloc[g.tech] = 10; c.tech[g.tech] = (s.baselineTech[g.tech] ?? BASELINE_TECH_START) + 0.5; }
  const pdef = BUILDING_BY_ID[prod.type];
  const site = pdef.resource && resourceMult(pdef.resource, o.hq) === 0 ? bestResourceState(pdef.resource) : o.hq;
  addBuilding(s, c, prod.type, prod.type === "datacenter" || prod.type === "power" || site !== o.hq || pdef.resource ? defaultCity(s, site, prod.type) : c.hqSite.city, 1, prod.method);
  if (pdef.sector) c.knowhow = { [pdef.sector]: 0.6 };
  addBuilding(s, c, "rnd", c.hqSite.city, 3);
  addBuilding(s, c, "hq", c.hqSite.city, 1);
  initLeadership(s, c);
  return c;
}

export const BRAND_FLOOR = 0.00001;

export function marketingMult(c: Company): number {
  return (0.7 + 3 * Math.sqrt(Math.max(0, c.marketingPct))) * leadEffects.marketing(c);
}

/** Share of the market a company can supply from its own (efficiency-adjusted) capacity, net of what it uses itself. */
export function supplyShare(s: GameState, c: Company, g: GoodId): number {
  const D0 = baseDemandUnits(s, g);
  if (D0 <= 0) return 0;
  let q = 0;
  for (const b of c.buildings) q += (methodOf(b.type, b.method).output[g] ?? 0) * b.level * b.efficiency * siteMult(b);
  q -= (c.inputUse[g] ?? 0) * DAYS_PER_MONTH;
  return Math.max(0, q) / D0;
}

/**
 * Brand awareness drifts toward the company's supply share, scaled up by marketing.
 * Diminishing returns at large shares: dominating a market takes ever deeper price cuts.
 */
export function brandTarget(s: GameState, c: Company, g: GoodId): number {
  const sh = supplyShare(s, c, g);
  return Math.max(BRAND_FLOOR, (sh / (1 + 3 * sh)) * marketingMult(c));
}

/** The unmodeled rest of each market keeps the brand weight modeled companies didn't cover at start. */
function calibrateOthers(s: GameState) {
  for (const g of MARKET_GOODS) {
    let covered = 0;
    for (const c of s.companies) if (c.prices[g.id]) covered += supplyShare(s, c, g.id);
    s.othersWeight[g.id] = Math.max(0.05, 1 - covered);
  }
}

function seedBrands(s: GameState) {
  for (const c of s.companies) {
    for (const g of Object.keys(c.prices) as GoodId[]) {
      const t = brandTarget(s, c, g);
      c.brand[g] = t > BRAND_FLOOR ? t * (c.isPlayer && c.kind === "startup" ? 0.4 : 1) : BRAND_FLOOR * 100;
    }
  }
}

/**
 * Start every company at roughly the price where its demand matches its capacity,
 * so the warm-up year isn't spent marching prices toward equilibrium.
 */
function presolvePrices(s: GameState) {
  for (let it = 0; it < 60; it++) {
    for (const g of MARKET_GOODS) {
      const sellers = s.companies.filter((c) => c.prices[g.id] && companyCapacity(c, g.id) > 0);
      if (!sellers.length) continue;
      const net = new Map<number, number>();
      for (const c of sellers) {
        let own = 0;
        for (const b of c.buildings) {
          const m = methodOf(b.type, b.method);
          for (const og in m.output) own += ((m.recipe?.[og as GoodId] ?? GOOD_BY_ID[og as GoodId].recipe)[g.id] ?? 0) * m.output[og as GoodId]! * b.level;
        }
        net.set(c.id, Math.max(0, companyCapacity(c, g.id) - own));
      }
      const D0 = baseDemandUnits(s, g.id);
      const op = s.othersPrice[g.id] ?? g.refPrice;
      let total = (s.othersWeight[g.id] ?? 0.5) * Math.pow(g.refPrice / op, g.priceSensitivity), sumAP = total * op;
      const A = new Map<number, number>();
      for (const c of sellers) { if (!net.get(c.id)) continue; const a = attractiveness(s, c, g.id); A.set(c.id, a); total += a; sumAP += a * c.prices[g.id]!; }
      const D = D0 * (g.refPrice / (sumAP / total));
      for (const c of sellers) {
        const cap = (net.get(c.id) ?? 0) * 0.97;
        if (cap <= 0 || !A.has(c.id)) continue;
        const ratio = (D * A.get(c.id)!) / total / cap;
        const p = c.prices[g.id]! * Math.pow(ratio, 0.5 / g.priceSensitivity);
        c.prices[g.id] = clamp(p, g.refPrice * 0.5, g.refPrice * 3);
      }
    }
  }
}

export function companyCapacity(c: Company, g: GoodId): number {
  let cap = 0;
  for (const b of c.buildings) cap += (methodOf(b.type, b.method).output[g] ?? 0) * b.level * siteMult(b);
  return cap;
}

// ---------------------------------------------------------------- demand

/** Share of a good's demand that comes from the US (vs. the world market). */
export function usShare(s: GameState, good: GoodId): number {
  const g = GOOD_BY_ID[good];
  const us = s.usDemand[good] ?? 0;
  const world = (g.marketWorld / 12 / g.refPrice) * exportMult(s);
  return us + world > 0 ? us / (us + world) : 0;
}

/** Monthly demand in units at reference prices: US (pops and businesses) plus the world. */
export function baseDemandUnits(s: GameState, good: GoodId): number {
  const g = GOOD_BY_ID[good];
  const us = s.usDemand[good] ?? 0;
  const world = (g.marketWorld / 12 / g.refPrice) * exportMult(s) * (1 + 0.5 * s.macro.gap);
  return (us + world) * (s.marketGrowth[good] ?? 1);
}

export function quality(s: GameState, c: Company, good: GoodId): number {
  const t = GOOD_BY_ID[good].tech;
  if (!t) return 1;
  return Math.pow(1.08, (c.tech[t] ?? 0) - (s.baselineTech[t] ?? BASELINE_TECH_START));
}

export function attractiveness(s: GameState, c: Company, good: GoodId, price = c.prices[good]): number {
  const g = GOOD_BY_ID[good];
  const p = price ?? g.refPrice;
  // Public image matters to households, not to business buyers.
  const imageMult = NEED_OF_GOOD[good] ? (0.8 + 0.4 * c.image) * hqReputationMult(c) : 1;
  return Math.pow(quality(s, c, good), 2) * (c.reputation[good] ?? 1) * imageMult * (c.brand[good] ?? BRAND_FLOOR) * Math.pow(g.refPrice / p, g.priceSensitivity);
}

// ---------------------------------------------------------------- labor

const needsCache = new WeakMap<Company, { sig: number; needs: Record<string, number> }>();
/** Workers wanted per city labor market (cached until the company's buildings change). */
export function staffNeeds(c: Company): Record<string, number> {
  let sig = c.buildings.length;
  for (const b of c.buildings) sig = (sig * 31 + b.id * 7919 + b.level * 104729 + b.method.charCodeAt(b.method.length - 1) * 13 + b.method.length) % 2147483647;
  const hit = needsCache.get(c);
  if (hit && hit.sig === sig) return hit.needs;
  const needs = computeStaffNeeds(c);
  needsCache.set(c, { sig, needs });
  return needs;
}

function computeStaffNeeds(c: Company): Record<string, number> {
  const needs: Record<string, number> = {};
  for (const b of c.buildings) {
    if (b.level <= 0) continue;
    const m = methodOf(b.type, b.method);
    for (const j in m.staff) {
      const k = laborKey(b.city, j);
      needs[k] = (needs[k] ?? 0) + (m.staff[j as JobId] ?? 0) * b.level;
    }
  }
  return needs;
}

/** Workforce per city labor market from pops, adjusted for immigration policy. */
export function refreshWorkforce(s: GameState) {
  distributeWorkforce(s, (job) => immigrationMult(s, job));
}

function hireDaily(s: GameState, alive: Company[]) {
  const requests: Record<string, { c: Company; want: number }[]> = {};
  for (const c of alive) {
    const needs = staffNeeds(c);
    for (const k in c.employees) {
      const need = needs[k] ?? 0;
      if (c.employees[k] > need) {
        const cut = c.employees[k] - need;
        s.labor[k].gameEmployed -= cut;
        c.employees[k] = need;
        c.layoffs += cut;
        const cell = s.labor[k];
        if (cell) {
          c.layoffsByJob[cell.job] = (c.layoffsByJob[cell.job] ?? 0) + cut;
          c.layoffsByCity[cell.city] = (c.layoffsByCity[cell.city] ?? 0) + cut;
        }
      }
      if (c.employees[k] <= 0) delete c.employees[k];
    }
    for (const k in needs) {
      const have = c.employees[k] ?? 0;
      if (needs[k] > have + 0.01) (requests[k] ??= []).push({ c, want: needs[k] - have });
    }
  }
  for (const k in requests) {
    const reqs = requests[k];
    const cell = s.labor[k];
    if (!cell) continue;
    const available = Math.max(0, cell.workforce - cell.gameEmployed) * HIRE_RATE * DT;
    let wsum = 0;
    const city = s.cities[cell.city];
    // Pay, the company's reputation with this kind of worker and with the town, and HQ perks all count.
    const weights = reqs.map((r) => {
      const appeal = Math.pow(r.c.wagePolicy, 4) * (0.8 + 0.4 * (r.c.jobOpinion[cell.job] ?? 0.5)) * (0.8 + 0.4 * (city?.opinion[r.c.id] ?? r.c.image)) * hqHiringMult(r.c, cell.job);
      const w = r.want * appeal * hqHireRateMult(r.c, cell.city);
      wsum += w;
      return w;
    });
    let short = 0;
    reqs.forEach((r, i) => {
      const grant = Math.min(r.want, (available * weights[i]) / wsum);
      r.c.employees[k] = (r.c.employees[k] ?? 0) + grant;
      cell.gameEmployed += grant;
      short += r.want - grant;
    });
    // Smoothed monthly-rate shortage.
    cell.shortage = cell.shortage * 0.9 + short * 0.1;
  }
}

function updateWages(s: GameState) {
  const floor = minWageFloor(s);
  const press = unionPressure(s);
  for (const cell of Object.values(s.labor)) {
    const city = s.cities[cell.city];
    const unionLocal = city && BLUE_COLLAR.includes(cell.job) ? 1 + 0.04 * city.union : 1;
    const base = JOB_BY_ID[cell.job].baseWage * (city?.col ?? 1) * unionWageMult(s, cell.job) * unionLocal;
    const share = cell.gameEmployed / Math.max(1, cell.workforce);
    const tight = Math.min(1, cell.shortage / Math.max(1, cell.workforce * HIRE_RATE));
    let target = base * (1 + press * Math.pow(share, 1.2) + 0.25 * tight) * (1 + s.macro.gap * 0.5);
    if (LOW_WAGE.includes(cell.job) && !city?.foreign) target = Math.max(target, floor, city?.minWage ?? 0);
    cell.wage += (target - cell.wage) * 0.1;
  }
  computeStateWages(s);
}

// ---------------------------------------------------------------- the daily tick

interface DayAcc {
  rev: number;
  cost: number;
  b2bSold: GoodMap;
  costOf: GoodMap;
}

export function tick(s: GameState) {
  if (s.gameOver) return;
  s.day++;
  const m = monthOfDay(s.day);
  if (m !== s.month) {
    closeMonth(s);
    s.month = m;
    monthly(s);
  }
  dayImports = {};
  const alive = s.companies.filter((c) => c.alive);
  const acc = new Map<number, DayAcc>();
  for (const c of alive) acc.set(c.id, { rev: 0, cost: 0, b2bSold: {}, costOf: {} });

  // Construction
  for (const c of alive) {
    const a = acc.get(c.id)!;
    let changed = false;
    for (const b of c.buildings) {
      if (!b.construction.length) continue;
      for (const job of b.construction) {
        c.current.capex += job.dailyCost;
        a.cost += job.dailyCost;
        job.daysLeft--;
        if (job.daysLeft <= 0) {
          b.level += job.levels;
          if (c.isPlayer && !warmup) log(s, `Construction finished: +${job.levels} ${BUILDING_BY_ID[b.type].name} level${job.levels > 1 ? "s" : ""} in ${cityLabel(s, b.city)}.`, "good", c.id, "build");
        }
      }
      b.construction = b.construction.filter((j) => j.daysLeft > 0);
      changed = true;
    }
    if (changed) c.buildings = c.buildings.filter((b) => b.level > 0 || b.construction.length > 0);
  }

  hireDaily(s, alive);
  for (const c of shuffle(s, alive)) produce(s, c, acc, alive);
  for (const g of MARKET_GOODS) clearMarket(s, g.id, alive, acc);

  for (const c of alive) {
    // Spoilage / obsolescence
    for (const g in c.inventory) {
      const d = GOOD_BY_ID[g as GoodId].decay;
      if (d > 0) c.inventory[g as GoodId] = (c.inventory[g as GoodId] ?? 0) * (d >= 1 ? 0 : Math.pow(1 - d, DT));
      if ((c.inventory[g as GoodId] ?? 0) < 1e-6) delete c.inventory[g as GoodId];
    }
    // Cash
    const a = acc.get(c.id)!;
    c.cash += a.rev - a.cost;
    if (c.cash < 0) { c.debt += -c.cash; c.cash = 0; }
    // Research
    research(s, c, DT);
    // Prices
    for (const g in c.prices) if (c.isPlayer ? c.autoPrice[g as GoodId] : true) autoPrice(s, c, g as GoodId);
    // Share price drifts toward its target with daily noise.
    c.marketCap += (c.valuationTarget - c.marketCap) * 0.0094;
    c.marketCap *= 1 + 0.0036 * randNormal(s);
    c.marketCap = Math.max(c.marketCap, 1e6);
  }
  for (const t of TECHS) s.baselineTech[t.id] = (s.baselineTech[t.id] ?? BASELINE_TECH_START) + DT / 12;
  if (!warmup) {
    runPrimaries(s, (t) => log(s, t, "politics"));
    maybeHoldElection(s, (t, k) => log(s, t, k ?? "politics", undefined, "election"));
    processDeals(s);
  }
}

function monthly(s: GameState) {
  const alive = s.companies.filter((c) => c.alive);
  const say = (t: string, k?: "info" | "good" | "bad" | "deal" | "politics", tag?: EventTag) => {
    if (!warmup) log(s, t, k ?? "info", undefined, tag ?? (/^Recession/.test(t) ? "macro" : undefined));
  };
  updateMacro(s, say);
  updateWorldEvents(s, (t, k, extra) => { if (!warmup) log(s, t, k ?? "info", undefined, extra ? "macro" : undefined, extra); });
  if (s.month % 12 === 0) s.immigrantsThisYear = 0;
  if (!warmup) { updatePopulation(s); updateWorld(s); }
  refreshWorkforce(s);
  updateWages(s);
  driftPreferences(s);
  updateConsumers(s);
  for (const g of MARKET_GOODS) {
    const snap = s.markets[g.id];
    if (snap) { snap.priceHistory.push(snap.avgPrice); if (snap.priceHistory.length > 60) snap.priceHistory.shift(); }
  }
  const years = Math.max(0, s.month) / 12;
  for (const g of MARKET_GOODS) {
    const growth = 0.03 + (g.growth - 0.03) * Math.pow(0.85, years);
    s.marketGrowth[g.id] = (s.marketGrowth[g.id] ?? 1) * (1 + growth / 12);
  }
  updateOthersPrices(s);
  for (const c of alive) updateBrand(s, c);
  updateCities(s, say);
  if (!warmup) rollStories(s, (c) => (t, k, extra) => log(s, t, k, c.id, c.isPlayer ? (extra?.headline && s.decisions?.some((d) => d.headline === extra.headline) ? "decision" : "news") : undefined, extra));
  {
    const me = alive.find((c) => c.isPlayer);
    updatePeople(s, (t, k, extra) => { if (!warmup && me) log(s, t, k, me.id, extra?.headline && s.decisions?.some((d) => d.headline === extra.headline) ? "decision" : "news", extra); }, warmup);
    const partners = activePartners(s);
    for (const c of alive) c.allyBoost = c.isPlayer ? 1 + 0.05 * partners.length : partners.includes(c.id) ? 1.05 : 1;
    if (!warmup && me) checkMilestones(s, me, (t, extra) => log(s, t, "good", me.id, "news", extra));
  }
  const peer = peerReturns(alive);
  for (const c of alive) {
    updateJobOpinion(s, c);
    updateKnowhow(c);
    if (!warmup) updateLeadership(s, c, peer.get(tierOf(c.marketCap).id) ?? 0, (t, k, tag) => log(s, t, k, c.id, tag));
  }
  if (!warmup) {
    updatePolitics(s, (t, k) => log(s, t, k ?? "politics", undefined, /signed into law|vetoed|failed in the/.test(t) ? "law" : undefined));
    updateProjections(s);
  }
  for (const c of alive) {
    if (c.isPlayer && c.autoHq && !warmup) { const m = maintainHQ(s, c); if (m) log(s, `Headquarters: ${m}`, "info", c.id, "build"); }
    if (!c.isPlayer) { aiLobbying(s, c); runAI(s, c, { warmup }); }
  }
  if (!warmup) {
    maybeSpawnStartup(s);
    checkSolvency(s);
    checkTiers(s);
    s.macro.history.push({ month: s.month, gap: s.macro.gap, fedRate: s.macro.fedRate, sol: s.sol, approval: s.politics.approval });
    if (s.macro.history.length > 240) s.macro.history.shift();
  }
}

function recipeOf(m: MethodDef, g: GoodId): Partial<Record<GoodId, number>> {
  return m.recipe?.[g] ?? GOOD_BY_ID[g].recipe;
}

/** Companies that sell a good, cheapest first (rebuilt each day). */
let sellerIndex: { alive: Company[] | null; by: Map<GoodId, Company[]> } = { alive: null, by: new Map() };
function sellersOf(alive: Company[], g: GoodId): Company[] {
  if (sellerIndex.alive !== alive) {
    const by = new Map<GoodId, Company[]>();
    for (const o of alive) for (const k in o.prices) { const l = by.get(k as GoodId); if (l) l.push(o); else by.set(k as GoodId, [o]); }
    for (const [k, l] of by) l.sort((x, y) => (x.prices[k] ?? 0) - (y.prices[k] ?? 0));
    sellerIndex = { alive, by };
  }
  return sellerIndex.by.get(g) ?? [];
}

function produce(s: GameState, c: Company, acc: Map<number, DayAcc>, alive: Company[]) {
  const a = acc.get(c.id)!;
  const r = c.current;
  const needs = staffNeeds(c);
  const cap = adminCapacity(c);
  const load = adminLoad(c);
  const adminEff = load <= cap ? 1 : Math.max(0.5, Math.sqrt(cap / load));
  const secLevels = sectorLevels(c);
  const effLead = leadEffects.efficiency(c);
  const costLead = leadEffects.runningCost(c);

  const plans: { b: Building; m: MethodDef; scale: number }[] = [];
  const inputNeed: GoodMap = {};
  let employees = 0;
  for (const b of c.buildings) {
    if (b.level <= 0) { b.staffRatio = 0; b.efficiency = 0; b.lastOutput = {}; b.lastWages = 0; continue; }
    const m = methodOf(b.type, b.method);
    let needSum = 0, haveSum = 0, wages = 0;
    for (const j in m.staff) {
      const k = laborKey(b.city, j);
      const need = (m.staff[j as JobId] ?? 0) * b.level;
      const ratio = needs[k] ? Math.min(1, (c.employees[k] ?? 0) / needs[k]) : 1;
      const have = need * ratio;
      needSum += need;
      haveSum += have;
      wages += have * s.labor[k].wage * c.wagePolicy;
    }
    b.staffRatio = needSum > 0 ? haveSum / needSum : 1;
    b.efficiency = b.staffRatio * (BUILDING_BY_ID[b.type].usesAdmin ? adminEff : 1) * industryMult(c, b, secLevels) * effLead;
    b.lastWages = wages;
    const power = b.type === "datacenter" ? dcPowerCost(s, b.city) : 0;
    const running = ((wages + ((m.upkeep ?? 0) + carbonCost(s, b.type, b.method) + power) * b.level) * learningOverhead(c, b) * costLead + (b.type === "hq" ? hqUpkeep(c) : 0)) * DT;
    if (b.type === "rnd") r.rdCost += running;
    else if (b.type === "hq") r.sgaCost += running;
    else r.wages += running;
    a.cost += running;
    b.profitMTD -= running;
    employees += haveSum;
    const scale = b.level * b.efficiency * siteMult(b, s.worldEvents) * (b.disruptedUntil && b.disruptedUntil > s.day ? 0.5 : 1);
    plans.push({ b, m, scale });
    for (const g in m.output) {
      const out = m.output[g as GoodId]! * scale * DT;
      const rec = recipeOf(m, g as GoodId);
      for (const ig in rec) inputNeed[ig as GoodId] = (inputNeed[ig as GoodId] ?? 0) + rec[ig as GoodId]! * out;
    }
  }
  r.employees = employees;

  // Procurement: own stock → cheapest US seller → imports
  const fill: GoodMap = {};
  c.inputUse = {};
  for (const ig in inputNeed) {
    const igId = ig as GoodId;
    const need = inputNeed[igId]!;
    let got = 0, cost = 0;
    const own = Math.min(need, c.inventory[igId] ?? 0);
    c.inventory[igId] = (c.inventory[igId] ?? 0) - own;
    got += own;
    cost += own * (c.unitCost[igId] ?? GOOD_BY_ID[igId].refPrice * 0.6);
    const g = GOOD_BY_ID[igId];
    const imp = g.importPrice ? g.importPrice * importMult(s, igId) : undefined;
    const ceiling = imp ?? g.refPrice * 1.2;
    if (got < need) {
      for (const o of sellersOf(alive, igId)) {
        if (got >= need) break;
        if ((o.prices[igId] ?? Infinity) > ceiling) break;
        if (o === c || !((o.inventory[igId] ?? 0) > 0)) continue;
        const q = Math.min(need - got, o.inventory[igId] ?? 0);
        const p = o.prices[igId]!;
        o.inventory[igId] = (o.inventory[igId] ?? 0) - q;
        const oa = acc.get(o.id)!;
        oa.rev += q * p;
        o.current.revenue += q * p;
        o.current.revenueByGood[igId] = (o.current.revenueByGood[igId] ?? 0) + q * p;
        o.current.unitsSold[igId] = (o.current.unitsSold[igId] ?? 0) + q;
        oa.b2bSold[igId] = (oa.b2bSold[igId] ?? 0) + q;
        cost += q * p;
        got += q;
      }
    }
    if (got < need) {
      // Whatever's left comes from abroad, or from the wholesale market (the unmodeled "everyone else").
      const q = need - got;
      cost += q * (imp ?? (s.othersPrice[igId] ?? g.refPrice) * 1.05);
      got += q;
      if (imp) dayImports[igId] = (dayImports[igId] ?? 0) + q;
    }
    const bought = cost - own * (c.unitCost[igId] ?? GOOD_BY_ID[igId].refPrice * 0.6);
    r.inputCosts += bought;
    a.cost += bought;
    fill[igId] = need > 0 ? got / need : 1;
    c.inputUse[igId] = got;
    a.costOf[igId] = cost;
  }

  // Output
  const outputCost: GoodMap = {};
  c.dayProduced = {};
  for (const { b, m, scale } of plans) {
    b.lastOutput = {};
    for (const g in m.output) {
      const gId = g as GoodId;
      const rec = recipeOf(m, gId);
      let f = 1;
      for (const ig in rec) f = Math.min(f, fill[ig as GoodId] ?? 1);
      const monthlyRate = m.output[gId]! * scale * f;
      const q = monthlyRate * DT;
      b.lastOutput[gId] = monthlyRate;
      c.inventory[gId] = (c.inventory[gId] ?? 0) + q;
      c.dayProduced[gId] = (c.dayProduced[gId] ?? 0) + q;
      let unitInput = 0;
      for (const ig in rec) {
        const avg = (a.costOf[ig as GoodId] ?? 0) / Math.max(1e-9, c.inputUse[ig as GoodId] ?? 0);
        const fallback = GOOD_BY_ID[ig as GoodId].importPrice ?? (s.othersPrice[ig as GoodId] ?? GOOD_BY_ID[ig as GoodId].refPrice);
        unitInput += rec[ig as GoodId]! * (isFinite(avg) && avg > 0 ? avg : fallback);
      }
      let inputCost = q * unitInput;
      // Made abroad: tariffs and freight on the share that ends up in the US.
      if (s.cities[b.city]?.foreign) {
        // Intermediates mostly feed American plants (yours or others'); finished goods split by where demand is.
        const toUS = GOOD_BY_ID[gId].intermediate ? 0.5 : usShare(s, gId);
        const home = q * (c.prices[gId] ?? GOOD_BY_ID[gId].refPrice) * toUS * homeCostShare(s, b.city);
        inputCost += home;
        r.inputCosts += home;
        r.tariffs = (r.tariffs ?? 0) + home;
        a.cost += home;
      }
      b.profitMTD += q * (c.prices[gId] ?? 0) - inputCost;
      outputCost[gId] = (outputCost[gId] ?? 0) + inputCost + (b.lastWages + ((m.upkeep ?? 0) + carbonCost(s, b.type, b.method) + (b.type === "datacenter" ? dcPowerCost(s, b.city) : 0)) * b.level) * DT;
    }
  }
  for (const g in c.dayProduced) {
    const q = c.dayProduced[g as GoodId] ?? 0;
    if (q > 0) c.unitCost[g as GoodId] = (outputCost[g as GoodId] ?? 0) / q;
  }
}

function clearMarket(s: GameState, good: GoodId, alive: Company[], acc: Map<number, DayAcc>) {
  const g = GOOD_BY_ID[good];
  const prev = s.markets[good];
  const snap: MarketSnapshot = {
    good, demandUnits: 0, avgPrice: g.refPrice, othersPrice: s.othersPrice[good] ?? g.refPrice, othersShare: 1,
    sales: {}, importsUnits: (dayImports[good] ?? 0) * DAYS_PER_MONTH, exportsUnits: 0, priceHistory: prev?.priceHistory ?? [],
  };
  const offer = new Map<number, number>();
  const A = new Map<number, number>();
  let sumA = 0, sumAP = 0;
  for (const c of sellersOf(alive, good)) {
    const p = c.prices[good];
    if (!p || !((c.inventory[good] ?? 0) > 0)) continue;
    const o = Math.max(0, (c.inventory[good] ?? 0) - (c.inputUse[good] ?? 0));
    if (o <= 0) continue;
    offer.set(c.id, o);
    const a = attractiveness(s, c, good);
    A.set(c.id, a);
    sumA += a;
    sumAP += a * p;
  }
  const usSh = usShare(s, good);
  const op = (s.othersPrice[good] ?? g.refPrice) * foreignPriceMult(s, good, usSh);
  snap.othersPrice = op;
  const D0 = baseDemandUnits(s, good);
  const Ao = (s.othersWeight[good] ?? 0.5) * Math.pow(g.refPrice / op, g.priceSensitivity);
  const total = sumA + Ao;
  const avgPrice = (sumAP + Ao * op) / total;
  const Dm = D0 * (g.refPrice / avgPrice); // monthly rate
  const D = Dm * DT;
  snap.demandUnits = Dm;
  snap.avgPrice = avgPrice;

  const sold = new Map<number, number>();
  let unmet = 0;
  for (const [id, a] of A) {
    const want = (D * a) / total;
    const q = Math.min(want, offer.get(id) ?? 0);
    sold.set(id, q);
    unmet += want - q;
  }
  if (unmet > 0) {
    let remA = Ao;
    for (const [id, a] of A) if ((offer.get(id) ?? 0) > (sold.get(id) ?? 0)) remA += a;
    for (const [id, a] of A) {
      const left = (offer.get(id) ?? 0) - (sold.get(id) ?? 0);
      if (left > 0) sold.set(id, (sold.get(id) ?? 0) + Math.min(left, (unmet * a) / remA));
    }
  }
  let gameUnits = 0;
  for (const c of sellersOf(alive, good)) {
    const q = sold.get(c.id) ?? 0;
    const a = acc.get(c.id)!;
    const b2b = a.b2bSold[good] ?? 0;
    c.daySold[good] = q + b2b;
    if (q <= 0 && b2b <= 0) continue;
    const p = c.prices[good]!;
    if (q > 0) {
      c.inventory[good] = (c.inventory[good] ?? 0) - q;
      a.rev += q * p;
      c.current.revenue += q * p;
      c.current.revenueByGood[good] = (c.current.revenueByGood[good] ?? 0) + q * p;
      c.current.unitsSold[good] = (c.current.unitsSold[good] ?? 0) + q;
      gameUnits += q;
    }
    snap.sales[c.id] = { units: (q + b2b) * DAYS_PER_MONTH, revenue: (q + b2b) * p * DAYS_PER_MONTH, price: p, share: q / D };
  }
  snap.othersShare = Math.max(0, 1 - gameUnits / D);
  snap.exportsUnits = g.intermediate ? gameUnits * DAYS_PER_MONTH : 0;
  s.markets[good] = snap;
}

/** Unmodeled competitors cut prices when modeled companies take their share, and recover when they don't. */
function updateOthersPrices(s: GameState) {
  for (const g of MARKET_GOODS) {
    const snap = s.markets[g.id];
    if (!snap) continue;
    const start = s.othersShareStart[g.id] ?? snap.othersShare;
    const lost = Math.max(0, start - snap.othersShare);
    const target = g.refPrice * clamp(1 - 0.6 * lost, 0.6, 1) * (1 + s.macro.inflation * 0);
    const cur = s.othersPrice[g.id] ?? g.refPrice;
    s.othersPrice[g.id] = cur + (target - cur) * 0.05;
  }
}

// ---------------------------------------------------------------- finance

export function ttm(c: Company, key: keyof MonthReport, offset = 0): number {
  const h = c.history;
  const end = h.length - offset;
  let sum = 0;
  for (let i = Math.max(0, end - 12); i < end; i++) sum += (h[i][key] as number) ?? 0;
  return sum;
}

export function revenueGrowth(c: Company): number {
  if (c.history.length >= 24) {
    const prev = ttm(c, "revenue", 12);
    if (prev > 1e6) return ttm(c, "revenue") / prev - 1;
  }
  if (c.history.length >= 6) {
    const recent = c.history.slice(-3).reduce((a, h) => a + h.revenue, 0);
    const before = c.history.slice(-6, -3).reduce((a, h) => a + h.revenue, 0);
    if (before > 1e6) return clamp(Math.pow(recent / before, 4) - 1, -0.5, 2) * 0.5 + c.growthHint * 0.5;
  }
  return c.growthHint;
}

export function ebitdaTTM(c: Company): number {
  return ttm(c, "netIncome") + ttm(c, "taxes") + ttm(c, "interest") + ttm(c, "depreciation");
}

export function creditLimit(c: Company): number {
  return (Math.max(0, 3.5 * ebitdaTTM(c)) + 0.4 * c.ppe + 0.1 * c.marketCap) * leadEffects.credit(c);
}

export function interestRate(s: GameState, c: Company): number {
  const e = ebitdaTTM(c);
  const lev = e > 0 ? c.debt / e : c.debt > 0 ? 99 : 0;
  const spread = lev < 1 ? 0.01 : lev < 3 ? 0.025 : lev < 5 ? 0.05 : 0.09;
  return Math.max(0.005, s.baseRate + spread + leadEffects.interest(c));
}

/** What the market thinks the company is worth: earnings and sales multiples driven by growth, times sentiment, plus net cash. */
export function fundamentalValue(s: GameState, c: Company, hype = c.hype): number {
  const g = revenueGrowth(c);
  // Blend trailing twelve months with the annualized last quarter.
  const q = c.history.slice(-3);
  const runRate = (k: "revenue" | "netIncome") => (q.length ? (q.reduce((a, h) => a + h[k], 0) * 12) / q.length : 0);
  const rev = 0.5 * ttm(c, "revenue") * (12 / Math.max(1, Math.min(12, c.history.length))) + 0.5 * runRate("revenue");
  const ni = 0.5 * ttm(c, "netIncome") * (12 / Math.max(1, Math.min(12, c.history.length))) + 0.5 * runRate("netIncome");
  // Higher interest rates compress multiples.
  const rateAdj = clamp(1 - (s.baseRate - 0.05) * 5, 0.6, 1.3);
  const pe = clamp(15 + 40 * g, 10, 50) * rateAdj;
  const ps = clamp(1.5 + 8 * g, 0.5, 10) * rateAdj;
  let core = 0.65 * Math.max(0, ni * pe) + 0.35 * rev * ps;
  if (rev < 50e6) core = Math.max(core, (c.rndCum + c.ppe) * 1.0);
  return core * hype * (1 - conglomerateDiscount(c)) * leadEffects.valuation(c) + c.cash - c.debt + 0.2 * c.ppe;
}

function closeMonth(s: GameState) {
  for (const c of s.companies) {
    if (!c.alive) continue;
    const r = c.current;
    const lead = leadershipCost(c);
    r.sgaCost += lead;
    c.cash -= lead;
    r.marketing = r.revenue * c.marketingPct;
    const lobbyMonthly = c.lobbying.reduce((a, l) => a + l.monthly, 0);
    r.lobbying += lobbyMonthly;
    r.depreciation = c.ppe * DEPRECIATION;
    c.ppe += r.capex - r.depreciation;
    r.interest = (c.debt * interestRate(s, c)) / 12;
    const ebit = r.revenue - r.inputCosts - r.wages - r.rdCost - r.sgaCost - r.marketing - r.lobbying - r.depreciation;
    const pretax = ebit - r.interest;
    const stateRate = (STATE_BY_CODE[c.hq]?.corpTax ?? 6) / 100;
    const fed = corpTax(s);
    r.taxes = Math.max(0, pretax) * (fed + stateRate * (1 - fed));
    r.netIncome = pretax - r.taxes;
    c.rndCum += r.rdCost;
    c.cash -= r.marketing + lobbyMonthly + r.interest + r.taxes;
    // Quarter end: earnings vs. expectations, then dividends.
    const quarterEnd = ((s.month % 12) + 12) % 12 % 3 === 2;
    if (quarterEnd && c.history.length >= 5) earnings(s, c, r);
    if (quarterEnd && c.dividendPct > 0) {
      const qNI = r.netIncome + c.history.slice(-2).reduce((a, h) => a + h.netIncome, 0);
      if (qNI > 0) { r.dividends = qNI * c.dividendPct; c.cash -= r.dividends; }
    }
    if (c.cash < 0) { c.debt += -c.cash; c.cash = 0; }
    // Lenders look at net debt: cash on hand can always pay loans down.
    c.distressMonths = s.month > 0 && c.debt - c.cash > creditLimit(c) * 1.05 && c.debt > 1e6 ? c.distressMonths + 1 : 0;
    if (c.isPlayer && !warmup && c.distressMonths > 0 && c.distressMonths < 6) {
      log(s, `Net debt is over your credit limit (${fmtMoney(c.debt - c.cash)} vs ${fmtMoney(creditLimit(c))}). ${6 - c.distressMonths} month${c.distressMonths === 5 ? "" : "s"} left before default.`, "bad", c.id, "finance");
    }
    // Buildings: roll profit (operating, before depreciation).
    for (const b of c.buildings) { b.lastProfit = b.profitMTD; b.profitMTD = 0; }
    // Public image
    const emp = Object.values(c.employees).reduce((x, y) => x + y, 0);
    let gouge = 0, gw = 0;
    for (const g of Object.keys(c.prices) as GoodId[]) {
      if (!NEED_OF_GOOD[g] || !s.markets[g]) continue;
      const w = r.revenueByGood[g] ?? 0;
      gouge += Math.max(0, (c.prices[g]! / s.markets[g]!.avgPrice) - 1.3) * 0.5 * w;
      gw += w;
    }
    const imageTarget = clamp(0.6 + hqImageBonus(c) + leadEffects.image(c) + 0.4 * (c.wagePolicy - 1) - (emp > 0 ? (c.layoffs / emp) * 3 : 0) - (gw > 0 ? gouge / gw : 0), 0.05, 0.95);
    c.image += (imageTarget - c.image) * 0.1;
    if (c.isPlayer && emp > 0 && c.layoffs / emp > 0.05 && !warmup) log(s, `${c.name} laid off ${Math.round(c.layoffs).toLocaleString("en-US")} workers; the press noticed.`, "bad", c.id);
    c.layoffs = 0;
    // Books
    r.cash = c.cash;
    r.debt = c.debt;
    c.history.push(r);
    if (c.history.length > 240) c.history.shift();
    c.valuationTarget = Math.max(0.2 * (c.cash + c.ppe), fundamentalValue(s, c));
    c.hypeAnchor += (1 - c.hypeAnchor) * 0.005;
    c.hype = Math.max(0.2, c.hype + (c.hypeAnchor - c.hype) * 0.02 + 0.01 * randNormal(s) * Math.sqrt(c.hype));
    // Even bubbles have limits: very rich valuations on real profits deflate.
    const niT = ttm(c, "netIncome");
    if (niT > 0 && c.history.length >= 12 && c.marketCap / niT > 55) c.hype *= 0.97;
    r.marketCap = c.marketCap;
    r.sharePrice = c.marketCap / c.shares;
    c.current = emptyReport(monthOfDay(s.day), c);
  }
}

function earnings(s: GameState, c: Company, r: MonthReport) {
  // The quarter just closed: this month plus the two before it.
  const qMonths = [...c.history.slice(-2), r];
  const sumOf = (hs: MonthReport[], k: "revenue" | "netIncome") => hs.reduce((a, h) => a + h[k], 0);
  const q = sumOf(qMonths, "revenue"), qNI = sumOf(qMonths, "netIncome");
  const days = (hs: MonthReport[]) => hs.reduce((a, h) => a + (dayOfMonthStart(h.month + 1) - dayOfMonthStart(h.month)), 0);
  // Analysts compare with the same quarter last year when they can (no calendar effects),
  // otherwise with the previous quarter adjusted for its length.
  const yearAgo = c.history.slice(-14, -11);
  const prevQ = c.history.slice(-5, -2);
  let base: number, baseNI: number, years: number;
  if (yearAgo.length === 3 && sumOf(yearAgo, "revenue") > 1e6) {
    base = sumOf(yearAgo, "revenue"); baseNI = sumOf(yearAgo, "netIncome"); years = 1;
  } else {
    const k = days(qMonths) / Math.max(1, days(prevQ));
    base = sumOf(prevQ, "revenue") * k; baseNI = sumOf(prevQ, "netIncome") * k; years = 0.25;
  }
  if (base <= 1e6) return;
  // Consensus: last year's trend, slightly conservative (companies guide low), shaded by the CFO.
  const gExp = c.growthHint;
  // Guidance: what the CFO told Wall Street to expect.
  const guide = c.guidance === "low" ? 0.97 : c.guidance === "high" ? 1.03 : 1;
  const shade = 0.985 * leadEffects.expectations(c) * guide;
  const expected = base * Math.pow(1 + gExp, years) * shade;
  // Margin: what the last two quarters before this one showed (fresher than a year ago).
  const recent = c.history.slice(-8, -2);
  const recentRev = sumOf(recent, "revenue");
  const trailingMargin = clamp(recentRev > 1e6 ? sumOf(recent, "netIncome") / recentRev : baseNI / base, -1, 0.6);
  const expectedNI = expected * trailingMargin * shade;
  const revSurprise = q / expected - 1;
  const niSurprise = clamp((qNI - expectedNI) / Math.max(Math.abs(expectedNI), 0.03 * expected), -0.5, 0.5);
  const surprise = 0.7 * revSurprise + 0.3 * clamp(niSurprise, -0.25, 0.25) * 0.4;
  // Analysts update their growth view toward what actually happened.
  const realized = years === 1 ? q / base - 1 : Math.pow(Math.max(0.01, q / base), 4) - 1;
  c.growthHint = clamp(c.growthHint + (clamp(realized, -0.5, 2) - c.growthHint) * 0.5, -0.3, 1.5);
  const qi = Math.floor((((s.month % 12) + 12) % 12) / 3) + 1;
  const year = 2026 + Math.floor(s.month / 12);
  const verdict = surprise > 0.01 ? "beat" : surprise < -0.01 ? "missed" : "met";
  c.lastEarnings = { quarter: `Q${qi} ${year}`, revenue: q, expected, surprise, netIncome: qNI, expectedNI, revSurprise, niSurprise, verdict };
  const kick = verdict === "met" ? surprise : clamp(surprise * 2, -0.08, 0.08);
  c.hype *= 1 + kick;
  c.marketCap *= 1 + kick;
  if (!warmup && (c.isPlayer || (Math.abs(surprise) > 0.05 && c.marketCap > 200e9))) {
    const earned = qNI >= 0 ? `earned ${fmtMoney(qNI)}` : `lost ${fmtMoney(-qNI)}`;
    const vs = `revenue ${fmtMoney(q)} vs ${fmtMoney(expected)} expected, profit ${fmtMoney(qNI)} vs ${fmtMoney(expectedNI)}`;
    const tail = verdict === "beat" ? "Stock jumps." : verdict === "missed" ? "Stock slides." : "Stock little changed.";
    log(s, `${c.name} ${earned} in Q${qi} and ${verdict} estimates (${vs}). ${tail}`, verdict === "missed" ? "bad" : verdict === "beat" ? "good" : "info", c.id, c.isPlayer ? "finance" : undefined);
  }
}

// ---------------------------------------------------------------- research & brand

const techRevCache = new WeakMap<Company, { len: number; last: MonthReport | undefined; by: Map<TechId, number> }>();
export function revenueByTech(c: Company, t: TechId): number {
  const last = c.history[c.history.length - 1];
  let e = techRevCache.get(c);
  if (!e || e.len !== c.history.length || e.last !== last) { e = { len: c.history.length, last, by: new Map() }; techRevCache.set(c, e); }
  const hit = e.by.get(t);
  if (hit !== undefined) return hit;
  const tech = TECHS.find((x) => x.id === t)!;
  let rev = 0;
  for (const h of c.history.slice(-12)) for (const g of tech.goods) rev += h.revenueByGood[g] ?? 0;
  e.by.set(t, rev);
  return rev;
}

export function researchCost(s: GameState, c: Company, t: TechId): number {
  const lead = Math.max(0, (c.tech[t] ?? 0) - (s.baselineTech[t] ?? BASELINE_TECH_START));
  return 45 * Math.pow(1 + revenueByTech(c, t) / 1e8, 0.7) * Math.pow(1.4, lead);
}

export function researchOutput(c: Company): number {
  let pts = 0;
  for (const b of c.buildings) if (b.type === "rnd") pts += (methodOf(b.type, b.method).research ?? 0) * b.level * b.efficiency;
  return pts * hqResearchMult(c);
}

function research(s: GameState, c: Company, dt: number) {
  // Spillover: suppliers, consultants and new hires bring standard practice, so nobody falls more than a level behind.
  for (const t in c.tech) {
    const floor = (s.baselineTech[t as TechId] ?? BASELINE_TECH_START) - 1;
    if ((c.tech[t as TechId] ?? floor) < floor) c.tech[t as TechId] = Math.min(floor, c.tech[t as TechId]! + (1.2 * dt) / 12);
  }
  const pts = researchOutput(c) * dt * leadEffects.research(c);
  if (pts <= 0) return;
  let wsum = 0;
  for (const t in c.researchAlloc) wsum += c.researchAlloc[t as TechId] ?? 0;
  if (wsum <= 0) return;
  for (const t in c.researchAlloc) {
    const w = c.researchAlloc[t as TechId] ?? 0;
    if (w <= 0) continue;
    const tid = t as TechId;
    c.researchPoints[tid] = (c.researchPoints[tid] ?? 0) + (pts * w) / wsum;
    const cost = researchCost(s, c, tid);
    if ((c.researchPoints[tid] ?? 0) >= cost) {
      c.researchPoints[tid]! -= cost;
      c.tech[tid] = (c.tech[tid] ?? BASELINE_TECH_START) + 1;
      if (c.isPlayer && !warmup) log(s, `Research breakthrough: ${TECHS.find((x) => x.id === tid)!.name} reached level ${(c.tech[tid] ?? 0).toFixed(1)}.`, "good", c.id);
    }
  }
}

function updateBrand(s: GameState, c: Company) {
  for (const g of Object.keys(c.prices) as GoodId[]) {
    const target = brandTarget(s, c, g);
    const cur = c.brand[g] ?? BRAND_FLOOR;
    c.brand[g] = cur + (target - cur) * 0.04;
  }
}

// ---------------------------------------------------------------- events

export function log(s: GameState, text: string, kind: "info" | "good" | "bad" | "deal" | "politics" = "info", companyId?: number, tag?: EventTag,
  extra?: Pick<GameEvent, "headline" | "deck" | "cert">) {
  const auto = extra?.headline ? undefined : headlineFor(text, tag);
  s.events.push({ day: s.day, text, kind, companyId, ...(tag ? { tag } : {}), ...(auto ?? {}), ...(extra ?? {}) });
  if (s.events.length > 400) s.events.shift();
}

export function player(s: GameState): Company {
  return s.companies.find((c) => c.id === s.playerId)!;
}

export function queueConstruction(s: GameState, c: Company, b: Building, levels: number, months?: number) {
  const def = BUILDING_BY_ID[b.type];
  const days = Math.max(1, Math.round((months ?? def.buildTime * (warmup || s.day < 0 ? 1 : permitMult(s, b.city, c) * leadEffects.construction(c))) * DAYS_PER_MONTH));
  const total = buildCostPerLevel(s, b.type, b.city, b.method, true, c) * levels;
  b.construction.push({ levels, daysLeft: days, totalDays: days, dailyCost: total / days });
}

function maybeSpawnStartup(s: GameState) {
  if (rand(s) > 1 / 7) return;
  const goods: GoodId[] = ["software", "software", "data_platforms", "cloud", "evs", "batteries", "chips", "ai_accelerators", "smartphones",
    "digital_ads", "groceries", "apparel", "streaming", "pharmaceuticals", "pharmaceuticals", "electricity",
    "crude_oil", "natural_gas", "steel", "crops", "solar_panels", "household_goods", "video_games", "meals_fast", "meals_casual", "beverages", "homes",
    "medical_devices", "lithium", "rare_earths", "furniture", "logistics", "defense"];
  const good = pick(s, goods);
  const techy = ["software", "data_platforms", "cloud", "ai_accelerators", "digital_ads", "streaming", "pharmaceuticals"].includes(good);
  const weights = STATES.map((st) => st.population * Math.pow(techy ? st.techIndex : st.mfgIndex, 3));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let r = rand(s) * wsum;
  let hq = STATES[0].code;
  for (let i = 0; i < STATES.length; i++) { r -= weights[i]; if (r <= 0) { hq = STATES[i].code; break; } }
  const used = new Set(s.companies.map((c) => c.name));
  let name = "";
  for (let i = 0; i < 20 && (!name || used.has(name)); i++) name = `${pick(s, STARTUP_PREFIX)} ${pick(s, STARTUP_SUFFIX[good] ?? ["Labs"])}`;
  if (used.has(name)) return;
  const ticker = name.replace(/[^A-Z]/g, "").slice(0, 2) + name.split(" ")[1].slice(0, 2).toUpperCase();
  const cash = (40 + rand(s) * 160) * 1e6;
  const c = createStartup(s, { name, ticker, good, hq, city: defaultCity(s, hq, "hq"), cash });
  for (const [k, need] of Object.entries(staffNeeds(c))) {
    const cell = s.labor[k];
    if (!cell) continue;
    const q = Math.min(need, Math.max(0, cell.workforce - cell.gameEmployed) * HIRE_RATE);
    c.employees[k] = q;
    cell.gameEmployed += q;
  }
  c.brand[good] = brandTarget(s, c, good) * 0.4;
  c.marketCap = cash * (2 + rand(s) * 3);
  c.valuationTarget = c.marketCap;
  c.hype = 2;
  c.hypeAnchor = 1.5;
  s.companies.push(c);
  log(s, `New startup: ${name} (${GOOD_BY_ID[good].name}) raised ${fmtMoney(cash)} in ${STATE_BY_CODE[hq].name}.`, "info", c.id);
}

export function releaseCompany(s: GameState, c: Company) {
  for (const [k, n] of Object.entries(c.employees)) if (s.labor[k]) s.labor[k].gameEmployed -= n;
  c.employees = {};
  c.alive = false;
}

function checkSolvency(s: GameState) {
  for (const c of s.companies) {
    if (!c.alive || c.distressMonths < 6) continue;
    if (c.isPlayer) {
      s.gameOver = `${c.name} defaulted on its debt and was forced into Chapter 11 in ${dateLabel(s.month)}.`;
      log(s, s.gameOver, "bad", c.id);
    } else {
      releaseCompany(s, c);
      log(s, `${c.name} filed for bankruptcy and was liquidated.`, "bad", c.id);
    }
  }
}

const lastTier = new WeakMap<Company, string>();
function checkTiers(s: GameState) {
  const p = player(s);
  if (!p) return;
  const t = tierOf(p.marketCap).id;
  const prev = lastTier.get(p);
  if (prev && prev !== t) log(s, `${p.name} is now in the ${tierOf(p.marketCap).name} tier.`, "deal", p.id, "tier");
  lastTier.set(p, t);
}

export { JOBS };
