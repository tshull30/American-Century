// Compares cash movement against reported profit for the player.
import { newGame, player, tick } from "../src/sim/engine";
import { fmtMoney } from "../src/sim/util";
const keys = (process.argv[2] ?? "orchard,verdant,kestrel,lattice").split(",");
for (const key of keys) {
  const s = newGame({ kind: "incumbent", key }, 7);
  const me = player(s);
  console.log(`\n== ${me.name}  start cash ${fmtMoney(me.cash)} debt ${fmtMoney(me.debt)} ppe ${fmtMoney(me.ppe)}`);
  let prevNet = me.cash - me.debt;
  const startMonth = s.month;
  while (s.month < startMonth + 8) {
    const m = s.month; while (s.month === m) tick(s);
    const r = me.history[me.history.length - 1];
    const net = me.cash - me.debt;
    const bp = me.buildings.reduce((a, b) => a + b.lastProfit, 0);
    console.log(`m${m} rev ${fmtMoney(r.revenue)} in ${fmtMoney(r.inputCosts)} wag ${fmtMoney(r.wages)} rd ${fmtMoney(r.rdCost)} sga ${fmtMoney(r.sgaCost)} mkt ${fmtMoney(r.marketing)} dep ${fmtMoney(r.depreciation)} int ${fmtMoney(r.interest)} tax ${fmtMoney(r.taxes)} capex ${fmtMoney(r.capex)} div ${fmtMoney(r.dividends ?? 0)} | NI ${fmtMoney(r.netIncome)}  dNetCash ${fmtMoney(net - prevNet)}  bldgProfit ${fmtMoney(bp)}`);
    prevNet = net;
  }
}
