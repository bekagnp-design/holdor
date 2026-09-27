# v1.0.54 — champions III: unique kits for Greyjoy and Tyrell (11 new skills, 12 new ultimates).
i = s.find("function heroTalent(champId,slot){"); assert i > 0, 'heroTalent anchor'
s = s[:i] + mod('champs54.js').rstrip('\n') + '\n' + s[i:]
hrep("const SK_COL={", "const SK_COL={quickstudy:'#cfe6ff',drownaura:'#4fb8c8',bleed:'#e14b4b',reave:'#d8b74a',storm:'#cfe6ff',whatisdead:'#4fb8c8',thorns:'#b33f5a',drill:'#c9a06a',momentum:'#7fd06a',keepback:'#cfe6ff',favour:'#ff7ab8',oldtales:'#cfe6ff',drowned:'#4fb8c8',ironprice:'#d8b74a',axestorm:'#8a97a8',ironfleet:'#4fb8c8',ironarrow:'#e3b661',growing:'#7fd06a',muster:'#c9a06a',harvest:'#b47cff',queenthorns:'#7cff6b',slayer:'#8fd3ff',queenroses:'#ff7ab8',", 1, 'sk-col-54')

# ---- the champion's own aura block: Drowning Tide, Fall Back, Axe Storm ticks ----
rep("const ct=skVal(h,'contempt');if(ct)for(const e of G.enemies){if(e.hp>0){const p=posE(e);if(dist(p.x,p.y,h.x,h.y)<=80+e.r)e.weak=1-ct/100;}}",
    """const ct=skVal(h,'contempt');if(ct)for(const e of G.enemies){if(e.hp>0){const p=posE(e);if(dist(p.x,p.y,h.x,h.y)<=80+e.r)e.weak=1-ct/100;}}
    const dau=skVal(h,'drownaura');if(dau){for(const e of G.enemies){if(e.hp>0&&!e.fly){const p=posE(e);if(dist(p.x,p.y,h.x,h.y)<=70+e.r)dmg(e,dau*dt,'hero',true);}}h.daT=(h.daT||0)-dt;if(h.daT<=0){h.daT=1.5;addFx({t:'ring',x:h.x,y:h.y,r0:10,r1:70,life:0.6,col:'#4fb8c8'});}}
    const kb=skVal(h,'keepback');if(kb){h.kbT=(h.kbT||0)-dt;if(h.kbT<=0&&h.tx==null){const en=G.enemies.find(e=>e.hp>0&&!e.fly&&dist(posE(e).x,posE(e).y,h.x,h.y)<=34+e.r);if(en){const p=posE(en);const dx=h.x-p.x,dy=h.y-p.y,l=Math.hypot(dx,dy)||1;h.tx=clamp(h.x+dx/l*44,12,W-12);h.ty=clamp(h.y+dy/l*44,24,GATE_Y-14);h.kbT=kb;addText(h.x,h.y-36,'fall back!','#cfe6ff');}}}
    if(h.stormUntil>G.time){h.stT=(h.stT||0)-dt;if(h.stT<=0){h.stT=0.5;for(const e of G.enemies){if(e.hp>0&&!e.fly){const p=posE(e);if(dist(p.x,p.y,h.x,h.y)<=60+e.r)dmg(e,h.dmg*1.2,'hero');}}addFx({t:'cleave',x:h.x,y:h.y-10,life:0.3,col:HOUSES[ACC.house].col});SFX.play('slash',140);}}""", 1, 'aura-54')

# ---- Growing Strong: towers ramp up while it lasts ----
rep("if(sg)st.range*=1+sg/100;}}const range=st.range;",
    "if(sg)st.range*=1+sg/100;}}if(G.growUntil>G.time){st=Object.assign({},st);const gm=1+Math.min(0.5,0.05*(G.time-G.growT0));st.dmg*=gm;st.dps*=gm;st.burn*=gm;}const range=st.range;", 1, 'growing')

# ---- Stormcaller joins the periodic loop ----
rep("'tribute','rations']){const l=skLvl(h,id);if(!l)continue;h.skT[id]=(h.skT[id]||SK[id].cd*cdMul(h))-dt;if(h.skT[id]>0)continue;",
    "'tribute','rations','storm']){const l=skLvl(h,id);if(!l)continue;h.skT[id]=(h.skT[id]||SK[id].cd*cdMul(h))-dt;if(h.skT[id]>0)continue;\n      if(id==='storm'){const l2=G.enemies.filter(e=>e.hp>0&&dist(posE(e).x,posE(e).y,h.x,h.y)<=150);if(!l2.length)continue;h.skT[id]=SK.storm.cd*cdMul(h);const e=l2[Math.floor(G.rng()*l2.length)];const p=posE(e);dmg(e,skVal(h,'storm'),'hero');addFx({t:'pulse',x:p.x+6,y:p.y-90,tx:p.x,ty:p.y-8,life:0.18,col:'#cfe6ff'});addFx({t:'ring',x:p.x,y:p.y-6,r0:3,r1:20,life:0.3,col:'#cfe6ff'});SFX.play('bolt',120);continue;}", 1, 'storm-periodic')

# ---- hits: Tourney Lance (after riding), Bleed ----
rep("const du=skVal(h,'duelist');if(du&&(e.boss||e.mini||(e.big||1)>=1.4))a*=1+du/100;",
    "const du=skVal(h,'duelist');if(du&&(e.boss||e.mini||(e.big||1)>=1.4))a*=1+du/100;const mo=skVal(h,'momentum');if(mo&&(h.momPx||0)>=60){a*=1+mo/100;h.momPx=0;if(!e.boss)e.stunT=Math.max(e.stunT||0,1);const pm=posE(e);addText(pm.x,pm.y-24,'lance!','#7fd06a');}", 1, 'momentum-hit')
rep("h.walkPx=(h.walkPx||0)+stp;", "h.walkPx=(h.walkPx||0)+stp;h.momPx=(h.momPx||0)+stp;", 1, 'momentum-ride')
rep("const chm=skVal(h,'charm');", "const bdv=skVal(h,'bleed');if(bdv)e.bleed={dps:e.max*bdv/100/4*(e.boss?0.5:1),t:4};\n  const chm=skVal(h,'charm');", 1, 'bleed-hit')
rep("if(e.poison){dmg(e,e.poison.dps*dt,'poison');e.poison.t-=dt;if(e.poison.t<=0)e.poison=null;if(e.hp<=0)continue;}",
    "if(e.poison){dmg(e,e.poison.dps*dt,'poison');e.poison.t-=dt;if(e.poison.t<=0)e.poison=null;if(e.hp<=0)continue;}\n    if(e.bleed){dmg(e,e.bleed.dps*dt,'poison');e.bleed.t-=dt;if(e.bleed.t<=0)e.bleed=null;if(e.hp<=0)continue;}", 1, 'bleed-tick')

# ---- struck: Thorns ----
rep("if(blocker===h){if(!heroParry(e))hurtHero(e.dps*0.7*(e.weak||1));",
    "if(blocker===h){if(!heroParry(e))hurtHero(e.dps*0.7*(e.weak||1));const thv=skVal(h,'thorns');if(thv&&e.hp>0)dmg(e,thv,'hero',true);", 1, 'thorns')

# ---- soldiers: Drill (+damage), Highgarden's Favour (faster), Horn Hill Muster (+50%) ----
rep("if(a.atkT<=0){a.atkT=a.rate;a.strikeT=G.time;dmg(tgt,a.dmg,'ally');}",
    "if(a.atkT<=0){const nh=alive&&dist(a.x,a.y,h.x,h.y)<=90;const fv=nh?skVal(h,'favour'):0,dv=nh?skVal(h,'drill'):0;a.atkT=a.rate/(1+fv/100);a.strikeT=G.time;dmg(tgt,a.dmg*(1+dv/100)*(G.musterUntil>G.time?1.5:1),'ally');}", 1, 'ally-buffs')
# ---- Drowned and Risen: fallen soldiers stand up once while it lasts ----
rep("  G.allies=G.allies.filter(a=>a.hp>0&&a.t>0);",
    "  if(G.drownedUntil>G.time)for(const a of G.allies){if(a.hp<=0&&a.t>0&&!a.risen){a.risen=true;a.hp=a.max;addFx({t:'ring',x:a.x,y:a.y-8,r0:4,r1:22,life:0.5,col:'#4fb8c8'});addText(a.x,a.y-30,'risen','#4fb8c8');}}\n  G.allies=G.allies.filter(a=>a.hp>0&&a.t>0);", 1, 'drowned-allies')

# ---- the champion: Reave (kills heal), What Is Dead (a second chance), Drowned (once), Quick Study ----
rep("if(G.goldx2Until>G.time)g*=2;", "if(G.goldx2Until>G.time)g*=2;if(src==='hero'&&G.hero&&!G.hero.dead){const rv=skVal(G.hero,'reave');if(rv)G.hero.hp=Math.min(G.hero.max,G.hero.hp+G.hero.max*rv/100);}", 1, 'reave')
rep("h.hp-=a;h.oocT=3;if(h.hp<=0){",
    "h.hp-=a;h.oocT=3;if(h.hp<=0&&G.drownedUntil>G.time&&!h.risenD){h.risenD=true;h.hp=h.max*0.5;addText(h.x,h.y-40,'Risen!','#4fb8c8',1);addFx({t:'ring',x:h.x,y:h.y,r0:6,r1:40,life:0.5,col:'#4fb8c8'});}if(h.hp<=0&&!h.wiUsed&&skVal(h,'whatisdead')){h.wiUsed=true;h.hp=1;h.invulnUntil=G.time+skVal(h,'whatisdead');addText(h.x,h.y-40,'What is dead may never die!','#e3b661',1);addFx({t:'ring',x:h.x,y:h.y,r0:6,r1:40,life:0.5,col:'#e3b661'});}if(h.hp<=0){", 1, 'second-chances')
rep("if(h.respawnT<=0){h.dead=false;h.hp=h.max*0.6;", "if(h.respawnT<=0){h.dead=false;h.hp=h.max*0.6;h.wiUsed=false;", 1, 'wi-reset')
rep("function heroXp(n){const h=G.hero;if(!h||h.dead||h.bLvl>=1)return;h.bxp+=n;", "function heroXp(n){const h=G.hero;if(!h||h.dead||h.bLvl>=1)return;h.bxp+=n*(1+(skVal(h,'quickstudy')||0)/100);", 1, 'quickstudy')

# ---- battle-scoped: the fleet's volleys and the feast's mending; reset per battle ----
rep("for(const tr of G.traps){const e=G.enemies.find(",
    "if(G.fleet){G.fleet.t-=dt;if(G.fleet.t<=0){G.fleet.t=0.4;G.fleet.n--;const l=G.enemies.filter(e=>e.hp>0);if(l.length){const e=l[Math.floor(G.rng()*l.length)];const p=posE(e);dmg(e,G.fleet.dmg,'hero');addFx({t:'fire',x:p.x,y:p.y-4,r0:4,r1:20,life:0.4,col:'#ff9a3c'});addFx({t:'puff',x:p.x,y:p.y,r:10,life:0.4,rgb:'120,110,100'});}if(G.fleet.n<=0)G.fleet=null;}}\n  if(G.harvestUntil>G.time&&G.doorHp<G.doorMax)G.doorHp=Math.min(G.doorMax,G.doorHp+30*dt);\n  for(const tr of G.traps){const e=G.enemies.find(", 1, 'fleet-harvest')
rep("G.goldx2Until=0;G.dgUntil=0;", "G.goldx2Until=0;G.dgUntil=0;G.fleet=null;G.harvestUntil=0;G.growUntil=0;G.musterUntil=0;G.drownedUntil=0;", 1, 'reset-54')

# ---- the twelve new ultimates ----
rep("    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;",
    """    case'oldtales':{let n=0;for(const k in G.powerCd){if(G.powerCd[k]>0){G.powerCd[k]=Math.max(0,G.powerCd[k]-v);n++;}}addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:60,life:0.6,col:'#cfe6ff'});addText(h.x,h.y-40,n?'Spells −'+v+' s':'Spells ready','#cfe6ff',1);SFX.play('spell');break;}
    case'drowned':G.drownedUntil=G.time+v;h.risenD=false;for(const a of G.allies)a.risen=false;addFx({t:'ring',x:h.x,y:h.y,r0:10,r1:120,life:0.7,col:'#4fb8c8'});addText(h.x,h.y-40,'Drowned and risen','#4fb8c8',1);SFX.play('spell');break;
    case'ironprice':{const pay=Math.min(60,Math.floor(G.gold));G.gold-=pay;const k=0.5+0.5*pay/60;for(const e of G.enemies){if(e.hp<=0)continue;const p=posE(e);dmg(e,v*k,'power');addFx({t:'coins',x:p.x,y:p.y-10,life:0.5,delay:G.rng()*0.3});}addText(h.x,h.y-40,pay?'−'+pay+' gold':'The iron price','#e3b661',1);SFX.play('gold');break;}
    case'axestorm':h.stormUntil=G.time+v;h.stT=0;addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:60,life:0.5,col:hc});SFX.play('slash',120);break;
    case'ironfleet':G.fleet={n:10,t:0,dmg:v};addText(gate.x,GATE_Y-44,'The Iron Fleet!',hc,1);SFX.play('horn',200);break;
    case'ironarrow':{let best=null,bn=0;for(let k=0;k<48;k++){const an=k/48*Math.PI*2,cx=Math.cos(an),cy=Math.sin(an);let n=0;for(const e of G.enemies){if(e.hp<=0)continue;const p=posE(e);const rx=p.x-h.x,ry=p.y-h.y;if(rx*cx+ry*cy<=0)continue;if(Math.abs(rx*cy-ry*cx)<=14+e.r)n++;}if(n>bn){bn=n;best={cx,cy};}}
      if(!best){addText(h.x,h.y-40,'No target','#e3b661',1);break;}
      for(const e of G.enemies){if(e.hp<=0)continue;const p=posE(e);const rx=p.x-h.x,ry=p.y-h.y,t=rx*best.cx+ry*best.cy;if(t<=0)continue;if(Math.abs(rx*best.cy-ry*best.cx)<=14+e.r){dmg(e,v,'hero');addFx({t:'hit',x:p.x,y:p.y-8,life:0.2,delay:Math.min(0.4,t/1500)});}}
      addFx({t:'pulse',x:h.x,y:h.y-14,tx:h.x+best.cx*720,ty:h.y+best.cy*720,life:0.35,col:'#e3b661'});addText(h.x,h.y-40,'Iron arrow!','#e3b661',1);SFX.play('arrow',150);break;}
    case'growing':G.growUntil=G.time+v;G.growT0=G.time;for(const s of G.map.slots)if(s.tower)addFx({t:'ring',x:s.x,y:s.y-10,r0:4,r1:20,life:0.5,col:'#7fd06a'});addText(h.x,h.y-40,'Growing strong!','#7fd06a',1);SFX.play('upgrade');break;
    case'muster':{G.musterUntil=G.time+v;for(const a of G.allies){a.hp=Math.min(a.max,a.hp+a.max*0.5);addFx({t:'ring',x:a.x,y:a.y-10,r0:3,r1:18,life:0.4,col:hc});}addText(h.x,h.y-40,'Horn Hill!',hc,1);SFX.play('horn',200);break;}
    case'harvest':G.harvestUntil=G.time+v;addFx({t:'wave',x:h.x,y:h.y-10,tx:gate.x,ty:GATE_Y-12,life:0.5,col:'#7fd06a'});addText(gate.x,GATE_Y-44,'A feast for the gate','#7fd06a',1);SFX.play('gold');break;
    case'queenthorns':for(const e of G.enemies){if(e.hp<=0)continue;if(!e.poison||e.poison.dps<v)e.poison={dps:v,t:6};const p=posE(e);addFx({t:'burst',x:p.x,y:p.y-8,r0:2,r1:12,life:0.4,col:'#7cff6b',delay:G.rng()*0.3});}addText(h.x,h.y-40,'Tell them it was me','#7cff6b',1);SFX.play('spell');break;
    case'slayer':{const ws=G.enemies.filter(e=>e.hp>0&&e.walker).sort((a,b)=>b.hp-a.hp);let tg=ws.find(e=>!e.king)||ws[0];const kill1=!!tg&&!tg.king;if(!tg)tg=G.enemies.filter(e=>e.hp>0).sort((a,b)=>b.hp-a.hp)[0];if(!tg){addText(h.x,h.y-40,'Nothing to slay','#8fd3ff',1);break;}const p=posE(tg);addFx({t:'pulse',x:h.x,y:h.y-12,tx:p.x,ty:p.y-10,life:0.3,col:'#8fd3ff'});addFx({t:'shatter',x:p.x,y:p.y,life:0.5,col:'#cfe6f5'});if(kill1){kill(tg,'hero');addText(p.x,p.y-30,'Dragonglass!','#8fd3ff',1);}else{dmg(tg,v,'hero');addText(p.x,p.y-30,Math.round(v)+'!','#8fd3ff',1);}SFX.play('crit',120);break;}
    case'queenroses':{let n=0;for(const e of near(150)){if(!e.boss){e.charmT=G.time+v;n++;}}addFx({t:'ring',x:h.x,y:h.y,r0:10,r1:150,life:0.7,col:'#ff7ab8'});for(let i=0;i<14;i++)addFx({t:'burst',x:h.x-60+G.rng()*120,y:h.y-40+G.rng()*60,r0:2,r1:8,life:0.6,col:'#ff7ab8',delay:G.rng()*0.4});addText(h.x,h.y-40,n?'The people love her':'Nobody to charm','#ff7ab8',1);SFX.play('spell');break;}
    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;""", 1, 'ults-54')
