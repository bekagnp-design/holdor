// Puts docs/marketing/shots/battle96.png and home96.png into the 1280x720 link card (and a 640x360 copy). Run after make_card.js.
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const OUT = path.resolve(__dirname, '..') + '/', SH = OUT + 'shots/';
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(SH + f).toString('base64');
const html = `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0}body{width:1280px;height:720px;overflow:hidden;background:radial-gradient(1000px 700px at 22% 40%,#17335c 0,#0c1a33 55%,#070f1f 100%);font-family:Georgia,'Times New Roman',serif;position:relative}
.snow{position:absolute;inset:0;background-image:radial-gradient(2px 2px at 40px 60px,#cfe3ff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 190px 150px,#cfe3ff 50%,transparent 51%),radial-gradient(2px 2px at 330px 40px,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 120px 280px,#cfe3ff 50%,transparent 51%);background-size:420px 330px;opacity:.55}
.t{position:absolute;left:68px;top:110px;width:620px}
.k{letter-spacing:.34em;font-size:20px;color:#8fb6e8;font-weight:700}
h1{font-size:118px;line-height:1.02;margin-top:10px;letter-spacing:.02em;background:linear-gradient(#ffe9a6,#e2a93a 62%,#9c6414);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 #4a2e08)}
h2{margin-top:6px;letter-spacing:.34em;font-size:34px;color:#f3efe6;font-weight:700}
p{margin-top:28px;font-size:29px;line-height:1.38;color:#d7e3f6;width:540px}
.btn{position:absolute;left:68px;top:496px;height:84px;padding:0 54px;border-radius:42px;background:linear-gradient(#ffe38e,#efb83b);box-shadow:0 8px 0 #9a6710,0 14px 28px rgba(0,0,0,.45);font-size:36px;font-weight:700;letter-spacing:.12em;color:#2a1a05;display:flex;align-items:center;gap:16px}
.ph{position:absolute;border-radius:34px;border:6px solid #1b2742;background:#05070d;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.6),0 0 0 2px #3a4a72}
.ph img{display:block;width:100%;height:100%;object-fit:cover}
.p1{left:955px;top:66px;width:300px;height:620px;transform:rotate(5deg);opacity:.96}
.p2{left:712px;top:34px;width:324px;height:676px;transform:rotate(-4deg);z-index:2}
</style><div class=snow></div>
<div class=t><div class=k>TOWER DEFENSE · TELEGRAM</div><h1>HOLDOR</h1><h2>HOLD THE DOOR</h2><p>Build towers, lead your champion, hold the door against the dead.</p></div>
<div class=btn>▶ PLAY FREE</div>
<div class="ph p1"><img src="${b64('home96.png')}"></div><div class="ph p2"><img src="${b64('battle96.png')}"></div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await pg.setContent(html); await pg.waitForTimeout(400);
  await pg.screenshot({ path: OUT + 'card_1280x720.png' });
  const p2 = await br.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: .5 }); await p2.setContent(html); await p2.waitForTimeout(400);
  await p2.screenshot({ path: OUT + 'card_640x360.png' });
  await br.close();
})();
