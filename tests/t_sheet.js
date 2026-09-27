// contact sheet of all 50 battlefields: node t_sheet.js [from] [to] [out]
const { chromium } = require('playwright');
const fs=require('fs');
(async () => {
  const from=+(process.argv[2]||1),to=+(process.argv[3]||50),out=process.argv[4]||__dirname+'/sheet';
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(()=>window.HOLDOR,{timeout:15000});
  await page.waitForTimeout(400);
  fs.mkdirSync(out,{recursive:true});
  for(let id=from;id<=to;id++){
    const url=await page.evaluate((id)=>{const H=window.HOLDOR,Gn=window.HOLDOR_GEN;const L=H.LEVELS[id-1];
      const map=Gn.buildMap({routes:L.routes,gates:L.gates,raw:true,style:L.style,sea:L.sea,seaW:L.seaW,river:L.river,ponds:L.ponds,seed:Gn.hash32('L'+L.id),biome:L.biome});
      const cv=document.createElement('canvas');cv.width=390;cv.height=700;const c=cv.getContext('2d');c.drawImage(map.bg,0,0,390,700);
      for(const s of map.slots){c.fillStyle='rgba(255,215,90,0.9)';c.beginPath();c.ellipse(s.x,s.y+3,16,8,0,0,6.3);c.fill();c.strokeStyle='#3a2a14';c.lineWidth=1.5;c.stroke();}
      c.fillStyle='rgba(0,0,0,0.6)';c.fillRect(0,0,390,26);c.fillStyle='#fff';c.font='bold 16px sans-serif';c.fillText(id+' '+L.n+' · '+L.biome+' · '+L.lay+' · '+map.slots.length+' spots',6,19);
      for(const g of map.gates){c.fillStyle='#8a1f1f';c.fillRect(g.x-20,622,40,20);}
      return cv.toDataURL('image/png');},id);
    fs.writeFileSync(out+'/s'+String(id).padStart(2,'0')+'.png',Buffer.from(url.split(',')[1],'base64'));
  }
  console.log('ERR',errors);
  await browser.close();
})();
