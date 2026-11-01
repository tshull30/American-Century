// The in-game encyclopedia. Panels link here with a small "?" instead of carrying paragraphs of help text.
// Bodies are short paragraphs; [[topic]] links to another entry.

export interface Topic {
  id: string;
  title: string;
  group: "Basics" | "Company" | "Markets" | "People" | "Politics" | "World";
  body: string[];
}

export const TOPICS: Topic[] = [
  { id: "basics", title: "How to play", group: "Basics", body: [
    "You run one company from January 2026. Every day it hires workers, buys inputs, makes goods and sells them; every month it closes its books; every quarter Wall Street grades it.",
    "Your rank is set by market capitalization against every company in your [[tiers|tier]]. Grow revenue and profits faster than investors expect and the stock follows.",
    "The tabs are your desks: Production to build, Workforce to hire, Markets to price, Leadership for your executives and [[board]], Politics and Elections to work Washington, World to build abroad.",
  ] },
  { id: "tiers", title: "Market-cap tiers", group: "Basics", body: [
    "Startup (under $300M), Small Cap, Mid Cap ($2B), Large Cap ($10B), Mega Cap ($200B) and Titan ($1T). You're ranked against everyone in your tier, and moving up a tier is news.",
  ] },
  { id: "production", title: "Buildings and production", group: "Company", body: [
    "Every building has levels of about a hundred staff each, and one or more production methods. A method sets the staff mix, the output and the inputs; some methods are a different market segment entirely, like fast food versus fine dining.",
    "Efficiency is staffing times headquarters capacity times [[industries|know-how and scale]] times site quality. Wells and farms only go where the resource is; richer reserves pump more, sunnier and windier states get more from solar and wind.",
    "Profit per building is shown before depreciation. R&D labs and headquarters show their cost.",
  ] },
  { id: "industries", title: "Industries, know-how and scale", group: "Company", body: [
    "Each building belongs to an industry. Entering a new one starts you at 20% know-how (more if you're already in a related industry), which means lower output and up to 50% higher running costs. Know-how grows about 4% of the gap each month you operate.",
    "Scale: one level runs at about 78% efficiency, rising to 100% at 150 levels in that industry.",
    "Every industry beyond your second adds 15% to headquarters workload, and investors discount a sprawling company by up to 25%.",
  ] },
  { id: "headquarters", title: "Headquarters", group: "Company", body: [
    "Headquarters houses executives, finance, legal and HR. Each level supports 15 levels of plants and offices; beyond that every building runs below full efficiency. Turn on automatic growth on the Production tab to keep it sized.",
    "The form (tower, campus or block) and its amenities change hiring, research, reputation and how your city feels about you. Amenity costs scale with the size of your headquarters; closing one recovers nothing.",
    "Moving headquarters changes which state taxes your profits, gives you a honeymoon in the new city, and needs the [[board]]'s approval.",
  ] },
  { id: "earnings", title: "Earnings and the stock", group: "Company", body: [
    "Wall Street expects revenue to keep growing at its recent pace. Beating the estimate lifts the stock and investor sentiment; missing knocks them down, up to 8% at a time.",
    "Market value comes from earnings and sales multiples that rise with growth and fall with interest rates, times investor sentiment. Very rich valuations on real profits slowly deflate.",
  ] },
  { id: "credit", title: "Debt and credit", group: "Company", body: [
    "If cash runs out the company draws on its credit line automatically. The limit is 3.5× EBITDA, plus 40% of plant value and 10% of market cap; a good CFO raises it.",
    "Net debt (debt minus cash) above the limit for six months is a default. For you, that's game over.",
  ] },
  { id: "shares", title: "Share issues and buybacks", group: "Company", body: [
    "Issuing shares raises cash without debt but dilutes your ownership and dents investor sentiment. More than 5% at once needs the [[board]].",
    "Buybacks retire shares and return cash; dividends pay out a share of each quarter's profit. Activists often demand one or the other.",
  ] },
  { id: "marketing", title: "Marketing and brand", group: "Company", body: [
    "Marketing multiplies brand awareness, so buyers pick you over rivals at the same price. Diminishing returns: 4% of revenue is typical, 15% is a startup land grab.",
    "Brand awareness drifts toward your share of supply. An unknown seller can't charge more than the market; better quality, reputation or a strong brand earns a premium.",
  ] },
  { id: "research", title: "Research", group: "Company", body: [
    "Every tech level above the market baseline makes products about 8% better, and buyers weigh quality squared. The market improves one level a year, so standing still means falling behind.",
    "Bigger product lines cost more research per level, and every level of lead costs 40% more. Labs and a strong CTO drive output.",
  ] },
  { id: "acquisitions", title: "Acquisitions", group: "Company", body: [
    "Click a company on the Rivals tab to make an offer. Its board wants a premium: more for startups, hot stocks and established companies, and more from a much bigger buyer. A dealmaker CEO or CFO shaves it.",
    "Regulators may open a second request, an in-depth review lasting months, and can sue to block. Big buyers, overlapping markets, strict antitrust law and a populist or progressive Congress all raise the odds. A blocked deal costs a 4% break fee.",
    "Cash deals must still be fundable at closing; stock deals can't issue more than 30% new shares. Deals worth over 5% of your company need your own [[board]].",
  ] },
  { id: "executives", title: "Executives", group: "People", body: [
    "Five seats: the CEO (valuation, image, the board's trust), CFO (borrowing costs and credit), COO (output per worker), CTO (research) and CMO (marketing reach). Skill runs from one to five stars; an empty seat is worse than a bad executive.",
    "Traits change things further: a Visionary boosts research, a Cost cutter trims running costs but annoys workers, a Dealmaker gets cheaper acquisitions, a Celebrity sells but courts scandal.",
    "Hiring pays a signing bonus of a quarter of a year's pay; replacing or firing someone pays a year's severance. Rivals try to poach your best people; match their offer or let them go.",
  ] },
  { id: "board", title: "The board of directors", group: "People", body: [
    "The board approves acquisitions worth more than 5% of your company, share issues over 5%, headquarters moves, and projects costing more than 15% of your market value.",
    "Its confidence follows your stock against your tier, your CEO and scandals. At the spring annual meeting unhappy shareholders replace directors, and a board that has lost faith fires the CEO.",
    "See also [[activists]].",
  ] },
  { id: "activists", title: "Activist investors", group: "People", body: [
    "When a stock lags its peers, a fund may buy a stake and demand a buyback, a bigger dividend, cost cuts or a new CEO.",
    "Give them what they want and they stand down. Ignore them and they run their own slate at the annual meeting; win a majority of the board and they force their demand through and install a new CEO.",
  ] },
  { id: "wages", title: "Hiring and wages", group: "People", body: [
    "About 5% of each local pool's free workers can be hired a month. Paying above market wins a bigger share; so do workers and towns that like you, and HQ perks.",
    "Hiring a big share of a local workforce, or running short of workers, pushes wages up for everyone there. Unions, local minimum wages and the national mood move wages too.",
  ] },
  { id: "worker-opinion", title: "What workers think of you", group: "People", body: [
    "Each kind of worker holds an opinion of your company, and it changes who applies. Above-market pay and HQ perks help; layoffs, offshoring and overcharging for necessities hurt, especially with service workers, laborers and clerks.",
  ] },
  { id: "pops", title: "Pops", group: "People", body: [
    "About 11,000 pops: groups of people who share a home county, a background and a job. Each earns local wages, spends across its needs, votes, migrates toward opportunity and retrains up job ladders.",
    "Immigrants join pops of their community each year; the number moves with immigration law.",
  ] },
  { id: "consumers", title: "Needs and standard of living", group: "Markets", body: [
    "Each pop splits its income across needs. Basic needs (food, energy, fuel, healthcare, clothing, household goods) take a bigger share of a small paycheck; transport, housing, computing and entertainment grow with income.",
    "Within a need goods compete: gas cars against EVs, fast food against fine dining. Premium segments draw richer pops. How well needs are met gives each pop a standard of living, which drives politics.",
  ] },
  { id: "markets", title: "Markets and prices", group: "Markets", body: [
    "Demand comes from pops (for household goods), from businesses (sized by the workers they employ and their pay), and from the rest of the world. Buyers weigh quality, brand, reputation and price.",
    "An unmodeled crowd of other sellers competes in every market and cuts prices when you take its share.",
    "Materials and parts: US companies buy from the cheapest American seller priced below the import price, then import the rest. Surplus is sold on the world market.",
  ] },
  { id: "cities", title: "Cities and counties", group: "World", body: [
    "Every metro and region is its own labor market with its own wages, taxes, permits, unions, power grid and politics. Councils lean left or right with a libertarian streak, and that sets tax breaks, permit speed, wage floors and data-center rules.",
    "Residents judge you: left-leaning towns reward companies that lobby and give like Democrats and build solar and EVs, and punish oil and gas; right-leaning towns like factories and fields; libertarian towns dislike subsidy hunters. Hostile towns slow your permits and eventually refuse them.",
  ] },
  { id: "world", title: "Building abroad", group: "World", body: [
    "Plants abroad pay local wages and get local incentives, but produce less per worker, and everything they sell into the US pays tariffs and freight.",
    "Mexico and Canada are duty-free under USMCA until tariffs get heavy. China pays extra duties and can't host chip, AI or research work. Offshoring costs you goodwill with American factory workers and towns.",
  ] },
  { id: "elections", title: "Elections", group: "Politics", body: [
    "Every House seat starts from its district's real 2024 presidential result (2024 lines; the 2025–26 redistricting isn't modeled), plus the incumbent's personal vote. Senate seats use the state result. Ratings move with the national mood and PAC money.",
    "Primaries follow each state's calendar. Incumbents rarely lose, but moderates in deep-red or deep-blue seats are vulnerable. On election night each race lands near its projection, plus a shared national polling miss.",
  ] },
  { id: "congress", title: "Congress and bills", group: "Politics", body: [
    "The House majority brings up bills from its platform, plus any bill with enough lobbying behind it. Members vote their faction's position; the mildly opposed can be moved by lobbying, and members your PAC backed lean your way.",
    "The Senate needs 60 votes, except for tax and subsidy bills passed by reconciliation. Presidents veto bills they oppose. Factions are the game's shorthand; politicians appear as satire.",
  ] },
  { id: "lobbying", title: "Lobbying and donations", group: "Politics", body: [
    "Lobbying is a monthly expense whose pull grows with the square root of spending: $40M a month is only twice as persuasive as $10M. A politically connected CEO makes it go further.",
    "Party donations shift the national vote by up to about 2.5 points, with sharply diminishing returns, and reset after every election.",
  ] },
  { id: "pac", title: "Super PACs", group: "Politics", body: [
    "A PAC spends directly on congressional races. Each click spends $1M in a House race or $5M in a Senate race and moves the next election by up to 4 points. Members you back lean toward your lobbying when a vote is close.",
  ] },
  { id: "events", title: "News and decisions", group: "Basics", body: [
    "Big news arrives as a front page. Some stories need a decision: recall or quietly fix, recognize the union or fight it, settle or go to court. Choices have costs now and consequences later.",
    "Pick what pauses the game in Settings.",
  ] },
];

export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
