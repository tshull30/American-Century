// Basic federal politics: two parties, elections every two years, laws with
// economic effects, one bill at a time moving through Congress, and lobbying.
import { BUILDING_BY_ID, type BuildingTypeId } from "./data/buildings";
import { GOOD_BY_ID, type GoodId } from "./data/goods";
import { BLUE_COLLAR, SKILLED, type JobId } from "./data/jobs";
import { LAWS, LAW_BY_ID, PARTIES, type LawId, type PartyId } from "./data/laws";
import type { Company, GameState, Politics } from "./types";
import { clamp, dateOfDay, dayLabel, fmtMoney, rand, randNormal, START_YEAR } from "./util";
import { decayFriendship, initCongress, pickPresident, recordVote, refreshMajorities, whip } from "./congress";
import { holdGeneral } from "./elections";

// ---------------------------------------------------------------- law effects

export const lv = (s: GameState, id: LawId) => s.politics.laws[id];

export function corpTax(s: GameState): number {
  return [0.15, 0.21, 0.28, 0.35][lv(s, "corporate_tax")];
}

/** Federal wage floor per month for service workers and laborers. */
export function minWageFloor(s: GameState): number {
  return [0, 2080, 2600, 3470][lv(s, "minimum_wage")];
}

export function tariffRate(s: GameState): number {
  return [0, 0.1, 0.25, 0.6][lv(s, "tariffs")];
}

/** Multiplier on the price of imported inputs (tariffs plus any world event). */
export function importMult(s: GameState, g: GoodId): number {
  // Grid power isn't imported; everything else scales with how much of it comes from abroad.
  let m = g === "electricity" ? 1 : 1 + tariffRate(s) * 0.8 * Math.min(1, GOOD_BY_ID[g].importShare * 2 + 0.2);
  for (const e of s.worldEvents) m *= e.importMult?.[g] ?? 1;
  return m;
}

/** Tariffs make foreign rivals' goods dearer in the US part of each market. */
export function foreignPriceMult(s: GameState, g: GoodId, usShare: number): number {
  return 1 + tariffRate(s) * GOOD_BY_ID[g].importShare * 0.6 * usShare;
}

/** Retaliation: other countries buy fewer American exports when the US raises tariffs. */
export function exportMult(s: GameState): number {
  return 1 - tariffRate(s) * 0.3;
}

export function antitrustCap(s: GameState): number {
  return [0.6, 0.4, 0.25][lv(s, "antitrust")];
}

export function subsidyRate(s: GameState, type: BuildingTypeId, method?: string): number {
  const ind = BUILDING_BY_ID[type].industry;
  const ip = lv(s, "industrial_policy");
  let r = 0;
  if (ind === "strategic" && ip >= 1) r = 0.3;
  if (ind === "factory" && ip >= 2) r = 0.15;
  if (type === "power" && method === "solar" && lv(s, "climate") >= 1) r = Math.max(r, 0.3);
  return r;
}

export function immigrationMult(s: GameState, job: JobId): number {
  if (!SKILLED.includes(job)) return 1;
  return [0.95, 1, 1.1][lv(s, "immigration")];
}

export function unionWageMult(s: GameState, job: JobId): number {
  if (lv(s, "labor_unions") === 2 && BLUE_COLLAR.includes(job)) return 1.06;
  return 1;
}
export function unionPressure(s: GameState): number {
  return [1.0, 1.5, 2.0][lv(s, "labor_unions")];
}

export function lawDemandMult(s: GameState, g: GoodId): number {
  if (g === "digital_ads" || g === "data_platforms") return [1, 0.92, 0.82][lv(s, "data_privacy")];
  return 1;
}

export function climatePrefMult(s: GameState, g: GoodId): number {
  const c = lv(s, "climate");
  if (g === "evs") return [1, 1.15, 1.3][c];
  if (g === "gas_cars") return [1, 1, 0.85][c];
  return 1;
}

/** Extra monthly running cost per level from a carbon tax. */
export function carbonCost(s: GameState, type: BuildingTypeId, method: string): number {
  return lv(s, "climate") === 2 && type === "power" && method === "gas" ? 2e6 : 0;
}

// ---------------------------------------------------------------- setup

/** US general elections: the Tuesday after the first Monday in November of even years. */
export function electionDay(year: number): number {
  const nov1 = Date.UTC(year, 10, 1);
  const dow = new Date(nov1).getUTCDay(); // 0 = Sunday
  const firstMonday = 1 + ((8 - dow) % 7);
  const date = Date.UTC(year, 10, firstMonday + 1);
  return Math.round((date - Date.UTC(START_YEAR, 0, 1)) / 86400000);
}

export function initPolitics(s: GameState): Politics {
  const laws = Object.fromEntries(LAWS.map((l) => [l.id, l.start])) as Record<LawId, number>;
  const p: Politics = {
    president: "frontier", presidentName: "Donald Trump", vpName: "JD Vance", presidentTerms: 2,
    congress: "frontier", senate: "frontier", laws, bill: null, approval: 0.42, poll: 0.51,
    nextElectionDay: electionDay(START_YEAR), solAtLastElection: 100,
  };
  s.politics = p;
  initCongress(s);
  refreshMajorities(s);
  return p;
}

export function isPresidentialYear(year: number) {
  return year % 4 === 0;
}

// ---------------------------------------------------------------- lobbying

/** Total monthly lobbying spend pushing a law in a direction, across all companies. */
export function lobbyPressure(s: GameState, law: LawId, dir: 1 | -1): number {
  let sum = 0;
  for (const c of s.companies) if (c.alive) for (const l of c.lobbying) if (l.law === law && l.dir === dir) sum += l.monthly;
  return sum;
}

/** Diminishing-returns influence of lobbying money. */
function influence(dollars: number): number {
  return Math.sqrt(Math.max(0, dollars) / 10e6);
}

/** Rival companies lobby for whatever helps their business most. */
export function aiLobbying(_s: GameState, c: Company) {
  const last = c.history[c.history.length - 1];
  const rev = last?.revenue ?? 0;
  if (c.kind === "startup" || rev < 50e6) { c.lobbying = []; return; }
  const budget = Math.min(3e6, rev * 0.0004);
  const goods = new Set(Object.keys(c.prices) as GoodId[]);
  const types = new Set(c.buildings.map((b) => b.type));
  const wants: { law: LawId; dir: 1 | -1; w: number }[] = [];
  if ((last?.netIncome ?? 0) > 0) wants.push({ law: "corporate_tax", dir: -1, w: 2 });
  if (types.has("fab") || types.has("battery") || types.has("power")) wants.push({ law: "industrial_policy", dir: 1, w: 3 });
  if (goods.has("smartphones") || goods.has("computers") || goods.has("apparel")) wants.push({ law: "tariffs", dir: -1, w: 3 });
  if (goods.has("chips") || goods.has("batteries") || goods.has("gas_cars")) wants.push({ law: "tariffs", dir: 1, w: 2 });
  if (goods.has("digital_ads") || goods.has("data_platforms")) wants.push({ law: "data_privacy", dir: -1, w: 3 });
  if (goods.has("software") || goods.has("ai_accelerators") || goods.has("cloud")) wants.push({ law: "immigration", dir: 1, w: 2 });
  if (goods.has("evs") && !goods.has("gas_cars")) wants.push({ law: "climate", dir: 1, w: 2 });
  if (goods.has("gas_cars")) wants.push({ law: "climate", dir: -1, w: 2 });
  let laborers = 0;
  for (const [k, n] of Object.entries(c.employees)) if (k.endsWith(":laborer") || k.endsWith(":service")) laborers += n;
  if (laborers > 20000) wants.push({ law: "minimum_wage", dir: -1, w: 2 }, { law: "labor_unions", dir: -1, w: 1 });
  wants.sort((a, b) => b.w - a.w);
  const top = wants.slice(0, 2);
  const wsum = top.reduce((a, x) => a + x.w, 0);
  c.lobbying = top.map((x) => ({ law: x.law, dir: x.dir, monthly: (budget * x.w) / wsum }));
}

// ---------------------------------------------------------------- monthly politics

/** Democratic two-party lean by occupation (rough exit-poll and donor-data impressions). */
const JOB_LEAN: Record<JobId, number> = {
  laborer: 0.5, assembler: 0.46, construction: 0.4, driver: 0.43, farmworker: 0.38, extraction: 0.3, technician: 0.45,
  service: 0.57, retail: 0.53, care: 0.62, nurse: 0.55,
  clerk: 0.53, sales: 0.44, accountant: 0.47, lawyer: 0.6, professional: 0.56, teacher: 0.63, physician: 0.57,
  engineer: 0.48, software: 0.6, datasci: 0.62, scientist: 0.66, designer: 0.64, manager: 0.43,
};
/** National occupational lean at game start, so polls start near even. */
function occupationalLean(s: GameState): number {
  let l = 0, n = 0;
  for (const p of s.pops) { l += JOB_LEAN[p.job] * p.workers; n += p.workers; }
  return n > 0 ? l / n : 0.5;
}

function donationEdge(s: GameState): number {
  let cw = 0, fr = 0;
  for (const c of s.companies) { cw += c.donations.commonwealth ?? 0; fr += c.donations.frontier ?? 0; }
  const f = (x: number) => Math.min(0.025, Math.sqrt(x / 1e9) * 0.01);
  return f(cw) - f(fr);
}

export function updatePolitics(s: GameState, log: (text: string, kind?: "politics" | "deal" | "bad" | "good") => void) {
  const p = s.politics;
  // Approval follows living standards and the economy.
  const target = clamp(0.45 + 2 * (s.sol - p.solAtLastElection) / 100 + 3 * s.macro.gap - (s.macro.recession ? 0.08 : 0) - 0.04 * (s.macro.inflation - 0.025) * 10, 0.2, 0.75);
  p.approval += (target - p.approval) * 0.2 + 0.01 * randNormal(s);
  p.approval = clamp(p.approval, 0.15, 0.8);

  // Polling: pops lean by occupation, swung by the president's approval and by donations.
  let lean = 0, people = 0;
  for (const pop of s.pops) {
    const n = pop.workers;
    let l = JOB_LEAN[pop.job];
    if (pop.sol < 75) l += p.president === "commonwealth" ? -0.008 : 0.008; // struggling voters punish incumbents
    lean += l * n;
    people += n;
  }
  // Occupational leans net out near even; the swing comes from approval.
  let poll = 0.5 + (lean / people - (p.leanBase ?? (p.leanBase = occupationalLean(s))));
  const swing = (p.approval - 0.48) * 0.2;
  poll += p.president === "commonwealth" ? swing : -swing;
  poll += donationEdge(s);
  p.poll += (clamp(poll, 0.42, 0.58) - p.poll) * 0.3;

  // Legislation: the House majority sets the agenda; committee work takes months, then both chambers vote.
  decayFriendship(s);
  const unified = p.president === p.congress && p.congress === p.senate;
  if (p.bill) {
    const b = p.bill;
    const w = whip(s, b.law, b.target, b.sponsor);
    b.support = clamp((w.house.yes / w.house.need + w.senate.yes / w.senate.need) / 2 - 1, -1, 1);
    b.progress += 0.15 * (unified ? 1 : 0.6);
    const law = LAW_BY_ID[b.law];
    if (b.progress >= 1) {
      const v = recordVote(s, b.law, b.target, w);
      const tally = `House ${w.house.yes}–${w.house.no}, Senate ${w.senate.yes}–${w.senate.no}${w.senate.rule === "cloture" ? " (60 needed to end debate)" : ""}`;
      if (v.outcome === "passed") {
        p.laws[b.law] = b.target;
        log(`${law.name} bill signed into law: now "${law.levels[b.target].name}" (${tally}${w.vetoed ? ", veto overridden" : ""}). ${law.levels[b.target].effect}`, "politics");
      } else if (v.outcome === "vetoed") {
        log(`President ${p.presidentName} vetoed the ${law.name} bill (${tally}).`, "politics");
      } else {
        log(`The ${law.name} bill (${law.levels[b.target].name}) failed in the ${v.outcome === "failed-house" ? "House" : "Senate"}: ${tally}.`, "politics");
      }
      p.bill = null;
    } else if (rand(s) < 0.02) {
      log(`The ${law.name} bill (${law.levels[b.target].name}) died in committee.`, "politics");
      p.bill = null;
    }
  } else if (rand(s) < 0.35) {
    const party = p.congress;
    const options: { law: LawId; target: number; w: number }[] = [];
    for (const l of LAWS) {
      const cur = p.laws[l.id];
      for (const dir of [1, -1] as const) {
        const t = cur + dir;
        if (t < 0 || t >= l.levels.length) continue;
        const onPlatform = Math.abs(t - l.platform[party]) < Math.abs(cur - l.platform[party]);
        const inf = influence(lobbyPressure(s, l.id, dir));
        if (!onPlatform && inf < 1) continue;
        const wp = whip(s, l.id, t, party);
        if (!onPlatform && !wp.passes) continue;
        const chance = wp.passes ? 1 : Math.min(wp.house.yes / wp.house.need, wp.senate.yes / wp.senate.need) * 0.3;
        options.push({ law: l.id, target: t, w: (onPlatform ? 1 : 0.3) * (0.3 + chance * 2) + inf * 0.5 });
      }
    }
    const total = options.reduce((a, o) => a + o.w, 0);
    if (total > 0) {
      let r = rand(s) * total;
      const pickO = options.find((o) => (r -= o.w) <= 0) ?? options[0];
      const law = LAW_BY_ID[pickO.law];
      p.bill = { law: pickO.law, target: pickO.target, sponsor: party, progress: 0, support: 0, startedDay: s.day };
      log(`House ${PARTIES[party].short} introduced a bill: ${law.name} → ${law.levels[pickO.target].name}.`, "politics");
    }
  }
}

export function maybeHoldElection(s: GameState, log: (text: string, kind?: "politics") => void) {
  const p = s.politics;
  if (s.day < p.nextElectionDay) return;
  const year = dateOfDay(s.day).getUTCFullYear();
  const presidential = isPresidentialYear(year);
  let share = p.poll + 0.012 * randNormal(s);
  if (!presidential) share += p.president === "commonwealth" ? -0.01 : 0.01; // midterm penalty
  share = clamp(share, 0.4, 0.6);
  const oldPres = p.president, oldCong = p.congress, oldSen = p.senate;
  s.politics.poll = share;
  const r = holdGeneral(s, year, presidential);
  let presLine = "";
  if (presidential && r.presidentParty) {
    const winner = r.presidentParty;
    const incumbentRuns = p.president === winner && p.presidentTerms < 2;
    if (incumbentRuns) p.presidentTerms++;
    else { const t = pickPresident(s, winner); p.presidentName = t.name; p.vpName = t.vp; p.presidentTerms = 1; }
    p.president = winner;
    presLine = `President-elect ${p.presidentName} (${PARTIES[winner].name.replace(" Party", "")}) wins the Electoral College ${winner === "commonwealth" ? r.ecD : r.ecR}–${winner === "commonwealth" ? r.ecR : r.ecD}${p.president !== oldPres ? ", flipping the White House" : ""}. `;
  }
  refreshMajorities(s);
  p.lastResult = {
    day: s.day, presidential, commonwealth: share, president: p.president, congress: p.congress, senate: p.senate,
    houseD: r.houseD, houseR: r.houseR, senateD: r.senateD, senateR: r.senateR, ecD: r.ecD, ecR: r.ecR, presidentName: presidential ? p.presidentName : undefined,
  };
  p.solAtLastElection = s.sol;
  p.nextElectionDay = electionDay(year + 2);
  if (p.bill && (p.congress !== oldCong || p.senate !== oldSen || p.president !== oldPres)) {
    log(`The new Congress dropped the pending ${LAW_BY_ID[p.bill.law].name} bill.`, "politics");
    p.bill = null;
  }
  for (const c of s.companies) c.donations = {};
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  log(
    `${presidential ? "General election" : "Midterms"} (${dayLabel(s.day)}): Democrats ${pct(share)}, Republicans ${pct(1 - share)} nationally. ${presLine}` +
    `House ${r.houseD} D – ${r.houseR} R${p.congress !== oldCong ? " (flips)" : ""}; Senate ${r.senateD} D – ${r.senateR} R${p.senate !== oldSen ? " (flips)" : ""}.` +
    (r.flips.length ? ` Seats changing hands include ${r.flips.slice(0, 8).join(", ")}.` : ""),
    "politics",
  );
}

export function donate(_s: GameState, c: Company, party: PartyId, amount: number) {
  c.donations[party] = (c.donations[party] ?? 0) + amount;
  c.cash -= amount;
  c.current.lobbying += amount;
  c.image = clamp(c.image - Math.min(0.15, amount / 5e9), 0, 1);
  return `Donated ${fmtMoney(amount)} to the ${PARTIES[party].name}.`;
}
