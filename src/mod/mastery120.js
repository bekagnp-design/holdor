/* v1.2.0: Mastery. After a tower's last card level (16), a player picks one of two paths and buys three steps with gold.
   State: ACC.mst[tower] = 0 (none), 1..3 (path A, step), 11..13 (path B, step). Managed seats buy through the server (mastery_buy / mastery_reset). */
const MST={need:30,gold:[20000,40000,80000],swap:10000,towers:['watch','scorp']};
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
  else if(k==='scorp'){
    if(m.p==='a'){pr.mp={pierce:[1,2,3][sx-1]};if(sx>=3)t.cd*=0.909;}
    else{const big=best.armored||best.dragon||best.walker;if(big)pr.dmg*=[1.25,1.25,1.6][sx-1];if(sx>=2)pr.mp={chill:sx>=3?40:30};}}}
function mstHit(p){
  const o=p.mp,t0=p.tgt;if(!o)return;
  if(o.chill&&t0.hp>0&&!t0.slowImmune){t0.chillT=G.time+2;t0.chillV=o.chill;}
  if(o.pierce){const others=G.enemies.filter(e=>e!==t0&&e.hp>0&&!e.fly&&e.route===t0.route&&Math.abs(e.prog-t0.prog)<60).sort((a,b)=>Math.abs(a.prog-t0.prog)-Math.abs(b.prog-t0.prog)).slice(0,o.pierce);
    let far=null,fd=0;for(const e of others){dmg(e,p.dmg*0.7,p.src);const q=posE(e),dd=dist(q.x,q.y,p.lx,p.ly);if(dd>fd){fd=dd;far=q;}}
    if(far)addFx({t:'line',x:p.lx,y:p.ly-8,tx:far.x,ty:far.y-8,life:0.25,col:'#ffe2a0'});}}
