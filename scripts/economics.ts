// Per-level economics of every building method at reference prices: revenue, inputs, wages, upkeep,
// EBITDA margin and payback. Usage: npx tsx scripts/economics.ts
import { BUILDINGS } from "../src/sim/data/buildings";
import { GOOD_BY_ID, type GoodId } from "../src/sim/data/goods";
import { JOB_BY_ID, type JobId } from "../src/sim/data/jobs";

const rows: string[] = [];
for (const b of BUILDINGS) {
  for (const m of b.methods) {
    if (!Object.keys(m.output).length) continue;
    let rev = 0, inputs = 0;
    for (const [g, q] of Object.entries(m.output) as [GoodId, number][]) {
      const def = GOOD_BY_ID[g];
      rev += q * def.refPrice;
      const rec = m.recipe?.[g] ?? def.recipe;
      for (const [ig, n] of Object.entries(rec) as [GoodId, number][]) inputs += q * n * (GOOD_BY_ID[ig].importPrice ?? GOOD_BY_ID[ig].refPrice);
    }
    let wages = 0;
    for (const [j, n] of Object.entries(m.staff) as [JobId, number][]) wages += n * JOB_BY_ID[j].baseWage;
    const up = m.upkeep ?? 0;
    const ebitda = rev - inputs - wages - up;
    const cost = b.cost * (m.costMult ?? 1);
    const dep = cost * 0.006;
    rows.push([
      `${b.id}/${m.id}`.padEnd(28), `rev ${(rev / 1e6).toFixed(2)}M`.padStart(12), `in ${(100 * inputs / rev).toFixed(0)}%`.padStart(7),
      `wage ${(100 * wages / rev).toFixed(0)}%`.padStart(9), `up ${(100 * up / rev).toFixed(0)}%`.padStart(7),
      `EBITDA ${(100 * ebitda / rev).toFixed(0)}%`.padStart(12), `payback ${(ebitda > 0 ? cost / ebitda / 12 : Infinity).toFixed(1)}y`.padStart(14),
      `EBIT/cost ${(100 * (ebitda - dep) * 12 / cost).toFixed(0)}%/y`.padStart(16),
    ].join(" "));
  }
}
console.log(rows.join("\n"));
