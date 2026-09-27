# v1.0.53 — champions II: unique kits for Lannister and Baratheon (13 new skills, 7 new ultimates).
i = s.find("function heroTalent(champId,slot){"); assert i > 0, 'heroTalent anchor'
s = s[:i] + mod('champs53.js').rstrip('\n') + '\n' + s[i:]
hrep("const SK_COL={", "const SK_COL={discipline:'#c9d2dd',ironskin:'#8a97a8',tribute:'#ffd54a',parry:'#ffd23c',contempt:'#b47cff',hand:'#e3b661',forge:'#ff9a3c',duelist:'#e9eef5',rations:'#7fd06a',charm:'#ff7ab8',bloodmagic:'#e14b4b',warhammer:'#e3b661',siegecraft:'#8fd3ff',twoforone:'#ffd54a',kingslayer:'#ffd23c',dgblades:'#8fd3ff',thebold:'#e9eef5',lordoflight:'#e14b4b',fury:'#e0c14a',dawncharge:'#e0c14a',", 1, 'sk-col-53')

# ---- taking damage: Iron Skin, Parry, Contempt, Discipline ----
rep("function hurtHero(a){const h=G.hero;if(h.dead||G.time<h.invulnUntil)return;",
    "function hurtHero(a){const h=G.hero;if(h.dead||G.time<h.invulnUntil)return;const is=skVal(h,'ironskin');if(is)a*=1-is/100;", 1, 'ironskin')
rep("if(blocker===h){hurtHero(e.dps*0.7);", "if(blocker===h){if(!heroParry(e))hurtHero(e.dps*0.7*(e.weak||1));", 1, 'parry-contempt-hero')
rep("else{blocker.hp-=e.dps*0.7;blocker.hitT=G.time;",
    "else{let bd=e.dps*0.7*(e.weak||1);if(alive){const dc=skVal(h,'discipline');if(dc&&dist(blocker.x,blocker.y,h.x,h.y)<=90)bd*=1-dc/100;}blocker.hp-=bd;blocker.hitT=G.time;", 1, 'discipline')
rep("hitDoor(e.dps*0.8,R.gate)", "hitDoor(e.dps*0.8*(e.weak||1),R.gate)", 1, 'contempt-ranged')
rep("hitDoor(e.dps*0.7,R.gate)", "hitDoor(e.dps*0.7*(e.weak||1),R.gate)", 1, 'contempt-gate')
rep("hitDoor((e.gateDps||e.dps)*0.8,e.gate||0)", "hitDoor((e.gateDps||e.dps)*0.8*(e.weak||1),e.gate||0)", 1, 'contempt-flyer')
rep("e.pblk=e.blockedBy;e.blockedBy=null;e.hasted=1;}", "e.pblk=e.blockedBy;e.blockedBy=null;e.hasted=1;e.weak=1;}", 1, 'weak-reset')
rep("if(sa)for(const e of G.enemies){if(e.hp>0&&!e.fly){const p=posE(e);if(dist(p.x,p.y,h.x,h.y)<=80+e.r)e.slow=Math.min(e.slow,1-sa/100);}}",
    "if(sa)for(const e of G.enemies){if(e.hp>0&&!e.fly){const p=posE(e);if(dist(p.x,p.y,h.x,h.y)<=80+e.r)e.slow=Math.min(e.slow,1-sa/100);}}\n    const ct=skVal(h,'contempt');if(ct)for(const e of G.enemies){if(e.hp>0){const p=posE(e);if(dist(p.x,p.y,h.x,h.y)<=80+e.r)e.weak=1-ct/100;}}", 1, 'contempt-aura')

# ---- towers near the champion: Forged Steel (damage), Siegecraft (reach); their pulses share the Rally timer ----
rep("const t=s.tower;if(!t)continue;const def=TOWERS[t.type];const st=towerStats(t);const range=st.range;",
    "const t=s.tower;if(!t)continue;const def=TOWERS[t.type];let st=towerStats(t);if(alive){const fg=skVal(h,'forge'),sg=skVal(h,'siegecraft');if((fg||sg)&&dist(s.x,s.y,h.x,h.y)<=90){st=Object.assign({},st);if(fg){const m=1+fg/100;st.dmg*=m;st.dps*=m;st.burn*=m;if(st.sdmg)st.sdmg=Math.round(st.sdmg*m*10)/10;}if(sg)st.range*=1+sg/100;}}const range=st.range;", 1, 'forge-siege')
rep("if(skLvl(h,'rally')){h.rallyT-=dt;if(h.rallyT<=0){h.rallyT=2;for(const s of map.slots)if(s.tower&&TOWERS[s.tower.type].kind!=='barracks'&&dist(s.x,s.y,h.x,h.y)<=90)addFx({t:'pulse',x:h.x,y:h.y-10,tx:s.x,ty:s.y-10,life:0.45,col:'#e3b661'});}}",
    "const auraC=skLvl(h,'rally')?'#e3b661':skLvl(h,'forge')?'#ff9a3c':skLvl(h,'siegecraft')?'#8fd3ff':null;if(auraC){h.rallyT-=dt;if(h.rallyT<=0){h.rallyT=2;for(const s of map.slots)if(s.tower&&TOWERS[s.tower.type].kind!=='barracks'&&dist(s.x,s.y,h.x,h.y)<=90)addFx({t:'pulse',x:h.x,y:h.y-10,tx:s.x,ty:s.y-10,life:0.45,col:auraC});}}", 1, 'aura-pulses')

# ---- periodic: Tribute (gold), Rations (heals) ----
rep("for(const id of['cleave','shield','heal','summon','volley','trap','howl']){const l=skLvl(h,id);if(!l)continue;h.skT[id]=(h.skT[id]||SK[id].cd*cdMul(h))-dt;if(h.skT[id]>0)continue;",
    "for(const id of['cleave','shield','heal','summon','volley','trap','howl','tribute','rations']){const l=skLvl(h,id);if(!l)continue;h.skT[id]=(h.skT[id]||SK[id].cd*cdMul(h))-dt;if(h.skT[id]>0)continue;\n      if(id==='tribute'){h.skT[id]=SK.tribute.cd*cdMul(h);const tv=skVal(h,'tribute');G.gold+=tv;addText(h.x,h.y-40,'+'+tv,'#e3b661');addFx({t:'coins',x:h.x,y:h.y-20,life:0.5});continue;}\n      if(id==='rations'){h.skT[id]=SK.rations.cd*cdMul(h);const rv=skVal(h,'rations');let n=0;if(h.hp<h.max){h.hp=Math.min(h.max,h.hp+rv);n++;}for(const a of G.allies){if(a.hp<a.max&&dist(a.x,a.y,h.x,h.y)<=100){a.hp=Math.min(a.max,a.hp+rv);n++;addFx({t:'ring',x:a.x,y:a.y-10,r0:3,r1:14,life:0.35,col:'#7fd06a'});}}if(n)addFx({t:'ring',x:h.x,y:h.y-10,r0:6,r1:100,life:0.5,col:'#7fd06a'});continue;}", 1, 'periodic-53')

# ---- on hit: Duelist, Charm, Warhammer ----
rep("const bl=skVal(h,'blood');if(bl&&h.hp<h.max*0.5)a*=1+bl/100;if(h.rageUntil>G.time)a*=1.6;",
    "const bl=skVal(h,'blood');if(bl&&h.hp<h.max*0.5)a*=1+bl/100;if(h.rageUntil>G.time)a*=1.6;const du=skVal(h,'duelist');if(du&&(e.boss||e.mini||(e.big||1)>=1.4))a*=1+du/100;", 1, 'duelist')
rep("const kn=skVal(h,'knock');", "const chm=skVal(h,'charm');if(chm&&!e.boss&&!e.fly&&G.rng()*100<chm){e.charmT=G.time+2;const pc=posE(e);addFx({t:'ring',x:pc.x,y:pc.y-12,r0:3,r1:16,life:0.35,col:'#ff7ab8'});}\n  const kn=skVal(h,'knock');", 1, 'charm-hit')
rep("function heroAfterHit(e,a){const h=G.hero;if(!h)return;",
    "function heroAfterHit(e,a){const h=G.hero;if(!h)return;if(h.type==='melee'){const wh=skVal(h,'warhammer');if(wh){const q=posE(e);let n=0;for(const o of G.enemies){if(o===e||o.hp<=0||o.fly)continue;const r=posE(o);if(dist(r.x,r.y,q.x,q.y)<=30+o.r){dmg(o,a*wh/100,'hero');n++;}}if(n)addFx({t:'ring',x:q.x,y:q.y-4,r0:4,r1:30,life:0.25,col:'#e3b661'});}}", 1, 'warhammer')
# a charmed wight walks back for 2 s and wears a pink heart
rep("if(G.wallUntil>G.time&&!e.boss&&R.gate===G.wallGate&&remain<=92&&remain>60){",
    "if(e.charmT>G.time&&!e.boss){const cs=spd*0.7;e.prog=Math.max(0,e.prog-cs*dt);e.vel=0;e.moving=true;e.walk=(e.walk||0)+cs*dt;continue;}\n    if(G.wallUntil>G.time&&!e.boss&&R.gate===G.wallGate&&remain<=92&&remain>60){", 1, 'charm-walk')
rep("  if(e.stunT>0){ctx.fillStyle='#ffe66d';", "  if(e.charmT>G.time){ctx.fillStyle='#ff7ab8';const hy=top-6;ctx.beginPath();ctx.arc(x-2.4,hy,2.6,Math.PI,0);ctx.arc(x+2.4,hy,2.6,Math.PI,0);ctx.lineTo(x,hy+6);ctx.closePath();ctx.fill();}\n  if(e.stunT>0){ctx.fillStyle='#ffe66d';", 1, 'charm-draw')

# ---- Blood Magic: deaths near the champion mend the door ----
rep("const q=posE(e);if(src==='hero'&&G.hero&&skLvl(G.hero,'goldtouch')){",
    "const q=posE(e);if(G.hero&&G.heroOn&&!G.hero.dead){const bm=skVal(G.hero,'bloodmagic');if(bm&&G.doorHp<G.doorMax&&dist(q.x,q.y,G.hero.x,G.hero.y)<=100){G.doorHp=Math.min(G.doorMax,G.doorHp+bm);const hg=heldGate();addFx({t:'wave',x:q.x,y:q.y-8,tx:hg.x,ty:GATE_Y-12,life:0.45,col:'#e14b4b'});}}if(src==='hero'&&G.hero&&skLvl(G.hero,'goldtouch')){", 1, 'bloodmagic')

# ---- Hand of the King: cheaper towers in battle ----
rep("function costOf(type){return Math.round(TOWERS[type].cost[0]*Math.pow(1.17,G.typeCount[type]||0));}",
    "function costOf(type){return Math.round(TOWERS[type].cost[0]*Math.pow(1.17,G.typeCount[type]||0)*handMul());}", 1, 'hand-build')
rep("function upCost(t){return upPrice(t.type,t.lvl);}", "function upCost(t){return Math.round(upPrice(t.type,t.lvl)*handMul());}", 1, 'hand-upgrade')

# ---- attack speed buffs: Two for One (frenzy), Ours Is the Fury ----
rep("h.atkT=h.rate;h.strikeT=G.time;const p=posE(best);", "h.atkT=h.rate*(h.furyUntil>G.time?0.67:1)*(h.frenzyUntil>G.time?0.5:1);h.strikeT=G.time;const p=posE(best);", 1, 'melee-rate')
rep("heroHit(best,h.dmg);addFx({t:'arc'", "heroHit(best,h.dmg);if(h.furyUntil>G.time){let fn=0;for(const o of G.enemies){if(o===best||o.hp<=0||o.fly)continue;const r=posE(o);if(dist(r.x,r.y,h.x,h.y)<=55+o.r){heroHit(o,h.dmg);fn++;}}if(fn)addFx({t:'ring',x:h.x,y:h.y-8,r0:6,r1:55,life:0.25,col:HOUSES[ACC.house].col});}addFx({t:'arc'", 1, 'fury-hits')
rep("else{const ms=cntOf(skVal(h,'multishot')||1);", "else{const ms=cntOf(skVal(h,'multishot')||1)+(h.frenzyUntil>G.time?1:0);", 1, 'frenzy-targets')
rep("h.atkT=h.rate;h.strikeT=G.time;const hc=HOUSES", "h.atkT=h.rate*(h.frenzyUntil>G.time?0.5:1);h.strikeT=G.time;const hc=HOUSES", 1, 'frenzy-rate')

# ---- Dragonglass Blades: towers ignore ice and cannot be frozen ----
rep("if(e.ice&&src!=='glass'&&src!=='hero'&&src!=='power')v*=1-e.ice;", "if(e.ice&&src!=='glass'&&src!=='hero'&&src!=='power'&&!(G.dgUntil>G.time))v*=1-e.ice;", 1, 'dg-ice')
rep("e.tgt.tower.frozen=G.time+2.5;", "if(!(G.dgUntil>G.time))e.tgt.tower.frozen=G.time+2.5;", 1, 'dg-raven')
rep("cands[i].tower.frozen=G.time+dur;", "if(!(G.dgUntil>G.time))cands[i].tower.frozen=G.time+dur;", 1, 'dg-walker')
rep("G.goldx2Until=0;", "G.goldx2Until=0;G.dgUntil=0;", 1, 'dg-reset')

# ---- the seven new ultimates ----
rep("    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;",
    """    case'twoforone':h.frenzyUntil=G.time+v;addFx({t:'burst',x:h.x,y:h.y-14,r0:4,r1:30,life:0.4,col:'#e3b661'});addText(h.x,h.y-40,'Two for one!','#e3b661',1);SFX.play('arrow',120);break;
    case'kingslayer':{const tg=G.enemies.filter(e=>e.hp>0).sort((a,b)=>b.hp-a.hp)[0];if(!tg){addText(h.x,h.y-40,'No king to slay','#ffd23c',1);break;}const p=posE(tg);dmg(tg,v,'hero');addFx({t:'pulse',x:h.x,y:h.y-12,tx:p.x,ty:p.y-10,life:0.3,col:'#ffd23c'});addFx({t:'xslash',x:p.x,y:p.y-8,life:0.5,delay:0.12});addFx({t:'ring',x:p.x,y:p.y,r0:6,r1:44,life:0.5,col:'#ffd23c',delay:0.12});addText(p.x,p.y-30,Math.round(v)+'!','#ffd23c',1);G.hitStop=0.08;SFX.play('crit',120);break;}
    case'dgblades':G.dgUntil=G.time+v;for(const s of G.map.slots){if(!s.tower)continue;s.tower.frozen=0;addFx({t:'ring',x:s.x,y:s.y-10,r0:4,r1:22,life:0.5,col:'#8fd3ff'});}addText(h.x,h.y-40,'Dragonglass!','#8fd3ff',1);SFX.play('upgrade');break;
    case'thebold':{const tg=G.enemies.filter(e=>e.hp>0&&!e.fly).sort((a,b)=>remainOf(a)-remainOf(b))[0];if(!tg){addText(h.x,h.y-40,'Nobody to face','#e9eef5',1);break;}const p=posE(tg),ox=h.x,oy=h.y;h.x=clamp(p.x+(p.x>ox?-14:14),10,W-10);h.y=Math.min(GATE_Y-14,p.y);h.tx=null;h.landT=G.time;addFx({t:'puff',x:ox,y:oy,r:14,life:0.4,rgb:'220,220,230'});addFx({t:'pulse',x:ox,y:oy-10,tx:h.x,ty:h.y-10,life:0.25,col:'#e9eef5'});for(const e of near(70))dmg(e,v,'hero');addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:70,life:0.45,col:'#e9eef5'});addFx({t:'cleave',x:h.x,y:h.y-10,life:0.34,col:hc});G.shake=Math.min(8,G.shake+3);SFX.play('slash',120);break;}
    case'lordoflight':for(const e of G.enemies){if(e.hp<=0)continue;const p=posE(e);dmg(e,e.hp*v/100*(e.boss?0.5:1),'power');addFx({t:'fire',x:p.x,y:p.y-4,r0:3,r1:18,life:0.5,col:'#e14b4b',delay:G.rng()*0.3});}addFx({t:'flash',life:0.3});SFX.play('fire',120);break;
    case'fury':h.furyUntil=G.time+v;addFx({t:'burst',x:h.x,y:h.y-12,r0:6,r1:40,life:0.5,col:hc});addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:55,life:0.6,col:hc});SFX.play('roar',120);break;
    case'dawncharge':{const R=frontRoute();for(const e of G.enemies){if(e.hp<=0||e.fly||(e.route||0)!==R.i)continue;dmg(e,v,'hero');if(e.hp>0&&!e.boss)e.prog=Math.max(0,e.prog-30);}for(let d=R.total-20,i=0;d>20;d-=40,i++){const q=posAt(G.map,d,R.i);addFx({t:'puff',x:q.x,y:q.y,r:10,life:0.45,delay:i*0.05,rgb:hexRGB(hc)});}addText(gate.x,GATE_Y-44,'Horns at dawn!',hc,1);G.shake=Math.min(8,G.shake+3);SFX.play('horn',200);break;}
    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;""", 1, 'ults-53')
