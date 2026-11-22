/* HOLDOR RPG — net (A35). Supabase over fetch: Telegram login → session token → save/load, a one-time wallet import,
   a presence poll, the zone chat and the boards. Guests (no Telegram initData) keep everything local: every call
   resolves at once and nothing is sent. No call ever throws into the game: failures land in R.net.err / R.net.errs,
   retries back off, three failures in a row switch R.net.on off for 60 s, then R.net.resume() tries again.

   RPC contract (backend/holdor_v40.sql, agent A36); the first argument is always the session token from `tg_login`:
     tg_login(init_data text)                                    → {token, tg_id, name, save, save_ver}   (the old client's login)
     rpg_load(token, seat)                                       → {state jsonb|null, wallet:{gold, gems, champs:{id:lvl}}}
     rpg_save(token, seat, state jsonb)                          → {ok}
     rpg_presence(token, seat, x int, y int, zone, lvl int, house, name) → {players:[{name,house,lvl,x,y,zone,at}]}
     rpg_chat_send(token, seat, zone, body)                      → {ok, id}
     rpg_chat_list(token, seat, zone, since bigint = last id seen) → {msgs:[{id,name,house,body,at}]}
     rpg_board(token, kind 'lvl'|'best'|'kills'|'bosses'|'fallen') → {rows:[{name,house,lvl,v}]}

   Save shape v2 (ARCH Addendum 2): R.state.acc = the account (house, champs, hall, world), R.state.p = the current hero.
   The wallet import gives the CURRENT hero the old gold/gems and unlocks the old champions as heroes in acc.champs.
   Hooks for the others: R.net.ready (a promise: the first login attempt is over, true = logged in), R.net.others (the
   last presence list), R.net.chat.msgs / .unread / .open, events 'net'(on), 'load'(state), 'wallet'({gold,gems,champs}),
   'presence'(list), 'chat'(newMsgs, allMsgs), 'netsave'(r). Boot code may `await R.net.ready` before choosing intro/start. */
(function () {
  const SB = { url: 'https://acimxvnupgpronpohheb.supabase.co', key: 'sb_publishable_IdiZ6FC3GwAEZ8AkBeBg0g_doDtulMB' };
  const N = R.net = {
    SB, on: false, token: null, seat: 0, tgId: null, name: null, guest: false, tried: false, pulled: false,
    others: [], othersAt: 0, zone: '', err: null, errs: [], fails: 0, offUntil: 0, dirty: false, busy: false, savedAt: 0, saves: 0, calls: 0, wal: null, imported: null,
    cfg: { saveMs: 5000, presMs: 10000, chatMs: 6000, chatIdleMs: 30000, timeout: 9000, offMs: 60000, boardMs: 60000, maxErrs: 20 }
  };
  let readyRes; N.ready = new Promise(r => { readyRes = r; });
  const P = v => Promise.resolve(v);
  const sbOk = () => /^https:\/\/|^http:\/\/127\.0\.0\.1/.test(N.SB.url) && N.SB.key.length > 20;
  const tg = () => (window.Telegram && window.Telegram.WebApp) || null;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const log = (...a) => { try { console.warn('[net]', ...a); } catch (e) {} };
  const emit = (...a) => { try { R.bus.emit(...a); } catch (e) {} };
  const store = st => { try { localStorage.setItem('holdor_rpg', JSON.stringify(st)); } catch (e) {} };

  /* ---- transport ---- */
  async function post(name, params, opt) {            // raw POST to PostgREST, like the old client's sbRpc; throws
    opt = opt || {}; const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), opt.timeout || N.cfg.timeout);
    try {
      N.calls++;
      const r = await fetch(N.SB.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: N.SB.key, Authorization: 'Bearer ' + N.SB.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}), signal: ctl.signal, keepalive: !!opt.keepalive });
      const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
      if (!r.ok) throw new Error((j && (j.message || j.hint || j.error)) || ('http ' + r.status));
      return j;
    } finally { clearTimeout(to); }
  }
  function fail(name, e) {
    const msg = String((e && e.message) || e); N.err = msg; N.errs.push({ name, msg, at: Date.now() }); if (N.errs.length > N.cfg.maxErrs) N.errs.shift(); N.fails++; log(name, msg);
    if (/bad session/.test(msg)) { N.token = null; N.on = false; N.tried = false; loginP = null; N.offUntil = Date.now() + 5000; setTimeout(() => N.login(), 5000); emit('net', false); }
    else if (N.fails >= 3 && N.on) { N.on = false; N.offUntil = Date.now() + N.cfg.offMs; setTimeout(() => N.resume(), N.cfg.offMs); emit('net', false); }
  }
  N.resume = () => { N.offUntil = 0; N.fails = 0; if (!N.token) { N.tried = false; loginP = null; return N.login(); } if (!N.on) { N.on = true; emit('net', true); } retryWait = 5000; if (N.dirty) N.save(true); return P(true); };   // back on: the dirty state goes out at once
  /* R.net.rpc(name, params, opt): resolves the result, or null on any failure (R.net.err has the text); opt.throw → rejects instead.
     Offline (guest or after three failures) it resolves null without touching the network. */
  N.rpc = async (name, params, opt) => {
    opt = opt || {};
    if (!N.on && name !== 'tg_login') { if (opt.throw) throw new Error('offline'); return null; }
    try { const r = await post(name, params, opt); N.fails = 0; N.err = null; return r; }
    catch (e) { fail(name, e); if (opt.throw) throw e; return null; }
  };

  /* ---- login ---- */
  let loginP = null, loginWait = 5000;
  N.login = () => {
    if (loginP) return loginP;
    loginP = (async () => {
      const T = tg(), init = T && T.initData;
      if (!init || !sbOk()) { N.guest = true; N.on = false; return false; }
      N.guest = false; N.tried = true;
      let r = null; try { r = await post('tg_login', { init_data: init }, { timeout: 8000 }); } catch (e) { fail('tg_login', e); }
      if (!r || !r.token) { loginP = null; setTimeout(() => N.login(), loginWait); loginWait = Math.min(60000, loginWait * 2); return false; }
      N.token = r.token; N.tgId = r.tg_id == null ? null : r.tg_id; N.name = r.name || null; N.seat = 0; N.on = true; N.fails = 0; N.err = null; N.offUntil = 0; loginWait = 5000;
      emit('net', true);
      try { await N.load(); } catch (e) { log('load', e); }
      try { await N.wallet.import(); } catch (e) { log('wallet', e); }
      startPolls();
      return true;
    })().catch(e => { log('login', e); return false; }).then(v => { readyRes(v); return v; });
    return loginP;
  };

  /* ---- save / load ---- */
  let sig = '', saveT = 0, retryWait = 5000;
  const hash = st => { let s; try { s = JSON.stringify(st, (k, v) => k === 'saved' ? undefined : v); } catch (e) { return 'x' + Math.random(); } let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return s.length + ':' + (h >>> 0); };
  const mark = () => { if (!R.state) return false; const h = hash(R.state); if (h === sig) return N.dirty; sig = h; R.state.saved = Date.now(); N.dirty = true; return true; };  // only a real change bumps the stamp
  const fresh = st => { if (!st || !st.p) return true; const a = st.acc || {}, w = a.world || {};   // an untouched new save: level 1, nothing played, no world progress, no fallen heroes
    return (st.p.played || 0) < 30 && (st.p.lvl || 1) <= 1 && !(st.p.xp > 0) && !Object.keys(w.quests || st.p.quests || {}).length && !((w.found || st.p.found || []).length) && !((a.hall || []).length); };
  N.load = async () => {
    if (!N.on) return null;
    if (!R.state && R.load) { try { R.load(); } catch (e) {} }
    const r = await N.rpc('rpg_load', { token: N.token, seat: N.seat }); if (!r) return null;
    if (r.wallet) N.wal = r.wallet;
    const srv = r.state && r.state.p ? r.state : null, loc = R.state && R.state.p ? R.state : null;
    if (srv && (!loc || (srv.saved || 0) > (loc.saved || 0) || (fresh(loc) && !fresh(srv)))) {   // the server is newer (or local is an untouched new save): take it
      store(srv); let ok = false; if (typeof R.load === 'function') { try { ok = R.load(JSON.parse(JSON.stringify(srv))); } catch (e) { ok = false; } }   // core migrates + fills + installs the p.* aliases, emits 'load'
      if (!ok) { R.state = srv; emit('load', srv); }
      N.pulled = true; N.dirty = false; sig = hash(R.state); emit('netload', R.state);                                                   // the boot re-routes (world / heroes / intro)
    } else if (loc && (!srv || (loc.saved || 0) > (srv.saved || 0))) {                           // local is newer: push it
      sig = ''; mark(); await push(false);
    } else if (loc) sig = hash(loc);
    return r;
  };
  async function push(keep) {
    if (!N.on || !N.dirty || !R.state || N.busy) return false;
    N.busy = true; N.dirty = false;
    const st = R.state; st.saved = Date.now(); sig = hash(st);
    let len = 0; try { len = JSON.stringify(st).length; } catch (e) {}
    const r = await N.rpc('rpg_save', { token: N.token, seat: N.seat, state: st }, { keepalive: !!keep && len < 60000, timeout: keep ? 5000 : N.cfg.timeout });
    N.busy = false;
    if (r && r.ok !== false) {
      N.savedAt = Date.now(); N.saves++; retryWait = 5000; if (R.state === st) store(st); emit('netsave', r);
      if (N.dirty && N.on && !saveT) saveT = setTimeout(() => { saveT = 0; push(false); }, N.cfg.saveMs);
      return true;
    }
    N.dirty = true;
    if (N.on && !saveT) { saveT = setTimeout(() => { saveT = 0; push(false); }, retryWait); retryWait = Math.min(60000, retryWait * 2); }
    return false;
  }
  /* R.net.save(now): debounced 5 s (now = true flushes at once); idempotent — nothing is sent when the state did not change */
  N.save = now => {
    if (!R.state) return P(false);
    mark();
    if (!N.on || !N.dirty) return P(false);
    if (now) { if (saveT) { clearTimeout(saveT); saveT = 0; } return push(true); }
    if (!saveT) saveT = setTimeout(() => { saveT = 0; push(false); }, N.cfg.saveMs);
    return P(true);
  };
  R.bus.on('save', () => { if (!R.state) return; mark(); if (N.on) { N.save(); if (N.wal && R.state.wallet && !R.state.wallet.imported) N.wallet.import(); } });
  const flush = () => { if (N.on) N.save(true); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  /* ---- the old wallet rides over once ---- */
  let importing = false;
  N.wallet = { import: async () => {
    if (!N.on || !R.state || !R.state.p || !R.state.p.hero || R.state.p.dead || importing) return false;   // only into a living hero (the intro's blank hero waits)
    const w = R.state.wallet = R.state.wallet || { imported: false };
    if (w.imported) return false;
    importing = true;
    try {
      let wal = N.wal;
      if (!wal) { const r = await N.rpc('rpg_load', { token: N.token, seat: N.seat }); wal = (r && r.wallet) || null; N.wal = wal; }
      if (!wal || !R.state || R.state.wallet !== w || w.imported) return false;
      const champs = Object.assign({}, wal.champs || {});
      if (wal.levels) for (const k in wal.levels) if (k.slice(0, 2) === 'c:' && champs[k.slice(2)] == null) champs[k.slice(2)] = wal.levels[k];   // the old econ_state shape, if the server sends it
      const gold = Math.max(0, Math.floor(+wal.gold || 0)), gems = Math.max(0, Math.floor(+wal.gems || 0));
      const p = R.state.p; let n = 0;                                   // gold / gems → the CURRENT hero
      const acc = (R.acc && R.acc()) || (R.state.acc = R.state.acc || {}); acc.champs = acc.champs || {};   // the old champions → unlocked heroes
      for (const id in champs) {
        if (!id || clamp(Math.floor(+champs[id] || 1), 1, 60) < 1) continue;
        if (acc.champs[id] && acc.champs[id].unlocked) continue;
        if (R.heroes && R.heroes.unlock) { try { R.heroes.unlock(id, 'import'); } catch (e) {} }
        if (!acc.champs[id] || !acc.champs[id].unlocked) acc.champs[id] = Object.assign(acc.champs[id] || {}, { unlocked: 1, runs: (acc.champs[id] && acc.champs[id].runs) || 0 });
        n++;
      }
      p.gold = (p.gold || 0) + gold; p.gems = (p.gems || 0) + gems;
      Object.assign(w, { imported: true, gold0: gold, gems0: gems, champs0: n, at: Date.now() });
      N.imported = { gold, gems, champs: n };
      if (gold || gems || n) { try { R.ui && R.ui.toast && R.ui.toast('Your gold, dragonglass and ' + n + ' champion' + (n === 1 ? '' : 's') + ' rode with you', '#e3b661'); } catch (e) {} }
      emit('wallet', N.imported);
      store(R.state);
      await N.save(true);
      return true;
    } finally { importing = false; }
  } };

  /* ---- presence ---- */
  const zoneOf = (x, y) => { try { if (R.world && R.world.regionAt) { const g = R.world.regionAt(x, y); if (g) return typeof g === 'string' ? g : (g.id || g.name || ''); } } catch (e) {} return ''; };
  N.presence = async () => {
    if (!N.on || !R.state || !R.state.p) return N.others;
    const p = R.state.p, e = R.player || p.pos || { x: 0, y: 0 }, x = Math.round(e.x || 0), y = Math.round(e.y || 0);
    N.zone = zoneOf(x, y) || N.zone || '';
    const acc = R.state.acc || {};                                       // the account's house, the hero's name
    const r = await N.rpc('rpg_presence', { token: N.token, seat: N.seat, x, y, zone: N.zone, lvl: Math.max(1, p.lvl | 0), house: acc.house || p.house || 'stark', name: String(p.name || N.name || 'Defender').slice(0, 24) });
    if (r && Array.isArray(r.players)) { N.others = r.players; N.othersAt = Date.now(); emit('presence', N.others); }
    return N.others;
  };

  /* ---- zone chat ---- */
  const C = N.chat = { zone: '', since: 0, msgs: [], open: false, unread: 0,
    send: async txt => {
      txt = String(txt || '').replace(/\s+/g, ' ').trim().slice(0, 200); if (!txt || !N.on) return false;
      const r = await N.rpc('rpg_chat_send', { token: N.token, seat: N.seat, zone: C.zone || N.zone || '', body: txt });
      if (r && r.ok !== false) { C.list(); return true; } return false;
    },
    list: async () => {
      if (!N.on) return C.msgs;
      const z = N.zone || ''; if (z !== C.zone) { C.zone = z; C.since = 0; C.msgs = []; C.unread = 0; }   /* a new zone, a new chat */
      const r = await N.rpc('rpg_chat_list', { token: N.token, seat: N.seat, zone: C.zone, since: C.since });
      if (r && Array.isArray(r.msgs) && r.msgs.length) {
        const seen = new Set(C.msgs.map(m => m.id)), add = r.msgs.filter(m => !seen.has(m.id));
        for (const m of add) { C.msgs.push(m); if (+m.id > C.since) C.since = +m.id; }
        if (C.msgs.length > 200) C.msgs.splice(0, C.msgs.length - 200);
        if (add.length) { if (!C.open) C.unread += add.length; emit('chat', add, C.msgs); }
      }
      return C.msgs;
    } };
  R.bus.on('screen', name => { C.open = name === 'chat'; if (C.open) { C.unread = 0; if (N.on) C.list(); } });

  /* ---- boards ---- */
  const boards = {};
  N.board = async kind => {
    kind = kind || 'lvl'; const b = boards[kind];
    if (b && Date.now() - b.at < N.cfg.boardMs) return b.r;
    if (!N.on) return (b && b.r) || { rows: [] };
    const r = await N.rpc('rpg_board', { token: N.token, kind });
    if (r && Array.isArray(r.rows)) { boards[kind] = { r, at: Date.now() }; return r; }
    return (b && b.r) || { rows: [] };
  };

  /* ---- polls: presence every 10 s while the game runs, chat every 6 s with the chat open / 30 s otherwise ---- */
  let pollT = 0, presAcc = 0, chatAcc = 0;
  N.tick = ms => {
    ms = ms || 1000; if (!N.on || document.hidden) return; presAcc += ms; chatAcc += ms;
    if (R.running && presAcc >= N.cfg.presMs) { presAcc = 0; N.presence(); }
    if (chatAcc >= (C.open ? N.cfg.chatMs : N.cfg.chatIdleMs)) { chatAcc = 0; C.list(); }
  };
  function startPolls() { if (pollT) return; presAcc = N.cfg.presMs; chatAcc = N.cfg.chatIdleMs; pollT = setInterval(() => { try { N.tick(1000); } catch (e) { log('tick', e); } }, 1000); }

  if (document.readyState === 'complete') setTimeout(() => N.login(), 0); else window.addEventListener('load', () => N.login());
})();
