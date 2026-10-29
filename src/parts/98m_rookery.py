# v1.2.2 — the Rookery: ravens that hunt healers, summoners and flyers. src/mod/rookery122.js
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('rookery122.js').rstrip('\n') + '\n' + s[i:]
# the target loop prefers what keeps the host alive
rep("const v=e.fly?(t.type==='scorp'?1e9:-1e6+e.y):-remainOf(e);", "const v=t.type==='rook'?rookPri(e):(e.fly?(t.type==='scorp'?1e9:-1e6+e.y):-remainOf(e));", 1, 'rook-target')
# a raven hit silences
rep("}}else{dmg(p.tgt,p.dmg,p.src);if(p.mp)mstHit(p);}}", "}}else{dmg(p.tgt,p.dmg,p.src);if(p.mp)mstHit(p);if(p.src==='rook')rookHit(p);}}", 1, 'rook-hit')
rep("mstFire(t,s,st,best,def,_pr);}", "mstFire(t,s,st,best,def,_pr);if(t.type==='rook')_pr.sil=rookSilence(t);}", 1, 'rook-sil')
# silenced: no healing, no speeding up, no raising the dead
rep("if(e.healAura){e.hT=", "if(e.healAura&&!(e.silT>G.time)){e.hT=", 1, 'sil-heal')
rep("if(e.speedAura){const q=posE(e);", "if(e.speedAura&&!(e.silT>G.time)){const q=posE(e);", 1, 'sil-speed')
rep("if(e.raise){e.rT=", "if(e.raise&&!(e.silT>G.time)){e.rT=", 1, 'sil-raise')
rep("    if(e.lord){\n      e.raiseT=", "    if(e.lord&&!(e.silT>G.time)){\n      e.raiseT=", 1, 'sil-lord')
# the roost, drawn
rep("    case'watch':{const hgt=18+4*l,w=13+l;", "    case'rook':{rookDraw(t,l,now,x);break;}\n    case'watch':{const hgt=18+4*l,w=13+l;", 1, 'rook-draw')
