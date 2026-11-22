/* HOLDOR RPG — the level-up card (A30): R.screens.levelup, stat points, the skill unlocked at this level, an in-world flash.
   Opened by the player module with the new level (R.ui.open('levelup', lvl)) or by this module itself on the 'levelup'
   event. Several level-ups in a row merge into one card: the highest level, the points summed. The world pauses
   (live:false). Test hooks: R.levelup.{skillsAt, calc, pending, spend, auto, assign}. */
(function () {
  const HFB = { stark: { n: 'Stark', e: '🐺', col: '#a9bdd0', col2: '#3b4a5a' }, lannister: { n: 'Lannister', e: '🦁', col: '#e3b661', col2: '#7a1d1d' },
    baratheon: { n: 'Baratheon', e: '🦌', col: '#e0c14a', col2: '#23231f' }, targaryen: { n: 'Targaryen', e: '🐉', col: '#e14b4b', col2: '#1c1c1c' },
    greyjoy: { n: 'Greyjoy', e: '🦑', col: '#d8b74a', col2: '#1f2a30' }, tyrell: { n: 'Tyrell', e: '🌹', col: '#7fd06a', col2: '#2f5a2a' },
    martell: { n: 'Martell', e: '☀️', col: '#f08a3c', col2: '#7a2a1a' } };
  const MAIN = { knight: 'str', ranger: 'agi', maester: 'int' };
  const STATS = ['str', 'agi', 'int', 'vit'];
  const SNAME = { str: 'STR', agi: 'AGI', int: 'INT', vit: 'VIT' };
  const ROWS = [['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF'], ['spd', 'SPD']];
  const GOLD = '#e3b661';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = () => R.state && R.state.p;
  const bal = () => R.data.balance || {};
  const ptsPer = () => +bal().ptsPerLvl || +bal().pts || 3;
  const isImg = s => typeof s === 'string' && (/^(data:|https?:|\.\/|\/)/.test(s) || /\.(png|webp|svg|jpg)$/.test(s));
  const house = () => { const h = (R.state && R.state.acc && R.state.acc.house) || (P() && P().house) || 'stark'; const d = (R.data.houses && R.data.houses[h]) || {}; const f = HFB[h] || HFB.stark;
    const sig = d.sigil || d.img || (window.A_SIGILS && window.A_SIGILS[h]) || (R.assets && R.assets.sigils && R.assets.sigils[h]) || null;
    return { id: h, n: d.n || d.name || f.n, e: d.e || f.e, col: d.col || f.col, col2: d.col2 || f.col2, sigil: isImg(sig) ? sig : null }; };

  /* ---- numbers: the player module's when it has them, the ARCH formulas otherwise ---- */
  const calc = (lvl, st, cls) => { st = st || {}; const b = bal(), main = st[MAIN[cls] || 'str'] || 0;
    return { hp: Math.round(typeof b.hp === 'function' ? b.hp(lvl, st, cls) : 120 + 18 * lvl + 6 * (st.vit || 0)),
      atk: Math.round(typeof b.atk === 'function' ? b.atk(lvl, st, cls) : 10 + 2 * lvl + 1.5 * main),
      def: Math.round(typeof b.def === 'function' ? b.def(lvl, st, cls) : 4 + 1.2 * lvl + 0.6 * (st.vit || 0)),
      spd: Math.round(typeof b.spd === 'function' ? b.spd(lvl, st, cls) : (R.player && R.player.spd) || 170) }; };
  const live = () => { const p = R.player; if (!p || p.hpMax == null || p.atk == null) return null;
    return { hp: Math.round(p.hpMax), atk: Math.round(p.atk), def: Math.round(p.def || 0), spd: Math.round(p.spd || 170) }; };
  const recalcFn = () => { const p = R.player; if (p && typeof p.recalc === 'function') return () => p.recalc(); if (p && typeof p.recalcStats === 'function') return () => p.recalcStats();
    if (R.sys.player && typeof R.sys.player.recalc === 'function') return () => R.sys.player.recalc(); if (typeof R.recalc === 'function') return () => R.recalc(); return null; };
  const snapNow = () => { const p = P(); if (!p) return null; return { lvl: p.lvl, stats: Object.assign({}, p.stats), nums: live() || calc(p.lvl, p.stats, p.cls) }; };
  let snap = null;                                   // the last quiet-second snapshot: the "before" of the next level-up
  const takeSnap = () => { if (!pend) snap = snapNow(); };
  const norm = o => o && { hp: Math.round(o.hp != null ? o.hp : o.hpMax), atk: Math.round(o.atk), def: Math.round(o.def || 0), spd: Math.round(o.spd || 170) };
  const before = () => { const p = P(); if (pend.before) return pend.before;
    const ls = R.player && R.player.lastStats; if (ls && ls.atk != null && (ls.lvl == null || ls.lvl < pend.to)) return norm(ls);
    const st = (snap && snap.lvl < pend.to) ? snap.stats : pend.stats0 || p.stats; return calc(pend.from, st, p.cls); };
  const after = () => { const p = P(); return (recalcFn() ? live() : null) || calc(p.lvl, p.stats, p.cls); };

  /* ---- skills: whatever shape R.data.skills has (array, id map, class map of arrays or maps) ---- */
  const skillList = () => { const S = R.data.skills; const out = []; if (!S) return out;
    const push = (s, k, cls) => { if (!s || typeof s !== 'object') return; const o = Object.assign({}, s); if (!o.id && k) o.id = k; if (!o.cls && !o.class && cls) o.cls = cls; out.push(o); };
    if (Array.isArray(S)) S.forEach(s => push(s)); else for (const k in S) { const v = S[k]; if (Array.isArray(v)) v.forEach(s => push(s, null, k));
      else if (v && typeof v === 'object' && v.id == null && v.name == null && v.n == null && Object.values(v).every(x => x && typeof x === 'object')) for (const j in v) push(v[j], j, k); else push(v, k); }
    return out; };
  const unlockOf = s => { const u = s.unlock != null ? s.unlock : s.lvl != null ? s.lvl : s.at != null ? s.at : s.level; return u == null ? null : +u; };
  const skillsAt = (from, to, cls) => skillList().filter(s => { const u = unlockOf(s), c = s.cls || s.class; return u != null && u > from && u <= to && (!c || c === cls); });
  const skName = s => s.name || s.n || s.id;
  const skLine = s => { let d = s.desc || s.d || s.txt || s.text || ''; if (typeof d === 'function') { try { d = d(s.v ? s.v[0] : 1, 1); } catch (e) { d = ''; } } return String(d || ''); };
  const skIcon = s => { const i = s.icon || s.img || s.e; if (isImg(i)) return '<img src="' + esc(i) + '" alt="">'; return '<i>' + esc(i || '✦') + '</i>'; };
  const barOf = () => { const p = P(); if (!Array.isArray(p.bar)) p.bar = [null, null, null]; while (p.bar.length < 3) p.bar.push(null); return p.bar; };
  const slotOf = id => barOf().indexOf(id);
  const assign = id => { const p = P(); if (!p) return -1; const bar = barOf(); let i = bar.indexOf(id); if (i >= 0) return i;
    i = bar.indexOf(null); if (i < 0) i = bar.indexOf(undefined); if (i < 0) i = bar.length - 1;
    p.skills = p.skills || {}; if (!p.skills[id]) p.skills[id] = 1;
    const S = R.skills; let done = false;
    for (const f of ['assign', 'equip', 'setSlot', 'setBar']) if (S && typeof S[f] === 'function') { try { S[f](id, i); done = true; } catch (e) {} break; }
    if (!done || barOf().indexOf(id) < 0) bar[i] = id;
    R.bus.emit('bar', barOf()); R.save(); return i; };

  /* ---- points ---- */
  const autoPlan = n => { const p = P(), main = MAIN[p.cls] || 'str', plan = { str: 0, agi: 0, int: 0, vit: 0 }; for (let i = 0; i < n; i++) plan[i % 3 === 2 ? 'vit' : main]++; return plan; };
  const recalc = () => { const f = recalcFn(); if (f) { try { f(); } catch (e) {} } R.bus.emit('stats', P() && P().stats); };
  const spend = k => { const p = P(); if (!p || STATS.indexOf(k) < 0 || !(p.pts > 0)) return false; p.stats = p.stats || {}; p.stats[k] = (p.stats[k] || 0) + 1; p.pts--; recalc(); R.save(); return true; };
  const manual = () => !!(R.state && R.state.opts && R.state.opts.manualPts);
  const applyAuto = () => { const p = P(); if (!p || !(p.pts > 0)) return; const plan = autoPlan(p.pts); pend.autoLog = pend.autoLog || { str: 0, agi: 0, int: 0, vit: 0 };
    for (const k of STATS) { p.stats[k] = (p.stats[k] || 0) + plan[k]; pend.autoLog[k] += plan[k]; } p.pts = 0; recalc(); R.save(); };
  const undoAuto = () => { const p = P(), log = pend && pend.autoLog; if (!p || !log) return; let n = 0; for (const k of STATS) { p.stats[k] -= log[k]; n += log[k]; log[k] = 0; } p.pts += n; recalc(); R.save(); };
  const setAuto = on => { if (!R.state) return; R.state.opts = R.state.opts || {}; R.state.opts.manualPts = on ? 0 : 1; if (on) applyAuto(); else undoAuto(); R.save(); render(); };

  /* ---- the flash in the world ---- */
  const haptic = kind => { try { const o = R.state && R.state.opts; if (o && o.haptic === 0) return; const H = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback; if (!H) return; kind === 'tap' ? H.impactOccurred('light') : H.notificationOccurred('success'); } catch (e) {} };
  const flash = lvl => { const pl = R.player; if (pl && R.fx) { if (typeof R.fx.spawn === 'function') R.fx.spawn('levelup', pl.x, pl.y, { lvl }); if (typeof R.fx.num === 'function') R.fx.num(pl.x, pl.y - 44, 'LEVEL ' + lvl, GOLD, true); }
    if (R.sfx && typeof R.sfx.play === 'function') R.sfx.play('levelup', 1); haptic('ok'); };
  const storyLine = lvl => { const p = P(), s = R.data.story && R.data.story.levelup; if (!s) return ''; try {
    if (typeof s === 'function') return s(lvl, p) || ''; if (Array.isArray(s)) return s.length ? s[(lvl - 1) % s.length] : '';
    if (typeof s === 'object') return s[lvl] || s[String(lvl)] || s.any || s.default || ''; return String(s); } catch (e) { return ''; } };

  /* ---- queue: one card for every level-up that arrives while it is pending or open ---- */
  let pend = null, timer = 0, waitClose = false, root = null;
  const tryOpen = () => { timer = 0; if (!pend || !P()) return; if (R.ui.cur === 'levelup') { render(); return; } if (R.ui.cur) { waitClose = true; return; } R.ui.open('levelup', pend.to); };
  R.bus.on('levelup', lvl => { const p = P(); if (!p) return; lvl = +lvl || p.lvl;
    if (!pend) pend = { from: snap && snap.lvl < lvl ? snap.lvl : lvl - 1, to: lvl, before: snap && snap.lvl < lvl ? snap.nums : null, stats0: snap && snap.lvl < lvl ? snap.stats : Object.assign({}, p.stats), autoLog: null, opened: false };
    pend.to = Math.max(pend.to, lvl); flash(lvl);
    if (R.ui.cur === 'levelup') { if (!manual()) applyAuto(); render(); return; }
    if (!timer) timer = setTimeout(tryOpen, 650); });
  R.bus.on('tick1s', takeSnap);
  R.bus.on('screen', name => { if (name === null && waitClose && pend) { waitClose = false; setTimeout(tryOpen, 150); } });

  /* ---- render ---- */
  const burst = () => { let s = ''; for (let i = 0; i < 30; i++) { const a = Math.round(i * 12 + Math.random() * 12), d = Math.round(60 + Math.random() * 90), t = (0.9 + Math.random() * 0.8).toFixed(2), dl = (Math.random() * 1.6).toFixed(2), c = ['#ffd98a', '#e3b661', '#fff3cf', '#f2a62c'][i % 4], sz = 4 + (i % 3) * 2;
    s += '<i style="--a:' + a + 'deg;--d:' + d + 'px;--t:' + t + 's;--dl:' + dl + 's;--c:' + c + ';width:' + sz + 'px;height:' + sz + 'px"></i>'; } return s; };
  const render = () => { if (!root || !pend || !P()) return; const p = P(), H = house(), B = before(), A = after(), pts = p.pts | 0, auto = !manual(), log = pend.autoLog || {};
    const sks = skillsAt(pend.from, pend.to, p.cls), line = storyLine(pend.to), gained = (pend.to - pend.from) * ptsPer();
    const rows = ROWS.map(([k, n]) => { const d = (A[k] | 0) - (B[k] | 0); return '<tr><td class="k">' + n + '</td><td class="b">' + B[k] + '</td><td class="ar">→</td><td class="a">' + A[k] + '</td><td class="d' + (d > 0 ? ' up' : d < 0 ? ' dn' : '') + '">' + (d > 0 ? '+' + d : d < 0 ? d : '—') + '</td></tr>'; }).join('');
    const skHtml = sks.map(s => { const i = slotOf(s.id); return '<div class="sk" data-sk="' + esc(s.id) + '"><span class="ic">' + skIcon(s) + '</span><span class="tx"><small class="tag">NEW SKILL</small><b>' + esc(skName(s)) + '</b><small>' + esc(skLine(s)) + '</small></span>' +
      '<button class="slot' + (i >= 0 ? ' in' : '') + '" data-slot="' + esc(s.id) + '"' + (i >= 0 ? ' disabled' : '') + '>' + (i >= 0 ? 'IN SLOT ' + (i + 1) + ' ✓' : 'PUT IN SLOT') + '</button></div>'; }).join('');
    const pb = STATS.map(k => { const add = auto ? (log[k] || 0) : 0, main = k === (MAIN[p.cls] || 'str'); return '<button class="pb' + (main ? ' main' : '') + '" data-k="' + k + '"' + (auto || pts <= 0 ? ' disabled' : '') + '><span class="k">' + SNAME[k] + '</span><span class="v">' + (p.stats[k] | 0) + '</span><span class="p">' + (auto ? (add ? '+' + add : '·') : '+') + '</span></button>'; }).join('');
    const ptsTxt = auto ? (gained ? gained + ' POINT' + (gained > 1 ? 'S' : '') + ' · BY CLASS' : 'POINTS BY CLASS') : pts + ' POINT' + (pts !== 1 ? 'S' : '') + ' TO SPEND';
    root.innerHTML = '<div class="lvup" style="--acc:' + H.col + ';--acc2:' + H.col2 + '"><div class="lv-l">' +
      '<div class="hd"><span class="ring"></span><span class="burst">' + burst() + '</span><span class="k">LEVEL UP</span><span class="n">' + pend.to + '</span></div>' +
      '<div class="sig" title="' + esc(H.n) + '">' + (H.sigil ? '<img src="' + esc(H.sigil) + '" alt="">' : '<span>' + esc(H.e) + '</span>') + '</div>' +
      '<div class="who">' + esc(p.name || 'You') + ' · ' + esc(H.n) + ' · ' + esc((p.cls || 'knight').toUpperCase()) + '</div>' +
      (line ? '<p class="say">' + esc(line) + '</p>' : '') + '</div><div class="lv-r">' +
      '<div class="st"><table>' + rows + '</table></div>' + skHtml +
      '<div class="pts"><div class="h"><span class="t">' + ptsTxt + '</span><button class="auto' + (auto ? ' on' : '') + '">AUTO</button></div><div class="g">' + pb + '</div></div>' +
      '<button class="pri go">CONTINUE</button></div></div>'; };
  const onTap = ev => { const b = ev.target.closest('button'); if (!b || !root || !root.contains(b)) return;
    if (b.classList.contains('go')) { haptic('tap'); R.ui.close(); return; }
    if (b.classList.contains('auto')) { haptic('tap'); setAuto(!b.classList.contains('on')); return; }
    if (b.dataset.k) { if (spend(b.dataset.k)) { haptic('tap'); if (R.sfx && R.sfx.play) R.sfx.play('ui', 0.6); render(); } return; }
    if (b.dataset.slot) { assign(b.dataset.slot); haptic('tap'); if (R.sfx && R.sfx.play) R.sfx.play('ui', 0.8); render(); } };

  R.screens.levelup = { live: false,
    open: (arg, el) => { const p = P(); if (!p) return; const lvl = +arg || p.lvl; if (!pend) pend = { from: lvl - 1, to: lvl, before: snap && snap.lvl < lvl ? snap.nums : null, stats0: Object.assign({}, p.stats), autoLog: null, opened: false };
      pend.to = Math.max(pend.to, lvl); root = el || document.getElementById('screen'); if (!pend.opened) { pend.opened = true; if (!manual()) applyAuto(); }
      root.addEventListener('click', onTap); render(); if (timer) { clearTimeout(timer); timer = 0; } },
    close: () => { if (root) root.removeEventListener('click', onTap); const done = pend && pend.to; root = null; pend = null; waitClose = false; snap = snapNow(); R.save(); if (done) R.bus.emit('levelup:done', done); } };
  R.levelup = { skillsAt, calc, spend, assign, auto: setAuto, pending: () => pend, before, after };
})();
