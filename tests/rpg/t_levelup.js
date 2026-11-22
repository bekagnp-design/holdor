// A30: the level-up card. Emitting levelup(4) opens the card with "4" and the skill unlocked at 4 for the class; AUTO
// (default) pre-applies the points by class, switching it off gives them back; + spends one point (real tap); PUT IN
// SLOT puts the skill in the bar; CONTINUE closes the card and the world runs again; two level-ups in a row merge
// into one card (the highest level, the points summed). Fakes the save / player / skills when their modules are absent.
// Build first: python3 src/build_rpg.py beta/index.html
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.bus && R.screens && R.screens.levelup && R.levelup, { timeout: 20000 });
  // the boot (90_main) loads the save once the assets are ready and would replace a state the test made before it: wait for it
  await page.waitForFunction(() => !!R.boot, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(300);
  const res = {}; let fails = 0; const ok = (k, v, info) => { res[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); if (!v) fails++; };

  // what the other modules would give — faked only when absent
  const setup = await page.evaluate(() => {
    if (R.ui.cur) R.ui.close();
    if (!R.state) R.state = R.newState(); const p = R.state.p; p.lvl = 3; p.cls = 'knight'; p.house = 'stark'; p.name = 'Test'; p.hero = p.hero || 'jon'; p.pts = 0; p.stats = { str: 7, agi: 5, int: 5, vit: 6 }; p.bar = [null, null, null]; p.skills = {}; R.state.opts.manualPts = 0;
    if (!R.player) R.player = R.spawn({ kind: 'player', team: 0, x: 3000, y: 6000, lvl: 3, hp: 210, hpMax: 210, atk: 26, def: 11, spd: 170 });
    let sk = R.levelup.skillsAt(3, 4, 'knight')[0];
    if (!sk) { const fake = { id: 't_shieldwall', cls: 'knight', name: 'Shield Wall', unlock: 4, icon: '🛡️', desc: 'Raise the shield: the next three blows do nothing.' };
      if (!R.data.skills) R.data.skills = [fake]; else if (Array.isArray(R.data.skills)) R.data.skills.push(fake); else R.data.skills[fake.id] = fake; sk = R.levelup.skillsAt(3, 4, 'knight')[0]; }
    if (!R.data.story) R.data.story = {}; if (!R.data.story.levelup) R.data.story.levelup = ['The road has made you harder.'];
    R.start(); R.bus.emit('tick1s'); // the card takes its "before" numbers at a quiet second
    // the player module's part of a level, by hand: level, points, numbers (its own recalc when it has one)
    window.__lvl = n => { const p = R.state.p, d = n - p.lvl; p.lvl = n; p.pts += 3 * d; R.player.lvl = n;
      if (typeof R.player.recalc === 'function') R.player.recalc(); else { R.player.hpMax = 120 + 18 * n + 6 * p.stats.vit; R.player.atk = Math.round(10 + 2 * n + 1.5 * p.stats.str); R.player.def = Math.round(4 + 1.2 * n + .6 * p.stats.vit); }
      R.bus.emit('levelup', n); };
    return { skId: sk && sk.id, skName: sk && (sk.name || sk.n || sk.id), sum0: Object.values(p.stats).reduce((a, b) => a + b, 0), hp0: R.player.hpMax, hasRecalc: typeof R.player.recalc === 'function' }; });
  ok('a skill unlocks at 4', !!setup.skId, setup.skId);

  const read = () => page.evaluate(() => { const el = document.getElementById('screen'), p = R.state.p, q = s => el.querySelector(s), t = s => (q(s) || {}).textContent;
    return { cur: R.ui.cur, paused: R.paused, num: t('.lvup .hd .n'), skill: t('.lvup .sk .tx b'), slotBtn: t('.lvup .sk .slot'), rows: el.querySelectorAll('.lvup .st tr').length, hpB: +t('.lvup .st tr:first-child .b'), hpA: +t('.lvup .st tr:first-child .a'), hpD: t('.lvup .st tr:first-child .d'),
      auto: !!q('.lvup .auto.on'), ptsTxt: t('.lvup .pts .t'), plusOn: [...el.querySelectorAll('.lvup .pb')].filter(b => !b.disabled).length, pts: p.pts, str: p.stats.str, sum: Object.values(p.stats).reduce((a, b) => a + b, 0), bar: p.bar.slice(), say: t('.lvup .say'), go: !!q('.lvup .go'), sigil: !!q('.lvup .sig') }; });

  // whatever screen the boot left open (the intro for a save without a hero) closes first: the card waits for a free screen
  await page.evaluate(() => { for (let i = 0; i < 4 && R.ui.cur; i++) R.ui.close(); window.__lvl(4); });
  await page.waitForFunction(() => R.ui.cur === 'levelup', null, { timeout: 8000 });
  let s = await read();
  ok('card opens: LEVEL 4, paused, 4 stat rows, sigil, story, CONTINUE', s.cur === 'levelup' && s.paused && s.num === '4' && s.rows === 4 && s.sigil && !!s.say && s.go, JSON.stringify(s));
  ok('the skill unlocked at 4', s.skill === setup.skName && /PUT IN SLOT|IN SLOT \d/.test(s.slotBtn), s.skill + ' / ' + s.slotBtn);
  ok('AUTO pre-applies 3 points', s.auto && s.pts === 0 && s.sum === setup.sum0 + 3 && s.plusOn === 0, 'pts ' + s.pts + ' sum ' + s.sum + ' (was ' + setup.sum0 + ') ' + s.ptsTxt);
  ok('HP before → after real', s.hpB === setup.hp0 && s.hpA > s.hpB && s.hpD === '+' + (s.hpA - s.hpB), s.hpB + ' → ' + s.hpA + ' ' + s.hpD);
  await page.tap('.lvup .auto'); await page.waitForTimeout(120); s = await read();
  ok('AUTO off gives the points back', !s.auto && s.pts === 3 && s.sum === setup.sum0 && s.plusOn === 4 && /3 POINTS/.test(s.ptsTxt), 'pts ' + s.pts + ' sum ' + s.sum + ' ' + s.ptsTxt);
  const str0 = s.str;
  await page.tap('.lvup .pb[data-k="str"]'); await page.waitForTimeout(120); s = await read();
  ok('+ STR spends one point', s.pts === 2 && s.str === str0 + 1 && s.hpA >= setup.hp0, 'pts ' + s.pts + ' str ' + s.str);
  // the skills module may already have slotted the new skill (then the button reads IN SLOT n ✓ and is disabled)
  if (/PUT IN SLOT/.test(s.slotBtn)) { await page.tap('.lvup .sk .slot'); await page.waitForTimeout(150); } s = await read();
  ok('PUT IN SLOT fills the bar', s.bar.indexOf(setup.skId) >= 0 && new RegExp('IN SLOT ' + (s.bar.indexOf(setup.skId) + 1)).test(s.slotBtn), JSON.stringify(s.bar) + ' ' + s.slotBtn);
  await page.waitForTimeout(400);
  await page.screenshot({ path: SC + 'rpg_levelup.png' });
  const t0 = await page.evaluate(() => R.t);
  await page.tap('.lvup .go'); await page.waitForTimeout(250);
  const after = await page.evaluate(() => { const t1 = R.t; R.step(); return { cur: R.ui.cur, paused: R.paused, running: R.running, stepped: R.t > t1, pend: !!R.levelup.pending(), html: document.getElementById('screen').innerHTML.length }; });
  ok('CONTINUE closes, the world runs', after.cur === null && !after.paused && after.running && after.stepped && !after.pend && after.html === 0, JSON.stringify(after));
  // two levels at once → one card: 6, six points (manual now, so they wait in the pool)
  await page.evaluate(() => { R.bus.emit('tick1s'); window.__lvl(5); window.__lvl(6); });
  await page.waitForFunction(() => R.ui.cur === 'levelup', { timeout: 5000 }); await page.waitForTimeout(100); s = await read();
  ok('two level-ups merge: LEVEL 6, 6+2 points', s.num === '6' && s.pts === 8 && s.plusOn === 4 && /8 POINTS/.test(s.ptsTxt), 'num ' + s.num + ' pts ' + s.pts + ' ' + s.ptsTxt);
  const tA = await page.evaluate(() => R.t); await page.waitForTimeout(300); const tB = await page.evaluate(() => R.t);
  ok('the world stands still while the card is open', s.paused && tA === tB && t0 >= 0, tA + ' = ' + tB);
  await page.tap('.lvup .go'); await page.waitForTimeout(120);
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  for (const k in res) { const i = res[k].indexOf(' '); console.log((i < 0 ? res[k] : res[k].slice(0, i)).padEnd(4), k, i < 0 ? '' : '— ' + res[k].slice(i + 1)); }
  console.log('screenshot', SC + 'rpg_levelup.png');
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
