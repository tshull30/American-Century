// Every game gets a different cast: a random subset of the hand-written companies plus
// dozens of procedurally generated ones across every industry.
import { BUILDING_BY_ID, producerOf } from "./data/buildings";
import { COMPANY_SEEDS, type CompanySeed } from "./data/companies";
import { GOODS, GOOD_BY_ID, type GoodId, type TechId } from "./data/goods";
import { RESOURCES } from "./data/resources";
import { STATES, STATE_BY_CODE } from "./data/states";

/** Small deterministic RNG so a roster can be rebuilt from its seed. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hand-written companies that almost always appear (the household names). */
const ANCHORS = new Set(["orchard", "windward", "verdant", "kestrel", "summit", "atlas", "lumiverse", "gulfstar", "cascade", "motorcity", "redbrick"]);

const PREFIX = [
  "Aster", "Basalt", "Cobalt", "Delta", "Ember", "Fathom", "Granite", "Halcyon", "Iris", "Juniper", "Keystone", "Lumen", "Meridian", "Nimbus", "Onyx",
  "Prairie", "Quarry", "Redwood", "Sable", "Tidal", "Umber", "Vantage", "Willow", "Zephyr", "Harbor", "Beacon", "Canyon", "Polar", "Ironwood", "Bluffton",
  "Cardinal", "Driftless", "Eastgate", "Foxhollow", "Gilded", "Highline", "Ivory", "Jasper", "Kingfisher", "Lakeshore", "Marlowe", "Northwind", "Oakmont",
  "Pinnacle", "Quill", "Ridgeway", "Sterling", "Thornbury", "Union", "Vireo", "Westbrook", "Yellowstone", "Allegheny", "Bayou", "Cumberland", "Dakota",
  "Everglade", "Frontier", "Golden Gate", "Hudson", "Ozark", "Palisade", "Sawtooth", "Shenandoah", "Sonoran", "Tamarack", "Wabash", "Cascadia", "Mesa",
  "Old Dominion", "Lone Pine", "Twin Rivers", "Great Plains", "Big Sky", "Copper State", "Magnolia", "Peachtree", "Buckeye", "Hoosier", "Badger",
];

const SUFFIX: Partial<Record<GoodId, string[]>> = {
  software: ["Labs", "Software", "AI", "Systems", "Cloud"], data_platforms: ["Analytics", "Intelligence", "Data"], cloud: ["Compute", "Cloud", "Datacenters"],
  evs: ["Motors", "Electric", "Mobility"], gas_cars: ["Motors", "Automotive", "Motor Works"], batteries: ["Energy", "Cells", "Battery"],
  chips: ["Semiconductor", "Silicon", "Microdevices"], ai_accelerators: ["Silicon", "Compute"], smartphones: ["Devices", "Mobile"], computers: ["Computing", "Machines"],
  digital_ads: ["Media", "Social", "Ads"], groceries: ["Foods", "Provisions", "Kitchen"], apparel: ["Apparel", "Outfitters", "Threads"], streaming: ["Studios", "Pictures"],
  pharmaceuticals: ["Bio", "Therapeutics", "Pharma"], electricity: ["Power", "Energy", "Electric"], crude_oil: ["Petroleum", "Energy", "Resources", "Oil"],
  natural_gas: ["Gas", "Midstream", "Resources"], fuel: ["Refining", "Fuels"], steel: ["Steel", "Metals"], chemicals: ["Chemical", "Materials", "Polymers"],
  crops: ["Farms", "Agriculture", "Grain"], solar_panels: ["Solar", "Photovoltaics"], household_goods: ["Brands", "Home"], coal: ["Coal", "Mining"],
  iron_ore: ["Iron", "Mining"], copper: ["Copper", "Minerals"], lithium: ["Lithium", "Minerals"], timber: ["Timber", "Forest Products"], livestock: ["Cattle", "Ranches"],
  cotton: ["Cotton", "Ginning"], uranium: ["Uranium", "Nuclear Fuels"], rare_earths: ["Rare Earths", "Magnetics"], milk: ["Dairy", "Creamery"],
  aluminum: ["Aluminum", "Alloys"], lumber: ["Lumber", "Wood Products"], paper: ["Paper", "Packaging"], textiles: ["Mills", "Textiles"], cement: ["Cement", "Aggregates"],
  fertilizer: ["Nitrogen", "Fertilizer", "Ag Inputs"], auto_parts: ["Components", "Automotive Systems"], displays: ["Display", "Optronics"], meat: ["Meats", "Packing"],
  wind_turbines: ["Wind", "Turbine"], homes: ["Homes", "Builders", "Communities"], furniture: ["Furniture", "Home Furnishings"], appliances: ["Appliance", "Home Systems"],
  beverages: ["Beverage", "Brewing", "Bottling"], meals_fast: ["Burgers", "Chicken", "Tacos"], meals_casual: ["Grill", "Roadhouse", "Kitchen & Bar"], meals_fine: ["Steakhouse", "Restaurant Group", "Hospitality"], luxury_fashion: ["Maison", "Atelier", "Couture"], luxury_cars: ["Motorcars", "Coachworks"], video_games: ["Games", "Interactive", "Studios"],
  aircraft: ["Aerospace", "Aviation"], defense: ["Defense", "Dynamics", "Systems"], medical_devices: ["Medical", "Surgical", "Health"], telecom: ["Wireless", "Telecom"],
  air_travel: ["Airlines", "Air"], logistics: ["Freight", "Logistics", "Express"],
  banking: ["Bank", "Bancorp", "Savings", "Trust"],
  insurance: ["Insurance", "Mutual", "Assurance"],
  wealth_mgmt: ["Capital", "Investments", "Asset Management"],
  payments: ["Pay", "Payments", "Card"],
  ibanking: ["& Co.", "Partners", "Securities"],
  hospital_care: ["Health", "Medical Center", "Health System"],
  clinics: ["Clinics", "Care", "Health Partners"],
  health_insurance: ["Health Plans", "Healthcare", "Care Group"],
  senior_care: ["Senior Living", "Communities"],
  diagnostics: ["Diagnostics", "Labs"],
  big_box: ["Mart", "Stores", "Supercenter"],
  ecommerce: [".com", "Online", "Marketplace"],
  home_improvement: ["Home Center", "Hardware", "Supply"],
  drugstores: ["Drug", "Pharmacy"],
  gas_stations: ["Fuel Stop", "Travel Centers", "Quick Mart"],
  supermarkets: ["Market", "Grocers", "Food Stores"],
  hotel_stays: ["Hotels", "Inns", "Lodging"],
  resort_stays: ["Resorts", "Hotels & Resorts"],
  cruises: ["Cruises", "Cruise Line"],
  theme_parks: ["Parks", "Adventures"],
  casinos: ["Gaming", "Casinos", "Resorts"],
  live_events: ["Live", "Entertainment", "Presents"],
  pro_sports: ["Sports & Entertainment", "Sports Group"],
  fitness: ["Fitness", "Athletic Clubs"],
  cinemas: ["Cinemas", "Theatres"],
  cosmetics: ["Beauty", "Cosmetics"],
  prestige_beauty: ["Beauté", "Cosmetics"],
  salons: ["Salons", "Spa"],
  tobacco: ["Tobacco", "Leaf"],
  alcohol: ["Brewing", "Spirits", "Vineyards"],
  higher_ed: ["University", "College"],
  private_school: ["Academy", "Schools"],
  childcare: ["Learning Centers", "Kids"],
  apartments: ["Residential", "Apartment Communities", "Properties"],
  office_space: ["Realty", "Properties", "REIT"],
  water: ["Water", "Water Works"],
  waste: ["Waste", "Disposal", "Environmental"],
  broadband: ["Cable", "Fiber", "Communications"],
  satellite_internet: ["Orbital", "Space"],
  rideshare: ["Rides", "Go"],
  rail_freight: ["Railroad", "Rail", "& Pacific"],
  space_launch: ["Launch", "Rocketworks", "Space"],
  machinery: ["Machinery", "Equipment", "Tractor"],
  electrical_equipment: ["Electric", "Power Systems"],
  robots: ["Robotics", "Automation"],
  chip_tools: ["Materials", "Instruments"],
  ships: ["Shipbuilding", "Marine"],
  tires: ["Tire & Rubber", "Tire"],
  toys: ["Toys", "Playthings"],
  sporting_goods: ["Sports", "Outdoor"],
  pet_food: ["Pet", "Petcare"],
  jewelry: ["Jewelers", "& Sons", "Watches"],
  coffee: ["Coffee", "Roasters"],
  music: ["Records", "Music", "Audio"],
  news: ["Times", "Gazette", "Media"],
  consulting: ["Consulting", "Advisory", "Group"],
  legal: ["LLP", "& Associates"],
  accounting: ["LLP", "Accounting"],
  staffing: ["Staffing", "Workforce"],
  cybersecurity: ["Security", "Cyber", "Shield"],
  commercial_construction: ["Construction", "Builders", "Contracting"],
};

/** Price-to-sales ratio by technology, to size revenue from market cap. */
const PS: Partial<Record<TechId, number>> = {
  software: 7, cloud: 6, ai: 10, semis: 5, media: 4, devices: 2.2, biotech: 4, medtech: 4, consumer: 1.6, auto: 0.7, battery: 1.2, energy: 1.5,
  extraction: 1.5, materials: 1, agri: 0.8, aero: 1.8, telecom: 2,
  finance: 3, care: 1.2, retail: 0.7, industrial: 1.8, services: 2,
};
const RND: Partial<Record<TechId, number>> = { software: 0.12, cloud: 0.06, ai: 0.15, semis: 0.12, media: 0.06, devices: 0.05, biotech: 0.15, medtech: 0.08, aero: 0.04, telecom: 0.02, finance: 0.02, care: 0.01, retail: 0.005, industrial: 0.03, services: 0.01 };
const CONSUMER = new Set(["groceries", "apparel", "household_goods", "smartphones", "computers", "evs", "gas_cars", "streaming", "beverages", "meals_fast", "meals_casual", "meals_fine", "luxury_fashion", "luxury_cars", "video_games", "furniture", "appliances", "homes", "telecom", "air_travel", "pharmaceuticals", "medical_devices", "banking", "insurance", "wealth_mgmt", "hospital_care", "clinics", "health_insurance", "senior_care", "diagnostics", "big_box", "ecommerce", "home_improvement", "drugstores", "gas_stations", "supermarkets", "hotel_stays", "resort_stays", "cruises", "theme_parks", "casinos", "live_events", "pro_sports", "fitness", "cinemas", "cosmetics", "prestige_beauty", "salons", "tobacco", "alcohol", "higher_ed", "private_school", "childcare", "apartments", "water", "waste", "broadband", "satellite_internet", "rideshare", "tires", "toys", "sporting_goods", "pet_food", "jewelry", "coffee", "music", "news", "coffee"]);

const TAG_SIZE: Record<string, string[]> = {
  startup: ["A venture-backed upstart in {good}.", "Two years old, burning cash, sure it can take on the giants in {good}.", "A scrappy {good} company out of {place}."],
  challenger: ["A fast-growing {good} company from {place}.", "Number three or four in {good}, and hungry.", "A mid-sized {good} business with a loyal customer base in {place}."],
  incumbent: ["One of the biggest names in {good}, headquartered in {place}.", "A century-old {good} business that still dominates its home region.", "{place}'s biggest employer, and a major force in {good}."],
};

export interface Roster {
  seed: number;
  companies: CompanySeed[];
}

function pickW<T>(r: () => number, items: T[], w: (x: T) => number): T {
  const tot = items.reduce((a, x) => a + w(x), 0);
  let x = r() * tot;
  for (const it of items) { x -= w(it); if (x <= 0) return it; }
  return items[items.length - 1];
}

function sizeFor(r: () => number): { tier: CompanySeed["tier"]; mcap: number } {
  const roll = r();
  const logU = (a: number, b: number) => Math.exp(Math.log(a) + r() * (Math.log(b) - Math.log(a)));
  if (roll < 0.22) return { tier: "startup", mcap: logU(80e6, 600e6) };
  if (roll < 0.45) return { tier: "challenger", mcap: logU(600e6, 3e9) };
  if (roll < 0.7) return { tier: "challenger", mcap: logU(3e9, 15e9) };
  if (roll < 0.93) return { tier: "incumbent", mcap: logU(15e9, 120e9) };
  return { tier: "incumbent", mcap: logU(120e9, 450e9) };
}

function statesFor(r: () => number, good: GoodId): Record<string, number> {
  const prod = producerOf(good)!;
  const def = BUILDING_BY_ID[prod.type];
  const n = 1 + Math.floor(r() * 3);
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    let st: string;
    if (def.resource) {
      const entries = Object.entries(RESOURCES[def.resource]).filter(([code]) => STATE_BY_CODE[code] || r() < 0.15);
      st = pickW(r, entries, ([, v]) => v * v)[0];
    } else if (r() < 0.08 && def.industry === "factory") {
      st = pickW(r, ["MEX", "CHN", "VNM", "IND", "CAN"], (c) => (c === "CHN" ? 3 : 1));
    } else {
      const office = def.industry === "office";
      st = pickW(r, STATES, (x) => x.population * Math.pow(office ? x.techIndex : x.mfgIndex, 3)).code;
    }
    out[st] = (out[st] ?? 0) + 0.3 + r();
  }
  return out;
}

function makeCompany(r: () => number, i: number, used: Set<string>, tickers: Set<string>): CompanySeed | null {
  const goods = GOODS.filter((g) => g.marketUS + g.marketWorld > 0 && producerOf(g.id) && g.id !== "components");
  const g = pickW(r, goods, (x) => Math.sqrt(x.marketUS + x.marketWorld));
  const size = sizeFor(r);
  let mcap = size.mcap;
  const tier = mcap < 600e6 ? "startup" : size.tier;
  const tech = g.tech;
  const ps = PS[tech ?? "materials"] ?? 1.2;
  // No generated company gets more than a few percent of its market.
  const cap = (g.marketUS + g.marketWorld) * (0.004 + r() * 0.05);
  const revenue = tier === "startup" ? mcap / (ps * 4) : Math.min(mcap / ps, cap);
  if (tier !== "startup" && revenue < mcap / ps) mcap = revenue * ps;
  // Some companies make a second, related product (same industry).
  const prod = producerOf(g.id)!;
  const sector = BUILDING_BY_ID[prod.type].sector;
  const siblings = GOODS.filter((x) => x.id !== g.id && producerOf(x.id) && BUILDING_BY_ID[producerOf(x.id)!.type].sector === sector && x.marketUS + x.marketWorld > 0);
  const second = siblings.length && r() < 0.3 ? siblings[Math.floor(r() * siblings.length)] : undefined;
  const produce = [{ good: g.id, annualRevenue: revenue * (second ? 0.7 : 1), states: statesFor(r, g.id) }];
  if (second) produce.push({ good: second.id, annualRevenue: revenue * 0.3, states: statesFor(r, second.id) });
  const hq = Object.entries(produce[0].states).filter(([c]) => STATE_BY_CODE[c]).sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? pickW(r, STATES, (x) => x.population).code;
  const suffixes = SUFFIX[g.id] ?? ["Industries"];
  let name = "";
  for (let k = 0; k < 30; k++) {
    name = `${PREFIX[Math.floor(r() * PREFIX.length)]} ${suffixes[Math.floor(r() * suffixes.length)]}`;
    if (!used.has(name)) break;
  }
  if (used.has(name)) return null;
  used.add(name);
  const letters = name.replace(/[^A-Za-z ]/g, "").toUpperCase().split(" ");
  let ticker = (letters[0].slice(0, 2) + (letters[1] ?? "X").slice(0, 2)).slice(0, 4);
  for (let k = 0; tickers.has(ticker) && k < 26; k++) ticker = ticker.slice(0, 3) + String.fromCharCode(65 + k);
  tickers.add(ticker);
  const place = STATE_BY_CODE[hq]?.name ?? hq;
  const tags = TAG_SIZE[tier];
  const goodLabel = g.name.split(" ").map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
  const consumer = CONSUMER.has(g.id);
  const debtHeavy = ["extraction", "materials", "energy", "auto", "telecom", "agri"].includes(tech ?? "");
  return {
    key: `gen-${i}`, name, ticker,
    color: `hsl(${Math.floor(r() * 360)} ${25 + Math.floor(r() * 20)}% ${35 + Math.floor(r() * 15)}%)`,
    tagline: tags[Math.floor(r() * tags.length)].replace("{good}", goodLabel).replace("{place}", place).replace(/^./, (c) => c.toUpperCase()),
    inspiredBy: "generated", hq, marketCap: mcap,
    cash: mcap * (0.03 + r() * 0.1), debt: mcap * (debtHeavy ? 0.15 + r() * 0.4 : r() * 0.2), shares: mcap / (20 + r() * 180),
    priceMult: { [g.id]: 0.92 + r() * 0.3, ...(second ? { [second.id]: 0.95 + r() * 0.2 } : {}) },
    brand: { [g.id]: 0.6 + r() * (consumer ? 1.6 : 0.8), ...(second ? { [second.id]: 0.6 + r() * 0.6 } : {}) },
    techEdge: tech ? { [tech]: Math.round((r() * 2.5 - 0.5) * 10) / 10 } : {},
    produce,
    rndIntensity: tier === "startup" ? 0 : (RND[tech ?? "materials"] ?? 0.005) * (0.6 + r() * 0.8),
    // Tech startups are R&D shops; a startup brewery or landlord isn't.
    rndLevels: tier === "startup" ? ((RND[tech ?? "materials"] ?? 0) >= 0.04 ? 1 + Math.floor(r() * 4) : r() < 0.25 ? 1 : 0) : undefined,
    rndStates: { [hq]: 1 },
    marketingPct: consumer ? 0.03 + r() * 0.06 : 0.003 + r() * 0.01,
    wagePolicy: 0.95 + r() * 0.2,
    tier,
  };
}

export function rollRoster(seed = Math.floor(Math.random() * 1e9), count?: number): Roster {
  const r = mulberry(seed);
  const companies: CompanySeed[] = [];
  for (const c of COMPANY_SEEDS) if (r() < (ANCHORS.has(c.key) ? 0.9 : 0.55)) companies.push(c);
  const used = new Set(COMPANY_SEEDS.map((c) => c.name));
  const tickers = new Set(COMPANY_SEEDS.map((c) => c.ticker));
  const n = count ?? 60 + Math.floor(r() * 16);
  for (let i = 0; i < n; i++) {
    const c = makeCompany(r, i, used, tickers);
    if (c) companies.push(c);
  }
  return { seed, companies };
}

export function goodLabel(g: GoodId): string {
  return GOOD_BY_ID[g].name;
}
