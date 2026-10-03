# v1.0.76 — Tasks: the Tasks tab takes Earn's place in the bottom bar (quests, social links, friends; backend v20). The estate is closed
# (its gold went back to the seats on the server), and the Mon–Tue event is Quest Rush (quest rewards ×2) instead of Builders' Boom.
rep("\n</style>\n</head>", mod('tasks.css').rstrip('\n') + "\n</style>\n</head>", 1, 'tasks-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('tasks.js').rstrip('\n') + '\n' + s[i:]
hrep("['earn','Earn']", "['tasks','Tasks']", 1, 'tasks-tab')
hrep("const HUB_ORDER=['shop','coll','battle','earn','hold'];", "const HUB_ORDER=['shop','coll','battle','tasks','hold'];", 1, 'tasks-order')
hrep("tab==='earn'?hubEarn():", "tab==='tasks'?hubTasks(sub):", 1, 'tasks-body')
hrep("else if(tab==='earn')hubEarnBind();", "else if(tab==='tasks')hubTasksBind();", 1, 'tasks-bind')
hrep("const dot={earn:earnReady(),", "const dot={tasks:tasksReady()>0,", 1, 'tasks-dot')
# the tab icon: a scroll with three ticks
hrep(" earn:'<svg viewBox=\"0 0 24 24\">", " tasks:'<svg viewBox=\"0 0 24 24\"><path d=\"M6 3.5h10.5a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H6.5A2.5 2.5 0 0 1 4 18V5.5a2 2 0 0 1 2-2z\" fill=\"#f3e2b8\" stroke=\"#6b4a1c\" stroke-width=\"1.5\"/><path d=\"M7 8.2l1.3 1.3 2.2-2.4M7 12.7l1.3 1.3 2.2-2.4M7 17.2l1.3 1.3 2.2-2.4\" fill=\"none\" stroke=\"#2f9a4a\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M12.5 8.6h4M12.5 13.1h4M12.5 17.6h4\" stroke=\"#6b4a1c\" stroke-width=\"1.4\" stroke-linecap=\"round\"/></svg>',\n earn:'<svg viewBox=\"0 0 24 24\">", 1, 'tasks-icon')
# the guided tour: the home tour points at Tasks; Tasks has its own short tour
rep(" {sel:'.hubtabs button[data-tab=\"earn\"]',text:'<b>Earn</b>: build an estate that pays a little gold every hour, and <b>invite friends</b> — when a friend clears five stages you both get a gift.'},",
    " {sel:'.hubtabs button[data-tab=\"tasks\"]',text:'<b>Tasks</b>: daily, weekly and monthly quests, social tasks and <b>friends</b> — every one pays a gift.'},", 1, 'tour-tasks')
a = s.find(" earn:()=>[\n  {sel:'.collectbox'"); assert a > 0, 'earn tour'
b = s.find(" events:()=>[", a); assert b > a, 'earn tour end'
s = s[:a] + """ tasks:()=>[
  {sel:'.subtabs.tks',text:'Three kinds of tasks: <b>Quests</b> reset every day, week and month; <b>Social</b> tasks pay once; <b>Friends</b> pay when friends join.'},
  {sel:()=>document.querySelector('.tkbody .qrow')||document.querySelector('.tkbody'),text:'Win battles to fill the bars, then tap <b>Claim</b>. On Monday and Tuesday <b>Quest Rush</b> doubles every quest.'}],
""" + s[b:]
