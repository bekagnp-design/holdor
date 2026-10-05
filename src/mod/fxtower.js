/* =========================== TOWER GUIDE + TOWER FX (v1.0.97) ===========================
   Every tower says what it does, in plain numbers taken from the game's own data (towerStats), and shows it working.
   · towerGuideMini(type, lvl): who it hits, how much (damage, rate, damage per second, splash, burn, slow), strong / weak against.
     Shown in the build sheet and in the tower's sheet (ℹ on the ring); the Collection → Towers page gets a looping demo (towerGuideDemo).
   · battle fx (display only: reads G, writes nothing of the simulation, no G.rng): Dragonglass spears burst from the ground under
     what the zone cuts (bigger on a White Walker), Weirwood sends a wave over its ground and roots tangle the slowed, a Wildfire
     shell blooms in green fire where it lands, a Scorpion glows as its bolt loads, the Keep's men throw sparks when they strike.
     Capped, off under prefers-reduced-motion, frozen while paused or hidden. */
const FXT={on:true,calm:false,last:0,S:new WeakMap(),sp:[],bl:[],pp:new Map(),map:null,runs:-1,AS:new WeakMap()};
try{FXT.calm=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){}
const FXT_R=Math.random;
/* ---- the guide: facts that are true in the code (dmg(), the target loop, the zone / aura loop, the keep's men) ---- */
const TGUIDE={
  watch:{hits:'Ground + air (fliers only when nothing else is in range)',role:'Fast arrows, one target at a time',strong:'Light, quick enemies and birds',weak:'Armoured and arrow-proof enemies take much less. Pair it with Wildfire or Dragonglass',demo:'arrow'},
  scorp:{hits:'Ground + air (aims at flyers first)',role:'Slow, heavy bolt',strong:'Armoured enemies ×2.5. The only tower that hurts a dragon fully; everything else deals only 30% to it',weak:'Slow reload: wasted on swarms',demo:'bolt'},
  wild:{hits:'Ground + air (fliers only when nothing else is in range)',role:'A shell that bursts and sets enemies on fire',strong:'Packs: everyone in the blast takes the damage, then burns',weak:'Cannot hit what is closer than 45 to it; a flier is the last target it picks',demo:'lob'},
  glass:{hits:'Ground only',role:'A zone: hurts and slows everything inside, no shots',strong:'White Walkers take ×3. All enemies inside are slowed',weak:'Short range, and it cannot touch flyers',demo:'spears'},
  weir:{hits:'Ground + air (no damage of its own)',role:'An aura: slows and makes enemies take more damage',strong:'Everything inside takes more damage from every tower and hero',weak:'Deals no damage itself. Build it beside damage towers',demo:'roots'},
  keep:{hits:'Ground only',role:'Your men block the road and fight',strong:'Holds the road so other towers keep firing; fallen men return',weak:'Flyers pass over them',demo:'clash'}};
function tgNums(type,lvl){const d=TOWERS[type],st=towerStats({type,lvl:lvl||1}),r=Math.round(st.range),f=x=>Math.round(x*10)/10,o=[];
  if(d.kind==='single'||d.kind==='splash'){o.push(['⚔','Damage',Math.round(st.dmg)+' per hit']);o.push(['⏱','Rate',st.rate.toFixed(2)+' / s']);o.push(['🔥','Damage per second',f(st.dmg*st.rate)]);
    if(d.kind==='splash'){o.push(['💥','Blast radius',Math.round(st.splash)]);o.push(['🔥','Burn',f(st.burn)+' / s for 3 s']);}o.push(['🎯','Range',r]);}
  else if(d.kind==='zone'){o.push(['🔷','Damage per second',Math.round(st.dps)+' (×3 vs White Walkers)']);o.push(['🐌','Slow',Math.round((1-st.slow)*100)+'%']);o.push(['🎯','Range',r]);}
  else if(d.kind==='aura'){o.push(['🐌','Slow',Math.round((1-st.slow)*100)+'%']);o.push(['⬆','Damage taken','+'+Math.round((st.mark-1)*100)+'%']);o.push(['🎯','Range',r]);}
  else{o.push(['🛡','Men',st.count+' × '+st.shp+' hp']);o.push(['⚔','Their damage',st.sdmg+' per hit']);o.push(['⏳','Back in',st.resp+' s']);o.push(['🎯','Range',r]);}
  return o;}
function towerGuideMini(type,lvl){const g=TGUIDE[type];if(!g)return '';const n=tgNums(type,lvl);
  return `<div class="tg"><div class="tgh"><span>${g.hits}</span><em>${g.role}</em></div><div class="tgn">${n.map(x=>`<span title="${x[1]}">${x[0]} <b>${x[2]}</b></span>`).join('')}</div>
  <div class="tgs"><i class="ok">✔ ${g.strong}</i><i class="no">✖ ${g.weak}</i></div></div>`;}
function towerGuideDemo(type,lvl){const g=TGUIDE[type];if(!g)return '';return `<div class="tgd ${g.demo}"><u class="tw">${towerIconHTML(type,lvl||1,30)}</u><u class="en"></u><u class="fx"></u><u class="fx2"></u></div>`;}
/* ---- battle fx ---- */
function fxtOk(){return FXT.on&&!FXT.calm&&G.map&&G.state==='play'&&!G.paused&&!document.hidden;}
function fxtUnder(now){try{fxtUnderB(now);}catch(_){FXT.on=false;}}
function fxtUnderB(now){const ms=now-FXT.last;FXT.last=now;if(!fxtOk()){if(G.state!=='play'&&(FXT.sp.length||FXT.bl.length)){FXT.sp.length=0;FXT.bl.length=0;FXT.pp.clear();}return;}
  if(G.map!==FXT.map||G.runs!==FXT.runs){FXT.map=G.map;FXT.runs=G.runs;FXT.sp.length=0;FXT.bl.length=0;FXT.pp.clear();}
  const dt=Math.min(0.05,Math.max(0,ms/1000)),R=FXT_R,slots=G.map.slots;
  /* wildfire shells: remember where each one is going; when it is gone, a green bloom there */
  if(G.projs.length||FXT.pp.size){const live=new Set();for(const p of G.projs){if(p.src==='wild'){live.add(p);FXT.pp.set(p,{x:p.lx,y:p.ly,r:p.splash||48});}}
    for(const [p,v] of FXT.pp){if(!live.has(p)){FXT.pp.delete(p);if(FXT.bl.length<8)FXT.bl.push({x:v.x,y:v.y,r:v.r,life:0.7,max:0.7});}}}
  for(let si=0;si<slots.length;si++){const s=slots[si],t=s.tower;if(!t)continue;const def=TOWERS[t.type];
    let S=FXT.S.get(t);if(!S){S={a:0,b:0,rg:0,rng:0,n:0};FXT.S.set(t,S);}
    if((S.n++&31)===0)S.rng=towerStats(t).range;const range=S.rng;
    if(def.kind==='zone'){let tg=null,k=0;for(const e of G.enemies){if(e.hp<=0||e.fly)continue;const p=posE(e);if(dist(p.x,p.y,s.x,s.y)>range+e.r)continue;k++;if(R()*k<1)tg=e;}
      if(k){const pulse=0.1+0.05*Math.sin(now/180);ctx.globalAlpha=pulse;ctx.strokeStyle='#8fd3ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(s.x,s.y+8,range,range*0.5,0,0,6.283);ctx.stroke();ctx.globalAlpha=1;
        S.a-=dt;if(S.a<=0&&FXT.sp.length<24){S.a=0.26;const p=posE(tg);FXT.sp.push({x:p.x+(R()-0.5)*14,y:p.y+3,life:0.5,max:0.5,big:!!tg.walker,sd:R()});}}}
    else if(def.kind==='aura'){let any=false;S.b-=dt;
      for(const e of G.enemies){if(e.hp<=0)continue;const p=posE(e);if(dist(p.x,p.y,s.x,s.y)>range+e.r)continue;any=true;
        const q=e.fly?p.y+18:p.y+4;ctx.strokeStyle='rgba(120,80,48,0.75)';ctx.lineWidth=1.4;const w=9+Math.sin(now/260+e.id)*1.5;ctx.beginPath();ctx.moveTo(p.x-w,q+2);ctx.quadraticCurveTo(p.x-w*0.3,q-4,p.x,q+1);ctx.quadraticCurveTo(p.x+w*0.4,q+5,p.x+w,q-1);ctx.stroke();
        ctx.strokeStyle='rgba(150,235,110,0.55)';ctx.beginPath();ctx.moveTo(p.x-w*0.7,q);ctx.quadraticCurveTo(p.x,q+4,p.x+w*0.7,q+1);ctx.stroke();}
      if(any){S.rg+=dt;if(S.rg>1.5)S.rg=0;const k=S.rg/1.5;ctx.globalAlpha=0.28*(1-k);ctx.strokeStyle='#9be66e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.x,s.y+8,range*k,range*k*0.5,0,0,6.283);ctx.stroke();ctx.globalAlpha=1;}}
    else if(t.type==='scorp'){const c=t.cd;if(c<0.32){const k=Math.max(0,1-c/0.32),g=fxbSoft('255,214,120');ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.35+0.5*k*(0.7+0.3*Math.sin(now/45));ctx.drawImage(g,s.x-10-8*k,s.y-34-8*k,20+16*k,20+16*k);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}}
    else if(def.kind==='barracks'){for(const a of G.allies){if(a.home!==s.id||a.strikeT==null)continue;if(G.time-a.strikeT>0.07)continue;if(FXT.AS.get(a)===a.strikeT)continue;FXT.AS.set(a,a.strikeT);
      const x=a.x+(a.face||1)*11,y=a.y-8;for(let i=0;i<5;i++){const an=-Math.PI/2+(R()-0.5)*2.4,v=60+R()*80,p=fxbP(3,x,y,Math.cos(an)*v,Math.sin(an)*v,0.14+R()*0.1,1.3,i%2?'#fff1c0':'#ffd479',240);if(p)p.add=1;}}}}
  /* dragonglass spears */
  for(let i=FXT.sp.length-1;i>=0;i--){const o=FXT.sp[i];o.life-=dt;if(o.life<=0){FXT.sp.splice(i,1);continue;}const k=1-o.life/o.max,rise=k<0.3?k/0.3:1,fade=k<0.6?1:(1-k)/0.4,L=(o.big?30:20)*rise,w=o.big?4.2:3;
    ctx.globalAlpha=fade;ctx.fillStyle='#16303f';ctx.beginPath();ctx.moveTo(o.x-w,o.y);ctx.lineTo(o.x,o.y-L);ctx.lineTo(o.x+w,o.y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#9fe0ff';ctx.beginPath();ctx.moveTo(o.x-w*0.2,o.y);ctx.lineTo(o.x,o.y-L);ctx.lineTo(o.x+w*0.5,o.y);ctx.closePath();ctx.fill();
    if(k<0.35){const g=fxbSoft('140,215,255');ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.7*(1-k/0.35);ctx.drawImage(g,o.x-14,o.y-10,28,18);ctx.globalCompositeOperation='source-over';}
    if(o.big&&k>0.15&&!o.sh){o.sh=1;for(let j=0;j<4;j++){const an=-Math.PI*(0.15+0.7*R()),v=50+R()*60,p=fxbP(1,o.x,o.y-12,Math.cos(an)*v*(R()<0.5?-1:1),Math.sin(an)*v,0.5,2.4,'#dff4ff',300);}}}
  ctx.globalAlpha=1;
  /* wildfire blooms */
  for(let i=FXT.bl.length-1;i>=0;i--){const o=FXT.bl[i];o.life-=dt;if(o.life<=0){FXT.bl.splice(i,1);continue;}const k=1-o.life/o.max,r=o.r*(0.55+0.45*Math.min(1,k*3)),g=fxbSoft('140,255,100');
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.6*(1-k);ctx.drawImage(g,o.x-r,o.y-r*0.7,r*2,r*1.4);
    ctx.globalCompositeOperation='source-over';
    for(let j=0;j<5;j++){const a=j*1.26+o.x,fx=o.x+Math.cos(a)*r*0.6,fy=o.y+Math.sin(a)*r*0.3,fh=7+5*Math.abs(Math.sin(now/60+j*2));ctx.globalAlpha=0.7*(1-k);ctx.fillStyle=j%2?'#b8f27a':'#4fd94a';ctx.beginPath();ctx.moveTo(fx-3,fy);ctx.quadraticCurveTo(fx,fy-fh,fx+3,fy);ctx.closePath();ctx.fill();}
    ctx.globalCompositeOperation='source-over';}
  ctx.globalAlpha=1;}
