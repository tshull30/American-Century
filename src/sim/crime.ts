// The back room: fraud, tax dodges, cartels, wage theft, rigged tests, bribes and smears.
// Every scheme pays off now and builds "exposure". Exposure draws investigators; investigations
// end in fines, fired executives, perp walks or, at worst, the end of the company.
import { GOOD_BY_ID, type GoodId } from "./data/goods";
import { NEED_OF_GOOD } from "./data/needs";
import { log } from "./engine";
import { roleFactor } from "./leadership";
import type { LocalOfficial } from "./local";
import type { Company, GameEvent, GameState } from "./types";
import { clamp, fmtMoney, lowerName, rand } from "./util";

export type SchemeId = "cook_books" | "tax_shelter" | "price_fix" | "wage_theft" | "emissions";
type Log = (text: string, kind: GameEvent["kind"], extra?: Pick<GameEvent, "headline" | "deck">) => void;

export const SCHEMES: Record<SchemeId, { name: string; pitch: string; payoff: string; agency: string; rate: number }> = {
  cook_books: { name: "Cook the books", pitch: "Book next quarter's sales this quarter, capitalize some expenses, and lean on the auditors.", payoff: "Reported revenue and profit run 8% hot; the stock drifts up", agency: "the SEC", rate: 1.5 },
  tax_shelter: { name: "Park profits offshore", pitch: "A web of Irish and Caribbean subsidiaries that own your patents and charge you for them.", payoff: "Taxes fall 60%", agency: "the IRS", rate: 0.6 },
  price_fix: { name: "Fix prices with rivals", pitch: "A quiet dinner with your competitors in your biggest market. Nobody undercuts anybody.", payoff: "Everyone in the market can charge 12% more", agency: "the Justice Department", rate: 1.2 },
  wage_theft: { name: "Shave the timecards", pitch: "Round punches down, skip breaks, call warehouse staff contractors.", payoff: "Running costs fall 5%", agency: "the Labor Department", rate: 0.8 },
  emissions: { name: "Rig the tests", pitch: "Software that behaves in the lab and nowhere else. Safety numbers rounded generously.", payoff: "Running costs fall 3%; your products look better than they are", agency: "the EPA", rate: 1.0 },
};

export interface SchemeState { since: number; exposure: number; active: boolean; gain: number; good?: GoodId }
export interface Probe { scheme: SchemeId | "bribe" | "smear"; agency: string; until: number; severity: number; opened: number }

const annualRev = (c: Company) => c.history.slice(-12).reduce((a, h) => a + h.revenue, 0);
const poss = (n: string) => (n.endsWith("s") ? `${n}'` : `${n}'s`);
const pick = <T,>(s: GameState, xs: T[]) => xs[Math.floor(rand(s) * xs.length)];

export function heat(c: Company): number {
  return Object.values(c.schemes ?? {}).reduce((a, x) => a + (x?.exposure ?? 0), 0) + (c.crimeHeat ?? 0);
}

/** Effects other systems read. */
export const crimeFx = {
  reportInflate: (c: Company) => (c.schemes?.cook_books?.active ? 0.08 : 0),
  taxMult: (c: Company) => (c.schemes?.tax_shelter?.active ? 0.4 : 1),
  runningCost: (c: Company) => (c.schemes?.wage_theft?.active ? 0.95 : 1) * (c.schemes?.emissions?.active ? 0.97 : 1),
  cartelMult: (s: GameState, c: Company, g: GoodId) => (s.cartel && s.cartel.good === g && s.cartel.members.includes(c.id) ? 1.12 : 1),
};

export function toggleScheme(s: GameState, c: Company, id: SchemeId): { ok: boolean; message: string } {
  c.schemes ??= {};
  const cur = c.schemes[id];
  if (c.probe?.scheme === id) return { ok: false, message: `${SCHEMES[id].agency.replace(/^./, (x) => x.toUpperCase())} is already looking at exactly this.` };
  if (cur?.active) {
    cur.active = false;
    if (id === "price_fix") s.cartel = undefined;
    return { ok: true, message: `You wound down "${SCHEMES[id].name.toLowerCase()}". The paper trail fades slowly.` };
  }
  if (id === "price_fix") {
    const best = (Object.keys(c.prices) as GoodId[]).map((g) => ({ g, sh: s.markets[g]?.sales[c.id]?.share ?? 0 })).sort((a, b) => b.sh - a.sh)[0];
    if (!best || best.sh < 0.08) return { ok: false, message: "You need at least 8% of a market for rivals to take your call." };
    const members = s.companies.filter((o) => o.alive && o !== c && (s.markets[best.g]?.sales[o.id]?.share ?? 0) > 0.01).map((o) => o.id);
    if (!members.length) return { ok: false, message: "There's nobody in that market to conspire with." };
    s.cartel = { good: best.g, members: [c.id, ...members.slice(0, 6)], since: s.month };
    c.schemes[id] = { since: s.month, exposure: cur?.exposure ?? 0, active: true, gain: cur?.gain ?? 0, good: best.g };
    return { ok: true, message: `Dinner went well. ${members.slice(0, 6).length} rivals in ${lowerName(GOOD_BY_ID[best.g].name)} agreed to stop competing on price.`.replace(" 1 rivals ", " one rival ") };
  }
  if (id === "emissions" && !(Object.keys(c.prices) as GoodId[]).some((g) => NEED_OF_GOOD[g] || GOOD_BY_ID[g].tech === "auto" || GOOD_BY_ID[g].tech === "energy" || GOOD_BY_ID[g].tech === "materials")) {
    return { ok: false, message: "You don't make anything with tests to rig." };
  }
  c.schemes[id] = { since: s.month, exposure: cur?.exposure ?? 0, active: true, gain: cur?.gain ?? 0 };
  return { ok: true, message: `"${SCHEMES[id].name}" is under way. Nobody writes anything down.` };
}

/** Pay a (fictional) local official to vote your way. */
export function bribe(s: GameState, c: Company, o: LocalOfficial): { ok: boolean; message: string } {
  const amount = o.role === "governor" ? 5e6 : o.role === "mayor" ? 1e6 : 250e3;
  if (c.cash < amount) return { ok: false, message: `The envelope needs ${fmtMoney(amount)}.` };
  if (o.temperament === "ideologue" || (o.temperament === "populist" && rand(s) < 0.6)) {
    c.crimeHeat = (c.crimeHeat ?? 0) + 15;
    o.regard.why.bribe = -40;
    return { ok: false, message: `${o.name} refused, and wrote down exactly what you offered. That's going to come up again.` };
  }
  c.cash -= amount;
  c.current.lobbying += amount;
  o.regard.why.bribe = 40;
  o.bribed = s.month;
  c.crimeHeat = (c.crimeHeat ?? 0) + (o.role === "governor" ? 12 : 8);
  return { ok: true, message: `${o.name} accepted a "consulting fee" of ${fmtMoney(amount)}. Expect their vote.` };
}

/** Plant stories about a rival. */
export function smear(s: GameState, c: Company, rivalId: number): { ok: boolean; message: string } {
  const r = s.companies.find((x) => x.id === rivalId && x.alive);
  if (!r) return { ok: false, message: "No such company." };
  if (c.lastSmear !== undefined && s.month - c.lastSmear < 6) return { ok: false, message: "Your PR firm says the press is getting suspicious. Wait a few months." };
  const cost = Math.max(2e6, r.marketCap * 0.00002);
  if (c.cash < cost) return { ok: false, message: `The operation costs ${fmtMoney(cost)}.` };
  c.cash -= cost; c.current.marketing += cost; c.lastSmear = s.month;
  r.image = clamp(r.image - 0.07, 0, 1); r.hype *= 0.96;
  c.crimeHeat = (c.crimeHeat ?? 0) + 6;
  const ceo = r.leadership?.execs.find((e) => e.role === "ceo");
  if (ceo) { ceo.regard ??= { score: 0, why: {} }; ceo.regard.why.jab = (ceo.regard.why.jab ?? 0) - 8; }
  log(s, `Anonymous sources raised questions about ${poss(r.name)} products and management.`, "info", undefined, undefined, { headline: `Questions swirl around ${r.name}`, deck: "A string of unflattering stories, all from people who won't give their names" });
  return { ok: true, message: `The stories ran. ${r.name} is on the defensive.` };
}

// ---------------------------------------------------------------- monthly

export function updateCrime(s: GameState, L: (c: Company) => Log, warm: boolean) {
  for (const c of s.companies) {
    if (!c.alive) continue;
    const sch = c.schemes;
    if (sch) {
      const morale = c.leadership?.execs.length ? c.leadership.execs.reduce((a, e) => a + (e.morale ?? 65), 0) / c.leadership.execs.length : 65;
      const mult = (morale < 45 ? 1.6 : 1) * (c.leadership?.execs.some((e) => e.role === "ceo" && e.traits.includes("connected")) ? 0.75 : 1);
      for (const [id, st] of Object.entries(sch) as [SchemeId, SchemeState][]) {
        if (st.active) {
          st.exposure += SCHEMES[id].rate * mult;
          if (id === "cook_books") c.hype *= 1.003;
          if (id === "emissions") for (const g of Object.keys(c.prices) as GoodId[]) c.reputation[g] = Math.min(1.6, (c.reputation[g] ?? 1) + 0.01);
          if (id === "price_fix" && (!s.cartel || s.cartel.good !== st.good)) st.active = false;
        } else {
          st.exposure *= 0.96;
          if (st.exposure < 0.5) delete sch[id];
        }
      }
    }
    if (c.crimeHeat) { c.crimeHeat *= 0.97; if (c.crimeHeat < 0.5) c.crimeHeat = 0; }
    if (warm) continue;
    // Investigators notice.
    if (!c.probe) {
      const candidates: [Probe["scheme"], number][] = [];
      for (const [id, st] of Object.entries(sch ?? {}) as [SchemeId, SchemeState][]) candidates.push([id, st.exposure]);
      if (c.crimeHeat) candidates.push([rand(s) < 0.6 ? "bribe" : "smear", c.crimeHeat]);
      for (const [id, exp] of candidates) {
        if (rand(s) < exp / 400) { openProbe(s, c, id, exp, L(c)); break; }
      }
    } else if (s.month >= c.probe.until && !(s.decisions ?? []).some((d) => d.kind === "probe" && d.companyId === c.id)) {
      if (c.isPlayer) probeDecision(s, c);
      else resolveProbe(s, c, rand(s) < 0.7 ? "cooperate" : "fight", L(c));
    }
  }
  // Rivals get caught at things too.
  if (!warm && rand(s) < 0.05) {
    const pool = s.companies.filter((c) => c.alive && !c.isPlayer && c.marketCap > 20e9 && !c.probe);
    if (pool.length) {
      const c = pick(s, pool);
      const id = pick(s, Object.keys(SCHEMES) as SchemeId[]);
      (c.schemes ??= {})[id] = { since: s.month - 12, exposure: 15 + rand(s) * 25, active: true, gain: 0 };
      openProbe(s, c, id, c.schemes[id]!.exposure, L(c));
    }
  }
  if (s.cartel && !s.cartel.members.some((id) => s.companies.find((c) => c.id === id)?.schemes?.price_fix?.active)) s.cartel = undefined;
}

const AGENCY_HEAD: Record<Probe["scheme"], (n: string) => string> = {
  cook_books: (n) => `SEC opens inquiry into ${poss(n)} accounting`,
  tax_shelter: (n) => `IRS audits ${poss(n)} offshore subsidiaries`,
  price_fix: (n) => `FBI raids ${n} in price-fixing probe`,
  wage_theft: (n) => `Labor Department investigates ${n} over unpaid wages`,
  emissions: (n) => `EPA says ${n} cheated on its tests`,
  bribe: (n) => `FBI investigating ${n} over payments to officials`,
  smear: (n) => `${n} linked to anonymous smear campaign`,
};

function openProbe(s: GameState, c: Company, scheme: Probe["scheme"], exposure: number, L: Log) {
  const severity = clamp(Math.round(exposure / 12), 1, 4);
  const agency = scheme === "bribe" ? "the FBI" : scheme === "smear" ? "reporters" : SCHEMES[scheme].agency;
  c.probe = { scheme, agency, until: s.month + 4 + Math.floor(rand(s) * 4), severity, opened: s.month };
  c.hype *= 1 - 0.03 * severity;
  c.image = clamp(c.image - 0.02 * severity, 0, 1);
  if (c.isPlayer || c.marketCap > 100e9) L(`${agency.replace(/^./, (x) => x.toUpperCase())} opened an investigation into ${c.name}.`, "bad", { headline: AGENCY_HEAD[scheme](c.name), deck: severity >= 3 ? "Sources describe the case as serious" : "The company says it is cooperating fully" });
}

function probeDecision(s: GameState, c: Company) {
  const p = c.probe!;
  (s.decisions ??= []).push({
    id: s.nextId++, kind: "probe", companyId: c.id, deadlineDay: s.day + 30,
    headline: `${p.agency.replace(/^./, (x) => x.toUpperCase())} is ready to act`,
    deck: `The investigation into ${c.name} is wrapping up. Severity ${["", "minor", "serious", "grave", "catastrophic"][p.severity]}. Your lawyers want a decision.`,
    options: [
      { id: "cooperate", label: "Cooperate and settle", detail: "Pay the fine, stop the scheme; for fraud or price-fixing the CEO goes" },
      { id: "fight", label: "Fight it", detail: "Maybe it goes away; if not, a bigger fine and an indicted CEO" },
      { id: "shred", label: "Shred the evidence", detail: "Usually works. When it doesn't, it's obstruction, and it can end the company" },
    ],
    data: { scheme: p.scheme, severity: p.severity },
  });
}

function baseFine(c: Company, scheme: Probe["scheme"]): number {
  const rev = Math.max(1e7, annualRev(c));
  const st = scheme in SCHEMES ? c.schemes?.[scheme as SchemeId] : undefined;
  switch (scheme) {
    case "cook_books": return rev * 0.05;
    case "tax_shelter": return (st?.gain ?? 0) * 1.5 + rev * 0.01;
    case "price_fix": return c.history.slice(-12).reduce((a, h) => a + (h.revenueByGood[st?.good ?? "components"] ?? 0), 0) * 0.12 + rev * 0.01;
    case "wage_theft": return (st?.gain ?? 0) * 2 + rev * 0.005;
    case "emissions": return rev * 0.04;
    default: return rev * 0.005;
  }
}

function removeExec(c: Company, role: "ceo" | "cfo") {
  if (c.leadership) c.leadership.execs = c.leadership.execs.filter((e) => e.role !== role);
}

export function resolveProbe(s: GameState, c: Company, opt: "cooperate" | "fight" | "shred", L: Log): string {
  const p = c.probe;
  if (!p) return "The case was closed.";
  c.probe = undefined;
  const sev = p.severity;
  const fine = baseFine(c, p.scheme) * (0.6 + 0.2 * sev);
  const stop = () => {
    if (p.scheme in SCHEMES) { const st = c.schemes?.[p.scheme as SchemeId]; if (st) { st.active = false; st.exposure *= 0.3; } if (p.scheme === "price_fix") s.cartel = undefined; }
    if (p.scheme === "bribe" || p.scheme === "smear") c.crimeHeat = 0;
  };
  const ceoName = c.leadership?.execs.find((e) => e.role === "ceo")?.name ?? "the CEO";
  const board = c.leadership?.board;
  if (p.scheme === "emissions") for (const g of Object.keys(c.prices) as GoodId[]) c.reputation[g] = Math.max(0.3, (c.reputation[g] ?? 1) - 0.25);
  if (opt === "cooperate") {
    c.cash -= fine; stop();
    c.image = clamp(c.image - 0.04 * sev, 0, 1); c.hype *= 1 - 0.04 * sev;
    if (board) board.confidence = clamp(board.confidence - 0.08, 0, 1);
    const ousted = p.scheme === "cook_books" || p.scheme === "price_fix";
    if (ousted) removeExec(c, "ceo");
    L(`${c.name} settled with ${p.agency} for ${fmtMoney(fine)}.${ousted ? ` ${ceoName} resigned.` : ""}`, "bad", { headline: `${c.name} pays ${fmtMoney(fine)} to settle${ousted ? `; ${ceoName} out` : ""}`, deck: `The company admitted no wrongdoing` });
    return `Settled for ${fmtMoney(fine)}.${ousted ? ` ${ceoName} is out.` : ""}`;
  }
  if (opt === "fight") {
    const win = rand(s) < clamp(0.5 - 0.1 * sev + 0.08 * roleFactor(c, "ceo"), 0.08, 0.7);
    stop();
    if (win) { c.image = clamp(c.image - 0.01, 0, 1); L(`${p.agency.replace(/^./, (x) => x.toUpperCase())} dropped its case against ${c.name}.`, "good", { headline: `Case against ${c.name} collapses`, deck: "Prosecutors say the evidence wasn't there" }); return "They dropped the case."; }
    c.cash -= fine * 2; removeExec(c, "ceo");
    c.image = clamp(c.image - 0.08 * sev, 0, 1); c.hype *= 1 - 0.07 * sev;
    if (board) board.confidence = clamp(board.confidence - 0.15, 0, 1);
    L(`${c.name} lost: a ${fmtMoney(fine * 2)} penalty, and ${ceoName} was indicted.`, "bad", { headline: `${ceoName} indicted; ${c.name} hit with ${fmtMoney(fine * 2)} penalty`, deck: "The former chief executive pleaded not guilty" });
    return `You lost. ${fmtMoney(fine * 2)}, and ${ceoName} has been indicted.`;
  }
  // Shred.
  if (rand(s) < clamp(0.68 - 0.1 * sev, 0.25, 0.65)) {
    if (p.scheme in SCHEMES) { const st = c.schemes?.[p.scheme as SchemeId]; if (st) st.exposure *= 0.5; }
    return "The documents are gone, and so is the case. For now.";
  }
  c.cash -= fine * 3; removeExec(c, "ceo"); removeExec(c, "cfo");
  c.image = clamp(c.image - 0.2, 0, 1); c.hype *= 0.7;
  if (board) board.confidence = 0.15;
  stop();
  if (c.isPlayer && sev >= 3 && (p.scheme === "cook_books" || p.scheme === "price_fix" || p.scheme === "bribe")) {
    s.gameOver = `Investigators found the shredded documents. ${ceoName} and the CFO were led out of headquarters in handcuffs, the company was charged with obstruction, and the board voted to wind it down.`;
    L(`${c.name} charged with obstruction of justice.`, "bad", { headline: `${c.name} executives arrested`, deck: "Prosecutors found the shredder" });
    return "Caught. It's over.";
  }
  L(`${c.name} was caught destroying evidence: ${fmtMoney(fine * 3)} in penalties, and its CEO and CFO were charged with obstruction.`, "bad", { headline: `${c.name} caught shredding documents`, deck: "Its two top executives face obstruction charges" });
  return `Caught shredding. ${fmtMoney(fine * 3)} in penalties, and your CEO and CFO are gone.`;
}

/** Track what the schemes actually saved (fines are based on it). */
export function noteGain(c: Company, id: SchemeId, amount: number) {
  const st = c.schemes?.[id];
  if (st?.active && amount > 0) st.gain += amount;
}
