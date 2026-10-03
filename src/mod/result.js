/* =========================== THE RESULT SCREEN (v1.0.82) ===========================
   A win should feel like one. On top of the old result card (its text, buttons and ids stay): a ribbon, turning rays, three big stars
   that land one after another with a sound and a buzz, the gold counting up, and confetti for three stars. A loss: a red ribbon and one
   shake. Display only; prefers-reduced-motion shows the final state at once. */
function resultFx(win,stars){try{if(!card)return;if(typeof curSwap==='function')curSwap(card);card.classList.add('res',win?'win':'lose');
  const calm=typeof JUICE!=='undefined'&&JUICE.calm;
  const h1=card.querySelector('h1');if(h1&&!h1.querySelector('.rbn'))h1.insertAdjacentHTML('afterbegin',`<span class="rbn">${win?'VICTORY':'DEFEAT'}</span>`);
  if(!win){if(!calm){card.classList.add('rshake');setTimeout(()=>card.classList.remove('rshake'),600);}return;}
  const st=card.querySelector('.big.stars');
  if(st){st.innerHTML=`<i class="rays"></i>${[0,1,2].map(i=>`<span class="rs ${i<stars?'on':'off'}">★</span>`).join('')}`;
    const S=[...st.querySelectorAll('.rs')];
    if(calm)S.forEach(s=>s.classList.add('landed'));
    else S.forEach((s,i)=>setTimeout(()=>{if(!s.isConnected)return;s.classList.add('landed');if(i<stars){try{SFX.play(i===2?'levelup':'card');}catch(e){}}},350+i*380));}
  const b=card.querySelector('p.m b');if(b){const m=b.textContent.match(/\+(\d+)/);if(m){const to=+m[1],node=[...b.childNodes].find(n=>n.nodeType===3&&/\+\d+/.test(n.textContent));
    if(node&&to>0&&!calm){const t0=performance.now(),D=900,tail=node.textContent.replace(/\+\d+/,'');const tick=()=>{const k=Math.min(1,(performance.now()-t0-400)/D);if(k>=0)node.textContent='+'+Math.round(to*(1-Math.pow(1-Math.max(0,k),3)))+tail;if(k<1&&node.isConnected)requestAnimationFrame(tick);};node.textContent='+0'+tail;requestAnimationFrame(tick);}}}
  if(stars===3&&!calm)setTimeout(resultConfetti,350+2*380);}catch(e){}}
function resultConfetti(){const box=document.getElementById('app')||document.body,cols=['#ffd54a','#ff6a5a','#4fc0ff','#7fd06a','#ff7ab8','#ffffff'];
  for(let i=0;i<36;i++){const c=document.createElement('i');c.className='rconf';c.style.left=(Math.random()*100)+'%';c.style.background=cols[i%cols.length];
    c.style.animationDuration=(1.6+Math.random()*1.4)+'s';c.style.animationDelay=(Math.random()*0.35)+'s';c.style.setProperty('--rx',((Math.random()-0.5)*160)+'px');c.style.setProperty('--rr',(Math.random()*900-450)+'deg');
    box.appendChild(c);setTimeout(()=>c.remove(),3400);}}
{const scr0=showCampaignResult;showCampaignResult=function(win,stars,newUnlocks,gained){scr0(win,stars,newUnlocks,gained);resultFx(win,stars);};}
