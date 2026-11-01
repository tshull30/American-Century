import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopo from "us-atlas/states-albers-10m.json";
import { CULTURES, CULTURE_BY_ID, type CultureId } from "../../sim/data/cultures";
import { JOBS, JOB_BY_ID, type JobId } from "../../sim/data/jobs";
const JOB_GROUPS = ["Blue collar", "Service", "Office and professional", "Tech and science"] as const;
import { NEEDS, solTier } from "../../sim/data/needs";
import { buildingsInCity, citiesInState, cityLabel, cityPolitics, stateLabor, stateWage } from "../../sim/geo";
import { BUILDING_BY_ID } from "../../sim/data/buildings";
import { STATES, STATE_BY_CODE, STATE_BY_FIPS } from "../../sim/data/states";
import type { Politician } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct, laborKey } from "../../sim/util";
import { Panel, Table, useGame } from "../components";
import { FactionTag, PacButtons, nextUp } from "./Politics";

type Metric = "workforce" | "free" | "wage" | "mine" | "culture" | "sol" | "congress" | "migration";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = statesTopo as any;
const features = (feature(topo, topo.objects.states) as unknown as { features: { id: string; properties: { name: string } }[] }).features;
const path = geoPath();
/** Same projection the pre-projected us-atlas file uses. */
const project = geoAlbersUsa().scale(1300).translate([487.5, 305]);

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
  const [selCity, setSelCity] = useState<string | null>(null);
  const [showCities, setShowCities] = useState(true);

  const values = useMemo(() => {
    const v: Record<string, number> = {};
    const jobs = job === "all" ? JOBS.map((j) => j.id) : [job];
    for (const st of STATES) {
      let x = 0;
      if (metric === "migration") {
        let n = 0;
        for (const p of s.pops) if (p.state === st.code) n += p.workers + p.dependents;
        x = n / (s.statePopStart[st.code] || n) - 1;
      } else if (metric === "congress") {
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
        for (const j of jobs) { const c = stateLabor(s, st.code, j); w += c.wage * c.workforce; n += c.workforce; }
        x = n ? w / n : 0;
      } else {
        for (const j of jobs) {
          const c = stateLabor(s, st.code, j);
          if (metric === "workforce") x += c.workforce;
          else if (metric === "free") x += Math.max(0, c.workforce - c.gameEmployed);
          else if (metric === "mine") for (const city of citiesInState(s, st.code)) x += me.employees[laborKey(city.id, j)] ?? 0;
        }
      }
      v[st.code] = x;
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, job, culture, s.month]);

  const max = Math.max(1e-9, ...Object.values(values));
  const min = metric === "sol" || metric === "migration" ? Math.min(...Object.values(values)) : 0;
  const fmt = (x: number) => metric === "migration" ? `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}% since 2026` : metric === "congress" ? `${fmtPct(x, 0)} of House seats Democratic` : metric === "wage" ? fmtMoney(x, 1) + "/mo" : metric === "culture" ? fmtPct(x, 1) : metric === "sol" ? x.toFixed(0) : fmtNum(x);
  // log scale for counts so small states are still readable
  const scale = (x: number) => metric === "sol" || metric === "migration" ? (x - min) / Math.max(1e-9, max - min) : metric === "wage" || metric === "culture" ? x / max : Math.log1p(x) / Math.log1p(max);

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
              <option value="migration">Population change since 2026</option>
            </select>
            <select value={job} onChange={(e) => setJob(e.target.value as JobId | "all")}>
              <option value="all">All jobs</option>
              {JOB_GROUPS.map((g) => <optgroup key={g} label={g}>{JOBS.filter((j) => j.group === g).map((j) => <option key={j.id} value={j.id}>{j.plural}</option>)}</optgroup>)}
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
              {showCities && Object.values(s.cities).filter((c) => !c.rest).map((c) => {
                const xy = project([c.lon, c.lat]);
                if (!xy) return null;
                const st = STATE_BY_CODE[c.state];
                const r = Math.max(2.2, Math.sqrt((c.share * st.population) / 1e6) * 2.2);
                const op = c.opinion[me.id];
                const present = me.buildings.some((b) => b.city === c.id);
                const fill = !present ? "#f3f6f1" : op === undefined ? "#f3f6f1" : op > 0.55 ? "#2f6b4f" : op < 0.4 ? "#9e2b25" : "#c9b458";
                return (
                  <circle key={c.id} cx={xy[0]} cy={xy[1]} r={r} fill={fill} stroke="#1c3329" strokeWidth={selCity === c.id ? 2 : 0.8} style={{ cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); setSelCity(c.id); setSel(c.state); }}>
                    <title>{c.name}{present && op !== undefined ? `: locals ${Math.round(op * 100)}% favorable` : ""}</title>
                  </circle>
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
              {metric !== "wage" && metric !== "culture" && metric !== "sol" && metric !== "congress" && metric !== "migration" && <span>(log scale)</span>}
            </div>
            <label className="hint"><input type="checkbox" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} /> Cities (filled where you operate: green favorable, red hostile)</label>
          </div>
        </Panel>
        {selCity && <CityPanel id={selCity} onClose={() => setSelCity(null)} />}
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
            {JOB_GROUPS.map((g) => <optgroup key={g} label={g}>{JOBS.filter((j) => j.group === g).map((j) => <option key={j.id} value={j.id}>{j.plural}</option>)}</optgroup>)}
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
              { key: "wage", label: "Wage", num: true, render: (p) => fmtMoney(stateWage(s, p.state, p.job), 1), sort: (p) => stateWage(s, p.state, p.job) },
              { key: "emp", label: "At game companies", num: true, render: (p) => { const c = stateLabor(s, p.state, p.job); return fmtPct(c.gameEmployed / Math.max(1, c.workforce), 1); }, title: "Share of this pop's state-and-job labor pool working for companies in the game" },
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
          { key: "wf", label: "Workforce", num: true, render: (j) => fmtNum(stateLabor(s, code, j.id).workforce), sort: (j) => stateLabor(s, code, j.id).workforce },
          { key: "free", label: "Available", num: true, render: (j) => { const c = stateLabor(s, code, j.id); return fmtNum(c.workforce - c.gameEmployed); } },
          { key: "wage", label: "Market wage", num: true, render: (j) => fmtMoney(stateLabor(s, code, j.id).wage, 1), sort: (j) => stateLabor(s, code, j.id).wage },
          { key: "sh", label: "Taken", num: true, render: (j) => { const c = stateLabor(s, code, j.id); return fmtPct(c.gameEmployed / Math.max(1, c.workforce), 1); } },
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

function CityPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { s, me } = useGame();
  const c = s.cities[id];
  if (!c) return null;
  const here = buildingsInCity(s, id);
  const fans = s.companies.filter((x) => x.alive && c.opinion[x.id] !== undefined && here.some((h) => h.c.id === x.id)).sort((a, b) => (c.opinion[b.id] ?? 0) - (c.opinion[a.id] ?? 0));
  return (
    <Panel title={cityLabel(s, id)} right={<button className="small" onClick={onClose}>Close</button>}>
      <table className="t wrap"><tbody>
        <tr><td>Population</td><td className="num">{fmtNum(c.share * STATE_BY_CODE[c.state].population)}</td></tr>
        <tr><td>Residents</td><td className="num">{cityPolitics(c)}</td></tr>
        <tr><td>Council</td><td className="num">{c.council > 0.55 ? "Democratic majority" : c.council < 0.45 ? "Republican majority" : "Split"}</td></tr>
        <tr><td>Tax abatements for new plants</td><td className="num">{fmtPct(c.taxBreak, 0)}</td></tr>
        <tr><td>Permitting</td><td className="num">{c.permitSpeed < 0.9 ? "Fast" : c.permitSpeed > 1.15 ? "Slow" : "Average"} ({c.permitSpeed.toFixed(2)}x)</td></tr>
        <tr><td>Local minimum wage</td><td className="num">{c.minWage ? `$${(c.minWage / 173).toFixed(2)} an hour` : "State or federal"}</td></tr>
        <tr><td>Unions</td><td className="num">{c.union > 0.8 ? "Strong" : c.union > 0.5 ? "Moderate" : "Weak"}</td></tr>
        <tr><td>Data centers</td><td className="num">{c.dcStance === "moratorium" ? <span className="neg">Moratorium</span> : c.dcStance === "welcome" ? <span className="pos">Welcome</span> : "Case by case"}; grid {fmtNum(c.dcLoadMW)} of {fmtNum(c.gridMW)} MW; power {c.powerIdx.toFixed(2)}x</td></tr>
        <tr><td>Data-center rules</td><td className="num">{c.dcTaxBreak > 0.02 ? `power-bill abatement ${fmtPct(c.dcTaxBreak, 0)}` : c.dcTaxBreak < -0.02 ? <span className="neg">grid surcharge {fmtPct(-c.dcTaxBreak, 0)}</span> : "no special deal"}{c.dcWaterRules ? "; water-use limits (cooling costs 10% more)" : ""}</td></tr>
        <tr><td>Energy</td><td className="num">{c.fossilBan ? <span className="neg">Bans new oil and gas projects</span> : "Oil and gas allowed"}</td></tr>
        <tr><td>Character</td><td className="num">tech {c.tech.toFixed(1)}, manufacturing {c.mfg.toFixed(1)}, cost of living {c.col.toFixed(2)}{c.flags.includes("water") ? ", water-stressed" : ""}{c.flags.includes("univ") ? ", research universities" : ""}</td></tr>
        <tr><td>What they think of you</td><td className="num"><strong>{fmtPct(c.opinion[me.id] ?? me.image, 0)}</strong></td></tr>
      </tbody></table>
      {fans.length > 0 && (
        <>
          <div className="hint" style={{ marginTop: 10 }}>Companies here, by local opinion</div>
          <Table rows={fans} rowKey={(x) => x.id} cols={[
            { key: "n", label: "Company", render: (x) => <span style={x.id === me.id ? { fontWeight: 600 } : undefined}>{x.name}</span> },
            { key: "b", label: "Sites", render: (x) => here.filter((h) => h.c.id === x.id).map((h) => `${BUILDING_BY_ID[h.b.type].short} ${h.b.level}`).join(", ") },
            { key: "o", label: "Opinion", num: true, render: (x) => fmtPct(c.opinion[x.id] ?? 0, 0) },
          ]} />
        </>
      )}
      <p className="hint">What residents believe matters: left-leaning towns reward companies that lobby and give like Democrats and that build solar and EVs, and punish oil and gas; right-leaning towns like factories and fields and companies on their side; libertarian towns dislike subsidy hunters. Locals also warm to employers who hire many of them and pay well, and to HQ perks like plazas and childcare. They sour on layoffs, price gouging, and data centers that strain the grid or the water supply. Hostile towns slow your permits and eventually refuse them.</p>
    </Panel>
  );
}
