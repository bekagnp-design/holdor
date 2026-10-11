/* =========================== THE SIMPLE HOME (v1.0.98) ===========================
   Four tabs instead of five: SHOP · ARMY · BATTLE · CLAN. The Hold is the heart of the game, so it sits in the middle of the home as a
   card (today's map drawn small, the modifier, the countdown to the next map, today's best run, the big HOLD button); the campaign is
   the row under it. The chests moved to the top. The five quick buttons are gone: Forge, Tavern and the City live in ARMY, Season in
   the SHOP, Daily inside Tasks. Tasks is a 📜 pill in the strip and opens as a page with a back arrow, like the full Hold page and the
   standings. One look (the living gate), no 🎨. Events come as popups; the ✉ pill reopens the current one. CLAN holds the realm (chat,
   war, standings) and the friends until the clans themselves come. The ids the tutorial and the tests know stay: #bBattle, #starChest,
   #lvlChest, #freeChest, #dailyGift, #hubTro, #evBadge, #hmGoal, #bChampH, #bMapH / #bDiffH, #bHold, #bForge, #bTavern, #bCity,
   #bSeason, #bDaily. This module is injected after the hub, so its declarations replace the hub's and the skins' of the same name. */
const HUB_HIDDEN={tasks:1,hold:1,events:1};   /* pages without a tab button: they open from the home and carry a back arrow */
HUB_ICON.clan='<svg viewBox="0 0 24 24"><path d="M4 3h16v9c0 4.6-3.5 7.6-8 9.5C7.5 19.6 4 16.6 4 12z" fill="#2f8f5b" stroke="#0e3a22" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.3" fill="#ffe08a" stroke="#5a3a08" stroke-width=".8"/><circle cx="7.6" cy="11" r="1.7" fill="#ffe08a" stroke="#5a3a08" stroke-width=".8"/><circle cx="16.4" cy="11" r="1.7" fill="#ffe08a" stroke="#5a3a08" stroke-width=".8"/><path d="M6.5 16.6c1.2-2.2 3.2-3.3 5.5-3.3s4.3 1.1 5.5 3.3" fill="none" stroke="#ffe08a" stroke-width="1.7" stroke-linecap="round"/></svg>';
function hubTabs(on){const t=[['shop','Shop'],['coll','Army'],['battle','Battle'],['clan','Clan']];
  const fr=typeof tkReady==='function'&&typeof tasksOn==='function'&&tasksOn()?tkReady('friends'):0;
  const dot={shop:freeChestReady()||starChestsReady()>0,battle:starChestsReady()>0||(onlineOpen()&&ACC.online.attempts>0&&!(ACC.online.runs||[]).length),clan:fr>0};
  const sel=HUB_HIDDEN[on]?'battle':on;
  return `<div class="hubtabs four">${t.map(([k,n])=>`<button class="${k===sel?'on':''} ${k==='battle'?'mid':''}" data-tab="${k}">${HUB_ICON[k]}${n}${dot[k]?'<span class="dot"></span>':''}</button>`).join('')}</div>`;}
/* a page without a tab: a back arrow on top */
function hubHiddenBack(tab){if(!HUB_HIDDEN[tab])return;const b=document.getElementById('hubBody');if(!b)return;
  const d=document.createElement('div');d.className='hback';d.innerHTML=`<button id="hubBack">◀ Back</button><span>${tab==='tasks'?'Tasks':tab==='hold'?'The Hold':'Standings'}</span>`;
  b.insertBefore(d,b.firstChild);d.querySelector('#hubBack').addEventListener('click',()=>{SFX.play('tap',60);showHub('battle');});}
/* one look: the living gate */
function skinOf(){return 'b';}
function skinNext(){}
/* ---------- the home ---------- */
function homeStrip(){const R=myRank(),e=evAt(Date.now()),K=EVT_KIND[e.kind],left=e.active?e.t1-Date.now():e.t0-Date.now(),n=typeof tasksReady==='function'?tasksReady():0;
  return `<div class="hmstrip"><button class="hpill" id="hubTro">${rankSVG(R.t,20,R.div)}<b>${trophiesOf()}</b></button>
    <button class="hpill tk ${n?'hot':''}" id="bTasks">${icon('quests',18)}<b>Tasks</b>${n?`<i class="dot">${n}</i>`:''}</button>
    <button class="hpill ev ${e.active?'on':''}" id="evBadge" data-t="${e.active?e.t1:e.t0}" data-a="${e.active?1:0}">${K.e}<b>${K.n}</b><em>${e.active?'ends in':'in'} ${evLeft(left)}</em></button></div>`;}
/* today's map, small: the biome's ground and the road the dead will walk, the gate at the bottom */
function hmMiniDraw(){const cv=document.getElementById('hmMini');if(!cv)return;const gm=genDaily(hash32(dayKeyUTC())),B=(typeof BIOMES!=='undefined'&&BIOMES[gm.biome])||{},x=cv.getContext('2d'),w=cv.width,h=cv.height,sx=w/W,sy=h/GATE_Y;
  x.fillStyle=B.g1||'#2c3c50';x.fillRect(0,0,w,h);x.fillStyle=B.g2||B.dk||'#233245';for(let i=0;i<9;i++)x.fillRect((i*29+7)%w,(i*41+5)%h,8+(i%3)*3,4+(i%2)*2);
  x.lineJoin='round';x.lineCap='round';const road=()=>{x.beginPath();gm.pts.forEach((p,i)=>{const px=p[0]*sx,py=p[1]*sy;if(i)x.lineTo(px,py);else x.moveTo(px,py);});x.lineTo(GX*sx,h);x.stroke();};
  x.strokeStyle=B.edge||'#6c7c92';x.lineWidth=7;road();x.strokeStyle=B.path||'#3b4658';x.lineWidth=4.5;road();
  x.fillStyle='#3a2a1a';x.fillRect(GX*sx-7,h-7,14,7);x.fillStyle='#8a5a33';x.fillRect(GX*sx-4,h-6,8,6);x.fillStyle='#e3b661';x.fillRect(GX*sx-1,h-9,2,3);}
function homeHold(){rollDay();const open=onlineOpen(),gm=genDaily(hash32(dayKeyUTC())),runs=ACC.online.runs||[],best=runs.length?Math.max(...runs.map(r=>r.waves)):0,att=ACC.online.attempts,lb=cachedLb(),me=(lb&&lb.myday)||null,t=fmtT(msToMidnightUTC());
  const bio=gm.biome.charAt(0).toUpperCase()+gm.biome.slice(1);
  return `<div class="hmhold ${open?'':'lock'}" id="hmHold"><div class="hmrow"><canvas class="hmmini" id="hmMini" width="84" height="60"></canvas>
    <div class="hmtx"><b>${open?'HOLD THE DOOR':'THE HOLD'}</b>
      <small>${open?`${gm.mod.e} ${esc(gm.mod.n)} · ${bio}`:`🔒 opens after stage ${ONLINE_AT}`}</small>
      <em>${open?(runs.length?`today ${best} 🌊${me&&me.rank?' · #'+me.rank+' in the world':''}`:'not played yet today'):`hold ${ONLINE_AT} gates in the campaign first`}</em>
      <span class="hmcd">new map in <i id="hmCd">${t.h}:${t.m}:${t.s}</i>${open?` · <b>${att}</b> ${att===1?'run':'runs'} left`:''}</span></div>
    <button class="hmgo ${open&&att>0?'go':''}" id="bHold" ${open&&att>0?'':'disabled'}>${open?(att>0?'HOLD':'DONE'):'🔒'}<small>${open?(att>0?'THE DOOR':'FOR TODAY'):'LOCKED'}</small></button></div>
    <button class="hmlink" id="bHoldMore">🏆 Today's defenders · how the Hold works ›</button></div>`;}
function hmHoldTick(){clearTimeout(HOME.holdT);if(CLOUD.screen!=='hub:battle')return;const c=document.getElementById('hmCd');if(!c)return;
  const ms=msToMidnightUTC(),t=fmtT(ms);c.textContent=t.h+':'+t.m+':'+t.s;if(ms<1000){showHub('battle');return;}HOME.holdT=setTimeout(hmHoldTick,1000);}
function hubHome(){const hh=HOUSES[ACC.house];
  return `${homeStrip()}<div class="hmslots top">${homeSlots().replace(/^<div class="hmslots">/,'').replace(/<\/div>$/,'')}</div>
    <div class="hmstage st-b" id="hmStage">${hmStageB()}<div class="hmtitle"><b>${hh.seat}</b></div>${homeGoal()}</div>
    ${homeHold()}${homeBattleRow()}
    ${ACC.tut?'':'<div class="hint">▲ TAP BEGIN — YOUR CHAMPION WILL TEACH YOU</div>'}${ACC.refund?`<div class="hint" id="refundNote">🪙 Tower upgrades are now tower levels — ${ACC.refund} gold refunded. Army → Towers.</div>`:''}`;}
function homeBind(){
  const on=(id,f)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',f);};
  on('hmGoal',()=>{SFX.play('tap',60);if(!ACC.tut)startTutorial();else showCampaign();});
  on('bTasks',()=>{SFX.play('tap',60);showHub('tasks');});
  on('bHoldMore',()=>{SFX.play('tap',60);showHub('hold');});
  on('hmHold',e=>{if(e.target.closest('#bHold,#bHoldMore'))return;SFX.play('tap',60);if(!onlineOpen()){ecoToast(`🔒 The Hold opens after stage ${ONLINE_AT}`);return;}showHub('hold');});
  on('bHold',()=>{SFX.play('tap',60);if(!onlineOpen()){ecoToast(`🔒 The Hold opens after stage ${ONLINE_AT}`);return;}if(ACC.online.attempts<=0){showHub('hold');return;}
    const go=()=>{if(!onlineOpen()||ACC.online.attempts<=0)return;startGame({mode:'online'});};if(!ACC.holdTut)holdTutorial(go);else go();});
  on('lvlNext',()=>{SFX.play('tap',40);const L=accLevel();ecoToast(`⭐ Level ${L.l+1}: ${fmtN(L.need-L.xp)} XP more — then this chest is yours`);});
  on('freeChest',()=>{if(!freeChestReady()){SFX.play('deny');ecoToast('🕑 The free chest comes back in '+fmtT(ACC.freeChestAt+86400000-Date.now()).str);return;}
    SFX.play('tap',60);if(ecoWants()){ecoChest('wood','shop',()=>showHub('battle'));return;}ACC.freeChestAt=Date.now();persist();openChest('wood',()=>showHub('battle'));});
  on('dailyGift',()=>{SFX.play('tap',60);if(!dailyOn()){showDaily();return;}const d=DAILY.st&&DAILY.seat===seatNo()?DAILY.st.login:null;if(d&&d.can)dailyClaimLogin();else showDaily('cal');});
  if(dailyOn()&&!(DAILY.st&&DAILY.seat===seatNo()))dailyLoad().then(()=>{if(CLOUD.screen==='hub:battle'){const s=document.querySelector('.hmslots');if(s){s.outerHTML=homeSlots().replace(/^<div class="hmslots">/,'<div class="hmslots top">');homeSlotsRebind();}}});
  const gate=document.getElementById('hmGate');if(gate)gate.addEventListener('click',homeStrike);
  hmMiniDraw();HOME.skin='b';homeStart();clearTimeout(HOME.tick);homeTickLoop();hmHoldTick();}
/* ---------- the buttons that moved: ARMY (Forge, Tavern, City), SHOP (Season), Tasks (Daily) ---------- */
function armyRow(){return `<div class="homerow army"><button class="hbtn" id="bForge"><span class="ic">${icon('forge',26)}</span><b>Forge</b></button><button class="hbtn" id="bTavern"><span class="ic">${icon('tavern',26)}</span><b>Tavern</b></button><button class="hbtn" id="bCity"><span class="ic">${icon('city',26)}</span><b>City</b></button></div>`;}
function shopSeasonHTML(){return `<button class="evcard live wide" id="bSeason"><span class="ic">${icon('season',30)}</span><span class="tx"><b>Season Pass</b><small>a ladder of rewards for every day you hold · VIP</small></span><span class="st">OPEN</span></button>`;}
function tkDailyHTML(){const n=dailyOn()?dailyReady():0;
  return `<button class="evcard wide" id="bDaily"><span class="ic">${icon('daily',30)}</span><span class="tx"><b>Daily</b><small>the login calendar and today's gift</small></span><span class="st">${n?n:'›'}</span></button>`;}
function homeMovedBind(){const on=(id,f)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',f);};
  on('bForge',()=>{SFX.play('tap',60);showForge();});on('bTavern',()=>{SFX.play('tap',60);showHeroRoom();});on('bCity',()=>{SFX.play('tap',60);showCity();});
  on('bSeason',()=>{SFX.play('tap',60);showSeason();});on('bDaily',()=>{SFX.play('tap',60);showDaily();});
  if(document.getElementById('bDaily')&&dailyOn()&&!(DAILY.st&&DAILY.seat===seatNo()))dailyLoad().then(()=>{const b=document.getElementById('bDaily');if(b){b.outerHTML=tkDailyHTML();on('bDaily',()=>{SFX.play('tap',60);showDaily();});}});}
/* ---------- CLAN: the realm, the clans to come, the friends ---------- */
function hubClan(){const rows=realmStats(),mine=rows.find(r=>r.mine)||null,L=lang(),lb=cachedLb(),w=typeof WAR!=='undefined'&&WAR.data?WAR.data:null,my=w&&w.mine?w.mine:null,onT=typeof tasksOn==='function'&&tasksOn();
  const n=rows.filter(r=>r.players).length;
  const realm=`<div class="clcard" id="clRealm"><div class="clhead">${flag(L.c,34)}<div class="cltx"><b>${esc(L.c)}</b><small>${mine&&mine.players?`${mine.players} defenders · #${mine.rank} of ${n} realms`:'your realm · your banner'}${my&&my.pos?` · war #${my.pos}`:''}</small></div></div>
    <div class="clrow"><button class="btn" id="bClChat">💬 Realm chat</button><button class="btn sec" id="bClWar">⚔️ Realm war</button><button class="btn sec" id="bClRealms">🌍 Standings</button></div></div>`;
  const clans=`<div class="clcard soon"><span class="ic">🛡️</span><div class="cltx"><b>Clans</b><small>Coming: found a clan, talk in its chat, fight a clan war every week. Until then your realm is your banner.</small></div></div>`;
  const fr=`<div class="hh" style="margin-top:12px"><h2>Friends</h2><small>${onT?'a gift for you both':'sign in through Telegram'}</small></div><div class="tkbody">${onT?tkFriends():'<p class="m">Invitations are kept by the server — they need a seat signed in through Telegram.</p>'}</div>`;
  return `<div class="hh"><h2>Clan</h2><small>${sbReady()?(lb?'live':'connecting…'):'offline'}</small></div>${realm}${clans}${fr}`;}
function hubClanBind(){const on=(id,f)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',f);};
  on('bClChat',()=>{SFX.play('tap',60);showChat(()=>showHub('clan'));});
  on('bClWar',()=>{SFX.play('tap',60);showRealmWar(()=>showHub('clan'));});
  on('bClRealms',()=>{SFX.play('tap',60);showHub('events','realms');});
  if(sbReady()&&(!CLOUD.lb||Date.now()-CLOUD.lbAt>60000))fetchLeaderboard(true).then(r=>{if(r&&CLOUD.screen==='hub:clan')showHub('clan');});
  if(typeof tasksOn==='function'&&tasksOn()){const a=TASKS.st,c=DAILY.fr;
    tasksLoad().then(r=>{if(r&&r!==a&&CLOUD.screen==='hub:clan')showHub('clan');});
    frLoad().then(r=>{if(r&&r!==c&&CLOUD.screen==='hub:clan')showHub('clan');});
    card.querySelectorAll('.tkbody button[data-o]').forEach(b=>b.addEventListener('click',()=>tkOpen(b.dataset.o,b)));
    card.querySelectorAll('.tkbody button[data-c]').forEach(b=>b.addEventListener('click',()=>{const s=tkState(),i=s&&s.items.find(x=>x.id===b.dataset.c);tkCall('task_claim',{task:b.dataset.c},r=>{tkPaid(b,r,(i?i.e+' '+i.n:'Task done'));if(CLOUD.screen==='hub:clan')showHub('clan');});}));
    invBind();}}
