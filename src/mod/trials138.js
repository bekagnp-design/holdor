/* =========================== TRIALS (v1.3.8) ===========================
   The Clan tab left the bottom bar (five players do not make a clan): TRIALS took its place. One player, no server: an endless run called
   "The Long Night" on the map of the day. It is a local campaign-like battle (G.mode 'campaign', G.trials set, endless waves on the Hold's
   steeper curve) — it never calls battle_start / battle_finish and never touches the economy RPCs. Before EVERY wave the champion learns one of
   three skills (learn126), his battle levels and synergies work (champ130), the result shows the build card (build135).
   Rewards: a guest gets a little gold and a wooden chest per 5 waves held; a signed-in seat is paid by the server (backend v38: trials_start /
   trials_claim — 12 gold a wave, a wooden chest per 5 waves, one claim an hour, 600 gold a day). ACC.trials = {best, runs, last:{waves, hero,
   learned, name, kills}, srv:{d, at, left, next}} — `srv` is what the server last said about today's reward (day_left and the hour rule), so the
   page can say "next reward in 42 min" / "today's reward taken" with the server's own numbers. The old Clan page stays: showHub('clan'),
   with a back arrow; the invitations live on the Tasks page (a card on Quests opens Friends). Unlocks with stage 8 (OB_NEED.trials = 5).
   v1.5.0 polish: one big button that says its state (green START TRIAL / grey with the reason), best + gold left as one line, the reward on the
   result as a compact list. */
const TRIALS={gold:240,every:5,maxChests:4,goldPer:12,dayGold:600,gapMin:5,t:0};
HUB_ICON.trials='<svg viewBox="0 0 24 24"><path d="M15.5 3.2a9 9 0 1 0 5.3 15.6A7.6 7.6 0 0 1 15.5 3.2z" fill="#cfd8ea" stroke="#33415c" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 9.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="#ffd54a" stroke="#5a3a08" stroke-width=".6"/></svg>';
/* the tabs: Shop · Army · Battle · Trials. Clan is a page without a tab */
HUB_ORDER.splice(0,HUB_ORDER.length,'shop','coll','battle','trials');
HUB_HIDDEN.clan=1;
delete OB_NEED.clan;OB_NEED.trials=5;
delete HUB_LESSONS.clan;
HUB_LESSONS.trials={need:()=>obNew()&&obStage()>=5,steps:()=>[{sel:'.hubtabs button[data-tab="trials"]',anim:'lock',text:'<b>Trials</b> are open: an endless run on the map of the day. Your champion learns a new skill before every wave. How far can you build him?'}]};
function hubTabs(on){const t=[['shop','Shop'],['coll','Army'],['battle','Battle'],['trials','Trials']];
  const dot={shop:freeChestReady()||starChestsReady()>0,coll:typeof bookNewCount==='function'&&bookNewCount()>0,battle:starChestsReady()>0||(onlineOpen()&&ACC.online.attempts>0&&!(ACC.online.runs||[]).length),trials:false};
  const sel=HUB_HIDDEN[on]?'battle':on;
  return `<div class="hubtabs four">${t.map(([k,n])=>{const lk=hubLocked(k);return `<button class="${k===sel?'on':''} ${k==='battle'?'mid':''} ${lk?'lock':''}" data-tab="${k}"${lk?` data-lock="${OB_NEED[k]}"`:''}>${HUB_ICON[k]}${n}${lk?`<i class="lk">🔒 ${OB_NEED[k]}</i>`:dot[k]?'<span class="dot"></span>':''}</button>`;}).join('')}</div>`;}
function hubLockSay(k){SFX.play('deny');const st=OB_NEED[k]+(ACC&&ACC.sv?3:0);
  ecoToast(`🔒 ${k==='coll'?'Army':k==='shop'?'The Shop':'Trials'} opens after stage ${st}${ACC&&!ACC.tut?' — win your first battle first':''}`);}
function trialsAcc(){if(!ACC.trials||typeof ACC.trials!=='object')ACC.trials={best:0,runs:0};ACC.trials.best|=0;ACC.trials.runs|=0;return ACC.trials;}
/* ---------- the server's rule, remembered (v1.5.0) ----------
   The server pays once per UTC clock hour and at least 5 min after the last claim, up to 600 gold a UTC day. It tells the client only when a claim
   is made (day_left) or refused (the reason). ACC.trials.srv keeps that answer for the day: {d: UTC day, at, left: gold left today or null when
   unknown, next: when the hour rule lets the next claim through}. Times are the server's clock (ecoOff). */
function trialsNow(){return Date.now()+(typeof ecoOff==='function'?ecoOff():0);}
function trialsDay(t){return new Date(t).toISOString().slice(0,10);}
function trialsNextAt(t){const h=new Date(t);h.setUTCMinutes(0,0,0);return Math.max(h.getTime()+3600000,t+TRIALS.gapMin*60000);}
function trialsNote(kind,r){const T=trialsAcc(),t=trialsNow(),d=trialsDay(t),S=T.srv&&T.srv.d===d?T.srv:{};
  if(kind==='ok')T.srv={d,at:t,left:Math.max(0,r.day_left|0),next:trialsNextAt(t)};
  else if(kind==='hour')T.srv={d,at:t,left:S.left==null?null:S.left,next:trialsNextAt(t)};
  else if(kind==='day')T.srv={d,at:t,left:0,next:S.next||0};
  else return;persist();}
/* what the reason of a refusal means: hour → the clock rule, day → the daily cap, else the server's own words */
function trialsWhyKind(why){return /one claim per hour|a moment ago/i.test(why)?'hour':/used up/i.test(why)?'day':'';}
function trialsMins(ms){const m=Math.max(1,Math.ceil(ms/60000));return m>=60?'1 h':m+' min';}
function trialsHours(ms){return Math.max(1,Math.ceil(ms/3600000))+' h';}
/* the gate on the reward: ready | wait (the hour rule) | done (today's gold is used up). A guest is always ready: his run pays locally. */
function trialsGate(){const T=trialsAcc();if(!ecoWants())return {st:'ready',guest:true,left:null};
  const t=trialsNow(),d=trialsDay(t),S=T.srv&&T.srv.d===d?T.srv:null,left=S?S.left:null;
  if(S&&S.left!=null&&S.left<=0){const x=new Date(t);return {st:'done',left:0,ms:Date.UTC(x.getUTCFullYear(),x.getUTCMonth(),x.getUTCDate()+1)-t};}
  if(S&&S.next>t)return {st:'wait',left,ms:S.next-t};
  return {st:'ready',left};}
/* ---------- the page ---------- */
function trialsLastHTML(){const T=ACC.trials,l=T&&T.last;if(!l||!l.learned||!l.learned.length)return '';
  return `<div class="trlast"><div class="trlh"><b>Last build</b><small>${esc(l.name||'build')} · ${l.waves} ${l.waves===1?'wave':'waves'}</small></div><div class="bcsk">${l.learned.filter(k=>SK[k]).map(k=>`<span class="bcs">${skillIcon(k,34,0)}<small>${esc(SK[k].n)}</small></span>`).join('')}</div></div>`;}
/* one small line: the record, the runs, and (a server seat) today's gold left */
function trialsBestHTML(){const T=trialsAcc(),g=trialsGate(),best=T.best?`Best: wave ${T.best} · ${T.runs} ${T.runs===1?'run':'runs'}`:'Not played yet';
  if(g.guest)return best;
  return best+' · '+(g.left==null?`up to ${TRIALS.dayGold} 🪙 a day`:`<b class="${g.left>0?'ok':'no'}">${g.left} 🪙</b> left today`);}
/* the one big button: green when the run pays, grey saying why it does not (it still starts a run for the record) */
function trialsBtnHTML(){const g=trialsGate();
  if(g.st==='wait')return `<button class="bigbtn trgo wait" id="bTrials" data-st="wait"><span class="bt">⏳ NEXT REWARD IN ${trialsMins(g.ms).toUpperCase()}</span><span class="bs">⚔ Start anyway — this run counts for the record</span></button>`;
  if(g.st==='done')return `<button class="bigbtn trgo wait" id="bTrials" data-st="done"><span class="bt">✔ TODAY'S REWARD TAKEN</span><span class="bs">⚔ Play for the record · more gold in ${trialsHours(g.ms)}</span></button>`;
  return `<button class="bigbtn trgo ready" id="bTrials" data-st="ready"><span class="bt">⚔ START TRIAL</span><span class="bs">${TRIALS.goldPer} 🪙 a wave · a wooden chest every ${TRIALS.every} waves</span></button>`;}
function trialsRewardNote(){return ecoWants()?`Paid by the server after the run · one reward an hour · up to ${TRIALS.dayGold} 🪙 a day`:`Wooden chests open on the result screen · up to ${TRIALS.maxChests} a run`;}
function hubTrials(){rollDay();trialsAcc();const gm=genDaily(hash32(dayKeyUTC())),bio=gm.biome.charAt(0).toUpperCase()+gm.biome.slice(1);
  return `<div class="hh"><h2>Trials</h2><small>one player · nothing to wait for</small></div>
  <div class="trcard" id="trCard"><div class="trrow"><canvas class="hmmini" id="hmMini" width="84" height="60"></canvas>
    <div class="trtx"><b>The Long Night</b><small>${gm.mod.e} ${esc(gm.mod.n)} · ${esc(bio)} · the map of the day</small>
    <em id="trBest">${trialsBestHTML()}</em></div></div>
    <p class="trinfo">Hold the gate as long as you can — your champion learns a skill before every wave.</p>
    ${trialsBtnHTML()}<p class="trnote">${trialsRewardNote()}</p>${trialsLastHTML()}</div>`;}
function hubTrialsBind(){const b=document.getElementById('bTrials');if(b)b.addEventListener('click',()=>{SFX.play('tap',60);trialsStart();});hmMiniDraw();trialsTick();}
/* the countdown on the button moves while the page is open (every 30 s), in place, so the tap keeps working */
function trialsTick(){clearTimeout(TRIALS.t);const b=document.getElementById('bTrials');if(!b)return;
  const d=document.createElement('div');d.innerHTML=trialsBtnHTML();const nb=d.firstChild;
  if(b.className!==nb.className||b.innerHTML!==nb.innerHTML){b.className=nb.className;b.dataset.st=nb.dataset.st;b.innerHTML=nb.innerHTML;const e=document.getElementById('trBest');if(e)e.innerHTML=trialsBestHTML();}
  if(trialsGate().st!=='ready')TRIALS.t=setTimeout(trialsTick,30000);}
/* ---------- the run ---------- */
function trialsStart(){if(hubLocked('trials')){hubLockSay('trials');return;}startGame({mode:'trials'});}
function trialsLevel(gm){const L=Object.assign({},LEVELS[LEVELS.length-1],{n:'The Long Night',sub:'Trials',pts:gm.pts,biome:gm.biome,waves:1e9,mult:1,gold:TRIALS.gold,mod:null,boss:false,intro:'',dragon:8,king:25,lord:true,trials:true,stage:1});
  delete L.routes;delete L.gates;delete L.raw;delete L.lay;delete L.style;return L;}
function trialsRun(){const gm=genDaily(hash32(dayKeyUTC()));trialsAcc();G.bid=null;
  startGame0({mode:'campaign',level:trialsLevel(gm)});
  G.trials={day:dayKeyUTC()};G.totalWaves=Infinity;G.wo.online=true;G.mult=1;G.mod=gm.mod;G.lq=[];
  G.learnAsk=null;G.learnDone={};G.learned=[];G.learnRr=0;persist();
  if(ecoOn()){try{ecoRpc('trials_start',{seat:seatNo()},8000).catch(()=>{});}catch(e){}}}   /* v1.4.1: the server stamps the start; a refusal is ignored */
{const sg1=startGame;startGame=function(o){if(o&&(o.mode==='trials'||(o.level&&o.level.trials)))return trialsRun();return sg1(o);};
 const sg0=startGame0;startGame0=function(o){G.trials=null;return sg0(o);};
 const sw1=startWave;startWave=function(){if(G.trials&&G.wave>=15&&!G.learnAsk)G.mult*=1.02;return sw1();};
 const go1=gameOver;gameOver=function(){if(G.state!=='play'||!G.trials||G.mode!=='campaign')return go1();
   G.state='over';G.armed=null;G.sel=null;closeSheet();mergeStats();SFX.play('lose');trialsEnd();};}
/* the gate fell: the best is stored, a guest is paid, the result opens */
function trialsEnd(){const T=trialsAcc(),waves=Math.max(0,G.wave-1),neu=waves>T.best;
  T.runs++;if(neu)T.best=waves;
  const name=typeof buildName==='function'?buildName():'';
  T.last={waves,kills:G.kills|0,hero:G.hero?G.hero.c.id:null,learned:(G.learned||[]).slice(),name,syn:Object.keys(G.synDone||{}),lv:(G.hLv||0)+1};
  const paid=!ecoWants(),chests=paid?Math.min(TRIALS.maxChests,Math.floor(waves/TRIALS.every)):0,gold=paid?waves*TRIALS.goldPer:0;
  if(gold)addGold(gold);
  G.trialsR={waves,neu,chests,gold,paid,claimed:0,srv:ecoOn()&&waves>0?{st:'wait'}:null};persist();trialsResult();
  if(G.trialsR.srv)trialsClaim(G.trialsR);}
/* v1.4.1: a server seat asks the server to pay the run (backend v38 trials_claim); the screen shows its numbers or its refusal */
async function trialsClaim(R){
  try{await ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('trials_claim',{seat:seatNo(),waves:R.waves},10000);ecoApply(r.state);R.srv={st:'ok',w:r.waves|0||R.waves,gold:r.gold|0,chests:r.chests|0,cg:r.chest_gold|0,cm:r.chest_gems|0,left:r.day_left|0};trialsNote('ok',r);return r;});}
  catch(e){const why=ecoMsg(e).replace(/^.*?(P0001|exception):?\s*/i,'').slice(0,120)||'refused';R.srv={st:'no',why,kind:trialsWhyKind(why)};trialsNote(R.srv.kind);}
  if(G.trialsR===R&&document.getElementById('bTrAgain'))trialsResult();}
/* the reward as a compact list: what was held, what it paid, what is left today */
function trialsRows(R){const rows=[],row=(a,b,c)=>rows.push(`<div class="trr ${c||''}"><span>${a}</span><b>${b}</b></div>`),w=R.waves,ws=n=>`${n} ${n===1?'wave':'waves'} held`,cs=n=>`${n} Trials ${n===1?'chest':'chests'}`;
  if(R.paid){row(ws(w),R.gold?`+${R.gold} 🪙`:'—',R.gold?'':'mut');
    if(R.chests)row(cs(R.chests),`<i class="tx">${R.claimed>=R.chests?'opened ✔':'open below ↓'}</i>`);}
  else{const s=R.srv,g=trialsGate();
    if(!s)row(w>0?'Reward':'No waves held',w>0?'the server is not reachable':'nothing to claim','mut');
    else if(s.st==='wait')row('Reward','asking the server…','mut');
    else if(s.st==='ok'){row(ws(s.w||w),`+${s.gold} 🪙`);if(s.chests)row(cs(s.chests)+' opened',`+${s.cg} 🪙${s.cm?` · +${s.cm} 💎`:''}`);
      if(s.chests)row('Earned',`+${s.gold+s.cg} 🪙${s.cm?` · +${s.cm} 💎`:''}`,'tot');row('Left today',`${s.left} / ${TRIALS.dayGold} 🪙`,'mut');}
    else{row('No reward this time',s.kind==='hour'?`one reward an hour${g.st==='wait'?' · next in '+trialsMins(g.ms):''}`:s.kind==='day'?`today's ${TRIALS.dayGold} 🪙 are taken${g.st==='done'?' · more in '+trialsHours(g.ms):''}`:esc(s.why),'no');
      row('The run counts for the record','',"mut");}}
  return `<div class="trrw">${rows.join('')}</div>`;}
function trialsResult(){const R=G.trialsR;if(!R)return;const T=ACC.trials;
  const left=R.chests-R.claimed;
  show(`<h1>The Long Night took the gate<small>Trials · ${esc(shortName(G.hero.c))}</small></h1><div class="big">🌊 ${R.waves}</div>
  <p class="m">${R.waves===1?'wave':'waves'} held · ${G.kills} of the dead put down${R.neu&&R.waves>0?' · <b style="color:var(--gold)">new best</b>':` · best ${T.best}`}</p>
  ${trialsRows(R)}
  ${buildCard()}
  ${left>0?`<button class="btn" id="bTrChest"><span class="e">🎁</span> Open ${left} ${left===1?'chest':'chests'}</button>`:''}
  <button class="btn ${left>0?'sec':''}" id="bTrAgain"><span class="e">🔁</span> Try again</button><button class="btn sec" id="bTrBack">🌙 Back to Trials</button>`);
  const q=id=>document.getElementById(id);
  const sb=q('bBuildShare');if(sb)sb.addEventListener('click',()=>{SFX.play('tap',60);shareText(buildShareText());});
  const bc=q('bTrChest');if(bc)bc.addEventListener('click',()=>{SFX.play('tap',60);R.claimed++;openChest('wood',()=>trialsResult());});
  q('bTrAgain').addEventListener('click',()=>{SFX.play('tap',60);trialsStart();});
  q('bTrBack').addEventListener('click',()=>{SFX.play('tap',60);showHub('trials');});}
/* ---------- invitations on the Tasks page: one small card on Quests opens Friends ---------- */
function trialsInviteCard(){return `<button class="evcard wide" id="bInvCard"><span class="ic">👥</span><span class="tx"><b>Invite friends</b><small>a link, and a gift for you both</small></span><span class="st">›</span></button>`;}
{const ht1=hubTasks;hubTasks=function(sub){const h=ht1(sub);if(!tasksOn()||TASKS.sub!=='quests')return h;return h.replace('<div class="tkbody">','<div class="tkbody">'+trialsInviteCard());};
 const hb1=hubTasksBind;hubTasksBind=function(){hb1();const b=document.getElementById('bInvCard');if(b)b.addEventListener('click',()=>{SFX.play('tap',60);showHub('tasks','friends');});};}
