const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await b.newPage();
  await p.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'))); await p.waitForFunction(() => window.HOLDOR);
  const r = await p.evaluate(() => window.HOLDOR.LEVELS.slice(0, 20).map(L => `${L.id}:${L.n}:g${L.gates.length}:${L.boss ? 'BOSS' : ''}:${L.lay}`));
  console.log(r.join('\n')); await b.close();
})();
