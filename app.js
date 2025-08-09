/* TrueLineBetting starter SPA (hash router) */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const state = {
  route: window.location.hash.slice(1) || 'dashboard',
  slip: [],
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
  }
};

function setActiveNav(){
  $$('.nav-link').forEach(a => {
    const href = a.getAttribute('href').replace('#','');
    a.classList.toggle('active', href === state.route);
  });
}

function toCurrency(n){
  return n.toLocaleString(undefined, {style:'currency', currency:'USD'});
}

function americanToDecimal(odds){
  if(odds > 0) return 1 + (odds/100);
  return 1 + (100/Math.abs(odds));
}

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

function addLeg(leg){
  state.slip.push(leg);
  renderSlip();
}

function kpiCard({label, value, delta, up}){
  return `
    <div class="card kpi">
      <h3>${label}</h3>
      <div class="value">${value}</div>
      <div class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${delta}</div>
    </div>
  `;
}

function leagueTable(leagueKey){
  const rows = state.sampleOdds[leagueKey].map(g => `
    <tr>
      <td>${g.time}</td>
      <td>${g.matchup}</td>
      <td class="odds">
        <button class="btn" data-market="ML" data-selection="Away" data-price="${g.mlAway}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.mlAway>0? '+'+g.mlAway : g.mlAway}</button>
        <button class="btn" data-market="ML" data-selection="Home" data-price="${g.mlHome}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.mlHome>0? '+'+g.mlHome : g.mlHome}</button>
      </td>
      <td class="odds">
        <button class="btn" data-market="Spread" data-selection="${g.spreadAway}" data-price="${parsePrice(g.spreadAway)}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.spreadAway}</button>
        <button class="btn" data-market="Spread" data-selection="${g.spreadHome}" data-price="${parsePrice(g.spreadHome)}" data-matchup="${g.matchup}" data-league="${leagueKey}">${g.spreadHome}</button>
      </td>
      <td class="odds">
        ${g.total.split('/').map((part) => {
          const p = part.trim();
          const price = parseInt(p.match(/(-?\\d+)/g).slice(-1)[0],10);
          return `<button class="btn" data-market="Total" data-selection="${p}" data-price="${price}" data-matchup="${g.matchup}" data-league="${leagueKey}">${p}</button>`;
        }).join(' ')}
      </td>
    </tr>
  `).join('');

  return `
    <div class="card">
      <div class="league-title">
        <h2>${leagueKey.toUpperCase()} Odds</h2>
        <div class="controls">
          <span class="tag"><span class="swatch"></span> Demo odds</span>
          <input class="input" placeholder="Search matchup..." id="${leagueKey}-search" />
          <select id="${leagueKey}-market">
            <option value="all" selected>All markets</option>
            <option value="moneyline">Moneyline</option>
            <option value="spread">Spread</option>
            <option value="total">Total</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Time</th><th>Matchup</th><th>Moneyline</th><th>Spread</th><th>Total</th>
            </tr>
          </thead>
          <tbody id="${leagueKey}-tbody">${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function parsePrice(spreadStr){
  const match = spreadStr.match(/\\((-?\\d+)\\)$/);
  return match ? parseInt(match[1],10) : -110;
}

function renderDashboard(){
  return `
    <section class="hero card">
      <h1>Beat the Closing Line.</h1>
      <p>Luxury-grade analytics and bold picks for MLB, NFL, and NBA — all in one place.</p>
    </section>

    <section class="grid">
      ${kpiCard({label:'Bankroll', value:'$10,000', delta:'+8.3% MTD', up:true})}
      ${kpiCard({label:'Win Rate', value:'57.2%', delta:'+1.4% WoW', up:true})}
      ${kpiCard({label:'Units YTD', value:'+132.6u', delta:'+3.5u last 7d', up:true})}
      ${kpiCard({label:'CLV Δ', value:'+0.07', delta:'-0.01 last 7d', up:false})}
    </section>

    ${leagueTable('mlb')}
    ${leagueTable('nfl')}
    ${leagueTable('nba')}
  `;
}

function renderLeague(leagueKey){
  return `
    <section class="hero card">
      <h1>${leagueKey.toUpperCase()} Dashboard</h1>
      <p>Demo slate & markets. Wire up your odds API to go live.</p>
    </section>
    ${leagueTable(leagueKey)}
  `;
}

function router(){
  const { route } = state;
  setActiveNav();
  if(route === 'dashboard') $('#app').innerHTML = renderDashboard();
  if(['mlb','nfl','nba'].includes(route)) $('#app').innerHTML = renderLeague(route);

  // Bind bet buttons
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

window.addEventListener('hashchange', () => {
  state.route = window.location.hash.slice(1) || 'dashboard';
  router();
  $('#app').focus();
});

document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  $('#clearSlip').addEventListener('click', () => { state.slip = []; renderSlip(); });
  $('#placeBets').addEventListener('click', () => alert('Demo only. Connect a book or ticketing flow.'));
  $('#stakeInput').addEventListener('input', computePayout);
  router();
  renderSlip();
});
