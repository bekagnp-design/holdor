/* v1.3.8: "Challenge a friend with my build". The build card's share link carries the stage, the champion, the skills learned and the battle level
   in the one startapp parameter: b_<SS><CC><L><KK…>[_<invitation code>] — SS stage (base36, 2), CC champion index in CHAMPS (2), L battle level (1),
   KK… skill indexes in Object.keys(SK) (2 each, at most 8), then the sender's invitation code (8 hex) so the invitation reward still works. ≤ 47 chars.
   The receiver sees a sheet with what the link carries and a button for that stage; a bad link or a closed stage is ignored in silence. Local only. */
const CHAL={pending:null,tries:0};
const b36=(n,w)=>(n>>>0).toString(36).padStart(w,'0'),f36=s=>parseInt(s,36);
function chalEncode(stage,champ,skills,lv,code){const sk=Object.keys(SK),ci=CHAMPS.findIndex(c=>c.id===champ);if(ci<0||!(stage>0))return '';
  const ks=(skills||[]).slice(0,8).map(k=>sk.indexOf(k)).filter(i=>i>=0);
  return 'b_'+b36(stage,2)+b36(ci,2)+b36(Math.min(35,Math.max(1,lv||1)),1)+ks.map(i=>b36(i,2)).join('')+(code&&/^[0-9a-f]{8}$/i.test(code)?'_'+code.toLowerCase():'');}
function chalDecode(sp){try{const m=/^b_([0-9a-z]{5}(?:[0-9a-z]{2}){0,8})(?:_([0-9a-f]{8}))?$/i.exec(sp||'');if(!m)return null;const b=m[1].toLowerCase(),sk=Object.keys(SK);
  const stage=f36(b.slice(0,2)),ch=CHAMPS[f36(b.slice(2,4))],lv=f36(b[4]),skills=[];if(!ch||!(stage>0)||!(lv>0))return null;
  for(let i=5;i<b.length;i+=2){const k=sk[f36(b.slice(i,i+2))];if(!k)return null;skills.push(k);}
  return {stage,champ:ch.id,lv,skills,code:m[2]?m[2].toLowerCase():null};}catch(e){return null;}}
function chalSp(sp){const d=chalDecode(sp);return d&&d.code?'r_'+d.code:sp;}   /* so the invitation join sees the plain r_ code */
function chalName(c,skills){const n={};for(const k of c.sk)if(!SK[k].ult)n[skCat(k)]=(n[skCat(k)]||0)+1;for(const k of skills)n[skCat(k)]=(n[skCat(k)]||0)+1;
  let best=null,bv=0;for(const x in n)if(n[x]>bv&&SYN[x]){bv=n[x];best=x;}return best?SYN[best][0]+' build':'build';}
async function chalLink(){const lv=(G.hLv||0)+1,st=G.level&&G.level.id;if(!G.hero||!st||!(G.learned||[]).length)return shareLink();
  let code=null;try{const l=await shareLink();const m=/startapp=r_([0-9a-f]{8})/i.exec(l);if(m)code=m[1];}catch(e){}
  const sp=chalEncode(st,G.hero.c.id,G.learned,lv,code);return sp?BOT_LINK+'?startapp='+sp:BOT_LINK;}
async function chalShare(text){const link=await chalLink(),u='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text);
  try{if(TG&&TG.openTelegramLink)TG.openTelegramLink(u);else window.open(u,'_blank');}catch(e){}}
function chalFromStart(sp){const d=chalDecode(sp);if(!d)return false;CHAL.pending=d;CHAL.tries=0;setTimeout(chalOpen,900);return true;}
/* the stage must be open for this player; otherwise the link is dropped without a word */
function chalCheck(d){const L=LEVELS.find(l=>l.id===d.stage);return L&&levelOpen(null,L)?L:null;}
function chalOpen(){const d=CHAL.pending;if(!d)return;
  if(!ACC||!ACC.tut||G.state==='play'||!/^hub/.test(CLOUD.screen||'')||document.querySelector('#ecoModal.on')||document.querySelector('#cer:not(.hidden)')||(typeof COACH!=='undefined'&&COACH.on)){if(++CHAL.tries<90)setTimeout(chalOpen,1000);else CHAL.pending=null;return;}
  CHAL.pending=null;const L=chalCheck(d);if(!L)return;const c=CBY[d.champ],own=unlocked(null,c),sh=shortName(c);
  ecoModal('⚔️ A friend’s challenge',`<div class="chal"><b>A friend’s ${esc(chalName(c,d.skills))} beat stage ${L.id} with ${esc([sh].concat(d.skills.map(k=>SK[k].n)).join(' + '))}.</b>
    <small>Target: hold ${esc(L.n)} · the friend reached battle level ${d.lv}.</small>
    <small>${own?'You ride with '+esc(sh)+', as they did.':'You ride with your own champion — '+esc(shortName(CBY[ACC.sel]||CHAMPS[0]))+'.'} Skills you pick in battle are yours.</small></div>`,
    [{t:'⚔️ Beat it — stage '+L.id,f:()=>chalGo(d)},{t:'Later'}]);}
function chalGo(d){const L=chalCheck(d);if(!L||G.state==='play')return false;const keep=ACC.sel,c=CBY[d.champ];
  if(c&&unlocked(null,c))ACC.sel=c.id;try{startGame({mode:'campaign',level:L});}finally{ACC.sel=keep;}return true;}
