# NFL Player Comparison Tool

A React + FastAPI web application for comparing NFL player projections and probability distributions for Half-PPR fantasy football scoring.

## Features

- Side-by-side player comparison with statistical projections
- Interactive distribution chart showing probability of point outcomes
- Support for multiple PPR scoring formats
- Clean, responsive UI

## Project Structure
monte_carlo_fantasy_football-main/
├── backend_calcs/          # FastAPI backend
│   ├── api.py             # API endpoints
│   ├── csv_to_json.py     # Data converter
│   ├── table_setup.csv    # Source player data
│   └── data/              # Generated JSON files
├── ff_react/              # React frontend
│   └── src/
│       ├── App.jsx        # Main component
│       └── App.css        # Styles
└── scripts/               # Utility scripts
└── dev_backend.sh     # Backend startup script

## Quick Start

### Backend
- `backend_calcs/` — FastAPI backend 
    ./scripts/dev_backend.sh

### Frontend
- `ff_react/` — Vite/React frontend 
    ./scripts/dev_frontend.sh

    
## Requirements
Python 3.8+
Node.js 16+
npm




