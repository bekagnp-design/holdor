# v1.0.71 — Season Pass + VIP (backend v16): a Season button beside City on the Battle tab, the Season screen; Stars sells the Pass and VIP.
rep("\n</style>\n</head>", mod('season.css').rstrip('\n') + "\n</style>\n</head>", 1, 'season-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('season.js').rstrip('\n') + '\n' + s[i:]
hrep("const bcy=$('#bCity');", "seasonBtnBind2();if(seasonOn())seasonLoad().then(()=>{const c=document.getElementById('bSeason');if(c&&SEASON.st){c.outerHTML=seasonBtnHTML();seasonBtnBind2();}});const bcy=$('#bCity');", 1, 'season-bind')
