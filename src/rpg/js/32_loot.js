/* HOLDOR RPG — loot (A17): drops on the ground, pickup radius, chests, gold/gem bursts.
   API (R.loot):
     drop(mob)                → [drops]  rolls R.data.mobs[mob.type].drops / .gold (fallbacks when absent) and scatters them.
                                A11 calls it on a mob's death; the 'kill' event also calls it, `mob.looted` keeps it to one roll.
     spawn(sub, x, y, o)      → drop entity {kind:'drop', sub:'gold'|'gem'|'item'|'potion'|'mat', amount|item, icon, col, glow?}
     goldBurst(x, y, n, k?)   → 3–6 coins that sum to n.
     chest(x, y, lvl, rar)    → {kind:'chest'} entity; INTERACT opens it: 3 items + gold (+ gems from Rare up).
     take(e) / open(e)        pickup / open by hand (the 'interact' bus event does the same).
     drawDrop(ctx, e)         optional helper for the renderer (beam, shadow, hop, blink). The renderer owns drawing.
   Mob data read: drops = {item:p, potion:p, mat:p, gem:p} or [{sub, p, rar?, n:[a,b]?, id?, name?, icon?}]; gold = [a,b] × lvl (or a number × lvl,
   or {flat:[a,b]}). Balance read (soft): R.data.balance.drops {item, potion, mat, eliteItem, bossGems:[a,b], gold:[a,b]}, R.data.balance.invMax.
   Pickup: gold / gems / potions fly to the player inside 120 u and are taken inside 46 u; gear and materials need INTERACT inside 70 u
   (R.input.interact = {label:'Take <name>', e, src:'loot', act}) or 1.5 s standing on them. Drops live 60 s. */
(function () {
  const RAR_COL = ['#9aa4b1', '#5fcf6a', '#4fb0ff', '#b47cff', '#e3b661'];
  const RAR_NAME = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  const C = { LIFE: 60, PICK_R: 46, MAGNET_R: 120, TAKE_R: 70, STAND_T: 1.5, SCATTER: [20, 50], CHEST_LIFE: 15, INV_MAX: 60, POTION_MAX: 20 };
  const rnd = () => (R.rng ? R.rng() : Math.random());
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rr = (a, b) => a + rnd() * (b - a);
  const bal = () => (R.data.balance && R.data.balance.drops) || {};
  const P = () => (R.state && R.state.p) || null;
  const col = r => RAR_COL[R.clamp(r | 0, 0, 4)];
  let seq = 0;
  const uid = () => 'i' + Date.now().toString(36) + (seq++).toString(36);

  /* ---------- fallbacks when R.items is absent ---------- */
  const FB = {
    weapon: ['Castle-forged sword', 'Longaxe', 'Hunting bow', 'Bronze dirk', 'Warhammer'],
    armor: ['Boiled leather', 'Mail hauberk', 'Plate cuirass', 'Ranger cloak'],
    trinket: ['Weirwood charm', 'Raven feather', 'Dragonglass amulet', 'Signet ring'],
    icon: { weapon: '🗡️', armor: '🛡️', trinket: '📿', potion: '🧪', mat: '🪨' },
    mats: [{ id: 'iron', name: 'Iron scrap', icon: '⛓️' }, { id: 'leather', name: 'Boiled leather strip', icon: '🪢' }, { id: 'wood', name: 'Ironwood', icon: '🪵' },
      { id: 'glass', name: 'Dragonglass shard', icon: '🔹' }, { id: 'bone', name: 'Wight bone', icon: '🦴' }],
    rarW: [0.62, 0.25, 0.09, 0.035, 0.005] };
  const rollRar = floor => { let s = 0; for (let i = floor; i < 5; i++) s += FB.rarW[i]; let x = rnd() * s; for (let i = floor; i < 5; i++) { x -= FB.rarW[i]; if (x <= 0) return i; } return floor; };
  const fbRoll = (lvl, floor) => { const rar = rollRar(R.clamp(floor | 0, 0, 4)); const kinds = ['weapon', 'armor', 'trinket']; const kind = kinds[ri(0, 2)];
    const m = 1 + rar * 0.25; const st = kind === 'weapon' ? { atk: Math.round((4 + 2 * lvl) * m) } : kind === 'armor' ? { def: Math.round((2 + 1.2 * lvl) * m), hp: Math.round((10 + 6 * lvl) * m) } : { crit: Math.round((2 + rar * 2) * 10) / 10, spd: Math.round(2 + rar * 2) };
    return { id: uid(), kind, name: FB[kind][ri(0, FB[kind].length - 1)], rar, lvl: lvl | 0, stats: st, icon: FB.icon[kind] }; };
  const rollItem = (lvl, floor) => { const I = R.items; let it = null;
    try { if (I && typeof I.roll === 'function') it = I.roll(lvl, floor); } catch (e) { console.error('items.roll', e); }
    if (!it) it = fbRoll(lvl, floor); if (!it.id) it.id = uid(); if (it.rar == null) it.rar = floor | 0; return it; };
  const rollMat = (lvl, o) => { const I = R.items; let m = null;
    try { if (I && typeof I.rollMat === 'function') m = I.rollMat(lvl, o); else if (I && Array.isArray(I.mats) && I.mats.length) m = Object.assign({}, I.mats[ri(0, I.mats.length - 1)]); } catch (e) { console.error('items.rollMat', e); }
    if (!m) m = Object.assign({}, FB.mats[ri(0, FB.mats.length - 1)]);
    if (o) { if (o.id) m.id = o.id; if (o.name) m.name = o.name; if (o.icon) m.icon = o.icon; }
    m.kind = 'mat'; m.rar = m.rar || 0; m.lvl = lvl | 0; m.n = m.n || 1; m.icon = m.icon || FB.icon.mat; m.name = m.name || 'Material'; return m; };
  const iconOf = it => { if (it && it.icon) return it.icon; try { if (R.items && typeof R.items.icon === 'function') { const s = R.items.icon(it); if (s) return s; } } catch (e) {} return FB.icon[it && it.kind] || '❔'; };

  /* ---------- spawning ---------- */
  const spawn = (sub, x, y, o) => { o = o || {};
    const e = { kind: 'drop', sub, x, y, r: 12, team: 2, hp: 1, hpMax: 1, age: 0, life: o.life || C.LIFE, z: 0, vz: 0, vx: 0, vy: 0, standT: 0, solid: false, name: '' };
    if (sub === 'gold') { e.amount = Math.max(1, Math.round(o.amount || 1)); e.icon = '🪙'; e.col = '#e3b661'; e.name = e.amount + ' gold'; }
    else if (sub === 'gem') { e.amount = Math.max(1, Math.round(o.amount || 1)); e.icon = '💎'; e.col = '#5fd3ff'; e.glow = '#5fd3ff'; e.name = e.amount + (e.amount > 1 ? ' gems' : ' gem'); }
    else if (sub === 'potion') { e.ptype = o.ptype || 'hp'; e.amount = Math.max(1, Math.round(o.amount || 1)); e.icon = e.ptype === 'mana' ? '💧' : '🧪'; e.col = e.ptype === 'mana' ? '#4fb0ff' : '#e14b4b'; e.name = e.ptype === 'mana' ? 'Mana potion' : 'Health potion'; }
    else if (sub === 'item' || sub === 'mat') { const it = o.item || (sub === 'mat' ? rollMat(o.lvl || 1, o) : rollItem(o.lvl || 1, o.rar || 0)); e.item = it; if (sub === 'mat') { it.kind = 'mat'; if (o.amount) it.n = o.amount; } e.icon = iconOf(it); e.col = col(it.rar); e.name = it.name || (sub === 'mat' ? 'Material' : 'Item'); if ((it.rar | 0) >= 2) e.glow = e.col; }
    else { e.icon = '❔'; e.col = '#fff'; }
    e.auto = sub === 'gold' || sub === 'gem' || sub === 'potion';
    if (o.scatter !== false) { const d = rr(C.SCATTER[0], C.SCATTER[1]), a = o.angle != null ? o.angle : rnd() * Math.PI * 2; e.vx = Math.cos(a) * d * 8; e.vy = Math.sin(a) * d * 8; e.vz = 110 + rnd() * 50; }
    return R.spawn(e); };

  const goldBurst = (x, y, n, k) => { n = Math.max(1, Math.round(n || 1)); k = k || ri(3, 6); k = Math.max(1, Math.min(k, n)); const out = [];
    let left = n; for (let i = 0; i < k; i++) { const a = i === k - 1 ? left : Math.max(1, Math.round(n / k * rr(0.6, 1.4))); const amt = Math.min(a, left - (k - 1 - i)); left -= amt; out.push(spawn('gold', x, y, { amount: amt, angle: (i / k) * Math.PI * 2 + rnd() * 0.8 })); }
    return out; };

  /* ---------- drop rolls ---------- */
  /* balance.drops.gold is the gold drop CHANCE (1 = always, A39); the amount is balance.mob.gold(L, roll) = 2–8 × level (ARCH) */
  const goldFor = (mob, md) => { const lvl = Math.max(1, mob.lvl || 1); const BM = R.data.balance && R.data.balance.mob;
    let g = md && md.gold != null ? md.gold : null;
    if (g == null) { let v = NaN; if (BM && typeof BM.gold === 'function') { try { v = Math.round(BM.gold(lvl, rnd())); } catch (e) {} } g = v > 0 ? { flat: [v, v] } : [2, 8]; }
    if (typeof g === 'number') g = Math.round(g * lvl); else if (Array.isArray(g)) g = Math.round(rr(g[0], g[1]) * lvl); else if (g && g.flat) g = Math.round(rr(g.flat[0], g.flat[1])); else g = Math.round(rr(2, 8) * lvl);
    if (mob.kind === 'boss') g *= 10; else if (mob.elite) g *= 3; return Math.max(0, Math.round(g)); };
  const drop = mob => { if (!mob || mob.looted || mob.noLoot) return []; mob.looted = true;
    const md = (R.data.mobs && mob.type && R.data.mobs[mob.type]) || null; const b = bal(); const lvl = Math.max(1, mob.lvl || 1);
    const boss = mob.kind === 'boss', elite = !!mob.elite || boss; const floor = boss ? 2 : elite ? 1 : 0; const out = []; const x = mob.x, y = mob.y;
    const g = goldFor(mob, md); if (g > 0) out.push(...goldBurst(x, y, g, boss ? ri(5, 6) : elite ? ri(2, 3) : g >= 12 ? 2 : 1));
    const tbl = md && md.drops;
    if (Array.isArray(tbl)) { for (const d of tbl) { if (!d || rnd() >= (d.p == null ? 1 : d.p)) continue; const n = d.n ? ri(d.n[0], d.n[1]) : 1;
        if (d.sub === 'item') out.push(spawn('item', x, y, { lvl, rar: Math.max(floor, d.rar | 0) })); else if (d.sub === 'mat') out.push(spawn('mat', x, y, { lvl, id: d.id, name: d.name, icon: d.icon, amount: n }));
        else if (d.sub === 'potion') out.push(spawn('potion', x, y, { ptype: d.ptype, amount: n })); else if (d.sub === 'gem') out.push(spawn('gem', x, y, { amount: n })); } }
    else { const t = tbl || {}; const pItem = t.item != null ? t.item : (elite ? (b.eliteItem != null ? b.eliteItem : 0.35) : (b.item != null ? b.item : 0.12));
      const pPot = t.potion != null ? t.potion : (b.potion != null ? b.potion : 0.06), pMat = t.mat != null ? t.mat : (b.mat != null ? b.mat : 0.15), pGem = t.gem != null ? t.gem : 0;
      if (boss || rnd() < pItem) out.push(spawn('item', x, y, { lvl, rar: floor })); if (boss && rnd() < 0.5) out.push(spawn('item', x, y, { lvl, rar: 1 }));
      if (rnd() < pPot) out.push(spawn('potion', x, y, { ptype: rnd() < 0.85 ? 'hp' : 'mana' })); if (rnd() < pMat) out.push(spawn('mat', x, y, { lvl, amount: elite ? ri(1, 2) : 1 }));
      if (boss) { const bg = b.bossGems || [2, 5]; out.push(spawn('gem', x, y, { amount: ri(bg[0], bg[1]) })); } else if (rnd() < pGem) out.push(spawn('gem', x, y, { amount: 1 })); }
    return out; };

  /* ---------- pickup ---------- */
  const fx = (x, y, txt, c, big) => { if (R.fx && R.fx.num) try { R.fx.num(x, y, txt, c, big); } catch (e) {} };
  const sfx = n => { if (R.sfx && R.sfx.play) try { R.sfx.play(n); } catch (e) {} };
  const toast = (t, c) => { if (R.ui && R.ui.toast) try { R.ui.toast(t, c); } catch (e) {} };
  const invMax = () => (R.data.balance && R.data.balance.invMax) || C.INV_MAX;
  const equipFree = it => { const p = P(); if (!p || !it || !['weapon', 'armor', 'trinket'].includes(it.kind)) return false; p.gear = p.gear || {}; if (p.gear[it.kind]) return false;
    try { if (R.items && typeof R.items.equip === 'function') { R.items.equip(it); return !!(p.gear[it.kind]); } } catch (e) { console.error('items.equip', e); }
    const i = p.inv.indexOf(it); if (i >= 0) p.inv.splice(i, 1); p.gear[it.kind] = it; return true; };
  const take = e => { if (!e || e.dead || e.kind !== 'drop') return false; const p = P(), pl = R.player; if (!p || !pl) return false;
    const x = e.x, y = e.y - 18;
    if (e.sub === 'gold') { const n = e.amount; if (typeof pl.gold === 'function') pl.gold(n); else { p.gold = (p.gold || 0) + n; R.bus.emit('gold', n); } fx(x, y, '+' + n, '#e3b661'); sfx('coin'); }
    else if (e.sub === 'gem') { const n = e.amount; if (typeof pl.gems === 'function') pl.gems(n); else { p.gems = (p.gems || 0) + n; R.bus.emit('gems', n); } fx(x, y, '+' + n + ' 💎', '#5fd3ff', true); toast('+' + n + (n > 1 ? ' gems' : ' gem'), '#5fd3ff'); sfx('loot'); }
    else if (e.sub === 'potion') { p.potions = p.potions || { hp: 0, mana: 0 }; const k = e.ptype || 'hp'; if ((p.potions[k] || 0) >= C.POTION_MAX) return false; p.potions[k] = (p.potions[k] || 0) + e.amount; fx(x, y, '+' + e.amount + ' ' + e.icon, e.col); toast('+' + e.name, e.col); sfx('loot'); }
    else if (e.sub === 'mat') { const it = e.item; p.inv = p.inv || []; const same = p.inv.find(q => q && q.kind === 'mat' && q.id === it.id); if (same) same.n = (same.n || 1) + (it.n || 1); else { if (p.inv.length >= invMax()) { toast('Bag full', '#e14b4b'); return false; } p.inv.push(it); }
      fx(x, y, '+' + (it.n || 1) + ' ' + e.icon, e.col); toast('+' + it.name + ((it.n || 1) > 1 ? ' ×' + it.n : ''), e.col); R.bus.emit('loot', it); sfx('loot'); }
    else if (e.sub === 'item') { const it = e.item; p.inv = p.inv || []; const slotFree = p.gear && !p.gear[it.kind] && ['weapon', 'armor', 'trinket'].includes(it.kind);
      if (!slotFree && p.inv.length >= invMax()) { toast('Bag full', '#e14b4b'); return false; } p.inv.push(it); const eq = equipFree(it);
      fx(x, y, e.icon + ' ' + it.name, e.col, (it.rar | 0) >= 2); toast('+' + it.name + (eq ? ' (equipped)' : ''), e.col); R.bus.emit('loot', it); sfx('loot'); }
    else return false;
    e.dead = true; e.taken = true; R.remove(e); if (cur && cur.e === e) clearInteract(); R.save && R.save(); return true; };

  /* ---------- chests ---------- */
  const chest = (x, y, lvl, rar) => { lvl = Math.max(1, lvl || (R.player && R.player.lvl) || 1); rar = R.clamp(rar == null ? 1 : rar | 0, 0, 4);
    return R.spawn({ kind: 'chest', x, y, r: 18, team: 2, hp: 1, hpMax: 1, lvl, rar, opened: false, icon: '🧰', col: col(rar), glow: rar >= 2 ? col(rar) : null, name: RAR_NAME[rar] + ' chest', solid: false, age: 0 }); };
  const open = e => { if (!e || e.dead || e.kind !== 'chest' || e.opened) return null; e.opened = true; e.anim = 'open'; e.animT = 0; e.age = 0; e.glow = null; const out = [];
    for (let i = 0; i < 3; i++) out.push(spawn('item', e.x, e.y, { lvl: e.lvl, rar: i === 0 ? e.rar : Math.max(0, e.rar - 1), angle: (i / 3) * Math.PI * 2 - Math.PI / 2 + rnd() * 0.6 }));
    out.push(...goldBurst(e.x, e.y, Math.round(e.lvl * rr(15, 30) * (1 + e.rar * 0.5)), 3));
    if (e.rar >= 2) out.push(spawn('gem', e.x, e.y, { amount: ri(e.rar - 1, e.rar + 1) }));
    e.drops = out; if (cur && cur.e === e) clearInteract(); if (R.fx && R.fx.shake) try { R.fx.shake(3, 0.15); } catch (x) {} sfx('loot'); R.bus.emit('chest', e); return out; };

  /* ---------- interact ---------- */
  let cur = null;
  const setInteract = e => { if (!R.input) return; if (R.input.interact && R.input.interact.src !== 'loot') return; if (cur && cur.e === e) return;
    cur = { label: e.kind === 'chest' ? 'Open chest' : 'Take ' + e.name, e, src: 'loot', act: () => (e.kind === 'chest' ? open(e) : take(e)) }; R.input.interact = cur; };
  const clearInteract = () => { if (R.input && R.input.interact && R.input.interact.src === 'loot') R.input.interact = null; cur = null; };
  R.bus.on('interact', x => { const t = x && x.kind ? x : x && (x.e || x.ent || x.target); if (!t) return; if (t.kind === 'drop') take(t); else if (t.kind === 'chest') open(t); });

  /* ---------- system ---------- */
  const update = dt => { const pl = R.player; const alive = pl && !pl.dead && P(); let best = null, bestD = C.TAKE_R; const p = P();
    for (let i = R.ents.length - 1; i >= 0; i--) { const e = R.ents[i]; if (e.dead) continue;
      if (e.kind === 'chest') { if (e.opened) { e.age += dt; if (e.age >= C.CHEST_LIFE) { e.dead = true; R.remove(e); } } else if (alive) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < bestD) { best = e; bestD = d; } } continue; }
      if (e.kind !== 'drop') continue;
      e.age += dt; if (e.age >= e.life) { e.dead = true; R.remove(e); if (cur && cur.e === e) clearInteract(); continue; }
      if (e.vx || e.vy) { const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; let ok = true; try { if (R.world && R.world.blocked && R.world.blocked(nx, ny)) ok = false; } catch (x) {} if (ok) { e.x = nx; e.y = ny; } else { e.vx = e.vy = 0; } const f = Math.exp(-8 * dt); e.vx *= f; e.vy *= f; if (Math.abs(e.vx) + Math.abs(e.vy) < 2) e.vx = e.vy = 0; }
      if (e.vz || e.z > 0) { e.vz -= 500 * dt; e.z += e.vz * dt; if (e.z <= 0) { e.z = 0; e.vz = e.vz < -40 ? -e.vz * 0.35 : 0; } }
      e.blink = e.life - e.age < 8;
      if (!alive) continue; const d = Math.hypot(e.x - pl.x, e.y - pl.y);
      if (e.auto) { if (e.sub === 'potion' && p.potions && (p.potions[e.ptype || 'hp'] || 0) >= C.POTION_MAX) continue;
        if (d <= C.PICK_R) { take(e); continue; }
        if (d < C.MAGNET_R && e.age > 0.25) { const sp = 260 + (C.MAGNET_R - d) * 4; const k = Math.min(1, sp * dt / d); e.x += (pl.x - e.x) * k; e.y += (pl.y - e.y) * k; e.vx = e.vy = 0; } }
      else { if (d <= C.TAKE_R) { if (d < bestD) { best = e; bestD = d; } if (d <= pl.r + e.r + 6) { e.standT += dt; if (e.standT >= C.STAND_T) { take(e); continue; } } else e.standT = 0; } else e.standT = 0; } }
    if (best) setInteract(best); else if (cur) clearInteract(); };
  if (R.addSys) R.addSys('loot', { order: 35, update });

  /* ---------- optional draw helper for the renderer ---------- */
  const drawDrop = (ctx, e, sx, sy) => { if (!e || e.dead) return; if (sx == null) { const s = R.w2s(e.x, e.y); sx = s.x; sy = s.y; } const z = R.cam.z || 1;
    if (e.blink && Math.floor(R.t * 6) % 2) return;
    ctx.save(); if (e.glow) { const g = ctx.createLinearGradient(0, sy - 90 * z, 0, sy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, e.glow); ctx.globalAlpha = 0.45 + 0.15 * Math.sin(R.t * 4); ctx.fillStyle = g; ctx.fillRect(sx - 5 * z, sy - 90 * z, 10 * z, 90 * z); ctx.globalAlpha = 1; }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2); ctx.fill();
    const h = (e.z || 0) + (e.kind === 'chest' ? 0 : 3 + 2 * Math.sin(R.t * 3 + (e.id || 0)));
    ctx.font = Math.round((e.kind === 'chest' ? 26 : 18) * z) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = e.col || '#fff'; ctx.fillText(e.icon || '❔', sx, sy - (10 + h) * z);
    if (e.kind === 'chest' && e.opened) { ctx.globalAlpha = 0.5; ctx.fillText('✨', sx, sy - 30 * z); } ctx.restore(); };

  R.loot = { C, RAR_COL, RAR_NAME, drop, spawn, goldBurst, chest, take, open, drawDrop, drops: () => R.ents.filter(e => !e.dead && (e.kind === 'drop' || e.kind === 'chest')), interact: () => cur };
  R.bus.on('kill', m => { try { drop(m); } catch (e) { console.error('loot.drop', e); } });
})();
