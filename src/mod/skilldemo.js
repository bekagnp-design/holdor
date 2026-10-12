/* =========================== SKILL DEMOS (v1.1.4) ===========================
   Every skill of every champion is explained by a short looping picture instead of a paragraph: a small canvas with the champion's house
   colours on the left and three of the dead on the right, and what the skill does happening to them — a ring that bursts out of the
   champion, a rain of strikes, green mending on the gate, a shield that turns blows aside, frost and stars on the slowed and stunned,
   poison and flame ticking, towers glowing, soldiers stepping out, coins, one great blow. A hundred skills fall into eleven kinds
   (SKCAT); the kind gives the picture and a five-word line (SKTAG). The full text of the skill stays one tap away. Drawn with the
   same hands as the films (film.js) and the troops (troops.js). */
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
/* ---------- the picture ---------- */
const SDW=320,SDH=180;
function sdFig(c,x,y,s,col,ph){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(0,1,13,4,0,0,6.283);c.fill();
  c.fillStyle=col;c.beginPath();c.moveTo(-8,-34);c.quadraticCurveTo(-13,-14,-11,0);c.lineTo(11,0);c.quadraticCurveTo(13,-14,8,-34);c.closePath();c.fill();
  c.fillStyle='#c9d2dd';c.beginPath();c.arc(0,-40,6,0,6.283);c.fill();c.fillStyle='#8896a6';c.beginPath();c.arc(0,-42,6.4,Math.PI,0);c.fill();
  c.strokeStyle='#e9eef5';c.lineWidth=2.2;c.lineCap='round';const sw=Math.sin(ph||0)*.5;c.beginPath();c.moveTo(7,-26);c.lineTo(20+sw*6,-44-sw*5);c.stroke();c.restore();}
function sdNum(c,x,y,txt,a,col){c.save();c.globalAlpha=Math.max(0,Math.min(1,a));c.font='800 14px Cinzel,serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.7)';c.strokeText(txt,x,y);c.fillStyle=col||'#fff';c.fillText(txt,x,y);c.restore();}
function sdEnemies(c,t,P,opt){const ph=t%P;opt=opt||{};const out=[];for(let i=0;i<3;i++){const x0=290-i*34,x=x0-Math.min(1,ph/1.1)*(opt.slow?30:70)*(1-(opt.slow?Math.min(1,(ph-1)/1)*.7:0)),y=140+(i%2)*4,hit=opt.hitAt!=null&&ph>opt.hitAt&&ph<opt.hitAt+.35;
  c.save();if(hit){c.globalAlpha=.55+.45*Math.sin(ph*60);}fWight(c,x,y,.78,t*3+i,opt.tint||'#06090e');c.restore();fEyes(c,x,y-41,1.3,opt.dim?.4:.9);out.push({x,y});}return out;}
function skillDemoFrame(c,sk,t,house){const cat=skCat(sk),P=3.2,ph=t%P,hh=HOUSES[house]||HOUSES.stark,col=hh.col2,hc=hh.col;
  const g=c.createLinearGradient(0,0,0,SDH);g.addColorStop(0,'#0a1424');g.addColorStop(1,'#1a2433');c.fillStyle=g;c.fillRect(0,0,SDW,SDH);
  c.fillStyle='#121b27';c.fillRect(0,142,SDW,SDH-142);c.strokeStyle='rgba(255,255,255,.07)';c.beginPath();c.moveTo(0,142);c.lineTo(SDW,142);c.stroke();
  const cx=78,cy=142;
  if(cat==='aoe'){const E=sdEnemies(c,t,P,{hitAt:1.35});sdFig(c,cx,cy,1.35,col,ph*8);const r=ph>1.2?Math.min(1,(ph-1.2)/.5)*120:0;if(r>0){c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,224,138,'+(1-r/150)+')';c.lineWidth=5;c.beginPath();c.arc(cx,cy-24,r,0,6.283);c.stroke();fGlow(c,cx,cy-24,r*.9,hc,.18*(1-r/150));c.restore();}
    if(ph>1.4&&ph<2.3)E.forEach((e,i)=>sdNum(c,e.x,e.y-52-(ph-1.4)*18,'40',1-(ph-1.4)/.9,'#ffe08a'));}
  else if(cat==='rain'){const E=sdEnemies(c,t,P,{hitAt:1.5});sdFig(c,cx,cy,1.35,col,ph*5);for(let i=0;i<5;i++){const st=.9+i*.16,k=(ph-st)/.38;if(k>0&&k<1){const e=E[i%3],x=e.x-10+i*5,y=-10+(e.y-30+10)*k;c.strokeStyle='#ffe08a';c.lineWidth=2;c.beginPath();c.moveTo(x,y-14);c.lineTo(x,y);c.stroke();}
      if(k>=1&&k<1.6){const e=E[i%3];c.save();c.globalCompositeOperation='lighter';fGlow(c,e.x-5+i*3,e.y-30,26*(1.6-k),'#ffb23c',.6);c.restore();sdNum(c,e.x,e.y-52-(k-1)*20,'90',1.6-k,'#ffe08a');}}}
  else if(cat==='heal'){c.fillStyle='#2a1f1a';c.fillRect(8,84,38,58);c.beginPath();c.arc(27,84,19,Math.PI,0);c.fill();c.fillStyle='#14100d';c.fillRect(16,98,22,44);const hp=Math.min(1,.35+Math.max(0,ph-1)/1.4*.65);
    c.fillStyle='rgba(0,0,0,.6)';c.fillRect(8,76,38,6);c.fillStyle=hp>.7?'#7fd06a':'#e3b661';c.fillRect(9,77,36*hp,4);sdFig(c,cx+34,cy,1.35,col,0);sdEnemies(c,t,P,{dim:true});
    for(let i=0;i<7;i++){const k=((ph*.6+i/7)%1),x=cx+34-k*(cx+34-27)+Math.sin(i*5+ph*4)*6,y=cy-52-k*(cy-52-96)-Math.sin(k*3.14)*26;c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y,10,'#7fff8a',.9*(1-k*.4));c.restore();c.fillStyle='#b8ffc0';c.fillRect(x-1,y-4,2,8);c.fillRect(x-4,y-1,8,2);}
    if(ph>1.2&&ph<2.4)sdNum(c,27,68-(ph-1.2)*10,'+15',1-(ph-1.2)/1.2,'#9dff9d');}
  else if(cat==='shield'){const E=sdEnemies(c,t,P,{});sdFig(c,cx,cy,1.35,col,0);const pul=.85+.15*Math.sin(t*6);c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(120,200,255,.8)';c.lineWidth=3;c.fillStyle='rgba(90,170,255,.15)';c.beginPath();c.ellipse(cx,cy-28,40*pul,50*pul,0,0,6.283);c.fill();c.stroke();c.restore();
    if(ph>1.3&&ph<2.5){const k=(ph-1.3)/1.2;E.forEach((e,i)=>{const x=cx+44+i*0;if(i===0){c.strokeStyle='rgba(255,120,100,'+(1-k)+')';c.lineWidth=3;c.beginPath();c.moveTo(e.x-20,e.y-40);c.lineTo(cx+46,cy-34);c.stroke();}});sdNum(c,cx+60,cy-70-k*14,'0',1-k,'#9fd8ff');}}
  else if(cat==='control'){const E=sdEnemies(c,t,P,{slow:true,tint:'#0a1626'});sdFig(c,cx,cy,1.35,col,ph*4);E.forEach((e,i)=>{if(ph>1){c.save();c.globalCompositeOperation='lighter';fGlow(c,e.x,e.y-26,34,'#7fd8ff',.35);c.restore();
      const k=ph*5+i;for(let j=0;j<3;j++){const a=k+j*2.1;c.fillStyle='#ffe66d';c.font='13px serif';c.textAlign='center';c.fillText('★',e.x+Math.cos(a)*14,e.y-62+Math.sin(a)*4);}}});if(ph>1&&ph<2.4)sdNum(c,200,92,'SLOW',.9,'#9fe6ff');}
  else if(cat==='dot'){const E=sdEnemies(c,t,P,{tint:'#07110a'});sdFig(c,cx,cy,1.35,col,ph*5);E.forEach((e,i)=>{if(ph>.9){for(let j=0;j<4;j++){const k=((ph*1.4+j*.25+i*.1)%1);c.fillStyle=i%2?'rgba(255,150,60,'+(1-k)+')':'rgba(110,255,110,'+(1-k)+')';c.beginPath();c.arc(e.x-6+j*4,e.y-30-k*30,2.6*(1-k*.4),0,6.283);c.fill();}
      const tk=Math.floor((ph-.9)*2);if(tk>=0&&((ph-.9)*2)%1<.5)sdNum(c,e.x,e.y-58-((ph-.9)*2%1)*20,'6',1-((ph-.9)*2%1)*2,'#b8ffb8');}});}
  else if(cat==='buff'){sdEnemies(c,t,P,{});sdFig(c,cx,cy,1.3,col,ph*4);[[150,112],[200,112]].forEach(([x,y],i)=>{const on=ph>.9;c.fillStyle='#2c3644';c.fillRect(x-9,y-20,18,30);c.fillStyle='#3c485a';c.fillRect(x-12,y-26,24,8);if(on){c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y-14,34+4*Math.sin(t*8),'#ffd060',.45);c.restore();c.fillStyle='#ffe08a';c.beginPath();c.moveTo(x,y-46-((ph*30)%10));c.lineTo(x-5,y-38-((ph*30)%10));c.lineTo(x+5,y-38-((ph*30)%10));c.closePath();c.fill();}
    const fire=on?((ph*(on?7:3))%1):((ph*3)%1);c.strokeStyle='#ffe08a';c.lineWidth=2;c.beginPath();c.moveTo(x+12+fire*60,y-16);c.lineTo(x+22+fire*60,y-16);c.stroke();});if(ph>.9)sdNum(c,175,70,'+40%',Math.min(1,(ph-.9)*3),'#ffe08a');}
  else if(cat==='summon'){const E=sdEnemies(c,t,P,{});sdFig(c,cx,cy,1.35,col,ph*4);const k=fClamp((ph-.8)/.5,0,1);if(k>0){[[cx+34,cy],[cx+62,cy+3]].forEach(([x,y],i)=>{c.save();c.globalAlpha=k;c.save();c.globalCompositeOperation='lighter';fGlow(c,x,y-20,32*(1-k*.4),'#ffffff',.4*(1-k));c.restore();sdFig(c,x,y,.95*(.5+.5*k),hc,ph*10+i);c.restore();});}}
  else if(cat==='gold'){const E=sdEnemies(c,t,P,{hitAt:1.2});sdFig(c,cx,cy,1.35,col,ph*8);c.fillStyle='#e3b661';c.font='700 12px Cinzel,serif';c.textAlign='left';c.fillText('🪙 '+(120+Math.floor(Math.min(1,Math.max(0,ph-1.3))*35)),10,18);
    for(let i=0;i<7;i++){const k=fClamp((ph-1.3-i*.07)/.9,0,1);if(k>0&&k<1){const ex=E[0].x,ey=E[0].y-30,x=ex+(30-ex)*k,y=ey+(14-ey)*k-Math.sin(k*3.14)*30;c.fillStyle='#ffd23c';c.beginPath();c.arc(x,y,4,0,6.283);c.fill();c.fillStyle='#fff3b0';c.fillRect(x-1,y-2,2,2);}}if(ph>1.3&&ph<2.4)sdNum(c,E[0].x,E[0].y-56,'+35%',1-(ph-1.3),'#ffe08a');}
  else if(cat==='strike'){const E=sdEnemies(c,t,P,{});sdFig(c,cx+30*Math.min(1,ph/1.2),cy,1.35,col,ph*8);if(ph>1.35&&ph<1.9){const k=(ph-1.35)/.55,e=E[0];c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,240,200,'+(1-k)+')';c.lineWidth=6;c.beginPath();c.moveTo(e.x-40,e.y-70);c.lineTo(e.x+30,e.y-8);c.stroke();fGlow(c,e.x,e.y-34,70*(1-k*.3),'#ffffff',.5*(1-k));c.restore();sdNum(c,e.x,e.y-66-k*16,'500!',1-k*.8,'#ffe08a');}}
  else{sdEnemies(c,t,P,{});sdFig(c,cx,cy,1.35,col,ph*5);c.save();c.globalCompositeOperation='lighter';fGlow(c,cx,cy-30,60+30*Math.sin(t*5),hc,.4);c.restore();}
}
/* a looping demo on a canvas; returns the function that stops it */
function skillDemoLoop(cv,sk,house){const c=cv.getContext('2d'),k=cv.width/SDW;let raf=0,t0=performance.now(),on=true;fSprites();
  const f=now=>{if(!on||!cv.isConnected){on=false;return;}c.setTransform(k,0,0,k,0,0);try{skillDemoFrame(c,sk,(now-t0)/1000,house);}catch(e){}raf=requestAnimationFrame(f);};raf=requestAnimationFrame(f);return()=>{on=false;cancelAnimationFrame(raf);};}
