# v1.1.3 — the thriller opening: no menu for a new account until the castle opens after stage 3; short films between battles (film.js +
# the script in src/story/story.json); the tutorial speaks in the story's voice; the menu's parts open one by one with a short film each.
import json, os
data = json.load(open(V + 'story/story.json', encoding='utf-8'))
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + 'const STORY_DATA=' + json.dumps({'films': data['films'], 'tutorial_lines': data['tutorial_lines']}, ensure_ascii=False, separators=(',', ':')) + ';\n' + mod('story.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('story.css').rstrip('\n') + "\n</style>\n</head>", 1, 'story-css')
# the player's FIRST account is made in the story flow (a second or third seat keeps the plain flow: a veteran does not need the thriller twice); the win tour is skipped (the story says it)
rep("bind('.hbig',b=>{const a=newAccount(b.dataset.h,langI,'knight');SAVE.slots[i]=a;", "bind('.hbig',b=>{const a=newAccount(b.dataset.h,langI,'knight');a.sv=SAVE.slots.some((x,j)=>j!==i&&x)?0:1;if(a.sv)a.tours={win:1};SAVE.slots[i]=a;", 1, 'story-new')
# opening the game: a story account goes where the story is (the old cinematic is for older accounts)
rep("function afterLoad(){\n  ecoStart();", "function afterLoad(){\n  ecoStart();stClass();\n  if(ACC&&ACC.sv){showHub('battle');return;}", 1, 'story-afterload')
# the first night held: the tutorial's victory screen
rep("camReset();tutPulse();ACC.tut=1;\n    const first=!ACC.tutGift;", "camReset();tutPulse();ACC.tut=1;ACC.tutWon=1;\n    const first=!ACC.tutGift;", 1, 'story-tutwon')
rep("<button class=\"btn\" id=\"bGo\"><span class=\"e\">🏰</span> To your castle</button>`);\n    $('#bGo').addEventListener('click',()=>showHub('battle'));\n    startTour();",
    "<button class=\"btn\" id=\"bGo\"><span class=\"e\">${ACC.sv?'▶':'🏰'}</span> ${ACC.sv?'Continue':'To your castle'}</button>`);\n    $('#bGo').addEventListener('click',()=>showHub('battle'));\n    if(!ACC.sv)startTour();", 1, 'story-tutvictory')
