/* HOLDOR RPG — the in-world HUD (A25). DOM in #ui, refreshed at most 10×/s by a system of order 950, hidden while a screen is open.
   Top-left: the hero's portrait (the champion's art: R.draw.portrait(hero) → A_CHAMP.art[hero+'_portrait'] → a code-drawn face; house ring)
   + level badge, under it the fallen chip "☠ n" (R.state.acc.hall, tap → the hall screen); HP bar (numbers on tap), XP bar +
   "Lv 12 · 340/1,120", the title; under them the slots #bossbar / #evbar / #dgbar (A09 / A23 / A22 fill them), the TOWN pill, #qtrack (A18).
   Top-right: gold + gem chips (count-up on change), the 96-px round 2D minimap under them (map art around the hero). A02's three icon
   buttons go in the right column below the minimap — this file leaves that column and the bottom-right 160 px free, and nothing sits
   on the joystick zone (bottom 45 %, left half). One hero, no companions (Addendum 2): no party strip.
   Hooks: R.hud = {el, mm, E, refresh(), banner(id), last, shown}. */
(function () {
  const HOUSE_COL = { stark: '#a9bdd0', lannister: '#e3b661', targaryen: '#e14b4b', greyjoy: '#d8b74a', tyrell: '#7fd06a', martell: '#f08a3c', baratheon: '#e0c14a' };
  const CLS = { knight: 'Knight', ranger: 'Ranger', maester: 'Maester' };
  const hcol = h => (R.data.houses && R.data.houses[h] && R.data.houses[h].col) || HOUSE_COL[h] || '#a9bdd0';
  const houseOf = st => (R.state.acc && R.state.acc.house) || st.house || (R.data.champs && R.data.champs[st.hero] && R.data.champs[st.hero].house) || 'stark';
  const titleOf = st => st.title || (R.state.acc && R.state.acc.title) || CLS[st.cls] || '';
  const xpNext = L => { const B = R.data.balance; try { if (B && typeof B.xpNext === 'function') return B.xpNext(L); } catch (e) {} return 80 + 45 * L + 6 * L * L; };
  const fmt = n => String(Math.max(0, Math.round(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (tag, cls, id) => { const d = document.createElement(tag); if (cls) d.className = cls; if (id) d.id = id; return d; };
  const ui = document.getElementById('ui'); if (!ui) return;

  /* ---- DOM ---- */
  const root = $('div', 'hide', 'hud'); root.setAttribute('aria-hidden', 'false');
  root.innerHTML =
    '<div id="hud-tl">' +
      '<div id="hud-row">' +
        '<div id="hud-pcol"><div id="hud-port"><canvas id="hud-face" width="56" height="56"></canvas><img id="hud-pimg" alt=""><b id="hud-lvl">1</b></div>' +
          '<button id="hud-hall" type="button" title="Heroes fallen"><span class="sk">☠</span><b>0</b></button></div>' +
        '<div id="hud-bars">' +
          '<div id="hud-hp" class="bar"><i class="ghost"></i><i class="fill"></i><span id="hud-hpn"></span></div>' +
          '<div id="hud-xp" class="bar"><i class="fill"></i></div>' +
          '<div id="hud-lvtxt">Lv 1 · 0/131</div>' +
          '<div id="hud-title"></div>' +
        '</div>' +
      '</div>' +
      '<div id="hud-tc"><div id="bossbar"></div><div id="evbar"></div><div id="dgbar"></div></div>' +
      '<button id="hud-town" type="button"><span class="k">TOWN</span><span class="n"></span><span class="a">›</span></button>' +
      '<div id="qtrack"></div>' +
    '</div>' +
    '<div id="hud-tr">' +
      '<div id="hud-chips">' +
        '<div class="chip gold"><i></i><b id="hud-gold">0</b></div>' +
        '<div class="chip gem"><i></i><b id="hud-gems">0</b></div>' +
      '</div>' +
      '<canvas id="minimap" width="96" height="96"></canvas>' +
    '</div>' +
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
  const MM = 96, RAD = 640, MOBR = 600; let lastA = -Math.PI / 2;
  const dot = (g, x, y, r, col, line) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); if (line) { g.lineWidth = 1; g.strokeStyle = line; g.stroke(); } };
  const drawMini = P => {
    const d = Math.min(2, R.dpr || 1); if (mm.width !== MM * d) mm.width = mm.height = MM * d;
    const g = mctx, c = MM / 2, k = (c - 4) / RAD, px = P.x, py = P.y, house = R.state && R.state.p ? houseOf(R.state.p) : 'stark';
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, MM, MM);
    g.save(); g.beginPath(); g.arc(c, c, c - 2, 0, 7); g.clip();
    g.fillStyle = '#0a1320'; g.fillRect(0, 0, MM, MM);
    const img = R.assets && R.assets.map;
    if (img && img.complete !== false && (img.naturalWidth || img.width)) {
      const ms = 1 / (R.SCALE || 6), sw = RAD * 2 * ms;
      try { g.globalAlpha = .9; g.drawImage(img, px * ms - sw / 2, py * ms - sw / 2, sw, sw, c - RAD * k, c - RAD * k, RAD * 2 * k, RAD * 2 * k); g.globalAlpha = 1; g.fillStyle = 'rgba(6,11,20,.22)'; g.fillRect(0, 0, MM, MM); } catch (e) {}
    } else { g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(c, c, i * (c - 4) / 4, 0, 7); g.stroke(); } }
    const W = R.data.world, pois = W && W.pois;
    if (pois) for (const p of (Array.isArray(pois) ? pois : Object.values(pois))) {
      if (!p || p.x == null) continue; const dx = p.x - px, dy = p.y - py; if (dx * dx + dy * dy > RAD * RAD) continue;
      const castle = p.kind === 'castle' || p.type === 'castle'; dot(g, c + dx * k, c + dy * k, castle ? 3.2 : 2.2, castle ? hcol(p.house) : (p.kind === 'town' ? '#f2e6c9' : '#8fa6b8'), '#000');
    }
    for (const e of R.ents) {
      if (e === P || e.dead) continue; const dx = e.x - px, dy = e.y - py; if (dx * dx + dy * dy > MOBR * MOBR) continue;
      let col = null, r = 2;
      if (e.kind === 'mob') col = '#e14b4b'; else if (e.kind === 'boss') { col = '#ff6a3c'; r = 3.5; } else if (e.kind === 'companion') col = '#7fd06a';
      else if (e.kind === 'ghost') col = '#4fd8e8'; else if (e.kind === 'npc') { col = '#e3b661'; r = 1.8; } else if (e.kind === 'portal') { col = '#b48cff'; r = 2.6; }
      if (col) dot(g, c + dx * k, c + dy * k, r, col);
    }
    let Q = null; try { Q = R.quests && R.quests.markers && R.quests.markers(); } catch (e) {}
    if (Q) for (const m of Q) {
      if (!m || m.x == null) continue; const dx = m.x - px, dy = m.y - py, dist = Math.hypot(dx, dy), rim = c - 7;
      if (dist * k > rim) { const a = Math.atan2(dy, dx), x = c + Math.cos(a) * rim, y = c + Math.sin(a) * rim; dot(g, x, y, 3, '#e3b661', '#000');
        g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#e3b661'; g.beginPath(); g.moveTo(7, 0); g.lineTo(3, -3.5); g.lineTo(3, 3.5); g.fill(); g.restore(); }
      else dot(g, c + dx * k, c + dy * k, 3, '#e3b661', '#000');
    }
    if (Math.abs(P.vx || 0) + Math.abs(P.vy || 0) > 1) lastA = Math.atan2(P.vy, P.vx);
    g.save(); g.translate(c, c); g.rotate(lastA); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, 5); g.lineTo(-2.5, 0); g.lineTo(-5, -5); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.restore();
    g.beginPath(); g.arc(c, c, c - 1.5, 0, 7); g.lineWidth = 2.5; g.strokeStyle = hcol(house); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 8px ' + 'Cinzel,Georgia,serif'; g.textAlign = 'center'; g.fillText('N', c, 10);
  };

  /* ---- the fallen chip: "☠ n" heroes fallen (R.state.acc.hall), tap → the hall ---- */
  const drawHall = () => {
    const acc = R.state.acc, el = E['hud-hall']; if (!acc) { el.classList.remove('on'); return; }
    const n = Array.isArray(acc.hall) ? acc.hall.length : 0; el.classList.add('on');
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
    el.querySelector('b').textContent = name; el.querySelector('small').textContent = band ? name + ' · ' + band : ''; el.querySelector('p').textContent = storyOf(id);
    el.querySelector('small').style.display = band ? '' : 'none';
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(banT); banT = setTimeout(() => el.classList.remove('on'), 3400);
  };

  /* ---- refresh ---- */
  const last = {}; let hpNums = false, hpNumT = 0, lastTown = null;
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
    if (hpNums && hpNumT && performance.now() > hpNumT) { hpNums = false; hpNumT = 0; } E['hud-hp'].classList.toggle('nums', hpNums);
    E['hud-xp'].querySelector('.fill').style.width = (R.clamp(xp / need, 0, 1) * 100).toFixed(1) + '%';
    E['hud-lvtxt'].textContent = 'Lv ' + L + ' · ' + fmt(xp) + '/' + fmt(need);
    E['hud-lvl'].textContent = L;
    const title = titleOf(st); if (title !== last.title) { last.title = title; E['hud-title'].textContent = title; E['hud-title'].title = st.name || ''; }
    const house = houseOf(st), hc = hcol(house); if (hc !== last.hc) { last.hc = hc; root.style.setProperty('--hc', hc); }
    setPortrait(st.hero, house, st.cls); drawHall();
    if (shown.gold !== (st.gold || 0)) tween('gold', st.gold || 0); if (shown.gems !== (st.gems || 0)) tween('gems', st.gems || 0);
    let town = null; try { town = R.towns && R.towns.inside && R.towns.inside(); } catch (e) {}
    E['hud-town'].classList.toggle('on', !!town); lastTown = town;
    const tn = town ? (typeof town === 'object' ? (town.name || '') : '') : ''; if (tn !== last.townName) { last.townName = tn; E['hud-town'].querySelector('.n').textContent = tn ? ' · ' + tn : ''; }
    E['hud-vig'].style.opacity = f < .3 ? (0.3 + 0.7 * (1 - f / .3)).toFixed(2) : '0'; E['hud-vig'].classList.toggle('on', f < .3);
    drawMini(P);
    Object.assign(last, { hp, hpMax, lvl: L, xp, need, gold: st.gold || 0, gems: st.gems || 0, town: n_(town), house, hero: st.hero || null });
  };

  /* ---- taps ---- */
  E['hud-bars'].addEventListener('click', () => { hpNums = !hpNums; hpNumT = hpNums ? performance.now() + 4000 : 0; E['hud-hp'].classList.toggle('nums', hpNums); });
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

  /* ---- system: ≤ 10 refreshes a second ---- */
  let acc = 0.1;
  R.addSys('hud', { order: 950, update(dt) { acc += dt; if (acc < 0.1) return; acc = 0; refresh(); } });
  R.hud = { el: root, mm, E, refresh, banner, last, shown, drawMini: () => R.player && drawMini(R.player) };
})();
