/* =========================== THE CITY (v1.0.64) ===========================
   A vertical, scrolling city for the seat's house. Every building opens a screen the game already has; a building opens with the
   stages the seat has cleared (real progress, read from the save). No upgrades yet: those need the server first (account levels, v1.0.65).
   Art is temporary (CSS + emoji) until MR B's city pictures arrive. */
const CITY_NAME={stark:'Winterfell',lannister:'Casterly Rock',targaryen:'Dragonstone',baratheon:"Storm's End",greyjoy:'Pyke',tyrell:'Highgarden',martell:'Sunspear'};
const CITY_SKY={stark:['#2c3e55','#7f95ad'],lannister:['#5a1f1f','#c9a24a'],targaryen:['#231a1f','#8a3a2a'],baratheon:['#2b2a1c','#c9a227'],greyjoy:['#0f2b33','#3f7f8f'],tyrell:['#20402a','#a6c96a'],martell:['#5a3a12','#e8a13a']};
/* id, emoji, name, what it is, stages to clear, the opening call */
const CITY_BLD=[
  ['keep','🏰','Keep','tower and spell cards',0,()=>showHub('coll')],
  ['barracks','⚔️','Barracks','train the house army',0,()=>showTrain()],
  ['market','🏪','Market','chests, deals, dragonglass',0,()=>showShop()],
  ['treasury','📜','Treasury','daily calendar and quests',2,()=>showDaily()],
  ['forge','⚒️','Forge','gear, tiers, sets',3,()=>showForge()],
  ['tavern','🍺','Tavern','champions, stars, portal',5,()=>showHeroRoom()],
  ['library','📚','Library','the book of towers and foes',8,()=>showBook()],
  ['hall','🏛️','Council hall','events and duels',10,()=>showHub('events')]];
function cityCleared(){return Object.values((ACC&&ACC.campaign)||{}).filter(v=>v>0).length;}
function cityOpen(b,n){return n>=b[4];}
function showCity(){
  const n=cityCleared(),hs=ACC.house,nm=CITY_NAME[hs]||'Your city',sky=CITY_SKY[hs]||CITY_SKY.stark;
  const rows=CITY_BLD.map((b,i)=>{const open=cityOpen(b,n);
    return `<button class="cbd ${i%2?'r':'l'} ${open?'':'lock'}" data-b="${b[0]}"><span class="ci">${open?b[1]:'🔒'}</span><span class="ct"><b>${b[2]}</b><small>${open?b[3]:'opens after '+b[4]+' cleared stage'+(b[4]===1?'':'s')+' ('+n+'/'+b[4]+')'}</small></span></button>`;}).join('');
  show(`<div class="topbar"><h1>🏰 ${esc(nm)}<small>${n} stage${n===1?'':'s'} cleared · the door is held</small></h1><button class="back" id="bBack">✖</button></div>
   <div class="city" style="--c1:${sky[0]};--c2:${sky[1]}"><div class="cgate">🚪<small>Hodor holds it</small></div><div class="croad"></div>${rows}</div>`);
  CLOUD.screen='city';
  $('#bBack').addEventListener('click',()=>showHub('battle'));
  card.querySelectorAll('.cbd').forEach(x=>x.addEventListener('click',()=>{const b=CITY_BLD.find(y=>y[0]===x.dataset.b);
    if(!cityOpen(b,cityCleared())){SFX.play('deny');ecoToast(`🔒 ${b[2]} opens after ${b[4]} cleared stages`);return;}SFX.play('tap',60);b[5]();}));
}
