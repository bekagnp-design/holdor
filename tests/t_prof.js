const { chromium } = require('playwright');
(async () => {
  const id=+(process.argv[2]||8);
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR_GEN,{timeout:20000});
  const cdp=await page.context().newCDPSession(page);
  await page.evaluate((id)=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.tut=1;a.intro=1;for(let i=1;i<id;i++)a.campaign[i]=2;H.setAcc(a);H.startGame({mode:'campaign',level:H.LEVELS[id-1]});const G=H.G;for(const s of G.map.slots.slice(0,8))H.build(s,'watch');for(let i=0;i<60*20;i++){if(H.canCall())H.callWave();H.step();}},id);
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const t=await page.evaluate(()=>{const H=window.HOLDOR,G=H.G;const t0=performance.now();for(let i=0;i<60*30;i++){if(H.canCall())H.callWave();H.step();}return {ms:performance.now()-t0,en:G.enemies.length,al:G.allies.length,fx:G.fx.length,wave:G.wave};});
  const {profile}=await cdp.send('Profiler.stop');
  const self={};const byId={};for(const n of profile.nodes)byId[n.id]=n;
  const dt=profile.timeDeltas;const samples=profile.samples;for(let i=0;i<samples.length;i++){const n=byId[samples[i]];const k=n.callFrame.functionName+':'+n.callFrame.lineNumber;self[k]=(self[k]||0)+(dt[i]||0);}
  console.log(JSON.stringify(t));console.log(Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>k+' '+Math.round(v/1000)+'ms').join('\n'));
  await browser.close();
})();
