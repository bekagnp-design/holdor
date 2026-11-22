/* HOLDOR RPG — the in-world HUD (A25; layout G5). DOM in #ui, refreshed at most 10×/s by a system of order 950, hidden while a screen is open.
   Top-left, one compact block: the hero's portrait (R.draw.portrait(hero) → A_CHAMP.art[hero+'_portrait'] → a code-drawn face; house ring)
   + level badge, the fallen chip "☠ n" under it (R.state.acc.hall, tap → the hall); the name (+ title), the HP bar with its numbers, the XP bar,
   "Lv 12 · 340/1,120" and the gold / gem chips (count-up). Tap the block → the hero sheet ('btn' 'inv'). Under it: #qtrack (A18 renders the
   tracker; tap → quest log), the TOWN pill. Top-right: A02's row (map · bag · menu), the 96-px round minimap under it (tap → map), the chat
   button (#prChat, A38) under the minimap. The message column (top-centre, under all of that): ONE bar (#bossbar > #dgbar > #evbar, the others
   wait with data-hud-yield), the tutorial card, A24's achievement card (queued under the card), the region title, the toasts — stacked by stack() so
   nothing overlaps; C1's town banner (compact, ≤ 64 px: 50_hud.css) finds its line below them. Bottom: A02's controls.
   Hooks: R.hud = {el, mm, E, refresh(), banner(id), stack(), last, shown, drawWay(ctx), wayLabel (the last quest-distance label: x, y, hx, hy, midY, tip)}. */
(function () {
  const HOUSE_COL = { stark: '#a9bdd0', lannister: '#e3b661', targaryen: '#e14b4b', greyjoy: '#d8b74a', tyrell: '#7fd06a', martell: '#f08a3c', baratheon: '#e0c14a' };
  const CLS = { knight: 'Knight', ranger: 'Ranger', maester: 'Maester' };
  const hcol = h => (R.data.houses && R.data.houses[h] && R.data.houses[h].col) || HOUSE_COL[h] || '#a9bdd0';
  const houseOf = st => { try { return houseOf_(st); } catch (e) { return 'stark'; } };
  const houseOf_ = st => (R.state.acc && R.state.acc.house) || st.house || (R.data.champs && R.data.champs[st.hero] && R.data.champs[st.hero].house) || 'stark';
  const titleOf = st => { try { return (R.state.acc && R.state.acc.title) || st.title || CLS[st.cls] || ''; } catch (e) { return CLS[st.cls] || ''; } };
  // the same curve the player module levels on (21_player P.xpNext → R.data.balance.xp), else the balance table, else ARCH's formula
  const xpNext = L => { try { const P = R.plr || R.playerSys; if (P && typeof P.xpNext === 'function') return P.xpNext(L); const B = R.data.balance; if (B && typeof B.xp === 'function') { const v = B.xp(L); if (v > 0) return v; } if (B && typeof B.xpNext === 'function') return B.xpNext(L); } catch (e) {} return 80 + 45 * L + 6 * L * L; };
  const fmt = n => String(Math.max(0, Math.round(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (tag, cls, id) => { const d = document.createElement(tag); if (cls) d.className = cls; if (id) d.id = id; return d; };
  const ui = document.getElementById('ui'); if (!ui) return;

  /* ---- DOM ---- */
  const root = $('div', 'hide', 'hud'); root.setAttribute('aria-hidden', 'false');
  root.innerHTML =
    '<div id="hud-tl">' +
      '<div id="hud-row">' +
        '<div id="hud-pcol"><div id="hud-port" role="button" aria-label="Hero"><canvas id="hud-face" width="56" height="56"></canvas><img id="hud-pimg" alt=""><b id="hud-lvl">1</b><button id="hud-tal" type="button" aria-label="Talents to spend">!</button></div>' +
          '<button id="hud-hall" type="button" title="Heroes fallen"><span class="sk">☠</span><b>0</b></button></div>' +
        '<div id="hud-bars" role="button" aria-label="Hero sheet">' +
          '<div id="hud-name"><b></b><i id="hud-title"></i></div>' +
          '<div id="hud-hp" class="bar"><i class="ghost"></i><i class="fill"></i><span id="hud-hpn"></span></div>' +
          '<div id="hud-xp" class="bar"><i class="fill"></i></div>' +
          '<div id="hud-meta"><span id="hud-lvtxt">Lv 1 · 0/131</span>' +
            '<span id="hud-chips"><span class="chip gold"><i></i><b id="hud-gold">0</b></span><span class="chip gem"><i></i><b id="hud-gems">0</b></span></span></div>' +
        '</div>' +
      '</div>' +
      '<div id="qtrack"></div>' +
      '<button id="hud-town" type="button"><span class="k">TOWN</span><span class="n"></span><span class="a">›</span></button>' +
    '</div>' +
    '<div id="hud-tr"><canvas id="minimap" width="96" height="96" role="button" aria-label="World map"></canvas></div>' +
    '<div id="hud-slot"></div>' +
    '<div id="hud-region"><b></b><small></small><p></p></div>' +
    '<div id="hud-vig"></div>';
  ui.appendChild(root);
  const E = {}; for (const el of root.querySelectorAll('[id]')) E[el.id] = el;
  const face = E['hud-face'], fctx = face.getContext('2d'), mm = E.minimap, mctx = mm.getContext('2d');

  /* ---- portrait: the champion's art when there is any, else a code-drawn head in the house colour (class glyph on the collar) ---- */
  let portKey = '';
  const portraitSrc = hero => {
    if (!hero) return null;
    try { if (R.draw && typeof R.draw.portrait === 'function') { const p = R.draw.portrait(hero); if (p) return p; } } catch (e) {}
    const A = window.A_CHAMP && (A_CHAMP.art || A_CHAMP); if (A && typeof A[hero + '_portrait'] === 'string') return A[hero + '_portrait'];
    if (window.CHAMP_ART && typeof CHAMP_ART[hero + '_portrait'] === 'string') return CHAMP_ART[hero + '_portrait'];
    return null;
  };
  const setPortrait = (hero, house, cls) => {
    const key = (hero || '') + '|' + house + '|' + cls; if (key === portKey) return; portKey = key;
    const img = E['hud-pimg'], src = portraitSrc(hero); img.classList.remove('on'); img.removeAttribute('src');
    const old = E['hud-port'].querySelector('.pdraw'); if (old) old.remove();
    if (typeof src === 'string') { img.src = src; img.classList.add('on'); }
    else if (src && src.nodeType === 1) { src.classList.add('pdraw'); E['hud-port'].insertBefore(src, img); }
    else if (src && src.src) { img.src = src.src; img.classList.add('on'); }
    drawFace(house, cls);
  };
  let faceKey = '';
  const drawFace = (house, cls) => {
    const key = house + '|' + cls + '|' + (R.dpr || 1); if (key === faceKey) return; faceKey = key;
    const S = 56, d = Math.min(2, R.dpr || 1); face.width = face.height = S * d; fctx.setTransform(d, 0, 0, d, 0, 0);
    const col = hcol(house), g = fctx; g.clearRect(0, 0, S, S);
    const bg = g.createRadialGradient(S / 2, S * .35, 4, S / 2, S / 2, S / 2); bg.addColorStop(0, '#2a3747'); bg.addColorStop(1, '#0b1220');
    g.fillStyle = bg; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 7); g.clip();
    // cloak / shoulders in the house colour
    g.fillStyle = col; g.globalAlpha = .55; g.beginPath(); g.moveTo(6, S + 4); g.quadraticCurveTo(S / 2, 30, S - 6, S + 4); g.fill(); g.globalAlpha = 1;
    // neck + head
    g.fillStyle = '#d9b48c'; g.fillRect(S / 2 - 5, 30, 10, 8); g.beginPath(); g.arc(S / 2, 24, 11, 0, 7); g.fill();
    // hair
    g.fillStyle = cls === 'maester' ? '#cfd3d8' : cls === 'ranger' ? '#5a3a1e' : '#2b2118'; g.beginPath(); g.arc(S / 2, 21, 11.5, Math.PI, 2 * Math.PI); g.lineTo(S / 2 + 11.5, 24); g.lineTo(S / 2 - 11.5, 24); g.fill();
    // eyes
    g.fillStyle = '#1b1f29'; g.fillRect(S / 2 - 5, 24, 2.4, 2.4); g.fillRect(S / 2 + 2.6, 24, 2.4, 2.4);
    // class glyph on the collar
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2; g.lineCap = 'round';
    if (cls === 'ranger') { g.beginPath(); g.arc(S / 2, 45, 7, -Math.PI * .75, Math.PI * .75, true); g.stroke(); g.beginPath(); g.moveTo(S / 2 - 8, 45); g.lineTo(S / 2 + 8, 45); g.stroke(); }
    else if (cls === 'maester') { g.lineWidth = 2.2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(S / 2 + i * 6, 46, 3, 0, 7); g.stroke(); } }
    else { g.beginPath(); g.moveTo(S / 2, 38); g.lineTo(S / 2, 52); g.moveTo(S / 2 - 6, 42); g.lineTo(S / 2 + 6, 42); g.stroke(); }
    g.restore();
  };

  /* ---- chips: count-up ---- */
  const shown = { gold: null, gems: null }, tw = {};
  const tween = (key, to) => {
    const el = E['hud-' + key], from = shown[key]; shown[key] = to;
    if (from == null || from === to || document.hidden) { el.textContent = fmt(to); return; }
    el.parentNode.classList.remove('bump'); void el.offsetWidth; el.parentNode.classList.add('bump');
    const t0 = performance.now(), dur = 600; if (tw[key]) cancelAnimationFrame(tw[key]);
    const f = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) * (1 - k); el.textContent = fmt(from + (to - from) * e); tw[key] = k < 1 ? requestAnimationFrame(f) : 0; };
    tw[key] = requestAnimationFrame(f);
  };

  /* ---- minimap ---- */
  // the world is R.WS (4.5) × the old grid: the minimap shows ~2000 units around the hero (a few minutes' walk), mobs within 1800
  const MM = 96, RAD = 2000, MOBR = 1800; let lastA = -Math.PI / 2;
  /* quest markers (40_quests R.quests.markers(): {x, y, kind 'give'|'turnin'|'target', id, ids, main}); the tracked quest's one first */
  const qMarks = () => { let Q = null; try { Q = R.quests && R.quests.markers && R.quests.markers(); } catch (e) {} return Array.isArray(Q) ? Q.filter(m => m && m.x != null && m.y != null) : []; };
  const trackedId = () => { try { const q = R.quests && R.quests.tracked && R.quests.tracked(); return q ? (q.id || q) : null; } catch (e) { return null; } };
  const qGlyph = m => (m.kind === 'turnin' || m.kind === 'turn' || m.kind === 'done') ? '?' : '!';
  const trackedMark = () => { const Q = qMarks(); if (!Q.length) return null; const id = trackedId(); return (id && Q.find(m => m.id === id || (m.ids && m.ids.indexOf(id) >= 0))) || Q.find(m => m.main) || Q[0]; };
  const glyph = (g, x, y, r, ch, hot) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = hot ? '#e3b661' : 'rgba(227,182,97,.8)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#1a130a'; g.stroke();
    g.fillStyle = '#1a130a'; g.font = '900 ' + Math.round(r * 1.5) + 'px Cinzel,Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y + .5); };
  const dot = (g, x, y, r, col, line) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); if (line) { g.lineWidth = 1; g.strokeStyle = line; g.stroke(); } };
  const drawMini = P => {
    const d = Math.min(2, R.dpr || 1); if (mm.width !== MM * d) mm.width = mm.height = MM * d;
    const g = mctx, c = MM / 2, k = (c - 4) / RAD, px = P.x, py = P.y, house = R.state && R.state.p ? houseOf(R.state.p) : 'stark';
    // heading-up: the camera's forward is up, like the 3D view (R.cam.yaw; the camera sits at +(sin yaw, cos yaw) behind the hero)
    const yaw = (R.cam && R.cam.yaw) || 0, cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), rp = (dx, dy) => [dx * cy_ - dy * sy_, dx * sy_ + dy * cy_];
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, MM, MM);
    g.save(); g.beginPath(); g.arc(c, c, c - 2, 0, 7); g.clip();
    g.fillStyle = '#0a1320'; g.fillRect(0, 0, MM, MM);
    const img = R.assets && (R.assets.mapClean || R.assets.map);   // mapClean: the art without the old stage shields, when provided
    if (img && img.complete !== false && (img.naturalWidth || img.width)) {
      const ms = 1 / (R.SCALE || 6), sw = RAD * 2 * ms;
      try { g.save(); g.translate(c, c); g.rotate(yaw); g.globalAlpha = .9; g.drawImage(img, px * ms - sw / 2, py * ms - sw / 2, sw, sw, -RAD * k * 1.05, -RAD * k * 1.05, RAD * 2.1 * k, RAD * 2.1 * k); g.restore(); g.globalAlpha = 1; g.fillStyle = 'rgba(6,11,20,.22)'; g.fillRect(0, 0, MM, MM); } catch (e) {}
    } else { g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(c, c, i * (c - 4) / 4, 0, 7); g.stroke(); } }
    const W = R.data.world, pois = W && W.pois;
    if (pois) for (const p of (Array.isArray(pois) ? pois : Object.values(pois))) {
      if (!p || p.x == null) continue; const [dx, dy] = rp(p.x - px, p.y - py); if (dx * dx + dy * dy > RAD * RAD) continue;
      const kd = p.kind || p.type, castle = kd === 'castle', town = kd === 'town' || kd === 'village';
      dot(g, c + dx * k, c + dy * k, castle ? 3.4 : town ? 2.8 : 2, castle ? hcol(p.house) : town ? '#f2e6c9' : '#8fa6b8', '#000');
    }
    for (const e of R.ents) {
      if (e === P || e.dead) continue; const [dx, dy] = rp(e.x - px, e.y - py); if (dx * dx + dy * dy > MOBR * MOBR) continue;
      let col = null, r = 2;
      if (e.kind === 'mob') col = '#e14b4b'; else if (e.kind === 'boss') { col = '#ff6a3c'; r = 3.5; } else if (e.kind === 'companion') col = '#7fd06a';
      else if (e.kind === 'ghost') col = '#4fd8e8'; else if (e.kind === 'npc') { col = '#e3b661'; r = 1.8; } else if (e.kind === 'portal') { col = '#b48cff'; r = 2.6; }
      if (col) dot(g, c + dx * k, c + dy * k, r, col);
    }
    // quest markers: "!" (a quest to take / a target) or "?" (a quest to hand in); outside the circle → on the rim with a pointer outward
    const TM = trackedMark();
    for (const m of qMarks()) {
      const [dx, dy] = rp(m.x - px, m.y - py), dist = Math.hypot(dx, dy), rim = c - 9, hot = !!TM && m.id === TM.id && m.x === TM.x && m.y === TM.y, r = hot ? 6 : 4.6;   // markers() builds new objects on every call
      if (m.kind === 'give' && !hot && dist > 2500) continue;   // offers only nearby (Q1: hundreds of them); objectives / turn-ins always
      if (dist * k > rim) { if (!hot && m.kind === 'give') continue; const a = Math.atan2(dy, dx), x = c + Math.cos(a) * rim, y = c + Math.sin(a) * rim;
        g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#e3b661'; g.beginPath(); g.moveTo(r + 5, 0); g.lineTo(r - 1, -4); g.lineTo(r - 1, 4); g.fill(); g.restore(); glyph(g, x, y, r, qGlyph(m), hot); }
      else glyph(g, c + dx * k, c + dy * k, r, qGlyph(m), hot);
    }
    if (Math.abs(P.vx || 0) + Math.abs(P.vy || 0) > 1) lastA = Math.atan2(P.vy, P.vx);
    g.save(); g.translate(c, c); g.rotate(lastA + yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, 5); g.lineTo(-2.5, 0); g.lineTo(-5, -5); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.restore();
    g.beginPath(); g.arc(c, c, c - 1.5, 0, 7); g.lineWidth = 2.5; g.strokeStyle = hcol(house); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 8px ' + 'Cinzel,Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const nn = rp(0, -(c - 8)); g.fillText('N', c + nn[0], c + nn[1]);
  };

  /* ---- the fallen chip: "☠ n" heroes fallen (R.state.acc.hall), tap → the hall ---- */
  const drawHall = () => {
    const acc = R.state.acc, el = E['hud-hall']; if (!acc) { el.classList.remove('on'); return; }
    const n = Array.isArray(acc.hall) ? acc.hall.length : 0; el.classList.toggle('on', n > 0);
    if (n !== last.fallen) { last.fallen = n; el.querySelector('b').textContent = n; el.title = n + (n === 1 ? ' hero fallen' : ' heroes fallen'); }
  };

  /* ---- region banner ---- */
  let banT = 0;
  const regionOf = id => { const W = R.data.world, rs = W && W.regions; if (!rs) return null; if (Array.isArray(rs)) return rs.find(r => r && (r.id === id || r.key === id)) || null; return rs[id] || null; };
  const bandOf = r => { const b = r.band || r.lv || r.lvl || r.levels || r.level; if (b == null) return ''; if (Array.isArray(b)) return 'lv ' + b[0] + '–' + b[1]; if (typeof b === 'object') { const a = b.min != null ? b.min : b.lo != null ? b.lo : b.a, z = b.max != null ? b.max : b.hi != null ? b.hi : b.b; return a != null && z != null ? 'lv ' + a + '–' + z : ''; } return 'lv ' + b; };
  const storyOf = id => { const S = R.data.story, rs = S && S.regions; if (!rs) return ''; const s = Array.isArray(rs) ? rs.find(r => r && r.id === id) : rs[id]; if (!s) return ''; if (typeof s === 'string') return s; return s.line || s.text || s.intro || s.desc || ''; };
  const banner = id => {
    const r = regionOf(id) || {}, name = r.name || (typeof id === 'string' ? id.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');
    if (!name) return; const band = bandOf(r), el = E['hud-region'];
    el.querySelector('b').textContent = name; el.querySelector('small').textContent = band || ''; el.querySelector('p').textContent = storyOf(id);
    el.querySelector('small').style.display = band ? '' : 'none';
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); stack(); clearTimeout(banT); banT = setTimeout(() => { el.classList.remove('on'); stack(); }, 3400);
  };

  /* ---- the message column: one bar, the tutorial card, the region title, the toasts — each starts under the one above ---- */
  const BARS = ['bossbar', 'dgbar', 'evbar'], GAP = 8;
  const shownEl = el => { if (!el || !el.isConnected) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const stack = () => {
    const ui = root.parentNode; if (!ui) return; const top0 = E['hud-slot'].getBoundingClientRect().top; let y = top0, lead = null;
    for (const id of BARS) { const b = document.getElementById(id); if (!b) continue; b.removeAttribute('data-hud-yield'); }
    for (const id of BARS) { const b = document.getElementById(id); if (!b) continue;
      if (!lead && shownEl(b)) { lead = b; if (b.style.top !== y + 'px') b.style.top = y + 'px'; y = Math.max(y, b.getBoundingClientRect().bottom + GAP); }
      else if (lead && shownEl(b)) b.setAttribute('data-hud-yield', '1'); }
    const tw = document.querySelector('#tut:not(.off) .tut-wrap');
    if (tw && shownEl(tw)) { if (tw.style.top !== y + 'px') tw.style.top = y + 'px'; y += tw.offsetHeight + GAP; }
    for (const a of ui.querySelectorAll(':scope>.ach-toast')) { if (a.style.top !== y + 'px') a.style.top = y + 'px'; y += a.offsetHeight + GAP; }   // A24's unlock card: queued under the tutorial card, never over it
    const rg = E['hud-region']; if (rg.classList.contains('on')) { if (rg.style.top !== y + 'px') rg.style.top = y + 'px'; y += rg.offsetHeight + GAP; }
    // toasts: the same line twice while the first is up → one; at most the 2 newest visible (the older ones are hidden, they expire on their own)
    const seen = new Set(); for (const t of ui.querySelectorAll(':scope>.toast')) { const k = t.textContent; if (seen.has(k)) { t.remove(); continue; } seen.add(k); }
    const ts = [...ui.querySelectorAll(':scope>.toast')], vis = ts.slice(-2);
    for (const t of ts) { if (vis.indexOf(t) < 0) { t.style.display = 'none'; continue; } if (t.style.top !== y + 'px') t.style.top = y + 'px'; y += t.offsetHeight + 6; }
  };
  try { new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.classList.contains('toast') || n.classList.contains('ach-toast') || BARS.includes(n.id) || n.id === 'tut')) { stack(); return; } })
    .observe(ui, { childList: true }); } catch (e) {}

  /* ---- refresh ---- */
  const last = {}; let lastTown = null;
  const n_ = t => t ? (typeof t === 'object' ? (t.name || true) : t) : null;
  const refresh = () => {
    const P = R.player, st = R.state && R.state.p;
    if (!P || !st) { root.classList.add('hide'); return; }
    root.classList.toggle('hide', !!R.ui.cur);
    const hpMax = P.hpMax || st.hpMax || 1, hp = R.clamp(P.hp == null ? hpMax : P.hp, 0, hpMax), f = hp / hpMax;
    const L = st.lvl || P.lvl || 1, xp = st.xp || 0, need = xpNext(L);
    E['hud-hp'].querySelector('.fill').style.width = (f * 100).toFixed(1) + '%'; E['hud-hp'].querySelector('.ghost').style.width = (f * 100).toFixed(1) + '%';
    E['hud-hp'].classList.toggle('low', f < .3);
    E['hud-hpn'].textContent = fmt(hp) + ' / ' + fmt(hpMax);
    E['hud-xp'].querySelector('.fill').style.width = (R.clamp(xp / need, 0, 1) * 100).toFixed(1) + '%';
    E['hud-lvtxt'].textContent = 'Lv ' + L + ' · ' + fmt(xp) + '/' + fmt(need);
    E['hud-lvl'].textContent = L;
    const nm = st.name || (R.data.champs && R.data.champs[st.hero] && (R.data.champs[st.hero].n || R.data.champs[st.hero].name)) || CLS[st.cls] || 'Hero';
    if (nm !== last.name) { last.name = nm; E['hud-name'].querySelector('b').textContent = nm; }
    const title = titleOf(st); if (title !== last.title) { last.title = title; E['hud-title'].textContent = title ? '· ' + title : ''; }
    const house = houseOf(st), hc = hcol(house); if (hc !== last.hc) { last.hc = hc; root.style.setProperty('--hc', hc); }
    setPortrait(st.hero, house, st.cls); drawHall();
    let tal = false; try { tal = !!(R.prog && R.prog.hint && R.prog.hint() === '!'); } catch (e) {} E['hud-tal'].classList.toggle('on', tal);   // P1's talents: points to spend
    if (shown.gold !== (st.gold || 0)) tween('gold', st.gold || 0); if (shown.gems !== (st.gems || 0)) tween('gems', st.gems || 0);
    let town = null; try { town = R.towns && R.towns.inside && R.towns.inside(); } catch (e) {}
    E['hud-town'].classList.toggle('on', !!town); lastTown = town;
    const tn = town ? (typeof town === 'object' ? (town.name || '') : '') : ''; if (tn !== last.townName) { last.townName = tn; E['hud-town'].querySelector('.n').textContent = tn ? ' · ' + tn : ''; }
    E['hud-vig'].style.opacity = f < .3 ? (0.3 + 0.7 * (1 - f / .3)).toFixed(2) : '0'; E['hud-vig'].classList.toggle('on', f < .3);
    drawMini(P); stack();
    if (R.input && R.input.setBag) { const inv = st.inv; R.input.setBag(Array.isArray(inv) ? inv.filter(Boolean).length : 0); }
    Object.assign(last, { hp, hpMax, lvl: L, xp, need, gold: st.gold || 0, gems: st.gems || 0, town: n_(town), house, hero: st.hero || null });
  };

  /* ---- taps ---- */
  const sheet = () => { if (R.ui.cur) return; if (R.input && R.input.haptic) R.input.haptic('select'); R.bus.emit('btn', 'inv', 'hud'); };
  E['hud-bars'].addEventListener('click', sheet); E['hud-port'].addEventListener('click', ev => { if (ev.target === E['hud-tal']) return; sheet(); });
  E['hud-tal'].addEventListener('click', ev => { ev.stopPropagation(); if (R.ui.cur) return; try { R.prog && R.prog.open && R.prog.open(); } catch (e) { console.error('talents', e); } });
  R.bus.on('talent', () => { acc = 0.1; });
  mm.addEventListener('click', () => { R.bus.emit('btn', 'map'); });
  E['hud-town'].addEventListener('click', () => { if (R.screens.shop) R.ui.open('shop', lastTown); else R.bus.emit('btn', 'shop', lastTown); });
  E['hud-hall'].addEventListener('click', () => { if (R.screens.hall) R.ui.open('hall'); else R.bus.emit('btn', 'hall'); });

  /* ---- events ---- */
  R.bus.on('screen', name => { if (!R.player || !R.state) return; root.classList.toggle('hide', !!name); });
  R.bus.on('enter', id => banner(id));
  R.bus.on('levelup', () => { const p = E['hud-port']; p.classList.remove('lvup'); void p.offsetWidth; p.classList.add('lvup'); setTimeout(() => p.classList.remove('lvup'), 1300); refresh(); });
  R.bus.on('gold', () => refresh());
  R.bus.on('xp', () => { acc = 0.1; });
  R.bus.on('hit', i => { if (i && i.tgt === R.player) acc = 0.1; });

  /* ---- the way to the tracked quest, on the 2D overlay: an arrow on a ring around the hero's feet + the distance in paces;
     the target itself gets a bobbing "!"/"?" when it is on screen. Not while a screen or the death is up. ---- */
  const PACE = 12;   // world units per pace (the hero is ~3 paces tall at the default zoom)
  const drawWay = ctx => {
    const P = R.player; if (!P || P.dead || R.ui.cur || !R.w2s || !R.vw) return; const m = trackedMark(); if (!m) return;
    const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy); if (d < 60) return;
    let hs, ts, s2; try { hs = R.w2s(P.x, P.y, 0); ts = R.w2s(m.x, m.y, 0); s2 = R.w2s(P.x + dx / d * 60, P.y + dy / d * 60, 0); } catch (e) { return; }
    if (!hs || hs.behind) return; const col = '#e3b661', ch = qGlyph(m), t = R.t || 0;
    const onScreen = ts && !ts.behind && ts.x > 30 && ts.x < R.vw - 30 && ts.y > 230 && ts.y < R.vh - 260;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (onScreen) { wayLabel = null; const by = ts.y - 34 - Math.sin(t * 4) * 4; ctx.shadowColor = '#000'; ctx.shadowBlur = 8; glyph(ctx, ts.x, by, 11, ch, true); ctx.shadowBlur = 0; ctx.restore(); return; }
    const a = s2 && !s2.behind ? Math.atan2(s2.y - hs.y, s2.x - hs.x) : Math.atan2(dy, dx), rr = 74 + Math.sin(t * 5) * 3, x = hs.x + Math.cos(a) * rr, y = hs.y + Math.sin(a) * rr * .62;
    ctx.translate(x, y); ctx.rotate(a); ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 6; ctx.fillStyle = col; ctx.strokeStyle = '#1a130a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.rotate(-a); ctx.shadowBlur = 0;
    ctx.restore(); ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // the distance label sits past the arrow's tip, outside the hero: ≥ WAY_GAP px from his feet and his body's centre, never on his body column
    const paces = Math.max(1, Math.round(d / PACE)), txt = ch + '  ' + (paces >= 1000 ? (paces / 1000).toFixed(1) + 'k' : paces) + ' paces';
    ctx.font = '800 12px Cinzel,Georgia,serif'; const tw = ctx.measureText(txt).width || txt.length * 7, ux = Math.cos(a), uy = Math.sin(a);
    let hd = null; try { hd = R.w2s(P.x, P.y, 34); } catch (e) {} const headY = hd && !hd.behind ? Math.min(hs.y - 40, hd.y - 8) : hs.y - 80, midY = (hs.y + headY) / 2;
    let lx = x + ux * (16 + 8 + Math.abs(ux) * tw / 2), ly = y + uy * (16 + 8 + Math.abs(uy) * 7);
    const clear = () => Math.hypot(lx - hs.x, ly - hs.y) >= WAY_GAP && Math.hypot(lx - hs.x, ly - midY) >= WAY_GAP && !(Math.abs(lx - hs.x) < tw / 2 + 18 && ly > headY - 10 && ly < hs.y + 10);
    for (let k = 0; k < 40 && !clear(); k++) { lx += ux * 6; ly += uy * 6; }
    lx = Math.max(tw / 2 + 6, Math.min(R.vw - tw / 2 - 6, lx)); ly = Math.max(14, Math.min(R.vh - 14, ly));
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(6,9,14,.9)'; ctx.strokeText(txt, lx, ly); ctx.fillStyle = '#f3e7c4'; ctx.fillText(txt, lx, ly);
    wayLabel = { x: lx, y: ly, w: tw, hx: hs.x, hy: hs.y, midY, headY, tip: { x: x + ux * 16, y: y + uy * 16 }, txt };
    ctx.restore(); };
  const WAY_GAP = 60; let wayLabel = null;

  /* ---- system: ≤ 10 refreshes a second ---- */
  let acc = 0.1;
  let warned = 0;   // the HUD never breaks the frame: a half-built save (no acc yet) only skips this refresh
  R.addSys('hud', { order: 950, update(dt) { acc += dt; if (acc < 0.1) return; acc = 0; try { refresh(); } catch (e) { if (!warned++) console.warn('hud', e); } try { stack(); } catch (e) {} },   // the column restacks even when a refresh broke
    draw(ctx) { try { drawWay(ctx); } catch (e) { if (!warned++) console.warn('hud way', e); } } });
  R.hud = { el: root, mm, E, refresh, banner, stack, last, shown, trackedMark, drawWay, get wayLabel() { return wayLabel; }, resetPortrait: () => { portKey = ''; faceKey = ''; }, drawMini: () => R.player && drawMini(R.player) };
})();
