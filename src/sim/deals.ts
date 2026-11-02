import { friendlyPremium } from "./people";
import { toeholdDiscount } from "./corp";
import { leadEffects } from "./leadership";
// Mergers and acquisitions: the board has to say yes, regulators get a look, and big deals take time.
import { GOOD_BY_ID, type GoodId } from "./data/goods";
import { FACTIONS } from "./data/factions";
import { antitrustCap } from "./politics";
import type { Company, Deal, GameState } from "./types";
import { clamp, DAYS_PER_MONTH, fmtMoney, fmtPct, rand } from "./util";

/** The premium a target's board needs before it will recommend a sale. */
export function requiredPremium(s: GameState, buyer: Company, target: Company): number {
  let p = 0.3;
  if (target.hype > 1.5) p += 0.1; // a hot stock's board thinks it's worth more
  if (target.kind === "startup") p += 0.1; // founders want a big outcome
  if (buyer.marketCap > target.marketCap * 50) p += 0.1; // they know you can afford it
  if (target.kind === "incumbent") p += 0.15;
  void s;
  return Math.max(0.05, p + leadEffects.premium(buyer) + friendlyPremium(s, buyer, target));
}

/** Chance the board accepts at a given premium. */
export function boardOdds(s: GameState, buyer: Company, target: Company, premium: number): number {
  const need = requiredPremium(s, buyer, target);
  return clamp(1 / (1 + Math.exp(-(premium - need) / 0.06)), 0.02, 0.97);
}

/** Largest combined share of any market both companies sell in. */
export function overlap(s: GameState, a: Company, b: Company): { share: number; good?: GoodId } {
  let best = 0, good: GoodId | undefined;
  for (const [g, snap] of Object.entries(s.markets)) {
    if (!snap) continue;
    const x = snap.sales[a.id]?.share ?? 0, y = snap.sales[b.id]?.share ?? 0;
    if (x > 0.005 && y > 0.005 && x + y > best) { best = x + y; good = g as GoodId; }
  }
  return { share: best, good };
}

/** How hard regulators will look: probability of an in-depth "second request" review. */
export function scrutiny(s: GameState, buyer: Company, target: Company, price: number): number {
  const law = s.politics.laws.antitrust;
  let p = [0.08, 0.25, 0.5][law];
  if (buyer.marketCap > 1e12) p += 0.35;
  else if (buyer.marketCap > 200e9) p += 0.18;
  else if (buyer.marketCap > 50e9) p += 0.06;
  if (price > 10e9) p += 0.1;
  const ov = overlap(s, buyer, target).share;
  p += ov * 1.2;
  // Populist and progressive lawmakers in the majority push enforcers to act.
  let hawks = 0, total = 0;
  for (const m of s.politicians) {
    total++;
    if (m.faction === "populist" || m.faction === "progressive" || m.faction === "socialist") hawks++;
  }
  p += (hawks / Math.max(1, total)) * 0.3;
  void FACTIONS;
  return clamp(p, 0.03, 0.97);
}

/** Chance a deal under in-depth review is ultimately blocked. */
export function blockChance(s: GameState, buyer: Company, target: Company, price: number): number {
  const ov = overlap(s, buyer, target);
  if (ov.share > antitrustCap(s)) return 1;
  return clamp(scrutiny(s, buyer, target, price) * 0.55, 0.02, 0.9);
}

export const BREAK_FEE = 0.04;

export interface OfferOutcome { ok: boolean; message: string; deal?: Deal }

/** Make an offer. If the board accepts, the deal goes into regulatory review and closes later. */
export function makeOffer(s: GameState, buyer: Company, target: Company, premium: number, payment: "cash" | "stock", liquidity: number): OfferOutcome {
  if (s.deals.some((d) => d.targetId === target.id)) return { ok: false, message: `${target.name} is already in a deal.` };
  if (s.deals.some((d) => d.buyerId === buyer.id && d.stage === "second_request") && buyer.marketCap > 200e9) {
    return { ok: false, message: "Regulators won't look at a second deal while one is under in-depth review." };
  }
  // A stake you already own doesn't need buying again.
  const price = target.marketCap * (1 + premium) * (1 - toeholdDiscount(buyer, target));
  const ov = overlap(s, buyer, target);
  if (ov.share > antitrustCap(s)) return { ok: false, message: `Dead on arrival: combined ${GOOD_BY_ID[ov.good!].name} share of ${fmtPct(ov.share, 0)} is over the ${fmtPct(antitrustCap(s), 0)} legal limit.` };
  if (payment === "cash" && price > liquidity) return { ok: false, message: `Needs ${fmtMoney(price)} in cash and credit at closing.` };
  if (payment === "stock" && price > buyer.marketCap * 0.3) return { ok: false, message: "Shareholders won't approve issuing more than 30% new stock." };
  if (rand(s) > boardOdds(s, buyer, target, premium)) {
    return { ok: false, message: `${target.name}'s board rejected ${fmtPct(premium, 0)} as too low. Try a higher premium.` };
  }
  const second = rand(s) < scrutiny(s, buyer, target, price);
  const deal: Deal = {
    id: s.deals.length ? Math.max(...s.deals.map((d) => d.id)) + 1 : 1, buyerId: buyer.id, targetId: target.id, price, payment,
    stage: second ? "second_request" : "review",
    daysLeft: Math.round((second ? 6 + rand(s) * 8 : 1.5 + rand(s) * 2) * DAYS_PER_MONTH),
    blockChance: second ? blockChance(s, buyer, target, price) : 0, startedDay: s.day,
  };
  s.deals.push(deal);
  return {
    ok: true, deal,
    message: second
      ? `${target.name}'s board accepted ${fmtMoney(price)}. Regulators issued a second request: an in-depth review of about ${Math.round(deal.daysLeft / DAYS_PER_MONTH)} months.`
      : `${target.name}'s board accepted ${fmtMoney(price)}. The deal should close in about ${Math.round(deal.daysLeft / DAYS_PER_MONTH)} months.`,
  };
}
