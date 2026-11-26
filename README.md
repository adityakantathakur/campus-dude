# Campus Dude - Part 1 setup
Structure: backend/ (Express + PostgreSQL), frontend/src/App.jsx (React + Tailwind + lucide-react)

## Backend
cd backend && cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm install && psql "$DATABASE_URL" -f schema.sql && npm start

## Frontend
npm create vite@latest frontend -- --template react   # choose React/JavaScript; keep existing src/App.jsx when asked (or copy it back after)
cd frontend && npm install lucide-react tailwindcss @tailwindcss/vite
# vite.config.js: import tailwindcss from '@tailwindcss/vite' and add tailwindcss() to plugins
# src/index.css: replace contents with  @import "tailwindcss";
npm run dev   # http://localhost:5173

## Part 2 (images, AI, tracking)
cd backend && npm install && psql "$DATABASE_URL" -f schema_part2.sql
# add ANTHROPIC_API_KEY to backend/.env, then: npm start
# Pictures are saved in backend/uploads (swap to Supabase Storage when deploying).

## Go live
1. Database: create a free Supabase project, open SQL Editor, run schema.sql then schema_part2.sql. Copy the Postgres connection string.
2. Backend: push this repo to GitHub. On render.com create a Web Service: root directory `backend`, build `npm install`, start `npm start`.
   Env vars: DATABASE_URL, JWT_SECRET (long random text), ANTHROPIC_API_KEY, CLIENT_URL (your Netlify URL, no trailing slash).
3. Frontend: on netlify.com choose Add new site > Import from GitHub (netlify.toml is already set). Add env var VITE_API_URL = your Render URL. Deploy.
4. Make an admin: register normally, then run in Supabase SQL: UPDATE users SET role='admin' WHERE email='you@university.edu';
Note: Render's free disk is wiped on restart, so uploaded pictures disappear. Move uploads to Supabase Storage before real use.
