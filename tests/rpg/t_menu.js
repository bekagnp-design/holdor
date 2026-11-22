// HOLDOR RPG — the pause menu + Telegram glue (A29). Real taps on beta/index.html (build first: python3 src/build_rpg.py beta/index.html).
// Checks: the menu opens from the menu button and Esc, RESUME closes it, the Settings toggles land in R.state.opts and in the save,
// "Start over" needs two taps and wipes 'holdor_rpg' (R.reload stubbed), Invite opens the Telegram share sheet with r_<code>,
// startapp r_<code> → flags.refBy once, and with a fake Telegram.WebApp the boot calls + BackButton.show/hide follow the screens.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const HTML = path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.route('**/telegram-web-app.js', r => r.abort());
  // a fake Telegram.WebApp that records every call
  await page.addInitScript(() => {
    const log = window.__tg = [];
    const rec = name => (...a) => { log.push([name, ...a]); };
    const bb = { isVisible: false, show() { bb.isVisible = true; log.push(['BackButton.show']); }, hide() { bb.isVisible = false; log.push(['BackButton.hide']); }, onClick(f) { bb.fn = f; log.push(['BackButton.onClick']); } };
    const mb = { hide: rec('MainButton.hide'), show: rec('MainButton.show') };
    const ev = {};
    window.Telegram = { WebApp: { version: '7.10', platform: 'ios', initData: 'x', initDataUnsafe: { user: { id: 777, first_name: 'Hodor' }, start_param: 'r_abc12' },
      ready: rec('ready'), expand: rec('expand'), disableVerticalSwipes: rec('disableVerticalSwipes'), setHeaderColor: rec('setHeaderColor'), setBackgroundColor: rec('setBackgroundColor'),
      openTelegramLink: rec('openTelegramLink'), openLink: rec('openLink'), onEvent(n, f) { (ev[n] = ev[n] || []).push(f); log.push(['onEvent', n]); }, __fire(n) { (ev[n] || []).forEach(f => f()); },
      BackButton: bb, MainButton: mb, HapticFeedback: { impactOccurred: rec('impact'), notificationOccurred: rec('notif') } } };
  });
  await page.goto('file://' + HTML + '?startapp=r_abc12');
  await page.waitForFunction(() => window.R && R.screens && R.screens.menu && R.tg, { timeout: 20000 });
  const R = global.__R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const calls = () => page.evaluate(() => window.__tg.map(x => x[0]));
  const tgArgs = name => page.evaluate(n => window.__tg.filter(x => x[0] === n).map(x => x.slice(1)), name);

  // boot: the Telegram calls happened at load, before any save exists
  const c0 = await calls();
  ok('tg boot ready+expand', c0.includes('ready') && c0.includes('expand'), c0.join(','));
  ok('tg boot swipes+header', c0.includes('disableVerticalSwipes') && JSON.stringify(await tgArgs('setHeaderColor')).includes('#060b14'));
  ok('tg boot MainButton hidden, BackButton hidden', c0.includes('MainButton.hide') && c0.includes('BackButton.hide') && !c0.includes('BackButton.show'));
  ok('tg boot viewportChanged bound', (await tgArgs('onEvent')).some(a => a[0] === 'viewportChanged'));

  // a character: the boot module is not part of this suite, so the test makes the save itself and starts the loop
  await page.evaluate(() => { R.state = R.newState(); R.state.p.name = 'Hodor'; R.state.p.house = 'stark'; R.state.p.cls = 'knight'; R.state.p.lvl = 7; R.state.p.played = 4200; R.state.p.hero = 'jon';
    R.state.acc = { house: 'stark', champs: { jon: { unlocked: 1, runs: 2 }, robb: { unlocked: 1, runs: 1 } }, hall: [{ id: 'robb', name: 'Robb', lvl: 9, killer: 'wight', at: Date.now() - 3600e3, played: 600 }], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: { lvl: 9, kills: 120 } };
    R.net = { on: true }; R.start(); R.resize(); });
  await page.waitForFunction(() => { const b = document.getElementById('b-menu') || document.getElementById('menuBtn'); return b && b.getBoundingClientRect().width >= 44; }, { timeout: 5000 }).catch(() => {});
  const bb = await page.evaluate(() => { const b = document.getElementById('b-menu') || document.getElementById('menuBtn'); const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, off: b.classList.contains('off') || !r.width, data: b.dataset.btn || b.dataset.b, n: document.querySelectorAll('#b-menu,#menuBtn').length }; });
  ok('one menu button, ≥44px, menu', bb.w >= 44 && bb.h >= 44 && !bb.off && bb.data === 'menu' && bb.n === 1, JSON.stringify(bb));

  // startapp r_abc12 → refBy once (the own id 777 differs)
  await page.waitForFunction(() => R.state.p.flags && R.state.p.flags.refBy, { timeout: 5000 }).catch(() => {});
  ok('startapp → flags.refBy', await page.evaluate(() => R.state.p.flags.refBy === 'abc12'), await page.evaluate(() => JSON.stringify(R.state.p.flags)));

  // open from the button (a real tap)
  await page.tap('#b-menu', { force: true }); await page.waitForTimeout(150);
  let st = await page.evaluate(() => ({ cur: R.ui.cur, on: document.getElementById('screen').classList.contains('on'), paused: R.paused, btnOff: (b => !b || b.classList.contains('off') || !b.getBoundingClientRect().width)(document.getElementById('b-menu') || document.getElementById('menuBtn')) }));
  ok('tap menu → screen menu, paused, button hidden', st.cur === 'menu' && st.on && st.paused && st.btnOff, JSON.stringify(st));
  ok('BackButton.show on open', (await calls()).includes('BackButton.show'));
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('#menu .mn-row .lb')).map(x => x.firstChild.textContent.trim()));
  const need = ['Skills', 'Heroes', 'Quests', 'Achievements', 'Hall of the Fallen', 'Chat', 'Settings', 'Invite a friend', 'Account'];
  ok('rows present, no Party', need.every(n => rows.includes(n)) && !rows.includes('Party'), rows.join('|'));
  ok('Heroes/Hall rows target the heroes/hall screens', await page.evaluate(() => document.querySelector('#menu .mn-row[data-row="heroes"]').dataset.scr === 'heroes' && document.querySelector('#menu .mn-row[data-row="hall"]').dataset.scr === 'hall' && /1 fallen/.test(document.querySelector('#menu .mn-row[data-row="hall"]').textContent)));
  ok('a row for a missing screen toasts instead of throwing', await page.evaluate(() => { const sv = R.screens.heroes; delete R.screens.heroes; document.querySelector('#menu .mn-row[data-row="heroes"]').click(); if (sv) R.screens.heroes = sv; return R.ui.cur === 'menu' && !!document.querySelector('#ui .toast'); }));
  ok('Leaderboard row iff R.screens.board', await page.evaluate(() => !!document.querySelector('#menu .mn-row[data-scr="board"]') === !!R.screens.board));
  const sizes = await page.evaluate(() => Array.from(document.querySelectorAll('#menu button')).map(b => b.getBoundingClientRect().height));
  ok('every target ≥44px', sizes.length > 8 && sizes.every(h => h >= 44), JSON.stringify(sizes.map(Math.round)));
  const foot = await page.evaluate(() => document.querySelector('#menu .mn-foot').textContent);
  ok('footer: version + played 1h 20m (account total)', /v2\.0\.0/.test(foot) && /1h 20m/.test(foot), foot);
  const pri = await page.evaluate(() => { const b = document.querySelector('#menu button.pri'); const r = b.getBoundingClientRect(); return { t: b.textContent, h: r.height, n: document.querySelectorAll('#menu button.pri').length }; });
  ok('one primary RESUME', pri.n === 1 && pri.t === 'RESUME' && pri.h >= 56, JSON.stringify(pri));
  await page.screenshot({ path: SC + 'rpg_menu.png' });

  // RESUME closes
  await page.tap('#menu button.pri'); await page.waitForTimeout(120);
  st = await page.evaluate(() => ({ cur: R.ui.cur, on: document.getElementById('screen').classList.contains('on'), paused: R.paused, btnOff: (b => !b || b.classList.contains('off') || !b.getBoundingClientRect().width)(document.getElementById('b-menu') || document.getElementById('menuBtn')) }));
  ok('RESUME → closed, unpaused, button back', st.cur === null && !st.on && !st.paused && !st.btnOff, JSON.stringify(st));
  const seq = await calls(); ok('BackButton.hide after close', seq.lastIndexOf('BackButton.hide') > seq.lastIndexOf('BackButton.show'));

  // Esc opens and closes
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const e1 = await page.evaluate(() => R.ui.cur);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const e2 = await page.evaluate(() => R.ui.cur);
  ok('Esc opens, Esc closes', e1 === 'menu' && e2 === null, e1 + '/' + e2);

  // the Telegram BackButton closes a screen too
  await page.tap('#b-menu', { force: true }); await page.waitForTimeout(100);
  await page.evaluate(() => window.Telegram.WebApp.BackButton.fn());
  ok('BackButton tap closes the screen', await page.evaluate(() => R.ui.cur === null));

  // Settings toggles → R.state.opts, saved
  await page.tap('#b-menu', { force: true }); await page.waitForTimeout(100);
  await page.tap('#menu .mn-row[data-row="gear"]'); await page.waitForTimeout(100);
  const before = await page.evaluate(() => JSON.stringify(R.state.opts));
  await page.tap('#menu .mn-sw[data-opt="sfx"]'); await page.tap('#menu .mn-sw[data-opt="haptic"]'); await page.tap('#menu .mn-sw[data-opt="dmgnum"]'); await page.tap('#menu .mn-sw[data-opt="manual"]');
  await page.waitForTimeout(100);
  const o = await page.evaluate(() => R.state.opts);
  ok('toggles → opts', before.includes('"sfx":1') && o.sfx === 0 && o.haptic === 0 && o.dmgnum === 0 && o.manual === 1, before + ' → ' + JSON.stringify(o));
  const ui = await page.evaluate(() => Array.from(document.querySelectorAll('#menu .mn-sw')).map(b => b.dataset.opt + ':' + (b.classList.contains('on') ? 1 : 0) + ':' + b.querySelector('.st').textContent));
  ok('toggle UI follows', ui.join(',') === 'sfx:0:OFF,haptic:0:OFF,dmgnum:0:OFF,manual:1:ON', ui.join(','));
  await page.tap('#menu .mn-sw[data-opt="sfx"]'); await page.waitForTimeout(1200);
  const saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('holdor_rpg') || '{}'); return s.opts; });
  ok('opts persist in the save', saved && saved.sfx === 1 && saved.haptic === 0 && saved.dmgnum === 0 && saved.manual === 1, JSON.stringify(saved));
  ok('haptics off → no impact calls on taps', await page.evaluate(() => { const n0 = window.__tg.filter(x => x[0] === 'impact').length; R.haptic('light'); R.haptic('heavy'); return window.__tg.filter(x => x[0] === 'impact').length === n0; }));
  ok('haptics on → impact call', await page.evaluate(() => { R.state.opts.haptic = 1; const n0 = window.__tg.filter(x => x[0] === 'impact').length; R.haptic('heavy'); return window.__tg.filter(x => x[0] === 'impact').length === n0 + 1 && window.__tg[window.__tg.length - 1][1] === 'heavy'; }));
  await page.screenshot({ path: SC + 'rpg_menu_settings.png' });

  // back to the root, Invite → share sheet with r_777 (logged in, no flags.ref)
  await page.tap('#menu .mn-back'); await page.waitForTimeout(100);
  ok('back → root', await page.evaluate(() => R.screens.menu.page === 'root' && !!document.querySelector('#menu button.pri')));
  await page.tap('#menu .mn-row[data-row="invite"]'); await page.waitForTimeout(100);
  const sh = (await tgArgs('openTelegramLink')).pop();
  const shareUrl = sh && sh[0] || '';
  ok('Invite → openTelegramLink share/url', /^https:\/\/t\.me\/share\/url\?url=/.test(shareUrl), shareUrl.slice(0, 80));
  ok('share link carries startapp=r_777', decodeURIComponent(shareUrl.split('url=')[1] || '').includes('https://t.me/HoldorTDBot/play?startapp=r_777'), decodeURIComponent(shareUrl));
  ok('flags.ref wins over the id', await page.evaluate(() => { R.state.p.flags.ref = 'zz9'; const l = R.tg.inviteLink(); delete R.state.p.flags.ref; return l === 'https://t.me/HoldorTDBot/play?startapp=r_zz9'; }));

  // Account → Start over: two taps, wipes the save, reloads (stubbed)
  await page.tap('#menu .mn-row[data-row="acc"]'); await page.waitForTimeout(100);
  const kv = await page.evaluate(() => Array.from(document.querySelectorAll('#menu .mn-kv')).map(x => x.textContent));
  ok('account: house, hero, champion, class, level, fallen, best', kv.some(x => /^HouseStark$/.test(x)) && kv.some(x => /^HeroHodor$/.test(x)) && kv.some(x => /^ChampionJon( Snow)?$/.test(x)) && kv.some(x => /Knight/.test(x)) && kv.some(x => /^Level7$/.test(x)) && kv.some(x => /^Heroes fallen1$/.test(x)) && kv.some(x => /^Best level9$/.test(x)), kv.join('|'));
  await page.evaluate(() => { window.__reloaded = 0; R.reload = () => { window.__reloaded++; }; try { location.reload = () => { window.__reloaded += 100; }; } catch (e) {} });
  await page.tap('#menu .mn-row[data-act="startover"]'); await page.waitForTimeout(100);
  const a1 = await page.evaluate(() => ({ armed: document.querySelector('[data-act="startover"]').classList.contains('armed'), save: !!localStorage.getItem('holdor_rpg'), rel: window.__reloaded, txt: document.querySelector('[data-act="startover"] .lb').textContent }));
  ok('first tap arms only', a1.armed && a1.save && a1.rel === 0 && /Tap again/.test(a1.txt), JSON.stringify(a1));
  await page.screenshot({ path: SC + 'rpg_menu_account.png' });
  await page.tap('#menu .mn-row[data-act="startover"]'); await page.waitForTimeout(150);
  const a2 = await page.evaluate(() => ({ save: localStorage.getItem('holdor_rpg'), rel: window.__reloaded, state: R.state, running: R.running }));
  ok('second tap wipes + reloads', a2.save === null && a2.rel >= 1 && a2.state === null && !a2.running, JSON.stringify(a2));

  // no Telegram at all: a fresh page must boot the module without errors and still open the menu
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.route('**/telegram-web-app.js', r => r.abort());
  await p2.goto('file://' + HTML);
  await p2.waitForFunction(() => window.R && R.screens && R.screens.menu, { timeout: 20000 });
  const plain = await p2.evaluate(() => { R.state = R.newState(); R.start(); R.ui.open('menu'); const r = { tg: R.tg.on, cur: R.ui.cur, rows: document.querySelectorAll('#menu .mn-row').length, hap: (R.haptic('light'), true) }; R.ui.close(); return r; });
  ok('plain browser: no Telegram, menu works, haptic silent', !plain.tg && plain.cur === 'menu' && plain.rows >= 9 && plain.hap && !err2.length, JSON.stringify(plain) + ' ' + err2.join(';'));
  // save v1 (no acc) still renders: the house from p, nothing fallen
  const v1 = await p2.evaluate(() => { const s = R.newState(); s.p.name = 'Old'; s.p.house = 'tyrell'; delete s.acc; s.v = 1; R.state = s; R.ui.open('menu', 'account'); const kv = Array.from(document.querySelectorAll('#menu .mn-kv')).map(x => x.textContent); R.ui.close(); return kv; });
  ok('v1 save renders the account page', v1.some(x => /^HouseTyrell$/.test(x)) && v1.some(x => /^Heroes fallen0$/.test(x)) && v1.some(x => /^HeroOld$/.test(x)), v1.join('|'));

  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  const bad = Object.values(R).filter(v => v.startsWith('FAIL')).length;
  console.log(bad ? 'FAILS: ' + bad : 'ALL PASS');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})().catch(e => { console.error('ERR', e, JSON.stringify(global.__R || {}, null, 1)); process.exit(1); });
