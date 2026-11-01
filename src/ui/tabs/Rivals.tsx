import { useState } from "react";
import { acquire, acquisitionPrice, antitrustIssue, liquidity } from "../../sim/actions";
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
              { key: "p", label: "Products", render: (c) => (Object.keys(c.prices) as GoodId[]).map((g) => GOOD_BY_ID[g].name).join(", ") },
            ]}
          />
        </div>
      </Panel>
      <div>
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
          <Panel title="Mergers & acquisitions">
            <p className="hint">Click a company to see its details and make an offer. Acquisitions cost market cap plus a 30% premium. You get every plant, worker, product, brand and technology the target owns, along with its cash and its debt. Regulators block deals that would give you more than 40% of a market you both sell in.</p>
          </Panel>
        )}
      </div>
    </div>
  );

  function AcquireBox({ target, onDone }: { target: Company; onDone: () => void }) {
    const price = acquisitionPrice(target);
    const block = antitrustIssue(s, me, target);
    const cashOk = price <= liquidity(me);
    const stockOk = price <= me.marketCap * 0.5;
    return (
      <div style={{ marginTop: 12 }}>
        <div className="row"><strong>Offer price: {fmtMoney(price)}</strong> <span className="muted">(30% premium)</span></div>
        {block && <div className="neg" style={{ marginTop: 6 }}>{block}</div>}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" disabled={!!block || !cashOk} onClick={() => { const r = acquire(s, me.id, target.id, "cash"); act(r); if (r.ok) onDone(); }}>Pay cash</button>
          <button disabled={!!block || !stockOk} onClick={() => { const r = acquire(s, me.id, target.id, "stock"); act(r); if (r.ok) onDone(); }}>Pay in stock</button>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>
          Cash and credit available: {fmtMoney(liquidity(me))}. A stock deal issues {fmtPct(price / Math.max(1, me.marketCap), 1)} new shares{stockOk ? "" : " (shareholders won't accept more than 50%)"}.
        </div>
      </div>
    );
  }
}
