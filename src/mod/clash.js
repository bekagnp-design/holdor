/* =========================== HOUSES CLASH I (v1.1.1) ===========================
   PvP on the KR Battles principle: the screen splits in two — the rival's lane on top, yours below. Both lanes get the same waves of
   the dead (one seed); each side also has ARMY POINTS (+1 every 10 s) and spends them to send its house's soldiers (v1.1.0 troops)
   down the rival's road, where they fight like wights. Whose door breaks first loses; if both hold ten waves, the fuller door wins.
   Two full simulations run on one phone: the engine's state object `G` is swapped (`gSwap`) for the rival's steps and drawing, so
   nothing in the engine knows there are two. The rival here is a bot (five levels, practice); a recorded rival (a ghost of a real
   player's input log, leagues, a friend's link) is v1.1.2 with backend v32, a live friend v1.1.3. Entered from the Events page
   and the Clan tab (`showClash`). */
const CLASH={on:false,B:null,lane:'A',dy:0,myDy:0,pts:3,bpts:3,ptsT:0,bptsT:0,bot:null,opp:null,win:null,waves:10,t:0,log:[],ui:null,fin:false};
const CLASH_TOP=GATE_Y-300;           /* the window each lane shows: map y from CLASH_TOP, H/2 tall */
const CLASH_COST={foot:2,archer:2,rider:3,house:4},CLASH_N={foot:3,archer:2,rider:2,house:1},CLASH_MAXPTS=10;
ENEMIES.troop={key:'troop',n:'House soldier',e:'⚔️',arch:'man',hp:120,spd:60,dps:12,gold:4,r:10};
function clashOn(){return CLASH.on&&G.mode==='clash';}
function clashRec(){if(!ACC.clash)ACC.clash={w:0,l:0,d:0,streak:0,best:0,bot:1};return ACC.clash;}
/* ---------- the map: a short road that starts inside the window ---------- */
function genClash(seed){const rng=mulberry32(seed);const cols=[55,125,195,265,335];const K=3;const top=CLASH_TOP+34,bottom=GATE_Y-92;
  let x=cols[Math.floor(rng()*cols.length)];const pts=[[x,CLASH_TOP-20]];
  for(let i=0;i<K;i++){const y=Math.round(top+(bottom-top)*i/(K-1)+(rng()*20-10));pts.push([x,y]);let nx;if(i===K-1)nx=195;else{do{nx=cols[Math.floor(rng()*cols.length)];}while(Math.abs(nx-x)<100);}if(nx!==x){pts.push([nx,y]);x=nx;}}
  const biomes=['snow','forest','swamp','mountain','ash','desert','reach','storm'];
  return{pts,biome:biomes[Math.floor(rng()*biomes.length)]};}
/* the engine's state, swapped whole */
function gSnap(){const o={};for(const k in G)o[k]=G[k];return o;}
function gLoad(o){for(const k in G)delete G[k];Object.assign(G,o);}
function gSwap(){const cur=gSnap();gLoad(CLASH.B);CLASH.B=cur;CLASH.lane=CLASH.lane==='A'?'B':'A';}
/* called from startGame0 for mode 'clash' (instead of the Hold's daily map) */
function clashSetup(o){const seed=o.seed;const gm=genClash(seed);const map=buildMap({pts:gm.pts,seed,biome:gm.biome,raw:true,style:'bend'});resetRun(map);
  G.rng=mulberry32(seed+(o.lane==='B'?7:3));G.wrng=mulberry32(seed+11);G.totalWaves=Infinity;G.wo={id:12,pool:levelPool(12,99),minis:['giant'],dragon:999,king:999,lord:false,online:true,clash:true};
  G.mult=DIFF().hp;G.mod=null;G.gold=260;G.doorMax=Math.round((1000+G.gateBonus)*DIFF().gate);G.doorHp=G.doorMax;G.seed=seed;G.lane=o.lane||'A';G.house=o.house||ACC.house;G.nextIn=4;return map;}
/* ---------- start: two simulations, the rival a bot ---------- */
function clashStart(o){o=o||{};const bot=Math.max(1,Math.min(5,o.bot||clashRec().bot||1));const seed=o.seed||hash32('clash'+Date.now()+Math.random());
  const others=HOUSE_ORDER.filter(h=>h!==ACC.house);const oh=o.house||others[Math.floor(Math.random()*others.length)];
  Object.assign(CLASH,{on:false,B:null,lane:'A',dy:0,myDy:H/2-CLASH_TOP,pts:3,bpts:3,ptsT:0,bptsT:0,win:null,t:0,log:[],fin:false,bot:{lvl:bot,nextBuild:60*2,nextSend:60*(26-bot*3),nextUp:60*20},opp:{name:'Bot '+['I','II','III','IV','V'][bot-1],house:oh,bot}});
  G.state='menu';if(RING)closeRing();
  startGame0({mode:'clash',seed,lane:'A',house:ACC.house});const A=gSnap();
  startGame0({mode:'clash',seed,lane:'B',house:oh});   /* its own map object: towers live on the slots */G.heroOn=false;G.hero.dead=true;G.hero.hp=0;const B=gSnap();
  gLoad(A);CLASH.B=B;CLASH.on=true;CLASH.lane='A';
  $('#hSub').textContent='Houses Clash · vs '+HOUSES[oh].n;updateBar();updateHUD();clashUi();clashLayout();
  CLOUD.screen='clash';}
/* ---------- each engine step of mine, one of the rival's (silent) ---------- */
function clashStepB(){if(!CLASH.on||CLASH.fin)return;
  CLASH.ptsT+=DT;if(CLASH.ptsT>=10){CLASH.ptsT=0;CLASH.pts=Math.min(CLASH_MAXPTS,CLASH.pts+1);clashUiSync();}
  CLASH.bptsT+=DT;if(CLASH.bptsT>=10){CLASH.bptsT=0;CLASH.bpts=Math.min(CLASH_MAXPTS,CLASH.bpts+1);}
  gSwap();try{if(G.state==='play'){clashBot();step();}}catch(e){console.error(e);}gSwap();
  if(CLASH.bsend){const r=CLASH.bsend;CLASH.bsend=null;clashSpawnTroops(CLASH.opp.house,r);}
  /* the end: a door broke, or ten waves held on both sides */
  if(G.doorHp<=0&&!CLASH.win)CLASH.win='B';
  if(!CLASH.win&&CLASH.B.doorHp<=0)CLASH.win='A';
  if(!CLASH.win&&G.wave>CLASH.waves&&G.waveDone&&!G.enemies.some(e=>e.hp>0)&&CLASH.B.wave>CLASH.waves){const a=G.doorHp/G.doorMax,b=CLASH.B.doorHp/CLASH.B.doorMax;CLASH.win=a>b+0.01?'A':b>a+0.01?'B':'draw';}
  if(CLASH.win)clashFinish();}
/* the bot: builds by the gate, upgrades when rich, sends soldiers on a clock (faster and bolder with its level) */
function clashBot(){const b=CLASH.bot;if(!b||G.tick%30)return;const lvl=b.lvl;
  if(G.tick>=b.nextBuild){const open=['watch','glass','scorp','keep','wild'].filter(t=>typeof towerOpen==='function'?towerOpen(t):t==='watch');
    const n=G.map.slots.filter(s=>s.tower).length;const t=open[Math.min(open.length-1,n%Math.max(1,Math.min(open.length,1+lvl)))]||'watch';
    const gt=G.map.gates[0];const s=G.map.slots.filter(x=>!x.tower).sort((p,q)=>dist(p.x,p.y,gt.x,GATE_Y-40)-dist(q.x,q.y,gt.x,GATE_Y-40))[0];
    if(s&&G.gold>=costOf(t)){build(s,t);b.nextBuild=G.tick+60*(7-lvl);}}
  if(G.tick>=b.nextUp&&G.gold>=180){const s=G.map.slots.find(x=>x.tower&&x.tower.lvl<Math.min(5,1+lvl));if(s&&upgradeTower(s))b.nextUp=G.tick+60*(16-lvl*2);}
  if(lvl>=3&&canCall()&&G.nextIn>1.5&&G.tick%120===0)callWave();
  if(G.tick>=b.nextSend){const roles=['foot','archer','rider','house'];const role=roles[Math.floor(G.rng()*Math.min(4,1+lvl))];const c=CLASH_COST[role];
    if(CLASH.bpts>=c){CLASH.bpts-=c;CLASH.bsend=role;b.nextSend=G.tick+60*Math.max(8,26-lvl*3);}}}
/* a send: the house's soldiers walk the rival's road as enemies */
function clashSpawnTroops(house,role){const d=troopDef(house,role),n=CLASH_N[role],m=hpMul(Math.max(1,G.wave));
  for(let i=0;i<n;i++){const hp=Math.round(TROOP_BASE.hp*d.hp*2.4*m);
    G.enemies.push({type:'troop',key:'troop',n:HOUSES[house].n+' '+d.n,e:'⚔️',arch:'man',troop:house,role,hp,max:hp,r:10,gold:4,scale:1,spdBase:Math.round(TROOP_BASE.spd*d.spd*0.72),vel:0,prog:-6-i*16,slow:1,mark:1,burn:null,poison:null,stunT:0,atkT:0,id:G.eid++,blockedBy:null,bob:0,route:0,dps:Math.round(TROOP_BASE.dmg*d.dmg*1.3),ranged:d.range?88:0,weak:1,face:1});}
  const q=posAt(G.map,14,0);addText(q.x,q.y-8,HOUSES[house].n+' '+d.n+(n>1?' ×'+n:''),HOUSES[house].col,1);addFx({t:'ring',x:q.x,y:q.y,r0:6,r1:40,life:0.5,col:HOUSES[house].col});}
function clashSend(role){if(!clashOn()||CLASH.fin||G.state!=='play')return false;const c=CLASH_COST[role];if(role==='house'&&armyLvl()<ARMY_HOUSE_AT){SFX.play('deny');ecoToast('🔒 The '+TROOPS[ACC.house].house.n+' marches from army level '+ARMY_HOUSE_AT);return false;}
  if(CLASH.pts<c){SFX.play('deny');return false;}CLASH.pts-=c;CLASH.log.push({t:G.tick,a:'send',role});SFX.play('horn',200);
  gSwap();clashSpawnTroops(ACC.house,role);gSwap();clashUiSync();return true;}
/* ---------- the end ---------- */
function clashFinish(){if(CLASH.fin)return;CLASH.fin=true;const w=CLASH.win,R=clashRec();G.state='over';G.armed=null;G.sel=null;closeSheet();
  if(w==='A'){R.w++;R.streak++;R.best=Math.max(R.best,R.streak);if(R.streak>=2&&R.bot<5){R.bot++;R.streak=0;}SFX.play('win');}else if(w==='B'){R.l++;R.streak=0;SFX.play('lose');}else{R.d++;}
  persist();   /* gold for clashes comes with the server record (v1.1.2, backend v32): the server pays, nothing is invented here */
  const a=Math.round(100*G.doorHp/G.doorMax),b=Math.round(100*CLASH.B.doorHp/CLASH.B.doorMax),oh=HOUSES[CLASH.opp.house];
  setTimeout(()=>{show(`<h1>${w==='A'?'🏆 Clash won':w==='B'?'💀 Clash lost':'🤝 A draw'}<small>vs ${CLASH.opp.name} of House ${oh.n} · wave ${Math.max(1,G.wave)}</small></h1>
    <div class="clres"><div class="side me" style="--hc:${HOUSES[ACC.house].col}"><b>You</b><span class="bar"><i style="width:${a}%"></i></span><em>🧱 ${a}%</em></div><div class="side" style="--hc:${oh.col}"><b>${oh.n}</b><span class="bar"><i style="width:${b}%"></i></span><em>🧱 ${b}%</em></div></div>
    <p class="m">${w==='A'&&R.streak===0&&R.bot>CLASH.opp.bot?'The bot grows: level '+R.bot+'. ':''}Practice pays nothing yet — gold, leagues and friends come with the server record.</p>
    <p class="m">Record: ${R.w}W · ${R.l}L · ${R.d}D</p>
    <button class="btn" id="bClAgain">⚔️ Again</button><button class="btn sec" id="bClHome">To the castle</button>`);
    $('#bClAgain').addEventListener('click',()=>{overlay.classList.add('hidden');clashStart({bot:clashRec().bot});});
    $('#bClHome').addEventListener('click',()=>{clashStop();showHub('battle');});CLASH.back=()=>showHub('events');},w==='A'?600:900);}
function clashStop(){CLASH.on=false;CLASH.B=null;CLASH.fin=true;if(CLASH.ui){CLASH.ui.remove();CLASH.ui=null;}}
/* ---------- drawing: the rival's lane on top, mine below ---------- */
function clashDraw(now){const z=CAM.z,x=CAM.x,y=CAM.y;CAM.z=1;CAM.x=W/2;CAM.y=H/2;
  ctx.setTransform(scale*dpr,0,0,scale*dpr,0,0);
  gSwap();CLASH.dy=-CLASH_TOP;ctx.save();ctx.beginPath();ctx.rect(0,0,W,H/2);ctx.clip();try{draw(now);}catch(e){}ctx.restore();gSwap();
  CLASH.dy=H/2-CLASH_TOP;ctx.save();ctx.beginPath();ctx.rect(0,H/2,W,H/2);ctx.clip();draw(now);ctx.restore();CLASH.dy=0;
  ctx.setTransform(scale*dpr,0,0,scale*dpr,0,0);ctx.fillStyle='#0b1220';ctx.fillRect(0,H/2-2,W,4);ctx.fillStyle='rgba(227,182,97,0.55)';ctx.fillRect(0,H/2-0.5,W,1);
  CAM.z=z;CAM.x=x;CAM.y=y;}
/* ---------- the strip between the lanes: the rival's door, my points and the four sends ---------- */
function clashUi(){if(CLASH.ui)CLASH.ui.remove();const el=document.createElement('div');el.id='clashUi';const hh=HOUSES[ACC.house],oh=HOUSES[CLASH.opp.house];
  el.innerHTML=`<div class="ctop"><span class="who" style="--hc:${oh.col}">${oh.e} <b>${CLASH.opp.name}</b> · ${oh.n}</span><span class="door"><i id="clDoorB"></i></span><span class="wv" id="clWaveB">wave 1</span></div>
    <div class="csend"><span class="pts" id="clPts"><b>${CLASH.pts}</b>/${CLASH_MAXPTS} ⚔</span>${TROOP_ROLES.map(r=>{const d=troopDef(ACC.house,r);return `<button class="cs" data-r="${r}" style="--hc:${hh.col}" title="${d.n}"><canvas width="56" height="56"></canvas><em>${CLASH_COST[r]}</em>${r==='house'&&armyLvl()<ARMY_HOUSE_AT?'<i>🔒</i>':''}</button>`;}).join('')}</div>`;
  $('#stage').appendChild(el);CLASH.ui=el;
  el.querySelectorAll('button.cs').forEach(b=>{try{troopPreview(b.querySelector('canvas'),ACC.house,b.dataset.r);}catch(e){}b.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();if(clashSend(b.dataset.r)){b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');}});});
  clashUiSync();}
function clashUiSync(){const el=CLASH.ui;if(!el)return;const p=el.querySelector('#clPts b');if(p)p.textContent=CLASH.pts;
  el.querySelectorAll('button.cs').forEach(b=>b.classList.toggle('poor',CLASH.pts<CLASH_COST[b.dataset.r]));
  const B=CLASH.lane==='A'?CLASH.B:G;if(B){const d=el.querySelector('#clDoorB');if(d)d.style.width=Math.round(100*Math.max(0,B.doorHp)/B.doorMax)+'%';const w=el.querySelector('#clWaveB');if(w)w.textContent='wave '+Math.max(1,B.wave)+' · 🧱 '+Math.round(100*Math.max(0,B.doorHp)/B.doorMax)+'%';}}
function clashLayout(){const el=CLASH.ui;if(!el)return;el.style.left=canvas.offsetLeft+'px';el.style.top=canvas.offsetTop+'px';el.style.width=(W*scale)+'px';el.style.height=(H*scale)+'px';el.style.setProperty('--mid',(H/2*scale)+'px');}
/* ---------- the screen: record, the bot's level, start ---------- */
function clashCardHTML(){const R=ACC&&ACC.tut?clashRec():null;return `<button class="evcard live wide" id="bClashCard"><span class="ic">${HUB_ICON.clan||'⚔️'}</span><span class="tx"><b>Houses Clash</b><small>${R?`your lane below, the rival's above — send your house's soldiers at him · ${R.w}W ${R.l}L · bot level ${R.bot}`:'win your first battle first'}</small></span><span class="st">NEW</span></button>`;}
function showClash(back){const R=clashRec(),hh=HOUSES[ACC.house],lv=['Bronze','Silver','Gold','Crystal','Dragon'];if(typeof back==='function')CLASH.back=back;else if(!CLASH.back)CLASH.back=()=>showHub('events');
  show(`<div class="topbar"><h1>⚔️ Houses Clash<small>Two lanes, the same dead. Send the soldiers of House ${hh.n} down the rival's road; whose door breaks first loses.</small></h1><button class="back" id="bBack">✖</button></div>
    <div class="lg"><span class="le">🤖</span><b>Practice</b><span class="rt">${R.w}</span><small>wins · ${R.l} lost · ${R.d} drawn · best streak ${R.best}</small></div>
    <div class="clbots">${lv.map((n,i)=>`<button class="clb ${i+1===R.bot?'on':''} ${i+1>R.bot?'lock':''}" data-b="${i+1}">${['🥉','🥈','🥇','💎','🐉'][i]}<b>${n}</b><small>bot ${i+1}</small></button>`).join('')}</div>
    <p class="m">Two wins in a row at a level open the next. <b>Army points</b> come one every 10 s; a send costs 2–4. The ${TROOPS[ACC.house].house.n} needs army level ${ARMY_HOUSE_AT} (Army → City → Barracks).</p>
    <button class="btn" id="bClashGo">⚔️ Fight bot ${R.bot}</button>
    <p class="m" style="font-size:11.5px">Ranked leagues, friend links and a live friend come next (v1.1.2–3). Nothing here touches your rating.</p>`);
  CLOUD.screen='clash-menu';$('#bBack').addEventListener('click',()=>CLASH.back());
  card.querySelectorAll('.clb').forEach(b=>b.addEventListener('click',()=>{const n=+b.dataset.b;if(n>R.bot){SFX.play('deny');return;}card.querySelectorAll('.clb').forEach(x=>x.classList.toggle('on',x===b));$('#bClashGo').textContent='⚔️ Fight bot '+n;$('#bClashGo').dataset.b=n;SFX.play('tap',60);}));
  $('#bClashGo').addEventListener('click',()=>{if(!ACC.tut){ecoToast('Finish the tutorial battle first');return;}overlay.classList.add('hidden');clashStart({bot:+($('#bClashGo').dataset.b||R.bot)});});}
