import { useMemo, useState } from "react";
import { build, buildQuote, downsize, expand, liquidity, setMethod } from "../../sim/actions";
import { BUILDINGS, BUILDING_BY_ID, methodOf, type BuildingTypeId } from "../../sim/data/buildings";
import { GOOD_BY_ID, type GoodId } from "../../sim/data/goods";
import { JOB_BY_ID, type JobId } from "../../sim/data/jobs";
import { STATES } from "../../sim/data/states";
import { citiesInState, cityLabel, dcPowerCost, opinionOf, permitBlock } from "../../sim/geo";
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
              { key: "st", label: "Location", render: (b) => cityLabel(s, b.city), sort: (b) => b.city },
              { key: "m", label: "Production method", render: (b) => <MethodPicker b={b} /> },
              { key: "lv", label: "Level", num: true, render: (b) => fmtNum(b.level), sort: (b) => b.level },
              { key: "con", label: "Building", num: true, render: (b) => b.construction.length ? b.construction.map((j) => `+${j.levels} (${j.daysLeft}d)`).join(", ") : "", title: "Levels under construction (days left)" },
              { key: "staff", label: "Staffed", render: (b) => b.level > 0 ? <span className="row" style={{ flexWrap: "nowrap" }}><Bar value={b.staffRatio} />{fmtPct(b.staffRatio, 0)}</span> : "", sort: (b) => b.staffRatio },
              { key: "eff", label: "Efficiency", num: true, render: (b) => b.level > 0 ? fmtPct(b.efficiency, 0) : "", sort: (b) => b.efficiency },
              { key: "out", label: "Output / month", num: true, render: (b) => outputLabel(b) },
              { key: "w", label: "Wages / month", num: true, render: (b) => fmtMoney(b.lastWages), sort: (b) => b.lastWages },
              { key: "p", label: "Profit last month", num: true, title: "Sales value of output minus inputs, wages and running costs (before depreciation). R&D and HQ show their cost.", render: (b) => <span className={b.lastProfit >= 0 ? "pos" : "neg"}>{fmtMoney(b.lastProfit)}</span>, sort: (b) => b.lastProfit },
              { key: "act", label: "", render: (b) => (
                <span className="row" style={{ flexWrap: "nowrap" }}>
                  <button className="small" onClick={() => act(expand(s, me.id, b.id, step))} title={`Build ${step} more level(s): ${fmtMoney(buildQuote(s, b.type, b.city, step, b.method, me).total)}`}>+{step}</button>
                  <button className="small" disabled={b.level <= 0} onClick={() => ask(`Close ${Math.min(step, b.level)} level(s) of ${BUILDING_BY_ID[b.type].name} in ${cityLabel(s, b.city)}? Workers are laid off, the town will remember, and only 20% of book value is recovered.`, () => act(downsize(s, me.id, b.id, step)))}>−{step}</button>
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
  const [city, setCity] = useState(me.hqSite.city);
  const [levels, setLevels] = useState(1);
  const [stateFilter, setStateFilter] = useState("all");
  const q = buildQuote(s, type, city, levels, method, me);
  const jobs = Object.entries(m.staff) as [JobId, number][];
  const block = permitBlock(s, city, me, type);
  const here = s.cities[city];

  // Rank cities for this building: hireable staff for its two biggest jobs, wages, land, permits, local mood.
  const ranking = useMemo(() => {
    const key = jobs.slice().sort((a, b) => b[1] - a[1]).slice(0, 2);
    return Object.values(s.cities).filter((c) => stateFilter === "all" || c.state === stateFilter).map((c) => {
      let free = Infinity, wage = 0;
      for (const [j, n] of key) {
        const cell = s.labor[laborKey(c.id, j)];
        const f = cell ? Math.max(0, cell.workforce - cell.gameEmployed) / n : 0;
        free = Math.min(free, f);
      }
      for (const [j, n] of jobs) wage += (s.labor[laborKey(c.id, j)]?.wage ?? 0) * n;
      return { c, hireable: free * 0.05, wage, cost: buildQuote(s, type, c.id, 1, method, me).total, months: buildQuote(s, type, c.id, 1, method, me).months, op: opinionOf(s, c.id, me), blocked: permitBlock(s, c.id, me, type) };
    }).sort((a, b) => b.hireable - a.hireable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, method, s.month, stateFilter]);

  return (
    <Panel title="Build">
      <div className="grid2">
        <div>
          <div className="row">
            <select value={type} onChange={(e) => { const t = e.target.value as BuildingTypeId; setType(t); setMethodId(BUILDING_BY_ID[t].methods[0].id); if (t === "hq") setCity(me.hqSite.city); }}>
              {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {def.methods.length > 1 && (
              <select value={method} onChange={(e) => setMethodId(e.target.value)}>
                {def.methods.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
              {STATES.map((st) => (
                <optgroup key={st.code} label={st.name}>
                  {citiesInState(s, st.code).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
            <input type="number" min={1} value={levels} onChange={(e) => setLevels(Math.max(1, Math.floor(Number(e.target.value) || 1)))} /> levels
          </div>
          <p className="hint" style={{ margin: "8px 0" }}>{def.description}</p>
          <table className="t">
            <tbody>
              <tr><td>Cost</td><td className="num">{fmtMoney(q.total)}{q.total < q.unsubsidized - 1 ? <span className="pos"> (subsidies and local incentives save {fmtMoney(q.unsubsidized - q.total)})</span> : null}</td></tr>
              <tr><td>Construction time</td><td className="num">{q.months.toFixed(1)} months, permitting included</td></tr>
              <tr><td>Staff per level</td><td className="num">{jobs.map(([j, n]) => `${n} ${JOB_BY_ID[j].plural.toLowerCase()}`).join(", ")}</td></tr>
              <tr><td>Output per level each month</td><td className="num">
                {Object.entries(m.output).map(([g, n]) => `${fmtNum(n ?? 0)} ${GOOD_BY_ID[g as GoodId].unit}`).join(", ") || (m.research ? `${m.research} research` : `${m.admin} admin capacity`)}
              </td></tr>
              {type === "datacenter" && here && <tr><td>Local grid</td><td className="num">{fmtNum(here.dcLoadMW)} of {fmtNum(here.gridMW)} MW used; power bill {fmtMoney(dcPowerCost(s, city))} per level a month</td></tr>}
              {here && <tr><td>{here.name}</td><td className="num">thinks of you: {fmtPct(opinionOf(s, city, me), 0)}; tax break {fmtPct(here.taxBreak, 0)}; data centers {here.dcStance}</td></tr>}
              <tr><td>Your cash and credit</td><td className="num">{fmtMoney(liquidity(me))}</td></tr>
            </tbody>
          </table>
          {block && <p className="neg">{block}</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" disabled={!!block} onClick={() => act(build(s, me.id, type, city, levels, method))}>Build {levels} level{levels > 1 ? "s" : ""} in {here?.name}</button>
          </div>
        </div>
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="hint">Where to build. Hireable is how many levels' worth of the two biggest jobs you could hire a month.</span>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="Filter by state">
              <option value="all">All states</option>
              {STATES.map((st) => <option key={st.code} value={st.code}>{st.name}</option>)}
            </select>
          </div>
          <div className="scroll" style={{ maxHeight: 360 }}>
            <Table
              rows={ranking}
              rowKey={(r) => r.c.id}
              rowClass={(r) => (r.c.id === city ? "me" : "")}
              cols={[
                { key: "c", label: "City", render: (r) => <a onClick={() => setCity(r.c.id)} style={r.blocked ? { color: "var(--seal)" } : undefined} title={r.blocked ?? undefined}>{cityLabel(s, r.c.id)}</a>, sort: (r) => r.c.name },
                { key: "h", label: "Hireable", num: true, render: (r) => r.hireable.toFixed(1), sort: (r) => r.hireable },
                { key: "w", label: "Wages per level", num: true, render: (r) => fmtMoney(r.wage), sort: (r) => -r.wage },
                { key: "k", label: "Cost per level", num: true, render: (r) => fmtMoney(r.cost), sort: (r) => -r.cost },
                { key: "t", label: "Months", num: true, render: (r) => r.months.toFixed(1), sort: (r) => -r.months },
                { key: "o", label: "Locals", num: true, title: "How the city feels about you", render: (r) => <span className={r.op < 0.35 ? "neg" : r.op > 0.65 ? "pos" : ""}>{fmtPct(r.op, 0)}</span>, sort: (r) => r.op },
                ...(type === "datacenter" ? [{ key: "p", label: "Power", num: true, render: (r: typeof ranking[number]) => `${r.c.powerIdx.toFixed(2)}x, ${fmtPct(r.c.dcLoadMW / r.c.gridMW, 0)} load`, sort: (r: typeof ranking[number]) => -r.c.powerIdx }] : []),
              ]}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
