// The rest of the world: foreign labor pools you can build in, tariffs and freight on what
// you ship home, and immigrants arriving in American pops.
import { COUNTRIES, COUNTRY_BY_ID, IMMIGRANT_MIX, type CountryDef } from "./data/countries";
import { CULTURE_BY_ID, type CultureId } from "./data/cultures";
import { JOBS, JOB_BY_ID, type JobId } from "./data/jobs";
import { lv, tariffRate } from "./politics";
import type { CityState, Company, GameState } from "./types";
import { clamp, laborKey } from "./util";

export interface IntlPop {
  country: string;
  job: JobId;
  workers: number;
}

export const intlCityId = (c: string) => `intl-${c}`;

export function countryOfCity(s: GameState, cityId: string): CountryDef | undefined {
  const c = s.cities[cityId];
  return c?.foreign ? COUNTRY_BY_ID[c.state] : undefined;
}

/** Job mix abroad: like the US formula, skewed by the country's tech and factory profile. */
function jobShares(c: CountryDef): Record<JobId, number> {
  const raw = {} as Record<JobId, number>;
  let tot = 0;
  for (const j of JOBS) {
    let v = j.nationalShare * Math.pow(c.tech, j.techWeight) * Math.pow(c.mfg, j.mfgWeight);
    if (j.id === "farmworker") v *= c.wage < 0.3 ? 8 : 1.5; // poorer countries still farm by hand
    raw[j.id] = v;
    tot += v;
  }
  for (const j of JOBS) raw[j.id] /= tot;
  return raw;
}

/** Foreign "cities" (one per country), their pops and labor pools. */
export function initWorld(s: GameState) {
  s.intlPops = [];
  for (const c of COUNTRIES) {
    const city: CityState = {
      id: intlCityId(c.id), name: c.name, state: c.id, lat: 0, lon: 0, tech: c.tech, mfg: c.mfg, col: c.wage, flags: ["foreign"], share: 1,
      council: 0.5, lean: 0.5, lib: 0.5, taxBreak: c.taxBreak, permitSpeed: c.id === "CHN" || c.id === "VNM" ? 0.75 : 1, dcStance: "neutral",
      dcTaxBreak: 0, minWage: 0, union: c.id === "DEU" ? 0.8 : 0.2, powerIdx: c.id === "SAU" ? 0.5 : c.id === "DEU" || c.id === "JPN" ? 1.6 : 0.9,
      gridMW: 20000, dcLoadMW: 0, opinion: {}, foreign: true,
    };
    s.cities[city.id] = city;
    const js = jobShares(c);
    for (const j of JOBS) {
      // Only the slice of each country's workforce that's realistically hireable by a foreign company.
      const workers = c.labor * 1e6 * js[j.id] * 0.25;
      s.intlPops.push({ country: c.id, job: j.id, workers });
      const k = laborKey(city.id, j.id);
      s.labor[k] = { state: c.id, city: city.id, job: j.id, baseWorkforce: workers, workforce: workers, gameEmployed: 0, shortage: 0, wage: j.baseWage * c.wage };
    }
  }
}

/** US tariff on goods made in a country and sold into the US. */
export function countryTariff(s: GameState, c: CountryDef): number {
  const t = tariffRate(s);
  if (c.trade === "usmca") return lv(s, "tariffs") >= 2 ? t * 0.5 : 0;
  if (c.trade === "rival") return t + (lv(s, "tariffs") >= 1 ? 0.15 : 0);
  return t;
}

/** Per-good cost of shipping a unit home from each foreign plant: tariff plus freight, as a share of price. */
export function homeCostShare(s: GameState, cityId: string): number {
  const c = countryOfCity(s, cityId);
  return c ? countryTariff(s, c) + c.ship : 0;
}

/** Monthly: foreign workforces grow slowly; immigrants join American pops. */
export function updateWorld(s: GameState) {
  for (const p of s.intlPops ?? []) {
    p.workers *= 1 + 0.008 / 12;
    const cell = s.labor[laborKey(intlCityId(p.country), p.job)];
    if (cell) { cell.baseWorkforce = p.workers; cell.workforce = p.workers; }
  }
  immigrate(s);
}

/** About a million net immigrants a year at today's law (half the labor force), more or fewer with immigration policy. */
function immigrate(s: GameState) {
  const level = lv(s, "immigration");
  const yearly = [0.45e6, 1e6, 1.4e6][level] * 0.5;
  const monthly = yearly / 12;
  s.immigrantsThisYear = (s.immigrantsThisYear ?? 0) + monthly;
  const byCulture = new Map<CultureId, typeof s.pops>();
  for (const p of s.pops) {
    const l = byCulture.get(p.culture) ?? [];
    l.push(p);
    byCulture.set(p.culture, l);
  }
  for (const [cul, share] of Object.entries(IMMIGRANT_MIX) as [CultureId, number][]) {
    const pops = byCulture.get(cul);
    if (!pops || !CULTURE_BY_ID[cul]) continue;
    const tot = pops.reduce((a, p) => a + p.workers, 0);
    if (!tot) continue;
    // Newcomers settle where their community already lives and work where it works; skilled visas grow with the law.
    for (const p of pops) {
      const skilled = JOB_BY_ID[p.job].group === "Tech and science" ? [0.6, 1, 1.5][level] : 1;
      const add = monthly * share * (p.workers / tot) * skilled;
      p.workers += add;
      p.dependents += add * 0.6;
    }
  }
}

/** Share of a company's operating levels that sit abroad. */
export function offshoreShare(s: GameState, co: Company): number {
  let f = 0, t = 0;
  for (const b of co.buildings) {
    if (b.level <= 0 || b.type === "hq" || b.type === "rnd") continue;
    t += b.level;
    if (s.cities[b.city]?.foreign) f += b.level;
  }
  return t ? f / t : 0;
}

export function clampShare(x: number) { return clamp(x, 0, 1); }
