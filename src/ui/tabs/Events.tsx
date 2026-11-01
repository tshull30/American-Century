import { dateLabel, dayLabel, monthOfDay } from "../../sim/util";
import type { GameEvent } from "../../sim/types";
import { Panel, useGame, useSticky } from "../components";

const FILTERS: [string, string, (e: GameEvent, me: number) => boolean][] = [
  ["all", "Everything", () => true],
  ["mine", "My company", (e, me) => e.companyId === me],
  ["deal", "Deals and markets", (e) => e.kind === "deal"],
  ["politics", "Politics", (e) => e.kind === "politics"],
  ["election", "Elections", (e) => e.tag === "election" || /primary|election/i.test(e.text)],
  ["world", "Economy and cities", (e) => e.kind !== "politics" && e.kind !== "deal" && e.companyId === undefined],
];

export function Events() {
  const [view, setView] = useSticky<"log" | "archive">("events.view", "log");
  return (
    <div>
      <div className="tabs-inline" style={{ marginBottom: 10 }}>
        <button className={view === "log" ? "on" : ""} onClick={() => setView("log")}>Event log</button>
        <button className={view === "archive" ? "on" : ""} onClick={() => setView("archive")}>Front-page archive</button>
      </div>
      {view === "log" ? <EventLog /> : <Archive />}
    </div>
  );
}

function Archive() {
  const { s } = useGame();
  const [mine, setMine] = useSticky("archive.mine", false);
  const [q, setQ] = useSticky("archive.q", "");
  const needle = q.trim().toLowerCase();
  const items = (s.archive ?? []).filter((a) => (!mine || a.mine) && (!needle || (a.headline + " " + (a.deck ?? "")).toLowerCase().includes(needle)));
  const byMonth = new Map<number, typeof items>();
  for (const a of items) { const m = monthOfDay(a.day); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m)!.push(a); }
  const months = [...byMonth.keys()].sort((a, b) => b - a);
  return (
    <div className="archive">
      <header className="archive-head">
        <div className="archive-title">The American Ledger</div>
        <div className="archive-sub">Bound volumes, {months.length ? `${dateLabel(months[months.length - 1])} to ${dateLabel(months[0])}` : "no issues yet"}</div>
        <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only stories about you</label>
          <input type="search" placeholder="Search headlines" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        </div>
      </header>
      {months.length === 0 && <p className="empty" style={{ textAlign: "center" }}>No front pages yet. Big news ends up here.</p>}
      {months.map((m) => (
        <section key={m} className="archive-month">
          <h3>{dateLabel(m)}</h3>
          <div className="clippings">
            {byMonth.get(m)!.slice().reverse().map((a, i) => (
              <article key={i} className={`clipping ${a.mine ? "mine" : ""} ${a.kind}`}>
                <h4>{a.headline}</h4>
                {a.deck && <p>{a.deck}</p>}
                <span className="when">{dayLabel(a.day)}</span>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventLog() {
  const { s, me } = useGame();
  const [filter, setFilter] = useSticky("events.filter", "all");
  const [q, setQ] = useSticky("events.q", "");
  const f = FILTERS.find((x) => x[0] === filter) ?? FILTERS[0];
  const needle = q.trim().toLowerCase();
  const list = s.events.filter((e) => f[2](e, me.id) && (!needle || e.text.toLowerCase().includes(needle))).slice().reverse();
  return (
    <Panel
      title="Event log"
      right={
        <span className="row">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show">
            {FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input type="search" placeholder="Search the log" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} />
        </span>
      }
    >
      {list.length === 0 && <p className="hint">Nothing matches. Try another filter or clear the search.</p>}
      <ul className="events">
        {list.map((e, i) => <li key={i}><span className="when">{dayLabel(e.day)}</span><span className={e.kind}>{e.text}</span></li>)}
      </ul>
    </Panel>
  );
}
