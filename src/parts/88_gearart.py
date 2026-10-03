# v1.0.85 — item art: every item is drawn (a family of shapes, its own proportions per kind, metal by rarity, the set's colour);
# painted GEAR_ART still wins when it exists. src/mod/gearart.js.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('gearart.js').rstrip('\n') + '\n' + s[i:]
rep('${art?`<img src="${art}" alt="">`:k[1]}', '${art?`<img src="${art}" alt="">`:gearArt(it.slot,k[0],it.r,it.set)}', 1, 'gear-art')
rep("\n</style>\n</head>", """
/* v1.0.85: drawn items */
.gic svg{width:82%;height:82%;filter:drop-shadow(0 2px 1px rgba(0,0,0,.55))}
.gic.r3,.gic.r4{overflow:hidden}
.gic.r3::after,.gic.r4::after{content:'';position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:gaShine 3.4s ease-in-out infinite;pointer-events:none}
@keyframes gaShine{0%,60%{transform:translateX(-60%)}100%{transform:translateX(60%)}}
.gic.r4{box-shadow:0 0 12px rgba(255,200,90,.55)}
</style>
</head>""", 1, 'gearart-css')
rep('return `<span class="gic" style="--gc:${R[1]};', 'return `<span class="gic r${it.r}" style="--gc:${R[1]};', 1, 'gear-rclass')
