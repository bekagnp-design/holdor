# v1.0.96 — the menus move: motes, a light sweep and parallax on the home stage (all three looks), a breathing BATTLE, the new tab grows
# out of the tapped tab, glowing ready slots, glinting currencies, a spring modal, breathing portraits and shimmering Epic/Legendary
# cards (src/mod/fxui.js + fxui.css). Display only, menus only; it wraps juiceHub (after every hub render) and startGame (taken down).
rep("\n</style>\n</head>", "\n" + mod('fxui.css').rstrip('\n') + "\n</style>\n</head>", 1, 'fxui-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('fxui.js').rstrip('\n') + '\n' + s[i:]
