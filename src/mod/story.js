/* =========================== THE STORY FLOW (v1.1.3) ===========================
   A tester: "too much happens at the start". A new account never sees a menu at first. The first minutes are a thriller told in short
   films (film.js, the script in src/story/story.json) between battles, and the tutorial speaks in the story's voice:
     house → F0 "Seven Hours" → the tutorial battle → F1 → stage 1 → F2 → stage 2 → F3 → stage 3 → F4 "The War Room": the castle (the
     menu) opens for the first time → later a short film each time a part of it opens: F5 the Army (stage 4), F6 the Shop (stage 5),
     F7 the Clan (stage 6). Before the castle, every road to the menu leads back into the story (showHub is intercepted), the result
     screens have one button, the pause menu has no "Leave", the book button is hidden. Accounts made before v1.1.3 are not touched.
     `ACC.sv` = made in the story flow · `ACC.castle` = the menu has opened · `ACC.film` = films seen · `ACC.tutWon` = the first night held. */
const STORY=STORY_DATA;
STORY.films.forEach(f=>{FILMS[f.id]=f;});
function stOn(){return !!(ACC&&ACC.sv&&!ACC.castle);}
function stSeen(k){return !!(ACC&&ACC.film&&ACC.film[k]);}
function stMark(k){if(!ACC)return;if(!ACC.film)ACC.film={};ACC.film[k]=1;persist();}
function stClass(){const a=$('#app');if(a)a.classList.toggle('prestory',stOn());}
function stPlay(id,then){if(!FILMS[id]){then();return;}filmPlay(id,()=>{stMark(id);then();});}
/* a plain card under the next battle: if the battle cannot start (no connection, energy, a server refusal) the player lands here with Continue, never on the seat screen */
function stGo(start,h,sub){show(`<h1>${h}<small>${sub}</small></h1><button class="btn" id="bStGo"><span class="e">▶</span> Continue</button>`);CLOUD.screen='story';const b=$('#bStGo');if(b)b.addEventListener('click',()=>{SFX.play('tap',60);start();});start();}
/* where the story goes next (true = it took over the screen) */
function storyNext(){if(!stOn())return false;stClass();if(FILM.on)return true;
  if(!ACC.intro){ACC.intro=1;persist();}
  if(!ACC.tutWon){const go=()=>stGo(()=>startTutorial(),'The first night','Sunspear');if(!stSeen('f0'))stPlay('f0',go);else go();return true;}
  const L=nextStage();
  if(L.id>=4){stPlay('f4',()=>{ACC.castle=1;persist();stClass();showHub('battle');});return true;}
  const fid='f'+L.id,go=()=>stGo(()=>startGame({mode:'campaign',level:L}),'Stage '+L.id,L.n);
  if(!stSeen(fid))stPlay(fid,go);else filmCard('STAGE '+L.id,L.n,go);
  return true;}
/* the hub, the menu, is the castle: not before it opens; and a part of it that just opened gets its short film */
function stBeat(){if(!ACC||!ACC.sv||!ACC.castle)return null;const n=cleared();return n>=4&&!stSeen('f5')?'f5':n>=5&&!stSeen('f6')?'f6':n>=6&&!stSeen('f7')?'f7':null;}
function stBeatChain(then){const b=stBeat();if(!b){then();return;}stPlay(b,()=>stBeatChain(then));}   /* every film that is due, one after the other */
{const sh0=showHub;showHub=function(tab,sub){
  if(ACC&&ACC.sv&&!ACC.castle&&storyNext())return;
  if(!FILM.on&&(!tab||tab==='battle')&&stBeat()){stBeatChain(()=>sh0(tab,sub));return;}
  return sh0(tab,sub);};
 const sc0=showCampaign;showCampaign=function(){if(stOn()&&storyNext())return;return sc0.apply(this,arguments);};
 /* a duel link waits until the castle has been seen */
 const dpo0=duelPendingOpen;duelPendingOpen=function(){if(ACC&&ACC.sv&&obStage()<1)return;return dpo0();};}
/* result screens before the castle: one road, forward */
{const r0=showCampaignResult;showCampaignResult=function(win,stars,nu,gained){r0(win,stars,nu,gained);if(!stOn())return;
  ['#bUp','#bMap','#bShare','#bHero','#bHard','#bDiff2'].forEach(q=>{const e=$(q);if(e)e.remove();});
  const row=card.querySelector('.resrow');if(row&&!row.children.length)row.remove();
  if(win){let bn=$('#bNext');const keep=cleared()>=3;
    if(!bn){bn=document.createElement('button');bn.className='btn nextbig';bn.id='bNext';bn.innerHTML='<span class="nx">NEXT ▸</span>';(card.querySelector('.resrow')||card.lastElementChild||card).before(bn);}
    const nb=bn.cloneNode(true);bn.replaceWith(nb);if(keep)nb.innerHTML='<span class="nx">ENTER THE KEEP ▸</span><small>Something is waiting inside</small>';
    nb.addEventListener('click',()=>{SFX.play('tap',60);storyNext();});}};}
/* the pause menu has no way out of the story; the tutorial victory screen says "Continue" and tells no more than it must */
{const p0=showPause;showPause=function(){p0();if(stOn()){const q=$('#pQ');if(q)q.remove();}};}
/* the tutorial speaks in the story's voice (only for accounts made in the story flow) */
TUT_STEPS.forEach((st,i)=>{const l=STORY.tutorial_lines[i];if(!l)return;const o=st.t;
  st.t=()=>ACC&&ACC.sv?fTok(l).replace(/\{SKILL\}/g,G.hero&&G.hero.c&&SK[G.hero.c.sk[2]]?SK[G.hero.c.sk[2]].n:'their skill'):tutText(o);});
/* the first calendar and event popups wait until the Shop and the Tasks open */
{const dp0=dailyPopupCheck;dailyPopupCheck=function(){if(ACC&&ACC.sv&&obStage()<2)return;return dp0();};
 const ep0=evPopupCheck;evPopupCheck=function(){if(ACC&&ACC.sv&&obStage()<3)return;return ep0();};}
