import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import json

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://monte-carlo-fantasy-football-main-front.onrender.com",  # Add your actual frontend URL
        "*"  # Temporarily allow all for testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase_url = os.getenv("SUPABASE_URL", "https://bipllavdnhnenirrhjfc.supabase.co")
supabase_key = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcGxsYXZkbmhuZW5pcnJoamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MDExNzEsImV4cCI6MjA3NTI3NzE3MX0.oW5R9HL9djP4oqJEsFNzZeNqJHmL2M3FJkaytnOCv0Q")
supabase: Client = create_client(supabase_url, supabase_key)

# Hardcoded credentials
#supabase_url = "https://bipllavdnhnenirrhjfc.supabase.co"
#supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcGxsYXZkbmhuZW5pcnJoamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MDExNzEsImV4cCI6MjA3NTI3NzE3MX0.oW5R9HL9djP4oqJEsFNzZeNqJHmL2M3FJkaytnOCv0Q"
#supabase: Client = create_client(supabase_url, supabase_key)

@app.get("/")
async def root():
    return {
        "message": "NFL Player Compare API is running!",
        "status": "healthy",
        "endpoints": {
            "players": "/players",
            "projections": "/projections?player_id={id}"
        }
    }

@app.get("/players")
def get_players():
    """Fetch all players from Supabase"""
    try:
        response = supabase.table("chart_source").select("id, player").execute()
        
        players = [
            {
                "id": str(row["id"]),
                "name": row["player"],
                "team": "",
                "position": ""
            }
            for row in response.data
        ]
        
        return players
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projections")
def get_projection(player_id: str = Query(...)):
    """Fetch projection for a specific player from Supabase"""
    try:
        try:
            numeric_id = int(player_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid player_id format: {player_id}"
            )
        
        response = supabase.table("chart_source")\
            .select("*")\
            .eq("id", numeric_id)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Projection not found for player_id: {player_id}"
            )
        
        data = response.data[0]
        
        # Transform chart data: pts/pct to x/y (probability mass, not cumulative)
        # Transform chart data: pts/pct to x/y (convert percentage to simulation counts)
       # Transform chart data: pts/pct to x/y (keep as percentages)
        # Transform chart data: pts/pct to x/y (keep as percentages)
        def transform_chart_data(chart_data):
            if not chart_data:
                return []
            transformed = []
            for point in chart_data:
                transformed.append({
                    "x": point.get("pts"),
                    "y": float(point.get("pct", 0))  # Keep as percentage
                })
            return transformed
        
        return {
            "id": str(data["id"]),
            "player": data["player"],
            "ppr": data.get("total_score_half_ppr"),
            "median": data.get("total_score_half_ppr_median"),
            "ceiling": None,
            "pass_tds": data.get("pass_tds"),
            "pass_interceptions": data.get("pass_interceptions"),
            "rush_rec_tds": data.get("rush_or_rec_tds"),
            "rushing_yards": data.get("rush_yds"),
            "reception_yards": data.get("reception_yds"),
            "receptions": data.get("receptions"),
            "passing_yards": data.get("pass_yds"),
            "total_score_full_ppr": data.get("total_score_full_ppr"),
            "total_score_full_ppr_median": data.get("total_score_full_ppr_median"),
            "total_score_half_ppr": data.get("total_score_half_ppr"),
            "total_score_half_ppr_median": data.get("total_score_half_ppr_median"),
            "total_score_no_ppr": data.get("total_score_no_ppr"),
            "total_score_no_ppr_median": data.get("total_score_no_ppr_median"),
            "chart_source_half_ppr": transform_chart_data(data.get("chart_source_half_ppr", [])),
            "chart_source_full_ppr": transform_chart_data(data.get("chart_source_full_ppr", [])),
            "chart_source_no_ppr": transform_chart_data(data.get("chart_source_no_ppr", []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))