/* =========================== DEMOS FOR SPELLS, TOWERS AND CHAMPIONS (v1.2.5, real art since v1.4.6) ===========================
   The same small looping canvas as the skill demos (skilldemo.js) for every spell, every tower and every champion: a slice of a real
   battlefield, the real sprites and the battle's own fx, one short caption. A champion's picture plays his three skills one after another.
   <canvas class="dmv" data-dk="spell|tower|champ" data-di="id"> is started by demoMount(root); a loop stops when its canvas leaves the page. */
const DMS={};
const DMB={arrows:'reach',fire:'forest',reinf:'river',night:'snow',repair:'mountain',jars:'city',beacon:'storm',
  watch:'reach',scorp:'mountain',wild:'ash',glass:'snow',weir:'forest',keep:'river',rook:'storm',maul:'desert'};
/* the one caption: a dark pill at the top, in canvas px */
function dCap(txt,col,a){if(a<=0.01)return;ctx.save();ctx.scale(1/DZ,1/DZ);ctx.globalAlpha=Math.min(1,a);ctx.font='900 13px Cinzel,serif';ctx.textAlign='center';const w=ctx.measureText(txt).width+22;
  ctx.fillStyle='rgba(6,11,20,.72)';rr(ctx,SDW/2-w/2,7,w,22,11);ctx.fill();ctx.strokeStyle=hexA(col,.55);ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=col;ctx.fillText(txt,SDW/2,23);ctx.restore();}
function dCapT(ph,P){return dmK(ph,0.15,0.45)*(1-dmK(ph,P-0.3,P-0.05));}
function dReticle(x,y,r,a){if(a<=0.01)return;ctx.save();ctx.globalAlpha=a;ctx.setLineDash([4,4]);ctx.lineDashOffset=-DT0*30;ctx.strokeStyle='#e3b661';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,r,r*0.5,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(227,182,97,.12)';ctx.fill();ctx.restore();}
function dJar(x,y,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle='#6b4a2a';ctx.beginPath();ctx.ellipse(0,1,5,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8a6038';ctx.fillRect(-2.5,-8,5,4);ctx.fillStyle='#7cff6b';ctx.fillRect(-1.5,-10,3,2.5);ctx.restore();dGlow(x,y-8,8,8,'124,255,107',0.8);}
function dPool(x,y,rx,ry,a){if(a<=0.01)return;ctx.save();ctx.globalAlpha=a;ctx.fillStyle='rgba(124,255,107,'+(0.16+0.06*Math.sin(DT0*5.5))+')';ell(ctx,x,y,rx,ry);ctx.fillStyle='rgba(60,180,80,0.2)';for(let i=0;i<4;i++){const q=DT0*1.1+i*1.57;ell(ctx,x+Math.cos(q)*rx*0.37,y-3+Math.sin(q)*ry*0.3,rx*0.3,ry*0.3);}
  for(let j=0;j<7;j++){const q=j*0.9+1,fx=x+Math.cos(q)*rx*0.7,fy=y+Math.sin(q)*ry*0.55,fh=7+5*Math.abs(Math.sin(DT0*16+j*2));ctx.fillStyle=j%2?'#b8f27a':'#4fd94a';ctx.beginPath();ctx.moveTo(fx-3,fy);ctx.quadraticCurveTo(fx,fy-fh,fx+3,fy);ctx.closePath();ctx.fill();}
  ctx.restore();dGlow(x,y-4,rx*1.1,ry*1.4,'124,255,107',0.45*a);}
function dFlames(x,y,rx,ry,a,kind){if(a<=0.01)return;const C=kind==='g'?['#4fd94a','#b8f27a','124,255,107']:['#ff7a1c','#ffd27a','255,140,50'];dGlow(x,y-8,rx*1.2,ry*1.8,C[2],0.55*a);ctx.save();ctx.globalAlpha=a;ctx.fillStyle=kind==='g'?'rgba(40,90,30,.35)':'rgba(40,20,10,.35)';ell(ctx,x,y,rx*0.9,ry*0.8);
  for(let j=0;j<14;j++){const q=j*2.39,r=0.25+0.75*((j*0.37)%1),fx=x+Math.cos(q)*rx*r*0.85,fy=y+Math.sin(q)*ry*r*0.8,fh=(9+7*Math.abs(Math.sin(DT0*13+j*2.1)))*(1.1-r*0.4);ctx.fillStyle=j%3?C[0]:C[1];ctx.beginPath();ctx.moveTo(fx-3.4,fy);ctx.quadraticCurveTo(fx-2,fy-fh*0.6,fx+Math.sin(DT0*9+j)*1.5,fy-fh);ctx.quadraticCurveTo(fx+2,fy-fh*0.6,fx+3.4,fy);ctx.closePath();ctx.fill();}
  ctx.restore();}
function dSnow(a){if(a<=0.01)return;ctx.save();ctx.globalAlpha=a;ctx.fillStyle='rgba(143,190,255,.22)';ctx.fillRect(0,0,VW,VH);ctx.fillStyle='rgba(235,247,255,.9)';for(let i=0;i<34;i++){const x=(i*41.3+DT0*12+Math.sin(DT0+i)*6)%VW,y=(i*29.7+DT0*(18+i%5*4))%VH;ctx.fillRect(x,y,1.5,1.5);}ctx.restore();}
function dmSpell(c,id,t){const P=3.2,ph=t%P;dmRun(c,t,()=>{dGround(DMB[id]||'forest');
  if(id==='arrows'){const cx=150;dReticle(cx,RDY+2,58,dmK(ph,0.35,0.6)*(1-dmK(ph,1.0,1.2)));
    const E=dGroup(['axe','sword','shield','axe','hound'],ph,P,{v:58,gap:22,hitAt:[1.33],hpTo:[0],dieAt:1.42,dieStep:0.03});
    for(let i=0;i<18;i++){const st=0.95+(i%9)*0.035,ox=((i*37)%112)-56,oy=((i*23)%26)-12,q=dmK(ph,st,st+0.36),x1=cx+ox,y1=RDY+oy,x0=x1-40,y0=y1-130;if(q>0&&q<1)dArrow(x0+(x1-x0)*q,y0+(y1-y0)*q,Math.atan2(y1-y0,x1-x0),1);else if(q>=1&&ph<2.2){ctx.save();ctx.globalAlpha=1-dmK(ph,1.6,2.2);ctx.translate(x1,y1);ctx.rotate(Math.atan2(130,40));ctx.strokeStyle='#5a3a20';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(0,0);ctx.stroke();ctx.fillStyle='#d6dfe9';ctx.fillRect(-10,-1.5,3,3);ctx.restore();}}
    dFx('ring',cx,RDY+2,dmK(ph,1.3,1.8),'#e9eef5',12,70);for(let i=0;i<5;i++)dFx('hit',E[i].x,E[i].y-12,dmK(ph,1.33,1.6));
    for(let i=0;i<5;i++)dPop(E[i].x,E[i].y-36,'170',ph,1.34+i*0.03,'#ffe08a');dCap('170 DAMAGE IN A WIDE CIRCLE','#ffe08a',dCapT(ph,P));}
  else if(id==='fire'){const cx=150;const E=dGroup(['sword','thenn','giant'],ph,P,{v:46,gap:30,hitAt:[1.2],hpTo:[0.25],burn:1.2,dieAt:1.5,dies:[1,1,0],dieStep:0.08});
    const im=champImg('drogon'),m=CHAMP_META.drogon,q=dmK(ph,0.25,1.6);if(q>0&&q<1&&im&&m){const x=-70+q*(VW+140),y=26+Math.sin(q*6)*3,sc=96/m.w;ctx.fillStyle='rgba(0,0,0,.22)';ell(ctx,x+6,RDY+16,30,8);
      ctx.save();ctx.translate(x,y);ctx.scale(sc,sc*(1+0.05*Math.sin(DT0*14)));ctx.drawImage(im,-m.cx,-(m.by-m.h/2),m.C,m.C);ctx.restore();
      const b=dmK(ph,0.85,1.2);if(b>0&&b<1){const mx=x+42,my=y+6;ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<9;i++){const u=(i/9+b)%1;dGlow(mx+(cx-mx)*u,my+(RDY-6-my)*u,8+u*14,8+u*14,i%2?'255,154,60':'255,220,120',0.75);}ctx.restore();}}
    dFx('burst',cx,RDY-8,dmK(ph,1.15,1.6),'#ff9a3c',8,70);dFlames(cx,RDY+2,58,24,dmK(ph,1.15,1.35)*(1-dmK(ph,2.3,2.9)),'f');dGlow(cx,RDY-6,80,40,'255,150,60',0.35*dmK(ph,1.1,1.3)*(1-dmK(ph,2.2,2.8)));
    for(let i=0;i<3;i++)dPop(E[i].x,E[i].y-36,'400',ph,1.22,'#ffb23c',i===2);dCap('DRAGONFIRE: 400 + BURNING','#ffb23c',dCapT(ph,P));}
  else if(id==='reinf'){dGate(0.9,24);const E=dGroup(['axe','sword','axe'],ph,P,{v:70,stop:148,sgap:16,strike:1,hitAt:[1.5,1.9,2.3],hpTo:[0.65,0.3,0],dieAt:2.35,dieStep:0.06});
    for(let i=0;i<3;i++){const out=dmK(ph,0.35+i*0.12,0.5+i*0.12);if(out<=0)continue;const go=dmK(ph,0.5+i*0.12,1.35),x=46+go*(84+i*5),y=RDY+(i===1?7:i===2?-6:1);
      ctx.save();ctx.globalAlpha=Math.min(1,out*2)*(1-dmK(ph,P-0.3,P-0.05));dAlly(i,'brother','stark',x,y,1,go>0&&go<1,go*90,dLast(ph,1.4+i*0.1,0.4));ctx.restore();}
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)dPop(E[i].x,E[i].y-36,'12',ph,1.5+j*0.4,'#e9eef5');dCap('3 SWORN BROTHERS · 15 s','#e9eef5',dCapT(ph,P));}
  else if(id==='night'){const on=dmK(ph,0.85,1.15)*(1-dmK(ph,P-0.35,P-0.05));dSnow(on);
    dGroup(['hound','axe','wolf','sword'],ph,P,{v:120,gap:30,slowAt:0.95,slowF:0.25,slow:0.95});
    dFx('ring',VW/2,RDY,dmK(ph,0.85,1.6),'#bfe6ff',20,170);dCap('EVERY ENEMY 40% SLOWER · 6 s','#bfe6ff',dCapT(ph,P));}
  else if(id==='repair'){const r=ph<1.2?0.72-0.42*dmK(ph,0.35,1.15):0.3+0.3*dmK(ph,1.25,1.9);dGate(r,40);
    dGroup(['axe','sword'],ph,P,{v:85,stop:84,sgap:16,strike:1,lane:[-2,6]});
    if(ph>1.2){dFx('ring',40,RDY-4,dmK(ph,1.2,1.8),'#7cff6b',8,70);for(let i=0;i<10;i++){const k=((ph*0.75+i/10)%1),x=40+Math.sin(i*5+ph*3)*26,y=RDY+14-k*64;dGlow(x,y,8,8,'127,255,138',0.9*(1-k)*on1(ph));ctx.fillStyle='rgba(200,255,205,'+((1-k)*on1(ph))+')';ctx.fillRect(x-0.8,y-3,1.6,6);ctx.fillRect(x-3,y-0.8,6,1.6);}}
    dPop(40,RDY-50,'+30%',ph,1.3,'#9dff9d',true);dCap('THE GATE REGAINS 30%','#9dff9d',dCapT(ph,P));}
  else if(id==='jars'){const cx=140,q=dmK(ph,0.45,1.0);if(q>0&&q<1)dJar(-4+(cx+4)*q,20+(RDY-20)*q-Math.sin(q*Math.PI)*36,q*10);
    dFx('burst',cx,RDY-6,dmK(ph,1.0,1.5),'#7cff6b',6,60);dPool(cx,RDY+2,52,22,dmK(ph,1.0,1.25)*(1-dmK(ph,P-0.35,P-0.05)));
    const E=dGroup(['axe','sword','spear','axe'],ph,P,{v:44,gap:24,x0:VW-30,poison:1.15,hitAt:[1.4,1.9,2.4],hpTo:[0.7,0.4,0.1]});
    for(let i=0;i<4;i++)if(Math.abs(E[i].x-cx)<55)for(let j=0;j<3;j++)dPop(E[i].x,E[i].y-36,'70',ph,1.4+j*0.5,'#b8ffb8');dCap('A POOL OF WILDFIRE · 8 s','#b8ffb8',dCapT(ph,P));}
  else if(id==='beacon'){const lit=ph>1.0&&ph<P-0.2;const T=[96,170];
    for(const tx of T){if(lit)dGlow(tx,RDY-28,36,16,'255,178,60',0.55+0.15*Math.sin(DT0*9));}
    for(const tx of T)dTower('watch',3,tx,RDY-34);for(const tx of T)dFx('ring',tx,RDY-26,dmK(ph,1.0,1.6),'#ffb23c',6,34);
    const E=dGroup(['sword','spear','sword'],ph,P,{v:40,gap:30,x0:VW-20,hitAt:[0.6,1.2,1.45,1.7,1.95,2.2],hpTo:[0.85,0.7,0.55,0.4,0.25,0.1]});
    for(let ti=0;ti<2;ti++){const per=lit?0.3:0.6;for(let j=0;j<3;j++){const st=0.3+ti*0.12+j*per,q=((ph-st)%(per*3)+per*3)%(per*3)/0.3;const e=E[(j+ti)%3];if(q<1)dShot('watch',T[ti],RDY-72,e.x,e.y-14,q,8);}}
    if(lit)for(const tx of T){ctx.save();ctx.globalCompositeOperation='lighter';const fh=8+3*Math.sin(DT0*20+tx);ctx.fillStyle='rgba(255,170,60,.9)';ctx.beginPath();ctx.moveTo(tx-4,RDY-76);ctx.quadraticCurveTo(tx,RDY-76-fh*2,tx+4,RDY-76);ctx.fill();ctx.restore();}
    dCap('ALL TOWERS +30% FASTER · 8 s','#ffd54a',dCapT(ph,P));}
});}
function on1(ph){return 1-dmK(ph,2.6,3.1);}
function dmTowerScene(c,k,t){const P=3.2,ph=t%P;dmRun(c,t,()=>{dGround(DMB[k]||'forest');const tx=78,ty=RDY-36,cap=(s,col)=>dCap(s,col,dCapT(ph,P));
  if(k==='watch'){dTower('watch',3,tx,ty);const E=dGroup(['axe','raven','sword'],ph,P,{v:44,gap:34,lane:[-2,-40,6],hitAt:[0.9,1.5,2.1],hpTo:[0.66,0.33,0],dieAt:2.2,dieStep:0.1});
    for(let j=0;j<9;j++){const st=0.5+j*0.2,q=dmK(ph,st,st+0.2),e=E[j%3];if(e.on)dShot('watch',tx,ty-38,e.x,e.y-(e.type==='raven'?0:14),q,4);}
    cap('FAST ARROWS · GROUND AND AIR','#e9eef5');}
  else if(k==='scorp'){const E=dGroup(['giant','axe'],ph,P,{v:30,gap:44,lane:[2,-6],hitAt:[1.15,2.35],hpTo:[0.55,0.1]});
    dTower('scorp',3,tx,ty);
    for(const [a,b] of [[0.55,1.0],[1.75,2.2]]){const g=dmK(ph,a,b);if(g>0&&g<1)dGlow(tx,ty-24,10+10*g,10+10*g,'255,214,120',0.4+0.5*g);dShot('scorp',tx,ty-26,E[0].x,E[0].y-20,dmK(ph,b,b+0.15),0);dFx('burst',E[0].x,E[0].y-20,dmK(ph,b+0.15,b+0.5),'#ffd54a',4,26);dPop(E[0].x,E[0].y-56,'×2.5',ph,b+0.15,'#ffd54a',true);}
    cap('ONE HEAVY BOLT · BIG FOES','#ffd54a');}
  else if(k==='wild'){dTower('wild',3,tx,ty);const cx=170;const E=dGroup(['axe','sword','axe','spear'],ph,P,{v:36,gap:14,x0:VW-20,lane:[-4,6,0,-8],hitAt:[1.45],hpTo:[0.35],burn:1.45});
    dShot('wild',tx+6,ty-26,cx,RDY,dmK(ph,0.85,1.45),46);const bk=dmK(ph,1.45,2.2);if(bk>0&&bk<1){const r=48*(0.55+0.45*Math.min(1,bk*3));dGlow(cx,RDY,r,r*0.7,'140,255,100',0.6*(1-bk));
      for(let j=0;j<5;j++){const a=j*1.26+cx,fx=cx+Math.cos(a)*r*0.6,fy=RDY+Math.sin(a)*r*0.3,fh=7+5*Math.abs(Math.sin(DT0*16+j*2));ctx.globalAlpha=0.7*(1-bk);ctx.fillStyle=j%2?'#b8f27a':'#4fd94a';ctx.beginPath();ctx.moveTo(fx-3,fy);ctx.quadraticCurveTo(fx,fy-fh,fx+3,fy);ctx.closePath();ctx.fill();}ctx.globalAlpha=1;}
    dFx('ring',cx,RDY,dmK(ph,1.45,1.85),'#7cff6b',6,54);for(let i=0;i<4;i++)dPop(E[i].x,E[i].y-36,'30',ph,1.47,'#b8ffb8');cap('SPLASH + BURN ON A CROWD','#b8ffb8');}
  else if(k==='glass'){const gx=124;const E=dGroup(['walker','axe','sword'],ph,P,{v:62,gap:34,slowAt:0.9,slowF:0.45,slow:0.9,hitAt:[1.0,1.5,2.0,2.5],hpTo:[0.8,0.6,0.4,0.2]});
    ctx.globalAlpha=0.16+0.06*Math.sin(DT0*5);ctx.strokeStyle='#8fd3ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(gx,RDY-24,96,48,0,0,6.283);ctx.stroke();ctx.fillStyle='rgba(143,211,255,.06)';ctx.fill();ctx.globalAlpha=1;
    for(let i=0;i<3;i++){const e=E[i];if(!e.on||Math.abs(e.x-gx)>96)continue;for(let j=0;j<2;j++){const per=0.5,q=((ph+i*0.17+j*0.25)%per)/per,rise=q<0.3?q/0.3:1,fade=q<0.6?1:(1-q)/0.4,big=e.type==='walker',L=(big?30:20)*rise,w=big?4.2:3,ox=e.x+((i*7+j*11)%14)-7,oy=e.y+3;
      ctx.globalAlpha=fade;ctx.fillStyle='#16303f';ctx.beginPath();ctx.moveTo(ox-w,oy);ctx.lineTo(ox,oy-L);ctx.lineTo(ox+w,oy);ctx.closePath();ctx.fill();ctx.fillStyle='#9fe0ff';ctx.beginPath();ctx.moveTo(ox-w*0.2,oy);ctx.lineTo(ox,oy-L);ctx.lineTo(ox+w*0.5,oy);ctx.closePath();ctx.fill();ctx.globalAlpha=1;}}
    dTower('glass',3,gx,RDY-38);dPop(E[0].x,E[0].y-46,'×3 VS WALKERS',ph,1.05,'#9fe6ff',true);cap('ICE SPEARS · SLOW','#9fe6ff');}
  else if(k==='weir'){const wx=96;const E=dGroup(['sword','axe','spear'],ph,P,{v:44,gap:30,slowAt:0.8,slowF:0.6,hitAt:[1.2,1.8,2.4],hpTo:[0.6,0.3,0.05]});
    const S=(ph%1.5)/1.5;ctx.globalAlpha=0.28*(1-S);ctx.strokeStyle='#9be66e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(wx,RDY-30,110*S,55*S,0,0,6.283);ctx.stroke();ctx.globalAlpha=1;
    for(let i=0;i<3;i++){const e=E[i];if(!e.on)continue;const q=e.y+4;ctx.strokeStyle='rgba(120,80,48,0.85)';ctx.lineWidth=1.6;const w=10+Math.sin(DT0*4+i)*1.5;ctx.beginPath();ctx.moveTo(e.x-w,q+2);ctx.quadraticCurveTo(e.x-w*0.3,q-4,e.x,q+1);ctx.quadraticCurveTo(e.x+w*0.4,q+5,e.x+w,q-1);ctx.stroke();ctx.strokeStyle='rgba(150,235,110,0.6)';ctx.beginPath();ctx.moveTo(e.x-w*0.7,q);ctx.quadraticCurveTo(e.x,q+4,e.x+w*0.7,q+1);ctx.stroke();}
    dTower('weir',3,wx,RDY-36);dTower('watch',2,196,RDY-40);
    for(let j=0;j<3;j++){const st=0.95+j*0.6,e=E[j%3];if(e.on)dShot('watch',196,RDY-78,e.x,e.y-14,dmK(ph,st,st+0.25),6);dPop(e.x,e.y-36,'12 (+20%)',ph,st+0.25,'#ff9a8a');}
    cap('ROOTS: +20% DAMAGE TAKEN','#ff9a8a');}
  else if(k==='keep'){const house=(typeof ACC!=='undefined'&&ACC&&ACC.house)||'stark';dTower('keep',3,tx,ty);const E=dGroup(['axe','sword','axe'],ph,P,{v:70,stop:150,sgap:16,strike:1,hitAt:[1.6,2.1],hpTo:[0.5,0],dieAt:2.4,dieStep:0.08});
    for(let i=0;i<3;i++){const go=dmK(ph,0.3+i*0.1,1.1+i*0.1),x=tx+6+go*(52+i*4),y=ty+18+go*(RDY-ty-18+(i===1?7:i===2?-5:1));dAlly(i,'foot',house,x,y,1,go>0&&go<1,go*80,dLast(ph,1.3+i*0.13,0.42));}
    dTxt(150,RDY-52,'BLOCKED',dmK(ph,1.2,1.4)*(1-dmK(ph,2.2,2.5)),'#e9eef5',true);cap('SOLDIERS HOLD THE ROAD','#e9eef5');}
  else if(k==='rook'){dTower('rook',3,tx,ty);const E=dGroup(['necro','axe','sword'],ph,P,{v:38,gap:30,x0:VW-30,hitAt:[1.35,1.9],hpTo:[0.6,0.25]});const n=E[0];
    for(let i=0;i<3;i++){const q=dmK(ph,0.7+i*0.14,1.35+i*0.14);if(q>0&&q<1){const x=tx+(n.x-tx)*q,y=ty-30+(n.y-30-(ty-30))*q-Math.sin(q*3.14)*22;ctx.fillStyle='#14151c';ctx.beginPath();ctx.ellipse(x,y,4.4,2.6,0,0,6.283);ctx.fill();ctx.beginPath();ctx.moveTo(x-1,y-1);ctx.lineTo(x-5,y-7+Math.sin(DT0*30+i)*3);ctx.lineTo(x+1.5,y-2);ctx.fill();ctx.fillStyle='#e3b661';ctx.fillRect(x+3.5,y-0.6,2,1.2);}}
    if(ph>1.4&&n.on){ctx.strokeStyle='rgba(154,167,255,'+(0.7+0.3*Math.sin(DT0*9))+')';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(n.x,n.top+6,9+((ph*14)%5),0,6.283);ctx.stroke();ctx.beginPath();ctx.moveTo(n.x-6,n.top+12);ctx.lineTo(n.x+6,n.top);ctx.stroke();}
    dTxt(n.x,n.top-10,'SILENCED',dmK(ph,1.4,1.6)*(1-dmK(ph,2.8,3.1)),'#b8c2ff',true);cap('RAVENS HUNT THE CASTERS','#b8c2ff');}
  else if(k==='maul'){const mx=104,my=RDY-30,per=1/Math.max(.2,TOWERS.maul.rate);dTower('maul',3,mx,my,ph>=1.3?per-(ph-1.3):per*2);
    const E=dGroup(['axe','sword','axe','hound'],ph,P,{v:62,gap:14,stop:118,sgap:13,lane:[-4,6,0,-8],hitAt:[1.55],hpTo:[0.4],stun:1.55,strike:0});
    dFx('ring',140,RDY,dmK(ph,1.5,1.9),'#e3b661',6,52);for(let i=0;i<5;i++)dFx('puff',118+i*11,RDY+4,dmK(ph,1.52+i*0.02,2.2),null,0,14);for(let i=0;i<4;i++)dPop(E[i].x,E[i].y-36,'46',ph,1.56,'#ffd54a');cap('SLAM + STAGGER','#ffe08a');}
});}
function dmChamp(c,ch,t){const P=3.2,i=Math.floor(t/P)%ch.sk.length,sk=ch.sk[i];skillDemoFrame(c,sk,t,ch.house,ch.id);
  {const ph=t%P,fd=ph<0.22?1-ph/0.22:ph>P-0.22?(ph-(P-0.22))/0.22:0;if(fd>0){c.save();c.fillStyle='rgba(6,11,20,'+(fd*0.85).toFixed(3)+')';c.fillRect(0,0,SDW,SDH);c.restore();}}
  c.save();const g=c.createLinearGradient(0,SDH-34,0,SDH);g.addColorStop(0,'rgba(6,11,20,0)');g.addColorStop(1,'rgba(6,11,20,.85)');c.fillStyle=g;c.fillRect(0,SDH-34,SDW,34);c.font='800 13px Cinzel,serif';c.fillStyle='#ffe08a';c.textAlign='left';c.fillText((SK[sk]?SK[sk].n:sk)+(SK[sk]&&SK[sk].ult?'  · ULT':''),10,SDH-9);c.textAlign='right';c.fillStyle='#b9c8da';c.fillText((i+1)+' / '+ch.sk.length,SDW-10,SDH-9);c.restore();}
function demoFrame(c,kind,id,t,house){if(kind==='spell')dmSpell(c,id,t);else if(kind==='tower')dmTowerScene(c,id,t);else if(kind==='champ'){const ch=CBY[id];if(ch)dmChamp(c,ch,t);}}
function demoLoop(cv){const kind=cv.dataset.dk,id=cv.dataset.di,c=cv.getContext('2d'),k=cv.width/SDW;let raf=0,t0=performance.now(),on=true;fSprites();
  const f=now=>{if(!on||!cv.isConnected){on=false;return;}c.setTransform(k,0,0,k,0,0);try{demoFrame(c,kind,id,(now-t0)/1000,ACC.house);}catch(e){}raf=requestAnimationFrame(f);};raf=requestAnimationFrame(f);return()=>{on=false;cancelAnimationFrame(raf);};}
function demoHTML(kind,id){return `<div class="dmw"><canvas class="dmv" width="640" height="360" data-dk="${kind}" data-di="${id}"></canvas></div>`;}
function demoMount(root){(DMS.stop||[]).forEach(f=>f());DMS.stop=[];(root||document).querySelectorAll('canvas.dmv').forEach(cv=>DMS.stop.push(demoLoop(cv)));}
/* the rooms */
{const sr1=showSpellRoom;showSpellRoom=function(k){sr1(k);k=SPELLS[k]?k:'arrows';const det=card.querySelector('#clist .hdet');if(det){det.insertAdjacentHTML('afterbegin',demoHTML('spell',k));demoMount(det);}};
 const tr1=showTowerRoom;showTowerRoom=function(k){tr1(k);const st=card.querySelector('#clist .hact')||card.querySelector('#clist .tstage');if(st){const kk=card.querySelector('.htile.view');const key=kk?kk.dataset.t:k;if(TOWERS[key]){st.insertAdjacentHTML('afterend',demoHTML('tower',key));demoMount(card.querySelector('#clist'));}}};
 const hr1=showHeroRoom;showHeroRoom=function(v){hr1.apply(this,arguments);const nm=card.querySelector('#clist .bigbtn.ride');const list=CHAMPS.filter(x=>x.house===ACC.house);const c=list.find(x=>x.id===v)||list.find(x=>x.id===ACC.sel)||list[0];if(nm&&c&&unlocked(null,c)){nm.insertAdjacentHTML('afterend',demoHTML('champ',c.id));demoMount(card.querySelector('#clist'));}};}
