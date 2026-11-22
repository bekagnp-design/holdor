/* 12_mobs.js — R.data.mobs: every enemy of the old game as an RPG mob, plus six living variants.          (A08)

   Balance is anchored to the player formulas in ARCH.md so the curve holds from level 1 to 60:
     reference player at level L (no gear; the knight's auto points: +1.5 str, +1 vit per level):
       atk = 10 + 2L + 1.5·str      hp = 120 + 18L + 6·vit      def = 4 + 1.2L + 0.6·vit
     dmg(atk, def) = atk² / (atk + def)   — R.data.balance.dmg(atk, def) replaces it when A39 defines one; R.hit (A11) should use the same.
     a common mob dies in 4.8 × hm reference hits (hm 0.85–1.3 → 4–7 hits) and one of its hits takes 6 % × am of the player's hp (×0.7 at level 1 → ×1 at 8);
     elite ×3 hp ×1.5 atk; brute ×2–2.4 hp ×1.6–2 atk with slow swings; boss (lord, king, dragon — A09's keys) ×12 hp ×2 atk.
   A compounding "×1.18 per level" cannot hold against the player's linear curve (1.18^59 ≈ 17 000), so `scale` on each mob
   is the REAL hp/atk growth from level 1 to 2 (≈1.17 / ≈1.16); it tapers with the player's curve. statsAt() is the authority.

   Data shape, R.data.mobs[key] = { key, name, sprite, arch, role, tier, icon, pal, tint?, size, fly,
     base:{hp,atk,def,spd,r,aggro,range,atkCd} (level 1), scale:{hp,atk}, traits:[…], p:{trait:params}, res:{phys,fire,ice,holy},
     xp (level 1), gold:[min,max] (per level: ARCH "2–8 × level"), drops:{potion,gear,mat,gem?} }
   Helpers, R.mobs: statsAt(key,lvl)  pick(table,rng)  list(tier)  forLevel(lvl)  tierFor(lvl)  tableFor(lvl) / tableForTier(t)  make(key,lvl,x,y)
     spawn(key,lvl,x,y)  hitsToKill(key,lvl)  ref(lvl)  dmg(atk,def)  describe(key)  table(levels)  TIERS  ROLE  TRAITS  keys
*/
(function () {
  const R = window.R = window.R || {}; R.data = R.data || {};
  const HITS = 4.8, HIT_PCT = 0.06;                     // reference hits to kill a common (hm 1), its hit as a share of the player's hp
  // the first levels are gentler (one skill, no armour, a tutorial pack of three): ×0.7 at level 1 → ×1 at level 8 (docs/rpg-balance.md rule 3)
  const hitPctAt = L => HIT_PCT * (L >= 8 ? 1 : 0.7 + 0.3 * (Math.max(1, L) - 1) / 7);
  const round1 = v => Math.round(v * 10) / 10, round2 = v => Math.round(v * 100) / 100;
  const bal = () => R.data.balance || null;

  /* ---- the reference player and the damage formula ---- */
  const ref = L => { const str = 5 + 1.5 * (L - 1), vit = 5 + (L - 1); return { lvl: L, str, vit, atk: 10 + 2 * L + 1.5 * str, hp: 120 + 18 * L + 6 * vit, def: 4 + 1.2 * L + 0.6 * vit }; };
  const dmg = (a, d) => { const B = bal(); if (B && typeof B.dmg === 'function') return B.dmg(a, d); d = Math.max(0, d); return a * a / (a + d); };
  // the atk that deals D through def d: a²/(a+d)=D → a=(D+√(D²+4Dd))/2; with a foreign formula, bisection (dmg must grow with atk)
  const atkFor = (D, d) => { const B = bal(); if (!(B && typeof B.dmg === 'function')) return (D + Math.sqrt(D * D + 4 * D * d)) / 2;
    let lo = 0, hi = 4 * D + 4 * d + 10; for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (B.dmg(m, d) < D) lo = m; else hi = m; } return hi; };
  const xpNeed = L => { const B = bal(); return B && typeof B.xpNext === 'function' ? B.xpNext(L) : 80 + 45 * L + 6 * L * L; };
  const xpAt = (L, xm) => Math.max(1, Math.round(xpNeed(L) / (10 + 0.14 * L) * xm));       // ~10 same-level kills per level at 1, ~18 at 60
  const goldAt = (L, gm) => [Math.max(1, Math.round(2 * L * gm)), Math.max(2, Math.round(8 * L * gm))];

  /* ---- roles: multipliers on the anchor + behaviour defaults.  w = weight in a default spawn table ---- */
  const D0 = { potion: 0.08, gear: 0.04, mat: 0.2 };
  const ROLE = {
    melee:    { hm: 1,    am: 1,   dm: 0.6, aggro: 300, range: 36,  cd: 1.0, xm: 1,   gm: 1,   w: 10, drops: D0 },
    ranged:   { hm: 0.85, am: 0.8, dm: 0.4, aggro: 360, range: 240, cd: 1.4, xm: 1,   gm: 1,   w: 6,  drops: D0 },
    caster:   { hm: 1,    am: 1.1, dm: 0.4, aggro: 380, range: 220, cd: 1.6, xm: 1.2, gm: 1.2, w: 3,  drops: D0 },
    healer:   { hm: 1.1,  am: 0.5, dm: 0.6, aggro: 320, range: 36,  cd: 1.4, xm: 1.3, gm: 1.3, w: 2,  drops: D0 },
    summoner: { hm: 1,    am: 0.7, dm: 0.5, aggro: 340, range: 220, cd: 1.8, xm: 1.5, gm: 1.5, w: 2,  drops: D0 },
    fly:      { hm: 0.85, am: 0.7, dm: 0.3, aggro: 420, range: 36,  cd: 1.0, xm: 1,   gm: 0.8, w: 5,  drops: D0 },
    brute:    { hm: 2.2,  am: 1.6, dm: 0.8, aggro: 280, range: 44,  cd: 1.6, xm: 2,   gm: 1.8, w: 2,  drops: { potion: 0.12, gear: 0.08, mat: 0.3 } },
    elite:    { hm: 3,    am: 1.5, dm: 0.9, aggro: 340, range: 40,  cd: 1.2, xm: 3,   gm: 3,   w: 1,  drops: { potion: 0.2, gear: 0.15, mat: 0.5 } },
    boss:     { hm: 12,   am: 2,   dm: 1,   aggro: 420, range: 48,  cd: 1.5, xm: 12,  gm: 12,  w: 0,  drops: { potion: 1, gear: 1, mat: 1, gem: 1 } },
  };

  /* ---- traits: what the old battle did, as parameters for the mob AI (A11) ---- */
  const TRAITS = {
    undead:     { d: 'raised dead: falls when a White Walker dies near it; holy ×1.5, fire ×1.3, ice ×0.7' },
    pack:       { d: 'spawns in a group', n: 3 },
    swarm:      { d: 'small and many: less xp and gold' },
    charge:     { d: 'speeds up when closing in', from: 230, mul: 1.35 },
    knock:      { d: 'its hit knocks the target back', dist: 60, stun: 0.4 },
    stagger:    { d: 'a slow swing that knocks back and stuns (giants stagger)', dist: 90, stun: 0.8 },
    enrage:     { d: 'below half hp: faster and harder', at: 0.5, spd: 1.4, atk: 1.5 },
    split:      { d: 'on death breaks into smaller wights', key: 'axe', n: 2 },
    raise:      { d: 'raises undead that fell nearby (necromancers raise)', every: 8, n: 2, window: 14, r: 220 },
    heal:       { d: 'heals allies around it (healers heal)', every: 1, r: 110, pct: 0.04 },
    haste:      { d: 'allies around it move faster (chieftains buff)', r: 120, spd: 1.2 },
    summon:     { d: 'calls more of its kind', key: 'spider', n: 3, every: 8, max: 6 },
    ranged:     { d: 'shoots from base.range (archers shoot)', proj: 'arrow' },
    reach:      { d: 'a long weapon: hits from farther' },
    fly:        { d: 'flies over blocked ground (birds fly)' },
    hunt:       { d: 'picks the weakest target in sight (a wounded hero, a caster) first' },
    stealth:    { d: 'unseen beyond reveal units; the first hit out of hiding is doubled', reveal: 62, ambush: 2 },
    web:        { d: 'its hit slows', slow: 0.5, dur: 1.5 },
    frost:      { d: 'its hit chills: slower and weaker', slow: 0.6, dur: 2 },
    armored:    { d: 'physical damage reduced', phys: 0.7 },
    shielded:   { d: 'projectiles reduced', proj: 0.55 },
    ghostly:    { d: 'most physical damage passes through', phys: 0.45 },
    unslowable: { d: 'immune to slows' },
    fall:       { d: 'when it dies, the undead around it fall too (not bosses, not other walkers)', r: 90 },
    strafe:     { d: 'sweeps the ground with fire from the air', every: 6 },
    mounted:    { d: 'rides: fast, tramples on a charge' },
    boss:       { d: 'a boss (R.data.bosses, A09): phases and telegraphs' },
  };
  const RES = { undead: { holy: 1.5, fire: 1.3, ice: 0.7 }, ghostly: { phys: 0.45, holy: 1.5 }, armored: { phys: 0.7 } };

  /* ---- the rows: key, name, sprite, arch, role, tier, old speed, old radius, traits, overrides
     old speed 22–96 → 90–160 u/s; old radius 5–18 → hit radius 8 + r×1.3.  Overrides: hm am dm (hp/atk/def multipliers), range, cd, aggro, tint, size, res, p, xm, gm */
  const ROWS = [
    // tier 1 — the first fields around the seats (levels 1–10)
    ['axe', 'Wight axeman', 'axe', 'man', 'melee', 1, 56, 7, ['undead'], { icon: '🪓', pal: '#3a4656' }],
    ['sword', 'Wight swordsman', 'sword', 'man', 'melee', 1, 44, 8, ['undead'], { icon: '🗡️', pal: '#3a4656', hm: 1.2, am: 1.1, dm: 0.7 }],
    ['archer', 'Wight archer', 'archer', 'man', 'ranged', 1, 48, 7, ['undead', 'ranged'], { icon: '🏹', pal: '#3f4a3a' }],
    ['child', 'Wight child', 'child', 'man', 'melee', 1, 80, 5, ['undead', 'swarm'], { icon: '👶', pal: '#48545f', hm: 0.85, am: 0.6, dm: 0.4, cd: 0.7, xm: 0.6, gm: 0.6 }],
    ['hound', 'Wight hound', 'hound', 'beast', 'melee', 1, 88, 7, ['undead', 'pack', 'swarm'], { icon: '🐕', pal: '#4a4a52', hm: 0.85, am: 0.7, dm: 0.4, cd: 0.7, xm: 0.7, gm: 0.6 }],
    ['bat', 'Cave bat', 'bat', 'bird', 'fly', 1, 96, 6, ['fly', 'pack', 'swarm'], { icon: '🦇', pal: '#2a2430', am: 0.6, xm: 0.6, gm: 0.5 }],
    ['crawler', 'Crawler', 'crawler', 'beast', 'melee', 1, 34, 7, ['undead', 'unslowable'], { icon: '🦴', pal: '#8e9299', dm: 0.7 }],
    ['bandit', 'Bandit', 'axe', 'man', 'melee', 1, 56, 7, [], { icon: '🪓', tint: '#6b4a2a', gm: 1.3 }],
    ['bandit_archer', 'Bandit archer', 'archer', 'man', 'ranged', 1, 48, 7, ['ranged'], { icon: '🏹', tint: '#5e4a2e', gm: 1.3 }],
    ['brownbear', 'Brown bear', 'hound', 'beast', 'brute', 1, 44, 12, ['knock'], { icon: '🐻', tint: '#5a3d22', size: 1.6, hm: 2.2, am: 1.6, dm: 0.8 }],
    // tier 2 — the roads between the castles (8–22)
    ['spear', 'Wight spearman', 'spear', 'man', 'melee', 2, 42, 8, ['undead', 'reach'], { icon: '🔱', pal: '#36404e', hm: 1.2, am: 1.2, dm: 0.7, range: 52, cd: 1.2 }],
    ['shield', 'Wight shieldman', 'shield', 'man', 'melee', 2, 38, 8, ['undead', 'shielded'], { icon: '🛡️', pal: '#414b58', hm: 1.3, am: 0.8, dm: 1.5, cd: 1.3 }],
    ['crypt', 'Crypt wight', 'crypt', 'man', 'melee', 2, 44, 8, ['undead', 'split'], { icon: '🪦', pal: '#4a4550', hm: 1.2, am: 0.9, dm: 0.7 }],
    ['berserk', 'Frenzied wight', 'berserk', 'man', 'melee', 2, 50, 8, ['undead', 'enrage'], { icon: '😤', pal: '#5a3a3a', hm: 1.1, am: 1.2, dm: 0.5 }],
    ['wolf', 'Wight direwolf', 'wolf', 'beast', 'melee', 2, 78, 9, ['undead', 'pack'], { icon: '🐺', pal: '#5b626c', hm: 1.2, am: 1.1 }],
    ['boar', 'Wight boar', 'boar', 'beast', 'brute', 2, 70, 9, ['undead', 'charge'], { icon: '🐗', pal: '#4b4038', hm: 2, am: 1.6 }],
    ['cat', 'Shadowcat', 'cat', 'beast', 'melee', 2, 74, 8, ['stealth'], { icon: '🐈‍⬛', pal: '#20242c', am: 1.2, dm: 0.5, aggro: 260 }],
    ['raven', 'Dead raven', 'raven', 'bird', 'fly', 2, 92, 6, ['undead', 'fly', 'hunt', 'swarm'], { icon: '🐦‍⬛', pal: '#1c2029', am: 0.5, xm: 0.6, gm: 0.5 }],
    ['spider', 'Ice spider', 'spider', 'spider', 'melee', 2, 68, 8, ['web', 'unslowable'], { icon: '🕷️', pal: '#2b3d4d', am: 0.9, dm: 0.5, res: { ice: 0.5 } }],
    ['raider', 'Wildling raider', 'sword', 'man', 'melee', 2, 50, 8, [], { icon: '⚔️', tint: '#7a5a3a', hm: 1.1, am: 1.1, gm: 1.3 }],
    ['spearwife', 'Spearwife', 'spear', 'man', 'melee', 2, 52, 8, ['reach'], { icon: '🔱', tint: '#8a6a4a', hm: 1.1, am: 1.2, range: 52, cd: 1.2, gm: 1.3 }],
    ['direwolf', 'Direwolf', 'hound', 'beast', 'elite', 2, 86, 9, ['charge'], { icon: '🐺', tint: '#e8eef5', size: 1.5, dm: 0.7, aggro: 380 }],
    // tier 3 — the Neck, the Riverlands' edges, the Gift (20–35)
    ['thenn', 'Thenn wight', 'thenn', 'man', 'melee', 3, 40, 9, ['undead', 'armored'], { icon: '🪓', pal: '#2f3c46', hm: 1.3, am: 1.2, dm: 1.4 }],
    ['necro', 'Cold necromancer', 'necro', 'man', 'summoner', 3, 32, 9, ['undead', 'raise', 'ranged'], { icon: '💀', pal: '#1e2b3a' }],
    ['skin', 'Skinchanger', 'skin', 'man', 'healer', 3, 34, 9, ['heal'], { icon: '🧿', pal: '#2c4030' }],
    ['chief', 'Wildling chieftain', 'chief', 'man', 'elite', 3, 36, 10, ['haste'], { icon: '⚔️', pal: '#4a3a2a' }],
    ['bear', 'Wight bear', 'bear', 'beast', 'brute', 3, 46, 13, ['undead', 'knock'], { icon: '🐻', pal: '#3d3a36', hm: 2.4, am: 1.8, dm: 0.9 }],
    ['elk', 'Undead elk', 'elk', 'beast', 'brute', 3, 60, 11, ['undead', 'charge'], { icon: '🦌', pal: '#4a4238', hm: 2.2, am: 1.6 }],
    ['rider', 'Wight rider', 'rider', 'mount', 'melee', 3, 78, 9, ['undead', 'mounted', 'charge'], { icon: '🐴', pal: '#414c5c', hm: 1.2, am: 1.1, dm: 0.7, range: 44 }],
    ['eagle', 'Ice eagle', 'eagle', 'bird', 'fly', 3, 82, 8, ['fly'], { icon: '🦅', pal: '#5d6a78', hm: 1.1, am: 1, dm: 0.4 }],
    // tier 4 — the Wall and the Haunted Forest (33–48)
    ['brood', 'Broodmother', 'brood', 'spider', 'elite', 4, 40, 14, ['summon', 'web', 'unslowable'], { icon: '🕸️', pal: '#33485c', am: 1.3, res: { ice: 0.5 } }],
    ['giant', 'Wight giant', 'giant', 'man', 'brute', 4, 26, 14, ['undead', 'armored', 'stagger'], { icon: '🗿', pal: '#3d4a5b', hm: 2.4, am: 2, dm: 1.1, range: 56, cd: 1.8 }],
    ['outrider', 'Walker outrider', 'outrider', 'mount', 'melee', 4, 70, 11, ['undead', 'mounted', 'charge', 'frost'], { icon: '🐎', pal: '#33506a', hm: 1.3, am: 1.2, dm: 0.9, range: 44, res: { ice: 0.5 } }],
    ['wraith', 'Ice wraith', 'wraith', 'wraith', 'caster', 4, 52, 9, ['undead', 'ghostly', 'frost', 'ranged'], { icon: '👻', pal: '#8fd3ff', res: { ice: 0.3 } }],
    ['mammoth', 'Wight mammoth', 'mammoth', 'beast', 'elite', 4, 22, 17, ['undead', 'armored', 'stagger'], { icon: '🦣', pal: '#4a4038', dm: 1.3, range: 60, cd: 1.8, p: { stagger: { dist: 110, stun: 1 } } }],
    // tier 5 — the Lands of Always Winter (46–60)
    ['walker', 'White Walker', 'walker', 'man', 'elite', 5, 40, 9, ['frost', 'fall', 'armored'], { icon: '❄️', pal: '#cfe6f3', dm: 1, res: { ice: 0.2, fire: 1.5 } }],
    ['shade', 'Cold shade', 'shade', 'wraith', 'caster', 5, 48, 9, ['undead', 'ghostly', 'stealth', 'unslowable', 'frost', 'ranged'], { icon: '🌫️', pal: '#a7c6dc', hm: 1.1, am: 1.2, dm: 0.5, aggro: 260, res: { phys: 0.6, ice: 0.3 } }],
    // bosses — base stats only; R.data.bosses (A09) owns their phases
    ['lord', 'Walker Lieutenant', 'lord', 'man', 'boss', 'boss', 34, 11, ['boss', 'frost', 'fall', 'armored'], { icon: '🧊', pal: '#1b3244', res: { ice: 0.2, fire: 1.5 } }],
    ['king', 'Night King', 'king', 'man', 'boss', 'boss', 30, 12, ['boss', 'frost', 'fall', 'raise', 'armored'], { icon: '👑', pal: '#0d1522', am: 2.4, dm: 1.1, res: { ice: 0.1, fire: 1.5 }, p: { raise: { every: 12, n: 3, window: 20, r: 320 } } }],
    ['dragon', 'Undead dragon', 'dragon', 'drag', 'boss', 'boss', 38, 18, ['boss', 'undead', 'fly', 'strafe', 'armored'], { icon: '🐉', pal: '#4a5566', dm: 0.8, res: { phys: 0.6, fire: 0.3, ice: 0.8 } }],
  ];
  const TIERS = { 1: [1, 10], 2: [8, 22], 3: [20, 35], 4: [33, 48], 5: [46, 60], boss: [1, 60] };   // level bands (overlapping) a tier is spawned in
  const TIER_START = [1, 8, 20, 33, 46];

  /* ---- build R.data.mobs ---- */
  const M = {}, LIST = [];
  for (const [key, name, sprite, arch, role, tier, oSpd, oR, traits, o] of ROWS) {
    const Rd = ROLE[role]; o.p = o.p || {};
    const p = {}; for (const t of traits) { const T = TRAITS[t] || {}; const q = {}; for (const k in T) if (k !== 'd') q[k] = T[k]; p[t] = Object.assign(q, o.p[t] || {}); }
    const res = { phys: 1, fire: 1, ice: 1, holy: 1 }; for (const t of traits) Object.assign(res, RES[t] || {}); Object.assign(res, o.res || {});
    const m = { key, name, sprite, arch, role, tier, icon: o.icon || '', pal: o.pal || o.tint || '#3a4656', tint: o.tint || null, size: o.size || 1, fly: traits.indexOf('fly') >= 0,
      hm: o.hm != null ? o.hm : Rd.hm, am: o.am != null ? o.am : Rd.am, dm: o.dm != null ? o.dm : Rd.dm, xm: o.xm != null ? o.xm : Rd.xm, gm: o.gm != null ? o.gm : Rd.gm,
      spd: Math.round(90 + (oSpd - 22) / 74 * 70), r: Math.round(8 + oR * 1.3), aggro: o.aggro || Rd.aggro, range: o.range || Rd.range, atkCd: o.cd || Rd.cd,
      traits: traits.slice(), p, res, drops: Object.assign({}, Rd.drops), w: Rd.w, base: null, scale: null, xp: 0, gold: [2, 8] };
    if (traits.indexOf('swarm') >= 0) { m.drops = { potion: Rd.drops.potion / 2, gear: Rd.drops.gear / 2, mat: Rd.drops.mat / 2 }; }
    M[key] = m; LIST.push(m);
  }

  const statsAt = (key, lvl) => {
    const m = M[key]; if (!m) return null;
    const L = Math.max(1, Math.min(99, Math.round(+lvl || 1))), P = ref(L);
    const def = P.def * m.dm, hitDmg = dmg(P.atk, def);
    const hp = Math.max(1, Math.round(HITS * hitDmg * m.hm));
    const atk = Math.max(1, Math.round(atkFor(hitPctAt(L) * P.hp * m.am, P.def)));
    return { key, lvl: L, hp, atk, def: round1(def), spd: m.spd, r: m.r, aggro: m.aggro, range: m.range, atkCd: m.atkCd, xp: xpAt(L, m.xm), gold: goldAt(L, m.gm), drops: m.drops,
      role: m.role, tier: m.tier, traits: m.traits, p: m.p, res: m.res, hits: Math.ceil(hp / hitDmg), hitPct: round1(dmg(atk, P.def) / P.hp * 100) };
  };
  for (const m of LIST) { const s1 = statsAt(m.key, 1), s2 = statsAt(m.key, 2);
    m.base = { hp: s1.hp, atk: s1.atk, def: s1.def, spd: s1.spd, r: s1.r, aggro: s1.aggro, range: s1.range, atkCd: s1.atkCd };
    m.scale = { hp: round2(s2.hp / s1.hp), atk: round2(s2.atk / s1.atk) }; m.xp = s1.xp; m.gold = goldAt(1, m.gm); }

  const tierFor = lvl => { let t = 1; for (let i = 0; i < TIER_START.length; i++) if (lvl >= TIER_START[i]) t = i + 1; return t; };
  const list = tier => tier == null ? LIST.filter(m => m.role !== 'boss').map(m => m.key) : LIST.filter(m => m.tier === tier).map(m => m.key);
  const forLevel = lvl => { const t = tierFor(lvl); return LIST.filter(m => m.role !== 'boss' && (m.tier === t || m.tier === t - 1)).map(m => m.key); };
  const warned = {};
  const pick = (table, rng) => {
    rng = rng || R.rng || Math.random; let rows;
    if (Array.isArray(table)) rows = table.map(t => Array.isArray(t) ? { key: t[0], w: t[1] == null ? 1 : +t[1] } : typeof t === 'string' ? { key: t, w: 1 } : { key: t.key, w: t.w == null ? 1 : +t.w });
    else if (table && typeof table === 'object') rows = Object.keys(table).map(k => ({ key: k, w: +table[k] }));
    else return null;
    rows = rows.filter(t => { if (!M[t.key]) { if (!warned[t.key]) { warned[t.key] = 1; console.warn('mobs.pick: unknown mob', t.key); } return false; } return t.w > 0; });
    let tot = 0; for (const t of rows) tot += t.w; if (!tot) return null;
    let x = rng() * tot; for (const t of rows) { x -= t.w; if (x < 0) return t.key; } return rows[rows.length - 1].key;
  };
  // a default spawn table for a level / a tier: this tier's mobs by role weight, the previous tier's at half weight
  const tableForTier = t => LIST.filter(m => m.role !== 'boss' && (m.tier === t || m.tier === t - 1)).map(m => ({ key: m.key, w: m.tier === t ? m.w : m.w / 2 })).filter(r => r.w > 0);
  const tableFor = lvl => tableForTier(tierFor(lvl));
  const make = (key, lvl, x, y) => { const s = statsAt(key, lvl); if (!s) return null; const m = M[key]; x = x || 0; y = y || 0;
    return { kind: m.role === 'boss' ? 'boss' : 'mob', type: key, name: m.name, sprite: m.sprite, tint: m.tint, size: m.size, fly: m.fly, x, y, r: s.r, face: x < (R.player ? R.player.x : x) ? 1 : -1, vx: 0, vy: 0, team: 1,
      lvl: s.lvl, hp: s.hp, hpMax: s.hp, atk: s.atk, def: s.def, spd: s.spd, aggro: s.aggro, range: s.range, atkCd: s.atkCd, role: m.role, traits: m.traits, p: m.p, res: m.res,
      xp: s.xp, gold: s.gold, drops: s.drops, ai: { st: 'idle', home: { x, y } }, cd: {}, status: {}, anim: 'idle', animT: 0 }; };
  const spawn = (key, lvl, x, y) => { const e = make(key, lvl, x, y); return e && R.spawn ? R.spawn(e) : e; };
  const hitsToKill = (key, lvl) => { const s = statsAt(key, lvl); return s ? s.hits : 0; };
  const describe = key => { const m = M[key]; return m ? m.traits.filter(t => TRAITS[t] && t !== 'boss').map(t => TRAITS[t].d.split(' (')[0].split(';')[0]) : []; };
  // the balance table: one row per level, the reference player and the common / elite / brute / boss anchors
  const table = levels => { levels = levels || [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]; const pad = (v, n) => String(v).padStart(n);
    const out = ['lvl  P.hp  P.atk P.def | axe.hp atk def hits hit%  xp gold | walker.hp hits | giant.hp hits | king.hp hits'];
    for (const L of levels) { const P = ref(L), a = statsAt('axe', L), w = statsAt('walker', L), g = statsAt('giant', L), k = statsAt('king', L);
      out.push(`${pad(L, 3)} ${pad(Math.round(P.hp), 5)} ${pad(round1(P.atk), 6)} ${pad(round1(P.def), 5)} | ${pad(a.hp, 6)} ${pad(a.atk, 3)} ${pad(a.def, 4)} ${pad(a.hits, 4)} ${pad(a.hitPct, 4)} ${pad(a.xp, 4)} ${pad(a.gold.join('-'), 7)} | ${pad(w.hp, 9)} ${pad(w.hits, 4)} | ${pad(g.hp, 8)} ${pad(g.hits, 4)} | ${pad(k.hp, 7)} ${pad(k.hits, 4)}`); }
    return out.join('\n'); };

  R.data.mobs = M; R.data.mobList = LIST; R.data.mobTraits = TRAITS;
  R.mobs = { ref, dmg, statsAt, pick, list, forLevel, tierFor, tableFor, tableForTier, make, spawn, hitsToKill, describe, table, TIERS, ROLE, TRAITS, HITS, HIT_PCT, hitPctAt, keys: LIST.map(m => m.key) };
})();
