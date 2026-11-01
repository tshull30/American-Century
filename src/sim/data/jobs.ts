// Pop types ("strata" in Victoria 3 terms). Each groups related census occupation
// codes (ACS OCCP / SOC). See scripts/pums_to_pops.py for the mapping.
// Shares and wages are rough mid-2020s BLS figures, rounded.

export type JobId =
  // Blue collar
  | "laborer"
  | "assembler"
  | "construction"
  | "driver"
  | "farmworker"
  | "extraction"
  | "technician"
  // Service
  | "service"
  | "retail"
  | "care"
  | "nurse"
  // Office and professional
  | "clerk"
  | "sales"
  | "accountant"
  | "lawyer"
  | "professional"
  | "teacher"
  | "physician"
  // Tech and science
  | "engineer"
  | "software"
  | "datasci"
  | "scientist"
  | "designer"
  | "manager";

export type JobGroup = "Blue collar" | "Service" | "Office and professional" | "Tech and science";

export interface JobDef {
  id: JobId;
  name: string;
  plural: string;
  group: JobGroup;
  /** Approximate national share of the civilian workforce. */
  nationalShare: number;
  /** National average monthly wage, USD. */
  baseWage: number;
  /** How the job's local share responds to a place's tech / manufacturing profile. */
  techWeight: number;
  mfgWeight: number;
  /** Concentrates outside big metros (farms, oil fields). */
  rural?: number;
  /** State share scales with this natural resource. */
  resource?: "farm" | "oilgas";
  examples: string;
}

export const JOBS: JobDef[] = [
  { id: "laborer", name: "Laborer", plural: "Laborers", group: "Blue collar", nationalShare: 0.07, baseWage: 3500, techWeight: 0, mfgWeight: 0.8, examples: "warehouse workers, movers, packers, groundskeepers" },
  { id: "assembler", name: "Production Worker", plural: "Production Workers", group: "Blue collar", nationalShare: 0.06, baseWage: 3900, techWeight: 0, mfgWeight: 1.4, examples: "assemblers, machine operators, plant workers" },
  { id: "construction", name: "Construction Worker", plural: "Construction Workers", group: "Blue collar", nationalShare: 0.045, baseWage: 4600, techWeight: 0, mfgWeight: 0.3, examples: "carpenters, electricians, pipefitters, ironworkers" },
  { id: "driver", name: "Driver", plural: "Drivers", group: "Blue collar", nationalShare: 0.035, baseWage: 4300, techWeight: 0, mfgWeight: 0.4, rural: 0.4, examples: "truck, delivery and equipment drivers" },
  { id: "farmworker", name: "Farmworker", plural: "Farmworkers", group: "Blue collar", nationalShare: 0.012, baseWage: 3100, techWeight: 0, mfgWeight: 0, rural: 2.5, resource: "farm", examples: "farmers, ranch hands, agricultural equipment operators" },
  { id: "extraction", name: "Oil & Gas Worker", plural: "Oil & Gas Workers", group: "Blue collar", nationalShare: 0.004, baseWage: 5600, techWeight: 0, mfgWeight: 0.2, rural: 2, resource: "oilgas", examples: "roughnecks, roustabouts, drillers, miners" },
  { id: "technician", name: "Technician", plural: "Technicians", group: "Blue collar", nationalShare: 0.06, baseWage: 5200, techWeight: 0.3, mfgWeight: 0.8, examples: "machinists, mechanics, welders, lab and IT techs" },
  { id: "service", name: "Service Worker", plural: "Service Workers", group: "Service", nationalShare: 0.13, baseWage: 2800, techWeight: 0, mfgWeight: 0, examples: "cooks, servers, cleaners, security guards" },
  { id: "retail", name: "Retail Worker", plural: "Retail Workers", group: "Service", nationalShare: 0.09, baseWage: 2900, techWeight: 0, mfgWeight: 0, examples: "cashiers, stockers, store associates" },
  { id: "care", name: "Care Worker", plural: "Care Workers", group: "Service", nationalShare: 0.035, baseWage: 2900, techWeight: 0, mfgWeight: 0, examples: "home health aides, nursing assistants, childcare workers" },
  { id: "nurse", name: "Nurse", plural: "Nurses", group: "Service", nationalShare: 0.025, baseWage: 7400, techWeight: 0.1, mfgWeight: 0, examples: "registered and practical nurses" },
  { id: "clerk", name: "Clerk", plural: "Clerks", group: "Office and professional", nationalShare: 0.11, baseWage: 3900, techWeight: 0, mfgWeight: 0, examples: "office and admin support, customer service, bookkeeping" },
  { id: "sales", name: "Sales Rep", plural: "Sales Reps", group: "Office and professional", nationalShare: 0.035, baseWage: 6200, techWeight: 0.2, mfgWeight: 0.1, examples: "account executives, wholesale and B2B sales" },
  { id: "accountant", name: "Accountant", plural: "Accountants", group: "Office and professional", nationalShare: 0.012, baseWage: 7000, techWeight: 0.3, mfgWeight: 0, examples: "accountants, auditors, financial analysts" },
  { id: "lawyer", name: "Lawyer", plural: "Lawyers", group: "Office and professional", nationalShare: 0.006, baseWage: 12500, techWeight: 0.4, mfgWeight: 0, examples: "attorneys, in-house counsel, compliance officers" },
  { id: "professional", name: "Professional", plural: "Professionals", group: "Office and professional", nationalShare: 0.05, baseWage: 7300, techWeight: 0.4, mfgWeight: 0, examples: "analysts, consultants, HR, marketing and policy staff" },
  { id: "teacher", name: "Teacher", plural: "Teachers", group: "Office and professional", nationalShare: 0.035, baseWage: 5400, techWeight: 0, mfgWeight: 0, examples: "teachers, professors, trainers" },
  { id: "physician", name: "Physician", plural: "Physicians", group: "Office and professional", nationalShare: 0.007, baseWage: 20000, techWeight: 0.2, mfgWeight: 0, examples: "doctors, surgeons, pharmacists" },
  { id: "engineer", name: "Engineer", plural: "Engineers", group: "Tech and science", nationalShare: 0.014, baseWage: 9200, techWeight: 0.8, mfgWeight: 0.5, examples: "electrical, mechanical, chemical, petroleum engineers" },
  { id: "software", name: "Software Developer", plural: "Software Developers", group: "Tech and science", nationalShare: 0.028, baseWage: 11200, techWeight: 1.6, mfgWeight: 0, examples: "software engineers, IT architects, DevOps" },
  { id: "datasci", name: "Data Scientist", plural: "Data Scientists", group: "Tech and science", nationalShare: 0.004, baseWage: 10800, techWeight: 1.8, mfgWeight: 0, examples: "data scientists, ML engineers, quants" },
  { id: "scientist", name: "Scientist", plural: "Scientists", group: "Tech and science", nationalShare: 0.006, baseWage: 8600, techWeight: 1.2, mfgWeight: 0.2, examples: "chemists, biologists, physicists, materials scientists" },
  { id: "designer", name: "Designer", plural: "Designers", group: "Tech and science", nationalShare: 0.006, baseWage: 6600, techWeight: 0.8, mfgWeight: 0.1, examples: "product, industrial, graphic and fashion designers" },
  { id: "manager", name: "Manager", plural: "Managers", group: "Office and professional", nationalShare: 0.1, baseWage: 10100, techWeight: 0.2, mfgWeight: 0, examples: "operations, sales, finance and general managers" },
];

export const JOB_BY_ID: Record<JobId, JobDef> = Object.fromEntries(JOBS.map((j) => [j.id, j])) as Record<JobId, JobDef>;

/** Jobs where unions and local wage floors matter most. */
export const BLUE_COLLAR: JobId[] = ["laborer", "assembler", "construction", "driver", "extraction", "technician"];
/** Jobs a minimum wage props up. */
export const LOW_WAGE: JobId[] = ["service", "retail", "care", "laborer", "farmworker"];
/** Jobs high-skill immigration law affects. */
export const SKILLED: JobId[] = ["software", "engineer", "scientist", "datasci", "physician"];
