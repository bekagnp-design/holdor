/* HOLDOR RPG — combat core (A11): R.hit, status effects, R.attack, projectiles, mob AI, death + rewards.
   Everything other modules may need is on R.combat (C); R.hit / R.attack / R.spawnMob / R.shoot are the short names. */
(function () {
  const C = R.combat = R.combat || {};
  C.SAFE_R = 160;      /* mobs never enter this radius around a safe POI (castle, town, shrine) */
  C.AGGRO = 340;       /* default aggro radius; lost beyond 1.6× or after 6 s without line of sight */
  /* temper (MR B, 2026-11-22): most field mobs are PASSIVE (yellow) — they never start a fight, only answer one: a hit
     from the hero provokes that mob, it fights until it loses him, then calms down. A few are AGGRESSIVE (red) and come
     only when the hero steps inside C.RED_R. Bosses, elites, event, dungeon and summoned mobs are always aggressive. */
  C.RED_SHARE = 0.2; C.RED_R = 230; C.TEMPER_COL = { passive: '#f2cf4a', aggressive: '#e5463f' };
  C.TEST_TEMPER = null;   /* tests set 'aggressive' to get the old always-hostile mobs with their full aggro */
  C.temperOf = (D, o) => C.TEST_TEMPER ? C.TEST_TEMPER : (o.temper === 'passive' || o.temper === 'aggressive') ? o.temper
    : (o.kind === 'boss' || o.elite || o.event || o.dungeon || o.summoned || o.team === 0 || D.aggressive) ? 'aggressive'
    : D.passive ? 'passive' : (rnd() < C.RED_SHARE ? 'aggressive' : 'passive');
  C.isPassive = e => !!e && e.temper === 'passive' && !(e.ai && e.ai.provoked);
  C.WINDUP = 0.35;     /* mob attack wind-up (s) */
  C.CONE = 50;         /* mob melee cone (degrees) */
  C.PROJ_HIT = 14;     /* a projectile hits the first enemy within this many units */
  C.stats = { hits: 0, kills: 0, shots: 0 };
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const rnd = () => (R.rng ? R.rng() : Math.random());
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const fn = (o, k) => (o && typeof o[k] === 'function' ? o[k] : null);
  const norm = (x, y) => { const d = Math.hypot(x, y); return d > 1e-9 ? { x: x / d, y: y / d } : { x: 1, y: 0 }; };
  const NOT_HIT = { npc: 1, drop: 1, portal: 1, proj: 1, fx: 1 };
  const hittable = e => !!e && !e.dead && !NOT_HIT[e.kind] && e.hpMax > 0;
  const live = e => !!e && !e.dead && e.hp > 0;

  /* ---- fallback mob table = the old game's enemies: key → [name, hp, spd(px/s), dps, r, gold mult, flags] (used when R.data.mobs lacks a key) ---- */
  const OLD = [
    ['axe', 'Wight axeman', 48, 56, 7, 7, 1, { wight: 1 }], ['sword', 'Wight swordsman', 95, 44, 10, 8, 1.6, { wight: 1 }],
    ['archer', 'Wight archer', 46, 48, 5, 7, 1.4, { wight: 1, ranged: 1 }], ['spear', 'Wight spearman', 115, 42, 14, 8, 2.2, { wight: 1 }],
    ['shield', 'Wight shieldman', 160, 38, 9, 8, 2.6, { wight: 1, armorRanged: 0.55 }], ['child', 'Wight child', 26, 80, 4, 5, 0.5, { wight: 1, small: 0.7 }],
    ['crawler', 'Crawler', 75, 34, 9, 7, 1.4, { slowImmune: 1 }], ['crypt', 'Crypt wight', 150, 44, 10, 8, 2.2, { wight: 1 }],
    ['berserk', 'Frenzied wight', 140, 50, 15, 8, 2.4, { wight: 1, berserk: 1 }], ['thenn', 'Thenn wight', 280, 40, 19, 9, 4, { wight: 1, armored: 1 }],
    ['necro', 'Cold necromancer', 430, 32, 9, 9, 7, { raise: 'axe', caster: 1 }], ['skin', 'Skinchanger', 360, 34, 10, 9, 5.5, { healAura: 1 }],
    ['chief', 'Wildling chieftain', 760, 36, 27, 10, 10, { speedAura: 1, big: 1.4 }], ['hound', 'Wight hound', 58, 88, 6, 7, 0.9, { wight: 1, pack: 3 }],
    ['wolf', 'Wight direwolf', 140, 78, 13, 9, 2.2, { wight: 1, pack: 3 }], ['boar', 'Wight boar', 200, 70, 17, 9, 3.6, { wight: 1, charge: 1 }],
    ['bear', 'Wight bear', 650, 46, 31, 13, 9.5, { wight: 1, knock: 1, big: 1.5 }], ['cat', 'Shadowcat', 160, 74, 13, 8, 2.6, { stealth: 1 }],
    ['elk', 'Undead elk', 340, 60, 19, 11, 4.5, { charge: 1 }], ['mammoth', 'Wight mammoth', 1600, 22, 50, 17, 14, { wight: 1, armored: 1, big: 2.2 }],
    ['giant', 'Wight giant', 580, 26, 43, 14, 7, { wight: 1, armored: 1, big: 1.9 }], ['spider', 'Ice spider', 95, 68, 8, 8, 1.6, { slowImmune: 1, web: 1 }],
    ['brood', 'Broodmother', 950, 40, 21, 14, 11, { raise: 'spider', big: 1.8 }], ['raven', 'Dead raven', 60, 92, 3, 6, 1.4, { fly: 1 }],
    ['bat', 'Cave bat', 70, 96, 6, 6, 1.2, { fly: 1, pack: 3 }], ['eagle', 'Ice eagle', 150, 82, 16, 8, 3, { fly: 1 }],
    ['rider', 'Wight rider', 155, 78, 11, 9, 3.2, { wight: 1, charge: 1 }], ['outrider', 'Walker outrider', 360, 70, 21, 11, 9, { charge: 1, ice: 0.35 }],
    ['wraith', 'Ice wraith', 210, 52, 12, 9, 5, { physImmune: 0.45 }], ['shade', 'Cold shade', 320, 48, 15, 9, 6.5, { stealth: 1, slowImmune: 1 }],
    ['walker', 'White Walker', 330, 40, 18, 9, 6.5, { ice: 0.35, walker: 1, big: 1.25 }], ['lord', 'Walker Lieutenant', 1000, 34, 36, 11, 12, { walker: 1, ice: 0.35, big: 1.45 }],
    ['king', 'Night King', 3200, 30, 60, 12, 20, { walker: 1, ice: 0.3, big: 1.5 }], ['dragon', 'Undead dragon', 1600, 38, 30, 18, 16, { fly: 1, armored: 1, ranged: 1 }],
  ];
  const FALLBACK = C.FALLBACK = {};
  for (const d of OLD) FALLBACK[d[0]] = Object.assign({ key: d[0], name: d[1], hp: d[2], spd: d[3], dps: d[4], r: d[5], c: d[6], _old: 1 }, d[7]);
  C.defOf = type => (R.data.mobs && R.data.mobs[type]) || FALLBACK[type] || null;
  C.isWalker = e => !!(e && (e.walker || (e.type && ((C.defOf(e.type) || {}).walker || FALLBACK[e.type] && FALLBACK[e.type].walker))));
  C.isWight = e => !!(e && !C.isWalker(e) && (e.wight === true || (e.type && ((C.defOf(e.type) || {}).wight || FALLBACK[e.type] && FALLBACK[e.type].wight))));
  C.roleOf = D => {
    if (!D) return 'melee';
    let r = D.role || D.beh || D.behaviour || D.behavior || (typeof D.ai === 'string' ? D.ai : null);
    if (r === 'summoner' || r === 'necro') r = 'caster'; if (r === 'fly' || r === 'boss') r = D.ranged ? 'ranged' : 'melee';
    if (r) return r;
    if (D.raise || D.caster) return 'caster'; if (D.healAura || D.heal || D.healer) return 'healer'; if (D.speedAura || D.key === 'chief') return 'chief';
    if (D.ranged || D.range > 60) return 'ranged'; return 'melee';
  };
  /* A08's roles (melee ranged caster healer summoner fly brute elite boss) → the AI's behaviours (melee ranged caster healer chief) */
  const hasT = (D, t) => !!(D && Array.isArray(D.traits) && D.traits.indexOf(t) >= 0);
  C.normRole = (r, D) => {
    if (r === 'summoner' || r === 'necro') return 'caster';
    if (r === 'melee' || r === 'ranged' || r === 'caster' || r === 'healer' || r === 'chief') { if (r === 'melee' && (hasT(D, 'haste') || (D && D.key === 'chief'))) return 'chief'; return r; }
    if (hasT(D, 'haste') || (D && (D.key === 'chief' || D.speedAura))) return 'chief';
    if (hasT(D, 'heal') || (D && (D.healAura || D.healer))) return 'healer';
    if (r === 'fly') return (D && (D.ranged || hasT(D, 'ranged'))) ? 'ranged' : 'melee';
    if (hasT(D, 'ranged') && !(D && D.base && D.base.range <= 60)) return 'ranged';
    return 'melee';
  };
  C.raiseOf = (D, role) => { if (!D) return null; if (D.raise === true) return 'axe'; if (typeof D.raise === 'string') return D.raise;
    if (hasT(D, 'raise')) return 'axe'; if (hasT(D, 'summon')) return (D.p && D.p.summon && D.p.summon.key) || 'spider';
    return role === 'caster' && !Array.isArray(D.traits) ? 'axe' : null; };
  /* level scaling (used when A08's R.mobs.statsAt is absent): lvl 1 = ×1 */
  C.hpK = lvl => { const L = Math.max(0, lvl - 1); return 1 + 0.14 * L + 0.004 * L * L; };
  C.atkK = lvl => { const L = Math.max(0, lvl - 1); return 1 + 0.10 * L + 0.002 * L * L; };
  C.statsAt = (type, lvl) => {
    const D = C.defOf(type) || FALLBACK.axe; lvl = Math.max(1, Math.round(num(lvl, 1)));
    const b = (D.base && typeof D.base === 'object') ? D.base : (D.stats && typeof D.stats === 'object' && !Array.isArray(D.stats) ? D.stats : D);
    const old = !!D._old, role = C.roleOf(D), big = num(D.big, 1), small = num(D.small, 1);
    const r = num(b.r, 7) * (old ? 1.6 : 1) * (big > 1 ? 1 : 1) * (small < 1 ? small : 1);
    const spd = R.clamp(num(b.spd, 56) * (old ? 1.6 : 1), 60, 185);
    const hp = Math.round(num(b.hp, 50) * C.hpK(lvl));
    const atk = Math.round(num(b.atk, num(b.dmg, num(b.dps, 6) * 1.4)) * C.atkK(lvl));
    const def = Math.round(num(b.def, 1 + 0.9 * lvl) + (D.armored ? 4 + 0.8 * lvl : 0));
    const range = num(b.range, role === 'ranged' ? 220 : role === 'caster' ? 200 : r + 24);
    const c = Math.min(3, Math.sqrt(num(D.c, 1)));
    return { hp, hpMax: hp, atk, def, spd, r, range, aggro: num(b.aggro, C.AGGRO + (D.fly ? 60 : 0)), atkCd: num(b.cd, role === 'ranged' ? 1.6 : role === 'caster' ? 1.8 : big > 1.4 ? 1.3 : 1.0),
      xp: Math.round((6 + 3 * lvl) * c), gold: Math.round((2 + 6 * rnd()) * lvl * c), role, fly: !!(D.fly || D.air) };
  };

  /* ---- movement helpers ---- */
  C.moveEnt = (e, dx, dy) => {
    if (!dx && !dy) return;
    if (!e.fly) {
      const sl = R.world && fn(R.world, 'slide');
      /* 10_world: slide(e, dx, dy) moves the entity by a DELTA in place (the old 3-argument form and the new 5-argument one both take it);
         slide(x, y, nx, ny, r) is the absolute-target form — never mix them */
      if (sl) { const r = sl(e, dx, dy); if (r && r !== e && r !== true && typeof r.x === 'number') { e.x = r.x; e.y = r.y; } return; }
      const bl = R.world && fn(R.world, 'blocked');
      if (bl) { const nx = e.x + dx, ny = e.y + dy; if (!bl(nx, ny)) { e.x = nx; e.y = ny; } else if (!bl(nx, e.y)) e.x = nx; else if (!bl(e.x, ny)) e.y = ny; e.x = R.clamp(e.x, 0, R.W || 1e9); e.y = R.clamp(e.y, 0, R.H || 1e9); return; }
    }
    e.x = R.clamp(e.x + dx, 0, R.W || 1e9); e.y = R.clamp(e.y + dy, 0, R.H || 1e9);
  };
  /* line of sight sampled every 32 units through R.world.blocked (true when the world has no mask) */
  C.los = (a, b) => { const bl = R.world && fn(R.world, 'blocked'); if (!bl) return true; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), n = Math.ceil(d / 32); for (let i = 1; i < n; i++) if (bl(a.x + dx * i / n, a.y + dy * i / n)) return false; return true; };
  C.inCone = (src, dir, t, arcDeg) => { const dx = t.x - src.x, dy = t.y - src.y, d = Math.hypot(dx, dy); if (d < 1e-6) return true; return (dx * dir.x + dy * dir.y) / d >= Math.cos(arcDeg / 2 * D2R); };
  C.faceDir = (src, o) => {
    if (o && o.dir && (o.dir.x || o.dir.y)) return norm(o.dir.x, o.dir.y);
    if (o && o.at) return norm(o.at.x - src.x, o.at.y - src.y);
    if (o && typeof o.ang === 'number') return { x: Math.cos(o.ang), y: Math.sin(o.ang) };
    if (src.aim && (src.aim.x || src.aim.y)) return norm(src.aim.x, src.aim.y);
    if (src.dir && (src.dir.x || src.dir.y)) return norm(src.dir.x, src.dir.y);
    return { x: src.face < 0 ? -1 : 1, y: 0 };
  };
  const UNSAFE = /camp|dungeon|ruin|lair|portal|cave|nest|barrow|grave|tomb|wild|boss|den/i;
  /* a castle / town / shrine is a refuge: its own radius (+40 for the NPCs at the walls), at least SAFE_R */
  C.safeR = p => { if (!p || p.safe === false || p.safe === 0) return 0; if (typeof p.safe === 'number') return p.safe; if (typeof p.safeR === 'number') return p.safeR; return UNSAFE.test(String(p.kind || p.type || '')) ? 0 : Math.max(C.SAFE_R, num(p.r, 0) > 0 ? p.r + 40 : 0); };
  let safeList = null, safeSrc = null;
  const safePois = () => { const W = R.data.world; const P = W && (W.pois || W.poi); if (!P) return null; if (P !== safeSrc) { safeSrc = P; safeList = (Array.isArray(P) ? P : Object.values(P)).filter(p => p && typeof p.x === 'number' && C.safeR(p) > 0); } return safeList; };
  /* a mob stops at the edge of a safe POI radius */
  C.keepOut = e => {
    if (e.ignoreSafe) return;
    /* a mob first seen inside a safe radius right next to the hero (< 150 units: put there on purpose by a quest, the tutorial or a test) may
       stay in that one; any other mob inside (the population, an event) is pushed out at once */
    const first = !e.koSeen; e.koSeen = 1; const pl = R.player; const nearHero = first && pl && !pl.dead && Math.hypot(e.x - pl.x, e.y - pl.y) < 150;
    const pushOut = p => { const sr = C.safeR(p); if (!sr) return; const dx = e.x - p.x, dy = e.y - p.y; if (Math.abs(dx) >= sr || Math.abs(dy) >= sr) return; const d = Math.hypot(dx, dy); if (d >= sr) return;
      const pid = p.id || (p.x + ',' + p.y); if (nearHero) { (e.koIn = e.koIn || {})[pid] = 1; return; } if (e.koIn && e.koIn[pid]) return;
      if (d < 1e-6) { e.x = p.x + sr + 0.5; return; } const k = (sr + 0.5) / d; e.x = p.x + dx * k; e.y = p.y + dy * k; };
    const L = safePois();
    if (L) { for (const p of L) pushOut(p); return; }
    const pa = R.world && fn(R.world, 'poiAt'); if (pa) { const p = pa(e.x, e.y, C.SAFE_R); if (p && typeof p.x === 'number') pushOut(p); }
  };

  /* the safe POI whose radius holds (x, y), or null; a mob allowed inside it (koIn) does not count it */
  C.safeAt = (x, y, e) => { const L = safePois(); if (!L) return null; for (const p of L) { const sr = C.safeR(p); const dx = x - p.x, dy = y - p.y; if (Math.abs(dx) >= sr || Math.abs(dy) >= sr || dx * dx + dy * dy >= sr * sr) continue;
      if (e && e.koIn && e.koIn[p.id || (p.x + ',' + p.y)]) continue; return p; } return null; };
  /* home ground: mobs within HOME_R of a house seat are at most max(2, hero level + 1) — a level-1 hero's first fields are fair */
  C.HOME_R = 1500;
  C.homeCap = (x, y, lvl) => { const W = R.data.world; const P = W && W.pois ? (Array.isArray(W.pois) ? W.pois : Object.values(W.pois)) : null; if (!P) return lvl;
    const pl = R.player, cap = Math.max(2, num(pl && pl.lvl, 1) + 1); if (lvl <= cap) return lvl;
    for (const q of P) if (q && q.seat && typeof q.x === 'number' && Math.hypot(x - q.x, y - q.y) < C.HOME_R) return cap; return lvl; };

  /* ---- R.hit(src, tgt, dmg, o) — the one damage path ----
     o: { kind:'phys'|'fire'|'ice'|'holy', mult, crit (true forces, number = chance), critMult, knock (units), stun/slow (s), burn/bleed (s, true = 3),
          dot ('burn'|'bleed' alias, or truthy for an internal tick), pierce (0..1 of def ignored), noAnim, silent, force }
     returns {src,tgt,dmg,crit,kind,absorbed,killed,blocked} or null when the target cannot be hit. */
  /* the one damage formula (docs/rpg-balance.md): a hit of the attacker's atk deals B.dmg(atk, def) = atk²/(atk+def); a hit of
     raw damage d (atk × a skill's mult) deals d × B.dmg(atk, def) / atk, so multipliers stay linear.  Fallback: the same formula. */
  C.defK = (atk, def) => { atk = Math.max(1e-6, num(atk, 1)); def = Math.max(0, num(def, 0)); if (!def) return 1;
    const B = R.data.balance; if (B && typeof B.dmg === 'function' && atk >= 8) { try { const v = B.dmg(atk, def); if (v > 0 && isFinite(v)) return Math.min(1, v / atk); } catch (e) {} }
    return atk / (atk + def); };
  R.hit = C.hit = (src, tgt, dmg, o) => {
    o = o || {};
    if (!tgt || tgt.dead || NOT_HIT[tgt.kind]) return null;
    if (!(tgt.hpMax > 0) && !o.force) return null;
    const t = R.t;
    if (o.dot === 'burn' || o.dot === 'bleed') { o = Object.assign({}, o); o[o.dot] = o[o.dot] === true || o[o.dot] == null ? 3 : o[o.dot]; o.dot = 0; }
    const dot = !!o.dot;
    if (!dot && tgt.inv > t) { if (tgt.kind === 'player' && R.fx && fn(R.fx, 'num') && !o.silent) R.fx.num(tgt.x, tgt.y - 30, 'DODGE', '#9fb6c9'); return { src, tgt, dmg: 0, crit: false, kind: o.kind || 'phys', blocked: true, absorbed: 0, killed: false }; }   /* i-frames live here (the player's wrapper only covers a foreign R.hit) */
    dmg = num(dmg, (src && num(src.atk, 1)) || 1) * num(o.mult, 1);
    let crit = false;
    const kind = o.kind || (dot ? 'dot' : 'phys');
    if (!dot) {
      if (src && src.status && src.status.atkBuff > t) dmg *= 1.2;
      const def = Math.max(0, num(tgt.def, 0) * (1 - R.clamp(num(o.pierce, 0), 0, 1)));
      dmg *= C.defK(src && num(src.atk, 0) > 0 ? src.atk : dmg, def);
      if (o.crit === true) crit = true;
      else { let cc = typeof o.crit === 'number' ? o.crit : (src ? num(src.crit, 0) : 0); if (cc > 1) cc /= 100; if (cc > 0 && rnd() < cc) crit = true; }
      if (crit) dmg *= num(o.critMult, 1.6);
      const res = tgt.res && num(tgt.res[kind], 0); if (res) dmg *= 1 - R.clamp(res, -1, 0.9);
    }
    dmg = Math.max(1, Math.round(dmg));
    const S = tgt.status = tgt.status || {};
    let absorbed = 0;
    if (S.shield > 0) { absorbed = Math.min(S.shield, dmg); S.shield -= absorbed; dmg -= absorbed; if (S.shield <= 0.001) { S.shield = 0; R.bus.emit('shieldbreak', tgt, src); } }
    tgt.hp -= dmg;
    if (src) tgt.lastHitBy = src;
    if (!dot) {
      if (!o.noAnim && tgt.anim !== 'die') { tgt.anim = 'hurt'; tgt.animT = 0; tgt.hurtT = t + 0.25; }
      if (o.knock && !(tgt.kind === 'boss' || tgt.noKnock)) {
        let k; if (src && (src.x !== tgt.x || src.y !== tgt.y)) k = norm(tgt.x - src.x, tgt.y - src.y); else k = { x: tgt.face < 0 ? -1 : 1, y: 0 };
        C.moveEnt(tgt, k.x * o.knock, k.y * o.knock);
      }
      const bossK = tgt.kind === 'boss' ? 0.3 : 1;
      if (o.stun) S.stun = Math.max(S.stun || 0, t + o.stun * bossK);
      if (o.slow && !tgt.slowImmune) S.slow = Math.max(S.slow || 0, t + o.slow);
      const full = dmg + absorbed;
      if (o.burn) { S.burn = t + (o.burn === true ? 3 : o.burn); S.burnT = t + 0.5; S.burnDmg = Math.max(1, Math.round(full * 0.04)); S.burnSrc = src || null; }
      if (o.bleed) { S.bleed = t + (o.bleed === true ? 3 : o.bleed); S.bleedT = t + 0.5; S.bleedDmg = Math.max(1, Math.round(full * 0.04)); S.bleedSrc = src || null; }
      /* a mob that is hit from outside its aggro turns on the attacker */
      if (tgt.kind === 'mob' && tgt.ai && src && src.team !== tgt.team && (src.kind === 'player' || src.kind === 'companion')) { tgt.ai.hitBy = src; tgt.ai.hitT = t; tgt.ai.provoked = true; if (tgt.temper === 'passive') tgt.hostileCol = C.TEMPER_COL.aggressive; if (!tgt.ai.off && !tgt.ai.tgt) { tgt.ai.tgt = src; tgt.ai.st = 'chase'; tgt.ai.lost = 0; } }
    }
    const info = { src, tgt, dmg, crit, kind, dot, absorbed, blocked: false, killed: false, knock: num(o.knock, 0), o };
    C.stats.hits++;
    R.bus.emit('hit', info);
    if (!o.silent) {
      if (R.fx && fn(R.fx, 'num')) {
        const col = tgt.team === 0 ? '#ff6b6b' : crit ? '#ffd24a' : kind === 'fire' ? '#ff9a3c' : kind === 'ice' ? '#9fe3ff' : kind === 'holy' ? '#ffe88a' : kind === 'dot' ? '#d98f6a' : '#f3f3f3';
        R.fx.num(tgt.x, tgt.y - (tgt.r || 14) * 1.6, (crit ? '!' : '') + (absorbed && !dmg ? 'shield' : dmg), col, crit);
      }
      if (R.sfx && fn(R.sfx, 'play') && !dot) R.sfx.play(crit ? 'crit' : 'hit', crit ? 1 : 0.7);
    }
    if (tgt.hp <= 0 && !tgt.dead) {
      info.killed = true;
      if (tgt.kind === 'player') { if (fn(tgt, 'die')) tgt.die(src); else { R.kill(tgt); R.bus.emit('death', src); } }
      else R.kill(tgt);
    }
    return info;
  };
  C.heal = (src, tgt, n) => { if (!live(tgt) || !(n > 0)) return 0; const h = Math.min(Math.round(n), Math.max(0, tgt.hpMax - tgt.hp)); if (h <= 0) return 0; tgt.hp += h; R.bus.emit('heal', { src, tgt, n: h }); if (R.fx && fn(R.fx, 'num')) R.fx.num(tgt.x, tgt.y - (tgt.r || 14) * 1.6, '+' + h, '#7fd06a'); return h; };

  /* ---- projectiles: R.shoot(src, dx, dy, o) → entity {kind:'proj', vx, vy, dmg, team, src, ttl, col, drawKind:'arrow', len:10} ---- */
  const PASS = ['kind', 'knock', 'stun', 'slow', 'burn', 'bleed', 'crit', 'critMult', 'pierceDef'];
  R.shoot = C.shoot = (src, dx, dy, o) => {
    o = o || {}; const n = norm(dx, dy), sp = num(o.speed, 520), range = num(o.range, 420);
    const ho = {}; for (const k of PASS) if (o[k] != null) ho[k] = o[k]; if (ho.pierceDef != null) { ho.pierce = ho.pierceDef; delete ho.pierceDef; }
    const p = R.spawn({ kind: 'proj', x: src.x + n.x * ((src.r || 10) + 4), y: src.y + n.y * ((src.r || 10) + 4), r: 3, hpMax: 0, hp: 0,
      vx: n.x * sp, vy: n.y * sp, dmg: num(o.dmg, num(src.atk, 1)) * num(o.mult, 1), team: src.team, src, ttl: range / sp,
      ang: Math.atan2(n.y, n.x), face: n.x < 0 ? -1 : 1, col: o.col || (src.team === 0 ? '#f1dca3' : '#cfe6f3'), drawKind: o.drawKind || 'arrow', len: num(o.len, 10),
      hitR: num(o.hitR, C.PROJ_HIT), o: ho, pierce: num(o.pierce, 0) | 0, hitIds: [], fly: true, z: num(o.z, 18) });
    p.hpMax = 0; p.hp = 0;
    C.stats.shots++;
    if (R.sfx && fn(R.sfx, 'play') && !o.silent) R.sfx.play(o.sfx || 'shoot', 0.6);
    return p;
  };
  /* a 10-unit streak the renderer may call for kind 'proj' (it owns the entity draw loop) */
  C.drawProj = (ctx, p) => { const a = R.w2s(p.x, p.y, p.z || 0), n = norm(p.vx, p.vy), z = R.cam.z || 1, b = R.w2s(p.x - n.x * p.len, p.y - n.y * p.len, p.z || 0); ctx.strokeStyle = p.col || '#f1dca3'; ctx.lineWidth = Math.max(1, 2 * z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

  /* ---- R.attack(src, o): player / companion / skill attacks ----
     o: { kind:'melee'|'ranged', arc (deg, melee 90), range (melee src.r+40, ranged 420), dmg (src.atk), mult, max (melee 3), dir/at/ang, auto (ranged aim, default on),
          speed, knock, stun, slow, burn, bleed, crit, kind2 → damage kind via o.dmgKind, noAnim }
     returns { kind, dir, hits:[hit infos], targets:[entities], proj } */
  R.attack = C.attack = (src, o) => {
    o = o || {}; if (!src || src.dead) return null;
    const dir = C.faceDir(src, o), ho = { kind: o.dmgKind || o.element || 'phys', knock: o.knock, stun: o.stun, slow: o.slow, burn: o.burn, bleed: o.bleed, crit: o.crit, critMult: o.critMult, pierce: o.pierceDef };
    const dmg = num(o.dmg, num(src.atk, 1)) * num(o.mult, 1);
    if (dir.x) src.face = dir.x < 0 ? -1 : 1;
    if (!o.noAnim) { src.anim = 'attack'; src.animT = 0; src.atkT = R.t + 0.3; }
    const out = { kind: o.kind || 'melee', dir, hits: [], targets: [], proj: null };
    if (out.kind === 'ranged') {
      const range = num(o.range, 420); let aim = dir;
      if (o.auto !== false && !o.at && !o.dir) { let best = null, bd = 1e18; for (const t of R.ents) { if (!hittable(t) || t.team === src.team || t.team === 2) continue; const d2 = (t.x - src.x) ** 2 + (t.y - src.y) ** 2; if (d2 > range * range || d2 >= bd || !C.inCone(src, dir, t, num(o.aimArc, 70))) continue; bd = d2; best = t; } if (best) aim = norm(best.x - src.x, best.y - src.y); }
      out.dir = aim;
      out.proj = C.shoot(src, aim.x, aim.y, Object.assign({}, ho, { dmg, range, speed: o.speed, col: o.col, drawKind: o.drawKind, pierce: o.pierce, sfx: o.sfx }));
      return out;
    }
    const range = num(o.range, (src.r || 14) + 40), arc = num(o.arc, 90), max = num(o.max, 3), cand = [];
    for (const t of R.ents) { if (!hittable(t) || t === src || t.team === src.team || t.team === 2) continue; const dx = t.x - src.x, dy = t.y - src.y, d = Math.hypot(dx, dy); if (d > range + (t.r || 0)) continue; if (!C.inCone(src, dir, t, arc)) continue; cand.push([d, t]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < cand.length && out.hits.length < max; i++) { const r = R.hit(src, cand[i][1], dmg, ho); if (r) { out.hits.push(r); out.targets.push(cand[i][1]); } }
    if (R.sfx && fn(R.sfx, 'play') && !o.silent) R.sfx.play(o.sfx || 'swing', 0.5);
    return out;
  };

  /* ---- R.spawnMob(type, x, y, lvl, o) ---- o: { elite, team, home, summoned, noReward, name, ai (extra), ext (merged last), kind ('boss' for A09) } */
  R.spawnMob = C.spawnMob = (type, x, y, lvl, o) => {
    o = o || {}; const D = C.defOf(type) || FALLBACK[type];
    if (!D) { console.warn('spawnMob: unknown type', type); return null; }
    if (lvl == null) { const la = R.world && (fn(R.world, 'levelAt') || null); const ra = R.world && fn(R.world, 'regionAt'); lvl = (la && la(x, y)) || (ra && ((ra(x, y) || {}).lvl || (ra(x, y) || {}).level)) || 1; if (typeof lvl !== 'number') lvl = 1; }
    lvl = Math.max(1, Math.round(lvl)); if (!o.keepLvl && o.kind !== 'boss' && !o.elite) lvl = C.homeCap(x, y, lvl);
    const base = C.statsAt(type, lvl);
    const sa = R.mobs && fn(R.mobs, 'statsAt'); let st = base;
    if (sa) { const s = sa(type, lvl); if (s && typeof s === 'object') { st = Object.assign({}, base); for (const k in s) if (typeof s[k] === 'number' || typeof s[k] === 'boolean' || typeof s[k] === 'string') st[k] = s[k]; if (s.hp != null && s.hpMax == null) st.hpMax = s.hp; } }
    const role = C.normRole(o.role || st.role || C.roleOf(D), D);
    const e = { kind: o.kind || 'mob', type, name: o.name || D.name || D.n || type, team: o.team == null ? 1 : o.team, x, y, lvl, r: st.r,
      hp: st.hpMax, hpMax: st.hpMax, atk: st.atk, def: st.def, spd: st.spd, range: st.range, aggro: num(o.aggro, st.aggro), atkCd: st.atkCd, role, fly: !!(st.fly || D.fly || D.air),
      sprite: D.sprite || D.art || D.key || type, elite: !!o.elite, xp: st.xp, gold: st.gold, crit: num(D.crit, 0.05), face: rnd() < 0.5 ? -1 : 1, vx: 0, vy: 0,
      knock: !!D.knock, charge: !!D.charge, slowImmune: !!D.slowImmune, stealth: !!D.stealth, walker: !!D.walker, wight: !!D.wight, raise: C.raiseOf(D, role),
      dmgKind: D.dmgKind || (D.ice || D.walker ? 'ice' : 'phys'), res: null, status: {}, cd: {}, anim: 'idle',
      ai: Object.assign({ st: 'idle', home: o.home || { x, y }, t: R.t + 2 + 2 * rnd(), tgt: null, lost: 0, scanT: R.t + rnd() * 0.15, to: null, summons: [] }, o.ai || {}) };
    if (D.ice) e.res = { phys: num(D.ice, 0.35), fire: -0.5 }; else if (D.physImmune) e.res = { phys: num(D.physImmune, 0.45), holy: -0.5 };
    if (o.summoned) { e.summoner = o.summoned; e.noReward = o.noReward != null ? o.noReward : false; e.xp = Math.round(e.xp * 0.5); e.gold = Math.round(e.gold * 0.3); }
    if (e.elite) { e.hpMax = Math.round(e.hpMax * 2.2); e.hp = e.hpMax; e.atk = Math.round(e.atk * 1.4); e.r *= 1.15; e.xp = Math.round(e.xp * 2.5); e.gold = Math.round(e.gold * 2.5); e.name = 'Elite ' + e.name; e.crit += 0.1; }
    if (o.noReward) e.noReward = true;
    e.temper = C.temperOf(D, o); e.hostileCol = C.TEMPER_COL[e.temper];
    if (e.temper === 'aggressive' && !C.TEST_TEMPER && o.aggro == null && e.kind === 'mob' && !e.elite && !o.event && !o.dungeon && !o.summoned) e.aggro = Math.min(e.aggro, C.RED_R + (e.fly ? 40 : 0));
    if (o.ext) Object.assign(e, o.ext);
    return R.spawn(e);
  };

  /* ---- rewards + death rules on 'kill' (core emits it for mobs and bosses, whatever killed them) ---- */
  const killedMap = () => { const a = fn(R, 'acc') && R.acc(); if (a && a.world) return (a.world.killed = a.world.killed || {}); if (R.state && R.state.acc && R.state.acc.world) return (R.state.acc.world.killed = R.state.acc.world.killed || {}); if (R.state && R.state.p) return (R.state.p.killed = R.state.p.killed || {}); return null; };
  C.xpFor = e => Math.round(num(e.xp, 0) || (6 + 3 * num(e.lvl, 1)) * (e.elite ? 2.5 : 1));
  C.goldFor = e => (e.gold != null ? e.gold : Math.round((2 + 6 * rnd()) * num(e.lvl, 1) * (e.elite ? 2.5 : 1)));
  R.bus.on('kill', (e, by) => {
    if (!e || (e.kind !== 'mob' && e.kind !== 'boss') || e.rewarded) return;
    e.rewarded = true; e.vx = e.vy = 0; if (e.ai) e.ai.st = 'dead'; C.stats.kills++;
    /* a walker's death drops every wight within 200 (the old rule) */
    if (C.isWalker(e)) for (const w of R.near(e.x, e.y, 200, m => m !== e && m.kind === 'mob' && m.team === e.team && C.isWight(m))) { w.lastHitBy = e.lastHitBy || by || e; w.hp = 0; R.kill(w); }
    if (e.summoner && e.summoner.ai && e.summoner.ai.summons) e.summoner.ai.summons = e.summoner.ai.summons.filter(s => s !== e);
    if (R.sfx && fn(R.sfx, 'play')) R.sfx.play('die', 0.6);
    if (e.noReward) { e.xpGiven = true; e.looted = true; return; }   /* the player's and the loot module's own 'kill' listeners check these */
    const K = killedMap(); if (K) K[e.type] = (K[e.type] || 0) + 1;
    const xp = C.xpFor(e);
    if (R.player && fn(R.player, 'gainXp')) R.player.gainXp(xp, e);
    else if (R.sys.player && fn(R.sys.player, 'gainXp')) R.sys.player.gainXp(xp, e);
    else if (R.state && R.state.p) { R.state.p.xp = (R.state.p.xp || 0) + xp; R.bus.emit('xp', xp); }
    e.xpGiven = true;                                   /* xp exactly once per kill, whoever else listens to 'kill' */
    e.gold = C.goldFor(e);
    if (R.loot && fn(R.loot, 'drop')) R.loot.drop(e, by);
    else if (R.state && R.state.p && e.gold > 0) { R.state.p.gold = (R.state.p.gold || 0) + e.gold; R.bus.emit('gold', e.gold); if (R.fx && fn(R.fx, 'num')) R.fx.num(e.x, e.y - 30, '+' + e.gold, '#e3b661'); }
    if (fn(R, 'save')) R.save();
  });

  /* ---- combat system (order 90): status ticks, hurt anim end, removal of dead mobs (0.8 s) and projectiles ---- */
  R.addSys('combat', { order: 90, update(dt) {
    const t = R.t, E = R.ents;
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      if (e.dead) { if (e.kind === 'proj' || (e.kind === 'mob' && e.animT >= 0.8)) E.splice(i, 1); continue; }
      if (e.hurtT && e.hurtT <= t && e.anim === 'hurt') { e.anim = 'idle'; e.hurtT = 0; }
      const S = e.status; if (!S) continue;
      if (S.burn) { if (S.burn > t) { if (t >= S.burnT) { S.burnT += 0.5; R.hit(S.burnSrc, e, S.burnDmg, { dot: 1, kind: 'fire' }); } } else S.burn = 0; }
      if (S.bleed && !e.dead) { if (S.bleed > t) { if (t >= S.bleedT) { S.bleedT += 0.5; R.hit(S.bleedSrc, e, S.bleedDmg, { dot: 1, kind: 'bleed' }); } } else S.bleed = 0; }
    }
  } });

  /* ---- mob AI system (order 100) ---- */
  const nearestFoe = (e, foes, r) => { let best = null, bd = r * r; for (const f of foes) { if (f.stealthHidden) continue; const d2 = (f.x - e.x) ** 2 + (f.y - e.y) ** 2; if (d2 <= bd) { bd = d2; best = f; } } return best; };
  C.nearestFoe = nearestFoe;
  /* a pack aggro cap: a mob only joins while fewer than maxChasers(hero) already chase him (2 for a level 1–3 hero, then
     balance.aggro.maxPack(L)); a mob the hero hits always turns on him (R.hit sets ai.tgt) */
  C.maxChasers = f => { const L = Math.max(1, num(f && f.lvl, 1)); if (L <= 3) return 2; const B = R.data.balance; try { if (B && B.aggro && typeof B.aggro.maxPack === 'function') return Math.max(2, B.aggro.maxPack(L) | 0); } catch (x) {} return Math.min(6, 2 + Math.floor(L / 2)); };
  C.chasers = f => { let n = 0; for (const m of R.ents) if (m.ai && m.ai.tgt === f && !m.dead && (m.kind === 'mob' || m.kind === 'boss')) n++; return n; };
  function roles(e, foes, t) {
    const a = e.ai, cd = e.cd;
    if (e.role === 'healer' && t >= (cd.heal || 0)) {
      let did = 0; for (const m of R.ents) { if (m.dead || m.team !== e.team || !(m.hpMax > 0) || m.hp >= m.hpMax || (m.kind !== 'mob' && m.kind !== 'boss')) continue; if ((m.x - e.x) ** 2 + (m.y - e.y) ** 2 > 200 * 200) continue; did += C.heal(e, m, m.hpMax * 0.08); }
      if (did) { cd.heal = t + 4; if (R.fx && fn(R.fx, 'spawn')) R.fx.spawn('heal', e.x, e.y, { r: 200 }); if (R.sfx && fn(R.sfx, 'play')) R.sfx.play('heal', 0.5); }
    }
    if (e.role === 'caster' && a.tgt && e.raise && t >= (cd.raise || 0)) {
      cd.raise = t + 8; a.summons = (a.summons || []).filter(s => !s.dead);
      if (a.summons.length < 3) { const ang = rnd() * TAU; const w = R.spawnMob(e.raise, e.x + Math.cos(ang) * 40, e.y + Math.sin(ang) * 40, e.lvl, { team: e.team, summoned: e }); if (w) { w.ai.tgt = a.tgt; w.ai.st = 'chase'; a.summons.push(w); if (R.fx && fn(R.fx, 'spawn')) R.fx.spawn('raise', w.x, w.y); } }
    }
    if (e.role === 'chief' && a.tgt && t >= (cd.buff || 0)) {
      cd.buff = t + 10; for (const m of R.ents) { if (m.dead || m.team !== e.team || (m.kind !== 'mob' && m.kind !== 'boss')) continue; if ((m.x - e.x) ** 2 + (m.y - e.y) ** 2 > 200 * 200) continue; m.status.atkBuff = t + 5; }
      if (R.fx && fn(R.fx, 'spawn')) R.fx.spawn('warcry', e.x, e.y, { r: 200 });
    }
  }
  function doAttack(e, T, foes) {
    const dx = T.x - e.x, dy = T.y - e.y, d = Math.hypot(dx, dy) || 1, reach = e.range + (T.r || 0);
    if (e.role === 'ranged' || e.role === 'caster') { if (d > reach * 1.3) return; C.shoot(e, dx, dy, { dmg: e.atk, range: e.range * 1.4, speed: e.role === 'caster' ? 360 : 420, kind: e.dmgKind, col: e.projCol || (e.role === 'caster' ? '#9fe3ff' : null), drawKind: e.role === 'caster' ? 'bolt' : 'arrow' }); return; }
    if (d > reach * 1.25) return;
    const dir = { x: dx / d, y: dy / d }; let n = 0;
    for (const f of foes) { if (f.dead) continue; const fd = Math.hypot(f.x - e.x, f.y - e.y); if (fd > e.range + (f.r || 0) + (f === T ? reach * 0.25 : 0)) continue; if (f !== T && !C.inCone(e, dir, f, C.CONE)) continue;
      R.hit(e, f, e.atk, { kind: e.dmgKind, knock: e.knock ? 50 : 0, stun: e.stunHit || 0, slow: e.dmgKind === 'ice' ? 1.2 : 0 }); if (++n >= 3) break; }
    if (R.sfx && fn(R.sfx, 'play')) R.sfx.play('swing', 0.4);
  }
  function stepMob(e, dt, foes) {
    const a = e.ai, S = e.status, t = R.t;
    if (S.stun > t) { e.vx = e.vy = 0; if (e.anim === 'walk' || e.anim === 'attack') e.anim = 'idle'; return; }
    const slow = S.slow > t ? 0.5 : 1;
    roles(e, foes, t);
    if (a.tgt && (a.tgt.dead || a.tgt.hp <= 0)) a.tgt = null;
    if (t >= a.scanT) {
      a.scanT = t + 0.15; if (a.tgt && R.ents.indexOf(a.tgt) < 0) a.tgt = null;
      if (a.tgt && !e.koIn && C.safeAt(a.tgt.x, a.tgt.y, e) && !(a.hitBy === a.tgt && t - (a.hitT || -9) < 4)) a.tgt = null;   /* the hero reached a refuge */
      if (!a.tgt && C.isPassive(e)) { /* a passive mob never picks a fight */ }
      else if (!a.tgt) { const f = nearestFoe(e, foes, e.aggro); if (f && !C.safeAt(f.x, f.y, e) && C.chasers(f) < C.maxChasers(f) && (e.fly || C.los(e, f))) { a.tgt = f; a.st = 'chase'; a.lost = 0; } }
      else { const d = R.dist(e, a.tgt); if (d > e.aggro * 1.6) a.tgt = null; else if (!e.fly && !C.los(e, a.tgt)) { a.lost += 0.15; if (a.lost > 6) a.tgt = null; } else a.lost = 0; }
      if (!a.tgt && a.provoked && e.temper === 'passive') { a.provoked = false; e.hostileCol = C.TEMPER_COL.passive; }   /* lost him: calm again */
      if (!a.tgt && (a.st === 'chase' || a.st === 'attack')) { a.st = 'idle'; a.t = t + 0.5 + rnd(); if (e.anim === 'attack') e.anim = 'idle'; }
    }
    if (e.role === 'healer') { if (a.st !== 'flee' && a.tgt && e.hp < 0.3 * e.hpMax) a.st = 'flee'; else if (a.st === 'flee' && (e.hp >= 0.5 * e.hpMax || !a.tgt)) { a.st = a.tgt ? 'chase' : 'idle'; a.t = t + 1; } }
    let mx = 0, my = 0;
    switch (a.st) {
      case 'idle':
        if (t >= a.t) { const far = (e.x - a.home.x) ** 2 + (e.y - a.home.y) ** 2 > 400 * 400; const ang = rnd() * TAU, rad = 50 + 70 * rnd(); a.to = far ? { x: a.home.x, y: a.home.y } : { x: a.home.x + Math.cos(ang) * rad, y: a.home.y + Math.sin(ang) * rad }; a.st = 'wander'; a.t = t + 4; }
        break;
      case 'wander': { const dx = a.to.x - e.x, dy = a.to.y - e.y, d = Math.hypot(dx, dy); if (d < 6 || t >= a.t) { a.st = 'idle'; a.t = t + 2 + 2 * rnd(); } else { const s = e.spd * 0.45 * slow * dt; mx = dx / d * Math.min(s, d); my = dy / d * Math.min(s, d); } break; }
      case 'chase': {
        const T = a.tgt; if (!T) { a.st = 'idle'; a.t = t + 1; break; }
        const dx = T.x - e.x, dy = T.y - e.y, d = Math.hypot(dx, dy) || 1e-6; e.face = dx < 0 ? -1 : 1; const reach = e.range + (T.r || 0);
        if (d <= reach) { if (t >= (e.cd.atk || 0)) { a.st = 'attack'; a.atT = t + C.WINDUP; if (e.anim !== 'hurt') { e.anim = 'attack'; e.animT = 0; } } }
        else { const s = e.spd * (e.charge && d > 120 ? 1.3 : 1) * slow * dt, step = Math.min(s, d - reach * 0.9); mx = dx / d * step; my = dy / d * step; }
        break; }
      case 'attack': {
        const T = a.tgt; if (!T) { a.st = 'idle'; a.t = t + 1; break; }
        e.face = T.x < e.x ? -1 : 1;
        if (t >= a.atT) { doAttack(e, T, foes); e.cd.atk = t + e.atkCd; a.st = 'chase'; if (e.anim === 'attack') e.anim = 'idle'; }
        break; }
      case 'flee': {
        const f = nearestFoe(e, foes, e.aggro * 1.6); if (!f) { a.st = 'idle'; a.t = t + 1; break; }
        const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy) || 1; const s = e.spd * slow * dt; mx = dx / d * s; my = dy / d * s; e.face = dx < 0 ? -1 : 1;
        break; }
    }
    if (mx || my) { C.moveEnt(e, mx, my); e.vx = mx / dt; e.vy = my / dt; if (e.anim !== 'hurt' && e.anim !== 'attack') e.anim = 'walk'; }
    else { e.vx = e.vy = 0; if (e.anim === 'walk') e.anim = 'idle'; }
  }
  /* mobs push apart by their radius sum; a mob also steps off a player it overlaps (the player is never moved) */
  function separate(mobs, foes) {
    for (let i = 0; i < mobs.length; i++) {
      const a = mobs[i];
      for (let j = i + 1; j < mobs.length; j++) {
        const b = mobs[j]; if (a.fly !== b.fly) continue; const min = a.r + b.r, dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
        let d = Math.hypot(dx, dy); if (d >= min) continue; let ux, uy; if (d < 1e-6) { const ang = rnd() * TAU; ux = Math.cos(ang); uy = Math.sin(ang); d = 0; } else { ux = dx / d; uy = dy / d; }
        const p = (min - d) / 2; a.x -= ux * p; a.y -= uy * p; b.x += ux * p; b.y += uy * p;
      }
      for (const f of foes) { const min = a.r + (f.r || 14) - 2, dx = a.x - f.x, dy = a.y - f.y; if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue; const d = Math.hypot(dx, dy); if (d >= min) continue; if (d < 1e-6) { a.x += min; continue; } const p = min - d; a.x += dx / d * p; a.y += dy / d * p; }
    }
  }
  R.addSys('ai', { order: 100, update(dt) {
    const mobs = [], foes = [];
    for (const e of R.ents) { if (e.dead) continue; if (e.kind === 'mob') { if (e.ai && !e.ai.off) mobs.push(e); } else if (e.team === 0 && (e.kind === 'player' || e.kind === 'companion') && e.hp > 0) foes.push(e); }
    for (const e of mobs) stepMob(e, dt, foes);
    separate(mobs, foes);
    for (const e of mobs) C.keepOut(e);
  } });

  /* ---- projectile system (order 105): move, hit the first enemy within hitR, expire ---- */
  R.addSys('proj', { order: 105, update(dt) {
    const bl = R.world && fn(R.world, 'blocked');
    for (let i = R.ents.length - 1; i >= 0; i--) {
      const p = R.ents[i]; if (p.kind !== 'proj') continue;
      if (p.dead) { R.ents.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.ttl -= dt;
      if (p.ttl <= 0 || p.x < 0 || p.y < 0 || p.x > (R.W || 1e9) || p.y > (R.H || 1e9) || (bl && !p.ignoreMask && bl(p.x, p.y))) { p.dead = true; R.ents.splice(i, 1); R.bus.emit('projend', p); continue; }
      let best = null, bd = 1e18;
      for (const t of R.ents) { if (!hittable(t) || t.team === p.team || t.team === 2 || t === p.src) continue; if (p.hitIds.indexOf(t.id) >= 0) continue; const rr = Math.max(p.hitR, t.r || 0); const d2 = (t.x - p.x) ** 2 + (t.y - p.y) ** 2; if (d2 <= rr * rr && d2 < bd) { bd = d2; best = t; } }
      if (!best) continue;
      const res = R.hit(p.src, best, p.dmg, p.o);
      if (res && res.blocked) continue;            /* a dodging target lets the arrow pass */
      p.hitIds.push(best.id); p.hits = (p.hits || 0) + 1;
      if (p.hits > p.pierce) { p.dead = true; R.ents.splice(i, 1); R.bus.emit('projend', p, best); }
    }
  } });
})();
