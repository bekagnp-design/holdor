// Final visual review: fresh player flow + key screens of a mid-campaign player, iPhone-sized.
const { chromium } = require('playwright');
const OUT = __dirname + '/rv/';
require('fs').mkdirSync(OUT, { recursive: true });
const VW = +(process.env.VW || 390), VH = +(process.env.VH || 844);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|net::|supabase/i.test(m.text())) errors.push('C:' + m.text()); });
  const shot = async (n) => { await page.waitForTimeout(450); await page.screenshot({ path: OUT + n + '.png' }); };
  const tapSel = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) return false; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(350); return true; };
  const vis = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; }, sel);
  const log = {};
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot('01_first_screen');
  log.first = await page.evaluate(() => ({ btns: [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.id + ':' + b.textContent.trim().slice(0, 30)).slice(0, 12) }));
  // mid-campaign player
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('lannister', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 1; a.learn = { glass: 1, keep: 1, tier2: 1, fire: 1, reinf: 1, scorp: 1, wild: 1, weir: 1, tier3: 1, tier4: 1, tier5: 1, gates: 1, big: 1, chest: 1, hold: 1, champ: 1 };
    for (let i = 1; i <= 17; i++) a.campaign[i] = i % 4 ? 3 : 2; a.gems = 340; H.setAcc(a); H.addGold(2600); H.persist(); if (H.G) { H.G.tut = null; H.G.state = 'menu'; } H.showHub('battle'); });
  await shot('04_hub_battle');
  log.hub = { bBattle: await vis('#bBattle'), tabs: await vis('.hubtabs'), top: await vis('.hubtop') };
  for (const t of ['events']) { if (await tapSel(`.hubtabs button[data-tab="${t}"]`)) await shot('05_tab_' + t); }
  await tapSel('.hubtabs button[data-tab="coll"]'); await tapSel('.subtabs button[data-sub="towers"]'); await shot('06_coll_towers');
  await page.evaluate(() => window.HOLDOR.showSettings()); await shot('07_settings');
  log.settings = await page.evaluate(() => document.body.textContent.match(/HOLDOR 1\.0\.\d+/) ? document.body.textContent.match(/HOLDOR 1\.0\.\d+/)[0] : null);
  await page.evaluate(() => window.HOLDOR.showCampaign && window.HOLDOR.showCampaign()); await shot('08_map');
  // a battle: stage 18 (boss, two gates), some towers, ring open
  await page.evaluate(() => { const H = window.HOLDOR; H.startGame({ mode: 'campaign', level: H.LEVELS[17] }); const G = H.G; G.gold = 3000;
    const fr = G.map.slots.slice(0, 5); const ty = ['watch', 'glass', 'keep', 'scorp', 'wild']; fr.forEach((s, i) => { H.build(s, ty[i]); }); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; for (let i = 0; i < 600 && G.state === 'play'; i++) { if (G.waveDone && H.canCall()) H.callWave(); H.step(); } });
  await shot('09_battle_mid');
  const p = await page.evaluate(() => { const G = window.HOLDOR.G, s = G.map.slots.find(x => !x.tower); const st = document.querySelector('#stage').getBoundingClientRect(); const R = window.HOLDOR_RING; const q = R.w2s(s.x, s.y); return { x: st.left + q.x, y: st.top + q.y }; });
  await page.touchscreen.tap(p.x, p.y); await shot('10_battle_ring');
  log.battle = await page.evaluate(() => { const G = window.HOLDOR.G; return { state: G.state, wave: G.wave, door: Math.round(G.doorHp), towers: G.map.slots.filter(s => s.tower).length, bar: (() => { const r = document.querySelector('#bar').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })(), vh: innerHeight }; });
  console.log(JSON.stringify(log, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
