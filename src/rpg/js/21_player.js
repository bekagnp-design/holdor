/* 21_player.js — the player (A12): camera-relative movement + sprint, the basic attack combo, dodge, potions, stats, xp / levels,
   permadeath, interaction, gold / gems.  System 'player' (order 80).  Everything hangs off R.player (the entity) and R.plr (helpers).
   Owner's decisions (ARCH Addendum 2): the hero IS one of the unlocked champions (R.state.p.hero), the class is derived from the
   champion's type (melee → knight, ranged → ranger, mage → maester), death ends the run (no respawn, no gold loss): the Hall of the
   Fallen gets a line and the death screen (A31) or R.newHero (A01) picks the next hero.  World records live in R.acc().world.
   Soft contracts this file assumes of the other modules (every one guarded, nothing throws when a module is absent):
     R.input.move {x,y} (screen space: up = y −1) · R.input.pressed(n) / down(n) for 'attack' 'dodge' 'potion' 'skill1..3' 'interact' 'sprint'
     R.input.interact = {label, e} | null (set here) · R.input.setPotions(count, cdFrac 0..1)
     R.cam.yaw — the stick is rotated by it: dx = mx·cos − my·sin, dy = mx·sin + my·cos (yaw 0: up = north = −y); R.plr.camDir is the one place to flip
     R.world.slide(x, y, nx, ny, r) → {x,y}  (else R.world.blocked(x,y) with an axis-separated slide)
     R.attack(player, o) with o = {kind:'melee'|'ranged'|'magic', dir:{x,y}, range, arc, dmg (the hero's atk; R.attack multiplies by mult), mult, combo:0..2, knock, splash, arrows, target}
       — when absent the attack is resolved here on top of R.hit(src, tgt, dmg, {knock, kind}); when R.hit is absent too, hp is reduced here.
     R.skills.cast(slot) slot 0..2 · R.data.classes[cls].basic {kind, arc, range, mult, arrows, splash} overrides the defaults below
     R.champs.cls(heroId) → 'knight'|'ranger'|'maester' (else R.data.champs[id].type mapped) · R.champs.statsAt(heroId, lvl) → {hp, atk, def, spd, crit} added to the base
     R.data.balance.xp(L) → xp to the next level · R.data.balance.mobXp(mob) → xp of a kill (else mob.xp, else 6 + 3·lvl)
     R.data.houses[h].seat = poi id | {x,y} · R.data.world.pois (array or map) with {id, type, x, y}
     R.acc() → R.state.acc (else R.state.acc itself; a v1 save falls back to R.state.p) · R.newHero(champId) (A01) after a death without the death screen
     status.stun / status.slow are until-times in game seconds (like cd and inv). */
(function () {
  const SPD = 170, SPRINT = 240, SPRINT_AFTER = 1.5, ATK_T = 0.3, COMBO_W = 0.7, DODGE_T = 0.35, DODGE_D = 170, DODGE_INV = 0.4, DODGE_CD = 1.2,
    POT_CD = 8, POT_T = 2, POT_HEAL = 0.4, COMBAT_T = 3, REGEN = 0.04, NEXT_T = 4, INTERACT_R = 70, AUTOFACE_R = 90, LVL_MAX = 60, KNOCK3 = 28, LUNGE = 44;   // the third swing's knockback stays inside the next swing's reach
  const DEF = {
    knight: { kind: 'melee', arc: 110, range: 60, mult: 1.0, main: 'str', hpK: 1.2, auto: { str: 2, vit: 1 } },
    ranger: { kind: 'ranged', range: 320, mult: 0.8, arrows: 2, main: 'agi', critB: 15, auto: { agi: 2, vit: 1 } },
    maester: { kind: 'magic', range: 260, mult: 0.9, splash: 20, main: 'int', powK: 1.2, auto: { int: 2, vit: 1 } } };
  const TYPE2CLS = { melee: 'knight', tank: 'knight', warrior: 'knight', knight: 'knight', ranged: 'ranger', archer: 'ranger', ranger: 'ranger', mage: 'maester', magic: 'maester', caster: 'maester', support: 'maester', maester: 'maester' };
  const STATS = ['str', 'agi', 'int', 'vit'];
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const P = R.plr = { DEF, TYPE2CLS, KNOCK3, LUNGE, AUTOFACE_R, SPD, SPRINT, ATK_T, COMBO_W, DODGE_T, DODGE_D, DODGE_INV, DODGE_CD, POT_CD, POT_T, POT_HEAL, COMBAT_T, NEXT_T, INTERACT_R, LVL_MAX };
  if (!R.input) R.input = { move: { x: 0, y: 0 }, pressed: () => false, down: () => false, interact: null };   // the joystick module (02) replaces this when present
  const inp = () => R.input || {};
  const pressed = n => { const I = inp(); try { return !!(I.pressed && I.pressed(n)); } catch (e) { return false; } };
  const down = n => { const I = inp(); try { return !!(I.down && I.down(n)); } catch (e) { return false; } };
  const sfx = (n, v) => { try { R.sfx && R.sfx.play && R.sfx.play(n, v); } catch (e) {} };
  const fx = (k, x, y, o) => { try { R.fx && R.fx.spawn && R.fx.spawn(k, x, y, o); } catch (e) {} };
  const fnum = (x, y, t, c, b) => { try { R.fx && R.fx.num && R.fx.num(x, y, t, c, b); } catch (e) {} };
  const toast = (t, c) => { try { R.ui && R.ui.toast && R.ui.toast(t, c); } catch (e) {} };
  const hap = k => { try { if (R.state && R.state.opts && R.state.opts.haptic === 0) return; if (R.haptic) return R.haptic(k);
    const H = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback; if (!H) return;
    if (k === 'success' || k === 'error' || k === 'warning') H.notificationOccurred(k); else H.impactOccurred(k || 'light'); } catch (e) {} };
  const st = () => (R.state && R.state.p) || null;
  const acc = () => { try { if (typeof R.acc === 'function') { const a = R.acc(); if (a) return a; } } catch (e) {} return (R.state && R.state.acc) || null; };
  const world = () => { const a = acc(); if (a && a.world) return a.world; return st() || {}; };          // flags / found / quests / bosses / killed (a v1 save keeps them on p)
  P.acc = acc; P.world = world;
  const setInteract = v => { const I = inp(); try { I.interact = v; } catch (e) {} };

  /* ---- hero → class, curve, places ---- */
  P.clsOf = hero => { if (!hero) return null; try { if (R.champs && typeof R.champs.cls === 'function') { const c = R.champs.cls(hero); if (DEF[c]) return c; } } catch (e) {}
    const C = R.data.champs && R.data.champs[hero]; const t = C && (C.cls || C.type || C.role); return (t && TYPE2CLS[String(t).toLowerCase()]) || null; };
  P.clsName = () => { const p = st(); if (!p) return 'knight'; const c = P.clsOf(p.hero); if (c) p.cls = c; return DEF[p.cls] ? p.cls : 'knight'; };
  P.cls = () => { const c = P.clsName(); const d = DEF[c]; const D = R.data.classes && R.data.classes[c];
    if (!D) return d; const o = Object.assign({}, d, D.basic || D.attack || {}); if (D.main && STATS.includes(D.main)) o.main = D.main; if (D.auto) o.auto = D.auto; return o; };
  P.mods = () => { try { if (R.prog && typeof R.prog.mods === 'function') { const m = R.prog.mods(); if (m && typeof m === 'object') return m; } } catch (e) {} return {}; };
  P.heroStats = (hero, lvl) => { try { if (hero && R.champs && typeof R.champs.statsAt === 'function') { const s = R.champs.statsAt(hero, lvl); if (s && typeof s === 'object') return s; } } catch (e) {} return null; };
  P.xpNext = L => { L = R.clamp(num(L, 1), 1, LVL_MAX); const B = R.data.balance; if (B && typeof B.xp === 'function') { try { const v = B.xp(L); if (num(v, 0) > 0) return Math.round(v); } catch (e) {} } return 80 + 45 * L + 6 * L * L; };
  const pois = () => { const W = R.data.world; const ps = W && W.pois; if (!ps) return []; return Array.isArray(ps) ? ps : Object.keys(ps).map(k => Object.assign({ id: k }, ps[k])); };
  P.poi = id => pois().find(q => q && (q.id === id || q.key === id)) || null;
  const isPt = q => !!q && num(q.x, NaN) === q.x && num(q.y, NaN) === q.y;
  P.seat = () => { const p = st(); const a = acc(); const h = (p && p.house) || (a && a.house); const H = R.data.houses && h && R.data.houses[h]; let s = H && H.seat; if (typeof s === 'string') s = P.poi(s); return isPt(s) ? { x: s.x, y: s.y } : null; };
  P.startPos = () => { const p = st(); if (isPt(p.pos)) return { x: p.pos.x, y: p.pos.y }; return P.seat() || { x: R.W / 2, y: R.H / 2 }; };
  /* the stick is in screen space; the world direction follows the camera yaw */
  P.camDir = (mx, my) => { const yaw = num(R.cam && R.cam.yaw, 0); if (!yaw) return { x: mx, y: my }; const c = Math.cos(yaw), s = Math.sin(yaw); return { x: mx * c - my * s, y: mx * s + my * c }; };

  /* ---- the entity ---- */
  P.attach = e => {
    if (e.recalc) return e;
    e.kind = 'player'; e.team = 0; e.r = e.r || 14; e.ai = null; e.cd = e.cd || {}; e.status = e.status || {}; e.face = e.face || 1;
    e.atkT = 0; e.comboN = 0; e.comboT = -9; e.atkBuf = false; e.dodgeT = 0; e.dodgeCd = 0; e.dvx = 0; e.dvy = 0; e.inv = 0; e.potCd = 0; e.healT = 0; e.healRate = 0;
    e.combatT = -99; e.moveT = 0; e.sprint = false; e.hurtT = 0; e.deathT = 0; e.nextT = 0; e.intT = 0; e.lastHitBy = null;
    e.recalc = () => recalc(e); e.gainXp = (n, from) => gainXp(e, n, from); e.gold = (n, q) => wallet(e, 'gold', n, q); e.gems = (n, q) => wallet(e, 'gems', n, q);
    e.heal = n => heal(e, n); e.spend = (k, n) => spend(e, k, n); e.die = () => die(e);
    e.inCombat = () => R.t - e.combatT < COMBAT_T; e.dodging = () => R.t < e.dodgeT; e.attacking = () => R.t < e.atkT; e.stunned = () => num(e.status && e.status.stun, 0) > R.t;
    return e;
  };
  /* the hero's home region is never gated for his own house (guarded fallback until 10_world's gateOpen knows rg.home): set its gate flag
     quietly, so the gate watcher does not push a new Stark hero out of Winterfell */
  P.homeGate = () => { try { const p = st(), a = acc(); const h = (a && a.house) || (p && p.house); const W = R.data.world; if (!h || !W || !R.world) return false;
    const rs = Array.isArray(W.regions) ? W.regions : Object.values(W.regions || {}); const H = R.data.houses && R.data.houses[h];
    let rg = rs.find(r => r && r.home === h) || (H && H.region && rs.find(r => r && r.id === H.region)); const s = P.seat(); if (!rg && s && typeof R.world.regionAt === 'function') rg = R.world.regionAt(s.x, s.y);
    if (!rg || !rg.gate || (typeof R.world.gateOpen === 'function' && R.world.gateOpen(rg))) return false;
    const S = typeof R.world.store === 'function' ? R.world.store() : world(); if (!S) return false; S.flags = S.flags || {}; S.flags['gate:' + rg.id] = 1; return true; } catch (x) { return false; } };
  P.make = () => { const p = st(); if (!p) return null; P.homeGate(); const pos = P.startPos();
    const e = R.spawn({ kind: 'player', x: pos.x, y: pos.y, r: 14, team: 0, name: p.name || 'You', lvl: num(p.lvl, 1), type: p.hero || p.cls, hp: 1, hpMax: 1 });
    R.player = e; return P.ensure(); };
  P.ensure = () => { const p = st(); if (!p) return null; const e = R.player; if (!e || e.kind !== 'player') return P.make();
    if (!e.recalc) { P.attach(e); recalc(e); e.hp = p.hp > 0 && p.hpV === 2 ? Math.min(p.hp, e.hpMax) : e.hpMax; p.hpV = 2; if (!R.ents.includes(e)) R.ents.push(e); }   // hpV 2: p.hp was written by this module; a fresh hero starts full
    return e; };
  R.makePlayer = R.makePlayer || P.make;

  /* ---- stats ---- */
  P.gearStats = () => { const p = st(); const g = (p && p.gear) || {}; const o = { atk: 0, def: 0, hp: 0, spd: 0, crit: 0, power: 0 };
    for (const k of Object.keys(g)) { let it = g[k]; if (typeof it === 'string' && Array.isArray(p.inv)) it = p.inv.find(q => q && q.id === it); const s = it && it.stats; if (!s) continue; for (const q of Object.keys(o)) o[q] += num(s[q], 0); }
    return o; };
  function recalc(e) {
    const p = st(); if (!p) return e; const a0 = acc(); if (!p.house && a0 && a0.house) p.house = a0.house;   // every reader of R.state.p.house gets the account's house
    const C = P.cls(); const S = p.stats || (p.stats = { str: 5, agi: 5, int: 5, vit: 5 }); const L = p.lvl = R.clamp(num(p.lvl, 1), 1, LVL_MAX); const g = P.gearStats();
    const H = P.heroStats(p.hero, L) || {}; const vit = num(S.vit, 5), main = num(S[C.main || 'str'], 5);
    // the champion line (R.champs.statsAt) is an ABSOLUTE stat line at level L (role × rarity × the reference player): it scales the
    // formula instead of adding to it, so the champion's flavour and the hero's stat points both count; spd is absolute (165/155/150)
    const refOk = R.champs && typeof R.champs.refHp === 'function' && typeof R.champs.refAtk === 'function' && typeof R.champs.refDef === 'function';
    // the companion-era role lines are wide (a support's atk ×0.6, a shooter's hp ×0.7): as a HERO half of the spread counts, clamped,
    // so every champion kills a same-level common in the 4–7 hits of docs/rpg-balance.md and survives the same packs
    const soft = (k, lo, hi) => R.clamp(1 + (k - 1) * 0.5, lo, hi);
    const kHp = refOk && H.hp > 0 ? soft(H.hp / Math.max(1, R.champs.refHp(L)), 0.82, 1.2) : 1, kAtk = refOk && H.atk > 0 ? soft(H.atk / Math.max(1, R.champs.refAtk(L)), 0.85, 1.15) : 1, kDef = refOk && H.def > 0 ? soft(H.def / Math.max(1, R.champs.refDef(L)), 0.82, 1.25) : 1;
    e.statK = { hp: Math.round(kHp * 1000) / 1000, atk: Math.round(kAtk * 1000) / 1000, def: Math.round(kDef * 1000) / 1000 };
    let hpMax = (120 + 18 * L + 6 * vit) * kHp + g.hp + (refOk ? 0 : num(H.hp, 0)); if (C.hpK) hpMax *= C.hpK;
    let power = 1 + 0.012 * num(S.int, 5) + g.power / 100 + num(H.power, 0) / 100; if (C.powK) power *= C.powK;
    e.hpMax = Math.max(1, Math.round(hpMax)); e.atk = Math.round(((10 + 2 * L + 1.5 * main) * kAtk + g.atk + (refOk ? 0 : num(H.atk, 0))) * 10) / 10; e.def = Math.round(((4 + 1.2 * L + 0.6 * vit) * kDef + g.def + (refOk ? 0 : num(H.def, 0))) * 10) / 10;
    e.crit = Math.round((5 + 0.25 * num(S.agi, 5) + g.crit + num(H.crit, 0) + (C.critB || 0)) * 10) / 10; e.power = Math.round(power * 1000) / 1000; e.spd = (H.spd > 0 ? H.spd : SPD) + g.spd;
    /* talents (25_progression, P1): R.prog.mods() → {hpPct, atkPct, defPct, critAdd, spdAdd, regenPct} */
    const M = P.mods(); const pc = k => 1 + num(M[k], 0) / 100;
    e.hpMax = Math.max(1, Math.round(e.hpMax * pc('hpPct'))); e.atk = Math.round(e.atk * pc('atkPct') * 10) / 10; e.def = Math.round(e.def * pc('defPct') * 10) / 10;
    e.crit = Math.round((e.crit + num(M.critAdd, 0)) * 10) / 10; e.spd += num(M.spdAdd, 0); e.regenK = REGEN + num(M.regenPct, 0) / 100;
    e.lvl = L; e.name = p.name || e.name || 'You'; e.hero = p.hero || null; e.type = p.hero || p.cls; e.cls = p.cls; e.main = C.main || 'str';
    if (num(e.hp, NaN) !== e.hp) e.hp = e.hpMax; e.hp = Math.min(e.hp, e.hpMax);
    R.bus.emit('stats', e); return e;
  }
  function spend(e, k, n) { const p = st(); n = num(n, 1); if (!p || !STATS.includes(k) || !(num(p.pts, 0) >= n) || n <= 0) return false; p.stats[k] = num(p.stats[k], 5) + n; p.pts -= n; recalc(e); R.save(); return true; }
  function heal(e, n) { if (e.dead || !(n > 0)) return 0; const b = e.hp; e.hp = Math.min(e.hpMax, e.hp + n); const d = Math.round(e.hp - b); if (d > 0) fnum(e.x, e.y - 30, '+' + d, '#7fd06a'); return d; }

  /* ---- xp / levels ---- */
  function gainXp(e, n, from) {
    const p = st(); n = Math.round(num(n, 0)); if (!p || n <= 0 || e.dead) return 0; if (from && from.xpGiven) return 0; if (from) from.xpGiven = true;
    R.bus.emit('xp', n); fnum(e.x, e.y - 44, '+' + n + ' xp', '#9fb6c9');
    if (p.lvl >= LVL_MAX) { p.xp = 0; return 0; }
    p.xp = num(p.xp, 0) + n; let ups = 0;
    while (p.lvl < LVL_MAX && p.xp >= P.xpNext(p.lvl)) { p.xp -= P.xpNext(p.lvl); p.lvl++; ups++; levelUp(e, p); }
    if (p.lvl >= LVL_MAX) p.xp = 0;
    if (ups) { if (R.screens && R.screens.levelup && R.ui && R.ui.open) R.ui.open('levelup', p.lvl); else toast('LEVEL ' + p.lvl + '!', '#e3b661'); }
    R.save(); return ups;
  }
  function levelUp(e, p) {
    const C = P.cls(); p.stats = p.stats || { str: 5, agi: 5, int: 5, vit: 5 };
    const manual = !!((p.opts && p.opts.manualPts) || (R.state.opts && R.state.opts.manualPts));
    if (manual) p.pts = num(p.pts, 0) + 3; else { const a = C.auto || DEF.knight.auto; for (const k of Object.keys(a)) if (STATS.includes(k)) p.stats[k] = num(p.stats[k], 5) + a[k]; }
    recalc(e); e.hp = e.hpMax; p.hp = e.hp; const a = acc(); if (a) { a.best = a.best || {}; a.best.lvl = Math.max(num(a.best.lvl, 0), p.lvl); }
    sfx('levelup'); fx('levelup', e.x, e.y, { lvl: p.lvl }); hap('success'); R.bus.emit('levelup', p.lvl);
  }

  /* ---- gold / gems ---- */
  const tq = { gold: 0, gems: 0 }; let tT = 0;
  const flushToast = () => { tT = 0; for (const k of ['gold', 'gems']) { const n = tq[k]; tq[k] = 0; if (n) toast((n > 0 ? '+' : '−') + Math.abs(n) + ' ' + k, k === 'gold' ? '#e3b661' : '#7fd0ff'); } };
  function wallet(e, k, n, quiet) {
    const p = st(); if (!p) return false; n = Math.round(num(n, 0)); if (!n) return true;
    const cur = num(p[k], 0); if (n < 0 && cur + n < 0) { if (!quiet) toast('Not enough ' + k, '#e14b4b'); R.bus.emit('refused', k, -n); return false; }
    p[k] = cur + n; R.bus.emit(k, n); if (!quiet) { tq[k] += n; if (!tT) tT = setTimeout(flushToast, 600); } if (n > 0) sfx(k === 'gold' ? 'coin' : 'gem'); R.save(); return true;
  }

  /* ---- combat: targets, damage, the basic attack ---- */
  const isEnemy = t => !!t && !t.dead && t.team === 1 && (t.kind === 'mob' || t.kind === 'boss') && t.hp > 0;
  const enemies = (e, r) => R.near(e.x, e.y, r, isEnemy);
  P.nearestEnemy = (e, r) => { let b = null, bd = Infinity; for (const t of enemies(e, r)) { const d = R.dist(e, t); if (d < bd) { bd = d; b = t; } } return b; };
  function dmg(src, tgt, d, o) {
    if (!tgt || tgt.dead) return 0; src.combatT = R.t; o = o || {};
    if (typeof R.hit === 'function') { try { return R.hit(src, tgt, d, o); } catch (x) { console.error('R.hit', x); } }
    const crit = Math.random() * 100 < num(src.crit, 0); const v = Math.max(1, Math.round(d * 100 / (100 + Math.max(0, num(tgt.def, 0))) * (crit ? 1.6 : 1)));
    tgt.hp -= v; tgt.lastHitBy = src; tgt.combatT = R.t;
    if (o.knock) { const dx = tgt.x - src.x, dy = tgt.y - src.y, L = Math.hypot(dx, dy) || 1; tgt.x += dx / L * o.knock; tgt.y += dy / L * o.knock; }
    fnum(tgt.x, tgt.y - 20, String(v), crit ? '#ffd166' : '#ffffff', crit);
    R.bus.emit('hit', { src, tgt, dmg: v, crit, knock: o.knock || 0, kind: o.kind || 'phys' });
    if (tgt.hp <= 0) R.kill(tgt);
    return v;
  }
  P.resolve = (e, o) => {
    const en = enemies(e, o.range + 40); const hits = [];
    if (o.kind === 'melee') { const cos = Math.cos(num(o.arc, 110) / 2 * Math.PI / 180);
      for (const t of en) { const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy); if (d - (t.r || 0) > o.range) continue; if (d > 1 && (dx * o.dir.x + dy * o.dir.y) / d < cos) continue; hits.push(t); } }
    else { const c = en.filter(t => { const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy); if (d - (t.r || 0) > o.range) return false; if (dx * o.dir.x + dy * o.dir.y < 0) return false; return Math.abs(dx * o.dir.y - dy * o.dir.x) <= (t.r || 0) + 24; }).sort((a, b) => R.dist(e, a) - R.dist(e, b));
      const n = Math.max(1, num(o.arrows, 1)); for (let i = 0; i < n && c.length; i++) hits.push(c[Math.min(i, c.length - 1)]);
      if (o.kind === 'magic' && hits[0] && o.splash > 0) for (const t of en) if (t !== hits[0] && R.dist(t, hits[0]) <= o.splash + (t.r || 0)) hits.push(t); }
    for (const t of hits) dmg(e, t, o.dmg * num(o.mult, 1), { knock: o.knock, kind: o.kind === 'magic' ? 'fire' : 'phys' });
    return hits.length;
  };
  /* mx, my: the WORLD-space move direction (already rotated by the camera) */
  P.attack = (e, mx, my) => {
    const C = P.cls(); const now = R.t;
    e.comboN = now - e.comboT <= COMBO_W ? (e.comboN + 1) % 3 : 0; e.comboT = now; e.atkT = now + ATK_T; e.anim = 'attack'; e.animT = 0; e.combatT = now; e.sprint = false; e.moveT = 0;
    const range = num(C.range, 60), melee = C.kind !== 'ranged' && C.kind !== 'magic'; mx = num(mx, 0); my = num(my, 0); const hasMove = Math.hypot(mx, my) >= 0.08;
    /* auto-face: the swing turns to the nearest enemy in reach (the stick only picks among enemies it points at, else aims the swing) */
    const reachR = melee ? Math.max(AUTOFACE_R, range + 40) : Math.max(AUTOFACE_R, range); let tgt = P.nearestEnemy(e, reachR); let dx = 0, dy = 0;
    if (tgt && hasMove) { let best = null, bs = 0.5; for (const t of enemies(e, reachR)) { const tx = t.x - e.x, ty = t.y - e.y, d = Math.hypot(tx, ty) || 1; const s = (tx * mx + ty * my) / d / Math.hypot(mx, my) - d / (reachR * 4); if (s > bs) { bs = s; best = t; } } if (best) tgt = best; }
    if (tgt) { dx = tgt.x - e.x; dy = tgt.y - e.y; } else if (hasMove) { dx = mx; dy = my; }
    if (melee && tgt) { const gap = Math.hypot(dx, dy) - (tgt.r || 0) - range + 6; if (gap > 0) { const d = Math.hypot(dx, dy) || 1, s = Math.min(LUNGE, gap); moveTo(e, e.x + dx / d * s, e.y + dy / d * s); dx = tgt.x - e.x; dy = tgt.y - e.y; } }   // a short lunge: a tap in reach connects
    let L = Math.hypot(dx, dy); if (L < 1e-6) { dx = e.face || 1; dy = 0; L = 1; } dx /= L; dy /= L; if (Math.abs(dx) > 0.15) e.face = dx < 0 ? -1 : 1;
    const third = e.comboN === 2, mult = num(C.mult, 1) * (third ? 1.4 : 1);
    const o = { kind: melee ? 'melee' : C.kind, dir: { x: dx, y: dy }, range, arc: num(C.arc, 110), dmg: e.atk, mult, combo: e.comboN, knock: third ? KNOCK3 : 0, splash: num(C.splash, 0), arrows: third ? Math.max(1, num(C.arrows, 1)) : 1, target: tgt };
    sfx(melee ? 'swing' : C.kind === 'ranged' ? 'bow' : 'spell'); fx(melee ? 'slash' : C.kind === 'ranged' ? 'arrow' : 'bolt', e.x, e.y, { dir: o.dir, face: e.face, range, src: e, tgt, combo: e.comboN }); hap('light');
    R.bus.emit('attack', e, o);
    if (typeof R.attack === 'function') { try { R.attack(e, o); return o; } catch (x) { console.error('R.attack', x); } }
    P.resolve(e, o); return o;
  };
  P.dodge = (e, mx, my) => {
    if (e.dead || R.t < e.dodgeCd || e.dodging() || e.stunned()) return false;
    let dx = num(mx, 0), dy = num(my, 0), L = Math.hypot(dx, dy); if (L < 0.08) { dx = e.face || 1; dy = 0; L = 1; } dx /= L; dy /= L;
    const v = DODGE_D / DODGE_T; e.dvx = dx * v; e.dvy = dy * v; e.dodgeLeft = DODGE_D; e.dodgeT = R.t + DODGE_T; e.inv = Math.max(num(e.inv, 0), R.t + DODGE_INV); e.dodgeCd = R.t + DODGE_CD; e.atkT = R.t; e.atkBuf = false;
    if (Math.abs(dx) > 0.15) e.face = dx < 0 ? -1 : 1; e.anim = 'walk'; e.animT = 0;
    sfx('dodge'); fx('dash', e.x, e.y, { dir: { x: dx, y: dy } }); hap('light'); R.bus.emit('dodge', e); return true;
  };
  P.potion = e => {
    const p = st(); if (!p || e.dead) return false; p.potions = p.potions || { hp: 0, mana: 0 };
    if (R.t < e.potCd) { toast('Potion not ready'); return false; }
    if (!(p.potions.hp > 0)) { toast('No potions', '#e14b4b'); return false; }
    if (e.hp >= e.hpMax) { toast('Health is full'); return false; }
    p.potions.hp--; e.potCd = R.t + POT_CD; e.healT = R.t + POT_T; e.healRate = e.hpMax * POT_HEAL / POT_T;
    sfx('potion'); fx('heal', e.x, e.y, {}); hap('light'); fnum(e.x, e.y - 30, '+' + Math.round(e.hpMax * POT_HEAL), '#7fd06a', true);
    R.bus.emit('potion', 'hp', p.potions.hp); potionUi(e, p, true); R.save(); return true;
  };
  let potKey = '';
  function potionUi(e, p, force) { const I = inp(); if (typeof I.setPotions !== 'function') return; const n = (p.potions && p.potions.hp) | 0; const frac = R.clamp((e.potCd - R.t) / POT_CD, 0, 1);
    const key = n + ':' + Math.round(frac * 40); if (!force && key === potKey) return; potKey = key; try { I.setPotions(n, frac); } catch (x) {} }

  /* ---- i-frames: a dodging (or dead) player takes nothing, whatever calls R.hit; the hitter is remembered for the Hall ---- */
  /* wrap exactly once: when any function down the .orig chain is ours, someone (24_physics) wrapped after us — leave it, never re-wrap
     (re-wrapping each step made the chain grow until R.hit overflowed the stack) */
  const hasPlrWrap = h => { for (let f = h, n = 0; typeof f === 'function' && n < 64; f = f.orig || f.__orig || f.inner, n++) if (f.plrWrap) return true; return false; };
  P.hitDepth = () => { let n = 0; for (let f = R.hit; typeof f === 'function' && n < 100000; f = f.orig || f.__orig || f.inner) n++; return n; };
  function wrapHit() { const h = R.hit; if (typeof h !== 'function' || h === wrapHit.last || hasPlrWrap(h)) return;
    const w = function (src, tgt, d, o) { if (tgt && tgt.kind === 'player') { if (tgt.dead) return 0; if (num(tgt.inv, 0) > R.t && !(o && o.dot)) { fnum(tgt.x, tgt.y - 30, 'DODGE', '#9fb6c9'); return { src, tgt, dmg: 0, crit: false, kind: (o && o.kind) || 'phys', blocked: true, absorbed: 0, killed: false, valueOf() { return 0; } }; } /* projectiles pass a dodging hero */ tgt.combatT = R.t; if (src) tgt.lastHitBy = src; if (!(R.t < tgt.atkT)) tgt.hurtT = R.t + 0.2; } return h.apply(this, arguments); };
    w.plrWrap = true; w.orig = h; R.hit = w; wrapHit.last = w; }

  /* ---- permadeath: the run ends, the Hall of the Fallen gets a line, the next hero is chosen ---- */
  const nameOf = s => { if (!s) return 'the cold'; if (s.name) return s.name; const M = R.data.mobs && s.type && R.data.mobs[s.type]; return (M && M.name) || s.type || (s.kind === 'boss' ? 'a boss' : 'the cold'); };
  P.hall = () => { const a = acc(); return (a && a.hall) || []; };
  P.unlocked = () => { const a = acc(); const c = (a && a.champs) || {}; return Object.keys(c).filter(id => c[id] && (c[id].unlocked || c[id].unlocked == null)); };
  P.nextHero = () => { const p = st(); const u = P.unlocked(); return u.find(id => id !== (p && p.hero)) || u[0] || (p && p.hero) || null; };
  function die(e) {
    if (e.deathT) return; const p = st(); e.deathT = R.t || 1e-9; e.dead = true; e.hp = 0; e.anim = 'die'; e.animT = 0; e.atkBuf = false; e.sprint = false; e.healT = 0; e.dodgeT = 0; e.moveT = 0; setInteract(null);
    const killer = nameOf(e.lastHitBy); e.killer = killer;
    if (p) { p.hp = 0;
      let a = acc(); if (!a && R.state) a = R.state.acc = { house: p.house, champs: {}, hall: [], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: {} };
      if (a) { a.hall = a.hall || []; a.hall.push({ id: p.hero || null, name: p.name || '', lvl: num(p.lvl, 1), killer, at: Date.now(), played: num(p.played, 0) });
        a.best = a.best || {}; a.best.lvl = Math.max(num(a.best.lvl, 0), num(p.lvl, 1));
        if (p.hero) { a.champs = a.champs || {}; const c = a.champs[p.hero] = a.champs[p.hero] || { unlocked: 1, runs: 0 }; c.runs = num(c.runs, 0) + 1; } } }
    R.save(true); sfx('death'); hap('error'); R.bus.emit('death', e, killer);
    if (R.screens && R.screens.death && R.ui && R.ui.open) { e.nextT = 0; R.ui.open('death', { hero: p && p.hero, killer, lvl: p && p.lvl }); } else e.nextT = R.t + NEXT_T;
  }

  /* ---- interaction ---- */
  let intKey = '';
  function interactScan(e) {
    if (R.t < e.intT) return; e.intT = R.t + 0.1; let b = null, bd = Infinity;
    for (const t of R.ents) { if (t === e || t.dead) continue; if (t.kind !== 'npc' && t.kind !== 'portal' && t.kind !== 'drop') continue; const d = Math.hypot(t.x - e.x, t.y - e.y); if (d <= INTERACT_R && d < bd) { bd = d; b = t; } }
    const label = b ? (b.label || (b.kind === 'npc' ? 'TALK' : b.kind === 'portal' ? 'ENTER' : 'TAKE')) : ''; const key = b ? b.id + ':' + label : '';
    if (key === intKey) return; intKey = key; const v = b ? { label, e: b } : null; setInteract(v); R.bus.emit('interactable', v);
  }

  /* ---- movement ---- */
  function moveTo(e, nx, ny) {
    nx = R.clamp(nx, 0, R.W); ny = R.clamp(ny, 0, R.H); const W = R.world;
    if (W && typeof W.slide === 'function') { try { W.slide(e, nx - e.x, ny - e.y); return; } catch (x) {} }   // the entity form: slide(e, dx, dy) moves e in place
    if (W && typeof W.blocked === 'function') { try { if (!W.blocked(nx, ny)) { e.x = nx; e.y = ny; } else if (!W.blocked(nx, e.y)) e.x = nx; else if (!W.blocked(e.x, ny)) e.y = ny; return; } catch (x) {} }
    e.x = nx; e.y = ny;
  }

  /* ---- the system ---- */
  function update(dt) {
    const p = st(); if (!p) return; const e = P.ensure(); if (!e) return; wrapHit(); if (!e.hgDone) { e.hgDone = 1; P.homeGate(); }
    if ((e.hp <= 0 || e.dead) && !e.deathT) return die(e);
    if (e.dead) { if (e.nextT && R.t >= e.nextT - 1e-6) { e.nextT = 0; if (typeof R.newHero === 'function') { try { R.newHero(P.nextHero()); } catch (x) { console.error('newHero', x); } } } return; }
    const I = inp(); const screen = !!(R.ui && R.ui.cur);
    if (e.healT > R.t) e.hp = Math.min(e.hpMax, e.hp + e.healRate * dt);
    else if (!e.inCombat() && e.hp < e.hpMax) { const b = e.hp; e.hp = Math.min(e.hpMax, e.hp + e.hpMax * num(e.regenK, REGEN) * dt); e.regen = true; e.regenAcc = num(e.regenAcc, 0) + (e.hp - b);
      if (R.t - num(e.regenT, -9) >= 1 || e.hp >= e.hpMax) { e.regenT = R.t; const n = Math.round(e.regenAcc); e.regenAcc -= n; if (n > 0) { fnum(e.x, e.y - 34, '+' + n, 'rgba(127,208,106,.85)'); R.bus.emit('regen', e, n); } } }
    else { e.regen = false; e.regenAcc = 0; e.regenT = R.t; }   // regeneration stops at once in combat (e.regen: the renderer's soft glow)
    potionUi(e, p);
    const stun = e.stunned(); const mv = (I.move && !screen && !stun) ? I.move : null;
    let mx = 0, my = 0, len = 0;
    if (mv) { const d = P.camDir(num(mv.x, 0), num(mv.y, 0)); mx = d.x; my = d.y; len = Math.hypot(mx, my); if (len < 0.08) { mx = my = len = 0; } else if (len > 1) { mx /= len; my /= len; len = 1; } }
    if (e.atkBuf && !e.attacking() && !screen && !stun) { e.atkBuf = false; P.attack(e, mx, my); }
    if (!screen && !stun) {
      if (pressed('attack')) { if (e.attacking()) e.atkBuf = true; else if (!e.dodging()) P.attack(e, mx, my); }
      if (pressed('dodge')) P.dodge(e, mx, my);
      if (pressed('potion')) P.potion(e);
      for (let i = 0; i < 3; i++) if (pressed('skill' + (i + 1)) && R.skills && typeof R.skills.cast === 'function') { try { R.skills.cast(i); } catch (x) { console.error('skill', i, x); } }
      if (pressed('interact') && I.interact && I.interact.e) { sfx('ui'); R.bus.emit('interact', I.interact.e); }
    }
    if (e.dodging() && num(e.dodgeLeft, 0) > 0) { const v = Math.hypot(e.dvx, e.dvy) || 1, s = Math.min(v * dt, e.dodgeLeft); e.dodgeLeft -= s; moveTo(e, e.x + e.dvx / v * s, e.y + e.dvy / v * s); e.anim = 'walk'; e.moveT = 0; }   // the roll covers exactly DODGE_D
    else if (len > 0 && !e.attacking() && !stun && !screen) {
      e.moveT += dt; e.sprint = !e.inCombat() && (down('sprint') || e.moveT >= SPRINT_AFTER);
      const slow = num(e.status.slow, 0) > R.t ? 0.5 : 1, sp = (e.sprint ? e.spd * SPRINT / SPD : e.spd) * slow * len;
      moveTo(e, e.x + mx / len * sp * dt, e.y + my / len * sp * dt);
      if (Math.abs(mx) > 0.15) e.face = mx < 0 ? -1 : 1;
      if (e.anim !== 'walk') { e.anim = 'walk'; e.animT = 0; }
    } else {
      e.moveT = 0; e.sprint = false;
      if (e.attacking()) { if (e.anim !== 'attack') { e.anim = 'attack'; e.animT = 0; } }
      else if (e.hurtT > R.t) { if (e.anim !== 'hurt') { e.anim = 'hurt'; e.animT = 0; } }
      else if (e.anim !== 'idle') { e.anim = 'idle'; e.animT = 0; }
    }
    interactScan(e);
  }
  R.addSys('player', { order: 80, update });

  /* ---- listeners ---- */
  R.bus.on('hit', i => { const e = R.player; if (!e || !i || !e.recalc) return; if (i.tgt === e) { e.combatT = R.t; if (i.src) e.lastHitBy = i.src; if (!e.attacking()) e.hurtT = R.t + 0.2; } else if (i.src === e) e.combatT = R.t; });
  R.bus.on('kill', (m, by) => { const e = R.player, p = st(); if (!e || !p || !m || m.xpGiven || !e.recalc || e.dead) return; if (m.kind !== 'mob' && m.kind !== 'boss') return; if (by && by !== e && by.team !== 0) return;
    const B = R.data.balance; let xp = num(m.xp, 0); if (!xp && B && typeof B.mobXp === 'function') { try { xp = num(B.mobXp(m), 0); } catch (x) {} }
    if (!xp) xp = Math.round(m.kind === 'boss' ? 60 + 20 * num(m.lvl, 1) : 6 + 3 * num(m.lvl, 1));
    const w = world(); w.killed = w.killed || {}; if (m.type) w.killed[m.type] = num(w.killed[m.type], 0) + 1; gainXp(e, xp, m); });
  for (const ev of ['gear', 'equip', 'unequip', 'talent']) R.bus.on(ev, () => { const e = R.player; if (e && e.recalc && !e.dead) { try { e.recalc(); } catch (x) {} } });   // auto-equip on pickup, the smith, the bag
  R.bus.on('tick1s', () => { const e = R.player, p = st(); if (e && p && e.recalc && !e.dead) p.hp = Math.round(e.hp); });
})();
