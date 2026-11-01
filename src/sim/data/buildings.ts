import type { GoodId } from "./goods";
import type { JobId } from "./jobs";
import type { ResourceId } from "./resources";

export type BuildingTypeId =
  | "hq"
  | "rnd"
  | "assembly"
  | "fab"
  | "design"
  | "battery"
  | "auto"
  | "software"
  | "datacenter"
  | "analytics"
  | "adplatform"
  | "food"
  | "apparel"
  | "media"
  | "pharma"
  | "power"
  | "oilfield"
  | "gasfield"
  | "refinery"
  | "steel"
  | "chemicals"
  | "farm"
  | "solarfab"
  | "household"
  | "coalmine"
  | "ironmine"
  | "coppermine"
  | "lithiummine"
  | "logging"
  | "ranch"
  | "cottonfarm"
  | "uraniummine"
  | "rareearth"
  | "dairy"
  | "smelter"
  | "sawmill"
  | "papermill"
  | "textilemill"
  | "cement"
  | "fertilizer"
  | "autoparts"
  | "displayfab"
  | "meatpacking"
  | "turbines"
  | "homebuilder"
  | "furniture"
  | "appliances"
  | "beverages"
  | "restaurant"
  | "gamestudio"
  | "aircraft"
  | "defense"
  | "meddevice"
  | "cellnetwork"
  | "airline"
  | "logistics";

/** Industries, for know-how and economies of scale. Related industries share some know-how. */
export type SectorId =
  | "electronics" | "semis" | "autos" | "software" | "cloud" | "consumer" | "media" | "pharma"
  | "power" | "oilgas" | "materials" | "agriculture"
  | "mining" | "forestry" | "aerospace" | "telecom" | "transport" | "construction" | "hospitality";

export const SECTORS: Record<SectorId, { name: string; related: SectorId[] }> = {
  electronics: { name: "Consumer electronics", related: ["semis", "software", "consumer"] },
  semis: { name: "Semiconductors", related: ["electronics", "cloud"] },
  autos: { name: "Automotive", related: ["electronics", "materials"] },
  software: { name: "Software and internet", related: ["cloud", "media", "electronics"] },
  cloud: { name: "Cloud and data centers", related: ["software", "semis"] },
  consumer: { name: "Consumer products", related: ["agriculture", "materials"] },
  media: { name: "Media", related: ["software"] },
  pharma: { name: "Health care", related: ["materials"] },
  power: { name: "Power and solar", related: ["oilgas", "materials"] },
  oilgas: { name: "Oil and gas", related: ["power", "materials"] },
  materials: { name: "Materials", related: ["oilgas", "autos", "pharma", "mining", "construction"] },
  agriculture: { name: "Agriculture", related: ["consumer", "hospitality", "forestry"] },
  mining: { name: "Mining", related: ["oilgas", "materials"] },
  forestry: { name: "Forest products", related: ["agriculture", "materials", "construction"] },
  aerospace: { name: "Aerospace and defense", related: ["autos", "electronics", "materials"] },
  telecom: { name: "Telecom", related: ["software", "cloud"] },
  transport: { name: "Transportation", related: ["oilgas", "aerospace"] },
  construction: { name: "Homebuilding", related: ["forestry", "materials"] },
  hospitality: { name: "Restaurants", related: ["consumer", "agriculture"] },
};

/** A production method (Victoria 3 style): one way of running a building. */
export interface MethodDef {
  id: string;
  name: string;
  /** Staff per level. */
  staff: Partial<Record<JobId, number>>;
  /** Output per level per month. */
  output: Partial<Record<GoodId, number>>;
  /** Overrides the good's normal inputs per unit (e.g. solar power needs no fuel). */
  recipe?: Partial<Record<GoodId, Partial<Record<GoodId, number>>>>;
  /** Research points per level per month. */
  research?: number;
  /** Admin capacity (building levels supported) per level. */
  admin?: number;
  /** Non-wage running costs per level per month (rent, equipment, content licensing). */
  upkeep?: number;
  /** Build cost multiplier versus the building's base cost. */
  costMult?: number;
  /** Switching an existing building to this method costs this share of its build cost. */
  retoolCost?: number;
}

export interface BuildingDef {
  id: BuildingTypeId;
  name: string;
  short: string;
  /** Build cost per level, USD. */
  cost: number;
  /** Months to build. */
  buildTime: number;
  methods: MethodDef[];
  /** Counts toward admin load (everything except HQ). */
  usesAdmin: boolean;
  /** Which subsidy class it falls under. */
  industry: "strategic" | "factory" | "office";
  /** Industry for know-how and scale (HQ and R&D have none). */
  sector?: SectorId;
  /** Can only be built where this resource exists; output scales with it. */
  resource?: ResourceId;
  description: string;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: "hq", name: "Corporate Headquarters", short: "HQ", cost: 15e6, buildTime: 6, usesAdmin: false, industry: "office",
    description: "Executives, finance, legal and HR. Each level supports 15 levels of other buildings before efficiency drops.",
    methods: [{ id: "hq", name: "Corporate Office", staff: { manager: 30, professional: 25, accountant: 12, lawyer: 6, clerk: 27 }, output: {}, admin: 15, upkeep: 300_000 }],
  },
  {
    id: "rnd", name: "R&D Lab", short: "R&D", cost: 8e6, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Generates research points that raise product quality.",
    methods: [{ id: "rnd", name: "Applied Research", staff: { scientist: 8, engineer: 15, software: 15, datasci: 5, manager: 2 }, output: {}, research: 1, upkeep: 400_000 }],
  },
  {
    id: "assembly", sector: "electronics", name: "Assembly Plant", short: "Assembly", cost: 40e6, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Turns chips and parts into consumer devices.",
    methods: [
      { id: "phones", name: "Smartphones", staff: { assembler: 75, laborer: 15, technician: 15, engineer: 2, manager: 3 }, output: { smartphones: 8000 }, retoolCost: 0.15 },
      { id: "phones_auto", name: "Smartphones (automated)", staff: { assembler: 22, laborer: 8, technician: 30, engineer: 7, manager: 3 }, output: { smartphones: 9200 }, retoolCost: 0.5, costMult: 1.3 },
      { id: "computers", name: "Computers", staff: { assembler: 75, laborer: 15, technician: 15, engineer: 2, manager: 3 }, output: { computers: 4000 }, retoolCost: 0.15 },
      { id: "computers_auto", name: "Computers (automated)", staff: { assembler: 22, laborer: 8, technician: 30, engineer: 7, manager: 3 }, output: { computers: 4600 }, retoolCost: 0.5, costMult: 1.3 },
    ],
  },
  {
    id: "fab", sector: "semis", name: "Chip Fab", short: "Fab", cost: 120e6, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Semiconductor fabrication. Hugely expensive, very hungry for technicians and engineers.",
    methods: [{ id: "fab", name: "Logic Chips", staff: { technician: 40, engineer: 15, assembler: 10, manager: 3 }, output: { chips: 400000 } }],
  },
  {
    id: "design", sector: "semis", name: "Hardware Design Center", short: "HW Design", cost: 25e6, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Designs and packages AI accelerators from purchased chips.",
    methods: [{ id: "design", name: "AI Accelerators", staff: { engineer: 15, software: 8, designer: 2, technician: 5, manager: 2 }, output: { ai_accelerators: 200 } }],
  },
  {
    id: "battery", sector: "autos", name: "Battery Plant", short: "Battery", cost: 20e6, buildTime: 6, usesAdmin: true, industry: "strategic",
    description: "Produces battery packs for vehicles and grid storage.",
    methods: [{ id: "battery", name: "Lithium-ion Cells", staff: { assembler: 25, laborer: 5, technician: 15, engineer: 3, manager: 1 }, output: { batteries: 250 } }],
  },
  {
    id: "auto", sector: "autos", name: "Auto Plant", short: "Auto", cost: 80e6, buildTime: 9, usesAdmin: true, industry: "factory",
    description: "Builds cars: electric vehicles from batteries, chips and parts, or gasoline vehicles.",
    methods: [
      { id: "auto", name: "EV Assembly Line", staff: { assembler: 120, laborer: 30, technician: 40, engineer: 8, manager: 6 }, output: { evs: 300 }, retoolCost: 0.15 },
      { id: "auto_robot", name: "EV Robotic Line", staff: { assembler: 45, laborer: 15, technician: 65, engineer: 16, manager: 6 }, output: { evs: 350 }, retoolCost: 0.5, costMult: 1.3 },
      { id: "gas", name: "Gasoline Line", staff: { assembler: 120, laborer: 30, technician: 35, engineer: 7, manager: 6 }, output: { gas_cars: 330 }, retoolCost: 0.2 },
      { id: "luxury", name: "Luxury Line", staff: { assembler: 100, technician: 50, engineer: 15, designer: 5, manager: 8 }, output: { luxury_cars: 160 }, costMult: 1.4, retoolCost: 0.5 },
    ],
  },
  {
    id: "software", sector: "software", name: "Software Studio", short: "Software", cost: 10e6, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Engineering teams shipping software products and subscriptions.",
    methods: [{ id: "software", name: "Product Engineering", staff: { software: 60, datasci: 4, designer: 6, manager: 10, professional: 6, sales: 6, clerk: 8 }, output: { software: 40000 } }],
  },
  {
    id: "datacenter", sector: "cloud", name: "Data Center", short: "Data Ctr", cost: 200e6, buildTime: 9, usesAdmin: true, industry: "office",
    description: "Runs AI accelerators to sell cloud compute.",
    methods: [{ id: "datacenter", name: "Hyperscale", staff: { technician: 15, software: 5, engineer: 2, manager: 1 }, output: { cloud: 5000 } }],
  },
  {
    id: "analytics", sector: "software", name: "Analytics Office", short: "Analytics", cost: 6e6, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Sells data platforms to government and large enterprises; runs on cloud compute.",
    methods: [{ id: "analytics", name: "Forward-Deployed Teams", staff: { software: 30, datasci: 10, professional: 20, sales: 10, engineer: 5, manager: 8, clerk: 7 }, output: { data_platforms: 30 } }],
  },
  {
    id: "adplatform", sector: "software", name: "Ad Platform", short: "Ads", cost: 15e6, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Sells targeted advertising to businesses. Runs on cloud compute.",
    methods: [{ id: "adplatform", name: "Auction Engine", staff: { software: 40, datasci: 10, sales: 20, professional: 5, manager: 12, clerk: 13 }, output: { digital_ads: 5000 } }],
  },
  {
    id: "food", sector: "consumer", name: "Food Processing Plant", short: "Food", cost: 15e6, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Packaged and fresh food for the nation's grocery shelves.",
    methods: [{ id: "food", name: "Processing Line", staff: { assembler: 45, laborer: 20, driver: 5, technician: 12, clerk: 4, manager: 4, professional: 2 }, output: { groceries: 40000 } }],
  },
  {
    id: "apparel", sector: "consumer", name: "Apparel Factory", short: "Apparel", cost: 10e6, buildTime: 3, usesAdmin: true, industry: "factory",
    description: "Clothing and footwear. Most of the world's apparel is imported, so tariffs matter here.",
    methods: [
      { id: "apparel", name: "Mass Market", staff: { assembler: 65, laborer: 10, designer: 8, technician: 8, manager: 4 }, output: { apparel: 45000 }, retoolCost: 0.3 },
      { id: "luxury", name: "Luxury Atelier", staff: { assembler: 40, designer: 20, technician: 5, sales: 5, manager: 5 }, output: { luxury_fashion: 6000 }, upkeep: 600_000, costMult: 1.5, retoolCost: 0.5 },
    ],
  },
  {
    id: "media", sector: "media", name: "Media Studio", short: "Media", cost: 20e6, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Produces and streams films and series. Content licensing is a big running cost.",
    methods: [{ id: "media", name: "Originals & Licensing", staff: { professional: 25, designer: 20, software: 25, technician: 15, manager: 8, clerk: 7 }, output: { streaming: 350000 }, upkeep: 2_500_000 }],
  },
  {
    id: "pharma", sector: "pharma", name: "Pharmaceutical Plant", short: "Pharma", cost: 100e6, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Manufactures prescription drugs. Quality control, compliance and sales reps are a big running cost; pair it with heavy R&D, since quality matters a lot in medicine.",
    methods: [{ id: "pharma", name: "Small-Molecule & Biologics", staff: { technician: 35, assembler: 25, laborer: 5, scientist: 15, engineer: 8, manager: 6 }, output: { pharmaceuticals: 20000 }, upkeep: 1_500_000 }],
  },
  {
    id: "power", sector: "power", name: "Power Plant", short: "Power", cost: 150e6, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Generates electricity for the grid. Gas and coal burn fuel; solar and wind are cheap to run but depend on sun and wind; nuclear is expensive to build and runs forever.",
    methods: [
      { id: "gas", name: "Natural Gas", staff: { technician: 25, engineer: 8, laborer: 12, manager: 3 }, output: { electricity: 60000 }, retoolCost: 0.6 },
      { id: "solar", name: "Solar Farm", staff: { technician: 10, engineer: 4, construction: 5, manager: 1 }, output: { electricity: 28000 }, recipe: { electricity: { solar_panels: 0.02, components: 0.01 } }, costMult: 0.8, retoolCost: 0.8 },
      { id: "nuclear", name: "Nuclear", staff: { technician: 60, engineer: 20, laborer: 10, manager: 5 }, output: { electricity: 90000 }, recipe: { electricity: { uranium: 0.025, components: 0.03 } }, costMult: 3, retoolCost: 3 },
      { id: "coal", name: "Coal", staff: { technician: 30, laborer: 15, engineer: 8, manager: 3 }, output: { electricity: 70000 }, recipe: { electricity: { coal: 0.5, components: 0.04 } }, costMult: 1.2, retoolCost: 0.8 },
      { id: "wind", name: "Wind Farm", staff: { technician: 8, engineer: 3, construction: 4, manager: 1 }, output: { electricity: 22000 }, recipe: { electricity: { wind_turbines: 0.0000055, components: 0.01 } }, costMult: 0.75, retoolCost: 0.8 },
    ],
  },
  {
    id: "oilfield", sector: "oilgas", resource: "oil", name: "Oil Field", short: "Oil", cost: 160e6, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Wells, pumps and gathering lines. Only where there's oil; richer basins pump more. Leases and royalties are a big running cost.",
    methods: [
      { id: "conventional", name: "Conventional Wells", staff: { extraction: 45, technician: 12, engineer: 5, driver: 8, manager: 2 }, output: { crude_oil: 100000 }, upkeep: 1_200_000, retoolCost: 0.3 },
      { id: "shale", name: "Shale (Fracking)", staff: { extraction: 55, technician: 15, engineer: 7, driver: 10, construction: 4, manager: 3 }, output: { crude_oil: 140000 }, upkeep: 1_800_000, costMult: 1.3, retoolCost: 0.5 },
    ],
  },
  {
    id: "gasfield", sector: "oilgas", resource: "gas", name: "Gas Field", short: "Gas", cost: 140e6, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Natural gas wells and compressors. Gas feeds power plants, steel mills and chemical plants.",
    methods: [
      { id: "conventional", name: "Conventional Wells", staff: { extraction: 38, technician: 12, engineer: 4, driver: 4, manager: 2 }, output: { natural_gas: 1_250_000 }, upkeep: 800_000, retoolCost: 0.3 },
      { id: "shale", name: "Shale (Fracking)", staff: { extraction: 46, technician: 14, engineer: 6, driver: 6, construction: 3, manager: 3 }, output: { natural_gas: 1_750_000 }, upkeep: 1_200_000, costMult: 1.3, retoolCost: 0.5 },
    ],
  },
  {
    id: "refinery", sector: "oilgas", name: "Refinery", short: "Refinery", cost: 220e6, buildTime: 14, usesAdmin: true, industry: "factory",
    description: "Turns crude oil into gasoline and diesel. Thin margins, huge volumes; best near a port or an oil field.",
    methods: [{ id: "refinery", name: "Distillation & Cracking", staff: { technician: 40, assembler: 30, engineer: 12, laborer: 10, manager: 5 }, output: { fuel: 150000 }, upkeep: 800_000 }],
  },
  {
    id: "steel", sector: "materials", name: "Steel Mill", short: "Steel", cost: 70e6, buildTime: 10, usesAdmin: true, industry: "strategic",
    description: "Makes steel for cars, buildings and the world market. Hungry for power and gas.",
    methods: [
      { id: "eaf", name: "Electric Arc (Scrap)", staff: { assembler: 55, technician: 20, laborer: 15, engineer: 4, manager: 4 }, output: { steel: 5000 }, upkeep: 450_000, retoolCost: 0.4 },
      { id: "integrated", name: "Integrated (Blast Furnace)", staff: { assembler: 75, technician: 25, laborer: 25, engineer: 6, manager: 5 }, output: { steel: 7500 }, recipe: { steel: { iron_ore: 1.5, coal: 0.6, electricity: 0.2, natural_gas: 1, components: 1 } }, upkeep: 900_000, costMult: 1.5, retoolCost: 0.8 },
    ],
  },
  {
    id: "chemicals", sector: "materials", name: "Chemical Plant", short: "Chemicals", cost: 100e6, buildTime: 10, usesAdmin: true, industry: "factory",
    description: "Cracks natural gas into plastics, fertilizer and industrial chemicals. Pharma, farms and consumer goods all buy them.",
    methods: [{ id: "chemicals", name: "Steam Cracker", staff: { technician: 30, assembler: 30, engineer: 10, scientist: 3, manager: 4 }, output: { chemicals: 3500 }, upkeep: 600_000 }],
  },
  {
    id: "farm", sector: "agriculture", resource: "farm", name: "Farm", short: "Farm", cost: 30e6, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Corn, soybeans, wheat and produce. Only on farmland; land rent is the main running cost.",
    methods: [
      { id: "row", name: "Row Crops", staff: { farmworker: 70, driver: 10, technician: 8, laborer: 8, manager: 4 }, output: { crops: 6700 }, upkeep: 350_000, retoolCost: 0.2 },
      { id: "precision", name: "Precision Agriculture", staff: { farmworker: 40, driver: 8, technician: 18, datasci: 2, laborer: 4, manager: 4 }, output: { crops: 8000 }, upkeep: 420_000, costMult: 1.5, retoolCost: 0.5 },
    ],
  },
  {
    id: "solarfab", sector: "power", name: "Solar Panel Factory", short: "Solar Fab", cost: 90e6, buildTime: 8, usesAdmin: true, industry: "strategic",
    description: "Makes solar panels for power plants and export. Cheap imports keep prices low unless tariffs protect you.",
    methods: [{ id: "solarfab", name: "Thin-Film Line", staff: { assembler: 60, technician: 20, engineer: 8, manager: 4 }, output: { solar_panels: 60000 }, upkeep: 500_000 }],
  },
  {
    id: "household", sector: "consumer", name: "Consumer Goods Plant", short: "Household", cost: 50e6, buildTime: 5, usesAdmin: true, industry: "factory",
    description: "Detergent, diapers, paper towels and toothpaste. Brands matter.",
    methods: [{ id: "household", name: "Packaged Goods Line", staff: { assembler: 60, laborer: 15, technician: 10, designer: 3, sales: 5, manager: 4 }, output: { household_goods: 330000 }, upkeep: 500_000 }],
  },
  {
    id: "coalmine", sector: "mining", resource: "coal", name: "Coal Mine", short: "Coal", cost: 60000000.0, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Underground and strip mines. Coal feeds power plants, steel mills and cement kilns, and the market is shrinking.",
    methods: [
      { id: "coalmine", name: "Strip Mine", staff: { extraction: 60, technician: 15, driver: 10, engineer: 3, manager: 3 }, output: { coal: 45000 }, upkeep: 300000 },
    ],
  },
  {
    id: "ironmine", sector: "mining", resource: "iron", name: "Iron Mine", short: "Iron", cost: 80000000.0, buildTime: 9, usesAdmin: true, industry: "factory",
    description: "Taconite pits for blast-furnace steel.",
    methods: [
      { id: "ironmine", name: "Open Pit", staff: { extraction: 55, technician: 15, driver: 12, engineer: 4, manager: 3 }, output: { iron_ore: 30000 }, upkeep: 500000 },
    ],
  },
  {
    id: "coppermine", sector: "mining", resource: "copper", name: "Copper Mine", short: "Copper", cost: 150000000.0, buildTime: 12, usesAdmin: true, industry: "factory",
    description: "Open-pit copper with an on-site smelter. Wires, motors and every EV need it.",
    methods: [
      { id: "coppermine", name: "Pit & Smelter", staff: { extraction: 50, technician: 20, engineer: 6, driver: 8, manager: 3 }, output: { copper: 600 }, upkeep: 1200000 },
    ],
  },
  {
    id: "lithiummine", sector: "mining", resource: "lithium", name: "Lithium Plant", short: "Lithium", cost: 120000000.0, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Hard-rock mines or brine wells refined into battery-grade lithium.",
    methods: [
      { id: "lithiummine", name: "Brine & Refinery", staff: { extraction: 30, technician: 20, scientist: 4, engineer: 6, manager: 3 }, output: { lithium: 350 }, upkeep: 600000 },
    ],
  },
  {
    id: "logging", sector: "forestry", resource: "timber", name: "Logging Camp", short: "Logging", cost: 25000000.0, buildTime: 3, usesAdmin: true, industry: "factory",
    description: "Harvests commercial forests for sawmills and paper mills.",
    methods: [
      { id: "logging", name: "Managed Forest", staff: { laborer: 40, driver: 20, technician: 10, manager: 2 }, output: { timber: 15000 }, upkeep: 250000 },
    ],
  },
  {
    id: "ranch", sector: "agriculture", resource: "ranch", name: "Ranch & Feedlot", short: "Ranch", cost: 40000000.0, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Cattle and hogs, fattened on corn. Feeds the meatpackers.",
    methods: [
      { id: "ranch", name: "Feedlot", staff: { farmworker: 40, driver: 6, technician: 4, manager: 2 }, output: { livestock: 1500 }, upkeep: 350000 },
    ],
  },
  {
    id: "cottonfarm", sector: "agriculture", resource: "cotton", name: "Cotton Farm", short: "Cotton", cost: 30000000.0, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Cotton for textile mills here and abroad.",
    methods: [
      { id: "cottonfarm", name: "Irrigated Cotton", staff: { farmworker: 50, driver: 8, technician: 6, manager: 3 }, output: { cotton: 700 }, upkeep: 300000 },
    ],
  },
  {
    id: "uraniummine", sector: "mining", resource: "uranium", name: "Uranium Mine", short: "Uranium", cost: 100000000.0, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "In-situ uranium for nuclear plants.",
    methods: [
      { id: "uraniummine", name: "In-Situ Recovery", staff: { extraction: 40, technician: 15, engineer: 5, manager: 2 }, output: { uranium: 20000 }, upkeep: 800000 },
    ],
  },
  {
    id: "rareearth", sector: "mining", resource: "rare", name: "Rare-Earth Mine", short: "Rare Earth", cost: 150000000.0, buildTime: 14, usesAdmin: true, industry: "strategic",
    description: "Magnets for EV motors, wind turbines and missiles. China dominates; Washington wants an American source.",
    methods: [
      { id: "rareearth", name: "Mine & Separation", staff: { extraction: 40, technician: 20, scientist: 5, engineer: 6, manager: 3 }, output: { rare_earths: 100 }, upkeep: 800000 },
    ],
  },
  {
    id: "dairy", sector: "agriculture", resource: "dairy", name: "Dairy Farm", short: "Dairy", cost: 25000000.0, buildTime: 3, usesAdmin: true, industry: "factory",
    description: "Milk for groceries and restaurants. Spoils fast.",
    methods: [
      { id: "dairy", name: "Milking Parlor", staff: { farmworker: 40, technician: 6, driver: 4, manager: 2 }, output: { milk: 70000 }, upkeep: 250000 },
    ],
  },
  {
    id: "smelter", sector: "materials", name: "Aluminum Smelter", short: "Smelter", cost: 120000000.0, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Turns alumina into aluminum with enormous amounts of electricity. Cheap power or bust.",
    methods: [
      { id: "smelter", name: "Hall-Héroult Potline", staff: { assembler: 50, technician: 20, engineer: 5, manager: 3 }, output: { aluminum: 1500 }, upkeep: 300000 },
    ],
  },
  {
    id: "sawmill", sector: "forestry", name: "Sawmill", short: "Sawmill", cost: 40000000.0, buildTime: 5, usesAdmin: true, industry: "factory",
    description: "Logs into lumber for homebuilders and furniture makers.",
    methods: [
      { id: "sawmill", name: "Sawmill", staff: { assembler: 45, laborer: 20, technician: 10, driver: 6, manager: 3 }, output: { lumber: 6000 }, upkeep: 400000 },
    ],
  },
  {
    id: "papermill", sector: "forestry", name: "Paper Mill", short: "Paper", cost: 90000000.0, buildTime: 10, usesAdmin: true, industry: "factory",
    description: "Pulp, paper and cardboard boxes.",
    methods: [
      { id: "papermill", name: "Kraft Mill", staff: { assembler: 50, technician: 20, laborer: 10, engineer: 4, manager: 3 }, output: { paper: 5000 }, upkeep: 600000 },
    ],
  },
  {
    id: "textilemill", sector: "consumer", name: "Textile Mill", short: "Textiles", cost: 40000000.0, buildTime: 5, usesAdmin: true, industry: "factory",
    description: "Spins cotton into fabric. Mostly moved to Asia decades ago.",
    methods: [
      { id: "textilemill", name: "Spinning & Weaving", staff: { assembler: 60, technician: 10, designer: 2, manager: 3 }, output: { textiles: 25000 }, upkeep: 400000 },
    ],
  },
  {
    id: "cement", sector: "materials", name: "Cement Plant", short: "Cement", cost: 150000000.0, buildTime: 12, usesAdmin: true, industry: "factory",
    description: "Limestone and coal into cement for homes and highways.",
    methods: [
      { id: "cement", name: "Dry-Process Kiln", staff: { assembler: 40, technician: 20, laborer: 15, driver: 10, engineer: 4, manager: 3 }, output: { cement: 45000 }, upkeep: 1200000 },
    ],
  },
  {
    id: "fertilizer", sector: "materials", name: "Fertilizer Plant", short: "Fertilizer", cost: 90000000.0, buildTime: 10, usesAdmin: true, industry: "factory",
    description: "Ammonia and nitrogen fertilizer from natural gas.",
    methods: [
      { id: "fertilizer", name: "Ammonia Synthesis", staff: { technician: 25, assembler: 25, engineer: 6, manager: 3 }, output: { fertilizer: 8000 }, upkeep: 500000 },
    ],
  },
  {
    id: "autoparts", sector: "autos", name: "Auto Parts Plant", short: "Parts", cost: 50000000.0, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Seats, axles, wiring harnesses and brakes for automakers.",
    methods: [
      { id: "autoparts", name: "Tier-1 Supplier", staff: { assembler: 70, technician: 15, engineer: 4, manager: 3 }, output: { auto_parts: 40000 }, upkeep: 400000 },
    ],
  },
  {
    id: "displayfab", sector: "electronics", name: "Display Fab", short: "Displays", cost: 200000000.0, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "OLED and LCD panels for phones and laptops. Almost all made in Asia today.",
    methods: [
      { id: "displayfab", name: "OLED Line", staff: { technician: 40, engineer: 15, assembler: 20, manager: 3 }, output: { displays: 120000 }, upkeep: 1000000 },
    ],
  },
  {
    id: "meatpacking", sector: "consumer", name: "Meatpacking Plant", short: "Meat", cost: 60000000.0, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Slaughters and packs beef and pork. Thin margins, hard work.",
    methods: [
      { id: "meatpacking", name: "Packing Line", staff: { assembler: 80, laborer: 15, technician: 6, driver: 5, manager: 3 }, output: { meat: 1000 }, upkeep: 250000 },
    ],
  },
  {
    id: "turbines", sector: "power", name: "Wind Turbine Factory", short: "Turbines", cost: 120000000.0, buildTime: 10, usesAdmin: true, industry: "strategic",
    description: "Towers, blades and nacelles for wind farms.",
    methods: [
      { id: "turbines", name: "Nacelle Assembly", staff: { assembler: 60, technician: 20, engineer: 8, manager: 3 }, output: { wind_turbines: 4 }, upkeep: 500000 },
    ],
  },
  {
    id: "homebuilder", sector: "construction", name: "Homebuilder", short: "Homes", cost: 15000000.0, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Construction crews building houses. Buys lumber, cement, steel, copper and appliances.",
    methods: [
      { id: "homebuilder", name: "Subdivision Crews", staff: { construction: 70, laborer: 15, sales: 4, designer: 2, manager: 4 }, output: { homes: 8 }, upkeep: 200000 },
    ],
  },
  {
    id: "furniture", sector: "consumer", name: "Furniture Factory", short: "Furniture", cost: 25000000.0, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Sofas, tables and beds. Imports from Asia set the price.",
    methods: [
      { id: "furniture", name: "Upholstery & Casegoods", staff: { assembler: 60, laborer: 8, technician: 8, designer: 4, manager: 3 }, output: { furniture: 8000 }, upkeep: 300000 },
    ],
  },
  {
    id: "appliances", sector: "consumer", name: "Appliance Plant", short: "Appliances", cost: 60000000.0, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Refrigerators, washers and dishwashers.",
    methods: [
      { id: "appliances", name: "Appliance Line", staff: { assembler: 70, technician: 15, engineer: 5, manager: 3 }, output: { appliances: 6000 }, upkeep: 400000 },
    ],
  },
  {
    id: "beverages", sector: "consumer", name: "Beverage Plant", short: "Beverages", cost: 50000000.0, buildTime: 5, usesAdmin: true, industry: "factory",
    description: "Soda, beer and bottled water. Brands are everything.",
    methods: [
      { id: "beverages", name: "Bottling Line", staff: { assembler: 40, driver: 15, technician: 10, sales: 6, manager: 4 }, output: { beverages: 250000 }, upkeep: 600000 },
    ],
  },
  {
    id: "restaurant", sector: "hospitality", name: "Restaurant Chain", short: "Restaurants", cost: 8000000.0, buildTime: 2, usesAdmin: true, industry: "office",
    description: "A region's worth of restaurants: drive-throughs, a family grill chain or white-tablecloth dining rooms. Service-worker heavy; local minimum wages bite.",
    methods: [
      { id: "fast", name: "Fast Food", staff: { service: 70, manager: 5, clerk: 3 }, output: { meals_fast: 110000 }, upkeep: 150000, retoolCost: 0.3 },
      { id: "casual", name: "Casual Dining", staff: { service: 85, manager: 6, clerk: 4 }, output: { meals_casual: 50000 }, upkeep: 220000, retoolCost: 0.4, costMult: 1.3 },
      { id: "fine", name: "Fine Dining", staff: { service: 80, designer: 4, professional: 6, manager: 6 }, output: { meals_fine: 14000 }, upkeep: 300000, retoolCost: 0.6, costMult: 1.8 },
    ],
  },
  {
    id: "gamestudio", sector: "media", name: "Game Studio", short: "Games", cost: 12000000.0, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Makes and runs video games. Hits are huge; most aren't hits.",
    methods: [
      { id: "gamestudio", name: "Live-Service Games", staff: { software: 50, designer: 30, professional: 6, manager: 6, technician: 4 }, output: { video_games: 150000 }, upkeep: 600000 },
    ],
  },
  {
    id: "aircraft", sector: "aerospace", name: "Aircraft Plant", short: "Aircraft", cost: 400000000.0, buildTime: 18, usesAdmin: true, industry: "strategic",
    description: "Final assembly of airliners. Years to build, decades of backlog.",
    methods: [
      { id: "aircraft", name: "Final Assembly", staff: { assembler: 60, technician: 40, engineer: 30, manager: 6 }, output: { aircraft: 0.15 }, upkeep: 2000000 },
    ],
  },
  {
    id: "defense", sector: "aerospace", name: "Defense Plant", short: "Defense", cost: 150000000.0, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Missiles, drones and radars for the Pentagon and allies.",
    methods: [
      { id: "defense", name: "Prime Contractor", staff: { engineer: 25, technician: 30, assembler: 30, software: 10, manager: 5 }, output: { defense: 6 }, upkeep: 800000 },
    ],
  },
  {
    id: "meddevice", sector: "pharma", name: "Medical Device Plant", short: "Med Devices", cost: 60000000.0, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Pacemakers, imaging machines and surgical robots.",
    methods: [
      { id: "meddevice", name: "Device Line", staff: { technician: 30, assembler: 30, engineer: 10, scientist: 5, sales: 5, manager: 4 }, output: { medical_devices: 2000 }, upkeep: 1000000 },
    ],
  },
  {
    id: "cellnetwork", sector: "telecom", name: "Cell Network", short: "Wireless", cost: 300000000.0, buildTime: 12, usesAdmin: true, industry: "office",
    description: "Towers, spectrum and stores serving a region's phones.",
    methods: [
      { id: "cellnetwork", name: "5G Network", staff: { technician: 40, engineer: 10, retail: 20, clerk: 15, manager: 5 }, output: { telecom: 150000 }, upkeep: 2000000 },
    ],
  },
  {
    id: "airline", sector: "transport", name: "Airline Hub", short: "Airline", cost: 100000000.0, buildTime: 8, usesAdmin: true, industry: "office",
    description: "Planes, crews and gates at a hub airport. Burns fuel, buys aircraft.",
    methods: [
      { id: "airline", name: "Hub & Spoke", staff: { service: 40, technician: 25, professional: 15, clerk: 10, manager: 5 }, output: { air_travel: 20000 }, upkeep: 1200000 },
    ],
  },
  {
    id: "logistics", sector: "transport", name: "Distribution Center", short: "Logistics", cost: 40000000.0, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Trucks and warehouses moving freight for every other business.",
    methods: [
      { id: "logistics", name: "Hub Warehouse & Fleet", staff: { driver: 50, laborer: 35, technician: 5, clerk: 6, manager: 4 }, output: { logistics: 20000 }, upkeep: 400000 },
    ],
  },
];

export const BUILDING_BY_ID: Record<BuildingTypeId, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingTypeId, BuildingDef>;

export function methodOf(type: BuildingTypeId, methodId: string): MethodDef {
  const def = BUILDING_BY_ID[type];
  return def.methods.find((m) => m.id === methodId) ?? def.methods[0];
}

/** Which building + method produces a given good (first match). */
export function producerOf(good: GoodId): { type: BuildingTypeId; method: string } | undefined {
  for (const b of BUILDINGS) for (const m of b.methods) if (m.output[good]) return { type: b.id, method: m.id };
  return undefined;
}
