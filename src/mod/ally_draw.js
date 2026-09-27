function drawAlly(a,now){const b=a.bornT!=null?Math.min(1,Math.max(0,(G.time-a.bornT)/0.3)):1;if(b<=0)return;
  const fade=a.t!==Infinity&&a.t<0.9?Math.max(0,a.t/0.9):1;ctx.save();if(fade<1)ctx.globalAlpha=fade;
  if(b<1){ctx.translate(a.x,a.y+2);ctx.scale(0.55+0.45*b,0.55+0.45*b);ctx.translate(-a.x,-a.y-2);}
  drawAllyBody(a,now);ctx.restore();
  if(a.hp<a.max&&fade>0.3){const w=20,x=a.x-w/2,y=a.y-44;ctx.fillStyle='rgba(8,12,20,0.85)';ctx.fillRect(x-1,y-1,w+2,4);ctx.fillStyle=a.kind==='brother'?'#e9eef5':HOUSES[ACC.house].col;ctx.fillRect(x,y,w*Math.max(0,a.hp/a.max),2);}}
/* a sworn brother / house soldier: cloak, round shield, helm (hood for the Watch) and a sword that swings on every hit */
function drawAllyBody(a,now){
  const hh=HOUSES[ACC.house],br=a.kind==='brother',f=a.face||1;
  const cloak=br?'#14161b':hh.col2,cloak2=br?'#262a33':hexA(hh.col,1),tunic=br?'#1f2229':'#3a3f4a',steel='#b9c3cf',steel2='#6d7886';
  const ph=a.moving?Math.sin((a.walk||0)*9):0,bob=a.moving?Math.abs(ph)*0.8:0;
  const sw=a.strikeT!=null?Math.max(0,1-(G.time-a.strikeT)/0.26):0;
  const hurt=a.hitT!=null&&G.time-a.hitT<0.12;
  ctx.save();ctx.translate(a.x,a.y);
  ctx.fillStyle='rgba(0,0,0,0.34)';ell(ctx,0,1.5,11,3.8);
  ctx.scale(1.62*f,1.62);ctx.translate(0,-bob);
  /* cloak */
  ctx.fillStyle=cloak;ctx.beginPath();ctx.moveTo(-2.5,-15.5);ctx.quadraticCurveTo(-9.5-1.6*ph,-7,-7.5-ph,0.6);ctx.lineTo(1.5,0.4);ctx.lineTo(2,-14);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.45)';ctx.lineWidth=0.7;ctx.stroke();
  /* legs */
  ctx.strokeStyle='#15171d';ctx.lineWidth=2.3;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-1.4,-5.5);ctx.lineTo(-2.2+2.4*ph,0);ctx.moveTo(1.6,-5.5);ctx.lineTo(2.4-2.4*ph,0);ctx.stroke();
  /* torso */
  ctx.fillStyle=tunic;rr(ctx,-4.3,-15,8.6,10.5,2.6);ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=0.7;rr(ctx,-4.3,-15,8.6,10.5,2.6);ctx.stroke();
  ctx.fillStyle=br?'#50473d':hh.col;ctx.fillRect(-4.3,-8.4,8.6,1.7);
  if(br){ctx.fillStyle='#5a5046';ell(ctx,0,-14.6,5.4,2.1);ctx.fillStyle='#71665a';ell(ctx,-1,-15,3,1.1);}
  else{ctx.fillStyle=cloak2;ctx.fillRect(-4.3,-15,8.6,2.2);}
  /* sword arm: rests forward, swings overhead-to-front on a hit */
  const ang=sw>0?(-2.3+2.9*(1-sw)):-0.55+0.1*ph;
  ctx.save();ctx.translate(2.2,-12.2);ctx.rotate(ang);
  ctx.strokeStyle=hurt?'#fff':'#e0c49a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(4.5,0);ctx.stroke();
  ctx.fillStyle='#3a2a18';ctx.fillRect(4,-1.3,1.6,2.6);
  ctx.fillStyle=steel;ctx.beginPath();ctx.moveTo(5.6,-0.9);ctx.lineTo(15.5,-0.3);ctx.lineTo(16.8,0.2);ctx.lineTo(15.5,0.7);ctx.lineTo(5.6,0.9);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';ctx.globalAlpha*=0.55;ctx.fillRect(6,-0.6,9,0.5);ctx.restore();
  if(sw>0.35){ctx.strokeStyle='rgba(255,255,255,'+(0.5*sw)+')';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(2.2,-12.2,15,-2.1,-2.1+2.6*(1-sw));ctx.stroke();}
  /* head: hood for the Watch, steel helm with a nasal for house men */
  ctx.fillStyle=hurt?'#fff':'#d8b28c';ctx.beginPath();ctx.arc(0.6,-18.6,3.4,0,Math.PI*2);ctx.fill();
  if(br){ctx.fillStyle='#101216';ctx.beginPath();ctx.moveTo(-3.8,-15.6);ctx.quadraticCurveTo(-4.8,-23.6,0.8,-23.4);ctx.quadraticCurveTo(5,-23,4.4,-18.6);ctx.lineTo(2.6,-19.8);ctx.quadraticCurveTo(1,-21.2,-1.6,-19.6);ctx.lineTo(-2.2,-15.4);ctx.closePath();ctx.fill();}
  else{ctx.fillStyle=steel2;ctx.beginPath();ctx.arc(0.6,-19.4,3.9,Math.PI,0);ctx.fill();ctx.fillStyle=steel;ctx.beginPath();ctx.arc(0.2,-20,2.9,Math.PI*1.05,Math.PI*1.6);ctx.lineTo(0.6,-19.4);ctx.fill();ctx.fillStyle=steel2;ctx.fillRect(2.6,-19.6,1,3.4);ctx.fillStyle=hh.col;ctx.fillRect(-0.3,-24.2,1.6,1.8);}
  /* shield on the leading arm */
  const sx=3.2,sy=-9.8;ctx.fillStyle=br?'#1b1e25':hh.col;ctx.beginPath();ctx.ellipse(sx,sy,3.4,4.6,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=br?'#c9d2dd':'#e9d8a6';ctx.lineWidth=1.1;ctx.stroke();
  ctx.fillStyle=br?'#c9d2dd':'#f3e7c4';ctx.beginPath();ctx.arc(sx,sy,1.1,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
