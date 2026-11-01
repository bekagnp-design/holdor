# v1.4.6 — the chest opening redrawn: a drawn chest per tier with a lid that swings open, cards that fly out and flip, tap to move on,
# SKIP › for the rest. src/mod/chest145.js + chest145.css. What a chest gives is unchanged (rollChest / ECO.roll); lucky.js still wraps openChest.
rep("function chestSVG(t,open){", "function chestSVG(t,open){if(!CHEST_ART[t+(open?'_open':'')])return chest145SVG(t,!!open);", 1, 'chest145-svg')
rep("function openChest(t,done){\n  const T=CHEST_TIERS[t];let el=$('#cer');", "function openChest(t,done){return chest145Open(t,done);}\nfunction openChestV1(t,done){\n  const T=CHEST_TIERS[t];let el=$('#cer');", 1, 'chest145-open')
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('chest145.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('chest145.css').rstrip('\n') + "\n</style>\n</head>", 1, 'chest145-css')
