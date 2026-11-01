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
    key: "orchard", name: "Orchard Computer", ticker: "ORCH", color: "#e0e0e0", inspiredBy: "Apple",
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
    key: "windward", name: "Windward Systems", ticker: "WNWD", color: "#4fc3f7", inspiredBy: "Microsoft",
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
    key: "verdant", name: "Verdant Silicon", ticker: "VRDT", color: "#76ff03", inspiredBy: "Nvidia",
    tagline: "Sells the picks and shovels of the AI gold rush.",
    hq: "CA", marketCap: 4.5e12, cash: 60e9, debt: 9e9, shares: 24e9,
    priceMult: { ai_accelerators: 1.1 },
    brand: { ai_accelerators: 3.0 },
    techEdge: { ai: 5 },
    produce: [{ good: "ai_accelerators", annualRevenue: 220e9, states: { CA: 0.6, TX: 0.2, OR: 0.2 } }],
    rndIntensity: 0.08, rndStates: { CA: 0.8, TX: 0.2 }, marketingPct: 0.01, wagePolicy: 1.2, tier: "incumbent",
  },
  {
    key: "kestrel", name: "Kestrel Motors", ticker: "KSTL", color: "#ff5252", inspiredBy: "Tesla",
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
    key: "seerstone", name: "Seerstone Analytics", ticker: "SEER", color: "#b388ff", inspiredBy: "Palantir",
    tagline: "Data platforms for spies, soldiers and Fortune 500 boardrooms.",
    hq: "CO", marketCap: 420e9, cash: 6e9, debt: 0, shares: 2.4e9,
    priceMult: { data_platforms: 1.3 },
    brand: { data_platforms: 2.5 },
    techEdge: { software: 2 },
    produce: [{ good: "data_platforms", annualRevenue: 5e9, states: { CO: 0.4, DC: 0.3, VA: 0.3 } }],
    rndIntensity: 0.1, rndStates: { CO: 0.5, CA: 0.5 }, marketingPct: 0.04, wagePolicy: 1.15, tier: "incumbent",
  },
  {
    key: "foundry", name: "Foundry Corp", ticker: "FNDY", color: "#448aff", inspiredBy: "Intel",
    tagline: "America's chipmaker, trying to win back the lead it lost.",
    hq: "CA", marketCap: 160e9, cash: 22e9, debt: 50e9, shares: 4.4e9,
    priceMult: { chips: 1.0 },
    brand: { chips: 1.2 },
    techEdge: { semis: 0 },
    produce: [{ good: "chips", annualRevenue: 50e9, states: { AZ: 0.4, OR: 0.35, OH: 0.25 } }],
    rndIntensity: 0.25, rndStates: { OR: 0.6, CA: 0.4 }, marketingPct: 0.02, wagePolicy: 1.0, tier: "incumbent",
  },
  {
    key: "cumulus", name: "Cumulus Compute", ticker: "CMLS", color: "#80deea", inspiredBy: "CoreWeave",
    tagline: "A debt-fueled neocloud renting out AI accelerators by the hour.",
    hq: "NJ", marketCap: 45e9, cash: 3e9, debt: 8e9, shares: 500e6,
    priceMult: { cloud: 0.9 },
    brand: { cloud: 0.8 },
    techEdge: { cloud: 1 },
    produce: [{ good: "cloud", annualRevenue: 5e9, states: { NJ: 0.5, TX: 0.5 }, building: { levels: 30, monthsLeft: 4 } }],
    rndIntensity: 0.02, rndStates: { NJ: 1 }, marketingPct: 0.01, wagePolicy: 1.05, tier: "challenger",
  },
  {
    key: "rivet", name: "Rivet Automotive", ticker: "RIVT", color: "#ffd740", inspiredBy: "Rivian",
    tagline: "Adventure trucks for people who own kayaks. Still burning cash.",
    hq: "CA", marketCap: 15e9, cash: 7e9, debt: 5e9, shares: 1.2e9,
    priceMult: { evs: 1.4 },
    brand: { evs: 1.0 },
    techEdge: { auto: 0 },
    produce: [{ good: "evs", annualRevenue: 5.5e9, states: { IL: 1 } }],
    rndIntensity: 0.25, rndStates: { CA: 0.6, MI: 0.4 }, marketingPct: 0.04, wagePolicy: 1.05, tier: "challenger",
  },
  {
    key: "bluegrass", name: "Bluegrass Battery Co.", ticker: "BGBC", color: "#a5d6a7", inspiredBy: "a Southern battery-belt supplier",
    tagline: "Battery cells from the heart of the new Battery Belt.",
    hq: "KY", marketCap: 5e9, cash: 1.2e9, debt: 1.5e9, shares: 300e6,
    priceMult: { batteries: 0.98 },
    brand: { batteries: 0.8 },
    techEdge: { battery: 0 },
    produce: [{ good: "batteries", annualRevenue: 2.5e9, states: { KY: 0.6, TN: 0.4 } }],
    rndIntensity: 0.05, rndStates: { KY: 1 }, marketingPct: 0.01, wagePolicy: 0.95, tier: "challenger",
  },
  {
    key: "copperline", name: "Copperline Semiconductor", ticker: "CPLN", color: "#ff8a65", inspiredBy: "a specialty chipmaker",
    tagline: "A scrappy Texas fab betting on the onshoring boom.",
    hq: "TX", marketCap: 2e9, cash: 400e6, debt: 200e6, shares: 150e6,
    priceMult: { chips: 0.97 },
    brand: { chips: 0.6 },
    techEdge: { semis: -1 },
    produce: [{ good: "chips", annualRevenue: 220e6, states: { TX: 1 } }],
    rndIntensity: 0.15, rndStates: { TX: 1 }, marketingPct: 0.02, wagePolicy: 1.0, tier: "startup",
  },
  {
    key: "lattice", name: "Lattice Labs", ticker: "LTCE", color: "#90caf9", inspiredBy: "a hot SaaS startup",
    tagline: "AI-native workflow software that VCs can't stop funding.",
    hq: "CA", marketCap: 800e6, cash: 250e6, debt: 0, shares: 100e6,
    priceMult: { software: 1.0 },
    brand: { software: 0.4 },
    techEdge: { software: 1 },
    produce: [{ good: "software", annualRevenue: 60e6, states: { CA: 1 } }],
    rndIntensity: 0, rndLevels: 6, rndStates: { CA: 1 }, marketingPct: 0.15, wagePolicy: 1.1, tier: "startup",
  },
  {
    key: "mosaic", name: "Mosaic Data", ticker: "MSDT", color: "#ce93d8", inspiredBy: "a government-tech startup",
    tagline: "Northern Virginia contractors with a slick data platform.",
    hq: "VA", marketCap: 500e6, cash: 120e6, debt: 0, shares: 80e6,
    priceMult: { data_platforms: 1.0 },
    brand: { data_platforms: 0.5 },
    techEdge: { software: 0 },
    produce: [{ good: "data_platforms", annualRevenue: 40e6, states: { VA: 1 } }],
    rndIntensity: 0, rndLevels: 3, rndStates: { VA: 1 }, marketingPct: 0.08, wagePolicy: 1.0, tier: "startup",
  },
  {
    key: "driftwood", name: "Driftwood Electric", ticker: "DRFT", color: "#bcaaa4", inspiredBy: "a pre-revenue EV startup",
    tagline: "Affordable EVs from a reopened Michigan plant. No revenue yet.",
    hq: "MI", marketCap: 1.5e9, cash: 600e6, debt: 0, shares: 200e6,
    priceMult: { evs: 0.85 },
    brand: { evs: 0.3 },
    techEdge: { auto: -1 },
    produce: [],
    extraBuildings: [{ type: "auto", state: "MI", levels: 0, underConstruction: 5, monthsLeft: 4 }],
    rndIntensity: 0, rndLevels: 8, rndStates: { MI: 1 }, marketingPct: 0.05, wagePolicy: 1.0, tier: "startup",
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
};
