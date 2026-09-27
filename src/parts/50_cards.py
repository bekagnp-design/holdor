# ---- v1.0.48: cards. Levels cost cards + gold; chests and first-time stage wins pay cards; the account level grows only with upgrades. ----
rep("\n</style>\n</head>", mod('cards.css').rstrip('\n') + "\n</style>\n</head>", 1, 'cards-css')
i = s.find("function heroTalent(champId,slot){"); assert i > 0
s = s[:i] + mod('cards.js').rstrip('\n') + '\n' + s[i:]

# spells: a gold price per level
hrep("tCost:L=>Math.round((30+18*L+2*L*L)/10)*10,", "sCost:l=>Math.round((50+30*l+4*l*l)/10)*10,               /* spell level l → l+1: 80 … 640 */\n  tCost:L=>Math.round((30+18*L+2*L*L)/10)*10,", 1, 'scost')

# hero room: the level button needs cards; skill ranks and armory buys count as upgrades (account XP)
rep("""<div class="lvline">Lv ${p.lvl}<span class="bar"><i style="width:${Math.round(100*p.lvl/CH_MAX)}%"></i></span><button data-a="lvl" ${p.lvl>=CH_MAX||goldOf()<lvlCost(p)?'disabled':''}>+1 · ${p.lvl>=CH_MAX?'max':'🪙'+lvlCost(p)}</button></div>""",
    """${cardLvlLine('c:'+c.id,'data-a="lvl"')}""", 1, 'hero-lvline')
rep("if(a==='lvl'){const c0=lvlCost(p);if(p.lvl<CH_MAX&&spendGold(c0)){p.lvl++;SFX.play('levelup');}else SFX.play('deny');}",
    "if(a==='lvl'){if(cardLevelUp('c:'+c.id))SFX.play('levelup');else SFX.play('deny');}", 1, 'hero-lvl')
rep("if(l<SK_MAX&&l<rankCap(p.lvl)&&spendGold(c0)){p.sk[i]++;SFX.play('upgrade');}", "if(l<SK_MAX&&l<rankCap(p.lvl)&&spendGold(c0)){p.sk[i]++;addXp(Math.round(c0/10));SFX.play('upgrade');}", 1, 'hero-sk')
rep("One champion rides with you per battle. Gold buys levels (up to ${CH_MAX}) and skill ranks (up to ${SK_MAX}).", "One champion rides with you per battle. Cards and gold buy levels (up to ${CH_MAX}); gold buys skill ranks (up to ${SK_MAX}).", 1, 'hero-head')
rep("if(spendGold(ECON.upgCost(u))){ACC.upg[u.id]=1;SFX.play('upgrade');persist();showUpgrades();}", "if(spendGold(ECON.upgCost(u))){ACC.upg[u.id]=1;addXp(Math.round(ECON.upgCost(u)/10));SFX.play('upgrade');persist();showUpgrades();}", 1, 'armory-xp')
# tower workshop
rep("""<div class="lvline">Lv ${L}<span class="bar"><i style="width:${Math.round(100*L/T_MAX)}%"></i></span><button data-a="tl" ${L>=T_MAX||goldOf()<cost?'disabled':''}>${L>=T_MAX?'max':'+1 · 🪙'+cost}</button></div>""",
    """${cardLvlLine('t:'+k,'data-a="tl"')}""", 1, 'tower-lvline')
rep("const b=card.querySelector('#clist button[data-a=\"tl\"]');if(b)b.addEventListener('click',()=>{const c0=ECON.tCost(tLvl(k));if(tLvl(k)<T_MAX&&spendGold(c0)){ACC.tlv=ACC.tlv||{};ACC.tlv[k]=tLvl(k)+1;SFX.play('upgrade');persist();}else SFX.play('deny');showTowerRoom(k);});",
    "const b=card.querySelector('#clist button[data-a=\"tl\"]');if(b)b.addEventListener('click',()=>{if(cardLevelUp('t:'+k)){SFX.play('upgrade');persist();}else SFX.play('deny');showTowerRoom(k);});", 1, 'tower-lvl')
rep("🏰 Tower workshop<small>Gold buys levels. Every level is a small, permanent step — they add up over the long road north.</small>", "🏰 Tower workshop<small>Cards from chests and gold buy levels. Every level is a small, permanent step — they add up over the long road north.</small>", 1, 'tower-head')
rep("<p class=\"m\">🪙 <b style=\"color:var(--gold)\">${fmtN(goldOf())}</b> gold · in battle, towers still upgrade I–V</p>", "<p class=\"m\">🪙 <b style=\"color:var(--gold)\">${fmtN(goldOf())}</b> gold · 🃏 ${cardHave('t:'+k)} ${TSHORT[k]} cards · in battle, towers still upgrade I–V</p>", 1, 'tower-sub')

# spells scale with their level
rep("if(dist(p.x,p.y,x,y)<=95+e.r)dmg(e,170,'power');", "if(dist(p.x,p.y,x,y)<=95+e.r)dmg(e,Math.round(170*spellMul('arrows')),'power');", 1, 'arrows-dmg')
rep("{dmg(e,400,'power');if(e.hp>0)e.burn={dps:20,t:3};}", "{dmg(e,Math.round(400*spellMul('fire')),'power');if(e.hp>0)e.burn={dps:Math.round(20*spellMul('fire')),t:3};}", 1, 'fire-dmg')
rep("else{sendBrothers(UP('sworn')?5:3,15,'brother');}", "else{sendBrothers((UP('sworn')?5:3)+(spellLvl('reinf')>=S_MAX?1:0),15,'brother');}", 1, 'brothers-n')
rep("const tm=1+0.2*(maxTowerLvl()-1);", "const tm=(1+0.2*(maxTowerLvl()-1))*(kind==='brother'?spellMul('reinf'):1);", 1, 'brothers-mul')

# a first-time stage win pays a few cards
rep("G.goldReward=ECON.win(G.level,stars,stars>prev);addGold(G.goldReward);", "G.goldReward=ECON.win(G.level,stars,stars>prev);addGold(G.goldReward);G.cardReward=!prev?stageCards():null;", 1, 'win-cards')
rep("${newUnlocks?` · <span style=\"color:var(--gold)\">${newUnlocks} new champion${newUnlocks>1?'s':''}</span>`:''}",
    "${G.cardReward?` · <span style=\"color:var(--gold)\">+${G.cardReward.n} ${esc(G.cardReward.name)} card${G.cardReward.n>1?'s':''}</span>`:''}${newUnlocks?` · <span style=\"color:var(--gold)\">${newUnlocks} new champion${newUnlocks>1?'s':''}</span>`:''}", 1, 'win-cards-txt')

# saves
rep("cv:45,pv:45,tlv:{},learn:{},tour:0,lv47:1", "cv:45,pv:45,tlv:{},learn:{},tour:0,tours:{},lv47:1,cards:{},slv:{},axp:0,lvlChests:0,lv48:1", 1, 'newacc48')
rep("migrate45(a);migrate47(a);", "migrate45(a);migrate47(a);migrate48(a);", 1, 'migrate48')

# ---- hub: cards on every card, chests pay cards, deals sell cards, a chest for every account level ----
i = hub.find('function accXp(a){'); j = hub.find('function playerName(){', i); assert 0 < i < j
hub = hub[:i] + hub[j:]
i = hub.find('function rollChest(t){'); j = hub.find('function openChest(t,done){', i); assert 0 < i < j
hub = hub[:i] + hub[j:]
hrep("""${open?`<span class="ub"><i style="width:${p.lvl*10}%"></i></span>`:`<span class="rar">${rn}</span>`}</button>`;}""",
     """${open?cardBar('c:'+c.id):`<span class="rar">${rn}</span>`}</button>`;}""", 1, 'champ-bar')
hrep("""data-c="${c.id}">${ride?'<span class="tag">RIDING</span>':''}""", """data-c="${c.id}">${ride?'<span class="tag">RIDING</span>':''}${open?cardUpBadge('c:'+c.id):''}""", 1, 'champ-up')
hrep("""${open?`<span class="ub"><i style="width:${Math.round(100*L/T_MAX)}%"></i></span>`:''}</button>`;}""", """${open?cardBar('t:'+k):''}</button>`;}""", 1, 'tower-bar')
hrep("""<button class="ccard ${open?'':'lock'}" style="--rc:${rc}" data-t="${k}"><span class="im">${towerIconHTML(k,Math.max(1,open?tier:1),64)}""",
     """<button class="ccard ${open?'':'lock'}" style="--rc:${rc}" data-t="${k}">${open?cardUpBadge('t:'+k):''}<span class="im">${towerIconHTML(k,Math.max(1,open?tier:1),64)}""", 1, 'tower-up')
i = hub.find('function spellCard(k){'); j = hub.find('function hubCollection(sub){', i); assert 0 < i < j
hub = hub[:i] + """function spellCard(k){const S=SPELLS[k],key='s:'+k,open=cardOpen(key),l=spellLvl(k),rc=k==='fire'?'#ff9a3c':k==='reinf'?'#8fd3ff':'#e3b661';
  return `<button class="ccard ${open?'':'lock'}" style="--rc:${rc}" data-s="${k}">${open?cardUpBadge(key):''}<span class="im" style="padding:10px;box-sizing:border-box">${spellSVG(k)}${open?`<span class="lv">LVL ${l}</span>`:`<span class="lk">AFTER ${S.at}</span>`}</span>
   <span class="nm">${S.n}</span><span class="rar" style="--rc:${rc}">${open?RAR_N[cardRar(key)]+' · '+S.cd+'s':'locked'}</span>${open?cardBar(key):''}</button>`;}
""" + hub[j:]
hrep("bind('.ccard[data-s]',()=>showUpgrades());", "bind('.ccard[data-s]',b=>showSpellRoom(b.dataset.s));", 1, 'spell-tap')
hrep("<div class=\"hh\"><h2>Spells of the house</h2><small>the spell buttons in battle</small></div>", "<div class=\"hh\"><h2>Spells of the house</h2><small>the spell buttons in battle · tap one to level it</small></div>", 1, 'spell-head')
# chest ceremony: card stacks
hrep("const icon=r=>r.k==='champ'||r.k==='skill'?", "const icon=r=>r.k==='card'?cardIcon(r.key,64):r.k==='champ'||r.k==='skill'?", 1, 'chest-icon')
hrep("${T.cards} card${T.cards>1?'s':''}${T.rare?` (${T.rare} rare+)`:''}", "${T.cards} card stack${T.cards>1?'s':''}${T.rare?` (${T.rare} rare+)`:''}", 1, 'chest-desc')
# the battle tab: a chest for every account level
hrep("""${chestsN>1?`<b class="cnt">×${chestsN}</b>`:''}</div>""", """${chestsN>1?`<b class="cnt">×${chestsN}</b>`:''}</div>
  ${lvlChestsReady()>0?`<div class="chestrow lvl"><span class="ch ready" id="lvlChest">${chestSVG(lvlChestTier((ACC.lvlChests||0)+2))}</span><span class="sbar"><i style="width:100%"></i><em>LEVEL ${(ACC.lvlChests||0)+2} CHEST · TAP TO OPEN</em></span>${lvlChestsReady()>1?`<b class="cnt">×${lvlChestsReady()}</b>`:''}</div>`:''}""", 1, 'lvl-chest')
hrep("$('#starChest').addEventListener('click',()=>{if(starChestsReady()>0){ACC.starChests=(ACC.starChests||0)+1;persist();openChest('iron',()=>showHub('battle'));}});",
     "$('#starChest').addEventListener('click',()=>{if(starChestsReady()>0){ACC.starChests=(ACC.starChests||0)+1;persist();openChest('iron',()=>showHub('battle'));}});\n  const lc=$('#lvlChest');if(lc)lc.addEventListener('click',()=>{if(lvlChestsReady()>0){const t=lvlChestTier((ACC.lvlChests||0)+2);ACC.lvlChests=(ACC.lvlChests||0)+1;persist();openChest(t,()=>showHub('battle'));}});", 1, 'lvl-chest-bind')
# deals: card packs instead of bought levels
hrep("()=>{const c=pick(mine);if(!c)return null;const p=cprog(null,c.id);if(p.lvl>=CH_MAX)return null;return{k:'lvl',c:c.id,n:shortName(c),s:`Level ${p.lvl} → ${p.lvl+1} · −40%`,price:{gold:Math.round(ECON.lvlCost(p.lvl)*0.6/10)*10},ic:port(c),r:1};},",
     "()=>{const pool=cardPool();if(!pool.length)return null;const key=pick(pool),r=cardRar(key),n=Math.max(1,Math.round(rnd(8,16)*CARD_MUL[r]));return{k:'cards',key,cnt:n,n:cardName(key),s:`${n} card${n>1?'s':''} · ${RAR_N[r]}`,price:{gold:n*CARD_PRICE[r]},ic:cardIcon(key,40),r:Math.max(1,r)};},", 1, 'deal-cards')
hrep("else if(c0&&cprog(null,c0.id).lvl<CH_MAX){const p=cprog(null,c0.id);out.push({k:'lvl',c:c0.id,n:shortName(c0),s:`Level ${p.lvl} → ${p.lvl+1} · free`,price:{},ic:port(c0),r:1});}",
     "else if(cardPool().length){const key=pick(cardPool()),r=cardRar(key),n=Math.max(1,Math.round(rnd(4,7)*CARD_MUL[r]));out.push({k:'cards',key,cnt:n,n:cardName(key),s:`${n} free card${n>1?'s':''}`,price:{},ic:cardIcon(key,40),r:Math.max(1,r)});}", 1, 'deal-free-cards')
hrep("else if(d.k==='lvl'){const p=cprog(null,d.c);if(p.lvl<CH_MAX)p.lvl++;}", "else if(d.k==='cards')addCards(d.key,d.cnt);", 1, 'deal-buy-cards')
# texts
hrep("Tap a tower to level it up with gold (1–16, +3% a level). In battle, tiers open with stages held: II after 3, III after 8, IV after 15, V after 24.", "Tap a tower to level it up: cards from chests + gold (1–16, +3% a level). In battle, tiers open with stages held: II after 3, III after 8, IV after 15, V after 24.", 1, 'coll-txt')
rep("Between battles gold buys levels that stay: towers 1–16 (+3% a level) and champions 1–20 (+5% health, +4% damage a level).", "Between battles, cards and gold buy levels that stay: towers 1–16 (+3% a level), champions 1–20 (+5% health, +4% damage a level) and spells 1–10 (+6% power a level). Cards come from chests, deals and the first win on every stage. Every upgrade raises your account level, and every account level pays a chest.", 1, 'notes-lvl')
