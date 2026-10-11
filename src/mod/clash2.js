/* =========================== HOUSES CLASH II (v1.1.2, backend v32) ===========================
   The server keeps every finished clash as a record (seed, input log, waves held, door left) and hands records back as GHOSTS: a
   ranked clash replays a real player's run on the top lane (his log, step by step, on the same seed — he is not asked and loses
   nothing); Elo on the PvP rating shared with duels, leagues Bronze → Dragon, five a day; a friend clash by link (`startapp=c_<code>`,
   any league): each plays against the other's record when it is there, the server compares the two; practice stays the bot.
   Nothing is paid or ranked on the phone: `clash_finish` is the verdict. Guests (no seat signed in) keep the local practice. */
const CL2={st:null,at:0,seat:-1,pending:null,busy:false,force:false};
const CLASH_BOT_LINK='https://t.me/HoldorTDBot/play?startapp=c_';
let cl2Rpc=(fn,args)=>ecoRpc(fn,args,10000);
function clashServer(){return !!(CL2.force||(ecoOn()&&ACC&&ACC.tut));}
function cl2Call(fn,args){if(CL2.force)return Promise.resolve(cl2Rpc(fn,args));return ecoLane(async()=>{await ecoSyncRaw();return await cl2Rpc(fn,Object.assign({seat:seatNo()},args));});}
function cl2Load(force){if(!clashServer())return Promise.resolve(null);
  if(!force&&CL2.st&&CL2.seat===seatNo()&&Date.now()-CL2.at<20000)return Promise.resolve(CL2.st);const seat=seatNo();
  return cl2Call('clash_state',{seat}).then(r=>{if(r&&r.state&&!CL2.force)ecoApply(r.state);if(seat===seatNo()){CL2.st=r;CL2.at=Date.now();CL2.seat=seat;}return r;}).catch(e=>{ECO.err=ecoMsg(e);return null;});}
/* ---------- a ghost: the rival's recorded log replayed on lane B ---------- */
function clashGhostInit(gh){CLASH.ghost={log:(gh.log||[]).filter(a=>a&&a.a).slice().sort((a,b)=>(a.t||0)-(b.t||0)),i:0,run:gh,wait:0};}
function clashGhostStep(){const g=CLASH.ghost;if(!g)return;const L=g.log;
  while(g.i<L.length&&(L[g.i].t||0)<=G.tick){const a=L[g.i];const done=clashGhostDo(a);if(!done){if(G.tick-(a.t||0)>60*25)g.i++;break;}g.i++;}}
function clashGhostDo(a){try{const slot=()=>G.map.slots.find(x=>x.id===a.s);
  switch(a.a){
    case 'build':{const s=slot();if(!s||s.tower||!TOWERS[a.type])return true;if(G.gold<costOf(a.type))return false;build(s,a.type);return true;}
    case 'up':{const s=slot();if(!s||!s.tower||s.tower.lvl>=5)return true;if(G.gold<upCost(s.tower))return false;upgradeTower(s);return true;}
    case 'sell':{const s=slot();if(s&&s.tower)sellTower(s);return true;}
    case 'rally':{const s=slot();if(s&&s.tower){s.tower.rx=a.x;s.tower.ry=a.y;}return true;}
    case 'call':if(canCall())callWave();return true;
    case 'power':if(G.powerCd&&G.powerCd[a.id]>0)G.powerCd[a.id]=0;castPower(a.id,a.x,a.y);return true;
    case 'ult':if(G.heroOn&&G.hero&&!G.hero.dead){G.hero.cd.ult=0;castUlt();}return true;
    case 'move':if(G.hero&&G.heroOn){G.hero.tx=a.x;G.hero.ty=a.y;}return true;
    case 'send':if(CLASH_COST[a.role]){CLASH.bsend=a.role;}return true;
    default:return true;}}catch(e){return true;}}
/* lane B's champion was made with the ghost's card: the bar at the bottom must show mine again */
function clashHeroBar(){const h=G.hero;if(!h||!h.c)return;const c=h.c,pu=CHAMP_ART[c.id+'_portrait'];$('#hEmoji').textContent=pu?'':c.e;$('#hEmoji').style.backgroundImage=pu?`url(${pu})`:'';$('#hName').textContent=shortName(c);$('#uEmoji').textContent=SK[c.sk[2]].e;$('#uName').textContent=SK[c.sk[2]].n;}
/* ---------- the record of my run, after the verdict on the phone ---------- */
function clashRunLog(){return (G.log||[]).concat(CLASH.log||[]).filter(a=>a&&a.a&&a.a!=='wave').sort((a,b)=>(a.t||0)-(b.t||0)).slice(0,600);}
function clashRunWaves(){return Math.min(10,Math.max(0,G.waveDone?G.wave:G.wave-1));}
function clashAfter(w){const el=document.getElementById('clSrv');if(!clashServer()){if(el)el.textContent='';return;}
  if(el)el.textContent='⏳ recording the run on the server…';
  const gh=CLASH.opp&&CLASH.opp.ghost;const args={kind:CLASH.kind||'practice',house:ACC.house,champ:ACC.sel||null,lvl:G.hero?G.hero.lvl||1:1,army:armyLvl(),seed:G.seed,bot:CLASH.opp?CLASH.opp.bot||0:0,log:clashRunLog(),waves:clashRunWaves(),door:Math.round(100*Math.max(0,G.doorHp)/G.doorMax),ghost:gh?gh.id:null,code:CLASH.code||null};
  cl2Call('clash_finish',args).then(r=>{CL2.st=null;if(r&&r.state&&!CL2.force)ecoApply(r.state);const e=document.getElementById('clSrv');if(!e)return;
    if(!r||!r.ok){e.textContent='The server did not take the run.';return;}
    const g=r.gift?Object.entries(r.gift).map(([k,v])=>'+'+v+(k==='gold'?' 🪙':' 💎')).join(' · '):'';
    if(r.clash){const c=r.clash;e.innerHTML=c.status==='done'?`<b>Friend clash ${c.result==='win'?'won':c.result==='loss'?'lost':'drawn'}</b> vs ${esc(c.opponent)} — ${c.me.waves} waves · 🧱 ${c.me.door}% against ${c.them.waves} · 🧱 ${c.them.door}%`:`Recorded: ${c.me.waves} waves · 🧱 ${c.me.door}%. Waiting for ${esc(c.opponent)} to play.`;}
    else if(r.run&&r.run.kind==='rank'){e.innerHTML=`<b>Server verdict: ${r.result==='win'?'WIN':r.result==='loss'?'LOSS':'DRAW'}</b> — ${r.run.waves} waves · 🧱 ${r.run.door}% against the ghost's ${gh.waves} · 🧱 ${gh.door}% · rating ${r.delta>0?'+':''}${r.delta} → ${r.rating} (${r.league})${g?' · '+g:''}`;}
    else e.innerHTML=`Recorded on the server${g?': '+g:''}${r.run&&r.run.waves<2?' (two waves or more pay)':''}.`;
    }).catch(err=>{const e=document.getElementById('clSrv');if(e)e.textContent='⚠️ '+String(ecoMsg(err)).slice(0,90);});}
/* ---------- the link: startapp=c_<code> ---------- */
function cl2FromStart(sp){if(sp&&/^c_[0-9a-f]{8}$/i.test(sp)){CL2.pending=sp.slice(2).toLowerCase();return true;}return false;}
function cl2PendingOpen(){if(!CL2.pending)return;if(!ecoOn()){setTimeout(cl2PendingOpen,800);return;}
  if(!ACC.tut){const c=CL2.pending;CL2.pending=null;ecoModal('⚔️ A clash challenge','Finish the tutorial battle first — then open the link again.',[{t:'OK'}]);return;}
  showClash();}
/* ---------- the screen ---------- */
function cl2Share(code){const link=CLASH_BOT_LINK+code,u='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('Houses Clash: my house against yours. Hold the door longer than me!');try{if(TG&&TG.openTelegramLink)TG.openTelegramLink(u);else window.open(u,'_blank');}catch(e){}}
function cl2Go(kind,code){if(CL2.busy)return;CL2.busy=true;ecoWait(true);
  cl2Call('clash_start',{kind,code:code||null}).then(r=>{CL2.busy=false;ecoWait(false);CL2.st=null;
    if(kind==='friend'&&!code){showClash();return;}
    if(kind==='friend'&&code&&r.clash&&r.clash.me&&r.clash.me.played){ecoToast('You have played this clash — waiting for '+r.clash.opponent);showClash();return;}
    const gh=r.ghost;if(kind==='rank'&&!gh)ecoToast('No ghost near your rating yet — a practice against the bot instead');
    overlay.classList.add('hidden');
    if(gh)clashStart({ghost:gh,kind:gh&&kind==='rank'?'rank':kind,code:code||null,seed:gh.seed,house:gh.house,bot:1});
    else clashStart({bot:clashRec().bot,kind:kind==='friend'?'friend':'practice',code:code||null});})
  .catch(e=>{CL2.busy=false;ecoWait(false);const m=String(ecoMsg(e));ecoModal('⚔️ Not now',ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,140)),[{t:'OK',f:()=>showClash()}]);});}
function cl2ClashRow(c){const st=c.status==='done'?(c.result==='win'?'<b class="dw">WIN</b>':c.result==='loss'?'<b class="dl">LOSS</b>':'<b>DRAW</b>'):c.status==='expired'?'<b class="dx">EXPIRED</b>':'<b class="dp">OPEN</b>';
  const sc=x=>x&&x.played?`${x.waves} 🌊 · 🧱 ${x.door}%`:'—';
  const link=c.status==='open'&&c.mine&&c.waiting?`<div class="reflink"><code>${esc(CLASH_BOT_LINK+c.code)}</code></div><div class="pvrow"><button class="btn" data-share="${c.code}">📨 Send to a friend</button><button class="btn sec" data-copy="${c.code}">Copy</button></div>`:'';
  const play=c.status==='open'&&!c.waiting&&!(c.me&&c.me.played)?`<div class="pvrow"><button class="btn" data-play="${c.code}">▶ Play my run</button></div>`:c.status==='open'&&c.mine&&c.waiting&&!(c.me&&c.me.played)?`<div class="pvrow"><button class="btn sec" data-play="${c.code}">▶ Play my run now</button></div>`:'';
  return `<div class="duelrow ${c.result||c.status}"><div class="dh"><span>🤝 ${c.waiting?'Friend clash':esc(c.opponent)}</span>${st}${c.status==='open'?`<small>${fmtLeft(c.left)} left</small>`:''}</div>
    <div class="ds"><span>You<br><em>${sc(c.me)}</em></span><i>vs</i><span>${c.waiting?'waiting for a friend to open the link':esc(c.opponent)}<br><em>${sc(c.them)}</em></span></div>${link}${play}</div>`;}
function showClash(back){if(typeof back==='function')CLASH.back=back;else if(!CLASH.back)CLASH.back=()=>showHub('events');
  if(!clashServer()){showClashLocal(back);return;}
  const R=clashRec(),hh=HOUSES[ACC.house];
  const draw=body=>{show(`<div class="topbar"><h1>⚔️ Houses Clash<small>Two lanes, the same dead. Send the soldiers of House ${hh.n} down the rival's road; whose door breaks first loses.</small></h1><button class="back" id="bBack">✖</button></div>`+body);CLOUD.screen='clash-menu';$('#bBack').addEventListener('click',()=>CLASH.back());};
  if(CL2.pending){const code=CL2.pending;CL2.pending=null;draw('<p class="m">⏳ joining the clash…</p>');cl2Go('friend',code);return;}
  const s=CL2.st&&CL2.seat===seatNo()?CL2.st:null;
  if(!s){draw('<p class="m">⏳ asking the server…</p>');cl2Load(true).then(()=>{if(CLOUD.screen==='clash-menu')showClash();});return;}
  if(Date.now()-CL2.at>20000)cl2Load(true).then(()=>{});
  const lv=['Bronze','Silver','Gold','Crystal','Dragon'];
  draw(`<div class="lg"><span class="le">${DUEL_LEAGUE[s.league]||'🥉'}</span><b>${s.league}</b><span class="rt">${s.rating}</span><small>${s.wins}W · ${s.losses}L · ${s.draws}D ranked · ${s.cw}W ${s.cl}L in clashes</small></div>
    <div class="dbtns"><button class="btn" id="bClRank" ${s.rank_left>0?'':'disabled'}>⚔️ Ranked clash <small>${s.rank_left} left today · a ghost near your rating</small></button>
    <button class="btn sec" id="bClFriend">🤝 Challenge a friend <small>any league · no rating</small></button></div>
    <div class="clbots">${lv.map((n,i)=>`<button class="clb ${i+1===R.bot?'on':''} ${i+1>R.bot?'lock':''}" data-b="${i+1}">${['🥉','🥈','🥇','💎','🐉'][i]}<b>${n}</b><small>bot ${i+1}</small></button>`).join('')}</div>
    <button class="btn sec" id="bClashGo">🤖 Practice vs bot ${R.bot} <small>60 🪙 for two waves or more, five a day</small></button>
    <div class="qlist">${(s.clashes||[]).map(cl2ClashRow).join('')}</div>
    ${(s.runs||[]).length?`<div class="hh"><h2>Your runs</h2></div><div class="qlist">${s.runs.slice(0,8).map(r=>`<div class="duelrow ${r.result||''}"><div class="dh"><span>${r.kind==='rank'?'⚔️ Ranked':r.kind==='friend'?'🤝 Friend':'🤖 Practice'}</span>${r.result?`<b class="${r.result==='win'?'dw':r.result==='loss'?'dl':''}">${r.result.toUpperCase()}</b>`:''}${r.delta?`<small class="${r.delta>0?'dw':'dl'}">${r.delta>0?'+':''}${r.delta}</small>`:''}</div><div class="ds"><span>${r.waves} 🌊 · 🧱 ${r.door}%</span></div></div>`).join('')}</div>`:''}
    <p class="m" style="font-size:11.5px">A ranked clash replays the recorded run of a real player near your rating on the top lane; the server compares the two records (waves, then the door). The ${TROOPS[ACC.house].house.n} needs army level ${ARMY_HOUSE_AT}.</p>`);
  $('#bClRank').addEventListener('click',()=>cl2Go('rank'));
  $('#bClFriend').addEventListener('click',()=>cl2Go('friend'));
  card.querySelectorAll('.clb').forEach(b=>b.addEventListener('click',()=>{const n=+b.dataset.b;if(n>R.bot){SFX.play('deny');return;}card.querySelectorAll('.clb').forEach(x=>x.classList.toggle('on',x===b));$('#bClashGo').dataset.b=n;$('#bClashGo').firstChild.textContent='🤖 Practice vs bot '+n+' ';SFX.play('tap',60);}));
  $('#bClashGo').addEventListener('click',()=>{overlay.classList.add('hidden');clashStart({bot:+($('#bClashGo').dataset.b||R.bot),kind:'practice'});});
  card.querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>cl2Go('friend',b.dataset.play)));
  card.querySelectorAll('[data-share]').forEach(b=>b.addEventListener('click',()=>cl2Share(b.dataset.share)));
  card.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{try{navigator.clipboard.writeText(CLASH_BOT_LINK+b.dataset.copy).then(()=>ecoToast('Link copied'),()=>ecoToast(CLASH_BOT_LINK+b.dataset.copy));}catch(e){ecoToast(CLASH_BOT_LINK+b.dataset.copy);}}));
}
