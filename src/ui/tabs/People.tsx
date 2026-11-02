import { useMemo, useState } from "react";
import { pacSpend } from "../../sim/actions";
import { factionDef } from "../../sim/data/factions";
import { STATE_BY_CODE } from "../../sim/data/states";
import { ROLE_NAME, ROLE_SHORT, TRAITS, type Exec } from "../../sim/leadership";
import {
  AXES, ensurePersona, execThought, factionBlurb, giveRaise, golfWith, inviteToOpening, marketPay, meetPolitician, moraleDrivers, playerRecord,
  politicianBeliefs, proposePartnership, proposeTruce, publicJab, quoteOnYou, reasonText, relationWith, relevantPoliticians, type Beliefs, type Regard,
} from "../../sim/people";
import type { Company, Politician } from "../../sim/types";
import { espionage } from "../../sim/fun";
import { dateLabel, fmtMoney } from "../../sim/util";
import { Panel, useGame, useSticky } from "../components";

type Sel = { kind: "exec"; id: number } | { kind: "rival"; id: number } | { kind: "pol"; id: string };

const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("");

export function Seal({ name, tone }: { name: string; tone?: string }) {
  return <span className="seal" style={tone ? { borderColor: tone, color: tone } : undefined} aria-hidden>{initials(name)}</span>;
}

export function RegardChip({ r }: { r?: Regard }) {
  const v = Math.round(r?.score ?? 0);
  const word = v > 50 ? "Ally" : v > 15 ? "Warm" : v >= -15 ? "Neutral" : v >= -50 ? "Cool" : "Hostile";
  return <span className={`regard-chip ${v > 15 ? "pos" : v < -15 ? "neg" : ""}`} title={`Opinion of you: ${v > 0 ? "+" : ""}${v}`}>{word}</span>;
}

function Scale({ value, lo, hi, label }: { value: number; lo: string; hi: string; label: string }) {
  return (
    <div className="scale">
      <div className="scale-label">{label}</div>
      <div className="scale-ends"><span>{lo}</span><span>{hi}</span></div>
      <div className="scale-rule"><span className="scale-mark" style={{ left: `${((value + 1) / 2) * 100}%` }} /></div>
    </div>
  );
}

export function BeliefScales({ b }: { b: Beliefs }) {
  return <div className="scales">{AXES.map((a) => <Scale key={a.id} label={a.name} lo={a.lo} hi={a.hi} value={b[a.id]} />)}</div>;
}

export function Ledger({ rows, total, totalLabel }: { rows: { label: string; v: number }[]; total?: number; totalLabel?: string }) {
  return (
    <table className="ledger">
      <tbody>
        {rows.length === 0 && <tr><td className="muted">Nothing yet. They haven't made up their mind about you.</td><td /></tr>}
        {rows.map((x) => <tr key={x.label}><td className="lead"><span>{x.label}</span><i /></td><td className={`num ${x.v > 0 ? "pos" : x.v < 0 ? "neg" : ""}`}>{x.v > 0 ? "+" : x.v < 0 ? "−" : ""}{Math.abs(Math.round(x.v))}</td></tr>)}
        {total !== undefined && <tr className="ledger-total"><td className="lead"><span>{totalLabel}</span></td><td className={`num ${total > 0 ? "pos" : total < 0 ? "neg" : ""}`}>{total > 0 ? "+" : total < 0 ? "−" : ""}{Math.abs(Math.round(total))}</td></tr>}
      </tbody>
    </table>
  );
}

export function OpinionMeter({ score }: { score: number }) {
  return (
    <div className="opinion">
      <div className="scale-ends"><span>Hostile</span><span>Neutral</span><span>Ally</span></div>
      <div className="scale-rule opinion-rule"><span className="scale-mark" style={{ left: `${((score + 100) / 200) * 100}%` }} /></div>
    </div>
  );
}

const polTitle = (p: Politician) => `${p.chamber === "senate" ? "Senator" : "Representative"}, ${STATE_BY_CODE[p.state]?.name ?? p.state}${p.district ? `'s ${ordinal(p.district)} district` : ""}`;
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
const partyTone = (p: Politician) => (p.party === "D" ? "#2b4c7e" : "#a8322a");

export function People() {
  const { s, me, act } = useGame();
  const [sel, setSel] = useState<Sel | null>(null);
  const [q, setQ] = useSticky("people.q", "");
  const [mood, setMood] = useSticky<"all" | "friends" | "foes">("people.mood", "all");
  const team = me.leadership?.execs ?? [];
  for (const e of team) ensurePersona(s, me, e);
  const rivals = useMemo(() => s.companies.filter((c) => c.alive && !c.isPlayer && c.leadership?.execs.some((e) => e.role === "ceo"))
    .map((c) => ({ c, ceo: c.leadership!.execs.find((e) => e.role === "ceo")! }))
    .sort((a, b) => Math.abs(b.ceo.regard?.score ?? 0) * 2 + b.c.marketCap / 1e11 - (Math.abs(a.ceo.regard?.score ?? 0) * 2 + a.c.marketCap / 1e11))
    .slice(0, 14),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [s.month, s.companies.length]);
  const pols = useMemo(() => {
    let list = q ? s.politicians.filter((p) => (p.name + " " + p.state + " " + (STATE_BY_CODE[p.state]?.name ?? "")).toLowerCase().includes(q.toLowerCase())) : relevantPoliticians(s, me);
    if (mood === "friends") list = list.filter((p) => (p.regard?.score ?? 0) > 15);
    if (mood === "foes") list = list.filter((p) => (p.regard?.score ?? 0) < -15);
    return list.slice(0, 40);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.month, q, mood]);
  const current = sel ?? (team[0] ? { kind: "exec" as const, id: team[0].id } : null);
  const isSel = (k: Sel["kind"], id: number | string) => current?.kind === k && current.id === id;
  const rec = playerRecord(s);

  return (
    <div className="people">
      <div className="roster">
        <Panel title="Your team" help="people">
          {team.length === 0 && <p className="empty">No executives. Hire some on the Leadership tab.</p>}
          {team.map((e) => (
            <button key={e.id} className={`person ${isSel("exec", e.id) ? "on" : ""}`} onClick={() => setSel({ kind: "exec", id: e.id })}>
              <Seal name={e.name} />
              <span className="who"><strong>{e.name}</strong><span className="muted">{ROLE_NAME[e.role]}</span></span>
              <span className={`regard-chip ${(e.morale ?? 65) >= 70 ? "pos" : (e.morale ?? 65) < 40 ? "neg" : ""}`}>{(e.morale ?? 65) >= 70 ? "Happy" : (e.morale ?? 65) < 40 ? "Unhappy" : "Content"}</span>
            </button>
          ))}
        </Panel>
        <Panel title="Rival chiefs">
          {rivals.map(({ c, ceo }) => (
            <button key={c.id} className={`person ${isSel("rival", c.id) ? "on" : ""}`} onClick={() => setSel({ kind: "rival", id: c.id })}>
              <Seal name={ceo.name} tone={c.color} />
              <span className="who"><strong>{ceo.name}</strong><span className="muted">CEO, {c.name}</span></span>
              <RegardChip r={ceo.regard} />
            </button>
          ))}
        </Panel>
        <Panel title="Capitol Hill" right={`${3 - (rec.meetingsMonth === s.month ? rec.meetingsUsed : 0)} meetings left this month`}>
          <div className="row" style={{ marginBottom: 6 }}>
            <input placeholder="Find a member or state" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
            <div className="segmented small">
              {(["all", "friends", "foes"] as const).map((m) => <button key={m} className={mood === m ? "on" : ""} onClick={() => setMood(m)}>{m === "all" ? "All" : m === "friends" ? "Friends" : "Foes"}</button>)}
            </div>
          </div>
          {pols.length === 0 && <p className="empty">No one matches. Members from states where you operate show up here.</p>}
          {pols.map((p) => (
            <button key={p.id} className={`person ${isSel("pol", p.id) ? "on" : ""}`} onClick={() => setSel({ kind: "pol", id: p.id })}>
              <Seal name={p.name} tone={partyTone(p)} />
              <span className="who"><strong>{p.chamber === "senate" ? "Sen." : "Rep."} {p.name} <span className="muted" style={{ fontWeight: 400 }}>({p.label}-{p.state})</span></strong><span className="muted">{factionDef(p.faction, p.party).name}</span></span>
              <RegardChip r={p.regard} />
            </button>
          ))}
        </Panel>
      </div>
      <div className="dossier-col">
        {current?.kind === "exec" && (() => { const e = team.find((x) => x.id === current.id); return e ? <ExecDossier e={e} c={me} own act={act} /> : null; })()}
        {current?.kind === "rival" && (() => { const c = s.companies.find((x) => x.id === current.id); const e = c?.leadership?.execs.find((x) => x.role === "ceo"); return c && e ? <ExecDossier e={e} c={c} act={act} /> : null; })()}
        {current?.kind === "pol" && (() => { const p = s.politicians.find((x) => x.id === current.id); return p ? <PolDossier p={p} act={act} /> : null; })()}
      </div>
    </div>
  );
}

function ExecDossier({ e, c, own, act }: { e: Exec; c: Company; own?: boolean; act: (r: { ok: boolean; message: string }) => void }) {
  const { s, me } = useGame();
  ensurePersona(s, c, e);
  const rel = own ? undefined : relationWith(s, c.id);
  const ret = (() => { const h = me.history; return h.length >= 13 && h[h.length - 13].marketCap > 0 ? me.marketCap / h[h.length - 13].marketCap - 1 : 0; })();
  const drivers = own ? moraleDrivers(s, me, e, ret).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)) : [];
  const why = Object.entries(e.regard?.why ?? {}).map(([k, v]) => ({ label: reasonText(s, k), v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  return (
    <div className="dossier">
      <header>
        <Seal name={e.name} tone={own ? undefined : c.color} />
        <div>
          <h2>{e.name}</h2>
          <div className="muted">{own ? ROLE_NAME[e.role] : `Chief Executive, ${c.name}`}, age {e.age}</div>
        </div>
      </header>
      <p className="bio">
        From {e.bio?.hometown}. Studied at {e.bio?.school}, {e.bio?.career}{e.from ? `, and came over from ${e.from}` : ""}. {own ? `With you since ${dateLabel(e.hiredMonth)}.` : ""}
      </p>
      <blockquote className="motto">"{e.bio?.motto}"</blockquote>
      <div className="traits-row">{e.traits.map((t) => <span key={t} className={`trait ${TRAITS[t].bad ? "bad" : ""}`} title={TRAITS[t].effect}>{TRAITS[t].name}</span>)}<span className="muted"> Skill {e.skill} of 5</span></div>
      <h3>Where they stand</h3>
      {e.beliefs && <BeliefScales b={e.beliefs} />}
      {own ? (
        <>
          <h3>Morale</h3>
          <OpinionMeter score={((e.morale ?? 65) - 50) * 2} />
          <p className="thought">{execThought(s, me, e)}</p>
          <Ledger rows={drivers.map((d) => ({ label: d.text, v: d.v }))} />
          <div className="row" style={{ marginTop: 10 }}>
            <span className="muted">Pays {fmtMoney(e.pay)} a year; the market rate is about {fmtMoney(marketPay(me, e.role, e.skill))}.</span>
            <button onClick={() => act(giveRaise(s, e.id))}>Give a 10% raise</button>
          </div>
        </>
      ) : (
        <>
          <h3>What they think of you</h3>
          <OpinionMeter score={e.regard?.score ?? 0} />
          <p className="thought">{quoteOnYou(s, me, c, e)}</p>
          <Ledger rows={why} total={e.regard?.score ?? 0} totalLabel="Overall" />
          <div className="relation">
            {rel?.partnerUntil && rel.partnerUntil > s.month ? <span className="deal-stamp ok">Partners until {dateLabel(rel.partnerUntil)}</span> : null}
            {rel?.truceUntil && rel.truceUntil > s.month ? <span className="deal-stamp ok">Truce until {dateLabel(rel.truceUntil)}</span> : null}
            {(e.regard?.score ?? 0) < -40 && !(rel?.truceUntil && rel.truceUntil > s.month) ? <span className="deal-stamp">Feud: undercutting your prices</span> : null}
          </div>
          <div className="row actions">
            <button onClick={() => act(golfWith(s, c.id))} title="Warms relations a little. Every six months at most.">Play golf</button>
            <button onClick={() => act(proposeTruce(s, c.id))} title="Ends a price war for a year, if they agree.">Propose a truce</button>
            <button onClick={() => act(proposePartnership(s, c.id))} title="Two years of +5% research and marketing for both. Needs a warm relationship.">Propose a partnership</button>
            <button className="danger" onClick={() => act(publicJab(s, c.id))} title="A showman CEO gets a stock bump. They will hold a grudge.">Take a public jab</button>
            <button className="danger" onClick={() => act(espionage(s, me, c.id))} title="Steal research where they lead you. Works about half the time; getting caught is a scandal.">Steal their secrets</button>
          </div>
          <p className="muted small">A friendly CEO's board accepts a lower takeover premium; a hostile one demands more.</p>
        </>
      )}
    </div>
  );
}

function PolDossier({ p, act }: { p: Politician; act: (r: { ok: boolean; message: string }) => void }) {
  const { s, me } = useGame();
  const b = politicianBeliefs(p);
  const f = factionDef(p.faction, p.party);
  const why = Object.entries(p.regard?.why ?? {}).map(([k, v]) => ({ label: reasonText(s, k, p), v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const hasSite = me.buildings.some((x) => x.type !== "hq" && x.level > 0 && s.cities[x.city]?.state === p.state);
  return (
    <div className="dossier">
      <header>
        <Seal name={p.name} tone={partyTone(p)} />
        <div>
          <h2>{p.name} <span className="muted" style={{ fontWeight: 400 }}>({p.label}-{p.state})</span></h2>
          <div className="muted">{polTitle(p)}, in office since {p.sinceYear}{p.retiring ? "; retiring" : ""}</div>
        </div>
      </header>
      <p className="bio">Caucuses with the <strong style={{ color: f.color }}>{f.name}</strong> wing. {factionBlurb(p)}</p>
      <p className="muted small">{p.real ? "A real member of Congress. Stances here are the game's model of their caucus faction, not statements by them." : "Elected during your game."}</p>
      <h3>Where they stand</h3>
      <BeliefScales b={b} />
      <h3>What they think of you</h3>
      <OpinionMeter score={p.regard?.score ?? 0} />
      <Ledger rows={why} total={p.regard?.score ?? 0} totalLabel="Overall" />
      <p className="muted small">Members who like you lean your way on close votes you lobby for; members who don't lean against you, and may call you to testify.</p>
      <div className="row actions">
        <button onClick={() => act(meetPolitician(s, p.id))} title="Your CEO meets them. Three meetings a month; once every six months per member.">Request a meeting</button>
        <button disabled={!hasSite} onClick={() => act(inviteToOpening(s, p.id))} title={hasSite ? "Invite them to cut a ribbon at one of your sites in their state." : "You have no site in their state."}>Invite to a plant opening</button>
        {me.pac && <button onClick={() => act(pacSpend(s, me.id, p.id, Math.min(me.pac!.funds, p.chamber === "senate" ? 2e6 : 0.5e6), "support"))}>Back them with your PAC ({fmtMoney(p.chamber === "senate" ? 2e6 : 0.5e6)})</button>}
      </div>
    </div>
  );
}

export { ROLE_SHORT };
