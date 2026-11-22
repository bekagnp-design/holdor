/* HOLDOR RPG — A02 input: a floating joystick on the left half, camera look on the right half, action buttons, keyboard, haptics.
   API (R.input):
     move {x,y}      unit-ish vector, |move| <= 1, SCREEN axes (up = camera-forward; the player module turns it by R.cam.yaw). Joystick when held, else WASD/arrows.
     aim  {x,y}      last non-zero move direction (unit).
     active          true while a finger holds the joystick.
     look {dx,dy}    screen px dragged on the right half (not on a button) since the last step; snapshot per step, 0 when idle. Keys Q/E add -6/+6 to dx per step while held.
     pinch           two-finger pinch anywhere on the right half: scale factor since the last step (>1 = fingers apart), 1 when idle. Mouse wheel too.
     pressed(name)   true for the step in which the button went down (cleared at the end of R.step: sys 'input' order 999 + 'step:end').
     down(name)      true while held.      names: attack dodge skill1 skill2 skill3 potion interact sprint map inv menu quests chat
     interact        set {label, icon?, fn?} to show the INTERACT pill, null to hide (polled every step; setInteract() applies at once).
     setCooldown(i, frac)  i = 0..2 (bar index), frac = cooldown remaining 0..1 (1 = just used) → the conic ring.
     setSkill(i, {label, icon, key, col})  caption / icon of a skill button.   setPotions(n)  the badge.   mark(name, bool)  a red dot on map/inv/menu.
     show(bool), reset(), btn(name) → element, el → #ctl root.
   Keyboard: WASD/arrows move, J attack, K dodge, 1/2/3 skills, R potion, F interact, Q/E rotate, Shift sprint, Esc menu, M map, I inv, L quests, C chat.
   Events: R.bus.emit('btn', name, src)  src = 'btn' | 'key'.   R.haptic(kind): light|medium|heavy|rigid|soft | success|warning|error | select. */
(function () {
  const ui = document.getElementById('ui'); if (!ui || !window.R) return;
  const DEAD = 10, RAD = 56, KEYROT = 6;
  const I = R.input = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, active: false, look: { dx: 0, dy: 0 }, pinch: 1, interact: null, enabled: true, DEAD, RAD };
  const dn = {}, pr = {}; I.down = n => !!dn[n]; I.pressed = n => !!pr[n];
  I.names = ['attack', 'dodge', 'skill1', 'skill2', 'skill3', 'potion', 'interact', 'sprint', 'map', 'inv', 'menu', 'quests', 'chat'];
  const UIB = { map: 1, inv: 1, menu: 1, quests: 1, chat: 1 };          // allowed while a screen is open (toggles)
  /* ---- haptics ---- */
  let hapT = 0;
  I.haptic = kind => { try { const o = R.state && R.state.opts; if (o && !o.haptic) return false;
    const tg = window.Telegram && window.Telegram.WebApp, H = tg && tg.HapticFeedback; if (!H) return false;
    const now = performance.now(); if (now - hapT < 40) return false; hapT = now;
    if (kind === 'success' || kind === 'warning' || kind === 'error') H.notificationOccurred(kind);
    else if (kind === 'select' || kind === 'selection') H.selectionChanged();
    else H.impactOccurred(kind || 'light'); return true; } catch (e) { return false; } };
  if (!R.haptic) R.haptic = I.haptic;
  /* ---- DOM ---- */
  const SVG = {
    sword: '<svg viewBox="0 0 24 24"><path d="M14.5 3.5 20.5 9.5 11 19l-4 1 1-4z"/><path d="M14.5 3.5l-1.5 3M3.5 20.5l4-4"/><path d="M16 12l3 3"/></svg>',
    dodge: '<svg viewBox="0 0 24 24"><path d="M10 5l7 7-7 7"/><path d="M3 9h3M3 12h5M3 15h3"/></svg>',
    potion: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v5l-5.2 8.3A3 3 0 0 0 7.3 21h9.4a3 3 0 0 0 2.5-4.7L14 8V3"/><path d="M7 16h10"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M4.5 8h15l-1.3 12H5.8z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/><path d="M8 12h8"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    talk: '<svg viewBox="0 0 24 24"><path d="M4 5h16v10H10l-6 4z"/></svg>' };
  const root = document.createElement('div'); root.id = 'ctl';
  root.innerHTML =
    '<div id="joyzone"></div><div id="lookzone"></div><div id="joy-rest"></div><div id="joy"><div id="joy-knob"></div></div>' +
    '<button class="cb sk" id="b-sk1" data-b="skill1" aria-label="Skill 1"><span class="key">1</span><span class="ic"></span><span class="lb"></span></button>' +
    '<button class="cb sk" id="b-sk2" data-b="skill2" aria-label="Skill 2"><span class="key">2</span><span class="ic"></span><span class="lb"></span></button>' +
    '<button class="cb sk" id="b-sk3" data-b="skill3" aria-label="Skill 3"><span class="key">3</span><span class="ic"></span><span class="lb"></span></button>' +
    '<button class="cb" id="b-potion" data-b="potion" aria-label="Potion">' + SVG.potion + '<span class="badge">0</span><span class="kh">R</span></button>' +
    '<button class="cb" id="b-dodge" data-b="dodge" aria-label="Dodge">' + SVG.dodge + '<span class="kh">K</span></button>' +
    '<button class="cb" id="b-attack" data-b="attack" aria-label="Attack">' + SVG.sword + '<span class="kh">J</span></button>' +
    '<button id="b-interact" data-b="interact" aria-label="Interact"><span class="ic">' + SVG.talk + '</span><span class="lb">INTERACT</span></button>' +
    '<div id="ctl-top"><button class="ib" id="b-map" data-b="map" aria-label="Map">' + SVG.map + '<i class="dot"></i></button>' +
    '<button class="ib" id="b-inv" data-b="inv" aria-label="Bag">' + SVG.bag + '<i class="dot"></i></button>' +
    '<button class="ib" id="b-menu" data-b="menu" aria-label="Menu">' + SVG.menu + '<i class="dot"></i></button></div>';
  ui.appendChild(root);
  root.addEventListener('contextmenu', e => e.preventDefault());
  const $ = id => root.querySelector('#' + id);
  const zone = $('joyzone'), lzone = $('lookzone'), rest = $('joy-rest'), joy = $('joy'), knob = $('joy-knob'), inter = $('b-interact');
  const sk = [$('b-sk1'), $('b-sk2'), $('b-sk3')], pot = $('b-potion');
  const btns = {}; root.querySelectorAll('[data-b]').forEach(b => { btns[b.dataset.b] = b; });
  I.el = root; I.btn = n => btns[n] || null;
  const screenOpen = () => !!(R.ui && R.ui.cur);
  const hidden = () => root.classList.contains('hid') || root.classList.contains('off');
  /* ---- press / release ---- */
  const HAP = { attack: 'light', dodge: 'medium', skill1: 'light', skill2: 'light', skill3: 'light', potion: 'rigid', interact: 'light', map: 'select', inv: 'select', menu: 'select' };
  const press = (n, src) => {
    if (!I.enabled) return false; if (screenOpen() && !UIB[n]) return false;
    pr[n] = true; dn[n] = true;
    if (src === 'btn') I.haptic(HAP[n] || 'light');
    if (n === 'interact' && I.interact && typeof I.interact.fn === 'function') { try { I.interact.fn(I.interact); } catch (e) { console.error('interact', e); } }
    R.bus.emit('btn', n, src); return true; };
  const release = n => { dn[n] = false; };
  for (const n in btns) {
    const el = btns[n]; el._pid = null;
    el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; if (el._pid !== null) return; e.preventDefault(); e.stopPropagation();
      el._pid = e.pointerId; if (e.pointerType === 'mouse') { try { el.setPointerCapture(e.pointerId); } catch (x) {} }
      el.classList.add('dn'); press(n, 'btn'); });
    const up = e => { if (el._pid === null || e.pointerId !== el._pid) return; el._pid = null; el.classList.remove('dn'); release(n); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
  /* ---- joystick (left half) ---- */
  let jid = null, jx = 0, jy = 0, keyMove = { x: 0, y: 0 };
  const setMove = (x, y) => { I.move.x = x; I.move.y = y; const l = Math.hypot(x, y); if (l > 0.001) { I.aim.x = x / l; I.aim.y = y / l; } };
  const recompute = () => { if (jid === null) setMove(keyMove.x, keyMove.y); };
  const place = () => { joy.style.transform = 'translate(' + jx.toFixed(1) + 'px,' + jy.toFixed(1) + 'px)'; };
  const isFree = t => t === zone || t === lzone || t === ui || t === R.cv || (t && (t.id === 'c' || t.id === 'gl' || t.id === 'app'));
  const joyStart = e => { jid = e.pointerId; jx = e.clientX; jy = e.clientY; I.active = true; place(); knob.style.transform = 'translate(0,0)'; joy.classList.add('on'); rest.classList.add('off'); setMove(0, 0); };
  const joyMove = e => { let dx = e.clientX - jx, dy = e.clientY - jy, d = Math.hypot(dx, dy);
    if (d > RAD) { const k = (d - RAD) / d; jx += dx * k; jy += dy * k; dx -= dx * k; dy -= dy * k; d = RAD; place(); }   // the base follows the thumb
    knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    if (d < DEAD) setMove(0, 0); else { const m = Math.min(1, (d - DEAD) / (RAD - DEAD)); setMove(dx / d * m, dy / d * m); } };
  const joyEnd = () => { if (jid === null) return; jid = null; I.active = false; joy.classList.remove('on'); rest.classList.remove('off'); recompute(); };
  /* ---- camera look + pinch (right half, free touches) ---- */
  const acc = { dx: 0, dy: 0, pinch: 1 }; const looks = [];                    // accumulated between steps; published by the pre-step system
  const lookStart = e => { looks.push({ id: e.pointerId, x: e.clientX, y: e.clientY }); };
  const lookMove = e => { const p = looks.find(q => q.id === e.pointerId); if (!p) return;
    if (looks.length >= 2 && (looks[0] === p || looks[1] === p)) { const o = looks[0] === p ? looks[1] : looks[0]; const d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y); if (d0 > 4 && d1 > 4) acc.pinch *= d1 / d0; }
    else if (looks.length === 1) { acc.dx += e.clientX - p.x; acc.dy += e.clientY - p.y; }
    p.x = e.clientX; p.y = e.clientY; };
  const lookEnd = id => { const i = looks.findIndex(q => q.id === id); if (i >= 0) looks.splice(i, 1); };
  window.addEventListener('wheel', e => { if (hidden() || screenOpen()) return; acc.pinch *= Math.exp(-e.deltaY * 0.0015); }, { passive: true });
  /* ---- pointer routing ---- */
  document.addEventListener('pointerdown', e => { if (!I.enabled || hidden() || screenOpen()) return; if (e.pointerType === 'mouse' && e.button !== 0) return; if (!isFree(e.target)) return;
    const left = e.clientX < window.innerWidth / 2;
    if (left) { if (jid !== null) return; e.preventDefault(); if (e.pointerType === 'mouse') { try { zone.setPointerCapture(e.pointerId); } catch (x) {} } joyStart(e); }
    else { e.preventDefault(); if (e.pointerType === 'mouse') { try { lzone.setPointerCapture(e.pointerId); } catch (x) {} } lookStart(e); } }, { passive: false });
  window.addEventListener('pointermove', e => { if (jid !== null && e.pointerId === jid) joyMove(e); else lookMove(e); });
  const anyEnd = e => { if (jid !== null && e.pointerId === jid) joyEnd(); else lookEnd(e.pointerId); };
  window.addEventListener('pointerup', anyEnd); window.addEventListener('pointercancel', anyEnd);
  /* ---- keyboard ---- */
  const KEYS = { KeyJ: 'attack', KeyK: 'dodge', Digit1: 'skill1', Digit2: 'skill2', Digit3: 'skill3', Numpad1: 'skill1', Numpad2: 'skill2', Numpad3: 'skill3', KeyR: 'potion', KeyF: 'interact', Escape: 'menu', KeyM: 'map', KeyI: 'inv', KeyL: 'quests', KeyC: 'chat', ShiftLeft: 'sprint', ShiftRight: 'sprint' };
  const MV = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const ROT = { KeyQ: -KEYROT, KeyE: KEYROT };
  const BYKEY = { j: 'KeyJ', k: 'KeyK', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3', r: 'KeyR', f: 'KeyF', q: 'KeyQ', e: 'KeyE', m: 'KeyM', i: 'KeyI', l: 'KeyL', c: 'KeyC', w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', escape: 'Escape', shift: 'ShiftLeft' };
  const held = {};
  const code = e => e.code || BYKEY[(e.key || '').toLowerCase()] || '';
  const typing = e => { const t = e.target; return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)); };
  const kbVec = () => { let x = 0, y = 0; for (const c in held) if (held[c] && MV[c]) { x += MV[c][0]; y += MV[c][1]; } const l = Math.hypot(x, y); keyMove = l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 }; recompute(); };
  const kbRot = () => { let r = 0; for (const c in ROT) if (held[c]) r += ROT[c]; return r; };
  window.addEventListener('keydown', e => { if (typing(e)) return; const c = code(e); if (!c) return;
    if (MV[c] || ROT[c]) { e.preventDefault(); if (!held[c]) { held[c] = 1; root.classList.add('kb'); if (MV[c]) kbVec(); } return; }
    const n = KEYS[c]; if (!n) return; e.preventDefault(); root.classList.add('kb'); if (e.repeat || held[c]) return; held[c] = 1; press(n, 'key'); });
  window.addEventListener('keyup', e => { const c = code(e); if (!c || !held[c]) return; held[c] = 0; if (MV[c]) { kbVec(); return; } if (ROT[c]) return; const n = KEYS[c]; if (n) release(n); });
  /* ---- reset / visibility ---- */
  I.reset = () => { joyEnd(); looks.length = 0; acc.dx = acc.dy = 0; acc.pinch = 1; I.look.dx = I.look.dy = 0; I.pinch = 1;
    for (const k in dn) dn[k] = false; for (const k in pr) pr[k] = false; for (const c in held) held[c] = 0; keyMove = { x: 0, y: 0 }; setMove(0, 0);
    for (const n in btns) { btns[n]._pid = null; btns[n].classList.remove('dn'); } };
  I.show = v => { root.classList.toggle('off', !v); if (!v) I.reset(); };
  R.bus.on('screen', name => { root.classList.toggle('hid', !!name); if (name) I.reset(); });
  if (screenOpen()) root.classList.add('hid');
  window.addEventListener('blur', I.reset); document.addEventListener('visibilitychange', () => { if (document.hidden) I.reset(); });
  /* ---- setters for other modules ---- */
  I.setCooldown = (i, frac) => { const el = sk[i]; if (!el) return; frac = frac > 1 ? 1 : frac > 0 ? frac : 0; el.style.setProperty('--cd', frac.toFixed(3)); el.classList.toggle('cd', frac > 0.001); };
  I.setSkill = (i, o) => { const el = sk[i]; if (!el) return; o = o || {}; el.querySelector('.lb').textContent = o.label || ''; el.querySelector('.ic').innerHTML = o.icon || ''; if (o.key) el.querySelector('.key').textContent = o.key; if (o.col) el.style.setProperty('--cbb', o.col); el.classList.toggle('empty', !o.label && !o.icon); };
  I.setPotions = n => { n = Math.max(0, n | 0); pot.querySelector('.badge').textContent = n; pot.classList.toggle('empty', n === 0); };
  I.mark = (n, v) => { const el = btns[n]; if (el) el.classList.toggle('mark', !!v); };
  let curInt = null;
  const applyInteract = o => { curInt = o; if (o) { inter.querySelector('.lb').textContent = (o.label || 'INTERACT') + ''; inter.querySelector('.ic').innerHTML = o.icon || SVG.talk; inter.classList.add('on'); } else { inter.classList.remove('on'); inter.classList.remove('dn'); inter._pid = null; dn.interact = false; } };
  I.setInteract = o => { I.interact = o || null; applyInteract(I.interact); };
  const poll = () => { if (I.interact !== curInt) applyInteract(I.interact || null); else if (curInt && inter.querySelector('.lb').textContent !== (curInt.label || 'INTERACT') + '') applyInteract(curInt); };
  /* ---- step hooks: look/pinch are a per-step snapshot (published before every system), pressed() lasts one step ---- */
  const preStep = () => { I.look.dx = acc.dx + kbRot(); I.look.dy = acc.dy; I.pinch = acc.pinch; acc.dx = acc.dy = 0; acc.pinch = 1; };
  const endStep = () => { for (const k in pr) pr[k] = false; };
  R.bus.on('step:end', endStep);                                            // if core emits it too: clearing twice is harmless
  const pre = { order: -1000, update: preStep };
  const post = { order: 999, update: () => { poll(); endStep(); } };
  if (R.addSys) { R.addSys('input_pre', pre); R.addSys('input', post); } else { pre.name = 'input_pre'; post.name = 'input'; R.sys.input_pre = pre; R.sys.input = post; if (R.sysList) R.sysList.push(pre, post); }
  I.setPotions(R.state && R.state.p && R.state.p.potions ? R.state.p.potions.hp : 0);
})();
