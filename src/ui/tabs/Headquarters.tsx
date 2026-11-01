import { useState } from "react";
import { relocateHq, setHqForm, toggleAmenity } from "../../sim/actions";
import { STATES } from "../../sim/data/states";
import { buildCostPerLevel } from "../../sim/engine";
import { citiesInState, cityLabel, opinionOf } from "../../sim/geo";
import { AMENITIES, amenityCost, HQ_FORMS, hqLevels, hqUpkeep, towerAllowed } from "../../sim/hq";
import type { AmenityId, Company, HqForm } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct } from "../../sim/util";
import { Panel, Table, useGame } from "../components";

/** An engraved elevation of the HQ: a tower's floors, a campus's buildings, or a city block. */
function HqDrawing({ c, label }: { c: Company; label: string }) {
  const lv = hqLevels(c);
  const W = 520, H = 260, ground = 232;
  const ink = "var(--ink)", line = "var(--engrave)";
  const has = (a: AmenityId) => c.hqSite.amenities.includes(a);
  const parts: JSX.Element[] = [];
  if (c.hqSite.form === "tower") {
    const floors = Math.min(90, Math.max(8, Math.round(Math.sqrt(lv) * 4)));
    const fh = Math.min(5, 190 / floors), w = 96, x = W / 2 - w / 2, top = ground - floors * fh;
    parts.push(<rect key="t" x={x} y={top} width={w} height={floors * fh} fill="var(--paper-2)" stroke={ink} strokeWidth={1.2} />);
    for (let i = 1; i < floors; i++) parts.push(<line key={`f${i}`} x1={x} x2={x + w} y1={top + i * fh} y2={top + i * fh} stroke={line} strokeWidth={0.4} />);
    for (let k = 1; k < 6; k++) parts.push(<line key={`m${k}`} x1={x + (w / 6) * k} x2={x + (w / 6) * k} y1={top} y2={ground} stroke={line} strokeWidth={0.3} />);
    parts.push(<line key="sp" x1={W / 2} x2={W / 2} y1={top} y2={top - 18} stroke={ink} strokeWidth={1.2} />);
    if (has("solar_roof")) parts.push(<rect key="sol" x={x + 8} y={top - 5} width={w - 16} height={4} fill={line} />);
  } else if (c.hqSite.form === "campus") {
    const n = Math.min(14, Math.max(3, Math.round(Math.sqrt(lv) / 3)));
    const bw = 380 / n;
    for (let i = 0; i < n; i++) {
      const h = 34 + ((i * 37) % 30);
      const x = 70 + i * bw;
      parts.push(<rect key={`b${i}`} x={x + 3} y={ground - h} width={bw - 8} height={h} fill="var(--paper-2)" stroke={ink} strokeWidth={1} />);
      for (let f = 1; f < h / 9; f++) parts.push(<line key={`b${i}f${f}`} x1={x + 3} x2={x + bw - 5} y1={ground - f * 9} y2={ground - f * 9} stroke={line} strokeWidth={0.35} />);
      if (has("solar_roof")) parts.push(<rect key={`s${i}`} x={x + 6} y={ground - h - 3} width={bw - 14} height={2.5} fill={line} />);
    }
    for (let i = 0; i < 7; i++) parts.push(<circle key={`tr${i}`} cx={60 + i * 66} cy={ground - 7} r={6} fill="none" stroke={line} strokeWidth={0.8} />);
  } else {
    const heights = [70, 110, 90, 130, 80, 100];
    heights.forEach((h, i) => {
      const x = 110 + i * 50;
      parts.push(<rect key={`k${i}`} x={x} y={ground - h} width={48} height={h} fill="var(--paper-2)" stroke={ink} strokeWidth={1} />);
      for (let f = 1; f < h / 10; f++) parts.push(<line key={`k${i}f${f}`} x1={x} x2={x + 48} y1={ground - f * 10} y2={ground - f * 10} stroke={line} strokeWidth={0.35} />);
      parts.push(<rect key={`sh${i}`} x={x + 6} y={ground - 12} width={36} height={12} fill="none" stroke={ink} strokeWidth={0.6} />);
    });
  }
  if (has("plaza")) for (let i = 0; i < 5; i++) parts.push(<circle key={`p${i}`} cx={40 + i * 10} cy={ground - 6} r={5} fill="none" stroke={line} strokeWidth={0.8} />);
  if (has("shuttle")) parts.push(<g key="bus"><rect x={W - 92} y={ground - 14} width={44} height={13} rx={2} fill="none" stroke={ink} /><circle cx={W - 82} cy={ground} r={2.5} fill={ink} /><circle cx={W - 58} cy={ground} r={2.5} fill={ink} /></g>);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 620, display: "block" }} role="img" aria-label={`${HQ_FORMS[c.hqSite.form].name} headquarters`}>
      {parts}
      <line x1={10} x2={W - 10} y1={ground} y2={ground} stroke={ink} strokeWidth={1.5} />
      <text x={W / 2} y={H - 8} textAnchor="middle" fontFamily="var(--display)" fontStyle="italic" fontSize={15} fill={ink}>{c.name}, {label}</text>
    </svg>
  );
}

export function Headquarters() {
  const { s, me, act, ask } = useGame();
  const lv = hqLevels(me);
  const form = HQ_FORMS[me.hqSite.form];
  const [dest, setDest] = useState(me.hqSite.city);
  const moveCost = buildCostPerLevel(s, "hq", dest, undefined, false, me) * lv * 0.5;
  return (
    <div className="grid2">
      <div>
        <Panel title="Headquarters" right={cityLabel(s, me.hqSite.city)}>
          <HqDrawing c={me} label={cityLabel(s, me.hqSite.city)} />
          <table className="t" style={{ marginTop: 10 }}><tbody>
            <tr><td>Form</td><td>{form.name}</td></tr>
            <tr><td>Size</td><td>{fmtNum(lv)} office levels, about {fmtNum(lv * 100)} corporate staff</td></tr>
            <tr><td>Amenities</td><td>{me.hqSite.amenities.length} of {form.slots} slots, {fmtMoney(hqUpkeep(me))} a month to run</td></tr>
            <tr><td>Locals' opinion</td><td>{fmtPct(opinionOf(s, me.hqSite.city, me), 0)}</td></tr>
            <tr><td>State corporate tax</td><td>{me.hq}: {STATES.find((x) => x.code === me.hq)?.corpTax ?? 0}%</td></tr>
          </tbody></table>
          <p className="hint">Headquarters houses executives, finance, legal and HR. Each level supports 15 levels of plants and offices; add levels on the Production tab. The form and amenities here shape who wants to work for you and how your city feels about you.</p>
        </Panel>
        <Panel title="Rebuild">
          <div className="row">
            {(Object.keys(HQ_FORMS) as HqForm[]).map((f) => {
              const def = HQ_FORMS[f];
              const disabled = f === me.hqSite.form || (def.needsTower && !towerAllowed(s, me.hqSite.city));
              return (
                <button key={f} disabled={disabled} className={f === me.hqSite.form ? "active" : ""} title={def.blurb}
                  onClick={() => ask(`Rebuild headquarters as a ${def.name.toLowerCase()}? ${def.blurb}`, () => act(setHqForm(s, me.id, f)))}>{def.name}</button>
              );
            })}
          </div>
          <p className="hint">{form.blurb}</p>
        </Panel>
        <Panel title="Relocate">
          <div className="row">
            <select value={dest} onChange={(e) => setDest(e.target.value)} aria-label="New HQ city">
              {STATES.map((st) => <optgroup key={st.code} label={st.name}>{citiesInState(s, st.code).filter((c) => !c.rest).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}
            </select>
            <button disabled={dest === me.hqSite.city} onClick={() => ask(`Move headquarters to ${cityLabel(s, dest)} for ${fmtMoney(moveCost)}? Your old city won't forgive you quickly.`, () => act(relocateHq(s, me.id, dest)))}>Move for {fmtMoney(moveCost)}</button>
          </div>
          <p className="hint">Moving changes which state taxes your profits and gives you a honeymoon in the new city. Staff who don't move are laid off and rehired there.</p>
        </Panel>
      </div>
      <Panel title="Amenities" right={`${me.hqSite.amenities.length} of ${form.slots} slots used`}>
        <Table
          rows={AMENITIES}
          rowKey={(a) => a.id}
          cols={[
            { key: "n", label: "Amenity", render: (a) => <strong style={{ fontWeight: me.hqSite.amenities.includes(a.id) ? 600 : 400 }}>{a.name}</strong> },
            { key: "b", label: "What it does", render: (a) => <span className="hint" style={{ whiteSpace: "normal" }}>{a.blurb}</span> },
            { key: "c", label: "Cost", num: true, render: (a) => fmtMoney(amenityCost(me, a.id)) },
            { key: "u", label: "Monthly", num: true, render: (a) => fmtMoney(a.upkeep * Math.max(1, lv)) },
            { key: "x", label: "", render: (a) => {
              const on = me.hqSite.amenities.includes(a.id);
              return <button className={`small ${on ? "active" : ""}`} onClick={() => act(toggleAmenity(s, me.id, a.id))}>{on ? "Close" : "Open"}</button>;
            } },
          ]}
        />
        <p className="hint">Amenity costs scale with the size of your headquarters. Closing one recovers nothing.</p>
      </Panel>
    </div>
  );
}
