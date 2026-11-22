/* HOLDOR RPG — 44_dungeons.js (A22): three instanced dungeons behind portal POIs.
   A dungeon is a small world of its own in a far corner the overworld never uses (x 6800–7200, y 100–700):
   three rooms joined by corridors, a locked door between rooms that opens when the room is clear, three waves of
   mobs per room from the dungeon's table, a mini-boss and a treasure chest in the last room, a 10-minute timer,
   a "Leave" prompt 20 s after the chest. Entry through a portal (bus 'interact' with e.kind==='portal') → the
   entry sheet (R.screens.dungeon) → R.dungeons.enter(id). Three runs a day per dungeon; the first clear of the day pays gems.
   API: R.dungeons = { DG, list(), active, enter(id), leave(o), blocked(x,y), canEnter(id), sheet(id), ROOMS, HALLS, BOUNDS, ENTRY }
   Events: 'dungeon'(id, 'enter'|'room'|'clear'|'leave'|'fail', extra). Soft deps: R.spawnMob, R.loot.chest, R.boss.spawn, R.world, R.data.world.pois. */
(function () {
  const DG = {
    dg_crypts: { id: 'dg_crypts', name: 'The Crypts', place: 'Winterfell', lvl: 12, gems: 10, boss: 'boss_crypts', bossName: 'Keeper of the Crypts', elite: 'crypt',
      waves: [['crypt', 'crypt', 'crawler'], ['crypt', 'crawler', 'crawler', 'crypt'], ['necro', 'crypt', 'crypt', 'crawler']], floor: '#1b2129', wall: '#0a0d12', torch: '#8fd3ff', line: 'The dead of the North keep their halls.' },
    dg_harrenhal: { id: 'dg_harrenhal', name: 'The Burnt Vaults', place: 'Harrenhal', lvl: 24, gems: 20, boss: 'boss_vaults', bossName: 'Warden of the Ashes', elite: 'sword',
      waves: [['axe', 'sword', 'archer'], ['sword', 'sword', 'archer', 'spear'], ['wraith', 'axe', 'shield', 'archer']], floor: '#2a1d16', wall: '#0f0907', torch: '#ffb15c', line: 'Outlaws nest where the dragon fire fell.' },
    dg_caves: { id: 'dg_caves', name: 'The Ice Caves', place: 'Beyond the Wall', lvl: 46, gems: 40, boss: 'boss_caves', bossName: 'The Ice Elder', elite: 'giant',
      waves: [['walker', 'walker', 'hound'], ['walker', 'walker', 'walker', 'hound'], ['giant', 'walker', 'walker']], floor: '#17283a', wall: '#070b12', torch: '#b9f0ff', line: 'The cold itself walks these tunnels.' }
  };
  const MAX_RUNS = 3, TIME = 600, LEAVE_T = 20, WAVE_GAP = 1.2;
  /* the instance lies OUTSIDE the world (x >= R.W + 1000: no region, no terrain, no discovery); OX shifts the layout drawn at x 6800–7200.
     While inside, R.W and the world data's size are widened to the instance's right edge so the player / camera clamps let him move. */
  const OX = Math.round((R.W || 7200) + 1000 - 6800);
  const BOUNDS = { x: 6800 + OX, y: 100, w: 400, h: 600 };
  const ROOMS = [{ x: 6850 + OX, y: 540, w: 300, h: 140 }, { x: 6850 + OX, y: 340, w: 300, h: 140 }, { x: 6850 + OX, y: 140, w: 300, h: 140 }];
  const HALLS = [{ x: 6972 + OX, y: 480, w: 56, h: 60 }, { x: 6972 + OX, y: 280, w: 56, h: 60 }];
  const DOORS = [{ x: 7000 + OX, y: 510, hall: 0 }, { x: 7000 + OX, y: 310, hall: 1 }];
  const ENTRY = { x: 7000 + OX, y: 655 }, BOSS_AT = { x: 7000 + OX, y: 215 }, CHEST_AT = { x: 7000 + OX, y: 172 };
  const widen = a => { a.prevRW = R.W; const edge = BOUNDS.x + BOUNDS.w + 200; if (!(R.W >= edge)) R.W = edge; const d = R.data.world;
    if (d && Array.isArray(d.size)) { a.prevSize = d.size; d.size = [Math.max(d.size[0], edge), d.size[1]]; } };
  /* a stone floor in the 3D scene under the instance: R.tex 'cobble' / 'stone_dark' (G10) on a plane at the entry's ground height */
  const floor3d = a => { const R3 = R.render3d, T = window.THREE; if (!R3 || !R3.scene || !T) return; try {
      let src = null; if (R.tex && typeof R.tex.get === 'function') { for (const k of ['cobble', 'stone_dark']) { try { src = R.tex.get(k); } catch (e) { src = null; } if (src) break; } }
      let map = null; if (src) { map = src.isTexture ? src.clone() : new T.CanvasTexture(src); map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(BOUNDS.w / 48, BOUNDS.h / 48); map.needsUpdate = true; }
      const m = new T.Mesh(new T.PlaneGeometry(BOUNDS.w + 120, BOUNDS.h + 120), new T.MeshLambertMaterial({ color: map ? 0xb8b0a4 : 0x2a2f38, map }));
      m.rotation.x = -Math.PI / 2; const gy = R3.groundY ? R3.groundY(ENTRY.x, ENTRY.y) : 0; m.position.set(BOUNDS.x + BOUNDS.w / 2, (gy || 0) + 0.4, BOUNDS.y + BOUNDS.h / 2); m.name = 'dungeonFloor';
      R3.scene.add(m); a.floor3d = m; } catch (e) { console.warn('dungeon floor', e); a.floor3d = null; } };
  const unfloor = a => { const m = a.floor3d, R3 = R.render3d; if (!m) return; try { if (R3 && R3.scene) R3.scene.remove(m); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); } catch (e) {} a.floor3d = null; };
  const narrow = a => { unfloor(a); if (a.prevRW != null) R.W = a.prevRW; const d = R.data.world; if (d && a.prevSize) d.size = a.prevSize; };
  const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const day = () => new Date().toISOString().slice(0, 10);
  const flags = () => (R.state && R.state.p && (R.state.p.flags = R.state.p.flags || {})) || null;
  const D = { DG, ROOMS, HALLS, BOUNDS, ENTRY, OX, active: null, list: () => Object.values(DG) };
  R.dungeons = D;

  /* ---- walkable mask ---- */
  D.blocked = (x, y) => {
    const a = D.active; if (!a) return false;
    if (!inR(BOUNDS, x, y)) return true;
    for (const r of ROOMS) if (inR(r, x, y)) return false;
    for (let i = 0; i < HALLS.length; i++) if (inR(HALLS[i], x, y)) { const d = a.doors[i]; return !!(d && !d.open && Math.abs(y - d.y) <= 9); }
    return true;
  };
  D.canEnter = id => {
    const def = DG[id]; if (!def) return { ok: false, reason: 'Unknown dungeon', runs: 0, max: MAX_RUNS };
    if (D.active) return { ok: false, reason: 'Already inside', runs: 0, max: MAX_RUNS };
    const F = flags(); const runs = F ? (F['dg:' + id + ':' + day()] | 0) : 0;
    if (runs >= MAX_RUNS) return { ok: false, reason: 'No runs left today', runs, max: MAX_RUNS };
    return { ok: true, runs, max: MAX_RUNS, firstClear: !F || !F['dgc:' + id + ':' + day()] };
  };

  /* ---- spawning helpers (soft deps) ---- */
  const spawnMob = (type, x, y, o) => {
    const before = R.ents.length; let e = null;
    if (R.spawnMob) { try { e = R.spawnMob(type, x, y, o); } catch (x) { console.error('dungeon spawnMob', x); } }
    if (!e) e = R.ents.slice(before).find(m => m.kind === 'mob' || m.kind === 'boss');
    if (!e) { const L = o.lvl || 1, k = o.elite ? 3 : 1; e = R.spawn({ kind: 'mob', type, x, y, team: 1, lvl: L, hp: Math.round((40 + 14 * L) * k), atk: Math.round((6 + 1.6 * L) * (o.elite ? 1.6 : 1)), def: Math.round(2 + 0.8 * L), spd: 100, name: type, elite: !!o.elite, scale: o.scale || 1, r: o.elite ? 22 : 14 }); }
    if (e.team == null || e.team === 2) e.team = 1; if (!e.lvl) e.lvl = o.lvl; e.dg = o.room; e.dgRun = D.active && D.active.n;
    return e;
  };
  const randIn = (r, pad) => ({ x: r.x + pad + R.rng() * (r.w - 2 * pad), y: r.y + pad + R.rng() * (r.h - 2 * pad) });
  const spawnWave = a => {
    const i = a.room, types = a.def.waves[a.wave], room = ROOMS[i], P = R.player, list = [];
    for (const t of types) {
      let p = randIn(room, 26), tries = 0;
      while (P && Math.hypot(p.x - P.x, p.y - P.y) < 90 && tries++ < 12) p = randIn(room, 26);
      list.push(spawnMob(t, p.x, p.y, { lvl: a.def.lvl, room: i, dungeon: a.id }));
    }
    a.mobs[i].push(...list); a.wave++; a.waveT = 0;
    R.bus.emit('dungeon', a.id, 'wave', { room: i, wave: a.wave, n: list.length });
    if (R.sfx && R.sfx.play) { try { R.sfx.play('dg_wave', 0.6); } catch (e) {} }
  };
  const spawnBoss = a => {
    const def = a.def, at = BOSS_AT; let e = null;
    if (R.boss && R.boss.spawn && R.data.bosses && R.data.bosses[def.boss]) {
      const before = R.ents.length;
      try { e = R.boss.spawn(def.boss, at.x, at.y); } catch (x) { console.error('dungeon boss', x); }
      if (!e || !e.kind) e = R.ents.slice(before).find(m => m.kind === 'boss') || null;
    }
    if (!e) e = spawnMob(def.elite, at.x, at.y, { lvl: def.lvl + 2, elite: true, scale: 1.6, room: 2, dungeon: a.id });
    e.dg = 2; e.dgBoss = true; e.name = e.name && e.kind === 'boss' ? e.name : def.bossName; a.boss = e; a.mobs[2].push(e);
    R.bus.emit('dungeon', a.id, 'boss', { name: e.name }); R.ui.toast(e.name, '#ff9d6b');
    if (R.fx && R.fx.shake) { try { R.fx.shake(6, 0.4); } catch (x) {} }
  };
  const spawnChest = a => {
    const def = a.def, at = CHEST_AT; let e = null;
    if (R.loot && R.loot.chest) { try { e = R.loot.chest(at.x, at.y, def.lvl, 2); if (e) e.dungeon = a.id; /* 32_loot: chest(x, y, lvl, rar) */ } catch (x) { console.error('dungeon chest', x); } }
    if (!e || typeof e !== 'object') e = R.spawn({ kind: 'drop', chest: true, dgOwn: true, x: at.x, y: at.y, r: 18, team: 2, lvl: def.lvl, name: 'Treasure chest' });
    e.dgChest = true; a.chest = e; a.chestAt = { x: at.x, y: at.y }; a.cleared = true; a.leaveT = LEAVE_T;
    const F = flags(), k = 'dgc:' + a.id + ':' + day();
    if (F && !F[k]) { F[k] = 1; R.state.p.gems = (R.state.p.gems | 0) + def.gems; R.ui.toast('+' + def.gems + ' gems · first clear today', '#9be7ff'); R.bus.emit('gems', def.gems); }
    R.state.p.flags['dgclears:' + a.id] = (R.state.p.flags['dgclears:' + a.id] | 0) + 1; R.save();
    R.bus.emit('dungeon', a.id, 'clear', { time: Math.round(R.t - a.started) }); showLeave(a);
  };

  /* ---- enter / leave ---- */
  let runN = 0;
  // a painted billboard for the door entities (the 3D renderer billboards e.frame()): an iron-bound oak door, or an empty arch once open
  const DF = {}; const doorFrame = open => { const k = open ? 'o' : 'c'; if (DF[k]) return DF[k]; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#2a241e'; g.fillRect(14, 20, 100, 104); g.fillStyle = '#4a4036'; g.fillRect(20, 26, 88, 98);
    if (!open) { g.fillStyle = '#6b4a2c'; g.fillRect(28, 34, 72, 90); g.strokeStyle = '#3b2716'; g.lineWidth = 3; for (let x = 40; x < 100; x += 14) { g.beginPath(); g.moveTo(x, 36); g.lineTo(x, 122); g.stroke(); }
      g.fillStyle = '#8d939b'; g.fillRect(28, 52, 72, 6); g.fillRect(28, 96, 72, 6); g.beginPath(); g.arc(88, 80, 4, 0, Math.PI * 2); g.fill(); }
    else { g.fillStyle = '#0d0b09'; g.fillRect(28, 34, 72, 90); }
    cv.units = { w: 64, h: 64 }; cv.anchor = { x: 0.5, y: 1 }; return (DF[k] = cv); };
  D.enter = id => {
    const def = DG[id], P = R.player; const c = D.canEnter(id);
    if (!def || !P || !R.state) return false;
    if (!c.ok) { R.ui.toast(c.reason, '#e14b4b'); return false; }
    const F = flags(); F['dg:' + id + ':' + day()] = c.runs + 1; F.dgReturn = { x: Math.round(P.x), y: Math.round(P.y) };
    const a = D.active = { id, def, n: ++runN, room: 0, wave: 0, waveT: WAVE_GAP, mobs: [[], [], []], doors: [], boss: null, chest: null, chestAt: null, timeLeft: TIME, leaveT: 0, started: R.t, cleared: false, roomStarted: [true, false, false] };
    if (R.world) { a.prevPop = R.world.populate; R.world.populate = false; a.prevBlocked = R.world.blocked; R.world.blocked = (x, y) => D.blocked(x, y); }
    widen(a); floor3d(a); P.x = ENTRY.x; P.y = ENTRY.y; P.vx = P.vy = 0; a.last = { x: P.x, y: P.y }; R.cam.x = P.x; R.cam.y = P.y;
    // the instance sits in the map's far corner (inside 'beyond'): the world watcher must not see a region change there (no banner, gate
    // pushback, discovery or region achievements). R.world.suspend = true is the flag for 10_world; R.world.cur is pre-set as well.
    if (R.world) { a.prevCur = R.world.cur; R.world.suspend = true; R.world.inDungeon = id; try { const rg = R.world.regionAt && R.world.regionAt(P.x, P.y); R.world.cur = rg ? rg.id : null; R.world.lastGood = { x: P.x, y: P.y }; } catch (e) {} }
    for (const e of R.ents) if (e.kind === 'companion' && !e.dead) { e.x = ENTRY.x - 30 + R.rng() * 60; e.y = ENTRY.y + 10; e.vx = e.vy = 0; }
    for (const d of DOORS) { const de = R.spawn({ kind: 'door', x: d.x, y: d.y, r: 28, team: 2, open: false, dgOwn: true, name: 'Locked door' }); de.frame = () => doorFrame(de.open); a.doors.push(de); }
    R.bus.emit('dungeon', id, 'enter', { runs: c.runs + 1 }); spawnWave(a); bar(true); R.save();
    R.ui.toast(def.name + ' · lvl ' + def.lvl, '#f3e7c4');
    if (R.sfx && R.sfx.play) { try { R.sfx.play('dg_enter', 0.7); } catch (e) {} }
    return true;
  };
  D.leave = o => {
    const a = D.active; if (!a) return false; const P = R.player, F = flags(), back = (F && F.dgReturn) || null;
    for (const e of R.ents.slice()) if (e.dgRun === a.n || e.dgOwn || a.doors.includes(e) || e === a.chest || e.dg != null) R.remove(e);
    if (R.world) { R.world.populate = a.prevPop === undefined ? true : a.prevPop; if (a.prevBlocked) R.world.blocked = a.prevBlocked; R.world.suspend = false; R.world.inDungeon = null; }
    narrow(a); if (P && back) { P.x = back.x; P.y = back.y; P.vx = P.vy = 0; R.cam.x = P.x; R.cam.y = P.y;
      if (R.world) { try { const rg = R.world.regionAt && R.world.regionAt(P.x, P.y); R.world.cur = rg ? rg.id : a.prevCur; R.world.lastGood = { x: P.x, y: P.y }; } catch (e) {} }
      for (const e of R.ents) if (e.kind === 'companion' && !e.dead) { e.x = back.x - 30 + R.rng() * 60; e.y = back.y + 24; } }
    if (F) delete F.dgReturn;
    D.active = null; bar(false); hideLeave();
    const fail = !!(o && o.fail); R.bus.emit('dungeon', a.id, fail ? 'fail' : 'leave', { cleared: a.cleared, time: Math.round(R.t - a.started) });
    if (fail && o.why) R.ui.toast(o.why, '#e14b4b'); R.save();
    return true;
  };

  /* ---- update ---- */
  let barT = 0, interactT = 0, booted = false, portalT = 0;
  const alive = list => list.filter(e => !e.dead).length;
  const tick = dt => {
    const P = R.player;
    if (!booted && P && R.state) { booted = true; const F = flags(); if (F && F.dgReturn && !D.active) { P.x = F.dgReturn.x; P.y = F.dgReturn.y; delete F.dgReturn; } placePortals(); }
    // the overworld portals are re-placed every 2 s outside a run: a new hero (R.ents reset) or a leave (dgOwn entities removed) would lose them
    if (!D.active) { portalT -= dt; if (portalT <= 0) { portalT = 2; try { placePortals(); } catch (e) {} } }
    if (P && !D.active && R.input && R.input.pressed && R.ui.cur == null) { interactT -= dt; if (interactT <= 0) { let hit = false; try { hit = R.input.pressed('interact'); } catch (e) {}
      if (hit) { const pt = R.ents.find(e => e.kind === 'portal' && e.dgOwn && !e.dead && Math.hypot(e.x - P.x, e.y - P.y) <= e.r + 30); if (pt) { interactT = 0.6; D.sheet(pt.dg); } } } }
    const a = D.active; if (!a || !P) return;
    a.timeLeft -= dt; if (a.timeLeft <= 0) { D.leave({ fail: true, why: 'Time is up' }); return; }
    if (a.leaveT > 0) { a.leaveT -= dt; leaveBtn(a); if (a.leaveT <= 0) { D.leave(); return; } }
    if (D.blocked(P.x, P.y)) { P.x = a.last.x; P.y = a.last.y; } else { a.last.x = P.x; a.last.y = P.y; }
    for (let i = 0; i < 3; i++) for (const m of a.mobs[i]) if (!m.dead) { const r = ROOMS[i]; m.x = R.clamp(m.x, r.x + 12, r.x + r.w - 12); m.y = R.clamp(m.y, r.y + 12, r.y + r.h - 12); }
    const ri = ROOMS.findIndex(r => inR(r, P.x, P.y));
    if (ri > a.room && a.doors[a.room] && a.doors[a.room].open) { a.room = ri; a.wave = 0; a.waveT = WAVE_GAP * 0.5; a.roomStarted[ri] = true; R.bus.emit('dungeon', a.id, 'room', { room: ri }); R.ui.toast('Room ' + (ri + 1) + ' / 3', '#f3e7c4'); }
    if (a.roomStarted[a.room] && !a.cleared) {
      const left = alive(a.mobs[a.room]);
      if (a.wave < 3 && left === 0) { a.waveT -= dt; if (a.waveT <= 0) spawnWave(a); }
      else if (a.wave >= 3 && left === 0) {
        if (a.room < 2) { const d = a.doors[a.room]; if (d && !d.open) { d.open = true; d.name = 'Open door'; R.ui.toast('The door opens', '#9be7ff'); R.bus.emit('dungeon', a.id, 'door', { room: a.room }); if (R.sfx && R.sfx.play) { try { R.sfx.play('dg_door', 0.7); } catch (e) {} } } }
        else if (!a.boss) { a.waveT -= dt; if (a.waveT <= 0) spawnBoss(a); }
        else if (a.boss.dead) spawnChest(a);
      }
    }
    barT -= dt; if (barT <= 0) { barT = 0.25; barText(a); }
  };

  /* ---- DOM: banner, leave prompt, entry sheet ---- */
  const $ = id => document.getElementById(id);
  const bar = on => { let b = $('dgbar'); if (!b) { b = document.createElement('div'); b.id = 'dgbar'; ($('ui') || document.body).appendChild(b); } b.classList.toggle('on', !!on); if (on) barText(D.active); };
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const barText = a => { const b = $('dgbar'); if (!b || !a) return; const left = a.cleared ? 0 : alive(a.mobs[a.room]);
    const what = a.cleared ? 'cleared' : a.boss && !a.boss.dead ? a.boss.name : left + (left === 1 ? ' enemy left' : ' enemies left');
    b.innerHTML = '<b></b> · Room ' + (a.room + 1) + ' / 3 · <span class="n"></span> · <span class="t' + (a.timeLeft < 60 ? ' low' : '') + '"></span>';
    b.querySelector('b').textContent = a.def.name; b.querySelector('.n').textContent = what; b.querySelector('.t').textContent = mmss(a.timeLeft); };
  const showLeave = a => { let d = $('dgleave'); if (!d) { d = document.createElement('div'); d.id = 'dgleave'; ($('ui') || document.body).appendChild(d); }
    d.innerHTML = '<div class="h">Dungeon cleared</div><div class="s">Take the chest. The portal closes in <span class="t"></span> s.</div><button class="pri" id="dgleavebtn">LEAVE</button>';
    d.querySelector('#dgleavebtn').onclick = () => D.leave(); d.classList.add('on'); leaveBtn(a); };
  const leaveBtn = a => { const d = $('dgleave'); if (!d) return; const t = d.querySelector('.t'); if (t) t.textContent = Math.max(0, Math.ceil(a.leaveT)); const b = d.querySelector('#dgleavebtn'); if (b) b.textContent = 'LEAVE (' + Math.max(0, Math.ceil(a.leaveT)) + ')'; };
  const hideLeave = () => { const d = $('dgleave'); if (d) d.classList.remove('on'); };
  D.sheet = id => { if (DG[id] && !D.active) R.ui.open('dungeon', id); };
  R.screens.dungeon = {
    open: (id, el) => { const def = DG[id]; if (!def) { R.ui.close(); return; } const c = D.canEnter(id); const p = R.state && R.state.p; const pl = p ? p.lvl : 0; const under = pl && pl < def.lvl - 3;
      el.innerHTML = '<div class="dgsheet"><div class="k">Dungeon · ' + def.place + '</div><h2></h2><p class="line"></p>' +
        '<div class="row"><div class="cell"><div class="v' + (under ? ' bad' : '') + '">' + def.lvl + '</div><div class="l">level' + (pl ? ' · you ' + pl : '') + '</div></div>' +
        '<div class="cell"><div class="v">3</div><div class="l">rooms · 1 boss</div></div><div class="cell"><div class="v">10:00</div><div class="l">time</div></div></div>' +
        '<div class="gem' + (c.firstClear ? '' : ' done') + '">Daily first clear: <b>+' + def.gems + ' gems</b>' + (c.firstClear ? '' : ' · claimed') + '</div>' +
        '<div class="runs">Runs today <b>' + c.runs + ' / ' + c.max + '</b></div>' +
        '<button class="pri" id="dgenter"' + (c.ok ? '' : ' disabled') + '>' + (c.ok ? 'ENTER' : c.reason.toUpperCase()) + '</button><button class="ghost" id="dgback">Not now</button></div>';
      el.querySelector('h2').textContent = def.name; el.querySelector('.line').textContent = def.line;
      el.querySelector('#dgenter').onclick = () => { R.ui.close(); D.enter(id); }; el.querySelector('#dgback').onclick = () => R.ui.close(); },
    close: () => {}
  };
  const portalId = e => ['dg', 'dungeon', 'poi', 'pid', 'key', 'type', 'id', 'name'].map(k => e && e[k]).find(v => typeof v === 'string' && DG[v]);
  R.bus.on('interact', e => { if (e && e.kind === 'portal' && !D.active) { const id = portalId(e); if (id) D.sheet(id); } });
  R.bus.on('death', () => { if (D.active) D.leave({ fail: true, why: 'You fell in ' + D.active.def.name }); });

  /* ---- portals from the world's POIs (if A07 placed them and nobody spawned an entity there) ---- */
  const placePortals = () => {
    const W = R.data.world, P0 = W && W.pois; if (!P0) return;
    const list = Array.isArray(P0) ? P0 : Object.entries(P0).map(([k, v]) => Object.assign({ id: k }, v));
    for (const p of list) { const id = p.id || p.key; if (!DG[id] || p.x == null) continue;
      if (R.ents.some(e => e.kind === 'portal' && !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 80)) continue;
      R.spawn({ kind: 'portal', dg: id, poi: id, x: p.x, y: p.y, r: 30, team: 2, dgOwn: true, name: DG[id].name, interact: true }); }
  };

  /* ---- drawing: floor (order 5, under everything), walls + doors + torches + portals (order 59, over entities, under vfx) ---- */
  const h2 = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
  const sRect = r => { const a = R.w2s(r.x, r.y); return { x: a.x, y: a.y, w: r.w * R.cam.z, h: r.h * R.cam.z }; };
  const drawFloor = ctx => {
    const a = D.active; if (!a || a.floor3d) return;   /* the 3D build has its stone plane (floor3d); this is the 2D fallback */ ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, R.vw, R.vh);
    for (const r of ROOMS.concat(HALLS)) { const s = sRect(r); ctx.fillStyle = a.def.floor; ctx.fillRect(s.x, s.y, s.w, s.h);
      const T = 40 * R.cam.z; for (let gx = r.x; gx < r.x + r.w; gx += 40) for (let gy = r.y; gy < r.y + r.h; gy += 40) { const q = R.w2s(gx, gy), v = h2(gx, gy); ctx.fillStyle = 'rgba(255,255,255,' + (0.03 + v * 0.06).toFixed(3) + ')'; ctx.fillRect(q.x + 1, q.y + 1, Math.min(T, (r.x + r.w - gx) * R.cam.z) - 2, Math.min(T, (r.y + r.h - gy) * R.cam.z) - 2); }
      const g = ctx.createRadialGradient(s.x + s.w / 2, s.y + s.h / 2, s.h * 0.3, s.x + s.w / 2, s.y + s.h / 2, s.w * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w, s.h); }
    ctx.restore();
  };
  const torch = (ctx, x, y, col, t) => { const s = R.w2s(x, y), z = R.cam.z, f = 0.85 + 0.15 * Math.sin(t * 9 + x), rr = 70 * z * f;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, rr); g.addColorStop(0, col.replace(')', ',.55)').replace('rgb', 'rgba')); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(s.x - rr, s.y - rr, rr * 2, rr * 2); ctx.restore();
    ctx.fillStyle = '#4a3522'; ctx.fillRect(s.x - 2 * z, s.y, 4 * z, 14 * z); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4 * z, 4 * z, (7 + 2 * f) * z, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(s.x, s.y - 3 * z, 1.8 * z, 0, 7); ctx.fill(); };
  const hex2rgb = h => 'rgb(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16) + ')';
  const drawWalls = ctx => {
    const a = D.active;
    if (!a) { for (const e of R.ents) if (e.kind === 'portal' && e.dgOwn && !e.dead) drawPortal(ctx, e); return; }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, R.vw, R.vh); for (const r of ROOMS.concat(HALLS)) { const s = sRect(r); ctx.rect(s.x, s.y, s.w, s.h); } ctx.fillStyle = a.def.wall; ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; for (const r of ROOMS.concat(HALLS)) { const s = sRect(r); ctx.strokeRect(s.x, s.y, s.w, s.h); }
    const col = hex2rgb(a.def.torch); for (const r of ROOMS) { torch(ctx, r.x + 14, r.y + 36, col, R.t); torch(ctx, r.x + r.w - 14, r.y + 36, col, R.t); torch(ctx, r.x + 14, r.y + r.h - 30, col, R.t); torch(ctx, r.x + r.w - 14, r.y + r.h - 30, col, R.t); }
    for (let i = 0; i < DOORS.length; i++) { const d = a.doors[i], H = HALLS[i], z = R.cam.z, s = R.w2s(H.x, DOORS[i].y); if (!d) continue;
      if (!d.open) { ctx.fillStyle = '#2a2d36'; ctx.fillRect(s.x, s.y - 8 * z, H.w * z, 16 * z); ctx.fillStyle = '#5a6070'; for (let k = 6; k < H.w; k += 10) ctx.fillRect(s.x + k * z, s.y - 8 * z, 3 * z, 16 * z); ctx.fillStyle = '#e3b661'; ctx.fillRect(s.x + (H.w / 2 - 4) * z, s.y - 3 * z, 8 * z, 6 * z); }
      else { ctx.fillStyle = '#3b3326'; ctx.fillRect(s.x - 4 * z, s.y - 10 * z, 6 * z, 20 * z); ctx.fillRect(s.x + (H.w - 2) * z, s.y - 10 * z, 6 * z, 20 * z); } }
    if (a.chest && a.chest.dgOwn && !a.chest.dead) { const s = R.w2s(a.chest.x, a.chest.y), z = R.cam.z; ctx.fillStyle = '#6b4a1e'; ctx.fillRect(s.x - 14 * z, s.y - 10 * z, 28 * z, 20 * z); ctx.fillStyle = '#e3b661'; ctx.fillRect(s.x - 14 * z, s.y - 2 * z, 28 * z, 3 * z); ctx.fillRect(s.x - 3 * z, s.y - 6 * z, 6 * z, 10 * z); }
    ctx.restore();
  };
  const drawPortal = (ctx, e) => { const s = R.w2s(e.x, e.y), z = R.cam.z; if (s.x < -80 || s.y < -80 || s.x > R.vw + 80 || s.y > R.vh + 80) return; const def = DG[e.dg], col = def ? def.torch : '#9be7ff', t = R.t;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(s.x, s.y - 14 * z, 2, s.x, s.y - 14 * z, 40 * z); g.addColorStop(0, hex2rgb(col).replace('rgb', 'rgba').replace(')', ',.45)')); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(s.x - 40 * z, s.y - 54 * z, 80 * z, 80 * z); ctx.restore();
    ctx.save(); ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 6 * z; ctx.beginPath(); ctx.ellipse(s.x, s.y - 16 * z, 16 * z, 24 * z, 0, Math.PI, 2 * Math.PI); ctx.lineTo(s.x + 16 * z, s.y + 4 * z); ctx.moveTo(s.x - 16 * z, s.y - 16 * z); ctx.lineTo(s.x - 16 * z, s.y + 4 * z); ctx.stroke();
    ctx.fillStyle = col; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3 + e.x); ctx.beginPath(); ctx.ellipse(s.x, s.y - 14 * z, 10 * z, 18 * z, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.font = '700 ' + Math.round(11 * z) + 'px Cinzel,Georgia,serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f3e7c4'; ctx.fillText(e.name || 'Dungeon', s.x, s.y + 18 * z); ctx.restore(); };

  R.addSys('dungeons', { order: 5, update: tick, draw: drawFloor });
  R.addSys('dungeonsFx', { order: 59, draw: drawWalls });
})();
