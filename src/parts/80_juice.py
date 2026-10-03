# v1.0.77 — juice: springs on every press, counting currencies, coins that fly into the counter, tabs that rise in, a wiggling ready chest,
# a shining Battle button, and kill-streak call-outs in battle. Display only (src/mod/juice.js).
rep("\n</style>\n</head>", mod('juice.css').rstrip('\n') + "\n</style>\n</head>", 1, 'juice-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('juice.js').rstrip('\n') + '\n' + s[i:]
hrep("  hubSwipe(card.querySelector('.hub'),tab);\n", "  hubSwipe(card.querySelector('.hub'),tab);juiceHub(tab);\n", 1, 'juice-hub')
rep("refreshSheet();let spm=G.speed;", "refreshSheet();juiceFrame();let spm=G.speed;", 1, 'juice-frame')
