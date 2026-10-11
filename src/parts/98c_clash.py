# v1.1.1 — Houses Clash I: the screen splits, the rival's lane on top (a bot), mine below; army points send the house's soldiers at
# the rival. Two simulations on one phone (the engine's state swapped). src/mod/clash.js + clash.css.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('clash.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('clash.css').rstrip('\n') + "\n</style>\n</head>", 1, 'clash-css')
# a clash battle sets itself up (a short road, no attempts, no daily modifier)
rep("else{const seed=hash32(todayKey);const gm=genDaily(seed);", "else if(o.mode==='clash'){map=clashSetup(o);}else{const seed=hash32(todayKey);const gm=genDaily(seed);", 1, 'clash-setup')
# the same waves on both lanes: the wave's recipe from its own rng
rep("G.spawnQueue=buildWave(G.wave,G.rng,G.wo);", "G.spawnQueue=buildWave(G.wave,G.wrng||G.rng,G.wo);", 1, 'clash-wrng')
# one step of mine, one of the rival's
rep("while(acc>=DT&&n<cap&&G.state==='play'){step();acc-=DT;n++;}", "while(acc>=DT&&n<cap&&G.state==='play'){step();if(CLASH.on)clashStepB();acc-=DT;n++;}", 1, 'clash-step')
# the two lanes drawn in two windows of the canvas
rep("  draw(now);requestAnimationFrame(frame);", "  if(CLASH.on)clashDraw(now);else draw(now);requestAnimationFrame(frame);", 1, 'clash-draw')
rep("function draw(now){\n  ctx.setTransform(scale*dpr,0,0,scale*dpr,0,0);", "function draw(now){\n  ctx.setTransform(scale*dpr,0,0,scale*dpr,0,(CLASH.on?CLASH.dy:0)*scale*dpr);", 1, 'clash-lane')
# taps: only my lane, shifted; the ring and the sheets follow
rep("  const w0=toWorld((ev.clientX-r.left)/scale,(ev.clientY-r.top)/scale);", "  if(CLASH.on&&(ev.clientY-r.top)/scale<H/2)return;\n  const w0=toWorld((ev.clientX-r.left)/scale,(ev.clientY-r.top)/scale);", 1, 'clash-tap')
rep("function toWorld(x,y){return{x:(x-W/2)/CAM.z+CAM.x,y:(y-H/2)/CAM.z+CAM.y};}", "function toWorld(x,y){if(CLASH.on)y-=CLASH.myDy;return{x:(x-W/2)/CAM.z+CAM.x,y:(y-H/2)/CAM.z+CAM.y};}", 1, 'clash-toworld')
rep("function w2s(x,y){return{x:canvas.offsetLeft+((x-CAM.x)*CAM.z+W/2)*scale,y:canvas.offsetTop+((y-CAM.y)*CAM.z+H/2)*scale};}", "function w2s(x,y){return{x:canvas.offsetLeft+((x-CAM.x)*CAM.z+W/2)*scale,y:canvas.offsetTop+((y-CAM.y)*CAM.z+H/2+(CLASH.on?CLASH.myDy:0))*scale};}", 1, 'clash-w2s')
# a broken door ends the clash, not the battle screen; sent soldiers are drawn as their house's troops; the strip follows a resize
rep("function gameOver(){\n  if(G.state!=='play')return;", "function gameOver(){\n  if(G.state!=='play')return;if(CLASH.on&&G.mode==='clash'){G.state='over';return;}", 1, 'clash-over')
rep("drawEnemySprite(e,x,y,now,1);}else drawDragon(e,now);}else drawWight(e,x,y,now);", "drawEnemySprite(e,x,y,now,1);}else drawDragon(e,now);}else if(e.troop)drawTroopBody(ctx,{x,y,face:e.face||1,role:e.role,troop:e.troop,moving:e.moving,walk:e.walk,strikeT:e.strikeT,hitT:e.hitT},now);else drawWight(e,x,y,now);", 1, 'clash-troop-enemy')
rep("function resize(){const st=$('#stage');scale=Math.min(st.clientWidth/W,st.clientHeight/H);canvas.width=Math.round(W*scale*dpr);canvas.height=Math.round(H*scale*dpr);canvas.style.width=(W*scale)+'px';canvas.style.height=(H*scale)+'px';}",
    "function resize(){const st=$('#stage');scale=Math.min(st.clientWidth/W,st.clientHeight/H);canvas.width=Math.round(W*scale*dpr);canvas.height=Math.round(H*scale*dpr);canvas.style.width=(W*scale)+'px';canvas.style.height=(H*scale)+'px';if(CLASH.on)clashLayout();}", 1, 'clash-resize')
# the rival's lane is silent
rep("window.HOLDOR={", "{const p0=SFX.play.bind(SFX);SFX.play=function(a,b,c){if(CLASH.on&&CLASH.lane==='B')return;return p0(a,b,c);};}\nwindow.HOLDOR={", 1, 'clash-silent')
# the Events page and the Clan tab open it
rep("  const ev=[\n    {k:'duel',live:true,", "  const ev=[\n    {k:'clash',live:true,n:'Houses Clash',s:'Your lane below, the rival\\'s above, the same dead on both — send the soldiers of your house down his road. A bot now; leagues and friends next.',st:'NEW',ic:HUB_ICON.clan},\n    {k:'duel',live:true,", 1, 'clash-event')
rep("bind('.evcard',b=>{if(b.dataset.ev==='hold')showHub('hold');else if(b.dataset.ev==='duel')showDuel();", "bind('.evcard',b=>{if(b.dataset.ev==='hold')showHub('hold');else if(b.dataset.ev==='clash')showClash();else if(b.dataset.ev==='duel')showDuel();", 1, 'clash-event-bind')
# the Clan tab: a card under the realm
rep("${realm}${clans}${fr}`;}", "${realm}${clashCardHTML()}${clans}${fr}`;}", 1, 'clash-clan-card')
rep("on('bClWar',()=>{SFX.play('tap',60);showRealmWar(()=>showHub('clan'));});", "on('bClWar',()=>{SFX.play('tap',60);showRealmWar(()=>showHub('clan'));});on('bClashCard',()=>{SFX.play('tap',60);showClash(()=>showHub('clan'));});", 1, 'clash-clan-bind')
