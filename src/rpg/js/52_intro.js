/* 52_intro.js — the first two minutes (A27, Addendum 2): title → house → hero (one of the house's champions) → prologue → the world.
   R.screens.intro (and R.screens.title = the same screen's step 1). Reads A_CHAMP.list / A_CHAMP.art / R.data.champs, R.data.houses or
   A_CHAMP.houses, R.data.story.prologue, R.assets.map, R.world.startPos, R.newState(house), R.newHero, R.enterWorld — all optional.
   Test hooks: R.intro = {step, house, hero, go(step), lines, heroes(house), houses()}. */
(function () {
  const ORDER = ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'];
  const FH = { // the old game's table, used when no data module gives one
    stark: { n: 'Stark', e: '🐺', words: 'Winter is coming', col: '#a9bdd0', col2: '#3b4a5a', seat: 'Winterfell' },
    lannister: { n: 'Lannister', e: '🦁', words: 'Hear me roar', col: '#e3b661', col2: '#7a1d1d', seat: 'Casterly Rock' },
    baratheon: { n: 'Baratheon', e: '🦌', words: 'Ours is the fury', col: '#e0c14a', col2: '#23231f', seat: "Storm's End" },
    targaryen: { n: 'Targaryen', e: '🐉', words: 'Fire and blood', col: '#e14b4b', col2: '#1c1c1c', seat: 'Dragonstone' },
    greyjoy: { n: 'Greyjoy', e: '🦑', words: 'We do not sow', col: '#d8b74a', col2: '#1f2a30', seat: 'Pyke' },
    tyrell: { n: 'Tyrell', e: '🌹', words: 'Growing strong', col: '#7fd06a', col2: '#2f5a2a', seat: 'Highgarden' },
    martell: { n: 'Martell', e: '☀️', words: 'Unbowed, unbent, unbroken', col: '#f08a3c', col2: '#7a2a1a', seat: 'Sunspear' } };
  /* the 49 champions as the old game lists them (id, house, name, emoji, type) — the first row of a house is its first hero */
  const FCH = [['jon', 'stark', 'Jon Snow', '🗡️', 'melee'], ['arya', 'stark', 'Arya Stark', '🎭', 'melee'], ['sansa', 'stark', 'Sansa Stark', '👑', 'caster'], ['bran', 'stark', 'Bran Stark', '👁️', 'caster'], ['robb', 'stark', 'Robb Stark', '🐺', 'melee'], ['ned', 'stark', 'Eddard Stark', '⚖️', 'melee'], ['brienne', 'stark', 'Brienne of Tarth', '🛡️', 'melee'],
    ['jaime', 'lannister', 'Jaime Lannister', '⚔️', 'melee'], ['tyrion', 'lannister', 'Tyrion Lannister', '🍷', 'caster'], ['cersei', 'lannister', 'Cersei Lannister', '👑', 'caster'], ['tywin', 'lannister', 'Tywin Lannister', '🦁', 'caster'], ['bronn', 'lannister', 'Bronn', '🏹', 'ranged'], ['gregor', 'lannister', 'The Mountain', '🔨', 'melee'], ['kevan', 'lannister', 'Kevan Lannister', '🚩', 'melee'],
    ['stannis', 'baratheon', 'Stannis Baratheon', '🔥', 'melee'], ['robert', 'baratheon', 'Robert Baratheon', '🔨', 'melee'], ['renly', 'baratheon', 'Renly Baratheon', '🌈', 'caster'], ['davos', 'baratheon', 'Davos Seaworth', '🧅', 'ranged'], ['melisandre', 'baratheon', 'Melisandre', '🕯️', 'caster'], ['gendry', 'baratheon', 'Gendry', '⚒️', 'melee'], ['barristan', 'baratheon', 'Barristan Selmy', '🛡️', 'melee'],
    ['dany', 'targaryen', 'Daenerys', '🐉', 'caster'], ['jorah', 'targaryen', 'Jorah Mormont', '🐻', 'melee'], ['greyworm', 'targaryen', 'Grey Worm', '🔱', 'melee'], ['missandei', 'targaryen', 'Missandei', '📜', 'caster'], ['daario', 'targaryen', 'Daario Naharis', '🗡️', 'melee'], ['drogo', 'targaryen', 'Khal Drogo', '🐎', 'melee'], ['viserys', 'targaryen', 'Viserys', '🪙', 'caster'],
    ['theon', 'greyjoy', 'Theon Greyjoy', '🏹', 'ranged'], ['yara', 'greyjoy', 'Yara Greyjoy', '⚓', 'melee'], ['euron', 'greyjoy', 'Euron Greyjoy', '🌊', 'caster'], ['balon', 'greyjoy', 'Balon Greyjoy', '🪙', 'caster'], ['victarion', 'greyjoy', 'Victarion Greyjoy', '🪓', 'melee'], ['aeron', 'greyjoy', 'Aeron Damphair', '🌊', 'caster'], ['rodrik', 'greyjoy', 'Rodrik the Reader', '📖', 'caster'],
    ['margaery', 'tyrell', 'Margaery Tyrell', '🌹', 'caster'], ['olenna', 'tyrell', 'Olenna Tyrell', '🌿', 'caster'], ['loras', 'tyrell', 'Loras Tyrell', '🐎', 'melee'], ['randyll', 'tyrell', 'Randyll Tarly', '🚩', 'melee'], ['sam', 'tyrell', 'Samwell Tarly', '📚', 'ranged'], ['garlan', 'tyrell', 'Garlan Tyrell', '⚔️', 'melee'], ['mace', 'tyrell', 'Mace Tyrell', '🍇', 'caster'],
    ['oberyn', 'martell', 'Oberyn Martell', '🐍', 'melee'], ['ellaria', 'martell', 'Ellaria Sand', '🧪', 'caster'], ['doran', 'martell', 'Doran Martell', '☀️', 'caster'], ['areo', 'martell', 'Areo Hotah', '🪓', 'melee'], ['obara', 'martell', 'Obara Sand', '🔱', 'ranged'], ['nymeria', 'martell', 'Nymeria Sand', '🪢', 'ranged'], ['tyene', 'martell', 'Tyene Sand', '🧪', 'ranged']];
  /* one original line per hero */
  const FANTASY = { jon: 'A northern blade and a hard-won oath.', arya: 'Small, quick, and never where you look.', sansa: 'Holds the keep with words and will.', bran: 'Sees through ravens and walks in dreams.', robb: 'Leads the charge with a wolf at his side.', ned: 'Judgement, honour and a heavy greatsword.', brienne: 'A wall of steel that keeps every promise.',
    jaime: 'The quickest sword hand in the south, and he knows it.', tyrion: 'Wits, wildfire and a cup he never puts down.', cersei: 'Burns what she cannot rule.', tywin: 'Buys the battle before it begins.', bronn: 'Shoots first, haggles later.', gregor: 'A mountain that moves, and crushes.', kevan: 'Keeps the ranks tight and the line unbroken.',
    stannis: 'Iron discipline, no mercy, no retreat.', robert: 'A warhammer and a laugh that shakes the field.', renly: 'Charm that turns crowds into armies.', davos: "A smuggler's cunning in a king's service.", melisandre: 'Shadow and flame answer her prayers.', gendry: 'Forge-born arms and a hammer to match.', barristan: 'The old knight, still the best in the yard.',
    dany: 'Fire answers when she calls.', jorah: 'A bear in exile, loyal to the end.', greyworm: 'Spear, shield and perfect discipline.', missandei: 'Keeps the host whole with word and wit.', daario: "A sellsword's grin and twin blades.", drogo: 'Rides down anything that stands.', viserys: 'Hungry for a crown, dangerous for it.',
    theon: 'A fine bow and a lot to prove.', yara: 'Captains the reavers and leads them ashore.', euron: 'Storm, salt and madness.', balon: 'Pays the iron price, every time.', victarion: 'An axe the size of a door.', aeron: 'Drowned once, and came back praying.', rodrik: 'Reads the enemy before the battle.',
    margaery: 'Roses and rations; the Reach provides.', olenna: 'Thorns, poison and a very sharp tongue.', loras: 'A tourney lance that works just as well in war.', randyll: 'Drills the ranks until they cannot break.', sam: 'No fighter, but he read how it ends.', garlan: 'The gallant blade of Highgarden.', mace: 'More men, more wine, more Highgarden.',
    oberyn: 'A venomed spear and a long memory.', ellaria: 'Poison in the cup, patience in the heart.', doran: 'Waits, plans, and lets the sun do the rest.', areo: 'The longaxe that guards the prince.', obara: 'A spear she has thrown since she could stand.', nymeria: 'A whip, a smile, a knot you cannot undo.', tyene: 'Sweet as honey, twice as deadly.' };
  const CLS = { melee: 'knight', ranged: 'ranger', caster: 'maester', mage: 'maester', knight: 'knight', ranger: 'ranger', maester: 'maester' };
  const CLS_N = { knight: 'Knight', ranger: 'Ranger', maester: 'Maester' }, CLS_E = { knight: '⚔️', ranger: '🏹', maester: '📜' };
  const RULE = 'When a hero falls, the house sends the next.';
  const glyph = (s, fb) => (typeof s === 'string' && s.length <= 4 && /[^\x00-\x7f]/.test(s)) ? s : fb; // an emoji, not an art key
  const hex = (c, fb) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) ? c : fb;
  const houses = () => { const src = R.data.houses || (window.A_CHAMP && window.A_CHAMP.houses) || null; const out = {};
    for (const k of ORDER) { const h = (src && src[k]) || {}, f = FH[k];
      out[k] = { id: k, n: h.n || h.name || f.n, e: glyph(h.e || h.sigil || h.emoji, f.e), words: h.words || h.motto || f.words, col: hex(h.col || h.color, f.col), col2: hex(h.col2, f.col2),
        seat: (typeof h.seat === 'string' && h.seat) || (h.seat && h.seat.name) || f.seat }; }
    return out; };
  const clsOf = t => CLS[String(t || '').toLowerCase()] || 'knight';
  const champs = () => { // [{id, house, n, e, type, cls, tier, fl}] in the houses' order; the first of a house has tier 0
    let rows = null; const A = window.A_CHAMP;
    if (A && Array.isArray(A.list) && A.list.length) rows = A.list.map(r => Array.isArray(r) ? { id: r[0], house: r[1], n: r[2], e: r[3], type: r[4] } : r);
    else if (Array.isArray(R.data.champs) && R.data.champs.length) rows = R.data.champs.map(c => ({ id: c.id, house: c.house, n: c.name || c.n, e: c.emoji || c.e, type: c.type, tier: c.tier }));
    else rows = FCH.map(r => ({ id: r[0], house: r[1], n: r[2], e: r[3], type: r[4] }));
    const n = {}, out = []; for (const r of rows) { if (!r || !r.id || !r.house) continue; const t = r.tier != null ? r.tier : (n[r.house] = (n[r.house] || 0) + 1) - 1; const fb = FCH.find(x => x[0] === r.id);
      out.push({ id: r.id, house: r.house, n: r.n || (fb && fb[2]) || r.id, e: glyph(r.e, fb ? fb[3] : '⚔️'), type: r.type || (fb && fb[4]) || 'melee', cls: clsOf(r.type || (fb && fb[4])), tier: t, fl: FANTASY[r.id] || 'Rides for the house.' }); }
    return out.sort((a, b) => (ORDER.indexOf(a.house) - ORDER.indexOf(b.house)) || (a.tier - b.tier)); };
  const heroes = h => champs().filter(c => c.house === h);
  // the house's starter — the one rule of core / heroes / tests: R.firstChamp(house) (A10's R.champs.first), else the first of the list
  const starterOf = (h, list) => { list = list || heroes(h); let f = null; try { f = typeof R.firstChamp === 'function' ? R.firstChamp(h) : null; } catch (e) {} return list.some(c => c.id === f) ? f : (list[0] && list[0].id); };
  const portrait = id => { const A = window.A_CHAMP, k = id + '_portrait'; const p = (A && A.art && A.art[k]) || (window.CHAMP_ART && window.CHAMP_ART[k]) || null;
    if (!p) return null; if (typeof p === 'string') return p; if (p.src) return p.src; if (p.toDataURL) { try { return p.toDataURL(); } catch (e) {} } return null; };
  const unlocked = id => { const a = R.state && R.state.acc && R.state.acc.champs; return !!(a && a[id] && a[id].unlocked); };
  const prologue = (h, seat) => { const st = R.data.story; const L = st && st.prologue && (st.prologue[h] || st.prologue.default); let out;
    if (Array.isArray(L) && L.length) out = L.map(x => String(x && x.t || x)); else out = ['The ravens stopped coming to ' + seat + ' three nights ago.',
      'Then the shepherds came down from the hills and would not say what they had seen.', 'Last night the watch heard it: footsteps in the dark where no one walked.',
      'At dawn they found the old graves open. Every one of them. Empty.'];
    out = out.filter(x => x !== RULE).slice(0, 4); out.push(RULE); return out; };
  const hasSave = () => { if (R.state && R.state.p && R.state.p.name) return true; try { const s = JSON.parse(localStorage.getItem('holdor_rpg') || 'null'); return !!(s && s.p && s.p.name); } catch (e) { return false; } };
  const sfx = n => { try { R.sfx && R.sfx.play && R.sfx.play(n, 0.6); } catch (e) {} };
  const hap = k => { try { window.Telegram.WebApp.HapticFeedback.impactOccurred(k || 'light'); } catch (e) {} };
  const mk = (tag, cls, txt) => { const d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; };
  const pic = (id, cls, fbEmoji) => { const src = portrait(id); if (src) { const im = mk('img', cls); im.src = src; im.alt = ''; im.draggable = false; return im; } return mk('div', cls + ' em', fbEmoji); };

  /* ---- the background: a slow pan over the map art with snow ---- */
  const BG = { cv: null, ctx: null, img: null, fb: null, snow: [], raf: 0, t0: 0, on: false, dpr: 1 };
  const mapImg = () => { const a = R.assets && R.assets.map;
    if (a && typeof a === 'object' && (a.naturalWidth != null || a.width)) return a; // an Image or a canvas (maybe still loading)
    const src = typeof a === 'string' ? a : typeof window.A_MAP === 'string' ? window.A_MAP : (window.A_MAP && (window.A_MAP.src || window.A_MAP.url)) || null;
    const im = new Image(); const cands = src ? [src] : ['../src/assets/westeros_1200.webp', 'src/assets/westeros_1200.webp']; let i = 0;
    im.onerror = () => { if (++i < cands.length) im.src = cands[i]; else im.bad = true; }; im.src = cands[0]; return im; };
  const fallbackMap = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1626'); g.addColorStop(1, '#1a2230'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    let sd = 77; const rn = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296; // a local PRNG: never touches R.rng's seed
    for (let i = 0; i < 9; i++) { x.beginPath(); const cx = w * rn(), cy = h * rn(), rr = w * (0.12 + rn() * 0.25); for (let a = 0; a < 14; a++) { const t = a / 14 * Math.PI * 2, r = rr * (0.7 + rn() * 0.5); x.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r * 1.4); } x.closePath(); x.fillStyle = 'rgba(70,82,70,' + (0.25 + rn() * 0.3) + ')'; x.fill(); }
    return c; };
  const ready = im => im && !im.bad && (im.naturalWidth ? im.complete : !(im instanceof HTMLImageElement) && im.width);
  const bgFrame = now => { if (!BG.on) return; BG.raf = requestAnimationFrame(bgFrame); const cv = BG.cv, x = BG.ctx; if (!cv || !x) return;
    const W = cv.width, H = cv.height, dpr = BG.dpr; if (!W || !H) return; const t = (now - BG.t0) / 1000;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#060b14'; x.fillRect(0, 0, W, H);
    let im = BG.img; if (!ready(im)) { if (!BG.fb || BG.fb.width !== W) BG.fb = fallbackMap(W, Math.round(W * 1.7)); im = BG.fb; }
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; const s = Math.max(W / iw, H / ih) * 1.55, dw = iw * s, dh = ih * s;
    const k = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 110); // one slow sweep north → south → north in 110 s
    x.drawImage(im, (W - dw) / 2 + Math.sin(t * 0.09) * (dw - W) * 0.42, -(dh - H) * k, dw, dh);
    const v = x.createRadialGradient(W / 2, H * 0.4, W * 0.2, W / 2, H * 0.4, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(6,11,20,0)'); v.addColorStop(1, 'rgba(6,11,20,.55)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
    for (const f of BG.snow) { f.y += f.v * 0.0025; f.x += Math.sin(t * f.w + f.p) * 0.0006 + 0.0002; if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); } if (f.x > 1.02) f.x = -0.02;
      x.globalAlpha = f.a; x.fillStyle = '#fff'; x.beginPath(); x.arc(f.x * W, f.y * H, f.r * dpr, 0, 6.2832); x.fill(); }
    x.globalAlpha = 1; };
  const bgSize = () => { const cv = BG.cv; if (!cv) return; const dpr = Math.min(2, window.devicePixelRatio || 1); BG.dpr = dpr; const w = cv.clientWidth || R.vw, h = cv.clientHeight || R.vh; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); };
  const bgStart = cv => { BG.cv = cv; BG.ctx = cv.getContext('2d'); BG.img = BG.img || mapImg(); BG.on = true; BG.t0 = performance.now();
    if (!BG.snow.length) for (let i = 0; i < 90; i++) BG.snow.push({ x: Math.random(), y: Math.random(), r: 0.8 + Math.random() * 1.8, v: 0.5 + Math.random() * 1.1, a: 0.35 + Math.random() * 0.5, w: 0.4 + Math.random(), p: Math.random() * 6.28 });
    bgSize(); if (!BG.raf) BG.raf = requestAnimationFrame(bgFrame); };
  const bgStop = () => { BG.on = false; if (BG.raf) cancelAnimationFrame(BG.raf); BG.raf = 0; BG.cv = BG.ctx = null; };

  /* ---- the screen ---- */
  const I = R.intro = { step: null, house: null, hero: null, lines: null, idx: 0, open: false, done: false, go: null, heroes, houses, champs, RULE,
    bg: () => ({ on: BG.on, map: !!ready(BG.img), w: BG.cv ? BG.cv.width : 0, h: BG.cv ? BG.cv.height : 0, snow: BG.snow.length }) };
  let root, veil, pane, typeT = 0, onResize = null;
  const stopTyping = () => { if (typeT) clearTimeout(typeT); typeT = 0; };
  const steps = ['house', 'hero', 'prologue'];
  const header = (title, sub, back) => { const top = mk('div', 'in-top');
    if (back) { const b = mk('button', 'in-back', '‹'); b.id = 'in-back'; b.setAttribute('aria-label', 'Back'); b.onclick = () => { sfx('ui'); go(back); }; top.appendChild(b); } else top.appendChild(mk('span', 'sp'));
    const h = mk('h2', 'in-h', title); if (sub) h.appendChild(mk('small', null, sub)); top.appendChild(h); top.appendChild(mk('span', 'sp'));
    pane.appendChild(top); const dots = mk('div', 'in-steps'); for (const s of steps) { const i = mk('i'); if (steps.indexOf(s) <= steps.indexOf(I.step)) i.className = 'on'; dots.appendChild(i); } pane.appendChild(dots); };
  const foot = (label, onTap, disabled) => { const f = mk('div', 'in-foot'); const b = mk('button', 'pri', label); b.id = 'in-next'; b.disabled = !!disabled; b.onclick = () => { if (b.disabled) return; sfx('ui'); hap('medium'); onTap(); }; f.appendChild(b); pane.appendChild(f); return b; };
  const setAcc = col => { const el = document.getElementById('screen'); el && el.style.setProperty('--acc', col); };

  const go = step => { if (!I.open) return; stopTyping(); I.step = step; pane.innerHTML = ''; root.className = 'in' + (step === 'title' ? '' : step === 'prologue' ? ' dark' : ' dim');
    ({ title: stTitle, house: stHouse, hero: stHero, prologue: stPrologue })[step](); R.bus.emit('intro', step); };
  I.go = go;

  const stTitle = () => { const t = mk('div', 'in-title'); t.appendChild(mk('h1', 'in-logo', 'HOLDOR')); t.appendChild(mk('p', 'in-sub', 'Hold the door')); t.appendChild(mk('div', 'in-rule')); pane.appendChild(t);
    const f = mk('div', 'in-foot'); const b = mk('button', 'pri', 'BEGIN'); b.id = 'in-begin'; b.onclick = () => { sfx('ui'); hap('medium'); go('house'); }; f.appendChild(b);
    if (hasSave()) { const c = mk('button', 'in-sec', 'Continue'); c.id = 'in-cont'; c.onclick = () => { sfx('ui'); if ((R.state && R.state.p && R.state.p.name) || R.load()) { R.ui.close(); enter(); } else go('house'); }; f.appendChild(c); }
    f.appendChild(mk('p', 'in-ver', 'v' + (R.VERSION || '2.0.0'))); pane.appendChild(f); };

  const stHouse = () => { header('Choose your house', 'Your seat, your colours, your first road', 'title'); const body = mk('div', 'in-body'); const grid = mk('div', 'in-houses'); const HS = houses();
    let btn; const label = () => I.house ? 'Ride for House ' + HS[I.house].n : 'Choose a house';
    for (const k of ORDER) { const H = HS[k]; const c = mk('div', 'in-house' + (I.house === k ? ' sel' : '')); c.dataset.h = k; c.style.setProperty('--hc', H.col); c.style.background = 'linear-gradient(180deg,' + H.col2 + 'd9,#0b1220 92%)';
      const tx = mk('div', 'tx'); tx.appendChild(mk('div', 'nm', H.n)); tx.appendChild(mk('div', 'wd', '“' + H.words + '”')); tx.appendChild(mk('div', 'st', H.seat));
      c.appendChild(mk('div', 'sg', H.e)); c.appendChild(tx); c.appendChild(mk('span', 'chk', '✓'));
      c.onclick = () => { if (I.house !== k) I.hero = null; I.house = k; setAcc(H.col); for (const n of grid.children) n.classList.toggle('sel', n.dataset.h === k); btn.disabled = false; btn.textContent = label(); sfx('ui'); hap('light'); };
      grid.appendChild(c); }
    body.appendChild(grid); pane.appendChild(body); btn = foot(label(), () => go('hero'), !I.house); };

  const stHero = () => { const H = houses()[I.house || 'stark']; const list = heroes(I.house || 'stark'); if (!list.length) { I.house = 'stark'; return stHero(); }
    header('Choose your hero', H.n + "'s champions — one rides, the rest wait", 'house'); const body = mk('div', 'in-body');
    const first = starterOf(I.house || 'stark', list);
    const open = list.filter(c => c.id === first || unlocked(c.id)), locked = list.filter(c => !open.includes(c)); // a new account: only the house's starter
    open.sort((a, b) => (b.id === first) - (a.id === first));
    if (!I.hero || !open.some(c => c.id === I.hero)) I.hero = open[0].id;
    let btn; const label = () => 'Ride as ' + (list.find(c => c.id === I.hero) || open[0]).n;
    const wrap = mk('div', 'in-heroes');
    for (const C of open) { const c = mk('div', 'in-hero big' + (I.hero === C.id ? ' sel' : '')); c.dataset.id = C.id; c.style.background = 'linear-gradient(180deg,' + H.col2 + 'd9,#0b1220 92%)';
      c.appendChild(pic(C.id, 'pt', C.e)); const tx = mk('div', 'tx'); tx.appendChild(mk('div', 'nm', C.n)); const cl = mk('div', 'cl'); cl.appendChild(mk('i', null, CLS_E[C.cls])); cl.appendChild(document.createTextNode(CLS_N[C.cls])); tx.appendChild(cl); tx.appendChild(mk('div', 'fl', C.fl)); c.appendChild(tx); c.appendChild(mk('span', 'chk', '✓'));
      c.onclick = () => { I.hero = C.id; for (const n of wrap.querySelectorAll('.in-hero')) n.classList.toggle('sel', n.dataset.id === C.id); btn.disabled = false; btn.textContent = label(); sfx('ui'); hap('light'); };
      wrap.appendChild(c); }
    if (locked.length) { wrap.appendChild(mk('div', 'in-lockh', 'Unlock by riding north')); const g = mk('div', 'in-locked');
      for (const C of locked) { const c = mk('div', 'in-hero lock'); c.dataset.id = C.id; c.appendChild(pic(C.id, 'pt', C.e)); c.appendChild(mk('div', 'nm', C.n)); const cl = mk('div', 'cl'); cl.appendChild(mk('i', null, CLS_E[C.cls])); cl.appendChild(document.createTextNode(CLS_N[C.cls])); c.appendChild(cl); c.appendChild(mk('span', 'lk', '🔒'));
        c.onclick = () => { sfx('ui'); R.ui.toast && R.ui.toast(C.n + ' — unlock by riding north', '#e3b661'); }; g.appendChild(c); }
      wrap.appendChild(g); }
    body.appendChild(wrap); pane.appendChild(body); btn = foot(label(), () => go('prologue'), !I.hero); };

  const stPrologue = () => { const H = houses()[I.house || 'stark']; const C = champs().find(c => c.id === I.hero) || heroes(I.house || 'stark')[0]; I.lines = prologue(I.house || 'stark', H.seat); I.idx = 0;
    const skip = mk('button', 'in-skip', 'SKIP'); skip.id = 'in-skip'; skip.onclick = e => { e.stopPropagation(); sfx('ui'); finish(); }; pane.appendChild(skip);
    const st = mk('div', 'in-stage'); st.id = 'in-stage'; const fig = mk('div', 'fig'); fig.appendChild(pic(C ? C.id : '', 'hp', H.e)); fig.appendChild(mk('div', 'sg', H.e)); st.appendChild(fig);
    if (C) st.appendChild(mk('div', 'who', C.n + ' of House ' + H.n)); const cap = mk('div', 'in-cap'); cap.id = 'in-cap'; st.appendChild(cap);
    const dots = mk('div', 'in-dots'); for (let i = 0; i < I.lines.length; i++) dots.appendChild(mk('i')); st.appendChild(dots); st.appendChild(mk('div', 'in-hint', 'tap to continue')); pane.appendChild(st);
    const show = () => { for (let i = 0; i < dots.children.length; i++) dots.children[i].className = i <= I.idx ? 'on' : ''; cap.classList.toggle('rule', I.idx === I.lines.length - 1); typeInto(cap, I.lines[I.idx]); };
    st.onclick = () => { sfx('ui'); hap('light'); I.idx++; if (I.idx >= I.lines.length) finish(); else show(); };
    show(); };
  const typeInto = (node, text) => { stopTyping(); node.innerHTML = ''; const tx = document.createTextNode(''), caret = mk('span', 'ct'); node.appendChild(tx); node.appendChild(caret); let i = 0;
    const step = () => { if (i < text.length) { i++; tx.nodeValue = text.slice(0, i); const ch = text[i - 1]; typeT = setTimeout(step, ch === '.' || ch === ':' ? 170 : ch === ',' ? 110 : 26); } else { typeT = 0; caret.remove(); } }; step(); };

  const enter = () => { if (typeof R.enterWorld === 'function') R.enterWorld(); else R.start(); };
  const finish = () => { if (I.done) return; I.done = true; stopTyping(); const house = I.house || 'stark'; const C = champs().find(c => c.id === I.hero) || heroes(house)[0]; const id = C.id;
    // an account between heroes (no hero, e.g. a migrated v1 save) keeps its world progress; otherwise a fresh account of the chosen house
    const keep = R.state && R.state.acc && R.state.p && !R.state.p.hero ? R.state : null;
    const s = keep || R.newState(house); s.p = s.p || {};
    if (!s.acc) s.acc = { house, champs: {}, hall: [], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: { lvl: 1, kills: 0 } };
    s.acc.house = house; s.acc.champs = s.acc.champs || {}; s.acc.champs[id] = Object.assign(s.acc.champs[id] || { runs: 0 }, { unlocked: 1 });
    s.p.hero = id; s.p.name = C.n; s.p.cls = C.cls; R.state = s;
    try { if (R.world && typeof R.world.startPos === 'function') { const p = R.world.startPos(house); if (p && p.x != null) s.p.pos = { x: Math.round(p.x), y: Math.round(p.y) }; } } catch (e) { console.warn('startPos', e); }
    R.ui.close();
    if (typeof R.newHero === 'function') { try { R.newHero(id); } catch (e) { console.error('newHero', e); } R.save(true); if (!R.running) enter(); }
    else { R.save(true); enter(); } };

  const S = { live: false,
    open: (arg, el) => { if (I.open) S.close(); el = el || document.getElementById('screen'); el.classList.add('intro'); I.open = true; I.done = false; I.step = null;
      root = mk('div', 'in'); const cv = mk('canvas', 'in-cv'); veil = mk('div', 'in-veil'); pane = mk('div', 'in-pane'); pane.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;z-index:2';
      root.appendChild(cv); root.appendChild(veil); root.appendChild(pane); el.appendChild(root); S.el = root;
      bgStart(cv); onResize = () => bgSize(); window.addEventListener('resize', onResize);
      try { R.bootLoader && R.bootLoader.done(); } catch (e) {}   // the template's inline loader gives way to the title
      if (I.house) setAcc(houses()[I.house].col);
      go(arg && arg.step && arg.step !== 'title' ? arg.step : 'title'); },
    close: () => { stopTyping(); bgStop(); I.open = false; I.step = null; if (onResize) window.removeEventListener('resize', onResize); onResize = null;
      const el = document.getElementById('screen'); if (el) { el.classList.remove('intro'); el.style.removeProperty('--acc'); } root = veil = pane = null; S.el = null; } };
  R.screens.intro = S; R.screens.title = S;
})();
