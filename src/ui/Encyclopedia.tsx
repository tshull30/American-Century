import { useState } from "react";
import { TOPICS, TOPIC_BY_ID } from "./encyclopedia";

const GROUPS = ["Basics", "Company", "Markets", "People", "Politics", "World"] as const;

/** Renders [[id]] and [[id|label]] links inside a paragraph. */
function Para({ text, go }: { text: string; go: (id: string) => void }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return <p>{parts.map((p, i) => {
    const m = /^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/.exec(p);
    if (!m) return <span key={i}>{p}</span>;
    const t = TOPIC_BY_ID[m[1]];
    return <a key={i} onClick={() => go(m[1])}>{m[2] ?? t?.title.toLowerCase() ?? m[1]}</a>;
  })}</p>;
}

export function Encyclopedia({ topic, onClose }: { topic: string; onClose: () => void }) {
  const [cur, setCur] = useState(TOPIC_BY_ID[topic] ? topic : "basics");
  const [q, setQ] = useState("");
  const t = TOPIC_BY_ID[cur];
  const needle = q.trim().toLowerCase();
  const list = TOPICS.filter((x) => !needle || x.title.toLowerCase().includes(needle) || x.body.some((b) => b.toLowerCase().includes(needle)));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal encyclopedia" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Encyclopedia">
        <aside>
          <div className="enc-title">Encyclopedia</div>
          <input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          {GROUPS.map((g) => {
            const items = list.filter((x) => x.group === g);
            if (!items.length) return null;
            return <div key={g}><div className="enc-group">{g}</div>{items.map((x) => <a key={x.id} className={x.id === cur ? "on" : ""} onClick={() => setCur(x.id)}>{x.title}</a>)}</div>;
          })}
        </aside>
        <article>
          <h3>{t.title}</h3>
          {t.body.map((b, i) => <Para key={i} text={b} go={setCur} />)}
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}><button className="primary" autoFocus onClick={onClose}>Close</button></div>
        </article>
      </div>
    </div>
  );
}
