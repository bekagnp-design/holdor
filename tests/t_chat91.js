// v1.0.91 (+ the Legendary drop line of v1.0.92): the realm chat screen, with real taps against an in-memory fake of the server's chat functions (the real ones are tested in
// backend/test/v23_test.py). The realm card of the player's own realm has the 💬 button; the chat lists the realm's messages, a typed
// message goes out and shows as "mine", the server's refusals show under the box, another player's message offers Report / Block, block
// clears the list and asks again, and a guest sees that the chat needs the online backend.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CHAT, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CHAT.CHAT; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; H.setAcc(a);
    const now = Date.now(); window.__db = [{ id: 1, name: 'Arya', house: 'stark', body: 'Winter is coming', at: new Date(now - 90000).toISOString(), mine: false },
      { id: 2, name: 'Sansa', house: 'stark', body: 'Anyone for the Hold?', at: new Date(now - 30000).toISOString(), mine: false }]; window.__calls = []; window.__refuse = null;
    C.rpc = (fn, a) => { window.__calls.push([fn, a]); if (window.__refuse && fn === 'chat_send') return Promise.reject(new Error(window.__refuse));
      if (fn === 'chat_list') return Promise.resolve({ realm: 0, msgs: window.__db.filter(m => m.id > (a.since || 0)) });
      if (fn === 'chat_send') { const id = window.__db.length + 1; window.__db.push({ id, name: 'Me', house: 'stark', body: a.body, at: new Date().toISOString(), mine: true }); return Promise.resolve({ id }); }
      if (fn === 'chat_block') { window.__db = window.__db.filter(m => m.id !== a.msg); return Promise.resolve({ ok: true }); }
      return Promise.resolve({ ok: true }); };
    window.HOLDOR_REALMS.showRealmCard(a.langI); });
  await page.waitForTimeout(500);
  const hasBtn = await page.evaluate(() => !!document.getElementById('bRcChat'));
  ok('the realm card of my own realm has the 💬 Realm chat button', hasBtn);
  await page.locator('#bRcChat').tap(); await page.waitForTimeout(600);
  const A = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#chList .chm')].map(r => r.querySelector('b').textContent + ': ' + r.querySelector('.cb span').textContent), screen: window.HOLDOR_CHAT.CHAT && document.getElementById('chIn') ? 'chat' : '', mine: document.querySelectorAll('.chm.me').length }));
  await page.screenshot({ path: SC + 'chat91_list.png' });
  ok('the chat lists the realm\'s messages with names', A.rows.length === 2 && A.rows[0] === 'Arya: Winter is coming' && A.screen === 'chat', JSON.stringify(A));
  await page.locator('#chIn').fill('Hold the door!'); await page.locator('#chSend').tap(); await page.waitForTimeout(700);
  const B = await page.evaluate(() => ({ mine: [...document.querySelectorAll('.chm.me .cb span')].map(e => e.textContent), val: document.getElementById('chIn').value, sent: window.__calls.filter(c => c[0] === 'chat_send').map(c => c[1].body) }));
  ok('a message goes out, shows as mine, the box is cleared', B.sent.join() === 'Hold the door!' && B.mine.join() === 'Hold the door!' && B.val === '', JSON.stringify(B));
  await page.evaluate(() => { window.__refuse = 'slow down'; }); await page.locator('#chIn').fill('too fast'); await page.locator('#chSend').tap(); await page.waitForTimeout(400);
  const Cn = await page.evaluate(() => ({ note: document.getElementById('chNote').textContent, err: document.getElementById('chNote').classList.contains('err'), val: document.getElementById('chIn').value }));
  ok('the server\'s refusal shows under the box and the text stays', Cn.note === 'slow down' && Cn.err && Cn.val === 'too fast', JSON.stringify(Cn));
  await page.evaluate(() => { window.__refuse = null; document.getElementById('chIn').value = ''; });
  // another player's message: tap → report / block
  await page.locator('#chList .chm', { hasText: 'Winter is coming' }).tap(); await page.waitForTimeout(300);
  const D = await page.evaluate(() => [...document.querySelectorAll('#ecoModal .eb button')].map(b => b.textContent.trim()));
  await page.screenshot({ path: SC + 'chat91_actions.png' });
  ok('tapping another player\'s message offers Report and Block', D.length === 3 && /Report/.test(D[0]) && /Block/.test(D[1]), JSON.stringify(D));
  await page.locator('#ecoModal .eb button').nth(0).tap(); await page.waitForTimeout(300);
  ok('Report sends the message id', await page.evaluate(() => window.__calls.some(c => c[0] === 'chat_report' && c[1].msg === 1)));
  await page.locator('#chList .chm', { hasText: 'Winter is coming' }).tap(); await page.waitForTimeout(300);
  await page.locator('#ecoModal .eb button').nth(1).tap(); await page.waitForTimeout(700);
  const E = await page.evaluate(() => ({ blocked: window.__calls.some(c => c[0] === 'chat_block' && c[1].msg === 1), rows: [...document.querySelectorAll('#chList .chm .cb span')].map(e => e.textContent) }));
  ok('Block hides that player\'s messages (the list is fetched again without them)', E.blocked && !E.rows.includes('Winter is coming') && E.rows.includes('Anyone for the Hold?'), JSON.stringify(E));
  await page.locator('#chList .chm.me').first().tap(); await page.waitForTimeout(250);
  ok('my own message has no report / block menu', await page.evaluate(() => !document.getElementById('ecoModal').classList.contains('on')));
  // polling: a new message arrives by itself
  await page.evaluate(() => { window.__db.push({ id: 99, name: 'Jon', house: 'stark', body: 'Eyes north', at: new Date().toISOString(), mine: false });
    window.__db.push({ id: 100, name: 'Daenerys', house: 'targaryen', body: 'weapon:11:dragon', kind: 'drop', at: new Date().toISOString(), mine: false }); });
  await page.waitForTimeout(4600);
  const DR = await page.evaluate(() => { const d = document.querySelector('#chList .chm.drop'); return d && { txt: d.textContent.replace(/\s+/g, ' '), svg: !!d.querySelector('.ic svg') }; });
  await page.screenshot({ path: SC + 'chat91_drop.png' });
  ok('a Legendary drop shows as a gold line with the item\'s picture (v1.0.92)', DR && /Daenerys/.test(DR.txt) && /found a Legendary/.test(DR.txt) && /Greatsword/.test(DR.txt) && DR.svg, JSON.stringify(DR));
  await page.locator('#chList .chm.drop').tap(); await page.waitForTimeout(250);
  ok('a drop line has no report / block menu', await page.evaluate(() => !document.getElementById('ecoModal').classList.contains('on')));
  ok('the screen polls: a message from someone else appears by itself', await page.evaluate(() => [...document.querySelectorAll('#chList .cb span')].some(e => e.textContent === 'Eyes north')));
  // leaving stops the polling
  await page.locator('#bBack').tap(); await page.waitForTimeout(300);
  const n0 = await page.evaluate(() => window.__calls.length); await page.waitForTimeout(4600);
  ok('leaving the chat stops the polling', await page.evaluate(n => window.__calls.length === n, n0));
  // a guest (no rpc, no backend)
  await page.evaluate(() => { window.HOLDOR_CHAT.CHAT.rpc = null; window.HOLDOR_CHAT.showChat(() => {}); }); await page.waitForTimeout(300);
  ok('a guest sees that the chat needs the online backend', await page.evaluate(() => /needs the online backend/.test(document.body.textContent) && !document.getElementById('chIn')));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
