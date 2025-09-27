from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pathlib import Path

app = FastAPI()

# Allow the React dev server to call us during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent  # adjust if your files are elsewhere

def load_players():
    # TODO: replace with your real source (CSV, parquet, DB, or code that builds the table)
    # Example CSV:
    # df = pd.read_csv(DATA_DIR / "players.csv")
    # return df[["id","name","team","position"]].to_dict(orient="records")
    return [
        {"id":"patrick-mahomes","name":"Patrick Mahomes","team":"KC","position":"QB"},
        {"id":"christian-mccaffrey","name":"Christian McCaffrey","team":"SF","position":"RB"},
    ]

def load_projections():
    # TODO: replace with real source/logic (e.g., read your Monte Carlo results and compute percentiles)
    # Must return records with id,ppr,median,ceiling
    return [
        {"id":"patrick-mahomes","ppr":22.1,"median":21,"ceiling":35},
        {"id":"christian-mccaffrey","ppr":24.8,"median":23,"ceiling":40},
    ]

@app.get("/players")
def players():
    return load_players()

@app.get("/projections")
def projections():
    return load_projections()
