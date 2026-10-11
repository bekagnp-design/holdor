/* =========================== HOUSE TROOPS (v1.1.0) ===========================
   Every house has its own soldiers: four roles — foot, archer, rider and the house's own unit — with the house's names, colours and
   silhouettes (`TROOPS`, drawn by `drawTroopBody`). They garrison the Watch keeps: the Train room chooses which role holds the keeps
   (`ACC.army.keep`; the house unit after army level 5), and every keep soldier is dressed by `troopDress` — the keep's numbers stay
   `towerStats`', the role scales them. Archers shoot from 95 px; riders are fast; the house units keep their old tricks (bites twice,
   half damage, stun, never flinches, loot, mends, poison), now in the keeps too. From v1.1.1 the same troops march at a rival in
   Houses Clash. The sworn brothers (the spell) stay the Watch. */
const TROOP_ROLES=['foot','archer','rider','house'];
const TROOP_ROLE={foot:{n:'Foot',hp:1,dmg:1,spd:1,role:'Holds the road, shield up',weapon:'sword',shield:'round'},
 archer:{n:'Archer',hp:0.7,dmg:0.85,spd:0.95,range:95,role:'Shoots from 95 px, behind the line',weapon:'bow'},
 rider:{n:'Rider',hp:0.85,dmg:1.3,spd:1.6,leash:90,role:'Fast — first to the fight',weapon:'spear',horse:1}};
const TROOPS={
 stark:{foot:'Winterfell guard',archer:'Northern bowman',rider:'Northern rider',house:{n:'Direwolf',role:'Fast, bites twice',hp:1.15,dmg:1.4,spd:1.7,rate:0.4,beast:1}},
 lannister:{foot:'Red cloak',archer:'Westerland crossbowman',rider:'Lannister knight',house:{n:'Lion Guard',role:'Full plate — takes half damage',hp:1.7,dmg:1.05,spd:0.85,armor:0.5,weapon:'sword',shield:'big',plate:'#c9a24a'}},
 baratheon:{foot:'Stormlander',archer:'Stormlands bowman',rider:'Stag rider',house:{n:'Stormhammer',role:'Stuns whatever it hits',hp:1.3,dmg:1.6,spd:0.9,stun:1,weapon:'hammer',plate:'#3b3a30'}},
 targaryen:{foot:'Dragonstone guard',archer:'Dothraki archer',rider:'Dothraki screamer',house:{n:'Unsullied',role:'Spear wall — never flinches',hp:1.25,dmg:1.2,spd:1,steady:1,weapon:'spear',shield:'round',helm:'spike',plate:'#2a2a2e'}},
 greyjoy:{foot:'Ironborn',archer:'Ironborn slinger',rider:'Salt rider',house:{n:'Reaver',role:'Steals gold from its kills',hp:1,dmg:1.25,spd:1.1,loot:3,weapon:'axe',helm:'none',plate:'#2b3a40'}},
 tyrell:{foot:'Highgarden footman',archer:'Reach bowman',rider:'Reach knight',house:{n:'Rose Knight',role:'Mends the men beside it',hp:1.3,dmg:1,spd:0.95,mend:6,weapon:'sword',shield:'rose',plate:'#2f5a2a'}},
 martell:{foot:'Dornish spearman',archer:'Dornish archer',rider:'Sand rider',house:{n:'Sand Snake',role:'Poisoned spear',hp:0.95,dmg:1.15,spd:1.2,poison:4,weapon:'spear',helm:'scarf',plate:'#8a4a22'}},
};
const TROOP_BASE={hp:150,dmg:15,spd:86};
function troopDef(house,role){const T=TROOPS[house]||TROOPS.stark;if(role==='house')return Object.assign({k:'house',hp:1,dmg:1,spd:1},T.house);if(!TROOP_ROLE[role])role='foot';return Object.assign({},TROOP_ROLE[role],{k:role,n:T[role]});}
function troopUnits(a){a=a||ACC;return TROOP_ROLES.map(k=>troopDef(a.house,k));}
function troopStats(d,a){const m=armyMul(a);return{hp:Math.round(TROOP_BASE.hp*d.hp*m),dmg:Math.round(TROOP_BASE.dmg*d.dmg*m*10)/10,spd:Math.round(TROOP_BASE.spd*d.spd)};}
function keepRole(a){a=a||ACC;const k=a&&a.army&&a.army.keep;if(!k||!TROOPS.stark[k]&&k!=='house')return 'foot';if(k==='house'&&armyLvl(a)<ARMY_HOUSE_AT)return 'foot';return k;}
/* dress a keep's soldier (hp/dmg from towerStats) in a role of the house */
function troopDress(a,role,house){house=house||(ACC&&ACC.house)||'stark';role=role||keepRole();const d=troopDef(house,role);
  a.role=role;a.troop=house;a.hp=Math.round(a.hp*d.hp);a.max=Math.round(a.max*d.hp);a.dmg=a.dmg*d.dmg;a.spd=Math.round((a.spd||64)*d.spd);
  if(d.leash)a.leash=d.leash;if(d.range)a.range=d.range;if(d.rate)a.rate=d.rate;if(d.armor)a.armor=d.armor;if(d.stun)a.stun=d.stun;if(d.steady)a.steady=1;if(d.loot)a.loot=d.loot;if(d.mend)a.mend=d.mend;if(d.poison)a.poison=d.poison;if(d.beast)a.beast=1;return a;}
/* a soldier's blow: an arrow from an archer, then the house tricks */
function allyStrike(a,e,amt){const was=e.hp>0;if(a.range){const q=posE(e);addFx({t:'arrow',x:a.x,y:a.y-16,tx:q.x,ty:q.y-6,life:0.16});}
  dmg(e,amt,'ally');
  if(e.hp>0){if(a.stun)e.stunT=Math.max(e.stunT||0,a.stun);if(a.poison&&!(e.poison&&e.poison.dps>=a.poison))e.poison={dps:a.poison,t:3};}
  else if(was&&a.loot){G.gold+=a.loot;addText(a.x,a.y-30,'+'+a.loot,'#e3b661');}}
function troopMend(a,dt){a.mendT=(a.mendT||0)-dt;if(a.mendT>0)return;a.mendT=0.5;let did=0;
  for(const o of G.allies){if(o===a||o.hp<=0||o.hp>=o.max||dist(o.x,o.y,a.x,a.y)>40)continue;o.hp=Math.min(o.max,o.hp+a.mend*0.5);did=1;}
  if(did)addFx({t:'ring',x:a.x,y:a.y-8,r0:6,r1:28,life:0.3,col:'#7fd06a'});}
/* ---------- the silhouettes: one body, the house's colours, the role's gear ---------- */
function drawTroopBody(c,a,now){const house=a.troop||(ACC&&ACC.house)||'stark',hh=HOUSES[house],f=a.face||1,d=troopDef(house,a.role||'foot');
  const ph=a.moving?Math.sin((a.walk||0)*9):0,bob=a.moving?Math.abs(ph)*0.8:0,sw=a.strikeT!=null?Math.max(0,1-(G.time-a.strikeT)/0.26):0,hurt=a.hitT!=null&&G.time-a.hitT<0.12;
  c.save();c.translate(a.x,a.y);c.fillStyle='rgba(0,0,0,0.34)';ell(c,0,1.5,d.horse?15:d.beast?13:11,d.horse?4.6:3.8);
  c.scale(1.62*f,1.62);c.translate(0,-bob);
  if(d.beast)troopBeast(c,hh,ph,sw,hurt);
  else{if(d.horse){troopHorse(c,hh,ph);c.translate(1,-7.5);c.scale(0.82,0.82);}troopMan(c,hh,d,ph,sw,hurt);}
  c.restore();}
function troopMan(c,hh,d,ph,sw,hurt){const cloak=hh.col2,cloak2=hexA(hh.col,1),tunic=d.plate||(d.weapon==='bow'?'#5a4632':hh.col2),steel='#b9c3cf',steel2='#6d7886';
  /* cloak */
  c.fillStyle=cloak;c.beginPath();c.moveTo(-2.5,-15.5);c.quadraticCurveTo(-9.5-1.6*ph,-7,-7.5-ph,0.6);c.lineTo(1.5,0.4);c.lineTo(2,-14);c.closePath();c.fill();c.strokeStyle='rgba(0,0,0,0.45)';c.lineWidth=0.7;c.stroke();
  /* legs */
  c.strokeStyle='#15171d';c.lineWidth=2.3;c.lineCap='round';c.beginPath();c.moveTo(-1.4,-5.5);c.lineTo(-2.2+2.4*ph,0);c.moveTo(1.6,-5.5);c.lineTo(2.4-2.4*ph,0);c.stroke();
  /* torso, belt, shoulders */
  c.fillStyle=tunic;rr(c,-4.3,-15,8.6,10.5,2.6);c.fill();c.strokeStyle='rgba(0,0,0,0.5)';c.lineWidth=0.7;rr(c,-4.3,-15,8.6,10.5,2.6);c.stroke();
  c.fillStyle=hh.col;c.fillRect(-4.3,-8.4,8.6,1.7);c.fillStyle=cloak2;c.fillRect(-4.3,-15,8.6,2.2);
  if(d.plate){c.fillStyle='rgba(255,255,255,0.18)';c.fillRect(-3.4,-13.6,2.2,6);}
  if(d.weapon==='bow'){c.fillStyle='#4a3826';c.fillRect(-5.2,-16,1.8,9);c.fillStyle='#e3b661';c.fillRect(-5.4,-17,2.2,1.4);}
  /* the weapon arm: rests forward, swings on a hit */
  const ang=d.weapon==='bow'?-0.2+0.05*ph:sw>0?(-2.3+2.9*(1-sw)):-0.55+0.1*ph;
  c.save();c.translate(2.2,-12.2);c.rotate(ang);c.strokeStyle=hurt?'#fff':'#e0c49a';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(4.5,0);c.stroke();
  if(d.weapon==='sword'){c.fillStyle='#3a2a18';c.fillRect(4,-1.3,1.6,2.6);c.fillStyle=steel;c.beginPath();c.moveTo(5.6,-0.9);c.lineTo(15.5,-0.3);c.lineTo(16.8,0.2);c.lineTo(15.5,0.7);c.lineTo(5.6,0.9);c.closePath();c.fill();c.fillStyle='#fff';c.globalAlpha*=0.55;c.fillRect(6,-0.6,9,0.5);}
  else if(d.weapon==='spear'){c.strokeStyle='#5a3f22';c.lineWidth=1.3;c.beginPath();c.moveTo(3,0);c.lineTo(19,0);c.stroke();c.fillStyle=steel;c.beginPath();c.moveTo(18.5,-1.3);c.lineTo(23,0);c.lineTo(18.5,1.3);c.closePath();c.fill();c.fillStyle=hh.col;c.fillRect(16.5,-1.6,1.2,3.2);}
  else if(d.weapon==='hammer'){c.strokeStyle='#5a3f22';c.lineWidth=1.5;c.beginPath();c.moveTo(3,0);c.lineTo(13,0);c.stroke();c.fillStyle=steel2;c.fillRect(11,-3,4.6,6);c.fillStyle=steel;c.fillRect(11,-3,4.6,1.4);}
  else if(d.weapon==='axe'){c.strokeStyle='#5a3f22';c.lineWidth=1.4;c.beginPath();c.moveTo(3,0);c.lineTo(14,0);c.stroke();c.fillStyle=steel;c.beginPath();c.moveTo(11,-0.5);c.quadraticCurveTo(13.5,-5,16.5,-3.4);c.quadraticCurveTo(16.5,0.5,13.5,2.8);c.lineTo(11,0.5);c.closePath();c.fill();}
  else if(d.weapon==='bow'){c.strokeStyle='#6b4a2a';c.lineWidth=1.5;c.beginPath();c.moveTo(4.5,-8);c.quadraticCurveTo(10.5,0,4.5,8);c.stroke();c.strokeStyle='#e9e3d0';c.lineWidth=0.6;c.beginPath();c.moveTo(4.5,-8);c.lineTo(4.5+(sw>0?0:-2),0);c.lineTo(4.5,8);c.stroke();
    if(sw>0){c.strokeStyle='#e0c49a';c.lineWidth=0.9;c.beginPath();c.moveTo(2,0);c.lineTo(11,0);c.stroke();}}
  c.restore();
  if(sw>0.35&&d.weapon!=='bow'){c.strokeStyle='rgba(255,255,255,'+(0.5*sw)+')';c.lineWidth=1.6;c.beginPath();c.arc(2.2,-12.2,15,-2.1,-2.1+2.6*(1-sw));c.stroke();}
  /* head and helm */
  c.fillStyle=hurt?'#fff':'#d8b28c';c.beginPath();c.arc(0.6,-18.6,3.4,0,Math.PI*2);c.fill();
  const helm=d.helm||'steel';
  if(helm==='steel'||helm==='spike'){c.fillStyle=steel2;c.beginPath();c.arc(0.6,-19.4,3.9,Math.PI,0);c.fill();c.fillStyle=steel;c.beginPath();c.arc(0.2,-20,2.9,Math.PI*1.05,Math.PI*1.6);c.lineTo(0.6,-19.4);c.fill();c.fillStyle=steel2;c.fillRect(2.6,-19.6,1,3.4);
    if(helm==='spike'){c.fillStyle=steel;c.beginPath();c.moveTo(-0.6,-22.8);c.lineTo(0.6,-27.5);c.lineTo(1.8,-22.8);c.closePath();c.fill();}else{c.fillStyle=hh.col;c.fillRect(-0.3,-24.2,1.6,1.8);}}
  else if(helm==='scarf'){c.fillStyle=hh.col;c.beginPath();c.arc(0.6,-19.6,3.9,Math.PI*0.95,Math.PI*2.05);c.fill();c.fillStyle=hh.col2;c.fillRect(-3.2,-20.2,7.6,1.3);c.fillStyle=hh.col;c.beginPath();c.moveTo(-3,-19.4);c.quadraticCurveTo(-6.5,-16,-5.5,-12.5);c.lineTo(-3.4,-15.5);c.closePath();c.fill();}
  else{c.fillStyle='#3b2a1c';c.beginPath();c.arc(0.6,-19.6,3.6,Math.PI*0.95,Math.PI*2.02);c.fill();}
  /* the shield on the leading arm */
  if(d.shield){const sx=3.2,sy=-9.8;c.fillStyle=d.shield==='rose'?'#2f5a2a':hh.col;c.beginPath();
    if(d.shield==='big')c.ellipse(sx+0.4,sy+0.8,4.4,6.2,0,0,Math.PI*2);else if(d.shield==='round')c.arc(sx,sy,4,0,Math.PI*2);else c.ellipse(sx,sy,3.4,4.6,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#e9d8a6';c.lineWidth=1.1;c.stroke();c.fillStyle=d.shield==='rose'?'#ff7ab8':'#f3e7c4';c.beginPath();c.arc(sx,sy,d.shield==='rose'?1.5:1.1,0,Math.PI*2);c.fill();}
}
function troopHorse(c,hh,ph){const k=ph*1.6;c.fillStyle='#5a4030';
  c.strokeStyle='#3d2a1e';c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(-7,-5);c.lineTo(-8-k,0);c.moveTo(-4,-5);c.lineTo(-3+k,0);c.moveTo(4,-5);c.lineTo(3-k,0);c.moveTo(7,-5);c.lineTo(8+k,0);c.stroke();
  ell(c,-1,-7.5,10.5,4.3);c.beginPath();c.moveTo(7,-9);c.quadraticCurveTo(11,-13,12,-17);c.lineTo(14.5,-16.5);c.quadraticCurveTo(13,-11,9,-7);c.closePath();c.fill();
  ell(c,13.6,-17.2,3.2,2.1);c.fillStyle=hh.col2;c.beginPath();c.moveTo(9.5,-12);c.quadraticCurveTo(11.5,-16.5,13.5,-18.5);c.lineTo(12,-19.4);c.quadraticCurveTo(10,-16.5,8.3,-12.6);c.closePath();c.fill();
  c.strokeStyle='#3d2a1e';c.lineWidth=1.6;c.beginPath();c.moveTo(-11,-8);c.quadraticCurveTo(-15,-6+k,-14,-1);c.stroke();
  c.fillStyle=hh.col;rr(c,-4.5,-11,8,3.4,1.2);c.fill();c.fillStyle='#0b0d12';c.beginPath();c.arc(14.6,-17.8,0.6,0,Math.PI*2);c.fill();}
function troopBeast(c,hh,ph,sw,hurt){const k=ph*1.8,lunge=sw*2.5;c.translate(lunge,0);const fur=hurt?'#fff':'#8d99a6',fur2='#5f6b78';
  c.strokeStyle=fur2;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(-6,-4);c.lineTo(-7-k,0);c.moveTo(-3,-4);c.lineTo(-2+k,0);c.moveTo(4,-4);c.lineTo(3-k,0);c.moveTo(6.5,-4);c.lineTo(7.5+k,0);c.stroke();
  c.fillStyle=fur;ell(c,0,-6.5,9,3.8);c.fillStyle=fur2;ell(c,-1,-5,7,2);c.fillStyle=fur;
  c.beginPath();c.moveTo(6,-8.5);c.lineTo(13.5,-9.5+sw);c.lineTo(13,-6.5);c.lineTo(6.5,-5);c.closePath();c.fill();
  c.beginPath();c.moveTo(7,-9);c.lineTo(8,-12.5);c.lineTo(9.6,-9.4);c.moveTo(9.5,-9.2);c.lineTo(10.8,-12.2);c.lineTo(11.8,-9);c.fill();
  c.strokeStyle=fur2;c.lineWidth=1.8;c.beginPath();c.moveTo(-9,-7);c.quadraticCurveTo(-13,-9-k,-12.5,-13);c.stroke();
  c.fillStyle='#ffe66d';c.beginPath();c.arc(10.4,-8.6,0.6,0,Math.PI*2);c.fill();c.fillStyle='#0b0d12';c.beginPath();c.arc(13.4,-8.3,0.7,0,Math.PI*2);c.fill();
  c.fillStyle=hh.col;c.fillRect(-2.5,-9.2,1.6,2.6);}
/* a small picture of a troop for the Train room */
function troopPreview(cv,house,role){const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);c.save();const s=cv.width/48;c.scale(s,s);
  drawTroopBody(c,{x:22,y:40,face:1,role,troop:house,moving:false},performance.now());c.restore();}
/* ---------- the Train room: the four troops of the house, and who holds the keeps ---------- */
function showTrain(){const l=armyLvl(),c=l<ARMY_MAX?armyCost(l):0,hh=HOUSES[ACC.house],units=troopUnits(),kr=keepRole();
  const cards=units.map(u=>{const st=troopStats(u),locked=u.k==='house'&&l<ARMY_HOUSE_AT,on=u.k===kr;
    return `<div class="sitem unit troop ${locked?'lock':''} ${on?'on':''}" data-r="${u.k}" style="--rc:${hh.col}">${u.k==='house'?`<span class="badge" style="background:${hh.col2};color:#fff;border-color:${hh.col}">HOUSE ${hh.n.toUpperCase()}</span>`:''}<canvas class="tpv" width="96" height="96" data-r="${u.k}"></canvas><b>${u.n}</b><small>${u.role}</small>
      ${locked?`<em class="ust lk">🔒 Train to level ${ARMY_HOUSE_AT}</em>`:`<em class="ust">❤️ ${st.hp} · ⚔️ ${st.dmg} · 🏃 ${st.spd}</em>`}<em class="tgar">${on?'✔ holds the keeps':locked?'':'tap — holds the keeps'}</em></div>`;}).join('');
  show(`<div class="topbar"><h1>⚔️ Train<small>The yard of ${hh.seat}: the soldiers of House ${hh.n}. Every level is +8% health and damage for the whole army; the one you pick holds every Watch keep you build.</small></h1><button class="back" id="bBack">✖</button></div>
  <div class="lvbox armybox" style="--hc:${hh.col}"><div class="lvline"><b>Army level ${l}</b><span class="bar"><i style="width:${Math.round(100*l/ARMY_MAX)}%"></i></span>${l<ARMY_MAX?`<button id="bTrainUp" ${goldOf()<c?'disabled':''}>TRAIN · ${GOLD_SVG.replace('<svg','<svg style="width:12px;height:12px;vertical-align:-2px"')} ${fmtN(c)}</button>`:'<b style="color:var(--gold)">VETERANS</b>'}</div>
   <small>${l<ARMY_HOUSE_AT?`Level ${ARMY_HOUSE_AT} opens the ${TROOPS[ACC.house].house.n} — for the keeps and every Brothers call.`:`The ${TROOPS[ACC.house].house.n} rides with every Brothers call.`} Sworn brothers: ×${armyMul().toFixed(2)} health and damage.</small></div>
  <div class="shopgrid troops">${cards}</div>
  <p class="m" style="font-size:11.5px;margin-top:8px">Training counts as an upgrade — it feeds your account level like any other. The keep's numbers come from its tier; the role scales them (archers shoot from 95 px, riders hit harder, the house unit keeps its trick).</p>
  <button class="btn" id="bOk">✔ Back</button>`);
  CLOUD.screen='train';
  const back=()=>showHub('battle');$('#bBack').addEventListener('click',back);$('#bOk').addEventListener('click',back);
  const up=$('#bTrainUp');if(up)up.addEventListener('click',()=>{if(trainArmy()){SFX.play('upgrade');showTrain();}else SFX.play('deny');});
  card.querySelectorAll('canvas.tpv').forEach(cv=>{try{troopPreview(cv,ACC.house,cv.dataset.r);}catch(e){}});
  card.querySelectorAll('.sitem.troop').forEach(el=>el.addEventListener('click',()=>{if(el.classList.contains('lock')){SFX.play('deny');return;}if(!ACC.army)ACC.army={lvl:1};ACC.army.keep=el.dataset.r;persist();SFX.play('tap',80);showTrain();}));
}
