# v1.1.0 — house troops: every house its own soldiers (four roles, house colours and silhouettes); the Train room picks who holds the
# Watch keeps; archers shoot from 95 px, riders are fast, the house units keep their tricks. src/mod/troops.js + troops.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('troops.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('troops.css').rstrip('\n') + "\n</style>\n</head>", 1, 'troops-css')
# a keep's soldier is dressed in the chosen role of the house
rep("spd:64,leash:54,bornT:G.time});", "spd:64,leash:54,bornT:G.time});troopDress(G.allies[G.allies.length-1]);", 1, 'keep-dress')
# archers reach further; every blow goes through allyStrike (the arrow, the house tricks); the Rose Knight mends
rep("if(d<=26+e.r&&d<td){td=d;tgt=e;}", "if(d<=(a.range||26)+e.r&&d<td){td=d;tgt=e;}", 1, 'ally-range')
rep("a.strikeT=G.time;dmg(tgt,a.dmg*(1+dv/100)*(G.musterUntil>G.time?1.5:1),'ally');}continue;}",
    "a.strikeT=G.time;allyStrike(a,tgt,a.dmg*(1+dv/100)*(G.musterUntil>G.time?1.5:1));}continue;}", 1, 'ally-strike')
rep("a.t-=dt;a.atkT-=dt;if(a.bornT!=null&&G.time<a.bornT)continue;if(a.stunT>0){a.stunT-=dt;continue;}",
    "a.t-=dt;a.atkT-=dt;if(a.bornT!=null&&G.time<a.bornT)continue;if(a.stunT>0){a.stunT-=dt;continue;}if(a.mend)troopMend(a,dt);", 1, 'ally-mend')
# the Lion Guard takes half, the Unsullied never flinch
rep("blocker.hp-=bd;blocker.hitT=G.time;if(e.knock)blocker.stunT=1.5;",
    "if(blocker.armor)bd*=blocker.armor;blocker.hp-=bd;blocker.hitT=G.time;if(e.knock&&!blocker.steady)blocker.stunT=1.5;", 1, 'ally-armor')
# a soldier with a role is drawn as his house's troop
rep("drawAllyBody(a,now);ctx.restore();", "if(a.role)drawTroopBody(ctx,a,now);else drawAllyBody(a,now);ctx.restore();", 1, 'troop-draw')
