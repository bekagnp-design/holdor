/* =========================== THE FORGE SCENE (v1.0.90) ===========================
   Upgrading an item (or raising its tier) plays a short scene instead of a silent wait: the item lies on an anvil, a hammer strikes it
   three times with sparks while the server decides; then the verdict — success: a flash, a golden ring, sparks, "+3" rising;
   failure: the item shakes, grey smoke, "NOT THIS TIME · the item is safe". The result comes from the server as before; the scene only
   shows it (and waits for at least 1.9 s so the hammer lands). Tap to skip the verdict. Calm mode (reduced motion) is shorter and still. */
let GFX=null;
function gfxCalm(){return (typeof JUICE!=='undefined'&&JUICE.calm)||(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches);}
function gfxEnd(){const g=GFX;GFX=null;if(!g)return;clearTimeout(g.t1);clearInterval(g.t2);clearTimeout(g.t3);clearTimeout(g.t4);if(g.el&&g.el.parentNode)g.el.remove();}
function gfxSpark(el,n,gold){const box=el.querySelector('.gfs');if(!box)return;
  for(let k=0;k<n;k++){const s=document.createElement('i');s.className='gfk'+(gold?' g':'');s.style.left=(gold?50:46)+'%';s.style.top=(gold?36:52)+'%';
    s.style.setProperty('--dx',((Math.random()-.5)*(gold?260:150))+'px');s.style.setProperty('--dy',(-30-Math.random()*(gold?190:90))+'px');s.style.animationDuration=(0.45+Math.random()*(gold?.7:.35))+'s';
    box.appendChild(s);setTimeout(()=>s.remove(),1300);}}
function gfxStart(it,mode){gfxEnd();const app=document.getElementById('app');if(!app||!it)return null;const calm=gfxCalm();
  const el=document.createElement('div');el.id='gfx';el.className=mode==='tier'?'tier':'';
  el.innerHTML=`<div class="gfs"><div class="gfi">${gearBig(it)}</div>
    <svg class="gfa" viewBox="0 0 140 60"><path d="M10 14h112c10 0 14 8 6 14-8 4-22 4-30 6l-4 12h16v8H34v-8h16l-4-12c-12-2-26-2-34-6-6-5-4-14 6-14z" fill="#3a3d42" stroke="#101214" stroke-width="2"/><path d="M14 17h104" stroke="#8a9098" stroke-width="2" opacity=".6"/><path d="M42 36h56" stroke="#000" opacity=".3"/></svg>
    <svg class="gfh${calm?' calm':''}" viewBox="0 0 120 120"><rect x="56" y="38" width="9" height="80" rx="3" fill="url(#gaWd)" stroke="#3a2414"/><path d="M28 12h66c5 0 7 3 7 7v18c0 4-2 7-7 7H28c-4 0-6-3-6-7V19c0-4 2-7 6-7z" fill="#7e868e" stroke="#15181b" stroke-width="2"/><path d="M30 16h60" stroke="#d6dce2" stroke-width="2" opacity=".6"/><path d="M22 40h79" stroke="#3a4046" stroke-width="3"/></svg>
    <div class="gft" id="gft"></div></div>`;
  app.appendChild(el);const g={el,t0:performance.now(),calm,rev:false,done:null};GFX=g;
  if(!calm){g.t1=setTimeout(()=>{if(GFX!==g)return;hit();g.t2=setInterval(()=>{if(GFX!==g)return;hit();},620);},385);}
  function hit(){gfxSpark(el,9,false);try{SFX.play('tap',0);}catch(e){}el.classList.remove('hit');void el.offsetWidth;el.classList.add('hit');}
  el.addEventListener('click',()=>{if(g.rev&&g.done){const d=g.done;g.done=null;gfxEnd();d();}});
  return g;}
function gfxReveal(g,ok,item,text,done){
  if(!g||GFX!==g){done();return;}
  const wait=g.calm?500:Math.max(0,1900-(performance.now()-g.t0));
  g.t3=setTimeout(()=>{if(GFX!==g){done();return;}clearInterval(g.t2);g.rev=true;const el=g.el,calm=g.calm;
    const h=el.querySelector('.gfh');if(h)h.style.display='none';
    if(item){const fi=el.querySelector('.gfi');if(fi)fi.innerHTML=gearBig(item);}
    el.classList.add(ok?'win':'lose');const t=el.querySelector('#gft');
    if(t)t.innerHTML=ok?`<b>${text}</b>`:`<b>NOT THIS TIME</b><small>the item is safe</small>`;
    if(!calm){if(ok){gfxSpark(el,26,true);}else{const box=el.querySelector('.gfs');for(let k=0;k<7;k++){const s=document.createElement('i');s.className='gfm';s.style.left=(36+Math.random()*28)+'%';s.style.animationDelay=(k*.09)+'s';box.appendChild(s);}}}
    try{SFX.play(ok?(g.mode==='tier'?'levelup':'upgrade'):'deny');}catch(e){}
    g.done=()=>done();g.t4=setTimeout(()=>{if(GFX!==g)return;const d=g.done;g.done=null;gfxEnd();if(d)d();},calm?600:(ok?1500:1250));},wait);}
function gearUpgrade(id,cid,filter){const it0=gearItems().find(x=>x.id===id),g=gfxStart(it0,'up');
  gearCall('gear_upgrade',{item:id,op:ecoUuid()},r=>{
    if(r.item){const L=ECO.gear.items;const i=L.findIndex(x=>x.id===r.item.id);if(i>=0)L[i]=r.item;}
    const ok=!!r.ok;
    gfxReveal(g,ok,r.item||it0,ok&&r.item?'+'+r.item.lvl:'',()=>{
      if(ok)ecoToast(`⚒️ Success: ${gearName(r.item)}`,true);else ecoToast(`Upgrade failed — 🪙${r.cost} gone, the item is safe`);
      persist();showForge(cid,filter);gearSheet(id,cid,filter);});});}
function gearTierUp(id,fodder,cid,filter){const it0=gearItems().find(x=>x.id===id),g=gfxStart(it0,'tier');if(g)g.mode='tier';
  gearCall('gear_tier_up',{item:id,fodder,op:ecoUuid()},r=>{
    gfxReveal(g,true,r.item,'★ Tier '+gearTier(r.item),()=>{ecoToast(`⬆ ${gearName(r.item)} is now tier ${gearTier(r.item)}`,true);persist();showForge(cid,filter);gearSheet(id,cid,filter);});});}
