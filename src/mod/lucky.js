/* =========================== LUCKY CHESTS (v1.0.84, backend v21) ===========================
   Clash Royale's lucky drops: before a chest opens, three taps. Each tap may raise it one tier — wood → iron → valyrian → dragon — and
   its stars (★1–4) with it; the rewards are the final tier's. On a seat kept by the server the server rolls the taps inside chest_open
   and the app only plays them back; a guest rolls them here with the same chances. Untouched, the taps play by themselves.
   A dragon chest is already at the top and opens straight away. */
const LUCKY={order:['wood','iron','valyrian','dragon'],p:{wood:35,iron:20,valyrian:8,dragon:0},taps:3,step:750};
function luckyNext(t){return LUCKY.order[Math.min(LUCKY.order.length-1,LUCKY.order.indexOf(t)+1)];}
function luckyRoll(t){let f=t;const taps=[];for(let i=0;i<LUCKY.taps;i++){const hit=Math.random()*100<(LUCKY.p[f]||0);taps.push(hit);if(hit)f=luckyNext(f);}return{taps,tier:f};}
function luckyStars(t){const n=LUCKY.order.indexOf(t)+1;return [0,1,2,3].map(i=>`<i class="${i<n?'on':''}">★</i>`).join('');}
function luckyShow(t,L,next){
  let el=$('#cer');if(!el){el=document.createElement('div');el.id='cer';document.getElementById('app').appendChild(el);}
  const T=CHEST_TIERS[t];el.className='lucky';
  el.innerHTML=`<h2 id="lkN">${T.n}</h2><div class="lkst" id="lkSt">${luckyStars(t)}</div><div class="cchest" id="cch"><div class="glow" id="cglow"></div><div class="cimg" id="cimg">${chestSVG(t)}</div></div>
    <div class="tap" id="ctap">TAP FOR LUCK · <b id="lkLeft">${L.taps.length}</b></div><div class="lkres" id="lkRes">each tap may raise the chest</div>`;
  let i=0,cur=t,busy=false,timer=0,done=false;
  const finish=()=>{if(done)return;done=true;clearTimeout(timer);el.onclick=null;next(cur);};
  const step=()=>{if(busy||done||i>=L.taps.length)return;busy=true;clearTimeout(timer);const hit=!!L.taps[i++];const ch=$('#cch');
    ch.classList.remove('lkhit','lkmiss');void ch.offsetWidth;ch.classList.add(hit?'lkhit':'lkmiss');const lf=$('#lkLeft');if(lf)lf.textContent=L.taps.length-i;
    try{SFX.play('chest',0);}catch(e){}
    setTimeout(()=>{if(done)return;const res=$('#lkRes');
      if(hit){cur=luckyNext(cur);const C=CHEST_TIERS[cur];$('#cimg').innerHTML=chestSVG(cur);$('#lkN').textContent=C.n;const st=$('#lkSt');st.innerHTML=luckyStars(cur);
        const stars=st.querySelectorAll('i.on'),last=stars[stars.length-1];if(last)last.classList.add('pop');$('#cglow').classList.add('on');
        if(res){res.textContent=`★ ${C.sub.toUpperCase()}!`;res.className='lkres up';}
        for(let k=0;k<18;k++){const s=document.createElement('span');s.className='sparkle';s.style.left='50%';s.style.top='45%';s.style.setProperty('--dx',(Math.random()*260-130)+'px');s.style.setProperty('--dy',(Math.random()*220-170)+'px');ch.appendChild(s);setTimeout(()=>s.remove(),1200);}
        try{SFX.play(cur==='dragon'?'legend':'epic');}catch(e){}}
      else if(res){res.textContent=i<L.taps.length?'…not this time':'';res.className='lkres';}
      busy=false;
      if(i>=L.taps.length){const tp=$('#ctap');if(tp)tp.textContent='';timer=setTimeout(finish,hit?900:500);}else timer=setTimeout(step,LUCKY.step);},260);};
  el.onclick=step;timer=setTimeout(step,LUCKY.step+300);}
{const openChest0=openChest;
 openChest=function(t,done){
   if(LUCKY.order.indexOf(t)<0||t==='dragon')return openChest0(t,done);
   const R=ECO.roll;const L=R?(Array.isArray(R.taps)?{taps:R.taps,tier:R.tier||t}:{taps:[false,false,false],tier:t}):luckyRoll(t);
   if(!L.taps.length)return openChest0(L.tier||t,done);   /* the server sent no taps (lucky off): the plain opening */
   luckyShow(t,L,final=>{const keep=ECO.roll;ECO.roll=R;try{openChest0(final,done);}finally{ECO.roll=keep;}
     setTimeout(()=>{const c=$('#cch');if(c)c.click();},300);});};}
