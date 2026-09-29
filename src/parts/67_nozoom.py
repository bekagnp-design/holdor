# v1.0.60 — the page must never zoom under the player's fingers (iOS zoomed the HUD on repeated taps and the tutorial's taps stopped landing).
rep("\n</style>\n</head>", mod('nozoom.css').rstrip('\n') + "\n</style>\n</head>", 1, 'nozoom-css')
i = s.find("const TG=(()=>{try{const tg=window.Telegram"); assert i > 0, 'TG anchor'
s = s[:i] + mod('nozoom.js').rstrip('\n') + '\n' + s[i:]
rep('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">', '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no">', 1, 'viewport-meta')
