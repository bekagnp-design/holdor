# v1.3.0 — the champion grows during the battle. src/mod/champ130.js
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('champ130.js').rstrip('\n') + '\n' + s[i:]
rep("  mstTick(dt);\n", "  mstTick(dt);champTick();\n", 1, 'champ-tick')
rep("$('#hKills').textContent='⚔️ '+G.kills;", "$('#hKills').textContent='⚔️ '+G.kills+(G.hLv?' · ⭐'+(G.hLv+1):'');", 1, 'champ-hud')
rep("  G.learnAsk=null;G.learnDone={};G.learned=[];G.learnRr=0;\n", "  G.learnAsk=null;G.learnDone={};G.learned=[];G.learnRr=0;G.hLv=0;G.synDone={};\n", 1, 'champ-reset')
