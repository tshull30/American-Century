// Cities: local labor markets, policies, power grids and public opinion.
import { BUILDING_BY_ID, type BuildingTypeId } from "./data/buildings";
import { CITY_SEEDS, POWER_PRICE } from "./data/cities";
import { STATE_PRES_2024 } from "./data/districts";
import { JOBS, JOB_BY_ID, type JobId } from "./data/jobs";
import { STATES, STATE_BY_CODE } from "./data/states";
import type { Building, CityState, Company, GameState, LaborCell } from "./types";
import { clamp, laborKey, rand } from "./util";

/** Megawatts drawn from the local grid per data-center level. */
export const DC_MW_PER_LEVEL = 5;

export function initCities(s: GameState) {
  const cities: Record<string, CityState> = {};
  for (const st of STATES) {
    const inState = CITY_SEEDS.filter((c) => c.state === st.code);
    let used = 0;
    for (const c of inState) {
      const share = Math.min(0.97, c.pop / st.population);
      used += share;
      cities[c.id] = makeCity(c.id, c.name, st.code, c.lat, c.lon, c.tech, c.mfg, c.col, c.flags, share, c.minWage, c.pop);
    }
    const rest = Math.max(0, 1 - used);
    if (rest > 0.02) {
      const big = inState.sort((a, b) => b.pop - a.pop)[0];
      cities[`rest-${st.code}`] = makeCity(
        `rest-${st.code}`, `Rest of ${st.name}`, st.code, big ? big.lat - 0.6 : 39, big ? big.lon + 0.8 : -98,
        st.techIndex * 0.75, st.mfgIndex * 1.15, st.wageIndex * 0.9, ["dc+"], rest, undefined, rest * st.population,
      );
      cities[`rest-${st.code}`].rest = true;
    }
  }
  s.cities = cities;
}

function makeCity(id: string, name: string, state: string, lat: number, lon: number, tech: number, mfg: number, col: number,
  flags: string[], share: number, minWage: number | undefined, pop: number): CityState {
  const stLean = (STATE_PRES_2024[state] ?? 0.5);
  const urban = pop > 3e6 ? 0.15 : pop > 1e6 ? 0.1 : pop > 4e5 ? 0.05 : -0.05;
  const council = clamp(stLean + urban, 0.15, 0.9);
  const dc: CityState["dcStance"] = flags.includes("dc-") ? "neutral" : flags.includes("dc+") ? "welcome" : "neutral";
  return {
    id, name, state, lat, lon, tech, mfg, col, flags, share, council,
    // Republican-leaning places court industry with tax breaks and fast permits; blue cities regulate more.
    taxBreak: clamp(0.25 - (council - 0.4) * 0.6, 0, 0.3),
    permitSpeed: clamp(1.25 - (council - 0.4) * 0.9 - (flags.includes("tower") ? -0.1 : 0), 0.7, 1.4),
    dcStance: dc,
    minWage: minWage ?? 0,
    union: flags.includes("union") ? 1 : council > 0.6 ? 0.6 : 0.3,
    powerIdx: POWER_PRICE[state] ?? 1,
    gridMW: Math.round((pop / 1e6) * 350 + (flags.includes("dc+") ? 2500 : 300)),
    dcLoadMW: 0,
    opinion: {},
  };
}

export function citiesInState(s: GameState, st: string): CityState[] {
  return Object.values(s.cities).filter((c) => c.state === st);
}

/** Workforce by city and job: the state's pops spread over its cities, tech and factory work concentrating where it does in real life. */
export function distributeWorkforce(s: GameState, immigration: (job: JobId) => number) {
  const stateJob: Record<string, number> = {};
  for (const p of s.pops) stateJob[laborKey(p.state, p.job)] = (stateJob[laborKey(p.state, p.job)] ?? 0) + p.workers;
  for (const st of STATES) {
    const cs = citiesInState(s, st.code);
    for (const j of JOBS) {
      const total = (stateJob[laborKey(st.code, j.id)] ?? 0) * immigration(j.id);
      let wsum = 0;
      const w = cs.map((c) => {
        let x = c.share * Math.pow(c.tech / st.techIndex, 1.5 * j.techWeight) * Math.pow(c.mfg / st.mfgIndex, 1.5 * j.mfgWeight);
        if (j.id === "scientist" && c.flags.includes("univ")) x *= 1.6;
        wsum += x;
        return x;
      });
      cs.forEach((c, i) => {
        const k = laborKey(c.id, j.id);
        const cell: LaborCell = s.labor[k] ?? (s.labor[k] = {
          state: st.code, city: c.id, job: j.id, baseWorkforce: 0, workforce: 0, gameEmployed: 0, shortage: 0,
          wage: j.baseWage * c.col,
        });
        cell.workforce = wsum > 0 ? (total * w[i]) / wsum : 0;
        cell.baseWorkforce = cell.workforce;
      });
    }
  }
}

/** Average wage by state and job, weighted by workforce. Pops earn this. */
export function computeStateWages(s: GameState) {
  const acc: Record<string, [number, number]> = {};
  for (const cell of Object.values(s.labor)) {
    const k = laborKey(cell.state, cell.job);
    const a = acc[k] ?? (acc[k] = [0, 0]);
    a[0] += cell.wage * cell.workforce;
    a[1] += cell.workforce;
  }
  s.stateWage = {};
  for (const [k, [w, n]] of Object.entries(acc)) s.stateWage[k] = n > 0 ? w / n : 0;
}

export function stateWage(s: GameState, st: string, job: JobId): number {
  return s.stateWage[laborKey(st, job)] ?? JOB_BY_ID[job].baseWage * (STATE_BY_CODE[st]?.wageIndex ?? 1);
}

/** Aggregated state-level view of a job's labor market. */
export function stateLabor(s: GameState, st: string, job: JobId) {
  let workforce = 0, gameEmployed = 0, shortage = 0;
  for (const c of citiesInState(s, st)) {
    const cell = s.labor[laborKey(c.id, job)];
    if (!cell) continue;
    workforce += cell.workforce;
    gameEmployed += cell.gameEmployed;
    shortage += cell.shortage;
  }
  return { workforce, gameEmployed, shortage, wage: stateWage(s, st, job) };
}

export function cityWorkforce(s: GameState, cityId: string): number {
  let n = 0;
  for (const j of JOBS) n += s.labor[laborKey(cityId, j.id)]?.workforce ?? 0;
  return n;
}

// ---------------------------------------------------------------- building economics

export function opinionOf(s: GameState, cityId: string, c: Company): number {
  return s.cities[cityId]?.opinion[c.id] ?? c.image;
}

/** Local share of build cost covered by the city (tax abatement), better when the city likes you. */
export function cityIncentive(s: GameState, cityId: string, c: Company | undefined, type: BuildingTypeId): number {
  const city = s.cities[cityId];
  if (!city) return 0;
  if (type === "hq" || type === "rnd") return city.taxBreak * 0.5;
  const op = c ? opinionOf(s, cityId, c) : 0.5;
  return clamp(city.taxBreak * (0.6 + op), 0, 0.35);
}

/** Construction time multiplier: permitting speed and how much the locals want you. */
export function permitMult(s: GameState, cityId: string, c: Company | undefined): number {
  const city = s.cities[cityId];
  if (!city) return 1;
  const op = c ? opinionOf(s, cityId, c) : 0.5;
  return city.permitSpeed * (1.5 - op);
}

/** Why a city would refuse a permit, or null if it won't. */
export function permitBlock(s: GameState, cityId: string, c: Company, type: BuildingTypeId): string | null {
  const city = s.cities[cityId];
  if (!city) return "Unknown city.";
  if (type === "datacenter" && city.dcStance === "moratorium") return `${city.name} has a moratorium on new data centers.`;
  if (type === "hq" && c.hqSite.city !== cityId) return "Headquarters floors go in your HQ city. Relocate HQ on the Headquarters tab.";
  if (opinionOf(s, cityId, c) < 0.15) return `${city.name}'s council denied the permit: residents can't stand ${c.name}.`;
  return null;
}

/** Monthly electricity bill per data-center level, rising when the local grid is strained. */
export function dcPowerCost(s: GameState, cityId: string): number {
  const city = s.cities[cityId];
  const idx = city?.powerIdx ?? 1;
  const strain = city ? Math.max(0, city.dcLoadMW / city.gridMW - 0.8) * 2.5 : 0;
  return DC_MW_PER_LEVEL * 730 * 75 * idx * (1 + strain);
}

/**
 * Spread a starting company's levels in a state across its cities in proportion to the
 * workforce in the building's main job, so seeded companies don't all pile into one metro.
 */
export function spreadInState(s: GameState, st: string, type: BuildingTypeId, levels: number, method?: string): [string, number][] {
  if (type === "datacenter" || type === "power" || levels < 4) return [[defaultCity(s, st, type), levels]];
  const def = BUILDING_BY_ID[type];
  const m = def.methods.find((x) => x.id === method) ?? def.methods[0];
  const main = Object.entries(m.staff).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0];
  const cs = citiesInState(s, st);
  const w = cs.map((c) => (s.labor[laborKey(c.id, main)]?.workforce ?? 0) * (def.industry === "office" ? 1 : 1 / c.col));
  const tot = w.reduce((a, b) => a + b, 0) || 1;
  const out: [string, number][] = [];
  let left = levels;
  cs.map((c, i) => ({ c, share: w[i] / tot })).sort((a, b) => b.share - a.share).forEach(({ c, share }, i, arr) => {
    const lv = i === arr.length - 1 ? left : Math.min(left, Math.round(levels * share));
    if (lv > 0) { out.push([c.id, lv]); left -= lv; }
  });
  if (left > 0 && out.length) out[0][1] += left;
  return out;
}

/** Pick a sensible city in a state for a building (used to place the starting companies). */
export function defaultCity(s: GameState, st: string, type: BuildingTypeId): string {
  const cs = citiesInState(s, st);
  const def = BUILDING_BY_ID[type];
  let best = cs[0], bestScore = -Infinity;
  for (const c of cs) {
    let score: number;
    if (type === "datacenter") score = (c.flags.includes("dc+") ? 2 : 0) + c.gridMW / 2000 - c.powerIdx;
    else if (type === "power") score = c.rest ? 5 : -c.share;
    else if (def.industry === "office" || type === "design" || type === "rnd" || type === "hq") score = c.tech * Math.pow(c.share, 0.3);
    else score = c.mfg * Math.pow(c.share, 0.2) / c.col;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best.id;
}

// ---------------------------------------------------------------- monthly city politics

export function updateCities(s: GameState, log: (t: string, kind?: "info" | "bad" | "good", tag?: "city") => void) {
  // Data-center load.
  for (const c of Object.values(s.cities)) c.dcLoadMW = 0;
  for (const co of s.companies) if (co.alive) for (const b of co.buildings) if (b.type === "datacenter" && s.cities[b.city]) s.cities[b.city].dcLoadMW += b.level * DC_MW_PER_LEVEL;

  // Opinion of each company with a presence.
  const presence = new Map<string, Map<number, { emp: number; dc: number; hq: boolean }>>();
  for (const co of s.companies) {
    if (!co.alive) continue;
    for (const [k, n] of Object.entries(co.employees)) {
      const city = k.slice(0, k.lastIndexOf(":"));
      const m = presence.get(city) ?? new Map();
      const e = m.get(co.id) ?? { emp: 0, dc: 0, hq: false };
      e.emp += n;
      m.set(co.id, e);
      presence.set(city, m);
    }
    for (const b of co.buildings) {
      const m = presence.get(b.city) ?? new Map();
      const e = m.get(co.id) ?? { emp: 0, dc: 0, hq: false };
      if (b.type === "datacenter") e.dc += b.level * DC_MW_PER_LEVEL;
      if (b.type === "hq") e.hq = true;
      m.set(co.id, e);
      presence.set(b.city, m);
    }
  }
  for (const city of Object.values(s.cities)) {
    const wf = Math.max(1, cityWorkforce(s, city.id));
    const here = presence.get(city.id);
    for (const co of s.companies) {
      if (!co.alive) { delete city.opinion[co.id]; continue; }
      const p = here?.get(co.id);
      const cur = city.opinion[co.id] ?? co.image;
      if (!p) { city.opinion[co.id] = cur + (co.image - cur) * 0.05; continue; }
      let target = 0.45 + Math.min(0.25, (p.emp / wf) * 25) + 0.3 * (co.wagePolicy - 1) + (co.image - 0.6) * 0.5;
      if (p.hq) target += 0.05 + hqCityOpinionBonus(co);
      if (p.dc > 0) target -= Math.min(0.35, (p.dc / city.gridMW) * 0.6 + (city.flags.includes("water") ? 0.08 : 0) + (city.dcLoadMW > city.gridMW ? 0.1 : 0));
      const laid = co.layoffsByCity[city.id] ?? 0;
      if (p.emp > 0) target -= Math.min(0.4, (laid / p.emp) * 4);
      city.opinion[co.id] = clamp(cur + (clamp(target, 0.02, 0.98) - cur) * 0.12, 0, 1);
    }
    // Councils react: strained grids and unpopular data centers bring moratoriums; empty ones bring welcome mats.
    const strain = city.dcLoadMW / city.gridMW;
    const mine = s.companies.some((co) => co.isPlayer && (co.hqSite.city === city.id || co.buildings.some((b) => b.city === city.id))) ? "city" as const : undefined;
    if (city.dcStance !== "moratorium" && strain > 1.0 && rand(s) < 0.08 + (city.council - 0.5) * 0.2) {
      city.dcStance = "moratorium";
      log(`${city.name} passed a moratorium on new data centers: the grid is at ${(strain * 100).toFixed(0)}% of capacity.`, "bad", mine);
    } else if (city.dcStance === "moratorium" && strain < 0.85 && rand(s) < 0.04) {
      city.dcStance = "neutral";
      log(`${city.name} lifted its data-center moratorium.`, "info", mine);
    } else if (city.dcStance === "neutral" && strain < 0.3 && city.council < 0.45 && rand(s) < 0.01) {
      city.dcStance = "welcome";
      log(`${city.name} is offering incentives to data centers.`, "good");
    }
    // Utilities slowly add capacity where demand is high.
    if (strain > 0.7) city.gridMW = Math.round(city.gridMW * (1 + 0.004 + (city.dcStance === "welcome" ? 0.004 : 0)));
    // Councils drift with their politics.
    if (rand(s) < 0.003) {
      if (city.council > 0.62 && city.minWage < 3600 && !city.rest) {
        city.minWage = Math.max(city.minWage, 2600) + 170;
        log(`${city.name} raised its local minimum wage to $${(city.minWage / 173).toFixed(2)} an hour.`, "info");
      } else if (city.council < 0.45 && city.taxBreak < 0.3) {
        city.taxBreak = clamp(city.taxBreak + 0.05, 0, 0.35);
        log(`${city.name} expanded tax abatements for new plants.`, "good");
      }
    }
  }
}

// HQ hook (avoids a circular import with hq.ts)
let hqCityOpinionBonus: (c: Company) => number = () => 0;
export function setHqOpinionHook(f: (c: Company) => number) { hqCityOpinionBonus = f; }

export function buildingsInCity(s: GameState, cityId: string): { c: Company; b: Building }[] {
  const out: { c: Company; b: Building }[] = [];
  for (const c of s.companies) if (c.alive) for (const b of c.buildings) if (b.city === cityId) out.push({ c, b });
  return out;
}

export function cityLabel(s: GameState, cityId: string): string {
  const c = s.cities[cityId];
  if (!c) return cityId;
  return c.rest ? c.name : `${c.name}, ${c.state}`;
}
