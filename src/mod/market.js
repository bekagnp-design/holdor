/* =========================== SHARING AND SOURCES (v1.0.72) ===========================
   A share opens Telegram's own "send to a friend" sheet with a short line and the player's invitation link (when his seat is
   signed in; otherwise the plain game link). The link carries `startapp=r_<code>`; a link with `startapp=s_<source>` (yt1, tg, x …)
   tells the server where a new player came from (backend v17, owner views v_sources / v_retention / v_funnel). */
const BOT_LINK='https://t.me/HoldorTDBot/play';
async function shareLink(){
  try{if(ecoOn()){const f=DAILY.fr&&DAILY.seat===seatNo()?DAILY.fr:await frLoad();if(f&&f.code)return refLink(f.code);}}catch(e){}
  return BOT_LINK;}
function shareText(text){shareLink().then(link=>{const u='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text);
  try{if(TG&&TG.openTelegramLink)TG.openTelegramLink(u);else window.open(u,'_blank');}catch(e){}});}
function shareWin(stage,stars){shareText(`I held gate ${stage} ${'⭐'.repeat(Math.max(1,stars||1))} in HOLDOR — Hold the Door! Join my house:`);}
function shareDuel(waves,kills,who){shareText(`I won a HOLDOR duel: ${waves} waves, ${kills} of the dead put down, against ${who}. Beat that:`);}
