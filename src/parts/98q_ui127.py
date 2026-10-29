# v1.2.7 — what each button does, in words. src/mod/ui127.js + ui127.css
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('ui127.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('ui127.css').rstrip('\n') + "\n</style>\n</head>", 1, 'ui127-css')
rep('<button id="bInfo" class="ic" aria-label="Info">!</button>', '<button id="bInfo" class="ic" data-cap="BOOK" aria-label="Book">!</button>', 1, 'ui127-info')
rep('<button id="bSpeed" class="ic">1×</button>', '<button id="bSpeed" class="ic" data-cap="SPEED">1×</button>', 1, 'ui127-speed')
rep('<button id="bPause" class="ic">⏸</button>', '<button id="bPause" class="ic" data-cap="PAUSE">⏸</button>', 1, 'ui127-pause')
