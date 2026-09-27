/* =========================== CASTLE (v1.0.51) ===========================
   Two buildings on the Battle tab: the Train (your house's army — levels with gold, the house unit at level 5;
   the sworn brothers you call in battle train here too, and the army is what you send in a Duel) and the
   Spell shop (one-shot battle items bought with gold, one used per battle, campaign and Hold alike). */
const ARMY_MAX=10,ARMY_COST=[200,350,550,800,1100,1500,2000,2600,3300],ARMY_HOUSE_AT=5;
const ARMY_UNITS=[
 {k:'foot',n:'Sworn sword',role:'Holds the road, shield up',hp:150,dmg:15,spd:86},
 {k:'archer',n:'Longbowman',role:'Shoots from behind the line',hp:100,dmg:12,spd:80,ranged:1},
 {k:'rider',n:'Outrider',role:'Fast — first to the fight',hp:120,dmg:20,spd:120},
];
const HOUSE_UNIT={
 stark:{n:'Direwolf',role:'Fast, bites twice',hp:170,dmg:22,spd:130,e:'🐺'},
 lannister:{n:'Lion Guard',role:'Full plate — takes half damage',hp:260,dmg:16,spd:70,e:'🦁'},
 baratheon:{n:'Stormhammer',role:'Stuns whatever it hits',hp:200,dmg:24,spd:76,e:'🔨'},
 targaryen:{n:'Unsullied',role:'Spear wall — never flinches',hp:190,dmg:18,spd:84,e:'🔱'},
 greyjoy:{n:'Reaver',role:'Steals gold from its kills',hp:150,dmg:19,spd:95,e:'🪓'},
 tyrell:{n:'Rose Knight',role:'Mends the men beside it',hp:200,dmg:15,spd:80,e:'🌹'},
 martell:{n:'Sand Snake',role:'Poisoned spear',hp:140,dmg:17,spd:100,e:'🐍'},
};
function armyLvl(a){a=a||ACC;return (a&&a.army&&a.army.lvl)||1;}
function armyMul(a){return 1+0.08*(armyLvl(a)-1);}
function armyCost(l){return ARMY_COST[l-1]||0;}
function armyUnits(a){a=a||ACC;const hu=HOUSE_UNIT[a.house];return ARMY_UNITS.concat([Object.assign({k:'house',house:1},hu)]);}
function unitStats(u,a){const m=armyMul(a);return{hp:Math.round(u.hp*m),dmg:Math.round(u.dmg*m*10)/10,spd:u.spd};}
function trainArmy(){const l=armyLvl();const c=armyCost(l);if(l>=ARMY_MAX||!c||!spendGold(c))return false;if(!ACC.army)ACC.army={lvl:1};ACC.army.lvl=l+1;addXp(Math.round(c/10));persist();return true;}
const UNIT_SVG={
 foot:'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" fill="var(--uc,#b9c3cf)" stroke="#0b1a2e" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 6.5v10M9 9.5h6" stroke="#0b1a2e" stroke-width="1.6" stroke-linecap="round"/></svg>',
 archer:'<svg viewBox="0 0 24 24"><path d="M6 4c6 2 8 8 6 16" fill="none" stroke="var(--uc,#b9c3cf)" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4l6 16" stroke="#0b1a2e" stroke-width="1"/><path d="M4 13l13-7" stroke="#e0c49a" stroke-width="1.8" stroke-linecap="round"/><path d="M17 6l-1.2 3.4 3.4-1.2z" fill="#e3b661" stroke="#0b1a2e" stroke-width=".8"/></svg>',
 rider:'<svg viewBox="0 0 24 24"><path d="M4 17c1-4 4-7 8-7h3l3-4 2 1-2 4v3l-3 3H9l-2 3z" fill="var(--uc,#b9c3cf)" stroke="#0b1a2e" stroke-width="1.4" stroke-linejoin="round"/><path d="M16 4l4 1" stroke="#0b1a2e" stroke-width="1.2"/><circle cx="8" cy="19" r="1.6" fill="#0b1a2e"/><circle cx="16" cy="19" r="1.6" fill="#0b1a2e"/></svg>',
};
function unitIcon(u,house){const hh=HOUSES[house||ACC.house];return u.k==='house'?`<span class="pe">${u.e}</span>`:UNIT_SVG[u.k].replace('<svg',`<svg style="--uc:${hh.col}"`);}
/* ---- the Train room ---- */
function showTrain(){const l=armyLvl(),c=l<ARMY_MAX?armyCost(l):0,hh=HOUSES[ACC.house],units=armyUnits();
  const cards=units.map(u=>{const st=unitStats(u),locked=u.k==='house'&&l<ARMY_HOUSE_AT;
    return `<div class="sitem unit ${locked?'lock':''}" style="--rc:${u.k==='house'?hh.col:'#8fa3bd'}">${u.k==='house'?`<span class="badge" style="background:${hh.col2};color:#fff;border-color:${hh.col}">HOUSE ${hh.n.toUpperCase()}</span>`:''}<span class="ch dic">${unitIcon(u)}</span><b>${u.n}</b><small>${u.role}</small>
      ${locked?`<em class="ust lk">🔒 Train to level ${ARMY_HOUSE_AT}</em>`:`<em class="ust">❤️ ${st.hp} · ⚔️ ${st.dmg} · 🏃 ${st.spd}</em>`}</div>`;}).join('');
  show(`<div class="topbar"><h1>⚔️ Train<small>The yard of ${hh.seat}. Every level is +8% health and damage for the whole army. Your sworn brothers drill here too, and in a Duel this army marches at your rival.</small></h1><button class="back" id="bBack">✖</button></div>
  <div class="lvbox armybox" style="--hc:${hh.col}"><div class="lvline"><b>Army level ${l}</b><span class="bar"><i style="width:${Math.round(100*l/ARMY_MAX)}%"></i></span>${l<ARMY_MAX?`<button id="bTrainUp" ${goldOf()<c?'disabled':''}>TRAIN · ${GOLD_SVG.replace('<svg','<svg style="width:12px;height:12px;vertical-align:-2px"')} ${fmtN(c)}</button>`:'<b style="color:var(--gold)">VETERANS</b>'}</div>
   <small>${l<ARMY_HOUSE_AT?`Level ${ARMY_HOUSE_AT} opens the ${HOUSE_UNIT[ACC.house].n} — and it joins every Brothers call.`:`The ${HOUSE_UNIT[ACC.house].n} rides with every Brothers call.`} Sworn brothers: ×${armyMul().toFixed(2)} health and damage.</small></div>
  <div class="shopgrid">${cards}</div>
  <p class="m" style="font-size:11.5px;margin-top:8px">Training counts as an upgrade — it feeds your account level like any other.</p>
  <button class="btn" id="bOk">✔ Back</button>`);
  CLOUD.screen='train';
  const back=()=>showHub('battle');$('#bBack').addEventListener('click',back);$('#bOk').addEventListener('click',back);
  const up=$('#bTrainUp');if(up)up.addEventListener('click',()=>{if(trainArmy()){SFX.play('upgrade');showTrain();}else SFX.play('deny');});
}
/* ---- the Spell shop and the pack ---- */
const PACK_ITEMS={
 slow:{n:'Hourglass of the Citadel',e:'⏳',cost:120,d:'Every enemy on the road at 40% speed for 10 s'},
 repair:{n:"Mason's mortar",e:'🧱',cost:100,d:'Repairs the door by 250 on the spot'},
 purse:{n:'Iron Bank purse',e:'💰',cost:90,d:'+150 gold into the battle, right now'},
 frost:{n:'Frost wave',e:'❄️',cost:160,d:'Freezes every enemy on the road for 3 s (not bosses)'},
 roar:{n:"Hodor's roar",e:'📣',cost:140,d:'Everything near the gate is thrown back 70 px and stunned 1.5 s'},
};
const PACK_MAX=3;
function packOf(a){a=a||ACC;if(!a.pack)a.pack={};return a.pack;}
function packCount(a){const p=packOf(a);let n=0;for(const k in p)n+=p[k]||0;return n;}
function buyPack(k){const P=PACK_ITEMS[k];if(!P)return false;const p=packOf();if((p[k]||0)>=PACK_MAX||!spendGold(P.cost))return false;p[k]=(p[k]||0)+1;persist();return true;}
function showSpellShop(){const p=packOf();
  const cards=Object.keys(PACK_ITEMS).map(k=>{const P=PACK_ITEMS[k],n=p[k]||0,full=n>=PACK_MAX;
    return `<div class="sitem" style="--rc:#b47cff">${n?`<span class="badge" style="background:#0c1f3a;color:#fff;border-color:#8fd3ff">IN PACK ×${n}</span>`:''}<span class="ch dic"><span class="pe">${P.e}</span></span><b>${P.n}</b><small>${P.d}</small><button data-buy="${k}" ${full||goldOf()<P.cost?'disabled':''}>${full?'PACK FULL':GOLD_SVG+' '+P.cost}</button></div>`;}).join('');
  show(`<div class="topbar"><h1>🧪 Spell shop<small>One-shot items for the pack. In battle, tap 🎒 next to your champion and use <b>one</b> per battle — in the campaign and in the daily Hold. Up to ${PACK_MAX} of each.</small></h1><button class="back" id="bBack">✖</button></div>
  <div class="hh"><h2>Pack · ${packCount()}</h2><small>${GOLD_SVG} ${fmtN(goldOf())} gold</small></div>
  <div class="shopgrid">${cards}</div>
  <button class="btn" id="bOk">✔ Back</button>`);
  CLOUD.screen='spellshop';
  const back=()=>showHub('battle');$('#bBack').addEventListener('click',back);$('#bOk').addEventListener('click',back);
  bind('[data-buy]',b=>{if(buyPack(b.dataset.buy)){SFX.play('buy');showSpellShop();}else SFX.play('deny');});
}
function packBar(play){const b=$('#bPack');if(!b)return;const n=ACC?packCount():0;const showIt=n>0&&!G.tutorial&&G.heroOn;b.style.display=showIt?'flex':'none';if(!showIt)return;
  b.disabled=!play||!!G.packUsed;b.querySelector('.l').textContent=G.packUsed?'Used':'Pack ×'+n;b.classList.toggle('used',!!G.packUsed);}
function openPackSheet(){if(G.state!=='play')return;const p=packOf();const keys=Object.keys(PACK_ITEMS).filter(k=>p[k]>0);
  sheet.innerHTML=`<h3>🎒 Pack <small style="font-size:11px;color:var(--muted)">· one item per battle</small></h3><div class="opts">${keys.map(k=>`<button class="opt" data-pk="${k}" ${G.packUsed?'disabled':''}><span class="e">${PACK_ITEMS[k].e}</span>${PACK_ITEMS[k].n.split(' ')[0]}<b>×${p[k]}</b></button>`).join('')||'<p class="sub">Empty — the Spell shop in your castle fills it.</p>'}</div><p class="sub" id="pkDesc">${G.packUsed?'Used this battle.':'Tap an item to use it now.'}</p><div class="row"><button id="sCancel">✖ Close</button></div>`;
  sheet.querySelectorAll('[data-pk]').forEach(b=>b.addEventListener('click',()=>{usePack(b.dataset.pk);}));
  $('#sCancel').addEventListener('click',()=>closeSheet());sheet.classList.add('open');}
function usePack(k){if(G.state!=='play'||G.packUsed||!(packOf()[k]>0)||!PACK_ITEMS[k])return false;packOf()[k]--;G.packUsed=true;persist();
  const g=heldGate();
  if(k==='slow'){G.slowUntil=Math.max(G.slowUntil||0,G.time+10);addFx({t:'tint',life:10});addFx({t:'flash',life:0.3});addText(g.x,g.y-44,'The hourglass turns','#8fd3ff',1);}
  else if(k==='repair'){G.doorHp=Math.min(G.doorMax,G.doorHp+250);addFx({t:'ring',x:g.x,y:g.y-10,r0:8,r1:60,life:0.6,col:'#7cff6b'});addText(g.x,g.y-44,'+250','#7cff6b',1);}
  else if(k==='purse'){G.gold+=150;addFx({t:'coins',x:g.x,y:g.y-20,life:0.8});addText(g.x,g.y-44,'+150','#e3b661',1);}
  else if(k==='frost'){let n=0;for(const e of G.enemies){if(e.hp>0&&!e.boss){e.stunT=Math.max(e.stunT||0,3);n++;const q=posE(e);addFx({t:'ring',x:q.x,y:q.y-8,r0:4,r1:22,life:0.5,col:'#cdf1ff'});}}addFx({t:'flash',life:0.3});addFx({t:'tint',life:3});addText(g.x,g.y-44,n?'Frozen!':'Nothing on the road','#cdf1ff',1);}
  else if(k==='roar'){let n=0;for(const e of G.enemies){if(e.hp<=0||e.fly)continue;if(remainOf(e)<150){e.prog=Math.max(0,e.prog-70);e.stunT=Math.max(e.stunT||0,1.5);n++;}}addFx({t:'ring',x:g.x,y:g.y-10,r0:10,r1:160,life:0.6,col:'#e9eef5'});G.shake=Math.min(8,(G.shake||0)+5);hodorSay('HODOOOR!',1500);addText(g.x,g.y-44,n?'Thrown back!':'Nobody at the gate','#e9eef5',1);}
  SFX.play('spell');if(G.log)G.log.push({t:G.tick,a:'pack',k});closeSheet();updateBar();return true;}
