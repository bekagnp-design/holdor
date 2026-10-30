/* v1.2.6: the champion learns in battle. Before waves 3, 6, 9, 12 and 15 of a campaign battle (from stage 5) the fight stops and the champion
   may learn one of three skills — any skill of any champion that works on its own (no ultimates). A skill he already has goes up a rank.
   It lasts for this battle (hero.perk, the same hand that gear perks use). The three on offer come from the stage, the wave and the run. */
const LEARN={at:[2,5,8,11,14],minStage:5};
function learnPool(){return Object.keys(SK).filter(id=>!SK[id].ult&&id!=='taunt'&&SK[id].v&&SK[id].v.length>=3);}
function learnTo(id){const cur=skLvl(G.hero,id);return Math.min(SK[id].v.length,Math.max(cur+1,2));}
function learnOffer(){const h0=G.hero;let h=hash32('learn:'+(G.level?G.level.id:0)+':'+G.wave+':'+G.runs+':'+(G.learnRr||0));const rnd=()=>{h=Math.imul(h^(h>>>15),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;h^=h>>>16;return h;};
  const nShield=(G.learned||[]).filter(k=>skCat(k)==='shield').length;
  const pool=learnPool().filter(id=>skLvl(h0,id)<SK[id].v.length&&!(nShield>=2&&skCat(id)==='shield'&&!h0.c.sk.includes(id))),mine=pool.filter(id=>h0.c.sk.includes(id)&&skLvl(h0,id)<SK_MAX),out=[];
  if(mine.length)out.push(mine.splice(rnd()%mine.length,1)[0]);
  while(out.length<3&&pool.length){const id=pool.splice(rnd()%pool.length,1)[0];if(!out.includes(id))out.push(id);}return out;}
function learnPick(id){if(!G.learnAsk||!SK[id])return;const h=G.hero,to=learnTo(id);h.perk=h.perk||{};h.perk[id]=to;(G.learned=G.learned||[]).push(id);
  const syn=typeof champSynergy==='function'?champSynergy(id):null;
  G.learnAsk=null;G.learnWhy=null;const el=document.getElementById('boonOv');if(el)el.remove();G.paused=false;try{SFX.play('levelup');}catch(e){}
  try{addText(h.x,h.y-48,'LEARNED '+SK[id].n,'#ffd54a',1);addFx({t:'ring',x:h.x,y:h.y-10,r0:8,r1:60,life:0.6,col:'#ffd54a'});if(syn)addText(h.x,h.y-70,'✦ '+syn,'#9fe6ff',1);}catch(e){}}
function learnShow(offer){const ov=document.getElementById('boonOv');if(ov)ov.remove();
  const o=document.createElement('div');o.id='boonOv';
  o.innerHTML=`<div class="bo-in"><small>${esc(shortName(G.hero.c))} · ${G.learnWhy||('BEFORE WAVE '+(G.wave+1))}</small><h2>Learn a skill</h2><div class="bo-row">${offer.map((id,i)=>{const S=SK[id],to=learnTo(id),own=skLvl(G.hero,id);
    return `<button class="bo-card" data-learn="${id}" style="animation-delay:${i*90}ms"><span class="bo-e">${skillIcon(id,48,0)}</span><b>${esc(S.n)}</b><em>${esc(S.d(S.v[to-1]))}</em><small>${own?'RANK '+own+' → '+to:'NEW · rank '+to}</small></button>`;}).join('')}</div>
    ${(G.learnRr||0)<1?'<button class="linkbtn" id="learnRr">🎲 Other skills (once per battle)</button>':''}
    <p class="bo-have">${(G.learned||[]).length?'Learned this battle: '+G.learned.map(k=>esc(SK[k].n)).join(', '):'It lasts until the battle ends'}</p></div>`;
  (document.getElementById('stage')||document.body).appendChild(o);
  o.querySelectorAll('[data-learn]').forEach(b=>b.addEventListener('click',()=>learnPick(b.dataset.learn)));
  const rr=o.querySelector('#learnRr');if(rr)rr.addEventListener('click',()=>{G.learnRr=(G.learnRr||0)+1;const n=learnOffer();G.learnAsk=n;SFX.play('tap',60);learnShow(n);});}
/* v1.3.4: battle levels 3 and 5 of the champion open an offer at once (no waiting for the next wave) */
function learnNow(tag){if(G.learnAsk||!G.hero)return;G.learnDone=G.learnDone||{};if(G.learnDone[tag])return;G.learnDone[tag]=1;const offer=learnOffer();if(!offer.length)return;G.learnAsk=offer;G.paused=true;learnShow(offer);try{SFX.play('chest');}catch(e){}}
function learnCheck(){if(G.learnAsk)return true;
  if(G.mode!=='campaign'||G.tutorial||G.tut||!G.level||G.level.id<LEARN.minStage||!G.hero||!LEARN.at.includes(G.wave))return false;
  G.learnDone=G.learnDone||{};if(G.learnDone[G.wave])return false;G.learnDone[G.wave]=1;
  const offer=learnOffer();if(!offer.length)return false;G.learnAsk=offer;G.paused=true;
  learnShow(offer);try{SFX.play('chest');}catch(e){}
  return true;}
