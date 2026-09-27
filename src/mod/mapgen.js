/* =========================== ROADS & BUILD SPOTS (v1.0.45) ===========================
   A route is a list of control points (raw world coordinates). style 'curve' threads a centripetal Catmull-Rom spline through them,
   style 'bend' keeps the straight runs and rounds every corner. Either way the result is a dense polyline, so movement is unchanged. */
function crDense(P,step){
  if(P.length<3)return P.map(p=>({x:p.x,y:p.y}));
  const E=[{x:2*P[0].x-P[1].x,y:2*P[0].y-P[1].y}].concat(P,[{x:2*P[P.length-1].x-P[P.length-2].x,y:2*P[P.length-1].y-P[P.length-2].y}]);
  const out=[{x:P[0].x,y:P[0].y}],tj=(a,b)=>Math.max(1e-3,Math.pow(Math.hypot(b.x-a.x,b.y-a.y),0.5));
  for(let i=1;i<E.length-2;i++){const p0=E[i-1],p1=E[i],p2=E[i+1],p3=E[i+2];const t0=0,t1=t0+tj(p0,p1),t2=t1+tj(p1,p2),t3=t2+tj(p2,p3);
    const n=Math.max(2,Math.ceil(Math.hypot(p2.x-p1.x,p2.y-p1.y)/step));
    for(let k=1;k<=n;k++){const t=t1+(t2-t1)*k/n;const L=(a,b,ta,tb)=>({x:(tb-t)/(tb-ta)*a.x+(t-ta)/(tb-ta)*b.x,y:(tb-t)/(tb-ta)*a.y+(t-ta)/(tb-ta)*b.y});
      const A1=L(p0,p1,t0,t1),A2=L(p1,p2,t1,t2),A3=L(p2,p3,t2,t3),B1=L(A1,A2,t0,t2),B2=L(A2,A3,t1,t3);out.push(L(B1,B2,t1,t2));}}
  return out;}
function bendDense(P,rad,step){
  const out=[{x:P[0].x,y:P[0].y}];
  for(let i=1;i<P.length-1;i++){const A=P[i-1],B=P[i],C=P[i+1];const lab=Math.hypot(A.x-B.x,A.y-B.y),lbc=Math.hypot(C.x-B.x,C.y-B.y);const r=Math.min(rad,lab*0.48,lbc*0.48);
    const b1={x:B.x+(A.x-B.x)/lab*r,y:B.y+(A.y-B.y)/lab*r},b2={x:B.x+(C.x-B.x)/lbc*r,y:B.y+(C.y-B.y)/lbc*r};
    const last=out[out.length-1],ls=Math.hypot(b1.x-last.x,b1.y-last.y),n0=Math.max(1,Math.ceil(ls/step));for(let k=1;k<=n0;k++)out.push({x:last.x+(b1.x-last.x)*k/n0,y:last.y+(b1.y-last.y)*k/n0});
    const n=Math.max(4,Math.ceil(r*1.6/step));for(let k=1;k<=n;k++){const t=k/n,u=1-t;out.push({x:u*u*b1.x+2*u*t*B.x+t*t*b2.x,y:u*u*b1.y+2*u*t*B.y+t*t*b2.y});}}
  const last=out[out.length-1],Z=P[P.length-1],ls=Math.hypot(Z.x-last.x,Z.y-last.y),n0=Math.max(1,Math.ceil(ls/step));for(let k=1;k<=n0;k++)out.push({x:last.x+(Z.x-last.x)*k/n0,y:last.y+(Z.y-last.y)*k/n0});
  return out;}
/* dense road for one route: always ends with a straight 60 px run into its gate */
function denseRoute(raw,g,style,sy){
  const P=raw.map(p=>({x:p[0],y:p[1]<0?p[1]:Math.round(-30+(p[1]+30)*sy)}));
  if(!style){P.push({x:g.x,y:g.y});return P;}
  const last=P[P.length-1];if(!(Math.abs(last.x-g.x)<1&&last.y>=GATE_Y-90))P.push({x:g.x,y:GATE_Y-66});else{last.x=g.x;last.y=Math.min(last.y,GATE_Y-66);}
  const D=style==='bend'?bendDense(P,34,7):crDense(P,7);D.push({x:g.x,y:g.y});
  const out=[D[0]];for(let i=1;i<D.length;i++){const a=out[out.length-1],b=D[i];if(Math.hypot(b.x-a.x,b.y-a.y)>=2.5||i===D.length-1)out.push(b);}return out;}
/* water on the battlefield: a sea edge on one side, a river band across, or ponds — roads cross rivers on bridges */
function waterFeat(o,rng){const f={};if(o.sea)f.sea={side:o.sea,w:o.seaW||58,ph:rng()*6.28};if(o.river!=null)f.river={y:o.river,w:26,ph:rng()*6.28,amp:9};if(o.ponds)f.ponds=[];return f;}
function seaEdge(f,y){const s=f.sea;return s.w+10*Math.sin(y/53+s.ph)+6*Math.sin(y/19+s.ph*2);}
function riverY(f,x){const r=f.river;return r.y+r.amp*Math.sin(x/47+r.ph)+4*Math.sin(x/17+r.ph);}
function inWater(map,x,y,pad){const f=map.feat||{};pad=pad||0;
  if(f.sea){const e=seaEdge(f,y)+pad;if(f.sea.side==='L'?x<e:x>W-e)return true;}
  if(f.river){const ry=riverY(f,x);if(Math.abs(y-ry)<f.river.w/2+pad)return true;}
  if(f.ponds)for(const p of f.ponds)if(((x-p.x)/(p.rx+pad))**2+((y-p.y)/(p.ry+pad))**2<1)return true;
  return false;}
/* build spots: greedy weighted cover of the road (every spot sees fresh road first, loops and bends are worth more) */
function pickSlots(map,rng,want){
  const R=map.routes,samples=[];for(const r of R)for(let d=24;d<r.total-10;d+=10){const p=posAt(map,d,r.i);if(p.y<18)continue;samples.push({x:p.x,y:p.y,w:0.7+0.6*d/r.total,c:0});}
  const cand=[];
  for(const r of R)for(let d=30;d<r.total-24;d+=12){const p=posAt(map,d,r.i),q=posAt(map,d+6,r.i);let dx=q.x-p.x,dy=q.y-p.y;const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
    for(const sd of[-1,1])for(const off of[44,52]){const c={x:p.x-dy*off*sd,y:p.y+dx*off*sd};
      if(c.x<24||c.x>W-24||c.y<66||c.y>GATE_Y-54)continue;if(distToPath(c.x,c.y,map.segs)<37)continue;if(inWater(map,c.x,c.y,14))continue;
      if(map.gates.some(g=>Math.abs(c.x-g.x)<40&&c.y>GATE_Y-80))continue;cand.push(c);}}
  const slots=[],RR=106;
  for(let k=0;k<want;k++){let best=null,bv=0;
    for(const c of cand){if(slots.some(s=>dist(s.x,s.y,c.x,c.y)<47))continue;let v=0;for(const s of samples){const d=dist(s.x,s.y,c.x,c.y);if(d<RR)v+=s.w*(1-d/RR*0.5)/(1+s.c);}v*=0.97+rng()*0.06;if(v>bv){bv=v;best=c;}}
    if(!best)break;slots.push(best);for(const s of samples)if(dist(s.x,s.y,best.x,best.y)<RR)s.c++;}
  slots.sort((a,b)=>a.y-b.y||a.x-b.x);slots.forEach((s,i)=>{s.id=i;s.tower=null;});return slots;}
