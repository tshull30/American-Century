import { CULTURES, ASIAN_SPLIT, type CultureId } from "./data/cultures";
import { JOBS, type JobId } from "./data/jobs";
import { STATES, type StateDef } from "./data/states";
import { POPS_OVERRIDE } from "./data/popsOverride";

export interface Pop {
  id: number;
  state: string;
  culture: CultureId;
  job: JobId;
  /** People in the labor force. */
  workers: number;
  /** Non-working household members (children, retirees, etc.) supported by these workers. */
  dependents: number;
}

/** Share of the total population that is in the labor force. */
export const LABOR_FORCE_RATE = 0.5;
/** Smallest pop kept; anything below is dropped as noise. */
export const MIN_POP = 100;

export function cultureShares(s: StateDef): Record<CultureId, number> {
  const asian = s.pctAsian;
  const mix = { ...ASIAN_SPLIT, ...(s.asianMix ?? {}) };
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);
  const multiracial = Math.max(1, 100 - s.pctWhite - s.pctHispanic - s.pctBlack - s.pctAsian - s.pctNative);
  const raw: Record<CultureId, number> = {
    white: s.pctWhite,
    black: s.pctBlack,
    mexican: s.pctHispanic * s.mexicanShareOfHispanic,
    latino: s.pctHispanic * (1 - s.mexicanShareOfHispanic),
    chinese: (asian * mix.chinese) / mixTotal,
    indian: (asian * mix.indian) / mixTotal,
    filipino: (asian * mix.filipino) / mixTotal,
    vietnamese: (asian * mix.vietnamese) / mixTotal,
    korean: (asian * mix.korean) / mixTotal,
    asian_other: (asian * mix.asian_other) / mixTotal,
    native: s.pctNative,
    multiracial,
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(raw) as CultureId[]) raw[k] /= total;
  return raw;
}

export function jobShares(s: StateDef): Record<JobId, number> {
  const raw = {} as Record<JobId, number>;
  let total = 0;
  for (const j of JOBS) {
    const v = j.nationalShare * Math.pow(s.techIndex, j.techWeight) * Math.pow(s.mfgIndex, j.mfgWeight);
    raw[j.id] = v;
    total += v;
  }
  for (const j of JOBS) raw[j.id] /= total;
  return raw;
}

/**
 * Iterative proportional fitting ("raking"): start from culture-share × job-share
 * × job skew, then alternately rescale rows and columns until every culture
 * total and every job total in the state matches its target margin.
 */
export function rake(
  rowTargets: number[],
  colTargets: number[],
  seed: number[][],
  iterations = 50,
): number[][] {
  const m = seed.map((r) => r.slice());
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < m.length; i++) {
      const sum = m[i].reduce((a, b) => a + b, 0);
      if (sum > 0) for (let j = 0; j < m[i].length; j++) m[i][j] *= rowTargets[i] / sum;
    }
    for (let j = 0; j < colTargets.length; j++) {
      let sum = 0;
      for (let i = 0; i < m.length; i++) sum += m[i][j];
      if (sum > 0) for (let i = 0; i < m.length; i++) m[i][j] *= colTargets[j] / sum;
    }
  }
  return m;
}

export function generatePops(): Pop[] {
  const pops: Pop[] = [];
  let id = 1;
  if (POPS_OVERRIDE) {
    for (const [state, culture, job, workers] of POPS_OVERRIDE) {
      if (workers < MIN_POP) continue;
      pops.push({ id: id++, state, culture: culture as CultureId, job: job as JobId, workers, dependents: Math.round(workers * (1 / LABOR_FORCE_RATE - 1)) });
    }
    return pops;
  }
  for (const s of STATES) {
    const workforce = s.population * LABOR_FORCE_RATE;
    const cs = cultureShares(s);
    const js = jobShares(s);
    const rowTargets = CULTURES.map((c) => cs[c.id] * workforce);
    const colTargets = JOBS.map((j) => js[j.id] * workforce);
    const seed = CULTURES.map((c) => JOBS.map((j) => cs[c.id] * js[j.id] * (c.jobSkew[j.id] ?? 1)));
    const fitted = rake(rowTargets, colTargets, seed);
    CULTURES.forEach((c, i) => {
      JOBS.forEach((j, k) => {
        const workers = Math.round(fitted[i][k]);
        if (workers < MIN_POP) return;
        pops.push({
          id: id++,
          state: s.code,
          culture: c.id,
          job: j.id,
          workers,
          dependents: Math.round(workers * (1 / LABOR_FORCE_RATE - 1)),
        });
      });
    });
  }
  return pops;
}

export function popLabel(_p: Pop, cultureAdj: string, jobName: string, stateName: string): string {
  return `${cultureAdj} ${jobName.toLowerCase()}s from ${stateName}`;
}
