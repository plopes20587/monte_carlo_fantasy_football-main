#!/usr/bin/env bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend_calcs/requirements.txt
uvicorn backend_calcs.api:app --reload --port 8000