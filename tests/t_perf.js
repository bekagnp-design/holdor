const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR,{timeout:15000});
  const r=await page.evaluate(()=>{const H=window.HOLDOR,Gn=window.HOLDOR_GEN;const t=[];for(const id of [1,10,21,38,47,50]){const L=H.LEVELS[id-1];const t0=performance.now();Gn.buildMap({routes:L.routes,gates:L.gates,raw:true,style:L.style,sea:L.sea,seaW:L.seaW,river:L.river,ponds:L.ponds,seed:Gn.hash32('L'+L.id),biome:L.biome});t.push(id+':'+Math.round(performance.now()-t0)+'ms');}return t;});
  console.log(r.join(' '));
  await browser.close();
})();
