# TrueLineBetting — Starter

A sleek, luxury-themed static site for a sports betting dashboard (MLB, NFL, NBA). Built with vanilla HTML/CSS/JS so you can deploy anywhere fast (Vercel, Netlify, S3, GitHub Pages).

## Features
- Dark luxury theme with gold accents
- Sticky header and responsive layout
- Dashboard KPIs + demo odds tables for MLB/NFL/NBA
- Click-to-add parlay bet slip with live potential payout
- Hash-based router (`#dashboard`, `#mlb`, `#nfl`, `#nba`)

## Getting Started
1. Download and unzip this project.
2. Open `index.html` in a browser to preview locally.
3. (Optional) Serve with a local server for better routing:
   - Python: `python3 -m http.server 5500`
   - Node: `npx serve .`
4. Deploy to Vercel:
   - Create a new project → drag-and-drop this folder → Deploy.

## Wiring Real Odds
Replace `state.sampleOdds` in `app.js` with live data from your provider (e.g., The Odds API, Pinnacle, etc.). Map into the same shape the demo uses and re-render.

## Customization
- Colors/feel: tweak CSS variables at the top of `styles.css`.
- Logo: replace `assets/logo.svg`.
- Pages: add more routes in `app.js` or split files as you grow.

## Notes
- This is a demo; no real-money wagering is processed.
- Add responsible gaming messaging/links per your jurisdiction.
