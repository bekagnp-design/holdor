function towerStats(t,ML){
  const d=TOWERS[t.type],l=t.lvl,k=t.type,L=ML||tLvl(k),m=1+0.03*(L-1),M=i=>L>=T_MILE[i];
  let range=(d.range+6*(l-1))*((G.mod&&G.mod.range)||1),dmg=d.dmg*Math.pow(1.38,l-1)*m,rate=d.rate*Math.pow(1.06,l-1),dps=(d.dps||0)*Math.pow(1.38,l-1)*m,burn=(d.burn||0)*Math.pow(1.3,l-1)*m,splash=(d.splash||0)+3*(l-1),slow=d.slow!=null?d.slow-(d.kind==='aura'?0.04:0.03)*(l-1):1,mark=(d.mark||1)+0.05*(l-1);
  if(k==='watch'){if(M(0))range*=1.08;if(M(1))dmg*=1.08;if(M(2))rate*=1.08;if(M(3))burn=Math.max(burn,6*m);}
  if(k==='scorp'){if(M(0))dmg*=1.08;if(M(2))rate*=1.10;}
  if(k==='wild'){if(M(0))splash*=1.12;if(M(1))dmg*=1.08;if(M(2))burn*=1.4;if(M(3))splash*=1.12;}
  if(k==='glass'){if(M(0))dps*=1.08;if(M(1))range*=1.10;if(M(2))slow-=0.05;if(M(3))dps*=1.10;}
  if(k==='weir'){slow-=0.004*(L-1);mark+=0.005*(L-1);if(M(0)){slow-=0.04;range*=1.06;}if(M(1))mark+=0.05;if(M(2))range*=1.08;if(M(3))slow-=0.04;}
  if(k==='keep'){const b={count:d.count[l-1],shp:d.shp[l-1]*m,sdmg:d.sdmg[l-1]*m,resp:d.resp[l-1]};
    if(M(0))b.shp*=1.08;if(M(1))b.count+=1;if(M(2))b.sdmg*=1.10;if(M(3))b.resp*=0.8;
    if(UP('sworn'))b.count+=1;b.count=Math.min(6,b.count);
    if(UP('training'))b.shp*=1.18;
    b.shp=Math.round(b.shp);b.sdmg=Math.round(b.sdmg*10)/10;b.resp=Math.round(b.resp*10)/10;
    return Object.assign({range,dmg,rate,dps,slow,mark,splash,burn},b);}
  return{range,dmg,rate,dps,slow,mark,splash,burn};}
