# v1.1.4 — the champion reveal (a chest, a 3D card, a picture for every skill) and the interface that arrives one piece at a time.
# src/mod/skilldemo.js, reveal.js(+css), ui104.js(+css). Injected after the story flow (its showHub wrapper sits outside the story's).
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
for m in ('skilldemo.js', 'reveal.js', 'ui104.js'):
    i = s.find('window.HOLDOR={'); s = s[:i] + mod(m).rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('reveal.css').rstrip('\n') + "\n" + mod('ui104.css').rstrip('\n') + "\n</style>\n</head>", 1, 'reveal-css')
# the coach bubble can show a small looping picture instead of a face
rep("bub.querySelector('.cav').innerHTML=pu?`<img src=\"${pu}\" alt=\"\">`:(c?c.e:'🛡️');", "bub.querySelector('.cav').innerHTML=st.anim&&GANIM[st.anim]?GANIM[st.anim]:(pu?`<img src=\"${pu}\" alt=\"\">`:(c?c.e:'🛡️'));", 1, 'coach-anim')
