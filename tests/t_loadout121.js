// v1.2.1: the spell loadout (3 of 5), Long Night and Gate repair. A real account, real taps in the Spells room and on the battle buttons.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_SP && window.HOLDOR_TUT, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(300); };
  const setup = (stages, loadout) => page.evaluate(([stages, loadout]) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    a.learn = {}; const L = window.HOLDOR_TUT.LESSONS; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= stages; i++) a.campaign[i] = 3; a.gold = 5000; if (loadout) a.loadout = loadout; a.sel = 'robb'; H.setAcc(a); H.persist(); }, [stages, loadout]);
  const lo = () => page.evaluate(() => window.HOLDOR_SP.spellLoadout().join());
  const battle = () => page.evaluate(() => { const H = window.HOLDOR, G = H.G, S = window.HOLDOR_CASTLE; H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0;
    const R0 = G.map.routes[0]; for (let i = 0; i < 4; i++) { S.spawn('sword', 200 + i * 20, 0); G.enemies[G.enemies.length - 1].hp = G.enemies[G.enemies.length - 1].max = 9000; } });
  // ---- the default and the room
  await setup(30); ok('the default loadout is Arrow rain, Dracarys, Brothers', (await lo()) === 'arrows,fire,reinf', await lo());
  await page.evaluate(() => window.HOLDOR.showHeroRoom && 0); await page.evaluate(() => { window.HOLDOR.showHub('coll', 'spells'); }); await page.waitForTimeout(400);
  const grid = await page.evaluate(() => document.querySelectorAll('.ccard[data-s]').length);
  ok('the Spells tab shows all five spells', grid === 5, grid);
  await page.evaluate(() => window.HOLDOR_ROOM ? 0 : 0);
  await page.evaluate(() => document.querySelector('.ccard[data-s="night"]').click()); await page.waitForTimeout(500);
  const eq = await page.evaluate(() => ({ slots: document.querySelectorAll('[data-eq]').length, txt: document.querySelector('#card').innerText.slice(0, 200) }));
  ok('the Long Night room has three slot buttons to put it in', eq.slots === 3 && /Long Night/.test(eq.txt), JSON.stringify(eq));
  await page.screenshot({ path: SC + 'loadout121_room.png' });
  await tap('[data-eq="2"]');
  ok('tapping slot 3 equips Long Night there', (await lo()) === 'arrows,fire,night', await lo());
  await page.evaluate(() => document.querySelector('[data-s="arrows"]') && 0);
  await page.evaluate(() => window.HOLDOR_SP.spellEquip('arrows', 2));
  ok('equipping a spell already in another slot swaps them', (await lo()) === 'night,fire,arrows', await lo());
  await page.evaluate(() => window.HOLDOR_SP.spellEquip('night', 2));
  // ---- locked
  await setup(5);
  await page.evaluate(() => window.HOLDOR.showHub('coll', 'spells')); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.ccard[data-s="night"]').click()); await page.waitForTimeout(500);
  ok('a locked spell has no equip row', await page.evaluate(() => document.querySelectorAll('[data-eq]').length) === 0);
  // ---- in battle: Long Night in slot 3
  await setup(30, ['arrows', 'fire', 'night']); await battle(); await page.waitForTimeout(300);
  const lab = await page.evaluate(() => ({ l: document.querySelector('#bP2 .l').textContent, e: document.querySelector('#bP2 .e').textContent }));
  ok('the third battle button is Long Night with its own icon', lab.l === 'Long Night' && lab.e === '❄️', JSON.stringify(lab));
  await tap('#bP2');
  const cold = await page.evaluate(() => { const G = window.HOLDOR.G; return { chilled: G.enemies.every(e => e.chillT > G.time), v: G.enemies[0].chillV, cd: G.powerCd.night, dis: document.getElementById('bP2').disabled }; });
  ok('a tap chills every enemy by 40 %, starts the cooldown and greys the button', cold.chilled && cold.v === 40 && cold.cd > 40 && cold.dis, JSON.stringify(cold));
  // ---- Gate repair in slot 1
  await setup(30, ['repair', 'fire', 'reinf']); await battle(); await page.waitForTimeout(300);
  const g0 = await page.evaluate(() => { const G = window.HOLDOR.G; G.doorHp = 500; return G.doorMax; });
  await tap('#bP0');
  const g1 = await page.evaluate(() => window.HOLDOR.G.doorHp);
  ok('Gate repair gives back 30 % of the gate: ' + g0, Math.abs(g1 - (500 + Math.round(g0 * 0.3))) <= 1, g1);
  // ---- the aimed spells still work from any slot
  await setup(30, ['night', 'arrows', 'reinf']); await battle(); await page.waitForTimeout(300);
  await tap('#bP1');
  ok('Arrow rain in slot 2 still arms and waits for the map', await page.evaluate(() => window.HOLDOR.G.armed === 'arrows'));
  // ---- the tutorial battle ignores the loadout
  const tut = await page.evaluate(() => { const H = window.HOLDOR; H.ACC.loadout = ['night', 'repair', 'fire']; window.HOLDOR_TUT.startTutorial(); return H.G.slots.join(); });
  ok('the first battle always uses the three first spells', tut === 'arrows,fire,reinf', tut);
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
