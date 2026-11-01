import { useState } from "react";
import { borrow, buyback, issueShares, repay, setMarketing } from "../../sim/actions";
import { creditLimit, ebitdaTTM, interestRate, ttm } from "../../sim/engine";
import type { MonthReport } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct } from "../../sim/util";
import { Panel, useGame } from "../components";

const LINES: [keyof MonthReport, string, number][] = [
  ["revenue", "Revenue", 1],
  ["inputCosts", "Purchased inputs", -1],
  ["wages", "Production wages & running costs", -1],
  ["rdCost", "Research & development", -1],
  ["sgaCost", "Headquarters (SG&A)", -1],
  ["marketing", "Marketing", -1],
  ["depreciation", "Depreciation", -1],
  ["interest", "Interest", -1],
  ["taxes", "Taxes", -1],
  ["netIncome", "Net income", 1],
];

export function Finance() {
  const { s, me, act } = useGame();
  const last = me.history[me.history.length - 1];
  const limit = creditLimit(me);
  const [amount, setAmount] = useState(100);
  const unit = me.marketCap > 50e9 ? 1e9 : 1e6;
  const amt = amount * unit;
  const invValue = Object.entries(me.inventory).reduce((a, [, q]) => a + (q ?? 0), 0);
  void invValue;

  return (
    <div className="grid2">
      <div>
        <Panel title="Income statement">
          <table className="t">
            <thead><tr><th></th><th className="num">Last month</th><th className="num">Trailing 12 months</th></tr></thead>
            <tbody>
              {LINES.map(([k, label, sign]) => {
                const m = (last?.[k] as number) ?? 0;
                const y = ttm(me, k);
                const bold = k === "revenue" || k === "netIncome";
                return (
                  <tr key={k} style={bold ? { fontWeight: 600 } : undefined}>
                    <td>{label}</td>
                    <td className={`num ${k === "netIncome" ? (m >= 0 ? "pos" : "neg") : ""}`}>{fmtMoney(sign * m)}</td>
                    <td className={`num ${k === "netIncome" ? (y >= 0 ? "pos" : "neg") : ""}`}>{fmtMoney(sign * y)}</td>
                  </tr>
                );
              })}
              <tr><td>Capital spending (construction)</td><td className="num">{fmtMoney(-(last?.capex ?? 0))}</td><td className="num">{fmtMoney(-ttm(me, "capex"))}</td></tr>
            </tbody>
          </table>
        </Panel>
        <Panel title="Marketing">
          <div className="row">
            Budget <input type="range" min={0} max={0.2} step={0.005} value={me.marketingPct} onChange={(e) => act(setMarketing(s, me.id, Number(e.target.value)))} style={{ width: 220 }} />
            <strong>{fmtPct(me.marketingPct, 1)}</strong> of revenue
          </div>
          <p className="hint">Marketing multiplies brand awareness, so buyers choose you over rivals at the same price. Diminishing returns: 4% is typical, 15% is a startup land grab.</p>
        </Panel>
      </div>
      <div>
        <Panel title="Balance sheet & credit">
          <table className="t"><tbody>
            <tr><td>Cash</td><td className="num">{fmtMoney(me.cash)}</td></tr>
            <tr><td>Plants & equipment (book)</td><td className="num">{fmtMoney(me.ppe)}</td></tr>
            <tr><td>Debt</td><td className="num">{fmtMoney(me.debt)}</td></tr>
            <tr><td>Credit limit</td><td className="num">{fmtMoney(limit)}</td></tr>
            <tr><td>Interest rate</td><td className="num">{fmtPct(interestRate(s, me), 1)}</td></tr>
            <tr><td>EBITDA (TTM)</td><td className="num">{fmtMoney(ebitdaTTM(me))}</td></tr>
            <tr><td>Shares outstanding</td><td className="num">{fmtNum(me.shares)}</td></tr>
            <tr><td>Share price</td><td className="num">{fmtMoney(me.marketCap / me.shares, 2)}</td></tr>
            <tr><td>Investor sentiment</td><td className="num">{me.hype.toFixed(2)}×</td></tr>
          </tbody></table>
          <p className="hint">If cash runs out, the company draws on its credit line automatically. Debt above the credit limit for six months means default. The limit is 3.5× EBITDA, plus 40% of plant value and 10% of market cap.</p>
        </Panel>
        <Panel title="Capital markets">
          <div className="row">
            Amount <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} /> {unit === 1e9 ? "billion" : "million"}
          </div>
          <div className="row">
            <button onClick={() => act(borrow(s, me.id, amt))}>Borrow {fmtMoney(amt)}</button>
            <button onClick={() => act(repay(s, me.id, amt))}>Repay {fmtMoney(amt)}</button>
            <button onClick={() => act(buyback(s, me.id, amt))}>Buy back {fmtMoney(amt)} of stock</button>
          </div>
          <div className="row">
            {[0.05, 0.1, 0.2].map((f) => (
              <button key={f} onClick={() => { if (confirm(`Sell ${f * 100}% new shares at an 8% discount (about ${fmtMoney(me.marketCap * f * 0.92)})?`)) act(issueShares(s, me.id, f)); }}>
                Issue {f * 100}% new shares
              </button>
            ))}
          </div>
          <p className="hint">Issuing shares raises cash without debt, but dilutes your ownership and slightly dents investor sentiment.</p>
        </Panel>
      </div>
    </div>
  );
}
