import { useMemo } from "react";
import { COUNTRIES, COUNTRY_BY_ID, IMMIGRANT_MIX, IMPORT_ORIGINS, type CountryDef } from "../../sim/data/countries";
import { CULTURE_BY_ID } from "../../sim/data/cultures";
import { GOODS, GOOD_BY_ID, type GoodId } from "../../sim/data/goods";
import { JOBS } from "../../sim/data/jobs";
import { LAW_BY_ID } from "../../sim/data/laws";
import { countryTariff, intlCityId } from "../../sim/intl";
import { fmtMoney, fmtNum, fmtPct, laborKey } from "../../sim/util";
import { Panel, Table, useGame, useSticky } from "../components";

/** Rough annual US imports of a good at reference prices. */
function importValue(g: GoodId): number {
  const d = GOOD_BY_ID[g];
  return (d.marketUS > 0 ? d.marketUS : d.marketWorld * 0.25) * d.importShare;
}

export function World() {
  const { s, me } = useGame();
  const [sel, setSel] = useSticky<string>("world.sel", "CHN");
  const country = COUNTRY_BY_ID[sel] ?? COUNTRIES[0];

  const byCountry = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of GOODS) {
      const o = IMPORT_ORIGINS[g.id];
      if (!o) continue;
      const v = importValue(g.id) * (s.marketGrowth[g.id] ?? 1);
      for (const [c, sh] of Object.entries(o)) m[c] = (m[c] ?? 0) + v * (sh ?? 0);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.month]);

  const myLevels = (c: string) => me.buildings.filter((b) => b.city === intlCityId(c)).reduce((a, b) => a + b.level, 0);
  const workers = (c: string) => (s.intlPops ?? []).filter((p) => p.country === c).reduce((a, p) => a + p.workers, 0);
  const disrupted = (c: string) => s.worldEvents.find((e) => e.countryOutput?.[c] !== undefined);
  const last = me.history[me.history.length - 1];
  const risk = (r: number) => (r >= 0.45 ? "High" : r >= 0.2 ? "Medium" : "Low");
  const immLaw = LAW_BY_ID.immigration.levels[s.politics.laws.immigration].name;

  return (
    <div>
      <div className="grid2">
        <Panel help="world" title="The world" right={last?.tariffs ? `You paid ${fmtMoney(last.tariffs)} in tariffs and freight last month` : "Build abroad from the Production tab"}>
          <Table<CountryDef>
            rows={COUNTRIES}
            rowKey={(c) => c.id}
            rowClass={(c) => (c.id === sel ? "me" : "")}
            cols={[
              { key: "n", label: "Country", render: (c) => <a onClick={() => setSel(c.id)}>{c.name}</a>, sort: (c) => c.name },
              { key: "w", label: "Wages", num: true, title: "Typical wage vs the US", render: (c) => fmtPct(c.wage, 0), sort: (c) => c.wage },
              { key: "p", label: "Productivity", num: true, title: "Output per worker vs a US plant", render: (c) => fmtPct(c.productivity, 0), sort: (c) => c.productivity },
              { key: "t", label: "US tariff", num: true, render: (c) => fmtPct(countryTariff(s, c), 0), sort: (c) => countryTariff(s, c) },
              { key: "f", label: "Freight", num: true, render: (c) => fmtPct(c.ship, 1), sort: (c) => c.ship },
              { key: "r", label: "Risk", render: (c) => disrupted(c.id) ? <span className="neg">{disrupted(c.id)!.name}</span> : risk(c.risk), sort: (c) => c.risk },
              { key: "i", label: "US imports", num: true, title: "Rough annual value of goods the US buys from it", render: (c) => fmtMoney(byCountry[c.id] ?? 0), sort: (c) => byCountry[c.id] ?? 0 },
              { key: "y", label: "Your levels", num: true, render: (c) => myLevels(c.id) ? fmtNum(myLevels(c.id)) : "", sort: (c) => myLevels(c.id) },
            ]}
          />
        </Panel>
        <div>
          <Panel title={country.name} right={`${fmtNum(workers(country.id))} hireable workers`}>
            <p className="hint" style={{ marginTop: 0 }}>{country.blurb}</p>
            <div className="scroll" style={{ maxHeight: 360 }}>
              <Table
                rows={JOBS}
                rowKey={(j) => j.id}
                initialSort="n"
                cols={[
                  { key: "j", label: "Pop", render: (j) => `${country.name} ${j.plural.toLowerCase()}` },
                  { key: "n", label: "Workers", num: true, render: (j) => fmtNum((s.intlPops ?? []).find((p) => p.country === country.id && p.job === j.id)?.workers ?? 0), sort: (j) => (s.intlPops ?? []).find((p) => p.country === country.id && p.job === j.id)?.workers ?? 0 },
                  { key: "w", label: "Wage", num: true, render: (j) => fmtMoney(s.labor[laborKey(intlCityId(country.id), j.id)]?.wage ?? 0), sort: (j) => s.labor[laborKey(intlCityId(country.id), j.id)]?.wage ?? 0 },
                  { key: "e", label: "At game companies", num: true, render: (j) => fmtNum(s.labor[laborKey(intlCityId(country.id), j.id)]?.gameEmployed ?? 0), sort: (j) => s.labor[laborKey(intlCityId(country.id), j.id)]?.gameEmployed ?? 0 },
                ]}
              />
            </div>
          </Panel>
          <Panel title="Immigration" right={`Law: ${immLaw}`}>
            <p style={{ margin: "0 0 8px" }}>{fmtNum(s.immigrantsThisYear ?? 0)} immigrant workers have joined American pops this year. They settle where their communities already live.</p>
            <Table
              rows={Object.entries(IMMIGRANT_MIX).sort((a, b) => b[1] - a[1])}
              rowKey={(r) => r[0]}
              cols={[
                { key: "c", label: "Background", render: (r) => <><span className="swatch" style={{ background: CULTURE_BY_ID[r[0] as keyof typeof CULTURE_BY_ID]?.color }} /> {CULTURE_BY_ID[r[0] as keyof typeof CULTURE_BY_ID]?.name}</> },
                { key: "s", label: "Share of newcomers", num: true, render: (r) => fmtPct(r[1], 0) },
              ]}
            />
          </Panel>
        </div>
      </div>
      <Panel title="Where America's imports come from">
        <Table
          rows={GOODS.filter((g) => IMPORT_ORIGINS[g.id])}
          rowKey={(g) => g.id}
          initialSort="v"
          cols={[
            { key: "g", label: "Product", render: (g) => g.name },
            { key: "sh", label: "Imported share", num: true, render: (g) => fmtPct(g.importShare, 0), sort: (g) => g.importShare },
            { key: "v", label: "Imports a year", num: true, render: (g) => fmtMoney(importValue(g.id) * (s.marketGrowth[g.id] ?? 1)), sort: (g) => importValue(g.id) },
            { key: "o", label: "Main sources", render: (g) => Object.entries(IMPORT_ORIGINS[g.id] ?? {}).filter(([c]) => c !== "Other").sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 4).map(([c, sh]) => `${COUNTRY_BY_ID[c]?.name ?? c} ${fmtPct(sh ?? 0, 0)}`).join(", ") },
          ]}
        />
      </Panel>
    </div>
  );
}
