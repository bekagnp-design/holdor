// Smoke: every one of the 49 champions rides a real campaign battle (waves called, ultimates on cooldown) — no exceptions.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CH53, { timeout: 20000 });
  const out = await page.evaluate(() => {
    const H = window.HOLDOR, G = H.G, res = [];
    const stages = [3, 9, 14, 22, 30, 38, 44, 49];
    H.CHAMPS.forEach((c, n) => {
      const a = H.newAccount(c.house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 50; i++) a.campaign[i] = 3; a.copen = {}; a.copen[c.id] = 1; a.sel = c.id; a.champs[c.id] = { lvl: 14, sk: [4, 4, 4], tal: 2 }; a.army = { lvl: 6 }; a.tlv = { watch: 8, glass: 8, keep: 8, scorp: 8, wild: 8, weir: 8 }; H.setAcc(a);
      const lv = stages[n % stages.length]; H.startGame({ level: lv }); G.gold = 3000;
      // a few towers on the first pads
      const kinds = ['watch', 'glass', 'keep', 'scorp', 'wild', 'weir'];
      G.map.slots.slice(0, 6).forEach((s, i) => { s.tower = { type: kinds[i % kinds.length], lvl: 3, cd: 0, invested: 200, face: 0 }; });
      let ults = 0, t0 = performance.now();
      for (let i = 0; i < 1500 && G.state === 'play'; i++) {
        if (G.waveDone && H.canCall && H.canCall()) H.callWave();
        if (i % 250 === 120 && G.hero && !G.hero.dead && G.hero.cd.ult <= 0) { H.castUlt(); ults++; }
        if (i % 400 === 200) { G.powerCd.reinf = 0; H.castPower('reinf'); }
        H.step();
      }
      res.push({ id: c.id, lv, wave: G.wave, state: G.state, kills: G.kills, ults, ms: Math.round(performance.now() - t0) });
    });
    return res; });
  const slow = out.filter(r => r.ms > 4000);
  console.log(out.map(r => `${r.id}@${r.lv}: w${r.wave} ${r.state} k${r.kills} u${r.ults} ${r.ms}ms`).join('\n'));
  console.log('champions', out.length, 'slow', JSON.stringify(slow));
  console.log('ERR', errors);
  await browser.close();
})();
