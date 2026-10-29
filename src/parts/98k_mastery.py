# v1.2.0 — Mastery: after a tower's last level, two paths bought with gold. src/mod/mastery120.js + mastery120.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('mastery120.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('mastery120.css').rstrip('\n') + "\n</style>\n</head>", 1, 'mastery-css')
# a shot of a Mastery tower: extra arrows, crits, piercing, chill
rep("G.projs.push({x:s.x,y:s.y-14,tgt:best,lx:p.x,ly:p.y,spd:def.pspd,dmg:st.dmg,src:t.type,splash:def.kind==='splash'?st.splash:0,burn:st.burn,ang:t.face});",
    "{const _pr={x:s.x,y:s.y-14,tgt:best,lx:p.x,ly:p.y,spd:def.pspd,dmg:st.dmg,src:t.type,splash:def.kind==='splash'?st.splash:0,burn:st.burn,ang:t.face};G.projs.push(_pr);mstFire(t,s,st,best,def,_pr);}", 1, 'mst-fire')
rep("}}else dmg(p.tgt,p.dmg,p.src);}\n    }else{p.x+=dx/d*stepL;", "}}else{dmg(p.tgt,p.dmg,p.src);if(p.mp)mstHit(p);}}\n    }else{p.x+=dx/d*stepL;", 1, 'mst-hit')

# v1.2.3: stats of the five other towers, per-step pulses, Wildfire burning and pools, Dragonglass multiplier
rep("function towerStats(t,ML){", "function towerStats(t,ML){return mstStats(t,towerStats0(t,ML));}\nfunction towerStats0(t,ML){", 1, 'mst-stats')
rep("  const rangeM=(G.mod&&G.mod.range)||1;\n  const alive=G.heroOn&&!h.dead;", "  const rangeM=(G.mod&&G.mod.range)||1;\n  mstTick(dt);\n  const alive=G.heroOn&&!h.dead;", 1, 'mst-tick')
rep("dmg(e,st.dps*dt*(e.walker?3:1),'glass');", "dmg(e,st.dps*dt*(e.walker?(st.wm||3):1),'glass');", 1, 'mst-glass')
rep("if(p.burn&&e.hp>0)e.burn={dps:p.burn,t:3};}}addFx({t:'ring',x:p.lx,y:p.ly,r0:6,r1:p.splash+6", "if(p.burn&&e.hp>0)e.burn={dps:p.burn,t:p.bt||3};}}if(p.pool)G.clouds.push({x:p.lx,y:p.ly,dps:p.pool.d,t:p.pool.t});addFx({t:'ring',x:p.lx,y:p.ly,r0:6,r1:p.splash+6", 1, 'mst-wild')

# v1.2.8: the Mastery marks in battle
rep("ctx.lineTo(x-10+i*4,y+15.5);ctx.closePath();ctx.fill();}\n}", "ctx.lineTo(x-10+i*4,y+15.5);ctx.closePath();ctx.fill();}\n  mstMark(t,x,y);\n}", 1, 'mst-mark')
