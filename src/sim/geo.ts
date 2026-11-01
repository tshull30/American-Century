// Cities: local labor markets, policies, power grids and public opinion.
import { BUILDING_BY_ID, type BuildingTypeId } from "./data/buildings";
import { CITY_POLITICS, CITY_SEEDS, POWER_PRICE, STATE_LIB } from "./data/cities";
import { METRO_COUNTY, REGIONS } from "./data/regions";
import { RESOURCE_NAME, resourceMult } from "./data/resources";
import { STATE_PRES_2024 } from "./data/districts";
import { LAW_BY_ID } from "./data/laws";
import { offshoreShare } from "./intl";
import { COUNTRY_BY_ID } from "./data/countries";
import { JOBS, JOB_BY_ID, type JobId } from "./data/jobs";
import { STATES, STATE_BY_CODE } from "./data/states";
import type { Building, CityState, Company, GameState, LaborCell } from "./types";
import { clamp, laborKey, rand } from "./util";

/** Building types left-wing councils may ban. */
export const FOSSIL: BuildingTypeId[] = ["oilfield", "gasfield", "refinery"];

/** Megawatts drawn from the local grid per data-center level. */
export const DC_MW_PER_LEVEL = 5;

export function initCities(s: GameState) {
  const cities: Record<string, CityState> = {};
  for (const st of STATES) {
    const inState = CITY_SEEDS.filter((c) => c.state === st.code);
    const stLean = STATE_PRES_2024[st.code] ?? 0.5;
    const stLib = STATE_LIB[st.code] ?? 0.4;
    let used = 0, leanUsed = 0;
    for (const c of inState) {
      const share = Math.min(0.97, c.pop / st.population);
      used += share;
      const urban = c.pop > 3e6 ? 0.15 : c.pop > 1e6 ? 0.1 : c.pop > 4e5 ? 0.05 : -0.05;
      const [lean, lib] = CITY_POLITICS[c.id] ?? [clamp(stLean + urban, 0.15, 0.9), stLib];
      leanUsed += lean * share;
      cities[c.id] = makeCity(c.id, c.name, st.code, c.lat, c.lon, c.tech, c.mfg, c.col, c.flags, share, c.minWage, c.pop, lean, lib);
    }
    const rest = Math.max(0, 1 - used);
    if (rest > 0.02) {
      const big = inState.sort((a, b) => b.pop - a.pop)[0];
      // Whatever the metros don't account for of the state's vote is the rest of the state's.
      const lean = clamp((stLean - leanUsed) / rest, 0.15, 0.75);
      const regions = REGIONS[st.code]?.length ? REGIONS[st.code] : [[`Rural ${st.name}`, "", 1, big ? big.lat - 0.6 : 39, big ? big.lon + 0.8 : -98] as const];
      const wsum = regions.reduce((a, r) => a + r[2], 0);
      regions.forEach((r, i) => {
        const id = i === 0 ? `rest-${st.code}` : `rest-${st.code}-${i + 1}`;
        const share = (rest * r[2]) / wsum;
        cities[id] = makeCity(id, r[0], st.code, r[3], r[4], st.techIndex * 0.75, st.mfgIndex * 1.15, st.wageIndex * 0.9, ["dc+"], share, undefined, share * st.population,
          clamp(lean - 0.02 * i, 0.12, 0.78), clamp(stLib + 0.1, 0, 0.9));
        cities[id].rest = true;
        if (r[1]) cities[id].county = r[1];
      });
    }
    for (const c of inState) if (cities[c.id]) cities[c.id].county = METRO_COUNTY[c.id];
  }
  s.cities = cities;
}

function makeCity(id: string, name: string, state: string, lat: number, lon: number, tech: number, mfg: number, col: number,
  flags: string[], share: number, minWage: number | undefined, pop: number, lean: number, lib: number): CityState {
  const c: CityState = {
    id, name, state, lat, lon, tech, mfg, col, flags, share, council: lean, lean, lib,
    taxBreak: 0, permitSpeed: 1, dcStance: "neutral", dcTaxBreak: 0,
    minWage: minWage ?? 0,
    union: 0,
    powerIdx: POWER_PRICE[state] ?? 1,
    gridMW: Math.round((pop / 1e6) * 350 + (flags.includes("dc+") ? 2500 : 300)),
    dcLoadMW: 0,
    opinion: {},
  };
  applyPolicies(c, true);
  return c;
}

/**
 * Local policy follows the council's politics. Left-leaning councils regulate more, raise wage floors,
 * back unions and worry about water, climate and fossil fuels. Right-leaning ones court industry with
 * tax breaks and fast permits. A libertarian streak means fewer rules and faster permits, but less
 * appetite for handing out incentives or for unions.
 */
export function applyPolicies(c: CityState, initial = false) {
  const left = c.council, lib = c.lib;
  c.taxBreak = clamp(0.25 - (left - 0.4) * 0.6 - (lib - 0.45) * 0.1, 0, 0.32);
  c.permitSpeed = clamp(0.95 + (left - 0.45) * 0.9 - (lib - 0.45) * 0.6 + (c.flags.includes("tower") ? 0.1 : 0), 0.65, 1.45);
  c.union = clamp((c.flags.includes("union") ? 0.6 : 0.1) + (left - 0.45) * 1.5 - (lib - 0.45) * 0.5, 0.05, 1);
  c.dcTaxBreak = clamp((0.5 - left) * 0.5 + (lib - 0.45) * 0.2 + (c.flags.includes("dc+") ? 0.08 : 0) - (c.flags.includes("dc-") ? 0.1 : 0), -0.15, 0.3);
  c.dcWaterRules = c.flags.includes("water") && left > 0.5;
  c.fossilBan = left > 0.68 && lib < 0.5;
  if (initial) {
    c.dcStance = c.flags.includes("dc-") || (left > 0.65 && lib < 0.5) ? "neutral" : c.flags.includes("dc+") || c.dcTaxBreak > 0.12 ? "welcome" : "neutral";
    if (!c.minWage && left > 0.64 && !c.rest && lib < 0.55) c.minWage = 2600;
  }
}

/** Plain-language read on a city's politics. */
export function cityPolitics(c: CityState): string {
  const l = c.lean;
  const side = l > 0.62 ? "Strongly Democratic" : l > 0.53 ? "Leans Democratic" : l >= 0.47 ? "Swing" : l >= 0.38 ? "Leans Republican" : "Strongly Republican";
  const streak = c.lib > 0.65 ? ", with a strong libertarian streak" : c.lib > 0.52 ? ", somewhat libertarian" : c.lib < 0.28 ? ", comfortable with big government" : "";
  return side + streak;
}

const cityIndex = new WeakMap<GameState["cities"], { n: number; by: Map<string, CityState[]> }>();
export function citiesInState(s: GameState, st: string): CityState[] {
  const n = Object.keys(s.cities).length;
  let idx = cityIndex.get(s.cities);
  if (!idx || idx.n !== n) {
    const by = new Map<string, CityState[]>();
    for (const c of Object.values(s.cities)) { const l = by.get(c.state); if (l) l.push(c); else by.set(c.state, [c]); }
    idx = { n, by };
    cityIndex.set(s.cities, idx);
  }
  return idx.by.get(st) ?? [];
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
        if ((j.id === "scientist" || j.id === "datasci" || j.id === "physician") && c.flags.includes("univ")) x *= 1.6;
        if (j.rural) x *= c.rest ? 1 + j.rural : 1 / (1 + 0.3 * j.rural);
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
  const res = BUILDING_BY_ID[type].resource;
  if (res && resourceMult(res, city.state) <= 0) return `There are no ${RESOURCE_NAME[res]} in ${STATE_BY_CODE[city.state]?.name ?? city.state}.`;
  if (res && !city.rest && s.cities[`rest-${city.state}`]) return `Wells, mines and farms go outside the big metros: try ${s.cities[`rest-${city.state}`].name}.`;
  if (city.foreign && type === "hq") return "Headquarters stay in the US.";
  if (city.foreign && COUNTRY_BY_ID[city.state]?.trade === "rival" && (type === "fab" || type === "design" || type === "datacenter" || type === "rnd")) return `US export controls bar advanced chip, AI and research work in ${city.name}.`;
  if (city.fossilBan && FOSSIL.includes(type)) return `${city.name} bans new fossil-fuel projects.`;
  if (type === "hq" && c.hqSite.city !== cityId) return "Headquarters floors go in your HQ city. Relocate HQ on the Headquarters tab.";
  if (opinionOf(s, cityId, c) < 0.15) return `${city.name}'s council denied the permit: residents can't stand ${c.name}.`;
  return null;
}

/** Monthly electricity bill per data-center level, rising when the local grid is strained. */
export function dcPowerCost(s: GameState, cityId: string): number {
  const city = s.cities[cityId];
  const idx = city?.powerIdx ?? 1;
  const strain = city ? Math.max(0, city.dcLoadMW / city.gridMW - 0.8) * 2.5 : 0;
  const local = city ? (1 - city.dcTaxBreak) * (city.dcWaterRules ? 1.1 : 1) : 1;
  return DC_MW_PER_LEVEL * 730 * 75 * idx * (1 + strain) * local;
}

/**
 * Spread a starting company's levels in a state across its cities in proportion to the
 * workforce in the building's main job, so seeded companies don't all pile into one metro.
 */
export function spreadInState(s: GameState, st: string, type: BuildingTypeId, levels: number, method?: string): [string, number][] {
  const def = BUILDING_BY_ID[type];
  if (type === "datacenter" || type === "power" || def.resource || levels < 4) return [[defaultCity(s, st, type), levels]];
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

/** Which named regions sit on which resources (for placing wells, mines and farms). */
const RESOURCE_HINT: Partial<Record<string, RegExp>> = {
  oil: /Permian|Bakken|Basin|West Texas|Panhandle|Uinta|Four Corners|Acadiana|Kenai|Interior|Western Kansas|Western Oklahoma|Central Valley/,
  gas: /Coal|Northeast Pennsylvania|Southwest Coal|Northern Panhandle|Appalachian|Green Country|East Texas|North Louisiana|Permian/,
  coal: /Coal|Powder River|Appalachian|Eastern Kentucky|Little Egypt|Southern Indiana/,
  iron: /Iron Range|Northern Michigan/,
  copper: /Copper|Northern Arizona|Western Montana|Southern Utah/,
  farm: /Farm|Central Valley|Plains|Delta|Heartland|Downstate|Eastern Iowa|Western Iowa|Magic Valley|East River|Central|South Georgia|Eastern Carolina/,
  ranch: /Plains|West|Panhandle|Central|Hill Country|Ozark|Eastern Montana|West River/,
  timber: /Woods|Piney|Mountains|Willamette|Olympic|North|Pine|Highlands/,
  cotton: /South Plains|Panhandle|Delta|South Georgia|Black Belt/,
  dairy: /Fox Valley|Central Valley|Magic Valley|North Country|Western & Northern Wisconsin|Southern Minnesota|Hudson/,
};

/** Give every pop a home metro or region (and so a county), where its kind of work and community concentrate. */
export function assignHomes(s: GameState) {
  const URBAN = new Set(["chinese", "indian", "korean", "vietnamese", "filipino", "asian_other"]);
  for (const p of s.pops) {
    const cs = citiesInState(s, p.state);
    if (!cs.length) continue;
    let tot = 0;
    const w = cs.map((c) => {
      let x = s.labor[laborKey(c.id, p.job)]?.workforce ?? c.share;
      if (URBAN.has(p.culture)) x *= c.rest ? 0.4 : 1.6;
      if ((p.culture === "white" || p.culture === "native") && c.rest) x *= 1.25;
      tot += x;
      return x;
    });
    let r = rand(s) * tot;
    let pick = cs[0];
    for (let i = 0; i < cs.length; i++) { r -= w[i]; if (r <= 0) { pick = cs[i]; break; } }
    p.area = pick.id;
    p.county = pick.county;
  }
}

/** Pick a sensible city in a state for a building (used to place the starting companies). */
export function defaultCity(s: GameState, st: string, type: BuildingTypeId): string {
  const cs = citiesInState(s, st);
  const def = BUILDING_BY_ID[type];
  let best = cs[0], bestScore = -Infinity;
  for (const c of cs) {
    let score: number;
    if (type === "datacenter") score = (c.flags.includes("dc+") ? 2 : 0) + c.gridMW / 2000 - c.powerIdx;
    else if (type === "power" || def.resource) score = (c.rest ? 5 : -c.share) + (def.resource && c.rest && RESOURCE_HINT[def.resource]?.test(c.name) ? 3 : 0);
    else if (type === "refinery" || type === "chemicals") score = (c.flags.includes("port") ? 3 : 0) + c.mfg - c.col;
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
  const stance = new Map<number, Stance>();
  for (const co of s.companies) if (co.alive) stance.set(co.id, companyStance(co));
  const national = s.politics?.poll ?? 0.5;
  const offshore = new Map<number, number>();
  for (const co of s.companies) if (co.alive) offshore.set(co.id, offshoreShare(s, co));
  for (const city of Object.values(s.cities)) {
    if (city.foreign) {
      for (const co of s.companies) if (co.alive) city.opinion[co.id] = 0.6;
      continue;
    }
    // Councils drift with the national mood but stay rooted in who lives there.
    city.council = clamp(city.council + (city.lean + 0.6 * (national - 0.5) - city.council) * 0.03 + 0.004 * (rand(s) - 0.5), 0.1, 0.92);
    applyPolicies(city);
    const left = (city.council - 0.5) * 2;
    const libTilt = (city.lib - 0.45) * 2;
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
      // What residents believe: politics, energy and how a company uses Washington.
      const st = stance.get(co.id)!;
      target -= 0.12 * (offshore.get(co.id) ?? 0); // shipping jobs overseas plays badly at home
      target += 0.12 * left * st.politics + 0.1 * left * (st.green - st.fossil) + 0.06 * -left * st.industry - 0.08 * libTilt * st.subsidies;
      city.opinion[co.id] = clamp(cur + (clamp(target, 0.02, 0.98) - cur) * 0.12, 0, 1);
    }
    // Councils react: strained grids and unpopular data centers bring moratoriums; empty ones bring welcome mats.
    const strain = city.dcLoadMW / city.gridMW;
    const mine = s.companies.some((co) => co.isPlayer && (co.hqSite.city === city.id || co.buildings.some((b) => b.city === city.id))) ? "city" as const : undefined;
    const backlash = 0.08 + (city.council - 0.5) * 0.2 - (city.lib - 0.45) * 0.15 + (city.council < 0.4 && strain > 1.2 ? 0.05 : 0);
    if (city.dcStance !== "moratorium" && strain > 1.0 && rand(s) < backlash) {
      city.dcStance = "moratorium";
      log(`${city.name} passed a moratorium on new data centers: the grid is at ${(strain * 100).toFixed(0)}% of capacity.`, "bad", mine);
    } else if (city.dcStance === "moratorium" && strain < 0.85 && rand(s) < 0.04) {
      city.dcStance = "neutral";
      log(`${city.name} lifted its data-center moratorium.`, "info", mine);
    } else if (city.dcStance === "neutral" && strain < 0.3 && city.dcTaxBreak > 0.1 && rand(s) < 0.01) {
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
      } else if (city.council < 0.45) {
        city.council = clamp(city.council - 0.03, 0.1, 0.92);
        log(`${city.name} elected a business-friendly council majority.`, "good");
      } else if (city.council > 0.55) {
        city.council = clamp(city.council + 0.03, 0.1, 0.92);
        log(`${city.name} elected a progressive council majority.`, "info");
      }
    }
  }
}

// ---------------------------------------------------------------- what a company stands for

export interface Stance {
  /** −1 (lobbies and gives like a Republican) … +1 (like a Democrat). */
  politics: number;
  /** Share of operating levels in oil, gas and gas power. */
  fossil: number;
  /** Share in solar, solar panels and EVs. */
  green: number;
  /** Share in factories, mills and fields (right-leaning towns like these jobs). */
  industry: number;
  /** 0–1: how hard it lobbies for subsidies. */
  subsidies: number;
}

export function companyStance(co: Company): Stance {
  let lobby = 0, total = 0, subs = 0;
  for (const l of co.lobbying) {
    const law = LAW_BY_ID[l.law];
    const dSide = Math.sign(law.platform.commonwealth - law.platform.frontier) || 1;
    lobby += l.dir * dSide * l.monthly;
    total += l.monthly;
    if (l.law === "industrial_policy" && l.dir > 0) subs += l.monthly;
  }
  const d = co.donations.commonwealth ?? 0, r = co.donations.frontier ?? 0;
  const intensity = (x: number) => Math.min(1, x / 2e6);
  const politics = clamp((total > 0 ? (lobby / total) * intensity(total) : 0) * 0.6 + ((d - r) / (d + r + 1e6)) * 0.6, -1, 1);
  let lv = 0, fossil = 0, green = 0, industry = 0;
  for (const b of co.buildings) {
    if (b.level <= 0 || b.type === "hq" || b.type === "rnd") continue;
    lv += b.level;
    if (b.type === "oilfield" || b.type === "gasfield" || b.type === "refinery" || (b.type === "power" && b.method === "gas")) fossil += b.level;
    if (b.type === "solarfab" || (b.type === "power" && b.method === "solar") || (b.type === "auto" && b.method.startsWith("auto"))) green += b.level;
    if (BUILDING_BY_ID[b.type].industry !== "office") industry += b.level;
  }
  return { politics, fossil: lv ? fossil / lv : 0, green: lv ? green / lv : 0, industry: lv ? industry / lv : 0, subsidies: total > 0 ? subs / total * intensity(total) : 0 };
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
  return c.foreign ? c.name : `${c.name}, ${c.state}`;
}
