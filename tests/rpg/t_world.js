// RPG A06: R.world runtime over a fake R.data.world (2 regions, 3 POIs, a mask with one blocked column):
// regionAt, blocked, slide stops at the wall, spawnAround stays on walkable ground outside POIs, enter / poi events while
// the player is moved and R.step() runs, the gate pushback + toast, and the ambient population (8–14 mobs, despawn at
// 1400 units, the 6 s cooldown, populate=false).
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_world.js   (RPG_HTML=path overrides beta/index.html)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  p.on('pageerror', e => errors.push('PE:' + e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', '..', process.env.RPG_HTML || 'beta/index.html'));
  await p.waitForFunction(() => window.R && R.world && R.world.regionAt, { timeout: 20000 }); await p.waitForTimeout(200);

  const r = await p.evaluate(() => {
    const out = {}; const log = [];
    // a quiet, deterministic stage: no loop, no screen, our own world data, a fresh save and a player
    R.stop(); if (R.ui && R.ui.cur) R.ui.close(); R.paused = false;
    const rows = []; for (let y = 0; y < 20; y++) { let s = ''; for (let x = 0; x < 20; x++) s += x === 10 ? '#' : '.'; rows.push(s); }   // x 1200–1320 is a wall
    R.data.world = { size: [2400, 2400],
      regions: [{ id: 'south', name: 'The South', lvl: [1, 5], biome: 'plains', poly: [[0, 1200], [2400, 1200], [2400, 2400], [0, 2400]] },
        { id: 'north', name: 'The North', lvl: [20, 25], biome: 'snow', poly: [[0, 0], [2400, 0], [2400, 1200], [0, 1200]], gate: { after: 'south', boss: 'nightking' } }],
      pois: [{ id: 'wf', name: 'Winterfell', type: 'castle', x: 600, y: 1800, region: 'south', house: 'stark', seat: true },
        { id: 'camp', name: 'Wildling camp', type: 'camp', x: 1800, y: 1800, region: 'south' },
        { id: 'shrine', name: 'Weirwood shrine', type: 'shrine', x: 600, y: 400, region: 'north' }],
      roads: [[[600, 1800], [1800, 1800]]],
      spawns: [{ region: 'south', mobs: [{ type: 'axe', w: 3 }, { type: 'hound', w: 1 }], density: 1, lvl: [1, 3] },
        { region: 'north', mobs: [{ type: 'walker', w: 1 }], density: 1, lvl: [20, 25] }],
      mask: { w: 20, h: 20, rows }, start: { stark: 'wf' } };
    { const nk = { id: 'nightking', name: 'The Night King' }, B = R.data.bosses;      // the real boss table (13_bosses) may be an array or a map
      if (!B) R.data.bosses = { nightking: nk }; else if (Array.isArray(B)) { if (!B.find(b => b && b.id === 'nightking')) B.push(nk); } else B.nightking = nk; }
    R.world.reset();
    R.state = R.newState ? R.newState() : { v: 1, p: { flags: {}, found: [] } };
    const ST = () => (R.acc ? R.acc().world : R.state.p);                 // discovered things + gate flags live on the account (Addendum 2)
    ST().flags = ST().flags || {}; ST().found = ST().found || []; for (const k in ST().flags) delete ST().flags[k]; ST().found.length = 0;
    for (const e of R.ents.slice()) if (e.kind === 'mob') R.remove(e);
    let pl = R.player; if (!pl) pl = R.player = R.spawn({ kind: 'player', team: 0, x: 600, y: 1820, r: 14, hp: 100, hpMax: 100, spd: 170, lvl: 1, name: 'me' });
    R.bus.on('enter', id => log.push('enter:' + id)); R.bus.on('poi', id => log.push('poi:' + id));
    const Wd = R.world; const steps = n => { for (let i = 0; i < n; i++) R.step(); };
    const put = (x, y) => { pl.x = x; pl.y = y; pl.vx = 0; pl.vy = 0; };

    // regions
    out.regionS = Wd.regionAt(600, 1800) && Wd.regionAt(600, 1800).id; out.regionN = Wd.regionAt(600, 400) && Wd.regionAt(600, 400).id;
    out.regionOut = [Wd.regionAt(-5, -5), Wd.regionAt(2500, 100), Wd.regionAt(100, 2500)];
    out.regionOf = Wd.regionOf('north') && Wd.regionOf('north').lvl;
    // blocked
    out.blocked = [Wd.blocked(1250, 600), Wd.blocked(1310, 2300), Wd.blocked(600, 600), Wd.blocked(1199, 600), Wd.blocked(1320, 600), Wd.blocked(-1, 5), Wd.blocked(2401, 5), Wd.blocked(5, 2400)];
    // slide: walk east into the wall, then slide along it
    const e = { x: 1100, y: 600, r: 14, vx: 3, vy: 0 }; let movedX = 0; for (let i = 0; i < 100; i++) if (Wd.slide(e, 4, 0)) movedX++;
    out.slideX = { x: e.x, movedX, vx: e.vx }; const y0 = e.y; for (let i = 0; i < 10; i++) Wd.slide(e, 4, 4); out.slideY = { x: e.x, dy: e.y - y0 };
    const w = { x: 1250, y: 600, r: 14 }; Wd.slide(w, -4, 0); Wd.slide(w, -4, 0); out.slideOut = w.x;        // inside the wall: it may leave
    // spawnAround
    R.rng(42); const pts = Wd.spawnAround(600, 1800, 10, { rng: R.rng });
    out.spawn = { n: pts.length, bad: pts.filter(q => { const d = Math.hypot(q.x - 600, q.y - 1800); return Wd.blocked(q.x, q.y) || d < 200 || d > 600 || Wd.inPoi(q.x, q.y, 160) || !Wd.inWorld(q.x, q.y) || Wd.regionAt(q.x, q.y).id !== 'south'; }).length };
    out.spawnNoData = (() => { const d = R.data.world; R.data.world = null; const v = [Wd.spawnAround(600, 1800, 3).length, Wd.regionAt(600, 1800), Wd.blocked(600, 1800), Wd.poiAt(600, 1800), Wd.spawnTableAt(600, 1800), Wd.gateOpen('north')]; R.data.world = d; Wd.reset(); return v; })();
    out.table = [Wd.spawnTableAt(600, 1800) && Wd.spawnTableAt(600, 1800).region, Wd.spawnTableAt(600, 400) && Wd.spawnTableAt(600, 400).region, Wd.spawnTableAt(-10, -10)];
    out.start = Wd.startPos('stark'); out.startOther = Wd.startPos('lannister');
    const rn = Wd.roadNear(1200, 1850, 100); out.road = rn && [Math.round(rn.x), Math.round(rn.y), Math.round(rn.d)]; out.roadFar = Wd.roadNear(1200, 2200, 100);
    out.poiAt = [Wd.poiAt(650, 1800) && Wd.poiAt(650, 1800).id, Wd.poiAt(700, 1800), Wd.poi('camp') && Wd.poi('camp').x];
    out.gate0 = [Wd.gateOpen('south'), Wd.gateOpen('north')];

    // events: standing by Winterfell, then at the camp, then back
    Wd.populate = false;
    put(600, 1820); steps(40); out.log1 = log.slice(); out.found1 = ST().found.slice(); out.regionsFlag = JSON.stringify(ST().flags.regions);
    put(1800, 1820); steps(40); out.log2 = log.slice();
    put(600, 1820); steps(40); out.log3 = log.slice();
    // gate: 20 units into the North while it is closed
    put(600, 1180); steps(40); out.gateY = pl.y; out.gateLog = log.slice(); out.cur = Wd.cur;
    out.toast = [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ');
    // open it: now the North lets him in
    out.toastRaw = /nightking/.test(out.toast);
    ST().flags['gate:north'] = 1; put(600, 1180); steps(40); out.openY = pl.y; out.openLog = log.slice(); out.cur2 = Wd.cur;
    put(600, 400); steps(40); out.shrineLog = log.slice(); out.found2 = ST().found.slice();

    // the house seat stays calm: a batch while standing at Winterfell puts nothing within 600 units of it
    put(600, 1800); for (const m of R.ents.slice()) if (m.kind === 'mob') R.remove(m);
    R.rng(7); Wd.populateNow(R.rng); out.seatCalm = R.ents.filter(m => m.kind === 'mob' && !m.dead && Math.hypot(m.x - 600, m.y - 1800) < 600).length;
    // the home region is never gated for its house: a stark hero walks into a gated region whose home is stark
    { const rg = Wd.regionOf('north'), h0 = rg.home; rg.home = 'stark'; delete ST().flags['gate:north']; const a = R.acc ? R.acc() : R.state.acc || (R.state.acc = {}); const h1 = a.house; a.house = 'stark';
      out.homeOpen = Wd.gateOpen('north'); a.house = 'lannister'; out.otherClosed = !Wd.gateOpen('north'); a.house = h1; rg.home = h0; ST().flags['gate:north'] = 1; }
    // the first placement (a load / a new hero, no last good spot) inside a closed gated region is accepted: no pushback, no toast
    { delete ST().flags['gate:north']; Wd.reset(); Wd.populate = false; put(900, 700); steps(40); out.first = [Math.round(pl.x), Math.round(pl.y), Wd.cur];
      ST().flags['gate:north'] = 1; put(600, 1800); steps(40); }
    // the 5-argument slide (21_player): slide(x, y, nx, ny, r) → {x, y}, stopped by the wall column
    out.slide5 = [Wd.slide(1100, 600, 1110, 604, 14), Wd.slide(1180, 600, 1260, 600, 14)].map(q => [Math.round(q.x), Math.round(q.y)]);
    // population: at the camp (1200 units from the seat), let the system fill the land
    // 1200 units from the seat: a gentle batch (5–8 mobs, levels 1–2), and nothing at all while a dungeon is active
    put(1800, 1800); for (const m of R.ents.slice()) if (m.kind === 'mob') R.remove(m); R.rng(9); Wd.populateNow(R.rng);
    { const E = R.ents.filter(m => m.kind === 'mob' && !m.dead); out.easy = { n: E.length, lv: [...new Set(E.map(m => m.lvl))].sort() }; }
    { const dg0 = R.dungeons; R.dungeons = Object.assign({}, dg0 || {}, { active: { id: 'test' } }); Wd.populate = true; for (const m of R.ents.slice()) if (m.kind === 'mob') R.remove(m);
      const lg = log.length; put(600, 400); steps(60); out.dgQuiet = { mobs: R.ents.filter(m => m.kind === 'mob').length, ev: log.length - lg }; R.dungeons = dg0; Wd.populate = false; put(1800, 1800); steps(40); }
    put(2250, 2250); for (const m of R.ents.slice()) if (m.kind === 'mob') R.remove(m);   // 1720 units from the seat: the full band
    Wd.populate = true; steps(5);
    const mobs = () => R.ents.filter(m => m.kind === 'mob' && !m.dead);
    const m1 = mobs(); out.pop1 = { n: m1.length, bad: m1.filter(m => { const d = Math.hypot(m.x - pl.x, m.y - pl.y); return d < 150 || d > 700 || Wd.blocked(m.x, m.y) || Wd.inPoi(m.x, m.y, 150); }).length, types: [...new Set(m1.map(m => m.type))].sort(), lvls: [...new Set(m1.map(m => m.lvl))].sort(), ambient: m1.filter(m => m.ambient).length };
    out.cd1 = Wd.cooldown();
    put(500, 150); steps(5); out.pop2 = mobs().length;                   // 2100 units away (every old mob > 1400): they go, the cooldown holds the new ones
    steps(400); out.pop3 = mobs().length; out.pop3types = [...new Set(mobs().map(m => m.type))];   // 6.7 s later: a new batch here, from the North's table
    for (const m of R.ents.slice()) if (m.kind === 'mob') R.remove(m);
    Wd.populate = false; steps(400); out.pop4 = mobs().length;           // nothing while populate is off
    Wd.populate = true; steps(400); out.pop5 = mobs().length;
    out.sys = [R.sys.world && R.sys.world.order, R.sys.populate && R.sys.populate.order];
    return out;
  });

  ok('regionAt: south / north by polygon, null outside', r.regionS === 'south' && r.regionN === 'north' && r.regionOut.every(x => x === null), JSON.stringify([r.regionS, r.regionN, r.regionOut]));
  ok('regionOf by id', JSON.stringify(r.regionOf) === '[20,25]', JSON.stringify(r.regionOf));
  ok('blocked: the wall column, outside the world; land free', JSON.stringify(r.blocked) === JSON.stringify([true, true, false, false, false, true, true, true]), JSON.stringify(r.blocked));
  ok('slide stops at the wall (x < 1200) after moving, zeroes vx', r.slideX.x < 1200 && r.slideX.x >= 1180 && r.slideX.movedX >= 20 && r.slideX.movedX < 100 && r.slideX.vx === 0, JSON.stringify(r.slideX));
  ok('slide along the wall: y moves, x held', r.slideY.dy === 40 && r.slideY.x < 1200, JSON.stringify(r.slideY));
  ok('an entity inside a wall can leave it', r.slideOut === 1242, String(r.slideOut));
  ok('spawnAround: 10 walkable points 200–600 away, outside POIs, same region', r.spawn.n === 10 && r.spawn.bad === 0, JSON.stringify(r.spawn));
  ok('without data every helper is safe', JSON.stringify(r.spawnNoData) === JSON.stringify([0, null, false, null, null, true]), JSON.stringify(r.spawnNoData));
  ok('spawnTableAt by region', JSON.stringify(r.table) === JSON.stringify(['south', 'north', null]), JSON.stringify(r.table));
  ok('startPos: the seat + 20 south; a house without a seat falls back to a seat', r.start.x === 600 && r.start.y === 1820 && r.startOther.x === 600, JSON.stringify([r.start, r.startOther]));
  ok('roadNear: the nearest road point within r, null beyond', JSON.stringify(r.road) === '[1200,1800,50]' && r.roadFar === null, JSON.stringify([r.road, r.roadFar]));
  ok('poiAt / poi', JSON.stringify(r.poiAt) === JSON.stringify(['wf', null, 1800]), JSON.stringify(r.poiAt));
  ok('gateOpen: no gate → open, gated + no flag → closed', JSON.stringify(r.gate0) === '[true,false]', JSON.stringify(r.gate0));
  ok('enter(south) + poi(wf) fire after 40 steps; found + flags.regions saved', JSON.stringify(r.log1) === '["enter:south","poi:wf"]' && r.found1.includes('wf') && r.regionsFlag === '{"south":1}', JSON.stringify([r.log1, r.found1, r.regionsFlag]));
  ok('camp: poi(camp), no second enter', JSON.stringify(r.log2) === '["enter:south","poi:wf","poi:camp"]', JSON.stringify(r.log2));
  ok('back at Winterfell: poi(wf) once more (per entry)', r.log3.length === 4 && r.log3[3] === 'poi:wf', JSON.stringify(r.log3));
  ok('closed gate: pushed back south (y ≥ 1200), no enter(north), region stays south', r.gateY >= 1200 && r.gateY <= 1300 && !r.gateLog.includes('enter:north') && r.cur === 'south', JSON.stringify([r.gateY, r.cur, r.gateLog]));
  ok('gate toast names the region and the boss by its display name', /The way into The North is held by The Night King .* defeat it first/.test(r.toast) && !r.toastRaw, r.toast);
  ok('open gate: enter(north) fires, the player stays', Math.abs(r.openY - 1180) < 12 && r.openLog.includes('enter:north') && r.cur2 === 'north', JSON.stringify([r.openY, r.cur2]));
  ok('first placement inside a closed region: accepted where it stands', JSON.stringify(r.first) === '[900,700,"north"]', JSON.stringify(r.first));
  ok('1200 units from the seat: 5–8 mobs, levels 1–2', r.easy.n >= 5 && r.easy.n <= 8 && r.easy.lv.every(l => l <= 2), JSON.stringify(r.easy));
  ok('a dungeon is active: no enter / poi events, no ambient spawns', r.dgQuiet.mobs === 0 && r.dgQuiet.ev === 0, JSON.stringify(r.dgQuiet));
  ok('the seat stays calm: no ambient mob within 600 units of it', r.seatCalm === 0, String(r.seatCalm));
  ok('the home region is never gated for its own house (and still is for another)', r.homeOpen === true && r.otherClosed === true, JSON.stringify([r.homeOpen, r.otherClosed]));
  ok('slide(x, y, nx, ny, r) → {x, y}: free move, stopped before the wall', JSON.stringify(r.slide5[0]) === '[1110,604]' && r.slide5[1][0] < 1200, JSON.stringify(r.slide5));
  ok('shrine found in the North', r.shrineLog[r.shrineLog.length - 1] === 'poi:shrine' && r.found2.includes('shrine'), JSON.stringify([r.shrineLog, r.found2]));
  ok('population: 8–14 mobs from the south table, 150–700 away, off POIs, marked ambient', r.pop1.n >= 8 && r.pop1.n <= 14 && r.pop1.bad === 0 && r.pop1.types.every(t => t === 'axe' || t === 'hound') && r.pop1.lvls.every(l => l >= 1 && l <= 3) && r.pop1.ambient === r.pop1.n, JSON.stringify(r.pop1));
  ok('spawn cooldown armed (6 s)', r.cd1 > 5 && r.cd1 <= 6, String(r.cd1));
  ok('2100 units away: old mobs despawned, cooldown holds', r.pop2 === 0, String(r.pop2));
  ok('after 6.7 s: a new batch of 8–14 from the new region\'s table', r.pop3 >= 8 && r.pop3 <= 14 && JSON.stringify(r.pop3types) === '["walker"]', JSON.stringify([r.pop3, r.pop3types]));
  ok('populate=false: nothing; true again: refilled', r.pop4 === 0 && r.pop5 >= 8 && r.pop5 <= 14, JSON.stringify([r.pop4, r.pop5]));
  ok('systems registered: world 50, populate 60', JSON.stringify(r.sys) === '[50,60]', JSON.stringify(r.sys));
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(T, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(T).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
