/* =========================== TASKS (v1.0.76, backend v20) ===========================
   The Tasks tab took Earn's place in the bottom bar. Three parts, like the quest screens of Brawl Stars and Clash Royale:
   Quests  — daily / weekly / monthly (quest_state, the same numbers as the Daily screen); Mon–Tue "Quest Rush" doubles every reward.
   Social  — open a link (the HOLDOR channel, the chat, X, YouTube, TikTok) or share the game; the gift can be claimed ten seconds after
             the server saw the link opened. A link task shows up only when the owner has filled its url on the server.
   Friends — the friend tasks (one and three friends joined) and the invitation block (link, gifts, each friend's progress).
   Everything is paid by the server; the app only shows what the server sends and asks it to pay. */
const TASKS={st:null,at:0,seat:-1,sub:'quests',busy:false};
function tasksOn(){return !!(ecoOn()&&ACC&&ACC.tut);}
function tasksLoad(force){if(!ecoOn())return Promise.resolve(null);
  if(!force&&TASKS.st&&TASKS.seat===seatNo()&&Date.now()-TASKS.at<8000)return Promise.resolve(TASKS.st);
  const seat=seatNo();
  return ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('task_state',{seat},9000);if(seat===seatNo()){TASKS.st=r;TASKS.at=Date.now();TASKS.seat=seat;}return r;}).catch(e=>{ECO.err=ecoMsg(e);return null;});}
function tkState(){return TASKS.st&&TASKS.seat===seatNo()?TASKS.st:null;}
function tkQuestsReady(){const s=DAILY.st&&DAILY.seat===seatNo()?DAILY.st:null;let n=0;if(!s)return 0;
  for(const k in (s.periods||{}))for(const q of s.periods[k].q)if(q.cur>=q.need&&!q.claimed)n++;return n;}
function tkReady(kind){const s=tkState();if(!s)return 0;return s.items.filter(i=>i.st==='ready'&&(kind==='social'?i.kind==='link':kind==='friends'?i.kind==='ref':true)).length;}
/* the red number on the tab: quests to claim + tasks to claim */
function tasksReady(){return tasksOn()?tkQuestsReady()+tkReady():0;}
function tkRush(){const e=evAt(Date.now());return e.kind==='rush'&&e.active?e:null;}
function tkDouble(r){if(!r)return r;const o={};if(r.gold)o.gold=r.gold*2;if(r.gems)o.gems=r.gems*2;if(r.books){o.books={};for(const k in r.books)o.books[k]=r.books[k]*2;}if(r.gear)o.gear=r.gear;return o;}
function tkOpenUrl(u){try{if(/^https:\/\/t\.me\//i.test(u)&&TG&&TG.openTelegramLink)TG.openTelegramLink(u);else if(TG&&TG.openLink)TG.openLink(u);else window.open(u,'_blank');}catch(e){}}
function tkShareLink(){const f=DAILY.fr&&DAILY.seat===seatNo()?DAILY.fr:null;return f?refLink(f.code):'https://t.me/HoldorTDBot/play?startapp=s_share';}

/* ---------- drawing ---------- */
function tkQuestRows(kind,P,rush){const list=QUESTS[kind]||[];
  return P.q.map(q=>{const def=list.find(x=>x.id===q.id)||{t:q.id,r:{}},ready=q.cur>=q.need&&!q.claimed,pc=Math.round(100*q.cur/q.need);
    return `<div class="qrow tk ${q.claimed?'done':''} ${ready?'ready':''}"><div class="qt"><b>${esc(def.t)}</b><span class="qbar"><i style="width:${pc}%"></i><em>${fmtN(q.cur)} / ${fmtN(q.need)}</em></span><span class="qrw">${rewardChips(rush&&!q.claimed?tkDouble(def.r):def.r,1)}${rush&&!q.claimed?'<b class="x2">×2</b>':''}</span></div>
      <button class="${ready?'go':''}" data-q="${q.id}" ${ready?'':'disabled'}>${q.claimed?'✔':ready?'Claim':'…'}</button></div>`;}).join('');}
function tkQuests(){const s=DAILY.st&&DAILY.seat===seatNo()?DAILY.st:null;if(!s)return '<p class="m">⏳ asking the server…</p>';
  const rush=tkRush(),names={daily:'Daily',weekly:'Weekly',monthly:'Monthly'};
  return ['daily','weekly','monthly'].map(k=>{const P=s.periods[k];if(!P)return '';
    return `<div class="tksec"><h3>${names[k]}<small>resets in ${fmtLeft(P.left)}</small></h3><div class="qlist">${tkQuestRows(k,P,!!rush)}</div></div>`;}).join('')+
    `<button class="tkmore" id="bTkCal">📅 Login calendar &amp; level gifts ›</button>`;}
function tkBtn(i){if(i.st==='done')return '<button disabled>✔</button>';
  if(i.st==='ready')return `<button class="go" data-c="${i.id}">Claim</button>`;
  if(i.st==='wait')return `<button disabled data-w="${i.id}" data-until="${Date.now()+i.left*1000}">⏳ ${i.left}s</button>`;
  return i.kind==='link'?`<button class="go" data-o="${i.id}">${i.url==='share'?'Share':'Go'}</button>`:'<button disabled>…</button>';}
function tkRow(i){const prog=i.kind==='ref'?`<span class="qbar"><i style="width:${Math.round(100*i.cur/i.need)}%"></i><em>${i.cur} / ${i.need}</em></span>`:'';
  return `<div class="qrow tkr ${i.st==='done'?'done':''} ${i.st==='ready'?'ready':''}"><span class="tki">${i.e||'⭐'}</span><div class="qt"><b>${esc(i.n)}</b>${prog}<span class="qrw">${rewardChips(i.r,1)}</span></div>${tkBtn(i)}</div>`;}
function tkSocial(){const s=tkState();if(!s)return '<p class="m">⏳ asking the server…</p>';
  const L=s.items.filter(i=>i.kind==='link');
  return `<p class="m">Open a link, stay a few seconds, come back and claim. Each gift is once per Telegram account.</p><div class="qlist">${L.map(tkRow).join('')}</div>
    ${L.filter(i=>i.url!=='share').length?'':'<p class="m dim">More tasks are coming: the HOLDOR channel, the players\' chat and our pages.</p>'}`;}
function tkFriends(){const s=tkState();const F=s?s.items.filter(i=>i.kind==='ref'):[];
  return `${F.length?`<div class="qlist">${F.map(tkRow).join('')}</div>`:''}${invBox()}`;}
function hubTasks(sub){
  const head=`<div class="hh"><h2>Tasks</h2><small>gifts paid by the server</small></div>`;
  if(!tasksOn())return head+`<p class="m">${ecoOn()?'Finish the tutorial battle first.':'Tasks are kept by the server — they need a seat signed in through Telegram.'}</p>`;
  if(sub)TASKS.sub=sub;sub=TASKS.sub;
  const rush=tkRush(),e=evAt(Date.now());
  const strip=rush?`<div class="rushstrip on"><b>📜 Quest Rush</b><span>every quest pays ×2</span><em id="tkRushCd">${evLeft(rush.t1-Date.now())}</em></div>`
    :e.kind==='rush'?`<div class="rushstrip"><b>📜 Quest Rush</b><span>quests ×2 on Monday and Tuesday</span><em id="tkRushCd">in ${evLeft(e.t0-Date.now())}</em></div>`:'';
  const n={quests:tkQuestsReady(),social:tkReady('social'),friends:tkReady('friends')+((DAILY.fr&&DAILY.seat===seatNo()&&DAILY.fr.invited||[]).filter(x=>x.done&&!x.claimed).length)};
  const tabs=[['quests','📜 Quests'],['social','📣 Social'],['friends','👥 Friends']];
  const body=sub==='social'?tkSocial():sub==='friends'?tkFriends():tkQuests();
  return head+strip+`<div class="subtabs tks">${tabs.map(([k,t])=>`<button class="${k===sub?'on':''}" data-tk="${k}">${t}${n[k]?`<i class="dot">${n[k]}</i>`:''}</button>`).join('')}</div><div class="tkbody">${body}</div>`;}

/* ---------- claims ---------- */
async function tkCall(fn,args,after){if(TASKS.busy||!ecoOn())return;TASKS.busy=true;ecoWait(true);
  try{const seat=seatNo(),r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc(fn,Object.assign({seat},args),10000);if(x.state)ecoApply(x.state);return x;});
    if(r.tasks){TASKS.st=r.tasks;TASKS.at=Date.now();TASKS.seat=seat;}if(r.quests){DAILY.st=r.quests;DAILY.at=Date.now();DAILY.seat=seat;}
    ecoWait(false);TASKS.busy=false;persist();after&&after(r);}
  catch(e){TASKS.busy=false;ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m)){await tasksLoad(true);await dailyLoad(true);}
    ecoModal('📜 Not now',ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,140)),[{t:'OK',f:()=>{if(CLOUD.screen==='hub:tasks')showHub('tasks');}}]);}}
function tkPaid(btn,r,title){SFX.play('collect');if(r.reward&&r.reward.gear)gearLoad(true);
  const rw=r.reward||{};try{if(btn&&typeof flyReward==='function'){if(rw.gems)flyReward(btn,{k:'gems',n:'+'+rw.gems});else if(rw.gold)flyReward(btn,{k:'gold',n:'+'+fmtN(rw.gold)});}}catch(e){}
  ecoToast(`${title} · ${[rw.gems?'+'+rw.gems+' 💎':'',rw.gold?'+'+fmtN(rw.gold)+' 🪙':''].filter(Boolean).join(' ')}${r.rush?' (×2 Quest Rush)':''}`,true);
  if(CLOUD.screen==='hub:tasks')showHub('tasks');}
function tkOpen(id,btn){const s=tkState();const i=s&&s.items.find(x=>x.id===id);if(!i)return;SFX.play('tap',60);
  if(i.url==='share')refShare(tkShareLink());else tkOpenUrl(i.url);
  tkCall('task_open',{task:id},()=>{if(CLOUD.screen==='hub:tasks')showHub('tasks');});}
/* the ten-second countdown on opened links */
function tkTick(){if(CLOUD.screen!=='hub:tasks')return;let any=false,done=false;
  card.querySelectorAll('button[data-w]').forEach(b=>{const left=Math.ceil((+b.dataset.until-Date.now())/1000);if(left>0){b.textContent='⏳ '+left+'s';any=true;}else done=true;});
  const c=document.getElementById('tkRushCd');if(c){const e=evAt(Date.now());c.textContent=e.active&&e.kind==='rush'?evLeft(e.t1-Date.now()):'in '+evLeft(e.t0-Date.now());any=true;}
  if(done){tasksLoad(true).then(()=>{if(CLOUD.screen==='hub:tasks')showHub('tasks');});return;}
  if(any)setTimeout(tkTick,1000);}
function hubTasksBind(){
  if(tasksOn()){const a=TASKS.st,b=DAILY.st,c=DAILY.fr;
    tasksLoad().then(r=>{if(r&&r!==a&&CLOUD.screen==='hub:tasks')showHub('tasks');});
    dailyLoad(Date.now()-DAILY.at>8000).then(r=>{if(r&&r!==b&&CLOUD.screen==='hub:tasks')showHub('tasks');});
    if(TASKS.sub==='friends'||TASKS.sub==='social')frLoad().then(r=>{if(r&&r!==c&&CLOUD.screen==='hub:tasks')showHub('tasks');});}
  card.querySelectorAll('.subtabs.tks button').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',50);TASKS.sub=b.dataset.tk;showHub('tasks');}));
  card.querySelectorAll('.tkbody button[data-q]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.q,q=questName(id);tkCall('quest_claim',{quest:id},r=>tkPaid(b,r,'📜 '+(q?q.t:'Quest done')));}));
  card.querySelectorAll('.tkbody button[data-o]').forEach(b=>b.addEventListener('click',()=>tkOpen(b.dataset.o,b)));
  card.querySelectorAll('.tkbody button[data-c]').forEach(b=>b.addEventListener('click',()=>{const s=tkState(),i=s&&s.items.find(x=>x.id===b.dataset.c);tkCall('task_claim',{task:b.dataset.c},r=>tkPaid(b,r,(i?i.e+' '+i.n:'Task done')));}));
  const cal=$('#bTkCal');if(cal)cal.addEventListener('click',()=>{SFX.play('tap',60);showDaily('cal');});
  invBind();tkTick();
}
