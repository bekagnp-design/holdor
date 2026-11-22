// t_quests (G7): the main story chain end to end on the INTEGRATED build, for a Stark and a Martell account.
//   fresh hero at the house seat → the tracker names a real NPC (no 'Seat:' placeholders) → walk to the steward → the INTERACT pill →
//   a real tap opens the dialog with the story's offer lines → ACCEPT → the tracker counts the kills, a target marker exists →
//   six kills with R.hit → done → COMPLETE at the steward pays XP + gold → m02 is offered next and names the seat's maester.
// Run: python3 src/build_rpg.py $F && RPG_HTML=$F RPG_NOBUILD=1 CHROMIUM_PATH=… node tests/rpg/t_quests.js   (shots: .shots/rpg/quests_*.png)
'use strict';
const L = require('./lib');
(async () => {
  L.build();
  for (const house of ['stark', 'martell']) {
    const { page, errors, close } = await L.launch();
    // flags: the North carries the Neck gate; until G2's 10_world fix ("home region never gated") lands, open it so a Stark is not pushed south
    const b = await L.boot(page, { save: L.fakeSave({ house, lvl: 1, flags: { 'gate:north': 1 } }) });
    L.ok(house + ': booted into the world', b.running && !!b.player, JSON.stringify({ running: b.running, cur: b.cur }));
    const seat = await L.ev(page, () => { if (R.ui.cur) R.ui.close(); R.player.hp = R.player.hpMax = 1e7; for (let i = 0; i < 90; i++) R.step();
      const h = R.state.acc.house, sid = R.story.seatOf(h), seat = R.data.world.poiById[sid], q = R.quests.tracked(), card = document.getElementById('qtcard');
      return { sid, d: Math.round(Math.hypot(R.player.x - seat.x, R.player.y - seat.y)), q: q && q.id, giver: q && q.giver, title: card && card.querySelector('.qt-title').textContent,
        line: card && card.querySelector('.qt-line').textContent, npcs: R.npcs.at(sid).map(e => e.dialog) }; });
    L.ok(house + ': the hero starts at the seat, m01 is tracked', seat.q === 'm01' && seat.d < 400, JSON.stringify(seat));
    L.ok(house + ': the tracker names a real NPC, no placeholder', /^Speak with /.test(seat.line) && !/seat|Seat:|\{/.test(seat.line) && seat.title === 'Dead at the gate', seat.line);
    L.ok(house + ': the seat NPCs are spawned, the giver among them, no doubles', seat.npcs.includes(seat.giver) && new Set(seat.npcs).size === seat.npcs.length && seat.npcs.length >= 6, seat.npcs.join());
    // walk up to the steward: the INTERACT pill appears, a real tap opens the dialog
    const near = await L.ev(page, gid => { const e = R.npcs.list().find(n => n.dialog === gid); R.player.x = e.x + 22; R.player.y = e.y + 6; for (let i = 0; i < 20; i++) R.step();
      const I = R.input.interact, pill = document.getElementById('b-interact'), r = pill && pill.getBoundingClientRect();
      return { on: !!(I && I.e === e), label: I && I.label, vis: !!(r && r.width > 30 && getComputedStyle(pill).display !== 'none'), mark: e.mark }; }, seat.giver);
    L.ok(house + ': next to the giver the INTERACT pill shows, the NPC wears a !', near.on && near.vis && near.mark === '!', JSON.stringify(near));
    await L.tap(page, '#b-interact'); await L.steps(page, 2);
    const dl = await L.ev(page, () => ({ cur: R.ui.cur, name: (document.querySelector('.dlg-name') || {}).textContent, full: R.screens.dialog.state && R.screens.dialog.state.pages.join(' ') }));
    L.ok(house + ': a tap on the pill opens the dialog with the story offer', dl.cur === 'dialog' && /dead/i.test(dl.full || '') && !/\{|\[object/.test(dl.full || ''), JSON.stringify(dl).slice(0, 220));
    for (let i = 0; i < 5 && !(await L.has(page, 'document.querySelector(".dlg-acc")')); i++) await L.tap(page, '.dlg-txt', { wait: 120 });
    await L.shot(page, 'quests_dialog_' + house);
    L.ok(house + ': ACCEPT is shown for m01', await L.has(page, 'document.querySelector(\'.dlg-q[data-quest="m01"] .dlg-acc\')'));
    await L.tap(page, '.dlg-acc', { wait: 300 });
    const tr = await L.ev(page, () => { for (let i = 0; i < 12; i++) R.step(); R.quests.refresh(); const s = R.quests.state('m01'), q = R.quests.get('m01'), c = document.getElementById('qtcard');
      return { st: s && s.st, cur: R.ui.cur, mob: q.target.mob, line: c.querySelector('.qt-line').textContent, mk: R.quests.markers().filter(m => m.id === 'm01').map(m => m.kind),
        spawnable: (R.data.world.spawnsByRegion[R.data.world.poiById[q.poi].region].mobs || []).some(m => m.type === q.target.mob) }; });
    L.ok(house + ': accepted, the dialog closed, the tracker counts kills', tr.st === 'open' && tr.cur === null && / 0\/6$/.test(tr.line), JSON.stringify(tr));
    L.ok(house + ': the kill target spawns in the seat region; a target marker exists', tr.spawnable && tr.mk.includes('target'), JSON.stringify(tr));
    await L.shot(page, 'quests_tracker_' + house);
    const kl = await L.ev(page, mob => { const out = []; for (let i = 0; i < 6; i++) { const lv = 1, x = R.player.x + 60 + i * 8, y = R.player.y + 40;
        const m = R.mobs && R.mobs.spawn ? R.mobs.spawn(mob, lv, x, y) : R.spawn({ kind: 'mob', team: 1, type: mob, x, y, hp: 10, hpMax: 10, lvl: lv });
        R.hit(R.player, m, 1e6, { kind: 'phys' }); for (let k = 0; k < 3; k++) R.step(); if (!m.dead && R.kill) R.kill(m, R.player); out.push(!!m.dead); }
      for (let i = 0; i < 6; i++) R.step(); const s = R.quests.state('m01'); return { dead: out, st: s.st, n: s.n, line: document.querySelector('#qtcard .qt-line').textContent }; }, tr.mob);
    L.ok(house + ': six kills with R.hit → m01 done, "Return to …"', kl.st === 'done' && kl.n === 6 && /^Return to /.test(kl.line), JSON.stringify(kl));
    const before = await L.ev(page, () => ({ xp: R.state.p.xp, lvl: R.state.p.lvl, gold: R.state.p.gold }));
    await L.ev(page, gid => { const e = R.npcs.list().find(n => n.dialog === gid); R.player.x = e.x + 22; R.player.y = e.y + 6; for (let i = 0; i < 20; i++) R.step(); }, seat.giver);
    await L.tap(page, '#b-interact'); await L.steps(page, 2);
    for (let i = 0; i < 5 && !(await L.has(page, 'document.querySelector(".dlg-done")')); i++) await L.tap(page, '.dlg-txt', { wait: 120 });
    L.ok(house + ': back at the giver: COMPLETE for m01', await L.has(page, 'document.querySelector(\'.dlg-q[data-quest="m01"] .dlg-done\')'));
    await L.tap(page, '.dlg-done', { wait: 300 });
    const tu = await L.ev(page, () => { for (let i = 0; i < 12; i++) R.step(); R.quests.refresh(); const q2 = R.quests.get('m02'), t = R.quests.tracked();
      return { st: R.quests.state('m01').st, xp: R.state.p.xp, lvl: R.state.p.lvl, gold: R.state.p.gold, m02: (R.quests.state('m02') || {}).st, tracked: t && t.id,
        target: q2.target.npc, tnpc: !!R.npcs.data(q2.target.npc), line: document.querySelector('#qtcard .qt-line').textContent, title: document.querySelector('#qtcard .qt-title').textContent }; });
    L.ok(house + ': turned in: XP and gold paid', tu.st === 'turned' && (tu.lvl > before.lvl || tu.xp > before.xp) && tu.gold > before.gold, JSON.stringify([before, tu]));
    L.ok(house + ': m02 comes next from the same giver: handed over at once, tracked, "Talk to" the seat maester',
      tu.m02 === 'open' && tu.tracked === 'm02' && tu.tnpc && /maester/.test(tu.target) && /^Talk to Maester /.test(tu.line), JSON.stringify(tu));
    const errs = (await L.gameErrors(page)).concat(errors);
    L.ok(house + ': no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await close();
  }
  L.report();
})().catch(e => { console.error('FAIL crash', e); process.exit(1); });
