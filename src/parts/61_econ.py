# v1.0.56 — the server economy (backend v5): a logged-in seat's gold, dragonglass, energy, XP, levels, stars, chests and
# Hold attempts live on the server. Every purchase is an operation (econ_sync), every battle is opened and closed there
# (battle_start / battle_finish), chests are rolled there (chest_open). Guests keep the local economy.
rep("\n</style>\n</head>", mod('econ.css').rstrip('\n') + "\n</style>\n</head>", 1, 'econ-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('econ.js').rstrip('\n') + '\n' + s[i:]

# ---- the originals keep their bodies under a new name; econ.js wraps them (the wrapper queues the operation) ----
rep("function cardLevelUp(key){if(!cardCan(key))return false;", "function cardLevelUp0(key){if(!cardCan(key))return false;", 1, 'cardLevelUp0')
rep("function trainArmy(){const l=armyLvl();", "function trainArmy0(){const l=armyLvl();", 1, 'trainArmy0')
rep("function buyPack(k){const P=PACK_ITEMS[k];", "function buyPack0(k){const P=PACK_ITEMS[k];", 1, 'buyPack0')
hrep("function buyDeal(i){const D=dealsState(),", "function buyDeal0(i){const D=dealsState(),", 1, 'buyDeal0')
hrep("function unlockDeal(i){const D=dealsState(),", "function unlockDeal0(i){const D=dealsState(),", 1, 'unlockDeal0')

# ---- purchases written inline ----
rep("if(l<SK_MAX&&l<rankCap(p.lvl)&&spendGold(c0)){p.sk[i]++;addXp(Math.round(c0/10));SFX.play('upgrade');}",
    "if(l<SK_MAX&&l<rankCap(p.lvl)&&spendGold(c0)){p.sk[i]++;addXp(Math.round(c0/10));ecoOp({r:'sk',k:id+':'+i,to:l+1},{g:-c0,x:Math.round(c0/10)});SFX.play('upgrade');}", 1, 'hero-skill-op')
rep("if(spendGold(ECON.upgCost(u))){ACC.upg[u.id]=1;addXp(Math.round(ECON.upgCost(u)/10));",
    "if(spendGold(ECON.upgCost(u))){ACC.upg[u.id]=1;addXp(Math.round(ECON.upgCost(u)/10));ecoOp({r:'upg',k:u.id},{g:-ECON.upgCost(u),x:Math.round(ECON.upgCost(u)/10)});", 1, 'armory-op')
rep("if(!ACC.ach[a.id]&&a.f(s)){ACC.ach[a.id]=1;ACC.gems+=a.g;got.push(a);}",
    "if(!ACC.ach[a.id]&&a.f(s)){ACC.ach[a.id]=1;ACC.gems+=a.g;ecoOp({r:'ach',k:a.id},{m:a.g});got.push(a);}", 1, 'ach-op')
rep("if(first){ACC.tutGift=1;addGold(100);ACC.gems+=20;}", "if(first){ACC.tutGift=1;addGold(100);ACC.gems+=20;ecoOp({r:'tut'},{g:100,m:20});}", 1, 'tut-op')
hrep("ACC.gems-=g;addGold(gd);SFX.play('buy');persist();", "ACC.gems-=g;addGold(gd);ecoOp({r:'xch',i:+b.dataset.xch},{m:-g,g:gd});SFX.play('buy');persist();", 1, 'exchange-op')
hrep("const ba=$('#bBuyAtt');if(ba)ba.addEventListener('click',()=>{if(ACC.gems<40)return;ACC.gems-=40;ACC.online.attempts++;persist();showHub('hold');});",
     "const ba=$('#bBuyAtt');if(ba)ba.addEventListener('click',()=>{if(ecoBuyAtt())showHub('hold');});", 1, 'hold-att-op')

# ---- the deals follow the server's clock (its 6-hour window) ----
hrep("function dealKey(){return Math.floor(Date.now()/DEAL_MS);}", "function dealKey(){return Math.floor((Date.now()+ecoOff())/DEAL_MS);}", 1, 'dealKey-clock')
hrep("function msToDeals(){return DEAL_MS-(Date.now()%DEAL_MS);}", "function msToDeals(){return DEAL_MS-((Date.now()+ecoOff())%DEAL_MS);}", 1, 'msToDeals-clock')

# ---- chests: star, level and shop chests are opened by the server ----
hrep("$('#starChest').addEventListener('click',()=>{if(starChestsReady()>0){ACC.starChests=",
     "$('#starChest').addEventListener('click',()=>{if(starChestsReady()>0){if(ecoWants()){ecoChest('iron','star',()=>showHub('battle'));return;}ACC.starChests=", 1, 'star-chest')
hrep("{const t=lvlChestTier((ACC.lvlChests||0)+2);ACC.lvlChests=(ACC.lvlChests||0)+1;",
     "{const t=lvlChestTier((ACC.lvlChests||0)+2);if(ecoWants()){ecoChest(t,'level',()=>showHub('battle'));return;}ACC.lvlChests=(ACC.lvlChests||0)+1;", 1, 'level-chest')
hrep("bind('[data-buy]',b=>{const t=b.dataset.buy,T=CHEST_TIERS[t];if(t==='wood'){",
     "bind('[data-buy]',b=>{const t=b.dataset.buy,T=CHEST_TIERS[t];if(ecoWants()){if(t==='wood'?!freeChestReady():ACC.gems<T.price)return;ecoChest(t,'shop',()=>showHub('shop'));return;}if(t==='wood'){", 1, 'shop-chest')
# the server's gold and dragonglass (already in the balance); a card slot with nothing to give becomes 100 gold on the server too
rep("function rollChest(t){const T=CHEST_TIERS[t],out=[],rnd=n=>Math.floor(Math.random()*n);\n  const gold=T.gold[0]+rnd(T.gold[1]-T.gold[0]+1);addGold(gold);",
    "function rollChest(t){const T=CHEST_TIERS[t],out=[],rnd=n=>Math.floor(Math.random()*n),R=ECO.roll;let nf=0;\n  const gold=R?R.gold:T.gold[0]+rnd(T.gold[1]-T.gold[0]+1);if(!R)addGold(gold);", 1, 'chest-gold')
rep("if(!R)addGold(gold);out.push({k:'gold',n:'Gold',s:'+'+gold,r:0});\n  const gems=T.gems[0]+rnd(T.gems[1]-T.gems[0]+1);ACC.gems+=gems;",
    "if(!R)addGold(gold);out.push({k:'gold',n:'Gold',s:'+'+gold,r:0});\n  const gems=R?R.gems:T.gems[0]+rnd(T.gems[1]-T.gems[0]+1);if(!R)ACC.gems+=gems;", 1, 'chest-gems')
rep("if(st)out.push(st);else{addGold(100);out.push({k:'gold',n:'Gold',s:'+100',r:0});}}\n  return out;}",
    "if(st)out.push(st);else{nf++;addGold(100);out.push({k:'gold',n:'Gold',s:'+100',r:0});}}\n  if(R&&nf)ecoOp({r:'chestfill',k:R.id,n:nf},{g:100*nf});\n  return out;}", 1, 'chest-fill')

# ---- battles: startGame (econ.js) opens the battle on the server, then the old startGame0 runs ----
rep("function startGame(o){\n  const h=ACC;G.mode=o.mode;", "function startGame0(o){\n  const h=ACC;G.mode=o.mode;", 1, 'startGame0')
rep("resetRun(map);ACC.online.attempts--;", "resetRun(map);if(!o.bid)ACC.online.attempts--;", 1, 'hold-attempt-server')
rep("persist();if(CLOUD.on&&sbReady())sbRpc('hold_result',",
    "persist();if(G.bid)ecoFinish(false,0,{g:rw.gold,m:rw.gems},waves).then(()=>fetchLeaderboard(true)).catch(()=>{});else if(CLOUD.on&&sbReady())sbRpc('hold_result',", 1, 'hold-finish')
rep("  else{persist();showCampaignResult(false);}", "  else{ecoFinish(false,0,null);persist();showCampaignResult(false);}", 1, 'loss-finish')
rep("  persist();showCampaignResult(true,stars,after-before,gained);",
    "  ecoFinish(true,stars,{g:G.goldReward,m:gained*(h.diff==='kingsguard'?12:8)});persist();showCampaignResult(true,stars,after-before,gained);", 1, 'win-finish')

# ---- entering a seat asks the server; the save waits while operations are on their way (it must not claim more than the server has) ----
rep("function afterLoad(){\n  if(!ACC.intro)", "function afterLoad(){\n  ecoStart();\n  if(!ACC.intro)", 1, 'afterLoad-eco')
rep("async function cloudSave(keep){\n  if(!CLOUD.on||!CLOUD.dirty||CLOUD.busy)return;",
    "async function cloudSave(keep,force){\n  if(!CLOUD.on||!CLOUD.dirty||CLOUD.busy)return;if(!force&&ecoHold()){if(!keep)cloudSaveSoon(1500);return;}", 1, 'cloudSave-hold')
hrep("function showHub(tab,sub){\n  if(!ACC){showTitle();return;}",
     "function showHub(tab,sub){\n  if(!ACC){showTitle();return;}\n  if(ecoWants()&&!ecoOn()&&!ECO.starting&&Date.now()-ECO.failAt>20000)ecoStart();else if(ecoOn()&&Date.now()-ECO.at>60000&&ecoCalm())ecoRefresh();", 1, 'showHub-eco')

# ---- energy: a chip in the hub bar, the cost on the stage card and the NEXT button ----
hrep('<div class="cur"><span title="Gold — levels, skills, upgrades">', '<div class="cur ${ecoOn()?\'three\':\'\'}"><span title="Gold — levels, skills, upgrades">', 1, 'hubtop-three')
hrep('${GEM_SVG}${fmtN(ACC.gems)}<i class="plus" data-go="shop">+</i></span></div></div>`;}',
     '${GEM_SVG}${fmtN(ACC.gems)}<i class="plus" data-go="shop">+</i></span>${ecoOn()?ecoChip():\'\'}</div></div>`;}', 1, 'hubtop-energy')
hrep("$('#hubAva').addEventListener('click',()=>showSettings());",
     "$('#hubAva').addEventListener('click',()=>showSettings());const he=$('#hubEn');if(he)he.addEventListener('click',()=>{SFX.play('tap',60);ecoEnergySheet(0,null);});", 1, 'hubtop-energy-bind')
rep("<button class=\"go\" id=\"bGo\">${st?'DEFEND AGAIN':'HOLD THE DOOR'}</button>",
    "<button class=\"go\" id=\"bGo\">${st?'DEFEND AGAIN':'HOLD THE DOOR'}${ecoWants()?`<small class=\"ecost\">⚡ ${ecoCost(L0,hard)} energy${ecoOn()?' · you have '+ecoEnergy().n:''}</small>`:''}</button>", 1, 'stage-cost')
rep("<span class=\"cur\">🪙 ${fmtN(goldOf())}<br>💎 ${ACC.gems}</span>", "<span class=\"cur\">🪙 ${fmtN(goldOf())}<br>💎 ${ACC.gems}${ecoOn()?'<br>⚡ '+ecoEnergy().n:''}</span>", 1, 'map-energy')
rep("<small>Stage ${next.id} · ${next.n}</small>", "<small>Stage ${next.id} · ${next.n}${ecoWants()?' · ⚡'+ecoCost(next,ACC.diff==='kingsguard'):''}</small>", 1, 'next-cost')
rep("<br>☁️ Cloud: ${esc(cloudStatus())}</p>", "<br>☁️ Cloud: ${esc(cloudStatus())}${ecoWants()?'<br>⚖️ Economy: '+esc(ecoStatus()):''}</p>", 1, 'settings-eco')

# ---- the simulated Stars shop gave dragonglass away for free: closed until real Stars payments exist ----
rep("<h1>💎 Shop<small>Simulated Telegram Stars. The live build charges Stars and grants items server-side.</small></h1>",
    "<h1>💎 Shop<small>Telegram Stars payments are not open yet. An extra Hold attempt costs 40 dragonglass.</small></h1>", 1, 'shop-title')
rep('<button data-k="${i.k}">${i.p} ⭐</button>',
    "${i.k==='att'?`<button data-k=\"att\" ${ACC.gems>=40?'':'disabled'}>40 💎</button>`:'<button disabled>SOON</button>'}", 1, 'shop-buttons')
rep("""  bind('.shop button',b=>{const k=b.dataset.k;
    if(k==='att')ACC.online.attempts++;else if(k==='gem1')ACC.gems+=150;else if(k==='gem2')ACC.gems+=400;
    else if(k==='door')ACC.online.doorBonus+=200;else if(k==='bank')ACC.online.goldBonus+=120;
    persist();showShop(from);});
  $('#bBack').addEventListener('click',()=>showHub('shop'));""",
    """  bind('.shop button[data-k="att"]',b=>{if(ecoBuyAtt())showShop(from);});
  $('#bBack').addEventListener('click',()=>from==='online'?showHub('hold'):showHub('shop'));""", 1, 'shop-bind')
