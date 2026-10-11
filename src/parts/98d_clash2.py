# v1.1.2 — Houses Clash II (backend v32): ghosts (a real player's recorded log replayed on the top lane), leagues on the PvP rating,
# friend clashes by link, practice paid by the server. src/mod/clash2.js. Patches the v1.1.1 clash where the rival is made.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('clash2.js').rstrip('\n') + '\n' + s[i:]
# the v1.1.1 screen stays for guests
rep("function showClash(back){const R=clashRec(),hh=HOUSES[ACC.house],lv=['Bronze','Silver','Gold','Crystal','Dragon'];", "function showClashLocal(back){const R=clashRec(),hh=HOUSES[ACC.house],lv=['Bronze','Silver','Gold','Crystal','Dragon'];", 1, 'clash2-local')
# a ghost rival: its champion rides on lane B, its log drives the lane; the kind and the code travel with the clash
rep("Object.assign(CLASH,{on:false,B:null,lane:'A',dy:0,myDy:H/2-CLASH_TOP,pts:3,bpts:3,ptsT:0,bptsT:0,win:null,t:0,log:[],fin:false,",
    "Object.assign(CLASH,{on:false,B:null,lane:'A',dy:0,myDy:H/2-CLASH_TOP,pts:3,bpts:3,ptsT:0,bptsT:0,win:null,t:0,log:[],fin:false,ghost:null,kind:o.kind||'practice',code:o.code||null,", 1, 'clash2-kind')
rep("opp:{name:'Bot '+['I','II','III','IV','V'][bot-1],house:oh,bot}});",
    "opp:o.ghost?{name:o.ghost.name||'Ghost',house:oh,bot:0,ghost:o.ghost}:{name:'Bot '+['I','II','III','IV','V'][bot-1],house:oh,bot}});if(o.ghost)clashGhostInit(o.ghost);", 1, 'clash2-opp')
rep("startGame0({mode:'clash',seed,lane:'B',house:oh});   /* its own map object: towers live on the slots */G.heroOn=false;G.hero.dead=true;G.hero.hp=0;",
    "const sel0=ACC.sel;if(o.ghost&&o.ghost.champ&&CBY[o.ghost.champ])ACC.sel=o.ghost.champ;startGame0({mode:'clash',seed,lane:'B',house:oh});ACC.sel=sel0;   /* its own map object: towers live on the slots */if(!o.ghost){G.heroOn=false;G.hero.dead=true;G.hero.hp=0;}", 1, 'clash2-hero')
rep("gSwap();try{if(G.state==='play'){clashBot();step();}}catch(e){console.error(e);}gSwap();", "gSwap();try{if(G.state==='play'){if(CLASH.ghost)clashGhostStep();else clashBot();step();}}catch(e){console.error(e);}gSwap();", 1, 'clash2-step')
# the result: the server's verdict under the local one
rep("<p class=\"m\">Record: ${R.w}W · ${R.l}L · ${R.d}D</p>", "<p class=\"m\" id=\"clSrv\"></p><p class=\"m\">Record: ${R.w}W · ${R.l}L · ${R.d}D</p>", 1, 'clash2-srv')
rep("$('#bClHome').addEventListener('click',()=>{clashStop();showHub('battle');});CLASH.back=()=>showHub('events');},w==='A'?600:900);}",
    "$('#bClHome').addEventListener('click',()=>{clashStop();showHub('battle');});CLASH.back=()=>showHub('events');clashAfter(w);},w==='A'?600:900);}", 1, 'clash2-after')
rep("$('#bClAgain').addEventListener('click',()=>{overlay.classList.add('hidden');clashStart({bot:clashRec().bot});});",
    "$('#bClAgain').addEventListener('click',()=>{overlay.classList.add('hidden');if(CLASH.kind==='rank'&&clashServer())cl2Go('rank');else clashStart({bot:clashRec().bot,kind:'practice'});});", 1, 'clash2-again')
# the link
rep("if(sp&&/^d_[0-9a-f]{8}$/i.test(sp)){DUEL.pending=sp.slice(2);return;}", "if(sp&&/^d_[0-9a-f]{8}$/i.test(sp)){DUEL.pending=sp.slice(2);return;}if(cl2FromStart(sp))return;", 1, 'clash2-start')
# the result's line: a guest is told why nothing is paid; a managed seat gets the server's verdict instead
rep("Practice pays nothing yet — gold, leagues and friends come with the server record.</p>", "${clashServer()?'':'Practice pays nothing for a guest — a seat signed in through Telegram gets gold, leagues and friends.'}</p>", 1, 'clash2-note')
rep("gLoad(A);CLASH.B=B;CLASH.on=true;CLASH.lane='A';", "gLoad(A);CLASH.B=B;CLASH.on=true;CLASH.lane='A';if(o.ghost)clashHeroBar();", 1, 'clash2-herobar')
