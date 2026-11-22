// t_quests (A18): the quest engine. accept → kill / loot / poi / dialog / boss events progress → done → turnIn pays XP + gold, gives an item
// and a hero, unlocks the next quest of the chain and tracks it; the tracker card shows title + progress line + an arrow toward the target;
// the quest log opens from the card (real tap), has Main / Side tabs, TRACK sets flags.track; markers() gives the giver's position; NPCs get
// '!' / '?' marks each second; the state survives R.save(). The quest list is FIXED here (five quests) so the suite does not depend on
// A19's data; the giver NPCs are spawned here. Build first: python3 src/build_rpg.py beta/index.html. Screenshots: .shots/rpg_quests_*.png
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const HTML = 'file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html');
  await page.goto(HTML);
  await page.waitForFunction(() => window.R && R.quests && R.screens && R.screens.quests, { timeout: 20000 });
  const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const ev = (fn, a) => page.evaluate(fn, a);

  // ---- a fresh save, five fixed quests, two giver NPCs, a hero that cannot die ----
  await ev(() => {
    if (R.ui.cur) R.ui.close();
    R.state = R.newState(); R.state.p.name = 'Tester'; R.state.p.lvl = 1; R.state.p.xp = 0; R.state.p.gold = 0; R.state.p.gems = 0;
    R.data.quests = [
      { id: 'q1', title: 'First Watch', giver: 'maester', poi: 'winterfell', region: 'north', lvl: 1, main: true, type: 'kill', target: { mob: 'wight' }, n: 3,
        text: { offer: 'Wights walk the wolfswood. Put three of them down.', progress: 'The wolfswood is not clear yet.', done: 'Three fewer. The night is a little shorter.' }, reward: { xp: 50, gold: 30 } },
      { id: 'q2', title: 'The Road North', giver: 'maester', poi: 'winterfell', region: 'north', lvl: 1, main: true, prev: 'q1', type: 'reach', target: { poi: 'castle_black' }, n: 1,
        text: { offer: 'Ride to Castle Black and find the Lord Commander.', progress: 'The kingsroad runs north.', done: 'You made it to the Wall.' }, reward: { xp: 80, gold: 40, gems: 5, item: { rar: 2 }, hero: 'jon' } },
      { id: 'q3', title: 'Winter Pelts', giver: 'hunter', poi: 'winterfell', region: 'north', lvl: 2, main: false, type: 'collect', target: { item: 'pelt' }, n: 2,
        text: { offer: 'Two pelts and I will stitch you a cloak.', progress: 'Pelts come from wolves, not from wishing.', done: 'Good pelts. Good cloak.' }, reward: { xp: 20, gold: 15 } },
      { id: 'q4', title: 'The Thing in the Barrow', giver: 'hunter', poi: 'barrowlands', region: 'north', lvl: 9, main: false, type: 'boss', target: { boss: 'barrow_king' }, n: 1,
        text: { offer: 'Something woke under the barrows.', progress: 'It waits in the dark.', done: 'It sleeps again.' }, reward: { xp: 300, gold: 120, gems: 10 } },
      { id: 'q5', title: 'A Word for the Maester', giver: 'hunter', poi: 'winterfell', region: 'north', lvl: 1, main: false, type: 'talk', target: { npc: 'maester' }, n: 1,
        text: { offer: 'Tell the maester the hounds are back.', progress: 'He is in his tower.', done: 'He knows now.' }, reward: { xp: 10, gold: 5 } }];
    const pois = [{ id: 'winterfell', name: 'Winterfell', x: 300, y: -400 }, { id: 'castle_black', name: 'Castle Black', x: 500, y: -900 }, { id: 'barrowlands', name: 'Barrowlands', x: -600, y: 800 }];
    if (!R.data.world) R.data.world = { pois };
    else if (Array.isArray(R.data.world.pois)) { for (const p of pois) if (!R.data.world.pois.some(x => x && x.id === p.id)) R.data.world.pois.push(p); }
    else { R.data.world.pois = R.data.world.pois || {}; for (const p of pois) R.data.world.pois[p.id] = R.data.world.pois[p.id] || p; }
    if (!R.player || R.player.dead) R.player = R.spawn({ kind: 'player', x: 0, y: 0, team: 0, hp: 1e9, name: 'Tester' });
    R.player.hp = 1e9; R.player.hpMax = 1e9; R.player.x = 0; R.player.y = 0;
    window.__m = R.spawn({ kind: 'npc', type: 'maester', name: 'Maester Luwin', x: 300, y: -400, team: 2, hp: 1e9 });
    window.__h = R.spawn({ kind: 'npc', type: 'hunter', name: 'Old Hunter', x: -200, y: 500, team: 2, hp: 1e9 });
    window.__xp = 0; window.__gold = 0; window.__ev = [];
    R.bus.on('xp', n => { window.__xp += n; }); R.bus.on('gold', n => { window.__gold += n; }); R.bus.on('quest', (id, s) => window.__ev.push(id + ':' + s));
    R.start();
  });
  const QS = () => ev(() => (R.acc && R.acc().world && R.acc().world.quests) || R.state.p.quests);
  const trackerText = () => ev(() => { const c = document.querySelector('.qt-card'); return c && c.classList.contains('on') ? c.textContent.replace(/\s+/g, ' ').trim() : null; });
  const tick = () => ev(() => { R.bus.emit('tick1s'); R.quests.refresh(); });

  // 1. availability: prev chain and the level gate (lvl − 3)
  const av = await ev(() => ({ m: R.quests.available('maester').map(q => q.id), h: R.quests.available('hunter').map(q => q.id), all: R.quests.available().map(q => q.id) }));
  ok('available(): the maester offers q1 only (q2 waits for q1); the hunter q3 (lvl 2) + q5, not q4 (lvl 9 > 1+3)', av.m.join() === 'q1' && av.h.join() === 'q3,q5' && av.all.length === 3, JSON.stringify(av));
  const mk0 = await ev(() => R.quests.markers());
  ok('markers() before any quest: one give marker per giver at the NPC entity position (the hunter\'s two offers share one, ids lists both)', mk0.length === 2 && mk0.every(m => m.kind === 'give') && mk0.some(m => m.x === 300 && m.y === -400 && m.id === 'q1' && m.main) && mk0.some(m => m.x === -200 && m.y === 500 && m.ids.join() === 'q3,q5'), JSON.stringify(mk0));
  await tick();
  const marks0 = await ev(() => [window.__m.mark, window.__h.mark]);
  ok('NPCs with an offer carry mark "!"', marks0[0] === '!' && marks0[1] === '!', JSON.stringify(marks0));
  const tr0 = await trackerText();
  ok('tracker before accepting: the next main quest with "Speak with Maester Luwin"', /First Watch/.test(tr0) && /Speak with Maester Luwin/.test(tr0), tr0);

  // 2. accept
  const acc = await ev(() => { const a = R.quests.accept('q1'); const b = R.quests.accept('q2'); const c = R.quests.accept('q4'); return { a, b, c, track: (R.acc ? R.acc().world.flags : R.state.p.flags).track }; });
  const s1 = (await QS()).q1;
  ok('accept(q1) opens it; accept(q2) (prev open) and accept(q4) (level) are refused; q1 is tracked', acc.a && !acc.b && !acc.c && s1 && s1.st === 'open' && s1.n === 0 && acc.track === 'q1', JSON.stringify({ acc, s1 }));
  await page.waitForTimeout(120);
  const tr1 = await trackerText();
  ok('tracker: "First Watch" + "Wights 0/3"', /First Watch/.test(tr1) && /Wights 0\/3/.test(tr1), tr1);
  await page.screenshot({ path: SC + 'rpg_quests_tracker.png' });

  // 3. kills progress it (a hound does not count), the fourth wight is not needed
  const k = await ev(() => { const out = []; for (const t of ['wight', 'hound', 'wight', 'wight', 'wight']) { const e = R.spawn({ kind: 'mob', type: t, hp: 1, team: 1 }); e.lastHitBy = R.player; R.kill(e); const s = R.quests.state('q1'); out.push(s.n + s.st[0]); } return out; });
  ok('kill events: wight 1, hound ignored, wight 2, wight 3 → done; the fourth changes nothing', k.join() === '1o,1o,2o,3d,3d', k.join());
  const tr2 = await trackerText();
  ok('tracker after done: "Return to Maester Luwin"', /Return to Maester Luwin/.test(tr2), tr2);
  const mk1 = await ev(() => R.quests.markers());
  ok('markers(): a turnin marker at the maester, no target marker for q1', mk1.some(m => m.kind === 'turnin' && m.id === 'q1' && m.x === 300 && m.y === -400) && !mk1.some(m => m.id === 'q1' && m.kind !== 'turnin'), JSON.stringify(mk1));
  await tick();
  ok('the maester carries mark "?" with a turn-in waiting', (await ev(() => window.__m.mark)) === '?');

  // 4. turn in: XP + gold, the chain moves on, the next main quest is tracked with a give marker
  const ti = await ev(() => { const g0 = R.state.p.gold, x0 = R.state.p.xp, l0 = R.state.p.lvl; const r = R.quests.turnIn('q1'); const r2 = R.quests.turnIn('q1');
    return { r, r2, st: R.quests.state('q1').st, dx: R.state.p.xp - x0, dg: R.state.p.gold - g0, lvlUp: R.state.p.lvl > l0, xp: window.__xp, gold: window.__gold, track: (R.acc ? R.acc().world.flags : R.state.p.flags).track, av: R.quests.available('maester').map(q => q.id), ev: window.__ev.slice() }; });
  ok('turnIn(q1) pays 50 XP + 30 gold once, marks it turned, unlocks q2 and tracks it', ti.r && !ti.r2 && ti.st === 'turned' && (ti.xp === 50 || ti.dx === 50 || ti.lvlUp) && (ti.gold === 30 || ti.dg === 30) && ti.av.join() === 'q2' && ti.track === 'q2', JSON.stringify(ti));
  ok('quest events: q1 open → progress ×2 → done → turned', ti.ev.join() === 'q1:open,q1:progress,q1:progress,q1:done,q1:turned', ti.ev.join());
  await page.waitForTimeout(120);
  const tr3 = await trackerText();
  ok('tracker after the turn-in: "The Road North" + "Speak with Maester Luwin"', /The Road North/.test(tr3) && /Speak with Maester Luwin/.test(tr3), tr3);
  await tick();
  ok('the maester carries mark "!" again (q2 on offer)', (await ev(() => window.__m.mark)) === '!');

  // 5. reach quest: the target marker is the POI, the poi event finishes it; turn-in gives gems + an item + a hero
  const rc = await ev(() => { R.quests.accept('q2'); const mk = R.quests.markers().find(m => m.id === 'q2'); const line0 = R.quests.line(R.quests.get('q2'));
    R.bus.emit('poi', 'castle_black'); const s = { st: R.quests.state('q2').st }; const inv0 = R.state.p.inv.length, gm0 = R.state.p.gems;
    const r = R.quests.turnIn('q2'); const acc = R.acc ? R.acc() : R.state.acc; const it = R.state.p.inv[R.state.p.inv.length - 1];
    return { mk, line0, st: s.st, r, dInv: R.state.p.inv.length - inv0, dGems: R.state.p.gems - gm0, item: it && { rar: it.rar, kind: it.kind, name: it.name }, hero: !!((acc && acc.champs && acc.champs.jon && acc.champs.jon.unlocked) || (R.state.p.champs && R.state.p.champs.jon)), track: (R.acc ? R.acc().world.flags : R.state.p.flags).track }; });
  ok('q2: target marker at Castle Black (500,−900), line "Reach Castle Black", poi event → done', rc.mk && rc.mk.kind === 'target' && rc.mk.x === 500 && rc.mk.y === -900 && rc.line0 === 'Reach Castle Black' && rc.st === 'done', JSON.stringify({ mk: rc.mk, line0: rc.line0, st: rc.st }));
  ok('turnIn(q2): +5 dragonglass, one item of rarity 2 in the bag, Jon unlocked as a hero; no main quest left → track cleared', rc.r && rc.dGems === 5 && rc.dInv === 1 && rc.item && rc.item.rar === 2 && rc.hero && !rc.track, JSON.stringify(rc));

  // 6. side quests: collect by loot events, talk by the dialog event; the tracker falls back to the newest side quest
  const sd = await ev(() => { R.quests.accept('q3'); R.quests.accept('q5'); const t0 = R.quests.tracked().id;
    R.bus.emit('loot', { base: 'pelt', kind: 'mat', id: 'x1' }); R.bus.emit('loot', { base: 'bone', kind: 'mat', id: 'x2' }); const n1 = R.quests.state('q3').n;
    R.bus.emit('loot', { base: 'pelt', kind: 'mat', id: 'x3' }); const s3 = R.quests.state('q3').st;
    R.bus.emit('dialog', 'smith'); const s5a = R.quests.state('q5').st; R.bus.emit('dialog', 'maester'); const s5 = R.quests.state('q5').st;
    return { t0, n1, s3, s5a, s5 }; });
  ok('q3 collect: pelt 1, bone ignored, pelt 2 → done; q5 talk: a smith does not count, the maester does', sd.n1 === 1 && sd.s3 === 'done' && sd.s5a === 'open' && sd.s5 === 'done', JSON.stringify(sd));
  ok('with no main quest the tracker follows the first accepted side quest (q3 was accepted first and tracked)', sd.t0 === 'q3', sd.t0);

  // 7. the level gate opens at lvl−3; the boss quest finishes on boss(id,'dead') once, a kill of the same boss within 2 s does not double it
  const bs = await ev(() => { R.state.p.lvl = 6; R.bus.emit('levelup', 6); const av = R.quests.available('hunter').map(q => q.id); const a = R.quests.accept('q4');
    const mk = R.quests.markers().find(m => m.id === 'q4'); R.data.quests[3].n = 2;   // two needed, to see a double count
    R.bus.emit('boss', 'barrow_king', 'p2'); const n0 = R.quests.state('q4').n; R.bus.emit('boss', 'barrow_king', 'dead'); const n1 = R.quests.state('q4').n;
    const e = R.spawn({ kind: 'boss', type: 'barrow_king', hp: 1, team: 1 }); e.lastHitBy = R.player; R.kill(e); const n2 = R.quests.state('q4').n;
    return { av, a, mk, n0, n1, n2, st: R.quests.state('q4').st }; });
  ok('at level 6 q4 (lvl 9) is offered and accepted; its target marker is the Barrowlands POI', bs.av.includes('q4') && bs.a && bs.mk && bs.mk.kind === 'target' && bs.mk.x === -600 && bs.mk.y === 800, JSON.stringify({ av: bs.av, a: bs.a, mk: bs.mk }));
  ok('boss quest: phase p2 does nothing, "dead" counts once, the kill event of the same boss right after is not counted twice', bs.n0 === 0 && bs.n1 === 1 && bs.n2 === 1, JSON.stringify(bs));

  // 8. the arrow: the hero at (0,0), q5 done → its giver the hunter at (−200,500): screen angle atan2(500,−200) + 90 = 202° with the plain
  //    camera; the 3D camera's pitch may bend it a little, so ±15°
  const ar = await ev(() => { R.quests.track('q5'); R.player.x = 0; R.player.y = 0; if ('yaw' in R.cam) R.cam.yaw = 0; R.cam.x = 0; R.cam.y = 0; R.quests.refresh(); const a = document.querySelector('.qt-card .qt-arrow'); return { tf: a.style.transform, op: a.style.opacity, txt: document.querySelector('.qt-card').textContent.replace(/\s+/g, ' ').trim() }; });
  const deg = +((/rotate\((-?\d+)deg\)/.exec(ar.tf) || [0, NaN])[1]);
  ok('TRACK q5 → the tracker shows it ("Return to Old Hunter"), the arrow points down-left at the hunter (−200,500): rotate(202deg ± 15)', /A Word for the Maester/.test(ar.txt) && /Return to Old Hunter/.test(ar.txt) && Math.abs(deg - 202) <= 15 && ar.op === '1', JSON.stringify(ar));

  // 9. the log opens from the tracker card by a real tap; Main / Side tabs; TRACK; done ones folded; CLOSE
  const box = await page.locator('.qt-card').boundingBox();
  ok('the tracker card is a ≥ 44 px tap target', !!box && box.height >= 44 && box.width >= 44, JSON.stringify(box));
  await page.locator('.qt-card').tap({ force: true }); await page.waitForTimeout(150);
  const lg = await ev(() => ({ cur: R.ui.cur, tabs: [...document.querySelectorAll('.ql-tab')].map(b => b.textContent.trim()), on: document.querySelector('.ql-tab.on') && document.querySelector('.ql-tab.on').dataset.tab, cards: [...document.querySelectorAll('.ql-list .ql-q')].map(d => d.dataset.id), folded: document.querySelector('.ql-done') && !document.querySelector('.ql-done').open && document.querySelectorAll('.ql-done .ql-q').length, pri: document.querySelectorAll('#screen button.pri').length }));
  ok('tap on the card opens the quest log on the Side tab (q5 tracked): q3/q4/q5 listed, done ones folded', lg.cur === 'quests' && lg.tabs.length === 2 && lg.on === 'side' && lg.cards.length === 3 && lg.cards.includes('q4') && lg.cards.includes('q5') && lg.pri === 1, JSON.stringify(lg));
  await page.screenshot({ path: SC + 'rpg_quests_log_side.png' });
  await page.locator('.ql-tab[data-tab=main]').tap({ force: true }); await page.waitForTimeout(100);
  const lm = await ev(() => ({ cards: document.querySelectorAll('.ql-list .ql-q').length, empty: !!document.querySelector('.ql-empty'), done: document.querySelectorAll('.ql-done .ql-q').length, open: document.querySelector('.ql-done').open, rw: [...document.querySelectorAll('.ql-done .ql-rw')].length }));
  ok('Main tab: no open main quest, the two turned ones folded under Completed (2)', lm.cards === 0 && lm.empty && lm.done === 2 && !lm.open, JSON.stringify(lm));
  await page.locator('.ql-done summary').tap({ force: true }); await page.waitForTimeout(100);
  ok('Completed unfolds on tap', await ev(() => document.querySelector('.ql-done').open));
  await page.screenshot({ path: SC + 'rpg_quests_log_main.png' });
  await page.locator('.ql-tab[data-tab=side]').tap({ force: true }); await page.waitForTimeout(100);
  const rw = await ev(() => { const c = document.querySelector('.ql-q[data-id=q4]'); return { rw: [...c.querySelectorAll('.rw')].map(x => x.textContent.trim()), bar: c.querySelector('.ql-bar span').textContent, btn: c.querySelector('.ql-track').textContent }; });
  ok('q4 card: reward row 300 XP / 120 gold / 10 gems, bar "Defeat Barrow King 1/2", button TRACK', rw.rw.join('|') === '300 XP|120|10' && rw.bar === 'Defeat Barrow King 1/2' && rw.btn === 'TRACK', JSON.stringify(rw));
  await page.locator('.ql-q[data-id=q4] .ql-track').tap({ force: true }); await page.waitForTimeout(100);
  const tk = await ev(() => ({ track: (R.acc ? R.acc().world.flags : R.state.p.flags).track, btn: document.querySelector('.ql-q[data-id=q4] .ql-track').textContent, cls: document.querySelector('.ql-q[data-id=q4]').classList.contains('tracked'), other: document.querySelector('.ql-q[data-id=q5] .ql-track').textContent }));
  ok('TRACK on q4 sets flags.track, the button reads TRACKED, q5 is plain TRACK again', tk.track === 'q4' && tk.btn === 'TRACKED' && tk.cls && tk.other === 'TRACK', JSON.stringify(tk));
  await page.locator('.ql-close').tap({ force: true }); await page.waitForTimeout(150);
  const cl = await ev(() => ({ cur: R.ui.cur, paused: !!R.paused, txt: document.querySelector('.qt-card').textContent.replace(/\s+/g, ' ').trim() }));
  ok('CLOSE shuts the log; the tracker now follows q4 ("Defeat Barrow King 1/2")', cl.cur === null && !cl.paused && /The Thing in the Barrow/.test(cl.txt) && /Defeat Barrow King 1\/2/.test(cl.txt), JSON.stringify(cl));

  // 10. the save carries the quest states; R.load brings them back
  const sv = await ev(() => { R.save(true); const s = JSON.parse(localStorage.getItem('holdor_rpg')); const q = (s.acc && s.acc.world && s.acc.world.quests) || s.p.quests; return { q1: q.q1 && q.q1.st, q4: q.q4 && q.q4.st, track: ((s.acc && s.acc.world && s.acc.world.flags) || s.p.flags).track }; });
  ok('the save holds q1 turned, q4 open and track = q4', sv.q1 === 'turned' && sv.q4 === 'open' && sv.track === 'q4', JSON.stringify(sv));

  // 11. the dialog event at a giver: without a dialog screen the npc hands over by himself (turn-in q3, it is done); with one (A20) nothing moves here
  const dg = await ev(() => { const has = !!R.screens.dialog; const g0 = R.state.p.gold; const e0 = window.__gold; R.bus.emit('dialog', 'hunter'); return { has, st: R.quests.state('q3').st, st5: R.quests.state('q5').st, dg: R.state.p.gold - g0, ev: window.__gold - e0 }; });
  ok(dg.has ? 'dialog(hunter) with a dialog screen present: the quest engine leaves the turn-ins to it (q3 + q5 stay done)' : 'dialog(hunter) with no dialog screen: his two done quests q3 + q5 are turned in by themselves, +15 +5 gold', dg.has ? dg.st === 'done' && dg.st5 === 'done' && dg.dg === 0 : dg.st === 'turned' && dg.st5 === 'turned' && (dg.dg === 20 || dg.ev === 20), JSON.stringify(dg));

  // 12. no data module: an empty list, nothing throws
  const nd = await ev(() => { const keep = R.data.quests; R.data.quests = undefined; const r = { av: R.quests.available().length, mk: R.quests.markers().length, tr: R.quests.tracked(), a: R.quests.accept('q1') }; R.quests.refresh(); r.card = document.querySelector('.qt-card').classList.contains('on'); R.data.quests = keep; R.quests.refresh(); return r; });
  ok('without R.data.quests everything returns empty and the tracker hides', nd.av === 0 && nd.mk === 0 && nd.tr === null && nd.a === false && !nd.card, JSON.stringify(nd));

  console.log(JSON.stringify(T, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(T).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
