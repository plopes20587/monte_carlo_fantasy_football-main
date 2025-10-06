from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json

app = FastAPI()

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PROJ_DIR = DATA_DIR / "projections"

# Lazy load players list
players = []

def load_players():
    global players
    if not players:
        players_file = DATA_DIR / "players.json"
        if not players_file.exists():
            raise HTTPException(
                status_code=500,
                detail="Players data not found. Please run csv_to_json.py first."
            )
        with open(players_file) as f:
            players = json.load(f)
    return players

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/projections")
def get_projection(player_id: str = Query(...)):
    # Normalize to dash format (what csv_to_json.py creates)
    normalized_id = player_id.lower().strip().replace("_", "-")
    
    # Load individual projection file
    proj_file = PROJ_DIR / f"{normalized_id}.json"
    
    if not proj_file.exists():
        raise HTTPException(
            status_code=404, 
            detail=f"Player projection not found: {player_id}"
        )
    
    with open(proj_file) as f:
        projection = json.load(f)
    
    # Ensure ID matches request format
    projection["id"] = normalized_id
    
    return projection

@app.get("/players")
def get_players():
    return load_players()