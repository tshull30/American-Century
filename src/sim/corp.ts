// Corporate life: credit ratings, a stock portfolio, antitrust suits, a foundation, the annual
// rankings, hostile bids for your company, patent licensing and the earnings call.
import { BUILDING_BY_ID, methodOf } from "./data/buildings";
import { GOOD_BY_ID, TECHS, type GoodId, type TechId } from "./data/goods";
import { ebitdaTTM, log } from "./engine";
import { roleFactor } from "./leadership";
import { politicianBeliefs, relationWith, type Result } from "./people";
import type { Company, GameEvent, GameState } from "./types";
import { clamp, fmtMoney, fmtPct, lowerName, rand } from "./util";

type Log = (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void;
const annualRev = (c: Company) => c.history.slice(-12).reduce((a, h) => a + h.revenue, 0);
const pick = <T,>(s: GameState, xs: T[]) => xs[Math.floor(rand(s) * xs.length)];
const ceoOf = (c: Company) => c.leadership?.execs.find((e) => e.role === "ceo");

// ---------------------------------------------------------------- credit ratings

export const RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C"] as const;
export type Rating = (typeof RATINGS)[number];
const SPREAD: Record<Rating, number> = { AAA: 0.005, AA: 0.008, A: 0.012, BBB: 0.018, BB: 0.03, B: 0.045, CCC: 0.07, CC: 0.09, C: 0.12 };

/** What a rating agency would say: leverage, interest coverage, size and cash. */
export function computeRating(c: Company): Rating {
  const e = ebitdaTTM(c);
  const net = c.debt - c.cash;
  const lev = e > 0 ? net / e : net > 0 ? 99 : -1;
  const levScore = lev < 0 ? 0 : lev < 1 ? 1 : lev < 2 ? 2 : lev < 3 ? 3 : lev < 4 ? 4 : lev < 5.5 ? 5 : lev < 8 ? 6 : 7;
  // Only the very biggest, safest companies earn AAA; small ones top out lower however much cash they hold.
  const sizeScore = c.marketCap > 1.5e12 ? 0 : c.marketCap > 300e9 ? 1 : c.marketCap > 50e9 ? 2 : c.marketCap > 8e9 ? 3 : c.marketCap > 1e9 ? 4 : 5;
  let score = Math.max(levScore, sizeScore);
  if (levScore >= 3) score = Math.max(score, levScore + 1);
  if (c.distressMonths > 0) score += 2;
  if (e <= 0 && c.debt > 1e6) score = Math.max(score, 6);
  return RATINGS[clamp(score, 0, RATINGS.length - 1)];
}
export const ratingSpread = (c: Company) => SPREAD[c.rating ?? computeRating(c)];
export const investmentGrade = (r: Rating) => RATINGS.indexOf(r) <= 3;

function updateRatings(s: GameState, L: (c: Company) => Log) {
  for (const c of s.companies) {
    if (!c.alive) continue;
    const r = computeRating(c);
    const old = c.rating;
    c.rating = r;
    if (!old || old === r) continue;
    const up = RATINGS.indexOf(r) < RATINGS.indexOf(old);
    const fallen = investmentGrade(old) && !investmentGrade(r);
    if (c.isPlayer || (c.marketCap > 200e9 && Math.abs(RATINGS.indexOf(r) - RATINGS.indexOf(old)) > 0)) {
      if (fallen) c.hype *= 0.96;
      L(c)(`Rating agencies ${up ? "upgraded" : "downgraded"} ${c.name} from ${old} to ${r}.`, up ? "good" : "bad",
        c.isPlayer || fallen ? { headline: fallen ? `${c.name} cut to junk` : `${c.name} ${up ? "upgraded" : "downgraded"} to ${r}`, deck: up ? "Borrowing just got cheaper" : fallen ? "Bond investors head for the exits" : "Borrowing costs rise" } : undefined);
    }
  }
}

// ---------------------------------------------------------------- portfolio

export interface Holding { stake: number; cost: number }
export const holdingValue = (s: GameState, id: number, h: Holding) => (s.companies.find((c) => c.id === id && c.alive)?.marketCap ?? 0) * h.stake;

export function tradeStake(s: GameState, me: Company, id: number, delta: number): Result {
  const t = s.companies.find((c) => c.id === id && c.alive);
  if (!t || t === me) return { ok: false, message: "You can't trade that." };
  me.holdings ??= {};
  const h = me.holdings[id] ?? { stake: 0, cost: 0 };
  if (delta > 0) {
    if (h.stake + delta > 0.199) return { ok: false, message: "Above 20% you'd have to make a formal offer: use Rivals and M&A." };
    const price = t.marketCap * delta * 1.01; // a little slippage
    if (me.cash < price) return { ok: false, message: `That takes ${fmtMoney(price)} in cash.` };
    me.cash -= price; h.stake += delta; h.cost += price; t.marketCap *= 1.002;
    me.holdings[id] = h;
    const ceo = ceoOf(t);
    if (h.stake >= 0.05 && h.stake - delta < 0.05) {
      if (ceo) { ceo.regard ??= { score: 0, why: {} }; ceo.regard.why.stake = -8; }
      log(s, `${me.name} disclosed a 5% stake in ${t.name}.`, "deal", me.id, "news", { headline: `${me.name} takes a 5% stake in ${t.name}`, deck: "Wall Street wonders what comes next" });
    }
    return { ok: true, message: `Bought ${fmtPct(delta, 0)} of ${t.name} for ${fmtMoney(price)}. You own ${fmtPct(h.stake, 1)}.` };
  }
  const sell = Math.min(h.stake, -delta);
  if (sell <= 0) return { ok: false, message: "You don't own any." };
  const proceeds = t.marketCap * sell * 0.99;
  const basis = h.cost * (sell / h.stake);
  me.cash += proceeds; h.cost -= basis; h.stake -= sell;
  if (h.stake < 1e-4) delete me.holdings[id]; else me.holdings[id] = h;
  return { ok: true, message: `Sold ${fmtPct(sell, 1)} of ${t.name} for ${fmtMoney(proceeds)} (${proceeds >= basis ? "a gain" : "a loss"} of ${fmtMoney(Math.abs(proceeds - basis))}).` };
}

function payDividendsToHolders(s: GameState) {
  for (const me of s.companies) {
    if (!me.holdings) continue;
    for (const [id, h] of Object.entries(me.holdings)) {
      const t = s.companies.find((c) => c.id === Number(id));
      if (!t || !t.alive) { delete me.holdings[Number(id)]; continue; }
      const div = t.history[t.history.length - 1]?.dividends ?? 0;
      if (div > 0) { me.cash += div * h.stake; me.current.revenue += 0; }
    }
  }
}

/** Already owning part of a target makes buying the rest cheaper. */
export function toeholdDiscount(buyer: Company, target: Company): number {
  return buyer.holdings?.[target.id]?.stake ?? 0;
}

// ---------------------------------------------------------------- antitrust

function maybeAntitrust(s: GameState, me: Company, L: Log) {
  const at = s.politics.laws.antitrust ?? 1;
  if (at < 1 || me.antitrust || (s.decisions ?? []).some((d) => d.kind === "antitrust")) return;
  if (me.lastSuit !== undefined && s.month - me.lastSuit < 36) return;
  const limit = at >= 2 ? 0.35 : 0.45;
  const dominant = (Object.keys(me.prices) as GoodId[]).map((g) => ({ g, sh: s.markets[g]?.sales[me.id]?.share ?? 0 })).filter((x) => x.sh >= limit).sort((a, b) => b.sh - a.sh)[0];
  if (!dominant || rand(s) > (at >= 2 ? 0.06 : 0.03)) return;
  const rev = me.history.slice(-12).reduce((a, h) => a + (h.revenueByGood[dominant.g] ?? 0), 0);
  const name = lowerName(GOOD_BY_ID[dominant.g].name);
  me.lastSuit = s.month;
  (s.decisions ??= []).push({
    id: s.nextId++, kind: "antitrust", companyId: me.id, deadlineDay: s.day + 30,
    headline: `Justice Department sues ${me.name} over ${name}`,
    deck: `Prosecutors say ${fmtPct(dominant.sh, 0)} of the market is a monopoly.`,
    options: [
      { id: "settle", label: "Settle", detail: `Pay ${fmtMoney(rev * 0.03)} and accept a price cap for three years` },
      { id: "fight", label: "Fight it in court", detail: "A year of trial. Win and it's over; lose and it's a bigger fine and a forced sale" },
      { id: "divest", label: "Offer to sell a unit", detail: "Sell a quarter of that business at 60% of book; the case goes away" },
    ],
    data: { good: dominant.g, rev },
  });
  L(`The Justice Department sued ${me.name}, alleging it monopolized ${name}.`, "bad", { headline: `Justice Department sues ${me.name} over ${name}`, deck: `Prosecutors say ${fmtPct(dominant.sh, 0)} of the market is a monopoly` });
}

function divest(s: GameState, c: Company, g: GoodId, share: number): number {
  const sites = c.buildings.filter((b) => b.level > 0 && methodOf(b.type, b.method).output[g]).sort((a, b) => b.level - a.level);
  const total = sites.reduce((a, b) => a + b.level, 0);
  let cut = Math.round(total * share), cash = 0;
  for (const b of sites) {
    if (cut <= 0) break;
    const n = Math.min(cut, b.level);
    b.level -= n; cut -= n;
    cash += n * BUILDING_BY_ID[b.type].cost * 0.6;
  }
  c.buildings = c.buildings.filter((b) => b.level > 0 || b.construction.length);
  c.cash += cash;
  void s;
  return cash;
}

function runTrial(s: GameState, me: Company, L: Log) {
  const a = me.antitrust;
  if (!a) return;
  if (a.kind === "consent" && s.month >= a.until) { me.antitrust = undefined; L(`${poss(me.name)} consent decree on ${lowerName(GOOD_BY_ID[a.good].name)} expired.`, "good"); return; }
  if (a.kind === "trial" && s.month >= a.until) {
    const lawyers = 0.45 + 0.08 * roleFactor(me, "ceo") + (s.politics.laws.antitrust >= 2 ? -0.1 : 0);
    me.antitrust = undefined;
    if (rand(s) < lawyers) {
      me.hype *= 1.05;
      L(`${me.name} won its antitrust trial.`, "good", { headline: `Judge rules for ${me.name} in monopoly case`, deck: "The government says it will consider an appeal" });
    } else {
      const fine = a.rev * 0.08;
      me.cash -= fine;
      const raised = divest(s, me, a.good, 0.3);
      me.hype *= 0.92;
      L(`${me.name} lost its antitrust trial: a ${fmtMoney(fine)} fine and a forced sale of 30% of its ${lowerName(GOOD_BY_ID[a.good].name)} business (${fmtMoney(raised)} raised).`, "bad", { headline: `Judge orders ${me.name} broken up`, deck: `A ${fmtMoney(fine)} fine and a forced sale` });
    }
  }
}

/** Under a consent decree you can't price far above the market. */
export function consentCap(s: GameState, c: Company, g: GoodId): number {
  if (c.antitrust?.kind !== "consent" || c.antitrust.good !== g) return Infinity;
  return (s.markets[g]?.othersPrice ?? GOOD_BY_ID[g].refPrice) * 1.15;
}

// ---------------------------------------------------------------- foundation

export type CauseId = "education" | "climate" | "community" | "health" | "veterans";
export const CAUSES: Record<CauseId, { name: string; effect: string }> = {
  education: { name: "Schools and scholarships", effect: "Everyone likes it: image and local opinion; teachers and scientists like you more" },
  climate: { name: "Climate and clean energy", effect: "Green-minded politicians, executives and cities love it; drill-baby-drill types don't" },
  community: { name: "Hometown grants", effect: "Big boost to local opinion and city councils wherever you operate" },
  health: { name: "Hospitals and medical research", effect: "Image, plus nurses and care workers think better of you" },
  veterans: { name: "Veterans and their families", effect: "Conservatives especially approve; image up a little" },
};

export function setCause(c: Company, id: CauseId, monthly: number): Result {
  c.foundation ??= {};
  if (monthly <= 0) { delete c.foundation[id]; return { ok: true, message: `You stopped funding ${CAUSES[id].name.toLowerCase()}.` }; }
  c.foundation[id] = monthly;
  return { ok: true, message: `${fmtMoney(monthly)} a month to ${CAUSES[id].name.toLowerCase()}.` };
}

function runFoundation(s: GameState, c: Company) {
  const f = c.foundation;
  if (!f) return;
  const size = Math.max(5e6, annualRev(c) / 12 * 0.002);
  const eff = (id: CauseId) => clamp(Math.sqrt((f[id] ?? 0) / size), 0, 2);
  let total = 0;
  for (const v of Object.values(f)) total += v ?? 0;
  c.cash -= total;
  c.current.sgaCost += total;
  const all = eff("education") + eff("climate") * 0.6 + eff("community") * 0.8 + eff("health") + eff("veterans") * 0.6;
  c.image = clamp(c.image + all * 0.003, 0, 0.98);
  if (eff("community") > 0) for (const city of Object.values(s.cities)) if (c.buildings.some((b) => b.city === city.id)) city.opinion[c.id] = clamp((city.opinion[c.id] ?? 0.5) + 0.004 * eff("community"), 0, 1);
  if (eff("education") > 0) for (const j of ["teacher", "scientist"] as const) c.jobOpinion[j] = clamp((c.jobOpinion[j] ?? 0.5) + 0.003 * eff("education"), 0, 1);
  if (eff("health") > 0) for (const j of ["nurse", "care", "physician"] as const) c.jobOpinion[j] = clamp((c.jobOpinion[j] ?? 0.5) + 0.003 * eff("health"), 0, 1);
  if (!c.isPlayer) return;
  for (const p of s.politicians) {
    const b = politicianBeliefs(p);
    const v = eff("education") * 3 + eff("health") * 3 + eff("climate") * 8 * b.climate + eff("veterans") * (3 + 4 * Math.max(0, -b.labor)) + eff("community") * 2;
    p.regard ??= { score: 0, why: {} };
    p.regard.why.foundation = clamp(v, -12, 15);
  }
  for (const e of c.leadership?.execs ?? []) if (e.beliefs && eff("climate") > 0) e.morale = clamp((e.morale ?? 65) + e.beliefs.climate * eff("climate") * 0.6, 0, 100);
}

// ---------------------------------------------------------------- the American 500

export interface Rankings { year: number; revenue: number[]; workplaces: number[]; admired: number[] }

function rankCompanies(s: GameState, L: Log) {
  const alive = s.companies.filter((c) => c.alive && c.history.length >= 12);
  const byRev = alive.slice().sort((a, b) => annualRev(b) - annualRev(a)).map((c) => c.id);
  const work = (c: Company) => c.wagePolicy * 2 + Object.values(c.jobOpinion).reduce((a, b) => a + (b ?? 0.5), 0) / Math.max(1, Object.keys(c.jobOpinion).length) + (c.leadership?.execs.reduce((a, e) => a + (e.morale ?? 65), 0) ?? 300) / 1500;
  const byWork = alive.slice().sort((a, b) => work(b) - work(a)).map((c) => c.id);
  const admire = (c: Company) => c.image * 2 + Math.log10(Math.max(1e8, c.marketCap)) * 0.15 + (c.perks?.length ?? 0) * 0.2 + (c.rating && investmentGrade(c.rating) ? 0.1 : 0);
  const byAdm = alive.slice().sort((a, b) => admire(b) - admire(a)).map((c) => c.id);
  const year = 2025 + Math.floor(s.month / 12);
  s.rankings = { year, revenue: byRev, workplaces: byWork, admired: byAdm };
  const me = s.companies.find((c) => c.isPlayer);
  if (!me) return;
  const r = byRev.indexOf(me.id) + 1, w = byWork.indexOf(me.id) + 1, a = byAdm.indexOf(me.id) + 1;
  if (r <= 0) return;
  const top = s.companies.find((c) => c.id === byRev[0]);
  const best = [r === 1 ? `${me.name} tops the American 500` : null, w === 1 ? `${me.name} named the best place to work in America` : null, a === 1 ? `${me.name} is America's most admired company` : null].filter(Boolean)[0];
  L(`The American 500 for ${year}: ${me.name} ranks #${r} by revenue, #${w} as a place to work and #${a} for admiration. ${top?.name} is #1.`, r <= 10 || w <= 10 || a <= 10 ? "good" : "info",
    { headline: best ?? `The American 500: ${me.name} ranks #${r}`, deck: `#${w} best place to work; #${a} most admired. ${top && top !== me ? `${top.name} holds the top spot.` : ""}` });
}

// ---------------------------------------------------------------- hostile bids for the player

function maybeHostileBid(s: GameState, me: Company, L: Log) {
  if ((s.decisions ?? []).some((d) => d.kind === "hostile_bid") || s.gameOver) return;
  if (me.lastBid !== undefined && s.month - me.lastBid < 24) return;
  const conf = me.leadership?.board.confidence ?? 0.6;
  const suitors = s.companies.filter((c) => c.alive && !c.isPlayer && c.marketCap > me.marketCap * 6 && c.cash + c.marketCap * 0.1 > me.marketCap * 1.4);
  if (!suitors.length || rand(s) > (conf < 0.45 ? 0.03 : 0.008)) return;
  const b = pick(s, suitors);
  const premium = 0.25 + rand(s) * 0.35;
  const price = me.marketCap * (1 + premium);
  me.lastBid = s.month;
  (s.decisions ??= []).push({
    id: s.nextId++, kind: "hostile_bid", companyId: me.id, deadlineDay: s.day + 30,
    headline: `${b.name} bids ${fmtMoney(price)} for ${me.name}`,
    deck: `A ${fmtPct(premium, 0)} premium, straight to shareholders. Your board wants to know what you'll do.`,
    options: [
      { id: "fight", label: "Adopt a poison pill", detail: "Blocks the bid if the board backs you; the stock gives back the takeover pop" },
      { id: "knight", label: "Find a white knight", detail: "A friendly partner buys a stake to block the bid; needs a partnership or a warm rival CEO" },
      { id: "sell", label: "Sell the company", detail: `Take ${fmtMoney(price)}. The game ends; your shareholders are rich` },
    ],
    data: { bidder: b.id, price, premium },
  });
  me.hype *= 1 + premium * 0.5;
  me.marketCap *= 1 + premium * 0.5;
  L(`${b.name} launched a hostile bid for ${me.name}: ${fmtMoney(price)}.`, "deal", { headline: `${b.name} bids ${fmtMoney(price)} for ${me.name}`, deck: `A ${fmtPct(premium, 0)} premium, straight to shareholders` });
}

// ---------------------------------------------------------------- patents

export function licensingTerms(s: GameState, me: Company, t: TechId): { lead: number; royalty: number } {
  const lead = (me.tech[t] ?? 0) - (s.baselineTech[t] ?? 0);
  const goods = TECHS.find((x) => x.id === t)!.goods;
  let rivalRev = 0;
  for (const c of s.companies) if (c.alive && c !== me) { const h = c.history[c.history.length - 1]; if (h) for (const g of goods) rivalRev += h.revenueByGood[g] ?? 0; }
  return { lead, royalty: lead >= 1 ? rivalRev * 0.012 * Math.min(2, lead / 1.5) : 0 };
}

export function toggleLicense(s: GameState, me: Company, t: TechId): Result {
  me.licenses ??= {};
  if (me.licenses[t] !== undefined) { delete me.licenses[t]; return { ok: true, message: `You stopped licensing ${TECHS.find((x) => x.id === t)!.name.toLowerCase()}.` }; }
  const terms = licensingTerms(s, me, t);
  if (terms.lead < 1) return { ok: false, message: "You need at least a full level of lead to license anything worth paying for." };
  me.licenses[t] = s.month;
  return { ok: true, message: `Licensing deal signed: about ${fmtMoney(terms.royalty)} a month. Rivals will catch up faster.` };
}

function runLicenses(s: GameState, me: Company) {
  for (const t of Object.keys(me.licenses ?? {}) as TechId[]) {
    const terms = licensingTerms(s, me, t);
    if (terms.lead < 0.5) { delete me.licenses![t]; continue; }
    me.cash += terms.royalty;
    me.current.revenue += terms.royalty;
    for (const c of s.companies) if (c.alive && c !== me && (c.tech[t] ?? 0) < (me.tech[t] ?? 0) - 1) c.tech[t] = (c.tech[t] ?? 0) + 0.04;
  }
}

// ---------------------------------------------------------------- earnings call

const QUESTIONS = [
  { q: "An analyst asks why margins slipped this quarter.", ok: "Margins" },
  { q: "An analyst asks whether a rival is eating your lunch.", ok: "Competition" },
  { q: "An analyst asks how much the company is exposed to China.", ok: "China" },
  { q: "An analyst asks what your AI strategy actually is.", ok: "AI" },
  { q: "An analyst asks whether buybacks beat investing in growth.", ok: "Capital" },
  { q: "An analyst asks if the CEO has a succession plan.", ok: "Succession" },
];

export function earningsCall(s: GameState, me: Company) {
  if (rand(s) > 0.5 || (s.decisions ?? []).some((d) => d.kind === "earnings_call")) return;
  const q = pick(s, QUESTIONS);
  (s.decisions ??= []).push({
    id: s.nextId++, kind: "earnings_call", companyId: me.id, deadlineDay: s.day + 10,
    headline: "On the earnings call", deck: q.q,
    options: [
      { id: "bold", label: "Answer with swagger", detail: "Can send the stock up, or make you look arrogant" },
      { id: "candid", label: "Answer candidly", detail: "Builds trust with the board; the stock may dip" },
      { id: "deflect", label: "Deflect", detail: "Safe, forgettable, a little suspicious" },
    ],
    data: { topic: q.ok },
  });
}

// ---------------------------------------------------------------- monthly

export function updateCorp(s: GameState, L: (c: Company) => Log, warm: boolean) {
  updateRatings(s, warm ? () => () => undefined : L);
  payDividendsToHolders(s);
  for (const c of s.companies) if (c.alive) runFoundation(s, c);
  if (warm) return;
  const me = s.companies.find((c) => c.isPlayer && c.alive);
  if (!me) return;
  const log1 = L(me);
  runLicenses(s, me);
  runTrial(s, me, log1);
  maybeAntitrust(s, me, log1);
  maybeHostileBid(s, me, log1);
  if (((s.month % 12) + 12) % 12 === 0 && s.month > 0) rankCompanies(s, log1);
}

export function applyCorpDecision(s: GameState, me: Company, kind: string, opt: string, data: Record<string, string | number>, L: Log): string {
  if (kind === "antitrust") {
    const g = String(data.good) as GoodId, rev = Number(data.rev);
    if (opt === "settle") { me.cash -= rev * 0.03; me.antitrust = { kind: "consent", good: g, until: s.month + 36, rev }; return `Settled for ${fmtMoney(rev * 0.03)}. A price cap applies for three years.`; }
    if (opt === "fight") { me.antitrust = { kind: "trial", good: g, until: s.month + 12, rev }; me.cash -= rev * 0.002; return "Your lawyers are preparing for trial. The verdict comes in about a year."; }
    const raised = divest(s, me, g, 0.25);
    L(`${me.name} agreed to sell a quarter of its ${lowerName(GOOD_BY_ID[g].name)} business to settle the case.`, "deal", { headline: `${me.name} sells a unit to end monopoly case`, deck: `${fmtMoney(raised)} raised` });
    return `You sold a quarter of the business for ${fmtMoney(raised)}. The case is closed.`;
  }
  if (kind === "hostile_bid") {
    const b = s.companies.find((c) => c.id === Number(data.bidder));
    const price = Number(data.price);
    const board = me.leadership?.board;
    const pop = 1 + Number(data.premium) * 0.5;
    if (opt === "sell") {
      s.gameOver = `You sold ${me.name} to ${b?.name ?? "a rival"} for ${fmtMoney(price)}. Your shareholders are rich, and your work here is done.`;
      if (s.setup) { s.setup.result = s.setup.result ?? "won"; s.setup.resultMonth = s.month; }
      L(`${me.name} agreed to be acquired by ${b?.name} for ${fmtMoney(price)}.`, "deal", { headline: `${b?.name} buys ${me.name} for ${fmtMoney(price)}`, deck: "The end of an independent company" });
      return "Sold.";
    }
    me.hype /= pop; me.marketCap /= pop;
    if (b) { const ceo = ceoOf(b); if (ceo) { ceo.regard ??= { score: 0, why: {} }; ceo.regard.why.deal = (ceo.regard.why.deal ?? 0) - 15; } }
    if (opt === "fight") {
      if ((board?.confidence ?? 0.5) > 0.38 || rand(s) < 0.5) { if (board) board.confidence = clamp(board.confidence - 0.04, 0, 1); return `The board adopted a poison pill. ${b?.name} walked away.`; }
      s.gameOver = `Your board refused to adopt a poison pill, and shareholders tendered to ${b?.name} at ${fmtMoney(price)}. You've been taken over.`;
      return "The board wouldn't back you. Shareholders sold.";
    }
    const friends = s.companies.filter((c) => c.alive && !c.isPlayer && c !== b && ((relationWith(s, c.id).partnerUntil ?? 0) > s.month || (ceoOf(c)?.regard?.score ?? 0) > 30) && c.marketCap > me.marketCap * 0.3);
    if (friends.length) {
      const k = friends.sort((x, y) => y.marketCap - x.marketCap)[0];
      me.cash += me.marketCap * 0.12;
      return `${k.name} stepped in as a white knight, buying 12% of your stock (${fmtMoney(me.marketCap * 0.12)} in new cash). ${b?.name} gave up.`;
    }
    if ((board?.confidence ?? 0.5) > 0.5) return "No white knight came forward, but your board held the line. The bid lapsed.";
    s.gameOver = `No white knight came, and shareholders tendered to ${b?.name} at ${fmtMoney(price)}. You've been taken over.`;
    return "No one came to save you.";
  }
  if (kind === "earnings_call") {
    const ceo = ceoOf(me);
    const skill = roleFactor(me, "ceo");
    const board = me.leadership?.board;
    const beat = (me.lastEarnings?.surprise ?? 0) > 0;
    if (opt === "bold") {
      if (rand(s) < 0.45 + skill * 0.15 + (beat ? 0.15 : -0.1)) { me.hype *= 1.025; return `${ceo?.name ?? "Your CEO"} nailed it. The stock popped.`; }
      me.hype *= 0.975; me.image = clamp(me.image - 0.01, 0, 1); return `${ceo?.name ?? "Your CEO"} came off arrogant. The clip is circulating.`;
    }
    if (opt === "candid") { me.hype *= 0.995; if (board) board.confidence = clamp(board.confidence + 0.03, 0, 1); return "A straight answer. The board liked it; traders shrugged."; }
    me.hype *= 0.997; return "Deflected. Nobody learned anything.";
  }
  return "";
}

const poss = (n: string) => (n.endsWith("s") ? `${n}'` : `${n}'s`);
