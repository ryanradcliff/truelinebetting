/* TrueLineBetting v4 — AI Picks, win rate & rationale */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const STORE = {
  save(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; } }
};

const state = {
  route: window.location.hash.slice(1) || 'dashboard',
  slip: [],
  live: STORE.load('tlb_live_mode', false),
  bankroll: STORE.load('tlb_bankroll', { bankroll: 10000, units: 1, ytdUnits: 132.6, winRate: 57.2, clv: 0.07 }),
};

function setActiveNav(){
  $$('.nav-link').forEach(a => {
    const href = a.getAttribute('href').replace('#','');
    a.classList.toggle('active', href === state.route);
  });
}

function toCurrency(n){ return n.toLocaleString(undefined, {style:'currency', currency:'USD'}); }
function americanToDecimal(odds){ return odds > 0 ? 1 + (odds/100) : 1 + (100/Math.abs(odds)); }

function computePayout(){
  const stake = parseFloat($('#stakeInput').value || '0');
  if(state.slip.length === 0){ $('#payoutValue').textContent = toCurrency(0); return; }
  const parlayDecimal = state.slip.reduce((acc, leg) => acc * americanToDecimal(leg.price), 1);
  const payout = stake * parlayDecimal;
  $('#payoutValue').textContent = toCurrency(payout);
}

function renderSlip(){
  const wrap = $('#betslipItems');
  wrap.innerHTML = '';
  if(state.slip.length === 0){
    wrap.innerHTML = `<div class="tag"><span class="swatch"></span>No selections yet</div>`;
    computePayout();
    return;
  }
  state.slip.forEach((leg, idx) => {
    const row = document.createElement('div');
    row.className = 'betslip-item';
    row.innerHTML = `
      <div class="meta">
        <strong>${leg.league.toUpperCase()} • ${leg.market}</strong>
        <span>${leg.matchup} — <b>${leg.selection}</b></span>
        <small class="odds">${leg.price > 0 ? '+'+leg.price : leg.price}</small>
      </div>
      <button class="btn btn-ghost small" aria-label="Remove leg">✕</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      state.slip.splice(idx,1); renderSlip();
    });
    wrap.appendChild(row);
  });
  computePayout();
}

function addLeg(leg){ state.slip.push(leg); renderSlip(); }
function kpiCard({label, value, delta, up}){
  return `<div class="card kpi"><h3>${label}</h3><div class="value">${value}</div><div class="delta ${up?'up':'down'}">${up?'▲':'▼'} ${delta}</div></div>`;
}

function parsePrice(spreadStr){ const m = spreadStr.match(/\((-?\d+)\)$/); return m ? parseInt(m[1],10) : -110; }

/* ---------- League tables (same as v3, trimmed here for brevity) ---------- */
function leagueTableFromRows(leagueKey, rows){
  const body = rows.map(g => `
    <tr>
      <td>${g.time || ''}</td>
      <td>${g.matchup || ''}</td>
      <td class="odds">
        ${g.mlAway!=null ? `<button class="btn" data-market="ML" data-selection="Away" data-price="${g.mlAway}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.mlAway>0? '+'+g.mlAway : g.mlAway}</button>` : ''}
        ${g.mlHome!=null ? `<button class="btn" data-market="ML" data-selection="Home" data-price="${g.mlHome}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.mlHome>0? '+'+g.mlHome : g.mlHome}</button>` : ''}
      </td>
      <td class="odds">
        ${g.spreadAway ? `<button class="btn" data-market="Spread" data-selection="${g.spreadAway}" data-price="${parsePrice(g.spreadAway)}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.spreadAway}</button>` : ''}
        ${g.spreadHome ? `<button class="btn" data-market="Spread" data-selection="${g.spreadHome}" data-price="${parsePrice(g.spreadHome)}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.spreadHome}</button>` : ''}
      </td>
      <td class="odds">
        ${g.total ? g.total.split('/').map((part) => {
          const p = part.trim();
          const price = parseInt(p.match(/(-?\d+)/g).slice(-1)[0],10);
          return `<button class="btn" data-market="Total" data-selection="${p}" data-price="${price}" data-matchup="${g.matchup}" data-league="${leagueKey}">${p}</button>`;
        }).join(' ') : ''}
      </td>
    </tr>
  `).join('');

  return `
    <div class="card">
      <div class="league-title">
        <h2>${leagueKey.toUpperCase()} Odds</h2>
        <div class="controls">
          <label class="tag" style="cursor:pointer">
            <input id="liveToggle" type="checkbox" ${state.live ? 'checked' : ''} /> Live odds
          </label>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table"><thead>
          <tr><th>Time</th><th>Matchup</th><th>Moneyline</th><th>Spread</th><th>Total</th></tr>
        </thead><tbody id="${leagueKey}-tbody">${body}</tbody></table>
      </div>
    </div>
  `;
}

async function fetchLive(leagueKey){
  const r = await fetch(`/api/odds?league=${encodeURIComponent(leagueKey)}`);
  if(!r.ok) throw new Error(`API error ${r.status}`);
  const json = await r.json();
  return json.rows || [];
}

function leagueSection(leagueKey){
  // render demo first, then live if toggled — omitted demo rows for brevity
  return leagueTableFromRows(leagueKey, []);
}

/* ---------- AI Picks UI ---------- */
async function generatePicks({league, profile, markets, max}){
  const params = new URLSearchParams({ league, profile, markets: markets.join(','), max: String(max) });
  const r = await fetch(`/api/picks?${params.toString()}`);
  if(!r.ok) throw new Error('Failed to fetch picks');
  return r.json();
}

function picksView(){
  return `
    <section class="hero card">
      <h1>AI Picks</h1>
      <p>Find value using live odds + AI edge model. Click “Explain” to see the rationale.</p>
    </section>

    <section class="card">
      <div class="controls">
        <label>League
          <select id="px-league">
            <option value="mlb">MLB</option>
            <option value="nfl">NFL</option>
            <option value="nba">NBA</option>
          </select>
        </label>
        <label>Profile
          <select id="px-profile">
            <option value="conservative">Conservative</option>
            <option value="balanced" selected>Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
        <label>Markets
          <select id="px-markets" multiple size="3">
            <option value="ml" selected>Moneyline</option>
            <option value="spread" selected>Spread</option>
            <option value="total" selected>Totals</option>
          </select>
        </label>
        <label>Max picks
          <input id="px-max" class="input" type="number" value="4" min="1" max="12"/>
        </label>
        <button id="px-run" class="btn btn-primary">Generate Picks</button>
      </div>
      <div id="px-results" class="picks-list" style="margin-top:.75rem"></div>
    </section>
  `;
}

function renderPicksList(list){
  const wrap = $('#px-results');
  if(!list || list.length===0){
    wrap.innerHTML = `<div class="tag"><span class="swatch"></span>No picks matched your filters.</div>`;
    return;
  }
  wrap.innerHTML = list.map(p => `
    <div class="pick">
      <div class="meta">${p.league.toUpperCase()} • ${p.market} • Edge ${p.edgePct}%</div>
      <h4>${p.selection} — ${p.matchup}</h4>
      <div class="meta">Price: <b class="odds">${p.price>0? '+'+p.price : p.price}</b> • Win rate: <b>${p.winRate}%</b> • Fair: <b class="odds">${p.fairOdds>0? '+'+p.fairOdds : p.fairOdds}</b></div>
      <details style="margin-top:.4rem"><summary>Explain</summary><ul>${p.why.map(w => `<li>${w}</li>`).join('')}</ul></details>
      <div style="margin-top:.5rem">
        <button class="btn" data-action="add" data-league="${p.league}" data-market="${p.market}" data-selection="${p.selection}" data-price="${p.price}" data-matchup="${p.matchup}">Add to Slip</button>
      </div>
    </div>
  `).join('');

  // Bind add-to-slip buttons
  $$('#px-results .btn[data-action="add"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const leg = {
        league: btn.dataset.league,
        market: btn.dataset.market,
        selection: btn.dataset.selection,
        price: parseInt(btn.dataset.price,10),
        matchup: btn.dataset.matchup
      };
      addLeg(leg);
      window.location.hash = '#dashboard'; // jump to see slip if needed
    });
  });
}

function dashboard(){
  const br = state.bankroll;
  return `
    <section class="hero card">
      <h1>Beat the Closing Line.</h1>
      <p>Luxury-grade analytics and bold picks for MLB, NFL, and NBA — all in one place.</p>
    </section>

    <section class="grid">
      ${kpiCard({label:'Bankroll', value:toCurrency(br.bankroll), delta:'+8.3% MTD', up:true})}
      ${kpiCard({label:'Win Rate', value:br.winRate.toFixed(1)+'%', delta:'+1.4% WoW', up:true})}
      ${kpiCard({label:'Units YTD', value:`${br.ytdUnits.toFixed(1)}u`, delta:'+3.5u last 7d', up:true})}
      ${kpiCard({label:'CLV Δ', value:br.clv.toFixed(2), delta:'-0.01 last 7d', up:false})}
    </section>

    <section class="card">
      <h2>Quick AI Picks</h2>
      <div class="controls">
        <button id="quick-mlb" class="btn btn-primary">Generate MLB (Balanced)</button>
        <button id="quick-nfl" class="btn btn-primary">Generate NFL (Balanced)</button>
        <button id="quick-nba" class="btn btn-primary">Generate NBA (Balanced)</button>
      </div>
      <div id="quick-results" class="picks-list"></div>
    </section>

  `;
}

function renderLeague(leagueKey){
  return `
    <section class="hero card">
      <h1>${leagueKey.toUpperCase()} Dashboard</h1>
      <p>Toggle Live odds in tables below, or jump to Picks for AI selections.</p>
    </section>
    ${leagueTableFromRows(leagueKey, [])}
  `;
}

function router(){
  const { route } = state;
  setActiveNav();
  if(route === 'dashboard'){
    $('#app').innerHTML = dashboard();
    // bind quick buttons
    const doQuick = async (lg) => {
      $('#quick-results').innerHTML = `<div class="tag"><span class="swatch"></span>Working...</div>`;
      try{
        const data = await generatePicks({ league: lg, profile: 'balanced', markets: ['ml','spread','total'], max: 4 });
        renderPicksList(data.picks);
      }catch(e){
        $('#quick-results').innerHTML = `<div class="tag"><span class="swatch"></span>Error loading picks</div>`;
      }
    };
    $('#quick-mlb')?.addEventListener('click', ()=>doQuick('mlb'));
    $('#quick-nfl')?.addEventListener('click', ()=>doQuick('nfl'));
    $('#quick-nba')?.addEventListener('click', ()=>doQuick('nba'));
  }
  else if(route === 'picks'){
    $('#app').innerHTML = picksView();
    $('#px-run').addEventListener('click', async () => {
      const league = $('#px-league').value;
      const profile = $('#px-profile').value;
      const max = parseInt($('#px-max').value || '4',10);
      const markets = Array.from($('#px-markets').selectedOptions).map(o => o.value);
      $('#px-results').innerHTML = `<div class="tag"><span class="swatch"></span>Working...</div>`;
      try{
        const data = await generatePicks({ league, profile, markets, max });
        renderPicksList(data.picks);
      }catch(e){
        $('#px-results').innerHTML = `<div class="tag"><span class="swatch"></span>Error loading picks</div>`;
      }
    });
  }
  else if(['mlb','nfl','nba'].includes(route)){
    $('#app').innerHTML = renderLeague(route);
  }
  else if(route === 'about'){
    $('#app').innerHTML = `<section class="hero card"><h1>About</h1><p>AI-assisted value finder using live odds, implied probability, and a simple model to estimate fair lines.</p></section>`;
  }
  else if(route === 'contact'){
    $('#app').innerHTML = `<section class="hero card"><h1>Contact</h1><p>Media & partnerships: coming soon</p></section>`;
  }
  else if(route === 'legal'){
    $('#app').innerHTML = `<section class="hero card"><h1>Legal</h1><p>Entertainment only. Responsible gaming: 1-800-GAMBLER.</p></section>`;
  }

  // Bind bet buttons across views
  $$('#app .btn[data-market]').forEach(btn => {
    btn.addEventListener('click', () => {
      const leg = {
        league: btn.dataset.league,
        market: btn.dataset.market,
        selection: btn.dataset.selection,
        price: parseInt(btn.dataset.price,10),
        matchup: btn.dataset.matchup
      };
      addLeg(leg);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  $('#clearSlip').addEventListener('click', () => { state.slip = []; renderSlip(); });
  $('#placeBets').addEventListener('click', () => alert('Demo only. Connect a book or ticketing flow.'));
  $('#stakeInput').addEventListener('input', computePayout);
  $('#mobileMenu')?.addEventListener('click', () => $('#mobileNav').classList.toggle('hidden'));
  router();
  renderSlip();
});
