# v1.5.0 — the Shop made simple: one card style, the price as one tag with its currency, a green CLAIM / BUY when the player can pay
# and a grey "Need N more" when he cannot, the locked picks as a short row, the balance pinned on top with what each currency buys;
# sections: For you today (deals + timer) · Chests · Gold for dragonglass · Dragonglass for Stars (Starter pack first) · Season Pass & VIP
# as one card. src/mod/shop150.js + shop150.css. hubShopBind, starsBuy and every data-* purchase path are unchanged; hubShopV1 keeps the old drawing.
rep("function hubShop(){const free=freeChestReady()", "function hubShop(){return shop150HTML();}\nfunction hubShopV1(){const free=freeChestReady()", 1, 'shop150-hub')
rep("function hubShopBind(){homeMovedBind();", "function hubShopBind(){homeMovedBind();shop150Bind();", 1, 'shop150-bind')
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('shop150.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('shop150.css').rstrip('\n') + "\n</style>\n</head>", 1, 'shop150-css')
