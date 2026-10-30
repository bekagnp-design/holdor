/* v1.3.5: the build card on the result screen — what the champion learned in this battle, the synergies he caught and his battle level.
   The build is named after the kind of skill he holds most of (his kit plus the learned ones). Nothing is shown when nothing was learned. */
function buildName(){const h=G.hero;if(!h)return '';const n={};for(const k of h.c.sk)if(!SK[k].ult)n[skCat(k)]=(n[skCat(k)]||0)+1;for(const k of (G.learned||[]))n[skCat(k)]=(n[skCat(k)]||0)+1;
  let best=null,bv=0;for(const c in n)if(n[c]>bv&&SYN[c]){bv=n[c];best=c;}return best?SYN[best][0]+' build':'';}
function buildCard(){if(!G.hero||!(G.learned||[]).length)return '';const syn=Object.keys(G.synDone||{}).map(c=>SYN[c]?SYN[c][0]:c);
  return `<div class="bcard"><div class="bch"><b>${esc(shortName(G.hero.c))}'s ${esc(buildName()||'build')}</b><small>battle level ${(G.hLv||0)+1}${syn.length?' · ✦ '+esc(syn.join(', '))+' synergy':''}</small></div>
    <div class="bcsk">${G.learned.map(k=>`<span class="bcs">${skillIcon(k,38,0)}<small>${esc(SK[k].n)}</small></span>`).join('')}</div>
    <button class="btn sec bcshare" id="bBuildShare">📨 Show your build</button></div>`;}
function buildShareText(){const h=G.hero;return `My ${buildName()||'build'} in HOLDOR: ${shortName(h.c)} learned ${G.learned.map(k=>SK[k].n).join(', ')} (battle level ${(G.hLv||0)+1}). Beat it:`;}
{const scr1=showCampaignResult;showCampaignResult=function(win,stars,nu,gained){scr1(win,stars,nu,gained);try{const bc=buildCard();if(!bc)return;const at=card.querySelector('.resrow')||card.querySelector('#bRetry');if(at)at.insertAdjacentHTML('beforebegin',bc);const sb=card.querySelector('#bBuildShare');if(sb)sb.addEventListener('click',()=>{SFX.play('tap',60);shareText(buildShareText());});}catch(e){}};}
