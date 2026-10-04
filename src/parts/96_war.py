# v1.0.93 — the realm war (backend v25): the weekly standings between the realms (src/mod/war.js + war.css), entered from the Realms screen.
rep("\n</style>\n</head>", mod('war.css').rstrip('\n') + "\n</style>\n</head>", 1, 'war-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('war.js').rstrip('\n') + '\n' + s[i:]
rep('<input class="searchbox" id="q" placeholder="Search realms or countries" value="${q||\'\'}">', '<button class="btn" id="bWar" style="margin:6px 0 8px">⚔️ Realm war · this week</button>\n   <input class="searchbox" id="q" placeholder="Search realms or countries" value="${q||\'\'}">', 1, 'war-button')
