// Industry know-how, economies of scale and the cost of running too many businesses at once.
import { BUILDING_BY_ID, SECTORS, type BuildingTypeId, type SectorId } from "./data/buildings";
import { COUNTRY_BY_ID } from "./data/countries";
import { resourceMult, SUN, WIND } from "./data/resources";
import type { Building, Company, WorldEvent } from "./types";
import { clamp } from "./util";

/** Levels at which a company reaches full economies of scale in an industry. */
export const SCALE_REF = 150;

export function sectorOf(b: Building): SectorId | undefined {
  return BUILDING_BY_ID[b.type].sector;
}

/** Operating levels per industry. */
export function sectorLevels(c: Company): Partial<Record<SectorId, number>> {
  const out: Partial<Record<SectorId, number>> = {};
  for (const b of c.buildings) {
    const sec = sectorOf(b);
    if (sec && b.level > 0) out[sec] = (out[sec] ?? 0) + b.level;
  }
  return out;
}

export function activeSectors(c: Company): SectorId[] {
  return Object.keys(sectorLevels(c)) as SectorId[];
}

/** About 0.78 for a single level, rising to 1 at SCALE_REF levels. */
export function scaleMult(levels: number): number {
  return 0.75 + 0.25 * clamp(Math.log(1 + levels) / Math.log(1 + SCALE_REF), 0, 1);
}

/** Running-cost multiplier while learning an industry: consultants, rework, scrap. Up to +50% with no know-how. */
export function learningOverhead(c: Company, b: Building): number {
  const sec = sectorOf(b);
  if (!sec) return 1;
  return 1 + 0.5 * (1 - clamp(c.knowhow?.[sec] ?? 1, 0, 1));
}

/** Effective number of industries, weighted by size (1 / Herfindahl index of levels). */
export function effectiveSectors(c: Company): number {
  const lv = Object.values(sectorLevels(c)) as number[];
  const tot = lv.reduce((a, b) => a + b, 0);
  if (!tot) return 0;
  return 1 / lv.reduce((a, b) => a + (b / tot) ** 2, 0);
}

/** 0.6 with no know-how, 1 with full know-how. */
export function knowhowMult(k: number): number {
  return 0.6 + 0.4 * clamp(k, 0, 1);
}

/** Know-how a company brings into an industry it's entering. */
export function entryKnowhow(c: Company, sec: SectorId): number {
  let rel = 0;
  for (const r of SECTORS[sec].related) rel = Math.max(rel, c.knowhow?.[r] ?? 0);
  return Math.max(0.2, 0.5 * rel);
}

/** Record entry into a new industry (called whenever a building is added). */
export function noteEntry(c: Company, sec: SectorId | undefined) {
  if (!sec) return;
  c.knowhow ??= {};
  if (c.knowhow[sec] === undefined) c.knowhow[sec] = entryKnowhow(c, sec);
}

/** Monthly: know-how grows where you operate and fades where you don't. */
export function updateKnowhow(c: Company) {
  c.knowhow ??= {};
  const lv = sectorLevels(c);
  for (const sec of Object.keys(SECTORS) as SectorId[]) {
    const k = c.knowhow[sec];
    if (lv[sec]) c.knowhow[sec] = (k ?? entryKnowhow(c, sec)) + (1 - (k ?? 0)) * 0.04;
    else if (k !== undefined) c.knowhow[sec] = k * 0.99;
  }
}

/** Industry efficiency for a building: know-how times economies of scale. */
export function industryMult(c: Company, b: Building, levels: Partial<Record<SectorId, number>>): number {
  const sec = sectorOf(b);
  if (!sec) return 1;
  return knowhowMult(c.knowhow?.[sec] ?? 1) * scaleMult(levels[sec] ?? b.level);
}

/** HQ load multiplier: every industry beyond the first two adds 15% more management work. */
export function complexityMult(c: Company): number {
  return 1 + 0.15 * Math.max(0, activeSectors(c).length - 2);
}

/** Investors discount sprawling conglomerates: 5% per (size-weighted) industry beyond two, up to 25%. */
export function conglomerateDiscount(c: Company): number {
  return Math.min(0.25, 0.05 * Math.max(0, effectiveSectors(c) - 2));
}

/** Output multiplier from the site itself: resources, sunshine, and abroad, local productivity. */
export function siteMultFor(type: BuildingTypeId, method: string, state: string): number {
  const def = BUILDING_BY_ID[type];
  let m = 1;
  if (def.resource) m = resourceMult(def.resource, state);
  else if (type === "power" && method === "solar") m = SUN[state] ?? 1;
  else if (type === "power" && method === "wind") m = WIND[state] ?? 0.85;
  const c = COUNTRY_BY_ID[state];
  if (c && !def.resource) m *= c.productivity * (def.industry === "office" && type !== "datacenter" ? 0.75 : 1);
  return m;
}

export function siteMult(b: Building, events?: WorldEvent[]): number {
  let m = siteMultFor(b.type, b.method, b.state);
  if (events) for (const e of events) m *= e.countryOutput?.[b.state] ?? 1;
  return m;
}
