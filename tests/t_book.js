// v1.0.50: the Book (encyclopedia) and ranks — real taps where it matters.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_BOOK, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tapEl = async (sel) => { await page.locator(sel).first().tap(); await page.waitForTimeout(350); };
  const txt = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);
  // fresh account: 7 first champions + Arrow rain are "new" in the book
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; H.setAcc(a); H.persist(); H.showHub('coll'); });
  await page.waitForTimeout(500);
  const n0 = await page.evaluate(() => window.HOLDOR_BOOK.bookNewCount());
  ok('fresh new count', n0 === 8, n0);
  ok('coll tab dot', await page.evaluate(() => !!document.querySelector('.hubtabs button[data-tab="coll"] .dot')));
  ok('book subtab badge', (await txt('.subtabs button[data-sub="book"]') || '').replace(/\s/g, '').toLowerCase() === 'book8', await txt('.subtabs button[data-sub="book"]'));
  await tapEl('.subtabs button[data-sub="book"]');
  ok('book opened', await page.evaluate(() => !!document.querySelector('.bookfs') && window.HOLDOR.CLOUD.screen === 'book'));
  ok('towers page empty text', /Build one in battle/.test(await txt('#bkDetail')));
  await page.screenshot({ path: SC + 'bk_fresh.png' });
  // seed a played account: enemies met, towers built, 10 stages held
  await page.evaluate(() => { const H = window.HOLDOR, a = H.ACC; for (let i = 1; i <= 10; i++) a.campaign[i] = 3; a.stats.onlineBest = 15; a.seen = { axe: { g: 1, w: 1, n: 40 }, sword: { g: 1, w: 3, n: 12 }, walker: { g: 9, w: 6, n: 2 }, dragon: { g: 6, w: 9, n: 1 } }; a.kc = { axe: 39, walker: 1 }; a.tseen = { watch: 3, glass: 1, keep: 2 }; a.tlog = { 'watch:1': 1, 'watch:2': 3, 'watch:3': 8, 'glass:1': 2, 'keep:1': 4, 'keep:2': 9 }; a.tlv = { watch: 5 }; a.learn = Object.assign(a.learn || {}, { hubChest: 1, hubHold: 1, hubChamp: 1, chest: 1, hold: 1, champ: 1, newchamp: 1 }); a.champs.brienne = { lvl: 12, sk: [3, 2, 1], tal: 1 }; H.persist(); H.showHub('coll'); });
  await page.waitForTimeout(400);
  const n1 = await page.evaluate(() => window.HOLDOR_BOOK.bookNewCount());
  // 3 towers + 4 enemies + champs up to tier 3 (7 houses × 4 = 28) + 3 spells = 38
  ok('seeded new count', n1 === 31, n1);
  await tapEl('.subtabs button[data-sub="book"]');
  const det = await txt('#bkDetail');
  ok('first new tower shown', /Watchtower/.test(det) && /NEW/.test(det), det.slice(0, 60));
  ok('tier chronicle', /Tier III first reached at/.test(det), det.match(/Tier .*? first reached at [^·]*/) ? det.match(/Tier .*? first reached at [^·]*/)[0] : '');
  ok('tier IV locked hint', /tier IV in battle to reveal|Tier IV opens after stage/.test(det));
  ok('level line', /Your level 5 of 16/i.test(det) && /\+12% power/i.test(det));
  ok('milestone done', /✓ \+8% range/.test(det));
  ok('good/weak chips', /Good against/i.test(det) && /Weak against/i.test(det));
  const tiles = await page.evaluate(() => [...document.querySelectorAll('#bkGrid .bktile')].map(b => b.dataset.k + ':' + (b.classList.contains('unk') ? (b.textContent.trim() || 'unk') : 'img') + (b.querySelector('.nw') ? '*' : '')));
  ok('tower tiles', tiles.join(' ') === 'watch:img scorp:? wild:? glass:img* weir:🔒 keep:img*', tiles.join(' '));
  // tier chips: tap II → numbers for tier II; tap IV (locked) does nothing
  await tapEl('#bkDetail [data-tier="2"]');
  ok('tier II selected', await page.evaluate(() => document.querySelector('#bkDetail [data-tier="2"]').classList.contains('on')));
  await tapEl('#bkDetail [data-tier="4"]');
  ok('tier IV stays locked', await page.evaluate(() => !document.querySelector('#bkDetail [data-tier="4"]').classList.contains('on')));
  await page.screenshot({ path: SC + 'bk_towers.png' });
  // read Dragonglass
  await tapEl('#bkGrid .bktile[data-k="glass"]');
  const gl = await txt('#bkDetail');
  ok('glass explained', /ring of obsidian spears/.test(gl) && /×3 against White Walkers/.test(gl) && /bleed inside/i.test(gl), gl.slice(0, 80));
  const n2 = await page.evaluate(() => window.HOLDOR_BOOK.bookNewCount('towers'));
  ok('reading clears NEW', n2 === 1, n2);
  ok('ribbon badge updated', (await txt('.bkrib[data-tab="towers"]') || '').replace(/\s/g, '').toLowerCase() === 'towers1', await txt('.bkrib[data-tab="towers"]'));
  // enemies
  await tapEl('.bkrib[data-tab="enemies"]');
  const en = await txt('#bkDetail');
  ok('enemies first new', /Wight axeman/.test(en) && /First met at Sunspear, wave 1/.test(en) && /slain 39/.test(en), en.slice(0, 80));
  const pg = await txt('#bkPg');
  ok('enemy pages', pg === '1/3', pg);
  await tapEl('#bkNext');
  ok('page 2', (await txt('#bkPg')) === '2/3');
  const et = await page.evaluate(() => [...document.querySelectorAll('#bkGrid .bktile')].map(b => b.dataset.k + (b.classList.contains('unk') ? '?' : '!')).join(' '));
  ok('page 2 tiles', /giant\? spider\? brood\? raven\?/.test(et) && /walker!/.test(et), et);
  await tapEl('#bkGrid .bktile[data-k="walker"]');
  const wk = await txt('#bkDetail');
  ok('walker page', /White Walker/.test(wk) && /Ice armour/.test(wk) && /Dragonglass ×3/.test(wk) && /freezes towers/i.test(wk), wk.slice(0, 100));
  await page.screenshot({ path: SC + 'bk_enemies.png' });
  await tapEl('#bkGrid .bktile[data-k="giant"]');
  ok('unknown enemy page', /Unknown/.test(await txt('#bkDetail')));
  // champions: own house first, locked ones hidden, other houses readable
  await tapEl('.bkrib[data-tab="champs"]');
  const ct = await page.evaluate(() => [...document.querySelectorAll('#bkGrid .bktile')].map(b => b.dataset.k + (b.classList.contains('unk') ? '?' : b.classList.contains('oth') ? '~' : '!')).join(' '));
  ok('champ tiles', /^brienne! robb! bran! sansa\? ned\? arya\? jon\? kevan~/.test(ct), ct);
  const cp = await txt('#bkPg'); ok('champ pages', cp === '1/4', cp);
  await tapEl('#bkGrid .bktile[data-k="brienne"]');
  const jd = await txt('#bkDetail');
  ok('brienne page', /Brienne/.test(jd) && /Challenge/.test(jd) && /Bloodletting/.test(jd) && /ULTIMATE/.test(jd) && /rank 3\/5/.test(jd) && /level 12/i.test(jd) && /Talents/i.test(jd), jd.slice(0, 80));
  await page.screenshot({ path: SC + 'bk_champs.png' });
  const lockedTile = await page.evaluate(() => { const b = [...document.querySelectorAll('#bkGrid .bktile.unk')][0]; return b ? b.dataset.k : null; });
  if (lockedTile) { await tapEl('#bkGrid .bktile[data-k="' + lockedTile + '"]'); ok('locked champ page', /Rides out after stage/.test(await txt('#bkDetail')), lockedTile); }
  // spells
  await tapEl('.bkrib[data-tab="spells"]');
  await tapEl('#bkGrid .bktile[data-k="fire"]');
  const sp = await txt('#bkDetail');
  ok('dracarys page', /Dracarys/.test(sp) && /400/.test(sp) && /recharge/i.test(sp), sp.slice(0, 80));
  // notes
  await tapEl('.bkrib[data-tab="notes"]');
  const notes = await page.evaluate(() => document.querySelectorAll('.bknote').length);
  ok('notes', notes === 11, notes);
  await page.screenshot({ path: SC + 'bk_notes.png' });
  // close -> Collection
  await tapEl('#bkX');
  ok('closed to collection', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'hub:coll'));
  // ranks: trophies = 30 stars + 2*15 = 60 -> Bronze
  const rk = await page.evaluate(() => { const B = window.HOLDOR_BOOK; return { tr: B.trophiesOf(), r: B.myRank().full, iron: B.rankOf(0).full, silver: B.rankOf(92).full, gm: B.rankOf(450).full, ch: B.rankOf(450, 3).full, chip: document.querySelector('#hubRank').innerText.trim() }; });
  ok('trophies', rk.tr === 60, rk.tr);
  ok('rank bronze', rk.r === 'Bronze II' && /Bronze II$/.test(rk.chip), JSON.stringify(rk));
  ok('rank ladder', rk.iron === 'Iron IV' && rk.silver === 'Silver III' && rk.gm === 'Grandmaster' && rk.ch === 'Challenger', JSON.stringify(rk));
  await tapEl('#hubRank');
  const rs = await page.evaluate(() => document.querySelector('#card').innerText);
  ok('rank sheet', /Bronze II/.test(rs) && /60 trophies/.test(rs) && /15 more for Silver/.test(rs) && /Challenger/.test(rs), rs.slice(0, 80));
  await page.screenshot({ path: SC + 'bk_rank.png' });
  await tapEl('#bOk');
  ok('back on battle', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'hub:battle'), await page.evaluate(() => window.HOLDOR.CLOUD.screen + ' | ' + (document.querySelector('#card').innerText || '').slice(0, 80).replace(/\n/g, ' ')));
  if (!(await page.evaluate(() => !!document.querySelector('#hubTro')))) { console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors); await page.screenshot({ path: SC + 'bk_dbg.png' }); await browser.close(); return; }
  const tro = await txt('#hubTro'); ok('battle trophies', /60$/.test((tro || '').trim()), tro);
  await page.screenshot({ path: SC + 'bk_hub.png' });
  await tapEl('#hubTro');
  ok('trophy row opens sheet', /The ladder/.test(await page.evaluate(() => document.querySelector('#card').innerText)));
  await tapEl('#bOk');
  // in battle: ! opens the book paused, Back resumes
  await page.evaluate(() => { const H = window.HOLDOR; H.startGame({ level: 2 }); });
  await page.waitForTimeout(600);
  await tapEl('#bInfo');
  const inb = await page.evaluate(() => ({ book: !!document.querySelector('.bookfs'), paused: window.HOLDOR.G.paused, tab: window.HOLDOR_BOOK.BOOK.tab }));
  ok('book from battle', inb.book && inb.paused && inb.tab === 'notes', JSON.stringify(inb));
  await tapEl('#bOk');
  const after = await page.evaluate(() => ({ hidden: document.querySelector('#overlay').classList.contains('hidden'), paused: window.HOLDOR.G.paused, state: window.HOLDOR.G.state }));
  ok('back to battle', after.hidden && !after.paused && after.state === 'play', JSON.stringify(after));
  // building a tower writes the chronicle
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; const s = G.map.slots.find(x => !x.tower); G.gold = 999; H.buildAt ? H.buildAt(s, 'scorp') : null; });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
