/* HOLDOR RPG — NPCs and the dialog screen (A20).
 * R.npcs.spawnFor(poiId) → [npc entities] (kind 'npc', team 2, ring 40–90 units round the POI, deterministic by id hashes)
 * R.npcs.despawnFor(poiId) / at(poiId) / list() / data(npcId) / poi(poiId) / spawned (map poiId → entities)
 * R.npcs.offersFor(npcId) / turnInsFor(npcId) → quest objects (uses R.quests.offersFor / turnInsFor / canAccept / canTurnIn when present)
 * R.npcs.drawNpc(ctx, x, y, kind, {s, t, face}) — a code-drawn villager silhouette in the role colour, feet at (x, y), ~40 units tall at s = 1
 * NPC entity: e.type = e.sprite = 'champ:<id>' | 'npc:<kind>' (the 3D renderer billboards from e.type), e.rkind = the role kind, e.dialog = npcId, e.poi = poiId,
 *   e.frame(anim, t, face) → cached offscreen canvas (128×128 px = 64×64 units, feet at 60/64 of the height) for 'npc:<kind>' billboards.
 * R.npcs.drawEnt(ctx, e) — 2D fallback draw of one NPC at its screen position; also set as e.draw(ctx, sx, sy, o)
 * R.npcs.drawBubbles(ctx) — name tags, quest marks (! offer, ? turn-in) and speech bubbles on the 2D overlay, anchored at R.w2s(x, y, 80);
 *   called from 'draw:world' if the renderer emits it, else from this module's own system at order 910. Sprites are drawn there too only while no renderer exists.
 * System 'npcs' (order 70): keeps the NPCs of the nearest two POIs spawned, despawns the rest; idle bubble every 8 s within 120 units; faces the player.
 * R.screens.dialog (live: false — the game pauses): R.ui.open('dialog', npcEntity | npcId). Bottom sheet, portrait, typed text (40 chars/s, tap completes),
 *   choices: quest offers (ACCEPT → R.quests.accept), turn-ins (COMPLETE → R.quests.turnIn), shop / inn / smith (R.ui.open(name, poi)), LEAVE.
 * Quest / flag state is read from R.acc().world (save v2) or R.state.p (v1).
 * Data read (all optional): R.data.npcs — object or array of {id, name, kind|role, poi, champ?, lvl?, lines:{greet, idle}, services?:['shop','inn','smith']}
 *   R.data.world.pois — array or map of {id, name, x, y | pos, npcs?:[npcIds]}
 *   R.data.quests — object or array of {id, title, giver, turnin?, reward:{gold, xp, gems, item}, lvl?, after?, hidden?}
 *   R.data.story.dialogs[npcId] — string | string[] | {text, choices:[{t, act:'accept'|'turnin'|'shop'|'inn'|'smith'|'next'|'close', quest?, next?, text?}], nodes:{id:{text, choices}}, start?}
 *   Text templates: {p} player name, {n} NPC name, {poi} the POI's name, {h} the player's house.
 */
(function () {
  const ROLES = {
    villager: { col: '#9aa7b4', label: 'Villager' }, merchant: { col: '#d9a94b', label: 'Merchant' }, innkeeper: { col: '#c0673c', label: 'Innkeeper' },
    smith: { col: '#e3752d', label: 'Smith' }, guard: { col: '#5f84b1', label: 'Guard' }, maester: { col: '#9d8fc8', label: 'Maester' },
    septon: { col: '#e6d7a3', label: 'Septon' }, lord: { col: '#d1a33f', label: 'Lord' }, lady: { col: '#c98ab0', label: 'Lady' },
    ranger: { col: '#5b8a55', label: 'Ranger' }, hunter: { col: '#7a8a4a', label: 'Hunter' }, fisher: { col: '#5c9fb3', label: 'Fisher' },
    farmer: { col: '#8fa353', label: 'Farmer' }, elder: { col: '#b9b3a2', label: 'Elder' }, child: { col: '#e9b9a0', label: 'Child' },
    sellsword: { col: '#a8584e', label: 'Sellsword' }, wildling: { col: '#8b7355', label: 'Wildling' }, steward: { col: '#8a9ab0', label: 'Steward' },
    champion: { col: '#e3b661', label: 'Champion' } };
  const LINES = {
    villager: ['Cold wind tonight.', 'Keep to the road after dark.', 'The harvest was thin this year.'],
    merchant: ['Fair prices, fair weather.', 'Coin first, friend.', 'Fresh goods off the Kingsroad.'],
    innkeeper: ['Warm beds, hot stew.', 'Rest a while, traveller.', 'Mind the mud on your boots.'],
    smith: ['Steel does not lie.', 'Bring me iron, I bring you an edge.', 'Hear that ring? Good metal.'],
    guard: ['Move along.', 'Eyes open. The nights grow longer.', 'No trouble inside the walls.'],
    maester: ['Knowledge is slow work.', 'The ravens brought grim news.', 'Read, if you can. It helps.'],
    septon: ['The Seven watch the road.', 'Light a candle before you go.', 'Peace, child.'],
    lord: ['Speak plainly.', 'The realm asks much of us.', 'Loyalty is repaid.'], lady: ['Mind your manners here.', 'The hall is open to you.'],
    ranger: ['Something stirs beyond the Wall.', 'Travel light. Travel quiet.', 'The cold remembers.'],
    hunter: ['Tracks everywhere. None of them deer.', 'Wolves came close last night.'], fisher: ['The sea gives, the sea takes.', 'Nets are empty again.'],
    farmer: ['Frost on the fields already.', 'Raiders took two goats.'], elder: ['I remember a longer winter.', 'Sit. Listen. Then go.'],
    child: ['Are you a knight?', 'Can I hold your sword?'], sellsword: ['Pay me and I fight. Simple.', 'Seen worse odds. Not many.'],
    wildling: ['Kneelers. Always kneeling.', 'The dead walk. Believe it.'], steward: ['The lord is busy. State your business.', 'Ledgers do not fill themselves.'],
    champion: ['Stay close. I have your back.', 'Ready when you are.'] };
  const GREET = ['Well met, {p}. What brings you to {poi}?', 'A traveller, here, in this weather? Speak, {p}.', 'You carry a blade. Good. {poi} needs more of those.'];
  const SVC = { shop: 'TRADE', inn: 'REST AT THE INN', smith: 'SEE THE SMITH' };
  const KIND_SVC = { merchant: 'shop', innkeeper: 'inn', smith: 'smith' };

  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const frac = s => hash(s) / 4294967296;
  const vals = m => !m ? [] : Array.isArray(m) ? m : Object.keys(m).map(k => { const o = m[k]; if (o && typeof o === 'object' && o.id == null) o.id = k; return o; });
  const objs = m => vals(m).filter(o => o && typeof o === 'object');
  /* ONE roster: the story's named NPCs (R.data.npcs, js/41) + the world's per-POI roster (R.data.world.npcs, js/11) minus every world NPC whose
     role a story NPC at the same POI already covers (lord ~ steward, innkeeper ~ innkeep, merchant ~ anyone who sells, …): no doubles */
  const COVER = { lord: ['lord', 'steward'], steward: ['lord', 'steward'], maester: ['maester'], innkeeper: ['innkeeper', 'inn'], smith: ['smith'], merchant: ['shop'],
    septon: ['septon'], elder: ['elder'], ranger: ['ranger'], guard: ['guard'] };
  let rosterCache = null;
  const npcs = () => { const a = R.data.npcs, b = R.data.world && R.data.world.npcs, na = vals(a).length, nb = vals(b).length;
    if (rosterCache && rosterCache.a === a && rosterCache.b === b && rosterCache.na === na && rosterCache.nb === nb) return rosterCache.list;
    const story = objs(a), seen = new Set(story.map(n => n.id)), have = {};
    for (const n of story) { const k = n.poi; const h = have[k] || (have[k] = new Set()); h.add(n.kind || String(n.role || '').toLowerCase()); h.add(String(n.role || '').toLowerCase());
      for (const sv of list(n.services)) h.add(sv); if (n.lines && n.lines.inn) h.add('inn'); }
    const extra = objs(b).filter(n => { if (!n.id || seen.has(n.id)) return false; const h = have[n.poi]; const r = String(n.role || n.kind || '').toLowerCase();
      return !(h && (COVER[r] || [r]).some(x => h.has(x))); });
    const out = story.concat(extra); rosterCache = { a, b, na, nb, list: out }; return out; };
  const npcById = id => npcs().find(n => n.id === id) || null;
  const pois = () => objs(R.data.world && R.data.world.pois);
  const poiById = id => id == null ? null : pois().find(p => p.id === id) || null;
  const pxy = p => !p ? { x: 0, y: 0 } : { x: p.x != null ? p.x : p.pos ? p.pos.x : 0, y: p.y != null ? p.y : p.pos ? p.pos.y : 0 };
  const npcsAt = poiId => { const p = poiById(poiId), ids = (p && p.npcs) || []; return npcs().filter(n => n.poi === poiId || n.at === poiId || (n.pois && n.pois.indexOf(poiId) >= 0) || ids.indexOf(n.id) >= 0); };
  const kindOf = n => (n && (n.kind || n.role && String(n.role).toLowerCase())) in ROLES ? (n.kind || String(n.role).toLowerCase()) : n && n.champ ? 'champion' : 'villager';
  const roleOf = n => ROLES[kindOf(n)] || ROLES.villager;
  const tpl = (s, n) => String(s).replace(/\{p\}/g, (R.state && R.state.p.name) || 'traveller').replace(/\{n\}/g, (n && n.name) || '')
    .replace(/\{poi\}/g, (poiById(n && n.poi) || {}).name || 'this place').replace(/\{h\}/g, (R.state && ((R.state.acc && R.state.acc.house) || R.state.p.house)) || 'your house');
  const list = v => v == null ? [] : Array.isArray(v) ? v : [v];
  const greetLines = n => list(n.lines && n.lines.greet);
  const idleLines = n => { const l = list(n.lines && (n.lines.idle || n.lines.greet)); return l.length ? l : LINES[kindOf(n)] || LINES.villager; };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const c = i => { let v = (n >> (16 - 8 * i)) & 255; v = k < 0 ? v * (1 + k) : v + (255 - v) * k; return Math.round(R.clamp(v, 0, 255)); }; return 'rgb(' + c(0) + ',' + c(1) + ',' + c(2) + ')'; };

  /* ---- quests at an NPC (soft: R.quests may expose its own filters) ---- */
  const quests = () => objs(R.data.quests);
  const asQ = x => typeof x === 'string' ? quests().find(q => q.id === x) : x;
  const acc = () => { try { if (R.acc) return R.acc(); } catch (err) {} return R.state && R.state.acc; };
  const world = () => { const a = acc(); return (a && a.world) || (R.state && R.state.p) || {}; };
  const qstate = () => { const w = world(); return w.quests || (w.quests = {}); };
  const qst = id => qstate()[id] || null;
  const giver = q => q.giver || q.npc || q.from; const taker = q => q.turnin || q.turnIn || q.to || giver(q);
  function offersFor(npcId) { const Q = R.quests; if (Q && Q.offersFor) return list(Q.offersFor(npcId)).map(asQ).filter(Boolean);
    const lvl = R.state ? R.state.p.lvl : 1;
    return quests().filter(q => giver(q) === npcId && !qst(q.id) && !q.hidden && (q.lvl || (q.req && q.req.lvl) || 0) <= lvl
      && (!q.after || (qst(q.after) && qst(q.after).st === 'turned')) && (!Q || !Q.canAccept || Q.canAccept(q.id) !== false)); }
  function turnInsFor(npcId) { const Q = R.quests; if (Q && Q.turnInsFor) return list(Q.turnInsFor(npcId)).map(asQ).filter(Boolean);
    return quests().filter(q => taker(q) === npcId && qst(q.id) && qst(q.id).st === 'done' && (!Q || !Q.canTurnIn || Q.canTurnIn(q.id) !== false)); }
  const rew = q => q.reward || q.rew || q.rewards || {};
  function chips(q) { const r = rew(q), out = [];
    if (r.gold) out.push({ k: 'gold', t: '+' + r.gold + ' gold' }); if (r.xp) out.push({ k: 'xp', t: '+' + r.xp + ' XP' }); if (r.gems) out.push({ k: 'gems', t: '+' + r.gems + ' gems' });
    for (const it of list(r.item || r.items)) out.push({ k: 'item', t: typeof it === 'string' ? it.replace(/_/g, ' ') : (it.name || it.id || 'item') });
    if (r.champ) out.push({ k: 'champ', t: 'companion: ' + r.champ }); return out; }

  /* ---- entities ---- */
  const byPoi = {};
  function spawnFor(poiId) {
    if (byPoi[poiId]) return byPoi[poiId];
    const p = poiById(poiId); if (!p) return (byPoi[poiId] = []);
    const c = pxy(p), L = npcsAt(poiId), out = [], base = frac(poiId) * Math.PI * 2;
    L.forEach((n, i) => {
      let a = base + i * Math.PI * 2 / Math.max(1, L.length) + (frac(poiId + ':' + n.id) - 0.5) * 0.5; const rad = 40 + 50 * frac(n.id + '@' + poiId);
      let x, y, k = 0; do { x = c.x + Math.cos(a) * rad; y = c.y + Math.sin(a) * rad; a += 0.73; } while (R.world && R.world.blocked && R.world.blocked(x, y) && ++k < 9);
      const kind = kindOf(n);
      const sprite = n.champ ? 'champ:' + n.champ : 'npc:' + kind;
      const e = R.spawn({ kind: 'npc', team: 2, x, y, r: 14, name: n.name || n.id, dialog: n.id, poi: poiId, type: sprite, sprite, rkind: kind, role: n.role || roleOf(n).label,
        hp: 1, hpMax: 1, lvl: n.lvl || 1, face: x < c.x ? 1 : -1, npc: n, invuln: true, noBar: true, bubT: R.t + 1.5 + i * 1.7, bubN: 0, bub: null, mark: '', ph: frac(n.id) * 6.28 });
      e.draw = (ctx, sx, sy, o) => drawEnt(ctx, e, sx, sy, o); if (!n.champ) e.frame = (anim, t, face) => frameOf(kind, anim, t, face); out.push(e);
    });
    byPoi[poiId] = out; return out;
  }
  function despawnFor(poiId) { const l = byPoi[poiId]; if (!l) return; for (const e of l) { e.dead = true; R.remove(e); } delete byPoi[poiId]; }
  const all = () => Object.keys(byPoi).reduce((a, k) => a.concat(byPoi[k]), []);

  let nextChk = 0, poiCache = null, poiCacheN = -1;
  const poisWithNpcs = () => { const n = npcs().length; if (!poiCache || poiCacheN !== n) { poiCacheN = n; poiCache = pois().filter(p => p.id != null && npcsAt(p.id).length); } return poiCache; };
  R.addSys('npcs', { order: 70, update(dt) {
    const P = R.player; if (!P) return;
    if (R.t >= nextChk) { nextChk = R.t + 0.5;
      const near = poisWithNpcs().map(p => ({ id: p.id, d: Math.hypot(pxy(p).x - P.x, pxy(p).y - P.y) })).sort((a, b) => a.d - b.d).slice(0, 2).map(p => p.id);
      for (const id of near) if (!byPoi[id]) spawnFor(id);
      for (const id in byPoi) if (near.indexOf(id) < 0 && near.indexOf(+id) < 0) despawnFor(id);
      for (const e of all()) e.mark = turnInsFor(e.dialog).length ? '?' : offersFor(e.dialog).length ? '!' : '';
    }
    for (const e of all()) { const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d < 60) e.face = P.x < e.x ? -1 : 1;
      if (e.bub && R.t > e.bub.until) e.bub = null;
      if (d <= 120 && R.t >= e.bubT) { e.bubT = R.t + 8; const L = idleLines(e.npc); if (L.length) { e.bubN++; e.bub = { txt: tpl(L[(e.bubN + hash(e.dialog)) % L.length], e.npc), until: R.t + 3.5 }; } } }
  } });
  R.bus.on('interact', e => { if (e && e.kind === 'npc' && !e.dead) R.ui.open('dialog', e); });

  /* ---- drawing ---- */
  function drawNpc(ctx, x, y, kind, o) {
    o = o || {}; const s = o.s || 1, t = o.t != null ? o.t : R.t, f = o.face || 1, role = ROLES[kind] || ROLES.villager, col = role.col, dark = shade(col, -0.4), skin = '#d9b48c';
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.scale(f, 1); ctx.translate(0, Math.sin(t * 2.2 + (o.ph || 0)) * 0.8);
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(9, -1); ctx.lineTo(6, -27); ctx.lineTo(-6, -27); ctx.closePath(); ctx.fill();   /* cloak */
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(5, -2); ctx.lineTo(4, -26); ctx.lineTo(-4, -26); ctx.closePath(); ctx.fill();    /* tunic */
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-5.5, -15, 11, 2);                                                                                           /* belt */
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -32, 5.6, 0, Math.PI * 2); ctx.fill();                                                           /* head */
    ctx.lineCap = 'round';
    if (kind === 'guard') { ctx.fillStyle = '#7d8793'; ctx.beginPath(); ctx.arc(0, -33, 6.2, Math.PI, 0); ctx.fill(); ctx.fillRect(-6.2, -33, 12.4, 2.5); ctx.fillRect(-1, -33, 2, 5);
      ctx.strokeStyle = '#6b5234'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(9, -44); ctx.stroke(); ctx.fillStyle = '#b9c2cc'; ctx.beginPath(); ctx.moveTo(9, -50); ctx.lineTo(6.5, -43); ctx.lineTo(11.5, -43); ctx.fill(); }
    else if (kind === 'smith') { ctx.fillStyle = '#4a3a2c'; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(3.4, -22); ctx.lineTo(-3.4, -22); ctx.fill();
      ctx.strokeStyle = '#6b5234'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(13, -22); ctx.stroke(); ctx.fillStyle = '#8a9099'; ctx.fillRect(10, -27, 7, 5); }
    else if (kind === 'merchant') { ctx.fillStyle = shade(col, -0.5); ctx.beginPath(); ctx.ellipse(0, -36, 9, 2.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -37, 5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#7d5a2b'; ctx.beginPath(); ctx.arc(7.5, -11, 3.6, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === 'innkeeper') { ctx.fillStyle = '#e8dfca'; ctx.beginPath(); ctx.moveTo(-3.8, -3); ctx.lineTo(3.8, -3); ctx.lineTo(3.2, -14); ctx.lineTo(-3.2, -14); ctx.fill(); ctx.fillStyle = '#7d5a2b'; ctx.fillRect(7, -16, 4, 5); }
    else if (kind === 'lord' || kind === 'lady') { ctx.fillStyle = '#e3b661'; ctx.beginPath(); ctx.moveTo(-5, -36); ctx.lineTo(-5, -41); ctx.lineTo(-2.5, -38); ctx.lineTo(0, -42); ctx.lineTo(2.5, -38); ctx.lineTo(5, -41); ctx.lineTo(5, -36); ctx.fill(); }
    else if (kind === 'maester') { ctx.fillStyle = '#5a5f6a'; ctx.beginPath(); ctx.arc(0, -33, 6.4, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); ctx.strokeStyle = '#c9b26a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -22, 5, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.strokeStyle = '#6b5234'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-9, -36); ctx.stroke(); }
    else if (kind === 'septon') { ctx.fillStyle = '#d8ccb0'; ctx.beginPath(); ctx.arc(0, -33, 6.4, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); ctx.strokeStyle = '#e3b661'; ctx.lineWidth = 1.2;
      ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 7; ctx.moveTo(0, -18); ctx.lineTo(Math.cos(a) * 3.5, -18 + Math.sin(a) * 3.5); } ctx.stroke(); }
    else if (kind === 'ranger' || kind === 'hunter') { ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, -33, 6.4, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.strokeStyle = '#6b5234'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-9, -16, 10, -Math.PI / 2 + 0.2, Math.PI / 2 - 0.2); ctx.stroke(); ctx.lineWidth = 0.6; ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(-9, -26); ctx.lineTo(-9, -6); ctx.stroke(); }
    else if (kind === 'elder') { ctx.fillStyle = '#d8d3c6'; ctx.beginPath(); ctx.arc(0, -33, 6.2, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#6b5234'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(7, -30); ctx.stroke(); }
    else if (kind === 'child') { ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(0, -33, 5.8, Math.PI, 0); ctx.fill(); }
    else if (kind === 'champion') { ctx.fillStyle = '#e3b661'; ctx.fillRect(-7, -18, 14, 1.6); ctx.fillStyle = '#b9c2cc'; ctx.fillRect(8, -30, 1.8, 24); }
    else { ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, -33, 6.4, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); }                                     /* hood */
    ctx.fillStyle = '#2a1e16'; ctx.fillRect(1.2, -31.5, 1.4, 1.4);                                                                                       /* eye */
    ctx.restore();
  }
  /* billboard frames for the 3D renderer: 128×128 px canvas = 64×64 world units, feet at y = 60/64; 8 frames of the idle bob */
  const FRAMES = {}, FW = 64, FH = 64, FEET = 60;
  function frameOf(kind, anim, t, face) {
    const fi = Math.floor((((t || 0) * 2.2) % (Math.PI * 2)) / (Math.PI * 2) * 8) & 7, key = kind + '|' + (face < 0 ? -1 : 1) + '|' + fi; let cv = FRAMES[key];
    if (!cv) { cv = FRAMES[key] = document.createElement('canvas'); cv.width = FW * 2; cv.height = FH * 2; const c = cv.getContext('2d'); c.scale(2, 2);
      drawNpc(c, FW / 2, FEET, kind, { s: 1, t: fi / 8 * Math.PI * 2 / 2.2, face: face < 0 ? -1 : 1, noShadow: true }); cv.units = { w: FW, h: FH }; cv.anchor = { x: 0.5, y: FEET / FH }; }
    return cv;
  }
  const isCanvas = c => c && typeof c === 'object' && c.width > 0 && typeof c.getContext === 'function';
  function drawEnt(ctx, e, sx, sy, o) {
    o = o || {}; const z = o.s || R.cam.z || 1; if (sx == null) { const p = R.w2s(e.x, e.y, 0); sx = p.x; sy = p.y; }
    if (e.type && e.type.indexOf('champ:') === 0 && R.draw) {
      if (R.draw.frame) { try { const f = R.draw.frame(e.type, e.anim || 'idle', e.animT || 0, e.face || 1); if (isCanvas(f)) { const u = f.units || { w: f.width / 2, h: f.height / 2 }, an = f.anchor || { x: 0.5, y: 1 }; ctx.drawImage(f, sx - u.w * an.x * z, sy - u.h * an.y * z, u.w * z, u.h * z); return; } } catch (err) {} }
      if (R.draw.champ) { try { R.draw.champ(e.type.slice(6), sx, sy, { anim: e.anim, face: e.face, t: e.animT, s: z, ent: e }); return; } catch (err) {} }
    }
    drawNpc(ctx, sx, sy, e.rkind || 'villager', { s: z, face: e.face, t: e.animT, ph: e.ph });
  }
  function portrait(cv, n) {
    const ctx = cv.getContext('2d'), role = roleOf(n); ctx.clearRect(0, 0, 144, 144);
    ctx.save(); ctx.beginPath(); ctx.arc(72, 72, 69, 0, Math.PI * 2); ctx.fillStyle = '#0b1220'; ctx.fill(); ctx.clip();
    const g = ctx.createRadialGradient(72, 50, 8, 72, 72, 72); g.addColorStop(0, shade(role.col, -0.2)); g.addColorStop(1, '#0b1220'); ctx.fillStyle = g; ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, 144, 144); ctx.globalAlpha = 1;
    let ok = false;
    if (n.champ && R.draw && R.draw.frame) { try { const f = R.draw.frame('champ:' + n.champ, 'idle', 0, 1); if (isCanvas(f)) { const u = f.units || { w: f.width / 2, h: f.height / 2 }, an = f.anchor || { x: 0.5, y: 1 }, k = 2.6; ctx.drawImage(f, 72 - u.w * an.x * k, 134 - u.h * an.y * k, u.w * k, u.h * k); ok = true; } } catch (err) {} }
    if (!ok && n.champ && R.draw && R.draw.champ) { const old = R.ctx; R.ctx = ctx; try { R.draw.champ(n.champ, 72, 134, { anim: 'idle', face: 1, t: 0, s: 2.6, portrait: true, ctx }); ok = true; } catch (err) {} R.ctx = old; }
    if (!ok) drawNpc(ctx, 72, 134, kindOf(n), { s: 2.9, t: 0, face: 1 });
    ctx.restore(); ctx.beginPath(); ctx.arc(72, 72, 69, 0, Math.PI * 2); ctx.strokeStyle = role.col; ctx.lineWidth = 4; ctx.stroke();
  }
  function bubble(ctx, sx, sy, txt, col) {
    ctx.font = '600 12px "EB Garamond",Georgia,serif'; const w = Math.min(170, ctx.measureText(txt).width + 16), h = 22, x = Math.round(sx - w / 2), y = Math.round(sy - h);
    ctx.fillStyle = 'rgba(242,230,201,.94)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 5, y + h); ctx.lineTo(sx + 5, y + h); ctx.lineTo(sx, y + h + 6); ctx.fill();
    ctx.fillStyle = '#1a2231'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let t = txt; while (t.length > 4 && ctx.measureText(t).width > w - 12) t = t.slice(0, -2); if (t !== txt) t = t.slice(0, -1) + '…'; ctx.fillText(t, sx, y + h / 2 + 1);
  }
  function drawBubbles(ctx) {
    const z = R.cam.z || 1, selfDraw = !(R.sys.render || R.sys.renderer || R.gl || R.three || document.getElementById('gl'));
    const L = all().filter(e => !e.dead).sort((a, b) => a.y - b.y);
    for (const e of L) { const p = R.w2s(e.x, e.y, 0), q = R.w2s(e.x, e.y, 80); if (p.x < -120 || p.y < -120 || p.x > R.vw + 120 || p.y > R.vh + 120) continue;
      if (selfDraw) drawEnt(ctx, e, p.x, p.y, { s: z });
      const top = (q.y === p.y && q.x === p.x) ? p.y - 48 * z : q.y - 6, col = (ROLES[e.rkind] || ROLES.villager).col;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 11px Cinzel,Georgia,serif'; const nw = ctx.measureText(e.name).width + 12;
      ctx.fillStyle = 'rgba(6,11,20,.7)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p.x - nw / 2, top - 8, nw, 16, 6) : ctx.rect(p.x - nw / 2, top - 8, nw, 16); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(e.name, p.x, top + 1);
      if (e.mark) { const bob = Math.sin(R.t * 4 + e.ph) * 2; ctx.font = '900 16px Cinzel,Georgia,serif'; ctx.fillStyle = '#060b14'; ctx.fillText(e.mark, p.x + 1, top - 20 + bob + 1); ctx.fillStyle = e.mark === '?' ? '#7fd06a' : '#e3b661'; ctx.fillText(e.mark, p.x, top - 20 + bob); }
      if (e.bub) bubble(ctx, p.x, top - (e.mark ? 34 : 16), e.bub.txt, col);
      ctx.restore(); }
  }
  let viaBus = false;
  R.bus.on('draw:world', ctx => { viaBus = true; drawBubbles(ctx || R.ctx); });
  R.addSys('npcBubbles', { order: 910, draw(ctx) { if (!viaBus) drawBubbles(ctx); } });

  R.npcs = { spawnFor, despawnFor, at: id => byPoi[id] || [], list: all, spawned: byPoi, data: npcById, poi: poiById, poisWithNpcs, npcsAt, offersFor, turnInsFor, chips, drawNpc, frameOf, drawEnt, drawBubbles, portrait, ROLES, LINES, kindOf, roleOf, tpl, qstate };
  if (R.draw && !R.draw.npc) R.draw.npc = drawNpc;

  /* ---- the dialog screen ---- */
  /* 41_story writes a dialog as an array of nodes [{text, choices:[{t, next:i} | {t, quest} | {t, inn} | {t, shop} | {t, close}]}]: turn it into
     {start:'0', nodes}; quest choices are dropped (the quest cards come from R.quests), inn / shop / close become acts */
  const fromArray = arr => { const nodes = {}; arr.forEach((nd, i) => { nodes[i] = { text: nd.text, choices: list(nd.choices).filter(c => c && !c.quest).map(c =>
      c.close ? { t: c.t, act: 'close' } : c.inn ? { t: c.t, act: 'inn' } : c.shop ? { t: c.t, act: 'shop' } : c.smith ? { t: c.t, act: 'smith' } : c.next != null ? { t: c.t, next: String(c.next) } : c) }; });
    return { start: '0', nodes }; };
  const isNodeArr = d => Array.isArray(d) && d.length && d[0] && typeof d[0] === 'object' && d[0].text != null;
  const nodeOf = (def, n) => { if (def == null) return null; if (isNodeArr(def)) def = fromArray(def); if (typeof def === 'string' || Array.isArray(def)) return { text: def }; if (def.nodes) return def.nodes[def.start || 'start'] || def; return def; };
  const pagesOf = (t, n) => { if (typeof t === 'function') t = t(n, R.state); return list(t).map(s => tpl(s, n)).filter(Boolean); };
  const services = n => { const s = list(n.services || n.service || (n.shop === true ? 'shop' : n.shop)); if (!s.length && KIND_SVC[kindOf(n)]) s.push(KIND_SVC[kindOf(n)]); return s.filter(x => SVC[x]); };
  const S = R.screens.dialog = { live: false, state: null, el: null,
    open(arg, el) {
      const ent = typeof arg === 'string' ? R.find(e => e.kind === 'npc' && e.dialog === arg) || null : arg || null;
      const id = ent ? ent.dialog : arg; const n = npcById(id) || (ent && ent.npc) || { id: String(id), name: (ent && ent.name) || 'Stranger', kind: (ent && ent.rkind) || 'villager' };
      const poi = poiById(ent && ent.poi != null ? ent.poi : n.poi);
      const def = R.data.story && R.data.story.dialogs ? R.data.story.dialogs[n.id] : null;
      const flags = R.state ? (world().flags || (world().flags = {})) : {}; const met = flags['met:' + n.id] || 0;
      let d0 = typeof def === 'function' ? def(n, R.state) : def; if (isNodeArr(d0)) d0 = fromArray(d0);
      const st = S.state = { id: n.id, npc: n, ent, poi, def: d0, root: null, node: null, pages: [], page: 0, full: '', shown: '', typing: false, done: false, timer: 0, met };
      st.root = nodeOf(st.def, n) || { text: [GREET[(hash(n.id) + met) % GREET.length]].concat(greetLines(n).length ? [greetLines(n)[met % greetLines(n).length]] : []).join(' ') };
      try { const ti = turnInsFor(n.id), of = offersFor(n.id), T = q => q && q.text || {};
        const lines = ti.length ? [T(ti[0]).done] : of.length ? (T(of[0]).pages && T(of[0]).pages.length ? T(of[0]).pages : [T(of[0]).offer]) : null;
        if (lines && lines.filter(Boolean).length) st.root = { text: lines.filter(Boolean), choices: (st.root && st.root.choices) || [] }; } catch (err) {}
      el.innerHTML = '';
      const sh = document.createElement('div'); sh.className = 'dlg'; sh.dataset.npc = n.id; sh.style.setProperty('--role', roleOf(n).col);
      sh.innerHTML = '<div class="dlg-top"><canvas class="dlg-por" width="144" height="144"></canvas><div class="dlg-who"><div class="dlg-name"></div><div class="dlg-role"></div></div></div>'
        + '<div class="dlg-txt"><span class="dlg-t"></span><span class="dlg-caret"></span><span class="dlg-hint">tap ▸</span></div><div class="dlg-ch"></div>';
      el.appendChild(sh); S.el = sh;
      sh.querySelector('.dlg-name').textContent = n.name || n.id;
      sh.querySelector('.dlg-role').textContent = [n.role || roleOf(n).label, poi && poi.name].filter(Boolean).join(' · ');
      portrait(sh.querySelector('.dlg-por'), n);
      sh.addEventListener('click', ev => { if (ev.target.closest('button')) return; S.tap(); });
      el.onclick = ev => { if (ev.target === el) S.leave(); };
      S.show(st.root);
      if (R.state) { flags['met:' + n.id] = met + 1; R.save(); }
      if (ent) ent.face = R.player && R.player.x < ent.x ? -1 : 1;
      R.bus.emit('dialog', n.id); if (R.sfx && R.sfx.play) { try { R.sfx.play('ui', 0.5); } catch (err) {} }
    },
    show(node) { const st = S.state; if (!st) return; st.node = node || st.root; st.pages = pagesOf(st.node.text, st.npc); if (!st.pages.length) st.pages = ['…']; st.page = 0;
      const box = S.el.querySelector('.dlg-ch'); box.innerHTML = ''; box.classList.remove('on'); S.type(); },
    type() { const st = S.state; clearInterval(st.timer); st.full = st.pages[st.page]; st.shown = ''; st.typing = true; st.done = false; S.render();
      st.timer = setInterval(() => { if (S.state !== st) return clearInterval(st.timer); st.shown = st.full.slice(0, st.shown.length + 1); if (st.shown.length >= st.full.length) S.finish(); else S.render(); }, 25); },
    finish() { const st = S.state; if (!st) return; clearInterval(st.timer); st.shown = st.full; st.typing = false; st.done = st.page >= st.pages.length - 1; S.render(); if (st.done) S.choices(); },
    tap() { const st = S.state; if (!st) return; if (st.typing) S.finish(); else if (st.page < st.pages.length - 1) { st.page++; S.type(); } },
    render() { const st = S.state; if (!st || !S.el) return; S.el.querySelector('.dlg-t').textContent = st.shown; S.el.classList.toggle('typing', st.typing); S.el.classList.toggle('more', !st.typing && !st.done); },
    choices() {
      const st = S.state, n = st.npc, box = S.el.querySelector('.dlg-ch'); box.innerHTML = ''; let pri = false;
      const mk = (cls, txt, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.addEventListener('click', ev => { ev.stopPropagation(); fn(); }); return b; };
      const card = (q, kind) => { const d = document.createElement('div'); d.className = 'dlg-q ' + kind; d.dataset.quest = q.id;
        const t = document.createElement('div'); t.className = 'dlg-qt'; t.textContent = (kind === 'offer' ? '✦ ' : '✓ ') + (q.title || q.name || q.id); d.appendChild(t);
        const ch = document.createElement('div'); ch.className = 'dlg-chips'; for (const c of chips(q)) { const s = document.createElement('span'); s.className = 'chip ' + c.k; s.textContent = c.t; ch.appendChild(s); } if (ch.childNodes.length) d.appendChild(ch);
        d.appendChild(mk((pri ? 'dlg-b ' : 'pri ') + (kind === 'offer' ? 'dlg-acc' : 'dlg-done'), kind === 'offer' ? 'ACCEPT' : 'COMPLETE', () => kind === 'offer' ? S.accept(q) : S.turnIn(q))); pri = true; return d; };
      for (const q of turnInsFor(n.id)) box.appendChild(card(q, 'turnin'));
      for (const q of offersFor(n.id)) box.appendChild(card(q, 'offer'));
      const ex = list(st.node.choices).filter(Boolean), svc = services(n).filter(s => !ex.some(c => c.act === s)).map(s => ({ t: SVC[s], act: s }));
      for (const c of ex.concat(svc)) { if (c.act === 'close') continue; if ((c.act === 'accept' || c.act === 'turnin') && !c.quest) continue;
        const b = mk(pri ? 'dlg-b dlg-svc' : 'pri dlg-svc', c.t || c.text || SVC[c.act] || String(c.act).toUpperCase(), () => S.choose(c)); b.dataset.act = c.act || 'say'; box.appendChild(b); pri = true; }
      const cl = ex.find(c => c.act === 'close'); box.appendChild(mk(pri ? 'dlg-b dlg-leave' : 'pri dlg-leave', (cl && cl.t) || 'LEAVE', () => S.leave()));
      box.classList.add('on');
    },
    choose(c) { const st = S.state; if (!st) return;
      if (c.act === 'accept') { const q = asQ(c.quest); if (q) S.accept(q); return; } if (c.act === 'turnin') { const q = asQ(c.quest); if (q) S.turnIn(q); return; }
      if (SVC[c.act]) return S.service(c.act);
      if (c.next && st.def && st.def.nodes && st.def.nodes[c.next]) return S.show(st.def.nodes[c.next]);
      if (c.text || c.say) return S.show({ text: c.text || c.say, choices: c.choices || [] });
      S.leave(); },
    service(name) { const st = S.state; if (R.screens[name]) R.ui.open(name, st.poi || st.ent); else R.ui.toast('The ' + name + ' is closed for now.'); },
    accept(q) { const st = S.state; let ok = true;
      try { if (R.quests && R.quests.accept) ok = R.quests.accept(q.id, st.id) !== false; else { qstate()[q.id] = { st: 'open', n: 0 }; R.bus.emit('quest', q.id, 'open'); } } catch (err) { console.error(err); ok = false; }
      if (!ok) { R.ui.toast('You cannot take that quest now.'); return S.choices(); }
      R.ui.toast('Quest accepted: ' + (q.title || q.id), '#e3b661'); R.save(); if (R.sfx && R.sfx.play) { try { R.sfx.play('quest', 0.6); } catch (err) {} } R.ui.close(); },
    turnIn(q) { const st = S.state; let ok = true;
      try { if (R.quests && R.quests.turnIn) ok = R.quests.turnIn(q.id, st.id) !== false; else { const Q = qstate(), s = Q[q.id] || (Q[q.id] = {}); s.st = 'turned'; const r = rew(q); if (r.gold) { R.state.p.gold += r.gold; R.bus.emit('gold', r.gold); } if (r.gems) { R.state.p.gems += r.gems; } if (r.xp) R.bus.emit('xp', r.xp); R.bus.emit('quest', q.id, 'turned'); } } catch (err) { console.error(err); ok = false; }
      if (!ok) { R.ui.toast('Not finished yet.'); return S.choices(); }
      R.ui.toast('Quest complete: ' + (q.title || q.id), '#7fd06a'); R.save(); if (R.sfx && R.sfx.play) { try { R.sfx.play('reward', 0.7); } catch (err) {} } R.ui.close(); },
    leave() { R.ui.close(); },
    close() { const st = S.state; if (st) clearInterval(st.timer); S.state = null; S.el = null; const el = document.getElementById('screen'); if (el) el.onclick = null; } };
})();
