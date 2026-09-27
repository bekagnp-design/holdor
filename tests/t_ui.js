const { chromium } = require('playwright');
const SC=__dirname+'/';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push('PE:'+e.message+' @ '+(e.stack||'').split('\n').slice(1,3).join('|')));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR,{timeout:15000});
  await page.waitForTimeout(400);
  const out={};
  out.setup=await page.evaluate(()=>{const H=window.HOLDOR,X=window.HOLDOR_GEN;const a=H.newAccount('stark',0,'squire');a.intro=1;a.tut=1;for(let i=1;i<=16;i++)a.campaign[i]=2;a.gold=20000;a.gems=200;a.tlv={watch:6,glass:4};a.champs.jon={lvl:12,sk:[3,2,2],tal:1};H.setAcc(a);H.persist();X.showHeroRoom('jon');return {cap:X.rankCap(12),skv:X.SK.cleave.v,tal:X.TALENTS.jon.map(t=>t.v)};});
  await page.waitForTimeout(400);await page.screenshot({path:SC+'u_hero.png',fullPage:false});
  out.lvl=await page.evaluate(async()=>{const H=window.HOLDOR;const b=document.querySelector('#clist button[data-a="lvl"]');const g0=H.goldOf?H.goldOf():0;b.click();await new Promise(r=>setTimeout(r,150));return {lvl:H.cprog(null,'jon').lvl};});
  await page.evaluate(()=>window.HOLDOR_GEN.showTowerRoom('watch'));
  await page.waitForTimeout(400);await page.screenshot({path:SC+'u_tower.png'});
  out.tw=await page.evaluate(async()=>{const X=window.HOLDOR_GEN;const b=document.querySelector('#clist button[data-a="tl"]');const t=b.textContent;b.click();await new Promise(r=>setTimeout(r,150));return {btn:t,lvl:X.tLvl('watch')};});
  await page.evaluate(()=>window.HOLDOR_GEN.showUpgrades());
  await page.waitForTimeout(400);await page.screenshot({path:SC+'u_armory.png'});
  await page.evaluate(()=>window.HOLDOR.showHub('coll','towers'));
  await page.waitForTimeout(500);await page.screenshot({path:SC+'u_coll.png'});
  await page.evaluate(()=>window.HOLDOR_GEN.showDifficulty(false));
  await page.waitForTimeout(300);await page.screenshot({path:SC+'u_diff.png'});
  // migration of an old save
  out.migr=await page.evaluate(()=>{const H=window.HOLDOR,X=window.HOLDOR_GEN;const a=H.newAccount('stark',0,'squire');delete a.cv;delete a.pv;a.campaign={1:3,2:3,3:2,4:1,5:3,6:2};a.stg={1:{2:3}};a.champs={jon:{lvl:7,sk:[3,2,1],tal:2}};a.upg={keen:1,shafts:1,bolts:1,leather:1};a.gold=500;a.diff='knight';X.migrate45(a);return {camp:a.campaign,cleared:Object.keys(a.campaign).length,jon:a.champs.jon,upg:a.upg,gold:a.gold,refund:a.refund,diff:a.diff,stg:a.stg};});
  console.log(JSON.stringify(out,null,1));
  console.log('ERR',errors);
  await browser.close();
})();
