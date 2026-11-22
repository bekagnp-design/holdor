// A03 sprites: every mob key draws in every animation (real art or the placeholder) with no throw and no blank frame, walk frames move,
// deaths end empty, champion / hero / portrait / bar / name / shadow / zsort work, 100 draws < 50 ms, and the 3D frames
// (R.draw.frame / champFrame) are cached canvases: 40 distinct ones, the same object on a repeat, the LRU stays ≤ 600.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_sprites.js
//        HOLDOR_HTML=beta/index.html → test that build instead of building into the temp dir.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const SC = path.join(ROOT, '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
function build() { const out = path.join(os.tmpdir(), 'holdor_rpg_t_sprites.html'); const r = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), out], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('build failed: ' + r.stderr); return out; }
const HTML = process.env.HOLDOR_HTML ? path.resolve(ROOT, process.env.HOLDOR_HTML) : build();
// the old game's art for a few keys, in A04's shape, injected only when the build carries no A_ENEMY / A_CHAMP: the real slice pipeline gets tested without A04
function oldArt() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'base', 'index.v1.0.44.html'), 'utf8');
  const grab = n => { const m = src.match(new RegExp('^const ' + n + '=(\\{.*?\\});$', 'm')); return m ? JSON.parse(m[1]) : null; };
  const art = grab('ENEMY_ART'), meta = grab('ENEMY_META'), cfg = grab('ENEMY_CFG'), cart = grab('CHAMP_ART'), cmeta = grab('CHAMP_META');
  if (!art || !cart) return null;
  const KEYS = ['axe', 'hound', 'bat', 'walker', 'giant', 'wraith', 'crawler', 'necro', 'spider', 'rider'];
  const pick = (o, ks) => Object.fromEntries(ks.filter(k => o[k]).map(k => [k, o[k]]));
  return { A_ENEMY: { art: pick(art, KEYS), meta, cfg }, A_CHAMP: { art: pick(cart, ['jon', 'jon_attack', 'jon_portrait', 'arya', 'arya_attack', 'arya_portrait']), meta: cmeta } };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.route('**/telegram-web-app.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  const inj = oldArt(); if (inj) await page.addInitScript(d => { window.__INJ = d; }, inj);
  await page.goto('file://' + HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R && R.draw && R.draw.sprite && R.draw.frame, { timeout: 20000 });
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  // the build's own assets win; the injected art fills in when there are none
  const src = await page.evaluate(async () => {
    const has = () => { try { return typeof A_ENEMY !== 'undefined' && A_ENEMY && A_ENEMY.art && Object.keys(A_ENEMY.art).length; } catch (e) { return 0; } };
    if (!has() && window.__INJ) { window.A_ENEMY = window.__INJ.A_ENEMY; window.A_CHAMP = window.__INJ.A_CHAMP; }
    await R.draw.ready();
    return { art: R.draw.keys().filter(k => R.draw.hasArt(k)).length, keys: R.draw.keys().length, champArt: R.draw.hasChampArt('jon'), injected: !!window.__INJ && window.A_ENEMY === (window.__INJ || {}).A_ENEMY };
  });
  ok('sprite keys known (34 old enemies)', src.keys >= 34, src.keys + ' keys, ' + src.art + ' with art' + (src.injected ? ' (injected from the old build)' : ''));
  ok('the real art pipeline is exercised', src.art >= 1 && src.champArt, 'enemy art ' + src.art + ', jon ' + src.champArt);
  // one pass over every key × every animation on an offscreen canvas: no throw, no blank, walk frames differ, death ends empty
  const pass = noArt => page.evaluate(noArt => {
    R.draw.forceNoArt = noArt; R.draw.clearCache();
    const cv = document.createElement('canvas'); cv.width = cv.height = 220; const g = cv.getContext('2d');
    const paint = fn => { g.clearRect(0, 0, 220, 220); fn(); const d = g.getImageData(0, 0, 220, 220).data; let n = 0, h = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) { n++; h = (h * 31 + i + d[i - 1]) | 0; } return { n, h }; };
    const O = (an, t, extra) => Object.assign({ ctx: g, screen: true, z: 1, anim: an, t, face: 1, shadow: true, scale: 70 }, extra || {});
    const out = { bad: [], blank: [], moves: 0, dies: 0, n: 0, flash: 0, left: 0 };
    for (const key of R.draw.keys()) { out.n++;
      for (const an of ['idle', 'walk', 'attack', 'hurt', 'die']) {
        try {
          const a = paint(() => R.draw.sprite(key, 110, 170, O(an, 0.12)));
          if (a.n < 120) out.blank.push(key + ':' + an + ':' + a.n);
          if (an === 'walk') { const hs = new Set([a.h]); for (const t of [0.21, 0.37, 0.44]) hs.add(paint(() => R.draw.sprite(key, 110, 170, O('walk', t))).h); if (hs.size >= 2) out.moves++; const c = paint(() => R.draw.sprite(key, 110, 170, O('walk', 0.12, { face: -1 }))); if (c.n > 120 && c.h !== a.h) out.left++; }
          if (an === 'hurt') { const b = paint(() => R.draw.sprite(key, 110, 170, O('hurt', 0.03))); if (b.n > 120 && b.h !== a.h) out.flash++; }
          if (an === 'die') { const over = paint(() => R.draw.sprite(key, 110, 170, O('die', 9))); const mid = paint(() => R.draw.sprite(key, 110, 170, O('die', R.draw.deathTime(key) * 0.5))); if (over.n === 0 && mid.n > 0 && mid.h !== a.h) out.dies++; }
        } catch (e) { out.bad.push(key + ':' + an + ':' + e.message); }
      }
    }
    // champion: stance for idle/walk, the attack sheet while attacking, hurt, die; plus the hero (a champion) and the placeholder hero
    out.champ = []; for (const an of ['idle', 'walk', 'attack', 'hurt', 'die']) { try { const a = paint(() => R.draw.champ('jon', 110, 170, O(an, 0.12))); if (a.n < 120) out.champ.push(an + ':blank'); } catch (e) { out.champ.push(an + ':' + e.message); } }
    const idle = paint(() => R.draw.champ('jon', 110, 170, O('idle', 0.12))), atk = paint(() => R.draw.champ('jon', 110, 170, O('attack', 0.12))); out.champAtkDiffers = idle.h !== atk.h;
    R.state = R.newState ? R.newState() : { p: {} }; R.state.p.hero = 'jon'; out.hero = paint(() => R.draw.hero(110, 170, O('walk', 0.2))).n;
    R.state.p.hero = null; out.heroPH = paint(() => R.draw.hero(110, 170, O('walk', 0.2))).n;
    // ui helpers
    out.portrait = (() => { const c = R.draw.portrait('jon', 48); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return { n, same: R.draw.portrait('jon', 48) === c, url: typeof R.draw.portraitURL('jon') === 'string' && R.draw.portraitURL('jon').startsWith('data:'), w: c.width }; })();
    const bar = paint(() => R.draw.bar(110, 100, 60, 6, 0.6, '#7fd06a', { ctx: g, screen: true })), bar0 = paint(() => R.draw.bar(110, 100, 60, 6, 0, '#7fd06a', { ctx: g, screen: true }));
    out.bar = bar.n; out.barFill = bar.h !== bar0.h && bar0.n > 60;
    out.name = paint(() => R.draw.name(110, 100, 'WIGHT', '#e9eef5', { ctx: g, screen: true })).n;
    out.shadow = paint(() => R.draw.shadow(110, 100, 20, 8, { ctx: g, screen: true })).n;
    const ents = [{ id: 1, y: 50, kind: 'mob' }, { id: 2, y: 10, kind: 'mob' }, { id: 3, y: 30, kind: 'drop' }, { id: 4, y: 5, kind: 'mob', type: 'bat' }, { id: 5, y: 10, kind: 'mob' }];
    out.zsort = R.draw.zsort(ents).map(e => e.id).join(',');
    const m = R.draw.measure('walker'); out.measure = m && Math.round(m.h) === 48 && m.w > 40 && !m.fly && R.draw.measure('bat').fly && R.draw.deathKind('walker') === 'shatter' && R.draw.deathKind('wraith') === 'dissolve' && R.draw.deathKind('bat') === 'drop' && R.draw.deathKind('axe') === 'fall' && R.draw.deathKind('giant') === 'shatter';
    return out;
  }, noArt);
  const A = await pass(false);
  ok('every key × animation draws without a throw', A.bad.length === 0, A.bad.slice(0, 4).join(' | '));
  ok('no blank frame', A.blank.length === 0, A.blank.slice(0, 6).join(' '));
  ok('walk frames move for every key', A.moves === A.n, A.moves + '/' + A.n);
  ok('facing left mirrors the frame', A.left === A.n, A.left + '/' + A.n);
  ok('the hurt flash shows for every key', A.flash === A.n, A.flash + '/' + A.n);
  ok('the death animation changes the frame and ends empty', A.dies === A.n, A.dies + '/' + A.n);
  ok('the champion draws in every animation, the attack sheet differs', A.champ.length === 0 && A.champAtkDiffers, A.champ.join(' '));
  ok('the hero draws as a champion and as a placeholder', A.hero > 120 && A.heroPH > 120, A.hero + ' / ' + A.heroPH);
  ok('portrait: cached canvas + data URL', A.portrait.n > 400 && A.portrait.same && A.portrait.url && A.portrait.w === 96, JSON.stringify(A.portrait));
  ok('bar / name / shadow draw', A.bar > 150 && A.barFill && A.name > 60 && A.shadow > 200, A.bar + ' fill:' + A.barFill + ' ' + A.name + ' ' + A.shadow);
  ok('zsort: drops first, then by y (id breaks ties), flyers last', A.zsort === '3,2,5,1,4', A.zsort);
  ok('measure / deathKind', A.measure === true);
  const B = await pass(true);
  ok('placeholders: every key × animation draws with no art', B.bad.length === 0 && B.blank.length === 0 && B.moves === B.n && B.dies === B.n && B.champ.length === 0 && B.hero > 120, (B.bad.concat(B.blank)).slice(0, 5).join(' ') + ' moves ' + B.moves + '/' + B.n);
  // the 3D frames: distinct cached canvases, identity on a repeat, facing mirrored, death faded, the LRU bounded
  const F = await page.evaluate(() => {
    R.draw.forceNoArt = false; R.draw.clearCache();
    const alpha = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, s = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) { n++; s += d[i]; } return { n, mean: n ? s / n : 0 }; };
    const set = new Set(), out = { bad: [], blank: [], same: 0, calls: 0, keys: new Set() };
    const keys = ['axe', 'hound', 'bat', 'walker', 'wraith', 'giant', 'crawler', 'spider'];
    for (const key of keys) for (const an of ['idle', 'walk', 'attack', 'hurt', 'die']) for (const t of [0.05, 0.17]) {
      try { const c = R.draw.frame(key, an, t, 1, { scale: 0.5 }); out.calls++; set.add(c); if (!(c instanceof HTMLCanvasElement) || !c.meta || !(c.meta.ax > 0) || !(c.meta.ay > 0)) out.bad.push(key + ':' + an + ':shape'); else if (alpha(c).n < 30 && !(an === 'die' && t > 0.1)) out.blank.push(key + ':' + an + ':' + t);
        if (R.draw.frame(key, an, t, 1, { scale: 0.5 }) === c) out.same++; out.keys.add(R.draw.frameKey(key, an, t, 1, { scale: 0.5 })); } catch (e) { out.bad.push(key + ':' + an + ':' + e.message); }
    }
    out.distinct = set.size; out.keyCount = out.keys.size; delete out.keys;
    // quantisation: two times inside one walk phase share the canvas, the next phase does not
    const w0 = R.draw.frame('axe', 'walk', 0.01, 1), w1 = R.draw.frame('axe', 'walk', 0.02, 1), w2 = R.draw.frame('axe', 'walk', 0.30, 1); out.quant = w0 === w1 && w0 !== w2 && R.draw.frameKey('axe', 'walk', 0.01, 1) === R.draw.frameKey('axe', 'walk', 0.02, 1);
    // natural size × scale: axe is 147 px tall in its sheet
    out.natural = w0.meta.h === 147 && Math.round(R.draw.frame('axe', 'idle', 0, 1, { scale: 0.5 }).meta.h) === 74;
    // mirroring: the left-facing frame is the right-facing one flipped
    const r = R.draw.frame('axe', 'idle', 0, 1), l = R.draw.frame('axe', 'idle', 0, -1); const dr = r.getContext('2d').getImageData(0, 0, r.width, r.height).data, dl = l.getContext('2d').getImageData(0, 0, l.width, l.height).data; let mir = 0, tot = 0;
    for (let y = 0; y < r.height; y += 3) for (let x = 0; x < r.width; x += 3) { const i = (y * r.width + x) * 4 + 3, j = (y * r.width + (r.width - 1 - x)) * 4 + 3; if (dr[i] > 10 || dl[j] > 10) { tot++; if (Math.abs(dr[i] - dl[j]) < 40) mir++; } }
    out.mirror = tot > 50 && mir / tot > 0.9 && l !== r && l.meta.face === -1;
    // hurt flash: the flash frame is brighter than the idle frame; the death fades: the last phase is fainter than the first
    const lum = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { s += d[i] + d[i + 1] + d[i + 2]; n++; } return n ? s / n : 0; };
    out.flash = lum(R.draw.frame('axe', 'hurt', 0.02, 1)) > lum(R.draw.frame('axe', 'idle', 0, 1)) + 60;
    const d0 = alpha(R.draw.frame('axe', 'die', 0.01, 1)), d3 = alpha(R.draw.frame('axe', 'die', 0.7, 1)); out.fade = d0.n > 200 && (d3.n < d0.n * 0.9 || d3.mean < d0.mean * 0.7);
    const s0 = alpha(R.draw.frame('walker', 'die', 0.01, 1)), s3 = alpha(R.draw.frame('walker', 'die', 0.38, 1)); out.shatter = s0.n > 200 && s3.mean < s0.mean * 0.6;
    // champion frames: stance / attack sheets, idle breathing differs between phases, the hero's frame is the champion's
    const ci = R.draw.champFrame('jon', 'idle', 0.1, 1), ci2 = R.draw.champFrame('jon', 'idle', 0.9, 1), cw = R.draw.champFrame('jon', 'walk', 0.1, 1), ca = R.draw.champFrame('jon', 'attack', 0.1, 1), ch = R.draw.champFrame('jon', 'hurt', 0.02, 1), cd = R.draw.champFrame('jon', 'die', 0.3, 1);
    out.champ = [ci, ci2, cw, ca, ch, cd].every(c => c instanceof HTMLCanvasElement && alpha(c).n > 100) && ci !== ci2 && ci !== cw && cw !== ca && R.draw.champFrame('jon', 'idle', 0.1, 1) === ci && ci.meta.h === 214 && lum(ch) > lum(ci) + 60;
    out.champKey = R.draw.champFrameKey('jon', 'attack', 0.1, 1) !== R.draw.champFrameKey('jon', 'idle', 0.1, 1) && R.draw.champFrameKey('jon', 'idle', 0.1, 1) === R.draw.champFrameKey('jon', 'idle', 0.11, 1);
    R.state = R.newState ? R.newState() : { p: {} }; R.state.p.hero = 'jon'; out.hero = R.draw.heroFrame('walk', 0.1, 1) === cw && R.draw.heroFrameKey('walk', 0.1, 1) === R.draw.champFrameKey('jon', 'walk', 0.1, 1);
    // a champion without art gets a placeholder frame, keyed apart from the art one
    const ph = R.draw.champFrame('nobody', 'walk', 0.1, 1); out.champPH = ph instanceof HTMLCanvasElement && alpha(ph).n > 60 && /\|p\|/.test(R.draw.champFrameKey('nobody', 'walk', 0.1, 1)) && /\|a\|/.test(R.draw.champFrameKey('jon', 'walk', 0.1, 1));
    // the LRU: flood it with frames of many sizes, it stays ≤ 600 and the newest survive
    for (let i = 0; i < 700; i++) R.draw.frame(keys[i % keys.length], 'walk', (i % 8) / 8 * 0.52, 1, { scale: 0.2 + (i % 50) * 0.01 });
    const last = R.draw.frame(keys[699 % keys.length], 'walk', (699 % 8) / 8 * 0.52, 1, { scale: 0.2 + (699 % 50) * 0.01 });
    out.lru = R.draw.cacheSize() <= 600 && R.draw.cacheSize() > 300 && last instanceof HTMLCanvasElement; out.cache = R.draw.cacheSize();
    return out;
  });
  ok('3D frames: 80 calls give ≥ 40 distinct canvases with anchors, none blank', F.bad.length === 0 && F.blank.length === 0 && F.distinct >= 40 && F.keyCount === F.distinct, F.distinct + ' distinct, keys ' + F.keyCount + ' ' + F.bad.concat(F.blank).slice(0, 4).join(' '));
  ok('a repeated call returns the same canvas object', F.same === F.calls, F.same + '/' + F.calls);
  ok('t is quantised to the phase; frameKey is stable', F.quant === true);
  ok('frames are the sheet\'s natural size × scale', F.natural === true);
  ok('facing left is the mirrored frame', F.mirror === true);
  ok('hurt flash baked, death fade / shatter baked', F.flash && F.fade && F.shatter, [F.flash, F.fade, F.shatter].join(' '));
  ok('champion frames: sheets, breathing, same object, hurt flash; the hero is the champion', F.champ && F.champKey && F.hero && F.champPH, [F.champ, F.champKey, F.hero, F.champPH].join(' '));
  ok('the frame LRU stays ≤ 600', F.lru === true, F.cache + ' cached');
  // the real canvas: a scene of 30 sprites in world space (shadows, bars, names), then the budget: 100 draws < 50 ms (warm)
  const P = await page.evaluate(() => {
    R.draw.forceNoArt = false; R.draw.clearCache(); R.cam.x = 0; R.cam.y = 0; R.cam.z = 1; const ctx = R.ctx; ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); ctx.clearRect(0, 0, R.vw, R.vh);
    ctx.fillStyle = '#1b2a1e'; ctx.fillRect(0, 0, R.vw, R.vh);
    const keys = R.draw.keys(), anims = ['idle', 'walk', 'attack', 'hurt', 'walk'];
    const ents = []; for (let i = 0; i < 30; i++) ents.push({ id: i + 1, type: keys[i % keys.length], x: -150 + (i % 5) * 75, y: -330 + Math.floor(i / 5) * 110, anim: anims[i % 5], t: 0.1 + i * 0.07, face: i % 3 ? 1 : -1, kind: 'mob' });
    const drawAll = () => { for (const e of R.draw.zsort(ents)) { R.draw.sprite(e.type, e.x, e.y, { anim: e.anim, t: e.t, face: e.face, shadow: true, seed: e.id }); const m = R.draw.measure(e.type); R.draw.bar(e.x, e.y - m.h - 8, 36, 4, 0.5 + (e.id % 5) / 10, '#e14b4b'); R.draw.name(e.x, e.y - m.h - 12, e.type.toUpperCase(), '#e9eef5'); } };
    const t0 = performance.now(); drawAll(); const cold = performance.now() - t0;
    let best = 1e9; for (let rep = 0; rep < 5; rep++) { const t1 = performance.now(); for (let n = 0; n < 100; n++) { const e = ents[n % 30]; R.draw.sprite(e.type, e.x, e.y, { anim: e.anim, t: e.t + n * 0.01, face: e.face, shadow: true, seed: e.id }); } best = Math.min(best, performance.now() - t1); }
    ctx.clearRect(0, 0, R.vw, R.vh); ctx.fillStyle = '#1b2a1e'; ctx.fillRect(0, 0, R.vw, R.vh); drawAll(); R.draw.champ('jon', 0, 170, { anim: 'walk', t: 0.3, shadow: true }); R.draw.name(0, 170 - 70, 'JON', '#e3b661'); R.draw.champ('arya', 80, 170, { anim: 'attack', t: 0.1, face: -1, shadow: true }); R.draw.sprite('walker', -80, 170, { anim: 'die', t: 0.15, shadow: true }); R.draw.sprite('dragon', 0, 330, { anim: 'walk', t: 0.4, shadow: true });
    const d = ctx.getImageData(0, 0, R.cv.width, R.cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 160) if (d[i] > 60 || d[i + 2] > 60) n++;
    return { cold: +cold.toFixed(1), best: +best.toFixed(1), painted: n, cache: R.draw.cacheSize() };
  });
  ok('100 warm draws under 50 ms on the game canvas', P.best < 50, P.best + ' ms (cold scene ' + P.cold + ' ms, ' + P.cache + ' frames cached)');
  ok('the scene paints on the game canvas', P.painted > 400, P.painted + ' sampled px');
  await page.screenshot({ path: SC + 'rpg_sprites.png' });
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('ERR ' + (e.stack || e)); process.exit(1); });
