/* =========================== TAVERN (v1.0.59) ===========================
   Champions get a rarity by the order they open in (1–2 Common, 3 Uncommon, 4–5 Rare, 6 Epic, 7 Legendary),
   stars ★1–6 (every star opens ten more levels, up to 60) and books for their skills. A star is raised with gold
   and the cards of another champion of the house, burnt. The tavern also summons: dragonglass for a champion of
   the house — a sealed one joins at once, an open one brings cards. A logged-in seat does all of it through the
   server (backend v8: econ_sync 'asc' / 'sk', chest_open books, champ_summon); a guest rolls it here. */
const CH_RAR=[0,0,1,2,2,3,4];                       /* rarity by opening order (tier 0…6) */
const RAR_STAT=[1,1.04,1.08,1.13,1.2];              /* base health and damage by rarity */
const ST_MAX=6,ASC_GOLD=[1500,4000,9000,18000,32000],ASC_BURN=[20,40,80,140,220];   /* ★s → ★s+1: gold, common-card worth burnt */
const BOOK_N={c:'Common book',r:'Rare book',e:'Epic book',l:'Legendary book'},BOOK_R={c:0,r:2,e:3,l:4},BOOK_OF=['c','c','r','e','l'];
const BOOK_NEED=[1,1,2,3],BOOK_PRICE={c:120,r:350,e:900,l:2500};                    /* books for skill rank r → r+1; gold per book in the deals */
const BOOK_DROP={wood:[['c',1,50]],iron:[['c',1,100],['r',1,25]],valyrian:[['c',2,100],['r',1,100],['e',1,20]],dragon:[['c',3,100],['r',2,100],['e',1,100],['l',1,25]]};
const SUMMON={one:60,ten:540,odds:[55,25,14,5,1],copies:10};
const DEAL_R=[0,1,1,2,3];                           /* a card's rarity → the deal frame colour */
function champRar(c){return CH_RAR[(c&&c.tier)||0]||0;}
function cstar(id,a){const p=cprog(a||null,id);return Math.max(1,Math.min(ST_MAX,Math.max(p.st||1,Math.ceil((p.lvl||1)/10))));}
function champCap(id,a){return Math.min(CH_MAX,10*cstar(id,a));}
function cardCap(key){return key[0]==='c'?champCap(key.slice(2)):cardMax(key);}
function starsHTML(n,cls){return `<span class="stars ${cls||''}">${'★'.repeat(n)}<i>${'★'.repeat(ST_MAX-n)}</i></span>`;}
function bookKey(c){return 'b:'+BOOK_OF[champRar(c)];}
function bookIcon(b,px){const col=RAR_C[BOOK_R[b]||0];px=px||40;
  return `<svg class="bki" viewBox="0 0 24 24" width="${px}" height="${px}"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" fill="${col}" stroke="#0b1a2e" stroke-width="1.3"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5A2.5 2.5 0 0 1 4 21.5z" fill="#f2e6c9" stroke="#0b1a2e" stroke-width="1.3"/><path d="M9 7h7M9 10h5" stroke="#0b1a2e" stroke-width="1.4" stroke-linecap="round"/></svg>`;}
function booksLine(){return ['c','r','e','l'].map(b=>`<span class="bkn" title="${BOOK_N[b]}">${bookIcon(b,16)}${cardHave('b:'+b)}</span>`).join('');}
/* ---------- a star: level at the cap, gold, another champion's cards burnt ---------- */
function ascNeed(id,fid){return Math.max(1,Math.round((ASC_BURN[cstar(id)-1]||0)*CARD_MUL[cardRar('c:'+fid)]));}
function ascGold(id){return ASC_GOLD[cstar(id)-1]||0;}
function ascReady(id){const p=cprog(null,id),s=cstar(id);return s<ST_MAX&&p.lvl>=10*s;}
function ascCan(id,fid){const c=CBY[id],f=CBY[fid];return !!(c&&f&&fid!==id&&f.house===c.house&&ascReady(id)&&cardHave('c:'+fid)>=ascNeed(id,fid)&&goldOf()>=ascGold(id));}
function ascend(id,fid){if(!ascCan(id,fid))return false;const s0=ecoSnap(),s=cstar(id),need=ascNeed(id,fid),g=ascGold(id);
  if(!spendGold(g))return false;ACC.cards['c:'+fid]-=need;cprog(null,id).st=s+1;addXp(Math.round(g/10));
  ecoOp({r:'asc',k:id,f:fid,to:s+1},ecoDiff(s0),{cards:['c:'+fid,need]});return true;}
/* ---------- a skill rank: gold + books of the champion's rarity ---------- */
function skBooks(l){return BOOK_NEED[l-1]||0;}
function skCan(id,i){const c=CBY[id],p=cprog(null,id),l=p.sk[i];return l<SK_MAX&&l<rankCap(p.lvl)&&goldOf()>=ECON.skCost(l)&&cardHave(bookKey(c))>=skBooks(l);}
function skillUp(id,i){if(!skCan(id,i))return false;const c=CBY[id],p=cprog(null,id),l=p.sk[i],c0=ECON.skCost(l),bk=bookKey(c),nb=skBooks(l);
  if(!spendGold(c0))return false;ACC.cards[bk]=(ACC.cards[bk]||0)-nb;p.sk[i]++;addXp(Math.round(c0/10));
  ecoOp({r:'sk',k:id+':'+i,to:l+1},{g:-c0,x:Math.round(c0/10)},{cards:[bk,nb]});return true;}
/* ---------- books in chests (the server rolls them for a logged-in seat) ---------- */
function chestBooks(t,R,out){
  const push=(k,n)=>out.push({k:'card',key:k,cnt:n,r:cardRar(k),n:cardName(k),s:'+'+n+' book'+(n>1?'s':'')});
  if(R){for(const x of (R.books||[]))push(x.k,x.n);return;}
  for(const [b,n,pc] of (BOOK_DROP[t]||[]))if(Math.random()*100<pc){addCards('b:'+b,n);push('b:'+b,n);}}
/* ---------- the summon ---------- */
function summonPick(r){const l=CHAMPS.filter(c=>c.house===ACC.house&&champRar(c)===r);return l[Math.floor(Math.random()*l.length)]||null;}
function summonRoll(n){const out=[];
  for(let i=0;i<n;i++){let x=Math.random()*100,r=0;for(let k=0;k<5;k++){x-=SUMMON.odds[k];if(x<0){r=k;break;}}
    if(n>=10&&i===n-1&&!out.some(o=>o.r>=2))r=2;
    const c=summonPick(r);if(!c)continue;
    if(!unlocked(null,c)){ACC.copen=ACC.copen||{};ACC.copen[c.id]=1;out.push({c:c.id,r,new:true,n:0});}
    else{const k=Math.max(1,Math.round(SUMMON.copies*CARD_MUL[r]));addCards('c:'+c.id,k);out.push({c:c.id,r,new:false,n:k});}}
  return out;}
async function summon(n){const price=n>=10?SUMMON.ten:SUMMON.one;if(ACC.gems<price){SFX.play('deny');return;}
  if(!ecoWants()){ACC.gems-=price;const res=summonRoll(n);persist();summonShow(res);return;}
  ecoWait(true);
  try{if(!ecoOn()&&!(await ecoStart()))throw new Error(ECO.err||'offline');
    const r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc('champ_summon',{seat:seatNo(),n},10000);ecoApply(x.state);return x;});
    ecoWait(false);persist();summonShow(r.rolls||[]);}
  catch(e){ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m))ecoRefresh();
    ecoModal('🌀 The portal stays dark',ecoNet(m)?'No connection to the server. A summon on this seat goes only through it.':esc(m),[{t:'OK',f:()=>showHeroRoom()}]);}}
function summonShow(res){SFX.play(res.some(o=>o.r>=4)?'legend':res.some(o=>o.r>=3)?'epic':'chestopen');
  const cards=res.map(o=>{const c=CBY[o.c];return `<div class="smc" style="--rc:${RAR_C[o.r]}">${portraitHTML(c,48)}<b>${esc(shortName(c))}</b><small>${o.new?'<em>NEW · joins you</em>':'+'+o.n+' card'+(o.n>1?'s':'')}</small><i>${RAR_N[o.r]}</i></div>`;}).join('');
  ecoModal('🌀 The portal answers',`<div class="smgrid">${cards}</div>`,[{t:'OK',f:()=>showHeroRoom(res.length===1?res[0].c:undefined)}]);}
function summonOdds(){ecoModal('🌀 Summon odds',`Each summon calls one champion of House ${esc(HOUSES[ACC.house].n)}:<br>${RAR_N.map((n,i)=>`<b style="color:${RAR_C[i]}">${n}</b> ${SUMMON.odds[i]}%`).join(' · ')}.<br>A sealed champion joins you at once. An open one brings ${SUMMON.copies} Common cards' worth of his own (a Legendary 1, an Epic 3).<br>Ten at once always hold a Rare or better.${ecoWants()?'<br><small>Rolled on the server.</small>':''}`,[{t:'OK'}]);}
/* ---------- the tavern (it replaces the hero room) ---------- */
function showHeroRoom(viewId,fod){
  const hh=HOUSES[ACC.house],list=CHAMPS.filter(c=>c.house===ACC.house);
  const view=list.find(c=>c.id===viewId)||list.find(c=>c.id===ACC.sel)||list[0];
  const tiles=list.map(c=>{const un=unlocked(null,c),ride=ACC.sel===c.id,v=view.id===c.id,r=champRar(c);
    return `<button class="htile tvt ${un?'':'lock'} ${v?'view':''} ${ride?'ride':''}" style="--rc:${RAR_C[r]}" data-c="${c.id}">${un?portraitHTML(c,58):'<span class="pe">🔒</span>'}<span class="nm">${un?shortName(c)+' · '+cprog(null,c.id).lvl:'After '+UNLOCK_STAGE[c.tier]}</span>${un?starsHTML(cstar(c.id),'sm'):''}${ride?'<i class="rb">RIDING</i>':''}${un&&(cardCan('c:'+c.id)||(ascReady(c.id)&&list.some(f=>ascCan(c.id,f.id))))?'<span class="upb">⬆</span>':''}</button>`;}).join('');
  const c=view,p=cprog(null,c.id),un=unlocked(null,c),ride=ACC.sel===c.id,cap=rankCap(p.lvl),r=champRar(c),st=cstar(c.id),lc=champCap(c.id),key='c:'+c.id,bk=bookKey(c);
  let lvl='';
  if(un){
    if(ascReady(c.id)){
      const fods=list.filter(f=>f.id!==c.id&&cardHave('c:'+f.id)>0);const fsel=fods.find(f=>f.id===fod&&ascCan(c.id,f.id))||fods.find(f=>ascCan(c.id,f.id));
      lvl=`<div class="ascbox"><b>★${st} → ★${st+1}</b> opens levels ${10*st+1}–${Math.min(CH_MAX,10*st+10)}<small>🪙 ${fmtN(ascGold(c.id))} gold + the cards of another champion, burnt:</small>
        <div class="fods">${fods.length?fods.map(f=>{const n=ascNeed(c.id,f.id),h=cardHave('c:'+f.id);return `<button class="fod ${fsel&&fsel.id===f.id?'on':''} ${h>=n?'':'short'}" data-a="fod" data-f="${f.id}" style="--rc:${RAR_C[champRar(f)]}">${portraitHTML(f,30)}<small>${h}/${n}</small></button>`;}).join(''):'<small class="none">No cards of another champion yet — chests, deals and the portal bring them.</small>'}</div>
        <button class="ascgo" data-a="asc" data-f="${fsel?fsel.id:''}" ${fsel?'':'disabled'}>${fsel?`⭐ Raise to ★${st+1} · burn ${ascNeed(c.id,fsel.id)} ${esc(shortName(fsel))}`:`⭐ Raise to ★${st+1}`}</button></div>`;}
    else{const h=cardHave(key),n=cardNeed(key),g=cardGold(key),can=cardCan(key),mx=p.lvl>=CH_MAX;
      lvl=`<div class="lvline">Lv ${p.lvl}<em>/${lc}</em><span class="bar"><i style="width:${Math.round(100*p.lvl/lc)}%"></i></span><button data-a="lvl" ${can?'':'disabled'}>${mx?'max':`${h}/${n} 🃏 · 🪙${g}`}</button></div>
      <div class="cardline">${mx?'Fully forged.':h>=n?(goldOf()>=g?`<em class="ok">Ready:</em> ${n} cards + ${g} gold → level ${p.lvl+1}`:`Cards ready — ${g} gold needed`):`Next level: <em>${n}</em> cards (you have <em>${h}</em>) + <em>${g}</em> gold.`}${!mx&&p.lvl+1>=lc&&st<ST_MAX?` At ${lc} the next star waits.`:''}</div>`;}}
  const det=`<div class="hdet" style="--hc:${hh.col};--hc2:${hh.col2}">
    <div class="hdtop"><div class="hport tvp" style="--rc:${RAR_C[r]}">${un?portraitHTML(c,84,'big'):'🔒'}<span class="cr">${crest(ACC.house,26)}</span></div>
      <div class="hdinfo"><b>${un?c.n:'Sealed champion'}</b><small><em class="rarl" style="color:${RAR_C[r]}">${RAR_N[r]}</em> · ${TYPE_LBL[c.type]} · House ${hh.n}</small>
        ${un?starsHTML(st)+lvl+`<small>❤️ +5% health and ⚔️ +4% damage per level${RAR_STAT[r]>1?` · ${RAR_N[r]}: +${Math.round((RAR_STAT[r]-1)*100)}% base`:''}</small>`:`<small style="color:var(--gold)">🔒 Unlocks after ${UNLOCK_STAGE[c.tier]} stages held — or from the portal</small>`}</div></div>
    <div class="cskills">${c.sk.map((sk,i)=>{const S=SK[sk],l=p.sk[i],capd=l>=cap&&l<SK_MAX,nb=skBooks(l);
      return `<div class="sk2 ${l>=SK_MAX?'gold':''}">${skillIcon(sk,40,0)}<span style="flex:1"><b>${S.n}</b>${S.ult?' · ULTIMATE':''}<br>${S.d(S.v[l-1])}${l<SK_MAX?`<br><small style="color:var(--muted)">rank ${l+1}: ${S.d(S.v[l])}</small>`:''}</span><span style="text-align:right"><span class="pips">${'●'.repeat(l)}${'○'.repeat(SK_MAX-l)}</span><br><button data-a="sk" data-i="${i}" ${!un||!skCan(c.id,i)?'disabled':''}>${l>=SK_MAX?'max':capd?'🔒 Lv '+SK_CAP[l]:`🪙${ECON.skCost(l)} · ${bookIcon(bk.slice(2),14)}${cardHave(bk)}/${nb}`}</button></span></div>`;}).join('')}</div>
    ${un?`<div class="ctal ${p.lvl>=TAL_AT?'':'locked'}"><b class="tlbl">⭐ Bonus talent — ${p.lvl>=TAL_AT?'pick one, swap any time':'unlocks at level '+TAL_AT+' · pick one of two'}</b>${TALENTS[c.id].map((t,i)=>`<button class="tal2 ${p.tal===i+1?'on':''}" ${p.lvl>=TAL_AT?`data-a="tal" data-i="${i+1}"`:'disabled'}><span class="e">${talEmoji(t)}</span><span style="flex:1"><b>${t.n}</b><br>${talDesc(t)}</span>${p.tal===i+1?'<span class="tk">✔</span>':p.lvl>=TAL_AT?'':'<span class="tk">🔒</span>'}</button>`).join('')}</div>`:''}
    <div class="cfoot tvfoot"><button data-a="gear" ${un?'':'disabled'}>⚒️ Gear</button><button data-a="sel" ${!un||ride?'disabled':''}>${ride?'✔ Riding with you':'✔ Ride with '+shortName(c)}</button></div></div>`;
  show(`<div class="topbar"><h1>🍺 Tavern<small>Levels, stars and skills of your champions — and the portal. One of them rides with you per battle.</small></h1><button class="back" id="bBack">✖</button></div>
  <p class="m">🪙 <b style="color:var(--gold)">${fmtN(goldOf())}</b> · 💎 ${ACC.gems} · <span class="bkl">${booksLine()}</span></p>
  <div class="tvsum"><span class="pt">🌀</span><span class="tx"><b>The portal</b><small>A champion of House ${hh.n}: a sealed one joins you, an open one brings cards. <a data-a="odds">Odds</a></small></span>
    <button data-a="s1" ${ACC.gems>=SUMMON.one?'':'disabled'}>×1<small>💎${SUMMON.one}</small></button><button data-a="s10" ${ACC.gems>=SUMMON.ten?'':'disabled'}>×10<small>💎${SUMMON.ten}</small></button></div>
  <div class="hgrid">${tiles}</div><div id="clist">${det}</div>`);
  $('#bBack').addEventListener('click',()=>showHub('coll','heroes'));
  card.querySelectorAll('.htile').forEach(t=>t.addEventListener('click',()=>showHeroRoom(t.dataset.c)));
  card.querySelectorAll('.tvsum [data-a]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.a;if(a==='odds')summonOdds();else summon(a==='s10'?10:1);}));
  card.querySelectorAll('#clist button').forEach(b=>b.addEventListener('click',()=>{
    const id=c.id,a=b.dataset.a;
    if(a==='fod'){showHeroRoom(id,b.dataset.f);return;}
    if(a==='gear'){showForge(id);return;}
    if(a==='lvl'){if(cardLevelUp(key))SFX.play('levelup');else SFX.play('deny');}
    else if(a==='asc'){if(ascend(id,b.dataset.f))SFX.play('levelup');else SFX.play('deny');}
    else if(a==='sk'){if(skillUp(id,+b.dataset.i))SFX.play('upgrade');else SFX.play('deny');}
    else if(a==='tal'){p.tal=+b.dataset.i;}
    else ACC.sel=id;
    persist();showHeroRoom(id);
  }));
}
