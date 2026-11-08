// chest145: the chest opening redrawn. A drawn chest per tier, a lid that swings open, cards that fly out and flip; after the chest is
// open ANY tap moves on (the card on show goes to the row at once, the next one comes), SKIP › lays out the rest, COLLECT closes.
// Before opening, taps keep their meaning (open; lucky taps in lucky.js). What a chest gives is unchanged — checked on a guest seat
// (gold paid = gold shown) and with a server-shaped ECO.roll (nothing paid locally, the server's numbers shown).
// Real taps (page.locator().tap / page.touchscreen). Screenshots: .shots/chest145_*.png
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const HTML = 'file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
  await page.goto(HTML);
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CHEST && window.HOLDOR_LUCKY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const boot = p => p.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 };
    a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; a.gold = 1000; H.setAcc(a); H.showHub('battle'); });
  await boot(page); await page.waitForTimeout(400);
  const st = (p = page) => p.evaluate(() => window.HOLDOR_CHEST.state);
  const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return Date.now() - t0; await page.waitForTimeout(25); } return -1; };
  const center = (p = page) => p.touchscreen.tap(195, 430);
  const fixed = (n, p = page) => p.evaluate(n => { window.__done = 0; const R = [{ k: 'gold', n: 'Gold', s: '+150', r: 0 }, { k: 'gems', n: 'Dragonglass', s: '+8', r: 0 }]; while (R.length < n) R.push({ k: 'gold', n: 'Gold', s: '+100', r: 0 });
    window.HOLDOR_CHEST.chest145Open('iron', () => { window.__done++; }, R); }, n);

  // 1. every tier: a drawn chest, TAP TO OPEN, real rewards, untouched it plays to the end; the gold paid is the gold shown
  for (const t of ['wood', 'iron', 'valyrian', 'dragon']) {
    await page.evaluate(t => { window.__g0 = window.HOLDOR.ACC.gold; window.__done = 0; window.HOLDOR_CHEST.chest145Open(t, () => { window.__done++; }); }, t);
    await page.waitForTimeout(350);
    const c = await page.evaluate(() => ({ name: document.querySelector('#cer h2').textContent, svg: !!document.querySelector('#cimg svg .c5lid') && !!document.querySelector('#cimg svg .c5lidO'), tap: document.getElementById('ctap').textContent, n: window.HOLDOR_CHEST.state.n }));
    if (t !== 'iron') await page.screenshot({ path: SC + 'chest145_' + t + '_closed.png' });
    // a tap on the background before opening does nothing
    await page.touchscreen.tap(30, 780); await page.waitForTimeout(120);
    const still = (await st()).phase;
    await page.locator('#cch').tap({ force: true });
    const ms = await waitFor(() => !!document.querySelector('#ccol.in'), 20000);
    const f = await page.evaluate(() => ({ s: window.HOLDOR_CHEST.state, gold: window.HOLDOR.ACC.gold - window.__g0, shown: [...document.querySelectorAll('#crw .rcard')].map(d => d.textContent.replace(/\s+/g, ' ').trim()) }));
    const goldShown = f.shown.filter(x => /^Gold|^Bag of gold/.test(x)).reduce((s, x) => s + (+((/\+(\d+)/.exec(x) || [0, 0])[1])), 0);
    ok(`${t}: drawn chest with two lids, TAP TO OPEN, untapped it ends in the grid (${c.n} rewards)`, c.svg && /TAP TO OPEN/.test(c.tap) && still === 'closed' && ms > 0 && f.s.phase === 'done' && f.s.shown === c.n && c.n >= 3, JSON.stringify({ c, still, ms, s: f.s }));
    ok(`${t}: the gold paid equals the gold shown`, f.gold === goldShown, JSON.stringify({ paid: f.gold, shown: goldShown }));
    if (t !== 'iron') { await page.waitForTimeout(700); await page.screenshot({ path: SC + 'chest145_' + t + '_grid.png' }); }
    await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(250);
  }
  ok('COLLECT closes the scene and calls done once', await page.evaluate(() => window.__done === 1 && document.getElementById('cer').className === 'hidden' && document.getElementById('cer').innerHTML === ''));

  // 2 and 3 measure the chest's own timers (setTimeout chain + rAF count-up). They run on a second page whose clock is Playwright's fake
  // one, paused and advanced by hand (runFor): the scene gets exactly the game time it is given, and the machine's load (shared CPU) never
  // counts. Wall-clock waits used to fail here under load (4465 ms for "≤ 4 s", 6.4 s for six taps) with nothing wrong in the chest. The
  // main page keeps its real clock: a fake clock that flows (clock.install alone) lags behind real time on a loaded machine.
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }); p2.on('pageerror', e => errors.push('PE2:' + e.message));
  await p2.clock.install(); await p2.goto(HTML);
  await p2.waitForFunction(() => window.HOLDOR && window.HOLDOR_CHEST && window.HOLDOR_LUCKY, { timeout: 20000 }); await boot(p2);
  await p2.clock.pauseAt(await p2.evaluate(() => Date.now() + 1000));
  const run = ms => p2.clock.runFor(ms);
  const runUntil = async (fn, ms, step) => { for (let t = 0; t < ms; t += step) { await run(step); if (await p2.evaluate(fn)) return t + step; } return -1; };
  // 2. the default sequence for a 4-reward chest is about 4 s or less
  await fixed(4, p2); await run(200); await p2.locator('#cch').tap({ force: true });
  const t4 = await runUntil(() => !!document.querySelector('#ccol.in'), 9000, 100);
  ok('untouched, a 4-reward chest opens and lays out all four in ≤ 4 s (game time)', t4 > 0 && t4 <= 4000 && (await st(p2)).shown === 4, 't=' + t4 + 'ms');
  await p2.locator('#ccol').tap({ force: true }); await run(200);

  // 3. tap to speed up: once the first card is out, each tap sends it to the row at once and brings the next
  await fixed(6, p2); await run(200); await p2.locator('#cch').tap({ force: true });
  await runUntil(() => { const s = window.HOLDOR_CHEST.state; return s.phase === 'show' && s.idx === 0; }, 3000, 50);
  const steps = []; let tTap = 0;
  for (let i = 0; i < 6; i++) { await center(p2); await run(110); tTap += 110; const s = await st(p2); steps.push(s.shown + (s.phase === 'done' ? '!' : '')); }
  ok('6 taps after opening: each tap adds exactly one card to the row, the 6th ends it', JSON.stringify(steps) === JSON.stringify(['1', '2', '3', '4', '5', '6!']), JSON.stringify(steps));
  ok('tapping walks through 6 rewards far faster than the old timer (6 × 1150 ms): each tap lands within 110 ms of game time', tTap < 1150 * 6 / 3 && (await st(p2)).phase === 'done', tTap + 'ms');
  await p2.locator('#ccol').tap({ force: true }); await run(200);
  // a tap during the lid swing jumps straight to the first card
  await fixed(3, p2); await run(200); await p2.locator('#cch').tap({ force: true }); await run(90); await center(p2); await run(40);
  const jump = await st(p2);
  ok('a tap while the lid is still swinging shows the first card at once', jump.phase === 'show' && jump.idx === 0, JSON.stringify(jump));
  await p2.locator('#cskip').tap({ force: true }); await run(150); await p2.locator('#ccol').tap({ force: true }); await run(200);
  await p2.close();   // the rest plays on the main page, real clock

  // 4. SKIP › lays out every remaining reward at once
  await page.evaluate(() => { window.__done = 0; window.HOLDOR_CHEST.chest145Open('dragon', () => { window.__done++; }); }); await page.waitForTimeout(250);
  await page.locator('#cch').tap({ force: true }); await page.waitForTimeout(800);
  const pre = await st(); await page.locator('#cskip').tap({ force: true }); await page.waitForTimeout(60);
  const post = await st();
  ok('SKIP › shows every reward in the grid at once and offers COLLECT', pre.phase === 'show' && pre.shown < pre.n && post.phase === 'done' && post.shown === post.n && await page.evaluate(() => document.querySelector('#ccol').classList.contains('in')), JSON.stringify({ pre, post }));
  await page.waitForTimeout(500); await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(200);
  ok('…and COLLECT after SKIP calls done', await page.evaluate(() => window.__done === 1));

  // 5. Epic and Legendary moments (screenshots mid-reveal)
  for (const [t, rr, nm] of [['valyrian', 3, 'epic'], ['dragon', 4, 'legendary']]) {
    await page.evaluate(([t, rr]) => { const H = window.HOLDOR, c = H.CHAMPS.find(c => c.house === 'targaryen') || H.CHAMPS[0];
      window.HOLDOR_CHEST.chest145Open(t, () => {}, [{ k: 'gold', n: 'Gold', s: '+1520', r: 0 }, { k: 'card', key: 'c:' + c.id, n: c.n, s: '+6 cards', r: rr }, { k: 'gems', n: 'Dragonglass', s: '+64', r: 0 }]); }, [t, rr]);
    await page.waitForTimeout(250); await page.locator('#cch').tap({ force: true }); await page.waitForTimeout(100); await center(); await page.waitForTimeout(60); await center();
    await page.waitForTimeout(550);
    const m = await page.evaluate(() => { const c = document.querySelector('#cbig .c5card'); return c ? { cls: c.className, rib: c.querySelector('.c5rib').textContent } : null; });
    ok(`${nm}: the card gets its frame, shine${rr >= 4 ? ', gold burst' : ''}`, m && /shine/.test(m.cls) && (rr < 4 || /legend/.test(m.cls)) && m.rib.toLowerCase() === nm, JSON.stringify(m));
    await page.screenshot({ path: SC + 'chest145_' + nm + '_reveal.png' });
    await page.locator('#cskip').tap({ force: true }); await page.waitForTimeout(150); await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(200);
  }

  // 6. lucky chests still work through openChest: every tap lucky, wood climbs to dragon, then this scene opens a dragon chest
  await page.evaluate(() => { window.__r = Math.random; Math.random = () => 0.01; window.__done = 0; window.HOLDOR.openChest('wood', () => { window.__done++; }); Math.random = window.__r; });
  await page.waitForTimeout(300);
  const lk = [];
  for (let i = 0; i < 3; i++) { await page.locator('#cch').tap({ force: true }); await page.waitForTimeout(450); lk.push(await page.evaluate(() => (document.getElementById('lkN') || {}).textContent)); }
  ok('lucky taps still raise the chest (Iron, Valyrian, Dragon)', JSON.stringify(lk) === JSON.stringify(['Iron chest', 'Valyrian chest', 'Dragon chest']), JSON.stringify(lk));
  const lms = await waitFor(() => !!document.querySelector('#cer.c145') && window.HOLDOR_CHEST.state && window.HOLDOR_CHEST.state.phase !== 'closed', 4000);
  ok('after the lucky taps the new scene takes over and opens by itself', lms > 0 && await page.evaluate(() => document.querySelector('#cer h2').textContent === 'Dragon chest'), 'ms=' + lms);
  await center(); await page.waitForTimeout(80); await center(); await page.waitForTimeout(80);
  const lt = await st();
  ok('…and taps speed it up there too', lt.shown >= 1, JSON.stringify(lt));
  await page.locator('#cskip').tap({ force: true }); await page.waitForTimeout(200); await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(200);
  ok('…COLLECT calls done', await page.evaluate(() => window.__done === 1));

  // 7. a seat kept by the server: ECO.roll (as ecoChest sets it) is shown as is and nothing is paid locally
  await page.evaluate(() => { const H = window.HOLDOR, E = window.HOLDOR_ECON.ECO, c = H.CHAMPS[0]; window.__g0 = H.ACC.gold; window.__m0 = H.ACC.gems; window.__done = 0;
    E.roll = { id: 't145', taps: [false, true, false], tier: 'iron', gold: 777, gems: 33, stacks: [{ k: 'c:' + c.id, n: 5 }], fills: 1, books: [] };
    try { H.openChest('wood', () => { window.__done++; }); } finally { E.roll = null; } });
  for (let i = 0; i < 3; i++) { await page.locator('#cch').tap({ force: true }); await page.waitForTimeout(420); }
  const sw = await waitFor(() => !!document.querySelector('#cer.c145') && window.HOLDOR_CHEST.state && window.HOLDOR_CHEST.state.phase !== 'closed', 8000);
  await page.waitForTimeout(150); await page.locator('#cskip').tap({ force: true }); await page.waitForTimeout(150);
  const sv = await page.evaluate(() => ({ name: document.querySelector('#cer h2').textContent, shown: [...document.querySelectorAll('#crw .rcard small')].map(x => x.textContent), gold: window.HOLDOR.ACC.gold - window.__g0, gems: window.HOLDOR.ACC.gems - window.__m0 }));
  ok('server roll: the server\'s tier and numbers are shown (777 gold, 33 dragonglass, 5 cards, a +100 fill), nothing paid locally', sw > 0 && sv.name === 'Iron chest' && JSON.stringify(sv.shown) === JSON.stringify(['+777', '+33', '+5 cards', '+100']) && sv.gold === 0 && sv.gems === 0, JSON.stringify({ sw, sv, st: await st(), cls: await page.evaluate(() => document.getElementById('cer').className) }));
  await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(200);
  ok('…and its COLLECT calls done', await page.evaluate(() => window.__done === 1));

  // 8. the small chest icons elsewhere (home slots, shop) use the new drawing too
  ok('chestSVG draws the new chests for every tier, closed and open', await page.evaluate(() => ['wood', 'iron', 'valyrian', 'dragon'].every(t => /c5svg/.test(window.HOLDOR_GEN.chestSVG(t)) && /c5svg/.test(window.HOLDOR_GEN.chestSVG(t, true)))));

  // 9. reduced motion: no sweeping effects, still opens, taps and collects
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixed(3); await page.waitForTimeout(150); await page.locator('#cch').tap({ force: true });
  const rm = await waitFor(() => !!document.querySelector('#ccol.in'), 5000);
  ok('reduced motion: it opens and ends in the grid', rm > 0 && (await st()).shown === 3, 'ms=' + rm);
  await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(150);

  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
