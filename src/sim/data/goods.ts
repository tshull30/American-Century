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
  | "electricity"
  | "crude_oil"
  | "natural_gas"
  | "fuel"
  | "steel"
  | "chemicals"
  | "crops"
  | "solar_panels"
  | "household_goods"
  | "coal"
  | "iron_ore"
  | "copper"
  | "lithium"
  | "timber"
  | "livestock"
  | "cotton"
  | "uranium"
  | "rare_earths"
  | "milk"
  | "aluminum"
  | "lumber"
  | "paper"
  | "textiles"
  | "cement"
  | "fertilizer"
  | "auto_parts"
  | "displays"
  | "meat"
  | "wind_turbines"
  | "homes"
  | "furniture"
  | "appliances"
  | "beverages"
  | "meals_fast"
  | "meals_casual"
  | "meals_fine"
  | "luxury_fashion"
  | "luxury_cars"
  | "video_games"
  | "aircraft"
  | "defense"
  | "medical_devices"
  | "telecom"
  | "air_travel"
  | "logistics";

export type TechId = "semis" | "ai" | "devices" | "auto" | "battery" | "software" | "cloud" | "consumer" | "media" | "biotech" | "energy" | "extraction" | "materials" | "agri" | "aero" | "medtech" | "telecom";

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
  /** Market segment: how strongly richer pops favor it within its need (negative = budget, positive = premium). */
  tilt?: number;
  /** Annual drift in consumer preference within its need (e.g. EVs gaining on gas cars). */
  prefDrift?: number;
  color: string;
}

export const GOODS: GoodDef[] = [
  { id: "components", name: "Parts & Materials", unit: "lots", refPrice: 100, importPrice: 100, recipe: {},
    marketUS: 0, marketWorld: 0, growth: 0, incomeElasticity: 1, priceSensitivity: 2, decay: 0, intermediate: true, importShare: 0.5, color: "#9e9e9e" },
  { id: "chips", name: "Semiconductors", unit: "chips", refPrice: 10, importPrice: 11, recipe: { components: 0.03 }, tech: "semis",
    marketUS: 0, marketWorld: 160e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, intermediate: true, importShare: 0.85, color: "#5c6bc0" },
  { id: "batteries", name: "Battery Packs", unit: "packs", refPrice: 8000, importPrice: 8800, recipe: { lithium: 0.045, components: 35 }, tech: "battery",
    marketUS: 0, marketWorld: 90e9, growth: 0.12, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, intermediate: true, importShare: 0.7, color: "#8bc34a" },
  { id: "ai_accelerators", name: "AI Accelerators", unit: "units", refPrice: 30000, importPrice: 34000, recipe: { chips: 50, components: 20 }, tech: "ai",
    marketUS: 0, marketWorld: 260e9, growth: 0.25, incomeElasticity: 1, priceSensitivity: 1.5, decay: 0.03, importShare: 0.2, color: "#26a69a" },
  { id: "smartphones", name: "Smartphones", unit: "phones", refPrice: 800, recipe: { displays: 1, chips: 3, components: 3.4 }, tech: "devices",
    marketUS: 85e9, marketWorld: 420e9, growth: 0.02, incomeElasticity: 0.8, priceSensitivity: 3, decay: 0.03, importShare: 0.8, color: "#ef5350" },
  { id: "computers", name: "Computers", unit: "computers", refPrice: 1100, recipe: { displays: 1, chips: 6, components: 4.4 }, tech: "devices",
    marketUS: 90e9, marketWorld: 260e9, growth: 0.01, incomeElasticity: 1.1, priceSensitivity: 3, decay: 0.03, importShare: 0.75, color: "#ab47bc" },
  { id: "evs", name: "Electric Vehicles", unit: "vehicles", refPrice: 48000, recipe: { batteries: 1, chips: 30, steel: 0.8, aluminum: 0.2, copper: 0.05, auto_parts: 120, components: 120 }, tech: "auto",
    marketUS: 95e9, marketWorld: 420e9, growth: 0.1, incomeElasticity: 1.4, priceSensitivity: 3, decay: 0.01, importShare: 0.25, prefDrift: 0.07, color: "#ffa726" },
  { id: "gas_cars", name: "Gasoline Vehicles", unit: "vehicles", refPrice: 42000, tilt: -0.1, recipe: { chips: 12, steel: 1.1, aluminum: 0.15, auto_parts: 150, components: 165 }, tech: "auto",
    marketUS: 480e9, marketWorld: 1.6e12, growth: 0.0, incomeElasticity: 1.1, priceSensitivity: 3, decay: 0.01, importShare: 0.4, prefDrift: -0.02, color: "#a1887f" },
  { id: "software", name: "Software", unit: "seat-months", refPrice: 100, recipe: { cloud: 0.01 }, tech: "software",
    marketUS: 420e9, marketWorld: 480e9, growth: 0.1, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.05,
    buyerJobs: ["clerk", "professional", "manager", "software", "engineer", "scientist", "datasci", "accountant", "lawyer", "sales", "designer"], color: "#42a5f5" },
  { id: "cloud", name: "Cloud Compute", unit: "compute units", refPrice: 1000, importPrice: 1100, recipe: { ai_accelerators: 0.01, components: 0.1 }, tech: "cloud",
    marketUS: 320e9, marketWorld: 330e9, growth: 0.18, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.02,
    buyerJobs: ["professional", "manager", "software", "engineer", "scientist", "datasci"], color: "#29b6f6" },
  { id: "data_platforms", name: "Data Platforms", unit: "contract-months", refPrice: 100000, recipe: { cloud: 20 }, tech: "software",
    marketUS: 45e9, marketWorld: 25e9, growth: 0.25, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.02,
    buyerJobs: ["professional", "manager", "accountant", "datasci"], color: "#7e57c2" },
  { id: "digital_ads", name: "Digital Advertising", unit: "campaign-units", refPrice: 1000, recipe: { cloud: 0.15 }, tech: "media",
    marketUS: 330e9, marketWorld: 450e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.03,
    buyerJobs: ["manager", "professional", "clerk", "service", "retail", "sales"], color: "#ec407a" },
  { id: "groceries", name: "Groceries", unit: "baskets", refPrice: 50, recipe: { meat: 0.0015, crops: 0.03, milk: 0.15, components: 0.08 }, tech: "consumer",
    marketUS: 900e9, marketWorld: 150e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 3, decay: 0.05, importShare: 0.15, color: "#9ccc65" },
  { id: "apparel", name: "Apparel", unit: "items", refPrice: 40, recipe: { textiles: 0.05, components: 0.05 }, tech: "consumer", tilt: -0.2,
    marketUS: 380e9, marketWorld: 500e9, growth: 0.03, incomeElasticity: 1, priceSensitivity: 3, decay: 0.02, importShare: 0.9, color: "#ffb74d" },
  { id: "streaming", name: "Streaming", unit: "subscriber-months", refPrice: 15, recipe: { cloud: 0.0004 }, tech: "media",
    marketUS: 60e9, marketWorld: 90e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.05, prefDrift: 0.02, color: "#e57373" },
  { id: "pharmaceuticals", name: "Pharmaceuticals", unit: "prescriptions", refPrice: 200, recipe: { chemicals: 0.005, components: 0.13 }, tech: "biotech",
    marketUS: 600e9, marketWorld: 900e9, growth: 0.05, incomeElasticity: 1, priceSensitivity: 2, decay: 0.01, importShare: 0.3, color: "#4db6ac" },
  { id: "electricity", name: "Electricity", unit: "MWh", refPrice: 130, importPrice: 125, recipe: { natural_gas: 7, components: 0.07 }, tech: "energy",
    marketUS: 450e9, marketWorld: 0, growth: 0.025, incomeElasticity: 1, priceSensitivity: 4, decay: 1, importShare: 0, color: "#fff176" },
  { id: "crude_oil", name: "Crude Oil", unit: "barrels", refPrice: 70, importPrice: 74, recipe: { components: 0.22 }, tech: "extraction",
    marketUS: 0, marketWorld: 900e9, growth: 0.005, incomeElasticity: 1, priceSensitivity: 4, decay: 0.005, intermediate: true, importShare: 0.35, color: "#5d4037" },
  { id: "natural_gas", name: "Natural Gas", unit: "mcf", refPrice: 4, importPrice: 4.6, recipe: { components: 0.012 }, tech: "extraction",
    marketUS: 0, marketWorld: 160e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 4, decay: 0.01, intermediate: true, importShare: 0.05, color: "#90a4ae" },
  { id: "fuel", name: "Gasoline & Diesel", unit: "barrels", refPrice: 115, recipe: { crude_oil: 1.04, components: 0.07 }, tech: "energy",
    marketUS: 520e9, marketWorld: 180e9, growth: -0.005, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.005, importShare: 0.08, prefDrift: -0.01, color: "#795548" },
  { id: "steel", name: "Steel", unit: "tons", refPrice: 900, importPrice: 960, recipe: { components: 3.2, electricity: 0.6, natural_gas: 3 }, tech: "materials",
    marketUS: 0, marketWorld: 220e9, growth: 0.015, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.002, intermediate: true, importShare: 0.25, color: "#607d8b" },
  { id: "chemicals", name: "Chemicals & Plastics", unit: "tons", refPrice: 1500, importPrice: 1600, recipe: { natural_gas: 45, components: 6 }, tech: "materials",
    marketUS: 0, marketWorld: 380e9, growth: 0.025, incomeElasticity: 1, priceSensitivity: 3, decay: 0.005, intermediate: true, importShare: 0.3, color: "#00897b" },
  { id: "crops", name: "Crops", unit: "tons", refPrice: 250, importPrice: 270, recipe: { fertilizer: 0.06, components: 0.35 }, tech: "agri",
    marketUS: 0, marketWorld: 260e9, growth: 0.015, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.03, intermediate: true, importShare: 0.15, color: "#c0ca33" },
  { id: "solar_panels", name: "Solar Panels", unit: "panels", refPrice: 140, importPrice: 120, recipe: { chemicals: 0.01, components: 0.65 }, tech: "energy",
    marketUS: 0, marketWorld: 70e9, growth: 0.12, incomeElasticity: 1, priceSensitivity: 3, decay: 0.01, intermediate: true, importShare: 0.85, color: "#fbc02d" },
  { id: "household_goods", name: "Household Goods", unit: "items", refPrice: 12, recipe: { chemicals: 0.002, paper: 0.002, components: 0.02 }, tech: "consumer",
    marketUS: 260e9, marketWorld: 300e9, growth: 0.025, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, importShare: 0.3, color: "#8d6e63" },

  // ---- Mining, forestry and ranching
  { id: "coal", name: "Coal", unit: "tons", refPrice: 60, importPrice: 66, recipe: { components: 0.2 }, tech: "extraction",
    marketUS: 0, marketWorld: 120e9, growth: -0.02, incomeElasticity: 1, priceSensitivity: 4, decay: 0.005, intermediate: true, importShare: 0.05, color: "#424242" },
  { id: "iron_ore", name: "Iron Ore", unit: "tons", refPrice: 100, importPrice: 110, recipe: { components: 0.25 }, tech: "extraction",
    marketUS: 0, marketWorld: 250e9, growth: 0.01, incomeElasticity: 1, priceSensitivity: 4, decay: 0.002, intermediate: true, importShare: 0.15, color: "#8d4a3a" },
  { id: "copper", name: "Copper", unit: "tons", refPrice: 9000, importPrice: 9400, recipe: { components: 25, electricity: 3, chemicals: 0.2 }, tech: "extraction",
    marketUS: 0, marketWorld: 250e9, growth: 0.04, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.002, intermediate: true, importShare: 0.45, color: "#b87333" },
  { id: "lithium", name: "Lithium", unit: "tons", refPrice: 12000, importPrice: 12500, recipe: { chemicals: 1.5, components: 20, electricity: 5 }, tech: "extraction",
    marketUS: 0, marketWorld: 40e9, growth: 0.12, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.002, intermediate: true, importShare: 0.6, color: "#c5cae9" },
  { id: "timber", name: "Timber", unit: "tons", refPrice: 70, importPrice: 75, recipe: { components: 0.15 }, tech: "agri",
    marketUS: 0, marketWorld: 90e9, growth: 0.01, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.01, intermediate: true, importShare: 0.15, color: "#6d4c41" },
  { id: "livestock", name: "Cattle & Hogs", unit: "head", refPrice: 1300, importPrice: 1380, recipe: { crops: 2, components: 1 }, tech: "agri",
    marketUS: 0, marketWorld: 100e9, growth: 0.01, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.03, intermediate: true, importShare: 0.1, color: "#a1887f" },
  { id: "cotton", name: "Cotton", unit: "tons", refPrice: 1700, importPrice: 1750, recipe: { fertilizer: 0.3, components: 2 }, tech: "agri",
    marketUS: 0, marketWorld: 45e9, growth: 0.01, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.005, intermediate: true, importShare: 0.05, color: "#eceff1" },
  { id: "uranium", name: "Uranium", unit: "kg", refPrice: 180, importPrice: 190, recipe: { chemicals: 0.01, components: 0.4 }, tech: "extraction",
    marketUS: 0, marketWorld: 15e9, growth: 0.04, incomeElasticity: 1, priceSensitivity: 3, decay: 0, intermediate: true, importShare: 0.9, color: "#cddc39" },
  { id: "rare_earths", name: "Rare Earths", unit: "tons", refPrice: 40000, importPrice: 38000, recipe: { chemicals: 3, components: 40, electricity: 10 }, tech: "extraction",
    marketUS: 0, marketWorld: 12e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 3, decay: 0, intermediate: true, importShare: 0.85, color: "#7e57c2" },
  { id: "milk", name: "Milk", unit: "cwt", refPrice: 20, importPrice: 22, recipe: { crops: 0.03, components: 0.05 }, tech: "agri",
    marketUS: 0, marketWorld: 30e9, growth: 0.01, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.2, intermediate: true, importShare: 0.03, color: "#fafafa" },
  // ---- Processed materials and parts
  { id: "aluminum", name: "Aluminum", unit: "tons", refPrice: 3200, importPrice: 3300, recipe: { electricity: 13, components: 4 }, tech: "materials",
    marketUS: 0, marketWorld: 250e9, growth: 0.03, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0, intermediate: true, importShare: 0.5, color: "#b0bec5" },
  { id: "lumber", name: "Lumber", unit: "MBF", refPrice: 450, importPrice: 470, recipe: { timber: 2.4, components: 0.4 }, tech: "materials",
    marketUS: 0, marketWorld: 90e9, growth: 0.015, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.005, intermediate: true, importShare: 0.3, color: "#a1784f" },
  { id: "paper", name: "Paper & Packaging", unit: "tons", refPrice: 900, importPrice: 950, recipe: { timber: 3, chemicals: 0.05, electricity: 1, components: 0.5 }, tech: "materials",
    marketUS: 0, marketWorld: 200e9, growth: 0.01, incomeElasticity: 1, priceSensitivity: 3, decay: 0.005, intermediate: true, importShare: 0.15, color: "#d7ccc8" },
  { id: "textiles", name: "Textiles", unit: "bolts", refPrice: 200, importPrice: 180, recipe: { cotton: 0.06, chemicals: 0.01, components: 0.1 }, tech: "consumer",
    marketUS: 0, marketWorld: 300e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 3, decay: 0.005, intermediate: true, importShare: 0.75, color: "#f48fb1" },
  { id: "cement", name: "Cement", unit: "tons", refPrice: 140, importPrice: 150, recipe: { coal: 0.12, electricity: 0.1, components: 0.4 }, tech: "materials",
    marketUS: 0, marketWorld: 120e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.01, intermediate: true, importShare: 0.2, color: "#9e9e9e" },
  { id: "fertilizer", name: "Fertilizer", unit: "tons", refPrice: 500, importPrice: 530, recipe: { natural_gas: 35, electricity: 0.3, components: 0.8 }, tech: "materials",
    marketUS: 0, marketWorld: 180e9, growth: 0.015, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.005, intermediate: true, importShare: 0.3, color: "#aed581" },
  { id: "auto_parts", name: "Auto Parts", unit: "kits", refPrice: 100, importPrice: 104, recipe: { steel: 0.002, aluminum: 0.001, copper: 0.0003, chips: 0.2, components: 0.45 }, tech: "auto",
    marketUS: 0, marketWorld: 400e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 3, decay: 0.005, intermediate: true, importShare: 0.45, color: "#8e8e6e" },
  { id: "displays", name: "Display Panels", unit: "panels", refPrice: 60, importPrice: 55, recipe: { chemicals: 0.005, electricity: 0.02, components: 0.2 }, tech: "devices",
    marketUS: 0, marketWorld: 150e9, growth: 0.03, incomeElasticity: 1, priceSensitivity: 3, decay: 0.02, intermediate: true, importShare: 0.95, color: "#4fc3f7" },
  { id: "meat", name: "Meat", unit: "tons", refPrice: 5200, importPrice: 5400, recipe: { livestock: 2.6, components: 2 }, tech: "consumer",
    marketUS: 0, marketWorld: 160e9, growth: 0.015, incomeElasticity: 1, priceSensitivity: 3.5, decay: 0.08, intermediate: true, importShare: 0.12, color: "#c62828" },
  { id: "wind_turbines", name: "Wind Turbines", unit: "turbines", refPrice: 1_500_000, importPrice: 1_450_000, recipe: { steel: 150, rare_earths: 0.6, aluminum: 5, chemicals: 20, components: 5000 }, tech: "energy",
    marketUS: 0, marketWorld: 60e9, growth: 0.08, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0, intermediate: true, importShare: 0.6, color: "#80deea" },
  // ---- Finished goods and services
  { id: "homes", name: "New Homes", unit: "homes", refPrice: 350_000, recipe: { lumber: 20, cement: 60, steel: 3, copper: 0.2, aluminum: 0.5, appliances: 2, components: 1800 }, tech: "materials",
    marketUS: 700e9, marketWorld: 0, growth: 0.02, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.002, importShare: 0, color: "#8d6e63" },
  { id: "furniture", name: "Furniture", unit: "items", refPrice: 400, importPrice: 380, recipe: { lumber: 0.2, textiles: 0.3, chemicals: 0.01, components: 0.4 }, tech: "consumer",
    marketUS: 120e9, marketWorld: 200e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, importShare: 0.6, color: "#795548" },
  { id: "appliances", name: "Appliances", unit: "units", refPrice: 800, importPrice: 750, recipe: { steel: 0.05, copper: 0.004, aluminum: 0.01, chips: 5, chemicals: 0.02, components: 2.5 }, tech: "consumer",
    marketUS: 90e9, marketWorld: 250e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 2.5, decay: 0.01, importShare: 0.5, color: "#90a4ae" },
  { id: "beverages", name: "Beverages", unit: "cases", refPrice: 15, recipe: { crops: 0.003, aluminum: 0.0004, chemicals: 0.0005, components: 0.04 }, tech: "consumer",
    marketUS: 250e9, marketWorld: 400e9, growth: 0.02, incomeElasticity: 1, priceSensitivity: 2, decay: 0.01, importShare: 0.1, color: "#e53935" },
  { id: "meals_fast", name: "Fast Food", unit: "meals", refPrice: 9, recipe: { meat: 0.00015, crops: 0.0008, milk: 0.01, beverages: 0.03, components: 0.01 }, tech: "consumer", tilt: -0.4,
    marketUS: 400e9, marketWorld: 0, growth: 0.025, incomeElasticity: 1, priceSensitivity: 3, decay: 1, importShare: 0, color: "#ff8a65" },
  { id: "meals_casual", name: "Casual Dining", unit: "meals", refPrice: 22, recipe: { meat: 0.0003, crops: 0.0015, milk: 0.03, beverages: 0.06, components: 0.025 }, tech: "consumer", tilt: 0.2,
    marketUS: 450e9, marketWorld: 0, growth: 0.02, incomeElasticity: 1, priceSensitivity: 2.5, decay: 1, importShare: 0, color: "#ff7043" },
  { id: "meals_fine", name: "Fine Dining", unit: "meals", refPrice: 90, recipe: { meat: 0.0006, crops: 0.003, milk: 0.05, beverages: 0.3, components: 0.12 }, tech: "consumer", tilt: 1.0,
    marketUS: 150e9, marketWorld: 0, growth: 0.03, incomeElasticity: 1, priceSensitivity: 1.8, decay: 1, importShare: 0, color: "#bf360c" },
  { id: "luxury_fashion", name: "Luxury Fashion", unit: "items", refPrice: 400, recipe: { textiles: 0.3, components: 0.5 }, tech: "consumer", tilt: 1.2,
    marketUS: 60e9, marketWorld: 300e9, growth: 0.05, incomeElasticity: 1, priceSensitivity: 1.5, decay: 0.02, importShare: 0.7, color: "#6a1b9a" },
  { id: "luxury_cars", name: "Luxury Vehicles", unit: "vehicles", refPrice: 95000, recipe: { chips: 25, steel: 1.3, aluminum: 0.5, auto_parts: 250, components: 300 }, tech: "auto", tilt: 1.3,
    marketUS: 120e9, marketWorld: 400e9, growth: 0.03, incomeElasticity: 1, priceSensitivity: 2, decay: 0.01, importShare: 0.6, color: "#4e342e" },
  { id: "video_games", name: "Video Games", unit: "player-months", refPrice: 20, recipe: { cloud: 0.002 }, tech: "media",
    marketUS: 60e9, marketWorld: 140e9, growth: 0.06, incomeElasticity: 1, priceSensitivity: 2, decay: 1, importShare: 0.3, color: "#ab47bc" },
  { id: "aircraft", name: "Aircraft", unit: "aircraft", refPrice: 90_000_000, recipe: { aluminum: 30, steel: 20, chips: 3000, chemicals: 20, components: 400000 }, tech: "aero",
    marketUS: 50e9, marketWorld: 250e9, growth: 0.04, incomeElasticity: 1, priceSensitivity: 2, decay: 0, importShare: 0.4, buyerJobs: ["manager"], color: "#546e7a" },
  { id: "defense", name: "Defense Systems", unit: "contracts", refPrice: 1_000_000, recipe: { steel: 30, aluminum: 10, chips: 5000, rare_earths: 0.2, components: 3500 }, tech: "aero",
    marketUS: 150e9, marketWorld: 80e9, growth: 0.03, incomeElasticity: 0.5, priceSensitivity: 1.5, decay: 0, importShare: 0.02, buyerJobs: ["laborer", "assembler", "construction", "driver", "farmworker", "extraction", "technician", "service", "retail", "care", "nurse", "clerk", "sales", "accountant", "lawyer", "professional", "teacher", "physician", "engineer", "software", "datasci", "scientist", "designer", "manager"], color: "#37474f" },
  { id: "medical_devices", name: "Medical Devices", unit: "devices", refPrice: 2000, recipe: { chips: 20, chemicals: 0.05, steel: 0.01, components: 4 }, tech: "medtech",
    marketUS: 180e9, marketWorld: 300e9, growth: 0.05, incomeElasticity: 1, priceSensitivity: 2, decay: 0.01, importShare: 0.35, color: "#26a69a" },
  { id: "telecom", name: "Wireless Service", unit: "line-months", refPrice: 50, recipe: { electricity: 0.01, components: 0.08 }, tech: "telecom",
    marketUS: 300e9, marketWorld: 0, growth: 0.02, incomeElasticity: 1, priceSensitivity: 2.5, decay: 1, importShare: 0, color: "#5c6bc0" },
  { id: "air_travel", name: "Air Travel", unit: "trips", refPrice: 250, recipe: { fuel: 0.35, aircraft: 0.00000023, components: 0.6 },
    marketUS: 250e9, marketWorld: 0, growth: 0.03, incomeElasticity: 1, priceSensitivity: 3, decay: 1, importShare: 0, color: "#29b6f6" },
  { id: "logistics", name: "Freight & Delivery", unit: "shipments", refPrice: 100, recipe: { fuel: 0.12, components: 0.15 },
    marketUS: 600e9, marketWorld: 0, growth: 0.03, incomeElasticity: 1, priceSensitivity: 3, decay: 1, importShare: 0,
    buyerJobs: ["manager", "retail", "assembler", "sales", "clerk"], color: "#ffa000" },
];

export const GOOD_BY_ID: Record<GoodId, GoodDef> = Object.fromEntries(GOODS.map((g) => [g.id, g])) as Record<GoodId, GoodDef>;
export const MARKET_GOODS = GOODS.filter((g) => g.marketUS + g.marketWorld > 0);

export const TECHS: { id: TechId; name: string; goods: GoodId[] }[] = [
  { id: "semis", name: "Semiconductor Process", goods: ["chips"] },
  { id: "ai", name: "AI Hardware", goods: ["ai_accelerators"] },
  { id: "devices", name: "Consumer Devices", goods: ["smartphones", "computers", "displays"] },
  { id: "auto", name: "Automotive", goods: ["evs", "gas_cars", "auto_parts", "luxury_cars"] },
  { id: "battery", name: "Battery Chemistry", goods: ["batteries"] },
  { id: "software", name: "Software Engineering", goods: ["software", "data_platforms"] },
  { id: "cloud", name: "Cloud Infrastructure", goods: ["cloud"] },
  { id: "media", name: "Media & Advertising", goods: ["streaming", "digital_ads", "video_games"] },
  { id: "consumer", name: "Consumer Products", goods: ["groceries", "apparel", "household_goods", "textiles", "meat", "furniture", "appliances", "beverages", "meals_fast", "meals_casual", "meals_fine", "luxury_fashion"] },
  { id: "biotech", name: "Biotechnology", goods: ["pharmaceuticals"] },
  { id: "energy", name: "Energy Systems", goods: ["electricity", "fuel", "solar_panels", "wind_turbines"] },
  { id: "extraction", name: "Drilling & Mining", goods: ["crude_oil", "natural_gas", "coal", "iron_ore", "copper", "lithium", "uranium", "rare_earths"] },
  { id: "materials", name: "Materials Science", goods: ["steel", "chemicals", "aluminum", "lumber", "paper", "cement", "fertilizer", "homes"] },
  { id: "agri", name: "Agricultural Science", goods: ["crops", "timber", "livestock", "cotton", "milk"] },
  { id: "aero", name: "Aerospace", goods: ["aircraft", "defense"] },
  { id: "medtech", name: "Medical Technology", goods: ["medical_devices"] },
  { id: "telecom", name: "Networks", goods: ["telecom"] },
];
