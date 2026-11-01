/* =========================== SKILL DEMOS (v1.1.4, real art since v1.4.6) ===========================
   Every skill of every champion is explained by a short looping picture instead of a paragraph. A hundred skills fall into eleven kinds
   (SKCAT); the kind gives the picture and a five-word line (SKTAG). The full text of the skill stays one tap away.
   Since v1.4.6 the pictures are a slice of a real battle: the biome ground and road painted by buildMap, the champion's own battle
   sprite (stance / attack, drawWalking), the enemies' sprites (drawWalking, drawCorpse), the towers (drawTower), the house troops
   (drawTroopBody), the sworn brothers (drawAllyBody), the projectiles (drawProj) and the battle fx (drawFx). Those functions draw on the
   global `ctx`; dmRun points it at the demo canvas for one frame and always puts it back. */
const SKSETS={
 aoe:'cleave smash firestorm linestrike axestorm khalasar warhammer drownaura thebold fury dawncharge',
 rain:'volley storm stormcrows spearrain ironfleet ironarrow dragonstrike crown multishot pierce chain twoforone',
 heal:'heal rations muster fortify harvest dohaeris sunaura bloodmagic lifesteal reave',
 shield:'shield ironskin discipline contempt parry whatisdead oath vengeance thorns iserve wallholds phalanx taunt',
 control:'stun frostbite slowaura howl blizzard kraken charm knock whiplash queenroses keepback justice trap',
 dot:'poison burn cloud bleed serpentkiss queenthorns viper lordoflight redviper wildfire',
 buff:'rally warcry forge hand favour drill siegecraft growing oldtales dgblades momentum waitstrike quickstudy forqueen blood',
 summon:'summon reinforce wolfpack drowned',
 gold:'goldtouch goldrain tribute remember ironprice',
 strike:'crit execute assassinate kingslayer slayer duelist sunder'};
const SKCAT={};for(const k in SKSETS)SKSETS[k].split(' ').forEach(id=>{SKCAT[id]=k;});
const SKTAG={aoe:'Hits everything around',rain:'Strikes from range',heal:'Heals and mends',shield:'Guards and endures',control:'Slows or stuns the dead',dot:'Burns and poisons over time',buff:'Makes the army stronger',summon:'Calls soldiers to fight',gold:'Brings extra gold',strike:'One mighty blow',generic:'A special power'};
function skCat(id){return SKCAT[id]||'generic';}
/* ---------- the scene kit: a 320×180 canvas showing a 246×138 slice of the battlefield (world px × DZ) ---------- */
const SDW=320,SDH=180,DZ=1.3,VW=SDW/DZ,VH=SDH/DZ,RDY=94,DTB=1e6;
const DG={},DFX={t:'ring',x:0,y:0,tx:0,ty:0,r0:0,r1:0,r:0,col:'#fff',life:1,dur:1,delay:0,a:0,dx:0,rgb:null},DCP={t:'corpse',type:'axe',x:0,y:0,face:-1,ang:null,s:1,life:1,max:1,kind:'fall'},
  DPJ={src:'watch',x:0,y:0,ang:0,col:'#fff',orb:false},DHE={id:7,type:'hero'},DTS={x:0,y:0,id:-1,tower:{type:'watch',lvl:3,cd:0,face:-Math.PI/2}},
  DAL=[0,1,2,3].map(i=>({x:0,y:0,face:1,kind:'brother',role:'foot',troop:'stark',moving:false,walk:0,strikeT:null,hitT:null,hp:1,max:1,t:Infinity})),
  DEO=[0,1,2,3,4,5].map(i=>({id:i*7+3,type:'axe',accS:0})),DPOS=[0,1,2,3,4,5].map(()=>({x:0,y:0,top:0,on:false,type:'axe'}));
let DT0=0;
const HBIOME={stark:'snow',lannister:'mountain',baratheon:'storm',targaryen:'ash',greyjoy:'coast',tyrell:'reach',martell:'desert'};
/* one frame with the game's ctx pointed at the demo canvas, in world px; G.time is lifted far away so no battle timer (war cry, frost) leaks in */
function dmRun(c,t,fn){const oc=ctx,ot=G.time;ctx=c;G.time=DTB+(t%3.2);DT0=t;c.save();try{c.scale(DZ,DZ);fn();}finally{c.restore();ctx=oc;G.time=ot;}}
function dLast(ph,a,per){return ph<a?null:a+Math.floor((ph-a)/per)*per;}
function dmK(ph,a,b){return ph<=a?0:ph>=b?1:(ph-a)/(b-a);}
function dGround(biome){let g=DG[biome];if(!g){const Y=300;let m=null;try{m=buildMap({routes:[[[470,Y],[40,Y],[40,640]]],raw:true,style:'bend',seed:hash32('dm-'+biome),biome});}catch(e){}
    g=DG[biome]={bg:m&&m.bg,x0:128,y0:Y-RDY,B:m?m.B:BIOMES.forest};}
  if(g.bg){const r=g.bg.width/W;ctx.drawImage(g.bg,g.x0*r,g.y0*r,VW*r,VH*r,0,0,VW,VH);}
  else{ctx.fillStyle=g.B.g1;ctx.fillRect(0,0,VW,VH);ctx.fillStyle=g.B.edge;ctx.fillRect(0,RDY-21,VW,42);ctx.fillStyle=g.B.path;ctx.fillRect(0,RDY-17,VW,34);}
  return g;}
function dGlow(x,y,rx,ry,rgb,a){if(a<=0.01)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,a);ctx.drawImage(fxbSoft(rgb),x-rx,y-ry,rx*2,ry*2);ctx.restore();}
function dFx(t,x,y,k,col,r0,r1,tx,ty){if(k<=0||k>=1)return;const f=DFX;f.t=t;f.x=x;f.y=y;f.tx=tx==null?x:tx;f.ty=ty==null?y:ty;f.r0=r0||0;f.r1=r1||0;f.r=r1||22;f.col=col||'#fff';f.dur=1;f.life=1-k;f.delay=0;f.a=0;f.dx=-30;f.rgb=null;drawFx(f,DT0*1000);}
function dProj(src,x,y,ang,col){const p=DPJ;p.src=src;p.x=x;p.y=y;p.ang=ang;p.col=col||'#fff';p.orb=false;drawProj(p);}
function dShot(src,x0,y0,x1,y1,k,arc,col){if(k<=0||k>=1)return;const x=x0+(x1-x0)*k,y=y0+(y1-y0)*k-Math.sin(k*Math.PI)*(arc||0),dy=(y1-y0)-Math.cos(k*Math.PI)*Math.PI*(arc||0),a=Math.atan2(dy,x1-x0);if(src==='watch')dArrow(x,y,a,1);else dProj(src,x,y,a,col);}
function dArrow(x,y,ang,a){if(a<=0.01)return;ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.rotate(ang);ctx.strokeStyle='#5a3a20';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(0,0);ctx.stroke();ctx.fillStyle='#e9eef5';ctx.beginPath();ctx.moveTo(3,0);ctx.lineTo(-2,-2.2);ctx.lineTo(-2,2.2);ctx.closePath();ctx.fill();ctx.fillStyle='#d6dfe9';ctx.fillRect(-15,-1.8,3,1.2);ctx.fillRect(-15,0.6,3,1.2);ctx.restore();}
function dTxt(x,y,txt,a,col,big){if(a<=0.01)return;ctx.save();ctx.globalAlpha=Math.min(1,a);ctx.textAlign='center';ctx.font=big?'900 15px Cinzel,serif':'800 12px Cinzel,serif';ctx.lineWidth=3;const hw=ctx.measureText(txt).width/2+3;x=Math.max(hw,Math.min(VW-hw,x));ctx.strokeStyle='rgba(6,11,20,.85)';ctx.strokeText(txt,x,y);ctx.fillStyle=col||'#fff';ctx.fillText(txt,x,y);ctx.restore();}
function dPop(x,y,txt,ph,at,col,big){const k=dmK(ph,at,at+0.85);if(k<=0||k>=1)return;dTxt(x,y-k*14,txt,k<0.7?1:(1-k)/0.3,col,big);}
function dBar(x,top,w,fr,col){ctx.fillStyle='#101a2b';ctx.fillRect(x-w/2,top-2,w,3);ctx.fillStyle=col||'#ff9a3c';ctx.fillRect(x-w/2,top-2,w*Math.max(0,Math.min(1,fr)),3);}
/* an enemy sprite at (x,y), feet on y, facing left by default; o: walk (px walked), moving, hit, a (alpha), face */
function dFoe(i,type,x,y,o){const e=DEO[i];e.type=type;const E=ENEMIES[type]||{},im=enemyImg(type),m=ENEMY_META[type],cfg=ENEMY_CFG[type]||{h:30,an:'walk'},s=1,big=(E.big||1)*(E.small||1),f=o.face||-1;
  const a=o.a==null?1:o.a;if(a<=0.01)return 0;ctx.save();ctx.globalAlpha=a;
  if(E.fly||cfg.an==='fly'){const hov=Math.sin(DT0*4+e.id)*2,ang=f<0?Math.PI:0;
    if(im){ctx.fillStyle='rgba(0,0,0,.2)';ell(ctx,x,y+34,8,2.5);ctx.translate(x,y+hov);ctx.rotate(ang);if(f<0)ctx.scale(1,-1);const H=cfg.h*s,sc=H/m.h,D=m.C*sc;ctx.translate(0,H/2);drawWalking(im,m,sc,D,cfg.an,0,DT0,s,e,true);}
    ctx.restore();return y-cfg.h*0.6;}
  ctx.fillStyle='rgba(0,0,0,.35)';ell(ctx,x,y+2,(E.arch==='beast'||E.arch==='mount'?12:7)*big,3*big);
  if(im){const H=cfg.h*s,sc=H/m.h,D=m.C*sc,fl=cfg.an==='float'?Math.sin(DT0*2.5+e.id)*2.5:0;ctx.translate(x,y+1+fl);ctx.scale(f,1);if(cfg.an==='float')ctx.globalAlpha*=0.82+0.18*Math.sin(DT0*3.1+e.id);
    drawWalking(im,m,sc,D,cfg.an,o.walk||0,DT0,s,e,o.moving!==false);
    if(o.hit){const wh=enemyWhite(type);if(wh){ctx.globalAlpha=0.5*a;ctx.drawImage(wh,-m.cx*sc,-m.by*sc,D,D);}}}
  else{fWight(ctx,x,y,.62*big,DT0*3+i,'#0b1018');}
  ctx.restore();return y-(cfg.h||30)-2;}
/* a dead enemy: the battle's own corpse fx (fall / shatter / dissolve), k = 0..1 */
function dDie(type,x,y,k){if(k<0||k>=1)return;const E=ENEMIES[type]||{},f=DCP;f.type=type;f.x=x;f.y=y;f.face=-1;f.s=1;f.kind=E.walker||E.king||E.lord?'shatter':E.arch==='wraith'?'dissolve':E.fly?'drop':'fall';f.max=f.kind==='shatter'?0.4:0.75;f.life=f.max*(1-k);drawCorpse(f,DT0*1000);}
/* a group of enemies walking in from the right along the road.
   o: v speed px/s, stop x where they halt (and strike), slowAt/slowF, hitAt [times] (flash), hpTo [fractions after each hit], dieAt, burn/poison/stun/slow from time, lane offsets */
function dGroup(types,ph,P,o){const n=types.length,v=o.v||70,x0=o.x0==null?VW+14:o.x0,gap=o.gap||26;
  for(let i=0;i<DPOS.length;i++)DPOS[i].on=false;
  const ord=[];for(let i=0;i<n;i++)ord.push(i);ord.sort((a,b)=>((a%2)-(b%2)));
  for(const i of ord){const ty=types[i],y=RDY+(o.lane?o.lane[i]:(i%2?5:-3)),sa=o.slowAt==null?99:o.slowAt,sf=o.slowF==null?1:o.slowF;
    let d=v*Math.min(ph,sa)+v*sf*Math.max(0,ph-sa);let x=x0+i*gap-d,stopped=false;const st=o.stop==null?null:o.stop+i*(o.sgap||gap);if(st!=null&&x<st){x=st;stopped=true;}
    const walk=(x0+i*gap-x)*(stopped?0:1)+(stopped?(x0+i*gap-st):0);
    const die=o.dieAt!=null&&(o.dies?o.dies[i]:1)?o.dieAt+(o.dieStep||0)*i:null;
    const P0=DPOS[i];P0.x=x;P0.y=y;P0.type=ty;P0.on=die==null||ph<die;
    if(die!=null&&ph>=die){dDie(ty,x,y,(ph-die)/0.75);continue;}
    let hit=false,hp=1;if(o.hitAt)for(let j=0;j<o.hitAt.length;j++){const h=o.hitAt[j]+(o.hitStep==null?0.045:o.hitStep)*i;if(ph>=h){hp=o.hpTo?o.hpTo[j]:Math.max(0.15,1-0.3*(j+1));if(ph<h+0.07)hit=true;}}
    const fade=o.keep?1:Math.min(1,(P-ph)/0.3,ph/0.15+0.4);
    const strike=stopped&&o.strike?Math.max(0,Math.sin((ph*2.2+i*0.37)*Math.PI*2)):0;
    const top=dFoe(i,ty,x-strike*4,y,{walk,moving:!stopped,hit,a:fade});P0.top=top;
    const E=ENEMIES[ty]||{};
    if(fade>0.3){ctx.save();ctx.globalAlpha=fade;
      if(o.burn!=null&&ph>o.burn)for(let k=0;k<3;k++){const fx=x-5+k*5+Math.sin(DT0*18+i+k)*1.5,fh=5+3*Math.abs(Math.sin(DT0*14+k*1.7+i));ctx.fillStyle=k===1?'rgba(255,220,120,0.9)':'rgba(255,140,50,0.85)';ctx.beginPath();ctx.moveTo(fx-2.2,top+8);ctx.quadraticCurveTo(fx-2.5,top+8-fh*0.6,fx,top+8-fh);ctx.quadraticCurveTo(fx+2.5,top+8-fh*0.6,fx+2.2,top+8);ctx.closePath();ctx.fill();}
      if(o.poison!=null&&ph>o.poison){ctx.fillStyle='rgba(124,255,107,0.9)';for(let k=0;k<3;k++){const q=((DT0*1.4)+k*0.33+i*0.13)%1,dx=x-6+k*6,dy=top+4+q*16;ctx.globalAlpha=fade*(1-q);ctx.beginPath();ctx.moveTo(dx,dy-3);ctx.quadraticCurveTo(dx+2.2,dy,dx,dy+1.8);ctx.quadraticCurveTo(dx-2.2,dy,dx,dy-3);ctx.fill();}ctx.globalAlpha=fade;}
      if(o.stun!=null&&ph>o.stun){ctx.fillStyle='#ffe66d';for(let k=0;k<3;k++){const a=DT0*4+k*2.1;ctx.beginPath();ctx.arc(x+Math.cos(a)*9,top+1+Math.sin(a)*3,1.9,0,Math.PI*2);ctx.fill();}}
      else if(o.slow!=null&&ph>o.slow){ctx.strokeStyle='rgba(143,211,255,0.85)';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(x,y-1,(E.r||8)+5,((E.r||8)+5)*0.55,0,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='rgba(225,245,255,.9)';for(let k=0;k<2;k++){const a=DT0*2+k*3+i;ctx.fillRect(x+Math.cos(a)*8,top+10+Math.sin(a*1.3)*6,1.6,1.6);}}
      if(o.bars!==false&&hp<1)dBar(x,top,Math.max(16,20*(E.big||1)),hp,E.boss?'#66f0ff':E.walker?'#cdf1ff':'#ff9a3c');
      ctx.restore();}}
  return DPOS;}
/* the champion's own battle sprite; o: face, walk, moving, strike (0..1 while striking, else <0), name */
function dHero(id,x,y,o){const f=o.face||1,sp=champImg(id,'stance');ctx.fillStyle='rgba(0,0,0,.35)';ell(ctx,x,y+2,11,4);
  if(!sp){sdFig(ctx,x,y,1,'#5a6270',DT0*6);return;}
  const st=o.strike!=null&&o.strike>=0&&o.strike<1,at=st&&champImg(id,'attack'),im=at||sp,m=CHAMP_META[at?id+'_attack':id],Hh=47,sc=Hh/m.h,D=m.C*sc,lunge=st?Math.sin(Math.PI*o.strike)*5:0;
  ctx.save();ctx.translate(x+lunge*f,y+1);ctx.scale(f,1);drawWalking(im,m,sc,D,'walk',o.walk||0,DT0,1.1,DHE,!!o.moving&&!st);ctx.restore();
  if(o.name){ctx.textAlign='center';ctx.font='700 9.5px Cinzel,serif';ctx.fillStyle='rgba(6,11,20,0.85)';ctx.fillText(o.name,x,y-48);ctx.fillStyle='#f2e6c9';ctx.fillText(o.name,x,y-49);}}
/* a real tower on its spot (drawTower: art, drawn rook/maul, level pips) */
function dTower(type,lvl,x,y,cd){const s=DTS;s.x=x;s.y=y;s.tower.type=type;s.tower.lvl=lvl;s.tower.cd=cd==null?9:cd;s.tower.face=-Math.PI/2;s.tower.frozen=0;drawTower(s,DT0*1000);}
/* a soldier: kind 'brother' = a sworn brother (drawAllyBody), otherwise a house troop of `house` (drawTroopBody) */
function dAlly(i,kind,house,x,y,face,moving,walk,strikeAt){const a=DAL[i];a.x=x;a.y=y;a.face=face;a.kind=kind==='brother'?'brother':'house';a.role=kind==='brother'?null:kind;a.troop=house;a.moving=moving;a.walk=walk;a.strikeT=strikeAt==null?null:DTB+strikeAt;a.hitT=null;
  if(a.role)drawTroopBody(ctx,a,DT0*1000);else drawAllyBody(a,DT0*1000);}
/* the old stand-in figure, kept for a champion whose sprite has not loaded yet */
function sdFig(c,x,y,s,col,ph){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(0,1,13,4,0,0,6.283);c.fill();
  c.fillStyle=col;c.beginPath();c.moveTo(-8,-34);c.quadraticCurveTo(-13,-14,-11,0);c.lineTo(11,0);c.quadraticCurveTo(13,-14,8,-34);c.closePath();c.fill();
  c.fillStyle='#c9d2dd';c.beginPath();c.arc(0,-40,6,0,6.283);c.fill();c.restore();}
function sdNum(c,x,y,txt,a,col){c.save();c.globalAlpha=Math.max(0,Math.min(1,a));c.font='800 14px Cinzel,serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.7)';c.strokeText(txt,x,y);c.fillStyle=col||'#fff';c.fillText(txt,x,y);c.restore();}
/* a gate with Hodor (gate art by damage stage) at the left end of the road, and its bar */
function dGate(ratio,x){const st=gateStage(ratio),im=GATE_IMG[st],mt=GATE_META[st];const gx=x==null?40:x;
  if(im&&im.complete&&im.naturalWidth>0){ctx.save();ctx.translate(gx,RDY+22);ctx.scale(0.8,0.8);ctx.drawImage(im,-mt.w/2,-mt.oy,mt.w,mt.h);ctx.restore();}
  else{ctx.fillStyle='#8a5a30';ctx.fillRect(gx-28,RDY-40,56,62);}
  const bw=58,by=RDY+26;ctx.fillStyle='#101a2b';rr(ctx,gx-bw/2,by,bw,6,3);ctx.fill();ctx.fillStyle=ratio>0.5?'#8fd3ff':ratio>0.25?'#ff9a3c':'#e14b4b';rr(ctx,gx-bw/2,by,Math.max(4,bw*ratio),6,3);ctx.fill();}
function dmChampOf(house,cid){if(cid&&CBY[cid])return CBY[cid];const sel=typeof ACC!=='undefined'&&ACC&&CBY[ACC.sel];if(sel&&sel.house===house)return sel;return CHAMPS.find(x=>x.house===house)||CHAMPS[0];}
/* ---------- the eleven kinds ---------- */
function skillDemoFrame(c,sk,t,house,cid){const cat=skCat(sk),P=3.2,ph=t%P,hh=HOUSES[house]||HOUSES.stark,ch=dmChampOf(house,cid),id=ch.id,hc=hh.col,rgb=hexRGB(hc[0]==='#'?hc:'#e3b661'),nm=shortName(ch).toUpperCase(),rng=ch.type==='ranged'||ch.type==='mage';
  dmRun(c,t,()=>{dGround(HBIOME[ch.house]||'forest');const hx=58,hy=RDY+2;
  if(cat==='aoe'){const sw=dmK(ph,1.15,1.45);const E=dGroup(['axe','sword','hound','axe'],ph,P,{v:95,stop:hx+24,sgap:12,hitAt:[1.3],hpTo:[0.2],dieAt:1.55,strike:1});
    dHero(id,hx,hy,{face:1,strike:ph>1.1&&ph<1.45?sw:-1,name:nm});
    dFx('cleave',hx+6,hy-10,dmK(ph,1.15,1.6),hc);dFx('ring',hx+6,hy-4,dmK(ph,1.2,1.75),'#ffe08a',10,78);dGlow(hx+8,hy-8,60,34,rgb,0.5*(1-dmK(ph,1.2,1.8))*(ph>1.2?1:0));
    for(let i=0;i<4;i++)dPop(E[i].x,E[i].y-36,'40',ph,1.3,'#ffe08a');}
  else if(cat==='rain'){const E=dGroup(['axe','sword','spear'],ph,P,{v:62,stop:150,strike:0,hitAt:[1.25,1.75],hpTo:[0.55,0],dieAt:1.85});
    dHero(id,hx,hy,{face:1,strike:ph>0.85&&ph<1.15?dmK(ph,0.85,1.15):ph>1.4&&ph<1.7?dmK(ph,1.4,1.7):-1,name:nm});
    for(let i=0;i<6;i++){const st=0.95+i*0.09+(i>2?0.4:0),e=E[i%3],x=e.x-6+(i*7)%14;dFx('meteor',x,e.y-6,dmK(ph,st,st+0.32),'#ffb23c');const k=dmK(ph,st+0.32,st+0.62);dFx('burst',x,e.y-8,k,'#ffb23c',4,22);}
    for(let i=0;i<3;i++){dPop(E[i].x,E[i].y-36,'90',ph,1.27,'#ffe08a');dPop(E[i].x,E[i].y-36,'90',ph,1.77,'#ffe08a');}}
  else if(cat==='heal'){const r=ph<1?0.72-0.4*dmK(ph,0.2,1):0.32+0.6*dmK(ph,1.1,2.2);dGate(r,30);
    dGroup(['axe','sword'],ph,P,{v:80,stop:68,sgap:16,strike:1,lane:[-2,6],bars:false});
    dHero(id,104,hy+4,{face:-1,strike:ph>0.9&&ph<1.2?dmK(ph,0.9,1.2):-1,name:nm});
    if(ph>1.05){for(let i=0;i<8;i++){const k=((ph*0.7+i/8)%1),x=30+Math.sin(i*5+ph*3)*22,y=RDY+10-k*58;dGlow(x,y,9,9,'127,255,138',0.9*(1-k));ctx.fillStyle='rgba(200,255,205,'+(1-k)+')';ctx.fillRect(x-0.8,y-3,1.6,6);ctx.fillRect(x-3,y-0.8,6,1.6);}
      dFx('ring',30,RDY-6,dmK(ph,1.05,1.65),'#7cff6b',8,60);}
    dPop(30,RDY-52,'+15',ph,1.25,'#9dff9d',true);}
  else if(cat==='shield'){dGroup(['sword','spear','axe'],ph,P,{v:95,stop:hx+22,sgap:14,strike:1});dHero(id,hx,hy,{face:1,strike:-1,name:nm});
    const on=dmK(ph,0.5,0.8),pul=0.85+0.15*Math.sin(DT0*6);if(on>0){ctx.save();ctx.globalAlpha=on;ctx.fillStyle='rgba(143,211,255,0.22)';ctx.strokeStyle='rgba(200,235,255,'+(0.75+0.25*Math.sin(DT0*5))+')';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(hx,hy-22,26*pul,30*pul,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
      for(let j=0;j<3;j++){const hit=1.3+j*0.45,k=dmK(ph,hit,hit+0.3);if(k>0&&k<1){ctx.strokeStyle='rgba(255,255,255,'+(1-k)+')';ctx.lineWidth=1.2;for(let i=0;i<3;i++){const a=-0.4+i*0.4+j;ctx.beginPath();ctx.moveTo(hx+Math.cos(a)*12,hy-18+Math.sin(a)*13);ctx.lineTo(hx+Math.cos(a+0.15)*20,hy-18+Math.sin(a+0.15)*22);ctx.lineTo(hx+Math.cos(a-0.1)*25,hy-18+Math.sin(a-0.1)*28);ctx.stroke();}}
        dPop(hx+18,hy-40,'0',ph,hit,'#9fd8ff');}}}
  else if(cat==='control'){const E=dGroup(['wolf','axe','sword'],ph,P,{v:85,slowAt:1.1,slowF:0.12,stun:1.15,hitAt:[1.1]});
    dHero(id,hx,hy,{face:1,strike:ph>0.85&&ph<1.15?dmK(ph,0.85,1.15):-1,name:nm});
    dFx('ring',E[1].x,RDY,dmK(ph,1.05,1.6),'#8fd3ff',8,60);dGlow(E[1].x,RDY-12,60,30,'143,211,255',0.35*dmK(ph,1.05,1.3)*(1-dmK(ph,2.8,3.15)));
    dTxt(E[1].x,RDY-52,'STUNNED',dmK(ph,1.2,1.4)*(1-dmK(ph,2.7,3)),'#ffe66d');}
  else if(cat==='dot'){const E=dGroup(['sword','spear','axe'],ph,P,{v:55,poison:1.05,burn:1.05,hitAt:[1.6,2.1,2.6],hpTo:[0.75,0.5,0.25]});
    dHero(id,hx,hy,{face:1,strike:ph>0.75&&ph<1.05?dmK(ph,0.75,1.05):-1,name:nm});
    for(let i=0;i<3;i++)dShot(rng?'hero':'wild',hx+10,hy-22,E[i].x,E[i].y-14,dmK(ph,0.8+i*0.06,1.05+i*0.06),18,hc);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)dPop(E[i].x,E[i].y-36,'6',ph,1.6+j*0.5,'#b8ffb8');}
  else if(cat==='buff'){const lit=ph>0.8;const E=dGroup(['axe','sword','axe'],ph,P,{v:48,hitAt:[1.0,1.5,2.0],hpTo:[0.7,0.4,0.1]});
    for(const tx of [128,184]){if(lit)dGlow(tx,RDY-36,34,15,'227,182,97',0.5+0.12*Math.sin(DT0*8));dTower('watch',3,tx,RDY-40);}
    dHero(id,hx,hy,{face:1,strike:ph>0.6&&ph<0.9?dmK(ph,0.6,0.9):-1,name:nm});dFx('ring',hx,hy-6,dmK(ph,0.7,1.3),hc,8,90);
    for(const tx of [128,184]){const per=lit?0.28:0.7;for(let j=0;j<2;j++){const q=((ph+j*per)/per)%1,e=E[(j+(tx>150?1:0))%3];if(e.on)dShot('watch',tx,RDY-78,e.x,e.y-14,q,6);}}
    dTxt(156,30,'+40% DAMAGE',dmK(ph,0.85,1.05)*(1-dmK(ph,2.9,3.15)),'#ffe08a',true);}
  else if(cat==='summon'){const k=dmK(ph,0.7,1.0);const E=dGroup(['axe','sword','hound'],ph,P,{v:80,stop:126,sgap:14,strike:1,hitAt:[1.6,2.1],hpTo:[0.5,0],dieAt:2.3});
    dHero(id,hx,hy,{face:1,strike:ph>0.5&&ph<0.8?dmK(ph,0.5,0.8):-1,name:nm});
    if(k>0){for(let i=0;i<2;i++){const x=hx+28+i*18+Math.min(1,dmK(ph,1.0,1.5))*24,y=hy+(i?6:-4);dFx('puff',x,y-8,dmK(ph,0.7,1.2),null,0,18);ctx.save();ctx.globalAlpha=k;dAlly(i,'foot',ch.house,x,y,1,ph<1.5,ph*40,dLast(ph,1.5+i*0.12,0.5));ctx.restore();}
      dGlow(hx+40,hy-14,40,26,'255,255,255',0.5*(1-k));}}
  else if(cat==='gold'){const E=dGroup(['axe','sword','axe'],ph,P,{v:70,stop:110,sgap:16,hitAt:[1.2],hpTo:[0],dieAt:1.3,dieStep:0.12});
    dHero(id,hx,hy,{face:1,strike:ph>1&&ph<1.3?dmK(ph,1,1.3):-1,name:nm});
    for(let i=0;i<3;i++){dFx('coins',E[i].x,E[i].y-12,dmK(ph,1.32+i*0.12,2.1+i*0.12));dPop(E[i].x,E[i].y-36,'+35%',ph,1.35+i*0.12,'#ffd23c');}
    ctx.save();ctx.fillStyle='rgba(6,11,20,.7)';rr(ctx,6,6,62,17,8);ctx.fill();ctx.font='800 11px Cinzel,serif';ctx.textAlign='left';ctx.fillStyle='#ffd23c';ctx.fillText('● '+(120+Math.round(dmK(ph,1.4,2.3)*42)),13,18.5);ctx.restore();}
  else if(cat==='strike'){const E=dGroup(['giant'],ph,P,{v:70,stop:122,strike:1,hitAt:[1.45],hpTo:[0],dieAt:1.75,lane:[2]});const run=dmK(ph,0.5,1.25);
    dHero(id,hx+run*36,hy,{face:1,moving:ph>0.5&&ph<1.25,walk:run*36,strike:ph>1.25&&ph<1.55?dmK(ph,1.25,1.55):-1,name:nm});
    dFx('xslash',E[0].x,E[0].y-22,dmK(ph,1.4,1.8));dGlow(E[0].x,E[0].y-22,50,40,'255,255,255',0.6*(1-dmK(ph,1.4,1.8))*(ph>1.4?1:0));dPop(E[0].x,E[0].y-56,'500!',ph,1.45,'#ffe08a',true);}
  else{dGroup(['axe','sword','axe'],ph,P,{v:60});dHero(id,hx,hy,{face:1,name:nm});dGlow(hx,hy-18,40,40,rgb,0.4+0.2*Math.sin(DT0*5));}
  });}
/* a looping demo on a canvas; returns the function that stops it */
function skillDemoLoop(cv,sk,house,cid){const c=cv.getContext('2d'),k=cv.width/SDW;let raf=0,t0=performance.now(),on=true;fSprites();
  const f=now=>{if(!on||!cv.isConnected){on=false;return;}c.setTransform(k,0,0,k,0,0);try{skillDemoFrame(c,sk,(now-t0)/1000,house,cid);}catch(e){}raf=requestAnimationFrame(f);};raf=requestAnimationFrame(f);return()=>{on=false;cancelAnimationFrame(raf);};}
