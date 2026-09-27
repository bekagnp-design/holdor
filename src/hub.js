/* =========================== HUB (v1.0.40) — Shop · Collection · Battle · Events · Hold =========================== */
const HUB_ICON={
 shop:'<svg viewBox="0 0 24 24"><path d="M3 10.5h18v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#a8652b" stroke="#3a2010" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 10.5V8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.5z" fill="#d9944a" stroke="#3a2010" stroke-width="1.6" stroke-linejoin="round"/><rect x="9.5" y="9" width="5" height="5" rx="1" fill="#ffd54a" stroke="#3a2010" stroke-width="1.2"/><path d="M7 3.5l1.5-2 1.5 2-1.5 2.2zM12 2.5l1.6-2.1 1.6 2.1-1.6 2.3zM16.8 3.6l1.4-1.9 1.4 1.9-1.4 2.1z" fill="#ff6fb1" stroke="#7a1d4a" stroke-width=".8"/></svg>',
 coll:'<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="11" height="15" rx="2" transform="rotate(-12 8 13.5)" fill="#b47cff" stroke="#2a0f4a" stroke-width="1.5"/><rect x="7" y="4.5" width="11" height="15" rx="2" fill="#ff7ab8" stroke="#5a1236" stroke-width="1.5"/><rect x="11" y="6" width="11" height="15" rx="2" transform="rotate(12 16.5 13.5)" fill="#4fc0ff" stroke="#0b3a5a" stroke-width="1.5"/><path d="M14 11l1.6 1.9 2.4-2.3 1 4.4h-6.8l.6-4.4z" fill="#ffd54a" stroke="#7a4a10" stroke-width=".9"/></svg>',
 battle:'<svg viewBox="0 0 24 24"><path d="M5 19.5 17.5 7l1.2-3.7L15 4.5 2.5 17z" fill="#e9eef5" stroke="#3a4655" stroke-width="1.4" stroke-linejoin="round"/><path d="M19 19.5 6.5 7 5.3 3.3 9 4.5 21.5 17z" fill="#dfe6ee" stroke="#3a4655" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 16.2l3.8 3.8M20 16.2l-3.8 3.8" stroke="#ffd54a" stroke-width="3" stroke-linecap="round"/><path d="M4 16.2l3.8 3.8M20 16.2l-3.8 3.8" stroke="#7a4a10" stroke-width="1" stroke-linecap="round"/><circle cx="3.2" cy="21" r="1.4" fill="#ff6fb1" stroke="#7a1d4a" stroke-width=".8"/><circle cx="20.8" cy="21" r="1.4" fill="#4fc0ff" stroke="#0b3a5a" stroke-width=".8"/></svg>',
 events:'<svg viewBox="0 0 24 24"><path d="M5 2.5h14v12l-7 5-7-5z" fill="#b33fb0" stroke="#3a1146" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 2.5v10.6l5 3.6 5-3.6V2.5" fill="none" stroke="#e08ae0" stroke-width="1.2"/><path d="M12 5.2l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#ffd54a" stroke="#7a4a10" stroke-width=".9"/><path d="M9 21.5h6" stroke="#3a1146" stroke-width="2" stroke-linecap="round"/></svg>',
 hold:'<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 5.2-3.4 8.4-8 10.5-4.6-2.1-8-5.3-8-10.5v-6z" fill="#4fc0ff" stroke="#0b3a5a" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 4.6l6 2.2v4.7c0 4-2.5 6.6-6 8.3-3.5-1.7-6-4.3-6-8.3V6.8z" fill="#2b8fd6" stroke="none"/><path d="M8.5 17V11a3.5 3.5 0 0 1 7 0v6z" fill="#8a5a2b" stroke="#3a2010" stroke-width="1.2"/><path d="M12 17v-6" stroke="#3a2010" stroke-width="1"/><circle cx="10.8" cy="13.5" r=".7" fill="#ffd54a"/><circle cx="13.2" cy="13.5" r=".7" fill="#ffd54a"/></svg>'
};
const GEM_SVG='<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#8fd3ff" stroke="#dff3ff" stroke-width="1.2"/><path d="M2 9h20M9 3l3 6 3-6M12 9v12" stroke="#2b6b9a" stroke-width="1" fill="none"/></svg>';
const GOLD_SVG='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#f2a62c" stroke="#7a4a10" stroke-width="1.4"/><circle cx="12" cy="12" r="6.8" fill="none" stroke="#ffe36e" stroke-width="1.3"/><path d="M12 7.2v9.6M9.4 9.3h4.1a1.9 1.9 0 0 1 0 3.8H9.9a1.9 1.9 0 0 0 0 3.8h4.6" fill="none" stroke="#7a4a10" stroke-width="1.7" stroke-linecap="round"/><path d="M6 8.5a7 7 0 0 1 4-3.6" fill="none" stroke="#fff3b0" stroke-width="1.4" stroke-linecap="round"/></svg>';
const STAR_SVG='<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="#e3b661" stroke="#fff0c2" stroke-width="1"/></svg>';
const TROPHY_SVG='<svg viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#e3b661" stroke="#fff0c2"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" fill="none" stroke="#e3b661" stroke-width="1.6"/><path d="M10 14h4v3h-4zM8 17h8v3H8z" fill="#c99b3f"/></svg>';
const CHEST_TIERS={
 wood:{n:'Wooden chest',sub:'Common',col:'#8a5a2b',col2:'#5a3a1a',trim:'#b8b8b8',glow:'rgba(180,140,90,.5)',cards:1,rare:0,gold:[80,150],gems:[3,8],price:0},
 iron:{n:'Iron chest',sub:'Rare',col:'#6f7f93',col2:'#3d4a5c',trim:'#c9d1da',glow:'rgba(160,190,220,.55)',cards:2,rare:1,gold:[220,360],gems:[8,16],price:60},
 valyrian:{n:'Valyrian chest',sub:'Epic',col:'#5a3f8a',col2:'#2d1f4a',trim:'#c9a3ff',glow:'rgba(180,120,255,.6)',cards:3,rare:2,gold:[500,800],gems:[20,36],price:150},
 dragon:{n:'Dragon chest',sub:'Legendary',col:'#a8322a',col2:'#4a1410',trim:'#ffd36b',glow:'rgba(255,170,60,.65)',cards:4,rare:3,gold:[1200,1800],gems:[50,90],price:380},
};
/* ---------- ECONOMY: two currencies. Gold pays for every level-up (champions, skills, tower and spell upgrades);
   dragonglass buys chests, deal unlocks, Hold attempts and gold. Stars stay as progress. ---------- */
const ECON={
  lvlCost:l=>Math.round((60*l+40)/10)*10,             /* champion level l → l+1: 100, 160 … 640 */
  skCost:r=>r===1?250:500,                             /* skill rank 1→2, 2→3 */
  upgCost:u=>({1:300,2:600,3:1000})[u.c]||300,         /* tower & spell upgrades (formerly stars) */
  win:(L,stars,first)=>Math.round((50+28*L.id+22*stars)*((L.stage||1)>1?1.15:1)*(first?1:0.35)),
  hold:(waves,kills)=>({gold:waves*8+Math.floor(kills/4),gems:4+Math.floor(waves/5)}),
  exchange:[[40,350],[100,1000],[250,2800]],           /* dragonglass → gold */
  unlock:[0,0,0,20,40,80],                             /* deal slot unlock price (dragonglass) */
};
function goldOf(a){return (a||ACC).gold||0;}
function addGold(n){ACC.gold=(ACC.gold||0)+Math.max(0,Math.round(n));}
function spendGold(n){if((ACC.gold||0)<n)return false;ACC.gold-=n;return true;}
function fmtN(n){return n>=10000?(n/1000).toFixed(1).replace(/\.0$/,'')+'k':String(n);}
/* daily deals: six slots every 6 hours (00 · 06 · 12 · 18 UTC). Slot 1 is always free, 2–3 open, 4–6 unlock with dragonglass. */
const DEAL_MS=6*3600*1000;
function dealKey(){return Math.floor(Date.now()/DEAL_MS);}
function msToDeals(){return DEAL_MS-(Date.now()%DEAL_MS);}
function dealsState(){const k=dealKey();if(!ACC.deals||ACC.deals.k!==k){ACC.deals={k,bought:[0,0,0,0,0,0],unl:[1,1,1,0,0,0]};persist();}return ACC.deals;}
function genDeals(){
  const rng=mulberry32(hash32('deal'+dealKey()+'/'+ACC.house));const pick=a=>a[Math.floor(rng()*a.length)];const rnd=(a,b)=>a+Math.floor(rng()*(b-a+1));
  const mine=CHAMPS.filter(c=>c.house===ACC.house&&unlocked(null,c));
  const port=c=>CHAMP_ART[c.id+'_portrait']?`<img src="${CHAMP_ART[c.id+'_portrait']}" alt="">`:`<span class="pe">${c.e}</span>`;
  const mk=[
    ()=>{const g=rnd(3,6)*100;return{k:'gold',n:'Purse of gold',s:`+${g} gold`,gold:g,price:{gems:Math.round(g/14)},ic:GOLD_SVG,r:0};},
    ()=>{const g=rnd(8,14)*100;return{k:'gold',n:'Chest of gold',s:`+${g} gold`,gold:g,price:{gems:Math.round(g/17)},ic:GOLD_SVG,r:1};},
    ()=>{const n=rnd(12,24);return{k:'gems',n:'Dragonglass shards',s:`+${n} dragonglass`,gems:n,price:{gold:n*28},ic:GEM_SVG,r:1};},
    ()=>{const c=pick(mine);if(!c)return null;const p=cprog(null,c.id);if(p.lvl>=10)return null;return{k:'lvl',c:c.id,n:shortName(c),s:`Level ${p.lvl} → ${p.lvl+1} · −40%`,price:{gold:Math.round(ECON.lvlCost(p.lvl)*0.6/10)*10},ic:port(c),r:1};},
    ()=>{const c=pick(mine);if(!c)return null;const p=cprog(null,c.id);const i=[0,1,2].filter(j=>p.sk[j]<3);if(!i.length)return null;const j=pick(i);return{k:'sk',c:c.id,i:j,n:SK[c.sk[j]].n,s:`${shortName(c)} · rank ${p.sk[j]} → ${p.sk[j]+1} · −40%`,price:{gold:Math.round(ECON.skCost(p.sk[j])*0.6/10)*10},ic:`<span class="pe">${SK[c.sk[j]].e}</span>`,r:2};},
    ()=>{const u=pick(UPG.filter(u=>!ACC.upg[u.id]&&(u.g==='power'||towerOpen(u.g)||u.g==='gate')));if(!u)return null;return{k:'upg',u:u.id,n:u.n,s:`${u.g==='power'?'Spell':u.g==='gate'?'Gate':TOWERS[u.g].n.split(' ')[0]} upgrade · ${u.s} · −35%`,price:{gold:Math.round(ECON.upgCost(u)*0.65/10)*10},ic:`<span class="pe">${u.e}</span>`,r:2};},
    ()=>({k:'att',n:'Hold attempt',s:'+1 run in today\'s Hold',price:{gems:25},ic:HUB_ICON.hold,r:1}),
    ()=>({k:'door',n:'Gate reinforcement',s:'+100 gate hp in every Hold. Permanent',price:{gems:40},ic:'<svg viewBox="0 0 24 24" fill="none" stroke="#e3b661" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M8 5v5M15 5v5M6 10v5M12 10v5M18 10v5M9 15v4M15 15v4"/></svg>',r:2}),
    ()=>({k:'bank',n:'Iron Bank credit',s:'+60 starting gold in every Hold. Permanent',price:{gems:35},ic:'<svg viewBox="0 0 24 24" fill="none" stroke="#e3b661" stroke-width="1.6"><ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4"/></svg>',r:2}),
  ];
  const out=[];
  /* slot 1: always free */
  const fr=rng();const c0=mine.length?pick(mine):null;
  if(fr<0.45){const g=rnd(10,20)*10;out.push({k:'gold',n:'Free gold',s:`+${g} gold`,gold:g,price:{},ic:GOLD_SVG,r:0});}
  else if(fr<0.8){const n=rnd(4,9);out.push({k:'gems',n:'Free dragonglass',s:`+${n} dragonglass`,gems:n,price:{},ic:GEM_SVG,r:0});}
  else if(c0&&cprog(null,c0.id).lvl<10){const p=cprog(null,c0.id);out.push({k:'lvl',c:c0.id,n:shortName(c0),s:`Level ${p.lvl} → ${p.lvl+1} · free`,price:{},ic:port(c0),r:1});}
  else out.push({k:'gold',n:'Free gold',s:'+150 gold',gold:150,price:{},ic:GOLD_SVG,r:0});
  let guard=0;const used=new Set();
  while(out.length<6&&guard++<60){const i=Math.floor(rng()*mk.length);if(used.has(i))continue;const d=mk[i]();if(!d)continue;used.add(i);out.push(d);}
  while(out.length<6)out.push({k:'gold',n:'Purse of gold',s:'+300 gold',gold:300,price:{gems:22},ic:GOLD_SVG,r:0});
  return out;}
function buyDeal(i){const D=dealsState(),deals=genDeals(),d=deals[i];if(!d||D.bought[i]||!D.unl[i])return false;
  if(d.price.gold){if(!spendGold(d.price.gold))return false;}else if(d.price.gems){if(ACC.gems<d.price.gems)return false;ACC.gems-=d.price.gems;}
  if(d.k==='gold')addGold(d.gold);else if(d.k==='gems')ACC.gems+=d.gems;else if(d.k==='lvl'){const p=cprog(null,d.c);if(p.lvl<10)p.lvl++;}else if(d.k==='sk'){const p=cprog(null,d.c);if(p.sk[d.i]<3)p.sk[d.i]++;}
  else if(d.k==='upg')ACC.upg[d.u]=1;else if(d.k==='att')ACC.online.attempts++;else if(d.k==='door')ACC.online.doorBonus+=100;else if(d.k==='bank')ACC.online.goldBonus+=60;
  D.bought[i]=1;persist();return true;}
function unlockDeal(i){const D=dealsState(),p=ECON.unlock[i];if(D.unl[i]||ACC.gems<p)return false;ACC.gems-=p;D.unl[i]=1;persist();return true;}
/* CHEST_ART[tier] / CHEST_ART[tier+'_open'] can hold generated images (data URLs); the SVG below is the fallback. */
const CHEST_ART={};
function chestSVG(t,open){const T=CHEST_TIERS[t]||CHEST_TIERS.wood;const k=t+(open?'_open':'');if(CHEST_ART[k])return `<img src="${CHEST_ART[k]}" alt="" style="width:100%;height:100%;object-fit:contain">`;
  const u=k.replace(/[^a-z]/g,'');const band=(x)=>`<rect x="${x}" y="${open?8:14}" width="8" height="${open?50:44}" rx="2.5" fill="${T.trim}" stroke="#1d0f05" stroke-width="1.5"/><rect x="${x+1.6}" y="${open?10:16}" width="2" height="${open?46:40}" fill="#fff" opacity=".42"/>${[0,1,2,3].map(i=>`<circle cx="${x+4}" cy="${(open?13:19)+i*12}" r="1.3" fill="#1d0f05" opacity=".8"/>`).join('')}`;
  const lidClosed=`<path d="M5 31a31 17 0 0 1 62 0v4H5z" fill="url(#cl${u})" stroke="#1d0f05" stroke-width="2.4" stroke-linejoin="round"/>
   <path d="M13 22q23-9 46 0" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2.2" stroke-linecap="round"/>
   <path d="M18 31a18 12 0 0 1 36 0M27 31a9 8 0 0 1 18 0" fill="none" stroke="#1d0f05" stroke-opacity=".35" stroke-width="1.2"/>
   <rect x="5" y="33" width="62" height="4.5" fill="#1d0f05" opacity=".45"/>`;
  const lidUp=`<rect x="7" y="3" width="58" height="30" rx="9" fill="url(#cl${u})" stroke="#1d0f05" stroke-width="2.4"/>
   <rect x="11" y="7" width="50" height="20" rx="6" fill="${T.col2}" stroke="#1d0f05" stroke-opacity=".6" stroke-width="1"/>
   <rect x="13" y="9" width="46" height="4" rx="2" fill="#fff" opacity=".12"/>`;
  const mouth=`<ellipse cx="36" cy="32" rx="28" ry="7" fill="#fff2b0"/><ellipse cx="36" cy="32" rx="28" ry="7" fill="url(#cg${u})"/>
   ${[[-14,-1,3.2],[-6,-4,3.6],[3,-2,3.4],[11,-4,3.1],[-9,2,3],[7,2,3.3],[-2,-6,2.8],[16,1,2.6],[-18,2,2.4]].map(([dx,dy,r])=>`<circle cx="${36+dx}" cy="${32+dy}" r="${r}" fill="#ffd54a" stroke="#8a5a10" stroke-width=".9"/>`).join('')}`;
  const body=`<rect x="5" y="30" width="62" height="27" rx="5" fill="url(#cb${u})" stroke="#1d0f05" stroke-width="2.4"/>
  <path d="M17 31v26M27 31v26M45 31v26M55 31v26" stroke="#1d0f05" stroke-opacity=".35" stroke-width="1.4"/>
  <rect x="7" y="31" width="58" height="3" fill="#fff" opacity=".18"/>`;
  return `<svg viewBox="0 0 72 64"><defs>
   <linearGradient id="cb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.col}"/><stop offset="1" stop-color="${T.col2}"/></linearGradient>
   <linearGradient id="cl${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".45" stop-color="${T.col}"/><stop offset="1" stop-color="${T.col2}"/></linearGradient>
   <radialGradient id="cg${u}" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff8d0" stop-opacity=".95"/><stop offset="1" stop-color="#ffb347" stop-opacity=".15"/></radialGradient>
   </defs>
  <ellipse cx="36" cy="60" rx="31" ry="4.2" fill="rgba(0,0,0,.32)"/>
  ${open?`<ellipse cx="36" cy="30" rx="38" ry="24" fill="url(#cg${u})" opacity=".85"/>${lidUp}${body}${mouth}`:body+lidClosed}
  ${band(13)}${band(51)}
  ${open?'':`<rect x="27" y="29" width="18" height="16" rx="3.5" fill="${T.trim}" stroke="#1d0f05" stroke-width="2"/><rect x="29" y="31" width="7" height="3" rx="1.2" fill="#fff" opacity=".45"/>
  <circle cx="36" cy="36" r="2.8" fill="#1d0f05"/><rect x="34.7" y="36" width="2.6" height="6" rx="1.2" fill="#1d0f05"/>`}
  </svg>`;}
function accXp(a){a=a||ACC;if(!a)return 0;const st=a.stats||{};return starsEarned(a)*25+cleared(a)*40+Math.floor((st.kills||0)/10)+(st.onlineBest||0)*5+(a.tut?10:0)+(a.xpBonus||0);}
function lvlNeed(n){return Math.round(100*Math.pow(1.35,n-1));}
function accLevel(a){let xp=accXp(a),l=1;while(l<40&&xp>=lvlNeed(l)){xp-=lvlNeed(l);l++;}return{l,xp,need:lvlNeed(l)};}
function playerName(){if(CLOUD.on&&CLOUD.name)return CLOUD.name;try{const u=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user;if(u&&u.first_name)return u.first_name;}catch(e){}return 'Defender';}
function dayKeyUTC(){const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getUTCFullYear()+'-'+p(d.getUTCMonth()+1)+'-'+p(d.getUTCDate());}
function msToMidnightUTC(){const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)-d.getTime();}
const HOLD_ATTEMPTS=3; /* runs per UTC day; only the best one counts for the realm and the house */
function rollDay(){if(!ACC)return;const k=dayKeyUTC();todayKey=k;if(ACC.online.date!==k){ACC.online.date=k;ACC.online.runs=[];ACC.online.attempts=HOLD_ATTEMPTS;persist();}}
function freeChestReady(){return !ACC.freeChestAt||Date.now()-ACC.freeChestAt>=86400000;}
function starChestsReady(){return Math.floor(starsEarned()/3)-(ACC.starChests||0);}
function fmtT(ms){ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),p=n=>String(n).padStart(2,'0');return{h:p(h),m:p(m),s:p(s),str:p(h)+':'+p(m)+':'+p(s)};}

function hubTop(){const c=CBY[ACC.sel],L=accLevel(),hh=HOUSES[ACC.house];const pu=CHAMP_ART[c.id+'_portrait'];
  return `<div class="hubtop"><div class="ava" id="hubAva">${pu?`<img src="${pu}" alt="">`:`<span class="pe">${c.e}</span>`}<span class="lv">${L.l}</span></div>
  <div class="who"><b>${esc(playerName())}</b><small>House ${hh.n} · ${flag(lang().c,14)} ${lang().c}</small><div class="xp" title="Level ${L.l}"><i style="width:${Math.round(100*L.xp/L.need)}%"></i></div></div>
  <div class="cur"><span title="Gold — levels, skills, upgrades">${GOLD_SVG}${fmtN(goldOf())}<i class="plus" data-go="shop">+</i></span><span title="Dragonglass — chests and deals">${GEM_SVG}${fmtN(ACC.gems)}<i class="plus" data-go="shop">+</i></span></div></div>`;}
function hubTabs(on){const t=[['shop','Shop'],['coll','Collection'],['battle','Battle'],['events','Events'],['hold','Hold']];
  const dot={shop:freeChestReady()||starChestsReady()>0,battle:starChestsReady()>0,hold:onlineOpen()&&ACC.online.attempts>0&&!(ACC.online.runs||[]).length};
  return `<div class="hubtabs">${t.map(([k,n])=>`<button class="${k===on?'on':''} ${k==='battle'?'mid':''} ${k==='hold'&&!onlineOpen()?'lock':''}" data-tab="${k}">${HUB_ICON[k]}${n}${dot[k]?'<span class="dot"></span>':''}</button>`).join('')}</div>`;}
const HUB_ORDER=['shop','coll','battle','events','hold'];
let hubDir=0; /* -1: slid in from the left, 1: from the right (swipe animation) */
function showHub(tab,sub){
  if(!ACC){showTitle();return;}
  rollDay();tab=tab||'battle';
  const body=tab==='shop'?hubShop():tab==='coll'?hubCollection(sub):tab==='events'?hubEvents(sub):tab==='hold'?hubHold():hubBattle();
  show(`<div class="hub" style="--sig:url(${SIGILS[ACC.house]||''})">${hubTop()}<div class="hubbody ${tab} ${hubDir>0?'slide-r':hubDir<0?'slide-l':''}" id="hubBody">${body}</div>${hubTabs(tab)}</div>`,'full');
  hubDir=0;CLOUD.screen='hub:'+tab;
  card.querySelectorAll('.hubtabs button').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',60);hubDir=Math.sign(HUB_ORDER.indexOf(b.dataset.tab)-HUB_ORDER.indexOf(tab));showHub(b.dataset.tab);}));
  $('#hubAva').addEventListener('click',()=>showSettings());card.querySelectorAll('.plus').forEach(b=>b.addEventListener('click',()=>showHub(b.dataset.go)));
  hubSwipe(card.querySelector('.hub'),tab);
  if(tab==='battle')hubBattleBind();else if(tab==='coll')hubCollectionBind(sub);else if(tab==='shop')hubShopBind();else if(tab==='events')hubEventsBind(sub);else hubHoldBind();
}
/* horizontal swipe between the five tabs (touch and mouse) */
function hubSwipe(el,tab){
  if(!el)return;let sx=0,sy=0,t0=0,on=false;
  const start=(x,y)=>{sx=x;sy=y;t0=Date.now();on=true;};
  const end=(x,y)=>{if(!on)return;on=false;const dx=x-sx,dy=y-sy,dt=Date.now()-t0;if(dt>900||Math.abs(dx)<56||Math.abs(dy)>Math.abs(dx)*0.7)return;
    const i=HUB_ORDER.indexOf(tab),j=i+(dx<0?1:-1);if(j<0||j>=HUB_ORDER.length)return;SFX.play('swipe',50);hubDir=dx<0?1:-1;showHub(HUB_ORDER[j]);};
  el.addEventListener('touchstart',e=>{const t=e.touches[0];start(t.clientX,t.clientY);},{passive:true});
  el.addEventListener('touchend',e=>{const t=e.changedTouches[0];end(t.clientX,t.clientY);},{passive:true});
  el.addEventListener('mousedown',e=>start(e.clientX,e.clientY));
  el.addEventListener('mouseup',e=>end(e.clientX,e.clientY));
}
/* ---------- BATTLE ---------- */
function hubBattle(){const hh=HOUSES[ACC.house],c=CBY[ACC.sel],g=cleared(),se=starsEarned();const chestsN=starChestsReady(),prog=se%3,pu=CHAMP_ART[c.id+'_portrait'];
  const nextL=LEVELS.find(l=>levelOpen(null,l)&&!ACC.campaign[l.id])||LEVELS[LEVELS.length-1];
  const NG=LEVELS.length;
  return `<div class="seatname"><b>${hh.seat}</b><small>Seat of House ${hh.n} · ${hh.words}</small></div>
  <div class="islewrap"><canvas class="isle" id="isle" width="680" height="700"></canvas></div>
  <div class="tro"><span class="tr">${TROPHY_SVG}${se}</span><span class="bar"><i style="width:${Math.round(100*g/NG)}%"></i><em>GATE ${Math.min(NG,g+1)} OF ${NG} · ${nextL.n.toUpperCase()}</em></span></div>
  <div class="chestrow"><span class="ch ${chestsN>0?'ready':''}" id="starChest">${chestSVG('iron')}</span><span class="sbar"><i style="width:${chestsN>0?100:Math.round(100*prog/3)}%"></i><em>${chestsN>0?'CHEST READY · TAP TO OPEN':`${prog}/3 STARS TO THE NEXT CHEST`}</em></span>${chestsN>1?`<b class="cnt">×${chestsN}</b>`:''}</div>
  <div class="battlerow"><button class="bside" id="bDiffH"><span class="pe">${DIFFS[ACC.diff].e}</span>${DIFFS[ACC.diff].lbl||DIFFS[ACC.diff].n}</button>
    <button class="bbig ${ACC.tut?'':'pulse'}" id="bBattle">${ACC.tut?'BATTLE!':'BEGIN'}<small>${ACC.tut?(ACC.campaign[nextL.id]?'DEFEND AGAIN':'HOLD GATE '+nextL.id):'YOUR FIRST LESSON'}</small></button>
    <button class="bside" id="bChampH">${pu?`<img src="${pu}" alt="">`:`<span class="pe">${c.e}</span>`}${shortName(c)}</button></div>
  ${ACC.tut?'':'<div class="hint">▲ TAP BEGIN — YOUR CHAMPION WILL TEACH YOU</div>'}`;}
function hubBattleBind(){
  const cv=$('#isle');if(cv)drawIsland(cv,ACC.house);
  $('#bBattle').addEventListener('click',()=>{SFX.play('tap',80);if(!ACC.tut)startTutorial();else showCampaign();});
  $('#bDiffH').addEventListener('click',()=>showDifficulty(false));
  $('#bChampH').addEventListener('click',()=>showHeroRoom(ACC.sel));
  $('#starChest').addEventListener('click',()=>{if(starChestsReady()>0){ACC.starChests=(ACC.starChests||0)+1;persist();openChest('iron',()=>showHub('battle'));}});
}
const ISLE_IMG={};
function isleImg(k,src){if(!ISLE_IMG[k]){const im=new Image();im.src=src;ISLE_IMG[k]=im;}return ISLE_IMG[k];}
const ISLE_PAL={stark:{top:'#dfe9f2',top2:'#b9c9d8',rock:'#5b6674',rock2:'#2f3742',sky:'#33475c',fx:'snow',water:'#9fd6ff'},
 lannister:{top:'#c9a45a',top2:'#9a7a3a',rock:'#7a5b3a',rock2:'#3f2e1c',sky:'#5a2a1a',fx:'ember'},
 baratheon:{top:'#7f8d6f',top2:'#5b6a4e',rock:'#4a4f57',rock2:'#22262c',sky:'#23231f',fx:'rain',water:'#9fc6e0'},
 targaryen:{top:'#3a3134',top2:'#241c1e',rock:'#2a2224',rock2:'#120d0e',sky:'#3a1010',fx:'ember',water:'#ff6a3c'},
 greyjoy:{top:'#6c8b7a',top2:'#4a6656',rock:'#3d4a52',rock2:'#1f2a30',sky:'#1f2a30',fx:'rain',water:'#7fc3d6'},
 tyrell:{top:'#7fbf5a',top2:'#4f8a3a',rock:'#7a6242',rock2:'#3f3020',sky:'#2f5a2a',fx:'petal',water:'#8fd3ff'},
 martell:{top:'#e0b46c',top2:'#b8863f',rock:'#9a5a3a',rock2:'#4a2a1a',sky:'#7a2a1a',fx:'sand'}};
function drawIsland(cv,house){
  const x=cv.getContext('2d'),W2=cv.width,H2=cv.height,P=ISLE_PAL[house]||ISLE_PAL.stark,hh=HOUSES[house];
  x.clearRect(0,0,W2,H2);
  const cx=W2/2,cy=H2*0.40,rx=W2*0.46,ry=H2*0.20;
  // sun glow + clouds behind the island
  const gl=x.createRadialGradient(cx,cy+20,10,cx,cy+20,W2*0.6);gl.addColorStop(0,'rgba(255,255,255,.22)');gl.addColorStop(0.5,hexA(hh.col,0.12));gl.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gl;x.fillRect(0,0,W2,H2);
  const cloud=(px,py,sc,a)=>{x.save();x.globalAlpha=a;x.fillStyle='#ffffff';for(const [dx,dy,r] of [[0,0,26],[-28,6,18],[26,4,20],[-10,-12,20],[14,-10,17],[44,10,13],[-46,10,12]]){x.beginPath();x.arc(px+dx*sc,py+dy*sc,r*sc,0,6.28);x.fill();}x.restore();};
  cloud(W2*0.16,H2*0.30,1.1,.55);cloud(W2*0.86,H2*0.24,0.9,.5);cloud(W2*0.10,H2*0.70,0.8,.4);cloud(W2*0.90,H2*0.66,1.0,.45);cloud(W2*0.55,H2*0.82,0.7,.35);
  // floating rocks
  x.fillStyle=P.rock2;for(const [dx,dy,r] of [[-rx*1.12,H2*0.30,11],[rx*1.1,H2*0.36,9],[-rx*0.7,H2*0.50,6],[rx*0.85,H2*0.52,5],[rx*0.3,H2*0.56,4]]){x.beginPath();x.ellipse(cx+dx,cy+dy,r*1.5,r,0,0,6.28);x.fill();}
  // rock underside: tapered, jagged
  const pts=[[-1,0],[-0.92,0.12],[-0.78,0.22],[-0.7,0.36],[-0.5,0.44],[-0.42,0.56],[-0.22,0.62],[-0.08,0.74],[0.06,0.66],[0.2,0.58],[0.34,0.5],[0.48,0.4],[0.62,0.3],[0.8,0.22],[0.9,0.1],[1,0]];
  x.save();x.beginPath();pts.forEach(([px,py],k)=>{const X=cx+px*rx,Y=cy+py*H2*0.62;k?x.lineTo(X,Y):x.moveTo(X,Y);});x.closePath();
  const rg=x.createLinearGradient(0,cy,0,cy+H2*0.5);rg.addColorStop(0,P.rock);rg.addColorStop(1,P.rock2);x.fillStyle=rg;x.fill();x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=3;x.stroke();
  x.strokeStyle='rgba(0,0,0,.28)';x.lineWidth=2;for(let k=0;k<4;k++){const yy=cy+34+k*38;x.beginPath();x.moveTo(cx-rx*(0.86-k*0.17),yy);x.quadraticCurveTo(cx,yy+16,cx+rx*(0.86-k*0.17),yy-3);x.stroke();}
  x.strokeStyle='rgba(255,255,255,.07)';x.beginPath();x.moveTo(cx-rx*0.55,cy+26);x.lineTo(cx-rx*0.46,cy+86);x.lineTo(cx-rx*0.3,cy+140);x.stroke();
  x.restore();
  // top ground
  x.save();x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,6.28);const tg=x.createRadialGradient(cx-rx*0.2,cy-ry*0.5,10,cx,cy,rx);tg.addColorStop(0,P.top);tg.addColorStop(1,P.top2);x.fillStyle=tg;x.fill();
  x.lineWidth=5;x.strokeStyle='rgba(0,0,0,.35)';x.stroke();x.lineWidth=2;x.strokeStyle='rgba(255,255,255,.35)';x.beginPath();x.ellipse(cx,cy-2,rx-3,ry-3,0,Math.PI*1.05,Math.PI*1.95);x.stroke();x.restore();
  // path, decor, stream
  x.save();x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,6.28);x.clip();
  x.strokeStyle='rgba(0,0,0,.16)';x.lineWidth=28;x.lineCap='round';x.beginPath();x.moveTo(cx-rx*0.75,cy-ry*0.2);x.quadraticCurveTo(cx-rx*0.2,cy-ry*0.9,cx,cy+ry*0.3);x.stroke();x.strokeStyle='rgba(255,255,255,.09)';x.lineWidth=18;x.stroke();
  x.fillStyle='rgba(0,0,0,.2)';for(let k=0;k<12;k++){const a=k*0.95+0.4,r0=rx*(0.6+((k*37)%36)/100);x.beginPath();x.ellipse(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0*(ry/rx)+3,8,3.5,0,0,6.28);x.fill();}
  if(P.fx==='snow'||P.fx==='petal'){for(let k=0;k<7;k++){const a=k*0.9+0.2,r0=rx*(0.62+((k*53)%30)/100),px=cx+Math.cos(a)*r0,py=cy+Math.sin(a)*r0*(ry/rx);x.fillStyle=P.fx==='snow'?'#2f4a3c':'#2f6a2a';x.beginPath();x.moveTo(px,py-30);x.lineTo(px+11,py);x.lineTo(px-11,py);x.closePath();x.fill();x.fillStyle=P.fx==='snow'?'#4a6a58':'#3f8a3a';x.beginPath();x.moveTo(px,py-34);x.lineTo(px+8,py-14);x.lineTo(px-8,py-14);x.closePath();x.fill();}}
  if(P.water){x.strokeStyle=P.water;x.lineWidth=9;x.beginPath();x.moveTo(cx+rx*0.2,cy-ry*0.6);x.quadraticCurveTo(cx+rx*0.5,cy-ry*0.1,cx+rx*0.66,cy+ry*0.6);x.stroke();x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=3;x.stroke();}
  x.restore();
  if(P.water){const wx=cx+rx*0.66;const wg=x.createLinearGradient(0,cy+ry*0.6,0,cy+H2*0.36);wg.addColorStop(0,P.water);wg.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=wg;x.fillRect(wx-6,cy+ry*0.6,12,H2*0.30);x.fillStyle='rgba(255,255,255,.22)';for(let k=0;k<4;k++){x.beginPath();x.ellipse(wx+(k-1.5)*10,cy+ry*0.6+H2*0.29,10,5,0,0,6.28);x.fill();}}
  // towers
  const tw=(k,l,px,py,sz)=>{const u=TOWER_ART[k]&&TOWER_ART[k][l];if(!u)return;const im=isleImg(k+l,u);if(im.complete&&im.naturalWidth){x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=8;x.shadowOffsetY=4;x.drawImage(im,px-sz/2,py-sz,sz,sz);x.restore();}};
  tw('scorp',3,cx+rx*0.02,cy-ry*0.30,112);tw('keep',5,cx-rx*0.56,cy+ry*0.45,176);tw('watch',4,cx+rx*0.54,cy+ry*0.35,146);
  // the gate (Hodor + wall) at the front
  const gim=GATE_IMG[1];if(gim&&gim.complete&&gim.naturalWidth){const gw=W2*0.36,gh=gw*(gim.naturalHeight/gim.naturalWidth);x.save();x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=12;x.shadowOffsetY=5;x.drawImage(gim,cx-gw/2,cy+ry*0.95-gh,gw,gh);x.restore();}
  // banners with the sigil
  const sg=SIGILS[house]?isleImg('sig'+house,SIGILS[house]):null;
  for(const side of [-1,1]){const bx=cx+side*rx*0.86,by=cy-ry*0.2;x.strokeStyle='#3a2a14';x.lineWidth=5;x.lineCap='round';x.beginPath();x.moveTo(bx,by+30);x.lineTo(bx,by-132);x.stroke();x.fillStyle='#e3b661';x.beginPath();x.arc(bx,by-134,4.5,0,6.28);x.fill();
    const bl=side<0?bx+3:bx-49;if(sg&&sg.complete&&sg.naturalWidth){x.save();x.shadowColor='rgba(0,0,0,.5)';x.shadowBlur=8;x.shadowOffsetY=3;x.drawImage(sg,bl,by-126,46,88);x.restore();}else{x.fillStyle=hh.col;x.fillRect(bl,by-126,46,74);}}
  // weather
  const fxc=P.fx==='snow'?'rgba(255,255,255,.8)':P.fx==='ember'?'rgba(255,170,80,.85)':P.fx==='petal'?'rgba(255,190,210,.85)':P.fx==='sand'?'rgba(255,220,160,.6)':'rgba(180,210,240,.5)';
  x.fillStyle=fxc;for(let k=0;k<46;k++){const px=(k*97)%W2,py=(k*53)%H2;x.beginPath();if(P.fx==='rain'){x.fillRect(px,py,1.5,9);}else{x.arc(px,py,1.5+(k%3),0,6.28);x.fill();}}
  // seat plate
  x.font='900 22px Cinzel,serif';x.textAlign='center';const t=hh.seat.toUpperCase(),tw2=x.measureText(t).width+48;x.fillStyle='#0b1a2e';rr(x,cx-tw2/2,H2-46,tw2,36,12);x.fill();const pg=x.createLinearGradient(0,H2-50,0,H2-14);pg.addColorStop(0,'#ffe97a');pg.addColorStop(1,'#f2a62c');x.fillStyle=pg;rr(x,cx-tw2/2,H2-50,tw2,34,12);x.fill();x.strokeStyle='#7a4a10';x.lineWidth=3;rr(x,cx-tw2/2,H2-50,tw2,34,12);x.stroke();x.lineWidth=5;x.strokeStyle='#7a4a10';x.lineJoin='round';x.strokeText(t,cx,H2-26);x.fillStyle='#fff';x.fillText(t,cx,H2-26);
  if(!cv._retry){cv._retry=1;[350,1200,2500].forEach(ms=>setTimeout(()=>{if(document.body.contains(cv))drawIsland(cv,house);},ms));}
}
/* ---------- COLLECTION ---------- */
const RARITY=[['Common','#8a97a8'],['Common','#8a97a8'],['Rare','#4fb0ff'],['Rare','#4fb0ff'],['Epic','#b47cff'],['Epic','#b47cff'],['Legendary','#e3b661']];
function rarOf(c){return RARITY[c.tier]||RARITY[0];}
/* SKILL_ART[id] may hold generated icon images (data URLs); until then the emoji sits in a KR-style badge. */
const SKILL_ART={};
const SK_COL={cleave:'#e14b4b',crit:'#ffd54a',execute:'#b47cff',shield:'#4fc0ff',taunt:'#ff9a3c',rally:'#e3b661',goldtouch:'#ffd54a',heal:'#7fd06a',poison:'#7cff6b',burn:'#ff7a3c',slowaura:'#8fd3ff',stun:'#ffe66d',multishot:'#e3b661',pierce:'#cfe6ff',summon:'#c9a06a',
  firestorm:'#ff7a3c',blizzard:'#a5ecff',assassinate:'#e9eef5',warcry:'#e3b661',fortify:'#8fd3ff',reinforce:'#c9a06a',wildfire:'#7cff6b',kraken:'#4fb8c8',linestrike:'#e0c14a',dragonstrike:'#e14b4b',goldrain:'#ffd54a',cloud:'#9fe07a',smash:'#d9944a',oath:'#fff0c2'};
function skillIcon(id,px,rank,opts){opts=opts||{};const S=SK[id];if(!S)return '';const col=SK_COL[id]||'#8fd3ff';const im=SKILL_ART[id];
  return `<span class="skb ${S.ult?'ult':''} ${opts.dim?'dim':''}" style="--sc:${col};--px:${px}px;width:${px}px;height:${px}px" title="${S.n}">${im?`<img src="${im}" alt="">`:`<i>${S.e}</i>`}${rank?`<b>${rank}</b>`:''}</span>`;}
function champCard(c,opts){opts=opts||{};const un=unlocked(null,c),p=cprog(null,c.id),ride=ACC.sel===c.id,[rn,rc]=rarOf(c),pu=CHAMP_ART[c.id+'_portrait'],other=c.house!==ACC.house;
  const lockTxt=other?HOUSES[c.house].n.toUpperCase():'GATE '+UNLOCK_STAGE[c.tier];const open=un&&!other;
  const tal=open&&p.lvl>=5&&p.tal?heroTalent(c.id,p.tal):null;
  return `<button class="ccard ${open?'':'lock'} ${ride?'ride':''} ${opts.big?'big':''}" style="--rc:${rc}" data-c="${c.id}">${ride?'<span class="tag">RIDING</span>':''}
   <span class="im">${pu?`<img src="${pu}" alt="">`:`<span class="pe">${c.e}</span>`}${open?`<span class="lv">LVL ${p.lvl}</span>`:`<span class="lk">${lockTxt}</span>`}</span>
   <span class="nm">${shortName(c)}</span>
   <span class="skrow">${c.sk.map((sk,i)=>skillIcon(sk,opts.big?26:20,open?p.sk[i]:0,{dim:!open})).join('')}<span class="skb tal ${tal?'':'off'}" style="--sc:#ffd54a;--px:${opts.big?26:20}px;width:${opts.big?26:20}px;height:${opts.big?26:20}px" title="${tal?tal.n:'Talent at level 5'}"><i>${tal?talEmoji(tal):'★'}</i></span></span>
   ${open?`<span class="ub"><i style="width:${p.lvl*10}%"></i></span>`:`<span class="rar">${rn}</span>`}</button>`;}
function towerCard(k){const D=TOWERS[k],open=towerOpen(k),tier=maxTowerLvl(),ups=UPG.filter(u=>u.g===k),own=ups.filter(u=>ACC.upg[u.id]).length,rc=(UGROUPS.find(g=>g[0]===k)||[])[3]||'#8a97a8';
  return `<button class="ccard ${open?'':'lock'}" style="--rc:${rc}" data-t="${k}"><span class="im">${towerIconHTML(k,Math.max(1,open?tier:1),64)}${open?`<span class="lv">TIER ${ROMAN[tier-1]}</span>`:`<span class="lk">GATE ${TOWER_UNLOCK[k]}</span>`}</span>
   <span class="nm">${D.n.split(' ')[0]}</span><span class="rar" style="--rc:${rc}">${own}/${ups.length} upgrades</span>${open?`<span class="ub"><i style="width:${ups.length?Math.round(100*own/ups.length):0}%"></i></span>`:''}</button>`;}
function spellCard(k){const S=SPELLS[k],open=cleared()>=S.at||k==='arrows';const ups=UPG.filter(u=>u.g==='power'&&((k==='fire'&&u.id==='cache')||(k==='reinf'&&u.id==='sworn')));const own=ups.filter(u=>ACC.upg[u.id]).length;const rc=k==='fire'?'#ff9a3c':k==='reinf'?'#8fd3ff':'#e3b661';
  const ic=k==='arrows'?'<svg viewBox="0 0 24 24" fill="none" stroke="#e3b661" stroke-width="1.8"><path d="M4 20 20 4M20 4h-6M20 4v6M8 20l-4-4M12 12l-4 4"/></svg>':k==='fire'?'<svg viewBox="0 0 24 24" fill="#ff9a3c"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3-1-6 1-9z"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="#8fd3ff" stroke-width="1.8"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>';
  return `<button class="ccard ${open?'':'lock'}" style="--rc:${rc}" data-s="${k}"><span class="im" style="padding:10px;box-sizing:border-box">${ic}${open?`<span class="lv">${S.cd}s</span>`:`<span class="lk">GATE ${S.at}</span>`}</span>
   <span class="nm">${S.n}</span><span class="rar">${own}/${ups.length||1} upgrades</span></button>`;}
function hubCollection(sub){sub=sub||'deck';const mine=CHAMPS.filter(c=>c.house===ACC.house),others=CHAMPS.filter(c=>c.house!==ACC.house);
  const tabs=`<div class="subtabs">${[['deck','Loadout'],['heroes','Champions'],['towers','Towers'],['spells','Spells']].map(([k,n])=>`<button class="${k===sub?'on':''}" data-sub="${k}">${n}</button>`).join('')}</div>`;
  let body='';
  if(sub==='deck'){const c=CBY[ACC.sel];
    body=`<div class="hh"><h2>Battle loadout</h2><small>What rides with you</small></div>
    <div class="deckrow">${champCard(c,{})}${['arrows','fire','reinf'].map(spellCard).join('')}</div>
    <div class="hh"><h2>Towers</h2><small>${TKEYS.filter(towerOpen).length}/${TKEYS.length} open · tier ${ROMAN[maxTowerLvl()-1]}</small></div>
    <div class="cgrid c3">${TKEYS.map(towerCard).join('')}</div>`;}
  else if(sub==='heroes'){body=`<div class="hh"><h2>House ${HOUSES[ACC.house].n}</h2><small>${mine.filter(c=>unlocked(null,c)).length}/${mine.length} found</small></div><div class="cgrid">${mine.map(c=>champCard(c)).join('')}</div>
    <div class="hh" style="margin-top:12px"><h2>Other houses</h2><small>ride for them from another seat</small></div><div class="cgrid">${others.map(c=>champCard(c)).join('')}</div>`;}
  else if(sub==='towers'){body=`<div class="hh"><h2>Towers</h2><small>${TKEYS.filter(towerOpen).length}/${TKEYS.length} open · ${GOLD_SVG.replace('<svg','<svg style="width:12px;height:12px;vertical-align:-2px"')} ${fmtN(goldOf())} gold</small></div><div class="cgrid c3">${TKEYS.map(towerCard).join('')}</div>
    <p class="m" style="font-size:11.5px;margin-top:8px">Tap a tower to buy its upgrades with gold. Tiers open with gates held: II at 2, III at 4, IV at 7, V at 10.</p>`;}
  else{body=`<div class="hh"><h2>Spells of the house</h2><small>the second row in battle</small></div><div class="cgrid c3">${['arrows','fire','reinf'].map(spellCard).join('')}</div>
    <div class="cgrid c3" style="margin-top:10px">${UPG.filter(u=>u.g==='power').map(u=>`<button class="ccard ${ACC.upg[u.id]?'':'lock'}" style="--rc:#b47cff" data-u="1"><span class="im" style="font-size:26px">${u.e}</span><span class="nm">${u.n}</span><span class="rar">${ACC.upg[u.id]?'owned':fmtN(ECON.upgCost(u))+' gold'}</span></button>`).join('')}</div>`;}
  return tabs+body;}
function hubCollectionBind(sub){
  bind('.subtabs button',b=>showHub('coll',b.dataset.sub));
  bind('.ccard[data-c]',b=>{const c=CBY[b.dataset.c];if(c.house!==ACC.house){SFX.play('tap',40);return;}showHeroRoom(c.id);});
  bind('.ccard[data-t]',()=>showUpgrades());bind('.ccard[data-s]',()=>showUpgrades());bind('.ccard[data-u]',()=>showUpgrades());
}
/* ---------- SHOP ---------- */
function priceHTML(p){if(p.gold)return `${GOLD_SVG}${fmtN(p.gold)}`;if(p.gems)return `${GEM_SVG}${p.gems}`;return 'FREE';}
function canPay(p){if(p.gold)return goldOf()>=p.gold;if(p.gems)return ACC.gems>=p.gems;return true;}
function hubShop(){const free=freeChestReady(),ft=fmtT(86400000-(Date.now()-(ACC.freeChestAt||0)));
  const D=dealsState(),deals=genDeals(),dt=fmtT(msToDeals());
  const RC=['#8a97a8','#4fb0ff','#b47cff','#e3b661'];
  const dealHTML=(d,i)=>{const bought=D.bought[i],unl=D.unl[i],freeSlot=i===0;
    if(!unl)return `<div class="sitem deal lock" style="--rc:#5a6c85"><span class="badge" style="background:#5a6c85">LOCKED</span><span class="ch dic"><svg viewBox="0 0 24 24" fill="#c9d1da" stroke="#0b1a2e" stroke-width="1.4"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none"/><circle cx="12" cy="15.5" r="1.6" fill="#0b1a2e"/></svg></span><b>Deal ${i+1}</b><small>${['','','','A third pick','A fourth pick','The last pick'][i]} of this rotation</small><button data-unl="${i}" ${ACC.gems>=ECON.unlock[i]?'':'disabled'}>${GEM_SVG}${ECON.unlock[i]} · UNLOCK</button></div>`;
    return `<div class="sitem deal ${bought?'done':''}" style="--rc:${RC[d.r]}">${freeSlot&&!bought?'<span class="badge">FREE</span>':''}<span class="ch dic">${d.ic}</span><b>${esc(d.n)}</b><small>${esc(d.s)}</small><button data-deal="${i}" ${bought||!canPay(d.price)?'disabled':''} class="${freeSlot?'free':''}">${bought?'✔ TAKEN':priceHTML(d.price)}</button></div>`;};
  const chest=(t,extra)=>{const T=CHEST_TIERS[t];return `<div class="sitem" style="--rc:${T.trim}">${extra||''}<span class="ch">${chestSVG(t)}</span><b>${T.n}</b><small><i style="color:${T.trim};font-style:normal;font-weight:900">${T.sub}</i> · ${T.gold[0]}–${T.gold[1]} gold · ${T.gems[0]}–${T.gems[1]} dragonglass · ${T.cards} card${T.cards>1?'s':''}${T.rare?` (${T.rare} rare+)`:''}</small>
    ${t==='wood'?`<button class="free" data-buy="wood" ${free?'':'disabled'}>${free?'FREE':ft.str}</button>`:`<button data-buy="${t}" ${ACC.gems>=T.price?'':'disabled'}>${GEM_SVG}${T.price}</button>`}</div>`;};
  return `<div class="hh"><h2>Daily deals</h2><small>new deals in <b id="dealCd">${dt.h}:${dt.m}:${dt.s}</b></small></div>
  <p class="shopnote">Six deals every 6 hours. The first is always free · unlock the locked ones with dragonglass.</p>
  <div class="shopgrid deals">${deals.map(dealHTML).join('')}</div>
  <div class="hh" style="margin-top:14px"><h2>Chests</h2><small>${GEM_SVG} ${ACC.gems} dragonglass</small></div>
  <div class="shopgrid">${chest('wood',free?'<span class="badge">DAILY FREE</span>':'<span class="badge" style="background:#5a6c85;color:#fff">DAILY</span>')}${chest('iron')}${chest('valyrian')}${chest('dragon')}</div>
  <div class="hh" style="margin-top:14px"><h2>Gold for dragonglass</h2><small>${GOLD_SVG} ${fmtN(goldOf())} gold</small></div>
  <div class="shopgrid three">${ECON.exchange.map(([g,gd],i)=>`<div class="sitem" style="--rc:#e3b661"><span class="ch dic">${GOLD_SVG}</span><b>${['Purse','Chest','Hoard'][i]}</b><small>+${gd.toLocaleString()} gold${i===2?' · best value':i===1?' · +7%':''}</small><button data-xch="${i}" ${ACC.gems>=g?'':'disabled'}>${GEM_SVG}${g}</button></div>`).join('')}</div>
  <div class="hh" style="margin-top:14px"><h2>Dragonglass</h2><small>coming with Telegram Stars</small></div>
  <div class="shopgrid three">${[[150,'Pouch'],[400,'Chest'],[1200,'Hoard']].map(([n,t])=>`<div class="sitem soon"><span class="ch dic">${GEM_SVG}</span><b>${t}</b><small>+${n} dragonglass</small><button disabled>SOON</button></div>`).join('')}</div>`;}
function hubShopBind(){
  const tick=()=>{if(CLOUD.screen!=='hub:shop')return;const el=$('#dealCd');if(!el)return;const t=fmtT(msToDeals());el.textContent=t.h+':'+t.m+':'+t.s;if(msToDeals()<1000){showHub('shop');return;}setTimeout(tick,1000);};tick();
  bind('[data-buy]',b=>{const t=b.dataset.buy,T=CHEST_TIERS[t];if(t==='wood'){if(!freeChestReady())return;ACC.freeChestAt=Date.now();}else{if(ACC.gems<T.price)return;ACC.gems-=T.price;}persist();openChest(t,()=>showHub('shop'));});
  bind('[data-deal]',b=>{const i=+b.dataset.deal;const d=genDeals()[i];if(buyDeal(i)){SFX.play(d.k==='gold'||d.k==='gems'?'buy':'card');flyReward(b,d);showHub('shop');}else SFX.play('deny');});
  bind('[data-unl]',b=>{if(unlockDeal(+b.dataset.unl)){SFX.play('unlock');showHub('shop');}else SFX.play('deny');});
  bind('[data-xch]',b=>{const [g,gd]=ECON.exchange[+b.dataset.xch];if(ACC.gems<g){SFX.play('deny');return;}ACC.gems-=g;addGold(gd);SFX.play('buy');persist();flyReward(b,{k:'gold',n:'+'+gd+' gold'});showHub('shop');});
}
/* a little "+N" toast that floats up from a purchase */
function flyReward(from,d){try{const r=from.getBoundingClientRect(),el=document.createElement('div');el.className='flyup';el.innerHTML=(d.k==='gold'?GOLD_SVG:d.k==='gems'?GEM_SVG:'')+'<span>'+esc(d.k==='gold'||d.k==='gems'?(d.s||d.n).replace(/ (gold|dragonglass)$/,''):d.n)+'</span>';el.style.left=(r.left+r.width/2)+'px';el.style.top=r.top+'px';document.body.appendChild(el);setTimeout(()=>el.remove(),1300);}catch(e){}}
/* ---------- chests ---------- */
function rollChest(t){const T=CHEST_TIERS[t],out=[],mine=CHAMPS.filter(c=>c.house===ACC.house&&unlocked(null,c));const rnd=n=>Math.floor(Math.random()*n);
  const gold=T.gold[0]+rnd(T.gold[1]-T.gold[0]+1);addGold(gold);out.push({k:'gold',n:'Gold',s:'+'+gold,r:0});
  const gems=T.gems[0]+rnd(T.gems[1]-T.gems[0]+1);ACC.gems+=gems;out.push({k:'gems',n:'Dragonglass',s:'+'+gems,r:0});
  const pool=[
    {w:30,r:1,f:()=>{if(!mine.length)return null;const c=mine[rnd(mine.length)],p=cprog(null,c.id);if(p.lvl>=10)return null;p.lvl++;return{k:'champ',c,n:c.n,s:'Level '+p.lvl,r:1};}},
    {w:22,r:2,f:()=>{if(!mine.length)return null;const c=mine[rnd(mine.length)],p=cprog(null,c.id);const i=[0,1,2].filter(j=>p.sk[j]<3);if(!i.length)return null;const j=i[rnd(i.length)];p.sk[j]++;return{k:'skill',c,n:SK[c.sk[j]].n,s:shortName(c)+' · rank '+p.sk[j],r:2};}},
    {w:16,r:1,f:()=>{ACC.online.attempts=(ACC.online.attempts||0)+1;return{k:'att',n:'Hold attempt',s:'+1 today',r:1};}},
    {w:12,r:2,f:()=>{ACC.online.doorBonus+=100;return{k:'door',n:'Gate reinforcement',s:'+100 gate hp in Hold',r:2};}},
    {w:10,r:2,f:()=>{ACC.online.goldBonus+=60;return{k:'bank',n:'Iron Bank credit',s:'+60 gold in Hold',r:2};}},
    {w:10,r:2,f:()=>{const g=T.gold[1];addGold(g);return{k:'gold',n:'Bag of gold',s:'+'+g,r:2};}},
    {w:8,r:3,f:()=>{ACC.xpBonus=(ACC.xpBonus||0)+120;return{k:'xp',n:'Raven of renown',s:'+120 account XP',r:3};}},
    {w:6,r:3,f:()=>{const u=UPG.filter(u=>!ACC.upg[u.id]);if(!u.length)return null;const x=u[rnd(u.length)];ACC.upg[x.id]=1;return{k:'upg',u:x,n:x.n,s:x.s,r:3};}},
  ];
  for(let i=0;i<T.cards;i++){const needRare=i<T.rare;let tries=0,it=null;while(!it&&tries++<12){const cand=pool.filter(p=>needRare?p.r>=Math.min(3,1+i):true);let tot=cand.reduce((s,p)=>s+p.w,0),r=Math.random()*tot;for(const p of cand){r-=p.w;if(r<=0){it=p.f();break;}}}
    if(!it){addGold(100);it={k:'gold',n:'Gold',s:'+100',r:0};}out.push(it);}
  return out;}
function openChest(t,done){
  const T=CHEST_TIERS[t];let el=$('#cer');if(!el){el=document.createElement('div');el.id='cer';document.getElementById('app').appendChild(el);}
  el.className='';el.innerHTML=`<h2>${T.n}</h2><div class="cchest" id="cch"><div class="glow" id="cglow"></div><div class="cimg" id="cimg">${chestSVG(t)}</div></div><div class="tap" id="ctap">TAP TO OPEN</div><div class="cbig" id="cbig"></div><div class="rw" id="crw"></div><button class="collect" id="ccol">COLLECT</button>`;
  let opened=false;const rewards=rollChest(t);persist();
  const RC=['#8a97a8','#4fb0ff','#b47cff','#e3b661'],RN=['Common','Rare','Epic','Legendary'];
  const icon=r=>r.k==='champ'||r.k==='skill'?(CHAMP_ART[r.c.id+'_portrait']?`<img src="${CHAMP_ART[r.c.id+'_portrait']}" alt="">`:`<span style="font-size:40px">${r.c.e}</span>`):r.k==='gems'?GEM_SVG:r.k==='gold'?GOLD_SVG:r.k==='upg'?`<span style="font-size:44px">${r.u.e}</span>`:r.k==='att'?HUB_ICON.hold:r.k==='door'?'<svg viewBox="0 0 24 24" fill="none" stroke="#e3b661" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M8 5v5M15 5v5M6 10v5M12 10v5M18 10v5M9 15v4M15 15v4"/></svg>':r.k==='bank'?'<svg viewBox="0 0 24 24" fill="none" stroke="#e3b661" stroke-width="1.6"><ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4"/></svg>':STAR_SVG;
  const reveal=()=>{if(opened)return;opened=true;const ch=$('#cch');ch.classList.add('shake');$('#ctap').textContent='';SFX.play('chest');
    setTimeout(()=>{ch.classList.remove('shake');ch.classList.add('opened');$('#cimg').innerHTML=chestSVG(t,true);$('#cglow').classList.add('on');SFX.play('chestopen');for(let i=0;i<24;i++){const s=document.createElement('span');s.className='sparkle';s.style.left='50%';s.style.top='40%';s.style.setProperty('--dx',(Math.random()*300-150)+'px');s.style.setProperty('--dy',(Math.random()*240-200)+'px');ch.appendChild(s);}
      /* one reward at a time: it pops up big in the middle, then shrinks into the row below */
      const cardHTML=r=>`<span class="im">${icon(r)}</span><b>${esc(r.n)}</b><small>${esc(r.s)}</small><span class="rar" style="--rc:${RC[r.r]}">${RN[r.r]}</span>`;
      const mk=(r,cls)=>{const d=document.createElement('div');d.className='rcard '+cls;d.style.setProperty('--rc',RC[r.r]);d.style.setProperty('--rcg',RC[r.r]+'66');d.innerHTML=cardHTML(r);return d;};
      const PER=1150;
      rewards.forEach((r,i)=>{setTimeout(()=>{const big=$('#cbig');if(!big)return;big.innerHTML='';const d=mk(r,'big');big.appendChild(d);requestAnimationFrame(()=>d.classList.add('in'));SFX.play(r.r>=3?'legend':r.r>=2?'epic':'card',70);
          if(r.r>=2){for(let k=0;k<14;k++){const s=document.createElement('span');s.className='sparkle';s.style.left='50%';s.style.top='50%';s.style.setProperty('--dx',(Math.random()*260-130)+'px');s.style.setProperty('--dy',(Math.random()*260-130)+'px');big.appendChild(s);}}
          setTimeout(()=>{d.classList.add('out');const sm=mk(r,'sm');$('#crw').appendChild(sm);requestAnimationFrame(()=>sm.classList.add('in'));SFX.play('tap',40);if(i===rewards.length-1)setTimeout(()=>{$('#ccol').classList.add('in');SFX.play('collect');},250);},PER-260);},450+i*PER);});},1000);};
  $('#cch').addEventListener('click',reveal);$('#ctap').addEventListener('click',reveal);
  $('#ccol').addEventListener('click',()=>{if(!$('#ccol').classList.contains('in'))return;el.className='hidden';el.innerHTML='';done&&done();});
}
/* ---------- EVENTS ---------- */
function hubEvents(sub){sub=sub||'realms';const lb=cachedLb();const t=fmtT(msToMidnightUTC());
  const ev=[
    {k:'hold',live:true,n:'Daily Hold',s:`New map in ${t.h}h ${t.m}m · every realm and house counts`,st:onlineOpen()?'LIVE':'GATE '+ONLINE_AT,ic:HUB_ICON.hold},
    {k:'houses',live:false,n:'War of the Houses',s:'Seven banners, one crown a week. Standings below.',st:'SOON',ic:'<svg viewBox="0 0 24 24"><path d="M5 2.5h14v12l-7 5-7-5z" fill="#b33fb0" stroke="#3a1146" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 6l1.6 3.2 3.5.5-2.5 2.4.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.4 3.5-.5z" fill="#ffd54a" stroke="#7a4a10" stroke-width=".9"/></svg>'},
    {k:'season',live:false,n:'Season I — The Long Night',s:'14-day ladder with a reset and rewards for realm and house rank.',st:'SOON',ic:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#4fc0ff" stroke="#0b3a5a" stroke-width="1.6"/><circle cx="12" cy="12" r="6.5" fill="#dff3ff"/><path d="M12 8v4.2l3 1.8" fill="none" stroke="#0b3a5a" stroke-width="1.8" stroke-linecap="round"/></svg>'},
    {k:'onslaught',live:false,n:'Onslaught',s:'Same map, same waves — who clears them faster.',st:'SOON',ic:HUB_ICON.battle},
  ];
  const rows=realmStats().slice(0,10),top=Math.max(1,rows[0]?rows[0].waves:1);
  const hs=(lb&&lb.houses)||null;
  const houseRows=hs?hs.slice().sort((a,b)=>(b.waves||0)-(a.waves||0)||(b.stars||0)-(a.stars||0)).map((h,i)=>`<div class="standrow ${h.house===ACC.house?'me':''}"><span class="rk">${i+1}</span>${crest(h.house,22)}<span class="nm">House ${HOUSES[h.house]?HOUSES[h.house].n:h.house}<small>${h.players} defenders</small></span><span class="v">${(+h.waves||0).toLocaleString()} 🌊 · ${(+h.stars||0)} ⭐</span></div>`).join(''):'<p class="m" style="font-size:12px">House standings arrive with the next backend update.</p>';
  return `<div class="hh"><h2>Events</h2><small>${sbReady()?(lb?'live':'connecting…'):'offline'}</small></div>
  ${ev.map(e=>`<button class="evcard ${e.live?'live':'lock'}" data-ev="${e.k}"><span class="ic">${e.ic}</span><span class="tx"><b>${e.n}</b><small>${e.s}</small></span><span class="st">${e.st}</span></button>`).join('')}
  <div class="subtabs" style="margin-top:12px">${[['realms','Realms'],['houses','Houses'],['defenders','Defenders']].map(([k,n])=>`<button class="${k===sub?'on':''}" data-sub="${k}">${n}</button>`).join('')}</div>
  <div class="hpanel">${sub==='realms'?rows.map(r=>`<div class="standrow ${r.mine?'me':''}"><span class="rk">${r.rank}</span>${flag(r.c,24)}<span class="nm">${r.c}<small>${r.players} defenders</small></span><span class="v">${r.waves.toLocaleString()} 🌊</span></div>`).join('')+`<button class="btn sec" id="bAllRealms" style="margin-top:8px">All 193 realms</button>`
   :sub==='houses'?houseRows
   :((lb&&lb.top)||[]).slice(0,15).map((p,i)=>`<div class="standrow ${p.tg_id===CLOUD.tg_id?'me':''}"><span class="rk">${i+1}</span>${p.house&&HOUSES[p.house]?crest(p.house,22):''}<span class="nm">${esc(p.name)}<small>${(LANGS[p.realm]||LANGS[0]).c}</small></span><span class="v">${p.waves} 🌊 · ${p.stars} ⭐</span></div>`).join('')||'<p class="m" style="font-size:12px">No defenders yet — be the first.</p>'}</div>`;}
function hubEventsBind(sub){
  if(sbReady()&&(!CLOUD.lb||Date.now()-CLOUD.lbAt>60000))fetchLeaderboard(true).then(r=>{if(r&&CLOUD.screen==='hub:events')showHub('events',sub);});
  bind('.subtabs button',b=>showHub('events',b.dataset.sub));
  bind('.evcard',b=>{if(b.dataset.ev==='hold')showHub('hold');else SFX.play('tap',40);});
  const ar=$('#bAllRealms');if(ar)ar.addEventListener('click',()=>showRealms(false));
}
/* ---------- HOLD ---------- */
function hubHold(){rollDay();const gm=genDaily(hash32(dayKeyUTC())),runs=ACC.online.runs||[],best=runs.length?Math.max(...runs.map(r=>r.waves)):0,open=onlineOpen(),lb=cachedLb(),t=fmtT(msToMidnightUTC());
  const today=(lb&&lb.today)||null;const me=(lb&&lb.myday)||null;
  const list=(today||((lb&&lb.top)||[])).slice(0,10);
  return `<div class="holdhead"><b>HOLD THE DOOR</b><small>daily siege · ${gm.mod.e} ${gm.mod.n} — ${gm.mod.desc}</small></div>
  <div class="cd"><div><b id="cdH">${t.h}</b><small>hours</small></div><div><b id="cdM">${t.m}</b><small>min</small></div><div><b id="cdS">${t.s}</b><small>sec</small></div></div>
  <p class="holdnote">until the next map · the waves never stop · every realm and house counts</p>
  ${open?'':`<div class="lockbanner"><span style="font-size:22px">🔒</span><span><b>Opens after gate ${ONLINE_AT}</b><br>Hold ${ONLINE_AT} gates in the campaign to join the daily siege. You can already watch the standings.</span></div>`}
  <div class="holdstats"><div><b>${best||'—'}</b><small>best today</small></div><div><b>${ACC.stats.onlineBest||0}</b><small>all-time</small></div><div><b>${ACC.online.attempts}</b><small>attempts left</small></div></div>
  <button class="holdbtn" id="bHold" ${open&&ACC.online.attempts>0?'':'disabled'}>${open?(ACC.online.attempts>0?'HOLD THE DOOR':'NO ATTEMPTS LEFT'):'LOCKED'}<small>${open?(ACC.online.attempts>0?'ENDLESS WAVES · '+flag(lang().c,12)+' '+lang().c.toUpperCase():'BUY ONE IN THE SHOP · 40 DRAGONGLASS'):'GATE '+ONLINE_AT+' FIRST'}</small></button>
  ${open&&ACC.online.attempts<=0?`<button class="btn sec" id="bBuyAtt" style="margin-top:8px">${GEM_SVG.replace('<svg','<svg style="width:12px;height:12px;vertical-align:-2px"')} Buy an attempt · 40</button>`:''}
  <div class="hh" style="margin-top:12px"><h2>${today?"Today's defenders":'Top defenders'}</h2><small>${me&&me.rank?'your rank #'+me.rank:(sbReady()?'live':'offline')}</small></div>
  <div class="hpanel">${list.map((p,i)=>`<div class="standrow ${p.tg_id===CLOUD.tg_id?'me':''}"><span class="rk">${i+1}</span>${p.house&&HOUSES[p.house]?crest(p.house,22):''}<span class="nm">${esc(p.name)}<small>${(LANGS[p.realm]||LANGS[0]).c}</small></span><span class="v">${p.waves} 🌊</span></div>`).join('')||'<p class="m" style="font-size:12px">Nobody has held the door today. Be the first.</p>'}</div>
  <button class="btn sec" id="bHoldHelp" style="margin-top:4px">How the Hold works</button>`;}
function hubHoldBind(){
  const tick=()=>{if(CLOUD.screen!=='hub:hold')return;const t=fmtT(msToMidnightUTC());const h=$('#cdH');if(!h)return;h.textContent=t.h;$('#cdM').textContent=t.m;$('#cdS').textContent=t.s;setTimeout(tick,1000);};tick();
  if(sbReady()&&(!CLOUD.lb||Date.now()-CLOUD.lbAt>60000))fetchLeaderboard(true).then(r=>{if(r&&CLOUD.screen==='hub:hold')showHub('hold');});
  const go=()=>{if(!onlineOpen()||ACC.online.attempts<=0)return;startGame({mode:'online'});};
  $('#bHold').addEventListener('click',()=>{if(!ACC.holdTut){holdTutorial(go);}else go();});
  const ba=$('#bBuyAtt');if(ba)ba.addEventListener('click',()=>{if(ACC.gems<40)return;ACC.gems-=40;ACC.online.attempts++;persist();showHub('hold');});
  $('#bHoldHelp').addEventListener('click',()=>holdTutorial(()=>showHub('hold')));
  if(onlineOpen()&&!ACC.holdTut&&!ACC.holdIntro){ACC.holdIntro=1;persist();holdTutorial(()=>showHub('hold'));}
}
function holdTutorial(done){const c=CBY[ACC.sel],pu=CHAMP_ART[c.id+'_portrait'],L=lang();
  const pages=[['The daily siege','Every day at midnight (UTC) a new map appears — the same one for every defender in the world. The waves never stop. The score is how many you hold.'],
   ['Your banner',`Every wave you survive is added to <b>${L.c}</b> and to <b>House ${HOUSES[ACC.house].n}</b>. Realms and houses are ranked against each other — check Events.`],
   ['Three attempts',`You get <b>${HOLD_ATTEMPTS} attempts</b> a day. Only your <b>best</b> run of the day is written to the realm and the house — the other runs cost you nothing.`],
   ['Hold the door','Build fast, keep your champion near the gate, save Dracarys for the giants. When the door falls, your waves are written to the realm.']];
  let i=0;let el=document.createElement('div');el.className='tutm';document.getElementById('app').appendChild(el);
  const render=()=>{el.innerHTML=`<div class="bx">${pu?`<img class="pt" src="${pu}" alt="">`:''}<h3>${pages[i][0]}</h3><p>${pages[i][1]}</p><div class="dots">${pages.map((_,j)=>j===i?'●':'○').join('')}</div><button id="tutN">${i<pages.length-1?'NEXT':'TO THE WALL'}</button></div>`;
    $('#tutN').addEventListener('click',()=>{SFX.play('tap',60);i++;if(i>=pages.length){el.remove();ACC.holdTut=1;persist();done&&done();}else render();});};
  render();}
