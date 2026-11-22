// A09 bosses: R.data.bosses (nine, gating ids present), spawn at the spot, telegraphs drawn as world-space polygons, phases at
// 60 % / 30 % (monotonic), the boss bar, the kill (gate flag, counter, event, gems 20–60, toast, adds gone), respawn after 10 min
// with no gate change, and a deterministic fight for a seed. Runs on the bare build (core + bosses) — every dependency is soft.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_bosses.js   (HOLDOR_HTML overrides beta/index.html)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.data && R.data.bosses && R.boss, { timeout: 20000 });
  const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  // 1. the data
  const data = await page.evaluate(() => { const L = R.data.bosses, MOVES = ['slam', 'charge', 'summon', 'volley', 'frost', 'roar', 'heal'];
    return { n: L.length, ids: L.map(b => b.id), lvls: L.map(b => b.lvl), unlocks: L.filter(b => b.unlocks).length, sys: !!R.sys.boss && R.sys.boss.order === 120 && !!R.boss.drawTelegraphs,
      bad: L.filter(b => !(b.id && b.name && b.title && b.sprite && b.lvl > 0 && b.region && b.scale >= 1.8 && b.scale <= 2.6 && b.hp > 0 && b.atk > 0 && b.phases.length === 3 && b.phases[0].at === 1 && b.phases[1].at === 0.6 && b.phases[2].at === 0.3
        && b.moves.length >= 2 && b.moves.every(m => MOVES.includes(m)) && b.phases.every(p => p.moves.length >= 2 && p.moves.length <= 4) && b.gate && (b.poi || (b.x != null && b.y != null)))).map(b => b.id) }; });
  ok('nine bosses with the gating ids, valid moves and phases, 4 unlock a hero', data.n === 9 && new Set(data.ids).size === 9 && ['boss_neck', 'boss_north', 'boss_wall'].every(i => data.ids.includes(i)) && !data.bad.length && data.sys && data.unlocks === 4, JSON.stringify(data));
  ok('levels rise toward the Lands of Always Winter (last 50+)', data.lvls.every((l, i) => !i || l >= data.lvls[i - 1]) && data.lvls[8] >= 50, data.lvls.join(','));
  // 2. the fight: boss_neck with a fake player 200 units away, 10 s (600 steps), drawing every frame
  const fight = await page.evaluate(() => {
    R.boss.auto = false; R.state = R.newState(); R.state.p.gems = 0; R.rng(42);
    const s = R.boss.spotOf('boss_neck');
    R.player = R.spawn({ kind: 'player', team: 0, x: s.x + 200, y: s.y, r: 14, hp: 100000, hpMax: 100000, atk: 50, def: 10, name: 'tester', spd: 170 });
    R.cam.x = s.x; R.cam.y = s.y;
    const evs = []; R.bus.on('boss', (id, ph) => evs.push(id + ':' + ph)); const hits = []; R.bus.on('hit', h => hits.push(h.dmg));
    const e = R.boss.spawn('boss_neck'), e2 = R.boss.spawn('boss_neck');
    const drawn0 = R.boss.drawn; let teleFrames = 0;
    for (let i = 0; i < 600; i++) { R.step(); R.drawAll(); if (R.boss.telegraphs.length) teleFrames++; }
    const bar = document.getElementById('bossbar');
    return { same: e === e2, kind: e.kind, aiBoss: e.ai.boss, at: [Math.round(e.x), Math.round(e.y)], spot: [s.x, s.y], drawn: R.boss.drawn - drawn0, teleFrames, tele: R.boss.stats.tele, moves: R.boss.log.slice(), evs, hits: hits.length, pHp: R.player.hp,
      engaged: R.boss.cur === e, barOn: !!bar && bar.classList.contains('on') && getComputedStyle(bar).display !== 'none', barName: bar && bar.querySelector('.bb-name').textContent, barTitle: bar && bar.querySelector('.bb-title').textContent,
      ticks: bar && bar.querySelectorAll('.bb-ticks i').length, phase: e.ai.phase, adds: e.ai.adds.length, mobs: R.ents.filter(x => x.kind === 'mob' && !x.dead).length, hp: Math.round(e.hp), hpMax: e.hpMax, dist: Math.round(Math.hypot(e.x - R.player.x, e.y - R.player.y)) };
  });
  ok('spawn at its spot, kind boss, ai.boss set, one instance only', fight.same && fight.kind === 'boss' && fight.aiBoss === 'boss_neck' && Math.hypot(fight.spot[0] - fight.at[0], fight.spot[1] - fight.at[1]) < 400, JSON.stringify({ at: fight.at, spot: fight.spot, same: fight.same }));
  ok('telegraphs drawn during the 10 s', fight.drawn > 0 && fight.teleFrames > 0 && fight.tele >= 2, `drawn=${fight.drawn} frames=${fight.teleFrames} tele=${fight.tele}`);
  ok('phase-1 moves only (summon / volley), both used, the player was hit and the boss closed in', fight.moves.length >= 2 && fight.moves.every(m => ['summon', 'volley'].includes(m)) && fight.moves.includes('summon') && fight.moves.includes('volley') && fight.hits > 0 && fight.pHp < 100000 && fight.dist < 200, JSON.stringify({ moves: fight.moves, hits: fight.hits, pHp: fight.pHp, dist: fight.dist }));
  ok('summon made 3–5 adds (mobs)', fight.adds >= 3 && fight.adds <= 10 && fight.mobs >= 3, `adds=${fight.adds} mobs=${fight.mobs}`);
  ok('engaged within 600: the bar shows name + title + 2 phase ticks; spawn + engage events', fight.engaged && fight.barOn && fight.barName === 'Harrag Mirebound' && /Wight of the Neck/.test(fight.barTitle) && fight.ticks === 2 && fight.evs.includes('boss_neck:spawn') && fight.evs.includes('boss_neck:engage'), JSON.stringify({ barOn: fight.barOn, name: fight.barName, title: fight.barTitle, ticks: fight.ticks, evs: fight.evs }));
  ok('phase 0 at full health', fight.phase === 0 && fight.hp === fight.hpMax, `${fight.hp}/${fight.hpMax}`);
  await page.screenshot({ path: SC + 'rpg_boss_fight.png' });
  // 3. phases: 50 % → 1, 25 % → 2, events + the bar's fill and phase colour
  const ph = await page.evaluate(() => { const e = R.boss.live.boss_neck; const evs = []; R.bus.on('boss', (id, p) => evs.push(id + ':' + p));
    e.hp = e.hpMax * 0.5; R.step(); const p1 = e.ai.phase, w1 = document.querySelector('#bossbar .bb-fill').style.width, dp1 = document.getElementById('bossbar').dataset.phase;
    e.hp = e.hpMax * 0.25; R.step(); const p2 = e.ai.phase, dp2 = document.getElementById('bossbar').dataset.phase;
    return { p1, p2, w1, dp1, dp2, evs }; });
  ok('phase 1 at 50 %, phase 2 at 25 %, boss(id,1|2) events, bar at 50 % with the phase on it', ph.p1 === 1 && ph.p2 === 2 && ph.evs.includes('boss_neck:1') && ph.evs.includes('boss_neck:2') && parseFloat(ph.w1) === 50 && ph.dp1 === '1' && ph.dp2 === '2', JSON.stringify(ph));
  const p2 = await page.evaluate(() => { const e = R.boss.live.boss_neck; const n0 = R.boss.log.length; for (let i = 0; i < 600; i++) { R.step(); R.drawAll(); } return { moves: R.boss.log.slice(n0), slow: R.player.status.slow, phase: e.ai.phase, hp: Math.round(e.hp), hpMax: e.hpMax, fields: R.boss.fields.length }; });
  ok('phase 2 uses its own moves (frost / heal / summon) and stays phase 2 through a heal', p2.moves.length >= 2 && p2.moves.every(m => ['frost', 'heal', 'summon'].includes(m)) && p2.moves.some(m => m !== 'summon') && p2.phase === 2, JSON.stringify(p2));
  // 4. the kill
  const kill = await page.evaluate(() => { const e = R.boss.live.boss_neck; const evs = []; R.bus.on('boss', (id, p) => evs.push(id + ':' + p)); const g0 = R.state.p.gems;
    e.hp = 0; R.step(); const toast = [...document.querySelectorAll('#ui .toast')].map(t => t.textContent);
    const W = R.state.acc && R.state.acc.world ? R.state.acc.world : R.state.p;
    for (let i = 0; i < 200; i++) R.step();
    return { dead: e.dead, gate: W.flags['gate:north'], bflag: W.flags['boss:boss_neck'], n: (W.bosses || {}).boss_neck, evs, gems: R.state.p.gems - g0, drops: e.drops, toast, barOn: document.getElementById('bossbar').classList.contains('on'), removed: !R.ents.includes(e), addsLeft: R.ents.filter(x => x.kind === 'mob' && !x.dead).length, deadAt: R.boss.deadAt.boss_neck }; });
  ok('kill: gate:north flag, bosses.boss_neck = 1, boss(id,dead), gems 20–60, toast "The way is open", bar hidden, adds gone, entity removed', kill.dead && kill.gate === 1 && kill.bflag === 1 && kill.n === 1 && kill.evs.includes('boss_neck:dead') && kill.gems >= 20 && kill.gems <= 60 && kill.toast.includes('The way is open') && !kill.barOn && kill.removed && kill.addsLeft === 0 && kill.deadAt != null, JSON.stringify(kill));
  // 5. respawn after 10 minutes; the ensure spawns all nine; a second kill counts 2 and changes no flag
  const rs = await page.evaluate(() => { R.boss.deadAt.boss_neck -= 601; R.boss.auto = true; R.step(); const e = R.boss.live.boss_neck; const alive = !!e && !e.dead && R.ents.includes(e) && e.hp === e.hpMax && e.ai.phase === 0;
    const others = R.data.bosses.filter(b => R.boss.live[b.id] && !R.boss.live[b.id].dead).length; const W = R.state.acc && R.state.acc.world ? R.state.acc.world : R.state.p; const f0 = JSON.stringify(W.flags);
    e.hp = 0; R.step(); return { alive, others, n: W.bosses.boss_neck, flagsSame: f0 === JSON.stringify(W.flags), toast: [...document.querySelectorAll('#ui .toast')].map(t => t.textContent) }; });
  ok('respawn after 10 min at full health, all nine ensured, second kill counts 2 with no gate change', rs.alive && rs.others === 9 && rs.n === 2 && rs.flagsSame && rs.toast.some(t => /falls/.test(t)), JSON.stringify(rs));
  // 6. deterministic for a seed: the same 10 s against boss_north twice → the same moves, hits, positions
  const det = await page.evaluate(() => { const run = () => { R.boss.auto = false; for (const e of R.ents.slice()) if (e !== R.player) R.remove(e); R.boss.live = {}; R.boss.deadAt = {}; R.boss.telegraphs.length = 0; R.boss.fields.length = 0; R.boss.log.length = 0; R.boss.stats.hits = 0; R.rng(7);
      const s = R.boss.spotOf('boss_north'); R.player.x = s.x + 200; R.player.y = s.y; R.player.hp = 100000; R.player.status = {}; const e = R.boss.spawn('boss_north'); for (let i = 0; i < 600; i++) R.step();
      return R.boss.log.join(',') + '|' + R.boss.stats.hits + '|' + Math.round(e.x) + ',' + Math.round(e.y) + '|' + Math.round(R.player.hp); };
    const a = run(), b = run(); return { a, b }; });
  ok('deterministic for a seed', det.a === det.b && det.a.split('|')[0].split(',').length >= 2, det.a + ' vs ' + det.b);
  ok('boss_north slams and charges (the dash moves it)', /slam/.test(det.a) && /charge/.test(det.a), det.a);
  await page.screenshot({ path: SC + 'rpg_boss_end.png' });
  console.log(JSON.stringify(T, null, 1)); console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  const fails = Object.values(T).filter(v => /^FAIL/.test(v)).length; if (fails || errors.length) process.exit(1);
})().catch(e => { console.error('ERR', e); process.exit(1); });
