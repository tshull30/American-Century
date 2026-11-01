import { useMemo, useState } from "react";
import { geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopo from "us-atlas/states-albers-10m.json";
import { CULTURES, CULTURE_BY_ID, type CultureId } from "../../sim/data/cultures";
import { JOBS, JOB_BY_ID, type JobId } from "../../sim/data/jobs";
import { NEEDS, solTier } from "../../sim/data/needs";
import { STATES, STATE_BY_CODE, STATE_BY_FIPS } from "../../sim/data/states";
import type { Politician } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct, laborKey } from "../../sim/util";
import { Panel, Table, useGame } from "../components";
import { FactionTag, PacButtons, nextUp } from "./Politics";

type Metric = "workforce" | "free" | "wage" | "mine" | "culture" | "sol" | "congress";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = statesTopo as any;
const features = (feature(topo, topo.objects.states) as unknown as { features: { id: string; properties: { name: string } }[] }).features;
const path = geoPath();

/** Sequential single-hue ramp: pale paper to engraving green. */
function ramp(t: number): string {
  const a = [226, 233, 225], b = [35, 77, 60];
  const k = Math.max(0, Math.min(1, t));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Diverging ramp for party: Republican red, neutral paper, Democratic blue. */
function partyRamp(t: number): string {
  const r = [176, 48, 42], mid = [226, 230, 224], d = [44, 90, 160];
  const k = Math.max(0, Math.min(1, t));
  const [a, b, u] = k < 0.5 ? [r, mid, k * 2] : [mid, d, (k - 0.5) * 2];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function Pops() {
  const { s, me } = useGame();
  const [metric, setMetric] = useState<Metric>("workforce");
  const [job, setJob] = useState<JobId | "all">("software");
  const [culture, setCulture] = useState<CultureId>("indian");
  const [sel, setSel] = useState<string | null>("TX");
  const [cultFilter, setCultFilter] = useState<CultureId | "all">("all");
  const [jobFilter, setJobFilter] = useState<JobId | "all">("all");
  const [hover, setHover] = useState<string | null>(null);

  const values = useMemo(() => {
    const v: Record<string, number> = {};
    const jobs = job === "all" ? JOBS.map((j) => j.id) : [job];
    for (const st of STATES) {
      let x = 0;
      if (metric === "congress") {
        const ms = s.politicians.filter((m) => m.state === st.code && m.chamber === "house");
        x = ms.length ? ms.filter((m) => m.party === "D").length / ms.length : 0.5;
      } else if (metric === "sol") {
        let sum = 0, n = 0;
        for (const p of s.pops) if (p.state === st.code && (job === "all" || p.job === job)) { const k = p.workers + p.dependents; sum += p.sol * k; n += k; }
        x = n ? sum / n : 0;
      } else if (metric === "culture") {
        const pops = s.pops.filter((p) => p.state === st.code && (job === "all" || p.job === job));
        const tot = pops.reduce((a, p) => a + p.workers, 0);
        x = tot ? pops.filter((p) => p.culture === culture).reduce((a, p) => a + p.workers, 0) / tot : 0;
      } else if (metric === "wage") {
        let w = 0, n = 0;
        for (const j of jobs) { const c = s.labor[laborKey(st.code, j)]; if (c) { w += c.wage * c.workforce; n += c.workforce; } }
        x = n ? w / n : 0;
      } else {
        for (const j of jobs) {
          const c = s.labor[laborKey(st.code, j)];
          if (!c) continue;
          if (metric === "workforce") x += c.workforce;
          else if (metric === "free") x += Math.max(0, c.workforce - c.gameEmployed);
          else if (metric === "mine") x += me.employees[laborKey(st.code, j)] ?? 0;
        }
      }
      v[st.code] = x;
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, job, culture, s.month]);

  const max = Math.max(1e-9, ...Object.values(values));
  const min = metric === "sol" ? Math.min(...Object.values(values)) : 0;
  const fmt = (x: number) => metric === "congress" ? `${fmtPct(x, 0)} of House seats Democratic` : metric === "wage" ? fmtMoney(x, 1) + "/mo" : metric === "culture" ? fmtPct(x, 1) : metric === "sol" ? x.toFixed(0) : fmtNum(x);
  // log scale for counts so small states are still readable
  const scale = (x: number) => metric === "sol" ? (x - min) / Math.max(1e-9, max - min) : metric === "wage" || metric === "culture" ? x / max : Math.log1p(x) / Math.log1p(max);

  const popRows = useMemo(() => s.pops.filter((p) =>
    (!sel || p.state === sel) && (cultFilter === "all" || p.culture === cultFilter) && (jobFilter === "all" || p.job === jobFilter),
  ), [s.pops, sel, cultFilter, jobFilter]);
  const hoverState = hover ? STATE_BY_CODE[hover] : null;

  return (
    <div className="grid2">
      <div>
        <Panel title="Map" right={
          <span className="row">
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              <option value="workforce">Workforce</option>
              <option value="free">Workers not employed by companies in the game</option>
              <option value="wage">Market wage</option>
              <option value="mine">Your employees</option>
              <option value="culture">Culture share</option>
              <option value="sol">Standard of living</option>
              <option value="congress">House delegation by party</option>
            </select>
            <select value={job} onChange={(e) => setJob(e.target.value as JobId | "all")}>
              <option value="all">All jobs</option>
              {JOBS.map((j) => <option key={j.id} value={j.id}>{j.plural}</option>)}
            </select>
            {metric === "culture" && (
              <select value={culture} onChange={(e) => setCulture(e.target.value as CultureId)}>
                {CULTURES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </span>
        }>
          <div className="map chart">
            <svg viewBox="0 0 975 610">
              {features.map((f) => {
                const st = STATE_BY_FIPS[f.id];
                if (!st) return null;
                return (
                  <path
                    key={f.id}
                    className={`state ${sel === st.code ? "sel" : ""}`}
                    d={path(f as never) ?? ""}
                    fill={metric === "congress" ? partyRamp(values[st.code] ?? 0.5) : ramp(scale(values[st.code] ?? 0))}
                    onClick={() => setSel(sel === st.code ? null : st.code)}
                    onMouseEnter={() => setHover(st.code)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </svg>
            {hoverState && (
              <div className="tooltip" style={{ left: "50%", top: "8%", transform: "translateX(-50%)" }}>
                <strong>{hoverState.name}</strong> {fmt(values[hoverState.code] ?? 0)}
              </div>
            )}
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="legend-ramp">
              <span>{metric === "congress" ? "All Republican" : fmt(min)}</span>
              <div className="ramp" style={{ background: metric === "congress" ? `linear-gradient(90deg, ${partyRamp(0)}, ${partyRamp(0.5)}, ${partyRamp(1)})` : `linear-gradient(90deg, ${ramp(0)}, ${ramp(1)})` }} />
              <span>{metric === "congress" ? "All Democratic" : fmt(max)}</span>
              {metric !== "wage" && metric !== "culture" && metric !== "sol" && metric !== "congress" && <span>(log scale)</span>}
            </div>
            <span className="hint">Click a state to list its pops.</span>
          </div>
        </Panel>
        {sel && <Delegation code={sel} />}
        {sel && <StateSummary code={sel} />}
      </div>
      <Panel title={sel ? `Pops in ${STATE_BY_CODE[sel].name}` : "All pops"} right={
        <span className="row">
          <select value={cultFilter} onChange={(e) => setCultFilter(e.target.value as CultureId | "all")}>
            <option value="all">All cultures</option>
            {CULTURES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value as JobId | "all")}>
            <option value="all">All jobs</option>
            {JOBS.map((j) => <option key={j.id} value={j.id}>{j.plural}</option>)}
          </select>
          {sel && <button className="small" onClick={() => setSel(null)}>All states</button>}
        </span>
      }>
        <div className="hint" style={{ marginBottom: 6 }}>{fmtNum(popRows.length)} pops, {fmtNum(popRows.reduce((a, p) => a + p.workers, 0))} workers</div>
        <div className="scroll" style={{ maxHeight: 640 }}>
          <Table
            rows={popRows}
            rowKey={(p) => p.id}
            initialSort="w"
            maxRows={400}
            cols={[
              { key: "l", label: "Pop", render: (p) => <><span className="swatch" style={{ background: CULTURE_BY_ID[p.culture].color }} /> {CULTURE_BY_ID[p.culture].adjective} {JOB_BY_ID[p.job].plural.toLowerCase()}{sel ? "" : ` from ${STATE_BY_CODE[p.state].name}`}</>, sort: (p) => p.culture + p.job },
              { key: "w", label: "Workers", num: true, render: (p) => fmtNum(p.workers), sort: (p) => p.workers },
              { key: "d", label: "Dependents", num: true, render: (p) => fmtNum(p.dependents), sort: (p) => p.dependents },
              { key: "sol", label: "Living std.", num: true, title: "Standard of living (100 = 2026 average). Hover for need satisfaction.", render: (p) => <span title={NEEDS.map((n, i) => `${n.name}: ${(p.sat[i] ?? 0).toFixed(2)}`).join("\n")}>{p.sol} <span className="muted">{solTier(p.sol)}</span></span>, sort: (p) => p.sol },
              { key: "wage", label: "Wage", num: true, render: (p) => fmtMoney(s.labor[laborKey(p.state, p.job)].wage, 1), sort: (p) => s.labor[laborKey(p.state, p.job)].wage },
              { key: "emp", label: "At game companies", num: true, render: (p) => { const c = s.labor[laborKey(p.state, p.job)]; return fmtPct(c.gameEmployed / c.workforce, 1); }, title: "Share of this pop's state-and-job labor pool working for companies in the game" },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}

function StateSummary({ code }: { code: string }) {
  const { s } = useGame();
  const st = STATE_BY_CODE[code];
  return (
    <Panel title={st.name} right={`${st.region}, state corporate tax ${st.corpTax}%`}>
      <Table
        rows={JOBS}
        rowKey={(j) => j.id}
        cols={[
          { key: "j", label: "Job", render: (j) => <span title={j.examples}>{j.plural}</span> },
          { key: "wf", label: "Workforce", num: true, render: (j) => fmtNum(s.labor[laborKey(code, j.id)]?.workforce ?? 0), sort: (j) => s.labor[laborKey(code, j.id)]?.workforce ?? 0 },
          { key: "free", label: "Available", num: true, render: (j) => { const c = s.labor[laborKey(code, j.id)]; return c ? fmtNum(c.workforce - c.gameEmployed) : "–"; } },
          { key: "wage", label: "Market wage", num: true, render: (j) => fmtMoney(s.labor[laborKey(code, j.id)]?.wage ?? 0, 1), sort: (j) => s.labor[laborKey(code, j.id)]?.wage ?? 0 },
          { key: "sh", label: "Taken", num: true, render: (j) => { const c = s.labor[laborKey(code, j.id)]; return c ? fmtPct(c.gameEmployed / c.workforce, 1) : "–"; } },
        ]}
      />
    </Panel>
  );
}

function Delegation({ code }: { code: string }) {
  const { s, me } = useGame();
  const st = STATE_BY_CODE[code];
  const senators = s.politicians.filter((m) => m.state === code && m.chamber === "senate");
  const reps = s.politicians.filter((m) => m.state === code && m.chamber === "house").sort((a, b) => (a.district ?? 0) - (b.district ?? 0));
  const vac = s.vacancies.filter((v) => v.state === code);
  const leg = s.stateLegs[code];
  const legBar = (d: number, r: number) => (
    <span className="row" style={{ flexWrap: "nowrap" }}>
      <div className="split" style={{ width: 140 }}>
        <div style={{ width: `${(d / (d + r)) * 100}%`, background: "var(--dem)" }} />
        <div style={{ width: `${(r / (d + r)) * 100}%`, background: "var(--rep)" }} />
      </div>
      <span><span className="member-d">{d} D</span>, <span className="member-r">{r} R</span></span>
    </span>
  );
  const cols = [
    { key: "n", label: "Member", render: (m: Politician) => <span className={m.party === "D" ? "member-d" : "member-r"}>{m.name} ({m.label})</span> },
    { key: "seat", label: "Seat", render: (m: Politician) => (m.chamber === "senate" ? "Senate" : m.district === 0 ? "At-large" : `District ${m.district}`) },
    { key: "f", label: "Faction", render: (m: Politician) => <FactionTag m={m} /> },
    { key: "up", label: "Up in", render: (m: Politician) => nextUp(s.politics.nextElectionDay, m) },
    { key: "g", label: "Goodwill", num: true, render: (m: Politician) => (m.friends[me.id] ? fmtMoney(m.friends[me.id]) : "") },
    { key: "a", label: "", render: (m: Politician) => <PacButtons m={m} /> },
  ];
  return (
    <Panel title={`${st.name} in Congress`} right={`${reps.length + vac.length} House seats`}>
      <div className="scroll" style={{ maxHeight: 380 }}>
        <Table rows={[...senators, ...reps]} rowKey={(m) => m.id} cols={cols} />
      </div>
      {vac.length > 0 && <div className="hint" style={{ marginTop: 4 }}>Vacant: {vac.map((v) => `district ${v.district}`).join(", ")}. Filled at the next election.</div>}
      {leg && (
        <table className="t" style={{ marginTop: 10 }}><tbody>
          <tr><td>{code === "NE" ? "Unicameral legislature (officially nonpartisan)" : "State senate"}</td><td>{legBar(leg.senateD, leg.senateR)}</td></tr>
          {code !== "NE" && <tr><td>State house</td><td>{legBar(leg.houseD, leg.houseR)}</td></tr>}
        </tbody></table>
      )}
      {!me.pac && <p className="hint">Register a PAC on the Politics tab to back or oppose these members.</p>}
    </Panel>
  );
}
