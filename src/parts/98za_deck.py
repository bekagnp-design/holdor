# v1.4.4 — the Loadout tab is a deck you build (towers and spells swapped by two taps). src/mod/deck144.js + deck144.css
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('deck144.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('deck144.css').rstrip('\n') + "\n</style>\n</head>", 1, 'deck-css')
