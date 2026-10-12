# v1.1.5 — the Army, made clear: a champion strip, a 3D card, one big button, skills as short rows that open into their picture;
# the tower workshop the same way; the other houses' cards and the long explanations folded away. src/mod/army105.js + army105.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('army105.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('army105.css').rstrip('\n') + "\n</style>\n</head>", 1, 'army-css')
# Army → Champions: the house's champions, the other houses folded away
rep("""<div class="cgrid">${mine.map(c=>champCard(c)).join('')}</div>
    <div class="hh" style="margin-top:12px"><h2>Other houses</h2><small>ride for them from another seat</small></div><div class="cgrid">${others.map(c=>champCard(c)).join('')}</div>`;}""",
    """<div class="cgrid">${mine.map(c=>champCard(c)).join('')}</div>
    <button class="tgl" data-tog="others" style="margin-top:12px">Other houses · ride for them from another seat ›</button><div class="cgrid" data-tgt="others" hidden style="margin-top:8px">${others.map(c=>champCard(c)).join('')}</div>`;}""", 1, 'army-others')
rep("""<p class="m" style="font-size:11.5px;margin-top:8px">Tap a tower to level it up: cards from chests + gold (1–16, +3% a level). In battle, tiers open with stages held: II after 3, III after 8, IV after 15, V after 24.</p>`;}""",
    """<button class="tgl" data-tog="tinfo" style="margin-top:8px">ⓘ How towers level up ›</button><p class="m" data-tgt="tinfo" hidden style="font-size:12px;margin-top:6px">Cards from chests + gold (1–16, +3% a level). In battle, tiers open with stages held: II after 3, III after 8, IV after 15, V after 24.</p>`;}""", 1, 'army-tinfo')
rep("bind('.ccard[data-t]',b=>showTowerRoom(b.dataset.t));", "bind('.ccard[data-t]',b=>showTowerRoom(b.dataset.t));card.querySelectorAll('[data-tog]').forEach(b=>b.addEventListener('click',()=>{const t=card.querySelector('[data-tgt=\"'+b.dataset.tog+'\"]');if(t){t.hidden=!t.hidden;SFX.play('tap',50);}}));", 1, 'army-toggles')
