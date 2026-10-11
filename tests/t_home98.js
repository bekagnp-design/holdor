// v1.0.98: the simple home. Four tabs (Shop · Army · Battle · Clan); the Hold card in the middle of the home with today's map, the
// countdown and the HOLD button (locked before stage 3); the chests on top; no quick buttons and no 🎨 on the home; Tasks, the full
// Hold page and the standings open as pages with a back arrow; Forge / Tavern / City sit in Army, Season in the Shop, Daily in Tasks;
// the Clan tab holds the realm (chat, war, standings) and the friends; the ✉ pill opens the event popup. Real taps throughout.
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 450 : ms); };
  const scr = () => page.evaluate(() => window.HOLDOR.CLOUD.screen);
  const setup = async (stages) => { await page.evaluate((n) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.freeChestAt = Date.now() - 3600000; a.holdTut = 1; a.holdIntro = 1; a.gold = 900; a.gems = 60; H.setAcc(a); H.showHub('battle'); }, stages); await page.waitForTimeout(900); };
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_HOME98, { timeout: 20000 }); await page.waitForTimeout(300);
  await setup(9);
  // ---- the home
  const home = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('.hubtabs button')].map(b => b.dataset.tab + ':' + b.textContent.trim()), on: (document.querySelector('.hubtabs button.on') || {}).dataset.tab,
    pills: [...document.querySelectorAll('.hmstrip .hpill')].map(b => b.id), slots: document.querySelectorAll('.hmslots.top .slot').length, stage: !!document.querySelector('#hmStage #hmGate'), goal: !!document.querySelector('#hmGoal'),
    gone: ['#bCity', '#bForge', '#bTavern', '#bDaily', '#bSeason', '#bSkin', '#hmHero', '#hmMap'].filter(s => document.querySelector(s)), look: document.querySelector('.hub').className,
    battle: (document.querySelector('#bBattle') || {}).textContent, champ: !!document.querySelector('#bChampH'), map: !!document.querySelector('#bMapH') }));
  ok('four tabs: Shop · Army · Battle · Clan, Battle on', home.tabs.join('|') === 'shop:Shop|coll:Army|battle:Battle|clan:Clan' && home.on === 'battle', JSON.stringify(home.tabs));
  ok('the strip: rank, Tasks, the event; four chest slots on top; the living gate with the next goal; no quick buttons, no 🎨, one look', home.pills.join() === 'hubTro,bTasks,evBadge' && home.slots === 4 && home.stage && home.goal && !home.gone.length && /look-b/.test(home.look), JSON.stringify(home));
  ok('the campaign row stays under the Hold: BATTLE! · STAGE 10, the map and the champion', /BATTLE/.test(home.battle) && /STAGE 10/.test(home.battle) && home.champ && home.map, home.battle);
  const hold = await page.evaluate(() => { const c = document.getElementById('hmMini'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 13) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    return { cls: document.getElementById('hmHold').className, go: document.getElementById('bHold').textContent.replace(/\s+/g, ' '), dis: document.getElementById('bHold').disabled, cd: document.getElementById('hmCd').textContent,
      tx: document.querySelector('#hmHold .hmtx').innerText.replace(/\n/g, ' | '), colours: seen.size, more: !!document.getElementById('bHoldMore') }; });
  ok('the Hold card is open (9 stages): HOLD THE DOOR, the modifier and the biome, 3 runs left, a countdown HH:MM:SS, the map drawn in more than one colour', !/lock/.test(hold.cls) && /HOLD/.test(hold.go) && !hold.dis && /^\d\d:\d\d:\d\d$/.test(hold.cd) && /not played yet today/.test(hold.tx) && /3 runs left/.test(hold.tx) && hold.colours >= 3 && hold.more, JSON.stringify(hold));
  await page.waitForTimeout(1200);
  const cd2 = await page.evaluate(() => document.getElementById('hmCd').textContent);
  ok('the countdown ticks', cd2 !== hold.cd && /^\d\d:\d\d:\d\d$/.test(cd2), hold.cd + ' → ' + cd2);
  await page.screenshot({ path: SC + 'home98_home.png' });
  // ---- Tasks: a page with a back arrow, Battle stays lit, Daily inside
  await tap('#bTasks', 700);
  const tk = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, back: !!document.querySelector('.hback #hubBack'), on: (document.querySelector('.hubtabs button.on') || {}).dataset.tab, daily: (document.querySelector('#bDaily') || {}).textContent, tabs: document.querySelectorAll('.hubtabs button').length }));
  ok('Tasks opens as a page: back arrow, the Battle tab stays lit, four tabs, the Daily card inside', tk.scr === 'hub:tasks' && tk.back && tk.on === 'battle' && tk.tabs === 4 && /Daily/.test(tk.daily || ''), JSON.stringify(tk));
  await page.screenshot({ path: SC + 'home98_tasks.png' });
  await tap('#bDaily', 600);
  ok('Daily (inside Tasks) opens the calendar screen', /daily/.test(await scr()) || /signed in through Telegram|calendar|Daily/i.test(await page.evaluate(() => document.querySelector('#card').innerText.slice(0, 200))), await scr());
  await page.evaluate(() => window.HOLDOR.showHub('tasks')); await page.waitForTimeout(400);
  await tap('#hubBack', 600);
  ok('back returns to the home', await scr() === 'hub:battle' && await page.evaluate(() => !!document.getElementById('hmHold')));
  // ---- the full Hold page from the card's link, and back
  await tap('#bHoldMore', 700);
  const hp = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, back: !!document.querySelector('#hubBack'), head: !!document.querySelector('.holdhead'), rows: !!document.querySelector('.hpanel') }));
  ok('the card\'s link opens the full Hold page (standings, how it works) with a back arrow', hp.scr === 'hub:hold' && hp.back && hp.head && hp.rows, JSON.stringify(hp));
  await tap('#hubBack', 600);
  ok('back from the Hold page returns to the home', await scr() === 'hub:battle');
  // ---- a tap on the card (not the button) also opens the Hold page
  await tap('#hmHold .hmtx', 600); ok('a tap on the card opens the Hold page', await scr() === 'hub:hold'); await tap('#hubBack', 500);
  // ---- HOLD starts today's Hold
  await tap('#bHold', 1500);
  const g = await page.evaluate(() => ({ state: window.HOLDOR.G.state, mode: window.HOLDOR.G.mode }));
  ok('HOLD THE DOOR starts today\'s Hold (a real tap)', g.state === 'play' && g.mode === 'online', JSON.stringify(g));
  await page.evaluate(() => { const H = window.HOLDOR; H.G.state = 'menu'; H.showHub('battle'); }); await page.waitForTimeout(600);
  // ---- the event pill opens the popup
  await tap('#evBadge', 500);
  ok('the ✉ pill opens the event popup', await page.evaluate(() => !!document.querySelector('#ecoModal.on')));
  await page.evaluate(() => { const b = [...document.querySelectorAll('#ecoModal button')].find(x => /Later/.test(x.textContent)); if (b) b.click(); }); await page.waitForTimeout(400);
  // ---- Army: Forge, Tavern, City above the loadout
  await tap('.hubtabs button[data-tab="coll"]', 700);
  const army = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, row: [...document.querySelectorAll('.homerow.army .hbtn')].map(b => b.id + ':' + b.textContent.trim() + ':' + !!b.querySelector('svg')), tabs: !!document.querySelector('.subtabs') }));
  ok('Army: Forge, Tavern and City with drawn icons above the loadout', army.scr === 'hub:coll' && army.row.join('|') === 'bForge:Forge:true|bTavern:Tavern:true|bCity:City:true' && army.tabs, JSON.stringify(army));
  await page.screenshot({ path: SC + 'home98_army.png' });
  await tap('#bForge', 600); ok('Forge opens from Army', /Forge/i.test(await page.evaluate(() => document.querySelector('#card').innerText.slice(0, 120))), await scr());
  await page.evaluate(() => window.HOLDOR.showHub('coll')); await page.waitForTimeout(400); await tap('#bCity', 600);
  ok('City opens from Army', await page.evaluate(() => !!document.querySelector('.city')), await scr());
  await page.evaluate(() => window.HOLDOR.showHub('coll')); await page.waitForTimeout(400); await tap('#bTavern', 600);
  ok('Tavern opens from Army', /Tavern/.test(await page.evaluate(() => document.querySelector('#card').innerText.slice(0, 80))), await scr());
  // ---- Shop: the Season Pass card on top
  await page.evaluate(() => window.HOLDOR.showHub('shop')); await page.waitForTimeout(500);
  const sh = await page.evaluate(() => ({ season: (document.querySelector('#bSeason') || {}).textContent, first: (document.querySelector('#hubBody').firstElementChild || {}).id, deals: !!document.querySelector('.shopgrid.deals') }));
  ok('Shop: the Season Pass card sits on top, the deals below', /Season Pass/.test(sh.season || '') && sh.deals, JSON.stringify(sh));
  await tap('#bSeason', 600); ok('the Season card opens the season', /Season/i.test(await page.evaluate(() => document.querySelector('#card').innerText.slice(0, 120))), await scr());
  // ---- Clan: the realm, the clans to come, the friends; chat / war / standings and back to Clan
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(300); await tap('.hubtabs button[data-tab="clan"]', 700);
  const cl = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, realm: (document.querySelector('#clRealm .cltx b') || {}).textContent, flag: !!document.querySelector('#clRealm .clhead svg, #clRealm .clhead img'), btns: ['#bClChat', '#bClWar', '#bClRealms'].filter(s => document.querySelector(s)).length,
    soon: /Clans/.test((document.querySelector('.clcard.soon') || {}).textContent || ''), friends: /friends/i.test(document.getElementById('hubBody').innerText) }));
  ok('Clan: the realm card (flag, name, chat / war / standings), the clans to come, the friends block', cl.scr === 'hub:clan' && cl.realm === 'Georgia' && cl.flag && cl.btns === 3 && cl.soon && cl.friends, JSON.stringify(cl));
  await page.screenshot({ path: SC + 'home98_clan.png' });
  await tap('#bClChat', 600); ok('Realm chat opens from Clan', /^chat/.test(await scr()), await scr());
  await tap('#bBack', 600); ok('…and its back returns to Clan', await scr() === 'hub:clan', await scr());
  await tap('#bClWar', 600); ok('Realm war opens from Clan', /^war/.test(await scr()), await scr());
  await tap('#bBack', 600); ok('…and its back returns to Clan', await scr() === 'hub:clan', await scr());
  await tap('#bClRealms', 600);
  const ev = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, back: !!document.querySelector('#hubBack'), on: (document.querySelector('.hubtabs button.on') || {}).dataset.tab }));
  ok('Standings open as a page with a back arrow', ev.scr === 'hub:events' && ev.back, JSON.stringify(ev));
  // ---- locked: two stages cleared
  await setup(2);
  const lk = await page.evaluate(() => ({ cls: document.getElementById('hmHold').className, dis: document.getElementById('bHold').disabled, tx: document.querySelector('#hmHold .hmtx').innerText.replace(/\n/g, ' | '), battle: document.getElementById('bBattle').textContent }));
  ok('with two stages the Hold card is locked: "opens after stage 3", the button disabled, BATTLE! STAGE 3 under it', /lock/.test(lk.cls) && lk.dis && /opens after stage 3/.test(lk.tx) && /STAGE 3/.test(lk.battle), JSON.stringify(lk));
  await page.screenshot({ path: SC + 'home98_locked.png' });
  await tap('#hmHold .hmtx', 500); ok('a tap on the locked card stays home (a toast, no page)', await scr() === 'hub:battle');
  // ---- a brand-new player: BEGIN, the first lesson
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; H.setAcc(a); H.showHub('battle'); }); await page.waitForTimeout(600);
  const nw = await page.evaluate(() => ({ battle: document.getElementById('bBattle').textContent, hint: !!document.querySelector('.hint'), hold: !!document.getElementById('hmHold'), locks: document.querySelectorAll('.hubtabs button.lock').length, strip: !!document.querySelector('.hmstrip') }));
  ok('a new player sees BEGIN · YOUR FIRST LESSON and the hint; no strip, no Hold card, the three other tabs locked (v1.0.99)', /BEGIN/.test(nw.battle) && nw.hint && !nw.hold && nw.locks === 3 && !nw.strip, JSON.stringify(nw));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
