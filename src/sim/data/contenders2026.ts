// Real candidates who had declared for the 2026 Senate races, as best known in mid-2026.
// The game still runs its own primaries: these are the people those primaries choose
// between, not the results. Incumbents running again are seated automatically.
// Key: state, then party. Order is roughly how prominent each was.

export const SENATE_CONTENDERS_2026: Record<string, { D?: string[]; R?: string[] }> = {
  NC: { D: ["Roy Cooper"], R: ["Michael Whatley"] },
  GA: { R: ["Buddy Carter", "Mike Collins", "Derek Dooley"] },
  MI: { D: ["Haley Stevens", "Mallory McMorrow", "Abdul El-Sayed"], R: ["Mike Rogers"] },
  NH: { D: ["Chris Pappas"], R: ["John E. Sununu", "Scott Brown"] },
  ME: { D: ["Janet Mills", "Graham Platner"] },
  TX: { D: ["James Talarico", "Jasmine Crockett"], R: ["Ken Paxton", "Wesley Hunt"] },
  OH: { D: ["Sherrod Brown"] },
  IA: { D: ["Josh Turek", "Zach Wahls", "Nathan Sage"], R: ["Ashley Hinson"] },
  KY: { D: ["Amy McGrath", "Charles Booker"], R: ["Andy Barr", "Daniel Cameron", "Nate Morris"] },
  AL: { R: ["Steve Marshall", "Barry Moore", "Jared Hudson"] },
  MN: { D: ["Peggy Flanagan", "Angie Craig"], R: ["Royce White", "Adam Schwarze"] },
  IL: { D: ["Juliana Stratton", "Raja Krishnamoorthi", "Robin Kelly"] },
  AK: { D: ["Mary Peltola"] },
  WY: { R: ["Harriet Hageman"] },
  LA: { R: ["John Fleming", "Blake Miguez"] },
  SC: { R: ["Paul Dans", "Mark Lynch"] },
  MA: { D: ["Seth Moulton"] },
};
