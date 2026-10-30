# v1.3.5 — the build card on the result screen. src/mod/build135.js + build135.css
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('build135.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('build135.css').rstrip('\n') + "\n</style>\n</head>", 1, 'build-css')
