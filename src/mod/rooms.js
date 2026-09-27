/* ---------- armory: one-time upgrades for the gate, the spells and the champion (tower power lives in the tower workshop) ---------- */
function showUpgrades(){
  const groups=UGROUPS.filter(g=>UPG.some(u=>u.g===g[0]));
  show(`<div class="topbar"><h1>🛡️ Armory<small>One-time upgrades for the gate, your spells and your champion. Towers level up in the workshop.</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m">🪙 <b style="color:var(--gold)">${fmtN(goldOf())}</b> gold · ${UPG.filter(u=>ACC.upg[u.id]).length}/${UPG.length} owned</p>
  <button class="btn sec" id="bTw" style="margin:0 0 8px">🏰 Tower workshop — levels 1–${T_MAX}</button>
  ${groups.map(g=>{const list=UPG.filter(u=>u.g===g[0]);const own=list.filter(u=>ACC.upg[u.id]).length;
    return `<div class="ugh" style="--ugc:${g[3]}"><span class="e">${g[1]}</span><b>${g[2]}</b><small>${own}/${list.length}</small></div>
    <div class="ugrid">${list.map(u=>{const o=ACC.upg[u.id],can=!o&&goldOf()>=ECON.upgCost(u);
      return `<button class="ug ${o?'own':''} ${can||o?'':'no'}" data-u="${u.id}"><span class="e">${u.e}</span><span class="nn">${u.n}</span><span class="ef">${u.s}</span><span class="c">${o?'✔':'🪙'+ECON.upgCost(u)}</span></button>`;}).join('')}</div>`;}).join('')}
  <div id="udesc" class="lvbox" style="margin-top:11px"><span style="color:var(--muted)">Tap an upgrade to read the full effect.</span></div>`);
  $('#bBack').addEventListener('click',()=>showHub('coll','spells'));
  $('#bTw').addEventListener('click',()=>showTowerRoom());
  bind('.ug',b=>{
    const u=UPG.find(x=>x.id===b.dataset.u),own=ACC.upg[u.id],can=!own&&goldOf()>=ECON.upgCost(u);
    const g=UGROUPS.find(x=>x[0]===u.g);
    $('#udesc').innerHTML=`<b style="color:${g[3]}">${g[1]} ${g[2]}</b><br><b>${u.e} ${u.n}</b> <span class="stars">${own?'✔ owned':'🪙'+ECON.upgCost(u)}</span><p style="margin:5px 0 0;font-size:13px">${u.d}</p>${own?'':`<button class="btn" id="bBuy" ${can?'':'disabled'} style="margin-top:8px">${can?'🪙 Buy for '+ECON.upgCost(u):'Not enough gold'}</button>`}`;
    const bb=$('#bBuy');if(bb)bb.addEventListener('click',()=>{if(spendGold(ECON.upgCost(u))){ACC.upg[u.id]=1;SFX.play('upgrade');persist();showUpgrades();}else SFX.play('deny');});
  });
}
/* ---------- tower workshop: permanent levels 1–16, +3% per level, milestones at 4 · 8 · 12 · 16 ---------- */
function towerLine(k,L){const gm=G.mod;G.mod=null;const D=TOWERS[k],st=towerStats({type:k,lvl:1},L);G.mod=gm;
  if(D.kind==='barracks')return `${st.count} men · ${st.shp} hp · ${Math.round(st.sdmg)} dmg · back in ${st.resp}s`;
  if(D.kind==='aura')return `slows ${Math.round((1-st.slow)*100)}% · +${Math.round((st.mark-1)*100)}% damage taken · reach ${Math.round(st.range)}`;
  if(D.kind==='zone')return `${Math.round(st.dps*10)/10} dmg/s · slows ${Math.round((1-st.slow)*100)}% · reach ${Math.round(st.range)}`;
  return `${Math.round(st.dmg*10)/10} dmg · ${st.rate.toFixed(2)}/s · range ${Math.round(st.range)}${st.burn?' · burn '+Math.round(st.burn)+'/s':''}${D.kind==='splash'?' · splash '+Math.round(st.splash):''}`;}
function showTowerRoom(k){
  const open=TKEYS.filter(towerOpen);k=k&&TOWERS[k]?k:(open[0]||'watch');
  const D=TOWERS[k],L=tLvl(k),op=towerOpen(k),cost=L<T_MAX?ECON.tCost(L):0,rc=(UGROUPS.find(g=>g[0]===k)||[])[3]||'#8a97a8';
  const tiles=TKEYS.map(t=>{const o=towerOpen(t);return `<button class="htile ${o?'':'lock'} ${t===k?'view':''}" data-t="${t}">${towerIconHTML(t,o?Math.max(1,maxTowerLvl()):1,52)}<span class="nm">${o?TSHORT[t]+' · '+tLvl(t):'After '+TOWER_UNLOCK[t]}</span></button>`;}).join('');
  const miles=TMILE[k].map((m,i)=>{const got=L>=T_MILE[i];return `<div class="sk2 ${got?'gold':''}"><span class="skb" style="--sc:${rc};--px:36px;width:36px;height:36px"><i>${m[0]}</i></span><span style="flex:1"><b>${m[1]}</b><br>${m[2]}</span><span style="text-align:right;font-family:var(--f-display);font-weight:900;color:${got?'var(--gold)':'var(--muted)'}">${got?'✔':'LV '+T_MILE[i]}</span></div>`;}).join('');
  const det=`<div class="hdet" style="--hc:${rc};--hc2:#1d2a3c">
    <div class="hdtop"><div class="hport">${towerIconHTML(k,Math.max(1,maxTowerLvl()),84)}</div>
      <div class="hdinfo"><b>${D.n}</b><small>${D.sub}</small>
      ${op?`<div class="lvline">Lv ${L}<span class="bar"><i style="width:${Math.round(100*L/T_MAX)}%"></i></span><button data-a="tl" ${L>=T_MAX||goldOf()<cost?'disabled':''}>${L>=T_MAX?'max':'+1 · 🪙'+cost}</button></div>
      <small>+3% power per level · ${L<T_MAX?'next milestone at '+(T_MILE.find(x=>x>L)||T_MAX):'fully forged'}</small>`:`<small style="color:var(--gold)">🔒 Opens after stage ${TOWER_UNLOCK[k]}</small>`}</div></div>
    ${op?`<div class="lvbox" style="margin:8px 0;font-size:12.5px;color:#f2e6c9"><b>Now</b> · ${towerLine(k,L)}${L<T_MAX?`<br><b style="color:var(--gold)">Lv ${L+1}</b> · ${towerLine(k,L+1)}`:''}</div>`:''}
    <div class="cskills">${miles}</div></div>`;
  show(`<div class="topbar"><h1>🏰 Tower workshop<small>Gold buys levels. Every level is a small, permanent step — they add up over the long road north.</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m">🪙 <b style="color:var(--gold)">${fmtN(goldOf())}</b> gold · in battle, towers still upgrade I–V</p>
  <div class="hgrid">${tiles}</div><div id="clist">${det}</div>`);
  $('#bBack').addEventListener('click',()=>showHub('coll','towers'));
  card.querySelectorAll('.htile').forEach(t=>t.addEventListener('click',()=>showTowerRoom(t.dataset.t)));
  const b=card.querySelector('#clist button[data-a="tl"]');if(b)b.addEventListener('click',()=>{const c0=ECON.tCost(tLvl(k));if(tLvl(k)<T_MAX&&spendGold(c0)){ACC.tlv=ACC.tlv||{};ACC.tlv[k]=tLvl(k)+1;SFX.play('upgrade');persist();}else SFX.play('deny');showTowerRoom(k);});
}
/* ---------- hero room ---------- */
function showHeroRoom(viewId){
  const hh=HOUSES[ACC.house],list=CHAMPS.filter(c=>c.house===ACC.house);
  const view=list.find(c=>c.id===viewId)||list.find(c=>c.id===ACC.sel)||list[0];
  const lvlCost=p=>ECON.lvlCost(p.lvl), skCost=l=>ECON.skCost(l);
  const frame=l=>l>=20?'gold':l>=10?'silver':'';
  const tiles=list.map(c=>{const un=unlocked(null,c),ride=ACC.sel===c.id,v=view.id===c.id,fr=un?frame(cprog(null,c.id).lvl):'';
    return `<button class="htile ${un?'':'lock'} ${v?'view':''} ${ride?'ride':''} ${fr}" data-c="${c.id}">${un?portraitHTML(c,58):'<span class="pe">🔒</span>'}<span class="nm">${un?shortName(c)+' · '+cprog(null,c.id).lvl:'After '+UNLOCK_STAGE[c.tier]}</span>${ride?'<i class="rb">RIDING</i>':''}</button>`;}).join('');
  const c=view,p=cprog(null,c.id),un=unlocked(null,c),ride=ACC.sel===c.id,cap=rankCap(p.lvl);
  const det=`<div class="hdet" style="--hc:${hh.col};--hc2:${hh.col2}">
    <div class="hdtop"><div class="hport ${un?frame(p.lvl):''}">${un?portraitHTML(c,84,'big'):'🔒'}<span class="cr">${crest(ACC.house,26)}</span>${un&&p.lvl>=CH_MAX?'<i class="vet">VETERAN</i>':''}</div>
      <div class="hdinfo"><b>${un?c.n:'Sealed champion'}</b><small>${TYPE_LBL[c.type]} · House ${hh.n}</small>
        ${un?`<div class="lvline">Lv ${p.lvl}<span class="bar"><i style="width:${Math.round(100*p.lvl/CH_MAX)}%"></i></span><button data-a="lvl" ${p.lvl>=CH_MAX||goldOf()<lvlCost(p)?'disabled':''}>+1 · ${p.lvl>=CH_MAX?'max':'🪙'+lvlCost(p)}</button></div>
        <small>❤️ +5% health and ⚔️ +4% damage per level · ${p.lvl>=CH_MAX?'gold frame':p.lvl>=10?'silver frame; gold at 20':'silver frame at 10, gold at 20'}</small>`:`<small style="color:var(--gold)">🔒 Unlocks after ${UNLOCK_STAGE[c.tier]} stages held</small>`}</div></div>
    <div class="cskills">${c.sk.map((sk,i)=>{const S=SK[sk],l=p.sk[i],capd=l>=cap&&l<SK_MAX;
      return `<div class="sk2 ${l>=SK_MAX?'gold':''}">${skillIcon(sk,40,0)}<span style="flex:1"><b>${S.n}</b>${S.ult?' · ULTIMATE':''}<br>${S.d(S.v[l-1])}${l<SK_MAX?`<br><small style="color:var(--muted)">rank ${l+1}: ${S.d(S.v[l])}</small>`:''}</span><span style="text-align:right"><span class="pips">${'●'.repeat(l)}${'○'.repeat(SK_MAX-l)}</span><br><button data-a="sk" data-i="${i}" ${!un||l>=SK_MAX||capd||goldOf()<skCost(l)?'disabled':''}>${l>=SK_MAX?'max':capd?'🔒 Lv '+SK_CAP[l]:'🪙'+skCost(l)}</button></span></div>`;}).join('')}</div>
    ${un?`<div class="ctal ${p.lvl>=TAL_AT?'':'locked'}"><b class="tlbl">⭐ Bonus talent — ${p.lvl>=TAL_AT?'pick one, swap any time':'unlocks at level '+TAL_AT+' · pick one of two'}</b>${TALENTS[c.id].map((t,i)=>`<button class="tal2 ${p.tal===i+1?'on':''}" ${p.lvl>=TAL_AT?`data-a="tal" data-i="${i+1}"`:'disabled'}><span class="e">${talEmoji(t)}</span><span style="flex:1"><b>${t.n}</b><br>${talDesc(t)}</span>${p.tal===i+1?'<span class="tk">✔</span>':p.lvl>=TAL_AT?'':'<span class="tk">🔒</span>'}</button>`).join('')}</div>`:''}
    <div class="cfoot"><button data-a="sel" ${!un||ride?'disabled':''}>${ride?'✔ Riding with you':'✔ Ride with '+shortName(c)}</button></div></div>`;
  show(`<div class="topbar"><h1>${hh.e} Hero room<small>One champion rides with you per battle. Gold buys levels (up to ${CH_MAX}) and skill ranks (up to ${SK_MAX}).</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m">🪙 <b style="color:var(--gold)">${fmtN(goldOf())}</b> gold · 💎 ${ACC.gems} dragonglass · 🚪 ${cleared()}/${LEVELS.length} stages held</p>
  <div class="hgrid">${tiles}</div><div id="clist">${det}</div>`);
  $('#bBack').addEventListener('click',()=>showHub('coll','heroes'));
  card.querySelectorAll('.htile').forEach(t=>t.addEventListener('click',()=>showHeroRoom(t.dataset.c)));
  card.querySelectorAll('#clist button').forEach(b=>b.addEventListener('click',()=>{
    const id=c.id,a=b.dataset.a;
    if(a==='lvl'){const c0=lvlCost(p);if(p.lvl<CH_MAX&&spendGold(c0)){p.lvl++;SFX.play('levelup');}else SFX.play('deny');}
    else if(a==='sk'){const i=+b.dataset.i,l=p.sk[i],c0=skCost(l);if(l<SK_MAX&&l<rankCap(p.lvl)&&spendGold(c0)){p.sk[i]++;SFX.play('upgrade');}else SFX.play('deny');}
    else if(a==='tal'){p.tal=+b.dataset.i;}
    else ACC.sel=id;
    persist();showHeroRoom(id);
  }));
}
