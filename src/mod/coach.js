/* =========================== COACH MARKS (v1.0.47) ===========================
   A guided tour over the menus: everything but the highlighted thing is dimmed and blocked; a bubble explains it.
   Step: sel (CSS selector or fn → element) · text (or fn(el)) · tap (the player taps the thing itself; otherwise "Next")
   · alt (text when the thing is disabled — then it becomes a "Next" step) · wait (fn → ready to show) · go (fn run instead of the tap) */
const COACH={on:false,steps:null,i:0,done:null,el:null,t0:0,tgt:null,shown:false};
function coachEl(){
  if(COACH.el)return COACH.el;const el=document.createElement('div');el.id='coach';el.hidden=true;
  el.innerHTML='<div class="cb" data-k="t"></div><div class="cb" data-k="b"></div><div class="cb" data-k="l"></div><div class="cb" data-k="r"></div><div class="ch"></div><div class="cbub"><span class="cav"></span><div class="ctx"><p></p><div class="cact"><button type="button" class="cskip">Skip tour</button><span class="cstep"></span><button type="button" class="cnext">Next ▸</button><span class="ctap">👆 Tap it</span></div></div></div>';
  $('#app').appendChild(el);COACH.el=el;
  el.querySelector('.cnext').addEventListener('click',ev=>{ev.stopPropagation();SFX.play('tap',60);coachNext();});
  el.querySelector('.cskip').addEventListener('click',ev=>{ev.stopPropagation();coachEnd(true);});
  el.querySelector('.ch').addEventListener('click',ev=>{ev.stopPropagation();});
  return el;}
function coachStart(steps,done){if(!steps||!steps.length)return;coachEl();COACH.on=true;COACH.steps=steps;COACH.i=0;COACH.done=done||null;COACH.t0=performance.now();COACH.shown=false;COACH.el.hidden=false;if(!COACH.raf)COACH.raf=requestAnimationFrame(coachLoop);}
function coachEnd(skipped){const d=COACH.done;COACH.on=false;COACH.steps=null;COACH.tgt=null;if(COACH.el)COACH.el.hidden=true;COACH.done=null;if(d)d(!!skipped);}
function coachNext(){if(!COACH.on)return;COACH.i++;COACH.t0=performance.now();COACH.shown=false;if(COACH.i>=COACH.steps.length)coachEnd(false);}
function coachStep(){return COACH.on?COACH.steps[COACH.i]:null;}
function coachFind(st){const e=typeof st.sel==='function'?st.sel():document.querySelector(st.sel);return e&&e.getBoundingClientRect().width>0?e:null;}
function coachLoop(){
  COACH.raf=0;if(!COACH.on)return;COACH.raf=requestAnimationFrame(coachLoop);
  const st=coachStep(),el=COACH.el;if(!st)return;
  const tgt=(st.wait&&!st.wait())?null:coachFind(st),busy=!!document.querySelector('.tutm')||(!!document.querySelector('#cer')&&!$('#cer').hidden&&$('#cer').innerHTML!=='');
  if(!tgt||busy||performance.now()-COACH.t0<120){el.classList.add('wait');COACH.tgt=null;return;}
  el.classList.remove('wait');COACH.tgt=tgt;
  const A=$('#app').getBoundingClientRect(),r=tgt.getBoundingClientRect(),pad=6;
  let x0=Math.max(0,r.left-A.left-pad),y0=Math.max(0,r.top-A.top-pad),x1=Math.min(A.width,r.right-A.left+pad),y1=Math.min(A.height,r.bottom-A.top+pad);
  const set=(k,css)=>{const b=el.querySelector('.cb[data-k="'+k+'"]');Object.assign(b.style,css);};
  set('t',{left:'0',top:'0',width:'100%',height:y0+'px'});set('b',{left:'0',top:y1+'px',width:'100%',height:Math.max(0,A.height-y1)+'px'});
  set('l',{left:'0',top:y0+'px',width:x0+'px',height:(y1-y0)+'px'});set('r',{left:x1+'px',top:y0+'px',width:Math.max(0,A.width-x1)+'px',height:(y1-y0)+'px'});
  const ch=el.querySelector('.ch');Object.assign(ch.style,{left:x0+'px',top:y0+'px',width:(x1-x0)+'px',height:(y1-y0)+'px'});
  const dis=!!tgt.disabled,tapMode=!!st.tap&&!dis;
  ch.classList.toggle('block',!tapMode);
  const bub=el.querySelector('.cbub');
  if(!COACH.shown){COACH.shown=true;
    const txt=dis&&st.alt?st.alt:(typeof st.text==='function'?st.text(tgt):st.text);
    bub.querySelector('p').innerHTML=txt;bub.classList.toggle('tapmode',tapMode);
    const n=COACH.steps.length;bub.querySelector('.cstep').textContent=(COACH.i+1)+' / '+n;
    const c=CBY[ACC&&ACC.sel],pu=c&&CHAMP_ART[c.id+'_portrait'];bub.querySelector('.cav').innerHTML=pu?`<img src="${pu}" alt="">`:(c?c.e:'🛡️');
    bub.classList.remove('pop');void bub.offsetWidth;bub.classList.add('pop');}
  const bh=bub.offsetHeight,below=(y0+y1)/2<A.height*0.5;
  let by=below?y1+12:y0-12-bh;by=clamp(by,8,Math.max(8,A.height-bh-8));
  bub.style.top=Math.round(by)+'px';
}
/* taps on the highlighted thing: let the game handle them, then move on (or run the step's own action instead) */
document.addEventListener('click',ev=>{
  const st=coachStep();if(!st||!COACH.tgt||!st.tap||COACH.tgt.disabled)return;
  if(!COACH.tgt.contains(ev.target))return;
  if(st.go){ev.stopPropagation();ev.preventDefault();st.go();}
  setTimeout(coachNext,30);
},true);
/* ---- short tours (v1.0.48): three steps after the first battle, then a few on each tab the first time it opens ---- */
function toursOf(a){const A=a||ACC;if(!A.tours||typeof A.tours!=='object')A.tours={};if(A.tour&&!A.tours.win){A.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};}return A.tours;}
const TOURS={
 win:()=>[
  {sel:'#tvStars',text:'<b>Stars</b> show how well you held: three if the door kept more than 70%, two above 35%. Replay a stage any time to win the stars you missed.'},
  {sel:'#tvRew',text:'Every win pays <b>gold</b>. New stars pay <b>dragonglass</b> 💎, and every three stars fill a chest.'},
  {sel:'#bGo',tap:1,text:'After a normal stage a big <b>NEXT</b> button takes you straight on. Now to your castle.'}],
 battle:()=>[
  {sel:'.hubtop .cur',wait:()=>!!$('#bBattle'),text:'<b>Gold</b> 🪙 and <b>cards</b> level up your champions, towers and spells. <b>Dragonglass</b> 💎 opens chests and buys deals. Battles pay both.'},
  {sel:'#hubAva',text:'This is you: your champion\'s face and your <b>level</b>. Every upgrade you buy adds to it, and every level pays a chest. Tap it later for settings and the book.'},
  {sel:'.tro',text:'Your road north: fifty stages, and the stars you have won. Every three stars fill the chest below it — chests hold gold, dragonglass and cards.'},
  {sel:'#bBattle',tap:1,text:'<b>BATTLE!</b> opens the map at your next stage. Tap it.'}],
 coll:()=>[
  {sel:'.subtabs',text:'<b>Collection</b>: your loadout, champions, towers and spells. Each one is a card — collect copies from chests, then pay gold to raise its level.'},
  {sel:'.deckrow .ccard[data-c]',text:'Your champion. The bar shows cards collected toward the next level; a green arrow means it is ready. Tap a champion later for skills and talents.'},
  {sel:()=>document.querySelector('.hubbody .cgrid .ccard[data-t="watch"]'),tap:1,text:'Towers keep a permanent level too. Tap the <b>Watchtower</b>.'},
  {sel:'#clist button[data-a="tl"]',tap:1,text:'When the bar is full, tap here: cards + gold = one level, +3% power. Levels 4, 8, 12 and 16 bring a bonus.',alt:'Not enough cards yet — chests fill the bar. Every level adds 3% power, and levels 4, 8, 12 and 16 bring a bonus.'},
  {sel:'#bBack',tap:1,text:'Back to the collection.'}],
 shop:()=>[
  {sel:'.shopgrid.deals',text:'Six <b>deals</b> every six hours: gold, dragonglass, cards. The first is always free; dragonglass unlocks the last three.'},
  {sel:()=>document.querySelectorAll('.hubbody .shopgrid')[1]||null,text:'<b>Chests</b> hold gold, dragonglass and card stacks — the rarer the chest, the rarer the cards. The wooden one is free once a day.'}],
 hold:()=>[onlineOpen()?{sel:'#bHold',text:'<b>Hold</b>: one map for the whole world each day, three tries, endless waves. Your best wave counts for your realm and your house.'}
  :{sel:'.lockbanner',text:'The daily <b>Hold</b> opens after stage '+ONLINE_AT+'. Until then you can watch the standings below.'}],
 events:()=>[
  {sel:()=>document.querySelector('.hubbody .evcard'),text:'<b>Events</b>: the daily Hold is live; wars between the houses and seasons come later. Realm and house standings are below.'}],
};
function startTour(){const T=toursOf();if(T.win)return;coachStart(TOURS.win(),()=>{T.win=1;persist();});}
function hubTour(tab){if(COACH.on||!ACC||!ACC.tut||CLOUD.screen!=='hub:'+tab)return;const T=toursOf();
  if(!T[tab]&&TOURS[tab]){const steps=TOURS[tab]().filter(Boolean);if(steps.length){coachStart(steps,()=>{T[tab]=1;persist();});return;}}
  if(tab==='battle')hubLessons();}
/* ---- small tours when something opens in the menus ---- */
const HUB_LESSONS={
 chest:{need:()=>starChestsReady()>0,steps:()=>[{sel:'#starChest',tap:1,text:'Your first chest is ready! Tap it to open it.'}]},
 hold:{need:()=>onlineOpen(),steps:()=>[{sel:`.hubtabs button[data-tab="hold"]`,tap:1,text:'<b>Hold</b> is open — the daily siege for the whole world. Tap it.'}]},
 champ:{need:()=>CHAMPS.filter(c=>c.house===ACC.house&&unlocked(null,c)).length>1,steps:()=>[{sel:`.hubtabs button[data-tab="coll"]`,tap:1,text:'A new champion has joined your house! Tap <b>Collection</b>.'},
   {sel:'.subtabs button[data-sub="heroes"]',tap:1,text:'Tap <b>Champions</b> to meet them — and to choose who rides with you.'}]},
};
function hubLessons(){
  if(COACH.on||!ACC||!ACC.tut||!$('#bBattle'))return;
  const L=learnMap();
  for(const k in HUB_LESSONS){if(L[k]||!HUB_LESSONS[k].need())continue;
    coachStart(HUB_LESSONS[k].steps(),()=>{learnMap()[k]=1;persist();});return;}}
