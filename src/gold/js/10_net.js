/* Heavy Gold — net (10_net.js). Supabase over fetch: Telegram login → a session token → the hg_* RPCs (src/gold/GOLD.md).
   G.net = { on, token, pending, err, ready, login(), rpc(name, args) }
   - On load (after every module has loaded), when G.TG && G.TG.initData: tg_login(init_data) once. The token is kept in
     sessionStorage ('hg_token', tied to this initData), so a reload in the same Telegram launch reuses it without a new login.
     Without Telegram, or when the login fails, the game stays offline and nothing is sent.
   - login(): resolves true when online. It tries again only when asked (a user action), at most once per 20 s after a failure.
   - rpc(name, args, opt): resolves the server's JSON, or null when offline or on any error (G.net.err has the text); it never throws.
     An 8 s timeout per call (opt.timeout in ms overrides it). A call made while the login is in flight waits for it. A null `token` in args is filled with the
     session token. A dead session ('bad session', or the hg_* answer {error:'auth'}) logs in again once and repeats the call once.
   - G.emit('net', on) whenever the online state changes (on = true / false). */
(function () {
  const URL_ = 'https://acimxvnupgpronpohheb.supabase.co', KEY = 'sb_publishable_IdiZ6FC3GwAEZ8AkBeBg0g_doDtulMB';
  const TK = 'hg_token', TIMEOUT = 8000, RETRY_MS = 20000;
  const N = G.net = { on: false, token: null, pending: false, err: null, calls: 0, url: URL_, key: KEY };
  let emitted = false, loginP = null, lastFail = 0, readyRes = null;
  N.ready = new Promise(r => { readyRes = r; });

  const init = () => { try { const T = G.TG; return T && typeof T.initData === 'string' && T.initData.length > 0 ? T.initData : ''; } catch (e) { return ''; } };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };
  const setOn = v => { N.on = !!v; if (N.on !== emitted) { emitted = N.on; try { G.emit('net', N.on); } catch (e) {} } };
  const keep = t => { try { if (t) sessionStorage.setItem(TK, JSON.stringify({ h: hash(init()), t })); else sessionStorage.removeItem(TK); } catch (e) {} };
  const kept = () => { try { const o = JSON.parse(sessionStorage.getItem(TK) || 'null'); return o && o.t && o.h === hash(init()) ? String(o.t) : null; } catch (e) { return null; } };
  const dead = m => /^auth$|bad[ _]?session|no[ _]?session|bad[ _]?token|invalid[ _]?token|session (expired|not found)/i.test(String(m || ''));

  /* one POST, 8 s for the whole exchange; resolves {v} or {e} (never rejects) */
  async function post(name, args, ms) {
    let to = 0; const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = new Promise((_, rej) => { to = setTimeout(() => { rej(new Error('timeout')); try { if (ctl) ctl.abort(); } catch (e) {} }, ms || TIMEOUT); });
    try {
      N.calls++;
      const r = await Promise.race([fetch(URL_ + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(args || {}), signal: ctl ? ctl.signal : undefined }), timer]);
      const txt = await Promise.race([r.text(), timer]);
      let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
      if (!r.ok) return { e: (j && (j.message || j.hint || j.code || j.error)) || ('http ' + r.status) };
      return { v: j };
    } catch (e) { return { e: String((e && e.message) || e || 'network') }; }
    finally { clearTimeout(to); }
  }

  N.login = (force) => {
    if (N.on && N.token) return Promise.resolve(true);
    if (loginP) return loginP;
    const id = init();
    if (!id) return Promise.resolve(false);
    if (!force && lastFail && Date.now() - lastFail < RETRY_MS) return Promise.resolve(false);
    N.pending = true;
    loginP = (async () => {
      const x = await post('tg_login', { init_data: id });
      const r = x.v;
      if (r && r.token) { N.token = String(r.token); keep(N.token); N.err = null; lastFail = 0; setOn(true); return true; }
      N.err = x.e || (r && r.error) || 'login failed'; lastFail = Date.now(); N.token = null; setOn(false); return false;
    })().catch(() => false).then(v => { loginP = null; N.pending = false; if (readyRes) { readyRes(v); readyRes = null; } return v; });
    return loginP;
  };

  const withToken = args => { if (args && typeof args === 'object' && Object.prototype.hasOwnProperty.call(args, 'token') && args.token == null) return Object.assign({}, args, { token: N.token }); return args; };
  N.rpc = async (name, args, opt) => {
    const ms = opt && opt.timeout;
    try {
      if (!N.on && loginP) await loginP;
      if (!N.on || !N.token) return null;
      const tok = N.token;
      let x = await post(name, withToken(args), ms);
      const bad = y => dead(y.e) || (y.v && typeof y.v === 'object' && !Array.isArray(y.v) && dead(y.v.error));
      if (bad(x)) {                                               // the session died: log in again once, repeat once
        if (N.token === tok) { N.token = null; keep(null); N.on = false; }
        const ok = await N.login(true); if (!ok) return null;
        const a2 = args && typeof args === 'object' && args.token === tok ? Object.assign({}, args, { token: N.token }) : withToken(args);
        x = await post(name, a2, ms);
        if (bad(x)) { N.err = x.e || 'bad session'; return null; }
      }
      if (x.e !== undefined) { N.err = x.e; return null; }
      N.err = null; return x.v === undefined ? null : x.v;
    } catch (e) { N.err = String((e && e.message) || e); return null; }
  };

  /* boot after every module has loaded, so their G.on('net') listeners hear the first change */
  const boot = () => {
    const t = init() ? kept() : null;
    if (t) { N.token = t; setOn(true); if (readyRes) { readyRes(true); readyRes = null; } return; }
    if (init()) N.login(true); else if (readyRes) { readyRes(false); readyRes = null; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0)); else setTimeout(boot, 0);
})();
