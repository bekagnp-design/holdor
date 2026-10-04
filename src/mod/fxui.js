/* =========================== FX UI (v1.0.96) — the menus move ===========================
   Display only and menus only: nothing here exists during a battle (it is taken down when a battle starts) and nothing reads or
   writes the simulation. It builds on the v1.0.77 juice (press springs, count-up, coin flight, rise-in, chest wiggle, Battle shine,
   tab hop, dot pulse) and adds:
   · home, all three looks: house-coloured motes drifting over the stage art (snow falls, embers and dust rise, rain streaks),
     a soft light sweep, a slight parallax on drag or on tilt (DeviceOrientation when the phone sends it), a breathing glow behind BATTLE
   · tabs: the new tab's content grows out of the tapped tab's side (220 ms); the tapped tab flashes
   · attention: ready chest slots glow, today's calendar day pulses, the currency icons glint now and then, the modal pops on a spring
   · collection: unlocked portraits breathe (1 → 1.015), Epic and Legendary cards shimmer (only the cards on screen)
   CSS animations do the moving (opacity, translate, scale: the compositor); JS only places and tags. Off when the phone asks for less
   motion, paused when the page is hidden (the root class goes), a slow phone gets half the motes and still portraits. */
const FXUI={off:false,lite:false,tapX:null,tapAt:0,tapTab:null,bound:false,io:null,probed:0,err:null,par:{x:0,y:0,tx:0,ty:0,raf:0,g0:null,b0:null,drag:null}};
const FXUI_COL={stark:'#eef6ff',targaryen:'#ff8a3c',lannister:'#ffd46b',baratheon:'#ffc861',greyjoy:'#bfe3ff',tyrell:'#ffc0d8',martell:'#ffb45a'};
function fxuiCalm(){if(FXUI.off)return true;try{return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return false;}}
function fxuiLive(){return !fxuiCalm()&&!document.hidden&&!(typeof G!=='undefined'&&G&&G.state==='play');}
function fxuiRoot(on){document.documentElement.classList.toggle('fxui',!!on);}
function fxuiBind(){if(FXUI.bound)return;FXUI.bound=true;
  const tap=e=>{const b=e.target&&e.target.closest&&e.target.closest('.hubtabs button');if(!b)return;const r=b.getBoundingClientRect();FXUI.tapX=r.left+r.width/2;FXUI.tapAt=performance.now();FXUI.tapTab=b.dataset.tab;};
  document.addEventListener('pointerdown',tap,{passive:true,capture:true});document.addEventListener('click',tap,{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)fxuiRoot(false);else if(fxuiLive())fxuiRoot(true);});
  window.addEventListener('deviceorientation',fxuiTilt,{passive:true});
  window.addEventListener('resize',()=>{if(fxuiLive())fxuiGlowPlace();},{passive:true});}
/* called after every hub render (wrapped around juiceHub below) */
function fxuiHub(tab){try{fxuiBind();if(fxuiCalm()||(typeof G!=='undefined'&&G&&G.state==='play')){fxuiOff();return;}fxuiRoot(fxuiLive());
    const fresh=FXUI.tapAt&&performance.now()-FXUI.tapAt<900;
    const body=document.getElementById('hubBody');
    if(body&&(body.classList.contains('slide-r')||body.classList.contains('slide-l'))){
      body.style.setProperty('--fxox',fresh&&FXUI.tapX!=null?Math.round(100*FXUI.tapX/Math.max(1,window.innerWidth))+'%':'50%');body.classList.add('fxin');
      let done=false;const end=e=>{if(done||(e&&(e.target!==body||e.animationName!=='fxTabIn')))return;done=true;body.classList.remove('fxin','slide-r','slide-l');body.removeEventListener('animationend',end);};
      body.addEventListener('animationend',end);setTimeout(()=>end(),450);}
    if(fresh){const on=document.querySelector('.hubtabs button.on');if(on&&on.dataset.tab===FXUI.tapTab){const f=document.createElement('i');f.className='fxtapf';on.appendChild(f);setTimeout(()=>f.remove(),600);}FXUI.tapAt=0;}
    if(tab==='battle')fxuiHome();
    if(tab==='coll')fxuiColl();else if(FXUI.io){FXUI.io.disconnect();FXUI.io=null;}
  }catch(e){FXUI.err=e.message;}}
/* ---- home: motes, light sweep, parallax, the breathing BATTLE ---- */
function fxuiHome(){const st=document.getElementById('hmStage');if(!st)return;
  if(!st.querySelector('.fxamb')){
    const k=typeof hmFxKind==='function'?hmFxKind():'snow',mode=k==='ember'||k==='sand'?'rise':k==='rain'?'rain':'fall',look=typeof skinOf==='function'?skinOf():'b';
    const n=look==='c'?14:10,H=Math.max(160,st.clientHeight||300);let h='';
    for(let i=0;i<n;i++){const s=mode==='rain'?2:Math.round(5+Math.random()*(look==='c'?9:12)),d=(mode==='rise'?9:12)+Math.random()*9;
      h+=`<i style="left:${(4+92*(i+Math.random())/n).toFixed(1)}%;--s:${s}px;--d:${d.toFixed(1)}s;--dx:${Math.round((Math.random()-0.5)*50)}px;--o:${(0.35+Math.random()*0.45).toFixed(2)};animation-delay:${(-Math.random()*d).toFixed(1)}s"></i>`;}
    const L=document.createElement('div');L.className='fxamb '+mode;L.style.setProperty('--h',(H+40)+'px');L.style.setProperty('--c',FXUI_COL[ACC&&ACC.house]||'#fff');
    L.innerHTML=h+'<b class="fxsw"></b>';st.insertBefore(L,st.querySelector('.hmtitle'));}
  const P=FXUI.par;P.x=P.y=P.tx=P.ty=0;P.drag=null;
  if(!st.dataset.fxp){st.dataset.fxp='1';
    st.addEventListener('pointerdown',e=>{FXUI.par.drag={x:e.clientX,y:e.clientY};},{passive:true});
    st.addEventListener('pointermove',e=>{const d=FXUI.par.drag;if(d)fxuiParTo((e.clientX-d.x)/90,(e.clientY-d.y)/90);},{passive:true});
    const up=()=>{if(FXUI.par.drag){FXUI.par.drag=null;fxuiParTo(0,0);}};
    for(const ev of ['pointerup','pointercancel','pointerleave'])st.addEventListener(ev,up,{passive:true});}
  fxuiGlowPlace();fxuiProbe();}
function fxuiParTo(x,y){const P=FXUI.par;P.tx=Math.max(-1,Math.min(1,x));P.ty=Math.max(-1,Math.min(1,y));if(P.raf)return;
  P.raf=requestAnimationFrame(()=>{P.raf=0;const st=document.getElementById('hmStage');if(!st||!fxuiLive())return;
    if(Math.abs(P.tx-P.x)<0.02&&Math.abs(P.ty-P.y)<0.02)return;P.x=P.tx;P.y=P.ty;st.style.setProperty('--fxpx',P.x.toFixed(2));st.style.setProperty('--fxpy',P.y.toFixed(2));});}
function fxuiTilt(e){if(e.gamma==null||FXUI.par.drag||typeof CLOUD==='undefined'||CLOUD.screen!=='hub:battle')return;const P=FXUI.par;
  if(P.g0==null){P.g0=e.gamma;P.b0=e.beta;}P.g0+=(e.gamma-P.g0)*0.02;P.b0+=(e.beta-P.b0)*0.02;   /* the rest position follows slowly */
  fxuiParTo((e.gamma-P.g0)/16,(e.beta-P.b0)/16);}
function fxuiGlowPlace(){const bb=document.getElementById('bBattle');if(!bb||!document.getElementById('hmStage'))return;const row=bb.parentElement;let g=row.querySelector('.fxglow');
  if(bb.classList.contains('pulse')){if(g)g.remove();return;}   /* before the first lesson the old pulse already calls */
  if(!g){g=document.createElement('i');g.className='fxglow';row.insertBefore(g,bb);}
  g.style.cssText=`left:${bb.offsetLeft}px;top:${bb.offsetTop}px;width:${bb.offsetWidth}px;height:${bb.offsetHeight}px`;}
/* a slow phone (40 % of 90 frames over 30 ms) gets half the motes and still portraits, for the rest of the session */
function fxuiProbe(){if(FXUI.probed||FXUI.lite)return;FXUI.probed=1;let n=0,slow=0,last=0;
  const f=now=>{if(document.hidden||CLOUD.screen!=='hub:battle'){FXUI.probed=0;return;}if(last){n++;if(now-last>30)slow++;}last=now;
    if(n<90){requestAnimationFrame(f);return;}if(slow>n*0.4){FXUI.lite=true;document.documentElement.classList.add('fxlite');}};
  requestAnimationFrame(f);}
/* ---- collection: rarity tags, breathing portraits, only for the cards on screen ---- */
function fxuiColl(){const body=document.getElementById('hubBody');if(FXUI.io){FXUI.io.disconnect();FXUI.io=null;}if(!body)return;
  const cards=body.querySelectorAll('.ccard[data-c]');if(!cards.length)return;
  if('IntersectionObserver' in window)FXUI.io=new IntersectionObserver(es=>{for(const e of es)e.target.classList.toggle('fxvis',e.isIntersecting);},{root:body,rootMargin:'40px'});
  cards.forEach((el,i)=>{const c=CBY[el.dataset.c];if(!c)return;const r=rarOf(c)[0];if(r==='Epic')el.classList.add('fxrE');else if(r==='Legendary')el.classList.add('fxrL');
    if(!el.classList.contains('lock'))el.classList.add('fxbr');el.style.setProperty('--fxph',(-((i*0.61)%3.8)).toFixed(2)+'s');
    if(FXUI.io)FXUI.io.observe(el);else el.classList.add('fxvis');});}
/* ---- off: a battle starts, or the phone asks for less motion ---- */
function fxuiOff(){fxuiRoot(false);document.querySelectorAll('.fxamb,.fxglow,.fxtapf').forEach(e=>e.remove());
  if(FXUI.io){FXUI.io.disconnect();FXUI.io=null;}const P=FXUI.par;if(P.raf){cancelAnimationFrame(P.raf);P.raf=0;}P.drag=null;}
if(typeof juiceHub==='function'){const jh0=juiceHub;juiceHub=function(tab){jh0(tab);fxuiHub(tab);};}
if(typeof startGame==='function'){const sg0=startGame;startGame=function(){try{fxuiOff();}catch(e){}return sg0.apply(this,arguments);};}