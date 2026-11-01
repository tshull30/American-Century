import type { JobId } from "./jobs";

// Culture groups, built from census race, Hispanic-origin and Asian-detail questions.
export type CultureId =
  | "white"
  | "black"
  | "mexican"
  | "latino"
  | "chinese"
  | "indian"
  | "filipino"
  | "vietnamese"
  | "korean"
  | "asian_other"
  | "native"
  | "multiracial";

export interface CultureDef {
  id: CultureId;
  name: string;
  adjective: string;
  color: string;
  /**
   * Relative over/under-representation in each job compared with the workforce
   * as a whole (1 = average). Rough national figures; the pop generator rakes
   * these against each state's real totals so the margins still add up.
   */
  jobSkew: Partial<Record<JobId, number>>;
}

export const CULTURES: CultureDef[] = [
  { id: "white", name: "White American", adjective: "White", color: "#8da0cb",
    jobSkew: { manager: 1.15, professional: 1.05, engineer: 1.05, technician: 1.1, service: 0.85, laborer: 0.9, construction: 0.95, farmworker: 1.0, extraction: 1.35, lawyer: 1.3, physician: 1.05, teacher: 1.2, accountant: 1.1, sales: 1.1, designer: 1.1, driver: 0.95, retail: 0.95, care: 0.7, assembler: 0.9 } },
  { id: "black", name: "African American", adjective: "Black", color: "#e78ac3",
    jobSkew: { service: 1.3, retail: 1.25, care: 1.9, nurse: 1.2, clerk: 1.2, driver: 1.45, laborer: 1.25, assembler: 1.1, construction: 0.6, farmworker: 0.3, extraction: 0.5, software: 0.55, datasci: 0.5, engineer: 0.5, scientist: 0.5, manager: 0.7, professional: 0.85, lawyer: 0.55, physician: 0.55, accountant: 0.8, designer: 0.6, teacher: 0.9 } },
  { id: "mexican", name: "Mexican American", adjective: "Mexican American", color: "#fc8d62",
    jobSkew: { laborer: 1.6, construction: 2.3, farmworker: 3.2, assembler: 1.5, driver: 1.25, service: 1.35, retail: 1.0, care: 1.1, technician: 0.95, extraction: 1.2, software: 0.35, datasci: 0.3, engineer: 0.45, scientist: 0.4, professional: 0.55, manager: 0.6, lawyer: 0.35, physician: 0.3, accountant: 0.55, teacher: 0.7, nurse: 0.6 } },
  { id: "latino", name: "Latino (Caribbean & Latin American)", adjective: "Latino", color: "#ffb36b",
    jobSkew: { laborer: 1.45, construction: 1.7, farmworker: 1.4, assembler: 1.2, driver: 1.2, service: 1.4, care: 1.4, retail: 1.1, clerk: 1.05, software: 0.5, datasci: 0.45, engineer: 0.55, scientist: 0.5, professional: 0.65, manager: 0.7, lawyer: 0.5, physician: 0.5, teacher: 0.75 } },
  { id: "chinese", name: "Chinese American", adjective: "Chinese American", color: "#66c2a5",
    jobSkew: { software: 3.8, datasci: 4.0, engineer: 2.4, scientist: 3.2, physician: 2.2, accountant: 1.6, professional: 1.3, manager: 1.1, designer: 1.3, laborer: 0.35, construction: 0.2, farmworker: 0.1, driver: 0.3, service: 0.9, extraction: 0.1 } },
  { id: "indian", name: "Indian American", adjective: "Indian American", color: "#a6d854",
    jobSkew: { software: 4.5, datasci: 4.8, engineer: 2.6, scientist: 2.6, physician: 3.0, accountant: 1.7, professional: 1.6, manager: 1.3, retail: 0.9, laborer: 0.2, construction: 0.15, farmworker: 0.1, driver: 0.5, service: 0.5, technician: 0.6, extraction: 0.1 } },
  { id: "filipino", name: "Filipino American", adjective: "Filipino American", color: "#4dc9b0",
    jobSkew: { nurse: 4.0, care: 2.0, professional: 1.3, service: 1.15, technician: 1.0, software: 1.2, accountant: 1.3, laborer: 0.6, farmworker: 0.5, construction: 0.6 } },
  { id: "vietnamese", name: "Vietnamese American", adjective: "Vietnamese American", color: "#2ca58d",
    jobSkew: { technician: 1.3, service: 1.7, assembler: 1.5, engineer: 1.5, software: 1.6, datasci: 1.4, laborer: 0.9, manager: 0.8, construction: 0.5, farmworker: 0.3 } },
  { id: "korean", name: "Korean American", adjective: "Korean American", color: "#8fd3a0",
    jobSkew: { software: 2.0, datasci: 1.8, professional: 1.3, manager: 1.25, engineer: 1.6, physician: 1.6, retail: 1.3, laborer: 0.5, construction: 0.4, farmworker: 0.2 } },
  { id: "asian_other", name: "Other Asian American", adjective: "Asian American", color: "#b3de69",
    jobSkew: { software: 2.0, datasci: 2.0, engineer: 1.6, scientist: 1.8, physician: 1.6, professional: 1.15, laborer: 0.7, construction: 0.5, farmworker: 0.4 } },
  { id: "native", name: "Native American & Pacific Islander", adjective: "Native", color: "#e5c494",
    jobSkew: { laborer: 1.3, construction: 1.4, extraction: 1.8, farmworker: 1.5, driver: 1.3, service: 1.2, care: 1.3, technician: 1.1, software: 0.4, datasci: 0.35, engineer: 0.5, scientist: 0.5, manager: 0.75, professional: 0.7, lawyer: 0.5, physician: 0.4 } },
  { id: "multiracial", name: "Multiracial & Other", adjective: "Multiracial", color: "#b3b3b3",
    jobSkew: { service: 1.1, retail: 1.15, care: 1.1, software: 0.9 } },
];

export const CULTURE_BY_ID: Record<CultureId, CultureDef> = Object.fromEntries(CULTURES.map((c) => [c.id, c])) as Record<CultureId, CultureDef>;

/** National split of the Asian American population by origin. */
export const ASIAN_SPLIT: Record<"chinese" | "indian" | "filipino" | "vietnamese" | "korean" | "asian_other", number> = {
  chinese: 0.24, indian: 0.21, filipino: 0.19, vietnamese: 0.1, korean: 0.08, asian_other: 0.18,
};
