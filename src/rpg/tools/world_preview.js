#!/usr/bin/env node
/* HOLDOR RPG — world data tools (A07).
   node src/rpg/tools/world_preview.js mask      → prints the 60×102 sea mask rows derived from src/assets/westeros_1200.webp
                                                   (dark olive = sea; paste them into SEA_ROWS of js/11_world_data.js)
   node src/rpg/tools/world_preview.js [out.png] → draws regions, mountains, roads, POIs and the mask over the map art,
                                                   writes .shots/rpg_world.png (or out.png) and prints the integrity report.
   Needs Playwright (npm i) and CHROMIUM_PATH (or a downloaded chromium). */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MAP = path.join(ROOT, 'src', 'assets', 'westeros_1200.webp');
const DATA = path.join(ROOT, 'src', 'rpg', 'js', '11_world_data.js');
const mode = process.argv[2] || '';

async function browser() {
  const { chromium } = require('playwright');
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
}

async function maskMode() {
  const b = await browser(); const pg = await b.newPage({ viewport: { width: 1200, height: 2048 } });
  await pg.setContent(`<img id=i src="data:image/webp;base64,${fs.readFileSync(MAP).toString('base64')}">`);
  await pg.waitForFunction(() => document.getElementById('i').complete);
  const rows = await pg.evaluate(() => {
    const W = 120, H = 204, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(document.getElementById('i'), 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data;
    const sea = (i) => { const r = d[i], g = d[i + 1], b = d[i + 2]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return (r + g + b) / 3 < 112 && mx - mn < 52; };
    const M = [];
    for (let Y = 0; Y < 102; Y++) { const row = []; for (let X = 0; X < 60; X++) { let n = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (sea(((Y * 2 + dy) * W + X * 2 + dx) * 4)) n++; row.push(n >= 3 ? 1 : 0); } M.push(row); }
    // clean: a sea speck with ≥ 6 land neighbours becomes land; a land speck with 8 sea neighbours stays (islets are fine)
    for (let pass = 0; pass < 2; pass++) for (let Y = 0; Y < 102; Y++) for (let X = 0; X < 60; X++) if (M[Y][X]) {
      let land = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const yy = Y + dy, xx = X + dx; if (yy < 0 || yy >= 102 || xx < 0 || xx >= 60) continue; n++; if (!M[yy][xx]) land++; }
      if (n === 8 && land >= 6) M[Y][X] = 0;
    }
    return M.map(r => r.map(v => v ? '#' : '.').join(''));
  });
  await b.close();
  console.log(rows.map(r => "'" + r + "',").join('\n'));
}

async function previewMode(out) {
  const src = fs.readFileSync(DATA, 'utf8');
  const b = await browser(); const pg = await b.newPage({ viewport: { width: 1200, height: 2048 } });
  pg.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await pg.setContent(`<html><body style="margin:0;background:#000"><img id=i src="data:image/webp;base64,${fs.readFileSync(MAP).toString('base64')}" style="display:none"><canvas id=c width=1200 height=2048></canvas></body></html>`);
  await pg.waitForFunction(() => document.getElementById('i').complete);
  await pg.addScriptTag({ content: 'window.R={data:{}};' + src });
  const rep = await pg.evaluate(() => {
    const w = R.data.world, k = 1 / 6, c = document.getElementById('c'), x = c.getContext('2d');
    x.drawImage(document.getElementById('i'), 0, 0);
    // mask
    for (let r = 0; r < w.mask.h; r++) for (let cc = 0; cc < w.mask.w; cc++) { const ch = w.mask.rows[r][cc]; if (ch === '#') { x.fillStyle = 'rgba(20,40,120,.35)'; x.fillRect(cc * 20, r * 20, 20, 20); } }
    // regions
    for (const rg of w.regions) { x.beginPath(); rg.poly.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); x.closePath(); x.fillStyle = rg.col + '44'; x.fill(); x.lineWidth = 3; x.strokeStyle = rg.col; x.stroke(); }
    for (const m of w.blockedPolys) { x.beginPath(); m.poly.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); x.closePath(); x.fillStyle = 'rgba(80,60,60,.55)'; x.fill(); x.strokeStyle = '#000'; x.lineWidth = 2; x.stroke(); }
    for (const rd of w.roads) { x.beginPath(); rd.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); x.lineWidth = rd.kind === 'ferry' ? 3 : 5; x.setLineDash(rd.kind === 'ferry' ? [6, 6] : rd.kind === 'track' ? [10, 6] : []); x.strokeStyle = rd.kind === 'ferry' ? '#4cf' : rd.id === 'kingsroad' ? '#ffe066' : '#f0a040'; x.stroke(); x.setLineDash([]); }
    x.beginPath(); w.wall.pts.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); x.lineWidth = 8; x.strokeStyle = '#bfefff'; x.stroke();
    x.font = 'bold 13px sans-serif'; x.textAlign = 'center';
    for (const p of w.pois) { const px = p.x * k, py = p.y * k; const col = p.seat ? '#ff3' : p.type === 'shrine' ? '#8f8' : p.type === 'dungeon' ? '#f4f' : p.type === 'camp' ? '#f55' : '#fff'; x.fillStyle = col; x.beginPath(); x.arc(px, py, p.seat ? 9 : 6, 0, 7); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#000'; x.fillText(p.name, px + 1, py - 10); x.fillStyle = col; x.fillText(p.name, px, py - 11); }
    x.font = 'bold 26px sans-serif'; for (const rg of w.regions) { let cx = 0, cy = 0; rg.poly.forEach(p => { cx += p[0]; cy += p[1]; }); cx = cx / rg.poly.length * k; cy = cy / rg.poly.length * k; x.fillStyle = '#000'; x.fillText(rg.name.toUpperCase() + ' ' + rg.lvl.join('-'), cx + 2, cy + 2); x.fillStyle = rg.col; x.fillText(rg.name.toUpperCase() + ' ' + rg.lvl.join('-'), cx, cy); }
    // report
    const bad = [];
    for (const p of w.pois) { const rg = w.regionAt(p.x, p.y); if (!rg || rg.id !== p.region) bad.push(p.id + ': region ' + p.region + ' but polygon says ' + (rg && rg.id)); if (w.blocked(p.x, p.y)) bad.push(p.id + ': on a blocked cell ' + Math.floor(p.x / 120) + ',' + Math.floor(p.y / 120)); }
    for (const rd of w.roads) { let n = 0; for (let i = 1; i < rd.length; i++) { const a = rd[i - 1], bb = rd[i]; const L = Math.hypot(bb[0] - a[0], bb[1] - a[1]); for (let t = 0; t <= L; t += 40) { const xx = a[0] + (bb[0] - a[0]) * t / L, yy = a[1] + (bb[1] - a[1]) * t / L; if (w.blocked(xx, yy)) { n++; if (n <= 3) bad.push(rd.id + ': crosses blocked at ' + Math.round(xx) + ',' + Math.round(yy) + ' cell ' + Math.floor(xx / 120) + ',' + Math.floor(yy / 120)); } } } }
    return { regions: w.regions.length, pois: w.pois.length, roads: w.roads.length, spawns: w.spawns.length, bad, data: c.toDataURL('image/png') };
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(rep.data.split(',')[1], 'base64'));
  // a half-size copy for reading
  const small = await pg.evaluate(() => { const c = document.getElementById('c'); const s = document.createElement('canvas'); s.width = 600; s.height = 1024; s.getContext('2d').drawImage(c, 0, 0, 600, 1024); return s.toDataURL('image/png'); });
  fs.writeFileSync(out.replace(/\.png$/, '_600.png'), Buffer.from(small.split(',')[1], 'base64'));
  await b.close();
  delete rep.data; console.log(JSON.stringify(rep, null, 1));
  console.log('wrote', out);
}

if (mode === 'mask') maskMode(); else previewMode(path.resolve(mode || path.join(ROOT, '.shots', 'rpg_world.png')));
