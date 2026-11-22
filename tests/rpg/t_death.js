// A31 — permadeath: the death screen and the Hall of the Fallen. Build first: python3 src/build_rpg.py beta/index.html
// run: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_death.js
// Fakes the save (v2 shape), the player and the kills, so it runs with or without the other modules.
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; p.on('pageerror', e => errors.push('PE:' + e.message));
  const RES = {}; const ok = (k, v, info) => { RES[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await p.goto('file://' + path.resolve(ROOT, process.env.HOLDOR_HTML || 'beta/index.html'));
  await p.waitForFunction(() => window.R && R.screens && R.screens.death && R.bus && R.spawn && R.boot, { timeout: 20000 });   // after the boot door (it would replace the faked state)
  await p.waitForTimeout(300);
  const read = () => p.evaluate(() => {
    const q = s => document.querySelector(s); const vis = s => { const e = q(s); return !!e && !e.hidden && e.offsetParent !== null; };
    return { cur: R.ui.cur, paused: R.paused, shown: !!q('.dth.show'), fade: !!q('.dth-fade'), txt: (document.getElementById('screen').textContent || '').replace(/\s+/g, ' ').trim(),
      next: vis('.dth-next'), link: vis('.dth-halllink'), hall: R.state.acc.hall.map(e => ({ id: e.id, lvl: e.lvl, killer: e.killer, at: e.at })), best: R.state.acc.best, dead: R.player.dead };
  });
  // a hero who dies: a v2 save, the player entity, the run's kills through R.kill, then the 'death' event
  const die = async o => p.evaluate(o => {
    if (R.ui.cur) R.ui.close();
    R.state.p = Object.assign({ hero: 'jon', name: 'Jon', cls: 'knight', lvl: 12, xp: 0, hp: 300, gold: 340, gems: 2, pos: null, stats: {}, pts: 0, skills: {}, bar: [], gear: {}, inv: [], potions: {}, created: Date.now() - 754000, played: 754, flags: R.state.acc.world.flags }, o.p || {});
    R.player.dead = false; R.player.hp = 300; R.player.type = R.state.p.hero; R.player.name = R.state.p.name;
    for (let i = 0; i < (o.kills || 0); i++) R.kill(R.spawn({ kind: 'mob', type: 'axe', hp: 1, x: 10, y: 10 }));
    for (let i = 0; i < (o.bosses || 0); i++) R.kill(R.spawn({ kind: 'boss', type: 'nightking', hp: 1, x: 10, y: 10 }));
    R.player.dead = true; R.player.hp = 0; R.player.lastHitBy = o.killer;
    R.bus.emit('death');
  }, o);
  await p.evaluate(() => {
    try { R.stop && R.stop(); } catch (e) {}
    if (R.ui.cur) R.ui.close();
    R.state = { v: 2, acc: { house: 'stark', champs: { jon: { unlocked: 1, runs: 1 }, arya: { unlocked: 1, runs: 0 }, robb: { unlocked: 0 } }, hall: [], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: { lvl: 0, kills: 0 } }, p: {}, wallet: { imported: true }, opts: { sfx: 1, haptic: 1, lang: 'en' } };
    R.ents.length = 0;
    R.player = R.spawn({ kind: 'player', team: 0, type: 'jon', name: 'Jon', hp: 300, hpMax: 300, x: 5000, y: 9000 });
    window.T = { heroes: null, newHero: [], screens: [] }; R.bus.on('screen', n => T.screens.push(n));
  });

  /* 1 — Jon falls: the slow fade, then the sheet with the killer, the run's numbers, the story line, the hall line, one primary */
  await die({ kills: 5, bosses: 1, killer: { kind: 'mob', type: 'walker', name: 'White Walker', lvl: 7 } });
  await p.waitForTimeout(500);
  const early = await read();
  ok('the fade starts at once, the sheet waits 1.5 s', early.fade && !early.shown && !early.next, JSON.stringify({ fade: early.fade, shown: early.shown, cur: early.cur }));
  await p.waitForTimeout(1700);
  const s1 = await read();
  ok('the death screen opens after the fade and pauses the run', s1.cur === 'death' && s1.shown && s1.paused === true && !s1.fade, JSON.stringify({ cur: s1.cur, paused: s1.paused, shown: s1.shown, fade: s1.fade }));
  ok('"<Name> has fallen" with the killer', /Jon has fallen/.test(s1.txt) && /Killed by White Walker · Lv 7/.test(s1.txt), s1.txt.slice(0, 120));
  ok('the run\'s numbers: level, kills (5 mobs + 1 boss), time, bosses', /12 ?Level/.test(s1.txt) && /6 ?Kills/.test(s1.txt) && /13 min ?Time/.test(s1.txt) && /1 ?Bosses/.test(s1.txt), s1.txt.slice(0, 220));
  const line = await p.evaluate(() => (document.querySelector('.dth-line') || {}).textContent || '');
  const lines = await p.evaluate(() => { const L = R.data.story && R.data.story.death; return Array.isArray(L) && L.length ? L.map(x => typeof x === 'string' ? x : x && (x.t || x.text || x.line || x.txt)) : R.screens.death.LINES; });
  const tpl = t => new RegExp('^' + String(t).replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+?') + '$');
  ok('a story line (R.data.story.death or the originals), its {placeholders} filled', line.length > 10 && !/[{}]/.test(line) && lines.some(t => t === line || tpl(t).test(line)), line);
  ok('the Hall of the Fallen line', /Here lies Jon, level 12, slain by White Walker after 13 min\./.test(s1.txt) && /Hall of the Fallen ·/.test(s1.txt), s1.txt.slice(200, 420));
  ok('one hall entry written, the best level kept', s1.hall.length === 1 && s1.hall[0].id === 'jon' && s1.hall[0].lvl === 12 && s1.hall[0].killer === 'White Walker' && s1.best.lvl === 12 && s1.best.kills === 6, JSON.stringify({ hall: s1.hall, best: s1.best }));
  ok('one primary CHOOSE THE NEXT HERO, a quiet Hall link, nothing about rising or ads', s1.next && s1.link && /CHOOSE THE NEXT HERO/.test(s1.txt) && !/RISE|ad to keep|revive/i.test(s1.txt), s1.txt.slice(-160));
  fs.mkdirSync(path.join(ROOT, '.shots'), { recursive: true });
  await p.screenshot({ path: path.join(ROOT, '.shots', 'rpg_death.png') });

  /* 2 — the Hall of the Fallen: the list and the best level; back returns to the death sheet */
  await p.tap('.dth-halllink'); await p.waitForTimeout(300);
  const h1 = await read();
  ok('the Hall opens from the sheet', h1.cur === 'hall' && /Hall of the Fallen/i.test(h1.txt), h1.cur);
  ok('the Hall lists Jon: level, killer, when, time; and the best level', /Jon Lv 12/.test(h1.txt) && /slain by White Walker/.test(h1.txt) && /just now|ago/.test(h1.txt) && /13 min/.test(h1.txt) && /Lv 12 ?best level/i.test(h1.txt) && /1 ?fallen/i.test(h1.txt), h1.txt.slice(0, 260));
  ok('the Hall has a portrait slot per row', await p.evaluate(() => document.querySelectorAll('.hr-row .hr-pt, .hall-row .hall-pic').length === 1));
  ok("the Hall's primary while the hero lies there is CHOOSE THE NEXT HERO", /CHOOSE THE NEXT HERO$/.test(h1.txt), h1.txt.slice(-40));
  await p.screenshot({ path: path.join(ROOT, '.shots', 'rpg_hall.png') });
  await p.tap('#screen .hr-back, #screen .hall-back'); await p.waitForTimeout(300);
  const b1 = await read();
  ok('back from the Hall returns to the death sheet, shown at once', b1.cur === 'death' && b1.shown, JSON.stringify({ cur: b1.cur, shown: b1.shown }));

  /* 3 — CHOOSE THE NEXT HERO opens A14's heroes screen with afterDeath */
  await p.evaluate(() => { R.screens.heroes = { open(a) { T.heroes = a; }, close() {} }; });
  await p.tap('.dth-next'); await p.waitForTimeout(300);
  const c1 = await p.evaluate(() => ({ cur: R.ui.cur, arg: T.heroes }));
  ok('the heroes screen opens with {afterDeath:true, fallen}', c1.cur === 'heroes' && c1.arg && c1.arg.afterDeath === true && c1.arg.fallen === 'jon', JSON.stringify(c1));
  await p.evaluate(() => { R.player.dead = false; R.ui.close(); delete R.screens.heroes; });
  await p.waitForTimeout(800);
  ok('nothing reopens once the player has chosen', (await p.evaluate(() => R.ui.cur)) === null);

  /* 4 — without a heroes screen: R.newHero(first unlocked other than the fallen) */
  await p.evaluate(() => { R.newHero = id => { T.newHero.push(id); R.player.dead = false; R.state.p = { hero: id, name: id, lvl: 1, gold: 0 }; }; });
  await die({ p: { hero: 'arya', name: 'Arya', lvl: 5, played: 40 }, kills: 2, killer: { kind: 'mob', type: 'giant', name: 'Giant', lvl: 12 } });
  await p.waitForTimeout(2200);
  const s2 = await read();
  ok('the second fall: Arya, two kills, 40 s, the hall grows, the best level stays 12', /Arya has fallen/.test(s2.txt) && /2 ?Kills/.test(s2.txt) && /40 s ?Time/.test(s2.txt) && s2.hall.length === 2 && s2.best.lvl === 12, JSON.stringify({ hall: s2.hall.length, best: s2.best, txt: s2.txt.slice(0, 100) }));
  // a Telegram BackButton close while the hero lies there brings the sheet back
  await p.evaluate(() => R.ui.close()); await p.waitForTimeout(900);
  const b2 = await read();
  ok('closing the sheet while dead brings it back', b2.cur === 'death' && b2.next, JSON.stringify({ cur: b2.cur, next: b2.next }));
  await p.tap('.dth-next'); await p.waitForTimeout(300);
  const c2 = await p.evaluate(() => ({ cur: R.ui.cur, newHero: T.newHero, dead: R.player.dead }));
  ok('R.newHero gets the first unlocked champion other than the fallen one', c2.cur === null && c2.newHero.length === 1 && c2.newHero[0] === 'jon' && c2.dead === false, JSON.stringify(c2));

  /* 5 — only the fallen champion unlocked: R.newHero(the same); a hall line the game already wrote is not doubled */
  await p.evaluate(() => { R.state.acc.champs = { arya: { unlocked: 1 } }; });
  await p.evaluate(() => { R.state.acc.hall.push({ id: 'arya', name: 'Arya', lvl: 3, killer: 'The cold', at: Date.now(), played: 9 }); });   // what the game may write itself before 'death'
  await die({ p: { hero: 'arya', name: 'Arya', lvl: 3, played: 9 }, killer: 'the cold' });
  await p.waitForTimeout(2200);
  const s3 = await read();
  ok('a string killer; the hall line is not doubled when it was already written', /Killed by The cold/.test(s3.txt) && s3.hall.length === 3 && /Fallen|has fallen/.test(s3.txt), JSON.stringify({ hall: s3.hall.length, txt: s3.txt.slice(0, 80) }));
  await p.tap('.dth-next'); await p.waitForTimeout(300);
  const c3 = await p.evaluate(() => ({ cur: R.ui.cur, newHero: T.newHero }));
  ok('with no other champion, the same one rises again', c3.cur === null && c3.newHero[1] === 'arya', JSON.stringify(c3));

  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(RES, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(RES).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
