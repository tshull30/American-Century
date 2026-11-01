import type { JobId } from "./jobs";

export type GoodId =
  | "components"
  | "chips"
  | "batteries"
  | "ai_accelerators"
  | "smartphones"
  | "computers"
  | "evs"
  | "gas_cars"
  | "software"
  | "cloud"
  | "data_platforms"
  | "digital_ads"
  | "groceries"
  | "apparel"
  | "streaming"
  | "pharmaceuticals"
  | "electricity";

export type TechId = "semis" | "ai" | "devices" | "auto" | "battery" | "software" | "cloud" | "consumer" | "media" | "biotech" | "energy";

export interface GoodDef {
  id: GoodId;
  name: string;
  unit: string;
  /** Reference price per unit, USD: what the rest of the market charges at game start. */
  refPrice: number;
  /** Price a company pays to import the good as an input when no US company sells it cheaper. */
  importPrice?: number;
  /** Inputs consumed per unit produced (a production method can override this). */
  recipe: Partial<Record<GoodId, number>>;
  tech?: TechId;
  /**
   * Final demand: annual market size at reference prices, USD, at game start.
   * `us` comes from pops (through their needs) or from businesses (buyerJobs);
   * `world` is everyone else (exports, plus US buyers not modeled as pops).
   */
  marketUS: number;
  marketWorld: number;
  /** Annual real growth of the market at game start, tapering toward 3%. */
  growth: number;
  /** Income elasticity for business demand (household demand uses the need's elasticity). */
  incomeElasticity: number;
  /** Business goods: which jobs' employers buy it. Household goods are bought through pop needs instead. */
  buyerJobs?: JobId[];
  /** How strongly buyers chase lower prices when choosing a seller. */
  priceSensitivity: number;
  /** Monthly loss of unsold inventory (obsolescence / spoilage). 1 = services that can't be stored. */
  decay: number;
  /** Intermediate goods: surplus is sold on the world market at the world price. */
  intermediate?: boolean;
  /** Share of the US market normally supplied by imports (what tariffs bite on). */
  importShare: number;
  /** Annual drift in consumer preference within its need (e.g. EVs gaining on gas cars). */
  prefDrift?: number;
  color: string;
}

export const GOODS: GoodDef[] = [
  { id: "components", name: "Parts & Materials", unit: "lots", refPrice: 100, importPrice: 100, recipe: {},
    marketUS: 0, marketWorld: 0, growth: 0, incomeElasticity: 1, priceSensitivity: 2, decay: 0, intermediate: true, importShare: 0.5, color: "#9e9e9e" },
  { id: "chips", name: "Semiconductors", unit: "chips", refPrice: 10, importPrice: 11, recipe: { components: 0.03 }, tech: "semis",
    marketUS: 0, marketWorld: 160e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, intermediate: true, importShare: 0.85, color: "#5c6bc0" },
  { id: "batteries", name: "Battery Packs", unit: "packs", refPrice: 8000, importPrice: 8800, recipe: { components: 40 }, tech: "battery",
    marketUS: 0, marketWorld: 90e9, growth: 0.12, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, intermediate: true, importShare: 0.7, color: "#8bc34a" },
  { id: "ai_accelerators", name: "AI Accelerators", unit: "units", refPrice: 30000, importPrice: 34000, recipe: { chips: 50, components: 20 }, tech: "ai",
    marketUS: 0, marketWorld: 260e9, growth: 0.35, incomeElasticity: 1, priceSensitivity: 1.5, decay: 0.03, importShare: 0.2, color: "#26a69a" },
  { id: "smartphones", name: "Smartphones", unit: "phones", refPrice: 800, recipe: { chips: 3, components: 4 }, tech: "devices",
    marketUS: 85e9, marketWorld: 420e9, growth: 0.02, incomeElasticity: 0.8, priceSensitivity: 3, decay: 0.03, importShare: 0.8, color: "#ef5350" },
  { id: "computers", name: "Computers", unit: "computers", refPrice: 1100, recipe: { chips: 6, components: 5 }, tech: "devices",
    marketUS: 90e9, marketWorld: 260e9, growth: 0.01, incomeElasticity: 1.1, priceSensitivity: 3, decay: 0.03, importShare: 0.75, color: "#ab47bc" },
  { id: "evs", name: "Electric Vehicles", unit: "vehicles", refPrice: 48000, recipe: { batteries: 1, chips: 30, components: 260 }, tech: "auto",
    marketUS: 95e9, marketWorld: 420e9, growth: 0.1, incomeElasticity: 1.4, priceSensitivity: 3, decay: 0.01, importShare: 0.25, prefDrift: 0.07, color: "#ffa726" },
  { id: "gas_cars", name: "Gasoline Vehicles", unit: "vehicles", refPrice: 42000, recipe: { chips: 12, components: 330 }, tech: "auto",
    marketUS: 480e9, marketWorld: 1.6e12, growth: 0.0, incomeElasticity: 1.1, priceSensitivity: 3, decay: 0.01, importShare: 0.4, prefDrift: -0.02, color: "#a1887f" },
  { id: "software", name: "Software", unit: "seat-months", refPrice: 100, recipe: { cloud: 0.01 }, tech: "software",
    marketUS: 420e9, marketWorld: 480e9, growth: 0.1, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.05,
    buyerJobs: ["clerk", "professional", "manager", "software", "engineer", "scientist"], color: "#42a5f5" },
  { id: "cloud", name: "Cloud Compute", unit: "compute units", refPrice: 1000, importPrice: 1100, recipe: { ai_accelerators: 0.01, components: 0.5 }, tech: "cloud",
    marketUS: 320e9, marketWorld: 330e9, growth: 0.18, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.02,
    buyerJobs: ["professional", "manager", "software", "engineer", "scientist"], color: "#29b6f6" },
  { id: "data_platforms", name: "Data Platforms", unit: "contract-months", refPrice: 100000, recipe: { cloud: 20 }, tech: "software",
    marketUS: 45e9, marketWorld: 25e9, growth: 0.25, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.02,
    buyerJobs: ["professional", "manager"], color: "#7e57c2" },
  { id: "digital_ads", name: "Digital Advertising", unit: "campaign-units", refPrice: 1000, recipe: { cloud: 0.15 }, tech: "media",
    marketUS: 330e9, marketWorld: 450e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.03,
    buyerJobs: ["manager", "professional", "clerk", "service"], color: "#ec407a" },
  { id: "groceries", name: "Groceries", unit: "baskets", refPrice: 50, recipe: { components: 0.25 }, tech: "consumer",
    marketUS: 900e9, marketWorld: 150e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 3, decay: 0.05, importShare: 0.15, color: "#9ccc65" },
  { id: "apparel", name: "Apparel", unit: "items", refPrice: 40, recipe: { components: 0.15 }, tech: "consumer",
    marketUS: 380e9, marketWorld: 500e9, growth: 0.03, incomeElasticity: 1, priceSensitivity: 3, decay: 0.02, importShare: 0.9, color: "#ffb74d" },
  { id: "streaming", name: "Streaming", unit: "subscriber-months", refPrice: 15, recipe: { cloud: 0.0004 }, tech: "media",
    marketUS: 60e9, marketWorld: 90e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.05, prefDrift: 0.02, color: "#e57373" },
  { id: "pharmaceuticals", name: "Pharmaceuticals", unit: "prescriptions", refPrice: 200, recipe: { components: 0.2 }, tech: "biotech",
    marketUS: 600e9, marketWorld: 900e9, growth: 0.05, incomeElasticity: 1, priceSensitivity: 2, decay: 0.01, importShare: 0.3, color: "#4db6ac" },
  { id: "electricity", name: "Electricity", unit: "MWh", refPrice: 130, recipe: { components: 0.35 }, tech: "energy",
    marketUS: 450e9, marketWorld: 0, growth: 0.025, incomeElasticity: 1, priceSensitivity: 4, decay: 1, importShare: 0, color: "#fff176" },
];

export const GOOD_BY_ID: Record<GoodId, GoodDef> = Object.fromEntries(GOODS.map((g) => [g.id, g])) as Record<GoodId, GoodDef>;
export const MARKET_GOODS = GOODS.filter((g) => g.marketUS + g.marketWorld > 0);

export const TECHS: { id: TechId; name: string; goods: GoodId[] }[] = [
  { id: "semis", name: "Semiconductor Process", goods: ["chips"] },
  { id: "ai", name: "AI Hardware", goods: ["ai_accelerators"] },
  { id: "devices", name: "Consumer Devices", goods: ["smartphones", "computers"] },
  { id: "auto", name: "Automotive", goods: ["evs", "gas_cars"] },
  { id: "battery", name: "Battery Chemistry", goods: ["batteries"] },
  { id: "software", name: "Software Engineering", goods: ["software", "data_platforms"] },
  { id: "cloud", name: "Cloud Infrastructure", goods: ["cloud"] },
  { id: "media", name: "Media & Advertising", goods: ["streaming", "digital_ads"] },
  { id: "consumer", name: "Consumer Products", goods: ["groceries", "apparel"] },
  { id: "biotech", name: "Biotechnology", goods: ["pharmaceuticals"] },
  { id: "energy", name: "Energy Systems", goods: ["electricity"] },
];
