# v1.0.88 — the item up close: the forge's item sheet opens with a large view of the item (src/mod/gearbig.js) instead of the small icon.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('gearbig.js').rstrip('\n') + '\n' + s[i:]
rep('<div class="gsheet" style="--gc:${R[1]}">${gearIcon(it,34)}', '<div class="gsheet" style="--gc:${R[1]}">${gearBig(it)}', 1, 'gear-big')
rep("\n</style>\n</head>", """
/* v1.0.88: the item up close */
.gbig{position:relative;width:156px;height:156px;margin:4px auto 10px;border-radius:20px;border:2px solid color-mix(in srgb,var(--gc,#5a6c85) 80%,#3a2c20);background:radial-gradient(circle at 50% 38%,#4c4034,#1e1813 68%,#120e0b);box-shadow:inset 0 3px 12px rgba(0,0,0,.85),0 8px 20px rgba(0,0,0,.5);perspective:440px}
.gbig.r4{box-shadow:inset 0 3px 12px rgba(0,0,0,.85),0 0 22px rgba(230,180,90,.45)}
.gbig.r3{box-shadow:inset 0 3px 12px rgba(0,0,0,.85),0 0 16px rgba(160,110,220,.35)}
.gbw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:18px;overflow:hidden;touch-action:none;transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .35s ease-out}
.gbw.tilt{transition:transform .08s linear}
.gbw svg,.gbw img{position:relative;z-index:1;width:84%;height:84%;object-fit:contain;filter:drop-shadow(0 7px 4px rgba(0,0,0,.6));animation:gbSway 6s ease-in-out infinite}
.gbsh{position:absolute;left:24%;right:24%;bottom:9%;height:9%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.6),transparent);animation:gbShadow 6s ease-in-out infinite}
.gbgl{position:absolute;inset:-30%;z-index:2;pointer-events:none;background:linear-gradient(115deg,transparent 42%,rgba(255,244,220,.28) 50%,transparent 58%);animation:gbGlint 4.5s ease-in-out infinite}
.gbset{position:absolute;left:-6px;top:-7px;z-index:3;font-size:18px;line-height:1;background:#0b1a2e;border-radius:8px;padding:2px 3px}
@keyframes gbSway{0%,100%{transform:rotate(-4deg) translateY(1px)}50%{transform:rotate(4deg) translateY(-4px)}}
@keyframes gbShadow{0%,100%{transform:scaleX(1);opacity:1}50%{transform:scaleX(.82);opacity:.7}}
@keyframes gbGlint{0%,55%{transform:translateX(-60%)}100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.gbw svg,.gbw img,.gbsh,.gbgl{animation:none}}
</style>
</head>""", 1, 'gearbig-css')
