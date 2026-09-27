const { chromium } = require('playwright');
const SC=__dirname+'/';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push('PE:'+e.message+' @ '+(e.stack||'').split('\n').slice(0,4).join(' | ')));page.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load/.test(m.text()))errors.push('C:'+m.text());});
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR,{timeout:15000});
  await page.waitForTimeout(500);
  const out={};
  out.a=await page.evaluate(()=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.intro=1;a.tut=1;for(let i=1;i<=11;i++)a.campaign[i]=i%3+1;a.gold=3000;a.gems=100;H.setAcc(a);H.persist();H.showHub('battle');return {lv:H.LEVELS.length,next:document.querySelector('#bBattle')&&document.querySelector('#bBattle').textContent};});
  await page.waitForTimeout(500);await page.screenshot({path:SC+'f_hub.png'});
  await page.evaluate(()=>window.HOLDOR.showCampaign());
  await page.waitForTimeout(900);await page.screenshot({path:SC+'f_map.png'});
  // win stage 12 quickly
  out.b=await page.evaluate(async()=>{const H=window.HOLDOR;H.startGame({mode:'campaign',level:H.LEVELS[11]});const G=H.G;G.wave=G.totalWaves;G.waveDone=true;G.spawnQueue=[];G.enemies=[];for(let i=0;i<5&&G.state==='play';i++)H.step();await new Promise(r=>setTimeout(r,300));return {state:G.state,vic:G.victory,btn:(document.querySelector('#bNext')||{}).textContent,c12:H.ACC.campaign[12]};});
  await page.waitForTimeout(300);await page.screenshot({path:SC+'f_win.png'});
  out.c=await page.evaluate(async()=>{document.querySelector('#bNext').click();await new Promise(r=>setTimeout(r,400));const G=window.HOLDOR.G;return {state:G.state,level:G.level&&G.level.id,name:G.level&&G.level.n};});
  console.log(JSON.stringify(out,null,1));
  console.log('ERR',errors);
  await browser.close();
})();
