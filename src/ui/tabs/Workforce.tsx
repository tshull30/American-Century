import { useMemo } from "react";
import { setWagePolicy } from "../../sim/actions";
import { CULTURE_BY_ID, CULTURES, type CultureId } from "../../sim/data/cultures";
import { JOB_BY_ID, type JobId } from "../../sim/data/jobs";
import { STATE_BY_CODE } from "../../sim/data/states";
import { staffNeeds } from "../../sim/engine";
import { cityLabel } from "../../sim/geo";
import { JOBS } from "../../sim/data/jobs";
import { fmtMoney, fmtNum, fmtPct, laborKey } from "../../sim/util";
import { Bar, Panel, Table, useGame } from "../components";

export function Workforce() {
  const { s, me, act } = useGame();
  const needs = staffNeeds(me);
  const keys = Array.from(new Set([...Object.keys(needs), ...Object.keys(me.employees)]));
  const cells = keys.map((k) => {
    const cell = s.labor[k];
    const have = me.employees[k] ?? 0;
    const need = needs[k] ?? 0;
    return { k, cell, have, need };
  }).filter((r) => r.cell);
  const total = cells.reduce((a, r) => a + r.have, 0);
  const wageBill = cells.reduce((a, r) => a + r.have * r.cell.wage * me.wagePolicy, 0);

  // Who works for you: split each labor cell across the pops (culture groups) that live in it.
  const groups = useMemo(() => {
    const out = new Map<string, { label: string; culture: CultureId; job: JobId; state: string; n: number }>();
    const byCulture = new Map<CultureId, number>();
    for (const { k, cell, have } of cells) {
      if (have <= 0) continue;
      const pops = s.pops.filter((p) => p.state === cell.state && p.job === cell.job);
      const sum = pops.reduce((a, p) => a + p.workers, 0);
      for (const p of pops) {
        const n = (have * p.workers) / sum;
        const key = `${k}:${p.culture}`;
        out.set(key, {
          label: `${CULTURE_BY_ID[p.culture].adjective} ${JOB_BY_ID[p.job].plural.toLowerCase()} from ${STATE_BY_CODE[p.state].name}`,
          culture: p.culture, job: p.job, state: p.state, n,
        });
        byCulture.set(p.culture, (byCulture.get(p.culture) ?? 0) + n);
      }
    }
    return { list: Array.from(out.values()).sort((a, b) => b.n - a.n), byCulture };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.month, total]);

  return (
    <div className="grid2">
      <div>
        <Panel title="Pay">
          <div className="row">
            Wage offer <input type="range" min={0.7} max={1.6} step={0.05} value={me.wagePolicy} onChange={(e) => act(setWagePolicy(s, me.id, Number(e.target.value)))} style={{ width: 220 }} />
            <strong>{fmtPct(me.wagePolicy, 0)}</strong> of the local market wage
          </div>
          <p className="hint">Paying above market wins you a bigger share of the workers available each month (about 5% of each local pool can be hired monthly). Hiring a big share of a state's workforce pushes local wages up for everyone.</p>
          <div className="stats">
            <div className="stat"><div className="label">Employees</div><div className="value">{fmtNum(total)}</div></div>
            <div className="stat"><div className="label">Monthly payroll</div><div className="value">{fmtMoney(wageBill)}</div></div>
            <div className="stat"><div className="label">Open positions</div><div className="value">{fmtNum(cells.reduce((a, r) => a + Math.max(0, r.need - r.have), 0))}</div></div>
          </div>
        </Panel>
        <Panel title="Labor by city and job">
          <div className="scroll">
            <Table
              rows={cells}
              rowKey={(r) => r.k}
              initialSort="have"
              cols={[
                { key: "st", label: "City", render: (r) => cityLabel(s, r.cell.city), sort: (r) => r.cell.city },
                { key: "job", label: "Job", render: (r) => JOB_BY_ID[r.cell.job].plural, sort: (r) => r.cell.job },
                { key: "have", label: "Employed", num: true, render: (r) => fmtNum(r.have), sort: (r) => r.have },
                { key: "fill", label: "Filled", render: (r) => <Bar value={r.need ? r.have / r.need : 1} />, sort: (r) => (r.need ? r.have / r.need : 1) },
                { key: "wage", label: "Your wage", num: true, render: (r) => fmtMoney(r.cell.wage * me.wagePolicy, 1), sort: (r) => r.cell.wage },
                { key: "pool", label: "Local workforce", num: true, render: (r) => fmtNum(r.cell.workforce), sort: (r) => r.cell.workforce },
                { key: "taken", label: "Taken by companies", num: true, render: (r) => fmtPct(r.cell.gameEmployed / r.cell.workforce), sort: (r) => r.cell.gameEmployed / r.cell.workforce, title: "Share of the local pool already working for companies in the game" },
                { key: "short", label: "Shortage", num: true, render: (r) => r.cell.shortage > 1 ? <span className="warn">{fmtNum(r.cell.shortage)}</span> : "", sort: (r) => r.cell.shortage },
              ]}
            />
          </div>
        </Panel>
      </div>
      <div>
        <Panel title="Who works for you" right="Your workforce mirrors the local pops you hire from">
          <div className="scroll" style={{ maxHeight: 340 }}>
            <Table
              rows={groups.list.slice(0, 60)}
              rowKey={(g) => g.label}
              cols={[
                { key: "l", label: "Pop", render: (g) => <><span className="swatch" style={{ background: CULTURE_BY_ID[g.culture].color }} /> {g.label}</> },
                { key: "n", label: "Employees", num: true, render: (g) => fmtNum(g.n), sort: (g) => g.n },
                { key: "sh", label: "Share", num: true, render: (g) => fmtPct(g.n / Math.max(1, total)) },
              ]}
            />
          </div>
        </Panel>
        <Panel title="Who likes you" right={`National image ${fmtPct(me.image, 0)}`}>
          <Table rows={JOBS} rowKey={(j) => j.id} cols={[
            { key: "j", label: "Pop type", render: (j) => j.plural },
            { key: "o", label: "Opinion of you", render: (j) => { const o = me.jobOpinion[j.id] ?? 0.5; return <span className="row" style={{ flexWrap: "nowrap" }}><Bar value={o} tone={o > 0.6 ? "good" : o < 0.4 ? "bad" : undefined} /><span className={o > 0.6 ? "pos" : o < 0.4 ? "neg" : ""}>{fmtPct(o, 0)}</span></span>; }, sort: (j) => me.jobOpinion[j.id] ?? 0.5 },
          ]} />
          <p className="hint">Workers who like you are easier to hire. Pay above market and HQ perks help; layoffs and overcharging for necessities hurt, especially with service workers, laborers and clerks. Each city's view of you is on the Pops & Map tab.</p>
        </Panel>
        <Panel title="Workforce by culture">
          <Table
            rows={CULTURES.filter((c) => (groups.byCulture.get(c.id) ?? 0) > 0)}
            rowKey={(c) => c.id}
            initialSort="n"
            cols={[
              { key: "c", label: "Culture", render: (c) => <><span className="swatch" style={{ background: c.color }} /> {c.name}</> },
              { key: "n", label: "Employees", num: true, render: (c) => fmtNum(groups.byCulture.get(c.id) ?? 0), sort: (c) => groups.byCulture.get(c.id) ?? 0 },
              { key: "sh", label: "Share", num: true, render: (c) => fmtPct((groups.byCulture.get(c.id) ?? 0) / Math.max(1, total)) },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

export { laborKey };
