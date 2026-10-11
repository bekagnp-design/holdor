/* =========================== THE INTERFACE ARRIVES ONE PIECE AT A TIME (v1.1.4) ===========================
   For accounts made in the story flow even the buttons are introduced, not dumped: in battle the speed button comes with its lesson and
   the book button after it; on the home the map and champion buttons wait for the Army, the chests and the tabs pop out of the dark
   the first time they open — with a ring of light, so the eye goes there. The coach bubble shows a small looping picture (a tapping
   finger, a rocking chest, a growing bar) instead of a face when a step asks for one. Older accounts see everything, as before. */
const UIR={speed:3,info:5};   /* stages held before the button's own lesson (obLessonOn) */
function uiSeen(k){return !!(ACC&&ACC.ui&&ACC.ui[k]);}
function uiMark(k){if(!ACC)return;if(!ACC.ui)ACC.ui={};ACC.ui[k]=1;persist();}
function uiHud(){const a=$('#app');if(!a)return;const sv=!!(ACC&&ACC.sv),L=sv?learnMap():null;
  a.classList.toggle('g-nospeed',!!(sv&&!L.speed&&cleared()<UIR.speed&&!uiSeen('hudspeed')));
  a.classList.toggle('g-noinfo',!!(sv&&!L.book&&cleared()<UIR.info&&!uiSeen('hudinfo')));}
function uiPop(el){if(!el)return;el.classList.remove('pop-in');void el.offsetWidth;el.classList.add('pop-in');setTimeout(()=>el.classList.remove('pop-in'),2800);}
{const sg0=startGame0;startGame0=function(o){const r=sg0(o);uiHud();return r;};
 const ls0=lessonStart;lessonStart=function(k){if(ACC&&ACC.sv&&(k==='speed'||k==='book')){uiMark(k==='speed'?'hudspeed':'hudinfo');uiHud();uiPop($(k==='speed'?'#bSpeed':'#bInfo'));}return ls0(k);};
 const sc0=stClass;stClass=function(){sc0();uiHud();};}
/* the home: what is still asleep stays out of sight; what just woke up pops */
function uiHome(){if(!ACC||!ACC.sv||!ACC.castle)return;const hub=card.querySelector('.hub');if(!hub)return;const n=obStage();
  hub.classList.toggle('g-noarmy',n<1);
  const wake=[['army',n>=1,['#bMapH','#bChampH','.hmslots','.hubtabs button[data-tab="coll"]']],['shop',n>=2,['.hubtabs button[data-tab="shop"]','#bTasks']],['clan',n>=3,['.hubtabs button[data-tab="clan"]','#evBadge','#hmHold']]];
  wake.forEach(([k,on,sels])=>{if(on&&!uiSeen('home_'+k)){sels.forEach(q=>hub.querySelectorAll(q).forEach((e,i)=>{e.style.animationDelay=(i*0.12)+'s';uiPop(e);}));uiMark('home_'+k);SFX.play('unlock');}});}
{const sh1=showHub;showHub=function(tab,sub){
  if(ACC&&ACC.sv&&ACC.castle&&!FILM.on&&!RV.on&&!stBeat()&&(!tab||tab==='battle')){const r=rvDue();if(r){revealChampion(r.id,r.kind,()=>showHub(tab,sub));return;}}
  const out=sh1(tab,sub);if(!FILM.on&&!RV.on)uiHome();return out;};}
/* little looping pictures for the coach bubble */
const GANIM={
 tap:'<span class="ga ga-tap"><i></i><b></b></span>',
 chest:'<span class="ga ga-chest">🎁</span>',
 up:'<span class="ga ga-up"><i></i><b>⬆</b></span>',
 cards:'<span class="ga ga-cards"><i>🃏</i><i>🃏</i><i>🃏</i></span>',
 lock:'<span class="ga ga-lock"><i>🔒</i><b>🔓</b></span>',
 coin:'<span class="ga ga-coin">🪙</span>',
 skill:'<span class="ga ga-skill">✨</span>'};
