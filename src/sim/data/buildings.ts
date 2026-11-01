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
  | "logistics"
  | "bank"
  | "insurer"
  | "assetmgr"
  | "payments"
  | "ibank"
  | "hospital"
  | "clinic"
  | "healthplan"
  | "seniorcare"
  | "labs"
  | "bigbox"
  | "ecommerce"
  | "homecenter"
  | "pharmacy"
  | "gasstation"
  | "supermarket"
  | "hotel"
  | "cruiseline"
  | "themepark"
  | "casino"
  | "venue"
  | "sportsteam"
  | "gym"
  | "cinema"
  | "cosmetics"
  | "salon"
  | "tobacco"
  | "brewery"
  | "university"
  | "childcare"
  | "apartments"
  | "officetower"
  | "waterworks"
  | "waste"
  | "broadband"
  | "satellite"
  | "rideshare"
  | "railroad"
  | "launchpad"
  | "machinery"
  | "electrical"
  | "robotics"
  | "chiptools"
  | "shipyard"
  | "tireplant"
  | "toyfactory"
  | "sportsgoods"
  | "petfood"
  | "jeweler"
  | "label"
  | "newsroom"
  | "consultancy"
  | "lawfirm"
  | "auditfirm"
  | "staffing"
  | "cyber"
  | "contractor";

/** Industries, for know-how and economies of scale. Related industries share some know-how. */
export type SectorId =
  | "electronics" | "semis" | "autos" | "software" | "cloud" | "consumer" | "media" | "pharma"
  | "power" | "oilgas" | "materials" | "agriculture"
  | "mining" | "forestry" | "aerospace" | "telecom" | "transport" | "construction" | "hospitality"
  | "finance" | "healthsvc" | "retail" | "leisure" | "education" | "realestate" | "utilities" | "industrial" | "services";

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
  construction: { name: "Construction", related: ["forestry", "materials"] },
  hospitality: { name: "Restaurants", related: ["consumer", "agriculture", "retail", "leisure"] },
  finance: { name: "Banking and finance", related: ["software", "realestate", "services"] },
  healthsvc: { name: "Health services", related: ["pharma", "services"] },
  retail: { name: "Retail", related: ["consumer", "transport", "hospitality"] },
  leisure: { name: "Travel and leisure", related: ["hospitality", "media", "consumer"] },
  education: { name: "Education", related: ["services", "healthsvc"] },
  realestate: { name: "Real estate", related: ["construction", "finance"] },
  utilities: { name: "Utilities", related: ["power", "construction"] },
  industrial: { name: "Industrial machinery", related: ["autos", "aerospace", "materials", "electronics"] },
  services: { name: "Professional services", related: ["finance", "software"] },
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
      { id: "coffee", name: "Coffee Shops", staff: { service: 55, manager: 4, clerk: 2 }, output: { coffee: 150000 }, upkeep: 160000, retoolCost: 0.3 },
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
  {
    id: "bank", sector: "finance", name: "Bank", short: "Bank", cost: 30000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Checking, savings, mortgages and small-business loans across a region.",
    methods: [
      { id: "branches", name: "Branch Network", staff: { clerk: 40, retail: 10, sales: 15, accountant: 10, professional: 8, manager: 8 }, output: { banking: 200000 }, upkeep: 350000 },
      { id: "digital", name: "Digital Bank", staff: { software: 25, datasci: 8, clerk: 15, accountant: 6, manager: 5 }, output: { banking: 213333.33333333 }, upkeep: 250000, costMult: 1.2, retoolCost: 0.4 },
    ],
  },
  {
    id: "insurer", sector: "finance", name: "Insurance Carrier", short: "Insurance", cost: 40000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Writes policies, invests the float and pays claims. A bad hurricane season hurts.",
    methods: [
      { id: "pc", name: "Property & Casualty", staff: { clerk: 35, accountant: 15, professional: 15, sales: 15, lawyer: 4, datasci: 4, manager: 8 }, output: { insurance: 37500 }, upkeep: 250000 },
      { id: "life", name: "Life & Annuities", staff: { accountant: 20, sales: 25, professional: 15, clerk: 25, datasci: 6, manager: 8 }, output: { insurance: 35000 }, upkeep: 200000, retoolCost: 0.3 },
    ],
  },
  {
    id: "assetmgr", sector: "finance", name: "Asset Manager", short: "Asset mgmt", cost: 20000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Mutual funds, ETFs and advice for people with money to invest. Richer customers, fatter fees.",
    methods: [
      { id: "active", name: "Active Funds & Advice", staff: { professional: 30, accountant: 20, sales: 20, datasci: 8, lawyer: 4, clerk: 10, manager: 10 }, output: { wealth_mgmt: 10000 }, upkeep: 400000 },
      { id: "index", name: "Index Funds", staff: { software: 10, accountant: 10, datasci: 6, clerk: 8, manager: 4 }, output: { wealth_mgmt: 6500 }, upkeep: 200000, costMult: 1.0, retoolCost: 0.3 },
    ],
  },
  {
    id: "payments", sector: "finance", name: "Payments Network", short: "Payments", cost: 25000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Card networks and checkout software. Takes a sliver of every sale in the country.",
    methods: [
      { id: "payments", name: "Card & Checkout Network", staff: { software: 35, datasci: 10, professional: 10, clerk: 10, lawyer: 3, manager: 6 }, output: { payments: 166666.66666667 }, upkeep: 400000 },
    ],
  },
  {
    id: "ibank", sector: "finance", name: "Investment Bank", short: "I-bank", cost: 30000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Mergers, IPOs and bond deals for big companies. Fees boom when markets do.",
    methods: [
      { id: "ibank", name: "Advisory & Underwriting", staff: { professional: 40, accountant: 20, lawyer: 8, datasci: 6, clerk: 10, manager: 12 }, output: { ibanking: 3 }, upkeep: 700000 },
    ],
  },
  {
    id: "hospital", sector: "healthsvc", name: "Hospital", short: "Hospital", cost: 40000000, buildTime: 12, usesAdmin: true, industry: "office",
    description: "Beds, emergency rooms and operating theaters. Nurses are the bottleneck.",
    methods: [
      { id: "community", name: "Community Hospital", staff: { nurse: 35, physician: 6, care: 25, technician: 10, clerk: 12, service: 8, manager: 4 }, output: { hospital_care: 800 }, upkeep: 400000 },
      { id: "academic", name: "Academic Medical Center", staff: { nurse: 35, physician: 12, scientist: 4, care: 20, technician: 12, clerk: 10, manager: 5 }, output: { hospital_care: 1066.66666667 }, upkeep: 600000, costMult: 1.5, retoolCost: 0.5 },
    ],
  },
  {
    id: "clinic", sector: "healthsvc", name: "Clinic Network", short: "Clinics", cost: 10000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Urgent care, primary care and outpatient surgery centers.",
    methods: [
      { id: "clinic", name: "Urgent & Primary Care", staff: { physician: 8, nurse: 15, care: 10, technician: 5, clerk: 12, manager: 3 }, output: { clinics: 6400 }, upkeep: 150000 },
    ],
  },
  {
    id: "healthplan", sector: "healthsvc", name: "Health Insurer", short: "Health plan", cost: 30000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Collects premiums and pays doctors' bills. Thin margins on enormous revenue.",
    methods: [
      { id: "healthplan", name: "Managed Care Plan", staff: { clerk: 40, nurse: 8, accountant: 12, datasci: 6, professional: 12, sales: 10, manager: 8 }, output: { health_insurance: 10909.09090909 }, upkeep: 200000 },
    ],
  },
  {
    id: "seniorcare", sector: "healthsvc", name: "Senior Living", short: "Senior living", cost: 12000000, buildTime: 6, usesAdmin: true, industry: "office",
    description: "Assisted living and nursing homes. Care workers are most of the cost.",
    methods: [
      { id: "seniorcare", name: "Assisted Living", staff: { care: 45, nurse: 10, service: 15, clerk: 4, manager: 3 }, output: { senior_care: 150 }, upkeep: 150000 },
    ],
  },
  {
    id: "labs", sector: "healthsvc", name: "Diagnostics Lab", short: "Labs", cost: 15000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Blood work, imaging and pathology for doctors and hospitals.",
    methods: [
      { id: "labs", name: "Reference Lab & Imaging", staff: { technician: 30, scientist: 6, nurse: 6, physician: 2, clerk: 8, driver: 4, manager: 3 }, output: { diagnostics: 25000 }, upkeep: 200000 },
    ],
  },
  {
    id: "bigbox", sector: "retail", name: "Big-Box Store", short: "Big box", cost: 20000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Supercenters selling a bit of everything. Margins are thin; volume is everything.",
    methods: [
      { id: "supercenter", name: "Supercenter", staff: { retail: 60, laborer: 12, driver: 4, clerk: 5, manager: 5 }, output: { big_box: 50000 }, upkeep: 150000 },
      { id: "club", name: "Warehouse Club", staff: { retail: 45, laborer: 15, clerk: 4, manager: 4 }, output: { big_box: 53333.33333333 }, upkeep: 150000, costMult: 1.2, retoolCost: 0.3 },
    ],
  },
  {
    id: "ecommerce", sector: "retail", name: "Fulfillment Center", short: "E-commerce", cost: 30000000, buildTime: 6, usesAdmin: true, industry: "office",
    description: "Warehouses and last-mile vans for an online store.",
    methods: [
      { id: "ecommerce", name: "Fulfillment Center", staff: { laborer: 60, driver: 15, software: 6, technician: 6, clerk: 5, manager: 5 }, output: { ecommerce: 88888.88888889 }, upkeep: 300000 },
      { id: "robotic", name: "Robotic Fulfillment", staff: { laborer: 25, technician: 15, software: 8, driver: 15, manager: 4 }, output: { ecommerce: 93333.33333333 }, upkeep: 500000, costMult: 1.4, retoolCost: 0.4 },
    ],
  },
  {
    id: "homecenter", sector: "retail", name: "Home Center", short: "Home centers", cost: 25000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Lumber, paint, appliances and garden supplies for contractors and weekend projects.",
    methods: [
      { id: "homecenter", name: "Home Center", staff: { retail: 50, laborer: 15, sales: 5, clerk: 4, manager: 5 }, output: { home_improvement: 35000 }, upkeep: 150000 },
    ],
  },
  {
    id: "pharmacy", sector: "retail", name: "Drugstore Chain", short: "Drugstores", cost: 12000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Pharmacy counters up front, snacks and shampoo in the aisles.",
    methods: [
      { id: "pharmacy", name: "Drugstore", staff: { retail: 30, physician: 6, technician: 8, clerk: 4, manager: 3 }, output: { drugstores: 55000 }, upkeep: 120000 },
    ],
  },
  {
    id: "gasstation", sector: "retail", name: "Gas Station Chain", short: "Gas stations", cost: 10000000, buildTime: 2, usesAdmin: true, industry: "office",
    description: "Pumps, a convenience store and a car wash. Fuel is a loss leader for the snacks.",
    methods: [
      { id: "gasstation", name: "Fuel & Convenience", staff: { retail: 35, driver: 4, technician: 2, clerk: 3, manager: 3 }, output: { gas_stations: 33333.33333333 }, upkeep: 80000 },
    ],
  },
  {
    id: "supermarket", sector: "retail", name: "Supermarket Chain", short: "Supermarkets", cost: 15000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Neighborhood grocery stores with a butcher, a bakery and a pharmacy counter.",
    methods: [
      { id: "supermarket", name: "Supermarket", staff: { retail: 55, service: 10, laborer: 8, driver: 3, clerk: 4, manager: 4 }, output: { supermarkets: 34285.71428571 }, upkeep: 120000 },
    ],
  },
  {
    id: "hotel", sector: "leisure", name: "Hotel", short: "Hotels", cost: 15000000, buildTime: 10, usesAdmin: true, industry: "office",
    description: "Rooms by the night: roadside motels, full-service city hotels or beach resorts.",
    methods: [
      { id: "economy", name: "Roadside Motels", staff: { service: 30, clerk: 5, technician: 3, manager: 2 }, output: { hotel_stays: 6666.66666667 }, upkeep: 350000 },
      { id: "fullservice", name: "Full-Service Hotels", staff: { service: 60, clerk: 10, sales: 4, technician: 5, manager: 5 }, output: { hotel_stays: 14666.66666667 }, upkeep: 800000, costMult: 2.0, retoolCost: 0.4 },
      { id: "resort", name: "Luxury Resorts", staff: { service: 80, designer: 3, sales: 6, technician: 6, clerk: 8, manager: 6 }, output: { resort_stays: 6000 }, upkeep: 1100000, costMult: 3.0, retoolCost: 0.6 },
    ],
  },
  {
    id: "cruiseline", sector: "leisure", name: "Cruise Line", short: "Cruises", cost: 250000000, buildTime: 24, usesAdmin: true, industry: "office",
    description: "One ship per level. Floating hotels with buffets.",
    methods: [
      { id: "cruiseline", name: "Cruise Ship", staff: { service: 150, technician: 20, engineer: 5, clerk: 10, manager: 8 }, output: { cruises: 45000 }, upkeep: 2500000 },
    ],
  },
  {
    id: "themepark", sector: "leisure", name: "Theme Park", short: "Theme parks", cost: 200000000, buildTime: 18, usesAdmin: true, industry: "office",
    description: "Roller coasters, characters you invented yourself and very expensive churros.",
    methods: [
      { id: "themepark", name: "Theme Park", staff: { service: 120, technician: 15, designer: 5, engineer: 3, clerk: 8, manager: 6 }, output: { theme_parks: 50000 }, upkeep: 1500000 },
    ],
  },
  {
    id: "casino", sector: "leisure", name: "Casino", short: "Casinos", cost: 80000000, buildTime: 12, usesAdmin: true, industry: "office",
    description: "Slots, tables and sportsbooks. Legal only where states allow it.",
    methods: [
      { id: "resort", name: "Casino Resort", staff: { service: 80, clerk: 15, technician: 6, accountant: 4, manager: 6 }, output: { casinos: 35000 }, upkeep: 900000 },
      { id: "online", name: "Online Sportsbook", staff: { software: 25, datasci: 10, clerk: 10, lawyer: 3, manager: 4 }, output: { casinos: 30000 }, upkeep: 700000, costMult: 0.3, retoolCost: 0.4 },
    ],
  },
  {
    id: "venue", sector: "leisure", name: "Arena & Promoter", short: "Live events", cost: 60000000, buildTime: 10, usesAdmin: true, industry: "office",
    description: "Concert halls, arenas and the ticketing app everyone complains about.",
    methods: [
      { id: "venue", name: "Arena & Ticketing", staff: { service: 60, technician: 12, sales: 6, designer: 3, clerk: 6, manager: 5 }, output: { live_events: 22727.27272727 }, upkeep: 500000 },
    ],
  },
  {
    id: "sportsteam", sector: "leisure", name: "Sports Franchise", short: "Sports team", cost: 250000000, buildTime: 6, usesAdmin: true, industry: "office",
    description: "A pro team and its stadium. Player salaries eat half of revenue.",
    methods: [
      { id: "sportsteam", name: "Franchise & Stadium", staff: { service: 40, professional: 10, sales: 10, technician: 6, manager: 6 }, output: { pro_sports: 200000 }, upkeep: 500000 },
    ],
  },
  {
    id: "gym", sector: "leisure", name: "Gym Chain", short: "Gyms", cost: 6000000, buildTime: 2, usesAdmin: true, industry: "office",
    description: "Treadmills, trainers and members who signed up in January.",
    methods: [
      { id: "gym", name: "Fitness Clubs", staff: { service: 20, teacher: 6, clerk: 4, manager: 2 }, output: { fitness: 14000 }, upkeep: 220000 },
    ],
  },
  {
    id: "cinema", sector: "leisure", name: "Movie Theater Chain", short: "Cinemas", cost: 8000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Screens, recliners and popcorn margins.",
    methods: [
      { id: "cinema", name: "Multiplex", staff: { service: 30, technician: 3, clerk: 2, manager: 2 }, output: { cinemas: 64285.71428571 }, upkeep: 200000 },
    ],
  },
  {
    id: "cosmetics", sector: "consumer", name: "Cosmetics Plant", short: "Cosmetics", cost: 30000000, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Shampoo, skincare and makeup, from drugstore basics to department-store luxury.",
    methods: [
      { id: "mass", name: "Drugstore Brands", staff: { assembler: 40, scientist: 4, designer: 4, technician: 6, sales: 6, manager: 4 }, output: { cosmetics: 146666.66666667 }, upkeep: 250000 },
      { id: "prestige", name: "Prestige Beauty", staff: { assembler: 30, scientist: 6, designer: 10, technician: 5, sales: 10, manager: 5 }, output: { prestige_beauty: 46666.66666667 }, upkeep: 450000, costMult: 1.4, retoolCost: 0.5 },
    ],
  },
  {
    id: "salon", sector: "leisure", name: "Salon Chain", short: "Salons", cost: 3000000, buildTime: 1, usesAdmin: true, industry: "office",
    description: "Haircuts, nails and spa days.",
    methods: [
      { id: "salon", name: "Salons & Spas", staff: { service: 25, clerk: 2, manager: 2 }, output: { salons: 8000 }, upkeep: 120000 },
    ],
  },
  {
    id: "tobacco", sector: "consumer", name: "Cigarette Factory", short: "Tobacco", cost: 40000000, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Cigarettes and vapes. Enormous margins, shrinking market, terrible press.",
    methods: [
      { id: "tobacco", name: "Cigarettes & Vapes", staff: { assembler: 40, technician: 8, scientist: 2, sales: 8, lawyer: 3, manager: 4 }, output: { tobacco: 333333.33333333 }, upkeep: 500000 },
    ],
  },
  {
    id: "brewery", sector: "consumer", name: "Brewery & Distillery", short: "Alcohol", cost: 30000000, buildTime: 6, usesAdmin: true, industry: "factory",
    description: "Beer, wine and spirits, brewed or distilled and trucked to distributors.",
    methods: [
      { id: "beer", name: "Brewery", staff: { assembler: 30, technician: 6, driver: 8, sales: 8, manager: 4 }, output: { alcohol: 83333.33333333 }, upkeep: 250000 },
      { id: "spirits", name: "Winery & Distillery", staff: { assembler: 20, farmworker: 10, technician: 6, designer: 3, sales: 10, manager: 4 }, output: { alcohol: 93333.33333333 }, upkeep: 350000, costMult: 1.3, retoolCost: 0.4 },
    ],
  },
  {
    id: "university", sector: "education", name: "Private University", short: "Universities", cost: 60000000, buildTime: 12, usesAdmin: true, industry: "office",
    description: "Tuition-funded colleges and prep schools, on a campus or online.",
    methods: [
      { id: "campus", name: "Campus University", staff: { teacher: 40, professional: 15, clerk: 15, scientist: 5, service: 15, manager: 6 }, output: { higher_ed: 1600 }, upkeep: 400000 },
      { id: "online", name: "Online University", staff: { teacher: 25, software: 6, clerk: 12, sales: 8, manager: 4 }, output: { higher_ed: 1200 }, upkeep: 200000, costMult: 0.3, retoolCost: 0.3 },
      { id: "prep", name: "Prep Schools", staff: { teacher: 45, clerk: 8, service: 10, manager: 4 }, output: { private_school: 1111.11111111 }, upkeep: 350000, costMult: 0.8, retoolCost: 0.4 },
    ],
  },
  {
    id: "childcare", sector: "education", name: "Child Care Centers", short: "Child care", cost: 4000000, buildTime: 2, usesAdmin: true, industry: "office",
    description: "Daycare and preschool. Care-worker wages are almost the whole bill.",
    methods: [
      { id: "childcare", name: "Daycare Centers", staff: { care: 30, teacher: 6, clerk: 2, manager: 2 }, output: { childcare: 375 }, upkeep: 100000 },
    ],
  },
  {
    id: "apartments", sector: "realestate", name: "Apartment Portfolio", short: "Apartments", cost: 50000000, buildTime: 18, usesAdmin: true, industry: "office",
    description: "Rental buildings. Slow, steady rent checks; best bought with borrowed money.",
    methods: [
      { id: "apartments", name: "Garden & Mid-Rise", staff: { service: 6, technician: 4, clerk: 3, sales: 2, manager: 2 }, output: { apartments: 625 }, upkeep: 300000 },
    ],
  },
  {
    id: "officetower", sector: "realestate", name: "Office Tower", short: "Offices", cost: 60000000, buildTime: 18, usesAdmin: true, industry: "office",
    description: "Leases floors to other companies. Remote work made this a harder business.",
    methods: [
      { id: "officetower", name: "Class A Office", staff: { service: 10, technician: 5, clerk: 3, sales: 3, manager: 2 }, output: { office_space: 45.71428571 }, upkeep: 400000 },
    ],
  },
  {
    id: "waterworks", sector: "utilities", name: "Water Utility", short: "Water", cost: 25000000, buildTime: 12, usesAdmin: true, industry: "office",
    description: "Treatment plants and pipes. A regulated monopoly with steady returns.",
    methods: [
      { id: "waterworks", name: "Treatment & Mains", staff: { technician: 15, laborer: 10, engineer: 3, clerk: 4, manager: 2 }, output: { water: 83333.33333333 }, upkeep: 200000 },
    ],
  },
  {
    id: "waste", sector: "utilities", name: "Waste Hauler & Landfill", short: "Waste", cost: 15000000, buildTime: 4, usesAdmin: true, industry: "office",
    description: "Garbage trucks, recycling plants and the landfill outside town.",
    methods: [
      { id: "waste", name: "Collection & Landfill", staff: { driver: 25, laborer: 15, technician: 4, clerk: 3, manager: 2 }, output: { waste: 33333.33333333 }, upkeep: 150000 },
    ],
  },
  {
    id: "broadband", sector: "telecom", name: "Cable & Fiber Network", short: "Broadband", cost: 120000000, buildTime: 12, usesAdmin: true, industry: "office",
    description: "Home internet and TV over cable or fiber. Expensive to dig, sticky once installed.",
    methods: [
      { id: "cable", name: "Cable (DOCSIS)", staff: { technician: 40, construction: 10, retail: 10, clerk: 15, engineer: 5, manager: 5 }, output: { broadband: 64285.71428571 }, upkeep: 1200000 },
      { id: "fiber", name: "Fiber to the Home", staff: { technician: 35, construction: 20, retail: 8, clerk: 12, engineer: 6, manager: 5 }, output: { broadband: 71428.57142857 }, upkeep: 1000000, costMult: 1.4, retoolCost: 0.6 },
    ],
  },
  {
    id: "satellite", sector: "aerospace", name: "Satellite Constellation", short: "Satellites", cost: 150000000, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Low-orbit satellites beaming internet to farms, ships and airplanes.",
    methods: [
      { id: "satellite", name: "Low-Orbit Constellation", staff: { engineer: 15, software: 10, technician: 15, clerk: 5, manager: 3 }, output: { satellite_internet: 30000 }, upkeep: 600000 },
    ],
  },
  {
    id: "rideshare", sector: "transport", name: "Ride-Hailing App", short: "Ride-hailing", cost: 15000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "An app matching drivers with riders and takeout orders. Drivers get most of the fare.",
    methods: [
      { id: "rideshare", name: "Rides & Delivery", staff: { software: 25, datasci: 8, clerk: 10, professional: 6, manager: 4 }, output: { rideshare: 200000 }, upkeep: 300000 },
    ],
  },
  {
    id: "railroad", sector: "transport", name: "Railroad", short: "Railroad", cost: 90000000, buildTime: 18, usesAdmin: true, industry: "office",
    description: "Freight trains hauling coal, grain, chemicals and containers.",
    methods: [
      { id: "railroad", name: "Class I Freight", staff: { driver: 15, technician: 20, laborer: 15, engineer: 3, clerk: 5, manager: 4 }, output: { rail_freight: 1166.66666667 }, upkeep: 800000 },
    ],
  },
  {
    id: "launchpad", sector: "aerospace", name: "Rocket Factory & Pad", short: "Launch", cost: 200000000, buildTime: 18, usesAdmin: true, industry: "strategic",
    description: "Builds rockets and launches satellites for governments and companies.",
    methods: [
      { id: "launchpad", name: "Reusable Rockets", staff: { engineer: 40, technician: 40, assembler: 20, software: 10, manager: 5 }, output: { space_launch: 0.1 }, upkeep: 1000000 },
    ],
  },
  {
    id: "machinery", sector: "industrial", name: "Machinery Plant", short: "Machinery", cost: 80000000, buildTime: 10, usesAdmin: true, industry: "factory",
    description: "Bulldozers, excavators, tractors and combines.",
    methods: [
      { id: "construction", name: "Construction & Mining Equipment", staff: { assembler: 60, technician: 15, engineer: 10, designer: 2, sales: 5, manager: 5 }, output: { machinery: 20 }, upkeep: 300000 },
      { id: "farm", name: "Tractors & Combines", staff: { assembler: 55, technician: 18, engineer: 10, designer: 2, sales: 6, manager: 5 }, output: { machinery: 20 }, upkeep: 300000, retoolCost: 0.3 },
    ],
  },
  {
    id: "electrical", sector: "industrial", name: "Electrical Equipment Plant", short: "Electrical", cost: 50000000, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Transformers, switchgear and HVAC. Data centers and the grid want all you can make.",
    methods: [
      { id: "electrical", name: "Transformers & Switchgear", staff: { assembler: 50, technician: 15, engineer: 10, sales: 4, manager: 4 }, output: { electrical_equipment: 80 }, upkeep: 250000 },
    ],
  },
  {
    id: "robotics", sector: "industrial", name: "Robotics Plant", short: "Robotics", cost: 40000000, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Robot arms and automated lines for other people's factories.",
    methods: [
      { id: "robotics", name: "Robot Arms", staff: { engineer: 20, software: 10, assembler: 25, technician: 10, manager: 4 }, output: { robots: 43.75 }, upkeep: 250000 },
    ],
  },
  {
    id: "chiptools", sector: "semis", name: "Chip Equipment Plant", short: "Chip tools", cost: 80000000, buildTime: 12, usesAdmin: true, industry: "strategic",
    description: "Deposition, etching and inspection tools that chip fabs can't run without.",
    methods: [
      { id: "chiptools", name: "Deposition & Etch Tools", staff: { engineer: 30, scientist: 10, technician: 20, assembler: 20, software: 6, manager: 5 }, output: { chip_tools: 1.2 }, upkeep: 400000 },
    ],
  },
  {
    id: "shipyard", sector: "aerospace", name: "Shipyard", short: "Shipyard", cost: 150000000, buildTime: 24, usesAdmin: true, industry: "strategic",
    description: "Navy ships and commercial vessels, built in a dry dock over years.",
    methods: [
      { id: "shipyard", name: "Dry Dock", staff: { assembler: 80, construction: 30, technician: 30, engineer: 15, manager: 6 }, output: { ships: 0.014 }, upkeep: 800000 },
    ],
  },
  {
    id: "tireplant", sector: "autos", name: "Tire Plant", short: "Tires", cost: 40000000, buildTime: 8, usesAdmin: true, industry: "factory",
    description: "Rubber, steel belts and tread. Every car needs four, then four more.",
    methods: [
      { id: "tireplant", name: "Radial Tires", staff: { assembler: 50, technician: 10, engineer: 4, manager: 4 }, output: { tires: 16666.66666667 }, upkeep: 200000 },
    ],
  },
  {
    id: "toyfactory", sector: "consumer", name: "Toy Company", short: "Toys", cost: 15000000, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Action figures, board games and building bricks of your own design.",
    methods: [
      { id: "toyfactory", name: "Design & Assembly", staff: { assembler: 40, designer: 8, sales: 4, manager: 3 }, output: { toys: 60000 }, upkeep: 150000 },
    ],
  },
  {
    id: "sportsgoods", sector: "consumer", name: "Sporting Goods Plant", short: "Sporting goods", cost: 15000000, buildTime: 4, usesAdmin: true, industry: "factory",
    description: "Bikes, balls, golf clubs and camping gear.",
    methods: [
      { id: "sportsgoods", name: "Sporting Goods Line", staff: { assembler: 40, designer: 6, technician: 4, sales: 4, manager: 3 }, output: { sporting_goods: 26666.66666667 }, upkeep: 120000 },
    ],
  },
  {
    id: "petfood", sector: "consumer", name: "Pet Food Plant", short: "Pet food", cost: 25000000, buildTime: 5, usesAdmin: true, industry: "factory",
    description: "Kibble, treats and litter. Americans spend more on pets every year.",
    methods: [
      { id: "petfood", name: "Kibble & Treats", staff: { assembler: 35, technician: 6, scientist: 2, sales: 5, manager: 3 }, output: { pet_food: 66666.66666667 }, upkeep: 150000 },
    ],
  },
  {
    id: "jeweler", sector: "consumer", name: "Jeweler", short: "Jewelry", cost: 10000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Rings, watches and a flagship store on the right avenue.",
    methods: [
      { id: "jeweler", name: "Design & Boutiques", staff: { designer: 10, assembler: 15, retail: 15, sales: 5, manager: 3 }, output: { jewelry: 3000 }, upkeep: 200000 },
    ],
  },
  {
    id: "label", sector: "media", name: "Record Label & Audio App", short: "Music", cost: 10000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Signs artists, owns catalogs and runs a streaming app. Royalties take a third.",
    methods: [
      { id: "label", name: "Label & Streaming", staff: { professional: 10, designer: 10, software: 10, sales: 5, lawyer: 3, manager: 4 }, output: { music: 163636.36363636 }, upkeep: 200000 },
    ],
  },
  {
    id: "newsroom", sector: "media", name: "Newsroom", short: "News", cost: 10000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Reporters, editors and a printing press, or just a website and a paywall.",
    methods: [
      { id: "print", name: "Newspapers & Magazines", staff: { professional: 25, designer: 5, assembler: 10, driver: 6, sales: 8, manager: 4 }, output: { news: 100000 }, upkeep: 200000 },
      { id: "digital", name: "Digital News", staff: { professional: 25, software: 6, designer: 4, sales: 8, manager: 3 }, output: { news: 91666.66666667 }, upkeep: 120000, costMult: 0.7, retoolCost: 0.3, recipe: { news: { cloud: 0.00048, components: 0.0072 } } },
    ],
  },
  {
    id: "consultancy", sector: "services", name: "Consulting Firm", short: "Consulting", cost: 8000000, buildTime: 2, usesAdmin: true, industry: "office",
    description: "Strategy decks, operations fixes and IT projects for other companies.",
    methods: [
      { id: "consultancy", name: "Strategy & Operations", staff: { professional: 50, datasci: 6, manager: 10, clerk: 6 }, output: { consulting: 32 }, upkeep: 500000 },
    ],
  },
  {
    id: "lawfirm", sector: "services", name: "Law Firm", short: "Law", cost: 6000000, buildTime: 2, usesAdmin: true, industry: "office",
    description: "Litigation, deals and regulatory work, billed by the hour.",
    methods: [
      { id: "lawfirm", name: "Full-Service Firm", staff: { lawyer: 30, professional: 10, clerk: 15, manager: 4 }, output: { legal: 40 }, upkeep: 600000 },
    ],
  },
  {
    id: "auditfirm", sector: "services", name: "Accounting Firm", short: "Accounting", cost: 5000000, buildTime: 2, usesAdmin: true, industry: "office",
    description: "Audits, taxes and advisory. Every public company needs one.",
    methods: [
      { id: "auditfirm", name: "Audit & Tax", staff: { accountant: 45, professional: 8, clerk: 12, manager: 5 }, output: { accounting: 40 }, upkeep: 400000 },
    ],
  },
  {
    id: "staffing", sector: "services", name: "Staffing Agency", short: "Staffing", cost: 3000000, buildTime: 1, usesAdmin: true, industry: "office",
    description: "Temps and recruiters for warehouses, hospitals and offices.",
    methods: [
      { id: "staffing", name: "Temp & Recruiting", staff: { sales: 15, clerk: 15, professional: 6, manager: 3 }, output: { staffing: 500 }, upkeep: 300000 },
    ],
  },
  {
    id: "cyber", sector: "software", name: "Security Operations Center", short: "Cybersecurity", cost: 12000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Firewalls, endpoint software and analysts watching for intruders around the clock.",
    methods: [
      { id: "cyber", name: "Managed Security", staff: { software: 40, datasci: 8, technician: 10, sales: 6, manager: 5 }, output: { cybersecurity: 20000 }, upkeep: 300000 },
    ],
  },
  {
    id: "contractor", sector: "construction", name: "General Contractor", short: "Contractor", cost: 15000000, buildTime: 3, usesAdmin: true, industry: "office",
    description: "Builds offices, warehouses, hospitals, schools and data centers for other people.",
    methods: [
      { id: "contractor", name: "Commercial Builder", staff: { construction: 70, laborer: 15, engineer: 6, clerk: 3, manager: 6 }, output: { commercial_construction: 1 }, upkeep: 800000 },
    ],
  },
];

export const BUILDING_BY_ID: Record<BuildingTypeId, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingTypeId, BuildingDef>;

export function methodOf(type: BuildingTypeId, methodId: string): MethodDef {
  const def = BUILDING_BY_ID[type];
  return def.methods.find((m) => m.id === methodId) ?? def.methods[0];
}

/** Which building + method produces a given good (first match). */
const PRODUCER = new Map<GoodId, { type: BuildingTypeId; method: string }>();
for (const b of BUILDINGS) for (const m of b.methods) for (const g in m.output) if (!PRODUCER.has(g as GoodId)) PRODUCER.set(g as GoodId, { type: b.id, method: m.id });
export function producerOf(good: GoodId): { type: BuildingTypeId; method: string } | undefined {
  return PRODUCER.get(good);
}
