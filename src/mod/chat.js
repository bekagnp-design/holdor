/* =========================== THE REALM CHAT (v1.0.91, backend v23) ===========================
   One chat per realm (country): you speak as one of your seats, in the realm that seat fights for. Everything lives on the server
   (chat_send / chat_list / chat_block / chat_report): 200 characters, links and a word list hidden, one message per 2 seconds, three
   different reporters mute an author for an hour. No Telegram id ever reaches the app: a message carries a name, a house and a time.
   The screen polls every 4 s while it is open. Tap someone else's message to report it or block the player.
   v1.0.92 (backend v24): when a defender gets a Legendary item, the server adds a gold "found a Legendary …" line with the item's picture. */
const CHAT={msgs:[],last:0,timer:0,busy:false,back:null,rpc:null,err:'',realm:null};
function chatOnline(){return CHAT.rpc?true:(typeof sbReady==='function'&&sbReady()&&!!CLOUD.token);}
function chatRpc(fn,a){return CHAT.rpc?CHAT.rpc(fn,a):sbRpc(fn,Object.assign({token:CLOUD.token,seat:Math.max(0,seatNo())},a),{timeout:8000});}
function chatTime(t){const d=new Date(t);return isNaN(d)?'':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function chatDrop(m){const [slot,kind,set]=String(m.body).split(':'),K=(GEAR_KIND[slot]||[])[+kind],S=GEAR_SET[set];return K&&S?{slot,set,k:K[0],S}:null;}
function chatRow(m){const H=HOUSES[m.house];
  if(m.kind==='drop'){const d=chatDrop(m);
    return `<div class="chm drop" data-id="${m.id}"><span class="ic">${d?gearArt(d.slot,d.k,4,d.set):'🏆'}</span><div class="cb"><b>${esc(m.name||'Defender')}</b><span>found a <em>Legendary</em> ${d?`${d.S[0]} ${esc(d.S[1])} ${esc(d.k)}`:'item'}!</span><small>${chatTime(m.at)}</small></div></div>`;}
  return `<div class="chm ${m.mine?'me':''}" data-id="${m.id}"><span class="cr">${H?crest(m.house,20):'🛡️'}</span><div class="cb"><b>${esc(m.name||'Defender')}</b><span>${esc(m.body)}</span><small>${chatTime(m.at)}</small></div></div>`;}
function chatNear(l){return l.scrollHeight-l.scrollTop-l.clientHeight<90;}
function chatDraw(add){const l=$('#chList');if(!l)return;const stick=chatNear(l)||!l.children.length;
  if(add&&add.length)l.insertAdjacentHTML('beforeend',add.map(chatRow).join(''));
  const em=$('#chEmpty');if(em)em.style.display=CHAT.msgs.length?'none':'';
  if(stick)l.scrollTop=l.scrollHeight;}
async function chatPoll(){if(CHAT.busy||CLOUD.screen!=='chat')return;CHAT.busy=true;
  try{const r=await chatRpc('chat_list',{since:CHAT.last});CHAT.realm=r.realm;const fresh=(r.msgs||[]).filter(m=>m.id>CHAT.last);
    if(fresh.length){CHAT.msgs=CHAT.msgs.concat(fresh).slice(-120);CHAT.last=fresh[fresh.length-1].id;chatDraw(fresh);}else chatDraw();
    chatNote('');}
  catch(e){chatNote(chatErr(e));}
  CHAT.busy=false;}
function chatErr(e){const m=ecoMsg(e);return /play a battle first/.test(m)?'Play a battle first — the chat opens for defenders.':ecoNet(m)?'No connection — retrying…':m.replace(/^.*?: /,'');}
function chatNote(t){const n=$('#chNote');if(n){n.textContent=t||'Be kind. Links are hidden. Tap a message to report or block.';n.className='chnote'+(t?' err':'');}}
async function chatSend(){const inp=$('#chIn');if(!inp)return;const t=inp.value.trim();if(!t)return;const b=$('#chSend');if(b)b.disabled=true;
  try{await chatRpc('chat_send',{body:t});inp.value='';chatNote('');CHAT.busy=false;await chatPoll();try{SFX.play('tap',50);}catch(e){}}
  catch(e){chatNote(chatErr(e));try{SFX.play('deny');}catch(x){}}
  if(b)b.disabled=false;}
function chatActions(id){const m=CHAT.msgs.find(x=>x.id===id);if(!m||m.mine||m.kind==='drop')return;
  ecoModal(`${esc(m.name||'Defender')}`,`<p class="m chq">${esc(m.body)}</p>`,[
    {t:'🚩 Report this message',f:async()=>{try{await chatRpc('chat_report',{msg:id,reason:'chat'});ecoToast('Thanks — reported.',true);}catch(e){ecoToast(chatErr(e));}}},
    {t:'🚫 Block this player',f:async()=>{try{await chatRpc('chat_block',{msg:id});CHAT.msgs=CHAT.msgs.filter(x=>x.id>0);const l=$('#chList');if(l){l.innerHTML='';CHAT.last=0;CHAT.msgs=[];}ecoToast('Blocked. You will not see their messages.',true);chatPoll();}catch(e){ecoToast(chatErr(e));}}},
    {t:'✕'}]);}
function showChat(back){CHAT.back=back||(()=>showRealms(false));CHAT.msgs=[];CHAT.last=0;CHAT.busy=false;
  const rows=typeof realmStats==='function'?realmStats():[],r=rows.find(x=>x.j===ACC.langI)||{c:'your realm',l:''};
  if(!chatOnline()){show(`<div class="topbar"><h1>💬 Realm chat</h1><button class="back" id="bBack">✖</button></div><p class="m">The realm chat needs the online backend: sign in with Telegram to talk with the defenders of ${esc(r.c)}.</p><button class="btn sec" id="bChBack">◀ Back</button>`);
    CLOUD.screen='chat:off';$('#bBack').addEventListener('click',CHAT.back);$('#bChBack').addEventListener('click',CHAT.back);return;}
  show(`<div class="topbar"><h1 class="rch1">${flag(r.c,26)} ${esc(r.c)}<small>realm chat</small></h1><button class="back" id="bBack">✖</button></div>
    <div class="chlist" id="chList"></div><p class="chempty" id="chEmpty">No one has spoken yet. Say something to the defenders of ${esc(r.c)}.</p>
    <div class="chbar"><input id="chIn" maxlength="200" autocomplete="off" placeholder="Say something…"><button id="chSend" class="go">➤</button></div><p class="chnote" id="chNote"></p>`);
  CLOUD.screen='chat';chatNote('');
  $('#bBack').addEventListener('click',()=>{CLOUD.screen='';clearInterval(CHAT.timer);CHAT.back();});
  $('#chSend').addEventListener('click',chatSend);$('#chIn').addEventListener('keydown',e=>{if(e.key==='Enter')chatSend();});
  $('#chList').addEventListener('click',e=>{const m=e.target.closest&&e.target.closest('.chm');if(m)chatActions(+m.dataset.id);});
  clearInterval(CHAT.timer);CHAT.timer=setInterval(()=>{if(CLOUD.screen!=='chat'){clearInterval(CHAT.timer);return;}chatPoll();},4000);
  chatPoll();}
