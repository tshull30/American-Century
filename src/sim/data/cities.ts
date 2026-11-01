// Metro areas where companies can build. Populations are the approximate in-state
// part of each metro (millions, mid-2020s). Indices are hand-set game values:
//   tech / mfg: concentration of tech and manufacturing work vs the US (1 = average)
//   col: cost of living and wages vs the US
// Flags: tower (can host a skyscraper HQ), univ (research universities), port,
//   water (water-stressed), union (strong unions), dc+ (courts data centers), dc- (wary of them).
// Every state also gets a "rest of state" area for everything outside these metros.

export type CityFlag = "tower" | "univ" | "port" | "water" | "union" | "dc+" | "dc-";

export interface CitySeed {
  id: string;
  name: string;
  state: string;
  pop: number;
  lat: number;
  lon: number;
  tech: number;
  mfg: number;
  col: number;
  flags: CityFlag[];
  /** Local minimum wage per month, if above the state/federal floor. */
  minWage?: number;
}

type Row = [string, string, string, number, number, number, number, number, number, string, number?];

const ROWS: Row[] = [
  ["nyc", "New York City", "NY", 12.6, 40.71, -74.01, 1.5, 0.6, 1.55, "tower univ port union", 2855],
  ["la", "Los Angeles", "CA", 12.8, 34.05, -118.24, 1.3, 1.1, 1.45, "tower port union water", 3110],
  ["chicago", "Chicago", "IL", 8.5, 41.88, -87.63, 1.2, 1.1, 1.15, "tower univ port union", 2870],
  ["dallas", "Dallas–Fort Worth", "TX", 8.1, 32.78, -96.8, 1.3, 1.1, 1.0, "tower dc+"],
  ["houston", "Houston", "TX", 7.5, 29.76, -95.37, 1.1, 1.3, 0.98, "tower port"],
  ["dc", "Washington", "DC", 0.68, 38.9, -77.04, 1.7, 0.2, 1.5, "tower univ", 3105],
  ["nova", "Northern Virginia", "VA", 2.6, 39.04, -77.49, 2.0, 0.4, 1.35, "dc+ univ"],
  ["philly", "Philadelphia", "PA", 4.9, 39.95, -75.17, 1.2, 1.0, 1.15, "tower univ port union"],
  ["miami", "Miami", "FL", 6.2, 25.76, -80.19, 1.0, 0.6, 1.2, "tower port"],
  ["atlanta", "Atlanta", "GA", 6.3, 33.75, -84.39, 1.3, 1.0, 1.02, "tower univ dc+"],
  ["boston", "Boston", "MA", 4.4, 42.36, -71.06, 2.0, 0.9, 1.45, "tower univ port"],
  ["phoenix", "Phoenix", "AZ", 5.1, 33.45, -112.07, 1.2, 1.2, 1.02, "water dc+"],
  ["sf", "San Francisco Bay", "CA", 4.6, 37.77, -122.42, 2.6, 0.8, 1.7, "tower univ port", 3320],
  ["inland", "Inland Empire", "CA", 4.7, 34.06, -117.18, 0.7, 1.3, 1.15, "water"],
  ["detroit", "Detroit", "MI", 4.3, 42.33, -83.05, 1.0, 2.0, 0.98, "union port"],
  ["seattle", "Seattle", "WA", 4.1, 47.61, -122.33, 2.4, 1.1, 1.45, "tower univ port", 3590],
  ["minneapolis", "Minneapolis–St. Paul", "MN", 3.7, 44.98, -93.27, 1.3, 1.3, 1.1, "tower univ", 2765],
  ["sandiego", "San Diego", "CA", 3.3, 32.72, -117.16, 1.6, 1.0, 1.4, "univ port water"],
  ["tampa", "Tampa Bay", "FL", 3.3, 27.95, -82.46, 1.0, 0.8, 1.0, "port"],
  ["denver", "Denver", "CO", 3.0, 39.74, -104.99, 1.6, 0.8, 1.15, "tower water", 3250],
  ["baltimore", "Baltimore", "MD", 2.8, 39.29, -76.61, 1.3, 0.8, 1.1, "univ port"],
  ["stlouis", "St. Louis", "MO", 2.2, 38.63, -90.2, 1.0, 1.2, 0.92, "univ"],
  ["orlando", "Orlando", "FL", 2.8, 28.54, -81.38, 1.0, 0.8, 0.98, ""],
  ["charlotte", "Charlotte", "NC", 2.8, 35.23, -80.84, 1.2, 1.2, 0.98, "tower"],
  ["sanantonio", "San Antonio", "TX", 2.7, 29.42, -98.49, 1.0, 1.0, 0.92, "dc+"],
  ["portland", "Portland", "OR", 2.0, 45.52, -122.68, 1.5, 1.3, 1.15, "univ", 2820],
  ["sacramento", "Sacramento", "CA", 2.4, 38.58, -121.49, 1.0, 0.8, 1.2, "water"],
  ["pittsburgh", "Pittsburgh", "PA", 2.4, 40.44, -80.0, 1.3, 1.2, 0.95, "univ union"],
  ["austin", "Austin", "TX", 2.5, 30.27, -97.74, 2.2, 1.2, 1.12, "univ dc+"],
  ["lasvegas", "Las Vegas", "NV", 2.3, 36.17, -115.14, 0.8, 0.6, 1.0, "water"],
  ["cincinnati", "Cincinnati", "OH", 1.8, 39.1, -84.51, 1.0, 1.4, 0.92, ""],
  ["kc", "Kansas City", "MO", 1.4, 39.1, -94.58, 1.1, 1.1, 0.93, ""],
  ["columbus", "Columbus", "OH", 2.2, 39.96, -83.0, 1.3, 1.3, 0.95, "univ dc+"],
  ["indianapolis", "Indianapolis", "IN", 2.1, 39.77, -86.16, 1.0, 1.7, 0.92, ""],
  ["cleveland", "Cleveland", "OH", 2.2, 41.5, -81.69, 1.0, 1.6, 0.92, "union port"],
  ["sanjose", "San Jose", "CA", 2.0, 37.34, -121.89, 3.0, 1.6, 1.75, "univ", 3190],
  ["nashville", "Nashville", "TN", 2.1, 36.16, -86.78, 1.2, 1.3, 1.0, "tower"],
  ["vabeach", "Virginia Beach–Norfolk", "VA", 1.8, 36.85, -76.29, 0.9, 1.0, 0.98, "port"],
  ["providence", "Providence", "RI", 1.1, 41.82, -71.41, 1.0, 1.0, 1.05, "univ"],
  ["jacksonville", "Jacksonville", "FL", 1.7, 30.33, -81.66, 0.9, 0.9, 0.95, "port"],
  ["milwaukee", "Milwaukee", "WI", 1.6, 43.04, -87.91, 1.0, 1.8, 0.95, "union"],
  ["raleigh", "Raleigh–Durham", "NC", 2.2, 35.78, -78.64, 2.0, 1.2, 1.02, "univ"],
  ["okc", "Oklahoma City", "OK", 1.5, 35.47, -97.52, 0.8, 1.1, 0.88, "dc+"],
  ["memphis", "Memphis", "TN", 1.3, 35.15, -90.05, 0.8, 1.2, 0.88, "port dc-"],
  ["richmond", "Richmond", "VA", 1.3, 37.54, -77.44, 1.0, 1.0, 0.98, "dc+"],
  ["louisville", "Louisville", "KY", 1.3, 38.25, -85.76, 0.9, 1.6, 0.9, ""],
  ["neworleans", "New Orleans", "LA", 1.0, 29.95, -90.07, 0.8, 1.0, 0.92, "port"],
  ["saltlake", "Salt Lake City", "UT", 1.3, 40.76, -111.89, 1.5, 1.2, 1.02, "water dc+"],
  ["hartford", "Hartford", "CT", 1.2, 41.77, -72.67, 1.1, 1.3, 1.12, "union"],
  ["buffalo", "Buffalo", "NY", 1.2, 42.89, -78.88, 0.8, 1.2, 0.9, "union"],
  ["birmingham", "Birmingham", "AL", 1.1, 33.52, -86.8, 0.8, 1.4, 0.86, ""],
  ["rochester", "Rochester", "NY", 1.1, 43.16, -77.61, 1.1, 1.3, 0.92, "univ"],
  ["grandrapids", "Grand Rapids", "MI", 1.1, 42.96, -85.67, 0.8, 1.9, 0.9, ""],
  ["tucson", "Tucson", "AZ", 1.1, 32.22, -110.97, 1.0, 1.1, 0.92, "univ water dc-"],
  ["tulsa", "Tulsa", "OK", 1.0, 36.15, -95.99, 0.8, 1.3, 0.87, ""],
  ["fresno", "Fresno", "CA", 1.2, 36.74, -119.79, 0.6, 1.1, 1.0, "water"],
  ["honolulu", "Honolulu", "HI", 1.0, 21.31, -157.86, 0.8, 0.4, 1.55, "tower port"],
  ["worcester", "Worcester", "MA", 1.0, 42.26, -71.8, 1.2, 1.2, 1.15, ""],
  ["omaha", "Omaha", "NE", 1.0, 41.26, -95.93, 1.0, 1.1, 0.92, "dc+"],
  ["bridgeport", "Stamford–Bridgeport", "CT", 1.0, 41.05, -73.54, 1.3, 1.0, 1.4, ""],
  ["greenville", "Greenville–Spartanburg", "SC", 1.0, 34.85, -82.4, 0.8, 1.9, 0.88, ""],
  ["albuquerque", "Albuquerque", "NM", 0.92, 35.08, -106.65, 1.1, 0.8, 0.9, "water"],
  ["bakersfield", "Bakersfield", "CA", 0.92, 35.37, -119.02, 0.5, 1.0, 0.98, "water"],
  ["albany", "Albany", "NY", 0.9, 42.65, -73.75, 1.1, 1.1, 0.98, "univ"],
  ["knoxville", "Knoxville", "TN", 0.9, 35.96, -83.92, 0.9, 1.3, 0.88, "univ"],
  ["elpaso", "El Paso", "TX", 0.87, 31.76, -106.49, 0.7, 1.1, 0.85, "water"],
  ["batonrouge", "Baton Rouge", "LA", 0.87, 30.45, -91.15, 0.8, 1.5, 0.9, "port"],
  ["mcallen", "McAllen", "TX", 0.89, 26.2, -98.23, 0.5, 0.8, 0.8, ""],
  ["boise", "Boise", "ID", 0.83, 43.62, -116.2, 1.2, 1.2, 0.98, ""],
  ["columbia", "Columbia", "SC", 0.85, 34.0, -81.03, 0.8, 1.2, 0.86, ""],
  ["charleston", "Charleston", "SC", 0.83, 32.78, -79.93, 0.9, 1.4, 0.98, "port"],
  ["desmoines", "Des Moines", "IA", 0.72, 41.59, -93.62, 1.0, 1.0, 0.9, "dc+"],
  ["littlerock", "Little Rock", "AR", 0.76, 34.75, -92.29, 0.8, 1.0, 0.85, ""],
  ["wichita", "Wichita", "KS", 0.65, 37.69, -97.34, 0.8, 1.9, 0.86, ""],
  ["madison", "Madison", "WI", 0.69, 43.07, -89.4, 1.6, 1.0, 1.0, "univ"],
  ["huntsville", "Huntsville", "AL", 0.53, 34.73, -86.59, 1.8, 1.5, 0.92, "univ"],
  ["chattanooga", "Chattanooga", "TN", 0.58, 35.05, -85.31, 0.8, 1.6, 0.87, ""],
  ["reno", "Reno", "NV", 0.5, 39.53, -119.81, 1.0, 1.3, 1.02, "water dc+"],
  ["spokane", "Spokane", "WA", 0.6, 47.66, -117.43, 0.9, 1.1, 0.95, ""],
  ["coloradosprings", "Colorado Springs", "CO", 0.78, 38.83, -104.82, 1.2, 0.8, 1.0, "water"],
  ["lexington", "Lexington", "KY", 0.52, 38.04, -84.5, 0.9, 1.6, 0.88, "univ"],
  ["anchorage", "Anchorage", "AK", 0.4, 61.22, -149.9, 0.7, 0.5, 1.15, "port"],
  ["fargo", "Fargo", "ND", 0.26, 46.88, -96.79, 1.0, 1.0, 0.92, "dc+"],
  ["siouxfalls", "Sioux Falls", "SD", 0.3, 43.55, -96.73, 0.9, 1.0, 0.88, ""],
  ["billings", "Billings", "MT", 0.19, 45.78, -108.5, 0.7, 0.8, 0.9, ""],
  ["cheyenne", "Cheyenne", "WY", 0.1, 41.14, -104.82, 0.8, 0.6, 0.92, "dc+"],
  ["burlington", "Burlington", "VT", 0.23, 44.48, -73.21, 1.1, 1.0, 1.05, "univ"],
  ["portlandme", "Portland", "ME", 0.56, 43.66, -70.26, 0.9, 0.9, 1.05, "port"],
  ["manchester", "Manchester–Nashua", "NH", 0.43, 42.99, -71.46, 1.3, 1.2, 1.08, ""],
  ["wilmington", "Wilmington", "DE", 0.57, 39.74, -75.55, 1.1, 0.8, 1.05, ""],
  ["charlestonwv", "Charleston", "WV", 0.25, 38.35, -81.63, 0.6, 1.0, 0.82, ""],
  ["jackson", "Jackson", "MS", 0.58, 32.3, -90.18, 0.6, 1.0, 0.82, ""],
  ["northjersey", "Northern New Jersey", "NJ", 6.7, 40.74, -74.17, 1.4, 1.0, 1.35, "port union"],
  ["trenton", "Trenton–Princeton", "NJ", 0.38, 40.22, -74.76, 1.6, 0.9, 1.25, "univ"],
  ["suburbanmd", "Suburban Maryland", "MD", 2.2, 39.08, -77.15, 1.7, 0.5, 1.35, "univ"],
  ["harrisburg", "Harrisburg", "PA", 0.6, 40.27, -76.88, 0.8, 1.3, 0.92, ""],
  ["allentown", "Lehigh Valley", "PA", 0.87, 40.6, -75.47, 0.9, 1.4, 0.98, ""],
  ["toledo", "Toledo", "OH", 0.6, 41.65, -83.54, 0.7, 1.8, 0.88, "union"],
  ["akron", "Akron", "OH", 0.7, 41.08, -81.52, 0.8, 1.6, 0.9, ""],
  ["dayton", "Dayton", "OH", 0.81, 39.76, -84.19, 0.9, 1.5, 0.88, ""],
  ["fortwayne", "Fort Wayne", "IN", 0.43, 41.08, -85.14, 0.7, 2.0, 0.86, ""],
  ["lansing", "Lansing–Ann Arbor", "MI", 0.9, 42.73, -84.55, 1.3, 1.5, 0.95, "univ union"],
  ["savannah", "Savannah", "GA", 0.42, 32.08, -81.09, 0.7, 1.6, 0.9, "port"],
  ["mobile", "Mobile", "AL", 0.41, 30.69, -88.04, 0.6, 1.5, 0.85, "port"],
  ["corpuschristi", "Corpus Christi", "TX", 0.42, 27.8, -97.4, 0.6, 1.4, 0.88, "port"],
  ["provo", "Provo–Orem", "UT", 0.72, 40.23, -111.66, 1.6, 1.2, 0.98, "univ"],
  ["eugene", "Eugene–Salem", "OR", 0.8, 44.05, -123.09, 0.9, 1.0, 1.0, "univ"],
  ["northwestar", "Northwest Arkansas", "AR", 0.58, 36.37, -94.21, 1.0, 1.3, 0.9, ""],
  ["ftmyers", "Fort Myers–Naples", "FL", 1.2, 26.64, -81.87, 0.8, 0.6, 1.05, ""],
];

export const CITY_SEEDS: CitySeed[] = ROWS.map((r) => ({
  id: r[0], name: r[1], state: r[2], pop: r[3] * 1e6, lat: r[4], lon: r[5], tech: r[6], mfg: r[7], col: r[8],
  flags: r[9].split(" ").filter(Boolean) as CityFlag[], minWage: r[10],
}));

/** Rough industrial electricity price index by state (1 = US average). */
export const POWER_PRICE: Record<string, number> = {
  CA: 1.9, HI: 3.0, AK: 1.8, MA: 1.8, CT: 1.8, RI: 1.8, NH: 1.7, VT: 1.4, ME: 1.6, NY: 1.5, NJ: 1.4, MI: 1.15,
  PA: 1.0, MD: 1.15, DE: 1.1, DC: 1.2, IL: 1.0, WI: 1.1, MN: 1.05, OH: 0.95, IN: 1.0, FL: 1.05, GA: 0.95, NC: 0.9,
  SC: 0.9, VA: 0.95, TN: 0.9, AL: 0.95, MS: 0.9, KY: 0.9, LA: 0.8, AR: 0.8, TX: 0.85, OK: 0.8, KS: 1.0, MO: 0.95,
  IA: 0.9, NE: 0.9, ND: 0.85, SD: 0.95, MT: 0.95, WY: 0.85, CO: 1.05, UT: 0.85, NV: 1.0, AZ: 0.95, NM: 0.95,
  ID: 0.8, OR: 0.95, WA: 0.75, WV: 0.9,
};
