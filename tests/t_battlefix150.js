// battle-screen fixes: the spell name readable over the cooldown cover, the new-enemy toast's name after its icon,
// the champion's bubble hidden while a build ring is open, the CALL WAVE button off the pads and hidden while a ring is open,
// the build card fits a 390×700 phone.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_BF150 && window.HOLDOR_LEARN && window.HOLDOR_BUILD, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const start = (stage) => page.evaluate((stage) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= 50; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); window.HOLDOR_LEARN.LEARN.at.length = 0;
    H.startGame({ mode: 'campaign', level: H.LEVELS.find(l => l.id === stage) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 2000; return G.state; }, stage);
  const lum = c => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : 0; };
  ok('a battle starts (stage 20)', await start(20) === 'play');
  // ---- 1. the spells on cooldown: the cover drains over the icon, the name stays on top and light
  await page.evaluate(() => { const G = window.HOLDOR.G; for (const k of G.slots || ['arrows', 'fire', 'reinf']) G.powerCd[k] = Math.max(1, Math.round((G.powerMax[k] || 30) * 0.7)); });
  await page.waitForTimeout(450);
  const sp = await page.evaluate(() => ['bP0', 'bP1', 'bP2'].map(id => { const b = document.getElementById(id), l = b.querySelector('.l'), cd = b.querySelector('.cd'); const cs = getComputedStyle(l), cc = getComputedStyle(cd), r = l.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { id, txt: l.textContent, disabled: b.disabled, lock: b.classList.contains('lock'), cover: cc.transform, color: cs.color, pos: cs.position, z: cs.zIndex, onTop: top === l || l.contains(top) }; }));
  const covered = sp.filter(s => s.disabled && !s.lock && /matrix\(1, 0, 0, 0\.[3-9]/.test(s.cover));
  ok('three spells are covered by their cooldown (scaleY ≥ 0.3)', covered.length === 3, JSON.stringify(sp.map(s => [s.id, s.cover])));
  ok('the spell name sits above the cover (elementFromPoint hits the label) and is light (luminance > 0.75)', covered.every(s => s.onTop && s.pos === 'relative' && s.z === '1' && lum(s.color) > 0.75), JSON.stringify(sp.map(s => [s.txt, s.color, s.onTop])));
  await page.screenshot({ path: SC + 'battlefix150_spells.png', clip: { x: 0, y: 754, width: 390, height: 90 } });
  // ---- 2. the new-enemy toast: icon, then the name, left-aligned, inside the pill
  await page.evaluate(() => { const G = window.HOLDOR.G; G.tut = null; G.newcard = null; G.ncBox = null; G.newq = ['chief']; });
  await page.waitForTimeout(500);
  const nb = await page.evaluate(() => window.HOLDOR.G.ncBox);
  ok('the toast is drawn (Wildling chieftain)', !!nb && nb.tw > 60, JSON.stringify(nb));
  ok('the icon ends before the name starts, the name ends inside the pill, left-aligned', !!nb && nb.align === 'left' && nb.ix + nb.iw <= nb.tx && nb.tx + nb.tw <= nb.x + nb.w - 4, nb && JSON.stringify({ iconR: nb.ix + nb.iw, tx: nb.tx, textR: Math.round(nb.tx + nb.tw), pillR: Math.round(nb.x + nb.w) }));
  await page.screenshot({ path: SC + 'battlefix150_toast.png', clip: { x: 60, y: 110, width: 270, height: 50 } });
  // ---- 3. the champion's bubble vs the build ring, by a real tap on a pad
  const pad = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.newcard = null; G.newq = []; const s = G.map.slots.find(s => !s.tower && s.y > 200 && s.y < 520) || G.map.slots[0]; const h = G.hero; h.x = s.x; h.y = s.y + 44; h.tx = h.ty = null; h.dead = false;
    H.heroSay('The King in the North!', 6000); const c = document.getElementById('c').getBoundingClientRect(), sc = c.width / 390; return { x: c.left + s.x * sc, y: c.top + s.y * sc, sx: s.x, sy: s.y }; });
  await page.waitForTimeout(250);
  const shown = await page.evaluate(() => ({ hsay: !!window.HOLDOR.G.hsay, hid: window.HOLDOR.G.hsayHid || 0, call: document.getElementById('bCall').hidden }));
  ok('before the ring: the bubble is drawn, the CALL WAVE button shows', shown.hsay && shown.hid === 0 && shown.call === false, JSON.stringify(shown));
  await page.touchscreen.tap(pad.x, pad.y); await page.waitForTimeout(350);
  const ringOn = await page.evaluate(() => { const X = window.HOLDOR_BF150, G = window.HOLDOR.G; return { ring: !!X.RING, el: !document.getElementById('ring').hidden, n: document.querySelectorAll('#ring .rb').length, hsay: !!G.hsay, hid: G.hsayHid || 0, call: document.getElementById('bCall').hidden }; });
  ok('a tap on the pad opens the ring', ringOn.ring && ringOn.el && ringOn.n >= 3, JSON.stringify(ringOn));
  ok('while the ring is open: the bubble is kept but not drawn, the CALL WAVE button hides', ringOn.hsay && ringOn.hid > 0 && ringOn.call === true, JSON.stringify(ringOn));
  await page.screenshot({ path: SC + 'battlefix150_ring.png' });
  // a tap on empty ground closes the ring: the bubble and the button come back
  const ground = await page.evaluate(() => { const G = window.HOLDOR.G, c = document.getElementById('c').getBoundingClientRect(), sc = c.width / 390; let best = null, bd = 0;
    for (let y = 120; y < 520; y += 20) for (let x = 30; x < 360; x += 20) { let d = 1e9; for (const s of G.map.slots) d = Math.min(d, Math.hypot(s.x - x, s.y - y)); d = Math.min(d, Math.hypot(G.hero.x - x, G.hero.y - 8 - y)); if (d > bd) { bd = d; best = [x, y]; } }
    return { x: c.left + best[0] * sc, y: c.top + best[1] * sc, d: Math.round(bd) }; });
  await page.touchscreen.tap(ground.x, ground.y); await page.waitForTimeout(350);
  const ringOff = await page.evaluate(() => { const X = window.HOLDOR_BF150, G = window.HOLDOR.G; return { ring: !!X.RING, hsay: !!G.hsay, hid: G.hsayHid || 0, call: document.getElementById('bCall').hidden }; });
  ok('after the ring closes: the bubble is drawn again, the CALL WAVE button is back', !ringOff.ring && ringOff.hsay && ringOff.hid === 0 && ringOff.call === false, JSON.stringify(ringOff) + ' ground ' + JSON.stringify(ground));
  // ---- 4. the CALL WAVE button shows on every stage, on a tall and a short phone (it keeps its v1.4.2 spot; hidden only while a ring is open)
  const sweep = () => page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_BF150; let shown = 0;
    for (let n = 1; n <= 50; n++) { H.startGame({ mode: 'campaign', level: H.stageLevel(n) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.waveDone = true; G.nextIn = 8; X.callBtnTick();
      const b = document.getElementById('bCall'); if (!b.hidden && b.getBoundingClientRect().height > 0) shown++; }
    return { shown, stage: document.getElementById('stage').getBoundingClientRect().height }; });
  const tall = await sweep();
  ok('390×844: the CALL WAVE button shows on all 50 stages', tall.shown === 50, JSON.stringify(tall));
  await page.evaluate(() => { const H = window.HOLDOR; H.startGame({ mode: 'campaign', level: H.stageLevel(20) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.waveDone = true; G.nextIn = 8; });
  await page.waitForTimeout(400); await page.screenshot({ path: SC + 'battlefix150_call.png' });
  await page.setViewportSize({ width: 390, height: 700 }); await page.waitForTimeout(400);
  const short = await sweep();
  ok('390×700: the CALL WAVE button shows on all 50 stages', short.shown === 50 && short.stage < 600, JSON.stringify(short));
  // ---- 5. the build card on the result screen fits a 390×700 phone
  await start(8);
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; for (const k of ['warhammer', 'howl']) { G.learnAsk = [k]; window.HOLDOR_LEARN.learnPick(k); } G.hLv = 2; G.kills = 40; window.HOLDOR_MARKET.showCampaignResult(true, 3, [], 12); });
  await page.waitForTimeout(1600);
  const bc = await page.evaluate(() => { const c = document.querySelector('.bcard'); if (!c) return null; const r = c.getBoundingClientRect(), p = c.parentElement.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), cardBottom: Math.round(p.bottom), vh: innerHeight, over: c.parentElement.scrollHeight - c.parentElement.clientHeight }; });
  ok('390×700: the build card lies inside the result card and the viewport, nothing overflows', !!bc && bc.bottom <= bc.cardBottom && bc.cardBottom <= bc.vh && bc.over <= 0, JSON.stringify(bc));
  await page.screenshot({ path: SC + 'battlefix150_build700.png' });
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
