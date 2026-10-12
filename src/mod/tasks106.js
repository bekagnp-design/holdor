/* v1.1.6: Tasks made clear — one header with the count of ready gifts, ready first with a big CLAIM, a progress ring
   for the rest, the done ones folded, the invitation block folded. Data hooks of tasks.js are kept. */
function tkRing(pc,inner,cls){return `<span class="tkring ${cls||''}" style="--p:${Math.max(0,Math.min(100,pc))}"><i>${inner}</i></span>`;}
function tkQRow(q,def,rush,period){const ready=q.cur>=q.need&&!q.claimed,pc=Math.round(100*q.cur/q.need);
  return `<div class="qrow tk tk6 ${q.claimed?'done':''} ${ready?'ready':''}">${tkRing(q.claimed?100:pc,q.claimed?'✔':ready?'🎁':pc+'%',ready?'rd':q.claimed?'dn':'')}
    <div class="qt"><b>${esc(def.t)}</b><span class="qrw">${rewardChips(rush&&!q.claimed?tkDouble(def.r):def.r,1)}${rush&&!q.claimed?'<b class="x2">×2</b>':''}</span>${ready||q.claimed?'':`<small class="tkc">${fmtN(q.cur)} / ${fmtN(q.need)}</small>`}</div>
    ${ready?`<button class="go claim" data-q="${q.id}">CLAIM</button>`:q.claimed?'':''}</div>`;}
function tkQuestRows(kind,P,rush){const list=QUESTS[kind]||[];
  const rows=P.q.map(q=>({q,def:list.find(x=>x.id===q.id)||{t:q.id,r:{}}}));
  const rdy=rows.filter(x=>x.q.cur>=x.q.need&&!x.q.claimed),wip=rows.filter(x=>x.q.cur<x.q.need),dn=rows.filter(x=>x.q.claimed);
  const f=x=>tkQRow(x.q,x.def,rush,kind);
  return rdy.map(f).join('')+wip.map(f).join('')+(dn.length?`<button class="tkdone" data-tog="tk-${kind}">✔ ${dn.length} done ›</button><div data-tgt="tk-${kind}" hidden>${dn.map(f).join('')}</div>`:'');}
function tkQuests(){const s=DAILY.st&&DAILY.seat===seatNo()?DAILY.st:null;if(!s)return '<p class="m">⏳ asking the server…</p>';
  const rush=tkRush(),names={daily:'Today',weekly:'This week',monthly:'This month'};
  return ['daily','weekly','monthly'].map(k=>{const P=s.periods[k];if(!P)return '';
    return `<div class="tksec"><h3>${names[k]}<small>resets in ${fmtLeft(P.left)}</small></h3><div class="qlist">${tkQuestRows(k,P,!!rush)}</div></div>`;}).join('')+
    `<button class="tkmore" id="bTkCal">📅 Login calendar &amp; level gifts ›</button>`;}
function tkBtn(i){if(i.st==='done')return '';
  if(i.st==='ready')return `<button class="go claim" data-c="${i.id}">CLAIM</button>`;
  if(i.st==='wait')return `<button class="tkw" disabled data-w="${i.id}" data-until="${Date.now()+i.left*1000}">⏳ ${i.left}s</button>`;
  return i.kind==='link'?`<button class="go tkgo" data-o="${i.id}">${i.url==='share'?'SHARE':'GO'}</button>`:'';}
function tkRow(i){const ref=i.kind==='ref',pc=ref?Math.round(100*i.cur/i.need):i.st==='done'?100:0,rd=i.st==='ready';
  return `<div class="qrow tkr tk6 ${i.st==='done'?'done':''} ${rd?'ready':''}">${tkRing(pc,i.st==='done'?'✔':rd?'🎁':(i.e||'⭐'),rd?'rd':i.st==='done'?'dn':'')}<div class="qt"><b>${esc(i.n)}</b><span class="qrw">${rewardChips(i.r,1)}</span>${ref&&!rd&&i.st!=='done'?`<small class="tkc">${i.cur} / ${i.need}</small>`:''}</div>${tkBtn(i)}</div>`;}
function tkSocial(){const s=tkState();if(!s)return '<p class="m">⏳ asking the server…</p>';
  const L=s.items.filter(i=>i.kind==='link'),ord=x=>x.st==='ready'?0:x.st==='done'?2:1;
  return `<div class="qlist">${L.slice().sort((a,b)=>ord(a)-ord(b)).map(tkRow).join('')}</div><p class="m dim">Open a link, stay a few seconds, come back and claim. Once per Telegram account.</p>`;}
function tkFriends(){const s=tkState();const F=s?s.items.filter(i=>i.kind==='ref'):[];
  return `${F.length?`<div class="qlist">${F.map(tkRow).join('')}</div>`:''}<button class="tkmore inv" data-tog="tk-inv">👥 Invite friends — a gift for you both ${TASKS.invOpen?'⌃':'›'}</button><div data-tgt="tk-inv" ${TASKS.invOpen?'':'hidden'}>${invBox().replace(/<div class="hh"[^>]*>.*?<\/div>/,'')}</div>`;}
function hubTasks(sub){
  if(!tasksOn())return tkDailyHTML()+`<p class="m">${ecoOn()?'Finish the tutorial battle first.':'Tasks are kept by the server — they need a seat signed in through Telegram.'}</p>`;
  if(sub)TASKS.sub=sub;sub=TASKS.sub;
  const rush=tkRush(),e=evAt(Date.now());
  const strip=rush?`<div class="rushstrip on"><b>📜 Quest Rush</b><span>every quest ×2</span><em id="tkRushCd">${evLeft(rush.t1-Date.now())}</em></div>`
    :e.kind==='rush'?`<div class="rushstrip"><b>📜 Quest Rush</b><span>quests ×2 Mon–Tue</span><em id="tkRushCd">in ${evLeft(e.t0-Date.now())}</em></div>`:'';
  const fr=(DAILY.fr&&DAILY.seat===seatNo()&&DAILY.fr.invited||[]).filter(x=>x.done&&!x.claimed).length;
  const n={quests:tkQuestsReady(),social:tkReady('social'),friends:tkReady('friends')+fr},tot=n.quests+n.social+n.friends;
  const head=`<div class="tkhead ${tot?'on':''}"><span class="tkn">${tot?tot:'✔'}</span><b>${tot?(tot===1?'gift ready to claim':'gifts ready to claim'):'All caught up'}</b></div>`;
  const tabs=[['quests','📜 Quests'],['social','📣 Social'],['friends','👥 Friends']];
  const body=sub==='social'?tkSocial():sub==='friends'?tkFriends():tkQuests();
  return head+strip+`<div class="subtabs tks">${tabs.map(([k,t])=>`<button class="${k===sub?'on':''}" data-tk="${k}">${t}${n[k]?`<i class="dot">${n[k]}</i>`:''}</button>`).join('')}</div><div class="tkbody">${sub==='quests'?tkDailyHTML():''}${body}</div>`;}
