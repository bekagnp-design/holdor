# ---- progression: champion 1–20, skill ranks 1–5, tower levels 1–16 ----
i = s.find("function heroTalent(champId,slot){"); assert i > 0
s = s[:i] + mod('prog.js') + s[i:]
# count skills use a fractional value: 2.5 targets = 2, plus a 50% chance of a third
rep("taunt:{n:'Challenge',e:'📣',v:[3,4,5],d:v=>`Blocks ${v} enemies at once. Giants stop to fight the champion`}",
    "taunt:{n:'Challenge',e:'📣',v:[3,4,5],d:v=>`Blocks ${Math.floor(v)} enemies at once${v>3?' and +'+Math.round((v-3)*12)+'% health':''}. Giants stop to fight the champion`}", label='taunt')
rep("multishot:{n:'Volley',e:'🏹',v:[2,3,4],d:v=>`Each shot hits ${v} targets`}", "multishot:{n:'Volley',e:'🏹',v:[2,3,4],d:v=>`Each shot hits ${fc(v)} targets`}", label='ms')
rep("pierce:{n:'Pierce',e:'➶',v:[2,3,4],d:v=>`Shots pass through up to ${v} enemies in a line`}", "pierce:{n:'Pierce',e:'➶',v:[2,3,4],d:v=>`Shots pass through up to ${fc(v)} enemies in a line`}", label='pierce')
rep("summon:{n:'Bannermen',e:'👥',v:[1,2,3],cd:20,d:v=>`Every 20 s calls ${v} soldier${v>1?'s':''} to the champion for 12 s`}",
    "summon:{n:'Bannermen',e:'👥',v:[1,2,3],cd:20,d:v=>`Every 20 s calls ${fc(v)} soldier${v>1?'s':''} to fight beside the champion for 12 s`}", label='summon')
rep("assassinate:{n:'Valar Morghulis',e:'🗡️',v:[1,2,3],cd:35,ult:true,d:v=>`Kills the ${v} strongest non-boss enem${v>1?'ies':'y'}`}",
    "assassinate:{n:'Valar Morghulis',e:'🗡️',v:[1,2,3],cd:35,ult:true,d:v=>`Kills the ${fc(v)} strongest non-boss enem${v>1?'ies':'y'}`}", label='assa')
rep("const ms=skVal(h,'multishot')||1;", "const ms=cntOf(skVal(h,'multishot')||1);", label='ms2')
rep("pierce:skVal(h,'pierce')", "pierce:cntOf(skVal(h,'pierce'))", label='pierce2')
rep("summonAllies(h.x,h.y+6,skVal(h,'summon'),12,true)", "summonAllies(h.x,h.y+6,Math.max(1,cntOf(skVal(h,'summon'))),12,true)", label='summon2')
rep(".sort((a,b)=>b.hp-a.hp).slice(0,v);", ".sort((a,b)=>b.hp-a.hp).slice(0,cntOf(v));", label='assa2')
rep("SK.taunt.v[skLvl(hero,'taunt')-1]", "Math.floor(SK.taunt.v[skLvl(hero,'taunt')-1])", label='taunt2')
rep("hero.taunts=skLvl(hero,'taunt')>0;", "hero.taunts=skLvl(hero,'taunt')>0;if(hero.taunts){const tv=SK.taunt.v[skLvl(hero,'taunt')-1];hero.max=hero.hp=Math.round(hero.max*(1+(tv-3)*0.12));}", label='taunt3')
rep("const tal=L>=5&&p.tal?heroTalent(c.id,p.tal):null;", "const tal=L>=TAL_AT&&p.tal?heroTalent(c.id,p.tal):null;", label='tal')
rep("const hp=Math.round(base.hp*(1+0.1*(L-1))", "const hp=Math.round(base.hp*(1+0.05*(L-1))", label='hp')
rep("dmg:base.dmg*(1+0.08*(L-1))", "dmg:base.dmg*(1+0.04*(L-1))", label='dmg')
rep("$('#hEmoji').style.boxShadow=G.hero.lvl>=10?'0 0 0 2px #d4a017':G.hero.lvl>=5?'0 0 0 2px #c0c7cf':'';",
    "$('#hEmoji').style.boxShadow=G.hero.lvl>=20?'0 0 0 2px #d4a017':G.hero.lvl>=10?'0 0 0 2px #c0c7cf':'';", label='hud')
# towers
i = s.find('function towerStats(t){'); j = s.find('/* =========================== INPUT / SHEETS / HUD', i); assert 0 < i < j
s = s[:i] + mod('towerstats.js') + '\n' + s[j:]
rep("if(e.armored&&src==='scorp')v*=UP('barbed')?3.2:2.5;if(e.dragon&&src==='scorp'&&UP('hunter'))v*=1.4;",
    "if(e.armored&&src==='scorp')v*=tMile('scorp',1)?3:2.5;if(e.dragon&&src==='scorp'&&tMile('scorp',3))v*=1.3;", label='scorpdmg')
# tower perks leave the armory (kept in UPG_OLD for the one-time refund)
rep("const ACHS=[", "const UPG_OLD=UPG.slice();for(let i=UPG.length-1;i>=0;i--)if(TOWERS[UPG[i].g])UPG.splice(i,1);\nconst ACHS=[", label='upgold')
# in-battle tower sheet shows the permanent level too
rep("sheet.innerHTML=`<h3>${towerIconHTML(t.type,t.lvl,26)} ${def.n} ${ROMAN[t.lvl-1]}</h3>",
    "sheet.innerHTML=`<h3>${towerIconHTML(t.type,t.lvl,26)} ${def.n} ${ROMAN[t.lvl-1]} <small style=\"font-size:11px;color:var(--muted)\">· Lv ${tLvl(t.type)}</small></h3>", label='sheet')
# hero room, armory, workshop
i = s.find('/* ---------- upgrades ---------- */'); j = s.find('/* ---------- codex ---------- */', i); assert 0 < i < j
s = s[:i] + mod('rooms.js') + s[j:]
# hub.js: economy, deals and chests respect the new caps; collection opens the workshop
hrep("lvlCost:l=>", "tCost:L=>Math.round((30+18*L+2*L*L)/10)*10,                 /* tower level L → L+1: 50 … 750 */\n  lvlCost0:l=>", label='tcost')
hrep("lvlCost0:l=>", "lvlCost:l=>Math.round((40+22*l+2.2*l*l)/10)*10, /* champion level l → l+1: 60 … 1240 */\n  lvlCostOld:l=>", label='lvlcost')
hrep("skCost:r=>", "skCost:r=>[150,350,650,1000][r-1]||1000,          /* skill rank r → r+1 */\n  skCostOld:r=>", label='skcost')
hrep("const i=[0,1,2].filter(j=>p.sk[j]<3);if(!i.length)return null;const j=pick(i);", "const i=[0,1,2].filter(j=>p.sk[j]<SK_MAX&&p.sk[j]<rankCap(p.lvl));if(!i.length)return null;const j=pick(i);", label='dealsk')
hrep("if(p.lvl>=10)return null;return{", "if(p.lvl>=CH_MAX)return null;return{", label='deallvl')
hrep("cprog(null,c0.id).lvl<10", "cprog(null,c0.id).lvl<CH_MAX", label='deallvl2')
hrep("if(p.lvl<10)p.lvl++;", "if(p.lvl<CH_MAX)p.lvl++;", label='buylvl')
hrep("if(p.sk[d.i]<3)p.sk[d.i]++;", "if(p.sk[d.i]<SK_MAX)p.sk[d.i]++;", label='buysk')
hrep("if(p.lvl>=10)return null;p.lvl++;", "if(p.lvl>=CH_MAX)return null;p.lvl++;", label='chestlvl')
hrep("const i=[0,1,2].filter(j=>p.sk[j]<3);if(!i.length)return null;const j=i[rnd(i.length)]", "const i=[0,1,2].filter(j=>p.sk[j]<SK_MAX&&p.sk[j]<rankCap(p.lvl));if(!i.length)return null;const j=i[rnd(i.length)]", label='chestsk')
hrep("const tal=open&&p.lvl>=5&&p.tal?heroTalent(c.id,p.tal):null;", "const tal=open&&p.lvl>=TAL_AT&&p.tal?heroTalent(c.id,p.tal):null;", label='cardtal')
hrep("'Talent at level 5'", "'Talent at level '+TAL_AT", label='cardtal2')
hrep("bind('.ccard[data-t]',()=>showUpgrades());", "bind('.ccard[data-t]',b=>showTowerRoom(b.dataset.t));", label='colltw')
hrep("Tap a tower to buy its upgrades with gold. Tiers open with gates held: II at 2, III at 4, IV at 7, V at 10.", "Tap a tower to level it up with gold (1–16, +3% a level). In battle, tiers open with stages held: II after 3, III after 8, IV after 15, V after 24.", label='colltxt')
i = hub.find('function towerCard(k)'); j = hub.find('function spellCard(k)', i); assert 0 < i < j
hub = hub[:i] + """function towerCard(k){const D=TOWERS[k],open=towerOpen(k),tier=maxTowerLvl(),L=tLvl(k),rc=(UGROUPS.find(g=>g[0]===k)||[])[3]||'#8a97a8';
  return `<button class="ccard ${open?'':'lock'}" style="--rc:${rc}" data-t="${k}"><span class="im">${towerIconHTML(k,Math.max(1,open?tier:1),64)}${open?`<span class="lv">LVL ${L}</span>`:`<span class="lk">AFTER ${TOWER_UNLOCK[k]}</span>`}</span>
   <span class="nm">${TSHORT[k]}</span><span class="rar" style="--rc:${rc}">${open?'tier '+ROMAN[tier-1]+' in battle':'locked'}</span>${open?`<span class="ub"><i style="width:${Math.round(100*L/T_MAX)}%"></i></span>`:''}</button>`;}
""" + hub[j:]
