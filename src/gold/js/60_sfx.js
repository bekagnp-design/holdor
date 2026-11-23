/* 60_sfx.js — Heavy Gold sound. Every sound is synthesised with WebAudio: no audio files, no URLs.
   - The AudioContext is made on the first user gesture (iOS and Telegram need that) and never before.
   - Only events of the human hero, or ones on his screen, make a sound; frequent sounds are throttled.
   - The halving, the vault-move warning and the last 20 s are read from G.S (S.t crossing the times, the next vault spot
     appearing), not from the toast text.
   - A "Sound: on/off" .sec button in #titleLinks, saved in localStorage 'hg_sound' ('on' | 'off').
   - G.sfx = { play(name, vol), muted (get/set), log: [] (the names played, for tests), names, ready }. */
(() => {
  const G = window.G; if (!G) return;
  const KEY = 'hg_sound', MASTER = 0.9;
  const AC = window.AudioContext || window.webkitAudioContext;
  let muted = false; try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) {}
  let ac = null, out = null, nbuf = null;
  const log = [], last = {}, recent = [];
  const ms = () => (window.performance && performance.now ? performance.now() : Date.now());

  /* ---------- the context: made inside a gesture only ---------- */
  function ensure() {
    if (muted || !AC) return null;
    if (!ac) {
      try {
        try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}   // mix with the player's music
        ac = new AC();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
        out = ac.createGain(); out.gain.value = MASTER; out.connect(comp); comp.connect(ac.destination);
        const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0);   // the iOS unlock
      } catch (e) { ac = null; out = null; return null; }
    }
    if (ac.state !== 'running' && ac.resume) { try { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    return ac;
  }
  const gesture = () => { if (!muted) ensure(); };
  for (const ev of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown']) window.addEventListener(ev, gesture, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    try { const p = document.hidden ? ac.suspend() : (!muted ? ac.resume() : null); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  });

  /* ---------- building blocks ---------- */
  const noiseBuf = () => { if (nbuf) return nbuf; const n = Math.floor(ac.sampleRate * 0.8); nbuf = ac.createBuffer(1, n, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return nbuf; };
  const env = (g, t, a, v, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d); };
  const free = (...n) => () => { for (const x of n) { try { x.disconnect(); } catch (e) {} } };
  /* a tone: f (Hz), f2 (glide target), type, t (start), d (length), v (peak), a (attack), det (cents) */
  function tone(o) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, o.t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, o.t + (o.glide || o.d));
    if (o.det) osc.detune.setValueAtTime(o.det, o.t);
    env(g, o.t, o.a || 0.004, o.v, o.d);
    osc.connect(g); g.connect(out); osc.start(o.t); osc.stop(o.t + o.d + 0.05); osc.onended = free(osc, g);
  }
  /* filtered noise: ft (filter type), f, f2 (sweep), q, t, d, v, a */
  function noise(o) {
    const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf(); flt.type = o.ft || 'bandpass'; flt.frequency.setValueAtTime(o.f, o.t);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.d);
    flt.Q.setValueAtTime(o.q || 1, o.t);
    env(g, o.t, o.a || 0.01, o.v, o.d);
    src.connect(flt); flt.connect(g); g.connect(out); src.start(o.t, Math.random() * 0.3); src.stop(o.t + o.d + 0.05); src.onended = free(src, flt, g);
  }
  const semi = (f, n) => f * Math.pow(2, n / 12);

  /* ---------- the sounds: (t, vol, arg) ---------- */
  const SND = {
    // a soft coin tick, higher for a richer coin and for a quick run of pickups
    pickup(t, k, a) { const v = (a && a.v) || 1, n = (v >= 8 ? 7 : v >= 4 ? 3 : v >= 2 ? 0 : -3) + Math.min(4, (a && a.streak) || 0), f = semi(880, n);
      tone({ f, t, d: 0.09, v: 0.28 * k, a: 0.002 }); tone({ f: f * 2.76, t, d: 0.035, v: 0.05 * k, a: 0.001 }); },
    // you robbed someone: a bright rising run
    rob(t, k) { [784, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, t: t + i * 0.055, d: 0.17, v: 0.16 * k }));
      tone({ f: 3136, t: t + 0.12, d: 0.22, v: 0.04 * k }); },
    // you were robbed: a low thud
    robbed(t, k) { tone({ f: 150, f2: 46, glide: 0.22, t, d: 0.34, v: 0.55 * k, a: 0.003 }); noise({ ft: 'lowpass', f: 320, q: 0.8, t, d: 0.13, v: 0.3 * k, a: 0.002 });
      tone({ type: 'triangle', f: 233, f2: 196, t: t + 0.03, d: 0.26, v: 0.05 * k }); },
    // two others clash on your screen: a soft muffled pop
    rob_near(t, k) { noise({ ft: 'bandpass', f: 700, q: 1.4, t, d: 0.09, v: 0.22 * k, a: 0.002 }); tone({ f: 210, f2: 120, t, d: 0.12, v: 0.12 * k }); },
    // banked: a small chime, a third note for a big deposit
    bank(t, k, amt) { const notes = [1319, 1976].concat(amt >= 100 ? [2637] : []);
      notes.forEach((f, i) => { tone({ f, t: t + i * 0.08, d: 0.55, v: 0.14 * k, a: 0.003 }); tone({ f: f * 2.76, t: t + i * 0.08, d: 0.14, v: 0.025 * k, a: 0.002 }); }); },
    // Hermes: a whoosh
    skill_hermes(t, k) { noise({ ft: 'bandpass', f: 450, f2: 3200, q: 1.3, t, d: 0.34, v: 0.6 * k, a: 0.09 }); tone({ f: 520, f2: 1250, t, d: 0.22, v: 0.03 * k, a: 0.05 }); },
    // Thor: a crack, then a rumble
    skill_thor(t, k) { noise({ ft: 'highpass', f: 2600, q: 0.7, t, d: 0.06, v: 0.22 * k, a: 0.001 }); noise({ ft: 'lowpass', f: 190, f2: 70, q: 0.8, t, d: 0.75, v: 0.7 * k, a: 0.02 });
      tone({ f: 58, f2: 36, t, d: 0.65, v: 0.35 * k, a: 0.02 }); },
    // Loki: a shimmer of high notes
    skill_loki(t, k) { [1760, 2217, 2637, 3136, 2637, 3520].forEach((f, i) => tone({ f, t: t + i * 0.045, d: 0.34, v: 0.05 * k, a: 0.01, det: (Math.random() - 0.5) * 18 })); },
    // Amirani: two metal clanks
    skill_amirani(t, k) { for (const [dt, m] of [[0, 1], [0.09, 0.94]]) { noise({ ft: 'highpass', f: 3200, q: 0.8, t: t + dt, d: 0.04, v: 0.08 * k, a: 0.001 });
      [523, 1330, 2240, 3170].forEach((f, i) => tone({ type: i ? 'sine' : 'triangle', f: f * m, t: t + dt, d: 0.18 - i * 0.03, v: (0.09 - i * 0.015) * k, a: 0.001 })); } },
    // a halving: two falling notes
    halving(t, k) { tone({ type: 'triangle', f: 988, t, d: 0.2, v: 0.16 * k }); tone({ f: 494, t, d: 0.2, v: 0.05 * k });
      tone({ type: 'triangle', f: 659, t: t + 0.2, d: 0.34, v: 0.16 * k }); tone({ f: 330, t: t + 0.2, d: 0.34, v: 0.05 * k }); },
    // the vaults move soon: a soft bell
    vault(t, k) { tone({ f: 784, t, d: 1.1, v: 0.13 * k, a: 0.006 }); tone({ f: 1568, t, d: 0.5, v: 0.035 * k, a: 0.004 }); tone({ f: 784 * 2.76, t, d: 0.3, v: 0.02 * k, a: 0.003 }); },
    // the clock: a wood tick (arg 2: tick-tock)
    tick(t, k, n) { for (let i = 0; i < (n || 1); i++) { const tt = t + i * 0.2, f = i ? 1250 : 1700;
      tone({ f, f2: f * 0.7, glide: 0.03, t: tt, d: 0.05, v: 0.14 * k, a: 0.001 }); noise({ ft: 'bandpass', f: f * 1.5, q: 4, t: tt, d: 0.03, v: 0.07 * k, a: 0.001 }); } },
    // the round is over: a rising chord for first place, a soft cadence otherwise
    end(t, k, rank) { const ns = rank === 1 ? [523, 659, 784, 1047] : [784, 659, 523];
      ns.forEach((f, i) => tone({ type: 'triangle', f, t: t + i * 0.11, d: i === ns.length - 1 ? 0.7 : 0.22, v: 0.14 * k })); },
    // the sound button itself
    ui(t, k) { tone({ f: 1175, t, d: 0.08, v: 0.12 * k, a: 0.002 }); },
  };
  /* the least time between two plays of a sound (ms); the rest are rare and play every time */
  const GAP = { pickup: 60, rob: 90, robbed: 90, rob_near: 250, skill_hermes: 200, skill_thor: 200, skill_loki: 200, skill_amirani: 200, ui: 80 };

  function play(name, vol, arg) {
    const fn = SND[name]; if (!fn || muted || !ac || !out || ac.state === 'closed') return false;   // no context before the first gesture
    const now = ms(), k = vol == null ? 1 : Math.max(0.05, Math.min(1, +vol || 0));
    if (GAP[name] && last[name] != null && now - last[name] < GAP[name]) return false;
    while (recent.length && now - recent[0] > 160) recent.shift();
    if ((name === 'pickup' || k < 1) && recent.length >= 4) return false;   // a crowded moment: drop the small sounds
    try { fn(ac.currentTime + 0.01, k, arg); } catch (e) { return false; }
    last[name] = now; recent.push(now);
    log.push(name); if (log.length > 300) log.splice(0, log.length - 300);
    return true;
  }

  /* ---------- mute ---------- */
  let btn = null;
  const label = () => { if (btn) { btn.textContent = 'Sound: ' + (muted ? 'off' : 'on'); btn.setAttribute('aria-pressed', String(!muted)); } };
  function setMuted(v) {
    muted = !!v; try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (e) {}
    if (ac && out) { try { out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(muted ? 0 : MASTER, ac.currentTime, 0.02); } catch (e) {} }
    if (muted && ac) setTimeout(() => { if (muted && ac && ac.suspend) { try { const p = ac.suspend(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }, 150);   // silent and idle
    label();
  }
  const links = document.getElementById('titleLinks');
  if (links) {
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sec'; btn.id = 'hgSound'; label(); links.appendChild(btn);
    btn.addEventListener('click', () => { setMuted(!muted); if (!muted) { ensure(); play('ui'); } });
  }

  /* ---------- what the hero hears ---------- */
  const viewK = me => { const base = Math.min(1.5, Math.max(0.65, Math.sqrt(G.W * G.H) / 680)) / (1 + (G.radius(me) - 17) / 140);
    try { return typeof G.mod === 'function' ? G.mod('view', me, base) : base; } catch (e) { return base; } };
  /* is the world point on the human hero's screen (with a margin in world units)? */
  const seen = (x, y, pad) => { const S = G.S; if (!S) return false; const me = S.me, k = viewK(me) || 1;
    return Math.abs(x - me.x) < G.W / 2 / k + (pad || 0) && Math.abs(y - me.y) < G.H / 2 / k + (pad || 0); };
  const skillName = g => SND['skill_' + g] ? 'skill_' + g : 'skill_hermes';

  let prevT = 0, nextSeen = false, lostSeen = 0, streak = 0, streakT = -1e9;
  G.on('start', S => { prevT = S.t; nextSeen = !!(S.vaults[0] && S.vaults[0].nx != null); lostSeen = S.me.lost; streak = 0; });
  G.on('pickup', (p, c) => { const S = G.S; if (!S || p !== S.me) return;
    const now = ms(); streak = now - streakT < 450 ? streak + 1 : 0; streakT = now; play('pickup', 1, { v: c && c.v, streak }); });
  G.on('rob', (thief, victim) => { const S = G.S; if (!S) return; const me = S.me;
    if (thief === me) play('rob'); else if (victim === me) play('robbed'); else if (seen(victim.x, victim.y, 40)) play('rob_near', 0.5);
    lostSeen = me.lost; });
  G.on('bank', (p, amt) => { const S = G.S; if (S && p === S.me) play('bank', 1, amt); });
  G.on('skill', p => { const S = G.S; if (!S) return; const me = S.me;
    if (p === me) play(skillName(p.god)); else if (seen(p.x, p.y, 80)) play(skillName(p.god), 0.35);
    if (p !== me && p.god === 'thor' && me.lost > lostSeen) play('robbed', 0.9);   // his thunder made you spill
    lostSeen = me.lost; });
  G.on('step', () => { const S = G.S; if (!S) return; const a = prevT, t = S.t, RD = G.ROUND || 150, H = G.HALVE_T || 50; prevT = t;
    for (let n = 1; n * H < RD; n++) if (a < n * H && t >= n * H) play('halving');
    const nx = !!(S.vaults[0] && S.vaults[0].nx != null); if (nx && !nextSeen) play('vault'); nextSeen = nx;
    if (a < RD - 20 && t >= RD - 20) play('tick', 1, 2);
    for (let s = 5; s >= 1; s--) if (a < RD - s && t >= RD - s) play('tick', 0.7, 1);
    lostSeen = S.me.lost; });
  G.on('end', (S, res) => { play('end', 1, res && res.rank); });

  const api = { play, log, names: Object.keys(SND), toggle: () => setMuted(!muted) };
  Object.defineProperty(api, 'muted', { get: () => muted, set: v => setMuted(v), enumerable: true });
  Object.defineProperty(api, 'ready', { get: () => !!ac, enumerable: true });
  Object.defineProperty(api, 'state', { get: () => (ac ? ac.state : 'none'), enumerable: true });
  G.sfx = api;
})();
