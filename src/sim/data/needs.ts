import type { GoodId } from "./goods";

// What pops spend their income on (Victoria 3 style). Each need is met by one or
// more goods that substitute for each other (gas cars vs EVs for transport).

export type NeedId = "food" | "energy" | "clothing" | "healthcare" | "transport" | "communication" | "computing" | "entertainment";

export interface NeedDef {
  id: NeedId;
  name: string;
  goods: GoodId[];
  /** Basic needs take a smaller share of income as income rises (elasticity < 1). */
  incomeElasticity: number;
  /** How much the need counts toward standard of living. */
  weight: number;
  basic: boolean;
}

export const NEEDS: NeedDef[] = [
  { id: "food", name: "Food", goods: ["groceries"], incomeElasticity: 0.5, weight: 3, basic: true },
  { id: "energy", name: "Energy", goods: ["electricity"], incomeElasticity: 0.4, weight: 2, basic: true },
  { id: "healthcare", name: "Healthcare", goods: ["pharmaceuticals"], incomeElasticity: 0.8, weight: 2, basic: true },
  { id: "clothing", name: "Clothing", goods: ["apparel"], incomeElasticity: 0.8, weight: 1, basic: true },
  { id: "transport", name: "Transportation", goods: ["gas_cars", "evs"], incomeElasticity: 1.1, weight: 2, basic: false },
  { id: "communication", name: "Communication", goods: ["smartphones"], incomeElasticity: 0.7, weight: 1, basic: false },
  { id: "computing", name: "Computing", goods: ["computers"], incomeElasticity: 1.2, weight: 0.7, basic: false },
  { id: "entertainment", name: "Entertainment", goods: ["streaming"], incomeElasticity: 1.1, weight: 0.6, basic: false },
];

export const NEED_BY_ID: Record<NeedId, NeedDef> = Object.fromEntries(NEEDS.map((n) => [n.id, n])) as Record<NeedId, NeedDef>;

export const NEED_OF_GOOD: Partial<Record<GoodId, NeedId>> = {};
for (const n of NEEDS) for (const g of n.goods) NEED_OF_GOOD[g] = n.id;

/** Standard-of-living labels, by score (100 = what an average-income American could afford at 2026 prices). */
export const SOL_TIERS: { min: number; name: string }[] = [
  { min: 125, name: "Wealthy" },
  { min: 105, name: "Affluent" },
  { min: 90, name: "Comfortable" },
  { min: 70, name: "Getting by" },
  { min: 0, name: "Struggling" },
];

export function solTier(score: number): string {
  return (SOL_TIERS.find((t) => score >= t.min) ?? SOL_TIERS[SOL_TIERS.length - 1]).name;
}
