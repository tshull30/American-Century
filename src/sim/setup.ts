// Game setup: scenarios, difficulty and goals.
import { beginEvent } from "./macro";
import type { LawId } from "./data/laws";
import type { Company, GameEvent, GameState } from "./types";
import { fmtMoney } from "./util";
import { tierOf } from "./tiers";

export type ScenarioId = "standard" | "chip_war" | "hard_landing" | "green_rush" | "trust_busters" | "ai_gold_rush" | "tariff_wall";
export type DifficultyId = "easy" | "normal" | "hard";
export type GoalId = "sandbox" | "titan" | "top_dog" | "employer" | "unicorn" | "profit" | "turnaround" | "double" | "decacorn";
export type ModeId = "standard" | "turnaround" | "dynasty" | "unicorn";

export interface ScenarioDef { id: ScenarioId; name: string; dateline: string; blurb: string }
export const SCENARIOS: ScenarioDef[] = [
  { id: "standard", name: "Business as usual", dateline: "January 2026", blurb: "The economy as it stands: a slow-growing expansion, an AI boom and a divided Congress." },
  { id: "chip_war", name: "The chip war", dateline: "Taiwan Strait, January 2026", blurb: "A blockade around Taiwan chokes the world's chip supply, and Washington raises tariffs. Whoever can make chips in America is king." },
  { id: "hard_landing", name: "Hard landing", dateline: "Wall Street, January 2026", blurb: "The market just crashed, the Fed raised rates again, and a recession is under way. Cash is everything." },
  { id: "green_rush", name: "The green rush", dateline: "Washington, January 2026", blurb: "A climate law and big clean-energy subsidies just passed. Solar, wind, batteries and EVs are suddenly the place to be; coal and oil are on the defensive." },
  { id: "trust_busters", name: "The trust-busters", dateline: "Washington, January 2026", blurb: "Antitrust enforcers are at full strength and privacy rules are tight. Big companies can't buy their way to growth." },
  { id: "ai_gold_rush", name: "AI gold rush", dateline: "Silicon Valley, January 2026", blurb: "AI spending goes vertical. Chips, cloud and data centers can't be built fast enough, and the grid is groaning." },
  { id: "tariff_wall", name: "Tariff wall", dateline: "Washington, January 2026", blurb: "Tariffs at their highest in a century. Imports are dear, American factories are back in fashion, and the rest of the world is angry." },
];
const SCENARIO_HEADLINE: Record<ScenarioId, string> = {
  standard: "", chip_war: "Blockade around Taiwan; chip shipments halt", hard_landing: "Stocks crash as the Fed tightens again",
  green_rush: "Congress passes sweeping climate law", trust_busters: "Washington declares war on monopolies",
  ai_gold_rush: "AI spending hits a trillion dollars a year", tariff_wall: "Tariffs hit a hundred-year high",
};
export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((x) => [x.id, x])) as Record<ScenarioId, ScenarioDef>;

export interface DifficultyDef { id: DifficultyId; name: string; blurb: string }
export const DIFFICULTIES: DifficultyDef[] = [
  { id: "easy", name: "Chairman", blurb: "More money to start, a patient board and generous analysts." },
  { id: "normal", name: "Chief executive", blurb: "The game as designed." },
  { id: "hard", name: "Activist season", blurb: "Less money, demanding analysts, a twitchy board and sharper rivals." },
];

export interface GoalDef { id: GoalId; name: string; detail: string; deadline?: number; test?: (s: GameState, c: Company) => boolean; progress?: (s: GameState, c: Company) => string }
const emp = (c: Company) => Object.values(c.employees).reduce((a, b) => a + b, 0);
const ttmNI = (c: Company) => c.history.slice(-12).reduce((a, h) => a + h.netIncome, 0);
export const GOALS: GoalDef[] = [
  { id: "sandbox", name: "No goal", detail: "Play as long as you like." },
  { id: "unicorn", name: "Make it big", detail: "Reach a $10 billion market value by January 2031", deadline: 60, test: (_s, c) => c.marketCap >= 10e9, progress: (_s, c) => `${fmtMoney(c.marketCap)} of $10.0B` },
  { id: "titan", name: "Become a Titan", detail: "Reach the Titan tier by January 2036", deadline: 120, test: (_s, c) => tierOf(c.marketCap).id === "titan", progress: (_s, c) => `${tierOf(c.marketCap).name} now` },
  { id: "top_dog", name: "Top dog", detail: "Be America's most valuable company by January 2036", deadline: 120,
    test: (s, c) => s.companies.every((o) => !o.alive || o === c || o.marketCap < c.marketCap),
    progress: (s, c) => `#${s.companies.filter((o) => o.alive).sort((a, b) => b.marketCap - a.marketCap).findIndex((o) => o === c) + 1} by market value` },
  { id: "employer", name: "America's employer", detail: "Employ 1,000,000 people by January 2040", deadline: 168, test: (_s, c) => emp(c) >= 1e6, progress: (_s, c) => `${Math.round(emp(c)).toLocaleString("en-US")} of 1,000,000` },
  { id: "turnaround", name: "Turn it around", detail: "Get back to an investment-grade credit rating with a profitable year by January 2030", deadline: 48,
    test: (_s, c) => !!c.rating && ["AAA", "AA", "A", "BBB"].includes(c.rating) && ttmNI(c) > 0, progress: (_s, c) => `Rated ${c.rating ?? "unrated"}; ${fmtMoney(ttmNI(c))} profit over 12 months` },
  { id: "double", name: "Double the fortune", detail: "Double the company's market value by January 2036", deadline: 120,
    test: (s, c) => c.marketCap >= (s.setup?.startCap ?? Infinity) * 2, progress: (s, c) => `${fmtMoney(c.marketCap)} of ${fmtMoney((s.setup?.startCap ?? 0) * 2)}` },
  { id: "decacorn", name: "Hundred-billion unicorn", detail: "Reach a $100 billion market value by January 2034", deadline: 96, test: (_s, c) => c.marketCap >= 100e9, progress: (_s, c) => `${fmtMoney(c.marketCap)} of $100.0B` },
  { id: "profit", name: "Money machine", detail: "Earn $200 billion in a year by January 2036", deadline: 120, test: (_s, c) => ttmNI(c) >= 200e9, progress: (_s, c) => `${fmtMoney(ttmNI(c))} over the last 12 months` },
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map((x) => [x.id, x])) as Record<GoalId, GoalDef>;

export interface Setup { scenario: ScenarioId; difficulty: DifficultyId; goal: GoalId; mode?: ModeId; startCap?: number; result?: "won" | "lost"; resultMonth?: number }

export const MODES: Record<ModeId, { name: string; blurb: string; for: "found" | "takeover" | "both" }> = {
  standard: { name: "As it is", blurb: "The company as you find it.", for: "both" },
  turnaround: { name: "Turnaround", blurb: "The company is in trouble: almost no cash, heavy debt and a junk rating, an angry board, an activist fund and a battered reputation. Save it.", for: "takeover" },
  dynasty: { name: "Dynasty heir", blurb: "Your family controls the board. Nobody can fire you and activists can't win, but the family expects at least 30% of profits as dividends.", for: "takeover" },
  unicorn: { name: "Unicorn", blurb: "A billion dollars of venture money and a $5 billion valuation before you've sold a thing. The investors on your board are not patient.", for: "found" },
};

/** Applied right after the warm-up year, before the player's first day. */
export function applySetup(s: GameState, setup: Setup) {
  s.setup = { ...setup };
  const me = s.companies.find((c) => c.isPlayer)!;
  applyMode(s, me, setup.mode ?? "standard");
  s.setup.startCap = me.marketCap;
  // Difficulty.
  if (setup.difficulty === "easy") {
    me.cash *= me.kind === "startup" ? 2 : 1.25;
    if (me.leadership) me.leadership.board.confidence = Math.min(0.95, me.leadership.board.confidence + 0.15);
  } else if (setup.difficulty === "hard") {
    me.cash *= me.kind === "startup" ? 0.6 : 0.8;
    for (const c of s.companies) if (!c.isPlayer) c.costEdge = 0.96;
    if (me.leadership) me.leadership.board.confidence = Math.max(0.3, me.leadership.board.confidence - 0.1);
  }
  if (setup.scenario !== "standard") {
    const sc = SCENARIO_BY_ID[setup.scenario];
    s.events.push({ day: s.day, text: `${sc.name}: ${sc.blurb}`, kind: "info", tag: "macro", headline: SCENARIO_HEADLINE[setup.scenario], deck: sc.blurb });
    (s.archive ??= []).push({ day: s.day, headline: SCENARIO_HEADLINE[setup.scenario], deck: sc.blurb, kind: "info" });
  }
  const laws = (o: Partial<Record<LawId, number>>) => { for (const [k, v] of Object.entries(o)) s.politics.laws[k as LawId] = v; };
  switch (setup.scenario) {
    case "chip_war": beginEvent(s, "strait_crisis", undefined, 10); beginEvent(s, "chip_shortage", undefined, 12); laws({ tariffs: 2, industrial_policy: 2 }); break;
    case "hard_landing":
      beginEvent(s, "market_crash", undefined, 6);
      for (const c of s.companies) { c.hype *= 0.8; c.marketCap *= 0.82; }
      s.macro.gap -= 0.035; s.baseRate += 0.01; s.macro.fedRate += 0.01; s.macro.recession = true; break;
    case "green_rush": laws({ climate: 2, industrial_policy: 2 }); break;
    case "trust_busters": laws({ antitrust: 2, data_privacy: 2 }); break;
    case "ai_gold_rush":
      beginEvent(s, "ai_frenzy", undefined, 18);
      for (const c of s.companies) if (Object.keys(c.prices).some((g) => ["ai_accelerators", "cloud", "chips", "data_platforms"].includes(g))) { c.hype *= 1.15; c.marketCap *= 1.12; }
      break;
    case "tariff_wall": laws({ tariffs: 3 }); break;
  }
}

/** Analysts are kinder on easy and harsher on hard. */
export function difficultyShade(s: GameState, c: Company): number {
  if (!c.isPlayer) return 1;
  return s.setup?.difficulty === "easy" ? 0.97 : s.setup?.difficulty === "hard" ? 1.02 : 1;
}

export function checkGoal(s: GameState, c: Company, log: (text: string, kind: GameEvent["kind"], extra: Pick<GameEvent, "headline" | "deck">) => void) {
  const st = s.setup;
  if (!st || st.result || st.goal === "sandbox") return;
  const g = GOAL_BY_ID[st.goal];
  if (g.test?.(s, c)) {
    st.result = "won"; st.resultMonth = s.month;
    log(`Goal reached: ${g.detail}.`, "good", { headline: `${c.name} has done it`, deck: `${g.name}: ${g.detail.replace(/ by .*$/, "")}. You can keep playing.` });
  } else if (g.deadline !== undefined && s.month >= g.deadline) {
    st.result = "lost"; st.resultMonth = s.month;
    log(`Goal missed: ${g.detail}.`, "bad", { headline: `${c.name} falls short`, deck: `The deadline passed. ${g.progress?.(s, c) ?? ""}. You can keep playing.` });
  }
}

function applyMode(s: GameState, me: Company, mode: ModeId) {
  const b = me.leadership?.board;
  if (mode === "turnaround") {
    me.hype *= 0.55; me.marketCap *= 0.55;
    me.cash *= 0.12;
    const e = me.history.slice(-12).reduce((a, h) => a + h.revenue - h.inputCosts - h.wages - h.rdCost - h.sgaCost - h.marketing, 0);
    // Leveraged to about 3.2 times earnings: junk, but survivable with work.
    me.debt = Math.max(me.debt, Math.max(0, e) * 3.2 + me.cash);
    me.dividendPct = 0;
    me.image = 0.35;
    for (const g of Object.keys(me.brand)) me.brand[g as keyof typeof me.brand] = (me.brand[g as keyof typeof me.brand] ?? 0) * 0.7;
    if (b) {
      b.confidence = 0.35;
      b.activist = { fund: "Third Rail Capital", stake: 0.07, demand: "cut_costs", startMonth: s.month, startCeo: me.leadership!.execs.find((e) => e.role === "ceo")?.id ?? 0, buybackTarget: me.marketCap * 0.05, boughtBack: 0 };
    }
  } else if (mode === "dynasty") {
    if (b) { for (const d of b.members) { d.kind = d.kind === "independent" ? "founder" : d.kind; d.loyalty = 0.95; } b.confidence = 0.85; }
    me.dividendPct = Math.max(me.dividendPct, 0.3);
  } else if (mode === "unicorn" && me.kind === "startup") {
    me.cash = 1e9;
    me.marketCap = 5e9; me.valuationTarget = 5e9; me.ventureFloor = 5e9;
    if (b) { for (const d of b.members) d.loyalty = Math.min(d.loyalty, 0.35); b.confidence = 0.55; }
  }
}

export const isDynasty = (s: GameState, c: Company) => c.isPlayer && s.setup?.mode === "dynasty";
