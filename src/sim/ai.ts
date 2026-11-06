// Rival company behavior. Simple heuristics; the same action functions the player uses.
import { feudPriceMult } from "./people";
import { consentCap } from "./corp";
import { crimeFx } from "./crime";
import { BUILDING_BY_ID, methodOf, type BuildingTypeId } from "./data/buildings";
import { GOOD_BY_ID, type GoodId } from "./data/goods";
import {
  offer, acquisitionPrice, antitrustIssue, borrow, build, buyback, downsize, issueShares, liquidity, repay,
} from "./actions";
import { adminCapacity, adminLoad, buildCostPerLevel, creditLimit, quality, usShare } from "./engine";
import { opinionOf, permitBlock, permitMult } from "./geo";
import { resourceMult, SUN } from "./data/resources";
import { COUNTRY_BY_ID } from "./data/countries";
import { JOB_BY_ID, type JobId } from "./data/jobs";
import { siteMultFor } from "./sectors";
import { homeCostShare } from "./intl";
import type { Building, Company, GameState } from "./types";
import { clamp, DAYS_PER_MONTH, laborKey, rand } from "./util";

/**
 * Daily price nudge toward where production and sales balance, never below cost.
 * About ±0.1% a day (≈3% a month).
 */
export function autoPrice(s: GameState, c: Company, g: GoodId) {
  const def = GOOD_BY_ID[g];
  const produced = c.dayProduced[g] ?? 0;
  const sold = (c.daySold[g] ?? 0) + (c.inputUse[g] ?? 0);
  if (produced <= 0 && sold <= 0) return;
  const inv = Math.max(0, (c.inventory[g] ?? 0) - (c.inputUse[g] ?? 0));
  const p = c.prices[g] ?? def.refPrice;
  let next = p;
  // Services can't be stockpiled (unsold capacity just vanishes), so watch sell-through as well as stock.
  if (inv > 36 * Math.max(sold, produced * 0.5) || sold < produced * 0.85) next = p * 0.999;
  else if (inv < 7.5 * Math.max(produced, 1e-9) && sold >= produced * 0.95) next = p * 1.0008;
  let floor = Math.max(def.refPrice * 0.3, (c.unitCost[g] ?? 0) * 1.02);
  // Commodities trade near the world price: dumping far below it would just hand buyers a gift.
  if (def.priceSensitivity >= 3.5) floor = Math.max(floor, (s.markets[g]?.othersPrice ?? def.refPrice) * 0.88);
  // Buyers pay a premium only for better products or a trusted name; an unknown seller can't charge more than the market.
  const others = s.markets[g]?.othersPrice ?? def.refPrice;
  const brandStrength = Math.min(1, (c.brand[g] ?? 0) / 0.02);
  const premium = Math.min(1.7, Math.pow(Math.max(1, quality(s, c, g) ** 2 * (c.reputation[g] ?? 1)), 1 / def.priceSensitivity) * (1 + 0.4 * brandStrength));
  const ceiling = Math.max(floor, Math.min(def.refPrice * 3, others * premium) * (c.isPlayer ? 1 : feudPriceMult(s, c, g)) * crimeFx.cartelMult(s, c, g));
  next = clamp(next, floor, (globalThis as { NOCEIL?: boolean }).NOCEIL ? def.refPrice * 3 : ceiling);
  if (def.importPrice && def.intermediate) next = Math.min(next, def.importPrice * 0.99);
  next = Math.min(next, consentCap(s, c, g));
  c.prices[g] = next;
}

function producedGoods(c: Company): Map<GoodId, Building[]> {
  const m = new Map<GoodId, Building[]>();
  for (const b of c.buildings) {
    for (const g of Object.keys(methodOf(b.type, b.method).output) as GoodId[]) {
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(b);
    }
  }
  return m;
}

function monthlyCosts(c: Company): number {
  const h = c.history[c.history.length - 1];
  if (!h) return 1e6;
  return h.inputCosts + h.wages + h.rdCost + h.sgaCost + h.marketing + h.interest + h.capex;
}

/**
 * Best city for a building: deep local labor pools in its key jobs at low wages, cheap land,
 * good incentives, fast permits, a town that likes you, and for data centers cheap power with grid headroom.
 */
export function bestCity(s: GameState, c: Company, type: BuildingTypeId, method: string): string {
  const m = methodOf(type, method);
  const jobs = Object.entries(m.staff).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 2);
  let best = c.hqSite.city;
  let bestScore = -Infinity;
  const present = new Set(c.buildings.map((b) => b.city));
  // Most expansion decisions don't even consider going abroad.
  const considerAbroad = rand(s) < 0.2;
  for (const city of Object.values(s.cities)) {
    if (city.foreign && !considerAbroad) continue;
    if (permitBlock(s, city.id, c, type)) continue;
    let score = 0;
    const eff = siteMultFor(type, method, city.state);
    for (const [j, n] of jobs) {
      const cell = s.labor[laborKey(city.id, j)];
      if (!cell) continue;
      const free = Math.max(0, cell.workforce - cell.gameEmployed);
      // Abroad, count productivity and the cost of managing from a distance.
      const wage = city.foreign ? cell.wage / Math.max(0.2, eff) + 0.35 * JOB_BY_ID[j as JobId].baseWage : cell.wage;
      score += (n ?? 0) * Math.log(1 + Math.min(free, 2e5)) - (n ?? 0) * 3 * (wage / 5000);
    }
    score /= Math.max(1, jobs.reduce((a, [, n]) => a + (n ?? 0), 0)) / 20;
    score -= (buildCostPerLevel(s, type, city.id, method, true, c) / BUILDING_BY_ID[type].cost) * 2;
    score -= permitMult(s, city.id, c) * 2;
    score += (opinionOf(s, city.id, c) - 0.5) * 6;
    if (type === "datacenter") score += -city.powerIdx * 6 - Math.max(0, city.dcLoadMW / city.gridMW - 0.6) * 10 + (city.dcStance === "welcome" ? 2 : 0) - (city.flags.includes("water") ? 1.5 : 0);
    const def = BUILDING_BY_ID[type];
    if (def.resource) score += resourceMult(def.resource, city.state) * 6;
    if (type === "power" && method === "solar") score += ((SUN[city.state] ?? 1) - 1) * 12;
    if (type === "refinery" || type === "chemicals") score += city.flags.includes("port") ? 2 : 0;
    if (city.foreign) {
      // Cheap labor abroad, but tariffs and freight on what comes home, lower productivity, risk and politics.
      const goods = Object.keys(m.output) as GoodId[];
      const us = goods.length ? goods.reduce((a, g) => a + (GOOD_BY_ID[g].intermediate ? 0.5 : usShare(s, g)), 0) / goods.length : 0.5;
      const ctry = COUNTRY_BY_ID[city.state];
      score -= 40 * us * homeCostShare(s, city.id) + 6 * ctry.risk + 8 * (1 - ctry.productivity) + 3;
      if (def.industry === "office" && type !== "datacenter") score -= 4;
    }
    if (present.has(city.id)) score += 2;
    score += rand(s) * 2;
    if (score > bestScore) { bestScore = score; best = city.id; }
  }
  return best;
}

/** Headquarters keeps pace with the company's size (AI always; the player if they turn it on). */
export function maintainHQ(s: GameState, c: Company): string | null {
  const load = adminLoad(c);
  const cap = adminCapacity(c);
  const hqBuilding = c.buildings.filter((b) => b.type === "hq").reduce((a, b) => a + b.construction.reduce((x, j) => x + j.levels, 0), 0);
  if (load > cap * 0.95 && hqBuilding === 0) {
    const add = Math.ceil((load * 1.1 - cap) / 15);
    if (add > 0 && liquidity(c) > buildCostPerLevel(s, "hq", c.hqSite.city, undefined, true, c) * add) {
      const r = build(s, c.id, "hq", c.hqSite.city, add);
      return r.ok ? r.message : null;
    }
  }
  return null;
}

export function runAI(s: GameState, c: Company, o: { warmup: boolean }) {
  // Finance housekeeping every month.
  const costs = monthlyCosts(c);
  if (c.cash < 2 * costs) {
    const room = creditLimit(c) - c.debt;
    if (room > 0) borrow(s, c.id, Math.min(room, 3 * costs - c.cash));
  } else if (c.debt > creditLimit(c) && c.cash > costs) {
    repay(s, c.id, Math.min(c.debt, c.cash - costs));
  } else if (c.cash > 6 * costs && c.debt > 0) {
    repay(s, c.id, Math.min(c.debt, c.cash - 4 * costs));
  }
  if (o.warmup) return;

  // Startups raise money when the runway gets short.
  const burn = Math.max(0, -(c.history[c.history.length - 1]?.netIncome ?? 0));
  if (c.kind === "startup" && burn > 0 && c.cash < burn * 9 && c.marketCap > 20e6) issueShares(s, c.id, 0.2);

  // Big strategic moves once a quarter, staggered between companies.
  if ((s.month + c.id) % 3 !== 0) return;
  const goods = producedGoods(c);
  const last = c.history[c.history.length - 1];
  if (!last) return;

  for (const [g, blds] of goods) {
    const def = GOOD_BY_ID[g];
    const ops = blds.filter((b) => b.level > 0);
    const levels = ops.reduce((a, b) => a + b.level, 0);
    const building = blds.reduce((a, b) => a + b.construction.reduce((x, j) => x + j.levels, 0), 0);
    let produced = 0;
    for (const b of ops) produced += b.lastOutput[g] ?? 0;
    const sold = last.unitsSold[g] ?? 0;
    const internal = (c.inputUse[g] ?? 0) * DAYS_PER_MONTH;
    const inv = c.inventory[g] ?? 0;
    const price = c.prices[g] ?? def.refPrice;
    const unitCost = c.unitCost[g] ?? price * 0.7;
    const avgStaff = ops.length ? ops.reduce((a, b) => a + b.staffRatio * b.level, 0) / Math.max(1, levels) : 1;
    const template = blds[0];
    const m = methodOf(template.type, template.method);
    const outPerLevel = m.output[g] ?? 1;
    const margin = (price - unitCost) * outPerLevel;
    const costPerLevel = BUILDING_BY_ID[template.type].cost;
    const payback = margin > 0 ? costPerLevel / margin : Infinity;

    const growthMode = c.kind === "startup";
    // Expand only when sold out (the same signal that makes auto-pricing raise prices).
    const demandSignal = (sold + internal) >= produced * (growthMode ? 0.8 : 0.9) && inv - (c.inputUse[g] ?? 0) < Math.max(produced, 1) * (growthMode ? 0.5 : 0.3);
    const priceOk = price >= def.refPrice * (growthMode ? 0.85 : 0.9) || (price - unitCost) / price > 0.35;
    if (demandSignal && priceOk && avgStaff > 0.8 && payback < (growthMode ? 60 : 48) && building < levels * 0.15 + 1) {
      const add = Math.max(1, Math.round(levels * 0.08));
      const cost = buildCostPerLevel(s, template.type, template.city, template.method, true, c) * add;
      if (liquidity(c) > cost * 1.5) {
        const st = rand(s) < 0.5 && !permitBlock(s, template.city, c, template.type) ? template.city : bestCity(s, c, template.type, template.method);
        build(s, c.id, template.type, st, add, template.method);
      }
    } else if (inv > 3 * Math.max(sold + internal, 1) && price <= Math.max(def.refPrice * 0.31, unitCost * 1.03) && levels > 2) {
      const biggest = ops.sort((a, b) => b.level - a.level)[0];
      if (biggest) downsize(s, c.id, biggest.id, Math.max(1, Math.round(levels * 0.05)));
    }
  }

  // Keep R&D in line with the company's target intensity.
  const rev = last.revenue;
  if (rev > 0 && c.kind !== "startup") {
    const lab = c.buildings.find((b) => b.type === "rnd");
    // A lab level's full monthly cost (estimated from the payroll if there's no lab yet).
    const perLevel = lab && lab.level > 0 ? lab.lastWages / lab.level + (methodOf("rnd", "rnd").upkeep ?? 0) : labLevelCost();
    const want = (c.rndIntensity * rev) / Math.max(1, perLevel);
    const have = c.buildings.filter((b) => b.type === "rnd").reduce((a, b) => a + b.level + b.construction.reduce((x, j) => x + j.levels, 0), 0);
    if (want >= 0.75 && want > have * 1.1) {
      const add = Math.max(1, Math.round(Math.min(want - have, have * 0.08 + 1)));
      if (liquidity(c) > buildCostPerLevel(s, "rnd", lab?.city ?? c.hqSite.city) * add * 2) build(s, c.id, "rnd", lab?.city ?? c.hqSite.city, add);
    }
  }

  maintainHQ(s, c);

  // Return excess cash.
  if (c.debt < c.cash && c.cash > 8 * costs && c.kind !== "startup") buyback(s, c.id, (c.cash - 5 * costs) * 0.5);

  // Occasional acquisitions by cash-rich incumbents.
  if (c.kind === "incumbent" && rand(s) < 0.03 && c.cash > 5e9 && !s.deals.some((d) => d.buyerId === c.id)) {
    const myGoods = new Set(goods.keys());
    const targets = s.companies.filter((t) =>
      t.alive && !t.isPlayer && t !== c && t.kind !== "incumbent" && t.marketCap < c.marketCap * 0.02 &&
      Object.keys(t.prices).some((g) => myGoods.has(g as GoodId)) && !antitrustIssue(s, c, t) &&
      acquisitionPrice(t) < c.cash * 0.8,
    );
    if (targets.length) offer(s, c.id, targets[Math.floor(rand(s) * targets.length)].id, 0.35 + rand(s) * 0.25, "cash");
  }

}

function labLevelCost(): number {
  const m = methodOf("rnd", "rnd");
  let w = m.upkeep ?? 0;
  for (const [j, n] of Object.entries(m.staff)) w += (n ?? 0) * JOB_BY_ID[j as JobId].baseWage * 1.1;
  return w;
}
