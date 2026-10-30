// An 8-second vertical trailer, drawn by the real game: deterministic frames (the page's requestAnimationFrame is ours), captions on top.
// usage: node make_trailer.js [outDir] [fromSec toSec]   (frames are JPEGs; audio.py + ffmpeg make the video; see build_trailer.sh)
const { chromium } = require('/home/user/holdor/node_modules/playwright');
const fs = require('fs'), path = require('path');
const OUT = path.resolve(process.argv[2] || '/tmp/trailer_frames'); fs.mkdirSync(OUT, { recursive: true });
const FPS = 30, DUR = 8, from = +(process.argv[3] || 0), to = +(process.argv[4] || DUR);
const CAPS = [
  [0.0, 0.9, 'Everyone said the Door was safe.', 'card'],
  [0.9, 1.6, 'Everyone was wrong.', 'card'],
  [1.6, 2.9, 'One guard.<br>Lots of towers.', 'cap'],
  [3.0, 4.9, 'Your hero learns a skill<br>mid-fight.', 'top'],
  [5.0, 5.9, 'Set things on fire.<br>Responsibly.', 'cap'],
  [6.7, 8.0, '<b>HOLDOR</b><small>Hold the Door</small><em>Free on Telegram</em><u>t.me/HoldorTDBot/play</u>', 'end'],
];
const EV = []; const at = (t, js) => EV.push({ t, js });
at(0.0, `(()=>{const H=window.HOLDOR;const a=H.newAccount('stark',0,'squire');a.intro=1;a.tut=1;a.sv=0;a.castle=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};const L=window.HOLDOR_TUT.LESSONS;a.learn={};(Array.isArray(L)?L.map(l=>l.id||l.k):Object.keys(L)).forEach(k=>a.learn[k]=1);for(let i=1;i<=30;i++)a.campaign[i]=3;a.sel='robb';a.loadout=['jars','beacon','arrows'];a.gold=99999;H.setAcc(a);H.persist();H.startGame({mode:'campaign',level:H.LEVELS.find(l=>l.id===12)});const G=H.G;G.gold=2200;G.speed=1;G.waveDone=true;G.nextIn=999;window.__H=H;})()`);
at(1.6, `(()=>{const G=__H.G;G.speed=2;G.nextIn=0;G.waveDone=true;})()`);
const towers = ['watch', 'wild', 'glass', 'scorp', 'weir', 'keep'];
towers.forEach((k, i) => at(1.7 + i * 0.25, `(()=>{const G=__H.G;G.gold=3000;const ss=G.map.slots.filter(s=>!s.tower).sort((a,b)=>b.y-a.y);const s=ss[${i}%ss.length];if(s)__H.build(s,'${k}');})()`));
at(2.0, `(()=>{__H.G.speed=3;})()`);
at(3.0, `(()=>{const G=__H.G;G.speed=3;G.wave=Math.max(G.wave,2);G.waveDone=true;G.nextIn=0;G.hero.hp=G.hero.max;})()`);
at(3.4, `(()=>{const G=__H.G;if(!G.learnAsk){G.learnDone={};G.waveDone=true;G.nextIn=0;}})()`);
at(4.4, `(()=>{const L=window.HOLDOR_LEARN,G=__H.G;if(G.learnAsk)L.learnPick(G.learnAsk[1]);G.speed=3;})()`);
at(5.0, `(()=>{const G=__H.G,S=window.HOLDOR_SP;G.powerCd.jars=0;const e=G.enemies.filter(e=>e.hp>0).sort((a,b)=>b.prog-a.prog)[0];if(e){const p=window.HOLDOR.posAt(G.map,e.prog,e.route||0);S.castPower('jars',p.x,p.y);}})()`);
at(5.4, `(()=>{const G=__H.G,S=window.HOLDOR_SP;G.powerCd.beacon=0;S.castPower('beacon');})()`);
at(5.8, `(()=>{const H=__H,G=H.G;G.speed=1;for(const k of ['warhammer','howl','rations']){G.learnAsk=[k];window.HOLDOR_LEARN.learnPick(k);}G.hLv=2;G.kills=Math.max(G.kills,64);window.__resT=0;window.HOLDOR_MARKET.showCampaignResult(true,3,[],12);})()`);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true });
  await p.addInitScript(() => { window.__raf = []; window.requestAnimationFrame = cb => { window.__raf.push(cb); return window.__raf.length; }; window.cancelAnimationFrame = () => {};
    let __T = 0; performance.now = () => __T; Date.now = () => 1.7e12 + __T;
    window.__tick = now => { __T = now; const l = window.__raf; window.__raf = []; for (const cb of l) { try { cb(now); } catch (e) {} } }; });
  await p.goto('file:///home/user/holdor/beta/index.html'); await p.waitForFunction(() => window.HOLDOR && window.HOLDOR_MARKET, { timeout: 30000 });
  for (let i = 0; i < 5; i++) await p.evaluate(t => window.__tick(t), 1000 + i * 33);
  await p.addStyleTag({ content: `#boonOv .bo-in{transform:scale(.84)}#boonOv .linkbtn,#boonOv .bo-have{visibility:hidden}#bCall,#bInfo,#bSpeed,#bPause{visibility:hidden!important}#tvc{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;text-align:center;pointer-events:none;background:#05070c;color:#ffd54a;font:900 30px Cinzel,Georgia,serif;letter-spacing:.04em;padding:30px;text-shadow:0 3px 0 #000}
    #tvp{position:fixed;left:0;right:0;bottom:118px;z-index:99998;text-align:center;pointer-events:none;color:#fff;font:900 26px Cinzel,Georgia,serif;text-shadow:0 3px 0 #000,0 0 14px #000,0 0 26px #000;padding:0 16px;line-height:1.15}
    #tve{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 40%,#1d2f55,#05070c 75%);pointer-events:none;color:#fff;font-family:Cinzel,Georgia,serif;text-align:center}
    #tve b{font-size:44px;color:#ffd54a;letter-spacing:.08em;text-shadow:0 4px 0 #6b4a00}#tve small{font-size:22px;letter-spacing:.3em;color:#bfe6ff}#tve em{font-style:normal;font-size:26px;margin-top:22px;color:#fff}#tve u{text-decoration:none;font-size:18px;color:#ffd54a}` });
  await p.evaluate(() => { for (const id of ['tvc', 'tvp', 'tve']) { const d = document.createElement('div'); d.id = id; d.style.display = 'none'; document.body.appendChild(d); } });
  const base = 5000; let ei = 0; const f0 = Math.floor(from * FPS), f1 = Math.floor(to * FPS);
  // run the events before `from`
  for (let f = 0; f < f1; f++) {
    const t = f / FPS;
    while (ei < EV.length && EV[ei].t <= t) { await p.evaluate(EV[ei].js); ei++; }
    await p.evaluate(now => window.__tick(now), base + f * (1000 / FPS));
    if (f < f0) continue;
    const c = CAPS.find(c => t >= c[0] && t < c[1]);
    await p.evaluate(([c, t]) => {
      const card = document.getElementById('tvc'), cap = document.getElementById('tvp'), end = document.getElementById('tve'); card.style.display = cap.style.display = end.style.display = 'none';
      if (window.__resT != null) { { const cd = document.getElementById('card'); if (cd) { cd.style.transform = 'translateY(116px) scale(.85)'; cd.style.transformOrigin = 'top center'; } } const ra = Math.max(0, t - 5.8) * 1000; for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = ra; } catch (e) {} } }
      if (!c) return; const k = Math.min(1, (t - c[0]) / 0.25), out = Math.min(1, (c[1] - t) / 0.2), al = Math.min(k, out);
      if (c[3] === 'card') { card.innerHTML = c[2]; card.style.display = 'flex'; card.style.opacity = al; }
      else if (c[3] === 'cap' || c[3] === 'top') { cap.style.bottom = c[3] === 'top' ? 'auto' : '118px'; cap.style.top = c[3] === 'top' ? '72px' : 'auto'; cap.innerHTML = c[2]; cap.style.display = 'block'; cap.style.opacity = al; cap.style.transform = 'translateY(' + ((1 - k) * 14) + 'px) scale(' + (0.96 + 0.04 * k) + ')'; }
      else { end.innerHTML = c[2]; end.style.display = 'flex'; end.style.opacity = Math.min(1, (t - c[0]) / 0.3); }
    }, [c, t]);
    await p.screenshot({ path: path.join(OUT, 'f' + String(f).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 88 });
    if (f % 60 === 0) console.log('frame', f, '/', f1);
  }
  await b.close();
})();
