# v1.0.64 — the city: a vertical, scrolling city of the seat's house; each building opens a screen the game already has.
rep("\n</style>\n</head>", mod('city.css').rstrip('\n') + "\n</style>\n</head>", 1, 'city-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('city.js').rstrip('\n') + '\n' + s[i:]
hrep("""  <div class="tro"><span class="tr" id="hubTro">""", """  <div class="castlerow"><button class="cbld" id="bCity"><span class="ic">🏰</span><span class="tx"><b>City</b><small>${CITY_NAME[ACC.house]||'your city'} · ${cityCleared()} stage${cityCleared()===1?'':'s'} cleared</small></span></button></div>
  <div class="tro"><span class="tr" id="hubTro">""", 1, 'city-row')
hrep("const bt=$('#bTrain');", "const bcy=$('#bCity');if(bcy)bcy.addEventListener('click',()=>{SFX.play('tap',60);showCity();});const bt=$('#bTrain');", 1, 'city-bind')
