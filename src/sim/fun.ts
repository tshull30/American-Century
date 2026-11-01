// The fun stuff: moonshots, product launches, the Super Bowl, a second-headquarters contest,
// corporate espionage, your CEO's posts, and meme-stock manias.
import { NEED_OF_GOOD } from "./data/needs";
import { GOOD_BY_ID, TECHS, type GoodId, type TechId } from "./data/goods";
import { STATE_BY_CODE } from "./data/states";
import { BLUE_COLLAR } from "./data/jobs";
import { addBuilding, log, quality } from "./engine";
import { ROLE_SHORT, roleFactor, hasTrait } from "./leadership";
import { relationWith, type Result } from "./people";
import type { Company, GameEvent, GameState } from "./types";
import { clamp, fmtMoney, lowerName, rand } from "./util";

type Log = (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void;

const annualRev = (c: Company) => c.history.slice(-12).reduce((a, h) => a + h.revenue, 0);
const pick = <T,>(s: GameState, xs: T[]) => xs[Math.floor(rand(s) * xs.length)];
const ceoOf = (c: Company) => c.leadership?.execs.find((e) => e.role === "ceo");

// ---------------------------------------------------------------- moonshots

export type MoonshotId = "fusion" | "autonomy" | "quantum" | "humanoids" | "cure" | "agi" | "mars";
export interface MoonshotDef { id: MoonshotId; name: string; short: string; blurb: string; monthly: number; months: number; odds: number; payoff: string }
export const MOONSHOTS: MoonshotDef[] = [
  { id: "fusion", short: "fusion power", name: "Commercial fusion", blurb: "A working reactor that puts more power on the grid than it takes.", monthly: 400e6, months: 48, odds: 0.5, payoff: "Running costs −8% everywhere; investors swoon" },
  { id: "autonomy", short: "self-driving", name: "Full self-driving", blurb: "Cars and trucks with no one at the wheel, in every weather.", monthly: 250e6, months: 36, odds: 0.6, payoff: "Automotive tech +4 levels, software +1" },
  { id: "quantum", short: "quantum computing", name: "Fault-tolerant quantum computer", blurb: "A million stable qubits. Chemistry, logistics and cryptography change overnight.", monthly: 300e6, months: 40, odds: 0.55, payoff: "Research output +30% forever" },
  { id: "humanoids", short: "humanoid robots", name: "Humanoid robots", blurb: "General-purpose robots that can work a warehouse or a factory line.", monthly: 250e6, months: 36, odds: 0.6, payoff: "Running costs −10%; workers will notice" },
  { id: "cure", short: "Alzheimer's research", name: "A cure for Alzheimer's", blurb: "The disease that defines old age, finally beaten.", monthly: 200e6, months: 48, odds: 0.45, payoff: "Biotechnology +5 levels; public image soars" },
  { id: "agi", short: "general AI", name: "Artificial general intelligence", blurb: "A machine that can do any job a person can do with a computer.", monthly: 600e6, months: 60, odds: 0.4, payoff: "Research +50%, output +5%, AI and software +5 levels" },
  { id: "mars", short: "Mars mission", name: "A crewed mission to Mars", blurb: "Boots on the red planet, with your logo on the suits.", monthly: 350e6, months: 60, odds: 0.55, payoff: "Aerospace +5 levels; brands +20%; image soars" },
];
export const MOONSHOT_BY_ID = Object.fromEntries(MOONSHOTS.map((m) => [m.id, m])) as Record<MoonshotId, MoonshotDef>;
export type Funding = "lean" | "full" | "crash";
export const FUNDING: Record<Funding, { cost: number; pace: number; name: string }> = {
  lean: { cost: 0.5, pace: 0.6, name: "Lean" }, full: { cost: 1, pace: 1, name: "Full" }, crash: { cost: 2, pace: 1.6, name: "Crash" },
};
export interface MoonshotState { progress: number; funding: Funding; started: number; spent: number; attempts: number }

export function startMoonshot(s: GameState, c: Company, id: MoonshotId, funding: Funding): Result {
  c.moonshots ??= {};
  if (c.perks?.includes(id)) return { ok: false, message: "You've already done that." };
  const active = Object.keys(c.moonshots).length;
  if (c.moonshots[id]) { c.moonshots[id]!.funding = funding; return { ok: true, message: `Funding set to ${FUNDING[funding].name.toLowerCase()}.` }; }
  if (active >= 2) return { ok: false, message: "Two moonshots at once is all any company can manage." };
  const m = MOONSHOT_BY_ID[id];
  if (c.cash + 0 < m.monthly * FUNDING[funding].cost * 6) return { ok: false, message: `You need at least ${fmtMoney(m.monthly * FUNDING[funding].cost * 6)} on hand: six months of funding.` };
  c.moonshots[id] = { progress: 0, funding, started: s.month, spent: 0, attempts: 0 };
  return { ok: true, message: `${m.name}: the program is under way. Expect about ${Math.round(m.months / FUNDING[funding].pace)} months.` };
}

export function cancelMoonshot(c: Company, id: MoonshotId): Result {
  if (!c.moonshots?.[id]) return { ok: false, message: "No such program." };
  delete c.moonshots[id];
  c.hype *= 0.98;
  return { ok: true, message: `You shut down the ${MOONSHOT_BY_ID[id].name.toLowerCase()} program. Investors are relieved, the team is crushed.` };
}

function runMoonshots(s: GameState, c: Company, L: Log) {
  for (const [id, st] of Object.entries(c.moonshots ?? {}) as [MoonshotId, MoonshotState][]) {
    const m = MOONSHOT_BY_ID[id];
    const f = FUNDING[st.funding];
    const cost = m.monthly * f.cost;
    c.cash -= cost;
    c.current.rdCost += cost;
    st.spent += cost;
    const pace = f.pace * (1 + 0.15 * roleFactor(c, "cto")) * (c.perks?.includes("quantum") ? 1.2 : 1) * (c.perks?.includes("agi") ? 1.4 : 1);
    st.progress += pace / m.months;
    // Milestones along the way.
    if (rand(s) < 0.035) {
      if (rand(s) < 0.55) { st.progress += 0.06; c.hype *= 1.01; L(`${c.name}'s ${m.short} team reports a breakthrough.`, "good", { headline: `${c.name} claims a breakthrough on ${m.short}`, deck: "Skeptics want to see the paper" }); }
      else { st.progress = Math.max(0, st.progress - 0.08); L(`A setback for ${c.name}'s ${m.short} program.`, "bad", { headline: `Setback for ${poss(c.name)} ${m.short} effort`, deck: "Engineers say the timeline slips" }); }
    }
    if (st.progress >= 1) {
      const odds = clamp(m.odds + 0.08 * roleFactor(c, "cto") + 0.1 * st.attempts + (st.funding === "crash" ? -0.05 : 0), 0.15, 0.92);
      if (rand(s) < odds) {
        delete c.moonshots![id];
        (c.perks ??= []).push(id);
        applyPerk(s, c, id);
        c.hype *= 1.12;
        L(`${c.name} achieved ${decap(m.name)}. ${m.payoff}.`, "good", { headline: headlineFor(c, id), deck: `After ${s.month - st.started} months and ${fmtMoney(st.spent)}, it works` });
      } else {
        st.progress = 0.45;
        st.attempts++;
        c.hype *= 0.95;
        L(`${poss(c.name)} ${m.short} prototype failed its final test. The team is going back to the drawing board.`, "bad", { headline: `${poss(c.name)} ${m.short} bid falls short`, deck: `${fmtMoney(st.spent)} in, and the prototype failed. They're trying again.` });
      }
    }
  }
}

function headlineFor(c: Company, id: MoonshotId): string {
  return {
    fusion: `${c.name} lights the first commercial fusion reactor`,
    autonomy: `${poss(c.name)} cars now drive themselves, everywhere`,
    quantum: `${c.name} unveils a working quantum computer`,
    humanoids: `${poss(c.name)} humanoid robots go to work`,
    cure: `${c.name} announces a cure for Alzheimer's`,
    agi: `${c.name} says it has built a general intelligence`,
    mars: `${poss(c.name)} crew walks on Mars`,
  }[id];
}

function applyPerk(s: GameState, c: Company, id: MoonshotId) {
  const up = (t: TechId, n: number) => { c.tech[t] = (c.tech[t] ?? s.baselineTech[t] ?? 0) + n; };
  if (id === "autonomy") { up("auto", 4); up("software", 1); }
  if (id === "cure") { up("biotech", 5); c.image = clamp(c.image + 0.12, 0, 1); }
  if (id === "agi") { up("ai", 5); up("software", 5); up("cloud", 3); }
  if (id === "mars") { up("aero", 5); c.image = clamp(c.image + 0.12, 0, 1); for (const g of Object.keys(c.brand) as GoodId[]) c.brand[g] = (c.brand[g] ?? 0) * 1.2; }
  if (id === "humanoids") for (const j of BLUE_COLLAR) c.jobOpinion[j] = clamp((c.jobOpinion[j] ?? 0.5) - 0.15, 0, 1);
}


const c_name = (c: Company) => c.name;
const decap = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x);
const poss = (n: string) => (n.endsWith("s") ? `${n}'` : `${n}'s`);

// ---------------------------------------------------------------- product launches

export function launchCost(c: Company, g: GoodId): number {
  const monthly = c.history.slice(-3).reduce((a, h) => a + (h.revenueByGood[g] ?? 0), 0) / 3;
  return Math.max(5e6, Math.min(250e6, monthly * 0.05));
}

export function holdLaunch(s: GameState, c: Company, g: GoodId, bold: boolean): Result & { headline?: string } {
  c.launches ??= {};
  if (c.launches[g] !== undefined && s.month - c.launches[g]! < 9) return { ok: false, message: `You launched ${lowerName(GOOD_BY_ID[g].name)} ${s.month - c.launches[g]!} months ago. Give it time.` };
  const cost = launchCost(c, g);
  if (c.cash < cost) return { ok: false, message: `A launch event costs ${fmtMoney(cost)}.` };
  c.cash -= cost;
  c.current.marketing += cost;
  c.launches[g] = s.month;
  const q = quality(s, c, g);
  const score = Math.log(q) * 8 + 0.25 * roleFactor(c, "cmo") + 0.2 * roleFactor(c, "ceo") + (hasTrait(c, "celebrity") ? 0.25 : 0) + (rand(s) - 0.5) * (bold ? 1.6 : 0.9) + 0.1;
  const name = lowerName(GOOD_BY_ID[g].name);
  const ceo = ceoOf(c);
  if (score > 0) {
    const k = bold ? 1.7 : 1.35;
    c.brand[g] = (c.brand[g] ?? 0) * k + 0.003;
    c.reputation[g] = Math.min(2, (c.reputation[g] ?? 1) + (bold ? 0.08 : 0.05));
    c.hype *= bold ? 1.06 : 1.03;
    const headline = score > 0.6 ? `Lines around the block for ${poss(c.name)} new ${name}` : `${c.name} unveils new ${name} to warm reviews`;
    log(s, `${c.name} launched its new ${name}.`, "good", c.id, "news", { headline, deck: bold ? "The keynote promised a lot, and delivered" : "A confident, careful reveal" });
    return { ok: true, message: `${ceo?.name ?? "Your CEO"} took the stage and the crowd loved it. Brand and reputation up.`, headline };
  }
  c.brand[g] = (c.brand[g] ?? 0) * (bold ? 0.85 : 0.93);
  c.reputation[g] = Math.max(0.3, (c.reputation[g] ?? 1) - (bold ? 0.07 : 0.03));
  c.hype *= bold ? 0.93 : 0.98;
  log(s, `${poss(c.name)} ${name} launch disappointed.`, "bad", c.id, "news", { headline: bold ? `${poss(c.name)} ${name} demo crashes on stage` : `Reviewers shrug at ${poss(c.name)} new ${name}`, deck: bold ? "The keynote overpromised" : "More of the same, critics say" });
  return { ok: true, message: bold ? "The keynote promised the moon and the demo crashed on stage. Ouch." : "The launch was a shrug. Reviewers called it more of the same.", headline: bold ? `${poss(c.name)} ${name} demo crashes on stage` : `Reviewers shrug at ${poss(c.name)} new ${name}` };
}

// ---------------------------------------------------------------- CEO posts

export type PostKind = "hype" | "thanks" | "dunk";
const HYPE_POSTS = ["Next year is going to be the biggest in our history. Not close.", "What our team is building right now will make today's products look like toys.", "Can't say much yet. But wow.", "Every analyst who doubted us is about to have a very long year."];
const THANKS_POSTS = ["Visited our {city} site today. These people are the company. Thank you.", "Record quarter, and it belongs to the folks on the line and in the stores.", "Proud of every one of our people. Bonuses going out this week.", "Shout-out to the night shift in {city}."];
const DUNK_POSTS = ["Interesting strategy from {rival}. Bold of them to try it again.", "Somebody please check on {rival}'s product team.", "Imitation is the sincerest form of flattery. Thanks, {rival}.", "{rival} announced a roadmap today. We shipped ours last year."];

export function ceoPost(s: GameState, c: Company, kind: PostKind): Result & { text?: string } {
  const ceo = ceoOf(c);
  if (!ceo) return { ok: false, message: "You have no CEO to post." };
  if (c.lastPost !== undefined && c.lastPost === s.month) return { ok: false, message: "Your comms team has taken away the CEO's phone until next month." };
  c.lastPost = s.month;
  const showman = ceo.traits.includes("celebrity") || ceo.traits.includes("visionary");
  const site = c.buildings.find((b) => b.type !== "hq" && b.type !== "rnd" && b.level > 0);
  const cityName = site ? s.cities[site.city]?.name ?? "Ohio" : "Ohio";
  let text = "", msg = "";
  if (kind === "hype") {
    text = pick(s, HYPE_POSTS);
    if (rand(s) < (ceo.traits.includes("scandal_prone") ? 0.25 : 0.1)) {
      c.hype *= 0.96; c.image = clamp(c.image - 0.03, 0, 1);
      if (c.leadership) c.leadership.board.confidence = clamp(c.leadership.board.confidence - 0.05, 0, 1);
      msg = "The SEC sent a letter asking about forward-looking statements. The stock slipped.";
    } else { const k = showman ? 1.04 : 1.015; c.hype *= k; msg = `The post went ${showman ? "viral" : "around Wall Street"}; the stock ticked up.`; }
  } else if (kind === "thanks") {
    text = pick(s, THANKS_POSTS).replace("{city}", cityName);
    for (const j of BLUE_COLLAR) c.jobOpinion[j] = clamp((c.jobOpinion[j] ?? 0.5) + 0.02, 0, 1);
    c.image = clamp(c.image + 0.01, 0, 1);
    msg = "Workers noticed. So did the press.";
  } else {
    const rivals = s.companies.filter((o) => o.alive && !o.isPlayer && Object.keys(o.prices).some((g) => c.prices[g as GoodId])).sort((a, b) => b.marketCap - a.marketCap);
    const r = rivals[0];
    if (!r) return { ok: false, message: "No rival worth dunking on." };
    text = pick(s, DUNK_POSTS).replace("{rival}", r.name);
    const rc = ceoOf(r);
    if (rc) { rc.regard ??= { score: 0, why: {} }; rc.regard.why.jab = clamp((rc.regard.why.jab ?? 0) - 15, -50, 50); }
    relationWith(s, r.id).truceUntil = undefined;
    if (showman || rand(s) < 0.4) { c.hype *= 1.02; msg = `The dunk on ${r.name} went viral. ${rc?.name ?? "Their CEO"} is furious.`; }
    else { c.image = clamp(c.image - 0.015, 0, 1); msg = `The dunk on ${r.name} came off petty.`; }
  }
  (c.posts ??= []).unshift({ month: s.month, text });
  c.posts = c.posts.slice(0, 8);
  return { ok: true, message: msg, text };
}

// ---------------------------------------------------------------- second headquarters contest

export interface Hq2 { startMonth: number; endMonth: number; bids: { city: string; amount: number }[]; done?: string }

export function startHq2(s: GameState, c: Company): Result {
  if (c.marketCap < 150e9) return { ok: false, message: "Only companies worth $150 billion or more can make cities fight over them." };
  if (c.hq2 && !c.hq2.done) return { ok: false, message: "The contest is already running." };
  if (c.hq2?.done) return { ok: false, message: `You already built your second headquarters in ${s.cities[c.hq2.done]?.name}.` };
  c.hq2 = { startMonth: s.month, endMonth: s.month + 3, bids: [] };
  return { ok: true, message: "You announced a search for a second headquarters: 5,000 jobs to the best offer. Cities have three months to bid." };
}

function runHq2(s: GameState, c: Company, L: Log) {
  const h = c.hq2;
  if (!h || h.done) return;
  const metros = Object.values(s.cities).filter((x) => !x.rest && !x.foreign && x.id !== c.hqSite.city);
  // A few cities bid each month.
  for (let i = 0; i < 4; i++) {
    const city = pick(s, metros);
    if (h.bids.some((b) => b.city === city.id)) continue;
    const pop = (STATE_BY_CODE[city.state]?.population ?? 1e6) * city.share;
    const amount = Math.round((0.4e9 + rand(s) * 2.5e9) * (0.6 + city.lib * 0.6 + (city.opinion[c.id] ?? 0.5) * 0.6) * clamp(Math.sqrt(pop / 2e6), 0.5, 1.6) / 1e7) * 1e7;
    h.bids.push({ city: city.id, amount });
  }
  h.bids.sort((a, b) => b.amount - a.amount);
  const top = h.bids[0];
  if (top && s.month < h.endMonth) L(`${s.cities[top.city]?.name} leads the race for ${poss(c.name)} second headquarters with ${fmtMoney(top.amount)} in incentives.`, "info", { headline: `${s.cities[top.city]?.name} offers ${fmtMoney(top.amount)} for ${poss(c.name)} HQ2`, deck: `${h.bids.length} cities are in the running` });
  if (s.month >= h.endMonth && !(s.decisions ?? []).some((d) => d.kind === "hq2_pick")) {
    const finalists = h.bids.slice(0, 4);
    (s.decisions ??= []).push({
      id: s.nextId++, kind: "hq2_pick", companyId: c.id, deadlineDay: s.day + 30,
      headline: `Pick your second headquarters`,
      deck: `${h.bids.length} cities bid. These are the finalists.`,
      options: finalists.map((b) => ({ id: b.city, label: `${s.cities[b.city]?.name}, ${s.cities[b.city]?.state}`, detail: `${fmtMoney(b.amount)} in incentives` })),
      data: { n: finalists.length },
    });
    L(`The finalists for your second headquarters are in.`, "info", { headline: `Pick your second headquarters`, deck: finalists.map((b) => s.cities[b.city]?.name).join(", ") });
  }
}

export function pickHq2(s: GameState, c: Company, cityId: string): string {
  const h = c.hq2;
  const bid = h?.bids.find((b) => b.city === cityId);
  const city = s.cities[cityId];
  if (!h || !bid || !city) return "The contest has ended.";
  h.done = cityId;
  c.cash += bid.amount;
  addBuilding(s, c, "hq", cityId, 5);
  city.opinion[c.id] = clamp((city.opinion[c.id] ?? 0.5) + 0.3, 0, 1);
  for (const b of h.bids.slice(0, 4)) if (b.city !== cityId && s.cities[b.city]) s.cities[b.city].opinion[c.id] = clamp((s.cities[b.city].opinion[c.id] ?? 0.5) - 0.06, 0, 1);
  for (const p of s.politicians) if (p.state === city.state) { p.regard ??= { score: 0, why: {} }; p.regard.why.opening = clamp((p.regard.why.opening ?? 0) + 18, -40, 40); }
  return `${city.name} wins. ${fmtMoney(bid.amount)} in incentives, and five levels of headquarters there.`;
}

// ---------------------------------------------------------------- espionage

export function espionage(s: GameState, me: Company, rivalId: number): Result {
  const r = s.companies.find((x) => x.id === rivalId);
  if (!r) return { ok: false, message: "No such company." };
  if (me.lastSpy !== undefined && s.month - me.lastSpy < 12) return { ok: false, message: "Your security chief refuses to try again so soon." };
  const lead = TECHS.map((t) => ({ t: t.id, d: (r.tech[t.id] ?? 0) - (me.tech[t.id] ?? 0) })).filter((x) => x.d > 0.3).sort((a, b) => b.d - a.d)[0];
  if (!lead) return { ok: false, message: `${r.name} has nothing you don't already know.` };
  me.lastSpy = s.month;
  const ceo = ceoOf(r);
  if (rand(s) < 0.55) {
    const gain = Math.min(1.5, lead.d * 0.5);
    me.tech[lead.t] = (me.tech[lead.t] ?? 0) + gain;
    return { ok: true, message: `A former ${r.name} engineer brought a thumb drive. ${TECHS.find((t) => t.id === lead.t)!.name} +${gain.toFixed(1)} levels. Nobody needs to know.` };
  }
  const fine = Math.max(50e6, annualRev(me) * 0.01);
  me.cash -= fine;
  me.image = clamp(me.image - 0.07, 0, 1);
  me.hype *= 0.96;
  if (me.leadership) me.leadership.board.confidence = clamp(me.leadership.board.confidence - 0.1, 0, 1);
  if (ceo) { ceo.regard ??= { score: 0, why: {} }; ceo.regard.why.poach = clamp((ceo.regard.why.poach ?? 0) - 45, -45, 45); }
  for (const p of s.politicians) { p.regard ??= { score: 0, why: {} }; p.regard.why.image = (p.regard.why.image ?? 0) - 4; }
  log(s, `${c_name(me)} was caught stealing trade secrets from ${r.name}.`, "bad", me.id, "news", { headline: `${me.name} caught spying on ${r.name}`, deck: `A ${fmtMoney(fine)} settlement and a lot of explaining to do` });
  return { ok: false, message: `Caught. ${r.name} sued, and you settled for ${fmtMoney(fine)}. It's all over the news.` };
}

// ---------------------------------------------------------------- monthly

export function updateFun(s: GameState, L: (c: Company) => Log, warm: boolean) {
  for (const c of s.companies) {
    if (!c.alive) continue;
    const log = L(c);
    if (c.moonshots) runMoonshots(s, c, c.isPlayer || c.marketCap > 300e9 ? log : () => undefined);
    if (c.isPlayer) runHq2(s, c, log);
    // Meme-stock manias end the way they always do.
    if (c.meme && s.month >= c.meme.until) {
      c.hype = Math.max(0.3, c.hype / c.meme.mult * 0.85);
      c.marketCap /= c.meme.mult * 1.1;
      if (c.isPlayer || c.marketCap > 1e9) log(`The meme rally in ${c.name} is over. Shares gave back the gains, and then some.`, "bad", { headline: `${c.name} shares crash back to earth`, deck: "The retail traders have moved on" });
      c.meme = undefined;
    }
  }
  if (warm) return;
  // The richest rivals take moonshots too.
  for (const c of s.companies) {
    if (!c.alive || c.isPlayer || c.marketCap < 800e9 || c.cash < 80e9 || Object.keys(c.moonshots ?? {}).length || rand(s) > 0.006) continue;
    const options = MOONSHOTS.filter((m) => !c.perks?.includes(m.id));
    if (!options.length) continue;
    const m = pick(s, options);
    (c.moonshots ??= {})[m.id] = { progress: 0, funding: "full", started: s.month, spent: 0, attempts: 0 };
    L(c)(`${c.name} announced a moonshot: ${decap(m.name)}.`, "info", { headline: `${c.name} bets big on ${decap(m.name)}`, deck: `${fmtMoney(m.monthly * 12)} a year, for as long as it takes` });
  }
  // Super Bowl: decide in January.
  const me = s.companies.find((c) => c.isPlayer);
  if (me && me.alive && ((s.month % 12) + 12) % 12 === 0 && me.marketCap > 10e9 && Object.keys(me.prices).some((g) => NEED_OF_GOOD[g as GoodId])) {
    const cost = 8e6 + Math.min(25e6, me.marketCap / 1e11 * 2e6);
    (s.decisions ??= []).push({
      id: s.nextId++, kind: "superbowl", companyId: me.id, deadlineDay: s.day + 30,
      headline: "A Super Bowl spot is available", deck: `Thirty seconds in front of 120 million people. About ${fmtMoney(cost)} with production.`,
      options: [
        { id: "funny", label: "Go funny", detail: "Big upside, or forgotten by halftime" },
        { id: "heart", label: "Pull at the heartstrings", detail: "Safer; helps your public image" },
        { id: "celeb", label: "Hire a celebrity", detail: `Costs ${fmtMoney(cost * 2.5)}; reliable buzz` },
        { id: "skip", label: "Sit this one out", detail: "Save the money" },
      ],
      data: { cost },
    });
  }
  // A meme-stock mania hits a small company now and then.
  if (rand(s) < 0.03) {
    const pool = s.companies.filter((c) => c.alive && c.marketCap < 8e9 && c.marketCap > 50e6 && !c.meme);
    if (pool.length) {
      const c = pick(s, pool);
      const mult = 2 + rand(s) * 3;
      c.meme = { until: s.month + 2 + Math.floor(rand(s) * 3), mult };
      c.hype *= mult; c.marketCap *= mult;
      const log = L(c);
      log(`Retail traders piled into ${c.name}. Shares are up ${Math.round((mult - 1) * 100)}%.`, "good", { headline: `${c.name} becomes the internet's favorite stock`, deck: `Shares up ${Math.round((mult - 1) * 100)}% on no news at all` });
    }
  }
}

export function applyFunDecision(s: GameState, c: Company, kind: string, opt: string, data: Record<string, string | number>, L: Log): string {
  if (kind === "hq2_pick") {
    const msg = pickHq2(s, c, opt);
    const city = s.cities[opt];
    if (city) L(msg, "good", { headline: `${city.name} lands ${poss(c.name)} second headquarters`, deck: "Five thousand jobs and a new skyline" });
    return msg;
  }
  if (kind === "superbowl") {
    if (opt === "skip") return "You watched the game like everyone else.";
    const cost = Number(data.cost) * (opt === "celeb" ? 2.5 : 1);
    c.cash -= cost;
    c.current.marketing += cost;
    const roll = rand(s) + 0.12 * roleFactor(c, "cmo") + (opt === "celeb" ? 0.2 : opt === "heart" ? 0.08 : 0);
    const consumer = (Object.keys(c.prices) as GoodId[]).filter((g) => NEED_OF_GOOD[g]);
    const boost = roll > (opt === "funny" ? 0.75 : 0.85) ? 1.35 : roll > 0.4 ? 1.12 : 1.0;
    for (const g of consumer) c.brand[g] = (c.brand[g] ?? 0) * boost;
    if (opt === "heart") c.image = clamp(c.image + 0.03, 0, 1);
    if (boost > 1.3) { c.hype *= 1.02; L(`${poss(c.name)} Super Bowl ad was the talk of the night.`, "good", { headline: `Viewers crown ${poss(c.name)} ad the best of the Super Bowl`, deck: "Everybody's quoting it Monday morning" }); return "A hit. Everyone's talking about it."; }
    if (boost > 1.05) return "A solid spot. Nobody's talking about it, but plenty of people saw it.";
    if (opt === "funny" && rand(s) < 0.35) { c.image = clamp(c.image - 0.03, 0, 1); L(`${poss(c.name)} Super Bowl ad offended half the country.`, "bad", { headline: `${poss(c.name)} Super Bowl ad sparks a backlash`, deck: "The joke did not land" }); return "The joke didn't land. There's a backlash."; }
    return "Forgotten by halftime.";
  }
  return "";
}

export { ROLE_SHORT };
