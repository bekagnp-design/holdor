/* =========================== EVENTS + THE INVITATION BLOCK (v1.0.74; the estate was closed in v1.0.76, backend v20) ===========================
   Events are no tab: two-day windows (Mon–Tue Quest Rush — quest rewards doubled; Fri–Sat Duel Cup — ranked duel gifts doubled) pop up once
   with a countdown, and a small badge on the home screen brings the popup back. The schedule below is the server's rule (ev_at) in JavaScript.
   The invitation block is drawn in the Tasks tab. */
const EVT_KIND={rush:{n:'Quest Rush',e:'📜',d:'Every quest reward is doubled for these two days — daily, weekly and monthly.',go:'To the Tasks',f:()=>showHub('tasks','quests')},
                cup:{n:'Duel Cup',e:'🏆',d:'Ranked duel gifts are doubled for these two days.',go:'To the Duel',f:()=>showDuel()}};
/* the same rule as ev_at() in backend/holdor_v20.sql: Mon–Tue rush, Wed–Thu the cup is next, Fri–Sat cup, Sun the rush is next (UTC) */
function evAt(ms){const d=new Date(ms),dow=((d.getUTCDay()+6)%7)+1,day0=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()),DAY=86400000;let kind,active,t0;
  if(dow<=2){kind='rush';active=true;t0=day0-(dow-1)*DAY;}else if(dow===5||dow===6){kind='cup';active=true;t0=day0-(dow-5)*DAY;}
  else if(dow<=4){kind='cup';active=false;t0=day0+(5-dow)*DAY;}else{kind='rush';active=false;t0=day0+DAY;}
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
function evPopupCheck(){if(navigator.webdriver)return;   /* automated tests open the popup themselves (evPopup(true)) */
  if(!ACC||!ACC.tut||G.state==='play'||G.tut||(typeof COACH!=='undefined'&&COACH.on)||CLOUD.screen!=='hub:battle')return;
  if(document.querySelector('#ecoModal.on')||document.querySelector('#cer:not(.hidden)'))return;
  const e=evAt(Date.now());if(!e.active)return;const key='holdor_ev',mark=e.kind+':'+e.t0;
  try{if(localStorage.getItem(key)===mark)return;localStorage.setItem(key,mark);}catch(x){}
  evPopup(false);}
/* the invitation block (backend v14): the link, the two gifts, each friend's progress, the claims */
function invBox(){
  const head=`<div class="hh" style="margin-top:14px"><h2>Invite friends</h2><small>a gift for you both</small></div>`;
  if(!ecoOn())return head+'<p class="m">Invitations are kept by the server — they need a seat signed in through Telegram.</p>';
  const f=DAILY.fr&&DAILY.seat===seatNo()?DAILY.fr:null;
  if(!f)return head+'<p class="m">⏳ asking the server…</p>';
  const link=refLink(f.code),pc=x=>Math.round(100*x.stages/f.need);
  const row=(x,mine)=>`<div class="qrow ${x.claimed?'done':''} ${x.done&&!x.claimed?'ready':''}"><div class="qt"><b>${esc(x.name)}${mine?' <small>invited you</small>':''}</b><span class="qbar"><i style="width:${pc(x)}%"></i><em>${x.stages} / ${f.need} stages</em></span><span class="qrw">${rewardChips(mine?f.invitee_gift:f.inviter_gift,1)}</span></div>
    <button data-f="${mine?'me':x.who}" ${x.done&&!x.claimed?'':'disabled'}>${x.claimed?'✔':x.done?'Claim':'…'}</button></div>`;
  return head+`<div class="invbox"><p class="m">When a friend clears <b>${f.need} stages</b>, you both get a gift: <span class="qrw">${rewardChips(f.inviter_gift,1)}</span> for you, <span class="qrw">${rewardChips(f.invitee_gift,1)}</span> for them. Up to ${f.cap} friends${f.paid?` · rewarded so far: <b>${f.paid}</b>`:''}.</p>
    <div class="pvrow"><button class="btn" id="bInvShare">📨 Send to a friend</button><button class="btn sec" id="bInvCopy">Copy link</button></div>
    <div class="qlist">${f.mine?row(f.mine,true):''}${f.invited.map(x=>row(x,false)).join('')||(f.mine?'':'<p class="m">Nobody has joined yet.</p>')}</div></div>`;}
function invBind(){const f=DAILY.fr&&DAILY.seat===seatNo()?DAILY.fr:null;if(!f)return;const link=refLink(f.code);
  const bs=$('#bInvShare');if(bs)bs.addEventListener('click',()=>{SFX.play('tap',60);refShare(link);});const bc=$('#bInvCopy');if(bc)bc.addEventListener('click',()=>refCopy(link));
  card.querySelectorAll('.invbox .qrow button[data-f]').forEach(b=>b.addEventListener('click',()=>dailyClaimFr(b.dataset.f==='me'?null:+b.dataset.f)));}
