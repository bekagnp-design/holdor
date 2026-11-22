// P1: progression — talents (a point every 5 levels, 3 branches × 4 tiers a class, mods summed), extra XP sources (POI, region,
// first kill of a mob type: once each per hero), milestones (5/10/20/…; acc.best.lvl keeps the max), the talents screen (a real tap
// spends a point), permadeath (a new hero has no talents), save/load keeps them.  Logic in Node/vm first, then one browser run.
'use strict';
const L = require('./lib');
const fs = require('fs'), path = require('path'), vm = require('vm');
const SHOT = async (page, name) => { const p = path.join(L.SHOTS, name + '.png'); fs.mkdirSync(L.SHOTS, { recursive: true }); try { await page.screenshot({ path: p, timeout: 60000 }); console.log('  shot ' + p); } catch (e) { console.log('  shot failed ' + name + ': ' + e.message.split('\n')[0]); } return p; };
const SRC = fs.readFileSync(path.join(L.ROOT, 'src', 'rpg', 'js', '25_progression.js'), 'utf8');

/* ---- Node/vm: the module on a stub R ---- */
function stub(lvl, cls) {
  const H = {}; const ev = [];
  const R = { t: 10, data: { balance: { mob: { xp: L => 10 + L } }, skills: {}, achievements: [{ id: 'lvl_10', cond: { ev: 'levelup', n: 10 }, reward: { title: 'Hedge Knight' } }] }, screens: {},
    bus: { on: (e, f) => (H[e] = H[e] || []).push(f), emit: (e, ...a) => { ev.push([e, ...a]); (H[e] || []).forEach(f => f(...a)); } },
    state: { acc: { house: 'stark', best: { lvl: 0 }, world: {} }, p: { cls: cls || 'knight', lvl: lvl || 1, xp: 0 } }, ui: { cur: null, toast() {} }, save() {} };
  R.player = { kind: 'player', team: 0, dead: false, got: [], gainXp(n) { this.got.push(n); return 0; }, recalc() { this.rc = (this.rc || 0) + 1; } };
  const ctx = { window: { R }, R, console, setTimeout: () => 0, clearTimeout() {} }; vm.createContext(ctx); vm.runInContext(SRC, ctx);
  return { R, ev };
}
{
  const { R } = stub(1);
  const G = R.prog;
  L.ok('vm: R.prog + R.screens.talents exist', !!(G && R.screens.talents && G.mods));
  L.ok('vm: points at 5/10…60 (0,0,1,1,2,12,12)', [1, 4, 5, 9, 10, 60, 99].map(G.earned).join() === '0,0,1,1,2,12,12', [1, 4, 5, 9, 10, 60, 99].map(G.earned).join());
  const per = Object.values(G.TREES).map(t => t.length + 'x' + t.map(b => b.nodes.length).join(''));
  L.ok('vm: 3 classes × 3 branches × 4 tiers', per.join() === '3x444,3x444,3x444', per.join());
  const names = Object.values(G.NODES).map(n => n.name); L.ok('vm: 36 nodes, names unique', names.length === 36 && new Set(names).size === 36, names.length);
  L.ok('vm: level 1 → nothing to learn', !G.can('k_iron1') && G.unspent() === 0 && G.hint() === '', G.why('k_iron1'));
  R.state.p.lvl = 20;   // 4 points
  L.ok('vm: level 20 → 4 points, hint "!"', G.unspent() === 4 && G.hint() === '!');
  L.ok('vm: tier 2 locked before 2 points in the branch', !G.can('k_iron2') && /Needs 2/.test(G.why('k_iron2')), G.why('k_iron2'));
  L.ok('vm: learn k_iron1 ×2 then tier 2 opens', G.learn('k_iron1') && G.learn('k_iron1') && !G.learn('k_iron1') && G.can('k_iron2'), JSON.stringify(R.state.p.talents));
  L.ok('vm: learn calls the hero recalc', R.player.rc === 2, R.player.rc);
  G.learn('k_iron2'); G.learn('k_edge1');
  const m = G.mods();
  L.ok('vm: mods sum (def 8, hp 5, crit 3)', m.defPct === 8 && m.hpPct === 5 && m.critAdd === 3 && m.atkPct === 0 && m.cdrPct === 0, JSON.stringify(m));
  L.ok('vm: no points left at 4 spent', G.unspent() === 0 && /Next point at level 25/.test(G.why('k_edge1')), G.why('k_edge1'));
  R.state.p.lvl = 60; ['k_iron2', 'k_iron3', 'k_iron3', 'k_iron4', 'k_edge1', 'k_edge2', 'k_edge2', 'k_edge3'].forEach(G.learn);
  const m2 = G.mods();
  L.ok('vm: skillPct sums per skill (k_shield 30, k_cleave 12)', m2.skillPct.k_shield === 30 && m2.skillPct.k_oath === 30 && m2.skillPct.k_cleave === 12, JSON.stringify(m2.skillPct));
  L.ok('vm: 12 points cap at 60', G.spent() === 12 && G.unspent() === 0, G.spent());
  R.state.p.talents.r_eye1 = 2; R.state.p.talents.k_iron1 = 9;   // another class's node and an over-rank are ignored
  L.ok('vm: foreign / over-rank nodes ignored', G.rank('r_eye1') === 0 && G.rank('k_iron1') === 2 && G.mods().critAdd === m2.critAdd);
  const j = JSON.parse(JSON.stringify(R.state)); L.ok('vm: talents survive JSON', j.p.talents.k_iron4 === 1);
}
{
  const { R, ev } = stub(3);
  R.t = 50; const g = R.prog.ledger(); g.reg.home = 1;   // a hero already placed somewhere
  R.bus.emit('poi', 'winterfell', {}); R.bus.emit('poi', 'winterfell', {});
  R.bus.emit('enter', 'north', {}); R.bus.emit('enter', 'north', {});
  const mob = { kind: 'mob', type: 'wolf' }; R.bus.emit('kill', mob, R.player); R.bus.emit('kill', { kind: 'mob', type: 'wolf' }, R.player); R.bus.emit('kill', { kind: 'mob', type: 'axe' }, R.player);
  const u = 13;   // balance.mob.xp(3)
  L.ok('vm: XP sources once each (poi 4u, region 15u, kills 3u ×2 types)', R.player.got.join() === [4 * u, 15 * u, 3 * u, 3 * u].join(), R.player.got.join());
  L.ok('vm: an xpsrc event per award', ev.filter(e => e[0] === 'xpsrc').length === 4);
  R.bus.emit('hero', 'arya'); R.state.p = { cls: 'ranger', lvl: 1, xp: 0 }; R.player.got = [];
  R.bus.emit('enter', 'north', {}); R.bus.emit('poi', 'winterfell', {});
  L.ok('vm: a new hero is born quietly (first 1.5 s: recorded, no xp)', R.player.got.length === 0 && R.state.p.prog.poi.winterfell === 1);
  R.t += 2; R.bus.emit('poi', 'winterfell', {}); R.bus.emit('poi', 'moat', {});
  L.ok('vm: after the grace a new POI pays, the known one does not', R.player.got.length === 1, R.player.got.join());
  L.ok('vm: new hero has no talents', R.prog.spent() === 0 && !R.state.p.talents || Object.keys(R.state.p.talents).length === 0);
}
{
  const { R, ev } = stub(9);
  R.state.p.lvl = 10; R.bus.emit('levelup', 10); R.state.p.lvl = 11; R.bus.emit('levelup', 11); R.state.p.lvl = 10; R.bus.emit('levelup', 10);
  L.ok('vm: milestone 10 once, best.lvl max kept', ev.filter(e => e[0] === 'milestone').length === 1 && R.state.acc.best.lvl === 11, R.state.acc.best.lvl);
  L.ok('vm: a point event at 10', ev.some(e => e[0] === 'talent' && e[1] === 'point'));
}

/* ---- the browser: the real build ---- */
(async () => {
  const html = L.build();
  const { page, errors, close } = await L.launch(); page.setDefaultTimeout(60000);
  try {
    const b = await L.boot(page, { save: L.fakeSave({ house: 'stark', hero: 'jon', lvl: 14 }), timeout: 90000, wait: 60000 });
    L.ok('boot', b.booted && b.screens.includes('talents'), JSON.stringify({ cur: b.cur, running: b.running }));
    await page.evaluate(() => { if (R.ui.cur) R.ui.close(); });
    const s0 = await page.evaluate(() => ({ un: R.prog.unspent(), cls: R.state.p.cls, hint: R.prog.hint() }));
    L.ok('browser: level 14 knight has 2 points', s0.un === 2 && s0.cls === 'knight', JSON.stringify(s0));
    await page.evaluate(() => R.prog.open());
    await page.waitForTimeout(250);
    const v = await page.evaluate(() => { const r = document.querySelector('#talents'); const q = s => r && r.querySelector(s); const pri = q('.pg-pri'); const bb = pri && pri.getBoundingClientRect();
      const small = [...r.querySelectorAll('button')].filter(x => { const k = x.getBoundingClientRect(); return k.height < 44 || k.width < 44; }).length;
      return { cur: R.ui.cur, nodes: r ? r.querySelectorAll('[data-node]').length : 0, pri: pri && pri.textContent, priH: bb && bb.height, small, sw: document.documentElement.scrollWidth }; });
    L.ok('browser: talents screen opens with 12 nodes', v.cur === 'talents' && v.nodes === 12, JSON.stringify(v));
    L.ok('browser: every button ≥ 44 px, no sideways scroll (844×390 landscape)', v.small === 0 && v.sw <= 844, JSON.stringify(v));
    const tp1 = await L.tap(page, '#talents [data-node="k_edge1"]', { timeout: 60000 }); if (!tp1) console.log('  tap 1 returned false');
    await page.waitForFunction(() => /RENDING/.test(document.querySelector('#talents .pg-pri').textContent), null, { timeout: 15000, polling: 100 }).catch(() => {});
    const pri1 = await page.evaluate(() => document.querySelector('#talents .pg-pri').textContent);
    L.ok('browser: a tap selects Rending Edge', /RENDING EDGE/.test(pri1), pri1);
    const atk0 = await page.evaluate(() => R.player && R.player.crit);
    const tp2 = await L.tap(page, '#talents .pg-pri', { timeout: 60000 }); if (!tp2) console.log('  tap 2 returned false');
    await page.waitForFunction(() => R.state.p.talents && R.state.p.talents.k_edge1 === 1, null, { timeout: 15000, polling: 100 }).catch(() => {});
    const s1 = await page.evaluate(() => ({ t: Object.assign({}, R.state.p.talents), un: R.prog.unspent(), crit: R.prog.mods().critAdd, rk: document.querySelectorAll('#talents [data-node="k_edge1"] .pg-rk i.on').length }));
    L.ok('browser: a real tap spends a point', s1.t.k_edge1 === 1 && s1.un === 1 && s1.crit === 3 && s1.rk === 1, JSON.stringify(s1));
    await SHOT(page, 'p1_talents');
    // the small landscape phone: 640×360 (no turn: the window is already wide)
    await page.setViewportSize({ width: 640, height: 360 }); await page.waitForTimeout(600);
    const v2 = await page.evaluate(() => { const r = document.querySelector('#talents'); const pri = r.querySelector('.pg-pri').getBoundingClientRect(); const scr = document.getElementById('screen');
      const small = [...r.querySelectorAll('button')].filter(x => { const k = x.getBoundingClientRect(); return k.height < 44 || k.width < 44; }).length;
      return { sw: document.documentElement.scrollWidth, ssw: scr.scrollWidth - scr.clientWidth, priB: Math.round(pri.bottom), priH: Math.round(pri.height), sh: scr.scrollHeight, small, rot: R.rot, vw: R.vw, vh: R.vh }; });
    L.ok('browser: 640×360 landscape fits (no sideways scroll, buttons still ≥ 44 px)', v2.sw <= 640 && v2.ssw <= 1 && v2.small === 0 && v2.rot === false, JSON.stringify(v2));
    await SHOT(page, 'p1_talents_640');
    const reach = await page.evaluate(() => { const scr = document.getElementById('screen'), pri = document.querySelector('#talents .pg-pri'); pri.scrollIntoView({ block: 'nearest' }); const r = pri.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === pri || pri.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
    L.ok('browser: 640×360 — the primary LEARN button scrolls fully into view and nothing covers it', reach.top >= 0 && reach.bottom <= reach.vh && reach.hit, JSON.stringify(reach));
    await page.setViewportSize({ width: 844, height: 390 });
    // save → reload keeps the talents
    const pre = await page.evaluate(() => { R.ui.close(); R.save(true); const j = JSON.parse(localStorage.getItem('holdor_rpg') || 'null'); return { saved: j && j.p && j.p.talents, lvl: j && j.p && j.p.lvl }; });
    L.ok('browser: the save written before the reload carries the talents', pre.saved && pre.saved.k_edge1 === 1, JSON.stringify(pre));
    await page.reload({ waitUntil: 'commit', timeout: 90000 });
    await page.waitForFunction(() => window.R && R.prog && R.state && R.state.p && R.running, null, { timeout: 90000, polling: 250 });
    await page.waitForTimeout(400);
    const s2 = await page.evaluate(() => { let ls = null; try { ls = JSON.parse(localStorage.getItem('holdor_rpg')).p.talents; } catch (e) {} return { t: R.state.p.talents, un: R.prog.unspent(), ls, boot: R.boot, lvl: R.state.p.lvl, net: !!(R.net && R.net.on) }; });
    L.ok('browser: save/load keeps the talents', s2.t && s2.t.k_edge1 === 1 && s2.un === 1, JSON.stringify(s2));
    // XP from a first kill of a type (a real 'kill' through the bus) — once
    const k = await page.evaluate(() => { if (R.ui.cur) R.ui.close(); for (let i = 0; i < 120; i++) R.step(); const x0 = R.state.p.xp + 0, l0 = R.state.p.lvl;
      const m = { kind: 'mob', type: 'zz_test_mob', lvl: 1, xp: 1, x: R.player.x, y: R.player.y }; R.bus.emit('kill', m, R.player);
      const x1 = R.state.p.xp, l1 = R.state.p.lvl; R.bus.emit('kill', { kind: 'mob', type: 'zz_test_mob', lvl: 1, xp: 1 }, R.player);
      return { d1: x1 - x0 + (l1 - l0) * 1e6, d2: R.state.p.xp - x1, unit: R.prog.xpUnit(), led: !!R.state.p.prog.kin.zz_test_mob }; });
    L.ok('browser: first kill of a type pays once', k.led && k.d1 > 1 && k.d2 === 1, JSON.stringify(k));
    // milestone card: level 15 → 20 through the real gainXp
    const mc = await page.evaluate(async () => { if (R.ui.cur) R.ui.close(); const p = R.state.p; let need = 0; for (let l = p.lvl; l < 20; l++) need += R.plr.xpNext(l); R.player.gainXp(need - p.xp + 1);
      if (R.ui.cur) R.ui.close(); await new Promise(r => setTimeout(r, 500)); const c = document.querySelector('.pg-mile');
      return { lvl: p.lvl, card: c && c.textContent, best: R.acc().best.lvl, un: R.prog.unspent(), sp: R.prog.spent() }; });
    L.ok('browser: level 20 → milestone card + best.lvl', mc.lvl === 20 && /20/.test(mc.card || '') && mc.best >= 20 && mc.un === 4 - mc.sp, JSON.stringify(mc));
    await SHOT(page, 'p1_milestone');
    // permadeath: a new hero has no talents and a fresh ledger
    const nh = await page.evaluate(() => { const ids = Object.keys(R.acc().champs); R.newHero(ids[0]); return { t: R.state.p.talents || null, sp: R.prog.spent(), un: R.prog.unspent(), lvl: R.state.p.lvl, best: R.acc().best.lvl }; });
    L.ok('browser: permadeath — a new hero starts with no talents', nh.sp === 0 && nh.un === 0 && nh.lvl === 1 && (!nh.t || !Object.keys(nh.t).length) && nh.best >= 20, JSON.stringify(nh));
    const pe = errors.filter(e => /prog|talent|25_/.test(e));
    L.ok('browser: no page errors from this module', pe.length === 0, pe.join(' | ').slice(0, 300));
  } catch (e) { L.ok('browser run', false, e.message); }
  await close(); L.report();
})();
