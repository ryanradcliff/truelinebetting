/* TrueLineBetting v2 */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const STORE = {
  save(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; } }
};

const state = {
  route: window.location.hash.slice(1) || 'dashboard',
  slip: [],
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
  picks: {
    free: [
      { league:'MLB', play:'Braves -1.5 (+130) vs NYM', confidence:'8/10', note:'Mets bullpen taxed; matchup edge vs. RHP.' },
      { league:'NBA', play:'Celtics @ Nuggets — Under 227.0 (-110)', confidence:'6/10', note:'Altitude + pace downgrade back-to-back.' }
    ],
    premium: [
      { league:'NFL', play:'Chiefs -2.0 (-105) @ BUF', confidence:'9/10', note:'Price vs. market; matchup trenches edge.' },
      { league:'MLB', play:'Dodgers ML (+102) @ CHC', confidence:'7/10', note:'Travel spot + SP splits value.' }
    ]
  }
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
          const price = parseInt(p.match(/(-?\d+)/g).slice(-1)[0],10);
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
        <table class="table"><thead>
          <tr><th>Time</th><th>Matchup</th><th>Moneyline</th><th>Spread</th><th>Total</th></tr>
        </thead><tbody id="${leagueKey}-tbody">${rows}</tbody></table>
      </div>
    </div>
  `;
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
      <h2>Bankroll Tracker</h2>
      <div class="br-form">
        <label>Bankroll <input id="br-bankroll" class="input" type="number" value="${br.bankroll}" /></label>
        <label>Unit Size <input id="br-units" class="input" type="number" value="${br.units}" /></label>
        <button id="br-save" class="btn btn-primary">Save</button>
      </div>
    </section>

    ${leagueTable('mlb')}
    ${leagueTable('nfl')}
    ${leagueTable('nba')}
  `;
}

function picks(){
  const free = state.picks.free.map(p => `
    <div class="pick">
      <div class="meta">${p.league} • Confidence ${p.confidence}</div>
      <h4>${p.play}</h4>
      <div>${p.note}</div>
    </div>
  `).join('');

  const locked = state.picks.premium.map(p => `
    <div class="pick">
      <div class="meta">${p.league} • Confidence ${p.confidence}</div>
      <h4>${p.play}</h4>
      <div>${p.note}</div>
    </div>
  `).join('');

  return `
    <section class="hero card">
      <h1>Today’s Picks</h1>
      <p>Free plays below. Premium card is locked — coming soon.</p>
    </section>

    <section class="card">
      <h2>Free Plays</h2>
      <div class="picks-list">${free}</div>
    </section>

    <section class="card lock">
      <h2>Premium Card</h2>
      <div class="picks-list" aria-hidden="true">${locked}</div>
      <div style="margin-top:.75rem; display:flex; justify-content:center;">
        <button class="btn btn-primary">Join Premium</button>
      </div>
    </section>
  `;
}

function about(){
  return `
    <section class="hero card">
      <h1>About TrueLineBetting</h1>
      <p>We obsess over numbers so you don’t have to—market timing, matchup edges, and line value.</p>
    </section>
    <section class="card">
      <p>Built by bettors, for bettors. This is a demo build; no wagering is processed here. All odds are examples and may not reflect current markets.</p>
    </section>
  `;
}

function contact(){
  return `
    <section class="hero card">
      <h1>Contact</h1>
      <p>Questions, partnerships, media? Reach out.</p>
    </section>
    <section class="card">
      <form class="grid" onsubmit="event.preventDefault(); alert('Thanks! (Demo)');">
        <div class="kpi" style="grid-column: span 6;">
          <label>Name<br/><input class="input" required placeholder="Your name"/></label>
        </div>
        <div class="kpi" style="grid-column: span 6;">
          <label>Email<br/><input class="input" type="email" required placeholder="you@example.com"/></label>
        </div>
        <div class="kpi" style="grid-column: span 12;">
          <label>Message<br/><textarea class="input" style="width:100%;height:120px" required placeholder="How can we help?"></textarea></label>
        </div>
        <div class="kpi" style="grid-column: span 12;">
          <button class="btn btn-primary">Send (Demo)</button>
        </div>
      </form>
    </section>
  `;
}

function legal(){
  return `
    <section class="hero card">
      <h1>Legal</h1>
      <p>Disclaimer, Terms, Privacy & Responsible Gaming</p>
    </section>
    <section class="card">
      <h2>Disclaimer</h2>
      <p>TrueLineBetting provides sports information and entertainment only. We do not accept or place bets. Verify legal age and regulations in your jurisdiction.</p>
      <h2>Responsible Gaming</h2>
      <p>If you or someone you know has a gambling problem and wants help, call 1-800-GAMBLER.</p>
      <h2>Privacy</h2>
      <p>No personal data is collected in this demo. Future versions will include a complete Privacy Policy.</p>
      <h2>Terms</h2>
      <p>No guarantees on outcomes. All decisions to wager are your responsibility. Use at your own risk.</p>
    </section>
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
  if(route === 'dashboard') $('#app').innerHTML = dashboard();
  else if(route === 'picks') $('#app').innerHTML = picks();
  else if(route === 'about') $('#app').innerHTML = about();
  else if(route === 'contact') $('#app').innerHTML = contact();
  else if(route === 'legal') $('#app').innerHTML = legal();
  else if(['mlb','nfl','nba'].includes(route)) $('#app').innerHTML = renderLeague(route);

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

  // Bankroll save
  const save = $('#br-save');
  if(save){
    save.addEventListener('click', () => {
      const br = {
        bankroll: parseFloat($('#br-bankroll').value||'0'),
        units: parseFloat($('#br-units').value||'1'),
        ytdUnits: state.bankroll.ytdUnits,
        winRate: state.bankroll.winRate,
        clv: state.bankroll.clv
      };
      state.bankroll = br;
      STORE.save('tlb_bankroll', br);
      alert('Bankroll saved locally.');
      router();
    });
  }
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
  $('#mobileMenu').addEventListener('click', () => $('#mobileNav').classList.toggle('hidden'));
  router();
  renderSlip();
});
