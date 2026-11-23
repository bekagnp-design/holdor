/* Heavy Gold — the country ladder and the champion's crown (36_ladder.js; src/gold/GOLD.md, "Wave 5").
   Server: hg_ladder(token) → {week_start, week_end, iso_week, ladder:[{pos, country, real, bots, score, rounds, opp, opp_score, side, crown}],
           mine:{country, pos, opp, score, opp_score, side, ends_at} | null, last:[{week, a, b, a_score, b_score, winner}]}.
   - GOLD.md "UI rules" (the owner: "too much text"): icons and numbers, 1–3 word labels, no rule paragraphs.
   - The ladder screen (#lgLadder): a ⚔ "Ladder" icon button (.ib #lgBtn) in #titleLinks, right after the 💬 chat icon, with a badge
     (#lgBadge) "#5" and a dot for the duel (green he leads, red he trails, gold a tie), and the same icon in the board screen's
     header (#lgFromBoard). Title "LADDER" and "⏳ 3 d 4 h"; the countries by position: #pos, flag, name (👑 for #1), "👤 2" (real
     players), the score (integers; a decimal only when a pair would read equal); this week's pairs with a "VS" chip between them
     ("=" on a tie: the higher place holds), the leading score in gold; "👤 9 · Rest" for a country without a duel; the player's
     country highlighted and scrolled into view. The player's duel line ("🇬🇪 120 : 98 🇹🇷 +22", or "🇬🇪 #1 · Rest", or
     "🇬🇪 · Play to join") is pinned in landscape's left column; in portrait only "Play to join" shows (the rest repeats the list).
     Last week (#lgLastWeek, under the list; the left column in landscape): "🇬🇪 95 : 70 🇧🇷 ▲" (winner first, ▲ the lower one moved up).
     A tap on a country opens it: "🤖 bot1 · bot2 · bot3 · 7 rounds" (bots: members that never add gold). One CLOSE.
   - The end screen: one line in #endExtra (#lgEnd, after the board module's hg_round_submit has answered: its
     G.emit('submitted', answer, r); then a fresh hg_ladder): "⚔ 🇬🇪 135 : 98 🇹🇷 +37" (the margin; "=" on a tie). The title shows
     no line, only the badge. Nothing when offline, when the player's country is not on the ladder, or when it rests (the badge then shows "#pos").
   - The crown: G.profile.crown = the player is the champion, read from the 'last' board (his own row, mine: true, carries crown: true;
     G.board.load shares the podium's request) on every login and again when hg_ladder names a new week; hg_profile_get's crown is
     asked instead only when there is no board module. Cleared offline. In the arena a small crown is drawn above the hero's own
     circle, above his name (the core's drawP writes the name at sy - r - 18), and above his Loki decoys. Board rows and the podium
     get 👑 in 30_board.js. G.net.rpc is not wrapped.
   - Only server data is shown; no Telegram id is read. Every text goes in with textContent.
   - G.ladder = { open(), close(), load(fresh), refresh(fresh) (the badge), data (the last normalised answer), text(D) (the line, '' when none),
     drawCrown(ctx, x, y, alpha, width), crownDrawn (a counter), crownAt / decoyAt ({x, y, w, h} on the screen: the last crown drawn over the
     hero / over his decoy) }. When a fresh hg_ladder answer names a new week, the crown is asked again (the champion changes). */
(function () {
  const G = window.G; if (!G || !G.on) return;
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const int = v => Math.round(num(v));
  const code = v => { const s = String(v == null ? '' : v).toUpperCase(); return /^[A-Z]{2}$/.test(s) ? s : ''; };
  const flag = c => (typeof G.flag === 'function' ? G.flag(c) : '') || '';
  const cname = c => (typeof G.countryName === 'function' && G.countryName(c)) || c || '—';
  const arr = v => Array.isArray(v) ? v : [];
  const fmt = v => int(v).toLocaleString('en-US');
  /* scores as integers; a pair whose numbers differ but round equal gets 1 (then 2) decimals */
  const dp = (a, b) => { if (b == null || num(a) === num(b)) return 0; for (let d = 0; d < 2; d++) { const f = 10 ** d; if (Math.round(num(a) * f) !== Math.round(num(b) * f)) return d; } return 2; };
  const fmtS = (v, d) => { const f = 10 ** (d || 0); return (Math.round(num(v) * f) / f).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d || 0 }); };
  const pl = (n, one, many) => fmt(n) + ' ' + (int(n) === 1 ? one : many);
  const online = () => !!(G.net && G.net.on);
  const hasTG = () => { try { return !!(G.TG && typeof G.TG.initData === 'string' && G.TG.initData.length); } catch (e) { return false; } };
  const myCC = () => (G.profile && code(G.profile.country)) || '';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const $ = id => document.getElementById(id);
  const TTL = 30000;

  /* ---- styles ---- */
  const css = document.createElement('style');
  css.textContent = [
    '.lgScr{background:var(--bg,#070c16);z-index:21}',
    '.lgBox{flex:1 1 auto;min-height:0;width:min(100%,640px);display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto auto;grid-template-areas:"head" "mine" "list" "last" "foot";gap:8px}',
    '.lgHead{grid-area:head;display:flex;align-items:baseline;justify-content:space-between;gap:2px 12px}',
    '.lgHead h2{margin:0;font:900 20px/1.2 Georgia,serif;letter-spacing:.08em;color:var(--gold,#e8b84a)}',
    '.lgEnds{font:700 14px/1.3 Georgia,serif;color:var(--ink,#f3e7c4);white-space:nowrap}.lgEnds:empty{display:none}',
    '.lgMine{grid-area:mine;border:2px solid var(--gold,#e8b84a);border-radius:12px;background:rgba(232,184,74,.1);padding:8px 10px;font:700 17px/1.3 Georgia,serif;color:var(--ink,#f3e7c4);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lgMine[hidden]{display:none}',
    '.lgBody{grid-area:list;min-height:64px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;border-radius:12px;display:flex;flex-direction:column;gap:6px}',
    '.lgFoot{grid-area:foot;display:flex;justify-content:center}',
    '.lgDuel{border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);overflow:hidden;flex:none}',
    '.lgDuel.mine{border-color:rgba(232,184,74,.6)}',
    '.lgRow{display:grid;grid-template-columns:34px 26px minmax(0,1fr) auto;grid-template-areas:"k fl nm sc" ". . ex ex";align-items:center;column-gap:6px;width:100%;min-height:48px;padding:5px 10px;border:0;background:transparent;color:var(--ink,#f3e7c4);font:14px/1.25 Georgia,serif;text-align:left;cursor:pointer;touch-action:pan-y}',
    '.lgRow .k{grid-area:k;font-weight:900;color:var(--muted,#8d9bb0)}.lgRow .fl{grid-area:fl;font-size:19px;line-height:1}',
    '.lgRow .nm{grid-area:nm;display:flex;flex-direction:column;min-width:0}.lgRow .n{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.lgRow .m{font-size:13px;color:var(--muted,#8d9bb0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.lgRow .sc{grid-area:sc;font:700 17px/1 Georgia,serif;color:var(--muted,#8d9bb0);text-align:right;white-space:nowrap}.lgRow .sc.lead,.lgDuel.rest .lgRow .sc{font-weight:900;color:var(--gold,#e8b84a)}',
    '.lgRow .m .rs{font-style:italic;color:#cfd6e2}',
    '.lgRow .ex{grid-area:ex;display:none;font-size:13px;line-height:1.35;color:#cfd6e2;padding-top:3px;white-space:normal}.lgRow.open .ex{display:block}',
    '.lgRow.me{background:rgba(232,184,74,.18)}.lgRow.me .n,.lgRow.me .k{color:var(--gold,#e8b84a)}',
    '.lgVs{display:flex;align-items:center;justify-content:center;gap:6px;padding:2px 10px;font:13px/1.3 Georgia,serif;color:#cfd6e2;border-top:1px dashed rgba(255,255,255,.1);border-bottom:1px dashed rgba(255,255,255,.1);text-align:center;white-space:nowrap}',
    '.lgDuel>.lgVs:last-child{border-bottom:0}',
    '.lgVs .x{font:900 13px Georgia,serif;letter-spacing:.12em;color:#1c1207;background:var(--gold,#e8b84a);border-radius:6px;padding:1px 5px}',
    '.lgLast{grid-area:last;min-height:0;max-height:30vh;overflow-y:auto;padding:2px 4px;display:flex;flex-direction:column;gap:3px}.lgLast:empty{display:none}',
    '.lgLastH{font:700 12px/1.2 Georgia,serif;letter-spacing:.14em;color:var(--muted,#8d9bb0);text-align:center}',
    '.lgLastR{font:14px/1.35 Georgia,serif;color:#cfd6e2;text-align:center;white-space:nowrap}',
    '.lgNote{padding:18px 12px;text-align:center;font:15px/1.4 Georgia,serif;color:#cfd6e2;display:flex;flex-direction:column;align-items:center;gap:10px}',
    /* the end line and the pinned duel: one short line */
    '.lgLine{font:700 14px/1.3 Georgia,serif;color:var(--ink,#f3e7c4);text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lgLine .s,.lgMine .s{color:var(--gold,#e8b84a)}',
    '.lgLine .l.up,.lgMine .l.up{color:#5be38a}.lgLine .l.down,.lgMine .l.down{color:#ff8a7a}.lgLine .l.tie,.lgMine .l.tie{color:var(--gold,#e8b84a)}',
    /* the badge on the title's ⚔ icon: the place, ▲ / ▼ for the duel */
    '#lgBtn{position:relative}.lgBadge{position:absolute;top:-6px;right:-4px;min-width:24px;padding:1px 5px;border-radius:10px;background:#141a22;border:1.5px solid var(--gold,#e8b84a);color:var(--gold,#e8b84a);font:900 12px/1.2 Georgia,serif;letter-spacing:0;white-space:nowrap;pointer-events:none;display:flex;align-items:center;gap:3px}',
    /* the duel: a dot (green you lead, red you trail, gold a tie), never an arrow (arrows mean last week's moves) */
    '.lgBadge.up::after,.lgBadge.down::after,.lgBadge.tie::after{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}',
    '.lgBadge.up{color:#5be38a;border-color:#5be38a}.lgBadge.down{color:#ff8a7a;border-color:#ff8a7a}.lgBadge[hidden]{display:none}',
    '#lgFromBoard{order:3;margin-left:auto;flex:none;align-self:center}',
    /* a short landscape window: the head, your duel and CLOSE on the left, the list on the right */
    /* portrait: the pinned duel would repeat the highlighted pair (the list scrolls to it), so it shows only in landscape's left column */
    '@media (orientation:portrait){.lgMine.dup{display:none}}',
    '@media (orientation:landscape) and (max-height:540px){.lgBox{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);grid-template-rows:auto auto minmax(0,1fr) auto;grid-template-areas:"head list" "mine list" "last list" "foot list";gap:8px 16px;width:min(100%,860px)}',
    '.lgLast{max-height:none}',
    '.lgHead h2{font-size:18px}.lgMine{font-size:15px;padding:6px 8px}.lgFoot{align-items:flex-end}.lgFoot .pri{width:100%}.lgRow{min-height:44px;padding:3px 8px}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---- data ---- */
  let cache = null, inflight = null, askedCC = null, weekEnds = 0;   // cache = {at, D, cc}: cc = the player's country when it was asked
  function norm(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.error) return null;
    const rows = [];
    for (const r of arr(d.ladder)) {
      if (!r || typeof r !== 'object') continue;
      const c = code(r.country), pos = int(r.pos); if (!c || pos < 1) continue;
      const side = r.side === 'up' || r.side === 'down' ? r.side : 'rest';
      rows.push({ pos, country: c, real: Math.max(0, int(r.real)), bots: Math.max(0, int(r.bots)), score: num(r.score), rounds: Math.max(0, int(r.rounds)),
        opp: side === 'rest' ? '' : code(r.opp), opp_score: r.opp_score == null ? null : num(r.opp_score), side, crown: !!r.crown });
    }
    rows.sort((a, b) => a.pos - b.pos);
    const t = Date.parse(String((d.mine && d.mine.ends_at) || d.week_end || ''));
    let mine = null;
    if (d.mine && typeof d.mine === 'object' && code(d.mine.country)) {
      const m = d.mine, c = code(m.country), row = rows.find(r => r.country === c) || null;
      const side = m.side === 'up' || m.side === 'down' || m.side === 'rest' ? m.side : (row ? row.side : 'rest');
      mine = { country: c, pos: int(m.pos) || (row ? row.pos : 0), opp: side === 'rest' ? '' : code(m.opp), score: num(m.score), opp_score: m.opp_score == null ? null : num(m.opp_score), side };
      if (mine.opp) { const o = rows.find(r => r.country === mine.opp); mine.opp_pos = o ? o.pos : (side === 'up' ? mine.pos - 1 : mine.pos + 1); }
    }
    const last = arr(d.last).map(x => x && typeof x === 'object' ? { a: code(x.a), b: code(x.b), a_score: num(x.a_score), b_score: num(x.b_score), winner: code(x.winner) } : null).filter(x => x && x.a && x.b);
    return { iso: int(d.iso_week), ends: isFinite(t) ? t : 0, rows, mine, last };
  }
  function load(fresh) {
    if (!fresh && cache && Date.now() - cache.at < TTL && !over(cache)) return Promise.resolve(cache.D);
    if (inflight) return fresh ? inflight.then(() => load(true)) : inflight;   // a fresh ask never takes an answer asked for before it
    if (!online()) return Promise.resolve(null);
    const cc = askedCC = myCC();
    const p = inflight = G.net.rpc('hg_ladder', { token: null }).then(d => { const D = norm(d);   // a failed ask forgets the old answer: the title and the screen never show a stale duel
      if (p === inflight) { cache = D ? { at: Date.now(), D, cc } : null; L.data = D; }
      if (D && D.ends) { if (weekEnds && D.ends !== weekEnds) recheck(); weekEnds = D.ends; }   // a new week: last week's champion has changed
      return D; })
      .catch(() => null).then(D => { if (inflight === p) inflight = null; return D; });
    return p;
  }
  const drop = () => { cache = null; inflight = null; askedCC = null; };
  /* the week of a cached answer is over: only when the answer was fetched before its end (a phone clock ahead of the server gets the
     same week back after it, and must not ask again and again) */
  const over = c => !!(c && c.D.ends && c.at < c.D.ends && Date.now() >= c.D.ends);

  /* ---- who leads a duel: the higher score; a tie keeps the higher place (the smaller pos) ---- */
  function lead(hi, lo) {   // hi = the upper of the pair {pos, score}, lo = the lower
    if (hi.score > lo.score) return { w: hi, tie: false };
    if (lo.score > hi.score) return { w: lo, tie: false };
    return { w: hi, tie: true };
  }

  /* ---- the line: "⚔ 🇬🇪 120 : 98 🇹🇷 +22" (the margin: + the player's country leads, − it trails; "=" a tie, where the higher
     place holds); null when there is no duel ---- */
  function duel(D) {
    const m = D && D.mine; if (!m || !m.opp || m.side === 'rest' || m.opp_score == null) return null;
    const me = { pos: m.pos, score: m.score }, op = { pos: m.opp_pos, score: m.opp_score };
    const up = m.side === 'up' ? op : me, dn = up === me ? op : me, x = lead(up, dn), win = x.w === me;
    const n = dp(m.score, m.opp_score), dm = num(m.score) - num(m.opp_score);
    return { m, win, tie: x.tie, n, k: x.tie ? 'tie' : win ? 'up' : 'down', mark: x.tie ? '=' : (dm > 0 ? '+' : '−') + fmtS(Math.abs(dm), n) };
  }
  function parts(D, pre) {
    const d = duel(D); if (!d) return null; const m = d.m;
    return (pre ? [['⚔ ', null]] : []).concat([[(flag(m.country) || m.country) + ' ', 'a'], [fmtS(m.score, d.n) + ' : ' + fmtS(m.opp_score, d.n), 's'],
      [' ' + (flag(m.opp) || m.opp) + ' ', 'a'], [d.mark, 'l ' + d.k]]);
  }
  const text = D => { const p = parts(D, true); return p ? p.map(q => q[0]).join('') : ''; };
  function chunks(box, ps) { for (const [t, c] of ps) { if (c) box.appendChild(el('span', 'q ' + c, t)); else box.appendChild(document.createTextNode(t)); } }
  function fill(box, ps) { box.textContent = ''; chunks(box, ps); }

  /* ---- the badge on the title's ⚔ icon (no text line on the title) ---- */
  const badge = el('b', 'lgBadge'); badge.id = 'lgBadge'; badge.hidden = true;
  const bHide = () => { badge.hidden = true; badge.textContent = ''; badge.className = 'lgBadge'; };
  let tSeq = 0;
  async function titleLine(fresh) {
    const my = ++tSeq;
    if (!online()) { bHide(); return; }
    const D = await load(fresh);
    if (my !== tSeq) return;
    const m = D && D.mine;
    if (!online() || !m || !m.pos) { bHide(); return; }
    const d = duel(D);
    badge.textContent = '#' + m.pos; badge.className = 'lgBadge' + (d ? ' ' + d.k : ''); badge.hidden = false;
  }

  /* ---- the end line (after the round's submit has answered) ---- */
  const eLine = el('div', 'lgLine'); eLine.id = 'lgEnd';
  const eHide = () => { eLine.textContent = ''; if (eLine.parentNode) eLine.parentNode.removeChild(eLine); };
  let endSeq = 0, endWait = 0;
  async function endLine(my) {
    if (!online()) { eHide(); return; }
    const D = await load(true);
    if (my !== endSeq) return;
    if (!online() || !parts(D)) { eHide(); return; }
    fill(eLine, parts(D, true));
    const ex = $('endExtra'); if (!ex) return;
    const after = $('hgEnd');
    if (after && after.parentNode === ex) ex.insertBefore(eLine, after.nextSibling); else if (eLine.parentNode !== ex) ex.appendChild(eLine);
  }
  G.on('start', () => { endSeq++; endWait = 0; eHide(); });
  G.on('end', () => { const my = ++endSeq; eHide(); endWait = my; if (!G.board) { endWait = 0; endLine(my); } });

  /* the board module's hg_round_submit has answered (30_board.js: G.emit('submitted', answer, r)): this week's numbers changed */
  G.on('submitted', () => { drop(); if (endWait && endWait === endSeq) { const my = endWait; endWait = 0; endLine(my); } });

  /* ---- the crown ---- */
  function setCrown(v) { if (!G.profile) return; G.profile.crown = !!v; }
  /* am I the champion? His row on the 'last' board is mine and crowned (the same answer the podium uses: no extra call while it is
     cached); hg_profile_get's crown only when there is no board module. A failed ask keeps the crown as it was. */
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v) && !v.error;
  let crownSeq = 0;
  function askCrown(fresh) {
    const my = ++crownSeq; if (!online()) return Promise.resolve();
    const brd = G.board && typeof G.board.load === 'function';
    const p = brd ? G.board.load('last', !!fresh) : G.net.rpc('hg_profile_get', { token: null });
    return Promise.resolve(p).then(d => {
      if (my !== crownSeq || !online() || !isObj(d)) return;
      setCrown(brd ? arr(d.players).some(r => r && r.mine === true && r.crown === true) : d.crown === true);
    }).catch(() => {});
  }
  const recheck = () => askCrown(true);
  G.on('net', on => {
    if (!on) { crownSeq++; setCrown(false); bHide(); eHide(); drop(); if (scr.classList.contains('on')) render(); return; }
    askCrown(false);
    titleLine(); if (scr.classList.contains('on')) refreshScreen(false);
  });
  /* the crown: three points with pearls, a gold band with a garnet; (x, y) = the middle of its base, w = its width in px */
  function drawCrown(ctx, x, y, alpha, w) {
    w = w || 20; const h = w * 0.62;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h * 0.92); ctx.lineTo(x - w / 4, y - h * 0.42); ctx.lineTo(x, y - h * 1.08);
    ctx.lineTo(x + w / 4, y - h * 0.42); ctx.lineTo(x + w / 2, y - h * 0.92); ctx.lineTo(x + w / 2, y); ctx.closePath();
    const g = ctx.createLinearGradient(0, y - h, 0, y); g.addColorStop(0, '#ffe7a0'); g.addColorStop(1, '#d49a2a');
    ctx.fillStyle = g; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(20,12,2,.85)'; ctx.stroke();
    ctx.fillStyle = '#fff6d6'; for (const [px, py] of [[x - w / 2, y - h * 0.92], [x, y - h * 1.08], [x + w / 2, y - h * 0.92]]) { ctx.beginPath(); ctx.arc(px, py, Math.max(1.4, w * 0.08), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#c2352a'; ctx.beginPath(); ctx.arc(x, y - h * 0.24, Math.max(1.3, w * 0.075), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  G.on('draw', (ctx, k, ox, oy) => {
    const S = G.S; if (!S || !S.me || !(G.profile && G.profile.crown) || !online()) return;
    const me = S.me, W = G.W, H = G.H;
    const one = (x, y, carry, alpha) => {
      const r = G.radius({ carry }) * k, sx = x * k + ox, sy = y * k + oy, cw = 20, cy = sy - r - 31;   // the name's baseline is sy - r - 18 (12 px type)
      if (sx < -40 || sx > W + 40 || cy < -30 || cy > H + 30) return null;
      drawCrown(ctx, sx, cy, alpha, cw); return { x: sx, y: cy, w: cw, h: cw * 0.62 };
    };
    for (const dc of S.decoys || []) if (dc.owner === me) { const a = one(dc.x, dc.y, dc.carry, 0.9); if (a) L.decoyAt = a; }   // a decoy is drawn with its own carry (at least 40)
    const at = one(me.x, me.y, me.carry, me.inv > S.t ? 0.35 : 1);
    if (at) { L.crownAt = at; L.crownDrawn++; }
  });

  /* ---- the ladder screen ---- */
  const scr = el('div', 'scr lgScr'); scr.id = 'lgLadder';
  const box = el('div', 'lgBox');
  const head = el('div', 'lgHead'); const h2 = el('h2', null, 'LADDER'); const ends = el('div', 'lgEnds'); ends.id = 'lgEnds';
  head.append(h2, ends);
  const mineEl = el('div', 'lgMine'); mineEl.id = 'lgMine'; mineEl.hidden = true;
  const body = el('div', 'lgBody'); body.id = 'lgBody';
  const lastEl = el('div', 'lgLast'); lastEl.id = 'lgLastWeek';
  const foot = el('div', 'lgFoot'); const closeB = el('button', 'pri', 'CLOSE'); closeB.id = 'lgClose'; closeB.type = 'button'; foot.appendChild(closeB);
  box.append(head, mineEl, body, lastEl, foot); scr.appendChild(box); document.body.appendChild(scr);
  closeB.addEventListener('click', () => close());
  const open1 = new Set();   // the countries opened by a tap (they stay open across a refresh)
  body.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.lgRow'); if (!b) return; const c = b.dataset.cc;
    if (open1.has(c)) open1.delete(c); else open1.add(c); detail(b); });

  let state = '';   // '' | 'loading' | 'error'
  const left = ms => { if (ms <= 0) return '⏳ now'; const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return '⏳ ' + (d ? d + ' d ' + h + ' h' : h ? h + ' h ' + mm + ' m' : Math.max(1, mm) + ' m'); };
  function note(text, retry) {
    const n = el('div', 'lgNote'); n.appendChild(el('div', null, text));
    if (retry) { const b = el('button', 'sec', '↻ Retry'); b.type = 'button'; b.id = 'lgRetry'; b.addEventListener('click', () => { state = ''; open(true); }); n.appendChild(b); }
    body.appendChild(n);
  }
  /* a row: #pos, flag, name, "👤 N" (real players; the bots only in the opened detail; "· Rest" without a duel), the score
     (n decimals, shared by the pair; lead = this row leads its duel) */
  function row(r, n, ld, rest) {
    const b = el('button', 'lgRow' + (r.country === myCC() ? ' me' : '')); b.type = 'button';
    b.dataset.cc = r.country; b.dataset.pos = r.pos;
    const m = el('span', 'm', '👤 ' + fmt(r.real)); if (rest) { m.append(' · ', el('span', 'rs', 'Rest')); }
    const nm = el('span', 'nm'); nm.append(el('span', 'n', (r.crown ? '👑 ' : '') + cname(r.country)), m);
    b._r = r; b.append(el('span', 'k', '#' + r.pos), el('span', 'fl', flag(r.country)), nm, el('span', 'sc' + (ld ? ' lead' : ''), fmtS(r.score, n)), el('span', 'ex'));
    detail(b); return b;
  }
  /* an opened country: its bots by name (only while it is open) and its rounds */
  function detail(b) {
    const r = b._r, on = open1.has(r.country), ex = b.querySelector('.ex');
    b.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on));
    if (!on) { ex.textContent = ''; return; }
    const nb = Math.min(r.bots, 5), bots = []; for (let i = 1; i <= nb; i++) bots.push('bot' + i);
    ex.textContent = (nb ? '🤖 ' + bots.join(' · ') + ' · ' : '') + pl(r.rounds, 'round', 'rounds');
  }
  /* the chip between a pair: "VS", or "=" on a tie (the upper one holds: its score is marked) */
  function vsLine(x) { const v = el('div', 'lgVs'); v.appendChild(el('span', 'x', x.tie ? '=' : 'VS')); return v; }
  function render() {
    body.textContent = ''; lastEl.textContent = ''; mineEl.hidden = true; mineEl.textContent = ''; mineEl.classList.remove('dup'); ends.textContent = '';
    if (!online()) {
      if (!hasTG()) note('Open in Telegram');
      else if (G.net && G.net.pending) note('Connecting…');
      else note('Offline', true);
      return;
    }
    const D = cache && cache.D;
    if (!D) { if (state === 'error') note('Not loaded', true); else note('Loading…'); return; }
    if (D.ends) ends.textContent = left(D.ends - Date.now());
    // your country
    const cc = myCC(), m = D.mine, ps = parts(D);
    if (ps) { fill(mineEl, ps); mineEl.hidden = false; mineEl.classList.add('dup'); }
    else if (m && m.side === 'rest') { mineEl.textContent = (flag(m.country) || m.country) + ' #' + m.pos + ' · Rest'; mineEl.hidden = false; mineEl.classList.add('dup'); }
    else if (cc && !D.rows.some(r => r.country === cc)) { mineEl.textContent = (flag(cc) || cc) + ' · Play to join'; mineEl.hidden = false; }
    // the duels, top to bottom
    const rows = D.rows;
    if (!rows.length) { note('No countries yet'); return; }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], n = rows[i + 1], card = el('div', 'lgDuel');
      if (r.side === 'down' && n && n.country === r.opp && n.side === 'up') {
        const x = lead(r, n), d = dp(r.score, n.score);
        card.dataset.pair = r.pos + '-' + n.pos; card.append(row(r, d, x.w === r), vsLine(x), row(n, d, x.w === n));
        if (r.country === cc || n.country === cc) card.classList.add('mine');
        i++;
      } else if (r.side === 'rest' || !r.opp || r.opp_score == null) {
        card.classList.add('rest'); card.dataset.pair = String(r.pos); card.append(row(r, 0, false, true));
        if (r.country === cc) card.classList.add('mine');
      } else {   // a pair the list does not hold side by side: the vs line from this row's own numbers
        const o = { pos: r.side === 'up' ? r.pos - 1 : r.pos + 1, score: r.opp_score, country: r.opp }, me_ = { pos: r.pos, score: r.score, country: r.country };
        const x = r.side === 'up' ? lead(o, me_) : lead(me_, o);
        card.dataset.pair = String(r.pos); card.append(row(r, dp(r.score, r.opp_score), x.w === me_), vsLine(x));
        if (r.country === cc) card.classList.add('mine');
      }
      body.appendChild(card);
    }
    /* last week: the winner first, ▲ at the end when the lower one moved up (the only arrow on the screen) */
    if (D.last.length) {
      lastEl.appendChild(el('div', 'lgLastH', 'LAST WEEK'));
      for (const x of D.last) {
        const aw = x.winner !== x.b, ws = aw ? x.a_score : x.b_score, ls = aw ? x.b_score : x.a_score, f = c => flag(c) || c, n = dp(ws, ls);
        lastEl.appendChild(el('div', 'lgLastR', f(aw ? x.a : x.b) + ' ' + fmtS(ws, n) + ' : ' + fmtS(ls, n) + ' ' + f(aw ? x.b : x.a) + (aw ? '' : ' ▲')));
      }
    }
  }
  function toMine() {
    const b = body.querySelector('.lgRow.me'); if (!b) return;
    const card = b.closest('.lgDuel') || b;
    try { body.scrollTop = Math.max(0, card.offsetTop - body.offsetTop - (body.clientHeight - card.offsetHeight) / 2); } catch (e) {}
  }
  let tick = 0;
  async function refreshScreen(fresh) {
    if (!online()) { render(); return; }
    if (!cache || fresh) state = 'loading';
    render();
    const D = await load(!!fresh);
    state = D ? '' : 'error';
    if (scr.classList.contains('on')) { render(); toMine(); }
  }
  async function open(fresh) {
    scr.classList.add('on'); body.scrollTop = 0; render();
    clearInterval(tick);
    tick = setInterval(() => { if (!scr.classList.contains('on')) { clearInterval(tick); return; }
      const D = cache && cache.D; if (over(cache)) refreshScreen(true); else if (D && D.ends) ends.textContent = left(D.ends - Date.now()); }, 20000);
    if (!online() && hasTG() && G.net) { const p = G.net.login(true); render(); await p; }   // "Connecting…" while the login runs
    await refreshScreen(fresh === true || !cache || Date.now() - cache.at >= TTL);
  }
  function close() { scr.classList.remove('on'); clearInterval(tick); }

  /* ---- the buttons ---- */
  const ib = id => { const b = el('button', 'ib'); b.id = id; b.type = 'button'; b.setAttribute('aria-label', 'Country ladder'); b.append(el('i', null, '⚔'), el('span', null, 'Ladder')); return b; };
  const tBtn = ib('lgBtn'); tBtn.appendChild(badge);
  /* right after the chat icon (35_chat puts it first), so it stays in the first row whatever later modules append */
  const links = $('titleLinks');
  if (links) { const ch = $('hgChatBtn'); if (ch && ch.parentNode === links) links.insertBefore(tBtn, ch.nextSibling); else links.insertBefore(tBtn, links.firstChild); }
  tBtn.addEventListener('click', () => open());
  const bTop = document.querySelector('#hgBoard .hgBtop');
  if (bTop) { const bb = ib('lgFromBoard'); bTop.appendChild(bb); bb.addEventListener('click', () => open()); }

  G.on('title', () => titleLine());
  /* a new country changes `mine` on the server: ask again (the boot-time sync that keeps the same country asks nothing) */
  G.on('profile', () => {
    if (scr.classList.contains('on')) render();
    if (!online() || askedCC === myCC()) return;
    drop(); titleLine(true); if (scr.classList.contains('on')) refreshScreen(true);
  });

  const L = G.ladder = { open, close, load, refresh: fresh => titleLine(fresh), text, drawCrown, crownDrawn: 0, crownAt: null, decoyAt: null, data: null };
  if (online()) { askCrown(false); titleLine(); }
})();
