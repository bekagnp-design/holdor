/* =========================== THE REALM WAR (v1.0.93, backend v25) ===========================
   The weekly standings between the realms (countries), Monday 00:00 → Sunday 24:00 UTC, from the players' Hold runs. A realm's score is the
   average weekly waves of its top 50 players + 0.5 for every player who played on 3+ days of the week (at most 40 players count), so a small
   realm can win against a big one. Everything shown is the server's (realm_war): the realms in order, and — when you are signed in — your
   own week. v1.0.94 (backend v26): LAST week's war pays — the realms that finished 1st/2nd/3rd pay 3000 🪙 + 50 💎 / 2000 + 30 / 1000 + 15, any other
   realm 300 🪙 for taking part, to every player who played on 3+ days of that week, once per week (the server settles it when you claim).
   Entered from the Realms screen. */
const WAR={data:null,last:null,err:'',back:null,rpc:null,timer:0,busy:false};
function warOnline(){return WAR.rpc?true:(typeof sbReady==='function'&&sbReady());}
function warCall(){return WAR.rpc?WAR.rpc('realm_war',{}):sbRpc('realm_war',CLOUD.token?{token:CLOUD.token}:{},{timeout:8000});}
function warLeft(iso){const ms=new Date(iso)-Date.now();if(!(ms>0))return 'ending now';const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),n=m%60;return d?`${d}d ${h}h`:h?`${h}h ${n}m`:`${n}m`;}
function warRow(r,names,mine){const nm=names[r.realm]||{c:'Realm '+r.realm,l:''},isMe=mine&&mine.realm===r.realm,medal=r.pos<=3?['🥇','🥈','🥉'][r.pos-1]:'#'+r.pos;
  return `<div class="wrow ${isMe?'me':''}"><span class="wk">${medal}</span>${nm.c&&typeof flag==='function'?flag(nm.c,30):''}<span class="wn"><b>${esc(nm.c)}</b><small>top-50 avg ${(+r.avg50||0).toLocaleString()} · ${r.players.toLocaleString()} ${r.players===1?'player':'players'} · ${r.active.toLocaleString()} active</small></span><span class="ws">${(+r.score||0).toLocaleString()}</span></div>`;}
function warRew(r){return r?[r.gems?'+'+r.gems+' 💎':'',r.gold?'+'+(+r.gold).toLocaleString()+' 🪙':''].filter(Boolean).join(' '):'';}
function warLastHTML(names){const l=WAR.last;if(!l||l.realm==null)return '';const n=names[l.realm],c=n?esc(n.c):'your realm';
  const head=`<p class="m wlp">Your realm <b>${c}</b> finished <b>${l.pos?'#'+l.pos:'—'}</b>${l.realms?' of '+l.realms:''} · your ${(+l.points||0).toLocaleString()} waves on ${l.days} ${l.days===1?'day':'days'}.</p>`;
  const act=l.claimed?`<p class="wcl done">✔ Claimed${l.reward?': '+warRew(l.reward):''}</p>`:l.eligible?`<button class="btn" id="bWarClaim">🎁 Claim ${warRew(l.reward)}</button>`:`<p class="wcl">${esc(l.why||'Not eligible')}.</p>`;
  return `<div class="statbox wlast"><div class="hd"><b>🏆 Last week's war</b></div>${head}${act}</div>`;}
function warDraw(){const d=WAR.data;if(!d||CLOUD.screen!=='war')return;const box=$('#warBody');if(!box)return;
  const rows=realmStats?realmStats():[],names={};rows.forEach(r=>{names[r.j]=r;});
  const m=d.mine&&d.mine.realm!=null?d.mine:null,mn=m?names[m.realm]:null;
  box.innerHTML=`${warLastHTML(names)}<p class="m wleft">⏳ This week ends in <b>${warLeft(d.ends_at)}</b></p>
    ${m?`<div class="statbox"><div class="hd"><b>Your week</b></div><div class="gr"><div><b>${(+m.points||0).toLocaleString()}</b><small>Hold waves</small></div><div><b>${m.days||0}</b><small>days played</small></div><div><b>${m.pos?'#'+m.pos:'—'}</b><small>${mn?esc(mn.c):'your realm'}</small></div></div></div>`:''}
    ${d.realms.length?`<div class="wlist">${d.realms.map(r=>warRow(r,names,m)).join('')}</div>`:'<p class="m wempty">No Hold runs yet this week. The war starts with the first run — play one for your realm.</p>'}
    <p class="m whow">Score = the average weekly Hold waves of the realm's top 50 players + 0.5 for every player who played on 3 or more days (at most 40 players count, +20 at most). Last week's war pays the realms that finished in the top 3, and a little to everyone who took part.</p>`;}
async function warLastLoad(){if(!(WAR.rpc||(typeof ecoOn==='function'&&ecoOn())))return;
  try{const r=WAR.rpc?await WAR.rpc('war_state',{}):await ecoRpc('war_state',{},8000);WAR.last=r.last;}catch(e){}warDraw();}
async function warClaim(){if(WAR.busy)return;WAR.busy=true;
  try{let r;if(WAR.rpc)r=await WAR.rpc('war_claim',{seat:0});else{ecoWait(true);try{r=await ecoLane(async()=>{await ecoSyncRaw();const x=await ecoRpc('war_claim',{seat:seatNo()},10000);if(x.state)ecoApply(x.state);return x;});}finally{ecoWait(false);}try{persist();}catch(e){}}
    WAR.last=r.last;try{SFX.play('collect');}catch(e){}ecoToast('🏆 Realm war · '+warRew(r.reward),true);warDraw();}
  catch(e){const m=ecoMsg(e);ecoToast(ecoNet(m)?'No connection to the server. Try again in a moment.':m.replace(/^.*?: /,''));await warLastLoad();}
  WAR.busy=false;}
async function warFetch(){try{WAR.data=await warCall();WAR.err='';}catch(e){WAR.err=ecoMsg(e);}
  const st=$('#warSt');if(st)st.textContent=WAR.err?(ecoNet(WAR.err)?'No connection — showing the last standings.':WAR.err):'';warDraw();}
function showRealmWar(back){WAR.back=back||(()=>showRealms(false));
  if(!warOnline()){show(`<div class="topbar"><h1>⚔️ Realm war</h1><button class="back" id="bBack">✖</button></div><p class="m">The realm war needs the online backend: open the game inside Telegram to see how the realms stand this week.</p><button class="btn sec" id="bWarBack">◀ Back</button>`);
    CLOUD.screen='war:off';$('#bBack').addEventListener('click',WAR.back);$('#bWarBack').addEventListener('click',WAR.back);return;}
  show(`<div class="topbar"><h1>⚔️ Realm war<small>this week · by Hold waves</small></h1><button class="back" id="bBack">✖</button></div><p class="m wst" id="warSt">Loading the standings…</p><div id="warBody"></div><button class="btn sec" id="bWarBack">◀ Back</button>`);
  CLOUD.screen='war';$('#bBack').addEventListener('click',()=>{CLOUD.screen='';clearInterval(WAR.timer);WAR.back();});$('#bWarBack').addEventListener('click',()=>{CLOUD.screen='';clearInterval(WAR.timer);WAR.back();});
  if(WAR.data)warDraw();warFetch();warLastLoad();clearInterval(WAR.timer);WAR.timer=setInterval(()=>{if(CLOUD.screen!=='war'){clearInterval(WAR.timer);return;}warFetch();},30000);}
document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('#bWarClaim')){warClaim();return;}const b=e.target&&e.target.closest&&e.target.closest('#bWar');if(b){try{SFX.play('tap',50);}catch(x){}showRealmWar(()=>showRealms(false));}});
