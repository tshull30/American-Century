import { useState } from "react";
import { borrow, buyback, issueShares, repay, setDividend, setGuidance, setMarketing } from "../../sim/actions";
import { creditLimit, ebitdaTTM, interestRate, ttm } from "../../sim/engine";
import type { MonthReport } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct } from "../../sim/util";
import { Panel, Signed, useGame } from "../components";
import { CAUSES, computeRating, holdingValue, investmentGrade, setCause, tradeStake, type CauseId } from "../../sim/corp";

const LINES: [keyof MonthReport, string, number][] = [
  ["revenue", "Revenue", 1],
  ["inputCosts", "Purchased inputs", -1],
  ["tariffs", "  of which tariffs & freight", -1],
  ["wages", "Production wages & running costs", -1],
  ["rdCost", "Research & development", -1],
  ["sgaCost", "Headquarters (SG&A)", -1],
  ["marketing", "Marketing", -1],
  ["lobbying", "Lobbying & donations", -1],
  ["depreciation", "Depreciation", -1],
  ["interest", "Interest", -1],
  ["taxes", "Taxes", -1],
  ["netIncome", "Net income", 1],
];

export function Finance() {
  const { s, me, act, ask } = useGame();
  const last = me.history[me.history.length - 1];
  const limit = creditLimit(me);
  const [amount, setAmount] = useState(100);
  const unit = me.marketCap > 50e9 ? 1e9 : 1e6;
  const amt = amount * unit;

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
              <tr><td>Dividends paid</td><td className="num">{fmtMoney(-(last?.dividends ?? 0))}</td><td className="num">{fmtMoney(-ttm(me, "dividends"))}</td></tr>
              <tr><td>Capital spending (construction)</td><td className="num">{fmtMoney(-(last?.capex ?? 0))}</td><td className="num">{fmtMoney(-ttm(me, "capex"))}</td></tr>
              <tr><td className="muted">Month to date: revenue</td><td className="num muted">{fmtMoney(me.current.revenue)}</td><td></td></tr>
            </tbody>
          </table>
        </Panel>
        <Panel help="earnings" title="Earnings">
          {me.lastEarnings ? (() => {
            const e = me.lastEarnings;
            const v = e.verdict ?? (e.surprise >= 0 ? "beat" : "missed");
            return (
              <table className="t" style={{ marginBottom: 8 }}>
                <thead><tr><th>{e.quarter}</th><th className="num">Actual</th><th className="num">Expected</th><th className="num">Difference</th></tr></thead>
                <tbody>
                  <tr><td>Revenue</td><td className="num">{fmtMoney(e.revenue)}</td><td className="num">{fmtMoney(e.expected)}</td><td className={`num ${e.revenue >= e.expected ? "pos" : "neg"}`}>{e.revenue >= e.expected ? "+" : "−"}{fmtPct(Math.abs(e.revenue / e.expected - 1))}</td></tr>
                  {e.netIncome !== undefined && <tr><td>Net income</td><td className={`num ${e.netIncome >= 0 ? "pos" : "neg"}`}>{fmtMoney(e.netIncome)}</td><td className="num">{fmtMoney(e.expectedNI ?? 0)}</td><td className={`num ${e.netIncome >= (e.expectedNI ?? 0) ? "pos" : "neg"}`}>{e.netIncome >= (e.expectedNI ?? 0) ? "+" : "−"}{fmtMoney(Math.abs(e.netIncome - (e.expectedNI ?? 0)))}</td></tr>}
                  <tr><td colSpan={4}>Verdict: <strong className={v === "beat" ? "pos" : v === "missed" ? "neg" : ""}>{v === "beat" ? "beat estimates" : v === "missed" ? "missed estimates" : "in line"}</strong>{v === "missed" && (e.netIncome ?? 0) > 0 ? <span className="muted"> (still profitable; a miss means below Wall Street's forecast, not a loss)</span> : null}</td></tr>
                </tbody>
              </table>
            );
          })() : <div className="hint">You report your first quarter once you have enough history.</div>}
          <div className="row" style={{ marginBottom: 8 }}>
            Guidance
            <div className="segmented small">
              {([["low", "Lowball"], ["mid", "Realistic"], ["high", "Bold"]] as const).map(([k, l]) => (
                <button key={k} className={(me.guidance ?? "mid") === k ? "on" : ""} onClick={() => act(setGuidance(s, me.id, k))}>{l}</button>
              ))}
            </div>
            <span className="muted small">{(me.guidance ?? "mid") === "high" ? "Wall Street expects 3% more; the stock got a lift." : (me.guidance ?? "mid") === "low" ? "Wall Street expects 3% less; beats come easier." : "Analysts take your numbers at face value."} One change a quarter.</span>
          </div>
          <div className="row">
            Dividend <input type="range" min={0} max={0.8} step={0.05} value={me.dividendPct} onChange={(e) => act(setDividend(s, me.id, Number(e.target.value)))} style={{ width: 200 }} />
            <strong>{fmtPct(me.dividendPct, 0)}</strong> of quarterly profit
          </div>
          <div className="hint">Trailing dividend yield: {fmtPct(ttm(me, "dividends") / Math.max(1, me.marketCap), 2)}</div>
        </Panel>
        <Panel help="marketing" title="Marketing">
          <div className="row">
            Budget <input type="range" min={0} max={0.2} step={0.005} value={me.marketingPct} onChange={(e) => act(setMarketing(s, me.id, Number(e.target.value)))} style={{ width: 220 }} />
            <strong>{fmtPct(me.marketingPct, 1)}</strong> of revenue
          </div>
        </Panel>
      </div>
      <div>
        <Panel help="credit" title="Balance sheet & credit">
          <table className="t"><tbody>
            <tr><td>Cash</td><td className="num">{fmtMoney(me.cash)}</td></tr>
            <tr><td>Plants & equipment (book)</td><td className="num">{fmtMoney(me.ppe)}</td></tr>
            <tr><td>Debt</td><td className="num">{fmtMoney(me.debt)}</td></tr>
            <tr><td>Credit limit</td><td className="num">{fmtMoney(limit)}</td></tr>
            <tr><td>Credit rating</td><td className="num"><span className={`rating ${me.rating && investmentGrade(me.rating) ? "ig" : "junk"}`}>{me.rating ?? computeRating(me)}</span> <span className="muted small">{me.rating && investmentGrade(me.rating) ? "investment grade" : "junk"}</span></td></tr>
            <tr><td>Interest rate</td><td className="num">{fmtPct(interestRate(s, me), 1)}</td></tr>
            <tr><td>EBITDA (TTM)</td><td className="num">{fmtMoney(ebitdaTTM(me))}</td></tr>
            <tr><td>Shares outstanding</td><td className="num">{fmtNum(me.shares)}</td></tr>
            <tr><td>Share price</td><td className="num">{fmtMoney(me.marketCap / me.shares, 2)}</td></tr>
            <tr><td>Investor sentiment</td><td className="num">{me.hype.toFixed(2)}×</td></tr>
          </tbody></table>
        </Panel>
        <Panel help="shares" title="Capital markets">
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
              <button key={f} onClick={() => ask(`Sell ${f * 100}% new shares at an 8% discount (about ${fmtMoney(me.marketCap * f * 0.92)})?`, () => act(issueShares(s, me.id, f)))}>
                Issue {f * 100}% new shares
              </button>
            ))}
          </div>
        </Panel>
        <Portfolio />
        <Foundation />
      </div>
    </div>
  );
}

function Portfolio() {
  const { s, me, act } = useGame();
  const [pickId, setPickId] = useState<number>(0);
  const rows = Object.entries(me.holdings ?? {}).map(([id, h]) => ({ id: Number(id), h, c: s.companies.find((x) => x.id === Number(id)) })).filter((x) => x.c?.alive);
  const others = s.companies.filter((c) => c.alive && !c.isPlayer).sort((a, b) => b.marketCap - a.marketCap);
  const total = rows.reduce((a, r) => a + holdingValue(s, r.id, r.h), 0);
  const cost = rows.reduce((a, r) => a + r.h.cost, 0);
  const sel = pickId || others[0]?.id;
  return (
    <Panel help="portfolio" title="Stock portfolio" right={rows.length ? <>Worth {fmtMoney(total)}, <Signed value={total - cost} fmt={(x) => `${x >= 0 ? "+" : "−"}${fmtMoney(Math.abs(x))}`} /></> : "Empty"}>
      {rows.length > 0 && (
        <table className="t"><thead><tr><th>Company</th><th className="num">Stake</th><th className="num">Value</th><th className="num">Gain</th><th></th></tr></thead><tbody>
          {rows.map((r) => {
            const v = holdingValue(s, r.id, r.h);
            return <tr key={r.id}><td>{r.c!.name}</td><td className="num">{fmtPct(r.h.stake, 1)}</td><td className="num">{fmtMoney(v)}</td><td className="num"><Signed value={v - r.h.cost} fmt={(x) => fmtMoney(x)} /></td>
              <td className="row" style={{ flexWrap: "nowrap", gap: 4 }}><button className="small" onClick={() => act(tradeStake(s, me, r.id, 0.01))}>+1%</button><button className="small" onClick={() => act(tradeStake(s, me, r.id, -0.01))}>−1%</button><button className="small" onClick={() => act(tradeStake(s, me, r.id, -r.h.stake))}>Sell all</button></td></tr>;
          })}
        </tbody></table>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <select value={sel} onChange={(e) => setPickId(Number(e.target.value))} style={{ maxWidth: 260 }}>
          {others.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtMoney(c.marketCap)})</option>)}
        </select>
        <button onClick={() => act(tradeStake(s, me, sel, 0.01))}>Buy 1%</button>
        <button onClick={() => act(tradeStake(s, me, sel, 0.05))}>Buy 5%</button>
      </div>
      <p className="muted small">You collect dividends on what you own, and a stake comes off the price if you later buy the whole company. At 5% you have to disclose it, and their CEO notices.</p>
    </Panel>
  );
}

function Foundation() {
  const { me, act } = useGame();
  const base = Math.max(1e6, Math.round(ttm(me, "revenue") / 12 * 0.002 / 1e6) * 1e6);
  const total = Object.values(me.foundation ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <Panel help="foundation" title={`The ${me.name} Foundation`} right={total ? `${fmtMoney(total)} a month` : "Not funded"}>
      <table className="t policy"><tbody>
        {(Object.keys(CAUSES) as CauseId[]).map((id) => {
          const cur = me.foundation?.[id] ?? 0;
          return (
            <tr key={id}>
              <td><strong>{CAUSES[id].name}</strong></td>
              <td className="muted wrap" style={{ fontSize: 13 }}>{CAUSES[id].effect}</td>
              <td className="num">{cur ? fmtMoney(cur) : "–"}</td>
              <td className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                <button className="small" onClick={() => act(setCause(me, id, cur + base))}>+{fmtMoney(base)}</button>
                {cur > 0 && <button className="small" onClick={() => act(setCause(me, id, Math.max(0, cur - base)))}>−</button>}
              </td>
            </tr>
          );
        })}
      </tbody></table>
      <p className="muted small">Giving is counted as overhead. The effect grows with the square root of what you give, relative to your size.</p>
    </Panel>
  );
}
