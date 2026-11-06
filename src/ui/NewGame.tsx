import { useMemo, useState } from "react";
import { rollRoster } from "../sim/roster";
import { BUILDING_BY_ID, producerOf, SECTORS, type SectorId } from "../sim/data/buildings";
import { GOODS, GOOD_BY_ID, type GoodId } from "../sim/data/goods";
import { STATES, STATE_BY_CODE } from "../sim/data/states";
import { CITY_SEEDS } from "../sim/data/cities";
import { newGame, type PlayerChoice } from "../sim/engine";
import { DIFFICULTIES, GOALS, MODES, SCENARIOS, type DifficultyId, type GoalId, type ModeId, type ScenarioId } from "../sim/setup";
import { tierOf } from "../sim/tiers";
import type { GameState } from "../sim/types";
import { fmtMoney, lowerName } from "../sim/util";
import { hasLocal, importFile, loadLocal, loadRuns } from "./save";

const BLURBS: Partial<Record<GoodId, string>> = {
  digital_ads: "Sell advertising to every business in America. Runs on cloud compute.",
  streaming: "Films and series for households. Content licensing is a big running cost.",
  pharmaceuticals: "Drugs for a huge, price-insensitive market. Lives and dies by R&D.",
  groceries: "Feed the country. Thin margins, enormous market, laborer-heavy plants.",
  electricity: "Build power plants: gas, solar or nuclear. Slow, capital-heavy, steady.",
  software: "Cheapest to start. Needs software developers; hosting runs on cloud compute.",
  cloud: "Capital-hungry data centers that run on AI accelerators.",
  ai_accelerators: "Design chips to compete with Verdant. Needs engineers and a supply of semiconductors.",
  chips: "Build fabs. Very expensive and slow, but every hardware company needs chips.",
  evs: "Take on Kestrel. Huge plants, thin margins, enormous market.",
  smartphones: "Take on Orchard in a crowded global market.",
  crude_oil: "Drill where the oil is: Texas, New Mexico, North Dakota. Volatile prices.",
};
const blurbOf = (g: GoodId) => BLURBS[g] ?? BUILDING_BY_ID[producerOf(g)!.type].description;

/** Startup products grouped by industry. */
const PRODUCTS: { sector: SectorId; goods: GoodId[] }[] = (() => {
  const by = new Map<SectorId, GoodId[]>();
  for (const g of GOODS) {
    if (g.marketUS + g.marketWorld <= 0 || g.id === "components") continue;
    const p = producerOf(g.id);
    const sec = p && BUILDING_BY_ID[p.type].sector;
    if (!sec) continue;
    if (!by.has(sec)) by.set(sec, []);
    by.get(sec)!.push(g.id);
  }
  return [...by.entries()].map(([sector, goods]) => ({ sector, goods: goods.sort((a, b) => GOOD_BY_ID[a].name.localeCompare(GOOD_BY_ID[b].name)) }))
    .sort((a, b) => SECTORS[a.sector].name.localeCompare(SECTORS[b.sector].name));
})();

/** An engraved rosette, the kind printed on bonds and banknotes. */
function Rosette({ size = 160, petals = 18, seed = 0 }: { size?: number; petals?: number; seed?: number }) {
  const c = size / 2;
  const curves: string[] = [];
  for (let k = 0; k < 5; k++) {
    const R = c * (0.92 - k * 0.13), r = R * (0.22 + 0.03 * k), n = petals + k * 2 + seed;
    let d = "";
    for (let i = 0; i <= 720; i++) {
      const t = (i / 720) * Math.PI * 2;
      const rad = R - r + r * Math.cos(n * t + k);
      const x = c + rad * Math.cos(t), y = c + rad * Math.sin(t);
      d += `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    }
    curves.push(d);
  }
  return (
    <svg className="rosette" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {curves.map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={i === 0 ? 0.7 : 0.5} opacity={1 - i * 0.12} />)}
      <circle cx={c} cy={c} r={c * 0.24} fill="none" stroke="currentColor" strokeWidth={0.8} />
      <circle cx={c} cy={c} r={c * 0.2} fill="none" stroke="currentColor" strokeWidth={0.4} />
    </svg>
  );
}

function Certificate({ name, ticker, good, city, unicorn }: { name: string; ticker: string; good: GoodId; city: string; unicorn?: boolean }) {
  const seed = CITY_SEEDS.find((c) => c.id === city);
  const state = STATE_BY_CODE[seed?.state ?? "TX"]?.name ?? "Texas";
  return (
    <div className="cert-preview" aria-label="Your stock certificate">
      <div className="cert-inner">
        <div className="cert-top"><span>No. 0001</span><span>Common stock</span></div>
        <Rosette size={96} petals={14} seed={name.length % 5} />
        <div className="cert-this">This certifies that the bearer owns shares of</div>
        <div className="cert-name">{name.trim() || "Your Company"}, Inc.</div>
        <div className="cert-meta">Incorporated in the State of {state}, headquartered in {seed?.name ?? "Austin"}</div>
        <div className="cert-meta">In the business of {lowerName(GOOD_BY_ID[good].name)}, traded as <strong>{(ticker || "NEW").toUpperCase()}</strong></div>
        <div className="cert-capital">Founded with {unicorn ? "$1,000,000,000" : "$80,000,000"} of venture capital</div>
        <div className="cert-sigs">
          <div><span className="sig">The Founder</span><span>Founder and chief executive</span></div>
          <div><span className="sig">Sand Hill</span><span>Lead investor</span></div>
        </div>
      </div>
    </div>
  );
}

export function NewGame({ onStart }: { onStart: (s: GameState) => void }) {
  const [mode, setMode] = useState<"found" | "takeover">("found");
  const [roster, setRoster] = useState(() => rollRoster());
  const [pick, setPick] = useState<string | null>(null);
  const [name, setName] = useState("Prairie Dynamics");
  const [ticker, setTicker] = useState("PRDY");
  const [good, setGood] = useState<GoodId>("software");
  const [sector, setSector] = useState<SectorId>("software");
  const [hq, setHq] = useState("TX");
  const [city, setCity] = useState("austin");
  const [tier, setTier] = useState<"incumbent" | "challenger" | "startup">("incumbent");
  const [q, setQ] = useState("");
  const [scenario, setScenario] = useState<ScenarioId>("standard");
  const [difficulty, setDifficulty] = useState<DifficultyId>("normal");
  const [goal, setGoal] = useState<GoalId>("sandbox");
  const [playMode, setPlayMode] = useState<ModeId>("standard");
  const pickMode = (m: ModeId) => { setPlayMode(m); setGoal(m === "turnaround" ? "turnaround" : m === "dynasty" ? "double" : m === "unicorn" ? "decacorn" : "sandbox"); };
  const modes = (Object.keys(MODES) as ModeId[]).filter((m) => MODES[m].for === "both" || MODES[m].for === (mode === "found" ? "found" : "takeover"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const runs = useMemo(() => loadRuns(), []);
  const saved = useMemo(() => (hasLocal() ? loadLocal() : null), []);

  const companies = roster.companies.filter((c) => c.tier === tier && (!q || (c.name + " " + c.ticker + " " + c.produce.map((p) => GOOD_BY_ID[p.good].name).join(" ")).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.marketCap - a.marketCap);
  const chosen = pick ? roster.companies.find((c) => c.key === pick) : undefined;
  const goalMet = mode === "takeover" && chosen && ((goal === "titan" && tierOf(chosen.marketCap).id === "titan") || (goal === "unicorn" && chosen.marketCap >= 10e9)
    || (goal === "top_dog" && roster.companies.every((o) => o === chosen || o.marketCap < chosen.marketCap)));
  const ready = (mode === "found" ? !!name.trim() : !!chosen) && !goalMet;

  const start = () => {
    if (!ready) return;
    setBusy(true);
    const choice: PlayerChoice = mode === "found"
      ? { kind: "startup", name: name.trim(), ticker: (ticker.trim() || "NEW").toUpperCase().slice(0, 5), good, hq, city }
      : { kind: "incumbent", key: chosen!.key };
    // Let the button repaint before the warm-up year runs.
    const m = modes.includes(playMode) ? playMode : "standard";
    window.setTimeout(() => onStart(newGame(choice, roster.seed, roster.companies, { scenario, difficulty, goal, mode: m })), 30);
  };

  const cities = CITY_SEEDS.filter((c) => c.state === hq);

  return (
    <div className="ng">
      <header className="ng-hero">
        <div className="ng-frame">
          <div className="ng-corner tl"><Rosette size={120} /></div>
          <div className="ng-corner br"><Rosette size={120} seed={2} /></div>
          <div className="ng-serial"><span>Series 2026</span><span>Shares in the American economy</span></div>
          <h1>American Century</h1>
          <p className="ng-sub">A grand strategy game of American business. Start a company or take over a giant in January 2026, and see how big you can build it.</p>
          <p className="ng-facts">Fifty states and twelve countries. 11,000 pops of real Americans by job, background and county. {GOODS.length} goods and services. A Congress of 535 real members. {roster.companies.length} rival companies, different every game.</p>
          <div className="ng-resume">
            {saved && (
              <button className="primary" onClick={() => onStart(saved)}>
                Continue {saved.companies.find((c) => c.id === saved.playerId)?.name}
              </button>
            )}
            {hasLocal() && !saved && <span className="muted small">Your saved game is from an older version.</span>}
            <button onClick={() => importFile().then(onStart).catch((e) => setErr(String(e.message ?? e)))}>Load a save file</button>
            {err && <span className="neg">{err}</span>}
          </div>
        </div>
      </header>

      <section className="ng-step">
        <h2><span className="ng-num">I.</span> Choose your seat</h2>
        <div className="ng-paths" role="tablist">
          <button role="tab" aria-selected={mode === "found"} className={mode === "found" ? "on" : ""} onClick={() => setMode("found")}>
            <strong>Found a company</strong><span>$80 million of venture money, one production line and no brand. Build a giant from nothing.</span>
          </button>
          <button role="tab" aria-selected={mode === "takeover"} className={mode === "takeover" ? "on" : ""} onClick={() => setMode("takeover")}>
            <strong>Take the helm</strong><span>Run one of {roster.companies.length} existing companies, from household names to scrappy upstarts.</span>
          </button>
        </div>

        <div className="ng-modes">
          <span className="muted">How you start:</span>
          {modes.map((m) => (
            <button key={m} className={(modes.includes(playMode) ? playMode : "standard") === m ? "on" : ""} onClick={() => pickMode(m)} title={MODES[m].blurb}>
              {m === "standard" ? (mode === "found" ? "Bootstrapped" : "As it is") : MODES[m].name}
            </button>
          ))}
          <span className="muted small">{MODES[modes.includes(playMode) ? playMode : "standard"].blurb === "The company as you find it." ? (mode === "found" ? "$80 million of venture money and a modest valuation." : "The company as you find it.") : MODES[playMode].blurb}</span>
        </div>
        {mode === "found" ? (
          <div className="ng-found">
            <div className="ng-form">
              <label className="ng-field big">
                <span>Company name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
              </label>
              <div className="row" style={{ gap: 14, alignItems: "flex-end" }}>
                <label className="ng-field"><span>Ticker</span><input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} maxLength={5} style={{ width: 90 }} /></label>
                <label className="ng-field"><span>State</span>
                  <select value={hq} onChange={(e) => { setHq(e.target.value); const first = CITY_SEEDS.find((c) => c.state === e.target.value); if (first) setCity(first.id); }}>
                    {STATES.map((st) => <option key={st.code} value={st.code}>{st.name}</option>)}
                  </select>
                </label>
                <label className="ng-field"><span>Headquarters city</span>
                  <select value={city} onChange={(e) => setCity(e.target.value)}>
                    {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="ng-field"><span>Industry</span></div>
              <div className="ng-sectors">
                {PRODUCTS.map((p) => <button key={p.sector} className={sector === p.sector ? "on" : ""} onClick={() => { setSector(p.sector); if (!p.goods.includes(good)) setGood(p.goods[0]); }}>{SECTORS[p.sector].name}</button>)}
              </div>
              <div className="ng-products">
                {PRODUCTS.find((p) => p.sector === sector)?.goods.map((g) => (
                  <button key={g} className={good === g ? "on" : ""} onClick={() => setGood(g)}>
                    <strong>{GOOD_BY_ID[g].name}</strong>
                    <span>{fmtMoney(GOOD_BY_ID[g].marketUS + GOOD_BY_ID[g].marketWorld)} market</span>
                  </button>
                ))}
              </div>
              <p className="ng-blurb">{blurbOf(good)}</p>
            </div>
            <Certificate name={name} ticker={ticker} good={good} city={city} unicorn={playMode === "unicorn"} />
          </div>
        ) : (
          <div className="ng-takeover">
            <div className="row ng-filters">
              <div className="segmented">
                {([["incumbent", "Giants"], ["challenger", "Challengers"], ["startup", "Startups"]] as const).map(([t, l]) => (
                  <button key={t} className={tier === t ? "on" : ""} onClick={() => setTier(t)}>{l} <span className="muted">{roster.companies.filter((c) => c.tier === t).length}</span></button>
                ))}
              </div>
              <input type="search" placeholder="Search by name or product" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
              <span className="spacer" />
              <button onClick={() => { setRoster(rollRoster()); setPick(null); }} title="Roll a new cast of companies">Shuffle the companies</button>
            </div>
            <div className="ng-cos">
              {companies.map((c) => (
                <button key={c.key} className={`ng-co ${pick === c.key ? "on" : ""}`} onClick={() => setPick(c.key)} style={{ ["--co" as string]: c.color }}>
                  <span className="ng-co-top"><strong>{c.name}</strong><span className="muted">{c.ticker}</span></span>
                  <span className="ng-co-cap">{fmtMoney(c.marketCap)}<span className="muted"> {tierOf(c.marketCap).name}</span></span>
                  <span className="ng-co-tag">{c.tagline}</span>
                  <span className="ng-co-goods">{Array.from(new Set(c.produce.map((p) => GOOD_BY_ID[p.good].name))).join(", ") || "Pre-revenue"}</span>
                </button>
              ))}
              {companies.length === 0 && <p className="empty">No company matches.</p>}
            </div>
          </div>
        )}
      </section>

      <section className="ng-step">
        <h2><span className="ng-num">II.</span> Set the stage</h2>
        <div className="ng-stage">
          <div>
            <h3>Scenario</h3>
            <div className="ng-options">
              {SCENARIOS.map((x) => (
                <button key={x.id} className={scenario === x.id ? "on" : ""} onClick={() => setScenario(x.id)}>
                  <strong>{x.name}</strong><em>{x.dateline}</em><span>{x.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3>Difficulty</h3>
            <div className="ng-options">
              {DIFFICULTIES.map((x) => (
                <button key={x.id} className={difficulty === x.id ? "on" : ""} onClick={() => setDifficulty(x.id)}><strong>{x.name}</strong><span>{x.blurb}</span></button>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>Goal</h3>
            <div className="ng-options">
              {GOALS.map((x) => {
                const met = mode === "takeover" && chosen && ((x.id === "titan" && tierOf(chosen.marketCap).id === "titan") || (x.id === "unicorn" && chosen.marketCap >= 10e9)
                  || (x.id === "top_dog" && roster.companies.every((o) => o === chosen || o.marketCap < chosen.marketCap)));
                return (
                  <button key={x.id} className={goal === x.id ? "on" : ""} disabled={!!met} onClick={() => setGoal(x.id)} title={met ? "Your company already has this" : undefined}>
                    <strong>{x.name}</strong><span>{met ? "Already done for this company" : x.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {runs.length > 0 && (
        <section className="ng-step">
          <h2><span className="ng-num">III.</span> Your companies</h2>
          <table className="t ng-runs">
            <thead><tr><th>Company</th><th>Started as</th><th>Scenario</th><th className="num">Peak value</th><th className="num">Last seen</th><th>Goal</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td><span className="swatch" style={{ background: r.color }} /> {r.name} <span className="muted">{r.ticker}</span></td>
                  <td>{r.startedAs === "startup" ? "a startup" : r.startedAs === "challenger" ? "a challenger" : "a giant"}, {fmtMoney(r.startCap)}</td>
                  <td>{SCENARIOS.find((x) => x.id === r.scenario)?.name ?? r.scenario}</td>
                  <td className="num">{fmtMoney(r.peakCap)}</td>
                  <td className="num">{r.lastCap > 0 ? fmtMoney(r.lastCap) : <span className="neg">Bankrupt</span>} in {2026 + Math.floor(r.month / 12)}</td>
                  <td>{r.goal === "sandbox" ? <span className="muted">none</span> : r.result === "won" ? <span className="pos">Won</span> : r.result === "lost" ? <span className="neg">Missed</span> : <span className="muted">In progress</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="ng-bar">
        <div className="ng-bar-inner">
          <div className="ng-bar-sel">
            {mode === "found"
              ? <><strong>{name.trim() || "Your company"}</strong> <span className="muted">a {lowerName(GOOD_BY_ID[good].name)} startup in {CITY_SEEDS.find((c) => c.id === city)?.name}</span></>
              : chosen ? <><span className="swatch" style={{ background: chosen.color }} /> <strong>{chosen.name}</strong> <span className="muted">{fmtMoney(chosen.marketCap)}, {tierOf(chosen.marketCap).name}</span></>
              : <span className="muted">Pick a company to run.</span>}
            <div className="muted small">{SCENARIOS.find((x) => x.id === scenario)!.name}, {DIFFICULTIES.find((x) => x.id === difficulty)!.name.toLowerCase()} difficulty{goal !== "sandbox" ? `, goal: ${GOALS.find((x) => x.id === goal)!.name.toLowerCase()}` : ""}</div>
          </div>
          <button className="primary big" onClick={start} disabled={busy || !ready}>{busy ? "Building the economy…" : "Open for business"}</button>
        </div>
      </footer>
    </div>
  );
}
