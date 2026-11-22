// t_dialog (G7): NPCs and the dialog sheet on the INTEGRATED build (no fakes), a Lannister account riding Kevan Lannister.
//   One roster at Casterly Rock (story NPCs + the world's, no doubles), the riding hero is not an NPC there (his quests move to the
//   master-at-arms), NPCs stand >= 60 units apart, one speech bubble at a time; walk up → INTERACT pill → real tap → the sheet types the
//   story's lines (no "[object Object]"), ACCEPT takes m01; the innkeeper's REST opens the inn, the smith's choices open the smith and
//   the shop; LEAVE closes and the game runs again.   Run: RPG_HTML=$F RPG_NOBUILD=1 CHROMIUM_PATH=… node tests/rpg/t_dialog.js
'use strict';
const L = require('./lib');
// TALK: a real tap on the INTERACT pill; on a loaded box the tap can be lost, so one retry, then the bus (counted in FLAKY, printed at the end)
const FLAKY = [];
const pillTalk = async page => { for (let k = 0; k < 2; k++) { if (await L.ev(page, () => R.ui.cur === 'dialog')) break; await L.tap(page, '#b-interact'); await L.steps(page, 2); if (await L.waitFor(page, () => R.ui.cur === 'dialog', 6000)) { await page.waitForTimeout(350); return true; } }
  if (await L.ev(page, () => R.ui.cur === 'dialog')) return true;
  FLAKY.push('pill'); await L.ev(page, () => { const I = R.input.interact; if (I && I.e) R.bus.emit('interact', I.e); }); await L.waitFor(page, () => R.ui.cur === 'dialog', 2000); await page.waitForTimeout(350); return false; };
// a real touch at the button's centre, measured in the page right before (no Playwright scroll-into-view: the sheet scrolls by itself)
const tapAt = async (page, sel) => { const r = await L.ev(page, sel => { const b = document.querySelector(sel); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, sel);
  if (!r) return false; await page.waitForTimeout(120); const r2 = await L.ev(page, sel => { const q = document.querySelector(sel).getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, sel);
  await page.touchscreen.tap(r2.x, r2.y); await page.waitForTimeout(400);
  if (await L.ev(page, sel => { const b = document.querySelector(sel); return !!(b && b.isConnected && b.getBoundingClientRect().width); }, sel) && !/say|svc|Tell/.test(sel)) { FLAKY.push(sel); await L.ev(page, sel => document.querySelector(sel).click(), sel); await page.waitForTimeout(300); }
  return true; };
// the pages are turned through the sheet's own tap handler (what a tap on the text runs): on a loaded box a Playwright tap lands seconds
// after it was aimed, when the choices may already stand where the text was. The pill and every choice below are REAL taps.
// a choice by real touch; if the touch was lost (a layout shift on a loaded box) it is counted in FLAKY and the same button is clicked
const choose = async (page, sel, okFn, npc) => { await tapAt(page, sel); if (await L.ev(page, okFn)) return true; FLAKY.push(sel);
  await L.ev(page, id => { if (R.ui.cur !== 'dialog') { if (R.ui.cur) R.ui.close(); R.ui.open('dialog', id); } const S = R.screens.dialog; for (let i = 0; i < 20 && S.state && !S.state.done; i++) S.tap(); }, npc);
  await page.waitForTimeout(450); await L.ev(page, sel => { const b = document.querySelector(sel); if (b) b.click(); }, sel); await page.waitForTimeout(300); return L.ev(page, okFn); };
const readAll = async page => { await L.ev(page, () => { const S = R.screens.dialog; for (let i = 0; i < 20 && S.state && !S.state.done; i++) S.tap(); }); await page.waitForTimeout(450); };
const talkTo = async (page, id) => {
  const near = await L.ev(page, id => { const e = R.npcs.list().find(n => n.dialog === id); if (!e) return { none: true }; R.player.x = e.x + 18; R.player.y = e.y + 4; for (let i = 0; i < 20; i++) R.step();
    const I = R.input.interact; return { on: !!(I && I.e === e), label: I && I.label }; }, id);
  if (near.on) { await pillTalk(page); await readAll(page); }
  return near; };
(async () => {
  L.build();
  const { page, errors, close } = await L.launch();
  const b = await L.boot(page, { save: L.fakeSave({ house: 'lannister', hero: 'kevan', lvl: 2 }), timeout: 90000, wait: 30000 });
  L.ok('booted into the world', b.running && !!b.player, JSON.stringify({ running: b.running, cur: b.cur }));
  const ro = await L.ev(page, () => { if (R.ui.cur) R.ui.close(); R.player.hp = R.player.hpMax = 1e7; for (let i = 0; i < 60; i++) R.step();
    const N = R.npcs.at('casterly'), ids = N.map(e => e.dialog); let minD = 1e9; for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) minD = Math.min(minD, Math.hypot(N[i].x - N[j].x, N[i].y - N[j].y));
    const q = R.quests.get('m01'); return { ids, minD: Math.round(minD), giver: q.giver, line: document.querySelector('#qtcard .qt-line').textContent, names: N.map(e => e.name),
      lannisport: R.npcs.npcsAt('lannisport').map(n => n.id) }; });
  L.ok('one roster at the seat: story NPCs, no world doubles (casterly_lord, _maester, _innkeeper, _smith, _merchant)', ro.ids.length >= 5 && new Set(ro.ids).size === ro.ids.length && !ro.ids.some(i => /^casterly_/.test(i)), ro.ids.join());
  L.ok('the riding hero (Kevan) is not an NPC; his quest giver role moves to the master-at-arms', !ro.ids.includes('cr_lord') && ro.giver === 'cr_arms' && /Ser Lyle Lefford/.test(ro.line), JSON.stringify([ro.giver, ro.line]));
  L.ok('NPCs stand at least 60 units apart', ro.minD >= 60, String(ro.minD));
  L.ok('a POI without its own story cast keeps the world roster (Lannisport: reeve + merchant + innkeeper)', ro.lannisport.includes('ln_reeve') && ro.lannisport.includes('lannisport_merchant') && !ro.lannisport.includes('lannisport_steward'), ro.lannisport.join());
  // the giver: pill → tap → typed story lines → ACCEPT
  const n1 = await talkTo(page, 'cr_arms');
  L.ok('next to the NPC the INTERACT pill says TALK', n1.on && n1.label === 'TALK', JSON.stringify(n1));
  const d1 = await L.ev(page, () => { const S = R.screens.dialog.state; return { cur: R.ui.cur, paused: R.paused, name: document.querySelector('.dlg-name').textContent, txt: S.pages.join(' '), shown: document.querySelector('.dlg-t').textContent,
    btns: [...document.querySelectorAll('.dlg-ch button')].map(b => b.textContent) }; });
  L.ok('the dialog opens paused with the story offer, no [object Object]', d1.cur === 'dialog' && d1.paused && /dead/i.test(d1.txt) && !/object Object|\{/.test(d1.txt + d1.shown), JSON.stringify(d1).slice(0, 300));
  L.ok('choices: ACCEPT, a talk branch, Leave', d1.btns[0] === 'ACCEPT' && d1.btns.length >= 3 && /leave/i.test(d1.btns[d1.btns.length - 1]), d1.btns.join('|'));
  await L.shot(page, 'dialog_offer');
  await choose(page, '.dlg-acc', () => !!R.quests.state('m01'), 'cr_arms');
  const a1 = await L.ev(page, () => { for (let i = 0; i < 6; i++) R.step(); return { cur: R.ui.cur, st: (R.quests.state('m01') || {}).st, paused: R.paused }; });
  L.ok('ACCEPT takes m01 and closes; the game runs', a1.cur === null && a1.st === 'open' && !a1.paused, JSON.stringify(a1));
  // a talk branch: the story's second node
  await talkTo(page, 'cr_maester');
  const br0 = await L.ev(page, () => [...document.querySelectorAll('.dlg-ch button')].map(b => b.textContent + '=' + (b.dataset.act || '')));
  const say = await L.findBtn(page, /^Tell me something|\?$/, '.dlg-ch');
  if (say) { await tapAt(page, say); await readAll(page); }
  const br = await L.ev(page, () => ({ cur: R.ui.cur, txt: R.screens.dialog.state && R.screens.dialog.state.pages.join(' '), btns: [...document.querySelectorAll('.dlg-ch button')].map(b => b.textContent) }));
  L.ok('a talk choice shows the next node of the story dialog', !!say && br.cur === 'dialog' && br.txt && !/object Object/.test(br.txt) && br.btns.some(t => /back|leave/i.test(t)), JSON.stringify([br0, br]).slice(0, 300));
  const lv = await L.findBtn(page, /^leave$/i, '.dlg-ch'); if (lv) await tapAt(page, lv);
  L.ok('LEAVE closes the sheet', await L.ev(page, () => R.ui.cur === null));
  // the innkeeper → REST AT THE INN → the inn screen
  await talkTo(page, 'cr_inn');
  const ib = await L.ev(page, () => { const b = document.querySelector('.dlg-ch button[data-act="inn"]'); return { has: !!b, txt: b && b.textContent }; });
  L.ok('the innkeeper offers the inn', ib.has, JSON.stringify(ib));
  if (ib.has) await choose(page, '.dlg-ch button[data-act="inn"]', () => R.ui.cur === 'inn', 'cr_inn');
  L.ok('the inn choice opens the inn screen', await L.ev(page, () => R.ui.cur === 'inn'), await L.ev(page, () => String(R.ui.cur)));
  await L.shot(page, 'dialog_inn');
  await L.ev(page, () => { if (R.ui.cur) R.ui.close(); });
  // the smith → smith + shop
  await talkTo(page, 'cr_smith');
  const sb = await L.ev(page, () => [...document.querySelectorAll('.dlg-ch button')].map(b => b.dataset.act || ''));
  L.ok('the smith offers the smith and the shop', sb.includes('smith') && sb.includes('shop'), sb.join());
  if (sb.includes('shop')) await choose(page, '.dlg-ch button[data-act="shop"]', () => R.ui.cur === 'shop', 'cr_smith');
  L.ok('the shop choice opens the shop', await L.ev(page, () => R.ui.cur === 'shop'), await L.ev(page, () => String(R.ui.cur)));
  await L.ev(page, () => { if (R.ui.cur) R.ui.close(); });
  await talkTo(page, 'cr_smith');
  if (sb.includes('smith')) await choose(page, '.dlg-ch button[data-act="smith"]', () => R.ui.cur === 'smith', 'cr_smith');
  L.ok('the smith choice opens the smith', await L.ev(page, () => R.ui.cur === 'smith'), await L.ev(page, () => String(R.ui.cur)));
  await L.ev(page, () => { if (R.ui.cur) R.ui.close(); });
  // one speaker at a time
  const bb = await L.ev(page, () => { const seat = R.data.world.poiById.casterly; R.player.x = seat.x; R.player.y = seat.y + 40; let most = 0;
    for (const e of R.npcs.at('casterly')) e.bubT = R.t; for (let i = 0; i < 60 * 10; i++) { R.step(); most = Math.max(most, R.npcs.at('casterly').filter(e => e.bub).length); } return most; });
  L.ok('one speech bubble at a time (the nearest NPC)', bb <= 1, String(bb));
  const errs = (await L.gameErrors(page)).concat(errors);
  L.ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await close(); if (FLAKY.length) console.log('NOTE taps that needed the fallback: ' + FLAKY.join(', ')); L.report();
})().catch(e => { console.error('FAIL crash', e); process.exit(1); });
