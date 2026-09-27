const { chromium } = require('playwright');
const SC=__dirname+'/fin_';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR_GEN,{timeout:20000});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.intro=1;a.tut=1;for(let i=1;i<=22;i++)a.campaign[i]=(i%3)+1;a.gold=4200;a.gems=180;a.refund=900;H.setAcc(a);H.persist();H.showHub('battle');});
  await page.waitForTimeout(700);await page.screenshot({path:SC+'hub.png'});
  await page.evaluate(()=>window.HOLDOR.showHub('shop'));await page.waitForTimeout(600);await page.screenshot({path:SC+'shop.png'});
  for(const [id,tag] of [[1,'s01'],[16,'s16'],[38,'s38'],[47,'s47']]){
    await page.evaluate((id)=>{const H=window.HOLDOR;H.G.state='menu';H.startGame({mode:'campaign',level:H.LEVELS[id-1]});const G=H.G;G.gold=99999;G.doorMax=G.doorHp=1e5;const k=['watch','glass','keep','scorp','wild','weir'];G.map.slots.slice(0,7).forEach((s,i)=>{H.build(s,k[i%k.length]);});for(let i=0;i<60*26;i++){if(H.canCall())H.callWave();H.step();}G.speed=0;},id);
    await page.waitForTimeout(500);await page.screenshot({path:SC+tag+'.png'});
  }
  console.log('ERR',errors);
  await browser.close();
})();
