# ---- difficulty: Easy for the whole road, Hard opens after all 50; NEXT after a win; save migration; the 50-pin map ----
i = s.find('const DIFFS={'); j = s.find('\n', i); assert i > 0
s = s[:i] + "const DIFFS={squire:{k:'squire',lbl:'EASY',n:'Squire',e:'🛡️',sub:'The road north',hp:0.8,spd:0.95,gate:1.25,gold:1.15},kingsguard:{k:'kingsguard',lbl:'HARD',n:'Kingsguard',e:'👑',sub:'Tough dead, weaker gate, 40% more gold',hp:1.25,spd:1.08,gate:0.9,gold:1.3}};" + s[j:]
rep("const DORDER=['squire','knight','kingsguard'];\nconst DNEXT={knight:'squire',kingsguard:'knight'};", "const DORDER=['squire','kingsguard'];\nconst DNEXT={kingsguard:'squire'};", label='dorder')
rep("function DIFF(){return DIFFS[ACC&&ACC.diff||'knight'];}", "const DIFF_HOLD={k:'hold',hp:1,spd:1,gate:1,gold:1};/* the daily Hold is the same siege for every player, whatever their campaign difficulty */\nfunction DIFF(){if(G&&G.mode==='online')return DIFF_HOLD;return DIFFS[ACC&&ACC.diff]||DIFFS.squire;}\nfunction campOf(a){const A=a||ACC;if(A.diff==='kingsguard'){if(!A.hard)A.hard={};return A.hard;}return A.campaign;}\nfunction hardOpen(a){return cleared(a)>=LEVELS.length;}", label='diff')
rep("function starsEarned(a){return Object.values((a||ACC).campaign).reduce((x,y)=>x+y,0);}",
    "function starsEarned(a){const A=a||ACC;return Object.values(A.campaign).reduce((x,y)=>x+y,0)+Object.values(A.hard||{}).reduce((x,y)=>x+y,0);}", label='stars')
rep("function levelOpen(h,L){return L.id===1||((h||ACC).campaign[L.id-1]||0)>=1;}", "function levelOpen(h,L){return L.id===1||(campOf(h)[L.id-1]||0)>=1;}", label='levelOpen')
rep("function diffOpen(k){if(k==='squire')return true;return !!(ACC.won&&ACC.won[DNEXT[k]]);}", "function diffOpen(k){return k==='squire'||hardOpen();}", label='diffOpen')
rep("won:{},campaign:{},champs:{},", "won:{},campaign:{},hard:{},cv:45,pv:45,tlv:{},champs:{},", label='newacc')
# migration: 13 gates × 3 stages → 50 stages; champion 1–10 → 1–20; tower perks → refund
rep("if(!DIFFS[a.diff])a.diff='squire';", "if(!DIFFS[a.diff])a.diff='squire';migrate45(a);", label='fixsave')
rep("function persist(){", """function migrate45(a){
  if((a.cv||0)<45){const O2N=[0,1,9,11,16,18,19,21,25,34,31,38,43,47],oc=a.campaign||{};let M=0;for(let g=1;g<=13;g++)if(oc[g])M=Math.max(M,O2N[g]);
    const nc={};for(let k=1;k<=M;k++)nc[k]=1;for(let g=1;g<=13;g++)if(oc[g])nc[O2N[g]]=Math.max(nc[O2N[g]]||0,oc[g]);
    a.campaign=nc;delete a.stg;a.hard={};a.diff='squire';a.won={};a.cv=45;}
  if((a.pv||0)<45){for(const id in a.champs){const p=a.champs[id];const L=p.lvl||1;p.lvl=Math.min(20,Math.max(1,2*L-1));if(p.tal&&p.lvl<10)p.lvl=10;p.sk=(p.sk||[1,1,1]).map(r=>Math.min(5,Math.max(1,2*r-1)));}
    let ref=0;for(const u of UPG_OLD)if(TOWERS[u.g]&&a.upg&&a.upg[u.id]){ref+=({1:300,2:600,3:1000})[u.c]||300;delete a.upg[u.id];}
    a.gold=(a.gold||0)+ref;if(ref)a.refund=ref;a.tlv=a.tlv||{};a.pv=45;}
  if(!a.tlv)a.tlv={};if(!a.hard)a.hard={};}
function persist(){""", label='migrate')
rep("let st=0;for(const k in a.campaign)st+=a.campaign[k]||0;if(a.stg)for(const g in a.stg)for(const x in a.stg[g])st+=a.stg[g][x]||0;",
    "let st=0;for(const k in a.campaign)st+=a.campaign[k]||0;for(const k in (a.hard||{}))st+=a.hard[k]||0;", label='score')
# victory
rep("""  const ratio=G.doorHp/G.doorMax,stars=ratio>=0.7?3:ratio>=0.35?2:1,h=ACC;
  if(G.level.id===LEVELS.length){if(!h.won)h.won={};h.won[h.diff]=1;}
  const S=G.level.stage||1;if(S>1){h.stg=h.stg||{};h.stg[G.level.id]=h.stg[G.level.id]||{};}
  const prev=S>1?(h.stg[G.level.id][S]||0):(h.campaign[G.level.id]||0);""",
"""  const ratio=G.doorHp/G.doorMax,stars=ratio>=0.7?3:ratio>=0.35?2:1,h=ACC,Cm=campOf(h),wasHard=hardOpen();
  if(G.level.id===LEVELS.length){if(!h.won)h.won={};h.won[h.diff]=1;}
  const prev=Cm[G.level.id]||0;""", label='vic1')
rep("""  if(stars>prev){if(S>1)h.stg[G.level.id][S]=stars;else h.campaign[G.level.id]=stars;}
  h.gems+=gained*(S>1?10:8);""", """  if(stars>prev)Cm[G.level.id]=stars;
  h.gems+=gained*(h.diff==='kingsguard'?12:8);G.hardNew=!wasHard&&hardOpen();""", label='vic2')
i = s.find('function showCampaignResult(win,stars,newUnlocks,gained){'); j = s.find('function tipFor(L){', i); assert 0 < i < j
s = s[:i] + r"""function showCampaignResult(win,stars,newUnlocks,gained){
  const L=G.level,next=LEVELS[L.id]||null,nextOpen=next&&levelOpen(null,next);
  const got=grantAch();persist();
  const nx=nextOpen?`<button class="btn nextbig" id="bNext"><span class="nx">NEXT ▸</span><small>Stage ${next.id} · ${next.n}</small></button>`:'';
  if(win)show(`<h1>The gate held<small>Stage ${L.id} · ${L.n} · ${G.kills} of the dead put down</small></h1><div class="big stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
  <p>Gate at ${Math.round(100*G.doorHp/G.doorMax)}% · best here ${'⭐'.repeat(stageStars(null,L.id,1))}</p>
  <p class="m"><b style="color:var(--gold)">+${G.goldReward||0} 🪙 gold</b> · ${gained?`+${gained} ⭐ · +${gained*(ACC.diff==='kingsguard'?12:8)} 💎`:'no new stars this time'}${newUnlocks?` · <span style="color:var(--gold)">${newUnlocks} new champion${newUnlocks>1?'s':''}</span>`:''}${cleared()===ONLINE_AT?' · <span style="color:var(--gold)">Daily Hold unlocked</span>':''}</p>
  ${got.map(a=>`<p style="color:var(--gold)">🏆 ${a.n} +${a.g}💎</p>`).join('')}
  ${G.hardNew?'<p style="color:var(--gold);font-weight:700">👑 All fifty stages held. HARD is open — the same road, tougher dead, more gold.</p>':''}
  ${nx}${!next?`<p style="color:var(--gold)">${ACC.diff==='kingsguard'?'Westeros stands, even on Hard.':'Westeros stands. The Long Night is over.'}</p>`:''}
  ${G.hardNew?'<button class="btn" id="bHard">👑 Ride on Hard</button>':''}
  <div class="resrow"><button class="btn sec" id="bRetry">🔁 Replay</button><button class="btn sec" id="bUp">⬆️ Upgrades</button><button class="btn sec" id="bMap">🗺️ Map</button></div>`);
  else show(`<h1>The gate has fallen<small>Stage ${L.id} · ${L.n}, wave ${G.wave} of ${L.waves}</small></h1><p class="m">${G.kills} kills · ${DIFFS[ACC.diff].e} ${DIFFS[ACC.diff].lbl}</p><p>${tipFor(L)}</p>
  ${got.map(a=>`<p style="color:var(--gold)">🏆 ${a.n} +${a.g}💎</p>`).join('')}
  <button class="btn" id="bRetry"><span class="e">🔁</span> Try again</button>
  <div class="resrow"><button class="btn sec" id="bHero">⚔️ Champion</button><button class="btn sec" id="bUp">🏰 Towers</button><button class="btn sec" id="bMap">🗺️ Map</button></div>
  ${hardOpen()?`<button class="btn sec" id="bDiff2">${DIFFS[ACC.diff].e} Change difficulty</button>`:''}`);
  const bn=$('#bNext');if(bn)bn.addEventListener('click',()=>{SFX.play('tap',60);startGame({mode:'campaign',level:next});});
  const bh=$('#bHard');if(bh)bh.addEventListener('click',()=>{ACC.diff='kingsguard';persist();showCampaign();});
  const bd=$('#bDiff2');if(bd)bd.addEventListener('click',()=>showDifficulty(false));
  const bhe=$('#bHero');if(bhe)bhe.addEventListener('click',()=>showHeroRoom(ACC.sel));
  $('#bRetry').addEventListener('click',()=>startGame({mode:'campaign',level:L}));
  $('#bUp').addEventListener('click',()=>win?showUpgrades():showTowerRoom());$('#bMap').addEventListener('click',()=>showCampaign());
}
""" + s[j:]
i = s.find('function showDifficulty(first){'); j = s.find('/* ---------- the map hub ---------- */', i); assert 0 < i < j
s = s[:i] + r"""function showDifficulty(first){
  show(`<div class="topbar"><h1>Difficulty<small>The road north is walked on Easy. Hold all ${LEVELS.length} stages to open Hard.</small></h1>${first?'':'<button class="back" id="bBack">✖</button>'}</div>
  <div class="diffgrid">${DORDER.map(k=>{const d=DIFFS[k],open=diffOpen(k);
    return `<button class="diffcard ${ACC.diff===k?'cur':''} ${open?'':'no'}" data-d="${k}" ${open?'':'disabled'}><span class="e">${open?d.e:'🔒'}</span><span class="lbl">${d.lbl}</span><span class="nm2">${d.n}</span><span class="sb">${open?d.sub:'Hold all '+LEVELS.length+' stages on Easy · '+cleared()+'/'+LEVELS.length}</span></button>`;}).join('')}</div>
  <p class="m">Hard keeps its own stars. Every level and upgrade you own carries over.</p>`);
  const bb=$('#bBack');if(bb)bb.addEventListener('click',()=>showHub('battle'));
  bind('.diffcard',b=>{if(!diffOpen(b.dataset.d))return;ACC.diff=b.dataset.d;persist();showHub('battle');});
}

""" + s[j:]
# the 50-pin map replaces mapSVG/showCampaign (gateRow and smoothPath stay)
i = s.find('function mapSVG(selId){'); j = s.find('const BIOME_E=', i); assert 0 < i < j
s = s[:i] + mod('worldmap.js') + s[j:]
img = base64.b64encode(open(V + 'assets/westeros_1200.webp', 'rb').read()).decode()
i = s.find("const MAP_ART='data:image/jpeg;base64,"); j = s.find("';", i) + 2; assert i > 0
s = s[:i] + "const MAP_ART='data:image/webp;base64," + img + "';" + s[j:]
# css for the map view, the NEXT button and the result rows
rep("</style>", """.mapview{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;background:#0d1a2a;cursor:grab;overscroll-behavior:contain}
.mapview .wmap2{width:200%;max-width:none;display:block}
.mapview .mn{cursor:pointer}.mapview .mn.lock{cursor:default}
.mapcard2{margin:6px 8px 4px;padding:8px 11px;flex:none}
.mapcard2 h2{font-size:19px;margin:2px 0 1px}.mapcard2 .en{font-size:13px;margin-top:4px}.mapcard2 .en small{font-size:10px;letter-spacing:.12em;color:var(--gold);vertical-align:middle}.mapcard2 .go{padding:10px;margin-top:8px}
.btn.nextbig{background:linear-gradient(180deg,#ffd873,#e0a431);color:#2a1a04;border:2px solid #fff0bd;box-shadow:0 5px 0 #8a5a12,0 10px 20px rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;padding:12px 10px 10px;animation:nxpulse 1.6s ease-in-out infinite}
.btn.nextbig .nx{font-family:var(--f-display);font-weight:900;font-size:24px;letter-spacing:.12em}.btn.nextbig small{font-size:12px;font-weight:700;opacity:.85}
@keyframes nxpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
.resrow{display:flex;gap:6px}.resrow .btn{flex:1;margin:6px 0 0;padding:9px 4px;font-size:13px}
</style>""", n=1, label='css')
# words: stages, not gates
rep("const l=b.querySelector('.l');if(l)l.textContent=open?SPELLS[k].n:'Gate '+SPELLS[k].at;", "const l=b.querySelector('.l');if(l)l.textContent=open?SPELLS[k].n:'Stage '+(SPELLS[k].at+1);", label='spellbtn')
rep("<small>${D.sub}${open?'':' · opens at gate '+TOWER_UNLOCK[k]}</small>", "<small>${D.sub}${open?'':' · opens after stage '+TOWER_UNLOCK[k]}</small>", label='codex1')
rep("`<em>${open?'Build one to open this page.':'Locked until gate '+TOWER_UNLOCK[k]+'.'}</em>`", "`<em>${open?'Build one to open this page.':'Locked until stage '+TOWER_UNLOCK[k]+' is held.'}</em>`", label='codex2')
rep("function tipFor(L){if(L.dragon&&G.wave>=L.dragon)", "function tipFor(L){if(tLvl('watch')<3&&L.id>6)return'Tip: gold from every battle buys tower levels in Collection → Towers. Small steps, but they add up.';if(L.dragon&&G.wave>=L.dragon)", label='tip')
# hub.js: battle tab and texts
hrep("<em>GATE ${Math.min(NG,g+1)} OF ${NG} · ${nextL.n.toUpperCase()}</em>", "<em>STAGE ${Math.min(NG,g+1)} OF ${NG} · ${nextL.n.toUpperCase()}</em>", label='hubstage')
hrep("const nextL=LEVELS.find(l=>levelOpen(null,l)&&!ACC.campaign[l.id])||LEVELS[LEVELS.length-1];", "const nextL=nextStage();", label='hubnext')
hrep("<div class=\"battlerow\"><button class=\"bside\" id=\"bDiffH\"><span class=\"pe\">${DIFFS[ACC.diff].e}</span>${DIFFS[ACC.diff].lbl||DIFFS[ACC.diff].n}</button>",
     "<div class=\"battlerow\">${hardOpen()?`<button class=\"bside\" id=\"bDiffH\"><span class=\"pe\">${DIFFS[ACC.diff].e}</span>${DIFFS[ACC.diff].lbl}</button>`:`<button class=\"bside\" id=\"bMapH\"><span class=\"pe\">🗺️</span>Map</button>`}", label='hubdiff')
hrep("${ACC.tut?(ACC.campaign[nextL.id]?'DEFEND AGAIN':'HOLD GATE '+nextL.id):'YOUR FIRST LESSON'}", "${ACC.tut?(campOf()[nextL.id]?'DEFEND AGAIN':'STAGE '+nextL.id+' · '+nextL.n.toUpperCase()):'YOUR FIRST LESSON'}", label='hubbtn')
hrep("$('#bDiffH').addEventListener('click',()=>showDifficulty(false));", "const bdh=$('#bDiffH');if(bdh)bdh.addEventListener('click',()=>showDifficulty(false));const bmh=$('#bMapH');if(bmh)bmh.addEventListener('click',()=>{SFX.play('tap',60);showCampaign();});", label='hubdiff2')
hrep("  ${ACC.tut?'':'<div class=\"hint\">▲ TAP BEGIN — YOUR CHAMPION WILL TEACH YOU</div>'}`;}",
     "  ${ACC.tut?'':'<div class=\"hint\">▲ TAP BEGIN — YOUR CHAMPION WILL TEACH YOU</div>'}${ACC.refund?`<div class=\"hint\" id=\"refundNote\">🪙 Tower upgrades are now tower levels — ${ACC.refund} gold refunded. Collection → Towers.</div>`:''}`;}", label='refund')
hrep("function hubBattleBind(){", "function hubBattleBind(){if(ACC.refund){ACC.refund=0;persist();}", label='refund2')
hrep("const lockTxt=other?HOUSES[c.house].n.toUpperCase():'GATE '+UNLOCK_STAGE[c.tier];", "const lockTxt=other?HOUSES[c.house].n.toUpperCase():'AFTER '+UNLOCK_STAGE[c.tier];", label='cardlock')
hrep("<span class=\"lk\">GATE ${S.at}</span>", "<span class=\"lk\">AFTER ${S.at}</span>", label='spelllock')
hrep("st:onlineOpen()?'LIVE':'GATE '+ONLINE_AT", "st:onlineOpen()?'LIVE':'AFTER '+ONLINE_AT", label='evlock')
hrep("<b>Opens after gate ${ONLINE_AT}</b><br>Hold ${ONLINE_AT} gates in the campaign", "<b>Opens after stage ${ONLINE_AT}</b><br>Hold ${ONLINE_AT} stages in the campaign", label='holdlock')
hrep("'GATE '+ONLINE_AT+' FIRST'", "'STAGE '+ONLINE_AT+' FIRST'", label='holdlock2')
hrep("win:(L,stars,first)=>Math.round((50+28*L.id+22*stars)*((L.stage||1)>1?1.15:1)*(first?1:0.35)),", "win:(L,stars,first)=>Math.round((60+9*L.id+15*stars)*(first?1:0.35)*(ACC&&ACC.diff==='kingsguard'?1.4:1)),", label='econwin')
rep("resetRun(buildMap({pts:LEVELS[0].pts,seed:hash32('L1'),biome:'snow'}));", "resetRun(buildMap({routes:LEVELS[0].routes,gates:LEVELS[0].gates,raw:true,style:LEVELS[0].style,seed:hash32('L1'),biome:'snow'}));", label='initmap')
rep("🔒 ${ROMAN[t.lvl]} at gate ${LVL_GATES[t.lvl]}</button>", "🔒 ${ROMAN[t.lvl]} after stage ${LVL_GATES[t.lvl]}</button>", label='tierlock')
hrep("function hubBattle(){const hh=HOUSES[ACC.house],c=CBY[ACC.sel],g=cleared(),se=starsEarned();", "function hubBattle(){const hh=HOUSES[ACC.house],c=CBY[ACC.sel],g=Object.keys(campOf()).length,se=starsEarned();", label='hubcount')
