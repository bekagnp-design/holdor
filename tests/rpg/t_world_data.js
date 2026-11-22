// HOLDOR RPG — R.data.world integrity (A07): regions, POIs, roads, spawn tables, the blocked mask, gates, house starts.
// Run: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=... node tests/rpg/t_world_data.js   (HOLDOR_HTML overrides the page)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots'); fs.mkdirSync(SC, { recursive: true });
// every enemy key of the old game (const ED in src/base/index.v1.0.44.html)
// + A08's new keys (bandit, bandit_archer, brownbear, raider, spearwife, direwolf)
const ED_KEYS = ['axe', 'sword', 'archer', 'spear', 'shield', 'child', 'crawler', 'crypt', 'berserk', 'thenn', 'necro', 'skin', 'chief', 'hound', 'wolf', 'boar', 'bear', 'cat', 'elk', 'mammoth', 'giant', 'spider', 'brood', 'raven', 'bat', 'eagle', 'rider', 'outrider', 'wraith', 'shade', 'walker', 'bandit', 'bandit_archer', 'brownbear', 'raider', 'spearwife', 'direwolf'];
const HOUSES = ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.data && R.data.world, { timeout: 20000 });
  const out = {}; let fails = 0;
  const ok = (k, v, info) => { out[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); if (!v) fails++; };

  const r = await page.evaluate(({ ED_KEYS, HOUSES }) => {
    const w = R.data.world, res = {};
    const dist2seg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
    const dist2road = (p, rd) => { let m = 1e9; for (let i = 1; i < rd.length; i++) m = Math.min(m, dist2seg(p, rd[i - 1], rd[i])); return m; };
    const rows = w.mask.rows; res.dims = { W: w.W, H: w.H, size: w.size, MW: w.mask.w, MH: w.mask.h, CELL: w.mask.cell, rows: rows.length, cols: rows.map(r => r.length), chars: [...new Set(rows.join(''))].join('') };
    res.nRegions = w.regions.length; res.nPois = w.pois.length; res.nRoads = w.roads.length; res.nSpawns = w.spawns.length; res.spawnsArray = Array.isArray(w.spawns) && w.spawns.every(s => s.region && Array.isArray(s.mobs) && s.lvl && s.lvl.length === 2);
    // regions: closed, non-degenerate polygons inside the world, a sane level band, a spawn table, a boss id, a shrine
    res.badRegions = [];
    for (const rg of w.regions) {
      const P = rg.poly; const A = Math.abs(w.polyArea(P));
      if (!Array.isArray(P) || P.length < 3) res.badRegions.push(rg.id + ': poly');
      if (A < 300000) res.badRegions.push(rg.id + ': area ' + Math.round(A));
      if (P.some(p => !(p[0] >= 0 && p[0] <= w.W && p[1] >= 0 && p[1] <= w.H))) res.badRegions.push(rg.id + ': point outside world');
      if (P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) res.badRegions.push(rg.id + ': repeats first point');
      if (!(rg.lvl && rg.lvl[0] >= 1 && rg.lvl[1] >= rg.lvl[0] && rg.lvl[1] <= 60)) res.badRegions.push(rg.id + ': lvl');
      const S = w.spawns.find(s => s.region === rg.id); if (!S || !S.mobs.length) res.badRegions.push(rg.id + ': no spawns');
      else for (const s of S.mobs) if (ED_KEYS.indexOf(s.type) < 0 || !(s.w > 0)) res.badRegions.push(rg.id + ': spawn ' + JSON.stringify(s));
      if (!rg.boss) res.badRegions.push(rg.id + ': boss');
      if (!w.pois.some(p => p.type === 'shrine' && p.region === rg.id)) res.badRegions.push(rg.id + ': no shrine');
      if (!rg.biome || !rg.col || !rg.blurb) res.badRegions.push(rg.id + ': biome/col/blurb');
    }
    // POIs: unique ids, inside their region polygon, on a walkable cell, with a blurb and an npc list
    res.badPois = []; const ids = {};
    for (const p of w.pois) {
      if (ids[p.id]) res.badPois.push(p.id + ': duplicate'); ids[p.id] = 1;
      const rg = w.regionAt(p.x, p.y); if (!rg || rg.id !== p.region) res.badPois.push(p.id + ': region ' + p.region + ' / polygon ' + (rg && rg.id));
      if (!w.regionById[p.region]) res.badPois.push(p.id + ': unknown region');
      if (w.blocked(p.x, p.y)) res.badPois.push(p.id + ': blocked cell');
      if (!p.blurb || p.blurb.length < 12) res.badPois.push(p.id + ': blurb'); if (!Array.isArray(p.npcs)) res.badPois.push(p.id + ': npcs');
      if (!p.name || !p.type) res.badPois.push(p.id + ': name/type');
    }
    res.types = {}; for (const p of w.pois) res.types[p.type] = (res.types[p.type] || 0) + 1;
    res.dungeons = w.pois.filter(p => p.type === 'dungeon').map(p => p.id).sort();
    res.camps = w.pois.filter(p => p.type === 'camp').length; res.shrines = w.pois.filter(p => p.type === 'shrine').length;
    res.places = w.pois.filter(p => ['castle', 'town', 'seat'].indexOf(p.type) >= 0).length;
    res.services = { shop: w.pois.filter(p => p.shop).length, inn: w.pois.filter(p => p.inn).length, smith: w.pois.filter(p => p.smith).length };
    // seats and starts
    res.seats = HOUSES.map(h => { const id = w.start[h], p = w.poiById[id]; const rg = p && w.regionById[p.region]; return { h, id, ok: !!(p && p.seat && p.house === h && rg && rg.lvl[0] === 1 && rg.home === h && !w.gateFor(rg.id, h)) }; });
    res.startPos = HOUSES.map(h => { const s = w.startPos(h); return !w.blocked(s.x, s.y) && w.regionAt(s.x, s.y) && w.regionAt(s.x, s.y).id === w.poiById[w.start[h]].region; });
    // roads
    res.badRoads = [];
    for (const rd of w.roads) { if (!Array.isArray(rd) || rd.length < 2 || !rd.id) { res.badRoads.push((rd && rd.id) + ': not a point list with an id'); continue; } let n = 0; for (let i = 1; i < rd.length; i++) { const a = rd[i - 1], b = rd[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t <= L; t += 40) if (w.blocked(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L)) n++; } if (n) res.badRoads.push(rd.id + ': ' + n + ' blocked samples'); }
    const kr = w.roads.find(r => r.id === 'kingsroad'); const wf = w.poiById.winterfell, kl = w.poiById.kingslanding;
    res.kingsroad = kr ? { wf: Math.round(dist2road([wf.x, wf.y], kr)), kl: Math.round(dist2road([kl.x, kl.y], kr)), cb: Math.round(dist2road([w.poiById.castleblack.x, w.poiById.castleblack.y], kr)), se: Math.round(dist2road([w.poiById.stormsend.x, w.poiById.stormsend.y], kr)) } : null;
    res.namedRoads = ['kingsroad', 'roseroad', 'goldroad', 'riverroad', 'highroad', 'princespass'].filter(id => w.roads.some(r => r.id === id));
    // gates
    const BOSSES = ['boss_kingswood', 'boss_iron', 'boss_dorne', 'boss_vale', 'boss_neck', 'boss_north', 'boss_wall', 'boss_beyond', 'boss_winter'];   // A09's ids
    res.gates = w.gates.map(g => ({ region: g.region, after: g.after, boss: g.boss, via: g.via, ok: !!(w.regionById[g.region] && w.regionById[g.after] && w.poiById[g.via] && BOSSES.indexOf(g.boss) >= 0 && w.regionById[g.region].gate.boss === g.boss && w.regionById[g.region].gate.after === g.after) }));
    res.neck = w.gateFor('north', 'lannister') && w.gateFor('north', 'lannister').boss === 'boss_neck' && !w.gateFor('north', 'stark') && w.poiById.moat_cailin.region === 'riverlands';
    res.wallGate = w.gateFor('wall', 'stark') && w.gateFor('wall', 'stark').boss === 'boss_north' && w.gateFor('beyond', 'stark') && w.gateFor('beyond', 'stark').boss === 'boss_wall' && w.gateFor('winter', 'stark') && w.gateFor('winter', 'stark').boss === 'boss_beyond';
    // mask: the sea around Westeros is blocked, the seats are not, the frozen north is open
    res.maskSamples = { sunsetSea: w.blocked(300, 7000), narrowSea: w.blocked(6900, 6000), summerSea: w.blocked(3600, 12200), godsEye: w.blocked(4080, 7440), valeRidge: w.blocked(5000, 5600), frozenBay: w.blocked(1200, 800), fist: w.blocked(2500, 300) };
    res.blockedShare = Math.round(100 * rows.join('').split('#').length / (w.mask.w * w.mask.h));
    res.npcs = { n: Object.keys(w.npcs).length, ok: Object.values(w.npcs).every(n => n.id && n.name && n.role && w.poiById[n.poi] && w.poiById[n.poi].npcs.indexOf(n.id) >= 0) };
    res.a09pois = ['kingswood', 'old_wyk', 'princes_pass', 'bloody_gate', 'moat_cailin', 'queenscrown', 'nightfort', 'fist_of_first_men', 'heart_of_winter'].filter(id => !w.poiById[id]);
    return res;
  }, { ED_KEYS, HOUSES });

  ok('no page errors', !errors.length, errors.join(' | '));
  ok('world 7200x12288, mask 60x102 of # and .', r.dims.W === 7200 && r.dims.H === 12288 && r.dims.size[0] === 7200 && r.dims.size[1] === 12288 && r.dims.MW === 60 && r.dims.MH === 102 && r.dims.CELL === 120 && r.dims.rows === 102 && r.dims.cols.every(c => c === 60) && /^[#.]+$/.test(r.dims.chars), JSON.stringify(r.dims.chars));
  ok('regions >= 9 (' + r.nRegions + ') all valid', r.nRegions >= 9 && !r.badRegions.length, r.badRegions.join('; '));
  ok('spawn table for every region (' + r.nSpawns + '), A06 shape', r.nSpawns === r.nRegions && r.spawnsArray);
  ok('npcs (' + r.npcs.n + ') each at a POI that lists it', r.npcs.n >= 100 && r.npcs.ok);
  ok('the POIs A09 anchors bosses to exist', !r.a09pois.length, r.a09pois.join(','));
  ok('POIs >= 45 (' + r.nPois + ') inside their region and walkable', r.nPois >= 45 && !r.badPois.length, r.badPois.join('; '));
  ok('20+ castles/towns (' + r.places + '), camps (' + r.camps + '), 6+ shrines (' + r.shrines + ')', r.places >= 20 && r.camps >= 8 && r.shrines >= 6, JSON.stringify(r.types));
  ok('3 dungeon portals', JSON.stringify(r.dungeons) === JSON.stringify(['dg_caves', 'dg_crypts', 'dg_harrenhal']), r.dungeons.join(','));
  ok('shops, inns and smiths exist', r.services.shop >= 10 && r.services.inn >= 10 && r.services.smith >= 7, JSON.stringify(r.services));
  ok('7 house seats at level-1 home regions without a gate', r.seats.every(s => s.ok), JSON.stringify(r.seats.filter(s => !s.ok)));
  ok('start positions walkable in the seat region', r.startPos.every(Boolean), JSON.stringify(r.startPos));
  ok('roads >= 6 (' + r.nRoads + ') and none crosses a blocked cell', r.nRoads >= 6 && !r.badRoads.length, r.badRoads.join('; '));
  ok('the six named roads exist', r.namedRoads.length === 6, r.namedRoads.join(','));
  ok('the Kingsroad passes within 60 of Winterfell and King\'s Landing', r.kingsroad && r.kingsroad.wf <= 60 && r.kingsroad.kl <= 60 && r.kingsroad.cb <= 60 && r.kingsroad.se <= 60, JSON.stringify(r.kingsroad));
  ok('gates: the Neck, the Wall, beyond, winter (4) with A09 boss ids', r.gates.length === 4 && r.gates.every(g => g.ok) && r.neck && r.wallGate, JSON.stringify(r.gates));
  ok('mask: seas and the God\'s Eye blocked, the ridge blocked, the frozen north open', r.maskSamples.sunsetSea && r.maskSamples.narrowSea && r.maskSamples.summerSea && r.maskSamples.godsEye && r.maskSamples.valeRidge && !r.maskSamples.frozenBay && !r.maskSamples.fist, JSON.stringify(r.maskSamples));
  ok('blocked share sane (' + r.blockedShare + '%)', r.blockedShare > 25 && r.blockedShare < 70);

  await page.screenshot({ path: path.join(SC, 'rpg_world_data.png') });
  await browser.close();
  for (const k in out) console.log(k + ': ' + out[k]);
  console.log(fails ? 'FAIL ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
