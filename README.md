# American Century

A Victoria 3–style grand strategy game about running a company in the modern United States.

You play as a corporation: a fictional take on an Apple, Microsoft, Nvidia, Tesla or Palantir, or a startup you found yourself. You hire workers from census-based **pops** ("Indian American software developers from Texas", "White engineers from Missouri"), build plants across all 50 states, sell into markets against rivals, research better products, climb the market-cap tiers and buy out the competition.

Deep and spreadsheet-y, but fast: daily ticks, five game speeds, and everything runs in the browser.

**New in v0.3:** about 160 cities with their own tax breaks, permit speed, wages, unions, power grids and data-center rules. A headquarters you shape (downtown tower, suburban campus or city block) with amenities. Locals who like or dislike each company. Pops that grow, migrate and retrain. A real election cycle on the 435 real House districts. Acquisitions that need board approval and can draw an antitrust second request.

**Since v0.3:** new candidates are named from the Football Coach / College Manager name pools (plus hand-typed women's names), matched to the background mix of their state. Quality-of-life additions: the game pauses on the events you pick (elections, laws, your deals, earnings, tier changes, recessions), a clickable list of things that need attention under the tabs, a Settings panel with autosave frequency, more keyboard shortcuts, event-log filters and search, a Best city button, and build choices that stick when you switch tabs.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` produces one self-contained `dist/index.html` that you can host anywhere. Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

Controls: <kbd>Space</kbd> pauses, <kbd>1</kbd>–<kbd>5</kbd> set the speed, <kbd>.</kbd> advances a day, <kbd>[</kbd> and <kbd>]</kbd> switch tabs, <kbd>?</kbd> opens Settings. The game autosaves to your browser every quarter by default; use **Export** to keep a save file.

## How it works

| System | What it does | Code |
|---|---|---|
| **Pops** | About 5,000 pops (state × culture × job) built by raking state demographics against state job mixes (iterative proportional fitting). Each pop has workers, dependents and a market wage. | `src/sim/pops.ts`, `src/sim/data/{states,cultures,jobs}.ts` |
| **Cities** | About 160 labor markets: real metros plus a "rest of state" area for each state. Each city has its own cost of living, tech and manufacturing depth, tax breaks, permit speed, local minimum wage, union strength, power price and grid capacity. Cities can pass data-center moratoriums when the grid fills up, and lift them later. The Build panel compares every city on hireable workers, wages, cost, build time, local opinion and power. | `src/sim/geo.ts`, `src/sim/data/cities.ts` |
| **Local opinion** | Every city holds an opinion of every company. Hiring, local investment and HQ amenities raise it; layoffs, closures and straining the grid lower it. Opinion changes who applies, how fast permits clear, whether you get incentives, and below 15% the city denies permits outright. | `opinionOf`, `permitMult` in `geo.ts` |
| **Labor market** | One labor pool per city × job. Companies compete for free workers each month, weighted by wage offer, how the job and the city feel about them, and the HQ. Hiring a big share of a pool, or running short of workers, pushes local wages up. | `updateLabor` in `engine.ts` |
| **Population** | Pops grow, move between states toward jobs and wages, drift between cities, and retrain up job ladders (for example, technicians to engineers) when demand is high. | `src/sim/population.ts` |
| **Headquarters** | A specific building in a specific city: a downtown tower, a suburban campus or a city block. Nine amenities (cafeteria, childcare, innovation lab, public plaza, commuter shuttles and more) each change hiring, research, admin capacity, reputation or local opinion, with upkeep that scales with HQ size. You can relocate. | `src/sim/hq.ts`, `src/ui/tabs/Headquarters.tsx` |
| **Buildings** | HQ, R&D labs, assembly plants, chip fabs, hardware design centers, battery plants, auto plants, software studios, data centers and analytics offices. Each has levels (about 100 staff each) and production methods, such as manual or automated lines. | `src/sim/data/buildings.ts` |
| **Goods & supply chains** | Parts → chips → AI accelerators → cloud → data platforms; batteries + chips → EVs; and so on. Inputs come from your own stock first, then the cheapest US seller, then imports. | `src/sim/data/goods.ts`, `produce` in `engine.ts` |
| **Needs** | Pops split their income across eight needs (food, energy, healthcare, clothing, transport, communication, computing, entertainment). Basic needs take more of a small paycheck. Goods compete within a need (EVs vs gas cars). How well needs are met gives each pop a standard of living, which drives politics. | `src/sim/consumers.ts`, `src/sim/data/needs.ts` |
| **Markets** | Demand comes from pops (weighted by income) plus the rest of the world. Buyers split it by quality² × reputation × brand awareness × price. An unmodeled "everyone else" competes in every market. | `clearMarket` in `engine.ts` |
| **Politics** | Democratic and Republican parties (simplified platforms); elections every two years, decided by occupation-based leanings, living standards, presidential approval and donations. Nine laws (tax, minimum wage, tariffs, antitrust, subsidies, immigration, unions, privacy, climate) with real effects. One bill at a time moves through Congress; lobbying speeds it up or kills it. | `src/sim/politics.ts`, `src/sim/data/laws.ts` |
| **Congress** | The real 535 members seated on 1 January 2026 (from the open [congress-legislators](https://github.com/unitedstates/congress-legislators) dataset), each with a game faction: socialist, progressive, liberal, moderate or Blue Dog Democrat; moderate, corporate, MAGA, populist or libertarian Republican. Members vote their faction's positions; the Senate needs 60 votes except for tax and subsidy bills (reconciliation); presidents veto. Every House seat and a third of the Senate are contested each cycle, seat by seat. State legislatures shift with the national mood. Companies can register a PAC to back or oppose members, who then lean toward the company's lobbying when a vote is close. Regenerate with `scripts/build_congress.py`. | `src/sim/congress.ts`, `src/sim/data/congress.ts`, `src/sim/data/factions.ts` |
| **Macro** | Output gap with random recessions, inflation, a Fed that sets rates (which feed into borrowing costs and valuations), and world events like chip shortages, oil spikes and AI frenzies. | `src/sim/macro.ts` |
| **Research** | Seven tech tracks. Each level above the market baseline means about 8% better products. The baseline rises one level a year. | `research` in `engine.ts` |
| **Finance** | Daily cash flows, monthly books, quarterly earnings vs Wall Street expectations, dividends, a revolving credit line, debt covenants (six months over the limit means default), share issuance, buybacks. Market cap comes from earnings and sales multiples driven by growth and interest rates, times investor sentiment. | `closeMonth`, `earnings`, `fundamentalValue` |
| **Tiers** | Startup → Small → Mid → Large → Mega Cap → Titan. You're ranked against every company in your tier. | `src/sim/tiers.ts` |
| **Elections** | Each of the 435 House districts starts from its real 2024 presidential vote and the incumbent's 2024 overperformance. The 2026 Senate map includes real retirements and the Florida and Ohio specials. Primaries follow the state calendar and can unseat incumbents; races carry Safe, Likely, Lean or Toss-up ratings that move with the national environment. Presidential years use the Electoral College. | `src/sim/elections.ts`, `src/sim/data/districts.ts` |
| **M&A** | You make an offer at a premium you choose. The target's board wants more from a bigger buyer and from a company that's doing well. Big or overlapping deals draw a regulatory second request that can take months and block the deal, especially under strict antitrust law or a populist or progressive Congress. A blocked deal costs a 4% break fee. | `src/sim/deals.ts`, `offer` in `actions.ts` |
| **Rivals** | AI companies price to clear their stock, expand when they sell out, keep R&D and HQ in step with their size, borrow, buy back stock and make acquisitions. New startups appear over time. | `src/sim/ai.ts` |

The simulation in `src/sim` is plain TypeScript with no UI dependencies, and it is deterministic for a given seed. The UI in `src/ui` is React.

## Data

The state demographics in `src/sim/data/states.ts` are **approximate**, typed in by hand. To switch to real census data:

1. Download ACS PUMS person files from the [Census Bureau](https://www.census.gov/programs-surveys/acs/microdata/access.html) or make an extract on [IPUMS USA](https://usa.ipums.org) with `ST, PWGTP, ESR, HISP, RAC1P, RAC2P, OCCP`.
2. `python3 scripts/pums_to_pops.py data/raw/psam_p*.csv`
3. Rebuild. The script writes `src/sim/data/popsOverride.ts`, and the game uses it automatically.

Check the race and occupation code lists in the script against the data dictionary for the survey year you download.

House district results for 2024 come from [jaytimm/PresElectionResults](https://github.com/jaytimm/PresElectionResults) and the [MIT Election Data and Science Lab](https://electionlab.mit.edu); regenerate with `scripts/build_districts.py`. The game uses the 2024 district lines and does not model the 2025–26 mid-decade redistricting. NY-21's figures are estimated. 2026 challengers and open-seat nominees are generated from the name pools (`scripts/build_names.py`). City figures are rough.

Starting company financials are rough mid-2020s figures for each company's real-world counterpart. All companies are fictional. Politicians are real people at game start, portrayed as satire; factions are the game's shorthand, assigned by hand from caucus membership and public positioning (see `scripts/build_congress.py`), and state legislature seat counts are approximate.

## Developing

```bash
npm test                          # simulation tests
npm run calibrate -- 5            # run the economy headlessly for 5 years and print every company
npx tsx scripts/botplay.ts software 8   # watch a crude aggressive player grow a startup
```

## Roadmap ideas

- Regional logistics and shipping costs ("deliver to customers")
- Real 2026 nominees and the new mid-decade district maps
- Deeper politics: interest groups, regulators, scandals
- More sectors: defense, retail, banking, telecom
- Contract manufacturing (outsourcing to an Asian supplier)
- Executives and a board of directors
