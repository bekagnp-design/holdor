// A28: the tutorial — eight steps driven by real play, the coach card, the ring, the fallback when a module is absent, SKIP by a real tap, the save.
// Run: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_tutorial.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const RES = {}; const ok = (k, v, info) => { RES[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  p.on('pageerror', e => errors.push('PE:' + e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await p.waitForFunction(() => window.R && R.sys && R.sys.tutorial && R.tut, { timeout: 20000 }); await p.waitForTimeout(300);
  // a fresh save with flags.tut undefined, a player entity, a fake R.spawnMob when the mob module is absent; the loop is stopped, we step by hand
  await p.evaluate(() => { R.stop && R.stop(); try { if (R.ui && R.ui.cur) R.ui.close(); } catch (e) {}
    const s = R.newState ? R.newState() : { v: 1, p: {}, opts: {} }; s.p = Object.assign({ house: 'stark', cls: 'knight', lvl: 1, inv: [], gear: {}, bar: [null, null, null] }, s.p);
    const fl = s.acc && s.acc.world ? (s.acc.world.flags = s.acc.world.flags || {}) : (s.p.flags = s.p.flags || {}); delete fl.tut; delete fl.tutBlade; R.state = s;
    for (const e of R.ents.slice()) if (e.kind === 'mob') R.remove(e);
    if (!R.player) R.player = R.spawn({ kind: 'player', team: 0, hp: 100, hpMax: 100, lvl: 1, name: 'Test' }); R.player.dead = false; R.player.x = 3000; R.player.y = 6000;
    if (!R.spawnMob) R.spawnMob = (type, x, y, lvl) => R.spawn({ kind: 'mob', type, x, y, lvl, hp: 10, hpMax: 10, team: 1 });
    // the open world around the test spot has real mobs (and a boss): the hero stays alive, so only the tutorial decides what happens
    const keep = () => { const pl = R.player; if (pl) { pl.dead = false; pl.hp = pl.hpMax || 100; } }; R.addSys('t_alive0', { order: -9999, update: keep }); R.addSys('t_alive1', { order: 9999, update: keep });
    R.paused = false; R.step(); });
  const step = n => p.evaluate(n => { for (let i = 0; i < n; i++) R.step(); }, n);
  const txt = () => p.evaluate(() => { const e = document.querySelector('#tut .tut-txt'); return e ? e.textContent : null; });
  const tut = () => p.evaluate(() => { const s = R.state; const f = s.acc && s.acc.world ? s.acc.world.flags : s.p.flags; return f ? f.tut : undefined; });
  const card = () => p.evaluate(() => !!document.getElementById('tut'));
  const STEPS = await p.evaluate(() => R.tut.STEPS.map(s => s.txt));
  ok('8 distinct step texts', STEPS.length === 8 && new Set(STEPS).size === 8 && STEPS.every(t => t && t.length <= 90), JSON.stringify(STEPS.map(t => t.length)));
  ok('the card shows step 1', (await txt()) === STEPS[0], await txt());
  ok('the coach line names the step 1/8', await p.evaluate(() => /1\/8/.test(document.querySelector('#tut .tut-who').textContent)));
  ok('the ring is shown for step 1 (joystick zone)', await p.evaluate(() => { const r = document.querySelector('#tut .tut-ring'); return r && r.style.display === 'block'; }));
  ok('the SKIP link is there and tall enough', await p.evaluate(() => { const b = document.querySelector('#tut .tut-skip').getBoundingClientRect(); return b.height >= 44 && /SKIP/.test(document.querySelector('#tut .tut-skip').textContent); }));
  ok('the flag starts unset / 0', [0, undefined].includes(await tut()));
  // 1 move: the player 200 units away + one step completes it
  await p.evaluate(() => { R.player.x += 200; R.step(); });
  ok('step 1 completes on 200 units moved (check mark)', await p.evaluate(() => document.querySelector('#tut .tut-card').classList.contains('ok')));
  await step(60);
  ok('step 2 text', (await txt()) === STEPS[1], await txt()); ok('flag 1 after step 1', (await tut()) === 1);
  ok('three wights spawned about 200 units away', await p.evaluate(() => { const m = R.ents.filter(e => e.kind === 'mob' && e.tut && !e.dead); return m.length === 3 && m.every(x => Math.abs(Math.hypot(x.x - R.player.x, x.y - R.player.y) - 200) < 60); }));
  // 2 attack: all three dead
  await p.evaluate(() => { R.ents.filter(e => e.kind === 'mob' && e.tut).forEach(m => R.kill(m)); }); await step(60);
  ok('step 3 text after the three kills', (await txt()) === STEPS[2], await txt()); ok('flag 2', (await tut()) === 2);
  // 3 loot
  await p.evaluate(() => R.bus.emit('loot', { id: 'x', kind: 'mat', name: 'Bone' })); await step(60);
  ok('step 4 text after loot', (await txt()) === STEPS[3], await txt()); ok('flag 3', (await tut()) === 3);
  // 4 skill: the skill1 button
  await p.evaluate(() => R.bus.emit('btn', 'skill1')); await step(60);
  ok('step 5 text after skill1', (await txt()) === STEPS[4], await txt()); ok('flag 4', (await tut()) === 4);
  // 5 dodge
  await p.evaluate(() => R.bus.emit('btn', 'dodge')); await step(60);
  ok('step 6 text after dodge', (await txt()) === STEPS[5], await txt()); ok('flag 5', (await tut()) === 5);
  // 6 quest: the dialog opens
  await p.evaluate(() => R.bus.emit('dialog', 'maester')); await step(60);
  ok('step 7 text after the dialog', (await txt()) === STEPS[6], await txt()); ok('flag 6', (await tut()) === 6);
  ok('a Common blade was put in the bag', await p.evaluate(() => (R.state.p.inv || []).some(i => i && i.kind === 'weapon' && i.rar === 0)));
  // 7 equip
  await p.evaluate(() => { const it = (R.state.p.inv || []).find(i => i && i.kind === 'weapon'); R.state.p.gear = R.state.p.gear || {}; R.state.p.gear.weapon = it; }); await step(60);
  ok('step 8 text after the equip', (await txt()) === STEPS[7], await txt()); ok('flag 7', (await tut()) === 7);
  // 8 ends by itself after 3 s
  await step(150); ok('the last card stays before 3 s', await card());
  await step(60); ok('the tutorial ends after 3 s: card gone, flag 8', !(await card()) && (await tut()) === 8, 'flag=' + (await tut()));
  await p.waitForTimeout(1200);   // R.save is debounced 800 ms
  ok('flag 8 persisted in localStorage', await p.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('holdor_rpg')); const f = s.acc && s.acc.world ? s.acc.world.flags : s.p.flags; return f.tut === 8; } catch (e) { return false; } }));
  ok('a finished tutorial does not come back', await p.evaluate(() => { for (let i = 0; i < 30; i++) R.step(); return !document.getElementById('tut'); }));
  // a step whose module is absent completes by itself after 6 s (step 6 without the dialog screen); it resumes from the saved index
  await p.evaluate(() => { R.tut.reset(); const s = R.state; const f = s.acc && s.acc.world ? s.acc.world.flags : s.p.flags; f.tut = 5; window.__dlg = R.screens.dialog; delete R.screens.dialog; R.step(); });
  ok('resumes at step 6 from the saved index', (await txt()) === STEPS[5], await txt());
  await step(330); ok('still step 6 before 6 s', (await txt()) === STEPS[5], await txt());
  await step(90); ok('step 7 by itself after 6 s without the dialog module', (await txt()) === STEPS[6], await txt());
  await p.evaluate(() => { if (window.__dlg) R.screens.dialog = window.__dlg; });
  // SKIP by a real tap
  await p.evaluate(() => { for (const e of R.ents.slice()) if (e.kind === 'mob') R.remove(e); R.player.dead = false; R.player.hp = R.player.hpMax || 100; R.tut.reset(); R.step(); });
  ok('reset shows step 1 again', (await txt()) === STEPS[0], await txt());
  const sk = await p.evaluate(() => { const b = document.querySelector('#tut .tut-skip'); if (!b) return null; const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, t: b.textContent }; });
  ok('SKIP is small (one word, ≥ 44 px tall)', sk && sk.h >= 44 && sk.w <= 90 && sk.t === 'SKIP', JSON.stringify(sk));
  await p.tap('#tut .tut-skip', { force: true, timeout: 5000 }).catch(e => ok('SKIP tap', false, e.message.split('\n')[0])); await p.waitForTimeout(100);
  ok('SKIP ends it: card gone, flag 8', !(await card()) && (await tut()) === 8, 'flag=' + (await tut()));
  await step(30); ok('no card after the skip', !(await card()));
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(RES, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(RES).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
