/* v1.2.0: Mastery. After a tower's last card level (16), a player picks one of two paths and buys three steps with gold.
   State: ACC.mst[tower] = 0 (none), 1..3 (path A, step), 11..13 (path B, step). Managed seats buy through the server (mastery_buy / mastery_reset). */
const MST={need:30,gold:[20000,40000,80000],swap:10000,towers:['watch','scorp','wild','glass','weir','keep','rook']};
const MST_PATHS={
  watch:{
    a:{n:'Volley',e:'🏹',d:'Arrows split onto more enemies',steps:[
      {n:'Second arrow',t:'Each shot sends a second arrow at another enemy for 60% damage.'},
      {n:'Triple volley',t:'Two extra arrows, each for 70% damage.'},
      {n:'Rain of shafts',t:'Three extra arrows for 80% damage and 10% faster fire.'}]},
    b:{n:'Marksman',e:'🎯',d:'One target, heavy hits',steps:[
      {n:'Keen eye',t:'15% of shots are critical: double damage.'},
      {n:'Bane of the sky',t:'Plus 25% damage against flyers and armoured enemies.'},
      {n:'Dead shot',t:'30% critical chance, critical damage ×2.5.'}]}},
  scorp:{
    a:{n:'Piercing bolt',e:'➳',d:'The bolt runs through a line',steps:[
      {n:'Through one',t:'The bolt also hits the enemy behind for 70% damage.'},
      {n:'Through two',t:'It pierces two enemies behind the first.'},
      {n:'Through three',t:'It pierces three enemies and fires 10% faster.'}]},
    b:{n:'Dragonbane',e:'🐉',d:'Built to bring down the big ones',steps:[
      {n:'Giant slayer',t:'×1.25 damage against dragons, walkers and armoured enemies.'},
      {n:'Chilling bolt',t:'Every hit chills: 30% slower for 2 seconds.'},
      {n:'Dragonbane',t:'×1.6 against the big ones and a 40% chill.'}]}}};
MST_PATHS.wild={
  a:{n:'Inferno',e:'🔥',d:'Bigger blasts that burn longer',steps:[
    {n:'Hotter mix',t:'Splash +15%, burning ×1.3 for 3 s.'},
    {n:'Greek fire',t:'Splash +30%, burning ×1.6 for 4 s.'},
    {n:'Dragonfire pot',t:'Splash +45%, burning ×2 for 5 s.'}]},
  b:{n:'Seep',e:'🧪',d:'Every blast leaves a burning pool',steps:[
    {n:'Spill',t:'A pool of green fire stays 3 s where the shell lands.'},
    {n:'Deep pool',t:'The pool burns 50% harder and stays 4 s.'},
    {n:'Marsh fire',t:'The pool burns twice as hard and stays 5 s.'}]}};
MST_PATHS.glass={
  a:{n:'Frostbite',e:'❄️',d:'Slow and freeze everything inside',steps:[
    {n:'Cold spears',t:'Slows 8% harder.'},
    {n:'Deep freeze',t:'Every 5 s everything inside is frozen for 1 s.'},
    {n:'Winter edge',t:'Slows 12% harder in total, +20% damage.'}]},
  b:{n:'Walkerbane',e:'🗡️',d:'Built to kill White Walkers',steps:[
    {n:'Obsidian tips',t:'White Walkers take ×4 instead of ×3.'},
    {n:'Shatter',t:'A White Walker below 25% health is shattered at once.'},
    {n:'Walkerbane',t:'×5 against White Walkers and +25% damage.'}]}};
MST_PATHS.weir={
  a:{n:'Roots',e:'🌳',d:'The old trees hold enemies in place',steps:[
    {n:'Deeper roots',t:'Slows 6% harder.'},
    {n:'Grasping roots',t:'Every 6 s the roots hold everything in reach for 1.2 s.'},
    {n:'Heart tree',t:'Slows 10% harder, roots hold for 1.6 s every 4.5 s.'}]},
  b:{n:'Whisper',e:'👁️',d:'The old gods mark what they see',steps:[
    {n:'Old gods',t:'Enemies inside take 10% more damage.'},
    {n:'Greenseer',t:'20% more damage, and nothing hides inside the reach.'},
    {n:'Third eye',t:'30% more damage, +15% reach, healers and summoners are silenced inside.'}]}};
MST_PATHS.keep={
  a:{n:'Shield wall',e:'🛡️',d:'More men, harder to kill',steps:[
    {n:'Levy',t:'+1 soldier, +20% health.'},
    {n:'Pikemen',t:'+1 more soldier, +40% health.'},
    {n:'Shield wall',t:'+2 more soldiers, +70% health.'}]},
  b:{n:"Knight's charge",e:'⚔️',d:'Fewer men who hit hard and return quickly',steps:[
    {n:'Spurs',t:'+25% soldier damage, return 15% sooner.'},
    {n:'Lances',t:'+50% damage, return 30% sooner.'},
    {n:'Heavy horse',t:'Double damage, return 40% sooner.'}]}};
MST_PATHS.rook={
  a:{n:'Murder',e:'🐦‍⬛',d:'More ravens at once',steps:[
    {n:'Pair',t:'A second raven goes for another target (60% damage).'},
    {n:'Flock',t:'Two extra ravens (70% damage).'},
    {n:'Murder of crows',t:'Three extra ravens (80% damage).'}]},
  b:{n:'Omen',e:'🔔',d:'Silence that lasts and marks',steps:[
    {n:'Long toll',t:'Silence lasts 1 s longer.'},
    {n:'Ill omen',t:'+2 s of silence; silenced enemies take 25% more damage.'},
    {n:'Doom',t:'+3 s of silence; silenced enemies take 35% more damage.'}]}};
function mstState(k,a){const v=((a||ACC).mst||{})[k]|0;return v>=11?{p:'b',s:v-10}:v>=1?{p:'a',s:v}:{p:null,s:0};}
function mstEnc(p,s){return s<=0?0:p==='b'?10+s:s;}
function mstOpen(k){return MST.towers.includes(k)&&tLvl(k)>=T_MAX;}
function mstReady(k){return mstOpen(k)&&cleared()>=MST.need;}
function mstLabel(k){const m=mstState(k);return m.p?MST_PATHS[k][m.p].n+(m.s>=3?' ★':' '+m.s+'/3'):'';}
async function mstBuy(k,p){
  const m=mstState(k);if(!mstReady(k))return{ok:false,msg:'Mastery is not open yet'};
  if(m.p&&m.p!==p)return{ok:false,msg:'Switch the path first'};if(m.s>=3)return{ok:false,msg:'Already mastered'};
  const g=MST.gold[m.s];if(goldOf()<g)return{ok:false,msg:'Not enough gold'};
  if(ecoOn()){try{await ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('mastery_buy',{seat:seatNo(),tower:k,path:p},10000);ecoApply(r.state);return r;});return{ok:true};}catch(e){return{ok:false,msg:ecoMsg(e)};}}
  if(!spendGold(g))return{ok:false,msg:'Not enough gold'};ACC.mst=ACC.mst||{};ACC.mst[k]=mstEnc(p,m.s+1);addXp(Math.round(g/10));persist();return{ok:true};}
async function mstReset(k){
  const m=mstState(k);if(!m.p)return{ok:false};if(goldOf()<MST.swap)return{ok:false,msg:'Not enough gold'};
  if(ecoOn()){try{await ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('mastery_reset',{seat:seatNo(),tower:k},10000);ecoApply(r.state);return r;});return{ok:true};}catch(e){return{ok:false,msg:ecoMsg(e)};}}
  if(!spendGold(MST.swap))return{ok:false,msg:'Not enough gold'};ACC.mst=ACC.mst||{};ACC.mst[k]=0;persist();return{ok:true};}
/* ---------- the tower room panel ---------- */
function mstPanel(k){
  if(!MST.towers.includes(k))return '';
  const L=tLvl(k);if(L<T_MAX)return `<div class="mst lk"><b>⚜ MASTERY</b><small>opens at the last level (Lv ${T_MAX}), then two paths to choose from</small></div>`;
  if(cleared()<MST.need)return `<div class="mst lk"><b>⚜ MASTERY</b><small>opens after ${MST.need} stages (you have ${cleared()})</small></div>`;
  const m=mstState(k),P=MST_PATHS[k];
  const path=p=>{const D=P[p],mine=m.p===p,other=m.p&&m.p!==p,cur=mine?m.s:0,nx=cur+1,full=mine&&m.s>=3,cost=MST.gold[cur];
    const steps=D.steps.map((s,i)=>{const own=mine&&i<m.s;return `<div class="mstep ${own?'own':''}"><span class="dot">${own?'✔':i+1}</span><span><b>${esc(s.n)}</b><small>${esc(s.t)}</small></span></div>`;}).join('');
    const act=other?'':full?`<button class="bigbtn max" disabled><span class="bt">★ MASTERED</span></button>`:
      `<button class="bigbtn lvl ${goldOf()>=cost?'ready':'need'}" data-mb="${p}"><span class="bt">${cur?'UNLOCK STEP '+nx:'CHOOSE '+esc(D.n).toUpperCase()}</span><span class="bs">${goldOf()>=cost?'🪙 '+fmtN(cost):'Need '+fmtN(cost-goldOf())+' more 🪙'}</span></button>`;
    return `<div class="mpath ${mine?'on':''} ${other?'off':''}" data-mp="${p}"><div class="mph"><i>${D.e}</i><span><b>${esc(D.n)}</b><small>${esc(D.d)}</small></span></div>${steps}${act}</div>`;};
  return `<div class="mst"><div class="msth"><b>⚜ MASTERY</b><small>${m.p?'your path: '+esc(P[m.p].n):'choose one path. You can switch later for 🪙 '+fmtN(MST.swap)+' (steps restart)'}</small></div>
    <div class="mpaths">${path('a')}${path('b')}</div>${m.p?`<button class="linkbtn" data-mreset="1">↺ Switch path · 🪙 ${fmtN(MST.swap)}</button>`:''}</div>`;}
function mstBind(k,again){
  card.querySelectorAll('[data-mb]').forEach(b=>b.addEventListener('click',async()=>{const r=await mstBuy(k,b.dataset.mb);if(r.ok){SFX.play('upgrade');}else{SFX.play('deny');if(r.msg&&typeof ecoToast==='function')ecoToast('⚠ '+r.msg);}again(k);}));
  const rs=card.querySelector('[data-mreset]');
  if(rs)rs.addEventListener('click',async()=>{
    if(!rs.dataset.armed){rs.dataset.armed='1';rs.textContent='⚠ Tap again: pay 🪙 '+fmtN(MST.swap)+', steps restart';SFX.play('tap',50);setTimeout(()=>{if(rs.isConnected){delete rs.dataset.armed;rs.textContent='↺ Switch path · 🪙 '+fmtN(MST.swap);}},3500);return;}
    const r=await mstReset(k);if(!r.ok){SFX.play('deny');if(r.msg&&typeof ecoToast==='function')ecoToast('⚠ '+r.msg);}else SFX.play('upgrade');again(k);});}

/* ---------- v1.2.3: the other five towers ---------- */
function mstStep(k){const m=mstState(k);return m.p?m:{p:null,s:0};}
function mstStats(t,st){
  const k=t.type;if(k==='watch'||k==='scorp')return st;const m=mstStep(k);if(!m.p)return st;const s=m.s,o=Object.assign({},st);
  if(k==='wild'){if(m.p==='a'){o.splash*=[1.15,1.3,1.45][s-1];o.burn*=[1.3,1.6,2][s-1];}}
  else if(k==='glass'){if(m.p==='a'){o.slow-=s>=3?0.12:0.08;if(s>=3)o.dps*=1.2;}else{o.wm=[4,4,5][s-1];if(s>=3)o.dps*=1.25;}}
  else if(k==='weir'){if(m.p==='a'){o.slow-=s>=3?0.10:0.06;}else{o.mark+=[0.1,0.2,0.3][s-1];if(s>=3)o.range*=1.15;}}
  else if(k==='keep'){if(m.p==='a'){o.count=Math.min(8,o.count+[1,2,4][s-1]);o.shp=Math.round(o.shp*[1.2,1.4,1.7][s-1]);}else{o.sdmg=Math.round(o.sdmg*[1.25,1.5,2][s-1]*10)/10;o.resp=Math.round(o.resp*[0.85,0.7,0.6][s-1]*10)/10;}}
  if(o.slow<0.1)o.slow=0.1;return o;}
function mstRookSil(){const m=mstStep('rook');return m.p==='b'?[1,2,3][m.s-1]:0;}
function mstRookMark(){const m=mstStep('rook');return m.p==='b'&&m.s>=2?(m.s>=3?1.35:1.25):1;}
function mstTick(dt){
  let om=1;
  for(const s of G.map.slots){const t=s.tower;if(!t||t.frozen>G.time)continue;const k=t.type;
    if(k==='rook'){om=Math.max(om,mstRookMark());continue;}
    if(k!=='glass'&&k!=='weir')continue;const m=mstStep(k);if(!m.p)continue;
    const st=towerStats(t),inR=e=>{if(e.hp<=0)return false;if(k==='glass'&&e.fly)return false;const q=posE(e);return dist(q.x,q.y,s.x,s.y)<=st.range+e.r;};
    if(k==='glass'&&m.p==='a'&&m.s>=2){t.mT=(t.mT||0)+dt;if(t.mT>=5){t.mT=0;let n=0;for(const e of G.enemies)if(inR(e)&&!e.slowImmune&&!e.boss){e.chillT=G.time+1;e.chillV=98;e.slow=Math.min(e.slow,0.02);n++;}if(n)addFx({t:'ring',x:s.x,y:s.y,r0:8,r1:st.range,life:0.5,col:'#bfe8ff'});}}
    if(k==='glass'&&m.p==='b'&&m.s>=2){for(const e of G.enemies)if(e.walker&&!e.boss&&inR(e)&&e.hp<e.max*0.25){const q=posE(e);addText(q.x,q.y-22,'SHATTER','#bfe8ff',true);dmg(e,e.hp+1,'glass');}}
    if(k==='weir'&&m.p==='a'&&m.s>=2){const per=m.s>=3?4.5:6,hold=m.s>=3?1.6:1.2;t.mT=(t.mT||0)+dt;if(t.mT>=per){t.mT=0;let n=0;for(const e of G.enemies)if(inR(e)&&!e.slowImmune&&!e.boss){e.chillT=G.time+hold;e.chillV=98;e.slow=Math.min(e.slow,0.02);n++;}if(n)addFx({t:'ring',x:s.x,y:s.y,r0:8,r1:st.range,life:0.6,col:'#6fcf6f'});}}
    if(k==='weir'&&m.p==='b'){if(m.s>=2)for(const e of G.enemies)if(e.stealth&&inR(e))e.stealth=false;
      if(m.s>=3)for(const e of G.enemies)if((e.raise||e.healAura||e.speedAura||e.lord)&&inR(e))e.silT=Math.max(e.silT||0,G.time+0.3);}}
  if(om>1)for(const e of G.enemies)if(e.silT>G.time)e.mark=Math.max(e.mark,om);}
/* ---------- in battle ---------- */
function mstFire(t,s,st,best,def,pr){
  const m=mstState(t.type);if(!m.p)return;const k=t.type,sx=m.s,rnd=G.rng||Math.random;
  if(k==='watch'){
    if(m.p==='a'){const n=[1,2,3][sx-1],mul=[0.6,0.7,0.8][sx-1];
      const others=G.enemies.filter(e=>e!==best&&e.hp>0&&!(e.stealth&&dist(posE(e).x,posE(e).y,s.x,s.y)>62)&&dist(posE(e).x,posE(e).y,s.x,s.y)<=st.range+e.r).sort((a,b)=>remainOf(a)-remainOf(b)).slice(0,n);
      for(const e of others){const q=posE(e);G.projs.push({x:s.x,y:s.y-14,tgt:e,lx:q.x,ly:q.y,spd:def.pspd,dmg:st.dmg*mul,src:k,splash:0,burn:st.burn,ang:t.face});}
      if(sx>=3)t.cd*=0.909;}
    else{if(sx>=2&&(best.fly||best.armored))pr.dmg*=1.25;const ch=sx>=3?0.30:0.15,cm=sx>=3?2.5:2;
      if(rnd()<ch){pr.dmg*=cm;pr.crit=1;const q=posE(best);addText(q.x,q.y-22,'CRIT','#ffd54a',true);}}}
  else if(k==='wild'){
    if(m.p==='a')pr.bt=[3,4,5][sx-1];
    else pr.pool={d:st.burn*[1.5,2.25,3][sx-1],t:[3,4,5][sx-1]};}
  else if(k==='rook'){
    if(m.p==='a'){const n=[1,2,3][sx-1],mul=[0.6,0.7,0.8][sx-1];
      const others=G.enemies.filter(e=>e!==best&&e.hp>0&&(e.raise||e.healAura||e.speedAura||e.lord||e.fly||e.air||true)&&!(e.stealth&&dist(posE(e).x,posE(e).y,s.x,s.y)>62)&&dist(posE(e).x,posE(e).y,s.x,s.y)<=st.range+e.r).sort((a,b)=>rookPri(b)-rookPri(a)).slice(0,n);
      for(const e of others){const q=posE(e);G.projs.push({x:s.x,y:s.y-14,tgt:e,lx:q.x,ly:q.y,spd:def.pspd,dmg:st.dmg*mul,src:k,splash:0,burn:0,ang:t.face,sil:rookSilence(t)});}}}
  else if(k==='scorp'){
    if(m.p==='a'){pr.mp={pierce:[1,2,3][sx-1]};if(sx>=3)t.cd*=0.909;}
    else{const big=best.armored||best.dragon||best.walker;if(big)pr.dmg*=[1.25,1.25,1.6][sx-1];if(sx>=2)pr.mp={chill:sx>=3?40:30};}}}
function mstHit(p){
  const o=p.mp,t0=p.tgt;if(!o)return;
  if(o.chill&&t0.hp>0&&!t0.slowImmune){t0.chillT=G.time+2;t0.chillV=o.chill;}
  if(o.pierce){const others=G.enemies.filter(e=>e!==t0&&e.hp>0&&!e.fly&&e.route===t0.route&&Math.abs(e.prog-t0.prog)<60).sort((a,b)=>Math.abs(a.prog-t0.prog)-Math.abs(b.prog-t0.prog)).slice(0,o.pierce);
    let far=null,fd=0;for(const e of others){dmg(e,p.dmg*0.7,p.src);const q=posE(e),dd=dist(q.x,q.y,p.lx,p.ly);if(dd>fd){fd=dd;far=q;}}
    if(far)addFx({t:'line',x:p.lx,y:p.ly-8,tx:far.x,ty:far.y-8,life:0.25,col:'#ffe2a0'});}}
