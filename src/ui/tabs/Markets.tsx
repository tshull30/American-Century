import { useState } from "react";
import { setAutoPrice, setPrice } from "../../sim/actions";
import { GOOD_BY_ID, GOODS, type GoodId } from "../../sim/data/goods";
import { quality } from "../../sim/engine";
import { fmtMoney, fmtNum, fmtPct, fmtPrice } from "../../sim/util";
import { LineChart, Panel, Table, useGame } from "../components";
import { dateLabel } from "../../sim/util";
import { holdLaunch, launchCost } from "../../sim/fun";

export function Markets() {
  const { s, me, act } = useGame();
  const myGoods = (Object.keys(me.prices) as GoodId[]).filter((g) => g !== "components");
  const last = me.history[me.history.length - 1];
  const [view, setView] = useState<GoodId>(myGoods[0] ?? "smartphones");
  const snap = s.markets[view];
  const g = GOOD_BY_ID[view];

  return (
    <div>
      <Panel help="launches" title="Launch events" right="A keynote can make a product, or embarrass it. Once every nine months per product.">
        <Table
          rows={myGoods.filter((g) => GOOD_BY_ID[g].tech)}
          rowKey={(x) => x}
          cols={[
            { key: "g", label: "Product", render: (g) => GOOD_BY_ID[g].name },
            { key: "q", label: "Quality vs market", num: true, render: (g) => { const q = quality(s, me, g); return <span className={q >= 1.05 ? "pos" : q < 0.97 ? "neg" : ""}>{q >= 1 ? "+" : "−"}{Math.abs((q - 1) * 100).toFixed(0)}%</span>; } },
            { key: "c", label: "Event cost", num: true, render: (g) => fmtMoney(launchCost(me, g)) },
            { key: "l", label: "Last launch", render: (g) => me.launches?.[g] !== undefined ? dateLabel(me.launches[g]!) : <span className="muted">never</span> },
            { key: "a", label: "", render: (g) => (
              <span className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                <button className="small" onClick={() => act(holdLaunch(s, me, g, false))} title="Safer: smaller upside, small downside">Careful reveal</button>
                <button className="small" onClick={() => act(holdLaunch(s, me, g, true))} title="Big hype: huge if the product is better than the market's, ugly if it isn't">Promise the moon</button>
              </span>
            ) },
          ]}
        />
      </Panel>
      <Panel title="Your products" right="Auto-pricing raises prices when you sell out and cuts them when stock piles up">
        <Table
          rows={myGoods}
          rowKey={(x) => x}
          cols={[
            { key: "g", label: "Product", render: (x) => <a style={{ cursor: "pointer" }} onClick={() => setView(x)}>{GOOD_BY_ID[x].name}</a> },
            { key: "p", label: "Price", render: (x) => <PriceInput good={x} /> },
            { key: "auto", label: "Auto", render: (x) => <input type="checkbox" checked={!!me.autoPrice[x]} onChange={(e) => act(setAutoPrice(s, me.id, x, e.target.checked))} /> },
            { key: "ref", label: "Market price", num: true, render: (x) => fmtPrice(s.markets[x]?.avgPrice ?? GOOD_BY_ID[x].refPrice) },
            { key: "uc", label: "Unit cost", num: true, render: (x) => me.unitCost[x] ? fmtPrice(me.unitCost[x]!) : "–", title: "Inputs + production wages + running costs per unit, last month" },
            { key: "m", label: "Margin", num: true, render: (x) => { const p = me.prices[x] ?? 0, c = me.unitCost[x]; return c ? <span className={p > c ? "pos" : "neg"}>{fmtPct((p - c) / p, 0)}</span> : "–"; } },
            { key: "prod", label: "Made / mo", num: true, render: (x) => fmtNum(me.buildings.reduce((a, b) => a + (b.lastOutput[x] ?? 0), 0)) },
            { key: "sold", label: "Sold / mo", num: true, render: (x) => fmtNum(last?.unitsSold[x] ?? 0) },
            { key: "own", label: "Used in-house", num: true, render: (x) => fmtNum(me.inputUse[x] ?? 0) },
            { key: "inv", label: "In stock", num: true, render: (x) => fmtNum(me.inventory[x] ?? 0) },
            { key: "share", label: "Market share", num: true, render: (x) => fmtPct(s.markets[x]?.sales[me.id]?.share ?? 0, 2) },
            { key: "q", label: "Quality", num: true, render: (x) => quality(s, me, x).toFixed(2), title: "1.00 = market average. Raised by research." },
            { key: "b", label: "Brand", num: true, render: (x) => ((me.brand[x] ?? 0) * 100).toFixed(2), title: "Awareness: grows with your share of supply and your marketing budget" },
          ]}
        />
        {myGoods.length === 0 && <div className="hint">You don't sell anything yet. Build a production building.</div>}
      </Panel>

      <Panel help="markets" title="Market detail" right={
        <select value={view} onChange={(e) => setView(e.target.value as GoodId)}>
          {GOODS.filter((x) => x.marketUS + x.marketWorld > 0).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      }>
        {snap ? (
          <>
            <div className="stats" style={{ marginBottom: 10 }}>
              <div className="stat"><div className="label">Demand / month</div><div className="value">{fmtNum(snap.demandUnits)}</div><div className="sub">{g.unit}</div></div>
              <div className="stat"><div className="label">Market size / yr</div><div className="value">{fmtMoney(snap.demandUnits * snap.avgPrice * 12)}</div></div>
              <div className="stat"><div className="label">Average price</div><div className="value">{fmtPrice(snap.avgPrice)}</div><div className="sub">reference {fmtPrice(g.refPrice)}</div></div>
              <div className="stat"><div className="label">Everyone else</div><div className="value">{fmtPct(snap.othersShare, 0)}</div><div className="sub">at {fmtPrice(snap.othersPrice)}</div></div>
              {g.importPrice && <div className="stat"><div className="label">Imports / month</div><div className="value">{fmtNum(snap.importsUnits)}</div><div className="sub">at {fmtPrice(g.importPrice)}</div></div>}
            </div>
            {snap.priceHistory.length > 2 && (
              <div style={{ marginBottom: 10 }}>
                <div className="hint">Average market price, monthly</div>
                <LineChart height={130} data={snap.priceHistory.map((y, i) => ({ x: dateLabel(s.month - snap.priceHistory.length + i), y }))} fmt={fmtPrice} />
              </div>
            )}
            <Table
              rows={Object.entries(snap.sales).map(([id, x]) => ({ c: s.companies.find((c) => c.id === Number(id))!, ...x })).filter((r) => r.c)}
              rowKey={(r) => r.c.id}
              rowClass={(r) => (r.c.id === me.id ? "me" : "")}
              initialSort="rev"
              cols={[
                { key: "c", label: "Seller", render: (r) => <><span className="swatch" style={{ background: r.c.color }} /> {r.c.name}</> },
                { key: "p", label: "Price", num: true, render: (r) => fmtPrice(r.price), sort: (r) => r.price },
                { key: "u", label: "Units", num: true, render: (r) => fmtNum(r.units), sort: (r) => r.units },
                { key: "rev", label: "Revenue / mo", num: true, render: (r) => fmtMoney(r.revenue), sort: (r) => r.revenue },
                { key: "sh", label: "Share", num: true, render: (r) => fmtPct(r.share, 2), sort: (r) => r.share },
                { key: "q", label: "Quality", num: true, render: (r) => quality(s, r.c, view).toFixed(2), sort: (r) => quality(s, r.c, view) },
              ]}
            />
          </>
        ) : <div className="hint">No data yet.</div>}
      </Panel>
    </div>
  );
}

function PriceInput({ good }: { good: GoodId }) {
  const { s, me, act } = useGame();
  const p = me.prices[good] ?? GOOD_BY_ID[good].refPrice;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft.replace(/[$,]/g, ""));
    if (v > 0) act(setPrice(s, me.id, good, v));
    setDraft(null);
  };
  return (
    <span className="row" style={{ flexWrap: "nowrap", gap: 3 }}>
      <button className="small" onClick={() => act(setPrice(s, me.id, good, p * 0.95))} title="Cut 5%">−</button>
      <input
        style={{ width: 90, textAlign: "right" }}
        value={draft ?? (p >= 100 ? Math.round(p).toString() : p.toFixed(2))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
      />
      <button className="small" onClick={() => act(setPrice(s, me.id, good, p * 1.05))} title="Raise 5%">+</button>
    </span>
  );
}
