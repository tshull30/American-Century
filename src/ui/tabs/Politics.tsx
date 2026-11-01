import { useState } from "react";
import { donate, setLobbying } from "../../sim/actions";
import { LAWS, LAW_BY_ID, PARTIES, type LawId, type PartyId } from "../../sim/data/laws";
import { lobbyPressure } from "../../sim/politics";
import { dayLabel, fmtMoney, fmtPct } from "../../sim/util";
import { Bar, Panel, Table, useGame } from "../components";

function PartyPill({ party }: { party: PartyId }) {
  return <span className="pill" style={{ background: PARTIES[party].color }}>{PARTIES[party].name}</span>;
}

export function Politics() {
  const { s, me, act, ask } = useGame();
  const p = s.politics;
  const daysToElection = p.nextElectionDay - s.day;
  const myLobby = me.lobbying.reduce((a, l) => a + l.monthly, 0);
  const presidentialNext = new Date(Date.UTC(2026, 0, 1) + p.nextElectionDay * 86400000).getUTCFullYear() % 4 === 0;

  return (
    <div>
    <div className="grid2">
      <div>
        <Panel title="Government">
          <table className="t"><tbody>
            <tr><td>President</td><td><PartyPill party={p.president} /></td></tr>
            <tr><td>Congress</td><td><PartyPill party={p.congress} /> {p.president === p.congress ? <span className="muted">unified government</span> : <span className="warn">divided government: bills pass slowly</span>}</td></tr>
            <tr><td>Presidential approval</td><td><span className="row" style={{ flexWrap: "nowrap" }}><Bar value={p.approval} tone={p.approval >= 0.5 ? "good" : p.approval >= 0.4 ? undefined : "bad"} />{fmtPct(p.approval, 0)}</span></td></tr>
            <tr><td>Generic ballot</td><td>
              <div className="split" title={`${PARTIES.commonwealth.name} ${fmtPct(p.poll)} · ${PARTIES.frontier.name} ${fmtPct(1 - p.poll)}`}>
                <div style={{ width: `${p.poll * 100}%`, background: PARTIES.commonwealth.color }} />
                <div style={{ width: `${(1 - p.poll) * 100}%`, background: PARTIES.frontier.color }} />
              </div>
              <span className="hint">Commonwealth {fmtPct(p.poll, 1)} · Frontier {fmtPct(1 - p.poll, 1)}</span>
            </td></tr>
            <tr><td>Next election</td><td>{dayLabel(p.nextElectionDay)} ({presidentialNext ? "presidential" : "midterm"}), in {daysToElection} days</td></tr>
            {p.lastResult && <tr><td>Last result</td><td>{dayLabel(p.lastResult.day)}: Commonwealth {fmtPct(p.lastResult.commonwealth, 1)}</td></tr>}
          </tbody></table>
          <p className="hint">Voters lean by occupation and swing with the economy: when living standards fall or a recession hits, the president's party pays for it. Struggling pops punish incumbents.</p>
        </Panel>

        <Panel title="Bill in Congress">
          {p.bill ? (
            <>
              <div className="row"><strong>{LAW_BY_ID[p.bill.law].name}: {LAW_BY_ID[p.bill.law].levels[p.laws[p.bill.law]].name} → {LAW_BY_ID[p.bill.law].levels[p.bill.target].name}</strong></div>
              <p className="hint" style={{ margin: "4px 0" }}>{LAW_BY_ID[p.bill.law].levels[p.bill.target].effect}</p>
              <div className="row">Sponsor <PartyPill party={p.bill.sponsor} /> · introduced {dayLabel(p.bill.startedDay)}</div>
              <div className="row"><span style={{ width: 70 }}>Progress</span><Bar value={p.bill.progress} tone={undefined} /> {fmtPct(p.bill.progress, 0)}</div>
              <div className="row"><span style={{ width: 70 }}>Lobbying</span><span className={p.bill.support > 0 ? "pos" : p.bill.support < 0 ? "neg" : "muted"}>{p.bill.support > 0.05 ? "industry supports it" : p.bill.support < -0.05 ? "industry opposes it" : "no strong lobby"} ({p.bill.support.toFixed(2)})</span></div>
              <p className="hint">Bills advance faster under unified government and with lobbying support. Opposition lobbying slows them down and can kill them in committee.</p>
            </>
          ) : <div className="hint">No bill on the floor. The president's party introduces bills from its platform. Heavy lobbying makes your issue more likely to be picked, even one that's off-platform.</div>}
        </Panel>

        <Panel title="Campaign donations" right={`Your image: ${fmtPct(me.image, 0)}`}>
          <div className="row">
            {(["commonwealth", "frontier"] as PartyId[]).map((party) => [10e6, 100e6, 1e9].map((amt) => (
              <button key={party + amt} disabled={amt > me.cash} onClick={() => ask(`Donate ${fmtMoney(amt)} to the ${PARTIES[party].name}? It nudges the next election and dents your public image.`, () => act(donate(s, me.id, party, amt)))}>
                <span className="swatch" style={{ background: PARTIES[party].color }} /> {fmtMoney(amt, 0)}
              </button>
            )))}
          </div>
          <p className="hint">Donations shift the next election by up to about 2.5 points (with sharply diminishing returns) and reset after every election. Big partisan donations cost public goodwill, and public image affects how households see your brand.</p>
          <div className="hint">This cycle: Commonwealth {fmtMoney(me.donations.commonwealth ?? 0)} · Frontier {fmtMoney(me.donations.frontier ?? 0)}</div>
        </Panel>
      </div>
      <div>
        <Panel title="What the laws do now">
          {LAWS.map((l) => <div key={l.id} className="hint" style={{ marginBottom: 4 }}><strong style={{ color: "var(--text-secondary)" }}>{l.name} ({l.levels[p.laws[l.id]].name}):</strong> {l.levels[p.laws[l.id]].effect}</div>)}
        </Panel>
      </div>
    </div>

      <div style={{ height: 14 }} />
      <Panel title="Laws & lobbying" right={`You spend ${fmtMoney(myLobby)} / month`}>
        <Table
          rows={LAWS}
          rowKey={(l) => l.id}
          cols={[
            { key: "law", label: "Law", render: (l) => <span title={l.levels.map((x, i) => `${i === p.laws[l.id] ? "▶ " : ""}${x.name}: ${x.effect}`).join("\n")}>{l.name}</span> },
            { key: "now", label: "Current", render: (l) => <strong title={l.levels[p.laws[l.id]].effect}>{l.levels[p.laws[l.id]].name}</strong> },
            { key: "cw", label: "Commonwealth", render: (l) => <span style={{ color: PARTIES.commonwealth.color }}>{l.levels[l.platform.commonwealth].name}</span> },
            { key: "fr", label: "Frontier", render: (l) => <span style={{ color: PARTIES.frontier.color }}>{l.levels[l.platform.frontier].name}</span> },
            { key: "lobby", label: "Industry lobbying (up / down)", num: true, render: (l) => `${fmtMoney(lobbyPressure(s, l.id, 1), 0)} / ${fmtMoney(lobbyPressure(s, l.id, -1), 0)}` },
            { key: "mine", label: "Your lobbying", render: (l) => <LobbyControl law={l.id} /> },
          ]}
        />
        <div className="hint" style={{ marginTop: 8 }}>
          Hover a law to see every level and its effect. Lobbying is a monthly cost booked as SG&A. Influence grows with the square root of spending, so $40M a month is only twice as persuasive as $10M.
        </div>
      </Panel>
    </div>
  );
}

function LobbyControl({ law }: { law: LawId }) {
  const { s, me, act } = useGame();
  const cur = me.lobbying.find((l) => l.law === law);
  const [amt, setAmt] = useState(cur ? cur.monthly / 1e6 : 10);
  const levels = LAW_BY_ID[law].levels.length;
  const lvl = s.politics.laws[law];
  return (
    <span className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
      <button className={`small ${cur?.dir === -1 ? "active" : ""}`} disabled={lvl <= 0 && cur?.dir !== -1} title={lvl > 0 ? `Push toward ${LAW_BY_ID[law].levels[lvl - 1].name}` : "Already at the lowest level"}
        onClick={() => act(setLobbying(s, me.id, law, -1, cur?.dir === -1 ? 0 : amt * 1e6))}>▼</button>
      <button className={`small ${cur?.dir === 1 ? "active" : ""}`} disabled={lvl >= levels - 1 && cur?.dir !== 1} title={lvl < levels - 1 ? `Push toward ${LAW_BY_ID[law].levels[lvl + 1].name}` : "Already at the highest level"}
        onClick={() => act(setLobbying(s, me.id, law, 1, cur?.dir === 1 ? 0 : amt * 1e6))}>▲</button>
      <input type="number" min={1} value={amt} style={{ width: 60 }} onChange={(e) => {
        const v = Math.max(1, Number(e.target.value) || 1);
        setAmt(v);
        if (cur) setLobbying(s, me.id, law, cur.dir, v * 1e6);
      }} />
      <span className="muted">M/mo</span>
    </span>
  );
}
