# v1.0.80 — Hold blessings: after every fifth wave of the Hold, choose one of three (src/mod/boons.js). They stack for the run.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('boons.js').rstrip('\n') + '\n' + s[i:]
rep("function startWave(){\n", "function startWave(){\n  if(boonCheck())return;   /* v1.0.80: a blessing first; the wave starts when one is chosen */\n", 1, 'boon-wave')
rep("function resetRun(map){\n", "function resetRun(map){\n  G.boon=null;G.boons=[];G.boonDone={};G.boonAsk=null;clearTimeout(G.boonT);{const o=document.getElementById('boonOv');if(o)o.remove();}\n", 1, 'boon-reset')
rep("if(G.time<G.warcryUntil&&(src==='watch'||src==='scorp'||src==='wild'||src==='glass'))v*=G.warcryMult;e.hp-=v;",
    "if(G.time<G.warcryUntil&&(src==='watch'||src==='scorp'||src==='wild'||src==='glass'))v*=G.warcryMult;if(G.boon)v*=boonMul(src);e.hp-=v;", 1, 'boon-dmg')
rep("G.gold+=g;G.kills++;", "if(G.boon&&G.boon.loot)g=Math.round(g*(1+G.boon.loot));G.gold+=g;G.kills++;", 1, 'boon-loot')
rep("\n</style>\n</head>", """
/* v1.0.80: Hold blessings */
#boonOv{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,rgba(20,30,60,.72),rgba(4,6,12,.9));animation:jPop .3s ease-out}
#boonOv .bo-in{width:100%;max-width:400px;padding:16px 12px;text-align:center;color:#fff}
#boonOv small{font-family:var(--f-display);font-size:11px;letter-spacing:.22em;color:#9fe0ff}
#boonOv h2{margin:2px 0 14px;font-family:var(--f-display);font-size:24px;color:#ffd54a;text-shadow:0 3px 0 #000}
#boonOv .bo-row{display:flex;gap:8px}
#boonOv .bo-card{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px 12px;border-radius:16px;border:3px solid #7a4a10;background:linear-gradient(180deg,#3a2a5c,#1c1236);color:#fff;box-shadow:0 6px 0 #120b22,0 0 20px rgba(255,210,120,.25);animation:boIn .5s cubic-bezier(.2,1.5,.4,1) both}
@keyframes boIn{0%{opacity:0;transform:translateY(30px) rotateY(80deg)}100%{opacity:1;transform:none}}
#boonOv .bo-e{font-size:34px;line-height:1;filter:drop-shadow(0 0 10px rgba(255,210,120,.6))}
#boonOv .bo-card b{font-family:var(--f-display);font-size:13px;line-height:1.15}
#boonOv .bo-card em{font-style:normal;font-size:11px;color:#d6c8f0;line-height:1.25}
#boonOv .bo-have{margin:12px 0 0;font-size:13px;color:#cfd8e6}
</style>
</head>""", 1, 'boons-css')
