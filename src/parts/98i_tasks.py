# v1.1.6 — Tasks made clear (after the home part, so hubTasks here includes the Daily card). src/mod/tasks106.js + tasks106.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('tasks106.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('tasks106.css').rstrip('\n') + "\n</style>\n</head>", 1, 'tasks-css')
rep("  invBind();tkTick();\n}", "  card.querySelectorAll('.tkbody [data-tog]').forEach(b=>b.addEventListener('click',()=>{SFX.play('tap',50);const t=card.querySelector('[data-tgt=\"'+b.dataset.tog+'\"]');if(!t)return;t.hidden=!t.hidden;if(b.dataset.tog==='tk-inv'){TASKS.invOpen=!t.hidden;b.textContent=b.textContent.replace(/[⌃›]\\s*$/,t.hidden?'›':'⌃');}}));\n  invBind();tkTick();\n}", 1, 'tasks-toggles')
