// RPG A20: NPC entities + the dialog sheet. spawnFor rings NPCs round a POI; the system keeps the nearest two POIs spawned;
// interact opens the bottom sheet; the text types at 40 chars/s and a tap completes it; ACCEPT → R.quests.accept + close;
// COMPLETE → R.quests.turnIn; inn → R.ui.open('inn', poi); LEAVE closes and the game resumes; idle bubbles; billboard frames.
// Run: python3 src/build_rpg.py <out.html> && HOLDOR_HTML=<out.html> CHROMIUM_PATH=... node tests/rpg/t_dialog.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/.test(m.text())) errors.push('C:' + m.text()); });
  await page.route(/^https?:\/\//, r => r.abort());   // no network: the Telegram SDK include fails fast
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.npcs && R.screens && R.screens.dialog, { timeout: 20000 });
  const OUT = {}; let fails = 0; const ok = (k, v, info) => { OUT[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); if (!v) fails++; };
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // ---- fake world / npcs / quests / story (only what is absent) and a player at Winterfell ----
  await ev(() => {
    R.data.world = R.data.world || {}; if (!R.data.world.pois) R.data.world.pois = [
      { id: 'winterfell', name: 'Winterfell', x: 3000, y: 4000, kind: 'castle' }, { id: 'wintertown', name: 'Winter Town', x: 3300, y: 4100, kind: 'town' },
      { id: 'far', name: 'Far Camp', x: 6000, y: 11000, kind: 'camp' }];
    if (!R.data.npcs) R.data.npcs = {
      maester_luwin: { name: 'Maester Luwin', kind: 'maester', poi: 'winterfell', lines: { greet: ['Hm. You are late, but you are here.'], idle: ['The ravens brought grim news.', 'Read, if you can.'] } },
      gatekeeper: { name: 'Gate Guard', kind: 'guard', poi: 'winterfell', lines: { greet: 'State your business.' } },
      jon_npc: { name: 'Jon', kind: 'champion', champ: 'jon', poi: 'winterfell', lines: { greet: 'Stay close.' } },
      innkeep: { name: 'Mord', kind: 'innkeeper', poi: 'wintertown', lines: { greet: 'Warm beds, hot stew.' } },
      far_scout: { name: 'Scout', kind: 'ranger', poi: 'far' } };
    if (!R.data.quests) R.data.quests = { q1: { id: 'q1', title: 'Wolves at the gate', giver: 'maester_luwin', reward: { gold: 120, xp: 80, item: 'iron_sword' } } };
    R.data.story = R.data.story || {}; R.data.story.dialogs = R.data.story.dialogs || {};
    window.__calls = []; if (!R.quests) R.quests = { accept(id) { window.__calls.push('accept:' + id); const Q = R.npcs.qstate(); Q[id] = { st: 'open', n: 0 }; return true; }, turnIn(id) { window.__calls.push('turnin:' + id); R.npcs.qstate()[id].st = 'turned'; return true; } };
    if (!R.screens.inn) R.screens.inn = { open(arg, el) { window.__inn = arg; el.innerHTML = '<div id="fake-inn">INN</div>'; }, close() {} };
    R.state = R.newState(); R.state.p.name = 'Tester'; if (R.state.acc) R.state.acc.house = 'stark'; else R.state.p.house = 'stark';
    R.player = R.player || R.spawn({ kind: 'player', team: 0, x: 3000, y: 4000, hp: 200, name: 'Tester', lvl: 3 }); R.player.x = 3000; R.player.y = 4000; R.state.p.lvl = 3;
    R.cam.x = 3000; R.cam.y = 4000; R.cam.z = 1; R.start();
    for (let i = 0; i < 40; i++) R.step();
  });
  const sp = await ev(() => { const N = R.ents.filter(e => e.kind === 'npc' && !e.dead); const P = R.data.world.pois;
    const ring = N.map(e => { const p = P.find(p => p.id === e.poi); return Math.round(Math.hypot(e.x - p.x, e.y - p.y)); });
    const pos1 = R.npcs.at('winterfell').map(e => [Math.round(e.x), Math.round(e.y)]).join(';'); R.npcs.despawnFor('winterfell'); const again = R.npcs.spawnFor('winterfell'); const pos2 = again.map(e => [Math.round(e.x), Math.round(e.y)]).join(';');
    const j = again.find(e => e.dialog === 'jon_npc'), m = again.find(e => e.dialog === 'maester_luwin'); const fr = m.frame('idle', 0.3, -1);
    return { n: N.length, pois: [...new Set(N.map(e => e.poi))].sort(), ring, team: N.every(e => e.team === 2), same: pos1 === pos2, types: N.map(e => e.type).sort(), jonType: j && j.type, hasFrame: !!m.frame && !j.frame,
      frame: fr && fr.width === 128 && fr.height === 128 && fr.anchor && fr.anchor.y > 0.9 && fr === m.frame('idle', 0.3, -1), tag: m.name, rk: m.rkind }; });
  ok('spawnFor: 4 NPCs for the nearest 2 POIs (far camp left out)', sp.n === 4 && sp.pois.join() === 'winterfell,wintertown', JSON.stringify(sp.pois) + ' n=' + sp.n);
  ok('ring 40–90 units round the POI centre', sp.ring.every(r => r >= 39 && r <= 91), JSON.stringify(sp.ring));
  ok('deterministic positions, team 2, type = sprite key', sp.same && sp.team && sp.jonType === 'champ:jon' && sp.types.includes('npc:maester') && sp.rk === 'maester', JSON.stringify(sp.types));
  ok('e.frame(anim,t,face) → cached 128×128 canvas for npc:<kind>, none for champions', sp.hasFrame && sp.frame);
  const ds = await ev(() => { R.npcs.spawnFor('far'); const a = R.npcs.at('far').length; for (let i = 0; i < 40; i++) R.step(); return { a, b: R.npcs.at('far').length, alive: R.ents.filter(e => e.kind === 'npc' && !e.dead && e.poi === 'far').length }; });
  ok('a third POI spawned by hand is despawned by the system', ds.a === 1 && ds.b === 0 && ds.alive === 0, JSON.stringify(ds));

  // ---- interact → the sheet opens, paused, text types ----
  const op = await ev(() => { const m = R.npcs.at('winterfell').find(e => e.dialog === 'maester_luwin'); const t0 = R.t; R.bus.emit('interact', m); const st = R.screens.dialog.state;
    return { cur: R.ui.cur, paused: R.paused, on: document.getElementById('screen').classList.contains('on'), name: document.querySelector('.dlg-name').textContent, role: document.querySelector('.dlg-role').textContent,
      typing: st.typing, shown: st.shown.length, full: st.full, choicesOn: document.querySelector('.dlg-ch').classList.contains('on'), t0 }; });
  ok('interact opens the dialog sheet and pauses', op.cur === 'dialog' && op.paused === true && op.on && op.name === 'Maester Luwin' && /Maester/.test(op.role) && /Winterfell/.test(op.role), JSON.stringify([op.cur, op.paused, op.name, op.role]));
  ok('generic greet + the NPC greet line, templated', /Tester|traveller/.test(op.full) && /Winterfell/.test(op.full) && /late, but you are here/.test(op.full), op.full);
  await page.waitForTimeout(260);
  const ty = await ev(() => { const st = R.screens.dialog.state; return { typing: st.typing, shown: st.shown.length, full: st.full.length, dom: document.querySelector('.dlg-t').textContent.length, t: R.t, choicesOn: document.querySelector('.dlg-ch').classList.contains('on') }; });
  ok('text types at ~40 chars/s (after 260 ms: 6–16 chars), choices hidden meanwhile', ty.typing && ty.shown >= 6 && ty.shown <= 16 && ty.dom === ty.shown && !ty.choicesOn, JSON.stringify(ty));
  ok('the game clock stands still while the sheet is open', Math.abs(ty.t - op.t0) < 1e-6, op.t0 + ' → ' + ty.t);
  await page.screenshot({ path: SC + 'rpg_dialog_typing.png' });
  await page.tap('.dlg-txt');
  const tp = await ev(() => { const st = R.screens.dialog.state; const b = document.querySelector('.dlg-acc'); const r = b && b.getBoundingClientRect();
    return { typing: st.typing, done: st.done, complete: st.shown === st.full, choicesOn: document.querySelector('.dlg-ch').classList.contains('on'), acc: b && b.textContent, pri: b && b.classList.contains('pri'), h: r && r.height,
      title: (document.querySelector('.dlg-qt') || {}).textContent, chips: [...document.querySelectorAll('.chip')].map(c => c.textContent), leave: (document.querySelector('.dlg-leave') || {}).textContent, leavePri: document.querySelector('.dlg-leave').classList.contains('pri') }; });
  ok('a tap completes the text and shows the choices', !tp.typing && tp.done && tp.complete && tp.choicesOn);
  ok('quest offer: title + reward chips + ACCEPT primary ≥ 52 px; LEAVE secondary', tp.acc === 'ACCEPT' && tp.pri && tp.h >= 52 && /Wolves at the gate/.test(tp.title) && tp.chips.join() === '+120 gold,+80 XP,iron sword' && tp.leave === 'LEAVE' && !tp.leavePri, JSON.stringify(tp));
  await page.waitForTimeout(300); await page.screenshot({ path: SC + 'rpg_dialog.png' });
  await page.tap('.dlg-acc');
  await page.waitForTimeout(350);
  const ac = await ev(() => ({ calls: window.__calls.slice(), cur: R.ui.cur, paused: R.paused, st: (R.npcs.qstate().q1 || {}).st, on: document.getElementById('screen').classList.contains('on'), toast: !!document.querySelector('.toast'), t: R.t }));
  ok('ACCEPT calls R.quests.accept and closes; the game resumes', ac.calls.join() === 'accept:q1' && ac.cur === null && ac.paused === false && ac.st === 'open' && !ac.on && ac.toast, JSON.stringify(ac));
  await page.waitForTimeout(300);
  const run = await ev(() => R.t);
  ok('the clock runs again after close', run > ac.t + 0.1, ac.t + ' → ' + run);

  // ---- second visit: no offer, LEAVE is the one primary; a tap outside the sheet leaves too ----
  const v2 = await ev(() => { const m = R.npcs.at('winterfell').find(e => e.dialog === 'maester_luwin'); R.bus.emit('interact', m); R.screens.dialog.tap();
    return { offers: document.querySelectorAll('.dlg-acc').length, leavePri: document.querySelector('.dlg-leave').classList.contains('pri'), mark: m.mark }; });
  ok('second visit: no offer, LEAVE is the primary', v2.offers === 0 && v2.leavePri, JSON.stringify(v2));
  await page.tap('.dlg-leave');
  const lv = await ev(() => ({ cur: R.ui.cur, paused: R.paused }));
  ok('LEAVE closes and resumes', lv.cur === null && lv.paused === false, JSON.stringify(lv));
  await ev(() => { const g = R.npcs.at('winterfell').find(e => e.dialog === 'gatekeeper'); R.bus.emit('interact', g); });
  await page.tap('#screen', { position: { x: 195, y: 80 } });
  ok('a tap on the darkened world above the sheet leaves', await ev(() => R.ui.cur === null));

  // ---- turn-in: COMPLETE → R.quests.turnIn ----
  const ti = await ev(() => { R.npcs.qstate().q1.st = 'done'; for (let i = 0; i < 31; i++) R.step(); const m = R.npcs.at('winterfell').find(e => e.dialog === 'maester_luwin'); const mark = m.mark; R.bus.emit('interact', m); R.screens.dialog.tap();
    const b = document.querySelector('.dlg-done'); return { mark, btn: b && b.textContent, pri: b && b.classList.contains('pri'), turnin: !!document.querySelector('.dlg-q.turnin') }; });
  ok('turn-in ready: ? mark over the NPC, COMPLETE primary', ti.mark === '?' && ti.btn === 'COMPLETE' && ti.pri && ti.turnin, JSON.stringify(ti));
  await page.tap('.dlg-done');
  const td = await ev(() => ({ calls: window.__calls.slice(), cur: R.ui.cur, st: R.npcs.qstate().q1.st }));
  ok('COMPLETE calls R.quests.turnIn and closes', td.calls.join() === 'accept:q1,turnin:q1' && td.cur === null && td.st === 'turned', JSON.stringify(td));

  // ---- services: an innkeeper offers REST → R.ui.open('inn', poi) ----
  await ev(() => { const k = R.npcs.at('wintertown').find(e => e.dialog === 'innkeep'); R.bus.emit('interact', k); R.screens.dialog.tap(); });
  const sv = await ev(() => { const b = document.querySelector('button[data-act="inn"]'); return { txt: b && b.textContent, pri: b && b.classList.contains('pri') }; });
  ok('innkeeper: REST AT THE INN is the primary choice', sv.txt === 'REST AT THE INN' && sv.pri, JSON.stringify(sv));
  await page.tap('button[data-act="inn"]');
  const inn = await ev(() => ({ cur: R.ui.cur, poi: window.__inn && window.__inn.id, fake: !!document.getElementById('fake-inn') }));
  ok("inn choice opens R.screens.inn with the POI", inn.cur === 'inn' && inn.poi === 'wintertown' && inn.fake, JSON.stringify(inn));
  await ev(() => R.ui.close());

  // ---- story dialog: pages, a branch choice, a shop choice to a missing screen stays open with a toast ----
  await ev(() => { R.data.story.dialogs.gatekeeper = { text: ['Halt. {p}, is it?', 'Go on, then. Mind the ice.'], choices: [{ t: 'ASK ABOUT THE WOLVES', text: 'They came from the Wolfswood. Three nights running.' }, { t: 'BUY ARROWS', act: 'shop' }] };
    const g = R.npcs.at('winterfell').find(e => e.dialog === 'gatekeeper'); R.bus.emit('interact', g); });
  const pg = await ev(() => { const S = R.screens.dialog; S.tap(); const a = { p: S.state.page, more: S.el.classList.contains('more'), ch: document.querySelector('.dlg-ch').classList.contains('on'), txt: S.state.shown }; S.tap(); S.tap();
    const btns = [...document.querySelectorAll('.dlg-ch button')].map(b => b.textContent); return { a, p2: S.state.page, done: S.state.done, btns }; });
  ok('two pages: tap completes page 1 (more), tap → page 2, tap → choices', pg.a.p === 0 && pg.a.more && !pg.a.ch && /Tester/.test(pg.a.txt) && pg.p2 === 1 && pg.done && pg.btns.join('|') === 'ASK ABOUT THE WOLVES|BUY ARROWS|LEAVE', JSON.stringify(pg));
  await page.tap('button[data-act="say"]');
  const br = await ev(() => { const S = R.screens.dialog; S.tap(); return { txt: S.state.shown, btns: [...document.querySelectorAll('.dlg-ch button')].map(b => b.textContent) }; });
  ok('a branch choice shows its text, then LEAVE', /Wolfswood/.test(br.txt) && br.btns.join() === 'LEAVE', JSON.stringify(br));
  await ev(() => { R.ui.close(); const g = R.npcs.at('winterfell').find(e => e.dialog === 'gatekeeper'); R.bus.emit('interact', g); R.screens.dialog.tap(); R.screens.dialog.tap(); R.screens.dialog.tap(); });
  await page.tap('button[data-act="shop"]');
  const nos = await ev(() => ({ cur: R.ui.cur, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent) }));
  ok('a service whose screen is absent: stays in the dialog, toast', nos.cur === 'dialog' && nos.toasts.some(t => /closed/.test(t)), JSON.stringify(nos));
  await ev(() => R.ui.close());

  // ---- bubbles: within 120 units, one idle line every 8 s; name tags + marks draw on the overlay ----
  const bb = await ev(() => { const L = R.npcs.at('winterfell'); for (const e of L) { e.bubT = R.t + 0.2; e.bub = null; } const seen = {}; let firstAt = {}, secondAt = {};
    for (let i = 0; i < 60 * 10; i++) { R.step(); for (const e of L) if (e.bub) { seen[e.dialog] = e.bub.txt; if (firstAt[e.dialog] == null) firstAt[e.dialog] = R.t; else if (secondAt[e.dialog] == null && R.t > firstAt[e.dialog] + 4) secondAt[e.dialog] = R.t; } }
    const m = L.find(e => e.dialog === 'maester_luwin'); const gap = secondAt[m.dialog] - firstAt[m.dialog];
    let drew = true; try { R.npcs.drawBubbles(R.ctx); } catch (err) { drew = false; }
    const far = R.spawn({ kind: 'player', team: 0, x: 3000, y: 4000 }); R.remove(far);
    return { seen, gap: Math.round(gap * 10) / 10, drew, lines: Object.values(seen).every(s => typeof s === 'string' && s.length > 3) }; });
  ok('idle speech bubbles for NPCs near the player, 8 s apart', Object.keys(bb.seen).length === 3 && bb.gap >= 7.9 && bb.gap <= 8.2 && bb.drew && bb.lines, JSON.stringify(bb));
  const faraway = await ev(() => { R.player.x = 3000 + 500; R.player.y = 4000; const L = R.npcs.at('winterfell'); for (const e of L) { e.bub = null; e.bubT = R.t; } for (let i = 0; i < 60 * 3; i++) R.step(); return L.filter(e => e.bub).length; });
  ok('no bubbles beyond 120 units', faraway === 0, String(faraway));

  // ---- the player walks to the far camp: its NPCs spawn, Winterfell's go ----
  const mv = await ev(() => { R.player.x = 6000; R.player.y = 11000; for (let i = 0; i < 40; i++) R.step(); return { far: R.npcs.at('far').length, wf: R.npcs.at('winterfell').length, alive: R.ents.filter(e => e.kind === 'npc' && !e.dead).map(e => e.poi).sort() }; });
  ok('nearest-2 rule follows the player (Far Camp + Winter Town, Winterfell gone)', mv.far === 1 && mv.wf === 0 && mv.alive.join() === 'far,wintertown', JSON.stringify(mv));

  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  for (const k in OUT) console.log(OUT[k].startsWith('OK') ? 'OK   ' + k : 'FAIL ' + k + ' — ' + OUT[k].slice(5));
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL crash', e); process.exit(1); });
