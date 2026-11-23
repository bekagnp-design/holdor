/* Heavy Gold — boards (30_board.js): the round submit, the weekly / all-time boards, the top-3 podium (src/gold/GOLD.md).
   - On `end`, online and with a profile: hg_round_submit(token, r), r = {god, banked, rank, heroes, robs, lost, minted, day}.
     #endExtra shows "This week: total X · best Y · #rank" (or the server's error, or "Saved only on this phone"), then this
     week's top 3 (flag + name + total, #1 bigger, the player's own row marked) and a Leaderboard button.
   - #titleExtra: a podium, "LAST WEEK'S CHAMPIONS" from hg_board(token, 'last'); when last week has no rounds,
     "THIS WEEK SO FAR" from 'week'; nothing when neither has rounds or the game is offline. A single row in a short landscape window.
   - The board screen (#titleLinks and #endExtra buttons): THIS WEEK / ALL TIME × PLAYERS / COUNTRIES, a totals line,
     the player's own row highlighted, "You: #N" pinned when he is outside the top 20, one CLOSE.
   - Only server data is shown (never a Telegram id: only name, country, total, best, rounds, players, gold, crown are read).
   - Crowns (g2): a row with crown: true (the champion, last week's #1) gets 👑 right before the name, on the board, the podium and
     the end screen's top 3.
   - G.board = { open(), close(), load(scope, fresh), top3(scope) }: top3('title' | 'end' | 'last' | 'week') returns the rows
     last rendered there ({rank, name, country, flag, total, mine, crown}), [] when nothing was rendered. */
(function () {
  const num = v => { const n = Number(v); return isFinite(n) ? Math.round(n) : 0; };
  const fmt = v => num(v).toLocaleString('en-US');
  const code = v => { const s = String(v == null ? '' : v).toUpperCase(); return /^[A-Z]{2}$/.test(s) ? s : ''; };
  const flag = c => (typeof G.flag === 'function' ? G.flag(c) : '') || '';
  const cname = c => (typeof G.countryName === 'function' && G.countryName(c)) || c || '—';
  const arr = v => Array.isArray(v) ? v : [];
  const pl = (n, one, many) => fmt(n) + ' ' + (num(n) === 1 ? one : many);
  const online = () => !!(G.net && G.net.on);
  const hasTG = () => { try { return !!(G.TG && typeof G.TG.initData === 'string' && G.TG.initData.length); } catch (e) { return false; } };
  const hasProfile = () => !!(G.profile && G.profile.name && G.profile.country);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---- styles ---- */
  const css = document.createElement('style');
  css.textContent = [
    '.hgScr{background:var(--bg,#070c16);z-index:20}',
    '.hgB{flex:1 1 auto;min-height:0;width:min(100%,640px);display:flex;flex-direction:column;gap:8px}',
    '.hgBtop{display:flex;align-items:baseline;justify-content:space-between;gap:4px 12px;flex-wrap:wrap}',
    '.hgBtop h2{margin:0;font:900 20px/1.2 Georgia,serif;letter-spacing:.08em;color:var(--gold,#e8b84a)}',
    '.hgTot{font:13px/1.3 Georgia,serif;color:var(--muted,#8d9bb0)}',
    '.hgTabs{display:flex;gap:8px;flex-wrap:wrap}.hgTabs[hidden]{display:none}',
    '.hgSeg{display:flex;flex:1 1 220px;border:2px solid rgba(255,255,255,.18);border-radius:12px;overflow:hidden}',
    '.hgSeg button{flex:1 1 0;min-height:44px;border:0;background:transparent;color:var(--ink,#f3e7c4);font:700 14px Georgia,serif;letter-spacing:.06em;cursor:pointer;padding:0 6px}',
    '.hgSeg button+button{border-left:2px solid rgba(255,255,255,.12)}.hgSeg button.on{background:rgba(232,184,74,.22);color:var(--gold,#e8b84a)}',
    '.hgBody{flex:1 1 auto;min-height:64px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;border-radius:12px;background:rgba(255,255,255,.03)}',
    '.hgRow{display:grid;grid-template-columns:32px 26px minmax(0,1fr) 64px 52px 54px;align-items:center;gap:4px;padding:6px 8px;font:14px/1.25 Georgia,serif;border-bottom:1px solid rgba(255,255,255,.06)}',
    '.hgRow.hd{position:sticky;top:0;background:#0d1420;color:var(--muted,#8d9bb0);font-size:12px;letter-spacing:.04em;z-index:1}',
    '.hgRow .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hgRow .v{text-align:right}.hgRow .k{color:var(--muted,#8d9bb0)}.hgRow .fl{font-size:18px;line-height:1}',
    '.hgRow.me{background:rgba(232,184,74,.18);color:var(--gold,#e8b84a);font-weight:700}.hgRow.me .k{color:var(--gold,#e8b84a)}',
    '.hgPin{display:flex;align-items:center;gap:8px;padding:8px 10px;border:2px solid var(--gold,#e8b84a);border-radius:12px;font:700 14px/1.25 Georgia,serif;color:var(--gold,#e8b84a);background:rgba(232,184,74,.1);flex-wrap:wrap}.hgPin[hidden]{display:none}',
    '.hgPin .n{flex:1 1 90px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink,#f3e7c4)}.hgPin .s{font-weight:400;color:#cfd6e2}',
    '.hgNote{padding:18px 12px;text-align:center;font:15px/1.4 Georgia,serif;color:#cfd6e2;display:flex;flex-direction:column;align-items:center;gap:10px}',
    '.hgB>.pri{align-self:center;flex:none}',
    /* the podium */
    '.hgPod{width:100%;display:flex;flex-direction:column;align-items:center;gap:2px}.hgPod[hidden]{display:none}',
    '.hgPodH{font:700 12px/1.2 Georgia,serif;letter-spacing:.14em;color:var(--muted,#8d9bb0);text-align:center}',
    '.hgPodRow{display:flex;justify-content:center;align-items:flex-end;gap:8px;width:100%}',
    '.hgPl{flex:1 1 0;min-width:0;max-width:190px;display:flex;flex-direction:column;align-items:center;text-align:center}',
    '.hgPl.p1{flex-grow:1.5;max-width:240px}',
    '.hgPl .rk{font:900 12px/1.2 Georgia,serif;opacity:.85}',
    '.hgPl .nm{display:flex;align-items:center;justify-content:center;gap:5px;max-width:100%;white-space:nowrap;font:800 16px/1.2 Georgia,serif}',
    '.hgPl .nm .n{overflow:hidden;text-overflow:ellipsis;min-width:0}.hgPl .nm .f{flex:none}',
    '.hgPl .g{font:13px/1.2 Georgia,serif;color:#cfd6e2}.hgPl .g b{color:var(--ink,#f3e7c4)}',
    '.hgPl .bar{width:72%;border-radius:6px 6px 0 0;margin-top:3px}',
    '.hgPl.p1 .nm{font-size:26px;color:#e8b84a}.hgPl.p1.long .nm{font-size:21px}.hgPl.p1 .rk{color:#e8b84a}.hgPl.p1 .bar{height:16px;background:linear-gradient(180deg,#e8b84a,#7a5618)}',
    '.hgPl.p2 .nm,.hgPl.p2 .rk{color:#c9d2dc}.hgPl.p2 .bar{height:10px;background:linear-gradient(180deg,#c9d2dc,#58606a)}',
    '.hgPl.p3 .nm,.hgPl.p3 .rk{color:#d08a4e}.hgPl.p3 .bar{height:6px;background:linear-gradient(180deg,#d08a4e,#6a3e1c)}',
    '.hgPl.me .nm .n{text-decoration:underline;text-underline-offset:3px}',
    '.hgCr{flex:none;font-style:normal}.hgRow .n .hgCr{margin-right:.25em}.hgPl .nm .hgCr{font-size:.72em;margin-right:-2px}',
    /* the end screen */
    '.hgEnd{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%}',
    '.hgEndT{display:flex;flex-direction:column;align-items:center;gap:6px;max-width:100%;min-width:0}',
    '.hgWeek{text-align:center;font:700 15px/1.35 Georgia,serif;color:var(--ink,#f3e7c4)}.hgWeek.soft{font-weight:400;color:#cfd6e2}',
    '.hgTop{display:flex;flex-direction:column;align-items:center;gap:1px;max-width:100%}.hgTop[hidden]{display:none}',
    '.hgTopH{font:700 11px/1.2 Georgia,serif;letter-spacing:.14em;color:var(--muted,#8d9bb0)}',
    '.hgT{display:flex;align-items:baseline;gap:6px;max-width:100%;font:14px/1.3 Georgia,serif;color:#cfd6e2;white-space:nowrap}',
    '.hgT .n{overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:11em;color:var(--ink,#f3e7c4)}.hgT .r{font-weight:900}.hgT .g{color:var(--gold,#e8b84a)}',
    '.hgT.t1{font-size:17px}.hgT.t1 .r{color:#e8b84a}.hgT.t2 .r{color:#c9d2dc}.hgT.t3 .r{color:#d08a4e}',
    '.hgT.me .n{color:var(--gold,#e8b84a);font-weight:700}.hgT .you{font:700 11px Georgia,serif;color:#1c1207;background:var(--gold,#e8b84a);border-radius:6px;padding:0 5px;align-self:center}',
    '#hgEndBoard{width:min(100%,360px)}',
    /* a short landscape window: the end box is one band (the two lines left, the button right); the board rows tighter */
    '@media (orientation:landscape) and (max-height:540px){.hgBtop h2{font-size:18px}.hgB{gap:6px}.hgRow{padding:4px 8px}',
    '.hgEnd{flex-direction:row;justify-content:center;gap:12px}.hgEndT{gap:2px;align-items:flex-start;flex:0 1 auto}.hgWeek{font-size:14px;text-align:left}',
    '.hgTop{flex-direction:row;flex-wrap:wrap;justify-content:flex-start;gap:0 12px}.hgTopH{display:none}.hgT,.hgT.t1{font-size:13px}.hgT.t1 .n,.hgT.t1 .g{font-size:15px}.hgT .n{max-width:8em}',
    '#hgEndBoard{width:auto;flex:none;padding:0 18px}}',
    /* the podium in a short landscape window: one thin row, the heading inline */
    '@media (orientation:landscape) and (max-height:500px){.hgPod{flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 14px;width:100%;max-width:100%}',
    '.hgPodH{font-size:11px}.hgPodRow{width:auto;max-width:100%;flex-wrap:wrap;align-items:baseline;gap:4px 14px}',
    '.hgPl,.hgPl.p1{flex:0 1 auto;flex-direction:row;align-items:baseline;gap:5px;max-width:200px}.hgPl .rk{font-size:11px}',
    '.hgPl .bar{display:none}.hgPl .nm{font-size:13px;gap:4px}.hgPl.p1 .nm,.hgPl.p1.long .nm{font-size:17px}.hgPl .g{font-size:11px}.hgPl .nm .n{max-width:8.5em}}'
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
  const players = d => arr(d && d.players).map((p, i) => ({ rank: i + 1, name: String((p && p.name) || ''), country: code(p && p.country), total: num(p && p.total), best: num(p && p.best), rounds: num(p && p.rounds), mine: !!(p && p.mine), crown: !!(p && p.crown === true) }));
  const crown = () => { const c = el('span', 'hgCr', '👑'); c.title = "Last week's champion"; return c; };
  const countries = d => arr(d && d.countries).map(c => ({ country: code(c && c.country), players: num(c && c.players), rounds: num(c && c.rounds), gold: num(c && c.gold) }))
    .sort((a, b) => b.gold - a.gold || b.players - a.players || b.rounds - a.rounds);
  const shown = { title: [], end: [], last: [], week: [] };
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
    pod.appendChild(el('div', 'hgPodH', scope === 'last' ? "LAST WEEK'S CHAMPIONS" : 'THIS WEEK SO FAR'));
    const row = el('div', 'hgPodRow');
    for (const i of [1, 0, 2]) {         // #2 · #1 · #3
      const p = rows[i]; if (!p) continue;
      const b = el('div', 'hgPl p' + p.rank + (p.mine ? ' me' : '') + ([...p.name].length > 9 ? ' long' : '')); b.dataset.rank = p.rank;
      b.appendChild(el('div', 'rk', '#' + p.rank));
      const nm = el('div', 'nm'); if (p.crown) nm.appendChild(crown()); if (p.flag) nm.appendChild(el('span', 'f', p.flag)); nm.appendChild(el('span', 'n', p.name)); b.appendChild(nm);
      if (p.crown) b.classList.add('crown');
      const g = el('div', 'g'); g.appendChild(el('b', null, fmt(p.total))); g.append(' gold'); b.appendChild(g);
      b.appendChild(el('div', 'bar'));
      row.appendChild(b);
    }
    pod.appendChild(row); pod.hidden = false;
    shown.title = rows; shown[scope] = rows; if (scope === 'week') shown.last = [];
  }

  /* ---- the end screen ---- */
  const endBox = el('div', 'hgEnd'); endBox.id = 'hgEnd';
  const weekEl = el('div', 'hgWeek'); weekEl.id = 'hgWeek';
  const topEl = el('div', 'hgTop'); topEl.id = 'hgTop'; topEl.hidden = true;
  const endBtn = el('button', 'sec', 'Leaderboard'); endBtn.id = 'hgEndBoard'; endBtn.type = 'button';
  const endText = el('div', 'hgEndT'); endText.append(weekEl, topEl);
  endBox.append(endText, endBtn);
  const eEx = G.$('endExtra'); if (eEx) eEx.appendChild(endBox);
  const ERR = { too_fast: 'Not counted: too soon after your last round', bad_round: 'The server did not accept this round',
    no_profile: 'Pick a name and a country to join the board' };
  const line = (t, soft) => { weekEl.textContent = t; weekEl.classList.toggle('soft', !!soft); };
  function endTop(d) {
    const rows = top3rows(d); topEl.textContent = '';
    if (!rows.length) { topEl.hidden = true; shown.end = []; return; }
    topEl.appendChild(el('div', 'hgTopH', "THIS WEEK'S TOP 3"));
    for (const p of rows) {
      const r = el('div', 'hgT t' + p.rank + (p.mine ? ' me' : '')); r.dataset.rank = p.rank;
      r.appendChild(el('span', 'r', '#' + p.rank));
      if (p.crown) r.appendChild(crown());
      if (p.flag) r.appendChild(el('span', 'f', p.flag));
      r.appendChild(el('span', 'n', p.name));
      r.appendChild(el('span', 'g', fmt(p.total)));
      if (p.mine) r.appendChild(el('span', 'you', 'YOU'));
      topEl.appendChild(r);
    }
    topEl.hidden = false; shown.end = rows; shown.week = rows;
  }
  let endSeq = 0;
  G.on('start', () => { endSeq++; });
  G.on('end', (S, res) => { submit(res).catch(() => line('Saved only on this phone', true)); });
  async function submit(res) {
    const my = ++endSeq; topEl.hidden = true; topEl.textContent = ''; shown.end = [];
    if (!res || typeof res !== 'object') { line('Saved only on this phone', true); return; }
    const r = { god: String(res.god || ''), banked: num(res.bank), rank: num(res.rank), heroes: num(res.of), robs: num(res.robs), lost: num(res.lost), minted: num(res.minted),
      day: G.dayGod && G.dayGod.key ? String(G.dayGod.key) : '' };
    if (!hasProfile() || !G.net) { line('Saved only on this phone', true); return; }
    line('Saving to the weekly board…', true);
    let on = online(); if (!on && hasTG()) { try { on = await G.net.login(); } catch (e) { on = false; } }
    if (my !== endSeq) return;
    if (!on) { line('Saved only on this phone', true); return; }
    const x = await G.net.rpc('hg_round_submit', { token: null, r });
    if (my !== endSeq) return;
    if (x && x.ok && x.week) { const w = x.week; line('This week: total ' + fmt(w.total) + ' · best ' + fmt(w.best) + ' · #' + fmt(w.rank)); delete cache.week; delete cache.all; }
    else if (x && x.error) line(ERR[x.error] || 'The server did not save this round', true);
    else line('No answer from the server · saved only on this phone', true);
    const d = await load('week', true);
    if (my !== endSeq) return;
    endTop(d);
    if (scr.classList.contains('on')) render();
  }

  /* ---- the board screen ---- */
  const scr = el('div', 'scr hgScr'); scr.id = 'hgBoard';
  const box = el('div', 'hgB');
  const top = el('div', 'hgBtop'); const h2 = el('h2', null, 'LEADERBOARD'); const tot = el('div', 'hgTot'); tot.id = 'hgTot'; top.append(h2, tot);
  const tabs = el('div', 'hgTabs'); tabs.id = 'hgTabs';
  const seg = (id, items) => { const s = el('div', 'hgSeg'); s.id = id; for (const [k, t] of items) { const b = el('button', null, t); b.type = 'button'; b.dataset.k = k; s.appendChild(b); } return s; };
  const segScope = seg('hgScope', [['week', 'THIS WEEK'], ['all', 'ALL TIME']]), segKind = seg('hgKind', [['players', 'PLAYERS'], ['countries', 'COUNTRIES']]);
  tabs.append(segScope, segKind);
  const body = el('div', 'hgBody'); body.id = 'hgBody';
  const pin = el('div', 'hgPin'); pin.id = 'hgPin'; pin.hidden = true;
  const closeB = el('button', 'pri', 'CLOSE'); closeB.id = 'hgClose'; closeB.type = 'button';
  box.append(top, tabs, body, pin, closeB); scr.appendChild(box); document.body.appendChild(scr);
  let scope = 'week', kind = 'players', state = {};   // state[scope] = 'loading' | 'error'
  segScope.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; scope = b.dataset.k; render(); fetchScope(); });
  segKind.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; kind = b.dataset.k; render(); });
  closeB.addEventListener('click', () => close());

  function cell(cls, text) { return el('span', cls, text); }
  function note(text, retry) {
    const n = el('div', 'hgNote'); n.appendChild(el('div', null, text));
    if (retry) { const b = el('button', 'sec', 'Try again'); b.type = 'button'; b.id = 'hgRetry'; b.addEventListener('click', () => { delete state[scope]; open(true); }); n.appendChild(b); }
    body.appendChild(n);
  }
  function render() {
    for (const b of segScope.children) b.classList.toggle('on', b.dataset.k === scope);
    for (const b of segKind.children) b.classList.toggle('on', b.dataset.k === kind);
    body.textContent = ''; pin.hidden = true; pin.textContent = ''; tot.textContent = '';
    if (!online()) {
      tabs.hidden = true;
      if (!hasTG()) note('Open HOLDOR in Telegram to see the boards');
      else if (G.net && G.net.pending) note('Connecting…');
      else note('Could not reach the server.', true);
      return;
    }
    tabs.hidden = false;
    const c = cache[scope];
    if (!c) { if (state[scope] === 'error') note('Could not load the board.', true); else note('Loading…'); return; }
    const d = c.d, t = d.totals || {};
    tot.textContent = pl(t.players, 'player', 'players') + ' · ' + pl(t.rounds, 'round', 'rounds') + (scope === 'week' ? ' this week' : ' in all');
    if (kind === 'players') {
      const ps = players(d);
      if (!ps.length) { note(scope === 'week' ? 'No rounds yet this week. Be the first.' : 'No rounds yet. Be the first.'); }
      else {
        const hd = el('div', 'hgRow hd'); hd.append(cell('k', '#'), cell(), cell('n', 'Name'), cell('v', 'Total'), cell('v', 'Best'), cell('v', 'Rounds')); body.appendChild(hd);
        for (const p of ps) {
          const r = el('div', 'hgRow' + (p.mine ? ' me' : '')); r.dataset.rank = p.rank;
          const n = cell('n'); if (p.crown) { n.appendChild(crown()); r.classList.add('crown'); } n.append(p.name);
          r.append(cell('k', String(p.rank)), cell('fl', flag(p.country)), n, cell('v', fmt(p.total)), cell('v', fmt(p.best)), cell('v', fmt(p.rounds)));
          body.appendChild(r);
        }
      }
      const me = d.me && typeof d.me === 'object' ? d.me : null, inList = ps.some(p => p.mine);
      if (me && num(me.rank) > 0 && (!inList || num(me.rank) > 20)) {
        pin.appendChild(el('b', null, 'You: #' + fmt(me.rank)));
        pin.appendChild(el('span', 'n', (hasProfile() ? flag(G.profile.country) + ' ' + G.profile.name : '')));
        pin.appendChild(el('span', 's', 'total ' + fmt(me.total) + ' · best ' + fmt(me.best) + ' · ' + pl(me.rounds, 'round', 'rounds')));
        pin.hidden = false;
      } else if (!me && !inList && hasProfile()) {
        pin.appendChild(el('span', 's', scope === 'week' ? 'You: no rounds this week yet' : 'You: no rounds yet')); pin.hidden = false;
      }
    } else {
      const cs = countries(d);
      if (!cs.length) { note('No countries on the board yet.'); return; }
      const hd = el('div', 'hgRow hd'); hd.append(cell('k', '#'), cell(), cell('n', 'Country'), cell('v', 'Players'), cell('v', 'Rounds'), cell('v', 'Gold')); body.appendChild(hd);
      const mine = hasProfile() ? G.profile.country : '';
      cs.forEach((c, i) => {
        const r = el('div', 'hgRow' + (c.country && c.country === mine ? ' me' : '')); r.dataset.cc = c.country;
        r.append(cell('k', String(i + 1)), cell('fl', flag(c.country)), cell('n', cname(c.country)), cell('v', fmt(c.players)), cell('v', fmt(c.rounds)), cell('v', fmt(c.gold)));
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

  const tBtn = el('button', 'sec', 'Leaderboard'); tBtn.id = 'hgTitleBoard'; tBtn.type = 'button';
  const links = G.$('titleLinks'); if (links) links.appendChild(tBtn);
  tBtn.addEventListener('click', open); endBtn.addEventListener('click', open);

  G.on('net', on => { podium(); if (scr.classList.contains('on')) { render(); if (on) fetchScope(); } });
  G.on('title', () => podium());
  G.on('profile', () => { if (scr.classList.contains('on')) render(); });
  G.board = { open, close, load, render, podium, top3: s => (shown[s || 'title'] || []).map(r => Object.assign({}, r)) };
  if (online()) podium();
})();
