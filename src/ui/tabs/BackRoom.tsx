import { useState } from "react";
import { heat, SCHEMES, smear, toggleScheme, type SchemeId } from "../../sim/crime";
import { GOOD_BY_ID } from "../../sim/data/goods";
import { dateLabel, fmtMoney, lowerName } from "../../sim/util";
import { Panel, useGame } from "../components";

const SEV = ["", "minor", "serious", "grave", "catastrophic"];

export function BackRoom() {
  const { s, me, act, ask } = useGame();
  const [target, setTarget] = useState<number>(0);
  const h = heat(me);
  const rivals = s.companies.filter((c) => c.alive && !c.isPlayer).sort((a, b) => b.marketCap - a.marketCap);
  const sel = target || rivals[0]?.id;
  const probed = s.companies.filter((c) => c.alive && c.probe && !c.isPlayer);
  return (
    <div className="backroom">
      <div className="folder">
        <span className="stamp-conf">Confidential</span>
        <h2>Off the books</h2>
        <p className="lede">Every scheme here pays off now. Every one leaves a trail. Unhappy executives make whistleblowers; a politically connected CEO keeps things quiet. Stop a scheme and the trail fades, slowly.</p>
        <div className="heat">
          <div className="heat-label">Heat <span className="muted small">how interesting you look to investigators</span></div>
          <div className="heat-bar"><span style={{ width: `${Math.min(100, h / 0.8)}%` }} /></div>
          <div className="heat-num">{Math.round(h)}<span className="muted small"> {h < 10 ? "nobody's looking" : h < 30 ? "a few questions" : h < 60 ? "someone is building a file" : "subpoenas are being drafted"}</span></div>
        </div>
        {me.probe && (
          <div className="probe">
            <strong>Under investigation by {me.probe.agency}</strong> since {dateLabel(me.probe.opened)}. Severity: {SEV[me.probe.severity]}. They'll act around {dateLabel(me.probe.until)}, and you'll have to decide how to respond.
          </div>
        )}
      </div>

      <div className="schemes">
        {(Object.keys(SCHEMES) as SchemeId[]).map((id) => {
          const d = SCHEMES[id];
          const st = me.schemes?.[id];
          return (
            <article key={id} className={`scheme ${st?.active ? "on" : ""}`}>
              <h3>{d.name}</h3>
              <p className="pitch">{d.pitch}</p>
              <dl>
                <dt>Payoff</dt><dd>{d.payoff}{id === "price_fix" && s.cartel?.members.includes(me.id) ? ` (in ${lowerName(GOOD_BY_ID[s.cartel.good].name)}, with ${s.cartel.members.length - 1} rivals)` : ""}</dd>
                <dt>Who'd catch you</dt><dd>{d.agency}</dd>
                {st && <><dt>Paper trail</dt><dd><span className="trail"><span style={{ width: `${Math.min(100, st.exposure * 2.5)}%` }} /></span> {st.exposure.toFixed(0)}{st.gain > 0 ? `, ${fmtMoney(st.gain)} gained so far` : ""}</dd></>}
              </dl>
              <button className={st?.active ? "" : "danger"} onClick={() => (st?.active ? act(toggleScheme(s, me, id)) : ask(`Start "${d.name.toLowerCase()}"? This is illegal, and ${d.agency} may come knocking.`, () => act(toggleScheme(s, me, id))))}>
                {st?.active ? "Wind it down" : "Do it"}
              </button>
            </article>
          );
        })}
        <article className="scheme">
          <h3>Smear a rival</h3>
          <p className="pitch">A PR firm that doesn't list clients, a few friendly reporters, and stories about their products and their CEO.</p>
          <dl><dt>Payoff</dt><dd>Their image and stock take a hit</dd><dt>Who'd catch you</dt><dd>Reporters, eventually</dd></dl>
          <div className="row">
            <select value={sel} onChange={(e) => setTarget(Number(e.target.value))} style={{ maxWidth: 220 }}>
              {rivals.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="danger" onClick={() => act(smear(s, me, sel))}>Plant the stories</button>
          </div>
        </article>
        <article className="scheme">
          <h3>Grease palms</h3>
          <p className="pitch">Mayors, council members and governors can be paid to vote your way. Find them under States and cities and open their file.</p>
          <dl><dt>Payoff</dt><dd>Their vote on anything you lobby for, and your incentive deals</dd><dt>Who'd catch you</dt><dd>the FBI</dd></dl>
          <p className="muted small">Ideologues refuse and remember. Populists usually do too.</p>
        </article>
      </div>

      <Panel title="Rap sheet: rivals under investigation">
        {probed.length === 0 ? <p className="empty">Nobody else is in trouble right now.</p> : (
          <ul className="votes">{probed.map((c) => <li key={c.id}><span className="when">{dateLabel(c.probe!.opened)}</span><strong>{c.name}</strong> <span className="muted">{c.probe!.agency}, {SEV[c.probe!.severity]}</span></li>)}</ul>
        )}
      </Panel>
    </div>
  );
}
