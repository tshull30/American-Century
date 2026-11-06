// Company stories: recalls, breaches, fires, strikes, lawsuits, spills, hits and flops.
// Some need a decision. The player decides on the front page; rivals decide on their own.
import { BUILDING_BY_ID } from "./data/buildings";
import { GOOD_BY_ID, type GoodId } from "./data/goods";
import { BLUE_COLLAR } from "./data/jobs";
import { cityLabel } from "./geo";
import { hasTrait } from "./leadership";
import { applyPeopleDecision, noteUnion } from "./people";
import { applyFunDecision } from "./fun";
import { applyCorpDecision } from "./corp";
import { resolveProbe } from "./crime";
import type { Building, Company, GameEvent, GameState } from "./types";
import { clamp, fmtMoney, lowerName, rand } from "./util";

export interface DecisionOption { id: string; label: string; detail: string }
export interface Decision {
  id: number;
  kind: StoryKind;
  companyId: number;
  headline: string;
  deck: string;
  options: DecisionOption[];
  deadlineDay: number;
  data: Record<string, string | number>;
}
export interface Scheduled { day: number; kind: "recall_leak" | "breach_fine" | "spill_fine"; companyId: number; data: Record<string, string | number> }

export type StoryKind = "recall" | "breach" | "union" | "strike" | "lawsuit" | "spill" | "whistleblower" | "ransomware" | "stadium" | "water_protest" | "exec_raise" | "partner_offer" | "hearing" | "superbowl" | "hq2_pick" | "antitrust" | "hostile_bid" | "earnings_call" | "probe";

type Log = (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void;

const poss = (n: string) => (n.endsWith("s") ? `${n}'` : `${n}'s`);
const annualRev = (c: Company) => c.history.slice(-12).reduce((a, h) => a + h.revenue, 0);
const revOf = (c: Company, g: GoodId) => c.history.slice(-12).reduce((a, h) => a + (h.revenueByGood[g] ?? 0), 0);
const pick = <T,>(s: GameState, xs: T[]) => xs[Math.floor(rand(s) * xs.length)];
const has = (c: Company, pred: (b: Building) => boolean) => c.buildings.filter((b) => b.level > 0 && pred(b));
const MADE: GoodId[] = ["smartphones", "computers", "evs", "gas_cars", "appliances", "medical_devices", "household_goods", "furniture", "groceries", "beverages", "pharmaceuticals", "apparel", "batteries"];
const DIGITAL: GoodId[] = ["software", "cloud", "digital_ads", "data_platforms", "telecom", "streaming", "video_games"];
const CONSUMER: GoodId[] = ["smartphones", "computers", "evs", "apparel", "beverages", "video_games", "streaming", "household_goods", "meals_fast", "meals_casual", "meals_fine", "furniture", "luxury_fashion", "luxury_cars"];

/** Roll this month's stories. */
export function rollStories(s: GameState, log: (c: Company) => Log) {
  for (const c of s.companies) {
    if (!c.alive || c.history.length < 3) continue;
    const L = log(c);
    const big = c.isPlayer || c.marketCap > 300e9;
    const rev = annualRev(c);
    const goods = Object.keys(c.prices) as GoodId[];

    // Product recall.
    const made = goods.filter((g) => MADE.includes(g) && revOf(c, g) > 0);
    if (made.length && rand(s) < 0.004) {
      const g = pick(s, made);
      const cost = revOf(c, g) * 0.03;
      decide(s, c, "recall", `${c.name} finds a defect in its ${lowerName(GOOD_BY_ID[g].name)}`, "Engineers say the fault is rare but real. A full recall is expensive; a quiet fix might never come out.",
        [{ id: "recall", label: "Full recall", detail: `Costs ${fmtMoney(cost)}; reputation dips a little` }, { id: "quiet", label: "Quiet fix", detail: `Costs ${fmtMoney(cost * 0.15)}; if it leaks, much worse` }],
        { good: g, cost }, L, big);
    }
    // Data breach.
    const dig = goods.filter((g) => DIGITAL.includes(g));
    if (dig.length && rand(s) < 0.004) {
      const cost = rev * 0.01;
      decide(s, c, "breach", `Hackers break into ${poss(c.name)} systems`, "Millions of customer records may be exposed. Lawyers want to say nothing until they know more.",
        [{ id: "disclose", label: "Disclose and compensate", detail: `Costs ${fmtMoney(cost)}; image dips` }, { id: "downplay", label: "Downplay it", detail: "Cheap now; regulators may fine you later" }],
        { cost }, L, big);
    }
    // Factory fire: no decision.
    const plants = has(c, (b) => BUILDING_BY_ID[b.type].industry !== "office" && b.level >= 4);
    if (plants.length && rand(s) < 0.003) {
      const b = pick(s, plants);
      const lost = Math.max(1, Math.round(b.level * 0.25));
      b.level -= lost;
      c.cash += lost * BUILDING_BY_ID[b.type].cost * 0.6;
      if (big) L(`A fire destroyed ${lost} levels of ${poss(c.name)} ${BUILDING_BY_ID[b.type].name.toLowerCase()} in ${cityLabel(s, b.city)}. Insurance covers 60%.`, "bad",
        { headline: `Fire guts ${c.name} plant in ${s.cities[b.city]?.name ?? b.city}`, deck: `${lost} levels lost; insurers will cover most of the rebuild` });
    }
    // Union drive at a big blue-collar site.
    const sites = has(c, (b) => b.level >= 20 && BUILDING_BY_ID[b.type].industry === "factory" && !s.cities[b.city]?.foreign);
    if (sites.length && rand(s) < 0.004 * (1 + (s.politics.laws.labor_unions ?? 1))) {
      const b = pick(s, sites);
      decide(s, c, "union", `Workers at ${poss(c.name)} ${s.cities[b.city]?.name} plant file for a union vote`, "Organizers say they have the signatures. Management can recognize the union or fight the election.",
        [{ id: "recognize", label: "Recognize the union", detail: "Pay rises about 2%; workers and the town warm to you" }, { id: "fight", label: "Fight it", detail: "Legal costs and bad press; you may lose anyway" }],
        { city: b.city }, L, big);
    }
    // Strike where unions are strong and pay is low.
    const strikeSites = has(c, (b) => b.level >= 10 && (s.cities[b.city]?.union ?? 0) > 0.6 && !s.cities[b.city]?.foreign);
    if (strikeSites.length && c.wagePolicy < 1.05 && rand(s) < 0.003) {
      const b = pick(s, strikeSites);
      decide(s, c, "strike", `Strike shuts ${c.name} lines in ${s.cities[b.city]?.name}`, "The local walked out over pay. Every day out costs output.",
        [{ id: "settle", label: "Settle", detail: "Raise pay about 3% across the company" }, { id: "holdout", label: "Hold out", detail: "Sites in the city run at half output for six weeks" }],
        { city: b.city }, L, big);
    }
    // Lawsuit.
    if (rev > 1e9 && rand(s) < 0.003) {
      const amount = rev * (0.003 + rand(s) * 0.01);
      const what = pick(s, ["a patent suit", "a class action from customers", "a price-fixing suit", "a wrongful-termination class action", "a securities fraud suit"]);
      decide(s, c, "lawsuit", `${c.name} hit with ${what}`, `Plaintiffs want ${fmtMoney(amount * 3)}. Outside counsel thinks it's a coin flip.`,
        [{ id: "settle", label: "Settle", detail: `Pay ${fmtMoney(amount)} now` }, { id: "fight", label: "Fight it in court", detail: `Pay nothing, or ${fmtMoney(amount * 3)} if you lose` }],
        { amount }, L, big);
    }
    // Oil spill.
    const fossil = has(c, (b) => b.type === "oilfield" || b.type === "refinery" || b.type === "gasfield");
    if (fossil.length && rand(s) < 0.004) {
      const b = pick(s, fossil);
      const cost = BUILDING_BY_ID[b.type].cost * Math.min(b.level, 40) * 0.05;
      decide(s, c, "spill", `${b.type === "gasfield" ? "Gas leak" : "Oil spill"} at ${c.name} site near ${s.cities[b.city]?.name}`, "Crews are containing it. The question is who pays for the cleanup.",
        [{ id: "pay", label: "Pay for a full cleanup", detail: `Costs ${fmtMoney(cost)}` }, { id: "fight", label: "Contest liability", detail: `Costs ${fmtMoney(cost * 0.3)} now; locals turn on you and a fine may follow` }],
        { city: b.city, cost }, L, big);
    }
    // Whistleblower.
    if ((hasTrait(c, "cost_cutter") || hasTrait(c, "scandal_prone")) && rand(s) < 0.003) {
      decide(s, c, "whistleblower", `Whistleblower accuses ${c.name} of cutting corners`, "A former manager has gone to reporters with internal emails. The board wants to know what you'll do.",
        [{ id: "investigate", label: "Commission an independent review", detail: `Costs ${fmtMoney(Math.max(2e6, rev * 0.001))}; the board calms down` }, { id: "deny", label: "Deny everything", detail: "Free; image and board confidence fall" }],
        {}, L, big);
    }
    // Ransomware.
    if (rand(s) < 0.002) {
      const ransom = Math.max(1e6, rev * 0.0015);
      decide(s, c, "ransomware", `Ransomware locks up ${c.name}`, `Hackers want ${fmtMoney(ransom)} in crypto to unlock the company's systems.`,
        [{ id: "pay", label: "Pay the ransom", detail: `${fmtMoney(ransom)}, quietly` }, { id: "refuse", label: "Refuse and rebuild", detail: "Every site runs at half output for two weeks" }],
        { ransom }, L, big);
    }
    // A hit product.
    const hits = goods.filter((g) => CONSUMER.includes(g) && revOf(c, g) > 0);
    if (hits.length && rand(s) < 0.004) {
      const g = pick(s, hits);
      c.brand[g] = (c.brand[g] ?? 0) * 1.5;
      c.reputation[g] = (c.reputation[g] ?? 1) + 0.1;
      if (big) L(`${poss(c.name)} ${lowerName(GOOD_BY_ID[g].name)} went viral; demand is running ahead of supply.`, "good",
        { headline: `Everyone wants ${poss(c.name)} new ${lowerName(GOOD_BY_ID[g].name)}`, deck: "A viral hit leaves shelves empty and the brand on everyone's lips" });
    }
    // Drug approvals.
    if (goods.includes("pharmaceuticals") && rand(s) < 0.006) {
      if (rand(s) < 0.6) {
        c.reputation.pharmaceuticals = (c.reputation.pharmaceuticals ?? 1) + 0.2;
        c.tech.biotech = (c.tech.biotech ?? 0) + 0.5;
        if (big) L(`The FDA approved a new ${c.name} drug.`, "good", { headline: `FDA approves ${c.name} drug`, deck: "Analysts see a blockbuster; the stock jumps" });
        c.hype *= 1.04;
      } else {
        const loss = Math.max(5e6, revOf(c, "pharmaceuticals") * 0.02);
        c.cash -= loss;
        c.hype *= 0.96;
        if (big) L(`The FDA rejected a ${c.name} drug; ${fmtMoney(loss)} in development is written off.`, "bad", { headline: `FDA rejects ${poss(c.name)} lead candidate`, deck: "Years of trials end in a write-off" });
      }
    }
    // A stadium deal from the home city.
    if (c.isPlayer && c.marketCap > 5e9 && rand(s) < 0.004) {
      const cost = Math.min(80e6, c.marketCap * 0.0008);
      const city = s.cities[c.hqSite.city];
      decide(s, c, "stadium", `${city?.name ?? "Your city"} offers ${c.name} the naming rights to its stadium`, "Twenty years of your name on the scoreboard, in front of every home crowd.",
        [{ id: "accept", label: "Sign the deal", detail: `${fmtMoney(cost)}; brand and hometown opinion up` }, { id: "decline", label: "Pass", detail: "Nothing happens" }],
        { cost }, L, true);
    }
    // Water protest at a data center.
    const thirsty = has(c, (b) => b.type === "datacenter" && !!s.cities[b.city]?.flags.includes("water"));
    if (thirsty.length && rand(s) < 0.006) {
      const b = pick(s, thirsty);
      const cost = b.level * 2e6;
      decide(s, c, "water_protest", `Protesters ring ${poss(c.name)} data center in ${s.cities[b.city]?.name}`, "Residents say its cooling towers are draining the aquifer in a drought.",
        [{ id: "recycle", label: "Install water recycling", detail: `Costs ${fmtMoney(cost)}; locals calm down` }, { id: "ignore", label: "Ride it out", detail: "The council may turn on data centers" }],
        { city: b.city, cost }, L, big);
    }
  }
  // Follow-ups whose time has come.
  const due = (s.scheduled ?? []).filter((x) => x.day <= s.day);
  s.scheduled = (s.scheduled ?? []).filter((x) => x.day > s.day);
  for (const f of due) {
    const c = s.companies.find((x) => x.id === f.companyId);
    if (!c?.alive) continue;
    const L = log(c);
    const big = c.isPlayer || c.marketCap > 300e9;
    if (f.kind === "recall_leak") {
      const g = f.data.good as GoodId;
      c.reputation[g] = Math.max(0.3, (c.reputation[g] ?? 1) - 0.3);
      c.image = clamp(c.image - 0.1, 0, 1);
      c.cash -= Number(f.data.cost) * 2;
      if (c.leadership) c.leadership.board.confidence = clamp(c.leadership.board.confidence - 0.15, 0, 1);
      if (big) L(`Internal memos show ${c.name} knew about the ${lowerName(GOOD_BY_ID[g].name)} defect and fixed it quietly.`, "bad",
        { headline: `${c.name} hid defect, documents show`, deck: "A forced recall, a fine, and a brand in trouble" });
    } else if (f.kind === "breach_fine") {
      const fine = Number(f.data.cost) * 4;
      c.cash -= fine;
      c.image = clamp(c.image - 0.12, 0, 1);
      if (big) L(`Regulators fined ${c.name} ${fmtMoney(fine)} for misleading customers about its data breach.`, "bad",
        { headline: `${c.name} fined ${fmtMoney(fine)} over breach cover-up`, deck: "The FTC says the company knew more than it said" });
    } else if (f.kind === "spill_fine") {
      const fine = Number(f.data.cost) * 2;
      c.cash -= fine;
      if (big) L(`The EPA fined ${c.name} ${fmtMoney(fine)} over its spill.`, "bad", { headline: `EPA hits ${c.name} with ${fmtMoney(fine)} spill fine`, deck: "Contesting liability didn't work" });
    }
  }
  // Decisions the player let lapse take the first option... no: the default is the second (doing nothing costs).
  for (const d of [...(s.decisions ?? [])]) if (s.day >= d.deadlineDay) resolveDecision(s, d.id, d.options[d.options.length - 1].id, log);
}

function decide(s: GameState, c: Company, kind: StoryKind, headline: string, deck: string, options: DecisionOption[], data: Decision["data"], L: Log, big: boolean) {
  const d: Decision = { id: s.nextId++, kind, companyId: c.id, headline, deck, options, deadlineDay: s.day + 30, data };
  if (c.isPlayer) {
    (s.decisions ??= []).push(d);
    L(`${headline}. ${deck}`, "bad", { headline, deck });
    return;
  }
  // Rivals decide on the spot: mostly the safe choice.
  const choice = rand(s) < 0.65 ? options[0].id : options[options.length - 1].id;
  apply(s, c, d, choice, () => () => undefined);
  const chose = `${c.name} chose to ${options.find((o) => o.id === choice)!.label.replace(/^./, (x) => x.toLowerCase())}.`;
  if (big) L(`${headline}. ${chose}`, "info", { headline, deck: chose });
}

export function resolveDecision(s: GameState, id: number, optionId: string, log: (c: Company) => Log): string {
  const d = (s.decisions ?? []).find((x) => x.id === id);
  if (!d) return "That decision has already been made.";
  s.decisions = (s.decisions ?? []).filter((x) => x !== d);
  const c = s.companies.find((x) => x.id === d.companyId);
  if (!c) return "";
  return apply(s, c, d, optionId, log);
}

function apply(s: GameState, c: Company, d: Decision, opt: string, log: (c: Company) => Log): string {
  const L = log(c);
  const city = d.data.city ? s.cities[String(d.data.city)] : undefined;
  const board = c.leadership?.board;
  switch (d.kind) {
    case "recall": {
      const g = d.data.good as GoodId, cost = Number(d.data.cost);
      if (opt === "recall") { c.cash -= cost; c.reputation[g] = Math.max(0.3, (c.reputation[g] ?? 1) - 0.05); return `Recall under way: ${fmtMoney(cost)}.`; }
      c.cash -= cost * 0.15;
      if (rand(s) < 0.4) (s.scheduled ??= []).push({ day: s.day + 60 + Math.floor(rand(s) * 120), kind: "recall_leak", companyId: c.id, data: d.data });
      return "Engineers are fixing it quietly.";
    }
    case "breach": {
      const cost = Number(d.data.cost);
      if (opt === "disclose") { c.cash -= cost; c.image = clamp(c.image - 0.03, 0, 1); return `Customers notified and compensated: ${fmtMoney(cost)}.`; }
      if (rand(s) < 0.5) (s.scheduled ??= []).push({ day: s.day + 90 + Math.floor(rand(s) * 150), kind: "breach_fine", companyId: c.id, data: d.data });
      return "The statement says the breach was limited.";
    }
    case "union": {
      if (c.isPlayer) noteUnion(s, opt === "recognize");
      if (opt === "recognize") {
        c.wagePolicy += 0.02;
        for (const j of BLUE_COLLAR) c.jobOpinion[j] = clamp((c.jobOpinion[j] ?? 0.5) + 0.15, 0, 1);
        if (city) { city.union = clamp(city.union + 0.2, 0, 1); city.opinion[c.id] = clamp((city.opinion[c.id] ?? 0.5) + 0.08, 0, 1); }
        return "You recognized the union. Pay rises about 2%.";
      }
      c.cash -= 5e6 + annualRev(c) * 0.0005;
      if (city) city.opinion[c.id] = clamp((city.opinion[c.id] ?? 0.5) - 0.12, 0, 1);
      for (const j of BLUE_COLLAR) c.jobOpinion[j] = clamp((c.jobOpinion[j] ?? 0.5) - 0.1, 0, 1);
      if (rand(s) < 0.3) { c.wagePolicy += 0.02; L(`Workers at ${poss(c.name)} ${city?.name} plant voted to unionize anyway.`, "bad", { headline: `Union wins vote at ${c.name}`, deck: "Management's campaign falls short" }); }
      return "Lawyers are running the anti-union campaign.";
    }
    case "strike": {
      if (opt === "settle") { c.wagePolicy += 0.03; return "Strike settled: pay up about 3%."; }
      for (const b of c.buildings) if (b.city === d.data.city) b.disruptedUntil = s.day + 45;
      return "Lines in the city will run at half speed for six weeks.";
    }
    case "lawsuit": {
      const amt = Number(d.data.amount);
      if (opt === "settle") { c.cash -= amt; return `Settled for ${fmtMoney(amt)}.`; }
      if (rand(s) < 0.5) { c.cash -= amt * 3; L(`A jury found against ${c.name}: ${fmtMoney(amt * 3)}.`, "bad", { headline: `Jury hands ${c.name} ${fmtMoney(amt * 3)} loss`, deck: "The company says it will appeal" }); return "You lost in court."; }
      L(`${c.name} won its lawsuit.`, "good", { headline: `${c.name} wins in court`, deck: "The judge tossed the case" });
      return "You won in court.";
    }
    case "spill": {
      const cost = Number(d.data.cost);
      if (opt === "pay") { c.cash -= cost; return `Cleanup funded: ${fmtMoney(cost)}.`; }
      c.cash -= cost * 0.3;
      c.image = clamp(c.image - 0.08, 0, 1);
      if (city) city.opinion[c.id] = clamp((city.opinion[c.id] ?? 0.5) - 0.2, 0, 1);
      if (rand(s) < 0.6) (s.scheduled ??= []).push({ day: s.day + 120 + Math.floor(rand(s) * 120), kind: "spill_fine", companyId: c.id, data: d.data });
      return "You're contesting liability.";
    }
    case "whistleblower": {
      if (opt === "investigate") { c.cash -= Math.max(2e6, annualRev(c) * 0.001); if (board) board.confidence = clamp(board.confidence + 0.03, 0, 1); return "An outside law firm is reviewing the allegations."; }
      c.image = clamp(c.image - 0.06, 0, 1);
      if (board) board.confidence = clamp(board.confidence - 0.1, 0, 1);
      return "The company denies the allegations.";
    }
    case "ransomware": {
      if (opt === "pay") { c.cash -= Number(d.data.ransom); return "Paid. Systems are coming back up."; }
      for (const b of c.buildings) b.disruptedUntil = Math.max(b.disruptedUntil ?? 0, s.day + 14);
      return "Rebuilding from backups: two rough weeks.";
    }
    case "stadium": {
      if (opt === "accept") {
        c.cash -= Number(d.data.cost);
        for (const g of Object.keys(c.brand) as GoodId[]) c.brand[g] = (c.brand[g] ?? 0) * 1.08;
        const home = s.cities[c.hqSite.city];
        if (home) home.opinion[c.id] = clamp((home.opinion[c.id] ?? 0.5) + 0.12, 0, 1);
        return "Your name goes up on the stadium.";
      }
      return "You passed on the stadium.";
    }
    case "water_protest": {
      if (opt === "recycle") { c.cash -= Number(d.data.cost); if (city) city.opinion[c.id] = clamp((city.opinion[c.id] ?? 0.5) + 0.1, 0, 1); return "Water recycling ordered."; }
      if (city) { city.opinion[c.id] = clamp((city.opinion[c.id] ?? 0.5) - 0.15, 0, 1); if (rand(s) < 0.35) city.dcStance = "moratorium"; }
      return "You're riding out the protest.";
    }
    case "exec_raise": case "partner_offer": case "hearing":
      return applyPeopleDecision(s, c, d.kind, opt, d.data, L);
    case "probe":
      return resolveProbe(s, c, opt as "cooperate" | "fight" | "shred", L);
    case "antitrust": case "hostile_bid": case "earnings_call":
      return applyCorpDecision(s, c, d.kind, opt, d.data, L);
    case "superbowl": case "hq2_pick":
      return applyFunDecision(s, c, d.kind, opt, d.data, L);
  }
  return "";
}
