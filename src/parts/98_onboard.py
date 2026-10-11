# v1.0.99 — the first minutes: straight from the house into the first battle; a Watchtower already stands by the door; eight lessons in
# the first battle (the rest became short lessons on stages 2–6); the champion's card and skill in their own frame, the spells in theirs;
# the home opens gradually (chests, Army, Shop, Tasks, the Hold card, Clan by stage); the realm screen preselects the Telegram language's
# realm. src/mod/onboard99.js + onboard99.css, injected after the home (its hubTabs / hubHome / homeStrip replace v1.0.98's).
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('onboard99.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('onboard99.css').rstrip('\n') + "\n</style>\n</head>", 1, 'onboard-css')
# the house is chosen → the first battle begins by itself (the home comes after the first win)
rep("if(!ACC.intro){showCinematic(()=>{ACC.intro=1;persist();showHub('battle');});return;}",
    "if(!ACC.intro){showCinematic(()=>{ACC.intro=1;persist();if(!ACC.tut)startTutorial();else showHub('battle');});return;}", 1, 'into-the-battle')
# the realm screen preselects the realm of the Telegram language (one tap: "Fight for …"); the list stays for anyone who wants another
rep("function newLang(i,q,selJ){", "function newLang(i,q,selJ){if(selJ==null&&q==null)selJ=obGuessRealm();", 1, 'realm-guess')
# a locked tab only says so; a swipe skips locked tabs
rep("card.querySelectorAll('.hubtabs button').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',60);hubDir=Math.sign(HUB_ORDER.indexOf(b.dataset.tab)-HUB_ORDER.indexOf(tab));showHub(b.dataset.tab);}));",
    "card.querySelectorAll('.hubtabs button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.lock){hubLockSay(b.dataset.tab);return;}SFX.play('tap',60);hubDir=Math.sign(HUB_ORDER.indexOf(b.dataset.tab)-HUB_ORDER.indexOf(tab));showHub(b.dataset.tab);}));", 1, 'tab-lock')
rep("if(i<0||j<0||j>=HUB_ORDER.length)return;", "if(i<0||j<0||j>=HUB_ORDER.length||hubLocked(HUB_ORDER[j]))return;", 1, 'swipe-lock')
# the first battle: a Watchtower already by the door; finishing the new tutorial marks the account for the staged lessons
rep("function startTutorial(){startGame({mode:'campaign',level:TUT_LEVEL,tutorial:1});}", "function startTutorial(){startGame({mode:'campaign',level:TUT_LEVEL,tutorial:1});tutPrebuild();}", 1, 'tut-prebuild')
rep("function tutFinish(){const k=G.tut&&G.tut.key;G.tut=null;G.paused=false;camReset();tutPulse();if(!k||k==='tut')ACC.tut=1;",
    "function tutFinish(){const k=G.tut&&G.tut.key;G.tut=null;G.paused=false;camReset();tutPulse();if(!k||k==='tut'){ACC.tut=1;ACC.tutv=99;}", 1, 'tut-v99')
# the champion's frame and the spells' frame at the bottom of the battle
rep('<div class="brow">\n      <button id="bP0"', '<div class="brow spells">\n      <button id="bP0"', 1, 'spells-row')
# the eight lessons of the first battle
a = s.find('const TUT_STEPS=['); b = s.find("];\n/* ---- lessons: the first time something new appears ---- */", a); assert 0 < a < b, 'tutorial steps'
s = s[:a] + r"""const TUT_STEPS=[
 {t:'The dead are marching on the door. Hodor holds it — you build the towers that stop them.',pose:'open',hold:1,cam:[1.4,GX,GATE_Y-40],hodor:'HODOR!'},
 {t:'A Watchtower already stands by the door. Call the first wave and watch it shoot: tap the ⚔ banner at the top of the road.',pose:'point',want:'call',cam:'tower',hodor:'Hodor?',hint:'Tap the ⚔ banner at the top of the road'},
 {t:'',want:'kill',hint:'The tower shoots by itself. Every kill drops gold.',cond:()=>G.kills>0,cam:[1]},
 {t:'Gold builds towers. Tap the glowing stone ring and build a second Watchtower.',pose:'point',want:'build',ring:['build'],cam:'slot',pause:1,gold:()=>costOf('watch'),hodor:'HODOR HODOR!',
  hint:()=>ringHint('Tap the glowing stone ring','Tap the Watchtower','Tap ✓ to build it')},
 {t:'Your champion rides up from the keep. Tap the ground where they should stand.',pose:'point',want:'move',hero:1,heroFx:1,cam:[1.5,GX,GATE_Y-52],camBack:1500,hodor:'HODOR!',
  hint:()=>'Tap the ground where your champion should stand'},
 {t:()=>{const u=SK[G.hero.c.sk[2]];return 'The framed card at the bottom is your champion, and the skill beside it is theirs alone: '+u.n+'. Tap it.';},pose:'point',want:'ult',focus:'#rowHero',hodor:'Hodor!',
  hint:()=>'Tap '+SK[G.hero.c.sk[2]].e+' '+SK[G.hero.c.sk[2]].n+' at the bottom'},
 {t:'',want:'wait',hint:'Hold on until the road is clear…',cond:()=>G.waveDone&&!G.enemies.some(e=>e.hp>0)},
 {t:'Towers grow with gold. Tap your Watchtower, then ⬆ and ✓.',pose:'point',want:'upgrade',ring:['up'],gold:upgradeGold,cam:'tower',hodor:'Hodor!',
  hint:()=>ringHint('Tap your Watchtower','Tap ⬆ to upgrade it','Tap ✓ to pay')},
 {t:'Call the second wave.',want:'call',hint:'Tap the ⚔ banner for wave 2'},
 {t:'The spells of your house wait on the right. Arrow rain is a volley from the wall: tap it, then tap the dead on the road.',pose:'point',want:'power',focus:'#bP0',hodor:'HODOR!',
  hint:()=>G.armed==='arrows'?'Now tap the dead on the road':'Tap 🏹 Arrow rain at the bottom'},
 {t:'A spell needs time to come back: the dark cover drains away while it recharges. Your champion\'s skill works the same way.',pose:'point',hold:1,focus:'#bP0'},
 {t:'Call the last wave and hold the door!',want:'call',hint:'When the road is clear, tap the ⚔ banner',hodor:'HODOR HODOR HODOR!'},
 {t:'That is all for now. More opens as you hold stages. Hold the gate!',hint:'Hold the gate!',auto:3200,end:1,cam:[1]},
""" + s[b:]
# the chest slots are hidden until stage 1: the star chest bind must not assume the slot exists
rep("$('#starChest').addEventListener('click',()=>{if(starChestsReady()>0){", "const sc0=$('#starChest');if(sc0)sc0.addEventListener('click',()=>{if(starChestsReady()>0){", 1, 'starchest-guard')
