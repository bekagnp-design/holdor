// H1 — the hero seen from behind (src/rpg/js/06b_hero_back.js): R.draw.heroBack(anim, t, o) / R.draw.heroBackKey(...).
// Every class × 7 houses × every anim and phase renders non-blank, is cached (the same canvas object comes back), takes ≤ 3 ms per new
// frame, keys are stable inside a phase and differ across phases, the figure stands as tall as R.draw.heroFrame's, it works without the
// A_CHAMP art; contact sheets .shots/rpg/hero_back_sheet.png + hero_back_houses.png, and the hero drawn with it in the 3D game, camera
// behind (.shots/rpg/hero_back_game.png).
// usage: HOLDOR_HTML=$F RPG_HTML=$F RPG_NOBUILD=1 CHROMIUM_PATH=… node tests/rpg/t_hero_back.js
'use strict';
const L = require('./lib');
const fs = require('fs'), path = require('path');
// a light page with only the module (fast under load): the bulk checks and the contact sheets run there; the built game does the rest
function lightPage() {
  const src = fs.readFileSync(path.join(L.ROOT, 'src', 'rpg', 'js', '06b_hero_back.js'), 'utf8');
  const f = path.join(L.SHOTS, 'hero_back_unit.html'); fs.mkdirSync(L.SHOTS, { recursive: true });
  fs.writeFileSync(f, '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#333"><script>window.R={draw:{heroFrame:function(){return null}}};' + src.replace(/<\/script/g, '<\\/script') + '</script>');
  return f;
}
(async () => {
  const { page, errors, close } = await L.launch({ w: 390, h: 844 });
  await page.goto('file://' + lightPage());
  const has = await page.evaluate(() => !!(R.draw && R.draw.heroBack && R.draw.heroBackKey));
  L.ok('R.draw.heroBack + heroBackKey exist', has);
  if (!has) { await close(); return L.report(); }

  /* ---- every class × house × anim × phase ---- */
  const r = await page.evaluate(() => {
    const D = R.draw, CL = ['knight', 'ranger', 'maester'], HS = ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'];
    const AN = ['idle', 'walk', 'run', 'attack', 'hurt', 'die', 'dodge'], N = D.heroBackN, DUR = D.heroBackDur;
    D.heroBackClear(); const out = { n: 0, blank: [], times: [], uncached: 0, badMeta: 0, keyDup: 0 };
    const ink = c => { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n; };
    for (const cls of CL) for (const house of HS) for (const an of AN) {
      const keys = new Set();
      for (let f = 0; f < N[an]; f++) {
        const t = (f + 0.5) / N[an] * DUR[an], o = { hero: null, cls, house, scale: 1, face: f % 2 ? -1 : 1, lean: 0 };
        const k = D.heroBackKey(an, t, o); if (keys.has(k)) out.keyDup++; keys.add(k);
        const t0 = performance.now(), c = D.heroBack(an, t, o), ms = performance.now() - t0; out.times.push(ms); out.n++;
        if (D.heroBack(an, t, o) !== c) out.uncached++;
        if (!c.meta || !(c.meta.h > 0) || !(c.meta.ax > 0) || !(c.meta.ay > 0) || c.meta.ay > c.height) out.badMeta++;
        if (ink(c) < 60) out.blank.push(cls + '/' + house + '/' + an + '/' + f);
      }
    }
    const s = out.times.slice().sort((a, b) => a - b); out.med = s[s.length >> 1]; out.p95 = s[Math.floor(s.length * 0.95)]; out.max = s[s.length - 1]; out.mean = s.reduce((a, b) => a + b, 0) / s.length; delete out.times;
    // keys: stable inside a phase, distinct across phases, the same with o omitted fields
    const kA = D.heroBackKey('walk', 0.01, { cls: 'knight', house: 'stark' }), kB = D.heroBackKey('walk', 0.09, { cls: 'knight', house: 'stark' }), kC = D.heroBackKey('walk', 0.11, { cls: 'knight', house: 'stark' });
    out.keys = { sameInPhase: kA === kB, diffAcross: kA !== kC, loop: D.heroBackKey('walk', 0.01 + DUR.walk, { cls: 'knight', house: 'stark' }) === kA,
      idle4: new Set([0, 1, 2, 3, 4, 5, 6, 7].map(i => D.heroBackKey('idle', i * DUR.idle / 8, {}))).size === 4,
      atk4: new Set([0, 1, 2, 3, 4, 5, 6, 7].map(i => D.heroBackKey('attack', i * DUR.attack / 8, {}))).size === 4,
      walk8: new Set([...Array(16).keys()].map(i => D.heroBackKey('walk', i * DUR.walk / 16, {}))).size === 8,
      keyOnly: typeof D.heroBack('idle', 0, { keyOnly: true }) === 'string' };
    // physics cloak / lean / speed / gear variants
    let okV = true; try { for (const cl of [-0.6, 0, 0.6]) for (const ln of [-1, 0, 1]) { const c = D.heroBack('run', 0.1, { cls: 'knight', house: 'lannister', cloak: cl, lean: ln, speed: 1 }); if (ink(c) < 60) okV = false; }
      for (const w of ['axe', 'mace', 'dagger', 'crossbow', 'rod', 'tome']) { const cls = /axe|mace/.test(w) ? 'knight' : /dagger|crossbow/.test(w) ? 'ranger' : 'maester';
        for (const an of ['idle', 'attack']) for (let f = 0; f < 4; f++) { const c = D.heroBack(an, f * 0.08, { cls, house: 'tyrell', gear: { weapon: { name: w, rar: 3 }, armor: { rar: 2 } } }); if (ink(c) < 60) okV = false; } } } catch (e) { okV = 'err ' + e.message; }
    out.variants = okV; out.cache = D.heroBackCacheSize();
    return out;
  });
  L.ok('every class × 7 houses × 7 anims × all phases renders (' + r.n + ' frames)', r.n === 3 * 7 * (4 + 8 + 8 + 4 + 2 + 4 + 4) && !r.blank.length, r.blank.slice(0, 6).join(' '));
  L.ok('cached: a repeated call returns the same canvas', r.uncached === 0, r.uncached);
  L.ok('meta {ax, ay, h} on every frame', r.badMeta === 0, r.badMeta);
  L.ok('keys unique per phase', r.keyDup === 0, r.keyDup);
  L.ok('≤ 3 ms per new frame (mean / median / p95)', r.mean <= 3 && r.med <= 3 && r.p95 <= 3, 'mean ' + r.mean.toFixed(2) + ' med ' + r.med.toFixed(2) + ' p95 ' + r.p95.toFixed(2) + ' max ' + r.max.toFixed(2) + ' ms');
  L.ok('keys stable (in-phase same, across differ, loop, idle 4 / attack 4 / walk 8, keyOnly)', Object.values(r.keys).every(Boolean), JSON.stringify(r.keys));
  L.ok('cloak / lean / speed / gear variants render', r.variants === true, r.variants);

  /* ---- contact sheets ---- */
  await page.evaluate(() => {
    const D = R.draw, CL = ['knight', 'ranger', 'maester'], HS = ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'];
    const COLS = [['idle', 0], ['idle', 2], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['walk', i]), ...[0, 2, 4, 6].map(i => ['run', i]), ...[0, 1, 2, 3].map(i => ['attack', i]), ['hurt', 0], ...[0, 1, 2, 3].map(i => ['dodge', i]), ...[0, 1, 2, 3].map(i => ['die', i])];
    const px = 130, cw = 96, ch = 200, sheet = document.createElement('canvas'); sheet.width = COLS.length * cw + 20; sheet.height = CL.length * ch + 40; sheet.id = 'hbsheet';
    const g = sheet.getContext('2d'); const bg = g.createLinearGradient(0, 0, 0, sheet.height); bg.addColorStop(0, '#6f7f73'); bg.addColorStop(1, '#4b5a4f'); g.fillStyle = bg; g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = '11px sans-serif'; g.fillStyle = '#e8e8e0';
    COLS.forEach(([an, f], j) => g.fillText(an + f, 14 + j * cw, 14));
    CL.forEach((cls, i) => COLS.forEach(([an, f], j) => { const house = HS[(i * 2 + 1) % 7], t = (f + 0.5) / D.heroBackN[an] * D.heroBackDur[an];
      const c = D.heroBack(an, t, { hero: null, cls, house, px, face: 1 }), x = 10 + j * cw + cw / 2, y = 30 + i * ch + ch - 20;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, 22, 6, 0, 0, 7); g.fill(); g.drawImage(c, x - c.meta.ax, y - c.meta.ay); }));
    const s2 = document.createElement('canvas'); s2.id = 'hbhouses'; const cw2 = 150, ch2 = 270; s2.width = HS.length * cw2 * 2 + 20; s2.height = CL.length * ch2 + 20; const g2 = s2.getContext('2d');
    const bg2 = g2.createLinearGradient(0, 0, 0, s2.height); bg2.addColorStop(0, '#7d8c7c'); bg2.addColorStop(1, '#55604f'); g2.fillStyle = bg2; g2.fillRect(0, 0, s2.width, s2.height);
    CL.forEach((cls, i) => HS.forEach((house, j) => [['idle', 0], ['walk', 2]].forEach(([an, f], q) => { const t = (f + 0.5) / D.heroBackN[an] * D.heroBackDur[an];
      const c = D.heroBack(an, t, { hero: null, cls, house, px: 200, face: q ? -1 : 1 }), x = 10 + (j * 2 + q) * cw2 + cw2 / 2, y = 10 + i * ch2 + ch2 - 20;
      g2.fillStyle = 'rgba(0,0,0,.25)'; g2.beginPath(); g2.ellipse(x, y, 30, 8, 0, 0, 7); g2.fill(); g2.drawImage(c, x - c.meta.ax, y - c.meta.ay); })));
    window.__hb = { a: sheet.toDataURL('image/png'), b: s2.toDataURL('image/png') };
  });
  const urls = await page.evaluate(() => window.__hb);
  const pA = path.join(L.SHOTS, 'hero_back_sheet.png'), pB = path.join(L.SHOTS, 'hero_back_houses.png');
  fs.writeFileSync(pA, Buffer.from(urls.a.split(',')[1], 'base64')); fs.writeFileSync(pB, Buffer.from(urls.b.split(',')[1], 'base64'));
  L.ok('contact sheets written', fs.statSync(pA).size > 20000 && fs.statSync(pB).size > 20000, pA + ' ' + pB);

  /* ---- the built game: same height as heroFrame, the champion's defaults, no art ---- */
  if (process.env.HB_FAST) { L.skip('built game checks', 'HB_FAST'); await close(); return L.report(); }
  L.build();
  const b = await L.boot(page, { save: L.fakeSave({ house: 'stark', hero: 'jon', cls: 'knight', lvl: 4 }), timeout: 180000, wait: 60000 });
  L.ok('boot', b.booted || b.running, JSON.stringify({ cur: b.cur, running: b.running }));
  const r2 = await page.evaluate(() => {
    const D = R.draw, AN = ['idle', 'walk', 'run', 'attack', 'hurt', 'die', 'dodge'], out = {};
    const ink = c => { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n; };
    if (!D.heroBack) return { missing: true };
    // the same height as heroFrame's at the same scale
    const hf = D.heroFrame('idle', 0, 1, { scale: 0.7 }), hb = D.heroBack('idle', 0, { scale: 0.7 });
    out.h = { front: hf && hf.meta ? hf.meta.h : 0, back: hb.meta.h, sc: hb.meta.sc, frontSc: hf && hf.meta ? hf.meta.sc : 0 };
    // the champion's own house / class by default, and the hair sampled from its sheet when loaded
    const ch = R.champs && R.champs.get && R.state && R.state.p && R.champs.get(R.state.p.hero);
    out.def = { key: D.heroBackKey('idle', 0, {}), house: ch && ch.house, cls: ch && ch.cls };
    // without the A_CHAMP art
    D.forceNoArt = true; D.heroBackClear(); let okNo = true;
    try { for (const an of AN) { const c = D.heroBack(an, 0.1, { hero: R.state.p.hero }); if (ink(c) < 60) okNo = false; } } catch (e) { okNo = false; }
    D.forceNoArt = false; D.heroBackClear(); out.noArt = okNo;
    return out;
  });
  L.ok('built page carries R.draw.heroBack', !r2.missing);
  if (!r2.missing) {
    L.ok('as tall as heroFrame at the same scale', r2.h.front > 0 && Math.abs(r2.h.back - r2.h.front) <= 2 && Math.abs(r2.h.sc - r2.h.frontSc) < 1e-6, JSON.stringify(r2.h));
    L.ok('defaults to the champion\'s house + class', r2.def.house && r2.def.key.includes('|' + r2.def.house + '|') && r2.def.key.includes('|' + r2.def.cls + '|'), r2.def.key);
    L.ok('works without the A_CHAMP art', r2.noArt);
  }
  /* ---- in the game: the 3D renderer draws the hero billboard through e.frame → heroBack, the camera behind ---- */
  const g3 = await page.evaluate(() => {
    if (!R.player) return { skip: 'no player' };
    const P = R.player; P.frame = (anim, t, face) => R.draw.heroBack(anim, t, { face, lean: 0, speed: anim === 'walk' ? 0.6 : 0 });
    if (R.cam) { R.cam.yaw = R.cam.yaw || 0; R.cam.dist = 340; }
    if (R.ui && R.ui.close) try { R.ui.close(); } catch (e) {}
    return { r3: !!R.render3d, x: P.x, y: P.y };
  });
  if (g3.skip) L.skip('game shot', g3.skip);
  else {
    // walk the hero forward a little (away from the camera) so the walk frames show
    const rel = await L.joystick(page, 0, -60, 600); await L.steps(page, 40); await page.waitForTimeout(300);
    const pth = await L.shot(page, 'hero_back_game'); await rel(); await L.steps(page, 10);
    const st = await page.evaluate(() => ({ anim: R.player.anim, k: R.draw.heroBackKey(R.player.anim, R.player.animT || 0, { face: R.player.face }) }));
    L.ok('game screenshot with the back-view hero (3D: ' + g3.r3 + ')', !!pth, (pth || '') + ' ' + st.anim + ' ' + st.k);
  }
  L.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await close(); L.report();
})().catch(e => { console.log('FAIL crash', e && e.stack || e); process.exit(1); });
