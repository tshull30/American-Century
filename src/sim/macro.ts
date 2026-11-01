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
}

const EVENTS: EventTemplate[] = [
  { id: "chip_shortage", name: "Global chip shortage", description: "A fab fire and surging demand: imported chips cost 50% more.", months: [4, 9], importMult: { chips: 1.5 } },
  { id: "ai_frenzy", name: "AI investment frenzy", description: "Every company wants AI: demand for accelerators and cloud compute jumps.", months: [6, 14], demandMult: { ai_accelerators: 1.3, cloud: 1.15 } },
  { id: "oil_spike", name: "Oil price spike", description: "Conflict in the Gulf sends gasoline soaring. Buyers turn to EVs.", months: [4, 9], prefMult: { evs: 1.3, gas_cars: 0.85 }, importMult: { components: 1.05 } },
  { id: "port_strike", name: "Dockworkers' strike", description: "West Coast ports shut down: all imported inputs cost more.", months: [1, 3], importMult: { components: 1.15, chips: 1.15, batteries: 1.15 } },
  { id: "heat_wave", name: "Record heat wave", description: "Air conditioners everywhere: electricity demand surges.", months: [2, 3], demandMult: { electricity: 1.12 } },
  { id: "blockbuster_drug", name: "Medical breakthrough", description: "A new class of drugs expands the pharmaceutical market.", months: [12, 24], demandMult: { pharmaceuticals: 1.08 } },
  { id: "ad_slump", name: "Advertising slump", description: "Marketers slash budgets.", months: [3, 6], demandMult: { digital_ads: 0.88 } },
  { id: "lithium_glut", name: "Lithium glut", description: "Battery materials crash in price: imported battery packs are 20% cheaper.", months: [6, 12], importMult: { batteries: 0.8 } },
];

export function updateWorldEvents(s: GameState, log: (text: string, kind?: "info") => void) {
  s.worldEvents = s.worldEvents.filter((e) => {
    if (e.untilDay > s.day) return true;
    log(`Ended: ${e.name}.`, "info");
    return false;
  });
  if (rand(s) > 0.045) return;
  const options = EVENTS.filter((t) => !s.worldEvents.some((e) => e.id === t.id));
  if (!options.length) return;
  const t = options[Math.floor(rand(s) * options.length)];
  const months = t.months[0] + Math.floor(rand(s) * (t.months[1] - t.months[0] + 1));
  const e: WorldEvent = {
    id: t.id, name: t.name, description: t.description, untilDay: s.day + Math.round(months * DAYS_PER_MONTH),
    importMult: t.importMult, demandMult: t.demandMult, prefMult: t.prefMult,
  };
  s.worldEvents.push(e);
  log(`${t.name}: ${t.description}`, "info");
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
