import type { BuildingTypeId } from "./data/buildings";
import type { GoodId, TechId } from "./data/goods";
import type { JobId } from "./data/jobs";
import type { LawId, PartyId } from "./data/laws";
import type { NeedId } from "./data/needs";
import type { Pop } from "./pops";

export type GoodMap<T = number> = Partial<Record<GoodId, T>>;
export type JobMap<T = number> = Partial<Record<JobId, T>>;

export interface Construction {
  levels: number;
  daysLeft: number;
  totalDays: number;
  /** Capex paid each day until done. */
  dailyCost: number;
}

export interface Building {
  id: number;
  type: BuildingTypeId;
  state: string;
  method: string;
  level: number;
  construction: Construction[];
  /** Filled by the sim each day. */
  staffRatio: number;
  efficiency: number;
  /** Output per month at the current rate. */
  lastOutput: GoodMap;
  /** Wage bill per month at the current rate. */
  lastWages: number;
  /** Operating profit accumulating this month, and last month's total. */
  profitMTD: number;
  lastProfit: number;
}

export interface MonthReport {
  month: number;
  revenue: number;
  revenueByGood: GoodMap;
  unitsSold: GoodMap;
  inputCosts: number;
  /** Wages of production staff and running costs. */
  wages: number;
  /** R&D lab wages and running costs. */
  rdCost: number;
  /** Headquarters wages and running costs. */
  sgaCost: number;
  marketing: number;
  lobbying: number;
  depreciation: number;
  interest: number;
  taxes: number;
  netIncome: number;
  dividends: number;
  capex: number;
  cash: number;
  debt: number;
  marketCap: number;
  sharePrice: number;
  employees: number;
}

export interface Lobby {
  law: LawId;
  /** +1 pushes the law up a level, -1 down. */
  dir: 1 | -1;
  /** Spend per month, USD. */
  monthly: number;
}

export interface EarningsResult {
  quarter: string;
  revenue: number;
  expected: number;
  surprise: number;
}

export interface Company {
  id: number;
  name: string;
  ticker: string;
  color: string;
  tagline: string;
  hq: string;
  isPlayer: boolean;
  alive: boolean;
  foundedMonth: number;
  cash: number;
  debt: number;
  shares: number;
  marketCap: number;
  /** Where the share price is drifting toward (re-set at each month close). */
  valuationTarget: number;
  /** Market sentiment multiplier on fundamental value. */
  hype: number;
  /** Long-run level sentiment drifts back to (itself decaying toward 1). */
  hypeAnchor: number;
  ppe: number;
  buildings: Building[];
  inventory: GoodMap;
  prices: GoodMap;
  autoPrice: GoodMap<boolean>;
  /** Wage offered as a multiple of the local market wage. */
  wagePolicy: number;
  /** Marketing spend as a share of revenue. */
  marketingPct: number;
  /** Share of quarterly profit paid out as dividends. */
  dividendPct: number;
  /** Brand awareness per good: grows with market share and marketing spend. */
  brand: GoodMap;
  /** How well regarded the company's products are, per good (1 = average). */
  reputation: GoodMap;
  tech: Partial<Record<TechId, number>>;
  researchPoints: Partial<Record<TechId, number>>;
  researchAlloc: Partial<Record<TechId, number>>;
  /** Employees by labor cell key "ST:job". */
  employees: Record<string, number>;
  /** Completed months. */
  history: MonthReport[];
  /** The month in progress. */
  current: MonthReport;
  distressMonths: number;
  /** Production cost per unit, by good. */
  unitCost: GoodMap;
  /** Inputs this company consumes per day, by good (kept back from sale). */
  inputUse: GoodMap;
  /** Yesterday's production and sales per good, for pricing. */
  dayProduced: GoodMap;
  daySold: GoodMap;
  /** Expected revenue growth used before the company has two years of history. */
  growthHint: number;
  /** Share of revenue the AI aims to spend on R&D. */
  rndIntensity: number;
  /** Cumulative R&D spend; startups are valued partly on it. */
  rndCum: number;
  kind: "incumbent" | "challenger" | "startup";
  inspiredBy?: string;
  /** Public opinion of the company, 0–1. */
  image: number;
  lobbying: Lobby[];
  /** Cumulative campaign donations by party this election cycle. */
  donations: Partial<Record<PartyId, number>>;
  lastEarnings?: EarningsResult;
  /** Workers laid off this month (hurts public image). */
  layoffs: number;
}

export interface LaborCell {
  state: string;
  job: JobId;
  /** Workforce from pops (before immigration policy). */
  baseWorkforce: number;
  workforce: number;
  /** Market wage per worker per month. */
  wage: number;
  /** Employed by companies in the game. */
  gameEmployed: number;
  /** Hires wanted that couldn't be filled (per month rate). */
  shortage: number;
}

export interface MarketSnapshot {
  good: GoodId;
  /** Monthly-rate demand in units. */
  demandUnits: number;
  avgPrice: number;
  othersPrice: number;
  othersShare: number;
  /** Monthly-rate sales by company. */
  sales: Record<number, { units: number; revenue: number; price: number; share: number }>;
  importsUnits: number;
  exportsUnits: number;
  /** Monthly average price history (last 60 months). */
  priceHistory: number[];
}

export interface GameEvent {
  day: number;
  text: string;
  kind: "info" | "good" | "bad" | "deal" | "politics";
  companyId?: number;
}

export interface NeedStats {
  /** Average satisfaction (1 = average American at 2026 prices) by income quintile. */
  byQuintile: number[];
  priceIndex: number;
  /** Monthly US household spending. */
  spending: number;
}

export interface Macro {
  /** Output gap: + boom, − recession. */
  gap: number;
  inflation: number;
  fedRate: number;
  recession: boolean;
  /** Real GDP growth, annualized, last month. */
  gdpGrowth: number;
  history: { month: number; gap: number; fedRate: number; sol: number; approval: number }[];
}

export interface WorldEvent {
  id: string;
  name: string;
  description: string;
  untilDay: number;
  importMult?: GoodMap;
  demandMult?: GoodMap;
  prefMult?: GoodMap;
}

export interface Bill {
  law: LawId;
  target: number;
  sponsor: PartyId;
  progress: number;
  /** Net lobbying support last month (-1..1). */
  support: number;
  startedDay: number;
}

export interface Politics {
  president: PartyId;
  congress: PartyId;
  laws: Record<LawId, number>;
  bill: Bill | null;
  /** President's approval, 0–1. */
  approval: number;
  /** Democratic share of the two-party vote if the election were held today. */
  poll: number;
  nextElectionDay: number;
  /** National average standard of living at the last election. */
  solAtLastElection: number;
  lastResult?: { day: number; presidential: boolean; commonwealth: number; president: PartyId; congress: PartyId };
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  /** Days since 1 January 2026 (negative during the warm-up year). */
  day: number;
  /** Month index derived from day (0 = January 2026). */
  month: number;
  playerId: number;
  pops: Pop[];
  labor: Record<string, LaborCell>;
  companies: Company[];
  /** Business-demand calibration: units per unit of weighted spending power. */
  demandScale: GoodMap;
  /** Household budget share of income for each need at average income. */
  needShare: Partial<Record<NeedId, number>>;
  /** Preference weights of goods within their need. */
  needPref: GoodMap;
  needStats: Partial<Record<NeedId, NeedStats>>;
  /** US demand per good, units per month at reference prices (recomputed monthly). */
  usDemand: GoodMap;
  /** Combined appeal of all the firms not modeled individually, per good. */
  othersWeight: GoodMap;
  othersPrice: GoodMap;
  othersShareStart: GoodMap;
  /** Market size growth multiplier accumulated since game start. */
  marketGrowth: GoodMap;
  baselineTech: Partial<Record<TechId, number>>;
  markets: GoodMap<MarketSnapshot>;
  baseRate: number;
  macro: Macro;
  worldEvents: WorldEvent[];
  politics: Politics;
  /** National average standard of living (100 = 2026 average). */
  sol: number;
  /** Normalizer that makes the 2026 national average standard of living 100. */
  solNorm: number;
  events: GameEvent[];
  nextId: number;
  gameOver?: string;
}
