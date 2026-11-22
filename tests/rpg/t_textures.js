// tests/rpg/t_textures.js — G10's texture + plant art library (src/rpg/js/09c_textures.js, R.tex).
// Part 1 runs the module alone (window.R = {} and no THREE): every texture and plant generates, is not blank, textures are seamless,
// plants have clear corners and an opaque body, caches return the same objects, get()/normal()/treeTex() → null without THREE,
// the common set's generation time is printed and must stay under 1.5 s; a contact sheet → .shots/rpg/g10_sheet.png.
// Part 2 boots the built game: R.tex is there, get()/normal()/treeTex() return THREE textures set up as promised, ready resolves,
// the background pump never takes more than a few ms per frame.
'use strict';
const L = require('./lib');
const fs = require('fs'), path = require('path');
const SRC = path.resolve(__dirname, '..', '..', 'src', 'rpg', 'js', '09c_textures.js');

(async () => {
  const html = L.build();
  /* ---------- part 1: the module alone ---------- */
  {
    const { page, errors, close } = await L.launch({ w: 1400, h: 900 });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#1b1d1f;color:#ddd;font:12px sans-serif"></body></html>');
    await page.addScriptTag({ content: 'window.R = { err: m => (window.__errs = (window.__errs || [])).push(m) };' });
    await page.addScriptTag({ content: fs.readFileSync(SRC, 'utf8') });
    const api = await page.evaluate(() => ['get', 'canvas', 'names', 'normal', 'tree', 'treeTex', 'kinds', 'biomePlants'].filter(k => typeof R.tex[k] !== 'function'));
    L.ok('R.tex has the whole API', api.length === 0 && await page.evaluate(() => R.tex.ready instanceof Promise), 'missing ' + api.join(','));
    const need = { names: 'grass grass_dry meadow_flowers snow ice sand sand_red rock rock_dark mud dirt_road cobble stone_wall stone_dark plaster wood_planks roof_tiles_red roof_slate roof_thatch bark bark_birch leaves moss'.split(' '),
      kinds: 'pine fir spruce_snow birch oak oak_windbent willow weirwood ash apple olive cypress palm dead_tree shrub gorse heather reeds fern grass_tuft grass_tall flowers_red flowers_yellow flowers_blue flowers_white vines cactus_scrub mushroom stump'.split(' ') };
    const lists = await page.evaluate(() => ({ names: R.tex.names(), kinds: R.tex.kinds() }));
    L.ok('names() lists every required texture', need.names.every(n => lists.names.includes(n)), need.names.filter(n => !lists.names.includes(n)).join(','));
    L.ok('kinds() lists every required plant', need.kinds.every(n => lists.kinds.includes(n)), need.kinds.filter(n => !lists.kinds.includes(n)).join(','));

    // the common set, timed (makeAll does what the pump would, at once)
    const tm = await page.evaluate(() => { const ms = R.tex.makeAll(); const it = Object.entries(R.tex.stats.items).sort((a, b) => b[1] - a[1]); return { ms, work: R.tex.stats.ms, size: R.tex.stats.size, ph: R.tex.stats.plantH, top: it.slice(0, 8).map(e => e[0] + ' ' + e[1].toFixed(0)), tex: it.filter(e => e[0][0] === 't').reduce((s, e) => s + e[1], 0), pl: it.filter(e => e[0][0] === 'p').reduce((s, e) => s + e[1], 0) }; });
    console.log('  timing: common set ' + tm.ms.toFixed(0) + ' ms (textures ' + tm.tex.toFixed(0) + ', plants ' + tm.pl.toFixed(0) + ') at ' + tm.size + ' px / plants ' + tm.ph + ' px; slowest: ' + tm.top.join(', '));
    L.ok('the common set generates in < 1.5 s', tm.ms < 1500, tm.ms.toFixed(0) + ' ms');
    L.ok('ready resolves once the common set is made', await page.evaluate(() => Promise.race([R.tex.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 3000))])));

    // every texture: not blank, seamless (opposite edges as alike as neighbouring columns / rows inside)
    const T = await page.evaluate(() => R.tex.names().map(n => {
      const c = R.tex.canvas(n), S = c.width, d = c.getContext('2d').getImageData(0, 0, S, S).data, px = (x, y) => (y * S + x) * 4;
      const lum = i => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      let m = 0, q = 0, N = 0; for (let i = 0; i < d.length; i += 4 * 13) { const l = lum(i); m += l; q += l * l; N++; } m /= N; const sd = Math.sqrt(q / N - m * m);
      const colDiff = (a, b) => { let s = 0; for (let y = 0; y < S; y++) for (let k = 0; k < 3; k++) s += Math.abs(d[px(a, y) + k] - d[px(b, y) + k]); return s / S / 3; };
      const rowDiff = (a, b) => { let s = 0; for (let x = 0; x < S; x++) for (let k = 0; k < 3; k++) s += Math.abs(d[px(x, a) + k] - d[px(x, b) + k]); return s / S / 3; };
      let ic = 0, ir = 0; const probes = [S >> 3, S >> 2, S >> 1, (S * 3) >> 2, (S * 7) >> 3]; probes.forEach(p => { ic += colDiff(p, p + 1); ir += rowDiff(p, p + 1); }); ic /= probes.length; ir /= probes.length;
      return { n, S, sd: +sd.toFixed(1), mean: +m.toFixed(0), ec: +colDiff(0, S - 1).toFixed(1), ic: +ic.toFixed(1), er: +rowDiff(0, S - 1).toFixed(1), ir: +ir.toFixed(1), same: R.tex.canvas(n) === c, avg: R.tex.avg(n) };
    }));
    const blank = T.filter(t => t.sd < 3), seam = T.filter(t => t.ec > Math.max(t.ic * 1.6, t.ic + 4) || t.er > Math.max(t.ir * 1.6, t.ir + 4));
    L.ok('every texture is painted (not blank)', !blank.length, blank.map(t => t.n + ' sd ' + t.sd).join(', '));
    L.ok('every texture is seamless (edge vs inside step)', !seam.length, seam.map(t => t.n + ' col ' + t.ec + '/' + t.ic + ' row ' + t.er + '/' + t.ir).join('; '));
    console.log('  seams (edge/inside col, row): ' + T.map(t => t.n + ' ' + t.ec + '/' + t.ic + ',' + t.er + '/' + t.ir).join('  '));
    L.ok('canvas() is cached', T.every(t => t.same));
    L.ok('avg() gives a colour', T.every(t => /^#[0-9a-f]{6}$/.test(t.avg)), T.map(t => t.avg).join(' '));

    // every plant, three variants
    const P = await page.evaluate(() => R.tex.kinds().map(k => [0, 1, 2].map(s => {
      const p = R.tex.tree(k, s), c = p.canvas, w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, a = (x, y) => d[((y | 0) * w + (x | 0)) * 4 + 3];
      const corners = [a(0, 0), a(w - 1, 0), a(0, h - 1 - Math.min(h - 1, 0)), a(w - 1, 0)].concat([a(1, 1), a(w - 2, 1)]);
      let op = 0, n = 0; for (let y = h * 0.25; y < h * 0.95; y += 2) for (let x = w * 0.3; x < w * 0.7; x += 2) { n++; if (a(x, y) > 200) op++; }
      let any = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) any++;
      return { k, s, w, h, ax: p.ax, ay: p.ay, worldH: p.worldH, clear: Math.max(...corners), op: op / n, filled: any / (d.length / 16), same: R.tex.tree(k, s + 3) === p, diff: s ? R.tex.tree(k, 0).canvas !== c : true };
    })).flat());
    const ph = await page.evaluate(() => R.tex.stats.plantH);
    const badClear = P.filter(p => p.clear > 0), badOp = P.filter(p => p.op < 0.12), badSize = P.filter(p => p.h > ph || p.h < 16 || !(p.worldH > 0) || !(p.ax > 0 && p.ax < p.w) || !(p.ay > p.h * 0.7 && p.ay <= p.h));
    L.ok('every plant: top corners transparent', !badClear.length, badClear.map(p => p.k + '#' + p.s).join(','));
    L.ok('every plant: an opaque body in the middle', !badOp.length, badOp.map(p => p.k + '#' + p.s + ' ' + p.op.toFixed(2)).join(','));
    L.ok('every plant: size ≤ plant height, feet near the bottom, worldH set', !badSize.length, badSize.map(p => p.k + '#' + p.s + ' ' + p.w + 'x' + p.h + ' ax ' + p.ax + ' ay ' + p.ay + ' wh ' + p.worldH).join(','));
    L.ok('tree() caches by seed % 3 and the variants differ', P.every(p => p.same && p.diff));
    console.log('  plants (w×h, worldH): ' + P.filter(p => !p.s).map(p => p.k + ' ' + p.w + 'x' + p.h + ' ' + p.worldH).join(', '));

    // without THREE
    const no3 = await page.evaluate(() => ({ get: R.tex.get('grass'), nrm: R.tex.normal('rock'), tt: R.tex.treeTex('oak', 0), cv: !!R.tex.canvas('rock', 64), tr: !!R.tex.tree('fir', 1).canvas, nc: !!R.tex.normalCanvas('cobble'), unk: R.tex.get('nope'), unk2: R.tex.tree('nope') }));
    L.ok('without THREE: get/normal/treeTex → null; canvas/tree still work', no3.get === null && no3.nrm === null && no3.tt === null && no3.cv && no3.tr && no3.nc, JSON.stringify(no3));
    L.ok('unknown names → null, no throw', no3.unk === null && no3.unk2 === null);
    const bp = await page.evaluate(() => ['north', 'farnorth', 'wall', 'beyond', 'winter', 'riverlands', 'vale', 'crownlands', 'westerlands', 'westcoast', 'reach', 'stormlands', 'dorne', 'ironislands', 'dragonstone', 'snow', 'desert'].map(b => [b, R.tex.biomePlants(b)]));
    const kinds = new Set(lists.kinds);
    L.ok('biomePlants() for every region: [[kind, weight]] of real kinds', bp.every(([b, l]) => l.length >= 3 && l.every(e => kinds.has(e[0]) && e[1] > 0)), bp.filter(([b, l]) => !(l.length >= 3 && l.every(e => kinds.has(e[0]) && e[1] > 0))).map(e => e[0]).join(','));
    const det = await page.evaluate(() => { const a = R.tex.canvas('rock', 96).toDataURL(); return a.length > 100; });
    L.ok('a texture at another size works', det);

    // contact sheet
    await page.evaluate(() => {
      const b = document.body; b.innerHTML = ''; b.style.padding = '10px';
      const h = t => { const e = document.createElement('div'); e.textContent = t; e.style.cssText = 'margin:8px 0 4px;font-weight:bold'; b.appendChild(e); };
      h('textures (512 px tiles shown at 2×2 repeat, 256 px)');
      const g = document.createElement('div'); g.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'; b.appendChild(g);
      R.tex.names().forEach(n => { const w = document.createElement('div'), c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), s = R.tex.canvas(n);
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.drawImage(s, i * 128, j * 128, 128, 128);
        w.appendChild(c); const l = document.createElement('div'); l.textContent = n; w.appendChild(l); w.style.cssText = 'width:256px'; g.appendChild(w); });
      h('plants (variant 0, 1, 2) on a meadow-ish ground');
      const p = document.createElement('div'); p.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end'; b.appendChild(p);
      R.tex.kinds().forEach(k => { const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:linear-gradient(#8fa6b8,#b9c3c4 70%,#5d6a3a 70%);padding:4px';
        const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:flex-end;gap:2px;height:260px';
        [0, 1, 2].forEach(s => { const t = R.tex.tree(k, s), c = t.canvas; c.style.cssText = 'display:block'; row.appendChild(c.cloneNode ? (() => { const cc = document.createElement('canvas'); cc.width = c.width; cc.height = c.height; cc.getContext('2d').drawImage(c, 0, 0); return cc; })() : c); });
        w.appendChild(row); const l = document.createElement('div'); l.textContent = k; l.style.color = '#111'; w.appendChild(l); p.appendChild(w); });
      h('normal maps');
      const nn = document.createElement('div'); nn.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'; b.appendChild(nn);
      R.tex.names().forEach(n => { const c = document.createElement('canvas'); c.width = c.height = 128; c.getContext('2d').drawImage(R.tex.normalCanvas(n), 0, 0, 128, 128); nn.appendChild(c); });
    });
    const sheet = path.join(path.resolve(__dirname, '..', '..'), '.shots', 'rpg', 'g10_sheet.png'); fs.mkdirSync(path.dirname(sheet), { recursive: true });
    await page.screenshot({ path: sheet, fullPage: true });
    console.log('  contact sheet: ' + sheet);
    const errs = await page.evaluate(() => window.__errs || []);
    L.ok('part 1: no page errors', !errors.length && !errs.length, errors.concat(errs).join(' | '));
    await close();
  }

  /* ---------- part 2: inside the built game ---------- */
  {
    const { page, errors, close } = await L.launch();
    const b = await L.boot(page, { save: L.fakeSave({ house: 'stark', lvl: 3 }) });
    L.ok('the game boots with R.tex', b.version && await page.evaluate(() => !!(window.R && R.tex && R.tex.get)), JSON.stringify({ running: b.running, cur: b.cur }));
    const r = await page.evaluate(async () => {
      const t0 = performance.now(), ok = await Promise.race([R.tex.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 60000))]);
      const g = R.tex.get('grass'), n = R.tex.normal('cobble'), tt = R.tex.treeTex('oak', 1), TH = THREE;
      return { ok, wait: performance.now() - t0, frames: R.tex.stats.frames, maxSlice: R.tex.stats.maxSlice, work: R.tex.stats.ms,
        isTex: g instanceof TH.Texture, wrap: g.wrapS === TH.RepeatWrapping && g.wrapT === TH.RepeatWrapping, mip: g.generateMipmaps && g.minFilter === TH.LinearMipmapLinearFilter, an: g.anisotropy,
        cs: g.colorSpace, srgb: TH.SRGBColorSpace, same: R.tex.get('grass') === g, sized: R.tex.get('grass', { size: 128 }) !== g && R.tex.get('grass', { size: 128 }).image.width === 128,
        nTex: n instanceof TH.Texture && n !== R.tex.get('cobble') && R.tex.normal('cobble') === n, ncs: n.colorSpace,
        tt: tt instanceof TH.Texture && tt.image.width === R.tex.tree('oak', 1).w && R.tex.treeTex('oak', 4) === tt, tta: (() => { const d = tt.image.data, w = tt.image.width; return d[3] === 0 && d[(w - 1) * 4 + 3] === 0; })() };
    });
    console.log('  in game: ready after ' + r.wait.toFixed(0) + ' ms wall, ' + r.frames + ' slices, max slice ' + r.maxSlice.toFixed(1) + ' ms, work ' + r.work.toFixed(0) + ' ms');
    L.ok('ready resolves in the game', r.ok);
    L.ok('the pump keeps each slice short (≤ 4 ms work + one dab batch)', r.maxSlice < 12, r.maxSlice.toFixed(1) + ' ms');
    L.ok('get(): a THREE.Texture, RepeatWrapping, mipmaps, anisotropy ≤ 4, sRGB', r.isTex && r.wrap && r.mip && r.an >= 1 && r.an <= 4 && r.cs === r.srgb, JSON.stringify(r));
    L.ok('get() is cached by name + size', r.same && r.sized);
    L.ok('normal(): its own cached texture, not sRGB', r.nTex && r.ncs !== r.srgb, r.ncs);
    L.ok('treeTex(): a cached THREE texture of the plant, clear at the corners', r.tt && r.tta);
    const errs = errors.filter(e => /tex/i.test(e)), terr = await page.evaluate(() => (R.errors || []).filter(e => /tex/i.test(e)));
    L.ok('part 2: no texture errors', !errs.length && !terr.length, errs.concat(terr).join(' | '));
    await L.shot(page, 'g10_game');
    await close();
  }
  L.report();
})().catch(e => { console.error(e); process.exit(1); });
