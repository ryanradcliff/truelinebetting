// Vercel Serverless Function: /api/odds
// Proxies requests to The Odds API to keep your API key secret.
// Usage: /api/odds?league=mlb|nfl|nba

export default async function handler(req, res) {
  try {
    const { league = "mlb" } = req.query;
    const key = process.env.ODDS_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "Missing ODDS_API_KEY env var in Vercel." });
    }

    // Map our leagues to The Odds API sport keys
    const sportMap = {
      mlb: "baseball_mlb",
      nfl: "americanfootball_nfl",
      nba: "basketball_nba",
    };
    const sport = sportMap[league.toLowerCase()] || sportMap.mlb;

    const params = new URLSearchParams({
      regions: "us",
      markets: "h2h,spreads,totals",
      oddsFormat: "american",
      bookmakers: "draftkings",
      apiKey: key,
    });

    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(r.status).json({ error: `Upstream error ${r.status}`, detail: txt });
    }
    const data = await r.json();

    // Normalize to our front-end shape
    // We collapse markets per game into one row with moneyline/spread/total choices.
    const rows = data.slice(0, 10).map((game) => {
      const commence = game.commence_time; // ISO time
      const time = new Date(commence).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"});

      // Find DraftKings bookmaker (we requested only one, but just in case)
      const bk = (game.bookmakers || [])[0] || {};
      const markets = bk.markets || [];

      // Helpers to extract prices
      const findMarket = (key) => markets.find(m => (m.key === key) || (m.key === key.toUpperCase()));
      const h2h = findMarket("h2h");
      const spreads = findMarket("spreads");
      const totals = findMarket("totals");

      // Moneyline
      let mlAway = null, mlHome = null;
      if (h2h && h2h.outcomes) {
        const away = h2h.outcomes.find(o => o.name === game.away_team);
        const home = h2h.outcomes.find(o => o.name === game.home_team);
        mlAway = away?.price ?? null;
        mlHome = home?.price ?? null;
      }

      // Spread (take first point)
      let spreadAway = null, spreadHome = null;
      if (spreads && spreads.outcomes) {
        const away = spreads.outcomes.find(o => o.name === game.away_team);
        const home = spreads.outcomes.find(o => o.name === game.home_team);
        if (away && home) {
          spreadAway = `${away.point > 0 ? "+" : ""}${away.point} (${away.price > 0 ? "+"+away.price : away.price})`;
          spreadHome = `${home.point > 0 ? "+" : ""}${home.point} (${home.price > 0 ? "+"+home.price : home.price})`;
        }
      }

      // Totals (use Over/Under entry closest to market)
      let totalStr = null;
      if (totals && totals.outcomes) {
        const over = totals.outcomes.find(o => /over/i.test(o.name));
        const under = totals.outcomes.find(o => /under/i.test(o.name));
        if (over && under) {
          const fmt = (o) => `${o.name[0].toUpperCase()} ${o.point} (${o.price > 0 ? "+"+o.price : o.price})`;
          totalStr = `${fmt(over)} / ${fmt(under)}`;
        }
      }

      return {
        time,
        matchup: `${game.away_team} @ ${game.home_team}`,
        mlAway,
        mlHome,
        spreadAway: spreadAway || "",
        spreadHome: spreadHome || "",
        total: totalStr || "",
      };
    });

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
    res.status(200).json({ league, rows });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
