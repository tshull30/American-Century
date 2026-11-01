import { setResearchAlloc } from "../../sim/actions";
import { TECHS, GOOD_BY_ID } from "../../sim/data/goods";
import { BASELINE_TECH_START, researchCost, researchOutput } from "../../sim/engine";
import { fmtNum } from "../../sim/util";
import { Bar, Panel, Table, useGame } from "../components";

export function Research() {
  const { s, me, act } = useGame();
  const pts = researchOutput(me);
  const wsum = Object.values(me.researchAlloc).reduce((a, b) => a + (b ?? 0), 0);
  const labs = me.buildings.filter((b) => b.type === "rnd").reduce((a, b) => a + b.level, 0);
  return (
    <div>
      <Panel title="Research" right={`${fmtNum(pts)} points / month from ${fmtNum(labs)} R&D lab levels`}>
        <p className="hint">
          Every tech level above the market baseline makes your products about 8% better, and buyers weigh quality squared.
          The rest of the market improves by one level a year, so standing still means falling behind. Bigger product lines
          cost more research per level, and every level of lead costs 40% more. Build R&D labs on the Production tab.
        </p>
        <Table
          rows={TECHS}
          rowKey={(t) => t.id}
          cols={[
            { key: "t", label: "Technology", render: (t) => t.name },
            { key: "g", label: "Improves", render: (t) => t.goods.map((g) => GOOD_BY_ID[g].name).join(", ") },
            { key: "lv", label: "Your level", num: true, render: (t) => (me.tech[t.id] ?? BASELINE_TECH_START).toFixed(1) },
            { key: "base", label: "Market", num: true, render: (t) => (s.baselineTech[t.id] ?? BASELINE_TECH_START).toFixed(1) },
            { key: "lead", label: "Lead", num: true, render: (t) => { const d = (me.tech[t.id] ?? 0) - (s.baselineTech[t.id] ?? 0); return <span className={d >= 0 ? "pos" : "neg"}>{d >= 0 ? "+" : ""}{d.toFixed(1)}</span>; } },
            { key: "prog", label: "Progress to next level", render: (t) => { const c = researchCost(s, me, t.id); const p = me.researchPoints[t.id] ?? 0; return <span className="row" style={{ flexWrap: "nowrap" }}><Bar value={p / c} tone={undefined} />{fmtNum(p)} / {fmtNum(c)}</span>; } },
            { key: "eta", label: "ETA", num: true, render: (t) => { const share = wsum > 0 ? (me.researchAlloc[t.id] ?? 0) / wsum : 0; const rate = pts * share; if (rate <= 0) return "–"; const left = researchCost(s, me, t.id) - (me.researchPoints[t.id] ?? 0); return `${Math.ceil(left / rate)} mo`; } },
            { key: "a", label: "Priority", render: (t) => (
              <span className="row" style={{ flexWrap: "nowrap" }}>
                <input type="range" min={0} max={10} step={1} value={me.researchAlloc[t.id] ?? 0} onChange={(e) => act(setResearchAlloc(s, me.id, t.id, Number(e.target.value)))} />
                <span className="muted" style={{ width: 36 }}>{wsum > 0 ? Math.round(((me.researchAlloc[t.id] ?? 0) / wsum) * 100) : 0}%</span>
              </span>
            ) },
          ]}
        />
      </Panel>
    </div>
  );
}
