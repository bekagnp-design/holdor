// A24 achievements + titles: 100 kills unlock once and pay gems, levelup(10) unlocks, hero achievements from the Hall,
// the screen shows progress and a real title tap sets the account title; persistence through R.save / R.load.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=... node tests/rpg/t_achievements.js   (RPG_HTML overrides the page)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.RPG_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.ach && R.data && R.data.achievements && R.screens.ach, { timeout: 20000 });
  const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };

  // 1. the data
  const data = await page.evaluate(() => { const A = R.data.achievements, ids = A.map(a => a.id), tl = A.map(a => a.reward && a.reward.title).filter(Boolean);
    return { n: A.length, dup: ids.filter((x, i) => ids.indexOf(x) !== i), titleDup: tl.filter((x, i) => tl.indexOf(x) !== i), titles: tl.length,
      bad: A.filter(a => !a.id || !a.name || !a.d || !a.icon || !a.cond || !a.cond.ev || !(a.cond.n >= 1) || !a.reward || !(a.reward.gems > 0 || a.reward.title)).map(a => a.id),
      hero: ['fall_1', 'fall_5', 'lvl_20', 'lvl_40', 'lvl_60', 'heroes_3', 'run_1h', 'boss_death', 'outlive'].filter(id => !A.some(a => a.id === id)) }; });
  ok('≥30 well-formed achievements, unique ids and titles, the hero set', data.n >= 30 && !data.dup.length && !data.bad.length && !data.titleDup.length && data.titles >= 20 && !data.hero.length, JSON.stringify(data));

  // 2. a fresh v2 account + hero (the core stub may still save the v1 shape: give it an acc so the module uses the account)
  const fresh = () => page.evaluate(() => { R.state = R.newState(); if (!R.state.acc) R.state.acc = { house: 'stark', champs: { jon: { unlocked: 1, runs: 1 } }, hall: [], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: { lvl: 1, kills: 0 } };
    Object.assign(R.state.p, { hero: 'jon', name: 'Jon', lvl: 1, gems: 0, created: 1000 }); R.player = { kind: 'player', gems: 0, x: 0, y: 0 }; document.querySelectorAll('.ach-toast').forEach(d => d.remove()); });
  await fresh();
  const k = await page.evaluate(() => { const A = R.data.achievements, g = id => A.find(a => a.id === id).reward.gems || 0;
    for (let i = 0; i < 100; i++) R.bus.emit('kill', { kind: 'mob', type: 'axe', lvl: 1 }, R.player);
    const ach = R.state.acc.ach.slice(), gems = R.state.p.gems, pg = R.player.gems, toast = document.querySelector('.ach-toast'), toastTxt = toast && toast.textContent;
    R.bus.emit('kill', { kind: 'mob', type: 'axe' }, R.player); // the 101st: nothing new
    return { ach, gems, pg, toast: !!toast, toastTxt, ach2: R.state.acc.ach.slice(), gems2: R.state.p.gems, want: g('kill_1') + g('kill_100') + g('kill_run_100'),
      p100: R.ach.progress('kill_100'), p1k: R.ach.progress('kill_1000'), run: R.ach.progress('kill_run_100'), pAch: R.state.p.ach, titles: R.state.acc.titles.slice() }; });
  ok('100 kills unlock kill_1 + kill_100 + kill_run_100, once', ['kill_1', 'kill_100', 'kill_run_100'].every(id => k.ach.filter(x => x === id).length === 1) && k.ach.length === 3 && k.ach2.length === 3, JSON.stringify(k.ach));
  ok('gems paid once to the hero and mirrored to R.player', k.gems === k.want && k.gems2 === k.want && k.pg === k.want && k.want > 0, `${k.gems} / want ${k.want} / player ${k.pg}`);
  ok('unlock card shown', k.toast && /Achievement/.test(k.toastTxt) && /First Blood/.test(k.toastTxt) && /\+5 gems/.test(k.toastTxt), k.toastTxt);
  ok('progress: kill_100 done, kill_1000 at 101 / 1000', k.p100.done && k.p1k.cur === 101 && k.p1k.n === 1000 && !k.p1k.done && Math.abs(k.p1k.pct - 0.101) < 1e-9, JSON.stringify(k.p1k));
  ok('titles earned on the account', k.titles.includes('Sworn Sword') && k.titles.includes('Hundred-blade') && k.titles.length === 2, k.titles.join('|'));
  ok('the account holds ach, not the hero (v1 alias may mirror)', Array.isArray(k.ach) && (k.pAch == null || Array.isArray(k.pAch)), String(k.pAch));

  // 3. levelup(10)
  const l = await page.evaluate(() => { R.state.p.lvl = 10; R.bus.emit('levelup', 10); return { ach: R.state.acc.ach.slice(), p20: R.ach.progress('lvl_20'), h3: R.ach.progress('heroes_3') }; });
  ok('levelup(10) unlocks lvl_10 only; lvl_20 reads 10 / 20', l.ach.includes('lvl_10') && !l.ach.includes('lvl_20') && l.p20.cur === 10 && l.p20.n === 20 && l.h3.cur === 0, JSON.stringify(l.p20));

  // 4. permadeath: the Hall of the Fallen — first to fall, died to a boss, outlived the first hero, three heroes past 10
  const h = await page.evaluate(() => { const acc = R.state.acc;
    R.state.p.lvl = 11; R.bus.emit('levelup', 11); // Jon past 10, then falls to a boss
    acc.hall.push({ id: 'jon', name: 'Jon', lvl: 11, killer: 'night_king', at: Date.now(), played: 600 }); R.bus.emit('death', { killer: { kind: 'boss', type: 'night_king' } });
    const after1 = acc.ach.slice(), outl0 = R.ach.progress('outlive').cur;
    // the next hero: a new p (per-run counters start at zero), rises to 12 → outlived the first
    R.state.p = Object.assign(R.newState().p, { hero: 'arya', name: 'Arya', lvl: 12, gems: 0, created: 2000 }); R.bus.emit('levelup', 12);
    const after2 = acc.ach.slice(), run = R.ach.progress('kill_run_100').cur, life = R.ach.progress('kill_1000').cur;
    // a third hero past 10 → Three Banners
    acc.hall.push({ id: 'arya', name: 'Arya', lvl: 12, killer: 'wight', at: Date.now(), played: 300 }); R.bus.emit('death');
    R.state.p = Object.assign(R.newState().p, { hero: 'robb', name: 'Robb', lvl: 13, gems: 0, created: 3000 }); R.bus.emit('levelup', 13);
    return { after1, outl0, after2, run, life, after3: acc.ach.slice(), deaths: R.ach.progress('fall_5'), h3: R.ach.progress('heroes_3') }; });
  ok('first hero falls to a boss: fall_1 + boss_death, not outlive', h.after1.includes('fall_1') && h.after1.includes('boss_death') && !h.after1.includes('outlive') && h.outl0 === 0, JSON.stringify(h.after1));
  ok('second hero above the first: outlive; run kills reset, lifetime kept', h.after2.includes('outlive') && h.run === 0 && h.life === 101, `run ${h.run} life ${h.life}`);
  ok('three heroes past 10: heroes_3; deaths 2 / 5', h.after3.includes('heroes_3') && h.h3.done && h.deaths.cur === 2 && h.deaths.n === 5, JSON.stringify(h.deaths));

  // 5. the other conditions: seats (poi), legendary loot, main quest, dungeon, horde, gold, playtime
  const m = await page.evaluate(() => { const acc = R.state.acc;
    ['winterfell', 'casterly_rock', "Storm's End", 'dragonstone', 'pyke', 'highgarden', 'sunspear'].forEach(id => R.bus.emit('poi', id));
    R.bus.emit('loot', { id: 'x', kind: 'weapon', rar: 4, name: 'Dawnbreaker' });
    R.bus.emit('enter', 'the_gift'); R.bus.emit('poi', 'castle_black'); R.bus.emit('enter', 'beyond_the_wall');
    R.bus.emit('dungeon', 'crypts', 'cleared'); R.bus.emit('event', 'wight_horde', 'start'); R.bus.emit('event', 'wight_horde', 'stopped');
    R.bus.emit('gold', 10000); acc.world.quests.q1 = { st: 'turned' }; R.bus.emit('quest', 'q1', 'turned');
    R.state.p.played = 3600; R.bus.emit('tick1s');
    return { ach: acc.ach.slice(), seats: R.ach.progress('seats_7'), poi: R.ach.progress('poi_20'), ev: R.ach.progress('event_5') }; });
  ok('seats_7 + poi_1 from seven seat POIs; poi_20 reads 8 / 20', m.ach.includes('seats_7') && m.ach.includes('poi_1') && m.poi.cur === 8, JSON.stringify(m.poi));
  ok('legendary, wall, beyond, dungeon, horde, gold_10k, quest_1, run_1h', ['leg_1', 'wall', 'beyond', 'dung_1', 'horde_1', 'gold_10k', 'quest_1', 'run_1h'].every(id => m.ach.includes(id)), m.ach.join(','));
  ok('one horde = one event (start + stop not double counted)', m.ev.cur === 1, JSON.stringify(m.ev));

  // 6. the screen
  await page.evaluate(() => { document.querySelectorAll('.ach-toast').forEach(d => d.remove()); R.ui.open('ach'); });
  await page.waitForSelector('.ach-grid .ach-card');
  const s = await page.evaluate(() => { const cards = [...document.querySelectorAll('.ach-card')], c = cards.find(x => x.dataset.id === 'kill_1000');
    return { n: cards.length, done: document.querySelectorAll('.ach-card.done').length, pt: c && c.querySelector('.ach-pt').textContent.trim(), lock: c && c.classList.contains('lock'), bar: c && c.querySelector('.ach-pg i').style.width,
      chips: [...document.querySelectorAll('.ach-chip')].map(x => x.textContent.trim()), on: document.querySelector('.ach-chip.on').textContent.trim(), cnt: document.querySelector('.ach-cnt').textContent.trim(),
      acc: R.state.acc.ach.length, paused: R.paused, cur: R.ui.cur, big: [...document.querySelectorAll('.ach-chip,.ach-back')].every(b => b.getBoundingClientRect().height >= 44) }; });
  ok('screen: every card, locked kill_1000 reads 101 / 1,000 with a 10% bar', s.n === data.n && s.lock && s.pt === '101 / 1,000' && s.bar === '10%' && s.done === s.acc && s.cnt === `${s.acc} / ${data.n}` && s.cur === 'ach' && s.paused === true, JSON.stringify(s));
  ok('title picker: None first (on), earned titles as chips ≥ 44 px', s.chips[0] === 'None' && s.on === 'None' && s.chips.includes('Sworn Sword') && s.chips.includes('Hedge Knight') && s.big, s.chips.join('|'));
  await page.locator('.ach-chip', { hasText: 'Sworn Sword' }).first().tap(); await page.waitForTimeout(120);
  const t = await page.evaluate(() => ({ title: R.state.acc.title, p: R.state.p.title, api: R.ach.title(), on: document.querySelector('.ach-chip.on').textContent.trim(), sec: document.getElementById('achTitleSec').textContent.trim(), bad: R.ach.setTitle('Not Earned') }));
  ok('one tap sets the title on the account (mirrored to the hero), rejects an unearned one', t.title === 'Sworn Sword' && t.p === 'Sworn Sword' && t.api === 'Sworn Sword' && t.on === 'Sworn Sword' && /Sworn Sword/.test(t.sec) && t.bad === false, JSON.stringify(t));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: SC + 'rpg_ach.png' });
  await page.tap('#achBack'); await page.waitForTimeout(80);
  const closed = await page.evaluate(() => R.ui.cur === null && !document.getElementById('screen').classList.contains('on') && R.paused === false);
  ok('back closes the screen and unpauses', closed);

  // 7. persistence: save → load keeps the account's achievements and title
  const sv = await page.evaluate(() => { R.save(true); const before = R.state.acc.ach.length; R.state = null; const got = R.load(); return { got, n: R.state && R.state.acc && R.state.acc.ach.length, before, title: R.state && R.state.acc && R.state.acc.title, prog: R.ach.progress('kill_1000').cur }; });
  ok('save/load keeps ach + title + counters', sv.got && sv.n === sv.before && sv.title === 'Sworn Sword' && sv.prog === 101, JSON.stringify(sv));

  // 8. no state → no throw
  const nul = await page.evaluate(() => { R.state = null; try { R.bus.emit('kill', { kind: 'mob' }); R.bus.emit('tick1s'); R.ui.open('ach'); const txt = document.getElementById('screen').textContent; R.ui.close(); return /No hero yet/.test(txt); } catch (e) { return 'threw ' + e.message; } });
  ok('no state: listeners and the screen stay quiet', nul === true, String(nul));

  await browser.close();
  console.log(T); console.log('ERR', JSON.stringify(errors));
  const fails = Object.values(T).filter(v => /^FAIL/.test(v)).length;
  console.log(fails || errors.length ? `FAILS: ${fails}, errors ${errors.length}` : 'ALL PASS'); process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('Error:', e); process.exit(1); });
