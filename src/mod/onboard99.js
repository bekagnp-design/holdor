/* =========================== THE FIRST MINUTES (v1.0.99) ===========================
   A tester: "too much happens at the start". So: the house is chosen and the first battle begins by itself (the home comes after the
   first win); in that battle a Watchtower already stands by the door and the player learns eight things, one at a time (call, watch,
   build, move, the champion's skill, upgrade, a spell, hold) — selling, the ⓘ card, speed, pause and the book became short lessons on
   stages 2–6; the champion's card and skill sit in their own frame at the bottom ("YOUR CHAMPION"), the spells in theirs; and the
   home opens gradually: the chests after stage 1, Army after 1, the Shop and the Tasks pill after 2, the Hold card after 2 (locked
   until 3), Clan and the event pill after 3. Locked tabs show a 🔒 and the stage; a tap on one only says so. The home tour shows only what is
   on the screen now; the chests, Tasks and Clan get a short lesson when they appear. The realm screen
   preselects the realm from the Telegram language, so it is one tap. Injected after the home, so hubTabs / hubHome / homeStrip here
   replace v1.0.98's. */
const OB_NEED={coll:1,shop:2,clan:3};
const OB_LANG={ka:'Georgia',en:'United States',de:'Germany',fr:'France',it:'Italy',ru:'Russia',es:'Spain',pt:'Brazil',tr:'Turkey',uk:'Ukraine',ja:'Japan',zh:'China',hi:'India',ar:'Saudi Arabia',pl:'Poland',nl:'Netherlands',ko:'South Korea',id:'Indonesia',vi:'Vietnam',th:'Thailand',fa:'Iran',he:'Israel',kk:'Kazakhstan',az:'Azerbaijan',hy:'Armenia',uz:'Uzbekistan',el:'Greece',cs:'Czechia',ro:'Romania',hu:'Hungary',sv:'Sweden',no:'Norway',da:'Denmark',fi:'Finland',bg:'Bulgaria',sr:'Serbia',hr:'Croatia',sk:'Slovakia',lt:'Lithuania',lv:'Latvia',et:'Estonia',ms:'Malaysia',tl:'Philippines',bn:'Bangladesh',ur:'Pakistan',sw:'Kenya'};
function obStage(){return ACC?(ACC.sv?Math.max(0,cleared()-3):cleared()):0;}   /* the story flow (v1.1.3): the castle opens after stage 3, then one part a stage */
function hubLocked(k){return !!(OB_NEED[k]&&ACC&&!(ACC.tut&&obStage()>=OB_NEED[k]));}
function obGuessRealm(){try{const u=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user,lc=String((u&&u.language_code)||navigator.language||'').slice(0,2).toLowerCase(),c=OB_LANG[lc];if(!c)return null;const j=LANGS.findIndex(L=>L.c===c);return j>=0?j:null;}catch(e){return null;}}
/* ---------- the tabs, with locks ---------- */
function hubTabs(on){const t=[['shop','Shop'],['coll','Army'],['battle','Battle'],['clan','Clan']];
  const fr=typeof tkReady==='function'&&typeof tasksOn==='function'&&tasksOn()?tkReady('friends'):0;
  const dot={shop:freeChestReady()||starChestsReady()>0,coll:typeof bookNewCount==='function'&&bookNewCount()>0,battle:starChestsReady()>0||(onlineOpen()&&ACC.online.attempts>0&&!(ACC.online.runs||[]).length),clan:fr>0};
  const sel=HUB_HIDDEN[on]?'battle':on;
  return `<div class="hubtabs four">${t.map(([k,n])=>{const lk=hubLocked(k);return `<button class="${k===sel?'on':''} ${k==='battle'?'mid':''} ${lk?'lock':''}" data-tab="${k}"${lk?` data-lock="${OB_NEED[k]}"`:''}>${HUB_ICON[k]}${n}${lk?`<i class="lk">🔒 ${OB_NEED[k]}</i>`:dot[k]?'<span class="dot"></span>':''}</button>`;}).join('')}</div>`;}
function hubLockSay(k){SFX.play('deny');ecoToast(`🔒 ${k==='coll'?'Army':k==='shop'?'The Shop':'Clan'} opens after stage ${OB_NEED[k]}${ACC&&!ACC.tut?' — win your first battle first':''}`);}
/* ---------- the home, piece by piece ---------- */
function homeStrip(){const n=obStage(),R=myRank(),e=evAt(Date.now()),K=EVT_KIND[e.kind],left=e.active?e.t1-Date.now():e.t0-Date.now(),tk=typeof tasksReady==='function'?tasksReady():0;
  return `<div class="hmstrip"><button class="hpill" id="hubTro">${rankSVG(R.t,20,R.div)}<b>${trophiesOf()}</b></button>
    ${n>=2?`<button class="hpill tk ${tk?'hot':''}" id="bTasks">${icon('quests',18)}<b>Tasks</b>${tk?`<i class="dot">${tk}</i>`:''}</button>`:''}
    ${n>=3?`<button class="hpill ev ${e.active?'on':''}" id="evBadge" data-t="${e.active?e.t1:e.t0}" data-a="${e.active?1:0}">${K.e}<b>${K.n}</b><em>${e.active?'ends in':'in'} ${evLeft(left)}</em></button>`:''}</div>`;}
function hubHome(){const hh=HOUSES[ACC.house],n=obStage(),tut=!!ACC.tut;
  return `${tut?homeStrip():''}${tut&&n>=1?`<div class="hmslots top">${homeSlots().replace(/^<div class="hmslots">/,'').replace(/<\/div>$/,'')}</div>`:''}
    <div class="hmstage st-b" id="hmStage">${hmStageB()}<div class="hmtitle"><b>${hh.seat}</b></div>${homeGoal()}</div>
    ${tut&&n>=2?homeHold():''}${homeBattleRow()}
    ${tut?'':'<div class="hint">▲ TAP BEGIN — YOUR CHAMPION WILL TEACH YOU</div>'}${ACC.refund?`<div class="hint" id="refundNote">🪙 Tower upgrades are now tower levels — ${ACC.refund} gold refunded. Army → Towers.</div>`:''}`;}
/* ---------- the first battle: a Watchtower already stands by the door ---------- */
function tutPrebuild(){if(!G.map||!G.tutorial)return;const R=G.map.routes[0],q=posAt(G.map,R.total*0.82,0);
  const s=G.map.slots.filter(x=>!x.tower).sort((a,b)=>dist(a.x,a.y,q.x,q.y)-dist(b.x,b.y,q.x,q.y))[0];if(!s)return;
  const g0=G.gold;G.gold+=costOf('watch');build(s,'watch');G.gold=g0;if(s.tower){s.tower.cd=0;s.tower.face=-Math.PI/2;}G.tutPre=s.id;}
/* ---------- the home tour, staged: only what is on the screen now; what appears later comes as a short lesson when it does ---------- */
TOURS.battle=()=>{const n=obStage(),L=learnMap();if(n>=1)L.chests=1;if(n>=2)L.tasks=1;return [
  {sel:'.hubtop .cur',wait:()=>!!$('#bBattle'),text:'<b>Gold</b> 🪙 and <b>cards</b> level up your champions, towers and spells. <b>Dragonglass</b> 💎 opens chests and buys deals. Battles pay both.'},
  {sel:'#hubAva',text:'This is you: your champion\'s face and your <b>level</b>. Every upgrade you buy adds to it, and every level pays a chest. Tap it later for settings and the book.'},
  {sel:'.hmgoal',text:'Your road north: the next stage, its stars and how far you are of fifty. Tap it to open the map.'},
  n>=1?{sel:'.hmslots',text:'Four chests: <b>stars</b> fill the first, <b>levels</b> the second, the third is <b>free</b> every day and the fourth is <b>today\'s gift</b>. Something is always on its way.'}:null,
  n>=2?{sel:'#bTasks',text:'<b>Tasks</b>: daily, weekly and monthly quests, social tasks and <b>friends</b> — every one pays a gift.'}:null,
  {sel:'#bBattle',tap:1,text:'<b>BATTLE!</b> opens the map at your next stage. Tap it.'}];};
/* only for accounts that began with the staged home (tutv 99): older ones had the full tour */
function obNew(){return !!(ACC&&ACC.tutv>=99);}
Object.assign(HUB_LESSONS,{
 chests:{need:()=>obNew()&&obStage()>=1,steps:()=>[{sel:'.hmslots',text:'Your chests: <b>stars</b> fill the first, <b>levels</b> the second, the third is <b>free</b> every day and the fourth is <b>today\'s gift</b>. Something is always on its way.'}]},
 tasks:{need:()=>obNew()&&obStage()>=2,steps:()=>[{sel:'#bTasks',text:'<b>Tasks</b> are open: daily, weekly and monthly quests, social tasks and <b>friends</b> — every one pays a gift.'}]},
 clan:{need:()=>obNew()&&obStage()>=3,steps:()=>[{sel:'.hubtabs button[data-tab="clan"]',text:'<b>Clan</b> is open: your realm\'s chat, the realm war and your friends.'}]},
});
{const n0=HUB_LESSONS.champ.need;HUB_LESSONS.champ.need=()=>!hubLocked('coll')&&n0();}
/* ---------- what left the first battle: short lessons on the next stages (for those who finished the new tutorial) ---------- */
function obLessonOn(n){return !!(ACC&&ACC.tutv>=99&&cleared()>=n);}
Object.assign(LESSONS,{
 sell:{need:()=>obLessonOn(1),ready:()=>G.map.slots.filter(s=>s.tower).length>=2&&!G.enemies.some(e=>e.hp>0),steps:[
  {t:'Built in the wrong spot? Sell a tower and 60% of its gold comes back. Tap a tower, then 💰 and ✓.',pose:'point',want:'sell',ring:['sell'],pause:1,hint:()=>ringHint('Tap a tower','Tap 💰 to sell it','Tap ✓ to sell')}]},
 info:{need:()=>obLessonOn(2),ready:()=>G.map.slots.some(s=>s.tower),steps:[
  {t:'Want the numbers? Tap a tower, then ⓘ. Close the card with ✖ when you have read it.',pose:'point',want:'info',ring:['info'],pause:1,
   hint:()=>sheet.classList.contains('open')?'These are its numbers. Tap ✖ to close the card':ringHint('Tap a tower','Tap ⓘ Info',''),cond:()=>G.tutInfo&&!sheet.classList.contains('open')}]},
 speed:{need:()=>obLessonOn(3),ready:()=>G.enemies.some(e=>e.hp>0),steps:[
  {t:'Too slow? This button hurries the battle: 2×, then 4×, then back to 1×. Tap it.',pose:'point',want:'speed',focus:'#bSpeed',hint:'Tap 1× at the top right'}]},
 pause:{need:()=>obLessonOn(4),ready:()=>true,steps:[
  {t:'Pause stops everything: resume, start the stage again or leave. Tap ⏸, then Resume.',pose:'point',want:'pause',focus:'#bPause',hint:'Tap ⏸ at the top right, then Resume'}]},
 book:{need:()=>obLessonOn(5),ready:()=>true,steps:[
  {t:'The ! opens the book: every enemy you have met, your towers, field notes. Open it, look, then close it.',pose:'point',want:'book',focus:'#bInfo',hint:'Tap ! at the top, then close the book',cond:()=>G.tutBook&&overlay.classList.contains('hidden')}]},
});
