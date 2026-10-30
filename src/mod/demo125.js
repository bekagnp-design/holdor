/* =========================== DEMOS FOR SPELLS, TOWERS AND CHAMPIONS (v1.2.5) ===========================
   The same small looping canvas as the skill demos (skilldemo.js), now for every spell, every tower and every champion: what it does,
   happening to three of the dead. A champion's picture plays its three skills one after another with the name under it.
   <canvas class="dmv" data-dk="spell|tower|champ" data-di="id"> is started by demoMount(root); a loop stops when its canvas leaves the page. */
const DMS={};
function dmBg(c){const g=c.createLinearGradient(0,0,0,SDH);g.addColorStop(0,'#0a1424');g.addColorStop(1,'#1a2433');c.fillStyle=g;c.fillRect(0,0,SDW,SDH);
  c.fillStyle='#121b27';c.fillRect(0,142,SDW,SDH-142);c.strokeStyle='rgba(255,255,255,.07)';c.beginPath();c.moveTo(0,142);c.lineTo(SDW,142);c.stroke();}
function dmWights(c,t,P,o){o=o||{};const ph=t%P,out=[];for(let i=0;i<3;i++){const from=o.from||300,to=o.to||(200-i*0),sl=o.slowFrom!=null&&ph>o.slowFrom;
    const k=Math.min(1,ph/(o.walk||1.4)),x=from-i*30-(from-(o.stop||190))*k*(sl?.8:1)+(sl?(ph-o.slowFrom)*0:0),y=140+(i%2)*4;
    c.save();if(o.flash&&ph>o.flash&&ph<o.flash+.3)c.globalAlpha=.55+.45*Math.sin(ph*70);fWight(c,x,y,.78,t*3+i,o.tint||'#06090e');c.restore();fEyes(c,x,y-41,1.3,.9);out.push({x,y});}return out;}
function dmTower(c,x,y,col,h,ph){c.save();c.translate(x,y);c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(0,2,22,6,0,0,6.283);c.fill();
  c.fillStyle='#3a4658';c.fillRect(-16,-h,32,h);c.fillStyle='#4c5a70';c.fillRect(-16,-h,13,h);c.fillStyle=col;c.fillRect(-20,-h-8,40,9);c.fillStyle='#202a38';c.fillRect(-6,-h*0.55,12,h*0.55);c.restore();}
function dmLine(c,x1,y1,x2,y2,col,w){c.strokeStyle=col;c.lineWidth=w||2;c.lineCap='round';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function dmSpell(c,id,t){const P=3.2,ph=t%P;dmBg(c);
  if(id==='arrows'){const E=dmWights(c,t,P,{stop:200,walk:1.2});c.fillStyle='#2a1f1a';c.fillRect(0,40,34,102);c.fillStyle='#3a2c24';c.fillRect(0,34,40,10);
    for(let i=0;i<14;i++){const st=1+i*.07,k=(ph-st)/.4;if(k>0&&k<1){const x=190+(i%7)*14,y=-10+(120+(i%3)*6)*k;dmLine(c,x-4,y-16,x,y,'#ffe08a',2);}if(k>=1&&k<1.5)sdNum(c,200+(i%3)*30,100-(k-1)*20,'30',1.5-k,'#ffe08a');}}
  else if(id==='fire'){const E=dmWights(c,t,P,{stop:210,walk:1.2,flash:1.6});if(ph>1.3){const k=Math.min(1,(ph-1.3)/.5),r=70*k;c.save();c.globalCompositeOperation='lighter';fGlow(c,215,120,r*1.2,'#ff7a1c',.7*(1-Math.max(0,ph-2.3)/.9));fGlow(c,215,110,r*.6,'#ffe08a',.8*(1-Math.max(0,ph-2.3)/.9));c.restore();
      for(let i=0;i<8;i++){const a=i*0.8+ph*3,rr=r*.6;c.fillStyle='rgba(255,'+(120+i*12)+',40,'+(1-k*.4)+')';c.beginPath();c.arc(215+Math.cos(a)*rr*.7,118-Math.abs(Math.sin(a))*rr*.8,5,0,6.283);c.fill();}
      if(ph>1.6&&ph<2.6)E.forEach(e=>sdNum(c,e.x,e.y-52-(ph-1.6)*16,'170',1-(ph-1.6),'#ffb23c'));}else{c.save();c.globalCompositeOperation='lighter';fGlow(c,215,Math.max(0,(ph-.6)*180),12,'#ffb23c',.9);c.restore();}}
  else if(id==='reinf'){dmWights(c,t,P,{stop:215,walk:1.4});const k=fClamp((ph-.8)/.5,0,1);if(k>0)[[100,142],[130,144],[160,142]].forEach(([x,y],i)=>{c.save();c.globalAlpha=k;c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y-20,30*(1-k*.4),'#ffffff',.4*(1-k));c.restore();sdFig(c,x+Math.max(0,ph-1.3)*14*(i+1)/2,y,.95*(.5+.5*k),'#8a97a8',ph*10+i);c.restore();});if(ph>.9&&ph<2)sdNum(c,130,70-(ph-.9)*10,'REINFORCE',1-(ph-.9)/1.1,'#cfe6ff');}
  else if(id==='night'){const sl=ph>.9;dmWights(c,t,P,{stop:200,walk:sl?3.2:1.4,slowFrom:sl?0:null,tint:'#0a1626'});
    if(ph>.5){c.save();c.globalAlpha=Math.min(.35,(ph-.5)*.5);c.fillStyle='#7fb8ff';c.fillRect(0,0,SDW,SDH);c.restore();for(let i=0;i<26;i++){const x=(i*37+ph*30)%SDW,y=((i*53+ph*60)%SDH);c.fillStyle='rgba(220,240,255,.8)';c.fillRect(x,y,2,2);}
      sdNum(c,160,60,'LONG NIGHT  −40%',Math.min(1,(ph-.5)*2),'#bfe6ff');}}
  else if(id==='repair'){c.fillStyle='#2a1f1a';c.fillRect(8,84,38,58);c.beginPath();c.arc(27,84,19,Math.PI,0);c.fill();c.fillStyle='#14100d';c.fillRect(16,98,22,44);const hp=Math.min(1,.35+Math.max(0,ph-1)/1.2*.3);
    c.fillStyle='rgba(0,0,0,.6)';c.fillRect(8,72,38,7);c.fillStyle=hp>.6?'#7fd06a':'#e3b661';c.fillRect(9,73,36*hp,5);dmWights(c,t,P,{stop:130,walk:3,from:260});
    if(ph>1){for(let i=0;i<9;i++){const k=((ph*.8+i/9)%1);c.save();c.globalCompositeOperation='lighter';fGlow(c,27+Math.sin(i*4+ph*5)*14,130-k*60,9,'#7fff8a',.9*(1-k));c.restore();}sdNum(c,27,60-(ph-1)*8,'+30%',Math.min(1,2.4-(ph-1)),'#9dff9d');}}}
function dmTowerScene(c,k,t){const P=3.2,ph=t%P,D=TOWERS[k];dmBg(c);const tx=100,ty=142,col=D.col||'#e3b661';
  if(k==='glass'){const E=dmWights(c,t,P,{from:300,stop:122,walk:1.5,slowFrom:1.1,tint:'#0a1626'});c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(143,211,255,.7)';c.lineWidth=2;c.fillStyle='rgba(143,211,255,.12)';c.beginPath();c.ellipse(tx,ty-2,62,16,0,0,6.283);c.fill();c.stroke();c.restore();
    dmTower(c,tx,ty,col,34);E.forEach((e,i)=>{if(Math.abs(e.x-tx)<70){for(let j=0;j<3;j++){const a=ph*6+j*2.1+i;c.fillStyle='#bfe8ff';c.fillRect(e.x+Math.cos(a)*9,e.y-30+Math.sin(a)*14,2,2);}if(i===0)sdNum(c,e.x,e.y-56,'SLOW',.9,'#9fe6ff');}});return;}
  if(k==='weir'){const E=dmWights(c,t,P,{from:300,stop:130,walk:1.6,slowFrom:1,tint:'#1a0a0a'});c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(225,75,75,.65)';c.lineWidth=2;c.fillStyle='rgba(225,75,75,.1)';c.beginPath();c.ellipse(tx,ty-4,96,24,0,0,6.283);c.fill();c.stroke();c.restore();
    dmTower(c,tx,ty,col,38);E.forEach((e,i)=>{if(i===0&&Math.abs(e.x-tx)<96){sdNum(c,e.x,e.y-56,'+20% DAMAGE',.9,'#ff9a8a');}});return;}
  if(k==='keep'){const E=dmWights(c,t,P,{from:300,stop:170,walk:1.6,tint:'#06090e'});dmTower(c,tx,ty,col,40);const kk=fClamp((ph-.4)/.6,0,1);
    for(let i=0;i<3;i++){const x=tx+22+kk*(40+i*14),y=142+i%2*3;c.save();c.globalAlpha=Math.max(.2,kk);sdFig(c,x,y,.9,'#8a97a8',ph*(ph>1.8?14:3)+i);c.restore();}
    if(ph>1.8&&ph<2.8)sdNum(c,215,84,'BLOCKED',Math.min(1,(ph-1.8)*3),'#e9eef5');return;}
  if(k==='maul'){const E=dmWights(c,t,P,{from:300,stop:200,walk:1.5,flash:1.7});dmTower(c,tx,ty,col,30);
    const sw=fClamp((ph-1.3)/.25,0,1);c.save();c.translate(tx,ty-30);c.rotate(-1.05+sw*1.5);c.fillStyle='#8a6038';c.fillRect(-2,-26,4,30);c.fillStyle='#9aa0b0';c.fillRect(-8,-31,16,9);c.restore();
    if(ph>1.55){const r=fClamp((ph-1.55)/.3,0,1)*44;c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(227,182,97,'+(1-r/60)+')';c.lineWidth=3;c.beginPath();c.arc(210,138,r,0,6.283);c.stroke();c.restore();if(ph<2.7){sdNum(c,215,84,'SLAM + STAGGER',1,'#ffe08a');E.forEach(e=>sdNum(c,e.x,e.y-52-(ph-1.55)*10,'46',Math.max(0,1.2-(ph-1.55)),'#ffd54a'));}}return;}
  const E=dmWights(c,t,P,{from:300,stop:200,walk:1.5,flash:(k==='wild'?1.7:1.4)});
  dmTower(c,tx,ty,col,k==='scorp'?30:44);const sx=tx,sy=ty-52;
  if(k==='watch'){for(let i=0;i<4;i++){const st=1+i*.28,q=(ph-st)/.35;if(q>0&&q<1){const e=E[i%3];dmLine(c,sx+(e.x-sx)*q-8,sy+(e.y-34-sy)*q,sx+(e.x-sx)*q,sy+(e.y-34-sy)*q,'#ffe08a',2);}if(q>=1&&q<1.5)sdNum(c,E[i%3].x,E[i%3].y-52-(q-1)*20,'10',1.5-q,'#ffe08a');}}
  else if(k==='scorp'){const q=(ph-1)/.25;if(q>0&&q<1){c.save();c.globalCompositeOperation='lighter';dmLine(c,sx,sy+8,sx+(E[0].x+30-sx)*q,sy+8+(E[0].y-34-sy-8)*q,'#fff3d0',4);c.restore();}if(ph>1.25&&ph<2.3)E.forEach((e,i)=>sdNum(c,e.x,e.y-52-(ph-1.25)*14,i?'52':'×2.5',1-(ph-1.25)/1.1,'#ffd54a'));}
  else if(k==='wild'){const q=(ph-1)/.7;if(q>0&&q<1){const x=sx+(215-sx)*q,y=sy+(E[1].y-20-sy)*q-Math.sin(q*3.14)*60;c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y,12,'#7cff6b',.9);c.restore();}
    if(ph>1.7){const r=Math.min(1,(ph-1.7)/.4)*48;c.save();c.globalCompositeOperation='lighter';fGlow(c,215,118,r*1.2,'#7cff6b',.55*(1-Math.max(0,ph-2.4)/.8));c.restore();E.forEach((e,i)=>{for(let j=0;j<3;j++){const kk=((ph*1.4+j*.3+i*.1)%1);c.fillStyle='rgba(110,255,110,'+(1-kk)+')';c.beginPath();c.arc(e.x-4+j*4,e.y-30-kk*26,2.4,0,6.283);c.fill();}});if(ph<2.7)sdNum(c,215,70,'SPLASH + BURN',1,'#b8ffb8');}}
  else if(k==='rook'){for(let i=0;i<3;i++){const q=fClamp((ph-.9-i*.15)/.6,0,1);if(q>0&&q<1){const e=E[0],x=sx+(e.x-sx)*q,y=sy+(e.y-50-sy)*q-Math.sin(q*3.14)*16;c.fillStyle='#10131c';c.beginPath();c.ellipse(x,y,6,3,Math.sin(ph*30)*.5,0,6.283);c.fill();c.fillRect(x+4,y-1,4,2);}}
    if(ph>1.5){c.save();c.strokeStyle='rgba(154,167,255,.9)';c.lineWidth=2;c.beginPath();c.arc(E[0].x,E[0].y-44,12+((ph*20)%8),0,6.283);c.stroke();c.restore();sdNum(c,E[0].x,E[0].y-70,'SILENCED',Math.min(1,(ph-1.5)*3),'#b8c2ff');}}}
function dmChamp(c,ch,t){const P=3.2,i=Math.floor(t/P)%ch.sk.length,sk=ch.sk[i];skillDemoFrame(c,sk,t%P,ch.house);
  c.save();c.fillStyle='rgba(0,0,0,.55)';c.fillRect(0,SDH-26,SDW,26);c.font='800 13px Cinzel,serif';c.fillStyle='#ffe08a';c.textAlign='left';c.fillText((SK[sk]?SK[sk].n:sk)+(SK[sk]&&SK[sk].ult?'  · ULT':''),10,SDH-9);c.textAlign='right';c.fillStyle='#b9c8da';c.fillText((i+1)+' / '+ch.sk.length,SDW-10,SDH-9);c.restore();}
function demoFrame(c,kind,id,t,house){if(kind==='spell')dmSpell(c,id,t);else if(kind==='tower')dmTowerScene(c,id,t);else if(kind==='champ'){const ch=CBY[id];if(ch)dmChamp(c,ch,t);}}
function demoLoop(cv){const kind=cv.dataset.dk,id=cv.dataset.di,c=cv.getContext('2d'),k=cv.width/SDW;let raf=0,t0=performance.now(),on=true;fSprites();
  const f=now=>{if(!on||!cv.isConnected){on=false;return;}c.setTransform(k,0,0,k,0,0);try{demoFrame(c,kind,id,(now-t0)/1000,ACC.house);}catch(e){}raf=requestAnimationFrame(f);};raf=requestAnimationFrame(f);return()=>{on=false;cancelAnimationFrame(raf);};}
function demoHTML(kind,id){return `<div class="dmw"><canvas class="dmv" width="640" height="360" data-dk="${kind}" data-di="${id}"></canvas></div>`;}
function demoMount(root){(DMS.stop||[]).forEach(f=>f());DMS.stop=[];(root||document).querySelectorAll('canvas.dmv').forEach(cv=>DMS.stop.push(demoLoop(cv)));}
/* the rooms */
{const sr1=showSpellRoom;showSpellRoom=function(k){sr1(k);k=SPELLS[k]?k:'arrows';const det=card.querySelector('#clist .hdet');if(det){det.insertAdjacentHTML('afterbegin',demoHTML('spell',k));demoMount(det);}};
 const tr1=showTowerRoom;showTowerRoom=function(k){tr1(k);const st=card.querySelector('#clist .tstage');if(st){const kk=card.querySelector('.htile.view');const key=kk?kk.dataset.t:k;if(TOWERS[key]){st.insertAdjacentHTML('afterend',demoHTML('tower',key));demoMount(card.querySelector('#clist'));}}};
 const hr1=showHeroRoom;showHeroRoom=function(v){hr1.apply(this,arguments);const nm=card.querySelector('#clist .hname');const list=CHAMPS.filter(x=>x.house===ACC.house);const c=list.find(x=>x.id===v)||list.find(x=>x.id===ACC.sel)||list[0];if(nm&&c&&unlocked(null,c)){nm.insertAdjacentHTML('afterend',demoHTML('champ',c.id));demoMount(card.querySelector('#clist'));}};}
