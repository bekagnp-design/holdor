// HOLDOR RPG — town life (C1): the entry banner once per visit (Winterfell, a town, a village), the service signs over the NPCs
// (projected at the right NPC, hidden behind the camera / off screen), a real tap on the smith's sign within 120 units opens the smith,
// a tap from afar toasts the way; nothing overlaps the HUD's top-left block, the tutorial card or the quest tracker; 390×844 and 360×640.
// run: python3 src/build_rpg.py /tmp/c1.html && RPG_HTML=/tmp/c1.html RPG_NOBUILD=1 CHROMIUM_PATH=... node tests/rpg/t_townlife.js
'use strict';
const L = require('./lib');
const hit = (a, b) => !!(a && b && a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1);
(async () => {
  L.build();
  const { page, errors, close } = await L.launch({ w: 390, h: 844 });
  try {
    await L.boot(page, { save: L.fakeSave({ house: 'stark', lvl: 4, gold: 900, flags: { tut: 3 } }), settle: 600, timeout: 90000, wait: 30000 });
    await page.waitForFunction(() => window.R && R.townlife && R.player && R.hud, null, { timeout: 45000 });
    const W = await L.ev(page, () => { const w = R.world.poi('winterfell'); return w ? { x: w.x, y: w.y, r: w.r } : null; });
    L.ok('Winterfell exists', !!W, JSON.stringify(W));
    // day, calm, stand in Winterfell's yard
    await L.ev(page, W => { try { R.ambience && R.ambience.setHour && R.ambience.setHour(11); } catch (e) {} R.player.x = W.x; R.player.y = W.y + 40; R.townlife.cur = null; }, W);
    await L.steps(page, 60); await page.waitForTimeout(400);
    const b1 = await L.ev(page, () => { const b = document.getElementById('tl-ban'), r = b && b.getBoundingClientRect(); const R2 = el => el && el.getBoundingClientRect();
      return { on: !!(b && b.classList.contains('on')), nm: b && b.querySelector('.tl-nm').textContent, sub: b && b.querySelector('.tl-sub').textContent, list: b && b.querySelector('.tl-list').textContent,
        hc: b && b.style.getPropertyValue('--hc'), cur: R.townlife.cur, shown: R.townlife.shownN || 0, ban: r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
        tl: R2(document.getElementById('hud-tl')), qt: R2(document.getElementById('qtrack')), tut: (() => { const t = document.querySelector('#tut:not(.off) .tut-wrap'); return t && getComputedStyle(t).display !== 'none' ? R2(t) : null; })(),
        tr: R2(document.getElementById('hud-tr')), btnH: b && b.querySelector('.tl-svc').getBoundingClientRect().height,
        toasts: [...document.querySelectorAll('#ui>.toast')].map(R2) }; });
    L.ok('entering Winterfell shows the banner: name, seat of House Stark, Smith · Inn · Market', b1.on && b1.nm === 'Winterfell' && /Stark/.test(b1.sub) && /Smith/.test(b1.list) && /Inn/.test(b1.list) && /Market/.test(b1.list), JSON.stringify([b1.nm, b1.sub, b1.list, b1.cur]));
    L.ok('the banner wears the house colour', /#a9bdd0/i.test(b1.hc), b1.hc);
    L.ok('the SERVICES HERE button is at least 44 px tall', b1.btnH >= 44, b1.btnH);
    L.ok('the banner covers neither the top-left block, the quest tracker, the top-right column, the tutorial card nor a toast',
      !hit(b1.ban, b1.tl) && !hit(b1.ban, b1.qt) && !hit(b1.ban, b1.tr) && !hit(b1.ban, b1.tut) && !b1.toasts.some(t => hit(b1.ban, t)), JSON.stringify({ ban: b1.ban, tl: b1.tl, tut: b1.tut }));
    await L.shot(page, 'townlife_winterfell_banner');
    // once per visit: staying inside shows nothing more
    await L.steps(page, 240); const again = await L.ev(page, () => R.townlife.shownN);
    L.ok('staying inside does not show it again', again === b1.shown, again + ' vs ' + b1.shown);
    // ---- the signs: projected over the smith, hidden behind the camera (the tutorial card done, so the signs have the whole field)
    await L.ev(page, () => { try { R.tut && R.tut.skip && R.tut.skip(); } catch (e) {} });
    await L.steps(page, 360); await page.waitForTimeout(300); await L.steps(page, 4);
    const sg = await L.ev(page, () => R.townlife.signs().map(s => { const e = s.npc, q = R.w2s(e.x, e.y, 80), r = s.el.getBoundingClientRect();
      return { svc: s.svc, on: s.on, d: Math.round(s.d), q: { x: Math.round(q.x), y: Math.round(q.y), behind: q.behind }, cx: Math.round((r.left + r.right) / 2), bottom: Math.round(r.bottom), h: Math.round(r.height), op: s.el.style.opacity }; }));
    const smith = sg.find(s => s.svc === 'smith');
    L.ok('signs for the smith (who also sells at Winterfell) and the inn', ['smith', 'inn'].every(k => sg.some(s => s.svc === k)), sg.map(s => s.svc + (s.on ? '+' : '-')).join(' '));
    L.ok('a visible sign sits right over its NPC (same x within 4 px, just above the head)', sg.filter(s => s.on).length > 0 && sg.filter(s => s.on).every(s => Math.abs(s.cx - s.q.x) <= 4 && s.bottom <= s.q.y + 2 && s.bottom > s.q.y - 90), JSON.stringify(sg));
    L.ok('signs are ≥ 44 px tall', sg.filter(s => s.on).every(s => s.h >= 44), sg.map(s => s.h).join(','));
    await page.waitForTimeout(800); await L.steps(page, 2);
    await L.shot(page, 'townlife_winterfell_signs');
    // two stand-in smiths 150 units ahead of the hero and 600 behind him (the camera stands ~340 behind): one sign shows, the other hides
    const beh = await L.ev(page, async () => { const P = R.player; R.cam.yaw = 0; for (let i = 0; i < 30; i++) R.step();
      const mk = (id, dy) => R.spawn({ kind: 'npc', team: 2, x: P.x, y: P.y + dy, r: 14, name: 'Test smith', dialog: id, poi: 'winterfell', type: 'npc:smith', sprite: 'npc:smith', rkind: 'smith', hp: 1, hpMax: 1, invuln: true, noBar: true, mark: '' });
      const a = mk('t_front_smith', -150), b = mk('t_back_smith', 600); for (let i = 0; i < 3; i++) R.step(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); R.step();
      const sa = R.townlife.signs().find(s => s.npc === a), sb = R.townlife.signs().find(s => s.npc === b);
      const o = { front: sa && { on: sa.on, q: R.w2s(a.x, a.y, 80), d: Math.round(sa.d) }, back: sb && { on: sb.on, q: R.w2s(b.x, b.y, 80), d: Math.round(sb.d), vis: getComputedStyle(sb.el).display } };
      a.dead = b.dead = true; R.remove && (R.remove(a), R.remove(b)); for (let i = 0; i < 3; i++) R.step(); o.gone = !R.townlife.signs().some(s => s.npc === a || s.npc === b); return o; });
    const offOk = !!(beh.back && (beh.back.q.behind || beh.back.q.x < 0 || beh.back.q.x > 390 || beh.back.q.y < 0 || beh.back.q.y > 844));
    L.ok('a smith in front of the camera gets a sign; one behind the camera gets none; signs go with their NPC', !!(beh.front && beh.front.on && beh.back && !beh.back.on && beh.back.vis === 'none' && offOk && beh.gone), JSON.stringify(beh));
    // ---- a tap from afar toasts the way; a real tap within 120 units opens the smith
    await L.ev(page, () => { const s = R.townlife.signs().find(x => x.svc === 'smith'); const e = s.npc; R.player.x = e.x; R.player.y = e.y + 190; R.cam.yaw = 0; for (let i = 0; i < 120; i++) R.step(); });
    await page.waitForTimeout(300); await L.steps(page, 4);
    let far = await L.ev(page, () => { const s = R.townlife.signs().find(x => x.svc === 'smith'); return { on: s.on, d: Math.round(s.d), near: s.el.classList.contains('near') }; });
    if (far.on) { await L.tap(page, '.tl-sign.s-smith.on', { wait: 300 });
      const ft = await L.ev(page, () => ({ cur: R.ui.cur, t: [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|') }));
      L.ok('a tap from ' + far.d + ' units toasts the way and opens nothing', !ft.cur && /smith is that way .* walk closer/.test(ft.t), JSON.stringify(ft));
      L.ok('within 200 units the sign carries its label', far.near, JSON.stringify(far)); }
    else L.skip('tap from afar', 'sign not on screen: ' + JSON.stringify(far));
    await L.ev(page, () => { const s = R.townlife.signs().find(x => x.svc === 'smith'); const e = s.npc; R.player.x = e.x; R.player.y = e.y + 70; for (let i = 0; i < 90; i++) R.step(); });
    await page.waitForTimeout(300); await L.steps(page, 4);
    const nearS = await L.ev(page, () => { const s = R.townlife.signs().find(x => x.svc === 'smith'); return { on: s.on, d: Math.round(s.d), tap: s.el.classList.contains('tap') }; });
    await L.shot(page, 'townlife_smith_close');
    const tapped = nearS.on && await L.tap(page, '.tl-sign.s-smith.on', { wait: 500 });
    const sm = await L.ev(page, () => ({ cur: R.ui.cur, title: (document.querySelector('#screen') || {}).textContent || '' }));
    L.ok('a real tap on the smith\'s sign within 120 units opens the smith screen', tapped && sm.cur === 'smith', JSON.stringify({ nearS, cur: sm.cur }));
    L.ok('signs and banner hide while a screen is open', await L.ev(page, () => getComputedStyle(document.getElementById('tl-layer')).visibility === 'hidden'));
    await L.shot(page, 'townlife_smith_screen');
    await L.ev(page, () => { while (R.ui.cur) R.ui.close(); });
    // ---- leave and come back: a new visit, a new banner
    const re = await L.ev(page, W => { const n0 = R.townlife.shownN; R.player.x = W.x + 900; R.player.y = W.y + 40; for (let i = 0; i < 40; i++) R.step(); const left = R.townlife.cur;
      R.player.x = W.x; R.player.y = W.y + 40; for (let i = 0; i < 40; i++) R.step(); return { n0, n1: R.townlife.shownN, left, cur: R.townlife.cur }; }, W);
    L.ok('leaving and coming back is a new visit: one more banner', re.left === null && re.n1 === re.n0 + 1 && re.cur === 'winterfell', JSON.stringify(re));
    // ---- a town of the North and a village
    const tw = await L.ev(page, () => { const t = R.world.pois().find(p => p.type === 'town' && p.region === 'north') || R.world.pois().find(p => p.type === 'town'); if (!t) return null;
      R.player.x = t.x; R.player.y = t.y + 30; for (let i = 0; i < 40; i++) R.step(); const b = document.getElementById('tl-ban');
      return { id: t.id, name: t.name, cur: R.townlife.cur, on: b.classList.contains('on'), why: R.townlife.hideWhy, ui: R.ui.cur, hud: R.hud.el.className, nm: b.querySelector('.tl-nm').textContent, sub: b.querySelector('.tl-sub').textContent }; });
    L.ok('entering a town shows its banner', tw && tw.on && tw.cur === tw.id && tw.nm === tw.name && /Town/.test(tw.sub), JSON.stringify(tw));
    await L.shot(page, 'townlife_town_banner');
    const vg = await L.ev(page, W => { const v = { id: 't_village', name: 'Mole\'s Hollow', type: 'village', x: W.x + 1600, y: W.y + 300, region: 'north', r: 110 }; R.data.world.pois.push(v);
      R.player.x = v.x; R.player.y = v.y + 20; for (let i = 0; i < 40; i++) R.step(); const b = document.getElementById('tl-ban');
      const o = { cur: R.townlife.cur, on: b.classList.contains('on'), nm: b.querySelector('.tl-nm').textContent, sub: b.querySelector('.tl-sub').textContent, svcShown: getComputedStyle(b.querySelector('.tl-svc')).display !== 'none' };
      R.data.world.pois.splice(R.data.world.pois.indexOf(v), 1); return o; }, W);
    L.ok('entering a village shows its banner (no shop → no SERVICES button)', vg.on && vg.cur === 't_village' && vg.nm === 'Mole\'s Hollow' && /Village/.test(vg.sub) && !vg.svcShown, JSON.stringify(vg));
    // ---- the SERVICES HERE button opens the town screen
    await L.ev(page, W => { R.player.x = W.x + 900; R.player.y = W.y; for (let i = 0; i < 40; i++) R.step(); R.player.x = W.x; R.player.y = W.y + 40; for (let i = 0; i < 40; i++) R.step(); }, W);
    await page.waitForTimeout(120);
    await L.tap(page, '#tl-ban.on .tl-svc', { wait: 400 });
    const ts = await L.ev(page, () => R.ui.cur), tsw = await L.ev(page, () => JSON.stringify({ why: R.townlife.hideWhy, cur: R.townlife.cur, n: R.townlife.shownN }));
    L.ok('a tap on SERVICES HERE opens the town screen (43_towns)', ts === 'town' || ts === 'shop', ts + ' ' + tsw);
    await L.ev(page, () => { while (R.ui.cur) R.ui.close(); });
    // ---- 360×640: the banner still clears the HUD block and the tutorial card
    await page.setViewportSize({ width: 360, height: 640 }); await page.waitForTimeout(300);
    const small = await L.ev(page, async W => { R.player.x = W.x + 900; R.player.y = W.y; for (let i = 0; i < 40; i++) R.step(); R.player.x = W.x; R.player.y = W.y + 40; for (let i = 0; i < 40; i++) R.step();
      await new Promise(r => setTimeout(r, 450)); R.step(); const R2 = el => el && el.getBoundingClientRect(); const b = document.getElementById('tl-ban');
      const t = document.querySelector('#tut:not(.off) .tut-wrap');
      return { on: b.classList.contains('on'), why: R.townlife.hideWhy, cur: R.townlife.cur, ui: R.ui.cur, ban: R2(b), tl: R2(document.getElementById('hud-tl')), qt: R2(document.getElementById('qtrack')), tr: R2(document.getElementById('hud-tr')), tut: t && getComputedStyle(t).display !== 'none' ? R2(t) : null, vw: innerWidth }; }, W);
    const sgEdge = await L.ev(page, () => R.townlife.signs().filter(s => s.on).map(s => { const r = s.el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
    L.ok('360×640: every shown sign is wholly on screen', sgEdge.every(([a, b]) => a >= 0 && b <= 360), JSON.stringify(sgEdge));
    L.ok('360×640: the banner shows inside the screen and clears the HUD block, tracker and tutorial card', small.on && small.ban.left >= 0 && small.ban.right <= small.vw && !hit(small.ban, small.tl) && !hit(small.ban, small.qt) && !hit(small.ban, small.tr) && !hit(small.ban, small.tut), JSON.stringify(small));
    await L.shot(page, 'townlife_360_banner');
    const ge = await L.ev(page, () => ({ tl: R.townlife.err || null, errs: (R.errors || []).filter(e => /townlife/.test(String(e && (e.msg || e.message || e)))).length }));
    L.ok('no townlife errors', !ge.tl && !ge.errs && !errors.some(e => /townlife|43b/.test(e)), JSON.stringify(ge) + ' ' + errors.slice(0, 3).join(' | '));
  } catch (e) { L.ok('suite ran', false, e && e.stack); }
  await close(); L.report();
})();
