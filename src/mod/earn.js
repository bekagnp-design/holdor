/* =========================== EARN — the estate + the two-day events (v1.0.74, backend v18) ===========================
   The Earn tab (it took the place of Events in the bottom bar). Nine buildings open with the ACCOUNT LEVEL and are built and upgraded with
   gold; each level costs 1.8× the one before and adds only half of the first level's income, so the income is a small extra (the first
   level pays back in about 40 hours, higher levels in hundreds), collected by hand, and it stops piling up after 3 hours. Everything shown
   is what the server sends. Events are no tab any more: two-day windows (Mon–Tue Builders' Boom, Fri–Sat Duel Cup) pop up once with a
   countdown, and a small badge on the home island brings the popup back. The schedule below is the server's rule (ev_at) in JavaScript. */
const EARN={st:null,at:0,seat:-1,busy:false};
const EVT_KIND={boom:{n:"Builders' Boom",e:'🔥',d:'Estate income +50 % for the hours that fall inside these two days.',go:'To the Estate',f:()=>showHub('earn')},
                cup:{n:'Duel Cup',e:'🏆',d:'Ranked duel gifts are doubled for these two days.',go:'To the Duel',f:()=>showDuel()}};
/* the same rule as ev_at() in backend/holdor_v18.sql: Mon–Tue boom, Wed–Thu the cup is next, Fri–Sat cup, Sun the boom is next (UTC) */
function evAt(ms){const d=new Date(ms),dow=((d.getUTCDay()+6)%7)+1,day0=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()),DAY=86400000;let kind,active,t0;
  if(dow<=2){kind='boom';active=true;t0=day0-(dow-1)*DAY;}else if(dow===5||dow===6){kind='cup';active=true;t0=day0-(dow-5)*DAY;}
  else if(dow<=4){kind='cup';active=false;t0=day0+(5-dow)*DAY;}else{kind='boom';active=false;t0=day0+DAY;}
  return{kind,active,t0,t1:t0+2*DAY};}
function evLeft(s){s=Math.max(0,Math.floor(s/1000));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;
  return (d?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');}
function evBadgeHTML(){if(!ACC||!ACC.tut)return '';const e=evAt(Date.now()),K=EVT_KIND[e.kind],t=e.active?e.t1-Date.now():e.t0-Date.now();
  return `<button class="evbadge ${e.active?'on':''}" id="evBadge" data-t="${e.active?e.t1:e.t0}" data-a="${e.active?1:0}"><span>${K.e}</span><b>${K.n}</b><em>${e.active?'ends in':'in'} ${evLeft(t)}</em></button>`;}
function evBadgeTick(){const b=document.getElementById('evBadge');if(b){const t=+b.dataset.t-Date.now();const em=b.querySelector('em');if(em)em.textContent=(b.dataset.a==='1'?'ends in ':'in ')+evLeft(t);}
  const c=document.getElementById('evCd');if(c){const e=evAt(Date.now());c.textContent=(e.active?'ends in ':'starts in ')+evLeft(e.active?e.t1-Date.now():e.t0-Date.now());}
  if(document.getElementById('evBadge')||document.getElementById('evCd'))setTimeout(evBadgeTick,1000);}
function evBadgeBind(){const b=document.getElementById('evBadge');if(!b)return;b.addEventListener('click',()=>{SFX.play('tap',60);evPopup(true);});evBadgeTick();}
/* the popup: once per event window, only over the home screen, never over a tutorial, a tour or another popup */
function evPopup(force){const e=evAt(Date.now()),K=EVT_KIND[e.kind];if(!ACC||!ACC.tut)return;
  if(!force&&!e.active)return;
  ecoModal(`${K.e} ${K.n}`,`<div class="evpop"><div class="evcd" id="evCd">${e.active?'ends in':'starts in'} ${evLeft(e.active?e.t1-Date.now():e.t0-Date.now())}</div><p>${K.d}</p>${!ecoOn()?'<small>Needs a seat signed in through Telegram.</small>':''}</div>`,
    [{t:K.go,f:()=>K.f()},{t:'Later'}]);evBadgeTick();}
function evPopupCheck(){if(!ACC||!ACC.tut||G.state==='play'||G.tut||(typeof COACH!=='undefined'&&COACH.on)||CLOUD.screen!=='hub:battle')return;
  if(document.querySelector('#ecoModal.on')||document.querySelector('#cer:not(.hidden)'))return;
  const e=evAt(Date.now());if(!e.active)return;const key='holdor_ev',mark=e.kind+':'+e.t0;
  try{if(localStorage.getItem(key)===mark)return;localStorage.setItem(key,mark);}catch(x){}
  evPopup(false);}
/* ---------- the estate ---------- */
function earnOn(){return !!(ecoOn()&&ACC&&ACC.tut);}
function earnLoad(force){if(!ecoOn())return Promise.resolve(null);
  if(!force&&EARN.st&&EARN.seat===seatNo()&&Date.now()-EARN.at<8000)return Promise.resolve(EARN.st);
  const seat=seatNo();
  return ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('estate_state',{seat},9000);if(seat===seatNo()){EARN.st=r;EARN.at=Date.now();EARN.seat=seat;}return r;}).catch(e=>{ECO.err=ecoMsg(e);return null;});}
function earnReady(){const s=EARN.st;return !!(s&&EARN.seat===seatNo()&&s.pending>0&&s.pending>=s.per_hour*s.cap_h*0.9);}
function earnCard(i,gold){const max=i.lvl>=i.max,pay=!max&&i.next_income>i.income?Math.round(i.cost/(i.next_income-i.income)):0;
  const foot=max?'<span class="ec mx">MAX</span>':i.open?`<span class="ec ${gold>=i.cost?'':'poor'}">🪙 ${fmtN(i.cost)}</span>`:`<span class="ec lk">🔒 level ${i.need}</span>`;
  return `<button class="ebld ${i.lvl?'own':''} ${!max&&!i.open?'lock':''}" data-b="${i.id}"><span class="ei">${i.e}</span><b>${esc(i.n)}</b><small>${i.lvl?`Lv ${i.lvl} · +${fmtN(i.income)}/h`:`opens at level ${i.unlock}`}</small>${foot}</button>`;}
function hubEarn(){
  const head=`<div class="hh"><h2>Estate</h2><small>a little gold, by the hour</small></div>`;
  if(!earnOn())return head+`<p class="m">${ecoOn()?'Finish the tutorial battle first.':'The estate is kept by the server — it needs a seat signed in through Telegram.'}</p>`;
  const s=EARN.st&&EARN.seat===seatNo()?EARN.st:null;
  if(!s)return head+'<p class="m">⏳ asking the server…</p>';
  const e=s.event,K=EVT_KIND[e.kind],gold=goldOf();
  const strip=e.kind==='boom'&&e.active?`<div class="evstrip on">🔥 Builders' Boom — income +${e.boom_pct}% until the end of the day after tomorrow</div>`:'';
  return head+`<div class="collectbox"><div class="ch1">${GOLD_SVG}<b>${fmtN(s.pending)}</b></div><small>${s.per_hour?`+${fmtN(s.per_hour)} an hour · it stops piling up after ${s.cap_h} hours`:'Build something — it earns while you are away'}</small>
    <button class="btn" id="bCollect" ${s.pending>0?'':'disabled'}>${s.pending>0?'Collect':'Nothing yet'}</button></div>${strip}
    <div class="egrid">${s.items.map(i=>earnCard(i,gold)).join('')}</div>
    <p class="holdnote">Buildings open with your account level (now ${s.level}). Each level costs 1.8× the one before and adds only half of the first level's income — battles stay the way to earn.</p>`;}
async function earnCall(fn,args,after){if(EARN.busy||!ecoOn())return;EARN.busy=true;ecoWait(true);
  try{const seat=seatNo(),r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc(fn,Object.assign({seat},args),10000);ecoApply(x.state);return x;});
    EARN.st=r.estate;EARN.at=Date.now();EARN.seat=seat;ecoWait(false);EARN.busy=false;persist();after&&after(r);}
  catch(e){EARN.busy=false;ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m))await earnLoad(true);ecoModal('🏗️ Not now',ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,140)),[{t:'OK',f:()=>{if(CLOUD.screen==='hub:earn')showHub('earn');}}]);}}
function earnAsk(id){const s=EARN.st;if(!s)return;const i=s.items.find(x=>x.id===id);if(!i)return;
  if(i.lvl>=i.max){SFX.play('deny');ecoToast(i.n+' is at its top level');return;}
  if(!i.open){SFX.play('deny');ecoToast(`🔒 ${i.n} level ${i.lvl+1} needs account level ${i.need}`);return;}
  const extra=i.next_income-i.income,pay=Math.round(i.cost/Math.max(1,extra));
  ecoModal(`${i.e} ${esc(i.n)} → level ${i.lvl+1}`,`<p class="m">🪙 ${fmtN(i.cost)} for <b>+${fmtN(extra)} gold an hour</b> (${fmtN(i.next_income)}/h in all).<br><small>It pays for itself in about ${fmtN(pay)} hours.</small></p>`,
    [{t:`🏗️ ${i.lvl?'Upgrade':'Build'} · 🪙 ${fmtN(i.cost)}`,dis:goldOf()<i.cost,f:()=>earnCall('estate_build',{bld:id},r=>{SFX.play('upgrade');ecoToast(`${i.e} ${i.n} — level ${r.lvl}${r.collected?' · +'+fmtN(r.collected)+' gold collected':''}`,true);showHub('earn');})},{t:'Not now'}]);}
function hubEarnBind(){
  if(earnOn()){earnLoad().then(()=>{if(CLOUD.screen==='hub:earn')showHub('earn');});
    if(EARN.st&&Date.now()-EARN.at>8000)earnLoad(true).then(()=>{if(CLOUD.screen==='hub:earn')showHub('earn');});}
  const bc=$('#bCollect');if(bc)bc.addEventListener('click',()=>earnCall('estate_collect',{},r=>{SFX.play('collect');ecoToast('🪙 +'+fmtN(r.gold)+' gold from the estate',true);showHub('earn');}));
  card.querySelectorAll('.ebld').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',50);earnAsk(b.dataset.b);}));
}
