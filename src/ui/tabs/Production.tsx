import { useMemo, useState } from "react";
import { build, buildQuote, downsize, expand, liquidity, setMethod } from "../../sim/actions";
import { BUILDINGS, BUILDING_BY_ID, methodOf, type BuildingTypeId } from "../../sim/data/buildings";
import { GOOD_BY_ID, type GoodId } from "../../sim/data/goods";
import { JOB_BY_ID, type JobId } from "../../sim/data/jobs";
import { STATES, STATE_BY_CODE } from "../../sim/data/states";
import { adminCapacity, adminLoad } from "../../sim/engine";
import type { Building } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct, laborKey } from "../../sim/util";
import { Bar, Panel, Table, useGame } from "../components";

export function Production() {
  const { s, me, act, ask } = useGame();
  const load = adminLoad(me), cap = adminCapacity(me);
  const rows = me.buildings.slice().sort((a, b) => a.type.localeCompare(b.type) || b.level - a.level);
  const [step, setStep] = useState(1);

  return (
    <div>
      <Panel
        title="Buildings"
        right={<span className="row">Step <select value={step} onChange={(e) => setStep(Number(e.target.value))}>{[1, 5, 10, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
          <span className={load > cap ? "neg" : "muted"}>HQ capacity {fmtNum(load)} / {fmtNum(cap)} levels</span></span>}
      >
        <div className="scroll">
          <Table
            rows={rows}
            rowKey={(b) => b.id}
            cols={[
              { key: "type", label: "Building", render: (b) => BUILDING_BY_ID[b.type].name, sort: (b) => b.type },
              { key: "st", label: "State", render: (b) => STATE_BY_CODE[b.state].name, sort: (b) => b.state },
              { key: "m", label: "Production method", render: (b) => <MethodPicker b={b} /> },
              { key: "lv", label: "Level", num: true, render: (b) => fmtNum(b.level), sort: (b) => b.level },
              { key: "con", label: "Building", num: true, render: (b) => b.construction.length ? b.construction.map((j) => `+${j.levels} (${j.monthsLeft}mo)`).join(", ") : "", title: "Levels under construction (months left)" },
              { key: "staff", label: "Staffed", render: (b) => b.level > 0 ? <span className="row" style={{ flexWrap: "nowrap" }}><Bar value={b.staffRatio} />{fmtPct(b.staffRatio, 0)}</span> : "", sort: (b) => b.staffRatio },
              { key: "eff", label: "Efficiency", num: true, render: (b) => b.level > 0 ? fmtPct(b.efficiency, 0) : "", sort: (b) => b.efficiency },
              { key: "out", label: "Output / month", num: true, render: (b) => outputLabel(b) },
              { key: "w", label: "Wages / month", num: true, render: (b) => fmtMoney(b.lastWages), sort: (b) => b.lastWages },
              { key: "act", label: "", render: (b) => (
                <span className="row" style={{ flexWrap: "nowrap" }}>
                  <button className="small" onClick={() => act(expand(s, me.id, b.id, step))} title={`Build ${step} more level(s): ${fmtMoney(buildQuote(b.type, b.state, step).total)}`}>+{step}</button>
                  <button className="small" disabled={b.level <= 0} onClick={() => ask(`Close ${Math.min(step, b.level)} level(s) of ${BUILDING_BY_ID[b.type].name} in ${STATE_BY_CODE[b.state].name}? Workers are laid off and only 20% of book value is recovered.`, () => act(downsize(s, me.id, b.id, step)))}>−{step}</button>
                </span>
              ) },
            ]}
          />
        </div>
      </Panel>
      <BuildPanel />
    </div>
  );
}

function outputLabel(b: Building) {
  const def = methodOf(b.type, b.method);
  if (def.research) return `${fmtNum(def.research * b.level * b.efficiency)} research`;
  if (def.admin) return `+${fmtNum(def.admin * b.level)} admin`;
  return Object.entries(b.lastOutput).map(([g, q]) => `${fmtNum(q ?? 0)} ${GOOD_BY_ID[g as GoodId].unit}`).join(", ");
}

function MethodPicker({ b }: { b: Building }) {
  const { s, me, act, ask } = useGame();
  const def = BUILDING_BY_ID[b.type];
  if (def.methods.length < 2) return <span className="muted">{methodOf(b.type, b.method).name}</span>;
  return (
    <select value={b.method} onChange={(e) => {
      const m = methodOf(b.type, e.target.value);
      ask(`Retool to ${m.name}? Costs ${Math.round((m.retoolCost ?? 0.2) * 100)}% of the build cost of every level.`, () => act(setMethod(s, me.id, b.id, m.id)));
    }}>
      {def.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}

function BuildPanel() {
  const { s, me, act } = useGame();
  const [type, setType] = useState<BuildingTypeId>("software");
  const def = BUILDING_BY_ID[type];
  const [method, setMethodId] = useState(def.methods[0].id);
  const m = methodOf(type, method);
  const [state, setState] = useState(me.hq);
  const [levels, setLevels] = useState(1);
  const q = buildQuote(type, state, levels);
  const jobs = Object.entries(m.staff) as [JobId, number][];

  // Rank states for this building's staff: free workers and wages for its two biggest jobs.
  const ranking = useMemo(() => {
    const key = jobs.slice().sort((a, b) => b[1] - a[1]).slice(0, 2);
    return STATES.map((st) => {
      let free = Infinity, wage = 0;
      for (const [j, n] of key) {
        const cell = s.labor[laborKey(st.code, j)];
        const f = cell ? Math.max(0, cell.workforce - cell.gameEmployed) / n : 0;
        free = Math.min(free, f);
        wage += cell ? cell.wage * n : 0;
      }
      return { st, levelsHireable: free * 0.05, wage };
    }).sort((a, b) => b.levelsHireable - a.levelsHireable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, method, s.month]);

  return (
    <Panel title="Build">
      <div className="grid2">
        <div>
          <div className="row">
            <select value={type} onChange={(e) => { const t = e.target.value as BuildingTypeId; setType(t); setMethodId(BUILDING_BY_ID[t].methods[0].id); }}>
              {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {def.methods.length > 1 && (
              <select value={method} onChange={(e) => setMethodId(e.target.value)}>
                {def.methods.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {STATES.map((st) => <option key={st.code} value={st.code}>{st.name}</option>)}
            </select>
            <input type="number" min={1} value={levels} onChange={(e) => setLevels(Math.max(1, Math.floor(Number(e.target.value) || 1)))} /> levels
          </div>
          <p className="hint" style={{ margin: "8px 0" }}>{def.description}</p>
          <table className="t">
            <tbody>
              <tr><td>Cost</td><td className="num">{fmtMoney(q.total)} over {q.months} months</td></tr>
              <tr><td>Staff per level</td><td className="num">{jobs.map(([j, n]) => `${n} ${JOB_BY_ID[j].plural.toLowerCase()}`).join(", ")}</td></tr>
              <tr><td>Output per level / month</td><td className="num">
                {Object.entries(m.output).map(([g, n]) => `${fmtNum(n ?? 0)} ${GOOD_BY_ID[g as GoodId].unit}`).join(", ") || (m.research ? `${m.research} research` : `+${m.admin} admin capacity`)}
              </td></tr>
              {Object.keys(m.output).map((g) => Object.entries(GOOD_BY_ID[g as GoodId].recipe).length > 0 && (
                <tr key={g}><td>Inputs per unit</td><td className="num">{Object.entries(GOOD_BY_ID[g as GoodId].recipe).map(([ig, n]) => `${n} ${GOOD_BY_ID[ig as GoodId].name.toLowerCase()}`).join(", ")}</td></tr>
              ))}
              <tr><td>Your cash + credit</td><td className="num">{fmtMoney(liquidity(me))}</td></tr>
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={() => act(build(s, me.id, type, state, levels, method))}>Build {levels} level{levels > 1 ? "s" : ""}</button>
          </div>
        </div>
        <div>
          <div className="hint" style={{ marginBottom: 6 }}>Where to build: states ranked by how many levels' worth of staff you could hire per month for the two biggest jobs.</div>
          <div className="scroll" style={{ maxHeight: 300 }}>
            <Table
              rows={ranking}
              rowKey={(r) => r.st.code}
              rowClass={(r) => (r.st.code === state ? "me" : "")}
              cols={[
                { key: "st", label: "State", render: (r) => <a style={{ cursor: "pointer" }} onClick={() => setState(r.st.code)}>{r.st.name}</a> },
                { key: "h", label: "Hireable levels / mo", num: true, render: (r) => r.levelsHireable.toFixed(1), sort: (r) => r.levelsHireable },
                { key: "w", label: "Wage bill / level", num: true, render: (r) => fmtMoney(r.wage), sort: (r) => -r.wage },
                { key: "c", label: "Build cost / level", num: true, render: (r) => fmtMoney(buildQuote(type, r.st.code, 1).total) },
              ]}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
