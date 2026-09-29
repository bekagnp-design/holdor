# v1.0.61 — the 30-day login calendar and Daily / Weekly / Monthly quests (backend v10). All paid by the server; needs a seat signed in through Telegram.
rep("\n</style>\n</head>", mod('daily.css').rstrip('\n') + "\n</style>\n</head>", 1, 'daily-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('daily.js').rstrip('\n') + '\n' + s[i:]
hrep("\n  <div class=\"tro\"><span class=\"tr\" id=\"hubTro\">", "\n  <div class=\"castlerow forgerow\">${dailyBtnHTML()}</div>\n  <div class=\"tro\"><span class=\"tr\" id=\"hubTro\">", 1, 'daily-row')
hrep("const bf=$('#bForge');", "dailyBtnBind();dailyBtnRefresh();const bf=$('#bForge');", 1, 'daily-bind')
hrep("setTimeout(()=>hubTour(tab),400);", "setTimeout(()=>hubTour(tab),400);\n  if(tab==='battle')setTimeout(dailyPopupCheck,1100);", 1, 'daily-popup')
