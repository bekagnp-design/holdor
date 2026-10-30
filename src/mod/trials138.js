/* =========================== TRIALS (v1.3.8) ===========================
   The Clan tab left the bottom bar (five players do not make a clan): TRIALS took its place. One player, no server: an endless run called
   "The Long Night" on the map of the day. It is a local campaign-like battle (G.mode 'campaign', G.trials set, endless waves on the Hold's
   steeper curve) — it never calls battle_start / battle_finish and never touches the economy RPCs. Before EVERY wave the champion learns one of
   three skills (learn126), his battle levels and synergies work (champ130), the result shows the build card (build135).
   Rewards: a guest gets a little gold and a wooden chest per 5 waves held; a signed-in seat gets none, because its gold and chests live on the
   server — the page says so. ACC.trials = {best, runs, last:{waves, hero, learned, name, kills}}. The old Clan page stays: showHub('clan'),
   with a back arrow; the invitations live on the Tasks page (a card on Quests opens Friends). Unlocks with stage 8 (OB_NEED.trials = 5). */
const TRIALS={gold:240,every:5,maxChests:4,goldPer:12,dayGold:600};
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
/* ---------- the page ---------- */
function trialsLastHTML(){const T=ACC.trials,l=T&&T.last;if(!l||!l.learned||!l.learned.length)return '';
  return `<div class="trlast"><div class="trlh"><b>Last build</b><small>${esc(l.name||'build')} · ${l.waves} ${l.waves===1?'wave':'waves'}</small></div><div class="bcsk">${l.learned.filter(k=>SK[k]).map(k=>`<span class="bcs">${skillIcon(k,34,0)}<small>${esc(SK[k].n)}</small></span>`).join('')}</div></div>`;}
function trialsRewardNote(){return ecoWants()?`This seat is kept by the server: a finished run pays ${TRIALS.goldPer} gold a wave and a wooden chest every ${TRIALS.every} waves, checked by the server — one claim an hour, up to ${TRIALS.dayGold} gold a day.`:`Every ${TRIALS.every} waves held: a wooden chest (up to ${TRIALS.maxChests}), and a little gold.`;}
function hubTrials(){rollDay();const T=trialsAcc(),gm=genDaily(hash32(dayKeyUTC())),bio=gm.biome.charAt(0).toUpperCase()+gm.biome.slice(1);
  return `<div class="hh"><h2>Trials</h2><small>one player · nothing to wait for</small></div>
  <div class="trcard" id="trCard"><div class="trrow"><canvas class="hmmini" id="hmMini" width="84" height="60"></canvas>
    <div class="trtx"><b>The Long Night</b><small>${gm.mod.e} ${esc(gm.mod.n)} · ${esc(bio)} · the map of the day</small>
    <em id="trBest">${T.best?`Best: wave ${T.best} · ${T.runs} ${T.runs===1?'run':'runs'}`:'Not played yet'}</em></div></div>
    <p class="trinfo">Hold the gate as long as you can. Before every wave your champion learns one of three skills — shape his build; every wave is harder than the last.</p>
    <button class="btn trgo" id="bTrials">START</button><p class="trnote">${trialsRewardNote()}</p>${trialsLastHTML()}</div>`;}
function hubTrialsBind(){const b=document.getElementById('bTrials');if(b)b.addEventListener('click',()=>{SFX.play('tap',60);trialsStart();});hmMiniDraw();}
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
  try{await ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('trials_claim',{seat:seatNo(),waves:R.waves},10000);ecoApply(r.state);R.srv={st:'ok',gold:r.gold|0,chests:r.chests|0,cg:r.chest_gold|0,cm:r.chest_gems|0,left:r.day_left|0};return r;});}
  catch(e){R.srv={st:'no',why:ecoMsg(e).replace(/^.*?(P0001|exception):?\s*/i,'').slice(0,120)||'refused'};}
  if(G.trialsR===R&&document.getElementById('bTrAgain'))trialsResult();}
function trialsSrvLine(R){const s=R.srv;if(!s)return '<p class="m">Signed-in seat: no reward is waiting.</p>';
  if(s.st==='wait')return '<p class="m">Asking the server for the reward…</p>';
  if(s.st==='ok')return `<p class="m"><b style="color:var(--gold)">+${s.gold+s.cg} 🪙 gold</b>${s.cm?` · +${s.cm} 💎`:''}${s.chests?` · ${s.chests} Trials ${s.chests===1?'chest':'chests'} opened`:''} · ${s.left} gold left today</p>`;
  return `<p class="m">No reward this time: ${esc(s.why)}</p>`;}
function trialsResult(){const R=G.trialsR;if(!R)return;const T=ACC.trials;
  const left=R.chests-R.claimed;
  show(`<h1>The Long Night took the gate<small>Trials · ${esc(shortName(G.hero.c))}</small></h1><div class="big">🌊 ${R.waves}</div>
  <p class="m">${R.waves===1?'wave':'waves'} held · ${G.kills} of the dead put down${R.neu&&R.waves>0?' · <b style="color:var(--gold)">new best</b>':` · best ${T.best}`}</p>
  ${!R.paid?trialsSrvLine(R):`<p class="m">${R.gold?`<b style="color:var(--gold)">+${R.gold} 🪙 gold</b>`:'no gold this time'}${R.chests?` · ${R.chests} Trials ${R.chests===1?'chest':'chests'}`:''}</p>`}
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
