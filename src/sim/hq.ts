// Headquarters: a specific site in a specific city, with a form and amenities.
import type { JobId } from "./data/jobs";
import type { AmenityId, Company, GameState, HqForm } from "./types";

export interface FormDef {
  id: HqForm;
  name: string;
  blurb: string;
  costMult: number;
  slots: number;
  /** Extra appeal to these jobs when hiring anywhere. */
  hiring: Partial<Record<JobId, number>>;
  reputation: number;
  cityOpinion: number;
  needsTower?: boolean;
}

export const HQ_FORMS: Record<HqForm, FormDef> = {
  tower: { id: "tower", name: "Downtown tower", blurb: "A skyscraper on the skyline. Prestige with customers and white-collar recruits; only in big downtowns.",
    costMult: 1.4, slots: 5, hiring: { professional: 0.05, manager: 0.05 }, reputation: 0.03, cityOpinion: 0, needsTower: true },
  campus: { id: "campus", name: "Suburban campus", blurb: "Low buildings on cheap land with room for perks. Engineers love it; neighbors complain about traffic.",
    costMult: 0.9, slots: 7, hiring: { engineer: 0.05, software: 0.05, scientist: 0.03 }, reputation: 0, cityOpinion: -0.02 },
  block: { id: "block", name: "City block", blurb: "A mixed-use block with street-level shops. Locals like it; fewer amenity slots.",
    costMult: 1.1, slots: 4, hiring: {}, reputation: 0.01, cityOpinion: 0.05 },
};

export interface AmenityDef {
  id: AmenityId;
  name: string;
  blurb: string;
  /** One-time cost and monthly upkeep per HQ level. */
  build: number;
  upkeep: number;
  hiring?: number;
  research?: number;
  cityOpinion?: number;
  image?: number;
  reputation?: number;
  admin?: number;
  hireRate?: number;
}

export const AMENITIES: AmenityDef[] = [
  { id: "cafeteria", name: "Free cafeteria", blurb: "Three meals a day. Everyone hires a little easier.", build: 20e3, upkeep: 25e3, hiring: 0.03 },
  { id: "childcare", name: "On-site childcare", blurb: "Parents stay; the city notices.", build: 40e3, upkeep: 40e3, hiring: 0.04, cityOpinion: 0.04, image: 0.01 },
  { id: "fitness", name: "Fitness center", blurb: "Gym, pool and climbing wall.", build: 15e3, upkeep: 10e3, hiring: 0.02 },
  { id: "innovation_lab", name: "Innovation lab", blurb: "Prototype shop next to the executives. Research output +6%.", build: 60e3, upkeep: 30e3, research: 0.06 },
  { id: "plaza", name: "Public plaza and park", blurb: "Open to everyone. Locals warm to you.", build: 30e3, upkeep: 5e3, cityOpinion: 0.08, image: 0.02 },
  { id: "visitor_center", name: "Visitor center and flagship store", blurb: "Tourists and fans. Consumer products seem a bit better.", build: 25e3, upkeep: 15e3, reputation: 0.04 },
  { id: "shuttle", name: "Commuter shuttles", blurb: "Buses from every neighborhood: hire faster in your HQ city.", build: 10e3, upkeep: 20e3, hiring: 0.01, hireRate: 0.15 },
  { id: "exec_suites", name: "Executive floors", blurb: "Better management: headquarters supports 8% more operations.", build: 50e3, upkeep: 20e3, admin: 0.08 },
  { id: "solar_roof", name: "Solar roof", blurb: "Cuts the power bill a little and looks good in the annual report.", build: 20e3, upkeep: -5e3, image: 0.02 },
];

export const AMENITY_BY_ID: Record<AmenityId, AmenityDef> = Object.fromEntries(AMENITIES.map((a) => [a.id, a])) as Record<AmenityId, AmenityDef>;

export function hqLevels(c: Company): number {
  return c.buildings.filter((b) => b.type === "hq").reduce((a, b) => a + b.level, 0);
}

function sum(c: Company, f: (a: AmenityDef) => number | undefined): number {
  let x = 0;
  for (const id of c.hqSite.amenities) x += f(AMENITY_BY_ID[id]) ?? 0;
  return x;
}

/** Hiring appeal multiplier for a job (applies everywhere). */
export function hqHiringMult(c: Company, job: JobId): number {
  return 1 + sum(c, (a) => a.hiring) + (HQ_FORMS[c.hqSite.form].hiring[job] ?? 0);
}
export function hqHireRateMult(c: Company, cityId: string): number {
  return cityId === c.hqSite.city ? 1 + sum(c, (a) => a.hireRate) : 1;
}
export function hqResearchMult(c: Company): number { return 1 + sum(c, (a) => a.research); }
export function hqAdminMult(c: Company): number { return 1 + sum(c, (a) => a.admin); }
export function hqReputationMult(c: Company): number { return 1 + sum(c, (a) => a.reputation) + HQ_FORMS[c.hqSite.form].reputation; }
export function hqImageBonus(c: Company): number { return sum(c, (a) => a.image); }
export function hqCityOpinion(c: Company): number { return sum(c, (a) => a.cityOpinion) + HQ_FORMS[c.hqSite.form].cityOpinion; }
/** Monthly amenity upkeep. */
export function hqUpkeep(c: Company): number { return sum(c, (a) => a.upkeep) * hqLevels(c); }

export function amenityCost(c: Company, id: AmenityId): number {
  return AMENITY_BY_ID[id].build * Math.max(1, hqLevels(c));
}

export function towerAllowed(s: GameState, cityId: string): boolean {
  return !!s.cities[cityId]?.flags.includes("tower");
}
