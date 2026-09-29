/* =========================== LOGIN CALENDAR + QUESTS (v1.0.61) ===========================
   A 30-day calendar (every reward visible ahead; a missed day changes nothing — the calendar goes on from where the seat left it;
   day 30, 60 and 90 also open the next sealed champion of the house) and Daily / Weekly / Monthly quests. Everything is paid by the
   server (backend v10) and quest progress is counted from the server's own records: the app only shows numbers and asks to claim.
   The tables below are exported to the server (econ_config 'calendar' / 'quests'), so app and server agree. Needs a seat signed in through Telegram. */
const LOGIN_CAL=[
 {gems:10},{gold:400},{books:{'b:c':2}},{gems:10},{gold:600},{books:{'b:c':3}},{gems:20,books:{'b:r':1}},
 {gold:800},{gems:15},{books:{'b:c':3}},{gold:1000},{gems:15},{books:{'b:r':1}},{gems:30,books:{'b:r':1}},
 {gold:1500},{gems:20},{books:{'b:c':4}},{gold:2000},{gems:20},{books:{'b:r':2}},{gems:40,books:{'b:e':1}},
 {gold:2500},{gems:25},{books:{'b:c':5}},{gold:3000},{gems:25},{books:{'b:r':2}},{gems:50},{gold:4000},{gems:100,books:{'b:e':1}},
];
const LOGIN_SPECIAL_GEMS=300;
const QUESTS={
 daily:[
  {id:'d_win1',m:'wins',n:1,t:'Win a stage',r:{gold:300}},
  {id:'d_kill',m:'kills',n:300,t:'Defeat 300 of the dead',r:{gems:8}},
  {id:'d_win3',m:'wins',n:3,t:'Win 3 stages',r:{books:{'b:c':2}}}],
 weekly:[
  {id:'w_win10',m:'wins',n:10,t:'Win 10 stages',r:{gems:40}},
  {id:'w_days4',m:'days',n:4,t:'Play on 4 different days',r:{books:{'b:r':1}}},
  {id:'w_stars15',m:'stars',n:15,t:'Earn 15 stars in battles',r:{gold:2000}},
  {id:'w_hold3',m:'hold_runs',n:3,t:'Finish 3 Hold runs',r:{gems:30}}],
 monthly:[
  {id:'m_win60',m:'wins',n:60,t:'Win 60 stages',r:{gems:150,books:{'b:e':1}}},
  {id:'m_days20',m:'days',n:20,t:'Play on 20 different days',r:{gems:100}},
  {id:'m_new10',m:'new_stages',n:10,t:'Hold 10 new stages',r:{gold:5000,books:{'b:e':1}}},
  {id:'m_hold25',m:'hold_waves',n:25,t:'Reach wave 25 in the Hold',r:{gems:60}}],
};
const DAILY={st:null,at:0,tab:'cal',shown:false,seat:-1,busy:false};
function dailyOn(){return !!(ecoOn()&&ACC&&ACC.tut);}
function rewardChips(r,sm){if(!r)return '';const c=[];
  if(r.gems)c.push(`<span class="rch">${GEM_SVG}${r.gems}</span>`);
  if(r.gold)c.push(`<span class="rch">${GOLD_SVG}${fmtN(r.gold)}</span>`);
  for(const k in (r.books||{}))c.push(`<span class="rch">${bookIcon(k.slice(2),sm?14:16)}×${r.books[k]}</span>`);
  return c.join('');}
function questName(id){for(const k in QUESTS){const q=QUESTS[k].find(x=>x.id===id);if(q)return q;}return null;}
/* the state comes from the server (quest_state); one answer is kept for 45 s unless something was claimed */
function dailyLoad(force){if(!ecoOn())return Promise.resolve(null);
  if(!force&&DAILY.st&&DAILY.seat===seatNo()&&Date.now()-DAILY.at<45000)return Promise.resolve(DAILY.st);
  const seat=seatNo();
  return ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('quest_state',{seat},9000);if(seat===seatNo()){DAILY.st=r;DAILY.at=Date.now();DAILY.seat=seat;}return r;}).catch(e=>{ECO.err=ecoMsg(e);return null;});}
function dailyReady(){const s=DAILY.st;if(!s||DAILY.seat!==seatNo())return 0;let n=s.login&&s.login.can?1:0;
  for(const k in (s.periods||{}))for(const q of s.periods[k].q)if(q.cur>=q.need&&!q.claimed)n++;return n;}
function dailyBtnHTML(){const n=dailyOn()?dailyReady():0;
  return `<button class="cbld" id="bDaily"><span class="ic">📜</span><span class="tx"><b>Daily &amp; quests</b><small>${dailyOn()?(n?`<em class="dn">${n} ready</em>`:'calendar · quests'):'a Telegram seat'}</small></span></button>`;}
function dailyBtnRefresh(){if(!dailyOn())return;dailyLoad().then(()=>{const b=document.getElementById('bDaily');if(b)b.outerHTML=dailyBtnHTML(),dailyBtnBind();});}
function dailyBtnBind(){const b=document.getElementById('bDaily');if(b)b.addEventListener('click',()=>{SFX.play('tap',60);showDaily();});}
/* what a claim did */
function dailyClaimModal(res,title){const r=res.reward,ch=res.champ&&CBY[res.champ];
  ecoModal(title,`<div class="rw">${rewardChips(r)}</div>${ch?`<div class="newch">${portraitHTML(ch,64)}<b>${esc(ch.n)}</b><small>joins your house — sealed no more!</small></div>`:''}`,[{t:'OK',f:()=>{if(CLOUD.screen&&CLOUD.screen.indexOf('daily')===0)showDaily(DAILY.tab);else ecoRedraw();}}]);}
async function dailyClaimLogin(){if(DAILY.busy||!ecoOn())return;DAILY.busy=true;ecoWait(true);
  try{const seat=seatNo(),r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc('login_claim',{seat},10000);ecoApply(x.state);return x;});
    DAILY.st=r.quests;DAILY.at=Date.now();DAILY.seat=seat;ecoWait(false);DAILY.busy=false;SFX.play('collect');persist();dailyClaimModal(r,'📅 Day '+r.day+' — yours');}
  catch(e){DAILY.busy=false;ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m)){await dailyLoad(true);}ecoModal('📅 Not now',/already/.test(m)?'Today\'s reward is already claimed. Come back tomorrow.':ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,120)),[{t:'OK',f:()=>showDaily(DAILY.tab)}]);}}
async function dailyClaimQuest(id){if(DAILY.busy||!ecoOn())return;DAILY.busy=true;ecoWait(true);
  try{const seat=seatNo(),r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc('quest_claim',{seat,quest:id},10000);ecoApply(x.state);return x;});
    DAILY.st=r.quests;DAILY.at=Date.now();DAILY.seat=seat;ecoWait(false);DAILY.busy=false;SFX.play('collect');persist();const q=questName(id);dailyClaimModal(r,'📜 '+(q?q.t:'Quest done'));}
  catch(e){DAILY.busy=false;ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m))await dailyLoad(true);ecoModal('📜 Not now',ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,120)),[{t:'OK',f:()=>showDaily(DAILY.tab)}]);}}
/* the popup when the castle opens and today's reward waits (once a session; never over a tutorial or a tour) */
function dailyPopupCheck(){
  if(DAILY.shown||!dailyOn()||G.state==='play'||(G.tut)||(typeof COACH!=='undefined'&&COACH.on)||CLOUD.screen!=='hub:battle')return;
  if(document.querySelector('#ecoModal.on')||document.querySelector('#cer:not(.hidden)'))return;
  dailyLoad().then(s=>{if(!s||DAILY.shown||CLOUD.screen!=='hub:battle'||!s.login.can||(typeof COACH!=='undefined'&&COACH.on)||document.querySelector('#ecoModal.on'))return;
    DAILY.shown=true;const d=s.login.day,next=[1,2,3].map(i=>{const dd=d+i;return dd<=30?`<span class="pv"><i>Day ${dd}</i>${rewardChips(LOGIN_CAL[dd-1],1)}</span>`:'';}).join('');
    ecoModal('📅 Day '+d+' of 30',`<div class="rw">${rewardChips(LOGIN_CAL[d-1])}</div>${d%30===0?'<small class="sp">…and the next sealed champion of your house</small>':''}<div class="pvrow">${next}</div>`,
      [{t:'🎁 Claim',f:dailyClaimLogin},{t:'Later'}]);});}
/* ---------- the screen ---------- */
function fmtLeft(s){const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?d+'d '+h+'h':h?h+'h '+m+'m':m+'m';}
function showDaily(tab){
  DAILY.tab=tab||DAILY.tab||'cal';
  const tabs=[['cal','📅 Calendar'],['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']];
  const head=`<div class="topbar"><h1>📜 Daily &amp; quests<small>Rewards are paid by the server. Progress counts only battles it has seen.</small></h1><button class="back" id="bBack">✖</button></div>
   <div class="subtabs">${tabs.map(([k,n])=>`<button class="${k===DAILY.tab?'on':''}" data-t="${k}">${n}</button>`).join('')}</div>`;
  const draw=body=>{show(head+body);CLOUD.screen='daily:'+DAILY.tab;$('#bBack').addEventListener('click',()=>showHub('battle'));card.querySelectorAll('.subtabs button').forEach(b=>b.addEventListener('click',()=>showDaily(b.dataset.t)));};
  if(!dailyOn()){draw(`<p class="m">${ecoOn()?'Finish the tutorial battle first.':'The calendar and the quests are paid by the server — they need a seat signed in through Telegram.'}</p>`);return;}
  const s=DAILY.st&&DAILY.seat===seatNo()?DAILY.st:null;
  if(!s){draw('<p class="m">⏳ asking the server…</p>');dailyLoad().then(r=>{if(CLOUD.screen==='daily:'+DAILY.tab)showDaily(DAILY.tab);});return;}
  if(Date.now()-DAILY.at>45000)dailyLoad(true).then(()=>{});
  if(DAILY.tab==='cal'){const L=s.login,pos=L.n%30,round=Math.floor(L.n/30)+1;
    const tiles=LOGIN_CAL.map((r,i)=>{const d=i+1,done=d<=pos,today=d===pos+1;
      return `<div class="cday ${done?'done':''} ${today?'today':''} ${d===30?'big':''}"><b>${d}</b><span>${rewardChips(r,1)}</span>${done?'<i class="ck">✔</i>':''}${d===30?'<em class="spc">👑</em>':''}</div>`;}).join('');
    draw(`<p class="m">Round ${round} · ${L.n} day${L.n===1?'':'s'} claimed in all. A missed day costs nothing — the calendar waits for you.${L.special_in?`<br>👑 A champion of your house is yours after <b>${L.special_in}</b> more claimed day${L.special_in===1?'':'s'} (day 30, 60, 90).`:''}</p>
      <div class="cgrid">${tiles}</div>
      <button class="btn" id="bLogin" ${L.can?'':'disabled'}>${L.can?'🎁 Claim day '+L.day:'✔ Today\'s reward is claimed'}</button>`);
    const b=$('#bLogin');if(b)b.addEventListener('click',dailyClaimLogin);return;}
  const P=s.periods[DAILY.tab],list=QUESTS[DAILY.tab];
  const rows=P.q.map(q=>{const def=list.find(x=>x.id===q.id)||{t:q.id,r:{}},ready=q.cur>=q.need&&!q.claimed,pc=Math.round(100*q.cur/q.need);
    return `<div class="qrow ${q.claimed?'done':''} ${ready?'ready':''}"><div class="qt"><b>${esc(def.t)}</b><span class="qbar"><i style="width:${pc}%"></i><em>${fmtN(q.cur)} / ${fmtN(q.need)}</em></span><span class="qrw">${rewardChips(def.r,1)}</span></div>
      <button data-q="${q.id}" ${ready?'':'disabled'}>${q.claimed?'✔':ready?'Claim':'…'}</button></div>`;}).join('');
  draw(`<p class="m">Resets in <b>${fmtLeft(P.left)}</b> (${DAILY.tab==='daily'?'UTC midnight':DAILY.tab==='weekly'?'Monday, UTC':'the 1st, UTC'}).</p><div class="qlist">${rows}</div>`);
  card.querySelectorAll('.qrow button[data-q]').forEach(b=>b.addEventListener('click',()=>dailyClaimQuest(b.dataset.q)));}
