// v1.1.4: the champion reveal, a picture for every skill, and the interface that arrives one piece at a time.
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
process.on('unhandledRejection', e => { console.log(JSON.stringify(global.__R || {}, null, 1)); console.log('THROW', String(e && e.message).slice(0, 300)); process.exit(1); });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const R = global.__R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 400 : ms); };
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GUIDE && window.HOLDOR_STORY, { timeout: 20000 }); await page.waitForTimeout(400);
  // ---- every skill has a kind; every kind draws; the kinds differ
  const sk = await page.evaluate(() => { const H = window.HOLDOR, G = window.HOLDOR_GUIDE; const ids = Object.keys(H.SK); const miss = ids.filter(k => G.skCat(k) === 'generic'); const cats = {}; ids.forEach(k => { cats[G.skCat(k)] = (cats[G.skCat(k)] || 0) + 1; });
    const a = H.newAccount('stark', 0, 'squire'); H.setAcc(a); const drawn = {}; const cvs = {};
    for (const cat of Object.keys(G.SKSETS)) { const id = G.SKSETS[cat].split(' ')[0]; const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const c = cv.getContext('2d'); G.skillDemoFrame(c, id, 1.7, 'stark'); const d = c.getImageData(0, 0, 320, 180).data, set = new Set(); for (let i = 0; i < d.length; i += 4 * 37) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); drawn[cat] = set.size;
      const cv2 = document.createElement('canvas'); cv2.width = 320; cv2.height = 180; G.skillDemoFrame(cv2.getContext('2d'), id, 0.2, 'stark'); const A = c.getImageData(0, 0, 320, 180).data, B = cv2.getContext('2d').getImageData(0, 0, 320, 180).data; let diff = 0; for (let i = 0; i < A.length; i += 4 * 13) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) > 40) diff++; drawn[cat + '_moves'] = diff; }
    return { n: ids.length, miss, cats, drawn }; });
  ok('all 100 skills belong to one of ten kinds (none left generic); every kind draws a picture with many colours that changes over time', sk.n === 100 && !sk.miss.length && Object.keys(sk.cats).length === 10 && Object.entries(sk.drawn).every(([k, v]) => /_moves$/.test(k) ? v > 10 : v >= 8), JSON.stringify(sk));
  // ---- the reveal, with films/reveals on: a chest, a 3D card, three skills, the last card
  await page.evaluate(() => { window.__films = 1; const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.sv = 1; a.castle = 1; a.intro = 1; a.tut = 1; a.tutWon = 1; a.sel = 'brienne'; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, chests: 1, tasks: 1, clan: 1 }; a.film = { f0: 1, f1: 1, f2: 1, f3: 1, f4: 1 }; for (let i = 1; i <= 4; i++) a.campaign[i] = 3; H.setAcc(a); H.persist(); H.G.state = 'menu'; H.showHub('battle'); });
  await page.waitForTimeout(800);
  const b0 = await page.evaluate(() => ({ film: !!document.querySelector('.film'), rv: !!document.querySelector('.rv'), f5: !!(window.HOLDOR.ACC.film && window.HOLDOR.ACC.film.f5) }));
  ok('stage 4 held, the Army is due: its film (f5) plays first (the reveal waits behind it)', b0.film && !b0.rv && !b0.f5, JSON.stringify(b0));
  await tap('#filmSkip', 900);
  const b1 = await page.evaluate(() => ({ rv: !!document.querySelector('.rv'), cls: (document.querySelector('.rv') || {}).className, name: ((document.querySelector('.rvplate b') || {}).textContent) || '', due: window.HOLDOR_GUIDE.RV.kind }));
  ok('after the film the champion reveal opens: a chest falls first, the card is not yet there', b1.rv && /p0/.test(b1.cls) && b1.due === 'meet', JSON.stringify(b1));
  await page.screenshot({ path: SC + 'guide104_chest.png' });
  await page.waitForTimeout(2300);
  const b2 = await page.evaluate(() => ({ cls: document.querySelector('.rv').className, lid: getComputedStyle(document.querySelector('.rvlid')).transform }));
  await page.waitForTimeout(700); await page.screenshot({ path: SC + 'guide104_burst.png' });
  await page.waitForTimeout(1900);
  const b3 = await page.evaluate(() => ({ cls: document.querySelector('.rv').className, plate: document.querySelector('.rvplate').innerText.replace(/\n/g, ' | '), img: getComputedStyle(document.querySelector('.rvimg')).backgroundImage.slice(0, 20), t0: getComputedStyle(document.querySelector('.rvcard')).transform }));
  ok('the chest knocks three times and bursts (p1), the champion rises and settles as a card with her name, rarity and stars (p2)', /k3/.test(b2.cls) && /p1|p2/.test(b2.cls) && /p2/.test(b3.cls) && /Brienne/.test(b3.plate) && /YOUR CHAMPION/.test(b3.plate) && /url/.test(b3.img), JSON.stringify([b2, b3]));
  await page.screenshot({ path: SC + 'guide104_card.png' });
  // 3D: a finger turns the card; left and right differ; the glare follows
  const box = await page.locator('.rvstage').first().boundingBox();
  await page.touchscreen.tap(box.x + 20, box.y + box.height / 2); await page.waitForTimeout(500);
  const L = await page.evaluate(() => { const e = document.querySelector('.rvcard'); return { ry: e.style.getPropertyValue('--ry'), gx: e.style.getPropertyValue('--gx') }; });
  await page.touchscreen.tap(box.x + box.width - 20, box.y + box.height / 2); await page.waitForTimeout(500);
  const Rr = await page.evaluate(() => { const e = document.querySelector('.rvcard'); return { ry: e.style.getPropertyValue('--ry'), gx: e.style.getPropertyValue('--gx') }; });
  ok('the card is 3D: it sways by itself and turns toward a finger (the angle and the glare position change from one side to the other)', parseFloat(L.ry) !== parseFloat(Rr.ry) && parseFloat(L.gx) !== parseFloat(Rr.gx), JSON.stringify([L, Rr]));
  // skills: three, each with a looping picture and five words; ⓘ opens the full text
  await tap('.rvnext', 700);
  const s1 = await page.evaluate(() => ({ cls: document.querySelector('.rv').className, name: document.querySelector('.rvskn b').textContent, ult: !!document.querySelector('.rvskn em'), tag: document.querySelector('.rvskn small').textContent, demo: !!document.querySelector('.rvdemo'), dots: document.querySelectorAll('.rvdots i').length, full: document.querySelector('.rvfull').hidden }));
  await page.screenshot({ path: SC + 'guide104_skill1.png' });
  await tap('.rvinfo', 300); const full = await page.evaluate(() => ({ hidden: document.querySelector('.rvfull').hidden, text: document.querySelector('.rvfull').textContent }));
  ok('skill 1 of 3: its name, five words, a looping picture, three dots; ⓘ opens the full text', /mini/.test(s1.cls) && s1.name && !s1.ult && s1.tag.split(' ').length <= 5 && s1.demo && s1.dots === 3 && s1.full && !full.hidden && full.text.length > 10, JSON.stringify([s1, full]));
  await tap('.rvnext', 700); await tap('.rvnext', 700);
  const s3 = await page.evaluate(() => ({ name: document.querySelector('.rvskn b').textContent, ult: !!document.querySelector('.rvskn em'), btn: document.querySelector('.rvnext').textContent }));
  await page.screenshot({ path: SC + 'guide104_skill3.png' });
  ok('skill 3 is the ULTIMATE and the button says DONE', s3.ult && /DONE/.test(s3.btn), JSON.stringify(s3));
  await tap('.rvnext', 800);
  const last = await page.evaluate(() => ({ cls: document.querySelector('.rv').className, btns: [...document.querySelectorAll('.rvcta button')].map(b => b.textContent) }));
  ok('the last card has one big button: LET\'S RIDE', /last/.test(last.cls) && last.btns.length === 1 && /RIDE/.test(last.btns[0]), JSON.stringify(last));
  await tap('.rvcta .big', 1000);
  const done = await page.evaluate(() => ({ rv: !!document.querySelector('.rv'), meet: !!(window.HOLDOR.ACC.rv && window.HOLDOR.ACC.rv.meet), hub: !!document.querySelector('.hubtabs'), locks: [...document.querySelectorAll('.hubtabs button.lock')].map(b => b.dataset.tab).join(), g: document.querySelector('.hub').className }));
  ok('LET\'S RIDE closes the reveal (marked seen) and the hub appears with the Army open', !done.rv && done.meet && done.hub && !/coll/.test(done.locks), JSON.stringify(done));
  // ---- the interface arrives: the Army's buttons pop the first time
  const pop = await page.evaluate(() => ({ seenArmy: window.HOLDOR_GUIDE.uiSeen('home_army'), pops: document.querySelectorAll('.hub .pop-in').length }));
  ok('the first time the Army is open its pieces pop out (map, champion button, chests, the tab) and are marked seen', pop.seenArmy && pop.pops >= 3, JSON.stringify(pop));
  await page.screenshot({ path: SC + 'guide104_hub.png' });
  // stage 5: the second champion joins; the reveal says so and offers to ride with her
  await page.evaluate(() => { const H = window.HOLDOR; H.G.state = 'menu'; H.ACC.campaign[5] = 3; H.ACC.film.f6 = 1; H.persist(); H.showHub('battle'); }); await page.waitForTimeout(900);
  const j = await page.evaluate(() => ({ rv: !!document.querySelector('.rv'), kind: window.HOLDOR_GUIDE.RV.kind, id: window.HOLDOR_GUIDE.RV.id }));
  ok('stage 5 held: Robb Stark, the second champion, joins — a new reveal opens', j.rv && j.kind === 'joins' && j.id === 'robb', JSON.stringify(j));
  await page.waitForTimeout(4600); await tap('.rvnext', 600); await tap('.rvnext', 600); await tap('.rvnext', 600); await tap('.rvnext', 800);
  const jb = await page.evaluate(() => [...document.querySelectorAll('.rvcta button')].map(b => b.textContent));
  ok('a joining champion offers two ways: ride with him, or keep riding', jb.length === 2 && /RIDE WITH ROBB/.test(jb[0]) && /Keep/.test(jb[1]), JSON.stringify(jb));
  await tap('.rvcta .big', 900); const sel = await page.evaluate(() => window.HOLDOR.ACC.sel); ok('Ride with Robb sets him as the riding champion', sel === 'robb', sel);
  // skip
  await page.evaluate(() => { const H = window.HOLDOR; H.ACC.rv.joined.bran = 0; delete H.ACC.rv.joined.bran; for (let i = 1; i <= 10; i++) H.ACC.campaign[i] = 3; H.G.state = 'menu'; H.showHub('battle'); }); await page.waitForTimeout(900);
  await tap('.rvskip', 700); const sk2 = await page.evaluate(() => ({ rv: !!document.querySelector('.rv'), joined: !!window.HOLDOR.ACC.rv.joined.bran, hub: !!document.querySelector('.hubtabs') }));
  ok('Skip ends a reveal at once and marks it seen', !sk2.rv && sk2.joined && sk2.hub, JSON.stringify(sk2));
  // ---- the battle HUD: speed and the book arrive with their lessons (story accounts only)
  const hud = async (n, learn) => page.evaluate(([n, learn]) => { window.__films = 0; const H = window.HOLDOR; H.ACC.campaign = {}; for (let i = 1; i <= n; i++) H.ACC.campaign[i] = 3; H.ACC.learn = learn; H.ACC.ui = {}; H.G.state = 'menu'; H.startGame({ mode: 'campaign', level: H.LEVELS[n] }); window.HOLDOR_GUIDE.uiHud(); const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none'; const r = { speed: vis('bSpeed'), info: vis('bInfo'), pause: vis('bPause') }; H.G.lq = []; H.G.tut = null; H.G.paused = false; return r; }, [n, learn]);
  const h1 = await hud(1, { chest: 1 }), h3 = await hud(3, { chest: 1 }), h5 = await hud(5, { chest: 1 });
  ok('battle buttons arrive one at a time: stage 2 — only pause; stage 4 — speed joins; stage 6 — the book joins', !h1.speed && !h1.info && h1.pause && h3.speed && !h3.info && h3.pause && h5.speed && h5.info, JSON.stringify([h1, h3, h5]));
  const hl = await page.evaluate(() => { const H = window.HOLDOR; H.ACC.campaign = { 1: 3, 2: 3 }; H.ACC.learn = {}; H.ACC.ui = {}; H.G.state = 'menu'; H.startGame({ mode: 'campaign', level: H.LEVELS[2] }); window.HOLDOR_GUIDE.uiHud(); const before = getComputedStyle(document.getElementById('bSpeed')).display;
    H.ACC.campaign = { 1: 3, 2: 3, 3: 3 }; window.HOLDOR_GUIDE.lessonStart('speed'); const after = getComputedStyle(document.getElementById('bSpeed')).display, pop = document.getElementById('bSpeed').classList.contains('pop-in'); H.G.tut = null; H.G.paused = false; return { before, after, pop, seen: window.HOLDOR_GUIDE.uiSeen('hudspeed') }; });
  ok('the speed lesson shows the button the moment it starts (it pops), and it stays', hl.before === 'none' && hl.after !== 'none' && hl.pop && hl.seen, JSON.stringify(hl));
  // ---- an older account sees everything at once
  const old = await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('lannister', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1 }; H.setAcc(a); H.G.state = 'menu'; H.startGame({ mode: 'campaign', level: H.LEVELS[0] }); window.HOLDOR_GUIDE.uiHud(); const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none'; return { speed: vis('bSpeed'), info: vis('bInfo'), rv: window.HOLDOR_GUIDE.rvDue() }; });
  ok('an account made before the story flow keeps every button and meets no reveal', old.speed && old.info && old.rv === null, JSON.stringify(old));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
