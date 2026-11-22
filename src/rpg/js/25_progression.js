/* HOLDOR RPG — progression (P1): talents, extra XP sources, level milestones.  R.prog, R.screens.talents.
   Talents: a point every 5 levels (5, 10 … 60 → 12 at most); per class 3 branches × 4 tiers, ranks 2/2/2/1 (7 a branch, 21 a class), so
   a level-60 hero fills one branch and most of a second.  Tier t of a branch opens with 2·(t−1) points spent in THAT branch.  The learned
   ranks live in R.state.p.talents {nodeId: rank} — they die with the hero (a new hero is R.blankHero(): no talents).  Points are derived
   from the level (earned(lvl) − spent), never stored, so a load or a double level-up cannot mint extra ones.
   R.prog.mods() → {hpPct, atkPct, defPct, critAdd, spdAdd, regenPct, cdrPct, skillPct:{skillId: pct}} summed from the hero's ranks
   (percent numbers: hpPct 8 = +8 % hp; critAdd = crit points; spdAdd = speed units/s; regenPct = +% out-of-combat regen; cdrPct = −% cooldowns,
   skillPct = +% damage / heal / shield of that skill; cdrPct capped at 30).  21_player recalc and 22_skills read it (guard: R.prog && R.prog.mods);
   the shortcuts R.prog.skillK(id) / cdK() / regenK() are the multipliers.
   XP sources (per hero, once each, ledger in R.state.p.prog {poi, reg, kin, mile}): a POI the hero reaches for the first time (+4 kills of
   his level), a region he walks into for the first time (+15), the first kill of each mob type (+3); the region / POIs the hero is born in
   (the first 1.5 s of a life, and the first region of a ledger) are recorded without XP.  The unit is R.data.balance.mob.xp(lvl) (else 6+3L).
   Milestones 5/10/20/30/40/50/60: a card (the title 46_achievements grants at that level, else the milestone's own name), shown when no
   screen is open; R.state.acc.best.lvl keeps the max.  Events: 'talent'(nodeId, rank, branch) on a learn, 'talent'('point', unspent) when
   a point is earned, 'milestone'(lvl).  API: R.prog.{TREES, NODES, earned(lvl), spent(), unspent(), hint(), mods(), can(id), learn(id), rank(id),
   skillK(id), cdK(), regenK(), open(), panel(), xpUnit(), award(kind, key, n), MILES}.  Everything is guarded; nothing throws at load. */
(function () {
  const R = window.R; if (!R) return;
  R.data = R.data || {}; R.screens = R.screens || {};
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const on = (ev, fn) => { try { R.bus && R.bus.on && R.bus.on(ev, fn); } catch (e) {} };
  const emit = (...a) => { try { R.bus && R.bus.emit && R.bus.emit(...a); } catch (e) {} };
  const toast = (t, c) => { try { R.ui && R.ui.toast && R.ui.toast(t, c); } catch (e) {} };
  const sfx = n => { try { R.sfx && R.sfx.play && R.sfx.play(n); } catch (e) {} };
  const hap = k => { try { if (R.state && R.state.opts && R.state.opts.haptic === 0) return; if (typeof R.haptic === 'function') return R.haptic(k);
    const H = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback; if (H) H.impactOccurred(k === 'heavy' ? 'heavy' : 'light'); } catch (e) {} };
  const save = () => { try { R.save && R.save(); } catch (e) {} };
  const P = () => (R.state && R.state.p) || null;
  const A = () => { try { if (typeof R.acc === 'function') { const a = R.acc(); if (a) return a; } } catch (e) {} return (R.state && R.state.acc) || null; };
  const EVERY = 5, MAXPTS = 12, RANKS = [2, 2, 2, 1], GATE = 2, MILES = [5, 10, 20, 30, 40, 50, 60];

  /* ---- the trees: e = effect per rank ({hp, atk, def, crit, spd, regen, cdr} or sk:{skillId: pct}) ---- */
  const T = (id, name, d, e) => ({ id, name, d, e });
  const TREES = {
    knight: [
      { id: 'k_iron', name: 'Iron Hide', icon: 'shield', nodes: [
        T('k_iron1', 'Iron Hide', 'Plate and nerve: +4% defence.', { def: 4 }),
        T('k_iron2', 'Oak Heart', 'A heart that keeps beating: +5% health.', { hp: 5 }),
        T('k_iron3', 'Wall of One', 'Shield of the Watch and Oath of the Gate +15%.', { sk: { k_shield: 15, k_oath: 15 } }),
        T('k_iron4', 'Unbroken', 'Nothing gets through: +8% defence, +8% health.', { def: 8, hp: 8 })] },
      { id: 'k_edge', name: 'Rending Edge', icon: 'blade', nodes: [
        T('k_edge1', 'Rending Edge', 'Find the seam in the mail: +3 crit.', { crit: 3 }),
        T('k_edge2', 'Heavy Hand', 'Every swing lands like a hammer: +4% attack.', { atk: 4 }),
        T('k_edge3', 'Wide Arc', 'Northern Cleave and Ironwood Whirl +12%.', { sk: { k_cleave: 12, k_whirl: 12 } }),
        T('k_edge4', 'Red Harvest', 'The field is yours: +6% attack, +4 crit, Direwolf Lunge +15%.', { atk: 6, crit: 4, sk: { k_lunge: 15 } })] },
      { id: 'k_wind', name: 'Second Wind', icon: 'wind', nodes: [
        T('k_wind1', 'Second Wind', 'Breathe between fights: +25% regeneration.', { regen: 25 }),
        T('k_wind2', 'Steady March', 'Long roads, light feet: +5 speed.', { spd: 5 }),
        T('k_wind3', 'Battle Rhythm', 'The drill becomes instinct: −4% cooldowns.', { cdr: 4 }),
        T('k_wind4', 'Unyielding', 'Rise again and again: +50% regeneration, Oath of the Gate +20%.', { regen: 50, sk: { k_oath: 20 } })] }],
    ranger: [
      { id: 'r_eye', name: 'Keen Eye', icon: 'eye', nodes: [
        T('r_eye1', 'Keen Eye', 'See the gap before it opens: +3 crit.', { crit: 3 }),
        T('r_eye2', 'Steady Draw', 'A full draw every time: +4% attack.', { atk: 4 }),
        T('r_eye3', 'Hawk’s Mark', 'Volley of the Neck and Weirwood Shaft +12%.', { sk: { r_volley: 12, r_weir: 12 } }),
        T('r_eye4', 'Deadeye', 'One breath, one shaft: +5 crit, +6% attack.', { crit: 5, atk: 6 })] },
      { id: 'r_foot', name: 'Fleet Foot', icon: 'foot', nodes: [
        T('r_foot1', 'Fleet Foot', 'Moss under the boot: +6 speed.', { spd: 6 }),
        T('r_foot2', 'Light Pack', 'Carry less, act sooner: −4% cooldowns.', { cdr: 4 }),
        T('r_foot3', 'Ghost Step', 'Shadowcat Step +15%, Crannogman’s Snare +12%.', { sk: { r_step: 15, r_snare: 12 } }),
        T('r_foot4', 'Windrunner', 'Gone before the blow falls: +10 speed, −6% cooldowns.', { spd: 10, cdr: 6 })] },
      { id: 'r_barb', name: 'Barbed Arrows', icon: 'arrow', nodes: [
        T('r_barb1', 'Barbed Arrows', 'Heads that bite and stay: Volley +10%, Rain of Arrows +10%.', { sk: { r_volley: 10, r_rain: 10 } }),
        T('r_barb2', 'Hunter’s Hide', 'Boiled leather, thick fur: +4% health, +3% defence.', { hp: 4, def: 3 }),
        T('r_barb3', 'Thorn Craft', 'Crannogman’s Snare and Thorn Ring +15%.', { sk: { r_snare: 15, r_ring: 15 } }),
        T('r_barb4', 'Bloodied Fletching', 'Every feather red: +6% attack, Rain of Arrows +20%.', { atk: 6, sk: { r_rain: 20 } })] }],
    maester: [
      { id: 'm_fire', name: 'Wildfire Lore', icon: 'flame', nodes: [
        T('m_fire1', 'Wildfire Lore', 'Measured by the drop: Wildfire Flask +12%.', { sk: { m_flask: 12 } }),
        T('m_fire2', 'Green Spill', 'Alchemist’s Green +12%, Dragonfire Reckoning +8%.', { sk: { m_pool: 12, m_storm: 8 } }),
        T('m_fire3', 'Ember Mind', 'Thoughts that burn: +4% attack.', { atk: 4 }),
        T('m_fire4', 'Heart of Green Flame', 'The fire answers you: +6% attack, Dragonfire Reckoning +20%.', { atk: 6, sk: { m_storm: 20 } })] },
      { id: 'm_frost', name: 'Frost Lore', icon: 'frost', nodes: [
        T('m_frost1', 'Frost Lore', 'Cold, written down: Breath of the Long Night +12%.', { sk: { m_frost: 12 } }),
        T('m_frost2', 'Winter’s Patience', 'Wait for the moment: −4% cooldowns.', { cdr: 4 }),
        T('m_frost3', 'Rime Ward', 'A skin of frost: +4% defence, +4% health.', { def: 4, hp: 4 }),
        T('m_frost4', 'Deep Winter', 'The cold never leaves: −6% cooldowns, Breath of the Long Night +20%.', { cdr: 6, sk: { m_frost: 20 } })] },
      { id: 'm_heal', name: 'Healer’s Hands', icon: 'hand', nodes: [
        T('m_heal1', 'Healer’s Hands', 'Steady fingers: Citadel Tincture +15%.', { sk: { m_tinct: 15 } }),
        T('m_heal2', 'Herb Lore', 'Bitter roots, quick mending: +25% regeneration.', { regen: 25 }),
        T('m_heal3', 'Sturdy Robes', 'Grey wool over chain: +5% health.', { hp: 5 }),
        T('m_heal4', 'Grey Mender', 'You will not fall today: +8% health, +50% regeneration, Citadel Tincture +25%.', { hp: 8, regen: 50, sk: { m_tinct: 25 } })] }] };
  const NODES = {};
  for (const cls of Object.keys(TREES)) TREES[cls].forEach((b, bi) => b.nodes.forEach((n, ti) => { n.cls = cls; n.branch = b.id; n.bi = bi; n.tier = ti; n.max = RANKS[ti]; n.need = GATE * ti; NODES[n.id] = n; }));
  R.data.talents = TREES;

  /* ---- points ---- */
  const cls = () => { const p = P(); if (!p) return 'knight'; let c = p.cls; try { if (R.plr && typeof R.plr.clsName === 'function') c = R.plr.clsName(); } catch (e) {} return TREES[c] ? c : 'knight'; };
  const tal = () => { const p = P(); if (!p) return {}; if (!p.talents || typeof p.talents !== 'object' || Array.isArray(p.talents)) p.talents = {}; return p.talents; };
  const earned = lvl => { if (lvl == null) { const p = P(); lvl = p ? num(p.lvl, 1) : 1; } return Math.max(0, Math.min(MAXPTS, Math.floor(num(lvl, 1) / EVERY))); };
  const rank = id => { const n = NODES[id]; if (!n || n.cls !== cls()) return 0; return Math.max(0, Math.min(n.max, Math.floor(num(tal()[id], 0)))); };
  const inBranch = bid => { let s = 0; for (const n of Object.values(NODES)) if (n.branch === bid) s += rank(n.id); return s; };
  const spent = () => { let s = 0; for (const b of TREES[cls()]) s += inBranch(b.id); return s; };
  const unspent = () => P() ? Math.max(0, earned() - spent()) : 0;
  // why a node cannot be learned now ('' = it can)
  const why = id => { const n = NODES[id]; if (!n || !P()) return 'Unknown talent'; if (n.cls !== cls()) return 'Another class';
    if (rank(id) >= n.max) return 'Mastered'; const have = inBranch(n.branch); if (have < n.need) return 'Needs ' + n.need + ' points in ' + branchName(n.branch);
    if (unspent() < 1) { const p = P(), L = num(p.lvl, 1); return earned(L) >= MAXPTS ? 'No points left' : 'Next point at level ' + (Math.floor(L / EVERY) + 1) * EVERY; } return ''; };
  const branchName = bid => { for (const c of Object.keys(TREES)) for (const b of TREES[c]) if (b.id === bid) return b.name; return bid; };
  const can = id => why(id) === '';
  const learn = id => { if (!can(id)) return false; const t = tal(); const n = NODES[id]; t[id] = rank(id) + 1;
    try { R.player && typeof R.player.recalc === 'function' && R.player.recalc(); } catch (e) {}
    emit('talent', id, t[id], n.branch); sfx('levelup'); hap('medium'); save(); return true; };
  const mods = () => { const o = { hpPct: 0, atkPct: 0, defPct: 0, critAdd: 0, spdAdd: 0, regenPct: 0, cdrPct: 0, skillPct: {} }; if (!P()) return o;
    const K = { hp: 'hpPct', atk: 'atkPct', def: 'defPct', crit: 'critAdd', spd: 'spdAdd', regen: 'regenPct', cdr: 'cdrPct' };
    for (const b of TREES[cls()]) for (const n of b.nodes) { const r = rank(n.id); if (!r) continue;
      for (const k of Object.keys(n.e)) { if (k === 'sk') { for (const s of Object.keys(n.e.sk)) o.skillPct[s] = (o.skillPct[s] || 0) + n.e.sk[s] * r; } else if (K[k]) o[K[k]] += n.e[k] * r; } }
    o.cdrPct = Math.min(30, o.cdrPct); return o; };

  /* ---- XP sources ---- */
  const ledger = () => { const p = P(); if (!p) return null; const g = p.prog && typeof p.prog === 'object' ? p.prog : (p.prog = {}); for (const k of ['poi', 'reg', 'kin', 'mile']) if (!g[k] || typeof g[k] !== 'object') g[k] = {}; return g; };
  const XPK = { poi: 4, reg: 15, kin: 3 };
  const xpUnit = () => { const p = P(); const L = p ? num(p.lvl, 1) : 1; const B = R.data.balance; try { if (B && B.mob && typeof B.mob.xp === 'function') { const v = num(B.mob.xp(L), 0); if (v > 0) return v; } } catch (e) {} return 6 + 3 * L; };
  let bornT = -99;
  const quiet = () => num(R.t, 0) - bornT < 1.5;
  // award(kind, key) → xp given (0 when already recorded, the hero is dead / absent, or the hero was just born there)
  const award = (kind, key, n) => { const p = P(), e = R.player, g = ledger(); if (!p || !g || !g[kind] || key == null || key === '') return 0; key = String(key);
    if (g[kind][key]) return 0; const first = kind === 'reg' && !Object.keys(g.reg).length; g[kind][key] = 1;
    if (quiet() || first || !e || e.dead || typeof e.gainXp !== 'function') { save(); return 0; }
    const xp = Math.max(1, Math.round(n != null ? n : XPK[kind] * xpUnit())); try { e.gainXp(xp); } catch (x) { return 0; } emit('xpsrc', kind, key, xp); save(); return xp; };
  const born = () => { bornT = num(R.t, 0); };
  on('hero', born); on('start', () => { const g = ledger(); if (g && !Object.keys(g.reg).length && !Object.keys(g.poi).length) born(); });
  on('poi', id => award('poi', id));
  on('enter', id => award('reg', id));
  on('kill', (m, by) => { const e = R.player; if (!m || !e || (m.kind !== 'mob' && m.kind !== 'boss') || !m.type) return; if (by && by !== e && by.team !== 0) return; award('kin', m.type); });

  /* ---- milestones + the point notice ---- */
  const MNAME = { 5: 'Blooded', 10: 'Tested in the Field', 20: 'Steel Proven', 30: 'Banner-worthy', 40: 'Hardened by Winters', 50: 'Song-worthy', 60: 'Legend Living' };
  const achTitle = L => { const D = R.data.achievements; const list = Array.isArray(D) ? D : D ? Object.values(D) : [];
    const a = list.find(x => x && x.cond && x.cond.ev === 'levelup' && !x.cond.key && x.cond.n === L); return a ? ((a.reward && a.reward.title) || a.name || '') : ''; };
  const queue = [];
  let cardEl = null, cardT = 0;
  const flush = () => { if (cardEl || !queue.length || (R.ui && R.ui.cur) || typeof document === 'undefined') return; const q = queue.shift();
    if (q.toast) { toast(q.toast, q.col); return flush(); } showCard(q); };
  const col = () => { const a = A(), p = P(); const h = (a && a.house) || (p && p.house) || 'stark'; const H = R.data.houses && R.data.houses[h]; return (H && (H.col || H.color)) || '#e3b661'; };
  const showCard = q => { const host = document.getElementById('ui') || document.body; if (!host) return; const d = document.createElement('div'); d.className = 'pg-mile'; d.style.setProperty('--acc', col());
    d.innerHTML = '<div class="pg-mile-in"><div class="pg-mile-eye">Milestone</div><div class="pg-mile-lv">' + q.lvl + '</div><div class="pg-mile-t">' + esc(q.title) + '</div>' +
      (q.pt ? '<div class="pg-mile-s">+1 talent point</div>' : '') + '</div>';
    d.addEventListener('click', () => closeCard()); host.appendChild(d); cardEl = d; sfx('levelup'); hap('heavy'); clearTimeout(cardT); cardT = setTimeout(closeCard, 3200); };
  const closeCard = () => { clearTimeout(cardT); if (cardEl) { try { cardEl.remove(); } catch (e) {} } cardEl = null; setTimeout(flush, 120); };
  on('screen', n => { if (!n) setTimeout(flush, 250); });
  on('levelup', lvl => { const p = P(); lvl = num(lvl, p ? num(p.lvl, 1) : 1); const a = A(); if (a) { a.best = a.best || {}; a.best.lvl = Math.max(num(a.best.lvl, 0), lvl); }
    const pt = lvl % EVERY === 0 && lvl / EVERY <= MAXPTS; if (pt) emit('talent', 'point', unspent());
    const g = ledger(); if (MILES.includes(lvl) && g && !g.mile[lvl]) { g.mile[lvl] = 1; queue.push({ lvl, title: achTitle(lvl) || MNAME[lvl] || 'Level ' + lvl, pt }); emit('milestone', lvl); }
    else if (pt) queue.push({ toast: 'Talent point! Open Talents to spend it', col: col() });
    save(); setTimeout(flush, 250); });

  /* ---- the talents screen ---- */
  const ICON = {
    shield: '<path d="M16 3l10 4v8c0 7-4 11-10 14C10 26 6 22 6 15V7z"/><path d="M16 8v16M11 14h10"/>',
    blade: '<path d="M7 25L23 9l3-4-4 3L6 24z"/><path d="M9 19l4 4M5 27l3-3"/>',
    wind: '<path d="M4 12h15a4 4 0 1 0-4-4"/><path d="M4 18h20a4 4 0 1 1-4 4"/><path d="M4 24h8"/>',
    eye: '<path d="M3 16c4-7 9-9 13-9s9 2 13 9c-4 7-9 9-13 9S7 23 3 16z"/><circle cx="16" cy="16" r="4"/>',
    foot: '<path d="M11 27c-3 0-4-3-3-6l2-9c1-3 6-3 6 1l-1 9c0 3-1 5-4 5z"/><circle cx="20" cy="8" r="2"/><circle cx="24" cy="12" r="1.6"/><circle cx="25" cy="17" r="1.4"/>',
    arrow: '<path d="M5 27L26 6"/><path d="M26 6l-7 1M26 6l-1 7"/><path d="M5 27l1-5M5 27l5-1M8 24l1-4M8 24l4-1"/>',
    flame: '<path d="M16 29c-6 0-9-4-9-9 0-6 6-9 6-16 4 3 7 6 7 10 1-2 2-3 2-5 3 3 3 7 3 11 0 5-3 9-9 9z"/><path d="M16 25c-2 0-3-2-3-4 0-2 3-4 3-6 2 2 3 4 3 6s-1 4-3 4z"/>',
    frost: '<path d="M16 3v26M5 9.5l22 13M27 9.5L5 22.5"/><path d="M12 5l4 3 4-3M12 27l4-3 4 3M5 14l3-1-1-4M27 18l-3 1 1 4M27 14l-3-1 1-4M5 18l3 1-1 4"/>',
    hand: '<path d="M10 28c-3-2-4-5-4-8v-6c0-1.5 2-1.5 2 0v4V7c0-1.5 2.5-1.5 2.5 0v8V5c0-1.5 2.5-1.5 2.5 0v10V6c0-1.5 2.5-1.5 2.5 0v10-6c0-1.5 2.5-1.5 2.5 0v10c0 4-2 8-6 8z"/><path d="M22 6l2-2M25 9l2-1"/>' };
  const svg = (k, s) => '<svg viewBox="0 0 32 32" width="' + (s || 26) + '" height="' + (s || 26) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICON[k] || ICON.shield) + '</svg>';
  const fx = n => { const e = n.e, out = []; const L = { hp: '% health', atk: '% attack', def: '% defence', crit: ' crit', spd: ' speed', regen: '% regen', cdr: '% cooldowns' };
    for (const k of Object.keys(e)) { if (k === 'sk') { for (const s of Object.keys(e.sk)) { const S = R.data.skills && R.data.skills[s]; out.push('+' + e.sk[s] + '% ' + ((S && S.name) || s)); } } else if (L[k]) out.push((k === 'cdr' ? '−' : '+') + e[k] + L[k]); } return out; };
  let root = null, sel = null;
  const render = () => { if (!root) return; const p = P() || {}, c = cls(), tr = TREES[c], u = unspent(), Cn = (R.data.classes && R.data.classes[c] && R.data.classes[c].name) || c;
    if (!sel || !NODES[sel] || NODES[sel].cls !== c) { sel = null; for (const b of tr) for (const n of b.nodes) if (!sel && can(n.id)) sel = n.id; if (!sel) sel = tr[0].nodes[0].id; }
    root.style.setProperty('--acc', col());
    let h = '<div class="pg-head"><div class="pg-who"><div class="pg-eye">Talents</div><div class="pg-name">' + esc(p.name || 'Hero') + '</div><div class="pg-sub">' + esc(Cn) + ' · Level ' + num(p.lvl, 1) + '</div></div>' +
      '<button class="pg-x" data-act="close" aria-label="Close">✕</button></div>';
    h += '<div class="pg-pts' + (u ? ' on' : '') + '"><b>' + u + '</b><span>' + (u === 1 ? 'point to spend' : 'points to spend') + '</span><i>' + spent() + ' / ' + MAXPTS + ' learned · a point every 5 levels</i></div>';
    h += '<div class="pg-tree">';
    for (const b of tr) { h += '<div class="pg-br" data-br="' + b.id + '"><div class="pg-bh">' + svg(b.icon, 22) + '<span>' + esc(b.name) + '</span><em>' + inBranch(b.id) + '</em></div>';
      b.nodes.forEach((n, i) => { const r = rank(n.id), open = inBranch(b.id) >= n.need, st = r >= n.max ? 'max' : r ? 'part' : open ? 'open' : 'lock';
        if (i) h += '<div class="pg-link ' + (open ? 'on' : '') + '"></div>';
        h += '<button class="pg-n ' + st + (sel === n.id ? ' sel' : '') + (st !== 'lock' && st !== 'max' && u ? ' can' : '') + '" data-node="' + n.id + '"><span class="pg-ic">' + svg(b.icon, 20) + '</span><span class="pg-nm">' + esc(n.name) + '</span><span class="pg-rk">' +
          Array.from({ length: n.max }, (_, k) => '<i class="' + (k < r ? 'on' : '') + '"></i>').join('') + '</span></button>'; });
      h += '</div>'; }
    h += '</div>';
    const n = NODES[sel], r = rank(sel), w = why(sel);
    h += '<div class="pg-det"><div class="pg-dt"><b>' + esc(n.name) + '</b><span>Rank ' + r + ' / ' + n.max + ' · tier ' + (n.tier + 1) + '</span></div><div class="pg-dd">' + esc(n.d) + '</div>' +
      '<div class="pg-df">' + fx(n).map(t => '<span>' + esc(t) + (n.max > 1 ? ' a rank' : '') + '</span>').join('') + '</div></div>';
    const M = mods(), sum = []; if (M.hpPct) sum.push('+' + M.hpPct + '% health'); if (M.atkPct) sum.push('+' + M.atkPct + '% attack'); if (M.defPct) sum.push('+' + M.defPct + '% defence');
    if (M.critAdd) sum.push('+' + M.critAdd + ' crit'); if (M.spdAdd) sum.push('+' + M.spdAdd + ' speed'); if (M.regenPct) sum.push('+' + M.regenPct + '% regen'); if (M.cdrPct) sum.push('−' + M.cdrPct + '% cooldowns');
    for (const k of Object.keys(M.skillPct)) { const S = R.data.skills && R.data.skills[k]; sum.push('+' + M.skillPct[k] + '% ' + ((S && S.name) || k)); }
    h += '<div class="pg-sum"><div class="pg-eye">This hero</div>' + (sum.length ? sum.map(t => '<span>' + esc(t) + '</span>').join('') : '<em>Nothing learned yet. Each fifth level brings a point; they fall with the hero.</em>') + '</div>';
    h += '<button class="pg-pri' + (w ? ' off' : '') + '" data-act="learn">' + (w ? esc(w) : 'LEARN ' + esc(n.name).toUpperCase() + ' · 1 point') + '</button>';
    root.innerHTML = h;
    root.querySelectorAll('[data-node]').forEach(b => b.addEventListener('click', () => { sel = b.dataset.node; hap('light'); render(); }));
    root.querySelector('[data-act="close"]').addEventListener('click', () => { try { R.ui.close(); } catch (e) {} });
    root.querySelector('[data-act="learn"]').addEventListener('click', () => { if (learn(sel)) { render(); const b = root && root.querySelector('[data-node="' + sel + '"]'); if (b) b.classList.add('pop'); } else { hap('light'); toast(why(sel) || 'Not now', '#e3b661'); } }); };
  R.screens.talents = { open(arg, el) { root = document.createElement('div'); root.className = 'pg'; root.id = 'talents'; (el || document.getElementById('screen') || document.body).appendChild(root); sel = arg && NODES[arg] ? arg : null; render(); },
    close() { root = null; }, render, get sel() { return sel; } };

  /* ---- a compact Level panel for a menu (54_menu has no add-item hook yet: R.prog.panel() → element, R.prog.open() → the screen) ---- */
  const open = id => { try { return R.ui && R.ui.open ? R.ui.open('talents', id) : null; } catch (e) { return null; } };
  const panel = () => { if (typeof document === 'undefined') return null; const p = P() || {}, L = num(p.lvl, 1), u = unspent(); let nx = 0; try { nx = R.plr && R.plr.xpNext ? R.plr.xpNext(L) : 80 + 45 * L + 6 * L * L; } catch (e) {}
    const pc = L >= 60 ? 100 : Math.max(0, Math.min(100, Math.round(num(p.xp, 0) / Math.max(1, nx) * 100))); const a = A(); const best = Math.max(L, num(a && a.best && a.best.lvl, 0));
    const d = document.createElement('button'); d.className = 'pg-panel'; d.dataset.act = 'talents'; d.style.setProperty('--acc', col());
    d.innerHTML = '<span class="pg-pl">' + L + '</span><span class="pg-pm"><b>Level ' + L + (L >= 60 ? ' · max' : '') + '</b><span class="pg-bar"><i style="width:' + pc + '%"></i></span><small>' + (L >= 60 ? 'Best ever ' + best : num(p.xp, 0) + ' / ' + nx + ' xp · best ' + best) + '</small></span>' +
      '<span class="pg-pr">Talents' + (u ? '<em>' + u + '</em>' : '') + '</span>';
    d.addEventListener('click', () => open()); return d; };

  // shortcuts for the readers: skillK(id) multiplies a skill's damage / heal / shield, cdK() its cooldown, regenK() the out-of-combat regen
  const skillK = id => 1 + num(mods().skillPct[id], 0) / 100, cdK = () => 1 - mods().cdrPct / 100, regenK = () => 1 + mods().regenPct / 100;
  R.prog = { TREES, NODES, MILES, EVERY, MAXPTS, earned, spent, unspent, hint: () => (unspent() > 0 ? '!' : ''), mods, skillK, cdK, regenK, can, why, learn, rank, inBranch, open, panel, xpUnit, award, ledger, XPK, born };
})();
