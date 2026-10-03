/* =========================== JUICE (v1.0.77) ===========================
   Small motion everywhere, the way Royal Match, Random Dice and Galaxy Defense make a plain screen feel alive. Display only: nothing
   here changes the game, the economy or the simulation (the battle reads G, never writes it).
   · every button springs when pressed (the CSS `scale` property, so it adds to the buttons' own transforms)
   · gold and dragonglass count up to their new value, and coins fly from where a reward came from into the counter
   · the first time a tab opens, its rows and buttons rise in one after another
   · in battle: the gold counter bumps when it grows, and kill streaks call out (×8 · RAMPAGE ×15 · UNSTOPPABLE ×25 · LEGENDARY ×40)
   Players who ask their phone for less motion (prefers-reduced-motion) get none of it. */
const JUICE={cur:{},tab:null,fly:0,streak:[],shout:0,hg:0,calm:false};
try{JUICE.calm=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){}
/* ---- the press spring ---- */
function juicePressBind(){if(JUICE.bound)return;JUICE.bound=true;
  const on=e=>{const b=e.target&&e.target.closest&&e.target.closest('button,.btn,.hbtn,.ebld,.cday');if(!b||b.disabled)return;b.classList.add('jp');JUICE.pb=b;};
  const off=()=>{const b=JUICE.pb;if(!b)return;JUICE.pb=null;b.classList.remove('jp');if(JUICE.calm)return;b.classList.add('jr');setTimeout(()=>b.classList.remove('jr'),420);};
  document.addEventListener('pointerdown',on,{passive:true});document.addEventListener('pointerup',off,{passive:true});document.addEventListener('pointercancel',off,{passive:true});}
/* ---- numbers that count ---- */
function juiceNumNode(el){for(const n of el.childNodes)if(n.nodeType===3&&/\d/.test(n.textContent))return n;return null;}
function juiceParse(t){t=String(t).trim().replace(/,/g,'');const m=t.match(/^([\d.]+)\s*([kKmM]?)$/);if(!m)return null;return parseFloat(m[1])*(m[2]?(/k/i.test(m[2])?1e3:1e6):1);}
function juiceCount(el,from,to,ms){const n=juiceNumNode(el);if(!n)return;if(JUICE.calm||from===to){n.textContent=fmtN(to);return;}
  const t0=performance.now();el.classList.add('jbump');setTimeout(()=>el.classList.remove('jbump'),500);
  const step=()=>{const k=Math.min(1,(performance.now()-t0)/ms),e=1-Math.pow(1-k,3);n.textContent=fmtN(Math.round(from+(to-from)*e));if(k<1&&n.isConnected)requestAnimationFrame(step);};requestAnimationFrame(step);}
function juiceCurrencies(){const sp=document.querySelectorAll('.hubtop .cur > span');if(sp.length<2)return;
  const now={gold:goldOf(),gems:ACC.gems};[['gold',sp[0]],['gems',sp[1]]].forEach(([k,el])=>{el.dataset.cur=k;const was=JUICE.cur[k];
    if(was!=null&&was!==now[k]){const n=juiceNumNode(el);if(n)n.textContent=fmtN(was);juiceCount(el,was,now[k],700);}JUICE.cur[k]=now[k];});}
/* ---- coins fly into the counter ---- */
function juiceCoins(from,kind){if(JUICE.calm||!from||!from.getBoundingClientRect||(kind!=='gold'&&kind!=='gems'))return;
  const to=document.querySelector(`.hubtop .cur > span[data-cur="${kind}"]`)||document.querySelectorAll('.hubtop .cur > span')[kind==='gold'?0:1];if(!to)return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();if(!a.width&&!a.height)return;
  const x0=a.left+a.width/2,y0=a.top+a.height/2,x1=b.left+18,y1=b.top+b.height/2,N=8;
  for(let i=0;i<N;i++){const c=document.createElement('div');c.className='jcoin';c.innerHTML=kind==='gold'?GOLD_SVG:GEM_SVG;document.body.appendChild(c);
    const sx=x0+(Math.random()-0.5)*60,sy=y0+(Math.random()-0.5)*30,mx=(sx+x1)/2+(Math.random()-0.5)*120,my=Math.min(sy,y1)-60-Math.random()*80;
    const fr=[];for(let s=0;s<=12;s++){const t=s/12,u=1-t;fr.push({transform:`translate(${u*u*sx+2*u*t*mx+t*t*x1-11}px,${u*u*sy+2*u*t*my+t*t*y1-11}px) scale(${1.15-0.45*t}) rotate(${t*300}deg)`,opacity:t<0.9?1:0.4});}
    const an=c.animate(fr,{duration:620+i*45,easing:'cubic-bezier(.45,.05,.55,.95)',delay:i*35,fill:'both'});
    an.onfinish=()=>{c.remove();if(i===N-1){to.classList.add('jbump');setTimeout(()=>to.classList.remove('jbump'),450);try{SFX.play('gold',80);}catch(e){}}};}}
/* ---- a tab rises in (only when the tab changes, not on every redraw) ---- */
function juiceRise(tab){if(JUICE.calm||JUICE.tab===tab){JUICE.tab=tab;return;}JUICE.tab=tab;
  const items=[...document.querySelectorAll('#hubBody .hbtn,#hubBody .qrow,#hubBody .tksec h3,#hubBody .chestrow,#hubBody .battlerow,#hubBody .evcard,#hubBody .shopcard,#hubBody .deal,#hubBody .ccard')].slice(0,14);
  items.forEach((el,i)=>{el.style.animationDelay=(i*45)+'ms';el.classList.add('jrise');setTimeout(()=>{el.classList.remove('jrise');el.style.animationDelay='';},700+i*45);});}
function juiceHub(tab){try{juicePressBind();juiceCurrencies();juiceRise(tab);}catch(e){}}
/* ---- battle: the gold counter and kill streaks (display only) ---- */
const JUICE_SHOUT=[[40,'LEGENDARY','#ffd54a'],[25,'UNSTOPPABLE','#ff9a3c'],[15,'RAMPAGE','#ff6a4a'],[8,'×8','#e9eef5']];
function juiceFrame(){if(G.state!=='play'||JUICE.calm)return;
  const g=Math.floor(G.gold||0),pn=performance.now();if(g>JUICE.hg&&JUICE.hg>0&&pn-(JUICE.hgT||0)>300){JUICE.hgT=pn;const el=document.getElementById('hGold');if(el){el.classList.remove('jbump');void el.offsetWidth;el.classList.add('jbump');}}JUICE.hg=g;
  const t=G.time||0,k=G.kills||0;if(JUICE.lastK==null||k<JUICE.lastK||t<(JUICE.lastT||0)){JUICE.lastK=k;JUICE.lastT=t;JUICE.streak=[];JUICE.shout=0;return;}
  for(let i=JUICE.lastK;i<k;i++)JUICE.streak.push(t);JUICE.lastK=k;JUICE.lastT=t;
  while(JUICE.streak.length&&t-JUICE.streak[0]>2.2)JUICE.streak.shift();
  const n=JUICE.streak.length;if(n<8){if(n<3)JUICE.shout=0;return;}
  const s=JUICE_SHOUT.find(x=>n>=x[0]);if(!s||s[0]<=JUICE.shout)return;JUICE.shout=s[0];
  const st=document.getElementById('stage');if(!st)return;const d=document.createElement('div');d.className='jshout';d.style.color=s[2];
  d.innerHTML=s[0]===8?`<b>${n} KILLS</b>`:`<b>${s[1]}</b><small>×${n}</small>`;st.appendChild(d);setTimeout(()=>d.remove(),1400);try{SFX.play(s[0]>=25?'crit':'hit',200);}catch(e){}}
/* rewards that already call flyReward also send coins to the counter */
if(typeof flyReward==='function'){const fly0=flyReward;flyReward=function(from,d){fly0(from,d);try{if(d&&(d.k==='gold'||d.k==='gems'))juiceCoins(from,d.k);}catch(e){}};}
