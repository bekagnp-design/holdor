# v1.3.8 — Trials replace the Clan tab; the Clan page stays as a page without a tab; an Invite friends card on Tasks. src/mod/trials138.js + .css
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('trials138.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('trials138.css').rstrip('\n') + "\n</style>\n</head>", 1, 'trials-css')
# the page body and its binding
rep("tab==='hold'?hubHold():tab==='clan'?hubClan():hubHome();", "tab==='hold'?hubHold():tab==='clan'?hubClan():tab==='trials'?hubTrials():hubHome();", 1, 'trials-body')
rep("else if(tab==='clan')hubClanBind();else hubHoldBind();", "else if(tab==='clan')hubClanBind();else if(tab==='trials')hubTrialsBind();else hubHoldBind();", 1, 'trials-bind')
# the Clan page has a back arrow now
rep("${tab==='tasks'?'Tasks':tab==='hold'?'The Hold':'Standings'}", "${tab==='tasks'?'Tasks':tab==='hold'?'The Hold':tab==='clan'?'Clan':'Standings'}", 1, 'clan-back')
# the learn offer comes before every wave of a Trials run
rep("||!G.hero||!LEARN.at.includes(G.wave))return false;", "||!G.hero||!(LEARN.at.includes(G.wave)||G.trials))return false;", 1, 'learn-trials')
# the staged home: the Clan no longer wakes up; Trials do, at stage 5 of the castle
rep("['clan',n>=3,['.hubtabs button[data-tab=\"clan\"]','#evBadge','#hmHold']]]", "['clan',n>=3,['#evBadge','#hmHold']],['trials',n>=5,['.hubtabs button[data-tab=\"trials\"]']]]", 1, 'wake-trials')
