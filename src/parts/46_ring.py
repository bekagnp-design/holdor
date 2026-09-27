# v1.0.46 — the game fits the screen it is shown in, and building happens on a ring around the pad.

# ---- 1. height: 100dvh can be taller than what is visible (Claude app viewer on iPhone: 874 vs 766 pt),
#         which pushed the spell bar and the build sheet off the bottom. Size the game from the page instead;
#         Telegram keeps the rule it has always used.
rep("#app{position:relative;margin:0 auto;max-width:430px;height:100vh;height:100dvh;",
    "#app{position:relative;margin:0 auto;max-width:430px;height:100%;", 1, 'app-height')
rep("\n#hud{height:56px;", "\nhtml.tg #app{height:100vh;height:100dvh}\n#hud{height:56px;", 1, 'app-height-tg')

# ---- 2. ring styles
rep("\n</style>\n</head>", mod('ring.css').rstrip('\n') + "\n</style>\n</head>", 1, 'ring-css')

# ---- 3. ring code, and closing the sheet also closes the ring
rep("function closeSheet(){sheet.classList.remove('open');}",
    "function closeSheet(){sheet.classList.remove('open');closeRing();}\n" + mod('ring.js').rstrip('\n'), 1, 'ring-js')

# ---- 4. tapping a pad or a tower opens the ring (tap the same one again to close it)
rep("if(hit&&!(G.tut&&G.tut.want&&TUT_BTN[G.tut.want])){G.sel=hit;openSheet(hit);}else{G.sel=null;closeSheet();}",
    "if(hit&&!(G.tut&&G.tut.want&&TUT_BTN[G.tut.want])){if(RING&&RING.s===hit){G.sel=null;closeSheet();}else{closeSheet();G.sel=hit;openRing(hit);}}else{G.sel=null;closeSheet();}",
    1, 'ring-tap')

# ---- 5. the ring follows the camera every frame (also while the tutorial holds the battle)
rep("G.shake*=0.86;G.hurt=Math.max(0,G.hurt-real*0.55);camStep(real);",
    "G.shake*=0.86;G.hurt=Math.max(0,G.hurt-real*0.55);camStep(real);ringFrame();", 1, 'ring-frame')

# ---- 6. the details sheet uses the same upgrade / sell code as the ring
rep("const u=$('#sUp');if(u)u.addEventListener('click',()=>{if(G.gold<up||t.lvl>=maxTowerLvl())return;G.gold-=up;t.lvl++;t.invested+=up;noteTower(t.type,t.lvl);G.log.push({t:G.tick,a:'up',s:s.id});addFx({t:'ring',x:s.x,y:s.y,r0:6,r1:34,life:0.4,col:'#e3b661'});SFX.play('upgrade');if(G.tut)tutEvent('upgrade');openSheet(s);});",
    "const u=$('#sUp');if(u)u.addEventListener('click',()=>{if(upgradeTower(s))openSheet(s);});", 1, 'sheet-up')
rep("$('#sSell').addEventListener('click',()=>{G.gold+=sell;G.allies=G.allies.filter(a=>a.home!==s.id);G.typeCount[t.type]=Math.max(0,(G.typeCount[t.type]||1)-1);s.tower=null;G.log.push({t:G.tick,a:'sell',s:s.id});G.sel=null;closeSheet();});",
    "$('#sSell').addEventListener('click',()=>{sellTower(s);G.sel=null;closeSheet();});", 1, 'sheet-sell')

# ---- 7. tutorial words for the new way of building
rep("hint:'Tap the glowing ring, then confirm'", "hint:'Tap the glowing ring, then the tower, then ✓'", 1, 'tut-hint')
