/* =========================== SERVER ECONOMY (v1.0.56) ===========================
   A seat played while logged in (Telegram + backend v5) is managed by the server: gold, dragonglass, energy, account XP,
   levels, stage stars, chests and Hold attempts live there. The app keeps a copy, sends every purchase as an operation
   (econ_sync — each has an id, so sending it twice is harmless) and opens and closes every battle (battle_start /
   battle_finish). The server checks price, level, balance and the battle itself and answers with the truth; a refused
   operation is undone here. Guests, and a backend without v5, keep the old local economy.
   Balances shown = the server's last answer + the operations still on their way (each remembers what it changed). */
const ECO={on:false,seat:-1,st:null,at:0,off:0,q:[],fly:[],fin:null,lane:Promise.resolve(),starting:null,startSeat:-1,none:false,err:null,failAt:0,loginAt:0,roll:null,loaded:false,retry:null,back:0,tick:null,refused:[]};
const ECO_KEY='holdor_eco';
/* managed right now: the server answered for this very seat */
function ecoOn(){return !!(ECO.on&&CLOUD.on&&ACC&&seatNo()>=0&&ECO.seat===seatNo());}
/* managed or about to be: logged in, or a seat this device has seen managed before (then its purchases wait in the queue) */
function ecoWants(){return !!(ACC&&seatNo()>=0&&sbReady()&&!ECO.none&&((CLOUD.on&&CLOUD.token)||ACC.eco));}
function ecoOff(){return ecoOn()?ECO.off:0;}
function ecoHold(){const t=Date.now()-600000;return ECO.fly.length>0||ECO.q.some(o=>o.t>t);}
function ecoMsg(e){return String((e&&e.message)||e||'');}
function ecoNet(m){return /abort|Failed to fetch|NetworkError|network|Load failed|timeout|http 5\d\d|no backend|offline/i.test(m);}
function ecoUuid(){try{if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();}catch(e){}
  const b=new Uint8Array(16);try{crypto.getRandomValues(b);}catch(e){for(let i=0;i<16;i++)b[i]=Math.random()*256|0;}
  b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function ecoWho(a){return ((a&&a.made)||'')+'/'+((a&&a.house)||'');}
function ecoRpc(fn,args,ms){return sbRpc(fn,Object.assign({token:CLOUD.token},args),{timeout:ms||10000});}
/* one call at a time, in order: every answer then reflects everything sent before it */
function ecoLane(fn){ECO.n=(ECO.n||0)+1;const p=ECO.lane.then(fn);ECO.lane=p.catch(()=>{}).then(()=>{ECO.n--;});return p;}

/* ---------- what an operation changed here (to keep it visible until the server has it) ---------- */
function ecoSnap(){const o=(ACC&&ACC.online)||{};return{g:ACC?ACC.gold||0:0,m:ACC?ACC.gems||0:0,x:ACC?ACC.axp||0:0,a:o.attempts||0,door:o.doorBonus||0,bank:o.goldBonus||0};}
function ecoDiff(s){const n=ecoSnap(),d={};for(const k in n)if(n[k]!==s[k])d[k]=n[k]-s[k];return d;}
function ecoPend(){const P={g:0,m:0,x:0,a:0,door:0,bank:0,e:0},sn=seatNo();
  for(const o of ECO.fly.concat(ECO.q))if(o.seat===sn&&o._d)for(const k in P)P[k]+=o._d[k]||0;
  const f=ECO.fin;if(f&&f.seat===sn&&f.d){P.g+=f.d.g||0;P.m+=f.d.m||0;}return P;}
/* queue an operation (nothing happens for guests): op = {r, ...}, d = what it changed here, u = how to undo the rest */
function ecoOp(op,d,u){if(!ecoWants())return null;ecoLoadQ();op.id=ecoUuid();
  const o={op,seat:seatNo(),who:ecoWho(ACC),tg:CLOUD.tg_id||ACC.eco||null,_d:d||{},_u:u||null,t:Date.now()};
  ECO.q.push(o);ecoSaveQ();ecoSoon();return o;}
function ecoSaveQ(){ecoLoadQ();try{localStorage.setItem(ECO_KEY,JSON.stringify({v:1,q:ECO.fly.concat(ECO.q),fin:ECO.fin}));}catch(e){}}
function ecoLoadQ(){if(ECO.loaded)return;ECO.loaded=true;
  try{const j=JSON.parse(localStorage.getItem(ECO_KEY)||'null');if(!j||j.v!==1)return;const have=new Set(ECO.q.map(o=>o.op.id));
    ECO.q=(j.q||[]).filter(o=>o&&o.op&&o.op.id&&!have.has(o.op.id)).concat(ECO.q);if(!ECO.fin&&j.fin&&j.fin.bid)ECO.fin=j.fin;}catch(e){}}
/* operations of another Telegram account, or of a seat that has since been replaced, are dropped */
function ecoPrune(){const tg=CLOUD.tg_id;ECO.q=ECO.q.filter(o=>{if(tg&&o.tg&&o.tg!==tg)return false;const a=SAVE&&SAVE.slots&&SAVE.slots[o.seat];return !!a&&ecoWho(a)===o.who;});}
function ecoUndo(o){const u=o._u,a=SAVE&&SAVE.slots&&SAVE.slots[o.seat];if(!u||!a)return;
  try{if(u.cards){a.cards=a.cards||{};a.cards[u.cards[0]]=Math.max(0,(a.cards[u.cards[0]]||0)+u.cards[1]);}
    if(u.pack&&a.pack&&a.pack[u.pack]>0)a.pack[u.pack]--;}catch(e){}}
function ecoSoon(ms){clearTimeout(ECO.ft);ECO.ft=setTimeout(()=>{if(ecoOn())ecoFlush();},ms==null?500:ms);}
function ecoRetryLater(){ECO.back=Math.min(60000,(ECO.back||4000)*2);clearTimeout(ECO.retry);
  ECO.retry=setTimeout(()=>{ECO.retry=null;if(!ecoOn())return;if(ECO.q.length)ecoFlush();if(ECO.fin)ecoLane(ecoFinRaw);},ECO.back);}
function ecoFlush(){if(!ECO.q.length&&!ECO.fly.length)return Promise.resolve(true);return ecoLane(ecoSyncRaw);}

/* ---------- login and the save the server reads the seat from ---------- */
async function ecoLogin(){if(CLOUD.on&&CLOUD.token)return true;if(!TG||!TG.initData||!sbReady())return false;
  if(CLOUD.tried&&!CLOUD.lastErr){for(let i=0;i<30&&!CLOUD.on&&!CLOUD.lastErr;i++)await new Promise(r=>setTimeout(r,200));if(CLOUD.on)return true;}
  if(Date.now()-ECO.loginAt<15000)return !!CLOUD.on;ECO.loginAt=Date.now();CLOUD.tried=false;await cloudLogin();return !!CLOUD.on;}
async function ecoRelogin(){CLOUD.on=false;CLOUD.token=null;CLOUD.lastErr='bad session';ECO.loginAt=0;return ecoLogin();}
/* the server knows a seat from the last save it was sent: send it first when it changed */
async function ecoSaved(force){let n=0;
  for(let i=0;i<60;i++){if(!CLOUD.on)return false;if(!CLOUD.dirty&&!CLOUD.busy)return true;
    if(CLOUD.busy){await new Promise(r=>setTimeout(r,200));continue;}
    if(n++>=3)return false;clearTimeout(CLOUD.timer);await cloudSave(false,force);}
  return false;}

/* ---------- the server's answer → this seat ---------- */
function ecoCalm(){return !ECO.q.length&&!ECO.fly.length&&!ECO.fin&&!(G.state==='play'&&G.bid);}
function ecoSig(){if(!ACC)return '';const o=ACC.online||{};return [ACC.gold,ACC.gems,ACC.axp,ACC.lvlChests,ACC.starChests,ACC.freeChestAt?1:0,o.attempts,o.doorBonus,o.goldBonus,JSON.stringify(ACC.campaign),JSON.stringify(ACC.hard),JSON.stringify(ACC.tlv),JSON.stringify(ACC.slv),JSON.stringify(ACC.upg),JSON.stringify(ACC.champs),JSON.stringify(ACC.deals),ACC.army&&ACC.army.lvl].join('|');}
function ecoApply(st){
  if(!st||typeof st!=='object'||!ACC)return;const sig=ecoSig();
  ECO.st=st;ECO.at=Date.now();const t=Date.parse(st.at);if(t)ECO.off=t-Date.now();
  const P=ecoPend();if(!ACC.online)ACC.online={date:'',attempts:HOLD_ATTEMPTS,doorBonus:0,goldBonus:0,runs:[]};const o=ACC.online;
  ACC.gold=Math.max(0,(+st.gold||0)+P.g);ACC.gems=Math.max(0,(+st.gems||0)+P.m);ACC.axp=Math.max(0,(+st.xp||0)+P.x);
  ACC.lvlChests=+st.lvl_chests||0;ACC.starChests=+st.star_chests||0;
  ACC.freeChestAt=(+st.free_chest_in||0)>0?Date.now()-(86400-st.free_chest_in)*1000:0;
  if(st.hold_day){if(o.date!==st.hold_day){o.date=st.hold_day;o.runs=[];}o.attempts=Math.max(0,(+st.hold_left||0)+P.a);}
  if(st.tut)ACC.tutGift=1;
  if(st.ach&&typeof st.ach==='object'){ACC.ach=ACC.ach||{};for(const k in st.ach)ACC.ach[k]=1;}
  /* levels, stars and deals only when nothing of ours is still on its way (then the server has all of it) */
  if(ecoCalm()){
    ecoLevels(st.levels||{},P);
    if(st.progress){const c={},h={};for(const k in (st.progress.c||{}))c[k]=+st.progress.c[k];for(const k in (st.progress.h||{}))h[k]=+st.progress.h[k];ACC.campaign=c;ACC.hard=h;}
    if(st.deals&&st.deal_window!=null)ACC.deals={k:+st.deal_window,bought:(st.deals.b||[0,0,0,0,0,0]).map(Number),unl:(st.deals.u||[1,1,1,0,0,0]).map(Number)};
  }
  ACC.eco=CLOUD.tg_id||ACC.eco;
  if(ecoSig()!==sig)persist();
}
/* the server's levels (keys c:<champ> sk:<champ>:<i> t:<tower> s:<spell> upg:<id> army hold_door hold_bank); missing = level 1 */
function ecoLevels(L,P){
  const ids=new Set(Object.keys(ACC.champs||{}));for(const k in L){const m=/^(?:c|sk):([^:]+)/.exec(k);if(m)ids.add(m[1]);}
  for(const id of ids){if(!CBY[id])continue;const p=cprog(null,id);p.lvl=Math.min(CH_MAX,Math.max(1,+L['c:'+id]||1));
    for(let i=0;i<3;i++)p.sk[i]=Math.min(SK_MAX,Math.max(1,+L['sk:'+id+':'+i]||1));if(p.lvl<TAL_AT)p.tal=0;}
  const tl={},sl={},up={};
  for(const k in L){const v=+L[k]||0;if(k.startsWith('t:'))tl[k.slice(2)]=v;else if(k.startsWith('s:'))sl[k.slice(2)]=v;else if(k.startsWith('upg:')&&v>0)up[k.slice(4)]=1;}
  ACC.tlv=tl;ACC.slv=sl;ACC.upg=up;ACC.army=Object.assign(ACC.army||{},{lvl:Math.max(1,+L.army||1)});
  ACC.online.doorBonus=(+L.hold_door||0)+(P?P.door:0);ACC.online.goldBonus=(+L.hold_bank||0)+(P?P.bank:0);}
/* what this seat earned before the server paid for it (the first battle's gift, achievements) is claimed once */
function ecoClaims(st){if(!ACC)return;const sn=seatNo(),has=(r,k)=>ECO.q.concat(ECO.fly).some(o=>o.seat===sn&&o.op.r===r&&(k==null||o.op.k===k));
  if(!st.tut&&ACC.tutGift&&!has('tut')){addGold(100);ACC.gems+=20;ecoOp({r:'tut'},{g:100,m:20});}
  const sa=st.ach||{};for(const a of ACHS)if(ACC.ach&&ACC.ach[a.id]&&!sa[a.id]&&!has('ach',a.id)){ACC.gems+=a.g;ecoOp({r:'ach',k:a.id},{m:a.g});}}

/* ---------- sending the queue ---------- */
async function ecoSyncRaw(){
  ecoLoadQ();if(!CLOUD.on||!CLOUD.token)return false;ecoPrune();let tries=0;
  while(ECO.q.length){
    const seat=ECO.q[0].seat,batch=[];while(ECO.q.length&&ECO.q[0].seat===seat&&batch.length<50)batch.push(ECO.q.shift());
    ECO.fly=batch;let r=null;
    try{r=await ecoRpc('econ_sync',{seat,ops:batch.map(o=>o.op)},12000);}
    catch(e){const m=ecoMsg(e);ECO.q=batch.concat(ECO.q);ECO.fly=[];ECO.err=m;
      if(tries++<2){if(/bad session/.test(m)&&await ecoRelogin())continue;if(/no seat/.test(m)&&await ecoSaved(true))continue;}
      if(/no seat|bad seat/.test(m))ECO.q=ECO.q.filter(o=>o.seat!==seat);
      ecoSaveQ();ecoRetryLater();return false;}
    ECO.fly=[];ECO.err=null;ECO.back=0;const bad=[];
    for(const x of (r&&r.results)||[]){const o=batch.find(b=>b.op.id===x.id);if(o&&!x.ok){ecoUndo(o);bad.push(String(x.why||'refused'));}}
    ecoSaveQ();
    if(seat===seatNo()&&r&&r.state)ecoApply(r.state);
    if(bad.length)ecoRefused(bad);
  }
  return true;}
function ecoRefused(list){ECO.refused=ECO.refused.concat(list).slice(-20);
  ecoToast('⚠️ The server did not accept: '+[...new Set(list)].slice(0,2).join(' · '));try{SFX.play('deny');}catch(e){}persist();ecoRedraw();}

/* ---------- entering a seat ---------- */
function ecoStart(){
  if(!ACC||seatNo()<0||!sbReady()||ECO.none||(!CLOUD.on&&!TG))return Promise.resolve(false);
  const seat=seatNo();if(ECO.starting&&ECO.startSeat===seat)return ECO.starting;ECO.startSeat=seat;
  const p=ecoLane(async()=>{
    if(!(await ecoLogin()))throw new Error(CLOUD.lastErr||'offline');
    if(seat!==seatNo()||!ACC)return false;
    ecoLoadQ();ecoPrune();await ecoSyncRaw();
    if(!(await ecoSaved(true)))throw new Error(CLOUD.lastErr||'could not save the seat');
    let st;
    try{st=await ecoRpc('econ_state',{seat},9000);}
    catch(e){if(/bad session/.test(ecoMsg(e))&&await ecoRelogin())st=await ecoRpc('econ_state',{seat},9000);else throw e;}
    if(seat!==seatNo()||!ACC)return false;
    const sig=ecoSig();ECO.on=true;ECO.seat=seat;ECO.err=null;ECO.failAt=0;ACC.eco=CLOUD.tg_id;
    ecoApply(st);ecoClaims(st);
    if(ECO.q.length)await ecoSyncRaw();
    if(ECO.fin)await ecoFinRaw();
    ecoTicker();if(ecoSig()!==sig){persist();ecoRedraw();}
    return true;
  }).catch(e=>{const m=ecoMsg(e);ECO.err=m;ECO.failAt=Date.now();if(/Could not find the function|PGRST202|schema cache/i.test(m))ECO.none=true;return false;})
    .finally(()=>{if(ECO.starting===p)ECO.starting=null;});
  ECO.starting=p;return p;}
/* a fresh answer (the hub asks when the last one is over a minute old): energy, attempts and a new day */
function ecoRefresh(){if(!ecoOn())return Promise.resolve(null);const seat=seatNo();
  return ecoLane(async()=>{await ecoSyncRaw();const st=await ecoRpc('econ_state',{seat},9000);if(seat!==seatNo())return null;const sig=ecoSig();ecoApply(st);if(ecoSig()!==sig)ecoRedraw();return st;})
    .catch(e=>{ECO.err=ecoMsg(e);return null;});}
function ecoStatus(){if(ecoOn()){const n=ECO.q.length+ECO.fly.length+(ECO.fin?1:0);return 'on the server'+(n?' · '+n+' waiting to be sent':' · in step');}
  return ECO.err?'not reached ('+ECO.err+') — purchases wait':'connecting…';}

/* ---------- battles: opened and closed on the server ---------- */
function startGame(o){
  if(o&&o.bid)return startGame0(o);
  if(o&&o.tutorial){G.bid=null;return startGame0(o);}
  if(!ecoWants()){G.bid=null;return startGame0(o);}
  ecoBattle(o);}
async function ecoBattle(o){
  if(ECO.busyB)return;ECO.busyB=true;ecoWait(true);
  const kind=o.mode==='online'?'hold':ACC.diff==='kingsguard'?'hard':'camp',stage=kind==='hold'?null:o.level.id;
  try{
    if(!ecoOn()&&!(await ecoStart())){ecoWait(false);if(ECO.none||!ecoWants()){G.bid=null;startGame0(o);return;}ecoFail(o,ECO.err||'offline');return;}
    if(kind==='hold'){if(ACC.online.attempts<=0){ecoWait(false);ecoFail(o,'no Hold attempts left today');return;}}
    else{const need=ecoCost(o.level,kind==='hard');if(ecoEnergy().n<need){ecoWait(false);ecoEnergySheet(need,()=>startGame(o));return;}}
    const r=await ecoLane(async()=>{await ecoSyncRaw();if(ECO.fin)await ecoFinRaw();const x=await ecoRpc('battle_start',{seat:seatNo(),kind,stage},10000);ecoApply(x.state);return x;});
    ecoWait(false);
    G.bid=null;startGame0(Object.assign({},o,{bid:r.battle}));G.bid=r.battle;G.bkind=kind;
  }catch(e){const m=ecoMsg(e);if(/bad session/.test(m))ecoRelogin();else if(/energy|attempts/.test(m))await ecoRefresh();ecoWait(false);ecoFail(o,m);}
  finally{ECO.busyB=false;}}
function ecoFail(o,why){const m=String(why||'');
  if(/energy/.test(m)){ecoEnergySheet(o&&o.level?ecoCost(o.level,ACC.diff==='kingsguard'):0,()=>startGame(o));return;}
  if(/Hold attempts/.test(m)){ecoModal('🚪 No attempts left',"Today's Hold attempts are used. A new day brings "+HOLD_ATTEMPTS+' more — or buy one for 40 💎.',
    [{t:'💎 40 · one more attempt',dis:ACC.gems<40,f:()=>{if(ecoBuyAtt())ecoRedraw();}},{t:'Close'}]);return;}
  if(/locked|Hard opens/.test(m)){ecoModal('🔒 Not open yet','The server has not seen the stage before this one held on this seat.',[{t:'OK',f:()=>showCampaign()}]);return;}
  if(/too many battles/.test(m)){ecoModal('⏳ Rest a while','Too many battles in one hour. The gate will wait for you.',[{t:'OK'}]);return;}
  ecoModal('📡 No connection','Battles on this seat count only through the server, and it could not be reached'+(m?' <small>('+esc(m.slice(0,90))+')</small>':'')+'.',
    [{t:'🔁 Try again',f:()=>startGame(o)},{t:'Back'}]);}
/* the end of a battle: the result goes to the server, which pays the reward (shown here right away, confirmed by its answer) */
function ecoFinish(won,stars,d,waves){if(!G.bid)return Promise.resolve(null);
  ECO.fin={bid:G.bid,seat:seatNo(),kind:G.bkind,won:!!won,stars:won?stars|0:0,steps:G.tick|0,waves:waves|0,kills:G.kills|0,d:d||null};
  G.bid=null;ecoSaveQ();return ecoLane(ecoFinRaw);}
async function ecoFinRaw(again){
  const f=ECO.fin;if(!f)return null;if(!CLOUD.on||!CLOUD.token){ecoRetryLater();return null;}
  let r;
  try{r=await ecoRpc('battle_finish',{battle:f.bid,won:f.won,stars:f.stars,steps:f.steps,waves:f.waves,kills:f.kills},12000);}
  catch(e){const m=ecoMsg(e);if(!again&&/bad session/.test(m)&&await ecoRelogin())return ecoFinRaw(true);
    if(/no battle/.test(m)){ECO.fin=null;ecoSaveQ();return null;}ECO.err=m;ecoRetryLater();return null;}
  ECO.fin=null;ecoSaveQ();ECO.last=r;
  let st=r&&r.state;if(!st&&f.seat===seatNo()){try{st=await ecoRpc('econ_state',{seat:f.seat},9000);}catch(e){}}
  if(st&&f.seat===seatNo())ecoApply(st);
  if(r&&r.ok===false)ecoRefused(['battle not counted — '+(r.why||r.status||'refused')]);
  return r;}

/* ---------- chests: checked and rolled on the server (the card stacks are still drawn here) ---------- */
async function ecoChest(t,source,done){
  if(ECO.busyC)return;ECO.busyC=true;ecoWait(true);
  try{
    if(!ecoOn()&&!(await ecoStart()))throw new Error(ECO.err||'offline');
    const r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc('chest_open',{seat:seatNo(),tier:t,source},10000);ecoApply(x.state);return x;});
    ecoWait(false);
    ECO.roll={id:r.chest,gold:+r.gold||0,gems:+r.gems||0};try{openChest(t,done);}finally{ECO.roll=null;}
  }catch(e){ecoWait(false);const m=ecoMsg(e);if(!ecoNet(m))ecoRefresh();
    ecoModal('📦 The chest stays shut',ecoNet(m)?'No connection to the server. Chests on this seat open only through it — try again in a moment.':esc(m),[{t:'OK',f:ecoRedraw}]);}
  finally{ECO.busyC=false;}}

/* ---------- energy: every campaign battle costs some; it comes back with time ---------- */
function ecoCfgE(){return (ECO.st&&ECO.st.cfg&&ECO.st.cfg.energy)||{max:60,regen_s:150,cost:[3,4,5,6,7],per:10,hard_extra:2,refill_gems:30,refill_amount:60,refills_per_day:3};}
function ecoCost(L,hard){const E=ecoCfgE(),c=E.cost||[3,4,5,6,7],per=Math.max(1,+E.per||10),id=(L&&L.id)||1;
  return (+c[Math.min(Math.floor((id-1)/per),c.length-1)]||0)+(hard?(+E.hard_extra||0):0);}
function ecoEnergy(){const s=ECO.st,E=ecoCfgE(),rg=Math.max(1,+E.regen_s||150),mx=s?(+s.energy_max||+E.max||60):(+E.max||60);
  let n=s?(+s.energy||0):mx,nx=s?(+s.energy_next||0):0;const el=Math.max(0,(Date.now()-ECO.at)/1000);
  if(s&&n<mx){if(el>=nx){n=Math.min(mx,n+1+Math.floor((el-nx)/rg));nx=n>=mx?0:rg-((el-nx)%rg);}else nx-=el;}else nx=0;
  n+=ecoPend().e;const pr=ECO.q.concat(ECO.fly).filter(o=>o.seat===seatNo()&&o.op.r==='energy').length;
  return{n,max:mx,next:Math.ceil(nx),rg,refills:Math.max(0,(s?+s.refills_left||0:0)-pr),gems:+E.refill_gems||30,amount:+E.refill_amount||60};}
function ecoChip(){const E=ecoEnergy();return `<span class="en" id="hubEn" title="Energy — every battle costs some, it comes back with time">⚡${E.n}<em>/${E.max}</em></span>`;}
function ecoTicker(){if(ECO.tick)return;ECO.tick=setInterval(()=>{if(!ecoOn())return;const el=document.getElementById('hubEn'),nx=document.getElementById('enNext');if(!el&&!nx)return;
  const E=ecoEnergy();if(el)el.innerHTML=`⚡${E.n}<em>/${E.max}</em>`;if(nx){const t=fmtT(E.next*1000);nx.textContent=E.n>=E.max?'now':t.m+':'+t.s;}},1000);}
function ecoEnergySheet(need,retry){
  if(!ecoOn()){ecoModal('⚡ Energy','Energy lives on the server, and it could not be reached yet.',[{t:'OK'}]);return;}
  const E=ecoEnergy(),C=ecoCfgE(),c=C.cost||[],per=+C.per||10,t=fmtT(E.next*1000),can=E.refills>0&&ACC.gems>=E.gems,go=!!(need&&retry&&E.n>=need);
  const tbl=c.map((v,i)=>`${i*per+1}–${Math.min(LEVELS.length,(i+1)*per)}: ⚡${v}`).join(' · ');
  const every=E.rg>=60?(Math.round(E.rg/6)/10)+' min':E.rg+' s';
  ecoModal('⚡ Energy',`<b class="ebig">${E.n} / ${E.max}</b>${E.n>=E.max?'Full.':`+1 every ${every} · next in <b id="enNext">${t.m}:${t.s}</b>`}${need?`<br>This battle needs <b>⚡${need}</b>.`:''}
    <p class="es">Every campaign battle costs energy — stages ${tbl} · Hard +${+C.hard_extra||0}. The daily Hold uses its attempts instead. A new account level fills your energy up.</p>`,
    [{t:`💎 ${E.gems} → +${E.amount} ⚡ · ${E.refills} left today`,dis:!can,f:()=>ecoRefill(need,retry)},{t:go?'⚔️ To battle':'Close',f:go?retry:null}]);}
function ecoRefill(need,retry){const E=ecoEnergy();if(E.refills<=0||ACC.gems<E.gems){SFX.play('deny');return;}
  ACC.gems-=E.gems;ecoOp({r:'energy'},{m:-E.gems,e:E.amount});SFX.play('buy');persist();ecoWait(true);
  ecoFlush().catch(()=>{}).then(()=>{ecoWait(false);ecoRedraw();if(need&&retry&&ecoEnergy().n>=need)retry();else ecoEnergySheet(need,retry);});}
/* one more Hold attempt for 40 dragonglass (the shop, the Hold tab and the "no attempts" note) */
function ecoBuyAtt(){if(!ACC||ACC.gems<40){try{SFX.play('deny');}catch(e){}return false;}
  ACC.gems-=40;ACC.online.attempts++;ecoOp({r:'att'},{m:-40,a:1});SFX.play('buy');persist();return true;}

/* ---------- purchases that go through the queue (the originals are renamed …0) ---------- */
function cardLevelUp(key){const s=ecoSnap(),l=cardLvl(key),need=cardNeed(key),ok=cardLevelUp0(key);
  if(ok)ecoOp({r:'card',k:key,to:l+1},ecoDiff(s),{cards:[key,need]});return ok;}
function trainArmy(){const s=ecoSnap(),l=armyLvl(),ok=trainArmy0();if(ok)ecoOp({r:'army',to:l+1},ecoDiff(s));return ok;}
function buyPack(k){const s=ecoSnap(),ok=buyPack0(k);if(ok)ecoOp({r:'pack',k},ecoDiff(s),{pack:k});return ok;}
function buyDeal(i){const s=ecoSnap(),D=dealsState(),d=genDeals()[i],ok=buyDeal0(i);
  if(ok&&d){const g={k:d.k};if(d.k==='gold')g.gold=d.gold;else if(d.k==='gems')g.gems=d.gems;else if(d.k==='cards'){g.key=d.key;g.cnt=d.cnt;}
    else if(d.k==='sk'){g.c=d.c;g.i=d.i;}else if(d.k==='upg')g.u=d.u;
    ecoOp({r:'deal',i,w:D.k,g,p:d.price||{}},ecoDiff(s),d.k==='cards'?{cards:[d.key,-d.cnt]}:null);}
  return ok;}
function unlockDeal(i){const s=ecoSnap(),D=dealsState(),ok=unlockDeal0(i);if(ok)ecoOp({r:'dealunl',i,w:D.k},ecoDiff(s));return ok;}

/* ---------- small UI: a modal, a toast, a wait veil; redraw the hub after the server changed something ---------- */
function ecoModal(title,html,btns){try{let el=document.getElementById('ecoModal');if(!el){el=document.createElement('div');el.id='ecoModal';document.getElementById('app').appendChild(el);}
  btns=btns&&btns.length?btns:[{t:'OK'}];
  el.innerHTML=`<div class="em"><h3>${title}</h3><div class="eh">${html}</div><div class="eb">${btns.map((b,i)=>`<button data-i="${i}" class="${i?'sec':''}" ${b.dis?'disabled':''}>${b.t}</button>`).join('')}</div></div>`;
  el.className='on';el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const B=btns[+b.dataset.i];el.className='';el.innerHTML='';try{SFX.play('tap',50);}catch(e){}if(B&&B.f)B.f();}));}catch(e){}}
function ecoToast(msg,ok){try{let el=document.getElementById('ecoToast');if(!el){el=document.createElement('div');el.id='ecoToast';document.getElementById('app').appendChild(el);}
  el.className=ok?'ok':'';el.textContent=msg;requestAnimationFrame(()=>el.classList.add('in'));clearTimeout(ECO.tt);ECO.tt=setTimeout(()=>el.classList.remove('in'),4200);}catch(e){}}
function ecoWait(on){try{let el=document.getElementById('ecoWait');if(!el){el=document.createElement('div');el.id='ecoWait';el.innerHTML='<span>⏳ the server…</span>';document.getElementById('app').appendChild(el);}el.className=on?'on':'';}catch(e){}}
function ecoRedraw(){try{if(!ACC||G.state==='play')return;const cer=document.getElementById('cer');if(cer&&cer.innerHTML)return;const sc=CLOUD.screen||'';if(sc.indexOf('hub:')===0)showHub(sc.slice(4));}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&ecoOn())ecoFlush();});
