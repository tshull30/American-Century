// Milestones: things worth a front page when the player gets there first.
import type { Company, GameEvent, GameState } from "./types";
import { BUILDING_BY_ID } from "./data/buildings";
import { activePartners } from "./people";
import { fmtMoney } from "./util";

export interface Milestone { id: string; name: string; detail: string; test: (s: GameState, c: Company) => boolean; headline: (c: Company) => string }

const ttm = (c: Company, k: "revenue" | "netIncome") => c.history.slice(-12).reduce((a, h) => a + h[k], 0);
const qni = (c: Company) => c.history.slice(-3).reduce((a, h) => a + h.netIncome, 0);
const emp = (c: Company) => Object.values(c.employees).reduce((a, b) => a + b, 0);
const states = (s: GameState, c: Company) => new Set(c.buildings.filter((b) => b.level > 0).map((b) => s.cities[b.city]).filter((x) => x && !x.foreign).map((x) => x!.state));
const countries = (s: GameState, c: Company) => new Set(c.buildings.filter((b) => b.level > 0).map((b) => s.cities[b.city]).filter((x) => x?.foreign).map((x) => x!.state));
const sectors = (c: Company) => new Set(c.buildings.filter((b) => b.level > 0).map((b) => BUILDING_BY_ID[b.type].sector).filter(Boolean));

export const MILESTONES: Milestone[] = [
  { id: "profit_q1b", name: "Billion-dollar quarter", detail: "Earn $1 billion in a quarter", test: (_s, c) => qni(c) >= 1e9, headline: (c) => `${c.name} posts its first billion-dollar quarter` },
  { id: "profit_q10b", name: "Ten-billion-dollar quarter", detail: "Earn $10 billion in a quarter", test: (_s, c) => qni(c) >= 10e9, headline: (c) => `${c.name} earns $10 billion in a single quarter` },
  { id: "mcap_100b", name: "Hundred-billion club", detail: "Reach a $100 billion market value", test: (_s, c) => c.marketCap >= 100e9, headline: (c) => `${c.name} joins the $100 billion club` },
  { id: "mcap_1t", name: "Trillion-dollar company", detail: "Reach a $1 trillion market value", test: (_s, c) => c.marketCap >= 1e12, headline: (c) => `${c.name} is now worth a trillion dollars` },
  { id: "mcap_5t", name: "Five trillion", detail: "Reach a $5 trillion market value", test: (_s, c) => c.marketCap >= 5e12, headline: (c) => `${c.name} crosses $5 trillion` },
  { id: "mcap_10t", name: "Ten trillion", detail: "Reach a $10 trillion market value", test: (_s, c) => c.marketCap >= 10e12, headline: (c) => `${c.name} is the first $10 trillion company` },
  { id: "number_one", name: "Most valuable company in America", detail: "Be number one by market value", test: (s, c) => s.companies.every((o) => !o.alive || o === c || o.marketCap < c.marketCap), headline: (c) => `${c.name} is now America's most valuable company` },
  { id: "rev_100b", name: "Fortune giant", detail: "$100 billion in annual revenue", test: (_s, c) => ttm(c, "revenue") >= 100e9, headline: (c) => `${c.name} tops $100 billion in annual sales` },
  { id: "rev_1t", name: "Trillion in sales", detail: "$1 trillion in annual revenue", test: (_s, c) => ttm(c, "revenue") >= 1e12, headline: (c) => `${c.name} books a trillion dollars in a year` },
  { id: "emp_100k", name: "Hundred thousand strong", detail: "Employ 100,000 people", test: (_s, c) => emp(c) >= 100_000, headline: (c) => `${c.name} now employs 100,000 people` },
  { id: "emp_1m", name: "A million paychecks", detail: "Employ 1,000,000 people", test: (_s, c) => emp(c) >= 1_000_000, headline: (c) => `${c.name} becomes a million-worker employer` },
  { id: "monopoly", name: "Half the market", detail: "Hold 50% of any market", test: (s, c) => Object.values(s.markets).some((m) => (m?.sales[c.id]?.share ?? 0) >= 0.5), headline: (c) => `${c.name} now controls half its market` },
  { id: "states_25", name: "Coast to coast", detail: "Operate in 25 states", test: (s, c) => states(s, c).size >= 25, headline: (c) => `${c.name} now operates in 25 states` },
  { id: "states_50", name: "All fifty", detail: "Operate in every state", test: (s, c) => states(s, c).size >= 50, headline: (c) => `${c.name} has a site in every state` },
  { id: "global", name: "Global footprint", detail: "Operate in five countries outside the US", test: (s, c) => countries(s, c).size >= 5, headline: (c) => `${c.name} goes global` },
  { id: "conglomerate", name: "Conglomerate", detail: "Operate in six industries", test: (_s, c) => sectors(c).size >= 6, headline: (c) => `${c.name} is a conglomerate now` },
  { id: "friends_dc", name: "Friends in Washington", detail: "25 members of Congress think highly of you", test: (s) => s.politicians.filter((p) => (p.regard?.score ?? 0) > 50).length >= 25, headline: (c) => `${c.name} has become a Washington power` },
  { id: "enemy_dc", name: "Public enemy", detail: "40 members of Congress can't stand you", test: (s) => s.politicians.filter((p) => (p.regard?.score ?? 0) < -50).length >= 40, headline: (c) => `${c.name} is Capitol Hill's favorite villain` },
  { id: "alliances", name: "Alliance builder", detail: "Run three partnerships at once", test: (s) => activePartners(s).length >= 3, headline: (c) => `${c.name} builds a web of alliances` },
  { id: "fortress", name: "Fortress balance sheet", detail: "No debt and $50 billion in cash", test: (_s, c) => c.debt < 1e6 && c.cash >= 50e9, headline: (c) => `${c.name} is debt-free with ${fmtMoney(c.cash)} in the bank` },
];

export function checkMilestones(s: GameState, c: Company, log: (text: string, extra: Pick<GameEvent, "headline" | "deck">) => void) {
  const first = !s.milestones;
  const got = (s.milestones ??= {});
  for (const m of MILESTONES) {
    if (got[m.id] !== undefined || !m.test(s, c)) continue;
    got[m.id] = first ? -1 : s.month;
    if (!first) log(`Milestone: ${m.name}. ${m.detail}.`, { headline: m.headline(c), deck: `Milestone reached: ${m.name}` });
  }
}
