  for(const a of G.allies){
    a.t-=dt;a.atkT-=dt;if(a.bornT!=null&&G.time<a.bornT)continue;if(a.stunT>0){a.stunT-=dt;continue;}
    if(a.follow==='hero'){if(G.heroOn&&!h.dead){a.rx=h.x+a.fo.x;a.ry=h.y+a.fo.y;}}
    let tgt=null,td=1e9;
    for(const e of G.enemies){if(e.hp<=0||e.fly)continue;const q=posE(e);const d=dist(q.x,q.y,a.x,a.y);if(d<=26+e.r&&d<td){td=d;tgt=e;}}
    if(tgt){const q=posE(tgt);a.face=q.x<a.x?-1:1;a.moving=false;if(a.atkT<=0){a.atkT=a.rate;a.strikeT=G.time;dmg(tgt,a.dmg,'ally');}continue;}
    /* nobody in reach: go for the nearest ground enemy near the post that nobody else is already walking to */
    const ax=a.rx!=null?a.rx:a.x,ay=a.ry!=null?a.ry:a.y,L=a.leash||56;let seek=null,sd=1e9;
    for(const e of G.enemies){if(e.hp<=0||e.fly||e.air||e.charge)continue;const q=posE(e);if(q.y<26)continue;if(dist(q.x,q.y,ax,ay)>L+e.r)continue;let d=dist(q.x,q.y,a.x,a.y);if(e.claim===G.tick)d+=70;if(e.pblk==='hero')d+=45;if(d<sd){sd=d;seek=e;}}
    let tx=ax,ty=ay;if(seek){seek.claim=G.tick;const q=posE(seek);tx=q.x;ty=q.y;}
    const dx=tx-a.x,dy=ty-a.y,dd=Math.hypot(dx,dy);
    if(dd>(seek?12:3)){const stp=Math.min(dd,(a.spd||60)*dt);a.x+=dx/dd*stp;a.y+=dy/dd*stp;a.walk=(a.walk||0)+stp/60;a.moving=true;if(Math.abs(dx)>0.5)a.face=dx<0?-1:1;}
    else a.moving=false;
    if(!seek&&a.hp<a.max)a.hp=Math.min(a.max,a.hp+7*dt);
  }
