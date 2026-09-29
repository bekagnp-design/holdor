# v1.0.60 — Telegram Stars (backend v9): dragonglass packs and the Starter pack, paid in Stars. The app asks the server for an invoice,
# opens it in Telegram, waits for the server's "paid" and reads its balance. Nothing is credited by the app.
rep("\n</style>\n</head>", mod('stars.css').rstrip('\n') + "\n</style>\n</head>", 1, 'stars-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('stars.js').rstrip('\n') + '\n' + s[i:]
rep("await gearLoadRaw(false);ecoTicker();", "await gearLoadRaw(false);starsResume();ecoTicker();", 1, 'stars-resume')
hrep("""  return `<div class="hh"><h2>Daily deals</h2>""", """  return `${starsStarterHTML()}<div class="hh"><h2>Daily deals</h2>""", 1, 'shop-starter')
i = hub.find("""  <div class="hh" style="margin-top:14px"><h2>Dragonglass</h2><small>coming with Telegram Stars</small></div>"""); assert i > 0, 'dragonglass block'
j = hub.find("</div>`;}", i); assert j > i
hub = hub[:i] + "  ${starsShopHTML()}`;}" + hub[j + len("</div>`;}"):]
hrep("bind('[data-unl]',b=>{if(unlockDeal(+b.dataset.unl)){SFX.play('unlock');showHub('shop');}else SFX.play('deny');});",
     "bind('[data-unl]',b=>{if(unlockDeal(+b.dataset.unl)){SFX.play('unlock');showHub('shop');}else SFX.play('deny');});\n  bind('[data-stars]',b=>starsBuy(b.dataset.stars));", 1, 'stars-bind')
