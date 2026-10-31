/* v1.4.4: the Loadout tab is a deck you build. "Your battle deck" holds the champion, the 3 spells and the 5 towers that go into battle;
   "Collection" holds the open cards that stay home and the ones still locked. Tap a card: a sheet with LEVEL UP / INFO and SWAP. Swapping is
   two taps: pick the card to bring in (or to take out), then the card it trades places with; the cards that can take the place pulse.
   The deck is the same data the preparation sheet uses (ACC.roster for towers, ACC.loadout for spells), so both always agree. */
const DECK={mode:null,kind:null,pick:null,side:null};
function deckSpellsOpen(){return Object.keys(SPELLS).filter(k=>cardOpen('s:'+k));}
function deckState(){const tin=towerRoster(),sin=spellLoadout();
  return{tin,sin,tout:TKEYS.filter(k=>towerOpen(k)&&!tin.includes(k)),sout:deckSpellsOpen().filter(k=>!sin.includes(k)),
    tlock:TKEYS.filter(k=>!towerOpen(k)),slock:Object.keys(SPELLS).filter(k=>!cardOpen('s:'+k))};}
function deckCard(kind,k,where){let h=kind==='t'?towerCard(k):spellCard(k);
  h=h.replace(kind==='t'?`data-t="${k}"`:`data-s="${k}"`,`data-dk="${kind}" data-dv="${k}" data-dw="${where}"`);
  const swap=DECK.mode&&DECK.kind===kind&&where!==DECK.side&&where!=='lock'&&DECK.pick!==k;
  const picked=DECK.mode&&DECK.pick===k;
  h=h.replace('class="ccard ','class="ccard dkc '+(where==='in'?'indeck ':'')+(swap?'swap ':'')+(picked?'picked ':''));
  if(where!=='lock')h=h.replace(/<span class="rar"[^>]*>[^<]*<\/span>/,where==='in'?'<span class="rar dkst in">✓ IN DECK</span>':'<span class="rar dkst">AT HOME</span>');
  return h;}
function deckBody(){const S=deckState(),c=CBY[ACC.sel];
  const ban=DECK.mode?`<div class="dkban"><span>${DECK.side==='out'?'Tap the card in your deck that <b>'+esc(deckName(DECK.kind,DECK.pick))+'</b> replaces':'Tap the card from your collection that takes the place of <b>'+esc(deckName(DECK.kind,DECK.pick))+'</b>'}</span><button id="dkCancel">Cancel</button></div>`:'';
  const col=S.tout.map(k=>deckCard('t',k,'out')).concat(S.sout.map(k=>deckCard('s',k,'out')));
  const lock=S.tlock.map(k=>deckCard('t',k,'lock')).concat(S.slock.map(k=>deckCard('s',k,'lock')));
  return `<div class="hh"><h2>Your battle deck</h2><small>tap a card to swap or level it</small></div>${ban}
    <div class="dksec"><b>Champion & spells</b><small>${S.sin.length}/3 spells</small></div>
    <div class="deckrow">${champCard(c,{})}${S.sin.map(k=>deckCard('s',k,'in')).join('')}</div>
    <div class="dksec"><b>Towers in battle</b><small>${S.tin.length}/${ROSTER_MAX} · tier ${ROMAN[maxTowerLvl()-1]}</small></div>
    <div class="cgrid c3">${S.tin.map(k=>deckCard('t',k,'in')).join('')}</div>
    <div class="hh dkcolh"><h2>Collection</h2><small>${col.length?'stay home · tap to bring one in':'every open card is in your deck'}</small></div>
    ${col.length?`<div class="cgrid c3">${col.join('')}</div>`:''}
    ${lock.length?`<div class="dksec dklock"><b>Still locked</b><small>open with stages held</small></div><div class="cgrid c3">${lock.join('')}</div>`:''}`;}
function deckName(kind,k){return kind==='t'?(TSHORT[k]||TOWERS[k].n):SPELLS[k].n;}
function deckRedraw(){const hb=document.getElementById('hubBody'),y=hb?hb.scrollTop:0,wy=window.scrollY;showHub('coll','deck');const nb=document.getElementById('hubBody');if(nb)nb.scrollTop=y;window.scrollTo(0,wy);}
function deckSwap(kind,a,b){/* a leaves the deck, b comes in */
  if(kind==='t'){const r=towerRoster().slice(),i=r.indexOf(a);if(i<0||r.includes(b)||!towerOpen(b))return false;r[i]=b;ACC.roster=r;}
  else{const L=spellLoadout(),i=L.indexOf(a);if(i<0||L.includes(b)||!cardOpen('s:'+b))return false;spellEquip(b,i);}
  persist();return true;}
function deckSheet(kind,k,where){const el=document.getElementById('dkSheet')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'dkSheet'}));
  const S=deckState(),others=kind==='t'?(where==='in'?S.tout:S.tin):(where==='in'?S.sout:S.sin),lvl=kind==='t'?tLvl(k):spellLvl(k);
  const line=kind==='t'?(TGUIDE[k]?TGUIDE[k].role:TOWERS[k].sub):(SPELLS[k].d);
  const swapLbl=where==='in'?'⇄ SWAP OUT':'⇄ USE IN BATTLE';
  el.innerHTML=`<div class="dks-in"><div class="dks-h"><span class="dks-ic">${kind==='t'?towerIconHTML(k,Math.max(1,maxTowerLvl()),46):`<span class="spi">${spellSVG(k)}</span>`}</span><span><b>${esc(deckName(kind,k))}</b><small>${where==='lock'?'locked':'level '+lvl}${where==='in'?' · in your deck':where==='out'?' · in your collection':''}</small></span></div>
    <p>${esc(line)}</p>
    <div class="dks-b">${where!=='lock'&&others.length?`<button class="bigbtn lvl ready" data-dka="swap"><span class="bt">${swapLbl}</span></button>`:''}<button class="bigbtn" data-dka="info"><span class="bt">${where==='lock'?'ⓘ INFO':'⬆ LEVEL UP · INFO'}</span></button></div>
    <button class="linkbtn" data-dka="x">Close</button></div>`;
  el.classList.add('on');
  el.querySelectorAll('[data-dka]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const a=b.dataset.dka;el.classList.remove('on');
    if(a==='info'){SFX.play('tap',60);if(kind==='t')showTowerRoom(k);else showSpellRoom(k);}
    else if(a==='swap'){SFX.play('tap',60);Object.assign(DECK,{mode:'swap',kind,pick:k,side:where});deckRedraw();}}));
  el.onclick=e=>{if(e.target===el)el.classList.remove('on');};}
{const hc1=hubCollection;hubCollection=function(sub){sub=sub||'deck';if(sub!=='deck'){DECK.mode=null;return hc1(sub);}
  const full=hc1('deck'),i=full.indexOf('<div class="hh"><h2>Battle loadout');return (i>0?full.slice(0,i):full)+deckBody();};
 const hb1=hubCollectionBind;hubCollectionBind=function(sub){hb1(sub);if((sub||'deck')!=='deck')return;
  const cn=document.getElementById('dkCancel');if(cn)cn.addEventListener('click',()=>{DECK.mode=null;SFX.play('tap',40);deckRedraw();});
  card.querySelectorAll('.ccard[data-dk]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.dk,k=b.dataset.dv,where=b.dataset.dw;
    if(DECK.mode){
      if(kind===DECK.kind&&where!==DECK.side&&where!=='lock'&&k!==DECK.pick){const a=DECK.side==='in'?DECK.pick:k,bb=DECK.side==='in'?k:DECK.pick;
        if(deckSwap(kind,a,bb)){SFX.play('upgrade');if(typeof ecoToast==='function')ecoToast('⇄ '+deckName(kind,bb)+' is in your deck',true);}
        DECK.mode=null;deckRedraw();return;}
      DECK.mode=null;deckRedraw();return;}
    SFX.play('tap',60);deckSheet(kind,k,where);}));};}
