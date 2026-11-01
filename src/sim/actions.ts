// Things a company can do. The player's UI and the AI rivals both go through these.
import { BUILDING_BY_ID, methodOf, type BuildingTypeId } from "./data/buildings";
import { GOOD_BY_ID, type GoodId, type TechId } from "./data/goods";
import { STATE_BY_CODE } from "./data/states";
import {
  addBuilding, buildCostPerLevel, creditLimit, log, queueConstruction, releaseCompany,
} from "./engine";
import type { Company, GameState } from "./types";
import { fmtMoney } from "./util";

export interface Result { ok: boolean; message: string }
const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

export function company(s: GameState, id: number): Company {
  const c = s.companies.find((x) => x.id === id);
  if (!c) throw new Error(`No company ${id}`);
  return c;
}

/** Cash plus untapped credit. */
export function liquidity(c: Company): number {
  return c.cash + Math.max(0, creditLimit(c) - c.debt);
}

export function buildQuote(type: BuildingTypeId, state: string, levels: number) {
  const def = BUILDING_BY_ID[type];
  const total = buildCostPerLevel(type, state) * levels;
  return { total, months: def.buildTime, monthly: total / def.buildTime };
}

export function build(s: GameState, cid: number, type: BuildingTypeId, state: string, levels: number, method?: string): Result {
  const c = company(s, cid);
  if (levels <= 0) return fail("Pick at least one level.");
  if (!STATE_BY_CODE[state]) return fail("Unknown state.");
  const q = buildQuote(type, state, levels);
  if (q.total > liquidity(c)) return fail(`Not enough cash or credit: needs ${fmtMoney(q.total)}.`);
  const m = method ?? BUILDING_BY_ID[type].methods[0].id;
  let b = c.buildings.find((x) => x.type === type && x.state === state && x.method === m);
  if (!b) b = addBuilding(s, c, type, state, 0, m);
  queueConstruction(s, c, b, levels);
  for (const g of Object.keys(methodOf(type, m).output) as GoodId[]) ensureSells(s, c, g);
  return ok(`Started ${levels} level${levels > 1 ? "s" : ""} of ${BUILDING_BY_ID[type].name} in ${STATE_BY_CODE[state].name} (${fmtMoney(q.total)} over ${q.months} months).`);
}

export function expand(s: GameState, cid: number, bid: number, levels: number): Result {
  const c = company(s, cid);
  const b = c.buildings.find((x) => x.id === bid);
  if (!b) return fail("No such building.");
  return build(s, cid, b.type, b.state, levels, b.method);
}

export function downsize(s: GameState, cid: number, bid: number, levels: number): Result {
  const c = company(s, cid);
  const b = c.buildings.find((x) => x.id === bid);
  if (!b) return fail("No such building.");
  const n = Math.min(levels, b.level);
  if (n <= 0) return fail("Nothing to close.");
  const def = BUILDING_BY_ID[b.type];
  b.level -= n;
  // Write off the book value of the closed levels; recover 20% as salvage.
  const book = buildCostPerLevel(b.type, b.state) * n * 0.6;
  c.ppe = Math.max(0, c.ppe - book);
  c.cash += book * 0.2;
  if (b.level <= 0 && b.construction.length === 0) c.buildings = c.buildings.filter((x) => x !== b);
  return ok(`Closed ${n} level${n > 1 ? "s" : ""} of ${def.name} in ${STATE_BY_CODE[b.state].name}. Workers will be laid off.`);
}

export function setMethod(s: GameState, cid: number, bid: number, method: string): Result {
  const c = company(s, cid);
  const b = c.buildings.find((x) => x.id === bid);
  if (!b) return fail("No such building.");
  const m = methodOf(b.type, method);
  if (m.id === b.method) return fail("Already using that method.");
  const cost = buildCostPerLevel(b.type, b.state) * b.level * (m.retoolCost ?? 0.2);
  if (cost > liquidity(c)) return fail(`Retooling costs ${fmtMoney(cost)}.`);
  c.cash -= cost;
  c.ppe += cost;
  b.method = m.id;
  for (const g of Object.keys(m.output) as GoodId[]) ensureSells(s, c, g);
  return ok(`Retooled to ${m.name} for ${fmtMoney(cost)}.`);
}

export function ensureSells(_s: GameState, c: Company, g: GoodId) {
  if (!c.prices[g]) {
    c.prices[g] = GOOD_BY_ID[g].refPrice;
    c.autoPrice[g] = true;
  }
  if (c.brand[g] === undefined) c.brand[g] = 0.00001;
  if (c.reputation[g] === undefined) c.reputation[g] = 1;
  const t = GOOD_BY_ID[g].tech;
  if (t && c.researchAlloc[t] === undefined) c.researchAlloc[t] = 5;
}

export function setPrice(s: GameState, cid: number, g: GoodId, price: number): Result {
  const c = company(s, cid);
  c.prices[g] = Math.max(0.01, price);
  c.autoPrice[g] = false;
  return ok(`${GOOD_BY_ID[g].name} price set.`);
}

export function setAutoPrice(s: GameState, cid: number, g: GoodId, on: boolean): Result {
  company(s, cid).autoPrice[g] = on;
  return ok(on ? "Auto-pricing on." : "Auto-pricing off.");
}

export function setWagePolicy(s: GameState, cid: number, v: number): Result {
  company(s, cid).wagePolicy = Math.min(2, Math.max(0.7, v));
  return ok("Wage policy updated.");
}

export function setMarketing(s: GameState, cid: number, v: number): Result {
  company(s, cid).marketingPct = Math.min(0.3, Math.max(0, v));
  return ok("Marketing budget updated.");
}

export function setResearchAlloc(s: GameState, cid: number, t: TechId, w: number): Result {
  company(s, cid).researchAlloc[t] = Math.max(0, w);
  return ok("Research priorities updated.");
}

export function borrow(s: GameState, cid: number, amount: number): Result {
  const c = company(s, cid);
  const room = creditLimit(c) - c.debt;
  if (amount > room) return fail(`Lenders will only extend ${fmtMoney(Math.max(0, room))} more.`);
  c.debt += amount;
  c.cash += amount;
  return ok(`Borrowed ${fmtMoney(amount)}.`);
}

export function repay(s: GameState, cid: number, amount: number): Result {
  const c = company(s, cid);
  const a = Math.min(amount, c.debt, c.cash);
  if (a <= 0) return fail("Nothing to repay.");
  c.debt -= a;
  c.cash -= a;
  return ok(`Repaid ${fmtMoney(a)}.`);
}

/** Sell new shares: raise cash at a discount, diluting existing holders. */
export function issueShares(s: GameState, cid: number, fraction: number): Result {
  const c = company(s, cid);
  const f = Math.min(0.3, Math.max(0.01, fraction));
  const price = (c.marketCap / c.shares) * 0.92;
  const newShares = c.shares * f;
  const raised = newShares * price;
  c.shares += newShares;
  c.cash += raised;
  c.marketCap += raised;
  c.hype *= 0.97;
  if (c.isPlayer) log(s, `${c.name} sold ${(f * 100).toFixed(0)}% new shares, raising ${fmtMoney(raised)}.`, "deal", c.id);
  return ok(`Raised ${fmtMoney(raised)}.`);
}

export function buyback(s: GameState, cid: number, amount: number): Result {
  const c = company(s, cid);
  const a = Math.min(amount, c.cash);
  if (a <= 0) return fail("No cash for a buyback.");
  const price = (c.marketCap / c.shares) * 1.02;
  const retired = Math.min(c.shares * 0.5, a / price);
  c.shares -= retired;
  c.cash -= retired * price;
  c.marketCap -= retired * price;
  return ok(`Bought back ${fmtMoney(retired * price)} of stock.`);
}

export const ACQUISITION_PREMIUM = 1.3;

export function acquisitionPrice(target: Company): number {
  return target.marketCap * ACQUISITION_PREMIUM;
}

/** Antitrust: block deals that would give the buyer more than 40% of a market both already sell in. */
export function antitrustIssue(s: GameState, buyer: Company, target: Company): string | null {
  for (const [g, snap] of Object.entries(s.markets)) {
    if (!snap) continue;
    const a = snap.sales[buyer.id]?.share ?? 0;
    const b = snap.sales[target.id]?.share ?? 0;
    if (a > 0.02 && b > 0.02 && a + b > 0.4) return `Regulators would block it: combined ${GOOD_BY_ID[g as GoodId].name} share of ${((a + b) * 100).toFixed(0)}%.`;
  }
  return null;
}

export function acquire(s: GameState, buyerId: number, targetId: number, payment: "cash" | "stock"): Result {
  const buyer = company(s, buyerId);
  const target = company(s, targetId);
  if (!target.alive || buyer === target) return fail("Invalid target.");
  if (target.isPlayer) return fail("You can't buy the player.");
  const price = acquisitionPrice(target);
  const block = antitrustIssue(s, buyer, target);
  if (block) return fail(block);
  if (payment === "cash") {
    if (price > liquidity(buyer)) return fail(`Needs ${fmtMoney(price)} in cash and credit.`);
    buyer.cash -= price;
    if (buyer.cash < 0) { buyer.debt += -buyer.cash; buyer.cash = 0; }
  } else {
    if (price > buyer.marketCap * 0.5) return fail("Paying in stock would more than halve your ownership. Shareholders refuse.");
    const sp = buyer.marketCap / buyer.shares;
    buyer.shares += price / sp;
    buyer.marketCap += price;
  }
  mergeInto(s, buyer, target);
  log(s, `${buyer.name} acquired ${target.name} for ${fmtMoney(price)} (${payment}).`, "deal", buyer.id);
  return ok(`Acquired ${target.name} for ${fmtMoney(price)}.`);
}

function mergeInto(s: GameState, buyer: Company, target: Company) {
  for (const b of target.buildings) {
    const same = buyer.buildings.find((x) => x.type === b.type && x.state === b.state && x.method === b.method);
    if (same && b.type !== "hq") {
      same.level += b.level;
      same.construction.push(...b.construction);
    } else if (b.type === "hq" && same) {
      same.level += b.level;
    } else {
      buyer.buildings.push(b);
    }
  }
  target.buildings = [];
  buyer.ppe += target.ppe;
  buyer.cash += target.cash;
  buyer.debt += target.debt;
  for (const [g, q] of Object.entries(target.inventory)) buyer.inventory[g as GoodId] = (buyer.inventory[g as GoodId] ?? 0) + (q ?? 0);
  for (const [g, p] of Object.entries(target.prices) as [GoodId, number][]) {
    if (!buyer.prices[g]) { buyer.prices[g] = p; buyer.autoPrice[g] = true; }
    buyer.brand[g] = (buyer.brand[g] ?? 0) + (target.brand[g] ?? 0);
    buyer.reputation[g] = Math.max(buyer.reputation[g] ?? 0, target.reputation[g] ?? 0);
  }
  for (const [t, lv] of Object.entries(target.tech) as [TechId, number][]) buyer.tech[t] = Math.max(buyer.tech[t] ?? 0, lv);
  for (const [t, w] of Object.entries(target.researchAlloc) as [TechId, number][]) if (buyer.researchAlloc[t] === undefined) buyer.researchAlloc[t] = w;
  for (const [k, n] of Object.entries(target.employees)) buyer.employees[k] = (buyer.employees[k] ?? 0) + n;
  target.employees = {};
  // History: add target revenue into the buyer's past so growth isn't wildly overstated.
  const offset = buyer.history.length - target.history.length;
  target.history.forEach((h, i) => {
    const bh = buyer.history[i + offset];
    if (!bh) return;
    bh.revenue += h.revenue;
    bh.netIncome += h.netIncome;
  });
  releaseCompany(s, target);
}
