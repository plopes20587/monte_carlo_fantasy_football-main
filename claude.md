# NFL Player Compare - Project Documentation

## Project Overview

**NFL Player Compare** is a web application that allows users to compare fantasy football players using Monte Carlo simulations and probability distributions. Users can select two players, view their projected stats, and analyze their scoring distributions across different PPR formats (Full-PPR, Half-PPR, No-PPR).

**Live URL**: [Your deployed URL on Render]

**Repository**: https://github.com/plopes20587/monte_carlo_fantasy_football-main

---

## Goal

Create an interactive, data-driven tool for fantasy football analysis that:

- Helps users make informed decisions when comparing players
- Visualizes probability distributions to show upside and risk
- Supports multiple scoring formats (Full-PPR, Half-PPR, No-PPR)
- Provides a clean, responsive UI optimized for both desktop and mobile

---

## Tech Stack

### Frontend

- **React** (v18+) - UI framework
- **Vite** - Build tool and dev server
- **Recharts** - Data visualization library for charts
- **CSS3** - Custom styling with responsive design
- **PropTypes** - Runtime type checking

### Backend

- **FastAPI** - Python web framework for REST API
- **Uvicorn** - ASGI server
- **Supabase** - PostgreSQL database (managed)
- **Python Supabase Client** - Database interaction

### Deployment

- **Render.com** - Hosting for both frontend (Static Site) and backend (Web Service)
- **GitHub** - Version control and CI/CD trigger

### Development Tools

- **Node.js** - JavaScript runtime
- **Python 3.13** - Backend runtime
- **npm** - Package manager

---

## Project Structure

```
monte_carlo_fantasy_football-main/
├── ff_react/                    # Frontend React application
│   ├── src/
│   │   ├── App.jsx             # Main application component
│   │   ├── App.css             # Application styles
│   │   ├── main.jsx            # React entry point
│   │   ├── index.css           # Global styles
│   │   ├── analytics.js        # Google Analytics integration
│   │   ├── CookieConsent.jsx   # Cookie consent banner component
│   │   └── CookieConsent.css   # Cookie consent styles
│   ├── public/                 # Static assets
│   ├── package.json            # Frontend dependencies
│   ├── vite.config.js          # Vite configuration
│   ├── .env.local              # Local environment variables (not in git)
│   └── .env.example            # Environment variable template
│
├── backend_calcs/              # Backend API
│   ├── api.py                  # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   └── venv/                   # Virtual environment (not in git)
│
├── README.md                   # Project documentation
├── CLAUDE.md                   # Project documentation (this file)
├── ANALYTICS_SETUP.md          # Google Analytics setup guide
└── .gitignore                  # Git ignore rules
```

---

## Key Features

### 1. Player Selection

- **Searchable dropdown** (react-select) with all NFL players
- **Alphabetically sorted** player list for easy browsing
- **Type to search** - filter players by name as you type
- Shows player name, team, and position in format: `Player Name (TEAM POS)`
- Auto-selects first two players on load
- Dark theme styling matching the app design

### 2. Scoring Format Toggle

- Switch between Full-PPR, Half-PPR, and No-PPR
- Dynamically updates stats table and chart
- Persists selection during comparison

### 3. Stats Comparison Table

- Side-by-side player statistics:
  - Pass TDs, Pass INTs, Pass Yards
  - Rush/Rec TDs, Rush Yards, Reception Yards
  - Receptions
  - Scoring format mean and median
- Responsive grid layout

### 4. Distribution Chart

- **Interactive line chart** showing probability distributions
- X-axis: Fantasy points (0-26)
- Y-axis: Probability percentage (0-30%)
- **Vertical dashed lines** showing median projections for each player
- **Color-coded lines**: Blue (Player A), Red (Player B)
- **Hover tooltip** with exact probabilities
- Reduced grid opacity for cleaner look
- Custom styled tooltip with dark theme

### 5. Responsive Design

- Desktop: Two-column layout (table + chart)
- Tablet: Stacked layout with adjusted chart
- Mobile: Optimized spacing, font sizes, and chart dimensions

### 6. UI/UX Enhancements

- Dark theme with blue/slate color scheme
- Non-clickable badge tags (Full-PPR, Half-PPR, No-PPR)
- Clear step-by-step instructions
- Left-aligned text for better readability
- Visible scoring format selector with highlighted border
- Loading states and error handling

### 7. Analytics & Tracking

- **Google Analytics 4 (GA4)** integration for traffic monitoring
- **Cookie consent banner** for privacy compliance
- **Custom event tracking**:
  - Player selections (which players are compared)
  - Scoring format changes
  - Player comparisons
- **Privacy-first approach**: Only tracks if user consents
- **IP anonymization** enabled for GDPR compliance
- Real-time user behavior insights

---

## API Endpoints

### Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://your-backend.onrender.com`

### Endpoints

#### `GET /`

Health check endpoint

```json
{
  "message": "NFL Player Compare API is running!",
  "status": "healthy",
  "endpoints": {
    "players": "/players",
    "projections": "/projections?player_id={id}"
  }
}
```

#### `GET /players`

Returns list of all players

```json
[
  {
    "id": "123",
    "name": "Josh Jacobs",
    "team": "LV",
    "position": "RB"
  },
  ...
]
```

#### `GET /projections?player_id={id}`

Returns projection data for a specific player

```json
{
  "id": "123",
  "player": "Josh Jacobs",
  "pass_tds": 0,
  "rush_yards": 1234.5,
  "receptions": 45.2,
  "total_score_full_ppr_median": 15.3,
  "total_score_half_ppr_median": 13.1,
  "total_score_no_ppr_median": 10.9,
  "chart_source_full_ppr": [
    {"x": 0, "y": 0.5},
    {"x": 1, "y": 1.2},
    ...
  ],
  "chart_source_half_ppr": [...],
  "chart_source_no_ppr": [...]
}
```

---

## Data Flow

### 1. Initial Load

```
User visits app
  ↓
Frontend calls GET /players
  ↓
Backend queries Supabase chart_source table
  ↓
Returns sorted player list
  ↓
Frontend auto-selects first two players
  ↓
Calls GET /projections for both players
  ↓
Displays stats and chart
```

### 2. Player Selection Change

```
User selects new player from dropdown
  ↓
State updates (setA or setB)
  ↓
useEffect triggers
  ↓
Calls GET /projections?player_id={newId}
  ↓
Updates projA or projB state
  ↓
Table and chart re-render with new data
```

### 3. Scoring Format Change

```
User changes scoring format dropdown
  ↓
setScoringFormat updates state
  ↓
useMemo recalculates:
  - STAT_ROWS (updates mean/median labels)
  - aSeries/bSeries (pulls correct chart_source_*)
  - chartData (rebuilds merged dataset)
  ↓
Chart and table re-render
```

---

## Database Schema (Supabase)

### Table: `chart_source`

| Column                      | Type    | Description                               |
| --------------------------- | ------- | ----------------------------------------- |
| id                          | text    | Primary key, player ID                    |
| player                      | text    | Player full name                          |
| nfl_team                    | text    | NFL team abbreviation                     |
| position                    | text    | Position (QB, RB, WR, TE)                 |
| pass_tds                    | numeric | Passing touchdowns projection             |
| pass_interceptions          | numeric | Passing interceptions projection          |
| pass_yards                  | numeric | Passing yards projection                  |
| rush_rec_tds                | numeric | Combined rushing/receiving TDs            |
| reception_yards             | numeric | Receiving yards projection                |
| rush_yards                  | numeric | Rushing yards projection                  |
| receptions                  | numeric | Receptions projection                     |
| total_score_full_ppr_median | numeric | Median fantasy score (Full PPR)           |
| total_score_half_ppr_median | numeric | Median fantasy score (Half PPR)           |
| total_score_no_ppr_median   | numeric | Median fantasy score (No PPR)             |
| chart_source_full_ppr       | jsonb   | Array of {x, y} points for Full PPR chart |
| chart_source_half_ppr       | jsonb   | Array of {x, y} points for Half PPR chart |
| chart_source_no_ppr         | jsonb   | Array of {x, y} points for No PPR chart   |

---

## Environment Variables

### Backend (`backend_calcs`)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
PYTHON_VERSION=3.13.0
```

### Frontend (`ff_react`)

```bash
VITE_API_BASE=https://your-backend.onrender.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Deployment Setup

### Backend on Render

1. **Service Type**: Web Service
2. **Build Command**: (leave blank or `pip install -r requirements.txt`)
3. **Start Command**: `uvicorn api:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `PYTHON_VERSION=3.13.0`
5. **Health Check Path**: `/`
6. **Root Directory**: `backend_calcs`

### Frontend on Render

1. **Service Type**: Static Site
2. **Root Directory**: `ff_react`
3. **Build Command**: `npm install && npm run build`
4. **Publish Directory**: `dist`
5. **Environment Variables**:
   - `VITE_API_BASE=https://your-backend.onrender.com`
   - `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` (your Google Analytics 4 measurement ID)

### Keeping Backend Awake (Free Tier)

Use **UptimeRobot** (free) to ping backend every 5 minutes:

- Monitor Type: HTTP(s)
- URL: `https://your-backend.onrender.com/`
- Interval: 5 minutes

---

## Key Code Patterns

### 1. Stat Resolution (Regex-Based)

The app uses flexible regex matching to find stats in the flattened projection object:

```javascript
const STAT_ROWS = [
  {
    label: "pass tds",
    rules: {
      include: [/pass|passing/, /td/],
      exclude: [/sample|chart/],
    },
  },
];
```

This allows the app to adapt to different data structures from the API.

### 2. Dynamic Scoring Format

Stats and charts update based on `scoringFormat` state:

```javascript
const chartKey = `chart_source_${scoringFormat}`; // e.g., "chart_source_half_ppr"
const medianKey = `total_score_${scoringFormat}_median`;
```

### 3. Chart Data Merging

Both player series are merged into a single dataset for Recharts:

```javascript
const chartData = xVals.map((x) => ({
  x,
  A: aSeries?.find((d) => d.x === x)?.y ?? null,
  B: bSeries?.find((d) => d.x === x)?.y ?? null,
}));
```

---

## Styling Decisions

### Color Scheme

- **Background**: Dark slate (`#0f172a`, `#1e293b`)
- **Primary**: Blue (`#3b82f6`, `#2563eb`)
- **Secondary**: Red (`#ef4444`)
- **Text**: Light gray/white (`#e5e7eb`, `#f1f5f9`)
- **Muted Text**: Slate gray (`#94a3b8`)

### Responsive Breakpoints

- **Desktop**: > 768px (two-column layout)
- **Tablet**: 480px - 768px (stacked layout)
- **Mobile**: < 480px (compact, optimized)

### Chart Customization

- Grid opacity: 15% (subtle)
- Line stroke width: 3px
- Tooltip: Dark theme with rounded corners
- Median lines: Dashed, color-matched

---

## Common Issues & Solutions

### Issue: Backend shows "Invalid API key"

**Solution**: Add environment variables in Render:

- `SUPABASE_URL`
- `SUPABASE_KEY`

### Issue: CORS errors

**Solution**: Update `allow_origins` in `api.py` to include frontend URL

### Issue: Backend keeps shutting down (free tier)

**Solution**: Set up UptimeRobot to ping every 5 minutes

### Issue: Chart not rendering

**Solution**: Check that `chart_source_*` data exists in Supabase for selected players

### Issue: Players not loading

**Solution**:

1. Check backend `/players` endpoint directly
2. Verify Supabase connection
3. Check browser console for errors

### Issue: Analytics not tracking

**Solution**:

1. Verify `VITE_GA_MEASUREMENT_ID` is set in environment variables
2. Check that cookie consent banner was accepted
3. Open browser console and look for "Google Analytics initialized"
4. Use GA4 DebugView or Realtime reports to verify events
5. Disable ad blockers for testing
6. See `ANALYTICS_SETUP.md` for detailed troubleshooting

---

## Future Enhancements

### Planned Features

- [x] Analytics integration (Google Analytics 4) ✅
- [x] Cookie consent banner for privacy compliance ✅
- [x] Adjust chart x-axis to show points in increments of 2 instead of 1 ✅
- [x] Dynamic y-axis ceiling (20% default, extends if data exceeds) with 2% tick increments ✅
- [x] Add player search functionality in dropdowns (react-select with dark theme styling) ✅
- [ ] Add position filtering (QB, RB, WR, TE)
- [ ] Add "Share Comparison" feature (URL with query params)
- [ ] Add weekly projections instead of season-long

### Technical Improvements

- [ ] Add rate limiting on API
- [ ] Add comprehensive error boundaries
- [ ] Add unit tests (Jest, React Testing Library)
- [ ] Add E2E tests (Playwright)
- [ ] Add performance monitoring (Sentry)
- [ ] Implement code splitting for faster loads

---

## Development Commands

### Frontend

```bash
cd ff_react
npm install              # Install dependencies
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build
```

### Backend

```bash
cd backend_calcs
python -m venv venv                    # Create virtual environment
source venv/bin/activate               # Activate (Mac/Linux)
venv\Scripts\activate                  # Activate (Windows)
pip install -r requirements.txt        # Install dependencies
uvicorn api:app --reload --port 8000   # Start dev server
```

### Deployment

```bash
git add .
git commit -m "Your commit message"
git push origin main                   # Triggers auto-deploy on Render
```

---

## Important Notes

1. **Free Tier Limitations**:

   - Backend spins down after 15 min inactivity
   - First request after spin-down takes 30-60 seconds
   - Use UptimeRobot to keep it awake

2. **Data Updates**:

   - Player data comes from Supabase `chart_source` table
   - To add/update players, modify data in Supabase directly
   - Changes reflect immediately (no cache)

3. **Browser Compatibility**:

   - Tested on Chrome, Firefox, Safari, Edge
   - Mobile optimized for iOS Safari and Chrome Android

4. **Performance**:
   - Initial load: ~2-3 seconds (includes player list)
   - Player switch: ~500ms (projection fetch)
   - Scoring format change: Instant (client-side only)

---

## Contact & Support

- **Developer**: Pat Lopes
- **GitHub**: https://github.com/plopes20587
- **Repository Issues**: https://github.com/plopes20587/monte_carlo_fantasy_football-main/issues

---

## Version History

- **v1.0** (Current) - Initial deployment with core features
  - Player comparison
  - Multi-format scoring (Full-PPR, Half-PPR, No-PPR)
  - Interactive distribution charts
  - Responsive design
  - Deployed on Render.com

---

**Last Updated**: October 23, 2025
