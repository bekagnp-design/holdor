/* HOLDOR RPG core — the one global R (A01). Every other module is an IIFE that only touches R.
   Keeps every name of the integrator's stub; adds: fixed-step loop with catch-up, pause by screen or by hand, entity garbage,
   camera follow + clamp, the v2 save (account + one mortal hero) with p.* aliases, R.ui shell, hero creation, respawn, errors.
   #c (2D) is a transparent overlay above #gl (the 3D world, A05): the core never fills it opaquely. */
window.R = window.R || {};
(function () {
  R.VERSION = '2.0.0';
  // R.WS (2026-11-22, the owner: "make the map much bigger"): the world's geography is 4.5× the art-px × 6 grid in each direction
  // (≈ 20× the area). 11_world_data scales every coordinate of R.data.world by R.WS; distances about the hero (aggro, safe radius,
  // spawn rings, camera, interaction, presence) stay in hero units. Saves carry `ws`; R.load rescales an older p.pos.
  R.WS = 4.5; R.W = 7200 * R.WS; R.H = 12288 * R.WS; R.SCALE = 6 * R.WS;
  R.data = R.data || {}; R.screens = R.screens || {}; R.ents = []; R.t = 0; R.dt = 1 / 60; R.tick = 0; R.running = false; R.paused = false;
  R.cam = { x: R.W / 2, y: R.H / 2, z: 1, yaw: 0, target: null, k: 8 };
  R.errors = [];
  R.player = null;

  /* ---- errors: every uncaught one lands in R.errors and the #err overlay (installed first, so later modules are covered) ---- */
  // the #err overlay is for developers only (?debug=1 or R.debug): it never takes a tap, a tap dismisses it, it hides after 4 s; R.errors always fills (tests read it)
  R.debug = /[?&#]debug=1\b/.test(location.search + location.hash);
  let errT = 0;
  R.err = (msg, src) => { const s = (src ? src + ': ' : '') + msg; R.errors.push(s); if (R.errors.length > 60) R.errors.shift();
    const el = document.getElementById('err'); if (el && R.debug) { el.style.display = 'block'; el.style.pointerEvents = 'none'; el.textContent = R.errors.slice(-4).join('\n');
      clearTimeout(errT); errT = setTimeout(() => { el.style.display = 'none'; }, 4000); } return s; };
  document.addEventListener('pointerdown', () => { const el = document.getElementById('err'); if (el && el.style.display === 'block') el.style.display = 'none'; }, true);
  window.addEventListener('error', ev => R.err(ev.message || (ev.error && ev.error.message) || String(ev.error), 'error'));
  window.addEventListener('unhandledrejection', ev => R.err((ev.reason && (ev.reason.message || ev.reason)) + '', 'promise'));

  /* ---- bus ---- */
  const L = {};
  R.bus = { on: (e, f) => ((L[e] = L[e] || []).push(f), f), off: (e, f) => { L[e] = (L[e] || []).filter(x => x !== f); },
    once: (e, f) => { const g = (...a) => { R.bus.off(e, g); f(...a); }; return R.bus.on(e, g); },
    emit: (e, ...a) => { for (const f of (L[e] || []).slice()) { try { f(...a); } catch (x) { console.error(e, x); R.err((x && x.message) || x, 'bus:' + e); } } } };

  /* ---- systems: R.sys[name] = {order, update(dt), draw(ctx)}; sysList is re-sorted on every assignment (Proxy) or R.addSys ---- */
  R.sysList = [];
  const sysStore = {};
  const resort = () => { R.sysList = Object.keys(sysStore).map(k => sysStore[k]).filter(s => s && typeof s === 'object').sort((a, b) => (a.order || 0) - (b.order || 0)); };
  R.sys = new Proxy(sysStore, {
    set(t, k, v) { if (v && typeof v === 'object' && !v.name) v.name = k; t[k] = v; resort(); return true; },
    deleteProperty(t, k) { delete t[k]; resort(); return true; } });
  R.addSys = (name, s) => { s.name = name; R.sys[name] = s; return s; };

  /* ---- entities ---- */
  let nid = 1;
  R.spawn = e => { e.id = nid++; e.x = e.x || 0; e.y = e.y || 0; e.r = e.r || 14; e.face = e.face || 1; e.vx = e.vx || 0; e.vy = e.vy || 0;
    e.team = e.team == null ? 1 : e.team; e.lvl = e.lvl || 1; e.hpMax = e.hpMax || e.hp || 1; e.hp = e.hp == null ? e.hpMax : e.hp;
    e.cd = e.cd || {}; e.status = e.status || {}; e.anim = e.anim || 'idle'; e.animT = 0; e.dead = !!e.dead; e.ai = e.ai || {};
    R.ents.push(e); R.bus.emit('spawn', e); return e; };
  // kill(e, by?): marks dead, starts the die animation; 'kill'(mob, byEnt) for mobs and bosses, 'death'(player) for the player.
  // The body is removed R.GC (1.2) s later by the step unless e.keep (the player keeps).
  R.kill = (e, by) => { if (!e || e.dead) return;
    if (e.kind === 'player' && typeof e.die === 'function' && !e.deathT) { if (by && by !== e) e.lastHitBy = by; return e.die(by); }   // 21_player's permadeath path (one Hall line, one 'death')
    e.dead = true; e.diedAt = R.t; e.anim = 'die'; e.animT = 0; e.vx = e.vy = 0; if (by) e.lastHitBy = by;
    if (e.kind === 'mob' || e.kind === 'boss') R.bus.emit('kill', e, e.lastHitBy); else if (e.kind === 'player') R.bus.emit('death', e); };
  R.remove = e => { const i = R.ents.indexOf(e); if (i >= 0) { R.ents.splice(i, 1); R.bus.emit('remove', e); } };
  R.clearEnts = () => { const old = R.ents.slice(); R.ents.length = 0; for (const e of old) R.bus.emit('remove', e); R.player = null; };
  R.find = fn => R.ents.find(fn);
  R.near = (x, y, r, f) => R.ents.filter(e => !e.dead && (!f || f(e)) && (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r);
  R.nearest = (x, y, r, f) => { let best = null, bd = r * r; for (const e of R.ents) { if (e.dead || (f && !f(e))) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d <= bd) { bd = d; best = e; } } return best; };
  R.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  R.GC = 1.2;
  const gc = () => { for (let i = R.ents.length - 1; i >= 0; i--) { const e = R.ents[i]; if (!e.dead || e.keep) continue; if (e.diedAt == null) e.diedAt = R.t; if (R.t - e.diedAt >= R.GC) { R.ents.splice(i, 1); R.bus.emit('remove', e); } } };

  /* ---- camera: world point at the screen centre; follows R.cam.target (default the player) with smoothing, clamped to the world.
          The 3D renderer (A05) overrides R.w2s(x, y, z) with its projection; these are the 2D defaults. ---- */
  R.w2s = (x, y) => ({ x: (x - R.cam.x) * R.cam.z + R.vw / 2, y: (y - R.cam.y) * R.cam.z + R.vh / 2 });
  R.s2w = (x, y) => ({ x: (x - R.vw / 2) / R.cam.z + R.cam.x, y: (y - R.vh / 2) / R.cam.z + R.cam.y });
  R.camClamp = () => { const c = R.cam, hw = R.vw / (2 * c.z), hh = R.vh / (2 * c.z);
    c.x = R.W <= 2 * hw ? R.W / 2 : R.clamp(c.x, hw, R.W - hw); c.y = R.H <= 2 * hh ? R.H / 2 : R.clamp(c.y, hh, R.H - hh); return c; };
  R.camFollow = e => { R.cam.target = e || null; return R.cam; };
  R.camSnap = (x, y) => { const c = R.cam, t = c.target || R.player; if (x != null) { c.x = x; c.y = y; } else if (t) { c.x = t.x; c.y = t.y; } return R.camClamp(); };
  R.camUpdate = dt => { const c = R.cam, t = c.target || R.player; if (t) { const k = 1 - Math.exp(-dt * (c.k || 8)); c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; if (Math.abs(t.x - c.x) < 0.05) c.x = t.x; if (Math.abs(t.y - c.y) < 0.05) c.y = t.y; } return R.camClamp(); };

  /* ---- random ---- */
  let seed = 1234567;
  R.rng = s => { if (s != null) seed = (s >>> 0) || 1; seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  R.rnd = (a, b) => a + (b - a) * R.rng();                       // uniform in [a, b)
  R.irnd = (a, b) => Math.floor(R.rnd(a, b + 1));                // integer in [a, b]
  R.pick = arr => arr[Math.floor(R.rng() * arr.length)];
  R.clamp = (v, a, b) => v < a ? a : v > b ? b : v; R.lerp = (a, b, k) => a + (b - a) * k;

  /* ---- houses + champions: fallbacks from the old game, used until A04's A_CHAMP.list / A07's data / A10's R.champs land ---- */
  R.data.houses = R.data.houses || {
    stark: { n: 'Stark', e: '🐺', words: 'Winter is coming', col: '#a9bdd0', col2: '#3b4a5a', seat: 'Winterfell' },
    lannister: { n: 'Lannister', e: '🦁', words: 'Hear me roar', col: '#e3b661', col2: '#7a1d1d', seat: 'Casterly Rock' },
    baratheon: { n: 'Baratheon', e: '🦌', words: 'Ours is the fury', col: '#f0c419', col2: '#2b2b2b', seat: 'Storm\'s End' },
    targaryen: { n: 'Targaryen', e: '🐉', words: 'Fire and blood', col: '#e14b4b', col2: '#1c1c1c', seat: 'Dragonstone' },
    greyjoy: { n: 'Greyjoy', e: '🦑', words: 'We do not sow', col: '#d8b74a', col2: '#1f2a30', seat: 'Pyke' },
    tyrell: { n: 'Tyrell', e: '🌹', words: 'Growing strong', col: '#7fd06a', col2: '#2f5a2a', seat: 'Highgarden' },
    martell: { n: 'Martell', e: '☀️', words: 'Unbowed, unbent, unbroken', col: '#f08a3c', col2: '#7a2a1a', seat: 'Sunspear' } };
  const CH0 = ('jon,stark,Jon Snow,melee;arya,stark,Arya Stark,melee;sansa,stark,Sansa Stark,caster;bran,stark,Bran Stark,caster;robb,stark,Robb Stark,melee;ned,stark,Eddard Stark,melee;brienne,stark,Brienne of Tarth,melee;' +
    'jaime,lannister,Jaime Lannister,melee;tyrion,lannister,Tyrion Lannister,caster;cersei,lannister,Cersei Lannister,caster;tywin,lannister,Tywin Lannister,caster;bronn,lannister,Bronn,ranged;gregor,lannister,The Mountain,melee;kevan,lannister,Kevan Lannister,melee;' +
    'stannis,baratheon,Stannis Baratheon,melee;robert,baratheon,Robert Baratheon,melee;renly,baratheon,Renly Baratheon,caster;davos,baratheon,Davos Seaworth,ranged;melisandre,baratheon,Melisandre,caster;gendry,baratheon,Gendry,melee;barristan,baratheon,Barristan Selmy,melee;' +
    'dany,targaryen,Daenerys,caster;jorah,targaryen,Jorah Mormont,melee;greyworm,targaryen,Grey Worm,melee;missandei,targaryen,Missandei,caster;daario,targaryen,Daario Naharis,melee;drogo,targaryen,Khal Drogo,melee;viserys,targaryen,Viserys,caster;' +
    'theon,greyjoy,Theon Greyjoy,ranged;yara,greyjoy,Yara Greyjoy,melee;euron,greyjoy,Euron Greyjoy,caster;balon,greyjoy,Balon Greyjoy,caster;victarion,greyjoy,Victarion Greyjoy,melee;aeron,greyjoy,Aeron Damphair,caster;rodrik,greyjoy,Rodrik the Reader,caster;' +
    'margaery,tyrell,Margaery Tyrell,caster;olenna,tyrell,Olenna Tyrell,caster;loras,tyrell,Loras Tyrell,melee;randyll,tyrell,Randyll Tarly,melee;sam,tyrell,Samwell Tarly,ranged;garlan,tyrell,Garlan Tyrell,melee;mace,tyrell,Mace Tyrell,caster;' +
    'oberyn,martell,Oberyn Martell,melee;ellaria,martell,Ellaria Sand,caster;doran,martell,Doran Martell,caster;areo,martell,Areo Hotah,melee;obara,martell,Obara Sand,ranged;nymeria,martell,Nymeria Sand,ranged;tyene,martell,Tyene Sand,ranged')
    .split(';').map(r => { const [id, house, name, type] = r.split(','); return { id, house, name, type }; });
  R.CLS_OF = { melee: 'knight', ranged: 'ranger', caster: 'maester', mage: 'maester' };
  // the champion rows in order: A_CHAMP.list (rows [id, house, name, emoji, type] or {id, house, name|n, type}, or an object by id), else R.data.champs, else the old roster
  const champRows = () => { const A = window.A_CHAMP, src = (A && (A.list || A.LIST)) || R.data.champs; if (!src) return CH0;
    const rows = Array.isArray(src) ? src : Object.keys(src).map(k => Object.assign({ id: k }, src[k]));
    const out = rows.map(r => Array.isArray(r) ? { id: r[0], house: r[1], name: r[2], type: r[4] } : { id: r.id, house: r.house, name: r.name || r.n, type: r.type || r.cls }).filter(r => r.id);
    return out.length ? out : CH0; };
  // champInfo(id) → {id, house, name, type} (type melee | ranged | caster); unknown ids get a capitalised name and 'melee'
  R.champInfo = id => { const r = champRows().find(r => r.id === id) || CH0.find(r => r.id === id);
    return r ? { id, house: r.house, name: r.name || id, type: r.type || 'melee' } : { id, house: null, name: id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Hero', type: 'melee' }; };
  R.clsOf = id => { if (R.champs && typeof R.champs.cls === 'function') { try { const c = R.champs.cls(id); if (c) return c; } catch (e) {} } return R.CLS_OF[R.champInfo(id).type] || 'knight'; };
  // the house's starting hero — ONE rule for core, intro, heroes and tests: A10's R.champs.first(house) (the old game's opening order, tier 0),
  // else the same order kept here (Stark → brienne, Lannister → kevan, …), else the first roster row of the house
  R.FIRST = { stark: 'brienne', lannister: 'kevan', baratheon: 'gendry', targaryen: 'viserys', greyjoy: 'rodrik', tyrell: 'garlan', martell: 'areo' };
  R.firstChamp = house => { house = house || 'stark';
    if (R.champs && typeof R.champs.first === 'function') { try { const id = R.champs.first(house); if (id) return id; } catch (e) {} }
    if (R.FIRST[house]) return R.FIRST[house];
    const r = champRows().find(r => r.house === house) || CH0.find(r => r.house === house) || champRows()[0]; return r ? r.id : 'brienne'; };

  /* ---- progression fallbacks (R.data.balance and R.champs override when A39's / A10's modules are present) ---- */
  R.MAIN = { knight: 'str', ranger: 'agi', maester: 'int' };
  R.xpNext = L => { const B = R.data.balance; if (B && typeof B.xpNext === 'function') return B.xpNext(L); return 80 + 45 * L + 6 * L * L; };
  // stats of the hero for a save's p → {hpMax, atk, def, spd}: balance.playerStats(p) wins; else R.champs.statsAt(hero, lvl) fills what it gives; the ARCH formulas fill the rest; equipped gear adds
  R.statsFor = p => { const B = R.data.balance; if (B && typeof B.playerStats === 'function') { try { const s = B.playerStats(p); if (s && s.hpMax) return s; } catch (e) { R.err(e.message, 'balance'); } }
    const L = p.lvl || 1, st = p.stats || {}, vit = st.vit || 0, main = st[R.MAIN[p.cls] || 'str'] || 0;
    const f = { hpMax: 120 + 18 * L + 6 * vit, atk: 10 + 2 * L + 1.5 * main, def: 4 + 1.2 * L + 0.6 * vit, spd: 170 };
    if (R.champs && typeof R.champs.statsAt === 'function' && p.hero) { try { const c = R.champs.statsAt(p.hero, L) || {}; const hp = c.hpMax != null ? c.hpMax : c.hp; if (hp != null) f.hpMax = hp; if (c.atk != null) f.atk = c.atk; if (c.def != null) f.def = c.def; if (c.spd != null) f.spd = c.spd; } catch (e) { R.err(e.message, 'champs.statsAt'); } }
    const g = { atk: 0, def: 0, hp: 0, spd: 0 }; for (const k of ['weapon', 'armor', 'trinket']) { const it = p.gear && p.gear[k]; if (it && it.stats) for (const s in g) g[s] += it.stats[s] || 0; }
    return { hpMax: Math.round(f.hpMax + g.hp), atk: +(f.atk + g.atk).toFixed(1), def: +(f.def + g.def).toFixed(1), spd: f.spd + g.spd }; };

  /* ---- the save (v2): acc = the account (house, unlocked champions, the Hall of the Fallen, titles, world progress), p = the one living hero ---- */
  R.state = null;
  R.KEY = 'holdor_rpg';
  R.blankHero = hero => ({ hero: hero || null, name: '', cls: 'knight', lvl: 1, xp: 0, hp: 0, gold: 0, gems: 0, pos: null, stats: { str: 5, agi: 5, int: 5, vit: 5 }, pts: 0, skills: {}, spts: 0, bar: [null, null, null], gear: {}, inv: [], potions: { hp: 3 }, dead: false, created: Date.now(), played: 0 });
  // newState(house) → a fresh account of that house with its first champion unlocked and an empty hero (no p.hero yet: the intro / R.newHero fills it)
  R.newState = house => { house = house || 'stark'; const first = R.firstChamp(house); const champs = {}; if (first) champs[first] = { unlocked: 1, runs: 0 };
    return R.alias({ v: 2, acc: { house, champs, hall: [], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: { lvl: 0, kills: 0 } },
      p: R.blankHero(), wallet: { imported: false }, opts: { sfx: 1, haptic: 1, lang: 'en' } }); };
  R.acc = () => R.state ? R.state.acc : null;
  // p.flags / found / quests / bosses / killed → acc.world.*, p.ach / p.title → acc.*: non-enumerable accessors (not serialised), re-installed by load
  const ALIAS = { flags: ['world', 'flags'], found: ['world', 'found'], quests: ['world', 'quests'], bosses: ['world', 'bosses'], killed: ['world', 'killed'], ach: ['ach'], title: ['title'] };
  R.alias = s => { if (!s || !s.p || !s.acc) return s; for (const k in ALIAS) { const path = ALIAS[k], last = path[path.length - 1];
      const host = () => { let o = s.acc; for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {}; return o; };
      Object.defineProperty(s.p, k, { configurable: true, enumerable: false, get: () => host()[last], set: v => { host()[last] = v; } }); } return s; };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const fill = (dst, src) => { for (const k in src) { if (dst[k] === undefined) dst[k] = src[k]; else if (isObj(dst[k]) && isObj(src[k])) fill(dst[k], src[k]); } return dst; };
  // a v1 save (one p with found/flags/… inside) becomes v2: those move to acc.world / acc
  const migrate = s => { if (s.acc && s.v >= 2) return s; const p = s.p, n = R.newState(p.house || 'stark'); s.acc = s.acc || n.acc;
    for (const k in ALIAS) { if (Object.prototype.hasOwnProperty.call(p, k)) { const d = Object.getOwnPropertyDescriptor(p, k); if (d && 'value' in d) { const path = ALIAS[k]; let o = s.acc; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = d.value; } delete p[k]; } }
    if (p.hero === undefined) p.hero = null; delete p.house; delete p.comps; delete p.champs; s.v = 2; return s; };
  let saveT = 0;
  // R.save() debounced 0.8 s; R.save(true) at once. Writes the hero's pos + hp + dead into the save, localStorage, 'save' event, R.net.save when logged in.
  R.save = now => { if (!R.state) return false; if (!now) { if (!saveT) saveT = setTimeout(() => { saveT = 0; R.save(true); }, 800); return true; }
    if (saveT) { clearTimeout(saveT); saveT = 0; }
    const P = R.player, p = R.state.p; if (P && p) { p.pos = { x: Math.round(P.x), y: Math.round(P.y) }; p.dead = !!P.dead; if (!P.dead) p.hp = Math.round(P.hp); }
    R.state.saved = Date.now();   // the save's time: R.net keeps the newer of local / server by it
    try { localStorage.setItem(R.KEY, JSON.stringify(R.state)); } catch (e) {}
    R.bus.emit('save', R.state); if (R.net && R.net.on && R.net.save) { try { R.net.save(); } catch (e) { R.err(e.message, 'net.save'); } } return true; };
  // load(raw?) → true when a save was found (localStorage, or the object given); v1 saves migrate, missing keys fill from defaults, the p.* aliases are installed
  R.load = raw => { try { const s = raw || JSON.parse(localStorage.getItem(R.KEY) || 'null'); if (s && isObj(s) && isObj(s.p)) { migrate(s); const def = R.newState(s.acc.house), had = isObj(s.acc.champs) && Object.keys(s.acc.champs).some(k => s.acc.champs[k] && s.acc.champs[k].unlocked);
      if (had) def.acc.champs = {};   // an account keeps exactly the champions it unlocked (no free starter on every load)
      fill(s, def); R.state = R.alias(s); R.bus.emit('load', R.state); return true; } } catch (e) { R.err((e && e.message) || e, 'load'); } return false; };
  R.reset = () => { try { localStorage.removeItem(R.KEY); } catch (e) {} R.state = null; };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') R.save(true); });
  window.addEventListener('pagehide', () => R.save(true));

  /* ---- ui shell: one screen at a time in #screen; the game pauses while one is open unless screen.live ---- */
  const scr = () => document.getElementById('screen');
  let manualPause = false, screenPause = false;
  const updPause = () => { R.paused = manualPause || screenPause; };
  R.pause = on => { manualPause = !!on; updPause(); return R.paused; };
  R.ui = { cur: null, arg: undefined,
    // open(name, arg) → the screen element (or null when the screen is not registered); re-opening the current screen closes and opens it again
    open: (name, arg) => { const S = R.screens[name]; if (!S) { console.warn('no screen', name); return null; }
      if (R.ui.cur) R.ui.close();
      const el = scr(); if (!el) return null; R.ui.cur = name; R.ui.arg = arg; el.innerHTML = ''; el.classList.add('on'); el.dataset.screen = name;
      screenPause = !S.live; updPause();
      try { S.open(arg, el); } catch (e) { console.error('screen', name, e); R.err((e && e.message) || e, 'screen:' + name); R.ui.close(); return null; }
      R.bus.emit('screen', name, arg); return el; },
    // close(name?) closes the current screen (only that one when a name is given) → true when something closed
    close: name => { const cur = R.ui.cur; if (!cur || (name && name !== cur)) return false; const S = R.screens[cur]; R.ui.cur = null; R.ui.arg = undefined;
      try { S && S.close && S.close(); } catch (e) { console.error('screen close', cur, e); }
      const el = scr(); if (el) { el.classList.remove('on'); el.innerHTML = ''; delete el.dataset.screen; }
      screenPause = false; updPause(); R.bus.emit('screen', null); return true; },
    toggle: (name, arg) => R.ui.cur === name ? R.ui.close() : R.ui.open(name, arg),
    toast: (txt, col, ms) => { const host = document.getElementById('ui') || document.body; if (!host) return null; const d = document.createElement('div'); d.className = 'toast'; d.textContent = txt; if (col) d.style.color = col;
      const n = host.querySelectorAll('.toast').length; if (n) d.style.top = 'calc(14% + ' + n * 40 + 'px)'; host.appendChild(d); setTimeout(() => d.remove(), ms || 2200); return d; },
    el: id => document.getElementById(id) };

  /* ---- canvases + loop: #gl (3D, A05) under #c (2D overlay, transparent) ---- */
  const app = document.getElementById('app') || document.body;
  let cv = document.getElementById('c'); if (!cv) { cv = document.createElement('canvas'); cv.id = 'c'; app.prepend(cv); }
  let gl = document.getElementById('gl'); if (!gl) { gl = document.createElement('canvas'); gl.id = 'gl'; gl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; app.insertBefore(gl, cv); }
  const ctx = cv.getContext('2d'); R.cv = cv; R.gl = gl; R.ctx = ctx; R.vw = 390; R.vh = 844; R.dpr = 1;
  R.resize = () => { R.dpr = Math.min(2, window.devicePixelRatio || 1); R.vw = window.innerWidth || 390; R.vh = window.innerHeight || 844; const w = Math.round(R.vw * R.dpr), h = Math.round(R.vh * R.dpr);
    cv.width = w; cv.height = h; const g = R.gl || gl; if (g && (g.width !== w || g.height !== h)) { g.width = w; g.height = h; } R.camClamp(); R.bus.emit('resize', R.vw, R.vh); };
  window.addEventListener('resize', R.resize); R.resize();
  const sysErr = (s, e) => { s._errs = (s._errs || 0) + 1; if (s._errs <= 3) { console.error(s.name, e); R.err((e && e.message) || e, 'sys:' + s.name); } };
  // one fixed step (1/60 s): systems in order, animation clocks, garbage, camera, tick1s + played seconds (autosave every 30 s of play)
  R.step = () => { const dt = R.dt; const t0 = R.t; R.t += dt; R.tick++;
    for (const s of R.sysList) if (s.update) { try { s.update(dt); } catch (e) { sysErr(s, e); } }
    for (const e of R.ents) e.animT += dt;
    gc(); R.camUpdate(dt);
    if (Math.floor(R.t + 1e-9) !== Math.floor(t0 + 1e-9)) { if (R.state && R.state.p) { R.state.p.played = (R.state.p.played | 0) + 1; if (R.state.p.played % 30 === 0) R.save(); }
      const p = R.state && R.state.p, pl = p && p.played; R.bus.emit('tick1s'); if (p && R.state.p === p && p.played > pl) p.played = pl; } };   // the core counts played seconds; a 'tick1s' listener must not count them again
  R.drawAll = () => { ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); ctx.clearRect(0, 0, R.vw, R.vh);
    for (const s of R.sysList) if (s.draw) { ctx.save(); try { s.draw(ctx); } catch (e) { sysErr(s, e); } ctx.restore(); } };
  let acc = 0, last = 0, raf = 0;
  R.MAXSTEPS = 6;
  const frame = now => { raf = requestAnimationFrame(frame); if (!R.running) return; if (!last) last = now; const d = Math.min(0.1, (now - last) / 1000); last = now;
    if (R.paused) { acc = 0; R.drawAll(); return; } acc += d; let n = 0; while (acc >= R.dt && n++ < R.MAXSTEPS) { R.step(); acc -= R.dt; } if (acc > R.dt) acc = R.dt; R.drawAll(); };
  // run(): the loop alone. start(): what the intro calls when the hero is made — enters the world if the player is not there yet, else runs.
  R.run = () => { if (!R.running) { R.running = true; last = 0; acc = 0; } if (!raf) raf = requestAnimationFrame(frame); return true; };
  R.start = () => { if (R.state && !R.player) return R.enterWorld(); return R.run(); };
  R.stop = () => { R.running = false; };

  /* ---- the hero ---- */
  // the house seat: R.world.startPos(house), then R.data.world.pois (house + type 'castle' + seat), then R.data.houses[h].seat ({x,y}, or a poi id / name), else the world centre
  R.homePos = house => { house = house || (R.state && R.state.acc && R.state.acc.house) || 'stark';
    if (R.world && typeof R.world.startPos === 'function') { try { const q = R.world.startPos(house); if (q && isFinite(q.x)) return { x: q.x, y: q.y }; } catch (e) {} }
    const W = R.data.world, pois = W && Array.isArray(W.pois) ? W.pois : null;
    if (pois) { const q = pois.find(q => q.house === house && q.type === 'castle' && q.seat); if (q) return { x: q.x, y: q.y }; }
    const HS = R.data.houses && R.data.houses[house], seat = HS && HS.seat;
    if (seat) { if (typeof seat === 'object' && seat.x != null) return { x: seat.x, y: seat.y }; if (pois) { const s = String(seat).toLowerCase(), q = pois.find(q => String(q.id).toLowerCase() === s || String(q.name).toLowerCase() === s); if (q) return { x: q.x, y: q.y }; } }
    return { x: R.W / 2, y: R.H / 2 }; };
  // makePlayer(x?, y?) → the hero entity (kind 'player', type = champion id, team 0, r 16, keep) from R.state.p; replaces an earlier one; a dead save makes a dead hero
  R.makePlayer = (x, y) => { if (!R.state) R.state = R.newState(); const p = R.state.p; const st = R.statsFor(p);
    if (x == null) { const pos = p.pos && isFinite(p.pos.x) && isFinite(p.pos.y) ? p.pos : R.homePos(); x = pos.x; y = pos.y; }
    if (R.player) R.remove(R.player);
    const dead = !!p.dead;
    const e = R.spawn({ kind: 'player', team: 0, r: 16, x, y, face: 1, name: p.name || (p.hero ? R.champInfo(p.hero).name : 'Hero'), lvl: p.lvl || 1, cls: p.cls, hero: p.hero, type: p.hero || p.cls, house: R.state.acc.house,
      hpMax: st.hpMax, hp: dead ? 0 : (p.hp > 0 ? Math.min(p.hp, st.hpMax) : st.hpMax), atk: st.atk, def: st.def, spd: st.spd, keep: true, dead, anim: dead ? 'die' : 'idle' });
    if (!dead && R.plr && typeof R.plr.attach === 'function') { try { R.plr.attach(e); if (typeof e.recalc === 'function') e.recalc(); e.hp = p.hp > 0 ? Math.min(p.hp, e.hpMax) : e.hpMax; } catch (x) { R.err(x.message, 'makePlayer'); } }
    if (dead) { e.diedAt = R.t; e.hp = 0;   // a hero that died before the reload stays dead: 21_player must not run its death (a 2nd Hall line) again
      if (R.plr && typeof R.plr.attach === 'function') { try { R.plr.attach(e); } catch (x) {} } e.dead = true; e.deathT = R.t || 1e-9; e.nextT = 0; e.anim = 'die'; }
    R.player = e; R.camFollow(e); return e; };
  // newHero(champId?) → the hero entity: a fresh level-1 hero of that champion (name from the roster, class from its type), at the house seat, all entities cleared, in the world; emits 'hero'(id)
  R.newHero = id => { if (!R.state) R.state = R.newState(); const s = R.state, a = s.acc; id = id || R.firstChamp(a.house);
    const info = R.champInfo(id); const c = a.champs[id] = a.champs[id] || { unlocked: 1, runs: 0 }; c.unlocked = 1; c.runs = (c.runs | 0) + 1;
    const p = R.blankHero(id); p.name = info.name; p.cls = R.clsOf(id); const pos = R.homePos(a.house); p.pos = { x: pos.x, y: pos.y };
    s.p = p; R.alias(s); R.clearEnts(); R.bus.emit('hero', id);
    const e = R.enterWorld();
    // the new life starts at the house seat, never where the last one fell: full hp, 3 s of grace, no enemy within 600 units of the seat
    e.x = pos.x; e.y = pos.y; e.vx = e.vy = 0; e.hp = e.hpMax; e.inv = Math.max(e.inv || 0, R.t + 3); e.graceT = R.t + 3; R.camSnap();
    for (const m of R.ents.slice()) if (m !== e && (m.kind === 'mob' || m.kind === 'boss') && !m.keep && (m.x - pos.x) ** 2 + (m.y - pos.y) ** 2 < 600 * 600) R.remove(m);
    R.ward = { x: pos.x, y: pos.y, r: R.WARD_R, until: R.t + R.WARD_T };   // the seat's ward: no enemy comes within WARD_R of the new hero's start for WARD_T s
    R.save(true); return e; };
  // the ward (a new life's first seconds): hostile mobs inside the ring are set back to its edge each step, so a level-1 hero is never born into a fight
  R.WARD_R = 420; R.WARD_T = 8; R.ward = null;
  R.sys.ward = { order: 99, update() { const w = R.ward; if (!w) return; if (R.t > w.until) { R.ward = null; return; }
    for (const m of R.ents) { if (m.dead || m.team === 0 || (m.kind !== 'mob' && m.kind !== 'boss')) continue; const dx = m.x - w.x, dy = m.y - w.y, d2 = dx * dx + dy * dy; if (d2 >= w.r * w.r) continue;
      const d = Math.sqrt(d2) || 1, ux = d2 ? dx / d : 1, uy = d2 ? dy / d : 0; m.x = w.x + ux * (w.r + 4); m.y = w.y + uy * (w.r + 4); m.vx = m.vy = 0; } } };
  // enterWorld(): the hero at p.pos or the house seat, camera snapped, loop running, no screen open; emits 'start'(player)
  R.enterWorld = () => { if (!R.state) R.state = R.newState(); if (R.ui.cur) R.ui.close(); R.resize();
    const e = R.makePlayer();
    if (R.world && R.world.blocked && R.world.blocked(e.x, e.y)) { const h = R.homePos(); e.x = h.x; e.y = h.y; }
    R.camSnap(); R.run(); R.bus.emit('start', e); R.save(); return e; };
  // respawnAt(x, y): the hero stands up at x,y with full hp and clean status (a revive); emits 'respawn'(player); saves at once
  R.respawnAt = (x, y) => { const e = R.player || R.makePlayer(x, y); if (!R.ents.includes(e)) R.ents.push(e);
    e.x = x; e.y = y; e.vx = e.vy = 0; e.dead = false; e.diedAt = null; e.deathT = 0; e.nextT = 0; e.killer = null; e.lastHitBy = null; e.hp = e.hpMax; e.anim = 'idle'; e.animT = 0; e.status = {}; e.cd = {};
    R.camSnap(); R.bus.emit('respawn', e); R.save(true); return e; };
})();
