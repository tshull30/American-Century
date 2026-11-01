// Rival company behavior. Simple heuristics; the same action functions the player uses.
import { BUILDING_BY_ID, methodOf, type BuildingTypeId } from "./data/buildings";
import { GOOD_BY_ID, type GoodId } from "./data/goods";
import { STATES } from "./data/states";
import {
  acquire, acquisitionPrice, antitrustIssue, borrow, build, buyback, downsize, issueShares, liquidity, repay,
} from "./actions";
import { adminCapacity, adminLoad, buildCostPerLevel, creditLimit } from "./engine";
import type { Building, Company, GameState } from "./types";
import { clamp, laborKey, rand } from "./util";

/** Nudge price toward where production and sales balance, never below cost. */
export function autoPrice(_s: GameState, c: Company, g: GoodId) {
  const last = c.history[c.history.length - 1];
  if (!last) return;
  const def = GOOD_BY_ID[g];
  let produced = 0;
  for (const b of c.buildings) produced += b.lastOutput[g] ?? 0;
  const sold = (last.unitsSold[g] ?? 0) + (c.inputUse[g] ?? 0);
  const inv = Math.max(0, (c.inventory[g] ?? 0) - (c.inputUse[g] ?? 0));
  const p = c.prices[g] ?? def.refPrice;
  let next = p;
  if (produced <= 0 && sold <= 0) return;
  // Services can't be stockpiled (unsold capacity just vanishes), so watch sell-through as well as stock.
  const unsold = sold < produced * 0.85;
  if (inv > 1.2 * Math.max(sold, produced * 0.5) || unsold) next = p * 0.97;
  else if (inv < 0.25 * Math.max(produced, 1) && sold >= produced * 0.95) next = p * 1.025;
  const floor = Math.max(def.refPrice * 0.3, (c.unitCost[g] ?? 0) * 1.02);
  next = clamp(next, floor, def.refPrice * 3);
  if (def.importPrice && def.intermediate) next = Math.min(next, def.importPrice * 0.99);
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

/** Best state for a building: big labor pools in its key job, at low wages. Favors states where the company already operates. */
export function bestState(s: GameState, c: Company, type: BuildingTypeId, method: string): string {
  const m = methodOf(type, method);
  const jobs = Object.entries(m.staff).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 2);
  let best = c.hq;
  let bestScore = -Infinity;
  const present = new Set(c.buildings.map((b) => b.state));
  for (const st of STATES) {
    let score = 0;
    for (const [j, n] of jobs) {
      const cell = s.labor[laborKey(st.code, j)];
      if (!cell) continue;
      const free = Math.max(0, cell.workforce - cell.gameEmployed);
      score += (n ?? 0) * Math.log(1 + free) - (n ?? 0) * 3 * (cell.wage / 5000);
    }
    score -= buildCostPerLevel(type, st.code) / BUILDING_BY_ID[type].cost;
    if (present.has(st.code)) score += 4;
    score += rand(s) * 2;
    if (score > bestScore) { bestScore = score; best = st.code; }
  }
  return best;
}

export function runAI(s: GameState, c: Company, o: { warmup: boolean }) {
  // Finance housekeeping every month.
  const costs = monthlyCosts(c);
  if (c.cash < 2 * costs) {
    const room = creditLimit(c) - c.debt;
    if (room > 0) borrow(s, c.id, Math.min(room, 3 * costs - c.cash));
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
    const internal = c.inputUse[g] ?? 0;
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
    const demandSignal = (sold + internal) >= produced * (growthMode ? 0.8 : 0.9) && inv - internal < Math.max(produced, 1) * (growthMode ? 0.5 : 0.3);
    const priceOk = price >= def.refPrice * (growthMode ? 0.85 : 0.9) || (price - unitCost) / price > 0.35;
    if (demandSignal && priceOk && avgStaff > 0.8 && payback < (growthMode ? 60 : 48) && building < levels * 0.15 + 1) {
      const add = Math.max(1, Math.round(levels * 0.06));
      const cost = buildCostPerLevel(template.type, template.state) * add;
      if (liquidity(c) > cost * 1.5) {
        const st = rand(s) < 0.6 ? template.state : bestState(s, c, template.type, template.method);
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
    const perLevel = (lab?.lastWages ?? 0) / Math.max(1, lab?.level ?? 1) + (methodOf("rnd", "rnd").upkeep ?? 0);
    const want = (c.rndIntensity * rev) / Math.max(1, perLevel);
    const have = c.buildings.filter((b) => b.type === "rnd").reduce((a, b) => a + b.level + b.construction.reduce((x, j) => x + j.levels, 0), 0);
    if (want > have * 1.1) {
      const add = Math.max(1, Math.round(Math.min(want - have, have * 0.08 + 1)));
      if (liquidity(c) > buildCostPerLevel("rnd", lab?.state ?? c.hq) * add * 2) build(s, c.id, "rnd", lab?.state ?? c.hq, add);
    }
  }

  // Headquarters keeps pace with the company's size.
  const load = adminLoad(c);
  const cap = adminCapacity(c);
  const hqBuilding = c.buildings.filter((b) => b.type === "hq").reduce((a, b) => a + b.construction.reduce((x, j) => x + j.levels, 0), 0);
  if (load > cap * 0.95 && hqBuilding === 0) {
    const add = Math.ceil((load * 1.1 - cap) / 15);
    if (add > 0 && liquidity(c) > buildCostPerLevel("hq", c.hq) * add) build(s, c.id, "hq", c.hq, add);
  }

  // Return excess cash.
  if (c.debt < c.cash && c.cash > 8 * costs && c.kind !== "startup") buyback(s, c.id, (c.cash - 5 * costs) * 0.5);

  // Occasional acquisitions by cash-rich incumbents.
  if (c.kind === "incumbent" && rand(s) < 0.04 && c.cash > 5e9) {
    const myGoods = new Set(goods.keys());
    const targets = s.companies.filter((t) =>
      t.alive && !t.isPlayer && t !== c && t.kind !== "incumbent" && t.marketCap < c.marketCap * 0.02 &&
      Object.keys(t.prices).some((g) => myGoods.has(g as GoodId)) && !antitrustIssue(s, c, t) &&
      acquisitionPrice(t) < c.cash * 0.8,
    );
    if (targets.length) acquire(s, c.id, targets[Math.floor(rand(s) * targets.length)].id, "cash");
  }

}
