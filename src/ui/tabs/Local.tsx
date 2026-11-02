import { useMemo, useState } from "react";
import { STATES, STATE_BY_CODE } from "../../sim/data/states";
import { cityPolitics, cityWorkforce } from "../../sim/geo";
import {
  affectsPlayer, backCampaign, lobbyOrdinance, lobbyStateBill, meetOfficial, officials, ORD, reasonLocal, requestDeal, stateBillOdds, stateCorpTax, TEMPERAMENT, voteOdds,
  type CityGov, type LocalOfficial, type StateGov,
} from "../../sim/local";
import type { CityState } from "../../sim/types";
import { dateLabel, fmtMoney, fmtNum, fmtPct } from "../../sim/util";
import { Panel, Table, useGame, useSticky } from "../components";
import { BeliefScales, Ledger, OpinionMeter, RegardChip, Seal } from "./People";

const partyTone = (p: LocalOfficial["party"]) => (p === "D" ? "#2b4c7e" : p === "R" ? "#a8322a" : "#6a7b72");
const hourly = (m: number) => (m > 0 ? `$${(m / 173).toFixed(2)}` : "federal ($7.25)");
const roleName = (o: LocalOfficial, city?: CityState) => o.role === "governor" ? "Governor" : o.role === "mayor" ? (city?.rest ? "Commission chair" : "Mayor") : city?.rest ? `Commissioner, district ${o.seat}` : `Council member, district ${o.seat}`;

export function Local() {
  const { s, me } = useGame();
  const [st, setSt] = useSticky("local.state", me.hq in (s.stateGov ?? {}) ? me.hq : "TX");
  const [cityId, setCityId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const empByState = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k in me.employees) { const c = s.cities[k.slice(0, k.lastIndexOf(":"))]; if (c && !c.foreign) out[c.state] = (out[c.state] ?? 0) + me.employees[k]; }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.month]);
  const states = STATES.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.code === me.hq ? 1 : 0) - (a.code === me.hq ? 1 : 0) || (empByState[b.code] ?? 0) - (empByState[a.code] ?? 0) || a.name.localeCompare(b.name));
  if (!s.stateGov || !s.cityGov) return <Panel title="States and cities"><p className="empty">Local politics start next month.</p></Panel>;
  return (
    <div className="local">
      <aside className="local-states">
        <Panel title="States" help="local">
          <input type="search" placeholder="Find a state" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
          <div className="state-list">
            {states.map((x) => {
              const g = s.stateGov![x.code];
              return (
                <button key={x.code} className={`state-row ${st === x.code ? "on" : ""}`} onClick={() => { setSt(x.code); setCityId(null); }}>
                  <span className="pdot" style={{ background: partyTone(g.governor.party) }} />
                  <span className="sn">{x.name}{x.code === me.hq ? <span className="muted"> (HQ)</span> : null}</span>
                  <span className="muted small">{empByState[x.code] ? fmtNum(empByState[x.code]) : ""}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      </aside>
      <main className="local-main">
        {cityId && s.cities[cityId] ? <CityView city={s.cities[cityId]} g={s.cityGov[cityId]} onBack={() => setCityId(null)} />
          : <StateView st={st} g={s.stateGov[st]} onCity={setCityId} />}
      </main>
    </div>
  );
}

function StateView({ st, g, onCity }: { st: string; g: StateGov; onCity: (id: string) => void }) {
  const { s, me, act } = useGame();
  const def = STATE_BY_CODE[st];
  const leg = s.stateLegs[st];
  const cities = Object.values(s.cities).filter((c) => c.state === st && !c.foreign).sort((a, b) => b.share - a.share);
  const odds = g.pending ? stateBillOdds(s, st, g.pending) : undefined;
  const p = g.policy;
  return (
    <>
      <header className="local-head">
        <h2>{def?.name}</h2>
        <p className="muted">{fmtNum(def?.population ?? 0)} people. Next governor's race {dateLabel(g.nextElection)}.</p>
      </header>
      <div className="grid2">
        <div>
          <Panel title="Statehouse">
            {leg && (
              <table className="t"><tbody>
                <tr><td>State senate</td><td><Split d={leg.senateD} r={leg.senateR} /></td></tr>
                <tr><td>State house</td><td><Split d={leg.houseD} r={leg.houseR} /></td></tr>
              </tbody></table>
            )}
            <h3 className="sub">State policy</h3>
            <table className="t policy"><tbody>
              <tr><td>Corporate income tax</td><td className="num">{stateCorpTax(s, st).toFixed(1)}%</td><td className="muted">{me.hq === st ? "You pay this on your profits: your headquarters is here." : "Paid by companies headquartered here."}</td></tr>
              <tr><td>Minimum wage</td><td className="num">{hourly(p.minWage)}</td><td className="muted">The floor for every city in the state.</td></tr>
              <tr><td>Right to work</td><td className="num">{p.rightToWork ? "Yes" : "No"}</td><td className="muted">{p.rightToWork ? "Unions are weaker here; wages run a little lower." : "Unions can collect dues from everyone they represent."}</td></tr>
              <tr><td>Data-center tax exemption</td><td className="num">{p.dcExempt ? "Yes" : "No"}</td><td className="muted">{p.dcExempt ? "Data centers' power bills are 8% lower statewide." : "Data centers pay full sales tax on equipment."}</td></tr>
              <tr><td>Megaproject fund</td><td className="num">{p.megaFund ? "Yes" : "No"}</td><td className="muted">{p.megaFund ? "Every city adds 5 points of incentives to new projects." : "No state money for big projects."}</td></tr>
            </tbody></table>
          </Panel>
          <Panel title="In the legislature">
            {g.pending && odds ? (
              <div className="bill">
                <h3>{g.pending.title}</h3>
                <p>{g.pending.detail}</p>
                <p className="muted small">Floor vote {dateLabel(g.pending.voteMonth)}. Odds it passes the legislature: <strong>{fmtPct(odds.leg, 0)}</strong>; odds the governor signs: <strong>{fmtPct(odds.governor, 0)}</strong>.{g.pending.lobby ? ` Your lobbying so far: ${fmtMoney(Math.abs(g.pending.lobby))} ${g.pending.lobby > 0 ? "for" : "against"}.` : ""}</p>
                <div className="row">
                  <button onClick={() => act(lobbyStateBill(s, st, 1))}>Lobby for it ($5M)</button>
                  <button onClick={() => act(lobbyStateBill(s, st, -1))}>Lobby against it ($5M)</button>
                </div>
              </div>
            ) : <p className="empty">Nothing big on the floor right now.</p>}
            {g.history.length > 0 && <ul className="votes">{g.history.map((h, i) => <li key={i}><span className="when">{dateLabel(h.month)}</span><span className={h.passed ? "pos" : "muted"}>{h.passed ? "Law" : "Failed"}</span> {h.title}</li>)}</ul>}
          </Panel>
        </div>
        <div>
          <OfficialCard o={g.governor} act={act} />
        </div>
      </div>
      <Panel title={`Cities and regions of ${def?.name}`}>
        <Table rows={cities} rowKey={(c) => c.id} onRowClick={(c) => onCity(c.id)} cols={[
          { key: "n", label: "Place", render: (c) => <button className="link" onClick={() => onCity(c.id)}>{c.name}</button>, sort: (c) => c.name },
          { key: "m", label: "Mayor", render: (c) => { const m = s.cityGov![c.id]?.mayor; return m ? <span><span className="pdot" style={{ background: partyTone(m.party) }} /> {m.name}</span> : "–"; } },
          { key: "cn", label: "Council", render: (c) => { const g2 = s.cityGov![c.id]; const d = g2?.council.filter((x) => x.lean > 0.5).length ?? 0; return g2 ? <Split d={d} r={g2.council.length - d} small /> : "–"; } },
          { key: "p", label: "Politics", render: (c) => <span className="muted">{cityPolitics(c)}</span> },
          { key: "w", label: "Min. wage", num: true, render: (c) => hourly(c.minWage), sort: (c) => c.minWage },
          { key: "t", label: "Tax break", num: true, render: (c) => fmtPct(c.taxBreak, 0), sort: (c) => c.taxBreak },
          { key: "dc", label: "Data centers", render: (c) => c.dcStance === "moratorium" ? <span className="neg">Moratorium</span> : c.dcStance === "welcome" ? <span className="pos">Welcome</span> : "Allowed" },
          { key: "o", label: "Locals like you", num: true, render: (c) => fmtPct(c.opinion[me.id] ?? 0.5, 0), sort: (c) => c.opinion[me.id] ?? 0.5 },
          { key: "v", label: "Next vote", render: (c) => { const o = s.cityGov![c.id]?.pending; return o ? <span className={affectsPlayer(s, c, me, o.kind) ? "warn" : "muted"}>{o.title}</span> : <span className="muted">–</span>; } },
        ]} />
      </Panel>
    </>
  );
}

function Split({ d, r, small }: { d: number; r: number; small?: boolean }) {
  const t = Math.max(1, d + r);
  return (
    <span className={`seatsplit ${small ? "small" : ""}`} title={`${d} Democrats, ${r} Republicans`}>
      <span className="bar-split"><span style={{ width: `${(d / t) * 100}%`, background: "#2b4c7e" }} /><span style={{ width: `${(r / t) * 100}%`, background: "#a8322a" }} /></span>
      <span className="muted">{d}–{r}</span>
    </span>
  );
}

function CityView({ city, g, onBack }: { city: CityState; g: CityGov; onBack: () => void }) {
  const { s, me, act } = useGame();
  const [sel, setSel] = useState<number>(g.mayor.id);
  const o = officials(g).find((x) => x.id === sel) ?? g.mayor;
  const pend = g.pending;
  const forecast = pend ? g.council.map((m) => ({ m, p: voteOdds(s, city, m, pend) })) : [];
  const expectedYes = forecast.filter((f) => f.p > 0.5).length;
  let emp = 0;
  for (const k in me.employees) if (k.startsWith(city.id + ":")) emp += me.employees[k];
  const deal = g.deals?.[me.id];
  const proposer = pend ? officials(g).find((x) => x.id === pend.proposedBy) : undefined;
  return (
    <>
      <header className="local-head">
        <button className="link" onClick={onBack}>← {STATE_BY_CODE[city.state]?.name}</button>
        <h2>{city.name}</h2>
        <p className="muted">{city.county ? `${city.county}, ` : ""}{STATE_BY_CODE[city.state]?.name}. {fmtNum(cityWorkforce(s, city.id))} workers. {cityPolitics(city)}. Next local election {dateLabel(g.nextElection)}.</p>
      </header>
      <div className="grid2">
        <div>
          <Panel title={city.rest ? "County commission" : "City hall"} right={`${g.council.filter((m) => m.lean > 0.5).length}–${g.council.filter((m) => m.lean <= 0.5).length} council`}>
            <Dais g={g} sel={sel} onSel={setSel} forecast={pend ? new Map(forecast.map((f) => [f.m.id, f.p])) : undefined} />
            <p className="muted small" style={{ textAlign: "center", margin: "4px 0 0" }}>{pend ? "Seats are shaded by how they're expected to vote on the pending ordinance." : "Click a seat to see who sits there."}</p>
          </Panel>
          <Panel title="On the agenda">
            {pend ? (
              <div className="bill">
                <h3>{pend.title}</h3>
                <p>{pend.detail}</p>
                <p className="muted small">Proposed by {proposer?.name ?? "the council"}; vote {dateLabel(pend.voteMonth)}. Expected tally: <strong>{expectedYes}–{g.council.length - expectedYes}</strong>{expectedYes > g.council.length / 2 ? ", likely to pass" : ", likely to fail"}.{pend.lobby ? ` Your lobbying: ${fmtMoney(Math.abs(pend.lobby))} ${pend.lobby > 0 ? "for" : "against"}.` : ""}</p>
                {affectsPlayer(s, city, me, pend.kind) && pend.kind !== "company_deal" && <p className="warn small">This one affects your business here.</p>}
                <div className="row">
                  <button onClick={() => act(lobbyOrdinance(s, city.id, 1))}>Lobby for it</button>
                  <button onClick={() => act(lobbyOrdinance(s, city.id, -1))}>Lobby against it</button>
                </div>
                <p className="muted small">Dealmakers listen to lobbyists; ideologues mostly don't; populists hold it against you.</p>
              </div>
            ) : <p className="empty">Nothing on the agenda this month.</p>}
            <div className="row" style={{ marginTop: 10 }}>
              {deal ? <span className="deal-stamp ok">You have a {fmtPct(deal, 0)} incentive deal here</span>
                : <button className="primary" disabled={!!pend} onClick={() => act(requestDeal(s, city.id))} title={pend ? "Wait until the current vote is done" : "Ask the council for an extra 12% abatement on your projects here"}>Ask for an incentive deal</button>}
            </div>
            {g.history.length > 0 && <ul className="votes">{g.history.map((h, i) => <li key={i} className={h.mine ? "mine" : ""}><span className="when">{dateLabel(h.month)}</span><span className={h.passed ? "pos" : "muted"}>{h.passed ? `Passed ${h.yes}–${h.no}` : `Failed ${h.yes}–${h.no}`}</span> {h.title}</li>)}</ul>}
          </Panel>
          <Panel title="Local policy">
            <table className="t policy"><tbody>
              <tr><td>Minimum wage</td><td className="num">{hourly(city.minWage)}</td><td className="muted">Floor for service, retail, care and laborer pay.</td></tr>
              <tr><td>Tax abatement</td><td className="num">{fmtPct(city.taxBreak, 0)}</td><td className="muted">Base share of a new project's cost the city forgives; more if locals like you{deal ? ", plus your deal" : ""}.</td></tr>
              <tr><td>Permitting</td><td className="num">{city.permitSpeed < 0.9 ? "Fast" : city.permitSpeed > 1.15 ? "Slow" : "Normal"}</td><td className="muted">Construction takes {fmtPct(city.permitSpeed, 0)} of the usual time before local opinion.</td></tr>
              <tr><td>Unions</td><td className="num">{city.union > 0.6 ? "Strong" : city.union > 0.3 ? "Moderate" : "Weak"}</td><td className="muted">Strong unions push blue-collar wages up.</td></tr>
              <tr><td>Data centers</td><td className="num">{city.dcStance === "moratorium" ? "Banned" : city.dcStance === "welcome" ? "Welcome" : "Allowed"}</td><td className="muted">Grid at {fmtPct(city.dcLoadMW / city.gridMW, 0)} of capacity; power {city.dcTaxBreak >= 0 ? `abated ${fmtPct(city.dcTaxBreak, 0)}` : `surcharged ${fmtPct(-city.dcTaxBreak, 0)}`}{city.dcWaterRules ? "; water rules apply" : ""}.</td></tr>
              <tr><td>Oil and gas</td><td className="num">{city.fossilBan ? "Banned" : "Allowed"}</td><td className="muted">{city.fossilBan ? "No new wells, refineries or gas plants." : "Energy projects can get permits."}</td></tr>
              <tr><td>Employer head tax</td><td className="num">{g.headTax ? `$${g.headTax}` : "None"}</td><td className="muted">{g.headTax ? `Per worker per month at companies with over 2,000 here.${emp > 2000 ? ` You pay about ${fmtMoney(emp * g.headTax)} a month.` : ""}` : "No per-worker tax."}</td></tr>
            </tbody></table>
            <p className="muted small">You employ {fmtNum(emp)} people here; locals give you {fmtPct(city.opinion[me.id] ?? 0.5, 0)}.</p>
          </Panel>
        </div>
        <div>
          <OfficialCard o={o} city={city} act={act} />
        </div>
      </div>
    </>
  );
}

/** The council dais: a half-circle of seats with the mayor at the center. */
function Dais({ g, sel, onSel, forecast }: { g: CityGov; sel: number; onSel: (id: number) => void; forecast?: Map<number, number> }) {
  const W = 420, H = 210, cx = W / 2, cy = H - 18, R = 160;
  const n = g.council.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dais" role="img" aria-label="Council seats">
      <path d={`M ${cx - R - 26} ${cy} A ${R + 26} ${R + 26} 0 0 1 ${cx + R + 26} ${cy}`} fill="none" stroke="var(--rule)" strokeWidth={1} />
      <path d={`M ${cx - R + 26} ${cy} A ${R - 26} ${R - 26} 0 0 1 ${cx + R - 26} ${cy}`} fill="none" stroke="var(--rule-soft)" strokeWidth={1} />
      {g.council.map((m, i) => {
        const a = Math.PI - (Math.PI * (i + 0.5)) / n;
        const x = cx + R * Math.cos(a), y = cy - R * Math.sin(a);
        const p = forecast?.get(m.id);
        const fill = p === undefined ? partyTone(m.party) : p > 0.5 ? "var(--gain)" : "var(--seal)";
        const op = p === undefined ? 1 : 0.35 + Math.abs(p - 0.5) * 1.3;
        return (
          <g key={m.id} onClick={() => onSel(m.id)} style={{ cursor: "pointer" }}>
            <circle cx={x} cy={y} r={sel === m.id ? 21 : 18} fill={fill} opacity={op} stroke={sel === m.id ? "var(--ink)" : "#fff"} strokeWidth={sel === m.id ? 3 : 2} />
            <text x={x} y={y + 4.5} textAnchor="middle" fontSize={12.5} fill="#fff" fontFamily="var(--sans)" fontWeight={600} pointerEvents="none">{m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</text>
            <title>{m.name} ({m.party}){p !== undefined ? `: ${Math.round(p * 100)}% likely to vote yes` : ""}</title>
          </g>
        );
      })}
      <g onClick={() => onSel(g.mayor.id)} style={{ cursor: "pointer" }}>
        <rect x={cx - 34} y={cy - 46} width={68} height={40} rx={3} fill={partyTone(g.mayor.party)} stroke={sel === g.mayor.id ? "var(--ink)" : "#fff"} strokeWidth={sel === g.mayor.id ? 3 : 2} />
        <text x={cx} y={cy - 28} textAnchor="middle" fontSize={11} fill="#fff" fontFamily="var(--sans)" pointerEvents="none">Mayor</text>
        <text x={cx} y={cy - 13} textAnchor="middle" fontSize={12.5} fill="#fff" fontFamily="var(--sans)" fontWeight={600} pointerEvents="none">{g.mayor.name.split(" ").slice(-1)[0]}</text>
        <title>{g.mayor.name} ({g.mayor.party})</title>
      </g>
    </svg>
  );
}

function OfficialCard({ o, city, act }: { o: LocalOfficial; city?: CityState; act: (r: { ok: boolean; message: string }) => void }) {
  const { s } = useGame();
  const why = Object.entries(o.regard.why).map(([k, v]) => ({ label: reasonLocal(k), v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  return (
    <div className="dossier">
      <header>
        <Seal name={o.name} tone={partyTone(o.party)} />
        <div>
          <h2>{o.name} <span className="muted" style={{ fontWeight: 400 }}>({o.party})</span></h2>
          <div className="muted">{roleName(o, city)}{city ? `, ${city.name}` : ""}; in office since {dateLabel(Math.max(o.since, -120))}</div>
        </div>
      </header>
      <p className="bio">{TEMPERAMENT[o.temperament]}.</p>
      <RegardChip r={o.regard} />
      <h3>Where they stand</h3>
      <BeliefScales b={o.beliefs} />
      <h3>What they think of you</h3>
      <OpinionMeter score={o.regard.score} />
      <Ledger rows={why} total={o.regard.score} totalLabel="Overall" />
      <div className="row actions">
        <button onClick={() => act(meetOfficial(s, o))}>Request a meeting</button>
        <button onClick={() => act(backCampaign(s, o, false))}>Fund their campaign ({fmtMoney(o.role === "governor" ? 2e6 : 250e3)})</button>
        <button className="danger" onClick={() => act(backCampaign(s, o, true))}>Back their opponent</button>
      </div>
      <p className="muted small">Mayors, council members and governors are fictional.</p>
    </div>
  );
}

export { ORD };
