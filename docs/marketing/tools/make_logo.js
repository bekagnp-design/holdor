// The bot / channel logo (no text, so it reads at 48 px inside Telegram's circle) and the wide header, from the real shots.
// usage: CHROMIUM_PATH=... node docs/marketing/tools/make_logo.js   → avatar_v2_640.png, x_header_v2_1500x500.png
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const OUT = path.resolve(__dirname, '..') + '/', SH = OUT + 'shots/';
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(SH + f).toString('base64');
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640">
<defs>
<radialGradient id="bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#2b5a96"/><stop offset=".55" stop-color="#12284a"/><stop offset="1" stop-color="#070f20"/></radialGradient>
<radialGradient id="ice" cx="50%" cy="100%" r="60%"><stop offset="0" stop-color="#bfeaff" stop-opacity=".95"/><stop offset="1" stop-color="#6cc4ff" stop-opacity="0"/></radialGradient>
<linearGradient id="wood" x1="0" x2="1"><stop offset="0" stop-color="#5a3315"/><stop offset=".5" stop-color="#a0612a"/><stop offset="1" stop-color="#4c2a11"/></linearGradient>
<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c3d2"/><stop offset="1" stop-color="#6c7790"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#f0b83a"/><stop offset="1" stop-color="#a86d12"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".55"/></filter>
</defs>
<rect width="640" height="640" fill="url(#bg)"/>
<g fill="#dbeaff" opacity=".8"><circle cx="86" cy="120" r="4"/><circle cx="548" cy="96" r="3.5"/><circle cx="120" cy="300" r="3"/><circle cx="530" cy="270" r="4.5"/><circle cx="76" cy="470" r="3.5"/><circle cx="566" cy="448" r="3"/><circle cx="250" cy="70" r="3"/><circle cx="402" cy="60" r="4"/></g>
<g transform="translate(320 322) scale(1.12) translate(-320 -322)">
<g filter="url(#sh)">
<path d="M140 560 V270 C140 150 220 84 320 84 C420 84 500 150 500 270 V560 Z" fill="url(#stone)" stroke="#1a2236" stroke-width="10"/>
<g stroke="#4c566e" stroke-width="5" opacity=".55" fill="none"><path d="M140 330 H210 M430 330 H500 M140 420 H200 M440 420 H500 M140 500 H215 M425 500 H500"/><path d="M320 84 V150"/></g>
<path d="M200 560 V290 C200 214 252 168 320 168 C388 168 440 214 440 290 V560 Z" fill="url(#wood)" stroke="#1a1208" stroke-width="8"/>
<g stroke="#2e1a0a" stroke-width="5" opacity=".7"><path d="M262 178 V560 M320 168 V560 M378 178 V560"/></g>
<rect x="196" y="352" width="248" height="34" rx="10" fill="#1f2433"/><rect x="196" y="472" width="248" height="34" rx="10" fill="#1f2433"/>
<g fill="#aab4c8"><circle cx="222" cy="369" r="6"/><circle cx="418" cy="369" r="6"/><circle cx="222" cy="489" r="6"/><circle cx="418" cy="489" r="6"/></g>
<rect x="122" y="396" width="396" height="58" rx="16" fill="url(#gold)" stroke="#6b410a" stroke-width="7"/>
<rect x="132" y="404" width="376" height="14" rx="7" fill="#fff6c8" opacity=".6"/>
</g>
<path d="M200 560 V300 H440 V560 Z" fill="url(#ice)" opacity=".7"/>
</g>
</svg>`;
const header = `<!doctype html><meta charset=utf-8><style>*{margin:0;box-sizing:border-box}body{width:1500px;height:500px;overflow:hidden;position:relative;background:radial-gradient(900px 520px at 18% 45%,#1b3c6c 0,#0c1a33 58%,#070f1f 100%);font-family:Georgia,serif}
.logo{position:absolute;left:70px;top:120px;width:260px;height:260px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 6px #e6b13a,0 14px 40px rgba(0,0,0,.55)}
h1{position:absolute;left:372px;top:104px;font-size:124px;line-height:1;letter-spacing:.02em;background:linear-gradient(#ffe9a6,#e2a93a 62%,#9c6414);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 5px 0 #4a2e08)}
h2{position:absolute;left:380px;top:244px;font-size:30px;letter-spacing:.34em;color:#f3efe6}
p{position:absolute;left:380px;top:312px;font-size:26px;line-height:1.4;color:#d7e3f6;width:560px}
.ph{position:absolute;border-radius:28px;border:5px solid #1b2742;background:#05070d;overflow:hidden;box-shadow:0 24px 50px rgba(0,0,0,.6),0 0 0 2px #3a4a72}.ph img{width:100%;height:100%;object-fit:cover;display:block}
.a{left:1040px;top:30px;width:222px;height:462px;transform:rotate(-5deg);z-index:2}.b{left:1268px;top:52px;width:204px;height:426px;transform:rotate(5deg)}
</style><div class=logo>${logo.replace('width="640" height="640"','width="100%" height="100%"')}</div><h1>HOLDOR</h1><h2>HOLD THE DOOR</h2><p>Free tower defense in Telegram. Build towers, lead your champion, hold the door against the dead.</p>
<div class="ph a"><img src="${b64('battle96.png')}"></div><div class="ph b"><img src="${b64('home96.png')}"></div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p1 = await br.newPage({ viewport: { width: 640, height: 640 } }); await p1.setContent(`<body style="margin:0">${logo}</body>`); await p1.screenshot({ path: OUT + 'avatar_v2_640.png' });
  const p2 = await br.newPage({ viewport: { width: 1500, height: 500 } }); await p2.setContent(header); await p2.waitForTimeout(400); await p2.screenshot({ path: OUT + 'x_header_v2_1500x500.png' });
  await br.close();
})();
