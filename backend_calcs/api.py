from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow the React dev server to call us during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: replace these lists with real loads from your data
# e.g., read CSVs/Parquet or compute from your notebooks.
def load_players():
    return [
        {"id": "patrick-mahomes", "name": "Patrick Mahomes", "team": "KC", "position": "QB"},
        {"id": "christian-mccaffrey", "name": "Christian McCaffrey", "team": "SF", "position": "RB"},
    ]

def load_projections():
    return [
        {"id": "patrick-mahomes", "ppr": 22.1, "median": 21, "ceiling": 35},
        {"id": "christian-mccaffrey", "ppr": 24.8, "median": 23, "ceiling": 40},
    ]

@app.get("/players")
def players():
    return load_players()

@app.get("/projections")
def projections():
    return load_projections()

