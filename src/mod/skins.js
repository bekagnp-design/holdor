/* =========================== HOME: THREE LOOKS (v1.0.78) ===========================
   The home screen is built so there is always something to take or to wait for — the lesson of Clash Royale, Brawl Stars and Kingdom Rush:
     a live strip (rank · the event with its countdown · today's Hold runs), a big living stage, the next goal, four chest slots
     (star chest · level chest · the free chest with its timer · today's gift), the five quick buttons and one big BATTLE.
   Three looks, switched with the 🎨 button on the stage (kept on this device; ?skin=a|b|c also sets it):
     A "Hero stage"  — the champion stands in a spotlight with turning rays and the house sigil (Brawl Stars / Arknights). Tap: he strikes.
     B "Living gate" — a night scene drawn every frame: moon, fog, the dead walking out of the dark toward a gate with torches (Galaxy Defense).
     C "War map"     — the map of the realm drifts under the clouds, flags on held stages, the next one pulsing (Kingdom Rush).
   The ids the tutorial and the tests know (#bBattle, #starChest, #lvlChest, #bCity, #bTavern, #bForge, #bDaily, #bSeason, #hubTro,
   #bChampH, #bMapH/#bDiffH, #evBadge) stay. Display only. */
const SKINS={a:{n:'Hero stage',e:'🦸'},b:{n:'Living gate',e:'🚪'},c:{n:'War map',e:'🗺️'}};
const HOME={raf:0,t0:0,skin:null,mobs:null,parts:null,hit:0,atk:0,tick:0};
function skinOf(){try{const u=new URLSearchParams(location.search).get('skin');if(u&&SKINS[u]&&!HOME.urlDone){HOME.urlDone=1;localStorage.setItem('holdor_skin',u);}
  const k=localStorage.getItem('holdor_skin');return SKINS[k]?k:'b';}catch(e){return 'b';}}
function skinSet(k){try{localStorage.setItem('holdor_skin',k);}catch(e){}HOME.mobs=null;HOME.parts=null;if(CLOUD.screen==='hub:battle')showHub('battle');}
function skinNext(){const o=['a','b','c'],k=o[(o.indexOf(skinOf())+1)%3];skinSet(k);ecoToast(`${SKINS[k].e} ${SKINS[k].n} · ${o.indexOf(k)+1} / 3`,true);}
/* ---------- the pieces ---------- */
function homeStrip(){const R=myRank(),e=evAt(Date.now()),K=EVT_KIND[e.kind],left=e.active?e.t1-Date.now():e.t0-Date.now();
  const hold=onlineOpen()?`<button class="hpill ${ACC.online.attempts>0?'hot':''}" id="hmHold">🚪<b>${ACC.online.attempts}</b><small>Hold runs</small></button>`
    :`<button class="hpill off" id="hmHold">🔒<small>Hold at stage ${ONLINE_AT}</small></button>`;
  return `<div class="hmstrip"><button class="hpill" id="hubTro">${rankSVG(R.t,20,R.div)}<b>${trophiesOf()}</b></button>
    <button class="hpill ev ${e.active?'on':''}" id="evBadge" data-t="${e.active?e.t1:e.t0}" data-a="${e.active?1:0}">${K.e}<b>${K.n}</b><em>${e.active?'ends in':'in'} ${evLeft(left)}</em></button>${hold}</div>`;}
function homeGoal(){const L=nextStage(),NG=LEVELS.length,g=Object.keys(campOf()).length,st=campOf()[L.id]||0;
  return `<button class="hmgoal" id="hmGoal"><span class="gl"><small>${campOf()[L.id]?'DEFEND AGAIN':'NEXT'}</small><b>${L.id} · ${esc(L.n)}</b></span><span class="gs">${'★'.repeat(st)}<i>${'★'.repeat(3-st)}</i></span><span class="gp"><i style="width:${Math.round(100*g/NG)}%"></i><em>${g}/${NG}</em></span></button>`;}
function homeSlots(){const sN=starChestsReady(),prog=starsEarned()%3,lN=lvlChestsReady(),L=accLevel();
  const fr=freeChestReady(),fl=fr?0:(ACC.freeChestAt+86400000-Date.now());
  const d=dailyOn()?(DAILY.st&&DAILY.seat===seatNo()?DAILY.st.login:null):null,dReady=!!(d&&d.can);
  const ring=p=>`style="--p:${Math.round(p*100)}"`;
  return `<div class="hmslots">
    <button class="slot ${sN>0?'ready':''}" id="starChest" ${ring(sN>0?1:prog/3)}><span class="si">${chestSVG('iron')}</span><em>${sN>0?'OPEN':prog+'/3 ★'}</em>${sN>1?`<b class="cnt">×${sN}</b>`:''}</button>
    ${lN>0?`<button class="slot ready" id="lvlChest" ${ring(1)}><span class="si">${chestSVG(lvlChestTier((ACC.lvlChests||0)+2))}</span><em>OPEN</em>${lN>1?`<b class="cnt">×${lN}</b>`:''}</button>`
      :`<button class="slot" id="lvlNext" ${ring(L.xp/L.need)}><span class="si dim">${chestSVG(lvlChestTier(L.l+1))}</span><em>LV ${L.l+1}</em></button>`}
    <button class="slot ${fr?'ready':''}" id="freeChest" ${ring(fr?1:1-fl/86400000)}><span class="si">${chestSVG('wood')}</span><em data-until="${fr?0:ACC.freeChestAt+86400000}">${fr?'FREE':fmtT(fl).str}</em></button>
    <button class="slot ${dReady?'ready':''}" id="dailyGift" ${ring(dReady?1:1-msToMidnightUTC()/86400000)}><span class="si gift">🎁</span><em data-midnight="${dReady?0:1}">${!dailyOn()?'DAILY':dReady?'CLAIM':fmtT(msToMidnightUTC()).str}</em></button></div>`;}
function homeQuick(){return `<div class="homerow"><button class="hbtn" id="bCity"><span class="ic">🏰</span><b>City</b></button><button class="hbtn" id="bTavern"><span class="ic">🍺</span><b>Tavern</b></button><button class="hbtn" id="bForge"><span class="ic">⚒️</span><b>Forge</b></button>${dailyBtnHTML()}${seasonBtnHTML()}</div>`;}
function homeBattleRow(){const c=CBY[ACC.sel],L=nextStage(),pu=CHAMP_ART[c.id+'_portrait'];
  return `<div class="battlerow">${hardOpen()?`<button class="bside" id="bDiffH"><span class="pe">${DIFFS[ACC.diff].e}</span>${DIFFS[ACC.diff].lbl}</button>`:`<button class="bside" id="bMapH"><span class="pe">🗺️</span>Map</button>`}
    <button class="bbig ${ACC.tut?'':'pulse'}" id="bBattle">${ACC.tut?'BATTLE!':'BEGIN'}<small>${ACC.tut?(campOf()[L.id]?'DEFEND AGAIN':'STAGE '+L.id):'YOUR FIRST LESSON'}</small></button>
    <button class="bside" id="bChampH">${pu?`<img src="${pu}" alt="">`:`<span class="pe">${c.e}</span>`}${shortName(c)}</button></div>`;}
/* ---------- the three stages ---------- */
function hmStageA(){const c=CBY[ACC.sel],p=cprog(ACC,c.id),hh=HOUSES[ACC.house];
  return `<div class="stA"><div class="rays"></div><img class="sig" src="${SIGILS[ACC.house]||''}" alt=""><div class="plat"></div>
    <img class="hero" id="hmHero" src="${CHAMP_ART[c.id]||''}" alt=""><canvas class="hmfx" id="hmFx"></canvas>
    <div class="cn"><b>${esc(c.n)}</b><small>Level ${p.lvl} · House ${hh.n}</small></div></div>`;}
function hmStageB(){return `<div class="stB"><canvas id="hmGate"></canvas></div>`;}
function hmStageC(){const L=nextStage(),cam=campOf();
  const pins=LEVELS.map(l=>{const q=MAPPOS[l.id];if(!q)return '';const done=!!cam[l.id],nx=l.id===L.id;if(!done&&!nx)return '';
    return `<span class="pin ${nx?'nx':''}" style="left:${q[0]}px;top:${q[1]}px">${nx?`<i>⚔</i><b>${l.id}</b>`:'<i class="fl"></i>'}</span>`;}).join('');
  return `<div class="stC"><div class="mapin" id="hmMap" data-x="${(MAPPOS[L.id]||[360,600])[0]}" data-y="${(MAPPOS[L.id]||[360,600])[1]}" style="width:${MAPW}px;height:${MAPH}px;background-image:url(${MAP_ART})">${pins}</div>
    <div class="cl c1"></div><div class="cl c2"></div><div class="cl c3"></div><div class="vig"></div></div>`;}
function hubHome(){const hh=HOUSES[ACC.house],k=skinOf();
  const st=k==='a'?hmStageA():k==='c'?hmStageC():hmStageB();
  return `${homeStrip()}<div class="hmstage st-${k}" id="hmStage">${st}<div class="hmtitle"><b>${hh.seat}</b></div><button class="hmskin" id="bSkin" title="Change the look">🎨</button>${homeGoal()}</div>
    ${homeSlots()}${homeQuick()}${homeBattleRow()}
    ${ACC.tut?'':'<div class="hint">▲ TAP BEGIN — YOUR CHAMPION WILL TEACH YOU</div>'}${ACC.refund?`<div class="hint" id="refundNote">🪙 Tower upgrades are now tower levels — ${ACC.refund} gold refunded. Collection → Towers.</div>`:''}`;}
/* ---------- binding, timers ---------- */
function homeBind(){
  const on=(id,f)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',f);};
  on('bSkin',()=>{SFX.play('swipe',40);skinNext();});
  on('hmGoal',()=>{SFX.play('tap',60);if(!ACC.tut)startTutorial();else showCampaign();});
  on('hmHold',()=>{SFX.play('tap',60);if(onlineOpen())showHub('hold');else ecoToast(`🔒 The Hold opens after stage ${ONLINE_AT}`);});
  on('lvlNext',()=>{SFX.play('tap',40);const L=accLevel();ecoToast(`⭐ Level ${L.l+1}: ${fmtN(L.need-L.xp)} XP more — then this chest is yours`);});
  on('freeChest',e=>{if(!freeChestReady()){SFX.play('deny');ecoToast('🕑 The free chest comes back in '+fmtT(ACC.freeChestAt+86400000-Date.now()).str);return;}
    SFX.play('tap',60);if(ecoWants()){ecoChest('wood','shop',()=>showHub('battle'));return;}ACC.freeChestAt=Date.now();persist();openChest('wood',()=>showHub('battle'));});
  on('dailyGift',()=>{SFX.play('tap',60);if(!dailyOn()){showDaily();return;}const d=DAILY.st&&DAILY.seat===seatNo()?DAILY.st.login:null;if(d&&d.can)dailyClaimLogin();else showDaily('cal');});
  if(dailyOn()&&!(DAILY.st&&DAILY.seat===seatNo()))dailyLoad().then(()=>{if(CLOUD.screen==='hub:battle'){const s=document.querySelector('.hmslots');if(s){s.outerHTML=homeSlots();homeSlotsRebind();}}});
  const hero=document.getElementById('hmHero');if(hero)hero.addEventListener('click',homeStrike);
  const gate=document.getElementById('hmGate');if(gate)gate.addEventListener('click',homeStrike);
  const map=document.getElementById('hmMap');if(map)map.addEventListener('click',()=>{SFX.play('tap',60);showCampaign();});
  HOME.skin=skinOf();homeStart();clearTimeout(HOME.tick);homeTickLoop();}
/* the slots are redrawn alone when the calendar answers; their two old handlers are bound again */
function homeSlotsRebind(){
  const sc=$('#starChest');if(sc)sc.addEventListener('click',()=>{if(starChestsReady()>0){if(ecoWants()){ecoChest('iron','star',()=>showHub('battle'));return;}ACC.starChests=(ACC.starChests||0)+1;persist();openChest('iron',()=>showHub('battle'));}});
  const lc=$('#lvlChest');if(lc)lc.addEventListener('click',()=>{if(lvlChestsReady()>0){const t=lvlChestTier((ACC.lvlChests||0)+2);if(ecoWants()){ecoChest(t,'level',()=>showHub('battle'));return;}ACC.lvlChests=(ACC.lvlChests||0)+1;persist();openChest(t,()=>showHub('battle'));}});
  const on=(id,f)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',f);};
  on('lvlNext',()=>{SFX.play('tap',40);const L=accLevel();ecoToast(`⭐ Level ${L.l+1}: ${fmtN(L.need-L.xp)} XP more — then this chest is yours`);});
  on('freeChest',()=>{if(!freeChestReady()){SFX.play('deny');ecoToast('🕑 The free chest comes back in '+fmtT(ACC.freeChestAt+86400000-Date.now()).str);return;}
    SFX.play('tap',60);if(ecoWants()){ecoChest('wood','shop',()=>showHub('battle'));return;}ACC.freeChestAt=Date.now();persist();openChest('wood',()=>showHub('battle'));});
  on('dailyGift',()=>{SFX.play('tap',60);if(!dailyOn()){showDaily();return;}const d=DAILY.st&&DAILY.seat===seatNo()?DAILY.st.login:null;if(d&&d.can)dailyClaimLogin();else showDaily('cal');});}
function homeTickLoop(){if(CLOUD.screen!=='hub:battle'||!document.getElementById('hmStage'))return;
  document.querySelectorAll('.hmslots em[data-until]').forEach(e=>{const u=+e.dataset.until;if(!u)return;const l=u-Date.now();if(l<=0){showHub('battle');return;}e.textContent=fmtT(l).str;});
  document.querySelectorAll('.hmslots em[data-midnight="1"]').forEach(e=>{if(dailyOn())e.textContent=fmtT(msToMidnightUTC()).str;});
  const eb=document.getElementById('evBadge');if(eb){const em=eb.querySelector('em');if(em)em.textContent=(eb.dataset.a==='1'?'ends in ':'in ')+evLeft(+eb.dataset.t-Date.now());}
  HOME.tick=setTimeout(homeTickLoop,1000);}
/* tap the champion or the gate: a strike */
function homeStrike(){SFX.play('slash',120);HOME.atk=performance.now();const h=document.getElementById('hmHero');
  if(h){const c=CBY[ACC.sel],a=CHAMP_ART[c.id+'_attack'];if(a){h.src=a;setTimeout(()=>{if(h.isConnected)h.src=CHAMP_ART[c.id];},380);}h.classList.remove('atk');void h.offsetWidth;h.classList.add('atk');}
  if(HOME.mobs)for(const m of HOME.mobs)if(m.p>0.55&&!m.die)m.die=performance.now();}
/* ---------- the animation loop (only while the home screen is on) ---------- */
function homeStart(){cancelAnimationFrame(HOME.raf);HOME.t0=performance.now();const loop=now=>{if(CLOUD.screen!=='hub:battle'||!document.getElementById('hmStage')){HOME.raf=0;return;}
    try{const k=HOME.skin;if(k==='b')hmDrawGate(now);else if(k==='a')hmDrawFx('hmFx',now);else hmDrawMap(now);}catch(e){HOME.err=e.message;}HOME.raf=requestAnimationFrame(loop);};
  HOME.raf=requestAnimationFrame(loop);}
function hmFit(cv){const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}return {x:cv.getContext('2d'),W:r.width,H:r.height,d};}
/* house weather: snow, embers, rain, petals, sand */
function hmFxKind(){const P=ISLE_PAL[ACC.house]||ISLE_PAL.stark;return P.fx||'snow';}
function hmFxStep(x,W,H,t,kind,n){if(!HOME.parts||HOME.parts.k!==kind||HOME.parts.W!==W){HOME.parts={k:kind,W,a:Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,v:0.4+Math.random(),s:0.6+Math.random()*1.6,ph:Math.random()*6.3}))};}
  for(const p of HOME.parts.a){
    if(kind==='ember'){p.y-=p.v*0.7;p.x+=Math.sin(t/700+p.ph)*0.4;if(p.y<-4){p.y=H+4;p.x=Math.random()*W;}x.fillStyle=`rgba(255,${150+Math.round(60*Math.sin(t/200+p.ph))},60,${0.55+0.4*Math.sin(t/300+p.ph)})`;x.beginPath();x.arc(p.x,p.y,p.s*0.9,0,6.28);x.fill();}
    else if(kind==='rain'){p.y+=p.v*7;p.x-=p.v*1.2;if(p.y>H){p.y=-10;p.x=Math.random()*W*1.2;}x.strokeStyle='rgba(170,200,230,.35)';x.lineWidth=1;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(p.x-2,p.y+9);x.stroke();}
    else if(kind==='petal'){p.y+=p.v*0.6;p.x+=Math.sin(t/900+p.ph)*0.8;if(p.y>H+4){p.y=-4;p.x=Math.random()*W;}x.fillStyle='rgba(255,170,200,.75)';x.save();x.translate(p.x,p.y);x.rotate(t/600+p.ph);x.fillRect(-p.s*1.4,-p.s*0.7,p.s*2.8,p.s*1.4);x.restore();}
    else if(kind==='sand'){p.x+=p.v*1.6;p.y+=Math.sin(t/500+p.ph)*0.3;if(p.x>W+4){p.x=-4;p.y=Math.random()*H;}x.fillStyle='rgba(240,200,140,.45)';x.fillRect(p.x,p.y,p.s,p.s);}
    else{p.y+=p.v*0.8;p.x+=Math.sin(t/1000+p.ph)*0.5;if(p.y>H+4){p.y=-4;p.x=Math.random()*W;}x.fillStyle='rgba(255,255,255,.8)';x.beginPath();x.arc(p.x,p.y,p.s,0,6.28);x.fill();}}}
function hmDrawFx(id,now){const cv=document.getElementById(id);if(!cv)return;const {x,W,H,d}=hmFit(cv);x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,W,H);hmFxStep(x,W,H,now,hmFxKind(),46);}
function hmDrawMap(now){const m=document.getElementById('hmMap');if(!m)return;const st=document.getElementById('hmStage'),W=st.clientWidth,H=st.clientHeight,t=(now-HOME.t0)/1000;
  const s=Math.max(W/MAPW*1.9,0.6),cx=+m.dataset.x,cy=+m.dataset.y,ox=W/2-cx*s+Math.sin(t*0.16)*26,oy=H*0.46-cy*s+Math.cos(t*0.12)*18;
  m.style.transform=`translate(${ox}px,${oy}px) scale(${s*(1+0.03*Math.sin(t*0.1))})`;}
/* B: the living gate */
function hmDrawGate(now){const cv=document.getElementById('hmGate');if(!cv)return;const {x,W,H,d}=hmFit(cv),t=now-HOME.t0,P=ISLE_PAL[ACC.house]||ISLE_PAL.stark,hh=HOUSES[ACC.house];
  x.setTransform(d,0,0,d,0,0);
  let sh=0;if(HOME.hit&&now-HOME.hit<260)sh=(1-(now-HOME.hit)/260)*3;x.translate((Math.random()-0.5)*sh,(Math.random()-0.5)*sh);
  const sky=x.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#060b18');sky.addColorStop(0.55,P.sky||'#22344a');sky.addColorStop(1,'#0a0f18');x.fillStyle=sky;x.fillRect(-4,-4,W+8,H+8);
  // stars and the moon
  for(let i=0;i<38;i++){const sx=(i*97.13)%W,sy=(i*53.7)%(H*0.42);x.fillStyle=`rgba(255,255,255,${0.25+0.35*Math.abs(Math.sin(t/900+i))})`;x.fillRect(sx,sy,1.3,1.3);}
  const mx=W*0.8,my=H*0.17;let g=x.createRadialGradient(mx,my,4,mx,my,70);g.addColorStop(0,'rgba(230,240,255,.55)');g.addColorStop(1,'rgba(230,240,255,0)');x.fillStyle=g;x.fillRect(mx-70,my-70,140,140);
  x.fillStyle='#e8eef8';x.beginPath();x.arc(mx,my,17,0,6.28);x.fill();x.fillStyle='rgba(150,165,190,.35)';x.beginPath();x.arc(mx-5,my-3,4,0,6.28);x.arc(mx+6,my+5,3,0,6.28);x.fill();
  // far mountains, two layers
  const hz=H*0.38,G0=H-50;   // the horizon; the ground line sits above the next-goal ribbon
  for(const [col,amp,yb,sp] of [['#141d2c',38,hz-6,0.004],['#0e1520',26,hz+8,0.008]]){x.fillStyle=col;x.beginPath();x.moveTo(-4,H);for(let px=-4;px<=W+8;px+=8){const v=Math.sin(px*0.021+t*sp*0.01)*0.5+Math.sin(px*0.057+1.3)*0.35+Math.sin(px*0.009)*0.4;x.lineTo(px,yb-amp*(0.6+v*0.6));}x.lineTo(W+8,H);x.fill();}
  // the dead walk out of the dark toward the gate
  if(!HOME.mobs){const T=['walker','sword','axe','hound','crawler','spear','shield','giant','wolf','archer'];HOME.mobs=Array.from({length:7},(_,i)=>({k:T[i%T.length],p:i/7,lane:(Math.random()-0.5),v:0.000045+Math.random()*0.00003}));}
  const gx=W/2,gy=H*0.56;
  HOME.mobs.sort((a,b)=>a.p-b.p);
  for(const m of HOME.mobs){m.p+=m.v*16;const y=hz+(gy-hz)*Math.pow(m.p,1.3),sc=0.25+0.75*m.p,mxp=gx+m.lane*W*0.9*(1-m.p)+m.lane*30*m.p;
    if(m.die){const k=(now-m.die)/350;if(k>=1){m.die=0;m.p=0;m.lane=Math.random()-0.5;m.k=['walker','sword','axe','hound','crawler','spear'][Math.floor(Math.random()*6)];continue;}x.globalAlpha=1-k;}
    if(m.p>=1){m.p=0;m.lane=Math.random()-0.5;HOME.hit=now;try{SFX.play('gate',900);}catch(e){}}
    const im=enemyImg(m.k);const sz=78*sc;if(im){x.save();x.globalAlpha*=0.35+0.6*m.p;x.drawImage(im,mxp-sz/2,y-sz*0.9,sz,sz);x.restore();}
    if(m.k==='walker'||m.k==='giant'){x.fillStyle=`rgba(120,210,255,${0.5+0.5*m.p})`;x.fillRect(mxp-3*sc,y-sz*0.68,2*sc,2*sc);x.fillRect(mxp+2*sc,y-sz*0.68,2*sc,2*sc);}
    x.globalAlpha=1;}
  // fog
  for(let i=0;i<3;i++){const fy=hz+10+i*22,fx=((t*0.012*(i+1))%(W*2))-W*0.5;g=x.createRadialGradient(fx,fy,4,fx,fy,W*0.55);g.addColorStop(0,'rgba(200,215,235,.13)');g.addColorStop(1,'rgba(200,215,235,0)');x.fillStyle=g;x.fillRect(0,fy-60,W,120);}
  // the wall and the gate
  const wy=H*0.55;x.fillStyle=P.rock2||'#2f3742';x.fillRect(-4,wy,W+8,H-wy+4);
  for(let r=0;r<Math.ceil((G0-wy)/12);r++){const by=wy+r*12;for(let c=-1;c<W/26+1;c++){const bx=c*26+(r%2?13:0);x.fillStyle=(r+c)%3?(P.rock||'#5b6674'):(P.rock2||'#2f3742');x.fillRect(bx+1,by+1,24,10);}}
  for(let c=0;c<W/22+1;c++){x.fillStyle=P.rock||'#5b6674';if(c%2)x.fillRect(c*22,wy-10,22,11);}
  const aw=92,ah=Math.min(104,G0-wy+6),ax=gx-aw/2,ay=G0-ah;
  x.fillStyle='rgba(0,0,0,.55)';x.fillRect(-4,G0,W+8,H-G0+4);
  x.fillStyle='#1a1410';x.beginPath();x.moveTo(ax-8,G0);x.lineTo(ax-8,ay+40);x.arc(gx,ay+40,aw/2+8,Math.PI,0);x.lineTo(ax+aw+8,G0);x.fill();
  const lit=HOME.hit&&now-HOME.hit<300?1-(now-HOME.hit)/300:0;
  const dg=x.createLinearGradient(0,ay,0,G0);dg.addColorStop(0,lit?'#a0724a':'#6b4a2a');dg.addColorStop(1,'#3d2814');x.fillStyle=dg;
  x.beginPath();x.moveTo(ax,G0);x.lineTo(ax,ay+40);x.arc(gx,ay+40,aw/2,Math.PI,0);x.lineTo(ax+aw,G0);x.fill();
  x.strokeStyle='rgba(0,0,0,.45)';x.lineWidth=2;for(let i=1;i<5;i++){x.beginPath();x.moveTo(ax+i*aw/5,ay+12);x.lineTo(ax+i*aw/5,G0);x.stroke();}
  x.fillStyle='#2b2f36';x.fillRect(ax,ay+ah*0.45,aw,6);x.fillRect(ax,ay+ah*0.75,aw,6);
  // torches
  for(const tx of [ax-26,ax+aw+26]){const fl=1+0.18*Math.sin(t/70+tx)+0.1*Math.random();g=x.createRadialGradient(tx,wy-6,2,tx,wy-6,60*fl);g.addColorStop(0,'rgba(255,170,70,.45)');g.addColorStop(1,'rgba(255,120,40,0)');x.fillStyle=g;x.fillRect(tx-70,wy-76,140,140);
    x.fillStyle='#3a2a1a';x.fillRect(tx-2,wy-4,4,22);x.fillStyle='#ffb347';x.beginPath();x.ellipse(tx,wy-9,4*fl,8*fl,0,0,6.28);x.fill();x.fillStyle='#fff1a8';x.beginPath();x.ellipse(tx,wy-7,2,4*fl,0,0,6.28);x.fill();}
  // the champion in front of the gate
  const c=CBY[ACC.sel],atk=now-HOME.atk<380,im=homeImg(atk?c.id+'_attack':c.id)||homeImg(c.id);
  if(im&&im.complete&&im.naturalWidth){const hs=Math.min(124,H*0.46),bob=Math.sin(t/520)*2,lx=ax-hs*0.78+(atk?14:0);x.fillStyle='rgba(0,0,0,.4)';x.beginPath();x.ellipse(lx+hs/2,G0+2,hs*0.32,6,0,0,6.28);x.fill();x.drawImage(im,lx,G0-hs+6+bob,hs,hs);}
  if(atk){const k=(now-HOME.atk)/380;x.strokeStyle=`rgba(255,255,255,${1-k})`;x.lineWidth=4;x.beginPath();x.arc(ax-10,G0-60,40+40*k,-2.4,-0.6);x.stroke();}
  hmFxStep(x,W,H,now,hmFxKind(),40);
  // a soft vignette
  g=x.createRadialGradient(W/2,H*0.55,H*0.3,W/2,H*0.55,H*0.95);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.45)');x.fillStyle=g;x.fillRect(-4,-4,W+8,H+8);
  x.setTransform(1,0,0,1,0,0);}
const HOME_IMG={};
function homeImg(k){if(!CHAMP_ART[k])return null;if(!HOME_IMG[k]){const im=new Image();im.src=CHAMP_ART[k];HOME_IMG[k]=im;}return HOME_IMG[k];}
