/* HOLDOR RPG — the pause menu + Telegram (A29).
   R.screens.menu: a sheet with big rows — RESUME, Skills, Heroes, Quests, Achievements, Hall of the Fallen, Leaderboard (when the
   screen exists), Chat, Settings (SFX, haptics, manual stat points → R.state.opts), Share the game (Telegram share
   link with the referral code), Account (house, the current hero, class, level, heroes fallen, best level; "Start over" needs two
   taps, wipes the whole account save 'holdor_rpg' and reloads).  Save v2 (Addendum 2): the account is R.state.acc, the hero R.state.p.
   Opens from the menu button (#menuBtn, data-btn="menu"), R.input.pressed('menu') and Esc; the game pauses while it is open (core).
   R.tg: Telegram.WebApp glue — ready/expand/disableVerticalSwipes/header colour on boot, BackButton while a screen is open,
   MainButton hidden, viewportChanged → R.resize(), startapp r_<code> → R.state.p.flags.refBy once.  Everything is guarded:
   without window.Telegram (a browser, the tests) the game runs the same.  R.haptic is reused when A02 defined it, else defined here. */
(function () {
  const tg = () => (window.Telegram && window.Telegram.WebApp) || null;
  const BOT_LINK = 'https://t.me/HoldorTDBot/play';
  const q = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* the account (save v2) and the hero's flags: p.flags may be core's alias of acc.world.flags, so it is never assigned over */
  const acc = () => (R.state && (R.state.acc || (typeof R.acc === 'function' && R.acc()))) || null;
  const flags = () => { if (!R.state || !R.state.p) return null; if (R.state.p.flags) return R.state.p.flags; const a = acc(); if (a) { a.world = a.world || {}; return a.world.flags = a.world.flags || {}; } return R.state.p.flags = {}; };
  const champName = id => { const c = id && R.data.champs && (R.data.champs[id] || (Array.isArray(R.data.champs) && R.data.champs.find(x => x.id === id))); return (c && (c.name || c.nm)) || cap(id || ''); };
  const heroName = p => (p && p.name) || champName(p && p.hero) || 'Nameless';
  const houseOf = p => (acc() && acc().house) || (p && p.house) || '';
  const bestLvl = p => { const a = acc() || {}; let b = (a.best && a.best.lvl) || 0; for (const h of a.hall || []) if (h && h.lvl > b) b = h.lvl; if (p && p.lvl > b) b = p.lvl; return b; };
  const playedAll = p => ((acc() && acc().hall) || []).reduce((n, h) => n + (h && h.played || 0), 0) + (p && p.played || 0);

  /* ---------- haptics (A02's R.haptic wins when it exists) ---------- */
  if (!R.haptic) {
    let lastT = 0;
    R.haptic = kind => { try {
      const o = R.state && R.state.opts; if (o && o.haptic === 0) return;
      const T = tg(), h = T && T.HapticFeedback; if (!h) return;
      const now = performance.now(); if (now - lastT < 60) return; lastT = now;
      if (kind === 'ok') h.notificationOccurred('success'); else if (kind === 'no' || kind === 'err') h.notificationOccurred('error'); else if (kind === 'warn') h.notificationOccurred('warning');
      else h.impactOccurred(kind === 'heavy' ? 'heavy' : kind === 'mid' || kind === 'medium' ? 'medium' : kind === 'soft' ? 'soft' : kind === 'rigid' ? 'rigid' : 'light');
    } catch (e) {} };
  }

  /* ---------- options: defaults filled in once the save exists ---------- */
  const DEF = { sfx: 1, haptic: 1, manualPts: 0, lang: 'en' };
  const opts = () => { if (!R.state) return Object.assign({}, DEF); const o = R.state.opts = R.state.opts || {}; for (const k in DEF) if (o[k] == null) o[k] = DEF[k]; return o; };
  const setOpt = (k, v) => { const o = opts(); if (!R.state) return o; o[k] = v; if (k === 'sfx' && R.sfx) { try { if (typeof R.sfx.mute === 'function') R.sfx.mute(!v); else R.sfx.muted = !v; } catch (e) {} } R.bus.emit('opts', o, k); R.save(); return o; };
  R.opts = { get: opts, set: setOpt };

  /* ---------- play time: seconds of unpaused game, counted here ---------- */
  R.bus.on('tick1s', () => { if (R.state && R.state.p && !R.paused) R.state.p.played = (R.state.p.played || 0) + 1; });
  const fmtPlayed = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + 'h ' + m + 'm' : m ? m + 'm' : '<1m'; };
  R.fmtPlayed = fmtPlayed;

  /* ---------- invite: the referral code and the Telegram share sheet ---------- */
  // never the Telegram id (the owner's rule: no Telegram ids in front of other players): a code the server gave (flags.ref) or none
  const refCode = () => { const f = flags(); if (f && f.ref) return String(f.ref); return null; };
  const inviteLink = () => { const c = refCode(); return BOT_LINK + (c ? '?startapp=r_' + encodeURIComponent(c) : ''); };
  const share = (link, text) => { const u = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text || ''); const T = tg();
    try { if (T && T.openTelegramLink) T.openTelegramLink(u); else window.open(u, '_blank'); } catch (e) {} return u; };
  R.invite = () => { const link = inviteLink(); R.haptic('ok'); share(link, 'Hold the door with me in HOLDOR'); return link; };

  /* ---------- the menu button over the canvas ---------- */
  const ICO = {
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    skills: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z"/></svg>',
    party: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 20c0-2.6 1.6-4.5 4-4.8"/></svg>',
    quests: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z M15 3v4h4 M9 12h6M9 16h6"/></svg>',
    ach: '<svg viewBox="0 0 24 24"><path d="M8 3h8v5a4 4 0 0 1-8 0z M8 5H4a3 3 0 0 0 3 4h1 M16 5h4a3 3 0 0 1-3 4h-1 M12 12v4 M8 21h8 M10 16h4v5"/></svg>',
    board: '<svg viewBox="0 0 24 24"><path d="M4 20h16 M6 20v-7h4v7 M10 20V5h4v15 M14 20v-10h4v10"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v10H10l-5 4V15H4z M8 10h8"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
    invite: '<svg viewBox="0 0 24 24"><circle cx="10" cy="8" r="3.2"/><path d="M4 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M18 6v6 M15 9h6"/></svg>',
    acc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7 M12 2.5v2"/></svg>',
    heroes: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z M12 7v8 M9 10h6"/></svg>',
    hall: '<svg viewBox="0 0 24 24"><path d="M5 21V9l7-5 7 5v12 M9 21v-6h6v6 M12 8v4 M10 10h4"/></svg>',
    fire: '<svg viewBox="0 0 24 24"><path d="M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-1.5.6-2.6 1.5-3.5.2 1.5 1 2.3 2 2.5C11 8 10.3 5.8 12 3z M6 20h12"/></svg>'
  };
  let btn = null;
  const syncBtn = () => { if (!btn) return; const show = !!(R.state && R.running && !R.ui.cur); btn.classList.toggle('off', !show); };
  const mountBtn = () => { const ui = document.getElementById('ui'); if (!ui || btn) return; if (document.getElementById('b-menu')) return;   // the input module's top-row MENU button (same spot) opens us through pressed('menu')
    btn = el('button', 'off', ICO.menu); btn.id = 'menuBtn'; btn.dataset.btn = 'menu'; btn.setAttribute('aria-label', 'Menu');
    btn.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); R.haptic('light'); R.ui.open('menu'); });
    ui.appendChild(btn); syncBtn(); };
  mountBtn(); R.bus.on('screen', syncBtn); R.bus.on('tick1s', syncBtn); setInterval(syncBtn, 700);

  /* Esc: closes any screen; opens the menu when none is open.  The input module's 'menu' button does the same. */
  const toggle = () => { if (R.ui.cur) R.ui.close(); else if (R.state) R.ui.open('menu'); };
  // one path only: the input module emits 'btn' 'menu' for its top-row button AND for Esc (polling pressed('menu') as well toggled twice:
  // the press survives a paused frame, so the menu reopened right after it closed). Without the input module, Esc is ours.
  R.bus.on('btn', n => { if (n === 'menu') toggle(); });
  if (!R.input) window.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.repeat) { e.preventDefault(); toggle(); } });
  // the UI keys / buttons nobody else answers: L → quest log, C → zone chat (toggles)
  const flip = name => { if (!R.screens[name]) return; if (R.ui.cur === name) R.ui.close(); else if (R.state && R.player) R.ui.open(name); };
  R.bus.on('btn', n => { if (n === 'quests') flip('quests'); else if (n === 'chat') flip('chat'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && R.state) { R.save(true); if (R.running && !R.ui.cur) R.ui.open('menu'); } });

  /* ---------- the screen ---------- */
  const tap = (node, fn) => { node.addEventListener('click', ev => { ev.preventDefault(); R.haptic('light'); if (R.sfx && R.sfx.play) { try { R.sfx.play('tap', .5); } catch (e) {} } fn(ev); }); return node; };
  const row = (ico, label, sub, fn, cls) => { const b = el('button', 'mn-row' + (cls ? ' ' + cls : ''), '<span class="ic">' + (ICO[ico] || '') + '</span><span class="lb">' + esc(label) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span><span class="ch">›</span>'); b.dataset.row = ico; if (fn) tap(b, fn); return b; };
  const sw = (key, label, sub) => { const o = opts(); const b = el('button', 'mn-row mn-sw' + (o[key] ? ' on' : ''), '<span class="lb">' + esc(label) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span><span class="st">' + (o[key] ? 'ON' : 'OFF') + '</span><span class="tg"></span>'); b.dataset.opt = key;
    tap(b, () => { const v = opts()[key] ? 0 : 1; setOpt(key, v); b.classList.toggle('on', !!v); q('.st', b).textContent = v ? 'ON' : 'OFF'; }); return b; };
  const goto = name => { if (R.screens[name]) R.ui.open(name); else R.ui.toast('Not here yet'); };
  const houseName = h => (R.data.houses && R.data.houses[h] && (R.data.houses[h].name || R.data.houses[h].nm)) || cap(h);
  const houseCol = h => (R.data.houses && R.data.houses[h] && (R.data.houses[h].col || R.data.houses[h].color)) || '';
  let page = 'root', armed = 0, armT = 0, root = null;

  const head = (title, back) => { const h = el('div'); if (back) { h.appendChild(tap(el('button', 'mn-back', 'Menu'), () => render('root'))); h.appendChild(el('div', 'mn-h', esc(title))); }
    else { const p = R.state && R.state.p || {}; const hd = el('div', 'mn-head'); hd.innerHTML = '<div><div class="mn-eye">Paused</div><div class="mn-who">' + esc(heroName(p)) + '<small>' + esc(houseName(houseOf(p))) + ' · ' + esc(cap(p.cls || '')) + ' · Lv ' + (p.lvl || 1) + '</small></div></div>';
      const x = el('button', 'mn-x', '✕'); x.dataset.act = 'close'; hd.appendChild(tap(x, () => R.ui.close())); h.appendChild(hd); } return h; };
  const foot = () => { const p = R.state && R.state.p || {}; return el('div', 'mn-foot', '<span>HOLDOR <b>v' + esc(R.VERSION) + '</b></span><span>played <b>' + fmtPlayed(playedAll(p)) + '</b></span>'); };

  const render = pg => { if (!root) return; page = pg; armed = 0; root.innerHTML = ''; root.style.setProperty('--acc', houseCol(houseOf(R.state && R.state.p)) || 'var(--gold)');
    if (pg === 'settings') return renderSettings(); if (pg === 'account') return renderAccount();
    root.appendChild(head());
    const pri = el('button', 'pri', 'RESUME'); pri.dataset.act = 'resume'; root.appendChild(tap(pri, () => R.ui.close()));
    const L = el('div', 'mn-list'); root.appendChild(L);
    const add = (ico, label, scr, sub) => { const b = row(ico, label, sub, () => goto(scr), R.screens[scr] ? '' : 'dim'); b.dataset.scr = scr; L.appendChild(b); };
    add('skills', 'Skills', 'skills'); add('heroes', 'Heroes', 'heroes'); add('quests', 'Quests', 'quests'); add('ach', 'Achievements', R.screens.achievements ? 'achievements' : 'ach');
    add('hall', 'Hall of the Fallen', 'hall', (acc() && acc().hall && acc().hall.length ? acc().hall.length + ' fallen' : null));
    if (R.screens.board) add('board', 'Leaderboard', 'board');
    add('chat', 'Chat', 'chat');
    L.appendChild(row('gear', 'Settings', null, () => render('settings')));
    L.appendChild(row('invite', 'Share the game', 'Send HOLDOR to a friend', () => R.invite()));   // no gift promise until the RPG has a server referral
    L.appendChild(row('acc', 'Account', null, () => render('account')));
    root.appendChild(foot()); };

  const renderSettings = () => { root.appendChild(head('Settings', true)); const L = el('div', 'mn-list'); root.appendChild(L);
    L.appendChild(sw('sfx', 'Sound', 'Hits, spells, the UI')); L.appendChild(sw('haptic', 'Haptics', 'The phone answers the hand'));
    L.appendChild(sw('manualPts', 'Manual stat points', 'You place the 3 points each level'));   // the key 21_player / 55_levelup read
    root.appendChild(foot()); };

  // a save already queued (debounced) or a module saving on 'wipe' must not write the old account back before the reload
  const rm = () => { try { localStorage.removeItem('holdor_rpg'); } catch (e) {} };
  const wipe = () => { rm(); R.stop(); R.bus.emit('wipe');
    // the server copy too: a fresh account goes up now (push() takes the state synchronously, keepalive survives the reload), so the next login does not bring the old one back
    try { const N = R.net; if (N && N.on && typeof N.save === 'function' && R.newState) { R.state = R.newState(); N.save(true); } } catch (e) {}
    R.save = () => false; R.state = null; rm(); setTimeout(rm, 0); setTimeout(rm, 1000); if (typeof R.reload === 'function') R.reload(); else location.reload(); };
  R.reload = R.reload || (() => location.reload());
  R.wipe = wipe;
  const renderAccount = () => { root.appendChild(head('Account', true)); const p = R.state && R.state.p || {}; const c = el('div', 'mn-card'); root.appendChild(c);
    const kv = (k, v) => c.appendChild(el('div', 'mn-kv', '<span>' + esc(k) + '</span><b>' + esc(v) + '</b>'));
    const a = acc() || {}; const fallen = (a.hall || []).length;
    kv('House', houseName(houseOf(p))); kv('Hero', heroName(p)); if (p.hero && champName(p.hero) !== heroName(p)) kv('Champion', champName(p.hero)); kv('Class', cap(p.cls || '')); kv('Level', p.lvl || 1);
    kv('Heroes fallen', fallen); kv('Best level', bestLvl(p)); if (a.best && a.best.kills) kv('Most kills', a.best.kills); if (a.title || p.title) kv('Title', a.title || p.title);
    kv('This hero since', p.created ? new Date(p.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'); kv('Played', fmtPlayed(playedAll(p)));
    const T = tg(), u = T && T.initDataUnsafe && T.initDataUnsafe.user; kv('Telegram', R.net && R.net.on && u ? (u.first_name || u.username || 'yes') : 'not linked');
    const code = refCode(); if (code) { const d = el('div', 'mn-kv', '<span>Invite code</span><b class="mn-code">' + esc(code) + '</b>'); c.appendChild(d); }
    root.appendChild(el('div', 'mn-note', 'Start over wipes the whole account on this device: every hero, the Hall of the Fallen, titles and the world you found. Two taps.'));
    const so = row('fire', 'Start over', 'Tap twice', null, 'danger'); so.dataset.act = 'startover';
    tap(so, () => { const now = performance.now(); if (!armed || now - armT > 4000) { armed = 1; armT = now; so.classList.add('armed'); q('.lb', so).innerHTML = 'Tap again to wipe everything<span class="sub">Nothing comes back</span>'; R.haptic('warn');
        setTimeout(() => { if (armed && performance.now() - armT >= 4000) { armed = 0; so.classList.remove('armed'); q('.lb', so).innerHTML = 'Start over<span class="sub">Tap twice</span>'; } }, 4100); return; }
      armed = 0; R.haptic('heavy'); wipe(); });
    root.appendChild(so); root.appendChild(foot()); };

  R.screens.menu = { open(arg, screenEl) { root = el('div', 'mn'); root.id = 'menu'; (screenEl || document.getElementById('screen')).appendChild(root); R.save(); render(arg && R.screens.menu.pages.includes(arg) ? arg : 'root'); },
    close() { root = null; page = 'root'; armed = 0; }, pages: ['root', 'settings', 'account'], get page() { return page; }, render: pg => render(pg) };

  /* ---------- Telegram ---------- */
  const T0 = tg();
  R.tg = { on: !!T0, app: T0, user: (T0 && T0.initDataUnsafe && T0.initDataUnsafe.user) || null, startParam: null, share, inviteLink, refCode,
    call(name, ...a) { const T = tg(); try { if (T && typeof T[name] === 'function') return T[name](...a); } catch (e) {} } };
  const startParam = () => { const T = tg(); let sp = T && T.initDataUnsafe && T.initDataUnsafe.start_param;
    if (!sp) { try { const u = new URLSearchParams(location.search); sp = u.get('startapp') || u.get('tgWebAppStartParam') || ''; } catch (e) {} }
    return sp ? String(sp) : ''; };
  R.tg.startParam = startParam();
  let spDone = false;
  const applyStart = () => { if (spDone || !R.state || !R.state.p) return; const sp = R.tg.startParam; spDone = true; if (!sp) return; const m = /^r_([A-Za-z0-9_-]{1,64})$/.exec(sp); if (!m) return;
    const f = flags(); if (!f || f.refBy || (f.ref && f.ref === m[1]) || (R.tg.user && String(R.tg.user.id) === m[1])) return; f.refBy = m[1]; f.refByT = Date.now(); R.bus.emit('refBy', m[1]); R.save(); };
  R.tg.applyStart = () => { spDone = false; applyStart(); };
  applyStart(); R.bus.on('tick1s', applyStart); R.bus.on('save', applyStart); R.bus.on('screen', applyStart);

  if (T0) {
    R.tg.call('ready'); R.tg.call('expand'); R.tg.call('disableVerticalSwipes'); R.tg.call('setHeaderColor', '#060b14'); R.tg.call('setBackgroundColor', '#060b14');
    try { if (T0.MainButton && T0.MainButton.hide) T0.MainButton.hide(); } catch (e) {}
    try { const BB = T0.BackButton; if (BB) { if (BB.onClick) BB.onClick(() => { R.haptic('light'); R.ui.close(); }); const NOBACK = { intro: 1, death: 1 };   // screens that must be answered, not closed (the title / house pick, the fallen hero)
        const sync = () => { try { if (R.ui.cur && !NOBACK[R.ui.cur]) BB.show(); else BB.hide(); } catch (e) {} }; R.bus.on('screen', sync); sync(); } } catch (e) {}
    try { if (T0.onEvent) { T0.onEvent('viewportChanged', () => { try { R.resize(); } catch (e) {} }); T0.onEvent('themeChanged', () => R.tg.call('setHeaderColor', '#060b14')); } } catch (e) {}
  }
})();
