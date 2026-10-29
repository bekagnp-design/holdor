# v1.2.5 — looping demos for every spell, tower and champion. src/mod/demo125.js + demo125.css
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('demo125.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('demo125.css').rstrip('\n') + "\n</style>\n</head>", 1, 'demo-css')
