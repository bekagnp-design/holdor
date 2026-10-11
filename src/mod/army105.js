/* =========================== THE ARMY, MADE CLEAR (v1.1.5) ===========================
   A tester and the owner: "choosing a champion means scrolling down a long way; there is too much text; the upgrade must show clearly
   and with a big button; if I want a detail I will tap and open it." So:
   · the champions of the house sit in ONE strip you swipe sideways (the other houses' 42 cards are folded away);
   · the champion stands as a big 3D card (it sways and follows a finger), name, rarity, level and a bar;
   · ONE big button says what to do next — LEVEL UP (with the cards you have drawn as pips), RAISE TO ★n, or what is missing;
   · RIDE WITH X is the second big button;
   · the three skills are three short rows (icon, name, five words, rank pips, a small upgrade button); tapping a row opens its picture
     (skilldemo.js) and the full text; talents, the portal and the gear are folded away until asked;
   · the tower workshop follows the same pattern: a strip, a big tower, a bar, one big UPGRADE button, Now → Next, four milestone chips.
   The same ids and data-a hooks as before (#clist, .htile[data-c], button[data-a=lvl|asc|sk|tal|sel|gear|tl|fod|s1|s10|odds]). */
const ARM={stop:null,tilt:null};
function armStop(){if(ARM.stop){ARM.stop();ARM.stop=null;}if(ARM.tilt){cancelAnimationFrame(ARM.tilt.raf);ARM.tilt=null;}}
function armTilt(stage){const el=stage.querySelector('.acard');if(!el)return;const T={x:0,y:0,tx:0,ty:0,drag:0,t0:performance.now(),raf:0};ARM.tilt=T;
  const pt=e=>{const q=e.touches?e.touches[0]:e,b=stage.getBoundingClientRect();T.drag=1;T.tx=fClamp((q.clientX-(b.left+b.width/2))/(b.width/2),-1,1)*24;T.ty=fClamp((q.clientY-(b.top+b.height/2))/(b.height/2),-1,1)*14;};
  stage.addEventListener('pointerdown',pt);stage.addEventListener('pointermove',e=>{if(T.drag)pt(e);});['pointerup','pointercancel','pointerleave'].forEach(n=>stage.addEventListener(n,()=>{T.drag=0;}));
  const f=()=>{if(!stage.isConnected){return;}const t=(performance.now()-T.t0)/1000;if(!T.drag){T.tx=Math.sin(t*.9)*10;T.ty=Math.cos(t*.7)*5;}T.x+=(T.tx-T.x)*.12;T.y+=(T.ty-T.y)*.12;
    el.style.setProperty('--ry',T.x.toFixed(2)+'deg');el.style.setProperty('--rx',(-T.y).toFixed(2)+'deg');el.style.setProperty('--gx',(50+T.x*2.6).toFixed(1)+'%');el.style.setProperty('--gy',(40-T.y*3).toFixed(1)+'%');T.raf=requestAnimationFrame(f);};T.raf=requestAnimationFrame(f);}
function armStrip(q){const s=card.querySelector(q),v=s&&s.querySelector('.view');if(s&&v)s.scrollLeft=Math.max(0,v.offsetLeft-s.clientWidth/2+v.offsetWidth/2);}
function armPips(h,n){const k=Math.min(h,n);return `<span class="cardpips" aria-label="${h} of ${n} cards">${'<i class="on"></i>'.repeat(k)}${'<i></i>'.repeat(Math.max(0,n-k))}</span>`;}
function armWake(key){return key;}
/* the one big button for a level: ready (green, pulsing), missing (grey, says what), max */
function armLvlBtn(key,attr,l,mx){const h=cardHave(key),n=cardNeed(key),g=cardGold(key),can=cardCan(key);
  if(l>=mx)return `<button class="bigbtn max" disabled><span class="bt">★ FULLY FORGED</span></button>`;
  const need=h<n?`Need ${n-h} more 🃏`:goldOf()<g?`Need ${fmtN(g-goldOf())} more 🪙`:'';
  return `<button class="bigbtn lvl ${can?'ready':'need'}" ${attr} ${can?'':'disabled'}><span class="bt">⬆ LEVEL UP</span><span class="bs">${can?`🃏 ${n} · 🪙 ${fmtN(g)}`:need}</span></button>${armPips(h,n)}`;}
function armSkRankLock(l,lvl){for(let x=lvl+1;x<=CH_MAX;x++)if(rankCap(x)>l)return x;return CH_MAX;}
/* ---------- the champion room ---------- */
function showHeroRoom(viewId,fod,openSk){armStop();
  const hh=HOUSES[ACC.house],list=CHAMPS.filter(c=>c.house===ACC.house);
  const c=list.find(x=>x.id===viewId)||list.find(x=>x.id===ACC.sel)||list[0],p=cprog(null,c.id),un=unlocked(null,c),ride=ACC.sel===c.id,cap=rankCap(p.lvl),r=champRar(c),st=cstar(c.id),lc=champCap(c.id),key='c:'+c.id;
  const tiles=list.map(x=>{const u=unlocked(null,x),rd=ACC.sel===x.id,v=x.id===c.id,rr=champRar(x);
    return `<button class="htile tvt ${u?'':'lock'} ${v?'view':''} ${rd?'ride':''}" style="--rc:${RAR_C[rr]}" data-c="${x.id}">${u?portraitHTML(x,58):'<span class="pe">🔒</span>'}<span class="nm">${u?shortName(x)+' · '+cprog(null,x.id).lvl:'After '+UNLOCK_STAGE[x.tier]}</span>${u?starsHTML(cstar(x.id),'sm'):''}${rd?'<i class="rb">RIDING</i>':''}${u&&(cardCan('c:'+x.id)||(ascReady(x.id)&&list.some(f=>ascCan(x.id,f.id))))?'<span class="upb">⬆</span>':''}</button>`;}).join('');
  const art=CHAMP_ART[c.id+'_portrait'];
  const stage=`<div class="hstage"><div class="acard" style="--rc:${RAR_C[r]};--hc:${hh.col}"><div class="aback"></div><div class="aface">${un?(art?`<div class="aimg" style="background-image:url(${art})"></div>`:`<div class="aimg emoji">${c.e}</div>`):'<div class="aimg sealed">🔒</div>'}<span class="aglare"></span><span class="arar" style="color:${RAR_C[r]}">${un?RAR_N[r]:'SEALED'}</span></div><span class="asig">${crest(ACC.house,30)}</span></div></div>`;
  const name=`<div class="hname"><b>${un?esc(c.n):'Sealed champion'}</b><small>${un?`<em style="color:${RAR_C[r]}">${RAR_N[r]}</em> · ${String(TYPE_LBL[c.type]).split(',')[0]} · House ${hh.n}`:`🔒 After ${UNLOCK_STAGE[c.tier]} stages — or from the portal`}</small>${un?starsHTML(st):''}</div>`;
  let act='';
  if(un){
    if(ascReady(c.id)){
      const fods=list.filter(f=>f.id!==c.id&&cardHave('c:'+f.id)>0);const fsel=fods.find(f=>f.id===fod&&ascCan(c.id,f.id))||fods.find(f=>ascCan(c.id,f.id));
      act=`<div class="ascbox"><b>★${st} → ★${st+1}</b><small>opens levels ${10*st+1}–${Math.min(CH_MAX,10*st+10)} · 🪙 ${fmtN(ascGold(c.id))} + burn the cards of another champion:</small>
        <div class="fods">${fods.length?fods.map(f=>{const n=ascNeed(c.id,f.id),h=cardHave('c:'+f.id);return `<button class="fod ${fsel&&fsel.id===f.id?'on':''} ${h>=n?'':'short'}" data-a="fod" data-f="${f.id}" style="--rc:${RAR_C[champRar(f)]}">${portraitHTML(f,34)}<small>${h}/${n}</small></button>`;}).join(''):'<small class="none">No cards of another champion yet — chests and the portal bring them.</small>'}</div>
        <button class="bigbtn lvl ${fsel?'ready':'need'} ascgo" data-a="asc" data-f="${fsel?fsel.id:''}" ${fsel?'':'disabled'}><span class="bt">⭐ RAISE TO ★${st+1}</span><span class="bs">${fsel?`burn ${ascNeed(c.id,fsel.id)} ${esc(shortName(fsel))}`:'pick a champion to burn'}</span></button></div>`;}
    else{act=`<div class="hlv"><b>Lv ${p.lvl}</b><em>/ ${lc}</em><span class="bar"><i style="width:${Math.round(100*p.lvl/lc)}%"></i></span></div>${armLvlBtn(key,'data-a="lvl"',p.lvl,CH_MAX)}${cardHave(key)<cardNeed(key)&&p.lvl<CH_MAX?`<button class="linkbtn" data-a="chests">🎁 Cards come from chests ›</button>`:''}`;}}
  const ridebtn=`<button class="bigbtn ride ${ride?'on':''}" data-a="sel" ${!un||ride?'disabled':''}><span class="bt">${ride?'✔ RIDING WITH YOU':'⚔ RIDE WITH '+esc(shortName(c)).toUpperCase()}</span></button>`;
  const skills=`<div class="skl">${c.sk.map((sk,i)=>{const S=SK[sk],l=p.sk[i],capd=l>=cap&&l<SK_MAX,nb=skBooks(l),cat=skCat(sk),op=openSk===i,can=skCan(c.id,i);
    const lab=l>=SK_MAX?'MAX':capd?`🔒 Lv ${armSkRankLock(l,p.lvl)}`:`⬆ 📖${nb} · 🪙${fmtN(ECON.skCost(l))}`;
    return `<div class="skr ${op?'open':''} ${l>=SK_MAX?'gold':''}" data-i="${i}"><div class="skrh" data-row="${i}">${skillIcon(sk,44,0)}<span class="skn"><b>${esc(S.n)}${S.ult?'<em>ULT</em>':''}</b><small>${SKTAG[cat]}</small></span><span class="pips">${'●'.repeat(l)}${'○'.repeat(SK_MAX-l)}</span><button data-a="sk" data-i="${i}" ${can?'':'disabled'} class="${can?'go':''}">${lab}</button></div>
      <div class="skrb"><canvas class="rvdemo" width="640" height="360" data-sk="${sk}"></canvas><p>${esc(S.d(S.v[l-1]))}</p>${l<SK_MAX?`<p class="nx">Next rank: ${esc(S.d(S.v[l]))}</p>`:''}</div></div>`;}).join('')}</div>`;
  const tal=un?`<button class="tgl" data-tog="tal">⭐ Bonus talent ${p.lvl>=TAL_AT?(p.tal?'· '+esc(TALENTS[c.id][p.tal-1].n):'· pick one'):'· at level '+TAL_AT} ›</button><div class="ctal ${p.lvl>=TAL_AT?'':'locked'}" data-tgt="tal" ${p.lvl>=TAL_AT&&!p.tal?'':'hidden'}>${TALENTS[c.id].map((t,i)=>`<button class="tal2 ${p.tal===i+1?'on':''}" ${p.lvl>=TAL_AT?`data-a="tal" data-i="${i+1}"`:'disabled'}><span class="e">${talEmoji(t)}</span><span style="flex:1"><b>${esc(t.n)}</b><br>${talDesc(t)}</span><span class="chk">${p.tal===i+1?'✔':''}</span></button>`).join('')}</div>`:'';
  const foot=`<div class="tvfoot"><button data-a="gear" ${un?'':'disabled'}>⚒️ Gear</button><button data-tog="portal">🌀 Portal</button></div>
    <div class="tvsum" data-tgt="portal" hidden><span class="pt">🌀</span><span class="tx"><b>The portal</b><small>A champion of House ${hh.n} · <a data-a="odds">Odds</a></small></span><button data-a="s1" ${ACC.gems>=SUMMON.one?'':'disabled'}>×1<small>💎${SUMMON.one}</small></button><button data-a="s10" ${ACC.gems>=SUMMON.ten?'':'disabled'}>×10<small>💎${SUMMON.ten}</small></button></div>`;
  show(`<div class="topbar"><h1>🍺 Champions<small>swipe, tap, level up</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m cur">🪙 <b style="color:var(--gold)">${fmtN(goldOf())}</b> · 💎 ${ACC.gems} · <span class="bkl">${booksLine()}</span></p>
  <div class="hgrid strip" id="armStrip">${tiles}</div>
  <div id="clist"><div class="hdet2" style="--hc:${hh.col};--hc2:${hh.col2}">${stage}${name}<div class="hact">${act}</div>${ridebtn}${skills}${tal}${foot}</div></div>`);
  CLOUD.screen='hero';armStrip('#armStrip');armTilt(card.querySelector('.hstage'));
  const openDemo=row=>{if(ARM.stop){ARM.stop();ARM.stop=null;}const cv=row&&row.querySelector('canvas');if(cv)ARM.stop=skillDemoLoop(cv,cv.dataset.sk,c.house);};
  const o=card.querySelector('.skr.open');if(o)openDemo(o);
  $('#bBack').addEventListener('click',()=>{armStop();showHub('coll','heroes');});
  card.querySelectorAll('.htile').forEach(t=>t.addEventListener('click',()=>showHeroRoom(t.dataset.c)));
  card.querySelectorAll('.skrh').forEach(h=>h.addEventListener('click',e=>{if(e.target.closest('button'))return;const row=h.parentNode,was=row.classList.contains('open');card.querySelectorAll('.skr.open').forEach(x=>x.classList.remove('open'));if(ARM.stop){ARM.stop();ARM.stop=null;}if(!was){row.classList.add('open');SFX.play('tap',50);openDemo(row);}}));
  card.querySelectorAll('[data-tog]').forEach(b=>b.addEventListener('click',()=>{const t=card.querySelector('[data-tgt="'+b.dataset.tog+'"]');if(t){t.hidden=!t.hidden;SFX.play('tap',50);}}));
  card.querySelectorAll('.tvsum [data-a]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.a;if(a==='odds')summonOdds();else summon(a==='s10'?10:1);}));
  card.querySelectorAll('#clist [data-a]').forEach(b=>b.addEventListener('click',()=>{
    const id=c.id,a=b.dataset.a;
    if(a==='fod'){showHeroRoom(id,b.dataset.f);return;}
    if(a==='gear'){armStop();showForge(id);return;}
    if(a==='chests'){if(typeof hubLocked==='function'&&hubLocked('shop')){SFX.play('deny');ecoToast('🔒 The Shop opens a little later — battles pay chests too');}else{armStop();showHub('shop');}return;}
    let was=null;const op=card.querySelector('.skr.open');if(op)was=+op.dataset.i;
    if(a==='lvl'){if(cardLevelUp(key))SFX.play('levelup');else SFX.play('deny');}
    else if(a==='asc'){if(ascend(id,b.dataset.f))SFX.play('levelup');else SFX.play('deny');}
    else if(a==='sk'){if(skillUp(id,+b.dataset.i)){SFX.play('upgrade');was=+b.dataset.i;}else SFX.play('deny');}
    else if(a==='tal'){p.tal=+b.dataset.i;}
    else if(a==='sel')ACC.sel=id;
    else return;
    persist();showHeroRoom(id,null,was);
  }));
}
/* ---------- the tower workshop ---------- */
function showTowerRoom(k){armStop();
  const open=TKEYS.filter(towerOpen);k=k&&TOWERS[k]?k:(open[0]||'watch');
  const D=TOWERS[k],L=tLvl(k),op=towerOpen(k),rc=(UGROUPS.find(g=>g[0]===k)||[])[3]||'#8a97a8';
  const tiles=TKEYS.map(t=>{const o=towerOpen(t);return `<button class="htile ${o?'':'lock'} ${t===k?'view':''}" data-t="${t}">${towerIconHTML(t,o?Math.max(1,maxTowerLvl()):1,52)}<span class="nm">${o?TSHORT[t]+' · '+tLvl(t):'After '+TOWER_UNLOCK[t]}</span>${o&&cardCan('t:'+t)?'<span class="upb">⬆</span>':''}</button>`;}).join('');
  const chips=TMILE[k].map((m,i)=>{const got=L>=T_MILE[i];return `<button class="mchip ${got?'got':''}" data-mi="${i}"><i>${m[0]}</i><b>${got?'✔':'LV '+T_MILE[i]}</b></button>`;}).join('');
  const mtxt=TMILE[k].map((m,i)=>`<p class="mtx" data-mt="${i}" hidden><b>${esc(m[1])}</b> — ${m[2]}</p>`).join('');
  const body=op?`<div class="hlv"><b>Lv ${L}</b><em>/ ${T_MAX}</em><span class="bar"><i style="width:${Math.round(100*L/T_MAX)}%"></i></span></div>${armLvlBtn('t:'+k,'data-a="tl"',L,T_MAX)}
    <div class="nownext"><div><small>NOW</small><span>${towerLine(k,L)}</span></div>${L<T_MAX?`<div class="nx"><small>LV ${L+1}</small><span>${towerLine(k,L+1)}</span></div>`:''}</div>
    <div class="mrow">${chips}</div>${mtxt}`:`<p class="m" style="text-align:center;color:var(--gold)">🔒 Opens after stage ${TOWER_UNLOCK[k]}</p>`;
  show(`<div class="topbar"><h1>🏰 Towers<small>tap a tower, level it up</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m cur">🪙 <b style="color:var(--gold)">${fmtN(goldOf())}</b> · 🃏 ${cardHave('t:'+k)} ${TSHORT[k]} cards</p>
  <div class="hgrid strip" id="armStrip">${tiles}</div>
  <div id="clist"><div class="hdet2" style="--hc:${rc};--hc2:#1d2a3c"><div class="tstage">${towerIconHTML(k,Math.max(1,maxTowerLvl()),130)}</div><div class="hname"><b>${D.n}</b><small>${D.sub}</small></div><div class="hact">${body}</div></div></div>`);
  CLOUD.screen='tower';armStrip('#armStrip');
  $('#bBack').addEventListener('click',()=>showHub('coll','towers'));
  card.querySelectorAll('.htile').forEach(t=>t.addEventListener('click',()=>showTowerRoom(t.dataset.t)));
  card.querySelectorAll('.mchip').forEach(m=>m.addEventListener('click',()=>{const i=m.dataset.mi,t=card.querySelector('[data-mt="'+i+'"]'),was=t&&!t.hidden;card.querySelectorAll('.mtx').forEach(x=>x.hidden=true);if(t&&!was){t.hidden=false;SFX.play('tap',50);}}));
  const b=card.querySelector('#clist button[data-a="tl"]');if(b)b.addEventListener('click',()=>{if(cardLevelUp('t:'+k)){SFX.play('upgrade');persist();}else SFX.play('deny');showTowerRoom(k);});
}
