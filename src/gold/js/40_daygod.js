/* 40_daygod.js — the day god. Every UTC day one god's rule holds in every arena, the same for everyone (the weekly boards stay fair).
   The week's days carry the gods' names, so each day's rule belongs to that day's god:
     Sun  Sol     Sun day        every hero 12 % faster                  (mod speed)
     Mon  Máni    Moon night     dark beyond ~340 units around you       (draw: an overlay with a soft hole; coins glimmer, rivals hidden)
     Tue  Tyr     Tyr's law      a robbery takes 50 % instead of 35 %   (mod rob)
     Wed  Odin    Odin's ravens  skill cooldowns 30 % shorter            (mod cd)
     Thu  Thor    Thor's day     every 30 s lightning hits the richest carrier (>= 10, not in a vault): 25 % spills as coins
     Fri  Freya   Freya's gold   coins worth 50 % more                   (mod coinValue; the start coins too, minted adjusted)
     Sat  Saturn  Saturn's hour  banking takes 0.75 s instead of 1.5     (mod bankT)
   API: G.dayGod = { key, name, rule, day, desc, ... } (the day in force: today's UTC day, or the forced one),
        G.setDayGod(key | 'none' | null) forces a day ('none' = no rule, null = back to the real UTC day); it takes effect at the next G.start.
        G.dayGod.active = the key in force in the running (or last) round; G.dayGod.visible(p) = false for a hero hidden by the Moon night.
        G.on('lightning', (p, loss) => …) after each strike (an event of this module, sent with G.emit).
   Slots: a banner in #titleExtra, a chip in #hudExtra (under the carry/bank block), a line in #endExtra. Gold is conserved. */
(() => {
  const G = window.G; if (!G || !G.on || !G.addMod) return;
  const DAYS = [   // index = UTC weekday, 0 = Sunday
    { key: 'sol',    name: 'Sol',    rule: 'Sun day',       day: 'Sunday',    col: '#ffcf5a', desc: 'every hero runs 12% faster' },
    { key: 'mani',   name: 'Máni',   rule: 'Moon night',    day: 'Monday',    col: '#a9c4ff', desc: 'darkness past your light; coins still glimmer' },
    { key: 'tyr',    name: 'Tyr',    rule: "Tyr's law",     day: 'Tuesday',   col: '#ff8a5a', desc: 'a robbery takes 50% instead of 35%' },
    { key: 'odin',   name: 'Odin',   rule: "Odin's ravens", day: 'Wednesday', col: '#8fd3c8', desc: 'skill cooldowns are 30% shorter' },
    { key: 'thor',   name: 'Thor',   rule: "Thor's day",    day: 'Thursday',  col: '#7b93ff', desc: 'lightning strikes the richest every 30 s' },
    { key: 'freya',  name: 'Freya',  rule: "Freya's gold",  day: 'Friday',    col: '#ffa8c8', desc: 'every coin is worth 50% more' },
    { key: 'saturn', name: 'Saturn', rule: "Saturn's hour", day: 'Saturday',  col: '#d9c38a', desc: 'banking takes 0.75 s instead of 1.5 s' },
  ];
  DAYS.forEach((d, i) => { d.dow = i; });
  const NONE = { key: 'none', name: '', rule: '', day: '', col: '#8d9bb0', desc: '', dow: -1 };
  const BY = {}; for (const d of DAYS) BY[d.key] = d; BY.none = NONE;
  const LIGHT = 340, ROB = 0.5, CD = 0.7, BANK = 0.5, SPEED = 1.12, COIN = 1.5;
  const STRIKE_T = 30, STRIKE_MIN = 10, STRIKE_SHARE = 0.25, BOLT_LIFE = 0.6, DARK = '4,7,18';
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const $ = id => document.getElementById(id);

  const today = () => DAYS[new Date().getUTCDay()];
  const msLeft = () => { const n = Date.now(); return (Math.floor(n / 864e5) + 1) * 864e5 - n; };
  const left = () => { const m = Math.max(1, Math.ceil(msLeft() / 6e4)), h = Math.floor(m / 60); return (h ? h + ' h ' : '') + (m % 60) + ' m'; };
  const nextOf = d => d.dow < 0 ? null : DAYS[(d.dow + 1) % 7];

  let forced = null, sel = today(), act = null, nextStrike = STRIKE_T, bolts = [];
  const running = () => !!(G.S && !G.S.over);
  const is = k => !!act && act.key === k;

  const DG = G.dayGod = { LIGHT, all: DAYS.map(d => Object.assign({}, d)), active: null, forced: false, strikes: [], drawn: 0, flashes: 0, view: null,
    visible: p => { const S = G.S; if (!is('mani') || !S || !p || p === S.me) return true; return G.dist(S.me, p) <= LIGHT; },
    timeLeft: msLeft };
  const sync = d => { Object.assign(DG, { key: d.key, name: d.name, rule: d.rule, day: d.day, desc: d.desc, col: d.col, dow: d.dow, forced: !!forced });
    const n = nextOf(d); DG.next = n ? { key: n.key, name: n.name, rule: n.rule, day: n.day } : null; };
  sync(sel);

  /* forcing a day (tests, the integrator): 'none' turns the module off, null goes back to the real UTC day; the next G.start applies it */
  G.setDayGod = key => {
    if (key == null || key === '' || key === 'today' || key === 'auto') forced = null;
    else if (BY[key]) forced = key; else return false;
    sel = forced ? BY[forced] : today(); sync(sel); banner(); return true;
  };

  /* ---------- the rules ---------- */
  G.addMod('rob', (p, v) => is('tyr') ? (Math.abs(v - G.ROB) < 1e-9 ? ROB : v * ROB / G.ROB) : v);
  G.addMod('cd', (p, v) => is('odin') ? v * CD : v);
  G.addMod('bankT', (p, v) => is('saturn') ? v * BANK : v);
  G.addMod('speed', (p, v) => is('sol') ? v * SPEED : v);
  G.addMod('coinValue', (p, v) => is('freya') ? Math.max(1, Math.round(v * COIN)) : v);

  G.on('start', S => {
    if (!forced) sel = today();
    act = sel; sync(act); DG.active = act.key; DG.strikes = []; bolts = []; nextStrike = STRIKE_T;
    if (act.key === 'freya') for (const c of S.coins) { const v = Math.max(1, Math.round(c.v * COIN)); S.minted += v - c.v; c.v = v; }   // the start coins too; minted keeps the sum
    chip(true);
  });

  /* Thor's day: a strike every 30 s on the hero carrying the most gold, if he carries >= 10 and stands outside the vaults.
     25 % of his carry spills as coins around him, as the core spills (no gold leaves the round). */
  const addCoin = (S, x, y, v) => { S.coins.push({ x: clamp(x, 12, G.WORLD - 12), y: clamp(y, 12, G.WORLD - 12), v }); };
  const spill = (S, x, y, amount, r) => { if (amount <= 0) return; const n = Math.min(40, amount); let rest = amount;
    for (let i = 0; i < n; i++) { const v = i === n - 1 ? rest : Math.max(1, Math.floor(amount / n)); rest -= v; if (v <= 0) continue; const a = G.rnd() * TAU, d = r * (0.7 + G.rnd() * 0.8); addCoin(S, x + Math.cos(a) * d, y + Math.sin(a) * d, v); } };
  const label = p => p === G.S.me ? 'you' : p.name + (p.bot ? ' (bot)' : '');
  function strike(S) {
    let q = null; for (const p of S.ps) if (!q || p.carry > q.carry) q = p;
    const rec = { t: +S.t.toFixed(3), id: q ? q.id : -1, name: q ? q.name : '', before: q ? q.carry : 0, loss: 0, me: q === S.me, hit: false };
    DG.strikes.push(rec);
    if (!q || q.carry < STRIKE_MIN) { rec.why = 'poor'; return; }
    if (S.vaults.some(v => G.dist(v, q) < v.r)) { rec.why = 'vault'; G.fx({ kind: 'text', x: q.x, y: q.y - 40, s: 'spared', c: '#9fc4ff', life: 1 }); G.toast('Lightning spared ' + label(q) + ' in the vault'); return; }
    const loss = Math.ceil(q.carry * STRIKE_SHARE); q.carry -= loss; q.lost += loss; q.bankT = 0;
    spill(S, q.x, q.y, loss, G.radius(q) + 26);
    rec.loss = loss; rec.hit = true;
    bolts.push({ x: q.x, y: q.y, t: S.t, seed: (Math.floor(G.rnd() * 1e9) | 1) });
    G.fx({ kind: 'ring', x: q.x, y: q.y, r: 150, c: '#9fc4ff', life: 0.7 }); G.fx({ kind: 'text', x: q.x, y: q.y - 36, s: '-' + loss, c: '#9fc4ff', life: 1.1 });
    if (q === S.me) { G.toast("Thor's lightning struck you: " + loss + ' gold spilled', 2400); G.haptic('heavy'); }
    else G.toast('Lightning struck ' + label(q) + ': ' + loss + ' gold spilled', 2000);
    G.emit('lightning', q, loss);
  }
  G.on('step', () => { const S = G.S; if (!S || !is('thor')) return;
    while (S.t >= nextStrike && nextStrike < G.ROUND) { nextStrike += STRIKE_T; strike(S); } });

  /* ---------- drawing ---------- */
  G.on('draw', (ctx, k, ox, oy) => {
    const S = G.S; if (!S || !act) return;
    DG.view = { k, ox, oy };
    if (is('mani')) moon(ctx, S, k, ox, oy);
    if (bolts.length) drawBolts(ctx, S, k, ox, oy);
  });

  /* Moon night: an overlay, opaque beyond LIGHT units around the hero, with a soft hole; rivals outside the light are covered
     (their name labels reach into the soft edge, so they get a dark patch too); coins and vaults keep a faint glow */
  function moon(ctx, S, k, ox, oy) {
    const me = S.me, W = G.W, H = G.H, L = LIGHT * k, mx = me.x * k + ox, my = me.y * k + oy;
    ctx.save();
    const g = ctx.createRadialGradient(mx, my, L * 0.55, mx, my, L);
    g.addColorStop(0, 'rgba(' + DARK + ',0)'); g.addColorStop(0.45, 'rgba(' + DARK + ',.5)'); g.addColorStop(0.8, 'rgba(' + DARK + ',.9)'); g.addColorStop(1, 'rgba(' + DARK + ',1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const hid = S.ps.filter(p => p !== me).concat(S.decoys || []);
    for (const p of hid) { const d = G.dist(me, p); if (d <= LIGHT || d > LIGHT + 160) continue;
      // a soft dark blob over the body, the gold glow and the name: opaque over the box, fading out past it
      const r = G.radius(p) * k, gr = r + Math.min(40, 6 + Math.sqrt(Math.max(0, p.carry || 0)) * 1.6) * k, hw = Math.max(gr, 64) + 6, px = p.x * k + ox, py = p.y * k + oy;
      const top = py - r - 36, bot = py + gr + 6, cy = (top + bot) / 2, ex = hw * 1.45, ey = (bot - top) / 2 * 1.45;
      if (px < -ex || px > W + ex || cy < -ey || cy > H + ey) continue;
      ctx.save(); ctx.translate(px, cy); ctx.scale(ex, ey);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); pg.addColorStop(0, 'rgba(' + DARK + ',1)'); pg.addColorStop(0.8, 'rgba(' + DARK + ',1)'); pg.addColorStop(1, 'rgba(' + DARK + ',0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore(); }
    const fade = d => clamp((d - LIGHT * 0.55) / (LIGHT * 0.45), 0, 1);
    for (const v of S.vaults) for (const nx of [false, true]) { const x = nx ? v.nx : v.x, y = nx ? v.ny : v.y; if (x == null) continue;
      const a = fade(Math.hypot(x - me.x, y - me.y)); if (a <= 0) continue; const sx = x * k + ox, sy = y * k + oy, r = v.r * k;
      if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
      ctx.strokeStyle = 'rgba(232,184,74,' + (nx ? 0.25 : 0.42) * a + ')'; ctx.lineWidth = 2; ctx.setLineDash(nx ? [4, 10] : [10, 8]); ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (!nx) { ctx.fillStyle = 'rgba(243,231,196,' + 0.4 * a + ')'; ctx.font = '900 ' + Math.round(16 * k + 4) + 'px Georgia'; ctx.textAlign = 'center'; ctx.fillText('VAULT', sx, sy + 6); } }
    for (const c of S.coins) { const a = fade(Math.hypot(c.x - me.x, c.y - me.y)); if (a <= 0) continue; const sx = c.x * k + ox, sy = c.y * k + oy; if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
      const r = (c.v >= 8 ? 8 : c.v >= 4 ? 6.5 : 5) * k + 1, tw = a * (0.8 + 0.2 * Math.sin(S.t * 3 + c.x * 0.013 + c.y * 0.007));
      const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3); cg.addColorStop(0, 'rgba(255,214,110,' + 0.6 * tw + ')'); cg.addColorStop(0.35, 'rgba(255,200,90,' + 0.22 * tw + ')'); cg.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(sx, sy, r * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,228,150,' + 0.75 * tw + ')'; ctx.beginPath(); ctx.arc(sx, sy, r * 0.45, 0, TAU); ctx.fill(); }
    ctx.restore(); DG.drawn++;
  }

  /* Thor's day: a blue flash over the screen and a jagged bolt from the sky onto the struck hero */
  function drawBolts(ctx, S, k, ox, oy) {
    const W = G.W, H = G.H; ctx.save();
    for (const b of bolts) { const age = S.t - b.t; if (age < 0 || age > BOLT_LIFE) continue; const f = 1 - age / BOLT_LIFE, x = b.x * k + ox, y = b.y * k + oy;
      if (age < 0.3) { ctx.fillStyle = 'rgba(150,185,255,' + (0.34 * (1 - age / 0.3)) + ')'; ctx.fillRect(0, 0, W, H); DG.flashes++; }
      if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;
      let h = b.seed + Math.floor(age * 16) * 7919; const rr = () => { h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
      const x0 = x + (rr() - 0.5) * 120, pts = [[x0, -12]], N = 9;
      for (let i = 1; i < N; i++) { const q = i / N; pts.push([x0 + (x - x0) * q + (rr() - 0.5) * 46, -12 + (y + 12) * q]); } pts.push([x, y]);
      const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); };
      ctx.globalAlpha = f; ctx.lineJoin = ctx.lineCap = 'round';
      ctx.shadowColor = '#9fc4ff'; ctx.shadowBlur = 20; ctx.strokeStyle = 'rgba(160,195,255,.9)'; ctx.lineWidth = 7; path(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#f4f8ff'; ctx.lineWidth = 2.5; path(); ctx.stroke();
      const ig = ctx.createRadialGradient(x, y, 0, x, y, 90 * k); ig.addColorStop(0, 'rgba(220,235,255,.75)'); ig.addColorStop(1, 'rgba(150,185,255,0)');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(x, y, 90 * k, 0, TAU); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
    bolts = bolts.filter(b => S.t - b.t <= BOLT_LIFE && S.t >= b.t);
  }

  /* ---------- UI: title banner, HUD chip, end line ---------- */
  const css = document.createElement('style');
  css.textContent = '.dg-ban{border:1px solid var(--dg);border-radius:12px;background:rgba(255,255,255,.04);padding:7px 12px;font:14px/1.4 Georgia,serif;color:#cfd6e2;text-align:center;max-width:min(100%,560px);text-wrap:balance}'
    + '.dg-ban b{color:var(--dg);letter-spacing:.06em}.dg-ban .dg-t{color:var(--muted);white-space:nowrap}'
    + '@media (max-height:430px){.dg-ban{font-size:12px;line-height:1.3;padding:3px 10px;border-radius:9px}}'
    + '@media (max-height:380px){.dg-ban{font-size:11.5px;line-height:1.2;padding:1px 10px;margin:-3px 0}}'   // 640×360: PLAY stays on screen
    + '#dgChip{position:absolute;left:calc(10px + env(safe-area-inset-left));top:calc(56px + env(safe-area-inset-top));display:none;align-items:center;gap:6px;padding:4px 9px 4px 7px;border-radius:999px;'
    + 'border:1px solid var(--dg);background:rgba(7,12,22,.66);color:var(--ink);font:700 11px/1.1 Georgia,serif;letter-spacing:.07em;white-space:nowrap;pointer-events:none;text-shadow:0 1px 2px #000}'
    + '#dgChip.on{display:flex}#dgChip i{width:8px;height:8px;border-radius:50%;background:var(--dg);box-shadow:0 0 6px var(--dg)}'
    + '#dgChip.hot{box-shadow:0 0 12px var(--dg)}#dgChip.hot i{animation:dgp .5s infinite alternate}@keyframes dgp{to{opacity:.25}}'
    + '#dgEnd b{color:var(--dg)}';
  document.head.appendChild(css);

  function banner() {
    const box = $('titleExtra'); if (!box) return;
    let el = $('dgBanner'); if (!el) { el = document.createElement('div'); el.id = 'dgBanner'; el.className = 'dg-ban'; box.appendChild(el); }
    if (sel.key === 'none') { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.setProperty('--dg', sel.col);
    el.innerHTML = '<b>TODAY · ' + sel.rule.toUpperCase() + '</b> — ' + sel.desc + ' <span class="dg-t">· next god in ' + left() + '</span>';
  }
  let chipTxt = '';
  function chip(force) {
    const box = $('hudExtra'); if (!box) return;
    let el = $('dgChip'); if (!el) { el = document.createElement('div'); el.id = 'dgChip'; el.innerHTML = '<i></i><span></span>'; box.appendChild(el); }
    if (!act || act.key === 'none') { el.classList.remove('on'); chipTxt = ''; return; }
    const S = G.S; let t = act.rule.toUpperCase(), hot = false;
    if (act.key === 'thor' && S && nextStrike < G.ROUND) { const s = Math.max(0, Math.ceil(nextStrike - S.t)); t = 'THOR ⚡ ' + s + ' s'; hot = s <= 3; }   /* short: the chip must stay clear of the centre line on a 390 px phone */
    if (force) { el.style.setProperty('--dg', act.col); el.classList.add('on'); }
    el.classList.toggle('hot', hot);
    const tl = $('hTL'); if (tl && tl.offsetHeight) el.style.top = (tl.offsetTop + tl.offsetHeight + 6) + 'px';   // right under the carry/bank block
    if (t !== chipTxt || force) { chipTxt = t; el.lastChild.textContent = t; }
  }
  G.on('hud', () => chip(false));
  G.on('end', () => {
    const box = $('endExtra'); if (!box) return;
    let el = $('dgEnd'); if (!el) { el = document.createElement('div'); el.id = 'dgEnd'; el.className = 'small'; box.appendChild(el); }
    if (!act || act.key === 'none') { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.setProperty('--dg', act.col);
    const n = nextOf(act); el.innerHTML = 'Today: <b>' + act.rule + '</b>' + (n ? ' · next: ' + n.rule + ' in ' + left() : '');
  });
  const refresh = () => { if (!forced && !running()) { const t = today(); if (t.key !== sel.key) { sel = t; sync(sel); } } banner(); };
  G.on('title', refresh);
  setInterval(() => { const t = $('title'); if (t && t.classList.contains('on')) refresh(); }, 15000);
  banner();
})();
