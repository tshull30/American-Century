import { useState } from "react";
import { dayLabel } from "../../sim/util";
import { Panel, useGame } from "../components";

export function Events() {
  const { s, me } = useGame();
  const [mine, setMine] = useState(false);
  const list = s.events.filter((e) => !mine || e.companyId === me.id).slice().reverse();
  return (
    <Panel title="Event log" right={<label><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> only my company</label>}>
      <ul className="events">
        {list.map((e, i) => <li key={i}><span className="when">{dayLabel(e.day)}</span><span className={e.kind}>{e.text}</span></li>)}
      </ul>
    </Panel>
  );
}
