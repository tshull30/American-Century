// Natural resources by state, as rough game indices (0 = none, 1 = a solid producer,
// 3 = the biggest). Oil and gas follow EIA production rankings; farm follows USDA
// crop-receipt rankings; sun is relative solar output per panel.

export type ResourceId = "oil" | "gas" | "farm" | "coal" | "iron" | "copper" | "lithium" | "timber" | "ranch" | "cotton" | "uranium" | "rare" | "dairy";

export const RESOURCES: Record<ResourceId, Record<string, number>> = {
  oil: {
    SAU: 3, CAN: 1.6, BRA: 0.9, MEX: 0.6,
    TX: 3, NM: 2, ND: 1.5, AK: 1.2, OK: 1, LA: 0.9, CO: 0.6, CA: 0.5, WY: 0.5, UT: 0.3, KS: 0.25, MT: 0.2, OH: 0.1, WV: 0.1, PA: 0.05, IL: 0.05, MS: 0.1, AL: 0.05, MI: 0.05,
  },
  gas: {
    CAN: 1.2, SAU: 1.0, MEX: 0.3,
    TX: 3, PA: 2.6, LA: 1.3, WV: 1.3, OK: 0.9, NM: 0.9, OH: 0.8, CO: 0.5, WY: 0.4, ND: 0.35, AR: 0.2, AK: 0.15, UT: 0.15, KS: 0.1, VA: 0.05, KY: 0.05, AL: 0.05, MI: 0.05,
  },
  farm: {
    BRA: 2.5, CAN: 1.0, IND: 1.2, CHN: 1.0, MEX: 0.6,
    IA: 3, IL: 2.5, NE: 2.3, CA: 2.0, MN: 2.0, KS: 1.8, ND: 1.6, IN: 1.5, SD: 1.5, TX: 1.4, WI: 1.2, MO: 1.2, OH: 1.1, ID: 1.0, AR: 0.9, WA: 0.9, MI: 0.8, NC: 0.8, OK: 0.8, MT: 0.7,
    CO: 0.6, KY: 0.6, GA: 0.6, MS: 0.6, FL: 0.6, OR: 0.6, TN: 0.5, LA: 0.5, PA: 0.5, NY: 0.5, AL: 0.4, VA: 0.4, SC: 0.3, NM: 0.3, AZ: 0.3, UT: 0.2, WY: 0.2, MD: 0.2,
    DE: 0.2, VT: 0.15, ME: 0.15, WV: 0.1, NJ: 0.1, NV: 0.1, HI: 0.1, NH: 0.05, MA: 0.05, CT: 0.05, RI: 0.03, AK: 0.03,
  },
  coal: { WY: 3, WV: 2, PA: 1, IL: 1, KY: 1, ND: 0.6, MT: 0.6, IN: 0.6, TX: 0.4, OH: 0.4, AL: 0.4, UT: 0.3, VA: 0.3, CO: 0.3, NM: 0.3, CHN: 2, IND: 2, CAN: 0.3 },
  iron: { MN: 3, MI: 1.2, BRA: 3, CAN: 1, IND: 1 },
  copper: { AZ: 3, UT: 1.2, NM: 0.8, NV: 0.6, MT: 0.4, MI: 0.2, MEX: 1, CAN: 0.6, BRA: 0.3 },
  lithium: { NV: 2, AR: 1.2, NC: 1, CA: 0.6, CAN: 0.5, BRA: 0.4, CHN: 1 },
  timber: {
    OR: 3, WA: 2.5, GA: 2, AL: 2, ME: 1.5, MS: 1.5, NC: 1.2, SC: 1, LA: 1, AR: 1, ID: 1, MT: 0.8, MI: 0.8, WI: 0.8, MN: 0.7, CA: 0.6, VA: 0.6, TX: 0.6, FL: 0.6,
    NY: 0.4, PA: 0.5, NH: 0.5, VT: 0.4, TN: 0.5, KY: 0.4, WV: 0.5, AK: 0.5, CAN: 3, BRA: 1.5,
  },
  ranch: {
    TX: 3, NE: 2.2, KS: 2, IA: 2, OK: 1.5, NC: 1.2, SD: 1.2, CO: 1, MN: 1, MO: 1, MT: 1, CA: 0.8, WY: 0.7, ND: 0.6, ID: 0.6, IL: 0.6, NM: 0.5, AR: 0.5, KY: 0.5,
    IN: 0.5, WI: 0.5, OH: 0.4, TN: 0.4, FL: 0.4, GA: 0.4, OR: 0.4, UT: 0.4, PA: 0.4, VA: 0.3, AL: 0.3, MS: 0.3, NV: 0.3, AZ: 0.3, LA: 0.3, BRA: 3, MEX: 1, CAN: 0.8,
  },
  cotton: { TX: 3, GA: 1.5, MS: 1, AR: 1, AL: 0.8, NC: 0.6, MO: 0.6, TN: 0.5, LA: 0.5, OK: 0.5, SC: 0.4, AZ: 0.4, CA: 0.3, NM: 0.2, VA: 0.2, FL: 0.2, KS: 0.2, IND: 2.5, CHN: 2, BRA: 1.5 },
  uranium: { WY: 3, NM: 1, TX: 0.8, UT: 0.6, AZ: 0.4, CO: 0.3, CAN: 3 },
  rare: { CA: 1.5, WY: 0.8, TX: 0.4, CHN: 3, BRA: 0.4 },
  dairy: {
    CA: 3, WI: 3, ID: 1.5, NY: 1.5, TX: 1.2, MI: 1.2, MN: 1, PA: 1, NM: 0.8, WA: 0.8, IA: 0.7, CO: 0.6, AZ: 0.6, OH: 0.6, VT: 0.5, IN: 0.5, KS: 0.5, UT: 0.4, SD: 0.4, OR: 0.3,
    IND: 2, BRA: 1, CAN: 0.8,
  },
};

/** Wind-farm output relative to the US average. */
export const WIND: Record<string, number> = {
  WY: 1.35, TX: 1.3, IA: 1.3, OK: 1.3, KS: 1.3, ND: 1.3, SD: 1.3, NE: 1.25, MN: 1.2, MT: 1.2, CO: 1.15, NM: 1.15, IL: 1.05, IN: 1.0, ME: 1.0,
  FL: 0.55, GA: 0.6, AL: 0.6, SC: 0.65, MS: 0.65, LA: 0.7, TN: 0.65, KY: 0.7, NC: 0.75, VA: 0.75, AR: 0.8,
};

/** Solar output per panel relative to the US average. */
export const SUN: Record<string, number> = {
  AZ: 1.35, NM: 1.3, NV: 1.3, CA: 1.25, UT: 1.2, CO: 1.15, TX: 1.15, HI: 1.15, FL: 1.1, OK: 1.08, KS: 1.05, GA: 1.03, NC: 1.02, SC: 1.02,
  WA: 0.8, OR: 0.85, AK: 0.6, ME: 0.85, VT: 0.82, NH: 0.85, MI: 0.85, WI: 0.88, MN: 0.9, NY: 0.88, PA: 0.9, OH: 0.88, WV: 0.88, MA: 0.9,
};

export function resourceIdx(r: ResourceId, state: string): number {
  return RESOURCES[r][state] ?? 0;
}

/** Output multiplier for a resource building in a state; 0 means it can't be built there. */
export function resourceMult(r: ResourceId, state: string): number {
  const x = resourceIdx(r, state);
  return x <= 0 ? 0 : Math.min(1.3, 0.5 + 0.3 * x);
}

export const RESOURCE_NAME: Record<ResourceId, string> = {
  oil: "oil reserves", gas: "natural gas reserves", farm: "farmland", coal: "coal seams", iron: "iron ore deposits", copper: "copper deposits",
  lithium: "lithium deposits", timber: "commercial forests", ranch: "rangeland", cotton: "cotton country", uranium: "uranium deposits",
  rare: "rare-earth deposits", dairy: "dairy country",
};
