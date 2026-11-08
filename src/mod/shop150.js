/* =========================== THE SHOP, MADE SIMPLE (v1.5.0) ===========================
   One card for everything sold: the art in the middle, the price as one tag with its currency, and a button that says what will
   happen — CLAIM / BUY in green when the player can pay, "Need N more <coin>" in grey when he cannot, UNLOCK for the locked picks.
   The balance sits pinned at the top of the tab with what each currency buys. Sections, in order: For you today (the six deals and
   the timer until the next six) · Chests · Gold for dragonglass · Dragonglass for Telegram Stars (the Starter pack first) · Season
   Pass & VIP as one card. Every purchase path is the one from before (data-deal / data-unl / data-buy / data-xch / data-stars and
   #bSeason are bound by hubShopBind + homeMovedBind; starsBuy opens the invoice) — only the drawing is new. */
const SH_LOCK_SVG='<svg viewBox="0 0 24 24" fill="#c9d1da" stroke="#0b1a2e" stroke-width="1.4"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none"/><circle cx="12" cy="15.5" r="1.6" fill="#0b1a2e"/></svg>';
/* what is missing for a price, as the grey button's content; '' when the player can pay */
function shNeed(p){if(!p)return '';
  if(p.gold){const n=p.gold-goldOf();return n>0?`<span>Need ${fmtN(n)} more ${GOLD_SVG}</span>`:'';}
  if(p.gems){const n=p.gems-(ACC.gems||0);return n>0?`<span>Need ${n} more ${GEM_SVG}</span>`:'';}
  return '';}
/* the price tag: one chip, the currency drawn in it */
function shChip(p){if(!p||(!p.gold&&!p.gems&&!p.stars))return '<span class="pchip free">FREE</span>';
  if(p.stars)return `<span class="pchip star">⭐ ${p.stars}</span>`;
  if(p.gold)return `<span class="pchip gold">${GOLD_SVG}${fmtN(p.gold)}</span>`;
  return `<span class="pchip gem">${GEM_SVG}${p.gems}</span>`;}
/* a buy button: green with the word when affordable, grey with what is missing when not */
function shBuyBtn(attr,p,word){const need=shNeed(p);return need?`<button ${attr} disabled class="need">${need}</button>`:`<button ${attr} class="buy">${word||'BUY'}</button>`;}
/* the one card: badge top-left (or, on a narrow card, under the art), price tag top-right, art, name, one line, button */
function shCard(o){const badge=o.badge?`<span class="badge${o.badgeIn?' in':''}${o.badgeCls?' '+o.badgeCls:''}"${o.badgeCol?` style="background:${o.badgeCol}"`:''}>${o.badge}</span>`:'';
  return `<div class="sitem sh ${o.cls||''}" style="--rc:${o.rc||'#4fb0ff'}">${o.badgeIn?'':badge}${o.chip||''}<span class="ch ${o.big?'':'dic'}">${o.art}</span><b>${o.name}</b><small>${o.line}</small>${o.badgeIn?badge:''}${o.btn}</div>`;}
/* the balance, pinned: the two currencies and what each is for; a tap scrolls to where more of it is sold */
function shBalance(){return `<div class="shbal"><button class="bal g" id="shBalG"><span class="n">${GOLD_SVG}${fmtN(goldOf())}</span><small>Gold · levels</small></button><button class="bal d" id="shBalD"><span class="n">${GEM_SVG}${fmtN(ACC.gems||0)}</span><small>Dragonglass · chests</small></button></div>`;}
/* For you today: the open deals in two columns (the first one wide when their number is odd), the locked picks as a short row */
function shDeals(){const D=dealsState(),deals=genDeals(),RC=typeof RAR_C!=='undefined'?RAR_C:['#8a97a8','#4fb0ff','#b47cff','#e3b661'];
  const open=[],lock=[];
  deals.forEach((d,i)=>{if(!D.unl[i]){lock.push(i);return;}
    const bought=!!D.bought[i],free=!d.price||(!d.price.gold&&!d.price.gems),m=/\s*·\s*−(\d+)%/.exec(d.s||''),line=m?d.s.replace(m[0],''):(d.s||'');
    const btn=bought?'<button disabled class="done">✔ TAKEN</button>':free?`<button data-deal="${i}" class="free">CLAIM</button>`:shBuyBtn(`data-deal="${i}"`,d.price);
    open.push({cls:'deal'+(bought?' done':''),rc:RC[d.r]||RC[RC.length-1],badge:bought?'':free?'FREE':m?'−'+m[1]+'%':'',badgeCol:!free&&m?'#b33fb0':'',chip:free?'':shChip(d.price),art:d.ic,name:esc(d.n),line:esc(line),btn});});
  if(open.length%2===1)open[0].cls+=' wide';
  const lk=lock.map(i=>{const p={gems:ECON.unlock[i]};return shCard({cls:'deal lock',rc:'#5a6c85',chip:shChip(p),art:SH_LOCK_SVG,name:`Deal ${i+1}`,line:i===5?'The last pick · locked':`A ${i+1}th pick · locked`,btn:shBuyBtn(`data-unl="${i}"`,p,'UNLOCK')});}).join('');
  const dt=fmtT(msToDeals());
  return `<div class="hh"><h2>For you today</h2><span class="shtimer"><em>new in</em><b id="dealCd">${dt.h}:${dt.m}:${dt.s}</b></span></div>
  <div class="shopgrid deals">${open.map(shCard).join('')}</div>${lk?`<div class="shopgrid deals locked">${lk}</div>`:''}`;}
/* Chests: the four tiers, the rarity in its colour, what is inside as one line */
function shChests(){const free=freeChestReady(),ft=fmtT(86400000-(Date.now()-(ACC.freeChestAt||0)));
  const cards=['wood','iron','valyrian','dragon'].map(t=>{const T=CHEST_TIERS[t];
    const line=`<i style="color:${T.trim};font-style:normal;font-weight:900">${T.sub}</i> · ${T.gold[0]}–${T.gold[1]} ${GOLD_SVG} · ${T.gems[0]}–${T.gems[1]} ${GEM_SVG} · ${T.cards} card stack${T.cards>1?'s':''}${T.rare?` (${T.rare} rare+)`:''}`;
    const btn=t==='wood'?(free?'<button class="free" data-buy="wood">OPEN</button>':`<button data-buy="wood" disabled class="need"><span>Free in ${ft.str}</span></button>`):shBuyBtn(`data-buy="${t}"`,{gems:T.price});
    return shCard({cls:'chest',big:1,rc:T.trim,badge:t==='wood'?(free?'DAILY FREE':'DAILY'):'',badgeCol:t==='wood'&&!free?'#5a6c85':'',chip:t==='wood'?'':shChip({gems:T.price}),art:chestSVG(t),name:T.n,line,btn});}).join('');
  return `<div class="hh"><h2>Chests</h2><small>gold, dragonglass and cards</small></div><div class="shopgrid">${cards}</div>`;}
/* Gold for dragonglass: three purses, the best rate marked */
function shExchange(){const X=ECON.exchange,best=X.reduce((b,x,i)=>x[1]/x[0]>X[b][1]/X[b][0]?i:b,0);
  return `<div class="hh" id="shXch"><h2>Gold for dragonglass</h2><small>${GEM_SVG} → ${GOLD_SVG}</small></div><div class="shopgrid three">${X.map(([g,gd],i)=>shCard({rc:'#e3b661',badge:i===best?'BEST VALUE':'',badgeIn:1,badgeCls:'best',chip:shChip({gems:g}),art:GOLD_SVG,name:`+${fmtN(gd)}`,line:['Purse','Chest','Hoard'][i]+' of gold',btn:shBuyBtn(`data-xch="${i}"`,{gems:g})})).join('')}</div>`;}
/* Dragonglass for Telegram Stars: the Starter pack first when the seat still has it, then the three packs; grey with the reason when
   this seat cannot pay (a guest, or an old Telegram) */
function shStars(){if(ecoOn())starsShopLoad();const can=starsCan();
  const note=can?'':`<p class="shopnote">${ecoOn()?'Open the game in an up-to-date Telegram to pay with Stars.':'Payments work on a seat signed in through Telegram — the server credits it.'}</p>`;
  const keys=['gems_s','gems_m','gems_l'],best=keys.reduce((b,k)=>STARS_SHOP[k].gems/STARS_SHOP[k].stars>STARS_SHOP[b].gems/STARS_SHOP[b].stars?k:b,keys[0]);
  const pack=(k,big)=>{const S=STARS_SHOP[k];const btn=can?`<button class="stbtn buy" data-stars="${k}">BUY</button>`:`<button class="stbtn" data-stars="${k}" disabled>${big?'TELEGRAM ONLY':'LOCKED'}</button>`;
    return shCard({cls:(k==='starter'?'starter wide':'')+(can?'':' lock'),rc:k==='starter'?'#ffd54a':'#4fb0ff',badge:k==='starter'?'ONCE · BEST VALUE':k===best?'BEST VALUE':'',badgeIn:k!=='starter',badgeCls:'best',chip:shChip({stars:S.stars}),art:GEM_SVG,name:k==='starter'?'Starter pack':`+${S.gems}`,line:k==='starter'?`${S.gems} ${GEM_SVG} · ${fmtN(S.gold)} ${GOLD_SVG} · 3 Rare books`:'dragonglass',btn});};
  const starter=ecoOn()&&STARS.starter===false?`<div class="shopgrid">${pack('starter',1)}</div>`:'';
  return `<div class="hh" id="shStars"><h2>Dragonglass</h2><small>pay with Telegram Stars ⭐</small></div>${note}${starter}<div class="shopgrid three">${keys.map(k=>pack(k)).join('')}</div>`;}
/* Season Pass & VIP: one card, one button (the page holds both purchases) */
function shSeason(){const on=typeof seasonOn==='function'&&seasonOn(),P=STARS_SHOP.pass,V=STARS_SHOP.vip;
  return `<button class="evcard live wide shseason" id="bSeason"><span class="ic">${icon('season',30)}</span><span class="tx"><b>Season Pass &amp; VIP</b><small>Pass ⭐${P.stars} · premium rewards on every tier. VIP ⭐${V.stars} · 25 ${GEM_SVG} a day for ${V.days} days${on?'':'. Needs a Telegram seat'}</small></span><span class="st">OPEN</span></button>`;}
function shop150HTML(){return shBalance()+shDeals()+shChests()+shExchange()+shStars()+shSeason();}
function shop150Bind(){const go=(id,sel)=>{const b=document.getElementById(id);if(b)b.addEventListener('click',()=>{SFX.play('tap',50);const t=document.querySelector(sel);if(t)t.scrollIntoView({behavior:'smooth',block:'start'});});};
  go('shBalG','#shXch');go('shBalD','#shStars');}
