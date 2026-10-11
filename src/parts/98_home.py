# v1.0.98 — the simple home: four tabs (SHOP · ARMY · BATTLE · CLAN), the Hold card in the middle of the home, the chests on top, the quick
# buttons moved (Forge, Tavern, City → ARMY; Season → SHOP; Daily → Tasks), Tasks / the full Hold page / the standings as pages with a back
# arrow, one look, events as popups, the CLAN tab (realm chat, war, standings, friends). src/mod/home98.js + home98.css.
# The module goes in after the hub, so its hubTabs / hubHome / homeBind / skinOf replace the earlier ones; the rest is patched in place.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('home98.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('home98.css').rstrip('\n') + "\n</style>\n</head>", 1, 'home98-css')
rep("const HUB_ORDER=['shop','coll','battle','tasks','hold'];", "const HUB_ORDER=['shop','coll','battle','clan'];", 1, 'order')
rep("tab==='hold'?hubHold():hubHome();", "tab==='hold'?hubHold():tab==='clan'?hubClan():hubHome();", 1, 'clan-body')
rep("else if(tab==='tasks')hubTasksBind();else hubHoldBind();", "else if(tab==='tasks')hubTasksBind();else if(tab==='clan')hubClanBind();else hubHoldBind();", 1, 'clan-bind')
rep("const i=HUB_ORDER.indexOf(tab),j=i+(dx<0?1:-1);if(j<0||j>=HUB_ORDER.length)return;", "const i=HUB_ORDER.indexOf(tab),j=i+(dx<0?1:-1);if(i<0||j<0||j>=HUB_ORDER.length)return;", 1, 'swipe-guard')
rep("hubDir=0;CLOUD.screen='hub:'+tab;", "hubDir=0;CLOUD.screen='hub:'+tab;hubHiddenBack(tab);", 1, 'hidden-back')
rep("const tabs=`<div class=\"subtabs\">${[['deck','Loadout'],", "const tabs=`${armyRow()}<div class=\"subtabs\">${[['deck','Loadout'],", 1, 'army-row')
rep("function hubCollectionBind(sub){", "function hubCollectionBind(sub){homeMovedBind();", 1, 'army-bind')
rep("return `${starsStarterHTML()}<div class=\"hh\"><h2>Daily deals</h2>", "return `${starsStarterHTML()}${shopSeasonHTML()}<div class=\"hh\"><h2>Daily deals</h2>", 1, 'shop-season')
rep("function hubShopBind(){", "function hubShopBind(){homeMovedBind();", 1, 'shop-bind')
rep("<h2>Tasks</h2><small>gifts paid by the server</small></div>`;", "<h2>Tasks</h2><small>gifts paid by the server</small></div>${tkDailyHTML()}`;", 1, 'tasks-daily')
rep("function hubTasksBind(){", "function hubTasksBind(){homeMovedBind();", 1, 'tasks-bind')
# the coach: the lessons and the tours point at what exists now
rep("{sel:'.hubtabs button[data-tab=\"tasks\"]',text:'<b>Tasks</b>:", "{sel:'.hback',text:'<b>Tasks</b>:", 1, 'tour-tasks')
rep("steps:()=>[{sel:`.hubtabs button[data-tab=\"hold\"]`,tap:1,text:'<b>Hold</b> is open — the daily siege for the whole world. Tap it.'}]",
    "steps:()=>[{sel:'#hmHold .hmtx',tap:1,text:'<b>Hold</b> is open — one map a day for the whole world. Tap the card.'}]", 1, 'lesson-hold')
rep("Tap <b>Collection</b>.", "Tap <b>Army</b>.", 1, 'lesson-champ')
rep("<b>Collection</b>: your loadout, champions, towers and spells.", "<b>Army</b>: your loadout, champions, towers and spells — the Forge, the Tavern and your city are above.", 1, 'tour-coll')
