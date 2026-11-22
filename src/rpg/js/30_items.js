/* HOLDOR RPG — items (A15): R.data.items (tables) + R.items (roll / make / price / equip / sets / shop / upgrade).
   Item: { id, kind:'weapon'|'armor'|'trinket'|'potion'|'mat', base (table key), name, rar 0..4, lvl, up (0..5), cls?,
           stats:{atk?,def?,hp?,spd?,crit?,power?}, sub? (the rolled secondary stat key), set?, icon (SVG string), price (buy), n? (stacks: potion / mat) }
   atk / def / hp are flat points; spd / crit / power are percent points. A set bonus gives atk / def / hp as a share of the gear
   total and spd / crit / power as flat points. Everything that rolls takes an rng (default R.rng) and is deterministic with a seed.
   Nothing here throws when R.state is null: the state-bound calls return { ok:false, why:'nostate' }. */
window.R = window.R || {};
(function () {
  const D = R.data = R.data || {};
  const RAR = [
    { id: 0, name: 'Common', col: '#8a97a8', w: 60, mult: 1 },
    { id: 1, name: 'Uncommon', col: '#5fbf6a', w: 25, mult: 1.8 },
    { id: 2, name: 'Rare', col: '#4fb0ff', w: 10, mult: 3.5 },
    { id: 3, name: 'Epic', col: '#b47cff', w: 4, mult: 7 },
    { id: 4, name: 'Legendary', col: '#e3b661', w: 1, mult: 15 }];
  const STATS = ['atk', 'def', 'hp', 'spd', 'crit', 'power'];
  const LABEL = { atk: 'ATK', def: 'DEF', hp: 'HP', spd: 'SPD', crit: 'CRIT', power: 'POWER' };
  const PCT = { spd: 1, crit: 1, power: 1 };
  const INV_CAP = 40, UP_MAX = 5;

  /* ---------------- tables ---------------- */
  const B = {};
  // def(key, kind, name, o): tier = the level the piece is meant for (rolls prefer bases near the level), g = icon glyph,
  // cls = class lock, set = set id, rar = fixed rarity (Valyrian steel), rarMin = lowest rarity it can roll at.
  const def = (key, kind, name, o) => { B[key] = Object.assign({ key, kind, name, tier: 1 }, o); };
  // knight: swords / axes / hammers
  def('k_rust', 'weapon', 'Rusted Arming Sword', { cls: 'knight', g: 'sword', tier: 1 });
  def('k_castle', 'weapon', 'Castle-forged Longsword', { cls: 'knight', g: 'sword', tier: 4 });
  def('k_bastard', 'weapon', 'Northern Bastard Sword', { cls: 'knight', g: 'sword', tier: 8, set: 'north' });
  def('k_glass', 'weapon', 'Dragonglass-edged Blade', { cls: 'knight', g: 'sword', tier: 14, set: 'glass' });
  def('k_watch', 'weapon', "Black Brother's Longsword", { cls: 'knight', g: 'sword', tier: 16, set: 'watch' });
  def('k_kg', 'weapon', 'Kingsguard Longsword', { cls: 'knight', g: 'sword', tier: 30, set: 'court', rarMin: 2 });
  def('k_valyrian', 'weapon', 'Valyrian Steel Greatsword', { cls: 'knight', g: 'sword', tier: 35, rar: 4 });
  def('k_woodaxe', 'weapon', "Woodsman's Axe", { cls: 'knight', g: 'axe', tier: 2 });
  def('k_bearded', 'weapon', 'Ironborn Bearded Axe', { cls: 'knight', g: 'axe', tier: 10 });
  def('k_greataxe', 'weapon', 'Hearthguard Greataxe', { cls: 'knight', g: 'axe', tier: 22 });
  def('k_maul', 'weapon', "Smith's Maul", { cls: 'knight', g: 'hammer', tier: 6 });
  def('k_antler', 'weapon', 'Antler Warhammer', { cls: 'knight', g: 'hammer', tier: 18 });
  // ranger: bows / crossbows / daggers
  def('r_shortbow', 'weapon', "Hunter's Shortbow", { cls: 'ranger', g: 'bow', tier: 1 });
  def('r_longbow', 'weapon', 'Yew Longbow', { cls: 'ranger', g: 'bow', tier: 4 });
  def('r_weirwood', 'weapon', 'Weirwood Bow', { cls: 'ranger', g: 'bow', tier: 8, set: 'north' });
  def('r_watch', 'weapon', "Wall Ranger's Longbow", { cls: 'ranger', g: 'bow', tier: 16, set: 'watch' });
  def('r_ironwood', 'weapon', 'Ironwood Warbow', { cls: 'ranger', g: 'bow', tier: 22 });
  def('r_hunt', 'weapon', 'Hunting Crossbow', { cls: 'ranger', g: 'xbow', tier: 3 });
  def('r_twin', 'weapon', 'Twin-string Crossbow', { cls: 'ranger', g: 'xbow', tier: 12 });
  def('r_kg', 'weapon', "Royal Huntsman's Crossbow", { cls: 'ranger', g: 'xbow', tier: 30, set: 'court', rarMin: 2 });
  def('r_skin', 'weapon', 'Skinning Knife', { cls: 'ranger', g: 'dagger', tier: 2 });
  def('r_stiletto', 'weapon', 'Braavosi Stiletto', { cls: 'ranger', g: 'dagger', tier: 10 });
  def('r_glass', 'weapon', 'Dragonglass Dagger', { cls: 'ranger', g: 'dagger', tier: 14, set: 'glass' });
  def('r_valyrian', 'weapon', 'Valyrian Steel Dagger', { cls: 'ranger', g: 'dagger', tier: 35, rar: 4 });
  // maester: staves / rods
  def('m_oak', 'weapon', 'Oak Walking Staff', { cls: 'maester', g: 'staff', tier: 1 });
  def('m_ash', 'weapon', 'Ashwood Staff', { cls: 'maester', g: 'staff', tier: 4 });
  def('m_weirwood', 'weapon', 'Weirwood Staff', { cls: 'maester', g: 'staff', tier: 8, set: 'north' });
  def('m_glass', 'weapon', 'Dragonglass-tipped Staff', { cls: 'maester', g: 'staff', tier: 14, set: 'glass' });
  def('m_watch', 'weapon', 'Castle Black Staff', { cls: 'maester', g: 'staff', tier: 16, set: 'watch' });
  def('m_arch', 'weapon', "Archmaester's Staff", { cls: 'maester', g: 'staff', tier: 26 });
  def('m_iron', 'weapon', 'Iron Rod', { cls: 'maester', g: 'rod', tier: 2 });
  def('m_bronze', 'weapon', 'Bronze-shod Rod', { cls: 'maester', g: 'rod', tier: 6 });
  def('m_link', 'weapon', 'Chain-link Rod', { cls: 'maester', g: 'rod', tier: 12 });
  def('m_flame', 'weapon', 'Flame-touched Rod', { cls: 'maester', g: 'rod', tier: 20 });
  def('m_kg', 'weapon', "Grand Maester's Rod", { cls: 'maester', g: 'rod', tier: 30, set: 'court', rarMin: 2 });
  def('m_valyrian', 'weapon', 'Valyrian Steel Link Rod', { cls: 'maester', g: 'rod', tier: 35, rar: 4 });
  // armor (10)
  def('a_padded', 'armor', 'Padded Gambeson', { g: 'leather', tier: 1 });
  def('a_leather', 'armor', 'Boiled Leather Jerkin', { g: 'leather', tier: 3 });
  def('a_studded', 'armor', 'Studded Hunting Leathers', { g: 'leather', tier: 6, cls: 'ranger' });
  def('a_robes', 'armor', "Maester's Grey Robes", { g: 'robe', tier: 6, cls: 'maester' });
  def('a_mail', 'armor', 'Riveted Mail Hauberk', { g: 'mail', tier: 8, cls: 'knight' });
  def('a_scale', 'armor', 'Wolfswood Scale Coat', { g: 'mail', tier: 10, set: 'north' });
  def('a_brig', 'armor', 'Brigandine of the Vale', { g: 'plate', tier: 14 });
  def('a_nw', 'armor', "Night's Watch Blacks", { g: 'cloak', tier: 16, set: 'watch' });
  def('a_glass', 'armor', 'Obsidian-scaled Coat', { g: 'plate', tier: 20, set: 'glass' });
  def('a_kg', 'armor', 'White Cloak of the Kingsguard', { g: 'cloak', tier: 30, set: 'court', rarMin: 2 });
  // trinkets (8): one random stat of spd / crit / power
  def('t_ring_wolf', 'trinket', 'Direwolf Sigil Ring', { g: 'ring', tier: 2 });
  def('t_ring_lion', 'trinket', 'Lion Sigil Ring', { g: 'ring', tier: 6 });
  def('t_ring_stag', 'trinket', 'Stag Sigil Ring', { g: 'ring', tier: 12 });
  def('t_chain', 'trinket', "Maester's Chain Link", { g: 'chain', tier: 9 });
  def('t_tooth', 'trinket', 'Direwolf Tooth', { g: 'tooth', tier: 8, set: 'north' });
  def('t_clasp', 'trinket', 'Black Cloak Clasp', { g: 'clasp', tier: 16, set: 'watch' });
  def('t_shard', 'trinket', 'Dragonglass Shard Pendant', { g: 'pendant', tier: 14, set: 'glass' });
  def('t_seal', 'trinket', 'Red Keep Seal Ring', { g: 'seal', tier: 30, set: 'court', rarMin: 2 });
  // potions (heal = share of hpMax) and smith materials — both stack (n)
  def('p_hp_s', 'potion', 'Small Healing Draught', { g: 'potion', heal: 0.35, rar: 0 });
  def('p_hp_l', 'potion', 'Large Healing Draught', { g: 'potion', heal: 0.7, rar: 1 });
  def('mt_dust', 'mat', 'Wight Dust', { g: 'dust', rar: 0, cost: 8 });
  def('mt_iron', 'mat', 'Iron Ingot', { g: 'ingot', rar: 0, cost: 15 });
  def('mt_glass', 'mat', 'Dragonglass Shard', { g: 'shard', rar: 2, cost: 40 });

  // 4 sets × 3 pieces (a weapon of your class + armor + trinket). bonus[2] applies at 2 pieces, bonus[3] adds at 3.
  const SETS = {
    watch: { id: 'watch', name: "Night's Watch", col: '#9aa7b8', bonus: { 2: { def: 0.12 }, 3: { hp: 0.15, crit: 3 } } },
    north: { id: 'north', name: 'Old Gods of the North', col: '#8fd0c4', bonus: { 2: { hp: 0.12 }, 3: { spd: 6, def: 0.10 } } },
    glass: { id: 'glass', name: 'Dragonglass', col: '#8f7bd6', bonus: { 2: { crit: 5 }, 3: { atk: 0.18 } } },
    court: { id: 'court', name: 'The Red Keep', col: '#e3b661', bonus: { 2: { atk: 0.10 }, 3: { power: 8, def: 0.10 } } } };
  for (const k in B) if (B[k].set) (SETS[B[k].set].pieces = SETS[B[k].set].pieces || []).push(k);

  // kind mix of R.items.roll (gear only) and of R.items.rollLoot (gear / potion / mat); A39 may override via R.data.balance.drops
  const MIX = { gear: { weapon: 45, armor: 35, trinket: 20 }, loot: { gear: 70, potion: 20, mat: 10 }, potion: { p_hp_s: 75, p_hp_l: 25 }, mat: { mt_dust: 50, mt_iron: 35, mt_glass: 15 } };
  D.items = { RAR, bases: B, sets: SETS, mix: MIX, stats: STATS, label: LABEL, pct: PCT, INV_CAP, UP_MAX };

  /* ---------------- helpers ---------------- */
  const rnd = () => R.rng();
  const r1 = v => Math.round(v * 10) / 10;
  const pick = (arr, wf, rng) => { let t = 0; const w = arr.map(a => { const v = Math.max(0, wf ? wf(a) : 1); t += v; return v; }); let x = rng() * t; for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x < 0) return arr[i]; } return arr[arr.length - 1]; };
  const pickKey = (obj, rng) => { const ks = Object.keys(obj); return pick(ks, k => obj[k], rng); };
  const P = () => (R.state && R.state.p) || null;
  const stackable = k => k === 'mat' || k === 'potion';
  let seq = 0;
  const uid = () => 'i' + Date.now().toString(36) + (seq++).toString(36);
  const emit = (e, ...a) => { if (R.bus && R.bus.emit) R.bus.emit(e, ...a); };
  const toast = (t, c) => { if (R.ui && R.ui.toast) R.ui.toast(t, c); };
  const save = () => { if (R.save) R.save(); };
  const mult = rar => 1 + 0.22 * rar;

  // primary + secondary stats of a base at (lvl, rar); sub = the rolled secondary key (trinkets always have one)
  const statsFor = (b, lvl, rar, sub) => {
    const s = {};
    if (b.kind === 'weapon') {
      s.atk = Math.round((6 + 1.8 * lvl) * mult(rar));
      if (rar >= 2 && sub) s[sub] = r1((1 + 0.1 * lvl) * (rar - 1));
    } else if (b.kind === 'armor') {
      s.def = Math.round((3 + 0.9 * lvl) * mult(rar));
      s.hp = Math.round(12 * lvl * (1 + 0.2 * rar));
      if (rar >= 3 && sub) s[sub] = r1((1 + 0.06 * lvl) * (rar - 2));
    } else if (b.kind === 'trinket') {
      s[sub || 'crit'] = r1((2 + 0.2 * lvl) * (1 + 0.2 * rar));
    }
    return s;
  };
  const subFor = (b, rar, rng) => {
    if (b.kind === 'trinket') return pick(['spd', 'crit', 'power'], null, rng);
    if (b.kind === 'weapon' && rar >= 2) return pick(['crit', 'power', 'spd'], null, rng);
    if (b.kind === 'armor' && rar >= 3) return pick(['spd', 'power'], null, rng);
    return undefined;
  };
  const clampRar = (b, rar) => { if (b.rar != null) return b.rar; if (b.rarMin != null && rar < b.rarMin) return b.rarMin; return R.clamp ? R.clamp(rar, 0, 4) : Math.max(0, Math.min(4, rar)); };

  /* ---------------- make / roll ---------------- */
  const make = (key, lvl, rar, rng) => {
    const b = B[key]; if (!b) return null;
    rng = rng || rnd; lvl = Math.max(1, Math.round(lvl || 1)); rar = clampRar(b, rar | 0);
    const sub = subFor(b, rar, rng);
    const it = { id: uid(), kind: b.kind, base: key, name: b.name, rar, lvl, up: 0, stats: statsFor(b, lvl, rar, sub) };
    if (sub) it.sub = sub;
    if (b.cls) it.cls = b.cls;
    if (b.set) it.set = b.set;
    if (b.heal) it.heal = b.heal;
    if (stackable(b.kind)) it.n = 1;
    it.icon = glyph(b.g, RAR[rar].col);
    it.price = price(it);
    return it;
  };
  const rollRar = (rarMin, rng) => pick(RAR.slice(Math.max(0, Math.min(4, rarMin | 0))), r => r.w, rng).id;
  const basesOf = (kind, cls, lvl, rar) => {
    let c = Object.values(B).filter(b => b.kind === kind && (!cls || !b.cls || b.cls === cls) && (b.rar == null || b.rar === rar) && (b.rarMin == null || rar >= b.rarMin));
    const near = c.filter(b => b.tier <= lvl + 2);
    return near.length ? near : c;
  };
  // gear only (weapon / armor / trinket): rarity 60/25/10/4/1 with a floor; base near the level; cls limits weapons (and class armor)
  const roll = (lvl, rarMin, rng, cls) => {
    rng = rng || rnd; lvl = Math.max(1, Math.round(lvl || 1));
    const rar = rollRar(rarMin || 0, rng);
    // balance.drops.gear is the gear DROP CHANCE (a number, A39); only an object is a slot mix
    const isMix = o => !!o && typeof o === 'object' && Object.keys(o).some(k => o[k] > 0);
    const bd = D.balance && D.balance.drops; const mixG = isMix(bd && bd.gearMix) ? bd.gearMix : isMix(bd && bd.gear) ? bd.gear : MIX.gear;
    let kind = pickKey(mixG, rng); if (!kind || !['weapon', 'armor', 'trinket'].includes(kind)) kind = pickKey(MIX.gear, rng);
    let bs = basesOf(kind, cls, lvl, rar); if (!bs || !bs.length) bs = basesOf(kind, null, lvl, rar);
    const b = pick(bs, x => 1 / (1 + Math.abs(lvl - x.tier) / 6), rng);
    if (!b) return null;
    return make(b.key, lvl, rar, rng);
  };
  // a drop from a kill: gear, or a potion, or a material
  const rollLoot = (lvl, rarMin, rng, cls) => {
    rng = rng || rnd;
    const bd = (D.balance && D.balance.drops) || {}; const obj = (o, d) => (o && typeof o === 'object' && Object.keys(o).length ? o : d);
    const what = pickKey(obj(bd.loot, MIX.loot), rng);
    if (what === 'potion') return make(pickKey(obj(bd.potionMix, MIX.potion), rng), lvl, 0, rng);
    if (what === 'mat') return make(pickKey(obj(bd.matMix, MIX.mat), rng), lvl, 0, rng);
    return roll(lvl, rarMin, rng, cls);
  };

  /* ---------------- price ---------------- */
  function price(it) {
    const b = B[it.base] || {}; const m = RAR[it.rar | 0].mult; let p;
    if (it.kind === 'weapon' || it.kind === 'armor') p = (20 + 12 * it.lvl) * m;
    else if (it.kind === 'trinket') p = (15 + 9 * it.lvl) * m;
    else if (it.kind === 'potion') p = it.base === 'p_hp_l' ? 60 + 12 * it.lvl : 20 + 4 * it.lvl;
    else p = b.cost || 10;
    return Math.max(1, Math.round(p * (1 + 0.15 * (it.up || 0))));
  }
  const sellPrice = it => Math.max(1, Math.floor(price(it) * 0.25));

  /* ---------------- inventory / gear ---------------- */
  const inv = () => { const p = P(); if (!p) return null; p.inv = p.inv || []; return p.inv; };
  const gearOf = () => { const p = P(); if (!p) return null; p.gear = p.gear || {}; return p.gear; };
  const addGold = n => { const p = P(); if (!p || !n) return; p.gold = (p.gold || 0) + n; emit('gold', n); };
  const findStack = (I, key) => I.find(x => x.base === key && stackable(x.kind));
  const cheapestCommon = I => { let best = null; for (const x of I) if (!stackable(x.kind) && x.rar === 0 && (!best || sellPrice(x) < sellPrice(best))) best = x; return best; };
  // adds an item to the bag. Full bag: a Common piece is sold on the spot; a better piece sells the cheapest Common for room.
  const add = it => {
    const I = inv(); if (!I) return { ok: false, why: 'nostate' };
    if (stackable(it.kind)) { const s = findStack(I, it.base); if (s) { s.n += it.n || 1; emit('inv', s); save(); return { ok: true, item: s }; } }
    if (I.length >= INV_CAP) {
      if (!stackable(it.kind) && it.rar === 0) { const g = sellPrice(it); addGold(g); toast('Bag full — sold ' + it.name + ' for ' + g + ' gold', RAR[0].col); emit('inv', null); save(); return { ok: true, sold: true, gold: g }; }
      const c = cheapestCommon(I);
      if (!c) return { ok: false, why: 'full' };
      const g = sellPrice(c); I.splice(I.indexOf(c), 1); addGold(g); toast('Bag full — sold ' + c.name + ' for ' + g + ' gold', RAR[0].col);
    }
    I.push(it); emit('inv', it); save(); return { ok: true, item: it };
  };
  const remove = (it, n) => {
    const I = inv(); if (!I) return false; const i = I.indexOf(it); if (i < 0) return false;
    if (stackable(it.kind) && n != null && n < it.n) { it.n -= n; } else I.splice(i, 1);
    emit('inv', null); save(); return true;
  };
  const give = (key, n, lvl) => { const it = make(key, lvl || 1, 0); if (!it) return null; if (stackable(it.kind)) it.n = n || 1; return add(it); };
  const mats = () => { const I = inv() || []; const o = {}; for (const x of I) if (x.kind === 'mat') o[x.base.replace('mt_', '')] = (o[x.base.replace('mt_', '')] || 0) + x.n; return o; };
  const takeMat = (short, n) => { const I = inv(); if (!I) return false; const s = findStack(I, 'mt_' + short); if (!s || s.n < n) return false; return remove(s, n); };
  const potions = () => { const I = inv() || []; const o = {}; for (const x of I) if (x.kind === 'potion') o[x.base] = x.n; return o; };
  const usePotion = key => { const I = inv(); if (!I) return 0; const s = findStack(I, key || 'p_hp_s') || I.find(x => x.kind === 'potion'); if (!s) return 0; const h = s.heal || 0.35; remove(s, 1); return h; };
  const sell = (it, n) => { const I = inv(); if (!I || I.indexOf(it) < 0) return 0; const have = Math.max(1, it.n | 0); const q = stackable(it.kind) ? Math.max(1, Math.min(n || have, have)) : 1; const g = sellPrice(it) * q; remove(it, q); addGold(g); return g; };
  const canEquip = it => {
    const p = P(); if (!p) return { ok: false, why: 'nostate' };
    if (!it || !['weapon', 'armor', 'trinket'].includes(it.kind)) return { ok: false, why: 'kind' };
    if (it.cls && it.cls !== p.cls) return { ok: false, why: 'class' };
    return { ok: true };
  };
  // equips from the bag (or from anywhere, e.g. the ground); the piece it replaces goes back to the bag
  const equip = it => {
    const c = canEquip(it); if (!c.ok) return c;
    const I = inv(), G = gearOf(); const slot = it.kind; const old = G[slot] || null;
    const i = I.indexOf(it); if (i >= 0) I.splice(i, 1);
    G[slot] = it;
    if (old) { const r = add(old); if (!r.ok) { G[slot] = old; if (i >= 0) I.splice(i, 0, it); return r; } }
    emit('gear', slot, it); save(); return { ok: true, old };
  };
  const unequip = slot => {
    const G = gearOf(); if (!G) return { ok: false, why: 'nostate' }; const it = G[slot]; if (!it) return { ok: false, why: 'empty' };
    if (inv().length >= INV_CAP) return { ok: false, why: 'full' };
    G[slot] = null; inv().push(it); emit('gear', slot, null); emit('inv', it); save(); return { ok: true, item: it };
  };

  /* ---------------- sets / totals / compare ---------------- */
  const zero = () => ({ atk: 0, def: 0, hp: 0, spd: 0, crit: 0, power: 0 });
  const baseTotals = gear => { const t = zero(); for (const k of ['weapon', 'armor', 'trinket']) { const it = gear && gear[k]; if (it && it.stats) for (const s in it.stats) t[s] = r1((t[s] || 0) + it.stats[s]); } return t; };
  const setBonus = gear => {
    gear = gear || gearOf() || {}; const base = baseTotals(gear); const count = {};
    for (const k of ['weapon', 'armor', 'trinket']) { const it = gear[k]; if (it && it.set) count[it.set] = (count[it.set] || 0) + 1; }
    const out = { sets: [], stats: zero() };
    for (const id in count) {
      const S = SETS[id]; if (!S) continue; const n = count[id]; const st = zero(); const active = [];
      for (const need of [2, 3]) if (n >= need) { active.push(need); for (const s in S.bonus[need]) st[s] = r1(st[s] + (PCT[s] ? S.bonus[need][s] : Math.round(base[s] * S.bonus[need][s]))); }
      for (const s in st) out.stats[s] = r1(out.stats[s] + st[s]);
      out.sets.push({ id, name: S.name, col: S.col, n, active, stats: st, pieces: S.pieces });
    }
    return out;
  };
  // everything the player gets from gear, set bonus included
  const gearStats = gear => { gear = gear || gearOf() || {}; const t = baseTotals(gear); const sb = setBonus(gear).stats; for (const s in sb) t[s] = r1(t[s] + sb[s]); return t; };
  const score = it => { if (!it || !it.stats) return 0; const s = it.stats; return (s.atk || 0) + (s.def || 0) * 1.2 + (s.hp || 0) * 0.12 + (s.spd || 0) * 2 + (s.crit || 0) * 2.5 + (s.power || 0) * 2; };
  const compare = (a, b) => { const d = {}; for (const s of STATS) { const v = r1(((a && a.stats && a.stats[s]) || 0) - ((b && b.stats && b.stats[s]) || 0)); if (v) d[s] = v; } return { better: score(a) > score(b), diff: d, score: [r1(score(a)), r1(score(b))] }; };
  const compareEquipped = it => compare(it, (gearOf() || {})[it.kind]);

  /* ---------------- shop / smith ---------------- */
  // six things on a merchant's table: a weapon for your class, an armor, a trinket, both draughts and a material. Castles sell better.
  const shopStock = (poi, lvl, rng) => {
    rng = rng || rnd; lvl = Math.max(1, Math.round(lvl || 1)); const type = (poi && (poi.type || poi.kind)) || poi || 'town';
    const castle = /castle|keep|hold|capital/.test(String(type)); const p = P(); const cls = p && p.cls;
    const gearRar = () => Math.max(castle ? 1 : 0, rollRar(castle ? 1 : 0, rng));
    const mkG = kind => { const rar = gearRar(); const b = pick(basesOf(kind, cls, lvl, rar), x => 1 / (1 + Math.abs(lvl - x.tier) / 6), rng); return make(b.key, lvl, rar, rng); };
    const out = [mkG('weapon'), mkG('armor'), mkG('trinket'), make('p_hp_s', lvl, 0, rng), make('p_hp_l', lvl, 1, rng), make(castle ? 'mt_glass' : 'mt_iron', lvl, 0, rng)];
    out[3].n = 5; out[4].n = 3; out[5].n = castle ? 2 : 4;
    return out;
  };
  const upgradeCost = it => {
    const up = it.up || 0; const g = Math.round((30 + 18 * it.lvl) * (1 + up) * [1, 1.3, 1.7, 2.2, 3][it.rar | 0]); const m = {};
    if (it.kind === 'trinket') m.dust = 1 + up; else m.iron = 1 + up;
    const glass = (up >= 3 ? up - 2 : 0) + (it.rar === 4 ? 1 : 0); if (glass) m.glass = glass;
    return { gold: g, mats: m };
  };
  // +1 level per step, up to +5. Pays gold from the player and materials from `mats` ({iron,dust,glass}, mutated) or from the bag.
  const upgrade = (it, pay) => {
    if (!it || !B[it.base] || !['weapon', 'armor', 'trinket'].includes(it.kind)) return { ok: false, why: 'kind' };
    if ((it.up || 0) >= UP_MAX) return { ok: false, why: 'max' };
    const cost = upgradeCost(it); const p = P(); const have = pay || mats();
    if (p && (p.gold || 0) < cost.gold) return { ok: false, why: 'gold', cost };
    for (const k in cost.mats) if ((have[k] || 0) < cost.mats[k]) return { ok: false, why: 'mats', cost };
    if (p) p.gold -= cost.gold;
    for (const k in cost.mats) { if (pay) pay[k] -= cost.mats[k]; else takeMat(k, cost.mats[k]); }
    it.up = (it.up || 0) + 1; it.lvl += 1; it.stats = statsFor(B[it.base], it.lvl, it.rar, it.sub); it.price = price(it);
    emit('upgrade', it); save(); return { ok: true, item: it, cost };
  };

  /* ---------------- icons / text ---------------- */
  const G = {
    sword: '<path d="M12 2.5 14 5 12.6 14.5h-1.2L10 5z"/><path d="M7.5 15h9M12 15v4.5"/><circle cx="12" cy="20.8" r="1.3"/>',
    axe: '<path d="M7 21.5 15 7.5"/><path d="M13 4c4 0 7 3 7.5 7.5L15 7.5l-3-1.5z"/>',
    hammer: '<path d="M12 21.5V10"/><rect x="5.5" y="4" width="13" height="6" rx="1.2"/>',
    bow: '<path d="M7 3q10 9 0 18M7 3v18M7 12h11M15 9.5 18 12l-3 2.5"/>',
    xbow: '<path d="M12 21.5V8M4 8q8-4 16 0M4 8h16M12 4.5V8"/>',
    dagger: '<path d="M12 2.5 13.6 6 12.5 14h-1L10.4 6z"/><path d="M9 14h6M12 14v5.5"/>',
    staff: '<path d="M9 21.5 15 4.5"/><circle cx="15.6" cy="4" r="2.4"/>',
    rod: '<path d="M12 21.5V7M9 7h6"/><circle cx="12" cy="4.5" r="1.8"/>',
    leather: '<path d="M7 4 10 6h4l3-2 3 4-3 1v11H7V9L4 8z"/>',
    mail: '<path d="M7 4 10 6h4l3-2 3 4-3 1v11H7V9L4 8z"/><path d="M9 11h6M9 14h6M9 17h6"/>',
    plate: '<path d="M7 4 10 6h4l3-2 3 4-3 1v11H7V9L4 8z"/><path d="M12 7v13M8 11l4 2 4-2"/>',
    robe: '<path d="M8 3.5 12 7l4-3.5L18.5 20.5h-13z"/><path d="M12 7v13.5"/>',
    cloak: '<path d="M12 2.5 5 8l1 13.5h12L19 8z"/><path d="M12 2.5v19"/>',
    ring: '<circle cx="12" cy="13.5" r="6.5"/><path d="M9.5 6.5 12 3.5l2.5 3z"/>',
    chain: '<circle cx="7" cy="12" r="3.2"/><circle cx="12" cy="12" r="3.2"/><circle cx="17" cy="12" r="3.2"/>',
    tooth: '<path d="M9 4h6l-2 16.5-1-5.5-1 5.5z"/>',
    clasp: '<circle cx="12" cy="12" r="7.5"/><path d="M12 5.5v13M7 12h10"/>',
    pendant: '<path d="M8 3.5q4-2 8 0"/><path d="M12 6l4 6-4 9.5-4-9.5z"/>',
    seal: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6l3 6-3 6-3-6z"/>',
    potion: '<path d="M10 2.5h4v5.5l4 7q0 6-6 6t-6-6l4-7z"/><path d="M8.5 15h7"/>',
    dust: '<circle cx="8" cy="15" r="2.2"/><circle cx="14" cy="17" r="2.6"/><circle cx="13" cy="9" r="2"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    ingot: '<path d="M4.5 16.5 7 9h10l2.5 7.5z"/><path d="M7 9l1.5 7.5M17 9l-1.5 7.5"/>',
    shard: '<path d="M12 2.5 17.5 11 13 21.5 7.5 13z"/><path d="M12 2.5 13 21.5"/>' };
  function glyph(g, col) { return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="' + (col || '#e9eef5') + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">' + (G[g] || G.sword) + '</svg>'; }
  const rarName = r => RAR[r | 0].name, rarCol = r => RAR[r | 0].col;
  const fullName = it => it.name + (it.up ? ' +' + it.up : '') + (it.n > 1 ? ' ×' + it.n : '');
  // a framed icon, `px` wide; the frame is the rarity colour
  const icon = (it, px) => {
    px = px || 44; const col = rarCol(it.rar); const b = B[it.base] || {};
    return '<span class="itm-ic" data-rar="' + (it.rar | 0) + '" style="display:inline-flex;align-items:center;justify-content:center;width:' + px + 'px;height:' + px + 'px;padding:' + Math.round(px * .14) + 'px;border-radius:' + Math.round(px * .22) + 'px;border:2px solid ' + col + ';background:radial-gradient(circle at 50% 35%,' + col + '33,#0b1220 75%);box-shadow:0 0 ' + Math.round(px * .25) + 'px ' + col + (it.rar >= 3 ? '66' : '22') + '">' + (it.icon || glyph(b.g, col)) + '</span>';
  };
  const statLine = (s, v) => (v > 0 ? '+' : '') + v + (PCT[s] ? '%' : '') + ' ' + LABEL[s];
  const statsText = it => Object.keys(it.stats || {}).map(s => statLine(s, it.stats[s])).join(' · ');
  // a short card: name, rarity · kind · level, class, stats, set, sell price — readable in one glance
  // cur (optional): the piece in the same slot — each stat then shows its difference (+n green .dup / −n red .ddn)
  const tooltip = (it, cur) => {
    const col = rarCol(it.rar); const b = B[it.base] || {}; const S = it.set && SETS[it.set];
    let h = '<div class="itm-tip" style="display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:12px;border:1px solid ' + col + '88;background:rgba(6,11,20,.96);min-width:180px">';
    h += '<div style="font:700 15px var(--f-display);color:' + col + '">' + fullName(it) + '</div>';
    h += '<div style="font-size:12px;color:#9fb6c9">' + rarName(it.rar) + ' · ' + it.kind[0].toUpperCase() + it.kind.slice(1) + (it.kind === 'potion' || it.kind === 'mat' ? '' : ' · Lv ' + it.lvl) + (it.cls ? ' · ' + it.cls[0].toUpperCase() + it.cls.slice(1) : '') + '</div>';
    if (it.kind === 'potion') h += '<div style="color:#7fd06a">Heals ' + Math.round((it.heal || b.heal || 0) * 100) + '% HP</div>';
    else if (it.kind === 'mat') h += '<div style="color:#9fb6c9">Smith material</div>';
    else { const cs = cur && cur !== it && cur.stats ? cur.stats : null; const keys = Object.keys(it.stats || {}); if (cs) for (const k of Object.keys(cs)) if (!keys.includes(k)) keys.push(k);
      for (const s of keys) { const v = (it.stats && it.stats[s]) || 0, d = cs ? Math.round((v - (cs[s] || 0)) * 10) / 10 : 0;
        h += '<div style="color:#e9eef5">' + statLine(s, v) + (d ? ' <em class="' + (d > 0 ? 'dup' : 'ddn') + '" style="font-style:normal;color:' + (d > 0 ? '#7fd06a' : '#e14b4b') + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</em>' : '') + '</div>'; } }
    if (S) { const n = setBonus().sets.find(x => x.id === it.set); h += '<div style="color:' + S.col + ';font-size:12px">' + S.name + ' (' + ((n && n.n) || 0) + '/3)</div>'; }
    h += '<div style="font-size:12px;color:#e3b661">Sell ' + sellPrice(it) + (it.n > 1 ? ' each' : '') + ' gold</div></div>';
    return h;
  };
  const list = (kind, cls) => Object.values(B).filter(b => (!kind || b.kind === kind) && (!cls || !b.cls || b.cls === cls));

  R.items = { RAR, SETS, bases: B, INV_CAP, UP_MAX, base: k => B[k], list, make, roll, rollRar, rollLoot, price, sellPrice, sell, add, remove, give, mats, takeMat, potions, usePotion,
    equip, unequip, canEquip, setBonus, gearStats, compare, compareEquipped, score, shopStock, upgrade, upgradeCost, icon, glyph, tooltip, statsText, fullName, rarName, rarCol, statsFor: (k, l, r, s) => B[k] ? statsFor(B[k], l, r, s) : null };
})();
