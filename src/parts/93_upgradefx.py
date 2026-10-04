# v1.0.90 — the forge scene: an anvil, a hammer and sparks while the server decides an upgrade or a tier, then the verdict (src/mod/upgradefx.js).
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
a = s.find('function gearUpgrade(id,cid,filter){'); b = s.find('function gearEquip('); assert 0 < a < b, 'gearUpgrade/gearTierUp'
s = s[:a] + s[b:]                                   # the old upgrade and tier functions go; the module defines them (with the scene)
i = s.find("/* =========================== THE BOOK (v1.0.50)")
s = s[:i] + mod('upgradefx.js').rstrip('\n') + '\n' + s[i:]
rep("ecoToast('⚠️ '+(ecoNet(m)?'No connection to the server':m));SFX.play('deny');}}", "ecoToast('⚠️ '+(ecoNet(m)?'No connection to the server':m));SFX.play('deny');gfxEnd();}}", 1, 'gfx-fail-ends-scene')
rep("\n</style>\n</head>", """
/* v1.0.90: the forge scene */
#gfx{position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;background:rgba(6,4,3,.93);animation:gfIn .25s ease-out}
@keyframes gfIn{from{opacity:0}to{opacity:1}}
#gfx .gfs{position:relative;width:300px;height:380px}
#gfx .gfi{position:absolute;left:50%;top:70px;transform:translateX(-50%);transform-origin:50% 100%}
#gfx .gfi .gbig{margin:0;pointer-events:none}
#gfx .gfa{position:absolute;left:50%;top:238px;width:230px;transform:translateX(-50%);filter:drop-shadow(0 8px 6px rgba(0,0,0,.6))}
#gfx .gfh{position:absolute;left:158px;top:34px;width:130px;height:130px;transform-origin:50% 96%;animation:gfSwing .62s ease-in infinite;filter:drop-shadow(0 6px 4px rgba(0,0,0,.55))}
#gfx .gfh.calm{animation:none;transform:rotate(-40deg)}
@keyframes gfSwing{0%{transform:rotate(26deg)}45%{transform:rotate(34deg)}62%{transform:rotate(-62deg)}72%{transform:rotate(-52deg)}100%{transform:rotate(26deg)}}
#gfx.hit .gfi{animation:gfThump .2s ease-out}
@keyframes gfThump{0%{transform:translateX(-50%) scaleY(.94)}100%{transform:translateX(-50%) scaleY(1)}}
#gfx .gfk{position:absolute;width:5px;height:5px;margin:-2px;border-radius:50%;background:#ffd98a;box-shadow:0 0 6px 2px rgba(255,170,60,.9);animation:gfFly .6s ease-out forwards;pointer-events:none}
#gfx .gfk.g{width:6px;height:6px;background:#fff3c0;box-shadow:0 0 9px 3px rgba(255,200,80,1)}
@keyframes gfFly{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
#gfx .gft{position:absolute;left:0;right:0;top:10px;text-align:center;pointer-events:none}
#gfx .gft b{display:block;font:900 54px/1 var(--f-display);color:#ffe08a;text-shadow:0 3px 0 #5a3a08,0 0 22px rgba(255,200,80,.9);animation:gfRise .9s cubic-bezier(.2,1.3,.4,1) both}
#gfx.lose .gft b{font-size:26px;color:#c9c2b8;text-shadow:0 2px 0 #2a2622;animation:gfRise .5s ease-out both}
#gfx .gft small{display:block;margin-top:4px;font:700 13px var(--f-display);color:#9fb6c9}
@keyframes gfRise{0%{transform:translateY(24px) scale(.4);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
#gfx.win .gfi .gbig{animation:gfWin .7s ease-out;box-shadow:0 0 36px 8px rgba(255,210,100,.75)}
@keyframes gfWin{0%{filter:brightness(3.2)}100%{filter:brightness(1)}}
#gfx.win .gfs::before{content:'';position:absolute;left:50%;top:148px;width:30px;height:30px;margin:-15px;border-radius:50%;border:5px solid #ffe08a;box-shadow:0 0 20px #ffd060;animation:gfRing .8s ease-out forwards}
@keyframes gfRing{0%{transform:scale(.4);opacity:1}100%{transform:scale(11);opacity:0}}
#gfx.lose .gfi{animation:gfShake .5s linear}
@keyframes gfShake{0%,100%{transform:translateX(-50%)}20%{transform:translateX(calc(-50% - 7px))}40%{transform:translateX(calc(-50% + 7px))}60%{transform:translateX(calc(-50% - 4px))}80%{transform:translateX(calc(-50% + 3px))}}
#gfx .gfm{position:absolute;top:190px;width:34px;height:34px;margin-left:-17px;border-radius:50%;background:radial-gradient(circle,rgba(150,148,142,.8),rgba(90,88,84,0) 70%);animation:gfSmoke 1.1s ease-out forwards;opacity:0}
@keyframes gfSmoke{0%{transform:translateY(0) scale(.5);opacity:.9}100%{transform:translateY(-120px) scale(2.6);opacity:0}}
#gfx.tier .gfs::before{border-color:#c8a2ff;box-shadow:0 0 20px #9a5cff}
@media (prefers-reduced-motion:reduce){#gfx,#gfx *{animation-duration:.01s!important}}
</style>
</head>""", 1, 'gfx-css')
