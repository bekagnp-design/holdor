/* A04 — the extracted art loads: builds the RPG, opens it, awaits R.assets.ready and counts what decoded.
   CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_assets.js
   RPG_OUT=<path> builds somewhere else than beta/index.html (handy while beta/ still holds the old game). */
const { execSync } = require('child_process');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.env.RPG_OUT || path.join(ROOT, 'beta', 'index.html');
execSync('python3 src/build_rpg.py ' + JSON.stringify(OUT), { cwd: ROOT, stdio: 'inherit' });
const { chromium } = require('playwright');
let fails = 0;
const chk = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  const pg = await b.newPage({ viewport: { width: 844, height: 390 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const t0 = Date.now();
  await pg.goto('file://' + OUT);
  const r = await pg.evaluate(async () => {
    await R.assets.ready;
    const A = R.assets, ok = A.ok;
    const ck = Object.keys(A.champ);
    return {
      total: A.total, loaded: A.loaded, failed: A.failed, done: A.done,
      enemies: Object.values(A.enemy).filter(ok).length, enemyKeys: Object.keys(A.enemy).length,
      champIdle: ck.filter(k => !k.includes('_') && ok(A.champ[k])).length,
      champAttack: ck.filter(k => k.endsWith('_attack') && ok(A.champ[k])).length,
      portraits: ck.filter(k => k.endsWith('_portrait') && ok(A.champ[k])).length,
      map: A.map ? [A.map.naturalWidth, A.map.naturalHeight] : null,
      gates: A.gate.filter(ok).length,
      stages: A_MAP.stages.length, stage1: A_MAP.stages[0], stage50: A_MAP.stages[49], offMap: A_MAP.stages.filter(s => s.offMap).length,
      ed: Object.keys(A_ENEMY.names).length, edAxe: A_ENEMY.names.axe, metaAxe: A_ENEMY.meta.axe, cfgAxe: A_ENEMY.cfg.axe,
      ch: A_CHAMP.list.length, jon: A_CHAMP.byId.jon, houses: Object.keys(A_CHAMP.houses), skills: Object.keys(A_CHAMP.skills).length,
      icons: Object.keys(A_ICON), iconGold: A.icon('gold', 30).slice(0, 40), sameIcons: A_ICONS === A_ICON,
      white: (() => { const w = A.white('enemy', 'axe'); return w ? [w.width, w.height] : null; })(),
      portraitJon: !!A.portrait('jon'), imgNull: A.img('enemy', 'nope') === null,
    };
  });
  const ms = Date.now() - t0;
  console.log(JSON.stringify({ ms, total: r.total, loaded: r.loaded, failed: r.failed, enemies: r.enemies, champIdle: r.champIdle, champAttack: r.champAttack, portraits: r.portraits, map: r.map, gates: r.gates, stages: r.stages, offMap: r.offMap, ed: r.ed, ch: r.ch, houses: r.houses.length, skills: r.skills, icons: r.icons.length }));
  console.log('stage 1', JSON.stringify(r.stage1)); console.log('stage 50', JSON.stringify(r.stage50));
  console.log('axe', JSON.stringify(r.edAxe), JSON.stringify(r.metaAxe), JSON.stringify(r.cfgAxe)); console.log('jon', JSON.stringify(r.jon));
  chk(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  chk(r.done && r.loaded === r.total, 'ready resolved after every image (' + r.loaded + '/' + r.total + ' in ' + ms + ' ms)');
  chk(r.failed.length === 0, 'no image failed' + (r.failed.length ? ': ' + r.failed.join(' ') : ''));
  chk(r.enemies >= 20, 'enemy images decoded: ' + r.enemies + ' (need ≥ 20)');
  chk(r.enemies === r.enemyKeys && r.enemyKeys === r.ed, 'every ED row has a decoded sprite: ' + r.enemies + ' = ' + r.ed);
  chk(r.portraits >= 40, 'champion portraits: ' + r.portraits + ' (need ≥ 40)');
  chk(r.champIdle >= 49 && r.champAttack >= 49, 'champion idle ' + r.champIdle + ' / attack ' + r.champAttack + ' sheets');
  chk(r.map && r.map[0] === 1200 && r.map[1] === 2048, 'map 1200×2048: ' + JSON.stringify(r.map));
  chk(r.gates === 5, 'gate images: ' + r.gates);
  chk(r.stages === 50, 'A_MAP.stages.length === 50');
  chk(r.stage1 && r.stage1.id === 1 && r.stage1.n === 'Sunspear' && r.stage1.x === 1010 && r.stage1.y === 1917 && r.stage1.biome === 'desert', 'stage 1 is Sunspear at (1010,1917) in art px');
  chk(r.stage50 && r.stage50.offMap && r.stage50.y < 0, 'stage 50 lies above the art (offMap)');
  chk(r.ed === 34 && r.edAxe && r.edAxe.n === 'Wight axeman' && r.edAxe.hp === 48 && r.edAxe.spd === 56 && r.edAxe.dmg === 7 && r.edAxe.pal === '#3a4656' && r.edAxe.raw.length === 11, 'ED table: 34 rows, axe columns named');
  chk(r.metaAxe && r.metaAxe.cx === 80 && r.cfgAxe && r.cfgAxe.an === 'walk', 'enemy meta + cfg present');
  chk(r.ch === 49 && r.jon && r.jon.house === 'stark' && r.jon.n === 'Jon Snow' && r.jon.sk.length === 3, 'CH table: 49 champions, jon shaped');
  chk(r.houses.length === 7 && r.skills >= 10, 'houses 7, skills ' + r.skills);
  chk(['gold', 'gem', 'star', 'quests', 'door', 'gift'].every(k => r.icons.includes(k)) && r.iconGold.startsWith('<svg width="30"') && r.sameIcons, 'icons gold/gem/star/quests/door/gift, icon(name,px) sizes, A_ICONS alias');
  chk(r.white && r.white[0] > 0 && r.portraitJon && r.imgNull, 'helpers: white silhouette, portrait(), img() null for unknown');
  /* a picture for the eye: the map with the 50 stage pins at their art positions */
  try {
    fs.mkdirSync(path.join(ROOT, '.shots'), { recursive: true });
    await pg.evaluate(() => {
      const A = R.assets, c = document.createElement('canvas'); c.width = 600; c.height = 1024; c.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;width:390px;height:666px';
      document.body.appendChild(c); const x = c.getContext('2d'); x.drawImage(A.map, 0, 0, 600, 1024);
      for (const s of A_MAP.stages) { const px = s.x / 2, py = s.y / 2; x.fillStyle = s.offMap ? '#4af' : '#e14b4b'; x.beginPath(); x.arc(px, Math.max(6, py), 6, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 9px sans-serif'; x.fillText(s.id, px - 5, Math.max(6, py) + 3); }
    });
    await pg.screenshot({ path: path.join(ROOT, '.shots', 'rpg_assets_map.png') });
  } catch (e) { console.log('shot skipped', e.message); }
  await b.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
