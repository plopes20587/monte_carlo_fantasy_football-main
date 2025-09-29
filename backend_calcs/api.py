# backend_calcs/api.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import time, re, json
import pandas as pd  # pip install pandas

app = FastAPI(title="FF API (dynamic CSV)")

# Allow Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Config ----
HERE = Path(__file__).parent
TABLE_CSV = HERE / "table_setup.csv"   # adjust if your file sits elsewhere

# ---- In-memory cache + mtime tracking (3.9-compatible types) ----
_PLAYERS: List[Dict[str, Any]] = []
_PROJECTIONS: List[Dict[str, Any]] = []
_TABLE_MTIME: Optional[float] = None

# ---- Helpers ----
def _slug(s: str) -> str:
    s = (s or "").strip().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")

def _to_float(v):
    try:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None
        return float(v)
    except Exception:
        return None

def _p90_from_hist(hist_json: str) -> Optional[float]:
    """Try to derive a 90th percentile from chart_source_full_ppr if present."""
    if not isinstance(hist_json, str) or not hist_json.strip():
        return None
    try:
        arr = json.loads(hist_json)
        # assume pct as 0..100 first
        cum = 0.0
        for b in arr:
            cum += float(b.get("pct", 0))
            if cum >= 90.0:
                return float(b.get("pts"))
        # fallback: pct 0..1
        cum = 0.0
        for b in arr:
            cum += float(b.get("pct", 0))
            if cum >= 0.9:
                return float(b.get("pts"))
    except Exception:
        return None
    return None

def _load_from_csv() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not TABLE_CSV.is_file() or TABLE_CSV.stat().st_size == 0:
        raise FileNotFoundError(f"Cannot find non-empty {TABLE_CSV}")

    df = pd.read_csv(TABLE_CSV)

    if "player" not in df.columns:
        raise ValueError(f"{TABLE_CSV.name} must include a 'player' column")

    # Derive ceiling if the CSV doesn’t provide one, using histogram or common fallbacks
    if "ceiling" not in df.columns:
        if "chart_source_full_ppr" in df.columns:
            df["ceiling"] = df["chart_source_full_ppr"].apply(
                lambda x: _p90_from_hist(x) if pd.notna(x) else None
            )
        else:
            for alt in ["p95", "p90", "total_score_full_ppr_p95", "total_score_full_ppr_p90", "total_score_full_ppr_max"]:
                if alt in df.columns:
                    df["ceiling"] = df[alt]
                    break

    # Common columns
    team_col   = next((c for c in ["team", "Team"] if c in df.columns), None)
    pos_col    = next((c for c in ["position", "Pos", "Position"] if c in df.columns), None)
    ppr_col    = next((c for c in ["total_score_full_ppr", "ppr"] if c in df.columns), None)
    median_col = next((c for c in ["total_score_full_ppr_median", "median", "p50"] if c in df.columns), None)
    ceiling_col = next((c for c in ["ceiling","p90","p95","total_score_full_ppr_p90","total_score_full_ppr_max"] if c in df.columns), None)

    # Extra columns we want to expose AS-IS (numeric coerced; charts kept as strings)
    selected_extra_cols = [
        "pass_tds",
        "player_pass_tds",
        "player_pass_interceptions",
        "player_rush_or_rec_tds",
        "player_reception_yds",
        "player_rush_yds",
        "player_receptions",
        "player_pass_yds",
        "chart_source_half_ppr",  # histogram JSON string (do NOT coerce to float)
    ]
    existing_extra_cols = [c for c in selected_extra_cols if c in df.columns]

    # Build /players
    players: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        name = str(row["player"])
        pid  = _slug(name)
        item: Dict[str, Any] = {"id": pid, "name": name}
        if team_col and pd.notna(row.get(team_col)):
            item["team"] = str(row.get(team_col))
        if pos_col and pd.notna(row.get(pos_col)):
            item["position"] = str(row.get(pos_col))
        players.append(item)

    # Build /projections
    projections: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        name = str(row["player"])
        pid  = _slug(name)
        item: Dict[str, Any] = {"id": pid}

        if ppr_col:     item["ppr"]     = _to_float(row.get(ppr_col))
        if median_col:  item["median"]  = _to_float(row.get(median_col))
        if ceiling_col: item["ceiling"] = _to_float(row.get(ceiling_col))

        for col in existing_extra_cols:
            val = row.get(col)
            # Keep histogram JSON columns as strings; numeric stats -> float
            if isinstance(val, str) and col.startswith("chart_source_"):
                item[col] = val
            else:
                item[col] = _to_float(val)

        projections.append(item)

    return players, projections

def _ensure_fresh_data() -> None:
    """Reload CSV if the file changed since last load."""
    global _TABLE_MTIME, _PLAYERS, _PROJECTIONS
    try:
        mtime = TABLE_CSV.stat().st_mtime
    except FileNotFoundError:
        raise HTTPException(500, f"CSV not found: {TABLE_CSV}")
    if _TABLE_MTIME is None or mtime > _TABLE_MTIME:
        _PLAYERS, _PROJECTIONS = _load_from_csv()
        _TABLE_MTIME = mtime
        print(f"[reload] {TABLE_CSV.name} @ {time.strftime('%H:%M:%S')} (rows: players={len(_PLAYERS)} projections={len(_PROJECTIONS)})")

# ---- FastAPI lifecycle & endpoints ----
@app.on_event("startup")
def _startup():
    _ensure_fresh_data()

@app.get("/")
def root():
    _ensure_fresh_data()
    return {"status": "ok", "docs": "/docs"}

@app.post("/reload")
def manual_reload():
    """Optional: force reload via POST /reload"""
    old = _TABLE_MTIME
    _ensure_fresh_data()
    return {"reloaded": _TABLE_MTIME != old, "csv": str(TABLE_CSV)}

@app.get("/players")
def get_players():
    _ensure_fresh_data()
    if not _PLAYERS:
        raise HTTPException(500, "players not loaded")
    return _PLAYERS

@app.get("/projections")
def get_projections():
    _ensure_fresh_data()
    if not _PROJECTIONS:
        raise HTTPException(500, "projections not loaded")
    return _PROJECTIONS
