// Runs the economy headlessly and prints how the companies evolve.
// Usage: npm run calibrate -- [years] [seed]
import { newGame, tick, ttm } from "../src/sim/engine";
import { tierOf } from "../src/sim/tiers";
import { dateLabel, dayLabel, fmtMoney, fmtNum, fmtPct } from "../src/sim/util";
import type { GameState } from "../src/sim/types";

const years = Number(process.argv[2] ?? 5);
const seed = Number(process.argv[3] ?? 42);
const s = newGame({ kind: "incumbent", key: "orchard" }, seed);

function table(s: GameState) {
  console.log(`\n=== ${dateLabel(s.month)} ===`);
  console.log("company".padEnd(26), "mcap".padStart(9), "rev ttm".padStart(9), "NI ttm".padStart(9), "cash".padStart(9), "debt".padStart(9), "emp".padStart(8), "tier");
  const cs = s.companies.filter((c) => c.alive).sort((a, b) => b.marketCap - a.marketCap);
  for (const c of cs.slice(0, 22)) {
    const emp = Object.values(c.employees).reduce((a, b) => a + b, 0);
    console.log(
      c.name.slice(0, 25).padEnd(26), fmtMoney(c.marketCap).padStart(9), fmtMoney(ttm(c, "revenue")).padStart(9),
      fmtMoney(ttm(c, "netIncome")).padStart(9), fmtMoney(c.cash).padStart(9), fmtMoney(c.debt).padStart(9),
      fmtNum(emp).padStart(8), tierOf(c.marketCap).name,
    );
  }
  console.log("markets:");
  for (const [g, m] of Object.entries(s.markets)) {
    if (!m) continue;
    const top = Object.entries(m.sales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 3)
      .map(([id, x]) => `${s.companies.find((c) => c.id === Number(id))!.ticker} ${(x.share * 100).toFixed(0)}% @${x.price.toFixed(0)}`).join(", ");
    console.log(`  ${g.padEnd(16)} D=${fmtNum(m.demandUnits).padStart(7)} others=${(m.othersShare * 100).toFixed(0)}% @${m.othersPrice.toFixed(0)}  ${top}`);
  }
}

table(s);
const t0 = Date.now();
for (let y = 0; y < years; y++) {
  const target = s.month + 12;
  while (s.month < target && !s.gameOver) tick(s);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s) SoL ${s.sol.toFixed(1)}  gap ${fmtPct(s.macro.gap)}  fed ${fmtPct(s.macro.fedRate)}  infl ${fmtPct(s.macro.inflation)}  pres ${s.politics.president} cong ${s.politics.congress}  laws ${JSON.stringify(s.politics.laws)}`);
  table(s);
  if (s.gameOver) { console.log("GAME OVER:", s.gameOver); break; }
}
console.log("\nrecent events:");
for (const e of s.events.slice(-25)) console.log(" ", dayLabel(e.day), e.text);
