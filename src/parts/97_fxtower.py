# v1.0.97 — the tower guide (what each tower does, in the game's own numbers, with a looping demo) and tower fx in battle
# (Dragonglass spears, Weirwood wave + roots, Wildfire bloom, Scorpion charge, Keep sparks). src/mod/fxtower.js. Display only.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('fxtower.js').rstrip('\n') + '\n' + s[i:]
rep("fxbUnder(now);for(const p of G.projs)drawProj(p);", "fxbUnder(now);fxtUnder(now);for(const p of G.projs)drawProj(p);", 1, 'fxt-under')
rep("<p class=\"sub\">${d.sub}. ${line}${d.kind==='barracks'?'':' · range '+d.range}</p>", "<p class=\"sub\">${d.sub}</p>${towerGuideMini(type,1)}", 1, 'guide-confirm')
rep("<p class=\"sub\">${def.sub}. ${line}${def.kind==='barracks'?'':', range '+Math.round(st.range)}</p>", "<p class=\"sub\">${def.sub}</p>${towerGuideMini(t.type,t.lvl)}", 1, 'guide-sheet')
rep('<div class="bktiers">${tiers}</div>', '${towerGuideDemo(k,tier)}<div class="bktiers">${tiers}</div>', 1, 'guide-book')
rep("\n</style>\n</head>", """
/* v1.0.97: the tower guide */
.tg{margin:6px 0 4px;font-size:12px;line-height:1.35;color:#c9d6e8}
.tg .tgh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.tg .tgh span{font-weight:700;color:#e3b661;font-size:11px;letter-spacing:.04em}.tg .tgh em{font-style:normal;color:#dfe8f5}
.tg .tgn{display:flex;flex-wrap:wrap;gap:4px 10px;margin:5px 0}.tg .tgn span{white-space:nowrap}.tg .tgn b{color:#fff;font-weight:700}
.tg .tgs{display:flex;flex-direction:column;gap:2px}.tg .tgs i{font-style:normal}.tg .tgs .ok{color:#9fe3a4}.tg .tgs .no{color:#f1a79c}
.tgd{position:relative;height:58px;margin:8px 0 2px;border-radius:10px;background:linear-gradient(#1b2b44,#0f1a2c);overflow:hidden}
.tgd .tw{position:absolute;left:10px;bottom:6px;text-decoration:none}.tgd .en{position:absolute;bottom:10px;width:12px;height:22px;border-radius:6px 6px 3px 3px;background:#6f7d90;box-shadow:0 0 0 1px #2a3446;text-decoration:none}
.tgd .fx,.tgd .fx2{position:absolute;text-decoration:none;pointer-events:none}
.tgd.arrow .en{left:78%;animation:tgHit 1.4s ease-out infinite}.tgd.arrow .fx{left:22%;bottom:30px;width:14px;height:2px;background:#e8eef7;box-shadow:-6px 0 0 -0 #8a96a6;animation:tgArrow 1.4s linear infinite}
.tgd.bolt .en{left:80%;width:18px;height:28px;background:#59687b;animation:tgHit 2.4s ease-out infinite}.tgd.bolt .fx{left:22%;bottom:28px;width:26px;height:4px;background:#e3b661;box-shadow:0 0 8px #e3b661;animation:tgBolt 2.4s linear infinite}
.tgd.lob .en{left:76%;animation:tgHit 2.2s ease-out infinite}.tgd.lob .fx{left:22%;bottom:30px;width:9px;height:9px;border-radius:50%;background:#8dff6d;box-shadow:0 0 8px #6cf05a;animation:tgLob 2.2s linear infinite}.tgd.lob .fx2{left:68%;bottom:6px;width:46px;height:30px;border-radius:50%;background:radial-gradient(#9dff7d,rgba(110,240,90,0));opacity:0;animation:tgBloom 2.2s linear infinite}
.tgd.spears .en{left:50%;animation:tgSlow 3.2s linear infinite}.tgd.spears .fx{left:calc(50% + 2px);bottom:6px;width:0;height:0;border:4px solid transparent;border-bottom:26px solid #9fe0ff;border-top:0;transform-origin:50% 100%;animation:tgSpear 3.2s ease-out infinite}.tgd.spears .fx2{left:calc(50% - 14px);bottom:8px;width:30px;height:10px;border-radius:50%;border:1px solid rgba(143,211,255,.5)}
.tgd.roots .en{left:34%;animation:tgSlow2 4s ease-in-out infinite}.tgd.roots .fx{left:6%;bottom:2px;width:70%;height:34px;border-radius:50%;border:2px solid rgba(155,230,110,.65);animation:tgWave 2.2s ease-out infinite}.tgd.roots .fx2{left:calc(34% - 4px);bottom:7px;width:22px;height:6px;border-bottom:2px solid #7a5230;border-radius:0 0 50% 50%}
.tgd.clash .en{left:62%;animation:tgBump 1.2s ease-in-out infinite}.tgd.clash .fx{left:calc(62% - 12px);bottom:24px;width:10px;height:10px;border-radius:50%;background:#fff1c0;box-shadow:0 0 10px 3px #ffd479;animation:tgSpark 1.2s ease-out infinite}
@keyframes tgArrow{0%{transform:translateX(0)}60%,100%{transform:translateX(150px);opacity:1}100%{opacity:0}}
@keyframes tgBolt{0%{transform:translateX(0);opacity:0}15%{opacity:1}60%{transform:translateX(170px)}100%{transform:translateX(170px);opacity:0}}
@keyframes tgLob{0%{transform:translate(0,0)}50%{transform:translate(85px,-26px)}100%{transform:translate(170px,0);opacity:0}}
@keyframes tgBloom{0%,70%{opacity:0;transform:scale(.5)}80%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.2)}}
@keyframes tgHit{0%,55%{filter:none}60%{filter:brightness(2.4)}100%{filter:none}}
@keyframes tgSlow{0%{left:30%}100%{left:80%}}@keyframes tgSlow2{0%{left:30%}100%{left:56%}}
@keyframes tgSpear{0%,10%{transform:scaleY(0)}25%{transform:scaleY(1)}60%{opacity:1}100%{opacity:0;transform:scaleY(1)}}
@keyframes tgWave{0%{transform:scale(.2);opacity:.9}100%{transform:scale(1);opacity:0}}
@keyframes tgBump{0%,100%{transform:translateX(4px)}50%{transform:translateX(-3px)}}@keyframes tgSpark{0%,40%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}
@media (prefers-reduced-motion:reduce){.tgd *{animation:none!important}}
</style>
</head>""", 1, 'guide-css')
