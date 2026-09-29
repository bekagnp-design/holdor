// Plays the whole first battle tutorial and the menu tour through real taps, like a new player.
// usage: node t_tut2.js [shots]    (shots → saves screenshots of every step as tt_XX.png)
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const SHOTS = process.argv[2] === 'shots';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 430, height: 766 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_TUT, { timeout: 20000 }); await page.waitForTimeout(300);
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; H.setAcc(a); H.persist(); H.showHub('battle'); });
  await page.waitForTimeout(500);
  await page.locator('#bBattle').tap(); await page.waitForTimeout(600);
  const T = () => page.evaluate(() => { const X = window.HOLDOR_TUT, G = window.HOLDOR.G, st = X.TS(); return st ? { i: G.tut.i, want: st.want || null, hold: !!G.tut.hold, paused: G.paused, wave: G.wave, gold: Math.floor(G.gold), ring: !!window.HOLDOR_RING.state(), state: G.state } : { done: true, state: G.state, wave: G.wave }; });
  const tapWorld = async (x, y) => { const p = await page.evaluate(([x, y]) => { const q = document.querySelector('#stage').getBoundingClientRect(), s = window.HOLDOR_RING.w2s(x, y); return { x: q.left + s.x, y: q.top + s.y }; }, [x, y]); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(220); };
  const ff = (n) => page.evaluate((n) => { const H = window.HOLDOR, G = H.G; for (let i = 0; i < n && G.state === 'play' && !G.paused; i++) H.step(); }, n);
  const tapEl = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('no box'); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const ringTapGo = async () => { const n = await page.locator('#ring .rb.tgo').count(); await tapEl(n ? page.locator('#ring .rb.tgo').first() : page.locator('#ring .rb').first()); await page.waitForTimeout(220); };
  const ringConfirm = async () => { await tapEl(page.locator('#ring .rb.arm').first()); await page.waitForTimeout(260); };
  const slotOf = (what) => page.evaluate((what) => { const G = window.HOLDOR.G; let s = null; if (what === 'free') s = window.HOLDOR_TUT.tutSlot(); else if (what === 'last') s = G.lastBuilt && G.lastBuilt.tower ? G.lastBuilt : null; if (!s) s = G.map.slots.filter(x => x.tower).sort((a, b) => b.tower.lvl - a.tower.lvl || b.y - a.y)[0]; return { x: s.x, y: s.y - (s.tower ? 10 : 0) }; }, what);
  const log = []; let guard = 0, shot = 0;
  while (guard++ < 140) {
    const t = await T(); log.push(t.done ? 'DONE' : `${t.i}:${t.want || (t.hold ? 'hold' : '-')}`);
    if (t.done) break;
    if (SHOTS) { await page.waitForTimeout(250); await page.screenshot({ path: SC + 'tt_' + String(shot++).padStart(2, '0') + '.png' }); }
    if (t.hold) { await tapWorld(195, 420); continue; }
    const w = (t.want || '').split(':')[0];
    if (w === 'build') { if (!t.ring) { const s = await slotOf('free'); await tapWorld(s.x, s.y); } await ringTapGo(); if (SHOTS) await page.screenshot({ path: SC + 'tt_' + String(shot++).padStart(2, '0') + '.png' }); await ringConfirm(); continue; }
    if (w === 'upgrade' || w === 'sell' || w === 'info') { const s = await slotOf(w === 'sell' ? 'last' : 'top'); if (!t.ring) await tapWorld(s.x, s.y); await ringTapGo(); if (SHOTS) await page.screenshot({ path: SC + 'tt_' + String(shot++).padStart(2, '0') + '.png' });
      if (w === 'info') { await page.waitForTimeout(200); if (SHOTS) await page.screenshot({ path: SC + 'tt_' + String(shot++).padStart(2, '0') + '.png' }); await page.locator('#sClose').tap(); await page.waitForTimeout(250); } else await ringConfirm(); continue; }
    if (w === 'call') { const m = await page.evaluate(() => { const G = window.HOLDOR.G, H = window.HOLDOR; if(!(G.waveDone&&H.canCall()))return null;const R=G.map.routes[0];const q=H.posAt(G.map,42,R.i);return {x:Math.max(26,Math.min(364,q.x)),y:Math.max(30,q.y)}; }); if (!m) { await ff(240); await page.waitForTimeout(100); continue; } await tapWorld(m.x, m.y); continue; }
    if (w === 'shot' || w === 'kill' || w === 'wait') { await ff(120); await page.waitForTimeout(60); continue; }
    if (w === 'move') { const h = await page.evaluate(() => { const g = window.HOLDOR.G.hero; return { x: g.x, y: g.y - 8 }; }); await tapWorld(h.x, h.y); await tapWorld(150, 520); continue; }
    if (w === 'ult') { await tapEl(page.locator('#bUlt')); await page.waitForTimeout(400); continue; }
    if (w === 'power') { await tapEl(page.locator('#bP0')); await page.waitForTimeout(150); const e = await page.evaluate(() => { const G = window.HOLDOR.G, H = window.HOLDOR; const en = G.enemies.find(e => e.hp > 0 && !e.fly); if (!en) return { x: 195, y: 300 }; const p = H.posAt(G.map, en.prog, en.route); return { x: p.x, y: p.y }; }); await tapWorld(e.x, e.y); continue; }
    if (w === 'speed') { await tapEl(page.locator('#bSpeed')); await page.waitForTimeout(200); continue; }
    if (w === 'pause') { await tapEl(page.locator('#bPause')); await page.waitForTimeout(300); if (SHOTS) await page.screenshot({ path: SC + 'tt_' + String(shot++).padStart(2, '0') + '.png' }); await page.locator('#pR').tap(); await page.waitForTimeout(250); continue; }
    if (w === 'book') { await tapEl(page.locator('#bInfo')); await page.waitForTimeout(300); if (SHOTS) await page.screenshot({ path: SC + 'tt_' + String(shot++).padStart(2, '0') + '.png' }); await page.locator('#bOk').tap(); await page.waitForTimeout(250); continue; }
    if (!t.want) { await page.waitForTimeout(700); await ff(60); continue; }  // the last, self-closing step
    await page.waitForTimeout(300);
  }
  const mid = await page.evaluate(() => { const G = window.HOLDOR.G, A = window.HOLDOR.ACC; return { tut: A.tut, state: G.state, wave: G.wave, towers: G.map.slots.filter(s => s.tower).map(s => s.tower.type + s.tower.lvl), speed: G.speed }; });
  // finish the battle
  for (let k = 0; k < 60; k++) { const st = await page.evaluate(() => window.HOLDOR.G.state); if (st !== 'play') break; await page.evaluate(() => { const H = window.HOLDOR, G = H.G; if (G.waveDone && H.canCall && H.canCall()) H.callWave(); for (let i = 0; i < 600 && G.state === 'play'; i++) H.step(); }); await page.waitForTimeout(50); }
  await page.waitForTimeout(700);
  const vic = await page.evaluate(() => ({ stars: (document.querySelector('#tvStars') || {}).textContent, rew: (document.querySelector('#tvRew') || {}).textContent, coach: window.HOLDOR_TUT.COACH.on, gold: window.HOLDOR.ACC.gold, gems: window.HOLDOR.ACC.gems }));
  await page.screenshot({ path: SC + 'tv_victory.png' });
  // the tours: 3 steps after the win, then the Battle tab (4), then each tab the first time it opens
  const tour = []; let ts = 0;
  const runTour = async (label) => { let g2 = 0; while (g2++ < 40) {
    const c = await page.evaluate(() => { const C = window.HOLDOR_TUT.COACH; if (!C.on) return null; const st = C.steps[C.i]; const el = document.querySelector('#coach'); return { i: C.i, n: C.steps.length, tap: !!st.tap, dis: !!(C.tgt && C.tgt.disabled), shown: !!C.tgt && !el.classList.contains('wait'), txt: el.querySelector('.cbub p').textContent.slice(0, 60) }; });
    if (!c) { if (g2 < 4) { await page.waitForTimeout(300); continue; } break; }
    if (!c.shown) { await page.waitForTimeout(250); continue; }
    tour.push(`${label} ${c.i + 1}/${c.n}${c.tap && !c.dis ? ' tap' : ' next'}: ${c.txt}`);
    if (SHOTS) await page.screenshot({ path: SC + 'to_' + String(ts++).padStart(2, '0') + '.png' });
    if (c.tap && !c.dis) { const r = await page.evaluate(() => { const q = window.HOLDOR_TUT.COACH.tgt.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }); await page.touchscreen.tap(r.x, r.y); }
    else await page.locator('#coach .cnext').tap();
    await page.waitForTimeout(450);
  } };
  await runTour('win+battle');
  const afterBattle = await page.evaluate(() => ({ screen: document.querySelector('.mapview') ? 'map' : (document.querySelector('#bBattle') ? 'hub' : 'other'), tours: Object.assign({}, window.HOLDOR.ACC.tours) }));
  for (const tab of ['coll', 'shop', 'hold', 'events']) { await page.evaluate((t) => window.HOLDOR.showHub(t), tab); await page.waitForTimeout(700); await runTour(tab); }
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(700); await runTour('battle-again');
  const afterBattle2 = afterBattle;
  const end = await page.evaluate(() => { const A = window.HOLDOR.ACC; return { tours: A.tours, afterBattle: null, tut: A.tut, gold: A.gold, gems: A.gems, tlv: A.tlv, champ: A.champs[A.sel], screen: document.querySelector('.mapview') ? 'map' : (document.querySelector('#bBattle') ? 'hub' : 'other') }; });
  await page.screenshot({ path: SC + 'to_end.png' });
  end.afterBattle = afterBattle2;
  console.log(JSON.stringify({ steps: log.join(' '), mid, vic, tour, end }, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
