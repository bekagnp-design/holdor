/* 70_minimap.js — Heavy Gold minimap: a 92 px canvas in #hudExtra, under the top-left carry/bank text (clear of the clock,
   the board and the skill button at 390×844, 844×390 and 640×360). It never takes a touch (pointer-events:none), so a drag
   that starts on it still moves the hero. It shows the 4000×4000 arena, the camera's view, the two vaults (gold rings) and
   the next vault spots once they are announced (dashed), you (a white dot with your facing) and the other heroes (dots in
   their god's colour, larger the more they carry; a vanished Loki shows only as his decoy). No coins. Redrawn on 'hud'
   (10 times a second) at most. While you carry gold a dashed line leads to the nearest vault, because the core's off-screen
   vault arrow can fall under this panel (top-left corner). G.minimap = { el, dots, marks, draws, rect(), map(x, y), draw() }:
   dots/marks are in CSS px inside the canvas, rect() is the canvas box on the page (for a core that keeps arrows clear of it). */
(() => {
  const G = window.G; if (!G) return;
  const host = document.getElementById('hudExtra') || document.getElementById('hud'); if (!host) return;
  const SZ = 92, PAD = 5, TAU = Math.PI * 2;
  const css = document.createElement('style');
  css.textContent = '#hgMini{position:absolute;left:calc(10px + env(safe-area-inset-left));top:calc(84px + env(safe-area-inset-top));width:' + SZ + 'px;height:' + SZ + 'px;pointer-events:none;border-radius:10px;display:block}';
  document.head.appendChild(css);
  const cv = document.createElement('canvas'); cv.id = 'hgMini'; cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
  const c = cv.getContext('2d');
  let dpr = 0;
  const fit = () => { const d = Math.min(3, Math.max(1, window.devicePixelRatio || 1)); if (d !== dpr) { dpr = d; cv.width = Math.round(SZ * d); cv.height = Math.round(SZ * d); } };
  fit(); window.addEventListener('resize', () => { fit(); draw(true); });

  const scale = () => (SZ - 2 * PAD) / (G.WORLD || 4000);
  const map = (x, y) => { const k = scale(); return { x: PAD + x * k, y: PAD + y * k }; };
  const dotR = carry => 2.2 + Math.min(4.6, Math.sqrt(Math.max(0, carry || 0)) * 0.3);
  const colOf = g => (G.GODS[g] && G.GODS[g].c) || '#c8cdd6';
  const viewK = me => { const base = Math.min(1.5, Math.max(0.65, Math.sqrt(G.W * G.H) / 680)) / (1 + (G.radius(me) - 17) / 140);
    try { return typeof G.mod === 'function' ? G.mod('view', me, base) : base; } catch (e) { return base; } };
  const panel = () => { const r = 9, w = SZ - 1, h = SZ - 1; c.beginPath(); c.moveTo(0.5 + r, 0.5); c.arcTo(0.5 + w, 0.5, 0.5 + w, 0.5 + h, r); c.arcTo(0.5 + w, 0.5 + h, 0.5, 0.5 + h, r);
    c.arcTo(0.5, 0.5 + h, 0.5, 0.5, r); c.arcTo(0.5, 0.5, 0.5 + w, 0.5, r); c.closePath(); c.fillStyle = 'rgba(7,12,22,.84)'; c.fill(); };

  const M = { el: cv, dots: [], marks: [], draws: 0, size: SZ, map, draw: () => draw(true), rect: () => cv.getBoundingClientRect() };
  let lastMs = -1e9;
  function draw(force) {
    const now = performance.now(); if (!force && now - lastMs < 95) return; lastMs = now;
    fit(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, SZ, SZ);
    const dots = [], marks = []; M.dots = dots; M.marks = marks; M.draws++;
    const S = G.S; if (!S) return;
    panel();
    const k = scale(), W = G.WORLD || 4000, me = S.me, t = S.t;
    // the arena border
    c.strokeStyle = 'rgba(232,184,74,.6)'; c.lineWidth = 1; c.strokeRect(PAD + 0.5, PAD + 0.5, W * k - 1, W * k - 1);
    // what the screen shows
    const kv = viewK(me) || 1, hw = G.W / 2 / kv, hh = G.H / 2 / kv, cx = S.camX != null ? S.camX : me.x, cy = S.camY != null ? S.camY : me.y;
    const x0 = Math.max(0, cx - hw), x1 = Math.min(W, cx + hw), y0 = Math.max(0, cy - hh), y1 = Math.min(W, cy + hh);
    if (x1 > x0 && y1 > y0) { c.strokeStyle = 'rgba(255,255,255,.2)'; c.strokeRect(PAD + x0 * k, PAD + y0 * k, (x1 - x0) * k, (y1 - y0) * k); }
    // while you carry gold, a line to the nearest vault (the core's edge arrow can sit under this panel)
    const nv = me.carry > 0 && S.vaults.length ? G.nearestVault(me) : null;
    if (nv) { const a = map(me.x, me.y), b = map(nv.x, nv.y); c.strokeStyle = 'rgba(232,184,74,.5)'; c.lineWidth = 1; c.setLineDash([3, 2]); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]); }
    // vaults; the next spots (dashed) once announced
    for (const v of S.vaults) {
      const p = map(v.x, v.y), r = Math.max(3.5, v.r * k);
      if (v.nx != null) { const q = map(v.nx, v.ny), al = 0.55 + 0.35 * Math.sin(t * 8);
        c.strokeStyle = 'rgba(232,184,74,.28)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
        c.strokeStyle = 'rgba(232,184,74,' + al.toFixed(2) + ')'; c.lineWidth = 1.3; c.setLineDash([2, 2]); c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.stroke(); c.setLineDash([]);
        marks.push({ kind: 'next', x: q.x, y: q.y, r }); }
      c.fillStyle = 'rgba(232,184,74,' + (v === nv ? '.5' : '.3') + ')'; c.strokeStyle = '#e8b84a'; c.lineWidth = v === nv ? 2 : 1.4; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); c.stroke();
      marks.push({ kind: 'vault', x: p.x, y: p.y, r, nearest: v === nv });
    }
    // the other heroes (a vanished one is hidden; his decoy shows as him), the heaviest first so a light dot stays on top
    const others = [];
    const seen = p => !(G.dayGod && typeof G.dayGod.visible === 'function') || G.dayGod.visible(p);   // Moon night: only what the hero's light shows
    for (const p of S.ps) if (p !== me && !(p.inv > t) && seen(p)) others.push({ name: p.name, god: p.god, x: p.x, y: p.y, carry: p.carry, decoy: false });
    for (const d of S.decoys || []) if (d.owner && d.owner !== me && seen(d)) others.push({ name: d.owner.name, god: d.owner.god, x: d.x, y: d.y, carry: d.carry, decoy: true });
    others.sort((a, b) => b.carry - a.carry);
    for (const o of others) { const p = map(o.x, o.y), r = dotR(o.carry), col = colOf(o.god);
      c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); c.stroke();
      dots.push({ name: o.name, god: o.god, x: p.x, y: p.y, r, c: col, me: false, decoy: o.decoy }); }
    // you: a white dot and a wedge for your facing
    { const p = map(me.x, me.y), r = Math.max(2.8, dotR(me.carry)), fl = Math.hypot(me.fx || 0, me.fy || 0) || 1, ux = (me.fx || 1) / fl, uy = (me.fy || 0) / fl;
      c.globalAlpha = me.inv > t ? 0.55 : 1;
      c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x + ux * (r + 5), p.y + uy * (r + 5)); c.lineTo(p.x - uy * r * 0.9, p.y + ux * r * 0.9); c.lineTo(p.x + uy * r * 0.9, p.y - ux * r * 0.9); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); c.stroke();
      c.globalAlpha = 1;
      dots.push({ name: me.name, god: me.god, x: p.x, y: p.y, r, c: '#ffffff', me: true, decoy: false, fx: ux, fy: uy }); }
  }
  G.on('start', () => { lastMs = -1e9; draw(true); });
  G.on('hud', () => draw(false));
  G.minimap = M;
})();
