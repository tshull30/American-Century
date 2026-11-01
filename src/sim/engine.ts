import { BUILDINGS, BUILDING_BY_ID, methodOf, type BuildingTypeId } from "./data/buildings";
import { COMPANY_SEEDS, STARTUP_PREFIX, STARTUP_SUFFIX, type CompanySeed } from "./data/companies";
import { GOODS, GOOD_BY_ID, TECHS, type GoodId, type TechId } from "./data/goods";
import { JOBS, JOB_BY_ID, type JobId } from "./data/jobs";
import { STATES, STATE_BY_CODE } from "./data/states";
import { generatePops } from "./pops";
import { tierOf } from "./tiers";
import type { Building, Company, GameState, GoodMap, LaborCell, MarketSnapshot, MonthReport } from "./types";
import { clamp, dateLabel, fmtMoney, laborKey, pick, rand, randNormal, shuffle } from "./util";
import { runAI, autoPrice } from "./ai";

export const SAVE_VERSION = 1;
export const BASELINE_TECH_START = 10;
const FED_TAX = 0.21;
const DEPRECIATION = 0.006;
/** Share of a labor pool not already working for a game company that can be hired in one month. */
const HIRE_RATE = 0.05;
const WARMUP_MONTHS = 12;
const MARKET_GOODS = GOODS.filter((g) => g.marketUS + g.marketWorld > 0);
/** Units imported this tick, by good (reset every tick). */
let tickImports: GoodMap = {};

// ---------------------------------------------------------------- new game

export type PlayerChoice =
  | { kind: "incumbent"; key: string }
  | { kind: "startup"; name: string; ticker: string; good: GoodId; hq: string };

export function newGame(choice: PlayerChoice, seed = Math.floor(Math.random() * 1e9)): GameState {
  const pops = generatePops();
  const labor: Record<string, LaborCell> = {};
  for (const p of pops) {
    const k = laborKey(p.state, p.job);
    if (!labor[k]) {
      labor[k] = {
        state: p.state, job: p.job, workforce: 0, gameEmployed: 0, shortage: 0,
        wage: JOB_BY_ID[p.job].baseWage * STATE_BY_CODE[p.state].wageIndex,
      };
    }
    labor[k].workforce += p.workers;
  }

  const s: GameState = {
    version: SAVE_VERSION, seed, rng: seed | 0, month: -WARMUP_MONTHS, startMonth: 0, playerId: -1,
    pops, labor, companies: [], demandScale: {}, othersWeight: {}, othersPrice: {}, othersShareStart: {},
    marketGrowth: {}, baselineTech: {}, markets: {}, baseRate: 0.045, wageInflation: 1, events: [], nextId: 1,
  };
  for (const t of TECHS) s.baselineTech[t.id] = BASELINE_TECH_START;
  for (const g of GOODS) { s.othersPrice[g.id] = g.refPrice; s.marketGrowth[g.id] = 1; }

  for (const seedDef of COMPANY_SEEDS) {
    const c = companyFromSeed(s, seedDef);
    if (choice.kind === "incumbent" && choice.key === seedDef.key) { c.isPlayer = true; s.playerId = c.id; }
    s.companies.push(c);
  }
  let startupValuation = 0;
  if (choice.kind === "startup") {
    const c = createStartup(s, { name: choice.name, ticker: choice.ticker, good: choice.good, hq: choice.hq, cash: 80e6, isPlayer: true });
    startupValuation = 160e6;
    s.companies.push(c);
    s.playerId = c.id;
  }

  // Everyone starts fully staffed.
  for (const c of s.companies) {
    for (const [k, need] of Object.entries(staffNeeds(c))) {
      c.employees[k] = need;
      s.labor[k].gameEmployed += need;
    }
  }

  calibrateDemand(s);
  seedBrands(s);
  calibrateOthers(s);

  // Warm-up year (2025): the economy runs so every company has a year of history.
  while (s.month < 0) tick(s, { warmup: true });
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
    const seedDef = COMPANY_SEEDS.find((d) => d.name === c.name);
    const target = seedDef ? seedDef.marketCap : c.isPlayer ? startupValuation : c.marketCap;
    const fundamental = fundamentalValue(s, c, 1);
    const core = fundamental - (c.cash - c.debt);
    c.hype = core > 0 ? clamp((target - (c.cash - c.debt)) / core, 0.2, 60) : 1;
    c.hypeAnchor = c.hype;
    c.marketCap = target;
  }
  s.events = [];
  log(s, `Welcome to ${dateLabel(0)}. You are running ${player(s).name}.`, "info", s.playerId);
  return s;
}

function blankCompany(s: GameState, name: string, ticker: string, hq: string): Company {
  return {
    id: s.nextId++, name, ticker, color: "#cccccc", tagline: "", hq, isPlayer: false, alive: true, foundedMonth: s.month,
    cash: 0, debt: 0, shares: 1e8, marketCap: 0, hype: 1, hypeAnchor: 1, ppe: 0, reputation: {}, buildings: [], inventory: {}, prices: {}, autoPrice: {},
    wagePolicy: 1, marketingPct: 0.03, brand: {}, tech: { ...s.baselineTech }, researchPoints: {}, researchAlloc: {},
    employees: {}, history: [], distressMonths: 0, unitCost: {}, inputUse: {}, growthHint: 0.1, rndIntensity: 0.1,
    rndCum: 0, kind: "startup",
  };
}

export function addBuilding(s: GameState, c: Company, type: BuildingTypeId, state: string, level: number, method?: string): Building {
  const def = BUILDING_BY_ID[type];
  const b: Building = {
    id: s.nextId++, type, state, method: method ?? def.methods[0].id, level, construction: [],
    staffRatio: 1, efficiency: 1, lastOutput: {}, lastWages: 0,
  };
  c.buildings.push(b);
  c.ppe += buildCostPerLevel(type, state) * level;
  return b;
}

export function buildCostPerLevel(type: BuildingTypeId, state: string): number {
  return BUILDING_BY_ID[type].cost * (0.7 + 0.3 * STATE_BY_CODE[state].wageIndex);
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
    inspiredBy: d.inspiredBy, foundedMonth: -120,
  });
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
    for (const [st, lv] of spread(levels, p.states)) {
      const b = addBuilding(s, c, prod.type, st, lv, prod.method);
      if (p.building) queueConstruction(s, c, b, Math.round((p.building.levels * lv) / levels) || 1, p.building.monthsLeft);
    }
    c.inventory[p.good] = (units / 12) * 0.3;
  }
  for (const e of d.extraBuildings ?? []) {
    const b = addBuilding(s, c, e.type, e.state, e.levels, e.method);
    if (e.underConstruction) queueConstruction(s, c, b, e.underConstruction, e.monthsLeft ?? 6);
    for (const g of Object.keys(methodOf(e.type, b.method).output) as GoodId[]) {
      c.prices[g] = GOOD_BY_ID[g].refPrice * (d.priceMult[g] ?? 1);
      c.autoPrice[g] = true;
      c.reputation[g] = 0.5 + 0.5 * (d.brand[g] ?? 1);
    }
  }
  // R&D labs
  const lab = methodOf("rnd", "rnd");
  const labCost = labMonthlyCost(lab);
  const rndLevels = d.rndLevels ?? Math.max(1, Math.round((d.rndIntensity * annualRevenue) / 12 / labCost));
  for (const [st, lv] of spread(rndLevels, d.rndStates)) addBuilding(s, c, "rnd", st, lv);
  ensureHQ(s, c);
  // Research allocation follows revenue.
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
  // Research priorities on a 0–10 scale.
  const maxW = Math.max(0, ...Object.values(c.researchAlloc).map((w) => w ?? 0));
  if (maxW > 0) for (const t of Object.keys(c.researchAlloc) as TechId[]) c.researchAlloc[t] = Math.max(1, Math.round((c.researchAlloc[t]! / maxW) * 10));
  c.growthHint = d.tier === "startup" ? 0.6 : d.key === "verdant" ? 0.5 : d.key === "seerstone" ? 0.4 : d.key === "cumulus" ? 0.8 : 0.08;
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
  let cap = 5;
  for (const b of c.buildings) cap += (methodOf(b.type, b.method).admin ?? 0) * b.level;
  return cap;
}
export function adminLoad(c: Company): number {
  let load = 0;
  for (const b of c.buildings) if (BUILDING_BY_ID[b.type].usesAdmin) load += b.level + b.construction.reduce((a, x) => a + x.levels, 0);
  return load;
}

function ensureHQ(s: GameState, c: Company) {
  const needed = Math.ceil(Math.max(0, adminLoad(c) * 1.05 - 5) / 15);
  if (needed <= 0) { addBuilding(s, c, "hq", c.hq, 1); return; }
  addBuilding(s, c, "hq", c.hq, needed);
}

export function createStartup(
  s: GameState,
  o: { name: string; ticker: string; good: GoodId; hq: string; cash: number; isPlayer?: boolean },
): Company {
  const c = blankCompany(s, o.name, o.ticker, o.hq);
  c.isPlayer = !!o.isPlayer;
  c.cash = o.cash;
  c.shares = 20e6;
  c.marketCap = o.cash * 2;
  c.kind = "startup";
  c.color = o.isPlayer ? "#ffca28" : `hsl(${Math.floor(rand(s) * 360)} 45% 65%)`;
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
  addBuilding(s, c, prod.type, o.hq, 1, prod.method);
  addBuilding(s, c, "rnd", o.hq, 3);
  addBuilding(s, c, "hq", o.hq, 1);
  return c;
}

/** Turns weighted US spending power into units, so each US market matches its target size at reference prices. */
function calibrateDemand(s: GameState) {
  for (const g of MARKET_GOODS) {
    const sp = spendingPower(s, g.id);
    s.demandScale[g.id] = sp > 0 ? g.marketUS / 12 / g.refPrice / sp : 0;
  }
}

export const BRAND_FLOOR = 0.00001;

export function marketingMult(c: Company): number {
  return 0.7 + 3 * Math.sqrt(Math.max(0, c.marketingPct));
}

/** Share of the market a company can supply from its own (efficiency-adjusted) capacity, net of what it uses itself. */
export function supplyShare(s: GameState, c: Company, g: GoodId): number {
  const D0 = baseDemandUnits(s, g);
  if (D0 <= 0) return 0;
  let q = 0;
  for (const b of c.buildings) q += (methodOf(b.type, b.method).output[g] ?? 0) * b.level * b.efficiency;
  q -= c.inputUse[g] ?? 0;
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

/**
 * The firms not modeled individually (the rest of the world's phone makers, automakers...)
 * get a fixed slice of brand weight: whatever share of supply modeled companies don't cover at start.
 * It stays put, so taking share from them means out-competing them, not just out-building them.
 */
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
      // A company with nothing to sell yet (still building) gets a small head start.
      c.brand[g] = t > BRAND_FLOOR ? t * (c.isPlayer && c.kind === "startup" ? 0.4 : 1) : BRAND_FLOOR * 100;
    }
  }
}

export function companyCapacity(c: Company, g: GoodId): number {
  let cap = 0;
  for (const b of c.buildings) cap += (methodOf(b.type, b.method).output[g] ?? 0) * b.level;
  return cap;
}

// ---------------------------------------------------------------- demand

const spendCache = new WeakMap<GameState, { month: number; values: GoodMap }>();

/** Population-weighted, income-adjusted spending power for a good across all US pops. */
export function spendingPower(s: GameState, good: GoodId): number {
  const cached = spendCache.get(s);
  if (cached && cached.month === s.month && cached.values[good] !== undefined) return cached.values[good]!;
  const g = GOOD_BY_ID[good];
  const avgWage = 5200;
  let total = 0;
  const jobs = g.buyerJobs ? new Set(g.buyerJobs) : null;
  for (const p of s.pops) {
    if (jobs && !jobs.has(p.job)) continue;
    const wage = s.labor[laborKey(p.state, p.job)].wage;
    const people = jobs ? p.workers : p.workers + p.dependents;
    total += people * Math.pow(wage / avgWage, g.incomeElasticity);
  }
  const entry = cached && cached.month === s.month ? cached : { month: s.month, values: {} as GoodMap };
  entry.values[good] = total;
  spendCache.set(s, entry);
  return total;
}

export function baseDemandUnits(s: GameState, good: GoodId): number {
  const g = GOOD_BY_ID[good];
  const us = (s.demandScale[good] ?? 0) * spendingPower(s, good);
  const world = g.marketWorld / 12 / g.refPrice;
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
  return Math.pow(quality(s, c, good), 2) * (c.reputation[good] ?? 1) * (c.brand[good] ?? BRAND_FLOOR) * Math.pow(g.refPrice / p, g.priceSensitivity);
}

// ---------------------------------------------------------------- labor

export function staffNeeds(c: Company): Record<string, number> {
  const needs: Record<string, number> = {};
  for (const b of c.buildings) {
    if (b.level <= 0) continue;
    const m = methodOf(b.type, b.method);
    for (const [j, n] of Object.entries(m.staff)) {
      const k = laborKey(b.state, j);
      needs[k] = (needs[k] ?? 0) + (n ?? 0) * b.level;
    }
  }
  return needs;
}

function updateLabor(s: GameState) {
  const alive = s.companies.filter((c) => c.alive);
  const requests: Record<string, { c: Company; want: number }[]> = {};
  for (const cell of Object.values(s.labor)) cell.shortage = 0;
  for (const c of alive) {
    const needs = staffNeeds(c);
    for (const k of Object.keys(c.employees)) {
      const need = needs[k] ?? 0;
      if (c.employees[k] > need) {
        s.labor[k].gameEmployed -= c.employees[k] - need;
        c.employees[k] = need;
      }
      if (c.employees[k] <= 0) delete c.employees[k];
    }
    for (const [k, need] of Object.entries(needs)) {
      const have = c.employees[k] ?? 0;
      if (need > have) (requests[k] ??= []).push({ c, want: need - have });
    }
  }
  for (const [k, reqs] of Object.entries(requests)) {
    const cell = s.labor[k];
    if (!cell) continue;
    let available = Math.max(0, cell.workforce - cell.gameEmployed) * HIRE_RATE;
    const weights = reqs.map((r) => r.want * Math.pow(r.c.wagePolicy, 4));
    const wsum = weights.reduce((a, b) => a + b, 0);
    let wanted = 0;
    reqs.forEach((r, i) => {
      wanted += r.want;
      const grant = Math.min(r.want, (available * weights[i]) / wsum);
      r.c.employees[k] = (r.c.employees[k] ?? 0) + grant;
      cell.gameEmployed += grant;
      r.want -= grant;
    });
    available = Math.max(0, cell.workforce - cell.gameEmployed) * HIRE_RATE - wanted;
    cell.shortage = reqs.reduce((a, r) => a + r.want, 0);
  }
  for (const cell of Object.values(s.labor)) {
    const base = JOB_BY_ID[cell.job].baseWage * STATE_BY_CODE[cell.state].wageIndex;
    const share = cell.gameEmployed / Math.max(1, cell.workforce);
    const tight = Math.min(1, cell.shortage / Math.max(1, cell.workforce * HIRE_RATE));
    const target = base * (1 + 1.5 * Math.pow(share, 1.2) + 0.25 * tight) * s.wageInflation;
    cell.wage += (target - cell.wage) * 0.1;
  }
}

// ---------------------------------------------------------------- the monthly tick

interface Acc {
  report: MonthReport;
  potential: GoodMap;
  produced: GoodMap;
  b2bSold: GoodMap;
  costOf: GoodMap;
}

function emptyReport(s: GameState, c: Company): MonthReport {
  return {
    month: s.month, revenue: 0, revenueByGood: {}, unitsSold: {}, inputCosts: 0, wages: 0, rdCost: 0, sgaCost: 0,
    marketing: 0, depreciation: 0, interest: 0, taxes: 0, netIncome: 0, capex: 0, cash: 0, debt: 0,
    marketCap: c.marketCap, sharePrice: 0, employees: 0,
  };
}

export function tick(s: GameState, opts: { warmup?: boolean } = {}) {
  if (s.gameOver) return;
  s.month++;
  tickImports = {};
  const alive = s.companies.filter((c) => c.alive);
  const acc = new Map<number, Acc>();
  for (const c of alive) acc.set(c.id, { report: emptyReport(s, c), potential: {}, produced: {}, b2bSold: {}, costOf: {} });

  // 1. Construction
  for (const c of alive) {
    const a = acc.get(c.id)!;
    for (const b of c.buildings) {
      for (const job of b.construction) {
        a.report.capex += job.monthlyCost;
        job.monthsLeft--;
        if (job.monthsLeft <= 0) {
          b.level += job.levels;
          if (c.isPlayer && !opts.warmup) log(s, `Construction finished: +${job.levels} ${BUILDING_BY_ID[b.type].name} level${job.levels > 1 ? "s" : ""} in ${STATE_BY_CODE[b.state].name}.`, "good", c.id);
        }
      }
      b.construction = b.construction.filter((j) => j.monthsLeft > 0);
    }
    c.buildings = c.buildings.filter((b) => b.level > 0 || b.construction.length > 0);
  }

  // 2. Labor market
  updateLabor(s);

  // 3. Production and input procurement
  const order = shuffle(s, alive);
  for (const c of order) produce(s, c, acc, alive);

  // 4. Markets
  for (const g of MARKET_GOODS) clearMarket(s, g.id, alive, acc);

  // 5. Inventory decay
  for (const c of alive) for (const g of Object.keys(c.inventory) as GoodId[]) {
    c.inventory[g] = (c.inventory[g] ?? 0) * (1 - GOOD_BY_ID[g].decay);
    if ((c.inventory[g] ?? 0) < 1e-6) delete c.inventory[g];
  }

  // 6. Finance
  for (const c of alive) settleFinances(s, c, acc.get(c.id)!.report);

  // 7. Research, brands, market growth
  for (const c of alive) research(s, c);
  for (const t of TECHS) s.baselineTech[t.id] = (s.baselineTech[t.id] ?? BASELINE_TECH_START) + 1 / 12;
  for (const c of alive) updateBrand(s, c);
  const years = Math.max(0, s.month) / 12;
  for (const g of MARKET_GOODS) {
    const growth = 0.03 + (g.growth - 0.03) * Math.pow(0.85, years);
    s.marketGrowth[g.id] = (s.marketGrowth[g.id] ?? 1) * (1 + growth / 12);
  }
  updateOthersPrices(s);

  // 8. Decisions
  for (const c of alive) {
    for (const g of Object.keys(c.prices) as GoodId[]) if (c.isPlayer ? c.autoPrice[g] : true) autoPrice(s, c, g);
    if (!c.isPlayer) runAI(s, c, { warmup: !!opts.warmup });
  }

  // 9. World events
  if (!opts.warmup) {
    maybeSpawnStartup(s);
    checkSolvency(s);
    checkTiers(s);
  }
}

function produce(s: GameState, c: Company, acc: Map<number, Acc>, alive: Company[]) {
  const a = acc.get(c.id)!;
  const r = a.report;
  const needs = staffNeeds(c);
  const cellRatio = (k: string) => (needs[k] ? Math.min(1, (c.employees[k] ?? 0) / needs[k]) : 1);
  const cap = adminCapacity(c);
  const load = adminLoad(c);
  const adminEff = load <= cap ? 1 : Math.max(0.5, Math.sqrt(cap / load));

  // Staffing and potential output
  const plans: { b: Building; scale: number }[] = [];
  const inputNeed: GoodMap = {};
  for (const b of c.buildings) {
    if (b.level <= 0) { b.staffRatio = 0; b.efficiency = 0; b.lastOutput = {}; b.lastWages = 0; continue; }
    const m = methodOf(b.type, b.method);
    let needSum = 0, haveSum = 0, wages = 0;
    for (const [j, n] of Object.entries(m.staff)) {
      const k = laborKey(b.state, j);
      const need = (n ?? 0) * b.level;
      const have = need * cellRatio(k);
      needSum += need;
      haveSum += have;
      wages += have * s.labor[k].wage * c.wagePolicy;
    }
    b.staffRatio = needSum > 0 ? haveSum / needSum : 1;
    b.efficiency = b.staffRatio * (BUILDING_BY_ID[b.type].usesAdmin ? adminEff : 1);
    b.lastWages = wages;
    const upkeep = (m.upkeep ?? 0) * b.level;
    if (b.type === "rnd") r.rdCost += wages + upkeep;
    else if (b.type === "hq") r.sgaCost += wages + upkeep;
    else r.wages += wages + upkeep;
    r.employees += haveSum;
    const scale = b.level * b.efficiency;
    plans.push({ b, scale });
    for (const [g, out] of Object.entries(m.output) as [GoodId, number][]) {
      a.potential[g] = (a.potential[g] ?? 0) + out * scale;
      for (const [ig, q] of Object.entries(GOOD_BY_ID[g].recipe) as [GoodId, number][]) {
        inputNeed[ig] = (inputNeed[ig] ?? 0) + q * out * scale;
      }
    }
  }

  // Procurement: own stock → cheapest US seller → imports
  const fill: GoodMap = {};
  c.inputUse = {};
  for (const [ig, need] of Object.entries(inputNeed) as [GoodId, number][]) {
    let got = 0;
    let cost = 0;
    const own = Math.min(need, c.inventory[ig] ?? 0);
    c.inventory[ig] = (c.inventory[ig] ?? 0) - own;
    got += own;
    // value own-made inputs at their production cost for unit-cost accounting
    cost += own * (c.unitCost[ig] ?? GOOD_BY_ID[ig].refPrice * 0.6);
    const g = GOOD_BY_ID[ig];
    const ceiling = g.importPrice ?? g.refPrice * 1.2;
    const sellers = alive
      .filter((o) => o !== c && (o.inventory[ig] ?? 0) > 0 && (o.prices[ig] ?? Infinity) <= ceiling)
      .sort((x, y) => (x.prices[ig] ?? 0) - (y.prices[ig] ?? 0));
    for (const o of sellers) {
      if (got >= need) break;
      const q = Math.min(need - got, o.inventory[ig] ?? 0);
      const p = o.prices[ig]!;
      o.inventory[ig] = (o.inventory[ig] ?? 0) - q;
      const oa = acc.get(o.id)!;
      oa.report.revenue += q * p;
      oa.report.revenueByGood[ig] = (oa.report.revenueByGood[ig] ?? 0) + q * p;
      oa.report.unitsSold[ig] = (oa.report.unitsSold[ig] ?? 0) + q;
      oa.b2bSold[ig] = (oa.b2bSold[ig] ?? 0) + q;
      r.inputCosts += q * p;
      cost += q * p;
      got += q;
    }
    if (got < need && g.importPrice) {
      const q = need - got;
      r.inputCosts += q * g.importPrice;
      cost += q * g.importPrice;
      got += q;
      tickImports[ig] = (tickImports[ig] ?? 0) + q;
    }
    fill[ig] = need > 0 ? got / need : 1;
    c.inputUse[ig] = got;
    a.costOf[ig] = cost;
  }

  // Output
  const outputCost: GoodMap = {};
  for (const { b, scale } of plans) {
    const m = methodOf(b.type, b.method);
    b.lastOutput = {};
    for (const [g, out] of Object.entries(m.output) as [GoodId, number][]) {
      let f = 1;
      for (const ig of Object.keys(GOOD_BY_ID[g].recipe) as GoodId[]) f = Math.min(f, fill[ig] ?? 1);
      const q = out * scale * f;
      b.lastOutput[g] = q;
      c.inventory[g] = (c.inventory[g] ?? 0) + q;
      a.produced[g] = (a.produced[g] ?? 0) + q;
      let unitInput = 0;
      for (const [ig, qq] of Object.entries(GOOD_BY_ID[g].recipe) as [GoodId, number][]) {
        const avg = (a.costOf[ig] ?? 0) / Math.max(1e-9, c.inputUse[ig] ?? 0);
        unitInput += qq * (isFinite(avg) ? avg : GOOD_BY_ID[ig].importPrice ?? 0);
      }
      outputCost[g] = (outputCost[g] ?? 0) + q * unitInput + b.lastWages + (m.upkeep ?? 0) * b.level;
    }
  }
  for (const g of Object.keys(a.produced) as GoodId[]) {
    const q = a.produced[g] ?? 0;
    if (q > 0) c.unitCost[g] = (outputCost[g] ?? 0) / q;
  }
}

function clearMarket(s: GameState, good: GoodId, alive: Company[], acc: Map<number, Acc>) {
  const g = GOOD_BY_ID[good];
  const snap: MarketSnapshot = {
    good, demandUnits: 0, avgPrice: g.refPrice, othersPrice: s.othersPrice[good] ?? g.refPrice, othersShare: 1,
    baselineQuality: 1, sales: {}, importsUnits: tickImports[good] ?? 0, exportsUnits: 0,
  };
  const sellers = alive.filter((c) => c.prices[good] && (c.inventory[good] ?? 0) > 0);
  const offer = new Map<number, number>();
  for (const c of sellers) {
    const reserve = c.inputUse[good] ?? 0; // keep enough for next month's own production
    offer.set(c.id, Math.max(0, (c.inventory[good] ?? 0) - reserve));
  }
  const A = new Map<number, number>();
  let sumA = 0;
  let sumAP = 0;
  for (const c of sellers) {
    if ((offer.get(c.id) ?? 0) <= 0) continue;
    const a = attractiveness(s, c, good);
    A.set(c.id, a);
    sumA += a;
    sumAP += a * c.prices[good]!;
  }
  const op = s.othersPrice[good] ?? g.refPrice;
  const D0 = baseDemandUnits(s, good);
  const Ao = (s.othersWeight[good] ?? 0.5) * Math.pow(g.refPrice / op, g.priceSensitivity);
  const total = sumA + Ao;
  const avgPrice = (sumAP + Ao * op) / total;
  const D = D0 * Math.pow(g.refPrice / avgPrice, 1.0);
  snap.demandUnits = D;
  snap.avgPrice = avgPrice;

  const sold = new Map<number, number>();
  let unmet = 0;
  for (const [id, a] of A) {
    const want = (D * a) / total;
    const can = offer.get(id) ?? 0;
    const q = Math.min(want, can);
    sold.set(id, q);
    unmet += want - q;
  }
  // Spill unmet demand to sellers with stock left (one pass); the rest goes to unmodeled firms.
  if (unmet > 0) {
    let remA = Ao;
    for (const [id, a] of A) if ((offer.get(id) ?? 0) > (sold.get(id) ?? 0)) remA += a;
    for (const [id, a] of A) {
      const left = (offer.get(id) ?? 0) - (sold.get(id) ?? 0);
      if (left <= 0) continue;
      sold.set(id, (sold.get(id) ?? 0) + Math.min(left, (unmet * a) / remA));
    }
  }
  let gameUnits = 0;
  for (const c of sellers) {
    const q = sold.get(c.id) ?? 0;
    const a = acc.get(c.id)!;
    const b2b = a.b2bSold[good] ?? 0;
    if (q <= 0 && b2b <= 0) continue;
    const p = c.prices[good]!;
    c.inventory[good] = (c.inventory[good] ?? 0) - q;
    a.report.revenue += q * p;
    a.report.revenueByGood[good] = (a.report.revenueByGood[good] ?? 0) + q * p;
    a.report.unitsSold[good] = (a.report.unitsSold[good] ?? 0) + q;
    gameUnits += q;
    snap.sales[c.id] = { units: q + b2b, revenue: (q + b2b) * p, price: p, share: q / D };
  }
  // companies that only sold B2B this month
  for (const c of alive) {
    const a = acc.get(c.id)!;
    const b2b = a.b2bSold[good] ?? 0;
    if (b2b > 0 && !snap.sales[c.id]) snap.sales[c.id] = { units: b2b, revenue: b2b * (c.prices[good] ?? 0), price: c.prices[good] ?? 0, share: 0 };
  }
  snap.othersShare = Math.max(0, 1 - gameUnits / D);
  snap.exportsUnits = g.intermediate ? gameUnits : 0;
  s.markets[good] = snap;
}

/** Unmodeled competitors cut prices when modeled companies take their share, and recover when they don't. */
function updateOthersPrices(s: GameState) {
  for (const g of MARKET_GOODS) {
    const snap = s.markets[g.id];
    if (!snap) continue;
    const start = s.othersShareStart[g.id] ?? 1;
    const lost = Math.max(0, start - snap.othersShare);
    const target = g.refPrice * clamp(1 - 0.6 * lost, 0.6, 1);
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
  return Math.max(0, 3.5 * ebitdaTTM(c)) + 0.4 * c.ppe + 0.1 * c.marketCap;
}

export function interestRate(s: GameState, c: Company): number {
  const e = ebitdaTTM(c);
  const lev = e > 0 ? c.debt / e : c.debt > 0 ? 99 : 0;
  const spread = lev < 1 ? 0.01 : lev < 3 ? 0.025 : lev < 5 ? 0.05 : 0.09;
  return s.baseRate + spread;
}

/** What the market thinks the company is worth before sentiment: earnings or sales multiple plus net cash. */
export function fundamentalValue(_s: GameState, c: Company, hype = c.hype): number {
  const g = revenueGrowth(c);
  const rev = ttm(c, "revenue");
  const ni = ttm(c, "netIncome");
  const pe = clamp(12 + 60 * g, 10, 60);
  const ps = clamp(1 + 10 * g, 0.5, 12);
  let core = 0.65 * Math.max(0, ni * pe) + 0.35 * rev * ps;
  if (rev < 50e6) core = Math.max(core, (c.rndCum + c.ppe) * 1.0);
  return core * hype + c.cash - c.debt + 0.2 * c.ppe;
}

function settleFinances(s: GameState, c: Company, r: MonthReport) {
  r.marketing = r.revenue * c.marketingPct;
  r.depreciation = c.ppe * DEPRECIATION;
  c.ppe += r.capex - r.depreciation;
  r.interest = (c.debt * interestRate(s, c)) / 12;
  const ebit = r.revenue - r.inputCosts - r.wages - r.rdCost - r.sgaCost - r.marketing - r.depreciation;
  const pretax = ebit - r.interest;
  const stateRate = (STATE_BY_CODE[c.hq]?.corpTax ?? 6) / 100;
  r.taxes = Math.max(0, pretax) * (FED_TAX + stateRate * (1 - FED_TAX));
  r.netIncome = pretax - r.taxes;
  c.rndCum += r.rdCost;
  c.cash += r.revenue - r.inputCosts - r.wages - r.rdCost - r.sgaCost - r.marketing - r.interest - r.taxes - r.capex;
  if (c.cash < 0) {
    // Draw on the revolving credit line.
    c.debt += -c.cash;
    c.cash = 0;
  }
  c.distressMonths = s.month > 0 && c.debt > creditLimit(c) * 1.05 && c.debt > 1e6 ? c.distressMonths + 1 : 0;

  // Valuation
  c.history.push(r);
  if (c.history.length > 240) c.history.shift();
  const target = Math.max(0.2 * (c.cash + c.ppe), fundamentalValue(s, c));
  c.marketCap += (target - c.marketCap) * 0.25;
  c.marketCap *= 1 + 0.02 * randNormal(s);
  c.marketCap = Math.max(c.marketCap, 1e6);
  c.hypeAnchor += (1 - c.hypeAnchor) * 0.005;
  c.hype = Math.max(0.2, c.hype + (c.hypeAnchor - c.hype) * 0.02 + 0.01 * randNormal(s) * Math.sqrt(c.hype));
  r.cash = c.cash;
  r.debt = c.debt;
  r.marketCap = c.marketCap;
  r.sharePrice = c.marketCap / c.shares;
}

// ---------------------------------------------------------------- research & brand

export function revenueByTech(c: Company, t: TechId): number {
  const tech = TECHS.find((x) => x.id === t)!;
  let rev = 0;
  for (const g of tech.goods) rev += c.history.slice(-12).reduce((a, h) => a + (h.revenueByGood[g] ?? 0), 0);
  return rev;
}

export function researchCost(s: GameState, c: Company, t: TechId): number {
  const lead = Math.max(0, (c.tech[t] ?? 0) - (s.baselineTech[t] ?? BASELINE_TECH_START));
  return 45 * Math.pow(1 + revenueByTech(c, t) / 1e8, 0.7) * Math.pow(1.25, lead);
}

export function researchOutput(c: Company): number {
  let pts = 0;
  for (const b of c.buildings) if (b.type === "rnd") pts += (methodOf(b.type, b.method).research ?? 0) * b.level * b.efficiency;
  return pts;
}

function research(s: GameState, c: Company) {
  const pts = researchOutput(c);
  const alloc = Object.entries(c.researchAlloc).filter(([, w]) => (w ?? 0) > 0) as [TechId, number][];
  const wsum = alloc.reduce((a, [, w]) => a + w, 0);
  if (wsum <= 0 || pts <= 0) return;
  for (const [t, w] of alloc) {
    c.researchPoints[t] = (c.researchPoints[t] ?? 0) + (pts * w) / wsum;
    let guard = 0;
    while (guard++ < 5) {
      const cost = researchCost(s, c, t);
      if ((c.researchPoints[t] ?? 0) < cost) break;
      c.researchPoints[t]! -= cost;
      c.tech[t] = (c.tech[t] ?? BASELINE_TECH_START) + 1;
      if (c.isPlayer && s.month >= 0) log(s, `Research breakthrough: ${TECHS.find((x) => x.id === t)!.name} reached level ${(c.tech[t] ?? 0).toFixed(0)}.`, "good", c.id);
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

export function log(s: GameState, text: string, kind: "info" | "good" | "bad" | "deal" = "info", companyId?: number) {
  s.events.push({ month: s.month, text, kind, companyId });
  if (s.events.length > 300) s.events.shift();
}

export function player(s: GameState): Company {
  return s.companies.find((c) => c.id === s.playerId)!;
}

export function queueConstruction(s: GameState, _c: Company, b: Building, levels: number, months?: number) {
  const def = BUILDING_BY_ID[b.type];
  const t = months ?? def.buildTime;
  const total = buildCostPerLevel(b.type, b.state) * levels;
  b.construction.push({ levels, monthsLeft: t, monthlyCost: total / t });
  void s;
}

function maybeSpawnStartup(s: GameState) {
  if (rand(s) > 1 / 8) return;
  const goods: GoodId[] = ["software", "software", "data_platforms", "cloud", "evs", "batteries", "chips", "ai_accelerators", "smartphones"];
  const good = pick(s, goods);
  const techy = ["software", "data_platforms", "cloud", "ai_accelerators"].includes(good);
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
  const c = createStartup(s, { name, ticker, good, hq, cash });
  for (const [k, need] of Object.entries(staffNeeds(c))) {
    const cell = s.labor[k];
    if (!cell) continue;
    const q = Math.min(need, Math.max(0, cell.workforce - cell.gameEmployed) * HIRE_RATE);
    c.employees[k] = q;
    cell.gameEmployed += q;
  }
  c.brand[good] = brandTarget(s, c, good) * 0.4;
  c.marketCap = cash * (2 + rand(s) * 3);
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
  if (prev && prev !== t) log(s, `${p.name} is now in the ${tierOf(p.marketCap).name} tier.`, "deal", p.id);
  lastTier.set(p, t);
}

export { JOBS };
