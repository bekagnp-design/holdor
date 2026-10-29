# v1.2.1 — the spell loadout (3 of 5), Long Night and Gate repair. src/mod/loadout121.js + loadout121.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('loadout121.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('loadout121.css').rstrip('\n') + "\n</style>\n</head>", 1, 'loadout-css')
# the cooldowns of every spell, and the slots the battle buttons follow
rep("G.powerCd={arrows:0,fire:20,reinf:0};G.powerMax={arrows:26,fire:UP('cache')?42:60,reinf:30};G.armed=null;",
    "G.powerCd={arrows:0,fire:20,reinf:0,night:0,repair:0};G.powerMax={arrows:26,fire:UP('cache')?42:60,reinf:30,night:45,repair:90};G.slots=spellSlots();G.armed=null;", 1, 'power-init')
# the three buttons follow the slots
rep("$('#bP0').addEventListener('click',()=>{if(G.state!=='play'||G.powerCd.arrows>0||!spellOpen('arrows'))return;G.armed=G.armed==='arrows'?null:'arrows';G.heroSel=false;updateBar();});",
    "$('#bP0').addEventListener('click',()=>spellBtn(0));", 1, 'bp0')
rep("$('#bP1').addEventListener('click',()=>{if(G.state!=='play'||G.powerCd.fire>0||!spellOpen('fire'))return;G.armed=G.armed==='fire'?null:'fire';G.heroSel=false;updateBar();});",
    "$('#bP1').addEventListener('click',()=>spellBtn(1));", 1, 'bp1')
rep("$('#bP2').addEventListener('click',()=>{if(!spellOpen('reinf'))return;const was=G.powerCd.reinf;castPower('reinf');if(G.tut&&was<=0&&G.state==='play')tutEvent('power','reinf');});",
    "$('#bP2').addEventListener('click',()=>spellBtn(2));", 1, 'bp2')
rep("const sp=[['#bP0','arrows'],['#bP1','fire'],['#bP2','reinf']];", "const sp=(G.slots||['arrows','fire','reinf']).map((k,i)=>['#bP'+i,k]);", 1, 'bar-slots')
rep("const l=b.querySelector('.l');if(l)l.textContent=open?SPELLS[k].n:'Stage '+(SPELLS[k].at+1);",
    "const l=b.querySelector('.l');if(l)l.textContent=open?SPELLS[k].n:'Stage '+(SPELLS[k].at+1);const em=b.querySelector('.e');if(em)em.textContent=SPELLS[k].e;", 1, 'bar-emoji')
# the home: the loadout row shows the three chosen spells, the Spells tab all five
rep("<div class=\"deckrow\">${champCard(c,{})}${['arrows','fire','reinf'].map(spellCard).join('')}</div>", "<div class=\"deckrow\">${champCard(c,{})}${spellLoadout().map(spellCard).join('')}</div>", 1, 'deck-spells')
rep("<div class=\"cgrid c3\">${['arrows','fire','reinf'].map(spellCard).join('')}</div>", "<div class=\"cgrid c3\">${Object.keys(SPELLS).map(spellCard).join('')}</div>", 1, 'tab-spells')
# the first battle always uses the three first spells
rep("if(o.tutorial){G.tutorial=true;G.safe=true;", "if(o.tutorial){G.tutorial=true;G.slots=SPELL_DEFAULT.slice();G.safe=true;", 1, 'tut-slots')
