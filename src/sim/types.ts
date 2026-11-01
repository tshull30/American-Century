import type { BuildingTypeId } from "./data/buildings";
import type { GoodId, TechId } from "./data/goods";
import type { JobId } from "./data/jobs";
import type { Pop } from "./pops";

export type GoodMap<T = number> = Partial<Record<GoodId, T>>;
export type JobMap<T = number> = Partial<Record<JobId, T>>;

export interface Construction {
  levels: number;
  monthsLeft: number;
  /** Capex paid each month until done. */
  monthlyCost: number;
}

export interface Building {
  id: number;
  type: BuildingTypeId;
  state: string;
  method: string;
  level: number;
  construction: Construction[];
  /** Filled by the sim each month. */
  staffRatio: number;
  efficiency: number;
  lastOutput: GoodMap;
  lastWages: number;
}

export interface MonthReport {
  month: number;
  revenue: number;
  revenueByGood: GoodMap;
  unitsSold: GoodMap;
  inputCosts: number;
  /** Wages of production staff. */
  wages: number;
  /** R&D lab wages and running costs. */
  rdCost: number;
  /** Headquarters wages and running costs. */
  sgaCost: number;
  marketing: number;
  depreciation: number;
  interest: number;
  taxes: number;
  netIncome: number;
  capex: number;
  cash: number;
  debt: number;
  marketCap: number;
  sharePrice: number;
  employees: number;
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
  /** Brand awareness per good: grows with market share and marketing spend. */
  brand: GoodMap;
  /** How well regarded the company's products are, per good (1 = average). */
  reputation: GoodMap;
  tech: Partial<Record<TechId, number>>;
  researchPoints: Partial<Record<TechId, number>>;
  researchAlloc: Partial<Record<TechId, number>>;
  /** Employees by labor cell key "ST:job". */
  employees: Record<string, number>;
  history: MonthReport[];
  distressMonths: number;
  /** Production cost per unit last month, by good. */
  unitCost: GoodMap;
  /** Inputs this company consumed last month, by good (kept back from export). */
  inputUse: GoodMap;
  /** Expected revenue growth used before the company has two years of history. */
  growthHint: number;
  /** Share of revenue the AI aims to spend on R&D. */
  rndIntensity: number;
  /** Cumulative R&D spend; startups are valued partly on it. */
  rndCum: number;
  kind: "incumbent" | "challenger" | "startup";
  inspiredBy?: string;
}

export interface LaborCell {
  state: string;
  job: JobId;
  workforce: number;
  /** Market wage per worker per month. */
  wage: number;
  /** Employed by companies in the game. */
  gameEmployed: number;
  /** Hires wanted last month that couldn't be filled. */
  shortage: number;
}

export interface MarketSnapshot {
  good: GoodId;
  demandUnits: number;
  avgPrice: number;
  othersPrice: number;
  othersShare: number;
  baselineQuality: number;
  sales: Record<number, { units: number; revenue: number; price: number; share: number }>;
  importsUnits: number;
  exportsUnits: number;
}

export interface GameEvent {
  month: number;
  text: string;
  kind: "info" | "good" | "bad" | "deal";
  companyId?: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  /** First month of play (months before it are the warm-up year). */
  startMonth: number;
  month: number;
  playerId: number;
  pops: Pop[];
  labor: Record<string, LaborCell>;
  companies: Company[];
  /** Calibration constant per good: units demanded per unit of weighted US spending power. */
  demandScale: GoodMap;
  /** Combined appeal of all the firms not modeled individually, per good. */
  othersWeight: GoodMap;
  othersPrice: GoodMap;
  /** Share of each market held by unmodeled firms at game start. */
  othersShareStart: GoodMap;
  /** Market size growth multiplier accumulated since game start. */
  marketGrowth: GoodMap;
  /** Technology level of the market as a whole. */
  baselineTech: Partial<Record<TechId, number>>;
  markets: GoodMap<MarketSnapshot>;
  baseRate: number;
  wageInflation: number;
  events: GameEvent[];
  nextId: number;
  gameOver?: string;
}
