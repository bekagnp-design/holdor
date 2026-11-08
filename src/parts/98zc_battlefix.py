# battle-screen fixes. src/mod/battlefix150.js + battlefix150.css.
#  1. the new-enemy toast: the name was centred on x+42 (textAlign stayed 'center' after the N badge whenever the enemy had a
#     picture), so it ran back over the badge and the icon; now it is left-aligned after the icon, with a wider pill.
#  2. the spell buttons: the name sits above the cooldown cover and turns light while the button is disabled (CSS).
#  3. the champion's speech bubble is not drawn while a build ring is open (the ring's buttons cut it to pieces).
#  4. the CALL WAVE button: moves off the build pads per stage and hides while a ring is open.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('battlefix150.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('battlefix150.css').rstrip('\n') + "\n</style>\n</head>", 1, 'battlefix-css')
# 1. the toast
rep("const w=tw+62,h=22,x=W/2-w/2,y=64+(1-k)*-6;", "const w=tw+66,h=22,x=W/2-w/2,y=64+(1-k)*-6;", 1, 'toast-width')
rep("const eim=enemyImg(c.key);if(eim){ctx.drawImage(eim,x+23,y+2,18,18);}else{ctx.font='13px serif';ctx.textAlign='left';ctx.fillText(E.e,x+24,y+16);}",
    "const eim=enemyImg(c.key);if(eim){ctx.drawImage(eim,x+24,y+2,18,18);}else{ctx.font='13px serif';ctx.textAlign='left';ctx.fillText(E.e,x+24,y+16);}", 1, 'toast-icon')
rep("ctx.fillStyle='#2e2113';ctx.font='700 9px Cinzel,serif';ctx.fillText(name,x+42,y+14.5);",
    "ctx.fillStyle='#2e2113';ctx.font='700 9px Cinzel,serif';ctx.textAlign='left';ctx.fillText(name,x+46,y+14.5);G.ncBox={x,y,w,h,ix:x+24,iw:18,tx:x+46,tw,align:ctx.textAlign};", 1, 'toast-name')
# 3. the bubble
rep("if(el>=1||!G.hero||G.hero.dead||!G.heroOn||G.state!=='play')G.hsay=null;else drawBubble(G.hsay.txt,el,G.hero.x,G.hero.y-48,'italic 700 12.5px \"EB Garamond\",serif',G.hsay.col);}",
    "if(el>=1||!G.hero||G.hero.dead||!G.heroOn||G.state!=='play')G.hsay=null;else if(typeof RING!=='undefined'&&RING)G.hsayHid=(G.hsayHid||0)+1;else{G.hsayHid=0;drawBubble(G.hsay.txt,el,G.hero.x,G.hero.y-48,'italic 700 12.5px \"EB Garamond\",serif',G.hsay.col);}}", 1, 'bubble-ring')
# 4. CALL WAVE
rep("{const sh=document.getElementById('sheet');b.hidden=!ok||G.state!=='play'||!!(sh&&sh.classList.contains('open'));}if(b.hidden)return;",
    "{const sh=document.getElementById('sheet');b.hidden=!ok||G.state!=='play'||!!(sh&&sh.classList.contains('open'))||!!(typeof RING!=='undefined'&&RING);}if(b.hidden)return;", 1, 'call-ring')
rep("b.textContent='⚔ CALL WAVE'+(G.nextIn>1?'  +'+Math.ceil(G.nextIn)+'🪙':'');",
    "b.textContent='⚔ CALL WAVE'+(G.nextIn>1?'  +'+Math.ceil(G.nextIn)+'🪙':'');callBtnPlace(b);", 1, 'call-place')
rep("RING={s,items:[],arm:null};G.sel=s;ringEl.hidden=false;renderRing();SFX.play('tap');}",
    "RING={s,items:[],arm:null};G.sel=s;ringEl.hidden=false;renderRing();SFX.play('tap');if(typeof callBtnTick==='function')callBtnTick();}", 1, 'ring-open-call')
rep("RING=null;ringEl.hidden=true;ringEl.innerHTML='';ringTip.hidden=true;G.pending=null;",
    "RING=null;ringEl.hidden=true;ringEl.innerHTML='';ringTip.hidden=true;G.pending=null;if(typeof callBtnTick==='function')callBtnTick();", 1, 'ring-close-call')
