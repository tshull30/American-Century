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
    "The game covers the whole economy: factories, mines and farms; banks, insurers and payment networks; hospitals, clinics and health plans; big-box stores, supermarkets, e-commerce and gas stations; hotels, cruise lines, casinos, theme parks and sports teams; universities and child care; landlords, utilities, railroads and law, consulting and accounting firms.",
    "Stores, restaurants and service businesses buy what they sell from manufacturers, or from the wholesale market when no company in the game makes it.",
  ] },
  { id: "headquarters", title: "Headquarters", group: "Company", body: [
    "Headquarters houses executives, finance, legal and HR. Each level supports 15 levels of plants and offices; beyond that every building runs below full efficiency. Turn on automatic growth on the Production tab to keep it sized.",
    "The form (tower, campus or block) and its amenities change hiring, research, reputation and how your city feels about you. Amenity costs scale with the size of your headquarters; closing one recovers nothing.",
    "Moving headquarters changes which state taxes your profits, gives you a honeymoon in the new city, and needs the [[board]]'s approval.",
  ] },
  { id: "earnings", title: "Earnings and the stock", group: "Company", body: [
    "Every quarter you report revenue and net income against Wall Street's estimates. Analysts compare with the same quarter a year earlier, project last year's growth rate forward, and apply the profit margin of your last two quarters. They aim a little low, as companies guide them to.",
    "Within 1% either way the results are in line and the stock barely moves. A clear beat lifts the stock and investor sentiment; a miss knocks them down, up to 8% at a time. A miss is not a loss: a company earning billions can still miss if it grew more slowly than expected. The header's Profit last month shows what you actually earned.",
    "After each report analysts move their growth estimate halfway toward what actually happened.",
    "Market value comes from earnings and sales multiples that rise with growth and fall with interest rates, times investor sentiment. Very rich valuations on real profits slowly deflate.",
  ] },
  { id: "credit", title: "Debt and credit", group: "Company", body: [
    "If cash runs out the company draws on its credit line automatically. The limit is 3.5× EBITDA, plus 40% of plant value and 10% of market cap; a good CFO raises it.",
    "Net debt (debt minus cash) above the limit for six months is a default. For you, that's game over.",
    "Rating agencies grade every company from AAA to C on net leverage, size and distress. The rating sets your spread over the Fed's rate, from half a point at AAA to twelve at C. Falling below BBB (to junk) knocks the stock too. Licensing patents counts as revenue.",
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
    "Every tech level above the market baseline makes products about 8% better, and buyers weigh quality squared. The market improves one level a year, so standing still means falling behind, though industry spillover keeps even a company with no lab within about a level of the frontier.",
    "Bigger product lines cost more research per level, and every level of lead costs 40% more. Labs and a strong CTO drive output.",
  ] },
  { id: "people", title: "People", group: "Company", body: [
    "Everyone in the game has views on five issues (the economy, labor, climate, trade and Big Tech) and an opinion of your company. The People tab lists your team, rival CEOs and members of Congress, with the reasons behind each opinion.",
    "Members of Congress care about jobs you provide in their state, layoffs there, which way you lobby on the laws they care about, your PAC's money, offshoring, your energy footprint, Big Tech's power and your public image. Members who like you lean your way on close votes you lobby for. Hostile members may call you to testify; a skilled CEO can turn a hearing into good press. Meet them (three meetings a month) or invite them to cut a ribbon at a site in their state.",
    "Members of Congress are real people; their stances come from the game's model of their caucus faction, not from anything they've said. Executives and rival CEOs are fictional.",
    "Rival CEOs resent you for competing head to head, undercutting their prices and hiring away their people, and respect success and a CEO who sees the world as they do. A CEO who can't stand you starts a feud and undercuts your prices; one who likes you may propose a two-year partnership (+5% research and marketing for both), and their board accepts a lower takeover premium. Play golf, propose a truce, or take a public jab if your CEO is a showman.",
    "Your executives have morale. Pay below the market rate, a sinking stock, a nervous board, and company moves that cut against their beliefs all lower it. Unhappy executives are easier to poach, ask for raises and sometimes quit; happy ones perform a little better.",
  ] },
  { id: "guidance", title: "Earnings guidance", group: "Company", body: [
    "Each quarter you can tell Wall Street what to expect. Bold guidance lifts the stock now and raises the bar by 3%; lowball guidance dips the stock and lowers the bar. You can change it once a quarter, and switching back undoes the move. See [[earnings]].",
  ] },
  { id: "moonshots", title: "Moonshots", group: "Company", body: [
    "Moonshots are multi-year bets: fusion, self-driving, quantum computing, humanoid robots, a cure for Alzheimer's, general AI and a crewed Mars mission. Each burns hundreds of millions a month and takes years. When the program finishes, the prototype gets one test: if it works, the payoff is permanent; if not, the team goes back to about half way and tries again with better odds.",
    "Lean funding costs half and goes at 60% speed; a crash program costs double for 60% more speed but slightly worse odds. A strong CTO speeds things up. You can run two at once, and the richest rivals run their own.",
  ] },
  { id: "launches", title: "Launch events", group: "Company", body: [
    "Hold a keynote for any product with a technology behind it. The outcome depends mostly on how your product compares with the market's, plus your CMO, your CEO and luck. A careful reveal is a modest bet; promising the moon multiplies both the win and the embarrassment. Once every nine months per product.",
  ] },
  { id: "posts", title: "Your CEO's feed", group: "Company", body: [
    "Once a month your CEO can post. Hyping the roadmap lifts the stock, more for a celebrity or visionary, but sometimes draws a letter from the SEC. Thanking workers helps your image and how workers see you. Dunking on your biggest rival goes viral or looks petty, and that rival's CEO won't forget.",
  ] },
  { id: "hq2", title: "Second headquarters", group: "Company", body: [
    "Companies worth $150 billion or more can announce a search for a second headquarters. Cities bid cash and tax breaks for three months; then you pick from the four best offers. The winner gets five headquarters levels and a lot of goodwill; the losing finalists sulk a little.",
  ] },
  { id: "setup", title: "Scenarios, difficulty and goals", group: "Basics", body: [
    "Scenarios change the world you start in: a blockade of Taiwan, a market crash and recession, a climate law, aggressive antitrust, an AI spending boom or a tariff wall.",
    "Chairman difficulty gives you more money, a patient board and kinder analysts; Activist season gives you less money, analysts who expect more, a twitchy board and rivals that run 4% leaner.",
    "Goals give the game a finish line, such as becoming a Titan or America's most valuable company by 2036. Win or miss, you can keep playing. The start screen keeps a record of the companies you've run.",
    "Every front page is kept in the archive on the Events tab.",
  ] },
  { id: "local", title: "States and cities", group: "Politics", body: [
    "Every city and region has a mayor (or commission chair) and a council of five to nine members, each with a party, beliefs, a temperament and an opinion of you. Councils propose ordinances and vote on them two months later; the mayor can veto unless two thirds of the council passed it. Ordinances are how local policy changes: minimum wages, tax abatements, permitting reform, data-center moratoriums and incentives, water rules, oil and gas bans, labor-peace rules and a per-worker head tax on big employers.",
    "You can lobby any pending vote (dealmakers listen; ideologues mostly don't; populists hold it against you), ask a council for an incentive deal (an extra 12% abatement on your projects there), meet officials, and fund their campaigns or their opponents'. Half of each council stands for election every two years.",
    "States have a governor and a legislature. Bills on right-to-work, the state minimum wage, corporate tax, data-center tax exemptions and megaproject funds pass or fail on the legislature's makeup and the governor's pen. State minimum wages set the floor in every city; your headquarters state's corporate tax applies to your profits.",
    "Mayors, council members and governors are fictional. Members of Congress are real.",
  ] },
  { id: "portfolio", title: "Stock portfolio", group: "Company", body: [
    "Buy stakes of up to 20% in any public company with spare cash. You collect their dividends and gain or lose as their stock moves. A stake also comes off the price if you later buy the whole company, the classic toehold. Cross 5% and you have to disclose it; their CEO won't love it.",
  ] },
  { id: "foundation", title: "The foundation", group: "Company", body: [
    "Fund causes each month: schools, climate, hometown grants, hospitals or veterans. Giving improves your public image and has its own effects: hometown grants win over cities and councils, climate giving pleases green politicians and executives and annoys their opposites, veterans' charities please conservatives. The effect grows with the square root of the money, relative to your size.",
  ] },
  { id: "rankings", title: "The American 500", group: "Company", body: [
    "Every January the game ranks every company by revenue, as a place to work (pay, how workers and executives feel) and by admiration (image, size, achievements and credit). Top spots make the front page.",
  ] },
  { id: "antitrust", title: "Antitrust suits", group: "Politics", body: [
    "Hold 45% of a market (35% under strict antitrust law) and the Justice Department may sue. Settling costs a fine and puts a three-year cap on your price in that market. Fighting takes a year: win and it's over, lose and it's a bigger fine and a forced sale of 30% of the business. Or offer to sell a quarter of it up front.",
  ] },
  { id: "takeovers", title: "Hostile bids", group: "Company", body: [
    "When a company six times your size with deep pockets sees a bargain (especially when your board is unhappy), it may bid for you directly. A poison pill works if the board backs you. A white knight needs a partner or a rival CEO who likes you. Or sell: the game ends, and you go out rich.",
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
