// New player: title → seat → house → ... → first battle, by real taps. Logs every screen.
const { chromium } = require('playwright');
const OUT = __dirname + '/rv/';
const VW = +(process.env.VW || 390), VH = +(process.env.VH || 844);
const PLAN = (process.env.PLAN || '').split(',').filter(Boolean); // optional forced selectors per step
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|net::|supabase/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR, { timeout: 20000 });
  await page.waitForTimeout(1200);
  const screen = () => page.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const h = [...document.querySelectorAll('h1,h2,.ttl,.title')].filter(vis).map(e => e.textContent.trim().slice(0, 40)).slice(0, 3);
    const btns = [...document.querySelectorAll('button,[data-house],[data-i],.pick,.opt')].filter(e => vis(e) && !e.disabled).map(e => {
      const r = e.getBoundingClientRect();
      return { sel: e.id ? '#' + e.id : (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + (e.dataset.i ? `[data-i="${e.dataset.i}"]` : '') + (e.dataset.house ? `[data-house="${e.dataset.house}"]` : '') + (e.dataset.l ? `[data-l="${e.dataset.l}"]` : '') + (e.dataset.d ? `[data-d="${e.dataset.d}"]` : '')), t: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30), y: Math.round(r.top) };
    });
    return { state: window.HOLDOR.G && window.HOLDOR.G.state, tut: !!(window.HOLDOR.G && window.HOLDOR.G.tut), acc: !!window.HOLDOR.ACC, h, btns: btns.slice(0, 14) };
  });
  const tapAt = async (sel) => { const loc = page.locator(sel).first(); const b = await loc.boundingBox(); if (!b) return false; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return true; };
  const tapXY = async (x, y) => { await page.touchscreen.tap(x, y); };
  const steps = [];
  for (let k = 0; k < 14; k++) {
    const s = await screen();
    await page.screenshot({ path: OUT + 'nf_' + String(k).padStart(2, '0') + '.png' });
    steps.push({ k, ...s });
    if (s.state === 'play' && s.tut) break;
    let target = PLAN[k] || null;
    if (!target) {
      const pri = [/^#bPick/, /^#bGo/, /seat/, /rrow/, /hrow/, /hpick/, /card\.house/, /house/, /^#bHouse/, /lang/, /^#bLang/, /diff/, /^#bNext/, /^#bOk/, /^#bStart/, /^#bPlay/, /^#bBegin/, /^#bBattle/, /^#bTutGo/, /\.go/];
      for (const re of pri) { const b = s.btns.find(b => re.test(b.sel) && !/back|close|cred|#bInfo|#bSpeed|#bPause|#bUlt|#bP\d|#bX/i.test(b.sel)); if (b) { target = b.sel; break; } }
    }
    if (!target && k === 0) { await tapXY(VW / 2, VH * 0.5); await page.waitForTimeout(900); continue; }
    if (!target) { const b = s.btns.find(b => !/back|close|cred|ach|realm|#bInfo|#bSpeed|#bPause|#bUlt|#bP\d|#bX/i.test(b.sel + b.t)); if (!b) break; target = b.sel; }
    steps[steps.length - 1].tap = target;
    const ok = await tapAt(target); if (!ok) { steps[steps.length - 1].tapFail = true; await tapXY(VW / 2, VH * 0.5); }
    await page.waitForTimeout(900);
  }
  const fin = await page.evaluate(() => { const H = window.HOLDOR, A = H.ACC; return A ? { house: A.house, langI: A.langI, diff: A.diff, sel: A.sel, tut: A.tut, tour: A.tour, lv47: A.lv47, state: H.G.state, tutorial: !!H.G.tutorial, step: H.G.tut && H.G.tut.i } : null; });
  for (const s of steps) console.log(s.k, JSON.stringify({ st: s.state, tut: s.tut, h: s.h, tap: s.tap, fail: s.tapFail, btns: s.btns.map(b => b.sel + '|' + b.t) }));
  console.log('FIN', JSON.stringify(fin));
  console.log('ERR', errors);
  await browser.close();
})();
