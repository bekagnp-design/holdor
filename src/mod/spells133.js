/* v1.3.3: two more spells — Wildfire jars (aimed: a burning pool that stays 8 s) and Beacon (every tower shoots 30% faster for 8 s, stealth revealed). */
Object.assign(SPELLS,{
  jars:{e:'🏺',n:'Wildfire jars',cd:35,at:15,d:'Jars of green fire break on the road and leave a burning pool for eight seconds'},
  beacon:{e:'🔥',n:'Beacon',cd:50,at:20,d:'The beacon is lit: every tower shoots 30% faster for eight seconds and nothing hides in its light'}});
S_RAR.jars=2;S_RAR.beacon=3;
{const cp1=castPower;castPower=function(id,x,y){
  if(id!=='jars'&&id!=='beacon')return cp1(id,x,y);
  if(G.state!=='play'||G.powerCd[id]>0)return;G.powerCd[id]=G.powerMax[id];SFX.play('spell');G.log.push({t:G.tick,a:'power',id,x:Math.round(x||0),y:Math.round(y||0)});
  const m=spellMul(id);
  if(id==='jars'){G.clouds.push({x,y,dps:Math.round(70*m),t:8});addFx({t:'burst',x,y:y-6,r0:6,r1:60,life:0.5,col:'#7cff6b'});addText(x,y-36,'WILDFIRE','#b8ffb8',true);}
  else{G.beaconUntil=G.time+8;G.beaconMul=1+0.3*m;for(const e of G.enemies)if(e.stealth)e.stealth=false;
    for(const s of G.map.slots)if(s.tower)addFx({t:'ring',x:s.x,y:s.y,r0:6,r1:34,life:0.7,col:'#ffb23c'});addText(W/2,H*0.3,'BEACON +'+Math.round(30*m)+'%','#ffd54a',true);}
  updateBar();};}
{const sl1=spellLine;spellLine=function(k,l){const m=1+0.06*((l||spellLvl(k))-1);
  if(k==='jars')return `a pool burning ${Math.round(70*m)} a second for 8 s`;
  if(k==='beacon')return `every tower ${Math.round(30*m)}% faster for 8 s`;return sl1(k,l);};
 const sv1=spellSVG;spellSVG=function(k){
  if(k==='jars')return '<svg viewBox="0 0 24 24" fill="none" stroke="#7cff6b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6M10 4v3c-3 1-4 4-4 7 0 3 2 6 6 6s6-3 6-6c0-3-1-6-4-7V4"/><path d="M12 11c1 1.5 2 2 2 3.5a2 2 0 0 1-4 0c0-1 1-2 2-3.5z"/></svg>';
  if(k==='beacon')return '<svg viewBox="0 0 24 24" fill="none" stroke="#ffb23c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21l1.5-9h5L16 21M7 21h10M12 3c2 2 3 3.5 3 5.5a3 3 0 0 1-6 0c0-2 1-3.5 3-5.5z"/></svg>';
  return sv1(k);};}
