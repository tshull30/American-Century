import type { GoodId } from "./goods";
import type { JobId } from "./jobs";

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
  | "household";

/** Industries, for know-how and economies of scale. Related industries share some know-how. */
export type SectorId =
  | "electronics" | "semis" | "autos" | "software" | "cloud" | "consumer" | "media" | "pharma"
  | "power" | "oilgas" | "materials" | "agriculture";

export const SECTORS: Record<SectorId, { name: string; related: SectorId[] }> = {
  electronics: { name: "Consumer electronics", related: ["semis", "software"] },
  semis: { name: "Semiconductors", related: ["electronics", "cloud"] },
  autos: { name: "Automotive", related: ["electronics", "materials"] },
  software: { name: "Software and internet", related: ["cloud", "media", "electronics"] },
  cloud: { name: "Cloud and data centers", related: ["software", "semis"] },
  consumer: { name: "Consumer products", related: ["agriculture", "materials"] },
  media: { name: "Media", related: ["software"] },
  pharma: { name: "Pharmaceuticals", related: ["materials"] },
  power: { name: "Power and solar", related: ["oilgas", "materials"] },
  oilgas: { name: "Oil and gas", related: ["power", "materials"] },
  materials: { name: "Steel and chemicals", related: ["oilgas", "autos", "pharma"] },
  agriculture: { name: "Agriculture", related: ["consumer"] },
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
  resource?: "oil" | "gas" | "farm";
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
    methods: [{ id: "apparel", name: "Cut & Sew", staff: { assembler: 65, laborer: 10, designer: 8, technician: 8, manager: 4 }, output: { apparel: 45000 } }],
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
    description: "Generates electricity for the grid. Gas burns fuel; solar is cheap to run but produces less; nuclear is expensive to build and runs forever.",
    methods: [
      { id: "gas", name: "Natural Gas", staff: { technician: 25, engineer: 8, laborer: 12, manager: 3 }, output: { electricity: 60000 }, retoolCost: 0.6 },
      { id: "solar", name: "Solar Farm", staff: { technician: 10, engineer: 4, construction: 5, manager: 1 }, output: { electricity: 28000 }, recipe: { electricity: { solar_panels: 0.02, components: 0.01 } }, costMult: 0.8, retoolCost: 0.8 },
      { id: "nuclear", name: "Nuclear", staff: { technician: 60, engineer: 20, laborer: 10, manager: 5 }, output: { electricity: 90000 }, recipe: { electricity: { components: 0.06 } }, costMult: 3, retoolCost: 3 },
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
      { id: "eaf", name: "Electric Arc (Scrap)", staff: { assembler: 55, technician: 20, laborer: 15, engineer: 4, manager: 4 }, output: { steel: 5000 }, upkeep: 550_000, retoolCost: 0.4 },
      { id: "integrated", name: "Integrated (Blast Furnace)", staff: { assembler: 75, technician: 25, laborer: 25, engineer: 6, manager: 5 }, output: { steel: 7500 }, upkeep: 900_000, costMult: 1.5, retoolCost: 0.8 },
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
