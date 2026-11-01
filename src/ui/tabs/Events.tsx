import { dayLabel } from "../../sim/util";
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
