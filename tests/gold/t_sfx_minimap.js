// tests/gold/t_sfx_minimap.js — Heavy Gold sound (60_sfx.js) and minimap (70_minimap.js).
// Sound: the AudioContext is wrapped in an init script that counts contexts and started oscillators; no context before the
// first gesture; pickup / rob / robbed / bank / every god's skill / halving / vault warning / 20 s tick / end land in G.sfx.log;
// a burst of pickups plays once; a robbery far away is silent; mute stops every sound and survives a reload.
// Minimap: its box overlaps none of the HUD texts or the skill button at 390×844, 844×390 and 640×360; it is retina-sharp and
// takes no touch; its dots match the heroes (G.minimap.dots and the canvas pixels); a vanished Loki shows only as his decoy.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* counts AudioContexts and started oscillators / buffer sources, on top of the real WebAudio */
const AC_SPY = () => {
  window.__ac = { made: 0, osc: 0, src: 0 };
  const Real = window.AudioContext || window.webkitAudioContext; if (!Real) return;
  class Spy extends Real {
    constructor(...a) { super(...a); window.__ac.made++; }
    createOscillator() { const o = super.createOscillator(), s = o.start; o.start = function (...a) { window.__ac.osc++; return s.apply(this, a); }; return o; }
    createBufferSource() { const o = super.createBufferSource(), s = o.start; o.start = function (...a) { window.__ac.src++; return s.apply(this, a); }; return o; }
  }
  window.AudioContext = Spy; window.webkitAudioContext = Spy;
};

async function open(b, w, h) {
  const pg = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|supabase|ERR_FAILED/i.test(m.text())) errs.push(m.text()); });
  await pg.route(/telegram\.org|supabase\.co/, r => r.abort());
  await pg.addInitScript(AC_SPY);
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.sfx && G.minimap);
  return { pg, errs };
}
/* this suite is not about the profile: let PLAY through, and start the round by hand if a module still holds it */
async function play(pg, god) {
  await pg.evaluate(() => { G.beforePlay = () => true; });
  if (god) await pg.locator('.god[data-god="' + god + '"]').tap();
  await pg.locator('#play').tap(); await pg.waitForTimeout(250);
  await pg.evaluate(g => { if (!G.S || G.S.over) G.start(g || G.god); }, god || null);
}
/* in the page: a spot far from both vaults, the others moved out of the way */
const HELP = () => {
  window.__far = (S, avoid) => [[600, 600], [3400, 600], [600, 3400], [3400, 3400], [2000, 600], [600, 2000]].map(([x, y]) => ({ x, y }))
    .filter(q => !avoid || Math.hypot(q.x - avoid.x, q.y - avoid.y) > 1500)
    .sort((m, n) => Math.min(...S.vaults.map(v => Math.hypot(v.x - n.x, v.y - n.y))) - Math.min(...S.vaults.map(v => Math.hypot(v.x - m.x, v.y - m.y))))[0];
  // every other hero parked on a 400-unit grid, one per spot, far (> 1300) from the given points
  window.__clear = (S, keep, ...pts) => { const sp = []; for (let x = 300; x <= 3700; x += 400) for (let y = 300; y <= 3700; y += 400) if (pts.every(q => Math.hypot(q.x - x, q.y - y) > 1300)) sp.push({ x, y });
    let i = 0; for (const o of S.ps) if (!keep.includes(o)) { const q = sp[i++ % sp.length]; Object.assign(o, { x: q.x, y: q.y, vx: 0, vy: 0 }); } };
  window.__mark = () => { G.sfx.log.length = 0; window.__ac.osc = 0; window.__ac.src = 0; };
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE });

  /* ---------------- sound ---------------- */
  {
    const { pg, errs } = await open(b, 390, 844);
    await pg.evaluate(HELP);
    const s0 = await pg.evaluate(() => { const btn = document.getElementById('hgSound'), r = btn && btn.getBoundingClientRect();
      return { made: __ac.made, api: typeof G.sfx.play === 'function' && Array.isArray(G.sfx.log) && G.sfx.muted === false, early: G.sfx.play('bank'), made2: __ac.made,
        btn: btn && btn.textContent, inLinks: !!(btn && btn.parentElement && btn.parentElement.id === 'titleLinks'), sec: !!(btn && btn.classList.contains('sec')), h: r ? r.height : 0 }; });
    ok(s0.made === 0 && s0.made2 === 0 && s0.early === false && s0.api, 'no AudioContext before the first gesture (play() does not make one either); G.sfx = {play, muted, log}', s0);
    ok(s0.btn === 'Sound: on' && s0.inLinks && s0.sec && s0.h >= 44, 'a "Sound: on" .sec button in #titleLinks, >= 44 px', s0);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_sfx_title.png') });
    await play(pg, 'thor');
    const s1 = await pg.evaluate(() => ({ made: __ac.made, state: G.sfx.state, on: !!G.S && !G.S.over }));
    ok(s1.made === 1 && s1.on, 'the first tap makes exactly one AudioContext', s1);

    // pickup: one coin moved onto the hero; then a burst of 10 coins in one step plays one tick
    const pk = await pg.evaluate(() => { const S = G.S, me = S.me; __mark(); const c = S.coins[0]; c.x = me.x; c.y = me.y; G.step(1);
      return { log: G.sfx.log.slice(), osc: __ac.osc }; });
    ok(pk.log.includes('pickup') && pk.osc > 0, 'a pickup plays a coin tick (oscillators started)', pk);
    await wait(150);
    const burst = await pg.evaluate(() => { const S = G.S, me = S.me; __mark(); const total = G.total();
      let n = 0; for (const c of S.coins) { if (n >= 10) break; c.x = me.x + (n % 3) * 4; c.y = me.y; n++; } G.step(1);
      return { n, picks: G.sfx.log.filter(x => x === 'pickup').length, conserved: G.total() === total }; });
    ok(burst.n >= 5 && burst.picks === 1 && burst.conserved, 'a burst of pickups in one step plays one tick, not a stack', burst);
    await wait(150);

    // rob, robbed: the lighter one touches the heavier one, far from the vaults
    const rb = await pg.evaluate(() => { const S = G.S, me = S.me, bot = S.ps[1], at = __far(S); const out = {};
      for (const [mc, bc, key] of [[0, 200, 'rob'], [200, 0, 'robbed']]) { __clear(S, [me, bot], at); __mark();
        Object.assign(me, { x: at.x, y: at.y, vx: 0, vy: 0, carry: mc, imm: 0, inv: 0 }); Object.assign(bot, { x: at.x + 22, y: at.y, vx: 0, vy: 0, carry: bc, imm: 0, inv: 0, cd: S.t + 60 }); S.pairT = {};
        G.step(1); out[key] = { log: G.sfx.log.slice(), me: me.carry, bot: bot.carry }; S.pairT = {}; bot.x = at.x + 1500; }
      me.carry = 0; return out; });
    ok(rb.rob.log.includes('rob') && rb.rob.me > 0, 'you rob someone: "rob"', rb.rob);
    ok(rb.robbed.log.includes('robbed') && rb.robbed.me < 200, 'you get robbed: "robbed"', rb.robbed);
    await wait(150);

    // a robbery between two bots far away makes no sound
    const far = await pg.evaluate(() => { const S = G.S, me = S.me, a = S.ps[2], c = S.ps[3], at = __far(S), there = __far(S, at);
      Object.assign(me, { x: at.x, y: at.y, vx: 0, vy: 0, carry: 0 }); __clear(S, [me, a, c], at, there); __mark();
      Object.assign(a, { x: there.x, y: there.y, carry: 0, imm: 0, inv: 0, vx: 0, vy: 0, cd: S.t + 60 }); Object.assign(c, { x: there.x + 22, y: there.y, carry: 200, imm: 0, inv: 0, vx: 0, vy: 0, cd: S.t + 60 }); S.pairT = {};
      const robs = a.robs; G.step(1); return { robbed: a.robs > robs, log: G.sfx.log.slice() }; });
    ok(far.robbed && !far.log.some(n => /rob/.test(n)), 'a robbery between two bots off screen is silent', far);
    await wait(300);
    // the same robbery on your screen is a soft "rob_near"
    const near = await pg.evaluate(() => { const S = G.S, me = S.me, a = S.ps[2], c = S.ps[3], at = { x: me.x, y: me.y + 160 };
      __clear(S, [me, a, c], me); __mark();
      Object.assign(a, { x: at.x, y: at.y, carry: 0, imm: 0, inv: 0, vx: 0, vy: 0, cd: S.t + 60 }); Object.assign(c, { x: at.x + 22, y: at.y, carry: 200, imm: 0, inv: 0, vx: 0, vy: 0, cd: S.t + 60 }); S.pairT = {};
      const robs = a.robs; G.step(1); const out = { robbed: a.robs > robs, log: G.sfx.log.slice() }; a.x = c.x = me.x + 1500; return out; });
    ok(near.robbed && near.log.includes('rob_near') && !near.log.includes('rob') && !near.log.includes('robbed'), 'a robbery between two bots on your screen is a soft "rob_near"', near);
    await wait(150);

    // bank: 1.5 s in a vault
    const bk = await pg.evaluate(() => { const S = G.S, me = S.me, v = S.vaults[0]; me.carry = 50; const b0 = me.bank; __mark();
      __clear(S, [me], v); for (let i = 0; i < 140 && me.bank === b0; i++) { Object.assign(me, { x: v.x, y: v.y, vx: 0, vy: 0 }); G.step(1); }
      return { banked: me.bank - b0, log: G.sfx.log.slice() }; });
    ok(bk.banked >= 50 && bk.log.includes('bank'), 'banking plays the chime "bank"', bk);
    await wait(150);

    // every god's skill
    const sk = await pg.evaluate(() => { const S = G.S, me = S.me, g0 = me.god, out = {}; __mark();
      for (const g of ['hermes', 'thor', 'loki', 'amirani']) { me.god = g; me.cd = 0; out[g] = G.useSkill(me); }
      me.god = g0; me.inv = 0; me.imm = 0; return { used: out, log: G.sfx.log.slice(), osc: __ac.osc, src: __ac.src }; });
    ok(['hermes', 'thor', 'loki', 'amirani'].every(g => sk.used[g] && sk.log.includes('skill_' + g)) && sk.osc > 0 && sk.src > 0,
      'each god has his skill sound (whoosh, rumble, shimmer, clank)', sk);
    // two seconds of real play with the bots around: a few sounds, not a stream
    await pg.evaluate(() => __mark()); await wait(2000);
    const calm = await pg.evaluate(() => G.sfx.log.slice());
    ok(calm.length <= 16, 'two seconds of play with bots about: no stream of sounds', calm);

    // the vault warning, the halving, the last 20 s, the end: read from S.t, not from the toast text
    const tl = await pg.evaluate(() => { const S = G.S, out = {};
      while (S.vaults[0].nx != null) G.step(1);
      __mark(); let g = 0; while (S.vaults[0].nx == null && g++ < 3000) G.step(1); out.vault = { at: +S.t.toFixed(2), log: G.sfx.log.slice() };
      while (S.t < G.HALVE_T - 0.5) G.step(30);
      __mark(); while (S.t < G.HALVE_T + 0.2) G.step(1); out.halving = { at: +S.t.toFixed(2), log: G.sfx.log.filter(n => n !== 'pickup') };
      return out; });
    ok(tl.vault.log.includes('vault'), 'the vault-move warning plays a soft bell "vault"', tl.vault);
    ok(tl.halving.log.includes('halving'), 'a halving plays two falling notes "halving"', tl.halving);
    const tl2 = await pg.evaluate(() => { const S = G.S, out = {};
      while (S.t < G.ROUND - 20.5) G.step(30);
      __mark(); while (S.t < G.ROUND - 19.8) G.step(1); out.tick = G.sfx.log.filter(n => n === 'tick').length;
      while (S.t < G.ROUND - 0.5) G.step(30);
      __mark(); while (!S.over) G.step(1); out.end = G.sfx.log.slice();
      return out; });
    ok(tl2.tick === 1, 'the last 20 s start with a tick', tl2);
    ok(tl2.end.includes('end'), 'the round end plays "end"', tl2.end);

    // mute: the title button, saved, nothing plays, kept after a reload
    await pg.waitForTimeout(300);
    await pg.locator('#change').tap(); await pg.waitForTimeout(200);
    await pg.locator('#hgSound').tap();
    const m1 = await pg.evaluate(() => ({ btn: document.getElementById('hgSound').textContent, saved: localStorage.getItem('hg_sound'), muted: G.sfx.muted }));
    ok(m1.btn === 'Sound: off' && m1.saved === 'off' && m1.muted === true, 'the button mutes: "Sound: off", saved in hg_sound', m1);
    await play(pg, null);
    const m2 = await pg.evaluate(() => { const S = G.S, me = S.me; __mark(); const c = S.coins[0]; c.x = me.x; c.y = me.y; G.step(1);
      me.cd = 0; G.useSkill(me); const p = G.sfx.play('bank'); return { log: G.sfx.log.slice(), osc: __ac.osc, src: __ac.src, play: p }; });
    ok(!m2.log.length && m2.osc === 0 && m2.src === 0 && m2.play === false, 'muted: a pickup, a skill and play() make no sound', m2);
    await pg.reload(); await pg.waitForFunction(() => window.G && G.sfx);
    const m3 = await pg.evaluate(() => ({ muted: G.sfx.muted, btn: document.getElementById('hgSound').textContent, made: __ac.made }));
    ok(m3.muted && m3.btn === 'Sound: off' && m3.made === 0, 'mute survives a reload', m3);
    await pg.locator('#hgSound').tap();
    const m4 = await pg.evaluate(() => ({ muted: G.sfx.muted, btn: document.getElementById('hgSound').textContent, saved: localStorage.getItem('hg_sound'), made: __ac.made, log: G.sfx.log.slice() }));
    ok(!m4.muted && m4.btn === 'Sound: on' && m4.saved === 'on' && m4.made === 1, 'tapping it again turns the sound on (the tap makes the context)', m4);
    const err = await pg.evaluate(() => getComputedStyle(document.getElementById('err')).display);
    ok(!errs.length && err === 'none', 'sound: no page errors, #err hidden', errs);
    await pg.close();
  }

  /* ---------------- minimap ---------------- */
  for (const [w, h] of [[390, 844], [844, 390], [640, 360]]) {
    const { pg, errs } = await open(b, w, h);
    await play(pg, 'loki');
    // the longest HUD texts: 3-digit carry, 4-digit banks
    await pg.evaluate(() => { const S = G.S; S.me.carry = 345; S.me.bank = 1234; S.ps.forEach((p, i) => { if (p !== S.me) p.bank = 1000 + i * 111; }); });
    await pg.waitForTimeout(400);
    const box = await pg.evaluate(() => { const r = id => { const e = document.getElementById(id), b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const mm = G.minimap.el; return { mm: r('hgMini'), tl: r('hTL'), tc: r('hTC'), tr: r('hTR'), sk: r('sk'), pe: getComputedStyle(mm).pointerEvents, cw: mm.width, ch: mm.height, inExtra: mm.parentElement.id }; });
    const hit = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
    const over = ['tl', 'tc', 'tr', 'sk'].filter(k => hit(box.mm, box[k]));
    ok(!over.length && box.mm.x >= 0 && box.mm.y >= 0 && box.mm.x + box.mm.w <= w && box.mm.y + box.mm.h <= h, w + 'x' + h + ': the minimap overlaps no HUD text and not the skill button', { over, box });
    ok(box.mm.w >= 80 && box.mm.w <= 100 && box.cw === Math.round(box.mm.w * 2) && box.ch === Math.round(box.mm.h * 2) && box.pe === 'none' && box.inExtra === 'hudExtra',
      w + 'x' + h + ': ~92 px in #hudExtra, retina-sharp (2x pixels), pointer-events none', { w: box.mm.w, cw: box.cw, pe: box.pe });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_minimap_' + w + 'x' + h + '.png') });

    // the dots: heroes on a grid with different carries; G.minimap.dots and the pixels at each dot
    const d = await pg.evaluate(() => { const S = G.S, me = S.me; S.decoys = [];
      S.ps.forEach((p, i) => { Object.assign(p, { x: 500 + (i % 4) * 1000, y: 900 + Math.floor(i / 4) * 2200, carry: i * 30, inv: 0, imm: 0, vx: 0, vy: 0 }); });
      me.fx = 1; me.fy = 0; G.minimap.draw();
      const dots = G.minimap.dots, cv = G.minimap.el, cx = cv.getContext('2d'), k = cv.width / cv.getBoundingClientRect().width;
      const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
      const res = S.ps.map(p => { const e = G.minimap.map(p.x, p.y), dot = dots.find(o => o.name === p.name && !o.decoy);
        const px = Array.from(cx.getImageData(Math.round(e.x * k), Math.round(e.y * k), 1, 1).data).slice(0, 3);
        const want = p === me ? [255, 255, 255] : hex(G.GODS[p.god].c);
        return { name: p.name, at: dot ? Math.hypot(dot.x - e.x, dot.y - e.y) : 99, r: dot ? +dot.r.toFixed(2) : 0, col: Math.max(...px.map((v, j) => Math.abs(v - want[j]))), me: !!(dot && dot.me) }; });
      // a vanished Loki shows only as his decoy
      const lk = S.ps[3]; lk.inv = S.t + 5; S.decoys.push({ owner: lk, x: 2000, y: 2000, vx: 0, vy: 0, carry: 40, until: S.t + 5 }); G.minimap.draw();
      const vanish = { real: G.minimap.dots.some(o => o.name === lk.name && !o.decoy), decoy: G.minimap.dots.some(o => o.name === lk.name && o.decoy) };
      lk.inv = 0; S.decoys = [];
      // the next vault spots, once announced, are drawn dashed
      const v0 = S.vaults[0], keep = [v0.nx, v0.ny]; v0.nx = 1000; v0.ny = 3000; G.minimap.draw(); const next = G.minimap.marks.filter(m => m.kind === 'next').length; v0.nx = keep[0]; v0.ny = keep[1]; G.minimap.draw();
      return { n: dots.length, res, vanish, next, vaults: G.minimap.marks.filter(m => m.kind === 'vault').length, coins: S.coins.length }; });
    const bad = d.res.filter(o => o.at > 0.5 || o.col > 40);
    ok(d.n === 8 && !bad.length && d.res.filter(o => o.me).length === 1, w + 'x' + h + ': 8 dots at the heroes\' spots, you white, the others in their god\'s colour', bad.length ? bad : d.res.map(o => o.name + ':' + o.col));
    const rs = d.res.map(o => o.r); ok(rs.every((r, i) => !i || r >= rs[i - 1]) && rs[7] > rs[1] + 1, w + 'x' + h + ': a hero who carries more is a larger dot', rs);
    ok(!d.vanish.real && d.vanish.decoy && d.next === 1 && d.vaults === 2, w + 'x' + h + ': a vanished Loki shows only as his decoy; 2 vaults, the next spot once announced', { vanish: d.vanish, next: d.next, vaults: d.vaults });
    // redraws stay at about 10 a second
    const rate = await pg.evaluate(async () => { const a = G.minimap.draws; await new Promise(r => setTimeout(r, 1000)); return G.minimap.draws - a; });
    ok(rate >= 3 && rate <= 11, w + 'x' + h + ': the minimap redraws at most 10 times a second', { perSecond: rate });
    // a drag that starts on the minimap still moves the hero
    const m0 = await pg.evaluate(() => { const S = G.S; Object.assign(S.me, { x: 2000, y: 2000, vx: 0, vy: 0, carry: 0 }); return S.me.x; });
    const cxm = box.mm.x + box.mm.w / 2, cym = box.mm.y + box.mm.h / 2;
    await pg.mouse.move(cxm, cym); await pg.mouse.down(); await pg.mouse.move(cxm + 50, cym, { steps: 4 }); await pg.waitForTimeout(400);
    const m1 = await pg.evaluate(() => G.S.me.x); await pg.mouse.up();
    ok(m1 - m0 > 30, w + 'x' + h + ': a drag that starts on the minimap moves the hero (it takes no touch)', { dx: Math.round(m1 - m0) });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_minimap_dots_' + w + 'x' + h + '.png') });
    const err = await pg.evaluate(() => getComputedStyle(document.getElementById('err')).display);
    ok(!errs.length && err === 'none', w + 'x' + h + ': no page errors, #err hidden', errs);
    await pg.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
