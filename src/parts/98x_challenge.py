# v1.3.8 — "Challenge a friend with my build": the share link carries the build (startapp=b_…), the receiver gets a sheet and a button for that stage. Local only.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('challenge138.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('challenge138.css').rstrip('\n') + "\n</style>\n</head>", 1, 'chal-css')
rep("function refJoinFromStart(){try{const sp=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.start_param;", "function refJoinFromStart(){try{const sp=chalSp(TG&&TG.initDataUnsafe&&TG.initDataUnsafe.start_param);", 1, 'chal-refjoin')
rep("function afterLoad(){\n  ecoStart();stClass();", "function afterLoad(){\n  ecoStart();stClass();try{chalFromStart(TG&&TG.initDataUnsafe&&TG.initDataUnsafe.start_param);}catch(e){}", 1, 'chal-afterload')
rep("shareText(buildShareText());", "chalShare(buildShareText());", 1, 'chal-share')
