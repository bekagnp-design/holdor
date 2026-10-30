// v1.3.8: "Challenge a friend with my build" — the share link carries the build; the receiver gets a sheet and a button for that stage.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CHAL && window.HOLDOR_BUILD, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const hub = (stages, sel) => page.evaluate(([stages, sel]) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1); for (let i = 1; i <= stages; i++) a.campaign[i] = 3; a.sel = sel; H.setAcc(a); H.persist();
    document.querySelectorAll('#ecoModal').forEach(e => { e.className = ''; e.innerHTML = ''; }); H.G.state = 'idle'; H.showHub('battle'); try { window.HOLDOR_TUT.coachEnd(); } catch (e) {} return true; }, [stages, sel]);
  // 1. round trip
  const rt = await page.evaluate(() => { const C = window.HOLDOR_CHAL, SK = window.HOLDOR.SK; const sk = Object.keys(SK).slice(5, 11).concat(['warhammer', 'howl']).filter((v, i, a) => a.indexOf(v) === i).slice(0, 7);
    const sp = C.chalEncode(12, 'robb', sk, 4, 'a1b2c3d4'); const d = C.chalDecode(sp); const sp2 = C.chalEncode(50, 'robb', sk, 35, null);
    return { sp, len: sp.length, d, sk, sp2, back: C.chalSp(sp), plain: C.chalSp('s_yt1'), nocode: C.chalDecode(sp2) }; });
  ok('encode/decode round trip', rt.d && rt.d.stage === 12 && rt.d.champ === 'robb' && rt.d.lv === 4 && JSON.stringify(rt.d.skills) === JSON.stringify(rt.sk) && rt.d.code === 'a1b2c3d4', JSON.stringify(rt.d));
  ok('startapp is short and in the allowed charset', /^[A-Za-z0-9_-]+$/.test(rt.sp) && rt.sp.length <= 64 && rt.sp2.length <= 64, rt.sp + ' ' + rt.len);
  ok('the invitation code survives as r_<code>; other params pass through', rt.back === 'r_a1b2c3d4' && rt.plain === 's_yt1' && rt.nocode && rt.nocode.code === null);
  // 2. malformed input
  const bad = await page.evaluate(() => { const C = window.HOLDOR_CHAL; return ['b_', 'b_zz', 'b_0c0000', 'b_0cffz', 'b_0c00x1zz', 'b_0c00101_zzzzzzzz', 'b_0c0010_a1b2c3d4_x', 'r_a1b2c3d4', null, '', 'b_' + 'a'.repeat(40), 'b_zzzzzzz'].map(s => C.chalDecode(s)); });
  ok('malformed links decode to null', bad.every(x => x === null), JSON.stringify(bad));
  // 3. the sheet from a simulated start
  await hub(30, 'robb');
  const op = await page.evaluate(async () => { const C = window.HOLDOR_CHAL, dbg = () => ({ tut: window.HOLDOR.ACC.tut, st: window.HOLDOR.G.state, sc: window.HOLDOR.CLOUD.screen, m: !!document.querySelector('#ecoModal.on'), cer: !!document.querySelector('#cer:not(.hidden)'), coach: window.HOLDOR_TUT.COACH.on }), sp = C.chalEncode(12, 'robb', ['warhammer', 'howl'], 3, null); const iv = setInterval(() => { try { window.HOLDOR_TUT.COACH.on && window.HOLDOR_TUT.coachEnd(); } catch (e) {} }, 150); const r = C.chalFromStart(sp); await new Promise(r => setTimeout(r, 2600));
    const m = document.querySelector('#ecoModal.on'); return { pend: !!C.CHAL.pending, tries: C.CHAL.tries, dbg: dbg(), r, on: !!m, txt: m ? m.innerText : '', btn: m ? [...m.querySelectorAll('button')].map(b => b.innerText) : [] }; });
  ok('the sheet opens with stage, build and a big button', op.r && op.on && /stage 12/.test(op.txt) && /Robb/.test(op.txt) && /battle level 3/.test(op.txt) && /Beat it/.test(op.btn[0]), JSON.stringify(op).slice(0, 300));
   await page.screenshot({ path: SC + 'challenge138.png' });
  // 4. the button starts that stage with an owned champion
  const go = await page.evaluate(() => { document.querySelector('#ecoModal button[data-i="0"]').click(); const H = window.HOLDOR; return { st: H.G.state, lvl: H.G.level && H.G.level.id, mode: H.G.mode, hero: H.G.hero && H.G.hero.c.id, sel: H.ACC.sel }; });
  ok('the button starts campaign stage 12', go.mode === 'campaign' && go.lvl === 12, JSON.stringify(go));
  ok('the champion is the receiver\'s own (selection restored)', go.sel === 'robb' && go.hero === 'robb');
  // 5. a champion the receiver does not own is not given
  await hub(30, 'robb');
  const foreign = await page.evaluate(async () => { const H = window.HOLDOR, C = window.HOLDOR_CHAL; const other = C.CHAMPS.find(c => !C.unlocked(null, c));
    const id = other.id; C.chalGo({ stage: 12, champ: id, lv: 2, skills: [] }); return { hero: H.G.hero && H.G.hero.c.id, sel: H.ACC.sel, id, lvl: H.G.level && H.G.level.id }; });
  ok('a foreign champion is not lent: own champion rides', foreign.hero === 'robb' && foreign.sel === 'robb' && foreign.lvl === 12, JSON.stringify(foreign));
  // 6. a closed stage and garbage are ignored silently
  await hub(3, 'robb');
  const closed = await page.evaluate(async () => { const C = window.HOLDOR_CHAL, H = window.HOLDOR; const a = C.chalFromStart(C.chalEncode(40, 'robb', ['howl'], 2, null)); const b = C.chalFromStart('b_zz'); await new Promise(r => setTimeout(r, 2600));
    return { a, b, modal: !!document.querySelector('#ecoModal.on'), toast: !!document.querySelector('#ecoToast.in'), pending: C.CHAL.pending, state: H.G.state }; });
  ok('a stage not open for the receiver: no sheet, no toast, no battle', closed.a === true && closed.b === false && !closed.modal && !closed.toast && closed.pending === null && closed.state !== 'play', JSON.stringify(closed));
  // 7. the build card's share link carries the build
  const lk = await page.evaluate(async () => { const H = window.HOLDOR; H.G.state = 'idle'; H.startGame({ mode: 'campaign', level: H.LEVELS.find(l => l.id === 3) }); const G = H.G; for (const k of ['warhammer', 'howl']) { G.learnAsk = [k]; window.HOLDOR_LEARN.learnPick(k); } G.hLv = 2;
    const l = await window.HOLDOR_CHAL.chalLink(); return { l, d: window.HOLDOR_CHAL.chalDecode((l.split('startapp=')[1]) || '') }; });
  ok('the build link decodes to this battle\'s stage, champion, skills, level', lk.d && lk.d.stage === 3 && lk.d.champ === 'robb' && lk.d.lv === 3 && lk.d.skills.join() === 'warhammer,howl' && /^https:\/\/t\.me\/HoldorTDBot\/play\?startapp=b_/.test(lk.l), lk.l);
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const badR = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(badR.length ? 'FAILED ' + badR.length : 'ALL OK');
  await browser.close(); process.exit(badR.length ? 1 : 0);
})();
