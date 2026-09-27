// Menu mini-tours: first chest, Hold opens, a new champion; plus the settings buttons.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 430, height: 766 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'))); await page.waitForFunction(() => window.HOLDOR_TUT, { timeout: 20000 }); await page.waitForTimeout(300);
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 1; for (let i = 1; i <= 3; i++) a.campaign[i] = 3; H.setAcc(a); H.persist(); H.showHub('battle'); });
  const seen = []; let shot = 0;
  for (let round = 0; round < 3; round++) {
    await page.waitForTimeout(900);
    for (let g = 0; g < 20; g++) {
      const c = await page.evaluate(() => { const C = window.HOLDOR_TUT.COACH; if (!C.on) return null; const st = C.steps[C.i], el = document.querySelector('#coach'); return { i: C.i, tap: !!st.tap, shown: !!C.tgt && !el.classList.contains('wait'), txt: el.querySelector('.cbub p').textContent.slice(0, 50), cer: !!document.querySelector('#cer') && document.querySelector('#cer').innerHTML !== '' }; });
      const tm = await page.evaluate(() => !!document.querySelector('.tutm'));
      if (tm) { seen.push('hold intro modal'); for (let k = 0; k < 5 && await page.evaluate(() => !!document.querySelector('#tutN')); k++) { await page.locator('#tutN').click(); await page.waitForTimeout(200); } continue; }
      if (!c) break;
      if (c.cer) { // the chest ceremony: open, wait, collect
        await page.locator('#cch').click({ force: true }).catch(() => {}); await page.waitForTimeout(5200); await page.locator('#ccol').click({ force: true }).catch(() => {}); await page.waitForTimeout(600); continue; }
      if (!c.shown) { await page.waitForTimeout(250); continue; }
      seen.push(`r${round} ${c.i}${c.tap ? ' tap' : ' next'}: ${c.txt}`); await page.screenshot({ path: SC + 'th_' + (shot++) + '.png' });
      if (c.tap) { const r = await page.evaluate(() => { const q = window.HOLDOR_TUT.COACH.tgt.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }); await page.touchscreen.tap(r.x, r.y); }
      else await page.locator('#coach .cnext').tap();
      await page.waitForTimeout(500);
      const cer = await page.evaluate(() => !!document.querySelector('#cer') && document.querySelector('#cer').innerHTML !== '');
      if (cer) { await page.locator('#cch').click({ force: true }).catch(() => {}); await page.waitForTimeout(5500); await page.locator('#ccol').click({ force: true }).catch(() => {}); await page.waitForTimeout(700); }
    }
    await page.evaluate(() => window.HOLDOR.showHub('battle'));
  }
  const learn = await page.evaluate(() => Object.keys(window.HOLDOR.ACC.learn).sort().join(','));
  // settings: the two new buttons
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#hubAva').click()); await page.waitForTimeout(300);
  await page.screenshot({ path: SC + 'th_settings.png' });
  await page.locator('#bLearn').click(); await page.waitForTimeout(200);
  const afterReset = await page.evaluate(() => ({ learn: Object.keys(window.HOLDOR.ACC.learn).length, label: document.querySelector('#bLearn').textContent.trim() }));
  await page.locator('#bTut').click(); await page.waitForTimeout(600);
  const replay = await page.evaluate(() => ({ state: window.HOLDOR.G.state, tutorial: window.HOLDOR.G.tutorial, step: window.HOLDOR_TUT.TS() ? window.HOLDOR.G.tut.i : null, tour: window.HOLDOR.ACC.tour }));
  console.log(JSON.stringify({ seen, learn, afterReset, replay }, null, 1)); console.log('ERR', errors);
  await browser.close();
})();
