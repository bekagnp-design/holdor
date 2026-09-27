const { chromium } = require('playwright');
(async () => {
  const id=+(process.argv[2]||31),tag=process.argv[3]||'mid';
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR_GEN,{timeout:20000});
  await page.evaluate((id)=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.tut=1;a.intro=1;for(let i=1;i<id;i++)a.campaign[i]=2;a.tlv={watch:6,scorp:6,glass:6,keep:6,wild:6,weir:6};H.setAcc(a);H.startGame({mode:'campaign',level:H.LEVELS[id-1]});const G=H.G;G.doorMax=G.doorHp=1e5;
    const kinds=['watch','scorp','glass','keep','wild','weir','watch','scorp'];G.gold=1e5;G.map.slots.slice(0,9).forEach((s,i)=>{H.build(s,kinds[i%kinds.length]);s.tower.lvl=3;});
    for(let i=0;i<60*40;i++){if(H.canCall())H.callWave();H.step();}H.castPower('reinf');for(let i=0;i<60*2;i++)H.step();G.speed=0;},id);
  await page.waitForTimeout(600);
  await page.screenshot({path:__dirname+'/'+tag+'.png'});
  console.log('ERR',errors);
  await browser.close();
})();
