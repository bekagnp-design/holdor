// tests/rpg/lib.js — shared helpers for every HOLDOR RPG Playwright suite (A40).
//
//   const L = require('./lib');
//   L.build();                                          // python3 src/build_rpg.py beta/index.html (skipped with RPG_NOBUILD=1 or RPG_HTML=…)
//   const { page, errors, cerrs, close } = await L.launch();
//   const b = await L.boot(page, { save: L.fakeSave({ house: 'stark', cls: 'knight', lvl: 3 }) });   // b = {running, cur, booted, screens, sys, data, …}
//   await L.steps(page, 60);                            // 60 fixed steps = 1 game second, not real time
//   const release = await L.joystick(page, 90, 0, 250); await L.steps(page, 60); await release();     // a real touch drag, held until release()
//   await L.tap(page, '#btnMap');                       // real tap; false when the selector matches nothing
//   const sel = await L.findBtn(page, 'map', '#ui');    // a visible control whose id / class / data-* / aria-label / title / short text matches → selector or null
//   await L.shot(page, 'name');                         // → .shots/rpg/name.png
//   L.ok('what', cond, info); L.skip('what', 'why'); await close(); L.report();   // report() exits 1 when anything FAILed
//
// Env: CHROMIUM_PATH (default /opt/pw-browsers/chromium-1243/chrome-linux64/chrome), RPG_HTML (page to test, default beta/index.html),
//      RPG_NOBUILD (skip the build), RPG_BOOT_WAIT (ms to wait for R.running || R.ui.cur, default 5000).
'use strict';
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const SHOTS = path.join(ROOT, '.shots', 'rpg');
const HTML = () => path.resolve(ROOT, process.env.RPG_HTML || path.join('beta', 'index.html'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- build ---- */
function build(out) {
  if (process.env.RPG_NOBUILD) return HTML();
  if (!out && process.env.RPG_HTML) { console.log('build: RPG_HTML set, testing ' + HTML() + ' as it is'); return HTML(); }
  out = out || path.join(ROOT, 'beta', 'index.html');
  const r = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), out], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('build_rpg.py failed: ' + ((r.stderr || '') + (r.stdout || '')).trim());
  return out;
}

/* ---- browser ---- */
async function launch(o = {}) {
  const { chromium } = require('playwright');
  // the world renders in WebGL (three.js into #gl, #c is the 2D overlay): software GL so headless Chromium draws it
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.route(/telegram\.org/, r => r.abort());   // the Telegram SDK include: the proxy blocks it and it slows the load
  const errors = [], cerrs = [];
  page.on('pageerror', e => errors.push('PE:' + e.message));
  page.on('console', m => { if (m.type() === 'error') cerrs.push(m.text()); });
  page.setDefaultTimeout(15000);
  return { browser, ctx, page, errors, cerrs, close: () => browser.close().catch(() => {}) };
}

/* ---- boot ----
   o.save: an R.state object injected into localStorage 'holdor_rpg' BEFORE the page loads (once per boot: a later page.reload() keeps what
           the game saved); null removes the key; undefined leaves storage alone.   o.html: page path.   o.wait: ms for R.running || R.ui.cur.
   Returns {version, running, cur, booted, state, player, screens, sys, data}. Throws only when window.R never appears, saying why. */
let injN = 0;
async function boot(page, o = {}) {
  if (o.save !== undefined) {
    const key = 'rpg_inj_' + (++injN) + '_' + Date.now();
    await page.addInitScript(([k, s]) => { try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); if (s) localStorage.setItem('holdor_rpg', JSON.stringify(s)); else localStorage.removeItem('holdor_rpg'); } catch (e) {} }, [key, o.save]);
  }
  await page.goto('file://' + path.resolve(ROOT, o.html || HTML()), { waitUntil: 'domcontentloaded' });
  try { await page.waitForFunction(() => window.R && R.VERSION, null, { timeout: o.timeout || 15000 }); }
  catch (e) {
    const why = await page.evaluate(() => { const s = document.querySelector('script[src]'); return s && s.textContent.trim().length > 100 ? 'the modules were injected inside the <script src=…> tag (build_rpg.py replaces the FIRST </script>, which is the Telegram script); fix: inject before the LAST </script>' : 'window.R never appeared (00_core.js missing or threw before R.VERSION)'; }).catch(() => 'the page did not load');
    throw new Error('boot: ' + why);
  }
  const wait = o.wait != null ? o.wait : +(process.env.RPG_BOOT_WAIT || 5000);
  let booted = false;
  try { await page.waitForFunction(() => !!(R.running || (R.ui && R.ui.cur)), null, { timeout: wait }); booted = true; } catch (e) {}
  await page.waitForTimeout(o.settle != null ? o.settle : 250);
  const st = await page.evaluate(() => ({ version: R.VERSION, running: !!R.running, cur: R.ui ? R.ui.cur : null, state: !!R.state, player: !!R.player, screens: Object.keys(R.screens || {}), sys: Object.keys(R.sys || {}), data: Object.keys(R.data || {}) }));
  st.booted = booted; return st;
}

/* ---- a valid R.state (v2, ARCH Addendum 2: account + one hero). o overrides: house (acc), hero (p.hero + unlocked), lvl, xp, hp, gold, gems, pos,
   name, cls, …→ p.*; found/flags/quests/bosses/killed → acc.world; o.stats / o.acc / o.wallet / o.opts merge ---- */
function fakeSave(o = {}) {
  const lvl = o.lvl || 1, stats = Object.assign({ str: 5, agi: 5, int: 5, vit: 5 }, o.stats || {}), hero = o.hero || 'jon';
  const world = { found: [], flags: {}, quests: {}, bosses: {}, killed: {} };
  const acc = Object.assign({ house: o.house || 'stark', champs: { [hero]: { unlocked: 1, runs: 0 } }, hall: [], titles: [], title: '', ach: [], world, best: { lvl: 0, kills: 0 } }, o.acc || {});
  const p = { hero, name: hero === 'jon' ? 'Jon Snow' : hero, cls: 'knight', lvl, xp: 0, hp: 120 + 18 * lvl + 6 * stats.vit, gold: 100, gems: 0, pos: null, stats, pts: 0, skills: {}, spts: 0,
    bar: [null, null, null], gear: {}, inv: [], potions: { hp: 3 }, created: 0, played: 0 };
  for (const k in o) { if (k in world) world[k] = o[k]; else if (!['wallet', 'opts', 'stats', 'acc', 'house', 'hero'].includes(k)) p[k] = o[k]; }
  return { v: 2, acc, p, wallet: Object.assign({ imported: true }, o.wallet || {}), opts: Object.assign({ sfx: 0, haptic: 0 }, o.opts || {}) };
}

/* ---- game time ---- */
const steps = (page, n = 1) => page.evaluate(n => { for (let i = 0; i < n; i++) R.step(); return R.t; }, n);
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const has = (page, expr) => page.evaluate(e => { try { return !!Function('return (' + e + ')')(); } catch (x) { return false; } }, expr);
const waitFor = (page, expr, ms = 3000) => page.waitForFunction(expr, null, { timeout: ms }).then(() => true, () => false);

/* ---- touch ---- */
async function cdp(page) { if (!page.__cdp) page.__cdp = await page.context().newCDPSession(page); return page.__cdp; }
const pt = (x, y, id) => ({ x: Math.round(x), y: Math.round(y), radiusX: 10, radiusY: 10, force: 1, id });
async function rawTouch(page, type, points) { await (await cdp(page)).send('Input.dispatchTouchEvent', { type, touchPoints: points }); }
async function tap(page, sel, o = {}) {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) return false;
  try { await loc.tap({ force: true, timeout: o.timeout || 5000 }); } catch (e) { if (o.strict) throw e; return false; }
  await page.waitForTimeout(o.wait != null ? o.wait : 200); return true;
}
/* a thumb lands on the left half (o.x / o.y, default 30% / 62% of the viewport) and drags by dx, dy over ms; the touch stays down → await the returned release() */
async function joystick(page, dx, dy, ms = 250, o = {}) {
  const vp = page.viewportSize() || { width: 390, height: 844 };
  const x0 = o.x != null ? o.x : Math.round(vp.width * 0.3), y0 = o.y != null ? o.y : Math.round(vp.height * 0.62), id = o.id || 1;
  await rawTouch(page, 'touchStart', [pt(x0, y0, id)]);
  const n = Math.max(3, Math.round(ms / 30));
  for (let i = 1; i <= n; i++) { const k = i / n; await rawTouch(page, 'touchMove', [pt(x0 + dx * k, y0 + dy * k, id)]); await sleep(ms / n); }
  let done = false;
  return async () => { if (done) return; done = true; await rawTouch(page, 'touchEnd', []); await sleep(60); };
}
/* a visible control under root whose id / class / data-* / aria-label / title / short text matches re (a string or RegExp, case-insensitive);
   buttons win over wrappers, then the smallest match. Marks it data-t40 and returns the selector, or null. */
async function findBtn(page, re, root = '#ui') {
  const src = re instanceof RegExp ? re.source : re, flags = re instanceof RegExp ? re.flags : 'i';
  return page.evaluate(([src, flags, root]) => {
    const re = new RegExp(src, flags.includes('i') ? flags : flags + 'i'); const found = [];
    for (const r of document.querySelectorAll(root)) for (const el of r.querySelectorAll('*')) {
      const ds = Object.entries(el.dataset || {}).map(([k, v]) => k + '=' + v).join(' ');
      const meta = [el.id, typeof el.className === 'string' ? el.className : '', ds, el.getAttribute('aria-label'), el.title].join(' | ');
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!(re.test(meta) || (txt.length <= 24 && re.test(txt)))) continue;
      const b = el.getBoundingClientRect(); if (b.width < 8 || b.height < 8 || b.width * b.height > 150000) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      const btn = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || /btn|button/i.test(typeof el.className === 'string' ? el.className : '') || el.onclick;
      found.push({ el, a: b.width * b.height, btn: btn ? 1 : 0 });
    }
    if (!found.length) return null;
    found.sort((p, q) => q.btn - p.btn || p.a - q.a);
    const el = found[0].el, k = 't40_' + Math.floor(Math.random() * 1e9); el.setAttribute('data-t40', k); return '[data-t40="' + k + '"]';
  }, [src, flags, root]);
}

/* ---- screenshots ---- */
async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true }); const p = path.join(SHOTS, /\.png$/.test(name) ? name : name + '.png');
  try { await page.screenshot({ path: p }); } catch (e) {} return p;
}

/* ---- is a canvas drawn? sel = '#gl'. renderExpr (a JS statement, e.g. 'R.drawAll()') runs first in the same task, then gl.readPixels samples a
   24×24 grid (works with preserveDrawingBuffer:false because nothing composited in between); when that reads blank it falls back to a screenshot
   of the canvas with #c / #ui / #screen hidden. → {ok, how, nonBlank: 0..1 share of lit samples, distinct: colour buckets} ---- */
async function canvasPixels(page, sel = '#gl', renderExpr = '') {
  const r = await page.evaluate(([sel, renderExpr]) => {
    const cv = document.querySelector(sel); if (!cv) return { ok: false, how: 'no ' + sel };
    try { if (renderExpr) Function(renderExpr)(); } catch (e) { return { ok: false, how: 'render threw: ' + e.message }; }
    const gl = cv.getContext('webgl2') || cv.getContext('webgl'); if (!gl) return { ok: false, how: 'no gl context on ' + sel };
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, N = 24, px = new Uint8Array(4), seen = new Set(); let non = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { gl.readPixels(Math.floor((i + .5) * W / N), Math.floor((j + .5) * H / N), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); seen.add((px[0] >> 3) + ',' + (px[1] >> 3) + ',' + (px[2] >> 3)); if (px[3] > 0 && px[0] + px[1] + px[2] > 24) non++; }
    return { ok: true, how: 'readPixels ' + W + 'x' + H, nonBlank: +(non / (N * N)).toFixed(3), distinct: seen.size };
  }, [sel, renderExpr]);
  if (r.ok && (r.distinct > 1 || r.nonBlank > 0)) return r;
  const hide = ['#c', '#ui', '#screen', '#err'];
  await page.evaluate(h => h.forEach(s => { const el = document.querySelector(s); if (el) { el.dataset.t40vis = el.style.visibility || ''; el.style.visibility = 'hidden'; } }), hide);
  let buf = null; try { const loc = page.locator(sel).first(); if (await loc.count()) buf = await loc.screenshot({ timeout: 5000 }); } catch (e) {}
  await page.evaluate(h => h.forEach(s => { const el = document.querySelector(s); if (el) { el.style.visibility = el.dataset.t40vis || ''; delete el.dataset.t40vis; } }), hide);
  if (!buf) return Object.assign(r, { how: (r.how || '') + '; screenshot failed' });
  return page.evaluate(b64 => new Promise(res => { const im = new Image(); im.onload = () => { const N = 24, c = document.createElement('canvas'); c.width = N; c.height = N; const x = c.getContext('2d'); x.drawImage(im, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N).data, seen = new Set(); let non = 0; for (let i = 0; i < d.length; i += 4) { seen.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3)); if (d[i] + d[i + 1] + d[i + 2] > 24) non++; }
    res({ ok: true, how: 'screenshot', nonBlank: +(non / (N * N)).toFixed(3), distinct: seen.size }); }; im.onerror = () => res({ ok: false, how: 'screenshot decode failed' }); im.src = 'data:image/png;base64,' + b64; }), buf.toString('base64'));
}

/* ---- errors: R.errors (array or object), the #err overlay; console errors that are thrown errors (not network noise) ---- */
async function gameErrors(page) {
  return page.evaluate(() => { const out = []; try {
    const E = window.R && R.errors;
    if (Array.isArray(E)) out.push(...E.map(e => 'R.errors:' + String(e && e.message || (typeof e === 'string' ? e : JSON.stringify(e))).slice(0, 200)));
    else if (E && typeof E === 'object') for (const k in E) out.push('R.errors.' + k + ':' + String(E[k]).slice(0, 200));
    const el = document.getElementById('err'); if (el && el.style.display === 'block' && el.textContent.trim()) out.push('#err:' + el.textContent.trim().slice(0, 200));
  } catch (e) { out.push('errcheck:' + e.message); } return out; }).catch(e => ['evaluate:' + e.message]);
}
const NOISE = /net::|Failed to load resource|Failed to fetch|ERR_|telegram|favicon|CORS|NetworkError|Load failed|ERR_TUNNEL|supabase/i;
const REAL = /(Type|Reference|Range|Syntax|Internal)Error|is not defined|is not a function|Cannot read|Cannot set|Uncaught|undefined is not|null is not|Maximum call stack|is not iterable|Unexpected token/;
const realConsole = cerrs => cerrs.filter(t => REAL.test(t) && !NOISE.test(t));

/* ---- results ---- */
const RES = []; const SUITE = path.basename((require.main && require.main.filename) || 'suite', '.js');
const line = r => `  ${r.st.padEnd(4)} ${r.name}${r.info ? '  — ' + r.info.slice(0, 300) : ''}`;
function ok(name, cond, info) { const r = { name, st: cond ? 'OK' : 'FAIL', info: info == null ? '' : String(info) }; RES.push(r); console.log(line(r)); return !!cond; }
function skip(name, why) { const r = { name, st: 'SKIP', info: why || '' }; RES.push(r); console.log(line(r)); return false; }
function report(o = {}) {
  const n = { OK: 0, SKIP: 0, FAIL: 0 }; for (const r of RES) n[r.st]++;
  console.log(`${SUITE}: ${n.OK} OK, ${n.SKIP} SKIP, ${n.FAIL} FAIL`);
  if (n.FAIL) { console.log('FAILS:'); for (const r of RES) if (r.st === 'FAIL') console.log(line(r)); }
  console.log(n.FAIL ? 'FAILED ' + n.FAIL : 'ALL OK');
  if (o.exit !== false) process.exit(n.FAIL ? 1 : 0);
  return n.FAIL;
}

module.exports = { ROOT, CHROME, SHOTS, HTML, sleep, build, launch, boot, fakeSave, steps, ev, has, waitFor, tap, joystick, rawTouch, findBtn, shot, canvasPixels, gameErrors, realConsole, ok, skip, report, results: RES };
