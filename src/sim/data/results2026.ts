// What actually happened on November 3, 2026, as reported by the Associated Press and others
// (counts as of November 12, 2026). Used when a game is set to follow real history.
import type { Faction } from "./congress";

export interface RealSenateRace {
  D?: string;
  R?: string;
  /** Missing when the race was still uncalled; the simulation decides it. */
  winner?: "D" | "R";
  /** Democratic share of the two-party vote, where it's known. */
  dShare?: number;
  /** Faction for a newcomer (incumbents keep theirs). */
  dFaction?: Faction;
  rFaction?: Faction;
  note?: string;
}

/** Keyed by state. Ohio and Florida were specials; no state had two Senate races. */
export const SENATE_2026: Record<string, RealSenateRace> = {
  AL: { R: "Barry Moore", winner: "R", rFaction: "maga" },
  AK: { D: "Mary Peltola", R: "Dan Sullivan", dFaction: "moderate", note: "Still being counted in the real world; ranked-choice tabulation decides it. Simulated here." },
  AR: { R: "Tom Cotton", winner: "R" },
  CO: { D: "John Hickenlooper", winner: "D" },
  DE: { D: "Chris Coons", R: "Michael Katz", winner: "D" },
  FL: { D: "Angie Nixon", R: "Ashley Moody", winner: "R", dFaction: "progressive" },
  GA: { D: "Jon Ossoff", R: "Mike Collins", winner: "D", rFaction: "maga" },
  ID: { R: "Jim Risch", winner: "R" },
  IL: { D: "Juliana Stratton", winner: "D", dFaction: "progressive" },
  IA: { D: "Josh Turek", R: "Ashley Hinson", winner: "D", dFaction: "moderate", note: "Democratic flip." },
  KS: { D: "Adam Hamilton", R: "Roger Marshall", winner: "D", dShare: 0.535, dFaction: "moderate", note: "The first Democrat Kansas has sent to the Senate since 1932." },
  KY: { R: "Andy Barr", winner: "R", rFaction: "corporate" },
  LA: { R: "Julia Letlow", winner: "R", rFaction: "corporate", note: "Letlow beat Sen. Bill Cassidy in the primary." },
  ME: { D: "Troy Jackson", R: "Susan Collins", winner: "D", dFaction: "progressive", note: "Democratic flip." },
  MA: { D: "Ed Markey", winner: "D" },
  MI: { D: "Abdul El-Sayed", R: "Mike Rogers", winner: "D", dFaction: "progressive" },
  MN: { D: "Peggy Flanagan", winner: "D", dFaction: "progressive" },
  MS: { D: "Scott Colom", R: "Cindy Hyde-Smith", winner: "D", dShare: 0.5024, dFaction: "moderate", note: "Called on November 11 after a week of counting. Mississippi's first Black senator since Reconstruction." },
  MT: { D: "Alani Bankhead", R: "Kurt Alme", winner: "R", rFaction: "corporate", note: "Sen. Steve Daines didn't run. Independent Seth Bodnar finished second." },
  NE: { R: "Pete Ricketts", winner: "R" },
  NH: { D: "Chris Pappas", winner: "D", dFaction: "moderate" },
  NJ: { D: "Cory Booker", winner: "D" },
  NM: { D: "Ben Ray Luján", winner: "D" },
  NC: { D: "Roy Cooper", R: "Michael Whatley", winner: "D", dFaction: "moderate", rFaction: "maga", note: "Democratic flip." },
  OH: { D: "Sherrod Brown", R: "Jon Husted", winner: "D", dFaction: "progressive", note: "Special election. Democratic flip." },
  OK: { R: "Kevin Hern", winner: "R", rFaction: "corporate" },
  OR: { D: "Jeff Merkley", winner: "D" },
  RI: { D: "Jack Reed", winner: "D" },
  SC: { D: "Annie Andrews", R: "Darline Graham", winner: "D", dFaction: "liberal", note: "Democratic flip. The first woman South Carolina has elected to the Senate." },
  SD: { R: "Mike Rounds", winner: "R" },
  TN: { D: "Marquita Bradshaw", R: "Bill Hagerty", winner: "R" },
  TX: { D: "James Talarico", R: "Ken Paxton", winner: "D", dFaction: "progressive", rFaction: "maga", note: "Democratic flip. Paxton beat Sen. John Cornyn in the primary." },
  VA: { D: "Mark Warner", winner: "D" },
  WV: { D: "Rachel Fetty Anderson", R: "Shelley Moore Capito", winner: "R" },
  WY: { R: "Harriet Hageman", winner: "R", rFaction: "maga" },
};

/** Democratic House seats: 254 called by November 9, with Cook projecting five or six more of the 19 then uncalled. */
export const HOUSE_D_2026 = 259;

/** Real events before the election that change who sits in the Senate. */
export const SENATE_EVENTS_2026 = [
  {
    month: 7, day: 13, state: "SC", out: "Lindsey Graham",
    in: { name: "Darline Graham", party: "R" as const, faction: "maga" as Faction },
    headline: "South Carolina's governor appoints Darline Graham to the Senate",
    deck: "Sen. Lindsey Graham died on July 11. His sister, who has never held office, takes the seat and will run for it in November.",
  },
];

/** Senators who didn't run for another term, beyond those known at the start of 2026. */
export const LATE_RETIREMENTS_2026 = ["MT-Daines"];
