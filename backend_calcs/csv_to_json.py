#!/usr/bin/env python3
import csv, json, os, re
from pathlib import Path
from typing import List, Tuple, Optional

# ----- paths
ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "table_setup.csv"
DATA_DIR = ROOT / "data"
PROJ_DIR = DATA_DIR / "projections"
PLAYERS_PATH = DATA_DIR / "players.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
PROJ_DIR.mkdir(parents=True, exist_ok=True)

def slugify(name: str) -> str:
    """
    Make a stable, filesystem-safe id from a player name.
    e.g., 'Patrick Mahomes' -> 'patrick-mahomes'
    """
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "player"

def parse_curve(s: str) -> List[Tuple[float, float]]:
    if not s:
        return []
    s_norm = s.replace('""', '"').strip().strip('"').strip("'")
    arr = json.loads(s_norm)
    out = []
    for item in arr:
        x = float(item.get("pts"))
        cdf = float(item.get("pct"))
        if cdf > 1:  # stored as percent
            cdf /= 100.0
        out.append((x, cdf))
    out.sort(key=lambda t: t[0])
    return out


def percentile_from_survival(curve: List[Tuple[float, float]], tail: float = 0.05) -> Optional[float]:
    """
    Given survival (cdf) S(x) = P(X >= x) sorted by x, find x such that S(x) ~= tail.
    Linear interpolate between points.
    """
    if not curve:
        return None
    for i in range(len(curve) - 1):
        (x0, s0), (x1, s1) = curve[i], curve[i + 1]
        # look for crossing of tail (e.g., 0.05)
        if (s0 - tail) * (s1 - tail) <= 0:
            # avoid divide-by-zero
            denom = (s1 - s0) if (s1 - s0) != 0 else 1e-9
            t = (tail - s0) / denom
            return x0 + t * (x1 - x0)
    # If we never cross, fallback to max x where survival > tail
    for x, s in reversed(curve):
        if s >= tail:
            return x
    # else just return max x
    return curve[-1][0]

def main():
    assert CSV_PATH.exists(), f"Could not find {CSV_PATH}"
    players = []
    seen_ids = set()

    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("player") or "").strip()
            if not name:
                continue

            # ---- id (unique & stable)
            pid_base = slugify(name)
            pid = pid_base
            i = 2
            while pid in seen_ids:
                pid = f"{pid_base}-{i}"
                i += 1
            seen_ids.add(pid)

            # ---- players.json entry
            players.append({
                "id": pid,
                "name": name,
                "team": row.get("team", "") or "",         # not present in your CSV -> remains empty
                "position": row.get("position", "") or ""  # not present in your CSV -> remains empty
            })

            # ---- projections/<id>.json
            try:
                pass_tds = row.get("player_pass_tds")
                pass_tds = float(pass_tds) if pass_tds not in (None, "", "NaN") else None
            except Exception:
                pass_tds = None

            # From your CSV these look like "totals" for half-PPR
            def to_num(v):
                try:
                    return float(v)
                except Exception:
                    return None

            mean_half = to_num(row.get("total_score_half_ppr"))
            median_half = to_num(row.get("total_score_half_ppr_median"))

            curve = parse_curve(row.get("chart_source_half_ppr") or "")
            # convert to {x, cdf} with cdf in [0..1] already
            chart_half = [{"x": x, "cdf": cdf} for (x, cdf) in curve]

            ceiling = percentile_from_survival(curve, tail=0.05)  # ~95th percentile

            projection = {
                "ppr": mean_half,                     # using half-PPR mean from CSV
                "median": median_half,                # half-PPR median
                "ceiling": ceiling,                   # computed ~95th percentile
                "pass_tds": pass_tds,
                "chart_source_half_ppr": chart_half
            }

            out_path = PROJ_DIR / f"{pid}.json"
            with out_path.open("w", encoding="utf-8") as wf:
                json.dump(projection, wf, ensure_ascii=False, indent=2)

    # write players.json (sorted by name for UX)
    players.sort(key=lambda p: p["name"])
    with PLAYERS_PATH.open("w", encoding="utf-8") as wf:
        json.dump(players, wf, ensure_ascii=False, indent=2)

    print(f"✅ Wrote {len(players)} players")
    print(f"• {PLAYERS_PATH.relative_to(ROOT)}")
    print(f"• {PROJ_DIR.relative_to(ROOT)}/<id>.json")

if __name__ == "__main__":
    main()
