# v1.0.59 — champions IV: unique kits for Martell (3 new skills, 6 new ultimates; Poison Cloud stays Ellaria's).
i = s.find("function heroTalent(champId,slot){"); assert i > 0, 'heroTalent anchor'
s = s[:i] + mod('champs59.js').rstrip('\n') + '\n' + s[i:]
hrep("const SK_COL={", "const SK_COL={sunaura:'#ffb347',viper:'#9fe07a',waitstrike:'#e3b661',iserve:'#e3b661',whiplash:'#c9a06a',spearrain:'#ffb347',serpentkiss:'#9fe07a',vengeance:'#ffb347',redviper:'#e14b4b',", 1, 'sk-col-59')

# ---- the champion's own aura block: Sun of Dorne mends soldiers; Patience counts the seconds standing still ----
rep("const dau=skVal(h,'drownaura');",
    "const sau=skVal(h,'sunaura');if(sau)for(const a of G.allies){if(a.hp>0&&a.hp<a.max&&dist(a.x,a.y,h.x,h.y)<=90)a.hp=Math.min(a.max,a.hp+sau*dt);}\n    h.stillT=h.moving?0:Math.min(5,(h.stillT||0)+dt);\n    const dau=skVal(h,'drownaura');", 1, 'aura-59')

# ---- hits: Viper's Kiss (every fourth blow), Patience (standing still) ----
rep("const bl=skVal(h,'blood');if(bl&&h.hp<h.max*0.5)",
    "const ws=skVal(h,'waitstrike');if(ws)a*=1+ws/100*Math.floor(h.stillT||0);\n  const vp=skVal(h,'viper');if(vp){e.vipN=(e.vipN||0)+1;if(e.vipN>=4){e.vipN=0;a+=vp;e.poison={dps:Math.max((e.poison&&e.poison.dps)||0,vp/4),t:4};const pv=posE(e);addText(pv.x,pv.y-24,'viper!','#9fe07a');}}\n  const bl=skVal(h,'blood');if(bl&&h.hp<h.max*0.5)", 1, 'hit-59')

# ---- Serpent's Kiss: a disarmed enemy deals nothing (bosses still strike) ----
rep("e.hasted=1;e.weak=1;}", "e.hasted=1;e.weak=e.disarmT>G.time&&!e.boss?0:1;}", 1, 'disarm')
# ---- I Serve: no limit on who he stops, giants too, and 40% less damage ----
rep("(!e.giant||h.taunts||oath)&&(h.eng<h.blocks||oath)", "(!e.giant||h.taunts||oath||h.iserveUntil>G.time)&&(h.eng<h.blocks||oath||h.iserveUntil>G.time)", 1, 'iserve-block')
rep("h.hp-=a;h.oocT=3;if(h.hp<=0&&G.drownedUntil", "if(h.iserveUntil>G.time)a*=0.6;h.hp-=a;h.oocT=3;if(h.hp<=0&&G.drownedUntil", 1, 'iserve-hurt')
# ---- Vengeance and Justice: the door is spared, then Dorne answers ----
rep("function hitDoor(a,gi){if(G.state!=='play')return;gi=gi||0;", "function hitDoor(a,gi){if(G.state!=='play')return;gi=gi||0;if(G.vengUntil>G.time){G.vengStore=(G.vengStore||0)+a;return;}", 1, 'veng-door')
rep("if(G.harvestUntil>G.time&&G.doorHp<G.doorMax)",
    "if(G.vengUntil&&G.time>=G.vengUntil){const v2=Math.round((G.vengStore||0)*1.5),g0=G.map.gates[0];G.vengUntil=0;G.vengStore=0;if(v2>0){for(const e of G.enemies){if(e.hp>0){const p=posE(e);dmg(e,v2,'power');addFx({t:'fire',x:p.x,y:p.y-6,r0:4,r1:18,life:0.4,col:'#ffb347',delay:G.rng()*0.3});}}addText(g0.x,GATE_Y-60,'Dorne answers · '+v2,'#ffb347',1);G.shake=Math.min(9,G.shake+4);SFX.play('horn',200);}}\n  if(G.harvestUntil>G.time&&G.doorHp<G.doorMax)", 1, 'veng-release')
rep("G.fleet=null;G.harvestUntil=0;", "G.fleet=null;G.harvestUntil=0;G.vengUntil=0;G.vengStore=0;", 1, 'reset-59')

# ---- the six new ultimates ----
rep("    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;",
    """    case'iserve':h.iserveUntil=G.time+v;addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:50,life:0.6,col:'#e3b661'});addText(h.x,h.y-40,'I serve','#e3b661',1);SFX.play('horn',150);break;
    case'whiplash':{const l=G.enemies.filter(e=>e.hp>0&&!e.boss&&dist(posE(e).x,posE(e).y,h.x,h.y)<=200).sort((a,b)=>b.hp-a.hp).slice(0,cntOf(v));for(const e of l){const p=posE(e);e.stunT=Math.max(e.stunT||0,3);if(!e.fly)e.prog=Math.max(0,e.prog-60);addFx({t:'pulse',x:h.x,y:h.y-14,tx:p.x,ty:p.y-8,life:0.3,col:'#c9a06a'});addFx({t:'ring',x:p.x,y:p.y-8,r0:3,r1:16,life:0.4,col:'#c9a06a'});}addText(h.x,h.y-40,l.length?'Bound!':'Nobody to bind','#c9a06a',1);SFX.play('slash',120);break;}
    case'spearrain':{const l=G.enemies.filter(e=>e.hp>0).sort((a,b)=>remainOf(a)-remainOf(b)).slice(0,5);l.forEach((e,i)=>{const p=posE(e);addFx({t:'arrow',x:p.x-30,y:p.y-120,tx:p.x,ty:p.y-6,life:0.25,delay:i*0.06});dmg(e,v,'hero');if(e.hp>0&&!e.boss)e.stunT=Math.max(e.stunT||0,1);addFx({t:'hit',x:p.x,y:p.y-8,life:0.2,delay:0.25+i*0.06});});addText(h.x,h.y-40,l.length?'Spears of Dorne!':'No target','#ffb347',1);SFX.play('arrow',150);break;}
    case'serpentkiss':{let n=0;for(const e of near(120)){if(!e.poison||e.poison.dps<v)e.poison={dps:v,t:5};if(!e.boss)e.disarmT=G.time+4;n++;}addFx({t:'ring',x:h.x,y:h.y,r0:8,r1:120,life:0.6,col:'#9fe07a'});addText(h.x,h.y-40,n?'A kiss for luck':'Nobody near','#9fe07a',1);SFX.play('spell');break;}
    case'vengeance':G.vengUntil=G.time+v;G.vengStore=0;addFx({t:'wave',x:h.x,y:h.y-10,tx:gate.x,ty:GATE_Y-12,life:0.5,col:'#ffb347'});addText(gate.x,GATE_Y-44,'Patience…','#ffb347',1);SFX.play('spell');break;
    case'redviper':{const tg=G.enemies.filter(e=>e.hp>0&&dist(posE(e).x,posE(e).y,h.x,h.y)<=200).sort((a,b)=>b.hp-a.hp)[0];if(!tg){addText(h.x,h.y-40,'No one to fight','#e14b4b',1);break;}const p=posE(tg);h.x=clamp(p.x+(p.x<W/2?18:-18),12,W-12);h.y=clamp(p.y,24,GATE_Y-14);h.tx=null;for(let i=0;i<cntOf(v)&&tg.hp>0;i++){dmg(tg,h.dmg*1.5,'hero');addFx({t:'xslash',x:p.x,y:p.y-8,life:0.3,delay:i*0.08});}if(tg.hp>0)tg.poison={dps:Math.max((tg.poison&&tg.poison.dps)||0,h.dmg*0.6),t:5};addText(h.x,h.y-40,'Elia Martell!','#e14b4b',1);SFX.play('crit',120);break;}
    case'oath':h.invulnUntil=G.time+v;h.oathUntil=G.time+v;""", 1, 'ults-59')
