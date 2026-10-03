/* =========================== SEASON PASS + VIP (v1.0.71, backend v16) ===========================
   A season is a UTC month. Points come from the server's own records (won stages, finished Hold runs); every 10 points open a tier.
   Each tier has a free reward and a premium one (premium needs the Season Pass, bought with Telegram Stars). VIP: 30 days, a daily
   gift of dragonglass and more season points. Everything shown is what the server sends; nothing is credited here. */
const SEASON={st:null,at:0,seat:-1,busy:false};
function seasonOn(){return !!(ecoOn()&&ACC&&ACC.tut);}
function seasonLoad(force){if(!ecoOn())return Promise.resolve(null);
  if(!force&&SEASON.st&&SEASON.seat===seatNo()&&Date.now()-SEASON.at<8000)return Promise.resolve(SEASON.st);
  const seat=seatNo();
  return ecoLane(async()=>{await ecoSyncRaw();const r=await ecoRpc('season_state',{seat},9000);if(seat===seatNo()){SEASON.st=r;SEASON.at=Date.now();SEASON.seat=seat;}return r;}).catch(e=>{ECO.err=ecoMsg(e);return null;});}
function seasonBtnHTML(){
  return `<button class="hbtn" id="bSeason"><span class="ic">🏆</span><b>Season</b></button>`;}
function seasonBtnBind2(){const b=document.getElementById('bSeason');if(b)b.addEventListener('click',()=>{SFX.play('tap',60);showSeason();});}
async function seasonClaim(t,track){if(SEASON.busy||!ecoOn())return;SEASON.busy=true;ecoWait(true);
  try{const seat=seatNo(),r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc('season_claim',{seat,tier:t,track},10000);ecoApply(x.state);return x;});
    SEASON.st=r.season;SEASON.at=Date.now();SEASON.seat=seat;ecoWait(false);SEASON.busy=false;SFX.play('collect');persist();if(r.reward&&r.reward.gear)gearLoad(true);
    ecoModal('🏆 Tier '+t+(track==='prem'?' · premium':''),`<div class="rw">${rewardChips(r.reward)}</div>`,[{t:'OK',f:()=>{if(CLOUD.screen==='season')showSeason();}}]);}
  catch(e){SEASON.busy=false;ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m))await seasonLoad(true);ecoModal('🏆 Not now',ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,140)),[{t:'OK',f:()=>showSeason()}]);}}
async function seasonVip(){if(SEASON.busy||!ecoOn())return;SEASON.busy=true;ecoWait(true);
  try{const seat=seatNo(),r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc('vip_claim',{seat},10000);ecoApply(x.state);return x;});
    SEASON.st=r.season;SEASON.at=Date.now();SEASON.seat=seat;ecoWait(false);SEASON.busy=false;SFX.play('collect');persist();
    ecoModal('👑 VIP gift',`<div class="rw">${rewardChips(r.reward)}</div>`,[{t:'OK',f:()=>{if(CLOUD.screen==='season')showSeason();}}]);}
  catch(e){SEASON.busy=false;ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m))await seasonLoad(true);ecoModal('👑 Not now',ecoNet(m)?'No connection to the server. Try again in a moment.':esc(m.slice(0,140)),[{t:'OK',f:()=>showSeason()}]);}}
function showSeason(){
  const head=`<div class="topbar"><h1>🏆 Season<small>Every month a new ladder. Points come from stages you win and Hold runs you finish.</small></h1><button class="back" id="bBack">✖</button></div>`;
  const draw=body=>{show(head+body);CLOUD.screen='season';$('#bBack').addEventListener('click',()=>showHub('battle'));};
  if(!seasonOn()){draw(`<p class="m">${ecoOn()?'Finish the tutorial battle first.':'The season is kept by the server — it needs a seat signed in through Telegram.'}</p>`);return;}
  const s=SEASON.st&&SEASON.seat===seatNo()?SEASON.st:null;
  if(!s){draw('<p class="m">⏳ asking the server…</p>');seasonLoad(true).then(()=>{if(CLOUD.screen==='season')showSeason();});return;}
  if(Date.now()-SEASON.at>8000)seasonLoad(true).then(()=>{if(CLOUD.screen==='season')showSeason();});
  const nextIn=s.tier>=s.tiers?0:s.per_tier-(s.points%s.per_tier),can=starsCan();
  const vip=s.vip.active?`<div class="vipbox on"><b>👑 VIP</b><small>until ${new Date(s.vip.until).toLocaleDateString()} · +${s.vip.bonus}% season points</small>
      <button class="btn" id="bVip" ${s.vip.can?'':'disabled'}>${s.vip.can?`🎁 Claim ${s.vip.daily_gems} dragonglass`:'✔ today\'s gift is claimed'}</button><button class="btn sec" data-buy="vip" ${can?'':'disabled'}>⭐ ${STARS_SHOP.vip.stars} · +30 days</button></div>`
    :`<div class="vipbox"><b>👑 VIP · 30 days</b><small>${s.vip.daily_gems} dragonglass every day · +${s.vip.bonus}% season points</small><button class="btn" data-buy="vip" ${can?'':'disabled'}>⭐ ${STARS_SHOP.vip.stars}</button></div>`;
  const pass=s.pass?`<div class="vipbox on"><b>🏆 Season Pass</b><small>active — the premium row of every tier is yours</small></div>`
    :`<div class="vipbox"><b>🏆 Season Pass</b><small>a premium reward on every tier of this season</small><button class="btn" data-buy="pass" ${can?'':'disabled'}>⭐ ${STARS_SHOP.pass.stars}</button></div>`;
  const rows=s.items.map(i=>{const cell=(r,ok,done,track)=>`<div class="scell ${done?'done':ok?'ready':''} ${track==='prem'&&!s.pass?'lockp':''}"><span class="qrw">${rewardChips(r,1)}</span><button data-t="${i.t}" data-k="${track}" ${ok?'':'disabled'}>${done?'✔':ok?'Claim':i.t>s.tier?'🔒':track==='prem'&&!s.pass?'⭐':'…'}</button></div>`;
    return `<div class="srow ${i.t<=s.tier?'open':''}"><b class="st">${i.t}</b>${cell(i.free,i.free_ok,i.free_done,'free')}${cell(i.prem,i.prem_ok,i.prem_done,'prem')}</div>`;}).join('');
  draw(`<div class="sbox"><div class="sh"><b>Tier ${s.tier} / ${s.tiers}</b><span>${s.points} points${nextIn?` · ${nextIn} to the next tier`:''}</span></div>
      <span class="qbar"><i style="width:${s.tier>=s.tiers?100:Math.round(100*(s.points%s.per_tier)/s.per_tier)}%"></i><em>${fmtLeft(s.left)} left</em></span></div>
    ${pass}${vip}<div class="shead"><span>Tier</span><span>Free</span><span>Premium</span></div><div class="slist">${rows}</div>`);
  card.querySelectorAll('.srow button[data-t]').forEach(b=>b.addEventListener('click',()=>seasonClaim(+b.dataset.t,b.dataset.k)));
  const bv=$('#bVip');if(bv)bv.addEventListener('click',seasonVip);
  card.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>starsBuy(b.dataset.buy)));
}
