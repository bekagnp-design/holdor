# v1.0.82 — the result screen: a ribbon, rays, three stars that land one by one, the gold counting up, confetti; a red ribbon on a loss.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('result.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", """
/* v1.0.82: the result screen */
.card.res{position:relative;overflow:visible;text-align:center;border-radius:20px;border-width:3px}
.card.res.win{background:radial-gradient(120% 60% at 50% 0%,#4a3a8a,#1c1440 55%,#0e0a22);border-color:#e3b661;box-shadow:0 0 0 2px #2a1a05,0 0 40px rgba(255,200,90,.35),0 18px 40px rgba(0,0,0,.6)}
.card.res.lose{background:radial-gradient(120% 60% at 50% 0%,#5a1f1f,#2a0f12 55%,#140709);border-color:#9a2a2a;box-shadow:0 0 0 2px #1a0505,0 18px 40px rgba(0,0,0,.6)}
.card.res h1{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:-34px}
.card.res .rbn{display:inline-block;padding:8px 30px;font-family:var(--f-display);font-size:24px;font-weight:900;letter-spacing:.14em;color:#3a2205;
  background:linear-gradient(180deg,#ffe97a,#f2a62c);border:3px solid #7a4a10;border-radius:10px;box-shadow:0 5px 0 #7a4a10,0 10px 20px rgba(0,0,0,.5);clip-path:polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%);animation:jPop .45s cubic-bezier(.2,1.6,.4,1)}
.card.res.lose .rbn{color:#fff;background:linear-gradient(180deg,#e14b4b,#8a1d1d);border-color:#3a0808;box-shadow:0 5px 0 #3a0808,0 10px 20px rgba(0,0,0,.5)}
.card.res .big.stars{position:relative;display:flex;justify-content:center;align-items:flex-end;gap:6px;height:84px;margin:6px 0 4px;font-size:0}
.card.res .big.stars .rays{position:absolute;left:50%;top:50%;width:260px;height:260px;margin:-130px 0 0 -130px;border-radius:50%;background:repeating-conic-gradient(rgba(255,220,140,.22) 0 10deg,rgba(255,220,140,0) 10deg 24deg);animation:hmSpin 18s linear infinite;-webkit-mask:radial-gradient(circle,#000 20%,transparent 66%);mask:radial-gradient(circle,#000 20%,transparent 66%);pointer-events:none}
.card.res .rs{position:relative;font-size:54px;line-height:1;color:rgba(255,255,255,.12);text-shadow:0 3px 0 rgba(0,0,0,.4);opacity:0;scale:2.4;rotate:-25deg}
.card.res .rs:nth-of-type(2){font-size:68px;margin-bottom:8px}
.card.res .rs.on{color:#ffd54a;text-shadow:0 3px 0 #7a4a10,0 0 18px rgba(255,210,80,.8)}
.card.res .rs.landed{opacity:1;scale:1;rotate:0deg;transition:scale .35s cubic-bezier(.2,1.8,.4,1),rotate .35s ease-out,opacity .15s}
.card.res .resrow{margin-top:8px}
.rshake{animation:rShake .5s cubic-bezier(.36,.07,.19,.97)}
@keyframes rShake{10%,90%{translate:-2px 0}20%,80%{translate:4px 0}30%,50%,70%{translate:-7px 0}40%,60%{translate:7px 0}}
.rconf{position:fixed;top:-12px;z-index:150;width:8px;height:12px;border-radius:2px;pointer-events:none;animation:rFall 2s cubic-bezier(.3,.6,.5,1) both}
@keyframes rFall{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(var(--rx),105vh) rotate(var(--rr));opacity:.9}}
@media (prefers-reduced-motion: reduce){.card.res .rs{opacity:1;scale:1;rotate:0deg}.rconf{display:none}}
</style>
</head>""", 1, 'result-css')
