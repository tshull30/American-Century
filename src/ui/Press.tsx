// The paper trail: front pages, the stock ticker, annual reports and merger certificates.
import { useMemo } from "react";
import { player } from "../sim/engine";
import { resolveDecision } from "../sim/stories";
import { tierOf } from "../sim/tiers";
import type { Company, GameEvent, GameState } from "../sim/types";
import { dateLabel, dayLabel, fmtMoney, fmtNum, fmtPct } from "../sim/util";

const PAPER = "The American Ledger";

/** A front page for the stories that paused the game, with any decisions waiting on you. */
export function FrontPage({ s, events, onClose, onDecide }: { s: GameState; events: GameEvent[]; onClose: () => void; onDecide: (msg: string) => void }) {
  const me = player(s);
  const decisions = (s.decisions ?? []).filter((d) => d.companyId === me.id);
  const cert = events.find((e) => e.cert)?.cert;
  const stories = events.filter((e) => e.headline && !e.cert);
  const lead = stories[0];
  const rest = stories.slice(1, 4);
  const others = events.filter((e) => !e.headline && !e.cert).slice(0, 3);
  if (cert) return <Certificate s={s} cert={cert} onClose={onClose} />;
  return (
    <div className="modal-back">
      <div className="frontpage" role="dialog" aria-label="Front page">
        <header>
          <div className="fp-meta"><span>{dayLabel(s.day)}</span><span>Late edition</span></div>
          <div className="fp-title">{PAPER}</div>
          <div className="fp-rule" />
        </header>
        {lead ? (
          <article className="fp-lead">
            <h1>{lead.headline}</h1>
            {lead.deck && <p className="fp-deck">{lead.deck}</p>}
            {!(lead.deck && lead.text.includes(lead.deck.replace(/\.$/, ""))) && <p className="fp-body">{lead.text}</p>}
          </article>
        ) : decisions.length ? null : (
          <article className="fp-lead"><h1>{others[0]?.text ?? "A quiet day"}</h1></article>
        )}
        {decisions.length > 0 && (
          <section className="fp-decisions">
            {decisions.slice(0, 2).map((d) => (
              <div key={d.id} className="fp-decision">
                <div className="fp-kicker">Your call, {Math.max(0, d.deadlineDay - s.day)} days to decide</div>
                <h2>{d.headline}</h2>
                <p>{d.deck}</p>
                <div className="fp-options">
                  {d.options.map((o) => (
                    <button key={o.id} onClick={() => onDecide(resolveDecision(s, d.id, o.id, () => () => undefined))}>
                      <strong>{o.label}</strong><span>{o.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
        {(rest.length > 0 || others.length > 0) && (
          <section className="fp-columns">
            {rest.map((e, i) => <article key={i}><h3>{e.headline}</h3>{e.deck && <p>{e.deck}</p>}</article>)}
            {others.map((e, i) => <article key={`o${i}`}><p>{e.text}</p></article>)}
          </section>
        )}
        <footer>
          <button className="primary" onClick={onClose}>{decisions.length ? "Decide later" : "Back to work"}</button>
        </footer>
      </div>
    </div>
  );
}

/** The scrolling ticker under the masthead: price and change since last month's close. */
export function Ticker({ s }: { s: GameState }) {
  const rows = useMemo(() => {
    return s.companies.filter((c) => c.alive).sort((a, b) => b.marketCap - a.marketCap).slice(0, 36).map((c) => {
      const prev = c.history[c.history.length - 1]?.marketCap ?? c.marketCap;
      return { c, price: c.marketCap / c.shares, chg: prev > 0 ? c.marketCap / prev - 1 : 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(s.day / 3), s.companies.length]);
  const items = rows.map(({ c, price, chg }) => (
    <span key={c.id} className={`tk ${c.isPlayer ? "me" : ""}`}>
      <b>{c.ticker}</b> {price >= 1000 ? fmtNum(price) : price.toFixed(2)} <span className={chg >= 0 ? "pos" : "neg"}>{chg >= 0 ? "▲" : "▼"}{(Math.abs(chg) * 100).toFixed(1)}%</span>
    </span>
  ));
  return (
    <div className="ticker" aria-label="Stock ticker">
      <div className="ticker-track">{items}{items}</div>
    </div>
  );
}

/** January: last year's annual report, with a letter from the CEO. */
export function AnnualReport({ s, year, onClose }: { s: GameState; year: number; onClose: () => void }) {
  const me = player(s);
  const months = me.history.filter((h) => Math.floor(h.month / 12) + 2026 === year);
  const prevMonths = me.history.filter((h) => Math.floor(h.month / 12) + 2026 === year - 1);
  const sum = (hs: typeof months, k: "revenue" | "netIncome" | "dividends" | "capex") => hs.reduce((a, h) => a + (h[k] ?? 0), 0);
  const rev = sum(months, "revenue"), prevRev = sum(prevMonths, "revenue");
  const ni = sum(months, "netIncome");
  const growth = prevRev > 0 ? rev / prevRev - 1 : 0;
  const last = months[months.length - 1];
  const first = prevMonths[prevMonths.length - 1] ?? months[0];
  const tsr = first && last ? last.marketCap / first.marketCap - 1 : 0;
  const ceo = me.leadership?.execs.find((e) => e.role === "ceo");
  const highlights = s.events.filter((e) => e.companyId === me.id && (e.kind === "good" || e.kind === "deal") && Math.floor(dateOfEvent(e) / 12) + 2026 === year).slice(-4);
  const tone = growth > 0.1 && ni > 0 ? "a strong year" : growth > 0 && ni > 0 ? "a year of steady progress" : ni > 0 ? "a difficult year for growth" : "a hard year";
  return (
    <div className="modal-back">
      <div className="annual" role="dialog" aria-label="Annual report">
        <div className="ar-cover">
          <div className="ar-year">{year}</div>
          <div className="ar-name">{me.name}</div>
          <div className="ar-sub">Annual Report to Shareholders</div>
        </div>
        <div className="ar-body">
          <h3>Letter to shareholders</h3>
          <p>Dear fellow shareholders,</p>
          <p>{year} was {tone} for {me.name}. Revenue {growth >= 0 ? "grew" : "fell"} {fmtPct(Math.abs(growth), 0)} to {fmtMoney(rev)}, and we {ni >= 0 ? "earned" : "lost"} {fmtMoney(Math.abs(ni))}. {tsr >= 0 ? `Our shares returned ${fmtPct(tsr, 0)}` : `Our shares fell ${fmtPct(-tsr, 0)}`}, leaving us {tierOf(me.marketCap).name === "Titan" ? "among the Titans" : `in the ${tierOf(me.marketCap).name} tier`}.</p>
          {highlights.length > 0 && <p>Among the year's milestones: {highlights.map((h) => h.text.replace(/\.$/, "")).join("; ")}.</p>}
          <p>We enter {year + 1} with {fmtMoney(me.cash)} in cash and {fmtMoney(me.debt)} in debt. Thank you for your confidence.</p>
          <div className="ar-sign">
            <div className="signature">{ceo?.name ?? "The Board"}</div>
            <div className="muted">{ceo ? `${ceo.name}, Chief Executive Officer` : "On behalf of the Board of Directors"}</div>
          </div>
          <table className="t ar-figs"><tbody>
            <tr><td>Revenue</td><td className="num">{fmtMoney(rev)}</td><td className="num muted">{fmtMoney(prevRev)}</td></tr>
            <tr><td>Net income</td><td className="num">{fmtMoney(ni)}</td><td className="num muted">{fmtMoney(sum(prevMonths, "netIncome"))}</td></tr>
            <tr><td>Dividends paid</td><td className="num">{fmtMoney(sum(months, "dividends"))}</td><td></td></tr>
            <tr><td>Capital spending</td><td className="num">{fmtMoney(sum(months, "capex"))}</td><td></td></tr>
            <tr><td>Employees</td><td className="num">{fmtNum(last?.employees ?? 0)}</td><td></td></tr>
            <tr><td>Market value at year end</td><td className="num">{fmtMoney(last?.marketCap ?? me.marketCap)}</td><td></td></tr>
          </tbody></table>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button className="primary" autoFocus onClick={onClose}>Close the report</button></div>
        </div>
      </div>
    </div>
  );
}

function dateOfEvent(e: GameEvent): number {
  return Math.floor(e.day / 30.44);
}

/** A completed acquisition, with signatures and the state's stamp. */
export function Certificate({ s, cert, onClose }: { s: GameState; cert: NonNullable<GameEvent["cert"]>; onClose: () => void }) {
  return (
    <div className="modal-back">
      <div className="certificate" role="dialog" aria-label="Certificate of merger">
        <div className="cert-border">
          <div className="cert-state">State of Delaware</div>
          <div className="cert-title">Certificate of Merger</div>
          <p className="cert-text">
            Pursuant to Section 251 of the General Corporation Law, <strong>{cert.target}</strong> is hereby merged with and into <strong>{cert.buyer}</strong>,
            the surviving corporation, for total consideration of <strong>{fmtMoney(cert.price)}</strong>, effective {dayLabel(s.day)}.
          </p>
          <div className="cert-sigs">
            <div><div className="signature">{cert.buyerCeo ?? "—"}</div><div className="cert-line">{cert.buyerCeo ?? ""}, for {cert.buyer}</div></div>
            <div><div className="signature">{cert.targetCeo ?? "—"}</div><div className="cert-line">{cert.targetCeo ?? ""}, for {cert.target}</div></div>
          </div>
          <div className="stamp"><span>Filed</span><small>{dateLabel(s.month)}</small><small>Secretary of State</small></div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}><button className="primary" autoFocus onClick={onClose}>File it away</button></div>
      </div>
    </div>
  );
}

export type { Company };
