/* =========================== THE BATTLE FLOW (flow150) ===========================
   Home → map → fight in two taps. The map card is the preparation step: the stage, the chosen deck (champion, 3 spells, 5 towers) as a
   strip, one ⚔ TO BATTLE button, a quiet "change ›" link to Army → Loadout (the one editor; a "◀ Back to the battle" pill brings the
   player back to the same stage). The result screen: NEXT STAGE › (or ⟲ TRY AGAIN) is the one big button, Replay and Home sit under it,
   Map / Upgrades / Share are links; gold, stars and cards earned are chips read in one glance. The data (ACC.roster, ACC.loadout) is
   unchanged; the old preparation sheet with its editor is gone (prepGo starts the battle at once). */
const PREP={ret:null};   /* the stage to come back to from the deck */
function deckStripHTML(){if(typeof prepNeeded!=='function'||!prepNeeded())return '';
  const c=CBY[ACC.sel],pu=c&&CHAMP_ART[c.id+'_portrait'],L=spellLoadout(),R=towerRoster(),lv=Math.max(1,maxTowerLvl());
  return `<div class="pdeck" id="pDeckStrip"><div class="pdh"><small>YOUR DECK</small><button class="pchg" id="pDeck">change ›</button></div>
    <div class="pds"><span class="pdi ch" title="${c?esc(c.n):''}">${pu?`<img src="${pu}" alt="">`:`<i>${c?c.e:''}</i>`}</span>${L.map(k=>`<span class="pdi sp" data-ds="${k}" title="${esc(SPELLS[k].n)}"><span class="spi">${spellSVG(k)}</span></span>`).join('')}<i class="pdsep"></i>${R.map(k=>`<span class="pdi tw" data-dt="${k}" title="${esc(TSHORT[k]||TOWERS[k].n)}">${towerIconHTML(k,lv,30)}</span>`).join('')}</div></div>`;}
/* the deck opened from the map card: a pill on top brings the player back to the same stage; any other tab forgets it */
{const sh5=showHub;showHub=function(tab,sub){if(PREP.ret&&!(tab==='coll'&&(sub||'deck')==='deck'))PREP.ret=null;return sh5.apply(this,arguments);};
 const hb5=hubCollectionBind;hubCollectionBind=function(sub){hb5(sub);if(!PREP.ret||(sub||'deck')!=='deck')return;
  const b=document.getElementById('hubBody'),L=LEVELS.find(l=>l.id===PREP.ret);if(!b||!L)return;
  const d=document.createElement('div');d.className='hback dkret';d.innerHTML=`<button id="dkRet">◀ Back to the battle</button><span>Stage ${L.id} · ${esc(L.n)}</span>`;
  b.insertBefore(d,b.firstChild);d.querySelector('#dkRet').addEventListener('click',()=>{SFX.play('tap',60);const id=PREP.ret;PREP.ret=null;showCampaign('gates',id);});};}
/* the result screen before the castle (the story) has no home yet; an emptied row leaves no gap */
{const r5=showCampaignResult;showCampaignResult=function(win,stars,nu,gained){r5(win,stars,nu,gained);
  try{if(typeof stOn==='function'&&stOn()){const h=$('#bHome');if(h)h.remove();}
    card.querySelectorAll('.resrow,.reslinks').forEach(r=>{if(!r.children.length)r.remove();});}catch(e){}};}
