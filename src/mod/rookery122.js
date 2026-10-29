/* v1.2.2: the Rookery — ravens that hunt healers, summoners and flyers, and silence them for a few seconds. A single-target tower (kind 'single'):
   the target loop prefers support enemies (raise / heal / speed aura), then flyers; a hit sets e.silT. */
TOWERS.rook={n:'Rookery',e:'🐦‍⬛',sub:'Ravens hunt healers, summoners and flyers, and silence them',cost:[110,90,120,150,190],range:150,dmg:9,rate:0.9,kind:'single',pspd:470,col:'#9aa7ff',silence:3};
if(!TKEYS.includes('rook'))TKEYS.push('rook');
TOWER_UNLOCK.rook=13;T_RAR.rook=3;TSHORT.rook='Rookery';
TMILE.rook=[['🪶','Keen ravens','+10% range'],['🐦‍⬛','Sharp beaks','+10% damage'],['🔔','Long silence','silence lasts 1 s longer'],['👑','Raven king','+12% fire rate']];
TGUIDE.rook={hits:'Ground + air',role:'Ravens that pick out healers, summoners and flyers first',strong:'Necromancers, skinchangers and chieftains lose their power for 3 s on every hit',weak:'Little damage to the main host: pair it with a strong damage tower',demo:'arrow'};
TOWER_C.rook="A roost of ravens. They ignore the crowd and go for what keeps it alive: the Cold necromancer who raises the dead, the skinchanger who heals them, the chieftain who hurries them, and the birds. Every hit silences the target for three seconds: no raising, no healing, no speeding up.";
TOWER_VS.rook={good:['necromancers','skinchangers','chieftains','fliers'],bad:['plain crowds','armoured enemies']};
function rookPri(e){return (e.raise||e.healAura||e.speedAura||e.lord)?1e9:(e.fly||e.air)?1e8:-remainOf(e);}
function rookSilence(t){const L=tLvl('rook'),extra=L>=T_MILE[2]?1:0;return TOWERS.rook.silence+extra+(typeof mstRookSil==='function'?mstRookSil():0);}
function rookHit(p){const e=p.tgt;if(!e||e.hp<=0)return;if(e.raise||e.healAura||e.speedAura||e.lord||e.web){e.silT=G.time+(p.sil||3);const q=posE(e);addText(q.x,q.y-24,'silenced','#9aa7ff');addFx({t:'ring',x:q.x,y:q.y-6,r0:4,r1:22,life:0.4,col:'#9aa7ff'});}}
/* its stats follow the milestones */
{const ts0=towerStats;towerStats=function(t,ML){const o=ts0(t,ML);if(t.type!=='rook')return o;const L=ML||tLvl('rook'),M=i=>L>=T_MILE[i];
  if(M(0))o.range*=1.10;if(M(1))o.dmg*=1.10;if(M(3))o.rate*=1.12;return o;};}
/* the building: a roost with ravens (drawn, until there is art) and its icon */
function rookDraw(t,l,now,x){const hgt=20+4*l,w=15+l;ctx.fillStyle='#4a4f66';ctx.fillRect(-w/2,-hgt,w,hgt);ctx.fillStyle='#6b7190';ctx.fillRect(-w/2,-hgt,w*0.42,hgt);
  ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(-w/2,-hgt+i*hgt/4);ctx.lineTo(w/2,-hgt+i*hgt/4);ctx.stroke();}
  ctx.fillStyle='#2c3045';for(let i=0;i<4;i++)ctx.fillRect(-w/2+i*(w/3.4),-hgt-3,w/6,4);
  const n=Math.min(5,l+1);for(let i=0;i<n;i++){const bx=n===1?0:-w/2+3+i*((w-6)/(n-1)),by=-hgt-6-(i%2)*3+Math.sin(now/260+i*1.7+x)*1.2;
    ctx.fillStyle='#14151c';ctx.beginPath();ctx.ellipse(bx,by,3.3,2.3,0,0,6.283);ctx.fill();
    ctx.beginPath();ctx.moveTo(bx-1,by-1);ctx.lineTo(bx-4,by-5+Math.sin(now/80+i)*2);ctx.lineTo(bx+1,by-2);ctx.fill();
    ctx.fillStyle='#e3b661';ctx.fillRect(bx+2.5,by-0.5,1.6,1);}
  if(l>=5){ctx.fillStyle='#e3b661';ctx.fillRect(-w/2,-hgt-9,w,2);}}
function rookSVG(px){return `<svg viewBox="0 0 48 48" style="width:${px}px;height:${px}px"><defs><linearGradient id="rkg" x1="0" x2="1"><stop offset="0" stop-color="#8a90b0"/><stop offset="1" stop-color="#4a4f66"/></linearGradient></defs><ellipse cx="24" cy="43" rx="14" ry="3.2" fill="#0007"/><path d="M14 43V18h20v25z" fill="url(#rkg)" stroke="#262a3c" stroke-width="1.4"/><path d="M12 18h24v-4h-4v-3h-4v3h-4v-3h-4v3h-4v-3h-4z" fill="#5a6080" stroke="#262a3c" stroke-width="1.2"/><path d="M14 24h20M14 30h20M14 36h20" stroke="#262a3c" stroke-opacity=".35" stroke-width="1"/><path d="M21 43v-7a3 3 0 0 1 6 0v7z" fill="#2a1d12" stroke="#14151c" stroke-width="1"/><rect x="22.5" y="21" width="3" height="6" rx="1.5" fill="#14151c"/><g fill="#14151c"><ellipse cx="14" cy="9" rx="4.2" ry="2.8"/><path d="M11 8l-5-3 1 5zM16.5 8.5l4-3-1 5z"/><ellipse cx="27" cy="8" rx="4" ry="2.7"/><path d="M30 6.5l5-3-1 5z"/><ellipse cx="37" cy="12" rx="3.6" ry="2.4"/><path d="M40 11l4-2-.5 4z"/></g><g fill="#e3b661"><path d="M17.8 8.4l3 .8-3 .9z"/><path d="M23 7.4l-2.6.6 2.6.9z"/><path d="M40 12.4l2.8.6-2.8.8z"/></g></svg>`;}
{const th0=towerIconHTML;towerIconHTML=function(type,lvl,px){return type==='rook'?rookSVG(px||34):th0(type,lvl,px);};}
/* the first time it opens, a short lesson */
LESSONS.rook={need:()=>towerOpen('rook'),steps:towerLesson('rook','New tower: the Rookery. Its ravens go for what keeps the dead alive, the necromancers, healers and chieftains, and silence them for three seconds with every hit.')};
