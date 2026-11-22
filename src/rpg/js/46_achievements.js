/* HOLDOR RPG — achievements + titles (A24).
   R.data.achievements: 39 entries {id, name, d, icon, cond:{ev, key?, n}, reward:{gems?, title?}}.
   Account-level (Addendum 2, permadeath): unlocked ids in R.state.acc.ach, earned titles in R.state.acc.titles, the worn one in
   R.state.acc.title; lifetime counters in R.state.acc.achN; world progress read from R.state.acc.world (found, quests, bosses, killed);
   heroes fallen from R.state.acc.hall. Per-run counters (kills / played of this hero) live in R.state.p.achRun. When the core still
   saves the v1 shape (no acc), everything falls back to R.state.p so the module never throws.
   Listens to the bus: kill, boss, poi, enter, levelup, quest, loot, gold, hit, death, potion, event, dungeon, tick1s. Unlocks once,
   pays gems to the current hero (R.state.p.gems, mirrored to R.player.gems), slides a card in from the top, owns the screen
   R.screens.ach (title picker + grid). API: R.ach.progress(id) → {id, cur, n, done, pct}; titles(); setTitle(t); check(); open().
   Emits 'ach'(id, def) on unlock and 'title'(t) when the title changes. */
(function () {
  const R = window.R; if (!R) return;
  R.data = R.data || {}; R.screens = R.screens || {};
  const norm = s => String(s == null ? '' : (typeof s === 'object' ? (s.id || s.key || s.type || s.name || '') : s)).toLowerCase().replace(/[^a-z0-9]/g, '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* ---- the seven great seats, the Wall, the lands beyond (matched on normalised POI / region ids and names) ---- */
  const SEATS = ['winterfell', 'casterlyrock', 'stormsend', 'dragonstone', 'pyke', 'highgarden', 'sunspear'];
  const WALL = /castleblack|^thewall$|^wall$|eastwatch|shadowtower|nightfort|^thegift$|^gift$|newgift|brandonsgift|molestown|queenscrown/;
  const BEYOND = /beyond|haunted|frostfang|alwayswinter|landsofalways|hardhome|craster|fistofthefirstmen|whitetree|skirling|thenn|frozenshore|landofalwayswinter/;
  const DONE = /^(done|turned|complete|completed|finished|claimed|turnedin|won)$/;
  const DEAD = /dead|died|kill|killed|defeat|defeated|down|slain|done|won|end|victory/;
  const WIN = /done|won|win|stop|stopped|clear|cleared|complete|success|defeat|defeated|repel|repelled|held|victory|survived/;
  const ENDLIKE = /^(end|ended|over|fail|failed|lost|expire|expired|close|closed|done|won|win|stop|stopped|clear|cleared|complete|completed|success|defeat|defeated|repel|repelled|held|victory|survived|timeout)$/;

  /* ---- definitions ---- */
  const A = [
    // combat (lifetime unless 'run')
    { id: 'kill_1', name: 'First Blood', d: 'Slay your first foe.', icon: 'sword', cond: { ev: 'kill', n: 1 }, reward: { gems: 5 } },
    { id: 'kill_100', name: 'A Hundred Fallen', d: 'Slay 100 foes.', icon: 'sword', cond: { ev: 'kill', n: 100 }, reward: { gems: 10, title: 'Sworn Sword' } },
    { id: 'kill_1000', name: 'Wight-breaker', d: 'Slay 1,000 foes.', icon: 'skull', cond: { ev: 'kill', n: 1000 }, reward: { gems: 25, title: 'Wight-breaker' } },
    { id: 'kill_10000', name: 'Ten Thousand Dead', d: 'Slay 10,000 foes.', icon: 'skull', cond: { ev: 'kill', n: 10000 }, reward: { gems: 100, title: 'Warden of the Dead' } },
    { id: 'kill_run_100', name: 'A Hundred in One Life', d: 'Slay 100 foes with a single hero.', icon: 'sword', cond: { ev: 'kill', key: 'run', n: 100 }, reward: { gems: 15, title: 'Hundred-blade' } },
    { id: 'boss_1', name: 'Gate-breaker', d: 'Bring down your first boss.', icon: 'helm', cond: { ev: 'boss', n: 1 }, reward: { gems: 15, title: 'Gate-breaker' } },
    { id: 'boss_all', name: 'Nine Gates Open', d: 'Defeat the boss of every region.', icon: 'crown', cond: { ev: 'boss', key: 'all', n: 9 }, reward: { gems: 100, title: 'Lord of Nine Gates' } },
    { id: 'crit_100', name: 'Keen Edge', d: 'Land 100 critical hits.', icon: 'target', cond: { ev: 'hit', key: 'crit', n: 100 }, reward: { gems: 10 } },
    // the road (account)
    { id: 'poi_1', name: 'First Steps', d: 'Find your first place of note.', icon: 'boots', cond: { ev: 'poi', n: 1 }, reward: { gems: 5 } },
    { id: 'poi_20', name: 'Wayfarer', d: 'Find 20 places of note.', icon: 'map', cond: { ev: 'poi', n: 20 }, reward: { gems: 20, title: 'Wayfarer' } },
    { id: 'poi_50', name: 'Mapmaker', d: 'Find 50 places of note.', icon: 'map', cond: { ev: 'poi', n: 50 }, reward: { gems: 40, title: 'Mapmaker of the Realm' } },
    { id: 'seats_7', name: 'Guest of Seven Halls', d: 'Stand in all seven great seats.', icon: 'castle', cond: { ev: 'poi', key: 'seat', n: 7 }, reward: { gems: 50, title: 'Guest of Seven Halls' } },
    { id: 'regions_all', name: 'Nine Lands', d: 'Set foot in every region.', icon: 'flag', cond: { ev: 'enter', key: 'all', n: 9 }, reward: { gems: 30, title: 'Walker of Nine Lands' } },
    { id: 'wall', name: 'Ranger of the Gift', d: 'Reach the Wall.', icon: 'wall', cond: { ev: 'enter', key: 'wall', n: 1 }, reward: { gems: 20, title: 'Ranger of the Gift' } },
    { id: 'beyond', name: 'Past the Last Watch', d: 'Set foot beyond the Wall.', icon: 'snow', cond: { ev: 'enter', key: 'beyond', n: 1 }, reward: { gems: 40, title: 'Far Ranger' } },
    // heroes (account, permadeath)
    { id: 'lvl_10', name: 'Squire No More', d: 'A hero reaches level 10.', icon: 'star', cond: { ev: 'levelup', n: 10 }, reward: { gems: 10, title: 'Hedge Knight' } },
    { id: 'lvl_20', name: 'Proven Steel', d: 'A hero reaches level 20.', icon: 'star', cond: { ev: 'levelup', n: 20 }, reward: { gems: 25, title: 'Proven Steel' } },
    { id: 'lvl_40', name: 'Veteran of Winters', d: 'A hero reaches level 40.', icon: 'star', cond: { ev: 'levelup', n: 40 }, reward: { gems: 50, title: 'Veteran of Winters' } },
    { id: 'lvl_60', name: 'Legend of the Realm', d: 'A hero reaches level 60.', icon: 'crown', cond: { ev: 'levelup', n: 60 }, reward: { gems: 100, title: 'Legend of the Realm' } },
    { id: 'heroes_3', name: 'Three Banners', d: 'Three different heroes past level 10.', icon: 'people', cond: { ev: 'levelup', key: 'heroes', n: 3 }, reward: { gems: 30, title: 'Lord of Three Banners' } },
    { id: 'fall_1', name: 'First to Fall', d: 'Your first hero falls. The Hall remembers.', icon: 'skull', cond: { ev: 'death', n: 1 }, reward: { gems: 10, title: 'Keeper of the Fallen' } },
    { id: 'fall_5', name: 'Five Heroes Fallen', d: 'Five heroes lie in the Hall.', icon: 'skull', cond: { ev: 'death', n: 5 }, reward: { gems: 20, title: 'Warden of the Hall' } },
    { id: 'death_10', name: 'Still Standing', d: 'Ten heroes fallen, and you still fight.', icon: 'shield', cond: { ev: 'death', n: 10 }, reward: { gems: 30, title: 'Ever-rising' } },
    { id: 'boss_death', name: 'At the Gate', d: 'A hero falls to a boss.', icon: 'helm', cond: { ev: 'death', key: 'boss', n: 1 }, reward: { gems: 10, title: 'Gate-tested' } },
    { id: 'outlive', name: 'Outlived the First', d: 'A later hero rises past your first hero’s level.', icon: 'star', cond: { ev: 'death', key: 'outlive', n: 1 }, reward: { gems: 15, title: 'Second Dawn' } },
    { id: 'run_1h', name: 'A Long Life', d: 'One hero lives for an hour.', icon: 'hourglass', cond: { ev: 'tick1s', key: 'run', n: 3600 }, reward: { gems: 15, title: 'Long-lived' } },
    { id: 'time_10h', name: 'Ten Hours of Watch', d: 'Ten hours played, all heroes counted.', icon: 'hourglass', cond: { ev: 'tick1s', key: 'played', n: 36000 }, reward: { gems: 50, title: 'Sentinel of Long Hours' } },
    // loot and coin
    { id: 'leg_1', name: 'Starfall Steel', d: 'Find a Legendary item.', icon: 'gem', cond: { ev: 'loot', key: 'legendary', n: 1 }, reward: { gems: 25, title: 'Keeper of Starfall Steel' } },
    { id: 'loot_100', name: 'Heavy Pack', d: 'Pick up 100 items.', icon: 'shield', cond: { ev: 'loot', n: 100 }, reward: { gems: 10 } },
    { id: 'gold_10k', name: 'Golden Hand', d: 'Earn 10,000 gold.', icon: 'coin', cond: { ev: 'gold', n: 10000 }, reward: { gems: 15, title: 'Coin-counter' } },
    { id: 'gems_50', name: 'Dragonglass Spent', d: 'Spend 50 gems.', icon: 'gem', cond: { ev: 'gems', key: 'spent', n: 50 }, reward: { gems: 10 } },
    // quests (account)
    { id: 'quest_1', name: 'Errand Done', d: 'Finish your first quest.', icon: 'scroll', cond: { ev: 'quest', n: 1 }, reward: { gems: 5 } },
    { id: 'quest_10', name: 'Oath-bound', d: 'Finish 10 quests.', icon: 'scroll', cond: { ev: 'quest', n: 10 }, reward: { gems: 20, title: 'Keeper of Oaths' } },
    { id: 'quest_main', name: 'The Long Road Ends', d: 'Finish the main story.', icon: 'book', cond: { ev: 'quest', key: 'main', n: 1 }, reward: { gems: 100, title: 'Shield of the Realm' } },
    // dungeons and events
    { id: 'dung_1', name: 'Into the Dark', d: 'Clear a dungeon.', icon: 'door', cond: { ev: 'dungeon', n: 1 }, reward: { gems: 20, title: 'Delver' } },
    { id: 'dung_all', name: 'No Door Unopened', d: 'Clear every dungeon.', icon: 'door', cond: { ev: 'dungeon', key: 'all', n: 3 }, reward: { gems: 60, title: 'Warden of the Deep' } },
    { id: 'horde_1', name: 'Hold the Door', d: 'Stop a wight horde.', icon: 'horn', cond: { ev: 'event', key: 'horde', n: 1 }, reward: { gems: 20, title: 'Door-holder' } },
    { id: 'event_5', name: 'Omens Read', d: 'Witness 5 world events.', icon: 'eye', cond: { ev: 'event', n: 5 }, reward: { gems: 15 } },
    { id: 'potion_100', name: 'Maester’s Favourite', d: 'Drink 100 potions.', icon: 'potion', cond: { ev: 'potion', n: 100 }, reward: { gems: 15, title: 'Friend of the Apothecary' } },
  ];
  R.data.achievements = A;
  const byId = {}; A.forEach(a => { byId[a.id] = a; });

  /* ---- icons (code-drawn, 24×24, currentColor) ---- */
  const IC = {
    sword: '<path d="M19 5L9 15"/><path d="M6.5 13.5l4 4"/><path d="M8.5 15.5L4 20"/><circle cx="4" cy="20" r="1"/>',
    skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4 2.5 5v3h9v-3c1.3-1 2.5-2.5 2.5-5a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="11" r="1.2"/><circle cx="14.5" cy="11" r="1.2"/><path d="M10 18v2M14 18v2"/>',
    crown: '<path d="M3 18h18M4 17l-1-9 5 4 4-7 4 7 5-4-1 9"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    castle: '<path d="M4 21V9h3V6h2v3h6V6h2v3h3v12"/><path d="M10 21v-5h4v5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    scroll: '<path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6"/><path d="M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2M9 9h7M9 13h7"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M6 3l6 18M18 3l-6 18"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2"/>',
    hourglass: '<path d="M6 3h12M6 21h12M8 3v3l4 5 4-5V3M8 21v-3l4-5 4 5v3"/>',
    potion: '<path d="M10 3h4M11 3v5l-5 7a4 4 0 0 0 3.5 6h5A4 4 0 0 0 18 15l-5-7V3"/><path d="M7.5 16h9"/>',
    door: '<path d="M5 21V5a7 7 0 0 1 14 0v16"/><path d="M3 21h18M14 13h1"/>',
    helm: '<path d="M5 20v-8a7 7 0 0 1 14 0v8"/><path d="M5 14h14M12 6v14"/>',
    horn: '<path d="M4 8c6 0 11 3 15 9l2-1c-3-7-9-11-17-11z"/><path d="M4 5v3"/>',
    boots: '<path d="M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM16 11c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 19c0-2.5 2-4 4-4s3 1.5 3 4"/>',
    wall: '<path d="M3 20V9h18v11M3 14h18M8 9v5M14 9v5M11 14v6M5 20v-6M17 14v6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    book: '<path d="M4 4h7v16H4zM13 4h7v16h-7z"/><path d="M7 8h1M16 8h1"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (IC[k] || IC.star) + '</svg>';

  /* ---- where things live: the account (v2) or, with the v1 core, the hero ---- */
  const P = () => (R.state && R.state.p) || null;                                                    // the current hero
  const ACC = () => { if (!R.state) return null; if (R.state.acc && typeof R.state.acc === 'object') return R.state.acc; try { const a = typeof R.acc === 'function' ? R.acc() : null; if (a && typeof a === 'object') return a; } catch (e) {} return null; };
  const STORE = () => { const s = ACC() || P(); if (!s) return null; if (!Array.isArray(s.ach)) s.ach = []; if (!Array.isArray(s.titles)) s.titles = []; return s; };   // ach, titles, title, achN
  const WORLD = () => { const a = ACC(); return (a && a.world) || P() || {}; };                                                                                   // found, quests, bosses, killed, flags
  const HALL = () => { const a = ACC(); return (a && Array.isArray(a.hall)) ? a.hall : []; };
  const BEST = () => { const a = ACC(); return (a && a.best) || {}; };
  const N = () => { const s = STORE(); if (!s) return null;
    return s.achN || (s.achN = { kills: 0, bossN: 0, bossK: {}, poi: {}, reg: {}, wall: 0, beyond: 0, lvl: 0, heroLvl: {}, q: {}, loot: 0, leg: 0, gold: 0, spent: 0, gemBase: null, baseKey: null, deaths: 0, bossDeath: 0, potions: 0, potBase: null, played: 0, crits: 0, ev: 0, horde: 0, dung: {}, lastEv: '', lastEvT: -1e9, lastBoss: '', lastBossT: -1e9 }); };
  const RUN = () => { const p = P(); if (!p) return { kills: 0, played: 0 }; return p.achRun || (p.achRun = { kills: 0, played: 0 }); };
  const sumVals = o => { let s = 0; if (o) for (const k in o) s += +o[k] || 0; return s; };
  const keys = o => (o ? Object.keys(o) : []);
  const count = (o, l) => { const S = new Set(keys(o).map(norm)); (Array.isArray(l) ? l : []).forEach(x => S.add(norm(x))); S.delete(''); return S; };
  const asList = X => (Array.isArray(X) ? X : X && typeof X === 'object' ? Object.values(X) : []);
  const seatSet = () => { const S = new Set(SEATS); for (const h of asList(R.data.houses)) if (h && typeof h.seat === 'string') S.add(norm(h.seat)); return S; };
  const seatPois = () => { const W = R.data.world, S = seatSet(), out = new Set(); for (const p of asList(W && W.pois)) if (p && (p.seat || p.house || S.has(norm(p.id)) || S.has(norm(p.name)))) { out.add(norm(p.id)); out.add(norm(p.name)); } S.forEach(x => out.add(x)); out.delete(''); return out; };
  const foundSet = () => count(N().poi, WORLD().found);
  const doneSet = () => { const Q = WORLD().quests, S = count(N().q, []); if (Q) for (const id in Q) { const q = Q[id]; if (q && DONE.test(norm(q.st || q.state || (q === true ? 'done' : '')))) S.add(norm(id)); } S.delete(''); return S; };
  const mainIds = () => { const S = R.data.story, Q = R.data.quests; let ids = [];
    if (S) { const m = S.main || S.chain || S.mainChain || (Array.isArray(S) ? S : null); if (Array.isArray(m)) ids = m.map(x => (x && typeof x === 'object' ? (x.id || x.quest || x.q) : x)); }
    if (!ids.length && Q) ids = asList(Q).filter(q => q && (q.main || q.chain === 'main' || q.type === 'main' || q.kind === 'main')).map(q => q.id);
    return ids.filter(Boolean); };
  const mainDone = () => { const f = WORLD().flags || {}; if (f.mainDone || f.main_done || f.storyDone || f.story_done) return true; const ids = mainIds(); if (!ids.length) return false; const D = doneSet(); return ids.every(id => D.has(norm(id))); };
  const legIdx = () => { const I = R.data.items || {}; for (const c of [I.rar, I.RAR, I.rarities, I.rarity, I.rarNames, I.RAR_N, R.items && R.items.RAR, R.items && R.items.rar]) if (Array.isArray(c)) { const i = c.findIndex(x => /legend/i.test(typeof x === 'string' ? x : (x && (x.n || x.name || x[0])) || '')); if (i >= 0) return i; } return 3; };
  const isLeg = it => !!it && ((typeof it.rar === 'number' && it.rar >= legIdx()) || /legend/i.test(String(it.rarName || it.rarity || it.rarityName || '')));
  const bossIds = () => { const S = new Set(); for (const b of asList(R.data.bosses)) if (b) { S.add(norm(b.id)); S.add(norm(b.name)); S.add(norm(b.type)); } S.delete(''); return S; };
  const bossKiller = k => { if (!k) return false; if (typeof k === 'object') return k.kind === 'boss' || !!k.boss || bossIds().has(norm(k)); const s = norm(k); return /boss/.test(s) || bossIds().has(s); };
  const heroLevels = () => { const m = Object.assign({}, N().heroLvl), p = P(); for (const h of HALL()) if (h && h.id != null) m[h.id] = Math.max(m[h.id] | 0, h.lvl | 0); if (p && p.hero != null) m[p.hero] = Math.max(m[p.hero] | 0, p.lvl | 0); return m; };
  const maxLvl = () => { const p = P(); let m = Math.max(p ? p.lvl | 0 : 0, N().lvl | 0, BEST().lvl | 0); for (const h of HALL()) if (h) m = Math.max(m, h.lvl | 0); return m; };
  const need = a => { const c = a.cond, L = (X, f) => { const l = asList(X); const m = f ? l.filter(f) : l; return m.length || l.length; };
    if (c.ev === 'boss' && c.key === 'all') return L(R.data.bosses, b => b && (b.region || b.reg)) || c.n;
    if (c.ev === 'enter' && c.key === 'all') return L(R.data.world && R.data.world.regions) || c.n;
    if (c.ev === 'dungeon' && c.key === 'all') return L(R.data.dungeons) || c.n;
    if (c.ev === 'poi' && !c.key && c.n >= 50) { const n = L(R.data.world && R.data.world.pois); return n ? Math.min(c.n, n) : c.n; }
    return c.n; };
  const value = a => { const p = P(), n = N(); if (!p || !n) return 0; const c = a.cond, k = c.key, W = WORLD(), H = HALL();
    switch (c.ev) {
      case 'kill': return k === 'run' ? Math.max(RUN().kills | 0, BEST().kills | 0) : Math.max(n.kills, sumVals(W.killed));
      case 'boss': return k === 'all' ? count(n.bossK, keys(W.bosses)).size : Math.max(n.bossN, sumVals(W.bosses));
      case 'poi': { const F = foundSet(); if (k === 'seat') { const S = seatPois(); let m = 0; F.forEach(x => { if (S.has(x)) m++; }); return Math.min(m, 7); } return F.size; }
      case 'enter': return k === 'wall' ? (n.wall || n.beyond ? 1 : 0) : k === 'beyond' ? (n.beyond ? 1 : 0) : count(n.reg, []).size;
      case 'levelup': { if (k === 'heroes') { const m = heroLevels(); let c3 = 0; for (const id in m) if (m[id] > 10) c3++; return c3; } return maxLvl(); }
      case 'death': { if (k === 'boss') return n.bossDeath || H.some(h => h && bossKiller(h.killer)) ? 1 : 0;
        if (k === 'outlive') { if (!H.length || !H[0]) return 0; const l0 = H[0].lvl | 0; return (H.slice(1).some(h => h && (h.lvl | 0) > l0) || (p.lvl | 0) > l0) ? 1 : 0; }
        return Math.max(n.deaths, H.length); }
      case 'loot': return k === 'legendary' ? n.leg : n.loot;
      case 'gold': return n.gold;
      case 'gems': return n.spent;
      case 'quest': return k === 'main' ? (mainDone() ? 1 : 0) : doneSet().size;
      case 'dungeon': return count(n.dung, []).size;
      case 'event': return k === 'horde' ? n.horde : n.ev;
      case 'potion': return n.potions;
      case 'hit': return n.crits;
      case 'tick1s': { if (k === 'run') return Math.max(p.played | 0, RUN().played | 0); let s = (p.played | 0) + (RUN().played | 0) * 0; for (const h of H) if (h) s += h.played | 0; return Math.max(n.played | 0, s); }
    } return 0; };
  const has = id => { const s = STORE(); return !!s && s.ach.indexOf(id) >= 0; };
  const progress = id => { const a = byId[id]; if (!a) return null; const n = need(a); const cur = Math.min(n, value(a)); return { id, cur, n, done: has(id) || cur >= n, pct: n ? cur / n : 0 }; };

  /* ---- unlock, gems, toast ---- */
  const payGems = g => { const p = P(); if (!p || !(g > 0)) return; const pl = R.player, before = pl ? pl.gems : undefined; p.gems = (p.gems | 0) + g;
    if (pl && typeof before === 'number' && pl.gems === before) pl.gems = before + g; const n = N(); if (n) n.gemBase = p.gems | 0; R.bus.emit('gems', g); };
  const rewardTxt = a => { const r = a.reward || {}, t = []; if (r.gems) t.push('+' + r.gems + ' gems'); if (r.title) t.push('<b>' + esc(r.title) + '</b>'); return t.join(' · ') || '—'; };
  const q = []; let showing = false;
  const next = () => { const a = q.shift(); if (!a) { showing = false; return; } showing = true; const ui = document.getElementById('ui'); if (!ui) { showing = false; return; }
    const d = document.createElement('div'); d.className = 'ach-toast'; d.dataset.id = a.id;
    d.innerHTML = '<div class="ach-ti">' + icon(a.icon) + '</div><div class="ach-tb"><div class="ach-tk">Achievement</div><div class="ach-tn">' + esc(a.name) + '</div><div class="ach-tr">' + rewardTxt(a) + '</div></div>';
    ui.appendChild(d); let gone = false; const bye = () => { if (gone) return; gone = true; d.classList.add('out'); setTimeout(() => { d.remove(); next(); }, 360); };
    d.addEventListener('pointerdown', bye); setTimeout(bye, 3200); };
  const toast = a => { q.push(a); if (!showing) next(); };
  const unlock = a => { const s = STORE(); if (!s || has(a.id)) return false; s.ach.push(a.id); const r = a.reward || {}; if (r.gems) payGems(r.gems);
    if (r.title && s.titles.indexOf(r.title) < 0) s.titles.push(r.title);
    toast(a); try { R.sfx && R.sfx.play && R.sfx.play('ach', 0.8); } catch (e) {} R.bus.emit('ach', a.id, a); R.save && R.save(); return true; };
  let checking = false;
  const check = () => { if (!STORE() || !P() || checking) return; checking = true; try { for (const a of A) if (!has(a.id) && value(a) >= need(a)) unlock(a); } finally { checking = false; } };

  /* ---- listeners ---- */
  const on = (ev, f) => R.bus.on(ev, (...a) => { if (!STORE() || !P()) return; try { f(...a); } catch (e) { console.error('ach', ev, e); } });
  const bossKill = id => { const n = N(), k = norm(id) || 'boss'; if (n.lastBoss === k && R.t - n.lastBossT < 2) return; n.lastBoss = k; n.lastBossT = R.t; n.bossN++; n.bossK[k] = (n.bossK[k] | 0) + 1; };
  const regName = id => { const k = norm(id); for (const r of asList(R.data.world && R.data.world.regions)) if (r && (norm(r.id) === k || norm(r.name) === k)) return k + ' ' + norm(r.name) + ' ' + norm(r.id); return k; };
  const place = (id, isRegion) => { const n = N(), k = norm(id); if (!k) return; const s = isRegion ? regName(id) : k; if (isRegion) n.reg[k] = 1;
    if (s.split(' ').some(x => WALL.test(x))) n.wall = 1; if (BEYOND.test(s)) { n.beyond = 1; n.wall = 1; } };
  const noteHero = () => { const n = N(), p = P(); if (p && p.hero != null) n.heroLvl[p.hero] = Math.max(n.heroLvl[p.hero] | 0, p.lvl | 0); n.lvl = Math.max(n.lvl | 0, p ? p.lvl | 0 : 0); };
  on('kill', e => { N().kills++; RUN().kills++; if (e && e.kind === 'boss') bossKill(e.type || e.boss || e.id || e.name); check(); });
  on('boss', (id, phase) => { if (DEAD.test(norm(phase))) bossKill(id); check(); });
  on('poi', id => { N().poi[norm(id)] = 1; place(id, false); check(); });
  on('enter', id => { place(id, true); check(); });
  on('levelup', l => { const n = N(), p = P(); n.lvl = Math.max(n.lvl | 0, l | 0, p.lvl | 0); if (p.hero != null) n.heroLvl[p.hero] = Math.max(n.heroLvl[p.hero] | 0, l | 0, p.lvl | 0); check(); });
  on('quest', (id, st) => { if (DONE.test(norm(st))) N().q[norm(id)] = 1; check(); });
  on('loot', it => { const n = N(); n.loot++; if (isLeg(it)) n.leg++; check(); });
  on('gold', g => { if (g > 0) N().gold += g; check(); });
  on('hit', h => { if (h && h.crit && h.src && (h.src === R.player || h.src.kind === 'player')) { const n = N(); n.crits++; if (n.crits >= 100) check(); } });
  on('death', (a, b) => { const n = N(); n.deaths++; noteHero(); const k = a && typeof a === 'object' ? (a.killer || a.by || a.src || a) : (a != null ? a : b); const last = HALL()[HALL().length - 1];
    if (bossKiller(k) || (last && bossKiller(last.killer)) || (R.player && bossKiller(R.player.lastHitBy))) n.bossDeath = 1; check(); });
  let potEv = false;
  on('potion', () => { potEv = true; N().potions++; check(); });
  on('dungeon', (id, st) => { if (st === true || WIN.test(norm(st))) N().dung[norm(id) || 'd'] = 1; check(); });
  on('event', (a, b, c) => { const n = N(); const o = a && typeof a === 'object' ? a : null; const id = o ? (o.id || o.type || o.kind) : a; const st = o ? (o.state || o.phase || b) : b; const k = norm(id), s = norm(st);
    if (!ENDLIKE.test(s) && !(n.lastEv === k && R.t - n.lastEvT < 120)) { n.ev++; n.lastEv = k; n.lastEvT = R.t; }
    if (/horde|wight|dead|walker/.test(k) && (c === true || (o && o.won) || WIN.test(s))) n.horde++; check(); });
  on('tick1s', () => { const n = N(), p = P(); if (!R.paused) { n.played++; RUN().played++; } noteHero();
    const key = p.created || p.hero || 0; if (n.baseKey !== key) { n.baseKey = key; n.gemBase = p.gems | 0; n.potBase = p.potions ? sumVals(p.potions) : null; }
    const g = p.gems | 0; if (n.gemBase != null && g < n.gemBase) n.spent += n.gemBase - g; n.gemBase = g;
    if (!potEv && p.potions) { const t = sumVals(p.potions); if (n.potBase != null && t < n.potBase) n.potions += n.potBase - t; n.potBase = t; }
    if (R.world && R.world.regionAt && R.player) { try { const r = R.world.regionAt(R.player.x, R.player.y); if (r) place(r, true); } catch (e) {} }
    check(); });

  /* ---- titles ---- */
  const titles = () => { const s = STORE(), out = []; if (!s) return out; for (const a of A) if (a.reward && a.reward.title && has(a.id) && out.indexOf(a.reward.title) < 0) out.push(a.reward.title);
    for (const t of s.titles) if (out.indexOf(t) < 0) out.push(t); return out; };
  const curTitle = () => { const s = STORE(); return (s && s.title) || ''; };
  const setTitle = t => { const s = STORE(), p = P(); if (!s) return false; t = t || ''; if (t && titles().indexOf(t) < 0) return false; s.title = t;
    if (p && p !== s) { try { if (p.title !== t) p.title = t; } catch (e) {} } R.bus.emit('title', t); R.save && R.save(); return true; };

  /* ---- the screen ---- */
  const fmt = (a, cur, n) => (a.cond.ev === 'tick1s' ? (n >= 3600 ? (cur / 3600).toFixed(cur >= n ? 0 : 1) + ' / ' + n / 3600 + ' h' : Math.floor(cur / 60) + ' / ' + n / 60 + ' min') : cur.toLocaleString('en-US') + ' / ' + n.toLocaleString('en-US'));
  const head = (extra) => '<div class="ach-head"><button class="ach-back" id="achBack" aria-label="Back">‹</button><div class="ach-h1">Achievements</div>' + (extra || '') + '</div>';
  const render = el => { if (!el) return; const s = STORE(); if (!s || !P()) { el.innerHTML = '<div class="ach-wrap">' + head() + '<div class="ach-hint">No hero yet.</div></div>'; bind(el); return; }
    const done = A.filter(a => has(a.id)).length, T = titles(), cur = curTitle();
    const chips = ['<button class="ach-chip none' + (cur ? '' : ' on') + '" data-t="">None</button>'].concat(T.map(t => '<button class="ach-chip' + (t === cur ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>')).join('');
    const cards = A.map(a => { const g = progress(a.id), ok = has(a.id);
      return '<div class="ach-card ' + (ok ? 'done' : 'lock') + '" data-id="' + a.id + '"><div class="ach-ic">' + icon(a.icon) + '</div><div class="ach-n">' + esc(a.name) + '</div><div class="ach-d">' + esc(a.d) + '</div>' +
        (ok ? '<div class="ach-rw">' + rewardTxt(a) + '</div>' : '<div class="ach-pg"><i style="width:' + Math.round(g.pct * 100) + '%"></i></div><div class="ach-pt">' + fmt(a, g.cur, g.n) + '</div>') + '</div>'; }).join('');
    el.innerHTML = '<div class="ach-wrap">' + head('<div class="ach-cnt">' + done + ' / ' + A.length + '</div>') +
      '<div class="ach-sec" id="achTitleSec">Title' + (cur ? ' · <b>' + esc(cur) + '</b>' : '') + '</div><div class="ach-titles">' + chips + '</div>' + (T.length ? '' : '<div class="ach-hint">Titles come with achievements. The first: a hundred foes.</div>') +
      '<div class="ach-sec">' + done + ' of ' + A.length + ' earned</div><div class="ach-grid">' + cards + '</div></div>';
    bind(el); };
  const bind = el => { const b = el.querySelector('#achBack'); if (b) b.addEventListener('click', () => R.ui.close());
    el.querySelectorAll('.ach-chip').forEach(c => c.addEventListener('click', () => { const t = c.dataset.t || ''; if (!setTitle(t)) return; el.querySelectorAll('.ach-chip').forEach(x => x.classList.toggle('on', x === c));
      const s = el.querySelector('#achTitleSec'); if (s) s.innerHTML = 'Title' + (t ? ' · <b>' + esc(t) + '</b>' : ''); })); };
  R.screens.ach = { open: (arg, el) => render(el || document.getElementById('screen')), close: () => {} };

  R.ach = { list: () => A, byId, progress, check, unlock: id => (byId[id] ? unlock(byId[id]) : false), has, titles, title: curTitle, setTitle, icon, store: STORE, run: RUN,
    count: () => ({ done: A.filter(a => has(a.id)).length, total: A.length }), open: () => R.ui.open('ach'), legIdx, mainIds };
})();
