// RPG v2.0.0 (A35): R.net — Telegram login through the Supabase RPC, save/load against a server state, the one-time wallet
// import, presence, the zone chat, the boards, failures that never reach the game, and a guest (no Telegram) that stays local.
// The network is mocked with page.route; nothing leaves the machine.
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_net.js   (HOLDOR_HTML=path overrides beta/index.html)
const { chromium } = require('playwright');
const path = require('path');
const HTML = 'file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html');
const SBU = 'https://acimxvnupgpronpohheb.supabase.co', KEY_PREFIX = 'sb_publishable_';
const TOKEN = '11111111-2222-4333-8444-555555555555';
const INIT = 'query_id=AAEtest&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Tester%22%7D&auth_date=1700000000&hash=deadbeef';
const stateOf = (name, saved, extra) => Object.assign({ v: 2, saved,
  acc: { house: 'stark', champs: { jon: { unlocked: 1, runs: 0 } }, hall: [], titles: [], title: '', ach: [], world: { found: ['winterfell'], flags: {}, quests: { q1: { st: 'done' } }, bosses: {}, killed: {} }, best: { lvl: 1, kills: 0 } },
  p: { hero: 'jon', name, cls: 'knight', lvl: 5, xp: 40, hp: 200, gold: 100, gems: 5, pos: { x: 3000, y: 9000 }, stats: { str: 8, agi: 5, int: 5, vit: 6 }, pts: 0, skills: {}, spts: 0, bar: [null, null, null], gear: {}, inv: [], potions: { hp: 3, mana: 0 }, created: 1, played: 600 },
  wallet: { imported: false }, opts: { sfx: 1, haptic: 1, lang: 'en' } }, extra || {});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };

  /* one page = one fresh context (own localStorage). mock: every /rest/v1/rpc/<name> POST is recorded and answered. */
  async function open(o) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
    page.on('pageerror', e => errors.push((o.tag || '') + ' PE:' + e.message));
    const M = { reqs: [], mode: 'ok', server: o.server === undefined ? null : o.server, page };
    await page.route(u => /telegram\.org/.test(u.href), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }));
    await page.route(u => u.href.indexOf('/rest/v1/rpc/') >= 0, async route => {
      const rq = route.request(); const name = rq.url().split('/rest/v1/rpc/')[1]; let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (e) {}
      const h = rq.headers(); M.reqs.push({ name, body, apikey: h['apikey'], auth: h['authorization'], url: rq.url() });
      if (M.mode === 'fail') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'boom ' + name }) });
      if (M.mode === 'badsession' && name !== 'tg_login') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'bad session' }) });
      let res = {};
      if (name === 'tg_login') res = { token: TOKEN, tg_id: 42, name: 'Tester', save: null, save_ver: 0 };
      else if (body && body.token !== TOKEN) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'bad session' }) });
      else if (name === 'rpg_load') res = { state: M.server, wallet: { gold: 1234, gems: 56, champs: { jon: 12, arya: 3, dany: 60 } } };
      else if (name === 'rpg_save') { M.server = body.state; res = { ok: true }; }
      else if (name === 'rpg_presence') res = { players: [{ name: 'Other', house: 'lannister', lvl: 7, x: body.x + 100, y: body.y - 50, zone: body.zone, at: Date.now() }, { name: 'Third', house: 'martell', lvl: 2, x: 1, y: 2, zone: body.zone, at: Date.now() }] };
      else if (name === 'rpg_chat_send') res = { ok: true, id: 7 };
      else if (name === 'rpg_chat_list') res = { msgs: (body.since || 0) < 7 ? [{ id: 7, name: 'Tester', house: 'stark', body: 'hi there', at: Date.now() }] : [] };
      else if (name === 'rpg_board') res = { rows: [{ name: 'A', house: 'stark', lvl: 9, v: 9 }, { name: 'B', house: 'tyrell', lvl: 8, v: 8 }] };
      else return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'no rpc ' + name }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    });
    await page.addInitScript(({ tg, local }) => {
      if (tg) window.Telegram = { WebApp: { initData: tg, initDataUnsafe: {}, ready() {}, expand() {}, platform: 'test' } };
      try { if (local) localStorage.setItem('holdor_rpg', JSON.stringify(local)); else localStorage.removeItem('holdor_rpg'); } catch (e) {}
    }, { tg: o.tg || null, local: o.local || null });
    await page.goto(HTML);
    await page.waitForFunction(() => !!(window.R && R.net && R.net.ready), { timeout: 20000 });
    return M;
  }
  const names = M => M.reqs.map(r => r.name);
  const count = (M, n) => M.reqs.filter(r => r.name === n).length;
  const last = (M, n) => M.reqs.filter(r => r.name === n).slice(-1)[0];

  /* ---------- A: Telegram player, server state newer than local → pulled; wallet rides over once; save / presence / chat / board; failures ---------- */
  {
    const M = await open({ tag: 'A', tg: INIT, local: stateOf('Loc', 1000), server: stateOf('Srv', 2000) });
    const p = M.page;
    const logged = await p.evaluate(() => R.net.ready);
    await p.waitForFunction(() => !!R.boot, null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(1200);
    await p.evaluate(async () => { R.stop(); R.save(true); await R.net.save(true); }); await p.waitForTimeout(500);   // the world's own clock (played seconds, hp, position) would change the state under the save checks
    ok('A login resolved true', logged === true);
    const L = last(M, 'tg_login');
    ok('A tg_login POSTed with init_data', L && L.body && L.body.init_data === INIT, JSON.stringify(names(M)));
    ok('A headers carry apikey + Bearer publishable key', L && L.apikey && L.apikey.startsWith(KEY_PREFIX) && L.auth === 'Bearer ' + L.apikey && L.url.startsWith(SBU + '/rest/v1/rpc/'));
    const st0 = await p.evaluate(() => ({ on: R.net.on, token: R.net.token, seat: R.net.seat, tgId: R.net.tgId, name: R.state.p.name, pulled: R.net.pulled }));
    ok('A token + seat stored, on', st0.on === true && st0.token === TOKEN && st0.seat === 0 && st0.tgId === 42, JSON.stringify(st0));
    ok('A rpg_load called with token + seat 0', last(M, 'rpg_load') && last(M, 'rpg_load').body.token === TOKEN && last(M, 'rpg_load').body.seat === 0);
    ok('A server state (newer) replaced the local one', st0.name === 'Srv' && st0.pulled === true, st0.name);
    /* wallet import: gold/gems to the current hero, champions unlocked as heroes, flag set, toast, pushed */
    const w = await p.evaluate(() => ({ gold: R.state.p.gold, gems: R.state.p.gems, champs: R.state.acc.champs, wal: R.state.wallet, imp: R.net.imported, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).concat([R.net.toast || '']).join('|') }));
    ok('A wallet import added 1234 gold + 56 gems to the hero (achievements may pay real gems on top)', w.gold === 100 + 1234 && w.gems >= 5 + 56, JSON.stringify([w.gold, w.gems]));
    ok('A old champions unlocked as heroes (arya, dany new; jon kept)', w.champs.arya && w.champs.arya.unlocked === 1 && w.champs.arya.runs === 0 && w.champs.dany && w.champs.dany.unlocked === 1 && w.champs.jon && w.champs.jon.unlocked === 1 && Object.keys(w.champs).length === 3, JSON.stringify(w.champs));
    ok('A wallet flag set with the amounts', w.wal.imported === true && w.wal.gold0 === 1234 && w.wal.gems0 === 56 && w.wal.champs0 === 2 && w.imp && w.imp.champs === 2, JSON.stringify(w.wal));
    ok('A toast says what rode with you', /Your gold, dragonglass and 2 champions rode with you/.test(w.toast), w.toast);
    const S1 = last(M, 'rpg_save');
    ok('A the import was pushed: rpg_save with token, seat, state.saved, imported flag', S1 && S1.body.token === TOKEN && S1.body.seat === 0 && typeof S1.body.state.saved === 'number' && S1.body.state.wallet.imported === true && S1.body.state.p.gold === 1334, S1 && JSON.stringify(Object.keys(S1.body)));
    const saves0 = count(M, 'rpg_save');
    const again = await p.evaluate(async () => { const r = await R.net.wallet.import(); return { r, gold: R.state.p.gold, n: Object.keys(R.state.acc.champs).length }; });
    ok('A a second import does nothing', again.r === false && again.gold === 1334 && again.n === 3 && count(M, 'rpg_save') === saves0, JSON.stringify(again));
    /* save: unchanged state → no POST; a change + save(true) → one POST; three debounced saves → one POST */
    const r0 = await p.evaluate(() => R.net.save(true));
    ok('A save(true) with no change sends nothing', r0 === false && count(M, 'rpg_save') === saves0);
    const r1 = await p.evaluate(async () => { R.state.p.gold += 1; return R.net.save(true); });
    const S2 = last(M, 'rpg_save');
    ok('A save(true) after a change POSTs the state with the token', r1 === true && count(M, 'rpg_save') === saves0 + 1 && S2.body.token === TOKEN && S2.body.state.p.gold === 1335 && S2.body.state.saved >= S1.body.state.saved);
    const dbg = await p.evaluate(() => { const d = R.net.cfg.saveMs; R.net.cfg.saveMs = 300; R.state.p.xp += 1; R.net.save(); R.state.p.xp += 1; R.net.save(); R.save(); return d; });
    ok('A default debounce is 5 s', dbg === 5000);
    await p.waitForTimeout(900);
    ok('A three saves in a row → one debounced POST', count(M, 'rpg_save') === saves0 + 2 && last(M, 'rpg_save').body.state.p.xp === 42, String(count(M, 'rpg_save') - saves0));
    const lsSaved = await p.evaluate(() => JSON.parse(localStorage.getItem('holdor_rpg')).saved === R.state.saved);
    ok('A localStorage copy carries the same saved stamp as the server', lsSaved);
    /* presence */
    const pr = await p.evaluate(async () => { const got = []; R.bus.on('presence', l => got.push(l.length)); R.player = { x: 1234.6, y: 5678.2 }; R.state.p.lvl = 5; R.state.acc.house = 'tully'; R.state.p.name = 'Srv'; const o = await R.net.presence(); return { n: o.length, others: R.net.others, got }; });
    const PR = last(M, 'rpg_presence');
    ok('A presence POSTs rounded x/y, zone, lvl, house (account), name (hero)', PR && PR.body.token === TOKEN && PR.body.seat === 0 && PR.body.x === 1235 && PR.body.y === 5678 && typeof PR.body.zone === 'string' && PR.body.lvl === 5 && PR.body.house === 'tully' && PR.body.name === 'Srv', PR && JSON.stringify(PR.body));
    ok('A others cached + presence event', pr.n === 2 && pr.others[0].name === 'Other' && pr.got.length === 1 && pr.got[0] === 2, JSON.stringify(pr));
    /* chat */
    const ch = await p.evaluate(async () => { const ev = []; R.bus.on('chat', (add, all) => ev.push([add.length, all.length])); const s = await R.net.chat.send('  hi   there  '); await new Promise(r => setTimeout(r, 700)); const l = await R.net.chat.list(); return { s, n: l.length, msgs: R.net.chat.msgs, since: R.net.chat.since, ev, unread: R.net.chat.unread }; });
    const CS = last(M, 'rpg_chat_send'), CL = last(M, 'rpg_chat_list');
    ok('A chat.send POSTs the trimmed body with token/seat/zone', ch.s === true && CS && CS.body.token === TOKEN && CS.body.body === 'hi there' && typeof CS.body.zone === 'string', CS && JSON.stringify(CS.body));
    ok('A chat.list pulls once, dedupes, since = last id, one chat event, unread counted', ch.n === 1 && ch.msgs[0].body === 'hi there' && ch.since === 7 && ch.ev.length === 1 && ch.unread === 1 && CL.body.since === 7, JSON.stringify(ch));
    /* board */
    const bd = await p.evaluate(async () => { const a = await R.net.board('lvl'); const b = await R.net.board('lvl'); const c = await R.net.board('fallen'); return { a: a.rows.length, same: a === b, c: c.rows.length }; });
    const BD = last(M, 'rpg_board');
    ok('A board(kind) POSTs token + kind, caches per kind', bd.a === 2 && bd.same && bd.c === 2 && BD.body.token === TOKEN && BD.body.kind === 'fallen' && count(M, 'rpg_board') === 2, JSON.stringify(bd));
    /* failures: nothing throws, err logged, three in a row → off for 60 s, resume brings it back and pushes the dirty state */
    M.mode = 'fail';
    const f = await p.evaluate(async () => { const out = {}; try { R.state.p.gold += 1; out.save = await R.net.save(true); out.pres = await R.net.presence(); out.list = await R.net.chat.list(); out.rpc = await R.net.rpc('rpg_board', { token: R.net.token, kind: 'lvl' }); } catch (e) { out.threw = String(e); } out.err = R.net.err; out.errs = R.net.errs.length; out.on = R.net.on; out.off = R.net.offUntil - Date.now(); out.dirty = R.net.dirty; return out; });
    ok('A failing RPCs resolve, nothing thrown', !f.threw && f.save === false && Array.isArray(f.pres) && Array.isArray(f.list) && f.rpc === null, JSON.stringify(f));
    ok('A error logged', /boom/.test(f.err) && f.errs >= 3, f.err);
    ok('A three failures → on=false for ~60 s, state stays dirty', f.on === false && f.off > 50000 && f.off <= 60000 && f.dirty === true, JSON.stringify([f.on, f.off]));
    const callsOff = M.reqs.length;
    const g = await p.evaluate(async () => ({ s: await R.net.chat.send('x'), b: await R.net.board('kills'), p: await R.net.presence(), r: await R.net.rpc('rpg_load', {}) }));
    ok('A while off: no network, calls resolve', M.reqs.length === callsOff && g.s === false && g.b.rows.length === 0 && Array.isArray(g.p) && g.r === null, JSON.stringify(g));
    M.mode = 'ok';
    const rs = await p.evaluate(async () => { await R.net.resume(); await new Promise(r => setTimeout(r, 200)); return { on: R.net.on, dirty: R.net.dirty, err: R.net.err }; });
    ok('A resume() → on, the dirty state pushed', rs.on === true && rs.dirty === false && last(M, 'rpg_save').body.state.p.gold === 1336, JSON.stringify(rs));
    /* hidden → flush */
    const savesH = count(M, 'rpg_save');
    await p.evaluate(() => { R.state.p.gold += 1; Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(300);
    ok('A visibilitychange hidden flushes the save', count(M, 'rpg_save') === savesH + 1 && last(M, 'rpg_save').body.state.p.gold === 1337);
    const polls = await p.evaluate(() => { const n = R.net.calls; R.running = true; R.net.tick(10000); R.net.tick(30000); return { pres: typeof R.net.tick === 'function', n }; });
    await p.waitForTimeout(250);
    ok('A poll tick fires presence (10 s) and chat (30 s)', polls.pres && count(M, 'rpg_presence') >= 2 && count(M, 'rpg_chat_list') >= 2);
    const errOverlay = await p.evaluate(() => getComputedStyle(document.getElementById('err')).display);
    ok('A no error overlay', errOverlay === 'none');
    await p.close();
  }

  /* ---------- B: local newer than the server → local pushed, nothing pulled ---------- */
  {
    const M = await open({ tag: 'B', tg: INIT, local: stateOf('Loc', 3000, { sync: 2000, wallet: { imported: true } }), server: stateOf('Srv', 2000, { wallet: { imported: true } }) });   // this device synced at 2000, then played on
    const p = M.page; await p.evaluate(() => R.net.ready); await p.waitForTimeout(100);
    const st = await p.evaluate(() => ({ name: R.state.p.name, pulled: R.net.pulled, gold: R.state.p.gold, imp: R.net.imported }));
    const S = last(M, 'rpg_save');
    ok('B local kept (newer), pushed to the server', st.name === 'Loc' && st.pulled === false && S && S.body.state.p.name === 'Loc' && M.server.p.name === 'Loc', JSON.stringify([st, names(M)]));
    ok('B wallet already imported → no second import, gold untouched', st.gold === 100 && st.imp === null);
    await p.close();
  }

  /* ---------- C: no local, server empty → nothing pulled; the local state created later is pushed on save ---------- */
  {
    const M = await open({ tag: 'C', tg: INIT, local: null, server: null });
    const p = M.page; await p.evaluate(() => R.net.ready); await p.waitForTimeout(100);
    const c0 = await p.evaluate(() => ({ st: R.state, on: R.net.on, wal: !!R.net.wal }));
    ok('C logged in, no state yet, wallet cached for a later import', c0.on === true && c0.st === null && c0.wal === true && count(M, 'rpg_save') === 0, JSON.stringify(c0));
    const c1 = await p.evaluate(async () => { R.state = R.newState(); R.state.acc = { house: 'stark', champs: {}, hall: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} } }; R.save(true); await new Promise(r => setTimeout(r, 200));
      const blank = R.state.wallet.imported; R.state.p.hero = 'brienne'; R.state.p.name = 'Brienne of Tarth'; R.save(true); /* the intro's blank hero gets nothing; the first real hero does */ await new Promise(r => setTimeout(r, 300)); return { blank, gold: R.state.p.gold, imp: R.state.wallet.imported, n: Object.keys(R.state.acc.champs).length }; });
    ok('C the first save of a real hero imports the wallet (not the blank one) and pushes', c1.blank === false && c1.imp === true && c1.gold === 1234 && c1.n === 3 && count(M, 'rpg_save') >= 1 && M.server && M.server.wallet.imported === true, JSON.stringify([c1, count(M, 'rpg_save')]));
    await p.close();
  }

  /* ---------- D: no Telegram → guest, everything local, no network ---------- */
  {
    const M = await open({ tag: 'D', tg: null, local: stateOf('Loc', 1000), server: stateOf('Srv', 2000) });
    const p = M.page;
    const d = await p.evaluate(async () => { const r = await R.net.ready; if (!R.state) R.load(); /* the boot's job (90_main), absent in this build */ const out = { ready: r, on: R.net.on, guest: R.net.guest, token: R.net.token, name: R.state && R.state.p.name };
      R.state.p.gold += 5; out.save = await R.net.save(true); out.load = await R.net.load(); out.pres = await R.net.presence(); out.send = await R.net.chat.send('hello'); out.list = await R.net.chat.list(); out.board = await R.net.board('lvl'); out.rpc = await R.net.rpc('rpg_load', {}); out.imp = await R.net.wallet.import(); out.gold = R.state.p.gold; out.calls = R.net.calls; out.err = R.net.err; return out; });
    ok('D guest: login false, on=false, no token, local state kept', d.ready === false && d.on === false && d.guest === true && d.token === null && d.name === 'Loc', JSON.stringify(d));
    ok('D every call resolves as a no-op', d.save === false && d.load === null && Array.isArray(d.pres) && d.pres.length === 0 && d.send === false && Array.isArray(d.list) && d.board.rows.length === 0 && d.rpc === null && d.imp === false && d.gold === 105 && d.err === null);
    ok('D nothing went to the network', M.reqs.length === 0 && d.calls === 0, String(M.reqs.length));
    await p.close();
  }

  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(T, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(T).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
