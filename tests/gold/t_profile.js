// tests/gold/t_profile.js — Heavy Gold profile + net: the first PLAY opens the profile screen (name prefilled from Telegram,
// Georgia suggested for 'ka'), validation messages, name_taken from the server, SAVE with real taps, G.profile + localStorage,
// a reload keeps it (the token reused from sessionStorage), the flag + name icon button (.ib #hgMe), short texts only (UI rules), the sync on login (server wins / local goes up),
// a dead session logs in again, rpc never throws (an 8 s timeout gives null), offline saves locally and sends nothing.
// The network is mocked with page.route (Supabase RPCs) and window.Telegram.WebApp is faked in an init script; telegram.org is aborted.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const TOKEN = '6f0c2a9e-1b7d-4c3e-9a51-0d2e8f4b7c11', TOKEN2 = '7a1d3b0f-2c8e-4d4f-8b62-1e3f905c8d22', TGID = 918273645;
const NAME_RE = /^[\p{L}\p{M}\p{Nd} _-]+$/u;

/* the mocked server: tg_login, hg_profile_get / hg_profile_set (the GOLD.md rules), a slow call, a failing call */
async function setup(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, hasTouch: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const M = { calls: [], profile: o.profile || null, taken: ['taken', 'admin'], tokens: [TOKEN], next: TOKEN, dead: false };
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await pg.route(/telegram\.org/, r => r.abort());
  await pg.route(/supabase\.co/, async route => {
    const rq = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const mm = rq.url().match(/\/rest\/v1\/rpc\/(\w+)$/); if (!mm) return route.abort();
    const name = mm[1]; let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (e) {}
    M.calls.push({ name, body, key: rq.headers().apikey || '' });
    const send = (j, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(j) });
    if (name === 'tg_login') { if (o.loginFail) return send({ message: 'bad init data' }, 400); M.tokens.push(M.next); return send({ token: M.next, tg_id: TGID, name: 'Nino Test' }); }
    if (name === 'hg_slow') return;                                   // never answers: the client gives up at 8 s
    if (name === 'hg_fail') return send({ message: 'boom' }, 500);
    if (!body || M.tokens.indexOf(body.token) < 0 || (M.dead && body.token === TOKEN)) return send({ message: 'bad session', code: 'P0001' }, 400);
    if (name === 'hg_profile_get') return send(M.profile ? { name: M.profile.name, country: M.profile.country } : {});
    if (name === 'hg_profile_set') {
      const n = String(body.name || '').trim();
      if ([...n].length < 3 || [...n].length > 16 || !NAME_RE.test(n)) return send({ error: 'bad_name' });
      if (!/^[A-Z]{2}$/.test(body.country || '')) return send({ error: 'bad_country' });
      if (M.taken.indexOf(n.toLowerCase()) >= 0) return send({ error: 'name_taken' });
      M.profile = { name: n, country: body.country }; return send({ ok: true, name: n, country: body.country });
    }
    return send({ message: 'no function ' + name }, 404);
  });
  if (o.tg) await pg.addInitScript(u => {
    const init = 'query_id=AAE1&user=' + encodeURIComponent(JSON.stringify(u)) + '&auth_date=1763900000&hash=0f1e2d3c4b5a69788796a5b4c3d2e1f0';
    window.Telegram = { WebApp: { initData: init, initDataUnsafe: { user: u, auth_date: 1763900000 }, platform: 'android', version: '8.0', ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, disableVerticalSwipes() {}, HapticFeedback: { impactOccurred() {} }, openTelegramLink() {} } };
  }, o.tg);
  if (o.local) await pg.addInitScript(p => { if (!sessionStorage.getItem('t_seeded')) { localStorage.setItem('hg_profile', JSON.stringify(p)); sessionStorage.setItem('t_seeded', '1'); } }, o.local);
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.net && G.profileUI);
  if (o.tg && !o.loginFail) await pg.waitForFunction(() => G.net.on, null, { timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(250);
  return { ctx, pg, M, errs, n: name => M.calls.filter(c => c.name === name) };
}
const vis = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return !!e && e.classList.contains('on') && getComputedStyle(e).display !== 'none'; }, sel);
const msg = pg => pg.evaluate(() => document.getElementById('hgPErr').textContent);
const chip = pg => pg.evaluate(() => { const b = document.getElementById('hgMe'); return { ib: b.classList.contains('ib'), i: b.querySelector('i').textContent, s: b.querySelector('span').textContent, bad: b.classList.contains('bad'), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height, inLinks: b.parentNode.id === 'titleLinks' }; });
/* UI rules: no visible text on the profile screen longer than 40 characters (country names in the grid are data) */
const shortTexts = pg => pg.evaluate(() => { const scr = document.getElementById('hgProf'), long = [], w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = n.textContent.trim(), e = n.parentElement; if (!t || !e.offsetParent || e.closest('.hgC')) continue; if ([...t].length > 40) long.push(t); }
  for (const i of scr.querySelectorAll('input')) if ([...(i.placeholder || '')].length > 20) long.push(i.placeholder);
  return { long, all: [...scr.querySelectorAll('h2,.hgMsg,.hgSel,button:not(.hgC),.hgLbl')].filter(e => e.offsetParent).map(e => e.textContent) }; });
/* the title with this module's chip (other modules' title items set aside: they have their own tests): no added scroll, the chip in the
   Rules row. `base` = the scroll of the core title alone: when the core fits (base 0), the title must fit with no scroll and every icon on screen. */
const CORE_MINE = ['hgPod', 'hgMe', 'hgTitleBoard', 'helpB'];
const titleFits = (pg, w, h) => pg.evaluate(([keep, w, h]) => {
  const scr = document.getElementById('title'), r = e => e.getBoundingClientRect(), on = b => b.top >= 0 && b.bottom <= h && b.left >= 0 && b.right <= w;
  const hid = [], hide = ids => { for (const id of ['titleExtra', 'titleLinks']) for (const c of document.getElementById(id).children) if (ids.indexOf(c.id) < 0 && c.style.display !== 'none') { hid.push(c); c.style.display = 'none'; } };
  hide(['helpB']); const base = scr.scrollHeight - scr.clientHeight; for (const c of hid.splice(0)) c.style.display = '';
  hide(keep);
  const help = r(document.getElementById('helpB'));
  const out = { base, scroll: scr.scrollHeight - scr.clientHeight, play: on(r(document.getElementById('play'))),
    links: [...document.querySelectorAll('#titleLinks > *')].filter(e => e.offsetParent).map(e => [e.id, base > 1 || on(r(e)), Math.round(r(e).width), Math.round(r(e).height), Math.abs(r(e).top - help.top) < 2]) };
  for (const c of hid) c.style.display = ''; out.ok = (base > 1 ? out.scroll <= base + 1 : out.scroll <= 1 && out.play) && out.links.every(l => l[1] && l[2] >= 52 && l[3] >= 44 && l[4]); return out; }, [CORE_MINE, w, h]);
const titleNote = (tag, f) => { if (f.base > 1) console.log('INFO ' + tag + ': the core title alone scrolls ' + f.base + ' px (a core change; see the report); this module adds ' + (f.scroll - f.base) + ' px'); };
const errHidden = pg => pg.evaluate(() => getComputedStyle(document.getElementById('err')).display === 'none');
async function fits(pg, w, h, label) {
  const f = await pg.evaluate(() => {
    const scr = document.getElementById('hgProf'), r = s => { const e = scr.querySelector(s).getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height, b: e.bottom, r: e.right }; };
    const small = [...scr.querySelectorAll('button,input')].filter(e => e.offsetParent && !e.hidden).map(e => e.getBoundingClientRect()).filter(b => b.height > 0 && b.height < 44).length;
    return { save: r('#hgSave'), list: r('#hgList'), name: r('#hgName'), search: r('#hgSearch'), scroll: scr.scrollHeight - scr.clientHeight, wide: document.documentElement.scrollWidth - window.innerWidth, small };
  });
  ok(f.save.b <= h && f.save.y >= 0 && f.name.y >= 0 && f.list.h >= 80 && f.search.b <= h && f.scroll <= 1 && f.wide <= 0 && f.small === 0 && f.save.h >= 44,
    label + ' ' + w + 'x' + h + ': the profile screen fits (name, search, a list ≥ 80 px, SAVE on screen, no scroll, every target ≥ 44 px)', f);
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE });

  /* ---------- 1. in Telegram (language ka): the first PLAY, validation, name_taken, SAVE, reload, edit ---------- */
  {
    const T = await setup(b, { tg: { id: TGID, first_name: 'Nino 🎮', last_name: 'Test', language_code: 'ka' } }); const { pg } = T;
    const lg = T.n('tg_login');
    ok(lg.length === 1 && lg[0].body && /^query_id=AAE1&user=/.test(lg[0].body.init_data) && lg[0].key.length > 20, 'on load tg_login(init_data) is called once with Telegram initData and the publishable key', { n: lg.length });
    const net = await pg.evaluate(() => ({ on: G.net.on, token: G.net.token, kept: !!sessionStorage.getItem('hg_token') }));
    ok(net.on && net.token === TOKEN && net.kept, 'G.net is online, the token is kept in sessionStorage', net);
    ok(T.n('hg_profile_get').length === 1, 'online with no profile: hg_profile_get asked once', T.n('hg_profile_get').length);
    const tf0 = await titleFits(pg, 390, 844);
    ok(tf0.ok, '390x844: the title with the profile chip fits (no scroll, PLAY and the icons on screen, the chip in the Rules row)', tf0); titleNote('390x844', tf0);
    const btn0 = await chip(pg);
    ok(btn0.ib && btn0.inLinks && btn0.i === '👤' && btn0.s === 'You' && btn0.w >= 52 && btn0.h >= 52, 'the title has a profile icon button in #titleLinks: 👤 "You" with no profile (≥ 52 px)', btn0);
    await pg.locator('#play').tap(); await pg.waitForTimeout(200);
    const s0 = await pg.evaluate(() => ({ round: !!G.S, val: document.getElementById('hgName').value }));
    ok(await vis(pg, '#hgProf') && !s0.round, 'the first PLAY opens the profile screen, no round starts', s0);
    ok(s0.val === 'Nino', 'the name is prefilled from Telegram first_name, cleaned to the name rules', s0.val);
    const sug = await pg.evaluate(() => { const l = document.getElementById('hgList'); const first = l.querySelector('.hgC'); return { cc: first && first.dataset.cc, sug: first && first.classList.contains('hgSug'), label: l.querySelector('.hgLbl') && l.querySelector('.hgLbl').textContent, n: l.querySelectorAll('.hgC:not(.hgSug)').length, flag: first && first.querySelector('.f').textContent }; });
    ok(sug.cc === 'GE' && sug.sug && /suggest/i.test(sug.label) && sug.flag === '\u{1F1EC}\u{1F1EA}', "language_code 'ka': Georgia is suggested at the top with its flag", sug);
    ok(sug.n === 249, 'the country list holds all 249 ISO 3166-1 alpha-2 countries', sug.n);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_profile_390.png') });
    await fits(pg, 390, 844, 'portrait');
    const st0 = await shortTexts(pg);
    ok(await msg(pg) === '' && st0.all.join('|') === 'YOU|Suggested|All|SAVE|Back' && !st0.long.length, 'the screen says YOU, no rule hint, no "Country:" line before a pick; every text ≤ 40 characters', st0);
    // validation
    await pg.locator('#hgName').fill('ab'); await pg.locator('#hgSave').tap(); await pg.waitForTimeout(100);
    ok(await msg(pg) === '3–16 letters, digits, _ -', 'a 2-letter name: the rule shows as the error "3–16 letters, digits, _ -"', await msg(pg));
    await pg.locator('#hgName').fill('bad$name!'); await pg.locator('#hgSave').tap(); await pg.waitForTimeout(100);
    ok(await msg(pg) === '3–16 letters, digits, _ -', 'a name with $ and !: the same message', await msg(pg));
    await pg.locator('#hgName').fill('Nino'); await pg.locator('#hgSave').tap(); await pg.waitForTimeout(100);
    ok(await msg(pg) === 'Pick a country', 'no country picked: "Pick a country"', await msg(pg));
    ok(T.n('hg_profile_set').length === 0, 'nothing is sent while the form is invalid', T.n('hg_profile_set').length);
    // search
    await pg.locator('#hgSearch').fill('geor'); await pg.waitForTimeout(80);
    const sr = await pg.evaluate(() => [...document.querySelectorAll('#hgList .hgC')].filter(b => !b.hidden).map(b => b.dataset.cc));
    ok(sr.join() === 'GE,GS', 'searching "geor" leaves Georgia and South Georgia (the suggestion hides)', sr);
    await pg.locator('#hgSearch').fill('ivory'); await pg.waitForTimeout(80);
    const sr2 = await pg.evaluate(() => [...document.querySelectorAll('#hgList .hgC')].filter(b => !b.hidden).map(b => b.dataset.cc));
    ok(sr2.join() === 'CI', 'the search knows other names too ("ivory" finds Côte d’Ivoire)', sr2);
    await pg.locator('#hgSearch').fill('geor'); await pg.waitForTimeout(80);
    await pg.locator('#hgList .hgC:not(.hgSug)[data-cc="GE"]').tap(); await pg.waitForTimeout(80);
    const selT = await pg.locator('#hgSel').textContent();
    ok(selT === '\u{1F1EC}\u{1F1EA} Georgia' && await msg(pg) !== 'Pick a country', 'a tap on Georgia selects it: the chip shows the flag and the name', selT);
    // name_taken from the server
    await pg.locator('#hgName').fill('Taken'); await pg.locator('#hgSave').tap(); await pg.waitForTimeout(400);
    const tk = await pg.evaluate(() => ({ on: document.getElementById('hgProf').classList.contains('on'), name: G.profile.name, round: !!G.S }));
    ok(await msg(pg) === 'Name taken' && tk.on && !tk.name && !tk.round, 'the server says name_taken: "Name taken", the screen stays, nothing saved', { m: await msg(pg), tk });
    // typing with the keyboard: space and J must reach the field (the core's skill keys)
    await pg.locator('#hgName').fill(''); await pg.locator('#hgName').focus(); await pg.keyboard.type('Jaja Nino');
    const typed = await pg.locator('#hgName').inputValue();
    ok(typed === 'Jaja Nino', 'typing a space and J in the name field works (the core keys do not eat them)', typed);
    await pg.locator('#hgSave').tap(); await pg.waitForTimeout(500);
    const set = T.n('hg_profile_set').slice(-1)[0];
    const sv = await pg.evaluate(() => ({ on: document.getElementById('hgProf').classList.contains('on'), p: Object.assign({}, G.profile), ls: localStorage.getItem('hg_profile'), round: !!G.S && !G.S.over, god: G.S && G.S.me.god }));
    ok(set && set.body.token === TOKEN && set.body.name === 'Jaja Nino' && set.body.country === 'GE', 'SAVE sends hg_profile_set(token, name, country)', set && set.body);
    ok(!sv.on && sv.p.name === 'Jaja Nino' && sv.p.country === 'GE' && JSON.parse(sv.ls).name === 'Jaja Nino' && JSON.parse(sv.ls).country === 'GE', 'SAVE closes the screen, fills G.profile and localStorage hg_profile', sv);
    ok(sv.round, 'after SAVE the round starts (PLAY goes through)', sv);
    // reload: kept, the token reused
    await pg.reload(); await pg.waitForFunction(() => window.G && G.profileUI); await pg.waitForTimeout(400);
    const rl = await pg.evaluate(() => ({ p: Object.assign({}, G.profile), on: G.net.on, token: G.net.token }));
    const c1 = await chip(pg);
    ok(rl.p.name === 'Jaja Nino' && rl.p.country === 'GE' && c1.ib && c1.i === '\u{1F1EC}\u{1F1EA}' && c1.s === 'Jaja Nino' && !c1.bad, 'a reload keeps the profile; the title icon is the flag, its word the name', { rl, c1 });
    ok(rl.on && rl.token === TOKEN && T.n('tg_login').length === 1, 'a reload in the same launch reuses the token from sessionStorage (no second tg_login)', { on: rl.on, logins: T.n('tg_login').length });
    await pg.locator('#play').tap(); await pg.waitForTimeout(250);
    ok(await pg.evaluate(() => !!G.S && !G.S.over) && !(await vis(pg, '#hgProf')), 'with a profile PLAY starts the round at once', null);
    // the edit button
    await pg.reload(); await pg.waitForFunction(() => window.G && G.profileUI); await pg.waitForTimeout(300);
    await pg.locator('#hgMe').tap(); await pg.waitForTimeout(200);
    const ed = await pg.evaluate(() => ({ val: document.getElementById('hgName').value, sel: [...document.querySelectorAll('#hgList .hgC.sel')].map(b => b.dataset.cc) }));
    ok(await vis(pg, '#hgProf') && ed.val === 'Jaja Nino' && ed.sel.indexOf('GE') >= 0, 'the flag + name button opens the screen with the saved name and country', ed);
    await pg.locator('#hgSearch').fill('fran'); await pg.locator('#hgList .hgC[data-cc="FR"]').tap(); await pg.locator('#hgSave').tap(); await pg.waitForTimeout(400);
    const ed2 = await pg.evaluate(() => ({ on: document.getElementById('hgProf').classList.contains('on'), round: !!G.S, btn: document.getElementById('hgMe').querySelector('i').textContent + '|' + document.getElementById('hgMe').querySelector('span').textContent, c: G.profile.country }));
    const set2 = T.n('hg_profile_set').slice(-1)[0];
    ok(!ed2.on && !ed2.round && ed2.c === 'FR' && ed2.btn === '\u{1F1EB}\u{1F1F7}|Jaja Nino' && set2.body.country === 'FR', 'editing saves the new country to the server and does not start a round', ed2);
    ok(!T.errs.length && await errHidden(pg), 'Telegram run: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 2. sync on login: the server's profile wins; with none there the local one goes up; a refused name asks again ---------- */
  {
    const T = await setup(b, { tg: { id: TGID, first_name: 'Ana', language_code: 'en' }, local: { name: 'Local Name', country: 'DE' }, profile: { name: 'Server Name', country: 'FR' } });
    const r = await T.pg.evaluate(() => ({ p: Object.assign({}, G.profile), ls: JSON.parse(localStorage.getItem('hg_profile')), btn: document.getElementById('hgMe').textContent }));
    ok(r.p.name === 'Server Name' && r.p.country === 'FR' && r.ls.name === 'Server Name' && T.n('hg_profile_set').length === 0, 'online with a server profile: hg_profile_get first, the server profile replaces the local one', r);
    await T.pg.locator('#hgMe').tap(); await T.pg.waitForTimeout(150);
    ok(await T.pg.evaluate(() => !document.querySelector('#hgList .hgSug')), "language_code 'en': no country is suggested", null);
    await T.ctx.close();
  }
  {
    const T = await setup(b, { tg: { id: TGID, first_name: 'Ana', language_code: 'en' }, local: { name: 'Offline One', country: 'IT' } });
    const s = T.n('hg_profile_set');
    ok(T.n('hg_profile_get').length === 1 && s.length === 1 && s[0].body.name === 'Offline One' && s[0].body.country === 'IT', 'online with no server profile: the local profile is sent with hg_profile_set', s.map(c => c.body));
    await T.ctx.close();
  }
  {
    const T = await setup(b, { tg: { id: TGID, first_name: 'Ana', language_code: 'en' }, local: { name: 'Taken', country: 'IT' } });
    const cb = await chip(T.pg);
    ok(cb.bad && cb.s === 'Taken', 'a name the server refused: the chip carries a red "!" badge', cb);
    await T.pg.locator('#play').tap(); await T.pg.waitForTimeout(200);
    ok(await vis(T.pg, '#hgProf') && await msg(T.pg) === 'Name taken' && await T.pg.evaluate(() => !G.S), 'a local name the server refuses (name_taken): PLAY asks for a new name', await msg(T.pg));
    await T.pg.locator('#hgName').fill('Free Name'); await T.pg.locator('#hgSave').tap(); await T.pg.waitForTimeout(400);
    ok(await T.pg.evaluate(() => !!G.S && G.profile.name === 'Free Name'), 'a free name saves and the round starts', null);
    await T.ctx.close();
  }

  /* ---------- 3. net: a dead session logs in again; errors and a timeout give null, never a throw ---------- */
  {
    const T = await setup(b, { tg: { id: TGID, first_name: 'Ana', language_code: 'en' } }); const { pg, M } = T;
    M.dead = true; M.next = TOKEN2;
    const r = await pg.evaluate(() => G.net.rpc('hg_profile_get', { token: null }));
    ok(r && typeof r === 'object' && T.n('tg_login').length === 2 && await pg.evaluate(() => G.net.token) === T.M.next && await pg.evaluate(() => JSON.parse(sessionStorage.getItem('hg_token')).t) === TOKEN2,
      'a dead session: one new tg_login, the call repeated with the new token, the new token kept', { r, logins: T.n('tg_login').length });
    const f = await pg.evaluate(() => G.net.rpc('hg_fail', { token: null }).then(v => ({ v, err: G.net.err })));
    ok(f.v === null && f.err === 'boom', 'a server error resolves null (G.net.err has the text)', f);
    const t0 = Date.now(); const sl = await pg.evaluate(() => G.net.rpc('hg_slow', { token: null }).then(v => ({ v, err: G.net.err }), e => ({ threw: String(e) })));
    const dt = Date.now() - t0;
    ok(sl.v === null && !sl.threw && dt >= 7500 && dt < 11000, 'a call with no answer gives up after 8 s and resolves null', { sl, ms: dt });
    const ev = await pg.evaluate(() => { const seen = []; G.on('net', v => seen.push(v)); return seen; });
    ok(Array.isArray(ev), 'G.on("net") listeners can be added', ev);
    await T.ctx.close();
  }
  {
    const T = await setup(b, { tg: { id: TGID, first_name: 'Ana', language_code: 'en' }, loginFail: true }); await T.pg.waitForTimeout(300);
    const r = await T.pg.evaluate(() => ({ on: G.net.on, token: G.net.token, v: null }));
    await T.pg.locator('#play').tap(); await T.pg.locator('#hgName').fill('Ana Local'); await T.pg.locator('#hgSearch').fill('spain'); await T.pg.locator('#hgList .hgC[data-cc="ES"]').tap(); await T.pg.locator('#hgSave').tap(); await T.pg.waitForTimeout(400);
    const s = await T.pg.evaluate(() => ({ p: Object.assign({}, G.profile), round: !!G.S }));
    ok(!r.on && !r.token && s.p.name === 'Ana Local' && s.round && T.n('hg_profile_set').length === 0, 'a failed login: the game stays offline, the profile saves locally, the round starts', { r, s });
    ok(!T.errs.length && await errHidden(T.pg), 'failed login: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 4. offline (no Telegram), landscape: local save, nothing sent; the layout at 844x390 and 640x360 ---------- */
  for (const [w, h] of [[844, 390], [640, 360]]) {
    const T = await setup(b, { w, h }); const { pg } = T;
    const n0 = await pg.evaluate(() => ({ on: G.net.on, token: G.net.token }));
    const tf = await titleFits(pg, w, h);
    ok(tf.ok && tf.links.length >= 3, w + 'x' + h + ': the title with the profile chip adds no scroll (none at all once the core fits); the chip sits in the Rules row', tf); titleNote(w + 'x' + h, tf);
    await pg.locator('#play').tap(); await pg.waitForTimeout(200);
    const v0 = await pg.evaluate(() => ({ val: document.getElementById('hgName').value, sug: !!document.querySelector('#hgList .hgSug') }));
    ok(await vis(pg, '#hgProf') && v0.val === '' && !v0.sug, w + 'x' + h + ' offline: PLAY opens the profile, no name prefilled, no suggestion', v0);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_profile_' + w + '.png') });
    await fits(pg, w, h, 'landscape');
    const st = await shortTexts(pg);
    ok(!st.long.length && st.all.join('|') === 'YOU|SAVE|Back', w + 'x' + h + ': the profile screen is short texts only (YOU, SAVE, Back)', st);
    await pg.locator('#hgName').fill('Local Hero'); await pg.locator('#hgSearch').fill('ital'); await pg.locator('#hgList .hgC[data-cc="IT"]').tap(); await pg.locator('#hgSave').tap(); await pg.waitForTimeout(300);
    const s = await pg.evaluate(() => ({ p: Object.assign({}, G.profile), ls: JSON.parse(localStorage.getItem('hg_profile') || 'null'), round: !!G.S }));
    ok(s.p.name === 'Local Hero' && s.p.country === 'IT' && s.ls && s.ls.country === 'IT' && s.round, w + 'x' + h + ' offline: SAVE keeps the profile locally and the round starts', s);
    ok(!n0.on && !n0.token && T.M.calls.length === 0, w + 'x' + h + ' offline: nothing is sent to the server', T.M.calls.map(c => c.name));
    ok(!T.errs.length && await errHidden(pg), w + 'x' + h + ' offline: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
