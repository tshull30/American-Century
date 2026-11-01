// A living population: births, migration between states and cities, people retraining
// into better-paid jobs, and what each kind of worker thinks of each company.
import { BLUE_COLLAR, JOBS, JOB_BY_ID, LOW_WAGE, type JobId } from "./data/jobs";
import { offshoreShare } from "./intl";
import { NEED_OF_GOOD } from "./data/needs";
import { STATES, STATE_BY_CODE } from "./data/states";
import { citiesInState, cityWorkforce, stateWage } from "./geo";
import type { Company, GameState } from "./types";
import { clamp, laborKey } from "./util";

/** Who can retrain into what: [from, to]. */
const LADDERS: [JobId, JobId][] = [
  ["service", "retail"], ["retail", "sales"], ["service", "laborer"], ["service", "clerk"], ["care", "nurse"], ["retail", "care"],
  ["farmworker", "laborer"], ["laborer", "assembler"], ["laborer", "driver"], ["laborer", "construction"], ["laborer", "extraction"],
  ["assembler", "technician"], ["construction", "technician"], ["extraction", "technician"], ["technician", "engineer"],
  ["clerk", "accountant"], ["clerk", "professional"], ["sales", "manager"], ["accountant", "professional"], ["professional", "manager"],
  ["clerk", "software"], ["professional", "software"], ["engineer", "software"], ["software", "datasci"], ["scientist", "datasci"],
  ["professional", "scientist"], ["professional", "designer"], ["professional", "lawyer"], ["nurse", "physician"],
]

function stateCol(s: GameState, st: string): number {
  let w = 0, n = 0;
  for (const c of citiesInState(s, st)) { w += c.col * c.share; n += c.share; }
  return n > 0 ? w / n : STATE_BY_CODE[st].wageIndex;
}

export function updatePopulation(s: GameState) {
  // Natural growth, about 0.4% a year.
  for (const p of s.pops) { p.workers *= 1 + 0.004 / 12; p.dependents *= 1 + 0.004 / 12; }

  // Migration between states: toward high living standards relative to housing costs, and toward new jobs.
  const stats = STATES.map((st) => {
    let sol = 0, ppl = 0;
    for (const p of s.pops) if (p.state === st.code) { const n = p.workers + p.dependents; sol += p.sol * n; ppl += n; }
    let wf = 0, game = 0;
    for (const c of citiesInState(s, st.code)) for (const j of JOBS) { const cell = s.labor[laborKey(c.id, j.id)]; if (cell) { wf += cell.workforce; game += cell.gameEmployed; } }
    const a = (ppl ? sol / ppl : 100) / 100 / (0.7 + 0.3 * stateCol(s, st.code)) + 3 * (wf ? game / wf : 0);
    return { st: st.code, a, ppl };
  });
  const mean = stats.reduce((x, y) => x + y.a * y.ppl, 0) / stats.reduce((x, y) => x + y.ppl, 0);
  const sd = Math.sqrt(stats.reduce((x, y) => x + (y.a - mean) ** 2 * y.ppl, 0) / stats.reduce((x, y) => x + y.ppl, 0)) || 1;
  const rate: Record<string, number> = {};
  for (const x of stats) rate[x.st] = clamp(0.0006 * ((x.a - mean) / sd), -0.0015, 0.0015);
  let before = 0, after = 0;
  for (const p of s.pops) {
    before += p.workers;
    const f = 1 + (rate[p.state] ?? 0);
    p.workers *= f; p.dependents *= f;
    after += p.workers;
  }
  const norm = before / after;
  for (const p of s.pops) { p.workers *= norm; p.dependents *= norm; }

  // Within a state, people drift toward cities where companies are hiring.
  for (const st of STATES) {
    const cs = citiesInState(s, st.code);
    let tot = 0;
    for (const c of cs) {
      let game = 0;
      for (const j of JOBS) game += s.labor[laborKey(c.id, j.id)]?.gameEmployed ?? 0;
      const intensity = game / Math.max(1, cityWorkforce(s, c.id));
      c.share *= 1 + 0.01 * intensity - 0.0004 * (c.col - 1);
      tot += c.share;
    }
    for (const c of cs) c.share /= tot;
  }

  // Retraining: when a job pays well above its normal rate, people move up into it from the rung below.
  const byKey = new Map<string, number[]>();
  s.pops.forEach((p, i) => {
    const k = `${p.state}|${p.culture}|${p.job}`;
    const arr = byKey.get(k) ?? [];
    arr.push(i);
    byKey.set(k, arr);
  });
  for (const st of STATES) {
    for (const [from, to] of LADDERS) {
      const normal = JOB_BY_ID[to].baseWage * st.wageIndex;
      const premium = stateWage(s, st.code, to) / normal - 1;
      if (premium <= 0.03) continue;
      const r = Math.min(0.003, premium * 0.01);
      for (const p of s.pops) {
        if (p.state !== st.code || p.job !== from) continue;
        const target = byKey.get(`${p.state}|${p.culture}|${to}`)?.[0];
        if (target === undefined) continue;
        const moved = p.workers * r;
        p.workers -= moved;
        p.dependents -= moved;
        s.pops[target].workers += moved;
        s.pops[target].dependents += moved;
      }
    }
  }
}

/** Each pop type's opinion of each company: pay, layoffs, and what they charge for necessities. */
export function updateJobOpinion(s: GameState, c: Company) {
  let gouge = 0, gw = 0;
  const last = c.history[c.history.length - 1];
  for (const g of Object.keys(c.prices) as (keyof typeof NEED_OF_GOOD)[]) {
    if (!NEED_OF_GOOD[g] || !s.markets[g] || !last) continue;
    const w = last.revenueByGood[g] ?? 0;
    gouge += Math.max(0, c.prices[g]! / s.markets[g]!.avgPrice - 1.15) * w;
    gw += w;
  }
  const gougeHit = gw > 0 ? gouge / gw : 0;
  const empByJob: Partial<Record<JobId, number>> = {};
  for (const [k, n] of Object.entries(c.employees)) {
    const j = k.slice(k.lastIndexOf(":") + 1) as JobId;
    empByJob[j] = (empByJob[j] ?? 0) + n;
  }
  const offshore = offshoreShare(s, c);
  for (const j of JOBS) {
    const emp = empByJob[j.id] ?? 0;
    const laid = c.layoffsByJob[j.id] ?? 0;
    const priceSensitive = LOW_WAGE.includes(j.id) || j.id === "clerk" ? 1 : 0.4;
    let target = 0.5 + (c.image - 0.6) * 0.6 - gougeHit * priceSensitive;
    if (emp > 0) target += 0.4 * (c.wagePolicy - 1) + 0.04 - Math.min(0.4, (laid / emp) * 4);
    if (BLUE_COLLAR.includes(j.id)) target -= 0.3 * offshore;
    const cur = c.jobOpinion[j.id] ?? 0.5;
    c.jobOpinion[j.id] = clamp(cur + (clamp(target, 0.02, 0.98) - cur) * 0.12, 0, 1);
  }
  c.layoffsByJob = {};
  c.layoffsByCity = {};
}
