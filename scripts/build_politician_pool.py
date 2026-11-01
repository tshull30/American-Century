"""Build src/sim/data/politicianPool.ts: real US politicians who could plausibly run for Congress.

Usage:
  python3 scripts/build_politician_pool.py CONGRESS_DIR OPENSTATES_DIR

  CONGRESS_DIR   folder holding legislators-historical.yaml and legislators-current.yaml from
                 https://github.com/unitedstates/congress-legislators
  OPENSTATES_DIR a checkout of https://github.com/openstates/people (only data/ is needed):
                   git clone --depth 1 --filter=blob:none --sparse https://github.com/openstates/people /tmp/openstates
                   git -C /tmp/openstates sparse-checkout set data

Rows are [name, state, party, role, district]:
  fmr  former member of Congress (last term ended 2003+, born 1950+, not seated now, not known dead)
  gov  statewide executive official from openstates data/<st>/executive (D/R only)
  ss   state senator (Nebraska's unicameral counts here), up to SS_CAP per state per party
  sh   state house/assembly member, up to SH_CAP per state per party
Legislators are picked by sorting on name and taking evenly spaced ones, so reruns are stable.
"""
import datetime, glob, json, os, re, sys
import yaml

SS_CAP, SH_CAP = 30, 20
TODAY = datetime.date.today().isoformat()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "sim", "data", "politicianPool.ts")

STATES = set("""AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ
NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY""".split())

# The congress-legislators data has no death dates. Former members born 1950+ who are known to have
# died, listed by bioguide id, so they are never offered as candidates.
DECEASED = {
    "E000250": "Lane Evans", "D000597": "Jo Ann Davis", "A000364": "John Adler", "S001143": "Mark Souder",
    "T000057": "Ellen Tauscher", "L000553": "Steven LaTourette", "S001182": "Bobby Schilling",
    "H001049": "Kay Hagan", "N000186": "Alan Nunnelee", "T000473": "Mark Takai", "F000451": "Mike Fitzpatrick",
    "H001051": "Richard Hanna", "L000584": "Mia Love", "C000984": "Elijah Cummings", "W000827": "Ron Wright",
    "H001088": "Jim Hagedorn", "W000813": "Jackie Walorski", "M001200": "Donald McEachin",
    "P000604": "Donald Payne Jr.", "J000032": "Sheila Jackson Lee", "T000489": "Sylvester Turner",
    "C001078": "Gerry Connolly", "L000578": "Doug LaMalfa",
}

SUFFIX_OK = {"Jr.", "Sr.", "II", "III", "IV"}


def clean_name(name):
    name = re.sub(r"\s*[\"“”][^\"“”]*[\"“”]\s*", " ", name)  # "Nick" nicknames
    name = re.sub(r"\s*\([^)]*\)", "", name)
    name = re.sub(r"\b(Jr|Sr)\b\.?", r"\1.", name)
    parts = [p.strip() for p in name.split(",")]
    words = parts[0].split() + [p for p in parts[1:] if p in SUFFIX_OK]  # "Doe, Jr." -> "Doe Jr."; drops ", M.D."
    # drop trailing degree junk ("M.D.", "Ph.D.", "Esq.")
    while words and re.fullmatch(r"(M\.?D\.?|Ph\.?D\.?|Esq\.?|D\.?D\.?S\.?|CPA|RN|DVM)", words[-1]):
        words.pop()
    return " ".join(words)


def norm_key(name, st):
    n = re.sub(r"[^a-z ]", "", name.lower().replace(".", " "))
    w = [x for x in n.split() if len(x) > 1 and x not in ("jr", "sr", "ii", "iii", "iv")]
    # first initial + last name, so "Kathleen C. Hochul" and "Kathy Hochul" collapse to one person
    return (st, w[0][:1] if w else "", w[-1] if w else "")


def congress_rows(cdir):
    load = lambda f: yaml.safe_load(open(os.path.join(cdir, f), encoding="utf-8"))
    current = {p["id"]["bioguide"] for p in load("legislators-current.yaml")}
    rows = []
    for p in load("legislators-historical.yaml"):
        bid = p["id"]["bioguide"]
        if bid in current or bid in DECEASED:
            continue
        bio = p.get("bio", {})
        if bio.get("deathday") or str(bio.get("birthday", "0")) < "1950":
            continue
        t = p["terms"][-1]
        if str(t["end"]) < "2003" or t["state"] not in STATES:
            continue
        party = {"Democrat": "D", "Republican": "R"}.get(t.get("party"))
        if not party:
            continue
        n = p["name"]
        if n.get("official_full"):
            name = n["official_full"]
        else:
            first = n.get("nickname") or n["first"]
            mid = n.get("middle")
            name = first
            # Use the middle initial only when the person goes by a first initial ("J. Gresham Barrett")
            if mid and re.fullmatch(r"[A-Z]\.", first):
                name += " " + mid
            name += " " + n["last"]
            if n.get("suffix"):
                name += " " + n["suffix"]
        dist = int(t.get("district") or 0) if t["type"] == "rep" else 0
        rows.append([clean_name(name), t["state"], party, "fmr", max(dist, 0)])
    return rows


def party_of(p):
    cur = [x["name"] for x in p.get("party", []) if not x.get("end_date") or str(x["end_date"]) >= TODAY]
    if not cur:
        return None
    nm = cur[-1]
    if nm.startswith("Democratic"):
        return "D"
    if nm.startswith("Republican"):
        return "R"
    return None


def current_role(p):
    roles = [r for r in p.get("roles", []) if not r.get("end_date") or str(r["end_date"]) >= TODAY]
    roles = [r for r in roles if not r.get("start_date") or str(r["start_date"]) <= TODAY]
    if not roles:
        return None
    return max(roles, key=lambda r: str(r.get("start_date", "")))


def openstates_rows(odir):
    gov, leg = [], {}
    for sdir in sorted(glob.glob(os.path.join(odir, "data", "*"))):
        st = os.path.basename(sdir).upper()
        if st not in STATES:
            continue
        for f in sorted(glob.glob(os.path.join(sdir, "executive", "*.yml"))):
            p = yaml.safe_load(open(f, encoding="utf-8"))
            party, role = party_of(p), current_role(p)
            if party and role and role.get("type") != "mayor":
                gov.append([clean_name(p["name"]), st, party, "gov", 0])
        for f in sorted(glob.glob(os.path.join(sdir, "legislature", "*.yml"))):
            p = yaml.safe_load(open(f, encoding="utf-8"))
            party, role = party_of(p), current_role(p)
            if not party or not role:
                continue
            kind = {"upper": "ss", "legislature": "ss", "lower": "sh"}.get(role.get("type"))
            if kind:
                leg.setdefault((st, party, kind), []).append(clean_name(p["name"]))
    rows = list(gov)
    for (st, party, kind), names in sorted(leg.items()):
        names = sorted(set(names), key=lambda s: (s.split()[-1].lower(), s.lower()))
        cap = SS_CAP if kind == "ss" else SH_CAP
        if len(names) > cap:
            names = [names[i * len(names) // cap] for i in range(cap)]
        rows += [[n, st, party, kind, 0] for n in names]
    return rows


def main():
    cdir, odir = sys.argv[1], sys.argv[2]
    order = {"fmr": 0, "gov": 1, "ss": 2, "sh": 3}
    # A former member who now holds state office appears once, as "fmr" (matched loosely on first
    # initial + last name, since the two sources spell first names differently). Within openstates,
    # only exact same-name repeats in one state are dropped.
    fmr_keys, seen, out = set(), set(), []
    for r in congress_rows(cdir) + openstates_rows(odir):
        k, exact = norm_key(r[0], r[1]), (r[1], r[0].lower())
        if exact in seen or (r[3] != "fmr" and k in fmr_keys):
            continue
        seen.add(exact)
        if r[3] == "fmr":
            fmr_keys.add(k)
        out.append(r)
    out.sort(key=lambda r: (r[1], r[2], order[r[3]], r[0]))
    lines = [
        "// Generated by scripts/build_politician_pool.py. Sources: github.com/unitedstates/congress-legislators"
        " (legislators-historical.yaml, legislators-current.yaml), github.com/openstates/people (data/<state>/legislature, executive).",
        "// Rows: [name, state, party, role, district]",
        '//  role: "fmr" former member of Congress, "gov" statewide official (governor, lt. governor, AG, secretary of state, treasurer...), "ss" state senator, "sh" state house/assembly member',
        '//  district: for "fmr" the US House district they last held (0 for senators/at-large), otherwise 0',
        'export type PoolRole = "fmr" | "gov" | "ss" | "sh";',
        'export const POLITICIAN_POOL: [string, string, "D" | "R", PoolRole, number][] = [',
    ]
    lines += ["  " + json.dumps(r, ensure_ascii=False) + "," for r in out]
    lines.append("];")
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    counts = {}
    for r in out:
        counts[r[3]] = counts.get(r[3], 0) + 1
    print(f"wrote {len(out)} rows to {os.path.normpath(OUT)}: {counts}")


if __name__ == "__main__":
    main()
