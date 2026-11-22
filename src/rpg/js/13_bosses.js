/* HOLDOR RPG — bosses (A09). R.data.bosses: nine region bosses that gate progress; the boss system (phases, moves,
   telegraphs drawn in world space by the renderer through R.boss.drawTelegraphs(ctx)), the boss bar (#bossbar) and R.boss.
   Soft dependencies only: R.hit / R.near / R.world.slide / R.spawnMob / R.items.roll / R.loot / R.fx / R.sfx are used when present.
   Every random choice goes through R.rng, so a boss fight is deterministic for a seed. */
(function () {
  const D = R.data = R.data || {};
  /* ---- stats when R.mobs is absent: a boss has 12× a mob's health of its level ---- */
  const mobHp = l => 60 + 14 * l, mobAtk = l => 12 + 3.2 * l;
  const hpFor = (sprite, lvl) => { const m = R.mobs && R.mobs.statsAt && R.mobs.statsAt(sprite, lvl); return Math.round(((m && m.hp) || mobHp(lvl)) * 12); };
  const atkFor = (sprite, lvl) => { const m = R.mobs && R.mobs.statsAt && R.mobs.statsAt(sprite, lvl); return Math.round((m && m.atk) || mobAtk(lvl)); };
  /* ---- the nine bosses. poi: the world data's place id (its position wins when it exists); x,y: the fall-back spot in world units
     (map art px × 6). gate: the region flag the first kill sets ('gate:<region>'); the world data's own gates (boss: id) are honoured too. ---- */
  const PH = (a, b, c) => [{ at: 1.0, moves: a }, { at: 0.6, moves: b }, { at: 0.3, moves: c }];
  D.bosses = [
    { id: 'boss_kingswood', name: 'Varrik Hollowcrown', title: 'Wight Chieftain of the Kingswood', sprite: 'chief', lvl: 10, region: 'crownlands', poi: 'kingswood', x: 4824, y: 8356, scale: 1.9, spd: 115,
      adds: ['crypt', 'skin'], phases: PH(['slam', 'summon'], ['slam', 'summon', 'roar'], ['slam', 'roar', 'summon']), gate: 'riverlands' },
    { id: 'boss_iron', name: 'Dagmer Saltjaw', title: 'The Drowned Captain', sprite: 'skin', lvl: 12, region: 'ironislands', poi: 'old_wyk', x: 1440, y: 6144, scale: 2.2, spd: 105,
      adds: ['crypt', 'crawler'], phases: PH(['volley', 'charge'], ['volley', 'charge', 'summon'], ['charge', 'summon', 'volley']), gate: 'riverlands' },
    { id: 'boss_dorne', name: 'Oryn Sandscar', title: 'Warlord of the Red Mountains', sprite: 'outrider', lvl: 14, region: 'dorne', poi: 'princes_pass', x: 4320, y: 10322, scale: 1.8, spd: 150,
      adds: ['spear', 'archer'], phases: PH(['charge', 'volley'], ['charge', 'volley', 'heal'], ['charge', 'heal', 'volley']), gate: 'reach' },
    { id: 'boss_vale', name: 'Bragg Skullbreaker', title: 'Mountain Clan Lord of the Vale', sprite: 'thenn', lvl: 20, region: 'vale', poi: 'bloody_gate', x: 5040, y: 6144, scale: 2.0, spd: 120,
      adds: ['axe', 'archer'], phases: PH(['charge', 'slam'], ['charge', 'slam', 'roar'], ['slam', 'roar', 'summon']), gate: 'vale' },
    { id: 'boss_neck', name: 'Harrag Mirebound', title: 'Wight of the Neck', sprite: 'necro', lvl: 25, region: 'riverlands', poi: 'moat_cailin', x: 3600, y: 5284, scale: 2.0, spd: 100,
      adds: ['crawler', 'crypt'], phases: PH(['summon', 'volley'], ['frost', 'summon', 'volley'], ['frost', 'heal', 'summon']), gate: 'north', unlocks: 'ned' },
    { id: 'boss_north', name: 'Gorm Hillcrusher', title: 'Giant of the Gift', sprite: 'giant', lvl: 32, region: 'north', poi: 'queenscrown', x: 3744, y: 3072, scale: 2.6, spd: 110,
      adds: ['axe', 'hound'], phases: PH(['slam', 'charge'], ['slam', 'charge', 'roar'], ['slam', 'roar', 'charge']), gate: 'wall', unlocks: 'arya' },
    { id: 'boss_wall', name: 'Isvarr Hoarfrost', title: 'White Walker Lieutenant', sprite: 'lord', lvl: 40, region: 'wall', poi: 'nightfort', x: 3744, y: 2458, scale: 2.1, spd: 120,
      adds: ['crypt', 'skin', 'wraith'], phases: PH(['frost', 'volley'], ['frost', 'volley', 'summon'], ['summon', 'frost', 'volley']), gate: 'beyond', unlocks: 'jon' },
    { id: 'boss_beyond', name: 'Skarrok Boneheap', title: 'Reaver of Bones', sprite: 'chief', lvl: 46, region: 'beyond', poi: 'fist_of_first_men', x: 3600, y: 1597, scale: 2.2, spd: 130,
      adds: ['axe', 'spear', 'mammoth'], phases: PH(['charge', 'volley'], ['charge', 'roar', 'volley'], ['summon', 'charge', 'roar']), gate: 'winter' },
    { id: 'boss_winter', name: 'The Pale Herald', title: 'Voice of the Long Night', sprite: 'king', lvl: 55, region: 'winter', poi: 'heart_of_winter', x: 3240, y: 614, scale: 2.5, spd: 125,
      adds: ['walker', 'wraith', 'shade'], phases: PH(['frost', 'volley'], ['frost', 'summon', 'slam'], ['slam', 'roar', 'summon', 'heal']), gate: 'dawn', unlocks: 'dany' }
  ]; /* unlocks: the champion (hero) a kill unlocks through R.heroes.unlock — Rare / Epic / Legendary ids by region; the integrator adjusts */
  for (const b of D.bosses) { b.moves = [...new Set(b.phases.flatMap(p => p.moves))]; b.hp = hpFor(b.sprite, b.lvl); b.atk = atkFor(b.sprite, b.lvl); b.def = Math.round(4 + 1.4 * b.lvl); }
  const byId = {}; for (const b of D.bosses) byId[b.id] = b;

  /* ---- tuning ---- */
  const SEAT_MIN = 1100, APPEAR_R = 1000, VANISH_R = 1800, MAX_SCALE = 2.0;   // a boss shows up only when the hero is near; its billboard ≤ 2× a common mob
  const ENGAGE = 600, LEASH = 950, RESPAWN = 600, MOVE_CD = [3.6, 2.9, 2.2], BASIC_CD = 1.6, RESET_AFTER = 5;
  const M = { /* move: windup seconds, then an effect */
    slam: { wind: 1.0, r: 120 }, charge: { wind: 0.8, w: 72, dash: 0.35 }, summon: { wind: 0.9 }, volley: { wind: 0.8, r0: 90, r1: 320, half: 0.61 },
    frost: { wind: 0.6, r: 150, last: 4 }, roar: { wind: 0.5, r: 160, stun: 0.8 }, heal: { wind: 0, last: 3 } };

  const B = R.boss = { list: D.bosses, get: id => byId[id], live: {}, deadAt: {}, cur: null, auto: true, telegraphs: [], fields: [], drawn: 0,
    stats: { tele: 0, moves: 0, hits: 0 }, log: [], extDraw: false };
  const tgtOk = e => !e.dead && e.team === 0 && (e.kind === 'player' || e.kind === 'companion') && e.hp > 0;
  const near = (x, y, r, f) => R.near ? R.near(x, y, r, f) : R.ents.filter(e => !e.dead && (!f || f(e)) && (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r);
  const rnd = () => R.rng();
  const pick = a => a[Math.floor(rnd() * a.length) % a.length];
  /* world progress belongs to the account (save v2: R.state.acc.world); the v1 save keeps it on R.state.p */
  const world = () => R.state && (R.state.acc && R.state.acc.world ? R.state.acc.world : R.state.p);
  const flags = () => { const w = world(); return w && (w.flags = w.flags || {}); };

  /* ---- damage through the combat API when it exists ---- */
  const dmg = (src, tgt, n, o) => {
    o = o || {}; B.stats.hits++;
    if (R.hit) { R.hit(src, tgt, Math.round(n), o); }
    else { const d = Math.max(1, Math.round(n - (tgt.def || 0) * 0.5)); tgt.hp -= d; tgt.lastHitBy = src; if (o.stun) tgt.status.stun = Math.max(tgt.status.stun || 0, o.stun); R.bus.emit('hit', { src, tgt, dmg: d, crit: false }); if (tgt.hp <= 0) R.kill(tgt); }
    if (o.stun && tgt.status && !(tgt.status.stun >= o.stun)) tgt.status.stun = o.stun;
    if (o.knock && tgt.kind !== 'boss') { const dx = tgt.x - src.x, dy = tgt.y - src.y, l = Math.hypot(dx, dy) || 1; moveTo(tgt, tgt.x + dx / l * o.knock, tgt.y + dy / l * o.knock); }
  };
  /* movement: the world's slide when present (it keeps entities out of sea and mountains), else its blocked test, else free */
  const moveTo = (e, nx, ny) => {
    const W = R.world;
    if (W && W.slide) { W.slide(e, nx - e.x, ny - e.y); return; }   // 10_world's entity form: slide(e, dx, dy) moves e by a DELTA in place
    if (W && W.blocked) { if (!W.blocked(nx, ny)) { e.x = nx; e.y = ny; } else if (!W.blocked(nx, e.y)) e.x = nx; else if (!W.blocked(e.x, ny)) e.y = ny; return; }
    e.x = nx; e.y = ny;
  };
  /* a boss stands at its anchor POI, but never within SEAT_MIN of a house seat or the start (the hero must not meet one at the gate) */
  const seats = () => { const W = D.world || {}; const P = W.pois ? (Array.isArray(W.pois) ? W.pois : Object.values(W.pois)) : []; const out = P.filter(q => q && q.seat && typeof q.x === 'number').map(q => ({ x: q.x, y: q.y }));
    const H = D.houses || {}; for (const h in H) { let st = H[h] && H[h].seat; if (typeof st === 'string') st = P.find(q => q && q.id === st); if (st && typeof st.x === 'number') out.push({ x: st.x, y: st.y }); }
    if (W.start && typeof W.start.x === 'number') out.push({ x: W.start.x, y: W.start.y }); return out; };
  const awayFromSeats = (x, y) => { for (let k = 0; k < 4; k++) { let moved = false; for (const q of seats()) { const dx = x - q.x, dy = y - q.y, d = Math.hypot(dx, dy); if (d >= SEAT_MIN) continue;
      const ux = d > 1 ? dx / d : 0, uy = d > 1 ? dy / d : -1; x = q.x + ux * (SEAT_MIN + 10); y = q.y + uy * (SEAT_MIN + 10); moved = true; } if (!moved) break; }
    return { x: R.clamp(x, 0, R.W || 7200), y: R.clamp(y, 0, R.H || 12288) }; };
  const spotOf = b => { const P = D.world && D.world.pois; const p = P && (Array.isArray(P) ? P.find(q => q.id === b.poi) : P[b.poi]); const s = p && typeof p.x === 'number' ? { x: p.x, y: p.y } : { x: b.x, y: b.y }; return awayFromSeats(s.x, s.y); };
  const bossXp = L => { const Bb = R.data.balance; try { if (Bb && Bb.mob && typeof Bb.mob.bossXp === 'function') { const v = Bb.mob.bossXp(L); if (v > 0) return Math.round(v); } } catch (x) {} return Math.round(60 + 20 * L); };
  B.spotOf = id => spotOf(typeof id === 'string' ? byId[id] : id);
  const tele = (t) => { t.t0 = R.t; t.t1 = R.t + t.dur; B.telegraphs.push(t); B.stats.tele++; return t; };

  /* ---- spawn / despawn ---- */
  B.spawn = id => {
    const b = byId[id]; if (!b) { console.warn('no boss', id); return null; }
    const old = B.live[id]; if (old && !old.dead && R.ents.includes(old)) return old;
    const s = spotOf(b);
    const sc = Math.min(MAX_SCALE, b.scale);
    const e = R.spawn({ kind: 'boss', type: b.sprite, sprite: b.sprite, scale: sc, size: sc, name: b.name, title: b.title, lvl: b.lvl, team: 1, x: s.x, y: s.y, r: Math.round(14 * sc), face: -1,
      hp: b.hp, hpMax: b.hp, atk: b.atk, def: b.def, spd: b.spd, boss: true, xp: bossXp(b.lvl),
      ai: { boss: id, st: 'idle', phase: 0, home: { x: s.x, y: s.y }, nextMove: 0, nextBasic: 0, act: null, last: null, lostT: 0, adds: [] } });
    B.live[id] = e; delete B.deadAt[id]; R.bus.emit('boss', id, 'spawn'); return e;
  };
  B.despawn = id => { const e = B.live[id]; if (e) { R.remove(e); delete B.live[id]; if (B.cur === e) B.disengage(); } };
  B.spawnAll = () => { for (const b of D.bosses) if (!(b.id in B.deadAt)) B.spawn(b.id); };
  const ensure = () => { const pl = R.player; for (const b of D.bosses) { const e = B.live[b.id]; const sp = spotOf(b); const far = pl ? Math.hypot(sp.x - pl.x, sp.y - pl.y) : 0;
      if (e && !e.dead && R.ents.includes(e)) { if (pl && B.cur !== e && far > VANISH_R && Math.hypot(e.x - pl.x, e.y - pl.y) > VANISH_R) B.despawn(b.id); continue; }
      if (pl && far > APPEAR_R) continue;
      const d = B.deadAt[b.id]; if (d == null) { if (!e || !R.ents.includes(e)) B.spawn(b.id); } else if (R.t - d >= RESPAWN) B.spawn(b.id); } };

  /* ---- the boss bar ---- */
  let bar = null, barV = { hp: -1, id: '' };
  const BAR_HTML = '<div class="bb-head"><b class="bb-name"></b><span class="bb-title"></span></div><div class="bb-bar"><div class="bb-fill"></div><div class="bb-ticks"></div></div><div class="bb-hp"></div>';
  /* the HUD (A25) may provide an empty <div id="bossbar"> slot: fill it once with the bar's parts */
  const barEl = () => { if (bar && bar.isConnected && bar.querySelector('.bb-name')) return bar; bar = document.getElementById('bossbar');
    if (bar) { if (!bar.querySelector('.bb-name')) bar.innerHTML = BAR_HTML; return bar; }
    bar = document.createElement('div'); bar.id = 'bossbar'; bar.innerHTML = BAR_HTML;
    (document.getElementById('bossslot') || document.getElementById('ui') || document.body).appendChild(bar); return bar; };
  B.engage = e => { if (!e || e.dead) return; if (B.cur !== e) { B.cur = e; barV.id = ''; R.bus.emit('boss', e.ai.boss, 'engage'); if (R.sfx && R.sfx.play) R.sfx.play('boss_drums', 0.8); } const el = barEl(); el.classList.add('on'); barDraw(e, true); };
  B.disengage = () => { if (!B.cur) return; const e = B.cur; B.cur = null; const el = barEl(); el.classList.remove('on'); R.bus.emit('boss', e.ai.boss, 'disengage'); };
  const barDraw = (e, force) => {
    const el = barEl(); const b = byId[e.ai.boss];
    if (force || barV.id !== b.id) { barV.id = b.id; el.querySelector('.bb-name').textContent = b.name; el.querySelector('.bb-title').textContent = b.title + ' · Lv ' + b.lvl;
      el.querySelector('.bb-ticks').innerHTML = b.phases.slice(1).map(p => '<i style="left:' + (p.at * 100) + '%"></i>').join(''); el.dataset.boss = b.id; }
    const hp = Math.max(0, Math.round(e.hp)); if (force || hp !== barV.hp) { barV.hp = hp; el.querySelector('.bb-fill').style.width = (100 * hp / e.hpMax).toFixed(1) + '%'; el.querySelector('.bb-hp').textContent = hp + ' / ' + e.hpMax; el.dataset.phase = e.ai.phase; }
  };

  /* ---- death: progress, the gate, the loot, the respawn timer ---- */
  const onDead = (e, by) => {
    const id = e.ai.boss, b = byId[id]; if (e.ai.done) return; e.ai.done = true; e.ai.act = null;
    for (const a of e.ai.adds) if (!a.dead) R.remove(a); e.ai.adds = [];
    B.deadAt[id] = R.t;
    const st = R.state && R.state.p, W = world(); let opened = false;
    if (st && W) {
      W.bosses = W.bosses || {}; W.bosses[id] = (W.bosses[id] || 0) + 1;
      const F = flags(); F['boss:' + id] = 1;
      if (b.unlocks && R.heroes && R.heroes.unlock) { try { R.heroes.unlock(b.unlocks); } catch (x) { console.error('unlock', x); } }
      const gates = [b.gate].concat((D.world && Array.isArray(D.world.gates) ? D.world.gates : []).filter(g => g && g.boss === id).map(g => g.region || g.id || g.to)).filter(Boolean);
      for (const g of gates) if (!F['gate:' + g]) { F['gate:' + g] = 1; opened = true; }
      const gems = 20 + Math.floor(rnd() * 41);
      if (R.loot && R.loot.gems) R.loot.gems(e.x, e.y, gems); else { st.gems = (st.gems || 0) + gems; R.bus.emit('gems', gems); }
      let item = null; if (R.items && R.items.roll) { try { item = R.items.roll(b.lvl, 3); } catch (x) { item = null; } }
      if (item) { let put = null; if (R.loot && typeof R.loot.spawn === 'function') { try { put = R.loot.spawn('item', e.x, e.y, { item }); } catch (x) { put = null; } }
        if (!put) { st.inv = st.inv || []; st.inv.push(item); R.bus.emit('loot', item); } }
      e.looted = true;   /* this is the boss's whole reward: 32_loot's and 20_combat's 'kill' rolls skip it */
      e.drops = { gems, item };
      if (R.save) R.save();
    }
    R.bus.emit('boss', id, 'dead');
    if (R.ui && R.ui.toast) R.ui.toast(opened ? 'The way is open' : b.name + ' falls', opened ? '#e3b661' : undefined);
    if (R.fx && R.fx.shake) R.fx.shake(10, 0.5);
    if (B.cur === e) setTimeout(() => { if (B.cur === e) B.disengage(); }, 1200);
  };
  R.bus.on('kill', (e, by) => { if (e && e.kind === 'boss' && e.ai && e.ai.boss && byId[e.ai.boss]) onDead(e, by); });

  /* ---- moves ---- */
  const start = (e, name, tgt) => {
    const b = byId[e.ai.boss], m = M[name]; e.ai.last = name; B.stats.moves++; B.log.push(name); if (B.log.length > 64) B.log.shift();
    const a = e.ai.act = { move: name, t0: R.t, t1: R.t + m.wind, stage: 'wind', hit: new Set() }; e.anim = 'attack'; e.animT = 0; e.face = tgt && tgt.x < e.x ? -1 : 1;
    if (name === 'slam') { a.x = e.x; a.y = e.y; tele({ kind: 'circle', x: e.x, y: e.y, r: m.r, dur: m.wind }); }
    else if (name === 'charge') { const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1, L = R.clamp(d + 120, 200, 480); a.dx = dx / d; a.dy = dy / d; a.L = L; a.x0 = e.x; a.y0 = e.y; tele({ kind: 'line', x: e.x, y: e.y, x2: e.x + a.dx * L, y2: e.y + a.dy * L, w: m.w, dur: m.wind }); }
    else if (name === 'volley') { const ang = Math.atan2(tgt.y - e.y, tgt.x - e.x); a.x = e.x; a.y = e.y; a.ang = ang; tele({ kind: 'arc', x: e.x, y: e.y, r0: m.r0, r1: m.r1, a0: ang - m.half, a1: ang + m.half, dur: m.wind }); }
    else if (name === 'frost') { a.x = tgt.x; a.y = tgt.y; tele({ kind: 'circle', x: tgt.x, y: tgt.y, r: m.r, dur: m.wind, col: 'ice' }); }
    else if (name === 'roar') { a.x = e.x; a.y = e.y; tele({ kind: 'ring', x: e.x, y: e.y, r: m.r, dur: m.wind }); }
    else if (name === 'summon') { a.n = 3 + Math.floor(rnd() * 3); tele({ kind: 'ring', x: e.x, y: e.y, r: 80, dur: m.wind, col: 'dark' }); }
    else if (name === 'heal') { a.stage = 'channel'; a.t1 = R.t + m.last; a.tick = R.t; a.heal = true; }
    if (R.sfx && R.sfx.play) R.sfx.play('boss_' + name, 0.7);
    R.bus.emit('bossmove', e.ai.boss, name);
  };
  const spawnAdd = (e, type, x, y) => {
    const b = byId[e.ai.boss]; const lvl = Math.max(1, b.lvl - 3); let a = null;
    if (R.spawnMob) { try { a = R.spawnMob(type, x, y, lvl); } catch (x) { a = null; } }
    if (!a) { const hp = Math.round(mobHp(lvl)); a = R.spawn({ kind: 'mob', type, sprite: type, lvl, team: 1, x, y, r: 14, hp, hpMax: hp, atk: Math.round(mobAtk(lvl) * 0.8), def: Math.round(3 + lvl), spd: 120, ai: { st: 'chase', summoned: e.ai.boss } }); }
    if (a) { a.summonedBy = e.ai.boss; e.ai.adds.push(a); } return a;
  };
  const resolve = (e, a, tgt) => {
    const b = byId[e.ai.boss], m = M[a.move], atk = e.atk;
    if (a.move === 'slam') { for (const t of near(a.x, a.y, m.r, tgtOk)) dmg(e, t, atk * 1.6, { knock: 120, kind: 'phys' }); if (R.fx && R.fx.shake) R.fx.shake(8, 0.35); if (R.fx && R.fx.spawn) R.fx.spawn('slam', a.x, a.y, { r: m.r }); a.stage = 'recover'; a.t1 = R.t + 0.6; }
    else if (a.move === 'charge') { a.stage = 'dash'; a.t1 = R.t + m.dash; a.dashT0 = R.t; }
    else if (a.move === 'volley') { for (const t of near(a.x, a.y, m.r1, tgtOk)) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d < m.r0 - t.r) continue; let da = Math.atan2(t.y - a.y, t.x - a.x) - a.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) <= m.half + 0.08) dmg(e, t, atk * 1.1, { kind: 'phys' }); } if (R.fx && R.fx.spawn) R.fx.spawn('volley', a.x, a.y, { ang: a.ang, r: m.r1 }); a.stage = 'recover'; a.t1 = R.t + 0.5; }
    else if (a.move === 'frost') { B.fields.push({ kind: 'frost', x: a.x, y: a.y, r: m.r, t0: R.t, t1: R.t + m.last, tick: R.t, src: e }); a.stage = 'recover'; a.t1 = R.t + 0.4; }
    else if (a.move === 'roar') { for (const t of near(a.x, a.y, m.r, tgtOk)) dmg(e, t, atk * 0.4, { stun: m.stun, kind: 'phys' }); if (R.fx && R.fx.shake) R.fx.shake(6, 0.4); a.stage = 'recover'; a.t1 = R.t + 0.5; }
    else if (a.move === 'summon') { for (let i = 0; i < a.n; i++) { const ang = rnd() * Math.PI * 2, d = 60 + rnd() * 40; spawnAdd(e, pick(b.adds), e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d); } a.stage = 'recover'; a.t1 = R.t + 0.5; }
  };
  const act = (e, a, tgt, dt) => {
    const m = M[a.move];
    if (a.stage === 'wind') { if (R.t >= a.t1) resolve(e, a, tgt); return; }
    if (a.stage === 'dash') { const k = R.clamp((R.t - a.dashT0) / m.dash, 0, 1); moveTo(e, a.x0 + a.dx * a.L * k, a.y0 + a.dy * a.L * k); e.anim = 'walk';
      for (const t of near(e.x, e.y, e.r + 48, tgtOk)) if (!a.hit.has(t.id)) { a.hit.add(t.id); dmg(e, t, e.atk * 1.4, { knock: 90, kind: 'phys' }); }
      if (k >= 1) { a.stage = 'recover'; a.t1 = R.t + 0.5; } return; }
    if (a.stage === 'channel') { if (R.t - a.tick >= 0.5) { a.tick += 0.5; const h = Math.round(e.hpMax * 0.02); if (e.hp < e.hpMax) { e.hp = Math.min(e.hpMax, e.hp + h); if (R.fx && R.fx.num) R.fx.num(e.x, e.y - 60, '+' + h, '#7fd06a'); } } if (R.t >= a.t1) { e.ai.act = null; e.anim = 'idle'; } return; }
    if (a.stage === 'recover') { e.anim = 'idle'; if (R.t >= a.t1) { e.ai.act = null; e.ai.nextMove = R.t + MOVE_CD[e.ai.phase] + rnd() * 0.8; } }
  };
  const fieldsTick = () => {
    for (let i = B.fields.length - 1; i >= 0; i--) { const f = B.fields[i]; if (R.t >= f.t1) { B.fields.splice(i, 1); continue; }
      const inside = near(f.x, f.y, f.r, tgtOk); for (const t of inside) { t.status = t.status || {}; t.status.slow = Math.max(t.status.slow || 0, 0.5); }
      if (R.t - f.tick >= 0.5) { f.tick += 0.5; for (const t of inside) dmg(f.src, t, f.src.atk * 0.25, { kind: 'ice' }); } }
  };

  /* ---- the system ---- */
  const think = (e, dt) => {
    const b = byId[e.ai.boss], ai = e.ai;
    if (e.dead) { if (e.animT > 2.5 && R.ents.includes(e)) { R.remove(e); if (B.live[b.id] === e) delete B.live[b.id]; } return; }
    if (e.hp <= 0) { R.kill(e); return; }
    /* phases */
    const frac = e.hp / e.hpMax; let ph = 0; for (let i = 1; i < b.phases.length; i++) if (frac <= b.phases[i].at) ph = i;
    if (ph > ai.phase) { /* phases never go back, a heal does not undo one */ ai.phase = ph; R.bus.emit('boss', b.id, ph); if (R.fx && R.fx.shake) R.fx.shake(6, 0.3); if (R.fx && R.fx.num) R.fx.num(e.x, e.y - 80, b.title.toUpperCase(), '#e14b4b', true); if (ai.act && ai.act.stage === 'channel') ai.act = null; ai.nextMove = Math.min(ai.nextMove, R.t + 0.8); }
    if (!R.hit) { const s = e.status; for (const k of ['stun', 'slow']) if (s[k] > 0) s[k] = Math.max(0, s[k] - dt); }
    /* target */
    const cand = near(e.x, e.y, ENGAGE, tgtOk); let tgt = null, best = 1e9;
    for (const t of cand) { const d = Math.hypot(t.x - e.x, t.y - e.y) - (t.kind === 'player' ? 80 : 0); if (d < best) { best = d; tgt = t; } }
    if (tgt && Math.hypot(tgt.x - ai.home.x, tgt.y - ai.home.y) > LEASH) tgt = null;
    if (!tgt) { ai.lostT += dt; ai.act = ai.act && ai.act.stage === 'dash' ? ai.act : null; if (ai.lostT > RESET_AFTER) { if (e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.05 * dt); }
      const dh = Math.hypot(ai.home.x - e.x, ai.home.y - e.y); if (dh > 8) { const k = Math.min(1, e.spd * 0.6 * dt / dh); moveTo(e, e.x + (ai.home.x - e.x) * k, e.y + (ai.home.y - e.y) * k); e.anim = 'walk'; e.face = ai.home.x < e.x ? -1 : 1; } else e.anim = 'idle';
      ai.st = 'idle'; return; }
    ai.lostT = 0; ai.st = 'fight';
    if (e.status.stun > 0) { e.anim = 'hurt'; return; }
    if (ai.act) { act(e, ai.act, tgt, dt); return; }
    const reach = e.r + tgt.r + 24, d = Math.hypot(tgt.x - e.x, tgt.y - e.y);
    e.face = tgt.x < e.x ? -1 : 1;
    if (R.t >= ai.nextMove) { const moves = b.phases[ai.phase].moves; let mv = pick(moves); if (moves.length > 1 && mv === ai.last) mv = moves[(moves.indexOf(mv) + 1) % moves.length];
      if (mv === 'heal' && e.hp > e.hpMax * 0.95) mv = moves.find(x => x !== 'heal') || mv;
      if ((mv === 'slam' || mv === 'roar') && d > 260) { /* close in first */ } else { start(e, mv, tgt); return; } }
    if (d > reach) { const sp = e.spd * (e.status.slow > 0 ? 0.6 : 1), k = Math.min(1, sp * dt / d); moveTo(e, e.x + (tgt.x - e.x) * k, e.y + (tgt.y - e.y) * k); e.anim = 'walk'; }
    else { e.anim = 'idle'; if (R.t >= ai.nextBasic) { ai.nextBasic = R.t + BASIC_CD; e.anim = 'attack'; e.animT = 0; dmg(e, tgt, e.atk, { kind: 'phys' }); } }
  };
  R.addSys('boss', { order: 120,
    update(dt) {
      if (B.auto && R.player && R.state) ensure();
      for (let i = B.telegraphs.length - 1; i >= 0; i--) if (R.t >= B.telegraphs[i].t1 + 0.12) B.telegraphs.splice(i, 1);
      fieldsTick();
      for (const e of R.ents) if (e.kind === 'boss' && e.ai && byId[e.ai.boss]) think(e, dt);
      /* the bar: the nearest live boss within 600 of the player */
      const p = R.player; if (p) { let c = null, best = ENGAGE;
        for (const id in B.live) { const e = B.live[id]; if (!e || e.dead || !R.ents.includes(e)) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < best) { best = d; c = e; } }
        if (c) B.engage(c); else if (B.cur && (B.cur.dead || Math.hypot(B.cur.x - p.x, B.cur.y - p.y) > ENGAGE + 100)) B.disengage();
        if (B.cur) barDraw(B.cur, false); }
    },
    /* the renderer draws telegraphs itself before the entities; this fall-back only runs until it does so once */
    draw(ctx) { if (!B.extDraw) B.drawTelegraphs(ctx, true); }
  });

  /* ---- telegraphs: red translucent shapes that fill as the wind-up completes. Every shape is sampled in WORLD space (points on the
     ground plane) and each point is projected through R.w2s, which is a perspective projection in the 3D build — never a screen radius. ---- */
  const P = (x, y) => R.w2s(x, y, 0);
  const poly = (ctx, pts, fill, stroke) => { if (pts.length < 3) return; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  const ring = (x, y, r, a0, a1, n) => { const o = []; a0 = a0 == null ? 0 : a0; a1 = a1 == null ? Math.PI * 2 : a1; n = n || 28; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r)); } return o; };
  const sector = (x, y, r0, r1, a0, a1) => ring(x, y, r1, a0, a1, 16).concat(ring(x, y, r0, a1, a0, 16));
  B.drawTelegraphs = (ctx, internal) => {
    if (!internal) B.extDraw = true;
    ctx.save(); ctx.lineWidth = 2; ctx.lineJoin = 'round';
    for (const f of B.fields) { const k = 1 - (R.t - f.t0) / (f.t1 - f.t0); poly(ctx, ring(f.x, f.y, f.r), 'rgba(120,190,255,' + (0.14 + 0.12 * k).toFixed(3) + ')', 'rgba(170,220,255,.55)'); B.drawn++; }
    for (const t of B.telegraphs) {
      const k = R.clamp((R.t - t.t0) / (t.t1 - t.t0), 0, 1);
      const base = t.col === 'ice' ? '150,200,255' : t.col === 'dark' ? '120,60,160' : '225,60,60';
      const fill = 'rgba(' + base + ',0.18)', line = 'rgba(' + base + ',0.85)', fill2 = 'rgba(' + base + ',0.3)';
      if (t.kind === 'circle') { poly(ctx, ring(t.x, t.y, t.r), fill, line); if (k > 0.02) poly(ctx, ring(t.x, t.y, t.r * k), fill2); }
      else if (t.kind === 'ring') { poly(ctx, ring(t.x, t.y, t.r), null, line); if (k > 0.02) poly(ctx, ring(t.x, t.y, t.r * k), 'rgba(' + base + ',0.22)'); }
      else if (t.kind === 'line') { const dx = t.x2 - t.x, dy = t.y2 - t.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * t.w / 2, ny = dx / L * t.w / 2;
        poly(ctx, [P(t.x + nx, t.y + ny), P(t.x2 + nx, t.y2 + ny), P(t.x2 - nx, t.y2 - ny), P(t.x - nx, t.y - ny)], fill, line);
        if (k > 0.02) poly(ctx, [P(t.x + nx, t.y + ny), P(t.x + dx * k + nx, t.y + dy * k + ny), P(t.x + dx * k - nx, t.y + dy * k - ny), P(t.x - nx, t.y - ny)], fill2); }
      else if (t.kind === 'arc') { poly(ctx, sector(t.x, t.y, t.r0, t.r1, t.a0, t.a1), fill, line); if (k > 0.02) poly(ctx, sector(t.x, t.y, t.r0, t.r0 + (t.r1 - t.r0) * k, t.a0, t.a1), fill2); }
      B.drawn++;
    }
    for (const id in B.live) { const e = B.live[id]; if (!e || e.dead || !e.ai.act || !e.ai.act.heal) continue; const k = 0.5 + 0.5 * Math.sin(R.t * 8); poly(ctx, ring(e.x, e.y, e.r + 30 + 10 * k), 'rgba(127,208,106,.18)', 'rgba(127,208,106,.7)'); B.drawn++; }
    ctx.restore();
  };
})();
