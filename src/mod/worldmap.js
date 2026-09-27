/* =========================== THE ROAD NORTH — world map with 50 stages (v1.0.45) ===========================
   The board map (720 wide) plus a strip beyond the Wall drawn in code (y < 0). Shown at twice the screen width; drag to pan. */
const MAP_BEY=200,MAPVIEW={l:null,t:null};
function nextStage(){return LEVELS.find(l=>levelOpen(null,l)&&!campOf()[l.id])||LEVELS[LEVELS.length-1];}
function beyondSVG(){const W0=MAPW,y0=-MAP_BEY;let m='';
  const peaks=[[0,-40],[60,-120],[120,-70],[190,-150],[250,-95],[330,-175],[400,-110],[470,-160],[540,-90],[610,-140],[680,-80],[720,-110]];
  m+=`<rect x="0" y="${y0}" width="${W0}" height="${MAP_BEY+36}" fill="url(#mSnow)"/>`;
  m+=`<path d="M0 ${y0} ${peaks.map(p=>'L'+p[0]+' '+(p[1]-40)).join(' ')} L${W0} ${y0} Z" fill="#b9cbd9" opacity=".75"/>`;
  m+=`<path d="M0 ${y0} ${peaks.map(p=>'L'+p[0]+' '+(p[1]-40)).join(' ')} L${W0} ${y0} Z" fill="none" stroke="#f4f9fc" stroke-width="3" opacity=".8"/>`;
  for(let i=0;i<46;i++){const x=(i*157)%W0,y=-20-((i*71)%150);m+=`<path d="M${x} ${y} l7 -18 l7 18 z" fill="#2f5a4a" opacity=".8"/><path d="M${x+3} ${y-9} l4 -9 l4 9 z" fill="#f4f9fc" opacity=".9"/>`;}
  m+=`<text x="${W0/2}" y="-178" text-anchor="middle" font-family="Cinzel,serif" font-weight="900" font-size="17" letter-spacing="7" fill="#3d5a70">THE LANDS OF ALWAYS WINTER</text>`;
  m+=`<rect x="0" y="16" width="${W0}" height="26" fill="#dcebf5"/><rect x="0" y="16" width="${W0}" height="6" fill="#ffffff" opacity=".9"/><rect x="0" y="38" width="${W0}" height="5" fill="#7fa3bd" opacity=".7"/>`;
  for(let x=6;x<W0;x+=22)m+=`<rect x="${x}" y="22" width="12" height="16" fill="#c6dbe9" opacity=".7"/>`;
  m+=`<text x="${W0/2}" y="12" text-anchor="middle" font-family="Cinzel,serif" font-weight="900" font-size="12" letter-spacing="6" fill="#3d5a70">THE WALL</text>`;
  return m;}
function mapSVG(selId){
  const C=campOf(),next=nextStage();
  const road=LEVELS.map(l=>MAPPOS[l.id]);let seg=[];
  for(let i=1;i<road.length;i++){const q=road[i-1],p=road[i],mx=(q[0]+p[0])/2,my=(q[1]+p[1])/2,dx=p[0]-q[0],dy=p[1]-q[1],bend=(i%2?1:-1)*0.14;seg.push(`M${q[0]} ${q[1]} Q${(mx-dy*bend).toFixed(1)} ${(my+dx*bend).toFixed(1)} ${p[0]} ${p[1]}`);}
  const doneN=LEVELS.filter(l=>C[l.id]).length;
  const roadDone=seg.slice(0,Math.max(0,next.id-1)).join(' '),roadLeft=seg.slice(Math.max(0,next.id-1)).join(' ');
  const nodes=LEVELS.map(L=>{const [x,y]=MAPPOS[L.id],st=C[L.id]||0,open=levelOpen(null,L),isNext=L.id===next.id&&!st,sel=L.id===selId,boss=L.boss;
    const r=boss?17:14,fill=st?'#e3b661':open?'#9b2323':'#48505b',stroke=sel?'#ffffff':st?'#7a4f0e':open?'#ffd97a':'#262b33';
    const pulse=isNext?`<circle cx="${x}" cy="${y}" r="${r+2}" fill="none" stroke="#ffd97a" stroke-width="3.5"><animate attributeName="r" values="${r+2};${r+22}" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values=".95;0" dur="1.5s" repeatCount="indefinite"/></circle>`:'';
    const stars=st?`<rect x="${x-19}" y="${y+r+1}" width="38" height="14" rx="7" fill="rgba(20,12,4,.82)"/><text x="${x}" y="${y+r+12}" text-anchor="middle" font-size="11" fill="#ffd97a">${'★'.repeat(st)}${'☆'.repeat(3-st)}</text>`:'';
    const lbl=(sel||isNext)?`<g><rect x="${x-L.n.length*4.3-10}" y="${y-r-30}" width="${L.n.length*8.6+20}" height="21" rx="10" fill="#f4efe2" stroke="#3a2a14" stroke-width="1.6"/><text x="${x}" y="${y-r-15}" text-anchor="middle" font-family="Cinzel,serif" font-weight="900" font-size="12.5" fill="#3a2a14">${L.n}</text></g>`:'';
    const ic=boss?`<path d="M${x-8} ${y-r-3} l4 -6 l4 4 l4 -6 l4 6 l4 -4 l4 6 z" fill="${st?'#ffe9a8':'#ffd97a'}" stroke="#3a2a14" stroke-width="1.2"/>`:'';
    return `<g class="mn ${open?'open':'lock'}" data-l="${L.id}">${pulse}<circle cx="${x}" cy="${y+3}" r="${r}" fill="rgba(0,0,0,.45)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sel?4:2.6}"/>${ic}
      <text x="${x}" y="${y+5}" text-anchor="middle" font-family="Cinzel,serif" font-weight="900" font-size="${L.id>9?13:15}" fill="${st?'#3a2a14':open?'#fff3d6':'#aab2bd'}">${open?L.id:'🔒'}</text>${stars}${lbl}</g>`;}).join('');
  return `<svg class="wmap2" viewBox="0 ${-MAP_BEY} ${MAPW} ${MAPH+MAP_BEY}" xmlns="http://www.w3.org/2000/svg">
   <defs><linearGradient id="mSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ec"/><stop offset="1" stop-color="#eef5fa"/></linearGradient>
   <linearGradient id="mVig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".95" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
   <image href="${MAP_ART}" x="0" y="0" width="${MAPW}" height="${MAPH}" preserveAspectRatio="none"/>
   ${beyondSVG()}
   <rect x="0" y="${-MAP_BEY}" width="${MAPW}" height="${MAPH+MAP_BEY}" fill="url(#mVig)"/>
   <path d="${roadLeft}" fill="none" stroke="#1d1208" stroke-width="7" stroke-linecap="round" opacity=".35"/>
   <path d="${roadLeft}" fill="none" stroke="#fff3d6" stroke-width="3" stroke-dasharray="7 8" stroke-linecap="round" opacity=".9"/>
   <path d="${roadDone}" fill="none" stroke="#1d1208" stroke-width="8" stroke-linecap="round" opacity=".45"/>
   <path d="${roadDone}" fill="none" stroke="#e3b661" stroke-width="4.5" stroke-linecap="round"/>
   ${nodes}
  </svg>`;}
function showCampaign(tab,selId){
  const hh=HOUSES[ACC.house],L=lang(),c=CBY[ACC.sel];
  const auto=nextStage();const L0=(selId&&LEVELS.find(l=>l.id===selId&&levelOpen(null,l)))||auto;const C=campOf(),st=C[L0.id]||0;
  const news=(POOLS[L0.id]||[]).map(k=>enemyIconHTML(k,30)).join('');const hard=ACC.diff==='kingsguard';
  const pc=`<div class="playcard mapcard2" id="playcard">
      <div class="gt">STAGE ${L0.id} OF ${LEVELS.length}${hard?' · HARD':''}${L0.mod?' · '+MODS[L0.mod].e+' '+MODS[L0.mod].n.toUpperCase():''}${L0.boss?' · 👑 BATTLE':''}</div><h2>${L0.n}</h2>
      <div class="sb">${L0.sub} · ${BIOME_E[L0.biome]||''} ${L0.waves} waves · ${(L0.gates||[GX]).length} gate${(L0.gates||[GX]).length>1?'s':''}${st?' · best '+'★'.repeat(st)+'☆'.repeat(3-st):''}</div>
      ${news?`<div class="en"><small>new</small> ${news}</div>`:''}
      <button class="go" id="bGo">${st?'DEFEND AGAIN':'HOLD THE DOOR'}</button>
      <div style="display:flex;gap:6px;margin-top:7px">
        ${hardOpen()?`<button class="btn sec" id="bDiff" style="margin:0;flex:1">${DIFFS[ACC.diff].e} ${DIFFS[ACC.diff].lbl}</button>`:`<button class="btn sec" id="bNextC" style="margin:0;flex:1">📍 Stage ${auto.id}</button>`}
        <button class="btn sec" id="bOn" style="margin:0;flex:1">🚪 Daily Hold</button>
      </div></div>`;
  show(`<div class="home">
    <div class="hbar"><button class="back" id="bHubBack" style="position:static;margin-right:2px">◀</button>${crest(ACC.house,34)}<span class="who"><b>The road north</b><small>${cleared()}/${LEVELS.length} stages · ⭐ ${starsEarned()} · ${flag(L.c,14)} ${L.c}</small></span>
      <span class="cur">🪙 ${fmtN(goldOf())}<br>💎 ${ACC.gems}</span></div>
    <div class="mapview" id="mapview">${mapSVG(L0.id)}</div>
    ${pc}
    ${hubTabs('battle')}</div>`,'full');
  document.querySelectorAll('.hubtabs button').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',60);showHub(b.dataset.tab);}));
  $('#bGo').addEventListener('click',()=>startGame({mode:'campaign',level:L0}));
  const bd=$('#bDiff');if(bd)bd.addEventListener('click',()=>showDifficulty(false));
  const bn=$('#bNextC');if(bn)bn.addEventListener('click',()=>{MAPVIEW.l=null;showCampaign('gates',auto.id);});
  $('#bOn').addEventListener('click',()=>showHub('hold'));
  $('#bHubBack').addEventListener('click',()=>showHub('battle'));
  const mv=$('#mapview'),svg=mv.querySelector('svg');
  let drag=null,moved=0;
  mv.querySelectorAll('.mn.open').forEach(g=>g.addEventListener('click',()=>{if(moved>8)return;MAPVIEW.l=mv.scrollLeft;MAPVIEW.t=mv.scrollTop;SFX.play('tap',50);showCampaign('gates',+g.dataset.l);}));
  /* drag to pan with a mouse; touch uses native scrolling */
  mv.addEventListener('mousedown',e=>{drag={x:e.clientX,y:e.clientY,l:mv.scrollLeft,t:mv.scrollTop};moved=0;});
  const end=()=>{drag=null;};mv.addEventListener('mouseup',end);mv.addEventListener('mouseleave',end);
  mv.addEventListener('mousemove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved=Math.max(moved,Math.abs(dx)+Math.abs(dy));mv.scrollLeft=drag.l-dx;mv.scrollTop=drag.t-dy;});
  requestAnimationFrame(()=>{const k=svg.getBoundingClientRect().width/MAPW;if(MAPVIEW.l!=null){mv.scrollLeft=MAPVIEW.l;mv.scrollTop=MAPVIEW.t;MAPVIEW.l=null;return;}
    const [px,py]=MAPPOS[L0.id];mv.scrollLeft=Math.max(0,px*k-mv.clientWidth/2);mv.scrollTop=Math.max(0,(py+MAP_BEY)*k-mv.clientHeight*0.55);});
}
