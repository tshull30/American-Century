// State seed data. APPROXIMATE figures (around 2023–24) typed in by hand, good
// enough to give each state a believable character. Replace them with real ACS
// figures via scripts/pums_to_pops.py.
//
// Columns:
//  fips, code, name, region,
//  population (thousands),
//  % White non-Hispanic, % Hispanic, % Black, % Asian, % Native/Pacific Islander
//  (whatever is left over is multiracial/other),
//  Mexican share of the Hispanic population,
//  tech index, manufacturing index, wage index (1 = national average),
//  state corporate income tax rate (%)

export type Region = "Northeast" | "Midwest" | "South" | "West";

export interface StateDef {
  fips: string;
  code: string;
  name: string;
  region: Region;
  population: number;
  pctWhite: number;
  pctHispanic: number;
  pctBlack: number;
  pctAsian: number;
  pctNative: number;
  mexicanShareOfHispanic: number;
  techIndex: number;
  mfgIndex: number;
  wageIndex: number;
  corpTax: number;
  /** Optional overrides of the national Asian-origin split. */
  asianMix?: Partial<Record<"chinese" | "indian" | "filipino" | "vietnamese" | "korean" | "asian_other", number>>;
}

type Row = [string, string, string, Region, number, number, number, number, number, number, number, number, number, number, number];

const ROWS: Row[] = [
  ["01", "AL", "Alabama", "South", 5108, 63, 5, 26, 1.6, 0.5, 0.6, 0.8, 1.4, 0.85, 6.5],
  ["02", "AK", "Alaska", "West", 733, 57, 8, 3, 6.5, 16, 0.4, 0.7, 0.5, 1.05, 9.4],
  ["04", "AZ", "Arizona", "West", 7431, 52, 32, 5, 3.7, 4, 0.88, 1.1, 1.0, 0.97, 4.9],
  ["05", "AR", "Arkansas", "South", 3068, 69, 9, 15, 1.7, 0.9, 0.7, 0.7, 1.3, 0.82, 4.3],
  ["06", "CA", "California", "West", 38965, 34, 40, 5.4, 15.8, 0.6, 0.82, 2.0, 1.0, 1.25, 8.84],
  ["08", "CO", "Colorado", "West", 5877, 65, 22.5, 4, 3.5, 0.8, 0.75, 1.5, 0.8, 1.08, 4.4],
  ["09", "CT", "Connecticut", "Northeast", 3617, 62, 18, 10.5, 5, 0.2, 0.1, 1.1, 1.2, 1.15, 7.5],
  ["10", "DE", "Delaware", "South", 1031, 59, 10.5, 22, 4.5, 0.3, 0.35, 1.0, 0.7, 1.02, 8.7],
  ["11", "DC", "District of Columbia", "South", 679, 37, 11.5, 43, 4.5, 0.2, 0.15, 1.6, 0.2, 1.35, 8.25],
  ["12", "FL", "Florida", "South", 22610, 51, 27.5, 15, 3, 0.3, 0.15, 1.0, 0.6, 0.95, 5.5],
  ["13", "GA", "Georgia", "South", 11029, 50, 11, 31, 4.6, 0.3, 0.5, 1.2, 1.0, 0.97, 5.39],
  ["15", "HI", "Hawaii", "West", 1435, 21, 11, 2, 37, 10.5, 0.3, 0.7, 0.3, 1.08, 6.4],
  ["16", "ID", "Idaho", "West", 1965, 80, 14, 0.8, 1.5, 1.4, 0.85, 0.9, 1.1, 0.88, 5.8],
  ["17", "IL", "Illinois", "Midwest", 12550, 59, 18.5, 14, 6.3, 0.3, 0.78, 1.2, 1.2, 1.05, 9.5],
  ["18", "IN", "Indiana", "Midwest", 6862, 76, 8, 10, 2.8, 0.3, 0.7, 0.8, 1.8, 0.9, 4.9],
  ["19", "IA", "Iowa", "Midwest", 3207, 83, 7, 4.3, 2.8, 0.5, 0.75, 0.8, 1.5, 0.9, 7.1],
  ["20", "KS", "Kansas", "Midwest", 2940, 73, 13.5, 5.8, 3.2, 1.1, 0.8, 0.9, 1.4, 0.9, 6.5],
  ["21", "KY", "Kentucky", "South", 4526, 82, 4.5, 8.5, 1.7, 0.3, 0.55, 0.7, 1.5, 0.86, 5.0],
  ["22", "LA", "Louisiana", "South", 4574, 56, 6, 32, 1.9, 0.7, 0.3, 0.7, 1.1, 0.9, 7.5],
  ["23", "ME", "Maine", "Northeast", 1395, 91, 2.2, 1.9, 1.3, 0.7, 0.3, 0.7, 0.9, 0.95, 8.93],
  ["24", "MD", "Maryland", "South", 6180, 47, 12, 30, 7, 0.3, 0.15, 1.6, 0.6, 1.15, 8.25],
  ["25", "MA", "Massachusetts", "Northeast", 7001, 67, 13, 7.5, 7.8, 0.2, 0.05, 1.9, 1.0, 1.25, 8.0],
  ["26", "MI", "Michigan", "Midwest", 10037, 73, 6, 13.5, 3.6, 0.6, 0.7, 1.1, 1.8, 0.95, 6.0],
  ["27", "MN", "Minnesota", "Midwest", 5737, 76, 6.5, 7.5, 5.5, 1.1, 0.6, 1.2, 1.3, 1.05, 9.8],
  ["28", "MS", "Mississippi", "South", 2940, 55, 3.5, 37.5, 1.1, 0.5, 0.55, 0.6, 1.3, 0.8, 5.0],
  ["29", "MO", "Missouri", "Midwest", 6196, 77, 5, 11.5, 2.2, 0.5, 0.65, 0.9, 1.1, 0.9, 4.0],
  ["30", "MT", "Montana", "West", 1133, 84, 4.5, 0.6, 0.9, 6.6, 0.65, 0.7, 0.6, 0.9, 6.75],
  ["31", "NE", "Nebraska", "Midwest", 1978, 76, 12.5, 5, 2.8, 1.1, 0.8, 0.9, 1.2, 0.92, 5.84],
  ["32", "NV", "Nevada", "West", 3194, 44, 30, 10.5, 9.5, 1.5, 0.75, 0.9, 0.6, 1.0, 0],
  ["33", "NH", "New Hampshire", "Northeast", 1402, 87, 4.5, 1.8, 3, 0.2, 0.2, 1.2, 1.2, 1.08, 7.5],
  ["34", "NJ", "New Jersey", "Northeast", 9291, 52, 22, 13, 10.5, 0.2, 0.15, 1.4, 1.0, 1.18, 9.0],
  ["35", "NM", "New Mexico", "West", 2114, 35, 50, 2.2, 1.9, 9.6, 0.6, 1.0, 0.6, 0.88, 5.9],
  ["36", "NY", "New York", "Northeast", 19571, 54, 19.5, 14.5, 9.5, 0.3, 0.15, 1.4, 0.7, 1.2, 7.25],
  ["37", "NC", "North Carolina", "South", 10835, 61, 11, 21, 3.5, 1.2, 0.55, 1.3, 1.3, 0.95, 2.5],
  ["38", "ND", "North Dakota", "Midwest", 783, 82, 4.8, 3.6, 1.7, 5.5, 0.7, 0.7, 0.9, 0.98, 4.31],
  ["39", "OH", "Ohio", "Midwest", 11785, 76, 4.8, 13, 2.7, 0.3, 0.45, 1.0, 1.6, 0.92, 3],
  ["40", "OK", "Oklahoma", "South", 4053, 62, 12, 7.5, 2.4, 9, 0.8, 0.8, 1.1, 0.86, 4.0],
  ["41", "OR", "Oregon", "West", 4233, 72, 14.5, 2, 5, 1.6, 0.8, 1.3, 1.2, 1.05, 7.6],
  ["42", "PA", "Pennsylvania", "Northeast", 12962, 73, 9, 11, 4, 0.2, 0.15, 1.1, 1.3, 1.0, 8.49],
  ["44", "RI", "Rhode Island", "Northeast", 1096, 69, 18, 6, 3.5, 0.5, 0.1, 1.0, 1.0, 1.05, 7.0],
  ["45", "SC", "South Carolina", "South", 5373, 62, 6.8, 25, 1.9, 0.4, 0.55, 0.9, 1.5, 0.88, 5.0],
  ["46", "SD", "South Dakota", "Midwest", 919, 80, 4.8, 2.3, 1.6, 9, 0.6, 0.7, 1.0, 0.9, 0],
  ["47", "TN", "Tennessee", "South", 7126, 71, 7, 16, 2, 0.3, 0.6, 1.0, 1.5, 0.9, 6.5],
  ["48", "TX", "Texas", "South", 30503, 39, 40, 12, 5.8, 0.4, 0.85, 1.4, 1.2, 1.0, 1],
  ["49", "UT", "Utah", "West", 3418, 76, 15.5, 1.3, 2.7, 2, 0.7, 1.4, 1.2, 0.97, 4.65],
  ["50", "VT", "Vermont", "Northeast", 647, 89, 2.4, 1.4, 1.9, 0.3, 0.3, 0.8, 1.0, 0.98, 8.5],
  ["51", "VA", "Virginia", "South", 8716, 59, 11, 18.5, 7.5, 0.3, 0.25, 1.6, 0.8, 1.08, 6.0],
  ["53", "WA", "Washington", "West", 7812, 64, 14, 4.3, 10.5, 2, 0.8, 1.9, 1.2, 1.2, 0],
  ["54", "WV", "West Virginia", "South", 1770, 91, 2, 3.6, 0.8, 0.2, 0.4, 0.6, 0.9, 0.82, 6.5],
  ["55", "WI", "Wisconsin", "Midwest", 5911, 79, 8, 6.3, 3.2, 0.9, 0.7, 0.9, 1.8, 0.95, 7.9],
  ["56", "WY", "Wyoming", "West", 584, 82, 10.5, 1, 1, 2.5, 0.7, 0.6, 0.5, 0.95, 0],
];

const ASIAN_OVERRIDES: Record<string, StateDef["asianMix"]> = {
  CA: { chinese: 0.27, filipino: 0.22, vietnamese: 0.12, indian: 0.15, korean: 0.09, asian_other: 0.15 },
  NY: { chinese: 0.4, indian: 0.24, korean: 0.08, filipino: 0.06, vietnamese: 0.02, asian_other: 0.2 },
  NJ: { indian: 0.42, chinese: 0.2, korean: 0.11, filipino: 0.11, vietnamese: 0.02, asian_other: 0.14 },
  TX: { indian: 0.3, vietnamese: 0.17, chinese: 0.18, filipino: 0.1, korean: 0.06, asian_other: 0.19 },
  HI: { filipino: 0.4, chinese: 0.12, korean: 0.06, vietnamese: 0.03, indian: 0.01, asian_other: 0.38 },
  NV: { filipino: 0.38, chinese: 0.18, korean: 0.08, vietnamese: 0.06, indian: 0.06, asian_other: 0.24 },
  WA: { chinese: 0.22, indian: 0.2, vietnamese: 0.12, filipino: 0.15, korean: 0.1, asian_other: 0.21 },
  IL: { indian: 0.33, chinese: 0.2, filipino: 0.18, korean: 0.09, vietnamese: 0.04, asian_other: 0.16 },
  GA: { indian: 0.3, chinese: 0.15, korean: 0.14, vietnamese: 0.12, filipino: 0.06, asian_other: 0.23 },
  VA: { indian: 0.25, korean: 0.15, chinese: 0.14, filipino: 0.13, vietnamese: 0.11, asian_other: 0.22 },
  MA: { chinese: 0.33, indian: 0.24, vietnamese: 0.12, korean: 0.06, filipino: 0.03, asian_other: 0.22 },
  MN: { asian_other: 0.45, indian: 0.15, chinese: 0.12, vietnamese: 0.12, korean: 0.08, filipino: 0.04 },
};

export const STATES: StateDef[] = ROWS.map((r) => ({
  fips: r[0], code: r[1], name: r[2], region: r[3], population: r[4] * 1000,
  pctWhite: r[5], pctHispanic: r[6], pctBlack: r[7], pctAsian: r[8], pctNative: r[9],
  mexicanShareOfHispanic: r[10], techIndex: r[11], mfgIndex: r[12], wageIndex: r[13], corpTax: r[14],
  asianMix: ASIAN_OVERRIDES[r[1]],
}));

export const STATE_BY_CODE: Record<string, StateDef> = Object.fromEntries(STATES.map((s) => [s.code, s]));
export const STATE_BY_FIPS: Record<string, StateDef> = Object.fromEntries(STATES.map((s) => [s.fips, s]));
