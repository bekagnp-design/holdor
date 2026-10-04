# v1.0.96 — battle fx: hits land (the flash takes the blow's colour, sparks, merged damage numbers), deaths burst by kind,
# projectile trails, tower recoil + muzzle smoke, the gate jolts and sheds splinters, ambient life per biome (src/mod/fxbattle.js).
# Display only; the module wraps kill / hitDoor / drawTower / drawCloudShadows / drawAmbient (plain declarations in this script).
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('fxbattle.js').rstrip('\n') + '\n' + s[i:]
rep("for(const p of G.projs)drawProj(p);", "fxbUnder(now);for(const p of G.projs)drawProj(p);", 1, 'fxb-under')
rep("for(const f of G.fx)drawFx(f,now);", "for(const f of G.fx)drawFx(f,now);fxbOver(now);", 1, 'fxb-over')
rep("if(hit&&wh){ctx.globalAlpha=0.7;ctx.drawImage(wh,", "if(hit&&wh){ctx.globalAlpha=0.7;ctx.drawImage(fxbTint(e,wh),", 2, 'fxb-tint')
rep("const shakeX=stress?Math.sin(now/35)*Math.min(3,stress):0;", "const shakeX=(stress?Math.sin(now/35)*Math.min(3,stress):0)+fxbGateKick(now);", 1, 'fxb-gatekick')
