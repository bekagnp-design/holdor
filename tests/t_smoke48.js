const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|net::|supabase/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CARDS, { timeout: 20000 });
  const r = await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CARDS; const a = H.newAccount('stark', 0, 'squire'); return { ver: H.VERSION, acc: { cards: a.cards, axp: a.axp, lv48: a.lv48, tours: a.tours }, need: [1, 5, 10, 19].map(l => C.cardNeed('c:jon', l)), needT: [1, 8, 15].map(l => C.cardNeed('t:weir', l)), lvl: C.accLevel(a) }; });
  console.log(JSON.stringify(r)); console.log('ERR', errors); await browser.close();
})();
