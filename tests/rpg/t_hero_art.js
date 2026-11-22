// A37 — the code-drawn hero (fallback art): 3 classes × 7 houses × 6 anims × 3 phases into .shots/rpg_hero.png, an old enemy
// sprite drawn beside for scale; asserts the sheet is not blank, every cell has ink, and 200 draws take < 80 ms.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_hero_art.js
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const html = path.join(ROOT, '.shots', 'rpg_hero_test.html');
fs.mkdirSync(path.join(ROOT, '.shots'), { recursive: true });
const b0 = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), html], { encoding: 'utf8' });
if (b0.status !== 0) { console.log('FAIL build', b0.stdout, b0.stderr); process.exit(1); }
// an enemy sprite from the old game for the side-by-side (optional)
let enemy = null;
try { const base = fs.readFileSync(path.join(ROOT, 'src', 'base', 'index.v1.0.44.html'), 'utf8'); const m = base.match(/"axe": "(data:image\/webp;base64,[A-Za-z0-9+/=]+)"/); if (m) enemy = m[1]; } catch (e) {}
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  const pg = await b.newPage({ viewport: { width: 1160, height: 1300 }, deviceScaleFactor: 1 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + html);
  await pg.waitForFunction(() => window.R && R.heroArt && R.heroArt.draw);
  const r = await pg.evaluate(async enemy => {
    const CL = ['knight', 'ranger', 'maester'], HS = ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'], AN = ['idle', 'walk', 'attack', 'hurt', 'die', 'dodge'];
    const cell = 58, cw = AN.length * 3 * cell + 120, ch = CL.length * HS.length * cell + 20;
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.style.cssText = 'position:fixed;left:0;top:0;z-index:9'; document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.fillStyle = '#4a5a48'; g.fillRect(0, 0, cw, ch);
    const gearOf = (cls, i) => i % 3 === 0 ? null : { weapon: { rar: i % 5, name: cls === 'knight' ? ['sword', 'axe', 'mace'][i % 3] : cls === 'ranger' ? ['bow', 'crossbow', 'dagger'][i % 3] : ['staff', 'rod', 'tome'][i % 3] }, armor: { rar: (i + 2) % 5 } };
    let row = 0, blank = 0;
    for (const cls of CL) for (const hi in HS) {
      const house = HS[hi], y = 10 + row * cell + cell - 6; let col = 0;
      for (const an of AN) for (let p = 0; p < 3; p++) {
        const x = 10 + col * cell + cell / 2; const ph = an === 'idle' || an === 'walk' ? p / 3 : [0.15, 0.5, 0.85][p];
        R.heroArt.draw(g, x, y, { cls, house, anim: an, ph, t: ph * (an === 'die' ? 1.2 : an === 'walk' ? 0.6 : 0.45), face: (row + col) % 2 ? -1 : 1, gear: gearOf(cls, row + col), seed: row });
        const d = g.getImageData(x - 24, y - 50, 48, 54).data; let ink = 0; for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - 74) + Math.abs(d[i + 1] - 90) + Math.abs(d[i + 2] - 72) > 40) ink++;
        if (ink < 20) blank++;
        col++;
      }
      row++;
    }
    // the old enemy beside the hero, the enemy at its old battle height ×1.6 (it stood 30 px, the hero 48 units)
    if (enemy) { const im = new Image(); im.src = enemy; try { await im.decode(); } catch (e) {} if (im.naturalWidth) g.drawImage(im, cw - 110, 20, 96, 96); }
    R.heroArt.draw(g, cw - 60, 190, { cls: 'knight', house: 'stark', anim: 'idle', t: 0 });
    R.heroArt.draw(g, cw - 60, 260, { cls: 'ranger', house: 'tyrell', anim: 'walk', t: 0.2 });
    R.heroArt.draw(g, cw - 60, 330, { cls: 'maester', house: 'targaryen', anim: 'attack', ph: 0.55 });
    const pt = R.heroArt.portrait('knight', 'lannister', 72); g.drawImage(pt, cw - 96, 360, 72, 72);
    g.drawImage(R.heroArt.portrait('ranger', 'stark', 72), cw - 96, 440, 72, 72); g.drawImage(R.heroArt.portrait('maester', 'martell', 72), cw - 96, 520, 72, 72);
    // speed: 200 draws, cached bodies, mixed anims
    const sc = document.createElement('canvas'); sc.width = 200; sc.height = 120; const sg = sc.getContext('2d');
    // one untimed pass fills the body cache (face / anim combos the sheet did not draw), then the best of 3 timed passes (the CPU is shared by several agents)
    const pass = () => { const t0 = performance.now(); for (let i = 0; i < 200; i++) R.heroArt.draw(sg, 60 + (i % 10) * 3, 100, { cls: CL[i % 3], house: HS[i % 7], anim: AN[i % 6], t: i * 0.01, face: i % 2 ? -1 : 1 }); return performance.now() - t0; };
    pass(); const ms = Math.min(pass(), pass(), pass());
    // whole-sheet ink
    const d = g.getImageData(0, 0, cw, ch).data; let ink = 0; for (let i = 0; i < d.length; i += 64) if (Math.abs(d[i] - 74) + Math.abs(d[i + 1] - 90) + Math.abs(d[i + 2] - 72) > 40) ink++;
    return { cells: row * AN.length * 3, blank, ms: Math.round(ms * 10) / 10, ink, cache: R.heroArt.cacheSize(), portrait: pt.width > 0 && pt.height > 0 };
  }, enemy);
  await pg.screenshot({ path: path.join(ROOT, '.shots', 'rpg_hero.png'), clip: { x: 0, y: 0, width: 1160, height: 1250 } });
  console.log(JSON.stringify(r));
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  ok(r.cells === 378, 'drew 378 cells (' + r.cells + ')');
  ok(r.blank === 0, 'no blank cell (' + r.blank + ' blank)');
  ok(r.ink > 5000, 'sheet has ink (' + r.ink + ')');
  ok(r.ms < 80, '200 draws in ' + r.ms + ' ms (< 80)');
  ok(r.cache <= 64 && r.cache >= 21, 'body cache ' + r.cache + ' entries');
  ok(r.portrait, 'portrait canvas');
  await b.close();
  console.log(fails.length ? 'FAILS: ' + fails.join(' | ') : 'OK t_hero_art');
  process.exit(fails.length ? 1 : 0);
})();
