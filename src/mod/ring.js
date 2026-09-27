/* =========================== BUILD RING (v1.0.46) ===========================
   Kingdom Rush style, right where the finger is:
   tap a pad → the towers you can build open around it, big, each with its price;
   tap one → its ghost and range show on the pad and the icon turns into ✓ → tap ✓ to build.
   Tap a built tower → upgrade (top), sell (bottom), banner (left, keeps) and details (right), same ✓ confirm. */
const ringEl=document.createElement('div');ringEl.id='ring';ringEl.hidden=true;
const ringTip=document.createElement('div');ringTip.id='ringTip';ringTip.hidden=true;
$('#stage').appendChild(ringEl);$('#stage').appendChild(ringTip);
let RING=null;
const RING_ANG={1:[-28],2:[-145,-35],3:[-90,30,150],4:[-135,-45,45,135],5:[-90,-18,54,126,198],6:[-90,-30,30,90,150,210]};
function w2s(x,y){return{x:canvas.offsetLeft+((x-CAM.x)*CAM.z+W/2)*scale,y:canvas.offsetTop+((y-CAM.y)*CAM.z+H/2)*scale};}
function sellValue(t){return Math.round(t.invested*(UP('salvage')?0.9:0.6));}
function upgradeTower(s){
  const t=s&&s.tower;if(!t||t.lvl>=5||t.lvl>=maxTowerLvl())return false;
  const up=upCost(t);if(G.gold<up)return false;
  G.gold-=up;t.lvl++;t.invested+=up;noteTower(t.type,t.lvl);G.log.push({t:G.tick,a:'up',s:s.id});
  addFx({t:'ring',x:s.x,y:s.y,r0:6,r1:34,life:0.4,col:'#e3b661'});SFX.play('upgrade');if(G.tut)tutEvent('upgrade');return true;}
function sellTower(s){
  const t=s&&s.tower;if(!t)return 0;const v=sellValue(t);
  G.gold+=v;G.allies=G.allies.filter(a=>a.home!==s.id);G.typeCount[t.type]=Math.max(0,(G.typeCount[t.type]||1)-1);
  s.tower=null;G.log.push({t:G.tick,a:'sell',s:s.id});addText(s.x,s.y-24,'+'+v,'#ffd23c');SFX.play('gold');if(G.tut)tutEvent('sell');return v;}
/* lessons: only the action the current step asks for works; it pulses, the rest dim */
function ringTutOK(it){const st=G.tut&&!G.tut.hold?TS():null;if(!st||!st.ring)return true;if(st.ring.indexOf(it.act)<0)return false;const p=(st.want||'').split(':');return !(it.act==='build'&&p[0]==='build'&&p[1]&&it.k!==p[1]);}
function ringTutGo(it){const st=G.tut&&!G.tut.hold?TS():null;return !!(st&&st.ring&&ringTutOK(it));}
function ringSig(s){return s.tower?'t'+s.tower.type+s.tower.lvl:'e';}
function ringItems(s){
  if(!s.tower){const avail=G.tutorial?['watch']:openTowers();return avail.map(k=>({act:'build',k}));}
  const t=s.tower,it=[{act:'up',ang:-90},{act:'sell',ang:90},{act:'info',ang:0}];
  if(TOWERS[t.type].kind==='barracks')it.push({act:'rally',ang:180});
  return it;}
function itemCost(it,s){
  if(it.act==='build')return costOf(it.k);
  if(it.act==='up'){const t=s.tower;return t&&t.lvl<5&&t.lvl<maxTowerLvl()?upCost(t):null;}
  return null;}
function ringBtnHTML(it,s){
  const coin='<i></i>';
  if(it.act==='build')return `${towerIconHTML(it.k,1,48)}<span class="rp">${coin}${costOf(it.k)}</span>`;
  const t=s.tower;
  if(it.act==='up'){
    if(t.lvl>=5)return `<span class="em">⭐</span><span class="rp">MAX</span>`;
    if(t.lvl>=maxTowerLvl())return `${towerIconHTML(t.type,t.lvl+1,44)}<span class="bd">🔒</span><span class="rp">${ROMAN[t.lvl]}</span>`;
    return `${towerIconHTML(t.type,t.lvl+1,44)}<span class="bd">⬆</span><span class="rp">${coin}${upCost(t)}</span>`;}
  if(it.act==='sell')return `<span class="em">💰</span><span class="rp">+${sellValue(t)}</span>`;
  if(it.act==='rally')return `<span class="em">🚩</span><span class="rp">Banner</span>`;
  return `<span class="em ii">i</span><span class="rp">Info</span>`;}
function statLine(k,st){const d=TOWERS[k];
  return d.kind==='aura'?`slows ${Math.round((1-st.slow)*100)}% · +${Math.round((st.mark-1)*100)}% damage taken`:
    d.kind==='zone'?`${Math.round(st.dps)} damage a second · slows ${Math.round((1-st.slow)*100)}%`:
    d.kind==='barracks'?`${st.count} men · ${st.shp} hp · ${st.sdmg} damage`:
    `${Math.round(st.dmg)} damage · ${st.rate.toFixed(2)} shots a second · range ${Math.round(st.range)}`;}
function upLine(t){const d=TOWERS[t.type],a=towerStats(t),b=towerStats(Object.assign({},t,{lvl:t.lvl+1})),r=v=>Math.round(v);
  const ch=(x,y,u)=>x===y?`${x}${u}`:`${x}→${y}${u}`;
  if(d.kind==='barracks')return `${ch(a.count,b.count,' men')} · ${ch(a.shp,b.shp,' hp')} · ${ch(a.sdmg,b.sdmg,' damage')}`;
  if(d.kind==='aura')return `slow ${ch(r((1-a.slow)*100),r((1-b.slow)*100),'%')} · range ${ch(r(a.range),r(b.range),'')}`;
  if(d.kind==='zone')return `${ch(r(a.dps),r(b.dps),' damage a second')} · range ${ch(r(a.range),r(b.range),'')}`;
  return `damage ${ch(r(a.dmg),r(b.dmg),'')} · range ${ch(r(a.range),r(b.range),'')}`;}
function ringTipHTML(it,s){
  if(it.act==='build'){const d=TOWERS[it.k];return `<b>${d.n}</b><br>${d.sub}<br><span class="sl">${statLine(it.k,towerStats({type:it.k,lvl:1}))}</span><br><span class="ok">Tap ✓ to build · ${costOf(it.k)} gold</span>`;}
  const t=s.tower,d=TOWERS[t.type];
  if(it.act==='up')return `<b>${d.n} ${ROMAN[t.lvl]}</b><br><span class="sl">${upLine(t)}</span><br><span class="ok">Tap ✓ to upgrade · ${upCost(t)} gold</span>`;
  if(it.act==='sell')return `<b>Sell ${d.n}?</b><br><span class="ok">Tap ✓ to sell for ${sellValue(t)} gold</span>`;
  return '';}
function ringShowTip(html,bad){if(!html){ringTip.hidden=true;return;}ringTip.innerHTML=html;ringTip.classList.toggle('bad',!!bad);ringTip.hidden=false;if(RING)RING.tipT=performance.now();placeRing(true);}
function renderRing(){
  const s=RING.s;RING.sig=ringSig(s);RING.arm=null;G.pending=null;
  const items=ringItems(s),n=items.length,angs=RING_ANG[Math.min(6,Math.max(1,n))];
  RING.R=s.tower?60:(n>=5?68:n>=3?62:n===1?64:58);
  ringEl.innerHTML=`<span class="rr" style="left:${-RING.R}px;top:${-RING.R}px;width:${2*RING.R}px;height:${2*RING.R}px"></span>`;
  items.forEach((it,i)=>{const a=(it.ang!=null?it.ang:angs[i])*Math.PI/180;
    const b=document.createElement('button');b.className='rb'+(it.act!=='build'?' '+it.act:'');b.type='button';
    b.style.left=Math.round(Math.cos(a)*RING.R)+'px';b.style.top=Math.round(Math.sin(a)*RING.R)+'px';b.style.animationDelay=(i*0.025)+'s';
    b.innerHTML=ringBtnHTML(it,s);b.addEventListener('click',ev=>{ev.stopPropagation();ringTap(it);});
    it.el=b;ringEl.appendChild(b);});
  RING.items=items;ringTip.hidden=true;
  ringState();placeRing(true);}
function ringState(){if(!RING)return;const s=RING.s;
  for(const it of RING.items){const c=itemCost(it,s),t=s.tower;
    it.el.classList.toggle('poor',c!=null&&G.gold<c);
    if(it.act==='up'&&t){it.el.classList.toggle('lock',t.lvl<5&&t.lvl>=maxTowerLvl());it.el.classList.toggle('max',t.lvl>=5);}
    it.el.classList.toggle('arm',RING.arm===it);it.el.classList.toggle('tgo',ringTutGo(it)&&RING.arm!==it);it.el.classList.toggle('toff',!ringTutOK(it));}}
function placeRing(force){
  if(!RING)return;const s=RING.s,st=$('#stage'),sw=st.clientWidth,sh=st.clientHeight;
  const p=w2s(s.x,s.y-(s.tower?16:2)),R=RING.R,m=R+32;
  const cx=Math.round(clamp(p.x,m,Math.max(m,sw-m))),cy=Math.round(clamp(p.y,m-4,Math.max(m,sh-m-10)));
  if(force||cx!==RING.cx||cy!==RING.cy){RING.cx=cx;RING.cy=cy;ringEl.style.transform=`translate(${cx}px,${cy}px)`;}
  if(!ringTip.hidden){const tw=ringTip.offsetWidth,th=ringTip.offsetHeight;
    let ty=cy-R-44-th;if(ty<4)ty=cy+R+42;ty=Math.min(ty,sh-th-4);
    const tx=clamp(cx-tw/2,6,Math.max(6,sw-tw-6));ringTip.style.left=Math.round(tx)+'px';ringTip.style.top=Math.round(Math.max(4,ty))+'px';}}
function openRing(s){
  if(!s||G.state!=='play')return;
  RING={s,items:[],arm:null};G.sel=s;ringEl.hidden=false;renderRing();SFX.play('tap');}
function closeRing(){
  if(!RING&&ringEl.hidden)return;
  RING=null;ringEl.hidden=true;ringEl.innerHTML='';ringTip.hidden=true;G.pending=null;
  if(G.sel&&!G.sel.tower&&!sheet.classList.contains('open'))G.sel=null;}
function ringTap(it){
  if(!RING||G.state!=='play')return;const s=RING.s,t=s.tower;
  if(!ringTutOK(it)){const st=TS(),p=(st.want||'').split(':');ringShowTip(it.act==='build'&&p[1]?`<b>This time: ${TOWERS[p[1]].n}</b>`:`<b>One step at a time</b><br>${tutText(st.hint)||''}`,1);SFX.play('deny');return;}
  if(it.act==='info'){closeRing();G.sel=s;if(G.tut)G.tutInfo=true;openSheet(s);SFX.play('tap');return;}
  if(it.act==='rally'){closeRing();G.sel=s;G.armed='rally';G.rallySlot=s;G.heroSel=false;updateBar();addText(s.x,s.y-40,'Tap the road','#e3b661');SFX.play('tap');return;}
  if(it.act==='up'&&t){
    if(t.lvl>=5){ringShowTip('<b>Fully upgraded</b>');SFX.play('deny');return;}
    if(t.lvl>=maxTowerLvl()){ringShowTip(`<b>Tier ${ROMAN[t.lvl]} is locked</b><br>It opens after stage ${LVL_GATES[t.lvl]}`,1);SFX.play('deny');return;}}
  const c=itemCost(it,s);
  if(c!=null&&G.gold<c){ringShowTip(`<b>Not enough gold</b><br>You need ${c}, you have ${Math.floor(G.gold)}`,1);SFX.play('deny');return;}
  if(RING.arm!==it){RING.arm=it;G.pending=it.act==='build'?{slot:s,type:it.k}:null;ringState();ringShowTip(ringTipHTML(it,s));SFX.play('tap');return;}
  if(it.act==='build'){build(s,it.k);return;}
  if(it.act==='up'){if(upgradeTower(s)){closeRing();G.sel=null;}return;}
  if(it.act==='sell'){sellTower(s);G.sel=null;closeSheet();return;}}
function ringFrame(){
  if(!RING)return;
  if(G.state!=='play'||!G.map||G.map.slots.indexOf(RING.s)<0){closeRing();return;}
  if(ringSig(RING.s)!==RING.sig){renderRing();return;}
  ringState();placeRing(false);}
$('#stage').addEventListener('pointerdown',ev=>{if(ev.target===ev.currentTarget&&RING&&G.state==='play'){G.sel=null;closeSheet();}});
$('#bar').addEventListener('pointerdown',()=>{if(RING){G.sel=null;closeRing();}});
