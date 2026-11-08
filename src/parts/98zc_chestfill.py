# chest150 — a +100 gold that stands in for a card stack (the pool ran short: v1.4.9 cardPool / the server's ec_pool) carries fill:1,
# so the chest scene (chest145.js) can say why. The local roll (61_econ) and the server's fills (63_cards) alike; nothing else changes.
rep("else{nf++;addGold(100);out.push({k:'gold',n:'Gold',s:'+100',r:0});}", "else{nf++;addGold(100);out.push({k:'gold',n:'Gold',s:'+100',r:0,fill:1});}", 1, 'chest-fill-flag')
rep("for(let i=0;i<(R.fills||0);i++)out.push({k:'gold',n:'Gold',s:'+100',r:0});", "for(let i=0;i<(R.fills||0);i++)out.push({k:'gold',n:'Gold',s:'+100',r:0,fill:1});", 1, 'chest-fill-flag-server')
