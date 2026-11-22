/* HOLDOR RPG core — the one global R. (stub by the integrator; agent A01 completes it, keeping every name here) */
window.R = window.R || {};
(function () {
  R.VERSION = '2.0.0';
  R.data = R.data || {}; R.sys = R.sys || {}; R.sysList = []; R.screens = R.screens || {}; R.ents = []; R.t = 0; R.dt = 1 / 60; R.running = false;
  R.cam = { x: 0, y: 0, z: 1 }; R.W = 7200; R.H = 12288; R.SCALE = 6;
  const L = {};
  R.bus = { on: (e, f) => ((L[e] = L[e] || []).push(f), f), off: (e, f) => { L[e] = (L[e] || []).filter(x => x !== f); },
    emit: (e, ...a) => { for (const f of (L[e] || []).slice()) { try { f(...a); } catch (x) { console.error(e, x); } } } };
  R.addSys = (name, s) => { s.name = name; R.sys[name] = s; R.sysList = Object.values(R.sys).sort((a, b) => (a.order || 0) - (b.order || 0)); return s; };
  let nid = 1;
  R.spawn = e => { e.id = nid++; e.x = e.x || 0; e.y = e.y || 0; e.r = e.r || 14; e.face = e.face || 1; e.team = e.team == null ? 1 : e.team; e.hpMax = e.hpMax || e.hp || 1; e.hp = e.hp == null ? e.hpMax : e.hp; e.cd = e.cd || {}; e.status = e.status || {}; e.anim = e.anim || 'idle'; e.animT = 0; R.ents.push(e); R.bus.emit('spawn', e); return e; };
  R.kill = e => { if (e.dead) return; e.dead = true; e.anim = 'die'; e.animT = 0; if (e.kind === 'mob' || e.kind === 'boss') R.bus.emit('kill', e, e.lastHitBy); };
  R.remove = e => { const i = R.ents.indexOf(e); if (i >= 0) R.ents.splice(i, 1); };
  R.find = fn => R.ents.find(fn); R.near = (x, y, r, f) => R.ents.filter(e => !e.dead && (!f || f(e)) && (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r);
  R.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  R.w2s = (x, y) => ({ x: (x - R.cam.x) * R.cam.z + R.vw / 2, y: (y - R.cam.y) * R.cam.z + R.vh / 2 });
  R.s2w = (x, y) => ({ x: (x - R.vw / 2) / R.cam.z + R.cam.x, y: (y - R.vh / 2) / R.cam.z + R.cam.y });
  let seed = 1234567; R.rng = s => { if (s != null) seed = s >>> 0 || 1; seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  R.clamp = (v, a, b) => v < a ? a : v > b ? b : v; R.lerp = (a, b, k) => a + (b - a) * k;
  /* ---- save ---- */
  R.state = null;
  R.newState = () => ({ v: 1, p: { name: '', house: 'stark', cls: 'knight', lvl: 1, xp: 0, hp: 0, gold: 0, gems: 0, pos: null, stats: { str: 5, agi: 5, int: 5, vit: 5 }, pts: 0, skills: {}, bar: [null, null, null], gear: {}, inv: [], potions: { hp: 3, mana: 0 }, comps: [], champs: {}, quests: {}, flags: {}, found: [], killed: {}, bosses: {}, ach: [], title: '', created: Date.now(), played: 0 }, wallet: { imported: false }, opts: { sfx: 1, haptic: 1, lang: 'en' } });
  let saveT = 0;
  R.save = now => { if (!R.state) return; if (!now) { if (saveT) return; saveT = setTimeout(() => { saveT = 0; R.save(true); }, 800); return; }
    try { if (R.player) R.state.p.pos = { x: Math.round(R.player.x), y: Math.round(R.player.y) }; localStorage.setItem('holdor_rpg', JSON.stringify(R.state)); } catch (e) {}
    R.bus.emit('save'); if (R.net && R.net.on && R.net.save) R.net.save(); };
  R.load = () => { try { const s = JSON.parse(localStorage.getItem('holdor_rpg') || 'null'); if (s && s.p) { R.state = s; return true; } } catch (e) {} return false; };
  /* ---- ui shell ---- */
  const scr = () => document.getElementById('screen');
  R.ui = { cur: null,
    open: (name, arg) => { const S = R.screens[name]; if (!S) { console.warn('no screen', name); return; } if (R.ui.cur && R.ui.cur !== name) R.ui.close(); R.ui.cur = name; const el = scr(); el.innerHTML = ''; el.classList.add('on'); el.dataset.screen = name; S.open(arg, el); R.paused = !S.live; R.bus.emit('screen', name); },
    close: () => { const name = R.ui.cur; if (!name) return; const S = R.screens[name]; try { S && S.close && S.close(); } catch (e) {} const el = scr(); el.classList.remove('on'); el.innerHTML = ''; delete el.dataset.screen; R.ui.cur = null; R.paused = false; R.bus.emit('screen', null); },
    toast: (txt, col) => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = txt; if (col) d.style.color = col; document.getElementById('ui').appendChild(d); setTimeout(() => d.remove(), 2200); },
    el: id => document.getElementById(id) };
  /* ---- loop ---- */
  const cv = document.getElementById('c'); const ctx = cv.getContext('2d'); R.cv = cv; R.ctx = ctx; R.vw = 390; R.vh = 844; R.dpr = 1;
  R.resize = () => { R.dpr = Math.min(2, window.devicePixelRatio || 1); R.vw = window.innerWidth; R.vh = window.innerHeight; cv.width = Math.round(R.vw * R.dpr); cv.height = Math.round(R.vh * R.dpr); };
  window.addEventListener('resize', R.resize); R.resize();
  R.step = () => { const dt = R.dt; R.t += dt; for (const s of R.sysList) if (s.update) { try { s.update(dt); } catch (e) { console.error(s.name, e); } } for (const e of R.ents) e.animT += dt; if (Math.floor(R.t) !== Math.floor(R.t - dt)) R.bus.emit('tick1s'); };
  R.drawAll = () => { ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); for (const s of R.sysList) if (s.draw) { try { s.draw(ctx); } catch (e) { console.error(s.name, e); } } };
  let acc = 0, last = 0, raf = 0;
  const frame = now => { raf = requestAnimationFrame(frame); if (!R.running) return; if (!last) last = now; let d = Math.min(0.1, (now - last) / 1000); last = now; if (R.paused) { R.drawAll(); return; } acc += d; let n = 0; while (acc >= R.dt && n++ < 6) { R.step(); acc -= R.dt; } R.drawAll(); };
  R.start = () => { if (!R.running) { R.running = true; last = 0; if (!raf) raf = requestAnimationFrame(frame); } };
  R.stop = () => { R.running = false; };
  window.addEventListener('error', ev => { const el = document.getElementById('err'); if (el) { el.style.display = 'block'; el.textContent = (ev.message || ev.error) + ''; } });
})();
