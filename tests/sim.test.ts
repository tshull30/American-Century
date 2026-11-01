import { describe, expect, it } from "vitest";
import { offer, build } from "../src/sim/actions";
import { STATES } from "../src/sim/data/states";
import { newGame, player, tick, ttm } from "../src/sim/engine";
import { generatePops, rake } from "../src/sim/pops";
import { setLobbying } from "../src/sim/actions";
import { electionDay } from "../src/sim/politics";
import { seats, whip } from "../src/sim/congress";
import { foundPac, fundPac, pacSpend } from "../src/sim/actions";
import type { GameState } from "../src/sim/types";

function months(s: GameState, n: number) {
  const target = s.month + n;
  while (s.month < target && !s.gameOver) tick(s);
}

describe("pops", () => {
  it("rakes a seed matrix to match row and column targets", () => {
    const m = rake([60, 40], [30, 70], [[1, 1], [1, 3]]);
    expect(m[0][0] + m[0][1]).toBeCloseTo(60, 3);
    expect(m[0][0] + m[1][0]).toBeCloseTo(30, 3);
  });

  it("matches each state's workforce", () => {
    const pops = generatePops();
    for (const st of STATES) {
      const total = pops.filter((p) => p.state === st.code).reduce((a, p) => a + p.workers, 0);
      expect(total / (st.population * 0.5)).toBeGreaterThan(0.97);
      expect(total / (st.population * 0.5)).toBeLessThan(1.01);
    }
  });
});

describe("simulation", () => {
  it("is deterministic for a given seed", () => {
    const a = newGame({ kind: "incumbent", key: "kestrel" }, 123);
    const b = newGame({ kind: "incumbent", key: "kestrel" }, 123);
    for (let i = 0; i < 40; i++) { tick(a); tick(b); }
    expect(player(a).cash).toBe(player(b).cash);
    expect(a.companies.map((c) => c.marketCap)).toEqual(b.companies.map((c) => c.marketCap));
  });

  it("runs three years without NaNs and keeps incumbents in a sane range", () => {
    const s = newGame({ kind: "startup", name: "T", ticker: "T", good: "software", hq: "TX" }, 5);
    months(s, 36);
    for (const c of s.companies) {
      expect(Number.isFinite(c.cash)).toBe(true);
      expect(Number.isFinite(c.marketCap)).toBe(true);
    }
    const orchard = s.companies.find((c) => c.name === "Orchard Computer")!;
    expect(ttm(orchard, "revenue")).toBeGreaterThan(200e9);
    expect(ttm(orchard, "revenue")).toBeLessThan(900e9);
  });

  it("opens with seeded market caps and a fresh startup", () => {
    const s = newGame({ kind: "startup", name: "T", ticker: "T", good: "evs", hq: "MI" }, 9);
    expect(player(s).cash).toBe(80e6);
    expect(s.companies.find((c) => c.name === "Verdant Silicon")!.marketCap).toBe(4.5e12);
  });

  it("builds, finishes construction and staffs new levels", () => {
    const s = newGame({ kind: "startup", name: "T", ticker: "T", good: "software", hq: "TX" }, 1);
    const me = player(s);
    expect(build(s, me.id, "software", "sf", 2).ok).toBe(true);
    months(s, 5);
    const b = me.buildings.find((x) => x.type === "software" && x.city === "sf")!;
    expect(b.level).toBe(2);
    expect(b.staffRatio).toBeGreaterThan(0.9);
  });

  it("takes months and board approval to acquire a company", () => {
    const s = newGame({ kind: "incumbent", key: "windward" }, 2);
    const me = player(s);
    const lattice = s.companies.find((c) => c.kind === "startup" && !c.isPlayer && c.marketCap < 1e9)!;
    const low = offer(s, me.id, lattice.id, 0.05, "cash");
    expect(low.ok).toBe(false);
    let r = offer(s, me.id, lattice.id, 0.9, "cash");
    for (let i = 0; i < 5 && !r.ok; i++) r = offer(s, me.id, lattice.id, 0.9, "cash");
    expect(r.ok).toBe(true);
    expect(lattice.alive).toBe(true);
    months(s, 16);
    // Resolved one way or the other: closed, or blocked by regulators.
    expect(s.deals.some((d) => d.targetId === lattice.id)).toBe(false);
  });
});

describe("needs and politics", () => {
  it("starts with a national standard of living near 100 and a full set of need stats", () => {
    const s = newGame({ kind: "incumbent", key: "heartland" }, 3);
    expect(s.sol).toBeGreaterThan(85);
    expect(s.sol).toBeLessThan(115);
    expect(Object.keys(s.needStats).length).toBe(11);
    const poor = s.needStats.food!.byQuintile[0], rich = s.needStats.food!.byQuintile[4];
    expect(rich).toBeGreaterThan(poor);
  });

  it("holds the 2026 midterms on 3 November", () => {
    expect(electionDay(2026)).toBe(306);
    const s = newGame({ kind: "incumbent", key: "orchard" }, 4);
    months(s, 11);
    expect(s.politics.lastResult?.presidential).toBe(false);
  });

  it("charges lobbying as a monthly expense", () => {
    const s = newGame({ kind: "incumbent", key: "orchard" }, 6);
    const me = player(s);
    setLobbying(s, me.id, "tariffs", -1, 20e6);
    months(s, 2);
    expect(me.history[me.history.length - 1].lobbying).toBeGreaterThanOrEqual(20e6);
  });
});

describe("congress", () => {
  it("seats the real 119th Congress as of 1 January 2026", () => {
    const s = newGame({ kind: "incumbent", key: "orchard" }, 8);
    expect(s.politicians.filter((m) => m.chamber === "senate").length).toBe(100);
    expect(s.politicians.filter((m) => m.chamber === "house").length + s.vacancies.length).toBe(435);
    expect(seats(s, "senate")).toEqual({ D: 47, R: 53 });
    expect(s.politicians.some((m) => m.name === "Lindsey Graham")).toBe(true);
    expect(s.politics.presidentName).toBe("Donald Trump");
  });

  it("needs 60 Senate votes for regulatory bills but 51 for taxes", () => {
    const s = newGame({ kind: "incumbent", key: "orchard" }, 9);
    const w1 = whip(s, "data_privacy", 1, "commonwealth");
    const w2 = whip(s, "corporate_tax", 0, "frontier");
    expect(w1.senate.need).toBe(60);
    expect(w2.senate.need).toBeLessThanOrEqual(51);
  });

  it("lets a PAC back a member and build goodwill", () => {
    const s = newGame({ kind: "incumbent", key: "lumiverse" }, 10);
    const me = player(s);
    expect(foundPac(s, me.id, "Test PAC").ok).toBe(true);
    expect(fundPac(s, me.id, 20e6).ok).toBe(true);
    const cruz = s.politicians.find((m) => m.name === "Ted Cruz")!;
    expect(pacSpend(s, me.id, cruz.id, 5e6, "support").ok).toBe(true);
    expect(cruz.friends[me.id]).toBe(5e6);
    expect(me.pac!.funds).toBe(15e6);
  });
});
