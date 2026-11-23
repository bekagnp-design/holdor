/* Heavy Gold — online play (90_online.js) over Supabase Realtime: broadcast + presence on public channels, the publishable key,
   no new server (src/gold/GOLD.md, "Wave 5" and "Online hooks").
   - 🌐 "Online": a gold-edged icon button (.ib), first in #titleLinks, shown only online (G.net.on, inside Telegram). PLAY stays the
     one primary button: it starts at once and works offline; online waits up to 15 s for others. The lobby screen: a one-word title,
     the countdown, the seats (flag + name, the bots as one count), one status line, START NOW for the host (2+ players), and icon
     buttons Invite / Leave (the owner, 2026-11-23: "too much text"). The HUD chip: "🌐 N".
   - Matching: the lobby channel 'hg-lobby' (presence). Only the host of a forming room tracks there ({r: code, n, o, e}); a newcomer reads
     the presence state, joins the fullest open room, or opens his own. Two rooms opened at the same moment merge (the smaller, or the
     higher code, moves). A room is 'hg-r-<code>' (presence: one key per player); the host is the lowest presence key that is alive
     (the opener's key starts with 0, later ones with 1 and their join time). The round starts 15 s after the room opened, at once with
     8 players, or on the host's Start now. Inviting a friend holds the room 45 s longer. Empty seats are bots (labelled "bot").
   - A friend link: Telegram start_param 'room_<code>' (https://t.me/HoldorTDBot/play?startapp=room_<code>) joins that room.
   - The round: the host runs the whole simulation (the core as in solo, the remote heroes marked p.net) and broadcasts a compact state
     4 times a second on the room channel: heroes, vaults, decoys, coins added / removed (a full coin list every 2 s), minted, time,
     events (robbery, bank, skill, thunder). Each client moves its own hero (the core in S.client mode) and sends {x, y, vx, vy, sk}
     5 times a second while moving (once a second standing) on its own channel 'hg-u-<code>-<uid>', which only the host joins, so an
     input costs 2 messages, not one per player. Robbery, banking, coins and vaults are decided only by the host.
   - The host does not trust a client's numbers: his own skill numbers are clamped to the legal range for his god, his move is capped
     (1100 units/s, 1200 at once), and his running press count sk is adopted by a new host, never replayed.
   - Clients draw the other heroes 0.3 s in the past, interpolated between the host's states; names with flags, bots "bot", gone "left".
   - The host leaves (presence) or goes silent for 2.5 s: the next lowest alive key takes over from its last state (epoch + 1).
     A host that comes back and hears a newer epoch steps down to a client.
   - The end: the host's last state ends the round on every client (G.finish); each one submits its own result; hg_round_submit gets
     r.mode = 'online' and r.map (G.net.rpc is wrapped for that one call while the ended round was online).
   - Budget (Supabase Free: 100 messages/s, 200 connections, 2 M messages/month, 5 presence calls per client per 30 s): with N real
     players a round costs about 4N (state) + 10(N-1) (inputs) messages a second; with 6 or more players the inputs go to 4 a second.
   - G.online = { url (tests: a local Realtime server; also window.HG_ONLINE_URL), WAIT, MAX, HOLD, ..., phase, room, play(code), leave(),
     invite(), start(), stats, uid, debug() }. All user text is set with textContent; names are cleaned to letters, digits, space, _ -. */
(function () {
  const G = window.G; if (!G || !G.on || !G.start || !G.addMod) return;
  const KEY0 = 'sb_publishable_IdiZ6FC3GwAEZ8AkBeBg0g_doDtulMB', URL0 = 'https://acimxvnupgpronpohheb.supabase.co';
  const O = G.online = {
    url: (typeof window.HG_ONLINE_URL === 'string' && window.HG_ONLINE_URL) || null,
    WAIT: 15, MAX: 8, HOLD: 45, HOLD_MAX: 90, STATE_MS: 250, IN_MS: 200, IN_MS_BIG: 250, IDLE_MS: 1000, SILENT_MS: 2500, ROOM_SILENT_MS: 4500,
    LEFT_MS: 4000, INTERP: 0.3, HB_MS: 20000, FULL_EVERY: 8, LOBBY_MS: 1500, CONNECT_MS: 9000, ADVERT_MS: 7000,
    phase: 'off', room: null, err: '', stats: { sent: 0, recv: 0, states: 0, statesIn: 0, inputs: 0, inputsIn: 0, fixes: 0, handovers: 0, merges: 0 }
  };
  const now = () => performance.now();
  const rid = n => { const a = new Uint8Array(n); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = Math.random() * 256; } let s = ''; for (const b of a) s += (b % 36).toString(36); return s; };
  const UID = O.uid = rid(10);
  const num = (v, d) => { v = +v; return isFinite(v) ? v : (d || 0); };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const NAME_BAD = /[^\p{L}\p{M}\p{Nd} _-]/gu;
  const cleanName = s => { const t = [...String(s == null ? '' : s).replace(NAME_BAD, '').replace(/\s+/g, ' ').trim()].slice(0, 16).join('').trim(); return t || 'Player'; };
  const cleanCC = c => { c = String(c || ''); if (!/^[A-Z]{2}$/.test(c)) return ''; try { if (typeof G.countryName === 'function' && !G.countryName(c)) return ''; } catch (e) {} return c; };   // a real ISO code only
  const cleanGod = g => (G.GODS[g] ? g : 'hermes');
  const okU = u => /^[0-9a-z]{6,16}$/.test(String(u || ''));
  const okCode = c => /^[0-9a-z]{4,10}$/.test(String(c || ''));
  const flag = c => { try { return (typeof G.flag === 'function' && G.flag(c)) || ''; } catch (e) { return ''; } };
  const hasProfile = () => !!(G.profile && G.profile.name && G.profile.country);
  const online = () => !!(G.net && G.net.on && G.TG);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ================= the Realtime socket (Phoenix protocol, vsn 1.0.0, JSON text frames) ================= */
  let ws = null, wsUp = false, refN = 0, hbT = 0, reT = 0, tries = 0, wantWS = false, connT = 0;
  const chans = new Map();   // topic → channel
  const wsURL = () => {
    if (O.url) return O.url;
    const base = String((G.net && G.net.url) || URL0).replace(/^http/, 'ws');
    return base + '/realtime/v1/websocket?apikey=' + encodeURIComponent((G.net && G.net.key) || KEY0) + '&vsn=1.0.0';
  };
  const ref = () => String(++refN);
  function raw(o) { if (!ws || ws.readyState !== 1) return false; try { ws.send(JSON.stringify(o)); O.stats.sent++; return true; } catch (e) { return false; } }
  function connect() {
    wantWS = true; if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    clearTimeout(reT);
    let s; try { s = new WebSocket(wsURL()); } catch (e) { down(); return; }
    ws = s;
    s.onopen = () => { if (ws !== s) return; wsUp = true; tries = 0; clearInterval(hbT);
      hbT = setInterval(() => raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: ref() }), O.HB_MS);
      for (const ch of chans.values()) join(ch); };
    s.onmessage = e => { if (ws !== s) return; O.stats.recv++; let m = null; try { m = JSON.parse(e.data); } catch (x) { return; } if (m && typeof m === 'object') inMsg(m); };
    s.onclose = () => { if (ws !== s) return; ws = null; wsUp = false; clearInterval(hbT); for (const ch of chans.values()) ch.joined = false; down(); };
    s.onerror = () => {};
  }
  function down() { if (!wantWS) return; tries++; clearTimeout(reT); reT = setTimeout(connect, [1000, 2000, 5000, 10000][Math.min(3, tries - 1)]); paint(); }
  function disconnect() { wantWS = false; clearTimeout(reT); clearInterval(hbT); chans.clear(); const s = ws; ws = null; wsUp = false; if (s) { try { s.close(); } catch (e) {} } }
  function channel(name, o) {
    const ch = { name, topic: 'realtime:' + name, key: o.key || '', presence: !!o.presence, joined: false, jref: null, meta: null, P: {}, got: false, on: o, tracks: [] };
    chans.set(ch.topic, ch); if (wsUp) join(ch); else connect();
    return ch;
  }
  function join(ch) {
    ch.jref = ref(); ch.joined = false;
    raw({ topic: ch.topic, event: 'phx_join', ref: ch.jref, join_ref: ch.jref,
      payload: { config: { broadcast: { self: false, ack: false }, presence: { enabled: ch.presence, key: ch.key }, postgres_changes: [], private: false } } });
  }
  function push(ch, event, payload) { if (!ch || !ch.joined || chans.get(ch.topic) !== ch) return false; return raw({ topic: ch.topic, event, payload, ref: ref(), join_ref: ch.jref }); }
  const bc = (ch, ev, payload) => push(ch, 'broadcast', { type: 'broadcast', event: ev, payload });
  function track(ch, meta) { ch.meta = meta; if (!ch.joined) return false; ch.tracks.push(now()); return push(ch, 'presence', { type: 'presence', event: 'track', payload: meta }); }
  function leaveCh(ch) { if (!ch) return; if (chans.get(ch.topic) === ch) { if (ch.joined) push(ch, 'phx_leave', {}); chans.delete(ch.topic); } ch.joined = false; }
  function inMsg(m) {
    const ch = chans.get(m.topic); if (!ch) return;
    const ev = m.event, p = m.payload && typeof m.payload === 'object' ? m.payload : {};
    try {
      if (ev === 'phx_reply') {
        if (m.ref !== ch.jref || ch.joined) return;
        if (p.status === 'ok') { ch.joined = true; ch.sys = ''; if (ch.meta) track(ch, ch.meta); if (ch.on.join) ch.on.join(); }
        else if (ch.on.fail) ch.on.fail(String((p.response && (p.response.reason || p.response.error)) || 'refused'));
      } else if (ev === 'broadcast') { if (typeof p.event === 'string' && ch.on.bc) ch.on.bc(p.event, p.payload && typeof p.payload === 'object' ? p.payload : {}); }
      else if (ev === 'presence_state') { ch.P = {}; for (const k in p) if (p[k] && Array.isArray(p[k].metas) && p[k].metas.length) ch.P[k] = p[k].metas.slice(); ch.got = true; if (ch.on.pres) ch.on.pres(); }
      else if (ev === 'presence_diff') {
        const J = p.joins || {}, L = p.leaves || {};
        for (const k in J) { const add = (J[k] && J[k].metas) || [], refs = new Set(add.map(x => x && x.phx_ref)); ch.P[k] = (ch.P[k] || []).filter(x => !refs.has(x.phx_ref)).concat(add); if (!ch.P[k].length) delete ch.P[k]; }
        for (const k in L) { if (!ch.P[k]) continue; const refs = new Set(((L[k] && L[k].metas) || []).map(x => x && x.phx_ref)); ch.P[k] = ch.P[k].filter(x => !refs.has(x.phx_ref)); if (!ch.P[k].length) delete ch.P[k]; }
        if (ch.on.pres) ch.on.pres();
      } else if (ev === 'system') { if (p.status === 'error') { ch.sys = String(p.message || 'error'); O.err = ch.sys; } }
      else if (ev === 'phx_error' || ev === 'phx_close') {
        // only for the current join: Phoenix answers a duplicate join (and a leave) with phx_close carrying the OLD join's ref
        const jr0 = m.join_ref != null ? m.join_ref : m.ref; if (jr0 != null && String(jr0) !== ch.jref) return;
        ch.joined = false; const wait = ch.sys ? 6000 : 1500, jr = ch.jref;   // a rate limit closes the channel: wait longer
        setTimeout(() => { if (chans.get(ch.topic) === ch && wsUp && !ch.joined && ch.jref === jr) join(ch); }, wait);
      }
    } catch (e) { G.showErr('online: ' + ((e && e.message) || e)); }
  }
  const metaOf = (ch, k) => { const a = ch && ch.P[k]; return a && a.length ? a[a.length - 1] : null; };

  /* ================= the room ================= */
  let R = null, lobby = null, lobbyT = 0, pending = null, spUsed = false, advT = 0, advLast = -1e9;
  const shut = new Map();   // rooms found full or already playing: skipped for 20 s (a lobby advert can be a few seconds old)
  O.debug = () => R && { code: R.code, key: R.key, hk: R.hk, ep: R.ep, host: isHost(), started: R.started, members: members().map(m => m.n), noHost: [...R.noHost] };
  const isHost = () => !!(R && R.hk && R.hk === R.key);
  const myGod = () => cleanGod(G.god);
  const myMeta = () => ({ u: UID, n: cleanName(G.profile && G.profile.name), c: cleanCC(G.profile && G.profile.country), g: myGod(), v: 1 });
  /* the room's players: presence keys in order, each with its cleaned meta (a key passed over as host is still a player) */
  function members() {
    if (!R || !R.ch) return [];
    const out = [];
    for (const k of Object.keys(R.ch.P).sort()) { const m = metaOf(R.ch, k); if (!m || !okU(m.u)) continue;
      if (out.some(o => o.u === m.u)) continue; out.push({ k, u: String(m.u), n: cleanName(m.n), c: cleanCC(m.c), g: cleanGod(m.g) }); }
    if (R.key && !out.some(o => o.k === R.key) && R.ch.joined) { const me = myMeta(); out.push({ k: R.key, u: UID, n: me.n, c: me.c, g: me.g }); out.sort((a, b) => a.k < b.k ? -1 : 1); }
    return out;
  }
  const keyOfU = u => { if (!R) return null; if (u === UID) return R.key; for (const k in R.ch.P) { const m = metaOf(R.ch, k); if (m && m.u === u) return k; } return null; };
  const peers = () => R && R.ch ? Object.keys(R.ch.P).filter(k => k !== R.key).length : 0;

  function play(code) {
    if (R && R.over) cleanup();
    if (R || O.phase === 'conn' || O.phase === 'lobby') { show(); return; }
    // the profile gate of PLAY (20_profile.js): a name and a country, and no name the server refused (name_taken)
    if (!hasProfile() || (G.profileUI && G.profileUI.needFix)) { pending = code || '*'; if (G.profileUI) G.profileUI.open(false); return; }
    pending = null; O.err = ''; O.phase = 'conn'; show(); paint();
    clearTimeout(connT); connT = setTimeout(() => { if (!wsUp && O.phase !== 'play' && O.phase !== 'off' && O.phase !== 'err') fail('Server unreachable'); }, O.CONNECT_MS);
    if (code && okCode(code)) joinRoom(code, false, true); else findRoom();
  }
  function fail(msg) { cleanup(); O.phase = 'err'; O.err = msg; show(); paint(); }

  /* ---- the lobby ---- */
  function lobbyCh() {
    if (lobby && chans.get(lobby.topic) === lobby) return lobby;
    lobby = channel('hg-lobby', { key: UID, presence: true, pres: onLobby, join: () => { clearTimeout(lobbyT); lobbyT = setTimeout(decide, O.LOBBY_MS); },
      fail: r => { if (O.phase === 'lobby') fail('Server busy'); O.err = r; } });
    return lobby;
  }
  function leaveLobby() { clearTimeout(lobbyT); clearTimeout(advT); if (lobby) leaveCh(lobby); lobby = null; }
  function findRoom() { O.phase = 'lobby'; paint(); const l = lobbyCh(); if (l.joined) { clearTimeout(lobbyT); lobbyT = setTimeout(decide, l.got ? 50 : O.LOBBY_MS); } }
  const rooms = () => { const out = []; if (!lobby) return out; const t = Date.now();
    for (const k in lobby.P) { if (k === UID) continue; const m = metaOf(lobby, k); if (!m || !m.o || !okCode(m.r)) continue; const n = clamp(Math.round(num(m.n)), 1, O.MAX);
      const left = m.e ? num(m.e) - t : O.WAIT * 1000; out.push({ code: m.r, n, left }); }
    return out; };
  function decide() {
    if (O.phase !== 'lobby' || R) return;
    const tn = now(); for (const [c, t] of shut) if (tn - t > 20000) shut.delete(c);
    const open = rooms().filter(r => r.n < O.MAX && r.left > 3000 && !shut.has(r.code)).sort((a, b) => b.n - a.n || (a.code < b.code ? -1 : 1));
    if (open.length) joinRoom(open[0].code, false, false); else joinRoom(rid(6), true, false);
  }
  function onLobby() {
    if (O.phase === 'lobby' && lobby && lobby.got && !R) { clearTimeout(lobbyT); lobbyT = setTimeout(decide, 200); return; }
    // a forming room's host: merge into another open room opened at the same moment (the smaller one, or the higher code, moves)
    if (!R || R.started || !isHost() || R.moving) return;
    const mine = members().length;
    for (const r of rooms()) {
      if (r.code === R.code || r.left < 4000 || r.n + mine > O.MAX) continue;
      if (r.n > mine || (r.n === mine && r.code < R.code)) { R.moving = true; O.stats.merges++; bc(R.ch, 'mv', { hk: R.key, to: r.code }); const to = r.code; setTimeout(() => moveTo(to), 150); return; }
    }
  }
  function moveTo(code) { cleanupRoom(); joinRoom(code, false, false); }
  /* the forming room's host keeps one advert in the lobby, at most once per 7 s (Realtime allows 5 presence calls per 30 s) */
  function advert() {
    if (!R || R.started || !isHost()) return;
    const l = lobbyCh(); clearTimeout(advT);
    const wait = O.ADVERT_MS - (now() - advLast);
    if (wait > 0 || !l.joined) { advT = setTimeout(advert, Math.max(300, wait)); return; }
    advLast = now(); track(l, { r: R.code, n: members().length, o: 1, e: Date.now() + Math.max(0, R.deadline - now()), v: 1 });
  }

  /* ---- joining a room ---- */
  function joinRoom(code, opener, byLink) {
    if (O.phase === 'lobby' && !opener) leaveLobby();
    const ts = Date.now().toString(36).padStart(9, '0');
    R = { code, key: (opener ? '0' : '1') + ts + UID, opener: !!opener, ch: null, up: null, ups: {}, noHost: new Set(), hk: null, ep: 0, deadline: 0, created: now(), started: false, seats: null,
      byLink: !!byLink, lastRoom: now(), hkSince: now(), joinedAt: now(), sq: 0, isq: 0, skN: 0, lastIn: 0, lastPos: null, cm: new Map(), known: new Map(), cid: 0, evq: [],
      buf: {}, pred: new Map(), pendV: 0, lastState: now(), thunderN: 0, finSent: false, over: false, moving: false };
    O.room = code; O.phase = 'wait';
    R.ch = channel('hg-r-' + code, { key: R.key, presence: true, bc: roomBc, pres: roomPres, join: roomJoined, fail: () => fail('Room unavailable') });
    R.ch.meta = myMeta();
    R.up = channel('hg-u-' + code + '-' + UID, { presence: false });
    paint();
  }
  function roomJoined() { if (!R) return; R.joinedAt = now(); if (!R.ch.got) setTimeout(roomPres, 600); }
  function roomPres() {
    if (!R || !R.ch.joined) return;
    if (!R.started) {
      const ms = members();
      if (ms.findIndex(m => m.k === R.key) >= O.MAX) { const link = R.byLink; shut.set(R.code, now()); cleanupRoom(); if (link) G.toast('Room full', 2400); findRoom(); return; }
      if (!R.hk) { if (R.opener || !ms.some(m => m.k !== R.key)) becomeHost(); }   // a joiner waits for the host's 'room' message
      else if (R.hk !== R.key && R.ch.got && !R.ch.P[R.hk]) hostGone(R.hk);
      if (isHost()) { roomMsg(); advert(); if (ms.length >= O.MAX) startRound(); }
      paint(); return;
    }
    if (R.hk && R.hk !== R.key && !R.ch.P[R.hk]) hostGone(R.hk);   // the host left: the next one takes over
  }
  /* a message from a host: follow it if its epoch is newer, or the same epoch and the same (or a lower) host key */
  function accept(hk, ep) {
    if (!R || typeof hk !== 'string' || !isFinite(ep) || hk === R.key) return false;
    if (R.ch.got && !R.ch.P[hk]) return false;   // only a player in the room can lead it
    if (ep < R.ep || (ep === R.ep && R.hk && hk !== R.hk && hk > R.hk)) return false;
    if (hk !== R.hk) { const was = isHost(); for (const m of members()) if (m.k < hk) R.noHost.add(m.k); R.hk = hk; R.hkSince = now(); if (was) stepDown(); }
    R.ep = ep; R.noHost.delete(hk); return true;
  }
  /* the host left or went silent: the lowest key not passed over (a seated player once the round runs) leads next */
  function hostGone(k) {
    if (!R || R.over) return;
    if (k && k !== R.key) R.noHost.add(k);
    const seatU = R.started && R.seats ? new Set(R.seats.map(s => s[0])) : null;
    const c = members().filter(m => !R.noHost.has(m.k) && (!seatU || seatU.has(m.u))).map(m => m.k).sort();
    const next = c[0] || R.key;
    if (next === R.key) becomeHost(); else { R.hk = next; R.hkSince = now(); R.lastState = now(); }
    chip(); paint();
  }
  function roomMsg() { if (!R || !isHost() || R.started) return; R.lastRoomSent = now(); bc(R.ch, 'room', { hk: R.key, ep: R.ep, left: Math.max(0, Math.round((R.deadline - now()) / 100) / 10) }); }
  function roomBc(ev, p) {
    if (!R) return;
    if (ev === 'room') { if (R.started || !accept(p.hk, num(p.ep, -1))) return; R.lastRoom = now(); R.deadline = now() + clamp(num(p.left, O.WAIT), 0, O.HOLD_MAX) * 1000; paint(); return; }
    if (ev === 'go') { if (!R.started && accept(p.hk, num(p.ep, -1))) startFrom(p); return; }
    if (ev === 'hold') { if (isHost() && !R.started) hold(); return; }
    if (ev === 'mv') { if (!R.started && p.hk === R.hk && p.hk !== R.key && okCode(p.to)) moveTo(p.to); return; }
    if (ev === 's') { onState(p); return; }
  }
  function hold() {
    if (!R || R.started) return;
    if (!isHost()) { bc(R.ch, 'hold', { k: R.key }); R.deadline = Math.max(R.deadline, now() + O.HOLD * 1000); paint(); return; }
    R.deadline = Math.min(R.created + O.HOLD_MAX * 1000, Math.max(R.deadline, now() + O.HOLD * 1000)); roomMsg(); advert(); paint();
  }

  /* ---- the start ---- */
  function startRound() {
    if (!R || R.started || !isHost()) return;
    const ms = members().slice(0, O.MAX);
    const seats = ms.map(m => [m.u, m.n, m.c, m.g]);
    bc(R.ch, 'go', { hk: R.key, ep: R.ep, map: G.mapNo, seats });
    begin(seats, G.mapNo, true);
  }
  function startFrom(p) {
    const seats = Array.isArray(p.seats) ? p.seats.filter(s => Array.isArray(s) && okU(s[0])).slice(0, O.MAX) : [];
    if (!seats.length) return;
    if (!seats.some(s => s[0] === UID)) { const link = R.byLink; shut.set(R.code, now()); cleanupRoom(); G.toast(link ? 'Round already started' : 'Started without you', 2600); findRoom(); return; }
    begin(seats, clamp(num(p.map, G.mapNo) | 0, 1, 1e6), false);
  }
  function begin(seats, map, asHost) {
    R.seats = seats.map(s => [String(s[0]), cleanName(s[1]), cleanCC(s[2]), cleanGod(s[3])]);
    R.started = true; R.lastState = now(); leaveLobby();
    const mine = R.seats.find(s => s[0] === UID);
    G.start(mine ? mine[3] : myGod(), { seats: R.seats.map(s => ({ u: s[0], name: s[1], flag: flag(s[2]), god: s[3], me: s[0] === UID })), client: !asHost, map });
    const S = G.S; R.S = S; R.cm = new Map(); R.known = new Map(); R.cid = 0; R.buf = {}; R.pred.clear(); R.pendV = 0;
    for (const p of S.ps) if (p.net) { p.inT = now(); p.skN = 0; netFrom(p); }   // every client's press counter starts at 0 in a new room
    if (asHost) { hostSubs(); sendState(false); }   // the first state is a full one (sq 1)
    O.phase = 'play'; hide(); chip();
  }

  /* ---- the host ---- */
  function hostSubs() {
    if (!R || !R.seats) return;
    for (const s of R.seats) { const u = s[0]; if (u === UID || R.ups[u]) continue;
      R.ups[u] = channel('hg-u-' + R.code + '-' + u, { presence: false, bc: (ev, p) => { if (ev === 'i') onInput(u, p); } }); }
  }
  function dropSubs() { if (!R) return; for (const u in R.ups) leaveCh(R.ups[u]); R.ups = {}; }
  /* on the host, a remote hero's own numbers (his day god, his training) come with his inputs, clamped to the legal range for his god:
     the day god (40_daygod.js) cuts cd to ×0.7 (Odin), bankT to ×0.5 (Saturn), sets rob 0.5 (Tyr); training (50_training.js) moves a
     number by at most 15 % (the robbed share −9 %, the strike +12 %). So: cd ≥ 0.595 × base, bankT ≥ 0.6375, rob 0.3185..0.5, ... */
  const MODS = { cd: g => [((G.GODS[g] || {}).cd || 10) * 0.595, (G.GODS[g] || {}).cd || 10], thorR: [170, 195.5], thorShare: [0.25, 0.28], lokiT: [3, 3.45], chainT: [3, 3.45],
    rob: [G.ROB * 0.91, Math.max(G.ROB, 0.5)], bankT: [G.BANK_T * 0.425, G.BANK_T] };
  for (const n in MODS) G.addMod(n, (p, v) => (p && p.net && p.nm && typeof p.nm[n] === 'number') ? p.nm[n] : v);
  const cleanMods = (m, p) => { const o = {}; if (!m || typeof m !== 'object') return o;
    for (const n in MODS) if (typeof m[n] === 'number' && isFinite(m[n])) { const b = typeof MODS[n] === 'function' ? MODS[n](p.god) : MODS[n]; o[n] = clamp(m[n], b[0], b[1]); } return o; };
  /* positions come from the player; the host caps how far one may move: a budget that fills at MV_RATE units a second up to MV_CAP
     (about the fastest legal hero: Hermes's dash on Sol's day with training), so a console edit cannot teleport a hero */
  const MV_RATE = 1100, MV_CAP = 1200;
  function netFrom(p) { p.lx = p.x; p.ly = p.y; p.lt = now(); p.mvA = MV_CAP; }   // the move budget starts from where the host has him
  function onInput(u, m) {
    const S = G.S; if (!R || !S || S !== R.S || S.client || S.over) return;
    const p = S.ps.find(q => q.u === u); if (!p || p === S.me) return;
    O.stats.inputsIn++;
    const W = G.WORLD, r = G.radius(p), tn = now();
    let x = clamp(num(m.x, p.x), r, W - r), y = clamp(num(m.y, p.y), r, W - r);
    const lx = p.lx == null ? p.x : p.lx, ly = p.ly == null ? p.y : p.ly, d = Math.hypot(x - lx, y - ly);
    p.mvA = Math.min(MV_CAP, (p.mvA == null ? MV_CAP : p.mvA) + MV_RATE * Math.max(0, tn - (p.lt || tn)) / 1000); p.lt = tn;
    if (d > p.mvA) { const f = p.mvA / d; x = lx + (x - lx) * f; y = ly + (y - ly) * f; p.mvA = 0; O.stats.capped = (O.stats.capped || 0) + 1; } else p.mvA -= d;
    p.x = p.lx = x; p.y = p.ly = y;
    let vx = num(m.vx), vy = num(m.vy); const sp = Math.hypot(vx, vy); if (sp > MV_RATE) { vx *= MV_RATE / sp; vy *= MV_RATE / sp; }
    p.vx = p.nvx = vx; p.vy = p.nvy = vy; p.inT = tn;
    const s2 = Math.hypot(vx, vy); if (s2 > 5) { p.fx = vx / s2; p.fy = vy / s2; }
    if (p.tag === 'left') p.tag = '';
    if (m.m) p.nm = cleanMods(m.m, p);
    const sk = num(m.sk) | 0;
    // the press counter is a running total: a new host adopts it from the first input it hears (no press is replayed after a hand-over)
    if (p.skN == null) p.skN = sk;
    else if (sk > p.skN) { p.skN = sk; if (p.cd - S.t < 0.4) p.cd = Math.min(p.cd, S.t); const n0 = R.thunderN; const ok = G.useSkill(p); if (ok && p.god === 'thor' && R.thunderN === n0) R.evq.push(['m', p.id]); }
  }
  const evOn = () => { const S = G.S; return !!(R && S && S === R.S && S.online && !S.client); };
  G.on('rob', (L, H, take, loss) => { if (evOn()) R.evq.push(['r', L.id, H.id, take, loss]); });
  G.on('bank', (p, amt) => { if (evOn()) R.evq.push(['b', p.id, amt]); });
  G.on('skill', p => { const S = G.S; if (!R || !S || S !== R.S) return;
    if (S.client) { if (p === S.me) { R.skN++; R.mySkT = now(); sendInput(true); } return; }
    if (S.online) R.evq.push(['k', p.id]); });
  G.on('thunder', (p, q, loss) => { if (R) R.thunderN++; if (evOn()) R.evq.push(['t', p.id, q.id, loss]); });
  G.on('lightning', (q, loss) => { if (evOn() && q) R.evq.push(['l', q.id, loss]); });
  function sendState(fin) {
    const S = G.S; if (!R || !S || S !== R.S || S.client) return;
    R.sq++; R.lastSent = now();
    const full = !!fin || R.sq % O.FULL_EVERY === 1 || R.forceFull; R.forceFull = false;
    const ca = [], cur = new Map();
    for (const c of S.coins) { if (c.id == null) { c.id = ++R.cid; ca.push([c.id, Math.round(c.x), Math.round(c.y), c.v]); } cur.set(c.id, c); }
    const cr = []; for (const id of R.known.keys()) if (!cur.has(id)) cr.push(id);
    R.known = cur;
    const t = S.t, rem = v => Math.max(0, Math.round((v - t) * 10));
    const m = { hk: R.key, ep: R.ep, sq: R.sq, t: Math.round(t * 100) / 100, mi: S.minted, vn: Math.round(S.vNext * 100) / 100,
      p: S.ps.map(p => [p.id, Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), p.carry, p.bank, p.robs, p.lost, p.best, rem(p.imm), rem(p.inv), Math.round(p.bankT * 20), (p.tag === 'left' ? 1 : 0) | (p.dash > t ? 2 : 0)]),
      v: S.vaults.map(v => [Math.round(v.x), Math.round(v.y), v.nx == null ? -1 : Math.round(v.nx), v.ny == null ? -1 : Math.round(v.ny)]),
      d: S.decoys.map(d => [d.owner.id, Math.round(d.x), Math.round(d.y), Math.round(d.vx), Math.round(d.vy), d.carry, rem(d.until)]),
      e: R.evq.splice(0, 80) };
    R.evq.length = 0;
    if (full) { m.cf = [...cur.values()].map(c => [c.id, Math.round(c.x), Math.round(c.y), c.v]); m.seats = R.seats; m.map = G.mapNo; }
    else { if (ca.length) m.ca = ca; if (cr.length) m.cr = cr; }
    if (fin) { m.fin = 1; R.finSent = true; }
    if (peers() > 0 || fin) { bc(R.ch, 's', m); O.stats.states++; }
  }
  function hostStep(S, dt) {
    const tn = now();
    for (const p of S.ps) { if (!p.net) continue;
      // dead reckoning with the player's own velocity (a bump on the host does not drift him: his next input places him)
      const fresh = tn - (p.inT || 0) < 300 && p.tag !== 'left';
      if (!fresh) { p.nvx = (p.nvx || 0) * 0.85; p.nvy = (p.nvy || 0) * 0.85; }
      p.vx = p.nvx || 0; p.vy = p.nvy || 0;
      const r = G.radius(p); p.x = clamp(p.x + p.vx * dt, r, G.WORLD - r); p.y = clamp(p.y + p.vy * dt, r, G.WORLD - r); }
    if (S.t >= G.ROUND) { if (!R.finSent) sendState(true); return; }
    if (tn - (R.lastSent || 0) >= O.STATE_MS) sendState(false);
  }
  G.on('end', S => { if (!R || S !== R.S) return; R.over = true; if (!S.client && !R.finSent) sendState(true); setTimeout(() => { if (R && R.S === S) { cleanup(); O.phase = 'off'; } }, S.client ? 1500 : 3000); });

  /* ---- a client ---- */
  function onState(m) {
    if (!R || !accept(m.hk, num(m.ep, -1))) return;
    if (!R.started) { if (!m.seats) return; startFrom(m); if (!R || !R.started) return; }
    const S = G.S; if (!S || S !== R.S || S.over || !S.client) return;
    R.lastState = now(); O.stats.statesIn++;
    apply(S, m);
    if (m.fin) { R.finSeen = true; G.finish(); }
  }
  function apply(S, m) {
    const t0 = num(m.t, S.t), off = t0 - S.t;
    if (Math.abs(off) > 0.75) S.t = t0; else S.t += off * 0.25;
    S.minted = Math.max(0, num(m.mi, S.minted) | 0);
    S.vNext = num(m.vn, S.vNext);
    const me = S.me; let hc = null;   // my carry in the host's eyes; my own pickups he has not confirmed yet are added to it below
    if (Array.isArray(m.p)) for (const a of m.p) {
      if (!Array.isArray(a)) continue; const p = S.ps[a[0] | 0]; if (!p) continue;
      p.carry = Math.max(0, a[5] | 0); p.bank = Math.max(0, a[6] | 0); p.robs = a[7] | 0; p.lost = a[8] | 0; p.best = a[9] | 0;
      const im = S.t + num(a[10]) / 10, iv = S.t + num(a[11]) / 10; p.bankT = num(a[12]) / 20;
      if (p === me) { hc = p.carry; const fresh = now() - (R.mySkT || -1e9) < 800; me.imm = fresh ? Math.max(me.imm, im) : im; me.inv = fresh ? Math.max(me.inv, iv) : iv; continue; }
      p.imm = im; p.inv = iv;
      p.tag = (a[13] & 1) ? 'left' : '';
      const b = R.buf[p.id] || (R.buf[p.id] = []); b.push({ t: t0, x: num(a[1], p.x), y: num(a[2], p.y), vx: num(a[3]), vy: num(a[4]) }); if (b.length > 8) b.shift();
    }
    if (Array.isArray(m.v)) m.v.forEach((a, i) => { const v = S.vaults[i]; if (!v || !Array.isArray(a)) return;
      const nx = a[2] < 0 ? null : num(a[2]), ny = a[3] < 0 ? null : num(a[3]);
      if (nx != null && v.nx == null) G.toast('Vaults move · ' + Math.max(1, Math.ceil(S.vNext - S.t)) + ' s');
      if (Math.abs(v.x - a[0]) > 1 || Math.abs(v.y - a[1]) > 1) me.bankT = 0;
      v.x = num(a[0], v.x); v.y = num(a[1], v.y); v.nx = nx; v.ny = ny; });
    // coins: deltas, a full list every 2 s
    const cm = R.cm, cc = a => ({ id: a[0] | 0, x: num(a[1]), y: num(a[2]), v: Math.max(1, a[3] | 0) });
    if (Array.isArray(m.cf)) { cm.clear(); for (const a of m.cf) if (Array.isArray(a)) { const c = cc(a); cm.set(c.id, c); } }
    if (Array.isArray(m.ca)) for (const a of m.ca) if (Array.isArray(a)) { const c = cc(a); cm.set(c.id, c); }
    if (Array.isArray(m.cr)) for (const id of m.cr) { cm.delete(id | 0); R.pred.delete(id | 0); }
    let mx = 0; for (const id of cm.keys()) if (id > mx) mx = id; R.cid = Math.max(R.cid, mx);
    if (m.fin) R.pred.clear();   // the bell: the host's last word on every coin and carry
    coinsOut(S);
    if (hc != null) me.carry = hc + R.pendV;   // a hidden coin is in my carry until the host decides it: coins + carries + banks = minted
    if (Array.isArray(m.d)) S.decoys = m.d.filter(a => Array.isArray(a) && S.ps[a[0] | 0]).map(a => ({ owner: S.ps[a[0] | 0], x: num(a[1]), y: num(a[2]), vx: num(a[3]), vy: num(a[4]), carry: Math.max(0, a[5] | 0), until: S.t + num(a[6]) / 10 }));
    if (Array.isArray(m.e)) for (const e of m.e) replay(S, e);
  }
  function coinsOut(S) {   // R.pendV = the worth of my pickups the host has not confirmed (hidden, and counted in my carry)
    const tn = now(); S.coins = []; R.pendV = 0;
    for (const c of R.cm.values()) { const pt = R.pred.get(c.id); if (pt != null) { if (tn - pt < 1200) { R.pendV += c.v; continue; } R.pred.delete(c.id); } S.coins.push(c); }
  }
  function replay(S, e) {
    if (!Array.isArray(e)) return; const me = S.me, P = i => S.ps[i | 0], who = p => p.name + (p.bot ? ' (bot)' : '');   // bots always say so
    const txt = (p, s, c, life) => G.fx({ kind: 'text', x: p.x, y: p.y - 34, s, c, life: life || 0.8 });
    if (e[0] === 'r') { const L = P(e[1]), H = P(e[2]), take = e[3] | 0, loss = e[4] | 0; if (!L || !H) return;
      txt(L, '+' + take, '#ffd36a'); txt(H, '-' + loss, '#ff7a7a');
      if (L === me) { G.toast('+' + take + ' from ' + who(H)); G.haptic('light'); }
      if (H === me) { G.toast('−' + loss + ' · ' + who(L) + ' robbed you'); G.haptic('heavy'); }
      G.emit('rob', L, H, take, loss); }
    else if (e[0] === 'b') { const p = P(e[1]), amt = e[2] | 0; if (!p) return; G.fx({ kind: 'text', x: p.x, y: p.y - 40, s: 'banked ' + amt, c: '#e8b84a', life: 1.2 });
      if (p === me) { G.toast('🏦 +' + amt); G.haptic('medium'); me.bankT = 0; } G.emit('bank', p, amt); }
    else if (e[0] === 'k') { const p = P(e[1]); if (!p || p === me) return; const g = G.GODS[p.god] || {}; G.fx({ kind: 'ring', x: p.x, y: p.y, r: p.god === 'thor' ? 170 : 50, c: g.c || '#fff', life: 0.6 }); G.emit('skill', p); }
    else if (e[0] === 't') { const p = P(e[1]), q = P(e[2]), loss = e[3] | 0; if (!p || !q) return; txt(q, '-' + loss, '#9fb2ff'); if (q === me) { G.toast('⚡ −' + loss + ' · ' + who(p)); G.haptic('heavy'); } }
    else if (e[0] === 'm') { const p = P(e[1]); if (p === me) { me.cd = S.t + 1; G.toast('No richer rival near'); } }
  }
  function clientStep(S, dt) {
    const rt = S.t - O.INTERP, me = S.me;
    for (const p of S.ps) { if (p === me) continue; const b = R.buf[p.id]; if (!b || !b.length) continue;
      let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
      const a = b[i - 1], c = b[i];
      if (a && c.t > a.t && rt >= a.t && rt <= c.t) { const f = (rt - a.t) / (c.t - a.t); p.x = a.x + (c.x - a.x) * f; p.y = a.y + (c.y - a.y) * f; p.vx = c.vx; p.vy = c.vy; }
      else if (rt >= c.t) { const k = Math.min(0.25, rt - c.t); p.x = c.x + c.vx * k; p.y = c.y + c.vy * k; p.vx = c.vx; p.vy = c.vy; }
      else { p.x = c.x; p.y = c.y; } }
    for (const d of S.decoys) { d.x = clamp(d.x + d.vx * dt, 20, G.WORLD - 20); d.y = clamp(d.y + d.vy * dt, 20, G.WORLD - 20); }
    S.decoys = S.decoys.filter(d => d.until > S.t);
    // my pickups show at once (the host confirms them): a touched coin hides for 1.2 s and its gold is in my carry meanwhile
    const r = G.radius(me) + 5;
    for (let i = S.coins.length - 1; i >= 0; i--) { const c = S.coins[i], dx = c.x - me.x, dy = c.y - me.y;
      if (dx * dx + dy * dy < r * r) { R.pred.set(c.id, now()); S.coins.splice(i, 1); me.carry += c.v; R.pendV += c.v; G.emit('pickup', me, c); } }
  }
  function sendInput(force) {
    const S = G.S; if (!R || !S || S !== R.S || !S.client || S.over) return;
    const me = S.me, tn = now(), lp = R.lastPos;
    const moving = Math.hypot(me.vx, me.vy) > 5 || !lp || Math.hypot(me.x - lp.x, me.y - lp.y) > 2;
    const every = moving ? (R.seats.length >= 6 ? O.IN_MS_BIG : O.IN_MS) : O.IDLE_MS;
    if (!force && tn - R.lastIn < every) return;
    R.lastIn = tn; R.isq++; R.lastPos = { x: me.x, y: me.y };
    const m = { sq: R.isq, x: Math.round(me.x), y: Math.round(me.y), vx: Math.round(me.vx), vy: Math.round(me.vy), sk: R.skN };
    if (R.isq <= 3 || R.isq % 5 === 0) m.m = myMods(me);
    if (bc(R.up, 'i', m)) O.stats.inputs++;
  }
  function myMods(me) { const o = {}, GD = G.GODS[me.god] || {}; const base = { cd: GD.cd || 10, thorR: 170, thorShare: 0.25, lokiT: 3, chainT: 3, rob: G.ROB, bankT: G.BANK_T };
    for (const n in base) { const v = G.mod(n, me, base[n]); if (typeof v === 'number' && isFinite(v)) o[n] = Math.round(v * 1000) / 1000; } return o; }
  function stepDown() {   // a host that hears a newer host becomes a client again
    const S = G.S; if (!S || !R) return;
    S.client = true; dropSubs(); R.cm = new Map(); for (const c of S.coins) if (c.id != null) R.cm.set(c.id, c); R.buf = {}; R.pred.clear(); R.pendV = 0;
    for (const p of S.ps) p.net = false;
  }
  function becomeHost() {
    if (!R) return;
    R.ep++; R.hk = R.key; R.hkSince = now(); R.noHost.delete(R.key);
    if (!R.started) { if (!R.deadline) R.deadline = (R.opener ? R.created : now()) + O.WAIT * 1000; roomMsg(); advert(); paint(); return; }
    const S = G.S; if (!S || S !== R.S || S.over) return;
    O.stats.handovers++;
    if (S.client) {
      S.client = false;
      S.coins = [...R.cm.values()]; R.pred.clear();
      R.known = new Map(S.coins.map(c => [c.id, c])); for (const c of S.coins) R.cid = Math.max(R.cid, c.id);
      S.pairT = {};
      // remote heroes: the press counter is adopted from each one's first input (null), the move budget starts where he is drawn
      for (const p of S.ps) { p.net = !p.bot && p !== S.me; if (p.net) { p.inT = now(); p.vx = p.vy = p.nvx = p.nvy = 0; p.skN = null; netFrom(p); } if (p.bot) p.ai.t = 0; }
      S.me.carry -= R.pendV || 0; R.pendV = 0;   // my predicted pickups go back on the map: the coins in R.cm are the truth now
      const gap = S.minted - G.total();   // only a lost message can open a gap: the gold is kept as a coin, never invented
      if (gap > 0) { S.coins.push({ x: G.WORLD / 2, y: G.WORLD / 2, v: gap }); O.stats.fixes++; } else if (gap < 0) { S.minted -= gap; O.stats.fixes++; }
    }
    hostSubs(); R.forceFull = true; sendState(false);
  }
  G.on('step', dt => { const S = G.S; if (!R || !S || S !== R.S || !R.started) return; if (S.client) clientStep(S, dt); else hostStep(S, dt); });

  /* ---- the net tick: inputs, the wait countdown, a silent host, players who left ---- */
  setInterval(() => {
    if (!R) return;
    const S = G.S, tn = now();
    if (!R.started) {
      if (!R.ch.joined) return;
      if (isHost()) { if (R.deadline && tn >= R.deadline) startRound(); else if (tn - (R.lastRoomSent || 0) > 3000) roomMsg(); }
      else if (!R.hk ? tn - R.joinedAt > O.ROOM_SILENT_MS : tn - Math.max(R.lastRoom, R.hkSince) > O.ROOM_SILENT_MS) hostGone(R.hk);
      paint(); return;
    }
    if (!S || S !== R.S || S.over) return;
    if (S.client) {
      sendInput(false);
      if (tn - R.lastState > O.SILENT_MS) hostGone(R.hk);
      if (S.t >= G.ROUND + 4 && !R.finSeen) G.finish();
    } else {
      for (const p of S.ps) { if (!p.net) continue; const k = keyOfU(p.u); const gone = !k || !R.ch.P[k] || tn - (p.inT || 0) > O.LEFT_MS; if (gone && p.tag !== 'left') p.tag = 'left'; }
    }
    chip();
  }, 50);

  function cleanupRoom() {
    if (!R) return; const r = R; R = null; O.room = null;
    for (const u in r.ups) leaveCh(r.ups[u]); leaveCh(r.up); leaveCh(r.ch); clearTimeout(advT);
    if (lobby && lobby.meta) { leaveLobby(); }
  }
  function cleanup() { cleanupRoom(); leaveLobby(); disconnect(); clearTimeout(connT); chip(); }
  function leave() { cleanup(); O.phase = 'off'; hide(); }

  /* ---- invite a friend ---- */
  function invite() {
    if (!R) return;
    const url = 'https://t.me/HoldorTDBot/play?startapp=room_' + R.code, text = 'Join my Heavy Gold room';
    hold();
    try { if (G.TG && G.TG.openTelegramLink) { G.TG.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text)); return; } } catch (e) {}
    if (navigator.share) { navigator.share({ text, url }).catch(() => {}); return; }
    try { navigator.clipboard.writeText(text + ' ' + url); G.toast('Link copied'); } catch (e) { G.toast(url); }
  }

  /* ---- the round submit: r.mode = 'online' and r.map for the round that just ended online ---- */
  const wrapRpc = () => {
    const N = G.net; if (!N || typeof N.rpc !== 'function' || N.rpc._online) return;
    const orig = N.rpc;
    const w = (name, args, opt) => { const S = G.S;
      if (name === 'hg_round_submit' && S && S.online && S.over && !S.submitted && args && args.r && typeof args.r === 'object') { S.submitted = true; args = Object.assign({}, args, { r: Object.assign({}, args.r, { mode: 'online', map: G.mapNo }) }); }
      return orig(name, args, opt); };
    w._online = true; N.rpc = w;
  };
  wrapRpc();

  /* ================= UI ================= */
  const css = document.createElement('style');
  css.textContent = [
    '#hgOnline{order:-1;border-color:var(--gold,#e8b84a);background:rgba(232,184,74,.1)}#hgOnline span{color:var(--gold,#e8b84a)}#hgOnline[hidden]{display:none}',
    '#hgOn{background:var(--bg,#070c16);z-index:20}',
    '.onB{flex:1 1 auto;min-height:0;width:min(100%,560px);display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;grid-template-areas:"h" "st" "ls" "ft";gap:10px}',
    '.onH{grid-area:h;margin:0;font:900 22px/1.2 Georgia,serif;letter-spacing:.1em;color:var(--gold,#e8b84a);text-align:center}',
    '.onSt{grid-area:st;text-align:center;font:15px/1.35 Georgia,serif;color:#cfd6e2}.onSt b{display:block;font:900 40px/1.1 Georgia,serif;color:var(--ink,#f3e7c4)}',
    '.onLs{grid-area:ls;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;display:flex;flex-direction:column;gap:4px;padding:2px}',
    '.onP{display:flex;align-items:center;gap:8px;min-height:34px;padding:4px 10px;border-radius:10px;background:rgba(255,255,255,.05);font:15px/1.2 Georgia,serif}',
    '.onP .f{font-size:20px;flex:none;width:26px;text-align:center}.onP .n{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.onP .y{font:700 11px Georgia,serif;color:#1c1207;background:var(--gold,#e8b84a);border-radius:6px;padding:1px 6px}',
    '.onP.bot{background:transparent;color:var(--muted,#8d9bb0);font-size:13px;min-height:28px}',
    '.onF{grid-area:ft;display:flex;flex-direction:column;align-items:center;gap:8px}.onF [hidden]{display:none!important}',
    '.onRow{display:flex;gap:6px;justify-content:center}',
    '#onChip{position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(14px + env(safe-area-inset-bottom));display:none;padding:3px 9px;border-radius:999px;border:1px solid rgba(91,227,138,.6);background:rgba(7,12,22,.66);color:#cfe9d8;font:700 11px/1.2 Georgia,serif;letter-spacing:.06em;white-space:nowrap;pointer-events:none;text-shadow:0 1px 2px #000}',
    '#onChip.on{display:block}#onChip.bad{border-color:#ff8a7a;color:#ffc2b8}',
    '@media (orientation:landscape) and (max-height:540px){.onB{width:min(100%,760px);grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"h ls" "st ls" "ft ls";gap:6px 18px}',
    '.onH{font-size:19px}.onSt b{font-size:32px}.onP{min-height:30px;padding:3px 8px}.onF{justify-content:flex-end}.onF .pri{width:100%}}',
    '@media (orientation:landscape) and (max-height:380px){.onSt{font-size:13px}.onSt b{font-size:26px}.onF{gap:6px}.onF .pri{min-height:48px}.onP{min-height:27px;font-size:14px}}'
  ].join('\n');
  document.head.appendChild(css);
  const scr = el('div', 'scr'); scr.id = 'hgOn';
  const box = el('div', 'onB'), hH = el('h2', 'onH', 'ONLINE'), st = el('div', 'onSt'), ls = el('div', 'onLs'), ft = el('div', 'onF');
  st.id = 'onSt'; ls.id = 'onList';
  const ib = (icon, word) => { const b = el('button', 'ib'); b.type = 'button'; const w = el('span', null, word); b.append(el('i', null, icon), w); b.word = w; return b; };
  /* one primary at most: START NOW (the host, 2+ players) or TRY AGAIN (an error); Invite and Leave are icon buttons */
  const bStart = el('button', 'pri', 'START NOW'); bStart.id = 'onStart'; bStart.type = 'button';
  const row = el('div', 'onRow links');
  const bInv = ib('📤', 'Invite'); bInv.id = 'onInvite';
  const bLeave = ib('✕', 'Leave'); bLeave.id = 'onLeave';
  row.append(bInv, bLeave); ft.append(bStart, row); box.append(hH, st, ls, ft); scr.appendChild(box); document.body.appendChild(scr);
  bInv.addEventListener('click', invite);
  bStart.addEventListener('click', () => { if (O.phase === 'err') { O.phase = 'off'; play(); } else if (R && isHost() && !R.started && members().length >= 2) startRound(); });
  bLeave.addEventListener('click', leave);
  function show() { scr.classList.add('on'); paint(); }
  function hide() { scr.classList.remove('on'); }
  function paint() {
    if (!scr.classList.contains('on')) return;
    const ph = O.phase, ms = R && R.ch && R.ch.joined ? members() : [];
    st.textContent = ''; ls.textContent = '';
    bStart.hidden = true; bStart.textContent = 'START NOW'; bInv.hidden = false; bLeave.word.textContent = 'Leave';
    if (ph === 'err') { st.append(O.err || 'Server unreachable'); bStart.hidden = false; bStart.textContent = 'TRY AGAIN'; bInv.hidden = true; bLeave.word.textContent = 'Back'; return; }
    if (ph === 'conn' || ph === 'lobby' || !R || !R.ch.joined) { st.append(wsUp ? 'Finding a room…' : (tries ? 'Reconnecting…' : 'Connecting…')); bInv.hidden = true; return; }
    const left = Math.max(0, Math.ceil((R.deadline - now()) / 1000));
    const b = el('b', null, R.deadline ? left + ' s' : '…'); st.append(b, R.deadline ? (left ? ms.length + ' / ' + O.MAX + ' players' : 'Starting…') : 'Waiting for host');
    for (const m of ms) { const r = el('div', 'onP' + (m.k === R.key ? ' me' : '')); r.dataset.u = m.u; r.append(el('span', 'f', flag(m.c)), el('span', 'n', m.n)); if (m.k === R.key) r.appendChild(el('span', 'y', 'YOU')); ls.appendChild(r); }
    const nb = Math.max(0, (G.BOTS + 1) - Math.min(ms.length, O.MAX));
    if (nb) { const r = el('div', 'onP bot'); r.append(el('span', 'f', '🤖'), el('span', 'n', '× ' + nb)); ls.appendChild(r); }
    bStart.hidden = !(isHost() && ms.length >= 2);
  }
  setInterval(() => { if (scr.classList.contains('on') && O.phase !== 'play') paint(); }, 500);

  /* the title button: online only (inside Telegram, logged in) */
  const tb = ib('🌐', 'Online'); tb.id = 'hgOnline'; tb.hidden = true;
  tb.addEventListener('click', () => play());
  /* first on screen (CSS order -1), but appended: 35_chat keeps the DOM's first place for its Chat button */
  const links = G.$('titleLinks'); if (links) links.appendChild(tb);
  const vis = () => { tb.hidden = !online(); };
  /* the HUD chip during an online round */
  const ch_ = el('div'); ch_.id = 'onChip'; const hx = G.$('hudExtra'); if (hx) hx.appendChild(ch_);
  let chipTxt = '';
  function chip() {
    const S = G.S, on = !!(R && R.started && S && S === R.S && !S.over);
    ch_.classList.toggle('on', on); if (!on) return;
    const n = R.seats.length, silent = S.client && now() - R.lastState > 1200;
    const t = silent ? '🌐 …' : '🌐 ' + n;
    if (t !== chipTxt) { chipTxt = t; ch_.textContent = t; } ch_.classList.toggle('bad', silent);
  }
  /* after an online round PLAY AGAIN looks for another online room */
  const again = G.$('again'), endScr = G.$('end');
  let lastOnline = false;
  G.on('end', S => { lastOnline = !!(S && S.online) && online(); if (again) again.textContent = lastOnline ? 'PLAY ONLINE' : 'PLAY AGAIN'; });
  if (endScr) endScr.addEventListener('click', e => { const t = e.target && e.target.closest && e.target.closest('#again'); if (!t || !lastOnline) return; e.stopPropagation(); e.preventDefault(); endScr.classList.remove('on'); G.$('title').classList.add('on'); play(); }, true);
  G.on('start', S => { if (R && S !== R.S && !S.online) { cleanup(); O.phase = 'off'; hide(); } chip(); });

  /* a friend link: start_param 'room_<code>' */
  const startCode = () => { try { const u = G.TG && G.TG.initDataUnsafe; let s = (u && u.start_param) || ''; if (!s) { const q = new URLSearchParams(location.search); s = q.get('tgWebAppStartParam') || ''; }
    const m = /^room_([a-z0-9]{4,10})$/i.exec(String(s)); return m ? m[1].toLowerCase() : ''; } catch (e) { return ''; } };
  const tryLink = () => { if (spUsed || !online()) return; const c = startCode(); if (!c) return; if (G.S && !G.S.over) return; spUsed = true; play(c); };
  G.on('net', () => { vis(); wrapRpc(); tryLink(); });
  G.on('title', vis);
  G.on('profile', () => { if (pending && hasProfile() && !(G.profileUI && G.profileUI.needFix) && online()) { const c = pending; pending = null; setTimeout(() => play(c === '*' ? '' : c), 0); } });
  vis(); setTimeout(tryLink, 0);
  window.addEventListener('pagehide', () => { if (R || ws) cleanup(); });
  Object.assign(O, { play: c => play(c), leave, invite, start: () => { if (R && isHost() && !R.started) startRound(); }, members, isHost, sendState, socketURL: wsURL });
  Object.defineProperty(O, 'R', { get: () => R, enumerable: false });
})();
