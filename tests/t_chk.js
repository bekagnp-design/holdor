const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('C:'+m.text());});
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForTimeout(1500);
  console.log(await page.evaluate(()=>[typeof window.HOLDOR,typeof window.HOLDOR_GEN, window.HOLDOR&&window.HOLDOR.G?'G ok':'no G']));
  console.log(errors.slice(0,5));
  await browser.close();
})();
