import { useMemo, useState } from "react";
import { donate, foundPac, fundPac, pacSpend, setLobbying } from "../../sim/actions";
import { whip, seats } from "../../sim/congress";
import { FACTION_ORDER, factionDef } from "../../sim/data/factions";
import { LAWS, LAW_BY_ID, PARTIES, type LawId, type PartyId } from "../../sim/data/laws";
import { STATE_BY_CODE } from "../../sim/data/states";
import { lobbyPressure } from "../../sim/politics";
import type { Politician } from "../../sim/types";
import { dayLabel, fmtMoney, fmtPct } from "../../sim/util";
import { Bar, Panel, Table, useGame } from "../components";

/** Year a member's seat is next on the ballot. */
export function nextUp(nextElectionDay: number, m: Politician): number {
  let y = new Date(Date.UTC(2026, 0, 1) + nextElectionDay * 86400000).getUTCFullYear();
  if (m.chamber === "house") return y;
  for (let i = 0; i < 3; i++, y += 2) if ([2, 3, 1][Math.round((y - 2026) / 2) % 3] === m.cls) return y;
  return y;
}

const partyColor = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");

export function PartyPill({ party }: { party: PartyId }) {
  return <span className="pill" style={{ background: party === "commonwealth" ? "var(--dem)" : "var(--rep)" }}>{PARTIES[party].name}</span>;
}

export function FactionTag({ m }: { m: Politician }) {
  const f = factionDef(m.faction, m.party);
  return <span className="fac" style={{ background: f.color }} title={f.blurb}>{f.name}</span>;
}

export function seatLabel(m: Politician) {
  if (m.chamber === "senate") return `Senator, ${STATE_BY_CODE[m.state]?.name ?? m.state}`;
  return `${m.state}-${m.district === 0 ? "AL" : m.district}`;
}

/** Seats in a chamber as a strip of faction blocks, Democrats left, Republicans right. */
export function ChamberStrip({ members }: { members: Politician[] }) {
  const counts = FACTION_ORDER.map((f) => ({ f, n: members.filter((m) => m.party === f.party && m.faction === f.id).length }));
  const total = members.length;
  return (
    <div className="chamber" role="img" aria-label="Seats by faction">
      {counts.filter((c) => c.n > 0).map(({ f, n }) => {
        const def = factionDef(f.id, f.party);
        return <div key={f.party + f.id} style={{ width: `${(n / total) * 100}%`, background: def.color }} title={`${def.name} ${f.party === "D" ? "Democrats" : "Republicans"}: ${n}`} />;
      })}
    </div>
  );
}

export function PacButtons({ m }: { m: Politician }) {
  const { s, me, act } = useGame();
  if (!me.pac) return null;
  const unit = m.chamber === "senate" ? 5e6 : 1e6;
  return (
    <span className="row" style={{ flexWrap: "nowrap", gap: 3 }}>
      <button className="small" title={`Spend ${fmtMoney(unit)} backing ${m.name}`} onClick={() => act(pacSpend(s, me.id, m.id, unit, "support"))}>Back</button>
      <button className="small" title={`Spend ${fmtMoney(unit)} on ads against ${m.name}`} onClick={() => act(pacSpend(s, me.id, m.id, unit, "oppose"))}>Oppose</button>
    </span>
  );
}

export function Politics() {
  const { s, me, act, ask } = useGame();
  const p = s.politics;
  const daysToElection = p.nextElectionDay - s.day;
  const myLobby = me.lobbying.reduce((a, l) => a + l.monthly, 0);
  const presidentialNext = new Date(Date.UTC(2026, 0, 1) + p.nextElectionDay * 86400000).getUTCFullYear() % 4 === 0;
  const house = s.politicians.filter((m) => m.chamber === "house");
  const senate = s.politicians.filter((m) => m.chamber === "senate");
  const h = seats(s, "house"), se = seats(s, "senate");
  const w = p.bill ? whip(s, p.bill.law, p.bill.target, p.bill.sponsor) : null;

  return (
    <div>
      <div className="grid2">
        <div>
          <Panel title="Washington">
            <table className="t"><tbody>
              <tr><td>President</td><td><strong>{p.presidentName}</strong> <PartyPill party={p.president} /> <span className="muted">Vice President {p.vpName}</span></td></tr>
              <tr><td>Approval</td><td><span className="row" style={{ flexWrap: "nowrap" }}><Bar value={p.approval} tone={p.approval >= 0.5 ? "good" : p.approval >= 0.4 ? undefined : "bad"} />{fmtPct(p.approval, 0)}</span></td></tr>
              <tr><td>Senate</td><td><span className="member-d">{se.D} D</span>, <span className="member-r">{se.R} R</span>: <PartyPill party={p.senate} /> majority</td></tr>
              <tr><td>House</td><td><span className="member-d">{h.D} D</span>, <span className="member-r">{h.R} R</span>{s.vacancies.length ? `, ${s.vacancies.length} vacant` : ""}: <PartyPill party={p.congress} /> majority</td></tr>
              <tr><td>Generic ballot</td><td>
                <div className="split" title={`Democrats ${fmtPct(p.poll)}, Republicans ${fmtPct(1 - p.poll)}`}>
                  <div style={{ width: `${p.poll * 100}%`, background: "var(--dem)" }} />
                  <div style={{ width: `${(1 - p.poll) * 100}%`, background: "var(--rep)" }} />
                </div>
                <span className="hint">Democrats {fmtPct(p.poll, 1)}, Republicans {fmtPct(1 - p.poll, 1)}</span>
              </td></tr>
              <tr><td>Next election</td><td>{dayLabel(p.nextElectionDay)}, {presidentialNext ? "presidential" : "midterm"}, in {daysToElection} days</td></tr>
            </tbody></table>
            <div style={{ marginTop: 12 }}>
              <div className="hint">Senate by faction</div>
              <ChamberStrip members={senate} />
              <div className="hint" style={{ marginTop: 6 }}>House by faction</div>
              <ChamberStrip members={house} />
              <div className="row" style={{ marginTop: 6, gap: 10 }}>
                {FACTION_ORDER.map((f) => { const d = factionDef(f.id, f.party); return <span key={f.party + f.id} className="hint" title={d.blurb}><span className="swatch" style={{ background: d.color, borderRadius: 1 }} /> {d.name} {f.party}</span>; })}
              </div>
            </div>
          </Panel>

          <Panel title="On the floor">
            {p.bill && w ? (
              <>
                <div><strong>{LAW_BY_ID[p.bill.law].name}: {LAW_BY_ID[p.bill.law].levels[p.laws[p.bill.law]].name} to {LAW_BY_ID[p.bill.law].levels[p.bill.target].name}</strong></div>
                <p className="hint" style={{ margin: "3px 0 8px" }}>{LAW_BY_ID[p.bill.law].levels[p.bill.target].effect} Introduced by House {PARTIES[p.bill.sponsor].short} on {dayLabel(p.bill.startedDay)}; committee work is {fmtPct(p.bill.progress, 0)} done.</p>
                <div className="tally">
                  <span>House</span>
                  <div className="track"><div style={{ width: `${(w.house.yes / (w.house.yes + w.house.no)) * 100}%` }} /><i style={{ left: `${(w.house.need / (w.house.yes + w.house.no)) * 100}%` }} /></div>
                  <span>{w.house.yes} yes of {w.house.need} needed</span>
                  <span>Senate</span>
                  <div className="track"><div style={{ width: `${w.senate.yes}%` }} /><i style={{ left: `${w.senate.need}%` }} /></div>
                  <span>{w.senate.yes} yes of {w.senate.need} needed{w.senate.rule === "cloture" ? " (filibuster)" : " (reconciliation)"}</span>
                </div>
                <p className="hint">
                  {w.passes ? "On today's whip count it would pass." : w.vetoed && !w.override ? `It would clear Congress, but President ${p.presidentName} would veto it.` : "On today's whip count it would fail."}{" "}
                  Members vote their faction's position. Those only mildly opposed can be moved by industry lobbying, and members your PAC has backed lean your way.
                </p>
              </>
            ) : <div className="hint">Nothing on the floor. The House majority brings up bills from its platform, plus any bill with enough lobbying behind it to pass.</div>}
            {p.lastVote && (
              <p className="hint" style={{ marginTop: 8 }}>
                Last vote, {dayLabel(p.lastVote.day)}: {LAW_BY_ID[p.lastVote.law].name} to {LAW_BY_ID[p.lastVote.law].levels[p.lastVote.target].name}, House {p.lastVote.house.yes}–{p.lastVote.house.no}, Senate {p.lastVote.senate.yes}–{p.lastVote.senate.no}:{" "}
                <strong>{{ passed: "signed into law", "failed-house": "failed in the House", "failed-senate": "failed in the Senate", vetoed: "vetoed" }[p.lastVote.outcome]}</strong>.
              </p>
            )}
          </Panel>
        </div>

        <div>
          <PacPanel />
          <Panel title="Campaign donations" right={`Public image ${fmtPct(me.image, 0)}`}>
            <div className="row">
              {(["commonwealth", "frontier"] as PartyId[]).map((party) => [10e6, 100e6, 1e9].map((amt) => (
                <button key={party + amt} disabled={amt > me.cash} onClick={() => ask(`Give ${fmtMoney(amt)} to the ${PARTIES[party].name}? It nudges the national vote and dents your public image.`, () => act(donate(s, me.id, party, amt)))}>
                  <span className="swatch" style={{ background: partyColor(party === "commonwealth" ? "D" : "R") }} /> {fmtMoney(amt, 0)}
                </button>
              )))}
            </div>
            <p className="hint">Party donations shift the national vote by up to about 2.5 points, with sharply diminishing returns, and reset after every election. This cycle you've given Democrats {fmtMoney(me.donations.commonwealth ?? 0)} and Republicans {fmtMoney(me.donations.frontier ?? 0)}.</p>
          </Panel>
        </div>
      </div>

      <div style={{ height: 16 }} />
      <Panel title="Laws and lobbying" right={`You spend ${fmtMoney(myLobby)} a month`}>
        <Table
          rows={LAWS}
          rowKey={(l) => l.id}
          cols={[
            { key: "law", label: "Law", render: (l) => <span title={l.levels.map((x) => `${x.name}: ${x.effect}`).join("\n")}>{l.name}</span> },
            { key: "now", label: "Current", render: (l) => <strong title={l.levels[p.laws[l.id]].effect}>{l.levels[p.laws[l.id]].name}</strong> },
            { key: "d", label: "Democrats want", render: (l) => <span style={{ color: "var(--dem)" }}>{l.levels[l.platform.commonwealth].name}</span> },
            { key: "r", label: "Republicans want", render: (l) => <span style={{ color: "var(--rep)" }}>{l.levels[l.platform.frontier].name}</span> },
            { key: "pass", label: "Senate rule", render: (l) => (l.id === "corporate_tax" || l.id === "industrial_policy" ? "51 votes" : "60 votes") },
            { key: "lobby", label: "Industry lobbying, up and down", num: true, render: (l) => `${fmtMoney(lobbyPressure(s, l.id, 1), 0)} and ${fmtMoney(lobbyPressure(s, l.id, -1), 0)}` },
            { key: "mine", label: "Your lobbying", render: (l) => <LobbyControl law={l.id} /> },
          ]}
        />
        <p className="hint">Hover a law to see every level. Lobbying is a monthly expense. Its pull grows with the square root of spending, so $40M a month is only twice as persuasive as $10M. Tax and subsidy bills can pass the Senate with 51 votes through reconciliation; everything else needs 60.</p>
      </Panel>

      <div style={{ height: 16 }} />
      <MemberDirectory />
    </div>
  );
}

function PacPanel() {
  const { s, me, act } = useGame();
  const [name, setName] = useState(`Americans for ${me.name.split(" ")[0]}`);
  const [amount, setAmount] = useState(10);
  if (!me.pac) {
    return (
      <Panel title="Political action committee">
        <p className="hint" style={{ marginTop: 0 }}>A super PAC lets your company spend directly on congressional races: backing allies, running ads against opponents. Members you back lean toward your lobbying positions when a vote is close. Registering costs $2M.</p>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 260 }} aria-label="PAC name" />
          <button className="primary" onClick={() => act(foundPac(s, me.id, name))}>Register PAC</button>
        </div>
      </Panel>
    );
  }
  const backed = s.politicians.filter((m) => (m.friends[me.id] ?? 0) > 0).sort((a, b) => (b.friends[me.id] ?? 0) - (a.friends[me.id] ?? 0));
  return (
    <Panel title={me.pac.name} right={`Founded ${dayLabel(me.pac.foundedDay)}`}>
      <div className="stats">
        <div className="stat"><div className="label">Cash on hand</div><div className="value">{fmtMoney(me.pac.funds)}</div></div>
        <div className="stat"><div className="label">Raised</div><div className="value">{fmtMoney(me.pac.raised)}</div></div>
        <div className="stat"><div className="label">Spent</div><div className="value">{fmtMoney(me.pac.spent)}</div></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        Move <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 70 }} /> million from the company
        <button onClick={() => act(fundPac(s, me.id, amount * 1e6))}>Transfer</button>
      </div>
      <p className="hint">Back or oppose any member from the directory below or from a state's page on the map. Each click spends $1M on a House race or $5M on a Senate race. Spending moves their next election by up to 4 points.</p>
      {backed.length > 0 && (
        <div className="scroll" style={{ maxHeight: 200 }}>
          <Table rows={backed} rowKey={(m) => m.id} cols={[
            { key: "n", label: "Ally", render: (m) => <span className={m.party === "D" ? "member-d" : "member-r"}>{m.name}</span> },
            { key: "s", label: "Seat", render: (m) => seatLabel(m) },
            { key: "g", label: "Goodwill", num: true, render: (m) => fmtMoney(m.friends[me.id] ?? 0) },
          ]} />
        </div>
      )}
    </Panel>
  );
}

function MemberDirectory() {
  const { s, me } = useGame();
  const [chamber, setChamber] = useState<"all" | "senate" | "house">("senate");
  const [party, setParty] = useState<"all" | "D" | "R">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => s.politicians.filter((m) =>
    (chamber === "all" || m.chamber === chamber) && (party === "all" || m.party === party) &&
    (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.state === q.toUpperCase()),
  ), [s.politicians, chamber, party, q]);
  return (
    <Panel title="Members of Congress" right={
      <span className="row">
        <input placeholder="Name or state (TX)" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 170 }} aria-label="Search members" />
        <select value={chamber} onChange={(e) => setChamber(e.target.value as typeof chamber)}><option value="all">Both chambers</option><option value="senate">Senate</option><option value="house">House</option></select>
        <select value={party} onChange={(e) => setParty(e.target.value as typeof party)}><option value="all">Both parties</option><option value="D">Democrats</option><option value="R">Republicans</option></select>
      </span>
    }>
      <div className="scroll" style={{ maxHeight: 460 }}>
        <Table
          rows={rows}
          rowKey={(m) => m.id}
          initialSort="seat"
          desc={false}
          maxRows={450}
          cols={[
            { key: "n", label: "Member", render: (m) => <span className={m.party === "D" ? "member-d" : "member-r"} title={m.real ? undefined : "Elected during your game"}>{m.name} ({m.label}){m.real ? "" : " *"}</span>, sort: (m) => m.name },
            { key: "seat", label: "Seat", render: (m) => seatLabel(m), sort: (m) => `${m.state}${m.chamber}${String(m.district ?? 0).padStart(2, "0")}` },
            { key: "f", label: "Faction", render: (m) => <FactionTag m={m} />, sort: (m) => m.faction },
            { key: "lean", label: "Seat lean", num: true, title: "How the seat votes in a neutral year", render: (m) => { const d = m.lean - 0.5; return <span style={{ color: d > 0 ? "var(--dem)" : "var(--rep)" }}>{d > 0 ? "D" : "R"}+{Math.abs(d * 200).toFixed(0)}</span>; }, sort: (m) => m.lean },
            { key: "up", label: "Next up", render: (m) => nextUp(s.politics.nextElectionDay, m) },
            { key: "pac", label: "Your goodwill", num: true, render: (m) => (m.friends[me.id] ? fmtMoney(m.friends[me.id]) : ""), sort: (m) => m.friends[me.id] ?? 0 },
            { key: "act", label: "", render: (m) => <PacButtons m={m} /> },
          ]}
        />
      </div>
      <p className="hint">Members marked * won their seat during your game. Factions are the game's shorthand, assigned from caucus membership and public positioning. Politicians appear as satire.</p>
    </Panel>
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
        onClick={() => act(setLobbying(s, me.id, law, -1, cur?.dir === -1 ? 0 : amt * 1e6))}>Lower</button>
      <button className={`small ${cur?.dir === 1 ? "active" : ""}`} disabled={lvl >= levels - 1 && cur?.dir !== 1} title={lvl < levels - 1 ? `Push toward ${LAW_BY_ID[law].levels[lvl + 1].name}` : "Already at the highest level"}
        onClick={() => act(setLobbying(s, me.id, law, 1, cur?.dir === 1 ? 0 : amt * 1e6))}>Raise</button>
      <input type="number" min={1} value={amt} style={{ width: 56 }} aria-label="Millions per month" onChange={(e) => {
        const v = Math.max(1, Number(e.target.value) || 1);
        setAmt(v);
        if (cur) setLobbying(s, me.id, law, cur.dir, v * 1e6);
      }} />
      <span className="muted">M a month</span>
    </span>
  );
}
