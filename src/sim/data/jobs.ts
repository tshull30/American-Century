// Pop types ("strata" in Victoria 3 terms). Each groups many detailed census
// occupation codes (ACS OCCP / SOC). See scripts/pums_to_pops.py for the mapping.

export type JobId =
  | "laborer"
  | "technician"
  | "service"
  | "clerk"
  | "engineer"
  | "software"
  | "scientist"
  | "professional"
  | "manager";

export interface JobDef {
  id: JobId;
  name: string;
  plural: string;
  /** Approximate national share of the civilian workforce. */
  nationalShare: number;
  /** National average monthly wage, USD. */
  baseWage: number;
  /** How the job's local share responds to a state's tech / manufacturing profile. */
  techWeight: number;
  mfgWeight: number;
  examples: string;
}

export const JOBS: JobDef[] = [
  { id: "laborer", name: "Laborer", plural: "Laborers", nationalShare: 0.17, baseWage: 3600, techWeight: 0, mfgWeight: 1, examples: "assemblers, warehouse, construction, drivers" },
  { id: "technician", name: "Technician", plural: "Technicians", nationalShare: 0.1, baseWage: 5100, techWeight: 0.3, mfgWeight: 0.8, examples: "machinists, electricians, mechanics, lab and IT techs" },
  { id: "service", name: "Service Worker", plural: "Service Workers", nationalShare: 0.29, baseWage: 2900, techWeight: 0, mfgWeight: 0, examples: "retail, food service, care work, cleaning" },
  { id: "clerk", name: "Clerk", plural: "Clerks", nationalShare: 0.15, baseWage: 3900, techWeight: 0, mfgWeight: 0, examples: "office and admin support, sales support, bookkeeping" },
  { id: "engineer", name: "Engineer", plural: "Engineers", nationalShare: 0.016, baseWage: 9200, techWeight: 0.8, mfgWeight: 0.5, examples: "electrical, mechanical, chemical, civil engineers" },
  { id: "software", name: "Software Developer", plural: "Software Developers", nationalShare: 0.032, baseWage: 11200, techWeight: 1.6, mfgWeight: 0, examples: "software engineers, data scientists, IT architects" },
  { id: "scientist", name: "Scientist", plural: "Scientists", nationalShare: 0.008, baseWage: 8600, techWeight: 1.2, mfgWeight: 0.2, examples: "physicists, chemists, materials and life scientists" },
  { id: "professional", name: "Professional", plural: "Professionals", nationalShare: 0.11, baseWage: 8100, techWeight: 0.4, mfgWeight: 0, examples: "lawyers, accountants, analysts, physicians" },
  { id: "manager", name: "Manager", plural: "Managers", nationalShare: 0.11, baseWage: 10100, techWeight: 0.2, mfgWeight: 0, examples: "operations, sales, finance and general managers" },
];

export const JOB_BY_ID: Record<JobId, JobDef> = Object.fromEntries(JOBS.map((j) => [j.id, j])) as Record<JobId, JobDef>;
