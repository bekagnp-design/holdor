# v1.0.73 — a calmer home (the Battle tab): the island, one row of five icon buttons (City, Tavern, Forge, Daily, Season) with a red
# number where something waits, the chest bar and the big Battle button. Train, Spell shop and the rest live in the City now.
import re
a = hub.find('  <div class="castlerow"><button class="cbld" id="bTrain">'); assert a > 0, 'home rows'
b = hub.find('${seasonBtnHTML()}</div>\n', a); assert b > a, 'home rows end'
b += len('${seasonBtnHTML()}</div>\n')
hub = hub[:a] + """  <div class="homerow"><button class="hbtn" id="bCity"><span class="ic">🏰</span><b>City</b></button><button class="hbtn" id="bTavern"><span class="ic">🍺</span><b>Tavern</b></button><button class="hbtn" id="bForge"><span class="ic">⚒️</span><b>Forge</b></button>${dailyBtnHTML()}${seasonBtnHTML()}</div>\n""" + hub[b:]
hrep('<div class="seatname"><b>${hh.seat}</b><small>Seat of House ${hh.n} · ${hh.words}</small></div>', '<div class="seatname"><b>${hh.seat}</b></div>', 1, 'home-seatname')
hrep("<em>STAGE ${Math.min(NG,g+1)} OF ${NG} · ${nextL.n.toUpperCase()}</em>", "<em>${g} / ${NG}</em>", 1, 'home-progress')
rep("\n</style>\n</head>", """
/* v1.0.73: a calmer home */
.homerow{display:flex;gap:6px;margin:6px 4px 10px}
.hbtn{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px 6px;min-width:0;background:linear-gradient(180deg,#2a6fb9,#1a4d8c);border:3px solid #0b1a2e;border-bottom:5px solid #0b1a2e;border-radius:14px;color:#fff}
.hbtn:active{transform:translateY(2px);border-bottom-width:3px}
.hbtn .ic{width:36px;height:36px;border-radius:10px;background:#0c1f3a;border:2px solid #0b1a2e;display:flex;align-items:center;justify-content:center;font-size:20px}
.hbtn b{font-family:var(--f-display);font-size:10px;letter-spacing:.6px;text-transform:uppercase}
.hbtn .dot{position:absolute;top:-6px;right:-3px;min-width:18px;height:18px;border-radius:9px;background:#e14b4b;color:#fff;font-style:normal;font-size:11px;font-weight:800;line-height:14px;text-align:center;padding:0 4px;border:2px solid #0b1a2e}
</style>
</head>""", 1, 'home-css')
