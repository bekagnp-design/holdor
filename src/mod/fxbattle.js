/* =========================== BATTLE FX (v1.0.96) ===========================
   The battlefield answers every blow. Display only: it reads G and never writes the simulation (no G.rng, no sim fields; the one
   write is the display-only G.shake, a small capped nudge when a giant falls). Everything is pooled and capped (combat ≤ 160
   particles, ambient ≤ 90, numbers ≤ 8); a self-throttle halves the effects when frames get slow; nothing moves while the battle
   is paused or the tab is hidden; prefers-reduced-motion turns it all off.
   · a hit: the white flash takes the colour of the blow (wildfire green, fire orange, ice blue, steel stays white) + sparks
   · merged damage numbers: one per enemy per half second, small, at most 8 on the field
   · a death bursts by kind: ice shards + frost for walkers and wraiths, dust + bone for wights, dust + fur for beasts, feathers
     for birds, chitin for spiders; giants and bosses burst bigger
   · projectile trails and glow; a tower recoils with a muzzle flash and a puff of smoke when it fires
   · the gate jolts and sheds splinters (and frost in the cold) when it is hit
   · ambient life by biome, on top of drawAmbient: gusts, embers + heat haze, tumbling leaves, sand drift, rain splashes + soft
     lightning, low mist, sea spray + gull shadows, dust motes, glints on water, flickering fire light */
const FXB={on:true,calm:false,q:1,qLock:0,t:0,dt:0,last:0,ema:16.7,slowT:0,fastT:0,frame:0,CAP:160,ACAP:90,NCAP:8,
  P:[],np:0,A:[],na:0,N:[],nn:0,ER:new WeakMap(),TR:new WeakMap(),TW:new WeakMap(),trA:[],trF:[],pp:{x:0,y:0,h:0},
  kick:0,gateT:-9,flash:0,boltIn:9,gust:0,gustIn:5,wind:0,map:null,prof:null,glint:[],fires:[],dust:'200,185,160',soft:{},tint:new Map(),rgb:new Map(),
  st:{hits:0,deaths:0,shots:0,gate:0,nums:0}};
try{FXB.calm=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){}
function fxbMk(){return{x:0,y:0,vx:0,vy:0,g:0,dr:0,life:0,max:1,sz:1,gr:0,k:0,c:'#fff',im:null,r:0,vr:0,a:1,add:0,fl:0,ph:0};}
for(let i=0;i<FXB.CAP;i++)FXB.P.push(fxbMk());for(let i=0;i<FXB.ACAP;i++)FXB.A.push(fxbMk());for(let i=0;i<FXB.NCAP;i++)FXB.N.push({x:0,y:0,v:0,life:0,c:'#fff'});
const FXB_R=Math.random;
/* cached sprites: a soft disc per colour, a heat-haze strip */
function fxbSoft(rgb){let c=FXB.soft[rgb];if(c)return c;c=document.createElement('canvas');c.width=c.height=48;const x=c.getContext('2d'),g=x.createRadialGradient(24,24,0,24,24,24);
  g.addColorStop(0,'rgba('+rgb+',1)');g.addColorStop(0.42,'rgba('+rgb+',0.55)');g.addColorStop(1,'rgba('+rgb+',0)');x.fillStyle=g;x.fillRect(0,0,48,48);FXB.soft[rgb]=c;return c;}
function fxbRgb(hex){let v=FXB.rgb.get(hex);if(v)return v;if(!hex||hex[0]!=='#'){v='255,255,255';}else{const n=parseInt(hex.slice(1),16);v=(n>>16)+','+((n>>8)&255)+','+(n&255);}FXB.rgb.set(hex,v);return v;}
/* a particle from the combat pool (null when the pool is full at this quality) */
function fxbP(k,x,y,vx,vy,life,sz,c,g){if(FXB.np>=Math.floor(FXB.CAP*FXB.q))return null;const p=FXB.P[FXB.np++];
  p.k=k;p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.life=p.max=life;p.sz=sz;p.c=c;p.g=g||0;p.dr=0;p.gr=0;p.im=null;p.r=FXB_R()*6.28;p.vr=0;p.a=1;p.add=0;p.fl=0;return p;}
function fxbSoftP(x,y,vx,vy,life,sz,rgb,gr,a,add){const p=fxbP(2,x,y,vx,vy,life,sz,'');if(!p)return null;p.im=fxbSoft(rgb);p.gr=gr||0;p.a=a==null?1:a;p.add=add?1:0;return p;}
const FXB_TINT={wild:'#b4ff86',poison:'#b4ff86',burn:'#ffb15c',dany:'#ffb15c',power:'#ffb15c',dragon:'#ffb15c',glass:'#a6e0ff'};
const FXB_SPARK={wild:'#b4ff86',poison:'#b4ff86',burn:'#ffb15c',dany:'#ffb15c',power:'#ffb15c',glass:'#c9ecff',scorp:'#ffe2a0'};
/* the hit flash: the white silhouette, tinted by the kind of blow (cached per enemy type and colour) */
function fxbTint(e,wh){if(!FXB.on||FXB.calm||!wh)return wh;const c=FXB_TINT[e.lastSrc];if(!c)return wh;const key=e.type+c;let cv=FXB.tint.get(key);
  if(!cv){const w=wh.naturalWidth||wh.width,h=wh.naturalHeight||wh.height;if(!w||!h)return wh;cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');
    x.drawImage(wh,0,0,w,h);x.globalCompositeOperation='source-in';x.fillStyle=c;x.fillRect(0,0,w,h);FXB.tint.set(key,cv);}return cv;}
/* where an enemy is drawn (same jitter as drawEnemy), into one shared object */
function fxbPos(e){const p=posE(e),o=FXB.pp;o.x=e.fly?p.x:p.x+((e.id%5)-2)*3.2;o.y=e.fly?p.y:p.y+((e.id%3)-1)*3;o.h=e.dragon?44:e.arch==='bird'?14:28*(e.scale||1)*(e.big||1);return o;}
/* ---- events ---- */
function fxbHit(e,q){const src=e.lastSrc,c=FXB_SPARK[src]||'#fff4dc',n=src==='scorp'?5:3,hy=q.y-q.h*0.55;FXB.st.hits++;
  for(let i=0;i<n;i++){const a=-Math.PI/2+(FXB_R()-0.5)*2.6,v=70+FXB_R()*90;const p=fxbP(3,q.x+(FXB_R()-0.5)*5,hy+(FXB_R()-0.5)*5,Math.cos(a)*v,Math.sin(a)*v,0.16+FXB_R()*0.12,src==='scorp'?1.6:1.1,c,260);if(p)p.add=1;}
  if(c!=='#fff4dc'&&src!=='scorp'){const p=fxbSoftP(q.x,hy,0,-10,0.22,6,fxbRgb(c),0.6,0.7,1);}}
function fxbNum(x,y,v,src){if(FXB.nn>=FXB.NCAP)return;const o=FXB.N[FXB.nn++];o.x=x+(FXB_R()-0.5)*8;o.y=y;o.v=v;o.life=0.8;o.c=src==='wild'||src==='poison'?'#c8ff9e':src==='burn'||src==='dany'||src==='power'?'#ffc27a':src==='glass'?'#bfe8ff':'#f2ead8';FXB.st.nums++;}
function fxbDeath(e){if(!FXB.on||FXB.calm||!G.map)return;FXB.st.deaths++;const q=fxbPos(e),x=q.x,y=q.y,h=q.h;
  const big=!!(e.boss||e.mini||e.lord||e.king||e.dragon||(e.big||1)>=1.4),m=big?1.8:1,zs=big?1.4:1,ice=!!(e.walker||e.king||e.lord||e.arch==='wraith'||e.ice),cy=y-h*0.45,fl=y+3;
  const R=FXB_R,dust=FXB.dust;
  const shards=(n,c1,c2)=>{for(let i=0;i<n;i++){const a=-Math.PI*(0.1+0.8*R()),v=(60+R()*110)*zs;const p=fxbP(1,x+(R()-0.5)*8,cy+(R()-0.5)*h*0.4,Math.cos(a)*v*(R()<0.5?-1:1),Math.sin(a)*v,0.55+R()*0.35,(2.2+R()*2.2)*zs,i%2?c1:c2,340);if(p){p.vr=(R()-0.5)*18;p.fl=fl+R()*6;}}};
  const puffs=(n,rgb,a)=>{for(let i=0;i<n;i++)fxbSoftP(x+(R()-0.5)*14*zs,y-2-R()*h*0.3,(R()-0.5)*26,-8-R()*14,0.55+R()*0.3,(7+R()*5)*zs,rgb,1.3,a,0);};
  const bits=(k,n,c,sz,g)=>{for(let i=0;i<n;i++){const a=-Math.PI*(0.15+0.7*R()),v=(40+R()*80)*zs;const p=fxbP(k,x+(R()-0.5)*8,cy,Math.cos(a)*v*(R()<0.5?-1:1),Math.sin(a)*v,0.6+R()*0.4,sz*zs,c,g);if(p){p.vr=(R()-0.5)*12;p.fl=fl+R()*5;p.dr=g<200?2.2:0;}}};
  if(e.dragon){shards(Math.round(10*m),'#dff4ff','#8ed2ee');puffs(4,'255,170,90',0.55);puffs(3,'215,235,250',0.5);}
  else if(ice){shards(Math.round(7*m),'#eaf8ff','#9fd6f5');puffs(Math.round(2*m),'215,238,252',0.55);const p=fxbSoftP(x,cy,0,0,0.25,12*zs,'225,245,255',1.4,0.8,1);}
  else if(e.arch==='bird'){bits(5,Math.round(5*m),'#2a2a33',3,60);puffs(1,dust,0.35);}
  else if(e.arch==='spider'){bits(4,Math.round(5*m),'#2b3d4d',2.4,320);puffs(1,'215,238,252',0.45);}
  else if(e.arch==='beast'||e.arch==='mount'){puffs(Math.round(2*m),dust,0.5);bits(5,Math.round(5*m),e.pal?mixHex(e.pal,'#cfc6b4',0.45):'#8a8070',3.2,140);}
  else{puffs(Math.round(2*m),dust,0.45);bits(4,Math.round(4*m),'#e6dcc4',2.2,380);}
  if(big){const p=fxbP(6,x,y+2,0,0,0.5,10*zs,'rgba('+dust+',0.7)');if(p)p.gr=2.4;if(!(e.boss||e.lord||e.mini||e.king))G.shake=Math.min(5,(G.shake||0)+1.6);}}
function fxbGate(gi,a){if(!FXB.on||FXB.calm||!G.map)return;FXB.st.gate++;FXB.kick=Math.min(1,FXB.kick+0.4+a/90);
  if(FXB.t-FXB.gateT<0.1)return;FXB.gateT=FXB.t;const gs=G.map.gates||[],g=gs[gi]||gs[0]||{x:GX},x=g.x,y=GATE_Y+18,R=FXB_R,cold=!!(G.map.B&&G.map.B.cold);
  const n=1+Math.round(5*FXB.q);for(let i=0;i<n;i++){const p=fxbP(4,x+(R()-0.5)*44,y+R()*22,(R()-0.5)*170,-70-R()*120,0.6+R()*0.35,2+R()*2.4,R()<0.5?'#8a5a30':'#5c3a1c',430);if(p){p.vr=(R()-0.5)*16;p.fl=GATE_Y+56+R()*8;}}
  fxbSoftP(x+(R()-0.5)*20,y+26,(R()-0.5)*20,-10,0.6,10,FXB.dust,1.4,0.4,0);
  if(cold){for(let i=0;i<3;i++){const p=fxbP(1,x+(R()-0.5)*40,y+R()*14,(R()-0.5)*120,-50-R()*80,0.55,2.4,'#e6f6ff',360);if(p){p.vr=(R()-0.5)*14;p.fl=GATE_Y+58;}}fxbSoftP(x,y+10,0,-6,0.5,12,'225,242,255',1.2,0.45,0);}}
function fxbGateKick(now){if(!FXB.on||FXB.calm||FXB.kick<0.02||G.paused)return 0;return Math.sin(now/22)*FXB.kick*3.2;}
function fxbMuzzle(s,t,def){const f=t.face||-Math.PI/2,x=s.x+Math.cos(f)*7,y=s.y-14+Math.sin(f)*5,R=FXB_R;FXB.st.shots++;
  const wild=t.type==='wild';fxbSoftP(x,y,0,0,0.1,t.type==='scorp'?10:wild?9:7,wild?'170,255,140':'255,214,140',0.5,0.9,1);
  fxbSoftP(x,y-2,Math.cos(f)*10+(R()-0.5)*6,-14-R()*8,0.55+R()*0.2,wild?6:5,wild?'150,190,140':'175,170,160',1.6,0.4,0);}
/* ---- ambient set-up per map ---- */
const FXB_AMB={snow:{big:10,gust:1},northcity:{big:8,gust:1},vale:{big:8,gust:1},wall:{big:8,gust:1.6},mountain:{flake:34,big:6,gust:1},
  ash:{ember:16,haze:1},forest:{leaf:10,gust:0.6},river:{leaf:8},reach:{leaf:8},desert:{sand:10,gust:1},storm:{splash:16,bolt:1},
  sea:{spray:12,gull:3},coast:{spray:10,gull:3},swamp:{mist:6},city:{mote:16}};
const FXB_LEAF={forest:['#c98a2e','#a8b04a','#8a5a2a','#d6a33c'],river:['#a8b04a','#c9a640','#7f9a3a'],reach:['#c9d27a','#e6b8c8','#d9a640']};
function fxbAmbInit(map){FXB.map=map;FXB.na=0;FXB.glint.length=0;FXB.fires.length=0;const bi=map.biome,pr=FXB_AMB[bi]||{},B=map.B||{},R=FXB_R;FXB.prof=pr;
  FXB.dust=B.cold?'228,236,244':B.path?fxbRgb(B.path):'200,185,160';FXB.boltIn=6+R()*8;FXB.gustIn=3+R()*5;FXB.gust=0;FXB.flash=0;
  const add=(k,n)=>{for(let i=0;i<n&&FXB.na<FXB.ACAP;i++){const p=FXB.A[FXB.na++];p.k=k;p.x=R()*W;p.y=R()*H;p.ph=R()*6.28;p.sz=R();p.vx=0;p.vy=0;p.r=R()*6.28;p.life=R();p.max=1;
    p.c=k===13?(FXB_LEAF[bi]||FXB_LEAF.forest)[i%(FXB_LEAF[bi]||FXB_LEAF.forest).length]:'';}};
  add(10,pr.flake||0);add(11,pr.big||0);add(12,pr.ember||0);add(13,pr.leaf||0);add(14,pr.sand||0);add(15,pr.splash||0);add(18,pr.mist||0);add(19,pr.mote||0);add(17,pr.gull||0);
  const f=map.feat;if(f&&f.sea)add(16,pr.spray||6);
  if(f){for(let i=0;i<14;i++){let x,y;if(f.sea&&(i%2||!f.river)){y=20+R()*(H-60);const e=seaEdge(f,y);x=f.sea.side==='L'?R()*(e-12):W-R()*(e-12);}
      else if(f.river){x=R()*W;y=riverY(f,x)+(R()-0.5)*f.river.w*0.55;}
      else if(f.ponds&&f.ponds.length){const pd=f.ponds[i%f.ponds.length],a=R()*6.28,rr=R()*0.7;x=pd.x+Math.cos(a)*pd.rx*rr;y=pd.y+Math.sin(a)*pd.ry*rr;}else break;
      FXB.glint.push({x,y,ph:R()*6.28,s:0.8+R()*0.7});}}
  for(const d of map.deco||[]){if(FXB.fires.length>=12)break;if(d.t==='fire'||d.t==='lavarock')FXB.fires.push({x:d.x,y:d.y-(d.t==='fire'?d.r*0.6:d.r*0.3),r:d.t==='fire'?22+d.r:14+d.r*0.8,lava:d.t==='lavarock',ph:R()*6.28});}}
function fxbAmbStep(dt){const pr=FXB.prof||{},R=FXB_R;
  if(pr.gust){FXB.gustIn-=dt;if(FXB.gustIn<=0&&FXB.gust<=0){FXB.gust=2.4;FXB.gustIn=7+R()*8;}}
  if(FXB.gust>0){FXB.gust=Math.max(0,FXB.gust-dt);}const env=FXB.gust>0?Math.sin(Math.PI*(1-FXB.gust/2.4)):0;FXB.wind=env*120*(pr.gust||0);
  if(pr.bolt){FXB.boltIn-=dt;if(FXB.boltIn<=0){FXB.flash=0.5;FXB.boltIn=10+R()*12;}}if(FXB.flash>0)FXB.flash=Math.max(0,FXB.flash-dt);
  const A=FXB.A,f=FXB.map&&FXB.map.feat,lim=Math.ceil(FXB.na*Math.max(0.5,FXB.q)),t=FXB.t;
  for(let i=0;i<lim;i++){const p=A[i];switch(p.k){
    case 10:p.y+=(20+p.sz*24)*dt;p.x+=(Math.sin(t*0.8+p.ph)*9+FXB.wind*0.8)*dt;break;
    case 11:p.y+=(48+p.sz*34)*dt;p.x+=(Math.sin(t*0.6+p.ph)*14+FXB.wind)*dt;break;
    case 12:p.y-=(20+p.sz*26)*dt;p.x+=Math.sin(t*1.4+p.ph)*16*dt;if(p.y<-10){p.y=H+10;p.x=R()*W;}break;
    case 13:p.x+=(14+p.sz*12+FXB.wind*0.9)*dt;p.y+=(16+p.sz*14)*dt+Math.sin(t*1.7+p.ph)*0.4;p.r+=(1.4+p.sz*2)*dt;break;
    case 14:p.x+=(46+p.sz*50+FXB.wind)*dt;break;
    case 15:p.life-=dt*2.6;if(p.life<=0){p.life=1;p.x=R()*W;p.y=40+R()*(GATE_Y-40);}break;
    case 16:p.life-=dt*1.4;if(p.life<=0&&f&&f.sea){p.life=1;p.y=30+R()*(H-90);const e=seaEdge(f,p.y);p.x=f.sea.side==='L'?e:W-e;p.vx=(f.sea.side==='L'?1:-1)*(10+R()*26);p.vy=-40-R()*40;}p.vy+=110*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;break;
    case 17:p.x+=(34+p.sz*16)*dt;p.y+=(10+p.sz*8)*dt;if(p.x>W+40){p.x=-40;p.y=R()*H*0.8;}if(p.y>H+20)p.y=-20;break;
    case 18:p.x+=(6+p.sz*8)*dt;if(p.x>W+120)p.x=-120;break;
    case 19:p.x+=Math.sin(t*0.3+p.ph)*6*dt;p.y-=(3+p.sz*4)*dt;if(p.y<-6){p.y=H+6;p.x=R()*W;}break;}
    if(p.k!==12&&p.k!==17&&p.k!==18&&p.k!==19&&p.k!==15&&p.k!==16){if(p.y>H+8){p.y=-8;p.x=R()*W;}if(p.x>W+10)p.x-=W+20;else if(p.x<-10)p.x+=W+20;}}}
/* ---- the frame tick: called once per draw, right after the ground is painted ---- */
function fxbTick(now){const ms=now-FXB.last;FXB.last=now;FXB.dt=0;if(!FXB.on||FXB.calm||!G.map)return;
  if(G.map!==FXB.map)fxbAmbInit(G.map);
  const playing=G.state==='play'&&!G.paused&&!document.hidden;if(!playing)return;
  const dt=Math.min(0.05,Math.max(0,ms/1000));FXB.dt=dt;FXB.t+=dt;FXB.frame++;
  if(ms>0&&ms<250&&!FXB.qLock){FXB.ema+=(ms-FXB.ema)*0.08;
    if(FXB.ema>30){FXB.slowT+=ms/1000;FXB.fastT=0;if(FXB.slowT>1.5){FXB.q=Math.max(0.25,FXB.q*0.5);FXB.slowT=0;}}
    else if(FXB.ema<20){FXB.fastT+=ms/1000;FXB.slowT=0;if(FXB.fastT>4&&FXB.q<1){FXB.q=Math.min(1,FXB.q*2);FXB.fastT=0;}}}
  /* combat particles */
  const P=FXB.P;for(let i=0;i<FXB.np;i++){const p=P[i];p.life-=dt;if(p.life<=0){FXB.np--;P[i]=P[FXB.np];P[FXB.np]=p;i--;continue;}
    p.vy+=p.g*dt;if(p.dr){const d=Math.max(0,1-p.dr*dt);p.vx*=d;p.vy*=d;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;
    if(p.fl&&p.y>p.fl){p.y=p.fl;p.vy*=-0.25;p.vx*=0.55;p.vr*=0.4;}}
  const N=FXB.N;for(let i=0;i<FXB.nn;i++){const o=N[i];o.life-=dt;o.y-=20*dt;if(o.life<=0){FXB.nn--;N[i]=N[FXB.nn];N[FXB.nn]=o;i--;}}
  FXB.kick=Math.max(0,FXB.kick-dt*3);
  /* hits and merged numbers: what changed on each enemy since the last frame */
  let budget=Math.ceil(10*FXB.q);
  for(const e of G.enemies){if(e.hp<=0)continue;let r=FXB.ER.get(e);if(!r){FXB.ER.set(e,{hp:e.hp,ht:e.hitT,acc:0,nt:FXB.t,hit:0});continue;}
    if(e.hp<r.hp)r.acc+=r.hp-e.hp;r.hp=e.hp;const fresh=e.hitT!=null&&e.hitT!==r.ht;r.ht=e.hitT;if(fresh)r.hit=1;
    if(fresh&&budget>0){budget--;fxbHit(e,fxbPos(e));}
    if(r.hit&&r.acc>=1&&FXB.t-r.nt>=0.5){const q=fxbPos(e);fxbNum(q.x,q.y-q.h-4,Math.round(r.acc),e.lastSrc);r.acc=0;r.hit=0;r.nt=FXB.t;}}
  /* towers that just fired: their cooldown jumped back up */
  for(const s of G.map.slots){const t=s.tower;if(!t)continue;const def=TOWERS[t.type];if(!def||(def.kind!=='single'&&def.kind!=='splash'))continue;
    let r=FXB.TW.get(t);if(!r){FXB.TW.set(t,{cd:t.cd,ft:-9});continue;}if(t.cd>r.cd+0.02){r.ft=FXB.t;fxbMuzzle(s,t,def);}r.cd=t.cd;}
  /* projectile trails: a few recent points per projectile, records recycled */
  const fr=FXB.frame;for(const p of G.projs){let r=FXB.TR.get(p);if(!r){r=FXB.trF.pop()||{xs:new Float32Array(7),ys:new Float32Array(7),n:0,f:0};r.n=0;FXB.TR.set(p,r);FXB.trA.push(r);}
    r.f=fr;if(!r.n||Math.abs(r.xs[0]-p.x)+Math.abs(r.ys[0]-p.y)>0.5){r.xs.copyWithin(1,0,6);r.ys.copyWithin(1,0,6);r.xs[0]=p.x;r.ys[0]=p.y;if(r.n<7)r.n++;}r.src=p.src;r.col=p.col;r.orb=p.orb;
    if(p.src==='wild'&&FXB_R()<0.35*FXB.q){const e=fxbP(0,p.x+(FXB_R()-0.5)*4,p.y,(FXB_R()-0.5)*20,-10-FXB_R()*20,0.35,1.8,'#c8ff9e',0);if(e)e.add=1;}}
  const A=FXB.trA;let j=0;for(let i=0;i<A.length;i++){const r=A[i];if(r.f===fr)A[j++]=r;else{r.n=0;FXB.trF.push(r);}}A.length=j;
  fxbAmbStep(dt);}
/* ---- drawing ---- */
const FXB_TRAIL={watch:['#eef3fa',1.3,4,0.55],scorp:['#ffe2a0',2.4,5,0.6],wild:['#9dff6b',3.2,7,0.5],hero:['#ffffff',1.7,5,0.5]};
function fxbUnder(now){if(!FXB.on||FXB.calm)return;const A=FXB.trA;if(!A.length)return;ctx.lineCap='round';
  for(let i=0;i<A.length;i++){const r=A[i];if(r.n<2)continue;const st=FXB_TRAIL[r.src]||FXB_TRAIL.watch,col=r.src==='hero'&&r.col?r.col:st[0],L=Math.min(r.n,st[2]);
    if(r.src==='wild'||r.orb){ctx.globalCompositeOperation='lighter';const g=fxbSoft(r.src==='wild'?'130,255,110':fxbRgb(r.col));ctx.globalAlpha=0.55;ctx.drawImage(g,r.xs[0]-10,r.ys[0]-10,20,20);}
    ctx.strokeStyle=col;for(let k=1;k<L;k++){const f=1-k/L;ctx.globalAlpha=st[3]*f;ctx.lineWidth=st[1]*(0.4+0.6*f);ctx.beginPath();ctx.moveTo(r.xs[k-1],r.ys[k-1]);ctx.lineTo(r.xs[k],r.ys[k]);ctx.stroke();}
    ctx.globalCompositeOperation='source-over';}
  ctx.globalAlpha=1;ctx.lineCap='butt';}
function fxbOver(now){if(!FXB.on||FXB.calm)return;const P=FXB.P;let add=0;
  for(let i=0;i<FXB.np;i++){const p=P[i],k=p.life/p.max;if(p.add!==add){add=p.add;ctx.globalCompositeOperation=add?'lighter':'source-over';}
    ctx.globalAlpha=p.a*(k<0.4?k/0.4:1);
    switch(p.k){
      case 0:ctx.fillStyle=p.c;ctx.fillRect(p.x-p.sz/2,p.y-p.sz/2,p.sz,p.sz);break;
      case 1:{const c=Math.cos(p.r),s=Math.sin(p.r),L=p.sz;ctx.fillStyle=p.c;ctx.beginPath();ctx.moveTo(p.x+c*L,p.y+s*L);ctx.lineTo(p.x-s*L*0.4,p.y+c*L*0.4);ctx.lineTo(p.x-c*L*0.7,p.y-s*L*0.7);ctx.closePath();ctx.fill();break;}
      case 2:{const rr=p.sz*(1+p.gr*(1-k));ctx.drawImage(p.im,p.x-rr,p.y-rr,rr*2,rr*2);break;}
      case 3:ctx.strokeStyle=p.c;ctx.lineWidth=p.sz;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*0.04,p.y-p.vy*0.04);ctx.stroke();break;
      case 4:{const c=Math.cos(p.r)*p.sz,s=Math.sin(p.r)*p.sz,c2=-s*0.35,s2=c*0.35;ctx.fillStyle=p.c;ctx.beginPath();ctx.moveTo(p.x+c+c2,p.y+s+s2);ctx.lineTo(p.x+c-c2,p.y+s-s2);ctx.lineTo(p.x-c-c2,p.y-s-s2);ctx.lineTo(p.x-c+c2,p.y-s+s2);ctx.closePath();ctx.fill();break;}
      case 5:{const c=Math.cos(p.r)*p.sz,s=Math.sin(p.r)*p.sz;ctx.strokeStyle=p.c;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(p.x-c,p.y-s);ctx.quadraticCurveTo(p.x+s*0.6,p.y-c*0.6,p.x+c,p.y+s);ctx.stroke();break;}
      case 6:{const rr=p.sz*(1+p.gr*(1-k));ctx.strokeStyle=p.c;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,rr,rr*0.42,0,0,6.283);ctx.stroke();break;}}}
  if(add)ctx.globalCompositeOperation='source-over';
  if(FXB.nn){ctx.font='700 9px Cinzel,serif';ctx.textAlign='center';ctx.lineWidth=2.4;ctx.strokeStyle='rgba(6,11,20,0.85)';
    for(let i=0;i<FXB.nn;i++){const o=FXB.N[i];ctx.globalAlpha=Math.min(1,o.life/0.35);ctx.strokeText(o.v,o.x,o.y);ctx.fillStyle=o.c;ctx.fillText(o.v,o.x,o.y);}}
  ctx.globalAlpha=1;}
/* ground layer (world space, under the units): water glints, fire light, mist, sand, splashes, spray, gull shadows */
function fxbGround(now){if(!FXB.on||FXB.calm||!FXB.map||!(G.state==='play'||G.state==='over'))return;const t=FXB.t,A=FXB.A,lim=Math.ceil(FXB.na*Math.max(0.5,FXB.q));
  if(FXB.glint.length){const im=fxbSoft('255,255,255');for(const g of FXB.glint){const a=Math.pow(Math.max(0,Math.sin(t*1.3+g.ph)),6)*0.85;if(a<0.03)continue;ctx.globalAlpha=a;ctx.fillStyle='#ffffff';ctx.fillRect(g.x-3*g.s,g.y-0.5,6*g.s,1);ctx.drawImage(im,g.x-3,g.y-3,6,6);}}
  if(FXB.fires.length){ctx.globalCompositeOperation='lighter';for(const f of FXB.fires){const fl=f.lava?0.55+0.25*Math.sin(t*1.6+f.ph):0.75+0.15*Math.sin(t*9+f.ph)+0.1*Math.sin(t*23+f.ph*2);
      ctx.globalAlpha=(f.lava?0.28:0.34)*fl;const r=f.r*(0.9+0.12*fl);ctx.drawImage(fxbSoft(f.lava?'255,110,40':'255,170,70'),f.x-r,f.y-r*0.8,r*2,r*1.6);}ctx.globalCompositeOperation='source-over';}
  for(let i=0;i<lim;i++){const p=A[i];switch(p.k){
    case 14:{ctx.globalAlpha=0.16+0.1*Math.sin(t+p.ph);const L=40+p.sz*50;ctx.drawImage(fxbSoft(FXB.dust),p.x-L/2,p.y-1.5,L,3+p.sz*2);if(p.x-L/2>W)p.x=-L;break;}
    case 15:{const k=1-p.life;ctx.globalAlpha=0.5*(1-k);ctx.strokeStyle='#d6e4f0';ctx.lineWidth=0.8;ctx.beginPath();ctx.ellipse(p.x,p.y,1+k*5,0.5+k*2,0,0,6.283);ctx.stroke();break;}
    case 16:if(p.life>0&&p.life<1){ctx.globalAlpha=0.75*p.life;ctx.fillStyle='#f4faff';ctx.fillRect(p.x-1,p.y-1,2,2);}break;
    case 17:{const w=Math.sin(t*6+p.ph)*2.5;ctx.globalAlpha=0.14;ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(p.x-9,p.y-w);ctx.quadraticCurveTo(p.x-3,p.y-3,p.x,p.y+1);ctx.quadraticCurveTo(p.x+3,p.y-3,p.x+9,p.y-w);ctx.quadraticCurveTo(p.x+3,p.y,p.x,p.y+3);ctx.quadraticCurveTo(p.x-3,p.y,p.x-9,p.y-w);ctx.fill();break;}
    case 18:{const r=70+p.sz*50;ctx.globalAlpha=0.13+0.04*Math.sin(t*0.4+p.ph);ctx.drawImage(fxbSoft('205,220,205'),p.x-r,p.y-r*0.4+Math.sin(t*0.2+p.ph)*8,r*2,r*0.8);break;}}}
  ctx.globalAlpha=1;}
/* screen layer (over the field, like drawAmbient): flakes, gusts, embers + haze, leaves, motes, lightning */
function fxbSky(now){if(!FXB.on||FXB.calm||!FXB.map||G.state!=='play')return;const t=FXB.t,A=FXB.A,pr=FXB.prof||{},lim=Math.ceil(FXB.na*Math.max(0.5,FXB.q));
  if(pr.haze){ctx.globalAlpha=0.07;const im=fxbSoft('255,190,120');for(let i=0;i<3;i++){const y=H-((t*14+i*240)%(H+120))+40,x=Math.sin(t*0.7+i*2)*30;ctx.drawImage(im,x-60,y-24,W+120,48);}}
  for(let i=0;i<lim;i++){const p=A[i];switch(p.k){
    case 10:ctx.globalAlpha=0.8;ctx.drawImage(fxbSoft('245,250,255'),p.x-1.6-p.sz,p.y-1.6-p.sz,3.2+p.sz*2,3.2+p.sz*2);break;
    case 11:ctx.globalAlpha=0.32;ctx.drawImage(fxbSoft('245,250,255'),p.x-4-p.sz*3,p.y-4-p.sz*3,8+p.sz*6,8+p.sz*6);break;
    case 12:{ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.45+0.35*Math.sin(t*5+p.ph);const r=2.4+p.sz*2.6;ctx.drawImage(fxbSoft('255,140,50'),p.x-r,p.y-r,r*2,r*2);ctx.globalCompositeOperation='source-over';break;}
    case 13:{ctx.globalAlpha=0.85;ctx.fillStyle=p.c;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.scale(Math.cos(t*2.3+p.ph),1);ctx.beginPath();ctx.ellipse(0,0,3.4,1.6,0,0,6.283);ctx.fill();ctx.restore();break;}
    case 19:{ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.25+0.2*Math.sin(t*1.8+p.ph);const r=1.6+p.sz*1.6;ctx.drawImage(fxbSoft('255,232,180'),p.x-r,p.y-r,r*2,r*2);ctx.globalCompositeOperation='source-over';break;}}}
  if(FXB.gust>0&&pr.gust&&FXB.map.biome!=='forest'){const env=Math.sin(Math.PI*(1-FXB.gust/2.4)),k=1-FXB.gust/2.4;ctx.strokeStyle=FXB.map.biome==='desert'?'#f0d6a0':'#f4f8ff';ctx.lineWidth=1;ctx.lineCap='round';
    for(let i=0;i<7;i++){const y=(i*97+31)%(H-80)+30,x=k*(W+260)-130+((i*53)%90)-45,L=26+(i%3)*12;ctx.globalAlpha=0.22*env;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+L*0.5,y-3,x+L,y+1);ctx.stroke();}ctx.lineCap='butt';}
  if(FXB.flash>0){const k=1-FXB.flash/0.5,a=k<0.08?k/0.08:k<0.16?0.35:k<0.24?1:Math.max(0,(1-k)/0.76);ctx.globalAlpha=0.17*a;ctx.fillStyle='#dce9ff';ctx.fillRect(0,0,W,H);}
  ctx.globalAlpha=1;}
function fxbCounts(){return{np:FXB.np,na:FXB.na,nn:FXB.nn,trails:FXB.trA.length,kick:FXB.kick,q:FXB.q,glint:FXB.glint.length,fires:FXB.fires.length,biome:FXB.map&&FXB.map.biome,st:Object.assign({},FXB.st)};}
/* ---- hooks: wrap the base functions (all plain declarations in this script) ---- */
{const kill0=kill;kill=function(e,src){const was=e.dead;kill0(e,src);if(!was&&e.dead&&!e.left&&FXB.on&&!FXB.calm){try{fxbDeath(e);}catch(_){}}};}
{const door0=hitDoor;hitDoor=function(a,gi){const play=G.state==='play'&&!(G.vengUntil>G.time);door0(a,gi);if(play&&FXB.on&&!FXB.calm){try{fxbGate(gi||0,a);}catch(_){}}};}
{const tower0=drawTower;drawTower=function(s,now){const t=s.tower,r=t&&FXB.on&&!FXB.calm?FXB.TW.get(t):null,age=r?FXB.t-r.ft:9;
  if(age<0.16){const k=1-age/0.16,kk=k*k,f=t.face||0;ctx.save();ctx.translate(s.x-Math.cos(f)*1.6*kk,s.y+9-Math.sin(f)*0.8*kk);ctx.scale(1+0.035*kk,1-0.07*kk);ctx.translate(-s.x,-(s.y+9));tower0(s,now);ctx.restore();}
  else tower0(s,now);};}
{const ground0=drawCloudShadows;drawCloudShadows=function(now){ground0(now);try{fxbTick(now);fxbGround(now);}catch(_){}};}
{const amb0=drawAmbient;drawAmbient=function(now){amb0(now);try{fxbSky(now);}catch(_){}};}
