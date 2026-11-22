/* HOLDOR RPG — 62_ambience.js (A34): the day/night cycle, weather per biome, biome tint, light circles at night, fireflies,
   a full-screen flash.  Display only; nothing here changes combat — A06 reads R.ambience.night / spawnMul for night spawns.

   R.ambience = {
     hour (0–24, one day = 20 real minutes, kept in R.state.p.flags.clock), night (bool, 21–5), phase ('night'|'dawn'|'day'|'dusk'),
     nightK (0–1 darkness), spawnMul (1 by day → 1.6 at night), biome ('cold'|'wet'|'sun'|'hot'|'coast'|'none'), weather, auto,
     parts (screen-space particles, ≤ cap), flashes, flashA, tint {r,g,b,a,op}, lights (drawn last frame), lastMs, reduced, cap, on,
     setHour(h), set(weather | 'auto'), setBiome(b | null), flash(col, seconds, alpha0), biomeOf(region),
     sunDir {x east, y up, z south} unit vector + sun {az, el} (for the water shader), moon {phase 0–1 by the day of the month, lit},
     cloud {on, k, tex} (slow soft shadows scrolling in world space; handed to R.render3d.setCloudShadow when it exists),
     strike() (lightning: a 2-frame flash + a jagged bolt on the overlay, thunder via R.sfx.play('thunder') 1–3 s later; automatic in rain
     and in the Stormlands), bolts, auroraK (three waving bands at the top of the screen beyond the Wall at night), stormlands, beyond }
   System 'ambience' (order 907): update(dt) moves the clock, the weather and the particles; drawTint(ctx) paints
   tint → lights → particles → flash on the 2D overlay (the renderer calls it last); draw(ctx) paints the same when nobody called
   drawTint this frame.  3D (Addendum 2): when R.render3d exists, its setSun(elevation°, hex) / setFog(hex, near, far) are driven
   from the clock and the weather four times a second (night → low blue sun + nearer blue fog, snow → white fog, dawn/dusk → warm
   sun); the last values sit in R.ambience.gl.  The clock lives in the account's flags (R.state.acc.world.flags.clock, aliased as
   R.state.p.flags), so it continues across heroes and sessions. */
(function () {
  const DAY = 20 * 60, HPS = 24 / DAY, TAU = Math.PI * 2;
  const A = R.ambience = R.ambience || {};
  A.hour = 9; A.night = false; A.phase = 'day'; A.nightK = 0; A.dawnK = 0; A.duskK = 0; A.spawnMul = 1;
  A.biome = 'none'; A.weather = 'clear'; A.auto = true; A.on = true;
  A.parts = []; A.flashes = []; A.flashA = 0; A.lights = 0; A.lastMs = 0;
  A.tint = { r: 255, g: 255, b: 255, a: 0, op: 'multiply' };
  let reduced = false; try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { }
  A.reduced = reduced; A.cap = reduced ? 80 : 160;
  const rnd = Math.random, vw = () => R.vw || 390, vh = () => R.vh || 844;
  let T = 0, wind = 0, wxT = 0, bioT = 0, gustT = 2, glT = 0, bioLock = null, tinted = false;
  A.gl = { elev: 0, sun: '', fog: '', near: 0, far: 0, calls: 0 };
  A.sun = { az: 0, el: 0 }; A.sunDir = { x: 0, y: 1, z: 0 }; A.moon = { phase: 0, lit: 0 };
  A.cloud = { on: true, k: .5, tex: null, in3d: false }; A.bolts = []; A.auroraK = 0; A.heatK = 0; A.stormlands = false; A.beyond = false; A.region = '';
  let ltT = 6; const thunder = [];

  /* ---- biome from the region (A07's data; any naming works) ---- */
  const BIO = [[/beyond|winter|wall|north|snow|frost|ice|tundra/, 'cold'], [/dorne|desert|sand|dune/, 'hot'], [/river|vale|trident|neck|marsh|swamp/, 'wet'],
    [/iron|coast|sea|island|shore|bay|salt/, 'coast'], [/reach|crown|storm|west|king|plain|grass|forest|wood/, 'sun']];
  const regStr = reg => !reg ? '' : typeof reg === 'string' ? reg.toLowerCase() : [reg.biome, reg.id, reg.name].filter(x => x != null).join(' ').toLowerCase();
  A.biomeOf = reg => { const s = regStr(reg); if (!s) return 'none'; for (const [re, b] of BIO) if (re.test(s)) return b; return 'sun'; };
  const setRegion = reg => { const s = regStr(reg); A.region = s; A.stormlands = /storm/.test(s); A.beyond = /beyond|winter|frost|always|haunted/.test(s); return A.biomeOf(reg); };
  const KNOWN = ['clear', 'snow', 'rain', 'sun', 'heat', 'spray'];
  const WX = { cold: [['snow', .65], ['clear', 1]], wet: [['rain', .4], ['clear', 1]], sun: [['sun', .75], ['clear', 1]], hot: [['heat', .75], ['clear', 1]], coast: [['spray', .7], ['clear', 1]], none: [['clear', 1]] };
  const roll = () => { const r = rnd(); for (const [w, p] of WX[A.biome] || WX.none) if (r < p) return w; return 'clear'; };

  /* ---- clock ---- */
  const flags = () => { const S = R.state; if (!S) return null; const w = S.acc && S.acc.world; return (w && w.flags) || (S.p && S.p.flags) || null; };
  const smooth = k => (k = R.clamp(k, 0, 1), k * k * (3 - 2 * k));
  const bell = (h, c, w) => { let d = Math.abs(h - c); if (d > 12) d = 24 - d; return d >= w ? 0 : smooth(1 - d / w); };
  const clock = () => {
    const h = A.hour;
    A.night = h >= 21 || h < 5;
    A.nightK = h >= 22 || h < 4 ? 1 : h >= 20 && h < 22 ? smooth((h - 20) / 2) : h >= 4 && h < 6 ? smooth((6 - h) / 2) : 0;
    A.dawnK = bell(h, 6.2, 1.4); A.duskK = bell(h, 19.6, 1.6);
    A.phase = A.night ? 'night' : h < 7 ? 'dawn' : h >= 18.5 ? 'dusk' : 'day';
    A.spawnMul = 1 + .6 * A.nightK;
    A.heatK = A.biome === 'hot' ? bell(h, 13, 5) : 0;
    // the sun (the moon at night, opposite): azimuth from the east at 6h over the south to the west at 18h; x east, y up, z south
    const el = sunElev() * Math.PI / 180, az = Math.PI * (h - 6) / 12 + (A.nightK > .5 ? Math.PI : 0), c = Math.cos(el);
    A.sun.az = az; A.sun.el = el; A.sunDir.x = c * Math.cos(az); A.sunDir.y = Math.sin(el); A.sunDir.z = c * Math.sin(az);
    const f = A.moon.phase; A.moon.lit = (1 - Math.cos(TAU * f)) / 2;
  };
  const sunElev = () => { const h = A.hour, e = h >= 6 && h <= 18 ? 62 * Math.sin(Math.PI * (h - 6) / 12) : 0; return R.lerp(Math.max(10, e), 8, A.nightK); };
  try { A.moon.phase = ((new Date().getDate() - 1) % 30) / 29.53; } catch (e) { }
  A.setHour = h => { h = Number(h); if (!isFinite(h)) return; h %= 24; if (h < 0) h += 24; A.hour = h; const f = flags(); if (f) f.clock = h; clock(); tint(); };

  /* ---- the tint: multiply layers folded into one colour + alpha (one fillRect) ---- */
  const tint = () => {
    const L = [];
    if (A.nightK > 0) L.push([30, 60, 150, .45 * A.nightK]);
    if (A.duskK > 0) L.push([255, 150, 70, .16 * A.duskK * (1 - A.nightK)]);
    if (A.dawnK > 0) L.push([255, 190, 120, .14 * A.dawnK * (1 - A.nightK)]);
    const W = A.weather, day = 1 - A.nightK;
    if (A.biome === 'cold') L.push([190, 215, 255, W === 'snow' ? .16 : .11]);
    if (W === 'rain') L.push([120, 135, 160, .22]);
    if (A.biome === 'hot' && day > 0) L.push([255, 225, 185, .12 * day]);
    if (A.biome === 'coast') L.push([205, 225, 235, .06]);
    const m = [1, 1, 1];
    for (const [r, g, b, a] of L) { m[0] *= 1 - a * (1 - r / 255); m[1] *= 1 - a * (1 - g / 255); m[2] *= 1 - a * (1 - b / 255); }
    let a = 1 - Math.min(m[0], m[1], m[2]); if (a < .004) a = 0;
    const t = A.tint; t.a = a; t.op = 'multiply';
    t.r = a ? Math.round(255 * (1 - (1 - m[0]) / a)) : 255; t.g = a ? Math.round(255 * (1 - (1 - m[1]) / a)) : 255; t.b = a ? Math.round(255 * (1 - (1 - m[2]) / a)) : 255;
  };

  /* ---- particles (screen space) ---- */
  const K = {
    snow: { n: 110, mk: p => { p.x = rnd() * vw(); p.y = rnd() * vh(); p.s = 1.2 + rnd() * 2.2; p.vx = (rnd() - .5) * 14; p.vy = 32 + rnd() * 40 + p.s * 6; },
      mv: (p, dt) => { p.x += (p.vx + wind + Math.sin(T * 1.3 + p.ph) * 16) * dt; p.y += p.vy * dt; if (p.y > vh() + 6) { p.y = -6; p.x = rnd() * vw(); } if (p.x < -12) p.x = vw() + 10; else if (p.x > vw() + 12) p.x = -10; } },
    rain: { n: 120, mk: p => { p.x = rnd() * (vw() + 200) - 100; p.y = rnd() * vh(); p.gy = vh() * (.05 + rnd() * .95); p.vx = 110 + rnd() * 40; p.vy = 640 + rnd() * 220; p.s = 9 + rnd() * 9; },
      mv: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > p.gy) { if (rnd() < .3 && cnt.splash < 24 && A.parts.length < A.cap + 24) add('splash', q => { q.x = p.x; q.y = p.gy; }); p.y = -20; p.x = rnd() * (vw() + 200) - 150; p.gy = vh() * (.05 + rnd() * .95); } } },
    splash: { n: 0, mk: p => { p.ttl = .28; }, mv: (p, dt) => { p.t += dt; if (p.t > p.ttl) p.gone = true; } },
    shaft: { n: 3, day: 1, mk: p => { p.x = rnd() * vw(); p.s = 50 + rnd() * 80; p.sk = 120 + rnd() * 120; p.vx = 4 + rnd() * 5; },
      mv: (p, dt) => { p.x += p.vx * dt; if (p.x > vw() + 40) p.x = -p.s - p.sk - 40; } },
    pollen: { n: 36, day: 1, mk: p => { p.x = rnd() * vw(); p.y = rnd() * vh(); p.s = 1.2 + rnd() * 1.2; p.vx = (rnd() - .5) * 20; p.vy = (rnd() - .5) * 14; },
      mv: (p, dt) => { p.vx += (rnd() - .5) * 60 * dt; p.vy += (rnd() - .5) * 40 * dt; p.vx *= .995; p.vy *= .995; p.x += (p.vx + wind * .4) * dt + Math.sin(T * 2 + p.ph) * 12 * dt; p.y += p.vy * dt; wrap(p, 8); } },
    shimmer: { n: 7, day: 1, mk: p => { p.y = rnd() * vh(); p.s = 2 + rnd() * 2; p.vy = 18 + rnd() * 22; },
      mv: (p, dt) => { p.y -= p.vy * dt; if (p.y < -4) p.y = vh() + 4; } },
    gust: { n: 0, mk: p => { p.x = -20 - rnd() * 120; p.y = rnd() * vh(); p.vx = 300 + rnd() * 220; p.vy = (rnd() - .5) * 30; p.s = 6 + rnd() * 8; },
      mv: (p, dt) => { p.x += p.vx * dt; p.y += (p.vy + Math.sin(T * 6 + p.ph) * 20) * dt; if (p.x > vw() + 24) p.gone = true; } },
    spray: { n: 55, mk: p => { p.x = rnd() * vw(); p.y = rnd() * vh(); p.s = .9 + rnd() * .8; p.vx = (rnd() - .5) * 40; p.vy = -70 + rnd() * 50; p.ttl = .8 + rnd() * .7; p.t = rnd() * p.ttl; },
      mv: (p, dt) => { p.t += dt; p.vy += 160 * dt; p.x += (p.vx + wind * 2) * dt; p.y += p.vy * dt; if (p.t > p.ttl) { p.t = 0; p.x = rnd() * vw(); p.y = rnd() * vh(); p.vy = -70 + rnd() * 50; } } },
    gull: { n: 5, mk: p => { p.x = rnd() * vw(); p.y = rnd() * vh() * .6; const d = rnd() < .5 ? -1 : 1; p.vx = d * (25 + rnd() * 22); p.vy = (rnd() - .5) * 8; p.s = 3 + rnd() * 2; },
      mv: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; wrap(p, 24); } },
    fly: { n: 26, mk: p => { p.x = rnd() * vw(); p.y = rnd() * vh(); p.vx = (rnd() - .5) * 30; p.vy = (rnd() - .5) * 30; p.s = 1.4 + rnd() * .8; },
      mv: (p, dt) => { p.vx = R.clamp(p.vx + (rnd() - .5) * 70 * dt, -32, 32); p.vy = R.clamp(p.vy + (rnd() - .5) * 70 * dt, -32, 32); p.x += p.vx * dt; p.y += p.vy * dt; wrap(p, 10); } }
  };
  const wrap = (p, m) => { const w = vw(), h = vh(); if (p.x < -m) p.x = w + m; else if (p.x > w + m) p.x = -m; if (p.y < -m) p.y = h + m; else if (p.y > h + m) p.y = -m; };
  const cnt = {};
  const add = (kind, init) => { const p = { kind, x: 0, y: 0, vx: 0, vy: 0, s: 2, t: 0, k: 1, ph: rnd() * TAU }; K[kind].mk(p); if (init) init(p); A.parts.push(p); cnt[kind] = (cnt[kind] || 0) + 1; return p; };
  const recount = () => { for (const k in K) cnt[k] = 0; for (const p of A.parts) cnt[p.kind] = (cnt[p.kind] || 0) + 1; };
  /* which kinds are wanted now, and how many */
  const wanted = () => {
    const W = A.weather, day = 1 - A.nightK, out = {};
    const put = (k, n) => { if (n > 0) out[k] = n; };
    if (W === 'snow') put('snow', K.snow.n);
    if (W === 'rain') put('rain', K.rain.n);
    if (W === 'sun' && day > .3) { put('shaft', K.shaft.n); put('pollen', K.pollen.n * day); }
    if (W === 'heat' && day > .3) put('shimmer', K.shimmer.n * (1 + A.heatK));           // Dorne shimmers twice as hard at noon
    if (W === 'spray') { put('spray', K.spray.n); put('gull', day > .3 ? K.gull.n : 2); }
    else if (A.biome === 'coast' && W === 'clear') put('spray', 25);                         // the coast always has some sea spray
    if (A.night && A.biome !== 'cold' && A.biome !== 'none' && W !== 'rain' && W !== 'snow') put('fly', K.fly.n);
    const area = R.clamp(vw() * vh() / (390 * 844), .5, 2) * (reduced ? .5 : 1);
    let sum = 0; for (const k in out) { out[k] = Math.round(out[k] * area); sum += out[k]; }
    if (sum > A.cap) for (const k in out) out[k] = Math.floor(out[k] * A.cap / sum);
    return out;
  };
  const settle = fill => {                      // spawn toward the wanted counts, fade what is no longer wanted
    const want = wanted(); recount();
    for (const p of A.parts) if (!p.fade && !(p.kind in want) && p.kind !== 'splash' && !(p.kind === 'gust' && A.weather === 'heat')) p.fade = true;
    for (const k in want) { let miss = want[k] - (cnt[k] || 0), n = fill ? miss : Math.min(miss, 6); while (n-- > 0 && A.parts.length < A.cap) add(k); }
  };
  A.set = w => {
    if (w == null || w === 'auto') { A.auto = true; wxT = 0; return; }
    w = String(w); if (KNOWN.indexOf(w) < 0) { console.warn('ambience: unknown weather', w); w = 'clear'; }
    A.auto = false; if (w !== A.weather) { A.weather = w; for (const p of A.parts) p.fade = true; }
    settle(true); tint();
  };
  A.setBiome = b => { bioLock = b || null; if (b) A.biome = setRegion(b); bioT = 0; wxT = 0; clock(); tint(); };
  /* ---- lightning ---- */
  A.strike = () => {
    const w = vw(), h = vh(), main = [], x0 = w * (.15 + rnd() * .7), yEnd = h * (.35 + rnd() * .4), n = 10 + Math.floor(rnd() * 5); let x = x0, y = 0;
    for (let i = 0; i <= n; i++) { main.push([x, y]); x += (rnd() - .5) * 46; y += yEnd / n * (.7 + rnd() * .6); }
    const br = []; for (let b = 0; b < 2; b++) { const i = 2 + Math.floor(rnd() * (n - 4)), seg = [main[i]]; let bx = main[i][0], by = main[i][1], d = rnd() < .5 ? -1 : 1; for (let j = 0; j < 4; j++) { bx += d * (10 + rnd() * 18); by += 12 + rnd() * 16; seg.push([bx, by]); } br.push(seg); }
    const bolt = { main, br, t: 0, ttl: .2 }; A.bolts.push(bolt); if (A.bolts.length > 3) A.bolts.shift();
    A.flash('#dfe8ff', 2 / 60, reduced ? .3 : .55);                                       // two frames of white-blue
    thunder.push(T + 1 + rnd() * 2);                                                       // 1–3 s later
    return bolt;
  };
  A.flash = (col, s, a0) => { if (a0 == null) a0 = reduced ? .45 : .85; const f = { col: col || '#fff', s: Math.max(.05, +s || .4), a0, a: a0, t: 0 }; A.flashes.push(f); if (A.flashes.length > 4) A.flashes.shift(); A.flashA = Math.max(A.flashA, a0); return f; };

  /* ---- 3D sun + fog (A05's renderer), at most 4×/s ---- */
  const hex = c => '#' + c.map(v => (R.clamp(Math.round(v), 0, 255) | 256).toString(16).slice(1)).join('');
  const mix = (a, b, k) => [R.lerp(a[0], b[0], k), R.lerp(a[1], b[1], k), R.lerp(a[2], b[2], k)];
  const FOG = { clear: [[159, 176, 200], 900, 2600], sun: [[172, 186, 205], 950, 2700], rain: [[111, 124, 142], 450, 1500], snow: [[230, 237, 247], 350, 1300], heat: [[232, 216, 184], 800, 2400], spray: [[201, 216, 226], 700, 2200] };
  const SUN = { clear: [255, 242, 220], sun: [255, 244, 222], rain: [185, 194, 207], snow: [223, 232, 255], heat: [255, 236, 200], spray: [238, 242, 246] };
  const drive3d = () => {
    const G = R.render3d; if (!G || typeof G.setSun !== 'function') return;
    const h = A.hour, k = A.nightK, warm = Math.max(A.dawnK, A.duskK) * (1 - k);
    const elev = sunElev();                                                              // the sun's arc, 62° at noon; a low moon-like light at night
    let sun = SUN[A.weather] || SUN.clear; sun = mix(sun, [255, 176, 112], warm); sun = mix(sun, [90, 111, 181], k);
    const f = FOG[A.weather] || FOG.clear, col = mix(mix(f[0], [236, 200, 160], warm * .5), [20, 30, 58], k);
    const near = R.lerp(f[1], Math.min(f[1], 500), k), far = R.lerp(f[2], Math.min(f[2], 1700), k);
    const g = A.gl; g.elev = Math.round(elev * 10) / 10; g.sun = hex(sun); g.fog = hex(col); g.near = Math.round(near); g.far = Math.round(far); g.calls++;
    try { G.setSun(g.elev, g.sun); if (typeof G.setFog === 'function') G.setFog(g.fog, g.near, g.far); if (typeof G.setCloudShadow === 'function' && !A.cloud.in3d) { G.setCloudShadow(cloudTex()); A.cloud.in3d = true; } } catch (e) { console.warn('ambience: render3d', e); }
  };

  /* ---- update ---- */
  const update = dt => {
    T += dt; tinted = false;                     // a new frame: draw() paints the tint unless the renderer calls drawTint first
    const f = flags(); if (f && typeof f.clock === 'number' && isFinite(f.clock)) A.hour = f.clock;
    A.hour = (A.hour + dt * HPS) % 24; if (A.hour < 0) A.hour += 24; if (f) f.clock = A.hour;
    clock();
    wind = 22 * Math.sin(T / 9) + 10 * Math.sin(T / 3.1);
    // biome: twice a second from the player's (or the camera's) region
    bioT -= dt;
    if (bioT <= 0) { bioT = .5; let b = A.biome; if (bioLock) b = setRegion(bioLock); else if (R.world && R.world.regionAt) { const e = R.player || R.cam; try { b = setRegion(R.world.regionAt(e.x, e.y)); } catch (x) { } } if (b !== A.biome) { A.biome = b; wxT = 0; } }
    // weather: a roll every 90–180 s, or when the biome changes
    if (A.auto) { wxT -= dt; if (wxT <= 0) { wxT = 90 + rnd() * 90; const w = roll(); if (w !== A.weather) { A.weather = w; for (const p of A.parts) p.fade = true; } } }
    if (A.weather === 'heat' && A.nightK < .7) { gustT -= dt; if (gustT <= 0) { gustT = 3 + rnd() * 4; let n = Math.round((reduced ? 10 : 22)); while (n-- > 0 && A.parts.length < A.cap) add('gust'); } }
    settle(false);
    // move; drop the faded and the finished
    const P = A.parts; let j = 0;
    for (let i = 0; i < P.length; i++) { const p = P[i]; K[p.kind].mv(p, dt); if (p.fade) { p.k -= dt * 2.2; if (p.k <= 0) p.gone = true; } if (!p.gone) P[j++] = p; }
    P.length = j; recount();
    // flashes
    let fa = 0; const F = A.flashes; j = 0;
    for (let i = 0; i < F.length; i++) { const x = F[i]; x.t += dt; x.a = x.a0 * Math.max(0, 1 - x.t / x.s); if (x.a > 0) { F[j++] = x; if (x.a > fa) fa = x.a; } }
    F.length = j; A.flashA = fa;
    // lightning: in rain every 8–25 s, in the Stormlands every 15–40 s; thunder follows
    if (A.weather === 'rain' || A.stormlands) { ltT -= dt; if (ltT <= 0) { ltT = A.weather === 'rain' ? 8 + rnd() * 17 : 15 + rnd() * 25; A.strike(); } } else if (ltT < 2) ltT = 2 + rnd() * 4;
    for (const b of A.bolts) b.t += dt; A.bolts = A.bolts.filter(b => b.t < b.ttl);
    for (let i = thunder.length - 1; i >= 0; i--) if (T >= thunder[i]) { thunder.splice(i, 1); try { if (R.sfx && typeof R.sfx.play === 'function') R.sfx.play('thunder', .9); } catch (e) { } }
    A.auroraK = A.beyond && A.biome === 'cold' ? A.nightK * (A.weather === 'snow' ? .6 : 1) : 0;
    A.cloud.k = { clear: .5, sun: .6, rain: 1, snow: .9, heat: .22, spray: .7 }[A.weather] || .5;
    tint();
    glT -= dt; if (glT <= 0) { glT = .25; drive3d(); }
  };

  /* ---- draw ---- */
  let lightSpr = null;
  const light = () => { if (lightSpr) return lightSpr; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,200,120,.62)'); g.addColorStop(.45, 'rgba(255,160,80,.22)'); g.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return lightSpr = c; };
  const poiXY = p => p.x != null ? [p.x, p.y] : p.pos ? (p.pos.x != null ? [p.pos.x, p.pos.y] : [p.pos[0], p.pos[1]]) : null;
  const drawLights = ctx => {
    const k = A.nightK; if (k < .05) { A.lights = 0; return; }
    const spr = light(), w = vw(), h = vh(), z = R.cam.z || 1; let n = 0;
    ctx.globalCompositeOperation = 'lighter';
    const one = (sx, sy, r, i, a) => { if (sx < -r || sy < -r || sx > w + r || sy > h + r || n >= 14) return; const f = r * (1 + .045 * Math.sin(T * 11 + i * 1.7)); ctx.globalAlpha = a * k; ctx.drawImage(spr, sx - f, sy - f, f * 2, f * 2); n++; };
    if (R.player && !R.player.dead) { const s = R.w2s(R.player.x, R.player.y); one(s.x, s.y, 150 * z, 0, .9); }
    const pois = R.data.world && R.data.world.pois; let i = 1;
    if (pois && pois.length) for (const p of pois) { const xy = poiXY(p); if (!xy) continue; const s = R.w2s(xy[0], xy[1]); one(s.x, s.y, 110 * z, i++, .8); if (n >= 14) break; }
    if (n < 14) for (const e of R.ents) if (e.kind === 'portal' && !e.dead) { const s = R.w2s(e.x, e.y); one(s.x, s.y, 80 * z, i++, .7); }
    A.lights = n; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  const drawParts = ctx => {
    const P = A.parts; if (!P.length) return;
    const w = vw(), h = vh();
    for (const kind in K) {
      if (!cnt[kind]) continue;
      ctx.globalAlpha = 1;
      if (kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.beginPath(); for (const p of P) if (p.kind === kind) { ctx.moveTo(p.x + p.s, p.y); ctx.arc(p.x, p.y, p.s * p.k, 0, TAU); } ctx.fill(); }
      else if (kind === 'rain') { ctx.strokeStyle = 'rgba(200,215,235,.42)'; ctx.lineWidth = 1; ctx.beginPath(); for (const p of P) if (p.kind === kind) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .016 * p.k, p.y - p.s * p.k); } ctx.stroke(); }
      else if (kind === 'splash') { ctx.strokeStyle = 'rgba(210,225,240,.38)'; ctx.lineWidth = 1; ctx.beginPath(); for (const p of P) if (p.kind === kind) { const r = 1.5 + 7 * p.t / p.ttl; ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, TAU); } ctx.stroke(); }
      else if (kind === 'shaft') { ctx.fillStyle = 'rgb(255,242,205)'; for (const p of P) if (p.kind === kind) { ctx.globalAlpha = (.045 + .03 * Math.sin(T * .7 + p.ph)) * p.k; ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x + p.s, 0); ctx.lineTo(p.x + p.s + p.sk, h); ctx.lineTo(p.x + p.sk, h); ctx.closePath(); ctx.fill(); } }
      else if (kind === 'pollen') { ctx.fillStyle = 'rgba(246,226,150,.62)'; ctx.beginPath(); for (const p of P) if (p.kind === kind) { ctx.moveTo(p.x + p.s, p.y); ctx.arc(p.x, p.y, p.s * p.k, 0, TAU); } ctx.fill(); }
      else if (kind === 'shimmer') { ctx.fillStyle = 'rgb(255,240,210)'; const a = .055 * (1 + .7 * A.heatK); for (const p of P) if (p.kind === kind) { ctx.globalAlpha = a * p.k; ctx.fillRect(-20 + Math.sin(T * 3 + p.ph) * 10, p.y, w + 40, p.s); } }
      else if (kind === 'gust') { ctx.strokeStyle = 'rgba(214,184,120,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (const p of P) if (p.kind === kind) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.s * p.k, p.y - p.vy * .02); } ctx.stroke(); }
      else if (kind === 'spray') { ctx.fillStyle = 'rgba(210,232,246,.5)'; ctx.beginPath(); for (const p of P) if (p.kind === kind) { const a = 1 - p.t / p.ttl; if (a <= 0) continue; const r = p.s * a * p.k; ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, TAU); } ctx.fill(); }
      else if (kind === 'gull') { ctx.strokeStyle = 'rgba(40,46,58,.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); for (const p of P) if (p.kind === kind) { const f = p.s * .7 * Math.sin(T * 9 + p.ph); ctx.moveTo(p.x - p.s, p.y + f); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x + p.s, p.y + f); } ctx.stroke(); }
      else if (kind === 'fly') { ctx.fillStyle = 'rgb(190,255,120)'; for (const p of P) if (p.kind === kind) { const pu = .25 + .75 * Math.abs(Math.sin(T * 1.7 + p.ph)); ctx.globalAlpha = .13 * pu * p.k; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 3.2, 0, TAU); ctx.fill(); ctx.globalAlpha = .95 * pu * p.k; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); } }
    }
    ctx.globalAlpha = 1;
  };
  /* clouds: a 256-px seamless tile of soft dark blobs, scrolled in world space and drawn as ≤ 16 tiles of 512 world units */
  const cloudTex = () => { if (A.cloud.tex) return A.cloud.tex; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let sd = 777; const rr = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 22; i++) { const bx = rr() * 256, by = rr() * 256, r = 34 + rr() * 60; for (let ox = -256; ox <= 256; ox += 256) for (let oy = -256; oy <= 256; oy += 256) { const g = x.createRadialGradient(bx + ox, by + oy, 2, bx + ox, by + oy, r); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(.55, 'rgba(0,0,0,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(bx + ox - r, by + oy - r, r * 2, r * 2); } }
    return A.cloud.tex = c; };
  const drawClouds = ctx => {
    const a = .17 * A.cloud.k * (1 - A.nightK * .8); if (!A.cloud.on || A.cloud.in3d || a < .01) return;
    const tex = cloudTex(), z = R.cam.z || 1, S = 512 * z, w = vw(), h = vh(); if (S < 64) return;
    const o = R.w2s(T * 14, T * 9); const ox = ((o.x % S) + S) % S - S, oy = ((o.y % S) + S) % S - S; if (!isFinite(ox) || !isFinite(oy)) return;
    ctx.globalAlpha = a; let n = 0;
    for (let x = ox; x < w && n < 16; x += S) for (let y = oy; y < h && n < 16; y += S, n++) ctx.drawImage(tex, x, y, S, S);
    ctx.globalAlpha = 1;
  };
  const AUR = ['rgb(90,255,160)', 'rgb(170,110,255)', 'rgb(80,220,200)'];
  const drawAurora = ctx => {
    const k = A.auroraK; if (k < .03) return; const w = vw(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const y0 = 40 + i * 34, th = 26 + i * 7, top = [], bot = []; for (let x = -10; x <= w + 10; x += Math.max(24, w / 14)) { const y = y0 + 18 * Math.sin(x / 90 + T * .6 + i * 1.3) + 8 * Math.sin(x / 37 - T * .9 + i); top.push([x, y]); bot.push([x, y + th * (.7 + .3 * Math.sin(x / 60 + T * .4 + i))]); }
      ctx.globalAlpha = k * (.07 + .03 * Math.sin(T * .8 + i * 2)); ctx.fillStyle = AUR[i]; ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]); for (const p of top) ctx.lineTo(p[0], p[1]); for (let j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j][0], bot[j][1]); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  const drawMoon = ctx => {
    const k = A.nightK; if (k < .05) return; const w = vw(), h = vh(), arc = ((A.hour - 21 + 24) % 24) / 8; if (arc > 1.05) return;     // up from 21 to 5
    const x = w * (.12 + .76 * arc), y = h * .13 - h * .06 * Math.sin(Math.PI * arc), r = 13, f = A.moon.phase, dim = A.weather === 'rain' ? .3 : A.weather === 'snow' ? .6 : 1;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .08 * k * dim; ctx.fillStyle = 'rgb(220,228,255)'; ctx.beginPath(); ctx.arc(x, y, r * 2.3, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .9 * k * dim; ctx.fillStyle = 'rgb(236,240,250)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    const dx = (f < .5 ? -1 : 1) * 2.1 * r * Math.sin(Math.PI * f);                        // the shadow disc: full cover at new moon, gone at full
    if (Math.abs(dx) < 2.05 * r) { ctx.fillStyle = 'rgb(22,32,60)'; ctx.globalAlpha = .92 * k * dim; ctx.beginPath(); ctx.arc(x + dx, y, r * 1.02, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  };
  const drawBolts = ctx => {
    if (!A.bolts.length) return; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const b of A.bolts) { const a = Math.max(0, 1 - b.t / b.ttl); const path = () => { ctx.beginPath(); ctx.moveTo(b.main[0][0], b.main[0][1]); for (const p of b.main) ctx.lineTo(p[0], p[1]); for (const s of b.br) { ctx.moveTo(s[0][0], s[0][1]); for (const p of s) ctx.lineTo(p[0], p[1]); } };
      ctx.globalAlpha = .3 * a; ctx.strokeStyle = 'rgb(170,190,255)'; ctx.lineWidth = 6; path(); ctx.stroke(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; path(); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
  const drawTint = ctx => {
    const t0 = performance.now();
    ctx.save();
    const W = Math.max(vw(), ctx.canvas.width), H = Math.max(vh(), ctx.canvas.height);
    if (A.on) {
      const t = A.tint;
      drawClouds(ctx);
      if (t.a > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = t.a; ctx.fillStyle = 'rgb(' + t.r + ',' + t.g + ',' + t.b + ')'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      drawAurora(ctx); drawMoon(ctx);
      drawLights(ctx);
      drawParts(ctx);
      drawBolts(ctx);
    }
    if (A.flashes.length) { ctx.globalCompositeOperation = 'source-over'; for (const f of A.flashes) { ctx.globalAlpha = f.a; ctx.fillStyle = f.col; ctx.fillRect(0, 0, W, H); } ctx.globalAlpha = 1; }
    ctx.restore();
    tinted = true; A.lastMs = performance.now() - t0;
  };
  R.addSys('ambience', { order: 907, update, drawTint, draw: ctx => { if (tinted) { tinted = false; return; } drawTint(ctx); tinted = false; } }); // draw: only when nobody called drawTint this frame
  clock(); tint();
})();
