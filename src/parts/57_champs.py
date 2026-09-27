# v1.0.52 — champions I: the new unlock order for every house, unique kits for Stark and Targaryen, ranged −20%.
i = s.find("function heroTalent(champId,slot){"); assert i > 0, 'heroTalent anchor'
s = s[:i] + mod('champs52.js').rstrip('\n') + '\n' + s[i:]

rep("const UNLOCK_STAGE=[0,3,6,10,15,21,28];", "const UNLOCK_STAGE=[0,5,10,18,27,36,45];", 1, 'unlock-stages')
rep("function unlocked(h,c){return cleared(h)>=UNLOCK_STAGE[c.tier];}",
    "function unlocked(h,c){const a=h||ACC;return cleared(h)>=UNLOCK_STAGE[c.tier]||!!(a&&a.copen&&a.copen[c.id]);}", 1, 'unlocked-copen')
rep("migrate45(a);migrate47(a);migrate48(a);", "migrate45(a);migrate47(a);migrate48(a);migrate52(a);", 1, 'migrate52')
rep("case'goldkill':return `+${pct}% gold from your kills`;", "case'goldkill':return `+${pct}% gold from your kills`;\n  case'spd':return `+${pct}% walking speed`;", 1, 'taldesc-spd')

# base stats shared by the game and the Book; ranged and casters hit 20% softer
rep("const base=c.type==='melee'?{hp:360,dmg:22,rate:0.6,range:32}:c.type==='ranged'?{hp:250,dmg:18,rate:0.8,range:140}:{hp:230,dmg:15,rate:0.9,range:150};",
    "const base=HERO_BASE(c.type);", 1, 'hero-base')
rep("function makeHero(){", "function HERO_BASE(t){return t==='melee'?{hp:360,dmg:22,rate:0.6,range:32}:t==='ranged'?{hp:250,dmg:14,rate:0.8,range:140}:{hp:230,dmg:12,rate:0.9,range:150};}\nfunction makeHero(){", 1, 'hero-base-fn')

# on-hit mechanics: second wind / rage, lifesteal, chain, frostbite, sunder, shove
rep("const cr=skVal(h,'crit');if(cr&&G.rng()*100<cr){a*=3;const p=posE(e);addText(p.x,p.y-18,Math.round(a)+'!','#ffd23c',1);G.hitStop=0.05;SFX.play('crit',90);}\n  dmg(e,a,'hero');if(e.hp<=0)return;",
    "const cr=skVal(h,'crit');if(cr&&G.rng()*100<cr){a*=3;const p=posE(e);addText(p.x,p.y-18,Math.round(a)+'!','#ffd23c',1);G.hitStop=0.05;SFX.play('crit',90);}\n  const bl=skVal(h,'blood');if(bl&&h.hp<h.max*0.5)a*=1+bl/100;if(h.rageUntil>G.time)a*=1.6;\n  dmg(e,a,'hero');heroAfterHit(e,a);if(e.hp<=0)return;", 1, 'hit-pre')
rep("const st=skVal(h,'stun');if(st&&!e.boss&&G.rng()*100<st){e.stunT=Math.max(e.stunT,1);const p=posE(e);addFx({t:'ring',x:p.x,y:p.y-12,r0:3,r1:16,life:0.3,col:'#ffe66d'});}\n}",
    """const st=skVal(h,'stun');if(st&&!e.boss&&G.rng()*100<st){e.stunT=Math.max(e.stunT,1);const p=posE(e);addFx({t:'ring',x:p.x,y:p.y-12,r0:3,r1:16,life:0.3,col:'#ffe66d'});}
  const fb=skVal(h,'frostbite');if(fb&&!e.slowImmune){e.chillT=G.time+2;e.chillV=fb;}
  const su=skVal(h,'sunder');if(su){e.sunderT=G.time+3;e.sunderV=su;}
  const kn=skVal(h,'knock');if(kn&&!e.boss&&!e.fly&&G.rng()*100<kn){e.prog=Math.max(0,e.prog-24);const p=posE(e);addFx({t:'puff',x:p.x,y:p.y,r:10,life:0.3,rgb:'200,190,170'});}
}
/* after every champion hit (melee and projectiles): lifesteal and the chain arc */
function heroAfterHit(e,a){const h=G.hero;if(!h)return;let ls=skVal(h,'lifesteal')||0;if(h.lifestealUntil>G.time)ls=Math.max(ls,50);
  if(ls&&!h.dead){h.hp=Math.min(h.max,h.hp+a*ls/100);}
  if(h.type!=='melee'){const cv=skVal(h,'chain');if(cv){const q=posE(e);let o=null,od=1e9;for(const x of G.enemies){if(x===e||x.hp<=0)continue;const r=posE(x),d=dist(r.x,r.y,q.x,q.y);if(d<=60&&d<od){od=d;o=x;}}
    if(o){const r=posE(o);dmg(o,a*cv/100,'hero');addFx({t:'pulse',x:q.x,y:q.y-8,tx:r.x,ty:r.y-8,life:0.22,col:'#cfe6ff'});}}}}""", 1, 'hit-post')

# chill and sunder are read at the top of every enemy tick
rep("for(const e of G.enemies){e.slow=1;e.mark=1;e.pblk=e.blockedBy;e.blockedBy=null;e.hasted=1;}",
    "for(const e of G.enemies){e.slow=e.chillT>G.time&&!e.slowImmune?1-(e.chillV||30)/100:1;e.mark=e.sunderT>G.time?1+(e.sunderV||20)/100:1;e.pblk=e.blockedBy;e.blockedBy=null;e.hasted=1;}", 1, 'tick-reset')

# periodic skills: volley, caltrops, howl
rep("for(const id of['cleave','shield','heal','summon']){const l=skLvl(h,id);if(!l)continue;h.skT[id]=(h.skT[id]||SK[id].cd*cdMul(h))-dt;if(h.skT[id]>0)continue;",
    "for(const id of['cleave','shield','heal','summon','volley','trap','howl']){const l=skLvl(h,id);if(!l)continue;h.skT[id]=(h.skT[id]||SK[id].cd*cdMul(h))-dt;if(h.skT[id]>0)continue;\n      if(id==='volley'){const cands=G.enemies.filter(e=>e.hp>0&&dist(posE(e).x,posE(e).y,h.x,h.y)<=h.range+e.r).sort((a,b)=>remainOf(a)-remainOf(b)).slice(0,3);if(!cands.length)continue;h.skT[id]=SK.volley.cd*cdMul(h);const hc=HOUSES[ACC.house].col,vv=skVal(h,'volley');for(const e of cands){const p=posE(e);G.projs.push({x:h.x,y:h.y-18,tgt:e,lx:p.x,ly:p.y,spd:420,dmg:vv,src:'hero',pierce:0,ang:Math.atan2(p.y-h.y,p.x-h.x),orb:h.type==='caster',col:hc});}addFx({t:'burst',x:h.x,y:h.y-20,r0:3,r1:16,life:0.25,col:hc});SFX.play('arrow',100);continue;}\n      if(id==='trap'){if(G.traps.some(t=>t.calt&&dist(t.x,t.y,h.x,h.y)<40))continue;h.skT[id]=SK.trap.cd*cdMul(h);G.traps.push({x:h.x,y:h.y+4,dmg:skVal(h,'trap'),t0:G.time,calt:1});addFx({t:'puff',x:h.x,y:h.y+4,r:12,life:0.3,rgb:'160,160,160'});continue;}\n      if(id==='howl'){const l2=G.enemies.filter(e=>e.hp>0&&!e.fly&&!e.slowImmune&&dist(posE(e).x,posE(e).y,h.x,h.y)<=80+e.r);if(!l2.length)continue;h.skT[id]=SK.howl.cd*cdMul(h);const hv=skVal(h,'howl');for(const e of l2){e.chillT=G.time+3;e.chillV=hv;}addFx({t:'ring',x:h.x,y:h.y-10,r0:8,r1:80,life:0.5,col:'#a9bdd0'});addText(h.x,h.y-40,'AWOOO','#a9bdd0',1);SFX.play('roar',80);continue;}", 1, 'periodic-skills')
# caltrops: one victim, a stun, no fire; drawn as iron spikes
rep("for(const tr of G.traps){const e=G.enemies.find(e=>e.hp>0&&!e.fly&&dist(posE(e).x,posE(e).y,tr.x,tr.y)<=22);if(e){tr.done=true;",
    "for(const tr of G.traps){const e=G.enemies.find(e=>e.hp>0&&!e.fly&&dist(posE(e).x,posE(e).y,tr.x,tr.y)<=22);if(e&&tr.calt){tr.done=true;dmg(e,tr.dmg,'hero');if(e.hp>0&&!e.boss)e.stunT=Math.max(e.stunT,1);const q=posE(e);addFx({t:'hit',x:q.x,y:q.y-6,life:0.2});addText(q.x,q.y-22,'caltrops!','#cfd6de');continue;}if(e){tr.done=true;", 1, 'caltrops-trigger')
rep("for(const tr of G.traps||[]){const pl=0.5+0.3*Math.sin(now/200);",
    "for(const tr of G.traps||[]){if(tr.calt){ctx.fillStyle='#8a97a8';for(let i=0;i<4;i++){const a=i*1.57+0.4;ctx.beginPath();ctx.moveTo(tr.x+Math.cos(a)*7,tr.y+Math.sin(a)*4);ctx.lineTo(tr.x+Math.cos(a)*3-1.5,tr.y+Math.sin(a)*2-5);ctx.lineTo(tr.x+Math.cos(a)*3+1.5,tr.y+Math.sin(a)*2-5);ctx.closePath();ctx.fill();}continue;}const pl=0.5+0.3*Math.sin(now/200);", 1, 'caltrops-draw')

# the ultimates
rep("    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;",
    """    case'wolfpack':{const n0=G.allies.length;summonAllies(h.x,h.y+6,cntOf(v),12,true);for(let i=n0;i<G.allies.length;i++){const a=G.allies[i];a.hp=a.max=140;a.dmg=18;a.spd=125;a.leash=90;a.wolf=1;}addText(h.x,h.y-40,'Grey Wind!','#a9bdd0',1);SFX.play('roar',120);break;}
    case'remember':G.goldx2Until=G.time+v;addFx({t:'ring',x:h.x,y:h.y,r0:10,r1:120,life:0.7,col:'#e3b661'});addText(h.x,h.y-40,'Double gold · '+v+' s','#e3b661',1);SFX.play('gold');break;
    case'justice':{let n=0;for(const e of G.enemies){if(e.hp>0&&!e.boss&&e.hp/e.max<v/100){const p=posE(e);addFx({t:'xslash',x:p.x,y:p.y-8,life:0.4,delay:0.1});kill(e,'hero');n++;}}for(const e of near(90))if(!e.boss)e.stunT=Math.max(e.stunT,2);addFx({t:'flash',life:0.25});addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:90,life:0.5,col:'#cfe6ff'});addText(h.x,h.y-40,n?n+' beheaded':'No one to judge','#cfe6ff',1);break;}
    case'wallholds':{G.wallUntil=G.time+v;G.wallGate=gate.i||0;for(const R of G.map.routes){if(R.gate!==G.wallGate)continue;const q=posAt(G.map,Math.max(20,R.total-90),R.i);addFx({t:'ring',x:q.x,y:q.y,r0:6,r1:40,life:0.6,col:'#cdf1ff'});addFx({t:'blocks',x:q.x,y:q.y+6,life:1.2});}addFx({t:'flash',life:0.25});SFX.play('freeze');break;}
    case'crown':{const l=G.enemies.filter(e=>e.hp>0).sort((a,b)=>dist(posE(a).x,posE(a).y,h.x,h.y)-dist(posE(b).x,posE(b).y,h.x,h.y)).slice(0,3);for(const e of l){const p=posE(e);e.gold*=2;dmg(e,v,'hero');addFx({t:'fire',x:p.x,y:p.y-6,r0:4,r1:22,life:0.5,col:'#ffd54a'});addFx({t:'coins',x:p.x,y:p.y-10,life:0.7});}SFX.play('gold');break;}
    case'dohaeris':{for(const a of G.allies){if(a.hp<a.max){a.hp=a.max;addFx({t:'ring',x:a.x,y:a.y-10,r0:3,r1:18,life:0.4,col:'#7fd06a'});}}G.doorHp=Math.min(G.doorMax,G.doorHp+v);addFx({t:'wave',x:h.x,y:h.y-10,tx:gate.x,ty:GATE_Y-12,life:0.5,col:'#7fd06a'});addText(gate.x,GATE_Y-30,'+'+v,'#7fd06a',1);break;}
    case'stormcrows':{const l=G.enemies.filter(e=>e.hp>0).sort((a,b)=>dist(posE(a).x,posE(a).y,h.x,h.y)-dist(posE(b).x,posE(b).y,h.x,h.y)).slice(0,6);l.forEach((e,i)=>{const p=posE(e);addFx({t:'arrow',x:h.x,y:h.y-16,tx:p.x,ty:p.y-6,life:0.22,delay:i*0.05});dmg(e,v,'hero');addFx({t:'hit',x:p.x,y:p.y-8,life:0.15,delay:0.2+i*0.05});});SFX.play('slash',120);break;}
    case'phalanx':sendBrothers(cntOf(v),15,'phalanx');break;
    case'forqueen':h.rageUntil=G.time+v;h.lifestealUntil=G.time+v;addFx({t:'burst',x:h.x,y:h.y-12,r0:6,r1:40,life:0.5,col:'#e14b4b'});addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:50,life:0.6,col:'#e14b4b'});SFX.play('roar',120);break;
    case'khalasar':{for(const e of near(160)){dmg(e,v,'hero');if(!e.boss&&!e.fly)e.prog=Math.max(0,e.prog-40);}const dir=h.face||1,x0=clamp(h.x-dir*150,10,W-10),x1=clamp(h.x+dir*150,10,W-10);h.dashT=G.time;addFx({t:'dash',x0,y:h.y,dir,len:Math.abs(x1-x0),id:h.c.id,life:0.5});for(let i=0;i<10;i++)addFx({t:'puff',x:x0+dir*i*Math.abs(x1-x0)/10,y:h.y+2,r:9,life:0.45,delay:i*0.04,rgb:'150,120,90'});G.shake=Math.min(9,G.shake+4);SFX.play('horn',200);break;}
    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;""", 1, 'ults-52')
# the shield wall is sturdier and slower to strike; the ice wall stops walkers
rep("const hp=Math.round((br?150:170)*tm*(hz?1.4:1));", "const hp=Math.round((kind==='phalanx'?340:br?150:170)*tm*(hz?1.4:1));", 1, 'phalanx-hp')
rep("dmg:(br?15:17)*tm*(hz?1.3:1),rate:0.7,", "dmg:(kind==='phalanx'?11:br?15:17)*tm*(hz?1.3:1),rate:0.7,", 1, 'phalanx-dmg')
rep("addText(g.x,GATE_Y-44,br?'Sworn brothers!':'The Host rides!',", "addText(g.x,GATE_Y-44,br?'Sworn brothers!':kind==='phalanx'?'Shield wall!':'The Host rides!',", 1, 'phalanx-text')
rep("    let blocker=null;\n    /* melee champions block the road;",
    "    if(G.wallUntil>G.time&&!e.boss&&R.gate===G.wallGate&&remain<=92&&remain>60){const v0=e.vel||0;e.vel=v0*Math.max(0,1-dt*14);e.moving=false;if(!e.wallFx){e.wallFx=1;addFx({t:'ring',x:p.x,y:p.y-6,r0:3,r1:14,life:0.3,col:'#cdf1ff'});}continue;}\n    let blocker=null;\n    /* melee champions block the road;", 1, 'ice-wall-stop')
rep("for(const tr of G.traps||[]){if(tr.calt){",
    "if(G.wallUntil>G.time&&G.map){for(const R of G.map.routes){if(R.gate!==G.wallGate)continue;const q=posAt(G.map,Math.max(20,R.total-90),R.i),q2=posAt(G.map,Math.max(20,R.total-96),R.i);const ang=Math.atan2(q.y-q2.y,q.x-q2.x)+Math.PI/2;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(ang);const pl=0.7+0.2*Math.sin(now/180);ctx.fillStyle='rgba(205,241,255,'+(0.55*pl)+')';ctx.strokeStyle='rgba(143,211,255,0.9)';ctx.lineWidth=1.5;ctx.beginPath();for(let i=-3;i<=3;i++){const x=i*8;ctx.moveTo(x-4,6);ctx.lineTo(x,-14-(i%2?4:0));ctx.lineTo(x+4,6);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}\n  for(const tr of G.traps||[]){if(tr.calt){", 1, 'ice-wall-draw')
rep("if(src==='hero'&&G.hero&&G.hero.tal&&G.hero.tal.k==='goldkill')g=Math.round(g*(1+G.hero.tal.v));",
    "if(src==='hero'&&G.hero&&G.hero.tal&&G.hero.tal.k==='goldkill')g=Math.round(g*(1+G.hero.tal.v));if(G.goldx2Until>G.time)g*=2;", 1, 'gold-x2')
hrep("const SK_COL={", "const SK_COL={frostbite:'#8fd3ff',lifesteal:'#e14b4b',sunder:'#ff9a3c',blood:'#ff7a7a',knock:'#c9a06a',chain:'#cfe6ff',volley:'#e3b661',trap:'#8a97a8',howl:'#a9bdd0',wolfpack:'#a9bdd0',remember:'#e3b661',justice:'#cfe6ff',wallholds:'#8fd3ff',crown:'#ffd54a',dohaeris:'#7fd06a',stormcrows:'#b47cff',phalanx:'#4fc0ff',forqueen:'#e14b4b',khalasar:'#ff9a3c',", 1, 'sk-col')
