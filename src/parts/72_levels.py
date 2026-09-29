# v1.0.65 — the account level goes on to 60; the milestone gifts (every 10th level) live on the Daily screen's Levels tab (backend v13).
rep("function accLevel(a){let xp=accXp(a),l=1;while(l<40&&xp>=xpNeed(l))", "function accLevel(a){let xp=accXp(a),l=1;while(l<60&&xp>=xpNeed(l))", 1, 'level-cap-60')

# an invited player joins his friend after login (backend v14)
rep("CLOUD.on=true;CLOUD.token=r.token;CLOUD.tg_id=r.tg_id;CLOUD.name=r.name;CLOUD.ver=r.save_ver||0;CLOUD.lastErr=null;", "CLOUD.on=true;CLOUD.token=r.token;CLOUD.tg_id=r.tg_id;CLOUD.name=r.name;CLOUD.ver=r.save_ver||0;CLOUD.lastErr=null;refJoinFromStart();", 1, 'ref-join')
