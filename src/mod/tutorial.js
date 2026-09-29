/* =========================== TUTORIAL (v1.0.47) ===========================
   The first battle teaches by doing: every part of the screen is shown, and the player does each thing once.
   Later, a short hands-on lesson runs the first time something new unlocks (LESSONS below).
   A step: t (narrator text) · hold (tap to go on) · want ('build', 'build:glass', 'power:fire', …) · hint (text or fn)
   · cond (fn → step done) · focus (DOM selector the arrow points at) · ring (ring actions allowed) · gold (top-up) · pause · cam */
const TUT_WANT_LBL={build:'BUILD THE TOWER',upgrade:'UPGRADE THE TOWER',sell:'SELL A TOWER',info:'READ THE TOWER',power:'CAST THE SPELL',move:'MOVE YOUR CHAMPION',call:'CALL THE WAVE',shot:'WATCH IT SHOOT',ult:'USE THE SKILL',speed:'SPEED UP',pause:'PAUSE, THEN RESUME',book:'OPEN THE BOOK',rally:'MOVE THE BANNER',hodor:'SEND HODOR',wait:'HOLD ON',kill:'WATCH'};
const TUT_BTN={ult:'#bUlt',speed:'#bSpeed',pause:'#bPause',book:'#bInfo'};
function tutText(v){return typeof v==='function'?v():v;}
function hodorSay(txt,ms){G.hodor={txt,t0:performance.now(),ms:ms||2600};SFX.play('hodor',500);}
function TS(){return G.tut?(G.tut.steps||TUT_STEPS)[G.tut.i]||null:null;}
function tutWantBase(){const st=TS();return st&&st.want?st.want.split(':')[0]:null;}
function tutMapBlocked(){const w=tutWantBase();return !!(w&&(TUT_BTN[w]||w==='power'));}
function learnMap(){if(!ACC.learn||typeof ACC.learn!=='object')ACC.learn={};return ACC.learn;}
function ringHint(a,b,c){return !RING?a:!RING.arm?b:c;}
/* the tutorial has its own short, straight road (the dead reach the first tower within seconds); slots near the middle of it are offered first */
const TUT_LEVEL=Object.assign({},LEVELS[0],{routes:[[[195,-30],[195,120],[105,120],[105,300],[195,300],[195,544]]],gates:[195],style:'bend',stage:'t',intro:''});
/* the first tower goes on the ring closest to the road 40% of the way down: the dead are in its range within seconds */
function tutSlot(){if(!G.map)return null;const f=G.map.slots.filter(s=>!s.tower);if(!G.tutorial)return f.sort((a,b)=>b.y-a.y)[0]||null;
  const R=G.map.routes[0],q=posAt(G.map,R.total*0.4,0);return f.sort((a,b)=>dist(a.x,a.y,q.x,q.y)-dist(b.x,b.y,q.x,q.y))[0]||null;}
function tutTower(){const ts=G.map?G.map.slots.filter(s=>s.tower):[];return ts.sort((a,b)=>b.tower.lvl-a.tower.lvl||b.y-a.y)[0]||null;}
function upgradeGold(){const s=tutTower();return s?upCost(s.tower):0;}
const TUT_STEPS=[
 {t:'Welcome to HOLDOR! The dead are marching on the realm, and every stage is a gate we must hold. I will show you everything, one step at a time.',pose:'open',hold:1,cam:[1],hodor:'HODOR!'},
 {t:'This is Hodor, holding the door. The dead walk down the road to him, and every one that reaches him breaks a piece of the door.',pose:'point',hold:1,cam:[1.75,GX,GATE_Y-6],hodor:'Hodor… hodor.'},
 {t:'Up top, this bar is the door. If it breaks, the stage is lost. The more of it you keep, the more stars you win.',pose:'point',hold:1,cam:[1],focus:'#hud .gate'},
 {t:'This shows the wave you are on and how many are coming. This stage has three. Hold them all and the stage is yours.',pose:'point',hold:1,focus:'#hud .stat:first-child'},
 {t:'This is your gold. Towers cost gold; every kill pays more, and so does calling a wave early. The crossed swords count your kills.',pose:'point',hold:1,focus:'#hud .stat:nth-child(2)'},
 {t:'Towers stop the dead. Let us build a Watchtower on the glowing stone ring.',pose:'point',want:'build',ring:['build'],cam:'slot',pause:1,hodor:'Hodor?',
  hint:()=>ringHint('Tap the glowing stone ring','Tap the Watchtower','Tap ✓ to build it')},
 {t:'The first wave waits at the top of the road. Tap the ⚔ banner to call it now: calling early pays bonus gold.',pose:'point',want:'call',hint:'Tap the ⚔ banner at the top of the road',cam:[1],hodor:'HODOR HODOR!'},
 {t:'',want:'shot',silent:1,cam:'tower'},
 {t:'',want:'kill',hint:'Your tower shoots by itself. Every kill drops gold for you.',cond:()=>G.kills>0,cam:[1]},
 {t:'Your champion has ridden up from the keep. Tap the ground where they should stand and they will walk there.',pose:'point',want:'move',hero:1,heroFx:1,cam:[1.5,GX,GATE_Y-52],camBack:1500,hodor:'HODOR! HODOR!',
  hint:()=>'Tap the ground where your champion should stand'},
 {t:'This card is your champion. The bar is health. The thin gold line is battle experience: fill it with kills and your champion grows stronger for the rest of the battle. A fallen champion rides back after a short while.',pose:'point',hold:1,focus:'#hCard'},
 {t:()=>{const u=SK[G.hero.c.sk[2]];return 'Every champion has one skill of their own. Yours is '+u.n+': '+u.d(skVal(G.hero,G.hero.c.sk[2]))+'. Tap it now.';},pose:'point',want:'ult',hodor:'Hodor!',
  hint:()=>'Tap '+SK[G.hero.c.sk[2]].e+' '+SK[G.hero.c.sk[2]].n+' at the bottom'},
 {t:'',want:'wait',hint:'Hold on until the road is clear…',cond:()=>G.waveDone&&!G.enemies.some(e=>e.hp>0)},
 {t:'Well held! Between waves the timer waits for you. Towers grow stronger with gold: tap your Watchtower, then ⬆ and ✓.',pose:'point',want:'upgrade',ring:['up'],gold:upgradeGold,cam:'tower',hodor:'Hodor!',
  hint:()=>ringHint('Tap your Watchtower','Tap ⬆ to upgrade it','Tap ✓ to pay')},
 {t:'Want the numbers? Tap a tower, then ⓘ. Close the card with ✖ when you have read it.',pose:'point',want:'info',ring:['info'],cam:[1],
  hint:()=>sheet.classList.contains('open')?'These are its numbers. Tap ✖ to close the card':ringHint('Tap your Watchtower','Tap ⓘ Info',''),cond:()=>G.tutInfo&&!sheet.classList.contains('open')},
 {t:'One tower is not enough for long. Build a second Watchtower on any stone ring.',pose:'point',want:'build',ring:['build'],gold:()=>costOf('watch'),
  hint:()=>ringHint('Tap any stone ring','Tap the Watchtower','Tap ✓ to build it')},
 {t:'Built in the wrong spot? Sell the tower and you get 60% of its gold back. Try it: tap the new tower, then 💰 and ✓.',pose:'point',want:'sell',ring:['sell'],
  hint:()=>ringHint('Tap the new tower','Tap 💰 to sell it','Tap ✓ to sell')},
 {t:'Now build it again, wherever you think it is best.',want:'build',ring:['build'],gold:()=>costOf('watch'),
  hint:()=>ringHint('Tap any stone ring','Tap the Watchtower','Tap ✓ to build it')},
 {t:'Call the second wave when you are ready.',want:'call',hint:'Tap the ⚔ banner for wave 2'},
 {t:'Next to your champion wait the spells of your house. The first is Arrow rain: a volley from the wall. Tap it, then tap the dead on the road.',pose:'point',want:'power',focus:'#bP0',hodor:'HODOR!',
  hint:()=>G.armed==='arrows'?'Now tap the dead on the road':'Tap 🏹 Arrow rain at the bottom'},
 {t:'A spell needs time to come back: the dark cover drains away while it recharges. Your champion\'s skill works the same way. More spells open as you hold stages.',pose:'point',hold:1,focus:'#bP0'},
 {t:'Too slow for you? This button hurries the battle: 2×, then 4×, then back to 1×. Tap it.',pose:'point',want:'speed',focus:'#bSpeed',hint:'Tap 1× at the top right',hodor:'Ho-dor!'},
 {t:'Pause stops everything. From there you can resume, start the stage again or leave. Tap pause, then Resume.',pose:'point',want:'pause',focus:'#bPause',hint:'Tap ⏸ at the top right, then Resume'},
 {t:'The ! opens the book: every enemy you have met, your towers, and field notes. Open it, look, then close it.',pose:'point',want:'book',focus:'#bInfo',hint:'Tap ! at the top, then close the book',cond:()=>G.tutBook&&overlay.classList.contains('hidden')},
 {t:'Call the last wave.',want:'call',hint:'When the road is clear, tap the ⚔ banner'},
 {t:'That is everything. Hold the gate!',hint:'That is everything. Hold the gate!',auto:4200,end:1,cam:[1],hodor:'HODOR HODOR HODOR!'},
];
/* ---- lessons: the first time something new appears ---- */
function towerLesson(k,txt){return [{t:txt,pose:'point',hold:1},
  {t:'',want:'build:'+k,ring:['build'],pause:1,gold:()=>costOf(k),hint:()=>ringHint('Tap a stone ring','Tap '+TOWERS[k].n,'Tap ✓ to build it')}];}
function spellLesson(k,txt,btn){const S=SPELLS[k];return [{t:txt,pose:'point',hold:1,focus:btn},
  {t:'',want:'power:'+k,pause:1,focus:btn,hint:()=>k==='reinf'?'Tap '+S.e+' '+S.n+' at the bottom':G.armed===k?'Now tap the dead on the road':'Tap '+S.e+' '+S.n+' at the bottom'}];}
const LESSONS={
 gates:{need:()=>G.map.gates.length>1,steps:[
  {t:'This road ends at two gates, and there is only one Hodor. He runs to whichever gate the dead reach first. You can also send him yourself: tap a gate.',pose:'point',hold:1,cam:[1.3,GX,GATE_Y-50]},
  {t:'',want:'hodor',pause:1,hint:'Tap the other gate to send Hodor there',cam:[1]}]},
 glass:{need:()=>towerOpen('glass'),steps:towerLesson('glass','New tower: Dragonglass spears. They stab everything that walks past, slow it down, and hit White Walkers three times as hard. Build them right beside the road.')},
 keep:{need:()=>towerOpen('keep'),steps:[...towerLesson('keep','New tower: the Watch keep. No archers here — it sends sworn swords onto the road to block the dead and fight them.'),
  {t:'The soldiers hold under a banner. Tap the keep, then 🚩, then tap the road where they should stand.',pose:'point',want:'rally',ring:['rally'],pause:1,hint:()=>G.armed==='rally'?'Now tap the road where they should stand':ringHint('Tap your keep','Tap 🚩 Banner','')}]},
 tier2:{need:()=>maxTowerLvl()>=2,ready:()=>G.map.slots.some(s=>s.tower&&s.tower.lvl<2&&G.gold>=upCost(s.tower)),steps:[
  {t:'Stages held make your towers grow: tier II is open. Upgrade a tower now — it hits harder and reaches further.',pose:'point',hold:1},
  {t:'',want:'upgrade',ring:['up'],pause:1,hint:()=>ringHint('Tap a tower','Tap ⬆ to upgrade it','Tap ✓ to pay')}]},
 fire:{need:()=>spellOpen('fire'),ready:()=>G.powerCd.fire<=0&&G.enemies.some(e=>e.hp>0&&!e.fly&&posE(e).y>70),
  steps:spellLesson('fire','New spell: Dracarys. A dragon burns everything inside the circle, and it is the one spell that fully hurts a dragon. It takes a minute to come back — save it for crowds and bosses.','#bP1')},
 reinf:{need:()=>spellOpen('reinf'),ready:()=>G.powerCd.reinf<=0&&G.enemies.some(e=>e.hp>0&&!e.fly&&posE(e).y>70),
  steps:spellLesson('reinf','New spell: Brothers. Sworn brothers march out of the gate and fight the dead on the road for fifteen seconds.','#bP2')},
 scorp:{need:()=>towerOpen('scorp'),steps:towerLesson('scorp','New tower: the Scorpion. A slow ballista with a long reach: two and a half times the damage against giants and dragons, and the only tower that fully hurts a dragon.')},
 wild:{need:()=>towerOpen('wild'),steps:towerLesson('wild','New tower: the Wildfire catapult. Green fire splashes a whole group and keeps burning — but it cannot hit anything standing too close.')},
 weir:{need:()=>towerOpen('weir'),steps:towerLesson('weir','New tower: the Weirwood. It shoots nothing: the old gods slow every enemy in reach by 30%, and they take 20% more damage from everything else.')},
 tier3:{need:()=>maxTowerLvl()>=3,ready:()=>G.map.slots.some(s=>s.tower&&s.tower.lvl===2),steps:[{t:'Tier III is open: your towers can grow one step further.',pose:'point',hold:1}]},
 tier4:{need:()=>maxTowerLvl()>=4,ready:()=>G.map.slots.some(s=>s.tower&&s.tower.lvl===3),steps:[{t:'Tier IV is open: your towers can grow again.',pose:'point',hold:1}]},
 tier5:{need:()=>maxTowerLvl()>=5,ready:()=>G.map.slots.some(s=>s.tower&&s.tower.lvl===4),steps:[{t:'Tier V is open — the last and strongest tier of every tower.',pose:'point',hold:1}]},
 big:{need:()=>true,ready:()=>!!bigOne(),steps:[
  {t:()=>{const e=bigOne(),n=e?ENEMIES[e.type].n:'giant',sc=towerOpen('scorp'),fi=spellOpen('fire');return 'Look: a '+n+'! Big ones like this have many times the health of the rest and break the door fast. '+(sc?'Scorpions do two and a half times the damage to giants and dragons. ':'')+'Save '+(fi?'Dracarys and ':'')+'your champion\'s skill for them.';},pose:'point',hold:1,cam:'big'}]},
};
function bigOne(){return G.enemies.find(e=>e.hp>0&&(e.boss||e.mini||(ENEMIES[e.type]&&ENEMIES[e.type].big>=1.8))&&posE(e).y>40)||null;}
function lessonsInit(){G.lq=[];G.lessonT=0;if(G.tutorial||G.mode!=='campaign'||!ACC||!ACC.tut)return;const L=learnMap();for(const k in LESSONS)if(!L[k]&&LESSONS[k].need())G.lq.push(k);}
function lessonTick(dt){
  if(G.tut||!G.lq||!G.lq.length||G.state!=='play'||G.paused||!overlay.classList.contains('hidden'))return;
  G.lessonT=(G.lessonT||0)+dt;if(G.lessonT<0.6)return;G.lessonT=0;
  for(const k of G.lq){const Ls=LESSONS[k];if(!Ls.ready||Ls.ready()){lessonStart(k);return;}}}
function lessonStart(k){G.lq=(G.lq||[]).filter(x=>x!==k);if(RING)closeRing();G.tut={i:0,hold:true,steps:LESSONS[k].steps,key:k};G.paused=true;applyTut();}
/* ---- the engine ---- */
function tutPulse(){document.querySelectorAll('.tutpulse').forEach(e=>e.classList.remove('tutpulse'));const st=TS();if(!st)return;const sel=st.focus||TUT_BTN[tutWantBase()];if(sel){const b=document.querySelector(sel);if(b)b.classList.add('tutpulse');}}
function tutFinish(){const k=G.tut&&G.tut.key;G.tut=null;G.paused=false;camReset();tutPulse();if(!k||k==='tut')ACC.tut=1;else learnMap()[k]=1;persist();}
function skipTutorial(){if(!G.tut)return;const k=G.tut.key;if(RING)closeRing();G.tut=null;G.paused=false;G.heroOn=true;camReset();tutPulse();if(!k||k==='tut')ACC.tut=1;else learnMap()[k]=1;persist();hodorSay('Hodor.',1600);}
function tutStart(){G.tut={i:0,hold:true,steps:TUT_STEPS,key:'tut'};G.paused=true;applyTut();}
function applyTut(){
  const st=TS();
  if(!st){tutFinish();return;}
  G.tut.hold=!!st.hold;G.tut.want=st.want||null;G.tut.fade=0;G.tut.skipArm=0;G.tut.t0=performance.now();G.tutInfo=false;G.tutBook=false;
  if(st.want&&TUT_BTN[tutWantBase()]){G.sel=null;closeSheet();}
  G.paused=!!st.hold||!!st.pause;
  if(st.hero)G.heroOn=true;
  if(st.heroFx&&G.hero){const h=G.hero,col=HOUSES[ACC.house].col;h.x=GX;h.y=GATE_Y-36;h.tx=null;h.ty=null;addFx({t:'fire',x:h.x,y:h.y-6,r0:6,r1:46,life:0.6,col});addFx({t:'ring',x:h.x,y:h.y,r0:4,r1:70,life:0.9,col});addFx({t:'ring',x:h.x,y:h.y,r0:4,r1:40,life:0.6,col:'#fff1c4'});addText(h.x,h.y-34,shortName(h.c)+' rides!',col);G.shake=Math.min(6,G.shake+3);SFX.play('hero');G.heroSayAt=G.time+0.9;}
  if(st.gold){const need=Math.ceil(typeof st.gold==='function'?st.gold():st.gold);if(need>0&&G.gold<need){const add=need-Math.floor(G.gold);G.gold=Math.floor(G.gold)+add;addText(GX,GATE_Y-70,'+'+add+' gold from the Iron Bank','#ffd23c',1);SFX.play('gold');}}
  if(st.hodor)hodorSay(st.hodor);
  if(st.camBack)setTimeout(()=>{if(G.tut&&TS()===st)camReset();},st.camBack);
  if(st.auto)setTimeout(()=>{if(G.tut&&TS()===st)tutNext();},st.auto);
  if(st.cam==='slot'){const s0=tutSlot();camTo(1.7,s0?s0.x:GX,s0?s0.y:H/2);}
  else if(st.cam==='big'){const e=bigOne(),p=e?posE(e):null;if(p)camTo(1.5,p.x,Math.max(p.y,200));else camReset();}
  else if(st.cam==='tower'){const s0=tutTower()||tutSlot();camTo(1.35,s0?s0.x:GX,s0?s0.y:H/2);}
  else if(st.cam)camTo(st.cam[0],st.cam[1],st.cam[2]);
  else camReset();
  tutPulse();
}
function tutAdvance(){if(!G.tut)return;G.paused=false;G.tut.i++;if(G.tut.i>=(G.tut.steps||TUT_STEPS).length){tutFinish();return;}applyTut();}
function tutNext(){tutAdvance();}
function tutEvent(kind,arg){
  if(!G.tut)return;const st=TS();if(!st||!st.want||G.tut.hold)return;
  const p=st.want.split(':');if(p[0]!==kind)return;if(p[1]&&arg!==p[1])return;
  tutAdvance();
}
/* every frame: finished conditions, the skip button, lessons waiting their turn */
const tutSkipEl=document.createElement('button');tutSkipEl.id='tutSkip';tutSkipEl.type='button';tutSkipEl.hidden=true;$('#stage').appendChild(tutSkipEl);
tutSkipEl.addEventListener('click',ev=>{ev.stopPropagation();if(!G.tut)return;if(G.tut.skipArm){skipTutorial();return;}G.tut.skipArm=performance.now();SFX.play('tap');});
function tutFrame(dt){
  const on=!!(G.tut&&G.state==='play'&&overlay.classList.contains('hidden')&&!sheet.classList.contains('open'));
  if(tutSkipEl.hidden===on)tutSkipEl.hidden=!on;
  if(on){if(G.tut.skipArm&&performance.now()-G.tut.skipArm>2600)G.tut.skipArm=0;const lbl=G.tut.skipArm?'Tap again to skip':(G.tut.key==='tut'?'Skip tutorial':'Skip lesson');if(tutSkipEl.textContent!==lbl)tutSkipEl.textContent=lbl;}
  if(G.tut&&G.state==='play'&&!G.tut.hold){const st=TS();if(st&&st.cond&&st.cond())tutAdvance();}
  lessonTick(dt);
}
function drawHint(now,st){
  /* action steps: the explanation (for the first 14 s of the step) and, in gold, what to do now */
  const act=tutText(st.hint)||'';let ex=(st.t&&G.tut&&now-(G.tut.t0||0)<14000)?tutText(st.t):'';if(ex===act)ex='';
  if(!act&&!ex)return;
  const maxW=W-60,wrap=(txt,font)=>{ctx.font=font;const meas=t=>{const m=ctx.measureText(t);return m&&m.width||t.length*6.6;};if(!txt)return[];const ws=txt.split(' '),out=[];let cur='';for(const w of ws){const t=cur?cur+' '+w:w;if(meas(t)>maxW&&cur){out.push(cur);cur=w;}else cur=t;}if(cur)out.push(cur);return out.map(l=>[l,meas(l)]);};
  const FE='500 13px "EB Garamond",serif',FA='700 13.5px "EB Garamond",serif';
  const le=wrap(ex,FE),la=wrap(act,FA);
  const wpx=Math.min(W-20,Math.max(...le.map(x=>x[1]),...la.map(x=>x[1]),60)+32),hpx=14+le.length*16+(le.length&&la.length?6:0)+la.length*17;
  const x0=(W-wpx)/2,puls=0.86+0.14*Math.sin(now/420);
  ctx.globalAlpha=puls;
  ctx.fillStyle='rgba(10,18,32,0.93)';rr(ctx,x0,10,wpx,hpx,10);ctx.fill();
  ctx.strokeStyle='rgba(227,182,97,0.9)';ctx.lineWidth=1.4;rr(ctx,x0,10,wpx,hpx,10);ctx.stroke();
  ctx.textAlign='center';let y=29;
  ctx.font=FE;ctx.fillStyle='#e9dfc6';for(const [l] of le){ctx.fillText(l,W/2,y);y+=16;}
  if(le.length&&la.length){ctx.strokeStyle='rgba(227,182,97,0.35)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0+14,y-9);ctx.lineTo(x0+wpx-14,y-9);ctx.stroke();y+=6;}
  ctx.font=FA;ctx.fillStyle='#ffd76a';for(const [l] of la){ctx.fillText(l,W/2,y);y+=17;}
  ctx.globalAlpha=1;
}
/* where to look: a bobbing marker on the map, or an arrow at the edge pointing to a button */
function drawTutPointer(now){
  const st=TS();if(!st||G.tut.hold&&!st.focus)return;
  const w=tutWantBase(),map=G.map;let tg=null;
  if(!G.tut.hold){
    if(!RING){
      if(w==='build')tg=tutSlot();
      else if(w==='upgrade'||w==='info')tg=tutTower();
      else if(w==='sell')tg=G.lastBuilt&&G.lastBuilt.tower?G.lastBuilt:tutTower();
      else if(w==='rally'&&G.armed!=='rally')tg=map.slots.find(s=>s.tower&&TOWERS[s.tower.type].kind==='barracks')||null;
    }
    if(w==='move'&&G.hero&&G.heroOn&&!G.hero.dead&&!G.heroSel)tg={x:G.hero.x,y:G.hero.y};
    else if(w==='call')tg=canCall()?spawnMark():null;
    else if(w==='shot')tg=map.slots.find(s=>s.tower)||null;
    else if(w==='hodor'){const at=G.hod?G.hod.at:0,gi=map.gates.findIndex((g,i)=>i!==at);if(gi>=0)tg={x:map.gates[gi].x,y:GATE_Y+14};}
  }
  if(tg){
    const p=CAM.z===1?tg:{x:(tg.x-CAM.x)*CAM.z+W/2,y:(tg.y-CAM.y)*CAM.z+H/2};
    const a=0.45+0.45*Math.sin(now/220);
    ctx.strokeStyle='rgba(255,215,106,'+a+')';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.ellipse(p.x,p.y+3,21*CAM.z,10*CAM.z,0,0,Math.PI*2);ctx.stroke();
    const bob=Math.sin(now/300)*3;
    ctx.fillStyle='rgba(255,215,106,'+(0.6+0.4*Math.sin(now/220))+')';ctx.strokeStyle='rgba(10,18,32,.8)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(p.x,p.y-16+bob);ctx.lineTo(p.x-8,p.y-30+bob);ctx.lineTo(p.x+8,p.y-30+bob);ctx.closePath();ctx.fill();ctx.stroke();
  }
  const fsel=st.focus||TUT_BTN[w];if(fsel)drawFocusArrow(now,fsel);
}
function drawFocusArrow(now,sel){
  const el=document.querySelector(sel);if(!el)return;const r=el.getBoundingClientRect(),c=canvas.getBoundingClientRect();if(!r.width)return;
  const up=r.bottom<=c.top+6,down=r.top>=c.bottom-6;if(!up&&!down)return;
  const x=clamp(((r.left+r.right)/2-c.left)/scale,16,W-16),bob=Math.abs(Math.sin(now/260))*6;
  const y=up?6+bob:H-6-bob,d=up?1:-1;
  ctx.save();ctx.fillStyle='#ffd76a';ctx.strokeStyle='#0b1a2e';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-12,y+16*d);ctx.lineTo(x-5,y+16*d);ctx.lineTo(x-5,y+30*d);ctx.lineTo(x+5,y+30*d);ctx.lineTo(x+5,y+16*d);ctx.lineTo(x+12,y+16*d);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
