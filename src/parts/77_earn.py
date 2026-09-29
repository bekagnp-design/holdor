# v1.0.74 — Earn: the Events tab gives its place in the bottom bar to Earn (the estate, backend v18); events become two-day popups with a countdown.
rep("\n</style>\n</head>", mod('earn.css').rstrip('\n') + "\n</style>\n</head>", 1, 'earn-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('earn.js').rstrip('\n') + '\n' + s[i:]
hrep("['events','Events']", "['earn','Earn']", 1, 'earn-tab')
hrep("const HUB_ORDER=['shop','coll','battle','events','hold'];", "const HUB_ORDER=['shop','coll','battle','earn','hold'];", 1, 'earn-order')
hrep("tab==='events'?hubEvents(sub):tab==='hold'", "tab==='events'?hubEvents(sub):tab==='earn'?hubEarn():tab==='hold'", 1, 'earn-body')
hrep("else if(tab==='events')hubEventsBind(sub);else hubHoldBind();", "else if(tab==='events')hubEventsBind(sub);else if(tab==='earn')hubEarnBind();else hubHoldBind();", 1, 'earn-bind')
hrep("const dot={shop:", "const dot={earn:earnReady(),shop:", 1, 'earn-dot')
hrep(" events:'<svg viewBox=\"0 0 24 24\">", " earn:'<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"#f2a62c\" stroke=\"#7a4a10\" stroke-width=\"1.6\"/><circle cx=\"12\" cy=\"12\" r=\"6.2\" fill=\"none\" stroke=\"#fff0c2\" stroke-width=\"1.2\"/><path d=\"M12 7v10M9.5 9.5h4a1.6 1.6 0 0 1 0 3.2h-3a1.6 1.6 0 0 0 0 3.2h4\" fill=\"none\" stroke=\"#7a4a10\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>',\n events:'<svg viewBox=\"0 0 24 24\">", 1, 'earn-icon')
hrep('<div class="seatname"><b>${hh.seat}</b></div>', '<div class="seatname"><b>${hh.seat}</b></div>${evBadgeHTML()}', 1, 'ev-badge')
hrep("const cv=$('#isle');if(cv)drawIsland(cv,ACC.house);", "const cv=$('#isle');if(cv)drawIsland(cv,ACC.house);evBadgeBind();", 1, 'ev-badge-bind')
hrep("if(tab==='battle')setTimeout(dailyPopupCheck,1100);", "if(tab==='battle'){setTimeout(dailyPopupCheck,1100);setTimeout(evPopupCheck,2600);}", 1, 'ev-popup')
