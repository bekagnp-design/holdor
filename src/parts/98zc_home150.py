# v1.5.0 — the home answers three questions at a glance: WHAT IS READY (a row of gold pills: chests to open, gifts to claim, a champion
# or a tower that can level up — nothing ready, no row), WHAT DO I DO NOW (one green BATTLE · STAGE N button straight under the art,
# with the stage's name and the gold it pays; one tap → the preparation sheet or the stage itself), WHAT IS NEW (a quiet pill: the next
# thing that opens and at which stage). The chests get a label each, the Hold card and the rank / Tasks / event pills step back, the
# three looks return behind a small 🎨. src/mod/home150.js + home150.css, injected last so its hubHome / homeSlots / homeGoal /
# homeBattleRow / homeStrip / skinOf replace the earlier ones; homeBind is wrapped.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('home150.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('home150.css').rstrip('\n') + "\n</style>\n</head>", 1, 'home150-css')
# BATTLE goes straight to the next stage (the preparation sheet first when there is something to choose); the map stays on Map
rep("$('#bBattle').addEventListener('click',()=>{SFX.play('tap',80);if(!ACC.tut)startTutorial();else showCampaign();});",
    "$('#bBattle').addEventListener('click',homeGo);", 1, 'battle-go')
