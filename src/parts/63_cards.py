# v1.0.58 — card copies on the server (backend v7): a managed seat's copies come from the server (econ_state), a chest's
# card stacks are rolled there (chest_open → stacks / fills), the first win of a stage gives copies there. Guests unchanged.
rep("  const pool=cardPool(),used=new Set();\n  for(let i=0;i<T.cards;i++){const st=cardStack(pool,t,i<T.rare?Math.min(3,1+i):0,used);if(st)out.push(st);else{nf++;",
    "  if(R&&R.stacks){for(const x of R.stacks){const rr=cardRar(x.k);out.push({k:'card',key:x.k,cnt:x.n,r:rr,n:cardName(x.k),s:'+'+x.n+' card'+(x.n>1?'s':'')});}\n"
    "    for(let i=0;i<(R.fills||0);i++)out.push({k:'gold',n:'Gold',s:'+100',r:0});return out;}   /* the server rolled the stacks and already paid the empty slots */\n"
    "  const pool=cardPool(),used=new Set();\n  for(let i=0;i<T.cards;i++){const st=cardStack(pool,t,i<T.rare?Math.min(3,1+i):0,used);if(st)out.push(st);else{nf++;", 1, 'chest-server-stacks')
# the first win's copies: the server gives them (shown when its answer comes); guests still roll here
rep("G.cardReward=!prev?stageCards():null;", "G.cardReward=!prev&&!G.bid?stageCards():null;", 1, 'stage-cards-server')
