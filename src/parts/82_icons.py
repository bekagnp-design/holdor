# v1.0.79 — drawn icons instead of emoji on the home screen, the strip and the Tasks tab (src/mod/icons.js).
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('icons.js').rstrip('\n') + '\n' + s[i:]
for k, e, n in (('city', '🏰', 'City'), ('tavern', '🍺', 'Tavern'), ('forge', '⚒️', 'Forge')):
    rep(f'<span class="ic">{e}</span><b>{n}</b>', '<span class="ic">${icon(\'' + k + '\',26)}</span><b>' + n + '</b>', 1, 'icon-' + k)
rep('<span class="ic">📜</span><b>Daily</b>', '<span class="ic">${icon(\'daily\',26)}</span><b>Daily</b>', 1, 'icon-daily')
rep('<span class="ic">🏆</span><b>Season</b>', '<span class="ic">${icon(\'season\',26)}</span><b>Season</b>', 1, 'icon-season')
rep('<span class="si gift">🎁</span>', '<span class="si gift">${icon(\'gift\',38)}</span>', 1, 'icon-gift')
rep('🚪<b>${ACC.online.attempts}</b>', '${icon(\'door\',18)}<b>${ACC.online.attempts}</b>', 1, 'icon-door')
rep("[['quests','📜 Quests'],['social','📣 Social'],['friends','👥 Friends']]", "[['quests',icon('quests',16)+' Quests'],['social',icon('social',16)+' Social'],['friends',icon('friends',16)+' Friends']]", 1, 'icon-tasktabs')
rep('<span class="tki">${i.e||\'⭐\'}</span>', '<span class="tki">${i.kind===\'ref\'?icon(\'friends\',26):i.url===\'share\'?icon(\'social\',26):(i.e||\'⭐\')}</span>', 1, 'icon-taskrow')
rep("\n</style>\n</head>", """
/* v1.0.79: drawn icons */
.hbtn .ic svg{display:block;filter:drop-shadow(0 2px 0 rgba(0,0,0,.45))}
.slot .si.gift svg{filter:drop-shadow(0 3px 2px rgba(0,0,0,.5))}
.hpill svg,.subtabs.tks svg{vertical-align:-3px;filter:drop-shadow(0 1px 0 rgba(0,0,0,.5))}
.qrow .tki svg{display:block}
</style>
</head>""", 1, 'icons-css')
