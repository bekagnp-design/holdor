/* Heavy Gold — the country ladder and the champion's crown (36_ladder.js; src/gold/GOLD.md, "Wave 5").
   Server: hg_ladder(token) → {week_start, week_end, iso_week, ladder:[{pos, country, real, bots, score, rounds, opp, opp_score, side, crown}],
           mine:{country, pos, opp, score, opp_score, side, ends_at} | null, last:[{week, a, b, a_score, b_score, winner}]}.
   - The ladder screen (#lgLadder): a "Country ladder" .sec button in #titleLinks and one in the board screen's header (#hgBoard).
     The countries by position, each with flag, name (👑 for #1), "N players + M bots", this week's score; this week's duels drawn as
     pairs with a vs line between them (both scores, who leads; a tie keeps the higher place), "Rests this week" for a country without
     a duel; the player's country highlighted and scrolled into view; "Ends in 3 d 4 h"; last week's results under the list.
     A tap on a country opens it: its bots by name (bot1…botN, members that never add gold) and its rounds this week. One CLOSE.
   - The line "🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 120 vs 98 — you lead" under the podium in #titleExtra (#lgTitle) and in
     #endExtra (#lgEnd, after the round's hg_round_submit has answered, from a fresh hg_ladder). Nothing when offline, when the
     player's country is not on the ladder, or when it rests this week.
   - The crown: G.profile.crown is set from every hg_profile_get answer (the profile module's sync; this module asks itself only when
     there is no profile module) and cleared offline. In the arena a small crown is drawn above the hero's own circle, above his name
     (the core's drawP writes the name at sy - r - 18), and above his Loki decoys. Board rows and the podium get 👑 in 30_board.js.
   - G.net.rpc is wrapped once (the call and its answer unchanged) to see hg_round_submit / hg_profile_get / hg_profile_set answers;
     G.emit('rpc', name, answer) after each call, for any module that wants it.
   - Only server data is shown; no Telegram id is read. Every text goes in with textContent.
   - G.ladder = { open(), close(), load(fresh), refresh(fresh), data (the last normalised answer), text(D, short) (the line, '' when none),
     drawCrown(ctx, x, y, alpha, width), crownDrawn (a counter), crownAt / decoyAt ({x, y, w, h} on the screen: the last crown drawn over the
     hero / over his decoy) }. When a fresh hg_ladder answer names a new week, hg_profile_get is asked again (the champion changes). */
(function () {
  const G = window.G; if (!G || !G.on) return;
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const int = v => Math.round(num(v));
  const code = v => { const s = String(v == null ? '' : v).toUpperCase(); return /^[A-Z]{2}$/.test(s) ? s : ''; };
  const flag = c => (typeof G.flag === 'function' ? G.flag(c) : '') || '';
  const cname = c => (typeof G.countryName === 'function' && G.countryName(c)) || c || '—';
  const who = c => (flag(c) ? flag(c) + ' ' : '') + cname(c);
  const arr = v => Array.isArray(v) ? v : [];
  const fmt = v => int(v).toLocaleString('en-US');
  const fmtS = v => (Math.round(num(v) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
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
    '.lgBox{flex:1 1 auto;min-height:0;width:min(100%,640px);display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;grid-template-areas:"head" "mine" "list" "foot";gap:8px}',
    '.lgHead{grid-area:head;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px}',
    '.lgHead h2{margin:0;font:900 20px/1.2 Georgia,serif;letter-spacing:.08em;color:var(--gold,#e8b84a)}',
    '.lgEnds{font:700 13px/1.3 Georgia,serif;color:var(--ink,#f3e7c4);white-space:nowrap}.lgEnds:empty{display:none}',
    '.lgRule{flex:1 1 100%;font:13px/1.35 Georgia,serif;color:var(--muted,#8d9bb0)}',
    '.lgMine{grid-area:mine;border:2px solid var(--gold,#e8b84a);border-radius:12px;background:rgba(232,184,74,.1);padding:7px 10px;font:14px/1.35 Georgia,serif;color:#cfd6e2;text-align:center}.lgMine[hidden]{display:none}',
    '.lgBody{grid-area:list;min-height:64px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;border-radius:12px;display:flex;flex-direction:column;gap:6px}',
    '.lgFoot{grid-area:foot;display:flex;justify-content:center}',
    '.lgDuel{border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);overflow:hidden;flex:none}',
    '.lgDuel.mine{border-color:rgba(232,184,74,.6)}',
    '.lgRow{display:grid;grid-template-columns:34px 26px minmax(0,1fr) auto;grid-template-areas:"k fl nm sc" ". . ex ex";align-items:center;column-gap:6px;width:100%;min-height:48px;padding:5px 10px;border:0;background:transparent;color:var(--ink,#f3e7c4);font:14px/1.25 Georgia,serif;text-align:left;cursor:pointer;touch-action:pan-y}',
    '.lgRow .k{grid-area:k;font-weight:900;color:var(--muted,#8d9bb0)}.lgRow .fl{grid-area:fl;font-size:19px;line-height:1}',
    '.lgRow .nm{grid-area:nm;display:flex;flex-direction:column;min-width:0}.lgRow .n{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.lgRow .m{font-size:12px;color:var(--muted,#8d9bb0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.lgRow .sc{grid-area:sc;font:900 17px/1 Georgia,serif;color:var(--gold,#e8b84a);text-align:right;white-space:nowrap}',
    '.lgRow .ex{grid-area:ex;display:none;font-size:12px;line-height:1.35;color:#cfd6e2;padding-top:3px;white-space:normal}.lgRow.open .ex{display:block}',
    '.lgRow.me{background:rgba(232,184,74,.18)}.lgRow.me .n,.lgRow.me .k{color:var(--gold,#e8b84a)}',
    '.lgVs{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding:3px 10px;font:12px/1.3 Georgia,serif;color:#cfd6e2;border-top:1px dashed rgba(255,255,255,.1);border-bottom:1px dashed rgba(255,255,255,.1);text-align:center}',
    '.lgDuel>.lgVs:last-child{border-bottom:0}',
    '.lgVs .x{font:900 11px Georgia,serif;letter-spacing:.12em;color:#1c1207;background:var(--gold,#e8b84a);border-radius:6px;padding:1px 5px}',
    '.lgVs b{color:var(--ink,#f3e7c4)}.lgVs.rest{color:var(--muted,#8d9bb0);font-style:italic}',
    '.lgLast{flex:none;padding:6px 4px 2px;display:flex;flex-direction:column;gap:3px}',
    '.lgLastH{font:700 11px/1.2 Georgia,serif;letter-spacing:.14em;color:var(--muted,#8d9bb0);text-align:center}',
    '.lgLastR{font:13px/1.35 Georgia,serif;color:#cfd6e2;text-align:center}',
    '.lgNote{padding:18px 12px;text-align:center;font:15px/1.4 Georgia,serif;color:#cfd6e2;display:flex;flex-direction:column;align-items:center;gap:10px}',
    /* the title / end line: one statement, broken only between its parts */
    '.lgLine{font:13px/1.35 Georgia,serif;color:#cfd6e2;text-align:center;max-width:100%;text-wrap:balance}',
    '.lgLine .q{white-space:nowrap}.lgLine .a{color:var(--ink,#f3e7c4);font-weight:700}.lgLine .s{color:var(--gold,#e8b84a);font-weight:700}.lgLine .lgSh{display:none}',
    '.lgLine .l.up,.lgMine .l.up{color:#5be38a;font-weight:700}.lgLine .l.down,.lgMine .l.down{color:#ff8a7a;font-weight:700}.lgLine .l.tie,.lgMine .l.tie{color:var(--gold,#e8b84a);font-weight:700}',
    '.lgMine .q{white-space:nowrap}.lgMine{text-wrap:balance}.lgMine .a{color:var(--ink,#f3e7c4);font-weight:700}.lgMine .s{color:var(--gold,#e8b84a);font-weight:700}',
    '#lgFromBoard{order:3;margin-left:auto;width:auto;min-height:44px;padding:0 14px;font-size:14px;flex:none}',
    '@media (max-height:430px){.lgLine{font-size:12px;line-height:1.25}}',
    '@media (max-height:380px){.lgLine .lgF{display:none}.lgLine .lgSh{display:inline}}',   /* 640x360: the left column of the title is full */
    /* a short landscape window: the head, your duel and CLOSE on the left, the list on the right */
    '@media (orientation:landscape) and (max-height:540px){.lgBox{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"head list" "mine list" "foot list";gap:8px 16px;width:min(100%,860px)}',
    '.lgHead h2{font-size:18px}.lgRule{font-size:12px;line-height:1.3}.lgMine{font-size:13px;padding:5px 8px}.lgFoot{align-items:flex-end}.lgFoot .pri{width:100%}.lgRow{min-height:44px;padding:3px 8px}}'
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
    if (!fresh && cache && Date.now() - cache.at < TTL && !(cache.D.ends && Date.now() >= cache.D.ends)) return Promise.resolve(cache.D);
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

  /* ---- who leads a duel: the higher score; a tie keeps the higher place (the smaller pos) ---- */
  function lead(hi, lo) {   // hi = the upper of the pair {pos, score}, lo = the lower
    if (hi.score > lo.score) return { w: hi, tie: false };
    if (lo.score > hi.score) return { w: lo, tie: false };
    return { w: hi, tie: true };
  }

  /* ---- the line: [name #pos] · [this week vs opp (#n):] [a vs b] [— who leads]; null when there is no duel.
     parts(D, true): the short form for a window at most 380 px tall ("🇬🇪 #5 vs 🇹🇷 #4 · 120 vs 98 — you lead") ---- */
  function parts(D, short) {
    const m = D && D.mine; if (!m || !m.opp || m.side === 'rest' || m.opp_score == null) return null;
    const me = { pos: m.pos, score: m.score }, op = { pos: m.opp_pos, score: m.opp_score };
    const up = m.side === 'up' ? op : me, dn = up === me ? op : me, x = lead(up, dn), mineWins = x.w === me;
    const hold = Math.min(m.pos, m.opp_pos), they = short ? 'they' : cname(m.opp);
    const l = x.tie ? (mineWins ? '— tied, you hold #' + hold : '— tied, ' + they + (short ? ' hold #' : ' holds #') + hold) : (mineWins ? '— you lead' : '— ' + they + (short ? ' lead' : ' leads'));
    const sc = [fmtS(m.score) + ' vs ' + fmtS(m.opp_score), 's'], lc = [l, 'l ' + (x.tie ? 'tie' : mineWins ? 'up' : 'down')];
    if (short) return [[(flag(m.country) || m.country) + ' #' + m.pos + ' vs ' + (flag(m.opp) || m.opp) + ' #' + m.opp_pos, 'a'], [' · ', null], sc, [' ', null], lc];
    return [[who(m.country) + ' #' + m.pos, 'a'], [' · ', null], ['this week vs ' + who(m.opp) + ' (#' + m.opp_pos + '):', 'b'], [' ', null], sc, [' ', null], lc];
  }
  const text = (D, short) => { const p = parts(D, short); return p ? p.map(q => q[0]).join('') : ''; };
  function chunks(box, ps) { for (const [t, c] of ps) { if (c) box.appendChild(el('span', 'q ' + c, t)); else box.appendChild(document.createTextNode(t)); } }
  function fill(box, ps) { box.textContent = ''; chunks(box, ps); }
  /* a title / end line holds both forms; the CSS shows one */
  function fillLine(box, D) { box.textContent = ''; const f = el('span', 'lgF'), s = el('span', 'lgSh'); chunks(f, parts(D)); chunks(s, parts(D, true)); box.append(f, s); }

  /* ---- the title line (under the podium) ---- */
  const tEx = $('titleExtra');
  const tLine = el('div', 'lgLine'); tLine.id = 'lgTitle';
  const tHide = () => { tLine.textContent = ''; if (tLine.parentNode) tLine.parentNode.removeChild(tLine); };
  function tPlace() {
    if (!tEx) return; const pod = $('hgPod');
    if (pod && pod.parentNode === tEx) { if (pod.nextSibling !== tLine) tEx.insertBefore(tLine, pod.nextSibling); }
    else if (tLine.parentNode !== tEx) tEx.insertBefore(tLine, tEx.firstChild);
  }
  let tSeq = 0;
  async function titleLine(fresh) {
    const my = ++tSeq;
    if (!online()) { tHide(); return; }
    const D = await load(fresh);
    if (my !== tSeq) return;
    if (!online() || !parts(D)) { tHide(); return; }
    fillLine(tLine, D); tPlace();
  }
  /* the podium arrives later and puts itself first: keep the line right under it */
  if (tEx && window.MutationObserver) { try { new MutationObserver(() => { if (tLine.parentNode === tEx) { const pod = $('hgPod'); if (pod && pod.parentNode === tEx && pod.nextSibling !== tLine) tEx.insertBefore(tLine, pod.nextSibling); } }).observe(tEx, { childList: true }); } catch (e) {} }

  /* ---- the end line (after the round's submit has answered) ---- */
  const eLine = el('div', 'lgLine'); eLine.id = 'lgEnd';
  const eHide = () => { eLine.textContent = ''; if (eLine.parentNode) eLine.parentNode.removeChild(eLine); };
  let endSeq = 0, endWait = 0;
  async function endLine(my) {
    if (!online()) { eHide(); return; }
    const D = await load(true);
    if (my !== endSeq) return;
    if (!online() || !parts(D)) { eHide(); return; }
    fillLine(eLine, D);
    const ex = $('endExtra'); if (!ex) return;
    const after = $('hgEnd');
    if (after && after.parentNode === ex) ex.insertBefore(eLine, after.nextSibling); else if (eLine.parentNode !== ex) ex.appendChild(eLine);
  }
  G.on('start', () => { endSeq++; endWait = 0; eHide(); });
  G.on('end', () => { const my = ++endSeq; eHide(); endWait = my; if (!G.board) { endWait = 0; endLine(my); } });

  /* ---- watch the answers (the call and its answer pass through unchanged) ---- */
  function seen(name, args, r) {
    if (name === 'hg_profile_get') { if (r && typeof r === 'object' && !Array.isArray(r) && !r.error) setCrown(!!r.crown); }
    else if (name === 'hg_profile_set') { if (r && r.ok) drop(); }
    else if (name === 'hg_round_submit') { drop(); if (endWait && endWait === endSeq) { const my = endWait; endWait = 0; endLine(my); } }
  }
  if (G.net && typeof G.net.rpc === 'function' && !G.net.rpc.__lg) {
    const inner = G.net.rpc;
    const wrapped = async function (name, args) {
      const r = await inner.call(G.net, name, args);
      try { seen(name, args, r); } catch (e) { G.showErr && G.showErr('ladder: ' + (e && e.message || e)); }
      try { G.emit('rpc', name, r); } catch (e) {}
      return r;
    };
    wrapped.__lg = true; G.net.rpc = wrapped;
  }

  /* ---- the crown ---- */
  function setCrown(v) { if (!G.profile) return; G.profile.crown = !!v; }
  function recheck() { if (online()) G.net.rpc('hg_profile_get', { token: null }); }   // the answer goes through seen() and sets the crown
  let ownGet = false;
  G.on('net', on => {
    if (!on) { setCrown(false); tHide(); eHide(); drop(); if (scr.classList.contains('on')) render(); return; }
    if (!G.profileUI && !ownGet) { ownGet = true; G.net.rpc('hg_profile_get', { token: null }).then(() => { ownGet = false; }); }   // no profile module: ask ourselves
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
  const head = el('div', 'lgHead'); const h2 = el('h2', null, 'COUNTRY LADDER'); const ends = el('div', 'lgEnds'); ends.id = 'lgEnds';
  const rule = el('div', 'lgRule', 'Each week a country duels the one above or below it. Score: gold per active player. The winner takes the higher place; a tie keeps it.');
  head.append(h2, ends, rule);
  const mineEl = el('div', 'lgMine'); mineEl.id = 'lgMine'; mineEl.hidden = true;
  const body = el('div', 'lgBody'); body.id = 'lgBody';
  const foot = el('div', 'lgFoot'); const closeB = el('button', 'pri', 'CLOSE'); closeB.id = 'lgClose'; closeB.type = 'button'; foot.appendChild(closeB);
  box.append(head, mineEl, body, foot); scr.appendChild(box); document.body.appendChild(scr);
  closeB.addEventListener('click', () => close());
  const open1 = new Set();   // the countries opened by a tap (they stay open across a refresh)
  body.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.lgRow'); if (!b) return; const c = b.dataset.cc;
    if (open1.has(c)) open1.delete(c); else open1.add(c); detail(b); });

  let state = '';   // '' | 'loading' | 'error'
  const left = ms => { if (ms <= 0) return 'Ending now'; const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return 'Ends in ' + (d ? d + ' d ' + h + ' h' : h ? h + ' h ' + mm + ' m' : Math.max(1, mm) + ' m'); };
  function note(text, retry) {
    const n = el('div', 'lgNote'); n.appendChild(el('div', null, text));
    if (retry) { const b = el('button', 'sec', 'Try again'); b.type = 'button'; b.id = 'lgRetry'; b.addEventListener('click', () => { state = ''; open(true); }); n.appendChild(b); }
    body.appendChild(n);
  }
  function row(r) {
    const b = el('button', 'lgRow' + (r.country === myCC() ? ' me' : '')); b.type = 'button';
    b.dataset.cc = r.country; b.dataset.pos = r.pos;
    const nm = el('span', 'nm'); nm.append(el('span', 'n', (r.crown ? '👑 ' : '') + cname(r.country)), el('span', 'm', pl(r.real, 'player', 'players') + (r.bots ? ' + ' + pl(r.bots, 'bot', 'bots') : '')));
    b._r = r; b.append(el('span', 'k', '#' + r.pos), el('span', 'fl', flag(r.country)), nm, el('span', 'sc', fmtS(r.score)), el('span', 'ex'));
    detail(b); return b;
  }
  /* an opened country: its bots by name (only while it is open) and its rounds */
  function detail(b) {
    const r = b._r, on = open1.has(r.country), ex = b.querySelector('.ex');
    b.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on));
    if (!on) { ex.textContent = ''; return; }
    const nb = Math.min(r.bots, 20), bots = []; for (let i = 1; i <= nb; i++) bots.push('bot' + i);
    ex.textContent = (nb ? 'Bots: ' + bots.join(' · ') + ' (members that add no gold)' : 'No bots') + ' · ' + pl(r.real, 'active player', 'active players') + ' · ' + pl(r.rounds, 'round', 'rounds') + ' this week';
  }
  function vsLine(hi, lo) {
    const x = lead(hi, lo), v = el('div', 'lgVs');
    v.append(el('span', 'x', 'VS'), el('b', null, fmtS(hi.score) + ' vs ' + fmtS(lo.score)), document.createTextNode('·'),
      el('span', 'w', x.tie ? 'tied: ' + who(hi.country) + ' holds #' + hi.pos : who(x.w.country) + ' leads'));
    return v;
  }
  function render() {
    body.textContent = ''; mineEl.hidden = true; mineEl.textContent = ''; ends.textContent = '';
    if (!online()) {
      if (!hasTG()) note('Open HOLDOR in Telegram to see the ladder');
      else if (G.net && G.net.pending) note('Connecting…');
      else note('Could not reach the server.', true);
      return;
    }
    const D = cache && cache.D;
    if (!D) { if (state === 'error') note('Could not load the ladder.', true); else note('Loading…'); return; }
    if (D.ends) ends.textContent = left(D.ends - Date.now());
    // your country
    const cc = myCC(), m = D.mine, ps = parts(D);
    if (ps) { fill(mineEl, ps); mineEl.hidden = false; }
    else if (m && m.side === 'rest') { mineEl.textContent = who(m.country) + ' #' + m.pos + ' · rests this week'; mineEl.hidden = false; }
    else if (cc && !D.rows.some(r => r.country === cc)) { mineEl.textContent = 'Play a round to bring ' + who(cc) + ' onto the ladder'; mineEl.hidden = false; }
    // the duels, top to bottom
    const rows = D.rows;
    if (!rows.length) { note('No country is on the ladder yet. Play a round to put yours on it.'); return; }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], n = rows[i + 1], card = el('div', 'lgDuel');
      if (r.side === 'down' && n && n.country === r.opp && n.side === 'up') {
        card.dataset.pair = r.pos + '-' + n.pos; card.append(row(r), vsLine(r, n), row(n));
        if (r.country === cc || n.country === cc) card.classList.add('mine');
        i++;
      } else if (r.side === 'rest' || !r.opp || r.opp_score == null) {
        card.classList.add('rest'); card.dataset.pair = String(r.pos); card.append(row(r), el('div', 'lgVs rest', 'Rests this week'));
        if (r.country === cc) card.classList.add('mine');
      } else {   // a pair the list does not hold side by side: the vs line from this row's own numbers
        const o = { pos: r.side === 'up' ? r.pos - 1 : r.pos + 1, score: r.opp_score, country: r.opp }, me_ = { pos: r.pos, score: r.score, country: r.country };
        card.dataset.pair = String(r.pos); card.append(row(r), r.side === 'up' ? vsLine(o, me_) : vsLine(me_, o));
        if (r.country === cc) card.classList.add('mine');
      }
      body.appendChild(card);
    }
    if (D.last.length) {
      const lw = el('div', 'lgLast'); lw.id = 'lgLastWeek'; lw.appendChild(el('div', 'lgLastH', 'LAST WEEK'));
      for (const x of D.last) {
        const aw = x.winner !== x.b, ws = aw ? x.a_score : x.b_score, ls = aw ? x.b_score : x.a_score;
        const t = x.a_score === x.b_score && aw ? who(x.a) + ' held its place on a tie with ' + who(x.b) + ' · ' + fmtS(x.a_score) + ' vs ' + fmtS(x.b_score)
          : who(aw ? x.a : x.b) + ' beat ' + who(aw ? x.b : x.a) + (aw ? '' : ' and moved up') + ' · ' + fmtS(ws) + ' vs ' + fmtS(ls);
        lw.appendChild(el('div', 'lgLastR', t));
      }
      body.appendChild(lw);
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
      const D = cache && cache.D; if (D && D.ends && Date.now() >= D.ends) refreshScreen(true); else if (D && D.ends) ends.textContent = left(D.ends - Date.now()); }, 20000);
    if (!online() && hasTG() && G.net) { const p = G.net.login(true); render(); await p; }   // "Connecting…" while the login runs
    await refreshScreen(fresh === true || !cache || Date.now() - cache.at >= TTL);
  }
  function close() { scr.classList.remove('on'); clearInterval(tick); }

  /* ---- the buttons ---- */
  const tBtn = el('button', 'sec', 'Country ladder'); tBtn.id = 'lgBtn'; tBtn.type = 'button';
  const links = $('titleLinks'); if (links) links.appendChild(tBtn);
  tBtn.addEventListener('click', () => open());
  const bTop = document.querySelector('#hgBoard .hgBtop');
  if (bTop) { const bb = el('button', 'sec', 'Country ladder'); bb.id = 'lgFromBoard'; bb.type = 'button'; bTop.appendChild(bb); bb.addEventListener('click', () => open()); }

  G.on('title', () => titleLine());
  /* a new country changes `mine` on the server: ask again (the boot-time sync that keeps the same country asks nothing) */
  G.on('profile', () => {
    if (scr.classList.contains('on')) render();
    if (!online() || askedCC === myCC()) return;
    drop(); titleLine(true); if (scr.classList.contains('on')) refreshScreen(true);
  });

  const L = G.ladder = { open, close, load, refresh: fresh => titleLine(fresh), text, drawCrown, crownDrawn: 0, crownAt: null, decoyAt: null, data: null };
  if (online()) titleLine();
})();
