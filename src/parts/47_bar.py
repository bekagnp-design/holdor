# v1.0.46 — one row of battle buttons (champion, skill, three spells) instead of two:
# ~46 px more height for the battlefield, so the map, towers and the ring stay big on phones.
rep("#bar{height:120px;flex:0 0 120px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:5px;padding:6px 7px}",
    "#bar{height:74px;flex:0 0 74px;border-top:1px solid var(--line);display:flex;flex-direction:row;gap:6px;padding:6px}", 1, 'bar-row')
rep(".brow{flex:1;min-height:0;display:flex;gap:6px}", ".brow{flex:3;min-width:0;display:flex;gap:5px}#rowHero{flex:2.35}", 1, 'brow')
rep("#hCard{flex:1.55;", "#hCard{flex:1.35;", 1, 'hcard')
# tutorial words that talked about rows
rep("' on the bottom row'", "' at the bottom'", 1, 'tut-row1')
rep("{t:'The second row holds the spells of your house. For now you have one: Arrow rain, a volley from the wall. Tap it, then tap the road.'",
    "{t:'Next to your champion wait the spells of your house. For now you have one: Arrow rain, a volley from the wall. Tap it, then tap the road.'", 1, 'tut-row2')
rep("hint:'Tap 1× at the bottom right'", "hint:'Tap 1× at the top right'", 1, 'tut-speed')
hrep("<small>the second row in battle</small>", "<small>the spell buttons in battle</small>", 1, 'hub-row')
