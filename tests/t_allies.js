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
    const L=H.LEVELS[3];H.startGame({mode:'campaign',level:L});const G=H.G;
    // park the hero far from the road end so the brothers do the work
    G.hero.x=40;G.hero.y=420;G.hero.tx=null;
    // put a few enemies near the end of the road
    const R=G.map.routes[0];for(let i=0;i<5;i++){H.spawn?0:0;}
    const sp=(t,prog)=>{const n0=G.enemies.length;window.HOLDOR.G.wave=3;};
    return {total:R.total,gates:G.map.gates.length};});
  // use the internal spawn via startWave-less path: call step until wave spawns
  const r2 = await page.evaluate(async()=>{const H=window.HOLDOR,G=H.G;H.callWave();for(let i=0;i<60*12;i++)H.step();
    const before=G.enemies.map(e=>Math.round(G.map.routes[e.route||0].total-e.prog));
    H.castPower('reinf');
    const out=[];for(let k=0;k<10;k++){for(let i=0;i<30;i++)H.step();out.push(G.allies.filter(a=>a.kind==='brother').map(a=>[Math.round(a.x),Math.round(a.y),Math.round(a.hp),a.moving?1:0]));}
    const dealt=G.enemies.map(e=>Math.round(e.hp)+'/'+Math.round(e.max));
    return {before,out,dealt,kills:G.kills,allies:G.allies.length};});
  await page.waitForTimeout(300);
  await page.screenshot({path:SC+'allies1.png'});
  console.log(JSON.stringify(r),JSON.stringify(r2));
  console.log('ERR',errors);
  await browser.close();
})();
