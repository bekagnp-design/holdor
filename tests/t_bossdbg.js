const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await b.newPage();
  await p.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'))); await p.waitForFunction(() => window.HOLDOR_TUT);
  const r = await p.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_TUT; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 1; for (let i = 1; i <= 15; i++) a.campaign[i] = 2; a.learn = {}; for (const k in X.LESSONS) if (k !== 'boss') a.learn[k] = 1; H.setAcc(a);
    H.startGame({ mode: 'campaign', level: H.LEVELS[15] }); const G = H.G; G.doorMax = G.doorHp = 1e9; const L = H.LEVELS[15];
    const out = { boss: L.boss, waves: L.waves, lq: G.lq.slice() }; const seen = [];
    for (let i = 0; i < 60000 && G.state === 'play'; i++) { if (G.tut) { out.tutAt = { i, wave: G.wave, key: G.tut.key }; break; } if (G.waveDone && H.canCall()) H.callWave(); H.step(); if (i % 3000 === 0) seen.push(`${i}:w${G.wave}/${G.totalWaves} e${G.enemies.length} b${G.enemies.some(e => e.boss) ? 1 : 0} p${G.paused ? 1 : 0}`); }
    out.seen = seen; out.end = { wave: G.wave, state: G.state, bossAlive: G.enemies.some(e => e.boss && e.hp > 0), types: [...new Set(G.enemies.map(e => e.type))].slice(0, 12) }; return out; });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
