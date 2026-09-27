/* =========================== REALM CARD (v1.0.55) ===========================
   Every realm (country) is open to everyone: how many players and defenders (seats) fight for it, what they hold,
   who played this week, today's Hold, the houses that fight for it and its best defenders.
   Every number is the server's own (the realm_card RPC, backend v4); until it answers, the card shows the realm's
   line from the cached leaderboard. Players = people, defenders = seats (one person can hold up to three). */
const RCARD={};
function plural(n,one,many){n=+n||0;return n.toLocaleString()+' '+(n===1?one:many);}
function realmTotals(lb){
  if(!lb)return '';const t=+lb.total||0;
  return lb.players!=null?`${plural(lb.players,'player','players')} · ${plural(lb.countries,'country','countries')} · ${plural(t,'defender','defenders')}`:plural(t,'defender','defenders');
}
function realmSummary(lb){
  if(!lb||lb.players==null)return '';
  return `<div class="rcsum"><span>👥 ${plural(lb.players,'player','players')}</span><span>🌍 ${plural(lb.countries,'country','countries')}</span><span>🛡️ ${plural(lb.total,'defender','defenders')}</span></div>`;
}
function rcFresh(j){const c=RCARD[j];return !!(c&&Date.now()-c.at<60000&&c.seat===Math.max(0,seatNo()));}
async function fetchRealmCard(j){
  if(!sbReady())return null;delete CLOUD.rcErr;
  try{const seat=Math.max(0,seatNo());const r=await sbRpc('realm_card',{realm:j,me:CLOUD.tg_id||null,seat},{timeout:8000});
    if(r&&typeof r==='object'&&+r.realm===j){RCARD[j]={at:Date.now(),seat,data:r};delete CLOUD.rcErr;return r;}}
  catch(e){CLOUD.rcErr=String(e&&e.message||e);}
  return null;
}
function rcDefRow(t){const tr=trophiesRow(t),rk=rankOf(tr);
  return `<div class="lbrow ${lbIsMe(t)?'me':''}"><span class="rk">${t.rank<=3?['🥇','🥈','🥉'][t.rank-1]:'#'+t.rank}</span><span class="hs">${(HOUSES[t.house]||{}).e||'🛡️'}</span><span class="nm">${rankSVG(rk.t,13,rk.div)}${lbName(t)}</span><span class="sc">🏆${tr} · ⭐${+t.stars||0} · 🌊${+t.waves||0}</span></div>`;}
function showRealmCard(j,back,noFetch){
  const rows=realmStats(),r=rows.find(x=>x.j===j);if(!r)return;
  back=back||(()=>showRealms(false));
  if(!noFetch&&sbReady()&&!rcFresh(j))fetchRealmCard(j).then(()=>{if(CLOUD.screen==='realm:'+j)showRealmCard(j,back,true);});
  const c=RCARD[j]?RCARD[j].data:null;
  const v=(k,rk)=>+(c&&c[k]!=null?c[k]:r[rk||k])||0;
  const players=v('players'),seats=v('seats'),active=v('active'),waves=v('waves'),stars=v('stars'),kills=v('kills'),today=v('today'),todayP=v('today_players','todayPlayers');
  const st=!sbReady()?'Offline — the standings need the online backend.'
    :c?`Live · updated ${new Date(RCARD[j].at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`
    :CLOUD.rcErr?'Could not reach the realm ('+esc(CLOUD.rcErr)+') — showing the last standings.':'Loading the realm…';
  const houses=(c&&c.houses)||[],hmax=Math.max(1,...houses.map(h=>+h.seats||0));
  const top=(c&&c.top)||[],me=c&&c.me?c.me:null;
  const ranked=players>0||waves>0;
  show(`<div class="topbar"><h1 class="rch1">${flag(r.c,30)} ${r.c}<small>${esc(r.l)}${ranked?` · realm rank #${r.rank} of ${rows.length}`:' · no defender yet'}</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m rcst">${st}</p>
  <div class="statbox"><div class="gr">
    <div><b>${players.toLocaleString()}</b><small>${players===1?'player':'players'}</small></div>
    <div><b>${seats.toLocaleString()}</b><small>${seats===1?'defender':'defenders'}</small></div>
    <div><b>${active.toLocaleString()}</b><small>played this week</small></div>
    <div><b>${waves.toLocaleString()}</b><small>realm waves 🌊</small></div>
    <div><b>${stars.toLocaleString()}</b><small>stars ⭐</small></div>
    <div><b>${kills.toLocaleString()}</b><small>kills ⚔️</small></div></div>
    ${players?`<p class="m rcavg">Per player: ${Math.round(waves/players).toLocaleString()} 🌊 · ${Math.round(stars/players).toLocaleString()} ⭐</p>`:''}</div>
  <div class="statbox"><div class="hd"><b>🌊 Today's Hold</b></div>
    <div class="gr"><div><b>${today.toLocaleString()}</b><small>waves today</small></div><div><b>${todayP.toLocaleString()}</b><small>${todayP===1?'player today':'players today'}</small></div><div><b>${c&&c.best!=null?(+c.best).toLocaleString():'—'}</b><small>best run ever</small></div></div></div>
  ${c?`<div class="statbox"><div class="hd"><b>🛡️ Houses fighting for ${r.c}</b></div>
    ${houses.length?houses.map(h=>`<div class="rchouse"><span class="cr">${HOUSES[h.house]?crest(h.house,22):'🛡️'}</span><span class="nm"><b>House ${HOUSES[h.house]?HOUSES[h.house].n:esc(h.house)}</b><small>${plural(h.seats,'defender','defenders')} · ${(+h.waves||0).toLocaleString()} 🌊 · ${(+h.stars||0).toLocaleString()} ⭐</small><span class="bar"><i style="width:${Math.max(4,Math.round(100*(+h.seats||0)/hmax))}%"></i></span></span></div>`).join('')
      :`<p class="m" style="font-size:12px;margin:6px 0 0">No house holds ${r.c} yet.</p>`}</div>
  <div class="statbox"><div class="hd"><b>🏆 Best defenders of ${r.c}</b><span class="lg">🏆 · ⭐ · 🌊</span></div>
    ${top.length?top.map(rcDefRow).join('')+(me&&me.rank>top.length?rcDefRow(me):''):`<p class="m" style="font-size:12px;margin:6px 0 0">No defender yet — be the first to fight for ${r.c}.</p>`}</div>`:''}
  <button class="btn sec" id="bRcBack">◀ Back</button>`);
  CLOUD.screen='realm:'+j;
  $('#bBack').addEventListener('click',back);$('#bRcBack').addEventListener('click',back);
}
