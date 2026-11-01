import { useState } from "react";
import { COMPANY_SEEDS } from "../sim/data/companies";
import { GOOD_BY_ID, type GoodId } from "../sim/data/goods";
import { STATES } from "../sim/data/states";
import { CITY_SEEDS } from "../sim/data/cities";
import { newGame, type PlayerChoice } from "../sim/engine";
import { tierOf } from "../sim/tiers";
import type { GameState } from "../sim/types";
import { fmtMoney } from "../sim/util";
import { hasLocal, importFile, loadLocal } from "./save";

const STARTUP_GOODS: { good: GoodId; blurb: string }[] = [
  { good: "digital_ads", blurb: "Sell advertising to every business in America. Runs on cloud compute." },
  { good: "streaming", blurb: "Films and series for households. Content licensing is a big running cost." },
  { good: "pharmaceuticals", blurb: "Drugs for a huge, price-insensitive market. Lives and dies by R&D." },
  { good: "groceries", blurb: "Feed the country. Thin margins, enormous market, laborer-heavy plants." },
  { good: "apparel", blurb: "Clothing and footwear: a brand game. Tariffs on imports help you." },
  { good: "electricity", blurb: "Build power plants: gas, solar or nuclear. Slow, capital-heavy, steady." },
  { good: "gas_cars", blurb: "Gasoline vehicles: the biggest market there is, slowly shrinking." },
  { good: "software", blurb: "Cheapest to start. Needs software developers; hosting runs on cloud compute." },
  { good: "data_platforms", blurb: "Small, lucrative contracts with government and big business. Needs analysts and developers." },
  { good: "cloud", blurb: "Capital-hungry data centers that run on AI accelerators." },
  { good: "ai_accelerators", blurb: "Design chips to compete with Verdant. Needs engineers and a supply of semiconductors." },
  { good: "chips", blurb: "Build fabs. Very expensive and slow, but every hardware company needs chips." },
  { good: "batteries", blurb: "Sell battery packs to automakers and the world market." },
  { good: "evs", blurb: "Take on Kestrel. Huge plants, thin margins, enormous market." },
  { good: "smartphones", blurb: "Take on Orchard in a crowded global market." },
  { good: "computers", blurb: "Laptops and desktops. Mature market, steady demand." },
];

export function NewGame({ onStart }: { onStart: (s: GameState) => void }) {
  const [sel, setSel] = useState<string>("startup");
  const [name, setName] = useState("Prairie Dynamics");
  const [ticker, setTicker] = useState("PRDY");
  const [good, setGood] = useState<GoodId>("software");
  const [hq, setHq] = useState("TX");
  const [city, setCity] = useState("austin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const start = () => {
    setBusy(true);
    const choice: PlayerChoice = sel === "startup"
      ? { kind: "startup", name: name.trim() || "Startup", ticker: (ticker.trim() || "NEW").toUpperCase().slice(0, 5), good, hq, city }
      : { kind: "incumbent", key: sel };
    // Let the "Building the economy" message paint before the warm-up year runs.
    window.setTimeout(() => onStart(newGame(choice)), 30);
  };

  return (
    <div className="newgame">
      <div className="hero">
        <h1>American Century</h1>
        <p className="lede">
          Run a company in the American economy from January 2026. Hire from 5,000 census-based pops, build plants in fifty states,
          pick cities by their labor, taxes, permits and power grids, lobby a Congress of 535 real members, fight real House races, and climb from startup to trillion-dollar titan.
        </p>
      </div>

      <div className="row">
        {hasLocal() && <button onClick={() => { const s = loadLocal(); if (s) onStart(s); else setErr("That save is from an older version."); }}>Continue saved game</button>}
        <button onClick={() => importFile().then(onStart).catch((e) => setErr(String(e.message ?? e)))}>Load save file…</button>
        {err && <span className="neg">{err}</span>}
      </div>

      <div className="section-title">Found a startup</div>
      <div className={`card founder ${sel === "startup" ? "sel" : ""}`} onClick={() => setSel("startup")} style={{ cursor: "default" }}>
        <div className="name"><span className="swatch" style={{ background: "var(--ink)" }} />Your own company</div>
        <div className="tag">$80M of venture money, a small R&D team and one production line. Start with no brand and build a giant.</div>
        <div className="row">
          <label>Name <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setSel("startup")} style={{ width: 200 }} /></label>
          <label>Ticker <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onFocus={() => setSel("startup")} style={{ width: 70 }} maxLength={5} /></label>
          <label>Product <select value={good} onChange={(e) => { setGood(e.target.value as GoodId); setSel("startup"); }}>
            {STARTUP_GOODS.map((g) => <option key={g.good} value={g.good}>{GOOD_BY_ID[g.good].name}</option>)}
          </select></label>
          <label>Headquarters <select value={city} onChange={(e) => { const c = CITY_SEEDS.find((x) => x.id === e.target.value)!; setCity(c.id); setHq(c.state); setSel("startup"); }}>
            {STATES.map((st) => (
              <optgroup key={st.code} label={st.name}>
                {CITY_SEEDS.filter((c) => c.state === st.code).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select></label>
        </div>
        <div className="hint">{STARTUP_GOODS.find((g) => g.good === good)?.blurb}</div>
      </div>

      {([["incumbent", "Or take over an established giant"], ["challenger", "…a challenger"], ["startup", "…or a young startup"]] as const).map(([tier, title]) => (
        <div key={tier}>
          <div className="section-title">{title}</div>
          <div className="cards">
            {COMPANY_SEEDS.filter((c) => c.tier === tier).map((c) => (
              <button key={c.key} className={`card ${sel === c.key ? "sel" : ""}`} onClick={() => setSel(c.key)}>
                <div className="name"><span className="swatch" style={{ background: c.color }} />{c.name} <span className="muted" style={{ fontWeight: 400 }}>{c.ticker}</span></div>
                <div className="tag">{c.tagline}</div>
                <div className="meta"><span>{tierOf(c.marketCap).name}</span><span>{fmtMoney(c.marketCap)}</span></div>
                <div className="meta"><span>{Array.from(new Set(c.produce.map((p) => GOOD_BY_ID[p.good].name))).join(", ") || "Pre-revenue"}</span></div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 24 }}>
        <button className="primary" onClick={start} disabled={busy} style={{ padding: "8px 22px", fontSize: 15 }}>
          {busy ? "Building the economy…" : "Start in January 2026"}
        </button>
        <span className="hint"><kbd>Space</kbd> pauses and <kbd>1</kbd> to <kbd>5</kbd> set the speed. Companies are fictional; census figures are approximate; politicians are real and satirized.</span>
      </div>
    </div>
  );
}
