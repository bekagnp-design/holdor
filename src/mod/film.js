/* =========================== FILMS (v1.1.3) ===========================
   Short thriller films drawn by the engine itself — nothing is a video file. A film is a list of shots; a shot is one procedural
   canvas scene (dunes, the Wall, a road in fog, a raven, the gate, a door, Hodor, the champion, the dead host, beacons, a map, a
   hall, dawn, the Night King, a crest, a title card) with a camera drift, captions that type themselves, sounds, lightning flashes
   and shakes. The story data (`STORY_DATA`, written for the game, see src/story/) says which scene, how long, what is said.
   Letterbox bars, film grain and a vignette sit over everything. A Skip button is always there; flashes and shakes are off for
   people who asked their phone for reduced motion. */
const FW=390,FH=844;
const FILMS={};
const FILM={on:false};
let FIL=null,FOGS=null,FGRAIN=null;
const FIMG={};
const fClamp=(v,a,b)=>v<a?a:v>b?b:v;
const fLerp=(a,b,u)=>a+(b-a)*u;
const fN=seed=>mulberry32((seed>>>0)||1);
function fImg(src){if(!src)return null;let m=FIMG[src];if(!m){m=new Image();m.src=src;FIMG[src]=m;}return m.complete&&m.naturalWidth?m:null;}
function filmWarm(){try{fImg(typeof GATE_ART!=='undefined'&&GATE_ART[1]);const h=ACC&&ACC.house;if(h&&SIGILS[h])fImg(SIGILS[h]);const c=ACC&&CBY[ACC.sel];if(c)fImg(CHAMP_ART[c.id+'_portrait']);}catch(e){}}
function fSprites(){if(FOGS)return;
  FOGS=document.createElement('canvas');FOGS.width=256;FOGS.height=128;let g=FOGS.getContext('2d');g.translate(128,64);g.scale(1,.5);
  const gr=g.createRadialGradient(0,0,4,0,0,128);gr.addColorStop(0,'rgba(190,210,232,.6)');gr.addColorStop(1,'rgba(190,210,232,0)');g.fillStyle=gr;g.fillRect(-128,-128,256,256);
  FGRAIN=document.createElement('canvas');FGRAIN.width=FGRAIN.height=128;g=FGRAIN.getContext('2d');const id=g.createImageData(128,128),d=id.data,r=fN(5);
  for(let i=0;i<d.length;i+=4){const v=r()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=r()*70;}g.putImageData(id,0,0);}
/* ---------- drawing helpers ---------- */
function fGlow(c,x,y,r,col,a){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,hexA(col,a));g.addColorStop(1,hexA(col,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function fSky(c,a,b,mid,midAt){const g=c.createLinearGradient(0,0,0,FH);g.addColorStop(0,a);if(mid)g.addColorStop(midAt||.55,mid);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,0,FW,FH);}
function fStars(c,t,n,seed,ymax,a0){const r=fN(seed);c.fillStyle='#dfefff';for(let i=0;i<n;i++){const x=r()*FW,y=r()*ymax,s=.4+r()*1.1,ph=r()*6.28,sp=.6+r()*1.2;c.globalAlpha=(a0||.8)*(.35+.65*Math.abs(Math.sin(t*sp+ph)));c.fillRect(x,y,s,s);}c.globalAlpha=1;}
function fMoon(c,x,y,r,a){a=a==null?1:a;c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y,r*4.5,'#9fc4ff',.24*a);c.restore();c.fillStyle='#e8f1ff';c.beginPath();c.arc(x,y,r,0,6.283);c.fill();c.fillStyle='rgba(120,150,190,.32)';[[-.3,-.2,.28],[.25,.15,.2],[.1,-.42,.14]].forEach(m=>{c.beginPath();c.arc(x+m[0]*r,y+m[1]*r,m[2]*r,0,6.283);c.fill();});}
function fSnow(c,t,n,seed,wind){const r=fN(seed);c.fillStyle='#eaf4ff';for(let i=0;i<n;i++){const x0=r()*FW,y0=r()*FH,sp=26+r()*60,sz=.7+r()*1.6,dr=(wind==null?14:wind)*(.5+r());const x=(((x0+t*dr+Math.sin(t*.8+i)*8)%FW)+FW)%FW,y=(y0+t*sp)%FH;c.globalAlpha=.3+.5*r();c.beginPath();c.arc(x,y,sz,0,6.283);c.fill();}c.globalAlpha=1;}
function fFog(c,t,amt,y0,y1,seed){if(amt<=0)return;fSprites();const r=fN(seed||7);for(let i=0;i<9;i++){const sp=4+r()*10,x=((r()*FW*1.6+t*sp)%(FW*1.6+400))-250,y=y0+r()*(y1-y0),s=1.2+r()*1.8;c.globalAlpha=amt*(.25+r()*.4);c.drawImage(FOGS,x,y-40*s,256*s,100*s);}c.globalAlpha=1;}
function fEyes(c,x,y,sz,a,col){if(a<=.01)return;col=col||'#7fd8ff';c.save();c.globalCompositeOperation='lighter';[-1,1].forEach(sd=>{const ex=x+sd*sz*1.5;fGlow(c,ex,y,sz*5,col,.5*a);c.fillStyle=hexA('#d8f6ff',a);c.beginPath();c.ellipse(ex,y,sz*.9,sz*.5,0,0,6.283);c.fill();});c.restore();}
function fWight(c,x,y,s,ph,col){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle=col||'#05080d';c.strokeStyle=c.fillStyle;
  c.beginPath();c.moveTo(-9,-46);c.quadraticCurveTo(-14,-20,-12+Math.sin(ph)*1.5,0);c.lineTo(-6,-2+Math.sin(ph+1));c.lineTo(-2,2);c.lineTo(3,-3);c.lineTo(8,1);c.lineTo(13+Math.sin(ph+2)*1.5,0);c.quadraticCurveTo(13,-22,9,-46);c.closePath();c.fill();
  c.beginPath();c.ellipse(0,-52,6.5,8,0,0,6.283);c.fill();
  c.lineWidth=2;c.beginPath();c.moveTo(8,-40);c.lineTo(16,-30);c.stroke();c.lineWidth=1.4;c.beginPath();c.moveTo(16,-64);c.lineTo(16+Math.sin(ph)*.6,6);c.stroke();c.beginPath();c.moveTo(14,-62);c.lineTo(16,-71);c.lineTo(18,-62);c.fill();c.restore();}
function fRider(c,x,y,s,t){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle=c.strokeStyle='#04070b';const g=Math.sin(t*12);
  c.beginPath();c.ellipse(0,-30,34,14,0,0,6.283);c.fill();c.lineWidth=4;c.lineCap='round';
  [[-24,g],[-12,-g],[14,g],[26,-g]].forEach(([lx,ph])=>{c.beginPath();c.moveTo(lx,-24);c.lineTo(lx+ph*8,-2-Math.abs(ph)*6);c.stroke();});
  c.beginPath();c.moveTo(24,-38);c.quadraticCurveTo(40,-58,46,-52);c.lineTo(52,-46);c.lineTo(44,-42);c.quadraticCurveTo(34,-36,30,-30);c.closePath();c.fill();
  c.lineWidth=3;c.beginPath();c.moveTo(-32,-34);c.quadraticCurveTo(-52,-30-g*4,-56,-18);c.stroke();
  c.beginPath();c.moveTo(-6,-40);c.lineTo(-2,-66);c.lineTo(8,-64);c.lineTo(10,-40);c.closePath();c.fill();c.beginPath();c.arc(3,-72,6,0,6.283);c.fill();
  c.beginPath();c.moveTo(-4,-62);c.quadraticCurveTo(-30,-60-g*3,-44,-44);c.lineTo(-30,-48);c.lineTo(-6,-46);c.closePath();c.fill();c.restore();}
function fTorch(c,x,y,t,s,gl){s=s||1;gl=gl==null?1:gl;const fl=.85+.15*Math.sin(t*17+x)+.08*Math.sin(t*31);c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y-10*s,120*s*fl*(.5+.5*gl),'#ff9a3c',.38*gl);c.restore();
  c.fillStyle='#2a1a0c';c.fillRect(x-2*s,y,4*s,22*s);[['#ff7a1c',11,1],['#ffb23c',8,.8],['#fff0a0',4.5,.55]].forEach(([col,h,w])=>{c.fillStyle=col;c.beginPath();c.moveTo(x-5*s*w,y);c.quadraticCurveTo(x-6*s*w,y-h*s*fl,x+Math.sin(t*9+x)*2*s,y-(h+7)*s*fl);c.quadraticCurveTo(x+6*s*w,y-h*s*fl,x+5*s*w,y);c.closePath();c.fill();});}
function fKingSil(c,x,y,s,t){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle=c.strokeStyle='#04080e';const sw=Math.sin(t*1.6)*2;
  c.beginPath();c.moveTo(-14,-92);c.quadraticCurveTo(-34,-40,-40+sw,0);c.lineTo(-14,-6);c.lineTo(0,2);c.lineTo(14,-6);c.lineTo(40+sw,0);c.quadraticCurveTo(34,-40,14,-92);c.closePath();c.fill();
  c.beginPath();c.ellipse(0,-104,9,12,0,0,6.283);c.fill();
  for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(i*3.4-2.4,-112);c.lineTo(i*4.4,-112-14-(3-Math.abs(i))*4);c.lineTo(i*3.4+2.4,-112);c.fill();}
  c.lineWidth=2.4;c.beginPath();c.moveTo(-16,-84);c.lineTo(-26,-66);c.stroke();c.lineWidth=2;c.beginPath();c.moveTo(34,-130);c.lineTo(30,6);c.stroke();c.restore();}
function fCandle(c,x,y,t){const fl=.8+.2*Math.sin(t*14)+.1*Math.sin(t*23);c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y-20,210*fl,'#ff9a3c',.3);c.restore();
  c.fillStyle='#d8caa8';c.fillRect(x-7,y,14,74);c.fillStyle='#b4a584';c.fillRect(x-7,y,3,74);c.fillStyle='#ffb23c';c.beginPath();c.moveTo(x-5,y);c.quadraticCurveTo(x-8,y-18*fl,x+Math.sin(t*8)*2,y-36*fl);c.quadraticCurveTo(x+8,y-18*fl,x+5,y);c.fill();
  c.fillStyle='#fff3b0';c.beginPath();c.moveTo(x-2.4,y);c.quadraticCurveTo(x-3.4,y-9*fl,x,y-17*fl);c.quadraticCurveTo(x+3.4,y-9*fl,x+2.4,y);c.fill();}
function fFrost(c,x0,y0,len,seed,a,ang){const r=fN(seed);c.save();c.strokeStyle='rgba(225,242,255,'+a+')';c.lineCap='round';
  const br=(x,y,an,l,w,d)=>{if(d>5||l<6)return;const x2=x+Math.cos(an)*l,y2=y+Math.sin(an)*l;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();br(x2,y2,an+.55+r()*.35,l*.66,w*.72,d+1);br(x2,y2,an-.55-r()*.35,l*.66,w*.72,d+1);};
  br(x0,y0,ang,len,1.8,0);c.restore();}
function fVig(c,a){const g=c.createRadialGradient(FW/2,FH/2,FH*.28,FW/2,FH/2,FH*.74);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,'+a+')');c.fillStyle=g;c.fillRect(0,0,FW,FH);}
const fNum=(v,d)=>v===true?1:v==null||v===false?(v===false?0:d):+v;
function fHouse(X){return HOUSES[X.house]||HOUSES.stark;}
/* ---------- the scenes ---------- */
const FSC={
black(c,t,u,p,X){c.fillStyle='#02040a';c.fillRect(0,0,FW,FH);
  if(p.flame)fCandle(c,195,430,t);
  if(p.eyes){const r=fN(11);for(let i=0;i<p.eyes;i++){const x=45+r()*300,y=250+r()*360,sz=2+r()*2.4,st=i*Math.min(.55,X.d*.08),a=fClamp((t-st)/(X.d<2?.25:1.2),0,1)*(.6+.4*Math.sin(t*2+i)),bl=Math.sin(t*1.7+i*3)>.94?0:1;fEyes(c,x,y,sz,a*bl);}}
  if(p.pulse){const ph=(t%.95)/.95;c.strokeStyle='rgba(190,40,40,'+((1-ph)*.55)+')';c.lineWidth=3;c.beginPath();c.arc(195,422,20+ph*170,0,6.283);c.stroke();fGlow(c,195,422,90,'#a01818',.25*(1-ph));}},
dunes(c,t,u,p,X){const f=p.frost||0;fSky(c,'#040815','#5a3a30','#101a3a',.5);const g=c.createLinearGradient(0,380,0,560);g.addColorStop(0,'rgba(120,70,50,0)');g.addColorStop(1,'rgba(150,80,50,.35)');c.fillStyle=g;c.fillRect(0,380,FW,180);
  fStars(c,t,70,3,380,.85);c.save();c.beginPath();c.arc(290,170,26,0,6.283);c.clip();c.fillStyle='#e8f1ff';c.fillRect(264,144,60,60);c.fillStyle='#101a3a';c.beginPath();c.arc(300,164,24,0,6.283);c.fill();c.restore();c.save();c.globalCompositeOperation='lighter';fGlow(c,290,170,110,'#9fc4ff',.12);c.restore();
  const cols=['#2b1e24','#1d1519','#0f0b10'],crest=(L,x)=>520+L*118+Math.sin(x*.012+L*2)*30+Math.sin(x*.031+L)*12;
  for(let L=0;L<3;L++){c.beginPath();c.moveTo(0,FH);for(let x=0;x<=FW+10;x+=10)c.lineTo(x,crest(L,x));c.lineTo(FW,FH);c.closePath();c.fillStyle=cols[L];c.fill();
    if(f>0){const gg=c.createLinearGradient(0,470+L*118,0,610+L*118);gg.addColorStop(0,'rgba(215,236,255,'+(.5*f)+')');gg.addColorStop(1,'rgba(215,236,255,0)');c.fillStyle=gg;c.fill();c.strokeStyle='rgba(235,247,255,'+(.85*f)+')';c.lineWidth=1+f*3;c.beginPath();for(let x=0;x<=FW+10;x+=10){x?c.lineTo(x,crest(L,x)):c.moveTo(x,crest(L,x));}c.stroke();}
    if(L===0&&p.fires){const xs=[60,140,255,330];for(let i=0;i<Math.min(4,p.fires);i++)fTorch(c,xs[i],crest(0,xs[i])-4,t+i,.8,.5);}
    if(L===1&&p.palms){[[60,1],[318,.8],[352,1.1]].forEach(([px,s])=>{const py=crest(1,px)+6;c.save();c.translate(px,py);c.scale(s,s);c.strokeStyle=c.fillStyle='#07050a';c.lineWidth=5;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-6,-50,6,-96);c.stroke();
      for(let k=0;k<8;k++){const an=-Math.PI/2+(k-3.5)*.55,sg=Math.sin(t*.8+k)*.04;c.lineWidth=3;c.beginPath();c.moveTo(6,-96);c.quadraticCurveTo(6+Math.cos(an+sg)*30,-96+Math.sin(an+sg)*30-10,6+Math.cos(an+sg)*58,-96+Math.sin(an+sg)*50+12);c.stroke();
        if(f>.45){c.strokeStyle='rgba(220,240,255,'+((f-.45)*1.5)+')';c.lineWidth=1.2;c.stroke();c.strokeStyle='#07050a';}}c.restore();});}}
  if((p.heat||0)>0){c.strokeStyle='rgba(255,230,200,'+(p.heat*.07)+')';c.lineWidth=2;for(let i=0;i<16;i++){c.beginPath();for(let x=0;x<=FW;x+=8){const y=470+i*9+Math.sin(x*.05+t*3+i)*3;x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}}
  if(f>.3)fSnow(c,t,Math.round(60*f),21,6);fFog(c,t,.18+f*.3,540,760,4);},
wall(c,t,u,p,X){fSky(c,'#030c18','#0b2236');const au=p.aurora==null?.6:p.aurora;
  if(au>0){c.save();c.globalCompositeOperation='lighter';for(let k=0;k<3;k++){c.beginPath();for(let x=0;x<=FW;x+=10){const y=110+k*34+Math.sin(x*.018+t*.4+k*2)*28;x?c.lineTo(x,y):c.moveTo(x,y);}for(let x=FW;x>=0;x-=10)c.lineTo(x,160+k*34+Math.sin(x*.018+t*.4+k*2)*32+50);c.closePath();const g=c.createLinearGradient(0,90,0,280);g.addColorStop(0,'rgba(80,255,190,'+(.17*au)+')');g.addColorStop(.5,'rgba(70,200,230,'+(.1*au)+')');g.addColorStop(1,'rgba(60,120,255,0)');c.fillStyle=g;c.fill();}c.restore();}
  fStars(c,t,80,8,260,.9);fMoon(c,318,70,16,.7);
  const top=x=>360+Math.sin(x*.02)*8+Math.sin(x*.07)*4+((x*13)%7);c.beginPath();c.moveTo(0,FH);for(let x=0;x<=FW+5;x+=5)c.lineTo(x,top(x));c.lineTo(FW,FH);c.closePath();const g=c.createLinearGradient(0,350,0,FH);g.addColorStop(0,'#6f95b0');g.addColorStop(.15,'#385a74');g.addColorStop(1,'#0a1420');c.fillStyle=g;c.fill();
  const r=fN(31);c.lineWidth=1;for(let i=0;i<30;i++){const x=r()*FW,y0=top(x)+8+r()*30,l=50+r()*300;c.strokeStyle='rgba(6,16,28,'+(.14+r()*.22)+')';c.beginPath();c.moveTo(x,y0);c.lineTo(x+(r()-.5)*14,y0+l);c.stroke();}
  for(let i=0;i<10;i++){c.strokeStyle='rgba(200,230,250,.05)';c.beginPath();c.moveTo(0,390+i*46);c.lineTo(FW,390+i*46+Math.sin(i)*8);c.stroke();}
  [[60,18],[250,24]].forEach(([x,w])=>{const y=top(x);c.fillStyle='#08121d';c.fillRect(x-w/2,y-34,w,34);c.fillRect(x-w/2-3,y-38,w+6,5);c.fillStyle='rgba(255,170,80,.7)';c.fillRect(x-2,y-24,4,7);});
  const n=p.beacons||0;for(let i=0;i<n;i++){const x=n===1?195:24+i*(342/Math.max(1,n-1)),on=(u*(n+1))>(i+.2);if(on){c.save();c.globalCompositeOperation='lighter';fGlow(c,x,top(x)-10,60,'#ff8a2a',.12);c.restore();fTorch(c,x,top(x)-4,t+i,1.2,.3);}}
  fSnow(c,t,Math.round(90*(p.snow==null?.5:p.snow)),12,22);fFog(c,t,.2,640,830,3);fVig(c,.4);},
road(c,t,u,p,X){fSky(c,'#040a14','#16222f','#0b1522',.5);fStars(c,t,40,9,260,.5);
  const VY=330,ry=v=>VY+Math.pow(v,1.6)*(FH-VY),rw=v=>10+Math.pow(v,1.6)*260;
  c.fillStyle='#0a121c';c.fillRect(0,VY,FW,FH-VY);
  c.beginPath();c.moveTo(195-rw(0),VY);c.lineTo(195+rw(0),VY);c.lineTo(195+rw(1),FH);c.lineTo(195-rw(1),FH);c.closePath();const g=c.createLinearGradient(0,VY,0,FH);g.addColorStop(0,'#1d2a3a');g.addColorStop(1,'#46566a');c.fillStyle=g;c.fill();
  const r=fN(17);for(let i=0;i<26;i++){const v=.04+r()*.96,sd=r()<.5?-1:1,x=195+sd*(rw(v)+30+r()*140)*(.9+v),y=ry(v),h=26+v*300;c.fillStyle='#050a10';c.beginPath();c.moveTo(x,y);c.lineTo(x-h*.2,y);c.lineTo(x-h*.12,y-h*.4);c.lineTo(x-h*.17,y-h*.4);c.lineTo(x,y-h);c.lineTo(x+h*.17,y-h*.4);c.lineTo(x+h*.12,y-h*.4);c.lineTo(x+h*.2,y);c.closePath();c.fill();}
  fFog(c,t,(p.fog==null?.7:p.fog)*.7,VY-30,VY+160,5);
  if(p.figure){const v=.42,y=ry(v);fWight(c,195,y,.82,0,'#03060a');fEyes(c,195,y-54*.82,1.9,.55+.45*Math.sin(t*1.2),'#9fe6ff');}
  if(p.eyes){const r2=fN(23);for(let i=0;i<p.eyes;i++){const v=.12+r2()*.6,sd=r2()<.5?-1:1,x=195+sd*(rw(v)+20+r2()*120)*(.9+v),y=ry(v)-(14+v*90),a=fClamp((t-i*.35)/1.1,0,1)*(Math.sin(t*1.3+i*2)>.93?0:1);fEyes(c,x,y,1.2+v*3.6,a);}}
  if(p.rider){const v=fClamp(u*1.15,.02,1.1);fRider(c,195+Math.sin(t*2)*6*v,ry(v)+4,.12+Math.pow(v,1.6)*1.5,t);if(v>.2){c.fillStyle='rgba(200,215,235,.18)';c.beginPath();c.ellipse(195,ry(v)+2,40*v+10,8*v+2,0,0,6.283);c.fill();}}
  fFog(c,t,(p.fog==null?.7:p.fog)*.5,520,840,6);fSnow(c,t,Math.round(120*(p.snow==null?.5:p.snow)),19,30);},
raven(c,t,u,p,X){if(p.close){c.fillStyle='#04060a';c.fillRect(0,0,FW,FH);const cx=195,cy=410;
    for(let i=0;i<70;i++){const a=i/70*6.283,l=150+((i*37)%90);c.strokeStyle='rgba(30,40,56,'+(.5+((i*13)%5)/10)+')';c.lineWidth=7+((i*7)%6);c.beginPath();c.moveTo(cx+Math.cos(a)*70,cy+Math.sin(a)*70);c.lineTo(cx+Math.cos(a+.1)*l,cy+Math.sin(a+.1)*l);c.stroke();}
    let g=c.createRadialGradient(cx-20,cy-20,10,cx,cy,125);g.addColorStop(0,'#2a3446');g.addColorStop(1,'#07090d');c.fillStyle=g;c.beginPath();c.arc(cx,cy,115,0,6.283);c.fill();
    c.save();c.globalCompositeOperation='lighter';fGlow(c,cx,cy,95,'#e24030',.55+.15*Math.sin(t*3));c.restore();c.fillStyle='#b8261e';c.beginPath();c.arc(cx,cy,48,0,6.283);c.fill();c.fillStyle='#050608';c.beginPath();c.arc(cx,cy,24,0,6.283);c.fill();
    c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(cx-17,cy-17,7,0,6.283);c.fill();c.fillStyle='rgba(255,255,255,.25)';c.beginPath();c.arc(cx+14,cy+16,4,0,6.283);c.fill();
    const bl=Math.max(0,Math.sin(t*1.1)-.9)*10;if(bl>0){c.fillStyle='rgba(8,12,18,'+Math.min(1,bl)+')';c.beginPath();c.arc(cx,cy,112,0,6.283);c.fill();}return;}
  fSky(c,'#050a16','#101a2c','#0a1426',.6);fStars(c,t,60,6,420,.75);fMoon(c,195,330,74,1);fFog(c,t,.35,260,520,2);
  const x=-70+u*(FW+140),y=340+Math.sin(u*6)*34-u*50,fl=Math.sin(t*10);c.save();c.translate(x,y);c.fillStyle=c.strokeStyle='#04070b';
  c.beginPath();c.ellipse(0,0,28,10,-.1,0,6.283);c.fill();c.beginPath();c.moveTo(24,-4);c.lineTo(46,-2);c.lineTo(24,3);c.closePath();c.fill();c.beginPath();c.arc(22,-3,7,0,6.283);c.fill();
  [-1,1].forEach(sd=>{c.save();c.rotate(-.1);c.beginPath();c.moveTo(-4,0);c.quadraticCurveTo(-14,-34*fl-6,-52,-26*fl+sd*0);c.quadraticCurveTo(-34,-6,-24,6);c.closePath();c.fill();c.restore();c.scale(1,-1);c.globalAlpha=.9;});c.globalAlpha=1;
  c.beginPath();c.moveTo(-26,2);c.lineTo(-50,8);c.lineTo(-44,0);c.closePath();c.fill();if(p.letter){c.rotate(Math.sin(t*5)*.15);c.fillStyle='#e8dfc4';c.fillRect(-4,10,14,8);c.strokeStyle='#8a2a22';c.lineWidth=1.6;c.beginPath();c.moveTo(3,10);c.lineTo(3,18);c.stroke();}c.restore();
  c.fillStyle='#ff4030';c.beginPath();c.arc(x+22+4,y-4,1.5,0,6.283);c.fill();},
gate(c,t,u,p,X){fSky(c,'#04101c','#0b1a28');fStars(c,t,50,13,250,.7);
  const kn=p.knock||0,kt=[];for(let i=0;i<kn;i++)kt.push((i+1)/(kn+1)*X.d);let sh=0;kt.forEach(k=>{const e=t-k;if(e>=0&&e<.45)sh=Math.max(sh,(1-e/.45)*(1-e/.45));});if(X.red)sh=0;
  c.fillStyle='#142230';c.fillRect(0,150,FW,FH-150);const g0=c.createLinearGradient(0,150,0,FH);g0.addColorStop(0,'rgba(120,160,190,.35)');g0.addColorStop(.5,'rgba(0,0,0,0)');g0.addColorStop(1,'rgba(0,0,0,.45)');c.fillStyle=g0;c.fillRect(0,150,FW,FH-150);
  const r=fN(41);for(let i=0;i<16;i++){c.strokeStyle='rgba(0,0,0,.26)';c.beginPath();c.moveTo(0,170+i*42);c.lineTo(FW,170+i*42);c.stroke();for(let j=0;j<6;j++){const x=((i%2)*34+j*68+r()*5);c.beginPath();c.moveTo(x,170+i*42);c.lineTo(x,212+i*42);c.stroke();}}
  const im=fImg(typeof GATE_ART!=='undefined'&&GATE_ART[1]);const gw=300,gh=gw*217/264,gx=195-gw/2,gy=690-gh;
  c.save();c.translate((Math.sin(t*80)*2.2)*sh,sh*5);if(im){c.drawImage(im,gx,gy,gw,gh);c.fillStyle='rgba(4,10,22,.45)';c.fillRect(gx,gy,gw,gh);}else{c.fillStyle='#1a1109';c.fillRect(gx,gy,gw,gh);}
  const cr=p.crack==null?.4:p.crack;if(cr>0){c.save();c.globalCompositeOperation='lighter';const lg=c.createLinearGradient(195-70,0,195+70,0);lg.addColorStop(0,'rgba(255,150,60,0)');lg.addColorStop(.5,'rgba(255,170,80,'+(.28*cr)+')');lg.addColorStop(1,'rgba(255,150,60,0)');c.fillStyle=lg;c.fillRect(195-70,gy+30,140,gh-30);c.restore();}c.restore();
  if((p.frost||0)>0){const fs=p.frost;for(let i=0;i<6;i++)fFrost(c,gx+10+i*50,gy+gh-2,14+fs*34,60+i,.4*fs,-Math.PI/2+(i%2?.35:-.35));}
  fTorch(c,60,470,t,1.3);fTorch(c,330,470,t+1.3,1.3);
  kt.forEach(k=>{const e=t-k;if(e>=0&&e<1.2){c.fillStyle='rgba(190,175,150,'+(.55*(1-e/1.2))+')';for(let i=0;i<14;i++){const px=gx+20+i*19+Math.sin(i*5)*6;c.fillRect(px,gy-6+e*(60+i*5),1.6,1.6+i%3);}}});
  fFog(c,t,.28,600,840,8);fSnow(c,t,40,15,10);fVig(c,.5);},
door(c,t,u,p,X){const th=p.thuds||0,kt=[];for(let i=0;i<th;i++)kt.push((i+1)/(th+1)*X.d);let sh=0;kt.forEach(k=>{const e=t-k;if(e>=0&&e<.5)sh=Math.max(sh,(1-e/.5)*(1-e/.5));});if(X.red)sh=0;
  c.save();c.translate((Math.sin(t*90)*3)*sh,Math.cos(t*70)*2*sh);const g=c.createLinearGradient(0,0,FW,0);g.addColorStop(0,'#1a0f08');g.addColorStop(.5,'#2a1a0e');g.addColorStop(1,'#140b06');c.fillStyle=g;c.fillRect(-10,-10,FW+20,FH+20);
  const lt=p.light==null?.35:p.light;for(let i=0;i<7;i++){const x=i*58;c.fillStyle=i%2?'#241509':'#2d1b0d';c.fillRect(x+2,0,54,FH);const r=fN(70+i);c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=1;for(let k=0;k<7;k++){c.beginPath();c.moveTo(x+6+r()*40,0);c.bezierCurveTo(x+r()*54,250,x+r()*54,520,x+6+r()*40,FH);c.stroke();}
    const sl=c.createLinearGradient(x-3,0,x+3,0);sl.addColorStop(0,'rgba(255,190,110,0)');sl.addColorStop(.5,'rgba(255,200,130,'+(lt*(.6+.4*Math.sin(t*3+i)))+')');sl.addColorStop(1,'rgba(255,190,110,0)');c.fillStyle=sl;c.fillRect(x-3,0,6,FH);}
  [200,610].forEach(y=>{c.fillStyle='#2b2f37';c.fillRect(-10,y,FW+20,44);c.fillStyle='rgba(255,255,255,.1)';c.fillRect(-10,y,FW+20,4);c.fillStyle='#4a5160';for(let i=0;i<9;i++){c.beginPath();c.arc(14+i*46,y+22,5,0,6.283);c.fill();}});
  c.restore();if((p.frost||0)>0){const f=p.frost;[[0,0,.8],[FW,0,2.3],[0,FH,-.8],[FW,FH,-2.3]].forEach(([x,y,a],i)=>fFrost(c,x,y,34+f*70,80+i,.5*Math.min(1,f*1.3),a));}
  kt.forEach(k=>{const e=t-k;if(e>=0&&e<1.4){c.fillStyle='rgba(200,185,160,'+(.6*(1-e/1.4))+')';for(let i=0;i<30;i++){c.fillRect((i*47)%FW,((i*29)%200)+e*(70+i*5),1.8,2.4);}}});fVig(c,.5);},
hodor(c,t,u,p,X){c.fillStyle='#050403';c.fillRect(0,0,FW,FH);c.save();c.globalCompositeOperation='lighter';fGlow(c,30,330,430,'#ff8a2a',.3+.05*Math.sin(t*13));c.restore();
  const im=fImg(typeof GATE_ART!=='undefined'&&GATE_ART[1]);const gw=388,gh=gw*217/264,gx=195-gw/2,gy=420-gh/2;
  if(im){c.imageSmoothingQuality='high';c.drawImage(im,gx,gy,gw,gh);const sh=c.createLinearGradient(0,gy,0,gy+gh);sh.addColorStop(0,'rgba(3,3,6,.62)');sh.addColorStop(.5,'rgba(3,3,6,.28)');sh.addColorStop(1,'rgba(3,3,6,.7)');c.fillStyle=sh;c.fillRect(gx,gy,gw,gh);const sd=c.createLinearGradient(gx,0,gx+gw,0);sd.addColorStop(0,'rgba(255,150,60,.16)');sd.addColorStop(.6,'rgba(0,0,0,0)');sd.addColorStop(1,'rgba(0,0,10,.5)');c.fillStyle=sd;c.fillRect(gx,gy,gw,gh);}
  else{c.font='80px serif';c.textAlign='center';c.fillStyle='#8a6a52';c.fillText('🧔',195,440);}
  if(p.sweat){const k=gw/264,hx=gx+132*k,hy=gy+44*k;c.fillStyle='rgba(255,235,205,.75)';[[-16,-6],[18,-2],[2,-16]].forEach(([dx,dy],i)=>{const d=((t*10+i*22)%34);c.beginPath();c.ellipse(hx+dx*k*.55,hy+dy*k*.5+d,1.6,2.8,0,0,6.283);c.fill();});}
  fFog(c,t,.18,560,820,6);fVig(c,.62);},
champion(c,t,u,p,X){const hh=fHouse(X);c.fillStyle='#04070c';c.fillRect(0,0,FW,FH);const rim=fNum(p.rim,.6);
  c.save();c.globalCompositeOperation='lighter';fGlow(c,195,380,380,hh.col,.5*rim);c.restore();
  const ch=X.champ,im=ch&&fImg(CHAMP_ART[ch.id+'_portrait']);
  if(im){const k=Math.max(FW/im.naturalWidth,600/im.naturalHeight)*1.04,w=im.naturalWidth*k,h=im.naturalHeight*k,x=195-w/2,y=110;c.save();c.beginPath();c.rect(0,100,FW,640);c.clip();c.drawImage(im,x,y,w,h);const sh=c.createLinearGradient(0,100,0,740);sh.addColorStop(0,'rgba(2,4,8,1)');sh.addColorStop(.18,'rgba(2,4,8,.15)');sh.addColorStop(.7,'rgba(2,4,8,.1)');sh.addColorStop(1,'rgba(2,4,8,1)');c.fillStyle=sh;c.fillRect(0,100,FW,640);c.restore();}
  else{c.font='120px serif';c.textAlign='center';c.fillStyle=hh.col;c.fillText(ch?ch.e:'🛡️',195,430);}
  if(p.eyes){const a=Math.max(0,Math.sin(t*1.3-1));c.save();c.globalCompositeOperation='lighter';[-34,34].forEach(dx=>{fGlow(c,195+dx,370,50,'#ffffff',.6*a);c.strokeStyle='rgba(255,255,255,'+(.8*a)+')';c.lineWidth=1.4;c.beginPath();c.moveTo(195+dx-20,370);c.lineTo(195+dx+20,370);c.moveTo(195+dx,350);c.lineTo(195+dx,390);c.stroke();});c.restore();}
  if(p.breath){const r=fN(3);c.fillStyle='rgba(220,235,255,.12)';for(let i=0;i<8;i++){const ph=((t*.5+i*.125)%1),x=195+(r()-.5)*60+Math.sin(ph*5)*14,y=560-ph*180;c.beginPath();c.arc(x,y,12+ph*34,0,6.283);c.fill();}}
  fFog(c,t,.12,500,760,9);fVig(c,.55);},
host(c,t,u,p,X){fSky(c,'#03080f','#0d1a28','#08121e',.5);fStars(c,t,45,22,300,.55);const adv=p.advance||0,n=Math.round(p.count||40);
  const ridge=x=>420+Math.sin(x*.015)*18+Math.sin(x*.05)*6;c.fillStyle='#040a12';c.beginPath();c.moveTo(0,FH);for(let x=0;x<=FW+5;x+=5)c.lineTo(x,ridge(x)-20);c.lineTo(FW,FH);c.closePath();c.fill();
  const rows=4,per=Math.ceil(n/rows),r=fN(55);
  for(let row=0;row<rows;row++){const depth=row/(rows-1);for(let i=0;i<per;i++){const x=r()*FW,y=ridge(x)+row*52+adv*depth*90+r()*14,s=.4+depth*.5+adv*.5*depth,ph=t*2+i;fWight(c,x,y,s,ph,'#05090f');const a=.45+.45*Math.sin(t*1.6+i*1.7);fEyes(c,x,y-54*s,1.1*s+.6,a);}
    fFog(c,t,.2,ridge(100)+row*50-20,ridge(100)+row*50+40,30+row);}
  if(p.king){const ky=ridge(195)-4+adv*20;fKingSil(c,195,ky,.8+adv*.4,t);fEyes(c,195,ky-104*(.8+adv*.4),2.6,.6+.4*Math.sin(t*3),'#a8e8ff');}
  fSnow(c,t,70,24,20);fVig(c,.5);},
beacons(c,t,u,p,X){fSky(c,'#030812','#0c1a2a');fStars(c,t,70,27,380,.8);const n=p.n||5;
  const layers=[['#14283c',330,.012],['#0c1a2a',420,.02],['#060d17',520,.03]];layers.forEach(([col,base,fq],L)=>{c.fillStyle=col;c.beginPath();c.moveTo(0,FH);for(let x=0;x<=FW+5;x+=5)c.lineTo(x,base-Math.abs(Math.sin(x*fq*1.4+L))*90-Math.sin(x*fq*3)*20);c.lineTo(FW,FH);c.closePath();c.fill();});
  for(let i=0;i<n;i++){const L=i%3,x=n===1?195:30+i*(330/Math.max(1,n-1)),fq=layers[L][2],y=layers[L][1]-Math.abs(Math.sin(x*fq*1.4+L))*90-Math.sin(x*fq*3)*20,on=t>i*.5+.2;if(on){const k=fClamp((t-i*.5-.2)/.35,0,1);c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y-8,(50+50*(1-k))*(1.2-L*.15),'#ff8a2a',.18*k);c.restore();fTorch(c,x,y-4,t+i,.9+(1-L*.2)*.6,.3);}}
  fFog(c,t,.2,560,840,5);fVig(c,.4);},
map(c,t,u,p,X){const fr=p.frost||0;const g=c.createRadialGradient(195,420,60,195,420,520);g.addColorStop(0,'#d6b983');g.addColorStop(.7,'#b08f55');g.addColorStop(1,'#4a3318');c.fillStyle=g;c.fillRect(0,0,FW,FH);
  const r=fN(91);for(let i=0;i<40;i++){c.fillStyle='rgba(80,50,20,'+(.03+r()*.05)+')';c.beginPath();c.arc(r()*FW,r()*FH,10+r()*50,0,6.283);c.fill();}c.strokeStyle='rgba(60,35,15,.3)';c.lineWidth=1.5;c.beginPath();c.moveTo(0,FH*.5);c.lineTo(FW,FH*.5+8);c.moveTo(FW*.5,0);c.lineTo(FW*.5+6,FH);c.stroke();
  const pts=[[170,790],[240,730],[150,660],[250,590],[140,520],[240,450],[160,380],[235,310],[170,240],[215,170],[195,110]];const at=f=>{const s=f*(pts.length-1),i=Math.min(pts.length-2,Math.floor(s)),k=s-i;return[fLerp(pts[i][0],pts[i+1][0],k),fLerp(pts[i][1],pts[i+1][1],k)];};
  c.strokeStyle='#4a2410';c.lineWidth=3;c.setLineDash([9,7]);c.beginPath();pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.stroke();c.setLineDash([]);
  c.fillStyle='#3a1c0c';c.font='italic 13px "EB Garamond",serif';c.textAlign='left';['Sunspear','Salt Shore','Yronwood','The Boneway',"Prince's Pass"].forEach((nm,i)=>{const q=pts[i*2];c.beginPath();c.arc(q[0],q[1],4,0,6.283);c.fill();c.fillText(nm,q[0]+10,q[1]+4);});
  c.strokeStyle='#2a1408';c.lineWidth=5;c.beginPath();for(let x=20;x<=370;x+=14){x>20?c.lineTo(x,72+(x/14%2)*9):c.moveTo(x,72);}c.stroke();c.font='700 12px Cinzel,serif';c.textAlign='center';c.fillText('THE WALL',195,52);
  if(p.mark){const q=at(fClamp((p.mark-1)/49*1.0,0,1)*1);const pu=.6+.4*Math.sin(t*4);c.save();c.globalCompositeOperation='lighter';fGlow(c,q[0],q[1],42,'#ffd060',.7*pu);c.restore();c.fillStyle='#ffe08a';c.beginPath();c.arc(q[0],q[1],6,0,6.283);c.fill();}
  if(fr>0){const yf=40+fr*760,rr=fN(97);c.beginPath();c.moveTo(0,0);c.lineTo(FW,0);for(let x=FW;x>=0;x-=10)c.lineTo(x,yf+Math.sin(x*.09)*18+Math.sin(x*.23+t)*8+rr()*10);c.closePath();const fg=c.createLinearGradient(0,Math.max(0,yf-200),0,yf+30);fg.addColorStop(0,'rgba(210,234,255,.82)');fg.addColorStop(.75,'rgba(180,215,245,.6)');fg.addColorStop(1,'rgba(170,205,240,.1)');c.fillStyle=fg;c.fill();
    for(let i=0;i<22;i++){fFrost(c,10+i*18,yf+Math.sin(i*1.7)*14,16+rr()*22,200+i,.55,Math.PI/2+(rr()-.5)*.8);}}
  fVig(c,.62);},
hall(c,t,u,p,X){const hh=fHouse(X);fSky(c,'#06080e','#120c0a');const vx=195,vy=360;
  c.fillStyle='#0b0907';c.fillRect(0,0,FW,FH);const wg=c.createRadialGradient(vx,vy,10,vx,vy,150);wg.addColorStop(0,'rgba(120,150,200,.65)');wg.addColorStop(1,'rgba(40,55,90,0)');c.fillStyle=wg;c.fillRect(vx-150,vy-190,300,380);c.fillStyle='#02040a';c.beginPath();c.moveTo(vx-34,vy+60);c.lineTo(vx-34,vy-40);c.arc(vx,vy-40,34,Math.PI,0);c.lineTo(vx+34,vy+60);c.closePath();c.fill();
  c.fillStyle='rgba(150,180,230,.55)';c.beginPath();c.moveTo(vx-26,vy+56);c.lineTo(vx-26,vy-38);c.arc(vx,vy-38,26,Math.PI,0);c.lineTo(vx+26,vy+56);c.closePath();c.fill();
  if(p.figure){c.fillStyle='#02040a';c.beginPath();c.moveTo(vx-9,vy+56);c.lineTo(vx-7,vy-8);c.arc(vx,vy-14,8,Math.PI*.9,Math.PI*.1,true);c.lineTo(vx+9,vy+56);c.closePath();c.fill();}
  const fl=.85+.15*Math.sin(t*13)+.05*Math.sin(t*29);c.fillStyle='#14100d';c.beginPath();c.moveTo(0,FH);c.lineTo(vx-38,vy+60);c.lineTo(vx+38,vy+60);c.lineTo(FW,FH);c.closePath();c.fill();
  [[1,-1],[2,1],[3,-1],[4,1]].forEach(([d,sd])=>{const k=1/(1+d*.9),x=vx+sd*(250*k+30),h=700*k+60;c.fillStyle='#17110d';c.fillRect(x-22*k-6,vy-h*.55,44*k+12,h);if(d%2===1){const bw=26*k+14,top=vy-h*.45;c.fillStyle=hh.col2;c.beginPath();c.moveTo(x-bw/2,top);c.lineTo(x+bw/2,top);c.lineTo(x+bw/2,top+h*.46);c.lineTo(x,top+h*.46-bw*.5);c.lineTo(x-bw/2,top+h*.46);c.closePath();c.fill();c.strokeStyle=hh.col;c.lineWidth=2;c.stroke();}});
  c.save();c.globalCompositeOperation='lighter';fGlow(c,30,600,380*fl,'#ff7a2a',.4);fGlow(c,vx,vy+200,180,'#ff9a3c',.1*fl);c.restore();
  if(p.crest){const im=fImg(SIGILS[X.house]);if(im){c.save();c.globalAlpha=.9;c.drawImage(im,vx-45,vy-210,90,166);c.restore();}}
  const em=p.embers==null?.5:p.embers,r=fN(61);c.fillStyle='#ffb23c';for(let i=0;i<Math.round(36*em);i++){const ph=((t*.25+r())%1),x=20+r()*120+Math.sin(t+i)*14,y=620-ph*500;c.globalAlpha=(1-ph)*.9;c.fillRect(x,y,1.8,1.8);}c.globalAlpha=1;fFog(c,t,.12,600,840,12);fVig(c,.55);},
dawn(c,t,u,p,X){const s=p.sun==null?.4:p.sun;const g=c.createLinearGradient(0,0,0,FH);g.addColorStop(0,'#0a1230');g.addColorStop(.45,'rgb('+Math.round(fLerp(26,200,s))+','+Math.round(fLerp(34,110,s))+','+Math.round(fLerp(70,90,s))+')');g.addColorStop(.7,'rgb('+Math.round(fLerp(60,255,s))+','+Math.round(fLerp(60,170,s))+','+Math.round(fLerp(80,100,s))+')');g.addColorStop(1,'#1a1010');c.fillStyle=g;c.fillRect(0,0,FW,FH);
  fStars(c,t,40,28,200,.6*(1-s));const sy=560-s*110;c.save();c.globalCompositeOperation='lighter';fGlow(c,195,sy,260,'#ffb060',.6*s+.1);c.restore();c.fillStyle='rgba(255,236,190,'+(.4+.6*s)+')';c.beginPath();c.arc(195,sy,34,0,6.283);c.fill();
  c.fillStyle='#0b0808';c.beginPath();c.moveTo(0,FH);for(let x=0;x<=FW+5;x+=5)c.lineTo(x,600+Math.sin(x*.02)*20+Math.sin(x*.07)*6);c.lineTo(FW,FH);c.closePath();c.fill();
  c.fillStyle='#070505';c.fillRect(150,560,90,200);c.beginPath();c.arc(195,560,45,Math.PI,0);c.fill();c.fillRect(120,590,18,170);c.fillRect(252,590,18,170);
  const sm=p.smoke||0;if(sm>0){fSprites();for(let i=0;i<7;i++){const x=40+i*52,ph=((t*.12+i*.17)%1);c.globalAlpha=sm*.3*(1-ph);c.drawImage(FOGS,x-60,620-ph*300,120+ph*80,90+ph*40);}c.globalAlpha=1;}
  fFog(c,t,.2,640,820,4);fVig(c,.35);},
king(c,t,u,p,X){const w=fNum(p.wind,.5);fSky(c,'#04070e','#0e1822','#0a1220',.5);fFog(c,t,.5,100,420,15);fStars(c,t,30,33,200,.4);
  c.fillStyle='#04080d';c.beginPath();c.moveTo(0,FH);c.lineTo(0,560);c.quadraticCurveTo(195,440,FW,560);c.lineTo(FW,FH);c.closePath();c.fill();
  const e=fNum(p.eyes,0);fKingSil(c,195,500,1.5,t);if(e>0){fEyes(c,195,500-104*1.5,3.4,e,'#9fe6ff');c.save();c.globalCompositeOperation='lighter';fGlow(c,195,500-104*1.5,160,'#6fd0ff',.35*e);c.restore();}
  c.strokeStyle='rgba(225,240,255,'+(.3*w)+')';c.lineWidth=1.2;const r=fN(44);for(let i=0;i<Math.round(60*w);i++){const x=((r()*FW*1.4-t*(140+r()*160))%(FW*1.4)+FW*1.4)%(FW*1.4)-30,y=r()*FH;c.beginPath();c.moveTo(x,y);c.lineTo(x+22+r()*20,y+2);c.stroke();}fVig(c,.6);},
crest(c,t,u,p,X){const hh=fHouse(X),gl=fNum(p.glow,.7);c.fillStyle='#03050a';c.fillRect(0,0,FW,FH);c.save();c.globalCompositeOperation='lighter';fGlow(c,195,400,300+20*Math.sin(t*2),hh.col,.4*gl);c.restore();
  const im=fImg(SIGILS[X.house]);if(im){const k=1+.02*Math.sin(t*2);c.save();c.translate(195,410);c.scale(k,k);c.drawImage(im,-90,-166,180,332);c.restore();}else{c.font='140px serif';c.textAlign='center';c.fillStyle=hh.col;c.fillText(hh.e,195,450);}
  const r=fN(8);c.fillStyle=hh.col;for(let i=0;i<18;i++){const ph=((t*.2+r())%1),x=60+r()*270,y=700-ph*520;c.globalAlpha=(1-ph)*.7*gl;c.fillRect(x,y,2,2);}c.globalAlpha=1;fVig(c,.5);},
title(c,t,u,p,X){c.fillStyle='#02040a';c.fillRect(0,0,FW,FH);const k=fClamp(t/1.2,0,1);c.save();c.textAlign='center';c.globalAlpha=k;
  const txt=String(p.text||'');let fs=46;c.font='900 46px Cinzel,serif';while(fs>18&&c.measureText(txt).width>330){fs-=2;c.font='900 '+fs+'px Cinzel,serif';}const gr=c.createLinearGradient(0,380,0,440);gr.addColorStop(0,'#fff3c8');gr.addColorStop(1,'#d8a84a');c.fillStyle=gr;c.shadowColor='rgba(255,200,90,.55)';c.shadowBlur=24;c.fillText(txt,195,420);c.shadowBlur=0;
  if(p.sub){c.font='italic 16px "EB Garamond",serif';c.fillStyle='#9fb6c9';c.fillText(String(p.sub),195,462);}c.restore();
  const cr=p.crack||0;if(cr>0){const r=fN(77);c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(190,230,255,'+(.55*cr)+')';c.lineWidth=1.2;c.shadowColor='#6fc8ff';c.shadowBlur=8;for(let i=0;i<4;i++){let x=195+(r()-.5)*160,y=410+(r()-.5)*30,an=(i<2?Math.PI*(i?.15:.85):r()*6.283);c.beginPath();c.moveTo(x,y);const n=Math.round(9*cr)+2;for(let j=0;j<n;j++){an+=(r()-.5)*1.3;x+=Math.cos(an)*(9+r()*10);y+=Math.sin(an)*(9+r()*10);c.lineTo(x,y);}c.stroke();}c.restore();}fVig(c,.5);},
};
/* ---------- the player ---------- */
function fTok(s){const hh=HOUSES[ACC&&ACC.house]||HOUSES.stark,ch=ACC&&CBY[ACC.sel];return String(s).replace(/\{HOUSE\}/g,hh.n).replace(/\{SEAT\}/g,hh.seat).replace(/\{CHAMP\}/g,ch?String(ch.n).split(' ')[0]:'the champion').replace(/\{WORDS\}/g,hh.words);}
function fCtx(d){return{house:(ACC&&ACC.house)||'stark',champ:ACC&&CBY[ACC.sel],d:d||5,red:!!(FIL?FIL.red:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)};}
function filmFit(){if(!FIL)return;const r=$('#app').getBoundingClientRect(),dp=Math.min(FIL.dpMax||2,window.devicePixelRatio||1);FIL.w=Math.max(1,r.width);FIL.h=Math.max(1,r.height);FIL.dp=dp;FIL.cv.width=Math.round(FIL.w*dp);FIL.cv.height=Math.round(FIL.h*dp);FIL.k=Math.max(FIL.w/FW,FIL.h/FH);}
function filmStill(cv,scene,t,p,u,d){const c=cv.getContext('2d'),k=Math.max(cv.width/FW,cv.height/FH);fSprites();c.setTransform(k,0,0,k,(cv.width-FW*k)/2,(cv.height-FH*k)/2);c.save();c.beginPath();c.rect(0,0,FW,FH);c.clip();(FSC[scene]||FSC.black)(c,t||0,u==null?.5:u,p||{},fCtx(d));c.restore();}
function filmSfx(k){if(k==='silence'){SFX.amb(null);return;}SFX.play(k==='horn'?'horn':'f_'+k);}
function filmShotStart(){const F=FIL.F,s=F.shots[FIL.si];FIL.ts=0;FIL.sfx=(s.sfx||[]).slice().sort((a,b)=>a.at-b.at);FIL.sfxI=0;FIL.fl=(s.flash||[]).slice().sort((a,b)=>a-b);FIL.flI=0;FIL.sh=(s.shake||[]).slice().sort((a,b)=>a.at-b.at);FIL.shI=0;FIL.cp=(s.cap||[]).slice().sort((a,b)=>a.at-b.at);FIL.cpI=0;FIL.fade=s.cut==='fade'||FIL.si===0?.55:0;FIL.X=fCtx(s.d);}
function filmCap(cap){const box=FIL.el.querySelector('.fcaps'),e=document.createElement('div');e.className='fc k-'+cap.kind;if(cap.who){const b=document.createElement('b');b.textContent=fTok(cap.who==='Champion'?'{CHAMP}':cap.who);e.appendChild(b);}const sp=document.createElement('span');e.appendChild(sp);box.appendChild(e);
  const full=fTok(cap.text);FIL.caps.push({e,sp,full,t0:FIL.t,hold:Math.max(1.4,cap.hold||2),kind:cap.kind,done:false});}
function filmLoop(now){if(!FIL)return;try{filmFrame(now);}catch(e){if(window.__sfxdebug)console.error(e);filmEnd(true);}}
function filmFrame(now){const dt=Math.min(.1,(now-FIL.last)/1000);FIL.last=now;FIL.t+=dt;FIL.ts+=dt;const F=FIL.F;if(FIL.t>FIL.total+12){filmEnd(true);return;}
  if(FIL.si<0||FIL.ts>=F.shots[FIL.si].d){if(FIL.si>=F.shots.length-1){if(!FIL.out){FIL.out=FIL.t;}if(FIL.t-FIL.out>.6){filmEnd(false);return;}}else{FIL.si++;filmShotStart();}}
  const s=F.shots[Math.max(0,FIL.si)],ts=FIL.ts,u=fClamp(ts/s.d,0,1);
  while(FIL.sfxI<FIL.sfx.length&&FIL.sfx[FIL.sfxI].at<=ts){filmSfx(FIL.sfx[FIL.sfxI].k);FIL.sfxI++;}
  while(FIL.flI<FIL.fl.length&&FIL.fl[FIL.flI]<=ts){if(!FIL.red)FIL.flash=.5;FIL.flI++;}
  while(FIL.shI<FIL.sh.length&&FIL.sh[FIL.shI].at<=ts){if(!FIL.red)FIL.shk={a:FIL.sh[FIL.shI].amp,t0:ts,d:Math.max(.15,FIL.sh[FIL.shI].dur)};FIL.shI++;}
  while(FIL.cpI<FIL.cp.length&&FIL.cp[FIL.cpI].at<=ts){filmCap(FIL.cp[FIL.cpI]);FIL.cpI++;}
  /* captions: type, hold, fade */
  FIL.caps.forEach(q=>{const a=FIL.t-q.t0,typ=q.kind==='whisper'||q.kind==='shout'?.5:Math.min(1.3,q.full.length*.035),n=Math.min(q.full.length,Math.floor(q.full.length*fClamp(a/typ,0,1)));if(q.n!==n){q.sp.textContent=q.full.slice(0,n);q.n=n;}if(!q.done&&a>q.hold+typ*.5){q.done=true;q.e.classList.add('out');setTimeout(()=>q.e.remove(),500);}});FIL.caps=FIL.caps.filter(q=>q.e.isConnected);
  /* draw */
  const c=FIL.c,dp=FIL.dp,k=FIL.k,ox=(FIL.w-FW*k)/2,oy=(FIL.h-FH*k)/2;c.setTransform(1,0,0,1,0,0);c.fillStyle='#000';c.fillRect(0,0,FIL.cv.width,FIL.cv.height);
  c.setTransform(dp*k,0,0,dp*k,dp*ox,dp*oy);c.save();c.beginPath();c.rect(0,0,FW,FH);c.clip();
  const cam=s.cam||{},z=fLerp(cam.from==null?1:cam.from,cam.to==null?(cam.from==null?1:cam.from):cam.to,u);let shx=0,shy=0;if(FIL.shk){const e=ts-FIL.shk.t0;if(e<FIL.shk.d){const am=FIL.shk.a*(1-e/FIL.shk.d);shx=(Math.random()-.5)*2*am;shy=(Math.random()-.5)*2*am;}else FIL.shk=null;}
  c.translate(FW/2+shx,FH/2+shy);c.scale(z,z);c.translate(-FW/2+(cam.dx||0)*u,-FH/2+(cam.dy||0)*u);
  try{(FSC[s.scene]||FSC.black)(c,ts,u,s.p||{},FIL.X);}catch(e){c.fillStyle='#02040a';c.fillRect(0,0,FW,FH);}
  c.restore();c.setTransform(dp*k,0,0,dp*k,dp*ox,dp*oy);
  fSprites();c.globalAlpha=.07;c.drawImage(FGRAIN,-Math.random()*128,-Math.random()*128,FW+256,FH+256);c.globalAlpha=1;
  if(FIL.flash>0){c.fillStyle='rgba(225,240,255,'+FIL.flash+')';c.fillRect(0,0,FW,FH);FIL.flash=Math.max(0,FIL.flash-dt*3.2);}
  const fa=FIL.fade?1-fClamp(ts/FIL.fade,0,1):0,fo=FIL.out?fClamp((FIL.t-FIL.out)/.6,0,1):0,bl=Math.max(fa,fo);if(bl>0){c.fillStyle='rgba(0,0,0,'+bl+')';c.fillRect(0,0,FW,FH);}
  FIL.avg=(FIL.avg||.016)*.92+dt*.08;if(!FIL.dpMax&&FIL.t>1.5&&FIL.avg>.042&&FIL.dp>1){FIL.dpMax=1;filmFit();}
  FIL.raf=requestAnimationFrame(filmLoop);}
function filmEnd(skipped){if(!FIL)return;const f=FIL;FIL=null;cancelAnimationFrame(f.raf);f.el.remove();FILM.on=false;SFX.amb(null);const d=f.done;if(d)d(!!skipped);}
function filmPlay(id,done,o){const F=typeof id==='string'?FILMS[id]:id;if(!F||!F.shots||!F.shots.length){if(done)done(false);return;}
  if(navigator.webdriver&&!window.__films){if(done)setTimeout(()=>done(true),0);return;}   /* automated tests skip films unless they set window.__films */
  if(FIL)filmEnd(true);fSprites();FILM.on=true;
  const el=document.createElement('div');el.className='film';el.innerHTML='<canvas></canvas><div class="fbar t"></div><div class="fbar b"></div><div class="fcaps"></div><button class="fskip" id="filmSkip">Skip ▶</button>';$('#app').appendChild(el);
  FIL={F,el,cv:el.querySelector('canvas'),c:null,si:-1,t:0,ts:0,caps:[],last:performance.now(),done,out:0,flash:0,shk:null,red:!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches),sfx:[],fl:[],sh:[],cp:[],X:fCtx(5)};
  FIL.c=FIL.cv.getContext('2d');FIL.total=F.shots.reduce((a,x)=>a+x.d,0);   /* a film can never hold the game: film time + 12 s ends it */
  filmFit();SFX.amb('wind');el.querySelector('#filmSkip').addEventListener('click',ev=>{ev.stopPropagation();filmEnd(true);});
  filmWarm();FIL.last=performance.now()+150;FIL.raf=requestAnimationFrame(filmLoop);}
window.addEventListener('resize',()=>{if(FIL)filmFit();});
/* a chapter card: a title, a few seconds */
function filmCard(text,sub,done){filmPlay({id:'card',shots:[{scene:'title',d:2.8,p:{text,sub,crack:.4},cap:[],sfx:[{at:.1,k:'cold'}]}]},done);}
