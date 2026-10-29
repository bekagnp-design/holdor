# v1.2.4 — the preparation sheet before a battle: 3 spells, 5 towers. src/mod/prepare124.js + prepare124.css
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('prepare124.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('prepare124.css').rstrip('\n') + "\n</style>\n</head>", 1, 'prep-css')
# the build menu and the sheet show the roster
rep("const avail=G.tutorial?['watch']:openTowers();", "const avail=battleTowers();", 2, 'prep-roster')
rep("  $('#bGo').addEventListener('click',()=>startGame({mode:'campaign',level:L0}));\n  const bd=$('#bDiff');", "  $('#bGo').addEventListener('click',()=>prepGo(()=>startGame({mode:'campaign',level:L0})));\n  const bd=$('#bDiff');", 1, 'prep-go')
