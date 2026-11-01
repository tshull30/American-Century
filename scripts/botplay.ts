// A crude "aggressive player" to check that a startup can grow. Usage: npx tsx scripts/botplay.ts [good] [years]
import { build, issueShares, setMarketing } from "../src/sim/actions";
import type { GoodId } from "../src/sim/data/goods";
import { newGame, player, tick, ttm } from "../src/sim/engine";
import { tierOf } from "../src/sim/tiers";
import { dateLabel, fmtMoney } from "../src/sim/util";
import { bestCity } from "../src/sim/ai";

const good = (process.argv[2] ?? "software") as GoodId;
const years = Number(process.argv[3] ?? 8);
const s = newGame({ kind: "startup", name: "Bot Co", ticker: "BOT", good, hq: "TX", city: "austin" }, 7);
const me = player(s);
setMarketing(s, me.id, 0.1);
for (let m = 0; m < years * 12 && !s.gameOver; m++) {
  const target = s.month + 1;
  while (s.month < target && !s.gameOver) tick(s);
  const last = me.history[me.history.length - 1];
  if (m % 3 === 0) {
    const prod = me.buildings.find((b) => b.type !== "hq" && b.type !== "rnd")!;
    let made = 0; for (const b of me.buildings) made += b.lastOutput[good] ?? 0;
    const sold = last.unitsSold[good] ?? 0;
    const building = me.buildings.some((b) => b.construction.length > 0 && b.type === prod.type);
    if (sold >= made * 0.9 && !building) {
      const levels = me.buildings.filter((b) => b.type === prod.type).reduce((a, b) => a + b.level, 0);
      const add = Math.max(1, Math.round(levels * 0.4));
      build(s, me.id, prod.type, bestCity(s, me, prod.type, prod.method), add, prod.method);
    }
    const load = me.buildings.filter((b) => b.type !== "hq").reduce((a, b) => a + b.level + b.construction.reduce((x, j) => x + j.levels, 0), 0);
    const hq = me.buildings.filter((b) => b.type === "hq").reduce((a, b) => a + b.level + b.construction.reduce((x, j) => x + j.levels, 0), 0);
    if (load > 5 + hq * 15) build(s, me.id, "hq", me.hqSite.city, Math.ceil((load - 5 - hq * 15) / 15) + 1);
    const rnd = me.buildings.filter((b) => b.type === "rnd").reduce((a, b) => a + b.level, 0);
    if (last.revenue * 0.1 > rnd * 900e3) build(s, me.id, "rnd", me.hqSite.city, Math.max(1, Math.round(rnd * 0.3)));
  }
  if (me.cash < Math.max(0, -last.netIncome) * 6 + 20e6 && me.marketCap > 30e6) issueShares(s, me.id, 0.15);
  if (m % 12 === 11) console.log(dateLabel(s.month), "mcap", fmtMoney(me.marketCap), "rev", fmtMoney(ttm(me, "revenue")), "NI", fmtMoney(ttm(me, "netIncome")), "cash", fmtMoney(me.cash), "debt", fmtMoney(me.debt), "price", me.prices[good]?.toFixed(1), tierOf(me.marketCap).name);
}
if (s.gameOver) console.log(s.gameOver);
{
  const h = me.history[me.history.length - 1];
  const f = (x: number) => fmtMoney(x);
  console.log("last month: rev", f(h.revenue), "inputs", f(h.inputCosts), "wages+running", f(h.wages), "R&D", f(h.rdCost), "HQ", f(h.sgaCost), "marketing", f(h.marketing), "dep", f(h.depreciation), "interest", f(h.interest), "NI", f(h.netIncome));
  for (const b of me.buildings) console.log("  ", b.type, b.city, b.level, "staff", b.staffRatio.toFixed(2), "eff", b.efficiency.toFixed(2), "profit", f(b.lastProfit), JSON.stringify(me.knowhow));
}
