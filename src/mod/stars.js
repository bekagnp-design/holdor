/* =========================== TELEGRAM STARS (v1.0.60) ===========================
   Dragonglass packs and the Starter pack are paid with Telegram Stars. The app only asks the server for an invoice
   (Edge Function `stars`), opens it in Telegram (WebApp.openInvoice), and then waits until the server says "paid"
   (pay_status) and reads its balance. Nothing is credited here: Telegram tells the server, the server credits the seat
   (backend v9: payments, ledger reason 'stars'). Guests and seats without the server cannot buy. */
const STARS_SHOP={
 gems_s:{stars:50,gems:150,n:'Pouch',title:'Pouch of dragonglass',desc:'150 dragonglass for your seat.'},
 gems_m:{stars:125,gems:400,n:'Chest',title:'Chest of dragonglass',desc:'400 dragonglass for your seat.'},
 gems_l:{stars:350,gems:1200,n:'Hoard',title:'Hoard of dragonglass',desc:'1200 dragonglass for your seat.'},
 pass:{stars:250,grant:'pass',n:'Season Pass',title:'Season Pass',desc:'Premium rewards on every tier of this month\'s season, for your seat.'},
 vip:{stars:200,grant:'vip',days:30,n:'VIP · 30 days',title:'VIP · 30 days',desc:'25 dragonglass a day and 25% more season points for 30 days, for your seat.'},
 starter:{stars:75,once:true,gems:300,gold:5000,books:{'b:r':3},n:'Starter pack',title:'Starter pack',desc:'300 dragonglass, 5000 gold and 3 Rare books for your seat. Once per seat.'},
};
const STARS_KEY='holdor_pay';
const STARS={starter:null,starterSeat:-1,busy:false,pending:null};
function starsUrl(){return SB.url+'/functions/v1/stars';}
function starsCan(){return !!(ecoOn()&&TG&&typeof TG.openInvoice==='function');}
function starsShopLoad(){if(!ecoOn()||STARS.starterSeat===seatNo())return;STARS.starterSeat=seatNo();
  ecoRpc('pay_shop',{seat:seatNo()},8000).then(r=>{STARS.starter=!!(r&&r.starter);ecoRedraw();}).catch(()=>{STARS.starterSeat=-1;});}
function starsPack(k,big){const S=STARS_SHOP[k],can=starsCan();
  return `<div class="sitem ${big?'starter':''}" style="--rc:${k==='starter'?'#ffd54a':'#4fb0ff'}">${k==='starter'?'<span class="badge">ONCE</span>':''}<span class="ch dic">${GEM_SVG}</span><b>${S.n}</b>
   <small>+${S.gems} dragonglass${S.gold?` · ${fmtN(S.gold)} gold`:''}${S.books?' · 3 Rare books':''}</small>
   <button class="stbtn" data-stars="${k}" ${can?'':'disabled'}>⭐ ${S.stars}</button></div>`;}
function starsShopHTML(){
  if(ecoOn())starsShopLoad();
  const note=starsCan()?'':`<p class="shopnote">${ecoOn()?'Open the game in an up-to-date Telegram to pay with Stars.':'Payments work on a seat signed in through Telegram — the server credits it.'}</p>`;
  return `<div class="hh" style="margin-top:14px"><h2>Dragonglass</h2><small>pay with Telegram Stars ⭐</small></div>${note}
  <div class="shopgrid three">${['gems_s','gems_m','gems_l'].map(k=>starsPack(k)).join('')}</div>`;}
function starsStarterHTML(){
  if(!ecoOn()||STARS.starter!==false)return '';
  return `<div class="hh" style="margin-top:6px"><h2>Starter pack</h2><small>once per seat</small></div><div class="shopgrid">${starsPack('starter',true)}</div>`;}
async function starsInvoice(sku){
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),15000);
  try{const r=await fetch(starsUrl(),{method:'POST',headers:{'apikey':SB.key,'Content-Type':'application/json'},body:JSON.stringify({op:'invoice',token:CLOUD.token,seat:seatNo(),sku}),signal:ctl.signal});
    const t=await r.text();let j=null;try{j=t?JSON.parse(t):null;}catch(e){}
    if(!r.ok||!j||!j.link)throw new Error((j&&(j.error||j.message))||('http '+r.status));return j;}
  finally{clearTimeout(to);}}
function starsSave(list){try{localStorage.setItem(STARS_KEY,JSON.stringify(list));}catch(e){}}
function starsLoad(){try{const j=JSON.parse(localStorage.getItem(STARS_KEY)||'[]');return Array.isArray(j)?j:[];}catch(e){return [];}}
async function starsBuy(sku){
  const S=STARS_SHOP[sku];if(!S||STARS.busy)return;
  if(!starsCan()){SFX.play('deny');ecoModal('⭐ Telegram Stars','Payments need a seat signed in through Telegram and a recent Telegram app.',[{t:'OK'}]);return;}
  STARS.busy=true;ecoWait(true);let r;
  try{if(!(await ecoLane(async()=>{await ecoSyncRaw();return true;})))throw new Error('offline');r=await starsInvoice(sku);}
  catch(e){STARS.busy=false;ecoWait(false);const m=ecoMsg(e);
    ecoModal('⭐ The invoice could not be made',/already bought/.test(m)?'The Starter pack is already yours on this seat.':ecoNet(m)||/abort/i.test(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,140)),[{t:'OK',f:()=>{if(/already bought/.test(m)){STARS.starter=true;}ecoRedraw();}}]);return;}
  ecoWait(false);const seat=seatNo(),item={id:r.id,sku,seat,t:Date.now()};
  starsSave(starsLoad().concat([item]).slice(-10));
  try{TG.openInvoice(r.link,st=>{STARS.busy=false;
    if(st==='paid')starsWait(item);
    else if(st==='cancelled'){starsDrop(item.id);ecoToast('Payment cancelled');}
    else if(st==='failed'){starsDrop(item.id);ecoModal('⭐ The payment failed','Telegram could not take the Stars. Nothing was charged.',[{t:'OK'}]);}
    else starsWait(item);});}
  catch(e){STARS.busy=false;starsDrop(item.id);ecoModal('⭐ Telegram would not open the invoice',esc(ecoMsg(e).slice(0,120)),[{t:'OK'}]);}}
function starsDrop(id){starsSave(starsLoad().filter(x=>x.id!==id));}
/* after "paid": the server hears it from Telegram a moment later — ask until it says so, then read the balance */
async function starsWait(item,quiet){
  if(!quiet)ecoWait(true);let st='pending';
  for(let i=0;i<(quiet?1:30)&&ecoOn()&&seatNo()===item.seat;i++){
    try{const r=await ecoRpc('pay_status',{id:item.id},8000);st=r.status;}catch(e){}
    if(st!=='pending')break;await new Promise(r=>setTimeout(r,1500));}
  if(!quiet)ecoWait(false);
  if(st==='paid'){starsDrop(item.id);const S=STARS_SHOP[item.sku];if(item.sku==='starter')STARS.starter=true;
    await ecoRefresh();try{SFX.play('buy');}catch(e){}
    if(S&&S.grant){ecoToast('⭐ Thank you! '+S.n+' is active',true);if(typeof seasonLoad==='function')seasonLoad(true).then(()=>{if(CLOUD.screen==='season')showSeason();});return;}
    ecoToast(`⭐ Thank you! +${S?S.gems:''} dragonglass`+(S&&S.gold?' · +'+fmtN(S.gold)+' gold':''),true);ecoRedraw();return;}
  if(st==='failed'||st==='orphan'||st==='refunded'){starsDrop(item.id);ecoModal('⭐ The payment was not credited','The server could not credit this payment ('+st+'). Write to the game\'s chat — the Stars will be returned.',[{t:'OK'}]);return;}
  if(!quiet)ecoModal('⭐ Payment received','Telegram has your payment; the server is still confirming it. Your dragonglass will appear in a moment — open the shop again.',[{t:'OK'}]);}
/* an invoice paid while the app was closed or slow: ask once when a seat is entered */
function starsResume(){const list=starsLoad().filter(x=>Date.now()-x.t<86400000&&x.seat===seatNo());starsSave(starsLoad().filter(x=>Date.now()-x.t<86400000));
  for(const x of list)starsWait(x,true);}
