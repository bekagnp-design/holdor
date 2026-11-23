/* Heavy Gold — chat (35_chat.js): the world chat and the player's own country chat (src/gold/GOLD.md, Wave 5).
   - Buttons: a 💬 "Chat" icon button (.ib), the first link in #titleLinks, and during a round a round 44 px button in #hudExtra on the right, under the live board
     (#hTR; clear of the clock, the board, the skill button, the minimap and the day chip at 390×844, 844×390 and 640×360).
     A red dot on both when a channel has a message from someone else newer than the last one this player saw.
   - The panel (GOLD.md "UI rules": icons and 1–3 words): two tabs, 🌍 World and the player's country (flag + name); each message
     shows the flag, the name (👑 for last week's champion), the text and a short time (HH:MM today, "21 Nov" before); an input
     ("Message", 200 characters at most) with ➤ (send, the screen's one primary button) and a 1–3 word line for each error
     ('rate' → "Too fast", 'too_long' → "Too long", 'auth' → "Not signed in", no network → "Offline").
     · On the title (no round): a full screen (.scr, z 20).
     · During a round the game keeps running, so the panel docks: a bottom sheet (42 % of the height, left of the skill button) in
       portrait, a side panel (≤ 40 % of the width, above the skill button) on the right in landscape. The hero at the centre, the
       skill button and the free side stay uncovered, so the drag-anywhere joystick still works there. The round's end closes it.
       Landscape with the keyboard up (≤ 300 px tall): while typing, the panel drops its tabs and ✕ so the input and SEND show.
   - Server (G.net.rpc): hg_chat_list(token, channel, since) every 3 s for the open tab (the first call of each open, and one every
     30 s after it, is since 0: a refresh that drops what the server now hides, e.g. a message reported 3 times; otherwise since =
     the highest id seen), the other tab every 20 s; while closed and online, both channels every 20 s (every 60 s during a round)
     (since-based) for the unread dot. An answer of a full page (50) after since may have skipped older messages, so it replaces
     what is stored instead of being joined onto it (no silent gap). hg_chat_send(token, channel, body).
     channel = 'world' or 'c:XX' (XX = G.profile.country).
   - A long press (or the ⋯ on a message from someone else) offers Report (hg_chat_report(token, id): hidden for this player at once)
     and Block (hg_chat_block(token, name): that name's messages go).
   - Offline (no Telegram): "Open in Telegram", nothing is sent and the round has no chat button.
   - Every user text (names, bodies) goes into the page with textContent; this file never uses innerHTML. Only id, name, country,
     body, at, mine and crown are read from a message (never a Telegram id).
   - localStorage: 'hg_chat_seen' {channel: last seen id}, 'hg_chat_hidden' [ids this player reported].
   - G.chat = { open(tab), close(), toggle(), poll(), tab, isOpen, mode ('full' | 'dock'), channel(tab), msgs(channel), unread(channel),
     seen, OPEN_MS (3000), CLOSED_MS (20000), FIRST_MS (3000: the first closed poll after coming online), FULL_MS (30000: the open tab's
     refresh from since 0) }. Tests may shorten the *_MS. */
(function () {
  const G = window.G; if (!G || !G.on) return;
  const MAXLEN = 200, KEEP = 200, PAGE = 50, LONG_MS = 550, SEEN_K = 'hg_chat_seen', HIDE_K = 'hg_chat_hidden';
  const ERR = {
    rate: 'Too fast',
    too_long: 'Too long',
    empty: 'Empty',
    no_profile: 'No profile',
    bad_channel: 'Not your country',
    auth: 'Not signed in',
    net: 'Offline'
  };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---- helpers ---- */
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const code = v => { const s = String(v == null ? '' : v).toUpperCase(); return /^[A-Z]{2}$/.test(s) ? s : ''; };
  const flag = c => (c && typeof G.flag === 'function' ? G.flag(c) : '') || '';
  const cname = c => (c && typeof G.countryName === 'function' && G.countryName(c)) || c || '';
  const online = () => !!(G.net && G.net.on);
  const hasTG = () => { try { return !!(G.TG && typeof G.TG.initData === 'string' && G.TG.initData.length); } catch (e) { return false; } };
  const myCountry = () => code(G.profile && G.profile.country);
  const inRound = () => { const h = G.$('hud'); return !!(G.S && !G.S.over && h && h.classList.contains('on')); };
  const clen = s => [...s].length;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  function when(at) {
    let ms = NaN;
    if (typeof at === 'number') ms = at < 1e11 ? at * 1000 : at;
    else if (typeof at === 'string' && /^\d+$/.test(at)) { const n = +at; ms = n < 1e11 ? n * 1000 : n; }
    else if (at) ms = Date.parse(String(at));
    if (!isFinite(ms)) return '';
    const d = new Date(ms), n = new Date(), p = v => String(v).padStart(2, '0');
    return d.toDateString() === n.toDateString() ? p(d.getHours()) + ':' + p(d.getMinutes()) : d.getDate() + ' ' + MON[d.getMonth()];
  }
  /* only these keys are ever read from a server message */
  const clean = m => {
    if (!m || typeof m !== 'object') return null; const id = Number(m.id); if (!isFinite(id) || id <= 0) return null;
    return { id, name: String(m.name == null ? '' : m.name), country: code(m.country), body: String(m.body == null ? '' : m.body), at: m.at, mine: !!m.mine, crown: !!m.crown };
  };

  /* ---- state ---- */
  const C = G.chat = { OPEN_MS: 3000, CLOSED_MS: 20000, FIRST_MS: 3000, FULL_MS: 30000 };
  const store = {};             // channel → { msgs, since, loaded, err, busy, ver, fullAt }
  const st = ch => store[ch] || (store[ch] = { msgs: [], since: 0, loaded: false, err: null, busy: null, ver: 0 });
  const seen0 = load(SEEN_K, {}), seen = seen0 && typeof seen0 === 'object' && !Array.isArray(seen0) ? seen0 : {};
  const hid0 = load(HIDE_K, []), hidden = new Set((Array.isArray(hid0) ? hid0 : []).map(Number).filter(isFinite));
  let tab = 'world', isOpen = false, mode = 'full', sending = false, fullNext = {}, lastOther = 0;
  const chan = t => t === 'world' ? 'world' : (myCountry() ? 'c:' + myCountry() : '');
  const shown = s => s.msgs.filter(m => !hidden.has(m.id));
  const unread = ch => { if (!ch || !store[ch]) return false; const sn = +seen[ch] || 0; return store[ch].msgs.some(m => m.id > sn && !m.mine && !hidden.has(m.id)); };
  /* stored messages with id >= from are replaced by the list (from = 0: replace everything; Infinity: merge) */
  function add(ch, list, from = Infinity) {
    const s = st(ch), by = new Map(s.msgs.filter(m => m.id < from).map(m => [m.id, m]));
    for (const m of list) by.set(m.id, m);
    const next = [...by.values()].sort((a, b) => a.id - b.id).slice(-KEEP);
    const same = next.length === s.msgs.length && next.every((m, i) => m.id === s.msgs[i].id && m.crown === s.msgs[i].crown);
    s.msgs = next; if (!same) s.ver++;
  }
  /* one list call per channel at a time; full = since 0 (a refresh that also drops messages the server now hides);
     keepOld (the periodic refresh while open): older stored messages the newest page no longer reaches stay for scrolling back */
  async function fetchCh(ch, full, keepOld) {
    const s = st(ch);
    if (s.busy) { const r = await s.busy; if (!full) return r; }
    const p = (async () => {
      const prev = s.since;
      const r = await G.net.rpc('hg_chat_list', { token: null, channel: ch, since: full ? 0 : prev });
      if (r == null || typeof r !== 'object') { s.err = 'net'; return { ok: false }; }
      if (!Array.isArray(r) && r.error) { s.err = String(r.error); return { ok: false }; }
      const list = (Array.isArray(r) ? r : Array.isArray(r.msgs) ? r.msgs : []).map(clean).filter(Boolean);
      s.err = null; s.loaded = true;
      const before = s.ver;
      /* what the answer covers: a short page everything after since; a full page (the newest 50) only the ids from its oldest up.
         A periodic refresh that reaches back to what is stored keeps the older stored messages; any other full page replaces them. */
      const lo = list.reduce((a, m) => Math.min(a, m.id), Infinity);
      const from = list.length < PAGE ? (full ? 0 : Infinity) : (full && keepOld && lo <= prev ? lo : 0);
      if (full || list.length) add(ch, list, from);
      if (full) s.fullAt = Date.now();
      for (const m of list) if (m.id > s.since) s.since = m.id;
      return { ok: true, changed: s.ver !== before };
    })().catch(() => ({ ok: false })).then(v => { if (s.busy === p) s.busy = null; return v; });
    s.busy = p; return p;
  }
  function markSeen(ch) {
    if (!ch || !store[ch]) return; const s = store[ch];
    const mx = s.since;   // the highest id the server has listed (your own messages never count as unread)
    if (mx > (+seen[ch] || 0)) { seen[ch] = mx; keep(SEEN_K, seen); }
    paintDots();
  }

  /* ---- the poll loop: every 3 s while open, every 20 s while closed (only when online and the page is visible) ---- */
  let loopT = 0, gen = 0;
  function kick(ms) { clearTimeout(loopT); const g = ++gen; loopT = setTimeout(() => tick(g), Math.max(0, ms | 0)); }
  async function tick(g) {
    try {
      if (online() && !document.hidden) {
        if (isOpen) {
          const ch = chan(tab);
          if (ch) { const fresh = !!fullNext[ch], full = fresh || Date.now() - (st(ch).fullAt || 0) >= C.FULL_MS; const r = await fetchCh(ch, full, !fresh); if (r && r.ok && full) fullNext[ch] = false; }
          if (isOpen) render();
          const oc = chan(tab === 'world' ? 'country' : 'world');
          if (oc && Date.now() - lastOther >= C.CLOSED_MS) { lastOther = Date.now(); await fetchCh(oc, false); paintDots(); }
        } else {
          lastOther = Date.now();
          await fetchCh('world', false); const cc = chan('country'); if (cc) await fetchCh(cc, false);
          paintDots();
        }
      }
    } catch (e) {}
    if (g === gen) kick(isOpen ? C.OPEN_MS : (inRound() ? 3 : 1) * C.CLOSED_MS);
  }

  /* ---- styles ---- */
  const css = document.createElement('style');
  css.textContent = [
    '#hgChat.full{background:var(--bg,#070c16);z-index:20}',
    '.hgCh{flex:1 1 auto;min-height:0;width:min(100%,640px);display:flex;flex-direction:column;gap:8px;position:relative}',
    '.hgChBar{display:grid;grid-template-columns:minmax(0,1fr) 44px;grid-template-areas:"h x" "tabs tabs";gap:8px;align-items:center}',
    '.hgChBar h2{grid-area:h;margin:0;font:900 20px/1.2 Georgia,serif;letter-spacing:.08em;color:var(--gold,#e8b84a)}',
    '.hgChTabs{grid-area:tabs;display:flex;min-width:0;border:2px solid rgba(255,255,255,.18);border-radius:12px;overflow:hidden}.hgChTabs[hidden]{display:none}',
    '.hgChTab{flex:1 1 0;min-width:0;min-height:44px;border:0;background:transparent;color:var(--ink,#f3e7c4);font:700 14px Georgia,serif;letter-spacing:.06em;cursor:pointer;padding:0 8px;display:flex;align-items:center;justify-content:center;gap:6px}',
    '.hgChTab+.hgChTab{border-left:2px solid rgba(255,255,255,.12)}.hgChTab.on{background:rgba(232,184,74,.22);color:var(--gold,#e8b84a)}',
    '.hgChTab .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.hgChTab .f{font-size:17px;line-height:1;flex:none;letter-spacing:0}',
    '.hgChX{grid-area:x;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.22);background:transparent;color:var(--ink,#f3e7c4);font:700 18px/1 Georgia,serif;cursor:pointer;padding:0}',
    '.hgChWrap{position:relative;flex:1 1 auto;min-height:0;display:flex}',
    '.hgChList{flex:1 1 auto;min-height:60px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;border-radius:12px;background:rgba(255,255,255,.03);padding:2px 0}',
    '.hgCm{display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:start;min-height:44px;padding:4px 0 4px 10px;border-bottom:1px solid rgba(255,255,255,.05);-webkit-touch-callout:none}',
    '.hgCm.me{grid-template-columns:minmax(0,1fr);padding-right:10px;background:rgba(232,184,74,.07)}',
    '.hgCmc{min-width:0;padding:2px 0;font:14px/1.35 Georgia,serif;color:#e9eef5;overflow-wrap:anywhere;word-break:break-word}',
    '.hgCmh{display:flex;align-items:baseline;gap:5px;min-width:0;white-space:nowrap;font-size:13px}',
    '.hgCmh .f{font-size:15px;flex:none}.hgCmh .n{font-weight:700;color:var(--ink,#f3e7c4);overflow:hidden;text-overflow:ellipsis;min-width:0}.hgCmh .cr{flex:none}',
    '.hgCmh .t{font-size:11px;color:var(--muted,#8d9bb0);flex:none}.hgCm.me .hgCmh .n{color:var(--gold,#e8b84a)}',
    '.hgCmb{display:block;white-space:pre-wrap}',
    '.hgCmo{width:44px;height:44px;margin:-4px 0;border:0;background:transparent;color:var(--muted,#8d9bb0);font:900 18px/1 Georgia,serif;cursor:pointer;padding:0}',
    '.hgChNote{padding:18px 12px;text-align:center;font:15px/1.4 Georgia,serif;color:#cfd6e2;display:flex;flex-direction:column;align-items:center;gap:10px}',
    '.hgChNew{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);min-height:44px;padding:0 16px;border-radius:22px;border:2px solid var(--gold,#e8b84a);background:#141a22;color:var(--gold,#e8b84a);font:700 13px Georgia,serif;cursor:pointer;white-space:nowrap}.hgChNew[hidden]{display:none}',
    '.hgChMsg{font:13px/1.3 Georgia,serif;color:var(--muted,#8d9bb0);min-height:17px;text-align:center}.hgChMsg.bad{color:#ff8a7a;font-weight:700}.hgChMsg.good{color:#9fe0a8}',
    '.hgChForm{display:flex;gap:8px;align-items:stretch;margin:0}.hgChForm[hidden]{display:none}',
    '.hgChIn{flex:1 1 auto;min-width:0;min-height:44px;border-radius:12px;border:2px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:var(--ink,#f3e7c4);font:16px Georgia,serif;padding:0 12px;outline:none;user-select:text;-webkit-user-select:text;touch-action:manipulation}',
    '.hgChIn:focus{border-color:var(--gold,#e8b84a)}.hgChIn::placeholder{color:#6f7d92}',
    '.hgChForm .pri{width:auto;min-width:56px;min-height:44px;flex:none;padding:0 14px;font-size:20px;letter-spacing:0;box-shadow:none}.hgChForm .pri:disabled{opacity:.6}',
    '.hgChMenu{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#0a0f1a;border-radius:12px;padding:8px}.hgChMenu[hidden]{display:none}',
    '.hgChMenu .q{font:14px/1.35 Georgia,serif;color:#cfd6e2;text-align:center;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere;word-break:break-word}',
    '.hgChActs{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:min(100%,420px)}.hgChActs .sec{flex:1 1 120px;width:auto;min-height:44px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 10px}',
    '.hgDot{position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;background:#ff6a5a;border:2px solid #070c16;pointer-events:none;box-sizing:border-box}.hgDot[hidden]{display:none}',
    '.hgChTab .hgDot{position:static;width:9px;height:9px;border:0;flex:none}',
    '#hgChatBtn{position:relative}#hgChatBtn .hgDot{top:3px;right:3px}',
    '#hgChatHud{position:absolute;right:calc(10px + env(safe-area-inset-right));top:calc(108px + env(safe-area-inset-top));width:44px;height:44px;border-radius:50%;border:2px solid rgba(232,184,74,.75);background:rgba(7,12,22,.72);color:var(--gold,#e8b84a);display:none;place-items:center;pointer-events:auto;cursor:pointer;padding:0;touch-action:manipulation;box-shadow:0 2px 8px rgba(0,0,0,.45)}',
    '#hgChatHud.on{display:grid}#hgChatHud svg{display:block}',
    /* docked during a round: the game keeps running around it */
    '#hgChat.dock{inset:auto;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));top:auto;height:min(42%,420px);padding:8px;z-index:6;gap:0;overflow:hidden;background:#0a0f1a;border:1px solid rgba(232,184,74,.45);border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.55)}',
    '#hgChat.dock>.hgCh{margin:0;width:100%;gap:6px}',
    '#hgChat.dock .hgChBar{grid-template-areas:"tabs x"}#hgChat.dock .hgChBar h2{display:none}',
    '#hgChat.dock .hgChMsg:empty{display:none}#hgChat.dock .hgChList{min-height:40px}',
    '#hgChat.dock .hgCmh{display:inline-flex;margin-right:6px;vertical-align:baseline;max-width:100%}#hgChat.dock .hgCmb{display:inline}',
    '#hgChat.dock .hgChNote{padding:10px 8px;font-size:14px;gap:6px}',
    '#hgChat.dock .hgChTab{padding:0 6px;gap:4px;letter-spacing:.03em}#hgChat.dock .hgChForm .pri{padding:0 10px}#hgChat.dock #hgChTabW{flex:0 1 auto;padding:0 12px}',
    /* portrait: the sheet stops left of the skill button (#sk: 88 px, 18 px from the right edge) */
    '@media (orientation:portrait){#hgChat.dock{right:calc(116px + env(safe-area-inset-right))}}',
    '@media (orientation:landscape){#hgChat.dock{left:auto;top:calc(6px + env(safe-area-inset-top));bottom:calc(122px + env(safe-area-inset-bottom));width:min(40%,360px);height:auto}}',
    /* landscape with the soft keyboard up (the WebView shrinks to the space above it): typing, the panel takes the full height and
       drops the tabs and ✕, so the list, the input and SEND stay visible; they come back when the keyboard goes */
    '@media (orientation:landscape) and (max-height:300px){#hgChat.dock.typing{bottom:calc(6px + env(safe-area-inset-bottom))}#hgChat.dock.typing .hgChBar{display:none}#hgChat.dock.typing .hgChList{min-height:0}}',
    '@media (orientation:landscape) and (max-height:540px){#hgChat.full .hgChBar{grid-template-columns:auto minmax(0,1fr) 44px;grid-template-areas:"h tabs x"}#hgChat.full .hgChBar h2{font-size:18px}#hgChat.full .hgChNote{padding:10px 12px}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---- the panel ---- */
  const scr = el('div', 'scr'); scr.id = 'hgChat'; scr.setAttribute('role', 'dialog'); scr.setAttribute('aria-label', 'Chat');
  const box = el('div', 'hgCh');
  const bar = el('div', 'hgChBar'); const h2 = el('h2', null, 'CHAT');
  const tabsEl = el('div', 'hgChTabs'); tabsEl.id = 'hgChTabs'; tabsEl.setAttribute('role', 'tablist');
  const mkTab = (t, id) => { const b = el('button', 'hgChTab'); b.type = 'button'; b.id = id; b.dataset.tab = t; b.setAttribute('role', 'tab'); return b; };
  const tW = mkTab('world', 'hgChTabW'), tC = mkTab('country', 'hgChTabC');
  const wDot = el('i', 'hgDot'), cDot = el('i', 'hgDot'); wDot.hidden = cDot.hidden = true;
  tW.append(el('span', 'f', '🌍'), el('span', 'n', 'World'), wDot);
  const tCf = el('span', 'f'), tCn = el('span', 'n'); tC.append(tCf, tCn, cDot);
  tabsEl.append(tW, tC);
  const xB = el('button', 'hgChX', '✕'); xB.type = 'button'; xB.id = 'hgChX'; xB.setAttribute('aria-label', 'Close');
  bar.append(h2, tabsEl, xB);
  const wrap = el('div', 'hgChWrap');
  const list = el('div', 'hgChList'); list.id = 'hgChList'; list.setAttribute('aria-live', 'polite');
  const pill = el('button', 'hgChNew', '↓ New'); pill.type = 'button'; pill.id = 'hgChNew'; pill.hidden = true;
  wrap.append(list, pill);
  const msgEl = el('div', 'hgChMsg'); msgEl.id = 'hgChMsg'; msgEl.setAttribute('role', 'status');
  const form = el('form', 'hgChForm'); form.id = 'hgChForm'; form.setAttribute('autocomplete', 'off');
  const input = el('input', 'hgChIn'); input.id = 'hgChIn'; input.type = 'text'; input.setAttribute('enterkeyhint', 'send'); input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'on'); input.setAttribute('aria-label', 'Message'); input.maxLength = MAXLEN * 2;   // the 200-character rule counts code points (below)
  const sendB = el('button', 'pri', '➤'); sendB.type = 'submit'; sendB.id = 'hgChSend'; sendB.setAttribute('aria-label', 'Send');
  form.append(input, sendB);
  const menu = el('div', 'hgChMenu'); menu.id = 'hgChMenu'; menu.hidden = true;
  const mq = el('div', 'q'); const acts = el('div', 'hgChActs');
  const repB = el('button', 'sec', '⚑ Report'); repB.type = 'button'; repB.id = 'hgChReport';
  const blkB = el('button', 'sec', '⛔ Block'); blkB.type = 'button'; blkB.id = 'hgChBlock';
  const canB = el('button', 'sec', 'Cancel'); canB.type = 'button'; canB.id = 'hgChCancel';
  acts.append(repB, blkB, canB); menu.append(mq, acts);
  box.append(bar, wrap, msgEl, form, menu); scr.appendChild(box); document.body.appendChild(scr);

  /* the core's keys (space / J = skill, WASD) must not see what is typed here; Escape closes */
  input.addEventListener('focus', () => scr.classList.add('typing'));
  input.addEventListener('blur', () => scr.classList.remove('typing'));
  for (const t of ['keydown', 'keyup', 'keypress']) input.addEventListener(t, e => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') { if (!menu.hidden) closeMenu(); else close(); } });
  window.addEventListener('keydown', e => { if (isOpen && e.key === 'Escape') { if (!menu.hidden) closeMenu(); else close(); } });

  /* ---- buttons outside the panel ---- */
  const tBtn = el('button', 'ib'); tBtn.id = 'hgChatBtn'; tBtn.type = 'button';
  const tDot = el('b', 'hgDot'); tDot.hidden = true; tBtn.append(el('i', null, '💬'), el('span', null, 'Chat'), tDot);
  const links = G.$('titleLinks'); if (links) links.insertBefore(tBtn, links.firstChild);   // first: its dot must be on screen (landscape)
  tBtn.addEventListener('click', () => open());
  const hb = el('button'); hb.id = 'hgChatHud'; hb.type = 'button'; hb.setAttribute('aria-label', 'Chat');
  { const NS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(NS, 'svg'); sv.setAttribute('viewBox', '0 0 24 24'); sv.setAttribute('width', '22'); sv.setAttribute('height', '22'); sv.setAttribute('aria-hidden', 'true');
    const pa = document.createElementNS(NS, 'path'); pa.setAttribute('d', 'M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.8V16.5h-1A1.5 1.5 0 0 1 3 15V6a1.5 1.5 0 0 1 1.5-1.5z');
    pa.setAttribute('fill', 'none'); pa.setAttribute('stroke', 'currentColor'); pa.setAttribute('stroke-width', '2'); pa.setAttribute('stroke-linejoin', 'round'); sv.appendChild(pa);
    for (const x of [8, 12, 16]) { const ci = document.createElementNS(NS, 'circle'); ci.setAttribute('cx', String(x)); ci.setAttribute('cy', '10.5'); ci.setAttribute('r', '1.4'); ci.setAttribute('fill', 'currentColor'); sv.appendChild(ci); }
    hb.appendChild(sv); }
  const hDot = el('i', 'hgDot'); hDot.hidden = true; hb.appendChild(hDot);
  hb.addEventListener('pointerdown', e => e.stopPropagation());
  hb.addEventListener('click', () => { try { hb.blur(); } catch (e) {} if (isOpen) close(); else open(); });
  const hx = G.$('hudExtra'); if (hx) hx.appendChild(hb);
  const paintHud = () => { hb.classList.toggle('on', hasTG()); };
  /* right under the live board (#hTR), never down onto the skill button */
  let hbTop = -1;
  function placeHud() {
    const tr = G.$('hTR'), sk = G.$('sk'); if (!tr || !tr.offsetHeight) return;
    let t = tr.offsetTop + tr.offsetHeight + 10;
    if (sk && sk.offsetHeight) { const skTop = sk.getBoundingClientRect().top; t = Math.min(t, Math.round(skTop) - 52); }
    t = Math.max(0, Math.round(t)); if (t !== hbTop) { hbTop = t; hb.style.top = t + 'px'; }
  }

  /* ---- painting ---- */
  function paintDots() {
    const cc = chan('country'), uw = unread('world'), uc = cc ? unread(cc) : false;
    const any = isOpen ? (tab === 'world' ? uc : uw) : (uw || uc);
    tDot.hidden = !any; hDot.hidden = !any;
    wDot.hidden = !(isOpen && tab !== 'world' && uw); cDot.hidden = !(isOpen && tab !== 'country' && uc);
    tBtn.setAttribute('aria-label', any ? 'Chat, new messages' : 'Chat');
  }
  function paintTabs() {
    const c = myCountry();
    tCf.textContent = c ? flag(c) : '🏳'; tCn.textContent = c ? cname(c) : 'Country';
    tW.classList.toggle('on', tab === 'world'); tC.classList.toggle('on', tab === 'country');
    tW.setAttribute('aria-selected', String(tab === 'world')); tC.setAttribute('aria-selected', String(tab === 'country'));
    input.placeholder = 'Message';
  }
  /* the line under the list: kind 'bad' (an error, the default), 'good' (done) or 'soft' (a hint) */
  function msg(codeOrNull, text, kind) {
    const t = text != null ? text : (codeOrNull ? (ERR[codeOrNull] || 'Not sent') : ''), k = t ? (kind || 'bad') : '';
    msgEl.textContent = t; msgEl.classList.toggle('bad', k === 'bad'); msgEl.classList.toggle('good', k === 'good'); msgEl.dataset.code = codeOrNull || '';
  }
  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 12;
  function note(text, retry, pick) {
    list.textContent = ''; pill.hidden = true;
    const n = el('div', 'hgChNote'); n.id = 'hgChNote'; n.appendChild(el('div', null, text));
    if (retry) { const b = el('button', 'sec', '↻ Retry'); b.type = 'button'; b.id = 'hgChRetry'; b.addEventListener('click', retry); n.appendChild(b); }
    if (pick) { const b = el('button', 'sec', 'Profile'); b.type = 'button'; b.id = 'hgChPick'; b.addEventListener('click', () => { close(); if (G.profileUI && G.profileUI.open) G.profileUI.open(false); }); n.appendChild(b); }
    list.appendChild(n);
  }
  function row(m) {
    const r = el('div', 'hgCm' + (m.mine ? ' me' : '')); r.dataset.id = String(m.id);
    const c = el('div', 'hgCmc'), h = el('span', 'hgCmh');
    const f = flag(m.country); if (f) h.appendChild(el('span', 'f', f));
    h.appendChild(el('span', 'n', m.name || '—'));
    if (m.crown) { const cr = el('span', 'cr', '👑'); cr.title = "Last week's champion"; h.appendChild(cr); }
    const t = when(m.at); if (t) h.appendChild(el('span', 't', t));
    c.append(h, el('span', 'hgCmb', m.body)); r.appendChild(c);
    if (!m.mine) { const o = el('button', 'hgCmo', '⋯'); o.type = 'button'; o.setAttribute('aria-label', 'Report or block'); r.appendChild(o); }
    return r;
  }
  let shownKey = '', shownCh = '';
  function paintList() {
    const ch = chan(tab), s = st(ch), key = ch + '#' + s.ver + '#' + hidden.size;
    if (key === shownKey) return;
    const first = ch !== shownCh || !list.querySelector('.hgCm'), atB = first || nearBottom(), top = list.scrollTop;
    const lastShown = +((list.querySelector('.hgCm:last-child') || {}).dataset || {}).id || 0;
    list.textContent = '';
    const ms = shown(s);
    if (!ms.length) note('No messages yet');
    else { const fr = document.createDocumentFragment(); for (const m of ms) fr.appendChild(row(m)); list.appendChild(fr); }
    shownKey = key; shownCh = ch;
    if (atB) { list.scrollTop = list.scrollHeight; pill.hidden = true; if (isOpen && !document.hidden) markSeen(ch); }
    else { list.scrollTop = top; if (ms.some(m => m.id > lastShown && !m.mine)) pill.hidden = false; }
  }
  function render() {
    paintTabs();
    if (!isOpen) { paintDots(); return; }
    scr.classList.toggle('dock', mode === 'dock'); scr.classList.toggle('full', mode === 'full');
    const ch = chan(tab); let txt = null, retry = null, pick = false, showForm = true, showTabs = true;
    if (!hasTG()) { txt = 'Open in Telegram'; showForm = false; showTabs = false; }
    else if (!online()) {
      showForm = false; showTabs = false;
      if (G.net && G.net.pending) txt = 'Connecting…';
      else { txt = 'Offline'; retry = () => { if (G.net) { const p = G.net.login(true); render(); p.then(() => { render(); kick(0); }); } }; }
    }
    else if (!ch) { txt = 'No country yet'; pick = mode === 'full'; showForm = false; }
    else {
      const s = st(ch);
      if (s.err === 'bad_channel') { txt = 'Not your country'; showForm = false; }
      else if (!s.loaded) { if (s.err) { txt = 'Not loaded'; retry = () => { fullNext[ch] = true; s.err = null; render(); kick(0); }; } else txt = 'Loading…'; }
    }
    tabsEl.hidden = !showTabs; form.hidden = !showForm;
    if (txt) { note(txt, retry, pick); shownKey = ''; shownCh = ''; }
    else paintList();
    paintDots();
  }

  /* ---- open / close / tabs ---- */
  function open(t) {
    if (t === 'world' || t === 'country') tab = t;
    if (tab === 'country' && !myCountry() && t !== 'country') tab = 'world';
    isOpen = true; mode = inRound() ? 'dock' : 'full'; fullNext = {}; fullNext.world = true; const cc = chan('country'); if (cc) fullNext[cc] = true;
    closeMenu(); msg(null); shownKey = ''; shownCh = '';
    scr.classList.add('on'); render();
    if (!online() && hasTG() && G.net && !G.net.pending) { const p = G.net.login(true); render(); p.then(() => { if (isOpen) render(); kick(0); }); }
    kick(0);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; closeMenu(); try { input.blur(); } catch (e) {}
    scr.classList.remove('on', 'dock', 'full'); msg(null); paintDots();
    kick(C.CLOSED_MS);
  }
  function setTab(t) { if (t === tab) return; tab = t; closeMenu(); msg(null); shownKey = ''; render(); kick(0); }
  tW.addEventListener('click', () => setTab('world'));
  tC.addEventListener('click', () => setTab('country'));
  xB.addEventListener('click', close);
  pill.addEventListener('click', () => { list.scrollTop = list.scrollHeight; pill.hidden = true; markSeen(chan(tab)); });
  list.addEventListener('scroll', () => { if (isOpen && nearBottom() && list.querySelector('.hgCm')) { pill.hidden = true; markSeen(chan(tab)); } }, { passive: true });

  /* ---- sending ---- */
  input.addEventListener('input', () => {
    const v = input.value; if (clen(v) > MAXLEN) input.value = [...v].slice(0, MAXLEN).join('');
    const left = MAXLEN - clen(input.value);
    if (left <= 20) msg(null, left + ' left', 'soft');
    else if (msgEl.textContent && !sending) msg(null);
  });
  for (const ev of ['pointerdown', 'mousedown']) sendB.addEventListener(ev, e => e.preventDefault());   // keep the keyboard up
  form.addEventListener('submit', e => { e.preventDefault(); send(); });
  async function send() {
    if (sending) return;
    const ch = chan(tab); if (!ch) return;
    const body = input.value.trim();
    if (!body) { msg('empty'); return; }
    if (clen(body) > MAXLEN) { msg('too_long'); return; }
    if (!online()) { msg('net'); return; }
    sending = true; sendB.disabled = true;
    let r = null; try { r = await G.net.rpc('hg_chat_send', { token: null, channel: ch, body }); } catch (e) { r = null; }
    sending = false; sendB.disabled = false;
    if (r && typeof r === 'object' && r.ok) {
      if (input.value.trim() === body) input.value = '';
      msg(null);
      const m = clean(r.msg); if (m) { m.mine = true; add(ch, [m]); }
      if (isOpen && chan(tab) === ch) { shownKey = ''; render(); list.scrollTop = list.scrollHeight; pill.hidden = true; markSeen(ch); }
      kick(400);
    } else msg(r && typeof r === 'object' && r.error ? String(r.error)
      : (G.net && (!G.net.on || /session|^auth$/i.test(String(G.net.err || ''))) ? 'auth' : 'net'));   // 10_net logs in again once on 'auth'; null after that = still not signed in
  }

  /* ---- report / block: the ⋯ on a message or a long press ---- */
  let menuMsg = null, lp = null;
  function openMenu(id) {
    const ch = chan(tab), m = ch && st(ch).msgs.find(x => x.id === id);
    if (!m || m.mine) return;
    menuMsg = m;
    const f = flag(m.country); mq.textContent = (f ? f + ' ' : '') + (m.name || '—') + ': ' + m.body;
    menu.hidden = false;
  }
  function closeMenu() { menu.hidden = true; menuMsg = null; }
  canB.addEventListener('click', closeMenu);
  repB.addEventListener('click', async () => {
    const m = menuMsg; if (!m) return; closeMenu();
    const r = online() ? await G.net.rpc('hg_chat_report', { token: null, id: m.id }) : null;
    if (r && typeof r === 'object' && r.ok) {
      hidden.add(m.id); keep(HIDE_K, [...hidden].slice(-300)); shownKey = ''; render(); msg(null, '⚑ Reported', 'good');
    } else msg(null, r && r.error ? 'Not reported' : 'Offline');
  });
  blkB.addEventListener('click', async () => {
    const m = menuMsg; if (!m) return; closeMenu();
    const r = online() ? await G.net.rpc('hg_chat_block', { token: null, name: m.name }) : null;
    if (r && typeof r === 'object' && r.ok) {
      const lo = m.name.toLowerCase();
      for (const k in store) { const s = store[k], n = s.msgs.length; s.msgs = s.msgs.filter(x => x.mine || x.name.toLowerCase() !== lo); if (s.msgs.length !== n) s.ver++; }
      shownKey = ''; render(); msg(null, '⛔ Blocked', 'good');
    } else msg(null, r && r.error ? 'Not blocked' : 'Offline');
  });
  list.addEventListener('click', e => { const o = e.target.closest && e.target.closest('.hgCmo'); if (o && o.parentNode) openMenu(+o.parentNode.dataset.id); });
  const lpStop = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  list.addEventListener('pointerdown', e => {
    const r = e.target.closest && e.target.closest('.hgCm'); lpStop();
    if (!r || r.classList.contains('me') || (e.target.closest && e.target.closest('.hgCmo'))) return;
    const id = +r.dataset.id; lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; openMenu(id); }, LONG_MS) };
  });
  list.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) lpStop(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) list.addEventListener(ev, lpStop);
  list.addEventListener('contextmenu', e => { const r = e.target.closest && e.target.closest('.hgCm'); if (!r) return; e.preventDefault(); lpStop(); if (!r.classList.contains('me')) openMenu(+r.dataset.id); });

  /* ---- the game's events ---- */
  G.on('start', () => { paintHud(); hbTop = -1; if (isOpen && mode === 'full') { mode = 'dock'; shownKey = ''; render(); } });
  G.on('end', () => { if (isOpen && mode === 'dock') close(); });
  G.on('hud', placeHud);
  G.on('title', () => { paintTabs(); paintDots(); if (!isOpen && online() && Date.now() - lastOther >= C.CLOSED_MS) kick(0); });   // back from a round's slower polling
  G.on('net', on => { paintHud(); if (isOpen) { render(); if (on) kick(0); } else if (on) kick(C.FIRST_MS); });
  G.on('profile', () => {
    const cc = chan('country'); if (cc && !(cc in fullNext) && isOpen) fullNext[cc] = true;
    if (isOpen) { shownKey = ''; render(); kick(0); } else paintTabs();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && online()) kick(isOpen ? 0 : 1000); });

  Object.assign(C, {
    open, close, toggle: () => (isOpen ? close() : open()), poll: () => kick(0), render,
    channel: t => chan(t || tab), msgs: ch => (store[ch || chan(tab)] ? shown(store[ch || chan(tab)]).map(m => Object.assign({}, m)) : []),
    unread: ch => (ch ? unread(ch) : unread('world') || unread(chan('country'))), seen
  });
  Object.defineProperties(C, { tab: { get: () => tab, enumerable: true }, isOpen: { get: () => isOpen, enumerable: true }, mode: { get: () => mode, enumerable: true } });
  paintHud(); paintTabs(); paintDots();
  if (online()) kick(C.FIRST_MS);
})();
