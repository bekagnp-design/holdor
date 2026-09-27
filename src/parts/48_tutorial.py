# v1.0.47 — a tutorial that shows every part of the battle screen and makes the player do each thing once,
# lessons the first time something new unlocks, and a guided tour of the menus after the first battle.

# ---- styles
rep("\n</style>\n</head>", mod('coach.css').rstrip('\n') + "\n</style>\n</head>", 1, 'coach-css')

# ---- the tutorial engine + steps + lessons, and the coach marks, replace the old tutorial block
i = s.find('/* =========================== TUTORIAL =========================== */'); j = s.find('function drawNarrator(', i)
assert 0 < i < j, 'tutorial block'
s = s[:i] + mod('tutorial.js').rstrip('\n') + '\n' + mod('coach.js').rstrip('\n') + '\n' + s[j:]

# ---- narrator reads the current step list (tutorial or lesson)
rep("const st=G.tut&&TUT_STEPS[G.tut.i];if(!st)return;", "const st=TS();if(!st)return;", 1, 'narr-st')
rep("(TUT_WANT_LBL[G.tut.want]||'')", "(TUT_WANT_LBL[tutWantBase()]||'')", 1, 'narr-lbl')

# ---- where-to-look markers: one function for every kind of step
i = s.find("  if(G.tut&&G.state==='play'&&G.tut.want){"); j = s.find("  if(G.paused&&G.state==='play'&&overlay.classList.contains('hidden')&&!G.tut){", i)
assert 0 < i < j and j - i < 1500, 'pointer block'
s = s[:i] + "  if(G.tut&&G.state==='play')drawTutPointer(now);\n" + s[j:]

# ---- input hooks
rep("if(hit&&!(G.tut&&G.tut.want&&TUT_BTN[G.tut.want])){", "if(hit&&!(G.tut&&tutMapBlocked())){", 1, 'map-block')
rep("if(G.armed){castPower(G.armed,x,y);G.armed=null;updateBar();if(G.tut)tutEvent('power');return;}",
    "if(G.armed){const pid=G.armed;castPower(pid,x,y);G.armed=null;updateBar();if(G.tut)tutEvent('power',pid);return;}", 1, 'power-ev')
rep("G.hod.tgt=gi;G.hod.forceT=7;hodorSay('HODOR!',1200);", "G.hod.tgt=gi;G.hod.forceT=7;hodorSay('HODOR!',1200);if(G.tut)tutEvent('hodor');", 1, 'hodor-ev')
rep("G.armed=null;G.rallySlot=null;updateBar();return;", "G.armed=null;G.rallySlot=null;updateBar();if(G.tut)tutEvent('rally');return;", 1, 'rally-ev')
rep("$('#bP2').addEventListener('click',()=>{if(!spellOpen('reinf'))return;castPower('reinf');});",
    "$('#bP2').addEventListener('click',()=>{if(!spellOpen('reinf'))return;const was=G.powerCd.reinf;castPower('reinf');if(G.tut&&was<=0&&G.state==='play')tutEvent('power','reinf');});", 1, 'reinf-ev')
rep("G.log.push({t:G.tick,a:'build',s:s.id,type});", "G.log.push({t:G.tick,a:'build',s:s.id,type});G.lastBuilt=s;", 1, 'lastbuilt')
rep("SFX.play('build');\n  if(G.tut)tutEvent('build');\n}", "SFX.play('build');\n  if(G.tut)tutEvent('build',type);\n}", 1, 'build-ev')
rep("const avail=G.tut?['watch']:openTowers();", "const avail=G.tutorial?['watch']:openTowers();", 1, 'sheet-avail')

# ---- in the first battle the wave timer waits for the player (waves come only when called)
rep("else{G.nextIn-=dt;if(G.nextIn<=0)startWave();}", "else{if(!(G.tutorial&&G.tut))G.nextIn-=dt;if(G.nextIn<=0)startWave();}", 1, 'tut-timer')
# ---- battle experience also fills during lessons and the tutorial
rep("if(G.hero&&G.heroOn&&!G.tut)heroXp(", "if(G.hero&&G.heroOn)heroXp(", 1, 'hero-xp')
# ---- the first battle lets the player try tier II once
rep("function maxTowerLvl(){const c=cleared();let m=0;for(const g of LVL_GATES)if(c>=g)m++;return Math.max(1,m);}",
    "function maxTowerLvl(){const c=cleared();let m=0;for(const g of LVL_GATES)if(c>=g)m++;return Math.max(G.tutorial&&G.state==='play'?2:1,m);}", 1, 'tut-tier')

# ---- every frame: step conditions, skip button, lessons
rep("camStep(real);ringFrame();", "camStep(real);ringFrame();tutFrame(real);", 1, 'tut-frame')
rep("if(o.tutorial){G.tutorial=true;G.safe=true;G.heroOn=false;G.totalWaves=3;G.gold=90;G.mult=0.55;tutStart();}\n}",
    "G.lastBuilt=null;G.lq=[];\n  if(o.tutorial){G.tutorial=true;G.safe=true;G.heroOn=false;G.totalWaves=3;G.gold=90;G.mult=0.55;updateBar();updateHUD();tutStart();}else lessonsInit();\n}", 1, 'lessons-init')

# ---- the first victory: stars, a gift, then the tour
i = s.find("  if(G.tutorial){\n    G.tut=null;G.paused=false;camReset();ACC.tut=1;persist();"); j = s.find("    return;\n  }\n  mergeStats();", i)
assert 0 < i < j and j - i < 800, 'tut-victory'
s = s[:i] + """  if(G.tutorial){
    G.tut=null;G.paused=false;camReset();tutPulse();ACC.tut=1;
    const first=!ACC.tutGift;if(first){ACC.tutGift=1;addGold(100);ACC.gems+=20;}
    const ratio=G.doorHp/G.doorMax,st3=ratio>=0.7?3:ratio>=0.35?2:1;persist();
    show(`<h1>The gate held<small>Your first lesson is done</small></h1>
    <div class="big stars" id="tvStars">${'⭐'.repeat(st3)}${'☆'.repeat(3-st3)}</div>
    <p>Door at ${Math.round(100*ratio)}%. You built, upgraded and sold towers, called waves, led your champion and cast a spell. New towers and spells open as you hold stages — each with a short lesson the first time.</p>
    <p class="m" id="tvRew">${first?'<b style="color:var(--gold)">+100 🪙 gold · +20 💎 dragonglass</b> — a gift for your first battle':'Well held, again.'}</p>
    <button class="btn" id="bGo"><span class="e">🏰</span> To your castle</button>`);
    $('#bGo').addEventListener('click',()=>showHub('battle'));
    if(!ACC.tour)startTour();
""" + s[j:]

# ---- pause menu and the book explain themselves during the lesson
rep("<p class=\"m\">Wave ${Math.max(1,G.wave)}${G.totalWaves&&G.totalWaves!==Infinity?' of '+G.totalWaves:''} · ⚔️ ${G.kills} · 🧱 ${Math.ceil(G.doorHp)}/${G.doorMax}</p>",
    "<p class=\"m\">Wave ${Math.max(1,G.wave)}${G.totalWaves&&G.totalWaves!==Infinity?' of '+G.totalWaves:''} · ⚔️ ${G.kills} · 🧱 ${Math.ceil(G.doorHp)}/${G.doorMax}</p>${G.tut&&tutWantBase()==='pause'?'<p class=\"tutnote\">📖 This is the pause menu. <b>Resume</b> goes back to the battle, <b>Restart</b> starts the stage again, <b>Leave</b> takes you to your castle. Tap <b>Resume</b>.</p>':''}", 1, 'pause-note')
rep("$('#pR').addEventListener('click',()=>{overlay.classList.add('hidden');G.paused=false;$('#bPause').textContent='⏸';});",
    "$('#pR').addEventListener('click',()=>{overlay.classList.add('hidden');G.paused=false;$('#bPause').textContent='⏸';if(G.tut)tutEvent('pause');});", 1, 'pause-ev')
rep("<div class=\"topbar\"><h1>📖 Encyclopedia</h1><button class=\"back\" id=\"bBack\">✖</button></div>",
    "<div class=\"topbar\"><h1>📖 Encyclopedia</h1><button class=\"back\" id=\"bBack\">✖</button></div>${fromBattle&&G.tut&&tutWantBase()==='book'?'<p class=\"tutnote\">📖 This is the book: <b>The dead</b> you have met, your <b>Towers</b>, and <b>Notes</b> on how everything works. Look through the tabs, then tap <b>✔ Back</b>.</p>':''}", 1, 'book-note')
rep("function showInfo(){showEncyclopedia('tips',G.state==='play');}", "function showInfo(){if(G.tut)G.tutBook=true;showEncyclopedia('tips',G.state==='play');}", 1, 'book-ev')

# ---- the field notes, brought up to date
i = s.find("tips:()=>`<div class=\"ent\"><span class=\"badge\">🚪</span>"); j = s.find("`};", i)
assert 0 < i < j and j - i < 3000, 'notes'
NOTES = [
 ('🚪', "The door is your life. Every enemy that reaches Hodor breaks a piece of it, and only the champion skills Mend and Fortify repair it. More than 70% left at the end gives 3 stars, more than 35% gives 2."),
 ('🏗️', "Tap a stone ring to build: pick a tower, then tap ✓. Tap a built tower to upgrade it (⬆), sell it for 60% of its gold (💰, 90% with Salvage), read its numbers (i) or move a keep's banner (🚩)."),
 ('⚔️', "Tap the ⚔ banner at the top of the road to call the next wave early: every second left on the timer pays 1 gold."),
 ('👆', "Tap your champion or their card, then tap the ground to send them there. Melee champions block the road; ranged ones shoot from where they stand. The gold line on the card fills with kills and levels them up once per battle."),
 ('✨', "Spells and your champion's skill recharge after use — the dark cover shows how long. Arrow rain hits a wide circle, Dracarys burns and is the one spell that fully hurts a dragon, Brothers send sworn men onto the road."),
 ('💸', "Each tower of the same kind costs 17% more than the last. Mixing kinds is cheaper than building one kind everywhere."),
 ('⬆️', "In battle a tower grows through tiers I–V. Higher tiers open as you hold stages: II after 3, III after 8, IV after 15, V after 24. Upgrades cost more than a fresh tower — two tier-II towers often cover more road than one tier-III."),
 ('🏰', "Between battles gold buys levels that stay: towers 1–16 (+3% a level) and champions 1–20 (+5% health, +4% damage a level)."),
 ('🏃', "On roads with two gates, Hodor runs to the gate in danger. Tap a gate to send him there yourself."),
]
s = s[:i] + "tips:()=>`" + "\n    ".join(f'<div class="ent"><span class="badge">{e}</span><div class="bd"><small>{t}</small></div></div>' for e, t in NOTES) + s[j:]

# ---- settings: play the tutorial again, see the lessons again
rep("<button class=\"btn sec\" id=\"bAch\"><span class=\"e\">🏆</span> Achievements</button>",
    "<button class=\"btn sec\" id=\"bTut\"><span class=\"e\">🎓</span> Play the tutorial again</button>\n  <button class=\"btn sec\" id=\"bLearn\"><span class=\"e\">🔄</span> ${ACC.learnReset?'✔ Lessons will show again':'Show the lessons again'}</button>\n  <button class=\"btn sec\" id=\"bAch\"><span class=\"e\">🏆</span> Achievements</button>", 1, 'set-btns')
rep("$('#bAch').addEventListener('click',()=>showAchievements(showSettings));",
    "$('#bTut').addEventListener('click',()=>{ACC.tour=0;persist();SFX.play('tap',60);startTutorial();});\n  $('#bLearn').addEventListener('click',()=>{ACC.learn={};persist();ACC.learnReset=1;SFX.play('tap',60);showSettings();ACC.learnReset=0;});\n  $('#bAch').addEventListener('click',()=>showAchievements(showSettings));", 1, 'set-handlers')

# ---- saves: new accounts learn everything; older ones skip what they already know
rep("cv:45,pv:45,tlv:{}", "cv:45,pv:45,tlv:{},learn:{},tour:0,lv47:1", 1, 'newacc')
rep("migrate45(a);", "migrate45(a);migrate47(a);", 1, 'migrate47')
rep("function tutNext(){tutAdvance();}", """function tutNext(){tutAdvance();}
function migrate47(a){if(a.lv47)return;a.lv47=1;if(!a.learn||typeof a.learn!=='object')a.learn={};if(!a.tut)return;a.tour=1;
  const c=cleared(a),at={glass:1,keep:3,tier2:3,fire:4,scorp:6,reinf:7,gates:13,big:11,tier3:8,wild:10,tier4:15,weir:16,tier5:24,chest:1,hold:3,champ:3};for(const k in at)if(c>=at[k])a.learn[k]=1;}""", 1, 'migrate47-fn')

# ---- hub: small tours when something opens (and the first tour, if it was cut short)
hrep("if(tab==='battle')hubBattleBind();else if(tab==='coll')hubCollectionBind(sub);else if(tab==='shop')hubShopBind();else if(tab==='events')hubEventsBind(sub);else hubHoldBind();",
     "if(tab==='battle')hubBattleBind();else if(tab==='coll')hubCollectionBind(sub);else if(tab==='shop')hubShopBind();else if(tab==='events')hubEventsBind(sub);else hubHoldBind();\n  if(tab==='battle')setTimeout(hubLessons,400);", 1, 'hub-lessons')
