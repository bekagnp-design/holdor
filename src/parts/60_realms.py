# v1.0.55 — realm (country) statistics for everyone: every realm list shows its players, a tap opens the realm card
# (players · defenders · played this week · waves · stars · kills · today's Hold · houses · best defenders).
# Needs backend v4 (realm_card, and the leaderboard's players / countries / seats / active / today).
rep("\n</style>\n</head>", mod('realms.css').rstrip('\n') + "\n</style>\n</head>", 1, 'realms-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('realms.js').rstrip('\n') + '\n' + s[i:]

# the realm line carries defenders (seats), who played this week and today's Hold (older caches: zeros)
rep("return{j,f:L.f,c:L.c,l:L.l,players:+r.players||0,waves:+r.waves||0,stars:+r.stars||0,kills:+r.kills||0};",
    "return{j,f:L.f,c:L.c,l:L.l,players:+r.players||0,seats:+r.seats||+r.players||0,waves:+r.waves||0,stars:+r.stars||0,kills:+r.kills||0,active:+r.active||0,today:+r.today||0,todayPlayers:+r.today_players||0};", 1, 'realm-line')
# every realm row shows its players
rep('<span class="nm"><b>${r.c}</b><small>${r.l}</small></span><span class="wv">',
    '<span class="nm"><b>${r.c}</b><small>${r.l}</small></span><span class="pp ${r.players?\'\':\'z\'}"><b>${r.players.toLocaleString()}</b><small>${r.players===1?\'player\':\'players\'}</small></span><span class="wv">', 1, 'realm-row-players')

# the global realm screen: totals in the status line, my realm and every row open the realm card
rep("Live · ${(+lb.total||0).toLocaleString()} defenders · updated", "Live · ${realmTotals(lb)} · updated", 1, 'realms-status')
rep('${mine?`<div class="statbox"><div class="hd">${flag(mine.c,42)}', '${mine?`<div class="statbox tap" id="bMyRealm" data-j="${mine.j}"><div class="hd">${flag(mine.c,42)}', 1, 'realms-mine-tap')
rep("<div><b>${mine.players.toLocaleString()}</b><small>defenders</small></div>", "<div><b>${mine.players.toLocaleString()}</b><small>${mine.players===1?'player':'players'}</small></div>", 1, 'realms-mine-players')
rep("$('#bX').addEventListener('click',()=>fromTitle||!ACC?showTitle():showHub('events'));",
    "$('#bX').addEventListener('click',()=>fromTitle||!ACC?showTitle():showHub('events'));"
    "bind('.rrow',b=>{SFX.play('tap',50);showRealmCard(+b.dataset.j,()=>showRealms(fromTitle,q,true));});"
    "const mr=$('#bMyRealm');if(mr)mr.addEventListener('click',()=>{SFX.play('tap',50);showRealmCard(+mr.dataset.j,()=>showRealms(fromTitle,q,true));});", 1, 'realms-bind')

# choosing a realm for a new seat: people, not seats
rep("<div><b>${sel.players.toLocaleString()}</b><small>defenders</small></div><div><b>${sel.players?Math.round(sel.waves/sel.players):0}</b><small>per defender</small></div>",
    "<div><b>${sel.players.toLocaleString()}</b><small>${sel.players===1?'player':'players'}</small></div><div><b>${sel.players?Math.round(sel.waves/sel.players):0}</b><small>per player</small></div>", 1, 'newlang-players')

# Events → Realms: totals, only realms that have a defender, each opens its card; Houses count people too
hrep("const rows=realmStats().slice(0,10),top=Math.max(1,rows[0]?rows[0].waves:1);",
     "const rows=realmStats().filter(r=>r.players>0).slice(0,10),top=Math.max(1,rows[0]?rows[0].waves:1);", 1, 'events-realms-rows')
hrep("<small>${h.players} defenders</small>", "<small>${plural(h.players,'player','players')} · ${plural(h.seats!=null?h.seats:h.players,'defender','defenders')}</small>", 1, 'events-houses-people')
hrep("rows.map(r=>`<div class=\"standrow ${r.mine?'me':''}\"><span class=\"rk\">${r.rank}</span>${flag(r.c,24)}<span class=\"nm\">${r.c}<small>${r.players} defenders</small></span><span class=\"v\">${r.waves.toLocaleString()} 🌊</span></div>`).join('')",
     "realmSummary(lb)+(rows.map(r=>`<button class=\"standrow rlink ${r.mine?'me':''}\" data-j=\"${r.j}\"><span class=\"rk\">${r.rank}</span>${flag(r.c,24)}<span class=\"nm\">${r.c}<small>👥 ${r.players.toLocaleString()}</small></span><span class=\"v\">${r.waves.toLocaleString()} 🌊</span></button>`).join('')||'<p class=\"m\" style=\"font-size:12px\">No realm has a defender yet — be the first.</p>')", 1, 'events-realms-card')
hrep("const ar=$('#bAllRealms');if(ar)ar.addEventListener('click',()=>showRealms(false));",
     "const ar=$('#bAllRealms');if(ar)ar.addEventListener('click',()=>showRealms(false));"
     "bind('.rlink',b=>{SFX.play('tap',50);showRealmCard(+b.dataset.j,()=>showHub('events','realms'));});", 1, 'events-realms-bind')
