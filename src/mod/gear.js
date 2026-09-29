/* =========================== GEAR + FORGE (v1.0.57, gear II in v1.0.62) ===========================
   Items live on the server (backend v6, v11): it decides every drop (a won battle, a Hold run of 10+ waves, a chest, a login or quest gift),
   the rarity, tier, slot, set, main stat and substats, and every forge try. 9 slots per champion; the equipped items add to the champion's
   health, damage, attack speed, walking speed, range, cooldowns, gold from kills, armor, lifesteal, regeneration and crit chance.
   Tiers ★1–5 set the level cap (+4 a tier) and multiply the main stat; a tier is raised with gold and another item of the same rarity.
   Twelve sets (quads 2+4, pairs 2, triples 3 — pairs and triples repeat for every full group), plus two collection bonuses:
   one item of every rarity (Rainbow) and all nine slots filled (Full kit). Guests have no gear. */
const GEAR_SLOT={weapon:['⚔️','Weapon'],offhand:['🛡️','Shield'],helmet:['⛑️','Helmet'],armor:['🧥','Armor'],gloves:['🧤','Gloves'],boots:['🥾','Boots'],ring:['💍','Ring'],amulet:['📿','Amulet'],banner:['🚩','Banner']};
const GEAR_SLOTS=Object.keys(GEAR_SLOT);
/* a look and a name for every item (cosmetic, from its id): the same slot comes in several shapes */
const GEAR_KIND={weapon:[['Sword','⚔️'],['Axe','🪓'],['Spear','🔱'],['Bow','🏹'],['Staff','🪄']],offhand:[['Shield','🛡️'],['Buckler','🛡️'],['Kite shield','🛡️']],helmet:[['Helm','⛑️'],['Hood','🧢'],['Crown','👑']],
  armor:[['Mail','🧥'],['Plate','🥋'],['Jerkin','🧥']],gloves:[['Gauntlets','🧤'],['Gloves','🧤']],boots:[['Boots','🥾'],['Greaves','🥾']],ring:[['Ring','💍'],['Signet','💍']],amulet:[['Amulet','📿'],['Pendant','📿']],banner:[['Banner','🚩'],['Standard','🚩']]};
const GEAR_RAR=[['Common','#9aa4b1'],['Uncommon','#5fcf6a'],['Rare','#4fb0ff'],['Epic','#b47cff'],['Legendary','#e3b661']];
const GEAR_STAT={dmg:'Damage',hp:'Health',rate:'Attack speed',spd:'Speed',cdr:'Cooldowns',gold:'Gold from kills',range:'Range',armor:'Armor',lifesteal:'Lifesteal',regen:'Regeneration',crit:'Crit chance'};
const GEAR_SET={wolf:['🐺','Direwolf'],lion:['🦁','Lion'],dragon:['🐉','Dragon'],kraken:['🐙','Kraken'],stag:['🦌','Stag'],rose:['🌹','Rose'],sun:['☀️','Sun'],anvil:['🔨','Anvil'],wall:['🧱','Wall'],blood:['🩸','Blood'],raven:['🐦‍⬛','Raven'],hunt:['🏹','Hunt']};
/* drop-in art: GEAR_ART['weapon'] / ['weapon:Axe'] → an image for the slot or shape; SET_ART['wolf'] → the set's emblem; TIER_ART, FRAME_ART[rarity] (see docs/prompts-gear.md) */
const GEAR_ART={},SET_ART={},FRAME_ART={};
/* art sheets (docs/prompts-gear.md): 3×3 (or 4×3) grids on magenta, cut into cells; the magenta becomes transparent. setGearSheet('armor'|'weapons'|'small', url), setGearSheet('sets', url) */
const GEAR_SHEETS={armor:{cols:3,rows:3,keys:['offhand:Shield','offhand:Buckler','offhand:Kite shield','helmet:Helm','helmet:Hood','helmet:Crown','armor:Mail','armor:Plate','armor:Jerkin']},
  weapons:{cols:3,rows:3,keys:['weapon:Sword','weapon:Axe','weapon:Spear','weapon:Bow','weapon:Staff','gloves:Gauntlets','gloves:Gloves','boots:Boots','boots:Greaves']},
  small:{cols:3,rows:3,keys:['ring:Ring','ring:Signet','amulet:Amulet','amulet:Pendant','banner:Banner','banner:Standard',null,null,null]},
  sets:{cols:4,rows:3,keys:['wolf','lion','dragon','kraken','stag','rose','sun','anvil','wall','blood','raven','hunt'],into:'SET'}};
function setGearSheet(name,url){const S=GEAR_SHEETS[name];if(!S)return;const im=new Image();
  im.onload=()=>{const cw=Math.floor(im.width/S.cols),ch=Math.floor(im.height/S.rows),into=S.into==='SET'?SET_ART:GEAR_ART;
    S.keys.forEach((k,i)=>{if(!k)return;const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');x.drawImage(im,(i%S.cols)*cw,Math.floor(i/S.cols)*ch,cw,ch,0,0,cw,ch);
      try{const d=x.getImageData(0,0,cw,ch),p=d.data;for(let j=0;j<p.length;j+=4)if(p[j]>190&&p[j+1]<90&&p[j+2]>190)p[j+3]=0;x.putImageData(d,0,0);}catch(e){}
      into[k]=c.toDataURL('image/png');});};
  im.src=url;}
const GEAR_ZERO=()=>({dmg:0,hp:0,rate:0,spd:0,cdr:0,gold:0,range:0,armor:0,lifesteal:0,regen:0,crit:0});
function gearOn(){return !!(ecoOn()||(ECO.gear&&ECO.gear.test));}
function gearItems(){return (ECO.gear&&gearOn()&&ECO.gear.items)||[];}
function gearCfg(){return (ECO.gear&&ECO.gear.cfg)||null;}
function gearKind(it){const L=GEAR_KIND[it.slot]||[['Item','❔']],n=parseInt(String(it.id).slice(0,2),16)||0;return L[n%L.length];}
function gearTier(it){return Math.max(1,Math.min(5,it.tier||1));}
function gearCap(it){return it.cap||gearTier(it)*4;}
/* what a set gives for n pieces: [{th, bonus, times, on}] — quads have 2 and 4; pairs and triples repeat for every full group */
function setSteps(k,n){const b=(gearCfg()&&gearCfg().sets&&gearCfg().sets[k])||{},ths=Object.keys(b).filter(x=>/^\d+$/.test(x)).map(Number).sort((a,c)=>a-c),out=[];
  for(const th of ths){const times=b.stack?Math.floor(n/th):(n>=th?1:0);out.push({th,bonus:b[th],times,on:times>0});}return out;}
/* the sum of everything a champion wears, in % (main + substats + set bonuses + the collection bonuses) */
function gearStats(cid){const s=GEAR_ZERO(),C=gearCfg();if(!C)return s;const sets={},rars=new Set();let worn=0;
  for(const it of gearItems()){if(it.champ!==cid)continue;worn++;rars.add(it.r);s[it.main.k]=(s[it.main.k]||0)+(+it.main.v||0);for(const x of it.subs||[])s[x.k]=(s[x.k]||0)+(+x.v||0);sets[it.set]=(sets[it.set]||0)+1;}
  for(const k in sets)for(const st of setSteps(k,sets[k]))if(st.on)for(const x in st.bonus)s[x]=(s[x]||0)+st.bonus[x]*st.times;
  const A=C.bonus_all||{};if(rars.size>=5&&A.rainbow)for(const x in A.rainbow)s[x]=(s[x]||0)+A.rainbow[x];
  if(worn>=GEAR_SLOTS.length&&A.full)for(const x in A.full)s[x]=(s[x]||0)+A.full[x];
  for(const k in s)s[k]=Math.round(s[k]*10)/10;return s;}
/* the numbers the battle uses: some stats stop growing at a cap */
function gearEff(cid){const s=gearStats(cid),c=(gearCfg()&&gearCfg().caps)||{};const e=Object.assign({},s);for(const k in c)e[k]=Math.min(c[k],s[k]||0);return e;}
/* the set overview for a champion: [{k, n, steps}] for sets worn, and the collection bonuses' progress */
function gearSetInfo(cid){const sets={},rars=new Set();let worn=0;for(const it of gearItems()){if(it.champ!==cid)continue;worn++;rars.add(it.r);sets[it.set]=(sets[it.set]||0)+1;}
  return{sets:Object.keys(sets).sort((a,b)=>sets[b]-sets[a]).map(k=>({k,n:sets[k],steps:setSteps(k,sets[k])})),rainbow:rars.size,full:worn,worn};}
function gearCost(it){const C=gearCfg();return C?Math.round((C.cost_base+C.cost_step*it.lvl)*C.rar_cost[it.r]/10)*10:0;}
function gearTierCost(it){const C=gearCfg();return C&&gearTier(it)<5?Math.round(C.tier_cost[gearTier(it)-1]*C.rar_cost[it.r]/10)*10:0;}
function gearChance(it){const C=gearCfg();return C&&it.lvl<gearCap(it)?C.chance[it.lvl]:0;}
function gearSellPrice(it){const C=gearCfg();return C?Math.round(C.sell*C.rar_cost[it.r]*(1+it.lvl)*(1+0.5*(gearTier(it)-1))):0;}
function gearName(it){const k=gearKind(it);return GEAR_RAR[it.r][0]+' '+GEAR_SET[it.set][1]+' '+k[0]+(it.lvl?' +'+it.lvl:'');}
function gearLine(k,v){if(k==='regen')return `Regeneration +${v}% health / 10 s`;if(k==='armor')return `Armor +${v}% (damage taken −${v}%)`;if(k==='lifesteal')return `Lifesteal +${v}% (of the damage dealt heals you)`;if(k==='crit')return `Crit chance +${v}% (a blow may deal triple damage)`;return `${GEAR_STAT[k]||k} +${v}%`;}
function gearLineShort(k,v){return k==='regen'?`${GEAR_STAT[k]} +${v}%/10s`:`${GEAR_STAT[k]||k} +${v}%`;}
function gearBonusText(b,times){return Object.keys(b).map(k=>gearLineShort(k,b[k]*(times||1))).join(', ');}
/* the server's bag: after entering a seat, a battle, a chest; new items are announced */
async function gearLoadRaw(announce){if(!CLOUD.on||!CLOUD.token)return;const seat=seatNo();
  try{const r=await ecoRpc('gear_list',{seat},9000);if(seat!==seatNo())return;const old=new Set(((ECO.gear&&ECO.gear.items)||[]).map(x=>x.id)),had=!!ECO.gear;ECO.gear=r;
    if(announce&&had){const nw=(r.items||[]).filter(x=>!old.has(x.id));if(nw.length)ecoToast('⚒️ New gear: '+nw.map(gearName).join(' · '),true);}}catch(e){}}
function gearLoad(announce){return ecoLane(()=>gearLoadRaw(announce));}
function tierPips(it){return '★'.repeat(gearTier(it))+'<i>'+'★'.repeat(5-gearTier(it))+'</i>';}
function gearIcon(it,px){const R=GEAR_RAR[it.r],k=gearKind(it),art=GEAR_ART[it.slot+':'+k[0]]||GEAR_ART[it.slot],sa=SET_ART[it.set];
  return `<span class="gic" style="--gc:${R[1]};${px?'font-size:'+px+'px':''}">${art?`<img src="${art}" alt="">`:k[1]}<b class="gset">${sa?`<img src="${sa}" alt="">`:GEAR_SET[it.set][0]}</b><u class="gtier">${tierPips(it)}</u>${it.lvl?`<em>+${it.lvl}</em>`:''}</span>`;}
/* ---------- the forge screen: the champion's 9 slots, its set bonuses, the bag ---------- */
function gearBonusBlock(cid){const I=gearSetInfo(cid),C=gearCfg()||{},A=C.bonus_all||{},rows=[];
  for(const s of I.sets){const S=GEAR_SET[s.k];rows.push(`<div class="gbn ${s.steps.some(x=>x.on)?'on':''}"><b>${S[0]} ${S[1]} · ${s.n}</b>${s.steps.map(x=>`<span class="${x.on?'on':''}">${x.th}: ${gearBonusText(x.bonus,x.on?x.times:1)}${x.times>1?' ×'+x.times:''}</span>`).join('')}</div>`);}
  if(A.rainbow)rows.push(`<div class="gbn ${I.rainbow>=5?'on':''}"><b>🌈 Rainbow · ${I.rainbow}/5 rarities</b><span class="${I.rainbow>=5?'on':''}">${gearBonusText(A.rainbow)}</span></div>`);
  if(A.full)rows.push(`<div class="gbn ${I.full>=9?'on':''}"><b>🎽 Full kit · ${I.full}/9 slots</b><span class="${I.full>=9?'on':''}">${gearBonusText(A.full)}</span></div>`);
  return rows.join('');}
function showForge(cid,filter){
  const mine=CHAMPS.filter(c=>c.house===ACC.house&&unlocked(null,c));cid=(cid&&CBY[cid])?cid:ACC.sel;const c=CBY[cid];
  if(!gearOn()){show(`<div class="topbar"><h1>⚒️ Forge<small>Gear is made and forged on the server.</small></h1><button class="back" id="bBack">✖</button></div>
    <p>The forge opens for a seat played through Telegram, where the server keeps your items safe.</p><button class="btn" id="bOk">✔ Back</button>`);
    const back=()=>showHub('battle');$('#bBack').addEventListener('click',back);$('#bOk').addEventListener('click',back);return;}
  const all=gearItems(),worn={};for(const it of all)if(it.champ===cid)worn[it.slot]=it;
  const st=gearStats(cid),caps=(gearCfg()&&gearCfg().caps)||{},stl=Object.keys(st).filter(k=>st[k]).map(k=>`<span class="gs">${gearLineShort(k,st[k])}${caps[k]&&st[k]>caps[k]?' <em>(max '+caps[k]+')</em>':''}</span>`).join('')||'Nothing worn yet — every slot adds power.';
  const bag=all.filter(it=>it.champ!==cid&&(!filter||it.slot===filter)).sort((a,b)=>b.r-a.r||gearTier(b)-gearTier(a)||b.lvl-a.lvl||(a.slot<b.slot?-1:1));
  const champs=mine.map(x=>`<button class="gch ${x.id===cid?'on':''}" data-c="${x.id}">${CHAMP_ART[x.id+'_portrait']?`<img src="${CHAMP_ART[x.id+'_portrait']}" alt="">`:`<span>${x.e}</span>`}</button>`).join('');
  const slots=GEAR_SLOTS.map(k=>{const it=worn[k];return `<button class="gslot ${it?'':'empty'} ${filter===k?'on':''}" data-s="${k}" ${it?`data-i="${it.id}" style="--gc:${GEAR_RAR[it.r][1]}"`:''}>${it?gearIcon(it):`<span class="gic e">${GEAR_SLOT[k][0]}</span>`}<small>${GEAR_SLOT[k][1]}</small></button>`;}).join('');
  show(`<div class="topbar"><h1>⚒️ Forge<small>Gear drops from battles, the Hold, chests and daily gifts. Strike at the anvil — a failed strike costs the gold, never the item. A tier ★ opens four more levels.</small></h1><button class="back" id="bBack">✖</button></div>
  <div class="gchs">${champs}</div>
  <div class="gwho"><b>${esc(c.n)}</b><div class="gsl">${stl}</div></div>
  <div class="gslots">${slots}</div>
  <div class="gbns">${gearBonusBlock(cid)}</div>
  <div class="hh"><h2>Bag · ${all.length}/${(gearCfg()||{}).cap||300}</h2><small>${filter?`${GEAR_SLOT[filter][1]} only · <a href="#" id="gAll">all</a>`:'tap a slot to filter'} · <a href="#" id="gSets">📚 sets</a></small></div>
  <div class="gbag">${bag.map(it=>`<button class="gitem" data-i="${it.id}" style="--gc:${GEAR_RAR[it.r][1]}">${gearIcon(it)}<small>${GEAR_RAR[it.r][0]}${it.champ?' · on '+esc(shortName(CBY[it.champ]||{n:it.champ})):''}</small></button>`).join('')||'<p class="m" style="font-size:12px">Empty. Win battles, hold the door, open chests, claim the daily gifts.</p>'}</div>
  <p class="m" style="font-size:11.5px">🪙 ${fmtN(goldOf())} gold</p>`);
  CLOUD.screen='forge';
  $('#bBack').addEventListener('click',()=>showHub('battle'));
  bind('.gch',b=>{SFX.play('tap',50);showForge(b.dataset.c,filter);});
  bind('.gslot',b=>{SFX.play('tap',50);if(b.dataset.i)gearSheet(b.dataset.i,cid,filter);else showForge(cid,filter===b.dataset.s?null:b.dataset.s);});
  bind('.gitem',b=>{SFX.play('tap',50);gearSheet(b.dataset.i,cid,filter);});
  const ga=$('#gAll');if(ga)ga.addEventListener('click',e=>{e.preventDefault();showForge(cid,null);});
  const gs=$('#gSets');if(gs)gs.addEventListener('click',e=>{e.preventDefault();SFX.play('tap',50);gearSetBook(cid,filter);});}
/* every set at a glance: what it needs and what it gives (and how many the champion wears) */
function gearSetBook(cid,filter){const C=gearCfg();if(!C)return;const I=gearSetInfo(cid),have={};for(const s of I.sets)have[s.k]=s.n;
  const kinds=[['Quads — 2 or 4 pieces',k=>C.sets[k]['4']],['Pairs — 2 pieces, repeats for every pair',k=>C.sets[k].stack&&C.sets[k]['2']&&!C.sets[k]['4']],['Triples — 3 pieces, repeats for every three',k=>C.sets[k]['3']]];
  const html=kinds.map(([t,f])=>`<div class="sbk"><h4>${t}</h4>${Object.keys(C.sets).filter(f).map(k=>{const S=GEAR_SET[k]||['❔',k],n=have[k]||0;return `<div class="sbr ${n?'on':''}"><b>${S[0]} ${S[1]}${n?' · '+n+' worn':''}</b>${setSteps(k,n).map(x=>`<span class="${x.on?'on':''}">${x.th}: ${gearBonusText(x.bonus)}</span>`).join('')}</div>`;}).join('')}</div>`).join('')
    +`<div class="sbk"><h4>Collections</h4><div class="sbr"><b>🌈 Rainbow</b><span>one item of each of the 5 rarities: ${gearBonusText((C.bonus_all||{}).rainbow||{})}</span></div><div class="sbr"><b>🎽 Full kit</b><span>all 9 slots filled: ${gearBonusText((C.bonus_all||{}).full||{})}</span></div></div>`;
  ecoModal('📚 Sets',`<div class="sbook">${html}</div>`,[{t:'Close',f:()=>showForge(cid,filter)}]);}
function gearSheet(id,cid,filter){const it=gearItems().find(x=>x.id===id);if(!it)return;const R=GEAR_RAR[it.r],S=GEAR_SET[it.set],C=gearCfg(),sb=(C&&C.sets[it.set])||{};
  const worn=it.champ===cid,cost=gearCost(it),ch=gearChance(it),cap=gearCap(it),atCap=it.lvl>=cap,t=gearTier(it),tcost=gearTierCost(it);
  const steps=Object.keys(sb).filter(x=>/^\d+$/.test(x)).sort().map(x=>`${x}: ${gearBonusText(sb[x])}`).join(' · ')+(sb.stack?' · repeats':'');
  const html=`<div class="gsheet" style="--gc:${R[1]}">${gearIcon(it,34)}<b>${gearName(it)}</b><small class="gtr">Tier ${'★'.repeat(t)}${'☆'.repeat(5-t)} · level ${it.lvl}/${cap}</small>
    <div class="gst"><em>${gearLine(it.main.k,it.main.v)}</em>${(it.subs||[]).map(x=>`<span>${gearLine(x.k,x.v)}</span>`).join('')}</div>
    <small>${S[0]} ${S[1]} set · ${steps}</small>
    ${!atCap?`<small>Next strike: +${it.lvl+1} · ${ch}% · 🪙${cost}${(it.lvl+1)%4===0?' · a substat grows':''}</small>`:t<5?`<small>At its cap. Raise the tier: 🪙${tcost} and another ${R[0]} item of tier ${t}+ to burn — the item goes on to +${cap+4}.</small>`:'<small>Fully forged: tier 5, +20.</small>'}</div>`;
  ecoModal(`${S[0]} ${gearKind(it)[0]}`,html,[
    !atCap?{t:`⚒️ Strike +${it.lvl+1} · ${ch}% · 🪙${cost}`,dis:goldOf()<cost,f:()=>gearUpgrade(it.id,cid,filter)}:null,
    atCap&&t<5?{t:`⬆ Tier ${t+1} · 🪙${tcost}`,dis:goldOf()<tcost,f:()=>gearTierPick(it.id,cid,filter)}:null,
    {t:worn?'Take off':`Put on ${esc(shortName(CBY[cid]))}`,f:()=>gearEquip(it.id,worn?null:cid,cid,filter)},
    {t:`Sell · 🪙${gearSellPrice(it)}`,f:()=>ecoModal('Sell it?',`${gearName(it)} for 🪙${gearSellPrice(it)}. This cannot be undone.`,[{t:'Sell',f:()=>gearSell(it.id,cid,filter)},{t:'Keep',f:()=>gearSheet(id,cid,filter)}])},
    {t:'Close'}].filter(Boolean));}
/* which item to burn for the tier: same rarity, the same tier or higher, not the item itself */
function gearTierPick(id,cid,filter){const it=gearItems().find(x=>x.id===id);if(!it)return;const t=gearTier(it);
  const list=gearItems().filter(x=>x.id!==id&&x.r===it.r&&gearTier(x)>=t).sort((a,b)=>gearTier(a)-gearTier(b)||(a.champ?1:0)-(b.champ?1:0)||a.lvl-b.lvl);
  if(!list.length){ecoModal('⬆ Nothing to burn',`A tier needs another <b style="color:${GEAR_RAR[it.r][1]}">${GEAR_RAR[it.r][0]}</b> item of tier ${t} or higher to burn. Win battles and open chests to find one.`,[{t:'Back',f:()=>gearSheet(id,cid,filter)}]);return;}
  const html=`<p class="m">Burn one item to raise ${gearName(it)} to tier ${t+1}. It is gone for good.</p><div class="gpick">${list.slice(0,30).map(x=>`<button class="gpk" data-f="${x.id}" style="--gc:${GEAR_RAR[x.r][1]}">${gearIcon(x)}<small>${gearTier(x)}★ · +${x.lvl}${x.champ?' · worn':''}</small></button>`).join('')}</div>`;
  ecoModal('🔥 Burn which item?',html,[{t:'Cancel',f:()=>gearSheet(id,cid,filter)}]);
  document.querySelectorAll('#ecoModal .gpk').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();const fo=b.dataset.f,x=gearItems().find(y=>y.id===fo);
    document.getElementById('ecoModal').className='';document.getElementById('ecoModal').innerHTML='';
    ecoModal('Burn it?',`${gearName(x)} is burnt for good, and ${gearName(it)} rises to tier ${t+1} for 🪙${gearTierCost(it)}.`,[{t:'🔥 Burn',f:()=>gearTierUp(id,fo,cid,filter)},{t:'Keep',f:()=>gearSheet(id,cid,filter)}]);}));}
async function gearCall(fn,args,after){ecoWait(true);
  try{const r=await ecoLane(async()=>{const x=await ecoRpc(fn,Object.assign({seat:seatNo()},args),10000);if(x&&x.state)ecoApply(x.state);if(x&&x.items)ECO.gear=Object.assign({},ECO.gear,{items:x.items,cfg:x.cfg||gearCfg()});return x;});ecoWait(false);after&&after(r);}
  catch(e){ecoWait(false);const m=ecoMsg(e);ecoToast('⚠️ '+(ecoNet(m)?'No connection to the server':m));SFX.play('deny');}}
function gearUpgrade(id,cid,filter){gearCall('gear_upgrade',{item:id,op:ecoUuid()},r=>{
  if(r.item){const L=ECO.gear.items;const i=L.findIndex(x=>x.id===r.item.id);if(i>=0)L[i]=r.item;}
  if(r.ok){SFX.play('upgrade');ecoToast(`⚒️ Success: ${gearName(r.item)}`,true);}else{SFX.play('deny');ecoToast(`The strike failed — 🪙${r.cost} gone, the item is safe`);}
  persist();showForge(cid,filter);gearSheet(id,cid,filter);});}
function gearTierUp(id,fodder,cid,filter){gearCall('gear_tier_up',{item:id,fodder,op:ecoUuid()},r=>{SFX.play('levelup');ecoToast(`⬆ ${gearName(r.item)} is now tier ${gearTier(r.item)}`,true);persist();showForge(cid,filter);gearSheet(id,cid,filter);});}
function gearEquip(id,to,cid,filter){gearCall('gear_equip',{item:id,champ:to},()=>{SFX.play('upgrade');showForge(cid,filter);});}
function gearSell(id,cid,filter){gearCall('gear_sell',{item:id},r=>{SFX.play('buy');ecoToast(`+🪙${r.gold}`,true);persist();showForge(cid,filter);});}
