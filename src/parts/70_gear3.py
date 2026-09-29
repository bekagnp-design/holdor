# v1.0.63 — gear III: 54 kinds of item and special effects (perks). A perk is one of the game's skill mechanics granted by an item;
# the champion's skill rank for it is the best rank among the items he wears (or his own rank, if that is higher).
rep("sk:p.sk.slice(),lvl:L,", "sk:p.sk.slice(),perk:gearPerks(c.id),lvl:L,", 1, 'gear3-hero-perk')
rep("function skLvl(hero,id){const i=hero.c.sk.indexOf(id);return i<0?0:hero.sk[i];}",
    "function skLvl(hero,id){const i=hero.c.sk.indexOf(id);const l=i<0?0:hero.sk[i],pr=hero.perk&&hero.perk[id];return pr&&pr>l?pr:l;}", 1, 'gear3-sklvl')
rep("let v=SK[id].v[l-1];if(hero.tal&&hero.tal.k==='skillmult'", "let v=SK[id].v[Math.min(l,SK[id].v.length)-1];if(hero.tal&&hero.tal.k==='skillmult'", 1, 'gear3-skval')
