import { describe, expect, it } from "vitest";
import { acquire, build } from "../src/sim/actions";
import { STATES } from "../src/sim/data/states";
import { newGame, player, tick, ttm } from "../src/sim/engine";
import { generatePops, rake } from "../src/sim/pops";

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
    for (let i = 0; i < 6; i++) { tick(a); tick(b); }
    expect(player(a).cash).toBe(player(b).cash);
    expect(a.companies.map((c) => c.marketCap)).toEqual(b.companies.map((c) => c.marketCap));
  });

  it("runs three years without NaNs and keeps incumbents in a sane range", () => {
    const s = newGame({ kind: "startup", name: "T", ticker: "T", good: "software", hq: "TX" }, 5);
    for (let i = 0; i < 36; i++) tick(s);
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
    expect(build(s, me.id, "software", "CA", 2).ok).toBe(true);
    for (let i = 0; i < 5; i++) tick(s);
    const b = me.buildings.find((x) => x.type === "software" && x.state === "CA")!;
    expect(b.level).toBe(2);
    expect(b.staffRatio).toBeGreaterThan(0.9);
  });

  it("acquires a company and merges its assets", () => {
    const s = newGame({ kind: "incumbent", key: "windward" }, 2);
    const me = player(s);
    const lattice = s.companies.find((c) => c.name === "Lattice Labs")!;
    const sites = me.buildings.length;
    const r = acquire(s, me.id, lattice.id, "cash");
    expect(r.ok).toBe(true);
    expect(lattice.alive).toBe(false);
    expect(me.buildings.length).toBeGreaterThanOrEqual(sites);
  });
});
