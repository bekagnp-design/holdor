# v1.0.59 — champions and the tavern: five rarities (by opening order), stars ★1–6 and levels up to 60, a star raised
# by burning another champion's cards, skill ranks that need books, books in chests and deals, the summon portal.
rep("\n</style>\n</head>", mod('tavern.css').rstrip('\n') + "\n</style>\n</head>", 1, 'tavern-css')
i = s.find("function heroTalent(champId,slot){"); assert i > 0, 'heroTalent anchor'
s = s[:i] + mod('tavern.js').rstrip('\n') + '\n' + s[i:]
rep("function showHeroRoom(viewId){\n  const hh=HOUSES[ACC.house]", "function showHeroRoom0(viewId){\n  const hh=HOUSES[ACC.house]", 1, 'old-hero-room')

# ---- cards: five rarities; levels 20 → 60 need few copies (the stars carry the long road) ----
rep("const CARD_NEED=[2,3,4,6,8,10,13,16,20,25,30,36,43,51,60,70,82,95,110];",
    "const CARD_NEED=[2,3,4,6,8,10,13,16,20,25,30,36,43,51,60,70,82,95,110," + ",".join(str(l) for l in range(20, 60)) + "];", 1, 'card-need-60')
rep("const CARD_MUL=[1,0.5,0.25,0.1];", "const CARD_MUL=[1,0.7,0.5,0.25,0.1];", 1, 'card-mul-5')
rep("const RAR_N=['Common','Rare','Epic','Legendary'],RAR_C=['#8a97a8','#4fb0ff','#b47cff','#e3b661'];",
    "const RAR_N=['Common','Uncommon','Rare','Epic','Legendary'],RAR_C=['#8a97a8','#5fbf6a','#4fb0ff','#b47cff','#e3b661'];", 1, 'rar-5')
rep("const T_RAR={watch:0,glass:0,keep:1,scorp:1,wild:2,weir:3},S_RAR={arrows:0,reinf:1,fire:2}",
    "const T_RAR={watch:0,glass:0,keep:2,scorp:2,wild:3,weir:4},S_RAR={arrows:0,reinf:2,fire:3}", 1, 'rar-towers-5')
rep("const CARD_PRICE=[25,50,100,250];", "const CARD_PRICE=[25,35,50,100,250];", 1, 'card-price-5')
rep("return c?Math.min(3,Math.floor((c.tier||0)/2)):0;}return t==='t'?", "return c?champRar(c):0;}if(t==='b')return BOOK_R[id]||0;return t==='t'?", 1, 'card-rar-champ')
rep("function cardName(key){const [t,id]=key.split(':');return t==='c'?", "function cardName(key){const [t,id]=key.split(':');return t==='b'?BOOK_N[id]:t==='c'?", 1, 'card-name-book')
rep("function cardIcon(key,px){const [t,id]=key.split(':');if(t==='c')", "function cardIcon(key,px){const [t,id]=key.split(':');if(t==='b')return bookIcon(id,px||40);if(t==='c')", 1, 'card-icon-book')
rep("function cardReady(key){return cardLvl(key)<cardMax(key)&&", "function cardReady(key){return cardLvl(key)<cardCap(key)&&", 1, 'card-ready-star')
rep("const w=k=>[10,6,3,1][cardRar(k)];", "const w=k=>[10,8,6,3,1][cardRar(k)];", 1, 'stack-weights-5')
rep("i<T.rare?Math.min(3,1+i):0", "i<T.rare?Math.min(4,2+i):0", 1, 'rare-slots-5')
rep("for(let i=0;i<(R.fills||0);i++)out.push({k:'gold',n:'Gold',s:'+100',r:0});return out;}",
    "for(let i=0;i<(R.fills||0);i++)out.push({k:'gold',n:'Gold',s:'+100',r:0});chestBooks(t,R,out);return out;}", 1, 'chest-books-server')
rep("if(R&&nf)ecoOp({r:'chestfill',k:R.id,n:nf},{g:100*nf});\n  return out;}", "if(R&&nf)ecoOp({r:'chestfill',k:R.id,n:nf},{g:100*nf});\n  chestBooks(t,R,out);return out;}", 1, 'chest-books-local')

# ---- champions: up to 60 levels (the star opens ten at a time); the rarity lifts the base ----
rep("const CH_MAX=20,", "const CH_MAX=60,", 1, 'ch-max-60')
rep("const hp=Math.round(base.hp*(1+0.05*(L-1))", "const hp=Math.round(base.hp*RAR_STAT[champRar(c)]*(1+0.05*(L-1))", 2, 'hero-hp-rar')   # the battle and the Book
rep("dm=Math.round(base.dmg*(1+0.04*(L-1))*10)/10;", "dm=Math.round(base.dmg*RAR_STAT[champRar(c)]*(1+0.04*(L-1))*10)/10;", 1, 'book-dmg-rar')
rep("dmg:base.dmg*(1+0.04*(L-1))", "dmg:base.dmg*RAR_STAT[champRar(c)]*(1+0.04*(L-1))", 1, 'hero-dmg-rar')
hrep("const RARITY=[['Common','#8a97a8'],['Common','#8a97a8'],['Rare','#4fb0ff'],['Rare','#4fb0ff'],['Epic','#b47cff'],['Epic','#b47cff'],['Legendary','#e3b661']];",
     "const RARITY=[0,0,1,2,2,3,4].map(r=>[['Common','Uncommon','Rare','Epic','Legendary'][r],['#8a97a8','#5fbf6a','#4fb0ff','#b47cff','#e3b661'][r]]);", 1, 'rarity-5')
hrep('<span class="lv">LVL ${p.lvl}</span>', '<span class="lv">${cstar(c.id)}★ · ${p.lvl}</span>', 1, 'champ-card-stars')
hrep("const RC=['#8a97a8','#4fb0ff','#b47cff','#e3b661'],RN=['Common','Rare','Epic','Legendary'];", "const RC=RAR_C,RN=RAR_N;", 1, 'chest-rar-5')
hrep("SFX.play(r.r>=3?'legend':r.r>=2?'epic':'card',70);", "SFX.play(r.r>=4?'legend':r.r>=3?'epic':'card',70);", 1, 'chest-sfx-5')

# ---- deals: books instead of a cheap skill rank; card deals keep their frame colours ----
hrep("()=>{const c=pick(mine);if(!c)return null;const p=cprog(null,c.id);const i=[0,1,2].filter(j=>p.sk[j]<SK_MAX&&p.sk[j]<rankCap(p.lvl));if(!i.length)return null;const j=pick(i);return{k:'sk',",
     "()=>{const b=pick(['c','c','c','c','r','r','r','e','e','l']),n=b==='c'?rnd(2,3):1;return{k:'books',key:'b:'+b,cnt:n,n:BOOK_N[b],s:`${n} × ${BOOK_N[b]} · skill ranks`,price:{gold:n*BOOK_PRICE[b]},ic:bookIcon(b,40),r:DEAL_R[BOOK_R[b]]};},\n    ()=>{const c=pick(mine);if(!c||true)return null;const p=cprog(null,c.id);const i=[0,1,2].filter(j=>p.sk[j]<SK_MAX&&p.sk[j]<rankCap(p.lvl));if(!i.length)return null;const j=pick(i);return{k:'sk',", 1, 'deal-books')
hrep("r:Math.max(1,r)}", "r:Math.max(1,DEAL_R[r])}", 2, 'deal-card-colour')
hrep("else if(d.k==='cards')addCards(d.key,d.cnt);", "else if(d.k==='cards'||d.k==='books')addCards(d.key,d.cnt);", 1, 'deal-buy-books')
rep("else if(d.k==='cards'){g.key=d.key;g.cnt=d.cnt;}", "else if(d.k==='cards'||d.k==='books'){g.key=d.key;g.cnt=d.cnt;}", 1, 'deal-op-books')
rep("d.k==='cards'?{cards:[d.key,-d.cnt]}:null", "d.k==='cards'||d.k==='books'?{cards:[d.key,-d.cnt]}:null", 1, 'deal-undo-books')

# ---- the server's stars and early-opened champions ----
rep("if(p.lvl<TAL_AT)p.tal=0;}", "p.st=Math.max(1,+L['st:'+id]||0);if(p.lvl<TAL_AT)p.tal=0;}", 1, 'eco-stars')
rep("if(st.cards&&typeof st.cards==='object')ACC.cards=Object.assign({},st.cards);",
    "if(st.cards&&typeof st.cards==='object')ACC.cards=Object.assign({},st.cards);\n    if(st.copen&&typeof st.copen==='object')ACC.copen=Object.assign(ACC.copen||{},st.copen);   /* v1.0.59: champions opened by the portal */", 1, 'eco-copen')
rep("JSON.stringify(ACC.deals),ACC.army&&ACC.army.lvl].join('|');", "JSON.stringify(ACC.deals),JSON.stringify(ACC.cards),JSON.stringify(ACC.copen),ACC.army&&ACC.army.lvl].join('|');", 1, 'eco-sig')

# ---- the Tavern button beside the Forge ----
hrep('<div class="castlerow forgerow"><button class="cbld" id="bForge">',
     '<div class="castlerow forgerow"><button class="cbld" id="bTavern"><span class="ic">🍺</span><span class="tx"><b>Tavern</b><small>stars · skills · portal</small></span></button><button class="cbld" id="bForge">', 1, 'tavern-row')
hrep("const bf=$('#bForge');", "const btv=$('#bTavern');if(btv)btv.addEventListener('click',()=>{SFX.play('tap',60);showHeroRoom();});const bf=$('#bForge');", 1, 'tavern-bind')
rep("stacks:r.stacks,fills:+r.fills||0};", "stacks:r.stacks,fills:+r.fills||0,books:r.books||[]};", 1, 'chest-roll-books')
# the notes and the lessons: champions now go to 60, ten levels a star
rep("champions 1–20 (+5% health, +4% damage a level)", "champions 1–60 (a star ★ opens ten levels at a time; +5% health, +4% damage a level)", 1, 'notes-60')
rep("champions 1–20, spells 1–10.", "champions 1–60 (ten levels a star ★), spells 1–10.", 1, 'lesson-60')
