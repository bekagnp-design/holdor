/* =========================== THE CHAMPION REVEAL (v1.1.4) ===========================
   A champion is never just a card in a list. When one meets the player — the first one, when the Army opens, and every one who joins
   the house later — a chest drops, knocks three times, bursts in light, and the champion rises out of it as a card that turns in 3D:
   it sways by itself, follows a finger, and a glare slides over it. Then the camera pulls in on each of the three skills in turn: a
   looping picture of what it does (skilldemo.js) and five words; the full text is one tap away. The last card says what to do next.
   Only for accounts made in the story flow (ACC.sv); automation skips it unless window.__films is set (same switch as the films). */
const RV={on:false,el:null,raf:0,stop:null,done:null,tilt:{x:0,y:0,tx:0,ty:0,drag:0},t0:0,step:0,id:null,kind:null,sparks:[]};
function rvDue(){if(!ACC||!ACC.sv||!ACC.castle)return null;const R=ACC.rv||(ACC.rv={});
  if(stSeen('f5')&&!R.meet)return{id:ACC.sel,kind:'meet'};
  if(!R.joined){R.joined={};CHAMPS.filter(c=>c.house===ACC.house&&unlocked(null,c)).forEach(c=>{R.joined[c.id]=1;});persist();}
  if(!R.meet)return null;
  const c=CHAMPS.filter(c=>c.house===ACC.house&&unlocked(null,c)&&!R.joined[c.id])[0];
  return c?{id:c.id,kind:'joins'}:null;}
function rvMark(id,kind){const R=ACC.rv||(ACC.rv={});if(kind==='meet')R.meet=1;if(!R.joined)R.joined={};R.joined[id]=1;persist();}
function rvChest(){return `<svg class="rvch" viewBox="0 0 200 170" width="200" height="170"><defs><linearGradient id="rvw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a2c"/><stop offset="1" stop-color="#4a2c14"/></linearGradient><linearGradient id="rvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#d89a2a"/></linearGradient></defs>
  <ellipse cx="100" cy="158" rx="84" ry="9" fill="rgba(0,0,0,.45)"/>
  <g class="rvbody"><rect x="22" y="78" width="156" height="76" rx="8" fill="url(#rvw)" stroke="#2a1608" stroke-width="3"/><rect x="22" y="96" width="156" height="12" fill="#3a3f48" stroke="#1a1d22" stroke-width="2"/><rect x="40" y="78" width="14" height="76" fill="#3a3f48"/><rect x="146" y="78" width="14" height="76" fill="#3a3f48"/><rect x="88" y="98" width="24" height="26" rx="4" fill="url(#rvg)" stroke="#7a4a0a" stroke-width="2"/><circle cx="100" cy="110" r="4" fill="#4a2c14"/><g class="rvseam"><rect x="24" y="76" width="152" height="5" fill="#fff3b0"/></g></g>
  <g class="rvlid"><path d="M20 80 Q20 38 100 34 Q180 38 180 80 Z" fill="url(#rvw)" stroke="#2a1608" stroke-width="3"/><rect x="20" y="62" width="160" height="10" fill="#3a3f48"/><rect x="40" y="38" width="14" height="42" fill="#3a3f48"/><rect x="146" y="38" width="14" height="42" fill="#3a3f48"/></g></svg>`;}
function rvArt(c){const u=CHAMP_ART[c.id+'_portrait'];return u?`<div class="rvimg" style="background-image:url(${u})"></div>`:`<div class="rvimg emoji">${c.e}</div>`;}
function rvCard(c,hh){const r=champRar(c);return `<div class="rvcard" style="--rc:${RAR_C[r]};--hc:${hh.col};--hc2:${hh.col2}"><div class="rvback"></div><div class="rvface">${rvArt(c)}<span class="rvglare"></span><span class="rvrar">${RAR_N[r]}</span></div><span class="rvsig">${crest(c.house,34)}</span></div>`;}
function rvCanvasFx(){const cv=RV.el.querySelector('.rvfx');if(!cv)return;const c=cv.getContext('2d'),hh=HOUSES[ACC.house];
  const loop=now=>{if(!RV.on)return;const t=(now-RV.t0)/1000,w=cv.width,h=cv.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);
    if(RV.burst!=null){const k=(t-RV.burst);if(k>=0){c.save();c.translate(w/2,h*.46);c.globalCompositeOperation='lighter';const n=14;for(let i=0;i<n;i++){const a=i/n*6.283+t*.35,L=Math.min(w,h)*(.42+.3*Math.min(1,k*1.2)),wd=.07;const g=c.createLinearGradient(0,0,Math.cos(a)*L,Math.sin(a)*L);g.addColorStop(0,hexA(hh.col,.5*Math.min(1,k*2)));g.addColorStop(1,hexA(hh.col,0));c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.arc(0,0,L,a-wd,a+wd);c.closePath();c.fill();}c.restore();}}
    RV.sparks.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.vy+=.03;s.l-=.012;if(s.l>0){c.globalAlpha=Math.min(1,s.l);c.fillStyle=s.c;c.fillRect(s.x,s.y,s.s,s.s);}});RV.sparks=RV.sparks.filter(s=>s.l>0);c.globalAlpha=1;
    RV.raf=requestAnimationFrame(loop);};RV.raf=requestAnimationFrame(loop);}
function rvBurst(x,y,n,col){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=1.5+Math.random()*4.5;RV.sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,l:1,s:2+Math.random()*3,c:i%3?col:'#fff3b0'});}}
function rvTilt(){const el=RV.el&&RV.el.querySelector('.rvcard');if(!el||!RV.on)return;const T=RV.tilt,t=(performance.now()-RV.t0)/1000;
  if(!T.drag){T.tx=Math.sin(t*.9)*13;T.ty=Math.cos(t*.7)*7;}T.x+=(T.tx-T.x)*.12;T.y+=(T.ty-T.y)*.12;
  el.style.setProperty('--ry',T.x.toFixed(2)+'deg');el.style.setProperty('--rx',(-T.y).toFixed(2)+'deg');el.style.setProperty('--gx',(50+T.x*2.6).toFixed(1)+'%');el.style.setProperty('--gy',(40-T.y*3).toFixed(1)+'%');
  RV.tiltRaf=requestAnimationFrame(rvTilt);}
function rvEnd(skipped){if(!RV.on)return;RV.on=false;cancelAnimationFrame(RV.raf);cancelAnimationFrame(RV.tiltRaf);if(RV.stop){RV.stop();RV.stop=null;}RV.timers.forEach(clearTimeout);const el=RV.el,d=RV.done;RV.el=null;
  if(el){el.classList.add('out');setTimeout(()=>el.remove(),380);}rvMark(RV.id,RV.kind);SFX.amb(null);if(d)d(!!skipped);}
function rvSkillStep(i){const c=CBY[RV.id],p=cprog(null,c.id),sk=c.sk[i],S=SK[sk],l=Math.max(1,p.sk[i]||1),box=RV.el.querySelector('.rvsk'),cat=skCat(sk);
  if(RV.stop){RV.stop();RV.stop=null;}
  box.innerHTML=`<div class="rvskh"><span class="rvski">${skillIcon(sk,44,0)}</span><span class="rvskn"><b>${esc(S.n)}</b>${S.ult?'<em>ULTIMATE</em>':''}<small>${SKTAG[cat]}</small></span><button class="rvinfo" data-i="1" aria-label="Full text">ⓘ</button></div><canvas class="rvdemo" width="640" height="360"></canvas><p class="rvfull" hidden>${esc(S.d(S.v[l-1]))}</p>
    <div class="rvdots">${[0,1,2].map(j=>`<i class="${j===i?'on':''}"></i>`).join('')}</div>`;
  RV.stop=skillDemoLoop(box.querySelector('canvas'),sk,c.house);box.classList.remove('pop');void box.offsetWidth;box.classList.add('pop');
  box.querySelector('.rvinfo').addEventListener('click',()=>{const f=box.querySelector('.rvfull');f.hidden=!f.hidden;SFX.play('tap',50);});SFX.play(S.ult?'unlock':'tap',60);}
function rvGo(step){if(!RV.on)return;RV.step=step;const el=RV.el,c=CBY[RV.id],nx=el.querySelector('.rvnext'),cta=el.querySelector('.rvcta');
  el.classList.toggle('mini',step>=1);el.classList.toggle('skills',step>=1&&step<=3);el.classList.toggle('last',step>=4);
  if(step>=1&&step<=3){rvSkillStep(step-1);nx.hidden=false;nx.textContent=step<3?'NEXT ▶':'DONE ▶';cta.hidden=true;}
  else if(step>=4){if(RV.stop){RV.stop();RV.stop=null;}el.querySelector('.rvsk').innerHTML='';nx.hidden=true;cta.hidden=false;
    cta.innerHTML=RV.kind==='joins'&&ACC.sel!==c.id?`<button class="rvbtn big" data-a="ride">⚔ RIDE WITH ${esc(shortName(c)).toUpperCase()}</button><button class="rvbtn sec" data-a="ok">Keep ${esc(shortName(CBY[ACC.sel])||'')} riding</button>`:`<button class="rvbtn big" data-a="ok">▶ LET'S RIDE</button>`;
    cta.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.a==='ride'){ACC.sel=c.id;persist();}SFX.play('levelup');rvEnd(false);}));}}
function revealChampion(id,kind,done){const c=CBY[id];
  if(!c||(navigator.webdriver&&!window.__films)){rvMark(id,kind);if(done)setTimeout(()=>done(true),0);return;}
  if(RV.on)rvEnd(true);if(FIL)filmEnd(true);
  const hh=HOUSES[c.house],r=champRar(c),el=document.createElement('div');el.className='rv p0';el.style.setProperty('--hc',hh.col);el.style.setProperty('--hc2',hh.col2);el.style.setProperty('--rc',RAR_C[r]);
  el.innerHTML=`<canvas class="rvfx"></canvas><button class="rvskip" aria-label="Skip">Skip ▶</button>
    <div class="rvwrap"><div class="rvstage"><div class="rvchest">${rvChest()}</div>${rvCard(c,hh)}</div>
    <div class="rvplate"><small>${kind==='joins'?'JOINS YOUR HOUSE':'YOUR CHAMPION'}</small><b>${esc(c.n)}</b><span><em style="color:${RAR_C[r]}">${RAR_N[r]}</em> · ${String(TYPE_LBL[c.type]).split(',')[0]} · ${starsHTML(cstar(c.id),'sm')}</span></div>
    <div class="rvsk"></div></div><button class="rvnext" hidden>NEXT ▶</button><div class="rvcta" hidden></div>`;
  $('#app').appendChild(el);const cv=el.querySelector('.rvfx'),rc=$('#app').getBoundingClientRect();cv.width=Math.round(rc.width);cv.height=Math.round(rc.height);
  Object.assign(RV,{on:true,el,done,id,kind,step:0,sparks:[],burst:null,t0:performance.now(),timers:[],tilt:{x:0,y:0,tx:0,ty:0,drag:0},stop:null});
  rvCanvasFx();rvTilt();SFX.amb('wind');
  const T=(ms,f)=>RV.timers.push(setTimeout(()=>{if(RV.on&&RV.el===el)f();},ms));
  T(500,()=>SFX.play('f_thud'));T(1000,()=>{el.classList.add('k1');SFX.play('chest');});T(1500,()=>{el.classList.add('k2');SFX.play('chest');});T(2000,()=>{el.classList.add('k3');SFX.play('chest');});
  T(2500,()=>{el.classList.remove('p0');el.classList.add('p1');RV.burst=(performance.now()-RV.t0)/1000;SFX.play(r>=3?'legend':r>=2?'epic':'chestopen');const w=cv.width,h=cv.height;rvBurst(w/2,h*.5,70,hh.col);});
  T(3900,()=>{el.classList.remove('p1');el.classList.add('p2');rvBurst(cv.width/2,cv.height*.42,24,RAR_C[r]);});
  T(4300,()=>{const nx=el.querySelector('.rvnext');nx.hidden=false;});
  const stage=el.querySelector('.rvstage');
  const pt=e=>{const q=e.touches?e.touches[0]:e,b=stage.getBoundingClientRect();RV.tilt.drag=1;RV.tilt.tx=fClamp((q.clientX-(b.left+b.width/2))/(b.width/2),-1,1)*26;RV.tilt.ty=fClamp((q.clientY-(b.top+b.height/2))/(b.height/2),-1,1)*16;};
  stage.addEventListener('pointerdown',e=>{pt(e);});stage.addEventListener('pointermove',e=>{if(RV.tilt.drag)pt(e);});['pointerup','pointercancel','pointerleave'].forEach(n=>stage.addEventListener(n,()=>{RV.tilt.drag=0;}));
  el.querySelector('.rvnext').addEventListener('click',()=>{SFX.play('tap',60);rvGo(RV.step+1);});
  el.querySelector('.rvskip').addEventListener('click',()=>{rvEnd(true);});}
