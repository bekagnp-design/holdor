// Lessons on unlock, played through real taps.  usage: node t_lessons.js <scenario> [shots]
//  A: 4 stages held → stage 5: Dragonglass, Keep + banner, tier II, Dracarys
//  B: 13 held → stage 14 (two gates): Hodor lesson            C: 15 held → stage 16 (boss): Brothers + boss
//  M: an old save (tut done, no lv47) → migration marks lessons as known, no tour
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const SCN = process.argv[2] || 'A', SHOTS = process.argv[3] === 'shots';
const CFG = { A: { held: 4, stage: 5, keep: [] }, B: { held: 13, stage: 14, keep: ['gates'] }, C: { held: 15, stage: 16, keep: ['reinf', 'big'], tough: 1 } };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 430, height: 766 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_TUT, { timeout: 20000 }); await page.waitForTimeout(300);
  if (SCN === 'M') {
    const r = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_TUT; const a = H.newAccount('stark', 0, 'squire'); delete a.lv47; delete a.learn; delete a.tour; a.tut = 1; a.intro = 1; for (let i = 1; i <= 9; i++) a.campaign[i] = 2; X.migrate47(a);
      const b = H.newAccount('stark', 0, 'squire'); delete b.lv47; delete b.learn; delete b.tour; b.tut = 0; X.migrate47(b);
      const c = H.newAccount('stark', 0, 'squire');
      return { old: { tour: a.tour, learn: Object.keys(a.learn).sort().join(',') }, oldNew: { tour: b.tour, learn: Object.keys(b.learn).length, tut: b.tut }, fresh: { tour: c.tour, lv47: c.lv47, learn: Object.keys(c.learn).length } }; });
    console.log(JSON.stringify(r, null, 1)); console.log('ERR', errors); await browser.close(); return;
  }
  const cfg = CFG[SCN];
  await page.evaluate((cfg) => { const H = window.HOLDOR, X = window.HOLDOR_TUT; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 1; a.sel = 'jon';
    for (let i = 1; i <= cfg.held; i++) a.campaign[i] = 2; a.learn = {};
    if (cfg.keep.length) for (const k in X.LESSONS) if (cfg.keep.indexOf(k) < 0) a.learn[k] = 1;
    H.setAcc(a); H.persist(); H.startGame({ mode: 'campaign', level: H.LEVELS[cfg.stage - 1] }); if (cfg.tough) { H.G.doorMax = H.G.doorHp = 1e9; } }, cfg);
  const q0 = await page.evaluate(() => window.HOLDOR.G.lq.slice());
  const T = () => page.evaluate(() => { const X = window.HOLDOR_TUT, G = window.HOLDOR.G, st = X.TS(); return st ? { key: G.tut.key, i: G.tut.i, want: st.want || null, hold: !!G.tut.hold, ring: !!window.HOLDOR_RING.state(), armed: G.armed, paused: G.paused } : { none: true, state: G.state, lq: (G.lq || []).slice() }; });
  const tapWorld = async (x, y) => { const p = await page.evaluate(([x, y]) => { const q = document.querySelector('#stage').getBoundingClientRect(), s = window.HOLDOR_RING.w2s(x, y); return { x: q.left + s.x, y: q.top + s.y }; }, [x, y]); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(200); };
  const tapEl = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(220); };
  const ff = (n) => page.evaluate((n) => { const H = window.HOLDOR, G = H.G; for (let i = 0; i < n && G.state === 'play' && !G.paused && !G.tut; i++) { if (G.waveDone && H.canCall()) H.callWave(); H.step(); } }, n);
  const log = []; let guard = 0, shot = 0, idle = 0;
  while (guard++ < 400) {
    const t = await T();
    if (t.none) { if (t.state !== 'play' || !t.lq.length) break; idle++; await ff(90); await page.waitForTimeout(40); continue; }
    log.push(`${t.key}.${t.i}:${t.want || 'hold'}`);
    if (SHOTS) { await page.waitForTimeout(200); await page.screenshot({ path: SC + `tl${SCN}_` + String(shot++).padStart(2, '0') + '.png' }); }
    if (t.hold) { await tapWorld(195, 420); continue; }
    const [w, arg] = t.want.split(':');
    if (w === 'build') { if (!t.ring) { const s = await page.evaluate(() => { const G = window.HOLDOR.G; const s = G.map.slots.filter(x => !x.tower).sort((a, b) => b.y - a.y)[0]; return { x: s.x, y: s.y }; }); await tapWorld(s.x, s.y); }
      await tapEl('#ring .rb.tgo'); if (SHOTS) await page.screenshot({ path: SC + `tl${SCN}_` + String(shot++).padStart(2, '0') + '.png' }); await tapEl('#ring .rb.arm'); continue; }
    if (w === 'rally') { if (t.armed === 'rally') { const r = await page.evaluate(() => { const G = window.HOLDOR.G, H = window.HOLDOR, R = G.map.routes[0]; const k = G.map.slots.find(s => s.tower && s.tower.type === 'keep'); let best = null, bd = 1e9; for (let d = 20; d < R.total; d += 10) { const p = H.posAt(G.map, d, R.i); const dd = Math.hypot(p.x - k.x, p.y - k.y); if (dd < bd && dd > 30) { bd = dd; best = p; } } return best; }); await tapWorld(r.x, r.y); continue; }
      if (!t.ring) { const k = await page.evaluate(() => { const s = window.HOLDOR.G.map.slots.find(s => s.tower && s.tower.type === 'keep'); return { x: s.x, y: s.y - 10 }; }); await tapWorld(k.x, k.y); } await tapEl('#ring .rb.tgo'); continue; }
    if (w === 'upgrade') { if (!t.ring) { const k = await page.evaluate(() => { const s = window.HOLDOR.G.map.slots.find(s => s.tower && s.tower.lvl < 2); return { x: s.x, y: s.y - 10 }; }); await tapWorld(k.x, k.y); } await tapEl('#ring .rb.tgo'); await tapEl('#ring .rb.arm'); continue; }
    if (w === 'power') { await tapEl(arg === 'fire' ? '#bP1' : arg === 'reinf' ? '#bP2' : '#bP0'); if (arg !== 'reinf') { const e = await page.evaluate(() => { const G = window.HOLDOR.G, H = window.HOLDOR; const en = G.enemies.find(e => e.hp > 0 && !e.fly); const p = en ? H.posAt(G.map, en.prog, en.route) : { x: 195, y: 300 }; return { x: p.x, y: p.y }; }); await tapWorld(e.x, e.y); } continue; }
    if (w === 'hodor') { const g = await page.evaluate(() => { const G = window.HOLDOR.G, at = G.hod ? G.hod.at : 0, gi = G.map.gates.findIndex((g, i) => i !== at); return { x: G.map.gates[gi].x, y: 628 + 24 }; }); await tapWorld(g.x, g.y); continue; }
    await page.waitForTimeout(300);
  }
  const end = await page.evaluate(() => { const A = window.HOLDOR.ACC, G = window.HOLDOR.G; return { learn: Object.keys(A.learn).sort().join(','), state: G.state, lq: (G.lq || []).slice(), towers: G.map.slots.filter(s => s.tower).map(s => s.tower.type + s.tower.lvl), rally: (G.map.slots.find(s => s.tower && s.tower.type === 'keep') || { tower: {} }).tower.rx != null }; });
  console.log(JSON.stringify({ scenario: SCN, queue: q0, steps: log.join(' '), idle, end }, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
