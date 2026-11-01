import { useMemo, useState } from "react";
import { pacRace } from "../../sim/actions";
import { factionDef } from "../../sim/data/factions";
import { STATE_BY_CODE } from "../../sim/data/states";
import { cycleYear, raceLabel, rating, winProb } from "../../sim/elections";
import type { Race } from "../../sim/types";
import { dayLabel, fmtMoney, fmtPct } from "../../sim/util";
import { Panel, Table, useGame } from "../components";

function Nominee({ r, side }: { r: Race; side: "D" | "R" }) {
  const n = r.nominees[side];
  if (!n) return <span className="muted">{r.primaryDone ? "No candidate" : "Primary pending"}</span>;
  const f = factionDef(n.faction, side);
  return (
    <span className={side === "D" ? "member-d" : "member-r"} title={`${f.name}. ${f.blurb}`}>
      {n.name}{n.incumbent ? " (inc.)" : ""} <span className="fac" style={{ background: f.color }}>{f.name}</span>
    </span>
  );
}

function RatingTag({ proj }: { proj: number }) {
  const r = rating(proj);
  const color = r.party === "D" ? "var(--dem)" : r.party === "R" ? "var(--rep)" : "var(--ink-2)";
  return <span style={{ color, fontWeight: r.label.startsWith("Safe") ? 400 : 600 }}>{r.label}</span>;
}

export function Elections() {
  const { s, me, act } = useGame();
  const year = cycleYear(s);
  const [chamber, setChamber] = useState<"house" | "senate">("senate");
  const [filter, setFilter] = useState<"competitive" | "all" | "mine">("competitive");
  const p = s.politics;

  const proj = useMemo(() => {
    const out = { house: { D: 0, safeD: 0, safeR: 0 }, senate: { D: 0, holdD: 0, holdR: 0 } };
    for (const r of s.races) {
      const pr = winProb(r.proj);
      if (r.chamber === "house") { out.house.D += pr; if (r.proj > 0.57) out.house.safeD++; if (r.proj < 0.43) out.house.safeR++; }
      else out.senate.D += pr;
    }
    const upIds = new Set(s.races.filter((r) => r.chamber === "senate").map((r) => r.incumbentId));
    for (const m of s.politicians) if (m.chamber === "senate" && !upIds.has(m.id)) m.party === "D" ? out.senate.holdD++ : out.senate.holdR++;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.day, s.races]);

  const rows = s.races.filter((r) => r.chamber === chamber).filter((r) =>
    filter === "all" ? true : filter === "mine" ? !!r.pac[me.id] : Math.abs(r.proj - 0.5) < 0.07 || (r.open && Math.abs(r.proj - 0.5) < 0.12),
  );
  const upcoming = s.races.filter((r) => !r.primaryDone).sort((a, b) => a.primaryDay - b.primaryDay);
  const nextPrimary = upcoming[0];
  const unit = chamber === "senate" ? 5e6 : 1e6;

  return (
    <div>
      <div className="grid2">
        <Panel title={`The ${year} elections`} right={`Election day ${dayLabel(p.nextElectionDay)}`}>
          <table className="t"><tbody>
            <tr><td>Generic ballot</td><td>Democrats {fmtPct(p.poll, 1)}, Republicans {fmtPct(1 - p.poll, 1)}</td></tr>
            <tr><td>House forecast</td><td><span className="member-d">{Math.round(proj.house.D)} D</span>, <span className="member-r">{435 - Math.round(proj.house.D)} R</span> expected (218 for a majority)</td></tr>
            <tr><td>Senate forecast</td><td><span className="member-d">{Math.round(proj.senate.D + proj.senate.holdD)} D</span>, <span className="member-r">{100 - Math.round(proj.senate.D + proj.senate.holdD)} R</span> expected ({proj.senate.holdD} D and {proj.senate.holdR} R seats not up)</td></tr>
            <tr><td>Next primary</td><td>{nextPrimary ? `${STATE_BY_CODE[nextPrimary.state]?.name}, ${dayLabel(nextPrimary.primaryDay)}` : "Primaries are over; general election season"}</td></tr>
            {p.lastResult && <tr><td>Last result</td><td>{dayLabel(p.lastResult.day)}: House {p.lastResult.houseD}–{p.lastResult.houseR}, Senate {p.lastResult.senateD}–{p.lastResult.senateR}{p.lastResult.ecD ? `, Electoral College ${p.lastResult.ecD}–${p.lastResult.ecR}` : ""}</td></tr>}
          </tbody></table>
          <p className="hint">Every House seat uses its district's real 2024 presidential result as its lean (2024 lines; the 2025–26 redistricting isn't modeled). Incumbents carry their personal vote: how far they ran ahead of or behind the top of the ticket in 2024. Senate seats use the state's 2024 result. Ratings move with the national mood and PAC money.</p>
        </Panel>
        <Panel title="How races work">
          <p className="hint" style={{ marginTop: 0 }}>Primaries run on each state's calendar. Incumbents rarely lose them, but moderates and Blue Dogs in deep-red or deep-blue seats are vulnerable, and money spent against an incumbent in the other column makes an upset likelier. Open seats nominate a candidate whose faction fits the district.</p>
          <p className="hint">On election night each race lands near its projection, plus a shared national polling miss and race-level noise. Winners you backed remember it: they lean your way on close votes.</p>
          {me.pac ? <p className="hint">{me.pac.name} has {fmtMoney(me.pac.funds)} on hand. Each click below spends {fmtMoney(unit)} in a {chamber === "senate" ? "Senate" : "House"} race.</p> : <p className="hint">Register a PAC on the Politics tab to spend in these races.</p>}
        </Panel>
      </div>
      <div style={{ height: 16 }} />
      <Panel title="Races" right={
        <span className="row">
          <select value={chamber} onChange={(e) => setChamber(e.target.value as typeof chamber)}><option value="senate">Senate</option><option value="house">House</option></select>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="competitive">Competitive</option><option value="all">All</option><option value="mine">Where your PAC spent</option></select>
        </span>
      }>
        <div className="scroll" style={{ maxHeight: 560 }}>
          <Table
            rows={rows}
            rowKey={(r) => r.id}
            initialSort="m"
            desc={false}
            maxRows={450}
            cols={[
              { key: "id", label: "Race", render: (r) => <span>{raceLabel(r)}{r.open ? <span className="muted"> open</span> : ""}</span>, sort: (r) => r.id },
              { key: "lean", label: "Lean", num: true, render: (r) => { const d = r.lean - 0.5; return <span style={{ color: d > 0 ? "var(--dem)" : "var(--rep)" }}>{d > 0 ? "D" : "R"}+{Math.abs(d * 200).toFixed(0)}</span>; }, sort: (r) => r.lean },
              { key: "d", label: "Democrat", render: (r) => <Nominee r={r} side="D" /> },
              { key: "r", label: "Republican", render: (r) => <Nominee r={r} side="R" /> },
              { key: "m", label: "Rating", render: (r) => r.result ? <span>{r.result.winner} won, {fmtPct(r.result.dShare, 1)} D</span> : <RatingTag proj={r.proj} />, sort: (r) => Math.abs(r.proj - 0.5) },
              { key: "pr", label: "Primary", render: (r) => (r.primaryDone ? "Done" : dayLabel(r.primaryDay)), sort: (r) => r.primaryDay },
              { key: "pac", label: "Your PAC", num: true, render: (r) => { const v = r.pac[me.id]; return v ? `${v.D ? `D ${fmtMoney(v.D)}` : ""}${v.D && v.R ? ", " : ""}${v.R ? `R ${fmtMoney(v.R)}` : ""}` : ""; } },
              { key: "a", label: "", render: (r) => me.pac ? (
                <span className="row" style={{ flexWrap: "nowrap", gap: 3 }}>
                  <button className="small" style={{ color: "var(--dem)" }} onClick={() => act(pacRace(s, me.id, r.id, "D", unit))}>Back D</button>
                  <button className="small" style={{ color: "var(--rep)" }} onClick={() => act(pacRace(s, me.id, r.id, "R", unit))}>Back R</button>
                </span>
              ) : null },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}
