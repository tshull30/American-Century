import type { Faction } from "./congress";
import type { LawId } from "./laws";

export interface FactionDef {
  id: Faction;
  name: string;
  party: "D" | "R";
  color: string;
  blurb: string;
  /** Preferred level of each law. */
  prefs: Record<LawId, number>;
  /** How open members are to lobbying and PAC money on issues they only mildly oppose. */
  swayable: number;
}

// Order of prefs: corporate_tax, minimum_wage, tariffs, antitrust, industrial_policy, immigration, labor_unions, data_privacy, climate
const P = (a: number[]): Record<LawId, number> => ({
  corporate_tax: a[0], minimum_wage: a[1], tariffs: a[2], antitrust: a[3], industrial_policy: a[4],
  immigration: a[5], labor_unions: a[6], data_privacy: a[7], climate: a[8],
});

export const FACTIONS: Record<Faction, FactionDef> = {
  socialist: { id: "socialist", name: "Socialist", party: "D", color: "#1e3a5f", swayable: 0.2,
    blurb: "Democratic socialists. Tax corporations hard, $20 wages, strong unions, break up monopolies.",
    prefs: P([3, 3, 1, 2, 2, 2, 2, 2, 2]) },
  progressive: { id: "progressive", name: "Progressive", party: "D", color: "#2b4c7e", swayable: 0.4,
    blurb: "The party's left wing. Higher taxes and wages, tough antitrust, aggressive climate policy.",
    prefs: P([2, 2, 1, 2, 2, 2, 2, 2, 2]) },
  liberal: { id: "liberal", name: "Liberal", party: "D", color: "#3f6ea8", swayable: 0.6,
    blurb: "Mainstream Democrats. Green industrial policy, $15 wages, moderate tax increases.",
    prefs: P([2, 2, 1, 1, 2, 2, 1, 1, 2]) },
  moderate: { id: "moderate", name: "Moderate", party: "D", color: "#6f97c9", swayable: 1,
    blurb: "Swing-seat Democrats and New Democrats. Pro-business enough to deal.",
    prefs: P([1, 1, 1, 1, 1, 1, 1, 1, 1]) },
  bluedog: { id: "bluedog", name: "Blue Dog", party: "D", color: "#9bb7dc", swayable: 1,
    blurb: "Fiscally conservative Democrats from tough districts.",
    prefs: P([1, 1, 1, 1, 1, 1, 1, 0, 1]) },
  corporate: { id: "corporate", name: "Corporate", party: "R", color: "#d98b7f", swayable: 1,
    blurb: "Chamber-of-Commerce Republicans. Low taxes, free trade, visas for skilled workers.",
    prefs: P([0, 0, 0, 0, 1, 2, 0, 0, 0]) },
  maga: { id: "maga", name: "MAGA", party: "R", color: "#a8322a", swayable: 0.4,
    blurb: "America First Republicans. Tariffs, immigration restriction, low taxes, suspicious of Big Tech.",
    prefs: P([0, 0, 3, 1, 0, 0, 1, 0, 0]) },
  populist: { id: "populist", name: "Populist", party: "R", color: "#c0563b", swayable: 0.5,
    blurb: "Working-class conservatives. Tariffs and antitrust against Big Tech, skeptical of Wall Street.",
    prefs: P([1, 1, 3, 2, 1, 0, 1, 1, 0]) },
  libertarian: { id: "libertarian", name: "Libertarian", party: "R", color: "#c79a3a", swayable: 0.3,
    blurb: "Small-government Republicans. Against tariffs, subsidies and regulation alike.",
    prefs: P([0, 0, 0, 0, 0, 1, 0, 0, 0]) },
};

/** Moderate Republicans share the "moderate" id with moderate Democrats but vote differently. */
export const MODERATE_R: FactionDef = {
  id: "moderate", name: "Moderate", party: "R", color: "#e3aa9c", swayable: 1,
  blurb: "Swing-district and New England-style Republicans. Will cut deals.",
  prefs: P([1, 1, 1, 1, 1, 1, 1, 0, 1]),
};

export function factionDef(f: Faction, party: "D" | "R"): FactionDef {
  if (f === "moderate" && party === "R") return MODERATE_R;
  return FACTIONS[f];
}

export const FACTION_ORDER: { party: "D" | "R"; id: Faction }[] = [
  { party: "D", id: "socialist" }, { party: "D", id: "progressive" }, { party: "D", id: "liberal" }, { party: "D", id: "moderate" },
  { party: "D", id: "bluedog" }, { party: "R", id: "moderate" }, { party: "R", id: "corporate" }, { party: "R", id: "libertarian" },
  { party: "R", id: "populist" }, { party: "R", id: "maga" },
];

export const FIRST_NAMES = ["James", "Maria", "Robert", "Linda", "Michael", "Sarah", "David", "Jennifer", "Carlos", "Emily", "Daniel", "Aisha",
  "Matthew", "Rachel", "Anthony", "Laura", "Kevin", "Priya", "Brian", "Megan", "Jason", "Nicole", "Luis", "Hannah", "Eric", "Grace",
  "Tyler", "Olivia", "Marcus", "Erin", "Derek", "Rosa", "Wesley", "Tamara", "Caleb", "Deborah", "Andre", "Kristen", "Ryan", "Monica"];
export const LAST_NAMES = ["Whitfield", "Okafor", "Delgado", "Harmon", "Brennan", "Nakamura", "Castillo", "Pruitt", "Lindqvist", "Ashby",
  "Reyes", "Coleman", "Sandoval", "Mercer", "Haddad", "Thornton", "Kowalski", "Bridges", "Fairbanks", "Ortega", "Langley", "Vance",
  "Holloway", "Park", "Gutierrez", "McAllister", "Sorensen", "Whitaker", "Dunmore", "Abernathy", "Quintero", "Rhodes", "Ellison",
  "Hargrove", "Patel", "Beaumont", "Kincaid", "Moreland", "Strickland", "Yates"];
