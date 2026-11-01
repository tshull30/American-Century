import {
  answerPoach, BOARD_KIND, DEMAND_TEXT, fireExec, hireExec, leadEffects, leadershipCost, refreshCandidates, ROLE_EFFECT, ROLE_NAME, ROLE_SHORT, ROLES, TRAITS,
  type Exec, type ExecRole,
} from "../../sim/leadership";
import { dateLabel, fmtMoney, fmtPct } from "../../sim/util";
import { Bar, Panel, Table, useGame, useSticky } from "../components";

function Stars({ n }: { n: number }) {
  const full = Math.floor(n), half = n - full >= 0.5;
  return <span className="stars" title={`Skill ${n} of 5`}>{"★".repeat(full)}{half ? "½" : ""}<span className="muted">{"☆".repeat(5 - full - (half ? 1 : 0))}</span></span>;
}

function Traits({ e }: { e: Exec }) {
  return <span>{e.traits.map((t) => <span key={t} className={`trait ${TRAITS[t].bad ? "bad" : ""}`} title={TRAITS[t].effect}>{TRAITS[t].name}</span>)}</span>;
}

const pctDelta = (x: number) => `${x >= 1 ? "+" : "−"}${Math.abs((x - 1) * 100).toFixed(0)}%`;

export function Leadership() {
  const { s, me, act, ask } = useGame();
  const L = me.leadership;
  const [role, setRole] = useSticky<ExecRole | "">("lead.role", "");
  if (!L) return <Panel title="Leadership"><p className="hint">This company has no leadership data (an older save).</p></Panel>;
  const b = L.board;
  const cands = role ? L.candidates?.[role] ?? [] : [];
  const conf = b.confidence;
  const allies = b.members.filter((d) => d.loyalty * 0.45 + 0.25 + 0.5 * (conf - 0.5) >= 0.5 && d.kind !== "activist").length;

  const openSearch = (r: ExecRole) => {
    if (!L.candidates?.[r]?.length) refreshCandidates(s, me, r);
    setRole(r);
  };

  return (
    <div className="grid2">
      <div>
        <Panel title="Executives" right={`Pay and board fees ${fmtMoney(leadershipCost(me))} a month`}>
          <Table
            rows={ROLES}
            rowKey={(r) => r}
            cols={[
              { key: "r", label: "Role", render: (r) => <span title={ROLE_EFFECT[r]}>{ROLE_SHORT[r]}</span> },
              { key: "n", label: "Name", render: (r) => { const e = L.execs.find((x) => x.role === r); return e ? <span>{e.name} <span className="muted">{e.age}</span></span> : <span className="neg">Vacant</span>; } },
              { key: "k", label: "Skill", render: (r) => { const e = L.execs.find((x) => x.role === r); return e ? <Stars n={e.skill} /> : ""; } },
              { key: "t", label: "Traits", render: (r) => { const e = L.execs.find((x) => x.role === r); return e ? <Traits e={e} /> : ""; } },
              { key: "p", label: "Pay", num: true, render: (r) => { const e = L.execs.find((x) => x.role === r); return e ? fmtMoney(e.pay) : ""; } },
              { key: "a", label: "", render: (r) => {
                const e = L.execs.find((x) => x.role === r);
                return (
                  <span className="row" style={{ flexWrap: "nowrap" }}>
                    <button className="small" onClick={() => openSearch(r)}>{e ? "Replace" : "Hire"}</button>
                    {e && <button className="small" onClick={() => ask(`Fire ${e.name}? Severance is a year's pay (${fmtMoney(e.pay)}) and the seat stays empty until you hire someone.`, () => act(fireExec(s, me, e.id)))}>Fire</button>}
                  </span>
                );
              } },
            ]}
          />
          <p className="hint">
            What your team does right now: research {pctDelta(leadEffects.research(me))}, output per worker {pctDelta(leadEffects.efficiency(me))},
            marketing {pctDelta(leadEffects.marketing(me))}, valuation {pctDelta(leadEffects.valuation(me))}, borrowing cost {leadEffects.interest(me) <= 0 ? "−" : "+"}{Math.abs(leadEffects.interest(me) * 100).toFixed(1)} points.
            A vacant seat counts as worse than a bad executive.
          </p>
        </Panel>

        {L.poach && (() => {
          const e = L.execs.find((x) => x.id === L.poach!.execId);
          return e ? (
            <Panel title="A rival wants your people">
              <p style={{ marginTop: 0 }}>{L.poach.rival} has offered your {ROLE_SHORT[e.role]}, {e.name}, {fmtMoney(L.poach.pay)} a year (now {fmtMoney(e.pay)}). The offer expires in {Math.max(0, L.poach.deadlineDay - s.day)} days.</p>
              <div className="row">
                <button className="primary" onClick={() => act(answerPoach(s, me, true))}>Match the offer</button>
                <button onClick={() => act(answerPoach(s, me, false))}>Let them go</button>
              </div>
            </Panel>
          ) : null;
        })()}

        {role && (
          <Panel help="executives" title={`Candidates for ${ROLE_NAME[role]}`} right={<span className="row">
            <button className="small" onClick={() => { me.cash -= 2e6; refreshCandidates(s, me, role); act({ ok: true, message: "The headhunters sent a fresh list ($2M)." }); }}>New search ($2M)</button>
            <button className="small" onClick={() => setRole("")}>Close</button>
          </span>}>
            <Table
              rows={cands}
              rowKey={(e) => e.id}
              cols={[
                { key: "n", label: "Name", render: (e) => <span>{e.name} <span className="muted">{e.age}</span></span> },
                { key: "k", label: "Skill", render: (e) => <Stars n={e.skill} />, sort: (e) => e.skill },
                { key: "t", label: "Traits", render: (e) => <Traits e={e} /> },
                { key: "f", label: "Now at", render: (e) => e.from ?? <span className="muted">Available</span> },
                { key: "p", label: "Asking", num: true, render: (e) => fmtMoney(e.pay), sort: (e) => e.pay },
                { key: "h", label: "", render: (e) => <button className="small primary" onClick={() => { act(hireExec(s, me, role, e.id)); }}>Hire</button> },
              ]}
            />
          </Panel>
        )}
      </div>

      <div>
        <Panel help="board" title="Board of directors" right={`Annual meeting ${dateLabel(b.nextMeeting)}`}>
          <div className="row" style={{ marginBottom: 8 }}>
            <span>Confidence in management</span>
            <Bar value={conf} tone={conf > 0.6 ? "good" : conf < 0.35 ? "bad" : "warn"} />
            <strong className={conf > 0.6 ? "pos" : conf < 0.35 ? "neg" : ""}>{fmtPct(conf, 0)}</strong>
            <span className="muted">about {allies} of {b.members.length} would back you today</span>
          </div>
          <Table
            rows={b.members}
            rowKey={(d) => d.id}
            cols={[
              { key: "n", label: "Director", render: (d) => d.name },
              { key: "k", label: "Seat", render: (d) => <span className={d.kind === "activist" ? "neg" : ""}>{BOARD_KIND[d.kind]}</span>, sort: (d) => d.kind },
              { key: "l", label: "Leaning", render: (d) => d.kind === "activist" ? <span className="neg">Hostile</span> : d.loyalty > 0.7 ? "Ally" : d.loyalty > 0.45 ? "Neutral" : <span className="warn">Skeptic</span>, sort: (d) => d.loyalty },
              { key: "s", label: "Since", render: (d) => dateLabel(d.since), sort: (d) => d.since },
            ]}
          />
        </Panel>

        {b.activist && (
          <Panel help="activists" title={`Activist investor: ${b.activist.fund}`}>
            <p style={{ marginTop: 0 }}>Owns {fmtPct(b.activist.stake, 1)} of the company and demands: <strong>{DEMAND_TEXT[b.activist.demand]}</strong>.</p>
            {b.activist.demand === "buyback" && <p>Bought back so far: {fmtMoney(b.activist.boughtBack)} of {fmtMoney(b.activist.buybackTarget)} (Finance tab).</p>}
          </Panel>
        )}

        <Panel title="Recent board votes">
          {b.votes.length === 0 ? <p className="hint">No votes yet.</p> : (
            <ul className="events">{b.votes.map((v, i) => <li key={i}><span className="when">{dateLabel(v.month)}</span><span className={v.yes > v.no ? "good" : "bad"}>{v.text}: {v.yes > v.no ? "approved" : "rejected"} {Math.max(v.yes, v.no)}–{Math.min(v.yes, v.no)}</span></li>)}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
