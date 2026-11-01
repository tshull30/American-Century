export interface Tier {
  id: string;
  name: string;
  min: number;
}

/** Market-cap tiers. You compete against the other companies in your tier. */
export const TIERS: Tier[] = [
  { id: "titan", name: "Titan", min: 1e12 },
  { id: "mega", name: "Mega Cap", min: 200e9 },
  { id: "large", name: "Large Cap", min: 10e9 },
  { id: "mid", name: "Mid Cap", min: 2e9 },
  { id: "small", name: "Small Cap", min: 300e6 },
  { id: "micro", name: "Startup", min: 0 },
];

export function tierOf(marketCap: number): Tier {
  return TIERS.find((t) => marketCap >= t.min) ?? TIERS[TIERS.length - 1];
}
