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
  | "analytics";

/** A production method (Victoria 3 style): one way of running a building. */
export interface MethodDef {
  id: string;
  name: string;
  /** Staff per level. */
  staff: Partial<Record<JobId, number>>;
  /** Output per level per month. */
  output: Partial<Record<GoodId, number>>;
  /** Research points per level per month. */
  research?: number;
  /** Admin capacity (building levels supported) per level. */
  admin?: number;
  /** Non-wage running costs per level per month (rent, equipment, materials). */
  upkeep?: number;
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
  description: string;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: "hq", name: "Corporate Headquarters", short: "HQ", cost: 15e6, buildTime: 6, usesAdmin: false,
    description: "Executives, finance, legal and HR. each level supports 15 levels of other buildings before efficiency drops.",
    methods: [{ id: "hq", name: "Corporate Office", staff: { manager: 30, professional: 40, clerk: 30 }, output: {}, admin: 15, upkeep: 300_000 }],
  },
  {
    id: "rnd", name: "R&D Lab", short: "R&D", cost: 8e6, buildTime: 4, usesAdmin: true,
    description: "Generates research points that raise product quality.",
    methods: [{ id: "rnd", name: "Applied Research", staff: { scientist: 8, engineer: 15, software: 20, manager: 2 }, output: {}, research: 1, upkeep: 400_000 }],
  },
  {
    id: "assembly", name: "Assembly Plant", short: "Assembly", cost: 40e6, buildTime: 6, usesAdmin: true,
    description: "Turns chips and parts into consumer devices.",
    methods: [
      { id: "phones", name: "Smartphones", staff: { laborer: 90, technician: 15, engineer: 2, manager: 3 }, output: { smartphones: 8000 }, retoolCost: 0.15 },
      { id: "phones_auto", name: "Smartphones (automated)", staff: { laborer: 30, technician: 30, engineer: 7, manager: 3 }, output: { smartphones: 9200 }, retoolCost: 0.5 },
      { id: "computers", name: "Computers", staff: { laborer: 90, technician: 15, engineer: 2, manager: 3 }, output: { computers: 4000 }, retoolCost: 0.15 },
      { id: "computers_auto", name: "Computers (automated)", staff: { laborer: 30, technician: 30, engineer: 7, manager: 3 }, output: { computers: 4600 }, retoolCost: 0.5 },
    ],
  },
  {
    id: "fab", name: "Chip Fab", short: "Fab", cost: 120e6, buildTime: 12, usesAdmin: true,
    description: "Semiconductor fabrication. Hugely expensive, very hungry for technicians and engineers.",
    methods: [{ id: "fab", name: "Logic Chips", staff: { technician: 40, engineer: 15, laborer: 10, manager: 3 }, output: { chips: 400000 } }],
  },
  {
    id: "design", name: "Hardware Design Center", short: "HW Design", cost: 25e6, buildTime: 6, usesAdmin: true,
    description: "Designs and packages AI accelerators from purchased chips.",
    methods: [{ id: "design", name: "AI Accelerators", staff: { engineer: 15, software: 10, technician: 5, manager: 2 }, output: { ai_accelerators: 200 } }],
  },
  {
    id: "battery", name: "Battery Plant", short: "Battery", cost: 20e6, buildTime: 6, usesAdmin: true,
    description: "Produces battery packs for vehicles and grid storage.",
    methods: [{ id: "battery", name: "Lithium-ion Cells", staff: { laborer: 30, technician: 15, engineer: 3, manager: 1 }, output: { batteries: 250 } }],
  },
  {
    id: "auto", name: "Auto Plant", short: "Auto", cost: 80e6, buildTime: 9, usesAdmin: true,
    description: "Builds electric vehicles from batteries, chips and parts.",
    methods: [
      { id: "auto", name: "Assembly Line", staff: { laborer: 150, technician: 40, engineer: 8, manager: 6 }, output: { evs: 300 }, retoolCost: 0.15 },
      { id: "auto_robot", name: "Robotic Line", staff: { laborer: 60, technician: 65, engineer: 16, manager: 6 }, output: { evs: 350 }, retoolCost: 0.5 },
    ],
  },
  {
    id: "software", name: "Software Studio", short: "Software", cost: 10e6, buildTime: 3, usesAdmin: true,
    description: "Engineering teams shipping software products and subscriptions.",
    methods: [{ id: "software", name: "Product Engineering", staff: { software: 70, manager: 10, professional: 12, clerk: 8 }, output: { software: 40000 } }],
  },
  {
    id: "datacenter", name: "Data Center", short: "Data Ctr", cost: 100e6, buildTime: 9, usesAdmin: true,
    description: "Runs AI accelerators to sell cloud compute.",
    methods: [{ id: "datacenter", name: "Hyperscale", staff: { technician: 15, software: 5, engineer: 2, manager: 1 }, output: { cloud: 5000 } }],
  },
  {
    id: "analytics", name: "Analytics Office", short: "Analytics", cost: 6e6, buildTime: 3, usesAdmin: true,
    description: "Sells data platforms to government and large enterprises; runs on cloud compute.",
    methods: [{ id: "analytics", name: "Forward-Deployed Teams", staff: { software: 40, professional: 30, engineer: 5, manager: 8, clerk: 7 }, output: { data_platforms: 30 } }],
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
