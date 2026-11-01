import { useState } from "react";
import { antitrustIssue, liquidity, offer } from "../../sim/actions";
import { boardOdds, BREAK_FEE, blockChance, requiredPremium, scrutiny } from "../../sim/deals";
import { dayLabel } from "../../sim/util";
import { GOOD_BY_ID, type GoodId } from "../../sim/data/goods";
import { STATE_BY_CODE } from "../../sim/data/states";
import { revenueGrowth, ttm } from "../../sim/engine";
import { tierOf } from "../../sim/tiers";
import type { Company } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct } from "../../sim/util";
import { Panel, Signed, Table, useGame } from "../components";

export function Rivals() {
  const { s, me, act } = useGame();
  const [target, setTarget] = useState<Company | null>(null);
  const alive = s.companies.filter((c) => c.alive);
  return (
    <div className="grid2">
      <Panel title="All companies">
        <div className="scroll" style={{ maxHeight: 640 }}>
          <Table
            rows={alive}
            rowKey={(c) => c.id}
            rowClass={(c) => (c.id === me.id ? "me" : "")}
            initialSort="mcap"
            cols={[
              { key: "n", label: "Company", render: (c) => <a style={{ cursor: "pointer" }} onClick={() => setTarget(c)}><span className="swatch" style={{ background: c.color }} /> {c.name}</a>, sort: (c) => c.name },
              { key: "tier", label: "Tier", render: (c) => tierOf(c.marketCap).name },
              { key: "mcap", label: "Market cap", num: true, render: (c) => fmtMoney(c.marketCap), sort: (c) => c.marketCap },
              { key: "rev", label: "Revenue TTM", num: true, render: (c) => fmtMoney(ttm(c, "revenue")), sort: (c) => ttm(c, "revenue") },
              { key: "ni", label: "Net income", num: true, render: (c) => <Signed value={ttm(c, "netIncome")} fmt={(x) => fmtMoney(x)} />, sort: (c) => ttm(c, "netIncome") },
              { key: "g", label: "Growth", num: true, render: (c) => <Signed value={revenueGrowth(c)} fmt={(x) => fmtPct(x, 0)} />, sort: (c) => revenueGrowth(c) },
              { key: "ceo", label: "CEO", render: (c) => { const e = c.leadership?.execs.find((x) => x.role === "ceo"); return e ? <span title={`Skill ${e.skill} of 5`}>{e.name}</span> : <span className="muted">Vacant</span>; } },
              { key: "p", label: "Products", render: (c) => (Object.keys(c.prices) as GoodId[]).map((g) => GOOD_BY_ID[g].name).join(", ") },
            ]}
          />
        </div>
      </Panel>
      <div>
        {s.deals.length > 0 && (
          <Panel title="Pending deals">
            <Table rows={s.deals} rowKey={(d) => d.id} cols={[
              { key: "b", label: "Buyer", render: (d) => s.companies.find((c) => c.id === d.buyerId)?.name },
              { key: "t", label: "Target", render: (d) => s.companies.find((c) => c.id === d.targetId)?.name },
              { key: "p", label: "Price", num: true, render: (d) => fmtMoney(d.price) },
              { key: "st", label: "Stage", render: (d) => (d.stage === "second_request" ? "In-depth antitrust review" : "Closing") },
              { key: "e", label: "Expected", render: (d) => dayLabel(s.day + d.daysLeft) },
            ]} />
          </Panel>
        )}
        {target && target.alive ? (
          <Panel title={target.name}>
            <p className="hint" style={{ marginTop: 0 }}>{target.tagline}</p>
            <table className="t"><tbody>
              <tr><td>Headquarters</td><td className="num">{STATE_BY_CODE[target.hq].name}</td></tr>
              <tr><td>Market cap</td><td className="num">{fmtMoney(target.marketCap)}</td></tr>
              <tr><td>Revenue / net income (TTM)</td><td className="num">{fmtMoney(ttm(target, "revenue"))} / {fmtMoney(ttm(target, "netIncome"))}</td></tr>
              <tr><td>Cash / debt</td><td className="num">{fmtMoney(target.cash)} / {fmtMoney(target.debt)}</td></tr>
              <tr><td>Employees</td><td className="num">{fmtNum(Object.values(target.employees).reduce((a, b) => a + b, 0))}</td></tr>
              <tr><td>Sites</td><td className="num">{target.buildings.length} in {new Set(target.buildings.map((b) => b.state)).size} states</td></tr>
            </tbody></table>
            {target.id !== me.id && <AcquireBox target={target} onDone={() => setTarget(null)} />}
          </Panel>
        ) : (
          <Panel title="Mergers and acquisitions">
            <p className="hint">Click a company to make an offer. Its board wants a premium (more for startups, hot stocks and established companies), regulators may open an in-depth review, and deals take months to close. You get every plant, worker, product, brand and technology the target owns, with its cash and its debt.</p>
          </Panel>
        )}
      </div>
    </div>
  );

  function AcquireBox({ target, onDone }: { target: Company; onDone: () => void }) {
    const [premium, setPremium] = useState(Math.round(requiredPremium(s, me, target) * 100) / 100);
    const [payment, setPayment] = useState<"cash" | "stock">("cash");
    const price = target.marketCap * (1 + premium);
    const block = antitrustIssue(s, me, target);
    const odds = boardOdds(s, me, target, premium);
    const review = scrutiny(s, me, target, price);
    const killed = blockChance(s, me, target, price);
    return (
      <div style={{ marginTop: 12 }}>
        <div className="row">
          Premium <input type="range" min={0} max={1.2} step={0.05} value={premium} onChange={(e) => setPremium(Number(e.target.value))} style={{ width: 200 }} />
          <strong>{fmtPct(premium, 0)}</strong> over market, <strong>{fmtMoney(price)}</strong>
        </div>
        <div className="row">
          Pay with
          <select value={payment} onChange={(e) => setPayment(e.target.value as "cash" | "stock")}><option value="cash">Cash and credit</option><option value="stock">Your stock</option></select>
        </div>
        <table className="t" style={{ marginTop: 8 }}><tbody>
          <tr><td>Board accepts</td><td className="num">{fmtPct(odds, 0)} chance</td></tr>
          <tr><td>In-depth antitrust review</td><td className="num">{fmtPct(review, 0)} chance, 6–14 months</td></tr>
          <tr><td>If reviewed, blocked</td><td className="num">{fmtPct(killed, 0)} chance; you'd owe a {fmtMoney(price * BREAK_FEE)} break fee</td></tr>
          <tr><td>Without review</td><td className="num">closes in 2–3 months</td></tr>
        </tbody></table>
        {block && <div className="neg" style={{ marginTop: 6 }}>{block}</div>}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" disabled={!!block} onClick={() => { const r = offer(s, me.id, target.id, premium, payment); act(r); if (r.ok) onDone(); }}>Make the offer</button>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>
          Cash and credit available: {fmtMoney(liquidity(me))}; cash deals must still be fundable at closing. Stock deals can't issue more than 30% new shares. Big buyers draw far more scrutiny, and so does a Congress full of populists and progressives.
        </div>
      </div>
    );
  }
}
