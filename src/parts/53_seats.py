# v1.0.49 — every seat is its own defender on the server (backend v3: rows keyed by tg_id + seat).
# Before: scoreSummary() merged the three seats into one number and the RPCs carried no seat, so
# three seats on one phone shared one leaderboard row and only the best of them was kept.

# 1. the score of the CURRENT seat only (the server keeps one row per seat)
rep("""function scoreSummary(){
  let stars=0,gates=0,waves=0,kills=0;
  for(const a of SAVE.slots){if(!a)continue;let st=0;for(const k in a.campaign)st+=a.campaign[k]||0;for(const k in (a.hard||{}))st+=a.hard[k]||0;
    stars=Math.max(stars,st);gates=Math.max(gates,Object.keys(a.campaign||{}).length);waves=Math.max(waves,(a.stats&&a.stats.onlineBest)||0);kills+=(a.stats&&a.stats.kills)||0;}
  return{stars,gates,waves,kills};
}""", """function scoreSummary(){
  /* v1.0.49: the seat being played, not the best of all three — each seat has its own row on the server */
  const a=ACC||(SAVE.cur>=0?SAVE.slots[SAVE.cur]:null);let stars=0,gates=0,waves=0,kills=0;
  if(a){for(const k in (a.campaign||{}))stars+=a.campaign[k]||0;for(const k in (a.hard||{}))stars+=a.hard[k]||0;gates=Object.keys(a.campaign||{}).length;waves=(a.stats&&a.stats.onlineBest)||0;kills=(a.stats&&a.stats.kills)||0;}
  return{stars,gates,waves,kills};
}
function seatNo(){return SAVE&&SAVE.cur>=0?SAVE.cur|0:-1;}
/* leaderboard rows: "me" is my Telegram id AND the seat I am playing; other seats of mine show as "Name II" / "Name III" */
function lbIsMe(p){return !!(p&&CLOUD.tg_id&&p.tg_id===CLOUD.tg_id&&((p.seat==null?0:+p.seat)===Math.max(0,seatNo())));}
function lbName(p){const s=p&&p.seat!=null?+p.seat:0;return esc(p.name)+(s>0&&s<3?' '+ROMAN3[s]:'');}
function lbStale(){return !CLOUD.lb||Date.now()-CLOUD.lbAt>60000||CLOUD.lb._seat!==Math.max(0,seatNo());}
function lbMine(lb){return lb&&lb._seat===Math.max(0,seatNo())?{me:lb.me||null,myday:lb.myday||null}:{me:null,myday:null};}""", 1, 'scoreSummary per seat')

# 2. every RPC carries the seat
rep("const r=await sbRpc('save_progress',{token:CLOUD.token,save:SAVE,ver:SAVE.ver||0,house:ACC?ACC.house:null,realm:ACC?ACC.langI:0,stars:st.stars,gates:st.gates,waves:st.waves,kills:st.kills},{keepalive:!!keep,timeout:9000});",
    "const r=await sbRpc('save_progress',{token:CLOUD.token,save:SAVE,ver:SAVE.ver||0,house:ACC?ACC.house:null,realm:ACC?ACC.langI:0,stars:st.stars,gates:st.gates,waves:st.waves,kills:st.kills,seat:seatNo()},{keepalive:!!keep,timeout:9000});", 1, 'save_progress seat')
rep("sbRpc('hold_result',{token:CLOUD.token,day:dayKeyUTC(),waves,kills:G.kills},{timeout:8000})",
    "sbRpc('hold_result',{token:CLOUD.token,day:dayKeyUTC(),waves,kills:G.kills,seat:Math.max(0,seatNo()),house:ACC.house,realm:ACC.langI},{timeout:8000})", 1, 'hold_result seat')
rep("""  if(!sbReady())return null;if(!force&&CLOUD.lb&&Date.now()-CLOUD.lbAt<60000)return CLOUD.lb;
  try{const r=await sbRpc('leaderboard',{realm:null,me:CLOUD.tg_id||null},{timeout:8000});CLOUD.lb=r;CLOUD.lbAt=Date.now();""",
    """  if(!sbReady())return null;if(!force&&!lbStale())return CLOUD.lb;
  try{const seat=Math.max(0,seatNo());const r=await sbRpc('leaderboard',{realm:null,me:CLOUD.tg_id||null,seat},{timeout:8000});if(r&&typeof r==='object')r._seat=seat;CLOUD.lb=r;CLOUD.lbAt=Date.now();""", 1, 'leaderboard seat')

# 3. the screens: refetch when the seat changed, match "me" by tg_id + seat, show the seat numeral
rep("if(!noFetch&&sbReady()&&(!CLOUD.lb||Date.now()-CLOUD.lbAt>60000))fetchLeaderboard(true)", "if(!noFetch&&sbReady()&&lbStale())fetchLeaderboard(true)", 1, 'realms refetch')
rep("const meRow=lb&&lb.me?lb.me:null;", "const meRow=lbMine(lb).me;", 1, 'realms meRow')
rep("""<div class="lbrow ${meRow&&t.tg_id===meRow.tg_id?'me':''}"><span class="rk">${t.rank<=3?['🥇','🥈','🥉'][t.rank-1]:'#'+t.rank}</span><span class="hs">${(HOUSES[t.house]||{}).e||'🛡️'}</span><span class="nm">${esc(t.name)}</span>""",
    """<div class="lbrow ${lbIsMe(t)?'me':''}"><span class="rk">${t.rank<=3?['🥇','🥈','🥉'][t.rank-1]:'#'+t.rank}</span><span class="hs">${(HOUSES[t.house]||{}).e||'🛡️'}</span><span class="nm">${lbName(t)}</span>""", 1, 'realms top rows')
rep("""<div class="lbrow me"><span class="rk">#${meRow.rank}</span><span class="hs">${(HOUSES[meRow.house]||{}).e||'🛡️'}</span><span class="nm">${esc(meRow.name)}</span>""",
    """<div class="lbrow me"><span class="rk">#${meRow.rank}</span><span class="hs">${(HOUSES[meRow.house]||{}).e||'🛡️'}</span><span class="nm">${lbName(meRow)}</span>""", 1, 'realms me row')
# the gate-fell table: today's defenders when the server has them, my other seats stay listed under their numeral
rep("const lb=cachedLb();const top=((lb&&lb.top)||[]).filter(t=>t.waves>0&&t.tg_id!==CLOUD.tg_id).map(t=>({name:t.name,waves:t.waves,kills:t.kills,realm:t.realm||0,me:false}));",
    "const lb=cachedLb();const src=(lb&&lb.today&&lb.today.length)?lb.today:((lb&&lb.top)||[]);const top=src.filter(t=>t.waves>0&&!lbIsMe(t)).map(t=>({name:lbName(t),waves:t.waves,kills:t.kills,realm:t.realm||0,me:false,raw:true}));", 1, 'online over list')
rep("""${all.map((r,i)=>`<tr class="${r.me?'me':''}"><td>${i+1}</td><td>${flag((LANGS[r.realm]||LANGS[0]).c,22)}</td><td>${esc(r.name)}</td>""",
    """${all.map((r,i)=>`<tr class="${r.me?'me':''}"><td>${i+1}</td><td>${flag((LANGS[r.realm]||LANGS[0]).c,22)}</td><td>${r.raw?r.name:esc(r.name)}</td>""", 1, 'online over rows')

# hub (hub.js): Hold + Events standings
hrep("if(sbReady()&&(!CLOUD.lb||Date.now()-CLOUD.lbAt>60000))fetchLeaderboard(true).then(r=>{if(r&&CLOUD.screen==='hub:events')showHub('events',sub);});",
     "if(sbReady()&&lbStale())fetchLeaderboard(true).then(r=>{if(r&&CLOUD.screen==='hub:events')showHub('events',sub);});", 1, 'events refetch')
hrep("if(sbReady()&&(!CLOUD.lb||Date.now()-CLOUD.lbAt>60000))fetchLeaderboard(true).then(r=>{if(r&&CLOUD.screen==='hub:hold')showHub('hold');});",
     "if(sbReady()&&lbStale())fetchLeaderboard(true).then(r=>{if(r&&CLOUD.screen==='hub:hold')showHub('hold');});", 1, 'hold refetch')
hrep("const today=(lb&&lb.today)||null;const me=(lb&&lb.myday)||null;", "const today=(lb&&lb.today)||null;const me=lbMine(lb).myday;", 1, 'hold myday')
hrep("""<div class="standrow ${p.tg_id===CLOUD.tg_id?'me':''}"><span class="rk">${i+1}</span>${p.house&&HOUSES[p.house]?crest(p.house,22):''}<span class="nm">${esc(p.name)}<small>${(LANGS[p.realm]||LANGS[0]).c}</small></span><span class="v">${p.waves} 🌊</span></div>""",
     """<div class="standrow ${lbIsMe(p)?'me':''}"><span class="rk">${i+1}</span>${p.house&&HOUSES[p.house]?crest(p.house,22):''}<span class="nm">${lbName(p)}<small>${(LANGS[p.realm]||LANGS[0]).c}</small></span><span class="v">${p.waves} 🌊</span></div>""", 1, 'hold rows')
hrep("""<div class="standrow ${p.tg_id===CLOUD.tg_id?'me':''}"><span class="rk">${i+1}</span>${p.house&&HOUSES[p.house]?crest(p.house,22):''}<span class="nm">${esc(p.name)}<small>${(LANGS[p.realm]||LANGS[0]).c}</small></span><span class="v">${p.waves} 🌊 · ${p.stars} ⭐</span></div>""",
     """<div class="standrow ${lbIsMe(p)?'me':''}"><span class="rk">${i+1}</span>${p.house&&HOUSES[p.house]?crest(p.house,22):''}<span class="nm">${lbName(p)}<small>${(LANGS[p.realm]||LANGS[0]).c}</small></span><span class="v">${p.waves} 🌊 · ${p.stars} ⭐</span></div>""", 1, 'events defender rows')
# the Hold header: which seat these numbers belong to
hrep("""<div class="hh" style="margin-top:12px"><h2>${today?"Today's defenders":'Top defenders'}</h2><small>${me&&me.rank?'your rank #'+me.rank:(sbReady()?'live':'offline')}</small></div>""",
     """<div class="hh" style="margin-top:12px"><h2>${today?"Today's defenders":'Top defenders'}</h2><small>${me&&me.rank?'seat '+ROMAN3[Math.max(0,seatNo())]+' · your rank #'+me.rank:(sbReady()?'live':'offline')}</small></div>""", 1, 'hold header')
