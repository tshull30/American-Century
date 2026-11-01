// Household demand: pops spend their income across needs, needs are met by goods,
// and how well needs are met gives each pop a standard of living.
import { GOODS, GOOD_BY_ID, type GoodId } from "./data/goods";
import { NEEDS, type NeedId } from "./data/needs";
import { demandMult, eventDemandMult, eventPrefMult } from "./macro";
import { climatePrefMult, lawDemandMult } from "./politics";
import type { GameState, NeedStats } from "./types";
import { clamp } from "./util";
import { stateWage } from "./geo";

const BUSINESS_GOODS = GOODS.filter((g) => g.buyerJobs && g.marketUS > 0);
const AVG_WAGE = 5200;

/** Monthly income per person (workers' wages shared with dependents). */
function incomePerCapita(s: GameState, i: number): number {
  const p = s.pops[i];
  const wage = stateWage(s, p.state, p.job);
  return (wage * p.workers) / (p.workers + p.dependents);
}

function nationalAvgIncome(s: GameState, inc: number[]): number {
  let tot = 0, ppl = 0;
  s.pops.forEach((p, i) => { const n = p.workers + p.dependents; tot += inc[i] * n; ppl += n; });
  return tot / ppl;
}

/** Sets need budgets and in-need preferences so 2026 US household spending matches each market's size. */
export function calibrateConsumers(s: GameState) {
  const inc = s.pops.map((_, i) => incomePerCapita(s, i));
  const avg = nationalAvgIncome(s, inc);
  for (const n of NEEDS) {
    const target = n.goods.reduce((a, g) => a + GOOD_BY_ID[g].marketUS / 12, 0);
    let base = 0;
    s.pops.forEach((p, i) => { base += (p.workers + p.dependents) * inc[i] * Math.pow(inc[i] / avg, n.incomeElasticity - 1); });
    s.needShare[n.id] = target / base;
    for (const g of n.goods) s.needPref[g] = GOOD_BY_ID[g].marketUS / 12 / target;
  }
  for (const g of BUSINESS_GOODS) {
    const sp = businessSpendingPower(s, g.id);
    s.demandScale[g.id] = sp > 0 ? g.marketUS / 12 / g.refPrice / sp : 0;
  }
  s.solNorm = 1;
  updateConsumers(s);
  s.solNorm = s.sol / 100;
}

function businessSpendingPower(s: GameState, good: GoodId): number {
  const g = GOOD_BY_ID[good];
  const jobs = new Set(g.buyerJobs);
  let total = 0;
  for (const p of s.pops) {
    if (!jobs.has(p.job)) continue;
    const wage = stateWage(s, p.state, p.job);
    total += p.workers * Math.pow(wage / AVG_WAGE, g.incomeElasticity);
  }
  return total;
}

/** Recomputes US demand for every good and every pop's need satisfaction. Runs monthly. */
export function updateConsumers(s: GameState) {
  const macro = demandMult(s);
  const inc = s.pops.map((_, i) => incomePerCapita(s, i));
  const avg = nationalAvgIncome(s, inc);
  const usDemand: Partial<Record<GoodId, number>> = {};

  // Within each need: split spending across its goods by preference and relative price.
  const split: Partial<Record<GoodId, number>> = {};
  const priceIndex: Partial<Record<NeedId, number>> = {};
  for (const n of NEEDS) {
    let tot = 0;
    const w: Partial<Record<GoodId, number>> = {};
    for (const g of n.goods) {
      const def = GOOD_BY_ID[g];
      const rel = (s.markets[g]?.avgPrice ?? def.refPrice) / def.refPrice;
      w[g] = (s.needPref[g] ?? 0) * climatePrefMult(s, g) * eventPrefMult(s, g) * Math.pow(rel, -2);
      tot += w[g]!;
    }
    let pi = 0;
    for (const g of n.goods) {
      split[g] = tot > 0 ? w[g]! / tot : 1 / n.goods.length;
      pi += split[g]! * ((s.markets[g]?.avgPrice ?? GOOD_BY_ID[g].refPrice) / GOOD_BY_ID[g].refPrice);
    }
    priceIndex[n.id] = pi;
  }

  const tilted = NEEDS.map((n) => n.goods.some((g) => GOOD_BY_ID[g].tilt));
  const order = s.pops.map((_, i) => i).sort((a, b) => inc[a] - inc[b]);
  const totalPeople = s.pops.reduce((a, p) => a + p.workers + p.dependents, 0);
  const quint: { sat: number[]; n: number }[] = Array.from({ length: 5 }, () => ({ sat: NEEDS.map(() => 0), n: 0 }));
  const spending: Partial<Record<NeedId, number>> = {};
  let cum = 0, solSum = 0;
  const wsum = NEEDS.reduce((a, n) => a + n.weight, 0);
  for (const i of order) {
    const p = s.pops[i];
    const people = p.workers + p.dependents;
    const q = Math.min(4, Math.floor((cum / totalPeople) * 5));
    cum += people;
    let sol = 0;
    p.sat = NEEDS.map((n, k) => {
      const share = s.needShare[n.id] ?? 0;
      const rel = Math.pow(inc[i] / avg, n.incomeElasticity - 1);
      const perPerson = inc[i] * share * rel * macro;
      const spend = perPerson * people;
      spending[n.id] = (spending[n.id] ?? 0) + spend;
      if (tilted[k]) {
        // Segments: richer pops lean toward premium goods within the need, poorer ones toward budget goods.
        const r = inc[i] / avg;
        let tw = 0;
        for (const g of n.goods) tw += split[g]! * Math.pow(r, GOOD_BY_ID[g].tilt ?? 0);
        for (const g of n.goods) usDemand[g] = (usDemand[g] ?? 0) + (spend * split[g]! * Math.pow(r, GOOD_BY_ID[g].tilt ?? 0)) / tw / GOOD_BY_ID[g].refPrice;
      } else for (const g of n.goods) usDemand[g] = (usDemand[g] ?? 0) + (spend * split[g]!) / GOOD_BY_ID[g].refPrice;
      const standard = share * avg;
      const sat = clamp(perPerson / (priceIndex[n.id]! * standard), 0, 2);
      quint[q].sat[k] += sat * people;
      sol += n.weight * Math.min(1.3, sat);
      return Math.round(sat * 1000) / 1000;
    });
    p.sol = Math.round((100 * sol) / wsum / (s.solNorm || 1));
    quint[q].n += people;
    solSum += p.sol * people;
  }
  s.sol = solSum / totalPeople;
  NEEDS.forEach((n, k) => {
    const st: NeedStats = { byQuintile: quint.map((x) => (x.n ? x.sat[k] / x.n : 0)), priceIndex: priceIndex[n.id]!, spending: spending[n.id] ?? 0 };
    s.needStats[n.id] = st;
  });

  for (const g of BUSINESS_GOODS) {
    usDemand[g.id] = (s.demandScale[g.id] ?? 0) * businessSpendingPower(s, g.id) * macro;
  }
  for (const g of GOODS) {
    if (usDemand[g.id] !== undefined) usDemand[g.id]! *= lawDemandMult(s, g.id) * eventDemandMult(s, g.id);
  }
  s.usDemand = usDemand;
}

/** Slow shifts in taste within needs (EVs gaining on gas cars, streaming on everything else). */
export function driftPreferences(s: GameState) {
  for (const n of NEEDS) {
    let tot = 0;
    for (const g of n.goods) {
      s.needPref[g] = (s.needPref[g] ?? 0) * (1 + (GOOD_BY_ID[g].prefDrift ?? 0) / 12);
      tot += s.needPref[g]!;
    }
    if (n.goods.length > 1 && tot > 0) for (const g of n.goods) s.needPref[g]! /= tot;
  }
}
