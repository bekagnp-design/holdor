/* 23_companions.js — the HEROES roster (A14; the file keeps its name so the build order holds — companions are gone, Addendum 2).
   One hero, permadeath: the player rides as one of his house's unlocked champions; when he falls, the Hall of the Fallen gets a line
   and he picks the next hero.
   API  R.heroes = { list(house?), champ(id), starter(house), ensureStarter(), unlock(id, why), isUnlocked(id), current(), fall(killer, info),
                     portrait(id, size) → element, clsOf(type), rarOf(id) → {n, col}, unlockText(id), ride(id), best() }
   Screens: R.ui.open('heroes', {afterDeath:true}?) — the roster, primary button RIDE AS <NAME> → R.newHero(id) (A01; a minimal fallback here);
            R.ui.open('hall') — the Hall of the Fallen.
   Save (acc): R.state.acc.champs[id] = {unlocked:1, runs:n, best:lvl}, acc.hall = [{id, name, lvl, killer, at, played}], acc.best = {lvl, kills}.
   Events out: 'hero'(id, why) on unlock, 'ride'(id) when a hero is chosen, 'hall'(entry) when a line is written.
   Soft dependencies: R.data.champs (A10: name, house, type, unlock), A_CHAMP.list / A_CHAMP.art[id+'_portrait'] (A04), R.draw.portrait (A03),
   R.newHero + R.acc (A01), R.data.world.regions (A07), R.data.houses. Each has a fallback. */
(function () {
  // A_CHAMP is a top-level const of the assets (not a window property): read it by name
  const AC = () => { try { return typeof A_CHAMP !== 'undefined' ? A_CHAMP : window.A_CHAMP; } catch (e) { return window.A_CHAMP; } };
  if (!window.R) return;
  const HCOL = { stark: '#a9bdd0', lannister: '#e3b661', baratheon: '#e0c14a', targaryen: '#e14b4b', greyjoy: '#d8b74a', tyrell: '#7fd06a', martell: '#f08a3c' };
  const HNAME = { stark: 'Stark', lannister: 'Lannister', baratheon: 'Baratheon', targaryen: 'Targaryen', greyjoy: 'Greyjoy', tyrell: 'Tyrell', martell: 'Martell' };
  /* the old game's opening order per house: the first one is the starter */
  const ORDER = { stark: ['brienne', 'robb', 'bran', 'sansa', 'ned', 'arya', 'jon'], lannister: ['kevan', 'bronn', 'gregor', 'tywin', 'jaime', 'cersei', 'tyrion'], baratheon: ['gendry', 'barristan', 'davos', 'renly', 'melisandre', 'robert', 'stannis'],
    targaryen: ['viserys', 'missandei', 'daario', 'greyworm', 'jorah', 'drogo', 'dany'], greyjoy: ['rodrik', 'aeron', 'balon', 'victarion', 'yara', 'euron', 'theon'], tyrell: ['garlan', 'randyll', 'mace', 'loras', 'olenna', 'sam', 'margaery'], martell: ['areo', 'nymeria', 'obara', 'tyene', 'doran', 'ellaria', 'oberyn'] };
  const FALL = `jon|stark|Jon Snow|melee;arya|stark|Arya Stark|melee;sansa|stark|Sansa Stark|caster;bran|stark|Bran Stark|caster;robb|stark|Robb Stark|melee;ned|stark|Eddard Stark|melee;brienne|stark|Brienne of Tarth|melee;jaime|lannister|Jaime Lannister|melee;tyrion|lannister|Tyrion Lannister|caster;cersei|lannister|Cersei Lannister|caster;tywin|lannister|Tywin Lannister|caster;bronn|lannister|Bronn|ranged;gregor|lannister|The Mountain|melee;kevan|lannister|Kevan Lannister|melee;stannis|baratheon|Stannis Baratheon|melee;robert|baratheon|Robert Baratheon|melee;renly|baratheon|Renly Baratheon|caster;davos|baratheon|Davos Seaworth|ranged;melisandre|baratheon|Melisandre|caster;gendry|baratheon|Gendry|melee;barristan|baratheon|Barristan Selmy|melee;dany|targaryen|Daenerys|caster;jorah|targaryen|Jorah Mormont|melee;greyworm|targaryen|Grey Worm|melee;missandei|targaryen|Missandei|caster;daario|targaryen|Daario Naharis|melee;drogo|targaryen|Khal Drogo|melee;viserys|targaryen|Viserys|caster;theon|greyjoy|Theon Greyjoy|ranged;yara|greyjoy|Yara Greyjoy|melee;euron|greyjoy|Euron Greyjoy|caster;balon|greyjoy|Balon Greyjoy|caster;victarion|greyjoy|Victarion Greyjoy|melee;aeron|greyjoy|Aeron Damphair|caster;rodrik|greyjoy|Rodrik the Reader|caster;margaery|tyrell|Margaery Tyrell|caster;olenna|tyrell|Olenna Tyrell|caster;loras|tyrell|Loras Tyrell|melee;randyll|tyrell|Randyll Tarly|melee;sam|tyrell|Samwell Tarly|ranged;garlan|tyrell|Garlan Tyrell|melee;mace|tyrell|Mace Tyrell|caster;oberyn|martell|Oberyn Martell|melee;ellaria|martell|Ellaria Sand|caster;doran|martell|Doran Martell|caster;areo|martell|Areo Hotah|melee;obara|martell|Obara Sand|ranged;nymeria|martell|Nymeria Sand|ranged;tyene|martell|Tyene Sand|ranged`
    .split(';').map(s => { const [id, house, name, type] = s.split('|'); return { id, house, name, type }; });
  const FALLBY = {}; FALL.forEach(c => FALLBY[c.id] = c);
  const RAR = [['Common', '#8a97a8'], ['Uncommon', '#7fd06a'], ['Rare', '#4fb0ff'], ['Epic', '#b47cff'], ['Legendary', '#e3b661']], TIER_RAR = [0, 0, 1, 2, 2, 3, 4];
  const REGIONS = ['the Riverlands', 'the Vale', 'the Westerlands', 'the Reach', 'the Crownlands', 'beyond the Wall'];
  const CLS = { melee: 'Knight', ranged: 'Ranger', caster: 'Maester', mage: 'Maester', knight: 'Knight', ranger: 'Ranger', maester: 'Maester' };
  const clsOf = t => CLS[t] || 'Knight';
  const sfx = (n, v) => { if (R.sfx && R.sfx.play) try { R.sfx.play(n, v); } catch (e) {} };
  const toast = (t, c) => { if (R.ui && R.ui.toast) try { R.ui.toast(t, c); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  /* ---- data: A10's R.data.champs first, A04's A_CHAMP.list for the order, the old roster after ---- */
  const champ = id => { const C = R.data.champs; let c = null; if (C) c = Array.isArray(C) ? C.find(x => x && x.id === id) : C[id]; const f = FALLBY[id]; if (!c && !f) return null; c = c || {};
    return { id, name: c.name || c.n || (f && f.name) || id, house: c.house || (f && f.house) || 'stark', type: c.type || c.role || c.cls || (f && f.type) || 'melee', unlock: c.unlock, tier: c.tier, src: c }; };
  const listIds = () => { const A = window.A_CHAMP; let ids = null; if (A && Array.isArray(A.list) && A.list.length) ids = A.list.map(x => typeof x === 'string' ? x : x && x.id).filter(Boolean);
    if (!ids) { const C = R.data.champs; if (C) ids = Array.isArray(C) ? C.map(c => c && c.id).filter(Boolean) : Object.keys(C); } if (!ids || !ids.length) ids = [].concat(...Object.values(ORDER)); return ids.filter(id => champ(id)); };
  const houseIds = house => { const ids = listIds().filter(id => champ(id).house === house); const ord = ORDER[house] || []; return ids.sort((a, b) => { const ia = ord.indexOf(a), ib = ord.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }); };
  const tierOf = id => { const c = champ(id); if (c && c.tier != null) return c.tier | 0; const i = (ORDER[c ? c.house : ''] || []).indexOf(id); return i < 0 ? 0 : i; };
  const rarOf = id => { const c = champ(id); let r = c && c.src && (c.src.rar != null ? c.src.rar : c.src.rarity); if (r == null) r = TIER_RAR[tierOf(id)] || 0; r = R.clamp ? R.clamp(r | 0, 0, 4) : Math.max(0, Math.min(4, r | 0)); return { n: RAR[r][0], col: RAR[r][1], r }; };
  const colOf = h => { const H = R.data.houses && R.data.houses[h]; return (H && H.col) || HCOL[h] || '#e3b661'; };
  const regionName = i => { const W = R.data.world; const rs = W && Array.isArray(W.regions) ? W.regions.slice().sort((a, b) => ((a.lvl && a.lvl[0]) || a.minLvl || 0) - ((b.lvl && b.lvl[0]) || b.minLvl || 0)) : null;
    if (rs && rs.length > 1) { const r = rs[Math.min(rs.length - 1, i + 1)]; return r.name || r.n || r.id; } return REGIONS[Math.min(REGIONS.length - 1, i)]; };
  const unlockText = id => { const c = champ(id); if (!c) return ''; if (c.unlock) return typeof c.unlock === 'string' ? c.unlock : (c.unlock.text || c.unlock.t || 'Rescue in ' + regionName(Math.max(0, tierOf(id) - 1))); return 'Rescue in ' + regionName(Math.max(0, tierOf(id) - 1)); };

  /* ---- the account ---- */
  const acc = () => { if (!R.state) return null; let a = null; if (typeof R.acc === 'function') { try { a = R.acc(); } catch (e) { a = null; } } if (!a) a = R.state.acc = R.state.acc || {};
    a.house = a.house || (R.state.p && R.state.p.house) || 'stark'; a.champs = a.champs || {}; a.hall = a.hall || []; a.best = a.best || { lvl: 0, kills: 0 };
    if (R.state.p && R.state.p.champs && !a._mig) { for (const id in R.state.p.champs) if (champ(id)) a.champs[id] = a.champs[id] || { unlocked: 1, runs: 0 }; a._mig = 1; } return a; };
  const house = () => { const a = acc(); return (a && a.house) || 'stark'; };
  const isUnlocked = id => { const a = acc(); return !!(a && a.champs[id] && a.champs[id].unlocked); };
  // one starter rule with core / intro (R.firstChamp = A10's R.champs.first): Stark → brienne, …
  const starter = h => { h = h || house(); const ids = houseIds(h); if (typeof R.firstChamp === 'function') { try { const f = R.firstChamp(h); if (f && ids.includes(f)) return f; } catch (e) {} } return ids[0] || null; };
  const ensureStarter = () => { const a = acc(); if (!a) return null; const h = a.house; if (houseIds(h).some(isUnlocked)) return null; const id = starter(h); if (!id) return null; a.champs[id] = Object.assign(a.champs[id] || {}, { unlocked: 1, runs: a.champs[id] && a.champs[id].runs || 0 }); R.save(); return id; };
  const unlock = (id, why) => { const a = acc(); const c = champ(id); if (!a || !c) return false; const was = isUnlocked(id); a.champs[id] = Object.assign(a.champs[id] || { runs: 0 }, { unlocked: 1 }); if (was) return false;
    if (why !== 'start' && why !== 'import') { toast(c.name + ' joins your house', colOf(c.house)); sfx('unlock', 0.7); } R.bus.emit('hero', id, why); R.save(); if (R.ui && R.ui.cur === 'heroes') render(document.getElementById('screen')); return true; };
  const current = () => { const p = R.state && R.state.p; if (!p) return null; return p.hero || (p.name && champ(p.name) ? p.name : null); };
  const ended = () => { const a = acc(), p = R.state && R.state.p; if (!a || !p) return false; const l = a.hall[a.hall.length - 1]; return !!(l && l.id === p.hero && (l.at || 0) >= (p.created || 0)); };   // this run is in the Hall
  const alive = () => !!(R.state && R.state.p && R.state.p.hero && !R.state.p.dead && !(R.player && R.player.dead) && !ended());
  const runsOf = id => { const a = acc(); if (!a) return 0; let n = 0; for (const h of a.hall) if (h.id === id) n++; return n + (alive() && current() === id ? 1 : 0); };
  const best = () => { const a = acc(); if (!a) return { lvl: 0, runs: 0 }; let lvl = a.best.lvl | 0; for (const h of a.hall) if ((h.lvl | 0) > lvl) lvl = h.lvl | 0; return { lvl, runs: a.hall.length + (alive() ? 1 : 0), kills: a.best.kills | 0 }; };
  const bestOf = id => { const a = acc(); if (!a) return 0; let b = (a.champs[id] && a.champs[id].best) | 0; for (const h of a.hall) if (h.id === id && h.lvl > b) b = h.lvl; return b; };
  const bump = () => { const a = acc(), p = R.state && R.state.p; if (!a || !p) return; const id = current(); if (p.lvl > (a.best.lvl | 0)) a.best.lvl = p.lvl; if (id && a.champs[id] && p.lvl > (a.champs[id].best | 0)) a.champs[id].best = p.lvl; };
  const killerName = k => { if (!k) return 'the cold'; if (typeof k === 'string') return k; const n = k.name || (k.type && R.data.mobs && R.data.mobs[k.type] && (R.data.mobs[k.type].name || R.data.mobs[k.type].n)) || k.type; return n || 'the cold'; };
  const fall = (killer, info) => { const a = acc(), p = R.state && R.state.p; if (!a || !p) return null; const id = current(); bump(); const last = a.hall[a.hall.length - 1]; const now = Date.now();
    if (last && last.id === id && last.lvl === (p.lvl | 0) && now - last.at < 5000) return last; /* another module wrote this fall already */
    const e = { id, name: p.name || (champ(id) || {}).name || 'A hero', lvl: p.lvl | 0, killer: killerName(killer || (info && (info.killer || info.by || info.src))), at: now, played: p.played | 0, created: p.created || 0 };
    a.hall.push(e); if (a.hall.length > 200) a.hall.splice(0, a.hall.length - 200); p.dead = true; R.bus.emit('hall', e); R.save(); return e; };   // in the Hall = the run is over
  R.bus.on('death', info => { setTimeout(() => { try { fall(info && info.killer, info); } catch (e) {} }, 0); });
  R.bus.on('levelup', bump);
  const list = h => { h = h || house(); const a = acc(); return houseIds(h).map(id => { const c = champ(id), r = rarOf(id), st = (a && a.champs[id]) || {}; return { id, name: c.name, house: c.house, type: c.type, cls: clsOf(c.type), rar: r.n, rarCol: r.col, col: colOf(c.house), unlocked: !!st.unlocked, runs: runsOf(id), best: bestOf(id), unlockText: st.unlocked ? '' : unlockText(id), current: current() === id }; }); };

  /* ---- a portrait element: R.draw.portrait → A_CHAMP art → the initial in the house colour ---- */
  const portrait = (id, size) => { size = size || 96; const c = champ(id) || { name: id, house: 'stark' }; let el = null;
    if (R.draw && typeof R.draw.portrait === 'function') { try { const r = R.draw.portrait(id, size); if (r && r.nodeType) el = r; else if (typeof r === 'string') { el = new Image(); el.src = r; } } catch (e) { el = null; } }
    if (!el) { const A = AC(); const u = A && ((A.art && A.art[id + '_portrait']) || A[id + '_portrait'] || (A.portraits && A.portraits[id])); if (typeof u === 'string') { el = new Image(); el.src = u; el.alt = c.name; } }
    if (!el) { el = document.createElement('div'); el.className = 'hr-ini'; el.textContent = (c.name || id)[0]; el.style.color = colOf(c.house); }
    el.classList.add('hr-pt'); el.style.width = el.style.height = size + 'px'; if (el.tagName === 'IMG') { el.width = el.height = size; el.draggable = false; } return el; };

  /* ---- ride: runs++ then R.newHero (A01) or the minimal fallback ---- */
  const ride = id => { const a = acc(); const c = champ(id); if (!a || !c || !isUnlocked(id)) return false; let ok = false;   // R.newHero counts the run
    if (alive()) { toast('Your hero still lives', '#9fb6c9'); return false; }   // a living hero is never wiped: the next one rides only after a fall
    if (typeof R.newHero === 'function') { try { R.newHero(id); ok = true; } catch (e) { console.error('newHero', e); } }
    if (!ok) { const s = R.newState ? R.newState() : { p: {} }; const p = s.p || {}; Object.assign(p, { hero: id, name: c.name, cls: clsOf(c.type).toLowerCase(), house: a.house, lvl: 1, xp: 0, hp: 0, gold: 0, gems: 0, pos: null, created: Date.now(), played: 0 }); R.state.p = p; if (R.player) { R.player.dead = false; R.player.hp = R.player.hpMax; R.player.anim = 'idle'; } }
    R.save(); sfx('ui', 0.5); toast('You ride as ' + c.name, colOf(c.house)); R.bus.emit('ride', id); if (R.ui && R.ui.cur === 'heroes') R.ui.close(); return true; };

  /* ---- the heroes screen ---- */
  let sel = null, after = null;
  const fmtAgo = t => { const d = Math.max(0, Date.now() - t), m = Math.floor(d / 6e4), h = Math.floor(m / 60), dd = Math.floor(h / 24); return dd ? dd + 'd ago' : h ? h + 'h ago' : m ? m + 'm ago' : 'just now'; };
  const render = el => { el = el || document.getElementById('screen'); if (!el || !R.state) return; const a = acc(); ensureStarter(); const h = a.house; const rows = list(h); const hc = colOf(h);
    if (!sel || !rows.some(r => r.id === sel && r.unlocked)) { const cur = rows.find(r => r.current && r.unlocked && !(after && after.id === r.id)); sel = (cur || (after && rows.find(r => r.unlocked && r.id !== after.id)) || rows.find(r => r.unlocked) || {}).id || null; }   /* after a death: the first OTHER unlocked champion */
    const w = document.createElement('div'); w.className = 'hr-wrap'; w.style.setProperty('--hc', hc);
    const fromMenu = !after && !!current() && !(R.player && R.player.dead);
    w.innerHTML = '<div class="hr-head">' + (fromMenu ? '<button class="hr-back" data-act="back" aria-label="Back">‹</button>' : '<span class="hr-back ghost"></span>') + '<h2>' + (after ? 'The next hero' : 'Your heroes') + '</h2><span class="hr-house">House ' + esc(HNAME[h] || h) + '</span></div>';
    if (after) { const f = document.createElement('div'); f.className = 'hr-fell'; f.appendChild(portrait(after.id, 56)); f.insertAdjacentHTML('beforeend', '<div class="hr-fellt"><div class="hr-felln"><s>' + esc(after.name) + '</s> <b>Lv ' + (after.lvl | 0) + '</b></div><div class="hr-fellk">fell to ' + esc(after.killer || 'the cold') + ' · ' + fmtAgo(after.at || Date.now()) + '</div></div><div class="hr-fellx">✕</div>'); w.appendChild(f); }
    const nUn = rows.filter(r => r.unlocked).length; const hint = document.createElement('div'); hint.className = 'hr-hint'; hint.textContent = nUn + ' of ' + rows.length + ' ride for your house. ' + (nUn < rows.length ? 'Rescue the others on the road.' : 'The whole house rides.'); w.appendChild(hint);
    const grid = document.createElement('div'); grid.className = 'hr-grid';
    for (const r of rows) { const card = document.createElement('button'); card.type = 'button'; card.className = 'hr-card' + (r.unlocked ? ' on' : ' lock') + (sel === r.id ? ' sel' : '') + (after && after.id === r.id ? ' fallen' : ''); card.dataset.id = r.id; card.style.setProperty('--hc', r.col); card.style.setProperty('--rc', r.rarCol);
      if (!r.unlocked) { card.disabled = true; card.setAttribute('aria-disabled', 'true'); }
      card.appendChild(portrait(r.id, 96));
      card.insertAdjacentHTML('beforeend', '<div class="hr-n">' + esc(r.name) + '</div><div class="hr-c">' + esc(r.cls) + ' · <i style="color:' + r.rarCol + '">' + esc(r.rar) + '</i></div>' +
        (r.unlocked ? '<div class="hr-st"><span>runs <b>' + r.runs + '</b></span><span>best <b>' + (r.best ? 'Lv ' + r.best : '—') + '</b></span></div>' : '<div class="hr-lk"><span class="hr-lki">🔒</span>' + esc(r.unlockText) + '</div>') + (r.current && !after ? '<div class="hr-tag">RIDING</div>' : ''));
      grid.appendChild(card); } w.appendChild(grid);
    const foot = document.createElement('div'); foot.className = 'hr-foot'; const sc = rows.find(r => r.id === sel); const b = document.createElement('button'); b.className = 'pri hr-ride'; b.dataset.act = 'ride'; b.disabled = !sc;
    const again = !!(sc && after && after.id === sc.id), lives = alive(); b.textContent = lives ? 'YOUR HERO STILL LIVES' : sc ? (again ? 'RIDE AGAIN AS ' : 'RIDE AS ') + sc.name.toUpperCase() : 'NO HERO UNLOCKED'; if (lives) b.disabled = true;
    if (again && !lives) { const nl = document.createElement('div'); nl.className = 'hr-hint hr-again'; nl.textContent = 'A new life: ' + sc.name + ' starts again at level 1 at the seat. The Hall keeps the fallen.'; foot.appendChild(nl); }
    foot.appendChild(b);
    const hb = document.createElement('button'); hb.className = 'hr-hall'; hb.dataset.act = 'hall'; const B = best(); hb.textContent = 'Hall of the Fallen · ' + a.hall.length + (a.hall.length === 1 ? ' line' : ' lines') + (B.lvl ? ' · best Lv ' + B.lvl : ''); foot.appendChild(hb); w.appendChild(foot);
    el.innerHTML = ''; el.appendChild(w); };
  const bind = el => { if (el.__hr) return; el.__hr = true; el.addEventListener('click', ev => { const cur = R.ui && R.ui.cur; if (cur !== 'heroes' && cur !== 'hall') return; const b = ev.target.closest('[data-act]'); const card = ev.target.closest('.hr-card');
    if (b) { const act = b.dataset.act; if (act === 'back') { R.ui.close(); return; } if (act === 'death') { R.ui.open('death'); return; } if (act === 'hall') { R.ui.open('hall', { back: cur === 'heroes' ? { afterDeath: !!after } : null }); return; } if (act === 'heroes') { R.ui.open('heroes', b.dataset.after === '1' ? { afterDeath: true } : null); return; } if (act === 'ride' && sel) { ride(sel); return; } }
    else if (card && cur === 'heroes') { if (card.disabled || card.classList.contains('lock')) { const r = list().find(x => x.id === card.dataset.id); if (r) toast(r.unlockText, '#9fb6c9'); return; } sel = card.dataset.id; sfx('ui', 0.3); render(el); } }); };
  R.screens.heroes = { open(arg, el) { el = el || document.getElementById('screen'); const a = acc(); if (!a) { el.innerHTML = '<div class="hr-wrap"><div class="hr-hint">No account yet.</div></div>'; return; }
      after = null; if (arg && arg.afterDeath) { const p = R.state.p || {}; after = a.hall[a.hall.length - 1]; if (!after || (p.created && after.created && after.created !== p.created)) after = { id: current(), name: p.name || (champ(current()) || {}).name || 'A hero', lvl: p.lvl | 0, killer: null, at: Date.now() }; }
      if (arg && arg.id && isUnlocked(arg.id)) sel = arg.id; else if (!arg || !arg.keep) sel = null; bind(el); render(el); },
    close() { after = null; } };

  /* ---- the Hall of the Fallen ---- */
  R.screens.hall = { open(arg, el) { el = el || document.getElementById('screen'); const a = acc(); if (!a) return; bind(el); const B = best(); const w = document.createElement('div'); w.className = 'hr-wrap hall'; w.style.setProperty('--hc', colOf(a.house));
      const backTo = arg && arg.back, D = R.screens.death && R.screens.death.rec, fromDeath = !!(arg && arg.from === 'death' && D && !D.left), deadNow = !!(R.player && R.player.dead);
      w.innerHTML = '<div class="hr-head"><button class="hr-back" data-act="' + (fromDeath ? 'death' : backTo ? 'heroes' : 'back') + '" data-after="' + (backTo && backTo.afterDeath ? '1' : '0') + '" aria-label="Back">‹</button><h2>Hall of the Fallen</h2><span class="hr-house">House ' + esc(HNAME[a.house] || a.house) + '</span></div>' +
        '<div class="hr-sum"><div><b>' + B.runs + '</b><span>runs</span></div><div><b>' + (B.lvl ? 'Lv ' + B.lvl : '—') + '</b><span>best level</span></div><div><b>' + a.hall.length + '</b><span>fallen</span></div></div>';
      const L = document.createElement('div'); L.className = 'hr-hall-list'; if (!a.hall.length) L.innerHTML = '<div class="hr-hint">No one has fallen yet. Ride carefully.</div>';
      a.hall.slice().reverse().forEach((e, i) => { const row = document.createElement('div'); row.className = 'hr-row' + (i === 0 ? ' last' : ''); row.style.setProperty('--hc', colOf((champ(e.id) || {}).house || a.house)); row.appendChild(portrait(e.id, 44)); row.insertAdjacentHTML('beforeend', '<div class="hr-rowt"><div class="hr-rown">' + esc(e.name) + ' <b>Lv ' + (e.lvl | 0) + '</b></div><div class="hr-rowk">slain by ' + esc(e.killer || 'the cold') + ' · ' + fmtAgo(e.at || Date.now()) + (e.played ? ' · ' + Math.max(1, Math.round(e.played / 60)) + ' min' : '') + '</div></div>'); L.appendChild(row); });
      w.appendChild(L); const foot = document.createElement('div'); foot.className = 'hr-foot'; const b = document.createElement('button'); b.className = 'pri hr-ride'; b.dataset.act = backTo || deadNow ? 'heroes' : 'back'; b.dataset.after = (backTo && backTo.afterDeath) || deadNow ? '1' : '0'; b.textContent = deadNow ? 'CHOOSE THE NEXT HERO' : backTo ? 'CHOOSE A HERO' : 'BACK'; /* while the hero lies there the way on is the next hero */ foot.appendChild(b); w.appendChild(foot); el.innerHTML = ''; el.appendChild(w); },
    close() {} };

  R.heroes = { list, champ, starter, ensureStarter, unlock, isUnlocked, current, fall, portrait, clsOf, rarOf, unlockText, ride, best, bestOf, houseIds, listIds, acc };
})();
