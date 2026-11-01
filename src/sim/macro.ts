// The business cycle, interest rates and random world events.
import type { GoodMap, GameState, Macro, WorldEvent } from "./types";
import { tariffRate } from "./politics";
import { clamp, DAYS_PER_MONTH, rand, randNormal } from "./util";

export function initMacro(): Macro {
  return { gap: 0.005, inflation: 0.027, fedRate: 0.04, recession: false, gdpGrowth: 0.02, history: [] };
}

/** How much the cycle lifts or cuts US demand. */
export function demandMult(s: GameState): number {
  return 1 + 1.2 * s.macro.gap;
}

export function updateMacro(s: GameState, log: (text: string, kind?: "bad" | "good" | "info") => void) {
  const m = s.macro;
  const prevGap = m.gap;
  if (!m.recession && rand(s) < 0.008 + Math.max(0, m.fedRate - 0.05) * 0.2) {
    m.recession = true;
    log("Recession: the economy is contracting. Consumers and businesses are cutting back.", "bad");
  } else if (m.recession && m.gap < -0.03 && rand(s) < 0.08) {
    m.recession = false;
    log("The recession is over; the economy is growing again.", "good");
  }
  const target = m.recession ? -0.05 : 0.005;
  m.gap += (target - m.gap) * 0.12 + 0.003 * randNormal(s);
  m.gap = clamp(m.gap, -0.08, 0.04);
  m.gdpGrowth = 0.02 + (m.gap - prevGap) * 12;
  const inflTarget = 0.024 + 0.6 * m.gap + tariffRate(s) * 0.04;
  m.inflation += (inflTarget - m.inflation) * 0.1 + 0.001 * randNormal(s);
  m.inflation = clamp(m.inflation, -0.01, 0.12);
  // The Fed meets about every six weeks; we let it move every other month.
  if (s.month % 2 === 0) {
    const fedTarget = clamp(0.025 + 1.5 * (m.inflation - 0.02) + 0.5 * m.gap, 0, 0.08);
    const step = 0.0025;
    if (fedTarget > m.fedRate + step / 2) m.fedRate += step;
    else if (fedTarget < m.fedRate - step / 2) m.fedRate -= step;
    m.fedRate = clamp(m.fedRate, 0, 0.1);
  }
  s.baseRate = m.fedRate + 0.01;
}

interface EventTemplate {
  id: string;
  name: string;
  description: string;
  months: [number, number];
  importMult?: GoodMap;
  demandMult?: GoodMap;
  prefMult?: GoodMap;
  countryOutput?: Record<string, number>;
  /** countryOutput only hits these building types. */
  siteTypes?: string[];
  /** One-time effect when it starts. */
  onStart?: "crash" | "rally" | "rate_shock";
  headline?: string;
}

const EVENTS: EventTemplate[] = [
  { id: "chip_shortage", name: "Global chip shortage", description: "A fab fire and surging demand: imported chips cost 50% more.", months: [4, 9], importMult: { chips: 1.5 } },
  { id: "ai_frenzy", name: "AI investment frenzy", description: "Every company wants AI: demand for accelerators and cloud compute jumps.", months: [6, 14], demandMult: { ai_accelerators: 1.3, cloud: 1.15 } },
  { id: "oil_spike", name: "Oil price spike", description: "Conflict in the Gulf sends gasoline soaring. Buyers turn to EVs.", months: [4, 9], prefMult: { evs: 1.3, gas_cars: 0.85 }, importMult: { components: 1.05 } },
  { id: "port_strike", name: "Dockworkers' strike", description: "West Coast ports shut down: all imported inputs cost more.", months: [1, 3], importMult: { components: 1.15, chips: 1.15, batteries: 1.15 } },
  { id: "heat_wave", name: "Record heat wave", description: "Air conditioners everywhere: electricity demand surges.", months: [2, 3], demandMult: { electricity: 1.12 } },
  { id: "blockbuster_drug", name: "Medical breakthrough", description: "A new class of drugs expands the pharmaceutical market.", months: [12, 24], demandMult: { pharmaceuticals: 1.08 } },
  { id: "ad_slump", name: "Advertising slump", description: "Marketers slash budgets.", months: [3, 6], demandMult: { digital_ads: 0.88 } },
  { id: "strait_crisis", name: "Taiwan Strait crisis", description: "Naval drills around Taiwan: chip shipments slow and plants there run at half speed.", months: [2, 6], importMult: { chips: 1.35, ai_accelerators: 1.25 }, countryOutput: { TWN: 0.5 } },
  { id: "china_lockdown", name: "Factory shutdowns in China", description: "Rolling shutdowns idle Chinese plants; imported parts get dearer.", months: [2, 5], importMult: { components: 1.1, batteries: 1.1 }, countryOutput: { CHN: 0.7 } },
  { id: "border_slowdown", name: "Border inspections", description: "Trucks back up for miles at the Mexican border.", months: [1, 3], countryOutput: { MEX: 0.85 } },
  { id: "gulf_conflict", name: "Gulf conflict", description: "Missile strikes near Saudi oil fields; output there falls and crude imports get pricier.", months: [2, 6], importMult: { crude_oil: 1.2, fuel: 1.1 }, countryOutput: { SAU: 0.6 } },
  { id: "hurricane", name: "Hurricane hits the Gulf Coast", headline: "Hurricane slams the Gulf Coast", description: "Refineries, chemical plants and ports from Corpus Christi to New Orleans shut down.", months: [1, 2], countryOutput: { TX: 0.7, LA: 0.6, MS: 0.7 }, importMult: { fuel: 1.15, chemicals: 1.1 } },
  { id: "florida_storm", name: "Hurricane hits Florida", headline: "Hurricane tears across Florida", description: "Power is out for millions; plants and offices close for weeks.", months: [1, 2], countryOutput: { FL: 0.65 }, demandMult: { homes: 1.05 } },
  { id: "wildfires", name: "Western wildfires", headline: "Wildfires rage across the West", description: "Smoke and evacuations idle plants and farms in California, Oregon and Washington.", months: [1, 3], countryOutput: { CA: 0.85, OR: 0.8, WA: 0.88 } },
  { id: "drought", name: "Drought in the West and Plains", headline: "Worst drought in a decade scorches farm country", description: "Crop, cattle and dairy output falls; food prices climb.", months: [4, 8], countryOutput: { CA: 0.7, AZ: 0.7, TX: 0.75, NE: 0.75, KS: 0.75, OK: 0.75, CO: 0.8, NM: 0.7 }, siteTypes: ["farm", "ranch", "dairy", "cottonfarm"], importMult: { crops: 1.15, livestock: 1.1 } },
  { id: "bumper_harvest", name: "Bumper harvest", headline: "Record harvest floods grain elevators", description: "Ideal weather across the Corn Belt: farms produce more, prices soften.", months: [3, 6], countryOutput: { IA: 1.15, IL: 1.15, NE: 1.15, MN: 1.15, IN: 1.15 }, siteTypes: ["farm"], importMult: { crops: 0.88 } },
  { id: "polar_vortex", name: "Polar vortex", headline: "Arctic blast freezes Texas grid", description: "Power plants and gas wells freeze; electricity demand spikes.", months: [1, 1], countryOutput: { TX: 0.75, OK: 0.85 }, demandMult: { electricity: 1.15, natural_gas: 1.1 } },
  { id: "market_crash", name: "Stock market crash", headline: "Stocks plunge in worst week since 2008", description: "Panic selling wipes trillions off market values.", months: [1, 2], onStart: "crash" },
  { id: "market_rally", name: "Market melt-up", headline: "Stocks soar to record highs", description: "Retail investors pile in; every sector rallies.", months: [1, 2], onStart: "rally" },
  { id: "fed_shock", name: "Surprise Fed hike", headline: "Fed stuns markets with surprise rate hike", description: "Borrowing costs jump overnight; growth stocks take the hit.", months: [1, 1], onStart: "rate_shock" },
  { id: "housing_boom", name: "Housing boom", headline: "Home buyers line up as mortgage rates dip", description: "Demand for new homes, lumber and appliances jumps.", months: [6, 12], demandMult: { homes: 1.15, furniture: 1.06, appliances: 1.06 } },
  { id: "housing_bust", name: "Housing slump", headline: "Home sales fall off a cliff", description: "Builders cancel projects; lumber piles up.", months: [6, 12], demandMult: { homes: 0.8, furniture: 0.93, appliances: 0.93 } },
  { id: "bird_flu", name: "Bird flu outbreak", headline: "Bird flu spreads to dairy herds", description: "Culls hit poultry and dairy; meat and milk get scarce.", months: [3, 6], importMult: { meat: 1.15, milk: 1.2 }, siteTypes: ["dairy", "ranch"], countryOutput: { CA: 0.8, CO: 0.8, TX: 0.85, MI: 0.85, IA: 0.85 } },
  { id: "pandemic_scare", name: "New virus scare", headline: "New virus empties restaurants and airports", description: "People stay home: dining and travel fall, streaming and games climb.", months: [2, 5], demandMult: { meals_fast: 0.92, meals_casual: 0.82, meals_fine: 0.75, air_travel: 0.7, streaming: 1.12, video_games: 1.15, pharmaceuticals: 1.05 } },
  { id: "travel_boom", name: "Travel boom", headline: "Americans can't stop traveling", description: "Airlines and restaurants are packed.", months: [4, 8], demandMult: { air_travel: 1.15, meals_casual: 1.05, meals_fine: 1.08 } },
  { id: "rare_earth_ban", name: "China curbs rare-earth exports", headline: "Beijing cuts off rare-earth exports", description: "Magnet makers scramble; American mines are suddenly strategic.", months: [4, 10], importMult: { rare_earths: 1.7, wind_turbines: 1.1, evs: 1.02 } },
  { id: "steel_dumping", name: "Steel dumping", headline: "Cheap foreign steel floods the market", description: "Imports undercut American mills.", months: [4, 8], importMult: { steel: 0.85, aluminum: 0.9 } },
  { id: "copper_squeeze", name: "Copper squeeze", headline: "Copper hits record on AI and EV demand", description: "Mines can't keep up; wiring and motors get pricier.", months: [4, 8], importMult: { copper: 1.25 }, demandMult: { copper: 1.1 } },
  { id: "suez", name: "Shipping lanes blocked", headline: "Container ship wedged in canal snarls world trade", description: "Freight rates spike; every imported input costs more.", months: [1, 2], importMult: { components: 1.1, chips: 1.08, displays: 1.1, textiles: 1.1, apparel: 1.05 } },
  { id: "grid_cyberattack", name: "Grid cyberattack", headline: "Hackers knock out power across the Northeast", description: "Rolling blackouts hit plants and data centers.", months: [1, 1], countryOutput: { NY: 0.85, PA: 0.85, NJ: 0.85, MA: 0.85, CT: 0.85 } },
  { id: "chip_glut", name: "Chip glut", headline: "Chipmakers face a glut as orders dry up", description: "Imported chips and displays are cheap.", months: [4, 9], importMult: { chips: 0.85, displays: 0.88 } },
  { id: "defense_surge", name: "Defense buildup", headline: "Congress passes record defense budget", description: "The Pentagon orders more missiles, drones and aircraft.", months: [12, 24], demandMult: { defense: 1.2, aircraft: 1.05 } },
  { id: "air_safety", name: "Aviation safety crisis", headline: "Groundings follow a string of near-misses", description: "Airlines cancel flights; aircraft orders stall.", months: [2, 5], demandMult: { air_travel: 0.9, aircraft: 0.85 } },
  { id: "lithium_glut", name: "Lithium glut", description: "Battery materials crash in price: imported battery packs are 20% cheaper.", months: [6, 12], importMult: { batteries: 0.8 } },
];

export function updateWorldEvents(s: GameState, log: (text: string, kind?: "info", extra?: { headline: string; deck: string }) => void) {
  s.worldEvents = s.worldEvents.filter((e) => {
    if (e.untilDay > s.day) return true;
    log(`Ended: ${e.name}.`, "info");
    return false;
  });
  if (rand(s) > 0.07) return;
  const options = EVENTS.filter((t) => !s.worldEvents.some((e) => e.id === t.id));
  if (!options.length) return;
  const t = options[Math.floor(rand(s) * options.length)];
  const months = t.months[0] + Math.floor(rand(s) * (t.months[1] - t.months[0] + 1));
  const e: WorldEvent = {
    id: t.id, name: t.name, description: t.description, untilDay: s.day + Math.round(months * DAYS_PER_MONTH),
    importMult: t.importMult, demandMult: t.demandMult, prefMult: t.prefMult, countryOutput: t.countryOutput, siteTypes: t.siteTypes,
  };
  s.worldEvents.push(e);
  if (t.onStart === "crash") for (const c of s.companies) { c.hype *= 0.82; c.marketCap *= 0.85; }
  if (t.onStart === "rally") for (const c of s.companies) { c.hype *= 1.1; c.marketCap *= 1.06; }
  if (t.onStart === "rate_shock") { s.baseRate += 0.0075; s.macro.fedRate += 0.0075; for (const c of s.companies) c.hype *= 0.95; }
  log(`${t.name}: ${t.description}`, "info", { headline: t.headline ?? t.name, deck: t.description });
}

export function eventDemandMult(s: GameState, g: string): number {
  let m = 1;
  for (const e of s.worldEvents) m *= (e.demandMult as Record<string, number> | undefined)?.[g] ?? 1;
  return m;
}
export function eventPrefMult(s: GameState, g: string): number {
  let m = 1;
  for (const e of s.worldEvents) m *= (e.prefMult as Record<string, number> | undefined)?.[g] ?? 1;
  return m;
}
