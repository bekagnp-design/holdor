function buildMap(o){
  const rng=mulberry32(o.seed);
  /* routes: o.routes = [[[x,y],...],...] each ending above its gate (several routes may share one gate); legacy o.pts = one route to the middle gate.
     Authored coordinates live in the old 560-tall space unless o.raw. o.style ('curve'|'bend') smooths the road. */
  const rawRoutes=o.routes||[o.pts];const gates=(o.gates||[GX]).map((gx,i)=>({x:gx,y:GATE_Y,i}));
  const sy=o.raw?1:(GATE_Y-60)/(LEGACY_GATE-60);
  const routes=rawRoutes.map((rp,i)=>{const g=gates[o.rg?o.rg[i]:Math.min(i,gates.length-1)];const pts=denseRoute(rp,g,o.style,sy);
    const segs=[];let total=0;for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1];const len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1e-6)continue;segs.push({a,b,len,start:total});total+=len;}return{pts,segs,total,gate:g.i,i};});
  const pts=routes[0].pts,segs=[].concat(...routes.map(r=>r.segs)),total=routes[0].total;
  const B=BIOMES[o.biome]||BIOMES.forest;
  const map={pts,segs,total,routes,gates,slots:[],deco:[],biome:BIOMES[o.biome]?o.biome:'forest',B,seed:o.seed};
  map.feat=waterFeat(o,rng);
  if(o.ponds){for(let tries=0;tries<300&&map.feat.ponds.length<o.ponds;tries++){const p={x:30+rng()*(W-60),y:50+rng()*(GATE_Y-170),rx:20+rng()*18,ry:10+rng()*7};if(distToPath(p.x,p.y,segs)<p.rx+30)continue;if(map.feat.ponds.some(q=>dist(q.x,q.y,p.x,p.y)<q.rx+p.rx+30))continue;map.feat.ponds.push(p);}}
  const len=routes.reduce((a,r)=>a+r.total,0);
  map.slots=pickSlots(map,rng,Math.max(12,Math.min(18,Math.round(len/(routes.length>1?125:98))))+(o.slotsBonus||0));
  map.deco=placeProps(map,rng);
  map.bg=renderBg(map,mulberry32(o.seed^0x9e3779b9));
  return map;
}
