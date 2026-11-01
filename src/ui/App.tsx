import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tick, player } from "../sim/engine";
import { tierOf, TIERS } from "../sim/tiers";
import type { GameState } from "../sim/types";
import { dateLabel, fmtMoney, fmtPct } from "../sim/util";
import { GameCtx, makeCtx } from "./components";
import { NewGame } from "./NewGame";
import { exportFile, importFile, saveLocal } from "./save";
import { Overview } from "./tabs/Overview";
import { Production } from "./tabs/Production";
import { Workforce } from "./tabs/Workforce";
import { Markets } from "./tabs/Markets";
import { Research } from "./tabs/Research";
import { Finance } from "./tabs/Finance";
import { Rivals } from "./tabs/Rivals";
import { Pops } from "./tabs/Pops";
import { Events } from "./tabs/Events";

const SPEEDS = [0, 1500, 800, 400, 160, 40];
const TABS = [
  ["overview", "Overview"], ["production", "Production"], ["workforce", "Workforce"], ["markets", "Markets"],
  ["research", "Research"], ["finance", "Finance"], ["rivals", "Rivals & M&A"], ["pops", "Pops & Map"], ["events", "Events"],
] as const;
type TabId = (typeof TABS)[number][0];

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  if (!game) return <NewGame onStart={setGame} />;
  return <Game key={game.seed + ":" + game.playerId} initial={game} onQuit={() => setGame(null)} />;
}

function Game({ initial, onQuit }: { initial: GameState; onQuit: () => void }) {
  const sRef = useRef(initial);
  const s = sRef.current;
  const [, setV] = useState(0);
  const refresh = useCallback(() => setV((v) => v + 1), []);
  const [speed, setSpeed] = useState(0);
  const lastSpeed = useRef(2);
  const [tab, setTab] = useState<TabId>("overview");
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null);
  const showToast = useCallback((m: string, err?: boolean) => {
    setToast({ m, err });
    window.setTimeout(() => setToast((t) => (t?.m === m ? null : t)), 3500);
  }, []);

  useEffect(() => {
    if (!speed || s.gameOver) return;
    const id = window.setInterval(() => {
      tick(s);
      if (s.month % 12 === 0) saveLocal(s);
      if (s.gameOver) setSpeed(0);
      refresh();
    }, SPEEDS[speed]);
    return () => window.clearInterval(id);
  }, [speed, s, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpeed((sp) => { if (sp) { lastSpeed.current = sp; return 0; } return lastSpeed.current; });
      } else if (/^Digit[1-5]$/.test(e.code)) setSpeed(Number(e.code.slice(5)));
      else if (e.key === "+" || e.key === "=") setSpeed((sp) => Math.min(5, sp + 1));
      else if (e.key === "-") setSpeed((sp) => Math.max(1, sp - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ctx = makeCtx(s, refresh, showToast);
  const me = player(s);
  const tier = tierOf(me.marketCap);
  const peers = useMemo(
    () => s.companies.filter((c) => c.alive && tierOf(c.marketCap).id === tier.id).sort((a, b) => b.marketCap - a.marketCap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.month, tier.id, s.companies.length],
  );
  const rank = peers.findIndex((c) => c.id === me.id) + 1;
  const prev = me.history[me.history.length - 2];
  const change = prev ? me.marketCap / prev.marketCap - 1 : 0;
  const nextTier = TIERS[TIERS.findIndex((t) => t.id === tier.id) - 1];

  return (
    <GameCtx.Provider value={ctx}>
      <div className="app">
        <div>
          <div className="topbar">
            <span className="brand">American Century</span>
            <span className="co"><span className="swatch" style={{ background: me.color }} />{me.name} <span className="muted">{me.ticker}</span></span>
            <div className="kpi"><span className="label">Cash</span><span className="value">{fmtMoney(me.cash)}</span></div>
            <div className="kpi"><span className="label">Debt</span><span className="value">{fmtMoney(me.debt)}</span></div>
            <div className="kpi"><span className="label">Market cap</span><span className="value">{fmtMoney(me.marketCap)} <span className={change >= 0 ? "pos" : "neg"} style={{ fontSize: 11 }}>{change >= 0 ? "▲" : "▼"}{fmtPct(Math.abs(change))}</span></span></div>
            <div className="kpi"><span className="label">Tier</span><span className="value">{tier.name} #{rank}/{peers.length}</span></div>
            {nextTier && <div className="kpi"><span className="label">Next tier</span><span className="value">{fmtMoney(nextTier.min)}</span></div>}
            <div className="spacer" />
            <div className="speed">
              <button className={speed === 0 ? "active" : ""} onClick={() => { if (speed) lastSpeed.current = speed; setSpeed(0); }} title="Pause (Space)">❚❚</button>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={speed === n ? "active" : ""} onClick={() => setSpeed(n)} title={`Speed ${n} (key ${n})`}>{">".repeat(Math.min(n, 3))}{n > 3 ? n : ""}</button>
              ))}
              <button onClick={() => { tick(s); refresh(); }} disabled={speed > 0 || !!s.gameOver} title="Advance one month">+1 mo</button>
            </div>
            <span className="date">{dateLabel(s.month)}</span>
            <button onClick={() => showToast(saveLocal(s) ? "Game saved in this browser." : "Couldn't save in this browser; use Export.", false)}>Save</button>
            <button onClick={() => exportFile(s)} title="Download the save file">Export</button>
            <button onClick={() => { if (confirm("Quit to the main menu? Unsaved progress is lost.")) onQuit(); }}>Menu</button>
          </div>
          {s.gameOver && (
            <div className="gameover"><strong>Game over.</strong> {s.gameOver}<button onClick={onQuit}>New game</button></div>
          )}
        </div>
        <nav className="tabs">
          {TABS.map(([id, label]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>)}
        </nav>
        <main className="main">
          {tab === "overview" && <Overview />}
          {tab === "production" && <Production />}
          {tab === "workforce" && <Workforce />}
          {tab === "markets" && <Markets />}
          {tab === "research" && <Research />}
          {tab === "finance" && <Finance />}
          {tab === "rivals" && <Rivals />}
          {tab === "pops" && <Pops />}
          {tab === "events" && <Events />}
        </main>
      </div>
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.m}</div>}
    </GameCtx.Provider>
  );
}

export { importFile };
