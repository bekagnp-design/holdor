# flow150 — home → map → fight in two taps: the map card is the preparation step (deck strip + ⚔ TO BATTLE + "change ›" to the Loadout),
# the result screen has one big NEXT STAGE › / ⟲ TRY AGAIN with Replay + Home under it and the rewards as chips. src/mod/flow150.js + flow150.css
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('flow150.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('flow150.css').rstrip('\n') + "\n</style>\n</head>", 1, 'flow-css')

# ---- the map: the selected and the next pin are drawn last, so their name labels sit on top of the neighbours ----
rep("const nodes=LEVELS.map(L=>{const [x,y]=MAPPOS[L.id],st=C[L.id]||0,open=levelOpen(null,L),isNext=L.id===next.id&&!st,sel=L.id===selId,boss=L.boss;",
    "const top=L=>(L.id===selId||L.id===next.id)?1:0;const nodes=LEVELS.slice().sort((a,b)=>top(a)-top(b)).map(L=>{const [x,y]=MAPPOS[L.id],st=C[L.id]||0,open=levelOpen(null,L),isNext=L.id===next.id&&!st,sel=L.id===selId,boss=L.boss;", 1, 'map-labels-top')

# ---- the map card: stage, chips, the deck strip, ⚔ TO BATTLE, the side buttons only when they mean something ----
rep(r"""  const pc=`<div class="playcard mapcard2" id="playcard">
      <div class="gt">STAGE ${L0.id} OF ${LEVELS.length}${hard?' · HARD':''}${L0.mod?' · '+MODS[L0.mod].e+' '+MODS[L0.mod].n.toUpperCase():''}${L0.boss?' · 👑 BATTLE':''}</div><h2>${L0.n}</h2>
      <div class="sb">${L0.sub} · ${BIOME_E[L0.biome]||''} ${L0.waves} waves · ${(L0.gates||[GX]).length} gate${(L0.gates||[GX]).length>1?'s':''}${st?' · best '+'★'.repeat(st)+'☆'.repeat(3-st):''}</div>
      ${news?`<div class="en"><small>new</small> ${news}</div>`:''}
      <button class="go" id="bGo">${st?'DEFEND AGAIN':'HOLD THE DOOR'}${ecoWants()?`<small class="ecost">⚡ ${ecoCost(L0,hard)} energy${ecoOn()?' · you have '+ecoEnergy().n:''}</small>`:''}</button>
      <div style="display:flex;gap:6px;margin-top:7px">
        ${hardOpen()?`<button class="btn sec" id="bDiff" style="margin:0;flex:1">${DIFFS[ACC.diff].e} ${DIFFS[ACC.diff].lbl}</button>`:`<button class="btn sec" id="bNextC" style="margin:0;flex:1">📍 Stage ${auto.id}</button>`}
        <button class="btn sec" id="bOn" style="margin:0;flex:1">🚪 Daily Hold</button>
      </div></div>`;""",
    r"""  const pc=`<div class="playcard mapcard2 ${st?'done':''}" id="playcard">
      <div class="gt">STAGE ${L0.id} OF ${LEVELS.length}</div><h2>${L0.n}</h2>
      ${(hard||L0.mod||L0.boss)?`<div class="pchips">${hard?'<i>👑 Hard</i>':''}${L0.mod?`<i>${MODS[L0.mod].e} ${esc(MODS[L0.mod].n)}</i>`:''}${L0.boss?'<i>⚔ Boss battle</i>':''}</div>`:''}
      <div class="sb">${L0.sub} · ${BIOME_E[L0.biome]||''} ${L0.waves} waves · ${(L0.gates||[GX]).length} gate${(L0.gates||[GX]).length>1?'s':''}${st?` · best <b class="bst">${'★'.repeat(st)}<i>${'★'.repeat(3-st)}</i></b>`:''}</div>
      ${news?`<div class="en"><small>new</small> ${news}</div>`:''}
      ${deckStripHTML()}
      <button class="go" id="bGo">⚔ TO BATTLE${ecoWants()?`<small class="ecost">⚡ ${ecoCost(L0,hard)} energy${ecoOn()?' · you have '+ecoEnergy().n:''}</small>`:''}</button>
      <div class="prow">
        ${hardOpen()?`<button class="btn sec" id="bDiff">${DIFFS[ACC.diff].e} ${DIFFS[ACC.diff].lbl}</button>`:''}${L0.id!==auto.id?`<button class="btn sec" id="bNextC">📍 Next stage</button>`:''}
        <button class="btn sec" id="bOn">🚪 Daily Hold</button>
      </div></div>`;""", 1, 'map-card')
rep("  $('#bGo').addEventListener('click',()=>prepGo(()=>startGame({mode:'campaign',level:L0})));\n  const bd=$('#bDiff');",
    "  $('#bGo').addEventListener('click',()=>prepGo(()=>startGame({mode:'campaign',level:L0})));\n  const pdk=$('#pDeck');if(pdk)pdk.addEventListener('click',()=>{SFX.play('tap',60);PREP.ret=L0.id;showHub('coll','deck');});\n  const bd=$('#bDiff');", 1, 'map-deck-link')

# ---- the result screen ----
rep(r"""<span class="nx">NEXT ▸</span><small>Stage ${next.id} · ${next.n}${ecoWants()""", r"""<span class="nx">NEXT STAGE ›</span><small>Stage ${next.id} · ${esc(next.n)}${ecoWants()""", 1, 'res-next-label')
rep(r"""  <p>Gate at ${Math.round(100*G.doorHp/G.doorMax)}% · best here ${'⭐'.repeat(stageStars(null,L.id,1))}</p>
  <p class="m"><b style="color:var(--gold)">+${G.goldReward||0} 🪙 gold</b> · ${gained?`+${gained} ⭐ · +${gained*(ACC.diff==='kingsguard'?12:8)} 💎`:'no new stars this time'}${G.cardReward?` · <span style="color:var(--gold)">+${G.cardReward.n} ${esc(G.cardReward.name)} card${G.cardReward.n>1?'s':''}</span>`:''}${newUnlocks?` · <span style="color:var(--gold)">${newUnlocks} new champion${newUnlocks>1?'s':''}</span>`:''}${cleared()===ONLINE_AT?' · <span style="color:var(--gold)">Daily Hold unlocked</span>':''}</p>""",
    r"""  <p class="rsub">Gate at ${Math.round(100*G.doorHp/G.doorMax)}% · best here ${'★'.repeat(stageStars(null,L.id,1))}</p>
  <p class="m rew"><b class="rt gold">+${G.goldReward||0} 🪙 gold</b>${gained?`<b class="rt">+${gained} ⭐</b><b class="rt">+${gained*(ACC.diff==='kingsguard'?12:8)} 💎</b>`:'<b class="rt dim">no new stars</b>'}${G.cardReward?`<b class="rt">+${G.cardReward.n} 🃏 ${esc(G.cardReward.name)}</b>`:''}${newUnlocks?`<b class="rt">+${newUnlocks} champion${newUnlocks>1?'s':''}</b>`:''}${cleared()===ONLINE_AT?'<b class="rt">🚪 Daily Hold unlocked</b>':''}</p>""", 1, 'res-rewards')
rep(r"""  <div class="resrow"><button class="btn sec" id="bRetry">🔁 Replay</button><button class="btn sec" id="bUp">⬆️ Upgrades</button><button class="btn sec" id="bMap">🗺️ Map</button><button class="btn sec" id="bShare">📨 Share</button></div>`);""",
    r"""  <div class="resrow"><button class="btn sec" id="bRetry">⟲ Replay</button><button class="btn sec" id="bHome">🏠 Home</button></div>
  <div class="reslinks"><button id="bMap">🗺 Map</button><button id="bUp">⬆ Upgrades</button><button id="bShare">📨 Share</button></div>`);""", 1, 'res-win-rows')
rep(r"""<p class="m">${G.kills} kills · ${DIFFS[ACC.diff].e} ${DIFFS[ACC.diff].lbl}</p><p>${tipFor(L)}</p>
  ${got.map(a=>`<p style="color:var(--gold)">🏆 ${a.n} +${a.g}💎</p>`).join('')}
  <button class="btn" id="bRetry"><span class="e">🔁</span> Try again</button>
  <div class="resrow"><button class="btn sec" id="bHero">⚔️ Champion</button><button class="btn sec" id="bUp">🏰 Towers</button><button class="btn sec" id="bMap">🗺️ Map</button></div>
  ${hardOpen()?`<button class="btn sec" id="bDiff2">${DIFFS[ACC.diff].e} Change difficulty</button>`:''}`);""",
    r"""<p class="m">${G.kills} kills · ${DIFFS[ACC.diff].e} ${DIFFS[ACC.diff].lbl}</p><p class="tip">${tipFor(L)}</p>
  ${got.map(a=>`<p style="color:var(--gold)">🏆 ${a.n} +${a.g}💎</p>`).join('')}
  <button class="btn nextbig retry" id="bRetry"><span class="nx">⟲ TRY AGAIN</span><small>Stage ${L.id} · ${esc(L.n)}</small></button>
  <div class="resrow"><button class="btn sec" id="bHome">🏠 Home</button><button class="btn sec" id="bHero">⚔️ Champion</button><button class="btn sec" id="bUp">🏰 Towers</button></div>
  <div class="reslinks"><button id="bMap">🗺 Map</button>${hardOpen()?`<button id="bDiff2">${DIFFS[ACC.diff].e} Change difficulty</button>`:''}</div>`);""", 1, 'res-lose-rows')
rep("  $('#bRetry').addEventListener('click',()=>startGame({mode:'campaign',level:L}));\n  $('#bUp').addEventListener('click',()=>win?showUpgrades():showTowerRoom());",
    "  $('#bRetry').addEventListener('click',()=>startGame({mode:'campaign',level:L}));const bhm=$('#bHome');if(bhm)bhm.addEventListener('click',()=>{SFX.play('tap',60);showHub('battle');});\n  $('#bUp').addEventListener('click',()=>win?showUpgrades():showTowerRoom());", 1, 'res-home-bind')
