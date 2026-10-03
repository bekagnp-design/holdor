# v1.0.84 — lucky chests (backend v21): three taps before a chest opens, each may raise it one tier; the server rolls them.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('lucky.js').rstrip('\n') + '\n' + s[i:]
rep("ECO.roll={id:r.chest,gold:+r.gold||0,", "ECO.roll={id:r.chest,taps:r.taps,tier:r.tier,gold:+r.gold||0,", 1, 'lucky-roll')
rep("\n</style>\n</head>", """
/* v1.0.84: lucky chests */
#cer.lucky .lkst{display:flex;gap:6px;margin:4px 0 2px;font-size:30px;line-height:1}
#cer.lucky .lkst i{font-style:normal;color:rgba(255,255,255,.18);text-shadow:0 2px 0 rgba(0,0,0,.4)}
#cer.lucky .lkst i.on{color:#ffd54a;text-shadow:0 2px 0 #7a4a10,0 0 14px rgba(255,210,80,.7)}
#cer.lucky .lkst i.pop{animation:lkPop .55s cubic-bezier(.2,1.8,.4,1)}
@keyframes lkPop{0%{scale:3;rotate:-40deg;opacity:0}100%{scale:1;rotate:0;opacity:1}}
#cer.lucky .cchest{cursor:pointer}
#cer.lucky .cchest.lkhit{animation:lkHit .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes lkHit{0%{scale:1}25%{scale:.86;filter:brightness(1.6)}60%{scale:1.18;filter:brightness(1.3)}100%{scale:1}}
#cer.lucky .cchest.lkmiss{animation:lkMiss .35s ease-in-out}
@keyframes lkMiss{0%,100%{rotate:0}30%{rotate:-6deg}70%{rotate:5deg}}
#cer.lucky .tap b{color:#ffd54a;font-size:16px}
#cer .lkres{min-height:22px;margin-top:6px;font-family:var(--f-display);font-size:14px;letter-spacing:.08em;color:#cfe6ff}
#cer .lkres.up{color:#ffd54a;font-size:20px;text-shadow:0 2px 0 #7a4a10,0 0 16px rgba(255,210,80,.7);animation:jPop .4s cubic-bezier(.2,1.6,.4,1)}
</style>
</head>""", 1, 'lucky-css')
