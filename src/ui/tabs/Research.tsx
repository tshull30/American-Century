import { setResearchAlloc } from "../../sim/actions";
import { TECHS, GOOD_BY_ID } from "../../sim/data/goods";
import { BASELINE_TECH_START, researchCost, researchOutput } from "../../sim/engine";
import { fmtMoney, fmtNum } from "../../sim/util";
import { cancelMoonshot, FUNDING, MOONSHOTS, startMoonshot, type Funding } from "../../sim/fun";
import { Bar, Panel, Table, useGame } from "../components";

export function Research() {
  const { s, me, act } = useGame();
  const pts = researchOutput(me);
  const wsum = Object.values(me.researchAlloc).reduce((a, b) => a + (b ?? 0), 0);
  const labs = me.buildings.filter((b) => b.type === "rnd").reduce((a, b) => a + b.level, 0);
  return (
    <div>
      <Panel help="research" title="Research" right={`${fmtNum(pts)} points / month from ${fmtNum(labs)} R&D lab levels`}>
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
      <Moonshots />
    </div>
  );
}

function Moonshots() {
  const { s, me, act } = useGame();
  return (
    <Panel help="moonshots" title="Moonshots" right="Long bets that change the company if they work. Two at a time.">
      <div className="moonshots">
        {MOONSHOTS.map((m) => {
          const st = me.moonshots?.[m.id];
          const done = me.perks?.includes(m.id);
          const rivals = s.companies.filter((c) => c.alive && !c.isPlayer && (c.moonshots?.[m.id] || c.perks?.includes(m.id)));
          return (
            <article key={m.id} className={`moonshot ${st ? "active" : ""} ${done ? "done" : ""}`}>
              <h3>{m.name}</h3>
              <p className="blurb">{m.blurb}</p>
              <dl>
                <dt>Payoff</dt><dd>{m.payoff}</dd>
                <dt>Cost</dt><dd>{fmtMoney(m.monthly)} a month at full funding</dd>
                <dt>Time</dt><dd>about {m.months} months; {Math.round(m.odds * 100)}% odds the prototype works</dd>
                {rivals.length > 0 && <><dt>Rivals</dt><dd>{rivals.map((c) => `${c.name}${c.perks?.includes(m.id) ? " (done)" : ""}`).join(", ")}</dd></>}
              </dl>
              {done ? <span className="deal-stamp ok">Achieved</span> : st ? (
                <>
                  <div className="row" style={{ flexWrap: "nowrap" }}><Bar value={st.progress} tone={undefined} /><span className="muted small">{Math.round(st.progress * 100)}%, {fmtMoney(st.spent)} spent{st.attempts ? `, attempt ${st.attempts + 1}` : ""}</span></div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <div className="segmented small">
                      {(Object.keys(FUNDING) as Funding[]).map((f) => <button key={f} className={st.funding === f ? "on" : ""} onClick={() => act(startMoonshot(s, me, m.id, f))}>{FUNDING[f].name}</button>)}
                    </div>
                    <button className="small danger" onClick={() => act(cancelMoonshot(me, m.id))}>Shut it down</button>
                  </div>
                </>
              ) : (
                <div className="row" style={{ marginTop: 6 }}>
                  <button onClick={() => act(startMoonshot(s, me, m.id, "full"))}>Launch the program</button>
                  <button className="small" onClick={() => act(startMoonshot(s, me, m.id, "lean"))}>Start lean</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
