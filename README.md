# TrueLineBetting v4 — AI Picks + Win Rate + Rationale

Adds AI-assisted pick generation using live odds:
- Serverless: `/api/picks` (uses The Odds API via `ODDS_API_KEY`)
- UI: Picks page with filters (league, profile, markets, max) + "Generate Picks"
- Output shows **win rate (model probability)**, **edge%**, **fair odds**, and a **Why** explainer
- "Add to Slip" button on each pick

## Setup
1) In Vercel → Project → **Settings → Environment Variables**:
   - `ODDS_API_KEY` = your The Odds API key
2) Deploy (commit or Redeploy).

## Use
- Dashboard: "Quick AI Picks" buttons generate balanced picks per league.
- Picks page: set filters → Generate Picks.
- Add any pick to your bet slip to see potential payout calculations.

> This model is a simple placeholder (home edge, underdog value). Swap in your own ELO/ML model later for stronger predictions.
