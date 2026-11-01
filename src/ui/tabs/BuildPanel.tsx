import { useMemo } from "react";
import { build, buildQuote, liquidity } from "../../sim/actions";
import { BUILDINGS, BUILDING_BY_ID, methodOf, SECTORS, type BuildingDef, type BuildingTypeId, type SectorId } from "../../sim/data/buildings";
import { COUNTRY_BY_ID } from "../../sim/data/countries";
import { GOOD_BY_ID, type GoodId } from "../../sim/data/goods";
import { JOB_BY_ID, type JobId } from "../../sim/data/jobs";
import { resourceMult, SUN, WIND } from "../../sim/data/resources";
import { STATES } from "../../sim/data/states";
import { cityLabel, dcPowerCost, opinionOf, permitBlock } from "../../sim/geo";
import { homeCostShare } from "../../sim/intl";
import { activeSectors, entryKnowhow, knowhowMult, scaleMult, sectorLevels, siteMultFor } from "../../sim/sectors";
import type { CityState } from "../../sim/types";
import { fmtMoney, fmtNum, fmtPct, laborKey } from "../../sim/util";
import { Panel, Table, useGame, useSticky } from "../components";

const outputOf = (b: BuildingDef, methodId?: string) => {
  const m = methodOf(b.id, methodId ?? b.methods[0].id);
  if (m.research) return `${m.research} research`;
  if (m.admin) return `${m.admin} admin capacity`;
  return Object.entries(m.output).map(([g, n]) => `${fmtNum(n ?? 0)} ${GOOD_BY_ID[g as GoodId].unit}`).join(", ");
};

function Tile({ b, on, onPick }: { b: BuildingDef; on: boolean; onPick: () => void }) {
  const goods = new Set(b.methods.flatMap((m) => Object.keys(m.output)));
  return (
    <button className={`btile ${on ? "on" : ""}`} onClick={onPick} title={b.description}>
      <span className="bt-name">{b.name}</span>
      <span className="bt-out">{goods.size ? [...goods].map((g) => GOOD_BY_ID[g as GoodId].name).join(", ") : b.id === "hq" ? "Admin capacity" : "Research"}</span>
      <span className="bt-cost">{fmtMoney(b.cost)} a level</span>
    </button>
  );
}

export function BuildPanel() {
  const { s, me, act, ask } = useGame();
  const mine = new Set(Object.keys(sectorLevels(me)) as SectorId[]);
  const [type, setType] = useSticky<BuildingTypeId>("build.type", BUILDINGS.find((b) => b.sector && mine.has(b.sector))?.id ?? "rnd");
  const def = BUILDING_BY_ID[type];
  const [method, setMethod] = useSticky("build.method", def.methods[0].id);
  const m = methodOf(type, method);
  const [where, setWhere] = useSticky<"us" | "abroad">("build.where", "us");
  const [city, setCity] = useSticky("build.city", me.hqSite.city);
  const [levels, setLevels] = useSticky("build.levels", 1);
  const [stateFilter, setStateFilter] = useSticky("build.state", "all");
  const [explore, setExplore] = useSticky("build.explore", false);

  const pickType = (t: BuildingTypeId) => {
    setType(t);
    setMethod(BUILDING_BY_ID[t].methods[0].id);
    if (t === "hq") { setCity(me.hqSite.city); setWhere("us"); }
  };

  const core = BUILDINGS.filter((b) => !b.sector || mine.has(b.sector));
  const bySector = new Map<SectorId, BuildingDef[]>();
  for (const b of BUILDINGS) if (b.sector && !mine.has(b.sector)) bySector.set(b.sector, [...(bySector.get(b.sector) ?? []), b]);

  const jobs = Object.entries(m.staff) as [JobId, number][];
  const keyJobs = jobs.slice().sort((a, b) => b[1] - a[1]).slice(0, 2);

  const rows = useMemo(() => {
    const ok = (c: CityState) => {
      if (where === "abroad" ? !c.foreign : c.foreign) return false;
      if (where === "us" && stateFilter !== "all" && c.state !== stateFilter) return false;
      if (def.resource && (resourceMult(def.resource, c.state) <= 0 || (!c.foreign && !c.rest && s.cities[`rest-${c.state}`]))) return false;
      return true;
    };
    return Object.values(s.cities).filter(ok).map((c) => {
      let free = Infinity, wage = 0;
      for (const [j, n] of keyJobs) {
        const cell = s.labor[laborKey(c.id, j)];
        free = Math.min(free, cell ? Math.max(0, cell.workforce - cell.gameEmployed) / n : 0);
      }
      for (const [j, n] of jobs) wage += (s.labor[laborKey(c.id, j)]?.wage ?? 0) * n;
      const q = buildQuote(s, type, c.id, 1, method, me);
      return { c, hire: free * 0.05, wage, cost: q.total, months: q.months, op: opinionOf(s, c.id, me), block: permitBlock(s, c.id, me, type), site: siteMultFor(type, method, c.state) };
    }).sort((a, b) => (a.block ? 1 : 0) - (b.block ? 1 : 0) || b.hire * b.site - a.hire * a.site);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, method, where, stateFilter, s.month]);

  const here = s.cities[city];
  const valid = rows.some((r) => r.c.id === city);
  const q = buildQuote(s, type, city, levels, method, me);
  const block = valid ? permitBlock(s, city, me, type) : "Pick a location from the list.";
  const entering = !!def.sector && !mine.has(def.sector);
  const go = () => {
    const doIt = () => act(build(s, me.id, type, city, levels, method));
    const share = q.total / Math.max(1, liquidity(me));
    if (share > 0.25) ask(`This costs ${fmtMoney(q.total)}, ${fmtPct(share, 0)} of your cash and credit. Build it?`, doIt); else doIt();
  };
  const canAbroad = type !== "hq";

  return (
    <Panel title="Build" help="production">
      <div className="build">
        <section>
          <div className="bstep">Your industries</div>
          <div className="btiles">{core.map((b) => <Tile key={b.id} b={b} on={b.id === type} onPick={() => pickType(b.id)} />)}</div>
          <button className="link" onClick={() => setExplore(!explore)}>{explore ? "Hide other industries" : `Enter a new industry (${bySector.size} more)`}</button>
          {explore && (
            <div className="bexplore">
              {[...bySector.entries()].sort((a, b) => SECTORS[a[0]].name.localeCompare(SECTORS[b[0]].name)).map(([sec, bs]) => (
                <div key={sec} className="bsector">
                  <div className="bsector-name">{SECTORS[sec].name}</div>
                  <div className="btiles small">{bs.map((b) => <Tile key={b.id} b={b} on={b.id === type} onPick={() => pickType(b.id)} />)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="bstep">{def.name}</div>
          {def.methods.length > 1 && (
            <div className="segmented">
              {def.methods.map((x) => (
                <button key={x.id} className={x.id === method ? "on" : ""} onClick={() => setMethod(x.id)}>
                  <strong>{x.name}</strong><span>{outputOf(def, x.id)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="bwhere">
            <div className="tabs-inline">
              <button className={where === "us" ? "on" : ""} onClick={() => setWhere("us")}>United States</button>
              <button className={where === "abroad" ? "on" : ""} disabled={!canAbroad} onClick={() => setWhere("abroad")}>Abroad</button>
              {where === "us" && (
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="State">
                  <option value="all">All states</option>
                  {STATES.map((st) => <option key={st.code} value={st.code}>{st.name}</option>)}
                </select>
              )}
            </div>
            <div className="scroll" style={{ maxHeight: 330 }}>
              <Table
                rows={rows}
                rowKey={(r) => r.c.id}
                rowClass={(r) => `${r.c.id === city ? "me" : ""} ${r.block ? "blocked" : ""} pickable`}
                onRowClick={(r) => setCity(r.c.id)}
                cols={where === "us" ? [
                  { key: "c", label: "Location", render: (r) => <span title={r.block ?? r.c.county ?? ""}>{cityLabel(s, r.c.id)}</span>, sort: (r) => r.c.name },
                  { key: "h", label: "Workers a month", num: true, title: `Levels' worth of ${keyJobs.map(([j]) => JOB_BY_ID[j].plural.toLowerCase()).join(" and ")} you could hire each month`, render: (r) => r.hire.toFixed(1), sort: (r) => r.hire },
                  { key: "w", label: "Wages a level", num: true, render: (r) => fmtMoney(r.wage), sort: (r) => -r.wage },
                  { key: "k", label: "Cost a level", num: true, render: (r) => fmtMoney(r.cost), sort: (r) => -r.cost },
                  { key: "t", label: "Months", num: true, render: (r) => r.months.toFixed(1), sort: (r) => -r.months },
                  { key: "o", label: "Locals", num: true, title: "How the city feels about you", render: (r) => <span className={r.op < 0.35 ? "neg" : r.op > 0.65 ? "pos" : ""}>{fmtPct(r.op, 0)}</span>, sort: (r) => r.op },
                  ...(def.resource || method === "solar" || method === "wind" ? [{ key: "s", label: def.resource ? "Reserves" : method === "wind" ? "Wind" : "Sun", num: true, render: (r: typeof rows[number]) => fmtPct(r.site, 0), sort: (r: typeof rows[number]) => r.site }] : []),
                  ...(type === "datacenter" ? [{ key: "p", label: "Power", num: true, render: (r: typeof rows[number]) => `${r.c.powerIdx.toFixed(2)}×`, sort: (r: typeof rows[number]) => -r.c.powerIdx }] : []),
                ] : [
                  { key: "c", label: "Country", render: (r) => <span title={r.block ?? COUNTRY_BY_ID[r.c.state]?.blurb}>{r.c.name}</span>, sort: (r) => r.c.name },
                  { key: "h", label: "Workers a month", num: true, render: (r) => r.hire.toFixed(0), sort: (r) => r.hire },
                  { key: "w", label: "Wages a level", num: true, render: (r) => fmtMoney(r.wage), sort: (r) => -r.wage },
                  { key: "p", label: "Productivity", num: true, render: (r) => fmtPct(r.site, 0), sort: (r) => r.site },
                  { key: "x", label: "Tariff and freight", num: true, title: "Share of the price of everything sold into the US", render: (r) => fmtPct(homeCostShare(s, r.c.id), 0), sort: (r) => -homeCostShare(s, r.c.id) },
                  { key: "k", label: "Cost a level", num: true, render: (r) => fmtMoney(r.cost), sort: (r) => -r.cost },
                ]}
              />
            </div>
          </div>
        </section>

        <aside className="border">
          <div className="bstep">Order</div>
          <div className="bo-place">{valid ? `${def.name} in ${cityLabel(s, city)}` : "Pick a location"}</div>
          {here?.county && valid && <div className="muted">{here.county}</div>}
          <div className="stepper">
            <button onClick={() => setLevels(Math.max(1, levels - 1))} aria-label="Fewer">−</button>
            <input type="number" min={1} value={levels} onChange={(e) => setLevels(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
            <button onClick={() => setLevels(levels + 1)} aria-label="More">+</button>
            <span>levels</span>
          </div>
          <div className="quick">{[1, 5, 10, 25, 100].map((n) => <button key={n} className={levels === n ? "on" : ""} onClick={() => setLevels(n)}>{n}</button>)}</div>
          <dl className="bo-figs">
            <dt>Cost</dt><dd>{fmtMoney(q.total)}{q.total < q.unsubsidized - 1 && <span className="pos" title="Federal subsidies and local incentives"> saves {fmtMoney(q.unsubsidized - q.total)}</span>}</dd>
            <dt>Ready in</dt><dd>{q.months.toFixed(1)} months</dd>
            <dt>Output</dt><dd>{outputOf(def, method)} a level</dd>
            <dt>Staff</dt><dd title={jobs.map(([j, n]) => `${n} ${JOB_BY_ID[j].plural.toLowerCase()}`).join(", ")}>{jobs.reduce((a, [, n]) => a + n, 0)} a level, mostly {JOB_BY_ID[keyJobs[0][0]].plural.toLowerCase()}</dd>
            {type === "datacenter" && here && <><dt>Power bill</dt><dd>{fmtMoney(dcPowerCost(s, city))} a level a month</dd></>}
            {here?.foreign && <><dt>Shipping home</dt><dd>{fmtPct(homeCostShare(s, city), 0)} of US sales</dd></>}
            {def.sector && <><dt>Industry</dt><dd className={entering ? "warn" : ""}>{entering
              ? `New: ${fmtPct(knowhowMult(entryKnowhow(me, def.sector)) * scaleMult(levels), 0)} efficiency to start${activeSectors(me).length >= 2 ? ", +15% HQ load" : ""}`
              : `${SECTORS[def.sector].name}, know-how ${fmtPct(me.knowhow?.[def.sector] ?? 1, 0)}`}</dd></>}
            <dt>Cash and credit</dt><dd>{fmtMoney(liquidity(me))}</dd>
          </dl>
          {block && <p className="neg" style={{ margin: "6px 0" }}>{block}</p>}
          <button className="primary big" disabled={!!block} onClick={go}>Build {levels} level{levels > 1 ? "s" : ""}</button>
        </aside>
      </div>
    </Panel>
  );
}

// re-exported so the solar/wind multipliers stay referenced for tree-shaking clarity
export const _site = { SUN, WIND };
