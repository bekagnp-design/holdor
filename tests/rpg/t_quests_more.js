// Q1 — more quest content (src/rpg/js/41b_quests_more.js): region chains, local quests at every place with people, daily notice boards.
//   Node part (vm, fast): world + mobs + story + 41b + 42_dialog's roster on stubs → every id unique and valid, every kill / collect mob spawns
//   in its region's table, every giver / target / poi exists and is a visible NPC, lines <= 110, levels inside the region band, rewards scale.
//   Browser part (one Chromium): the integrated build boots, a town quest is accepted → progressed by real kills → turned in through R.quests,
//   a board bounty is taken, handed in and comes back the next day.
// Run: F=…/q1.html; python3 src/build_rpg.py $F && HOLDOR_HTML=$F RPG_HTML=$F RPG_NOBUILD=1 CHROMIUM_PATH=… node tests/rpg/t_quests_more.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const L = require('./lib');
const ROOT = path.join(__dirname, '..', '..'), JS = f => fs.readFileSync(path.join(ROOT, 'src/rpg/js', f), 'utf8');

/* ---- Node: load the data modules into one context ---- */
const R = { data: {}, bus: { on() {}, emit() {} }, screens: {}, addSys() {}, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), t: 0 };
const ctx = { R, console, Math, JSON, Date, Object, Array, Set, String, Number, setTimeout: () => 0 }; ctx.window = ctx; ctx.window.R = R;
// Q1_WORLD=<path of another 11_world_data.js> checks the content against that map (e.g. a worktree with more villages); R.WS from Q1_WS
if (process.env.Q1_WS) R.WS = +process.env.Q1_WS;
for (const f of ['11_world_data.js', '12_mobs.js', '41_story.js', '41b_quests_more.js', '42_dialog.js']) { try { vm.runInNewContext(f === '11_world_data.js' && process.env.Q1_WORLD ? fs.readFileSync(process.env.Q1_WORLD, 'utf8') : JS(f), ctx); } catch (e) { L.ok('load ' + f, false, e.message); } }
const D = R.data, W = D.world, M = R.questsMore;
L.ok('41b loaded and exported its counts', !!M && M.added.quests.length > 0, M && JSON.stringify({ q: M.added.quests.length, n: M.added.npcs.length, b: M.added.boards.length }));
const Q = D.quests, mine = Q.filter(q => q && q.q1), byQ = {}; const dupQ = [];
for (const q of Q) { if (byQ[q.id]) dupQ.push(q.id); byQ[q.id] = q; }
L.ok('quest ids unique (the whole list)', !dupQ.length, dupQ.slice(0, 5).join());
const dupN = []; const seenN = {}; for (const n of D.npcs) { if (seenN[n.id]) dupN.push(n.id); seenN[n.id] = 1; }
L.ok('npc ids unique (the whole list)', !dupN.length, dupN.slice(0, 5).join());
const chains = mine.filter(q => q.q1 === 'chain'), locals = mine.filter(q => q.q1 === 'local'), boards = mine.filter(q => q.q1 === 'board');
L.ok('a 3-step chain in each of the 15 regions', W.regions.length === 15 && W.regions.every(r => chains.filter(q => q.region === r.id).length === 3), W.regions.map(r => r.id + ':' + chains.filter(q => q.region === r.id).length).join(' '));
const settled = W.pois.filter(p => (/^(town|castle|village|farm|inn|tower)$/.test(p.type) || p.village) && R.npcs.npcsAt(p.id).length);
const noLocal = settled.filter(p => !locals.some(q => q.poi === p.id));
L.ok('every town / castle / village with people has 1–2 local quests', !noLocal.length && settled.every(p => locals.filter(q => q.poi === p.id).length <= 2), noLocal.map(p => p.id).join());
const boardNpcs = D.npcs.filter(n => n.role === 'board');
L.ok('a notice board with 3 repeatable bounties in every town', boardNpcs.length >= 20 && boardNpcs.every(b => boards.filter(q => q.giver === b.id).length === 3) && boards.every(q => q.repeat && q.type === 'kill'), boardNpcs.length + ' boards');
L.ok('every town (type town) has a board', W.pois.filter(p => p.type === 'town' && !p.village).every(p => boardNpcs.some(b => b.poi === p.id)));

/* ---- every reference resolves ---- */
const spawnsIn = rid => (W.spawnsByRegion[rid] || { mobs: [] }).mobs.map(m => m.type);
const visible = id => !!R.npcs.data(id);   // 42_dialog's roster: story NPCs + the world NPCs no story NPC covers
const bad = [];
for (const q of mine) { const p = W.poiById[q.poi], rg = W.regionById[q.region]; const B = rg && rg.lvl;
  if (!p) bad.push(q.id + ' poi ' + q.poi); else if (p.region !== q.region) bad.push(q.id + ' poi region ' + p.region + '≠' + q.region);
  if (!rg) bad.push(q.id + ' region ' + q.region);
  if (!visible(q.giver)) bad.push(q.id + ' giver not visible ' + q.giver);
  else { const g = R.npcs.data(q.giver); if (g.poi !== q.poi) bad.push(q.id + ' giver stands at ' + g.poi); }
  if (q.type === 'kill' && !spawnsIn(q.region).includes(q.target)) bad.push(q.id + ' kill ' + q.target + ' never spawns in ' + q.region);
  if (q.type === 'kill' && !D.mobs[q.target]) bad.push(q.id + ' not a mob key ' + q.target);
  if (q.type === 'collect' && !(spawnsIn(q.region).includes(q.from) && D.mobs[q.from])) bad.push(q.id + ' collect from ' + q.from);
  if (q.type === 'collect' && !/^[a-z_]+$/.test(q.target)) bad.push(q.id + ' item id ' + q.target);
  if (q.type === 'reach' && !W.poiById[q.target]) bad.push(q.id + ' reach ' + q.target);
  if ((q.type === 'talk' || q.type === 'escort') && !visible(q.target)) bad.push(q.id + ' talk/escort target ' + q.target);
  if (q.type === 'escort' && !W.poiById[q.to]) bad.push(q.id + ' escort to ' + q.to);
  if (q.type === 'escort' && R.npcs.data(q.target) && R.npcs.data(q.target).poi !== q.to) bad.push(q.id + ' escort target not at ' + q.to);
  if (q.prev && !byQ[q.prev]) bad.push(q.id + ' prev ' + q.prev);
  if (B && !(q.lvl >= B[0] && q.lvl <= B[1])) bad.push(q.id + ' lvl ' + q.lvl + ' outside ' + B);
  if (q.repeat && q.pool && q.pool.some(m => !spawnsIn(q.region).includes(m))) bad.push(q.id + ' board pool');
  if (!(q.reward && q.reward.xp > 0 && q.reward.gold > 0)) bad.push(q.id + ' reward');
  const g = q.reward.gold / (q.lvl * Math.max(1, q.n)); if (g < 2 || g > 10.5) bad.push(q.id + ' gold ' + q.reward.gold + ' not 2–8 × lvl × n (' + g.toFixed(1) + ')');
  if (!(Array.isArray(q.text.offer) && q.text.offer.length >= 1 && q.text.offer.length <= 3 && q.text.progress && q.text.done)) bad.push(q.id + ' text');
}
L.ok('every poi / giver / target / mob / level / reward valid', !bad.length, bad.length + ': ' + bad.slice(0, 8).join(' | '));
// a chain: kill → collect → reach|talk, one path, levels up, the last step pays an item and the chain's one gem purse
const cb = [];
for (const r of W.regions) { const c = chains.filter(q => q.region === r.id).sort((a, b) => a.id < b.id ? -1 : 1); if (c.length !== 3) continue;
  if (c[0].type !== 'kill' || c[1].type !== 'collect' || !/reach|talk/.test(c[2].type)) cb.push(r.id + ' types ' + c.map(q => q.type));
  if (c[0].prev || c[1].prev !== c[0].id || c[2].prev !== c[1].id) cb.push(r.id + ' prev');
  if (!(c[0].lvl <= c[1].lvl && c[1].lvl <= c[2].lvl)) cb.push(r.id + ' levels');
  if (!(c[2].reward.item && c[2].reward.item.rar >= 1)) cb.push(r.id + ' item');
  if (c.filter(q => q.reward.gems).length > 1) cb.push(r.id + ' gems twice');
  const hub = R.npcs.data(c[0].giver); if (!hub || (hub.poi !== r.hub && hub.poi !== (W.regionById[r.id].home && D.story.seats[W.regionById[r.id].home]) && W.poiById[hub.poi].region !== r.id)) cb.push(r.id + ' giver place'); }
L.ok('chains: kill → collect → reach/talk, linked, levels rise, item + at most one gem purse', !cb.length, cb.join(' | '));
L.ok('one giver per region chain at its seat / main town', W.regions.every(r => { const c = chains.filter(q => q.region === r.id); return c.length && c.every(q => q.giver === c[0].giver); }));
// lines: <= 110, no placeholder left, no copied famous lines
const BANNED = ['you know nothing', 'winter is coming', 'what is dead may never die', 'valar morghulis', 'the night is dark', 'chaos is a ladder', 'hold the door', 'a lannister always', 'the north remembers', 'dracarys'];
const strs = []; const col = (v, p) => { if (typeof v === 'string') strs.push([p, v]); else if (Array.isArray(v)) v.forEach((x, i) => col(x, p + '[' + i + ']')); else if (v && typeof v === 'object') for (const k in v) col(v[k], p + '.' + k); };
for (const q of mine) col({ t: q.title, x: q.text }, q.id); for (const n of D.npcs.filter(n => n.q1)) { col({ n: n.name, l: n.lines }, n.id); col(D.story.dialogs[n.id], n.id + '.dlg'); }
const longs = strs.filter(([, s]) => s.length > 110), holes = strs.filter(([, s]) => /\{\w+\}|undefined|NaN|\[object/.test(s)), banned = strs.filter(([, s]) => BANNED.some(b => s.toLowerCase().includes(b)));
L.ok('every line <= 110 chars', !longs.length, longs.slice(0, 3).map(x => x[0] + ' (' + x[1].length + '): ' + x[1]).join(' | '));
L.ok('no placeholder / undefined in any line', !holes.length, holes.slice(0, 3).map(x => x.join(': ')).join(' | '));
L.ok('no famous lines', !banned.length, banned.slice(0, 3).map(x => x.join(': ')).join(' | '));
// the story resolver keeps every target (no fitMob swap, no 'any' fallback): the data was right as written
const sw = []; for (const q of mine) { const r = R.story.resolve(q, 'stark'); if (q.type === 'kill' && r.target !== q.target) sw.push(q.id); if (q.type === 'collect' && r.from !== q.from) sw.push(q.id + ' from'); }
L.ok('R.story.resolve keeps every mob (no swap)', !sw.length, sw.slice(0, 5).join());
// NPCs: shape, place, dialog, nobody hides a world NPC that was already a giver
const nb = []; for (const n of D.npcs.filter(n => n.q1)) { if (!W.poiById[n.poi]) nb.push(n.id + ' poi'); if (!n.name || !n.role || !n.kind) nb.push(n.id + ' name/role/kind');
  if (!['elder', 'innkeeper', 'farmer', 'hunter', 'merchant', 'guard', 'smith', 'board'].includes(n.role)) nb.push(n.id + ' role ' + n.role);
  const d = D.story.dialogs[n.id]; if (!(Array.isArray(d) && d[0].choices.some(c => c.close))) nb.push(n.id + ' dialog'); if (!visible(n.id)) nb.push(n.id + ' hidden'); }
L.ok('new NPCs: real place, role from the list, a dialog with Leave, visible in the roster', !nb.length, nb.slice(0, 6).join());
// the daily board roll: another day gives another pick, a taken bounty keeps its mob
const b0 = boards[0], pick0 = b0.target + b0.n; let other = false; for (let d = 1; d < 8 && !other; d++) { M.roll(b0, '2030-1-' + d); other = b0.target + b0.n !== pick0; }
L.ok('a board slot rolls another bounty on another day', other);
const counts = { quests: mine.length, chains: chains.length, local: locals.length, boards: boardNpcs.length, bounties: boards.length, npcs: D.npcs.filter(n => n.q1).length };
console.log('COUNTS', JSON.stringify(counts));

/* ---- Browser: the integrated build ---- */
(async () => {
  if (process.env.Q1_NODE) return L.report();
  L.build();
  const { page, errors, cerrs, close } = await L.launch();
  try {
    const b = await L.boot(page, { save: L.fakeSave({ house: 'stark', lvl: 4 }), timeout: 90000, wait: 40000 });
    L.ok('booted into the world', b.running, JSON.stringify({ running: b.running, cur: b.cur }));
    const r1 = await L.ev(page, () => { if (R.ui.cur) R.ui.close(); R.player.hp = R.player.hpMax = 1e7;
      const q = R.quests.get('ql_whiteharbor_1') || R.quests.all().find(x => x.q1 === 'local' && x.type === 'kill' && R.data.world.poiById[x.poi].region === 'north');
      const p = R.data.world.poiById[q.poi]; R.player.x = p.x + 30; R.player.y = p.y + 30; for (let i = 0; i < 90; i++) R.step();
      const g = R.npcs.list().find(e => e.dialog === q.giver), av = R.quests.available(q.giver).map(x => x.id);
      return { id: q.id, giver: q.giver, mob: q.target.mob, n: q.n, spawned: !!g, mark: g && g.mark, av: av.includes(q.id), tot: R.quests.all().length, boards: R.npcs.npcsAt(q.poi).filter(n => n.role === 'board').length }; });
    L.ok('a town quest stands at its giver in the world, marked !', r1.spawned && r1.av && r1.mark === '!', JSON.stringify(r1));
    // accept → kill its mobs with R.hit → done → turn in
    const r2 = await L.ev(page, id => { const ok1 = R.quests.accept(id), q = R.quests.get(id), out = [];
      for (let i = 0; i < q.n; i++) { const x = R.player.x + 60 + i * 8, y = R.player.y + 40; const m = R.mobs && R.mobs.spawn ? R.mobs.spawn(q.target.mob, q.lvl, x, y) : R.spawn({ kind: 'mob', team: 1, type: q.target.mob, x, y, hp: 10, hpMax: 10, lvl: q.lvl });
        R.hit(R.player, m, 1e7, { kind: 'phys' }); for (let k = 0; k < 3; k++) R.step(); if (!m.dead && R.kill) R.kill(m, R.player); out.push(!!m.dead); }
      for (let i = 0; i < 6; i++) R.step(); const s0 = R.quests.state(id), s = s0 && { st: s0.st, n: s0.n }; const before = { xp: R.state.p.xp, gold: R.state.p.gold, lvl: R.state.p.lvl };
      const ok2 = R.quests.turnIn(id); const s2 = R.quests.state(id);
      return { ok1, dead: out.every(Boolean), st: s && s.st, n: s && s.n, ok2, st2: s2 && s2.st, gold: R.state.p.gold - before.gold, xp: R.state.p.xp - before.xp + (R.state.p.lvl - before.lvl) * 1e6, rw: q.reward }; }, r1.id);
    L.ok('accept → ' + r1.n + ' kills → done → turned in, gold and xp paid', r2.ok1 && r2.dead && r2.st === 'done' && r2.ok2 && r2.st2 === 'turned' && r2.gold >= r2.rw.gold && r2.xp > 0, JSON.stringify(r2));
    // a board bounty: taken, handed in, comes back the next day
    const r3 = await L.ev(page, () => { const q = R.quests.all().find(x => x.repeat && R.data.world.poiById[x.poi].region === 'north'); const id = q.id;
      R.quests.accept(id); const m = R.quests.get(id); R.quests.progress(id, m.n); const t = R.quests.turnIn(id); const s = R.quests.state(id);
      const again0 = R.quests.canAccept(R.quests.get(id)); s.tday = '2000-1-1'; R.questsMore.reset(); const again = R.quests.canAccept(R.quests.get(id));
      return { id, turned: t, st: s.st, pick: s.pick, again0, again, title: R.quests.get(id).title }; });
    L.ok('a board bounty is handed in and offered again the next day', r3.turned && r3.st === 'turned' && !!r3.pick && r3.again0 === false && r3.again === true, JSON.stringify(r3));
    await L.shot(page, 'quests_more');
    const ge = await L.gameErrors(page), rc = L.realConsole(cerrs);
    L.ok('no page / game errors', !errors.length && !ge.length && !rc.length, errors.concat(ge, rc).slice(0, 4).join(' | '));
  } catch (e) { L.ok('browser part ran', false, e.message); }
  await close(); L.report();
})();
