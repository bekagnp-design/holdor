/* =========================== CHAMPIONS I (v1.0.52) ===========================
   1. Every house opens its champions from the least known to the most known, spread over the 50 stages
      (0 · 5 · 10 · 18 · 27 · 36 · 45). Champions an older save had already unlocked stay unlocked (ACC.copen).
   2. Stark and Targaryen get unique kits: nine new skill mechanics and ten new ultimates, no two champions
      sharing a skill pair. The other houses follow in v1.0.53–55. Ranged and caster base damage −20%. */
const CH_ORDER={
 stark:['brienne','robb','bran','sansa','ned','arya','jon'],
 lannister:['kevan','bronn','gregor','tywin','jaime','cersei','tyrion'],
 baratheon:['gendry','barristan','davos','renly','melisandre','robert','stannis'],
 targaryen:['viserys','missandei','daario','greyworm','jorah','drogo','dany'],
 greyjoy:['rodrik','aeron','balon','victarion','yara','euron','theon'],
 tyrell:['garlan','randyll','mace','loras','olenna','sam','margaery'],
 martell:['areo','nymeria','obara','tyene','doran','ellaria','oberyn'],
};
const OLD_TIER={};CHAMPS.forEach(c=>{OLD_TIER[c.id]=c.tier;});
(function(){const out=[];for(const h in HOUSES){const ids=CH_ORDER[h]||[];ids.forEach((id,i)=>{const c=CBY[id];if(c){c.tier=i;out.push(c);}});}
  if(out.length===CHAMPS.length)CHAMPS.splice(0,CHAMPS.length,...out);})();
/* ---- new mechanics (5 ranks each) ---- */
Object.assign(SK,{
 frostbite:{n:'Frostbite',e:'🥶',v:[25,30,35,40,45],d:v=>`Every hit chills the target: ${v}% slower for 2 s`},
 lifesteal:{n:'Bloodletting',e:'🩸',v:[15,20,25,30,35],d:v=>`Heals ${v}% of the damage the champion deals`},
 sunder:{n:'Sunder',e:'💢',v:[12,16,20,24,30],d:v=>`Hits crack armour: the target takes ${v}% more from everything for 3 s`},
 blood:{n:'Second Wind',e:'💪',v:[25,32,40,48,60],d:v=>`Below half health the champion deals ${v}% more damage`},
 knock:{n:'Shove',e:'👊',v:[15,20,25,30,35],d:v=>`${v}% chance a hit throws the target back 24 px`},
 chain:{n:'Chain',e:'⛓️',v:[35,42,50,58,65],d:v=>`Every shot arcs to one more enemy nearby for ${v}% damage`},
 volley:{n:'Volley',e:'🎯',v:[40,60,85,115,150],cd:8,d:v=>`Every 8 s a burst at the 3 nearest enemies for ${v} each`},
 trap:{n:'Caltrops',e:'🪤',v:[60,90,125,165,210],cd:12,d:v=>`Every 12 s drops caltrops at the champion's feet: ${v} damage and a 1 s stun to the first to step on them`},
 howl:{n:'Howl',e:'🐺',v:[40,45,50,55,60],cd:12,d:v=>`Every 12 s everything within 80 px is scared: ${v}% slower for 3 s`},
 wolfpack:{n:'Young Wolf',e:'🐺',v:[2,3,3,4,4],cd:45,ult:true,d:v=>`${v} direwolves run beside the champion for 12 s`},
 remember:{n:'The North Remembers',e:'📜',v:[8,9,10,11,12],cd:50,ult:true,d:v=>`For ${v} s every kill pays double gold`},
 justice:{n:"Winter's Justice",e:'⚖️',v:[25,30,35,40,45],cd:45,ult:true,d:v=>`Beheads every enemy on the road below ${v}% health (not bosses); the rest near the champion stagger 2 s`},
 wallholds:{n:'The Wall Holds',e:'🧊',v:[4,5,6,7,8],cd:50,ult:true,d:v=>`An ice wall rises before the held gate: nothing on foot passes for ${v} s (bosses push through)`},
 crown:{n:'Golden Crown',e:'👑',v:[220,320,440,580,750],cd:45,ult:true,d:v=>`Molten gold on the 3 nearest enemies: ${v} damage each, and they drop double gold`},
 dohaeris:{n:'Valar Dohaeris',e:'🕊️',v:[120,160,200,250,300],cd:50,ult:true,d:v=>`Every soldier on the field is fully healed and the door mends ${v}`},
 stormcrows:{n:'Stormcrows',e:'🗡️',v:[90,130,180,240,320],cd:40,ult:true,d:v=>`Six thrown knives: ${v} damage to each of the 6 nearest enemies`},
 phalanx:{n:'Shield Wall',e:'🛡️',v:[3,4,4,5,6],cd:45,ult:true,d:v=>`${v} Unsullied plant their spears on the road for 15 s — twice the health of a sworn brother`},
 forqueen:{n:'For the Queen',e:'🐻',v:[6,7,8,9,10],cd:45,ult:true,d:v=>`For ${v} s the champion deals +60% damage and heals half of it`},
 khalasar:{n:'Khalasar',e:'🐎',v:[150,220,300,400,520],cd:45,ult:true,d:v=>`The horde tramples everything within 160 px: ${v} damage and 40 px thrown back`},
});
/* ---- the fourteen kits ---- */
const KITS52={
 brienne:['taunt','lifesteal','oath'], robb:['cleave','howl','wolfpack'], bran:['slowaura','frostbite','blizzard'], sansa:['goldtouch','sunder','remember'],
 ned:['shield','execute','justice'], arya:['crit','execute','assassinate'], jon:['cleave','frostbite','wallholds'],
 viserys:['goldtouch','chain','crown'], missandei:['heal','shield','dohaeris'], daario:['crit','blood','stormcrows'], greyworm:['taunt','trap','phalanx'],
 jorah:['cleave','lifesteal','forqueen'], drogo:['crit','knock','khalasar'], dany:['burn','volley','dragonstrike'],
};
for(const id in KITS52)if(CBY[id])CBY[id].sk=KITS52[id].slice();
Object.assign(TALENTS,{
 brienne:[{n:'Oathkeeper',k:'skillmult',sk:'lifesteal',v:0.15,sc:1},{n:'Wall of Tarth',k:'block',v:1,sc:1}],
 robb:[{n:'Grey Wind',k:'skillmult',sk:'howl',v:0.15,sc:1},{n:'King in the North',k:'skillmult',sk:'cleave',v:0.15,sc:1}],
 bran:[{n:'Three-Eyed Raven',k:'skillmult',sk:'slowaura',v:0.15,sc:1},{n:'Warg',k:'cdr',v:0.12,sc:1}],
 sansa:[{n:'Queen in the North',k:'skillmult',sk:'goldtouch',v:0.15,sc:1},{n:'Little Bird',k:'skillmult',sk:'sunder',v:0.15,sc:1}],
 ned:[{n:'Ice',k:'skillmult',sk:'execute',v:0.15,sc:1},{n:'Warden of the North',k:'hp',v:0.12,sc:1}],
 arya:[{n:'A Girl Has No Name',k:'dmg',v:0.11,sc:1},{n:'Water Dancing',k:'rate',v:0.09,sc:1}],
 jon:[{n:"Longclaw's Bite",k:'skillmult',sk:'cleave',v:0.15,sc:1},{n:'Ghost at His Side',k:'skillmult',sk:'frostbite',v:0.15,sc:1}],
 viserys:[{n:'The Beggar King',k:'skillmult',sk:'goldtouch',v:0.15,sc:1},{n:'Wake the Dragon',k:'skillmult',sk:'chain',v:0.15,sc:1}],
 missandei:[{n:'Nineteen Tongues',k:'skillmult',sk:'heal',v:0.15,sc:1},{n:'Loyal Counsel',k:'cdr',v:0.12,sc:1}],
 daario:[{n:'Second Sons',k:'skillmult',sk:'blood',v:0.15,sc:1},{n:'Arakh and Stiletto',k:'rate',v:0.09,sc:1}],
 greyworm:[{n:'Unsullied',k:'hp',v:0.12,sc:1},{n:'Torgo Nudho',k:'skillmult',sk:'trap',v:0.15,sc:1}],
 jorah:[{n:'Bear Island',k:'skillmult',sk:'lifesteal',v:0.15,sc:1},{n:'Exile Knight',k:'dmg',v:0.11,sc:1}],
 drogo:[{n:'Blood of My Blood',k:'skillmult',sk:'knock',v:0.15,sc:1},{n:'Stallion',k:'spd',v:0.15,sc:1}],
 dany:[{n:'Mother of Dragons',k:'skillmult',sk:'dragonstrike',v:0.11,sc:1},{n:'Unburnt',k:'skillmult',sk:'burn',v:0.15,sc:1}],
});
/* ---- migration: unlocks earned under the old order are kept ---- */
function migrate52(a){if(a.lv52)return;a.lv52=1;const c=cleared(a);const OLD=[0,3,6,10,15,21,28];a.copen=a.copen||{};
  for(const ch of CHAMPS){if(ch.house===a.house&&c>=OLD[OLD_TIER[ch.id]||0])a.copen[ch.id]=1;}
  for(const id in (a.champs||{}))if(a.champs[id]&&a.champs[id].lvl>1)a.copen[id]=1;
  if(a.sel&&!a.copen[a.sel]&&c<UNLOCK_STAGE[(CBY[a.sel]||{tier:0}).tier])a.copen[a.sel]=1;}
