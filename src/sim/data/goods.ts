import type { JobId } from "./jobs";

export type GoodId =
  | "components"
  | "chips"
  | "batteries"
  | "ai_accelerators"
  | "smartphones"
  | "computers"
  | "evs"
  | "software"
  | "cloud"
  | "data_platforms";

export type TechId = "semis" | "ai" | "devices" | "auto" | "battery" | "software" | "cloud";

export interface GoodDef {
  id: GoodId;
  name: string;
  unit: string;
  /** Reference price per unit, USD: what the rest of the market charges at game start. */
  refPrice: number;
  /** Price a company pays to import the good as an input when no US company sells it cheaper. */
  importPrice?: number;
  /** Inputs consumed per unit produced. */
  recipe: Partial<Record<GoodId, number>>;
  tech?: TechId;
  /**
   * Final demand: annual market size at reference prices, USD, at game start.
   * `us` is spread across pops by income; `world` is everyone else
   * (exports, plus US buyers that aren't modeled as pops).
   */
  marketUS: number;
  marketWorld: number;
  /** Annual real growth of the market at game start, tapering toward 3%. */
  growth: number;
  /** Income elasticity across pops (luxury goods > 1). */
  incomeElasticity: number;
  /** Which jobs drive US demand. Omit for households (everyone). */
  buyerJobs?: JobId[];
  /** How strongly buyers chase lower prices when choosing a seller. */
  priceSensitivity: number;
  /** Monthly loss of unsold inventory (obsolescence / spoilage). */
  decay: number;
  /** Intermediate goods: surplus is sold on the world market at the world price. */
  intermediate?: boolean;
  color: string;
}

export const GOODS: GoodDef[] = [
  { id: "components", name: "Parts & Materials", unit: "lots", refPrice: 100, importPrice: 100, recipe: {},
    marketUS: 0, marketWorld: 0, growth: 0, incomeElasticity: 1, priceSensitivity: 2, decay: 0, intermediate: true, color: "#9e9e9e" },
  { id: "chips", name: "Semiconductors", unit: "chips", refPrice: 10, importPrice: 11, recipe: { components: 0.03 }, tech: "semis",
    marketUS: 0, marketWorld: 160e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, intermediate: true, color: "#5c6bc0" },
  { id: "batteries", name: "Battery Packs", unit: "packs", refPrice: 8000, importPrice: 8800, recipe: { components: 40 }, tech: "battery",
    marketUS: 0, marketWorld: 90e9, growth: 0.12, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, intermediate: true, color: "#8bc34a" },
  { id: "ai_accelerators", name: "AI Accelerators", unit: "units", refPrice: 30000, importPrice: 34000, recipe: { chips: 50, components: 20 }, tech: "ai",
    marketUS: 0, marketWorld: 260e9, growth: 0.35, incomeElasticity: 1, priceSensitivity: 1.5, decay: 0.03, color: "#26a69a" },
  { id: "smartphones", name: "Smartphones", unit: "phones", refPrice: 800, recipe: { chips: 3, components: 4 }, tech: "devices",
    marketUS: 85e9, marketWorld: 420e9, growth: 0.02, incomeElasticity: 0.8, priceSensitivity: 3, decay: 0.03, color: "#ef5350" },
  { id: "computers", name: "Computers", unit: "computers", refPrice: 1100, recipe: { chips: 6, components: 5 }, tech: "devices",
    marketUS: 90e9, marketWorld: 260e9, growth: 0.01, incomeElasticity: 1.1, priceSensitivity: 3, decay: 0.03, color: "#ab47bc" },
  { id: "evs", name: "Electric Vehicles", unit: "vehicles", refPrice: 48000, recipe: { batteries: 1, chips: 30, components: 220 }, tech: "auto",
    marketUS: 95e9, marketWorld: 420e9, growth: 0.1, incomeElasticity: 1.4, priceSensitivity: 3, decay: 0.01, color: "#ffa726" },
  { id: "software", name: "Software", unit: "seat-months", refPrice: 100, recipe: { cloud: 0.01 }, tech: "software",
    marketUS: 420e9, marketWorld: 480e9, growth: 0.1, incomeElasticity: 1, priceSensitivity: 2, decay: 1,
    buyerJobs: ["clerk", "professional", "manager", "software", "engineer", "scientist"], color: "#42a5f5" },
  { id: "cloud", name: "Cloud Compute", unit: "compute units", refPrice: 1000, importPrice: 1100, recipe: { ai_accelerators: 0.01, components: 0.5 }, tech: "cloud",
    marketUS: 320e9, marketWorld: 330e9, growth: 0.18, incomeElasticity: 1, priceSensitivity: 2, decay: 1,
    buyerJobs: ["professional", "manager", "software", "engineer", "scientist"], color: "#29b6f6" },
  { id: "data_platforms", name: "Data Platforms", unit: "contract-months", refPrice: 100000, recipe: { cloud: 20 }, tech: "software",
    marketUS: 45e9, marketWorld: 25e9, growth: 0.25, incomeElasticity: 1, priceSensitivity: 1.5, decay: 1,
    buyerJobs: ["professional", "manager"], color: "#7e57c2" },
];

export const GOOD_BY_ID: Record<GoodId, GoodDef> = Object.fromEntries(GOODS.map((g) => [g.id, g])) as Record<GoodId, GoodDef>;
export const FINAL_GOODS = GOODS.filter((g) => g.marketUS + g.marketWorld > 0 && !g.intermediate);
export const SELLABLE_GOODS = GOODS.filter((g) => g.id !== "components");

export const TECHS: { id: TechId; name: string; goods: GoodId[] }[] = [
  { id: "semis", name: "Semiconductor Process", goods: ["chips"] },
  { id: "ai", name: "AI Hardware", goods: ["ai_accelerators"] },
  { id: "devices", name: "Consumer Devices", goods: ["smartphones", "computers"] },
  { id: "auto", name: "Automotive", goods: ["evs"] },
  { id: "battery", name: "Battery Chemistry", goods: ["batteries"] },
  { id: "software", name: "Software Engineering", goods: ["software", "data_platforms"] },
  { id: "cloud", name: "Cloud Infrastructure", goods: ["cloud"] },
];
