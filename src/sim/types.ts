import type { BuildingTypeId } from "./data/buildings";
import type { GoodId, TechId } from "./data/goods";
import type { JobId } from "./data/jobs";
import type { LawId, PartyId } from "./data/laws";
import type { NeedId } from "./data/needs";
import type { Faction } from "./data/congress";
import type { Pop } from "./pops";
import type { SectorId } from "./data/buildings";

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
  city: string;
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

export interface Pac {
  name: string;
  funds: number;
  foundedDay: number;
  /** Total raised and spent since founding. */
  raised: number;
  spent: number;
}

export interface Politician {
  id: string;
  name: string;
  /** Caucus: who they vote with. */
  party: "D" | "R";
  /** What's printed after their name (independents show I). */
  label: "D" | "R" | "I";
  faction: Faction;
  chamber: "senate" | "house";
  state: string;
  district?: number;
  /** Senate class (which election year the seat is up). */
  cls?: number;
  /** Democratic share of the vote this seat would give in a neutral year. */
  lean: number;
  /** True for the real members seated at game start. */
  real: boolean;
  /** How much better (+) or worse than the seat's lean this member runs, in vote share. */
  personal: number;
  /** Announced they won't run again this cycle. */
  retiring?: boolean;
  sinceYear: number;
  /** Goodwill toward companies whose PACs backed them, in dollars (decays). */
  friends: Record<number, number>;
  /** PAC money spent for and against them this election cycle. */
  pacFor: number;
  pacAgainst: number;
}

export interface StateLegislature {
  senateD: number;
  senateR: number;
  houseD: number;
  houseR: number;
}

export interface VoteResult {
  day: number;
  law: LawId;
  target: number;
  house: { yes: number; no: number; need: number };
  senate: { yes: number; no: number; need: number; rule: "majority" | "cloture" };
  outcome: "passed" | "failed-house" | "failed-senate" | "vetoed";
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
  /** Industry know-how, 0–1 (see sectors.ts). */
  knowhow?: Partial<Record<SectorId, number>>;
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
  layoffsByJob: Partial<Record<JobId, number>>;
  layoffsByCity: Record<string, number>;
  /** Opinion of the company by pop type, 0–1. */
  jobOpinion: Partial<Record<JobId, number>>;
  pac?: Pac;
  hqSite: HqSite;
}

export type HqForm = "tower" | "campus" | "block";
export type AmenityId = "cafeteria" | "childcare" | "fitness" | "innovation_lab" | "plaza" | "visitor_center" | "shuttle" | "exec_suites" | "solar_roof";

export interface HqSite {
  city: string;
  form: HqForm;
  amenities: AmenityId[];
}

export interface CityState {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  tech: number;
  mfg: number;
  col: number;
  flags: string[];
  /** Share of the state's population living here (dynamic). */
  share: number;
  /** Democratic lean of the city council. */
  council: number;
  /** Local policies. */
  taxBreak: number;
  permitSpeed: number;
  dcStance: "welcome" | "neutral" | "moratorium";
  /** Lean of residents (Harris 2024 two-party share, roughly). */
  lean: number;
  /** Libertarian streak, 0–1: low taxes, few rules, suspicious of subsidies. */
  lib: number;
  /** Bans new oil and gas projects. */
  fossilBan?: boolean;
  /** Share of a data center's power bill the city abates (welcome) or surcharges (negative). */
  dcTaxBreak: number;
  /** Water-use rules for data centers (cooling costs more). */
  dcWaterRules?: boolean;
  minWage: number;
  union: number;
  powerIdx: number;
  gridMW: number;
  /** Data-center load drawn from the local grid, MW. */
  dcLoadMW: number;
  /** Opinion of each company, 0–1. */
  opinion: Record<number, number>;
  rest?: boolean;
}

export interface Race {
  id: string;
  chamber: "senate" | "house";
  state: string;
  district?: number;
  cls?: number;
  special?: boolean;
  lean: number;
  incumbentId?: string;
  open: boolean;
  primaryDay: number;
  primaryDone: boolean;
  nominees: Partial<Record<"D" | "R", Candidate>>;
  /** PAC money spent for each party's nominee, by company. */
  pac: Record<number, { D: number; R: number }>;
  /** Democratic share projected today. */
  proj: number;
  result?: { dShare: number; winner: "D" | "R" };
}

export interface Candidate {
  name: string;
  faction: Faction;
  personal: number;
  politicianId?: string;
  incumbent: boolean;
}

export interface Deal {
  id: number;
  buyerId: number;
  targetId: number;
  price: number;
  payment: "cash" | "stock";
  stage: "review" | "second_request";
  daysLeft: number;
  blockChance: number;
  startedDay: number;
}

export interface LaborCell {
  state: string;
  city: string;
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

export type EventTag = "election" | "law" | "deal" | "finance" | "tier" | "city" | "build" | "macro";

export interface GameEvent {
  day: number;
  text: string;
  kind: "info" | "good" | "bad" | "deal" | "politics";
  /** Why this event might pause the game (see PAUSE_TAGS in the UI). */
  tag?: EventTag;
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
  presidentName: string;
  vpName: string;
  /** Terms served by the sitting president (they can't run after two). */
  presidentTerms: number;
  /** House majority. */
  congress: PartyId;
  senate: PartyId;
  lastVote?: VoteResult;
  laws: Record<LawId, number>;
  bill: Bill | null;
  /** President's approval, 0–1. */
  approval: number;
  /** Democratic share of the two-party vote if the election were held today. */
  poll: number;
  nextElectionDay: number;
  /** Average occupational lean of the workforce at game start (polls are measured against it). */
  leanBase?: number;
  /** National average standard of living at the last election. */
  solAtLastElection: number;
  lastResult?: {
    day: number; presidential: boolean; commonwealth: number; president: PartyId; congress: PartyId; senate: PartyId;
    houseD: number; houseR: number; senateD: number; senateR: number; ecD?: number; ecR?: number; presidentName?: string;
  };
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
  politicians: Politician[];
  races: Race[];
  cities: Record<string, CityState>;
  /** Average market wage by state and job ("ST:job"), for pops. */
  stateWage: Record<string, number>;
  deals: Deal[];
  /** State populations at game start, for showing migration. */
  statePopStart: Record<string, number>;
  vacancies: { state: string; district: number }[];
  stateLegs: Record<string, StateLegislature>;
  /** National average standard of living (100 = 2026 average). */
  sol: number;
  /** Normalizer that makes the 2026 national average standard of living 100. */
  solNorm: number;
  events: GameEvent[];
  /** Real politicians already used as candidates (so nobody runs twice). */
  politicsUsedNames?: string[];
  nextId: number;
  gameOver?: string;
}
