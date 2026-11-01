import { useMemo } from "react";
import { GOOD_BY_ID } from "../../sim/data/goods";
import { JOBS } from "../../sim/data/jobs";
import { NEEDS, solTier } from "../../sim/data/needs";
import { STATES } from "../../sim/data/states";
import { dateLabel, fmtMoney, fmtPct } from "../../sim/util";
import { LineChart, Panel, Stat, Table, useGame } from "../components";

export function Consumers() {
  const { s, me } = useGame();
  const hist = s.macro.history.slice(-60);

  const byJob = useMemo(() => JOBS.map((j) => {
    let sum = 0, n = 0;
    for (const p of s.pops) if (p.job === j.id) { const k = p.workers + p.dependents; sum += p.sol * k; n += k; }
    return { j, sol: n ? sum / n : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [s.month]);
  const byState = useMemo(() => STATES.map((st) => {
    let sum = 0, n = 0;
    for (const p of s.pops) if (p.state === st.code) { const k = p.workers + p.dependents; sum += p.sol * k; n += k; }
    return { st, sol: n ? sum / n : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }).sort((a, b) => b.sol - a.sol), [s.month]);

  return (
    <div className="grid2">
      <div>
        <Panel help="consumers" title="American households">
          <div className="stats">
            <Stat label="Standard of living" value={s.sol.toFixed(1)} sub={`${solTier(s.sol)}; 100 is the 2026 average`} />
            <Stat label="Economy" value={s.macro.recession ? "Recession" : s.macro.gap > 0.01 ? "Boom" : "Steady"} sub={`output gap ${fmtPct(s.macro.gap, 1)}`} />
            <Stat label="Inflation" value={fmtPct(s.macro.inflation, 1)} sub={`Fed funds ${fmtPct(s.macro.fedRate, 2)}`} />
          </div>
        </Panel>
        <Panel title="Standard of living over time">
          <LineChart data={hist.map((h) => ({ x: dateLabel(h.month), y: h.sol }))} fmt={(v) => v.toFixed(1)} />
        </Panel>
        <Panel title="By occupation">
          <Table rows={byJob} rowKey={(r) => r.j.id} initialSort="sol" cols={[
            { key: "j", label: "Pop type", render: (r) => r.j.plural },
            { key: "sol", label: "Standard of living", num: true, render: (r) => r.sol.toFixed(0), sort: (r) => r.sol },
            { key: "t", label: "", render: (r) => <span className="muted">{solTier(r.sol)}</span> },
          ]} />
        </Panel>
      </div>
      <div>
        <Panel help="consumers" title="Needs" right="Satisfaction by income fifth: poorest → richest (1.00 = 2026 average)">
          <Table
            rows={NEEDS}
            rowKey={(n) => n.id}
            cols={[
              { key: "n", label: "Need", render: (n) => <>{n.name}{n.basic ? <span className="muted"> (basic)</span> : null}</> },
              { key: "g", label: "Met by", render: (n) => <span style={{ whiteSpace: "normal" }}>{n.goods.map((g, i) => {
                const sh = s.markets[g]?.sales[me.id]?.share;
                return <span key={g} title={sh ? `You hold ${fmtPct(sh, 2)} of this market` : undefined}>{GOOD_BY_ID[g].name}{sh ? " ★" : ""}{i < n.goods.length - 1 ? ", " : ""}</span>;
              })}</span> },
              { key: "sp", label: "US spending / yr", num: true, render: (n) => fmtMoney((s.needStats[n.id]?.spending ?? 0) * 12), sort: (n) => s.needStats[n.id]?.spending ?? 0 },
              { key: "pi", label: "Price index", num: true, title: "Average price of the goods that meet this need, vs. 2026", render: (n) => { const pi = s.needStats[n.id]?.priceIndex ?? 1; return <span className={pi > 1.05 ? "neg" : pi < 0.95 ? "pos" : ""}>{pi.toFixed(2)}</span>; } },
              { key: "q", label: "Satisfaction", render: (n) => {
                const q = s.needStats[n.id]?.byQuintile ?? [];
                return <span className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                  <span className="quint">{q.map((v, i) => <div key={i} title={`Fifth ${i + 1}: ${v.toFixed(2)}`} style={{ height: `${Math.min(1.6, v) / 1.6 * 22}px`, opacity: 0.5 + i * 0.12 }} />)}</span>
                  <span className="muted">{(q[0] ?? 0).toFixed(2)} → {(q[4] ?? 0).toFixed(2)}</span>
                </span>;
              } },
            ]}
          />
        </Panel>
        <Panel title="By state">
          <div className="scroll" style={{ maxHeight: 420 }}>
            <Table rows={byState} rowKey={(r) => r.st.code} initialSort="sol" cols={[
              { key: "st", label: "State", render: (r) => r.st.name, sort: (r) => r.st.name },
              { key: "sol", label: "Standard of living", num: true, render: (r) => r.sol.toFixed(0), sort: (r) => r.sol },
              { key: "t", label: "", render: (r) => <span className="muted">{solTier(r.sol)}</span> },
            ]} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
