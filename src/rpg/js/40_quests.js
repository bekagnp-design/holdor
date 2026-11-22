/* HOLDOR RPG — quests (A18). The quest model over R.data.quests (written by 41_story.js; an empty list without it), the tracker card
   under the HP bar, the quest log screen and the markers for the map / minimap / renderer.
   quest def: {id, title, giver:npcId, poi, region, lvl, main, prev?, type:'kill'|'collect'|'reach'|'boss'|'talk'|'escort',
               target:{mob?|item?|poi?|boss?|npc?}, n, text:{offer, progress, done}, reward:{xp, gold, gems?, item?:{rar}, hero?:champId (or comp:)}}
   state (account-wide, save v2 `acc.world.quests`, v1 `p.quests`): {id: {st:'open'|'done'|'turned', n, t}};  flags.track = tracked quest id
   API: R.quests.available(npcId?) accept(id) progress(id, k) turnIn(id) tracked() track(id) markers() forNpc(npcId) state(id) get(id) line(q) refresh()
   in: kill, loot, poi, boss, dialog, levelup, tick1s     out: quest(id, 'open'|'progress'|'done'|'turned') */
(function () {
  const P = () => R.state && R.state.p;
  const ACC = () => { try { if (R.acc) return R.acc(); } catch (e) {} return R.state && R.state.acc; };
  /* every quest is RESOLVED for the account's house before it is offered, tracked or drawn: 41_story's placeholders ('seat', 'seat:<role>',
     'house:N', {hero} …) go through R.story.resolve, and a string target becomes {mob|item+from|poi|boss|npc(+poi)} by the quest type.
     The list is cached per (data array, length, house): a house change or a new account re-resolves it on the next read. */
  const house = () => { const a = ACC(); return (a && a.house) || (P() && P().house) || 'stark'; };
  const normTarget = q => { const t = q.target; if (t && typeof t === 'object' && !Array.isArray(t)) { if (q.type === 'collect' && q.from && !t.from) return Object.assign({ from: q.from }, t); return t; }
    switch (q.type) { case 'kill': return { mob: t }; case 'collect': return { item: t, from: q.from || null }; case 'reach': return { poi: t || q.poi };
      case 'boss': return { boss: t }; case 'talk': return { npc: t }; case 'escort': return { npc: t, poi: q.to || null }; default: return t == null ? {} : { id: t }; } };
  const normalize = q => { let r = q;
    if (R.story && typeof R.story.resolve === 'function' && q && q.text && Array.isArray(q.text.offer)) { try { r = R.story.resolve(q, house()) || q; } catch (e) { r = q; } }
    if (r === q) r = Object.assign({}, q);
    r.giver = notHero(r.giver); r.target = normTarget(r); if (r.target && r.target.npc) r.target = Object.assign({}, r.target, { npc: notHero(r.target.npc) }); const T = r.text || {}; r.text = { offer: Array.isArray(T.offer) ? T.offer.join(' ') : T.offer, progress: T.progress, done: T.done, pages: Array.isArray(T.offer) ? T.offer.slice() : (T.offer ? [T.offer] : []) };
    return r; };
  // the champion the player rides as is not standing at the seat (42_dialog never spawns him): his quests go to a neighbour at the same place
  const npcRow = id => { const N = R.data && R.data.npcs; if (!N || id == null) return null; return Array.isArray(N) ? N.find(n => n && n.id === id) || null : N[id] || null; };
  const notHero = id => { const hero = P() && P().hero, n = npcRow(id); if (!hero || !n || n.champ !== hero) return id;
    const N = Array.isArray(R.data.npcs) ? R.data.npcs : Object.values(R.data.npcs || {}); const at = N.filter(m => m && m.poi === n.poi && m.id !== n.id && m.champ !== hero);
    const alt = at.find(m => m.role === 'arms') || at.find(m => m.role === 'steward') || at.find(m => m.role === 'maester') || at[0]; return alt ? alt.id : id; };
  let qCache = null;
  /* ---- side quests for every town, village, inn, farm, tower and lesser castle (the owner: "towns on the map where there are people you
     take quests from"). Generated ONCE from templates when the world and the NPC roster (42_dialog) are there; deterministic by POI id;
     1–3 per place (town 3, village 2, the rest 1); each pays XP + gold + an item. Hand-written side quests win: a place that has one is skipped. */
  const GEN_TYPES = { town: 3, city: 3, village: 2, hamlet: 2, inn: 1, farm: 1, tower: 1, holdfast: 1, castle: 1, mill: 1 };
  const GIVER_PREF = ['elder', 'innkeeper', 'innkeep', 'farmer', 'hunter', 'guard', 'steward', 'warden', 'ranger', 'lord', 'septon', 'merchant', 'fisher', 'keeper'];
  const BEAST = /wolf|bear|boar|cat|elk|hound|spider|bat|raven|eagle|mammoth|brood/, MEN = /bandit|raider|archer|spear|shield|thenn|berserk|chief|rider|skin|outrider|sword/;
  const TPL = {
    kill: { t: ['Thin the {mobs}', 'Trouble at the fence', 'The road is not safe'],
      o: ['{Mobs} have been seen near {poi}. Put {n} of them down before they come closer.', 'Every night the {mobs} take something from us. Kill {n} and we sleep.',
        'The carts stopped coming because of the {mobs}. {n} of them, and the road opens again.'],
      p: '{Mobs} put down near {poi}', d: ['Quieter already. Take this, and our thanks with it.', 'That will keep the road clear for a few nights. Here.'] },
    collect: { t: ['What was taken', 'Proof of the hunt', 'A debt in kind'],
      o: ['The {mobs} carry {item} off our dead and our sheds. Bring me {n}.', 'I need {n} {item}. The {mobs} near {poi} have plenty of it.'],
      p: '{Item} gathered', d: ['All of it. I did not think anyone would bother. Here.', 'Good. That settles more than one account in {poi}.'] },
    reach: { t: ['A letter for {dest}', 'Word to {dest}', 'The long way round'],
      o: ['Nobody has come from {dest} in a week. Ride there and see that it still stands.', 'Take word to {dest}: {poi} holds, and will hold, if they send help.'],
      p: 'Reach {dest}', d: ['{dest} stands? Then there is hope for us. Take this for the road.', 'You went and came back. That is rarer than gold now.'] },
    talk: { t: ['A word with {npc}', 'News for {npc}', 'Old friends'],
      o: ['{npc} at {dest} owes me an answer. Go and ask for it, then come back.', 'Tell {npc} at {dest} that {poi} still waits. Hear what is said back.'],
      p: 'Speak with {npc}', d: ['So that is the answer. Not what I hoped, but an answer. Thank you.', 'Good. Now we both know where we stand. Take this.'] },
    escort: { t: ['Safe road to {dest}', 'The last cart', 'Walk with me'],
      o: ['I have to reach {dest} before the dark. Walk the road with me and keep the dead off.', 'My cart goes to {dest} today. The road eats carts. See it there.'],
      p: 'Escort the cart to {dest}', d: ['We made it. I would not have alone. This is yours.', 'Whole and on time. That has not happened all winter. Here.'] } };
  const hsh = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const fillT = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v[k] != null ? v[k] : m);
  let genDone = false;
  const genSide = () => {
    if (genDone) return; const W = R.data && R.data.world, NP = R.npcs; if (!W || !Array.isArray(W.pois) || !NP || !NP.npcsAt || !Array.isArray(R.data.quests)) return; genDone = true;
    try {
      const QL = R.data.quests, have = new Set(), byGiver = {}; const N = Array.isArray(R.data.npcs) ? R.data.npcs : [];
      for (const q of QL) if (q && !q.main) { const g = N.find(n => n.id === q.giver); if (g) have.add(g.poi); }
      const XPq = L => 80 + 45 * L + 6 * L * L, pois = W.pois.filter(p => p && p.id && typeof p.x === 'number');
      const spawnOf = reg => { const sp = W.spawnsByRegion ? W.spawnsByRegion[reg] : (W.spawns || []).find(x => x.region === reg); return sp && Array.isArray(sp.mobs) ? sp.mobs : []; };
      const mobLabel = k => { const m = R.data.mobs && R.data.mobs[k]; return ((m && m.name) || k.replace(/_/g, ' ')).toLowerCase(); };
      const plural = s => /s$/.test(s) ? s : /child$/.test(s) ? s + 'ren' : /man$/.test(s) ? s.replace(/man$/, 'men') : /f$/.test(s) ? s.replace(/f$/, 'ves') : /(ch|sh|x)$/.test(s) ? s + 'es' : s + 's';
      const capF = s => s.charAt(0).toUpperCase() + s.slice(1);
      const near = (p, ok) => { let b = null, bd = 1e18; for (const o of pois) { if (o === p || !ok(o)) continue; const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2; if (d < bd) { bd = d; b = o; } } return b; };
      const roster = pid => { try { return (NP.npcsAt(pid) || []).filter(n => n && n.role !== 'smith' && n.kind !== 'smith'); } catch (e) { return []; } };
      for (const p of pois) { try {
        const k = GEN_TYPES[p.type]; if (!k || p.seat || have.has(p.id)) continue; const L0 = roster(p.id); if (!L0.length) continue;
        const givers = L0.slice().sort((a, b) => { const ia = GIVER_PREF.indexOf(String(a.role || a.kind)), ib = GIVER_PREF.indexOf(String(b.role || b.kind)); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
        const rg = W.regionById && W.regionById[p.region], band = (rg && rg.lvl) || [1, 8], h0 = hsh(p.id);
        const mobs = spawnOf(p.region).slice().sort((a, b) => b.w - a.w).slice(0, 5).map(m => m.type).filter(t => R.data.mobs ? !!R.data.mobs[t] : true);
        const order = ['kill', 'collect', 'reach', 'talk', 'escort']; const start = h0 % order.length;
        for (let i = 0; i < k; i++) {
          let type = order[(start + i * 2) % order.length], g = givers[i % Math.min(2, givers.length)], v = { poi: p.name }, q = null;
          const L = Math.max(1, Math.min(60, band[0] + (h0 >>> (i + 3)) % Math.max(1, Math.min(4, band[1] - band[0] + 1)))), id = 'g_' + p.id + '_' + i;
          const pick = (arr, salt) => arr[(h0 >>> salt) % arr.length];
          if ((type === 'kill' || type === 'collect') && !mobs.length) type = 'reach';
          if (type === 'kill' || type === 'collect') { const mob = pick(mobs, i + 1); v.mobs = plural(mobLabel(mob)); v.Mobs = capF(v.mobs); v.n = type === 'kill' ? 4 + (h0 >>> (i + 5)) % 5 : 4 + (h0 >>> (i + 6)) % 3;
            const item = BEAST.test(mob) ? mob + ' pelt' : MEN.test(mob) ? 'stolen goods' : 'grave iron'; v.item = /s$/.test(item) ? item : plural(item); v.Item = capF(v.item);
            q = { type, target: type === 'kill' ? { mob } : { item: v.item, from: mob }, n: v.n }; }
          else if (type === 'reach' || type === 'escort') { const d = near(p, o => o.region === p.region && (GEN_TYPES[o.type] || o.type === 'shrine' || o.seat) && Math.hypot(o.x - p.x, o.y - p.y) > 200); if (!d) continue; v.dest = d.name; q = { type, target: { poi: d.id }, n: 1, to: d.id }; }
          else if (type === 'talk') { let tn = null, d = near(p, o => { if (o.region !== p.region || !GEN_TYPES[o.type] && !o.seat) return false; const r = roster(o.id); if (!r.length) return false; tn = r[0]; return true; });
            if (d) { const r = roster(d.id); tn = r[0]; } if (!d || !tn) continue; v.dest = d.name; v.npc = String(tn.name || tn.id).split(',')[0]; q = { type, target: { npc: tn.id }, n: 1 }; }
          if (!q) continue; const T = TPL[type];
          QL.push(Object.assign(q, { id, gen: true, main: false, prev: null, lvl: L, poi: p.id, region: p.region, giver: g.id, title: fillT(pick(T.t, i + 2), v),
            text: { offer: fillT(pick(T.o, i + 4), v), progress: fillT(T.p, v), done: fillT(pick(T.d, i + 7), v) },
            reward: { xp: Math.round(XPq(L) * 0.6), gold: Math.round(10 + 8 * L + 0.6 * L * L), item: { rar: (h0 >>> (i + 9)) % 4 === 0 ? 2 : 1 } } }));
          byGiver[g.id] = (byGiver[g.id] || 0) + 1; } } catch (e) { console.warn('quests: side quests at ' + p.id, e); } }
      if (R.data.questById) for (const q of QL) R.data.questById[q.id] = q;
    } catch (e) { console.error('quests: side quest generation', e); } };
  const Q = () => { if (!genDone) genSide(); const raw = (R.data && Array.isArray(R.data.quests)) ? R.data.quests : []; const h = house();
    const hero = (P() && P().hero) || ''; if (qCache && qCache.raw === raw && qCache.n === raw.length && qCache.h === h && qCache.hero === hero) return qCache.list;
    const list = raw.filter(Boolean).map(normalize); qCache = { raw, n: raw.length, h, hero, list }; return list; };
  const WORLD = () => { const a = ACC(); return a && (a.world || (a.world = {})); };
  const QS = () => { const w = WORLD(); if (w) return w.quests || (w.quests = {}); const p = P(); return p ? (p.quests || (p.quests = {})) : null; };
  const flags = () => { const w = WORLD(); if (w) return w.flags || (w.flags = {}); const p = P(); return p ? (p.flags || (p.flags = {})) : {}; };
  const get = id => Q().find(q => q.id === id) || null;
  const st = id => { const s = QS(); return (s && s[id]) || null; };
  const lvl = () => (P() && P().lvl) || 1;

  /* ---- names and positions (soft: data modules may be absent) ---- */
  const cap = s => s == null ? '' : String(s).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const findIn = (coll, id) => { if (!coll || id == null) return null; if (Array.isArray(coll)) return coll.find(x => x && (x.id === id || x.key === id)) || null; const v = coll[id]; return v && typeof v === 'object' ? v : null; };
  const npcData = id => findIn(R.data.npcs, id) || (R.data.story && findIn(R.data.story.npcs, id)) || (R.data.world && findIn(R.data.world.npcs, id)) || null;
  const npcKey = e => e.npc || e.type || e.key || e.nid;
  const npcEnt = id => R.find(e => e.kind === 'npc' && !e.dead && npcKey(e) === id);
  const poiData = id => (R.data.world && findIn(R.data.world.pois, id)) || null;
  const npcName = id => { const e = npcEnt(id), d = npcData(id); return (e && e.name) || (d && d.name) || cap(id); };
  const poiName = id => { const d = poiData(id); return (d && d.name) || cap(id); };
  const mobName = t => { const m = R.data.mobs && findIn(R.data.mobs, t); return (m && m.name) || cap(t); };
  const bossName = b => { const m = R.data.bosses && findIn(R.data.bosses, b); return (m && m.name) || cap(b); };
  const champName = c => { const m = R.data.champs && findIn(R.data.champs, c); return (m && m.name) || cap(c); };
  const itemName = i => { const I = R.data.items; const m = I && (findIn(I, i) || findIn(I.bases, i) || findIn(I.mats, i)); return (m && m.name) || cap(i); };
  const plural = (s, n) => n === 1 || /s$/i.test(s) ? s : /man$/i.test(s) ? s.replace(/man$/i, 'men') : /f$/.test(s) ? s.replace(/f$/, 'ves') : /(ch|sh|x)$/i.test(s) ? s + 'es' : /[^aeiou]y$/i.test(s) ? s.slice(0, -1) + 'ies' : s + 's';
  const xy = o => o && typeof o.x === 'number' && typeof o.y === 'number' ? { x: o.x, y: o.y } : null;
  const poiPos = id => xy(poiData(id));
  const npcPos = id => { const e = npcEnt(id); if (e) return { x: e.x, y: e.y }; const d = npcData(id); return xy(d) || (d && d.poi ? poiPos(d.poi) : null); };
  const bossPos = id => { const e = R.find(e => e.kind === 'boss' && !e.dead && (e.type === id || e.boss === id)); if (e) return { x: e.x, y: e.y }; const d = R.data.bosses && findIn(R.data.bosses, id); return xy(d) || (d && d.poi ? poiPos(d.poi) : null); };
  const giverPos = q => npcPos(q.giver) || poiPos(q.poi) || null;
  const nearMob = types => { const pl = R.player; if (!pl || !R.ents) return null; let b = null, bd = 1400;
    for (const e of R.ents) { if (e.dead || (e.kind !== 'mob' && e.kind !== 'boss') || e.team !== 1) continue; if (types && !types(e.type)) continue;
      const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < bd) { bd = d; b = e; } } return b ? { x: b.x, y: b.y } : null; };
  const mobMatch = tm => !tm || tm === '*' || tm === 'any' ? null : (ty => Array.isArray(tm) ? tm.includes(ty) : tm === ty);
  const targetPos = q => { const t = q.target || {};
    if (q.type === 'kill' && t.mob) { const m = nearMob(mobMatch(t.mob)); if (m) return m; }
    if (q.type === 'collect' && t.from) { const m = nearMob(mobMatch(t.from)); if (m) return m; }
    return (t.poi && poiPos(t.poi)) || (t.npc && npcPos(t.npc)) || (t.boss && bossPos(t.boss)) || xy(t) || poiPos(q.poi) || giverPos(q); };
  const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

  /* ---- availability ---- */
  const prevOk = q => !q.prev || (st(q.prev) && st(q.prev).st === 'turned');
  const canAccept = q => !!q && !st(q.id) && prevOk(q) && lvl() >= (q.lvl || 1) - 3;
  const available = npcId => Q().filter(q => canAccept(q) && (npcId == null || q.giver === npcId));
  const forNpc = npcId => ({ offer: available(npcId),
    turnin: Q().filter(q => q.giver === npcId && st(q.id) && st(q.id).st === 'done'),
    open: Q().filter(q => q.giver === npcId && st(q.id) && st(q.id).st === 'open') });
  const active = q => { const s = st(q.id); return !!s && (s.st === 'open' || s.st === 'done'); };
  const atPoi = pid => { const pl = R.player; if (!pl) return false; const p = poiPos(pid); if (p) return Math.hypot(pl.x - p.x, pl.y - p.y) <= 160;
    if (R.world && R.world.poiAt) { const r = R.world.poiAt(pl.x, pl.y, 160); return !!r && (r === pid || r.id === pid); } return false; };

  /* ---- the four moves ---- */
  const toast = (t, c) => { try { R.ui.toast(t, c); } catch (e) {} };
  const sfx = n => { try { R.sfx && R.sfx.play && R.sfx.play(n, .6); } catch (e) {} };
  let lastT = 0;
  const accept = id => { const q = get(id), s = QS(); if (!q || !s || !canAccept(q)) return false;
    lastT = Math.max(Date.now(), lastT + 1); s[id] = { st: 'open', n: 0, t: lastT };
    const f = flags(); if (q.main || !f.track || !get(f.track) || !active(get(f.track))) f.track = id;
    R.bus.emit('quest', id, 'open'); toast('New quest: ' + q.title, '#e3b661'); sfx('quest');
    if ((q.type === 'reach' || q.type === 'escort') && q.target && q.target.poi && atPoi(q.target.poi)) progress(id, 1);
    refresh(); R.save(); return true; };
  const countLine = (q, s) => { const N = q.n || 1, n = Math.min(N, s.n || 0), t = q.target || {};
    if (q.type === 'kill') return plural(mobName(t.mob || 'enemy'), N) + ' ' + n + '/' + N;
    if (q.type === 'collect') return plural(itemName(t.item || 'item'), N) + ' ' + n + '/' + N;
    return q.title + ' ' + n + '/' + N; };
  const progress = (id, k) => { const q = get(id), s = st(id); if (!q || !s || s.st !== 'open') return false;
    const N = q.n || 1; s.n = Math.min(N, (s.n || 0) + (k == null ? 1 : k));
    if (s.n >= N) { s.st = 'done'; R.bus.emit('quest', id, 'done'); toast(q.title + ' — return to ' + npcName(q.giver), '#7fd06a'); sfx('quest_done'); }
    else { R.bus.emit('quest', id, 'progress'); if (N > 1) toast(countLine(q, s), '#f3e7c4'); }
    refresh(); R.save(); return true; };
  const turnIn = id => { const q = get(id), s = st(id), p = P(); if (!q || !s || s.st !== 'done' || !p) return false;
    const rw = q.reward || {}, pl = R.player || {}, got = [];
    if (rw.xp) { if (pl.gainXp) pl.gainXp(rw.xp); else { p.xp = (p.xp || 0) + rw.xp; R.bus.emit('xp', rw.xp); } got.push('+' + rw.xp + ' XP'); }
    if (rw.gold) { if (pl.gainGold) pl.gainGold(rw.gold); else { p.gold = (p.gold || 0) + rw.gold; R.bus.emit('gold', rw.gold); } got.push('+' + rw.gold + ' gold'); }
    if (rw.gems) { if (pl.gainGems) pl.gainGems(rw.gems); else p.gems = (p.gems || 0) + rw.gems; got.push('+' + rw.gems + ' dragonglass'); }
    if (rw.item) { const rar = rw.item.rar == null ? 1 : rw.item.rar, L = q.lvl || p.lvl || 1; let it = null;
      try { it = R.items && R.items.roll ? R.items.roll(L, rar) : null; } catch (e) { it = null; }
      if (!it) it = { id: 'q_' + id + '_' + Date.now().toString(36), kind: 'mat', name: RAR[rar] + ' keepsake', rar, lvl: L, stats: {}, icon: 'scroll' };
      (p.inv || (p.inv = [])).push(it); got.push(it.name); }
    const hero = rw.hero || rw.comp;   // a champion unlocked as a hero for the account (A19 may still write `comp`)
    if (hero) { let fresh = false;
      if (R.heroes && R.heroes.unlock) { try { fresh = R.heroes.unlock(hero, 'quest') !== false; } catch (e) { fresh = false; } }
      else { const a = ACC(); if (a) { a.champs = a.champs || {}; if (!a.champs[hero] || !a.champs[hero].unlocked) { a.champs[hero] = Object.assign(a.champs[hero] || {}, { unlocked: 1, runs: (a.champs[hero] || {}).runs || 0 }); fresh = true; } }
        else { p.champs = p.champs || {}; if (!p.champs[hero]) { p.champs[hero] = { lvl: p.lvl || 1 }; fresh = true; } } }
      if (fresh) toast(champName(hero) + ' will ride for your house', '#ffd0a6'); }
    s.st = 'turned'; R.bus.emit('quest', id, 'turned'); sfx('quest_turn');
    toast('Quest complete' + (got.length ? '  ' + got.join('  ') : ''), '#e3b661');
    const f = flags(); const next = Q().filter(n => n.prev === id);
    // the story flows: the next main quest is tracked; when the same person gives it, it is handed over at once (no second visit)
    if (q.main) { const nx = next.find(n => n.main && canAccept(n)) || Q().find(n => n.main && canAccept(n));
      if (nx) { f.track = nx.id; if (nx.giver === q.giver) accept(nx.id); else toast('Next: ' + nx.title + ' — ' + npcName(nx.giver), '#f3e7c4'); } else if (f.track === id) delete f.track; }
    else if (f.track === id) { const nx = next.find(canAccept); if (nx) f.track = nx.id; else delete f.track; }
    refresh(); R.save(); return true; };
  const track = id => { if (!get(id)) return false; flags().track = id; refresh(); R.save(); return true; };

  /* ---- what the tracker follows ---- */
  const tracked = () => { if (!P()) return null; const f = flags();
    if (f.track) { const q = get(f.track); if (q && (active(q) || canAccept(q))) return q; }
    const act = Q().filter(active); const main = act.find(q => q.main); if (main) return main;
    if (act.length) return act.slice().sort((a, b) => ((st(b.id) || {}).t || 0) - ((st(a.id) || {}).t || 0))[0];
    return Q().find(q => q.main && canAccept(q)) || null; };
  const progLine = (q, s) => { const N = q.n || 1, n = Math.min(N, s.n || 0), t = q.target || {};
    switch (q.type) {
      case 'kill': return plural(mobName(t.mob || 'enemy'), N) + ' ' + n + '/' + N;
      case 'collect': return plural(itemName(t.item || 'item'), N) + ' ' + n + '/' + N;
      case 'reach': return 'Reach ' + poiName(t.poi || q.poi);
      case 'boss': return 'Defeat ' + bossName(t.boss) + (N > 1 ? ' ' + n + '/' + N : '');
      case 'talk': return 'Talk to ' + npcName(t.npc);
      case 'escort': return t.npc ? 'Escort ' + npcName(t.npc) + (t.poi ? ' to ' + poiName(t.poi) : '') : 'Escort the cart to ' + poiName(t.poi);
      default: return (q.text && q.text.progress) || (n + '/' + N); } };
  const line = q => { const s = st(q.id); if (!s) return 'Speak with ' + npcName(q.giver); if (s.st === 'done') return 'Return to ' + npcName(q.giver); if (s.st === 'turned') return 'Complete'; return progLine(q, s); };
  const dirTarget = q => { const s = st(q.id); if (!s || s.st === 'done') return giverPos(q); const o = objective(q); return o ? { x: o.x, y: o.y } : targetPos(q); };

  /* ---- markers for the map / minimap / renderer ---- */
  // one marker per quest target, but one per npc for give / turnin (a turn-in outranks an offer at the same man); `ids` lists every quest behind it
  /* markers() → every quest marker, for the HUD arrow, the minimap and the world map: {x, y, kind, id, title, r?, main, tracked, ids, npc?}
     kind: 'offer' (a giver with a quest to give: "!"), 'turnin' (a giver waiting for a finished quest: "?"), 'objective' (where an open quest's
     target is: the nearest living target mob, the destination POI, the NPC to talk to, the boss) or 'area' (no live target in sight: the
     quest's place, with a radius r in world units). One marker per NPC for offers / turn-ins (a turn-in outranks an offer); ids lists all. */
  const areaR = () => 260 * ((R.WS || 1) > 1 ? 2 : 1);
  const objective = q => { const t = q.target || {}; let p = null;
    if ((q.type === 'kill' && t.mob) || (q.type === 'collect' && t.from)) { p = nearMob(mobMatch(q.type === 'kill' ? t.mob : t.from)); if (p) return { x: p.x, y: p.y, kind: 'objective' };
      const a = poiPos(q.poi) || giverPos(q); return a ? { x: a.x, y: a.y, kind: 'area', r: areaR() } : null; }
    p = (t.poi && poiPos(t.poi)) || (t.npc && npcPos(t.npc)) || (t.boss && bossPos(t.boss)) || xy(t); if (p) return { x: p.x, y: p.y, kind: 'objective' };
    const a = poiPos(q.poi); return a ? { x: a.x, y: a.y, kind: 'area', r: areaR() } : null; };
  const markers = () => { const out = [], at = {}; if (!P()) return out; const tr = flags().track;
    const npcMark = (q, kind) => { const p = giverPos(q); if (!p) return; const k = q.giver; let m = at[k];
      if (!m) { m = at[k] = { x: p.x, y: p.y, kind, id: q.id, title: q.title, npc: q.giver, main: !!q.main, tracked: q.id === tr, ids: [] }; out.push(m); }
      else if (kind === 'turnin' && m.kind === 'offer') { m.kind = 'turnin'; m.id = q.id; m.title = q.title; }
      m.ids.push(q.id); if (q.main) m.main = true; if (q.id === tr) m.tracked = true; };
    for (const q of Q()) { const s = st(q.id);
      if (!s) { if (canAccept(q)) npcMark(q, 'offer'); }
      else if (s.st === 'done') npcMark(q, 'turnin');
      else if (s.st === 'open') { const o = objective(q); if (o) out.push(Object.assign(o, { id: q.id, title: q.title, main: !!q.main, tracked: q.id === tr, ids: [q.id] })); } }
    return out; };
  // the direction for the tracker and any arrow: the giver before / after, the objective while open
  const dirOf = id => { const q = get(id) || tracked(); if (!q) return null; const s = st(q.id); if (!s || s.st === 'done') return giverPos(q); const o = objective(q); return o ? { x: o.x, y: o.y } : null; };
  const markNpcs = () => { if (!P()) return; const give = new Set(), turn = new Set();
    for (const q of Q()) { const s = st(q.id); if (!s) { if (canAccept(q)) give.add(q.giver); } else if (s.st === 'done') turn.add(q.giver); }
    for (const e of R.ents) { if (e.kind !== 'npc') continue; const id = npcKey(e); const m = turn.has(id) ? '?' : give.has(id) ? '!' : null;
      if (m) { e.mark = m; e._qmark = 1; } else if (e._qmark) { delete e.mark; delete e._qmark; } } };

  /* ---- tracker card (in the HUD's #qtrack slot, or its own holder in #ui) ---- */
  let card, own, arrow, tTitle, tLine, lastTxt = '', lastDeg = null;
  const build = () => { if (card) return; card = document.createElement('div'); card.className = 'qt-card'; card.id = 'qtcard';
    card.innerHTML = '<div class="qt-arrow"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2 20 20 12 15.5 4 20Z" fill="currentColor"/></svg></div><div class="qt-txt"><b class="qt-title"></b><span class="qt-line"></span></div>';
    arrow = card.querySelector('.qt-arrow'); tTitle = card.querySelector('.qt-title'); tLine = card.querySelector('.qt-line');
    card.addEventListener('click', () => { if (R.ui.cur !== 'quests') R.ui.open('quests'); }); };
  const mount = () => { const ui = document.getElementById('ui'); if (!ui) return false; build();
    const slot = document.getElementById('qtrack');
    if (slot) { if (card.parentNode !== slot) slot.appendChild(card); if (own) { own.remove(); own = null; } }
    else { if (!own) { own = document.createElement('div'); own.id = 'qtrack-own'; ui.appendChild(own); } if (card.parentNode !== own) own.appendChild(card); }
    return true; };
  // the on-screen direction: two points close to the hero are projected with R.w2s (the 3D renderer overrides it), so the arrow follows
  // the camera's yaw and pitch without knowing them; with the plain 2D camera it is the world angle
  const aim = q => { const t = dirTarget(q); const from = R.player || R.cam; if (!t || !from) { arrow.style.opacity = '0'; return; }
    const dx = t.x - from.x, dy = t.y - from.y, d = Math.hypot(dx, dy); if (d < 1) { arrow.style.opacity = '.35'; return; }
    let deg; try { const a = R.w2s(from.x, from.y), b = R.w2s(from.x + dx / d * 40, from.y + dy / d * 40); deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90; } catch (e) { deg = Math.atan2(dy, dx) * 180 / Math.PI + 90; }
    deg = Math.round(((deg % 360) + 360) % 360); arrow.style.opacity = d < 60 ? '.45' : '1';
    if (deg !== lastDeg) { lastDeg = deg; arrow.style.transform = 'rotate(' + deg + 'deg)'; } };
  const refresh = () => { if (!mount()) return; const q = tracked();
    if (!q) { card.classList.remove('on'); lastTxt = ''; return; }
    card.classList.add('on'); card.classList.toggle('hid', !!(R.ui.cur && R.paused));   // a pausing screen covers the game: no card over it
    const ln = line(q), txt = q.title + '\n' + ln;
    if (txt !== lastTxt) { lastTxt = txt; tTitle.textContent = q.title; tLine.textContent = ln; const s = st(q.id); card.dataset.st = s ? s.st : 'new'; card.dataset.id = q.id; }
    aim(q); if (R.ui.cur === 'quests' && logEl) renderLog(logEl); };
  let aimAcc = 0;
  const sys = { order: 95, update(dt) { aimAcc += dt; if (aimAcc < .1) return; aimAcc = 0; if (card && card.classList.contains('on')) { const q = tracked(); if (q) aim(q); else refresh(); } } };
  if (R.addSys) R.addSys('quests', sys); else { sys.name = 'quests'; R.sys.quests = sys; R.sysList = Object.values(R.sys).sort((a, b) => (a.order || 0) - (b.order || 0)); }

  /* ---- the quest log screen ---- */
  let logEl = null, tab = 'main';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const I = { xp: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.4 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="currentColor"/></svg>',
    gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#2b1d08" stroke-width="1.5"/></svg>',
    gems: '<svg viewBox="0 0 24 24"><path d="M12 2l9 8-9 12L3 10z" fill="currentColor"/><path d="M3 10h18M12 2l-4 8 4 12 4-12z" fill="none" stroke="#1a1030" stroke-width="1.2"/></svg>',
    item: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor"/><path d="M8 12h8M12 8v8" stroke="#0b1220" stroke-width="2"/></svg>',
    comp: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor"/></svg>' };
  const rewardRow = rw => { rw = rw || {}; const c = [];
    if (rw.xp) c.push('<span class="rw xp">' + I.xp + esc(rw.xp) + ' XP</span>');
    if (rw.gold) c.push('<span class="rw gold">' + I.gold + esc(rw.gold) + '</span>');
    if (rw.gems) c.push('<span class="rw gems">' + I.gems + esc(rw.gems) + '</span>');
    if (rw.item) { const r = rw.item.rar == null ? 1 : rw.item.rar; c.push('<span class="rw r' + r + '">' + I.item + esc(RAR[r] || 'Item') + ' item</span>'); }
    if (rw.hero || rw.comp) c.push('<span class="rw comp">' + I.comp + esc(champName(rw.hero || rw.comp)) + '</span>');
    return c.length ? '<div class="ql-rw">' + c.join('') + '</div>' : ''; };
  const qCard = (q, folded) => { const s = st(q.id), N = q.n || 1, n = s ? Math.min(N, s.n || 0) : 0, tr = flags().track === q.id, T = q.text || {};
    const stName = !s ? 'new' : s.st; const text = stName === 'new' ? T.offer : stName === 'open' ? (T.progress || T.offer) : (T.done || T.progress || '');
    let bar = ''; if (stName === 'open') bar = '<div class="ql-bar"><i style="width:' + Math.round(n / N * 100) + '%"></i><span>' + esc(progLine(q, s)) + '</span></div>';
      else if (stName === 'done') bar = '<div class="ql-bar done"><i style="width:100%"></i><span>Return to ' + esc(npcName(q.giver)) + '</span></div>';
      else if (stName === 'new') bar = '<div class="ql-bar new"><span>Speak with ' + esc(npcName(q.giver)) + '</span></div>';
    const act = folded ? '' : '<div class="ql-act"><button class="ql-track' + (tr ? ' on' : '') + '" data-track="' + esc(q.id) + '">' + (tr ? 'TRACKED' : 'TRACK') + '</button></div>';
    return '<div class="ql-q ' + (q.main ? 'main' : 'side') + ' st-' + stName + (tr ? ' tracked' : '') + '" data-id="' + esc(q.id) + '"><div class="ql-row"><b class="ql-title">' + esc(q.title) + '</b><span class="ql-lvl">Lv ' + esc(q.lvl || 1) + (q.region ? ' · ' + esc(cap(q.region)) : '') + '</span></div>' +
      (text && !folded ? '<div class="ql-text">' + esc(text) + '</div>' : '') + (folded ? '' : bar) + (folded ? '' : rewardRow(q.reward)) + act + '</div>'; };
  const renderLog = el => { if (!el) return; const all = Q(), isMain = tab === 'main';
    const mine = all.filter(q => !!q.main === isMain);
    const live = mine.filter(active).sort((a, b) => ((st(a.id) || {}).st === 'done' ? -1 : 0) - ((st(b.id) || {}).st === 'done' ? -1 : 0) || ((st(b.id) || {}).t || 0) - ((st(a.id) || {}).t || 0));
    const fresh = isMain ? mine.filter(canAccept) : [];
    const done = mine.filter(q => st(q.id) && st(q.id).st === 'turned');
    const nMain = all.filter(q => q.main && (active(q) || canAccept(q))).length, nSide = all.filter(q => !q.main && active(q)).length;
    el.innerHTML = '<div class="ql"><div class="ql-head"><h1>Quests</h1><div class="ql-tabs"><button class="ql-tab' + (isMain ? ' on' : '') + '" data-tab="main">Main<i>' + nMain + '</i></button><button class="ql-tab' + (isMain ? '' : ' on') + '" data-tab="side">Side<i>' + nSide + '</i></button></div></div>' +
      '<div class="ql-list">' + (live.length || fresh.length ? live.map(q => qCard(q)).join('') + fresh.map(q => qCard(q)).join('') : '<div class="ql-empty">' + (isMain ? 'No main quest open yet.' : 'No side quests taken. Look for an ! above the people you meet.') + '</div>') + '</div>' +
      (done.length ? '<details class="ql-done"><summary>Completed<i>' + done.length + '</i></summary>' + done.map(q => qCard(q, true)).join('') + '</details>' : '') +
      '<button class="pri ql-close">CLOSE</button></div>';
    el.querySelectorAll('.ql-tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderLog(el); }));
    el.querySelectorAll('.ql-track').forEach(b => b.addEventListener('click', () => { track(b.dataset.track); renderLog(el); }));
    const c = el.querySelector('.ql-close'); if (c) c.addEventListener('click', () => R.ui.close()); };
  R.screens.quests = { open(arg, el) { logEl = el || document.getElementById('screen'); if (arg === 'main' || arg === 'side') tab = arg; else { const q = tracked(); tab = q && !q.main ? 'side' : 'main'; } renderLog(logEl); }, close() { logEl = null; } };

  /* ---- the world speaks: events ---- */
  const bossSeen = {};
  const bossDone = (bid, q) => { const key = q.id + '|' + bid; if (bossSeen[key] != null && R.t - bossSeen[key] < 2) return; bossSeen[key] = R.t; progress(q.id, 1); };
  R.bus.on('kill', (mob, by) => { if (!mob || !P() || (by && by.team === 1)) return; const type = mob.type;
    for (const q of Q()) { const s = st(q.id); if (!s || s.st !== 'open') continue; const t = q.target || {};
      if (q.type === 'kill') { const tm = t.mob; if (!tm || tm === '*' || tm === type || (Array.isArray(tm) && tm.includes(type)) || (t.boss && mob.kind === 'boss' && t.boss === (mob.boss || type))) progress(q.id, 1); }
      else if (q.type === 'collect' && t.from && (t.from === '*' || t.from === 'any' || t.from === type || (Array.isArray(t.from) && t.from.includes(type)))) progress(q.id, 1);
      else if (q.type === 'boss' && mob.kind === 'boss' && t.boss === (mob.boss || mob.bossId || type)) bossDone(t.boss, q); } });
  R.bus.on('boss', (id, phase) => { if (phase !== 'dead' || !P()) return; for (const q of Q()) { const s = st(q.id); if (s && s.st === 'open' && q.type === 'boss' && q.target && q.target.boss === id) bossDone(id, q); } });
  R.bus.on('loot', item => { if (!item || !P()) return; const keys = [item.base, item.key, item.type, item.kind === 'mat' ? item.id : null, item.name].filter(x => x != null);
    for (const q of Q()) { const s = st(q.id); if (s && s.st === 'open' && q.type === 'collect' && q.target && keys.includes(q.target.item)) progress(q.id, item.n || item.qty || 1); } });
  R.bus.on('poi', pid => { if (!P()) return; const id = pid && pid.id ? pid.id : pid; for (const q of Q()) { const s = st(q.id); if (s && s.st === 'open' && (q.type === 'reach' || q.type === 'escort') && q.target && q.target.poi === id) progress(q.id, 1); } });
  R.bus.on('dialog', npcId => { if (!P()) return; const id = npcId && npcId.kind === 'npc' ? npcKey(npcId) : (npcId && npcId.id && !npcId.kind ? npcId.id : npcId);
    for (const q of Q()) { const s = st(q.id); if (s && s.st === 'open' && q.type === 'talk' && q.target && q.target.npc === id) progress(q.id, 1); }
    if (!R.screens.dialog) { const f = forNpc(id); f.turnin.forEach(q => turnIn(q.id)); f.offer.forEach(q => accept(q.id)); } });   // no dialog screen: the npc hands quests over by himself
  R.bus.on('levelup', () => refresh());
  R.bus.on('tick1s', () => { markNpcs(); refresh(); });
  R.bus.on('screen', n => { if (n !== 'quests') logEl = null; refresh(); });

  R.bus.on('house', () => { qCache = null; refresh(); }); R.bus.on('newhero', () => { qCache = null; refresh(); });
  const offersFor = npcId => available(npcId), turnInsFor = npcId => forNpc(npcId).turnin;
  R.quests = { get, all: Q, state: st, available, canAccept, forNpc, offersFor, turnInsFor, dirOf, objective, genSide, resolve: normalize, reset: () => { qCache = null; }, accept, progress, turnIn, track, tracked, markers, line, refresh, giverPos, targetPos, npcName, poiName, mobName, markNpcs };
})();
