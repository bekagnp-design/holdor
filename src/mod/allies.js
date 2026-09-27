function rallyFor(s){let best=null,bd=1e9;for(const R of G.map.routes){for(let d=0;d<R.total;d+=5){const q=posAt(G.map,d,R.i);if(q.y<24)continue;const dd=dist(q.x,q.y,s.x,s.y);if(dd<bd){bd=dd;best=q;}}}return best?{x:best.x,y:Math.min(best.y,GATE_Y-16)}:{x:s.x,y:s.y+22};}
function spawnSoldier(s,t,st){
  if(t.rx==null){const r=rallyFor(s);t.rx=r.x;t.ry=r.y;}
  const k=G.allies.filter(a=>a.home===s.id).length,a=k*2.2;
  G.allies.push({kind:'keep',x:s.x+Math.cos(a)*10,y:s.y+Math.sin(a)*6,rx:t.rx+Math.cos(a)*11,ry:t.ry+Math.sin(a)*7,hp:st.shp,max:st.shp,dmg:st.sdmg,rate:0.75,atkT:0,t:Infinity,eng:0,home:s.id,house:true,face:1,id:G.eid++,spd:64,leash:54,bornT:G.time});
}
/* The road in front of a gate: the route whose dead are closest to their gate (Hodor's gate breaks a tie). */
function frontRoute(){const R=G.map.routes;let best=R[0],bv=-1;for(const r of R){let v=(G.hod&&G.hod.at===r.gate)?1:0;for(const e of G.enemies){if(e.hp<=0||e.fly||(e.route||0)!==r.i)continue;const rem=r.total-e.prog;if(rem<440)v+=440-rem;}if(v>bv){bv=v;best=r;}}return best;}
/* n posts on the road centre line, in pairs side by side, starting `from` px before the gate and stepping outwards */
function roadPosts(R,n,from){const out=[];for(let i=0;i<n;i++){const row=Math.floor(i/2),side=i%2?1:-1,d=Math.max(10,R.total-(from||56)-row*20);const p=posAt(G.map,d,R.i),q=posAt(G.map,Math.max(0,d-6),R.i);let dx=p.x-q.x,dy=p.y-q.y;const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;const off=(i===n-1&&n%2)?0:side*8;out.push({x:p.x-dy*off,y:p.y+dx*off});}return out;}
/* Sworn brothers (the spell) and the Host (an ultimate): they march out of the gate onto the road and fight whatever comes near. */
function sendBrothers(n,life,kind){
  const R=frontRoute(),g=G.map.gates[R.gate]||heldGate(),posts=roadPosts(R,n,54),br=kind==='brother';
  const tm=1+0.2*(maxTowerLvl()-1);
  posts.forEach((p,i)=>G.allies.push({kind,x:g.x+(i%2?6:-6),y:GATE_Y-6,rx:p.x,ry:p.y,hp:Math.round((br?150:170)*tm),max:Math.round((br?150:170)*tm),dmg:(br?15:17)*tm,rate:0.7,atkT:0,t:life,life,eng:0,id:G.eid++,bornT:G.time+i*0.16,house:!br,face:1,spd:86,leash:74,route:R.i}));
  addFx({t:'ring',x:g.x,y:GATE_Y-10,r0:6,r1:46,life:0.5,col:br?'#e9eef5':HOUSES[ACC.house].col});addFx({t:'puff',x:g.x,y:GATE_Y-8,r:24,life:0.6,rgb:'150,140,120'});
  addText(g.x,GATE_Y-44,br?'Sworn brothers!':'The Host rides!',br?'#e9eef5':HOUSES[ACC.house].col,1);SFX.play('horn',300);
}
/* Bannermen (a champion skill): they walk beside the champion and fight around him. */
function summonAllies(x,y,n,life,fromHero){for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2+0.6;G.allies.push({kind:'banner',x:x+Math.cos(a)*14,y:y+Math.sin(a)*10,hp:130,max:130,dmg:13,rate:0.7,atkT:0,t:life,life,eng:0,id:G.eid++,bornT:G.time+i*0.08,house:!!fromHero,face:1,spd:82,leash:64,follow:fromHero?'hero':null,fo:{x:Math.cos(a)*18,y:Math.sin(a)*8+10}});}if(fromHero)addFx({t:'ring',x,y,r0:4,r1:34,life:0.55,col:HOUSES[ACC.house].col});}
