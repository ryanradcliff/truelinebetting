// /api/picks — AI-assisted pick finder
// Inputs (query): league=mlb|nfl|nba, markets=ml,spread,total (comma list), profile=conservative|balanced|aggressive, max=number
// Uses The Odds API via ODDS_API_KEY, computes implied prob, a simple model prob, fair line, edge%, winRate, and rationale.
const SPORT_MAP = { mlb: "baseball_mlb", nfl: "americanfootball_nfl", nba: "basketball_nba" };

function impliedFromAmerican(price){
  if(price == null) return null;
  if(price > 0) return 100 / (price + 100);
  return (-price) / ((-price) + 100);
}
function americanFromProb(p){
  if(p <= 0) return null;
  if(p >= 1) return null;
  // decimal = 1/(p) ; american depends
  const dec = 1 / p;
  if(dec >= 2) { // underdog
    return Math.round((dec - 1) * 100);
  } else {
    return -Math.round(100 / (dec - 1));
  }
}
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

export default async function handler(req, res){
  try{
    const key = process.env.ODDS_API_KEY;
    if(!key){ return res.status(500).json({ error: "Missing ODDS_API_KEY" }); }
    const league = (req.query.league || "mlb").toLowerCase();
    const sport = SPORT_MAP[league] || SPORT_MAP.mlb;
    const marketsParam = (req.query.markets || "ml,spread,total").toLowerCase();
    const markets = new Set(marketsParam.split(",").map(s=>s.trim()).filter(Boolean));
    const profile = (req.query.profile || "balanced").toLowerCase(); // conservative/balanced/aggressive
    const maxPicks = Math.min(parseInt(req.query.max || "4", 10) || 4, 12);

    // thresholds by profile
    const thresholds = {
      conservative: 0.02, // 2% edge
      balanced: 0.05,     // 5%
      aggressive: 0.08    // 8%
    };
    const minEdge = thresholds[profile] ?? thresholds.balanced;

    // Fetch odds
    const params = new URLSearchParams({
      regions: "us",
      markets: "h2h,spreads,totals",
      oddsFormat: "american",
      bookmakers: "draftkings",
      apiKey: key,
    });
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params.toString()}`;
    const r = await fetch(url);
    if(!r.ok){
      const txt = await r.text().catch(()=> "");
      return res.status(r.status).json({ error: "Upstream", detail: txt });
    }
    const data = await r.json();

    // Simple model: start from implied prob, apply adjustments for home edge and underdog value.
    // This is a placeholder — you can swap in ELO or your own model later.
    function modelAdjust({isHome, isUnderdog, league}){
      let adj = 0;
      // home edge varies by league
      if(isHome) adj += (league === "nba" ? 0.015 : league === "nfl" ? 0.02 : 0.01);
      // slight bias toward underdogs for price inefficiency
      if(isUnderdog) adj += 0.015;
      return adj;
    }

    const picks = [];

    for(const game of data.slice(0, 30)){
      const bk = (game.bookmakers || [])[0] || {};
      const mkts = bk.markets || [];

      const find = (key) => mkts.find(m => m.key === key || m.key === key.toUpperCase());
      const h2h = find("h2h");
      const spreads = find("spreads");
      const totals = find("totals");

      // Moneyline picks
      if(markets.has("ml") && h2h && h2h.outcomes){
        const away = h2h.outcomes.find(o => o.name === game.away_team);
        const home = h2h.outcomes.find(o => o.name === game.home_team);
        if(away && home){
          for(const side of ["away","home"]){
            const o = side==="away" ? away : home;
            const imp = impliedFromAmerican(o.price);
            if(imp){
              const isUnderdog = o.price > 0;
              const isHome = side==="home";
              const mprob = clamp(imp + modelAdjust({isHome, isUnderdog, league}), 0.01, 0.99);
              const fair = americanFromProb(mprob);
              const edge = mprob - imp; // positive = value
              if(edge >= minEdge){
                picks.push({
                  league, market: "ML", selection: side==="home" ? game.home_team : game.away_team,
                  matchup: `${game.away_team} @ ${game.home_team}`,
                  price: o.price,
                  winRate: +(mprob*100).toFixed(1),
                  edgePct: +(edge*100).toFixed(1),
                  fairOdds: fair,
                  why: [
                    `Implied ${Math.round(imp*100)}% vs model ${Math.round(mprob*100)}%`,
                    isHome ? "Home edge applied" : "Road spot",
                    isUnderdog ? "Underdog price value" : "Favorite efficiency"
                  ]
                });
              }
            }
          }
        }
      }

      // Spread picks (take the first line)
      if(markets.has("spread") && spreads && spreads.outcomes){
        const away = spreads.outcomes.find(o => o.name === game.away_team);
        const home = spreads.outcomes.find(o => o.name === game.home_team);
        if(away && home){
          for(const o of [away, home]){
            const imp = impliedFromAmerican(o.price);
            if(imp){
              const isUnderdog = o.price > 0;
              const isHome = o.name === game.home_team;
              const mprob = clamp(imp + modelAdjust({isHome, isUnderdog, league})/2, 0.01, 0.99); // smaller adj for spreads
              const fair = americanFromProb(mprob);
              const edge = mprob - imp;
              if(edge >= minEdge){
                picks.push({
                  league, market: "Spread", selection: `${o.name === game.away_team ? "Away" : "Home"} ${o.point>0? "+"+o.point:o.point}`,
                  matchup: `${game.away_team} @ ${game.home_team}`,
                  price: o.price,
                  winRate: +(mprob*100).toFixed(1),
                  edgePct: +(edge*100).toFixed(1),
                  fairOdds: fair,
                  why: [
                    `Spread ${o.point>0? "+"+o.point:o.point}`,
                    `Implied ${Math.round(imp*100)}% vs model ${Math.round(mprob*100)}%`,
                    isHome ? "Home edge" : "Road edge",
                    isUnderdog ? "Plus-money spread value" : "Juiced favorite spread"
                  ]
                });
              }
            }
          }
        }
      }

      // Totals picks (use O/U pair)
      if(markets.has("total") && totals && totals.outcomes){
        const over = totals.outcomes.find(o => /over/i.test(o.name));
        const under = totals.outcomes.find(o => /under/i.test(o.name));
        if(over && under){
          for(const o of [over, under]){
            const imp = impliedFromAmerican(o.price);
            if(imp){
              // tiny model tweak: NBA totals variance higher
              const varianceAdj = league === "nba" ? 0.005 : league === "nfl" ? 0.003 : 0.002;
              const mprob = clamp(imp + (o.name.toLowerCase().startsWith("over") ? varianceAdj : -varianceAdj), 0.01, 0.99);
              const fair = americanFromProb(mprob);
              const edge = mprob - imp;
              if(edge >= minEdge){
                picks.push({
                  league, market: "Total", selection: `${o.name[0].toUpperCase()} ${o.point}`,
                  matchup: `${game.away_team} @ ${game.home_team}`,
                  price: o.price,
                  winRate: +(mprob*100).toFixed(1),
                  edgePct: +(edge*100).toFixed(1),
                  fairOdds: fair,
                  why: [
                    `Total ${o.point}`,
                    `Implied ${Math.round(imp*100)}% vs model ${Math.round(mprob*100)}%`,
                    o.name.toLowerCase().startsWith("over") ? "Over lean due to pace/efficiency" : "Under lean due to pace/defense"
                  ]
                });
              }
            }
          }
        }
      }
    }

    // Sort by edge descending and cap
    picks.sort((a,b)=> b.edgePct - a.edgePct);
    const limited = picks.slice(0, maxPicks);

    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=120");
    res.status(200).json({ league, profile, minEdge, count: limited.length, picks: limited });
  }catch(e){
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
