# v1.3.7 — the founder number under the name on the home. src/mod/founder137.js (+ backend v37 founder_no)
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('founder137.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('founder137.css').rstrip('\n') + "\n</style>\n</head>", 1, 'founder-css')
rep("<small>House ${hh.n} · ${flag(lang().c,14)} ${lang().c}</small><div class=\"xp\"", "<small>House ${hh.n} · ${flag(lang().c,14)} ${lang().c}${founderTag()}</small><div class=\"xp\"", 1, 'founder-tag')
