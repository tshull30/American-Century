// Federal laws the game models. Each has a few levels; parties want different levels,
// and companies can lobby to move them.

export type LawId =
  | "corporate_tax"
  | "minimum_wage"
  | "tariffs"
  | "antitrust"
  | "industrial_policy"
  | "immigration"
  | "labor_unions"
  | "data_privacy"
  | "climate";

export type PartyId = "commonwealth" | "frontier";

export interface LawDef {
  id: LawId;
  name: string;
  levels: { name: string; effect: string }[];
  /** Level each party wants. */
  platform: Record<PartyId, number>;
  start: number;
}

export const PARTIES: Record<PartyId, { name: string; short: string; color: string; pitch: string }> = {
  commonwealth: {
    name: "Democratic Party", short: "Democrats", color: "#3b82f6",
    pitch: "Higher taxes on business, stronger unions and wage floors, tougher antitrust, green industrial policy.",
  },
  frontier: {
    name: "Republican Party", short: "Republicans", color: "#ef4444",
    pitch: "Lower taxes and lighter regulation, protective tariffs, tighter immigration, weaker unions.",
  },
};

export const LAWS: LawDef[] = [
  { id: "corporate_tax", name: "Corporate Tax", start: 1, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "15%", effect: "Federal tax on profits: 15%." },
    { name: "21%", effect: "Federal tax on profits: 21%." },
    { name: "28%", effect: "Federal tax on profits: 28%." },
    { name: "35%", effect: "Federal tax on profits: 35%." },
  ] },
  { id: "minimum_wage", name: "Minimum Wage", start: 0, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "$7.25", effect: "No meaningful federal floor; wages follow the market." },
    { name: "$12", effect: "Floor of about $2,080 a month for service workers and laborers." },
    { name: "$15", effect: "Floor of about $2,600 a month for service workers and laborers." },
    { name: "$20", effect: "Floor of about $3,470 a month for service workers and laborers." },
  ] },
  { id: "tariffs", name: "Tariffs", start: 1, platform: { commonwealth: 1, frontier: 2 }, levels: [
    { name: "Free trade", effect: "No tariffs." },
    { name: "10%", effect: "Imports cost more and foreign rivals lose some edge in US markets; mild retaliation against US exports." },
    { name: "25%", effect: "Imported inputs and foreign goods much pricier; noticeable retaliation against exports." },
    { name: "60%", effect: "Near-embargo on imports; heavy retaliation against exports." },
  ] },
  { id: "antitrust", name: "Antitrust Enforcement", start: 1, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "Lax", effect: "Mergers blocked only above 60% combined market share." },
    { name: "Moderate", effect: "Mergers blocked above 40% combined market share." },
    { name: "Strict", effect: "Mergers blocked above 25% combined share; regulators watch the biggest companies." },
  ] },
  { id: "industrial_policy", name: "Industrial Subsidies", start: 1, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "None", effect: "No construction subsidies." },
    { name: "Strategic", effect: "30% off building chip fabs, battery plants and power plants." },
    { name: "Broad", effect: "30% off strategic plants, 15% off all other factories." },
  ] },
  { id: "immigration", name: "High-Skill Immigration", start: 1, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "Restricted", effect: "5% fewer engineers, software developers and scientists available." },
    { name: "Current", effect: "Today's visa caps." },
    { name: "Expanded", effect: "10% more engineers, software developers and scientists available." },
  ] },
  { id: "labor_unions", name: "Labor Unions", start: 1, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "Weak", effect: "Wages rise slowly when companies compete for workers." },
    { name: "Standard", effect: "Current labor law." },
    { name: "Strong", effect: "Laborers and technicians earn 6% more; wages rise faster when labor is tight." },
  ] },
  { id: "data_privacy", name: "Data Privacy", start: 0, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "Minimal", effect: "Advertisers and data brokers operate freely." },
    { name: "Moderate", effect: "8% less demand for digital ads and data platforms." },
    { name: "Strict", effect: "18% less demand for digital ads and data platforms." },
  ] },
  { id: "climate", name: "Climate Policy", start: 1, platform: { commonwealth: 2, frontier: 0 }, levels: [
    { name: "None", effect: "No climate measures." },
    { name: "Clean energy credits", effect: "EVs 15% more attractive to buyers; solar plants 30% cheaper to build." },
    { name: "Carbon tax", effect: "EVs 30% more attractive, gas cars 15% less; gas power plants pay $2M per level per month." },
  ] },
];

export const LAW_BY_ID: Record<LawId, LawDef> = Object.fromEntries(LAWS.map((l) => [l.id, l])) as Record<LawId, LawDef>;
