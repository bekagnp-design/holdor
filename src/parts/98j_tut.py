# v1.1.7 — the first battle in six steps + the CALL WAVE button. src/mod/tut107.js + tut107.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('tut107.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('tut107.css').rstrip('\n') + "\n</style>\n</head>", 1, 'tut107-css')
