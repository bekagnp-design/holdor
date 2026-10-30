# v1.3.6 — every champion's blows look like him. src/mod/sig136.js
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('sig136.js').rstrip('\n') + '\n' + s[i:]
rep("function heroAfterHit(e,a){const h=G.hero;if(!h)return;", "function heroAfterHit(e,a){const h=G.hero;if(!h)return;try{heroSig(e);}catch(_){}", 1, 'sig-hook')
