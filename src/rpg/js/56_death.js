/* HOLDOR RPG — death (A31). PERMADEATH (ARCH Addendum 2): when the hero falls the run ends. 1.5 s slow fade to grey (R.dt
   untouched, only the open is delayed), "<Name> has fallen", the killer, the run's numbers (level, kills, time, bosses), a line
   from R.data.story.death, the Hall of the Fallen line (R.state.acc.hall last entry; written here if the game has not), then one
   primary CHOOSE THE NEXT HERO → R.ui.open('heroes', {afterDeath:true}) (A14) else R.newHero(id) (A01). No revive, no respawn,
   no ads. R.screens.hall (the fallen heroes + the account's best level) lives here when A14 does not provide it. */
(function () {
  const cfg = { fade: 1500 };                                      // ms (tests may shorten it)
  const LINES = [                                                  // originals; R.data.story.death replaces them when present
    'The snow does not care whose banner you carried.',
    'Steel is patient. The cold is more patient still.',
    'No song is sung for the ones who stop here.',
    'The door held. You did not.',
    'Winter keeps whatever the sword lets go.',
    'Every road in Westeros ends in the ground. Another hero takes the road.',
    'The ravens will carry word of this. Let the next one give them better news.'
  ];
  let D = null;                                                    // the current death record
  let openT = 0, showT = 0, reopenT = 0, fadeEl = null;
  const now = () => performance.now();
  const cap = s => s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
  const num = v => typeof v === 'number' && isFinite(v) ? v : null;
  const P = () => R.state && R.state.p;
  const acc = () => { try { if (typeof R.acc === 'function') { const a = R.acc(); if (a) return a; } } catch (e) {} return (R.state && R.state.acc) || null; };
  const ensureAcc = () => { let a = acc(); if (!a && R.state) a = R.state.acc = {}; if (a) { a.hall = a.hall || []; a.best = a.best || {}; } return a; };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const champ = id => { const C = R.data.champs; if (!C || id == null) return null; if (Array.isArray(C)) return C.find(c => c && c.id === id) || null; return C[id] || null; };
  const champName = id => { const c = champ(id); return (c && (c.name || c.title)) || cap(String(id || '').replace(/[_-]+/g, ' ')); };
  const champIds = () => { const C = R.data.champs; if (!C) return []; return Array.isArray(C) ? C.map(c => c && c.id).filter(Boolean) : Object.keys(C); };
  const fmtTime = s => { s = Math.max(0, Math.round(s)); if (s < 60) return s + ' s'; if (s < 3600) return Math.round(s / 60) + ' min'; const m = Math.round(s / 60) % 60; return Math.floor(s / 3600) + ' h' + (m ? ' ' + m + ' min' : ''); };
  const fmtDate = t => { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  const playedSec = p => { const v = num(p && p.played) || 0; return v > 1e7 ? v / 1000 : v; };   // seconds; an ms value is folded

  /* ---- who, what the run reached ---- */
  function killerName(k) {
    if (!k) return '';
    if (typeof k === 'string') return cap(k);
    const t = k.type;
    const d = (R.data.mobs && R.data.mobs[t]) || (R.data.bosses && R.data.bosses[t]) || champ(t);
    return k.name || (d && (d.name || d.title)) || (t ? cap(t) : '');
  }
  function storyLine(n) {
    let L = R.data.story && R.data.story.death;
    if (typeof L === 'string') L = [L];
    if (Array.isArray(L)) L = L.map(x => typeof x === 'string' ? x : x && (x.t || x.text || x.line || x.txt)).filter(Boolean);
    if (!L || !L.length) L = LINES;
    return L[(Math.max(1, n) - 1) % L.length];
  }
  // the story's death lines carry {name} {lvl} {killer} {house} {region}: filled from the record (no braces ever reach the screen)
  function fillLine(t, d) { const H = R.data.houses && R.state && R.state.acc && R.data.houses[R.state.acc.house];
    let reg = ''; try { const g = R.world && R.world.regionAt && R.player ? R.world.regionAt(R.player.x, R.player.y) : null; reg = g ? (typeof g === 'string' ? g : (g.name || g.n || g.id || '')) : ''; } catch (e) {}
    const v = { name: d.name, lvl: d.lvl, level: d.lvl, killer: d.killer || 'the cold', house: (H && (H.n || H.name)) || '', region: reg || 'the road', hero: d.name };
    if (R.story && typeof R.story.fmt === 'function') { try { t = R.story.fmt(String(t), v); } catch (e) {} }   // G7's filler first, then whatever it left
    return String(t).replace(/\{(\w+)\}/g, (m, k) => v[k] != null && v[k] !== '' ? String(v[k]) : '').replace(/\s{2,}/g, ' ').trim(); }
  // the run's kills: the player module's own count when it keeps one, else the count kept here from the 'kill' events
  R.bus.on('kill', e => { const p = P(); if (!p || !e || (e.kind !== 'mob' && e.kind !== 'boss') || (R.player && R.player.dead)) return; p.runKills = (p.runKills || 0) + 1; if (e.kind === 'boss') p.runBosses = (p.runBosses || 0) + 1; });
  // one record per death, whoever asks first (the 'death' event or A12 opening the screen)
  // by: the killer (entity or name) — never the fallen hero himself ('death' is emitted with the player entity first, the killer's name second)
  function record(by, kname) {
    if (D && !D.left) return D;
    const p = P() || {}; const A = ensureAcc();
    const self = x => !!x && typeof x === 'object' && (x === R.player || x.kind === 'player');
    const lh = R.player && R.player.lastHitBy;
    const k = (lh && !self(lh) && lh) || (by && !self(by) && by) || (R.player && R.player.killer) || kname || null;
    const d = { at: now(), hero: p.hero != null ? p.hero : (R.player && R.player.type) || null, lvl: num(p.lvl) || 1, left: false };
    d.name = p.name || champName(d.hero) || 'The hero';
    d.killer = killerName(k); d.klvl = k && typeof k === 'object' && num(k.lvl) ? k.lvl : 0;
    d.kills = num(p.kills) != null ? p.kills : (num(p.runKills) || 0);
    d.bosses = num(p.bossKills) != null ? p.bossKills : (num(p.runBosses) || 0);
    d.played = playedSec(p);
    d.n = (A && A.hall && A.hall.length) || 0;
    d.entry = hallLine(d, A);
    if (A) { A.best = A.best || {}; A.best.lvl = Math.max(+A.best.lvl || 0, d.lvl); A.best.kills = Math.max(+A.best.kills || 0, d.kills); }   // the boards' best level / kills, on every death
    try { R.ambience && R.ambience.flash && R.ambience.flash('#000', 1); } catch (e) {}
    try { R.sfx && R.sfx.play && R.sfx.play('death', 0.8); } catch (e) {}
    try { if (R.state && R.state.opts && R.state.opts.haptic && window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('error'); } catch (e) {}
    if (R.save) R.save();
    return D = d;
  }
  // the Hall of the Fallen line: the one the game wrote (last entry, this hero, moments ago) or a new one
  function hallLine(d, A) {
    if (!A) return null;
    const last = A.hall[A.hall.length - 1];
    if (last && last.id === d.hero && (last.lvl || 1) === d.lvl && Math.abs(Date.now() - (last.at || 0)) < 20000) { d.n = A.hall.length; return last; }
    const e = { id: d.hero, name: d.name, lvl: d.lvl, killer: d.killer, at: Date.now(), played: Math.round(d.played), kills: d.kills };
    A.hall.push(e); d.n = A.hall.length;
    A.best.lvl = Math.max(A.best.lvl || 0, d.lvl); A.best.kills = Math.max(A.best.kills || 0, d.kills);
    return e;
  }
  const epitaph = e => {
    if (!e) return '';
    let s = 'Here lies ' + (e.name || champName(e.id)) + ', level ' + (e.lvl || 1);
    if (e.killer) s += ', slain by ' + e.killer;
    if (e.played) s += ' after ' + fmtTime(e.played);
    return s + '.';
  };

  /* ---- the next hero ---- */
  const unlocked = () => { const A = acc(); const ch = (A && A.champs) || {}; const ids = Object.keys(ch).filter(k => ch[k] && (ch[k].unlocked || ch[k].un || ch[k].owned)); const order = champIds(); if (order.length) ids.sort((a, b) => order.indexOf(a) - order.indexOf(b)); return ids; };
  const nextHero = fallen => unlocked().find(k => k !== fallen) || fallen;
  function chooseNext() {
    if (!D || D.left) return;
    D.left = true; finish();
    if (R.screens.heroes) { R.ui.open('heroes', { afterDeath: true, fallen: D.hero }); return; }
    const id = nextHero(D.hero);
    if (typeof R.newHero === 'function') { try { R.newHero(id); } catch (e) { console.error('newHero', e); } return; }
    // last resort, no A01 R.newHero: a bare new hero of that champion
    console.warn('R.newHero missing: minimal new hero', id);
    const S = R.state; if (!S) return;
    const base = (R.newState && R.newState().p) || {};
    S.p = Object.assign({}, base, { hero: id, name: champName(id), lvl: 1, xp: 0, hp: 0, gold: 0, gems: 0, pos: null, created: Date.now(), played: 0, runKills: 0, runBosses: 0 });
    if (R.player) { R.player.dead = false; R.player.hp = R.player.hpMax || 1; R.player.anim = 'idle'; R.player.animT = 0; R.player.lastHitBy = null; R.player.type = id; R.player.name = S.p.name; }
    R.bus.emit('newhero', id); if (R.save) R.save(true);
  }
  const stillDead = () => !!(D && !D.left && R.player && R.player.dead === true);

  /* ---- the fade and the screen ---- */
  function fadeIn() {
    if (fadeEl) return;
    const ui = document.getElementById('ui'); if (!ui) return;
    fadeEl = h('div', 'dth-fade'); fadeEl.style.transitionDuration = cfg.fade + 'ms'; ui.appendChild(fadeEl);
    requestAnimationFrame(() => fadeEl && fadeEl.classList.add('on'));
  }
  function fadeOut() { if (fadeEl) { fadeEl.remove(); fadeEl = null; } }
  function finish() { clearTimeout(openT); openT = 0; clearTimeout(showT); showT = 0; clearTimeout(reopenT); reopenT = 0; fadeOut(); if (R.ui.cur === 'death') R.ui.close(); }

  R.screens.death = {
    live: true, cfg, LINES, chooseNext, nextHero, epitaph,
    get rec() { return D; },
    open(arg, el) {
      const d = record(arg && arg.by);
      el = el || document.getElementById('screen');
      const w = h('div', 'dth'); el.appendChild(w);
      w.appendChild(h('div', 'dth-title', d.name + ' has fallen'));
      const kl = h('div', 'dth-killer');
      if (d.killer) { kl.appendChild(document.createTextNode('Killed by ')); kl.appendChild(h('b', null, d.killer)); if (d.klvl) kl.appendChild(document.createTextNode(' · Lv ' + d.klvl)); }
      else kl.textContent = 'No one saw who struck.';
      w.appendChild(kl);
      const nums = h('div', 'dth-nums');
      [['Level', fmt(d.lvl)], ['Kills', fmt(d.kills)], ['Time', fmtTime(d.played)], ['Bosses', fmt(d.bosses)]].forEach(([k, v]) => { const t = h('div', 'dth-num'); t.appendChild(h('b', null, v)); t.appendChild(h('span', null, k)); nums.appendChild(t); });
      w.appendChild(nums);
      w.appendChild(h('div', 'dth-line', fillLine(storyLine(d.n), d)));
      if (d.entry) { const hl = h('div', 'dth-hall'); hl.appendChild(h('div', 'dth-epi', epitaph(d.entry))); hl.appendChild(h('small', null, 'Hall of the Fallen · ' + fmtDate(d.entry.at))); w.appendChild(hl); }
      w.appendChild(h('div', 'dth-keep', 'Gold, gear and levels go with the fallen. Titles and the world you uncovered stay.'));
      const btn = h('button', 'pri dth-next', 'CHOOSE THE NEXT HERO'); btn.addEventListener('click', chooseNext); w.appendChild(btn);
      if (R.screens.hall) { const lk = h('button', 'dth-halllink', 'Hall of the Fallen'); lk.addEventListener('click', () => R.ui.open('hall', { from: 'death' })); w.appendChild(lk); }
      // the slow fade: the sheet's content shows 1.5 s after the fall, however early the screen was opened
      const left = Math.max(0, cfg.fade - (now() - d.at));
      if (left > 0) fadeIn(); else fadeOut();
      clearTimeout(showT); showT = setTimeout(() => { showT = 0; fadeOut(); w.classList.add('show'); if (R.ui.cur === 'death') R.paused = true; }, left);
    },
    close() { clearTimeout(showT); showT = 0; }
  };

  /* ---- the Hall of the Fallen (when A14 has not provided one) ---- */
  function portraitEl(id, name) {
    const box = h('div', 'hall-pic'); const size = 44;
    try {
      if (R.draw && typeof R.draw.portrait === 'function') {
        const cv = document.createElement('canvas'); cv.width = cv.height = size * 2; cv.style.width = cv.style.height = size + 'px';
        const ctx = cv.getContext('2d');
        const r = R.draw.portrait(id, ctx, 0, 0, size * 2);
        if (r && (r instanceof HTMLCanvasElement || r instanceof HTMLImageElement)) { r.style.width = r.style.height = size + 'px'; box.appendChild(r); return box; }
        if (typeof r === 'string' && r) { const im = new Image(); im.src = r; im.style.width = im.style.height = size + 'px'; box.appendChild(im); return box; }
        const px = ctx.getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < px.length; i += 4) if (px[i]) { box.appendChild(cv); return box; }
      }
    } catch (e) {}
    box.classList.add('ini'); box.textContent = (name || champName(id) || '?').charAt(0).toUpperCase();
    return box;
  }
  if (!R.screens.hall) R.screens.hall = {
    mine: true,
    open(arg, el) {
      el = el || document.getElementById('screen');
      const A = acc(); const list = (A && A.hall) || [];
      const w = h('div', 'hall'); el.appendChild(w);
      const goBack = () => { if (arg && arg.from === 'death' && stillDead()) R.ui.open('death'); else R.ui.close(); };
      const top = h('div', 'hall-top'); const back = h('button', 'hall-back', '‹'); back.setAttribute('aria-label', 'Back'); back.addEventListener('click', goBack); top.appendChild(back);
      top.appendChild(h('div', 'hall-title', 'HALL OF THE FALLEN')); w.appendChild(top);
      const best = Math.max((A && A.best && num(A.best.lvl)) || 0, ...list.map(e => num(e.lvl) || 0));
      const st = h('div', 'hall-best');
      const t1 = h('div', 'hall-stat'); t1.appendChild(h('b', null, best ? 'Lv ' + best : '—')); t1.appendChild(h('span', null, 'best level')); st.appendChild(t1);
      const t2 = h('div', 'hall-stat'); t2.appendChild(h('b', null, fmt(list.length))); t2.appendChild(h('span', null, list.length === 1 ? 'hero fallen' : 'heroes fallen')); st.appendChild(t2);
      w.appendChild(st);
      const ul = h('div', 'hall-list');
      list.slice().reverse().forEach(e => {
        const row = h('div', 'hall-row'); row.appendChild(portraitEl(e.id, e.name));
        const tx = h('div', 'hall-txt'); tx.appendChild(h('b', null, e.name || champName(e.id)));
        tx.appendChild(h('span', null, 'Lv ' + (e.lvl || 1) + (e.killer ? ' · killed by ' + e.killer : '')));
        tx.appendChild(h('small', null, fmtDate(e.at) + (e.played ? ' · ' + fmtTime(e.played) : '')));
        row.appendChild(tx); ul.appendChild(row);
      });
      if (!list.length) ul.appendChild(h('div', 'hall-empty', 'No hero has fallen yet.'));
      w.appendChild(ul);
      const dead = stillDead();
      const btn = h('button', 'pri hall-pri', dead ? 'CHOOSE THE NEXT HERO' : 'BACK'); btn.addEventListener('click', dead ? chooseNext : goBack); w.appendChild(btn);
    },
    close() {}
  };

  /* ---- events ---- */
  R.bus.on('death', (by, kname) => {
    const d = record(by, typeof kname === 'string' ? kname : null); fadeIn();
    clearTimeout(openT);
    openT = setTimeout(() => { openT = 0; if (D === d && !d.left && R.ui.cur !== 'death') R.ui.open('death'); }, cfg.fade);
  });
  const left = () => { if (D) D.left = true; finish(); };
  R.bus.on('newhero', left); R.bus.on('start', e => { if (D && !D.left && e && !e.dead) left(); }); R.bus.on('ride', left);
  // closed from outside (Telegram's back button) while the hero still lies there: the death sheet comes back, or — after a reload, with no
  // death record in memory — the heroes screen (the dead hero must not be left lying in the world with nothing to choose)
  R.bus.on('screen', n => {
    if (n != null) { if (n !== 'death') fadeOut(); return; }   // another screen (heroes, hall, …) is never covered by the grey fade
    const deadHero = () => !!(R.player && R.player.dead === true && R.running);
    if (!stillDead() && !deadHero()) return;
    clearTimeout(reopenT); reopenT = setTimeout(() => { reopenT = 0; if (R.ui.cur != null) return;
      if (stillDead()) R.ui.open('death'); else if (deadHero()) { if (R.screens.heroes) R.ui.open('heroes', { afterDeath: true }); } }, 600);
  });
})();
