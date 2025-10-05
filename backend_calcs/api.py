# backend_calcs/api.py
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path
import json
from functools import lru_cache

app = FastAPI(title="Monte Carlo Fantasy Football API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"
PLAYERS_PATH = DATA_DIR / "players.json"
PROJ_DIR = DATA_DIR / "projections"

# ---------- Models

class Player(BaseModel):
    id: str
    name: str
    team: str
    position: str

class ChartPoint(BaseModel):
    x: float
    cdf: float = Field(ge=0.0, le=1.0)

class Projection(BaseModel):
    ppr: Optional[float] = None
    median: Optional[float] = None
    ceiling: Optional[float] = None
    pass_tds: Optional[float] = None
    chart_source_half_ppr: List[ChartPoint] = []

# ---------- File helpers + caches

def _players_mtime() -> float:
    # Return 0 if the file isn't there yet (lets / return ok and /players return [])
    return PLAYERS_PATH.stat().st_mtime if PLAYERS_PATH.exists() else 0.0

@lru_cache(maxsize=1)
def _load_players_cached(mtime: float) -> List[Player]:
    # mtime is part of the cache key, so cache busts when the file changes
    with PLAYERS_PATH.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return [Player(**p) for p in raw]

def _proj_path(pid: str) -> Path:
    return PROJ_DIR / f"{pid}.json"

@lru_cache(maxsize=512)
def _load_projection_cached(pid: str, mtime: float) -> Projection:
    # mtime in key => bust cache when that player's file changes
    path = _proj_path(pid)
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return Projection(**raw)

# ---------- Routes

@app.get("/", tags=["health"])
def health():
    # Expose a data version number for quick debugging
    ver = int(_players_mtime()) if PLAYERS_PATH.exists() else 0
    return {"ok": True, "data_version": ver}

@app.get("/players", response_model=List[Player], tags=["players"])
def get_players():
    if not PLAYERS_PATH.exists():
        return []  # or raise 503 if you prefer
    return _load_players_cached(_players_mtime())

@app.get("/projections", response_model=Projection, tags=["projections"])
def get_projection(player_id: str = Query(..., min_length=1)):
    p = _proj_path(player_id)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"No projections for player_id={player_id}")
    return _load_projection_cached(player_id, p.stat().st_mtime)

@lru_cache(maxsize=512)
def _load_projection_cached(pid: str, mtime: float) -> Projection:
    path = _proj_path(pid)
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    # --- normalize & sanitize chart points ---
    pts = []
    for item in raw.get("chart_source_half_ppr", []):
        try:
            x = float(item.get("x"))
            cdf = float(item.get("cdf"))
            # If CSV/JSON stored percentages (0..100), convert to probability (0..1)
            if cdf > 1:
                cdf = cdf / 100.0
            # keep only finite & in-range
            if 0.0 <= cdf <= 1.0:
                pts.append({"x": x, "cdf": cdf})
        except Exception:
            continue
    pts.sort(key=lambda d: d["x"])
    raw["chart_source_half_ppr"] = pts

    # (Optional) coerce top-level numeric fields if they were strings
    for k in ("ppr", "median", "ceiling", "pass_tds"):
        if k in raw and raw[k] not in (None, ""):
            try:
                raw[k] = float(raw[k])
            except Exception:
                raw[k] = None

    return Projection(**raw)
