// A33 — R.sfx (src/rpg/js/61_sfx.js): every sound plays, the context runs after a click, the throttle (8×/s per name) and the voice cap (12)
// hold, ambient beds and music hold and release their loop nodes, the master gain follows R.state.opts.sfx, the bus hooks pick the right sound.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_sfx.js
const { chromium } = require('playwright');
const path = require('path');
const NAMES = ['swing', 'hit', 'hitCrit', 'arrow', 'bolt', 'nova', 'shield', 'heal', 'hurt', 'die', 'shatter', 'coin', 'loot', 'levelup', 'quest', 'questDone', 'ui', 'open', 'close', 'error', 'potion', 'dodge', 'roar', 'drums', 'horn', 'door', 'chest', 'fall',
  'howl', 'gull', 'raven', 'crow', 'thunder', 'splash', 'croak', 'wade', 'forge', 'trap', 'stepGrass', 'stepSnow', 'stepSand', 'stepWet', 'stepStone'];
let bad = 0;
const ok = (c, name, info) => { console.log((c ? 'OK   ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); if (!c) bad++; };
const near = (a, b) => Math.abs(a - b) < 1e-6;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PE:' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|net::|telegram/i.test(m.text()) && !/^items\.roll /.test(m.text())) errors.push('C:' + m.text()); });   // items.roll: 30_items throws on some drop kinds (reported to its owner; 32_loot falls back)
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.sfx && R.sfx.play && R.sfx.ambient && R.sfx.music, { timeout: 20000 });

  // 0. lazy: nothing is created before the first gesture; every required name is registered; an unknown name does not throw
  const pre = await page.evaluate(() => ({ ok: R.sfx.ok, ac: !!R.sfx.ac, names: R.sfx.names(), unknown: R.sfx.play('no-such-sound') }));
  ok(pre.ok && !pre.ac, 'lazy: no AudioContext before the first touch', { ok: pre.ok, ac: pre.ac });
  ok(NAMES.every(n => pre.names.includes(n)), 'every required name is registered (' + pre.names.length + ')', NAMES.filter(n => !pre.names.includes(n)));
  ok(pre.unknown === false, 'an unknown name returns false, no throw');

  // 1. a synthetic click unlocks the context
  await page.mouse.click(200, 400); await page.waitForTimeout(250);
  const st = await page.evaluate(() => ({ state: R.sfx.ac && R.sfx.ac.state, unlocked: R.sfx.unlocked, master: !!R.sfx.master }));
  ok(st.state === 'running' && st.unlocked && st.master, 'AudioContext running after a click', st);

  // 2. every name plays without throwing and makes at least one source node
  const played = await page.evaluate(names => { R.state = R.state || R.newState(); const out = {};
    for (const n of names) { try { const v = R.sfx.play(n, 1); out[n] = v ? v.n : v; } catch (e) { out[n] = 'THROW ' + e.message; } R.sfx.stopAll(); } return out; }, pre.names);
  const badNames = Object.entries(played).filter(([, v]) => !(typeof v === 'number' && v > 0));
  ok(!badNames.length, 'every name plays (' + Object.keys(played).length + ' names, source nodes each)', badNames.length ? badNames : played);

  // 3. throttle: 20 calls of one name in one frame → 8 voices; a second later it plays again (the rolling second of stage 2 must pass first)
  await page.waitForTimeout(1100);
  const th = await page.evaluate(() => { R.sfx.stopAll(); const p0 = R.sfx.stats.played, t0 = R.sfx.stats.throttled; let n = 0;
    for (let i = 0; i < 20; i++) if (R.sfx.play('hit')) n++; return { n, played: R.sfx.stats.played - p0, throttled: R.sfx.stats.throttled - t0, voices: R.sfx.voices() }; });
  ok(th.n === 8 && th.played === 8 && th.voices <= 8 && th.throttled === 12, 'throttle: 20 hits in a frame → 8 voices', th);
  await page.waitForTimeout(1100);
  ok(await page.evaluate(() => !!R.sfx.play('hit')), 'throttle releases after a second');

  // 4. polyphony: 20 different names in one frame → 12 live voices; of the 8 over the cap the 6 fanfares (levelup, quest, questDone, open, close, error) steal a voice, ui + potion are dropped
  const poly = await page.evaluate(names => { R.sfx.stopAll(); const c0 = R.sfx.stats.capped, s0 = R.sfx.stats.stolen; let n = 0;
    for (const x of names.filter(x => x !== 'hit').slice(0, 20)) if (R.sfx.play(x)) n++; return { n, voices: R.sfx.voices(), capped: R.sfx.stats.capped - c0, stolen: R.sfx.stats.stolen - s0 }; }, pre.names);
  ok(poly.n === 18 && poly.voices === 12 && poly.capped === 2 && poly.stolen === 6, 'polyphony: 20 names in a frame → 12 voices (6 stolen by fanfares, 2 dropped)', poly);
  const cut = await page.evaluate(() => { R.sfx.stopAll(); return R.sfx.voices(); });
  ok(cut === 0, 'stopAll cuts every voice', cut);

  // 5. ambient beds: nodes are held while a bed plays and released on null; biome strings map to the four kinds
  const amb = await page.evaluate(() => { R.sfx.music(null); const r = { n0: R.sfx.nodes };
    r.k1 = R.sfx.ambient('north'); r.n1 = R.sfx.nodes; r.t1 = R.sfx.timers();
    r.k2 = R.sfx.ambient('the reach'); r.n2 = R.sfx.nodes; r.t2 = R.sfx.timers();
    r.k3 = R.sfx.ambient('dorne'); r.k4 = R.sfx.ambient('iron islands'); r.k5 = R.sfx.ambient('wall'); r.k6 = R.sfx.ambient('stormlands'); r.k7 = R.sfx.ambient('riverlands'); r.k8 = R.sfx.ambient('lands of always winter');
    r.same = R.sfx.ambient('beyond the wall'); r.nSame = R.sfx.nodes;
    r.kn = R.sfx.ambient(null); r.n3 = R.sfx.nodes; r.t3 = R.sfx.timers(); r.kind = R.sfx.ambientKind; return r; });
  ok(amb.n0 === 0 && amb.k1 === 'wind' && amb.n1 > 0 && amb.t1 === 1, 'ambient(north) starts wind nodes + the wolf timer', { n0: amb.n0, k1: amb.k1, n1: amb.n1, t1: amb.t1 });
  ok(amb.k2 === 'birds' && amb.n2 > 0 && amb.t2 === 1, 'ambient(the reach) → birds + crickets with a chirp timer', { k2: amb.k2, n2: amb.n2, t2: amb.t2 });
  ok(amb.k3 === 'desert' && amb.k4 === 'waves' && amb.k5 === 'wind' && amb.k6 === 'waves' && amb.k7 === 'birds' && amb.k8 === 'wind', 'biome → kind mapping', [amb.k3, amb.k4, amb.k5, amb.k6, amb.k7, amb.k8]);
  ok(amb.same === 'wind' && amb.nSame === amb.n1, 'the same kind again does not restart the bed', { same: amb.same, nSame: amb.nSame, n1: amb.n1 });
  ok(amb.kn === null && amb.n3 === 0 && amb.t3 === 0 && amb.kind === null, 'ambient(null) releases every node and timer', { kn: amb.kn, n3: amb.n3, t3: amb.t3 });
  // 5b. fauna by day and night (R.sfx.night forces it): birds / crickets on the green lands, gulls on the coast, a distant wolf in the north
  await page.evaluate(() => { R.sfx.night = false; R.sfx.ambient('reach'); }); await page.waitForTimeout(2000);
  const day = await page.evaluate(() => ({ chirps: R.sfx.stats.chirps, fauna: Object.assign({}, R.sfx.fauna), night: R.sfx.isNight() }));
  ok(day.chirps > 0 && day.fauna.birds && !day.fauna.crickets && day.night === false, 'reach by day: birds chirp, no crickets', day);
  await page.evaluate(() => { R.sfx.night = true; }); await page.waitForTimeout(600);
  const n0 = await page.evaluate(() => ({ chirps: R.sfx.stats.chirps, fauna: Object.assign({}, R.sfx.fauna) })); await page.waitForTimeout(1600);
  const n1 = await page.evaluate(() => R.sfx.stats.chirps);
  ok(n0.fauna.crickets && !n0.fauna.birds && n1 === n0.chirps, 'reach at night: crickets, the birds are quiet', { n0, n1 });
  await page.evaluate(() => { R.sfx.night = false; R.sfx.ambient('coast'); }); await page.waitForTimeout(2800);
  const gulls = await page.evaluate(() => ({ gulls: R.sfx.stats.gulls, kind: R.sfx.ambientKind, on: R.sfx.fauna.gulls }));
  ok(gulls.kind === 'waves' && gulls.gulls > 0 && gulls.on, 'coast by day: gulls', gulls);
  await page.evaluate(() => { R.sfx.night = true; R.sfx.ambient('north'); }); await page.waitForTimeout(2800);
  const wolves = await page.evaluate(() => { const r = { howls: R.sfx.stats.howls, kind: R.sfx.ambientKind, on: R.sfx.fauna.wolves }; R.sfx.ambient(null); R.sfx.night = null; r.fauna = Object.assign({}, R.sfx.fauna); r.nodes = R.sfx.nodes; return r; });
  ok(wolves.kind === 'wind' && wolves.howls > 0 && wolves.on && !wolves.fauna.wolves && wolves.nodes === 0, 'north at night: a distant wolf; ambient(null) clears the fauna flags', wolves);

  // 6. the master gain follows R.state.opts.sfx (numbers and booleans); muted → play returns false
  const gain = await page.evaluate(() => { const r = {}, g = () => R.sfx.master.gain.value;
    R.state.opts.sfx = 0.3; r.s03 = R.sfx.sync(); r.m03 = g();
    R.state.opts.sfx = 0; r.s0 = R.sfx.sync(); r.m0 = g(); r.mutedPlay = R.sfx.play('coin');
    R.state.opts.sfx = false; R.sfx.sync(); r.mF = g(); R.state.opts.sfx = true; R.sfx.sync(); r.mT = g();
    r.set = R.sfx.setVolume(0.6); r.m06 = g(); r.opt = R.state.opts.sfx;
    R.state.opts.sfx = 1; R.sfx.sync(); r.m1 = g(); r.playOn = !!R.sfx.play('coin'); return r; });
  ok(near(gain.m03, 0.3) && gain.m0 === 0 && gain.mutedPlay === false && gain.mF === 0 && gain.mT === 1 && near(gain.m06, 0.6) && gain.opt === 0.6 && gain.m1 === 1 && gain.playOn, 'master gain follows opts.sfx', gain);

  // 7. music: explore drone + plucks, boss pulse, silence releases everything
  const mus = await page.evaluate(() => { const r = {}; r.e = R.sfx.music('explore'); r.ne = R.sfx.nodes; r.te = R.sfx.timers();
    r.b = R.sfx.music('boss'); r.nb = R.sfx.nodes; r.tb = R.sfx.timers(); r.beats0 = R.sfx.stats.beats; return r; });
  await page.waitForTimeout(900);
  const mus2 = await page.evaluate(() => { const r = { beats: R.sfx.stats.beats, plucks: R.sfx.stats.plucks, mode: R.sfx.musMode }; r.m0 = R.sfx.music(null); r.n0 = R.sfx.nodes; r.t0 = R.sfx.timers(); r.mode0 = R.sfx.musMode; return r; });
  ok(mus.e === 'explore' && mus.ne > 0 && mus.te === 1, 'music(explore) starts the drone', mus);
  ok(mus.b === 'boss' && mus.nb > 0 && mus.tb === 1 && mus2.beats - mus.beats0 >= 2 && mus2.plucks > 0 && mus2.mode === 'boss', 'music(boss) pulses (beats scheduled)', { nb: mus.nb, beats: mus2.beats - mus.beats0, plucks: mus2.plucks });
  ok(mus2.m0 === null && mus2.n0 === 0 && mus2.t0 === 0 && mus2.mode0 === null, 'music(null) releases the nodes and timers', { n0: mus2.n0, t0: mus2.t0 });

  // 8. hooks: each bus event picks its sound; boss → drums + boss music; a menu silences it; enter → ambient by biome
  await page.waitForTimeout(1100);
  const hooks = await page.evaluate(() => { const r = {}, last = () => R.sfx.last; const had = n => { const h = R.sfx.hist.slice(); R.sfx.hist.length = 0; return h.includes(n) ? n : h.join(','); };
    if (R.pause) R.pause(true); if (R.player) { R.player.hp = R.player.hpMax = 1e9; } try { if (R.ui && R.ui.cur) R.ui.close(); } catch (e) {}   // the live game must not kill the hero (death screen) or hold a menu open
    R.bus.emit('levelup', 2); r.levelup = last();
    R.bus.emit('gold', 12); r.gold = last();
    R.bus.emit('loot', { rar: 3 }); r.loot = last();
    R.bus.emit('quest', 'q1', 'open'); r.qOpen = last(); R.bus.emit('quest', 'q1', 'done'); r.qDone = last();
    R.bus.emit('btn'); r.btn = last();
    R.player = R.player || { kind: 'player', x: 0, y: 0 };
    R.bus.emit('hit', { src: {}, tgt: R.player, dmg: 3 }); r.hurt = last();
    R.bus.emit('hit', { src: R.player, tgt: {}, dmg: 9, crit: true }); r.crit = last();
    R.bus.emit('hit', { src: R.player, tgt: {}, dmg: 4, kind: 'ice' }); r.ice = last();
    R.sfx.stopAll(); R.sfx.hist.length = 0; R.bus.emit('kill', { kind: 'mob', type: 'wight', lvl: 1, x: 1000, y: 1000, team: 1 }); r.wight = had('die');   // other modules answer a kill with their own sounds (a quest tick): look in the history
    R.sfx.stopAll(); R.bus.emit('kill', { kind: 'mob', type: 'axe', lvl: 1, x: 1000, y: 1000, team: 1 }); r.axe = had('fall'); R.sfx.stopAll();
    R.world = R.world || {}; R.world.regionOf = id => ({ id, biome: id === 'north' ? 'snow' : 'meadow' });
    R.bus.emit('enter', 'north'); r.enter1 = R.sfx.ambientKind; R.bus.emit('enter', 'reach'); r.enter2 = R.sfx.ambientKind;
    R.bus.emit('boss', 'nightking', 0); r.bossMode = R.sfx.musMode; r.drums = last(); r.world = R.sfx.world();
    R.screens.tsfx = { open() {}, close() {} }; R.ui.open('tsfx'); r.menuMode = R.sfx.musMode; R.ui.close(); r.backMode = R.sfx.musMode;
    R.bus.emit('boss', 'nightking', 'end'); r.afterBoss = R.sfx.musMode;
    R.sfx.stopAll(); R.bus.emit('death'); r.death = last(); R.bus.emit('respawn'); r.respawn = last();
    R.bus.emit('kill', { kind: 'boss', type: 'nightking', lvl: 1, x: 1000, y: 1000, team: 1 }); r.bossKill = last();
    R.sfx.music(null); R.sfx.ambient(null); R.sfx.stopAll(); delete R.screens.tsfx; return r; });
  const want = { levelup: 'levelup', gold: 'coin', loot: 'loot', qOpen: 'quest', qDone: 'questDone', btn: 'ui', hurt: 'hurt', crit: 'hitCrit', ice: 'shatter', wight: 'die', axe: 'fall', enter1: 'wind', enter2: 'birds', bossMode: 'boss', drums: 'drums', world: 'boss', menuMode: null, backMode: 'boss', afterBoss: 'explore', death: 'fall', respawn: 'heal', bossKill: 'horn' };
  const wrong = Object.entries(want).filter(([k, v]) => hooks[k] !== v).map(([k, v]) => k + '=' + JSON.stringify(hooks[k]) + ' (want ' + JSON.stringify(v) + ')');
  ok(!wrong.length, 'bus hooks pick the right sound (' + Object.keys(want).length + ' events)', wrong.length ? wrong : undefined);

  // 8b. footsteps: one sound per surface for the player, others only within 300 units and one per 120 ms
  const steps = await page.evaluate(() => { const r = {}, last = () => R.sfx.last; R.sfx.stopAll(); R.player.x = 1000; R.player.y = 1000;
    for (const s of ['snow', 'wet', 'sand', 'stone', 'grass']) { R.bus.emit('footstep', R.player, s); r[s] = last(); } R.bus.emit('footstep', R.player); r.none = last();
    R.sfx.last = null; R.bus.emit('footstep', { kind: 'mob', x: 1600, y: 1000 }, 'stone'); r.far = last();
    R.bus.emit('footstep', { kind: 'mob', x: 1100, y: 1000 }, 'snow'); r.near = last(); R.sfx.last = null; R.bus.emit('footstep', { kind: 'mob', x: 1050, y: 1000 }, 'wet'); r.second = last(); return r; });
  ok(steps.snow === 'stepSnow' && steps.wet === 'stepWet' && steps.sand === 'stepSand' && steps.stone === 'stepStone' && steps.grass === 'stepGrass' && steps.none === 'stepGrass', 'footstep: one sound per surface for the player', steps);
  ok(steps.far === null && steps.near === 'stepSnow' && steps.second === null, 'footstep: others only within 300 units, one per 120 ms', { far: steps.far, near: steps.near, second: steps.second });

  // 9. a real tap on a <button> plays the ui tick (the test's own button sits inside the 390-px-tall landscape viewport)
  await page.evaluate(() => { if (R.player) R.player.hp = R.player.hpMax = 1e9; try { if (R.ui && R.ui.cur) R.ui.close(); } catch (e) {} const b = document.createElement('button'); b.id = 'tsfxb'; b.textContent = 'TAP'; b.style.cssText = 'position:fixed;left:100px;top:200px;width:140px;height:56px;z-index:2147483647'; document.body.appendChild(b); R.sfx.last = null; });
  await page.waitForTimeout(150); await page.tap('#tsfxb'); await page.waitForTimeout(60);
  const tap = await page.evaluate(() => { const l = R.sfx.last; document.getElementById('tsfxb').remove(); return l; });
  ok(tap === 'ui', 'a tap on a <button> plays the ui tick', tap);

  // 10. the sea is heard near the shore: R.water's shoreline south of White Harbor → coast, Winterfell → not
  const coast = await page.evaluate(() => { if (!R.sfx.coastNear || !R.water || !R.water.ready || !R.player) return null; const p = R.player, x0 = p.x, y0 = p.y;
    const WS = R.WS || 1; p.x = 3852 * WS; p.y = 4360 * WS; const a = R.sfx.coastNear(); p.x = 2950 * WS; p.y = 2450 * WS; const b = R.sfx.coastNear(); p.x = x0; p.y = y0; return [a, b, R.sfx.kindOf('coast')]; });
  if (coast) ok(coast[0] === true && coast[1] === false && coast[2] === 'waves', 'waves near a sea shore (R.water), not inland', coast); else console.log('SKIP coast bed: no R.water in this build');
  // the live game starts its own bed / music again (tick1s, screens): stop the world first, then everything must let go
  const left = await page.evaluate(() => { if (R.pause) R.pause(true); R.running = false; R.sfx.music(null); R.sfx.ambient(null); R.sfx.stopAll(); return { nodes: R.sfx.nodes, timers: R.sfx.timers(), state: R.sfx.ac.state }; });
  ok(left.nodes === 0 && left.timers === 0 && left.state === 'running', 'clean at the end', left);
  console.log('ERR', errors); ok(!errors.length, 'no page errors');
  await browser.close();
  console.log(bad ? bad + ' FAIL' : 'ALL OK'); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL crash ' + e.message); process.exit(1); });
