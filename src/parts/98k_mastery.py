# v1.2.0 — Mastery: after a tower's last level, two paths bought with gold. src/mod/mastery120.js + mastery120.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('mastery120.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('mastery120.css').rstrip('\n') + "\n</style>\n</head>", 1, 'mastery-css')
# a shot of a Mastery tower: extra arrows, crits, piercing, chill
rep("G.projs.push({x:s.x,y:s.y-14,tgt:best,lx:p.x,ly:p.y,spd:def.pspd,dmg:st.dmg,src:t.type,splash:def.kind==='splash'?st.splash:0,burn:st.burn,ang:t.face});",
    "{const _pr={x:s.x,y:s.y-14,tgt:best,lx:p.x,ly:p.y,spd:def.pspd,dmg:st.dmg,src:t.type,splash:def.kind==='splash'?st.splash:0,burn:st.burn,ang:t.face};G.projs.push(_pr);if(t.type==='watch'||t.type==='scorp')mstFire(t,s,st,best,def,_pr);}", 1, 'mst-fire')
rep("}}else dmg(p.tgt,p.dmg,p.src);}\n    }else{p.x+=dx/d*stepL;", "}}else{dmg(p.tgt,p.dmg,p.src);if(p.mp)mstHit(p);}}\n    }else{p.x+=dx/d*stepL;", 1, 'mst-hit')
