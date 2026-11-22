/* HOLDOR RPG — 53_tutorial.js (A28): the first three minutes after the prologue.
   Eight short steps driven by real play: one coach line in the HUD's message column (top-centre; 50_hud.js stacks it under the bars, the
   region title and toasts go under it) with an arrow toward the highlighted control + a ring over that control; a small SKIP on the card.  State: flags.tut = index of the current step (0..7); 8 = finished or skipped.  SKIP is for good: acc.tutOff + this device's localStorage 'holdor_tut_off' keep it off even when an older save (a late server load) comes back with flags.tut < 8; R.tut.reset() clears both.  The flags are the
   account's (R.state.acc.world.flags, Addendum 2; R.state.p.flags is its alias / the v1 fallback), so a new hero after a
   death does not replay it.  No step blocks the game; when the module a step needs is absent, the step completes by itself
   after FALLBACK seconds.  Test hooks: R.tut (STEPS, step, targets, skip(), done(), reset()). */
(function () {
  const N = 8, FALLBACK = 6, ADV = 0.7, MOVE = 150, REST = 3;   // steps · s before a step without its module completes · s the check mark stays · units to walk · s the last card stays
  const STEPS = [
    { id: 'move',   txt: 'Drag on the left to walk. Drag on the right to look.',   ring: 'joy' },
    { id: 'attack', txt: 'Wights at the gate. Tap ATTACK.',                        ring: 'attack' },
    { id: 'loot',   txt: 'Walk over the loot to pick it up.',                      ring: 'drop' },
    { id: 'skill',  txt: 'Tap skill 1.',                                           ring: 'skill1' },
    { id: 'dodge',  txt: 'Tap DODGE to roll out of a hit.',                        ring: 'dodge' },
    { id: 'quest',  txt: 'Walk to the ! and talk.',                                ring: 'npc' },
    { id: 'equip',  txt: 'Open the bag. Equip the blade.',                         ring: 'bag' },
    { id: 'done',   txt: 'If you fall, the run ends. The map shows the way north.', ring: 'minimap' }
  ];
  /* DOM controls other modules draw: several spellings are tried in order; R.tut.targets[name] = selector | element | fn overrides */
  const TARGETS = {
    joy: '#joy.on,#joy-rest,#joy,#joystick,#joyzone,.joy,.joystick,.joy-zone,[data-ctl=joy],[data-btn=joy],[data-btn=move]',
    attack: '#b-attack,#btn-attack,#attack,.btn-attack,[data-btn=attack],[data-ctl=attack]',
    skill1: '#b-sk1,#btn-skill1,#skill1,[data-btn=skill1],[data-btn=skill0],[data-skill="0"],[data-skill="1"],.btn-skill,.skill',
    dodge: '#b-dodge,#btn-dodge,#dodge,.btn-dodge,[data-btn=dodge]',
    bag: '#b-inv,#btn-bag,#bag,#btn-inv,#btn-inventory,.btn-bag,[data-btn=bag],[data-btn=inv],[data-btn=inventory],[data-open=inventory]',
    minimap: '#minimap,#mini,#hud-map,.minimap,[data-ctl=minimap],[data-btn=map]'
  };
  /* where the control usually sits when its element is not found (x, y as viewport fractions, size in px) */
  const GUESS = { joy: [0.25, 0.74, 150], attack: [0.84, 0.86, 96], skill1: [0.62, 0.9, 64], dodge: [0.64, 0.76, 64], bag: [0.92, 0.1, 56], minimap: [0.86, 0.1, 110] };

  const T = R.tut = { STEPS, N, step: -1, el: null, card: null, ring: null, txt: null, who: null, face: null, targets: {}, pend: 0, wait: 0, doneAt: null, lay: 0, offs: [] };
  const P = () => R.state && R.state.p;
  const F = () => { const s = R.state; if (!s) return null; if (s.acc && s.acc.world) return s.acc.world.flags || (s.acc.world.flags = {}); const p = s.p; if (!p) return null; return p.flags || (p.flags = {}); };
  // SKIP ends it for good: an account flag (acc.tutOff) + this device's flag, so an older save (a late server load, a stale copy) cannot bring the card back
  const DEV = 'holdor_tut_off';
  let devFlag = null;   // read once (idx() runs every step), kept in step by skip / reset
  const devOff = () => { if (devFlag == null) { try { devFlag = localStorage.getItem(DEV) === '1'; } catch (e) { devFlag = false; } } return devFlag; };
  const off = () => { const a = R.state && R.state.acc; return !!((a && a.tutOff) || devOff()); };
  const idx = () => { const f = F(); if (!f) return N; if (off()) { if ((f.tut | 0) < N) f.tut = N; const a = R.state && R.state.acc; if (a && !a.tutOff) a.tutOff = 1; return N; } const v = f.tut; return v == null ? 0 : Math.max(0, v | 0); };
  const active = () => !!(R.player && !R.player.dead && idx() < N);
  const house = () => (P() && P().house) || (R.state && R.state.acc && R.state.acc.house) || 'stark';
  const houseCol = () => { const H = R.data.houses && R.data.houses[house()]; return (H && (H.col || H.color)) || getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#a9bdd0'; };
  /* the house's master-at-arms: a champion of the house in R.data.champs (array or object) who is not the hero himself */
  const coach = () => { const C = R.data.champs; if (!C) return null; const list = Array.isArray(C) ? C : Object.keys(C).map(k => Object.assign({ id: k }, C[k])); const h = house(), me = P() && P().hero;
    const own = list.filter(x => x && (x.house === h || x.h === h)); const c = own.find(x => (x.id || x.key) !== me) || own[0]; return c ? { id: c.id || c.key, name: c.n || c.name || '' } : null; };

  /* ---- feedback ---- */
  let actx = null;
  const ownChime = () => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; actx = actx || new AC(); if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime; [[659, 0], [988, 0.09]].forEach(([f, d]) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.07, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.32); o.connect(g).connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + 0.35); }); };
  const chime = () => { try { if (R.state && R.state.opts && R.state.opts.sfx === 0) return; if (R.sfx && R.sfx.play) R.sfx.play('chime', 0.5); else ownChime(); } catch (e) {} };
  const haptic = kind => { try { if (R.state && R.state.opts && R.state.opts.haptic === 0) return; if (R.haptic) return R.haptic(kind); const H = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback;
    if (H) kind === 'success' ? H.notificationOccurred('success') : H.impactOccurred('light'); } catch (e) {} };

  /* ---- the coach portrait: R.draw.portrait if present, else a code-drawn helm in the house colour ---- */
  const drawFace = () => { const cv = T.face; if (!cv) return; const c = cv.getContext('2d'); const s = cv.width; const col = houseCol(); c.clearRect(0, 0, s, s);
    c.save(); c.beginPath(); c.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); c.clip(); c.fillStyle = '#0b1220'; c.fillRect(0, 0, s, s); c.globalAlpha = 0.22; c.fillStyle = col; c.fillRect(0, 0, s, s); c.globalAlpha = 1;
    let ok = false; const who = coach();
    if (who && R.draw && R.draw.portrait) { try { const r = R.draw.portrait(who.id, c, 0, 0, s); if (r && r.width) c.drawImage(r, 0, 0, s, s); else if (typeof r === 'string') { const im = new Image(); im.onload = () => { try { c.drawImage(im, 0, 0, s, s); } catch (e) {} }; im.src = r; } ok = true; } catch (e) { ok = false; } }
    if (!ok) { const u = s / 96; c.translate(s / 2, s / 2 + 6 * u);
      c.fillStyle = col; c.beginPath(); c.moveTo(-46 * u, 48 * u); c.quadraticCurveTo(-30 * u, 20 * u, 0, 22 * u); c.quadraticCurveTo(30 * u, 20 * u, 46 * u, 48 * u); c.closePath(); c.fill();   // shoulders / cloak
      c.fillStyle = '#5a6675'; c.beginPath(); c.moveTo(-24 * u, 22 * u); c.lineTo(-24 * u, -12 * u); c.quadraticCurveTo(-24 * u, -40 * u, 0, -40 * u); c.quadraticCurveTo(24 * u, -40 * u, 24 * u, -12 * u); c.lineTo(24 * u, 22 * u); c.closePath(); c.fill();   // great helm
      c.fillStyle = '#0b1220'; c.fillRect(-18 * u, -10 * u, 36 * u, 5 * u); c.fillRect(-2.5 * u, -10 * u, 5 * u, 24 * u);   // visor
      c.strokeStyle = col; c.lineWidth = 5 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -40 * u); c.quadraticCurveTo(16 * u, -58 * u, 34 * u, -46 * u); c.stroke(); }   // plume
    c.restore(); };

  /* ---- DOM ---- */
  const mount = () => { if (T.el) return; const ui = document.getElementById('ui'); if (!ui) return; const col = houseCol();
    const el = document.createElement('div'); el.id = 'tut'; el.className = 'tut'; el.style.setProperty('--hc', col);
    el.innerHTML = '<div class="tut-wrap"><div class="tut-card"><canvas class="tut-face" width="96" height="96"></canvas><div class="tut-body"><div class="tut-who"></div><div class="tut-txt"></div></div><div class="tut-arrow" aria-hidden="true"></div><div class="tut-check">✓</div><button class="tut-skip" type="button" aria-label="Skip the tutorial">SKIP</button></div></div><div class="tut-ring"></div>';
    ui.appendChild(el); T.el = el; T.card = el.querySelector('.tut-card'); T.ring = el.querySelector('.tut-ring'); T.txt = el.querySelector('.tut-txt'); T.who = el.querySelector('.tut-who'); T.face = el.querySelector('.tut-face');
    el.querySelector('.tut-skip').addEventListener('click', ev => { ev.preventDefault(); T.skip(); }); el.classList.toggle('off', !!(R.ui && R.ui.cur)); drawFace(); };
  const teardown = () => { offAll(); if (T.el) T.el.remove(); T.el = T.card = T.ring = T.txt = T.who = T.face = null; T.step = -1; T.doneAt = null; };
  const offAll = () => { for (const [ev, fn] of T.offs) R.bus.off(ev, fn); T.offs = []; };
  const on = (ev, fn) => { R.bus.on(ev, fn); T.offs.push([ev, fn]); };
  R.bus.on('screen', name => { if (T.el) T.el.classList.toggle('off', !!name); });

  /* ---- steps ---- */
  const S = STEPS;
  S[0].enter = () => { T.lx = R.player.x; T.ly = R.player.y; T.moved = 0; };
  S[0].check = () => { const p = R.player; T.moved += Math.hypot(p.x - T.lx, p.y - T.ly); T.lx = p.x; T.ly = p.y; if (T.moved >= MOVE) T.done(); };
  S[0].need = () => !!R.input;

  /* the three wights: in front of the hero (the camera's forward on the ground), on walkable ground, outside a seat's / town's safe radius
     (inside the walls they could not reach him); the nearest ring of 200 → 560 units where all three fit, turning toward the sides first */
  const freeAt = (x, y) => { const W = R.world; try { if (W && W.inWorld && !W.inWorld(x, y)) return false; if (W && W.blocked && W.blocked(x, y)) return false; if (W && W.inPoi && W.inPoi(x, y, 260)) return false; } catch (e) {} return true; };
  const wightSpots = p => { const yaw = (R.cam && R.cam.yaw) || 0, fwd = R.cam && R.cam.yaw != null ? Math.atan2(-Math.cos(yaw), -Math.sin(yaw)) : -Math.PI / 2;
    for (const d of [200, 260, 340, 440, 560]) for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
      const pts = [-1, 0, 1].map(k => { const a = fwd + turn + k * 0.45; return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }; });
      if (pts.every(q => freeAt(q.x, q.y))) return pts; }
    return [-1, 0, 1].map(k => { const a = fwd + k * 0.45; return { x: p.x + Math.cos(a) * 200, y: p.y + Math.sin(a) * 200 }; }); };
  S[1].enter = () => { T.kills = 0; T.mobs = R.ents.filter(e => e.tut && !e.dead); const p = R.player; const spots = wightSpots(p);
    for (let k = T.mobs.length; k < 3; k++) { const x = spots[k].x, y = spots[k].y;
      let m = null; try { m = R.spawnMob ? R.spawnMob('axe', x, y, 1) : R.spawn({ kind: 'mob', type: 'axe', name: 'Wight', x, y, lvl: 1, hp: 24, hpMax: 24, atk: 4, def: 0, spd: 70, team: 1, r: 14 }); } catch (e) { m = null; }
      if (m && typeof m === 'object') { m.tut = 1; T.mobs.push(m); } } };
  S[1].on = { kill: m => { if (!T.mobs.length || T.mobs.indexOf(m) >= 0) T.kills++; if (T.kills >= 3) T.done(); } };
  S[1].check = () => { if (T.mobs.length && T.mobs.every(m => m.dead || R.ents.indexOf(m) < 0)) T.done(); };
  S[1].need = () => !!R.hit;

  S[2].on = { loot: () => T.done(), gold: () => T.done() };
  S[2].need = () => R.ents.some(e => e.kind === 'drop' && !e.dead);

  const cdKey = () => { try { return JSON.stringify((R.player && R.player.cd) || {}); } catch (e) { return ''; } };
  S[3].enter = () => { T.cd0 = cdKey(); };
  S[3].on = { btn: n => { if (/^skill/.test(String(n))) T.done(); }, cast: () => T.done(), skill: () => T.done() };
  S[3].check = () => { if (cdKey() !== T.cd0) T.done(); else if (R.input && R.input.pressed && R.input.pressed('skill1')) T.done(); };
  S[3].need = () => !!(R.data.skills && P() && P().bar && P().bar.some(Boolean));

  S[4].on = { btn: n => { if (n === 'dodge') T.done(); }, dodge: () => T.done() };
  S[4].check = () => { if (R.input && R.input.pressed && R.input.pressed('dodge')) T.done(); };
  S[4].need = () => !!R.input;

  S[5].on = { dialog: () => T.done(), quest: () => T.done() };
  S[5].need = () => !!(R.screens.dialog && R.ents.some(e => e.kind === 'npc' && !e.dead));

  const isWeapon = it => !!(it && typeof it === 'object' && it.kind === 'weapon');
  const makeBlade = () => { let it = null; const I = R.items;
    try { if (I && I.make) it = I.make('weapon', 1, 0); } catch (e) { it = null; }
    if (!isWeapon(it)) { try { if (I && I.roll) for (let k = 0; k < 12 && !isWeapon(it); k++) it = I.roll(1, 0); } catch (e) { it = null; } }
    if (!isWeapon(it)) it = { id: 'tut_blade_' + Date.now().toString(36), kind: 'weapon', name: 'Training blade', rar: 0, lvl: 1, stats: { atk: 3 }, icon: 'sword' };
    it.rar = 0; return it; };
  const gearKey = () => { try { return JSON.stringify((P().gear || {}).weapon || null); } catch (e) { return ''; } };
  S[6].enter = () => { const p = P(), f = F(); if (p && f && !f.tutBlade) { const it = makeBlade(); (p.inv = p.inv || []).push(it); f.tutBlade = it.id || 1; R.save(); if (R.ui && R.ui.toast) R.ui.toast('A blade is in your bag'); } T.gear0 = gearKey(); };
  S[6].on = { equip: () => T.done() };
  S[6].check = () => { if (gearKey() !== T.gear0) T.done(); };
  S[6].need = () => !!(R.screens.inventory || R.screens.inv || R.screens.bag);

  S[7].enter = () => { T.rest = REST; };
  S[7].check = dt => { T.rest -= dt; if (T.rest <= 0) T.done(); };
  S[7].need = () => true;

  /* ---- flow ---- */
  const enter = i => { const st = S[i]; if (!st) return; offAll(); T.step = i; T.wait = 0; T.doneAt = null; T.lay = 1;
    if (T.card) { T.card.classList.remove('ok'); T.txt.textContent = st.txt; const c = coach(); T.who.textContent = (c && c.name ? c.name + ' · ' : '') + (i + 1) + '/' + N; T.card.classList.remove('tut-in'); void T.card.offsetWidth; T.card.classList.add('tut-in'); }
    if (st.on) for (const ev in st.on) on(ev, st.on[ev]);
    try { st.enter && st.enter(); } catch (e) { console.error('tut enter', e); }
    R.bus.emit('tutorial', i, 'enter'); try { R.hud && R.hud.stack && R.hud.stack(); } catch (e) {} };   // the message column: the card first, an achievement card under it
  T.done = () => { if (T.doneAt != null || T.step < 0) return; T.doneAt = R.t; T.pend = ADV; offAll(); if (T.card) T.card.classList.add('ok'); if (T.ring) T.ring.style.display = 'none'; chime(); haptic('success'); R.bus.emit('tutorial', T.step, 'done'); };
  const advance = () => { const f = F(); if (!f) return; f.tut = T.step + 1; R.save(); if (f.tut >= N) finish(); else enter(f.tut); };
  const finish = () => { const f = F(); if (f) f.tut = N; R.save(); teardown(); R.bus.emit('tutorial', N, 'end'); };
  T.skip = () => { if (!active()) return; const f = F(); if (f) f.tut = N; const a = R.state && R.state.acc; if (a) a.tutOff = 1; devFlag = true; try { localStorage.setItem(DEV, '1'); } catch (e) {} haptic('light'); R.save(true); teardown(); R.bus.emit('tutorial', N, 'skip'); };
  T.reset = () => { const f = F(); if (f) { f.tut = 0; delete f.tutBlade; } const a = R.state && R.state.acc; if (a) delete a.tutOff; devFlag = false; try { localStorage.removeItem(DEV); } catch (e) {} teardown(); };
  T.off = off;

  /* ---- the ring over a DOM control ---- */
  const findTarget = name => { const o = T.targets[name]; if (typeof o === 'function') { try { return o(); } catch (e) { return null; } } if (o && o.nodeType) return o;
    const sel = typeof o === 'string' ? o : TARGETS[name]; if (!sel) return null;
    for (const s of sel.split(',')) { try { const el = document.querySelector(s.trim()); if (el) return el; } catch (e) {} } return null; };
  /* the arrow on the card points from the card toward the ring (8 directions) */
  const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  const pointAt = (tx, ty) => { const a = T.el && T.el.querySelector('.tut-arrow'); if (!a || !T.card) return; if (tx == null) { a.textContent = ''; return; }
    const b = T.card.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    if (tx >= b.left && tx <= b.right && ty >= b.top && ty <= b.bottom) { a.textContent = ''; return; }
    const k = Math.round(Math.atan2(ty - cy, tx - cx) / (Math.PI / 4)); const ch = ARROWS[(k + 8) % 8]; if (a.textContent !== ch) a.textContent = ch; };
  const layoutRing = () => { const ring = T.ring; if (!ring) return; const st = S[T.step];
    if (st && (st.ring === 'drop' || st.ring === 'npc') && T.doneAt == null) { const e = worldTarget(st.ring); const s = e && R.w2s ? R.w2s(e.x, e.y, 0) : null; pointAt(s && !s.behind ? s.x : null, s && !s.behind ? s.y : null); }
    else if (!st || !st.ring || T.doneAt != null) pointAt(null);
    if (!st || !st.ring || st.ring === 'drop' || st.ring === 'npc' || T.doneAt != null) { ring.style.display = 'none'; return; }
    const el = findTarget(st.ring); let x, y, w, h, guess = false;
    if (el) { const b = el.getBoundingClientRect(); if (b.width < 4 || b.height < 4) { ring.style.display = 'none'; return; } x = b.left - 8; y = b.top - 8; w = b.width + 16; h = b.height + 16; }
    else { const g = GUESS[st.ring]; if (!g) { ring.style.display = 'none'; return; } w = h = g[2]; x = g[0] * R.vw - w / 2; y = g[1] * R.vh - h / 2; guess = st.ring !== 'joy'; }
    pointAt(x + w / 2, y + h / 2);
    ring.style.display = 'block'; ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.style.width = w + 'px'; ring.style.height = h + 'px'; ring.classList.toggle('guess', guess); ring.classList.toggle('sq', Math.abs(w - h) > 12); };
  /* ---- the ring over a world thing (a drop, the quest npc) on the 2D overlay, with a chevron at the screen edge when it is off screen ---- */
  const worldTarget = kind => { const p = R.player; if (!p) return null; let best = null, bd = Infinity;
    for (const e of R.ents) { if (e.dead || e.kind !== kind) continue; const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2 - (kind === 'npc' && e.quest ? 1e9 : 0); if (d < bd) { bd = d; best = e; } } return best; };
  const draw = ctx => { if (!T.el || T.doneAt != null || (R.ui && R.ui.cur)) return; const st = S[T.step]; if (!st || (st.ring !== 'drop' && st.ring !== 'npc')) return; const e = worldTarget(st.ring); if (!e) return;
    const s = R.w2s(e.x, e.y, 0); if (!s) return; const pulse = 1 + 0.12 * Math.sin(R.t * 6); const col = houseCol(); ctx.save(); ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 12;
    if (s.x > -20 && s.x < R.vw + 20 && s.y > -20 && s.y < R.vh + 20) { ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(18, (e.r || 14) * 1.8 * (R.cam.z || 1)) * pulse, 0, Math.PI * 2); ctx.stroke(); }
    else { const cx = R.vw / 2, cy = R.vh / 2, a = Math.atan2(s.y - cy, s.x - cx); const k = Math.min(Math.abs((R.vw / 2 - 36) / Math.cos(a)), Math.abs((R.vh / 2 - 150) / Math.sin(a)));
      ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(16 * pulse, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); }
    ctx.restore(); };

  /* ---- the system ---- */
  const update = dt => { if (!active()) { if (T.el) teardown(); return; }
    if (!T.el) mount(); const i = idx(); if (T.step !== i) enter(i); const st = S[T.step]; if (!st) return;
    if (T.doneAt != null) { T.pend -= dt; if (T.pend <= 0) advance(); return; }
    try { st.check && st.check(dt); } catch (e) { console.error('tut check', e); }
    if (T.doneAt != null) return;
    let has = true; try { has = !st.need || !!st.need(); } catch (e) { has = true; }
    if (has) T.wait = 0; else if ((T.wait += dt) >= FALLBACK) { T.done(); return; }
    if ((T.lay += dt) >= 0.1) { T.lay = 0; layoutRing(); } };
  R.addSys('tutorial', { order: 960, update, draw });
  window.addEventListener('resize', () => { T.lay = 1; });
})();
