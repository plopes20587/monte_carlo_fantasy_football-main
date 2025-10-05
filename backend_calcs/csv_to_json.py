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
        if cdf > 1:
            cdf /= 100.0
        out.append((x, cdf))
    out.sort(key=lambda t: t[0])
    return out

def percentile_from_survival(curve: List[Tuple[float, float]], tail: float = 0.05) -> Optional[float]:
    if not curve:
        return None
    for i in range(len(curve) - 1):
        (x0, s0), (x1, s1) = curve[i], curve[i + 1]
        if (s0 - tail) * (s1 - tail) <= 0:
            denom = (s1 - s0) if (s1 - s0) != 0 else 1e-9
            t = (tail - s0) / denom
            return x0 + t * (x1 - x0)
    for x, s in reversed(curve):
        if s >= tail:
            return x
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

            pid_base = slugify(name)
            pid = pid_base
            i = 2
            while pid in seen_ids:
                pid = f"{pid_base}-{i}"
                i += 1
            seen_ids.add(pid)

            players.append({
                "id": pid,
                "name": name,
                "team": row.get("team", "") or "",
                "position": row.get("position", "") or ""
            })

            def to_num(v):
                try:
                    return float(v)
                except Exception:
                    return None

            # standard stats
            pass_tds = to_num(row.get("player_pass_tds"))
            rush_yds = to_num(row.get("player_rush_yds"))
            receptions = to_num(row.get("player_receptions"))
            pass_yds = to_num(row.get("player_pass_yds"))

            mean_half = to_num(row.get("total_score_half_ppr"))
            median_half = to_num(row.get("total_score_half_ppr_median"))

            curve = parse_curve(row.get("chart_source_half_ppr") or "")
            chart_half = [{"x": x, "cdf": cdf} for (x, cdf) in curve]
            ceiling = percentile_from_survival(curve, tail=0.05)

            projection = {
                "ppr": mean_half,
                "median": median_half,
                "ceiling": ceiling,
                "pass_tds": pass_tds,
                "rushing_yards": rush_yds,
                "receptions": receptions,
                "passing_yards": pass_yds,
                "chart_source_half_ppr": chart_half
            }

            out_path = PROJ_DIR / f"{pid}.json"
            with out_path.open("w", encoding="utf-8") as wf:
                json.dump(projection, wf, ensure_ascii=False, indent=2)

    players.sort(key=lambda p: p["name"])
    with PLAYERS_PATH.open("w", encoding="utf-8") as wf:
        json.dump(players, wf, ensure_ascii=False, indent=2)

    print(f"✅ Wrote {len(players)} players")
    print(f"• {PLAYERS_PATH.relative_to(ROOT)}")
    print(f"• {PROJ_DIR.relative_to(ROOT)}/<id>.json")

if __name__ == "__main__":
    main()
