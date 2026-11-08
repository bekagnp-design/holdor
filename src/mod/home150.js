/* =========================== THE HOME ANSWERS THREE QUESTIONS (v1.5.0) ===========================
   A tester with the phone in hand: "two gold buttons, which one?" So the first screen now answers, top to bottom:
     WHAT IS READY  — a row of gold pills, only when something is: chests to open, gifts to claim, a champion or a tower that can
                      level up. Nothing ready → no row.
     WHAT DO I DO NOW — one green button straight under the stage art: BATTLE · STAGE 7 · its name · the gold it pays. One tap opens
                      the map card at that stage (the deck strip and ⚔ TO BATTLE, flow150): two taps from the home to the fight.
     WHAT IS NEW    — a quiet pill between Map and the champion: the next thing that opens and at which stage (tower, spell,
                      champion, the Hold, Trials, Kingsguard). Tap: its room.
   Everything else steps back: the chests under the button with a label each (Stars · Level · Free · Gift), the Hold card in quiet
   blue, the rank / Tasks / event pills at the bottom with lower contrast. The three looks are back behind a small 🎨 in the art's
   corner (A hero stage · B living gate · C war map; skins.js draws them). Injected last: hubHome / homeStrip / homeSlots / homeGoal /
   homeBattleRow / skinOf / skinNext here replace the earlier ones; homeBind is wrapped. The ids the coach and the tests know stay:
   #bBattle, #bMapH / #bDiffH, #bChampH, #hmGoal, #hmStage, .hmslots .slot (#starChest #lvlChest #lvlNext #freeChest
   #dailyGift), #hmHold / #bHold / #bHoldMore, .hmstrip (#hubTro #bTasks #evBadge). New: #hmReady .rdy[data-r], #hmNew. */
/* ---------- what is ready ---------- */
function homeReadyItems(n){const out=[];if(!ACC||!ACC.tut)return out;
  if(n>=1){const d=dailyOn()?(DAILY.st&&DAILY.seat===seatNo()?DAILY.st.login:null):null;
    const ch=Math.max(0,starChestsReady())+lvlChestsReady()+(freeChestReady()?1:0)+(d&&d.can?1:0);
    if(ch)out.push({k:'chest',e:icon('gift',22),t:`${ch} ${ch===1?'chest':'chests'} to open`,go:()=>{const s=document.querySelector('.hmslots .slot.ready');if(s)s.click();}});}
  if(n>=2){const tk=typeof tasksReady==='function'?tasksReady():0;if(tk)out.push({k:'task',e:icon('quests',22),t:`${tk} ${tk===1?'gift':'gifts'} to claim`,go:()=>showHub('tasks')});}
  if(!hubLocked('coll')&&typeof cardCan==='function'){const c=CBY[ACC.sel];
    if(c&&cardCan('c:'+c.id))out.push({k:'champ',e:'⬆',t:`${shortName(c)} can level up`,go:()=>showHeroRoom(c.id)});
    const tw=TKEYS.filter(t=>towerOpen(t)&&cardCan('t:'+t));
    if(tw.length)out.push({k:'tower',e:'⬆',t:tw.length===1?`${TSHORT[tw[0]]||TOWERS[tw[0]].n} can level up`:`${tw.length} towers can level up`,go:()=>showTowerRoom(tw[0])});}
  return out;}
function homeReadyRow(n){const it=homeReadyItems(n);if(!it.length)return '';
  return `<div class="hmready" id="hmReady">${it.map(i=>`<button class="rdy ${i.k}" data-r="${i.k}"><i>${i.e}</i><b>${esc(i.t)}</b><em>›</em></button>`).join('')}</div>`;}
/* ---------- what is new: the next thing that opens ---------- */
function homeNextOpen(){const n=cleared(),sv=ACC.sv?3:0,out=[];
  for(const k in OB_NEED)if(hubLocked(k))out.push({at:OB_NEED[k]+sv,e:k==='coll'?'🛡️':k==='shop'?HUB_ICON.shop:HUB_ICON.trials||'🌙',n:k==='coll'?'The Army':k==='shop'?'The Shop':'Trials',go:()=>hubLockSay(k)});
  if(!onlineOpen())out.push({at:ONLINE_AT,e:icon('door',22),n:'The Hold · one map a day',go:()=>ecoToast(`🔒 The Hold opens after stage ${ONLINE_AT}`)});
  for(const k of TKEYS)if(!towerOpen(k))out.push({at:TOWER_UNLOCK[k],e:towerIconHTML(k,1,22),n:(TSHORT[k]||TOWERS[k].n)+' tower',go:()=>showTowerRoom(k)});
  for(const k in SPELLS)if(SPELLS[k].at>n)out.push({at:SPELLS[k].at,e:spellSVG(k),n:SPELLS[k].n+' spell',go:()=>showSpellRoom(k)});
  for(const c of CHAMPS)if(c.house===ACC.house&&!unlocked(null,c))out.push({at:UNLOCK_STAGE[c.tier],e:c.e||'🛡️',n:shortName(c)+' joins',go:()=>showHeroRoom(c.id)});
  if(typeof hardOpen==='function'&&!hardOpen())out.push({at:LEVELS.length,e:DIFFS.kingsguard.e,n:'Kingsguard difficulty',go:()=>showDifficulty(false)});
  out.sort((a,b)=>a.at-b.at);return out.find(x=>x.at>n)||null;}
/* ---------- the pieces ---------- */
function homeStrip(){const n=obStage(),R=myRank(),e=evAt(Date.now()),K=EVT_KIND[e.kind],left=e.active?e.t1-Date.now():e.t0-Date.now(),tk=typeof tasksReady==='function'?tasksReady():0;
  return `<div class="hmstrip low"><button class="hpill" id="hubTro">${rankSVG(R.t,20,R.div)}<b>${trophiesOf()}</b><small>rank</small></button>
    ${n>=2?`<button class="hpill tk ${tk?'hot':''}" id="bTasks">${icon('quests',18)}<b>Tasks</b>${tk?`<i class="dot">${tk}</i>`:''}</button>`:''}
    ${n>=3?`<button class="hpill ev ${e.active?'on':''}" id="evBadge" data-t="${e.active?e.t1:e.t0}" data-a="${e.active?1:0}">${K.e}<b>${K.n}</b><em>${e.active?'ends in':'in'} ${evLeft(left)}</em></button>`:''}</div>`;}
function homeGoal(){const NG=LEVELS.length,g=Object.keys(campOf()).length,se=starsEarned();
  return `<button class="hmgoal v150" id="hmGoal"><span class="gl"><small>Road north</small><b>${g}/${NG} stages held</b></span><span class="gp"><i style="width:${Math.round(100*g/NG)}%"></i></span><span class="gs">★ ${se}/${NG*3}</span><em class="arr">›</em></button>`;}
function homeSlots(){const sN=starChestsReady(),prog=starsEarned()%3,lN=lvlChestsReady(),L=accLevel();
  const fr=freeChestReady(),fl=fr?0:(ACC.freeChestAt+86400000-Date.now());
  const d=dailyOn()?(DAILY.st&&DAILY.seat===seatNo()?DAILY.st.login:null):null,dReady=!!(d&&d.can);
  const ring=p=>`style="--p:${Math.round(p*100)}"`;
  return `<div class="hmslots">
    <button class="slot ${sN>0?'ready':''}" id="starChest" ${ring(sN>0?1:prog/3)}><small class="sl">Stars</small><span class="si">${chestSVG('iron')}</span><em>${sN>0?'OPEN':'★ '+prog+'/3'}</em>${sN>1?`<b class="cnt">×${sN}</b>`:''}</button>
    ${lN>0?`<button class="slot ready" id="lvlChest" ${ring(1)}><small class="sl">Level</small><span class="si">${chestSVG(lvlChestTier((ACC.lvlChests||0)+2))}</span><em>OPEN</em>${lN>1?`<b class="cnt">×${lN}</b>`:''}</button>`
      :`<button class="slot" id="lvlNext" ${ring(L.xp/L.need)}><small class="sl">Level</small><span class="si dim">${chestSVG(lvlChestTier(L.l+1))}</span><em>AT LV ${L.l+1}</em></button>`}
    <button class="slot ${fr?'ready':''}" id="freeChest" ${ring(fr?1:1-fl/86400000)}><small class="sl">Free</small><span class="si">${chestSVG('wood')}</span><em data-until="${fr?0:ACC.freeChestAt+86400000}">${fr?'OPEN':fmtT(fl).str}</em></button>
    <button class="slot ${dReady?'ready':''}" id="dailyGift" ${ring(dReady?1:1-msToMidnightUTC()/86400000)}><small class="sl">Gift</small><span class="si gift">${icon('gift',38)}</span><em data-midnight="${dReady?0:1}">${!dailyOn()?'DAILY':dReady?'CLAIM':fmtT(msToMidnightUTC()).str}</em></button></div>`;}
/* the one button, and the quiet row under it: Map · what opens next · the champion */
function homeBattleRow(){const c=CBY[ACC.sel],L=nextStage(),pu=CHAMP_ART[c.id+'_portrait'],tut=!!ACC.tut,st=campOf()[L.id]||0,again=st>0,nx=tut?homeNextOpen():null;
  const rew=ECON.win(L,3,!again),can=!hubLocked('coll')&&typeof cardCan==='function'&&cardCan('c:'+c.id);
  const big=tut?`<span class="bbi">${HUB_ICON.battle}</span><span class="bbt"><b>${again?'DEFEND AGAIN':'BATTLE'}</b><small>STAGE ${L.id} · ${esc(L.n)}</small></span>
      <span class="bbr"><em>🪙 +${fmtN(rew)}</em><small>${again?'★'.repeat(st)+'<i>'+'★'.repeat(3-st)+'</i>':'up to ★★★'}</small></span>`
    :`<span class="bbi">${HUB_ICON.battle}</span><span class="bbt"><b>BEGIN</b><small>YOUR FIRST LESSON</small></span>`;
  return `<div class="battlerow v150"><button class="bbig go150 ${tut?'':'pulse'}" id="bBattle">${big}</button></div>
    <div class="hmside">${hardOpen()?`<button class="bside" id="bDiffH"><span class="pe">${DIFFS[ACC.diff].e}</span>${DIFFS[ACC.diff].lbl}</button>`:`<button class="bside" id="bMapH"><span class="pe">🗺️</span>Map</button>`}
    ${tut?`<button class="hmnew ${nx?'':'done'}" id="hmNew">${nx?`<small>Opens at stage ${nx.at}</small><b><span class="ni">${nx.e}</span>${esc(nx.n)}</b>`:`<small>All opened</small><b>⭐ Every tower and spell is yours</b>`}</button>`:''}
    <button class="bside" id="bChampH">${pu?`<img src="${pu}" alt="">`:`<span class="pe">${c.e}</span>`}${shortName(c)}${can?'<i class="upb">⬆</i>':''}</button></div>`;}
function hubHome(){const hh=HOUSES[ACC.house],n=obStage(),tut=!!ACC.tut,k=skinOf(),slots=tut&&n>=1;
  const st=k==='a'?hmStageA():k==='c'?hmStageC():hmStageB();
  return `${homeReadyRow(n)}
    <div class="hmstage st-${k}" id="hmStage">${st}<div class="hmtitle"><b>${hh.seat}</b></div>${homeGoal()}</div>
    ${homeBattleRow()}
    ${slots?`<div class="hmslots top">${homeSlots().replace(/^<div class="hmslots">/,'').replace(/<\/div>$/,'')}</div>`:''}
    ${tut&&n>=2?homeHold():''}
    ${tut?homeStrip():''}
    ${tut?'':'<div class="hint">▲ TAP BEGIN — YOUR CHAMPION WILL TEACH YOU</div>'}${ACC.refund?`<div class="hint" id="refundNote">🪙 Tower upgrades are now tower levels — ${ACC.refund} gold refunded. Army → Towers.</div>`:''}`;}
/* one tap: the preparation sheet, or straight into the next stage (the first lesson before the tutorial) */
function homeGo(){SFX.play('tap',80);if(!ACC.tut){startTutorial();return;}showCampaign('gates');}   /* the map card at the next stage: the deck strip, ⚔ TO BATTLE (flow150) — two taps from the home to the fight */
{const hb0=homeBind;homeBind=function(){hb0();
  const on=(id,f)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',f);};
  const hero=document.getElementById('hmHero');if(hero)hero.addEventListener('click',homeStrike);
  const map=document.getElementById('hmMap');if(map)map.addEventListener('click',()=>{SFX.play('tap',60);showCampaign();});
  on('hmNew',()=>{SFX.play('tap',60);const nx=homeNextOpen();if(nx&&nx.go)nx.go();else showCampaign();});
  const items=homeReadyItems(obStage());
  document.querySelectorAll('#hmReady .rdy').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',60);const i=items.find(x=>x.k===b.dataset.r);if(i)i.go();}));
  HOME.skin=skinOf();homeStart();};}
