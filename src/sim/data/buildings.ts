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
  | "power";

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
  description: string;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: "hq", name: "Corporate Headquarters", short: "HQ", cost: 15e6, buildTime: 6, usesAdmin: false, industry: "office",
    description: "Executives, finance, legal and HR. Each level supports 15 levels of other buildings before efficiency drops.",
    methods: [{ id: "hq", name: "Corporate Office", staff: { manager: 30, professional: 40, clerk: 30 }, output: {}, admin: 15, upkeep: 300_000 }],
  },
  {
    id: "rnd", name: "R&D Lab", short: "R&D", cost: 8e6, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Generates research points that raise product quality.",
    methods: [{ id: "rnd", name: "Applied Research", staff: { scientist: 8, engineer: 15, software: 20, manager: 2 }, output: {}, research: 1, upkeep: 400_000 }],
  },
  {
    id: "assembly", name: "Assembly Plant", short: "Assembly", cost: 40e6, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Turns chips and parts into consumer devices.",
    methods: [
      { id: "phones", name: "Smartphones", staff: { laborer: 90, technician: 15, engineer: 2, manager: 3 }, output: { smartphones: 8000 }, retoolCost: 0.15 },
      { id: "phones_auto", name: "Smartphones (automated)", staff: { laborer: 30, technician: 30, engineer: 7, manager: 3 }, output: { smartphones: 9200 }, retoolCost: 0.5, costMult: 1.3 },
      { id: "computers", name: "Computers", staff: { laborer: 90, technician: 15, engineer: 2, manager: 3 }, output: { computers: 4000 }, retoolCost: 0.15 },
      { id: "computers_auto", name: "Computers (automated)", staff: { laborer: 30, technician: 30, engineer: 7, manager: 3 }, output: { computers: 4600 }, retoolCost: 0.5, costMult: 1.3 },
    ],
  },
  {
    id: "fab", name: "Chip Fab", short: "Fab", cost: 120e6, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Semiconductor fabrication. Hugely expensive, very hungry for technicians and engineers.",
    methods: [{ id: "fab", name: "Logic Chips", staff: { technician: 40, engineer: 15, laborer: 10, manager: 3 }, output: { chips: 400000 } }],
  },
  {
    id: "design", name: "Hardware Design Center", short: "HW Design", cost: 25e6, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Designs and packages AI accelerators from purchased chips.",
    methods: [{ id: "design", name: "AI Accelerators", staff: { engineer: 15, software: 10, technician: 5, manager: 2 }, output: { ai_accelerators: 200 } }],
  },
  {
    id: "battery", name: "Battery Plant", short: "Battery", cost: 20e6, buildTime: 6, usesAdmin: true, industry: "strategic",
    description: "Produces battery packs for vehicles and grid storage.",
    methods: [{ id: "battery", name: "Lithium-ion Cells", staff: { laborer: 30, technician: 15, engineer: 3, manager: 1 }, output: { batteries: 250 } }],
  },
  {
    id: "auto", name: "Auto Plant", short: "Auto", cost: 80e6, buildTime: 9, usesAdmin: true, industry: "factory",
    description: "Builds cars: electric vehicles from batteries, chips and parts, or gasoline vehicles.",
    methods: [
      { id: "auto", name: "EV Assembly Line", staff: { laborer: 150, technician: 40, engineer: 8, manager: 6 }, output: { evs: 300 }, retoolCost: 0.15 },
      { id: "auto_robot", name: "EV Robotic Line", staff: { laborer: 60, technician: 65, engineer: 16, manager: 6 }, output: { evs: 350 }, retoolCost: 0.5, costMult: 1.3 },
      { id: "gas", name: "Gasoline Line", staff: { laborer: 150, technician: 35, engineer: 7, manager: 6 }, output: { gas_cars: 330 }, retoolCost: 0.2 },
    ],
  },
  {
    id: "software", name: "Software Studio", short: "Software", cost: 10e6, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Engineering teams shipping software products and subscriptions.",
    methods: [{ id: "software", name: "Product Engineering", staff: { software: 70, manager: 10, professional: 12, clerk: 8 }, output: { software: 40000 } }],
  },
  {
    id: "datacenter", name: "Data Center", short: "Data Ctr", cost: 100e6, buildTime: 9, usesAdmin: true, industry: "office",
    description: "Runs AI accelerators to sell cloud compute.",
    methods: [{ id: "datacenter", name: "Hyperscale", staff: { technician: 15, software: 5, engineer: 2, manager: 1 }, output: { cloud: 5000 } }],
  },
  {
    id: "analytics", name: "Analytics Office", short: "Analytics", cost: 6e6, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Sells data platforms to government and large enterprises; runs on cloud compute.",
    methods: [{ id: "analytics", name: "Forward-Deployed Teams", staff: { software: 40, professional: 30, engineer: 5, manager: 8, clerk: 7 }, output: { data_platforms: 30 } }],
  },
  {
    id: "adplatform", name: "Ad Platform", short: "Ads", cost: 15e6, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Sells targeted advertising to businesses. Runs on cloud compute.",
    methods: [{ id: "adplatform", name: "Auction Engine", staff: { software: 50, professional: 25, manager: 12, clerk: 13 }, output: { digital_ads: 5000 } }],
  },
  {
    id: "food", name: "Food Processing Plant", short: "Food", cost: 15e6, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Packaged and fresh food for the nation's grocery shelves.",
    methods: [{ id: "food", name: "Processing Line", staff: { laborer: 70, technician: 12, clerk: 4, manager: 4, professional: 2 }, output: { groceries: 40000 } }],
  },
  {
    id: "apparel", name: "Apparel Factory", short: "Apparel", cost: 10e6, buildTime: 3, usesAdmin: true, industry: "factory",
    description: "Clothing and footwear. Most of the world's apparel is imported, so tariffs matter here.",
    methods: [{ id: "apparel", name: "Cut & Sew", staff: { laborer: 75, professional: 8, technician: 8, manager: 4 }, output: { apparel: 45000 } }],
  },
  {
    id: "media", name: "Media Studio", short: "Media", cost: 20e6, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Produces and streams films and series. Content licensing is a big running cost.",
    methods: [{ id: "media", name: "Originals & Licensing", staff: { professional: 45, software: 25, technician: 15, manager: 8, clerk: 7 }, output: { streaming: 350000 }, upkeep: 2_500_000 }],
  },
  {
    id: "pharma", name: "Pharmaceutical Plant", short: "Pharma", cost: 60e6, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Manufactures prescription drugs. Pair it with heavy R&D: quality matters a lot in medicine.",
    methods: [{ id: "pharma", name: "Small-Molecule & Biologics", staff: { technician: 35, laborer: 30, scientist: 15, engineer: 8, manager: 6 }, output: { pharmaceuticals: 20000 } }],
  },
  {
    id: "power", name: "Power Plant", short: "Power", cost: 150e6, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Generates electricity for the grid. Gas burns fuel; solar is cheap to run but produces less; nuclear is expensive to build and runs forever.",
    methods: [
      { id: "gas", name: "Natural Gas", staff: { technician: 25, engineer: 8, laborer: 12, manager: 3 }, output: { electricity: 60000 }, retoolCost: 0.6 },
      { id: "solar", name: "Solar Farm", staff: { technician: 10, engineer: 4, laborer: 5, manager: 1 }, output: { electricity: 28000 }, recipe: { electricity: { components: 0.02 } }, costMult: 0.8, retoolCost: 0.8 },
      { id: "nuclear", name: "Nuclear", staff: { technician: 60, engineer: 20, laborer: 10, manager: 5 }, output: { electricity: 90000 }, recipe: { electricity: { components: 0.06 } }, costMult: 3, retoolCost: 3 },
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
