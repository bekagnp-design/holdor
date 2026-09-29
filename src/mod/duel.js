/* =========================== DUEL (v1.0.67, backend v15) ===========================
   An asynchronous 1v1 on the Hold map. Nothing is played "live": each side fights his own Hold run, and the server compares the runs
   it recorded itself (score = waves × 1000 + kills). Ranked: a ghost (the recorded best run of a real player near your rating; he is not
   asked and loses nothing) or a bot; friend: a link; practice: a bot, always marked. Leagues by rating. Needs a seat signed in through Telegram. */
const DUEL={st:null,at:0,seat:-1,busy:false,pending:null};
const DUEL_LEAGUE={Bronze:'🥉',Silver:'🥈',Gold:'🥇',Crystal:'💎',Dragon:'🐉'};
const DUEL_BOT='https://t.me/HoldorTDBot/play?startapp=d_';
function duelOn(){return !!(ecoOn()&&ACC&&ACC.tut&&onlineOpen());}
function duelLoad(force){if(!ecoOn())return Promise.resolve(null);
  if(!force&&DUEL.st&&DUEL.seat===seatNo()&&Date.now()-DUEL.at<20000)return Promise.resolve(DUEL.st);
  const seat=seatNo();
  return ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('duel_state',{seat},9000);if(r.state)ecoApply(r.state);if(seat===seatNo()){DUEL.st=r;DUEL.at=Date.now();DUEL.seat=seat;}return r;}).catch(e=>{ECO.err=ecoMsg(e);return null;});}
function duelRow(d){const who=d.kind==='ai'?'🤖 Bot':d.kind==='friend'?'🤝 '+(d.waiting?'Friend duel':esc(d.opponent)):'⚔️ '+esc(d.opponent);
  const sc=x=>x&&x.score!=null?`${x.waves} 🌊 · ${x.kills} ☠`:'—';
  const res=d.result==='win'?'<b class="dw">WIN</b>':d.result==='loss'?'<b class="dl">LOSS</b>':d.result==='draw'?'<b>DRAW</b>':d.status==='expired'?'<b class="dx">EXPIRED</b>':'<b class="dp">OPEN</b>';
  const left=d.status==='open'?`<small>${fmtLeft(d.left)} left</small>`:'';
  const dl=d.delta?`<small class="${d.delta>0?'dw':'dl'}">${d.delta>0?'+':''}${d.delta}</small>`:'';
  const sh=d.result==='win'?`<div class="pvrow"><button class="btn sec" data-shwin="${d.me.waves}|${d.me.kills}|${d.kind==='ai'?'a bot':esc(d.opponent)}">📨 Share the win</button></div>`:'';
  const link=d.kind==='friend'&&d.status==='open'&&d.mine&&d.waiting?`<div class="reflink"><code>${esc(DUEL_BOT+d.code)}</code></div><div class="pvrow"><button class="btn" data-share="${d.code}">📨 Send to a friend</button><button class="btn sec" data-copy="${d.code}">Copy</button></div>`:'';
  return `<div class="duelrow ${d.result||d.status}"><div class="dh"><span>${who}</span>${res}${dl}${left}</div>
    <div class="ds"><span>You<br><em>${sc(d.me)}</em></span><i>vs</i><span>${d.waiting?'waiting for a friend':esc(d.kind==='ai'?'Bot':d.opponent)}<br><em>${sc(d.them)}</em></span></div>${link}${sh}</div>`;}
async function duelCall(fn,args,after){if(DUEL.busy||!ecoOn())return;DUEL.busy=true;ecoWait(true);
  try{const r=await ecoLane(async()=>{await ecoSyncRaw();return await ecoRpc(fn,Object.assign({seat:seatNo()},args),10000);});
    ecoWait(false);DUEL.busy=false;DUEL.at=0;DUEL.st=null;after&&after(r);}
  catch(e){DUEL.busy=false;ecoWait(false);const m=ecoMsg(e);ecoModal('⚔️ Not now',ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,140)),[{t:'OK',f:()=>showDuel()}]);}}
function duelShare(code){const link=DUEL_BOT+code,u='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('I challenge you to a Hold the Door duel!');try{if(TG&&TG.openTelegramLink)TG.openTelegramLink(u);else window.open(u,'_blank');}catch(e){}}
async function duelJoinPending(){const code=DUEL.pending;if(!code||!ecoOn())return;DUEL.pending=null;
  try{const r=await ecoLane(async()=>{await ecoSyncRaw();return await ecoRpc('duel_join',{seat:seatNo(),code},9000);});DUEL.at=0;ecoToast('🤝 You joined '+r.duel.opponent+'’s duel — play your Hold run');}
  catch(e){ecoToast('⚠️ '+String(ecoMsg(e)).slice(0,80));}}
function showDuel(){
  const head=`<div class="topbar"><h1>⚔️ Duel<small>Same Hold map, two runs, one winner. The server compares what it recorded.</small></h1><button class="back" id="bBack">✖</button></div>`;
  const draw=body=>{show(head+body);CLOUD.screen='duel';$('#bBack').addEventListener('click',()=>showHub('events'));};
  if(!duelOn()){draw(`<p class="m">${!ecoOn()?'Duels are recorded by the server — they need a seat signed in through Telegram.':!ACC.tut?'Finish the tutorial battle first.':'Duels open with the Hold, after gate '+ONLINE_AT+'.'}</p>`);return;}
  if(DUEL.pending){duelJoinPending().then(()=>{if(CLOUD.screen==='duel')showDuel();});}
  const s=DUEL.st&&DUEL.seat===seatNo()?DUEL.st:null;
  if(!s){draw('<p class="m">⏳ asking the server…</p>');duelLoad(true).then(()=>{if(CLOUD.screen==='duel')showDuel();});return;}
  if(Date.now()-DUEL.at>20000)duelLoad(true).then(()=>{});
  const open=s.duels.filter(d=>d.status==='open').length;
  draw(`<div class="lg"><span class="le">${DUEL_LEAGUE[s.league]||'🥉'}</span><b>${s.league}</b><span class="rt">${s.rating}</span><small>${s.wins}W · ${s.losses}L · ${s.draws}D</small></div>
    <div class="dbtns"><button class="btn" id="bRank" ${s.rank_left>0?'':'disabled'}>⚔️ Ranked duel <small>${s.rank_left} left today</small></button>
    <button class="btn sec" id="bFriend">🤝 Challenge a friend</button><button class="btn sec" id="bAi">🤖 Practice vs a bot <small>no rating</small></button></div>
    <p class="m">${open?'<b>Play your Hold run</b> (the Hold tab): the best run you finish from the moment a duel opens counts. Hold attempts are shared with the daily Hold.':'Pick a duel. Ranked: a recorded run of a real player near your rating (he is not asked and loses nothing), or a bot when nobody fits.'}</p>
    ${open?'<button class="btn" id="bPlayHold">🚪 To the Hold</button>':''}
    <div class="qlist">${s.duels.map(duelRow).join('')||'<p class="m">No duels yet.</p>'}</div>`);
  const go=(kind)=>duelCall('duel_start',{kind},r=>showDuel());
  $('#bRank').addEventListener('click',()=>go('rank'));$('#bAi').addEventListener('click',()=>go('ai'));
  $('#bFriend').addEventListener('click',()=>duelCall('duel_start',{kind:'friend'},r=>{showDuel();}));
  const ph=$('#bPlayHold');if(ph)ph.addEventListener('click',()=>showHub('hold'));
  card.querySelectorAll('[data-shwin]').forEach(b=>b.addEventListener('click',()=>{const [w,k,who]=b.dataset.shwin.split('|');shareDuel(w,k,who);}));
  card.querySelectorAll('[data-share]').forEach(b=>b.addEventListener('click',()=>duelShare(b.dataset.share)));
  card.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{try{navigator.clipboard.writeText(DUEL_BOT+b.dataset.copy).then(()=>ecoToast('Link copied'),()=>ecoToast(DUEL_BOT+b.dataset.copy));}catch(e){ecoToast(DUEL_BOT+b.dataset.copy);}}));
}
