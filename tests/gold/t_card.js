// tests/gold/t_card.js — Heavy Gold share card (80_card.js): a round with two real robberies by the player (the biggest take is
// the card's "Robbed <name> (bot) +N"), the 1080×1920 card (size, pixels sampled: not blank, the god's colour in his circle, gold
// in the banked number, the dark ground), its texts (G.card.last.lines: name, flag + country, #rank of N, vs 7 bots, banked,
// the robbery, Map #N · the day rule, t.me/HoldorTDBot/play), the preview in the "Share card" button (in the core's #share
// slot: the end screen grows by nothing in a short landscape window), and the share flows:
//   Telegram with stories: hg_card_put(token, base64 PNG < 400 KB, the PNG signature, 1080×1920) → shareToStory(url, {text,
//   widget_link}); "Send to a chat" with the card URL in t.me/share/url; no second upload for the same card;
//   Telegram desktop: no story, SEND TO A CHAT first, Save image through TG.downloadFile;
//   a refused upload ('rate'), a server error, a card over the limit: SAVE IMAGE (an <a download> of a real PNG), Send to a chat
//   without a card URL, Copy link ("Link copied." on the card screen itself); a slow uplink (the upload asks for 30 s);
//   outside Telegram: no server call, SAVE IMAGE + Copy link; a round started while the PNG is still being made;
// a victim's name with HTML stays text, no Telegram id in the DOM, gold conserved, and the layout at 390x844, 844x390, 640x360
// (the end screen and the card screen; screenshots in .shots/).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const TOKEN = '7d1e2f3a-4b5c-4d6e-8f70-a1b2c3d4e5f6', TGID = 918273645;
const CARD_ID = '0c5f8a2e-1d3b-4c7a-9e6f-2b4d6f8a0c1e', CARD_URL = 'https://acimxvnupgpronpohheb.supabase.co/functions/v1/hg-card?id=' + CARD_ID;
const GAME = 'https://t.me/HoldorTDBot/play';
const ME = { name: 'Ann Card', country: 'GE' };
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = buf => ({ sig: buf.slice(0, 8).equals(PNG_SIG), w: buf.length > 24 ? buf.readUInt32BE(16) : 0, h: buf.length > 24 ? buf.readUInt32BE(20) : 0, size: buf.length });

async function setup(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true });
  const pg = await ctx.newPage();
  const M = { calls: [], put: o.put || 'ok' };
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await pg.route(/telegram\.org/, r => r.abort());
  await pg.route(/supabase\.co/, async route => {
    const rq = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const mm = rq.url().match(/\/rest\/v1\/rpc\/(\w+)$/); if (!mm) return route.abort();
    const name = mm[1]; let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (e) {}
    M.calls.push({ name, body });
    const send = (j, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(j) });
    if (name === 'tg_login') return send({ token: TOKEN, tg_id: TGID, name: ME.name });
    if (!body || body.token !== TOKEN) return send({ message: 'bad session' }, 400);
    if (name === 'hg_profile_get') return send({ name: ME.name, country: ME.country });
    if (name === 'hg_profile_set') return send({ ok: true, name: body.name, country: body.country });
    if (name === 'hg_round_submit') return send({ ok: true, week: { total: 345, best: 200, rounds: 3, rank: 7 } });
    if (name === 'hg_board') return send({ scope: body.scope, since: '2026-11-23T00:00:00Z', players: [], me: null, countries: [], totals: { players: 0, rounds: 0 } });
    if (name === 'hg_card_put') {
      if (M.put === 'rate') return send({ error: 'rate' });
      if (M.put === 'down') return send({ message: 'internal error' }, 500);
      if (M.put === 'slow') await new Promise(r => setTimeout(r, 900));
      if (M.put === 'slow9') { M.stored = (M.stored || 0) + 1; await new Promise(r => setTimeout(r, 9000)); return send({ ok: true, id: CARD_ID, url: CARD_URL }).catch(() => {}); }   // stored at once, answered after 9 s
      return send({ ok: true, id: CARD_ID, url: CARD_URL });
    }
    return send({ message: 'no function ' + name }, 404);
  });
  if (o.tg) await pg.addInitScript(cfg => {
    window.__tg = { links: [], stories: [], dl: [] };
    const W = { initData: 'x', initDataUnsafe: { user: { first_name: 'Ann', language_code: 'en' } }, platform: cfg.platform, version: cfg.version,
      isVersionAtLeast(v) { const a = String(this.version).split('.').map(Number), q = String(v).split('.').map(Number); for (let i = 0; i < Math.max(a.length, q.length); i++) { const x = a[i] || 0, y = q[i] || 0; if (x !== y) return x > y; } return true; },
      ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, disableVerticalSwipes() {}, HapticFeedback: { impactOccurred() {} },
      openTelegramLink(u) { window.__tg.links.push(u); } };
    if (cfg.story) W.shareToStory = (u, p) => { window.__tg.stories.push({ u, p: JSON.parse(JSON.stringify(p)) }); };
    if (cfg.dl) W.downloadFile = (p, cb) => { window.__tg.dl.push(JSON.parse(JSON.stringify(p))); if (cb) cb(true); };
    window.Telegram = { WebApp: W };
  }, { platform: o.platform || 'ios', version: o.version || '8.0', story: o.story !== false, dl: !!o.dl });
  await pg.addInitScript(p => { try { localStorage.setItem('hg_profile', JSON.stringify(p)); localStorage.setItem('hg_god', 'thor'); } catch (e) {} }, ME);
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.card && G.net);
  if (o.tg) await pg.waitForFunction(() => G.net.on, null, { timeout: 5000 }).catch(() => {});
  await pg.evaluate(() => { if (G.setDayGod) G.setDayGod('mani'); G.setMap(5);
    window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied = t; return Promise.resolve(); } } }); });
  await pg.waitForTimeout(250);
  return { ctx, pg, M, errs, n: name => M.calls.filter(c => c.name === name) };
}

/* a round: the player robs two bots (a small take, then a big one; the second victim's name may be given), banks, the round runs out */
async function playRound(pg, victimName) {
  await pg.locator('.god[data-god="thor"]').tap(); await pg.locator('#play').tap(); await pg.waitForTimeout(150);
  return pg.evaluate(vn => {
    window.__robs = []; window.__res = null;
    if (!window.__hooked) { window.__hooked = true; G.on('rob', (t, v, take) => { if (t === G.S.me) window.__robs.push({ name: v.name, bot: v.bot, take }); }); G.on('end', (S, res) => { window.__res = Object.assign({}, res); }); }
    const S = G.S, me = S.me, setCarry = (p, v) => { S.minted += v - p.carry; p.carry = v; };   // the test keeps minted equal to the total
    const spots = [[600, 600], [3400, 600], [600, 3400], [3400, 3400], [2000, 2000]].map(([x, y]) => ({ x, y }));
    const sp = spots.sort((a, b) => Math.min(...S.vaults.map(v => Math.hypot(v.x - b.x, v.y - b.y))) - Math.min(...S.vaults.map(v => Math.hypot(v.x - a.x, v.y - a.y))))[0];
    const away = (keep, at) => { for (const o of S.ps) if (!keep.includes(o)) { o.x = at.x < 2000 ? 3800 : 200; o.y = at.y < 2000 ? 3800 - o.id * 40 : 200 + o.id * 40; o.vx = o.vy = 0; } };
    const rob = (victim, carry, name) => {
      away([me, victim], sp); setCarry(victim, carry); victim.imm = victim.inv = 0; me.imm = me.inv = 0; S.pairT = {};
      me.x = sp.x; me.y = sp.y; victim.x = sp.x + 20; victim.y = sp.y; me.vx = me.vy = victim.vx = victim.vy = 0;
      const n0 = victim.name; if (name) victim.name = name;
      const c0 = me.carry; G.step(1); victim.name = n0;   // the HUD never sees the odd name (no frame runs inside this call)
      return me.carry - c0;
    };
    setCarry(me, 0);
    const small = rob(S.ps[2], 60), big = rob(S.ps[4], 260, vn), bigName = vn || S.ps[4].name;
    const v = S.vaults[0];
    for (let i = 0; i < 160 && me.carry; i++) { away([me], v); me.x = v.x; me.y = v.y; me.vx = me.vy = 0; G.step(1); }
    let g = 0; while (!S.over && g++ < 100000) G.step(60);
    return { small, big, bigName, over: S.over, res: window.__res, robs: window.__robs.slice(), total: G.total(), minted: S.minted, bank: me.bank };
  }, victimName || null);
}
const lastCard = pg => pg.waitForFunction(() => G.card.last && G.card.canvas, null, { timeout: 5000 }).then(() => pg.evaluate(() => G.card.last)).catch(() => null);
const shareState = pg => pg.evaluate(() => {
  const scr = document.getElementById('hgCard'), vis = e => !!(e && e.offsetParent !== null && e.getBoundingClientRect().height > 0);
  const bs = [...scr.querySelectorAll('button')].filter(vis).map(b => { const r = b.getBoundingClientRect(); return { id: b.id, text: b.textContent, pri: b.classList.contains('pri'), t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height, w: r.width }; });
  return { on: scr.classList.contains('on'), state: G.card.state, err: G.card.err, msg: document.getElementById('hgCardMsg').textContent, bs, pri: bs.filter(b => b.pri).map(b => b.id), url: G.card.url };
});
const waitState = (pg, re) => pg.waitForFunction(r => !G.card.busy && new RegExp(r).test(G.card.state), re, { timeout: 8000 }).catch(() => {});
const noIds = pg => pg.evaluate(a => { const c = document.body.cloneNode(true); for (const s of c.querySelectorAll('script,style')) s.remove(); const h = c.outerHTML + document.body.innerText; return !/tg_id/i.test(h) && h.indexOf(String(a)) < 0; }, TGID);
const errHidden = pg => pg.evaluate(() => getComputedStyle(document.getElementById('err')).display === 'none');
/* pixels of the card: distinct colours on a coarse grid, gold in the banked number, the god's colour, the ground */
const pixels = pg => pg.evaluate(() => {
  const cv = G.card.canvas, c = cv.getContext('2d'), at = (x, y) => Array.from(c.getImageData(x, y, 1, 1).data).slice(0, 3);
  const grid = new Set(); for (let y = 10; y < cv.height; y += 37) for (let x = 10; x < cv.width; x += 37) { const d = c.getImageData(x, y, 1, 1).data; grid.add((d[0] >> 3) + ',' + (d[1] >> 3) + ',' + (d[2] >> 3)); }
  const band = c.getImageData(140, 1120, 800, 240).data; let gold = 0; for (let i = 0; i < band.length; i += 4) if (band[i] > 190 && band[i + 1] > 140 && band[i + 2] < 130) gold++;
  const th = document.getElementById('hgCardThumb'), tc = th.getContext('2d'), td = tc.getImageData(0, 0, th.width, th.height).data; const tcol = new Set(); for (let i = 0; i < td.length; i += 16) tcol.add((td[i] >> 4) + ',' + (td[i + 1] >> 4) + ',' + (td[i + 2] >> 4));
  return { w: cv.width, h: cv.height, colors: grid.size, gold, corner: at(4, 4), ground: at(80, 1800), god: at(660, 490), thumb: { w: th.width, h: th.height, colors: tcol.size } };
});
const near = (a, b, d) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= d);

(async () => {
  const b = await chromium.launch({ executablePath: EXE });

  /* ---------- 1. Telegram on a phone, stories on: the card, the upload, the story, a chat ---------- */
  {
    const T = await setup(b, { tg: true, platform: 'ios', version: '8.0' }); const { pg } = T;
    const R = await playRound(pg);
    const want = R.robs.reduce((m, r) => (r.take > m.take ? r : m), { take: 0 });
    ok(R.over && R.small > 0 && R.big > R.small && R.total === R.minted && R.bank > 0, 'a round with two robberies by the player and a bank; gold conserved (G.total() === minted)', { small: R.small, big: R.big, total: R.total, minted: R.minted, bank: R.bank });
    const best = await pg.evaluate(() => G.card.best());
    ok(R.robs.length >= 2 && best && best.take === want.take && best.name === want.name && best.bot === true && R.robs.some(r => r.take < want.take), 'the card keeps the biggest take of a robbery where the thief is the player', { best, robs: R.robs });
    const L = await lastCard(pg), res = R.res;
    const lines = L ? L.lines : [];
    const needs = ['HEAVY GOLD', 'THOR', ME.name, '🇬🇪 Georgia', '#' + res.rank + ' of 8', 'vs 7 bots', res.bank.toLocaleString('en-US'), 'GOLD BANKED',
      'Robbed ' + want.name + ' (bot) +' + want.take, 'Map #5 · Moon night', 'PLAY HEAVY GOLD', 't.me/HoldorTDBot/play'];
    const miss = needs.filter(s => !lines.includes(s));
    ok(L && !miss.length && L.w === 1080 && L.h === 1920, 'G.card.last.lines: name, flag + country, #rank of 8, vs 7 bots, banked, the robbery, Map #5 · Moon night, the link (1080×1920)', { miss, lines });
    const px = await pixels(pg);
    ok(px.w === 1080 && px.h === 1920 && px.colors >= 40, 'the card canvas is 1080×1920 and not blank (' + px.colors + ' colours on a coarse grid)', px);
    ok(near(px.god, [123, 147, 255], 6) && px.gold > 4000 && near(px.corner, [7, 12, 22], 6) && px.ground[2] < 60, "the god's colour in his circle (Thor blue), gold in the banked number, the dark stone ground", { god: px.god, gold: px.gold, corner: px.corner, ground: px.ground });
    ok(px.thumb.w >= 60 && px.thumb.colors >= 8, 'the end screen shows a small preview of the card in the button', px.thumb);
    const eb = await pg.evaluate(() => { const b = document.querySelector('.hgCardBtn'), r = b.getBoundingClientRect(), ex = document.getElementById('endExtra'), id = e => (e ? e.id : '');
      return { text: b.textContent, sec: b.classList.contains('sec'), h: r.height, id: b.id, inExtra: ex.contains(b), prev: id(b.previousElementSibling), next: id(b.nextElementSibling),
        challenge: [...document.querySelectorAll('button')].filter(e => /Challenge a friend/.test(e.textContent)).length, pri: [...document.querySelectorAll('#end .pri')].filter(e => e.offsetParent).length }; });
    ok(eb.text === 'Share card' && eb.sec && eb.h >= 44 && eb.id === 'share' && !eb.inExtra && eb.prev === 'again' && eb.next === 'change' && !eb.challenge && eb.pri === 1,
      '"Share card" is a .sec button (≥ 44 px) in the core\'s #share slot, between PLAY AGAIN and Change god (no second "Challenge a friend"); PLAY AGAIN stays the only primary', eb);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_card_end_390.png') });
    fs.writeFileSync(path.join(SHOTS, 'gold_card.png'), Buffer.from((await pg.evaluate(() => G.card.canvas.toDataURL('image/png'))).split(',')[1], 'base64'));
    // share
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^story$');
    const puts = T.n('hg_card_put'), put = puts[0];
    const bin = put && typeof put.body.png === 'string' ? Buffer.from(put.body.png, 'base64') : Buffer.alloc(0), P = png(bin);
    ok(puts.length === 1 && put.body.token === TOKEN && /^[A-Za-z0-9+/]+={0,2}$/.test(put.body.png) && P.sig && P.w === 1080 && P.h === 1920 && P.size < 409600,
      'the upload: hg_card_put(token, base64 PNG) with the PNG signature, 1080×1920, under 400 KB (' + Math.round(P.size / 1024) + ' KB)', { n: puts.length, P });
    if (P.sig) fs.writeFileSync(path.join(SHOTS, 'gold_card_upload.png'), bin);
    const tg = await pg.evaluate(() => window.__tg);
    const s0 = tg.stories[0];
    ok(tg.stories.length === 1 && s0.u === CARD_URL && s0.p.widget_link && s0.p.widget_link.url === GAME && s0.p.widget_link.name === 'Play Heavy Gold' && typeof s0.p.text === 'string' && s0.p.text.length <= 200 && s0.p.text.includes(res.bank.toLocaleString('en-US') + ' gold'),
      'shareToStory(url, {text, widget_link: {url: t.me/HoldorTDBot/play, name: "Play Heavy Gold"}}) with the uploaded card URL', s0);
    let S = await shareState(pg);
    ok(S.on && S.state === 'story' && S.pri.join() === 'hgCardStory' && S.bs.map(x => x.id).join() === 'hgCardStory,hgCardChat,hgCardClose' && S.bs.every(x => x.h >= 44) && S.url === CARD_URL,
      'the card screen: SHARE TO STORY (the one primary), Send to a chat, Close; all ≥ 44 px', S);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_card_share_390.png') });
    await pg.locator('#hgCardChat').tap(); await pg.waitForTimeout(100);
    const link = (await pg.evaluate(() => window.__tg.links))[0] || '';
    const q = new URL(link);
    ok(link.startsWith('https://t.me/share/url?') && q.searchParams.get('url') === GAME && q.searchParams.get('text').includes('My card: ' + CARD_URL), '"Send to a chat" opens t.me/share/url with the game link and the card URL in the text', { url: q.searchParams.get('url'), text: q.searchParams.get('text') });
    await pg.locator('#hgCardStory').tap(); await pg.waitForTimeout(100);
    await pg.locator('#hgCardClose').tap(); await pg.waitForTimeout(100);
    const closed = await pg.evaluate(() => ({ card: document.getElementById('hgCard').classList.contains('on'), end: document.getElementById('end').classList.contains('on') }));
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^story$');
    const tg2 = await pg.evaluate(() => window.__tg);
    ok(!closed.card && closed.end && tg2.stories.length === 3 && T.n('hg_card_put').length === 1 && tg2.stories.every(s => s.u === CARD_URL), 'SHARE TO STORY again and "Share card" again reuse the uploaded card (one upload, three stories); Close goes back to the end screen', { closed, stories: tg2.stories.length, puts: T.n('hg_card_put').length });
    const sv = await pg.evaluate(() => { const T = G.TG, o = { phone: G.card.storyOK() }; T.version = '7.2'; o.old = G.card.storyOK(); T.version = '8.0'; T.platform = 'tdesktop'; o.desk = G.card.storyOK(); T.platform = 'android'; o.android = G.card.storyOK(); T.platform = 'ios'; return o; });
    ok(sv.phone && !sv.old && !sv.desk && sv.android, 'stories only where they exist: Telegram 7.8+ on a phone (not 7.2, not Telegram Desktop)', sv);
    // a new round: a new card and a new upload
    await pg.locator('#hgCardClose').tap(); await pg.locator('#again').tap(); await pg.waitForTimeout(100);
    const fresh = await pg.evaluate(() => ({ last: G.card.last, url: G.card.url, best: G.card.best(), on: document.getElementById('hgCard').classList.contains('on') }));
    ok(!fresh.last && !fresh.url && !fresh.best && !fresh.on, 'a new round forgets the old card, its URL and its robbery', fresh);
    // closed while the card uploads: no story editor opens by itself; "Share card" again shares the card already up
    T.M.put = 'slow';
    await pg.evaluate(() => { let g = 0; while (!G.S.over && g++ < 1000) G.step(600); }); await lastCard(pg);
    const n0 = await pg.evaluate(() => window.__tg.stories.length);
    await pg.locator('.hgCardBtn').tap();
    await pg.waitForFunction(() => /Uploading/.test(document.getElementById('hgCardMsg').textContent), null, { timeout: 5000 }).catch(() => {});
    const busyS = await shareState(pg);
    await pg.locator('#hgCardClose').tap(); await waitState(pg, '^story$');
    const a1 = await pg.evaluate(() => ({ n: window.__tg.stories.length, on: document.getElementById('hgCard').classList.contains('on') }));
    await pg.locator('.hgCardBtn').tap(); await pg.waitForTimeout(250);
    const a2 = await pg.evaluate(() => window.__tg.stories.length);
    ok(busyS.state === 'busy' && busyS.bs.map(x => x.id).join() === 'hgCardClose' && a1.n === n0 && !a1.on && a2 === n0 + 1 && T.n('hg_card_put').length === 2,
      'closed while uploading ("Uploading your card…", only Close): no story editor opens by itself; "Share card" then shares the uploaded card', { busy: busyS.msg, a1, a2, n0, puts: T.n('hg_card_put').length });
    ok(await noIds(pg) && !T.errs.length && await errHidden(pg), 'no Telegram id in the DOM, no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 2. Telegram Desktop: no story; SEND TO A CHAT first, Save image through TG.downloadFile ---------- */
  {
    const T = await setup(b, { tg: true, platform: 'tdesktop', version: '8.0', dl: true }); const { pg } = T;
    await playRound(pg); await lastCard(pg);
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^chat$');
    const S = await shareState(pg), tg = await pg.evaluate(() => window.__tg);
    ok(S.state === 'chat' && T.n('hg_card_put').length === 1 && !tg.stories.length && S.pri.join() === 'hgCardChat' && S.bs.map(x => x.id).join() === 'hgCardChat,hgCardSave,hgCardCopy,hgCardClose',
      'Telegram Desktop: the card is uploaded, no story; SEND TO A CHAT (primary), Save image, Copy link, Close', S);
    await pg.locator('#hgCardSave').tap(); await pg.waitForTimeout(100);
    const dl = (await pg.evaluate(() => window.__tg.dl))[0];
    ok(dl && dl.url === CARD_URL && dl.file_name === 'heavy-gold-map-5.png', 'Save image uses TG.downloadFile({url, file_name}) with the uploaded card', dl);
    await pg.locator('#hgCardChat').tap(); await pg.waitForTimeout(100);
    const link = (await pg.evaluate(() => window.__tg.links))[0] || '';
    ok(new URL(link).searchParams.get('text').includes(CARD_URL), 'SEND TO A CHAT carries the card URL', link);
    ok(await noIds(pg) && !T.errs.length && await errHidden(pg), 'Telegram Desktop: no Telegram id, no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 3. a refused upload ('rate'): SAVE IMAGE, Send to a chat without a card URL, Copy link; a victim's name with HTML ---------- */
  {
    const T = await setup(b, { tg: true, put: 'rate' }); const { pg } = T;
    const odd = '<img src=x onerror="window.__xss=1">';
    const R = await playRound(pg, odd); const L = await lastCard(pg);
    const robLine = (L ? L.lines : []).find(s => s.startsWith('Robbed ')) || '';
    const want = R.robs.reduce((m, r) => (r.take > m.take ? r : m), { take: 0 });
    ok(want.name === odd && robLine.startsWith('Robbed <img src=x') && robLine.endsWith(' (bot) +' + want.take), 'a victim named with HTML: the card draws it as plain text (shortened to fit)', robLine);
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^fail$');
    let S = await shareState(pg); const tg = await pg.evaluate(() => window.__tg);
    ok(S.state === 'fail' && S.err === 'rate' && /Six cards an hour/.test(S.msg) && !tg.stories.length && S.pri.join() === 'hgCardSave' && S.bs.map(x => x.id).join() === 'hgCardSave,hgCardChat,hgCardCopy,hgCardClose',
      "a refused upload ('rate'): the message, SAVE IMAGE (primary), Send to a chat, Copy link; no story", S);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_card_fail_390.png') });
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 5000 }).catch(() => null), pg.locator('#hgCardSave').tap()]);
    const file = dl ? await dl.path().catch(() => null) : null, D = file ? png(fs.readFileSync(file)) : {};
    ok(dl && dl.suggestedFilename() === 'heavy-gold-map-5.png' && D.sig && D.w === 1080 && D.h === 1920, 'SAVE IMAGE downloads the PNG through an <a download> (heavy-gold-map-5.png, 1080×1920)', { name: dl && dl.suggestedFilename(), D });
    await pg.locator('#hgCardChat').tap(); await pg.waitForTimeout(100);
    const link = (await pg.evaluate(() => window.__tg.links))[0] || '', text = link ? new URL(link).searchParams.get('text') : '';
    ok(link.startsWith('https://t.me/share/url?') && !/hg-card/.test(text) && /I banked \d+ gold as Thor/.test(text), 'Send to a chat without a card URL after a failed upload', text);
    await pg.locator('#hgCardCopy').tap(); await pg.waitForTimeout(150);
    const cp = await pg.evaluate(() => { const m = document.getElementById('hgCardMsg'), r = m.getBoundingClientRect();
      return { t: window.__copied, msg: m.textContent, seen: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === m }; });
    ok(cp.t && cp.t.endsWith(' ' + GAME) && !/hg-card/.test(cp.t) && cp.msg === 'Link copied.' && cp.seen, 'Copy link copies the line and the game link; "Link copied." shows on the card screen itself (not in the toast under it)', cp);
    const xss = await pg.evaluate(() => ({ x: window.__xss || 0, img: document.querySelectorAll('img[src="x"]').length }));
    ok(!xss.x && !xss.img, 'the HTML name never reaches the DOM as markup', xss);
    ok(await noIds(pg) && !T.errs.length && await errHidden(pg), "'rate': no Telegram id, no page errors, #err hidden", T.errs);
    await T.ctx.close();
  }

  /* ---------- 4. a card over the size limit, then a server error ---------- */
  {
    const T = await setup(b, { tg: true, put: 'down' }); const { pg } = T;
    await playRound(pg); await lastCard(pg);
    await pg.evaluate(() => { G.card.limit = 1000; });
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^fail$');
    let S = await shareState(pg); const lite = await pg.evaluate(() => G.card.last.lite);
    ok(S.err === 'too_big' && /too big/.test(S.msg) && T.n('hg_card_put').length === 0 && lite && S.pri.join() === 'hgCardSave', 'a card over the limit: the plain card is tried, nothing is uploaded, SAVE IMAGE is offered', { S, lite, puts: T.n('hg_card_put').length });
    await pg.evaluate(() => { G.card.limit = 409600; }); await pg.locator('#hgCardClose').tap();
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^fail$');
    S = await shareState(pg);
    ok(S.err === 'net' && /Could not upload/.test(S.msg) && T.n('hg_card_put').length === 1 && S.pri.join() === 'hgCardSave', 'a server error on the upload: "Could not upload the card", SAVE IMAGE', { S, puts: T.n('hg_card_put').length });
    ok(!T.errs.length && await errHidden(pg), 'no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 4b. a slow uplink: the upload asks G.net.rpc for 30 s, not the 8 s default ---------- */
  {
    const T = await setup(b, { tg: true, put: 'slow9' }); const { pg } = T;
    await playRound(pg); await lastCard(pg);
    const len = await pg.evaluate(() => { const o = G.net.rpc, n = o.length; window.__putOpt = undefined;
      G.net.rpc = function (name, args, opt) { if (name === 'hg_card_put') window.__putOpt = opt === undefined ? null : JSON.parse(JSON.stringify(opt)); return o.apply(this, arguments); }; return n; });
    if (len < 3) T.M.put = 'ok';   // a net module without per-call timeouts would cut the 9 s answer at 8 s: check the request only
    await pg.locator('.hgCardBtn').tap();
    await pg.waitForFunction(() => !G.card.busy && /^(story|chat|fail)$/.test(G.card.state), null, { timeout: 20000 }).catch(() => {});
    const S = await shareState(pg), opt = await pg.evaluate(() => window.__putOpt);
    ok(opt && opt.timeout >= 30000, 'hg_card_put asks G.net.rpc for a 30 s timeout (a ~430 KB upload on a slow uplink)', opt);
    if (len >= 3) ok(S.state === 'story' && S.url === CARD_URL && T.n('hg_card_put').length === 1 && T.M.stored === 1, 'the server answers the upload after 9 s: the card is shared, one upload, one stored copy', { state: S.state, err: S.err, puts: T.n('hg_card_put').length, stored: T.M.stored });
    else console.log('INFO G.net.rpc takes ' + len + ' arguments (no per-call timeout yet): the 9 s upload is not tried');
    ok(!T.errs.length && await errHidden(pg), 'slow uplink: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 5. outside Telegram: no server call; SAVE IMAGE + Copy link ---------- */
  {
    const T = await setup(b, { tg: false }); const { pg } = T;
    const R = await playRound(pg); const L = await lastCard(pg);
    ok(R.over && L && L.lines.includes(ME.name) && L.lines.includes('Map #5 · Moon night'), 'offline: the card is made from the local profile and round', L && L.lines);
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^local$');
    const S = await shareState(pg);
    ok(S.state === 'local' && S.pri.join() === 'hgCardSave' && S.bs.map(x => x.id).join() === 'hgCardSave,hgCardCopy,hgCardClose' && !T.M.calls.length, 'outside Telegram: SAVE IMAGE (primary), Copy link, Close; no server call at all', { S, calls: T.M.calls.map(c => c.name) });
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 5000 }).catch(() => null), pg.locator('#hgCardSave').tap()]);
    const file = dl ? await dl.path().catch(() => null) : null, D = file ? png(fs.readFileSync(file)) : {};
    ok(dl && D.sig && D.w === 1080 && D.h === 1920, 'offline SAVE IMAGE downloads the 1080×1920 PNG', D);
    await pg.locator('#hgCardCopy').tap(); await pg.waitForTimeout(150);
    const cp = await pg.evaluate(() => window.__copied);
    ok(cp && cp.includes(GAME) && /Thor/.test(cp), 'offline Copy link copies the line and the game link', cp);
    // a new round started while the PNG is still being made: no error, and the old card never comes back
    await pg.locator('#hgCardClose').tap(); await pg.locator('#again').tap(); await pg.waitForTimeout(100);
    await pg.evaluate(() => { let g = 0; while (!G.S.over && g++ < 1000) G.step(600); }); await lastCard(pg);
    const race = await pg.evaluate(() => { document.querySelector('.hgCardBtn').click(); const busy = G.card.busy;
      document.getElementById('hgCardClose').click(); document.getElementById('again').click(); return { busy, running: !!(G.S && !G.S.over) }; });
    await pg.waitForFunction(() => !G.card.busy, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(100);
    const after = await pg.evaluate(() => ({ busy: G.card.busy, state: G.card.state, last: G.card.last, on: document.getElementById('hgCard').classList.contains('on'), running: !G.S.over }));
    ok(race.busy && race.running && !after.busy && after.state === 'idle' && !after.last && !after.on && after.running && !T.errs.length, 'a round started while the PNG is being made: no page error, the card screen stays closed, no old card', { race, after, errs: T.errs });
    await pg.evaluate(() => { let g = 0; while (!G.S.over && g++ < 1000) G.step(600); }); await lastCard(pg);
    await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^local$');
    const L2 = await pg.evaluate(() => ({ state: G.card.state, sig: G.card.last && G.card.last.sig, img: document.getElementById('hgCardImg').hidden ? 0 : document.getElementById('hgCardImg').naturalWidth }));
    ok(L2.state === 'local' && L2.sig && L2.img === 1080, 'then the next round shares its own card', { state: L2.state, img: L2.img });
    ok(!T.errs.length && await errHidden(pg), 'offline: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 6. the layout: 390x844, 844x390, 640x360 ---------- */
  for (const [w, h] of [[390, 844], [844, 390], [640, 360]]) {
    const T = await setup(b, { tg: true, w, h }); const { pg } = T, tag = w + 'x' + h + ': ';
    await playRound(pg); await lastCard(pg); await pg.waitForTimeout(150);
    const E = await pg.evaluate(() => { const r = s => { const e = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(e.top), b: Math.round(e.bottom), l: Math.round(e.left), r: Math.round(e.right), h: Math.round(e.height), w: Math.round(e.width) }; };
      const end = document.getElementById('end'), btn = document.querySelector('.hgCardBtn');
      /* the same end screen with the core's own 46 px "Challenge a friend" in the slot: what the card button costs */
      const m = () => ({ scroll: end.scrollHeight - end.clientHeight, lines: Math.round(document.getElementById('eLines').getBoundingClientRect().bottom), rank: Math.round(document.getElementById('eRank').getBoundingClientRect().top) });
      const withCard = m(), plain = document.createElement('button'); plain.className = 'sec'; plain.id = 'share'; plain.textContent = 'Challenge a friend';
      btn.replaceWith(plain); const core = m(); plain.replaceWith(btn);
      return { btn: r('.hgCardBtn'), thumb: r('#hgCardThumb'), again: r('#again'), change: r('#change'), wide: document.documentElement.scrollWidth - window.innerWidth, hs: end.scrollWidth - end.clientWidth, withCard, core }; });
    ok(E.btn.h >= 44 && E.btn.l >= 0 && E.btn.r <= w && E.wide <= 0 && E.hs <= 1 && E.thumb.h >= 36 && Math.abs(E.thumb.w / E.thumb.h - 9 / 16) < 0.04, tag + 'the "Share card" button with a 9:16 preview fits the width, ≥ 44 px', E);
    if (w !== 640) ok(E.again.b <= h, tag + 'PLAY AGAIN is on the screen', E.again); else console.log('INFO ' + tag + 'PLAY AGAIN at ' + E.again.t + '–' + E.again.b + ' (the core end screen alone already scrolls here)');
    if (w > h) ok(E.btn.t >= E.again.b && E.btn.b <= E.change.t && E.withCard.scroll <= E.core.scroll && E.withCard.lines <= E.core.lines && E.withCard.rank <= E.core.rank,
      tag + 'the card button sits in the #share slot (column 2) and grows the end screen by nothing: the round\'s lines stay where the core puts them', { withCard: E.withCard, core: E.core, btn: E.btn, again: E.again, change: E.change });
    else ok(E.change.b <= h && E.withCard.scroll <= 0, tag + 'the end screen fits, Change god included', { change: E.change, withCard: E.withCard });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_card_end_' + w + '.png') });
    await pg.locator('.hgCardBtn').scrollIntoViewIfNeeded(); await pg.locator('.hgCardBtn').tap(); await waitState(pg, '^story$');
    const C = await pg.evaluate(() => { const scr = document.getElementById('hgCard'), q = e => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; };
      const img = document.getElementById('hgCardImg'), shown = img.hidden ? document.getElementById('hgCardBig') : img;
      const bs = [...scr.querySelectorAll('button')].filter(e => e.offsetParent).map(e => Object.assign(q(e), { id: e.id, pri: e.classList.contains('pri') }));
      return { pv: q(document.querySelector('.hgCdPv')), img: !img.hidden && img.complete && img.naturalWidth, shown: q(shown), bs, scroll: scr.scrollHeight - scr.clientHeight, wide: scr.scrollWidth - scr.clientWidth, msg: q(document.getElementById('hgCardMsg')) }; });
    const inV = r => r.t >= 0 && r.l >= 0 && r.b <= h && r.r <= w;
    const over = C.bs.some(x => !(x.r <= C.pv.l || x.l >= C.pv.r || x.b <= C.pv.t || x.t >= C.pv.b));
    ok(inV(C.pv) && C.pv.h >= 220 && Math.abs(C.pv.w / C.pv.h - 9 / 16) < 0.03 && C.img === 1080 && C.bs.length === 3 && C.bs.every(x => inV(x) && x.h >= 44) && C.bs.filter(x => x.pri).length === 1 && C.scroll <= 1 && C.wide <= 1 && !over && inV(C.msg),
      tag + 'the card screen fits: the card big (' + C.pv.w + '×' + C.pv.h + ', the PNG itself), the buttons on screen ≥ 44 px, one primary, nothing overlaps, no scroll', C);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_card_share_' + w + '.png') });
    ok(await noIds(pg) && !T.errs.length && await errHidden(pg), tag + 'no Telegram id, no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
