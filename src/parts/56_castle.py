# v1.0.51 — the castle: Train (house army) + Spell shop (one-shot battle items in a pack).
rep("\n</style>\n</head>", mod('castle.css').rstrip('\n') + "\n</style>\n</head>", 1, 'castle-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('castle.js').rstrip('\n') + '\n' + s[i:]

# the pack button next to the ultimate
rep("""      <button id="bUlt" class="pw"><span class="e" id="uEmoji">📯</span><span class="l" id="uName">Ultimate</span><span class="cd"></span></button>
    </div>""",
    """      <button id="bUlt" class="pw"><span class="e" id="uEmoji">📯</span><span class="l" id="uName">Ultimate</span><span class="cd"></span></button>
      <button id="bPack" class="pw" style="display:none"><span class="e">🎒</span><span class="l">Pack</span></button>
    </div>""", 1, 'pack-button')
rep("$('#bUlt').addEventListener('click',castUlt);", "$('#bUlt').addEventListener('click',castUlt);$('#bPack').addEventListener('click',()=>{SFX.play('tap',50);openPackSheet();});", 1, 'pack-bind')
rep("function updateBar(){\n  const h=G.hero,play=G.state==='play';", "function updateBar(){\n  const h=G.hero,play=G.state==='play';packBar(play);", 1, 'pack-bar')
rep("G.fireCount=0;", "G.fireCount=0;G.packUsed=false;G.wallUntil=0;G.wallGate=0;G.goldx2Until=0;", 1, 'pack-reset')

# the Train strengthens the sworn brothers; at level 5 the house unit joins every call
rep("const R=frontRoute(),g=G.map.gates[R.gate]||heldGate(),posts=roadPosts(R,n,54),br=kind==='brother';\n  const tm=(1+0.2*(maxTowerLvl()-1))*(kind==='brother'?spellMul('reinf'):1);",
    "const br=kind==='brother',hu=br&&armyLvl()>=ARMY_HOUSE_AT;if(hu)n++;const R=frontRoute(),g=G.map.gates[R.gate]||heldGate(),posts=roadPosts(R,n,54);\n  const tm=(1+0.2*(maxTowerLvl()-1))*(kind==='brother'?spellMul('reinf')*armyMul():1);", 1, 'brothers-army')
rep("posts.forEach((p,i)=>G.allies.push({kind,x:g.x+(i%2?6:-6),y:GATE_Y-6,rx:p.x,ry:p.y,hp:Math.round((br?150:170)*tm),max:Math.round((br?150:170)*tm),dmg:(br?15:17)*tm,rate:0.7,atkT:0,t:life,life,eng:0,id:G.eid++,bornT:G.time+i*0.16,house:!br,face:1,spd:86,leash:74,route:R.i}));",
    "posts.forEach((p,i)=>{const hz=hu&&i===n-1;const hp=Math.round((br?150:170)*tm*(hz?1.4:1));G.allies.push({kind,x:g.x+(i%2?6:-6),y:GATE_Y-6,rx:p.x,ry:p.y,hp,max:hp,dmg:(br?15:17)*tm*(hz?1.3:1),rate:0.7,atkT:0,t:life,life,eng:0,id:G.eid++,bornT:G.time+i*0.16,house:!br||hz,unit:hz?'house':null,face:1,spd:hz?100:86,leash:74,route:R.i});});", 1, 'brothers-house-unit')

# the two buildings on the Battle tab, under the island
hrep("""  <div class="tro"><span class="tr" id="hubTro">""", """  <div class="castlerow"><button class="cbld" id="bTrain"><span class="ic">⚔️</span><span class="tx"><b>Train</b><small>Army level ${armyLvl()}${armyLvl()>=ARMY_HOUSE_AT?' · '+HOUSE_UNIT[ACC.house].n:' · '+HOUSE_UNIT[ACC.house].n+' at '+ARMY_HOUSE_AT}</small></span></button><button class="cbld" id="bSpellShop"><span class="ic">🧪</span><span class="tx"><b>Spell shop</b><small>${packCount()?packCount()+' in the pack':'one-shot battle items'}</small></span></button></div>
  <div class="tro"><span class="tr" id="hubTro">""", 1, 'castle-row')
hrep("const cv=$('#isle');if(cv)drawIsland(cv,ACC.house);", "const cv=$('#isle');if(cv)drawIsland(cv,ACC.house);const bt=$('#bTrain');if(bt)bt.addEventListener('click',()=>{SFX.play('tap',60);showTrain();});const bs=$('#bSpellShop');if(bs)bs.addEventListener('click',()=>{SFX.play('tap',60);showSpellShop();});", 1, 'castle-bind')
