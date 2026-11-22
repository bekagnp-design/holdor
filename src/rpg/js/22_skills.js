/* HOLDOR RPG — classes + skills (A13).
   R.data.classes (knight / ranger / maester), R.data.skills (18: 6 per class), R.skills (cast, rankUp, setBar, autoBar, …),
   R.screens.skills (the skill screen), system 'skills' (order 85: cooldown rings, traps, pools, rains, ravens, shots).
   Soft dependencies: R.hit (A11), R.player (A12), R.input (A02), R.fx (A32), R.sfx (A33), R.world (A06). Everything is guarded. */
(function () {
  const D = R.data;
  const SVG = {
    knight: '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M24 5l14 5v12c0 9-6 16-14 21C16 38 10 31 10 22V10z" fill="#3b4a5a" stroke="#cfd9e6" stroke-width="2"/><path d="M24 11v26M16 20h16" stroke="#e3b661" stroke-width="2.5"/><path d="M8 40L34 14" stroke="#eef3f8" stroke-width="3"/><path d="M31 11l6 6M8 40l-3 3" stroke="#e3b661" stroke-width="3"/></svg>',
    ranger: '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6c14 6 14 30 0 36" stroke="#8a5a2b" stroke-width="3"/><path d="M14 6l0 36" stroke="#d9cfa8" stroke-width="1.2"/><path d="M8 24h32" stroke="#eef3f8" stroke-width="2.5"/><path d="M40 24l-6-4M40 24l-6 4" stroke="#eef3f8" stroke-width="2.5"/><path d="M8 24l4-3M8 24l4 3" stroke="#7fd06a" stroke-width="2.5"/></svg>',
    maester: '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 44L30 8" stroke="#8a5a2b" stroke-width="3"/><circle cx="31" cy="7" r="3.5" fill="#e3b661" stroke="#f3e7c4" stroke-width="1.5"/><path d="M30 22h6v6l6 10c1 2 0 4-2 4H26c-2 0-3-2-2-4l6-10z" fill="#1f3a1f" stroke="#9fe07a" stroke-width="2"/><path d="M28 36h12" stroke="#7fd06a" stroke-width="2.5"/><circle cx="33" cy="33" r="1.3" fill="#c8ff9a"/><circle cx="37" cy="30" r="1" fill="#c8ff9a"/></svg>'
  };
  /* ---------------- classes ---------------- */
  D.classes = {
    knight: { id: 'knight', name: 'Knight', weapon: 'Sword & shield', fantasy: 'Holds the line where others break: a shield that takes the blow and a sword that answers it.',
      icon: '🛡️', svg: SVG.knight, col: '#a9bdd0', main: 'str', range: 60, arc: 110, splash: 0, hpMul: 1.2, critAdd: 0, skillMul: 1, pierce: 0,
      base: { str: 8, agi: 4, int: 3, vit: 7 }, grow: { str: 1.5, agi: 0.5, int: 0.3, vit: 0.7 }, perk: '+20% health. Hits in a 110° arc.' },
    ranger: { id: 'ranger', name: 'Ranger', weapon: 'Longbow', fantasy: 'Strikes from the treeline before the enemy knows the fight has begun.',
      icon: '🏹', svg: SVG.ranger, col: '#7fd06a', main: 'agi', range: 320, arc: 0, splash: 0, hpMul: 1, critAdd: 0.15, skillMul: 1, pierce: 0, pierceAt: 3,
      base: { str: 4, agi: 9, int: 3, vit: 4 }, grow: { str: 0.5, agi: 1.6, int: 0.3, vit: 0.6 }, perk: '+15% crit. Arrows pierce one more foe once Volley reaches rank 3.' },
    maester: { id: 'maester', name: 'Maester', weapon: 'Staff & wildfire', fantasy: 'Read every book in the Citadel, then learned what the alchemists would not write down.',
      icon: '🔥', svg: SVG.maester, col: '#9fe07a', main: 'int', range: 260, arc: 0, splash: 20, hpMul: 1, critAdd: 0, skillMul: 1.2, pierce: 0,
      base: { str: 3, agi: 4, int: 9, vit: 4 }, grow: { str: 0.3, agi: 0.5, int: 1.6, vit: 0.6 }, perk: '+20% skill power. Every hit splashes 20 paces.' }
  };
  D.classOrder = ['knight', 'ranger', 'maester'];
  /* ---------------- skills: 6 per class, unlocked at levels 1, 4, 8, 14, 22, 32 ---------------- */
  const UNLOCK = [1, 1, 1, 8, 14, 22];   // the owner: three spells from level 1 for every class (the champion's signature joins at 6)
  const S = (id, cls, name, icon, cd, kind, v, d, x) => Object.assign({ id, cls, name, icon, cd, cost: 0, kind, v, d }, x || {});
  const pl = n => n === 1 ? '' : 's';
  const LIST = [
    // knight
    S('k_cleave', 'knight', 'Cleave', '🗡️', 6, 'melee_aoe', [150, 175, 200, 230, 260], v => `A sweeping cut: every foe in front of you takes ${v}% weapon damage.`, { arc: 110, range: 90 }),
    S('k_lunge', 'knight', 'Shield Charge', '🛡️', 9, 'dash_strike', [170, 200, 230, 260, 300], v => `Charge 160 paces behind your shield: everything on the way takes ${v}% weapon damage and is knocked back.`, { dash: 160, knock: 90, stun: 0.4 }),
    S('k_taunt', 'knight', 'War Cry', '📣', 18, 'taunt', [3, 3.5, 4, 4.5, 5], v => `War cry: foes within 200 paces cower and turn on you; for ${v} s you take 40% less damage and for ${v + 3} s you deal 20% more.`, { range: 200 }),
    S('k_shield', 'knight', 'Raised Shield', '🔰', 14, 'shield', [60, 95, 135, 180, 240], v => `Raise your shield: absorbs ${v} damage (+3 per level) for 8 s.`, { dur: 8 }),
    S('k_whirl', 'knight', 'Ironwood Whirl', '🌀', 12, 'melee_aoe', [120, 140, 160, 185, 210], v => `Spin with the blade: every foe around you takes ${v}% weapon damage and bleeds for 3 s.`, { arc: 360, range: 110, dot: 'bleed' }),
    S('k_oath', 'knight', 'Oath of the Gate', '🏰', 30, 'heal', [25, 30, 35, 40, 50], v => `Plant your feet: heal ${v}% of your health and gain a shield of the same size for 6 s.`, { self: true, shield: true, dur: 6 }),
    // ranger
    S('r_volley', 'ranger', 'Volley', '🏹', 5, 'volley', [3, 4, 5, 6, 7], v => `Loose ${v} arrows at the nearest foes within 320 paces, 70% weapon damage each.`, { range: 320, each: 70 }),
    S('r_snare', 'ranger', 'Snare Trap', '🪤', 10, 'trap', [130, 155, 180, 210, 240], v => `Set a snare at your feet: the first foe to step on it takes ${v}% weapon damage and is held for 2 s.`, { n: 1, hold: 2 }),
    S('r_step', 'ranger', 'Roll Shot', '🎯', 8, 'dash_strike', [140, 165, 190, 220, 250], v => `Dart 180 paces; foes you pass take ${v}% weapon damage.`, { dash: 180 }),
    S('r_rain', 'ranger', 'Rain of Arrows', '🌧️', 16, 'rain', [60, 70, 80, 95, 110], v => `Arrows fall on the nearest foes for 2.5 s: five times ${v}% weapon damage within 90 paces.`, { r: 90, ticks: 5, dur: 2.5, range: 320 }),
    S('r_weir', 'ranger', 'Weirwood Shaft', '🌳', 11, 'volley', [260, 300, 340, 390, 440], v => `One heavy shaft flies 320 paces straight through every foe in its line for ${v}% weapon damage.`, { range: 320, line: true }),
    S('r_ring', 'ranger', 'Thorn Ring', '🌵', 24, 'trap', [180, 210, 240, 280, 320], v => `Three snares spring up around you, each dealing ${v}% weapon damage and holding its foe for 2 s.`, { n: 3, hold: 2 }),
    // maester
    S('m_flask', 'maester', 'Wildfire Bolt', '🔥', 4, 'fire_bolt', [130, 150, 170, 195, 220], v => `Hurl a flask at the nearest foe within 260 paces: ${v}% skill damage, splashes and burns for 3 s.`, { range: 260, dot: 'burn' }),
    S('m_frost', 'maester', 'Frost Nova', '❄️', 10, 'frost_nova', [90, 105, 120, 140, 160], v => `Cold bursts from you: foes within 130 paces take ${v}% skill damage, freeze for a moment and move half as fast for 3 s.`, { r: 130, slow: 3 }),
    S('m_tinct', 'maester', 'Mend', '💚', 14, 'heal', [20, 25, 30, 36, 42], v => `Mend wounds: you and your companions within 160 paces heal ${v}% of your health.`, { r: 160 }),
    S('m_pool', 'maester', "Alchemist's Green", '🟢', 15, 'wildfire', [45, 55, 65, 75, 90], v => `Spill green fire on the nearest foes: a pool 70 paces wide burns for 4 s, ${v}% skill damage every half second.`, { r: 70, ticks: 8, dur: 4, range: 260 }),
    S('m_raven', 'maester', 'Raven Call', '🐦‍⬛', 24, 'summon_raven', [1, 2, 2, 3, 3], v => `Call ${v} raven${pl(v)} from the rookery: they harry your foes for 20 s.`, { life: 20 }),
    S('m_storm', 'maester', 'Dragonfire Reckoning', '☄️', 28, 'rain', [110, 125, 140, 160, 180], v => `Fire falls from the sky on the nearest foes for 3 s: six times ${v}% skill damage within 120 paces.`, { r: 120, ticks: 6, dur: 3, range: 260, fire: true })
  ];
  D.skills = {}; D.skillOrder = [];
  const perCls = {};
  for (const s of LIST) { perCls[s.cls] = perCls[s.cls] || 0; s.unlock = UNLOCK[perCls[s.cls]++]; s.idx = perCls[s.cls] - 1; D.skills[s.id] = s; D.skillOrder.push(s.id); }
  D.skillUnlocks = UNLOCK.slice();
  /* The hero's signature (Addendum 2): R.data.champs[hero].sig (A10) becomes a 4th skill, unlocked at level 6, slot 3 by default.
     sig kinds aoe / rain / heal / shield / strike / summon / buff / debuff / dash map onto this module's executors. */
  const SIGMAP = { aoe: 'melee_aoe', rain: 'rain', heal: 'heal', shield: 'shield', strike: 'strike', summon: 'summon_raven', buff: 'buff', debuff: 'debuff', dash: 'dash_strike' };
  const SIGBASE = {
    melee_aoe: { name: 'Sweep', icon: '✦', cd: 10, v: [150, 175, 200, 230, 260], arc: 360, range: 120, d: v => `Every foe around the hero takes ${v}% weapon damage.` },
    rain: { name: 'Barrage', icon: '☄️', cd: 16, v: [70, 80, 95, 110, 125], r: 100, ticks: 5, dur: 2.5, range: 300, d: v => `Blows fall on the nearest foes for 2.5 s: five times ${v}% damage within 100 paces.` },
    heal: { name: 'Second Wind', icon: '💚', cd: 16, v: [20, 25, 30, 36, 42], r: 160, d: v => `Heal ${v}% of your health.` },
    shield: { name: 'Guard', icon: '🛡️', cd: 16, v: [70, 110, 150, 200, 260], dur: 8, d: v => `A shield that absorbs ${v} damage (+3 per level) for 8 s.` },
    strike: { name: 'Killing Blow', icon: '🗡️', cd: 8, v: [220, 260, 300, 350, 400], stun: 0.8, d: v => `One heavy blow at the nearest foe: ${v}% weapon damage and a short stun.` },
    summon_raven: { name: 'Rookery Call', icon: '🐦‍⬛', cd: 24, v: [1, 1, 2, 2, 3], life: 20, d: v => `${v} raven${pl(v)} fight beside you for 20 s.` },
    buff: { name: 'Battle Cry', icon: '🚩', cd: 20, v: [20, 25, 30, 36, 42], dur: 8, d: v => `Your attacks deal ${v}% more damage for 8 s.` },
    debuff: { name: 'Dread', icon: '💀', cd: 14, v: [3, 3.5, 4, 4.5, 5], r: 160, d: v => `Foes within 160 paces are weakened and slowed for ${v} s and take 60% weapon damage.` },
    dash_strike: { name: 'Charge', icon: '💨', cd: 9, v: [160, 190, 220, 250, 290], dash: 180, d: v => `Charge 180 paces; foes on the way take ${v}% weapon damage.` }
  };

  /* ---------------- helpers ---------------- */
  const P = () => R.state && R.state.p;
  const pl8 = () => R.player && !R.player.dead ? R.player : null;
  const cls = () => (P() && D.classes[P().cls]) || D.classes.knight;
  const isFoe = e => !e.dead && e.team === 1 && e.hp > 0 && e.kind !== 'drop' && e.kind !== 'portal' && e.kind !== 'trap';
  const foes = (x, y, r) => R.near(x, y, r, isFoe);
  const nearest = (x, y, r) => { let b = null, bd = r * r; for (const e of R.ents) if (isFoe(e)) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; b = e; } } return b; };
  const atk = () => { const p = pl8(); let a; if (p && p.atk) a = p.atk; else { const s = P(); if (!s) return 10; const c = cls(); a = 10 + 2 * s.lvl + 1.5 * ((s.stats && s.stats[c.main]) || 5); }
    const st = p && p.status; if (st && st.rally > R.t) a *= st.rallyK || 1.3; return a; };
  /* talents (25_progression, P1): R.prog.mods() → {cdrPct, skillPct:{id: pct}} */
  const tal = () => { try { const m = R.prog && typeof R.prog.mods === 'function' && R.prog.mods(); return (m && typeof m === 'object') ? m : {}; } catch (e) { return {}; } };
  const sPct = sk => 1 + (+((tal().skillPct || {})[sk && sk.id]) || 0) / 100;
  const cdOf = s => s.cd * Math.max(0.2, 1 - (+tal().cdrPct || 0) / 100);
  const dmgOf = (sk, pct) => Math.max(1, Math.round(atk() * (pct / 100) * cls().skillMul * sPct(sk)));
  const fx = (kind, x, y, o) => { if (R.fx && R.fx.spawn) try { R.fx.spawn(kind, x, y, o || {}); } catch (e) {} };
  const sfx = name => { if (R.sfx && R.sfx.play) try { R.sfx.play(name, 0.8); } catch (e) {} };
  const haptic = kind => { const o = R.state && R.state.opts; if (o && o.haptic === 0) return; try { if (R.haptic) R.haptic(kind); else { const H = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback; H && H.impactOccurred(kind || 'medium'); } } catch (e) {} };
  const aim = (p, range) => { const t = nearest(p.x, p.y, range || 400); if (t) { const d = Math.hypot(t.x - p.x, t.y - p.y) || 1; return { x: (t.x - p.x) / d, y: (t.y - p.y) / d, t }; }
    const m = R.input && R.input.move; if (m && (Math.abs(m.x) > 0.2 || Math.abs(m.y) > 0.2)) { const d = Math.hypot(m.x, m.y); return { x: m.x / d, y: m.y / d }; } return { x: p.face >= 0 ? 1 : -1, y: 0 }; };
  // damage through the combat module when it exists, else a plain fallback that keeps the same events
  const hurt = (src, tgt, dmg, o) => { if (!tgt || tgt.dead) return 0; o = o || {};
    if (R.hit && R.hit !== hurt) { try { return R.hit(src, tgt, dmg, o); } catch (e) { console.error('hit', e); } }
    const crit = R.rng() < ((src === R.player ? cls().critAdd : 0) + 0.05); let d = Math.round(dmg * (crit ? 2 : 1) - (tgt.def || 0) * 0.5); d = Math.max(1, d);
    tgt.hp -= d; tgt.lastHitBy = src; tgt.anim = 'hurt'; tgt.animT = 0; tgt.status = tgt.status || {};
    if (o.stun) tgt.status.stun = Math.max(tgt.status.stun || 0, R.t + o.stun);
    if (o.dot) tgt.status[o.dot.kind || 'burn'] = R.t + (o.dot.dur || 3);
    if (R.fx && R.fx.num) try { R.fx.num(tgt.x, tgt.y - (tgt.r || 14) - 8, d, crit ? '#ffd166' : '#fff', crit); } catch (e) {}
    R.bus.emit('hit', { src, tgt, dmg: d, crit, kind: o.kind || 'phys' });
    if (tgt.hp <= 0) R.kill(tgt); return d; };
  const slow = (tgt, s, k) => { tgt.status = tgt.status || {}; tgt.status.slow = Math.max(tgt.status.slow || 0, R.t + s); tgt.status.slowK = k == null ? 0.5 : k; };
  const root = (tgt, s) => { tgt.status = tgt.status || {}; tgt.status.root = Math.max(tgt.status.root || 0, R.t + s); slow(tgt, s, 0); };
  const heal = (e, n) => { if (!e || e.dead || !n) return 0; const b = e.hp; e.hp = Math.min(e.hpMax || e.hp, e.hp + n); const d = Math.round(e.hp - b); if (d > 0 && R.fx && R.fx.num) try { R.fx.num(e.x, e.y - (e.r || 14) - 8, '+' + d, '#7fd06a'); } catch (x) {} if (e === R.player && P()) P().hp = e.hp; return d; };
  const shieldUp = (e, n, dur) => { e.status = e.status || {}; e.status.shield = Math.max(e.status.shield || 0, n); e.status.shieldUntil = R.t + dur; e.status.shieldMax = Math.max(e.status.shieldMax || 0, n); };
  const inArc = (p, e, dir, arc, range) => { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d > range + (e.r || 14)) return false; if (arc >= 360 || d < 8) return true;
    const a = Math.acos(R.clamp((dx * dir.x + dy * dir.y) / (d || 1), -1, 1)); return a <= (arc / 2) * Math.PI / 180; };
  const blocked = (x, y) => !!(R.world && R.world.blocked && R.world.blocked(x, y)) || x < 0 || y < 0 || x > R.W || y > R.H;

  /* live effects of this module (not entities): shots in flight, ground zones (pools / rains), telegraph circles */
  const shots = [], zones = [];
  const shoot = (x0, y0, x1, y1, dur, col, onHit) => shots.push({ x0, y0, x1, y1, t0: R.t, dur, col, onHit });
  const zone = z => { z.t0 = R.t; z.next = R.t + (z.first || 0); z.until = R.t + z.dur; z.n = 0; zones.push(z); fx(z.fire ? 'fire' : z.kind, z.x, z.y, { r: z.r, dur: z.dur }); return z; };

  /* ---------------- effects by kind ---------------- */
  const EX = {
    melee_aoe(sk, v, p) { const dir = aim(p, sk.range + 40); const dmg = dmgOf(sk, v); let n = 0; const arc = sk.arc || cls().arc || 110;
      for (const e of foes(p.x, p.y, sk.range + 40)) if (inArc(p, e, dir, arc, sk.range)) { hurt(p, e, dmg, { kind: 'phys', knock: 18, dot: sk.dot ? { kind: sk.dot, dur: 3 } : null }); n++; }
      if (dir.x) p.face = dir.x > 0 ? 1 : -1; fx(arc >= 360 ? 'whirl' : 'slash', p.x, p.y, { r: sk.range, ang: Math.atan2(dir.y, dir.x), arc }); if (R.fx && R.fx.shake && n) R.fx.shake(3, 0.12); return true; },
    shield(sk, v, p) { const s = P(); shieldUp(p, v + 3 * (s ? s.lvl : 1), sk.dur || 8); fx('shield', p.x, p.y, { r: 30, dur: sk.dur || 8 }); return true; },
    dash_strike(sk, v, p) { const dir = aim(p, 260); const dmg = dmgOf(sk, v); const L = sk.dash || 160; let x = p.x, y = p.y, x0 = p.x, y0 = p.y;
      for (let i = 10; i <= L; i += 10) { const nx = p.x + dir.x * i, ny = p.y + dir.y * i; if (blocked(nx, ny)) break; x = nx; y = ny; }
      const hitSet = new Set(); for (const e of foes((x0 + x) / 2, (y0 + y) / 2, L / 2 + 70)) { // distance from the segment
        const dx = x - x0, dy = y - y0, l2 = dx * dx + dy * dy || 1; let t = ((e.x - x0) * dx + (e.y - y0) * dy) / l2; t = R.clamp(t, 0, 1); const qx = x0 + dx * t, qy = y0 + dy * t;
        if (Math.hypot(e.x - qx, e.y - qy) <= 50 + (e.r || 14)) hitSet.add(e); }
      p.x = x; p.y = y; if (dir.x) p.face = dir.x > 0 ? 1 : -1; p.status = p.status || {}; p.status.iframe = R.t + 0.3; p.dashT = R.t;
      for (const e of hitSet) hurt(p, e, dmg, { kind: 'phys', knock: sk.knock || 24, stun: sk.stun || 0 }); fx('dash', x0, y0, { to: { x, y } }); if (R.fx && R.fx.shake && hitSet.size) R.fx.shake(4, 0.15); return true; },
    taunt(sk, v, p) { let n = 0; for (const e of foes(p.x, p.y, sk.range || 200)) { e.ai = e.ai || {}; e.ai.target = p; e.ai.taunt = R.t + v; e.ai.state = e.ai.state === 'idle' || e.ai.state === 'patrol' ? 'chase' : e.ai.state; e.status = e.status || {}; e.status.stun = Math.max(e.status.stun || 0, R.t + 0.5); e.taunted = R.t + v; n++; }
      p.status = p.status || {}; p.status.guard = R.t + v; p.status.guardK = 0.6; p.status.atkBuff = R.t + v + 3;   /* War Cry: +20 % damage (R.hit reads atkBuff) */ fx('taunt', p.x, p.y, { r: sk.range || 200, dur: 0.6 }); if (R.fx && R.fx.shake) R.fx.shake(2, 0.2); return true; },
    heal(sk, v, p) { const n = Math.round((p.hpMax || 100) * v / 100 * sPct(sk)); heal(p, n); if (!sk.self) for (const e of R.near(p.x, p.y, sk.r || 160, e => !e.dead && e.team === 0 && e !== p && e.hpMax)) heal(e, Math.round(e.hpMax * v / 100));
      if (sk.shield) shieldUp(p, n, sk.dur || 6); fx('heal', p.x, p.y, { r: sk.r || 40 }); return true; },
    volley(sk, v, p) { const dir = aim(p, sk.range); if (dir.x) p.face = dir.x > 0 ? 1 : -1;
      if (sk.line) { const dmg = dmgOf(sk, v); const x1 = p.x + dir.x * sk.range, y1 = p.y + dir.y * sk.range; const hits = [];
        for (const e of foes(p.x, p.y, sk.range + 30)) { const dx = x1 - p.x, dy = y1 - p.y, l2 = dx * dx + dy * dy || 1; let t = ((e.x - p.x) * dx + (e.y - p.y) * dy) / l2; if (t < 0 || t > 1) continue; const qx = p.x + dx * t, qy = p.y + dy * t; if (Math.hypot(e.x - qx, e.y - qy) <= 26 + (e.r || 14)) hits.push({ e, t }); }
        hits.sort((a, b) => a.t - b.t); for (const h of hits) shoot(p.x, p.y, h.e.x, h.e.y, 0.08 + h.t * 0.2, '#f3e7c4', () => hurt(p, h.e, dmg, { kind: 'phys', knock: 30 })); shoot(p.x, p.y, x1, y1, 0.28, '#f3e7c4', null); fx('shaft', p.x, p.y, { to: { x: x1, y: y1 } }); return true; }
      const list = foes(p.x, p.y, sk.range).sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - (b.x - p.x) ** 2 - (b.y - p.y) ** 2); const dmg = dmgOf(sk, sk.each || 70);
      for (let i = 0; i < v; i++) { const e = list.length ? list[i % list.length] : null; const tx = e ? e.x : p.x + dir.x * sk.range * 0.6 + (R.rng() - 0.5) * 60, ty = e ? e.y : p.y + dir.y * sk.range * 0.6 + (R.rng() - 0.5) * 60;
        shoot(p.x, p.y - 10, tx, ty, 0.12 + i * 0.05 + Math.hypot(tx - p.x, ty - p.y) / 1600, '#f3e7c4', e ? () => hurt(p, e, dmg, { kind: 'phys' }) : null); }
      fx('volley', p.x, p.y, { n: v, ang: Math.atan2(dir.y, dir.x) }); return true; },
    trap(sk, v, p) { const dmg = dmgOf(sk, v); const n = sk.n || 1; for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : (i / n) * Math.PI * 2 - Math.PI / 2, d = n === 1 ? 0 : 70; let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (blocked(x, y)) { x = p.x; y = p.y; }
        const t = R.spawn({ kind: 'trap', team: 0, x, y, r: 12, hp: 1, hpMax: 1, name: sk.name, type: 'snare', owner: p.id, life: R.t + 30, trap: { dmg, hold: sk.hold || 2, trig: 40, skill: sk.id }, anim: 'idle' }); fx('trap', x, y, { r: 20 }); }
      return true; },
    rain(sk, v, p) { const t = nearest(p.x, p.y, sk.range || 320); const dir = aim(p, sk.range || 320); const x = t ? t.x : p.x + dir.x * 160, y = t ? t.y : p.y + dir.y * 160;
      zone({ kind: 'rain', fire: !!sk.fire, x, y, r: sk.r || 90, dur: sk.dur || 2.5, ticks: sk.ticks || 5, first: 0.35, dmg: dmgOf(sk, v), col: sk.fire ? '#ff7b3a' : '#f3e7c4', dot: sk.fire ? 'burn' : null, src: p }); return true; },
    fire_bolt(sk, v, p) { const t = nearest(p.x, p.y, sk.range || 260); const dir = aim(p, sk.range || 260); if (dir.x) p.face = dir.x > 0 ? 1 : -1; const x = t ? t.x : p.x + dir.x * 160, y = t ? t.y : p.y + dir.y * 160; const dmg = dmgOf(sk, v); const sp = (cls().splash || 0) + 20;
      shoot(p.x, p.y - 12, x, y, 0.1 + Math.hypot(x - p.x, y - p.y) / 900, '#9fe07a', () => { fx('fire', x, y, { r: sp }); for (const e of foes(x, y, sp)) hurt(p, e, e === t ? dmg : Math.round(dmg * 0.6), { kind: 'fire', dot: { kind: sk.dot || 'burn', dur: 3 } }); }); return true; },
    frost_nova(sk, v, p) { const dmg = dmgOf(sk, v); for (const e of foes(p.x, p.y, sk.r || 130)) { hurt(p, e, dmg, { kind: 'ice', stun: 0.6 }); slow(e, sk.slow || 3, 0.5); } fx('frost', p.x, p.y, { r: sk.r || 130 }); if (R.fx && R.fx.shake) R.fx.shake(3, 0.15); return true; },
    summon_raven(sk, v, p) { const s = P(); const lvl = s ? s.lvl : 1; for (let i = 0; i < v; i++) { const a = R.rng() * Math.PI * 2; R.spawn({ kind: 'companion', summon: 'raven', type: 'raven', name: 'Raven', team: 0, x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30 - 20, r: 10, hp: 30 + 5 * lvl, hpMax: 30 + 5 * lvl, atk: Math.max(2, Math.round(atk() * 0.6 * cls().skillMul)), def: 0, spd: 230, lvl, owner: p.id, life: R.t + (sk.life || 20), ai: { state: 'hunt', next: R.t + 0.4, flap: R.rng() * 6 }, anim: 'walk' }); }
      fx('raven', p.x, p.y - 30, { n: v }); return true; },
    wildfire(sk, v, p) { const t = nearest(p.x, p.y, sk.range || 260); const dir = aim(p, sk.range || 260); const x = t ? t.x : p.x + dir.x * 140, y = t ? t.y : p.y + dir.y * 140;
      shoot(p.x, p.y - 12, x, y, 0.1 + Math.hypot(x - p.x, y - p.y) / 900, '#9fe07a', () => zone({ kind: 'wildfire', x, y, r: sk.r || 70, dur: sk.dur || 4, ticks: sk.ticks || 8, first: 0, dmg: dmgOf(sk, v), col: '#7fe05a', dot: 'burn', src: p, fire: true })); return true; },
    // signature-only kinds
    strike(sk, v, p) { const t = nearest(p.x, p.y, (cls().range || 60) + 60); if (!t) { fx('slash', p.x, p.y, { r: 60 }); return true; } if (t.x !== p.x) p.face = t.x > p.x ? 1 : -1; hurt(p, t, dmgOf(sk, v), { kind: 'phys', stun: sk.stun || 0.8, knock: 30 }); fx('strike', t.x, t.y, { r: 30 }); if (R.fx && R.fx.shake) R.fx.shake(4, 0.12); return true; },
    buff(sk, v, p) { p.status = p.status || {}; p.status.rally = R.t + (sk.dur || 8); p.status.rallyK = 1 + v / 100; fx('rally', p.x, p.y, { r: 40, dur: sk.dur || 8 }); return true; },
    debuff(sk, v, p) { const dmg = dmgOf(sk, 60); for (const e of foes(p.x, p.y, sk.r || 160)) { hurt(p, e, dmg, { kind: 'phys' }); slow(e, v, 0.6); e.status.weak = R.t + v; e.status.weakK = 0.7; } fx('dread', p.x, p.y, { r: sk.r || 160 }); return true; }
  };

  /* ---------------- the skill API ---------------- */
  const SK = R.skills = {
    UNLOCK, kinds: Object.keys(EX),
    /* the element of a skill for effects and hit kinds: fire / frost / holy / poison / phys */
    element: s => { if (!s) return 'phys'; const k = s.kind; if (s.elem) return s.elem; if (k === 'fire_bolt' || k === 'wildfire' || (k === 'rain' && s.cls === 'maester')) return 'fire'; if (k === 'frost_nova') return 'frost'; if (k === 'heal' || k === 'shield') return 'holy'; return 'phys'; },
    cls, classMods(c) { const C = D.classes[c || (P() && P().cls)] || D.classes.knight; const m = { range: C.range, arc: C.arc, splash: C.splash, hpMul: C.hpMul, critAdd: C.critAdd, skillMul: C.skillMul, pierce: C.pierce || 0 };
      if (C.pierceAt) { const first = SK.list(C.id)[0]; if (first && SK.rank(first.id) >= C.pierceAt) m.pierce = 1; } return m; },
    list(c) { const p = P(); c = c || (p && p.cls) || 'knight'; const out = D.skillOrder.map(id => D.skills[id]).filter(s => s.cls === c && !s.hero); const sig = p && c === p.cls ? SK.sigSkill() : null; if (sig) out.push(sig); return out.sort((a, b) => a.unlock - b.unlock || (a.idx | 0) - (b.idx | 0)); },
    of(id) { return D.skills[id] || null; },
    // the hero champion's signature as a skill (needs R.data.champs from A10); null when there is none
    sigSkill() { const p = P(); if (!p || !p.hero || !D.champs || !D.champs[p.hero]) return null; const ch = D.champs[p.hero]; const sig = ch.sig || (ch.kit && ch.kit.sig); if (!sig) return null;
      const id = 'sig_' + p.hero; let s = D.skills[id]; if (s && s._src === sig && s.cls === p.cls) return s; const o = typeof sig === 'string' ? { kind: sig } : sig; const k = SIGMAP[o.kind] || EX[o.kind] && o.kind || 'melee_aoe'; const b = SIGBASE[k] || SIGBASE.melee_aoe;
      s = Object.assign({}, b, { id, cls: p.cls, hero: p.hero, name: o.name || o.n || ((ch.name || ch.n || p.hero) + ': ' + b.name), icon: String(o.icon || o.e || ch.icon || b.icon).replace(/⚔️?/g, '🗡️'), cd: o.cd || b.cd, cost: 0, kind: k, v: Array.isArray(o.v) && o.v.length === 5 ? o.v : b.v, d: typeof o.d === 'function' ? o.d : b.d, unlock: 6, idx: 6, sig: true, _src: sig });
      D.skills[id] = s; if (!D.skillOrder.includes(id)) D.skillOrder.push(id); return s; },
    unlocked(id) { const s = D.skills[id], p = P(); return !!(s && p && s.cls === p.cls && (!s.hero || s.hero === p.hero) && p.lvl >= s.unlock); },
    rank(id) { const p = P(); if (!p) return 0; const r = p.skills && p.skills[id]; if (r) return Math.min(5, r); return SK.unlocked(id) ? 1 : 0; },
    val(id, rank) { const s = D.skills[id]; if (!s) return 0; const r = rank || SK.rank(id) || 1; return s.v[Math.min(5, Math.max(1, r)) - 1]; },
    desc(id, rank) { const s = D.skills[id]; return s ? s.d(SK.val(id, rank)) : ''; },
    unlockAt(lvl, c) { return SK.list(c).find(s => s.unlock === lvl) || null; },
    earned() { const p = P(); return p ? Math.max(0, (p.lvl | 0) - 1) : 0; },
    spent() { const p = P(); if (!p || !p.skills) return 0; let n = 0; for (const id in p.skills) { const s = D.skills[id]; if (s && s.cls === p.cls && (!s.hero || s.hero === p.hero)) n += Math.max(0, Math.min(5, p.skills[id]) - 1); } return n; },
    points() { const p = P(); if (!p) return 0; p.spts = Math.max(0, SK.earned() - SK.spent()); return p.spts; },
    sync() { const p = P(); if (!p) return; p.skills = p.skills || {}; p.bar = Array.isArray(p.bar) && p.bar.length === 3 ? p.bar : [null, null, null];
      const sig = SK.sigSkill();
      for (const s of SK.list()) if (p.lvl >= s.unlock && !p.skills[s.id]) p.skills[s.id] = 1;
      for (let i = 0; i < 3; i++) if (p.bar[i] && !SK.unlocked(p.bar[i])) p.bar[i] = null;
      if (sig && p.lvl >= sig.unlock && !p.sigSet) { p.sigSet = 1; if (!p.bar.includes(sig.id)) { p.bar[2] = sig.id; SK.pushBar(); } }
      SK.points(); SK.autoBar(); },
    ready(id) { const p = pl8(); return !!(p && ((p.cd && p.cd[id]) || 0) <= R.t); },
    cdLeft(id) { const p = pl8(); return p ? Math.max(0, ((p.cd && p.cd[id]) || 0) - R.t) : 0; },
    cdFrac(id) { const s = D.skills[id]; if (!s) return 0; return R.clamp(SK.cdLeft(id) / (s.cd || 1), 0, 1); },
    rankUp(id) { const p = P(), s = D.skills[id]; if (!p || !s || !SK.unlocked(id)) return false; const r = SK.rank(id); if (r >= 5 || SK.points() <= 0) return false;
      p.skills[id] = r + 1; SK.points(); R.bus.emit('skill', id, r + 1); R.save(); sfx('ui_rank'); haptic('light'); return true; },
    setBar(slot, id) { const p = P(); if (!p || slot < 0 || slot > 2) return false; if (id && !SK.unlocked(id)) return false; p.bar = Array.isArray(p.bar) && p.bar.length === 3 ? p.bar : [null, null, null];
      if (id) for (let i = 0; i < 3; i++) if (i !== slot && p.bar[i] === id) p.bar[i] = null; p.bar[slot] = id || null; SK.pushBar(); R.save(); return true; },
    autoBar() { const p = P(); if (!p) return false; p.bar = Array.isArray(p.bar) && p.bar.length === 3 ? p.bar : [null, null, null]; const open = SK.list().filter(s => p.lvl >= s.unlock && !p.bar.includes(s.id)); let ch = false;
      for (let i = 0; i < 3 && open.length; i++) if (!p.bar[i]) { p.bar[i] = open.shift().id; ch = true; } if (ch) SK.pushBar(); return ch; },
    pushBar() { const p = P(); if (!p) return; const bar = p.bar.map(id => id ? D.skills[id] : null); try { if (R.input && R.input.setBar) R.input.setBar(bar); else if (R.input && R.input.setSkill) bar.forEach((s, i) => R.input.setSkill(i, s)); } catch (e) {} R.bus.emit('bar', p.bar.slice()); },
    bar() { const p = P(); return p && p.bar ? p.bar.slice() : [null, null, null]; },
    cast(i) { const p = P(), pe = pl8(); if (!p || !pe) return false; const id = p.bar && p.bar[i]; if (!id) return false; const s = D.skills[id]; if (!s || !EX[s.kind] || !SK.unlocked(id)) return false;
      if (pe.status && pe.status.stun > R.t) return false; if (!SK.ready(id)) { try { R.input && R.input.flash && R.input.flash(i); } catch (e) {} return false; }
      /* for the effects only (63_spellfx): where the cast starts and where it aims — the same pure aim() the executor uses, read before it runs */
      const x0 = pe.x, y0 = pe.y; let am = null; try { am = aim(pe, (s.range || s.r || 120) + 40); } catch (e) {}
      let ok = false; try { ok = EX[s.kind](s, SK.val(id), pe) !== false; } catch (e) { console.error('cast', id, e); ok = true; }
      pe.cd = pe.cd || {}; pe.cd[id] = R.t + cdOf(s); pe.anim = 'attack'; pe.animT = 0; pe.lastCast = { id, t: R.t }; sfx('skill_' + s.kind); haptic(s.cd >= 20 ? 'heavy' : 'medium'); const dir = pe.lastAim || (am ? { x: am.x, y: am.y } : { x: pe.face || 1, y: 0 });
      R.bus.emit('cast', id, pe, { x: pe.x, y: pe.y, dir, kind: SK.element(s), r: s.r || s.range || s.arc && 90 || 120, slot: i, x0, y0, ang: Math.atan2(dir.y, dir.x), tx: am && am.t ? am.t.x : null, ty: am && am.t ? am.t.y : null, arc: s.arc || 0, range: s.range || 0, skind: s.kind }); return ok; },
    castId(id) { const p = P(); if (!p) return false; const i = p.bar.indexOf(id); if (i >= 0) return SK.cast(i); const old = p.bar[2]; p.bar[2] = id; const ok = SK.cast(2); p.bar[2] = old; return ok; },
    zones, shots, hurt, heal, dmgOf, EX
  };

  /* ---------------- the system: cooldown rings, inputs, traps, zones, ravens, shots ---------------- */
  const lastFrac = [-1, -1, -1]; let syncT = 0;
  const update = dt => { if (!R.state || !R.state.p) return; const p = pl8();
    if (R.t - syncT > 1) { syncT = R.t; SK.sync(); }
    if (p && R.input) { if (R.input.pressed) for (let i = 0; i < 3; i++) { let hit = false; try { hit = R.input.pressed('skill' + (i + 1)) || R.input.pressed('s' + (i + 1)); } catch (e) {} if (hit) SK.cast(i); }
      if (R.input.setCooldown) for (let i = 0; i < 3; i++) { const id = R.state.p.bar[i]; const f = id ? SK.cdFrac(id) : 0; if (f > 0 || lastFrac[i] !== 0) { lastFrac[i] = f; try { R.input.setCooldown(i, f); } catch (e) {} } } }
    if (p && p.status && p.status.shield > 0 && p.status.shieldUntil && p.status.shieldUntil < R.t) { p.status.shield = 0; p.status.shieldMax = 0; }
    // shots
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (R.t >= s.t0 + s.dur) { shots.splice(i, 1); if (s.onHit) try { s.onHit(); } catch (e) { console.error('shot', e); } } }
    // zones (rains and pools)
    for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i]; if (R.t >= z.next && z.n < z.ticks) { z.n++; z.next = z.t0 + (z.first || 0) + z.n * ((z.dur - (z.first || 0)) / z.ticks); for (const e of foes(z.x, z.y, z.r)) hurt(z.src || R.player, e, z.dmg, { kind: z.fire ? 'fire' : 'phys', dot: z.dot ? { kind: z.dot, dur: 2 } : null }); fx(z.fire ? 'burst' : 'arrows', z.x, z.y, { r: z.r }); }
      if (R.t >= z.until && z.n >= z.ticks) zones.splice(i, 1); }
    // my entities: traps + ravens
    for (const e of R.ents.slice()) { if (e.dead) continue;
      if (e.kind === 'trap' && e.trap) { if (R.t > e.life) { e.dead = true; R.remove(e); continue; } const f = foes(e.x, e.y, e.trap.trig); if (f.length) { for (const m of foes(e.x, e.y, e.trap.trig + 30)) { hurt(R.player || e, m, e.trap.dmg, { kind: 'phys', stun: 0.8 }); root(m, e.trap.hold); } fx('snap', e.x, e.y, { r: 50 }); sfx('trap'); e.dead = true; R.remove(e); } }
      else if (e.summon === 'raven') { if (R.t > e.life || e.hp <= 0) { R.kill(e); R.remove(e); continue; } const pl = R.player; const hx = pl ? pl.x : e.x, hy = pl ? pl.y : e.y; let t = e.ai.t; if (!t || t.dead || Math.hypot(t.x - hx, t.y - hy) > 360) t = e.ai.t = nearest(hx, hy, 320);
        const gx = t ? t.x : hx + Math.cos(e.ai.flap + R.t) * 50, gy = t ? t.y - 6 : hy - 50 + Math.sin(e.ai.flap + R.t * 1.3) * 20; const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy);
        if (d > 22) { const v = e.spd * dt; e.x += dx / d * Math.min(v, d); e.y += dy / d * Math.min(v, d); e.vx = dx / d * e.spd; e.vy = dy / d * e.spd; e.anim = 'walk'; } else { e.vx = e.vy = 0; }
        if (dx) e.face = dx > 0 ? 1 : -1; if (t && d <= 30 && R.t >= e.ai.next) { e.ai.next = R.t + 0.8; e.anim = 'attack'; e.animT = 0; hurt(e, t, e.atk, { kind: 'phys' }); fx('peck', t.x, t.y - 10, {}); } } } };
  const draw = ctx => { if (!R.state || !R.cam) return; const z = R.cam.z;
    for (const zn of zones) { const s = R.w2s(zn.x, zn.y); const k = R.clamp((R.t - zn.t0) / Math.max(0.2, zn.dur), 0, 1); ctx.save(); ctx.globalAlpha = 0.28 + 0.12 * Math.sin(R.t * 8); ctx.fillStyle = zn.col; ctx.beginPath(); ctx.ellipse(s.x, s.y, zn.r * z, zn.r * z * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.85; ctx.strokeStyle = zn.col; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -R.t * 40; ctx.stroke(); ctx.setLineDash([]);
      if (zn.kind === 'rain') for (let i = 0; i < 7; i++) { const a = (i * 2.4 + R.t * 7 + zn.n) % 1; const px = s.x + Math.sin(i * 12.9 + zn.n) * zn.r * z * 0.8, py = s.y - 90 * z + a * 90 * z; ctx.globalAlpha = 0.8 * (1 - a * 0.5); ctx.strokeStyle = zn.col; ctx.beginPath(); ctx.moveTo(px, py - 12 * z); ctx.lineTo(px, py); ctx.stroke(); }
      else for (let i = 0; i < 8; i++) { const a = (i * 0.37 + R.t * 1.7) % 1; const px = s.x + Math.sin(i * 9.1) * zn.r * z * 0.7, py = s.y + Math.cos(i * 7.3) * zn.r * z * 0.4 - a * 26 * z; ctx.globalAlpha = (1 - a) * 0.8; ctx.fillStyle = zn.col; ctx.beginPath(); ctx.arc(px, py, (3 - a * 2) * z, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); void k; }
    for (const s of shots) { const k = R.clamp((R.t - s.t0) / s.dur, 0, 1); const a = R.w2s(s.x0, s.y0), b = R.w2s(s.x1, s.y1); const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 24 * z; ctx.save(); ctx.strokeStyle = s.col; ctx.fillStyle = s.col; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; ctx.beginPath(); ctx.moveTo(x - dx / L * 10 * z, y - dy / L * 10 * z); ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2.5 * z, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    for (const e of R.ents) { if (e.dead) continue;
      if (e.kind === 'trap' && e.trap) { const s = R.w2s(e.x, e.y); ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#b89a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, 14 * z, 8 * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#7fd06a'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + R.t; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * 11 * z, s.y + Math.sin(a) * 6 * z, 1.8 * z, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
      else if (e.summon === 'raven') { const s = R.w2s(e.x, e.y); const w = Math.sin(R.t * 18 + e.ai.flap) * 6; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(z * (e.face || 1), z); ctx.fillStyle = '#10141c'; ctx.strokeStyle = '#2a3140'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, -1); ctx.lineTo(-14, -8 - w); ctx.lineTo(-4, -3); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(12, -9 + w); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e3b661'; ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(14, 0); ctx.lineTo(9, 1); ctx.fill(); ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(6, -2, 1.1, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      else if (e === R.player && e.status && e.status.shield > 0) { const s = R.w2s(e.x, e.y); ctx.save(); ctx.globalAlpha = 0.35 + 0.1 * Math.sin(R.t * 6); ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y - 14 * z, 26 * z, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } } };
  R.addSys('skills', { order: 85, update, draw });
  R.bus.on('levelup', () => { SK.sync(); const p = P(); const s = p && SK.unlockAt(p.lvl); if (s) { SK.autoBar(); R.bus.emit('skillunlock', s.id); } });
  R.bus.on('respawn', () => { const p = pl8(); if (p) p.cd = {}; });
  // keyboard fallback when the input module is absent (1-2-3)
  window.addEventListener('keydown', ev => { if (R.input && R.input.pressed) return; const k = ev.key; if (k === '1' || k === '2' || k === '3') SK.cast(+k - 1); });

  /* ---------------- the skill screen ---------------- */
  const el = (tag, cls, txt) => { const d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; };
  let focusId = null, wrap = null;
  const render = () => { if (!wrap) return; const p = P(); if (!p) { wrap.textContent = 'No hero yet.'; return; } SK.sync(); const C = cls(); const pts = SK.points(); const H = D.houses && D.houses[p.house]; wrap.style.setProperty('--acc', (H && H.col) || C.col);
    wrap.innerHTML = '';
    const head = el('div', 'sk-head'); const back = el('button', 'sk-back', '‹ BACK'); back.setAttribute('aria-label', 'Back'); back.onclick = () => R.ui.close(); head.appendChild(back);
    const ttl = el('div', 'sk-title'); ttl.appendChild(el('div', 'sk-h1', 'SKILLS')); const sub = el('div', 'sk-sub'); sub.textContent = C.name + ' · level ' + p.lvl; ttl.appendChild(sub); head.appendChild(ttl);
    const pill = el('div', 'sk-pts' + (pts ? ' on' : '')); pill.innerHTML = '<b>' + pts + '</b><span>' + (pts === 1 ? 'POINT' : 'POINTS') + '</span>'; head.appendChild(pill); wrap.appendChild(head);
    const ic = el('div', 'sk-class'); ic.innerHTML = C.svg; const ct = el('div', 'sk-class-t'); ct.appendChild(el('b', null, C.weapon)); ct.appendChild(el('span', null, C.perk)); ic.appendChild(ct); wrap.appendChild(ic);
    const hint = el('div', 'sk-hint', pts ? 'Spend your points: RANK UP raises the numbers.' : 'Tap a slot under a skill to put it on your bar.'); wrap.appendChild(hint);
    const list = el('div', 'sk-list');
    for (const s of SK.list()) { const open = p.lvl >= s.unlock; const r = SK.rank(s.id); const inBar = p.bar.indexOf(s.id);
      const card = el('div', 'sk-card' + (open ? '' : ' locked') + (s.id === focusId ? ' focus' : '') + (inBar >= 0 ? ' inbar' : '') + (s.sig ? ' sig' : '')); card.dataset.id = s.id;
      const top = el('div', 'sk-top'); const icon = el('div', 'sk-icon', s.icon); top.appendChild(icon);
      const nm = el('div', 'sk-name'); nm.appendChild(el('b', null, s.name)); const meta = el('span', 'sk-meta'); meta.textContent = (s.sig ? 'Signature · ' : '') + (open ? 'Rank ' + r + ' · ' : 'Level ' + s.unlock + ' · ') + s.cd + ' s cooldown'; nm.appendChild(meta); top.appendChild(nm);
      const pips = el('div', 'sk-pips'); for (let i = 1; i <= 5; i++) pips.appendChild(el('i', i <= r ? 'on' : '')); top.appendChild(pips); card.appendChild(top);
      const desc = el('div', 'sk-desc', open ? SK.desc(s.id) : SK.desc(s.id, 1)); card.appendChild(desc);
      if (open && r < 5) { const nx = el('div', 'sk-next'); nx.textContent = 'Next rank: ' + SK.desc(s.id, r + 1); card.appendChild(nx); }
      if (!open) { const b = el('button', 'sk-lock', 'UNLOCKS AT LEVEL ' + s.unlock); b.disabled = true; card.appendChild(b); }
      else {
        if (pts > 0 && r < 5) { const b = el('button', 'pri sk-up', 'RANK UP'); b.dataset.id = s.id; b.onclick = () => { if (SK.rankUp(s.id)) { focusId = s.id; render(); if (R.ui.toast) R.ui.toast(s.name + ' → rank ' + SK.rank(s.id), '#e3b661'); } }; card.appendChild(b); }
        else if (r >= 5) card.appendChild(el('div', 'sk-max', 'MAX RANK'));
        const slots = el('div', 'sk-slots'); slots.appendChild(el('span', 'sk-slots-l', 'On bar:'));
        for (let i = 0; i < 3; i++) { const b = el('button', 'sk-slot' + (inBar === i ? ' on' : ''), 'SLOT ' + (i + 1)); b.dataset.slot = i; b.dataset.id = s.id; b.setAttribute('aria-pressed', inBar === i ? 'true' : 'false');
          b.onclick = () => { if (inBar === i) return; SK.setBar(i, s.id); haptic('light'); render(); if (R.ui.toast) R.ui.toast(s.name + ' → slot ' + (i + 1)); }; slots.appendChild(b); }
        card.appendChild(slots); }
      list.appendChild(card); }
    wrap.appendChild(list);
    if (focusId) { const c = list.querySelector('.sk-card.focus'); if (c && c.scrollIntoView) try { c.scrollIntoView({ block: 'center' }); } catch (e) {} } };
  R.screens.skills = { live: false,
    open(arg, host) { focusId = arg && (arg.focus || arg.id) || (typeof arg === 'string' ? arg : null); wrap = el('div', 'sk-wrap'); (host || document.getElementById('screen')).appendChild(wrap); render(); },
    close() { wrap = null; focusId = null; SK.pushBar(); },
    render };
  R.bus.on('skill', () => { if (wrap && R.ui.cur === 'skills') render(); });
})();
