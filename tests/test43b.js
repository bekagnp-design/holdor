const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR, {timeout: 10000});
  await page.waitForTimeout(500);
  const out={};
  // account with progress; migration check: no gold field → fixSave-like path is only on load, so test the formula via a synthetic account
  await page.evaluate(()=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.intro=1;a.tut=1;a.campaign={1:3,2:2,3:3,4:1};a.gems=300;a.gold=900;H.setAcc(a);H.persist();H.showHub('shop');});
  await page.waitForTimeout(600);
  await page.screenshot({path:SC+'h43_shop.png',fullPage:false});
  out.shop = await page.evaluate(()=>({deals:document.querySelectorAll('.sitem.deal').length, locked:document.querySelectorAll('.sitem.deal.lock').length, free:document.querySelector('[data-deal="0"]').textContent.trim(), top:document.querySelector('.hubtop .cur').textContent.trim(), gold:window.HOLDOR.goldOf(), gems:window.HOLDOR.ACC.gems}));
  // take the free deal
  await page.click('[data-deal="0"]',{force:true});
  await page.waitForTimeout(400);
  out.free = await page.evaluate(()=>({bought:window.HOLDOR.dealsState().bought.slice(), gold:window.HOLDOR.goldOf(), gems:window.HOLDOR.ACC.gems, btn:document.querySelector('[data-deal="0"]').textContent.trim()}));
  // buy deal 1 if affordable
  out.deal1 = await page.evaluate(()=>{const H=window.HOLDOR;const d=H.genDeals()[1];const g0=H.goldOf(),m0=H.ACC.gems;const ok=H.buyDeal(1);return {deal:d.n+' / '+d.s, price:d.price, ok, dGold:H.goldOf()-g0, dGems:H.ACC.gems-m0};});
  // unlock slot 3 (20 gems) and buy it
  out.unlock = await page.evaluate(()=>{const H=window.HOLDOR;const m0=H.ACC.gems;const ok=H.unlockDeal(3);const d=H.genDeals()[3];return {ok, cost:m0-H.ACC.gems, unl:H.dealsState().unl.slice(), deal:d.n+' / '+d.s, price:d.price};});
  await page.evaluate(()=>window.HOLDOR.showHub('shop'));
  await page.waitForTimeout(400);
  await page.screenshot({path:SC+'h43_shop2.png'});
  // exchange 40 gems → 350 gold
  await page.click('[data-xch="0"]',{force:true});
  await page.waitForTimeout(300);
  out.xch = await page.evaluate(()=>({gold:window.HOLDOR.goldOf(), gems:window.HOLDOR.ACC.gems}));
  // hero room: level up with gold
  await page.evaluate(()=>window.HOLDOR.showHeroRoom('jon'));
  await page.waitForTimeout(400);
  await page.screenshot({path:SC+'h43_hero.png'});
  out.hero = await page.evaluate(async()=>{const H=window.HOLDOR;const g0=H.goldOf();const b=document.querySelector('#clist button[data-a="lvl"]');const txt=b.textContent;b.click();await new Promise(r=>setTimeout(r,200));return {btn:txt, lvl:H.cprog(null,'jon').lvl, spent:g0-H.goldOf(), cost:H.ECON.lvlCost(1)};});
  // upgrades with gold
  await page.evaluate(()=>window.HOLDOR.showUpgrades());
  await page.waitForTimeout(400);
  await page.screenshot({path:SC+'h43_upg.png'});
  out.upg = await page.evaluate(async()=>{const H=window.HOLDOR;const g0=H.goldOf();document.querySelector('.ug[data-u="leather"]').click();await new Promise(r=>setTimeout(r,100));const bb=document.querySelector('#bBuy');const t=bb?bb.textContent:'none';if(bb)bb.click();await new Promise(r=>setTimeout(r,200));return {btn:t, owned:!!H.ACC.upg.leather, spent:g0-H.goldOf()};});
  // victory reward: play gate 1 quickly via API and force victory
  out.victory = await page.evaluate(async()=>{const H=window.HOLDOR;const g0=H.goldOf();H.startGame({mode:'campaign',level:H.LEVELS[0]});const G=H.G;G.wave=G.totalWaves;G.waveDone=true;G.spawnQueue=[];G.enemies=[];G.nextIn=0;for(let i=0;i<5&&G.state==='play';i++)H.step();await new Promise(r=>setTimeout(r,300));return {state:G.state,victory:G.victory,reward:G.goldReward,gained:H.goldOf()-g0,text:(document.querySelector('.card p.m')||{}).textContent};});
  await page.screenshot({path:SC+'h43_victory.png'});
  // hold reward
  out.hold = await page.evaluate(async()=>{const H=window.HOLDOR;H.G.state='menu';const g0=H.goldOf(),m0=H.ACC.gems,at0=H.ACC.online.attempts;H.startGame({mode:'online'});const G=H.G;for(let i=0;i<120;i++)H.step();G.wave=8;G.kills=40;G.doorHp=0;H.gameOver();await new Promise(r=>setTimeout(r,300));return {state:G.state, reward:G.holdReward, dGold:H.goldOf()-g0, dGems:H.ACC.gems-m0, attempts:[at0,H.ACC.online.attempts], runs:H.ACC.online.runs.length, txt:(document.querySelector('.card p.m')||{}).textContent};});
  await page.screenshot({path:SC+'h43_holdover.png'});
  // migration: an old-style save without gold
  out.migr = await page.evaluate(()=>{const H=window.HOLDOR;const a=H.newAccount('tyrell',0,'squire');delete a.gold;a.campaign={1:3,2:3,3:2};a.stats.waves=100;H.SAVE.slots[0]=a;H.SAVE.cur=0;try{localStorage.setItem('holdor_save_v4',JSON.stringify(H.SAVE));}catch(e){}return {hasGold:'gold' in a};});
  await page.reload();await page.waitForFunction(()=>window.HOLDOR);await page.waitForTimeout(800);
  out.migr2 = await page.evaluate(()=>{const H=window.HOLDOR;const a=H.SAVE.slots[0];return {gold:a&&a.gold, expected:150+120*3+40*8+300};});
  console.log(JSON.stringify(out,null,1));
  console.log('ERRORS:', errors.length?errors:'none');
  await browser.close();
})();
