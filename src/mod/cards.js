/* =========================== CARDS (v1.0.48) ===========================
   Every champion, tower and spell is a card. Copies come from chests (and a few from every stage held for the first time).
   A level costs N cards + gold. The account level grows only with upgrades bought; every account level pays a chest. */
const CARD_NEED=[2,3,4,6,8,10,13,16,20,25,30,36,43,51,60,70,82,95,110]; /* common cards for level L → L+1 */
const CARD_MUL=[1,0.5,0.25,0.1];                                          /* rarer cards need fewer copies, and drop less */
const RAR_N=['Common','Rare','Epic','Legendary'],RAR_C=['#8a97a8','#4fb0ff','#b47cff','#e3b661'];
const T_RAR={watch:0,glass:0,keep:1,scorp:1,wild:2,weir:3},S_RAR={arrows:0,reinf:1,fire:2},S_MAX=10;
const CARD_PACK={wood:[5,9],iron:[8,14],valyrian:[14,22],dragon:[24,40]};  /* common copies per stack, by chest */
const CARD_PRICE=[25,50,100,250];                                         /* gold per copy in the daily deals */
function cardKeyOf(t,id){return t+':'+id;}
function cardRar(key){const [t,id]=key.split(':');if(t==='c'){const c=CBY[id];return c?Math.min(3,Math.floor((c.tier||0)/2)):0;}return t==='t'?(T_RAR[id]||0):(S_RAR[id]||0);}
function cardLvl(key,a){const A=a||ACC,[t,id]=key.split(':');return t==='c'?cprog(A,id).lvl:t==='t'?tLvl(id,A):((A.slv&&A.slv[id])||1);}
function cardMax(key){const t=key[0];return t==='c'?CH_MAX:t==='t'?T_MAX:S_MAX;}
function cardNeed(key,l){l=l||cardLvl(key);if(l>=cardMax(key))return 0;return Math.max(1,Math.round(CARD_NEED[Math.min(l-1,CARD_NEED.length-1)]*CARD_MUL[cardRar(key)]));}
function cardHave(key,a){const A=a||ACC;return (A&&A.cards&&A.cards[key])||0;}
function cardGold(key,l){l=l||cardLvl(key);const t=key[0];return t==='c'?ECON.lvlCost(l):t==='t'?ECON.tCost(l):ECON.sCost(l);}
function cardName(key){const [t,id]=key.split(':');return t==='c'?shortName(CBY[id]):t==='t'?TSHORT[id]:SPELLS[id].n;}
function cardOpen(key){const [t,id]=key.split(':');if(t==='c'){const c=CBY[id];return c&&c.house===ACC.house&&unlocked(null,c);}return t==='t'?towerOpen(id):(id==='arrows'||cleared()>=SPELLS[id].at);}
function cardReady(key){return cardLvl(key)<cardMax(key)&&cardHave(key)>=cardNeed(key);}
function cardCan(key){return cardReady(key)&&goldOf()>=cardGold(key);}
function addCards(key,n){if(!ACC.cards)ACC.cards={};ACC.cards[key]=(ACC.cards[key]||0)+n;}
/* the icons used on cards, in chests and in the deals */
function spellSVG(k){return k==='arrows'?'<svg viewBox="0 0 24 24" fill="none" stroke="#e3b661" stroke-width="1.8"><path d="M4 20 20 4M20 4h-6M20 4v6M8 20l-4-4M12 12l-4 4"/></svg>':k==='fire'?'<svg viewBox="0 0 24 24" fill="#ff9a3c"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3-1-6 1-9z"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="#8fd3ff" stroke-width="1.8"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>';}
function cardIcon(key,px){const [t,id]=key.split(':');if(t==='c'){const c=CBY[id],pu=CHAMP_ART[id+'_portrait'];return pu?`<img src="${pu}" alt="">`:`<span class="pe">${c.e}</span>`;}
  if(t==='t')return towerIconHTML(id,Math.max(1,Math.min(5,maxTowerLvl())),px||64);return `<span class="spi">${spellSVG(id)}</span>`;}
/* the progress bar under a card: copies / copies needed (green when full) */
function cardBar(key){const l=cardLvl(key),mx=cardMax(key);if(l>=mx)return `<span class="cb max"><i style="width:100%"></i><em>MAX</em></span>`;
  const h=cardHave(key),n=cardNeed(key);return `<span class="cb ${h>=n?'ok':''}"><i style="width:${Math.min(100,Math.round(100*h/n))}%"></i><em>${h}/${n}</em></span>`;}
function cardUpBadge(key){return cardCan(key)?'<span class="upb">⬆</span>':'';}
/* the level line inside a room: copies, gold, the button */
function cardLvlLine(key,attr){const l=cardLvl(key),mx=cardMax(key),h=cardHave(key),n=cardNeed(key),g=cardGold(key),can=cardCan(key);
  return `<div class="lvline">Lv ${l}<span class="bar"><i style="width:${Math.round(100*l/mx)}%"></i></span><button ${attr} ${can?'':'disabled'}>${l>=mx?'max':`${h}/${n} 🃏 · 🪙${g}`}</button></div>
  <div class="cardline">${l>=mx?'Fully forged.':h>=n?(goldOf()>=g?`<em class="ok">Ready:</em> ${n} cards + ${g} gold → level ${l+1}`:`Cards ready — ${g} gold needed`):`Next level: <em>${n}</em> cards (you have <em>${h}</em>) + <em>${g}</em> gold. Cards come from chests.`}</div>`;}
/* buying a level: copies + gold → +1, and account XP for the upgrade */
function cardLevelUp(key){if(!cardCan(key))return false;const [t,id]=key.split(':'),l=cardLvl(key),need=cardNeed(key),g=cardGold(key);
  if(!spendGold(g))return false;ACC.cards[key]-=need;
  if(t==='c')cprog(null,id).lvl=l+1;else if(t==='t'){ACC.tlv=ACC.tlv||{};ACC.tlv[id]=l+1;}else{ACC.slv=ACC.slv||{};ACC.slv[id]=l+1;}
  addXp(Math.round(g/10));return true;}
/* ---------- account level: XP only from upgrades; a chest every level ---------- */
function xpNeed(n){return 15+8*n+n*n;}
function accXp(a){a=a||ACC;return a?(a.axp||0):0;}
function accLevel(a){let xp=accXp(a),l=1;while(l<40&&xp>=xpNeed(l)){xp-=xpNeed(l);l++;}return{l,xp,need:xpNeed(l)};}
function addXp(n){if(!ACC||!n)return;const b=accLevel().l;ACC.axp=(ACC.axp||0)+n;const l=accLevel().l;if(l>b){SFX.play('levelup');lvlToast(l);}}
function lvlChestTier(l){return l%10===0?'dragon':l%5===0?'valyrian':l<8?'wood':'iron';}
function lvlChestsReady(){return Math.max(0,accLevel().l-1-(ACC.lvlChests||0));}
function lvlToast(l){try{document.querySelectorAll('.lvltoast').forEach(e=>e.remove());const el=document.createElement('div');el.className='lvltoast';el.innerHTML=`<b>LEVEL ${l}</b><small>${CHEST_TIERS[lvlChestTier(l)].n} waits in your castle</small>`;document.getElementById('app').appendChild(el);requestAnimationFrame(()=>el.classList.add('in'));setTimeout(()=>{el.classList.remove('in');setTimeout(()=>el.remove(),400);},2600);}catch(e){}}
/* ---------- where cards come from ---------- */
function cardPool(){const keys=[];for(const c of CHAMPS)if(c.house===ACC.house&&unlocked(null,c)&&cprog(null,c.id).lvl<CH_MAX)keys.push('c:'+c.id);
  for(const k of TKEYS)if(towerOpen(k)&&tLvl(k)<T_MAX)keys.push('t:'+k);
  for(const k in SPELLS)if((k==='arrows'||cleared()>=SPELLS[k].at)&&cardLvl('s:'+k)<S_MAX)keys.push('s:'+k);return keys;}
function cardStack(pool,tier,minR,used){const T=CARD_PACK[tier]||CARD_PACK.wood;let c=pool.filter(k=>!used.has(k)&&cardRar(k)>=minR);
  if(!c.length)c=pool.filter(k=>!used.has(k));if(!c.length)c=pool.slice();if(!c.length)return null;
  const w=k=>[10,6,3,1][cardRar(k)];let tot=c.reduce((s,k)=>s+w(k),0),r=Math.random()*tot,key=c[c.length-1];for(const k of c){r-=w(k);if(r<=0){key=k;break;}}
  used.add(key);const rr=cardRar(key),n=Math.max(1,Math.round((T[0]+Math.floor(Math.random()*(T[1]-T[0]+1)))*CARD_MUL[rr]));
  addCards(key,n);return{k:'card',key,cnt:n,r:rr,n:cardName(key),s:'+'+n+' card'+(n>1?'s':'')};}
/* a chest: gold, dragonglass and card stacks (the rarer chests promise rarer stacks) */
function rollChest(t){const T=CHEST_TIERS[t],out=[],rnd=n=>Math.floor(Math.random()*n);
  const gold=T.gold[0]+rnd(T.gold[1]-T.gold[0]+1);addGold(gold);out.push({k:'gold',n:'Gold',s:'+'+gold,r:0});
  const gems=T.gems[0]+rnd(T.gems[1]-T.gems[0]+1);ACC.gems+=gems;out.push({k:'gems',n:'Dragonglass',s:'+'+gems,r:0});
  const pool=cardPool(),used=new Set();
  for(let i=0;i<T.cards;i++){const st=cardStack(pool,t,i<T.rare?Math.min(3,1+i):0,used);if(st)out.push(st);else{addGold(100);out.push({k:'gold',n:'Gold',s:'+100',r:0});}}
  return out;}
/* first time a stage is held: a few cards of something you own */
function stageCards(){const pool=cardPool();if(!pool.length)return null;const key=pool[Math.floor(Math.random()*pool.length)],n=Math.max(1,Math.round((3+Math.floor(Math.random()*4))*CARD_MUL[cardRar(key)]));addCards(key,n);return{key,n,name:cardName(key)};}
/* ---------- spells now have a level (1–10, +6% a level) ---------- */
function spellLvl(k){return cardLvl('s:'+k);}
function spellMul(k){return 1+0.06*(spellLvl(k)-1);}
function spellLine(k,l){const m=1+0.06*((l||spellLvl(k))-1);
  if(k==='arrows')return `${Math.round(170*m)} damage to everything in the circle`;
  if(k==='fire')return `${Math.round(400*m)} damage + burning ${Math.round(20*m)}/s for 3 s`;
  const n=(UP('sworn')?5:3)+((l||spellLvl(k))>=S_MAX?1:0);return `${n} brothers · ${Math.round(150*m)} hp · ${Math.round(15*m)} damage each`;}
function showSpellRoom(k){
  k=SPELLS[k]?k:'arrows';const S=SPELLS[k],key='s:'+k,l=spellLvl(k),op=cardOpen(key),rc=k==='fire'?'#ff9a3c':k==='reinf'?'#8fd3ff':'#e3b661';
  const tiles=Object.keys(SPELLS).map(t=>{const o=cardOpen('s:'+t);return `<button class="htile ${o?'':'lock'} ${t===k?'view':''}" data-s="${t}"><span class="spi big">${spellSVG(t)}</span><span class="nm">${o?SPELLS[t].n+' · '+spellLvl(t):'After '+SPELLS[t].at}</span></button>`;}).join('');
  const det=`<div class="hdet" style="--hc:${rc};--hc2:#1d2a3c">
    <div class="hdtop"><div class="hport"><span class="spi big">${spellSVG(k)}</span></div>
      <div class="hdinfo"><b>${S.n}</b><small>${S.d} · cooldown ${S.cd}s</small>
      ${op?cardLvlLine(key,'data-a="sl"')+`<small>+6% power per level${k==='reinf'?' · a fourth brother at level '+S_MAX:''}</small>`:`<small style="color:var(--gold)">🔒 Opens after stage ${S.at}</small>`}</div></div>
    ${op?`<div class="lvbox" style="margin:8px 0;font-size:12.5px;color:#f2e6c9"><b>Now</b> · ${spellLine(k,l)}${l<S_MAX?`<br><b style="color:var(--gold)">Lv ${l+1}</b> · ${spellLine(k,l+1)}`:''}</div>`:''}
    <div class="cfoot"><button data-a="arm">🛡️ Armory — one-time spell upgrades</button></div></div>`;
  show(`<div class="topbar"><h1>✨ Spells<small>Cards from chests and gold buy levels — every level is +6% power.</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m">🪙 <b style="color:var(--gold)">${fmtN(goldOf())}</b> gold · 🃏 ${cardHave(key)} ${S.n} cards</p>
  <div class="hgrid c3">${tiles}</div><div id="clist">${det}</div>`);
  $('#bBack').addEventListener('click',()=>showHub('coll','spells'));
  card.querySelectorAll('.htile').forEach(t=>t.addEventListener('click',()=>showSpellRoom(t.dataset.s)));
  const b=card.querySelector('#clist button[data-a="sl"]');if(b)b.addEventListener('click',()=>{if(cardLevelUp(key)){SFX.play('upgrade');persist();}else SFX.play('deny');showSpellRoom(k);});
  const ba=card.querySelector('#clist button[data-a="arm"]');if(ba)ba.addEventListener('click',()=>showUpgrades());
}
/* ---------- old saves: cards start at zero, the account level is rebuilt from the levels already bought ---------- */
function migrate48(a){if(a.lv48)return;a.lv48=1;if(!a.cards||typeof a.cards!=='object')a.cards={};if(!a.slv||typeof a.slv!=='object')a.slv={};
  let xp=0;for(const id in (a.champs||{})){const p=a.champs[id]||{};for(let l=1;l<(p.lvl||1);l++)xp+=Math.round(ECON.lvlCost(l)/10);for(const r of (p.sk||[]))for(let i=1;i<r;i++)xp+=Math.round(ECON.skCost(i)/10);}
  for(const k in (a.tlv||{}))for(let l=1;l<(a.tlv[k]||1);l++)xp+=Math.round(ECON.tCost(l)/10);
  for(const id in (a.upg||{}))if(a.upg[id]){const u=UPG.find(x=>x.id===id);if(u)xp+=Math.round(ECON.upgCost(u)/10);}
  a.axp=xp;delete a.xpBonus;const L=accLevel(a).l;a.lvlChests=Math.max(0,L-2);
  if(a.tour&&!a.tours)a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};if(!a.tours||typeof a.tours!=='object')a.tours={};}
