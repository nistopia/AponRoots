# 🌳 AponRoots

A modern family tree app. Add people and their parents — AponRoots automatically computes every relationship in your family (siblings, cousins, great-aunts, second cousins twice removed, etc.).

## Architecture

Monorepo:
- `backend/` — FastAPI + SQLite (Python). Shared by web & future mobile.
- `web/` — Next.js (React + TypeScript).
- `mobile/` — React Native (planned).

## Quick Start

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# API docs: http://localhost:8000/docs
```

### Web
```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

## Core Idea

We store only **parent → child** edges. Every other relationship (siblings, cousins, ancestors, descendants) is derived using:
1. BFS to find ancestors of each person with depth
2. Lowest Common Ancestor (LCA)
3. Naming function: `(distance_a, distance_b) → "first cousin once removed"`

See `backend/app/relationship.py` for the algorithm.
