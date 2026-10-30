// v1.2.3: Mastery for the other five towers — what each step does in battle (stats, pulses, pools, ravens).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_MST, { timeout: 20000 }); await page.waitForTimeout(300);
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; for (let i = 1; i <= 40; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); });
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const battle = async (tower, enc, n, type, fn) => page.evaluate(([tower, enc, n, type, fnsrc]) => { const H = window.HOLDOR, S = window.HOLDOR_CASTLE; const a = H.ACC; a.tlv = { watch: 16, scorp: 16, wild: 16, glass: 16, weir: 16, keep: 16, rook: 16 }; a.mst = {}; if (enc) a.mst[tower] = enc;
    H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); const G = H.G; G.gold = 9000; G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.allies.length = 0; G.projs.length = 0; G.clouds.length = 0;
    const slot = G.map.slots[3]; H.build(slot, tower); const t = slot.tower; t.cd = 0; const R0 = G.map.routes[0];
    let best = null, bd = 1e9; for (let pr = 40; pr < R0.total - 60; pr += 8) { const p = H.posAt(G.map, pr, 0); const d = Math.hypot(p.x - slot.x, p.y - slot.y); if (d < bd) { bd = d; best = pr; } }
    const E = []; for (let i = 0; i < n; i++) { S.spawn(type, best + i * 10, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 9000; E.push(e); }
    return new Function('H', 'G', 't', 'E', 'return (' + fnsrc + ')(H,G,t,E)')(H, G, t, E); }, [tower, enc, n, type, fn.toString()]);
  const stat = (tower, enc, key) => battle(tower, enc, 0, 'sword', (H, G, t) => window.HOLDOR_MST.towerStats(t));
  // stats
  const g0 = await stat('glass', 0), g1 = await stat('glass', 1), g3 = await stat('glass', 3), gb3 = await stat('glass', 13);
  ok('Dragonglass Frostbite 1 slows 8% harder, 3 slows 12% and +20% dps', Math.abs((g0.slow - g1.slow) - 0.08) < 1e-6 && Math.abs((g0.slow - g3.slow) - 0.12) < 1e-6 && Math.abs(g3.dps / g0.dps - 1.2) < 1e-6, JSON.stringify([g0.slow, g1.slow, g3.slow]));
  ok('Walkerbane: ×3.5 / ×4 against walkers', gb3.wm === 4 && g0.wm === undefined);
  const w0 = await stat('weir', 0), wb2 = await stat('weir', 12), wb3 = await stat('weir', 13);
  ok('Weirwood Whisper: +10/20/30% damage taken, reach +15% at 3', Math.abs(wb2.mark - w0.mark - 0.2) < 1e-6 && Math.abs(wb3.mark - w0.mark - 0.3) < 1e-6 && Math.abs(wb3.range / w0.range - 1.15) < 1e-6);
  const k0 = await stat('keep', 0), ka3 = await stat('keep', 3), kb3 = await stat('keep', 13);
  ok('Keep Shield wall 3: +4 men, +70% health', ka3.count === Math.min(8, k0.count + 4) && ka3.shp === Math.round(k0.shp * 1.7), JSON.stringify([k0.count, ka3.count, k0.shp, ka3.shp]));
  ok("Keep Knight's charge 3: +70% damage, return 40% sooner", Math.abs(kb3.sdmg / k0.sdmg - 1.7) < 0.05 && Math.abs(kb3.resp / k0.resp - 0.6) < 0.05);
  const wl0 = await stat('wild', 0), wla3 = await stat('wild', 3);
  ok('Wildfire Inferno 3: splash +45%, burning ×2', Math.abs(wla3.splash / wl0.splash - 1.45) < 1e-6 && Math.abs(wla3.burn / wl0.burn - 2) < 1e-6);
  // Wildfire pool
  const pool = await battle('wild', 12, 1, 'sword', (H, G, t, E) => { H.step(); for (let i = 0; i < 400 && !G.clouds.length; i++) H.step(); return { n: G.clouds.length, t: G.clouds[0] && G.clouds[0].t }; });
  ok('Wildfire Seep 2 leaves a burning pool for 4 s', pool.n >= 1 && pool.t > 3, JSON.stringify(pool));
  const nopool = await battle('wild', 0, 1, 'sword', (H, G, t, E) => { H.step(); for (let i = 0; i < 400 && G.projs.length; i++) H.step(); return G.clouds.length; });
  ok('without Mastery no pool', nopool === 0);
  // Dragonglass freeze pulse after 5 s
  const fr = await battle('glass', 2, 1, 'sword', (H, G, t, E) => { E[0].hp = E[0].max = 1e9; let hit = false; for (let i = 0; i < 60 * 6; i++) { H.step(); if (E[0].chillV >= 98 && E[0].chillT > G.time) hit = true; } return hit; });
  ok('Dragonglass Deep freeze pulses within 6 s', fr === true);
  // Shatter
  const sh = await battle('glass', 12, 1, 'walker', (H, G, t, E) => { E[0].max = 1000; E[0].hp = 200; H.step(); H.step(); return E[0].hp <= 0 || G.enemies.indexOf(E[0]) < 0; });
  ok('Walkerbane step 2 shatters a walker under 25% health', sh === true);
  // Weirwood roots
  const rt = await battle('weir', 2, 1, 'sword', (H, G, t, E) => { let hit = false; for (let i = 0; i < 60 * 7; i++) { H.step(); if (E[0].chillV >= 98 && E[0].chillT > G.time) hit = true; } return hit; });
  ok('Weirwood Grasping roots hold enemies within 7 s', rt === true);
  // Rookery: murder
  const mur = await battle('rook', 3, 4, 'sword', (H, G, t, E) => { H.step(); return G.projs.filter(p => p.src === 'rook').length; });
  ok('Rookery Murder 3: one shot sends 4 ravens', mur === 4, mur);
  const sil = await battle('rook', 13, 1, 'sword', (H, G, t, E) => H.HOLDOR_ROOK ? 0 : window.HOLDOR_ROOK.rookSilence(t));
  ok('Rookery Doom: silence lasts 3 s longer', sil >= 6, sil);
  await page.waitForTimeout(500); ok('no page errors (the mastery marks draw)', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
