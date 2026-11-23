// tests/gold/t_training.js — god training (src/gold/js/50_training.js): XP after a round (= banked + 5 per robbery + 10 for finishing),
// a level up offers two perks on the end screen, a real tap takes one, it survives a reload, the perk reaches the game through G.addMod
// (Hermes dash time, Thor reach) for the human hero only, the cap holds after ten levels and against an edited save, the title cards keep
// "Lv N" when the core rebuilds them, 390×844, 844×390 and 640×360 fit (no scroll added), the texts are short
// ("Hermes Lv 3 [bar] +141", "Lv 3 · pick one", cards "Longer dash" / "0.3 s → 0.315 s", "✓ Longer dash"), no page errors.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const window_gain = head => (/\+(\d+)$/.exec(head || '') || [])[1];   // the "+X" at the end of the XP line

/* page helpers (run inside the page) */
const HOOK = () => { if (!window.__hooked) { window.__hooked = 1; G.on('end', (S, r) => { window.__res = r; }); } };
const BANK_COINS = () => {   // pick up every coin on the map (coin → carry, gold conserved) and bank it in a vault
  const S = G.S, me = S.me, v = S.vaults[0]; for (const c of S.coins) me.carry += c.v; S.coins.length = 0; const carried = me.carry;
  for (let i = 0; i < 150 && me.carry > 0; i++) { for (const o of S.ps) if (o !== me && Math.hypot(o.x - v.x, o.y - v.y) < 500) { o.x = v.x + (v.x < 2000 ? 1500 : -1500); o.y = v.y; } me.x = v.x; me.y = v.y; me.vx = me.vy = 0; G.step(1); }
  return { carried, bank: me.bank, conserved: G.total() === S.minted };
};
const FINISH = () => { const S = G.S; let g = 0; while (!S.over && g++ < 100) G.step(600); return { over: S.over, res: window.__res }; };

async function page(b, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('hg_profile')) localStorage.setItem('hg_profile', JSON.stringify({ name: 'Tester', country: 'GE' })); } catch (e) {} });   // the profile module holds PLAY until a profile exists
  const pg = await ctx.newPage(); pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED/i.test(m.text())) pg.errs.push(m.text()); });
  await pg.route(/telegram\.org|supabase\.co/, r => r.abort());
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.train); await pg.evaluate(HOOK);
  pg.ctx = ctx; return pg;
}
async function reload(pg, seed) {
  /* a localStorage write can race a fast reload (the new document reads the old value under load): wait, reload, check, retry */
  for (let i = 0; i < 4; i++) {
    if (seed !== undefined) await pg.evaluate(s => localStorage.setItem('hg_train', JSON.stringify(s)), seed);
    const want = await pg.evaluate(() => localStorage.getItem('hg_train')); await pg.waitForTimeout(400);
    await pg.reload(); await pg.waitForFunction(() => window.G && G.train); await pg.evaluate(HOOK);
    if (await pg.evaluate(w => localStorage.getItem('hg_train') === w, want)) break;
    if (seed === undefined) await pg.evaluate(w => { if (w != null) localStorage.setItem('hg_train', w); }, want);   // the module's own save lost to the race: put it back and reload again
  }
}
/* the title cards: every .god shows "Lv N" (= G.train) and a bar, both inside the card, the badge clear of the god's sign */
const CARDS = () => [...document.querySelectorAll('#gods .god')].map(b => {
  const r = b.getBoundingClientRect(), lv = b.querySelector('.trn-lv'), cb = b.querySelector('.trn-cb'), cv = b.querySelector('canvas');
  const l = lv && lv.getBoundingClientRect(), c = cb && cb.getBoundingClientRect(), k = cv && cv.getBoundingClientRect();
  const inside = q => q && q.left >= r.left - 0.5 && q.right <= r.right + 0.5 && q.top >= r.top - 0.5 && q.bottom <= r.bottom + 0.5;
  const clear = q => q && k && (q.right <= k.left || q.left >= k.right || q.bottom <= k.top || q.top >= k.bottom), apart = clear(l) && clear(c);
  return { god: b.dataset.god, sel: b.classList.contains('sel'), text: lv ? lv.textContent : null, want: 'Lv ' + G.train.get(b.dataset.god).lvl, bar: !!(cb && cb.firstChild), fit: inside(l) && inside(c) && !!apart, old: !!b.__old };
});
/* the end block: inside the screen's width, ≥ 44 px buttons, no clipped text, no horizontal scroll */
const ENDBOX = () => {
  const el = document.getElementById('trainEnd'), end = document.getElementById('end'), W = innerWidth, H = innerHeight;
  if (!el) return null; const r = el.getBoundingClientRect();
  const bs = [...el.querySelectorAll('button[data-perk]')].map(b => { const q = b.getBoundingClientRect(); return { id: b.dataset.perk, text: [b.querySelector('b').textContent, b.querySelector('small').textContent], sec: b.classList.contains('sec'), h: q.height, w: q.width, l: q.left, r: q.right, t: q.top, b: q.bottom, clip: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 }; });
  const overlap = bs.length === 2 && !(bs[0].r <= bs[1].l || bs[1].r <= bs[0].l || bs[0].b <= bs[1].t || bs[1].b <= bs[0].t);
  const head = el.querySelector('.trn-head'), up = el.querySelector('.trn-up');
  /* every visible text node of the block is short (≤ 40 chars): no breakdowns, no explanations */
  const long = []; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n; (n = tw.nextNode());) { const t = n.textContent.trim(); if (t.length > 40) long.push(t); }
  /* the block adds no scroll to the end screen: the overflow is the same with it hidden */
  const sc0 = end.scrollHeight - end.clientHeight; el.style.display = 'none'; const sc1 = end.scrollHeight - end.clientHeight; el.style.display = '';
  return { head: head ? head.textContent : null, up: up ? up.textContent : null, cards: bs.map(x => x.text), long, scroll: { withBlock: sc0, without: sc1 }, text: el.textContent, inX: r.left >= -0.5 && r.right <= W + 0.5, hscroll: end.scrollWidth > end.clientWidth + 1, bs, overlap, W, H,
    again: document.getElementById('again').getBoundingClientRect().bottom, big: bs.every(b => b.h >= 44 && b.w >= 44 && b.l >= 0 && b.r <= W && !b.clip), bar: !!el.querySelector('.trn-bar>span'), fill: (el.querySelector('.trn-bar>span') || {}).style ? el.querySelector('.trn-bar>span').style.width : null };
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const tag = w + 'x' + h + ': ';
    /* ---------- A: a fresh player, one round as Hermes ---------- */
    const pg = await page(b, w, h);
    let c = await pg.evaluate(CARDS);
    ok(c.length === 4 && c.every(x => x.text === 'Lv 1' && x.want === 'Lv 1' && x.bar && x.fit), tag + 'every title card shows "Lv 1" and a thin XP bar inside the card', c);
    const play = await pg.locator('#play').boundingBox(); ok(play && play.height >= 44 && play.y + play.height <= h, tag + 'PLAY still fully visible with the level badges', play);
    await pg.screenshot({ path: path.join(SHOTS, 'train_title_' + w + '.png') });
    await pg.evaluate(() => document.querySelectorAll('#gods .god').forEach(x => { x.__old = 1; }));
    await pg.locator('.god[data-god="thor"]').tap(); await pg.waitForTimeout(150);
    c = await pg.evaluate(CARDS);
    ok(c.length === 4 && c.every(x => !x.old && x.text === x.want && x.bar && x.fit) && c.find(x => x.god === 'thor').sel, tag + 'a god tap rebuilds the cards and the level badges come back', c.map(x => [x.god, x.text, x.sel, x.old]));
    await pg.locator('.god[data-god="hermes"]').tap(); await pg.waitForTimeout(100);
    await pg.locator('#play').tap(); await pg.waitForTimeout(250);
    const s0 = await pg.evaluate(() => ({ god: G.S.me.god, xp: G.train.get('hermes').xp, dash: G.mod('dash', G.S.me, 0.3) }));
    ok(s0.god === 'hermes' && s0.xp === 0 && s0.dash === 0.3, tag + 'a new Hermes starts at 0 XP, no edge', s0);
    const bk = await pg.evaluate(BANK_COINS);
    const f1 = await pg.evaluate(FINISH); await pg.waitForTimeout(1000);
    const t1 = await pg.evaluate(() => ({ t: G.train.get('hermes'), L: G.train.LEVELS }));
    const want = f1.res ? f1.res.bank + 5 * f1.res.robs + 10 : -1, wantL = t1.L.filter(x => t1.t.xp >= x).length;
    ok(bk.conserved && bk.bank >= 60 && f1.over && t1.t.xp === want && t1.t.lvl === wantL && wantL >= 2, tag + 'after a round XP = banked + 5 per robbery + 10 (banked ' + (f1.res && f1.res.bank) + ', robs ' + (f1.res && f1.res.robs) + ')', { bk, res: f1.res, xp: t1.t.xp, lvl: t1.t.lvl });
    let e = await pg.evaluate(ENDBOX);
    ok(e && e.head === 'Hermes Lv ' + t1.t.lvl + '+' + want && e.bar, tag + 'the end screen: one line "Hermes Lv ' + t1.t.lvl + ' [bar] +' + want + '"', e && { head: e.head, fill: e.fill });
    ok(e && e.bs.length === 2 && e.bs.every(x => x.sec) && e.bs.map(x => x.id).join() === 'h_dash,h_speed' && e.up === 'Lv ' + t1.t.lvl + ' · pick one', tag + 'a level up: "Lv N · pick one", two perks as .sec buttons (Hermes: dash or speed)', e && { up: e.up, ids: e.bs.map(x => x.id) });
    ok(e && e.cards.length === 2 && e.cards[0][0] === 'Longer dash' && e.cards[0][1] === '0.3 s → 0.315 s' && e.cards[1][0] === 'Swift feet' && e.cards[1][1] === '+0% → +3%' && !e.long.length && e.text.split(' ').length <= 16,
      tag + 'each gift card: its name and "before → after", nothing else; no text over 40 characters', e && { cards: e.cards, long: e.long, text: e.text });
    ok(e && e.scroll.withBlock <= Math.max(0, e.scroll.without), tag + 'the XP block adds no scroll to the end screen', e && e.scroll);
    ok(e && e.inX && !e.hscroll && e.big && !e.overlap, tag + 'the end block fits the width, buttons >= 44 px, no clipped text', e && { inX: e.inX, hs: e.hscroll, bs: e.bs });
    ok(e && e.bs.every(x => x.b <= h) && e.again <= h + 1, tag + 'the perk buttons and PLAY AGAIN are on screen without scrolling', e && { perks: e.bs.map(x => Math.round(x.b)), again: Math.round(e.again) });
    await pg.screenshot({ path: path.join(SHOTS, 'train_end_' + w + '.png') });
    await pg.locator('#trainEnd button[data-perk="h_dash"]').tap(); await pg.waitForTimeout(150);
    let t2 = await pg.evaluate(() => G.train.get('hermes'));
    ok(t2.perks.h_dash === 1 && t2.pending === t1.t.pending - 1, tag + 'a tap on "Longer dash" takes it', t2);
    for (let k = 0; k < 9 && t2.pending > 0; k++) { await pg.locator('#trainEnd button[data-perk]').first().tap(); await pg.waitForTimeout(120); t2 = await pg.evaluate(() => G.train.get('hermes')); }
    e = await pg.evaluate(ENDBOX);
    ok(t2.pending === 0 && e.bs.length === 0 && /^✓ \S+ \S+$/.test(e.up) && !e.long.length, tag + 'every waiting pick taken: "✓ <gift>"', { perks: t2.perks, up: e.up, text: e.text });
    await pg.screenshot({ path: path.join(SHOTS, 'train_taken_' + w + '.png') });
    await reload(pg);
    const t3 = await pg.evaluate(() => G.train.get('hermes'));
    ok(t3.xp === t2.xp && JSON.stringify(t3.perks) === JSON.stringify(t2.perks), tag + 'XP and perks survive a reload', { before: t2, after: t3 });
    c = await pg.evaluate(CARDS);
    ok(c.find(x => x.god === 'hermes').text === 'Lv ' + t3.lvl && c.every(x => x.text === x.want && x.fit), tag + 'after the reload the Hermes card shows Lv ' + t3.lvl, c.map(x => [x.god, x.text]));
    await pg.screenshot({ path: path.join(SHOTS, 'train_title2_' + w + '.png'), clip: await pg.locator('#gods').boundingBox() });
    await pg.locator('#play').tap(); await pg.waitForTimeout(200);
    const d = await pg.evaluate(() => { const S = G.S, me = S.me; me.cd = 0; G.useSkill(me); const out = { god: me.god, dash: me.dash - S.t, mod: G.mod('dash', me, 0.3), speed: G.mod('speed', me, 100) / 100 };
      const bots = S.ps.filter(p => p.bot), bh = bots.find(p => p.god === 'hermes'); bh.cd = 0; G.useSkill(bh); out.botDash = bh.dash - S.t;
      out.botMods = bots.map(p => [G.mod('speed', p, 100), G.mod('dash', p, 0.3), G.mod('cd', p, 10), G.mod('thorR', p, 170), G.mod('thorShare', p, 0.25), G.mod('lokiT', p, 3), G.mod('chainT', p, 3), G.mod('bankT', p, 1.5), G.mod('rob', p, 0.35)].join());
      return out; });
    const k1 = t3.perks.h_dash, ks = t3.perks.h_speed || 0;
    ok(d.god === 'hermes' && near(d.dash, 0.3 * (1 + 0.05 * k1)) && near(d.mod, 0.3 * (1 + 0.05 * k1)) && near(d.speed, 1 + 0.03 * ks), tag + 'Hermes dash lasts ' + d.dash.toFixed(3) + ' s after ' + k1 + ' x "Longer dash" (0.300 without), through G.addMod', d);
    ok(near(d.botDash, 0.3) && d.botMods.every(x => x === '100,0.3,10,170,0.25,3,3,1.5,0.35'), tag + 'bots are unaffected (a bot Hermes dashes 0.300 s, every mod unchanged)', { botDash: d.botDash, mods: d.botMods[0] });
    ok(!pg.errs.length && await pg.evaluate(() => getComputedStyle(G.$('err')).display) === 'none', tag + 'no page errors, #err hidden (A)', pg.errs);
    await pg.ctx.close();

    /* ---------- B: Thor at Lv 2 takes "Wider thunder" ---------- */
    const pb = await page(b, w, h);
    await reload(pb, { v: 1, g: { thor: { xp: 60, p: {} } } });
    c = await pb.evaluate(CARDS); ok(c.find(x => x.god === 'thor').text === 'Lv 2', tag + 'a saved Thor at 60 XP shows Lv 2 on his card', c.map(x => [x.god, x.text]));
    await pb.locator('.god[data-god="thor"]').tap(); await pb.locator('#play').tap(); await pb.waitForTimeout(200);
    await pb.evaluate(FINISH); await pb.waitForTimeout(300);
    await pb.locator('#again').tap(); await pb.waitForTimeout(200);   // skip the pick: it waits for the next round
    await pb.evaluate(FINISH); await pb.waitForTimeout(300);
    const sk = await pb.evaluate(() => ({ t: G.train.get('thor'), ids: [...document.querySelectorAll('#trainEnd button[data-perk]')].map(x => x.dataset.perk) }));
    ok(sk.t.pending >= 1 && sk.ids.join() === 't_reach,t_share' && !Object.keys(sk.t.perks).length, tag + 'a skipped pick is offered again at the end of the next round', sk);
    await pb.locator('#trainEnd button[data-perk="t_reach"]').tap(); await pb.waitForTimeout(150);
    const tb = await pb.evaluate(() => G.train.get('thor'));
    ok(tb.perks.t_reach === 1, tag + 'a tap on "Wider thunder" takes it', tb.perks);
    await pb.locator('#again').tap(); await pb.waitForTimeout(200);
    const th = await pb.evaluate(() => { const S = G.S, me = S.me, ring = p => { const n = S.fx.length; p.cd = 0; G.useSkill(p); const f = S.fx.slice(n).find(x => x.kind === 'ring'); return f && f.r; };
      const bt = S.ps.find(p => p.bot && p.god === 'thor'); return { god: me.god, mod: G.mod('thorR', me, 170), ring: ring(me), botRing: ring(bt), botMod: G.mod('thorR', bt, 170) }; });
    ok(th.god === 'thor' && near(th.mod, 178.5) && near(th.ring, 178.5), tag + 'Thor thunder reaches 178.5 (170 without) after "Wider thunder"', th);
    ok(near(th.botRing, 170) && th.botMod === 170, tag + 'a bot Thor still reaches 170', th);
    ok(!pb.errs.length && await pb.evaluate(() => getComputedStyle(G.$('err')).display) === 'none', tag + 'no page errors, #err hidden (B)', pb.errs);
    await pb.ctx.close();

    /* ---------- C: the cap after ten levels, and against an edited save ---------- */
    const pc = await page(b, w, h);
    await reload(pc, { v: 1, g: { hermes: { xp: 2195, p: {} } } });   // Lv 9 with 8 picks waiting; the round's +10 for finishing makes Lv 10
    c = await pc.evaluate(CARDS); ok(c.find(x => x.god === 'hermes').text === 'Lv 9', tag + 'a saved Hermes at 2195 XP shows Lv 9', c.map(x => [x.god, x.text]));
    await pc.locator('.god[data-god="hermes"]').tap(); await pc.locator('#play').tap(); await pc.waitForTimeout(200);
    await pc.evaluate(FINISH); await pc.waitForTimeout(300);
    e = await pc.evaluate(ENDBOX); const t10 = await pc.evaluate(() => G.train.get('hermes'));
    ok(e.bs.length === 2 && e.up === 'Lv 10 · pick one' && t10.lvl === 10 && t10.pending === 9 && !e.long.length, tag + 'Lv 10: 9 picks wait, two offered at a time ("Lv 10 · pick one")', { up: e.up, pending: t10.pending });
    ok(e.inX && !e.hscroll && e.big && !e.overlap && e.bs.every(x => x.b <= h) && e.again <= h + 1, tag + 'the longest gift label still fits: perks and PLAY AGAIN on screen', { perks: e.bs.map(x => Math.round(x.b)), again: Math.round(e.again) });
    await pc.screenshot({ path: path.join(SHOTS, 'train_cap_' + w + '.png') });
    const offered = [], bad = []; let n = 0;
    for (; n < 12; n++) {
      const before = await pc.evaluate(() => ({ t: G.train.get('hermes'), ids: [...document.querySelectorAll('#trainEnd button[data-perk]')].map(x => x.dataset.perk) }));
      if (!before.ids.length) break; offered.push(before.ids.join('/'));
      if (before.ids.length !== 2 || before.ids.some(id => (before.t.perks[id] || 0) >= 3)) bad.push(before.ids);
      await pc.locator('#trainEnd button[data-perk]').first().tap(); await pc.waitForTimeout(80);
      const f = await pc.evaluate(() => ['dash', 'speed', 'bankT', 'rob'].map(m => G.train.factor('hermes', m)));
      if (f[0] > 1.15 + 1e-9 || f[1] > 1.09 + 1e-9 || f[2] < 0.85 - 1e-9 || f[3] < 0.91 - 1e-9) bad.push(f);
    }
    const tc = await pc.evaluate(() => ({ t: G.train.get('hermes'), f: ['dash', 'speed', 'bankT', 'rob'].map(m => +G.train.factor('hermes', m).toFixed(4)) }));
    const sum = Object.values(tc.t.perks).reduce((s, x) => s + x, 0);
    ok(n === 9 && sum === 9 && !bad.length && Object.values(tc.t.perks).every(x => x <= 3) && tc.t.pending === 0, tag + '9 taps on the first offer: two choices every time, no perk past 3 takes', { offered, perks: tc.t.perks, bad });
    ok(tc.f[0] <= 1.15 && tc.f[1] <= 1.09 && tc.f[2] >= 0.85 && tc.f[3] >= 0.91, tag + 'the cap holds at Lv 10: dash <= +15%, speed <= +9%, bank time >= -15%, robbed share >= -9%', tc.f);
    await reload(pc, { v: 1, g: { hermes: { xp: 99999, p: { h_dash: 99, h_speed: 99, bank: 99, purse: 99, t_reach: 99 } } } });
    await pc.locator('#play').tap(); await pc.waitForTimeout(200);
    const cap = await pc.evaluate(() => { const S = G.S, me = S.me; me.cd = 0; G.useSkill(me);
      return { god: me.god, dash: +(me.dash - S.t).toFixed(4), speed: +(G.mod('speed', me, 100)).toFixed(3), bankT: +G.mod('bankT', me, 1.5).toFixed(4), rob: +G.mod('rob', me, 0.35).toFixed(4), thorR: G.mod('thorR', me, 170), lvl: G.train.get('hermes').lvl, pend: G.train.get('hermes').pending }; });
    ok(cap.god === 'hermes' && cap.dash === 0.345 && cap.speed === 109 && cap.bankT === 1.275 && cap.rob === 0.3185 && cap.thorR === 170 && cap.lvl === 10 && cap.pend === 0, tag + 'an edited save (99 takes each) still gives at most dash 0.345 s, speed +9%, bank 1.275 s, robbed 31.85%', cap);
    const rs = await pc.evaluate(() => { G.train.reset(); return { t: G.train.get('hermes'), save: localStorage.getItem('hg_train'), box: !!document.getElementById('trainEnd'), cards: [...document.querySelectorAll('#gods .trn-lv')].map(x => x.textContent).join(), dash: G.mod('dash', G.S.me, 0.3) }; });
    ok(rs.t.xp === 0 && rs.t.lvl === 1 && rs.save === null && !rs.box && rs.cards === 'Lv 1,Lv 1,Lv 1,Lv 1' && rs.dash === 0.3, tag + 'G.train.reset() clears the save, the cards and the edge', rs);
    ok(!pc.errs.length && await pc.evaluate(() => getComputedStyle(G.$('err')).display) === 'none', tag + 'no page errors, #err hidden (C)', pc.errs);
    await pc.ctx.close();
  }
  /* ---------- D: 640×360 (the smallest landscape): the cards, the end block and PLAY AGAIN on screen, short texts ---------- */
  {
    const w = 640, h = 360, tag = w + 'x' + h + ': ';
    const pd = await page(b, w, h);
    await reload(pd, { v: 1, g: { thor: { xp: 50, p: {} } } });
    const c = await pd.evaluate(CARDS); const play = await pd.locator('#play').boundingBox();
    ok(c.length === 4 && c.every(x => x.text === x.want && x.fit) && play && play.y + play.height <= h, tag + 'the cards keep "Lv N" inside, PLAY on screen', { c: c.map(x => x.text), play });
    const sc = await pd.evaluate(() => { const t = G.$('title'), q = [...document.querySelectorAll('.trn-lv,.trn-cb')]; const a = t.scrollHeight - t.clientHeight; q.forEach(x => { x.style.display = 'none'; }); const b = t.scrollHeight - t.clientHeight; q.forEach(x => { x.style.display = ''; }); return { withBadges: a, without: b }; });
    ok(sc.withBadges <= Math.max(0, sc.without), tag + 'the level badges add no scroll to the title', sc);
    await pd.locator('.god[data-god="thor"]').tap(); await pd.locator('#play').tap(); await pd.waitForTimeout(200);
    await pd.evaluate(BANK_COINS); await pd.evaluate(FINISH); await pd.waitForTimeout(900);
    const e = await pd.evaluate(ENDBOX), t = await pd.evaluate(() => G.train.get('thor'));
    ok(e && e.head === 'Thor Lv ' + t.lvl + '+' + window_gain(e.head) && e.up === 'Lv ' + t.lvl + ' · pick one' && e.cards[0][0] === 'Wider thunder' && e.cards[0][1] === '170 → 179' && !e.long.length, tag + 'the end block: "Thor Lv N [bar] +X", "Lv N · pick one", "Wider thunder" / "170 → 179"', e && { head: e.head, up: e.up, cards: e.cards });
    ok(e && e.inX && !e.hscroll && e.big && !e.overlap && e.bs.every(x => x.b <= h) && e.again <= h + 1 && e.scroll.withBlock <= Math.max(0, e.scroll.without), tag + 'perks and PLAY AGAIN on screen, no scroll added', e && { perks: e.bs.map(x => Math.round(x.b)), again: Math.round(e.again), scroll: e.scroll });
    await pd.screenshot({ path: path.join(SHOTS, 'train_end_' + w + '.png') });
    ok(!pd.errs.length && await pd.evaluate(() => getComputedStyle(G.$('err')).display) === 'none', tag + 'no page errors, #err hidden (D)', pd.errs);
    await pd.ctx.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
