/* 50_training.js — god training (the owner's idea, 2026-11-23): the player grows with his god across rounds, with a small edge only,
   so a newcomer and a friend can still beat a veteran.
   - Each god has his own XP in localStorage 'hg_train' (the player's own save: no server).
     A round gives XP = banked gold + 5 per robbery + 10 for finishing.
   - Levels 1..10 (XP 0, 60, 150, 280, 450, 670, 950, 1300, 1700, 2200). Each new level offers one of two perks for that god on the end
     screen (#endExtra). Every perk can be taken at most 3 times and moves one number by at most 15 % (speed 9 %, robbed share 9 %).
     9 picks (Lv 2..10) from 12 slots, so two choices are always open.
   - Perks reach the game only through G.addMod, and only for the human hero (p === G.S.me), never for bots.
   - The title cards (#gods .god) get "Lv N" and a thin XP bar once the god has XP (a god never played shows none); the core rebuilds the cards on each tap, a MutationObserver re-decorates them.
   - The end screen (the owner: "too much text"): one line "Thor Lv 2 [bar] +141 XP"; on a pick, "🎁 Pick one" and two cards
     (the gift's name, "Reach +5%"); after it "✓ <gift>". No breakdowns.
   - Test hooks: G.train = { get(god) → {lvl, xp, prev, next, perks, pending, offer}, reset(), offer(god), factor(god, mod), PERKS, LEVELS }. */
const G = window.G; if (!G || !G.on || !G.addMod) return;
const KEY = 'hg_train', LV = [0, 60, 150, 280, 450, 670, 950, 1300, 1700, 2200], MAXL = LV.length, XP_ROB = 5, XP_FINISH = 10, MAXT = 3, CAP = 0.15;
const num = (v, d) => String(+v.toFixed(d));
/* step = the relative change of one take; |step| × MAXT ≤ CAP. `what` names the number on the card ("Reach +5%"); base → the number itself */
const PERKS = {
  h_dash:   { god: 'hermes',  mod: 'dash',      n: 'Longer dash',    step: 0.05,  what: 'Dash',     base: () => 0.3,  f: v => num(v, 3) + ' s' },
  h_speed:  { god: 'hermes',  mod: 'speed',     n: 'Swift feet',     step: 0.03,  what: 'Speed',    base: () => 1,    f: v => '+' + num((v - 1) * 100, 1) + '%' },
  t_reach:  { god: 'thor',    mod: 'thorR',     n: 'Wider thunder',  step: 0.05,  what: 'Reach',    base: () => 170,  f: v => num(v, 0) },
  t_share:  { god: 'thor',    mod: 'thorShare', n: 'Heavier strike', step: 0.04,  what: 'Strike',   base: () => 0.25, f: v => num(v * 100, 1) + '%' },
  l_vanish: { god: 'loki',    mod: 'lokiT',     n: 'Longer vanish',  step: 0.05,  what: 'Vanish',   base: () => 3,    f: v => num(v, 2) + ' s' },
  l_cd:     { god: 'loki',    mod: 'cd',        n: 'Quick tricks',   step: -0.05, what: 'Cooldown', base: () => (G.GODS.loki || {}).cd || 10, f: v => num(v, 2) + ' s' },
  a_chain:  { god: 'amirani', mod: 'chainT',    n: 'Longer chains',  step: 0.05,  what: 'Chains',   base: () => 3,    f: v => num(v, 2) + ' s' },
  a_cd:     { god: 'amirani', mod: 'cd',        n: 'Quick chains',   step: -0.05, what: 'Cooldown', base: () => (G.GODS.amirani || {}).cd || 10, f: v => num(v, 2) + ' s' },
  bank:     { god: '*',       mod: 'bankT',     n: 'Quick banker',   step: -0.05, what: 'Bank',     base: () => G.BANK_T || 1.5, f: v => num(v, 2) + ' s' },
  purse:    { god: '*',       mod: 'rob',       n: 'Tight purse',    step: -0.03, what: 'Robbed', base: () => G.ROB || 0.35, f: v => num(v * 100, 1) + '%' },
};
const ORDER = { hermes: ['h_dash', 'h_speed'], thor: ['t_reach', 't_share'], loki: ['l_vanish', 'l_cd'], amirani: ['a_chain', 'a_cd'] };
const order = g => (ORDER[g] || []).concat(['bank', 'purse']);

/* ---------- the save ---------- */
let T = { v: 1, g: {} };
const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object' && o.g && typeof o.g === 'object') T = { v: 1, g: o.g }; } catch (e) {} };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) {} };
load();
const rec = g => { let r = T.g[g]; if (!r || typeof r !== 'object') r = T.g[g] = { xp: 0, p: {} }; if (!r.p || typeof r.p !== 'object') r.p = {}; return r; };
const xpOf = g => { const r = T.g[g]; const x = r && +r.xp; return isFinite(x) && x > 0 ? Math.floor(x) : 0; };
const takes = (g, id) => { const r = T.g[g]; const n = r && r.p ? Math.floor(+r.p[id]) : 0; return isFinite(n) ? Math.max(0, Math.min(MAXT, n)) : 0; };
const lvlOf = xp => { let l = 1; while (l < MAXL && xp >= LV[l]) l++; return l; };
const used = g => order(g).reduce((s, id) => s + takes(g, id), 0);
function offer(g) {
  const pend = lvlOf(xpOf(g)) - 1 - used(g); if (pend <= 0) return [];
  const open = order(g).filter(id => takes(g, id) < MAXT); if (!open.length) return [];
  if (open.length === 1) return open;
  const i = used(g) % open.length; return [open[i], open[(i + 1) % open.length]];
}
function get(g) {
  const xp = xpOf(g), lvl = lvlOf(xp), perks = {};
  for (const id of order(g)) { const n = takes(g, id); if (n) perks[id] = n; }
  return { lvl, xp, prev: LV[lvl - 1], next: lvl < MAXL ? LV[lvl] : null, perks, pending: Math.max(0, lvl - 1 - used(g)), offer: offer(g) };
}
const frac = s => s.next == null ? 1 : Math.max(0, Math.min(1, (s.xp - s.prev) / (s.next - s.prev)));
/* the training factor on one number for one god: each perk ≤ MAXT takes, and the product held inside ±CAP */
function factor(g, m) {
  let f = 1; for (const id of order(g)) { const P = PERKS[id]; if (P.mod === m) f *= 1 + P.step * takes(g, id); }
  return Math.max(1 - CAP, Math.min(1 + CAP, f));
}
function pick(g, id) {
  if (!offer(g).includes(id)) return false;
  const r = rec(g); r.p[id] = takes(g, id) + 1; save(); return true;
}

/* ---------- the modifiers: the human hero only ---------- */
for (const m of ['speed', 'cd', 'dash', 'thorR', 'thorShare', 'lokiT', 'chainT', 'bankT', 'rob'])
  G.addMod(m, (p, v) => { const S = G.S; if (!p || !S || p !== S.me || p.bot) return v; const f = factor(p.god, m); return f === 1 ? v : v * f; });

/* ---------- styles ---------- */
const st = document.createElement('style');
st.textContent = '.god{position:relative}' +
  '.trn-lv{position:absolute;left:8px;top:6px;font:700 11px/1 Georgia,serif;color:#e8b84a;pointer-events:none;letter-spacing:.02em}' +
  '.trn-cb{position:absolute;left:8px;top:20px;width:32px;height:3px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden;pointer-events:none}' +
  '.trn-cb>span{display:block;height:100%;background:#e8b84a}.trn-lv[hidden],.trn-cb[hidden]{display:none}' +
  '.trn-end{width:min(100%,440px);display:flex;flex-direction:column;align-items:stretch;gap:6px}' +
  '.trn-head{display:flex;align-items:center;gap:10px;font:700 15px/1.2 Georgia,serif;color:#f3e7c4;white-space:nowrap}' +
  '.trn-head .x{color:#e8b84a;font-weight:900}' +
  '.trn-bar{flex:1 1 auto;min-width:60px;height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}' +
  '.trn-bar>span{display:block;height:100%;background:linear-gradient(90deg,#b8862b,#f0c75e);transition:width .8s ease-out}' +
  '.trn-up{font:700 14px/1.3 Georgia,serif;color:#e8b84a;text-align:center;white-space:nowrap}' +
  '.trn-pick{display:flex;flex-direction:column;gap:6px}' +
  '.trn-row{display:flex;gap:8px;flex:1 1 auto}' +
  '.trn-row .sec{width:auto;flex:1 1 0;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:5px 8px;line-height:1.2}' +
  '.trn-row .sec b{font-size:15px;white-space:nowrap}.trn-row .sec small{font:700 13px/1.2 Georgia,serif;color:#e8b84a;white-space:nowrap}' +
  '@media (max-height:430px){.trn-end{width:min(100%,600px);gap:4px}.trn-head{font-size:14px}' +
  '.trn-pick{flex-direction:row;align-items:center;gap:8px}.trn-pick .trn-up{flex:0 0 auto;text-align:left;font-size:13px}.trn-row .sec{min-height:48px;padding:4px 8px}.trn-row .sec b{font-size:14px}}';
document.head.appendChild(st);

/* ---------- the title cards ---------- */
function decorate() {
  const box = G.$('gods'); if (!box) return;
  for (const b of box.querySelectorAll('.god')) {
    const g = b.dataset.god; if (!g) continue;
    let lv = b.querySelector('.trn-lv'), cb = b.querySelector('.trn-cb');
    if (!lv) { lv = document.createElement('span'); lv.className = 'trn-lv'; b.appendChild(lv); }
    if (!cb) { cb = document.createElement('span'); cb.className = 'trn-cb'; cb.appendChild(document.createElement('span')); b.appendChild(cb); }
    const s = get(g), fresh = !s.xp && s.lvl < 2; lv.textContent = 'Lv ' + s.lvl; cb.firstChild.style.width = Math.round(frac(s) * 100) + '%';
    lv.hidden = cb.hidden = fresh;   // a god never played: no badge, no empty bar (four "Lv 1" say nothing)
  }
}
decorate();
try { const box = G.$('gods'); if (box && window.MutationObserver) new MutationObserver(decorate).observe(box, { childList: true }); } catch (e) {}
G.on('title', decorate);

/* ---------- the end screen ---------- */
let last = null;   // the last round: {god, gain, bank, robs, fromXp, fromLvl, took, fresh}
/* the card's second line: the number it moves and by how much, unit-free ("Reach +5%", "Cooldown −5%") */
const line = id => { const P = PERKS[id], v = Math.round(P.step * 100); return P.what + ' ' + (v < 0 ? '−' + -v : '+' + v) + '%'; };
function box() {
  let el = document.getElementById('trainEnd');
  const host = G.$('endExtra');
  if (!el) { el = document.createElement('div'); el.id = 'trainEnd'; el.className = 'trn-end'; }
  if (host && el.parentNode !== host) host.appendChild(el);
  else if (!host && !el.parentNode) { const a = G.$('again'); if (a && a.parentNode) a.parentNode.insertBefore(el, a); }
  return el;
}
function renderEnd() {
  if (!last) return;
  const el = box(), g = last.god, GD = G.GODS[g] || { n: g, c: '#e8b84a' }, s = get(g);
  const w = Math.round(frac(s) * 100), w0 = last.fresh ? (s.lvl === last.fromLvl ? Math.round(frac({ xp: last.fromXp, prev: s.prev, next: s.next }) * 100) : 0) : w;
  let h = '<div class="trn-head"><span>' + GD.n + ' Lv ' + s.lvl + '</span><span class="trn-bar"><span style="width:' + w0 + '%"></span></span><span class="x">+' + last.gain + ' XP</span></div>';
  const off = s.offer;
  if (off.length) {
    h += '<div class="trn-pick"><div class="trn-up">🎁 Pick one</div><div class="trn-row">' +
      off.map(id => '<button class="sec" data-perk="' + id + '" style="border-color:' + GD.c + '"><b>' + PERKS[id].n + '</b><small>' + line(id) + '</small></button>').join('') + '</div></div>';
  } else if (last.took) h += '<div class="trn-up">✓ ' + PERKS[last.took].n + '</div>';
  el.innerHTML = h;
  for (const b of el.querySelectorAll('button[data-perk]')) b.addEventListener('click', () => {
    if (b.disabled) return; for (const o of el.querySelectorAll('button[data-perk]')) o.disabled = true;
    const id = b.dataset.perk;
    if (pick(g, id)) { last.took = id; G.haptic('light'); }
    last.fresh = false; renderEnd(); decorate();
  });
  if (last.fresh && w0 !== w) { const f = el.querySelector('.trn-bar>span'); requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = w + '%'; })); }
  last.fresh = false;
}
const seen = new WeakSet();
G.on('end', (S, res) => {
  if (!res || !G.GODS[res.god] || (S && seen.has(S))) return; if (S) seen.add(S);
  const g = res.god, bank = Math.max(0, Math.floor(+res.bank || 0)), robs = Math.max(0, Math.floor(+res.robs || 0));
  const gain = bank + XP_ROB * robs + XP_FINISH, fromXp = xpOf(g);
  rec(g).xp = fromXp + gain; save();
  last = { god: g, gain, bank, robs, fromXp, fromLvl: lvlOf(fromXp), took: null, fresh: true };
  renderEnd(); decorate();
});

G.train = {
  get, offer, factor, PERKS, LEVELS: LV.slice(), XP: { rob: XP_ROB, finish: XP_FINISH }, MAX_TAKES: MAXT, CAP,
  reset() { T = { v: 1, g: {} }; try { localStorage.removeItem(KEY); } catch (e) {} last = null; const el = document.getElementById('trainEnd'); if (el) el.remove(); decorate(); },
};
