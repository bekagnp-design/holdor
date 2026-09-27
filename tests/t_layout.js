// Layout inside the artifact viewer: 430×800 page with 34 px bottom safe area on :root.
const { chromium } = require('playwright');
const files = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const f of files) {
    const page = await browser.newPage({ viewport: { width: 430, height: 800 }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + f); await page.waitForFunction(() => window.HOLDOR, { timeout: 20000 }); await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; for (let i = 1; i <= 12; i++) a.campaign[i] = 2; a.sel = 'jon'; H.setAcc(a);
      H.startGame({ mode: 'campaign', level: H.LEVELS[12] }); await new Promise(r => setTimeout(r, 300));
      const q = s => { const e = document.querySelector(s).getBoundingClientRect(); return [Math.round(e.top), Math.round(e.bottom), Math.round(e.width)]; };
      return { body: q('body'), app: q('#app'), stage: q('#stage'), canvas: q('#c'), bar: q('#bar'), vh: innerHeight };
    });
    const bodyBottom = r.body[1];
    console.log(f.split('/').pop(), JSON.stringify(r), 'bar cut by', Math.max(0, r.bar[1] - bodyBottom), 'px', errors.length ? errors : '');
    await page.screenshot({ path: f.replace('.html', '_shot.png') });
    await page.close();
  }
  await browser.close();
})();
