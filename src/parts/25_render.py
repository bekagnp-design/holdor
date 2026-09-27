# ---- battlefield: smooth roads, smart build spots, painted ground, water, props, light, ambience ----
i = s.find('const BIOMES={'); j = s.find('const POOLS={', i); assert 0 < i < j
s = s[:i] + mod('biomes.js') + s[j:]
i = s.find('function buildMap(o){'); j = s.find('function ell(c,x,y,rx,ry)', i); assert 0 < i < j
s = s[:i] + mod('mapgen.js') + mod('buildmap.js') + s[j:]
i = s.find('function renderBg(map,rng){'); j = s.find('/* =========================== GAME STATE', i); assert 0 < i < j
s = s[:i] + mod('render.js') + '\n' + s[j:]
rep("for(const s of map.slots){if(s.tower)continue;ctx.fillStyle='rgba(143,211,255,0.05)';ell(ctx,s.x,s.y+3,15,7);ctx.setLineDash([3,4]);ctx.strokeStyle=G.sel===s?'#e3b661':'rgba(143,211,255,0.45)';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(s.x,s.y+3,15,7,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}",
    "for(const s of map.slots){if(s.tower)continue;drawPad(s,G.sel===s,now);}", label='pads')
rep("ctx.drawImage(map.bg,0,0,W,H);", "ctx.drawImage(map.bg,0,0,W,H);drawCloudShadows(now);", label='clouds')
rep("if(map.B.cold)drawSnow(now);", "drawAmbient(now);", label='amb')
rep("map=buildMap({pts:L.pts,routes:L.routes,gates:L.gates,raw:L.raw,seed:hash32('L'+L.id+(L.stage?'s'+L.stage:'')),biome:L.biome});",
    "map=buildMap({pts:L.pts,routes:L.routes,gates:L.gates,raw:L.raw,style:L.style,rg:L.rg,sea:L.sea,river:L.river,ponds:L.ponds,seed:hash32('L'+L.id+(L.stage?'s'+L.stage:'')),biome:L.biome});", label='campmap')
rep("map=buildMap({pts:gm.pts,seed,biome:gm.biome})", "map=buildMap({pts:gm.pts,seed,biome:gm.biome,raw:true,style:'bend'})", label='dailymap')
rep("SFX.amb(map.B&&map.B.cold?'wind':(map.biome==='ash'||map.biome==='city')?'rumble':'forest');",
    "SFX.amb(map.B&&map.B.cold||/desert|storm|sea/.test(map.biome)?'wind':(map.biome==='ash'||map.biome==='city')?'rumble':'forest');", label='sfxamb')
rep("const BIOME_E={snow:'❄️',wall:'🧱',forest:'🌲',swamp:'🐸',river:'🌊',mountain:'⛰️',ash:'🔥',city:'🏰',sea:'⚓',desert:'🏜️',reach:'🌿',storm:'🌩️'};",
    "const BIOME_E={snow:'❄️',wall:'🧊',forest:'🌲',swamp:'🐸',river:'🌊',mountain:'⛰️',vale:'🏔️',ash:'🔥',city:'🏰',sea:'⚓',coast:'🏖️',desert:'🏜️',reach:'🌹',storm:'🌩️'};", label='biomee')
