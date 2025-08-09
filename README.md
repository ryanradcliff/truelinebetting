# TrueLineBetting v3 — Live Odds Prep

This version adds a Vercel Serverless Function and a front-end toggle to fetch **live odds** while keeping your API key **secret**.

## What’s new
- `/api/odds` serverless function (Vercel) that proxies to **The Odds API**
- Front-end **Live odds** toggle (persists in localStorage)
- Demo fallback if API fails or is off

## Setup on Vercel
1) Get an API key from **The Odds API** (or switch provider in `api/odds.js`).
2) In Vercel: Project → **Settings → Environment Variables** → add:
   - **Name:** `ODDS_API_KEY`
   - **Value:** *your key*
   - Target: Production (and Preview if you want)
3) Click **Redeploy** (or make any commit).

## How it works
- Front-end calls `/api/odds?league=mlb|nfl|nba`.
- The serverless function uses `ODDS_API_KEY` and returns normalized rows:
  ```json
  { "league": "mlb", "rows": [ { "time": "7:05 PM", "matchup": "NYY @ BOS", "mlAway": -112, "mlHome": +104, "spreadAway": "-1.5 (+150)", "spreadHome": "+1.5 (-175)", "total": "O 8.5 (-105) / U 8.5 (-115)" } ] }
  ```
- UI maps rows into the existing table and bet slip.

## Local dev (optional)
- You can run a static server and hit `/api/odds` on Vercel, or set a local proxy and a `.env` with `ODDS_API_KEY` if using a local serverless runtime.

## Notes
- API limits and pricing vary; The Odds API free tier has limited calls—consider caching or rate limiting in `api/odds.js`.
- You can change bookmakers (e.g., `pinnacle`) by editing `bookmakers` in `api/odds.js`.
