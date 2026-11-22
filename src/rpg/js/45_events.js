/* 45_events.js — world events that make the map feel alive (A23).
   Every 4–7 minutes of play one event starts near the player (never inside a POI, never in a dungeon):
     horde    12–18 wights march along the road to the nearest castle; kill them all in 3:00 → a chest (rar 2) + 15 gems; else they vanish and
              the castle is "raided" for a day (R.state.p.flags['raided:'+poiId] = until ms) → R.events.priceMul(poiId) = 1.3 for the innkeep.
     caravan  a wagon NPC {kind:'npc', dialog:'caravan', interact()} on the road for 2:00 with 3 items at −30 % (R.items.shopStock);
              R.events.openCaravan() opens the shop screen with the poi {id:'caravan', name:'Caravan', stock, disc}.
     dragon   a shadow sweeps over the screen for 6 s with a roar; mobs within 400 flee 5 s (status.flee / ai.state 'flee'); the sky reddens.
     elite    one named elite mob (×4 hp) wanders nearby for 4:00; it drops a guaranteed Rare.
   API: R.data.events (config), R.events = { active, nextAt, start(id, o), stop(result), openCaravan(), raided(poiId), priceMul(poiId), dirText(x,y), mobs() }.
   Bus: event(id, 'start'|'done'|'fail'). Mobs spawned here carry e.event = id and e.persist = true. Deterministic with R.rng. */
(function () {
  const EV = R.data.events = {
    horde: { title: 'A horde marches on {poi}', ico: '⚔', col: '#7fd0ff', dur: 180, min: 12, max: 18, spd: 105, gems: 15, chestRar: 2, w: 4,
      types: ['wight', 'crypt', 'crawler', 'wraith', 'shade', 'walker'] },
    caravan: { title: 'A merchant caravan rests by the road', ico: '⚖', col: '#e3b661', dur: 120, items: 3, disc: 0.3, w: 3 },
    dragon: { title: 'A dragon passes overhead', ico: '☄', col: '#ff6a2a', dur: 6, fleeR: 400, fleeT: 5, w: 2 },
    elite: { title: '{name} roams nearby', ico: '♛', col: '#c86bff', dur: 240, hpMul: 4, atkMul: 1.5, rar: 2, w: 3, types: ['sword', 'axe', 'walker', 'chief', 'berserk', 'thenn'],
      names: ['Garrik the Flayer', 'Mord Halfhand', 'Yorren the Pale', 'Brusco Bloodeye', 'Harl Ninefingers', 'Ser Olyvar the Grey', 'Tormo Saltbeard', 'Wyl the Quiet'] },
    gapMin: 240, gapMax: 420, retry: 20, raidMs: 86400000, raidMul: 1.3, spawnD: [450, 650]
  };
  const rng = () => R.rng();
  const S = () => R.state && R.state.p;
  const W = () => R.data.world || null;
  const pt = p => Array.isArray(p) ? { x: +p[0], y: +p[1] } : (p && typeof p.x === 'number') ? { x: p.x, y: p.y } : null;
  const roads = () => { const w = W(); if (!w || !w.roads) return []; return w.roads.map(r => (Array.isArray(r) ? r : (r.pts || r.points || r.path || [])).map(pt).filter(Boolean)).filter(r => r.length > 1); };
  const pois = () => { const w = W(); return (w && (w.pois || w.poi)) || []; };
  const poiR = p => p.r || p.rad || 140;
  const poiType = p => (p.type || p.kind || '') + '';
  const inPoi = (x, y) => { if (R.world && R.world.poiAt) { try { if (R.world.poiAt(x, y, 0)) return true; } catch (e) {} } return pois().some(p => Math.hypot(p.x - x, p.y - y) < poiR(p)); };
  const blocked = (x, y) => { try { return !!(R.world && R.world.blocked && R.world.blocked(x, y)); } catch (e) { return false; } };
  const alive = e => !!e && !e.dead && R.ents.indexOf(e) >= 0;
  const player = () => R.player && !R.player.dead ? R.player : null;
  const lvl = () => (S() && S().lvl) || 1;
  const fmtT = s => { s = Math.max(0, Math.ceil(s - 1e-4)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
  /* a free spot: not in a POI, not blocked; jitters around (x,y) up to 12 times */
  const freeSpot = (x, y, spread) => { for (let i = 0; i < 12; i++) { const a = rng() * Math.PI * 2, d = i ? rng() * (spread || 160) : 0; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!inPoi(px, py) && !blocked(px, py)) return { x: px, y: py }; } return { x, y }; };
  /* ---- roads ---- */
  const proj = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1; const t = R.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L, 0, 1); return { x: a.x + dx * t, y: a.y + dy * t, t }; };
  const nearOnRoad = (p, rd) => { let best = null; for (let i = 0; i < rd.length - 1; i++) { const q = proj(p, rd[i], rd[i + 1]); const d = Math.hypot(q.x - p.x, q.y - p.y); if (!best || d < best.d) best = { x: q.x, y: q.y, i, t: q.t, d }; } return best; };
  const bestRoad = (from, to) => { let best = null; for (const rd of roads()) { const a = nearOnRoad(from, rd), b = nearOnRoad(to, rd); if (a && b && (!best || a.d + b.d < best.d)) best = { rd, a, b, d: a.d + b.d }; } return best; };
  /* the road path from `from` to `to`: projection → vertices → projection → to */
  const roadPath = (from, to) => { const B = bestRoad(from, to); if (!B) return [{ x: to.x, y: to.y }]; const { rd, a, b } = B; const path = [{ x: a.x, y: a.y }];
    if (a.i <= b.i) { for (let i = a.i + 1; i <= b.i; i++) path.push({ x: rd[i].x, y: rd[i].y }); } else { for (let i = a.i; i > b.i; i--) path.push({ x: rd[i].x, y: rd[i].y }); }
    path.push({ x: b.x, y: b.y }, { x: to.x, y: to.y }); return path.filter((p, i, arr) => !i || Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y) > 2); };
  /* walk `dist` along road rd from projection a: forward (toward higher vertex indexes) or back */
  const roadWalk = (rd, a, fwd, dist) => { let x = a.x, y = a.y, i = fwd ? a.i + 1 : a.i, left = dist; while (left > 0 && i >= 0 && i < rd.length) { const v = rd[i], d = Math.hypot(v.x - x, v.y - y); if (d >= left) { const k = left / (d || 1); return { x: x + (v.x - x) * k, y: y + (v.y - y) * k }; } left -= d; x = v.x; y = v.y; i += fwd ? 1 : -1; } return { x, y }; };
  const nearestPoi = (x, y, filt) => { let best = null, bd = 1e12; for (const p of pois()) { if (filt && !filt(p)) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } } return best; };
  const castleNear = (x, y) => nearestPoi(x, y, p => /castle|seat|keep|hold|town|city/i.test(poiType(p))) || nearestPoi(x, y, p => !/dungeon|portal|camp|shrine/i.test(poiType(p))) || nearestPoi(x, y);
  /* ---- mobs ---- */
  const mobKey = list => { const M = R.data.mobs; if (M) { for (const k of list) if (M[k]) return k; const ks = Object.keys(M); if (ks.length) return ks[Math.floor(rng() * ks.length)]; } return list[0]; };
  const spawnMob = (type, x, y, o) => { let e = null; if (R.spawnMob) { try { e = R.spawnMob(type, x, y, o); } catch (err) { console.error('events spawnMob', err); } }
    if (!e) { const M = R.data.mobs && R.data.mobs[type]; let st = null; try { st = M && (typeof M.stats === 'function' ? M.stats(o.lvl) : M.stats); } catch (err) {} st = st || {};
      const L = o.lvl || 1; e = { kind: 'mob', type, name: (M && M.name) || type, x, y, team: 1, lvl: L, hp: st.hp || (M && M.hp) || 40 + 12 * L, atk: st.atk || 6 + 2 * L, def: st.def || Math.round(L * 0.8), spd: st.spd || (M && M.spd) || 100, r: 14, ai: { state: 'idle' }, sprite: (M && M.sprite) || type }; }
    if (!e.id) R.spawn(e); e.event = o.event; e.evN = o.evN; e.persist = true; return e; };
  const busy = m => { const st = m.ai && m.ai.state; if (st && st !== 'idle' && st !== 'patrol' && st !== 'march' && st !== 'wander') return true; if (m.anim === 'attack' || m.anim === 'hurt') return true; const s = m.status && m.status.stun; return !!(s && (s > 1e5 ? s > Date.now() : s > R.t)); };
  const stepTo = (m, tx, ty, sp, dt) => { const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy); if (d < 1) return 0; const k = Math.min(1, sp * dt / d); m.x += dx * k; m.y += dy * k; m.vx = dx / d * sp; m.vy = dy / d * sp; if (Math.abs(dx) > 2) m.face = dx < 0 ? -1 : 1; m.anim = 'walk'; return d; };
  /* ---- banner ---- */
  let bar = null, barHideT = 0, lastTxt = '';
  const mkBar = () => { if (bar && bar.isConnected) return bar; const ui = document.getElementById('ui'); if (!ui) return null; bar = document.createElement('div'); bar.id = 'evbar';
    bar.innerHTML = '<div class="evbar-ico"></div><div class="evbar-txt"><div class="evbar-t"></div><div class="evbar-s"><span class="evbar-time"></span><span class="evbar-prog"></span></div></div>';
    bar.addEventListener('click', () => X.tap()); ui.appendChild(bar); return bar; };
  const showBar = ev => { const b = mkBar(); if (!b) return; clearTimeout(barHideT); b.className = 'on ' + ev.id; b.style.setProperty('--evc', EV[ev.id].col); b.querySelector('.evbar-ico').textContent = EV[ev.id].ico; b.querySelector('.evbar-t').textContent = ev.title; lastTxt = ''; updBar(ev); };
  const updBar = ev => { const b = bar; if (!b || !b.classList.contains('on')) return; const txt = fmtT(ev.left) + '|' + (ev.prog || ''); if (txt === lastTxt) return; lastTxt = txt; b.querySelector('.evbar-time').textContent = fmtT(ev.left); b.querySelector('.evbar-prog').textContent = ev.prog || ''; b.style.setProperty('--k', R.clamp(ev.left / ev.dur, 0, 1).toFixed(3)); };
  const endBar = (ev, result, txt) => { const b = bar; if (!b) return; b.className = 'on ' + ev.id + ' ' + result; b.style.setProperty('--evc', result === 'done' ? '#7fd06a' : '#e14b4b'); b.querySelector('.evbar-t').textContent = txt; b.querySelector('.evbar-time').textContent = ''; b.querySelector('.evbar-prog').textContent = ''; b.style.setProperty('--k', result === 'done' ? 1 : 0);
    clearTimeout(barHideT); barHideT = setTimeout(() => { if (b && !X.active) b.className = ''; }, 3200); };
  /* ---- the compass text for a world point, from the player ---- */
  const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const dirText = (x, y) => { const p = R.player; if (!p) return ''; const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy); if (d < 60) return 'right here'; const a = Math.atan2(dy, dx); const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; return Math.round(d / 10) * 10 + ' paces ' + DIRS[i]; };
  /* ---- the events ---- */
  let n = 0;
  const X = R.events = { active: null, nextAt: null, last: null, EV,
    start(id, o) { if (!EV[id] || !STARTS[id]) { console.warn('events: no event', id); return null; } if (X.active) X.stop('cancel'); const p = R.player || { x: R.cam.x, y: R.cam.y }; o = o || {};
      const ev = { id, n: ++n, t0: R.t, dur: EV[id].dur, until: R.t + EV[id].dur, left: EV[id].dur, prog: '', mobs: [], title: EV[id].title, anchor: null, done: false, ox: p.x, oy: p.y };
      try { if (STARTS[id](ev, p, o) === false) return null; } catch (e) { console.error('events start', id, e); return null; }
      X.active = ev; X.last = id; showBar(ev); R.bus.emit('event', id, 'start'); if (R.sfx && R.sfx.play && id !== 'dragon') { try { R.sfx.play('event', 0.8); } catch (e) {} } return ev; },
    stop(result) { const ev = X.active; if (!ev) return; X.active = null; ev.done = true; ev.result = result; try { ENDS[ev.id] && ENDS[ev.id](ev, result); } catch (e) { console.error('events end', ev.id, e); }
      for (const m of ev.mobs) if (alive(m) && result !== 'done') { m.dead = true; R.remove(m); } if (ev.npc && alive(ev.npc)) R.remove(ev.npc);
      X.nextAt = R.t + EV.gapMin + rng() * (EV.gapMax - EV.gapMin); if (result === 'cancel') { if (bar) bar.className = ''; return; } R.bus.emit('event', ev.id, result); if (R.save) R.save(); },
    tap() { const ev = X.active; if (!ev) return; let txt; if (ev.id === 'dragon') txt = 'Look up: a dragon passes over.'; else { const a = X.anchor(); txt = a ? (ev.id === 'horde' ? 'The horde: ' : ev.id === 'caravan' ? 'The caravan: ' : ev.name + ': ') + dirText(a.x, a.y) : ev.title; if (ev.id === 'horde' && ev.poi) txt += ' - heading for ' + ev.poi.name; }
      R.ui.toast(txt, EV[ev.id].col); if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) { try { Telegram.WebApp.HapticFeedback.impactOccurred('light'); } catch (e) {} } },
    anchor() { const ev = X.active; if (!ev) return null; if (ev.npc && alive(ev.npc)) return ev.npc; const ms = ev.mobs.filter(alive); if (!ms.length) return ev.anchor; let x = 0, y = 0; for (const m of ms) { x += m.x; y += m.y; } return { x: x / ms.length, y: y / ms.length }; },
    mobs() { return X.active ? X.active.mobs.filter(alive) : []; },
    raided(poiId) { const f = S() && S().flags; return !!(f && (f['raided:' + poiId] || 0) > Date.now()); },
    priceMul(poiId) { return X.raided(poiId) ? EV.raidMul : 1; },
    openCaravan() { const ev = X.active; if (!ev || ev.id !== 'caravan') { R.ui.toast('The caravan has moved on.'); return false; } if (R.screens.shop) { R.ui.open('shop', ev.poi); return true; }
      R.ui.toast('Caravan: ' + ev.poi.stock.map(it => it.name + ' ' + it.price + 'g').join(', '), EV.caravan.col); return false; },
    dirText, inPoi, roadPath,
    canStart() { const p = player(); if (!p || !S()) return false; if (R.paused || (R.ui && R.ui.cur)) return false; if (R.dungeons && R.dungeons.active) return false; if (R.bosses && R.bosses.active) return false; return !inPoi(p.x, p.y); },
    pick() { const ids = Object.keys(EV).filter(k => STARTS[k] && (k !== X.last || Object.keys(STARTS).length < 2)); let tot = 0; for (const k of ids) tot += EV[k].w || 1; let r = rng() * tot; for (const k of ids) { r -= EV[k].w || 1; if (r <= 0) return k; } return ids[ids.length - 1]; } };
  const STARTS = {}, ENDS = {}, TICKS = {};
  /* ---- 1. the wight horde ---- */
  STARTS.horde = (ev, p) => { const poi = castleNear(p.x, p.y); const tgt = poi ? { x: poi.x, y: poi.y } : { x: p.x + 1200, y: p.y }; ev.poi = poi || { id: 'road', name: 'the road' }; ev.title = EV.horde.title.replace('{poi}', ev.poi.name || ev.poi.id);
    const B = bestRoad(p, tgt); let sp; const D = EV.spawnD[0] + rng() * (EV.spawnD[1] - EV.spawnD[0]);
    if (B) sp = roadWalk(B.rd, B.a, B.a.i > B.b.i || (B.a.i === B.b.i && B.a.t > B.b.t), D); else { const a = Math.atan2(p.y - tgt.y, p.x - tgt.x) + (rng() - 0.5); sp = { x: p.x + Math.cos(a) * D, y: p.y + Math.sin(a) * D }; }
    if (Math.hypot(sp.x - p.x, sp.y - p.y) < 200) { const a = rng() * Math.PI * 2; sp = { x: p.x + Math.cos(a) * D, y: p.y + Math.sin(a) * D }; }
    sp = freeSpot(sp.x, sp.y, 120); ev.anchor = sp; ev.path = roadPath(sp, tgt); if (ev.path.length > 1 && Math.hypot(ev.path[0].x - sp.x, ev.path[0].y - sp.y) < 40) ev.path.shift(); /* the first waypoint is the spawn spot itself */ const gate = ev.path[ev.path.length - 1]; const pre = ev.path[ev.path.length - 2] || sp; const ga = Math.atan2(gate.y - pre.y, gate.x - pre.x); const gr = poi ? poiR(poi) * 0.75 : 40; ev.path[ev.path.length - 1] = { x: gate.x - Math.cos(ga) * gr, y: gate.y - Math.sin(ga) * gr };
    const N = EV.horde.min + Math.floor(rng() * (EV.horde.max - EV.horde.min + 1)); const type = mobKey(EV.horde.types); const L = Math.max(1, lvl() + (rng() < 0.5 ? 0 : 1));
    for (let i = 0; i < N; i++) { const a = rng() * Math.PI * 2, d = 20 + rng() * 70; const m = spawnMob(type, sp.x + Math.cos(a) * d, sp.y + Math.sin(a) * d, { lvl: L, event: 'horde', evN: ev.n, horde: true }); m.evOff = { x: (rng() - 0.5) * 90, y: (rng() - 0.5) * 90 }; m.evI = 0; if (m.ai) m.ai.state = 'march'; ev.mobs.push(m); }
    ev.total = N; ev.killed = 0; ev.prog = '0 / ' + N; };
  TICKS.horde = (ev, dt) => { const liveMobs = ev.mobs.filter(alive); ev.killed = ev.total - liveMobs.length; ev.prog = ev.killed + ' / ' + ev.total; if (!liveMobs.length) { X.stop('done'); return; }
    for (const m of liveMobs) { if (busy(m)) continue; const wp = ev.path[m.evI]; if (!wp) { m.anim = 'idle'; continue; } const tx = wp.x + m.evOff.x, ty = wp.y + m.evOff.y; if (Math.hypot(tx - m.x, ty - m.y) < 16) { if (m.evI < ev.path.length - 1) m.evI++; else { m.anim = 'idle'; m.evAt = true; } continue; } if (m.ai && (!m.ai.state || m.ai.state === 'idle' || m.ai.state === 'patrol')) m.ai.state = 'march'; stepTo(m, tx, ty, Math.min(m.spd || 100, EV.horde.spd), dt); }
    if (ev.left <= 0) X.stop('fail'); };
  ENDS.horde = (ev, result) => { if (result === 'done') { const at = ev.lastKill || (R.player ? { x: R.player.x + 60, y: R.player.y } : ev.anchor); let chest = false; if (R.loot && R.loot.chest) { try { R.loot.chest(at.x, at.y, EV.horde.chestRar); chest = true; } catch (e) { console.error(e); } }
      if (S()) { S().gems = (S().gems || 0) + EV.horde.gems; R.bus.emit('gems', EV.horde.gems); } endBar(ev, 'done', 'Horde destroyed: ' + (chest ? 'a chest and ' : '') + '+' + EV.horde.gems + ' gems'); R.ui.toast('The horde is destroyed. ' + ev.poi.name + ' is safe.', '#7fd06a'); if (R.sfx && R.sfx.play) { try { R.sfx.play('win', 0.9); } catch (e) {} } }
    else if (result === 'fail') { if (S() && ev.poi && ev.poi.id !== 'road') { S().flags = S().flags || {}; S().flags['raided:' + ev.poi.id] = Date.now() + EV.raidMs; } endBar(ev, 'fail', 'The horde reached ' + ev.poi.name + ': prices up for a day'); } };
  /* ---- 2. the merchant caravan ---- */
  const price0 = it => { if (typeof it.price === 'number') return it.price; if (R.items && R.items.price) { try { const p = R.items.price(it); if (typeof p === 'number') return p; } catch (e) {} } return Math.round((20 + 9 * (it.lvl || lvl())) * ((it.rar || 0) + 1)); };
  const caravanStock = () => { let st = null; if (R.items && R.items.shopStock) { try { st = R.items.shopStock({ id: 'caravan', name: 'Caravan', lvl: lvl() }, EV.caravan.items); } catch (e) { console.error(e); } }
    if (st && !Array.isArray(st)) st = st.items || st.stock || st.list || null; if (!st || !st.length) { st = []; for (let i = 0; i < EV.caravan.items; i++) { let it = null; if (R.items && R.items.roll) { try { it = R.items.roll(lvl(), rng() < 0.35 ? 2 : 1); } catch (e) {} } st.push(it || { id: 'cv_' + i, kind: i === 2 ? 'potion' : i ? 'armor' : 'weapon', name: ['Caravan blade', 'Travel mail', 'Red potion'][i], rar: 1, lvl: lvl(), stats: {}, icon: '' }); } }
    return st.slice(0, EV.caravan.items).map(it => { const o = Object.assign({}, it); const p0 = price0(o); o.price0 = p0; o.price = Math.max(1, Math.round(p0 * (1 - EV.caravan.disc))); o.disc = EV.caravan.disc; return o; }); };
  STARTS.caravan = (ev, p) => { const B = bestRoad(p, p); let sp; if (B) { const fwd = rng() < 0.5; sp = roadWalk(B.rd, B.a, fwd, 260 + rng() * 180); if (Math.hypot(sp.x - p.x, sp.y - p.y) < 120) sp = roadWalk(B.rd, B.a, !fwd, 260 + rng() * 180); } else { const a = rng() * Math.PI * 2; sp = { x: p.x + Math.cos(a) * 320, y: p.y + Math.sin(a) * 320 }; }
    sp = freeSpot(sp.x, sp.y, 100); ev.anchor = sp; ev.poi = { id: 'caravan', name: 'Caravan', type: 'caravan', disc: EV.caravan.disc, stock: caravanStock(), x: sp.x, y: sp.y };
    ev.npc = R.spawn({ kind: 'npc', type: 'wagon', name: 'Caravan', dialog: 'caravan', team: 2, x: sp.x, y: sp.y, r: 26, hp: 1, face: p.x < sp.x ? -1 : 1, event: 'caravan', evN: ev.n, persist: true, shop: ev.poi, interact: () => X.openCaravan() });
    ev.poi.npc = ev.npc; ev.prog = EV.caravan.items + ' items at -' + Math.round(EV.caravan.disc * 100) + '%'; };
  TICKS.caravan = ev => { if (!alive(ev.npc)) { X.stop('done'); return; } if (ev.left <= 0) X.stop('done'); };
  ENDS.caravan = ev => { if (R.ui && R.ui.cur === 'shop' && ev.poi && ev.poi.open) R.ui.close(); endBar(ev, 'done', 'The caravan moved on'); };
  /* ---- 3. the dragon shadow ---- */
  STARTS.dragon = (ev, p) => { ev.dir = rng() < 0.5 ? 1 : -1; ev.fled = []; ev.prog = 'mobs flee'; const until = R.t + EV.dragon.fleeT;
    for (const m of R.near(p.x, p.y, EV.dragon.fleeR, e => e.kind === 'mob' && e.team !== 0)) { m.status = m.status || {}; m.status.flee = until; m.status.fear = until; m.flee = until; m.fleeFrom = { x: p.x, y: p.y }; if (m.ai) { m.ai.state = 'flee'; m.ai.fleeUntil = until; } m._ex = m.x; m._ey = m.y; ev.fled.push(m); }
    if (R.sfx && R.sfx.play) { try { R.sfx.play('roar', 1); } catch (e) {} } if (R.ambience && R.ambience.flash) { try { R.ambience.flash('#ff6a2a', 1.2); } catch (e) {} } if (R.fx && R.fx.shake) { try { R.fx.shake(6, 0.5); } catch (e) {} }
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) { try { Telegram.WebApp.HapticFeedback.impactOccurred('heavy'); } catch (e) {} } };
  TICKS.dragon = (ev, dt) => { for (const m of ev.fled) { if (!alive(m) || !(m.flee > R.t)) continue; if (m.x !== m._ex || m.y !== m._ey) { m._ex = m.x; m._ey = m.y; continue; } /* nobody else moves it: flee from the player */
      const f = m.fleeFrom, dx = m.x - f.x, dy = m.y - f.y, d = Math.hypot(dx, dy) || 1; stepTo(m, m.x + dx / d * 200, m.y + dy / d * 200, (m.spd || 100) * 1.2, dt); m._ex = m.x; m._ey = m.y; }
    ev.prog = ev.fled.length ? ev.fled.length + ' flee' : ''; if (ev.left <= 0) X.stop('done'); };
  ENDS.dragon = ev => { for (const m of ev.fled) if (alive(m) && m.ai && m.ai.state === 'flee' && !(m.flee > R.t)) m.ai.state = 'idle'; endBar(ev, 'done', 'The dragon is gone'); };
  /* ---- 4. the wandering elite ---- */
  STARTS.elite = (ev, p) => { const a = rng() * Math.PI * 2, D = 320 + rng() * 200; const sp = freeSpot(p.x + Math.cos(a) * D, p.y + Math.sin(a) * D, 140); const type = mobKey(EV.elite.types); const name = EV.elite.names[Math.floor(rng() * EV.elite.names.length)];
    const m = spawnMob(type, sp.x, sp.y, { lvl: lvl() + 2, event: 'elite', evN: ev.n, elite: true, name }); m.name = name; m.elite = true; m.hpMax = Math.round((m.hpMax || m.hp || 1) * EV.elite.hpMul); m.hp = m.hpMax; m.atk = Math.round((m.atk || 10) * EV.elite.atkMul); m.r = (m.r || 14) * 1.25; m.scale = 1.3; m.lootRar = EV.elite.rar; m.noLoot = true;
    m._ex = m.x; m._ey = m.y; ev.mobs.push(m); ev.mob = m; ev.name = name; ev.home = sp; ev.anchor = sp; ev.wT = R.t + 2; ev.title = EV.elite.title.replace('{name}', name); ev.prog = '0 / 1'; };
  TICKS.elite = (ev, dt) => { const m = ev.mob; if (!alive(m)) { X.stop(ev.killed ? 'done' : 'fail'); return; } if (ev.left <= 0) { X.stop('fail'); return; }
    if (busy(m)) { m._ex = m.x; m._ey = m.y; return; } if (m.x !== m._ex || m.y !== m._ey) { m._ex = m.x; m._ey = m.y; return; } /* nobody else moves it: wander around home */
    if (R.t >= ev.wT || !ev.tgt) { const a = rng() * Math.PI * 2, d = 60 + rng() * 180; ev.tgt = freeSpot(ev.home.x + Math.cos(a) * d, ev.home.y + Math.sin(a) * d, 60); ev.wT = R.t + 3 + rng() * 4; }
    if (Math.hypot(ev.tgt.x - m.x, ev.tgt.y - m.y) < 8) { m.anim = 'idle'; } else stepTo(m, ev.tgt.x, ev.tgt.y, Math.min(m.spd || 100, 70) * 0.6, dt); m._ex = m.x; m._ey = m.y; };
  const dropRare = (m, L) => { let it = null; if (R.items && R.items.roll) { try { it = R.items.roll(L, EV.elite.rar); } catch (e) { console.error(e); } }
    it = it || { id: 'elite_' + Date.now().toString(36), kind: 'trinket', name: (m.name || 'Elite').split(' ')[0] + "'s token", rar: EV.elite.rar, lvl: L, stats: { atk: 2 + L, hp: 10 + 4 * L }, icon: '' }; if (it.rar == null || it.rar < EV.elite.rar) it.rar = EV.elite.rar;
    const Lo = R.loot; const fn = Lo && (Lo.drop || Lo.dropItem || Lo.spawn); if (fn) { try { fn.call(Lo, m.x, m.y, it); return it; } catch (e) { console.error(e); } } if (S()) { S().inv = S().inv || []; S().inv.push(it); } R.bus.emit('loot', it); return it; };
  ENDS.elite = (ev, result) => { if (result === 'done') { endBar(ev, 'done', ev.name + ' is slain: a Rare drop'); if (R.sfx && R.sfx.play) { try { R.sfx.play('win', 0.9); } catch (e) {} } } else if (result === 'fail') endBar(ev, 'fail', ev.name + ' wandered off'); };
  /* ---- kills ---- */
  R.bus.on('kill', m => { const ev = X.active; if (!ev || !m || m.evN !== ev.n) return; ev.lastKill = { x: m.x, y: m.y };
    if (ev.id === 'horde') { ev.killed = ev.total - ev.mobs.filter(alive).length; ev.prog = ev.killed + ' / ' + ev.total; updBar(ev); if (!ev.mobs.some(alive)) X.stop('done'); }
    else if (ev.id === 'elite' && m === ev.mob) { ev.killed = 1; ev.prog = '1 / 1'; ev.drop = dropRare(m, m.lvl || lvl()); X.stop('done'); } });
  R.bus.on('dialog', id => { const ev = X.active; if (!ev || ev.id !== 'caravan') return; if (id === 'caravan' || (ev.npc && (id === ev.npc || id === ev.npc.id))) X.openCaravan(); });
  R.bus.on('screen', name => { if (name === 'shop' && X.active && X.active.id === 'caravan' && X.active.poi) X.active.poi.open = true; });
  /* ---- the system ---- */
  R.addSys('events', { order: 65,
    update(dt) { const ev = X.active; if (ev) { ev.left = ev.until - R.t; try { TICKS[ev.id](ev, dt); } catch (e) { console.error('events tick', e); } if (X.active === ev) updBar(ev); return; }
      if (!S() || !R.player) return; if (X.nextAt == null) X.nextAt = R.t + EV.gapMin + rng() * (EV.gapMax - EV.gapMin); if (R.t < X.nextAt) return;
      if (!X.canStart()) { X.nextAt = R.t + EV.retry; return; } if (!X.start(X.pick())) X.nextAt = R.t + EV.retry; },
    draw(ctx) { const ev = X.active; if (!ev) return; const z = R.cam.z || 1;
      if (ev.id === 'caravan' && alive(ev.npc)) drawWagon(ctx, ev.npc, z);
      if (ev.id === 'elite' && alive(ev.mob)) { const s = R.w2s(ev.mob.x, ev.mob.y); ctx.save(); ctx.font = '700 ' + Math.round(12 * Math.min(1.4, z)) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(6,11,20,.7)'; const tw = ctx.measureText(ev.name).width + 16; ctx.fillRect(s.x - tw / 2, s.y - (ev.mob.r + 46) * z, tw, 18); ctx.fillStyle = EV.elite.col; ctx.fillText(ev.name, s.x, s.y - (ev.mob.r + 46) * z + 13); ctx.restore(); }
      if (ev.id === 'dragon') drawDragon(ctx, ev);
      else { const a = X.anchor(); if (a) drawEdgeArrow(ctx, a, EV[ev.id].col); } } });
  /* the wagon: body, canvas, two wheels, a swaying lantern, the sale tag */
  const drawWagon = (ctx, e, z) => { const s = R.w2s(e.x, e.y); ctx.save(); ctx.translate(s.x, s.y); ctx.scale(z * (e.face || 1), z); const b = Math.sin(R.t * 2) * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 44, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b2a1b'; ctx.fillRect(-38, -30 + b, 72, 26); ctx.fillStyle = '#5a3f28'; ctx.fillRect(-36, -28 + b, 68, 6);
    ctx.fillStyle = '#d9c7a0'; ctx.beginPath(); ctx.moveTo(-36, -30 + b); ctx.quadraticCurveTo(-2, -66 + b, 32, -30 + b); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8a7554'; ctx.lineWidth = 1.5; for (let i = -24; i <= 24; i += 12) { ctx.beginPath(); ctx.moveTo(i, -30 + b); ctx.lineTo(i, -30 + b - (30 - Math.abs(i) * 0.9)); ctx.stroke(); }
    ctx.fillStyle = '#2b2118'; for (const wx of [-24, 18]) { ctx.beginPath(); ctx.arc(wx, -2, 11, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a7554'; ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(wx - Math.cos(a) * 9, -2 - Math.sin(a) * 9); ctx.lineTo(wx + Math.cos(a) * 9, -2 + Math.sin(a) * 9); ctx.stroke(); } }
    ctx.strokeStyle = '#3b2a1b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(34, -14 + b); ctx.lineTo(56, -8); ctx.stroke();
    const lx = 40 + Math.sin(R.t * 3) * 3, ly = -40 + b; ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(34, -30 + b); ctx.lineTo(lx, ly); ctx.stroke(); const g = ctx.createRadialGradient(lx, ly + 4, 1, lx, ly + 4, 16); g.addColorStop(0, 'rgba(255,214,120,.9)'); g.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly + 4, 16, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffd678'; ctx.fillRect(lx - 3, ly, 6, 8);
    ctx.restore(); ctx.save(); ctx.font = '700 ' + Math.round(12 * Math.min(1.4, z)) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; const tag = 'Caravan  -' + Math.round(EV.caravan.disc * 100) + '%'; const tw = ctx.measureText(tag).width + 16; ctx.fillStyle = 'rgba(6,11,20,.7)'; ctx.fillRect(s.x - tw / 2, s.y - 84 * z, tw, 18); ctx.fillStyle = EV.caravan.col; ctx.fillText(tag, s.x, s.y - 84 * z + 13); ctx.restore(); };
  /* the dragon: a soft shadow (body + flapping wings + tail) crossing the screen in 6 s, the sky reddening and fading */
  const drawDragon = (ctx, ev) => { const k = R.clamp((R.t - ev.t0) / ev.dur, 0, 1), vw = R.vw, vh = R.vh, d = ev.dir; const x0 = d > 0 ? -0.45 * vw : 1.45 * vw, x1 = d > 0 ? 1.45 * vw : -0.45 * vw; const x = R.lerp(x0, x1, k), y = R.lerp(1.1 * vh, -0.15 * vh, k); const ang = Math.atan2(-1.25 * vh, (x1 - x0)); const S0 = vw / 390; const flap = Math.sin(R.t * 5.5);
    ctx.save(); ctx.fillStyle = 'rgba(255,106,42,' + (0.17 * Math.sin(Math.PI * k)).toFixed(3) + ')'; ctx.fillRect(0, 0, vw, vh);
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(S0, S0); if ('filter' in ctx) ctx.filter = 'blur(5px)'; ctx.fillStyle = 'rgba(4,6,12,.55)';
    ctx.beginPath(); ctx.ellipse(0, 0, 90, 26, 0, 0, Math.PI * 2); ctx.fill();  /* body */
    ctx.beginPath(); ctx.ellipse(100, -4, 34, 16, 0.1, 0, Math.PI * 2); ctx.fill(); /* head */
    ctx.beginPath(); ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-170, 10 - flap * 30, -260, -40 + flap * 20); ctx.quadraticCurveTo(-180, 30, -70, 18); ctx.closePath(); ctx.fill(); /* tail */
    for (const sgn of [1, -1]) { const w = 1 - Math.abs(flap) * 0.35; ctx.beginPath(); ctx.moveTo(40, 0); ctx.quadraticCurveTo(10, sgn * 120 * w, -60, sgn * 230 * w); ctx.lineTo(-20, sgn * 200 * w); ctx.lineTo(-90, sgn * 170 * w); ctx.lineTo(-40, sgn * 130 * w); ctx.quadraticCurveTo(-60, sgn * 60 * w, -50, 0); ctx.closePath(); ctx.fill(); } /* wings */
    ctx.restore(); };
  /* a pulsing arrow at the screen edge toward an off-screen anchor */
  const drawEdgeArrow = (ctx, a, col) => { const s = R.w2s(a.x, a.y), m = 30; if (s.x > m && s.x < R.vw - m && s.y > m && s.y < R.vh - m) return; const cx = R.vw / 2, cy = R.vh / 2; const dx = s.x - cx, dy = s.y - cy; const kx = (R.vw / 2 - m) / Math.abs(dx || 1e-6), ky = (R.vh / 2 - m) / Math.abs(dy || 1e-6); const k = Math.min(kx, ky); const ex = cx + dx * k, ey = cy + dy * k; const ang = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.globalAlpha = 0.65 + 0.35 * Math.sin(R.t * 4); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.restore(); };
})();
