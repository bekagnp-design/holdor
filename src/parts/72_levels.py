# v1.0.65 — the account level goes on to 60; the milestone gifts (every 10th level) live on the Daily screen's Levels tab (backend v13).
rep("function accLevel(a){let xp=accXp(a),l=1;while(l<40&&xp>=xpNeed(l))", "function accLevel(a){let xp=accXp(a),l=1;while(l<60&&xp>=xpNeed(l))", 1, 'level-cap-60')
