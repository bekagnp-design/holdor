/* v1.2.4: the preparation sheet before a battle — 3 spells, 5 towers, the champion. ACC.roster = tower ids (max 5); ACC.loadout = spell ids. */
const ROSTER_MAX=5;
function towerRoster(){const open=openTowers();if(open.length<=ROSTER_MAX)return open;
  const out=[];for(const k of ((ACC&&ACC.roster)||[]))if(open.includes(k)&&!out.includes(k))out.push(k);
  if(!(ACC&&Array.isArray(ACC.roster))||!out.length)for(const k of open)if(out.length<ROSTER_MAX&&!out.includes(k))out.push(k);return out.slice(0,ROSTER_MAX);}
function battleTowers(){return G.tutorial?['watch']:towerRoster();}
function prepNeeded(){return !!(ACC&&ACC.castle&&cleared()>=5&&(openTowers().length>ROSTER_MAX||Object.keys(SPELLS).filter(k=>k==='arrows'||cleared()>=SPELLS[k].at).length>3));}
function prepOpenSpells(){return Object.keys(SPELLS).filter(k=>k==='arrows'||cleared()>=SPELLS[k].at);}
function prepGo(go){
  if(!prepNeeded()){go();return;}
  document.querySelectorAll('#prep').forEach(n=>n.remove());
  const el=document.createElement('div');el.id='prep';document.body.appendChild(el);
  let slot=0;const open=openTowers(),c=CBY[ACC.sel];
  const draw=()=>{const L=spellLoadout(),R=towerRoster(),pool=prepOpenSpells();
    el.innerHTML=`<div class="pcard"><h2>Prepare</h2>
      <div class="psec"><div class="pst"><b>Spells</b><small>pick 3 · tap a slot, then a spell</small></div>
        <div class="pslots">${L.map((k,i)=>`<button class="pslot ${i===slot?'on':''}" data-s="${i}"><span class="spi">${spellSVG(k)}</span><b>${esc(SPELLS[k].n)}</b><small>Lv ${spellLvl(k)}</small></button>`).join('')}</div>
        <div class="ppool">${pool.map(k=>`<button class="pitem ${L.includes(k)?'in':''}" data-sp="${k}"><span class="spi">${spellSVG(k)}</span><small>${esc(SPELLS[k].n)}</small><i>Lv ${spellLvl(k)}</i></button>`).join('')}</div>
        <small class="phint">${esc(spellLine(L[slot],spellLvl(L[slot])))}</small></div>
      <div class="psec"><div class="pst"><b>Towers</b><small>${R.length}/${ROSTER_MAX} for this battle${open.length>ROSTER_MAX?' · tap to swap':''}</small></div>
        <div class="ppool">${open.map(k=>`<button class="pitem ${R.includes(k)?'in':''}" data-tw="${k}">${towerIconHTML(k,Math.max(1,maxTowerLvl()),40)}<small>${esc(TSHORT[k]||TOWERS[k].n)}</small><i>Lv ${tLvl(k)}</i></button>`).join('')}</div></div>
      <div class="psec pch"><span>${c?c.e||'':''}</span><b>${c?esc(c.n):''}</b><small>your champion</small></div>
      <button class="go" id="pGo">START</button><button class="linkbtn" id="pX">Cancel</button></div>`;
    el.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{slot=+b.dataset.s;SFX.play('tap',50);draw();}));
    el.querySelectorAll('[data-sp]').forEach(b=>b.addEventListener('click',()=>{spellEquip(b.dataset.sp,slot);slot=(slot+1)%3;SFX.play('tap',60);draw();}));
    el.querySelectorAll('[data-tw]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.tw;let r=towerRoster().slice();
      if(r.includes(k)){if(r.length<=1){SFX.play('deny');return;}r=r.filter(x=>x!==k);}else{if(r.length>=ROSTER_MAX)r.shift();r.push(k);}
      ACC.roster=r;persist();SFX.play('tap',60);draw();}));
    el.querySelector('#pX').addEventListener('click',()=>el.remove());
    el.querySelector('#pGo').addEventListener('click',()=>{el.remove();go();});};
  draw();}
