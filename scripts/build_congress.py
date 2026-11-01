#!/usr/bin/env python3
"""
Builds src/sim/data/congress.ts: the members of Congress on 1 January 2026, with a
game faction for each.

Names, seats and parties come from the open @unitedstates/congress-legislators
dataset (https://github.com/unitedstates/congress-legislators). The roster is
rebuilt as of the game's start date from term start/end dates, so members who
left during 2026 are included and their replacements are not.

Factions are game labels, not official designations. They were assigned by hand
from caucus membership (Progressive Caucus, Blue Dog Coalition, Problem Solvers,
Freedom Caucus, Main Street, etc.) and public positioning, with a default for
everyone else (House Democrats: liberal; House Republicans: MAGA). Edit the
tables below to change them.

Usage:
  git clone --depth 1 https://github.com/unitedstates/congress-legislators /tmp/cl
  python3 scripts/build_congress.py /tmp/cl
"""
import json
import sys
from pathlib import Path

import yaml

START = "2026-01-01"
TERRITORIES = {"DC", "PR", "GU", "VI", "AS", "MP"}

APPORTIONMENT = {
    "AL": 7, "AK": 1, "AZ": 9, "AR": 4, "CA": 52, "CO": 8, "CT": 5, "DE": 1, "FL": 28, "GA": 14, "HI": 2, "ID": 2,
    "IL": 17, "IN": 9, "IA": 4, "KS": 4, "KY": 6, "LA": 6, "ME": 2, "MD": 8, "MA": 9, "MI": 13, "MN": 8, "MS": 4,
    "MO": 8, "MT": 2, "NE": 3, "NV": 4, "NH": 2, "NJ": 12, "NM": 3, "NY": 26, "NC": 14, "ND": 1, "OH": 15, "OK": 5,
    "OR": 6, "PA": 17, "RI": 2, "SC": 7, "SD": 1, "TN": 9, "TX": 38, "UT": 4, "VT": 1, "VA": 11, "WA": 10, "WV": 2,
    "WI": 8, "WY": 1,
}

# Approximate Democratic share of the 2024 two-party presidential vote, by state.
STATE_LEAN = {
    "AL": .35, "AK": .43, "AZ": .47, "AR": .34, "CA": .60, "CO": .56, "CT": .57, "DE": .57, "DC": .92, "FL": .43,
    "GA": .49, "HI": .62, "ID": .31, "IL": .55, "IN": .40, "IA": .43, "KS": .42, "KY": .34, "LA": .39, "ME": .53,
    "MD": .62, "MA": .62, "MI": .49, "MN": .52, "MS": .38, "MO": .41, "MT": .39, "NE": .40, "NV": .48, "NH": .51,
    "NJ": .53, "NM": .53, "NY": .56, "NC": .48, "ND": .31, "OH": .44, "OK": .32, "OR": .57, "PA": .49, "RI": .57,
    "SC": .41, "SD": .35, "TN": .35, "TX": .43, "UT": .40, "VT": .65, "VA": .53, "WA": .59, "WV": .29, "WI": .49,
    "WY": .27,
}

# Approximate state legislature seats, 2025-26: (senate D, senate R, house D, house R). Nebraska is unicameral.
STATE_LEGS = {
    "AL": (8, 27, 29, 76), "AK": (9, 11, 19, 21), "AZ": (13, 17, 27, 33), "AR": (6, 29, 19, 81), "CA": (30, 10, 60, 20),
    "CO": (23, 12, 43, 22), "CT": (25, 11, 102, 49), "DE": (15, 6, 27, 14), "FL": (11, 28, 33, 87), "GA": (23, 33, 80, 100),
    "HI": (22, 3, 42, 9), "ID": (6, 29, 9, 61), "IL": (40, 19, 78, 40), "IN": (10, 40, 30, 70), "IA": (17, 33, 33, 67),
    "KS": (9, 31, 37, 88), "KY": (7, 31, 20, 80), "LA": (11, 28, 32, 73), "ME": (20, 15, 76, 75), "MD": (34, 13, 102, 39),
    "MA": (35, 5, 134, 26), "MI": (19, 19, 52, 58), "MN": (34, 33, 67, 67), "MS": (16, 36, 41, 81), "MO": (10, 24, 52, 111),
    "MT": (18, 32, 42, 58), "NE": (16, 33, 0, 0), "NV": (13, 8, 27, 15), "NH": (8, 16, 178, 222), "NJ": (25, 15, 57, 23),
    "NM": (26, 16, 44, 26), "NY": (41, 22, 103, 47), "NC": (20, 30, 49, 71), "ND": (5, 42, 11, 83), "OH": (9, 24, 34, 65),
    "OK": (8, 40, 20, 81), "OR": (18, 12, 36, 24), "PA": (22, 28, 102, 101), "RI": (34, 4, 65, 10), "SC": (12, 34, 36, 88),
    "SD": (3, 32, 6, 64), "TN": (6, 27, 24, 75), "TX": (11, 20, 62, 88), "UT": (6, 23, 14, 61), "VT": (17, 13, 87, 63),
    "VA": (21, 19, 64, 36), "WA": (30, 19, 59, 39), "WV": (2, 32, 9, 91), "WI": (15, 18, 45, 54), "WY": (2, 29, 6, 56),
}

SENATE = {
    # Republicans
    "AK-Sullivan": "corporate", "AK-Murkowski": "moderate", "AL-Britt": "corporate", "AL-Tuberville": "maga",
    "AR-Boozman": "corporate", "AR-Cotton": "maga", "FL-Moody": "maga", "FL-Scott": "maga", "IA-Grassley": "corporate",
    "IA-Ernst": "corporate", "ID-Risch": "corporate", "ID-Crapo": "corporate", "IN-Banks": "populist", "IN-Young": "moderate",
    "KS-Moran": "corporate", "KS-Marshall": "maga", "KY-McConnell": "corporate", "KY-Paul": "libertarian",
    "LA-Cassidy": "moderate", "LA-Kennedy": "populist", "ME-Collins": "moderate", "MO-Schmitt": "maga", "MO-Hawley": "populist",
    "MS-Hyde-Smith": "maga", "MS-Wicker": "corporate", "MT-Daines": "corporate", "MT-Sheehy": "maga", "NC-Budd": "maga",
    "NC-Tillis": "moderate", "ND-Hoeven": "corporate", "ND-Cramer": "maga", "NE-Fischer": "corporate", "NE-Ricketts": "corporate",
    "OH-Moreno": "populist", "OH-Husted": "corporate", "OK-Mullin": "maga", "OK-Lankford": "corporate", "PA-McCormick": "corporate",
    "SC-Graham": "maga", "SC-Scott": "corporate", "SD-Thune": "corporate", "SD-Rounds": "corporate", "TN-Hagerty": "maga",
    "TN-Blackburn": "maga", "TX-Cornyn": "corporate", "TX-Cruz": "maga", "UT-Curtis": "moderate", "UT-Lee": "libertarian",
    "WI-Johnson": "maga", "WV-Justice": "maga", "WV-Capito": "corporate", "WY-Lummis": "libertarian", "WY-Barrasso": "corporate",
    # Democrats and independents who caucus with them
    "AZ-Kelly": "moderate", "AZ-Gallego": "moderate", "CA-Schiff": "liberal", "CA-Padilla": "liberal",
    "CO-Hickenlooper": "moderate", "CO-Bennet": "moderate", "CT-Murphy": "progressive", "CT-Blumenthal": "liberal",
    "DE-Coons": "moderate", "DE-Blunt Rochester": "liberal", "GA-Ossoff": "liberal", "GA-Warnock": "liberal",
    "HI-Schatz": "progressive", "HI-Hirono": "progressive", "IL-Durbin": "liberal", "IL-Duckworth": "liberal",
    "MA-Markey": "progressive", "MA-Warren": "progressive", "MD-Alsobrooks": "liberal", "MD-Van Hollen": "progressive",
    "ME-King": "moderate", "MI-Slotkin": "moderate", "MI-Peters": "moderate", "MN-Klobuchar": "moderate", "MN-Smith": "progressive",
    "NH-Shaheen": "moderate", "NH-Hassan": "moderate", "NJ-Kim": "liberal", "NJ-Booker": "liberal", "NM-Luján": "liberal",
    "NM-Heinrich": "liberal", "NV-Cortez Masto": "moderate", "NV-Rosen": "moderate", "NY-Schumer": "liberal",
    "NY-Gillibrand": "liberal", "OR-Merkley": "progressive", "OR-Wyden": "progressive", "PA-Fetterman": "bluedog",
    "RI-Reed": "liberal", "RI-Whitehouse": "progressive", "VA-Warner": "moderate", "VA-Kaine": "liberal",
    "VT-Sanders": "socialist", "VT-Welch": "progressive", "WA-Cantwell": "liberal", "WA-Murray": "liberal",
    "WI-Baldwin": "progressive",
}

HOUSE_D = {
    "socialist": "NY-14 MI-12 MN-5 MA-7 PA-12 IL-3",
    "progressive": "WA-7 TX-35 CA-17 MD-8 IL-9 IL-4 WI-2 NJ-12 AZ-7 FL-10 AZ-3 VT-0 CA-39 CA-28 CA-44 CA-10 CA-2 NY-7 NY-9 "
                   "NY-12 NY-13 MA-2 TX-37 TX-16 TX-20 TX-29 TX-30 TX-9 GA-4 IL-7 IN-7 MN-4 NY-20 CT-3 OR-1 OR-4 ME-1 MI-13 "
                   "CA-37 CA-42 CA-34 CA-43 CA-12 CA-51 NM-3 NM-1 MO-5 MS-2 OH-11 OH-3 PA-3 CA-52 HI-2 NJ-10 OR-3 WA-6 MD-4 "
                   "MD-7 RI-1 GA-5 NC-4 NC-12 CO-1 TN-9 IL-1 IL-2 FL-24 FL-20 PA-17",
    "moderate": "NJ-5 NY-19 NY-22 MI-8 MI-3 OH-1 OH-13 MN-2 IL-17 IL-13 IL-14 NH-1 NH-2 VA-7 CO-6 CO-7 NM-2 NV-3 NV-4 NV-1 "
                "AZ-4 CA-9 CA-47 CA-45 CA-27 CA-49 CA-26 CA-24 CA-25 CA-6 CA-16 FL-9 TX-7 GA-6 KS-3 PA-6 PA-2 PA-4 PA-5 "
                "VA-10 VA-11 MA-8 MA-4 MA-6 NJ-8 NJ-3 NJ-1 CT-4 CT-2 WA-8 WA-1 WA-2 NY-16 NY-15 MD-2 MD-6 MD-3 MD-5 CA-31 "
                "CA-35 CA-29 CA-15 CA-19 CA-50 CA-32 IL-10 IL-11 IL-5 FL-25 AL-2 LA-6 TX-32 MO-1 NY-18 NY-25",
    "bluedog": "ME-2 WA-3 NC-1 TX-28 TX-34 CA-21 HI-1 CA-13 CA-46 GA-2 GA-13 CA-4 NY-3 NY-4 OH-9 IN-1 FL-23",
}
HOUSE_R = {
    "moderate": "PA-1 NE-2 NY-17 NY-1 NY-2 NJ-7 CA-3 CA-22 AZ-6 CA-40 FL-27 FL-28 PA-7 PA-8 IA-1 IA-3 OH-14 OH-10 WA-4 "
                "VA-2 CO-8 CO-3 NY-11 TX-23 NJ-4",
    "corporate": "LA-1 MN-6 AR-2 AR-3 OK-4 OK-3 OK-5 OK-1 TX-10 MO-8 MO-6 MO-2 KY-2 KY-6 KY-5 AL-3 AL-4 AL-6 NC-9 NC-5 "
                 "NC-7 WI-1 WI-5 IL-16 IL-12 ID-2 CA-23 CA-41 FL-26 FL-12 FL-16 FL-5 FL-11 FL-2 VA-1 VA-9 TN-3 TN-8 TX-8 "
                 "TX-2 TX-31 TX-17 TX-25 TX-36 TX-24 GA-1 GA-12 GA-11 IN-4 IN-2 OH-5 OH-12 OH-15 OH-2 PA-9 PA-11 PA-16 "
                 "PA-14 PA-13 PA-15 NY-23 MI-2 MI-4 MI-5 MI-9 SD-0 ND-0 AK-0 MS-3 MS-1 SC-2 SC-4 SC-7 KS-4 KS-2 KS-1 UT-1 "
                 "UT-2 UT-3 UT-4 NV-2 MN-8 MN-7 MN-1 IA-2 IA-4 WA-5 NE-1 NE-3 MT-1 MT-2 OR-2 WV-1 WV-2 AL-5 LA-5 MI-1 TX-11",
    "libertarian": "KY-4 OH-8 TX-21 MO-7 CA-5 AZ-2",
    "populist": "GA-14 TN-2 NJ-2 FL-13 OH-6",
}


def expand(table):
    out = {}
    for faction, seats in table.items():
        for s in seats.split():
            out[s] = faction
    return out


def main(repo):
    cur = yaml.safe_load(open(Path(repo) / "legislators-current.yaml"))
    hist = yaml.safe_load(open(Path(repo) / "legislators-historical.yaml"))
    hd, hr = expand(HOUSE_D), expand(HOUSE_R)
    members, missing = [], []
    for m in cur + hist:
        for t in m["terms"]:
            if not (t["start"] <= START < t["end"]) or t["type"] not in ("sen", "rep") or t["state"] in TERRITORIES:
                continue
            n = m["name"]
            first = n.get("nickname") or n["first"]
            name = f"{first} {n['last']}" + (f" {n['suffix']}" if n.get("suffix") else "")
            party = t.get("party", "")
            caucus = t.get("caucus") or party
            p = "D" if caucus.startswith("Dem") else "R"
            label = "I" if party == "Independent" else p
            st = t["state"]
            if t["type"] == "sen":
                key = f"{st}-{n['last']}"
                fac = SENATE.get(key)
                if not fac:
                    missing.append(key)
                    fac = "liberal" if p == "D" else "maga"
                members.append({"id": m["id"]["bioguide"], "name": name, "party": p, "label": label, "faction": fac,
                                "chamber": "senate", "state": st, "cls": t["class"]})
            else:
                key = f"{st}-{t['district']}"
                fac = (hd if p == "D" else hr).get(key) or ("liberal" if p == "D" else "maga")
                members.append({"id": m["id"]["bioguide"], "name": name, "party": p, "label": label, "faction": fac,
                                "chamber": "house", "state": st, "district": t["district"]})
    house = [x for x in members if x["chamber"] == "house"]
    seats = {(x["state"], x["district"]) for x in house}
    vacancies = []
    for st, n in APPORTIONMENT.items():
        for d in ([0] if n == 1 else range(1, n + 1)):
            if (st, d) not in seats:
                vacancies.append({"state": st, "district": d})
    assert sum(APPORTIONMENT.values()) == 435
    out = Path(__file__).resolve().parent.parent / "src" / "sim" / "data" / "congress.ts"
    with open(out, "w") as f:
        f.write("// Generated by scripts/build_congress.py from the @unitedstates/congress-legislators dataset.\n")
        f.write("// Members of Congress on 1 January 2026. Factions are game labels assigned by hand (see the script).\n\n")
        f.write("export type Faction = \"socialist\" | \"progressive\" | \"liberal\" | \"moderate\" | \"bluedog\" | \"corporate\" | \"maga\" | \"populist\" | \"libertarian\";\n\n")
        f.write("export interface MemberSeed { id: string; name: string; party: \"D\" | \"R\"; label: \"D\" | \"R\" | \"I\"; faction: Faction; chamber: \"senate\" | \"house\"; state: string; district?: number; cls?: number }\n\n")
        f.write("export const MEMBERS_2026: MemberSeed[] = " + json.dumps(members, ensure_ascii=False, indent=0) + ";\n\n")
        f.write("/** Seats vacant on 1 January 2026; filled at the next election. */\n")
        f.write("export const VACANCIES_2026: { state: string; district: number }[] = " + json.dumps(vacancies) + ";\n\n")
        f.write("export const APPORTIONMENT: Record<string, number> = " + json.dumps(APPORTIONMENT) + ";\n\n")
        f.write("/** Approximate Democratic share of the 2024 two-party presidential vote. */\n")
        f.write("export const STATE_LEAN: Record<string, number> = " + json.dumps(STATE_LEAN) + ";\n\n")
        f.write("/** Approximate state legislature seats, 2025-26: [senate D, senate R, house D, house R]. Nebraska is unicameral and officially nonpartisan. */\n")
        f.write("export const STATE_LEGS: Record<string, [number, number, number, number]> = " + json.dumps(STATE_LEGS) + ";\n")
    print(f"{len(members)} members ({len(house)} House, {len(members) - len(house)} Senate), {len(vacancies)} vacancies -> {out}")
    if missing:
        print("Senators without a faction entry:", missing)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/cl")
