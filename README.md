# NFL Player Compare - Monte Carlo Fantasy Football

Compare NFL players using Monte Carlo simulation projections with probability distributions for Full-PPR, Half-PPR, and No-PPR scoring formats.

## Features

- Compare two NFL players side-by-side
- View mean and median projections
- Interactive probability distribution charts
- Switch between Full-PPR, Half-PPR, and No-PPR formats
- Data stored in Supabase for easy updates
- Responsive design for mobile and desktop

## Prerequisites

- Python 3.13+
- Node.js 18+ and npm
- Supabase account (data already configured)

## Setup Instructions

### 1. Clone the Repository
git clone https://github.com/plopes20587/monte_carlo_fantasy_football-main.git
cd monte_carlo_fantasy_football-main

### 2. Backend Setup
cd backend_calcs

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn api:app --reload --host 0.0.0.0 --port 8000

### 3. Frontend Setup

cd ff_react

# Install dependencies
npm install

# Start development server
npm run dev

### 4. Access the Application

## Project Structure
monte_carlo_fantasy_football-main/
├── backend_calcs/
│   ├── api.py              # FastAPI backend
│   ├── requirements.txt    # Python dependencies
│   └── venv/              # Virtual environment (created on setup)
├── ff_react/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   └── App.css        # Styles
│   ├── package.json       # Node dependencies
│   └── vite.config.js     # Vite configuration
└── README.md

### 5. Database
The application uses Supabase as the database. Player data and projections are stored in the chart_source table with the following schema:

id - Player ID
player - Player name
Statistical fields (pass_tds, rush_yds, etc.)
chart_source_full_ppr - Full PPR probability distribution (JSON)
chart_source_half_ppr - Half PPR probability distribution (JSON)
chart_source_no_ppr - No PPR probability distribution (JSON)


# Adding New Players
To add new players to the comparison tool:

Go to Supabase Dashboard
Navigate to your project → Table Editor → chart_source
Click Insert row and fill in all fields
Chart data must be in format: [{"pts": 0, "pct": 2.3}, {"pts": 1, "pct": 5.1}, ...]
New players will appear immediately in the dropdown (no code changes needed)


### Technologies Used

Frontend: React, Vite, Recharts
Backend: FastAPI, Python
Database: Supabase (PostgreSQL)
Styling: CSS

# Backend API Endpoints

GET /players - Returns list of all players
GET /projections?player_id={id} - Returns projection data for a specific player


### Quick Start

# Backend
- `backend_calcs/` — FastAPI backend 
    ./scripts/dev_backend.sh

# Frontend
- `ff_react/` — Vite/React frontend 
    ./scripts/dev_frontend.sh

    
### Requirements
Python 3.8+
Node.js 16+
npm

### Contributing

Fork the repository
Create a feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request


