/* HOLDOR RPG — 43b_townlife.js (C1): towns that read at a glance and invite you in.
   1. Entry banner: walking into a castle / town / village (distance to the POI ≤ its r + 30, left again past r + 200) shows ONE short banner per
      visit (5.2 s of game time) — a heraldic shield in the house colour, the place's name, "Seat of House Stark" / "Town · The North", and the
      services-here quick list ("Smith · Inn · Market · 3 quests"): a ≥ 44-px button that opens R.screens.town (43_towns) for that POI. The banner sits in
      the HUD's message column (top-centre, from #hud-slot down) and moves below whatever is shown there (the bars, the tutorial card, the
      region title, the toasts), the top-left block and the top-right column: it never covers them. It waits while a screen is open.
   2. Service signs over the NPCs that serve (DOM pills in #ui positioned every step through R.w2s, so they stay crisp and tappable):
      anvil = smith, coin bag = merchant, mug = innkeeper, scroll = notice board (role 'board'), cross-shield = the guards' captain / warden.
      They fade from 260 to 700 units, hide behind the camera, off screen, while a screen is open, and where they would cover the HUD.
      Within 200 units the sign carries its label. A tap within 120 units opens the service (R.ui.open('smith'|'shop'|'inn', poi); the board
      and the captain open their dialog); farther away it toasts the way ("The smith is that way ↗ — walk closer").
   3. Ambience on the bus: a quiet anvil ring by day near a smith ('forge'), market chatter and sept bells at dawn / dusk only when 61_sfx
      has a sound of that name (R.sfx.has) — today it has none, so those stay silent. Torches at night belong to G11 / T1.
   Hooks: R.townlife = {cur, poi(), banner(poi), hideBanner(), signs() → [{key, svc, npc, x, y, el, d, on}], svcOf(e), lineFor(poi),
          open(svc, e), check(), place(), TYPES, ICON}.  Events: 'town:enter' (poi), 'town:leave' (poi), 'town:service' (svc, poi).
   Every call is guarded; nothing here throws at load; no DOM before #ui exists. */
(function () {
  const R = window.R; if (!R || !R.bus) return;
  const TL = R.townlife = R.townlife || {};
  const TYPES = TL.TYPES = { castle: 1, town: 1, village: 1, city: 1, seat: 1, hamlet: 1 };
  const FAR = 700, NEAR = 260, LABEL_R = 200, TAP_R = 120, BAN_S = 5.2;   // the banner stays 5.2 s of game time
  const HOUSE_COL = { stark: '#a9bdd0', lannister: '#e3b661', targaryen: '#e14b4b', greyjoy: '#d8b74a', tyrell: '#7fd06a', martell: '#f08a3c', baratheon: '#e0c14a' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const vals = m => !m ? [] : Array.isArray(m) ? m : Object.keys(m).map(k => m[k]);
  const pxy = p => !p ? { x: 0, y: 0 } : { x: p.x != null ? p.x : p.pos ? p.pos.x : 0, y: p.y != null ? p.y : p.pos ? p.pos.y : 0 };
  const try_ = (f, d) => { try { return f(); } catch (e) { return d; } };
  const pois = () => try_(() => (R.world && R.world.pois ? R.world.pois() : vals(R.data.world && R.data.world.pois)), []) || [];
  const poiById = id => id == null ? null : try_(() => (R.world && R.world.poi && R.world.poi(id)) || pois().find(p => p && p.id === id), null) || null;
  const houses = () => (R.data && (R.data.houses || (R.data.world && R.data.world.houses))) || {};
  const houseOf = poi => { if (!poi) return null; if (poi.house) return poi.house; const H = houses(); for (const k in H) if (H[k] && H[k].region && H[k].region === poi.region) return k; return null; };
  const colOf = poi => { const h = houseOf(poi), H = houses(); return (h && H[h] && H[h].col) || HOUSE_COL[h] || '#e3b661'; };
  const col2Of = poi => { const h = houseOf(poi), H = houses(); return (h && H[h] && H[h].col2) || '#1d2430'; };
  const regionName = poi => try_(() => { const r = R.world && R.world.regionOf ? R.world.regionOf(poi.region) : null; return (r && r.name) || ''; }, '');
  const isTownish = p => !!p && !!TYPES[String(p.type || p.kind || '').toLowerCase()];
  const radius = p => Math.max(90, +p.r || (String(p.type) === 'castle' ? 160 : 120));
  const screenOpen = () => !!(R.ui && R.ui.cur);
  const hudHidden = () => { const h = R.hud && R.hud.el; return !!(h && (h.classList.contains('hide') || h.classList.contains('off'))); };
  const sfxHas = n => try_(() => !!(R.sfx && R.sfx.has && R.sfx.has(n)), false);
  const sfx = (n, v) => { try { if (R.sfx && R.sfx.play) R.sfx.play(n, v); } catch (e) {} };
  const hap = k => { try { if (R.input && R.input.haptic) R.input.haptic(k || 'light'); } catch (e) {} };

  /* ---- icons, code-drawn (24-unit view box, gold line on a dark disc) ---- */
  const ICON = TL.ICON = {
    smith: '<svg viewBox="0 0 24 24"><path d="M2.5 8.5h15.5c0 2.2-2 3.6-4.6 3.8v2.7h2.6v2.7H6.6V15h2.6v-2.6C5.4 12 3.2 10.6 2.5 8.5z" fill="#6f7b88" stroke="#f1dca6" stroke-width="1.3" stroke-linejoin="round"/><path d="M18 8.5h3.5" stroke="#f1dca6" stroke-width="1.6" stroke-linecap="round"/><path d="M5.5 19.6h12" stroke="#f1dca6" stroke-width="1.6" stroke-linecap="round"/><path d="M14.5 3.2l3 2.8" stroke="#e3b661" stroke-width="2.2" stroke-linecap="round"/><circle cx="12.2" cy="5.3" r=".9" fill="#ffb347"/><circle cx="9.6" cy="4.4" r=".6" fill="#ffd27a"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path d="M8.2 6.2h7.6l-1.4 2.2c3.6 1.7 5.8 5 5.8 8.2 0 2.6-2.2 4-8.2 4s-8.2-1.4-8.2-4c0-3.2 2.2-6.5 5.8-8.2z" fill="#8a5a2a" stroke="#f1dca6" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.6 8.6h6.8" stroke="#f1dca6" stroke-width="1.3"/><path d="M9.6 6.2c-.6-1.7.6-3.2 2.4-3.2s3 1.5 2.4 3.2" fill="none" stroke="#f1dca6" stroke-width="1.2"/><circle cx="12" cy="15" r="3.2" fill="#e3b661" stroke="#7a5417" stroke-width="1.1"/><path d="M12 13.4v3.2" stroke="#7a5417" stroke-width="1.1"/></svg>',
    inn: '<svg viewBox="0 0 24 24"><rect x="4.5" y="7.5" width="11" height="13" rx="2" fill="#c98a3a" stroke="#f1dca6" stroke-width="1.3"/><path d="M15.5 10.5h2.2a2.3 2.3 0 010 4.6h-2.2" fill="none" stroke="#f1dca6" stroke-width="1.4"/><path d="M4.2 8c.4-2.6 2.6-3.6 4.2-2.8 1-1.6 3.8-1.6 4.8 0 1.6-.6 3 .6 2.6 2.8z" fill="#f7f1dc"/><path d="M8 11v7M12 11v7" stroke="#7a4a1a" stroke-width="1.1" opacity=".7"/></svg>',
    board: '<svg viewBox="0 0 24 24"><path d="M6 4.5h11.5c1.2 0 2 .8 2 2s-.8 2-2 2H17v9.5c0 1.4-1 2.5-2.5 2.5H5.5c1 0 1.8-1 1.8-2.2V6.6C7.3 5.4 6.8 4.5 6 4.5z" fill="#e9d9a8" stroke="#7a5417" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 4.5c-1.2 0-2 .9-2 2.1S4.8 8.5 6 8.5" fill="#cdb77c" stroke="#7a5417" stroke-width="1.2"/><path d="M9.5 9.5h5M9.5 12.2h5M9.5 14.9h3.4" stroke="#7a5417" stroke-width="1.2" stroke-linecap="round"/><circle cx="14.6" cy="18" r="1.6" fill="#b3312c"/></svg>',
    guard: '<svg viewBox="0 0 24 24"><path d="M12 2.6l7.6 2.8v5.8c0 5-3.4 8.6-7.6 10.4-4.2-1.8-7.6-5.4-7.6-10.4V5.4z" fill="#3e5a7e" stroke="#f1dca6" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 5.6v13M7.4 10.6h9.2" stroke="#f1dca6" stroke-width="2.1" stroke-linecap="round"/></svg>' };
  const LABEL = TL.LABEL = { smith: 'Smithy', shop: 'Market', inn: 'Inn', board: 'Notices', guard: 'Captain' };
  const WHO = { smith: 'the smith', shop: 'the merchant', inn: 'the inn', board: 'the notice board', guard: 'the captain' };
  const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

  /* ---- which service an NPC entity offers (the role kind, its services, Q1's 'board' role, a captain / warden guard) ---- */
  const svcOf = TL.svcOf = e => {
    if (!e || e.dead || (e.kind && e.kind !== 'npc' && e.kind !== 'board')) return null;
    const n = e.npc || {}, k = String(e.rkind || n.kind || n.role || e.role || '').toLowerCase(), sv = [].concat(n.services || e.services || []).map(String);
    if (k === 'board' || k === 'notice' || k === 'noticeboard' || e.kind === 'board' || n.board || e.board) return 'board';
    if (k === 'smith' || k === 'blacksmith' || k === 'armorer' || sv.indexOf('smith') >= 0) return 'smith';
    if (k === 'innkeeper' || k === 'innkeep' || sv.indexOf('inn') >= 0) return 'inn';
    if (k === 'merchant' || k === 'trader' || sv.indexOf('shop') >= 0) return 'shop';
    if (k === 'captain' || k === 'arms' || (k === 'guard' && /captain|warden|commander|sergeant/i.test(String(e.fullName || e.name || '') + ' ' + String(n.role || e.role || '')))) return 'guard';
    return null; };
  const npcEnts = () => { let L = null; try { if (R.npcs && R.npcs.list) L = R.npcs.list(); } catch (e) { L = null; }
    const out = (L || []).slice(), seen = new Set(out); for (const e of R.ents || []) if (e && !e.dead && (e.kind === 'npc' || e.kind === 'board') && !seen.has(e)) out.push(e);
    return out.filter(e => e && !e.dead); };
  const poiOfEnt = e => poiById(e && e.poi) || (R.towns && R.towns.inside ? try_(() => R.towns.inside(), null) : null);

  /* ---- the quick list for a POI: services + who is there + quests on offer ---- */
  const npcsAtPoi = poi => try_(() => (R.npcs && R.npcs.npcsAt ? R.npcs.npcsAt(poi.id) : []), []) || [];
  TL.lineFor = poi => {
    if (!poi) return { items: [], quests: 0, svc: false };
    const ns = npcsAtPoi(poi), roles = new Set(ns.map(n => String(n.kind || n.role || '').toLowerCase()));
    for (const n of ns) for (const s of [].concat(n.services || [])) roles.add('svc:' + s);
    const items = [];
    if (poi.smith || roles.has('smith') || roles.has('svc:smith')) items.push('Smith');
    if (poi.inn || roles.has('innkeeper') || roles.has('svc:inn')) items.push('Inn');
    if (poi.shop || roles.has('merchant') || roles.has('svc:shop')) items.push('Market');
    if (roles.has('board')) items.push('Notice board');
    let quests = 0, turn = 0;
    for (const n of ns) { quests += try_(() => (R.npcs.offersFor(n.id) || []).length, 0); turn += try_(() => (R.npcs.turnInsFor(n.id) || []).length, 0); }
    if (!items.length && roles.has('elder')) items.push('Elder');
    return { items, quests, turn, svc: !!(poi.shop || poi.inn || poi.smith || roles.has('merchant') || roles.has('innkeeper') || roles.has('smith')) };
  };
  const subFor = poi => { const h = houseOf(poi), H = houses(), hn = h && H[h] ? (H[h].n || H[h].name || h) : '', rn = regionName(poi), t = String(poi.type || '').toLowerCase();
    const kind = poi.seat && hn ? 'Seat of House ' + hn : t === 'castle' ? 'Castle' : t === 'village' || t === 'hamlet' ? 'Village' : t === 'city' ? 'City' : 'Town';
    return rn && !(poi.seat && hn) ? kind + ' · ' + rn : kind; };

  /* ---- DOM ---- */
  let layer = null, ban = null, banPoi = null, banT = 0, banOn = false;
  const mount = () => {
    if (layer && layer.isConnected) return true; const ui = document.getElementById('ui'); if (!ui) return false;
    layer = document.createElement('div'); layer.id = 'tl-layer'; layer.setAttribute('aria-hidden', 'false');
    ban = document.createElement('div'); ban.id = 'tl-ban'; ban.className = 'tl-ban'; ban.setAttribute('role', 'status');
    ban.innerHTML = '<div class="tl-crest"><svg viewBox="0 0 40 46"><path class="s" d="M20 2l17 5v13c0 11-7.6 19-17 23C10.6 39 3 31 3 20V7z"/><path class="i" d="M20 6.5l13 3.8v9.8c0 8.6-5.8 14.9-13 18.2-7.2-3.3-13-9.6-13-18.2v-9.8z"/></svg><b></b></div>' +
      '<div class="tl-txt"><div class="tl-nm"></div><div class="tl-sub"></div></div>' +
      '<button type="button" class="tl-svc" aria-label="Services here" title="Services here"><span class="tl-list"></span><span class="tl-a">›</span></button>';
    ban.querySelector('.tl-svc').addEventListener('click', ev => { ev.stopPropagation(); const p = banPoi; if (!p) return; hap('select');
      TL.hideBanner(); try { if (R.screens.town) R.ui.open('town', p); else if (R.towns && R.towns.open) R.towns.open('shop', p); } catch (e) {} R.bus.emit('town:service', 'town', p); });
    layer.appendChild(ban);
    // before the HUD (#hud) in the DOM: the HUD paints above the signs where they would meet (and the signs hide there anyway)
    const hud = document.getElementById('hud'); if (hud && hud.parentNode === ui) ui.insertBefore(layer, hud); else ui.appendChild(layer);
    return true; };

  /* ---- the entry banner ---- */
  TL.banner = poi => {
    if (!poi || !mount()) return false;
    banPoi = poi; const col = colOf(poi), L = TL.lineFor(poi), h = houseOf(poi), H = houses();
    ban.style.setProperty('--hc', col); ban.style.setProperty('--hc2', col2Of(poi));
    ban.querySelector('.tl-crest b').textContent = ((h && H[h] && (H[h].n || H[h].name)) || poi.name || '?').charAt(0).toUpperCase();
    ban.querySelector('.tl-nm').textContent = poi.name || poi.id || '';
    ban.querySelector('.tl-sub').textContent = subFor(poi);
    const parts = L.items.slice(); if (L.quests) parts.push(L.quests + (L.quests === 1 ? ' quest' : ' quests')); if (L.turn) parts.push(L.turn + ' to hand in');
    ban.querySelector('.tl-list').textContent = parts.join(' · ') || 'Nothing for sale here';
    const b = ban.querySelector('.tl-svc'); b.style.display = L.svc ? '' : 'none';
    ban.classList.toggle('nosvc', !L.svc);
    if (!L.svc && parts.length) { let p = ban.querySelector('.tl-plain'); if (!p) { p = document.createElement('div'); p.className = 'tl-plain'; ban.querySelector('.tl-txt').appendChild(p); } p.textContent = parts.join(' · '); }
    else { const p = ban.querySelector('.tl-plain'); if (p) p.remove(); }
    ban.classList.remove('on', 'out'); void ban.offsetWidth; ban.classList.add('on'); banOn = true; banT = R.t || 0;
    TL.shownN = (TL.shownN || 0) + 1; TL.lastBanner = poi.id; placeBanner();
    return true; };
  TL.hideBanner = why => { if (!ban) return; if (banOn) TL.hideWhy = why || 'call'; banOn = false; ban.classList.remove('on'); ban.classList.add('out'); };

  // the message column: start at #hud-slot, then step below every visible obstacle the banner would meet
  const OBST = ['#hud-tl', '#hud-tr', '#ui>#prChat', '#bossbar', '#dgbar', '#evbar', '#tut:not(.off) .tut-wrap', '#hud-region.on', '#ctl-top'];
  const shownEl = el => { if (!el || !el.isConnected) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const obstacles = () => { const out = [];
    for (const s of OBST) for (const el of document.querySelectorAll(s)) if (shownEl(el)) out.push(el.getBoundingClientRect());
    for (const el of document.querySelectorAll('#ui>.toast, #ui>.ach-toast')) if (shownEl(el)) out.push(el.getBoundingClientRect());
    return out; };
  TL.obstacles = obstacles;
  const placeBanner = () => {
    if (!ban || !banOn) return;
    const vw = window.innerWidth, w = Math.min(vw - 24, 360), x = (vw - w) / 2, hgt = ban.offsetHeight || 96;
    const slot = document.getElementById('hud-slot'); let y = slot ? slot.getBoundingClientRect().top : 210;
    const obs = obstacles();
    for (let k = 0; k < 8; k++) { let moved = false;
      for (const r of obs) if (r.right > x + 2 && r.left < x + w - 2 && r.bottom > y - 4 && r.top < y + hgt + 4) { y = r.bottom + 10; moved = true; }
      if (!moved) break; }
    const ys = Math.round(y) + 'px'; if (ban.style.top !== ys) ban.style.top = ys;
    const ws = Math.round(w) + 'px'; if (ban.style.width !== ws) ban.style.width = ws;
  };
  TL.place = () => { placeBanner(); placeSigns(); };

  /* ---- visits: once per visit, waits while a screen is open ---- */
  TL.cur = null; TL.visits = {}; let pending = null;
  TL.poi = () => poiById(TL.cur);
  TL.check = () => {
    const P = R.player; if (!P) return;
    const cur = TL.cur ? poiById(TL.cur) : null;
    if (TL.cur && !cur) { TL.cur = null; pending = null; TL.hideBanner('gone'); }   // the POI went away (a swapped world, a test)
    if (cur) { const c = pxy(cur); if (Math.hypot(c.x - P.x, c.y - P.y) > radius(cur) + 200) { TL.cur = null; pending = null; R.bus.emit('town:leave', cur); if (banPoi === cur) TL.hideBanner('leave'); } }
    if (!TL.cur) { let best = null, bd = Infinity;
      for (const p of pois()) { if (!isTownish(p)) continue; const c = pxy(p), d = Math.hypot(c.x - P.x, c.y - P.y); if (d <= radius(p) + 30 && d < bd) { bd = d; best = p; } }
      if (best) { TL.cur = best.id; TL.visits[best.id] = (TL.visits[best.id] || 0) + 1; pending = best; R.bus.emit('town:enter', best); } }
    if (pending && !screenOpen() && !hudHidden() && !(R.dungeons && R.dungeons.active)) { const p = pending; pending = null; TL.banner(p); }
  };

  /* ---- service signs ---- */
  const signs = new Map(); let obsCache = [], obsT = 0, lastToast = 0;
  const mkSign = (key, svc) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tl-sign s-' + svc; b.dataset.svc = svc; b.dataset.key = key;
    b.setAttribute('aria-label', LABEL[svc] || svc);
    b.innerHTML = '<span class="tl-ic">' + (ICON[svc] || '') + '</span><span class="tl-lb">' + esc(LABEL[svc] || svc) + '</span>';
    b.addEventListener('click', ev => { ev.stopPropagation(); const s = signs.get(key); if (s) TL.tapSign(s); });
    layer.appendChild(b); return { key, svc, el: b, npc: null, x: -1e4, y: -1e4, d: 1e9, on: false, near: false, op: -1, tf: '' };
  };
  TL.open = (svc, e) => {
    const poi = poiOfEnt(e); R.bus.emit('town:service', svc, poi);
    try {
      if (svc === 'smith' || svc === 'shop' || svc === 'inn') { if (R.screens[svc]) return R.ui.open(svc, poi || undefined); }
      if (svc === 'board' && R.screens.board) return R.ui.open('board', e);
      if (e && R.screens.dialog) return R.ui.open('dialog', e);
    } catch (x) {}
    return null; };
  TL.tapSign = s => {
    const P = R.player, e = s.npc; if (!P || !e) return;
    const d = Math.hypot(e.x - P.x, e.y - P.y); hap('select');
    if (d <= TAP_R) { TL.open(s.svc, e); return; }
    if (performance.now() - lastToast < 600) return; lastToast = performance.now();
    const h = try_(() => R.w2s(P.x, P.y, 30), null); let arrow = '';
    if (h && !h.behind) { const k = Math.round(Math.atan2(s.y - h.y, s.x - h.x) / (Math.PI / 4)); arrow = ' ' + ARROWS[(k + 8) % 8]; }
    const who = WHO[s.svc] || 'it'; try { if (R.ui && R.ui.toast) R.ui.toast(who.charAt(0).toUpperCase() + who.slice(1) + ' is that way' + arrow + ' — walk closer', '#f3e7c4', 1800); } catch (x) {}
  };
  const rectHit = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
  const placeSigns = () => {
    if (!layer) return;
    const P = R.player, hide = !P || screenOpen() || hudHidden() || !R.w2s;
    const keep = new Set();
    if (!hide) {
      const now = performance.now(); if (now - obsT > 250) { obsT = now; obsCache = obstacles().concat([...document.querySelectorAll('#ctl .cb, #b-interact.on, #ctl-top')].filter(shownEl).map(el => el.getBoundingClientRect())); if (banOn && ban) obsCache.push(ban.getBoundingClientRect()); }
      const vw = R.vw || window.innerWidth, vh = R.vh || window.innerHeight;
      for (const e of npcEnts()) {
        const svc = svcOf(e); if (!svc) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d > FAR) continue;
        const key = String(e.dialog || e.id || (e.poi + ':' + svc)); keep.add(key);
        let s = signs.get(key); if (!s) { s = mkSign(key, svc); signs.set(key, s); }
        s.npc = e; s.d = d;
        const q = try_(() => R.w2s(e.x, e.y, 80), null), f = try_(() => R.w2s(e.x, e.y, 0), null);
        let on = !!(q && f && !q.behind && !f.behind);
        if (on) { const top = (q.y === f.y && q.x === f.x) ? f.y - 48 * (R.cam.z || 1) : q.y - 6; s.x = q.x; s.y = top - (e.mark ? 32 : 13);
        }
        const near = d <= LABEL_R;
        if (on) { const hw0 = near ? 62 : 24; if (s.x - hw0 < 2 || s.x + hw0 > vw - 2 || s.y < 50 || s.y > vh - 10) on = false; }
        if (on) { const hw = near ? 62 : 24, r = { left: s.x - hw, right: s.x + hw, top: s.y - 46, bottom: s.y };
          for (const o of obsCache) if (rectHit(r, o)) { on = false; break; } }
        const op = on ? Math.max(0, Math.min(1, 1 - (d - NEAR) / (FAR - NEAR))) : 0; if (op < .06) on = false;
        if (near !== s.near) { s.near = near; s.el.classList.toggle('near', near); }
        if (on !== s.on) { s.on = on; s.el.classList.toggle('on', on); }
        if (on) { const tf = 'translate3d(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px,0) translate(-50%,-100%)';
          if (tf !== s.tf) { s.tf = tf; s.el.style.transform = tf; }
          const o2 = Math.round(op * 20) / 20; if (o2 !== s.op) { s.op = o2; s.el.style.opacity = String(o2); }
          s.el.classList.toggle('tap', d <= TAP_R); }
      }
    }
    for (const [k, s] of signs) if (!keep.has(k)) { if (hide && s.npc && !s.npc.dead) { if (s.on) { s.on = false; s.el.classList.remove('on'); } continue; } s.el.remove(); signs.delete(k); }
  };
  TL.signs = () => [...signs.values()];

  /* ---- ambience: an anvil by day near the smith; chatter / bells only when 61_sfx knows them ---- */
  let forgeT = 0, chatT = 0, wasNight = null;
  const night = () => try_(() => (R.sfx && R.sfx.isNight ? !!R.sfx.isNight() : false), false);
  const firstHas = names => { for (const n of names) if (sfxHas(n)) return n; return null; };
  const ambience = dt => {
    if (!TL.cur || screenOpen() || !R.player) { wasNight = null; return; }
    const P = R.player, isN = night();
    forgeT -= dt; chatT -= dt;
    if (!isN && forgeT <= 0) { forgeT = 3.6 + Math.random() * 3;
      let best = null; for (const s of signs.values()) if (s.svc === 'smith' && s.d < 260 && (!best || s.d < best.d)) best = s;
      if (best && sfxHas('forge')) sfx('forge', +(0.22 * (1 - best.d / 300)).toFixed(3)); }
    if (!isN && chatT <= 0) { chatT = 6 + Math.random() * 5; const n = firstHas(['chatter', 'market', 'crowd', 'murmur']); if (n) sfx(n, 0.12); }
    if (wasNight !== null && wasNight !== isN) { const n = firstHas(['bells', 'bell', 'septBell']); const poi = TL.poi();
      const sept = poi && npcsAtPoi(poi).some(x => /septon/i.test(String(x.kind || x.role || ''))); if (n && sept) sfx(n, 0.25); }
    wasNight = isN; void P;
  };

  /* ---- the system: after the NPCs (70) and the camera, before the HUD (950) ---- */
  let acc = 0;
  const sys = { order: 920,
    update(dt) { try { if (!mount()) return; acc += dt; if (acc >= .25) { acc = 0; TL.check(); }
      if (banOn) { if (screenOpen()) { TL.hideBanner('screen:' + R.ui.cur); } else if ((R.t || 0) - banT > BAN_S) TL.hideBanner('time'); }
      placeSigns(); placeBanner(); ambience(dt); layer.classList.toggle('off', screenOpen() || hudHidden()); } catch (e) { if (!TL.err) { TL.err = String(e && e.message || e); console.warn('townlife', e); } } },
    draw() { try { placeSigns(); placeBanner(); } catch (e) {} } };
  try { if (R.addSys) R.addSys('townlife', sys); else if (R.sys) R.sys.townlife = sys; } catch (e) {}
  try { R.bus.on('screen', () => { if (layer) layer.classList.toggle('off', screenOpen()); }); } catch (e) {}
})();
