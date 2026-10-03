# v1.0.78 — the home screen rebuilt (a live strip, a living stage, the next goal, four chest slots, quick buttons, BATTLE) in three looks:
# A hero stage, B living gate, C war map — switched with the 🎨 button (src/mod/skins.js). The old ids stay for the tutorial and the tests.
rep("\n</style>\n</head>", mod('skins.css').rstrip('\n') + "\n</style>\n</head>", 1, 'skins-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('skins.js').rstrip('\n') + '\n' + s[i:]
hrep('show(`<div class="hub" style="--sig:url(', 'show(`<div class="hub look-${skinOf()}" style="--sig:url(', 1, 'skins-class')
hrep("tab==='hold'?hubHold():hubBattle();", "tab==='hold'?hubHold():hubHome();", 1, 'skins-body')
hrep("if(tab==='battle')hubBattleBind();", "if(tab==='battle'){hubBattleBind();homeBind();}", 1, 'skins-bind')
rep("  {sel:'.tro',text:'Your road north: fifty stages, and the stars you have won. Every three stars fill the chest below it — chests hold gold, dragonglass and cards.'},",
    "  {sel:'.hmgoal',text:'Your road north: the next stage, its stars and how far you are of fifty. Tap it to open the map.'},\n  {sel:'.hmslots',text:'Four chests: <b>stars</b> fill the first, <b>levels</b> the second, the third is <b>free</b> every day and the fourth is <b>today\\'s gift</b>. Something is always on its way.'},", 1, 'tour-home')
