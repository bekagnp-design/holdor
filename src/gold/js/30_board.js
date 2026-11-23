/* Heavy Gold — boards (30_board.js): the round submit, the weekly / all-time boards, the title podium (src/gold/GOLD.md, UI rules).
   - On `end`, online and with a profile: hg_round_submit(token, r), r = {god, banked, rank, heroes, robs, lost, minted, day}.
     #endExtra gets one short line (#hgWeek in #hgEnd): "Week #3 · 240 🪙" (the server's answer), "Connecting…" while it waits,
     "Offline · saved on this phone" without the server, "Not counted · too soon" etc. for a refusal. Nothing else.
   - #titleExtra: the podium, one compact row 🥇 🥈 🥉 (flag + name, the gold under it), headed "LAST WEEK" from hg_board(token, 'last');
     "THIS WEEK" from 'week' when last week has no rounds; nothing when neither has rounds or the game is offline.
   - Icon buttons: 🏆 "Boards" in #titleLinks (#hgTitleBoard) and in #endLinks (#hgEndBoard).
   - The board screen (#hgBoard): BOARDS + the player count, tabs Week / Last week / All × Players / Countries, rows rank · flag · name ·
     gold (my row marked; my own row pinned under the list when I am outside the top 20), CLOSE.
   - Only server data is shown (never a Telegram id: only name, country, total, rounds, players, gold, crown are read).
   - Crowns (g2): a row with crown: true (the champion, last week's #1) gets 👑 right before the flag / name, on the board and the podium.
   - G.emit('submitted', answer, r) once hg_round_submit has answered (answer = the server's JSON, or null), for the ladder.
   - G.board = { open(), close(), load(scope, fresh), render(), podium(), top3(scope) }: top3('title' | 'last' | 'week') returns the rows
     last rendered on the podium ({rank, name, country, flag, total, mine, crown}); top3('end') is [] (the end screen shows no rows). */
(function () {
  const num = v => { const n = Number(v); return isFinite(n) ? Math.round(n) : 0; };
  const fmt = v => num(v).toLocaleString('en-US');
  const code = v => { const s = String(v == null ? '' : v).toUpperCase(); return /^[A-Z]{2}$/.test(s) ? s : ''; };
  const flag = c => (typeof G.flag === 'function' ? G.flag(c) : '') || '';
  const cname = c => (typeof G.countryName === 'function' && G.countryName(c)) || c || '—';
  const arr = v => Array.isArray(v) ? v : [];
  const online = () => !!(G.net && G.net.on);
  const hasTG = () => { try { return !!(G.TG && typeof G.TG.initData === 'string' && G.TG.initData.length); } catch (e) { return false; } };
  const hasProfile = () => !!(G.profile && G.profile.name && G.profile.country);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ib = (id, icon, word) => { const b = el('button', 'ib'); b.id = id; b.type = 'button'; b.append(el('i', null, icon), el('span', null, word)); return b; };
  const MEDAL = ['', '🥇', '🥈', '🥉'];

  /* ---- styles ---- */
  const css = document.createElement('style');
  css.textContent = [
    '.hgScr{background:var(--bg,#070c16);z-index:20}',
    '.hgB{flex:1 1 auto;min-height:0;width:min(100%,560px);display:flex;flex-direction:column;gap:8px}',
    '.hgBtop{display:flex;align-items:center;gap:4px 12px;flex-wrap:wrap}',
    '.hgBtop h2{margin:0;font:900 20px/1.2 Georgia,serif;letter-spacing:.08em;color:var(--gold,#e8b84a)}',
    '.hgTot{font:700 13px/1.3 Georgia,serif;color:var(--muted,#8d9bb0);margin-right:auto}',
    '.hgTabs{display:flex;gap:8px;flex-wrap:wrap}.hgTabs[hidden]{display:none}',
    '.hgSeg{display:flex;flex:1 1 220px;border:2px solid rgba(255,255,255,.18);border-radius:12px;overflow:hidden}#hgKind{flex:1 1 160px}',
    '.hgSeg button{flex:1 1 0;min-height:44px;min-width:44px;border:0;background:transparent;color:var(--ink,#f3e7c4);font:700 14px Georgia,serif;cursor:pointer;padding:0 6px;white-space:nowrap}',
    '.hgSeg button+button{border-left:2px solid rgba(255,255,255,.12)}.hgSeg button.on{background:rgba(232,184,74,.22);color:var(--gold,#e8b84a)}',
    '.hgBody{flex:1 1 auto;min-height:64px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;border-radius:12px;background:rgba(255,255,255,.03)}',
    '.hgRow{display:grid;grid-template-columns:30px 26px minmax(0,1fr) auto;align-items:center;gap:6px;padding:7px 10px;font:15px/1.25 Georgia,serif;border-bottom:1px solid rgba(255,255,255,.06)}',
    '.hgRow.c{grid-template-columns:30px 26px minmax(0,1fr) auto auto}',
    '.hgRow .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hgRow .v{text-align:right;font-weight:700;color:var(--gold,#e8b84a);font-variant-numeric:tabular-nums}',
    '.hgRow .k{color:var(--muted,#8d9bb0);font-size:13px}.hgRow .fl{font-size:18px;line-height:1}.hgRow .pp{font-size:12px;color:var(--muted,#8d9bb0);white-space:nowrap}',
    '.hgRow.me{background:rgba(232,184,74,.18);color:var(--gold,#e8b84a);font-weight:700}.hgRow.me .k{color:var(--gold,#e8b84a)}',
    '.hgPin{border:2px solid var(--gold,#e8b84a);border-radius:12px;overflow:hidden;flex:none}.hgPin[hidden]{display:none}.hgPin .hgRow{border:0}',
    '.hgNote{padding:18px 12px;text-align:center;font:15px/1.4 Georgia,serif;color:#cfd6e2;display:flex;flex-direction:column;align-items:center;gap:10px}',
    '.hgNote .sec{width:auto;padding:0 22px}',
    '.hgB>.pri{align-self:center;flex:none}',
    /* the podium: one compact row; the medal, the crown, the flag and the name on one line, the gold under it */
    '.hgPod{width:100%;display:flex;flex-direction:column;align-items:center;gap:1px}.hgPod[hidden]{display:none}',
    '.hgPodH{font:700 10px/1.2 Georgia,serif;letter-spacing:.16em;color:var(--muted,#8d9bb0);text-align:center}',
    '.hgPodRow{display:flex;justify-content:center;align-items:flex-end;gap:12px;width:100%}',
    '.hgPl{flex:0 1 auto;min-width:0;max-width:30%;display:flex;flex-direction:column;align-items:center;text-align:center}',
    '.hgPl .nm{display:flex;align-items:center;justify-content:center;gap:4px;max-width:100%;white-space:nowrap;font:800 15px/1.25 Georgia,serif;color:#e4e9f1}',
    '.hgPl .ln{display:flex;align-items:center;gap:4px;max-width:100%;min-width:0}.hgPl .rk{flex:none;font-size:15px;line-height:1}',
    '.hgPl .nm .n{overflow:hidden;text-overflow:ellipsis;min-width:0}.hgPl .nm .f{flex:none}.hgPl .nm{min-width:0}',
    '.hgPl .g{font:700 12px/1.2 Georgia,serif;color:var(--gold,#e8b84a);font-variant-numeric:tabular-nums}',
    '.hgPl.p1 .nm{font-size:19px;color:#e8b84a}.hgPl.p1 .g{font-size:13px}.hgPl.p1{max-width:40%;flex-shrink:.6}.hgPl.p1.crown .rk{display:none}',
    '.hgPl.me .nm .n{text-decoration:underline;text-underline-offset:3px}',
    '.hgCr{flex:none;font-style:normal}.hgRow .n .hgCr{margin-right:.25em}.hgPl .nm .hgCr{font-size:.8em}',
    '@media (max-height:430px){.hgPl .nm{font-size:13px}.hgPl.p1 .nm{font-size:16px}.hgPl .g,.hgPl.p1 .g{font-size:11px}.hgPodRow{gap:8px}}',
    /* the end screen: one line */
    '.hgEnd{display:flex;justify-content:center;width:100%;min-width:0}',
    '.hgWeek{text-align:center;font:700 15px/1.3 Georgia,serif;color:var(--ink,#f3e7c4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.hgWeek.soft{font-weight:400;color:#cfd6e2}',
    '@media (orientation:landscape) and (max-height:540px){.hgBtop h2{font-size:18px}.hgB{gap:6px}.hgRow{padding:5px 10px}.hgTabs{flex-wrap:nowrap}.hgSeg,#hgKind{flex:1 1 0}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---- data ---- */
  const cache = {}, inflight = {};
  function load(scope, fresh) {
    const c = cache[scope];
    if (!fresh && c && Date.now() - c.at < 30000) return Promise.resolve(c.d);
    if (inflight[scope]) return inflight[scope];
    if (!online()) return Promise.resolve(null);
    inflight[scope] = G.net.rpc('hg_board', { token: null, scope }).then(d => {
      if (d && typeof d === 'object' && !Array.isArray(d) && !d.error) { cache[scope] = { at: Date.now(), d }; return d; }
      return null;
    }).catch(() => null).then(d => { delete inflight[scope]; return d; });
    return inflight[scope];
  }
  const players = d => arr(d && d.players).map((p, i) => ({ rank: i + 1, name: String((p && p.name) || ''), country: code(p && p.country), total: num(p && p.total), rounds: num(p && p.rounds), mine: !!(p && p.mine), crown: !!(p && p.crown === true) }));
  const crown = () => { const c = el('span', 'hgCr', '👑'); c.title = "Last week's champion"; return c; };
  const countries = d => arr(d && d.countries).map(c => ({ country: code(c && c.country), players: num(c && c.players), rounds: num(c && c.rounds), gold: num(c && c.gold) }))
    .sort((a, b) => b.gold - a.gold || b.players - a.players || b.rounds - a.rounds);
  const shown = { title: [], last: [], week: [] };
  const top3rows = d => players(d).slice(0, 3).map(p => ({ rank: p.rank, name: p.name, country: p.country, flag: flag(p.country), total: p.total, mine: p.mine, crown: p.crown }));

  /* ---- the title podium ---- */
  /* the podium sits first in #titleExtra while it has rows, and is taken out otherwise (an empty #titleExtra stays hidden) */
  const pod = el('div', 'hgPod'); pod.id = 'hgPod'; pod.hidden = true;
  const tEx = G.$('titleExtra');
  const podHide = () => { pod.hidden = true; pod.textContent = ''; if (pod.parentNode) pod.parentNode.removeChild(pod); shown.title = []; shown.last = []; };
  let podSeq = 0;
  async function podium() {
    const my = ++podSeq;
    if (!online()) { podHide(); return; }
    let scope = 'last', d = await load('last'), rows = top3rows(d);
    if (!rows.length) { scope = 'week'; d = await load('week'); rows = top3rows(d); }
    if (my !== podSeq) return;
    if (!rows.length || !online()) { podHide(); return; }
    if (tEx && tEx.firstChild !== pod) tEx.insertBefore(pod, tEx.firstChild);
    pod.textContent = '';
    pod.dataset.scope = scope;
    pod.appendChild(el('div', 'hgPodH', scope === 'last' ? 'LAST WEEK' : 'THIS WEEK'));
    const row = el('div', 'hgPodRow');
    for (const p of rows) {
      const b = el('div', 'hgPl p' + p.rank + (p.mine ? ' me' : '') + (p.crown ? ' crown' : '')); b.dataset.rank = p.rank;
      const nm = el('div', 'nm');
      if (p.crown) nm.appendChild(crown());
      if (p.flag) nm.appendChild(el('span', 'f', p.flag));
      nm.appendChild(el('span', 'n', p.name));
      const ln = el('div', 'ln'); ln.append(el('span', 'rk', MEDAL[p.rank]), nm); b.appendChild(ln);
      b.appendChild(el('div', 'g', fmt(p.total)));
      row.appendChild(b);
    }
    pod.appendChild(row); pod.hidden = false;
    shown.title = rows; shown[scope] = rows; if (scope === 'week') shown.last = [];
  }

  /* ---- the end screen: one line ---- */
  const endBox = el('div', 'hgEnd'); endBox.id = 'hgEnd';
  const weekEl = el('div', 'hgWeek'); weekEl.id = 'hgWeek';
  endBox.appendChild(weekEl);
  const eEx = G.$('endExtra'); if (eEx) eEx.appendChild(endBox);
  const OFF = 'Offline · saved on this phone';
  const ERR = { too_fast: 'Not counted · too soon', bad_round: 'Not counted', no_profile: 'Not counted · no name' };
  const line = (t, soft) => { weekEl.textContent = t; weekEl.classList.toggle('soft', !!soft); };
  let endSeq = 0;
  G.on('start', () => { endSeq++; });
  G.on('end', (S, res) => { submit(res).catch(() => line(OFF, true)); });
  async function submit(res) {
    const my = ++endSeq;
    if (!res || typeof res !== 'object') { line(OFF, true); return; }
    const r = { god: String(res.god || ''), banked: num(res.bank), rank: num(res.rank), heroes: num(res.of), robs: num(res.robs), lost: num(res.lost), minted: num(res.minted),
      day: G.dayGod && G.dayGod.key ? String(G.dayGod.key) : '' };
    if (!hasProfile() || !G.net) { line(OFF, true); return; }
    line('Connecting…', true);
    let on = online(); if (!on && hasTG()) { try { on = await G.net.login(); } catch (e) { on = false; } }
    if (my !== endSeq) return;
    if (!on) { line(OFF, true); return; }
    const x = await G.net.rpc('hg_round_submit', { token: null, r });
    try { G.emit('submitted', x, r); } catch (e) {}   // the server has answered (x: its answer, or null): the ladder's end line asks now
    if (my !== endSeq) return;
    if (x && x.ok && x.week) { const w = x.week; line('Week #' + fmt(w.rank) + ' · ' + fmt(w.total) + ' 🪙'); delete cache.week; delete cache.all; }
    else if (x && x.error) line(ERR[x.error] || 'Not counted', true);
    else line(OFF, true);
    if (scr.classList.contains('on')) { render(); fetchScope(true); }
  }

  /* ---- the board screen ---- */
  const scr = el('div', 'scr hgScr'); scr.id = 'hgBoard';
  const box = el('div', 'hgB');
  const top = el('div', 'hgBtop'); const h2 = el('h2', null, 'BOARDS'); const tot = el('div', 'hgTot'); tot.id = 'hgTot'; top.append(h2, tot);
  const tabs = el('div', 'hgTabs'); tabs.id = 'hgTabs';
  const seg = (id, items) => { const s = el('div', 'hgSeg'); s.id = id; for (const [k, t] of items) { const b = el('button', null, t); b.type = 'button'; b.dataset.k = k; s.appendChild(b); } return s; };
  const segScope = seg('hgScope', [['week', 'Week'], ['last', 'Last week'], ['all', 'All']]), segKind = seg('hgKind', [['players', 'Players'], ['countries', 'Countries']]);
  tabs.append(segScope, segKind);
  const body = el('div', 'hgBody'); body.id = 'hgBody';
  const pin = el('div', 'hgPin'); pin.id = 'hgPin'; pin.hidden = true;
  const closeB = el('button', 'pri', 'CLOSE'); closeB.id = 'hgClose'; closeB.type = 'button';
  box.append(top, tabs, body, pin, closeB); scr.appendChild(box); document.body.appendChild(scr);
  let scope = 'week', kind = 'players', state = {};   // state[scope] = 'loading' | 'error'
  segScope.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; scope = b.dataset.k; render(); fetchScope(); });
  segKind.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; kind = b.dataset.k; render(); });
  closeB.addEventListener('click', () => close());

  const cell = (cls, text) => el('span', cls, text);
  function note(text, retry) {
    const n = el('div', 'hgNote'); n.appendChild(el('div', null, text));
    if (retry) { const b = el('button', 'sec', '↻ Retry'); b.type = 'button'; b.id = 'hgRetry'; b.addEventListener('click', () => { delete state[scope]; open(true); }); n.appendChild(b); }
    body.appendChild(n);
  }
  function pRow(p, rank) {
    const r = el('div', 'hgRow' + (p.mine ? ' me' : '')); r.dataset.rank = rank;
    const n = cell('n'); if (p.crown) { n.appendChild(crown()); r.classList.add('crown'); } n.append(p.name);
    r.append(cell('k', String(rank)), cell('fl', flag(p.country)), n, cell('v', fmt(p.total)));
    return r;
  }
  function render() {
    for (const b of segScope.children) b.classList.toggle('on', b.dataset.k === scope);
    for (const b of segKind.children) b.classList.toggle('on', b.dataset.k === kind);
    body.textContent = ''; pin.hidden = true; pin.textContent = ''; tot.textContent = '';
    if (!online()) {
      tabs.hidden = true;
      if (!hasTG()) note('Open in Telegram');
      else if (G.net && G.net.pending) note('Connecting…');
      else note('Offline', true);
      return;
    }
    tabs.hidden = false;
    const c = cache[scope];
    if (!c) { if (state[scope] === 'error') note('Offline', true); else note('Loading…'); return; }
    const d = c.d, t = d.totals || {};
    tot.textContent = '👤 ' + fmt(t.players);
    if (kind === 'players') {
      const ps = players(d);
      if (!ps.length) note('No rounds yet');
      for (const p of ps) body.appendChild(pRow(p, p.rank));
      const me = d.me && typeof d.me === 'object' ? d.me : null, inList = ps.some(p => p.mine);
      if (me && num(me.rank) > 0 && (!inList || num(me.rank) > 20) && hasProfile()) {
        pin.appendChild(pRow({ name: G.profile.name, country: G.profile.country, total: me.total, mine: true, crown: false }, '#' + fmt(me.rank)));
        pin.hidden = false;
      }
    } else {
      const cs = countries(d);
      if (!cs.length) { note('No rounds yet'); return; }
      const mine = hasProfile() ? G.profile.country : '';
      cs.forEach((c, i) => {
        const r = el('div', 'hgRow c' + (c.country && c.country === mine ? ' me' : '')); r.dataset.cc = c.country;
        r.append(cell('k', String(i + 1)), cell('fl', flag(c.country)), cell('n', cname(c.country)), cell('pp', '👤 ' + fmt(c.players)), cell('v', fmt(c.gold)));
        body.appendChild(r);
      });
    }
  }
  async function fetchScope(fresh) {
    if (!online()) return;
    const sc = scope; if (!cache[sc] || fresh) state[sc] = 'loading';
    const d = await load(sc, !!fresh);
    state[sc] = d ? 'ok' : 'error';
    if (scr.classList.contains('on') && scope === sc) render();
  }
  async function open(fresh) {
    fresh = fresh === true;
    scr.classList.add('on'); body.scrollTop = 0; render();
    if (!online() && hasTG() && G.net) { const p = G.net.login(true); render(); await p; render(); }   // "Connecting…" while the login runs
    fetchScope(fresh);
  }
  function close() { scr.classList.remove('on'); }

  /* ---- the icon buttons ---- */
  const tBtn = ib('hgTitleBoard', '🏆', 'Boards'), endBtn = ib('hgEndBoard', '🏆', 'Boards');
  const links = G.$('titleLinks'); if (links) links.appendChild(tBtn);
  const eLinks = G.$('endLinks'); if (eLinks) eLinks.appendChild(endBtn);
  tBtn.addEventListener('click', () => open()); endBtn.addEventListener('click', () => open());

  G.on('net', on => { podium(); if (scr.classList.contains('on')) { render(); if (on) fetchScope(); } });
  G.on('title', () => podium());
  G.on('profile', () => { if (scr.classList.contains('on')) render(); });
  G.board = { open, close, load, render, podium, top3: s => (s === 'end' ? [] : (shown[s || 'title'] || [])).map(r => Object.assign({}, r)) };
  if (online()) podium();
})();
