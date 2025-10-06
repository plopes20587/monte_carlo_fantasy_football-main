#!/bin/bash

# Get script location and move to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting NFL Player Compare Backend${NC}\n"

# Check if we're in the right directory
if [ ! -d "backend_calcs" ]; then
    echo -e "${RED}Error: backend_calcs directory not found${NC}"
    echo "Please ensure you're running this from the project root"
    exit 1
fi

# Navigate to backend directory
cd backend_calcs

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating one...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${GREEN}Activating virtual environment...${NC}"
source venv/bin/activate

# Install/update dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
pip install -q --upgrade pip
pip install -q fastapi uvicorn pandas

# Check if data files exist
if [ ! -f "table_setup.csv" ]; then
    echo -e "${RED}Error: table_setup.csv not found in backend_calcs/${NC}"
    exit 1
fi

# Check if data directory and projection files exist
if [ ! -d "data/projections" ] || [ -z "$(ls -A data/projections 2>/dev/null)" ]; then
    echo -e "${YELLOW}Projection files not found. Running csv_to_json.py...${NC}"
    python csv_to_json.py
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to generate projection files${NC}"
        exit 1
    fi
    echo -e "${GREEN}Projection files generated successfully${NC}\n"
fi

# Check if api.py exists
if [ ! -f "api.py" ]; then
    echo -e "${RED}Error: api.py not found in backend_calcs/${NC}"
    exit 1
fi

# Kill any existing uvicorn processes on port 8000
if lsof -ti:8000 > /dev/null 2>&1; then
    echo -e "${YELLOW}Port 8000 is in use. Killing existing process...${NC}"
    kill -9 $(lsof -ti:8000) 2>/dev/null
    sleep 1
fi

# Start the FastAPI backend
echo -e "${GREEN}Starting FastAPI backend on http://localhost:8000${NC}"
echo -e "${GREEN}API Documentation: http://localhost:8000/docs${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}\n"

uvicorn api:app --reload --host 0.0.0.0 --port 8000