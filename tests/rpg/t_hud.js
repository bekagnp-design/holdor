// HOLDOR RPG — the HUD (A25): bars follow hp/xp, the gold chip follows the `gold` event, the minimap draws the map / mobs / ghosts /
// quest markers, the region banner on `enter`, the TOWN pill, the fallen chip, the level-up pulse, hidden while a screen is open,
// nothing on the joystick zone or the round button cluster, on a landscape phone (844×390) and a small one (740×360): the app is always laid
// out wide (R.layout; a landscape window gets no turn), the minimap is 80 px in the top-right corner with the top row to its left (html.q-s).
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

  const page = await mk(844, 390);
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
  const tr0 = await page.evaluate(() => { const r = id => { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) }; }; return { top: r('ctl-top'), chat: r('prChat'), rv: R.vw + '×' + R.vh + (R.rot ? ' rot' : ''), cls: document.documentElement.className }; });
  ok('844×390 (landscape, no turn, html.q-s): minimap 80 px in the top-right corner, the top row (map · bag · menu) and the chat button to its left', tr0.rv === '844×390' && /\bq-s\b/.test(tr0.cls) && mb.w === 80 && mb.h === 80 && mb.x + mb.w <= 844 && mb.x + mb.w >= 844 - 24 && mb.y < 24 && (!tr0.top || tr0.top.r <= mb.x) && (!tr0.chat || tr0.chat.r <= mb.x || tr0.chat.t >= mb.y + mb.h), JSON.stringify({ mb, tr0 }));
  // region banner
  await page.evaluate(() => { R.data.world = { regions: [{ id: 'riverlands', name: 'The Riverlands', lvl: [10, 20] }], pois: [{ id: 'riverrun', kind: 'castle', house: 'tully', x: 3700, y: 6100 }] }; R.data.story = { regions: { riverlands: 'The rivers remember every crossing.' } }; R.bus.emit('enter', 'riverlands'); });
  await page.waitForTimeout(600);
  const ban = await page.evaluate(() => { const el = document.getElementById('hud-region'); return { on: el.classList.contains('on'), b: el.querySelector('b').textContent, s: el.querySelector('small').textContent, p: el.querySelector('p').textContent, op: getComputedStyle(el).opacity }; });
  ok('region banner on enter', ban.on && ban.b === 'The Riverlands' && ban.s === 'lv 10–20' && /rivers remember/.test(ban.p) && parseFloat(ban.op) > .5, JSON.stringify(ban));
  // TOWN pill → shop screen
  await page.evaluate(() => { R.towns = { inside: () => ({ id: 'winterfell', name: 'Winterfell' }) }; R.screens.shop = { open(arg) { window.__shop = arg; }, close() {} }; }); await steps(page);
  const tb = await page.$eval('#hud-town', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, d: getComputedStyle(el).display, t: el.textContent }; });
  ok('TOWN pill shows with the name, ≥ 44 px', /flex/.test(tb.d) && tb.h >= 44 && /TOWN/.test(tb.t) && /Winterfell/.test(tb.t), JSON.stringify(tb));
  await page.tap('#hud-town', { force: true }); await page.waitForFunction(() => R.ui.cur === 'shop', null, { timeout: 4000, polling: 50 }).catch(() => {}); await page.waitForTimeout(100);
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
  await page.evaluate(() => { R.screens.hall = { open() { window.__hall = 1; }, close() {} }; }); const hTop = await page.evaluate(() => { const r = document.getElementById('hud-hall').getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e.id || e.className); });
  await page.tap('#hud-hall', { force: true }); await page.waitForTimeout(100);
  ok('fallen chip tap opens the hall', (await page.evaluate(() => R.ui.cur === 'hall' && window.__hall === 1)), 'top element at the chip: ' + hTop);
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
  // geometry: nothing on the joystick zone (left half, bottom 45 %) or on the round button cluster (A02's attack · dodge · skills · potion: their bounding box); everything inside the viewport
  const geo = async (page, w, h) => page.evaluate(([w, h]) => {
    const bad = [], seen = [], cl = [...document.querySelectorAll('#ctl .cb')].filter(b => getComputedStyle(b).display !== 'none' && getComputedStyle(document.getElementById('ctl')).display !== 'none').map(b => b.getBoundingClientRect());
    const box = cl.length ? { l: Math.min(...cl.map(r => r.left)), t: Math.min(...cl.map(r => r.top)), r: Math.max(...cl.map(r => r.right)), b: Math.max(...cl.map(r => r.bottom)) } : { l: w - 160, t: h - 160, r: w, b: h }; for (const el of document.querySelectorAll('#hud *')) { if (el.id === 'hud-vig' || el.id === 'hud-region') continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue; seen.push(el.id || el.className);
      if (r.left < 0 || r.top < 0 || r.right > w + .5 || r.bottom > h + .5) bad.push('out:' + (el.id || el.className));
      if (r.left < w / 2 && r.bottom > h * .55) bad.push('joy:' + (el.id || el.className));
      if (r.right > box.l + 1 && r.left < box.r - 1 && r.bottom > box.t + 1 && r.top < box.b - 1) bad.push('btns:' + (el.id || el.className) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') + ' vs cluster ' + [box.l, box.t, box.r, box.b].map(Math.round).join(',')); }
    const tl = document.getElementById('hud-row').getBoundingClientRect(), tr = document.getElementById('hud-tr').getBoundingClientRect();
    if (tl.right > tr.left) bad.push('overlap tl/tr ' + Math.round(tl.right) + '>' + Math.round(tr.left));
    // nothing of the HUD on A02's top row (map · bag · menu) or on the chat button
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const id of ['ctl-top', 'prChat']) { const o = document.getElementById(id); if (!o || getComputedStyle(o).display === 'none') continue; const ob = o.getBoundingClientRect();
      for (const el of document.querySelectorAll('#hud *')) { if (el.id === 'hud-vig' || el.id === 'hud-region' || el.id === 'hud-slot' || el.id === 'hud-tl') continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue; if (hit(r, ob)) bad.push(id + ':' + (el.id || el.className)); } }
    return { bad, n: seen.length, cluster: cl.length, tlRight: Math.round(tl.right), trLeft: Math.round(tr.left), rv: R.vw + '×' + R.vh }; }, [w, h]);
  // the message column: a bar, toasts and the region title stacked, none over another or over the HUD blocks
  const column = async page => page.evaluate(() => {
    let made = null; if (!document.getElementById('bossbar')) { const b = made = document.createElement('div'); b.id = 'bossbar'; b.className = 'on'; b.style.cssText = 'display:block;height:40px;width:300px;position:absolute;left:50%;transform:translateX(-50%)'; document.getElementById('ui').appendChild(b); }
    else document.getElementById('bossbar').classList.add('on');
    R.ui.toast('Quest complete'); R.ui.toast('New quest: The long road north'); R.hud.banner('riverlands'); for (let i = 0; i < 7; i++) R.step(); R.hud.stack();
    const els = [document.getElementById('bossbar'), document.getElementById('hud-region'), ...document.querySelectorAll('#ui>.toast'), document.getElementById('hud-row'), document.getElementById('qtrack'), document.getElementById('hud-tr'), document.getElementById('ctl-top'), document.getElementById('prChat')].filter(Boolean);
    const rs = els.map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, l: r.left, r: r.right, t: r.top, b: r.bottom }; }).filter(r => r.r > r.l && r.b > r.t);
    const over = [], f = a => [a.l, a.t, a.r, a.b].map(Math.round).join(','); for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1) over.push(a.id + ' ' + f(a) + ' / ' + b.id + ' ' + f(b)); }
    document.getElementById('bossbar').classList.remove('on'); if (made) made.remove(); document.querySelectorAll('#ui>.toast').forEach(t => t.remove()); R.hud.stack(); return { over, n: rs.length }; });
  const c1 = await column(page); ok('844×390: bar, region title and toasts stack without overlapping each other or the HUD', !c1.over.length && c1.n >= 8, JSON.stringify(c1));
  const g1 = await geo(page, 844, 390);
  ok('844×390: HUD inside the view, clear of the joystick zone and the button cluster', !g1.bad.length && g1.n > 8 && g1.cluster >= 6 && g1.rv === '844×390', JSON.stringify(g1));
  // the screenshot: banner + mobs + town + 25 % hp
  await page.evaluate(() => { R.player.hp = 250; R.towns.inside = () => ({ id: 'winterfell', name: 'Winterfell' }); R.state.p.gold = 1620; R.bus.emit('enter', 'riverlands'); for (let i = 0; i < 7; i++) R.step(); });
  await page.waitForTimeout(700); await page.screenshot({ path: SC + 'rpg_hud.png' });
  // the tutorial card + an achievement card at spawn: the achievement queues under the card in the message column, never over it; neither card
  // covers the HUD's hero block / fallen chip / minimap, A02's top row (map · bag · menu) or the chat button (they all stay tappable)
  const cards = page => page.evaluate(() => { for (let i = 0; i < 4 && R.ui.cur; i++) R.ui.close(); for (let i = 0; i < 7; i++) R.step(); document.querySelectorAll('#ui>.ach-toast,#tut').forEach(e => e.remove());
    const t = document.createElement('div'); t.id = 'tut'; t.className = 'tut'; t.innerHTML = '<div class="tut-wrap"><div class="tut-card" style="height:64px">x</div></div>'; document.getElementById('ui').appendChild(t);
    const a = document.createElement('div'); a.className = 'ach-toast'; a.style.height = '60px'; a.style.animation = 'none'; a.textContent = 'First Steps'; document.getElementById('ui').appendChild(a);
    R.hud.stack(); const tw = t.querySelector('.tut-wrap').getBoundingClientRect(); const o = { tutB: Math.round(tw.bottom), tutT: Math.round(tw.top), achT: Math.round(parseFloat(a.style.top)), achH: a.offsetHeight };   /* the card's own top: its entrance slides it from above */
    const f = r => [r.left, r.top, r.right, r.bottom].map(Math.round).join(','), hit = (p, q) => p.left < q.right - 1 && p.right > q.left + 1 && p.top < q.bottom - 1 && p.bottom > q.top + 1; o.over = [];
    for (const [nm, c] of [['tut', tw], ['ach', a.getBoundingClientRect()]]) for (const id of ['hud-bars', 'hud-port', 'hud-hall', 'minimap', 'ctl-top', 'prChat']) { const el = document.getElementById(id); if (!el || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue; const r = el.getBoundingClientRect(); if (r.width && hit(c, r)) o.over.push(nm + ' ' + f(c) + ' / ' + id + ' ' + f(r)); }
    o.tut = f(tw); o.ach = f(a.getBoundingClientRect()); o.cur = R.ui.cur; o.hud = getComputedStyle(document.getElementById('hud')).visibility;
    t.remove(); R.hud.stack(); const ar = a.getBoundingClientRect(); o.achAlone = f(ar);   // no tutorial card: the achievement card alone heads the column
    for (const id of ['hud-bars', 'hud-port', 'hud-hall', 'minimap', 'ctl-top', 'prChat']) { const el = document.getElementById(id); if (!el || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue; const r = el.getBoundingClientRect(); if (r.width && hit(ar, r)) o.over.push('ach alone ' + f(ar) + ' / ' + id + ' ' + f(r)); }
    a.remove(); return o; });
  const ta = await cards(page);
  ok('844×390: the achievement card queues below the tutorial card (no overlap)', ta.achT >= ta.tutB, JSON.stringify(ta));
  ok('844×390: the tutorial and achievement cards stay off the hero block, the fallen chip, the minimap, the top row and the chat button', ta.hud === 'visible' && !ta.over.length, JSON.stringify(ta.over.length ? ta.over : ta));
  // the quest-direction label: at the arrow's tip, ≥ 60 px from the hero's screen position (feet and body centre), for a mark in every direction
  const wl = await page.evaluate(() => { const out = []; const P = R.player; const c = document.createElement('canvas').getContext('2d'); R.ui.close && R.ui.close();
    // a fixed tilted projection (the 3D camera is not rendering here): ground scaled 0.5 × 0.3, height 1.6 px a unit, the hero's feet at 60 % of the screen
    const w2s0 = R.w2s; R.w2s = (x, y, z) => ({ x: (x - P.x) * 0.5 + R.vw / 2, y: (y - P.y) * 0.3 + R.vh * 0.6 - (z || 0) * 1.6 });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, mk = { id: 'q', x: P.x + Math.cos(a) * 4000, y: P.y + Math.sin(a) * 4000, kind: 'go' };
      R.quests = { markers: () => [mk], tracked: () => 'q' }; R.hud.drawWay(c); const L = R.hud.wayLabel; if (!L) { out.push({ k, none: 1 }); continue; }
      out.push({ k, d: Math.round(Math.hypot(L.x - L.hx, L.y - L.hy)), dm: Math.round(Math.hypot(L.x - L.hx, L.y - L.midY)), tip: Math.round(Math.hypot(L.x - L.tip.x, L.y - L.tip.y)) }); }
    R.w2s = w2s0; R.quests = { markers: () => [] }; return out; });
  ok('the "! N paces" label stays ≥ 60 px from the hero (feet and body) in all 8 directions, near the arrow tip', wl.length === 8 && wl.every(o => o.none || (o.d >= 60 && o.dm >= 60 && o.tip < 200)) && wl.filter(o => !o.none).length >= 6, JSON.stringify(wl));
  await page.close();
  // small phone
  const p2 = await mk(740, 360); await setup(p2);
  await p2.evaluate(() => { R.towns = { inside: () => ({ id: 'winterfell', name: 'Winterfell' }) }; R.spawn({ kind: 'mob', type: 'axe', x: 3800, y: 6000, hp: 30 }); for (let i = 0; i < 7; i++) R.step(); });
  const g2 = await geo(p2, 740, 360);
  ok('740×360: HUD inside the view, clear of the joystick zone and the button cluster', !g2.bad.length && g2.n > 8 && g2.cluster >= 6 && g2.rv === '740×360', JSON.stringify(g2));
  const c2 = await column(p2); ok('740×360: the message column stacks without overlaps', !c2.over.length && c2.n >= 8, JSON.stringify(c2));
  const ta2 = await cards(p2);
  ok('740×360: the achievement card queues below the tutorial card (no overlap)', ta2.achT >= ta2.tutB, JSON.stringify(ta2));
  ok('740×360: the tutorial and achievement cards stay off the hero block, the fallen chip, the minimap, the top row and the chat button', ta2.hud === 'visible' && !ta2.over.length, JSON.stringify(ta2.over.length ? ta2.over : ta2));
  const fonts = await p2.evaluate(() => { const o = {}; for (const id of ['hud-lvtxt', 'hud-title', 'hud-gold', 'hud-lvl']) o[id] = parseFloat(getComputedStyle(document.getElementById(id)).fontSize); return o; });
  ok('740×360: text ≥ 12 px', Object.values(fonts).every(f => f >= 12), JSON.stringify(fonts));
  await p2.screenshot({ path: SC + 'rpg_hud_360.png' }); await p2.close();
  await browser.close();
  for (const k in out) console.log(k + ': ' + out[k]);
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  const bad = Object.values(out).filter(v => /^FAIL/.test(v)).length + errors.length;
  console.log(bad ? bad + ' FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
