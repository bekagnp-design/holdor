/* =========================== GEAR + FORGE (v1.0.57) ===========================
   Items live on the server (backend v6): it decides every drop (a won battle, a Hold run of 10+ waves, a chest), the
   rarity, slot, set, main stat and substats, and every forge try. 9 slots per champion; the equipped items add to the
   champion's health, damage, attack speed, walking speed, range, cooldowns and gold from its kills. Guests have no gear. */
const GEAR_SLOT={weapon:['⚔️','Weapon'],offhand:['🛡️','Shield'],helmet:['⛑️','Helmet'],armor:['🧥','Armor'],gloves:['🧤','Gloves'],boots:['🥾','Boots'],ring:['💍','Ring'],amulet:['📿','Amulet'],banner:['🚩','Banner']};
const GEAR_SLOTS=Object.keys(GEAR_SLOT);
const GEAR_RAR=[['Common','#9aa4b1'],['Uncommon','#5fcf6a'],['Rare','#4fb0ff'],['Epic','#b47cff'],['Legendary','#e3b661']];
const GEAR_STAT={dmg:'Damage',hp:'Health',rate:'Attack speed',spd:'Speed',cdr:'Cooldowns',gold:'Gold from kills',range:'Range'};
const GEAR_SET={wolf:['🐺','Direwolf'],lion:['🦁','Lion'],dragon:['🐉','Dragon'],kraken:['🐙','Kraken']};
function gearItems(){return (ECO.gear&&ecoOn()&&ECO.gear.items)||[];}
function gearCfg(){return (ECO.gear&&ECO.gear.cfg)||null;}
/* the sum of everything a champion wears, in % (main + substats + set bonuses at 2 and 4 pieces) */
function gearStats(cid){const s={dmg:0,hp:0,rate:0,spd:0,cdr:0,gold:0,range:0},C=gearCfg();if(!C)return s;const sets={};
  for(const it of gearItems()){if(it.champ!==cid)continue;s[it.main.k]=(s[it.main.k]||0)+(+it.main.v||0);for(const x of it.subs||[])s[x.k]=(s[x.k]||0)+(+x.v||0);sets[it.set]=(sets[it.set]||0)+1;}
  for(const k in sets){const b=C.sets&&C.sets[k];if(!b)continue;for(const n of ['2','4'])if(sets[k]>=+n&&b[n])for(const x in b[n])s[x]=(s[x]||0)+b[n][x];}
  for(const k in s)s[k]=Math.round(s[k]*10)/10;return s;}
function gearCost(it){const C=gearCfg();return C?Math.round((C.cost_base+C.cost_step*it.lvl)*C.rar_cost[it.r]/10)*10:0;}
function gearChance(it){const C=gearCfg();return C&&it.lvl<16?C.chance[it.lvl]:0;}
function gearSellPrice(it){const C=gearCfg();return C?Math.round(C.sell*C.rar_cost[it.r]*(1+it.lvl)):0;}
function gearName(it){return GEAR_RAR[it.r][0]+' '+GEAR_SET[it.set][1]+' '+GEAR_SLOT[it.slot][1]+(it.lvl?' +'+it.lvl:'');}
function gearLine(k,v){return `${GEAR_STAT[k]||k} +${v}%`;}
/* the server's bag: after entering a seat, a battle, a chest; new items are announced */
async function gearLoadRaw(announce){if(!CLOUD.on||!CLOUD.token)return;const seat=seatNo();
  try{const r=await ecoRpc('gear_list',{seat},9000);if(seat!==seatNo())return;const old=new Set(((ECO.gear&&ECO.gear.items)||[]).map(x=>x.id)),had=!!ECO.gear;ECO.gear=r;
    if(announce&&had){const nw=(r.items||[]).filter(x=>!old.has(x.id));if(nw.length)ecoToast('⚒️ New gear: '+nw.map(gearName).join(' · '),true);}}catch(e){}}
function gearLoad(announce){return ecoLane(()=>gearLoadRaw(announce));}
function gearIcon(it,px){const R=GEAR_RAR[it.r];return `<span class="gic" style="--gc:${R[1]};${px?'font-size:'+px+'px':''}">${GEAR_SLOT[it.slot][0]}${it.lvl?`<em>+${it.lvl}</em>`:''}</span>`;}
/* ---------- the forge screen: the champion's 9 slots, the bag ---------- */
function showForge(cid,filter){
  const mine=CHAMPS.filter(c=>c.house===ACC.house&&unlocked(null,c));cid=(cid&&CBY[cid])?cid:ACC.sel;const c=CBY[cid];
  if(!ecoOn()){show(`<div class="topbar"><h1>⚒️ Forge<small>Gear is made and forged on the server.</small></h1><button class="back" id="bBack">✖</button></div>
    <p>The forge opens for a seat played through Telegram, where the server keeps your items safe.</p><button class="btn" id="bOk">✔ Back</button>`);
    const back=()=>showHub('battle');$('#bBack').addEventListener('click',back);$('#bOk').addEventListener('click',back);return;}
  const all=gearItems(),worn={};for(const it of all)if(it.champ===cid)worn[it.slot]=it;
  const st=gearStats(cid),stl=Object.keys(st).filter(k=>st[k]).map(k=>gearLine(k,st[k])).join(' · ')||'Nothing worn yet — every slot adds power.';
  const bag=all.filter(it=>it.champ!==cid&&(!filter||it.slot===filter)).sort((a,b)=>b.r-a.r||b.lvl-a.lvl||(a.slot<b.slot?-1:1));
  const champs=mine.map(x=>`<button class="gch ${x.id===cid?'on':''}" data-c="${x.id}">${CHAMP_ART[x.id+'_portrait']?`<img src="${CHAMP_ART[x.id+'_portrait']}" alt="">`:`<span>${x.e}</span>`}</button>`).join('');
  const slots=GEAR_SLOTS.map(k=>{const it=worn[k];return `<button class="gslot ${it?'':'empty'} ${filter===k?'on':''}" data-s="${k}" ${it?`data-i="${it.id}" style="--gc:${GEAR_RAR[it.r][1]}"`:''}>${it?gearIcon(it):`<span class="gic e">${GEAR_SLOT[k][0]}</span>`}<small>${GEAR_SLOT[k][1]}</small></button>`;}).join('');
  show(`<div class="topbar"><h1>⚒️ Forge<small>Gear drops from battles, the Hold and chests. +1…+16 at the anvil — a failed strike costs the gold, never the item.</small></h1><button class="back" id="bBack">✖</button></div>
  <div class="gchs">${champs}</div>
  <div class="gwho"><b>${esc(c.n)}</b><small>${stl}</small></div>
  <div class="gslots">${slots}</div>
  <div class="hh"><h2>Bag · ${all.length}/${(gearCfg()||{}).cap||200}</h2><small>${filter?`${GEAR_SLOT[filter][1]} only · <a href="#" id="gAll">all</a>`:'tap a slot to filter'}</small></div>
  <div class="gbag">${bag.map(it=>`<button class="gitem" data-i="${it.id}" style="--gc:${GEAR_RAR[it.r][1]}">${gearIcon(it)}<small>${GEAR_RAR[it.r][0]}${it.champ?' · on '+esc(shortName(CBY[it.champ]||{n:it.champ})):''}</small></button>`).join('')||'<p class="m" style="font-size:12px">Empty. Win battles, hold the door, open chests.</p>'}</div>
  <p class="m" style="font-size:11.5px">🪙 ${fmtN(goldOf())} gold</p>`);
  CLOUD.screen='forge';
  $('#bBack').addEventListener('click',()=>showHub('battle'));
  bind('.gch',b=>{SFX.play('tap',50);showForge(b.dataset.c,filter);});
  bind('.gslot',b=>{SFX.play('tap',50);if(b.dataset.i)gearSheet(b.dataset.i,cid,filter);else showForge(cid,filter===b.dataset.s?null:b.dataset.s);});
  bind('.gitem',b=>{SFX.play('tap',50);gearSheet(b.dataset.i,cid,filter);});
  const ga=$('#gAll');if(ga)ga.addEventListener('click',e=>{e.preventDefault();showForge(cid,null);});}
function gearSheet(id,cid,filter){const it=gearItems().find(x=>x.id===id);if(!it)return;const R=GEAR_RAR[it.r],S=GEAR_SET[it.set],C=gearCfg(),sb=C&&C.sets[it.set]||{};
  const worn=it.champ===cid,cost=gearCost(it),ch=gearChance(it);
  const html=`<div class="gsheet" style="--gc:${R[1]}">${gearIcon(it,34)}<b>${gearName(it)}</b>
    <div class="gst"><em>${gearLine(it.main.k,it.main.v)}</em>${(it.subs||[]).map(x=>`<span>${gearLine(x.k,x.v)}</span>`).join('')}</div>
    <small>${S[0]} ${S[1]} set · 2: ${Object.keys(sb['2']||{}).map(k=>gearLine(k,sb['2'][k])).join(', ')} · 4: ${Object.keys(sb['4']||{}).map(k=>gearLine(k,sb['4'][k])).join(', ')}</small>
    ${it.lvl<16?`<small>Next strike: +${it.lvl+1} · ${ch}% · 🪙${cost}${(it.lvl+1)%4===0?' · a substat grows':''}</small>`:'<small>Fully forged (+16).</small>'}</div>`;
  ecoModal(`${S[0]} ${GEAR_SLOT[it.slot][1]}`,html,[
    it.lvl<16?{t:`⚒️ Strike +${it.lvl+1} · ${ch}% · 🪙${cost}`,dis:goldOf()<cost,f:()=>gearUpgrade(it.id,cid,filter)}:null,
    {t:worn?'Take off':`Put on ${esc(shortName(CBY[cid]))}`,f:()=>gearEquip(it.id,worn?null:cid,cid,filter)},
    {t:`Sell · 🪙${gearSellPrice(it)}`,f:()=>ecoModal('Sell it?',`${gearName(it)} for 🪙${gearSellPrice(it)}. This cannot be undone.`,[{t:'Sell',f:()=>gearSell(it.id,cid,filter)},{t:'Keep',f:()=>gearSheet(id,cid,filter)}])},
    {t:'Close'}].filter(Boolean));}
async function gearCall(fn,args,after){ecoWait(true);
  try{const r=await ecoLane(async()=>{const x=await ecoRpc(fn,Object.assign({seat:seatNo()},args),10000);if(x&&x.state)ecoApply(x.state);if(x&&x.items)ECO.gear=Object.assign({},ECO.gear,{items:x.items,cfg:x.cfg||gearCfg()});return x;});ecoWait(false);after&&after(r);}
  catch(e){ecoWait(false);const m=ecoMsg(e);ecoToast('⚠️ '+(ecoNet(m)?'No connection to the server':m));SFX.play('deny');}}
function gearUpgrade(id,cid,filter){gearCall('gear_upgrade',{item:id,op:ecoUuid()},r=>{
  if(r.item){const L=ECO.gear.items;const i=L.findIndex(x=>x.id===r.item.id);if(i>=0)L[i]=r.item;}
  if(r.ok){SFX.play('upgrade');ecoToast(`⚒️ Success: ${gearName(r.item)}`,true);}else{SFX.play('deny');ecoToast(`The strike failed — 🪙${r.cost} gone, the item is safe`);}
  persist();showForge(cid,filter);gearSheet(id,cid,filter);});}
function gearEquip(id,to,cid,filter){gearCall('gear_equip',{item:id,champ:to},()=>{SFX.play('upgrade');showForge(cid,filter);});}
function gearSell(id,cid,filter){gearCall('gear_sell',{item:id},r=>{SFX.play('buy');ecoToast(`+🪙${r.gold}`,true);persist();showForge(cid,filter);});}
