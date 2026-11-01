import { boardVote, needsVote, recordBuyback } from "./leadership";
// Things a company can do. The player's UI and the AI rivals both go through these.
import { BUILDING_BY_ID, methodOf, type BuildingTypeId } from "./data/buildings";
import { GOOD_BY_ID, type GoodId, type TechId } from "./data/goods";
import type { LawId, PartyId } from "./data/laws";
import { antitrustCap, donate as donateImpl } from "./politics";
import { foundPac as foundPacImpl, fundPac as fundPacImpl, pacRace as pacRaceImpl, pacSpend as pacSpendImpl } from "./congress";
import { BREAK_FEE, makeOffer } from "./deals";
import { permitBlock } from "./geo";
import { AMENITY_BY_ID, amenityCost, HQ_FORMS, hqLevels, towerAllowed } from "./hq";
import type { AmenityId, HqForm } from "./types";
import { STATE_BY_CODE } from "./data/states";
import {
  addBuilding, buildCostPerLevel, creditLimit, log, queueConstruction, releaseCompany,
} from "./engine";
import { permitMult } from "./geo";
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

export function buildQuote(s: GameState, type: BuildingTypeId, city: string, levels: number, method?: string, c?: Company) {
  const def = BUILDING_BY_ID[type];
  const total = buildCostPerLevel(s, type, city, method, true, c) * levels;
  const unsubsidized = buildCostPerLevel(s, type, city, method, false, c) * levels;
  const months = def.buildTime * (c ? permitMult(s, city, c) : 1);
  return { total, unsubsidized, months, monthly: total / months };
}

export function build(s: GameState, cid: number, type: BuildingTypeId, city: string, levels: number, method?: string): Result {
  const c = company(s, cid);
  if (levels <= 0) return fail("Pick at least one level.");
  const where = s.cities[city];
  if (!where) return fail("Unknown city.");
  const block = permitBlock(s, city, c, type);
  if (block) return fail(block);
  const m = method ?? BUILDING_BY_ID[type].methods[0].id;
  const q = buildQuote(s, type, city, levels, m, c);
  if (q.total > liquidity(c)) return fail(`Not enough cash or credit: needs ${fmtMoney(q.total)}.`);
  if (needsVote(c, "megaproject", q.total)) {
    const v = boardVote(s, c, "megaproject", `${levels} levels of ${BUILDING_BY_ID[type].name} (${fmtMoney(q.total)})`);
    if (!v.ok) return fail(v.message);
  }
  let b = c.buildings.find((x) => x.type === type && x.city === city && x.method === m);
  if (!b) b = addBuilding(s, c, type, city, 0, m);
  queueConstruction(s, c, b, levels);
  for (const g of Object.keys(methodOf(type, m).output) as GoodId[]) ensureSells(s, c, g);
  return ok(`Started ${levels} level${levels > 1 ? "s" : ""} of ${BUILDING_BY_ID[type].name} in ${where.name} (${fmtMoney(q.total)} over ${q.months.toFixed(1)} months).`);
}

export function expand(s: GameState, cid: number, bid: number, levels: number): Result {
  const c = company(s, cid);
  const b = c.buildings.find((x) => x.id === bid);
  if (!b) return fail("No such building.");
  return build(s, cid, b.type, b.city, levels, b.method);
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
  const book = buildCostPerLevel(s, b.type, b.city, b.method, false) * n * 0.6;
  c.ppe = Math.max(0, c.ppe - book);
  c.cash += book * 0.2;
  if (b.level <= 0 && b.construction.length === 0) c.buildings = c.buildings.filter((x) => x !== b);
  return ok(`Closed ${n} level${n > 1 ? "s" : ""} of ${def.name} in ${s.cities[b.city]?.name ?? STATE_BY_CODE[b.state].name}. Workers will be laid off.`);
}

export function setMethod(s: GameState, cid: number, bid: number, method: string): Result {
  const c = company(s, cid);
  const b = c.buildings.find((x) => x.id === bid);
  if (!b) return fail("No such building.");
  const m = methodOf(b.type, method);
  if (m.id === b.method) return fail("Already using that method.");
  const cost = buildCostPerLevel(s, b.type, b.city, m.id, false) * b.level * (m.retoolCost ?? 0.2);
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
  if (c.image === undefined) c.image = 0.6;
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
  if (needsVote(c, "issuance", f)) {
    const v = boardVote(s, c, "issuance", `${(f * 100).toFixed(0)}% new shares`);
    if (!v.ok) return fail(v.message);
  }
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
  recordBuyback(c, retired * price);
  return ok(`Bought back ${fmtMoney(retired * price)} of stock.`);
}

export function acquisitionPrice(target: Company, premium = 0.35): number {
  return target.marketCap * (1 + premium);
}

/** Antitrust hard limit: deals that would push the buyer past the legal cap in a shared market. */
export function antitrustIssue(s: GameState, buyer: Company, target: Company): string | null {
  const cap = antitrustCap(s);
  for (const [g, snap] of Object.entries(s.markets)) {
    if (!snap) continue;
    const a = snap.sales[buyer.id]?.share ?? 0;
    const b = snap.sales[target.id]?.share ?? 0;
    if (a > 0.02 && b > 0.02 && a + b > cap) return `Regulators would block it: combined ${GOOD_BY_ID[g as GoodId].name} share of ${((a + b) * 100).toFixed(0)}% (limit ${(cap * 100).toFixed(0)}%).`;
  }
  return null;
}

/** Make a takeover offer at a premium. The board decides now; regulators and closing take months. */
export function offer(s: GameState, buyerId: number, targetId: number, premium: number, payment: "cash" | "stock"): Result {
  const buyer = company(s, buyerId);
  const target = company(s, targetId);
  if (!target.alive || buyer === target) return fail("Invalid target.");
  if (target.isPlayer) return fail("You can't buy the player.");
  const est = target.marketCap * (1 + premium);
  if (needsVote(buyer, "acquisition", est)) {
    const v = boardVote(s, buyer, "acquisition", `${target.name} for ${fmtMoney(est)}`);
    if (!v.ok) return fail(v.message);
  }
  const r = makeOffer(s, buyer, target, premium, payment, liquidity(buyer));
  if (r.ok && (buyer.isPlayer || target.marketCap > 5e9)) log(s, r.message.replace(`${target.name}'s board`, `${target.name}'s board`).replace(/^/, `${buyer.name} → ${target.name}: `), "deal", buyer.id, target.isPlayer ? "deal" : undefined);
  return { ok: r.ok, message: r.message };
}

/** Advance pending deals; close or kill them when their review ends. */
export function processDeals(s: GameState) {
  for (const d of s.deals) {
    d.daysLeft--;
  }
  const done = s.deals.filter((d) => d.daysLeft <= 0);
  s.deals = s.deals.filter((d) => d.daysLeft > 0);
  for (const d of done) {
    const buyer = s.companies.find((c) => c.id === d.buyerId);
    const target = s.companies.find((c) => c.id === d.targetId);
    if (!buyer?.alive || !target?.alive) continue;
    const fee = d.price * BREAK_FEE;
    if (d.stage === "second_request" && seededBlock(s, d.blockChance)) {
      buyer.cash -= fee; target.cash += fee;
      if (buyer.cash < 0) { buyer.debt += -buyer.cash; buyer.cash = 0; }
      log(s, `Regulators sued to block ${buyer.name}'s takeover of ${target.name}; the deal is dead. ${buyer.name} pays a ${fmtMoney(fee)} break fee.`, "deal", buyer.id, buyer.isPlayer || target.isPlayer ? "deal" : undefined);
      continue;
    }
    if (d.payment === "cash") {
      if (d.price > liquidity(buyer)) {
        buyer.cash -= fee; target.cash += fee;
        log(s, `${buyer.name} couldn't finance its ${fmtMoney(d.price)} takeover of ${target.name} at closing and paid a ${fmtMoney(fee)} break fee.`, "deal", buyer.id, buyer.isPlayer || target.isPlayer ? "deal" : undefined);
        continue;
      }
      buyer.cash -= d.price;
      if (buyer.cash < 0) { buyer.debt += -buyer.cash; buyer.cash = 0; }
    } else {
      const sp = buyer.marketCap / buyer.shares;
      buyer.shares += d.price / sp;
      buyer.marketCap += d.price;
    }
    mergeInto(s, buyer, target);
    log(s, `${buyer.name} completed its ${fmtMoney(d.price)} acquisition of ${target.name}.`, "deal", buyer.id, buyer.isPlayer || target.isPlayer ? "deal" : undefined);
  }
}

import { rand as seededRand } from "./util";
function seededBlock(s: GameState, p: number) { return seededRand(s) < p; }

export function pendingDeals(s: GameState, cid: number) {
  return s.deals.filter((d) => d.buyerId === cid);
}

function mergeInto(s: GameState, buyer: Company, target: Company) {
  for (const b of target.buildings) {
    if (b.type === "hq") {
      // The target's head office becomes regular office space folded into the buyer's HQ.
      const hq = buyer.buildings.find((x) => x.type === "hq");
      if (hq) { hq.level += b.level; continue; }
    }
    const same = buyer.buildings.find((x) => x.type === b.type && x.city === b.city && x.method === b.method);
    if (same) {
      same.level += b.level;
      same.construction.push(...b.construction);
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
  buyer.knowhow ??= {};
  for (const [k, v] of Object.entries(target.knowhow ?? {})) buyer.knowhow[k as keyof typeof buyer.knowhow] = Math.max(buyer.knowhow[k as keyof typeof buyer.knowhow] ?? 0, v ?? 0);
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

export function setDividend(s: GameState, cid: number, pct: number): Result {
  company(s, cid).dividendPct = Math.min(1, Math.max(0, pct));
  return ok("Dividend policy updated.");
}

/** Set (or clear, with monthly = 0) a standing lobbying campaign on a law. */
export function setLobbying(s: GameState, cid: number, law: LawId, dir: 1 | -1, monthly: number): Result {
  const c = company(s, cid);
  c.lobbying = c.lobbying.filter((l) => l.law !== law);
  if (monthly > 0) c.lobbying.push({ law, dir, monthly });
  return ok(monthly > 0 ? `Lobbying ${fmtMoney(monthly)} a month.` : "Lobbying stopped.");
}

export function donate(s: GameState, cid: number, party: PartyId, amount: number): Result {
  const c = company(s, cid);
  if (amount > c.cash) return fail("Not enough cash.");
  return ok(donateImpl(s, c, party, amount));
}

export function foundPac(s: GameState, cid: number, name: string): Result {
  const c = company(s, cid);
  if (c.pac) return fail("You already run a PAC.");
  if (c.cash < 2e6) return fail("Registering a PAC costs $2M in legal and compliance fees.");
  return ok(foundPacImpl(s, c, name.trim() || `${c.name} PAC`));
}

export function fundPac(s: GameState, cid: number, amount: number): Result {
  const c = company(s, cid);
  if (!c.pac) return fail("Found a PAC first.");
  if (amount > c.cash) return fail("Not enough cash.");
  return ok(fundPacImpl(c, amount));
}

export function pacSpend(s: GameState, cid: number, politicianId: string, amount: number, mode: "support" | "oppose"): Result {
  const c = company(s, cid);
  if (!c.pac) return fail("Found a PAC first.");
  if (amount > c.pac.funds) return fail(`${c.pac.name} only has ${fmtMoney(c.pac.funds)}. Move more money into it first.`);
  return ok(pacSpendImpl(s, c, politicianId, amount, mode));
}

export function pacRace(s: GameState, cid: number, raceId: string, side: "D" | "R", amount: number): Result {
  const c = company(s, cid);
  if (!c.pac) return fail("Found a PAC first.");
  if (amount > c.pac.funds) return fail(`${c.pac.name} only has ${fmtMoney(c.pac.funds)}. Move more money into it first.`);
  return ok(pacRaceImpl(s, c, raceId, side, amount));
}

export function setHqForm(s: GameState, cid: number, form: HqForm): Result {
  const c = company(s, cid);
  if (c.hqSite.form === form) return fail("Already built that way.");
  if (HQ_FORMS[form].needsTower && !towerAllowed(s, c.hqSite.city)) return fail(`${s.cities[c.hqSite.city]?.name} has no downtown that can take a skyscraper.`);
  const cost = buildCostPerLevel(s, "hq", c.hqSite.city, undefined, false, c) * hqLevels(c) * 0.3 * HQ_FORMS[form].costMult;
  if (cost > liquidity(c)) return fail(`Rebuilding costs ${fmtMoney(cost)}.`);
  c.cash -= cost;
  c.ppe += cost;
  c.hqSite.form = form;
  c.hqSite.amenities = c.hqSite.amenities.slice(0, HQ_FORMS[form].slots);
  return ok(`Rebuilt headquarters as a ${HQ_FORMS[form].name.toLowerCase()} for ${fmtMoney(cost)}.`);
}

export function toggleAmenity(s: GameState, cid: number, id: AmenityId): Result {
  const c = company(s, cid);
  if (c.hqSite.amenities.includes(id)) {
    c.hqSite.amenities = c.hqSite.amenities.filter((a) => a !== id);
    return ok(`Closed the ${AMENITY_BY_ID[id].name.toLowerCase()}.`);
  }
  if (c.hqSite.amenities.length >= HQ_FORMS[c.hqSite.form].slots) return fail(`A ${HQ_FORMS[c.hqSite.form].name.toLowerCase()} has room for ${HQ_FORMS[c.hqSite.form].slots} amenities.`);
  const cost = amenityCost(c, id);
  if (cost > liquidity(c)) return fail(`Needs ${fmtMoney(cost)}.`);
  c.cash -= cost;
  c.ppe += cost;
  c.hqSite.amenities.push(id);
  return ok(`Opened the ${AMENITY_BY_ID[id].name.toLowerCase()} (${fmtMoney(cost)}).`);
}

/** Move headquarters to another city: rebuild the HQ there, change state taxes, and change who loves you. */
export function relocateHq(s: GameState, cid: number, city: string): Result {
  const c = company(s, cid);
  const dest = s.cities[city];
  if (!dest) return fail("Unknown city.");
  if (city === c.hqSite.city) return fail("You're already there.");
  const lv = hqLevels(c);
  const cost = buildCostPerLevel(s, "hq", city, undefined, false, c) * lv * 0.5;
  if (cost > liquidity(c)) return fail(`Moving costs ${fmtMoney(cost)}.`);
  if (needsVote(c, "relocation", cost)) {
    const v = boardVote(s, c, "relocation", `to ${dest.name}`);
    if (!v.ok) return fail(v.message);
  }
  const old = s.cities[c.hqSite.city];
  c.cash -= cost;
  c.ppe += cost * 0.5;
  for (const b of c.buildings) if (b.type === "hq") { b.city = city; b.state = dest.state; }
  c.hqSite.city = city;
  c.hq = dest.state;
  if (HQ_FORMS[c.hqSite.form].needsTower && !dest.flags.includes("tower")) c.hqSite.form = "campus";
  if (old) old.opinion[c.id] = Math.max(0, (old.opinion[c.id] ?? 0.5) - 0.25);
  dest.opinion[c.id] = Math.min(1, (dest.opinion[c.id] ?? 0.5) + 0.2);
  log(s, `${c.name} is moving its headquarters to ${dest.name}.`, "deal", c.id);
  return ok(`Headquarters moving to ${dest.name} (${fmtMoney(cost)}).`);
}
