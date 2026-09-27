# v1.0.50 — the Book: a Kingdom-Rush-style encyclopedia (ribbons, picture page, grid page) that fills in as you play.
rep("\n</style>\n</head>", mod('book.css').rstrip('\n') + "\n" + mod('rank.css').rstrip('\n') + "\n</style>\n</head>", 1, 'book-css')

# the old list-style encyclopedia stays as showEncyclopediaOld (unused); the new book takes its name
i = s.find("function showEncyclopedia(tab,fromBattle){\n  const wasPaused=G.paused;"); assert i > 0, 'showEncyclopedia'
s = s[:i] + mod('book.js').rstrip('\n') + '\n' + mod('rank.js').rstrip('\n') + '\n' + s[i:]
rep("function showEncyclopedia(tab,fromBattle){\n  const wasPaused=G.paused;", "function showEncyclopediaOld(tab,fromBattle){\n  const wasPaused=G.paused;", 1, 'rename-old-ency')

# chronicle: the stage where each tower tier was first reached
rep("function noteTower(type,lvl){if(!ACC)return;const T=tseenMap();if((T[type]||0)<lvl){T[type]=lvl;persist();}}",
    "function noteTower(type,lvl){if(!ACC)return;const T=tseenMap();if((T[type]||0)<lvl){T[type]=lvl;const L=ACC.tlog||(ACC.tlog={});for(let l=1;l<=lvl;l++)if(L[type+':'+l]==null)L[type+':'+l]=G.mode==='online'?-1:(G.level?G.level.id:0);persist();}}", 1, 'tower-chronicle')

# Collection: a Book ribbon with the count of unread discoveries; the tab bar dot when something new is in it
hrep("""[['deck','Loadout'],['heroes','Champions'],['towers','Towers'],['spells','Spells']].map(([k,n])=>`<button class="${k===sub?'on':''}" data-sub="${k}">${n}</button>`).join('')""",
     """[['deck','Loadout'],['heroes','Champions'],['towers','Towers'],['spells','Spells'],['book','Book']].map(([k,n])=>`<button class="${k===sub?'on':''}" data-sub="${k}">${n}${k==='book'&&bookNewCount()?`<span class="n">${bookNewCount()}</span>`:''}</button>`).join('')""", 1, 'coll-book-tab')
hrep("bind('.subtabs button',b=>showHub('coll',b.dataset.sub));", "bind('.subtabs button',b=>{if(b.dataset.sub==='book'){SFX.play('tap',60);showBook('towers',null,false);}else showHub('coll',b.dataset.sub);});", 1, 'coll-book-bind')
hrep("const dot={shop:freeChestReady()||starChestsReady()>0,battle:starChestsReady()>0,hold:",
     "const dot={shop:freeChestReady()||starChestsReady()>0,battle:starChestsReady()>0,coll:bookNewCount()>0,hold:", 1, 'coll-dot')

# settings: the book opens on the towers page
rep("$('#bEncy').addEventListener('click',()=>showEncyclopedia('enemies'));", "$('#bEncy').addEventListener('click',()=>showBook('towers',null,false));", 1, 'settings-book')

# the walker's note said 60% — the data says ice 0.35, so towers do 65%
rep("walker:'Ice armour: normal towers do 60%. Freezes a tower every 13 s.", "walker:'Ice armour: normal towers do 65%. Freezes a tower every 13 s.", 1, 'walker-text')
