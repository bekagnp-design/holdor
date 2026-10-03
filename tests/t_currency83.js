// v1.0.83: the currencies redrawn. Gold is a gold-dragon coin and dragonglass an obsidian shard (both drawn, with gradients); the
// emoji 💎 and 🪙 that the game writes into its texts turn into the same drawings as they reach the screen, and nowhere else.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_HOME, { timeout: 20000 }); await page.waitForTimeout(400);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 };
    a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; a.gold = 1234; a.gems = 56; H.setAcc(a); H.showHub('battle'); });
  await page.waitForTimeout(600);
  const top = await page.evaluate(() => { const s = document.querySelectorAll('.hubtop .cur > span'); return [s[0].innerHTML.includes('hgC'), s[1].innerHTML.includes('hdA')]; });
  ok('the top bar shows the gold-dragon coin and the obsidian shard', top[0] && top[1], JSON.stringify(top));
  await page.evaluate(() => { const d = document.createElement('p'); d.id = 'tcur'; d.textContent = 'You got +25 💎 and +300 🪙 today'; document.getElementById('hubBody').appendChild(d);
    const t = document.createElement('textarea'); t.id = 'tcur2'; t.value = 'keep 💎 here'; document.body.appendChild(t); });
  await page.waitForTimeout(100);
  const sw = await page.evaluate(() => ({ text: document.getElementById('tcur').textContent, cic: document.querySelectorAll('#tcur .cic').length, gem: !!document.querySelector('#tcur .cic svg'), ta: document.getElementById('tcur2').value }));
  ok('emoji written into a text become the drawings, the words stay', sw.cic === 2 && sw.gem && sw.text === 'You got +25  and +300  today', JSON.stringify(sw));
  ok('a text field keeps what the player typed', sw.ta === 'keep 💎 here');
  await page.evaluate(() => { document.getElementById('tcur').firstChild.nodeValue = 'now +7 💎'; }); await page.waitForTimeout(100);
  ok('a text that changes later is swapped too', await page.evaluate(() => document.querySelectorAll('#tcur .cic').length >= 1 && !/💎/.test(document.getElementById('tcur').textContent)));
  await page.evaluate(() => window.HOLDOR.showHub('shop')); await page.waitForTimeout(800);
  ok('the shop has no emoji left for the currencies', await page.evaluate(() => !/💎|🪙/.test(document.getElementById('hubBody').innerText)));
  await page.screenshot({ path: SC + 'currency83_shop.png' });
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
