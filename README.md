# American Century

A Victoria 3–style grand strategy game about running a company in the modern United States.

You play as a corporation: a fictional take on an Apple, Microsoft, Nvidia, Tesla or Palantir, or a startup you found yourself. You hire workers from census-based **pops** ("Indian American software developers from Texas", "White engineers from Missouri"), build plants across all 50 states, sell into markets against rivals, research better products, climb the market-cap tiers and buy out the competition.

Deep and spreadsheet-y, but fast: daily ticks, five game speeds, and everything runs in the browser.

**New in v0.2:** daily ticks · pop needs and standard of living · 29 starting companies across tech, autos, food, apparel, media, pharma and energy · basic politics (two parties, elections, nine laws, bills, lobbying, donations) · business cycle with Fed rates and world events · quarterly earnings vs. expectations · dividends · per-building profit.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` produces one self-contained `dist/index.html` that you can host anywhere. Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

Controls: <kbd>Space</kbd> pauses, <kbd>1</kbd>–<kbd>5</kbd> set the speed. The game autosaves to your browser every January; use **Export** to keep a save file.

## How it works

| System | What it does | Code |
|---|---|---|
| **Pops** | About 5,000 pops (state × culture × job) built by raking state demographics against state job mixes (iterative proportional fitting). Each pop has workers, dependents and a market wage. | `src/sim/pops.ts`, `src/sim/data/{states,cultures,jobs}.ts` |
| **Labor market** | One labor pool per state × job. Companies compete for roughly 5% of each pool's free workers a month, weighted by wage offer. Hiring a big share of a pool, or running short of workers, pushes local wages up. | `updateLabor` in `engine.ts` |
| **Buildings** | HQ, R&D labs, assembly plants, chip fabs, hardware design centers, battery plants, auto plants, software studios, data centers and analytics offices. Each has levels (about 100 staff each) and production methods, such as manual or automated lines. | `src/sim/data/buildings.ts` |
| **Goods & supply chains** | Parts → chips → AI accelerators → cloud → data platforms; batteries + chips → EVs; and so on. Inputs come from your own stock first, then the cheapest US seller, then imports. | `src/sim/data/goods.ts`, `produce` in `engine.ts` |
| **Needs** | Pops split their income across eight needs (food, energy, healthcare, clothing, transport, communication, computing, entertainment). Basic needs take more of a small paycheck. Goods compete within a need (EVs vs gas cars). How well needs are met gives each pop a standard of living, which drives politics. | `src/sim/consumers.ts`, `src/sim/data/needs.ts` |
| **Markets** | Demand comes from pops (weighted by income) plus the rest of the world. Buyers split it by quality² × reputation × brand awareness × price. An unmodeled "everyone else" competes in every market. | `clearMarket` in `engine.ts` |
| **Politics** | Commonwealth vs Frontier parties; elections every two years, decided by occupation-based leanings, living standards, presidential approval and donations. Nine laws (tax, minimum wage, tariffs, antitrust, subsidies, immigration, unions, privacy, climate) with real effects. One bill at a time moves through Congress; lobbying speeds it up or kills it. | `src/sim/politics.ts`, `src/sim/data/laws.ts` |
| **Macro** | Output gap with random recessions, inflation, a Fed that sets rates (which feed into borrowing costs and valuations), and world events like chip shortages, oil spikes and AI frenzies. | `src/sim/macro.ts` |
| **Research** | Seven tech tracks. Each level above the market baseline means about 8% better products. The baseline rises one level a year. | `research` in `engine.ts` |
| **Finance** | Daily cash flows, monthly books, quarterly earnings vs Wall Street expectations, dividends, a revolving credit line, debt covenants (six months over the limit means default), share issuance, buybacks. Market cap comes from earnings and sales multiples driven by growth and interest rates, times investor sentiment. | `closeMonth`, `earnings`, `fundamentalValue` |
| **Tiers** | Startup → Small → Mid → Large → Mega Cap → Titan. You're ranked against every company in your tier. | `src/sim/tiers.ts` |
| **M&A** | Buy any company at market cap plus a 30% premium, paying in cash or stock. Antitrust blocks deals that would pass 40% combined share. | `acquire` in `actions.ts` |
| **Rivals** | AI companies price to clear their stock, expand when they sell out, keep R&D and HQ in step with their size, borrow, buy back stock and make acquisitions. New startups appear over time. | `src/sim/ai.ts` |

The simulation in `src/sim` is plain TypeScript with no UI dependencies, and it is deterministic for a given seed. The UI in `src/ui` is React.

## Data

The state demographics in `src/sim/data/states.ts` are **approximate**, typed in by hand. To switch to real census data:

1. Download ACS PUMS person files from the [Census Bureau](https://www.census.gov/programs-surveys/acs/microdata/access.html) or make an extract on [IPUMS USA](https://usa.ipums.org) with `ST, PWGTP, ESR, HISP, RAC1P, RAC2P, OCCP`.
2. `python3 scripts/pums_to_pops.py data/raw/psam_p*.csv`
3. Rebuild. The script writes `src/sim/data/popsOverride.ts`, and the game uses it automatically.

Check the race and occupation code lists in the script against the data dictionary for the survey year you download.

Starting company financials are rough mid-2020s figures for each company's real-world counterpart. All companies are fictional.

## Developing

```bash
npm test                          # simulation tests
npm run calibrate -- 5            # run the economy headlessly for 5 years and print every company
npx tsx scripts/botplay.ts software 8   # watch a crude aggressive player grow a startup
```

## Roadmap ideas

- Regional logistics and shipping costs ("deliver to customers")
- Deeper politics: interest groups, state governments and incentive deals, regulators, scandals
- Pop migration, education, unemployment and assimilation over time
- More sectors: defense, retail, banking, telecom
- Contract manufacturing (outsourcing to an Asian supplier)
- Executives and a board of directors
