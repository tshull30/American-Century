import { GOOD_BY_ID, type GoodId } from "../../sim/data/goods";
import { adminCapacity, adminLoad, interestRate, revenueGrowth, ttm } from "../../sim/engine";
import { tierOf } from "../../sim/tiers";
import { dateLabel, dayLabel, fmtMoney, fmtNum, fmtPct } from "../../sim/util";
import { LineChart, Panel, Signed, Stat, Table, useGame } from "../components";

export function Overview() {
  const { s, me } = useGame();
  const rev = ttm(me, "revenue");
  const ni = ttm(me, "netIncome");
  const emp = Object.values(me.employees).reduce((a, b) => a + b, 0);
  const tier = tierOf(me.marketCap);
  const peers = s.companies.filter((c) => c.alive && tierOf(c.marketCap).id === tier.id).sort((a, b) => b.marketCap - a.marketCap);
  const hist = me.history.slice(-60);
  const last = me.history[me.history.length - 1];
  const myEvents = s.events.filter((e) => e.companyId === me.id || e.kind === "deal" || e.kind === "politics").slice(-12).reverse();
  const load = adminLoad(me), cap = adminCapacity(me);

  const alerts: string[] = [];
  if (load > cap) alerts.push(`Headquarters overloaded (${load}/${cap} building levels): every building is running below full efficiency. Expand HQ.`);
  for (const b of me.buildings) if (b.level > 0 && b.staffRatio < 0.8) { alerts.push(`Understaffed buildings: some sites are below 80% staffed. See Workforce.`); break; }
  if (me.distressMonths > 0) alerts.push(`Debt exceeds what lenders will support. ${6 - me.distressMonths} months until default.`);
  if (last && last.netIncome < 0 && me.cash < -last.netIncome * 6) alerts.push(`Less than six months of cash at the current burn rate. Raise money or cut costs.`);

  return (
    <div className="grid2">
      <div>
        <Panel title="Company" right={me.tagline}>
          <div className="stats">
            <Stat label="Market cap" value={fmtMoney(me.marketCap)} sub={`${fmtMoney(me.marketCap / me.shares, 2)} per share`} />
            <Stat label="Revenue (TTM)" value={fmtMoney(rev)} sub={<>growth <Signed value={revenueGrowth(me)} fmt={(x) => fmtPct(x)} /></>} />
            <Stat label="Net income (TTM)" value={<Signed value={ni} fmt={(x) => fmtMoney(x)} />} sub={rev > 0 ? `margin ${fmtPct(ni / rev)}` : "pre-revenue"} />
            <Stat label="Employees" value={fmtNum(emp)} sub={`${me.buildings.length} sites`} />
            <Stat label="Cash" value={fmtMoney(me.cash)} sub={`debt ${fmtMoney(me.debt)}`} />
            <Stat label="Tier" value={tier.name} sub={`#${peers.findIndex((c) => c.id === me.id) + 1} of ${peers.length}`} />
          </div>
          {alerts.length > 0 && <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>{alerts.map((a) => <li key={a} className="warn">{a}</li>)}</ul>}
        </Panel>
        <Panel title="Market cap">
          <LineChart data={hist.map((h) => ({ x: dateLabel(h.month), y: h.marketCap }))} fmt={(v) => fmtMoney(v, 1)} />
        </Panel>
        <Panel title="Monthly net income">
          <LineChart zero data={hist.map((h) => ({ x: dateLabel(h.month), y: h.netIncome }))} fmt={(v) => fmtMoney(v, 1)} />
        </Panel>
      </div>
      <div>
        <Panel title={`${tier.name} league table`} right="You compete with every company in your tier">
          <Table
            rows={peers}
            rowKey={(c) => c.id}
            rowClass={(c) => (c.id === me.id ? "me" : "")}
            cols={[
              { key: "rank", label: "#", render: (c) => peers.indexOf(c) + 1 },
              { key: "name", label: "Company", render: (c) => <><span className="swatch" style={{ background: c.color }} /> {c.name}</> },
              { key: "mcap", label: "Market cap", num: true, render: (c) => fmtMoney(c.marketCap) },
              { key: "rev", label: "Revenue TTM", num: true, render: (c) => fmtMoney(ttm(c, "revenue")) },
              { key: "ni", label: "Net income", num: true, render: (c) => <Signed value={ttm(c, "netIncome")} fmt={(x) => fmtMoney(x)} /> },
              { key: "g", label: "Growth", num: true, render: (c) => <Signed value={revenueGrowth(c)} fmt={(x) => fmtPct(x, 0)} /> },
            ]}
          />
        </Panel>
        <Panel title="Revenue by product (last month)">
          <Table
            rows={(Object.entries(last?.revenueByGood ?? {}) as [GoodId, number][]).filter(([, v]) => v > 0)}
            rowKey={([g]) => g}
            initialSort="rev"
            cols={[
              { key: "g", label: "Product", render: ([g]) => GOOD_BY_ID[g].name },
              { key: "u", label: "Units", num: true, render: ([g]) => fmtNum(last?.unitsSold[g] ?? 0) },
              { key: "rev", label: "Revenue", num: true, render: ([, v]) => fmtMoney(v), sort: ([, v]) => v },
              { key: "sh", label: "Share of revenue", num: true, render: ([, v]) => fmtPct(v / Math.max(1, last!.revenue)) },
            ]}
          />
        </Panel>
        <Panel title="Economy" right={s.macro.recession ? <span className="neg">Recession</span> : undefined}>
          <div className="stats">
            <Stat label="GDP growth" value={fmtPct(s.macro.gdpGrowth, 1)} sub={`output gap ${fmtPct(s.macro.gap, 1)}`} />
            <Stat label="Inflation" value={fmtPct(s.macro.inflation, 1)} />
            <Stat label="Fed funds rate" value={fmtPct(s.macro.fedRate, 2)} sub={`your borrowing ${fmtPct(interestRate(s, me), 1)}`} />
            <Stat label="Living standard" value={s.sol.toFixed(0)} sub="100 = 2026 average" />
          </div>
          {s.worldEvents.length > 0 && (
            <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {s.worldEvents.map((e) => <li key={e.id}><strong>{e.name}</strong> <span className="muted">until {dayLabel(e.untilDay)}</span>: {e.description}</li>)}
            </ul>
          )}
        </Panel>
        <Panel title="News">
          <ul className="events">
            {myEvents.map((e, i) => <li key={i}><span className="when">{dayLabel(e.day)}</span><span className={e.kind}>{e.text}</span></li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
