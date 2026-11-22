/* HOLDOR RPG — character sheet + inventory + equip screen (A16).
   R.screens.inv: portrait · name · title · level · class · house, three gear slots, ATK/DEF/HP/CRIT/SPD, stat points,
   the bag grid (5 columns, rarity frames, level badge, NEW dot), an item sheet with ONE primary button (EQUIP / USE), SELL,
   sort (rarity / level / kind) and "sell all Commons" with a confirm. Opened by the bag button: R.bus.emit('btn', 'inv').
   Soft dependencies: R.items.* (A15: RAR, price/sellPrice/value, icon, tooltip, equip, sell), R.player.recalc() (A12),
   R.draw.hero (A03/A37), R.data.houses (A07). Everything falls back to the save alone. Test hooks: R.inv.* */
(function () {
  const RAR0 = [['Common', '#9aa4b1'], ['Uncommon', '#5fcf6a'], ['Rare', '#4fb0ff'], ['Epic', '#b47cff'], ['Legendary', '#e3b661']];
  const HOUSE0 = { stark: ['Stark', '#a9bdd0', '🐺'], lannister: ['Lannister', '#d8232a', '🦁'], targaryen: ['Targaryen', '#c8102e', '🐉'], baratheon: ['Baratheon', '#e3b661', '🦌'],
    greyjoy: ['Greyjoy', '#3a9a9a', '🐙'], tyrell: ['Tyrell', '#5fa84a', '🌹'], martell: ['Martell', '#e07b2a', '☀️'] };
  const SLOTS = ['weapon', 'armor', 'trinket'], KINDS = { weapon: 0, armor: 1, trinket: 2, potion: 3, mat: 4 };
  const STATS = ['atk', 'def', 'hp', 'crit', 'spd'], WGT = { atk: 1, def: 1, hp: .15, crit: 1.5, spd: .5 };
  const AUTO = { knight: ['str', 'vit', 'str'], ranger: ['agi', 'agi', 'vit'], maester: ['int', 'int', 'vit'] };
  /* code-drawn glyphs (24×24, stroked with the rarity colour) */
  const G = {
    weapon: '<path d="M5 19l3-3M6 14l4 4M8 16L18 6l1-3 2 2-3 1L9 17"/>',
    armor: '<path d="M12 3l6 2v6c0 5-3 8-6 10-3-2-6-5-6-10V5z"/><path d="M12 7v11M8 10l4 2 4-2"/>',
    trinket: '<circle cx="12" cy="14" r="6"/><path d="M12 8l-3-3 3-2 3 2z"/>',
    potion: '<path d="M10 3h4v5l4 8c1 2 0 4-2 4H8c-2 0-3-2-2-4l4-8z"/><path d="M8 15h8"/>',
    mat: '<path d="M12 3l7 6-7 12-7-12z"/><path d="M5 9h14M12 3l-3 6 3 12 3-12z"/>',
    ranger: '<path d="M7 4c7 2 10 7 11 15M7 4l11 15M7 4l1 5M18 19l-5-1"/>',
    maester: '<path d="M7 4h11a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M10 9h6M10 13h6M20 18H7"/>' };
  G.knight = G.weapon;
  const svg = (k, cls) => '<svg class="ig ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (G[k] || G.mat) + '</svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => (s = String(s || ''), s.charAt(0).toUpperCase() + s.slice(1));
  const fmt = n => Math.round(+n || 0).toLocaleString('en-US');
  const P = () => R.state && R.state.p, IT = () => R.items || {};
  const sfx = n => { try { R.sfx && R.sfx.play && R.sfx.play(n, .5); } catch (e) {} };

  /* ---- item helpers (R.items first, then the save) ---- */
  const rarOf = it => { const i = R.clamp(it && it.rar | 0, 0, 4), T = Array.isArray(IT().RAR) && IT().RAR.length >= 5 ? IT().RAR[i] : null;
    if (Array.isArray(T)) return { n: T[0], c: T[1] }; if (T && typeof T === 'object') return { n: T.name || T.n || RAR0[i][0], c: T.col || T.c || RAR0[i][1] }; return { n: RAR0[i][0], c: RAR0[i][1] }; };
  const st = (it, k) => (it && it.stats && +it.stats[k]) || 0;
  const score = it => it ? STATS.reduce((s, k) => s + st(it, k) * WGT[k], 0) : 0;
  const mainStat = it => { if (!it) return null; if (it.kind === 'weapon') return 'atk'; if (it.kind === 'armor') return 'def'; let b = null, bv = 0; for (const k of STATS) if (st(it, k) > bv) { bv = st(it, k); b = k; } return b; };
  const price = it => { const I = IT(); for (const f of ['price', 'sellPrice', 'value']) if (typeof I[f] === 'function') { try { const v = +I[f](it); if (v > 0) return Math.round(v); } catch (e) {} }
    return Math.round((4 + (it.lvl | 0) * 2) * [1, 2, 4, 9, 20][R.clamp(it.rar | 0, 0, 4)]); };
  const iconHtml = (it, cls) => { const I = IT();
    if (typeof I.icon === 'function') { try { const h = I.icon(it); if (typeof h === 'string' && h) return h[0] === '<' ? h.replace('<svg', '<svg class="ig ' + (cls || '') + '"') : '<span class="ig em ' + (cls || '') + '">' + esc(h) + '</span>'; } catch (e) {} }
    if (typeof it.icon === 'string' && it.icon && it.icon.length <= 4 && !/^[a-z0-9_]+$/i.test(it.icon)) return '<span class="ig em ' + (cls || '') + '">' + esc(it.icon) + '</span>';
    return svg(it.kind, cls); };
  /* is `it` worth equipping over `cur`? {ok} or {ok:false, n, k} = the stat that drops */
  const cmp = (it, cur) => { if (!cur || score(it) >= score(cur)) return { ok: true }; const m = mainStat(it) || 'atk'; let dm = st(it, m) - st(cur, m); if (dm < 0) return { ok: false, n: -dm, k: m };
    let bk = m, bd = 0; for (const k of STATS) { const d = st(it, k) - st(cur, k); if (d < bd) { bd = d; bk = k; } } return { ok: false, n: -bd || 1, k: bk }; };
  const houseOf = h => { const D = R.data.houses && R.data.houses[h], F = HOUSE0[h] || [cap(h || 'Stark'), '#a9bdd0', '🛡']; const sg = D && (D.sigil || D.sig);
    return { name: (D && (D.name || D.n)) || F[0], col: (D && (D.col || D.color)) || F[1], sig: typeof sg === 'string' && sg ? (sg[0] === '<' ? sg : esc(sg)) : F[2] }; };

  /* ---- the hero's numbers: R.player when present, else the ARCH formulas over the save ---- */
  const calc = p => { const L = p.lvl || 1, s = p.stats || {}, g = {}; for (const k of SLOTS) { const it = p.gear && p.gear[k]; if (it) for (const q of STATS) g[q] = (g[q] || 0) + st(it, q); }
    const m = p.cls === 'ranger' ? s.agi : p.cls === 'maester' ? s.int : s.str;
    return { atk: 10 + 2 * L + 1.5 * (m || 0) + (g.atk || 0), def: 4 + 1.2 * L + .6 * (s.vit || 0) + (g.def || 0), hp: 120 + 18 * L + 6 * (s.vit || 0) + (g.hp || 0), crit: 5 + (g.crit || 0), spd: 170 + (g.spd || 0) }; };
  const stats = () => { const p = P(); if (!p) return { atk: 0, def: 0, hp: 0, crit: 0, spd: 0 }; const c = calc(p), e = R.player; if (!e) return c;
    const pick = (k, alt) => typeof e[k] === 'number' && isFinite(e[k]) ? e[k] : alt; return { atk: pick('atk', c.atk), def: pick('def', c.def), hp: pick('hpMax', c.hp), crit: pick('crit', c.crit), spd: pick('spd', c.spd) }; };
  const critTxt = v => (v <= 1 ? Math.round(v * 100) : Math.round(v)) + '%';

  /* ---- actions ---- */
  const after = (ev, a, b) => { if (R.player && typeof R.player.recalc === 'function') { try { R.player.recalc(); } catch (e) { console.error(e); } } if (ev) R.bus.emit(ev, a, b); R.save && R.save(); if (R.ui.cur === 'inv' && el) render(); };
  function equip(it) { const p = P(); if (!p || !it || !SLOTS.includes(it.kind)) return false; p.gear = p.gear || {}; const i = p.inv.indexOf(it); if (i < 0) return false;
    if (typeof IT().equip === 'function') { try { IT().equip(it); } catch (e) { console.error(e); } if (p.gear[it.kind] === it) { after('equip', it, it.kind); return true; } }
    const old = p.gear[it.kind]; p.inv.splice(i, 1); p.gear[it.kind] = it; if (old) p.inv.splice(i, 0, old); sfx('equip'); after('equip', it, it.kind); return true; }
  function unequip(slot, quiet) { const p = P(); const it = p && p.gear && p.gear[slot]; if (!it) return false; delete p.gear[slot]; p.inv.unshift(it); if (!quiet) after('equip', null, slot); return true; }
  function sell(it) { const p = P(); if (!p) return 0; const i = p.inv.indexOf(it); if (i < 0) return 0; const pr = price(it);
    if (typeof IT().sell === 'function') { let r = 0; try { r = +IT().sell(it) || 0; } catch (e) { console.error(e); } if (p.inv.indexOf(it) < 0) { after('sell', it, r || pr); return r || pr; } }
    p.inv.splice(i, 1); p.gold = (p.gold | 0) + pr; R.bus.emit('gold', pr); sfx('coin'); after('sell', it, pr); return pr; }
  const commons = p => (p.inv || []).filter(it => it && (it.rar | 0) === 0 && SLOTS.includes(it.kind));
  function sellCommons() { const p = P(); if (!p) return 0; let g = 0, n = 0; for (const it of commons(p)) { const v = sell(it); if (v) { g += v; n++; } } if (n) R.ui.toast('Sold ' + n + ' for ' + fmt(g) + ' gold', '#e3b661'); return g; }
  function use(it) { const p = P(); if (!p || !it || it.kind !== 'potion') return 0; const i = p.inv.indexOf(it); if (i < 0) return 0; p.inv.splice(i, 1);
    const S = stats(), heal = st(it, 'hp') || Math.round(S.hp * .3), e = R.player;
    if (e && typeof e.hp === 'number') { const mx = e.hpMax || S.hp; e.hp = Math.max(e.hp, Math.min(mx, e.hp + heal)); p.hp = e.hp; if (R.fx && R.fx.num) { try { R.fx.num(e.x, e.y - 24, '+' + heal, '#7fd06a', true); } catch (x) {} } } else p.hp = Math.max(p.hp || 0, Math.min(S.hp, (p.hp || 0) + heal));
    sfx('potion'); after('potion', it, heal); return heal; }
  function spend(k) { const p = P(); if (!p || !(p.pts > 0) || !p.stats || !(k in p.stats)) return false; p.stats[k] = (p.stats[k] | 0) + 1; p.pts--; sfx('ui'); after('stat', k, p.stats[k]); return true; }
  function auto() { const p = P(); if (!p || !(p.pts > 0)) return 0; const ord = AUTO[p.cls] || AUTO.knight; let n = 0; while (p.pts > 0) { p.stats[ord[n % 3]] = (p.stats[ord[n % 3]] | 0) + 1; p.pts--; n++; } sfx('ui'); after('stat', 'auto', n); return n; }

  /* ---- the screen ---- */
  const SORTS = { rar: ['RARITY', (a, b) => (b.rar | 0) - (a.rar | 0) || (b.lvl | 0) - (a.lvl | 0)], lvl: ['LEVEL', (a, b) => (b.lvl | 0) - (a.lvl | 0) || (b.rar | 0) - (a.rar | 0)],
    kind: ['KIND', (a, b) => (KINDS[a.kind] | 0) - (KINDS[b.kind] | 0) || (b.rar | 0) - (a.rar | 0) || (b.lvl | 0) - (a.lvl | 0)] };
  let el = null, sort = 'rar', view = [], sheet = null, confirmSell = false;
  const cell = (it, i, p) => { const r = rarOf(it), up = SLOTS.includes(it.kind) && score(it) > score(p.gear[it.kind]);
    return '<div class="ic" data-act="it" data-i="' + i + '" data-id="' + esc(it.id) + '" style="color:' + r.c + ';border-color:' + r.c + '">' + iconHtml(it) + (it.lvl ? '<b class="il">' + (it.lvl | 0) + '</b>' : '') + (it.nw ? '<i class="nd"></i>' : '') + (up ? '<span class="up">▲</span>' : '') + '</div>'; };
  const slotTile = (k, p) => { const it = p.gear[k]; if (!it) return '<div class="slot e" data-act="slot" data-slot="' + k + '"><span class="sk">' + k + '</span>' + svg(k) + '<span class="sn">empty</span></div>';
    const r = rarOf(it), m = mainStat(it);
    return '<div class="slot" data-act="slot" data-slot="' + k + '" style="border-color:' + r.c + ';color:' + r.c + '"><span class="sk">' + k + '</span>' + iconHtml(it) + '<span class="sn">' + esc(it.name || k) + '</span><span class="ms">' + (m ? '+' + fmt(st(it, m)) + (m === 'crit' ? '%' : '') + ' ' + m.toUpperCase() : 'Lv ' + (it.lvl | 0)) + '</span></div>'; };
  function sheetHtml(sh, p) { const it = sh.it, r = rarOf(it), isGear = SLOTS.includes(it.kind), cur = isGear ? p.gear[it.kind] : null, fromSlot = !!sh.slot; let body = '';
    if (typeof IT().tooltip === 'function') { try { const t = IT().tooltip(it, cur); if (typeof t === 'string') body = t; else if (Array.isArray(t)) body = t.map(x => '<div class="row"><span>' + esc(x) + '</span></div>').join(''); else if (t && t.nodeType) body = t.outerHTML; } catch (e) {} }
    if (!body) body = STATS.filter(k => st(it, k) || (cur && !fromSlot && st(cur, k))).map(k => { const v = st(it, k), d = cur && !fromSlot ? v - st(cur, k) : 0;
      return '<div class="row"><span>' + k.toUpperCase() + '</span><span><b>' + (k === 'crit' ? v + '%' : fmt(v)) + '</b>' + (d ? ' <em class="' + (d > 0 ? 'dup' : 'ddn') + '">' + (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + '</em>' : '') + '</span></div>'; }).join('')
      || '<div class="row"><span>' + (it.kind === 'potion' ? 'Restores a third of your health' : 'Crafting material for the smith') + '</span></div>';
    let btn = '';
    if (fromSlot) btn = '<button class="eq quiet" data-act="uneq">UNEQUIP</button>';
    else if (isGear) { const d = cmp(it, cur); btn = d.ok ? '<button class="pri eq" data-act="eq">EQUIP</button>' : '<button class="eq quiet" data-act="eq">EQUIP (−' + fmt(d.n) + ' ' + d.k + ')</button>'; }
    else if (it.kind === 'potion') btn = '<button class="pri use" data-act="use">USE</button>';
    return '<div class="dim" data-act="shx"></div><div class="sheet"><div class="sh-hd"><span class="ib" style="color:' + r.c + ';border-color:' + r.c + '">' + iconHtml(it, 'big') + '</span><div class="sh-t"><b style="color:' + r.c + '">' + esc(it.name || cap(it.kind)) + '</b><small>' + r.n + ' · ' + cap(it.kind) + (it.lvl ? ' · Lv ' + (it.lvl | 0) : '') + (it.set ? ' · ' + esc(it.set) : '') + (fromSlot ? ' · equipped' : '') + '</small></div><button class="x" data-act="shx" aria-label="Close">✕</button></div>'
      + '<div class="sh-body">' + body + '</div>' + btn + '<div class="row2"><button class="sell" data-act="sell">SELL · ' + fmt(price(it)) + ' gold</button></div></div>'; }
  function render() { if (!el) return; const p = P();
    if (!p) { el.innerHTML = '<div class="inv"><div class="hd"><div class="who"><div class="nm">No hero yet</div></div><button class="x" data-act="close">✕</button></div></div>'; return; }
    p.inv = Array.isArray(p.inv) ? p.inv : []; p.gear = p.gear || {}; p.stats = p.stats || { str: 0, agi: 0, int: 0, vit: 0 };
    const acc = R.state.acc || {}, H = houseOf(p.house || acc.house), S = stats(), cls = p.cls || 'knight'; view = p.inv.filter(Boolean).slice().sort(SORTS[sort][1]);
    const ch = p.hero && R.data.champs && R.data.champs[p.hero], name = p.name || (ch && (ch.name || ch.n)) || (p.hero ? cap(p.hero) : 'Nameless'), title = acc.title || p.title;
    let h = '<div class="inv" style="--acc:' + H.col + '">';
    h += '<div class="hd"><div class="por"><span class="sig">' + H.sig + '</span></div><div class="who"><div class="nm">' + esc(name) + '</div>' + (title ? '<div class="ti">' + esc(title) + '</div>' : '')
      + '<div class="lv">LV ' + (p.lvl | 0) + ' · ' + cap(cls).toUpperCase() + ' · HOUSE ' + esc(H.name).toUpperCase() + '</div></div><button class="x" data-act="close" aria-label="Close">✕</button></div>';
    h += '<div class="gear">' + SLOTS.map(k => slotTile(k, p)).join('') + '</div>';
    h += '<div class="stats">' + [['ATK', fmt(S.atk)], ['DEF', fmt(S.def)], ['HP', fmt(S.hp)], ['CRIT', critTxt(S.crit)], ['SPD', fmt(S.spd)]].map(x => '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>').join('') + '</div>';
    if (p.pts > 0) h += '<div class="pts"><span class="pl">' + (p.pts | 0) + '<small>PTS</small></span>' + ['str', 'agi', 'int', 'vit'].map(k => '<button data-act="pt" data-k="' + k + '"><b>+</b>' + k.toUpperCase() + ' <em>' + (p.stats[k] | 0) + '</em></button>').join('') + '<button class="auto" data-act="auto">AUTO</button></div>';
    const cm = commons(p);
    h += '<div class="tb"><span class="gold"><i></i>' + fmt(p.gold | 0) + '</span>' + (confirmSell
      ? '<span class="cq">Sell ' + cm.length + ' Common' + (cm.length === 1 ? '' : 's') + ' for ' + fmt(cm.reduce((s, it) => s + price(it), 0)) + '?</span><button class="yes" data-act="sellc-yes">YES</button><button data-act="sellc-no">NO</button>'
      : '<button class="sort" data-act="sort">SORT · ' + SORTS[sort][0] + '</button><button class="sellc" data-act="sellc"' + (cm.length ? '' : ' disabled') + '>SELL COMMONS</button>') + '</div>';
    h += '<div class="grid">' + (view.length ? view.map((it, i) => cell(it, i, p)).join('') : '<div class="empty">Your bag is empty. Mobs and chests drop gear.</div>') + '</div>';
    if (sheet && (p.inv.includes(sheet.it) || (sheet.slot && p.gear[sheet.slot] === sheet.it))) h += sheetHtml(sheet, p); else sheet = null;
    h += '</div>'; el.innerHTML = h; drawPortrait(p); }
  /* the hero is a champion (Addendum 2): R.draw.portrait(hero) → A_CHAMP.art[hero + '_portrait'] → R.draw.hero → the class glyph */
  const put = (box, node) => { box.insertBefore(node, box.firstChild); return true; };
  function drawPortrait(p) { const box = el && el.querySelector('.por'); if (!box) return; const hero = p.hero; let done = false;
    if (hero && R.draw && typeof R.draw.portrait === 'function') { try { const r = R.draw.portrait(hero, { size: 72 });
      if (r && r.nodeType === 1) done = put(box, r); else if (typeof r === 'string' && /^(data:|https?:|blob:|\.?\/)/.test(r)) { const im = new Image(); im.src = r; im.alt = ''; done = put(box, im); } } catch (e) {} }
    if (!done && hero) { const A = (window.A_CHAMP && A_CHAMP.art) || window.CHAMP_ART, src = A && A[hero + '_portrait']; if (typeof src === 'string' && src) { const im = new Image(); im.src = src; im.alt = ''; done = put(box, im); } }
    if (!done && R.draw && typeof R.draw.hero === 'function') { try { const c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1); c.width = c.height = 72 * d; const x = c.getContext('2d'); x.scale(d, d);
      const keep = R.ctx; R.ctx = x; try { R.draw.hero(36, 58, { ctx: x, s: 1.8, scale: 1.8, anim: 'idle', face: 1, t: 0, portrait: true }); } finally { R.ctx = keep; }
      const px = x.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < px.length; i += 64) if (px[i]) { done = true; break; }
      if (done) put(box, c); } catch (e) { done = false; } }
    if (!done) box.insertAdjacentHTML('afterbegin', svg(p.cls || 'knight', 'cg')); }
  function onClick(ev) { const t = ev.target.closest('[data-act]'); if (!t || !el || !el.contains(t)) return; const a = t.dataset.act, p = P();
    if (a === 'close') return R.ui.close(); if (!p) return;
    if (a === 'it') { const it = view[+t.dataset.i]; if (it) { sheet = { it }; sfx('ui'); render(); } return; }
    if (a === 'slot') { const it = p.gear[t.dataset.slot]; if (it) { sheet = { it, slot: t.dataset.slot }; render(); } else R.ui.toast('Tap an item in the bag to equip it'); return; }
    if (a === 'shx') { sheet = null; render(); return; }
    const it = sheet && sheet.it, fromSlot = sheet && sheet.slot;
    if (a === 'eq') { sheet = null; if (it) equip(it); return; } /* the slot tile shows the result; no toast (toasts sit under #screen) */
    if (a === 'uneq') { sheet = null; if (fromSlot) unequip(fromSlot); return; }
    if (a === 'sell') { sheet = null; if (it) { if (fromSlot) unequip(fromSlot, true); const g = sell(it); if (g) R.ui.toast('+' + fmt(g) + ' gold', '#e3b661'); } return; }
    if (a === 'use') { sheet = null; if (it) { const hp = use(it); if (hp) R.ui.toast('+' + fmt(hp) + ' HP', '#7fd06a'); } return; }
    if (a === 'pt') return void spend(t.dataset.k);
    if (a === 'auto') return void auto();
    if (a === 'sort') { const ks = Object.keys(SORTS); sort = ks[(ks.indexOf(sort) + 1) % ks.length]; if (R.state.opts) R.state.opts.invSort = sort; sfx('ui'); render(); return; }
    if (a === 'sellc') { confirmSell = true; render(); return; }
    if (a === 'sellc-no') { confirmSell = false; render(); return; }
    if (a === 'sellc-yes') { confirmSell = false; sellCommons(); render(); } }
  R.screens.inv = {
    open(arg, root) { el = root || document.getElementById('screen'); sheet = null; confirmSell = false; const o = R.state && R.state.opts; if (o && SORTS[o.invSort]) sort = o.invSort; el.addEventListener('click', onClick); render(); },
    close() { if (el) el.removeEventListener('click', onClick); const p = P(); if (p && Array.isArray(p.inv)) for (const it of p.inv) if (it && it.nw) delete it.nw; sheet = null; el = null; } };
  R.bus.on('btn', n => { if (n !== 'inv' && n !== 'bag') return; if (R.ui.cur === 'inv') R.ui.close(); else R.ui.open('inv'); });
  R.bus.on('loot', it => { if (it && typeof it === 'object' && !it.nw) it.nw = 1; });
  R.inv = { render, equip, unequip, sell, sellCommons, use, spend, auto, price, score, cmp, stats, rarOf, SLOTS, newCount: () => { const p = P(); return p && p.inv ? p.inv.filter(it => it && it.nw).length : 0; } };
})();
