import { useState } from "react";
import { COMPANY_SEEDS } from "../sim/data/companies";
import { GOOD_BY_ID, type GoodId } from "../sim/data/goods";
import { STATES } from "../sim/data/states";
import { newGame, type PlayerChoice } from "../sim/engine";
import { tierOf } from "../sim/tiers";
import type { GameState } from "../sim/types";
import { fmtMoney } from "../sim/util";
import { hasLocal, importFile, loadLocal } from "./save";

const STARTUP_GOODS: { good: GoodId; blurb: string }[] = [
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const start = () => {
    setBusy(true);
    const choice: PlayerChoice = sel === "startup"
      ? { kind: "startup", name: name.trim() || "Startup", ticker: (ticker.trim() || "NEW").toUpperCase().slice(0, 5), good, hq }
      : { kind: "incumbent", key: sel };
    // Let the "Building the economy" message paint before the warm-up year runs.
    window.setTimeout(() => onStart(newGame(choice)), 30);
  };

  return (
    <div className="newgame">
      <h1>American Century</h1>
      <p className="lede">
        Run a company in the modern American economy. Hire workers from real-ish census pops, build plants across 50 states,
        out-sell your rivals, climb the market-cap tiers and buy whoever gets in your way.
      </p>

      <div className="row">
        {hasLocal() && <button onClick={() => { const s = loadLocal(); if (s) onStart(s); else setErr("That save is from an older version."); }}>Continue saved game</button>}
        <button onClick={() => importFile().then(onStart).catch((e) => setErr(String(e.message ?? e)))}>Load save file…</button>
        {err && <span className="neg">{err}</span>}
      </div>

      <div className="section-title">Found a startup</div>
      <div className={`card ${sel === "startup" ? "sel" : ""}`} onClick={() => setSel("startup")} style={{ cursor: "default" }}>
        <div className="name"><span className="swatch" style={{ background: "#ffca28" }} />Your own company</div>
        <div className="tag">$80M of venture money, a small R&D team and one production line. Start with no brand and build a giant.</div>
        <div className="row">
          <label>Name <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setSel("startup")} style={{ width: 200 }} /></label>
          <label>Ticker <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onFocus={() => setSel("startup")} style={{ width: 70 }} maxLength={5} /></label>
          <label>Product <select value={good} onChange={(e) => { setGood(e.target.value as GoodId); setSel("startup"); }}>
            {STARTUP_GOODS.map((g) => <option key={g.good} value={g.good}>{GOOD_BY_ID[g.good].name}</option>)}
          </select></label>
          <label>Headquarters <select value={hq} onChange={(e) => { setHq(e.target.value); setSel("startup"); }}>
            {STATES.map((st) => <option key={st.code} value={st.code}>{st.name}</option>)}
          </select></label>
        </div>
        <div className="hint">{STARTUP_GOODS.find((g) => g.good === good)?.blurb}</div>
      </div>

      <div className="section-title">Or take over an existing company</div>
      <div className="cards">
        {COMPANY_SEEDS.map((c) => (
          <button key={c.key} className={`card ${sel === c.key ? "sel" : ""}`} onClick={() => setSel(c.key)}>
            <div className="name"><span className="swatch" style={{ background: c.color }} />{c.name} <span className="muted" style={{ fontWeight: 400 }}>{c.ticker}</span></div>
            <div className="tag">{c.tagline}</div>
            <div className="meta"><span>{tierOf(c.marketCap).name}</span><span>{fmtMoney(c.marketCap)}</span></div>
            <div className="meta"><span>{c.produce.map((p) => GOOD_BY_ID[p.good].name).join(", ") || "Pre-revenue"}</span><span>like {c.inspiredBy}</span></div>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        <button className="primary" onClick={start} disabled={busy} style={{ padding: "8px 22px", fontSize: 15 }}>
          {busy ? "Building the economy…" : "Start in January 2026"}
        </button>
        <span className="hint">Controls: <kbd>Space</kbd> pause, <kbd>1</kbd>–<kbd>5</kbd> game speed. Companies are fictional; census figures are approximate.</span>
      </div>
    </div>
  );
}
