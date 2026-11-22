// RPG v2.0.0 — presence (A38): other players as ghosts, the zone chat sheet, the leaderboard. Real taps against a fake R.net
// ({on, others, chat.send/list, board}); the world is the core stub + this module, so the test spawns the player itself.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=... node tests/rpg/t_presence.js   (HOLDOR_HTML overrides the page)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.presence && R.screens.chat && R.screens.board && R.boot, { timeout: 20000 }); await page.waitForTimeout(300);   // after the boot door (it would replace the faked state)
  const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  // a logged-in world: me at (1000,1000), two others, a fake server, a plain ground so the screenshot shows something
  await page.evaluate(() => {
    R.state = R.newState(); R.state.p.name = 'Me'; R.state.p.house = 'stark';
    R.player = R.spawn({ kind: 'player', team: 0, x: 1000, y: 1000, hp: 200, name: 'Me' }); R.cam.x = 1000; R.cam.y = 1000; R.cam.z = 1; if (R.ui.cur) R.ui.close();   // the boot's intro gives way to the faked world
    window.__calls = []; window.__board = []; window.__db = [];
    R.net = { on: true, others: [{ name: 'Arya', house: 'stark', lvl: 7, hero: 'arya', x: 1100, y: 940, zone: 'north', at: Date.now() }, { name: 'Oberyn', house: 'martell', lvl: 12, x: 880, y: 1080, zone: 'north', at: Date.now() }],
      chat: { send: t => { window.__calls.push(t); return Promise.resolve({ id: 100 + window.__calls.length }); }, list: () => Promise.resolve(window.__db) },
      board: k => { window.__board.push(k); return Promise.resolve([{ rank: 1, name: 'Oberyn', house: 'martell', lvl: 12, v: k === 'lvl' ? 12 : 9 }, { rank: 2, name: 'Arya', house: 'stark', lvl: 7, v: k === 'lvl' ? 7 : 4 }, { rank: 3, name: 'Me', house: 'stark', lvl: 1, v: k === 'lvl' ? 1 : 0, mine: true }]); } };
    window.__champ = []; R.draw = { champ: (id, x, y, o) => { window.__champ.push(id); const c = o.ctx; c.fillStyle = o.col; c.beginPath(); c.arc(x, y - 16, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.font = '700 9px serif'; c.textAlign = 'center'; c.fillText(id, x, y - 13); } };
    R.addSys('fakeRender', { order: 1, draw(ctx) { ctx.fillStyle = '#17241b'; ctx.fillRect(0, 0, R.vw, R.vh); ctx.strokeStyle = 'rgba(255,255,255,.06)'; for (let x = -(R.cam.x % 100); x < R.vw; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, R.vh); ctx.stroke(); } for (let y = -(R.cam.y % 100) + R.vh / 2 % 100; y < R.vh; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(R.vw, y); ctx.stroke(); }
      const s = R.w2s(R.player.x, R.player.y); ctx.fillStyle = '#a9bdd0'; ctx.beginPath(); ctx.arc(s.x, s.y - 16, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 11px Cinzel,serif'; ctx.textAlign = 'center'; ctx.fillText('Me', s.x, s.y + 14); } });
    window.__badges = []; R.bus.on('chatBadge', n => window.__badges.push(n));
    for (const k of Object.keys(R.sys)) if (k !== 'presence' && k !== 'fakeRender') delete R.sys[k];
    document.querySelectorAll('canvas#gl').forEach(c => c.remove()); R.w2s = (x, y) => ({ x: (x - R.cam.x) * R.cam.z + R.vw / 2, y: (y - R.cam.y) * R.cam.z + R.vh / 2 }); R.camUpdate = () => R.cam;   // the 2D overlay alone   // this suite tests 71_presence alone: the integrated world (mobs at the faked spot, the player module, the renderer) stays out
    R.bus.emit('presence', R.net.others); R.start();
  });
  await page.waitForTimeout(400);
  const A = await page.evaluate(() => ({ ghosts: R.ents.filter(e => e.kind === 'ghost').map(e => [e.name, e.team, e.house, e.lvl, Math.round(e.x), Math.round(e.y), e.type]), list: R.presence.list().map(g => g.name + ':' + g.col), paused: !!R.paused, champ: [...new Set(window.__champ)] }));
  ok('two ghosts in R.ents, team 2, with house + level; R.presence.list() gives them with the house colour', A.ghosts.length === 2 && A.ghosts.every(g => g[1] === 2) && A.list.join() === 'Arya:#a9bdd0,Oberyn:#f08a3c', JSON.stringify(A));
  ok('a row with a hero sets e.type to the champion id and (no #gl) is drawn through R.draw.champ; one without falls back to the code figure', A.ghosts[0][6] === 'arya' && A.ghosts[1][6] === null && A.champ.join() === 'arya', JSON.stringify([A.ghosts.map(g => g[6]), A.champ]));
  // movement: Arya's next position is 300 to the right → after 60 steps (1 s) she has walked ~150 toward it, not jumped
  const B = await page.evaluate(() => { R.net.others[0] = Object.assign({}, R.net.others[0], { x: 1400 }); R.bus.emit('presence', R.net.others); const g = R.ents.find(e => e.kind === 'ghost' && e.name === 'Arya'); const x0 = g.x; R.paused = true; for (let i = 0; i < 60; i++) R.step(); const x1 = g.x; for (let i = 0; i < 180; i++) R.step(); R.paused = false; return { x0, x1, x2: g.x, anim: g.anim, face: g.face }; });
  ok('a ghost walks toward its new position at 150 u/s and arrives', B.x0 === 1100 && Math.abs(B.x1 - 1250) < 12 && Math.abs(B.x2 - 1400) < 2 && B.face === 1 && B.anim === 'idle', JSON.stringify(B));
  // gone from the list → fades out and leaves R.ents
  const C = await page.evaluate(() => { R.net.others = [R.net.others[1]]; R.bus.emit('presence', R.net.others); const g = R.ents.find(e => e.kind === 'ghost' && e.name === 'Arya'); const gone = !!g.gone; R.paused = true; for (let i = 0; i < 90; i++) R.step(); R.paused = false; return { gone, left: R.ents.filter(e => e.kind === 'ghost').map(e => e.name), listed: R.presence.list().map(g => g.name) }; });
  ok('a player gone from the list fades out and is removed', C.gone && C.left.join() === 'Oberyn' && C.listed.join() === 'Oberyn', JSON.stringify(C));
  // chat arrives while the sheet is closed → unread 2 + chatBadge events + a 6 s bubble over the matching ghost
  const D = await page.evaluate(() => { const now = Date.now(); window.__db = [{ id: 1, name: 'Oberyn', house: 'martell', body: 'The sun never sets on the sand', at: new Date(now - 90000).toISOString() }, { id: 2, name: 'Arya', house: 'stark', body: 'Anyone for the Wall?', at: now - 30000 }];
    R.bus.emit('chat', window.__db); const g = R.ents.find(e => e.kind === 'ghost' && e.name === 'Oberyn'); return { unread: R.presence.unread, badges: window.__badges.slice(), bubble: g.bubble, until: g.bubbleUntil - R.t, dom: (document.querySelector('#prChat .bd') || {}).textContent, on: !!document.querySelector('#prChat .bd.on') }; });
  ok('unread counts the two new messages, chatBadge(n) fires, the badge shows 2', D.unread === 2 && D.badges.join() === '1,2' && D.dom === '2' && D.on, JSON.stringify(D));
  ok('the ghost whose message arrived gets a 6 s speech bubble', D.bubble === 'The sun never sets on the sand' && D.until > 5.5 && D.until <= 6 + 1e-6, JSON.stringify([D.bubble, D.until]));
  await page.screenshot({ path: SC + 'rpg_ghosts.png' });
  // open the sheet with a real tap on the floating button: live, the zone name, the rows, unread reset
  await page.locator('#prChat').tap(); await page.waitForTimeout(400);
  const E = await page.evaluate(() => { const sh = document.getElementById('prSheet').getBoundingClientRect(); return { cur: R.ui.cur, paused: !!R.paused, zone: document.getElementById('prZone').textContent, rows: [...document.querySelectorAll('#prList .prMsg')].map(r => r.querySelector('b').textContent + ': ' + r.querySelector('.b').textContent), col: document.querySelector('#prList .prMsg b').style.color, unread: R.presence.unread, top: Math.round(sh.top / innerHeight * 100), sub: document.querySelector('.prSub').textContent, sendH: document.getElementById('prSend').getBoundingClientRect().height, quick: [...document.querySelectorAll('.prQ')].map(b => b.dataset.q) }; });
  ok('the chat sheet is live (world running), covers the bottom 55 %, names the zone, lists the messages in house colour, clears unread', E.cur === 'chat' && !E.paused && typeof E.zone === 'string' && E.zone.length > 2 && E.rows.join('|') === 'Oberyn: The sun never sets on the sand|Arya: Anyone for the Wall?' && /240, 138, 60/.test(E.col) && E.unread === 0 && E.top === 45 && E.sendH >= 44 && /^\d+ other players? nearby$/.test(E.sub), JSON.stringify(E));   // the zone + nearby count come from the real world data now
  ok('the quick emote row: 👋 ⚔️ 🛡️ 🔥 ❄️ + a help call naming a place', E.quick.slice(0, 5).join() === '👋,⚔️,🛡️,🔥,❄️' && /^Help at .+!$/.test(E.quick[5] || ''), JSON.stringify(E.quick));
  await page.locator('#prIn').fill('Hold the door!'); await page.locator('#prSend').tap(); await page.waitForTimeout(300);
  const F = await page.evaluate(() => ({ calls: window.__calls.slice(), val: document.getElementById('prIn').value, mine: [...document.querySelectorAll('#prList .prMsg.me .b')].map(e => e.textContent), ids: R.presence.msgs.map(m => m.id) }));
  ok('SEND calls R.net.chat.send, the row shows as mine, the box clears, the server id is kept', F.calls.join() === 'Hold the door!' && F.val === '' && F.mine.join() === 'Hold the door!' && F.ids.join() === '1,2,101', JSON.stringify(F));
  // the server echoes my line with its id → no duplicate row
  const F2 = await page.evaluate(() => { R.bus.emit('chat', [{ id: 101, name: 'Me', house: 'stark', body: 'Hold the door!', at: Date.now(), mine: true }]); return { n: document.querySelectorAll('#prList .prMsg').length, unread: R.presence.unread }; });
  ok('the server echo of my message does not duplicate it or count as unread', F2.n === 3 && F2.unread === 0, JSON.stringify(F2));
  await page.screenshot({ path: SC + 'rpg_chat.png' });
  // rate limit: a second send within 2 s is refused with a note; after 2 s a quick emote goes out
  await page.evaluate(() => { R.presence.lastSend = Date.now(); }); await page.locator('.prQ[data-q="👋"]').tap(); await page.waitForTimeout(150);
  const G1 = await page.evaluate(() => ({ note: document.getElementById('prNote').textContent, n: window.__calls.length }));
  await page.waitForTimeout(2000); await page.locator('.prQ[data-q="⚔️"]').tap(); await page.waitForTimeout(250);
  const G2 = await page.evaluate(() => ({ calls: window.__calls.slice(), last: [...document.querySelectorAll('#prList .prMsg.me .b')].pop().textContent }));
  ok('sends are rate-limited to one per 2 s with a note; a quick emote then goes out as a message', G1.note === 'Slow down' && G1.n === 1 && G2.calls.join() === 'Hold the door!,⚔️' && G2.last === '⚔️', JSON.stringify([G1, G2]));
  // long-press another's row → the report stub toast
  const row = page.locator('#prList .prMsg', { hasText: 'Anyone for the Wall?' }); const bb = await row.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + 40, y: bb.y + bb.height / 2 }] }); await page.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(100);
  const H = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent));
  ok('a long-press on another player\'s message shows no fake "Reported" while the server has no report path for the zone chat', !H.includes('Reported. Thank you.'), JSON.stringify(H));
  await page.locator('#prX').tap(); await page.waitForTimeout(200);
  // greet: a new player 40 units away appears at his position; a tap on him → 👋 over both + "Me waves to Sandor" sent
  const I = await page.evaluate(() => { R.net.others.push({ name: 'Sandor', house: 'lannister', lvl: 20, x: 1040, y: 1000, zone: 'north', at: Date.now() }); R.bus.emit('presence', R.net.others); const g = R.ents.find(e => e.kind === 'ghost' && e.name === 'Sandor'); const s = R.w2s(g.x, g.y); window.__nums = []; R.fx = { num: (x, y, txt, col, big) => window.__nums.push([Math.round(x), Math.round(y), txt, col, !!big]) }; return { cur: R.ui.cur, sx: s.x, sy: s.y, calls: window.__calls.length, label: g.interact && g.interact.label }; });
  ok('the sheet closes; a ghost carries interact {label:"Greet"} for the INTERACT button', I.cur === null && I.label === 'Greet', JSON.stringify(I));
  await page.evaluate(() => { R.presence.lastSend = 0; R.presence.greet(R.ents.find(e => e.kind === 'ghost' && e.name === 'Sandor')); }); await page.waitForTimeout(200);
  const J = await page.evaluate(() => ({ nums: window.__nums.slice(), calls: window.__calls.slice(-1), far: R.presence.greet(R.ents.find(e => e.kind === 'ghost' && e.name === 'Oberyn')) }));
  ok('greet: 👋 emote over me and over him (R.fx.num), "Me waves to Sandor" sent to the zone; a far ghost is refused', J.nums.length === 2 && J.nums.every(n => n[2] === '👋') && J.nums[0][3] === '#a9bdd0' && J.nums[1][3] === '#e3b661' && J.calls.join() === 'Me waves to Sandor' && J.far === false, JSON.stringify(J));
  // a repeat greet within 5 s does nothing (rate-limited)
  const J2 = await page.evaluate(() => { R.presence.lastSend = 0; const r = R.presence.greet(R.ents.find(e => e.kind === 'ghost' && e.name === 'Sandor')); return { r, n: window.__calls.length }; });
  ok('a second wave within 5 s is rate-limited', J2.r === false && J2.n === 3, JSON.stringify(J2));
  // the board: Level tab first, three rows, me highlighted with "you"; the Kills tab asks the server again
  await page.evaluate(() => R.ui.open('board')); await page.waitForTimeout(300);
  const K = await page.evaluate(() => ({ paused: !!R.paused, tabs: [...document.querySelectorAll('.prTab')].map(t => t.textContent + (t.classList.contains('on') ? '*' : '')), rows: [...document.querySelectorAll('.prRank')].map(r => r.querySelector('.rk').textContent + ' ' + r.querySelector('.sg').textContent + ' ' + r.querySelector('.nm').firstChild.textContent + ' ' + r.querySelector('.v').textContent + (r.classList.contains('me') ? ' <you>' : '')), you: (document.querySelector('.prRank.me i') || {}).textContent, asked: window.__board.slice() }));
  ok('the board pauses the world, opens on Level (kind lvl), five tabs, rows with the house sigil, me marked "you"', K.paused && K.tabs.join() === 'Level*,Best,Kills,Bosses,Fallen' && K.rows.join('|') === '1 ☀️ Oberyn Lv 12|2 🐺 Arya Lv 7|3 🐺 Me Lv 1 <you>' && K.you === 'you' && K.asked.join() === 'lvl', JSON.stringify(K));
  await page.locator('.prTab[data-k="kills"]').tap(); await page.waitForTimeout(300);
  const L = await page.evaluate(() => ({ asked: window.__board.slice(), v: [...document.querySelectorAll('.prRank .v')].map(e => e.textContent), on: document.querySelector('.prTab.on').textContent }));
  ok('the Kills tab asks R.net.board("kills") and shows kill counts', L.asked.join() === 'lvl,kills' && L.v.join() === '9 kills,4 kills,0 kills' && L.on === 'Kills', JSON.stringify(L));
  const L2 = await page.evaluate(() => { window.__fallen = [{ rank: 1, name: 'Arya', house: 'stark', lvl: 7, killer: 'White walker', at: Date.now() - 3600000 }]; const b = R.net.board; R.net.board = k => k === 'fallen' ? Promise.resolve(window.__fallen) : b(k); return R.presence.loadBoard('fallen').then(() => ({ v: [...document.querySelectorAll('.prRank .v')].map(e => e.textContent), on: document.querySelector('.prTab.on').textContent })); });
  ok('the Fallen tab lists the Hall of the Fallen: level and killer', L2.v.join() === 'Lv 7 · White walker' && L2.on === 'Fallen', JSON.stringify(L2));
  await page.screenshot({ path: SC + 'rpg_board.png' });
  await page.locator('#prBack').tap(); await page.waitForTimeout(200);
  // a guest: no ghosts, the chat says it needs Telegram, the board says log in
  const M = await page.evaluate(() => { R.net.on = false; R.net.others.push({ name: 'Ghost', house: 'stark', lvl: 3, x: 1000, y: 1050 }); R.bus.emit('presence', R.net.others); R.paused = true; for (let i = 0; i < 90; i++) R.step(); R.paused = false; const n = R.ents.filter(e => e.kind === 'ghost').length;
    R.ui.open('chat'); const chat = (document.querySelector('.prBig') || {}).textContent, input = !!document.getElementById('prIn'); R.ui.close(); R.ui.open('board'); const board = (document.querySelector('.prBig') || {}).textContent, rows = document.querySelectorAll('.prRank').length; return { n, chat, input, board, rows, cur: R.ui.cur }; });
  ok('a guest sees no ghosts, "Chat needs Telegram" without an input, and "Log in through Telegram to be ranked" with no rows', M.n === 0 && M.chat === 'Chat needs Telegram' && !M.input && M.board === 'Log in through Telegram to be ranked' && M.rows === 0, JSON.stringify(M));
  await page.screenshot({ path: SC + 'rpg_board_guest.png' });
  console.log(JSON.stringify(T, null, 1)); console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  const fails = Object.values(T).filter(v => v.startsWith('FAIL')).length; console.log(fails ? `FAILS: ${fails}` : 'ALL OK'); process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('Error:', e); process.exit(1); });
