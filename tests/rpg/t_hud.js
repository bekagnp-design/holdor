// HOLDOR RPG — the HUD (A25): bars follow hp/xp, the gold chip follows the `gold` event, the minimap draws the map / mobs / ghosts /
// quest markers, the region banner on `enter`, the TOWN pill, the fallen chip, the level-up pulse, hidden while a screen is open,
// nothing on the joystick zone or the bottom-right button column at 390×844 and 360×740.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=... node tests/rpg/t_hud.js   (HOLDOR_HTML=path overrides the build)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), SC = path.join(ROOT, '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const HTML = 'file://' + path.resolve(ROOT, process.env.HOLDOR_HTML || 'beta/index.html');
const out = {}, errors = []; const ok = (k, v, info) => { out[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
const px = n => Math.round(n * 10) / 10;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const mk = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
    page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/i.test(m.text())) errors.push('C:' + m.text()); });
    await page.goto(HTML); await page.waitForFunction(() => window.R && R.hud && R.hud.el, { timeout: 20000 });
    return page;
  };
  // a fake save (v2 shape: acc + the current hero) and a fake player; 7 steps = 0.117 s ≥ one HUD refresh
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2P8z8DwHwyBgAHMAIsAAHFVCg5RB8AjAAAAAElFTkSuQmCC';
  const setup = (page, o) => page.evaluate(([o, PNG]) => {
    R.stop && R.stop(); for (let i = 0; i < 4 && R.ui.cur; i++) R.ui.close(); R.ents.length = 0;
    // the HUD alone: only its system runs on R.step (the player / quest / world systems would rewrite hp, markers and the save under the test)
    R.sysList = R.sysList.filter(x => x === R.sys.hud); R.data.world = { regions: [], pois: [] }; R.quests = { markers: () => [] }; R.towns = null;
    document.querySelectorAll('#ui>.toast').forEach(t => t.remove()); const tw = document.getElementById('tut'); if (tw) tw.remove();
    const s = R.newState(); Object.assign(s.p, { name: 'Bran', hero: 'jon', house: 'stark', cls: 'knight', lvl: 12, xp: 340, gold: 1200, gems: 7, }, o || {});
    s.acc = Object.assign(s.acc || {}, { house: 'stark', hall: [{ id: 'robb', lvl: 4 }, { id: 'arya', lvl: 9 }], titles: [], title: 'Squire of Winterfell', ach: [], champs: {}, world: { found: [], flags: { tut: 8 }, quests: {}, bosses: {}, killed: {} } });
    R.state = s; window.A_CHAMP = { art: { jon_portrait: PNG } }; if (R.draw) R.draw.portrait = null; R.hud.resetPortrait && R.hud.resetPortrait();
    R.player = R.spawn({ kind: 'player', x: 3600, y: 6000, team: 0, hp: 300, hpMax: 1000, name: 'Bran', lvl: 12 }); R.cam.x = 3600; R.cam.y = 6000;
    for (let i = 0; i < 7; i++) R.step();
  }, [o || {}, PNG]);
  const steps = (page, n) => page.evaluate(n => { for (let i = 0; i < n; i++) R.step(); }, n || 7);
  const style = (page, sel, prop) => page.evaluate(([sel, prop]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; }, [sel, prop]);
  const text = (page, sel) => page.evaluate(sel => (document.querySelector(sel) || {}).textContent, sel);
  const width = (page, sel) => page.evaluate(sel => parseFloat(document.querySelector(sel).style.width), sel);
  const near = (a, b) => Math.abs(a - b) < .15;
  const mmPixels = page => page.evaluate(() => { const c = R.hud.mm, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let non = 0, red = 0, white = 0, cyan = 0, gold = 0, green = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a > 0) non++; if (r > 190 && g < 110 && b < 110) red++; if (r > 240 && g > 240 && b > 240) white++;
      if (r < 130 && g > 180 && b > 200) cyan++; if (r > 200 && g > 150 && b < 130) gold++; if (g > 70 && r < 70 && b < 80 && g > r + 35) green++; } return { non, red, white, cyan, gold, green, w: c.width }; });

  const page = await mk(390, 844);
  await setup(page);
  ok('hud visible with a player and no screen', (await style(page, '#hud', 'visibility')) === 'visible');
  ok('hp bar 30%', near(await width(page, '#hud-hp .fill'), 30), await width(page, '#hud-hp .fill'));
  // the xp to the next level: the player module's own curve (R.plr.xpNext), the one it levels on
  const need12 = await page.evaluate(() => R.plr && R.plr.xpNext ? R.plr.xpNext(12) : 80 + 45 * 12 + 6 * 144), f12 = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  ok('xp text', (await text(page, '#hud-lvtxt')) === 'Lv 12 · 340/' + f12(need12), await text(page, '#hud-lvtxt'));
  ok('xp bar', near(await width(page, '#hud-xp .fill'), 34000 / need12), await width(page, '#hud-xp .fill'));
  ok('level badge', (await text(page, '#hud-lvl')) === '12');
  ok('name + title', (await text(page, '#hud-name b')) === 'Bran' && (await text(page, '#hud-title')) === '· Squire of Winterfell', await text(page, '#hud-name'));
  ok('house colour ring', /169, 189, 208/.test(await style(page, '#hud-port', 'borderColor')), await style(page, '#hud-port', 'borderColor'));
  const pi = await page.evaluate(() => { const i = document.getElementById('hud-pimg'); return { on: i.classList.contains('on'), src: (i.src || '').slice(0, 30), d: getComputedStyle(i).display, pd: !!document.querySelector('#hud-port .pdraw') }; });
  ok('portrait from the champion art', (pi.on && /^data:image\//.test(pi.src) && pi.d === 'block') || pi.pd, JSON.stringify(pi));
  ok('fallen chip ☠ 2', (await text(page, '#hud-hall')) === '☠2' && /flex/.test(await style(page, '#hud-hall', 'display')), await text(page, '#hud-hall') + ' ' + await style(page, '#hud-hall', 'display'));
  ok('gold chip 1,200', (await text(page, '#hud-gold')) === '1,200', await text(page, '#hud-gold'));
  ok('gem chip 7', (await text(page, '#hud-gems')) === '7');
  // hp changes + steps
  await page.evaluate(() => { R.player.hp = 600; }); await steps(page);
  ok('hp bar 60% after change + steps', near(await width(page, '#hud-hp .fill'), 60), await width(page, '#hud-hp .fill'));
  await page.evaluate(() => { R.state.p.xp = 1000; }); await steps(page);
  ok('xp follows the save', (await text(page, '#hud-lvtxt')) === 'Lv 12 · 1,000/' + f12(need12) && near(await width(page, '#hud-xp .fill'), Math.min(100, 100000 / need12)), await text(page, '#hud-lvtxt') + ' ' + await width(page, '#hud-xp .fill'));
  // the HP numbers are always shown; a tap on the block opens the hero sheet
  const b0 = await page.$eval('#hud-bars', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  ok('hero block tap target ≥ 44', b0.h >= 44, JSON.stringify(b0));
  ok('hp numbers always shown', (await text(page, '#hud-hpn')) === '600 / 1,000' && parseFloat(await style(page, '#hud-hpn', 'opacity')) > .9, await text(page, '#hud-hpn') + ' op=' + await style(page, '#hud-hpn', 'opacity'));
  await page.evaluate(() => { window.__btn0 = []; R.bus.on('btn', w => window.__btn0.push(w)); }); await page.tap('#hud-bars', { force: true }); await page.waitForTimeout(150);
  ok('tap on the hero block → btn inv (the hero sheet)', (await page.evaluate(() => window.__btn0.join())) === 'inv', await page.evaluate(() => window.__btn0.join()));
  await page.evaluate(() => { for (let i = 0; i < 3 && R.ui.cur; i++) R.ui.close(); });
  // gold event → count-up to the new value
  await page.evaluate(() => { R.state.p.gold = 1500; R.bus.emit('gold', 300); });
  const bump = await page.evaluate(() => document.querySelector('#hud-chips .gold').classList.contains('bump'));
  await page.waitForTimeout(900);
  ok('gold chip counts up to 1,500 on the gold event', (await text(page, '#hud-gold')) === '1,500' && bump, await text(page, '#hud-gold') + ' bump=' + bump);
  // minimap: non-blank, white player arrow, no red before mobs
  let m0 = await mmPixels(page);
  ok('minimap draws (non-blank, white arrow, no red yet)', m0.non > 2000 && m0.white > 10 && m0.red === 0, JSON.stringify(m0));
  await page.evaluate(() => { R.spawn({ kind: 'mob', type: 'axe', x: 3600 + 200, y: 6000, hp: 30 }); R.spawn({ kind: 'mob', type: 'sword', x: 3600 - 100, y: 6000 + 350, hp: 30 }); R.spawn({ kind: 'mob', type: 'archer', x: 3600 + 2000, y: 6000, hp: 30 }); R.spawn({ kind: 'ghost', x: 3600, y: 6000 - 250, hp: 1, team: 2, name: 'Sansa' }); });
  await steps(page); const m1 = await mmPixels(page);
  ok('minimap: red dots when mobs are near, cyan for a ghost', m1.red > 8 && m1.red < 400 && m1.cyan > 4, JSON.stringify(m1));
  await page.evaluate(() => { R.quests = { markers: () => [{ x: 3600 + 5000, y: 6000 - 2000, id: 'q1' }] }; }); await steps(page); const m2 = await mmPixels(page);
  ok('minimap: quest marker clamped to the rim (gold)', m2.gold > m1.gold + 6, JSON.stringify({ before: m1.gold, after: m2.gold }));
  await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 2048; const g = cv.getContext('2d'); g.fillStyle = '#1f8a3a'; g.fillRect(0, 0, 1200, 2048); R.assets = Object.assign(R.assets || {}, { map: cv }); }); await steps(page); const m3 = await mmPixels(page);
  ok('minimap: the map art around the player is drawn', m3.green > 3000, JSON.stringify(m3));
  // minimap tap → btn map
  await page.evaluate(() => { window.__btn = []; R.bus.on('btn', (w, a) => window.__btn.push(w)); }); await page.tap('#minimap', { force: true });
  const mt = await page.evaluate(() => { const r = document.getElementById('minimap').getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { b: window.__btn.join(), cur: R.ui.cur, top: e && (e.id || e.className), hud: document.getElementById('hud').className }; }); await page.evaluate(() => { for (let i = 0; i < 3 && R.ui.cur; i++) R.ui.close(); });
  ok('minimap tap emits btn map (the map opens)', /^map/.test(mt.b), JSON.stringify(mt));
  const mb = await page.$eval('#minimap', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  ok('minimap 96 px, top-right, under the top row', mb.w === 96 && mb.h === 96 && mb.x + mb.w <= 390 && mb.y > 30, JSON.stringify(mb));
  // region banner
  await page.evaluate(() => { R.data.world = { regions: [{ id: 'riverlands', name: 'The Riverlands', lvl: [10, 20] }], pois: [{ id: 'riverrun', kind: 'castle', house: 'tully', x: 3700, y: 6100 }] }; R.data.story = { regions: { riverlands: 'The rivers remember every crossing.' } }; R.bus.emit('enter', 'riverlands'); });
  await page.waitForTimeout(600);
  const ban = await page.evaluate(() => { const el = document.getElementById('hud-region'); return { on: el.classList.contains('on'), b: el.querySelector('b').textContent, s: el.querySelector('small').textContent, p: el.querySelector('p').textContent, op: getComputedStyle(el).opacity }; });
  ok('region banner on enter', ban.on && ban.b === 'The Riverlands' && ban.s === 'lv 10–20' && /rivers remember/.test(ban.p) && parseFloat(ban.op) > .8, JSON.stringify(ban));
  // TOWN pill → shop screen
  await page.evaluate(() => { R.towns = { inside: () => ({ id: 'winterfell', name: 'Winterfell' }) }; R.screens.shop = { open(arg) { window.__shop = arg; }, close() {} }; }); await steps(page);
  const tb = await page.$eval('#hud-town', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, d: getComputedStyle(el).display, t: el.textContent }; });
  ok('TOWN pill shows with the name, ≥ 44 px', /flex/.test(tb.d) && tb.h >= 44 && /TOWN/.test(tb.t) && /Winterfell/.test(tb.t), JSON.stringify(tb));
  await page.tap('#hud-town', { force: true }); await page.waitForTimeout(250);
  const sh = await page.evaluate(() => ({ cur: R.ui.cur, arg: window.__shop && window.__shop.name, hid: getComputedStyle(document.getElementById('hud')).visibility }));
  ok('TOWN tap opens the shop screen and the HUD hides', sh.cur === 'shop' && sh.arg === 'Winterfell' && sh.hid === 'hidden', JSON.stringify(sh));
  await page.evaluate(() => R.ui.close()); await page.waitForTimeout(250);
  ok('HUD back when the screen closes', (await style(page, '#hud', 'visibility')) === 'visible');
  await page.evaluate(() => { R.towns.inside = () => null; }); await steps(page);
  ok('TOWN pill gone outside a town', (await style(page, '#hud-town', 'display')) === 'none');
  // a generic screen hides the HUD too
  await page.evaluate(() => { R.screens.__t = { open() {}, close() {} }; R.ui.open('__t'); }); await page.waitForTimeout(250);
  ok('HUD hidden while any screen is open', (await style(page, '#hud', 'visibility')) === 'hidden');
  await page.evaluate(() => R.ui.close()); await page.waitForTimeout(250);
  // fallen chip tap → hall
  await page.evaluate(() => { R.screens.hall = { open() { window.__hall = 1; }, close() {} }; }); await page.tap('#hud-hall', { force: true }); await page.waitForTimeout(100);
  ok('fallen chip tap opens the hall', (await page.evaluate(() => R.ui.cur === 'hall' && window.__hall === 1)));
  await page.evaluate(() => R.ui.close()); await page.waitForTimeout(250);
  ok('no fallen chip while nobody has fallen', (await page.evaluate(() => { const h = R.state.acc.hall; R.state.acc.hall = []; for (let i = 0; i < 7; i++) R.step(); const d = getComputedStyle(document.getElementById('hud-hall')).display; R.state.acc.hall = h; for (let i = 0; i < 7; i++) R.step(); return d; })) === 'none');
  // low hp vignette
  await page.evaluate(() => { R.player.hp = 200; }); await steps(page);
  const vg = await page.evaluate(() => { const v = document.getElementById('hud-vig'); return { op: parseFloat(v.style.opacity), on: v.classList.contains('on'), low: document.getElementById('hud-hp').classList.contains('low') }; });
  ok('low-hp vignette under 30 %', vg.op > .4 && vg.on && vg.low, JSON.stringify(vg));
  await page.evaluate(() => { R.player.hp = 600; }); await steps(page);
  ok('vignette off at 60 %', (await page.evaluate(() => document.getElementById('hud-vig').style.opacity)) === '0');
  // level-up pulse
  await page.evaluate(() => { R.state.p.lvl = 13; R.bus.emit('levelup', 13); });
  ok('levelup pulses the portrait and bumps the badge', (await page.evaluate(() => document.getElementById('hud-port').classList.contains('lvup') && document.getElementById('hud-lvl').textContent === '13')));
  const rate = await page.evaluate(() => { const s = R.sys.hud;
    // count DOM writes of the xp text over 60 steps (1 game second) with a mutation observer: ≤ 10 refreshes a second
    const el = document.getElementById('hud-lvtxt'); const mo = new MutationObserver(() => {}); mo.observe(el, { characterData: true, childList: true, subtree: true });
    for (let i = 0; i < 60; i++) { R.state.p.xp = 1000 + i; R.step(); } const n = mo.takeRecords().length; mo.disconnect(); return { order: s.order, writes: n, idx: R.sysList.indexOf(s), total: R.sysList.length }; });
  ok('system order 950, ≤ 10 refreshes a second', rate.order === 950 && rate.writes >= 8 && rate.writes <= 10, JSON.stringify(rate));
  // geometry: nothing on the joystick zone (left half, bottom 45 %) or the bottom-right 160 px; everything inside the viewport
  const geo = async (page, w, h) => page.evaluate(([w, h]) => {
    const bad = [], seen = []; for (const el of document.querySelectorAll('#hud *')) { if (el.id === 'hud-vig' || el.id === 'hud-region') continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue; seen.push(el.id || el.className);
      if (r.left < 0 || r.top < 0 || r.right > w + .5 || r.bottom > h + .5) bad.push('out:' + (el.id || el.className));
      if (r.left < w / 2 && r.bottom > h * .55) bad.push('joy:' + (el.id || el.className));
      if (r.right > w - 160 && r.bottom > h - 160) bad.push('btns:' + (el.id || el.className)); }
    const tl = document.getElementById('hud-row').getBoundingClientRect(), tr = document.getElementById('hud-tr').getBoundingClientRect();
    if (tl.right > tr.left) bad.push('overlap tl/tr ' + Math.round(tl.right) + '>' + Math.round(tr.left));
    // nothing of the HUD on A02's top row (map · bag · menu) or on the chat button
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const id of ['ctl-top', 'prChat']) { const o = document.getElementById(id); if (!o || getComputedStyle(o).display === 'none') continue; const ob = o.getBoundingClientRect();
      for (const el of document.querySelectorAll('#hud *')) { if (el.id === 'hud-vig' || el.id === 'hud-region' || el.id === 'hud-slot' || el.id === 'hud-tl') continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue; if (hit(r, ob)) bad.push(id + ':' + (el.id || el.className)); } }
    return { bad, n: seen.length, tlRight: Math.round(tl.right), trLeft: Math.round(tr.left) }; }, [w, h]);
  // the message column: a bar, toasts and the region title stacked, none over another or over the HUD blocks
  const column = async page => page.evaluate(() => {
    if (!document.getElementById('bossbar')) { const b = document.createElement('div'); b.id = 'bossbar'; b.className = 'on'; b.style.cssText = 'display:block;height:40px;width:300px;position:absolute;left:50%;transform:translateX(-50%)'; document.getElementById('ui').appendChild(b); }
    else document.getElementById('bossbar').classList.add('on');
    R.ui.toast('Quest complete'); R.ui.toast('New quest: The long road north'); R.hud.banner('riverlands'); for (let i = 0; i < 7; i++) R.step(); R.hud.stack();
    const els = [document.getElementById('bossbar'), document.getElementById('hud-region'), ...document.querySelectorAll('#ui>.toast'), document.getElementById('hud-row'), document.getElementById('qtrack'), document.getElementById('hud-tr'), document.getElementById('ctl-top'), document.getElementById('prChat')].filter(Boolean);
    const rs = els.map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, l: r.left, r: r.right, t: r.top, b: r.bottom }; }).filter(r => r.r > r.l && r.b > r.t);
    const over = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1) over.push(a.id + '/' + b.id); }
    document.getElementById('bossbar').classList.remove('on'); return { over, n: rs.length }; });
  const c1 = await column(page); ok('390×844: bar, region title and toasts stack without overlapping each other or the HUD', !c1.over.length && c1.n >= 8, JSON.stringify(c1));
  const g1 = await geo(page, 390, 844);
  ok('390×844: HUD inside the view, clear of the joystick zone and the button column', !g1.bad.length && g1.n > 8, JSON.stringify(g1));
  // the screenshot: banner + mobs + town + 25 % hp
  await page.evaluate(() => { R.player.hp = 250; R.towns.inside = () => ({ id: 'winterfell', name: 'Winterfell' }); R.state.p.gold = 1620; R.bus.emit('enter', 'riverlands'); for (let i = 0; i < 7; i++) R.step(); });
  await page.waitForTimeout(700); await page.screenshot({ path: SC + 'rpg_hud.png' });
  await page.close();
  // small phone
  const p2 = await mk(360, 740); await setup(p2);
  await p2.evaluate(() => { R.towns = { inside: () => ({ id: 'winterfell', name: 'Winterfell' }) }; R.spawn({ kind: 'mob', type: 'axe', x: 3800, y: 6000, hp: 30 }); for (let i = 0; i < 7; i++) R.step(); });
  const g2 = await geo(p2, 360, 740);
  ok('360×740: HUD inside the view, clear of the joystick zone and the button column', !g2.bad.length && g2.n > 8, JSON.stringify(g2));
  const c2 = await column(p2); ok('360×740: the message column stacks without overlaps', !c2.over.length && c2.n >= 8, JSON.stringify(c2));
  const fonts = await p2.evaluate(() => { const o = {}; for (const id of ['hud-lvtxt', 'hud-title', 'hud-gold', 'hud-lvl']) o[id] = parseFloat(getComputedStyle(document.getElementById(id)).fontSize); return o; });
  ok('360×740: text ≥ 12 px', Object.values(fonts).every(f => f >= 12), JSON.stringify(fonts));
  await p2.screenshot({ path: SC + 'rpg_hud_360.png' }); await p2.close();
  await browser.close();
  for (const k in out) console.log(k + ': ' + out[k]);
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  const bad = Object.values(out).filter(v => /^FAIL/.test(v)).length + errors.length;
  console.log(bad ? bad + ' FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
