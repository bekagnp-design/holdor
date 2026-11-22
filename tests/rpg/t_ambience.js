// A34 ambience: the clock (20 real minutes a day, kept in the account flags), night → tint > .3, snow particles that move each step,
// a flash that decays to 0, drawTint darkens a white canvas at night and not at noon, the 3D sun/fog/cloud driver ≤ 4×/s,
// cloud shadows, lightning + thunder, aurora beyond the Wall, the moon, Dorne's noon shimmer, coastal spray, sunDir; drawTint under budget.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_ambience.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.RPG_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.ambience && R.sys.ambience, { timeout: 20000 });
  const r = await page.evaluate(() => {
    const A = R.ambience, S = R.sys.ambience, out = {};
    const steps = n => { for (let i = 0; i < n; i++) R.step(); };
    out.order = S.order; out.hasDraw = typeof S.draw === 'function' && typeof S.drawTint === 'function';
    R.state = R.newState(); R.state.p.flags = R.state.p.flags || {};
    // the integrated build is live: keep the real 3D scene and the player's region out of the unit checks (restored at the end)
    const keep3d = R.render3d, keepW = R.world; R.render3d = undefined; if (keepW) R.world = Object.assign(Object.create(keepW), { regionAt: () => null }); if (R.pause) R.pause(false);
    // noon: no night, no tint (no world → no biome tint)
    A.set('clear'); A.setHour(12); steps(2);
    out.noonNight = A.night; out.noonA = A.tint.a; out.noonPhase = A.phase; out.noonMul = A.spawnMul;
    const len = v => Math.hypot(v.x, v.y, v.z); out.sunNoon = { ...A.sunDir, len: len(A.sunDir) };
    // 23:00: night, tint > .3, the clock is in the flags
    A.setHour(23); steps(1);
    out.nightNight = A.night; out.nightA = A.tint.a; out.nightTint = { ...A.tint }; out.nightMul = A.spawnMul; out.flagClock = R.state.p.flags.clock;
    out.sunNight = { ...A.sunDir, len: len(A.sunDir) }; out.moon = { ...A.moon };
    // the clock: 60 steps = 1 game second = 0.02 h; and it wraps at 24
    const h0 = A.hour; steps(60); out.dHour = A.hour - h0;
    A.setHour(23.999); steps(60); out.wrapHour = A.hour;
    // an external clock in the flags is adopted (continues across sessions / heroes)
    R.state.p.flags.clock = 3.5; steps(1); out.adopted = A.hour; out.adoptedNight = A.night;
    // dusk and dawn carry a warm tint, still no night
    A.setHour(19.6); steps(1); out.dusk = { ...A.tint, night: A.night, phase: A.phase };
    A.setHour(6.2); steps(1); out.dawn = { ...A.tint, night: A.night, phase: A.phase };
    // snow: particles appear at once and move every step
    A.setHour(14); A.set('snow'); steps(1);
    out.snowN = A.parts.filter(p => !p.fade).length; out.snowKinds = [...new Set(A.parts.filter(p => !p.fade).map(p => p.kind))]; out.cap = A.cap; out.reduced = A.reduced;
    const pos = A.parts.map(p => [p.x, p.y]); steps(1);
    out.snowMoved = A.parts.filter((p, i) => pos[i] && (p.x !== pos[i][0] || p.y !== pos[i][1])).length;
    out.snowWeather = A.weather; out.snowAuto = A.auto;
    // the weather changes: the old flakes fade away, rain comes
    A.set('rain'); steps(45); out.afterRain = [...new Set(A.parts.map(p => p.kind))]; out.rainN = A.parts.filter(p => p.kind === 'rain').length;
    A.set('clear'); steps(45); out.clearN = A.parts.length;
    // flash: .85 → 0 over half a second
    A.flash('#ff3030', .5); out.flash0 = A.flashA; steps(15); out.flashMid = A.flashA; steps(45); out.flashEnd = A.flashA; out.flashLeft = A.flashes.length;   // 45 steps: the live game's hit-stop can stretch a few
    // lightning: strike() → a bolt + a short flash; thunder 1–3 s later through R.sfx.play
    const sfx = [], keepSfx = R.sfx; R.sfx = { play: (n, v) => { if (n === 'thunder') sfx.push(n); } };   // other live modules play their own sounds (croaks)
    A.strike(); out.bolt = { n: A.bolts.length, pts: A.bolts[0] && A.bolts[0].main.length, br: A.bolts[0] && A.bolts[0].br.length, flash: A.flashA };
    steps(30); out.boltGone = A.bolts.length; out.thunderEarly = sfx.length; steps(180); out.thunder = sfx.slice();
    // automatic lightning in the rain
    sfx.length = 0; A.set('rain'); steps(1500); out.rainStrikes = sfx.length; A.set('clear'); steps(200); R.sfx = keepSfx;
    // drawTint on a white canvas: darker at night, untouched at noon (clouds off for the pure tint check)
    const c = document.createElement('canvas'); c.width = 100; c.height = 100; const x = c.getContext('2d');
    const white = () => { x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.fillStyle = '#fff'; x.fillRect(0, 0, 100, 100); };
    const px = () => [...x.getImageData(50, 50, 1, 1).data].slice(0, 3);
    A.cloud.on = false; A.lightsOn = false;   // the live player / castles would add their warm glows to the test canvas
    A.set('clear'); A.setHour(23); steps(1); white(); S.drawTint(x); out.pxNight = px();
    A.setHour(12); steps(1); white(); S.drawTint(x); out.pxNoon = px();
    // draw(ctx) paints the tint when drawTint was not called this frame, and skips when it was
    A.setHour(23); steps(1); white(); S.draw(x); out.pxDraw = px();
    steps(1); white(); S.drawTint(x); const a1 = px(); S.draw(x); out.pxDrawSkipped = px()[0] === a1[0];
    // clouds: by day, soft shadows somewhere on a 400×400 white canvas; none when off
    A.cloud.on = true; A.lightsOn = true; A.setHour(12); steps(1);
    const c2 = document.createElement('canvas'); c2.width = c2.height = 400; const x2 = c2.getContext('2d');
    const minCh = () => { const d = x2.getImageData(0, 0, 400, 400).data; let m = 255; for (let i = 0; i < d.length; i += 4) if (d[i] < m) m = d[i]; return m; };
    x2.fillStyle = '#fff'; x2.fillRect(0, 0, 400, 400); S.drawTint(x2); out.cloudMin = minCh(); out.cloudTex = A.cloud.tex && A.cloud.tex.width;
    A.cloud.on = false; x2.fillStyle = '#fff'; x2.fillRect(0, 0, 400, 400); S.drawTint(x2); out.cloudOffMin = minCh(); A.cloud.on = true;
    // the 3D driver: a mock R.render3d, called at most 4× per game second; the cloud texture handed over once
    const calls = [], cloudCalls = []; R.render3d = { setSun: (e, c) => calls.push(['sun', e, c]), setFog: (c, n, f) => calls.push(['fog', c, n, f]), setCloudShadow: t => cloudCalls.push(t && t.width) };
    A.set('snow'); A.setHour(23); steps(60); out.gl = { calls: calls.filter(c => c[0] === 'sun').length, last: { ...A.gl } };
    const nightGl = { ...A.gl }; A.setHour(12); A.set('clear'); steps(20); out.glNoon = { ...A.gl };
    out.glNightLow = nightGl.elev < out.glNoon.elev && nightGl.near < out.glNoon.near;
    A.set('snow'); steps(20); out.glSnowFog = A.gl.fog; out.cloud3d = { calls: cloudCalls.slice(), in3d: A.cloud.in3d };
    delete R.render3d; A.cloud.in3d = false;
    // aurora beyond the Wall at night: three bands at the top; the moon is up
    A.setBiome('beyond'); A.set('clear'); A.setHour(23); steps(2); out.aurora = { k: A.auroraK, beyond: A.beyond, biome: A.biome };
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(0, 0, 100, 100); S.drawTint(x);
    { const d = x.getImageData(0, 0, 100, 100).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 12) lit++; out.auroraLit = lit; }
    A.setHour(12); steps(2); out.auroraDay = A.auroraK;
    // the Stormlands flag, Dorne's noon shimmer, the coast's spray
    A.setBiome('stormlands'); steps(1); out.storm = { flag: A.stormlands, biome: A.biome };
    A.setBiome('dorne'); A.setHour(9); A.set('heat'); steps(2); out.heat9 = { k: A.heatK, n: A.parts.filter(p => p.kind === 'shimmer').length };
    A.setHour(13); steps(6); out.heat13 = { k: A.heatK, n: A.parts.filter(p => p.kind === 'shimmer').length };
    A.setBiome('iron islands'); A.set('clear'); steps(10); out.coastSpray = { biome: A.biome, n: A.parts.filter(p => p.kind === 'spray').length };
    R.render3d = keep3d;   // the budget is measured on the real path: in 3D the wash goes to the renderer, glows shrink with distance
    // budget: drawTint on the real canvas — night, snow, aurora, moon, a bolt, clouds
    A.setBiome('beyond'); A.setHour(23); A.set('snow'); A.strike(); steps(2);
    const ctx = R.ctx; out.msAvg = 1e9; for (let b = 0; b < 4; b++) { const t0 = performance.now(); for (let i = 0; i < 50; i++) S.drawTint(ctx); out.msAvg = Math.min(out.msAvg, (performance.now() - t0) / 50); } out.partsNow = A.parts.length;
    // biome lock → weather roll works for a biome; fireflies at night in the south
    A.setBiome('reach'); A.set('auto'); A.setHour(23); steps(2); out.autoWeather = A.weather; out.biome = A.biome; steps(20);
    out.flies = A.parts.filter(p => p.kind === 'fly').length;
    A.setBiome('beyond'); steps(2); out.coldBiome = A.biome; out.coldTintA = A.tint.a; A.setHour(12); steps(2); out.coldNoonA = A.tint.a;
    A.setBiome(null); A.set('auto'); R.render3d = keep3d; R.world = keepW;
    out.biomeOf = [A.biomeOf({ biome: 'north' }), A.biomeOf({ id: 'riverlands' }), A.biomeOf({ name: 'Dorne' }), A.biomeOf('iron_islands'), A.biomeOf({ biome: 'crownlands' }), A.biomeOf(null), A.biomeOf({ id: 'the_north', biome: 'forest' })];
    return out;
  });
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  ok(r.order === 907 && r.hasDraw, 'system order 907 with draw + drawTint: ' + JSON.stringify([r.order, r.hasDraw]));
  ok(r.noonNight === false && r.noonA === 0 && r.noonPhase === 'day' && r.noonMul === 1, 'noon: no night, no tint ' + JSON.stringify([r.noonNight, r.noonA, r.noonPhase, r.noonMul]));
  ok(Math.abs(r.sunNoon.len - 1) < 1e-6 && r.sunNoon.y > .85 && Math.abs(r.sunNight.len - 1) < 1e-6 && r.sunNight.y < .2 && r.sunNight.y > 0, 'sunDir is a unit vector, high at noon, low at night ' + JSON.stringify([r.sunNoon, r.sunNight]));
  ok(r.moon.phase >= 0 && r.moon.phase < 1 && r.moon.lit >= 0 && r.moon.lit <= 1, 'moon phase by the day of the month ' + JSON.stringify(r.moon));
  ok(r.nightNight === true && r.nightA > .3 && r.nightA <= .45, 'night at 23: night + tint alpha > .3 ' + JSON.stringify([r.nightNight, r.nightA]));
  ok(r.nightTint.op === 'multiply' && r.nightTint.b > r.nightTint.r, 'night tint is a blue multiply ' + JSON.stringify(r.nightTint));
  ok(r.nightMul > 1.5, 'night spawn multiplier ' + r.nightMul);
  ok(Math.abs(r.flagClock - 23) < .001, 'clock stored in flags ' + r.flagClock);
  ok(Math.abs(r.dHour - .02) < 1e-6, '60 steps = 0.02 h (20 real minutes a day) ' + r.dHour);
  ok(r.wrapHour >= 0 && r.wrapHour < .02, 'clock wraps at 24 ' + r.wrapHour);
  ok(Math.abs(r.adopted - 3.5) < .001 && r.adoptedNight, 'external flags.clock adopted ' + JSON.stringify([r.adopted, r.adoptedNight]));
  ok(!r.dusk.night && r.dusk.a > .05 && r.dusk.r > r.dusk.b, 'dusk warm tint ' + JSON.stringify(r.dusk));
  ok(!r.dawn.night && r.dawn.a > .04 && r.dawn.r > r.dawn.b, 'dawn warm tint ' + JSON.stringify(r.dawn));
  ok(r.snowN >= 40 && r.snowN <= r.cap && r.snowKinds.join() === 'snow', 'set(snow) spawns flakes at once ' + JSON.stringify([r.snowN, r.snowKinds, r.cap, r.reduced]));
  ok(r.snowMoved >= r.snowN * .9, 'flakes move each step ' + r.snowMoved + '/' + r.snowN);
  ok(r.snowWeather === 'snow' && r.snowAuto === false, 'set() fixes the weather ' + JSON.stringify([r.snowWeather, r.snowAuto]));
  ok(r.afterRain.indexOf('snow') < 0 && r.rainN >= 40, 'snow faded, rain came ' + JSON.stringify([r.afterRain, r.rainN]));
  ok(r.clearN === 0, 'clear → no particles ' + r.clearN);
  ok(r.flash0 > .4 && r.flashMid > .2 && r.flashMid < r.flash0 && r.flashEnd === 0 && r.flashLeft === 0, 'flash decays to 0 ' + JSON.stringify([r.flash0, r.flashMid, r.flashEnd, r.flashLeft]));
  ok(r.bolt.n === 1 && r.bolt.pts >= 11 && r.bolt.br === 2 && r.bolt.flash > .2, 'strike(): one jagged bolt with branches + a flash ' + JSON.stringify(r.bolt));
  ok(r.boltGone === 0 && r.thunderEarly === 0 && r.thunder.join() === 'thunder', 'bolt gone in .2 s, thunder once 1–3 s later ' + JSON.stringify([r.boltGone, r.thunderEarly, r.thunder]));
  ok(r.rainStrikes >= 1 && r.rainStrikes <= 4, 'lightning in the rain, 25 s → ' + r.rainStrikes + ' strikes');
  ok(r.pxNight.every(v => v < 230) && r.pxNight[2] > r.pxNight[0], 'drawTint darkens white at night (blue) ' + JSON.stringify(r.pxNight));
  ok(r.pxNoon.join() === '255,255,255', 'drawTint leaves white at noon ' + JSON.stringify(r.pxNoon));
  ok(r.pxDraw.every(v => v < 230) && r.pxDrawSkipped, 'draw() tints when drawTint was not called, skips when it was ' + JSON.stringify([r.pxDraw, r.pxDrawSkipped]));
  ok(r.cloudMin < 250 && r.cloudMin > 180 && r.cloudOffMin === 255 && r.cloudTex === 256, 'cloud shadows by day (soft), none when off ' + JSON.stringify([r.cloudMin, r.cloudOffMin, r.cloudTex]));
  ok(r.gl.calls >= 3 && r.gl.calls <= 5, '3D driver called ≤ 4×/s ' + JSON.stringify(r.gl));
  ok(r.glNightLow, 'night: lower sun, nearer fog ' + JSON.stringify([r.gl.last, r.glNoon]));
  ok(/^#[0-9a-f]{6}$/.test(r.glSnowFog) && parseInt(r.glSnowFog.slice(1, 3), 16) > 200, 'snow → white fog ' + r.glSnowFog);
  ok(r.cloud3d.calls.join() === '256' && r.cloud3d.in3d === true, 'cloud texture handed to render3d once ' + JSON.stringify(r.cloud3d));
  ok(r.aurora.k > .9 && r.aurora.beyond && r.aurora.biome === 'cold' && r.auroraLit > 300 && r.auroraDay === 0, 'aurora beyond the Wall at night, not by day ' + JSON.stringify([r.aurora, r.auroraLit, r.auroraDay]));
  ok(r.storm.flag === true && r.storm.biome === 'sun', 'Stormlands flag ' + JSON.stringify(r.storm));
  ok(r.heat9.k < .3 && r.heat13.k > .95 && r.heat13.n > r.heat9.n && r.heat13.n >= 12, 'Dorne shimmers harder at noon ' + JSON.stringify([r.heat9, r.heat13]));
  ok(r.coastSpray.biome === 'coast' && r.coastSpray.n >= 10, 'the coast has spray in clear weather ' + JSON.stringify(r.coastSpray));
  const load = require('os').loadavg()[0], busy = load > require('os').cpus().length * 2;   // timing means nothing on an overloaded box: report it, do not fail
  if (busy) console.log('SKIP drawTint budget: load ' + load.toFixed(1) + ', measured ' + r.msAvg.toFixed(3) + ' ms'); else ok(r.msAvg < 1.5, 'drawTint under budget: ' + r.msAvg.toFixed(3) + ' ms avg with ' + r.partsNow + ' particles + aurora + moon + bolt');
  ok(r.biome === 'sun' && ['sun', 'clear'].indexOf(r.autoWeather) >= 0 && r.flies > 0, 'reach at night: auto weather + fireflies ' + JSON.stringify([r.biome, r.autoWeather, r.flies]));
  ok(r.coldBiome === 'cold' && r.coldTintA > r.nightA && r.coldNoonA > 0 && r.coldNoonA < .2, 'beyond the Wall: cold tint day and night ' + JSON.stringify([r.coldBiome, r.coldTintA, r.coldNoonA]));
  ok(r.biomeOf.join() === 'cold,wet,hot,coast,sun,none,cold', 'biomeOf ' + JSON.stringify(r.biomeOf));
  ok(errors.length === 0, 'page errors ' + JSON.stringify(errors));
  console.log(`ambience: night tint ${r.nightA.toFixed(3)}, snow ${r.snowN} flakes (cap ${r.cap}), drawTint ${r.msAvg.toFixed(3)} ms avg, 3D calls/s ${r.gl.calls}, rain strikes/25s ${r.rainStrikes}, aurora px ${r.auroraLit}, cloud min ${r.cloudMin}`);
  for (const f of fails) console.log('FAIL', f);
  console.log(fails.length ? `FAILS: ${fails.length}` : 'OK t_ambience');
  console.log('ERR', errors);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
