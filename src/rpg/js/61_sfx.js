/* HOLDOR RPG — R.sfx: every sound is synthesised in WebAudio, no files. (A33)
   R.sfx.play(name, vol=1)      one-shot; returns the voice ({n: source nodes, end}) or false (unknown / muted / locked / throttled / capped)
   R.sfx.ambient(biome|null)    crossfades one looping bed per biome kind: wind (north, wall), birds + crickets (the reach and the green lands),
                                waves (coasts, islands, and anywhere within ~400 units of a sea shore by R.water), desert wind (Dorne). R.sfx.kindOf(biome) maps any region/biome string to a kind.
   R.sfx.music('explore'|'boss'|null)  a very quiet drone + sparse plucked notes in D Dorian / a faster pulse for a boss / silence.
   R.sfx.sync()                 master gain ← R.state.opts.sfx (0..1 or true/false).  R.sfx.setVolume(v) writes it back and saves.
   R.sfx.unlock()               resumes the AudioContext (called on the first touch / click / key).  R.sfx.stopAll() cuts live voices.
   Counters for tests: R.sfx.nodes (held loop sources: ambient + music), R.sfx.voices() (live one-shots), R.sfx.stats {played, throttled, capped}, R.sfx.last, R.sfx.hist (the last 16 names played).
   Throttle: one name at most 8×/s (R.sfx.RATE); polyphony: 12 one-shot voices (R.sfx.MAX_VOICES) — a fanfare (levelup, drums, horn, roar, quest,
   chest, error, open, close) takes the place of the voice ending soonest, every other sound is dropped while the cap is full.
   Names: swing hit hitCrit arrow bolt nova shield heal hurt die shatter coin loot levelup quest questDone ui open close error potion dodge roar drums horn door chest fall
          howl gull raven crow croak thunder splash wade forge trap · footsteps stepGrass stepSnow stepSand stepWet stepStone (wading → wade).
          Families: boss_<move>, skill_<kind> and k_/m_/r_ class skill ids, quest…, step… resolve to the closest sound (R.sfx.resolve / R.sfx.has).
   Fauna in the beds, by R.sfx.isNight() (the ambience module's day/night if it exposes one, else the clock; R.sfx.night = true|false forces it):
   birds by day and crickets at night on the green lands, gulls by day on the coast, a distant wolf now and then in the north. R.sfx.fauna says what is on.
   Hooks (so it works alone): hit, kill, levelup, loot, gold, quest, btn, screen, enter, boss, death, respawn, footstep (e, surface: the player always,
   others within 300 units, one other step per 120 ms), tick1s + taps on <button>. */
(function () {
  const S = R.sfx = R.sfx || {};
  const AC = window.AudioContext || window.webkitAudioContext;
  S.ok = !!AC; S.ac = null; S.master = null; S.unlocked = false; S.nodes = 0; S.vol = 1; S.last = null; S.hist = [];
  S.stats = { played: 0, throttled: 0, capped: 0, stolen: 0, beats: 0, plucks: 0, chirps: 0, gulls: 0, howls: 0 }; S.MAX_VOICES = 12; S.RATE = 8;
  S.ambientKind = null; S.musMode = null;
  let sfxBus = null, ambBus = null, musBus = null, noiseBuf = null, ambLayer = null, musLayer = null;
  const live = [], stamps = {}, warned = {};
  const GAP = { ui: 0.06 };                        // the tap sound comes from the bus ('btn') and the DOM: one of them is enough
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = () => Math.random();                 // never R.rng: that one is the game's deterministic seed
  const optVol = () => { const o = R.state && R.state.opts; let v = o ? o.sfx : 1; if (v === true || v == null) v = 1; if (v === false) v = 0; v = +v; return clamp(isNaN(v) ? 1 : v, 0, 1); };

  /* ---- context, buses, master ---- */
  function ensure() {
    if (!S.ok) return null;
    if (!S.ac) {
      try { S.ac = new AC(); } catch (e) { S.ok = false; return null; }
      const ac = S.ac;
      S.master = ac.createGain();
      let tail = S.master;
      if (ac.createDynamicsCompressor) { const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2; S.master.connect(comp); tail = comp; }
      tail.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(S.master);
      ambBus = ac.createGain(); ambBus.gain.value = 0.55; ambBus.connect(S.master);
      musBus = ac.createGain(); musBus.gain.value = 0.5; musBus.connect(S.master);
      S.sync();
    }
    return S.ac;
  }
  S.unlock = () => { const ac = ensure(); if (!ac) return false; S.unlocked = true; if (ac.state !== 'running') { try { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } return true; };
  S.sync = () => { const v = optVol(); S.vol = v; if (S.master) S.master.gain.value = v; return v; };
  S.setVolume = v => { if (R.state && R.state.opts) R.state.opts.sfx = clamp(+v || 0, 0, 1); S.sync(); if (R.save) R.save(); return S.vol; };
  const noiseBuffer = ac => { if (!noiseBuf) { const n = ac.sampleRate | 0; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1; } return noiseBuf; };

  /* ---- primitives: a voice is {ac, t0, out, end, srcs}; tone/hiss add one source each ---- */
  const env = (G, t, a, d, p, s, end) => { G.cancelScheduledValues(t); G.setValueAtTime(0.0001, t); G.linearRampToValueAtTime(Math.max(0.0001, p), t + a); const td = t + a + Math.max(0.001, d); G.exponentialRampToValueAtTime(Math.max(0.0001, s || 0), td); if (end > td) G.exponentialRampToValueAtTime(0.0001, end); };
  const chain = (ac, node, o, t, dur) => { for (const k of ['hp', 'bp', 'lp']) if (o[k]) { const F = ac.createBiquadFilter(); F.type = k === 'hp' ? 'highpass' : k === 'bp' ? 'bandpass' : 'lowpass'; F.frequency.setValueAtTime(o[k], t); if (o[k + '1']) F.frequency.exponentialRampToValueAtTime(o[k + '1'], t + (o.sweep || dur)); F.Q.value = o.q || 1; node.connect(F); node = F; } return node; };
  const tone = (v, o) => { const ac = v.ac, t = v.t0 + (o.at || 0), dur = o.dur || 0.2, end = t + dur;
    const osc = ac.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep || dur)); if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, end); if (o.detune) osc.detune.value = o.detune;
    if (o.vib) { const l = ac.createOscillator(); l.frequency.value = o.vib.f; const lg = ac.createGain(); lg.gain.value = o.vib.depth; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(end + 0.02); v.srcs.push(l); }
    const g = ac.createGain(); env(g.gain, t, o.a || 0.005, o.d || dur * 0.6, o.g || 0.3, o.s, end); chain(ac, osc, o, t, dur).connect(g); g.connect(v.out);
    osc.start(t); osc.stop(end + 0.02); v.srcs.push(osc); if (end + 0.02 > v.end) v.end = end + 0.02; return osc; };
  const hiss = (v, o) => { const ac = v.ac, t = v.t0 + (o.at || 0), dur = o.dur || 0.2, end = t + dur;
    const n = ac.createBufferSource(); n.buffer = noiseBuffer(ac); n.loop = true;
    const g = ac.createGain(); env(g.gain, t, o.a || 0.003, o.d || dur * 0.6, o.g || 0.3, o.s, end); chain(ac, n, o, t, dur).connect(g); g.connect(v.out);
    n.start(t); n.stop(end + 0.02); v.srcs.push(n); if (end + 0.02 > v.end) v.end = end + 0.02; return n; };

  /* ---- the sounds ---- */
  // names other modules use → the closest synth (ach, boss phases, dungeon doors, tutorial chime, death, event horns)
  const ALIAS = { caw: 'crow', bow: 'arrow', shoot: 'arrow', spell: 'nova', ui_rank: 'quest', quest_done: 'questDone', quest_turn: 'chest', wading: 'wade', ripple: 'stepWet', bark: 'howl', bleat: 'ui', cluck: 'ui', hiss: 'die', ach: 'quest', boss_: 'drums', boss_drums: 'drums', boss_start: 'drums', boss_phase: 'drums', boss_win: 'horn', chime: 'ui', death: 'fall', dg_door: 'door', dg_enter: 'open', dg_wave: 'drums', event: 'horn', reward: 'chest', tap: 'ui', win: 'horn', crit: 'hitCrit', click: 'ui', buy: 'coin', sell: 'coin', equip: 'ui', unlock: 'levelup', gem: 'coin', gold: 'coin', cast: 'nova', step: 'stepGrass', slash: 'swing' };
  const REC = {
    swing: v => hiss(v, { bp: 700, bp1: 2200, q: 1.2, dur: 0.14, a: 0.01, d: 0.08, g: 0.35 }),
    hit: v => { hiss(v, { lp: 1400, dur: 0.07, a: 0.002, d: 0.05, g: 0.5 }); tone(v, { f: 190, f1: 55, dur: 0.1, d: 0.08, g: 0.45 }); },
    hitCrit: v => { hiss(v, { lp: 2200, dur: 0.09, a: 0.002, d: 0.06, g: 0.6 }); tone(v, { f: 220, f1: 50, dur: 0.14, d: 0.12, g: 0.6 }); tone(v, { type: 'square', f: 1480, f1: 1100, dur: 0.18, d: 0.15, g: 0.12, lp: 3000 }); },
    arrow: v => { hiss(v, { hp: 2600, hp1: 900, dur: 0.14, a: 0.01, d: 0.1, g: 0.3 }); tone(v, { f: 420, f1: 240, dur: 0.05, at: 0.1, d: 0.04, g: 0.3 }); },
    bolt: v => { tone(v, { type: 'sawtooth', f: 950, f1: 180, dur: 0.16, d: 0.12, g: 0.25, lp: 2400 }); hiss(v, { hp: 3200, dur: 0.1, d: 0.08, g: 0.2 }); },
    nova: v => { tone(v, { f: 85, f1: 40, dur: 0.55, a: 0.02, d: 0.45, g: 0.5 }); hiss(v, { lp: 300, lp1: 4200, dur: 0.5, a: 0.04, d: 0.4, g: 0.45 }); tone(v, { type: 'triangle', f: 330, f1: 660, dur: 0.3, a: 0.02, d: 0.25, g: 0.15, lp: 1800 }); },
    shield: v => { tone(v, { type: 'triangle', f: 523, dur: 0.45, a: 0.05, d: 0.35, g: 0.18, lp: 2600 }); tone(v, { type: 'triangle', f: 784, dur: 0.45, a: 0.07, d: 0.33, g: 0.12, lp: 2600 }); hiss(v, { bp: 3000, q: 4, dur: 0.3, a: 0.05, d: 0.25, g: 0.08 }); },
    heal: v => [523, 659, 784].forEach((f, i) => tone(v, { f, dur: 0.35, at: i * 0.09, a: 0.01, d: 0.3, g: 0.22, lp: 3000 })),
    hurt: v => { tone(v, { type: 'sawtooth', f: 230, f1: 105, dur: 0.16, d: 0.13, g: 0.3, lp: 900 }); hiss(v, { lp: 600, dur: 0.08, d: 0.06, g: 0.35 }); },
    die: v => { hiss(v, { hp: 1400, lp: 3200, lp1: 350, dur: 0.65, a: 0.02, d: 0.55, g: 0.4 }); tone(v, { f: 210, f1: 48, dur: 0.45, a: 0.01, d: 0.4, g: 0.15 }); },   // a wight: ash hissing away
    shatter: v => { for (let i = 0; i < 6; i++) tone(v, { f: 1900 + rnd() * 3200, dur: 0.18, at: i * 0.035, a: 0.002, d: 0.15, g: 0.14 }); hiss(v, { hp: 4000, dur: 0.12, d: 0.1, g: 0.25 }); },
    coin: v => { tone(v, { f: 2100, dur: 0.22, a: 0.002, d: 0.2, g: 0.2 }); tone(v, { f: 2800, dur: 0.3, at: 0.06, a: 0.002, d: 0.28, g: 0.2 }); },
    loot: v => { [440, 554, 659].forEach((f, i) => tone(v, { type: 'triangle', f, dur: 0.3, at: i * 0.06, a: 0.005, d: 0.26, g: 0.2 })); hiss(v, { hp: 5000, dur: 0.25, a: 0.02, d: 0.2, g: 0.07 }); },
    levelup: v => [440, 523, 659, 880].forEach((f, i) => { const dur = i === 3 ? 0.9 : 0.32, at = i * 0.14;      // A minor, up: A4 C5 E5 A5
      tone(v, { type: 'square', f, dur, at, a: 0.01, d: dur * 0.9, g: 0.09, lp: 2400 }); tone(v, { type: 'triangle', f, dur, at, a: 0.01, d: dur * 0.9, g: 0.16 }); tone(v, { f: f / 2, dur, at, a: 0.01, d: dur * 0.9, g: 0.1 }); }),
    quest: v => [587, 880].forEach((f, i) => tone(v, { type: 'triangle', f, dur: 0.4, at: i * 0.12, a: 0.01, d: 0.35, g: 0.2 })),                                   // accepted
    questDone: v => [587, 698, 880, 1175].forEach((f, i) => tone(v, { type: 'triangle', f, dur: i === 3 ? 0.6 : 0.3, at: i * 0.09, a: 0.01, d: i === 3 ? 0.55 : 0.25, g: 0.18 })),
    ui: v => { tone(v, { f: 1800, dur: 0.04, a: 0.002, d: 0.03, g: 0.18 }); hiss(v, { hp: 3000, dur: 0.02, d: 0.015, g: 0.12 }); },
    open: v => { hiss(v, { lp: 300, lp1: 2600, dur: 0.16, a: 0.01, d: 0.12, g: 0.2 }); tone(v, { f: 440, f1: 660, dur: 0.14, a: 0.005, d: 0.12, g: 0.12 }); },
    close: v => { hiss(v, { lp: 2600, lp1: 300, dur: 0.16, a: 0.01, d: 0.12, g: 0.2 }); tone(v, { f: 660, f1: 440, dur: 0.14, a: 0.005, d: 0.12, g: 0.12 }); },
    error: v => [0, 0.09].forEach(at => tone(v, { type: 'square', f: 180, dur: 0.07, at, a: 0.003, d: 0.06, g: 0.18, lp: 900 })),
    potion: v => { [0, 0.12].forEach((at, i) => tone(v, { f: 300 + i * 80, f1: 620 + i * 80, dur: 0.1, at, a: 0.005, d: 0.08, g: 0.22 })); hiss(v, { bp: 3200, q: 2, dur: 0.35, at: 0.05, a: 0.05, d: 0.25, g: 0.08 }); },
    dodge: v => hiss(v, { bp: 420, bp1: 1500, q: 1.5, dur: 0.22, a: 0.06, d: 0.12, g: 0.35 }),
    roar: v => { tone(v, { type: 'sawtooth', f: 72, f1: 58, dur: 1.2, a: 0.08, d: 1.0, g: 0.35, lp: 420, vib: { f: 6.5, depth: 9 } }); tone(v, { type: 'square', f: 108, f1: 84, dur: 1.1, a: 0.1, d: 0.9, g: 0.12, lp: 360 }); tone(v, { f: 44, dur: 1.2, a: 0.1, d: 1.0, g: 0.35 }); hiss(v, { lp: 500, dur: 1.1, a: 0.15, d: 0.85, g: 0.22 }); },
    drums: v => { const K = (at, g) => tone(v, { f: 150, f1: 42, dur: 0.3, at, a: 0.002, d: 0.26, g: g || 0.6 }), T = at => tone(v, { f: 110, f1: 68, dur: 0.3, at, a: 0.003, d: 0.26, g: 0.4 }), Sn = at => hiss(v, { bp: 1500, q: 0.8, dur: 0.12, at, a: 0.002, d: 0.1, g: 0.3 });
      [0, 1, 2, 3, 3.25].forEach(b => K(b)); T(1.5); T(2.5); Sn(1.5); Sn(3.5); K(3.5, 0.9); hiss(v, { lp: 6000, dur: 0.8, at: 3.5, a: 0.005, d: 0.7, g: 0.35 }); },   // two bars at 120 bpm
    horn: v => { tone(v, { type: 'sawtooth', f: 185, f1: 196, sweep: 0.15, dur: 1.3, a: 0.15, d: 0.9, s: 0.5, g: 0.22, lp: 1200 }); tone(v, { type: 'triangle', f: 392, dur: 1.2, a: 0.2, d: 0.8, g: 0.08, lp: 1600 }); tone(v, { type: 'sawtooth', f: 131, dur: 1.0, at: 0.45, a: 0.12, d: 0.7, g: 0.14, lp: 900 }); },
    door: v => { tone(v, { type: 'sawtooth', f: 90, f1: 150, dur: 0.5, a: 0.05, d: 0.4, g: 0.15, lp: 650, vib: { f: 14, depth: 6 } }); tone(v, { f: 95, f1: 50, dur: 0.18, at: 0.5, a: 0.003, d: 0.15, g: 0.4 }); hiss(v, { lp: 500, dur: 0.1, at: 0.5, d: 0.08, g: 0.25 }); },
    chest: v => { tone(v, { f: 120, f1: 60, dur: 0.14, a: 0.003, d: 0.12, g: 0.4 }); hiss(v, { hp: 3000, dur: 0.025, at: 0.1, d: 0.02, g: 0.25 }); [1500, 2000, 3000].forEach((f, i) => tone(v, { f, dur: 0.3, at: 0.16 + i * 0.07, a: 0.003, d: 0.26, g: 0.14 })); },
    fall: v => { tone(v, { f: 160, f1: 40, dur: 0.26, a: 0.003, d: 0.22, g: 0.45 }); hiss(v, { lp: 420, dur: 0.16, d: 0.13, g: 0.3 }); },   // a living thing drops
    /* fauna and weather */
    howl: v => { const f0 = 340 + rnd() * 80; tone(v, { f: f0, f1: f0 * 1.45, sweep: 0.5, f2: f0 * 0.8, dur: 1.8, a: 0.25, d: 1.2, s: 0.3, g: 0.22, lp: 1100, vib: { f: 5, depth: 6 } }); tone(v, { f: f0 * 1.5, f1: f0 * 2.1, sweep: 0.5, f2: f0 * 1.2, dur: 1.6, at: 0.15, a: 0.3, d: 1.0, g: 0.08, lp: 1400 }); },   // a wolf
    gull: v => { const f0 = 1150 + rnd() * 250; for (let i = 0; i < 2 + (rnd() < 0.4 ? 1 : 0); i++) tone(v, { type: 'triangle', f: f0, f1: f0 * 0.78, dur: 0.28, at: i * 0.32, a: 0.03, d: 0.22, g: 0.2, hp: 600, vib: { f: 28, depth: 45 } }); },
    raven: v => [0, 0.26].forEach(at => { tone(v, { type: 'sawtooth', f: 420, f1: 300, dur: 0.18, at, a: 0.01, d: 0.15, g: 0.2, lp: 2200, vib: { f: 45, depth: 120 } }); hiss(v, { bp: 1200, q: 1.5, dur: 0.16, at, a: 0.01, d: 0.13, g: 0.12 }); }),   // a croak
    crow: v => [0, 0.18, 0.36].forEach(at => tone(v, { type: 'sawtooth', f: 640, f1: 480, dur: 0.12, at, a: 0.008, d: 0.1, g: 0.18, lp: 2500, vib: { f: 40, depth: 150 } })),
    thunder: v => { hiss(v, { hp: 2500, dur: 0.15, a: 0.002, d: 0.12, g: 0.35 }); hiss(v, { lp: 160, lp1: 55, dur: 2.6, a: 0.05, d: 2.3, g: 0.8 }); tone(v, { f: 48, f1: 28, dur: 1.6, a: 0.04, d: 1.4, g: 0.45 }); hiss(v, { lp: 400, lp1: 90, dur: 1.2, at: 0.3, a: 0.1, d: 1.0, g: 0.3 }); },
    croak: v => [0, 0.22].forEach(at => tone(v, { type: 'sawtooth', f: 150, f1: 105, dur: 0.16, at, a: 0.01, d: 0.13, g: 0.2, lp: 700, vib: { f: 32, depth: 40 } })),   // a frog, twice
    wade: v => { hiss(v, { lp: 900, lp1: 380, dur: 0.32, a: 0.04, d: 0.25, g: 0.3 }); hiss(v, { bp: 1500, bp1: 700, q: 0.8, dur: 0.22, at: 0.04, a: 0.02, d: 0.18, g: 0.16 }); tone(v, { f: 140, f1: 80, dur: 0.18, a: 0.02, d: 0.15, g: 0.12 }); },   // a leg through water
    forge: v => { tone(v, { type: 'triangle', f: 1250, dur: 0.6, a: 0.001, d: 0.5, g: 0.22 }); tone(v, { f: 1870, dur: 0.45, a: 0.001, d: 0.35, g: 0.12 }); tone(v, { f: 2960, dur: 0.3, a: 0.001, d: 0.2, g: 0.06 }); hiss(v, { hp: 2500, dur: 0.06, a: 0.001, d: 0.05, g: 0.3 }); },   // hammer on an anvil
    trap: v => { hiss(v, { hp: 1800, dur: 0.05, a: 0.001, d: 0.04, g: 0.45 }); tone(v, { type: 'square', f: 420, f1: 180, dur: 0.08, a: 0.001, d: 0.07, g: 0.14, lp: 2400 }); },   // jaws snapping shut
    splash: v => { hiss(v, { bp: 1800, bp1: 600, q: 1, dur: 0.3, a: 0.005, d: 0.25, g: 0.4 }); tone(v, { f: 300, f1: 120, dur: 0.12, a: 0.003, d: 0.1, g: 0.25 }); hiss(v, { hp: 4000, dur: 0.25, at: 0.05, a: 0.03, d: 0.2, g: 0.12 }); },
    /* footsteps (short, quiet) */
    stepGrass: v => { hiss(v, { lp: 500, dur: 0.07, a: 0.003, d: 0.05, g: 0.18 }); tone(v, { f: 110, f1: 70, dur: 0.06, a: 0.002, d: 0.05, g: 0.15 }); },                      // a soft thud
    stepSnow: v => { hiss(v, { bp: 1800, q: 0.8, dur: 0.09, a: 0.002, d: 0.07, g: 0.22 }); hiss(v, { hp: 3500, dur: 0.04, a: 0.001, d: 0.03, g: 0.1 }); },                        // a crunch
    stepSand: v => hiss(v, { lp: 1200, dur: 0.1, a: 0.02, d: 0.07, g: 0.14 }),                                                                                                       // a hush
    stepWet: v => { hiss(v, { bp: 2200, bp1: 900, dur: 0.12, a: 0.003, d: 0.09, g: 0.2 }); tone(v, { f: 260, f1: 130, dur: 0.06, a: 0.002, d: 0.05, g: 0.12 }); hiss(v, { hp: 5000, dur: 0.08, at: 0.02, a: 0.01, d: 0.06, g: 0.08 }); },   // a splash
    stepStone: v => { hiss(v, { hp: 2000, dur: 0.035, a: 0.001, d: 0.025, g: 0.22 }); tone(v, { f: 900, f1: 500, dur: 0.03, a: 0.001, d: 0.025, g: 0.12 }); tone(v, { f: 180, f1: 120, dur: 0.05, a: 0.002, d: 0.04, g: 0.1 }); },      // a click
  };
  S.names = () => Object.keys(REC);
  const PRI = { levelup: 1, drums: 1, horn: 1, roar: 1, quest: 1, questDone: 1, chest: 1, error: 1, open: 1, close: 1 };   // never dropped behind a wall of hits
  const cut = (v, t) => { try { v.out.gain.cancelScheduledValues(t); v.out.gain.setValueAtTime(0, t); } catch (e) {} for (const s of v.srcs) { try { s.stop(t + 0.01); } catch (e) {} } };

  // families other modules build at runtime: 'boss_' + move, 'skill_' + kind (and the k_/m_/r_ class skill ids), 'quest…', 'step…'
  const BOSSMOVE = { slam: 'hit', charge: 'roar', volley: 'arrow', frost: 'shatter', roar: 'roar', summon: 'horn', heal: 'heal', enrage: 'roar', hit: 'hit', dead: 'horn', death: 'horn', end: 'horn', win: 'horn' };
  const SKILLKW = [[/heal|tinct|flask|pool|mend/, 'heal'], [/shield|oath|guard|ward/, 'shield'], [/dash|lunge|charge|step|leap/, 'dodge'], [/taunt|roar|shout|cry/, 'roar'], [/frost|ice|freeze/, 'shatter'],
    [/volley|arrow|rain|shot|bow/, 'arrow'], [/trap|snare/, 'trap'], [/raven|crow|bird/, 'raven'], [/fire|bolt|storm|lightning|wild/, 'bolt'], [/nova|burst|ring|weir/, 'nova'], [/aoe|whirl|cleave|melee|slash|strike/, 'swing']];
  const resolve = name => { if (REC[name]) return name; const a = ALIAS[name]; if (a && REC[a]) return a; const s = String(name);
    if (s.startsWith('boss_')) { const b = BOSSMOVE[s.slice(5)]; return b && REC[b] ? b : 'drums'; }
    if (s.startsWith('skill_') || /^[kmr]_/.test(s)) { for (const [re, n] of SKILLKW) if (re.test(s)) return n; return 'nova'; }
    if (s.startsWith('quest')) return 'questDone';
    if (s.startsWith('step')) return 'stepGrass';
    return null; };
  S.resolve = resolve; S.has = name => !!resolve(name);
  S.play = (name, vol) => {
    name = resolve(name) || name;
    const rec = REC[name]; if (!rec) { if (!warned[name]) { warned[name] = 1; console.warn('sfx: no sound named', name); } return false; }
    if (S.sync() <= 0) return false;
    const ac = ensure(); if (!ac || ac.state === 'closed') return false;
    if (ac.state !== 'running' && !S.unlocked) return false;             // nothing queues up behind a locked context
    const ms = performance.now(), st = stamps[name] || (stamps[name] = []);
    while (st.length && ms - st[0] > 1000) st.shift();
    if (st.length >= S.RATE || (GAP[name] && st.length && ms - st[st.length - 1] < GAP[name] * 1000)) { S.stats.throttled++; return false; }
    const t = ac.currentTime;
    for (let i = live.length - 1; i >= 0; i--) if (live[i].end <= t) live.splice(i, 1);
    if (live.length >= S.MAX_VOICES) { if (!PRI[name]) { S.stats.capped++; return false; }
      let j = 0; for (let i = 1; i < live.length; i++) if (live[i].end < live[j].end) j = i; cut(live[j], t); live.splice(j, 1); S.stats.stolen++; }   // a fanfare takes the place of the voice ending soonest
    const v = { ac, t0: t, out: ac.createGain(), end: t, srcs: [], name };
    v.out.gain.value = clamp(vol == null ? 1 : +vol || 0, 0, 2); v.out.connect(sfxBus);
    try { rec(v); } catch (e) { console.error('sfx', name, e); }
    v.n = v.srcs.length; st.push(ms); live.push(v); S.stats.played++; S.last = name; S.hist.push(name); if (S.hist.length > 16) S.hist.shift();
    setTimeout(() => { try { v.out.disconnect(); } catch (e) {} }, (v.end - t + 0.15) * 1000);
    return v;
  };
  S.voices = () => { const t = S.ac ? S.ac.currentTime : 0; return live.filter(v => v.end > t).length; };
  S.stopAll = () => { const ac = S.ac; if (!ac) return; const t = ac.currentTime; for (const v of live) cut(v, t); live.length = 0; };

  /* ---- loops (ambient beds and music share one layer type) ---- */
  const mkLayer = bus => { const L = { g: S.ac.createGain(), srcs: [], timers: [], on: true }; L.g.gain.value = 0.0001; L.g.connect(bus); return L; };
  const src = (L, node) => { try { node.start(); } catch (e) {} L.srcs.push(node); S.nodes++; return node; };
  const filt = (type, f, q) => { const F = S.ac.createBiquadFilter(); F.type = type; F.frequency.value = f; F.Q.value = q || 1; return F; };
  const gainTo = (dest, v) => { const g = S.ac.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const lfo = (L, f, depth, param, base) => { const o = S.ac.createOscillator(); o.frequency.value = f; const g = S.ac.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); if (base != null) param.value = base; return src(L, o); };
  const loopNoise = L => { const n = S.ac.createBufferSource(); n.buffer = noiseBuffer(S.ac); n.loop = true; return src(L, n); };
  const fadeIn = (L, v, fade) => { const t = S.ac.currentTime; L.g.gain.setValueAtTime(0.0001, t); L.g.gain.exponentialRampToValueAtTime(v, t + fade); };
  const stopLayer = (L, fade) => { if (!L || !L.on) return; L.on = false; const t = S.ac.currentTime, G = L.g.gain;
    try { G.cancelScheduledValues(t); G.setValueAtTime(Math.max(0.0001, G.value), t); G.exponentialRampToValueAtTime(0.0001, t + fade); } catch (e) {}
    for (const s of L.srcs) { try { s.stop(t + fade + 0.05); } catch (e) {} S.nodes--; } L.srcs = [];
    for (const h of L.timers) clearInterval(h); L.timers = [];
    setTimeout(() => { try { L.g.disconnect(); } catch (e) {} }, (fade + 0.3) * 1000); };
  const tiny = (out, t) => ({ ac: S.ac, t0: t, out, end: t, srcs: [] });   // a voice inside a layer (chirps, plucks, beats)

  S.fauna = { birds: false, crickets: false, gulls: false, wolves: false };
  S.night = null;                                   // true|false forces night/day (tests, a menu toggle); null asks the ambience module, else the clock
  S.isNight = () => { if (S.night != null) return !!S.night; const A = R.ambience || (R.sys && R.sys.ambience);
    try { if (A) { if (typeof A.isNight === 'function') return !!A.isNight(); if (typeof A.night === 'function') return !!A.night(); if (typeof A.night === 'boolean') return A.night; if (typeof A.night === 'number') return A.night > 0.5;
      if (typeof A.hour === 'number') return A.hour < 6 || A.hour >= 20; if (typeof A.dayT === 'number') return A.dayT < 0.25 || A.dayT >= 0.75; } } catch (e) {}
    const h = new Date().getHours(); return h < 6 || h >= 21; };
  const AMB = {
    wind: L => { const ac = S.ac; const n = loopNoise(L); const lp = filt('lowpass', 420, 0.8); lfo(L, 0.09, 240, lp.frequency, 420); const g = gainTo(L.g, 0.7); n.connect(lp); lp.connect(g); lfo(L, 0.05, 0.3, g.gain, 0.7);
      const bp = filt('bandpass', 900, 9); lfo(L, 0.037, 320, bp.frequency, 900); const g2 = gainTo(L.g, 0.25); n.connect(bp); bp.connect(g2);
      const far = gainTo(L.g, 0.3); let next = ac.currentTime + 0.5 + rnd() * 2;                                                                 // a distant wolf: first within 2.5 s, then every 8–18 s at night, 14–30 s by day
      L.timers.push(setInterval(() => { if (!L.on) return; const now = ac.currentTime; if (now + 0.1 < next) return; S.stats.howls++; S.fauna.wolves = true;
        REC.howl(tiny(far, Math.max(now + 0.05, next))); next += S.isNight() ? 8 + rnd() * 10 : 14 + rnd() * 16; }, 250)); },
    desert: L => { const n = loopNoise(L); const bp = filt('bandpass', 1400, 2.2); lfo(L, 0.07, 700, bp.frequency, 1400); const g = gainTo(L.g, 0.55); n.connect(bp); bp.connect(g); lfo(L, 0.13, 0.35, g.gain, 0.55);
      const hp = filt('highpass', 3200, 0.7); const g2 = gainTo(L.g, 0.08); n.connect(hp); hp.connect(g2); },
    waves: L => { const ac = S.ac; const n = loopNoise(L); const lp = filt('lowpass', 700, 0.7); const g = gainTo(L.g, 0.45); n.connect(lp); lp.connect(g); lfo(L, 0.12, 0.4, g.gain, 0.45);
      const bp = filt('bandpass', 2600, 1.2); const g2 = gainTo(L.g, 0.14); n.connect(bp); bp.connect(g2); lfo(L, 0.12, 0.14, g2.gain, 0.14);
      const far = gainTo(L.g, 0.45); let next = ac.currentTime + 0.5 + rnd() * 2;                                                                // gulls by day: first within 2.5 s, then every 3–9 s
      L.timers.push(setInterval(() => { if (!L.on) return; const now = ac.currentTime; if (now + 0.1 < next) return; if (S.isNight()) { S.fauna.gulls = false; next = now + 3; return; }
        S.fauna.gulls = true; S.stats.gulls++; REC.gull(tiny(far, Math.max(now + 0.05, next))); next += 3 + rnd() * 6; }, 200)); },
    birds: L => { const ac = S.ac; const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 4300; const lp = filt('lowpass', 6000, 0.5); const crk = gainTo(L.g, 0); const am = gainTo(crk, 0.05); o.connect(lp); lp.connect(am); lfo(L, 28, 0.05, am.gain, 0.05); lfo(L, 0.3, 0.03, am.gain); src(L, o);   // crickets, at night
      const n = loopNoise(L); const bl = filt('lowpass', 260, 0.6); const bg = gainTo(L.g, 0.18); n.connect(bl); bl.connect(bg);                                                                                                        // a breeze
      let next = ac.currentTime + 0.3 + rnd() * 1.2, night = null;                                                                                                                                                                     // birds by day: first within 1.5 s, then every 0.7–2.8 s
      L.timers.push(setInterval(() => { if (!L.on) return; const now = ac.currentTime, nt = S.isNight();
        if (nt !== night) { night = nt; crk.gain.setTargetAtTime(nt ? 1 : 0, now, 1.5); S.fauna.crickets = nt; S.fauna.birds = !nt; }
        if (nt) { next = now + 0.3 + rnd() * 1.2; return; } if (now + 0.1 < next) return;
        const v = tiny(L.g, Math.max(now + 0.05, next)), f0 = 2300 + rnd() * 900, k = 2 + (rnd() < 0.5 ? 1 : 0); S.stats.chirps++;
        for (let i = 0; i < k; i++) tone(v, { f: f0, f1: f0 + 600, dur: 0.07, at: i * 0.09, a: 0.01, d: 0.05, g: 0.08 }); next += 0.7 + rnd() * 2.1; }, 200)); },
  };
  S.kindOf = b => { b = b == null ? '' : (b + '').toLowerCase(); if (!b) return null; if (AMB[b]) return b;
    if (/north|wall|snow|ice|frost|winter|tundra|cold|gift|beyond|wight/.test(b)) return 'wind';
    if (/desert|dorne|sand|dune|waste/.test(b)) return 'desert';
    if (/coast|sea|shore|isle|island|bay|storm|salt|harbo|port|beach|pyke|dragonstone/.test(b)) return 'waves';
    return 'birds'; };
  S.ambient = biome => { const kind = S.kindOf(biome);
    if (kind === S.ambientKind && (!kind || (ambLayer && ambLayer.on))) return kind;
    S.ambientKind = kind; const ac = ensure(); if (!ac) return kind;
    if (ambLayer) stopLayer(ambLayer, 1.6); ambLayer = null; S.fauna.birds = S.fauna.crickets = S.fauna.gulls = S.fauna.wolves = false;
    if (kind) { ambLayer = mkLayer(ambBus); AMB[kind](ambLayer); fadeIn(ambLayer, 1, 1.8); }
    return kind; };

  const DOR = [293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33];   // D Dorian, D4..D5
  const pluck = (out, f, t, g, dur) => { const v = tiny(out, t); dur = dur || 1.4; S.stats.plucks++; tone(v, { type: 'triangle', f, dur, a: 0.005, d: dur * 0.9, g: g || 0.14, lp: 1800 }); tone(v, { f: f * 2, dur: 0.3, a: 0.002, d: 0.25, g: (g || 0.14) * 0.25 }); };
  const MUS = {
    explore: L => { const ac = S.ac; const lp = filt('lowpass', 480, 0.6); lp.connect(L.g); lfo(L, 0.03, 160, lp.frequency, 480);
      for (const [f, type, det, g] of [[73.42, 'triangle', -4, 0.09], [73.42, 'sawtooth', 5, 0.03], [110, 'sine', 3, 0.07]]) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(gainTo(lp, g)); src(L, o); }
      let next = ac.currentTime + 1.2;
      L.timers.push(setInterval(() => { if (!L.on) return; const now = ac.currentTime; if (now + 0.3 < next) return; const i = rnd() < 0.35 ? 0 : rnd() < 0.5 ? 4 : Math.floor(rnd() * 8);
        pluck(L.g, DOR[i] * (rnd() < 0.3 ? 2 : 1), Math.max(now + 0.05, next), 0.12); next += 2.5 + rnd() * 3.5; }, 200)); },
    boss: L => { const ac = S.ac; const lp = filt('lowpass', 360, 0.8); lp.connect(L.g);
      for (const [f, det, g] of [[73.42, -6, 0.08], [103.83, 6, 0.06], [36.71, 0, 0.08]]) { const o = ac.createOscillator(); o.type = f < 50 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(gainTo(lp, g)); src(L, o); }
      const beat = 0.4; let next = ac.currentTime + 0.1, n = 0;                                                                    // 150 bpm
      L.timers.push(setInterval(() => { if (!L.on) return; while (next < ac.currentTime + 0.45) { const t = next, b = n % 8, v = tiny(L.g, t); S.stats.beats++;
        tone(v, { f: 140, f1: 44, dur: 0.2, a: 0.002, d: 0.17, g: b % 2 ? 0.3 : 0.45 });
        if (b === 3 || b === 7) tone(v, { f: 96, f1: 62, dur: 0.22, a: 0.003, d: 0.2, g: 0.3 });
        if (b === 6) hiss(v, { bp: 1500, q: 0.8, dur: 0.1, a: 0.002, d: 0.08, g: 0.18 });
        if (b % 4 === 0) pluck(L.g, [146.83, 174.61, 220][(n / 4 | 0) % 3], t, 0.12, 0.7);
        next += beat; n++; } }, 100)); },
  };
  S.music = mode => { if (mode && !MUS[mode]) mode = 'explore';
    if (mode === S.musMode && (!mode || (musLayer && musLayer.on))) return mode;
    S.musMode = mode; const ac = ensure(); if (!ac) return mode;
    if (musLayer) stopLayer(musLayer, mode ? 0.8 : 1.2); musLayer = null;
    if (mode) { musLayer = mkLayer(musBus); MUS[mode](musLayer); fadeIn(musLayer, 1, mode === 'boss' ? 0.4 : 2.5); }
    return mode; };
  S.timers = () => (ambLayer && ambLayer.on ? ambLayer.timers.length : 0) + (musLayer && musLayer.on ? musLayer.timers.length : 0);

  /* ---- what plays when: the world mode (explore / boss) and silence under a menu ---- */
  let world = null, started = false, enterSeen = false, regBed = null, bedTick = 0;
  const coastNear = () => { const W = R.water, p = R.player; if (!W || !W.ready || typeof W.shorePoints !== 'function' || !p) return false;
    try { const pts = W.shorePoints(p.x, p.y, Math.max(400, (W.CS || 24) * 3)); for (let i = 0; i < pts.length; i++) if (pts[i].kind === 'sea') return true; } catch (e) {} return false; };
  S.coastNear = coastNear;
  const menuOpen = () => { const c = R.ui && R.ui.cur; if (!c) return false; const s = R.screens && R.screens[c]; return !(s && s.live); };
  const apply = () => S.music(menuOpen() ? null : world);
  S.setWorld = m => { world = m; apply(); return world; };
  S.world = () => world;

  /* ---- hooks ---- */
  if (R.bus) {
    const P = S.play;
    R.bus.on('hit', i => { if (!i) return; if (i.tgt && i.tgt === R.player) { P('hurt', 0.9); return; } const k = i.kind || (i.o && i.o.kind); P(i.crit ? 'hitCrit' : k === 'ice' ? 'shatter' : 'hit', i.src === R.player ? 1 : 0.6); });
    R.bus.on('kill', e => { if (!e) return; const k = ((e.type || '') + ' ' + (e.name || '')).toLowerCase();
      if (e.kind === 'boss') { P('horn'); S.setWorld('explore'); return; }
      if (/wight|walker|white|undead|skel|ghost|dead|shade/.test(k)) P('die'); else if (/ice|frost|snow|crystal/.test(k)) P('shatter'); else P('fall', 0.7); });
    R.bus.on('levelup', () => P('levelup'));
    R.bus.on('loot', it => P('loot', 0.6 + 0.1 * ((it && it.rar) || 0)));
    R.bus.on('gold', n => { if (n == null || n > 0) P('coin', 0.7); });
    R.bus.on('quest', (id, st) => P(st === 'open' || st == null ? 'quest' : 'questDone'));
    R.bus.on('btn', () => P('ui'));
    R.bus.on('screen', name => { if (started) P(name ? 'open' : 'close', 0.8); apply(); });
    R.bus.on('enter', id => { enterSeen = true; let reg = null;
      try { if (R.world && R.world.regionOf) reg = R.world.regionOf(id); if (!reg && R.data.world && R.data.world.regions) reg = R.data.world.regions.find(r => r.id === id || r.name === id); } catch (e) {}
      regBed = reg && (reg.biome || reg.id) || id; S.ambient(coastNear() ? 'coast' : regBed); });
    R.bus.on('boss', (id, phase) => { const over = phase === false || /end|dead|done|kill|win|lose|over|fled|out/.test((phase == null ? '' : phase + '').toLowerCase());
      if (over) { if (world === 'boss') S.setWorld('explore'); } else if (world !== 'boss') { P('drums'); S.setWorld('boss'); } });
    R.bus.on('death', () => { P('fall', 1); if (world === 'boss') S.setWorld('explore'); });
    R.bus.on('respawn', () => P('heal', 0.8));
    const STEP = { grass: 'stepGrass', snow: 'stepSnow', ice: 'stepSnow', sand: 'stepSand', wet: 'stepWet', water: 'stepWet', mud: 'stepWet', stone: 'stepStone', rock: 'stepStone', road: 'stepStone', wood: 'stepStone' };
    let otherStepMs = 0;
    R.bus.on('splash', e => { if (!e) return; if (e === R.player) { P('splash', 0.8); return; } if (R.player && Math.hypot((e.x || 0) - R.player.x, (e.y || 0) - R.player.y) < 260) P('splash', 0.35); });
    R.bus.on('footstep', (e, surface) => { if (!e) return; const name = e.wading || (e.depth || 0) >= 0.5 ? 'wade' : STEP[(surface || 'grass') + ''] || STEP.grass;
      if (e === R.player || e.kind === 'player') { P(name, 0.7); return; }
      if (!R.player) return; const d = Math.hypot((e.x || 0) - R.player.x, (e.y || 0) - R.player.y); if (d > 300) return;
      const ms = performance.now(); if (ms - otherStepMs < 120) return; otherStepMs = ms; P(name, 0.1 + 0.45 * (1 - d / 300)); });
    R.bus.on('tick1s', () => { S.sync();
      if (!started && R.running) { started = true; if (!world) world = 'explore'; apply(); }
      if (!enterSeen && R.player && R.world && R.world.regionAt) { try { const reg = R.world.regionAt(R.player.x, R.player.y); if (reg && (reg.biome || reg.id)) regBed = reg.biome || reg.id; } catch (e) {} }
      // the sea is heard where it is: within ~400 units (≥ 3 mask cells) of a sea shoreline (R.water, A44) the bed is the waves, else the region's
      if (R.running && regBed != null && (++bedTick & 1) === 0) { const want = coastNear() ? 'coast' : regBed; if (S.kindOf(want) !== S.ambientKind) S.ambient(want); } });
  }
  const gest = () => { S.unlock(); };
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click']) window.addEventListener(ev, gest, { capture: true, passive: true });
  document.addEventListener('pointerdown', ev => { const t = ev.target; if (t && t.closest && t.closest('button')) S.play('ui'); }, true);
  document.addEventListener('visibilitychange', () => { const ac = S.ac; if (!ac) return; try { if (document.hidden) ac.suspend(); else if (S.unlocked) ac.resume(); } catch (e) {} });
})();
