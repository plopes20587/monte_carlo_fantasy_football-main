from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse  # ✅ ADD THIS LINE
from pathlib import Path
import csv
import json
import pandas as pd

app = FastAPI()


# Load projections.json
with open("backend_calcs/data/projections.json") as f:
    projections = json.load(f)

# Load table_setup.csv
df_table = pd.read_csv("backend_calcs/data/table_setup.csv")

# Normalize IDs (dash-slug)
def normalize_id(name):
    return name.strip().lower().replace(" ", "_").replace("-", "_")

# Map table_setup.csv by normalized player name
table_data = {
    normalize_id(row["player"]): row.to_dict()
    for _, row in df_table.iterrows()
}

with open("backend_calcs/data/players.json") as f:
    players = json.load(f)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"

@app.get("/projections")
def get_projection(player_id: str = Query(...)):
    slug_id = player_id.lower().strip()
    underscore_id = slug_id.replace("-", "_")

    # Find base projection
    proj = next((p for p in projections if normalize_id(p["id"]) == underscore_id), None)
    if not proj:
        return JSONResponse(status_code=404, content={"error": "Player not found in projections.json"})

    # Merge in extra stats from table_setup.csv
    table_stats = table_data.get(underscore_id, {})
    full_data = {**proj, **table_stats, "id": slug_id}

    # Coerce number-like strings into numbers, leave blanks as null
    for k, v in full_data.items():
        if isinstance(v, str):
            try:
                full_data[k] = float(v)
            except ValueError:
                if v.strip() == "":
                    full_data[k] = None

    return full_data

@app.get("/players")
def get_players():
    return players
