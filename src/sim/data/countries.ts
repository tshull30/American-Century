// Countries where companies can build abroad, and where America's imports come from.
// Rough mid-2020s figures, rounded for the game:
//   labor: labor force (millions)
//   wage: manufacturing-weighted wage level vs the US (1 = US average)
//   productivity: output per worker vs a US plant (supply chains, skills, infrastructure)
//   tech / mfg: concentration of tech and factory work (1 = US average)
//   ship: freight and duties-handling cost on goods sold into the US, as a share of price
//   risk: chance-weighted disruption risk (0 = none, 1 = high); drives events
//   trade: how US tariffs treat it. usmca = exempt below heavy tariffs; ally = normal; rival = extra duties
//   taxBreak: local incentives for new plants (share of build cost)

export type CountryId = "CHN" | "MEX" | "CAN" | "VNM" | "IND" | "JPN" | "KOR" | "TWN" | "DEU" | "IRL" | "SAU" | "BRA";

export interface CountryDef {
  id: CountryId;
  name: string;
  labor: number;
  wage: number;
  productivity: number;
  tech: number;
  mfg: number;
  ship: number;
  risk: number;
  trade: "usmca" | "ally" | "rival";
  taxBreak: number;
  /** Share of world (non-US) demand for goods, roughly by GDP. */
  demand: number;
  blurb: string;
}

export const COUNTRIES: CountryDef[] = [
  { id: "CHN", name: "China", labor: 770, wage: 0.22, productivity: 0.85, tech: 1.1, mfg: 2.2, ship: 0.05, risk: 0.5, trade: "rival", taxBreak: 0.15, demand: 0.2,
    blurb: "The world's factory floor: deep supplier networks, rising wages, and the target of most US tariffs." },
  { id: "MEX", name: "Mexico", labor: 60, wage: 0.17, productivity: 0.7, tech: 0.6, mfg: 1.6, ship: 0.02, risk: 0.25, trade: "usmca", taxBreak: 0.1, demand: 0.02,
    blurb: "Nearshoring hub for cars and electronics, duty-free under USMCA unless tariffs get heavy." },
  { id: "CAN", name: "Canada", labor: 21, wage: 0.85, productivity: 0.95, tech: 1.1, mfg: 1.0, ship: 0.015, risk: 0.05, trade: "usmca", taxBreak: 0.05, demand: 0.025,
    blurb: "Oil sands, autos and aluminum next door, mostly duty-free." },
  { id: "VNM", name: "Vietnam", labor: 52, wage: 0.1, productivity: 0.6, tech: 0.5, mfg: 1.9, ship: 0.05, risk: 0.2, trade: "ally", taxBreak: 0.2, demand: 0.006,
    blurb: "Cheap labor and generous incentives; where phones, sneakers and furniture moved from China." },
  { id: "IND", name: "India", labor: 590, wage: 0.08, productivity: 0.55, tech: 0.9, mfg: 1.0, ship: 0.05, risk: 0.2, trade: "ally", taxBreak: 0.15, demand: 0.05,
    blurb: "A billion consumers, a deep bench of software engineers and a young phone-assembly industry." },
  { id: "JPN", name: "Japan", labor: 69, wage: 0.6, productivity: 1.05, tech: 1.3, mfg: 1.5, ship: 0.04, risk: 0.1, trade: "ally", taxBreak: 0.05, demand: 0.05,
    blurb: "Precision manufacturing, cars and chip materials; an aging workforce." },
  { id: "KOR", name: "South Korea", labor: 29, wage: 0.6, productivity: 1.0, tech: 1.5, mfg: 1.7, ship: 0.04, risk: 0.2, trade: "ally", taxBreak: 0.1, demand: 0.02,
    blurb: "Memory chips, batteries, ships and cars." },
  { id: "TWN", name: "Taiwan", labor: 12, wage: 0.45, productivity: 1.1, tech: 1.8, mfg: 1.9, ship: 0.045, risk: 0.6, trade: "ally", taxBreak: 0.15, demand: 0.01,
    blurb: "Makes almost every advanced chip on Earth, a hundred miles from the mainland." },
  { id: "DEU", name: "Germany", labor: 44, wage: 0.85, productivity: 1.0, tech: 1.2, mfg: 1.5, ship: 0.04, risk: 0.05, trade: "ally", taxBreak: 0.05, demand: 0.06,
    blurb: "Engineering, chemicals and cars; expensive power." },
  { id: "IRL", name: "Ireland", labor: 2.8, wage: 0.85, productivity: 1.0, tech: 1.8, mfg: 0.9, ship: 0.04, risk: 0.05, trade: "ally", taxBreak: 0.25, demand: 0.005,
    blurb: "Low taxes, English-speaking talent; Europe's home for pharma plants and data centers." },
  { id: "SAU", name: "Saudi Arabia", labor: 17, wage: 0.5, productivity: 0.8, tech: 0.6, mfg: 0.7, ship: 0.05, risk: 0.35, trade: "ally", taxBreak: 0.2, demand: 0.015,
    blurb: "Cheapest oil on the planet and a crown prince who wants factories too." },
  { id: "BRA", name: "Brazil", labor: 108, wage: 0.2, productivity: 0.65, tech: 0.6, mfg: 0.9, ship: 0.05, risk: 0.25, trade: "ally", taxBreak: 0.1, demand: 0.03,
    blurb: "Soybeans, beef, iron ore and offshore oil." },
];

export const COUNTRY_BY_ID: Record<string, CountryDef> = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));

export function isForeign(code: string): boolean {
  return code in COUNTRY_BY_ID;
}

/**
 * Where US imports of each good come from (share of imports). Used for the World tab and for
 * which countries' events move import prices.
 */
export const IMPORT_ORIGINS: Partial<Record<string, Partial<Record<CountryId | "Other", number>>>> = {
  components: { CHN: 0.35, MEX: 0.15, DEU: 0.08, JPN: 0.07, KOR: 0.05, VNM: 0.05, Other: 0.25 },
  chips: { TWN: 0.45, KOR: 0.15, CHN: 0.1, JPN: 0.08, Other: 0.22 },
  batteries: { CHN: 0.65, KOR: 0.15, JPN: 0.1, Other: 0.1 },
  ai_accelerators: { TWN: 0.85, KOR: 0.05, Other: 0.1 },
  smartphones: { CHN: 0.7, IND: 0.15, VNM: 0.1, KOR: 0.03, Other: 0.02 },
  computers: { CHN: 0.6, MEX: 0.15, VNM: 0.1, TWN: 0.1, Other: 0.05 },
  evs: { MEX: 0.3, KOR: 0.25, JPN: 0.2, DEU: 0.2, Other: 0.05 },
  gas_cars: { MEX: 0.35, JPN: 0.25, CAN: 0.15, KOR: 0.12, DEU: 0.1, Other: 0.03 },
  groceries: { MEX: 0.35, CAN: 0.25, BRA: 0.05, Other: 0.35 },
  apparel: { CHN: 0.3, VNM: 0.2, IND: 0.06, Other: 0.44 },
  pharmaceuticals: { IRL: 0.3, DEU: 0.15, IND: 0.12, Other: 0.43 },
  crude_oil: { CAN: 0.6, MEX: 0.08, SAU: 0.07, BRA: 0.04, Other: 0.21 },
  natural_gas: { CAN: 0.95, Other: 0.05 },
  fuel: { CAN: 0.4, Other: 0.6 },
  steel: { CAN: 0.22, MEX: 0.12, BRA: 0.15, KOR: 0.1, JPN: 0.05, Other: 0.36 },
  chemicals: { CHN: 0.15, DEU: 0.12, IRL: 0.1, CAN: 0.1, SAU: 0.05, Other: 0.48 },
  crops: { MEX: 0.3, CAN: 0.25, BRA: 0.15, Other: 0.3 },
  solar_panels: { VNM: 0.3, IND: 0.1, KOR: 0.08, CHN: 0.05, Other: 0.47 },
  household_goods: { CHN: 0.4, MEX: 0.15, CAN: 0.1, Other: 0.35 },
};

/** Where recent immigrants come from, by the game's culture groups (share of net immigration). */
export const IMMIGRANT_MIX: Record<string, number> = {
  mexican: 0.18, latino: 0.25, indian: 0.14, chinese: 0.07, filipino: 0.05, vietnamese: 0.03, korean: 0.02,
  asian_other: 0.07, white: 0.11, black: 0.07, multiracial: 0.01,
};
