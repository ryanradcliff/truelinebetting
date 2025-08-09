/* TrueLineBetting v3 — Live odds prep */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const STORE = {
  save(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; } }
};

const state = {
  route: window.location.hash.slice(1) || 'dashboard',
  slip: [],
  live: STORE.load('tlb_live_mode', false), // false = demo odds, true = live odds via /api/odds
  bankroll: STORE.load('tlb_bankroll', { bankroll: 10000, units: 1, ytdUnits: 132.6, winRate: 57.2, clv: 0.07 }),
  sampleOdds: {
    mlb: [
      { time:'7:05p', matchup:'NYY @ BOS', mlAway:-112, mlHome:+104, spreadAway:'-1.5 (+150)', spreadHome:'+1.5 (-175)', total:'O 8.5 (-105) / U 8.5 (-115)' },
      { time:'7:20p', matchup:'ATL @ NYM', mlAway:-135, mlHome:+125, spreadAway:'-1.5 (+130)', spreadHome:'+1.5 (-155)', total:'O 9.0 (-110) / U 9.0 (-110)' },
      { time:'8:10p', matchup:'LAD @ CHC', mlAway:+102, mlHome:-110, spreadAway:'+1.5 (-170)', spreadHome:'-1.5 (+145)', total:'O 9.0 (-112) / U 9.0 (-108)' }
    ],
    nfl: [
      { time:'1:00p', matchup:'DAL @ PHI', mlAway:+135, mlHome:-150, spreadAway:'+3.0 (-108)', spreadHome:'-3.0 (-112)', total:'O 47.5 (-110) / U 47.5 (-110)' },
      { time:'4:25p', matchup:'KC @ BUF', mlAway:-120, mlHome:+110, spreadAway:'-2.0 (-105)', spreadHome:'+2.0 (-115)', total:'O 51.0 (-105) / U 51.0 (-115)' }
    ],
    nba: [
      { time:'7:30p', matchup:'LAL @ GS', mlAway:+115, mlHome:-125, spreadAway:'+2.5 (-110)', spreadHome:'-2.5 (-110)', total:'O 233.5 (-108) / U 233.5 (-112)' },
      { time:'10:00p', matchup:'BOS @ DEN', mlAway:-102, mlHome:-102, spreadAway:'PK (-110)', spreadHome:'PK (-110)', total:'O 227.0 (-110) / U 227.0 (-110)' }
    ]
  },
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
        <h2>${leagueKey.toUpperCase()} Odds ${state.live ? '(Live)' : '(Demo)'}</h2>
        <div class="controls">
          <label class="tag" style="cursor:pointer">
            <input id="liveToggle" type="checkbox" ${state.live ? 'checked' : ''} /> Live odds
          </label>
          <input class="input" placeholder="Search matchup..." id="${leagueKey}-search" />
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
  const url = `/api/odds?league=${encodeURIComponent(leagueKey)}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`API error ${r.status}`);
  const json = await r.json();
  return json.rows || [];
}

function leagueSection(leagueKey){
  const demoRows = state.sampleOdds[leagueKey];
  // We'll render demo first and upgrade to live when data arrives
  const section = document.createElement('section');
  section.innerHTML = leagueTableFromRows(leagueKey, demoRows);
  // After rendered, wire fetch if live
  setTimeout(async () => {
    const toggle = $('#liveToggle', section) || $('#liveToggle');
    if(toggle){
      toggle.addEventListener('change', () => {
        state.live = toggle.checked;
        STORE.save('tlb_live_mode', state.live);
        router();
      });
    }
    if(state.live){
      try {
        const rows = await fetchLive(leagueKey);
        section.innerHTML = leagueTableFromRows(leagueKey, rows.length ? rows : demoRows);
        // Re-bind after replacing innerHTML
        const t2 = $('#liveToggle', section);
        if(t2){
          t2.addEventListener('change', () => {
            state.live = t2.checked; STORE.save('tlb_live_mode', state.live); router();
          });
        }
        // Bind bet buttons in newly injected content
        $$('.btn[data-market]', section).forEach(btn => {
          btn.addEventListener('click', () => {
            const leg = {
              league: leagueKey,
              market: btn.dataset.market,
              selection: btn.dataset.selection,
              price: parseInt(btn.dataset.price,10),
              matchup: btn.dataset.matchup
            };
            addLeg(leg);
          });
        });
      } catch (e){
        console.warn('Live fetch failed, sticking to demo:', e);
      }
    }
  }, 0);
  return section.innerHTML;
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

    ${leagueSection('mlb')}
    ${leagueSection('nfl')}
    ${leagueSection('nba')}
  `;
}

// Keep the rest of pages identical to v2 but include live toggle in dedicated league pages
function renderLeague(leagueKey){
  return `
    <section class="hero card">
      <h1>${leagueKey.toUpperCase()} Dashboard</h1>
      <p>${state.live ? 'Showing live odds from API.' : 'Demo slate & markets. Toggle live odds to fetch from API.'}</p>
    </section>
    ${leagueSection(leagueKey)}
  `;
}

// Minimal pages port (we'll keep picks/about/contact/legal same as v2 for brevity)
function picks(){ return `<section class="hero card"><h1>Today’s Picks</h1><p>Free plays below. Premium card is locked — coming soon.</p></section>`; }
function about(){ return `<section class="hero card"><h1>About TrueLineBetting</h1><p>Numbers, timing, and line value — for entertainment only.</p></section>`; }
function contact(){ return `<section class="hero card"><h1>Contact</h1><p>Email: (coming soon)</p></section>`; }
function legal(){ return `<section class="hero card"><h1>Legal</h1><p>Responsible gaming • 1-800-GAMBLER.</p></section>`; }

function router(){
  const { route } = state;
  // Nav active
  $$('.nav-link').forEach(a => a.classList.remove('active'));
  const current = $(`.nav-link[href="#${route}"]`); if(current) current.classList.add('active');

  if(route === 'dashboard') $('#app').innerHTML = dashboard();
  else if(['mlb','nfl','nba'].includes(route)) $('#app').innerHTML = renderLeague(route);
  else if(route === 'picks') $('#app').innerHTML = picks();
  else if(route === 'about') $('#app').innerHTML = about();
  else if(route === 'contact') $('#app').innerHTML = contact();
  else if(route === 'legal') $('#app').innerHTML = legal();

  // Bind bet buttons in current view
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
  const menu = $('#mobileMenu'); if(menu){ menu.addEventListener('click', () => $('#mobileNav').classList.toggle('hidden')); }
  router();
  renderSlip();
});
