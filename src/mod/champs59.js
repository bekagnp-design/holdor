/* =========================== CHAMPIONS IV (v1.0.59) ===========================
   Martell gets its unique kits — the last house. Three new skill mechanics, six new ultimates, and the old
   Poison Cloud becomes Ellaria's signature. No skill pair and no ultimate is shared by any of the 49 champions. */
Object.assign(SK,{
 sunaura:{n:'Sun of Dorne',e:'☀️',v:[6,9,12,16,20],d:v=>`Soldiers within 90 px of the champion mend ${v} health a second`},
 viper:{n:"Viper's Kiss",e:'🐍',v:[40,60,85,115,150],d:v=>`Every fourth blow on the same enemy deals ${v} more and poisons it for 4 s`},
 waitstrike:{n:'Patience',e:'⏳',v:[4,5,6,8,10],d:v=>`Every second the champion stands still his damage grows ${v}% (up to 5 s)`},
 iserve:{n:'I Serve',e:'🪓',v:[5,6,7,8,10],cd:45,ult:true,d:v=>`For ${v} s the champion stops everyone who reaches him, giants too, and takes 40% less damage`},
 whiplash:{n:'The Whip',e:'🪢',v:[2,2.5,3,3.5,4],cd:40,ult:true,d:v=>`The whip binds the ${fc(v)} strongest enemies within 200 px (not bosses): 3 s bound and dragged 60 px back`},
 spearrain:{n:'Spears of Dorne',e:'🔱',v:[180,250,330,420,540],cd:40,ult:true,d:v=>`A spear for each of the 5 enemies closest to the gate: ${v} damage and pinned for 1 s (bosses are not pinned)`},
 serpentkiss:{n:"Serpent's Kiss",e:'💋',v:[20,28,36,45,55],cd:45,ult:true,d:v=>`Everything within 120 px is poisoned for ${v} a second over 5 s and cannot strike for 4 s (bosses still strike)`},
 vengeance:{n:'Vengeance and Justice',e:'☀️',v:[6,7,8,9,10],cd:55,ult:true,d:v=>`For ${v} s the door takes no damage; then every enemy on the field takes 1.5× what the door was spared`},
 redviper:{n:'The Red Viper',e:'🐍',v:[4,5,6,7,8],cd:40,ult:true,d:v=>`Leaps to the strongest enemy within 200 px and strikes it ${v} times at 150% damage, poisoning it deep`},
});
const KITS59={
 areo:['taunt','ironskin','iserve'], nymeria:['multishot','knock','whiplash'], obara:['pierce','sunder','spearrain'],
 tyene:['poison','viper','serpentkiss'], doran:['sunaura','waitstrike','vengeance'], ellaria:['poison','slowaura','cloud'], oberyn:['viper','crit','redviper'],
};
for(const id in KITS59)if(CBY[id])CBY[id].sk=KITS59[id].slice();
Object.assign(TALENTS,{
 areo:[{n:'Captain of the Guard',k:'block',v:1,sc:1},{n:'Longaxe',k:'dmg',v:0.11,sc:1}],
 nymeria:[{n:'Lady Nym',k:'rate',v:0.09,sc:1},{n:'A Whip Is a Kind of Kiss',k:'skillmult',sk:'knock',v:0.15,sc:1}],
 obara:[{n:"My Father's Spear",k:'range',v:0.09,sc:1},{n:'First of the Sand Snakes',k:'skillmult',sk:'sunder',v:0.15,sc:1}],
 tyene:[{n:"Poison Is a Woman's Weapon",k:'skillmult',sk:'viper',v:0.15,sc:1},{n:'The Long Farewell',k:'skillmult',sk:'poison',v:0.15,sc:1}],
 doran:[{n:'Sunspear Stands',k:'skillmult',sk:'sunaura',v:0.15,sc:1},{n:'Patience of Dorne',k:'cdr',v:0.12,sc:1}],
 ellaria:[{n:'Sweet Revenge',k:'skillmult',sk:'poison',v:0.15,sc:1},{n:'Breathe It In',k:'skillmult',sk:'cloud',v:0.11,sc:1}],
 oberyn:[{n:"The Red Viper's Venom",k:'skillmult',sk:'viper',v:0.15,sc:1},{n:'Say Her Name',k:'skillmult',sk:'crit',v:0.15,sc:1}],
});
