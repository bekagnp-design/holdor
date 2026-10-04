# v1.0.91 — the realm chat (backend v23): src/mod/chat.js + chat.css; entered from the realm card of the player's own realm.
rep("\n</style>\n</head>", mod('chat.css').rstrip('\n') + "\n</style>\n</head>", 1, 'chat-css')
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('chat.js').rstrip('\n') + '\n' + s[i:]
rep('<button class="btn sec" id="bRcBack">◀ Back</button>`);\n  CLOUD.screen=\'realm:\'+j;', '${j===ACC.langI?\'<button class="btn" id="bRcChat">💬 Realm chat</button>\':\'\'}<button class="btn sec" id="bRcBack">◀ Back</button>`);\n  CLOUD.screen=\'realm:\'+j;', 1, 'chat-button')
rep("$('#bBack').addEventListener('click',back);$('#bRcBack').addEventListener('click',back);\n}", "$('#bBack').addEventListener('click',back);$('#bRcBack').addEventListener('click',back);\n  const rc=$('#bRcChat');if(rc)rc.addEventListener('click',()=>showChat(()=>showRealmCard(j,back)));\n}", 1, 'chat-bind')
