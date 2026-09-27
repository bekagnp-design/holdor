const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.goto(('file://' + require('path').resolve(__dirname, '..', 'src/base/index.v1.0.44.html')));
  await page.waitForFunction(()=>window.HOLDOR,{timeout:15000});
  const r=await page.evaluate(()=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.intro=1;a.tut=1;for(let i=1;i<=8;i++)a.campaign[i]=2;H.setAcc(a);H.startGame({mode:'online'});const G=H.G;return G.map.routes[0].pts.map(p=>[Math.round(p.x),Math.round(p.y)]);});
  console.log(JSON.stringify(r));
  await page.screenshot({path:__dirname+'/daily44.png'});
  await browser.close();
})();
