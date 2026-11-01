import type { BuildingTypeId } from "./buildings";
import type { GoodId, TechId } from "./goods";

// Fictional companies loosely modeled on real ones. Starting financials are
// rough mid-2020s figures for the real company each one is based on, so the
// starting tiers feel right.

export interface ProductionSeed {
  good: GoodId;
  /** Annual revenue this line should produce at start (at the company's price). */
  annualRevenue?: number;
  /** Or a fixed number of units per year (used for in-house inputs). */
  annualUnits?: number;
  method?: string;
  /** Where the capacity sits: state code → share. */
  states: Record<string, number>;
  /** Levels already under construction at start (on top of operating capacity). */
  building?: { levels: number; monthsLeft: number };
}

export interface CompanySeed {
  key: string;
  name: string;
  ticker: string;
  color: string;
  tagline: string;
  inspiredBy: string;
  hq: string;
  marketCap: number;
  cash: number;
  debt: number;
  shares: number;
  priceMult: Partial<Record<GoodId, number>>;
  brand: Partial<Record<GoodId, number>>;
  techEdge: Partial<Record<TechId, number>>;
  produce: ProductionSeed[];
  /** R&D lab spending as a share of revenue (wages only). Startups use rndLevels. */
  rndIntensity: number;
  rndLevels?: number;
  rndStates: Record<string, number>;
  marketingPct: number;
  wagePolicy: number;
  tier: "incumbent" | "challenger" | "startup";
  extraBuildings?: { type: BuildingTypeId; method?: string; state: string; levels: number; underConstruction?: number; monthsLeft?: number }[];
}

export const COMPANY_SEEDS: CompanySeed[] = [
  {
    key: "orchard", name: "Orchard Computer", ticker: "ORCH", color: "#5b6770", inspiredBy: "Apple",
    tagline: "Premium phones and computers wrapped in a walled garden of services.",
    hq: "CA", marketCap: 3.6e12, cash: 60e9, debt: 100e9, shares: 15e9,
    priceMult: { smartphones: 1.25, computers: 1.3, software: 1.1 },
    brand: { smartphones: 2.6, computers: 2.0, software: 1.6 },
    techEdge: { devices: 3, software: 1 },
    produce: [
      { good: "smartphones", annualRevenue: 215e9, states: { TX: 0.4, AZ: 0.3, NC: 0.3 } },
      { good: "computers", annualRevenue: 65e9, states: { TX: 0.5, CA: 0.5 } },
      { good: "software", annualRevenue: 110e9, states: { CA: 0.6, TX: 0.2, WA: 0.2 } },
    ],
    rndIntensity: 0.08, rndStates: { CA: 0.7, TX: 0.15, WA: 0.15 }, marketingPct: 0.03, wagePolicy: 1.15, tier: "incumbent",
  },
  {
    key: "windward", name: "Windward Systems", ticker: "WNWD", color: "#2f6f9f", inspiredBy: "Microsoft",
    tagline: "The software every office runs on, and the cloud underneath it.",
    hq: "WA", marketCap: 3.7e12, cash: 80e9, debt: 45e9, shares: 7.4e9,
    priceMult: { software: 1.0, cloud: 1.0, computers: 1.0 },
    brand: { software: 2.2, cloud: 1.8, computers: 1.0 },
    techEdge: { software: 2, cloud: 2 },
    produce: [
      { good: "software", annualRevenue: 170e9, states: { WA: 0.5, CA: 0.2, TX: 0.15, NC: 0.15 } },
      { good: "cloud", annualRevenue: 120e9, states: { WA: 0.3, VA: 0.3, TX: 0.2, IA: 0.2 } },
      { good: "computers", annualRevenue: 20e9, states: { WA: 1 } },
    ],
    rndIntensity: 0.11, rndStates: { WA: 0.7, CA: 0.15, MA: 0.15 }, marketingPct: 0.03, wagePolicy: 1.1, tier: "incumbent",
  },
  {
    key: "verdant", name: "Verdant Silicon", ticker: "VRDT", color: "#4f7d2c", inspiredBy: "Nvidia",
    tagline: "Sells the picks and shovels of the AI gold rush.",
    hq: "CA", marketCap: 4.5e12, cash: 60e9, debt: 9e9, shares: 24e9,
    priceMult: { ai_accelerators: 1.1 },
    brand: { ai_accelerators: 3.0 },
    techEdge: { ai: 5 },
    produce: [{ good: "ai_accelerators", annualRevenue: 220e9, states: { CA: 0.6, TX: 0.2, OR: 0.2 } }],
    rndIntensity: 0.08, rndStates: { CA: 0.8, TX: 0.2 }, marketingPct: 0.01, wagePolicy: 1.2, tier: "incumbent",
  },
  {
    key: "kestrel", name: "Kestrel Motors", ticker: "KSTL", color: "#a63a2b", inspiredBy: "Tesla",
    tagline: "Electric cars, giant battery plants and a founder who never stops posting.",
    hq: "TX", marketCap: 1.3e12, cash: 35e9, debt: 8e9, shares: 3.2e9,
    priceMult: { evs: 0.95, batteries: 1.0 },
    brand: { evs: 1.6, batteries: 1.0 },
    techEdge: { auto: 2, battery: 2 },
    produce: [
      { good: "evs", annualRevenue: 85e9, method: "auto_robot", states: { TX: 0.4, CA: 0.4, NV: 0.2 } },
      { good: "batteries", annualUnits: 1.9e6 + 1.5e6, states: { NV: 0.6, TX: 0.4 } },
    ],
    rndIntensity: 0.05, rndStates: { TX: 0.5, CA: 0.5 }, marketingPct: 0.003, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "seerstone", name: "Seerstone Analytics", ticker: "SEER", color: "#6d4c8e", inspiredBy: "Palantir",
    tagline: "Data platforms for spies, soldiers and Fortune 500 boardrooms.",
    hq: "CO", marketCap: 420e9, cash: 6e9, debt: 0, shares: 2.4e9,
    priceMult: { data_platforms: 1.3 },
    brand: { data_platforms: 2.5 },
    techEdge: { software: 2 },
    produce: [{ good: "data_platforms", annualRevenue: 5e9, states: { CO: 0.4, DC: 0.3, VA: 0.3 } }],
    rndIntensity: 0.1, rndStates: { CO: 0.5, CA: 0.5 }, marketingPct: 0.04, wagePolicy: 1.15, tier: "incumbent",
  },
  {
    key: "foundry", name: "Foundry Corp", ticker: "FNDY", color: "#2c4f7c", inspiredBy: "Intel",
    tagline: "America's chipmaker, trying to win back the lead it lost.",
    hq: "CA", marketCap: 160e9, cash: 22e9, debt: 50e9, shares: 4.4e9,
    priceMult: { chips: 1.0 },
    brand: { chips: 1.2 },
    techEdge: { semis: 0 },
    produce: [{ good: "chips", annualRevenue: 50e9, states: { AZ: 0.4, OR: 0.35, OH: 0.25 } }],
    rndIntensity: 0.25, rndStates: { OR: 0.6, CA: 0.4 }, marketingPct: 0.02, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "cumulus", name: "Cumulus Compute", ticker: "CMLS", color: "#3b8d8c", inspiredBy: "CoreWeave",
    tagline: "A debt-fueled neocloud renting out AI accelerators by the hour.",
    hq: "NJ", marketCap: 45e9, cash: 3e9, debt: 8e9, shares: 500e6,
    priceMult: { cloud: 0.9 },
    brand: { cloud: 0.8 },
    techEdge: { cloud: 1 },
    produce: [{ good: "cloud", annualRevenue: 5e9, states: { NJ: 0.5, TX: 0.5 }, building: { levels: 30, monthsLeft: 4 } }],
    rndIntensity: 0.02, rndStates: { NJ: 1 }, marketingPct: 0.01, wagePolicy: 1.05, tier: "challenger",
  },
  {
    key: "rivet", name: "Rivet Automotive", ticker: "RIVT", color: "#b5872c", inspiredBy: "Rivian",
    tagline: "Adventure trucks for people who own kayaks. Still burning cash.",
    hq: "CA", marketCap: 15e9, cash: 7e9, debt: 5e9, shares: 1.2e9,
    priceMult: { evs: 1.4 },
    brand: { evs: 1.0 },
    techEdge: { auto: 0 },
    produce: [{ good: "evs", annualRevenue: 5.5e9, states: { IL: 1 } }],
    rndIntensity: 0.25, rndStates: { CA: 0.6, MI: 0.4 }, marketingPct: 0.04, wagePolicy: 1.05, tier: "challenger",
  },
  {
    key: "bluegrass", name: "Bluegrass Battery Co.", ticker: "BGBC", color: "#6f8f3a", inspiredBy: "a Southern battery-belt supplier",
    tagline: "Battery cells from the heart of the new Battery Belt.",
    hq: "KY", marketCap: 5e9, cash: 1.2e9, debt: 1.5e9, shares: 300e6,
    priceMult: { batteries: 0.98 },
    brand: { batteries: 0.8 },
    techEdge: { battery: 0 },
    produce: [{ good: "batteries", annualRevenue: 2.5e9, states: { KY: 0.6, TN: 0.4 } }],
    rndIntensity: 0.05, rndStates: { KY: 1 }, marketingPct: 0.01, wagePolicy: 0.95, tier: "challenger",
  },
  {
    key: "copperline", name: "Copperline Semiconductor", ticker: "CPLN", color: "#8a5a3c", inspiredBy: "a specialty chipmaker",
    tagline: "A scrappy Texas fab betting on the onshoring boom.",
    hq: "TX", marketCap: 2e9, cash: 400e6, debt: 200e6, shares: 150e6,
    priceMult: { chips: 0.97 },
    brand: { chips: 0.6 },
    techEdge: { semis: -1 },
    produce: [{ good: "chips", annualRevenue: 220e6, states: { TX: 1 } }],
    rndIntensity: 0.15, rndStates: { TX: 1 }, marketingPct: 0.02, wagePolicy: 1.0, tier: "startup",
  },
  {
    key: "lattice", name: "Lattice Labs", ticker: "LTCE", color: "#4a6fa5", inspiredBy: "a hot SaaS startup",
    tagline: "AI-native workflow software that VCs can't stop funding.",
    hq: "CA", marketCap: 800e6, cash: 250e6, debt: 0, shares: 100e6,
    priceMult: { software: 1.0 },
    brand: { software: 0.4 },
    techEdge: { software: 1 },
    produce: [{ good: "software", annualRevenue: 60e6, states: { CA: 1 } }],
    rndIntensity: 0, rndLevels: 6, rndStates: { CA: 1 }, marketingPct: 0.15, wagePolicy: 1.1, tier: "startup",
  },
  {
    key: "mosaic", name: "Mosaic Data", ticker: "MSDT", color: "#9a4f6a", inspiredBy: "a government-tech startup",
    tagline: "Northern Virginia contractors with a slick data platform.",
    hq: "VA", marketCap: 500e6, cash: 120e6, debt: 0, shares: 80e6,
    priceMult: { data_platforms: 1.0 },
    brand: { data_platforms: 0.5 },
    techEdge: { software: 0 },
    produce: [{ good: "data_platforms", annualRevenue: 40e6, states: { VA: 1 } }],
    rndIntensity: 0, rndLevels: 3, rndStates: { VA: 1 }, marketingPct: 0.08, wagePolicy: 1.0, tier: "startup",
  },
  {
    key: "driftwood", name: "Driftwood Electric", ticker: "DRFT", color: "#3f7a5a", inspiredBy: "a pre-revenue EV startup",
    tagline: "Affordable EVs from a reopened Michigan plant. No revenue yet.",
    hq: "MI", marketCap: 1.5e9, cash: 600e6, debt: 0, shares: 200e6,
    priceMult: { evs: 0.85 },
    brand: { evs: 0.3 },
    techEdge: { auto: -1 },
    produce: [],
    extraBuildings: [{ type: "auto", state: "MI", levels: 0, underConstruction: 5, monthsLeft: 4 }],
    rndIntensity: 0, rndLevels: 8, rndStates: { MI: 1 }, marketingPct: 0.05, wagePolicy: 1.0, tier: "startup",
  },
  {
    key: "summit", name: "Summit Search", ticker: "SMMT", color: "#7c5e2a", inspiredBy: "Alphabet",
    tagline: "Organizes the world's information, then sells ads next to it.",
    hq: "CA", marketCap: 2.8e12, cash: 95e9, debt: 25e9, shares: 12e9,
    priceMult: { digital_ads: 1.05, cloud: 0.95, smartphones: 0.9 },
    brand: { digital_ads: 2.6, cloud: 1.3, smartphones: 1.0 },
    techEdge: { media: 3, cloud: 2, ai: 1 },
    produce: [
      { good: "digital_ads", annualRevenue: 270e9, states: { CA: 0.5, NY: 0.2, TX: 0.15, WA: 0.15 } },
      { good: "cloud", annualRevenue: 50e9, states: { OR: 0.3, IA: 0.3, OK: 0.2, SC: 0.2 } },
      { good: "smartphones", annualRevenue: 10e9, states: { CA: 1 } },
    ],
    rndIntensity: 0.14, rndStates: { CA: 0.7, NY: 0.15, WA: 0.15 }, marketingPct: 0.04, wagePolicy: 1.2, tier: "incumbent",
  },
  {
    key: "lumiverse", name: "Lumiverse", ticker: "LUMV", color: "#5e4f8a", inspiredBy: "Meta",
    tagline: "Three billion people scrolling, and a very expensive bet on the metaverse.",
    hq: "CA", marketCap: 1.8e12, cash: 70e9, debt: 30e9, shares: 2.5e9,
    priceMult: { digital_ads: 0.95 },
    brand: { digital_ads: 2.2 },
    techEdge: { media: 2, ai: 1 },
    produce: [{ good: "digital_ads", annualRevenue: 170e9, states: { CA: 0.6, TX: 0.2, NY: 0.2 } }],
    rndIntensity: 0.25, rndStates: { CA: 0.8, WA: 0.2 }, marketingPct: 0.04, wagePolicy: 1.2, tier: "incumbent",
  },
  {
    key: "atlas", name: "Atlas Commerce", ticker: "ATLS", color: "#2f7d75", inspiredBy: "Amazon",
    tagline: "Started with books. Now runs the cloud, the warehouses and the grocery store.",
    hq: "WA", marketCap: 2.4e12, cash: 85e9, debt: 60e9, shares: 10.6e9,
    priceMult: { cloud: 1.0, digital_ads: 0.95, groceries: 1.05 },
    brand: { cloud: 2.0, digital_ads: 1.4, groceries: 1.2 },
    techEdge: { cloud: 3, media: 1, consumer: 1 },
    produce: [
      { good: "cloud", annualRevenue: 115e9, states: { VA: 0.4, OR: 0.2, OH: 0.2, TX: 0.2 } },
      { good: "digital_ads", annualRevenue: 60e9, states: { WA: 0.7, NY: 0.3 } },
      { good: "groceries", annualRevenue: 25e9, states: { TX: 0.3, CA: 0.3, PA: 0.2, GA: 0.2 } },
    ],
    rndIntensity: 0.12, rndStates: { WA: 0.7, CA: 0.3 }, marketingPct: 0.05, wagePolicy: 1.05, tier: "incumbent",
  },
  {
    key: "redline", name: "Redline Micro", ticker: "RDLN", color: "#a05a2c", inspiredBy: "AMD",
    tagline: "The perennial underdog chip designer, finally with a shot at the AI crown.",
    hq: "CA", marketCap: 350e9, cash: 6e9, debt: 2e9, shares: 1.6e9,
    priceMult: { ai_accelerators: 0.85, chips: 1.0 },
    brand: { ai_accelerators: 1.2, chips: 1.4 },
    techEdge: { ai: 2, semis: 1 },
    produce: [
      { good: "ai_accelerators", annualRevenue: 12e9, states: { CA: 0.5, TX: 0.5 } },
      { good: "chips", annualRevenue: 20e9, states: { TX: 0.6, NY: 0.4 } },
    ],
    rndIntensity: 0.22, rndStates: { CA: 0.6, TX: 0.4 }, marketingPct: 0.02, wagePolicy: 1.1, tier: "incumbent",
  },
  {
    key: "crestline", name: "Crestline Computers", ticker: "CRST", color: "#4d6b2f", inspiredBy: "Dell",
    tagline: "Laptops for every cubicle in America, shipped from Texas.",
    hq: "TX", marketCap: 90e9, cash: 4e9, debt: 25e9, shares: 700e6,
    priceMult: { computers: 0.95 },
    brand: { computers: 1.4 },
    techEdge: { devices: 0 },
    produce: [{ good: "computers", annualRevenue: 95e9, states: { TX: 0.6, TN: 0.4 } }],
    rndIntensity: 0.03, rndStates: { TX: 1 }, marketingPct: 0.02, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "motorcity", name: "Motor City Motors", ticker: "MCM", color: "#8c3b3b", inspiredBy: "General Motors",
    tagline: "A century of trucks and SUVs, nervously pivoting to electric.",
    hq: "MI", marketCap: 60e9, cash: 20e9, debt: 110e9, shares: 1.0e9,
    priceMult: { gas_cars: 1.1, evs: 1.0 },
    brand: { gas_cars: 1.1, evs: 0.9 },
    techEdge: { auto: 0 },
    produce: [
      { good: "gas_cars", annualRevenue: 160e9, states: { MI: 0.4, TN: 0.15, KY: 0.15, TX: 0.15, IN: 0.15 } },
      { good: "evs", annualRevenue: 15e9, states: { MI: 0.6, TN: 0.4 } },
    ],
    rndIntensity: 0.06, rndStates: { MI: 1 }, marketingPct: 0.02, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "bluestone", name: "Bluestone Motor Co.", ticker: "BLST", color: "#346b8f", inspiredBy: "Ford",
    tagline: "America's best-selling pickup, and an EV division losing billions.",
    hq: "MI", marketCap: 45e9, cash: 25e9, debt: 100e9, shares: 4.0e9,
    priceMult: { gas_cars: 1.05, evs: 1.05 },
    brand: { gas_cars: 1.1, evs: 0.8 },
    techEdge: { auto: 0 },
    produce: [
      { good: "gas_cars", annualRevenue: 150e9, states: { MI: 0.4, KY: 0.25, OH: 0.15, MO: 0.2 } },
      { good: "evs", annualRevenue: 8e9, states: { MI: 0.5, TN: 0.5 } },
    ],
    rndIntensity: 0.05, rndStates: { MI: 1 }, marketingPct: 0.02, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "heartland", name: "Heartland Provisions", ticker: "HRTL", color: "#6b6b2f", inspiredBy: "Tyson & Kraft",
    tagline: "Chicken, cheese and cereal for 330 million people.",
    hq: "AR", marketCap: 35e9, cash: 2e9, debt: 15e9, shares: 360e6,
    priceMult: { groceries: 1.0 },
    brand: { groceries: 1.3 },
    techEdge: { consumer: 0 },
    produce: [{ good: "groceries", annualRevenue: 55e9, states: { AR: 0.3, IA: 0.2, NE: 0.15, IL: 0.15, NC: 0.2 } }],
    rndIntensity: 0.01, rndStates: { AR: 1 }, marketingPct: 0.04, wagePolicy: 0.95, tier: "incumbent",
  },
  {
    key: "stride", name: "Stride Athletic", ticker: "STRD", color: "#7a3f6b", inspiredBy: "Nike",
    tagline: "Sneakers and swagger, sold everywhere on Earth.",
    hq: "OR", marketCap: 110e9, cash: 9e9, debt: 8e9, shares: 1.5e9,
    priceMult: { apparel: 1.6 },
    brand: { apparel: 2.8 },
    techEdge: { consumer: 2 },
    produce: [{ good: "apparel", annualRevenue: 50e9, states: { OR: 0.2, NC: 0.3, SC: 0.25, GA: 0.25 } }],
    rndIntensity: 0.02, rndStates: { OR: 1 }, marketingPct: 0.1, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "marquee", name: "Marquee Media", ticker: "MRQE", color: "#2f5d4a", inspiredBy: "Netflix",
    tagline: "Your next binge, and the reason nobody goes to movie theaters.",
    hq: "CA", marketCap: 450e9, cash: 9e9, debt: 15e9, shares: 430e6,
    priceMult: { streaming: 1.1 },
    brand: { streaming: 2.4 },
    techEdge: { media: 2 },
    produce: [{ good: "streaming", annualRevenue: 45e9, states: { CA: 0.7, NY: 0.15, GA: 0.15 } }],
    rndIntensity: 0.07, rndStates: { CA: 1 }, marketingPct: 0.06, wagePolicy: 1.15, tier: "incumbent",
  },
  {
    key: "halvorsen", name: "Halvorsen Pharma", ticker: "HLVR", color: "#9b6b3a", inspiredBy: "Pfizer & Merck",
    tagline: "A century-old drugmaker facing a patent cliff.",
    hq: "NY", marketCap: 160e9, cash: 12e9, debt: 60e9, shares: 5.6e9,
    priceMult: { pharmaceuticals: 1.0 },
    brand: { pharmaceuticals: 1.5 },
    techEdge: { biotech: 0 },
    produce: [{ good: "pharmaceuticals", annualRevenue: 60e9, states: { NJ: 0.3, PA: 0.25, NC: 0.25, MA: 0.2 } }],
    rndIntensity: 0.18, rndStates: { MA: 0.5, NJ: 0.5 }, marketingPct: 0.06, wagePolicy: 1.05, tier: "incumbent",
  },
  {
    key: "cascade", name: "Cascade Therapeutics", ticker: "CSCD", color: "#4f5f8f", inspiredBy: "Eli Lilly",
    tagline: "Its weight-loss drug made it the most valuable drugmaker on Earth.",
    hq: "IN", marketCap: 750e9, cash: 3e9, debt: 30e9, shares: 900e6,
    priceMult: { pharmaceuticals: 1.5 },
    brand: { pharmaceuticals: 2.0 },
    techEdge: { biotech: 4 },
    produce: [{ good: "pharmaceuticals", annualRevenue: 55e9, states: { IN: 0.6, NC: 0.4 } }],
    rndIntensity: 0.22, rndStates: { IN: 0.6, MA: 0.4 }, marketingPct: 0.05, wagePolicy: 1.1, tier: "incumbent",
  },
  {
    key: "continental", name: "Continental Power", ticker: "CPWR", color: "#5f8f6f", inspiredBy: "NextEra",
    tagline: "The country's largest utility, and its biggest builder of wind and solar.",
    hq: "FL", marketCap: 150e9, cash: 2e9, debt: 80e9, shares: 2.05e9,
    priceMult: { electricity: 1.0 },
    brand: { electricity: 1.2 },
    techEdge: { energy: 1 },
    produce: [
      { good: "electricity", annualRevenue: 18e9, method: "gas", states: { FL: 0.7, TX: 0.3 } },
      { good: "electricity", annualRevenue: 10e9, method: "solar", states: { FL: 0.4, TX: 0.3, CA: 0.3 } },
    ],
    rndIntensity: 0.01, rndStates: { FL: 1 }, marketingPct: 0.005, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "sprout", name: "Sprout Foods", ticker: "SPRT", color: "#8f4f3f", inspiredBy: "a plant-based food startup",
    tagline: "Plant-based everything, from a Colorado test kitchen.",
    hq: "CO", marketCap: 400e6, cash: 90e6, debt: 0, shares: 60e6,
    priceMult: { groceries: 1.3 },
    brand: { groceries: 0.6 },
    techEdge: { consumer: 1 },
    produce: [{ good: "groceries", annualRevenue: 60e6, states: { CO: 1 } }],
    rndIntensity: 0, rndLevels: 3, rndStates: { CO: 1 }, marketingPct: 0.12, wagePolicy: 1.0, tier: "startup",
  },
  {
    key: "helio", name: "Helio Grid", ticker: "HELI", color: "#3f6f8f", inspiredBy: "a solar developer",
    tagline: "Desert solar farms financed with a lot of optimism.",
    hq: "AZ", marketCap: 900e6, cash: 150e6, debt: 100e6, shares: 120e6,
    priceMult: { electricity: 0.95 },
    brand: { electricity: 0.6 },
    techEdge: { energy: 1 },
    produce: [{ good: "electricity", annualRevenue: 70e6, method: "solar", states: { AZ: 1 } }],
    rndIntensity: 0, rndLevels: 2, rndStates: { AZ: 1 }, marketingPct: 0.01, wagePolicy: 1.0, tier: "startup",
  },
  {
    key: "verve", name: "Verve Bio", ticker: "VRVB", color: "#6f4f2f", inspiredBy: "a clinical-stage biotech",
    tagline: "A gene therapy in late-stage trials. No product yet.",
    hq: "MA", marketCap: 1.2e9, cash: 400e6, debt: 0, shares: 90e6,
    priceMult: { pharmaceuticals: 2 },
    brand: { pharmaceuticals: 0.5 },
    techEdge: { biotech: 2 },
    produce: [],
    extraBuildings: [{ type: "pharma", state: "MA", levels: 0, underConstruction: 2, monthsLeft: 10 }],
    rndIntensity: 0, rndLevels: 20, rndStates: { MA: 1 }, marketingPct: 0.03, wagePolicy: 1.1, tier: "startup",
  },
  {
    key: "gulfstar", name: "Gulfstar Energy", ticker: "GSTR", color: "#6b4f2f", inspiredBy: "ExxonMobil",
    tagline: "Pumps it, refines it, cracks it into plastic. A century of oil and no plans to stop.",
    hq: "TX", marketCap: 480e9, cash: 25e9, debt: 40e9, shares: 4.3e9,
    priceMult: { crude_oil: 1, natural_gas: 1, fuel: 1, chemicals: 1 },
    brand: { fuel: 1.4, chemicals: 1.2 },
    techEdge: { extraction: 2, energy: 1, materials: 1 },
    produce: [
      { good: "crude_oil", annualRevenue: 60e9, method: "shale", states: { TX: 0.55, NM: 0.3, ND: 0.15 } },
      { good: "natural_gas", annualRevenue: 15e9, method: "shale", states: { TX: 0.6, LA: 0.2, PA: 0.2 } },
      { good: "fuel", annualRevenue: 120e9, states: { TX: 0.55, LA: 0.3, IL: 0.15 } },
      { good: "chemicals", annualRevenue: 25e9, states: { TX: 0.7, LA: 0.3 } },
    ],
    rndIntensity: 0.004, rndStates: { TX: 1 }, marketingPct: 0.005, wagePolicy: 1.05, tier: "incumbent",
  },
  {
    key: "sierra", name: "Sierra Petroleum", ticker: "SRPT", color: "#4f5f3f", inspiredBy: "Chevron",
    tagline: "West Texas wells, California refineries and a dividend it never cuts.",
    hq: "TX", marketCap: 300e9, cash: 8e9, debt: 25e9, shares: 1.75e9,
    priceMult: { crude_oil: 1, natural_gas: 1, fuel: 1.02 },
    brand: { fuel: 1.3 },
    techEdge: { extraction: 1.5, energy: 0.5 },
    produce: [
      { good: "crude_oil", annualRevenue: 45e9, method: "shale", states: { TX: 0.4, NM: 0.35, CO: 0.1, CA: 0.15 } },
      { good: "natural_gas", annualRevenue: 8e9, states: { TX: 0.5, NM: 0.3, CO: 0.2 } },
      { good: "fuel", annualRevenue: 70e9, states: { CA: 0.45, TX: 0.35, MS: 0.2 } },
    ],
    rndIntensity: 0.003, rndStates: { TX: 0.6, CA: 0.4 }, marketingPct: 0.005, wagePolicy: 1.05, tier: "incumbent",
  },
  {
    key: "keystone", name: "Keystone Gas", ticker: "KGAS", color: "#5f6f7f", inspiredBy: "EQT",
    tagline: "The biggest gas driller in the Marcellus, betting on data centers' appetite for power.",
    hq: "PA", marketCap: 32e9, cash: 0.5e9, debt: 9e9, shares: 0.6e9,
    priceMult: { natural_gas: 0.97 },
    brand: { natural_gas: 1 },
    techEdge: { extraction: 1 },
    produce: [{ good: "natural_gas", annualRevenue: 6e9, method: "shale", states: { PA: 0.75, WV: 0.25 } }],
    rndIntensity: 0.002, rndStates: { PA: 1 }, marketingPct: 0.002, wagePolicy: 1.0, tier: "challenger",
  },
  {
    key: "ironbridge", name: "Ironbridge Steel", ticker: "IRBS", color: "#4f5560", inspiredBy: "Nucor",
    tagline: "Melts scrap into steel in electric furnaces across the South and Midwest.",
    hq: "NC", marketCap: 35e9, cash: 4e9, debt: 7e9, shares: 0.23e9,
    priceMult: { steel: 1 },
    brand: { steel: 1.2 },
    techEdge: { materials: 1 },
    produce: [{ good: "steel", annualRevenue: 32e9, states: { IN: 0.25, AR: 0.2, SC: 0.15, AL: 0.15, KY: 0.1, OH: 0.15 } }],
    rndIntensity: 0.002, rndStates: { NC: 1 }, marketingPct: 0.003, wagePolicy: 1.05, tier: "incumbent",
  },
  {
    key: "midland", name: "Midland Chemical", ticker: "MDCH", color: "#2f6f6a", inspiredBy: "Dow",
    tagline: "Plastics, resins and fertilizer from Gulf Coast gas, run out of a small Michigan town.",
    hq: "MI", marketCap: 25e9, cash: 3e9, debt: 18e9, shares: 0.7e9,
    priceMult: { chemicals: 1 },
    brand: { chemicals: 1.2 },
    techEdge: { materials: 1.5 },
    produce: [{ good: "chemicals", annualRevenue: 43e9, states: { TX: 0.5, LA: 0.3, MI: 0.2 } }],
    rndIntensity: 0.02, rndStates: { MI: 1 }, marketingPct: 0.005, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "prairie", name: "Prairie Harvest", ticker: "PRHV", color: "#7f7a2f", inspiredBy: "ADM & Cargill",
    tagline: "Corn and soybeans by the trainload, from the heartland to the world.",
    hq: "IL", marketCap: 25e9, cash: 1e9, debt: 9e9, shares: 0.48e9,
    priceMult: { crops: 1 },
    brand: { crops: 1 },
    techEdge: { agri: 1 },
    produce: [{ good: "crops", annualRevenue: 30e9, method: "precision", states: { IL: 0.25, IA: 0.25, NE: 0.2, MN: 0.15, KS: 0.15 } }],
    rndIntensity: 0.003, rndStates: { IL: 1 }, marketingPct: 0.003, wagePolicy: 0.95, tier: "incumbent",
  },
  {
    key: "sunforge", name: "Sunforge Solar", ticker: "SNFG", color: "#b0892f", inspiredBy: "First Solar",
    tagline: "America's biggest panel maker, living on tariffs and tax credits.",
    hq: "AZ", marketCap: 20e9, cash: 2e9, debt: 0.5e9, shares: 0.107e9,
    priceMult: { solar_panels: 1 },
    brand: { solar_panels: 1.3 },
    techEdge: { energy: 1.5 },
    produce: [{ good: "solar_panels", annualRevenue: 4e9, states: { OH: 0.6, AL: 0.2, LA: 0.2 } }],
    rndIntensity: 0.03, rndStates: { OH: 0.5, AZ: 0.5 }, marketingPct: 0.005, wagePolicy: 1.0, tier: "challenger",
  },
  {
    key: "hearth", name: "Hearth & Home", ticker: "HRTH", color: "#6f4f5f", inspiredBy: "Procter & Gamble",
    tagline: "Detergent, diapers and razors in nearly every home in America.",
    hq: "OH", marketCap: 380e9, cash: 9e9, debt: 33e9, shares: 2.35e9,
    priceMult: { household_goods: 1.25 },
    brand: { household_goods: 2.4 },
    techEdge: { consumer: 2 },
    produce: [{ good: "household_goods", annualRevenue: 60e9, states: { OH: 0.3, PA: 0.15, TN: 0.15, GA: 0.15, MO: 0.1, CA: 0.15 } }],
    rndIntensity: 0.02, rndStates: { OH: 1 }, marketingPct: 0.09, wagePolicy: 1.05, tier: "incumbent",
  },
  {
    key: "wildcat", name: "Bakken Wildcat", ticker: "BKWC", color: "#5a4a3a", inspiredBy: "a North Dakota shale driller",
    tagline: "Three rigs, a lot of debt and a bet that oil stays above $60.",
    hq: "ND", marketCap: 700e6, cash: 60e6, debt: 220e6, shares: 70e6,
    priceMult: { crude_oil: 1 },
    brand: { crude_oil: 0.8 },
    techEdge: { extraction: 0.5 },
    produce: [{ good: "crude_oil", annualRevenue: 350e6, method: "shale", states: { ND: 1 } }],
    rndIntensity: 0, rndLevels: 1, rndStates: { ND: 1 }, marketingPct: 0.002, wagePolicy: 1.05, tier: "startup",
  },
];

/** Name parts for startups founded during the game. */
export const STARTUP_PREFIX = ["Aster", "Basalt", "Cobalt", "Delta", "Ember", "Fathom", "Granite", "Halcyon", "Iris", "Juniper", "Keystone", "Lumen", "Meridian", "Nimbus", "Onyx", "Prairie", "Quarry", "Redwood", "Sable", "Tidal", "Umber", "Vantage", "Willow", "Zephyr", "Harbor", "Summit", "Beacon", "Canyon", "Polar", "Ironwood"];
export const STARTUP_SUFFIX: Record<string, string[]> = {
  software: ["Labs", "Software", "AI", "Systems", "HQ"],
  data_platforms: ["Analytics", "Intelligence", "Data", "Insights"],
  cloud: ["Compute", "Cloud", "Infrastructure"],
  evs: ["Motors", "Electric", "Mobility", "Automotive"],
  batteries: ["Energy", "Cells", "Power", "Battery"],
  chips: ["Semiconductor", "Silicon", "Microdevices"],
  ai_accelerators: ["Silicon", "Compute", "Accelerators"],
  smartphones: ["Devices", "Mobile", "Electronics"],
  computers: ["Computing", "Devices", "Machines"],
  digital_ads: ["Media", "Ads", "Social"],
  groceries: ["Foods", "Farms", "Kitchen"],
  apparel: ["Apparel", "Outfitters", "Threads"],
  streaming: ["Studios", "Pictures", "Stream"],
  pharmaceuticals: ["Bio", "Therapeutics", "Pharma"],
  electricity: ["Power", "Energy", "Grid"],
  gas_cars: ["Motors", "Automotive"],
  crude_oil: ["Petroleum", "Energy", "Resources", "Oil"],
  natural_gas: ["Gas", "Midstream", "Resources"],
  fuel: ["Refining", "Fuels", "Petroleum"],
  steel: ["Steel", "Metals", "Ironworks"],
  chemicals: ["Chemical", "Materials", "Polymers"],
  crops: ["Farms", "Agriculture", "Harvest", "Grain"],
  solar_panels: ["Solar", "Photovoltaics", "Sun"],
  household_goods: ["Brands", "Home", "Goods"],
};
