/* v1.3.2: the Siege maul — an eighth tower. A heavy swing that slams one spot of the road: damage to everything in a small circle and a stagger
   (a short stop) for what is not a boss. A tower of kind 'splash' with an almost instant shell; the stagger rides on the shell (p.stun). */
TOWERS.maul={n:'Siege maul',e:'🔨',sub:'A heavy swing: damage in a circle and a short stagger',cost:[120,95,125,160,205],range:104,minRange:0,dmg:46,splash:30,burn:0,rate:0.42,kind:'splash',pspd:1500,col:'#c98a4a',stun:0.7};
if(!TKEYS.includes('maul'))TKEYS.push('maul');
TOWER_UNLOCK.maul=18;T_RAR.maul=2;TSHORT.maul='Maul';
TMILE.maul=[['📏','Long haft','+8% range'],['💪','Iron head','+10% damage'],['⏱','Stagger','the stagger lasts 0.3 s longer'],['⚙️','Counterweight','+10% swings']];
TGUIDE.maul={hits:'Ground + air (aims at the nearest to the gate)',role:'A slow, heavy swing with a stagger',strong:'Packs at a bend: everyone in the circle takes the blow and stops for a moment, so every other tower gets free shots',weak:'Slow swings; a boss is not staggered',demo:'lob'};
TOWER_C.maul="A great beam with an iron head, hauled back and let fall. One swing a couple of seconds apart, but it lands on a whole knot of the dead and holds them for a moment. Planted at a bend, it gives the archers and the fire time. Bosses shrug the stagger off.";
TOWER_VS.maul={good:['packs','bends in the road','fast crowds'],bad:['bosses','single targets','fliers']};
function maulStun(){const L=tLvl('maul'),extra=L>=T_MILE[2]?0.3:0;return TOWERS.maul.stun+extra;}
function maulHit(p){const T=maulStun();for(const e of G.enemies){if(e.hp<=0||e.boss||e.slowImmune)continue;const q=posE(e);if(dist(q.x,q.y,p.lx,p.ly)<=p.splash+e.r){e.chillT=Math.max(e.chillT||0,G.time+(p.stun||T));e.chillV=98;}}
  addFx({t:'ring',x:p.lx,y:p.ly,r0:4,r1:p.splash+8,life:0.3,col:'#e3b661'});G.shake=Math.min(6,(G.shake||0)+1.5);}
{const ts0=towerStats;towerStats=function(t,ML){const o=ts0(t,ML);if(t.type!=='maul')return o;const L=ML||tLvl('maul'),M=i=>L>=T_MILE[i];
  if(M(0))o.range*=1.08;if(M(1))o.dmg*=1.10;if(M(3))o.rate*=1.10;return o;};}
/* the building: a frame with a swinging beam; the beam falls when the tower has just fired */
function maulDraw(t,l,now,x){const hgt=16+3*l;ctx.fillStyle='#5a3f26';ctx.fillRect(-12,-hgt,5,hgt);ctx.fillRect(7,-hgt,5,hgt);ctx.fillStyle='#7a5636';ctx.fillRect(-12,-hgt,2,hgt);ctx.fillRect(7,-hgt,2,hgt);
  ctx.fillStyle='#3a2a1a';ctx.fillRect(-14,-hgt-3,28,4);
  const per=1/Math.max(.2,TOWERS.maul.rate),since=per-Math.max(0,t.cd),k=since<0.25?since/0.25:Math.max(0,1-(since-0.25)/(per*0.6)),ang=-1.05+k*1.5;
  ctx.save();ctx.translate(0,-hgt);ctx.rotate(ang);ctx.fillStyle='#8a6038';ctx.fillRect(-2,-26-l*1.5,4,30+l*1.5);ctx.fillStyle='#6b7080';ctx.fillRect(-8,-31-l*1.5,16,9);ctx.fillStyle='#9aa0b0';ctx.fillRect(-8,-31-l*1.5,16,3);ctx.restore();
  if(l>=5){ctx.fillStyle='#e3b661';ctx.fillRect(-14,-hgt-6,28,2);}}
function maulSVG(px){return `<svg viewBox="0 0 48 48" style="width:${px}px;height:${px}px"><ellipse cx="24" cy="43" rx="15" ry="3.2" fill="#0007"/><path d="M11 43V20h4v23zM33 43V20h4v23z" fill="#7a5636" stroke="#3a2a1a" stroke-width="1.2"/><path d="M9 20h30v-3H9z" fill="#3a2a1a"/><g transform="rotate(-38 24 18)"><rect x="22" y="2" width="4" height="22" fill="#8a6038" stroke="#3a2a1a" stroke-width="1"/><rect x="16" y="0" width="16" height="8" rx="1.5" fill="#8a90a0" stroke="#2c3040" stroke-width="1.2"/></g></svg>`;}
{const th0=towerIconHTML;towerIconHTML=function(type,lvl,px){return type==='maul'?maulSVG(px||34):th0(type,lvl,px);};}
LESSONS.maul={need:()=>towerOpen('maul'),steps:towerLesson('maul','New tower: the Siege maul. One heavy swing every couple of seconds on a whole knot of the dead, and they stop for a moment — build it at a bend in the road.')};
