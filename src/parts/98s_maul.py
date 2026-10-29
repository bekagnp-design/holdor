# v1.3.2 — the Siege maul, an eighth tower. src/mod/maul132.js
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('maul132.js').rstrip('\n') + '\n' + s[i:]
rep("mstFire(t,s,st,best,def,_pr);if(t.type==='rook')_pr.sil=rookSilence(t);}", "mstFire(t,s,st,best,def,_pr);if(t.type==='rook')_pr.sil=rookSilence(t);if(t.type==='maul')_pr.stun=maulStun();}", 1, 'maul-fire')
rep("if(p.pool)G.clouds.push({x:p.lx,y:p.ly,dps:p.pool.d,t:p.pool.t});", "if(p.pool)G.clouds.push({x:p.lx,y:p.ly,dps:p.pool.d,t:p.pool.t});if(p.stun)maulHit(p);", 1, 'maul-hit')
rep("    case'rook':{rookDraw(t,l,now,x);break;}\n", "    case'rook':{rookDraw(t,l,now,x);break;}\n    case'maul':{maulDraw(t,l,now,x);break;}\n", 1, 'maul-draw')
rep("r1:p.splash+6,life:0.35,col:'#7cff6b'});addFx({t:'fire',x:p.lx,y:p.ly,r0:6,r1:p.splash*0.8,life:0.35,col:'#7cff6b'});}", "r1:p.splash+6,life:0.35,col:p.src==='maul'?'#e3b661':'#7cff6b'});addFx({t:'fire',x:p.lx,y:p.ly,r0:6,r1:p.splash*0.8,life:0.35,col:p.src==='maul'?'#e3b661':'#7cff6b'});}", 1, 'maul-fx')
