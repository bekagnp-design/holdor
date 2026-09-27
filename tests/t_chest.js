const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:800,height:420},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR,{timeout:15000});
  await page.evaluate(()=>{const H=window.HOLDOR_GEN;const d=document.createElement('div');d.id='cx';d.style.cssText='position:fixed;inset:0;z-index:9999;background:#1a2c48;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px';
    for(const open of [false,true])for(const t of ['wood','iron','valyrian','dragon']){const c=document.createElement('div');c.style.cssText='width:180px;height:160px';c.innerHTML=H.chestSVG(t,open);d.appendChild(c);}document.body.appendChild(d);});
  await page.waitForTimeout(300);
  await page.screenshot({path:__dirname+'/chests.png'});
  console.log('ERR',errors);
  await browser.close();
})();
