/* HOLDOR RPG — presence (A38): other players as ghosts on the map, the zone chat sheet, the leaderboard screen.
   Reads A35's R.net: R.net.others [{name,house,lvl,x,y,zone,at}] (+ 'presence' event), R.net.chat.send/list (+ 'chat' event), R.net.board(kind).
   Addendum 2: the hero is a champion, so a presence row may carry `hero` (champion id): the ghost gets `type = hero` for the 3D renderer's billboards;
   this module draws the body itself only when there is no #gl canvas (R.draw.champ → R.draw.hero → a code-drawn figure). Name tags and
   speech bubbles are 2D overlay text at R.w2s(x, y, 70). The board kinds are A36's: lvl, best, kills, bosses, fallen.
   Every dependency is soft: without R.net.on there are no ghosts, the chat says it needs Telegram, the board says log in. */
(function () {
  const HOUSES = { stark: { n: 'Stark', e: '🐺', col: '#a9bdd0' }, lannister: { n: 'Lannister', e: '🦁', col: '#e3b661' }, baratheon: { n: 'Baratheon', e: '🦌', col: '#e0c14a' },
    targaryen: { n: 'Targaryen', e: '🐉', col: '#e14b4b' }, greyjoy: { n: 'Greyjoy', e: '🦑', col: '#d8b74a' }, tyrell: { n: 'Tyrell', e: '🌹', col: '#7fd06a' }, martell: { n: 'Martell', e: '☀️', col: '#f08a3c' } };
  const house = h => (R.data.houses && R.data.houses[h]) || HOUSES[h] || HOUSES.stark;
  const hcol = h => house(h).col || '#a9bdd0', hsig = h => house(h).e || house(h).sigil || '⚔️';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const online = () => !!(R.net && R.net.on);
  const me = () => (R.state && R.state.p && R.state.p.name) || 'You', myHouse = () => (R.state && ((R.state.acc && R.state.acc.house) || (R.state.p && R.state.p.house))) || 'stark';
  const px = () => R.player ? R.player.x : R.cam.x, py = () => R.player ? R.player.y : R.cam.y;
  const regName = r => { if (!r) return null; if (typeof r === 'object') return r.name || r.n || r.id || null; const W = R.data.world, L = W && W.regions; const z = L && (Array.isArray(L) ? L.find(q => q.id === r) : L[r]); return z ? (z.name || z.n || String(r)) : String(r); };
  const zoneAt = (x, y) => { try { if (R.world && R.world.regionAt) return regName(R.world.regionAt(x, y)); } catch (e) {} return null; };
  const poiName = () => { try { if (R.world && R.world.poiAt) { const p = R.world.poiAt(px(), py(), 400); if (p) return p.name || p.n || null; } } catch (e) {} return null; };
  const hhmm = at => { const d = new Date(typeof at === 'number' ? at : (at || Date.now())); return isNaN(d) ? '' : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  const P = R.presence = { ghosts: [], msgs: [], unread: 0, emotes: [], cfg: { speed: 150, alpha: 0.6, greetR: 60, rate: 2, waveRate: 5, bubble: 6, keep: 40 }, lastSend: 0, lastWave: 0, sent: [] };
  P.zone = () => zoneAt(px(), py()) || 'Westeros';
  /* ---- ghosts ---- */
  const ghostOf = name => P.ghosts.find(g => g.name === name && !g.gone);
  P.sync = list => { if (!online() || !Array.isArray(list)) list = []; const seen = new Set(); const mine = me();
    /* heroes are champions, so many players share a name ("Brienne of Tarth"): the server never lists me, so a name like mine is another player;
       each row matches the nearest unmatched ghost of the same name + house (within 900 u), else it is a new ghost */
    const used = new Set();
    const match = o => { let best = null, bd = 900; for (const q of P.ghosts) { if (q.gone || used.has(q) || q.name !== o.name || (q.house || '') !== (o.house || q.house || '')) continue; const d = Math.hypot((q.tx != null ? q.tx : q.x) - (+o.x || 0), (q.ty != null ? q.ty : q.y) - (+o.y || 0)); if (d < bd) { bd = d; best = q; } } return best; };
    for (const o of list) { if (!o || !o.name) continue; let g = match(o); seen.add(o.name);
      if (!g) { g = R.spawn({ kind: 'ghost', ghost: true, team: 2, name: o.name, house: o.house || 'stark', lvl: o.lvl || 1, hero: o.hero || null, type: o.hero || null, x: +o.x || 0, y: +o.y || 0, r: 14, hp: 1, alpha: 0, solid: false, invuln: true, noHit: true, zone: o.zone, at: o.at, interact: { label: 'Greet', fn: () => P.greet(g) } }); g.tx = g.x; g.ty = g.y; P.ghosts.push(g); }
      else { g.tx = +o.x || g.tx; g.ty = +o.y || g.ty; g.lvl = o.lvl || g.lvl; g.house = o.house || g.house; if (o.hero) g.hero = g.type = o.hero; g.zone = o.zone; g.at = o.at; if (Math.hypot(g.tx - g.x, g.ty - g.y) > 600) { g.x = g.tx; g.y = g.ty; } } used.add(g); }
    for (const g of P.ghosts) if (!used.has(g)) g.gone = true; };
  P.list = () => P.ghosts.filter(g => !g.gone && !g.dead).map(g => ({ name: g.name, house: g.house, lvl: g.lvl, hero: g.hero, x: g.x, y: g.y, zone: g.zone, col: hcol(g.house) }));
  P.nearest = r => { let best = null, bd = r || P.cfg.greetR; for (const g of P.ghosts) { if (g.gone) continue; const d = Math.hypot(g.x - px(), g.y - py()); if (d <= bd) { bd = d; best = g; } } return best; };
  const emote = (x, y, txt, col) => { if (R.fx && R.fx.num) { try { R.fx.num(x, y - 48, txt, col, true); return; } catch (e) {} } P.emotes.push({ x, y: y - 44, txt, col, t0: R.t }); };
  P.greet = g => { if (!g || g.gone) return false; if (Math.hypot(g.x - px(), g.y - py()) > P.cfg.greetR) { R.ui.toast('Too far to greet'); return false; }
    if (R.t - P.lastWave < P.cfg.waveRate && P.lastWave) { return false; } P.lastWave = R.t; emote(px(), py(), '👋', hcol(myHouse())); emote(g.x, g.y, '👋', hcol(g.house));
    if (R.sfx && R.sfx.play) { try { R.sfx.play('ui', 0.5); } catch (e) {} } P.send(me() + ' waves to ' + g.name, true); return true; };
  let lastRef = null;
  R.bus.on('presence', list => P.sync(list));
  R.bus.on('tick1s', () => { if (R.net && R.net.others !== lastRef) { lastRef = R.net.others; P.sync(lastRef); } if (P.unread && R.ui.cur === 'chat') P.setUnread(0); });
  /* ---- the system: move toward the last position, fade, draw ---- */
  const drawFallback = (ctx, sx, sy, g, z) => { const col = hcol(g.house), bob = g.anim === 'walk' ? Math.sin(g.animT * 12) * 2 * z : 0;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2 * z, 12 * z, 5 * z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx - 11 * z, sy); ctx.lineTo(sx + 11 * z, sy); ctx.lineTo(sx + 7 * z, sy - 26 * z + bob); ctx.lineTo(sx - 7 * z, sy - 26 * z + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9d9c2'; ctx.beginPath(); ctx.arc(sx, sy - 32 * z + bob, 6.5 * z, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3 * z; ctx.beginPath(); ctx.moveTo(sx + 8 * z * g.face, sy - 20 * z + bob); ctx.lineTo(sx + 16 * z * g.face, sy - 34 * z + bob); ctx.stroke(); };
  const tag = (ctx, sx, sy, txt, col, bg, pad, fs) => { ctx.font = '700 ' + fs + 'px Cinzel,Georgia,serif'; const w = ctx.measureText(txt).width + pad * 2, h = fs + pad * 1.4; sx = R.clamp(sx, w / 2 + 4, R.vw - w / 2 - 4); ctx.fillStyle = bg; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(sx - w / 2, sy - h, w, h, 6); else ctx.rect(sx - w / 2, sy - h, w, h); ctx.fill(); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(txt, sx, sy - pad * 0.6); return h; };
  R.addSys('presence', { order: 9,
    update(dt) { for (let i = P.ghosts.length - 1; i >= 0; i--) { const g = P.ghosts[i];
        if (g.gone) { g.alpha -= dt; if (g.alpha <= 0) { R.remove(g); P.ghosts.splice(i, 1); } continue; }
        g.alpha = Math.min(P.cfg.alpha, g.alpha + dt * 1.2);
        const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy), step = P.cfg.speed * dt;
        if (d > 1) { const k = Math.min(1, step / d); g.x += dx * k; g.y += dy * k; g.vx = dx / d * P.cfg.speed; g.vy = dy / d * P.cfg.speed; if (Math.abs(dx) > 2) g.face = dx < 0 ? -1 : 1; if (g.anim !== 'walk') { g.anim = 'walk'; g.animT = 0; } }
        else if (g.anim !== 'idle') { g.anim = 'idle'; g.animT = 0; g.vx = g.vy = 0; }
        if (g.bubbleUntil && R.t > g.bubbleUntil) { g.bubble = null; g.bubbleUntil = 0; } }
      P.emotes = P.emotes.filter(e => R.t - e.t0 < 1.4);
      if (R.input && R.input.pressed && !R.ui.cur) { try { if (R.input.pressed('interact')) { const g = P.nearest(); if (g) P.greet(g); } } catch (e) {} } },
    draw(ctx) { const z = R.cam.z || 1, gl = !!document.getElementById('gl');
      for (const g of P.ghosts) { const s = R.w2s(g.x, g.y, 0); if (s.x < -80 || s.x > R.vw + 80 || s.y < -120 || s.y > R.vh + 80 || g.alpha <= 0) continue;
        ctx.save(); ctx.globalAlpha = g.alpha; let drawn = gl; const o = { ctx, house: g.house, col: hcol(g.house), anim: g.anim, animT: g.animT, face: g.face, scale: z, lvl: g.lvl, ghost: true, ent: g, alpha: g.alpha };
        if (!drawn && g.hero && R.draw && R.draw.champ) { try { R.draw.champ(g.hero, s.x, s.y, o); drawn = true; } catch (e) {} }
        if (!drawn && R.draw && R.draw.hero) { try { R.draw.hero(s.x, s.y, o); drawn = true; } catch (e) {} }
        if (!drawn) drawFallback(ctx, s.x, s.y, g, z);
        let t = R.w2s(g.x, g.y, 70); if (t.y === s.y) t = { x: s.x, y: s.y - 42 * z };
        ctx.globalAlpha = Math.min(1, g.alpha + 0.3);
        const h = tag(ctx, t.x, t.y, g.name + ' · Lv ' + g.lvl, hcol(g.house), 'rgba(6,11,20,.72)', 5, 11);
        if (g.bubble) { ctx.globalAlpha = Math.min(1, g.alpha + 0.4); const k = Math.min(1, (g.bubbleUntil - R.t) / 0.4); ctx.globalAlpha *= k; tag(ctx, t.x, t.y - h - 4, g.bubble, '#0b1220', '#f2e6c9', 7, 12); }
        ctx.restore(); }
      for (const e of P.emotes) { const a = R.t - e.t0, s = R.w2s(e.x, e.y - a * 40, 60); ctx.save(); ctx.globalAlpha = Math.max(0, 1 - a / 1.4); ctx.font = (26 * z) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.txt, s.x, s.y); ctx.restore(); } } });
  /* ---- chat model ---- */
  const norm = m => { if (!m) return null; if (typeof m === 'string') return { body: m, name: '?', at: Date.now() }; const body = m.body != null ? m.body : (m.text != null ? m.text : (m.txt != null ? m.txt : m.msg)); if (body == null) return null;
    let at = m.at != null ? m.at : (m.ts != null ? m.ts : (m.t != null ? m.t : Date.now())); if (typeof at === 'string' && /^\d+$/.test(at)) at = +at; return { id: m.id, name: m.name || m.from || '?', house: m.house || 'stark', body: String(body).slice(0, 240), at, mine: !!m.mine }; };
  P.setUnread = n => { if (n === P.unread) return; P.unread = n; R.bus.emit('chatBadge', n); const b = document.querySelector('#prChat .bd'); if (b) { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('on', n > 0); } };
  P.add = msgs => { if (!Array.isArray(msgs)) msgs = msgs && Array.isArray(msgs.msgs) ? msgs.msgs : [msgs]; let fresh = 0;
    for (const raw of msgs) { const m = norm(raw); if (!m) continue;
      if (m.id != null && P.msgs.some(x => x.id === m.id)) continue;
      const opt = P.sent.findIndex(x => x.body === m.body && Date.now() - x.t < 60000); if (opt >= 0 && m.mine) { m.mine = true; P.sent.splice(opt, 1); const i = P.msgs.findIndex(x => x.opt && x.body === m.body); if (i >= 0) { P.msgs[i] = m; continue; } }
      if (!m.mine && m.id == null && P.msgs.some(x => x.name === m.name && x.body === m.body && x.at === m.at)) continue;
      P.msgs.push(m); fresh++;
      if (!m.mine) { if (R.ui.cur !== 'chat') P.setUnread(P.unread + 1); const g = ghostOf(m.name); if (g) { g.bubble = m.body.length > 60 ? m.body.slice(0, 58) + '…' : m.body; g.bubbleUntil = R.t + P.cfg.bubble; } } }
    if (P.msgs.length > P.cfg.keep) P.msgs.splice(0, P.msgs.length - P.cfg.keep);
    if (fresh && R.ui.cur === 'chat') renderList(); return fresh; };
  R.bus.on('chat', msgs => P.add(msgs));
  P.pull = () => { if (!online() || !R.net.chat || !R.net.chat.list) return Promise.resolve(0); try { return Promise.resolve(R.net.chat.list()).then(r => P.add(r || []), () => 0); } catch (e) { return Promise.resolve(0); } };
  P.send = (txt, quiet) => { txt = String(txt || '').trim().slice(0, 200); if (!txt) return Promise.resolve(false);
    if (!online() || !R.net.chat || !R.net.chat.send) { if (!quiet) note('Chat needs Telegram', true); return Promise.resolve(false); }
    const now = Date.now(); if (now - P.lastSend < P.cfg.rate * 1000) { if (!quiet) note('Slow down', true); return Promise.resolve(false); } P.lastSend = now;
    P.sent.push({ body: txt, t: now }); const m = { name: me(), house: myHouse(), body: txt, at: now, mine: true, opt: true }; P.msgs.push(m); if (P.msgs.length > P.cfg.keep) P.msgs.shift(); if (R.ui.cur === 'chat') renderList();
    let p; try { p = Promise.resolve(R.net.chat.send(txt)); } catch (e) { p = Promise.reject(e); }
    const drop = why => { const i = P.msgs.indexOf(m); if (i >= 0) P.msgs.splice(i, 1); P.sent = P.sent.filter(x => x.body !== txt); if (!quiet) note(why || 'Not sent', true); if (R.ui.cur === 'chat') renderList(); return false; };
    return p.then(r => { if (r === false || r == null || (r && r.ok === false)) return drop((r && r.error) || (R.net && R.net.err) || 'Not sent');   /* refused: never shown as sent */
      if (r && r.id != null) { m.id = r.id; m.opt = false; } return true; /* without an id the server's echo (mine) replaces the pending line: shown once */ }, e => { const i = P.msgs.indexOf(m); if (i >= 0) P.msgs.splice(i, 1); P.sent = P.sent.filter(x => x.body !== txt); if (!quiet) note((e && e.message) || 'Not sent', true); if (R.ui.cur === 'chat') renderList(); return false; }); };
  /* ---- chat sheet ---- */
  const $ = id => document.getElementById(id);
  const note = (t, bad) => { const n = $('prNote'); if (!n) { if (bad) R.ui.toast(t, '#f0a0a0'); return; } n.textContent = t; n.classList.toggle('err', !!bad); };
  const renderList = () => { const l = $('prList'); if (!l) return; const mine = me();
    l.innerHTML = P.msgs.length ? P.msgs.map(m => `<div class="prMsg${m.mine ? ' me' : ''}" data-id="${esc(m.id == null ? '' : m.id)}"><b style="color:${esc(hcol(m.house))}">${esc(m.name)}</b><span class="t">${hhmm(m.at)}</span><div class="b">${esc(m.body)}</div></div>`).join('')
      : '<div class="prEmpty">No one has spoken here yet. Say hello.</div>'; l.scrollTop = l.scrollHeight; };
  const QUICK = ['👋', '⚔️', '🛡️', '🔥', '❄️'];
  R.screens.chat = { live: true,
    open(arg, el) { const zone = P.zone(), known = zone !== 'Westeros', here = P.list().filter(g => !known || !g.zone || g.zone === zone || regName(g.zone) === zone).length;
      el.innerHTML = `<div class="prSheet" id="prSheet"><div class="prHead"><div><div class="prZone" id="prZone">${esc(zone)}</div><div class="prSub">${online() ? here + (here === 1 ? ' other player nearby' : ' other players nearby') : 'Zone chat'}</div></div><button class="prX" id="prX" aria-label="Close">✕</button></div>` +
        (online() ? `<div class="prList" id="prList"></div><div class="prQuick" id="prQuick">${QUICK.map(q => `<button class="prQ" data-q="${q}">${q}</button>`).join('')}<button class="prQ txt" data-q="Help at ${esc(poiName() || (zone !== 'Westeros' ? zone : 'Moat Cailin'))}!">Help!</button></div><div class="prNote" id="prNote"></div><div class="prRow"><input id="prIn" maxlength="200" autocomplete="off" placeholder="Say something to the zone…"><button class="prSend" id="prSend">SEND</button></div>`
          : `<div class="prGuest"><div class="prBig">Chat needs Telegram</div><div>Open HOLDOR inside Telegram to talk to the players of this zone and to see them on the map.</div></div>`) + `</div>`;
      $('prX').onclick = () => R.ui.close();
      if (online()) { renderList(); P.setUnread(0); P.pull();
        const send = () => { const inp = $('prIn'); const t = inp.value; P.send(t).then(ok => { if (ok && $('prIn')) { $('prIn').value = ''; note(''); } }); };
        $('prSend').onclick = send; $('prIn').onkeydown = ev => { if (ev.key === 'Enter') send(); };
        $('prQuick').onclick = ev => { const b = ev.target.closest('.prQ'); if (b) P.send(b.dataset.q); };
        let lp = 0; const list = $('prList');
        const down = ev => { const row = ev.target.closest('.prMsg'); if (!row || row.classList.contains('me')) return; clearTimeout(lp); lp = setTimeout(() => { const fn = R.net && R.net.chat && R.net.chat.report; if (typeof fn !== 'function') return;   /* no report path on the server yet (v23's chat_report is for the realm chat): no fake "Reported" */
          Promise.resolve(fn(row.dataset.id)).then(ok => { if (ok) R.ui.toast('Reported. Thank you.'); }, () => {}); }, 550); };
        const up = () => clearTimeout(lp); list.addEventListener('pointerdown', down); list.addEventListener('pointerup', up); list.addEventListener('pointercancel', up); list.addEventListener('pointerleave', up); list.addEventListener('scroll', up); }
      P._zoneT = setInterval(() => { const z = $('prZone'); if (z) z.textContent = P.zone(); }, 3000); },
    close() { clearInterval(P._zoneT); } };
  /* ---- the floating chat button + badge ---- */
  const mountBtn = () => { const ui = $('ui'); if (!ui || $('prChat')) return; const b = document.createElement('button'); b.id = 'prChat'; b.className = 'prChat'; b.innerHTML = '💬<span class="bd"></span>'; b.setAttribute('aria-label', 'Zone chat');
    b.onclick = () => { if (R.ui.cur === 'chat') R.ui.close(); else R.ui.open('chat'); }; ui.appendChild(b); P.setUnread(P.unread); b.classList.toggle('on', P.unread > 0); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBtn); else mountBtn();
  R.bus.on('screen', n => { const b = $('prChat'); if (b) b.classList.toggle('hid', !!n && n !== 'chat'); });
  /* ---- leaderboard ---- */
  const KINDS = [['lvl', 'Level'], ['best', 'Best'], ['kills', 'Kills'], ['bosses', 'Bosses'], ['fallen', 'Fallen']];
  const val = (r, kind) => { const v = r.v != null ? r.v : (r.n != null ? r.n : (r.score != null ? r.score : (r.value != null ? r.value : (kind === 'kills' ? r.kills : kind === 'bosses' ? r.bosses : (r.best != null ? r.best : r.lvl)))));
    if (kind === 'lvl' || kind === 'best') return 'Lv ' + (v || r.lvl || 1); if (kind === 'fallen') return 'Lv ' + (r.lvl || v || 1) + (r.killer ? ' · ' + r.killer : ''); return (+v || 0).toLocaleString() + (kind === 'bosses' ? ' bosses' : ' kills'); };
  P.board = { kind: 'lvl', rows: null, busy: false };
  const renderBoard = () => { const el = $('prBoard'); if (!el) return; const B = P.board;
    el.innerHTML = B.busy ? '<div class="prEmpty">Loading…</div>' : B.err ? `<div class="prEmpty">${esc(B.err)}</div>` : !B.rows || !B.rows.length ? '<div class="prEmpty">No one is ranked here yet.</div>'
      : B.rows.slice(0, 50).map((r, i) => `<div class="prRank${r.mine ? ' me' : ''}"><span class="rk">${r.rank || i + 1}</span><span class="sg">${hsig(r.house)}</span><span class="nm">${esc(r.name || '—')}${r.mine ? '<i>you</i>' : ''}<small>${B.kind === 'fallen' ? esc(hhmm(r.at)) : 'Lv ' + esc(r.lvl || 1)}</small></span><span class="v">${esc(val(r, B.kind))}</span></div>`).join('');
    const mine = el.querySelector('.me'); if (mine && mine.scrollIntoView) { try { mine.scrollIntoView({ block: 'nearest' }); } catch (e) {} } };
  P.loadBoard = kind => { const B = P.board; B.kind = kind || B.kind; B.rows = null; B.err = ''; B.busy = true; renderBoard(); document.querySelectorAll('.prTab').forEach(t => t.classList.toggle('on', t.dataset.k === B.kind));
    if (!online() || !R.net.board) { B.busy = false; B.err = 'The board is not reachable'; renderBoard(); return Promise.resolve([]); }
    let p; try { p = Promise.resolve(R.net.board(B.kind)); } catch (e) { p = Promise.reject(e); } const k = B.kind;
    return p.then(r => { if (B.kind !== k) return; const rows = Array.isArray(r) ? r : (r && Array.isArray(r.rows) ? r.rows : []); B.rows = rows; B.busy = false; renderBoard(); return rows; }, e => { if (B.kind !== k) return; B.busy = false; B.err = 'The board is not reachable'; renderBoard(); return []; }); };
  R.screens.board = {
    open(arg, el) { const kind = typeof arg === 'string' && KINDS.some(k => k[0] === arg) ? arg : P.board.kind;
      el.innerHTML = `<div class="prBoardWrap"><div class="prHead"><div class="prZone">Leaderboard</div><button class="prX" id="prBX" aria-label="Close">✕</button></div><div class="prTabs">${KINDS.map(k => `<button class="prTab${k[0] === kind ? ' on' : ''}" data-k="${k[0]}">${k[1]}</button>`).join('')}</div>` +
        (online() ? `<div class="prBoard" id="prBoard"></div>` : `<div class="prGuest"><div class="prBig">Log in through Telegram to be ranked</div><div>The board lists real players only. Open HOLDOR inside Telegram and your level, bosses and kills count here.</div></div>`) + `<button class="prBack" id="prBack">BACK</button></div>`;
      $('prBX').onclick = $('prBack').onclick = () => R.ui.close();
      el.querySelectorAll('.prTab').forEach(t => { t.onclick = () => { if (online()) P.loadBoard(t.dataset.k); else { P.board.kind = t.dataset.k; el.querySelectorAll('.prTab').forEach(x => x.classList.toggle('on', x === t)); } }; });
      if (online()) P.loadBoard(kind); },
    close() {} };
})();
