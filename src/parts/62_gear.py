# v1.0.57 — gear and the forge (backend v6): 9 slots per champion, items rolled and forged on the server,
# the equipped items add to the champion's stats in battle. A Forge button under the castle row.
rep("\n</style>\n</head>", mod('gear.css').rstrip('\n') + "\n</style>\n</head>", 1, 'gear-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('gear.js').rstrip('\n') + '\n' + s[i:]

# the champion wears its gear: health, damage, speed, range, attack speed; cooldowns and gold from its kills for the battle
rep("  if(tal){if(tal.k==='hp')tm.hp+=tal.v;else if(tal.k==='dmg')tm.dmg+=tal.v;else if(tal.k==='spd')tm.spd+=tal.v;else if(tal.k==='range')tm.range+=tal.v;else if(tal.k==='rate')tm.rate-=tal.v;}",
    "  if(tal){if(tal.k==='hp')tm.hp+=tal.v;else if(tal.k==='dmg')tm.dmg+=tal.v;else if(tal.k==='spd')tm.spd+=tal.v;else if(tal.k==='range')tm.range+=tal.v;else if(tal.k==='rate')tm.rate-=tal.v;}\n"
    "  const gs=gearStats(c.id);tm.hp*=1+gs.hp/100;tm.dmg*=1+gs.dmg/100;tm.spd*=1+gs.spd/100;tm.range*=1+gs.range/100;tm.rate/=1+gs.rate/100;G.gearCdr=Math.min(40,gs.cdr);G.gearGold=gs.gold;{const ge=gearEff(c.id);G.gearArmor=ge.armor;G.gearLs=ge.lifesteal;G.gearRegen=ge.regen;G.gearCrit=ge.crit;}", 1, 'gear-hero')
rep("function cdMul(h){return h&&h.tal&&h.tal.k==='cdr'?1-h.tal.v:1;}",
    "function cdMul(h){return (h&&h.tal&&h.tal.k==='cdr'?1-h.tal.v:1)*(1-((G&&G.gearCdr)||0)/100);}", 1, 'gear-cdr')
rep("tal.k==='goldkill')g=Math.round(g*(1+G.hero.tal.v));",
    "tal.k==='goldkill')g=Math.round(g*(1+G.hero.tal.v));if(src==='hero'&&G.gearGold)g=Math.round(g*(1+G.gearGold/100));", 1, 'gear-gold')

# the Forge button (Battle tab, under Train / Spell shop)
hrep("""\n  <div class="tro"><span class="tr" id="hubTro">""",
     """\n  <div class="castlerow forgerow"><button class="cbld" id="bForge"><span class="ic">⚒️</span><span class="tx"><b>Forge</b><small>${ecoOn()?gearItems().length+' items · '+GEAR_SLOTS.filter(k=>gearItems().some(it=>it.champ===ACC.sel&&it.slot===k)).length+'/9 worn':'gear — a Telegram seat'}</small></span></button></div>
  <div class="tro"><span class="tr" id="hubTro">""", 1, 'forge-row')
hrep("const bs=$('#bSpellShop');if(bs)bs.addEventListener('click',()=>{SFX.play('tap',60);showSpellShop();});",
     "const bs=$('#bSpellShop');if(bs)bs.addEventListener('click',()=>{SFX.play('tap',60);showSpellShop();});const bf=$('#bForge');if(bf)bf.addEventListener('click',()=>{SFX.play('tap',60);showForge();});", 1, 'forge-bind')
