// v1.1.8: a Scorpion tower no longer washes the whole battle map out (its loading glow used an unbounded size once the tower had been idle).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const lum = {};
  for (const type of ['watch', 'scorp']) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
    p.on('pageerror', e => errors.push('PE:' + e.message));
    await p.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
    await p.waitForFunction(() => window.HOLDOR && window.HOLDOR_TUT, { timeout: 20000 }); await p.waitForTimeout(300);
    await p.evaluate((ty) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = {};
      const L = window.HOLDOR_TUT.LESSONS; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
      for (let i = 1; i <= 40; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); const G = H.G; G.gold = 3000;
      G.map.slots.slice(0, 4).forEach(s => H.build(s, ty)); G.speed = 2; H.callWave(); }, type);
    await p.waitForTimeout(8000);
    const buf = await p.screenshot({ clip: { x: 0, y: 100, width: 390, height: 400 } });
    lum[type] = await p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4); }, buf.toString('base64'));
    await p.close();
  }
  ok('four Scorpions do not brighten the map more than four Watchtowers (within 15 %)', lum.scorp < lum.watch * 1.15, JSON.stringify(lum));
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
