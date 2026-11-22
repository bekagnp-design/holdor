/* 43_towns.js — towns (A21): the SHOP (6 gear items of the day + potions for gold, a premium row for gems, a SELL tab),
   the INN (one big REST that heals to full and clears status, the innkeep's rumour; no "home": permadeath, Addendum 2) and the
   SMITH (UPGRADE +1..+5, REFORGE the secondary stat). Prices are paid from the current hero's gold / gems (R.state.p).
   Open: R.ui.open('shop' | 'inn' | 'smith' | 'town', poi) — from the NPC dialog (A20) or the HUD's TOWN button (A25); no poi → R.towns.inside().
   R.towns:
     inside()            → the town POI the player stands in (poi.shop === true, or a town/castle/city POI that says nothing) or null
     stock(poi)          → the 6 gear items of the UTC day for this POI (R.items.shopStock(poi, lvl, rng) when A15 is there, else rolled here)
     price(it) / sellPrice(it) / restCost() / upgradeCost(it) → {gold, mats} / mats() / cap() / mainStat(it) / open(which, poi)
   Soft deps, each with a fallback: R.items (shopStock, roll, price, sellPrice, add, cap, addSlots, upgradeCost, upgrade(it, {paid:true}), reforge(it, {paid:true})),
   R.player.gold(n) / R.player.gems(n) (else R.state.p + the 'gold' event), R.world.poiAt, R.data.world.pois, R.data.houses[h].col, R.data.story.rumours, R.fx, R.sfx.
   Events emitted: buy(item, price, cur), sell(item, gold), rest(poi), upgrade(item), reforge(item). */
(function () {
  const T = R.towns = R.towns || {};
  T.POTION = { small: 40, large: 120, largeN: 4 };
  T.PREMIUM = [
    { id: 'chest', name: 'Rare chest', sub: 'Rare or better', gems: 60, icon: 'chest' },
    { id: 'leg', name: 'Legendary roll', sub: 'one Legendary', gems: 300, icon: 'star' },
    { id: 'bag', name: '+10 bag slots', sub: 'more room', gems: 50, icon: 'bag' }];
  T.REFORGE_GEMS = 30; T.MAX_UP = 5;
  const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'], RCOL = ['#9fb6c9', '#7fd06a', '#5ea8ff', '#c07cff', '#e3b661'];
  const STAT = { atk: 'ATK', def: 'DEF', hp: 'HP', spd: 'SPD', crit: 'CRIT' }, MAIN = { weapon: 'atk', armor: 'def', trinket: 'hp' };
  const ROAD = { id: 'road', name: 'Wandering merchant', type: 'town', shop: true };
  const P = () => (R.state && R.state.p) || null;
  const day = () => Math.floor(Date.now() / 86400000);
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mkRng = seed => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const rnd = mkRng(Date.now() & 0x7fffffff);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = n => n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n | 0);
  const hap = k => { try { const H = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback; if (H && R.state && R.state.opts && R.state.opts.haptic) H.impactOccurred(k || 'light'); } catch (e) {} };
  const sfx = (n, v) => { if (R.sfx && R.sfx.play) try { R.sfx.play(n, v); } catch (e) {} };
  /* ---- icons, code-drawn ---- */
  const SVG = {
    gold: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#e3b661" stroke="#7a5417" stroke-width="1.5"/><circle cx="10" cy="10" r="4.6" fill="none" stroke="#7a5417" stroke-width="1.3"/></svg>',
    gem: '<svg viewBox="0 0 20 20"><path d="M4 7l3-4h6l3 4-6 10z" fill="#8fd3ff" stroke="#1f4f7a" stroke-width="1.3"/><path d="M4 7h12M7 3l3 4 3-4M10 7v10" fill="none" stroke="#1f4f7a" stroke-width="1"/></svg>',
    weapon: '<svg viewBox="0 0 24 24"><path d="M4 20l9-9" stroke="#cfd8e3" stroke-width="3" stroke-linecap="round"/><path d="M13 11l6-8 2 2-8 6z" fill="#e9eef5"/><path d="M7 14l3 3" stroke="#7a5417" stroke-width="3" stroke-linecap="round"/><circle cx="4.5" cy="19.5" r="1.8" fill="#e3b661"/></svg>',
    armor: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#6b7f95" stroke="#cfd8e3" stroke-width="1.5"/><path d="M12 6v12M8 10h8" stroke="#e9eef5" stroke-width="1.5"/></svg>',
    trinket: '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="6" fill="none" stroke="#e3b661" stroke-width="3"/><path d="M9 7l3-4 3 4z" fill="#8fd3ff" stroke="#1f4f7a"/></svg>',
    potion: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v5l-5 9c-1 2 0 4 2 4h10c2 0 3-2 2-4l-5-9V3" fill="#2a1a3a" stroke="#cfd8e3" stroke-width="1.5"/><path d="M7.5 15h9l2 3.5c.5 1 0 1.5-1 1.5H6.5c-1 0-1.5-.5-1-1.5z" fill="#e14b4b"/></svg>',
    mat: '<svg viewBox="0 0 24 24"><path d="M4 15l3-6h10l3 6z" fill="#8a8f99" stroke="#cfd8e3" stroke-width="1.5"/><path d="M7 9l2-3h6l2 3" fill="none" stroke="#cfd8e3" stroke-width="1.2"/></svg>',
    chest: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="2" fill="#6b4320" stroke="#e3b661" stroke-width="1.5"/><path d="M3 9a9 5 0 0118 0" fill="#8a5a2a" stroke="#e3b661" stroke-width="1.5"/><rect x="10.5" y="11" width="3" height="4" fill="#e3b661"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M8 7h8l3 10c.5 2-1 3-3 3H8c-2 0-3.5-1-3-3z" fill="#7a5417" stroke="#e3b661" stroke-width="1.5"/><path d="M9 7c0-3 6-3 6 0" fill="none" stroke="#e3b661" stroke-width="1.5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.3 4.6 1.7 7L12 17.5 5.6 21.2l1.7-7L2 9.6 9 9z" fill="#e3b661" stroke="#7a5417"/></svg>',
    mug: '<svg viewBox="0 0 24 24"><rect x="5" y="7" width="11" height="13" rx="2" fill="#c98a3a" stroke="#f3e7c4" stroke-width="1.5"/><path d="M16 10h2a2 2 0 010 4h-2" fill="none" stroke="#f3e7c4" stroke-width="1.5"/><path d="M5 7c2-3 9-3 11 0" fill="#f7f1dc"/></svg>',
    anvil: '<svg viewBox="0 0 24 24"><path d="M3 8h16l-4 4h-4v3h5v3H6v-3h3v-3H7z" fill="#5c6774" stroke="#cfd8e3" stroke-width="1.3"/></svg>' };
  const ico = (it, cls) => { const key = it && (SVG[it.icon] ? it.icon : SVG[it.kind] ? it.kind : 'mat'); const rc = it && it.rar != null ? RCOL[it.rar | 0] : null;
    return `<div class="tw-ico ${cls || ''}" ${rc ? `style="--rc:${rc}"` : ''}>${SVG[key]}</div>`; };
  /* ---- wallet ---- */
  const gold = () => { const p = P(); return p ? (p.gold | 0) : 0; }, gems = () => { const p = P(); return p ? (p.gems | 0) : 0; };
  const addGold = n => { const p = P(); if (!p || !n) return; if (R.player && typeof R.player.gold === 'function') R.player.gold(n); else { p.gold = Math.max(0, (p.gold | 0) + n); R.bus.emit('gold', n); } };
  const addGems = n => { const p = P(); if (!p || !n) return; if (R.player && typeof R.player.gems === 'function') R.player.gems(n); else { p.gems = Math.max(0, (p.gems | 0) + n); R.bus.emit('gems', n); } };
  /* ---- items ---- */
  const I = () => R.items || null;
  T.mainStat = it => { if (!it) return 'atk'; const st = it.stats || {}; const m = MAIN[it.kind]; if (m && st[m] != null) return m; let best = m || 'atk', bv = -Infinity; for (const k in st) if (st[k] > bv) { bv = st[k]; best = k; } return best; };
  T.sellPrice = it => { const i = I(); if (i && i.sellPrice) return Math.max(0, i.sellPrice(it) | 0); if (!it) return 0; if (it.kind === 'mat') return 3 * (it.n || 1); if (it.kind === 'potion') return 10;
    return Math.round((8 + 6 * (it.lvl || 1)) * [1, 1.6, 2.6, 4.2, 7][it.rar | 0] * (1 + .25 * (it.up | 0))); };
  T.price = it => { const i = I(); if (i && i.price) return Math.max(1, i.price(it) | 0); return T.sellPrice(it) * 4; };
  const NAMES = { weapon: ['Castle-forged sword', 'Hunting bow', 'Bronze axe', 'Ironwood spear', 'Riverland dirk', 'Steel longsword'],
    armor: ['Boiled leather', 'Ringmail', 'Northern furs', 'Plate cuirass', 'Padded gambeson', 'Scale hauberk'],
    trinket: ['Wolf tooth', 'Weirwood charm', 'Silver ring', 'Raven feather', 'Dragonglass shard', 'Sept medallion'] };
  const BASE = { atk: [6, 2], def: [4, 1.2], hp: [30, 9], spd: [3, .3], crit: [2, .15] };
  const fakeRoll = (lvl, rar, rng, kind) => { rng = rng || rnd; kind = kind || ['weapon', 'armor', 'trinket'][Math.floor(rng() * 3)]; rar = rar | 0; const mul = 1 + rar * .35, m = MAIN[kind], st = {};
    st[m] = Math.round((BASE[m][0] + lvl * BASE[m][1]) * mul);
    if (rar >= 1) { const ks = Object.keys(BASE).filter(k => k !== m); const k = ks[Math.floor(rng() * ks.length)]; st[k] = Math.max(1, Math.round((BASE[k][0] + lvl * BASE[k][1]) * (.6 + rar * .2))); }
    const nm = NAMES[kind]; return { id: 'f' + Math.floor(rng() * 1e9).toString(36), kind, name: nm[Math.floor(rng() * nm.length)], rar, lvl, stats: st, icon: kind }; };
  const roll = (lvl, rar, rng) => { const i = I(); if (i && i.roll) { try { const it = i.roll(lvl, rar); if (it) return it; } catch (e) { console.warn('items.roll', e); } } return fakeRoll(lvl, rar, rng); };
  T.cap = () => { const i = I(); if (i && typeof i.cap === 'function') return i.cap() | 0; const p = P(); return (p && p.flags && p.flags.invSlots) || (R.data.balance && R.data.balance.invSlots) || 20; };
  const inv = () => { const p = P(); if (!p) return []; return p.inv = p.inv || []; };
  const give = it => { const i = I(); if (i && i.add) { try { return i.add(it) !== false; } catch (e) { console.warn('items.add', e); } } if (inv().length >= T.cap()) return false; inv().push(it); return true; };
  T.mats = () => inv().reduce((n, it) => n + (it.kind === 'mat' ? (it.n || 1) : 0), 0);
  const takeMats = n => { const L = inv(); for (let k = L.length - 1; k >= 0 && n > 0; k--) { const it = L[k]; if (it.kind !== 'mat') continue; const q = it.n || 1; if (q <= n) { n -= q; L.splice(k, 1); } else { it.n = q - n; n = 0; } } };
  /* ---- the stock of the day ---- */
  const cache = {};
  T.stock = poi => { poi = poi || ROAD; const p = P(), lvl = p ? (p.lvl | 0) || 1 : 1, key = poi.id + ':' + day() + ':' + lvl; if (cache[key]) return cache[key];
    const rng = mkRng(hash(poi.id + ':' + day())); let list = null; const i = I();
    if (i && i.shopStock) { try { list = i.shopStock(poi, lvl, rng); } catch (e) { console.warn('items.shopStock', e); } }
    if (!list || !list.length) { list = []; const rars = [0, 0, 1, 1, 2, rng() < .25 ? 3 : 2], kinds = ['weapon', 'armor', 'trinket', 'weapon', 'armor', 'trinket']; for (let k = 0; k < 6; k++) list.push(roll(Math.max(1, lvl + (k % 3) - 1), rars[k], rng) || fakeRoll(lvl, rars[k], rng, kinds[k])); }
    // a house's sigil ring is sold only on that house's ground (no direwolf rings at Casterly Rock): others are re-rolled
    const SIG = { t_ring_wolf: 'stark', t_ring_lion: 'lannister', t_ring_stag: 'baratheon' }, W = R.data.world;
    const home = poi.house || (W && W.regionById && poi.region && W.regionById[poi.region] && W.regionById[poi.region].home) || null;
    const foreign = it => !!(it && SIG[it.base] && SIG[it.base] !== home);
    list = list.map(it => { if (!foreign(it)) return it; for (let k = 0; k < 4; k++) { const r = roll(Math.max(1, it.lvl || lvl), it.rar | 0, rng); if (r && !foreign(r)) return r; } return fakeRoll(it.lvl || lvl, it.rar | 0, rng, it.kind); }).filter(Boolean);
    return cache[key] = list.slice(0, 6); };
  const soldKey = poi => poi.id + ':' + day();
  const sold = poi => { const p = P(); if (!p) return []; const f = p.flags = p.flags || {}; const S = f.shopSold = f.shopSold || {}; const k = soldKey(poi); for (const q in S) if (q !== k) delete S[q]; return S[k] = S[k] || []; };
  /* ---- services ---- */
  T.restCost = () => { const p = P(), l = p ? (p.lvl | 0) || 1 : 1; return l < 5 ? 0 : Math.round(20 * l / 5); };
  // 30_items prices an upgrade in typed mats ({iron, dust, glass}); the smith counts them as one number of materials from the bag
  const matN = m => m && typeof m === 'object' ? Object.values(m).reduce((a, v) => a + (v | 0), 0) : m | 0;
  T.upgradeCost = it => { const i = I(); if (i && i.upgradeCost) { try { const c = i.upgradeCost(it); if (c) return { gold: c.gold | 0, mats: matN(c.mats) }; } catch (e) {} } const up = it ? (it.up | 0) : 0, lvl = it ? (it.lvl | 0) || 1 : 1; return { gold: Math.round((40 + 12 * lvl) * (1 + up) * (1 + .3 * (it ? it.rar | 0 : 0))), mats: 2 + up }; };
  T.canUpgrade = it => !!it && /^(weapon|armor|trinket)$/.test(it.kind) && (it.up | 0) < T.MAX_UP;
  // the smith has already taken the gold and the mats: 30_items' upgrade(it, mats) charges gold itself and checks a typed mats purse,
  // so it gets the gold back for the call and a purse that holds exactly its typed cost; when it still refuses, the local step applies
  const upgrade = it => { const i = I(); if (i && i.upgrade) { try { const c = i.upgradeCost ? i.upgradeCost(it) : null, p = P();
      const purse = c && c.mats && typeof c.mats === 'object' ? Object.assign({}, c.mats) : { paid: true }; const g = c && p ? (c.gold | 0) : 0; if (p) p.gold = (p.gold || 0) + g;
      const r = i.upgrade(it, purse); if (r && r.ok === false) { if (p) p.gold -= g; } else { if (r && r !== it && r.id) Object.assign(it, r); return true; } } catch (e) { console.warn('items.upgrade', e); } }
    it.up = (it.up | 0) + 1; it.lvl = (it.lvl | 0) + 1; const st = it.stats = it.stats || {}; for (const k in st) st[k] = k === 'crit' || k === 'spd' ? Math.round((st[k] + .5) * 10) / 10 : Math.max(st[k] + 1, Math.round(st[k] * 1.1)); return true; };
  const reforge = it => { const i = I(); if (i && i.reforge) { try { const r = i.reforge(it, { paid: true }); if (r && r !== it && r.id) Object.assign(it, r); return true; } catch (e) { console.warn('items.reforge', e); } }
    const m = T.mainStat(it), st = it.stats = it.stats || {}; const old = Object.keys(st).find(k => k !== m); const ks = Object.keys(BASE).filter(k => k !== m && k !== old); const k = ks[Math.floor(rnd() * ks.length)];
    if (old) delete st[old]; st[k] = Math.max(1, Math.round((BASE[k][0] + (it.lvl | 0) * BASE[k][1]) * (.6 + (it.rar | 0) * .2) * (1 + .1 * (it.up | 0)))); return true; };
  /* ---- where am I ---- */
  const isTown = q => !!q && (q.shop === true || q.inn === true || q.smith === true || (q.shop == null && /^(town|castle|city|seat|market)$/.test(q.type || '')));
  T.inside = () => { const pl = R.player; if (!pl) return null; let poi = null;
    if (R.world && R.world.poiAt) { try { poi = R.world.poiAt(pl.x, pl.y, 0) || null; } catch (e) { poi = null; } }
    if (poi && !isTown(poi)) poi = null;
    if (!poi && R.data.world && R.data.world.pois) { let bd = Infinity; for (const q of R.data.world.pois) { if (!isTown(q)) continue; const rr = q.r || 140, d = Math.hypot((q.x || 0) - pl.x, (q.y || 0) - pl.y); if (d <= rr && d < bd) { bd = d; poi = q; } } }
    return poi; };
  T.open = (which, poi) => R.ui.open(which || 'shop', poi || T.inside() || ROAD);
  /* ---- shared frame ---- */
  const RUMOURS = ['Wolves came down past the mill last night. Keep to the road after dark.', 'A rider paid in gems and asked for the smith by name. Odd folk about.',
    'The old shrine north of here still answers prayers, they say. I say it answers coin.', 'Travellers from the Wall drink fast and sleep badly. Something stirs up there.',
    'The caravan is late again. Bandits, or worse, on the kingsroad.', 'Keep your blade oiled. Cold iron rusts, and the cold is coming south.',
    'A septon sold me a charm against the dead. I am still here, so maybe it works.', 'Rest easy. The door is barred and the hearth is lit. Nothing gets in here.'];
  const rumour = poi => { const S = R.data.story; let rs = S && (S.rumours || S.rumors || (S.inn && S.inn.rumours)); if (rs && !Array.isArray(rs)) rs = rs[poi.id] || rs.all || null; if (!Array.isArray(rs) || !rs.length) rs = RUMOURS; return rs[hash(poi.id + ':' + day()) % rs.length]; };
  const frame = (el, poi, which, sub) => { const p = P(), house = p && (p.house || (R.state.acc && R.state.acc.house)), h = house && R.data.houses && R.data.houses[house], acc = h && h.col; el.innerHTML = ''; const root = document.createElement('div'); root.className = 'tw tw-' + which; if (acc) root.style.setProperty('--acc', acc);
    const tabs = [['shop', 'SHOP'], ['inn', 'INN'], ['smith', 'SMITH']].filter(([k]) => poi[k] !== false);
    root.innerHTML = `<div class="tw-head"><button class="tw-back" aria-label="Back">‹</button><div class="tw-title"><b>${esc(poi.name || 'Town')}</b><span>${esc(sub)}</span></div>
      <div class="tw-bal"><span class="tw-coin g">${SVG.gold}<b>${fmt(gold())}</b></span><span class="tw-coin d">${SVG.gem}<b>${fmt(gems())}</b></span></div></div>
      <div class="tw-tabs" style="grid-template-columns:repeat(${tabs.length},1fr)">${tabs.map(([k, t]) => `<button data-t="${k}" class="${k === which ? 'on' : ''}">${t}</button>`).join('')}</div><div class="tw-body"></div>`;
    root.querySelector('.tw-back').onclick = () => { hap(); R.ui.close(); };
    root.querySelectorAll('.tw-tabs button').forEach(b => { b.onclick = () => { if (b.dataset.t !== which) { hap(); R.ui.open(b.dataset.t, poi); } }; });
    el.appendChild(root); return root.querySelector('.tw-body'); };
  const refreshBal = root => { const b = root.querySelectorAll('.tw-bal b'); if (b[0]) b[0].textContent = fmt(gold()); if (b[1]) b[1].textContent = fmt(gems()); };
  const flash = (txt, col) => { const d = document.createElement('div'); d.className = 'tw-flash'; d.innerHTML = `<b style="${col ? 'color:' + col : ''}">${esc(txt)}</b>`; (document.getElementById('screen') || document.body).appendChild(d); setTimeout(() => d.remove(), 950); hap('medium'); };
  // a potion or a material has no main stat to compare: say what it does instead of "ATK 0 ▲ new"
  const useLine = it => { const st = it.stats || {}, heal = it.heal || st.heal || st.hp || 0; return it.kind === 'potion' ? `<span>${heal ? 'Heals <b>' + heal + '</b>' : 'Restores health'}</span>` : `<span>${esc(it.kind === 'mat' ? 'Material' : (it.kind || 'Item'))}</span>`; };
  const cmpLine = it => { if (!it || !/^(weapon|armor|trinket)$/.test(it.kind)) return useLine(it || {}); const p = P(), k = T.mainStat(it), v = (it.stats || {})[k] | 0, eq = p && p.gear && p.gear[it.kind], ev = eq ? ((eq.stats || {})[k] | 0) : null;
    const d = ev == null ? null : v - ev; const tag = d == null ? '<em class="up">▲ new</em>' : d > 0 ? `<em class="up">▲ +${d}</em>` : d < 0 ? `<em class="dn">▼ ${d}</em>` : '<em class="eq">= same</em>';
    return `<span>${STAT[k] || k.toUpperCase()} <b>${v}</b></span>${tag}`; };
  const buyBtn = (cur, price, attr, label) => { const have = cur === 'gems' ? gems() : gold(), can = have >= price; const chip = `<span class="tw-chip ${cur === 'gems' ? 'd' : ''}">${cur === 'gems' ? SVG.gem : SVG.gold}${fmt(price)}</span>`;
    return `<button class="tw-buy ${can ? 'ok' : 'need'}" ${attr} ${can ? '' : 'disabled'}>${can ? (label || 'BUY') + chip : 'Need ' + fmt(price - have) + ' more'}</button>`; };
  /* ---- SHOP ---- */
  let seg = 'buy';
  const shopBody = (body, poi) => { const p = P(); if (!p) { body.innerHTML = '<p class="tw-empty">No save yet.</p>'; return; } const stock = T.stock(poi), gone = sold(poi), pots = p.potions = p.potions || { hp: 0, mana: 0 };
    let h = `<div class="tw-seg"><button data-s="buy" class="${seg === 'buy' ? 'on' : ''}">BUY</button><button data-s="sell" class="${seg === 'sell' ? 'on' : ''}">SELL <small>${inv().length}/${T.cap()}</small></button></div>`;
    if (seg === 'buy') {
      h += '<div class="tw-grid">' + stock.map((it, i) => `<div class="tw-card gear r${it.rar | 0} ${gone.includes(i) ? 'sold' : ''}" data-i="${i}"><div class="tw-top">${ico(it)}<div class="tw-nm"><b>${esc(it.name)}</b><i style="color:${RCOL[it.rar | 0]}">${RAR[it.rar | 0]} · Lv ${it.lvl | 0}</i></div></div>
        <div class="tw-st">${cmpLine(it)}</div>${gone.includes(i) ? '<button class="tw-buy sold" disabled>SOLD</button>' : buyBtn('gold', T.price(it), `data-buy="g:${i}"`)}</div>`).join('') + '</div>';
      h += `<div class="tw-row pots"><div class="tw-card pot"><div class="tw-top">${ico({ kind: 'potion' })}<div class="tw-nm"><b>Potion ×1</b><i>Have ${pots.hp | 0}</i></div></div>${buyBtn('gold', T.POTION.small, 'data-buy="p:small"')}</div>
        <div class="tw-card pot"><div class="tw-top">${ico({ kind: 'potion' }, 'big')}<div class="tw-nm"><b>Potions ×${T.POTION.largeN}</b><i>Save ${T.POTION.small * T.POTION.largeN - T.POTION.large} gold</i></div></div>${buyBtn('gold', T.POTION.large, 'data-buy="p:large"')}</div></div>`;
      h += '<div class="tw-row prem">' + T.PREMIUM.map(x => `<div class="tw-card prem">${ico({ icon: x.icon, rar: x.id === 'leg' ? 4 : x.id === 'chest' ? 2 : null })}<b>${esc(x.name)}</b><i>${esc(x.sub)}</i>${buyBtn('gems', x.gems, `data-buy="x:${x.id}"`)}</div>`).join('') + '</div>';
    } else {
      const L = inv(), commons = L.filter(it => (it.rar | 0) === 0 && it.kind !== 'mat' && it.kind !== 'potion'), cg = commons.reduce((n, it) => n + T.sellPrice(it), 0);
      h += `<div class="tw-sellhead"><span>${L.length} / ${T.cap()} in the bag</span><button class="tw-sellall" ${commons.length ? '' : 'disabled'}>SELL ALL COMMONS${commons.length ? ` <span class="tw-chip">${SVG.gold}+${fmt(cg)}</span>` : ''}</button></div>`;
      h += L.length ? '<div class="tw-list">' + L.map((it, i) => `<div class="tw-srow r${it.rar | 0}">${ico(it)}<div class="tw-nm"><b>${esc(it.name)}${it.up ? ' +' + it.up : ''}${it.n > 1 ? ' ×' + it.n : ''}</b><i style="color:${RCOL[it.rar | 0]}">${it.kind === 'mat' ? 'Material' : it.kind === 'potion' ? 'Potion' : RAR[it.rar | 0] + ' · Lv ' + (it.lvl | 0)}</i></div>
        <button class="tw-sell" data-sell="${i}">SELL <span class="tw-chip">${SVG.gold}+${fmt(T.sellPrice(it))}</span></button></div>`).join('') + '</div>' : '<p class="tw-empty">Your bag is empty. Loot comes from the field.</p>';
    }
    body.innerHTML = h;
    body.querySelectorAll('.tw-seg button').forEach(b => { b.onclick = () => { seg = b.dataset.s; hap(); shopBody(body, poi); }; });
    body.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => buy(b.dataset.buy, poi, body); });
    body.querySelectorAll('[data-sell]').forEach(b => { b.onclick = () => { const it = inv()[+b.dataset.sell]; if (!it) return; const g = T.sellPrice(it); inv().splice(+b.dataset.sell, 1); addGold(g); R.bus.emit('sell', it, g); sfx('coin', .6); hap(); R.ui.toast(`Sold ${it.name} · +${g} gold`, '#f1cf7a'); R.save(); redraw(body, poi); }; });
    const all = body.querySelector('.tw-sellall'); if (all) all.onclick = () => { const L = inv(); let g = 0, n = 0; for (let k = L.length - 1; k >= 0; k--) { const it = L[k]; if ((it.rar | 0) === 0 && it.kind !== 'mat' && it.kind !== 'potion') { g += T.sellPrice(it); L.splice(k, 1); n++; } } if (!n) return; addGold(g); R.bus.emit('sell', null, g); sfx('coin', .7); hap('medium'); R.ui.toast(`Sold ${n} Commons · +${g} gold`, '#f1cf7a'); R.save(); redraw(body, poi); }; };
  const redraw = (body, poi) => { const root = body.closest('.tw'); if (root) refreshBal(root); shopBody(body, poi); };
  const buy = (code, poi, body) => { const p = P(); if (!p) return; const [t, k] = code.split(':'); let price, cur = 'gold', done = null;
    if (t === 'g') { const i = +k, it = T.stock(poi)[i]; if (!it || sold(poi).includes(i)) return; price = T.price(it); if (gold() < price) return need(price - gold()); if (inv().length >= T.cap() && !(I() && I().add)) return full();
      done = () => { if (!give(it)) return full(), false; sold(poi).push(i); R.bus.emit('buy', it, price, cur); R.ui.toast(`${it.name} is yours`, RCOL[it.rar | 0]); }; }
    else if (t === 'p') { const big = k === 'large'; price = big ? T.POTION.large : T.POTION.small; if (gold() < price) return need(price - gold()); done = () => { const pots = p.potions = p.potions || { hp: 0, mana: 0 }; pots.hp = (pots.hp | 0) + (big ? T.POTION.largeN : 1); R.bus.emit('buy', { kind: 'potion', n: big ? T.POTION.largeN : 1 }, price, cur); R.ui.toast(`+${big ? T.POTION.largeN : 1} potion${big ? 's' : ''} · have ${pots.hp}`, '#ff8f8f'); }; }
    else if (t === 'x') { const x = T.PREMIUM.find(q => q.id === k); if (!x) return; cur = 'gems'; price = x.gems; if (gems() < price) return need(price - gems(), true);
      if (k === 'bag') done = () => { const i = I(); if (i && i.addSlots) i.addSlots(10); else { p.flags = p.flags || {}; p.flags.invSlots = T.cap() + 10; } R.bus.emit('buy', { kind: 'slots', n: 10 }, price, cur); flash('+10 SLOTS', '#8fd3ff'); R.ui.toast(`Bag: ${T.cap()} slots`, '#8fd3ff'); };
      else { if (inv().length >= T.cap() && !(I() && I().add)) return full(); const lvl = (p.lvl | 0) || 1; done = () => { const r = rnd(), rar = k === 'leg' ? 4 : r < .06 ? 4 : r < .3 ? 3 : 2, it = roll(lvl, rar, rnd); if (!it || !give(it)) return full(), false; R.bus.emit('buy', it, price, cur); R.bus.emit('loot', it); flash(RAR[it.rar | 0].toUpperCase() + '!', RCOL[it.rar | 0]); R.ui.toast(`${it.name} · ${RAR[it.rar | 0]}`, RCOL[it.rar | 0]); }; } }
    if (!done) return; if (done() === false) return; (cur === 'gems' ? addGems : addGold)(-price); sfx(cur === 'gems' ? 'gem' : 'coin', .7); hap(); R.save(); if (body) redraw(body, poi);
    function need(n, g) { R.ui.toast(`Need ${fmt(n)} more ${g ? 'gems' : 'gold'}`, '#e14b4b'); } function full() { R.ui.toast(`Bag full · ${inv().length}/${T.cap()}`, '#e14b4b'); } };
  R.screens.shop = { open: (poi, el) => { poi = poi || T.inside() || ROAD; el = el || document.getElementById('screen'); seg = 'buy'; shopBody(frame(el, poi, 'shop', 'Market'), poi); }, close: () => {} };
  R.screens.town = { open: (poi, el) => R.screens.shop.open(poi, el), close: () => {} };
  /* ---- INN ---- */
  const ailments = pl => pl && pl.status ? Object.keys(pl.status).filter(k => pl.status[k] && k !== 'shield') : [];
  const innBody = (body, poi) => { const p = P(); if (!p) { body.innerHTML = '<p class="tw-empty">No save yet.</p>'; return; } const pl = R.player, hp = pl ? Math.round(pl.hp) : (p.hp | 0), hpMax = pl ? Math.round(pl.hpMax || pl.hp || 1) : Math.max(1, p.hp | 0);
    const ail = ailments(pl), cost = T.restCost(), can = gold() >= cost, needRest = hp < hpMax || ail.length > 0;
    body.innerHTML = `<div class="tw-inn"><div class="tw-keeper"><div class="tw-face">${SVG.mug}</div><div><b>Innkeep</b><p class="tw-rumour">“${esc(rumour(poi))}”</p></div></div>
      <div class="tw-vit"><div class="tw-vrow"><span>Your health</span><b class="${hp < hpMax ? 'dn' : 'up'}">${hp} / ${hpMax}</b></div><div class="tw-bar"><i style="width:${Math.round(100 * hp / hpMax)}%"></i></div>
        <div class="tw-vrow"><span>Ailments</span><b class="${ail.length ? 'dn' : 'up'}">${ail.length ? ail.map(k => k[0].toUpperCase() + k.slice(1)).join(', ') : 'none'}</b></div></div>
      <button class="pri tw-rest" ${can ? '' : 'disabled'}>${can ? (needRest ? 'REST' : 'REST · already fresh') + (cost ? ` · ${fmt(cost)} gold` : ' · free') : 'Need ' + fmt(cost - gold()) + ' more'}</button>
      <p class="tw-hint">A night here heals you to full and clears every ailment. ${cost ? `The room costs ${fmt(cost)} gold at your level.` : 'The room is free until level 5.'}</p></div>`;
    body.querySelector('.tw-rest').onclick = () => { if (gold() < cost) return; addGold(-cost); if (pl) { pl.hp = pl.hpMax || pl.hp; pl.anim = 'idle'; if (pl.status) for (const k of Object.keys(pl.status)) if (k !== 'shield') delete pl.status[k]; } p.hp = pl ? pl.hp : p.hp;
      R.bus.emit('rest', poi); sfx('heal', .8); flash('RESTED', '#7fd06a'); R.ui.toast(cost ? `Rested · −${cost} gold` : 'Rested · on the house', '#7fd06a'); R.save(); const root = body.closest('.tw'); if (root) refreshBal(root); innBody(body, poi); }; };
  R.screens.inn = { open: (poi, el) => { poi = poi || T.inside() || ROAD; el = el || document.getElementById('screen'); innBody(frame(el, poi, 'inn', 'Inn'), poi); }, close: () => {} };
  /* ---- SMITH ---- */
  let pick = null;
  const gearList = () => { const p = P(); if (!p) return []; const out = []; p.gear = p.gear || {}; for (const k of ['weapon', 'armor', 'trinket']) if (p.gear[k]) out.push({ it: p.gear[k], ref: 'e:' + k, eq: true }); inv().forEach((it, i) => { if (/^(weapon|armor|trinket)$/.test(it.kind)) out.push({ it, ref: 'i:' + i }); }); return out; };
  const smithBody = (body, poi) => { const p = P(); if (!p) { body.innerHTML = '<p class="tw-empty">No save yet.</p>'; return; } const L = gearList(); if (!L.some(x => x.ref === pick)) pick = L.length ? L[0].ref : null; const sel = L.find(x => x.ref === pick), it = sel && sel.it;
    let h = `<div class="tw-smith"><div class="tw-pick">${L.length ? L.map(x => `<button class="tw-prow r${x.it.rar | 0} ${x.ref === pick ? 'on' : ''}" data-pick="${x.ref}">${ico(x.it)}<span class="tw-nm"><b>${esc(x.it.name)}${x.it.up ? ' +' + x.it.up : ''}</b><i style="color:${RCOL[x.it.rar | 0]}">${RAR[x.it.rar | 0]} · Lv ${x.it.lvl | 0}${x.eq ? ' · equipped' : ''}</i></span><em>${STAT[T.mainStat(x.it)]} ${(x.it.stats || {})[T.mainStat(x.it)] | 0}</em></button>`).join('') : '<p class="tw-empty">Nothing to work on. Bring gear.</p>'}</div>`;
    if (it) { const c = T.upgradeCost(it), max = (it.up | 0) >= T.MAX_UP, m = T.mainStat(it), st = it.stats || {}, sec = Object.keys(st).find(k => k !== m), mats = T.mats(), canG = gold() >= c.gold, canM = mats >= c.mats;
      const why = max ? `MAX +${T.MAX_UP}` : !canM ? `Need ${c.mats - mats} more mats` : !canG ? `Need ${fmt(c.gold - gold())} more gold` : '';
      h += `<div class="tw-forge"><div class="tw-fhead">${ico(it)}<div class="tw-nm"><b>${esc(it.name)}${it.up ? ' +' + it.up : ''}</b><i>${Object.keys(st).map(k => `${STAT[k] || k} ${st[k]}`).join(' · ')}</i></div><div class="tw-face sm">${SVG.anvil}</div></div>
        <button class="pri tw-up" ${why ? 'disabled' : ''}>${why || `UPGRADE +${(it.up | 0) + 1} <span class="tw-chip">${SVG.mat}${c.mats} · ${SVG.gold}${fmt(c.gold)}</span>`}</button>
        <div class="tw-fmeta">You have <b>${mats}</b> mats · ${(it.up | 0)}/${T.MAX_UP} steps</div>
        <button class="tw-ref" ${gems() >= T.REFORGE_GEMS ? '' : 'disabled'}>${gems() >= T.REFORGE_GEMS ? `REFORGE ${sec ? STAT[sec] || sec : 'a bonus'} <span class="tw-chip d">${SVG.gem}${T.REFORGE_GEMS}</span>` : `Need ${T.REFORGE_GEMS - gems()} more gems`}</button></div>`; }
    body.innerHTML = h + '</div>';
    body.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => { pick = b.dataset.pick; hap(); smithBody(body, poi); }; });
    const up = body.querySelector('.tw-up'); if (up) up.onclick = () => { const c = T.upgradeCost(it); if (!T.canUpgrade(it) || gold() < c.gold || T.mats() < c.mats) return; addGold(-c.gold); takeMats(c.mats); upgrade(it); R.bus.emit('upgrade', it); sfx('forge', .9); if (R.fx && R.fx.shake) try { R.fx.shake(4, .2); } catch (e) {} flash(`+${it.up | 0}`, '#ffe9a8'); R.ui.toast(`${it.name} +${it.up | 0}`, '#f1cf7a'); R.save(); const root = body.closest('.tw'); if (root) refreshBal(root); smithBody(body, poi); };
    const rf = body.querySelector('.tw-ref'); if (rf) rf.onclick = () => { if (gems() < T.REFORGE_GEMS) return; addGems(-T.REFORGE_GEMS); reforge(it); R.bus.emit('reforge', it); sfx('forge', .7); const m = T.mainStat(it), k = Object.keys(it.stats || {}).find(q => q !== m); flash(k ? `${STAT[k] || k} ${it.stats[k]}` : 'REFORGED', '#8fd3ff'); R.save(); const root = body.closest('.tw'); if (root) refreshBal(root); smithBody(body, poi); }; };
  R.screens.smith = { open: (poi, el) => { poi = poi || T.inside() || ROAD; el = el || document.getElementById('screen'); smithBody(frame(el, poi, 'smith', 'Smithy'), poi); }, close: () => {} };
})();
