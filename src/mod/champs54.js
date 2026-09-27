/* =========================== CHAMPIONS III (v1.0.54) ===========================
   Greyjoy and Tyrell get unique kits: eleven new skill mechanics and twelve new ultimates. Two old ultimates
   become signatures (Kraken → Euron, Charge → Loras). Still no skill pair and no ultimate shared by any of
   the 42 champions redone so far. */
Object.assign(SK,{
 quickstudy:{n:'Quick Study',e:'📖',v:[30,45,60,80,100],d:v=>`Battle XP fills ${v}% faster — the battle level comes sooner`},
 drownaura:{n:'Drowning Tide',e:'💧',v:[8,12,16,20,26],d:v=>`Enemies within 70 px of the champion take ${v} damage a second`},
 bleed:{n:'Bleed',e:'🪓',v:[6,8,10,12,15],d:v=>`Hits open wounds: ${v}% of the target's health over 4 s (bosses half)`},
 reave:{n:'Reave',e:'⚓',v:[4,6,8,10,12],d:v=>`Every champion kill heals ${v}% of the champion's health`},
 storm:{n:'Stormcaller',e:'⚡',v:[40,60,85,115,150],cd:6,d:v=>`Every 6 s lightning strikes an enemy within 150 px for ${v}`},
 whatisdead:{n:'What Is Dead',e:'🦑',v:[2,2.5,3,3.5,4],d:v=>`Once per life a killing blow leaves the champion at 1 health and untouchable for ${v} s`},
 thorns:{n:'Thorns',e:'🥀',v:[8,12,16,20,25],d:v=>`Every enemy that strikes the champion takes ${v} back`},
 drill:{n:'Drill',e:'🥁',v:[12,16,20,25,30],d:v=>`Soldiers within 90 px of the champion deal ${v}% more damage`},
 momentum:{n:'Tourney Lance',e:'🏇',v:[60,80,100,125,150],d:v=>`After riding 60 px, the next blow deals ${v}% more and stuns for 1 s`},
 keepback:{n:'Fall Back',e:'🏃',v:[6,5.5,5,4.5,4],d:v=>`Steps back from an enemy that closes in — every ${v} s`},
 favour:{n:"Highgarden's Favour",e:'🌷',v:[15,22,30,38,48],d:v=>`Soldiers within 90 px of the champion strike ${v}% faster`},
 oldtales:{n:'Old Tales',e:'📚',v:[10,15,20,25,30],cd:45,ult:true,d:v=>`Every spell recharges ${v} s at once`},
 drowned:{n:'Drowned and Risen',e:'🌊',v:[6,8,10,12,14],cd:50,ult:true,d:v=>`For ${v} s every soldier that falls rises again at full health, and so does the champion (once)`},
 ironprice:{n:'The Iron Price',e:'🪙',v:[120,170,230,300,380],cd:40,ult:true,d:v=>`Pays 60 battle gold: every enemy on the field takes ${v} (half without the gold)`},
 axestorm:{n:'Axe Storm',e:'🌪️',v:[4,5,6,7,8],cd:40,ult:true,d:v=>`For ${v} s the champion spins: every half second 1.2× his damage to everything within 60 px`},
 ironfleet:{n:'The Iron Fleet',e:'⛵',v:[80,120,160,210,270],cd:45,ult:true,d:v=>`Ten volleys from the longships over 4 s, ${v} each on random enemies`},
 ironarrow:{n:'Iron Arrow',e:'🏹',v:[200,300,420,560,720],cd:40,ult:true,d:v=>`One arrow across the whole field, along the line with the most enemies: ${v} to each`},
 growing:{n:'Growing Strong',e:'🌱',v:[6,7,8,9,10],cd:45,ult:true,d:v=>`For ${v} s every tower grows 5% stronger each second (up to +50%)`},
 muster:{n:'Horn Hill Muster',e:'🎺',v:[6,7,8,9,10],cd:45,ult:true,d:v=>`Every soldier on the field heals half its health and fights 50% harder for ${v} s`},
 harvest:{n:'Harvest Feast',e:'🍇',v:[6,8,10,12,14],cd:50,ult:true,d:v=>`For ${v} s the door mends 30 a second`},
 queenthorns:{n:'Queen of Thorns',e:'🍷',v:[15,22,30,38,48],cd:45,ult:true,d:v=>`Every enemy on the field is poisoned: ${v} damage a second for 6 s`},
 slayer:{n:'Dragonglass Dagger',e:'🗡️',v:[300,450,600,800,1000],cd:50,ult:true,d:v=>`Kills the strongest White Walker or Lieutenant outright; the Night King — or, with no walker, the strongest enemy — takes ${v}`},
 queenroses:{n:'Queen of Roses',e:'🌹',v:[3,3.5,4,4.5,5],cd:45,ult:true,d:v=>`Every enemy within 150 px turns around and walks back for ${v} s (not bosses)`},
});
const KITS54={
 rodrik:['rally','quickstudy','oldtales'], aeron:['heal','drownaura','drowned'], balon:['goldtouch','shield','ironprice'], victarion:['taunt','bleed','axestorm'],
 yara:['cleave','reave','ironfleet'], euron:['stun','storm','kraken'], theon:['crit','whatisdead','ironarrow'],
 garlan:['rally','thorns','growing'], randyll:['sunder','drill','muster'], mace:['summon','tribute','harvest'], loras:['stun','momentum','linestrike'],
 olenna:['poison','execute','queenthorns'], sam:['pierce','keepback','slayer'], margaery:['charm','favour','queenroses'],
};
for(const id in KITS54)if(CBY[id])CBY[id].sk=KITS54[id].slice();
Object.assign(TALENTS,{
 rodrik:[{n:'Reader of Harlaw',k:'skillmult',sk:'quickstudy',v:0.15,sc:1},{n:'Old Books',k:'cdr',v:0.12,sc:1}],
 aeron:[{n:'Damphair',k:'skillmult',sk:'drownaura',v:0.15,sc:1},{n:'Drowned Priest',k:'hp',v:0.12,sc:1}],
 balon:[{n:'We Do Not Sow',k:'goldkill',v:0.12,sc:1},{n:'Seastone Chair',k:'skillmult',sk:'shield',v:0.15,sc:1}],
 victarion:[{n:'Iron Victory',k:'skillmult',sk:'bleed',v:0.15,sc:1},{n:'Lord Captain',k:'block',v:1,sc:1}],
 yara:[{n:'Black Wind',k:'skillmult',sk:'reave',v:0.15,sc:1},{n:'Reaver Queen',k:'dmg',v:0.11,sc:1}],
 euron:[{n:"Crow's Eye",k:'skillmult',sk:'storm',v:0.15,sc:1},{n:'Silence',k:'cdr',v:0.12,sc:1}],
 theon:[{n:'Prince of Pyke',k:'rate',v:0.09,sc:1},{n:'Redeemed',k:'skillmult',sk:'whatisdead',v:0.15,sc:1}],
 garlan:[{n:'Garlan the Gallant',k:'skillmult',sk:'thorns',v:0.15,sc:1},{n:"Brother's Shield",k:'hp',v:0.12,sc:1}],
 randyll:[{n:'Heartsbane',k:'skillmult',sk:'sunder',v:0.15,sc:1},{n:'Horn Hill Drill',k:'skillmult',sk:'drill',v:0.15,sc:1}],
 mace:[{n:'Lord of Highgarden',k:'skillmult',sk:'tribute',v:0.15,sc:1},{n:'The Reach Provides',k:'skillmult',sk:'summon',v:0.15,sc:1}],
 loras:[{n:'Knight of Flowers',k:'skillmult',sk:'momentum',v:0.15,sc:1},{n:'Tourney Steed',k:'spd',v:0.15,sc:1}],
 olenna:[{n:'Poisoned Wine',k:'skillmult',sk:'poison',v:0.15,sc:1},{n:'Sharp Tongue',k:'skillmult',sk:'execute',v:0.15,sc:1}],
 sam:[{n:'The Citadel',k:'cdr',v:0.12,sc:1},{n:'The Slayer',k:'skillmult',sk:'slayer',v:0.11,sc:1}],
 margaery:[{n:'Little Rose',k:'skillmult',sk:'favour',v:0.15,sc:1},{n:'Queen of the Seven Kingdoms',k:'skillmult',sk:'charm',v:0.15,sc:1}],
});
