/* v1.2.4: the preparation before a battle — 3 spells, 5 towers, the champion. ACC.roster = tower ids (max 5); ACC.loadout = spell ids.
   flow150: the sheet with its own editor is gone. The map card shows the chosen deck (deckStripHTML in flow150.js) with one ⚔ TO BATTLE
   button and a "change ›" link to Army → Loadout, the one place the deck is edited; prepGo() starts the battle at once. The data stays. */
const ROSTER_MAX=5;
function towerRoster(){const open=openTowers();if(open.length<=ROSTER_MAX)return open;
  const out=[];for(const k of ((ACC&&ACC.roster)||[]))if(open.includes(k)&&!out.includes(k))out.push(k);
  if(!(ACC&&Array.isArray(ACC.roster))||!out.length)for(const k of open)if(out.length<ROSTER_MAX&&!out.includes(k))out.push(k);return out.slice(0,ROSTER_MAX);}
function battleTowers(){return G.tutorial?['watch']:towerRoster();}
function prepNeeded(){return !!(ACC&&ACC.castle&&cleared()>=5&&(openTowers().length>ROSTER_MAX||Object.keys(SPELLS).filter(k=>k==='arrows'||cleared()>=SPELLS[k].at).length>3));}
function prepOpenSpells(){return Object.keys(SPELLS).filter(k=>k==='arrows'||cleared()>=SPELLS[k].at);}
function prepGo(go){document.querySelectorAll('#prep').forEach(n=>n.remove());go();}
