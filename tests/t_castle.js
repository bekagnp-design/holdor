// v1.0.51: Train (army) + Spell shop (pack) — hub screens by real taps, effects in battle.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CASTLE, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tapEl = async (sel) => { await page.locator(sel).first().tap(); await page.waitForTimeout(350); };
  const txt = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = { chest: 1, hold: 1, champ: 1 }; for (let i = 1; i <= 8; i++) a.campaign[i] = 3; a.gold = 3000; H.setAcc(a); H.persist(); H.showHub('battle'); });
  await page.waitForTimeout(500);
  ok('castle row', await page.evaluate(() => !!document.querySelector('#bTrain') && !!document.querySelector('#bSpellShop')));
  ok('train label', /Army level 1/.test(await txt('#bTrain')) && /Direwolf at 5/.test(await txt('#bTrain')), await txt('#bTrain'));
  await page.screenshot({ path: SC + 'cs_hub.png' });
  // Train room
  await tapEl('#bTrain');
  const tr = await txt('#card');
  ok('train room', /Army level 1/.test(tr) && /Sworn sword/.test(tr) && /Longbowman/.test(tr) && /Outrider/.test(tr) && /Direwolf/.test(tr) && /Train to level 5/.test(tr), tr.slice(0, 100).replace(/\n/g, ' '));
  ok('unit stats lvl1', /❤️ 150 · ⚔️ 15 · 🏃 86/.test(tr));
  await page.screenshot({ path: SC + 'cs_train.png' });
  const g0 = await page.evaluate(() => window.HOLDOR.ACC.gold);
  await tapEl('#bTrainUp');
  const st1 = await page.evaluate(() => ({ lvl: window.HOLDOR_CASTLE.armyLvl(), gold: window.HOLDOR.ACC.gold, xp: window.HOLDOR.ACC.axp }));
  ok('train level 2', st1.lvl === 2 && st1.gold === g0 - 200 && st1.xp === 20, JSON.stringify(st1));
  ok('unit stats lvl2', /❤️ 162 · ⚔️ 16.2 · 🏃 86/.test(await txt('#card')));
  for (let i = 0; i < 3; i++) await tapEl('#bTrainUp');
  const st5 = await page.evaluate(() => ({ lvl: window.HOLDOR_CASTLE.armyLvl(), gold: window.HOLDOR.ACC.gold, mul: window.HOLDOR_CASTLE.armyMul() }));
  ok('train level 5', st5.lvl === 5 && st5.gold === g0 - 200 - 350 - 550 - 800 && Math.abs(st5.mul - 1.32) < 1e-9, JSON.stringify(st5));
  ok('house unit open', /rides with every Brothers call/.test(await txt('#card')) && !/Train to level 5/.test(await txt('#card')));
  ok('train button state', await page.evaluate(() => { const b = document.querySelector('#bTrainUp'); return b && b.disabled === (window.HOLDOR.ACC.gold < 1100); }), 'gold ' + st5.gold);
  await tapEl('#bOk');
  ok('back to battle', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'hub:battle'));
  ok('train label lvl5', /Army level 5 · Direwolf/.test(await txt('#bTrain')), await txt('#bTrain'));
  // Spell shop
  await page.evaluate(() => { window.HOLDOR.ACC.gold = 1000; window.HOLDOR.persist(); window.HOLDOR.showHub('battle'); });
  await page.waitForTimeout(300);
  await tapEl('#bSpellShop');
  const sh = await txt('#card');
  ok('spell shop', /Hourglass/.test(sh) && /Mason/.test(sh) && /Iron Bank/.test(sh) && /Frost wave/.test(sh) && /Hodor's roar/.test(sh) && /Pack · 0/i.test(sh), sh.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'cs_shop.png' });
  await tapEl('[data-buy="frost"]'); await tapEl('[data-buy="frost"]'); await tapEl('[data-buy="frost"]');
  const p3 = await page.evaluate(() => ({ p: Object.assign({}, window.HOLDOR.ACC.pack), gold: window.HOLDOR.ACC.gold, full: document.querySelector('[data-buy="frost"]').disabled, label: document.querySelector('[data-buy="frost"]').innerText }));
  ok('pack full at 3', p3.p.frost === 3 && p3.gold === 1000 - 480 && p3.full && /PACK FULL/.test(p3.label), JSON.stringify(p3));
  await tapEl('[data-buy="repair"]'); await tapEl('[data-buy="roar"]'); await tapEl('[data-buy="purse"]'); await tapEl('[data-buy="slow"]');
  const p4 = await page.evaluate(() => ({ n: window.HOLDOR_CASTLE.packCount(), gold: window.HOLDOR.ACC.gold }));
  ok('pack of 7', p4.n === 7 && p4.gold === 1000 - 480 - 100 - 140 - 90 - 120, JSON.stringify(p4));
  await tapEl('#bOk');
  ok('shop label', /7 in the pack/.test(await txt('#bSpellShop')), await txt('#bSpellShop'));
  // battle: the pack button, one use per battle
  await page.evaluate(() => window.HOLDOR.startGame({ level: 3 })); await page.waitForTimeout(600);
  ok('pack button shown', await page.evaluate(() => { const b = document.querySelector('#bPack'); return b && b.style.display !== 'none' && /Pack ×7/.test(b.innerText); }), await txt('#bPack'));
  // spawn enemies near the gate and use the roar
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.paused = true; G.waveDone = false; for (let i = 0; i < 6; i++) window.HOLDOR_CASTLE.spawn('axe', G.map.routes[0].total - 60 - i * 12, 0); G.doorHp = G.doorMax - 400; });
  const before = await page.evaluate(() => window.HOLDOR.G.enemies.map(e => Math.round(e.prog)));
  await tapEl('#bPack');
  ok('pack sheet', await page.evaluate(() => document.querySelector('#sheet').classList.contains('open') && document.querySelectorAll('[data-pk]').length === 5));
  await page.screenshot({ path: SC + 'cs_pack.png' });
  await tapEl('[data-pk="roar"]');
  const after = await page.evaluate(() => ({ prog: window.HOLDOR.G.enemies.map(e => Math.round(e.prog)), stun: window.HOLDOR.G.enemies.map(e => Math.round(e.stunT * 10) / 10), used: window.HOLDOR.G.packUsed, roar: window.HOLDOR.ACC.pack.roar, sheet: document.querySelector('#sheet').classList.contains('open'), btn: document.querySelector('#bPack').innerText, dis: document.querySelector('#bPack').disabled }));
  ok('roar throws back', after.prog.every((p, i) => p === Math.max(0, before[i] - 70)) && after.stun.every(s => s >= 1.4), JSON.stringify({ before, after: after.prog, stun: after.stun }));
  ok('one use per battle', after.used && after.roar === 0 && !after.sheet && /Used/.test(after.btn) && after.dis, JSON.stringify(after));
  const used2 = await page.evaluate(() => window.HOLDOR_CASTLE.usePack('repair'));
  ok('second use refused', used2 === false && (await page.evaluate(() => window.HOLDOR.ACC.pack.repair)) === 1);
  // a new battle: repair + purse + frost + slow effects (each in its own battle)
  const effect = async (k, fn) => { await page.evaluate(() => window.HOLDOR.startGame({ level: 3 })); await page.waitForTimeout(300); return page.evaluate(([k, fn]) => { const H = window.HOLDOR, G = H.G; G.waveDone = false; for (let i = 0; i < 3; i++) window.HOLDOR_CASTLE.spawn('sword', 80 + i * 20, 0); G.doorHp = G.doorMax - 400; const g0 = G.gold; const r = window.HOLDOR_CASTLE.usePack(k); return { r, door: G.doorHp, doorMax: G.doorMax, gold: G.gold - g0, slow: G.slowUntil - G.time, stun: G.enemies.map(e => e.stunT), left: window.HOLDOR.ACC.pack[k] }; }, [k, fn]); };
  const rp = await effect('repair'); ok('repair +250', rp.r && rp.door === rp.doorMax - 150 && rp.left === 0, JSON.stringify(rp));
  const pu = await effect('purse'); ok('purse +150', pu.r && pu.gold === 150 && pu.left === 0, JSON.stringify(pu));
  const fr = await effect('frost'); ok('frost 3 s', fr.r && fr.stun.every(s => s === 3) && fr.left === 2, JSON.stringify(fr));
  const sl = await effect('slow'); ok('hourglass 10 s', sl.r && Math.abs(sl.slow - 10) < 0.05 && sl.left === 0, JSON.stringify(sl));
  // Brothers scale with the army and the Direwolf joins
  const br = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; H.startGame({ level: 8 }); G.powerCd.reinf = 0; H.castPower('reinf'); return G.allies.map(a => ({ k: a.kind, hp: a.max, dmg: Math.round(a.dmg * 100) / 100, unit: a.unit || null, house: a.house })); });
  ok('brothers ×1.32 + house unit', br.length === 4 && br.filter(a => a.unit === 'house').length === 1 && br[0].hp === 277 && br[3].hp === 388 && br[3].house === true, JSON.stringify(br));
  // pack button hidden with an empty pack / in the tutorial
  await page.evaluate(() => { window.HOLDOR.ACC.pack = {}; window.HOLDOR.startGame({ level: 3 }); });
  await page.waitForTimeout(300);
  ok('pack hidden when empty', await page.evaluate(() => document.querySelector('#bPack').style.display === 'none'));
  await page.screenshot({ path: SC + 'cs_battle.png' });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
