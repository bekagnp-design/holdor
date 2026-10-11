// v1.1.0: house troops. Every house has four soldiers of its own (foot, archer, rider, the house unit) with its names and colours; the
// Train room shows them drawn and picks who holds the Watch keeps; a keep's men take that role: archers shoot from 95 px, riders are
// fast, the house units keep their tricks (bites twice, half damage, stun, never flinches, loot, mends, poison).
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 400 : ms); };
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_TROOPS, { timeout: 20000 }); await page.waitForTimeout(400);
  // ---- the data: 7 houses × 4 roles, every name its own, every house unit with a trick
  const data = await page.evaluate(() => { const T = window.HOLDOR_TROOPS; const names = [], tricks = []; for (const h of window.HOLDOR_TROOPS.HOUSE_ORDER) { for (const u of T.troopUnits({ house: h })) names.push(u.n); const hu = T.TROOPS[h].house; tricks.push(!!(hu.rate || hu.armor || hu.stun || hu.steady || hu.loot || hu.mend || hu.poison)); }
    return { n: names.length, uniq: new Set(names).size, tricks: tricks.filter(Boolean).length, roles: T.TROOP_ROLES.join() }; });
  ok('7 houses × 4 roles = 28 troops, every name its own, every house unit with a trick', data.n === 28 && data.uniq === 28 && data.tricks === 7 && data.roles === 'foot,archer,rider,house', JSON.stringify(data));
  // ---- the Train room: four drawn troops, the foot holds the keeps, a tap picks the archer; the house unit after level 5
  const setup = (house, lvl, keep) => page.evaluate(([house, lvl, keep]) => { const H = window.HOLDOR; const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1 }; for (let i = 1; i <= 12; i++) a.campaign[i] = 3; a.gold = 5000; a.army = { lvl, keep }; H.setAcc(a); H.persist(); }, [house, lvl, keep]);
  await setup('stark', 1, null);
  await page.evaluate(() => window.HOLDOR_TROOPS.showTrain()); await page.waitForTimeout(500);
  const pix = () => page.evaluate(() => [...document.querySelectorAll('canvas.tpv')].map(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; }));
  const tr = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, cards: [...document.querySelectorAll('.sitem.troop')].map(e => e.dataset.r + (e.classList.contains('on') ? '*' : '') + (e.classList.contains('lock') ? '!' : '')), names: [...document.querySelectorAll('.sitem.troop b')].map(b => b.textContent) }));
  const px = await pix();
  ok('the Train room shows the four Stark troops by name, drawn (every picture has pixels), the foot holding the keeps, the Direwolf locked at level 1', tr.scr === 'train' && tr.cards.join() === 'foot*,archer,rider,house!' && tr.names.join() === 'Winterfell guard,Northern bowman,Northern rider,Direwolf' && px.length === 4 && px.every(n => n > 150), JSON.stringify([tr, px]));
  await page.screenshot({ path: SC + 'troops100_train.png' });
  await tap('.sitem.troop[data-r="archer"]', 500);
  const kp = await page.evaluate(() => ({ keep: window.HOLDOR.ACC.army.keep, on: (document.querySelector('.sitem.troop.on') || {}).dataset.r, role: window.HOLDOR_TROOPS.keepRole() }));
  ok('a tap on the archer makes him the keeps\' garrison (saved on the account)', kp.keep === 'archer' && kp.on === 'archer' && kp.role === 'archer', JSON.stringify(kp));
  await tap('.sitem.troop[data-r="house"]', 300);
  const lk = await page.evaluate(() => ({ keep: window.HOLDOR.ACC.army.keep, role: window.HOLDOR_TROOPS.keepRole() }));
  ok('the locked house unit cannot be picked at level 1', lk.keep === 'archer' && lk.role === 'archer', JSON.stringify(lk));
  await setup('lannister', 5, 'house'); await page.evaluate(() => window.HOLDOR_TROOPS.showTrain()); await page.waitForTimeout(400);
  const ln = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.sitem.troop')].map(e => e.dataset.r + (e.classList.contains('on') ? '*' : '') + (e.classList.contains('lock') ? '!' : '')), names: [...document.querySelectorAll('.sitem.troop b')].map(b => b.textContent), role: window.HOLDOR_TROOPS.keepRole() }));
  ok('House Lannister at level 5: its own names, the Lion Guard open and holding the keeps', ln.cards.join() === 'foot,archer,rider,house*' && ln.names.join() === 'Red cloak,Westerland crossbowman,Lannister knight,Lion Guard' && ln.role === 'house', JSON.stringify(ln));
  // ---- every house × role drawn: pixels, and the houses differ in colour
  const art = await page.evaluate(() => { const H = window.HOLDOR, T = window.HOLDOR_TROOPS; const cv = document.createElement('canvas'); cv.width = cv.height = 96; const out = {}; const cols = {};
    for (const h of window.HOLDOR_TROOPS.HOUSE_ORDER) for (const r of T.TROOP_ROLES) { T.troopPreview(cv, h, r); const d = cv.getContext('2d').getImageData(0, 0, 96, 96).data; let n = 0; const set = new Set(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { n++; set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); } out[h + ':' + r] = n; if (r === 'foot') cols[h] = set; }
    const near = (h) => { const hc = window.HOLDOR_TROOPS.HOUSES[h].col, r0 = parseInt(hc.slice(1, 3), 16), g0 = parseInt(hc.slice(3, 5), 16), b0 = parseInt(hc.slice(5, 7), 16); T.troopPreview(cv, h, 'foot'); const d = cv.getContext('2d').getImageData(0, 0, 96, 96).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) < 60) n++; return n; };
    const own = {}; for (const h of window.HOLDOR_TROOPS.HOUSE_ORDER) own[h] = near(h); const a = cols.stark, b = cols.lannister; let common = 0; for (const c of a) if (b.has(c)) common++; return { min: Math.min(...Object.values(out)), n: Object.keys(out).length, common, sa: a.size, sb: b.size, own }; });
  ok('all 28 troops draw (≥ 300 opaque pixels each); every house\'s foot wears its own colour (≥ 60 pixels of it); a Stark foot and a Lannister foot share under 60% of their colours', art.n === 28 && art.min >= 300 && Object.values(art.own).every(n => n >= 60) && art.common < Math.min(art.sa, art.sb) * 0.6, JSON.stringify(art));
  // ---- in battle: a keep's men take the role — archers shoot from 95 px
  const keepMen = (house, lvl, keep) => page.evaluate(([house, lvl, keep]) => { const H = window.HOLDOR, G = H.G; const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 12; i++) a.campaign[i] = 3; a.army = { lvl, keep }; H.setAcc(a); G.state = 'menu'; H.startGame({ mode: 'campaign', level: window.HOLDOR_TROOPS.LEVELS[8] }); G.waveDone = false; G.gold = 3000;
    const R0 = G.map.routes[0], q = H.posAt(G.map, R0.total - 140, 0); const s = G.map.slots.filter(x => !x.tower).sort((p, r) => Math.hypot(p.x - q.x, p.y - q.y) - Math.hypot(r.x - q.x, r.y - q.y))[0]; window.HOLDOR_TROOPS.build(s, 'keep'); G.hero.x = -900; G.hero.y = -900; G.hero.tx = null;
    for (let i = 0; i < 60 * 14; i++) H.step(); const men = G.allies.filter(x => x.home === s.id); return { n: men.length, roles: [...new Set(men.map(x => x.role))], troop: [...new Set(men.map(x => x.troop))], range: men[0] && men[0].range, rate: men[0] && men[0].rate, spd: men[0] && men[0].spd, slot: s.id, trick: men[0] && (men[0].armor || men[0].stun || men[0].steady || men[0].loot || men[0].mend || men[0].poison || men[0].beast) }; }, [house, lvl, keep]);
  const km = await keepMen('stark', 1, 'archer');
  ok('a Stark keep garrisoned by archers: every man an archer of House Stark with 95 px reach', km.n >= 2 && km.roles.join() === 'archer' && km.troop.join() === 'stark' && km.range === 95, JSON.stringify(km));
  const shoot = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, S = window.HOLDOR_CASTLE; const a = G.allies.find(x => x.role === 'archer'); const R0 = G.map.routes[0]; let best = null, bd = 1e9;
    for (let p = 10; p < R0.total - 20; p += 2) { const q = H.posAt(G.map, p, 0); const d = Math.hypot(q.x - a.x, q.y - a.y); if (d >= 60 && d <= 85 && Math.abs(d - 72) < bd) { bd = Math.abs(d - 72); best = p; } }
    if (best == null) return { none: true }; S.spawn('sword', best, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 6000; const h0 = e.hp; let arrows = 0, nearest = 1e9; const seen = new Set();
    for (let i = 0; i < 90; i++) { e.prog = best; e.stunT = 0; H.step(); for (const f of G.fx) if (f.t === 'arrow' && f.x === a.x && !seen.has(f)) { seen.add(f); arrows++; } const q = H.posAt(G.map, e.prog, 0); nearest = Math.min(nearest, ...G.allies.map(x => Math.hypot(q.x - x.x, q.y - x.y))); }
    return { lost: Math.round(h0 - e.hp), arrows, nearest: Math.round(nearest), dist: Math.round(Math.hypot(H.posAt(G.map, best, 0).x - a.x, H.posAt(G.map, best, 0).y - a.y)) }; });
  ok('an archer hits a wight 60–85 px away (no man within melee reach) and arrows fly', !shoot.none && shoot.lost > 0 && shoot.arrows > 0 && shoot.nearest > 40, JSON.stringify(shoot));
  await page.screenshot({ path: SC + 'troops100_battle.png' });
  const rd = await keepMen('stark', 1, 'rider'); ok('riders are fast (spd > 90)', rd.roles.join() === 'rider' && rd.spd > 90, JSON.stringify(rd));
  // ---- the house tricks in the keeps (army level 5, the house unit garrisoned)
  const trick = async (house, fn) => { const km = await keepMen(house, 5, 'house'); const r = await page.evaluate(fn); return Object.assign({ role: km.roles.join(), trick: km.trick }, r); };
  const adj = `const H=window.HOLDOR,G=H.G,S=window.HOLDOR_CASTLE;const a=G.allies.find(x=>x.role==='house');const R0=G.map.routes[0];let best=null,bd=1e9;for(let p=10;p<R0.total-20;p+=1){const q=H.posAt(G.map,p,0);const d=Math.hypot(q.x-a.x,q.y-a.y);if(d<bd){bd=d;best=p;}}S.spawn('sword',best,0);const e=G.enemies[G.enemies.length-1];e.hp=e.max=6000;`;
  const st = await trick('stark', `(()=>{${adj}const h0=e.hp;for(let i=0;i<60;i++){e.prog=best;H.step();}return{hits:Math.round((h0-e.hp)/a.dmg*10)/10,rate:a.rate};})()`);
  ok('Direwolf: bites twice a second (≥ 2 bites in 1 s, rate 0.4)', st.role === 'house' && st.rate === 0.4 && st.hits >= 2, JSON.stringify(st));
  const ba = await trick('baratheon', `(()=>{${adj}for(let i=0;i<60;i++){e.prog=best;H.step();if(e.stunT>0)break;}return{stun:e.stunT};})()`);
  ok('Stormhammer: its blow stuns', ba.role === 'house' && ba.stun > 0, JSON.stringify(ba));
  const ma = await trick('martell', `(()=>{${adj}for(let i=0;i<60;i++){e.prog=best;H.step();if(e.poison)break;}return{poison:e.poison&&e.poison.dps};})()`);
  ok('Sand Snake: its spear poisons (4 a second)', ma.role === 'house' && ma.poison === 4, JSON.stringify(ma));
  const gj = await trick('greyjoy', `(()=>{${adj}e.hp=e.max=1;e.gold=10;const g0=G.gold;for(let i=0;i<60;i++){e.prog=best;H.step();if(e.hp<=0)break;}return{gold:G.gold-g0,dead:e.hp<=0,loot:a.loot};})()`);
  ok('Reaver: steals 3 gold on top of the kill', gj.role === 'house' && gj.dead && gj.loot === 3 && gj.gold >= 13, JSON.stringify(gj));
  const la = await trick('lannister', `(()=>{${adj}const hp0=a.hp;let blow=0;for(let i=0;i<90;i++){e.prog=best;H.step();if(a.hp<hp0-0.01){blow=Math.round((hp0-a.hp)*100)/100;break;}}return{blow,expect:Math.round(e.dps*0.7*0.5*100)/100,armor:a.armor};})()`);
  ok('Lion Guard: takes half the blow', la.role === 'house' && la.armor === 0.5 && la.blow > 0 && Math.abs(la.blow - la.expect) < 0.05, JSON.stringify(la));
  const ta = await trick('targaryen', `(()=>{${adj}e.knock=1;const hp0=a.hp;let hit=false;for(let i=0;i<90;i++){e.prog=best;H.step();if(a.hp<hp0-0.01){hit=true;break;}}return{hit,stun:a.stunT||0,steady:a.steady};})()`);
  ok('Unsullied: a knocking blow does not stun them', ta.role === 'house' && ta.steady === 1 && ta.hit && !ta.stun, JSON.stringify(ta));
  const ty = await trick('tyrell', `(()=>{const H=window.HOLDOR,G=H.G;const men=G.allies.filter(x=>x.role==='house');const a=men[0],o=men[1]||men[0];o.hp=o.max-40;const h0=o.hp;for(let i=0;i<60;i++)H.step();return{gain:Math.round((o.hp-h0)*10)/10,mend:a.mend,two:men.length>=2};})()`);
  ok('Rose Knight: mends the man beside it (≥ 11 in a second: 7 rest + 6 mend × ½ s ticks)', ty.role === 'house' && ty.mend === 6 && ty.gain >= 11, JSON.stringify(ty));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
