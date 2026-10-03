/* =========================== HOLD BLESSINGS (v1.0.80) ===========================
   The roguelike beat of Galaxy Defense and the survivor games: in the Hold, after every fifth wave the game stops and offers three
   blessings; one is chosen and lasts for the rest of the run, and they stack. The three on offer come from the day's seed and the wave
   (the same offer for every defender on the same day), never from the battle's own random stream, so the waves themselves are untouched.
   If nobody chooses within 20 seconds, the first is taken. Kills, waves and time are what the server checks, and none of the blessings
   adds enemies or shortens a wave. */
const BOONS={
 arrows:{e:'🏹',n:'Sharper steel',d:'Towers deal +15% damage',f:b=>{b.tw=(b.tw||0)+0.15;}},
 blade:{e:'⚔️',n:'Champion\'s edge',d:'Your champion deals +35% damage',f:b=>{b.hero=(b.hero||0)+0.35;}},
 storm:{e:'🔥',n:'Wildfire',d:'Spells deal +40% damage',f:b=>{b.sp=(b.sp||0)+0.4;}},
 mend:{e:'🧱',n:'Mend the door',d:'The door gets back 35% of its strength',f:()=>{G.doorHp=Math.min(G.doorMax,G.doorHp+G.doorMax*0.35);}},
 oak:{e:'🚪',n:'Thicker oak',d:'The door grows 20% stronger',f:()=>{const add=Math.round(G.doorMax*0.2);G.doorMax+=add;G.doorHp+=add;}},
 coin:{e:'💰',n:'Plunder',d:'+300 gold now',f:()=>{G.gold+=300;}},
 loot:{e:'🪙',n:'Spoils of war',d:'+20% gold from every kill',f:b=>{b.loot=(b.loot||0)+0.2;}},
 focus:{e:'✨',n:'Quick hands',d:'Spells recharge 25% faster, and are ready now',f:()=>{for(const k in G.powerMax){G.powerMax[k]*=0.75;G.powerCd[k]=0;}}}
};
const BOON_KEYS=Object.keys(BOONS);
function boonOn(){return G.mode==='online';}
/* the offer for a wave: three different blessings from the day's seed */
function boonOffer(wave){let h=hash32('boon:'+(typeof todayKey!=='undefined'?todayKey:'')+':'+wave);const pool=BOON_KEYS.slice(),out=[];
  while(out.length<3&&pool.length){h=Math.imul(h^(h>>>15),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;h^=h>>>16;out.push(pool.splice(h%pool.length,1)[0]);}return out;}
function boonMul(src){const b=G.boon;if(!b)return 1;
  if(src==='hero'||src==='cleave'||src==='dany')return 1+(b.hero||0);
  if(src==='power'||src==='storm')return 1+(b.sp||0);
  if(src==='watch'||src==='scorp'||src==='wild'||src==='glass'||src==='weir'||src==='keep'||src==='ally'||src==='burn'||src==='poison')return 1+(b.tw||0);
  return 1;}
function boonPick(k){const B=BOONS[k];if(!B||!G.boonAsk)return;G.boon=G.boon||{};B.f(G.boon);(G.boons=G.boons||[]).push(k);G.log.push({t:G.tick,a:'boon',k});
  G.boonAsk=null;clearTimeout(G.boonT);const el=document.getElementById('boonOv');if(el)el.remove();G.paused=false;try{SFX.play('levelup');}catch(e){}
  try{addText(W/2,H*0.4,B.e+' '+B.n,'#ffd54a',1);}catch(e){}}
/* called before a wave starts: after waves 5, 10, 15 … of the Hold */
function boonCheck(){if(G.boonAsk)return true;   /* still waiting for a choice: the wave waits too */
  if(!boonOn()||G.wave<5||G.wave%5!==0)return false;G.boonDone=G.boonDone||{};if(G.boonDone[G.wave])return false;G.boonDone[G.wave]=1;
  const offer=boonOffer(G.wave);G.boonAsk=offer;G.paused=true;
  const ov=document.createElement('div');ov.id='boonOv';
  ov.innerHTML=`<div class="bo-in"><small>WAVE ${G.wave} HELD</small><h2>Choose a blessing</h2><div class="bo-row">${offer.map((k,i)=>{const B=BOONS[k];
    return `<button class="bo-card" data-boon="${k}" style="animation-delay:${i*90}ms"><span class="bo-e">${B.e}</span><b>${B.n}</b><em>${B.d}</em></button>`;}).join('')}</div>
    ${(G.boons||[]).length?`<p class="bo-have">Yours: ${(G.boons||[]).map(k=>BOONS[k].e).join(' ')}</p>`:''}</div>`;
  (document.getElementById('stage')||document.body).appendChild(ov);
  ov.querySelectorAll('[data-boon]').forEach(b=>b.addEventListener('click',()=>boonPick(b.dataset.boon)));
  try{SFX.play('chest');}catch(e){}
  clearTimeout(G.boonT);G.boonT=setTimeout(()=>{if(G.boonAsk===offer)boonPick(offer[0]);},20000);
  return true;}
