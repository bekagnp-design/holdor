// The fastest any battle can possibly be won: every enemy dies the moment it appears and every wave is called
// as early as the game allows. The server (backend v5) rejects a result that claims to be faster than this.
// usage: node src/tools/min_steps.js [out.json]   (default: backend/limits.json; CHROMIUM_PATH like the tests)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', '..', process.argv[2] || 'backend/limits.json');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage();
  await page.route(/telegram\.org|supabase\.co/, r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '..', '..', 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CH53, { timeout: 30000 });
  const res = await page.evaluate(() => {
    const H = window.HOLDOR, K = window.HOLDOR_CH53;
    const acc = () => { const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.holdTut = 1; a.holdIntro = 1;
      a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = new Proxy({}, { get: () => 1, has: () => true });
      for (let i = 1; i <= H.LEVELS.length; i++) a.campaign[i] = 3; H.SAVE.slots[0] = a; H.SAVE.cur = 0; H.setAcc(a); return a; };
    // one battle: kill everything each step, call every wave as soon as it can be called
    const run = (o, stopWaves) => {
      H.startGame(o); const G = H.G; let n = 0, marks = [];
      while (G.state === 'play' && n < 400000) {
        G.paused = false; if (G.tut) G.tut = null;
        for (const e of G.enemies) if (!e.dead) K.kill(e, 'tower');
        if (H.canCall()) H.callWave();
        const w = G.wave; H.step(); n++;
        if (G.wave !== w) marks.push([G.wave, G.tick, G.kills]);
        if (stopWaves && G.wave > stopWaves) break;
      }
      return { ticks: G.tick, kills: G.kills, wave: G.wave, won: !!G.victory, marks };
    };
    acc();
    const stages = {};
    for (const L of H.LEVELS) { const r = run({ mode: 'campaign', level: L }); stages[L.id] = { waves: L.waves, min_steps: r.ticks, kills: r.kills, won: r.won }; }
    acc(); H.ACC.online = { date: H.dayKeyUTC(), attempts: 99, doorBonus: 0, goldBonus: 0, runs: [] };
    const h = run({ mode: 'online' }, 80);
    return { stages, hold: h.marks };
  });
  await browser.close();
  // hold: the first tick each wave can start; beyond the measured waves, extend with the last measured gap
  const hold = {}; for (const [w, t, k] of res.hold) hold[w] = [t, k];
  const bad = Object.entries(res.stages).filter(([, v]) => !v.won);
  if (bad.length) { console.error('stages not won:', bad.map(b => b[0]).join(',')); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify({ made: 'src/tools/min_steps.js', step_hz: 60, stages: res.stages, hold_wave: hold }, null, 1));
  const v = Object.values(res.stages);
  console.log('wrote', OUT, '· stages', v.length, '· min_steps', Math.min(...v.map(x => x.min_steps)), '…', Math.max(...v.map(x => x.min_steps)), '· hold waves', Object.keys(hold).length);
})();
