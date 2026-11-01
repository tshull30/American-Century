import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tick, player } from "../sim/engine";
import { tierOf, TIERS } from "../sim/tiers";
import type { GameState } from "../sim/types";
import { dayLabel, fmtMoney, fmtPct } from "../sim/util";
import { ConfirmDialog, GameCtx, Guilloche, makeCtx } from "./components";
import { NewGame } from "./NewGame";
import { exportFile, importFile, saveLocal } from "./save";
import { autosaveDue, loadSettings, loadUi, saveSettings, saveUi, type Settings } from "./settings";
import { SettingsDialog } from "./SettingsDialog";
import { computeAlerts } from "./alerts";
import { Overview } from "./tabs/Overview";
import { Production } from "./tabs/Production";
import { Workforce } from "./tabs/Workforce";
import { Markets } from "./tabs/Markets";
import { Research } from "./tabs/Research";
import { Finance } from "./tabs/Finance";
import { Rivals } from "./tabs/Rivals";
import { Pops } from "./tabs/Pops";
import { Events } from "./tabs/Events";
import { Politics } from "./tabs/Politics";
import { Consumers } from "./tabs/Consumers";
import { Headquarters } from "./tabs/Headquarters";
import { Elections } from "./tabs/Elections";

/** Milliseconds per game day, and days simulated per step, for speeds 1–5. */
const SPEEDS: [number, number][] = [[0, 0], [600, 1], [250, 1], [90, 1], [30, 1], [16, 4]];
const TABS = [
  ["overview", "Overview"], ["production", "Production"], ["workforce", "Workforce"], ["markets", "Markets"],
  ["headquarters", "Headquarters"], ["research", "Research"], ["finance", "Finance"], ["rivals", "Rivals & M&A"], ["consumers", "Consumers"],
  ["politics", "Politics"], ["elections", "Elections"], ["pops", "Pops & Map"], ["events", "Events"],
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
  const [tab, setTabRaw] = useState<TabId>(() => loadUi<TabId>("tab", "overview"));
  const setTab = useCallback((t: TabId) => { setTabRaw(t); saveUi("tab", t); }, []);
  const [settings, setSettingsRaw] = useState<Settings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const setSettings = useCallback((x: Settings) => { setSettingsRaw(x); saveSettings(x); }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [pausedBy, setPausedBy] = useState<string[] | null>(null);
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null);
  const showToast = useCallback((m: string, err?: boolean) => {
    setToast({ m, err });
    window.setTimeout(() => setToast((t) => (t?.m === m ? null : t)), 3500);
  }, []);

  // The simulation runs on its own timer; the screen redraws at most ~7 times a second.
  const dirty = useRef(false);
  useEffect(() => {
    if (!speed || s.gameOver) return;
    const [ms, steps] = SPEEDS[speed];
    const id = window.setInterval(() => {
      for (let i = 0; i < steps && !s.gameOver; i++) {
        const m = s.month;
        const before = s.events.length;
        const lastEvent = s.events[before - 1];
        tick(s);
        if (s.month !== m && autosaveDue(settingsRef.current.autosave, s.month)) saveLocal(s);
        // Pause on anything the player asked to be stopped for.
        const start = lastEvent ? s.events.lastIndexOf(lastEvent) + 1 : 0;
        const hits = s.events.slice(start).filter((e) => e.tag && settingsRef.current.pause[e.tag]).map((e) => e.text);
        if (hits.length) {
          setPausedBy(hits.slice(0, 4));
          lastSpeed.current = speed;
          setSpeed(0);
          break;
        }
      }
      if (s.gameOver) setSpeed(0);
      dirty.current = true;
    }, ms);
    return () => window.clearInterval(id);
  }, [speed, s]);
  useEffect(() => {
    const id = window.setInterval(() => { if (dirty.current) { dirty.current = false; refresh(); } }, 140);
    return () => window.clearInterval(id);
  }, [refresh]);

  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "Escape") { setPending(null); setShowSettings(false); setPausedBy(null); return; }
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPausedBy(null);
        setSpeed((sp) => { if (sp) { lastSpeed.current = sp; return 0; } return lastSpeed.current; });
      } else if (/^Digit[1-5]$/.test(e.code)) { setPausedBy(null); setSpeed(Number(e.code.slice(5))); }
      else if (e.key === "+" || e.key === "=") setSpeed((sp) => Math.min(5, sp + 1));
      else if (e.key === "-") setSpeed((sp) => Math.max(1, sp - 1));
      else if (e.key === "." ) { setSpeed((sp) => { if (!sp && !s.gameOver) { tick(s); dirty.current = true; } return sp; }); }
      else if (e.key === "[" || e.key === "]") {
        const i = TABS.findIndex(([id]) => id === tabRef.current);
        setTab(TABS[(i + (e.key === "]" ? 1 : TABS.length - 1)) % TABS.length][0]);
      } else if (e.key === "?") setShowSettings((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, setTab]);

  const [pending, setPending] = useState<{ message: string; onYes: () => void } | null>(null);
  const ask = useCallback((message: string, onYes: () => void) => setPending({ message, onYes }), []);
  const ctx = makeCtx(s, refresh, showToast, ask);
  const me = player(s);
  const tier = tierOf(me.marketCap);
  const peers = useMemo(
    () => s.companies.filter((c) => c.alive && tierOf(c.marketCap).id === tier.id).sort((a, b) => b.marketCap - a.marketCap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.day, tier.id, s.companies.length],
  );
  const rank = peers.findIndex((c) => c.id === me.id) + 1;
  const prev = me.history[me.history.length - 1];
  const change = prev ? me.marketCap / prev.marketCap - 1 : 0;
  const nextTier = TIERS[TIERS.findIndex((t) => t.id === tier.id) - 1];
  const alerts = computeAlerts(s, me);
  useEffect(() => { document.title = `${me.name}, ${dayLabel(s.day)}: American Century`; }, [me.name, s.day]);

  return (
    <GameCtx.Provider value={ctx}>
      <div className="app">
        <div className="masthead">
          <Guilloche />
          <div className="topbar">
            <span className="brand">American Century</span>
            <span className="co"><span className="swatch" style={{ background: me.color }} />{me.name} <span className="muted" style={{ fontWeight: 400 }}>{me.ticker}</span></span>
            <div className="kpi"><span className="label">Cash</span><span className="value">{fmtMoney(me.cash)}</span></div>
            <div className="kpi"><span className="label">Debt</span><span className="value">{fmtMoney(me.debt)}</span></div>
            <div className="kpi"><span className="label">Market cap</span><span className="value">{fmtMoney(me.marketCap)} <span className={change >= 0 ? "pos" : "neg"} style={{ fontSize: 12, fontWeight: 400 }}>{change >= 0 ? "+" : "−"}{fmtPct(Math.abs(change))}</span></span></div>
            <div className="kpi"><span className="label">Tier</span><span className="value">{tier.name}, {rank} of {peers.length}</span></div>
            {nextTier && <div className="kpi"><span className="label">Next tier</span><span className="value">{fmtMoney(nextTier.min)}</span></div>}
            <div className="spacer" />
            <div className="speed">
              <button className={speed === 0 ? "active" : ""} onClick={() => { if (speed) lastSpeed.current = speed; setSpeed(0); }} title="Pause (Space)">Pause</button>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={speed === n ? "active" : ""} onClick={() => { setPausedBy(null); setSpeed(n); }} title={`Speed ${n} (key ${n})`}>{n}</button>
              ))}
              <button onClick={() => { tick(s); refresh(); }} disabled={speed > 0 || !!s.gameOver} title="Advance one day">+1 day</button>
            </div>
            <span className="date">{dayLabel(s.day)}</span>
            <button onClick={() => showToast(saveLocal(s) ? "Game saved in this browser." : "Couldn't save in this browser; use Export.", false)}>Save</button>
            <button onClick={() => exportFile(s)} title="Download the save file">Export</button>
            <button onClick={() => setShowSettings(true)} title="Settings and keyboard shortcuts (?)">Settings</button>
            <button onClick={() => ask("Quit to the main menu? Progress since your last save is lost.", onQuit)}>Menu</button>
          </div>
          {s.gameOver && (
            <div className="gameover"><strong>Game over.</strong> {s.gameOver}<button onClick={onQuit}>New game</button></div>
          )}
        </div>
        <nav className="tabs">
          {TABS.map(([id, label]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>)}
        </nav>
        {pausedBy && (
          <div className="pausebar">
            <strong>Paused.</strong>
            <span className="pausetext">{pausedBy.join(" ")}</span>
            <button onClick={() => { setPausedBy(null); setSpeed(lastSpeed.current || 2); }}>Resume</button>
            <button className="link" onClick={() => setPausedBy(null)}>Dismiss</button>
          </div>
        )}
        {alerts.length > 0 && (
          <div className="alerts">
            {alerts.slice(0, 6).map((a) => (
              <button key={a.text} className={`alert ${a.tone}`} onClick={() => setTab(a.tab as TabId)}>{a.text}</button>
            ))}
            {alerts.length > 6 && <span className="muted">and {alerts.length - 6} more on Overview</span>}
          </div>
        )}
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
          {tab === "politics" && <Politics />}
          {tab === "consumers" && <Consumers />}
          {tab === "headquarters" && <Headquarters />}
          {tab === "elections" && <Elections />}
        </main>
      </div>
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.m}</div>}
      {showSettings && <SettingsDialog settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
      {pending && <ConfirmDialog message={pending.message} onNo={() => setPending(null)} onYes={() => { const f = pending.onYes; setPending(null); f(); }} />}
    </GameCtx.Provider>
  );
}

export { importFile };
