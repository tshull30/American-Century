import { buildQuote, downsize, expand, setMethod } from "../../sim/actions";
import { BUILDING_BY_ID, methodOf, SECTORS, type SectorId } from "../../sim/data/buildings";
import { GOOD_BY_ID, type GoodId } from "../../sim/data/goods";
import { cityLabel } from "../../sim/geo";
import { adminCapacity, adminLoad } from "../../sim/engine";
import { complexityMult, conglomerateDiscount, knowhowMult, scaleMult, sectorLevels, SCALE_REF } from "../../sim/sectors";
import type { Building } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct } from "../../sim/util";
import { Bar, Panel, Table, useGame, useSticky } from "../components";
import { BuildPanel } from "./BuildPanel";

export function Production() {
  const { s, me, act, ask } = useGame();
  const load = adminLoad(me), cap = adminCapacity(me);
  const [filter, setFilter] = useSticky("prod.filter", "all");
  const types = [...new Set(me.buildings.map((b) => b.type))].sort();
  const rows = me.buildings.filter((b) => filter === "all" || (filter === "abroad" ? !!s.cities[b.city]?.foreign : filter === "losing" ? b.lastProfit < 0 && b.type !== "hq" && b.type !== "rnd" : b.type === filter))
    .sort((a, b) => a.type.localeCompare(b.type) || b.level - a.level);
  const [step, setStep] = useSticky("prod.step", 1);
  const tot = rows.reduce((a, b) => ({ lv: a.lv + b.level, w: a.w + b.lastWages, p: a.p + (b.type === "hq" || b.type === "rnd" ? 0 : b.lastProfit), o: a.o + (b.type === "hq" || b.type === "rnd" ? -b.lastProfit : 0) }), { lv: 0, w: 0, p: 0, o: 0 });

  return (
    <div>
      <Panel
        title="Buildings"
        right={<span className="row">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show buildings">
            <option value="all">All buildings</option>
            <option value="losing">Losing money</option>
            <option value="abroad">Abroad</option>
            {types.map((t) => <option key={t} value={t}>{BUILDING_BY_ID[t].name}</option>)}
          </select>
          Step <select value={step} onChange={(e) => setStep(Number(e.target.value))}>{[1, 5, 10, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
          <span className={load > cap ? "neg" : "muted"}>HQ capacity {fmtNum(load)} / {fmtNum(cap)} levels</span>
          <label title="Add HQ levels automatically when headquarters runs out of capacity"><input type="checkbox" checked={!!me.autoHq} onChange={(e) => { me.autoHq = e.target.checked; act({ ok: true, message: e.target.checked ? "Headquarters will grow automatically." : "Automatic HQ growth off." }); }} /> Grow HQ automatically</label></span>}
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
              { key: "p", label: "Profit last month", num: true, title: "Sales value of output minus inputs, wages and running costs (before depreciation). Headquarters and R&D show their cost.", render: (b) => b.type === "hq" || b.type === "rnd" ? <span className="muted" title="Overhead: counted in the income statement, not a loss-making site">{fmtMoney(-b.lastProfit)} cost</span> : <span className={b.lastProfit >= 0 ? "pos" : "neg"}>{fmtMoney(b.lastProfit)}</span>, sort: (b) => b.lastProfit },
              { key: "act", label: "", render: (b) => (
                <span className="row" style={{ flexWrap: "nowrap" }}>
                  <button className="small" onClick={() => act(expand(s, me.id, b.id, step))} title={`Build ${step} more level(s): ${fmtMoney(buildQuote(s, b.type, b.city, step, b.method, me).total)}`}>+{step}</button>
                  <button className="small" disabled={b.level <= 0} onClick={() => ask(`Close ${Math.min(step, b.level)} level(s) of ${BUILDING_BY_ID[b.type].name} in ${cityLabel(s, b.city)}? Workers are laid off, the town will remember, and only 20% of book value is recovered.`, () => act(downsize(s, me.id, b.id, step)))}>−{step}</button>
                </span>
              ) },
            ]}
          />
        </div>
        <div className="hint" style={{ marginTop: 6 }}>{rows.length} sites, {fmtNum(tot.lv)} levels; wages {fmtMoney(tot.w)} a month; site profit last month <span className={tot.p >= 0 ? "pos" : "neg"}>{fmtMoney(tot.p)}</span>{tot.o > 0 ? <>, headquarters and R&D cost {fmtMoney(tot.o)}</> : null}. Net income after marketing, depreciation, interest and tax is <span className={(me.history.at(-1)?.netIncome ?? 0) >= 0 ? "pos" : "neg"}>{fmtMoney(me.history.at(-1)?.netIncome ?? 0)}</span>.</div>
      </Panel>
      <IndustriesPanel />
      <BuildPanel />
    </div>
  );
}

function IndustriesPanel() {
  const { me } = useGame();
  const lv = sectorLevels(me);
  const rows = (Object.keys(lv) as SectorId[]).map((id) => ({ id, levels: lv[id] ?? 0, k: me.knowhow?.[id] ?? 1 }));
  if (!rows.length) return null;
  const n = rows.length;
  return (
    <Panel help="industries" title="Industries" right={n > 2 ? <span className="warn">{n} industries: HQ workload +{fmtPct(complexityMult(me) - 1, 0)}, investors discount you {fmtPct(conglomerateDiscount(me), 0)}</span> : `${n} ${n === 1 ? "industry" : "industries"}`}>
      <Table rows={rows} rowKey={(r) => r.id} cols={[
        { key: "n", label: "Industry", render: (r) => SECTORS[r.id].name },
        { key: "l", label: "Levels", num: true, render: (r) => fmtNum(r.levels), sort: (r) => r.levels },
        { key: "k", label: "Know-how", num: true, title: "Grows about 4% of the gap each month you operate; related industries give a head start", render: (r) => <span className={r.k < 0.6 ? "warn" : ""}>{fmtPct(r.k, 0)}</span>, sort: (r) => r.k },
        { key: "s", label: "Scale", num: true, title: `Full economies of scale at ${SCALE_REF} levels`, render: (r) => fmtPct(scaleMult(r.levels), 0), sort: (r) => r.levels },
        { key: "e", label: "Efficiency from both", num: true, render: (r) => fmtPct(knowhowMult(r.k) * scaleMult(r.levels), 0), sort: (r) => knowhowMult(r.k) * scaleMult(r.levels) },
      ]} />
    </Panel>
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
