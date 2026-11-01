import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import type { Result } from "../sim/actions";
import type { Company, GameState } from "../sim/types";
import { player } from "../sim/engine";

export interface GameCtxValue {
  s: GameState;
  me: Company;
  refresh: () => void;
  /** Run an action, refresh the UI and show its message. */
  act: (r: Result) => void;
  /** In-page confirmation dialog (browser confirm() is blocked in sandboxed hosts). */
  ask: (message: string, onYes: () => void) => void;
}

export const GameCtx = createContext<GameCtxValue | null>(null);

export function useGame(): GameCtxValue {
  const v = useContext(GameCtx);
  if (!v) throw new Error("GameCtx missing");
  return v;
}

export function makeCtx(s: GameState, refresh: () => void, toast: (m: string, err?: boolean) => void, ask: GameCtxValue["ask"]): GameCtxValue {
  return {
    s, me: player(s), refresh, ask,
    act: (r) => { toast(r.message, !r.ok); refresh(); },
  };
}

export function Panel(p: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${p.className ?? ""}`}>
      <h2>{p.title}{p.right && <span className="right">{p.right}</span>}</h2>
      {p.children}
    </section>
  );
}

export function Stat(p: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{p.label}</div>
      <div className="value">{p.value}</div>
      {p.sub !== undefined && <div className="sub">{p.sub}</div>}
    </div>
  );
}

export function Bar(p: { value: number; tone?: "good" | "warn" | "bad"; title?: string }) {
  const tone = p.tone ?? (p.value >= 0.95 ? "good" : p.value >= 0.7 ? undefined : p.value >= 0.4 ? "warn" : "bad");
  return (
    <div className={`bar ${tone ?? ""}`} title={p.title}>
      <div style={{ width: `${Math.max(0, Math.min(1, p.value)) * 100}%` }} />
    </div>
  );
}

export function Signed(p: { value: number; fmt: (x: number) => string }) {
  return <span className={p.value > 0 ? "pos" : p.value < 0 ? "neg" : ""}>{p.fmt(p.value)}</span>;
}

export interface Column<T> {
  key: string;
  label: string;
  num?: boolean;
  render: (row: T) => React.ReactNode;
  sort?: (row: T) => number | string;
  title?: string;
}

/** A sortable table. Click a header to sort; click again to flip. */
export function Table<T>(p: { rows: T[]; cols: Column<T>[]; rowKey: (r: T) => string | number; rowClass?: (r: T) => string; initialSort?: string; desc?: boolean; maxRows?: number }) {
  const [sortKey, setSortKey] = useState<string | undefined>(p.initialSort);
  const [desc, setDesc] = useState(p.desc ?? true);
  const rows = useMemo(() => {
    const col = p.cols.find((c) => c.key === sortKey);
    if (!col?.sort) return p.rows;
    const f = col.sort;
    return p.rows.slice().sort((a, b) => {
      const x = f(a), y = f(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return desc ? -r : r;
    });
  }, [p.rows, p.cols, sortKey, desc]);
  const shown = p.maxRows ? rows.slice(0, p.maxRows) : rows;
  return (
    <table className="t">
      <thead>
        <tr>
          {p.cols.map((c) => (
            <th
              key={c.key}
              title={c.title}
              className={`${c.num ? "num" : ""} ${c.sort ? "sortable" : ""}`}
              onClick={() => { if (!c.sort) return; if (sortKey === c.key) setDesc(!desc); else { setSortKey(c.key); setDesc(true); } }}
            >
              {c.label}{sortKey === c.key ? (desc ? " ▾" : " ▴") : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={p.rowKey(r)} className={p.rowClass?.(r)}>
            {p.cols.map((c) => <td key={c.key} className={c.num ? "num" : ""}>{c.render(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Single-series line chart with a crosshair tooltip. */
export function LineChart(p: { data: { x: string; y: number }[]; fmt: (v: number) => string; height?: number; color?: string; zero?: boolean }) {
  const W = 600, H = p.height ?? 180, padL = 56, padR = 10, padT = 10, padB = 22;
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (p.data.length < 2) return <div className="hint">Not enough history yet.</div>;
  const ys = p.data.map((d) => d.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (p.zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08;
  hi += pad; if (!p.zero || lo < 0) lo -= pad;
  const x = (i: number) => padL + (i / (p.data.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const path = p.data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.y).toFixed(1)}`).join("");
  const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * t);
  const xTicks = p.data.map((d, i) => ({ d, i })).filter(({ d, i }) => d.x.startsWith("Jan") || i === 0);
  const color = p.color ?? "var(--series-1)";
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / (W - padL - padR)) * (p.data.length - 1));
    setHover(Math.max(0, Math.min(p.data.length - 1, i)));
  };
  return (
    <div className="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#2e2d2a" />
            <text x={padL - 6} y={y(t) + 4} fontSize="10" textAnchor="end" fill="var(--text-muted)">{p.fmt(t)}</text>
          </g>
        ))}
        {p.zero && lo < 0 && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--text-muted)" />}
        {xTicks.map(({ d, i }) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="var(--text-muted)">{d.x.slice(-4)}</text>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--text-muted)" strokeDasharray="2 3" />
            <circle cx={x(hover)} cy={y(p.data[hover].y)} r={4} fill={color} stroke="var(--surface-1)" strokeWidth={2} />
          </g>
        )}
        <rect x={padL} y={0} width={W - padL - padR} height={H} fill="transparent" />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(p.data[hover].y) / H) * 100}%` }}>
          <span className="muted">{p.data[hover].x}</span> {p.fmt(p.data[hover].y)}
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog(p: { message: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="modal-back" onClick={p.onNo}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p>{p.message}</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button onClick={p.onNo}>Cancel</button>
          <button className="primary" autoFocus onClick={p.onYes}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
