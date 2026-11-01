import { BUILDING_BY_ID } from "../sim/data/buildings";
import { GOOD_BY_ID, type GoodId } from "../sim/data/goods";
import { LAW_BY_ID } from "../sim/data/laws";
import { adminCapacity, adminLoad } from "../sim/engine";
import { cityLabel, opinionOf } from "../sim/geo";
import type { Company, GameState } from "../sim/types";
import { fmtMoney } from "../sim/util";
import { SECTORS, type SectorId } from "../sim/data/buildings";
import { sectorLevels } from "../sim/sectors";

export interface Alert {
  text: string;
  tab: string;
  tone: "bad" | "warn" | "info";
}

/** Things that need the player's attention, most urgent first. */
export function computeAlerts(s: GameState, me: Company): Alert[] {
  const out: Alert[] = [];
  const last = me.history[me.history.length - 1];
  if (me.distressMonths > 0) out.push({ tone: "bad", tab: "finance", text: `Net debt is over your credit limit: ${6 - me.distressMonths} month${me.distressMonths === 5 ? "" : "s"} until default` });
  if (last && last.netIncome < 0 && me.cash < -last.netIncome * 6) out.push({ tone: "bad", tab: "finance", text: `Under six months of cash at the current burn (${fmtMoney(-last.netIncome)} a month)` });
  const load = adminLoad(me), cap = adminCapacity(me);
  if (load > cap) out.push({ tone: "warn", tab: "production", text: `Headquarters overloaded (${load} of ${cap} levels): add HQ levels` });

  const short = me.buildings.filter((b) => b.level > 0 && b.staffRatio < 0.8 && !b.construction.length);
  if (short.length) {
    const worst = short.slice().sort((a, b) => a.staffRatio - b.staffRatio)[0];
    out.push({ tone: "warn", tab: "workforce", text: short.length === 1
      ? `${BUILDING_BY_ID[worst.type].name} in ${cityLabel(s, worst.city)} is ${Math.round(worst.staffRatio * 100)}% staffed`
      : `${short.length} sites under 80% staffed; worst is ${cityLabel(s, worst.city)} at ${Math.round(worst.staffRatio * 100)}%` });
  }

  const myCities = new Set(me.buildings.map((b) => b.city));
  const hostile = [...myCities].filter((c) => opinionOf(s, c, me) < 0.15);
  if (hostile.length) out.push({ tone: "warn", tab: "workforce", text: `${cityLabel(s, hostile[0])}${hostile.length > 1 ? ` and ${hostile.length - 1} more` : ""} won't approve your permits` });
  const banned = [...new Set(me.buildings.filter((b) => b.type === "datacenter").map((b) => b.city))].filter((c) => s.cities[c]?.dcStance === "moratorium");
  if (banned.length) out.push({ tone: "info", tab: "production", text: `Data-center moratorium in ${cityLabel(s, banned[0])}${banned.length > 1 ? ` and ${banned.length - 1} more` : ""}` });

  if (last) {
    for (const [g, q] of Object.entries(me.inventory) as [GoodId, number][]) {
      const sold = last.unitsSold[g] ?? 0;
      const good = GOOD_BY_ID[g];
      if (!good || good.decay >= 1 || good.intermediate || q < 1) continue;
      if (q > Math.max(sold * 3, 1000)) { out.push({ tone: "info", tab: "markets", text: `Unsold ${good.name.toLowerCase()} piling up (${sold > 0 ? `${(q / sold).toFixed(0)} months of sales` : "no sales last month"})` }); break; }
    }
  }

  for (const [sec, k] of Object.entries(me.knowhow ?? {})) {
    if ((k ?? 1) < 0.5 && Object.keys(sectorLevels(me)).includes(sec)) { out.push({ tone: "info", tab: "production", text: `Still learning ${SECTORS[sec as SectorId].name.toLowerCase()} (know-how ${Math.round((k ?? 0) * 100)}%)` }); break; }
  }

  for (const d of s.deals) {
    if (d.buyerId === me.id) out.push({ tone: "info", tab: "rivals", text: `Your bid for ${s.companies.find((c) => c.id === d.targetId)?.name}: ${d.stage === "second_request" ? "second request" : "in review"}, ${d.daysLeft} days left` });
    if (d.targetId === me.id) out.push({ tone: "warn", tab: "rivals", text: `${s.companies.find((c) => c.id === d.buyerId)?.name} is buying you` });
  }

  const bill = s.politics.bill;
  if (bill && me.lobbying.some((l) => l.law === bill.law)) out.push({ tone: "info", tab: "politics", text: `The ${LAW_BY_ID[bill.law].name.toLowerCase()} bill you're lobbying on is in Congress` });
  const days = s.politics.nextElectionDay - s.day;
  if (days > 0 && days <= 45) out.push({ tone: "info", tab: "elections", text: `Election day in ${days} day${days === 1 ? "" : "s"}` });
  return out;
}
