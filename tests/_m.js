const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const pg = await b.newPage({ viewport: { width: 430, height: 766 }, deviceScaleFactor: 2 });
  pg.on('pageerror', e => console.log('PE', e.message));
  await pg.goto('file:///home/user/holdor/beta/index.html'); await pg.waitForFunction(() => window.HOLDOR_TUT);
  const r = await pg.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_TUT, G = H.G; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; H.setAcc(a); H.startGame({ mode: 'campaign', level: X.TUT_LEVEL || H.LEVELS[0], tutorial: 1 });
    const R0 = G.map.routes[0]; const s = X.tutSlot();
    const out = { routeLen: Math.round(R0.total), slots: G.map.slots.map(s => [Math.round(s.x), Math.round(s.y)]), slot: [Math.round(s.x), Math.round(s.y)] };
    return out; });
  console.log(JSON.stringify(r)); await pg.waitForTimeout(600); await pg.screenshot({ path: '.shots/tutmap.png' }); await b.close(); })();
