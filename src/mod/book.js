/* =========================== THE BOOK (v1.0.50) ===========================
   A Kingdom-Rush-style encyclopedia: tabs as ribbons, a page with the picture, the story and the numbers,
   and a page with the grid. It fills in as you play: enemies you have met, tower tiers you have built,
   champions and spells that have opened. Unread discoveries carry a red dot; ACC.bookv remembers what was read. */
const BOOK_TABS=[['towers','Towers'],['enemies','Enemies'],['champs','Champions'],['spells','Spells'],['notes','Notes']];
const BOOK={tab:'towers',key:null,page:0,tier:0,fromBattle:false,wasPaused:false};
const TOWER_C={
 watch:"Two archers of the Night's Watch. Quick arrows at one enemy at a time — the cheapest damage in the game and the first tower on any road. Arrows are plain steel: a wight's shield turns away 45% of them, a wraith ignores most, ice armour halves them. Build it where the road bends, so one tower covers two stretches.",
 scorp:"A ballista that fires one heavy bolt at one enemy — slow to reload, very long reach. Bolts do ×2.5 to armoured enemies (Thenns, giants, mammoths) and this is the only tower that fully hurts a dragon. Wasted on a crowd of small wights: one bolt, one target.",
 wild:"Lobs a jar of green fire that bursts over everything within reach of the splash and leaves it burning. Made for packs — hounds, wolves, bats — and for crypt wights that split when they die. It cannot hit anything closer than 45 px, so it works from a pad set back from the road, and it cannot reach anything that flies.",
 glass:"Not a shooting tower. It plants a ring of obsidian spears around its pad: every ground enemy walking through the ring bleeds every second and moves at only 55% speed while inside. Glass ignores armour and ice — ×3 against White Walkers — and it cuts wraiths and shades that arrows barely touch. It does nothing unless the road passes right beside the pad: build it on pads that touch the road, best near the gate or where enemies bunch up. Fliers pass over it.",
 weir:"A heart tree with no attack of its own. Everything within its reach walks 30% slower and takes 20% more damage from every other tower. Plant it in the middle of your killing zone so the archers and scorpions around it get more shots at slower, softer targets. Crawlers, spiders and shades cannot be slowed.",
 keep:"A barracks. Sworn swords of your house stand on the road and block whatever comes; while they fight, your towers shoot. Fallen men return after a few seconds. Tap the keep to move their banner to another spot on the road. Riders, boars and elk charge straight through them, and nothing on the ground stops a flier.",
};
const TOWER_VS={
 watch:{good:['fast wights','fliers','the first waves'],bad:['shieldmen','wraiths','ice armour']},
 scorp:{good:['giants','mammoths','dragons','armoured'],bad:['crowds','shieldmen','wraiths']},
 wild:{good:['packs','crypt wights','crowds'],bad:['fliers','anything closer than 45 px']},
 glass:{good:['White Walkers','wraiths','shades','armour'],bad:['fliers','pads away from the road']},
 weir:{good:['every crowd','next to other towers'],bad:['crawlers','spiders','shades','standing alone']},
 keep:{good:['holding the road','giants (with Challenge)'],bad:['riders','boars','elk','fliers']},
};
const BOOK_ROLE={single:'Single target',splash:'Splash & burn',zone:'Ground trap',aura:'Support',barracks:'Barracks'};
function bookSeenMap(){if(!ACC.bookv)ACC.bookv={};return ACC.bookv;}
function bookDisc(){const S=seenMap(),TS=tseenMap(),c=cleared();
  return{towers:TKEYS.filter(k=>TS[k]),enemies:ED.map(x=>x[0]).filter(k=>S[k]),champs:CHAMPS.filter(x=>unlocked(null,x)).map(x=>x.id),spells:Object.keys(SPELLS).filter(k=>cardOpen('s:'+k))};}
function bookNew(){if(!ACC)return[];const V=bookSeenMap(),d=bookDisc(),out=[];for(const t in d)for(const k of d[t])if(!V[t+':'+k])out.push(t+':'+k);return out;}
function bookNewCount(tab){const n=bookNew();return tab?n.filter(x=>x.indexOf(tab+':')===0).length:n.length;}
function bookIsNew(tab,key){return !bookSeenMap()[tab+':'+key]&&bookDisc()[tab].indexOf(key)>=0;}
function bookMarkRead(tab,key){const V=bookSeenMap();if(!V[tab+':'+key]&&bookDisc()[tab].indexOf(key)>=0){V[tab+':'+key]=1;persist();return true;}return false;}
function stageName(id){if(id===-1)return 'the daily Hold';const L=LEVELS.find(l=>l.id===id);return L?L.n:'the Long Night';}
function bookSpeed(v){return v>=75?'Fast':v>=50?'Steady':v>=35?'Slow':'Crawling';}
function bookRange(r){return r>=160?'Long':r>=120?'Average':'Short';}
function bookArmour(E){const a=[];if(E.ice)a.push('Ice armour: towers −'+Math.round(E.ice*100)+'%, glass and champions full');if(E.armorRanged)a.push('Shield: arrows and bolts −'+Math.round((1-E.armorRanged)*100)+'%');if(E.physImmune)a.push('Ghostly: arrows and bolts only '+Math.round(E.physImmune*100)+'%');if(E.armored)a.push('Armoured: Scorpion bolts ×2.5');if(E.dragon)a.push('Dragonhide: only Scorpions and Dracarys bite');return a.length?a:['None'];}
function bookWeak(E){const w=[];if(E.dragon)w.push('Scorpion','Dracarys');if(E.ice)w.push('Dragonglass ×3','champions','spells');if(E.armored&&!E.dragon)w.push('Scorpion ×2.5');if(E.armorRanged)w.push('Wildfire','Dragonglass','champion');if(E.physImmune)w.push('Wildfire','Dragonglass','champion');if(E.fly||E.air)w.push('Watchtower','Scorpion');if(E.pack||E.split||E.spawn)w.push('Wildfire splash');if(E.charge)w.push('towers only — it passes every blocker');if(E.stealth)w.push('towers near the gate');if(E.ranged)w.push('kill it before it stops to shoot');if(E.raise||E.healAura||E.speedAura)w.push('kill it first');if(!w.length)w.push('anything — a plain wight');return w;}
function bookPicCls(E){return E.walker||E.ice||E.dragon?'snow':E.arch==='wraith'||E.boss||E.mini?'dark':'';}
/* ---- the grid ---- */
function bookEntries(tab){
  if(tab==='towers')return TKEYS.map(k=>({k}));
  if(tab==='enemies')return ED.map(x=>({k:x[0]}));
  if(tab==='champs'){return CHAMPS.slice().sort((a,b)=>(a.house===ACC.house?0:1)-(b.house===ACC.house?0:1)||a.tier-b.tier||CHAMPS.indexOf(a)-CHAMPS.indexOf(b)).map(x=>({k:x.id,c:x,open:unlocked(null,x)}));}
  if(tab==='spells')return Object.keys(SPELLS).map(k=>({k}));
  return[];}
function bookTile(tab,e){const on=BOOK.key===e.k?' on':'',nw=bookIsNew(tab,e.k)?'<span class="nw"></span>':'';
  if(tab==='towers'){const TS=tseenMap(),lv=TS[e.k]||0,open=towerOpen(e.k);
    if(!lv)return `<button class="bktile unk${on}" data-k="${e.k}"><span class="q">${open?'?':'🔒'}</span></button>`;
    return `<button class="bktile${on}" data-k="${e.k}">${towerIconHTML(e.k,lv,72)}<span class="lv">${ROMAN[lv-1]}</span>${nw}</button>`;}
  if(tab==='enemies'){const S=seenMap(),E=ENEMIES[e.k];if(!S[e.k])return `<button class="bktile unk${on}" data-k="${e.k}"><span class="q">?</span></button>`;
    return `<button class="bktile ${bookPicCls(E)}${on}" data-k="${e.k}">${enemyIconHTML(e.k,72)}${nw}</button>`;}
  if(tab==='champs'){const c=e.c,pu=CHAMP_ART[c.id+'_portrait'];if(!e.open)return `<button class="bktile unk${on}" data-k="${e.k}"><span class="q">?</span></button>`;
    return `<button class="bktile ${c.house===ACC.house?'':'oth'}${on}" data-k="${e.k}">${pu?`<img class="port" src="${pu}" alt="">`:`<span class="pe">${c.e}</span>`}${nw}</button>`;}
  if(tab==='spells'){const open=cardOpen('s:'+e.k);if(!open)return `<button class="bktile unk${on}" data-k="${e.k}"><span class="q">?</span></button>`;
    return `<button class="bktile dark${on}" data-k="${e.k}"><span class="spi">${spellSVG(e.k)}</span><span class="lv">LV ${spellLvl(e.k)}</span>${nw}</button>`;}
  return '';}
/* ---- the detail page ---- */
function bookDetail(tab,key){
  if(tab==='towers')return bookTower(key);if(tab==='enemies')return bookEnemy(key);if(tab==='champs')return bookChamp(key);if(tab==='spells')return bookSpell(key);return '';}
function bookStat(ic,v,l){return `<div><i>${ic}</i><span class="v"><b>${v}</b><small>${l}</small></span></div>`;}
function bookTower(k){const D=TOWERS[k],TS=tseenMap(),lv=TS[k]||0,open=towerOpen(k),L=tLvl(k),log=ACC.tlog||{};
  if(!lv)return `<div class="bkdet"><div class="bkpic dark"><span class="q">${open?'?':'🔒'}</span></div><div class="tx"><h3>${D.n}</h3><span class="sub">${BOOK_ROLE[D.kind]||''}</span><p>${open?'Build one in battle and this page fills in.':'Opens after stage '+TOWER_UNLOCK[k]+' is held. Build one and this page fills in.'}</p></div></div>`;
  const tier=Math.min(lv,Math.max(1,BOOK.tier||lv));const st=towerStats({type:k,lvl:tier});
  const stats=D.kind==='barracks'?[bookStat('👥',st.count+' men','soldiers'),bookStat('❤️',st.shp,'health each'),bookStat('⚔️',st.sdmg,'damage each'),bookStat('⏱️',st.resp+' s','return')]
    :D.kind==='aura'?[bookStat('🐌','−'+Math.round((1-st.slow)*100)+'%','speed inside'),bookStat('🎯','+'+Math.round((st.mark-1)*100)+'%','damage taken'),bookStat('📏',Math.round(st.range)+' px','reach · '+bookRange(st.range)),bookStat('⚔️','none','own attack')]
    :D.kind==='zone'?[bookStat('🩸',Math.round(st.dps)+'/s','bleed inside'),bookStat('🐌','−'+Math.round((1-st.slow)*100)+'%','speed inside'),bookStat('📏',Math.round(st.range)+' px','ring'),bookStat('❄️','×3','vs White Walkers')]
    :[bookStat('💥',Math.round(st.dmg),'damage'),bookStat('⏱️',st.rate.toFixed(2)+'/s','fire rate'),bookStat('📏',Math.round(st.range)+' px','range · '+bookRange(st.range)),D.kind==='splash'?bookStat('🔥',Math.round(st.splash)+' px · '+Math.round(st.burn)+'/s','splash · burn'):bookStat(k==='scorp'?'🗿':'🏹',k==='scorp'?'×2.5':(st.burn?Math.round(st.burn)+'/s burn':'—'),k==='scorp'?'vs armoured':'special')];
  const tiers=[0,1,2,3,4].map(i=>{const seen=i<lv;return `<button class="${i+1===tier?'on':''} ${seen?'':'lk'}" data-tier="${i+1}">${ROMAN[i]}</button>`;}).join('');
  const reached=log[k+':'+tier]!=null?`Tier ${ROMAN[tier-1]} first reached at ${stageName(log[k+':'+tier])}`:'';
  const nextT=lv<5?(lv<maxTowerLvl()?`Upgrade one to tier ${ROMAN[lv]} in battle to reveal its numbers.`:`Tier ${ROMAN[lv]} opens after stage ${LVL_GATES[lv]} is held.`):'Every tier revealed.';
  const cost=`Build ${D.cost[0]} gold · upgrades ${[1,2,3,4].map(i=>upPrice(k,i)).join(' / ')}`;
  const miles=TMILE[k].map((m,i)=>`<span class="${L>=T_MILE[i]?'':'lk'}">${m[0]} ${m[1]} <em>${L>=T_MILE[i]?'✓ '+m[2]:m[2]+' · Lv '+T_MILE[i]}</em></span>`).join('');
  const vs=TOWER_VS[k];
  return `<div class="bkdet"><div class="bkpic">${towerIconHTML(k,tier,86)}</div><div class="tx"><h3>${D.n}${bookIsNew('towers',k)?'<span class="bknew">NEW</span>':''}</h3><span class="sub">${BOOK_ROLE[D.kind]||''} · opens after stage ${TOWER_UNLOCK[k]} · ${D.cost[0]} gold</span><p>${TOWER_C[k]}</p></div></div>
  <div class="bktiers">${tiers}</div>
  <div class="bkst">${stats.join('')}</div>
  <div class="bkdisc">${reached?reached+' · ':''}${nextT}<br>${cost}</div>
  <div class="bkh">Good against</div><div class="bkchips">${vs.good.map(x=>`<span class="good">${x}</span>`).join('')}</div>
  <div class="bkh">Weak against</div><div class="bkchips">${vs.bad.map(x=>`<span class="bad">${x}</span>`).join('')}</div>
  <div class="bkh">Your level ${L} of ${T_MAX} · +${Math.round((L-1)*3)}% power</div><div class="bkbar"><i style="width:${Math.round(100*L/T_MAX)}%"></i></div>
  <div class="bkmile">${miles}</div>`;}
function bookEnemy(k){const E=ENEMIES[k],S=seenMap(),s=S[k],KC=ACC.kc||{};
  if(!s)return `<div class="bkdet"><div class="bkpic dark"><span class="q">?</span></div><div class="tx"><h3>Unknown</h3><span class="sub">not yet met</span><p>It walks somewhere beyond the Wall. Meet it on the road and this page fills in.</p></div></div>`;
  const tags=enemyTags(E),arm=bookArmour(E),weak=bookWeak(E);
  return `<div class="bkdet"><div class="bkpic ${bookPicCls(E)}">${enemyIconHTML(k,86)}</div><div class="tx"><h3>${E.n}${bookIsNew('enemies',k)?'<span class="bknew">NEW</span>':''}</h3><span class="sub">${E.boss?'Boss':E.mini?'Champion of the dead':E.fly||E.air?'Flier':E.arch==='beast'?'Beast':E.arch==='wraith'?'Wraith':E.arch==='spider'?'Spider':E.arch==='mount'?'Rider':'Wight'}${tags.length?' · '+tags.join(' · '):''}</span><p>${ENEMY_C[k]||''}</p></div></div>
  <div class="bkst">${bookStat('❤️',E.hp,'health · stage 1')}${bookStat('⚔️',E.dps?E.dps+'/s':'—',E.ranged?'shoots from '+E.ranged+' px':E.dragon?'crash: '+E.burst:'at the gate')}${bookStat('🛡️',arm[0].split(':')[0],arm.length>1?'+'+(arm.length-1)+' more':'armour')}${bookStat('🏃',bookSpeed(E.spd),'speed · '+E.spd)}${bookStat('💰',E.gold,'gold when slain')}${bookStat('💀',E.c,'threat weight')}</div>
  ${arm.length>1||arm[0]!=='None'?`<div class="bkh">Armour</div><div class="bkchips">${arm.map(x=>`<span>${x}</span>`).join('')}</div>`:''}
  <div class="bkh">Weak to</div><div class="bkchips">${weak.map(x=>`<span class="good">${x}</span>`).join('')}</div>
  <div class="bkdisc">First met at ${stageName(s.g)}, wave ${s.w} · met ${s.n} · slain ${KC[k]||0}</div>`;}
function bookChamp(id){const c=CBY[id],hh=HOUSES[c.house],open=unlocked(null,c),pu=CHAMP_ART[id+'_portrait'],[rn,rc]=rarOf(c);
  if(!open)return `<div class="bkdet"><div class="bkpic dark"><span class="q">?</span></div><div class="tx"><h3>${c.n}</h3><span class="sub">House ${hh.n} · ${rn}</span><p>Rides out after stage ${UNLOCK_STAGE[c.tier]} is held.</p></div></div>`;
  const p=cprog(null,id),L=p.lvl;const base=HERO_BASE(c.type);
  const hp=Math.round(base.hp*(1+0.05*(L-1))),dm=Math.round(base.dmg*(1+0.04*(L-1))*10)/10;
  const skills=c.sk.map((sk,i)=>{const S=SK[sk],l=p.sk[i];return `<div class="bksk"><span class="si">${skillIcon(sk,34,0)}</span><span class="st"><b>${S.n}${S.ult?' · ULTIMATE':''}</b> <em>rank ${l}/${SK_MAX}${S.cd?' · '+S.cd+' s':''}</em><br>${S.d(S.v[l-1])}</span></div>`;}).join('');
  const tal=(TALENTS[id]||[]).map((t,i)=>`<span class="${L>=TAL_AT?(p.tal===i+1?'good':''):'lk'}">${t.n} — ${talDesc(t)}</span>`).join('');
  const q=QUOTES[id]||[];
  return `<div class="bkdet"><div class="bkpic">${pu?`<img class="port" src="${pu}" alt="">`:`<span class="pe" style="font-size:44px">${c.e}</span>`}</div><div class="tx"><h3>${c.n}${bookIsNew('champs',id)?'<span class="bknew">NEW</span>':''}</h3><span class="sub" style="color:${rc}">${rn} · House ${hh.n} · ${c.type==='melee'?'Melee':c.type==='ranged'?'Ranged':'Caster'}${c.house!==ACC.house?' · rides for another seat':ACC.sel===id?' · riding with you':''}</span><p>${q[0]?'“'+q[0]+'”':''}${q[1]?' — and when the ultimate comes: “'+q[1]+'”':''}</p></div></div>
  <div class="bkst">${bookStat('❤️',hp,'health · level '+L)}${bookStat('⚔️',dm,'damage · '+base.rate.toFixed(1)+' s')}${bookStat('📏',base.range+' px',c.type==='melee'?'blocks the road':'range')}${bookStat('🏃',c.type==='melee'?'Fast':c.type==='caster'?'Slow':'Steady','on foot')}</div>
  <div class="bkh">Skills</div>${skills}
  <div class="bkh">Talents · level ${TAL_AT}</div><div class="bkchips">${tal}</div>`;}
function bookSpell(k){const S=SPELLS[k],open=cardOpen('s:'+k),l=spellLvl(k),m=spellMul(k);
  if(!open)return `<div class="bkdet"><div class="bkpic dark"><span class="q">?</span></div><div class="tx"><h3>${S.n}</h3><span class="sub">spell</span><p>Opens after stage ${S.at} is held.</p></div></div>`;
  const eff=k==='arrows'?[bookStat('💥',Math.round(170*m),'damage each'),bookStat('📏','95 px','circle')]:k==='fire'?[bookStat('💥',Math.round(400*m),'damage each'),bookStat('🔥',Math.round(20*m)+'/s · 3 s','burning'),bookStat('📏','72 px','circle'),bookStat('🐉','full','vs dragons')]:[bookStat('👥',(UP('sworn')?5:3)+(l>=S_MAX?1:0),'brothers'),bookStat('❤️',Math.round(150*(1+0.2*(maxTowerLvl()-1))*m),'health each'),bookStat('⏱️','15 s','on the road')];
  return `<div class="bkdet"><div class="bkpic dark"><span class="spi">${spellSVG(k)}</span></div><div class="tx"><h3>${S.n}${bookIsNew('spells',k)?'<span class="bknew">NEW</span>':''}</h3><span class="sub">spell · level ${l} of ${S_MAX} · recharges ${S.cd} s</span><p>${S.d}. ${k==='arrows'?'Tap the button, then the road — the volley lands where you tap.':k==='fire'?'Tap the button, then the road. The one spell that fully hurts a dragon.':'No aim needed: they march out of the gate onto the busiest road.'}</p></div></div>
  <div class="bkst">${eff.join('')}${bookStat('⏱️',S.cd+' s','recharge')}</div>
  <div class="bkdisc">Cards and gold raise a spell to level ${S_MAX}: +6% power a level${k==='reinf'?', a fourth brother at the top':''}.</div>`;}
function bookNotes(){const N=[
  ['🚪','The door','Every enemy that reaches Hodor breaks a piece of it; only Mend and Fortify repair it. More than 70% left at the end gives 3 stars, more than 35% gives 2.'],
  ['🏗️','Building','Tap a stone ring to build: pick a tower, then tap ✓. Tap a built tower to upgrade it (⬆), sell it for 60% (💰), read its numbers (i) or move a keep\'s banner (🚩).'],
  ['⚔️','Calling waves','Tap the ⚔ banner at the top of the road to call the next wave early: every second left on the timer pays 1 gold.'],
  ['👆','Your champion','Tap your champion or their card, then tap the ground to send them there. Melee champions block the road; ranged ones shoot from where they stand.'],
  ['✨','Spells','Spells and the champion\'s ultimate recharge after use — the dark cover shows how long. Arrow rain hits a wide circle, Dracarys burns and is the one spell that fully hurts a dragon, Brothers send sworn men onto the road.'],
  ['🔷','Dragonglass','Glass is a trap, not a tower: it only wounds what walks through its ring. Put it on a pad the road touches. It ignores ice and armour — ×3 on White Walkers.'],
  ['💸','Prices','Each tower of the same kind costs 17% more than the last. Mixing kinds is cheaper than building one kind everywhere.'],
  ['⬆️','Tiers','In battle a tower grows through tiers I–V. Higher tiers open as you hold stages: II after 3, III after 8, IV after 15, V after 24. Two tier-II towers often cover more road than one tier-III.'],
  ['🏰','Between battles','Cards and gold buy levels that stay: towers 1–16 (+3% a level), champions 1–20, spells 1–10. Cards come from chests, deals and the first win on every stage. Every upgrade raises your account level, and every account level pays a chest.'],
  ['🏃','Two gates','On roads with two gates, Hodor runs to the gate in danger. Tap a gate to send him there yourself.'],
  ['🏆','Trophies and rank','Every campaign star is a trophy, every wave of your best Hold run is two. Trophies set your rank — Iron to Challenger — next to your name.']];
  return N.map(n=>`<div class="bknote"><i>${n[0]}</i><div><b>${n[1]}</b>${n[2]}</div></div>`).join('');}
/* ---- the screen ---- */
function showBook(tab,key,fromBattle){
  if(!ACC){showTitle();return;}
  if(tab)BOOK.tab=tab;if(!BOOK_TABS.some(t=>t[0]===BOOK.tab))BOOK.tab='towers';
  if(fromBattle!==null){BOOK.fromBattle=!!fromBattle;if(fromBattle){BOOK.wasPaused=G.paused;G.paused=true;}}
  const T=BOOK.tab,list=bookEntries(T);
  if(key!=null){BOOK.key=key;BOOK.tier=0;}
  if(T!=='notes'&&(BOOK.key==null||!list.some(e=>e.k===BOOK.key))){const d=bookDisc()[T]||[];const firstNew=list.find(e=>bookIsNew(T,e.k));BOOK.key=(firstNew||list.find(e=>d.indexOf(e.k)>=0)||list[0]||{}).k||null;BOOK.tier=0;}
  const PER=16,pages=Math.max(1,Math.ceil(list.length/PER));const ki=list.findIndex(e=>e.k===BOOK.key);BOOK.page=Math.min(pages-1,Math.max(0,ki>=0?Math.floor(ki/PER):BOOK.page||0));
  const d=bookDisc();const cnt=T==='notes'?'':`${(d[T]||[]).length} of ${list.length}`;
  const ribs=BOOK_TABS.map(([k,n])=>{const c=k==='notes'?0:bookNewCount(k);return `<button class="bkrib ${k===T?'on':''}" data-tab="${k}">${n}${c?`<span class="n">${c}</span>`:''}</button>`;}).join('');
  show(`<div class="bookfs"><div class="bkhead">${ribs}<button class="bkx" id="bkX">✖</button></div>
   ${T==='notes'?`<div class="bkpage"><div class="bkgt">Field notes <small>how everything works</small></div>${bookNotes()}</div>`:`<div class="bkpage" id="bkDetail"></div>
   <div class="bkpage"><div class="bkgt">${BOOK_TABS.find(t=>t[0]===T)[1]} <small>${cnt} in the book</small></div><div class="bkgrid" id="bkGrid"></div>${pages>1?`<div class="bkpager"><button id="bkPrev">‹</button><span id="bkPg"></span><button id="bkNext">›</button></div>`:''}</div>`}
   ${BOOK.fromBattle&&G.tut&&tutWantBase()==='book'?'<p class="tutnote">📖 This is the book: your <b>Towers</b>, the <b>Enemies</b> you have met, your <b>Champions</b> and <b>Spells</b>, and <b>Notes</b> on how everything works. Look through the ribbons, then tap <b>✔ Back</b>.</p>':''}
   <button class="btn" id="bOk">✔ Back</button></div>`,'full');
  CLOUD.screen='book';
  const close=()=>{if(BOOK.fromBattle){G.paused=BOOK.wasPaused;BOOK.fromBattle=false;overlay.classList.add('hidden');}else showHub('coll');};
  $('#bkX').addEventListener('click',close);$('#bOk').addEventListener('click',close);
  bind('.bkrib',b=>{SFX.play('tap',50);showBook(b.dataset.tab,null,null);});
  if(T==='notes')return;
  const grid=$('#bkGrid'),det=$('#bkDetail');
  const drawGrid=()=>{grid.innerHTML=list.slice(BOOK.page*PER,BOOK.page*PER+PER).map(e=>bookTile(T,e)).join('');const pg=$('#bkPg');if(pg)pg.textContent=(BOOK.page+1)+'/'+pages;const pv=$('#bkPrev'),nx=$('#bkNext');if(pv)pv.disabled=BOOK.page<=0;if(nx)nx.disabled=BOOK.page>=pages-1;
    grid.querySelectorAll('.bktile').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',40);BOOK.key=b.dataset.k;BOOK.tier=0;drawDet();drawGrid();}));};
  const drawDet=()=>{det.innerHTML=bookDetail(T,BOOK.key);const wasNew=bookMarkRead(T,BOOK.key);det.querySelectorAll('[data-tier]').forEach(b=>b.addEventListener('click',()=>{if(b.classList.contains('lk'))return;BOOK.tier=+b.dataset.tier;drawDet();}));
    if(wasNew){const ribs=card.querySelectorAll('.bkrib');BOOK_TABS.forEach(([k],i)=>{const c=k==='notes'?0:bookNewCount(k);const n=ribs[i].querySelector('.n');if(n&&!c)n.remove();else if(n)n.textContent=c;});}};
  const pv=$('#bkPrev'),nx=$('#bkNext');if(pv)pv.addEventListener('click',()=>{if(BOOK.page>0){BOOK.page--;drawGrid();}});if(nx)nx.addEventListener('click',()=>{if(BOOK.page<pages-1){BOOK.page++;drawGrid();}});
  drawDet();drawGrid();
}
function showEncyclopedia(tab,fromBattle){showBook(tab==='tips'?'notes':tab==='heroes'?'champs':tab,null,fromBattle);}
