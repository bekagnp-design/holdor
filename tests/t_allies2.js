const { chromium } = require('playwright');
const SC=__dirname+'/';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR,{timeout:15000});
  await page.waitForTimeout(400);
  const r = await page.evaluate(async()=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.intro=1;a.tut=1;for(let i=1;i<=8;i++)a.campaign[i]=2;a.gold=900;H.setAcc(a);
    const L=H.LEVELS[Number(new URLSearchParams(location.search).get('l')||3)];H.startGame({mode:'campaign',level:L});const G=H.G;G.doorMax=G.doorHp=99999;
    G.hero.x=30;G.hero.y=300;G.hero.tx=null;G.hero.dead=true;G.hero.respawnT=1e9;
    H.callWave();let n=0;
    while(n<60*60){H.step();n++;const near=G.enemies.filter(e=>!e.fly&&G.map.routes[e.route||0].total-e.prog<260).length;if(near>=2)break;}
    H.castPower('reinf');
    const log=[];let allyDmg=0;const hp0=new Map();
    for(let k=0;k<16;k++){for(let i=0;i<30;i++)H.step();log.push(G.allies.filter(a=>a.kind==='brother').map(a=>Math.round(a.hp)).join(','));if(k===5)break;}
    return {n,log,kills:G.kills,en:G.enemies.filter(e=>!e.fly).map(e=>Math.round(G.map.routes[e.route||0].total-e.prog)+':'+(e.blockedBy||'-')).join(' ')};});
  await page.waitForTimeout(250);
  await page.screenshot({path:SC+'allies2.png'});
  const r2 = await page.evaluate(()=>{const H=window.HOLDOR,G=H.G;const log=[];for(let k=0;k<10;k++){for(let i=0;i<30;i++)H.step();log.push(G.allies.filter(a=>a.kind==='brother').map(a=>Math.round(a.hp)).join(','));}return {log,kills:G.kills};});
  console.log(JSON.stringify(r),JSON.stringify(r2));
  console.log('ERR',errors);
  await browser.close();
})();
