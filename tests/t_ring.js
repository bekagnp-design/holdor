// Build ring: open on a pad, arm, confirm; tower ring: upgrade, sell, info, rally; tap elsewhere closes.
// usage: node t_ring.js [file]   (default: the game; pass the skeleton-wrapped artifact test page to check layout)
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const FILE = process.argv[2] || require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
const VW = +(process.env.VW || 430), VH = +(process.env.VH || 766);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto('file://' + FILE);
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_RING, { timeout: 20000 });
  await page.waitForTimeout(400);
  const out = {};
  // a player on stage 12 with every tower open
  out.setup = await page.evaluate(() => {
    const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 1; a.learn = {glass:1,keep:1,tier2:1,fire:1,reinf:1,scorp:1,wild:1,weir:1,tier3:1,tier4:1,tier5:1,gates:1,big:1,chest:1,hold:1,champ:1};
    for (let i = 1; i <= 30; i++) a.campaign[i] = 2; a.sel = 'jon'; H.setAcc(a);
    H.startGame({ mode: 'campaign', level: H.LEVELS[11] }); const G = H.G; G.gold = 5000;
    const app = document.querySelector('#app').getBoundingClientRect(), bar = document.querySelector('#bar').getBoundingClientRect();
    return { open: H.openTowers(), app: [Math.round(app.top), Math.round(app.bottom)], bar: [Math.round(bar.top), Math.round(bar.bottom)], inner: innerHeight, pad: getComputedStyle(document.documentElement).paddingBottom };
  });
  await page.waitForTimeout(300);
  const slotXY = async (pick) => page.evaluate((pick) => {
    const G = window.HOLDOR.G, R = window.HOLDOR_RING;
    const s = pick === 'free' ? G.map.slots.filter(x => !x.tower).sort((a, b) => Math.abs(a.x - 195) - Math.abs(b.x - 195))[0] : G.map.slots.find(x => x.tower && x.tower.type === pick) || G.map.slots.find(x => x.tower);
    const st = document.querySelector('#stage').getBoundingClientRect(), p = R.w2s(s.x, s.y);
    return { id: s.id, x: st.left + p.x, y: st.top + p.y };
  }, pick);
  const ring = () => page.evaluate(() => { const r = window.HOLDOR_RING.state(); if (!r) return null; return { slot: r.s.id, items: r.items.map(i => i.act + (i.k ? ':' + i.k : '')), arm: r.arm ? r.arm.act + (r.arm.k ? ':' + r.arm.k : '') : null, pending: window.HOLDOR.G.pending ? window.HOLDOR.G.pending.type : null, tip: document.querySelector('#ringTip').hidden ? null : document.querySelector('#ringTip').textContent, btns: [...document.querySelectorAll('#ring .rb')].map(b => { const q = b.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width)]; }) }; });
  // 1. tap a free pad → ring with every open tower
  let p = await slotXY('free'); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(350);
  out.r1 = await ring(); await page.screenshot({ path: SC + 'r1_ring.png' });
  // 2. tap the Keep icon → armed, ghost + tip
  const idx = out.r1.items.indexOf('build:keep');
  await page.locator('#ring .rb').nth(idx).tap(); await page.waitForTimeout(250);
  out.r2 = await ring(); await page.screenshot({ path: SC + 'r2_arm.png' });
  // 3. tap ✓ → built
  await page.locator('#ring .rb').nth(idx).tap(); await page.waitForTimeout(250);
  out.r3 = { ring: await ring(), tower: await page.evaluate((id) => { const s = window.HOLDOR.G.map.slots.find(x => x.id === id); return s.tower && s.tower.type + s.tower.lvl; }, p.id) };
  // 4. tap the tower → up / sell / info / rally
  p = await slotXY('keep'); await page.touchscreen.tap(p.x, p.y - 10); await page.waitForTimeout(300);
  out.r4 = await ring(); await page.screenshot({ path: SC + 'r4_tower.png' });
  // 5. upgrade: arm then confirm
  const ui = out.r4 ? out.r4.items.indexOf('up') : -1;
  if (ui >= 0) { await page.locator('#ring .rb').nth(ui).tap(); await page.waitForTimeout(200); out.r5a = await ring(); await page.screenshot({ path: SC + 'r5_up.png' }); await page.locator('#ring .rb').nth(ui).tap(); await page.waitForTimeout(200); }
  out.r5 = { ring: await ring(), lvl: await page.evaluate((id) => { const s = window.HOLDOR.G.map.slots.find(x => x.id === id); return s.tower && s.tower.lvl; }, p.id) };
  // 6. info → details sheet, visible on screen
  await page.touchscreen.tap(p.x, p.y - 10); await page.waitForTimeout(250);
  let r = await ring(); const ii = r ? r.items.indexOf('info') : -1;
  if (ii >= 0) { await page.locator('#ring .rb').nth(ii).tap(); await page.waitForTimeout(350); }
  out.r6 = await page.evaluate(() => { const sh = document.querySelector('#sheet'), q = sh.getBoundingClientRect(); return { open: sh.classList.contains('open'), top: Math.round(q.top), bottom: Math.round(q.bottom), vh: innerHeight, txt: sh.textContent.slice(0, 80) }; });
  await page.screenshot({ path: SC + 'r6_info.png' });
  await page.evaluate(() => window.HOLDOR_RING.closeSheet());
  // 7. rally: banner mode on
  await page.touchscreen.tap(p.x, p.y - 10); await page.waitForTimeout(250); r = await ring(); const ri = r ? r.items.indexOf('rally') : -1;
  if (ri >= 0) { await page.locator('#ring .rb').nth(ri).tap(); await page.waitForTimeout(150); }
  out.r7 = await page.evaluate(() => ({ armed: window.HOLDOR.G.armed, ring: !!window.HOLDOR_RING.state() }));
  await page.evaluate(() => { window.HOLDOR.G.armed = null; });
  // 8. sell: arm then confirm
  await page.touchscreen.tap(p.x, p.y - 10); await page.waitForTimeout(250); r = await ring(); const si = r ? r.items.indexOf('sell') : -1;
  const g0 = await page.evaluate(() => window.HOLDOR.G.gold);
  if (si >= 0) { await page.locator('#ring .rb').nth(si).tap(); await page.waitForTimeout(150); out.r8a = await ring(); await page.locator('#ring .rb').nth(si).tap(); await page.waitForTimeout(150); }
  out.r8 = await page.evaluate(([id, g0]) => { const G = window.HOLDOR.G, s = G.map.slots.find(x => x.id === id); return { tower: !!s.tower, gain: Math.round(G.gold - g0), ring: !!window.HOLDOR_RING.state() }; }, [p.id, g0]);
  // 9. poor: no gold → tip says so, nothing armed
  await page.evaluate(() => { window.HOLDOR.G.gold = 5; });
  p = await slotXY('free'); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(250);
  await page.locator('#ring .rb').nth(0).tap(); await page.waitForTimeout(150);
  out.r9 = await ring(); await page.screenshot({ path: SC + 'r9_poor.png' });
  // 10. tap empty ground → closes
  const st = await page.evaluate(() => { const q = document.querySelector('#stage').getBoundingClientRect(); return { x: q.left + 12, y: q.top + q.height / 2 }; });
  await page.touchscreen.tap(st.x, st.y); await page.waitForTimeout(150);
  out.r10 = await ring();
  // 11. near the edges: every button inside the stage
  out.r11 = await page.evaluate(() => { const G = window.HOLDOR.G, R = window.HOLDOR_RING, st = document.querySelector('#stage').getBoundingClientRect(); G.gold = 5000; const bad = [];
    for (const s of G.map.slots) { if (s.tower) continue; R.openRing(s); R.ringFrame(); for (const b of document.querySelectorAll('#ring .rb')) { const q = b.getBoundingClientRect(); if (q.left < st.left - 1 || q.right > st.right + 1 || q.top < st.top - 1 || q.bottom + 14 > st.bottom + 1) bad.push(s.id); } R.closeRing(); }
    return { slots: G.map.slots.length, bad: [...new Set(bad)] }; });
  console.log(JSON.stringify(out, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
