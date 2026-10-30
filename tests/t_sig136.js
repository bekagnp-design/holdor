// v1.3.6: every champion's blows have an effect of his own kind; nothing throws, nothing flows into the simulation.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_SIG, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const r = await page.evaluate(() => { const H = window.HOLDOR, S = window.HOLDOR_SIG, C = window.HOLDOR_CASTLE; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; H.setAcc(a);
    H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); const G = H.G; G.waveDone = false; G.nextIn = 1e9; C.spawn('sword', 200, 0); const e = G.enemies[G.enemies.length - 1];
    const styles = new Set(), bad = []; let n = 0; for (const c of H.CHAMPS) { try { G.hero.c = c; G.fx.length = 0; S.heroSig(e); styles.add(S.sigStyle(c).join('|')); if (!G.fx.length) bad.push(c.id); n++; } catch (x) { bad.push(c.id + ':' + x.message); } }
    const hp = e.hp; G.hero.c = H.CHAMPS[0]; S.heroSig(e); return { n, styles: styles.size, bad, same: e.hp === hp }; });
  ok('all 49 champions draw their blow, with at least six different looks', r.n >= 49 && r.styles >= 6 && r.bad.length === 0, JSON.stringify(r));
  ok('the effect never touches health', r.same);
  await page.waitForTimeout(500);
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
