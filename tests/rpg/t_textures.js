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
  const html = L.build(); let commonCpu = 0;
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

    // the common set, timed (makeAll does what the pump would, at once). Wall time suffers when the machine is shared, so the
    // budget is checked on the renderer main thread's CPU time (CDP Performance.ThreadTime), which a busy machine does not inflate
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
    const thr = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'ThreadTime').value * 1000;
    // per item CPU first (one item per call), then the whole set (makeAll finds them made)
    const per = [], items = lists.names.map(n => ['t', n]).concat(lists.kinds.map(k => ['p', k]));
    const c0 = await thr();
    for (const [t, n] of items) { const a = await thr(); await page.evaluate(([t, n]) => { if (t === 't') R.tex.canvas(n); else R.tex.tree(n, 0); }, [t, n]); per.push([n, await thr() - a]); }
    per.sort((a, b) => b[1] - a[1]);
    console.log('  CPU per item (ms, incl. ~1 ms per call overhead): ' + per.map(e => e[0] + ' ' + e[1].toFixed(0)).join(', '));
    const tm = await page.evaluate(() => { const ms = R.tex.makeAll(); const it = Object.entries(R.tex.stats.items).sort((a, b) => b[1] - a[1]); return { ms, work: R.tex.stats.ms, size: R.tex.stats.size, ph: R.tex.stats.plantH, top: it.slice(0, 8).map(e => e[0] + ' ' + e[1].toFixed(0)), tex: it.filter(e => e[0][0] === 't').reduce((s, e) => s + e[1], 0), pl: it.filter(e => e[0][0] === 'p').reduce((s, e) => s + e[1], 0) }; });
    tm.cpu = await thr() - c0;
    // calibration: a fixed loop (52 M float steps) that a desktop core runs in ≈ 55 ms; a shared / slow machine scales the budget by it
    const r0 = await thr(); await page.evaluate(() => { let s = 0; const a = new Float32Array(262144); for (let k = 0; k < 200; k++) for (let i = 0; i < 262144; i++) s += a[i] * 1.0001 + i; return s; });
    const ref = await thr() - r0, slow = Math.max(1, ref / 55); tm.desk = tm.cpu / slow; commonCpu = tm.cpu;
    console.log('  timing: reference loop ' + ref.toFixed(0) + ' ms CPU (desktop ≈ 55) → this machine ×' + slow.toFixed(1) + '; common set ≈ ' + tm.desk.toFixed(0) + ' ms on a desktop core');
    console.log('  timing: common set ' + tm.cpu.toFixed(0) + ' ms main-thread CPU, ' + tm.ms.toFixed(0) + ' ms wall (textures ' + tm.tex.toFixed(0) + ', plants ' + tm.pl.toFixed(0) + ') at ' + tm.size + ' px / plants ' + tm.ph + ' px; slowest: ' + tm.top.join(', '));
    L.ok('the common set generates in < 1.5 s on a desktop core (CPU time scaled by the reference loop)', tm.desk < 1500, tm.desk.toFixed(0) + ' ms desktop-equivalent, ' + tm.cpu.toFixed(0) + ' ms CPU here');
    L.ok('ready resolves once the common set is made', await page.evaluate(() => Promise.race([R.tex.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 3000))])));

    // every texture: not blank, seamless (opposite edges as alike as neighbouring columns / rows inside)
    const T = await page.evaluate(() => R.tex.names().map(n => {
      const c = R.tex.canvas(n), S = c.width, d = c.getContext('2d').getImageData(0, 0, S, S).data, px = (x, y) => (y * S + x) * 4;
      const lum = i => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      let m = 0, q = 0, N = 0; for (let i = 0; i < d.length; i += 4 * 13) { const l = lum(i); m += l; q += l * l; N++; } m /= N; const sd = Math.sqrt(q / N - m * m);
      const colDiff = (a, b) => { let s = 0; for (let y = 0; y < S; y++) for (let k = 0; k < 3; k++) s += Math.abs(d[px(a, y) + k] - d[px(b, y) + k]); return s / S / 3; };
      const rowDiff = (a, b) => { let s = 0; for (let x = 0; x < S; x++) for (let k = 0; k < 3; k++) s += Math.abs(d[px(x, a) + k] - d[px(x, b) + k]); return s / S / 3; };
      // the inside step: the 99th percentile of every neighbouring column / row pair (a seam must look like any other step)
      const pc = [], pr = []; for (let p = 0; p < S - 1; p += 3) { pc.push(colDiff(p, p + 1)); pr.push(rowDiff(p, p + 1)); }
      pc.sort((a, b) => a - b); pr.sort((a, b) => a - b); const ic = pc[Math.floor(pc.length * 0.99)], ir = pr[Math.floor(pr.length * 0.99)];
      return { n, S, sd: +sd.toFixed(1), mean: +m.toFixed(0), ec: +colDiff(0, S - 1).toFixed(1), ic: +ic.toFixed(1), er: +rowDiff(0, S - 1).toFixed(1), ir: +ir.toFixed(1), same: R.tex.canvas(n) === c, avg: R.tex.avg(n) };
    }));
    const blank = T.filter(t => t.sd < 3), seam = T.filter(t => t.ec > t.ic * 1.15 + 1 || t.er > t.ir * 1.15 + 1);
    L.ok('every texture is painted (not blank)', !blank.length, blank.map(t => t.n + ' sd ' + t.sd).join(', '));
    L.ok('every texture is seamless (edge vs inside step)', !seam.length, seam.map(t => t.n + ' col ' + t.ec + '/' + t.ic + ' row ' + t.er + '/' + t.ir).join('; '));
    console.log('  seams (edge/inside col, row): ' + T.map(t => t.n + ' ' + t.ec + '/' + t.ic + ',' + t.er + '/' + t.ir).join('  '));
    L.ok('canvas() is cached', T.every(t => t.same));
    L.ok('avg() gives a colour', T.every(t => /^#[0-9a-f]{6}$/.test(t.avg)), T.map(t => t.avg).join(' '));

    // every plant, three variants
    const P = await page.evaluate(() => R.tex.kinds().map(k => [0, 1, 2].map(s => {
      const p = R.tex.tree(k, s), c = p.canvas, w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, a = (x, y) => d[((y | 0) * w + (x | 0)) * 4 + 3];
      const corners = [a(0, 0), a(w - 1, 0), a(0, h - 1), a(w - 1, h - 1)];
      let op = 0, n = 0, mx = 0; for (let y = h * 0.25; y < h * 0.95; y += 2) for (let x = w * 0.3; x < w * 0.7; x += 2) { n++; const v = a(x, y); if (v > 200) op++; if (v > mx) mx = v; }
      let any = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) any++;
      return { k, s, w, h, ax: p.ax, ay: p.ay, worldH: p.worldH, clear: Math.max(...corners), op: op / n, mx, filled: any / (d.length / 16), same: R.tex.tree(k, s + 3) === p, diff: s ? R.tex.tree(k, 0).canvas !== c : true };
    })).flat());
    const ph = await page.evaluate(() => R.tex.stats.plantH);
    const badClear = P.filter(p => p.clear > 0), badOp = P.filter(p => p.op < 0.05 || p.mx < 250), badSize = P.filter(p => p.h > ph || p.h < 16 || !(p.worldH > 0) || !(p.ax > 0 && p.ax < p.w) || !(p.ay > p.h * 0.7 && p.ay <= p.h));
    L.ok('every plant: corners transparent', !badClear.length, badClear.map(p => p.k + '#' + p.s).join(','));
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

    // contact sheet: one canvas (textures 2×2 repeated, plants in their three variants at true size over a sky / meadow, normals),
    // written from its PNG data (no page screenshot: cheaper on a shared machine)
    const png = await page.evaluate(() => {
      const W = 1560, tiles = R.tex.names(), kinds = R.tex.kinds(), tw = 250, perRow = Math.floor(W / (tw + 6)), th = Math.ceil(tiles.length / perRow) * (tw + 22);
      const pl = kinds.map(k => [0, 1, 2].map(s => R.tex.tree(k, s))), pw = pl.map(v => v.reduce((s, t) => s + t.w + 2, 0) + 8);
      const rows = []; let row = [], x = 0; pw.forEach((w, i) => { if (x + w > W && row.length) { rows.push(row); row = []; x = 0; } row.push(i); x += w + 6; }); rows.push(row);
      const ph = rows.length * 290, nh = Math.ceil(tiles.length / Math.floor(W / 100)) * 100, H = 30 + th + 30 + ph + 30 + nh;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.fillStyle = '#1b1d1f'; g.fillRect(0, 0, W, H); g.font = '13px sans-serif'; g.fillStyle = '#ddd';
      let y = 22; g.fillText('textures (each tile drawn 2×2 to show the wrap)', 6, y - 6);
      tiles.forEach((n, i) => { const cx = 6 + (i % perRow) * (tw + 6), cy = y + Math.floor(i / perRow) * (tw + 22), s = R.tex.canvas(n);
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) g.drawImage(s, cx + a * tw / 2, cy + b * tw / 2, tw / 2, tw / 2);
        g.fillStyle = '#ddd'; g.fillText(n, cx, cy + tw + 14); });
      y += th + 30; g.fillText('plants: variants 0, 1, 2 at their canvas size (feet on the line)', 6, y - 8);
      rows.forEach((r, ri) => { let x = 6; const top = y + ri * 290;
        r.forEach(i => { const w = pw[i], gr = g.createLinearGradient(0, top, 0, top + 270); gr.addColorStop(0, '#8fa3b3'); gr.addColorStop(0.85, '#c3c9c4'); gr.addColorStop(0.85, '#55603a'); gr.addColorStop(1, '#3f4a2a');
          g.fillStyle = gr; g.fillRect(x, top, w, 270); let px = x + 4; pl[i].forEach(t => { g.drawImage(t.canvas, px, top + 262 - t.ay); px += t.w + 2; });
          g.fillStyle = '#ddd'; g.fillText(kinds[i], x + 2, top + 284); x += w + 6; }); });
      y += ph + 30; g.fillText('normal maps', 6, y - 8);
      tiles.forEach((n, i) => { const per = Math.floor(W / 100); g.drawImage(R.tex.normalCanvas(n), 6 + (i % per) * 100, y + Math.floor(i / per) * 100, 94, 94); });
      const out = [c.toDataURL('image/png')];
      for (let y0 = 0; y0 < H; y0 += 1000) { const q = document.createElement('canvas'); q.width = W; q.height = Math.min(1000, H - y0); q.getContext('2d').drawImage(c, 0, -y0); out.push(q.toDataURL('image/png')); }
      return out;
    });
    const sheet = path.join(path.resolve(__dirname, '..', '..'), '.shots', 'rpg', 'g10_sheet.png'); fs.mkdirSync(path.dirname(sheet), { recursive: true });
    fs.writeFileSync(sheet, Buffer.from(png[0].split(',')[1], 'base64'));
    png.slice(1).forEach((u, i) => fs.writeFileSync(sheet.replace('.png', '_' + (i + 1) + '.png'), Buffer.from(u.split(',')[1], 'base64')));   // 1000-px slices to look at
    console.log('  contact sheet: ' + sheet);
    const errs = await page.evaluate(() => window.__errs || []);
    L.ok('part 1: no page errors', !errors.length && !errs.length, errors.concat(errs).join(' | '));
    await close();
  }

  /* ---------- part 2: inside the built game ---------- */
  if (!process.env.G10_PART1) {
    const { page, errors, close } = await L.launch();
    const b = await L.boot(page, { save: L.fakeSave({ house: 'stark', lvl: 3 }) });
    L.ok('the game boots with R.tex', b.version && await page.evaluate(() => !!(window.R && R.tex && R.tex.get)), JSON.stringify({ running: b.running, cur: b.cur }));
    const r = await page.evaluate(async () => {
      const t0 = performance.now(), ok = await Promise.race([R.tex.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 60000))]);
      const g = R.tex.get('grass'), n = R.tex.normal('cobble'), tt = R.tex.treeTex('oak', 1), TH = THREE;
      // how much a busy machine stretches wall time here: the same loop timed in wall ms against its CPU budget (see part 1)
      const w0 = performance.now(); let q = 0; const a = new Float32Array(262144); for (let k = 0; k < 200; k++) for (let i = 0; i < 262144; i++) q += a[i] * 1.0001 + i; const refWall = performance.now() - w0;
      const sl = R.tex.stats.slices.slice().sort((a, b) => a - b), pc = f => sl[Math.min(sl.length - 1, Math.floor(sl.length * f))] || 0;
      return { ok, wait: performance.now() - t0, frames: R.tex.stats.frames, maxSlice: R.tex.stats.maxSlice, p50: pc(0.5), p90: pc(0.9), refWall, work: R.tex.stats.ms,
        isTex: g instanceof TH.Texture, wrap: g.wrapS === TH.RepeatWrapping && g.wrapT === TH.RepeatWrapping, mip: g.generateMipmaps && g.minFilter === TH.LinearMipmapLinearFilter, an: g.anisotropy,
        cs: g.colorSpace, srgb: TH.SRGBColorSpace, same: R.tex.get('grass') === g, sized: R.tex.get('grass', { size: 128 }) !== g && R.tex.get('grass', { size: 128 }).image.width === 128,
        nTex: n instanceof TH.Texture && n !== R.tex.get('cobble') && R.tex.normal('cobble') === n, ncs: n.colorSpace,
        tt: tt instanceof TH.Texture && tt.image.width === R.tex.tree('oak', 1).w && R.tex.treeTex('oak', 4) === tt, tta: (() => { const d = tt.image.data, w = tt.image.width; return d[3] === 0 && d[(w - 1) * 4 + 3] === 0; })() };
    });
    // a shared machine stretches wall time: the pump's own work in wall ms against the CPU the same set took in part 1
    const stretch = Math.max(1, r.refWall / 55, commonCpu ? r.work / commonCpu : 1);
    console.log('  in game: ready after ' + r.wait.toFixed(0) + ' ms wall, ' + r.frames + ' slices (median ' + r.p50.toFixed(1) + ', p90 ' + r.p90.toFixed(1) + ', max ' + r.maxSlice.toFixed(1) + ' ms), work ' + r.work.toFixed(0) + ' ms; wall stretch of this machine ×' + stretch.toFixed(1));
    L.ok('ready resolves in the game', r.ok);
    L.ok('the pump keeps its slices short (median ≤ 6 ms, p90 ≤ 12 ms, scaled by the machine stretch)', r.p50 <= 6 * stretch && r.p90 <= 12 * stretch, 'median ' + r.p50.toFixed(1) + ' p90 ' + r.p90.toFixed(1) + ' max ' + r.maxSlice.toFixed(1) + ' stretch ×' + stretch.toFixed(1));
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
