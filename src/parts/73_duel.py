# v1.0.67 — Duel: an asynchronous 1v1 on the Hold map (backend v15); a card on the Events tab.
rep("\n</style>\n</head>", mod('duel.css').rstrip('\n') + "\n</style>\n</head>", 1, 'duel-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('duel.js').rstrip('\n') + '\n' + s[i:]
# the Duel card on the Events tab, above the Daily Hold
hrep("    {k:'hold',live:true,n:'Daily Hold',", "    {k:'duel',live:true,n:'Duel',s:'Same Hold map, two runs, one winner. Ranked leagues, friends, a bot to practise on.',st:onlineOpen()?'LIVE':'GATE '+ONLINE_AT,ic:'<svg viewBox=\"0 0 24 24\"><path d=\"M4 3l8 8M20 3l-8 8M6 21l6-6 6 6\" fill=\"none\" stroke=\"#e3b661\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>'},\n    {k:'hold',live:true,n:'Daily Hold',", 1, 'duel-card')
hrep("bind('.evcard',b=>{if(b.dataset.ev==='hold')showHub('hold');else SFX.play('tap',40);});", "bind('.evcard',b=>{if(b.dataset.ev==='hold')showHub('hold');else if(b.dataset.ev==='duel')showDuel();else SFX.play('tap',40);});", 1, 'duel-bind')
# a friend's challenge link: the code waits until a seat is open (Events → Duel joins it)
rep("function refJoinFromStart(){try{const sp=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.start_param;", "function refJoinFromStart(){try{const sp=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.start_param;if(sp&&/^d_[0-9a-f]{8}$/i.test(sp)){DUEL.pending=sp.slice(2);ecoToast('🤝 A friend challenged you — open Events → Duel');return;}", 1, 'duel-start-param')
