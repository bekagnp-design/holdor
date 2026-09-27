# ---- Brothers / Host / Bannermen / Keep soldiers: march to the road, seek and fight, readable figures ----
i = s.find('function rallyFor(s){'); j = s.find('function ultCine(h,id){', i); assert 0 < i < j
s = s[:i] + mod('allies.js') + s[j:]
rep("case'reinforce':summonAllies(gate.x,GATE_Y-48,v,15,true);break;", "case'reinforce':sendBrothers(v,15,'host');break;", label='host')
rep("else{const g=heldGate();summonAllies(g.x,GATE_Y-48,UP('sworn')?4:2,15);addFx({t:'ring',x:g.x,y:GATE_Y-48,r0:6,r1:40,life:0.5,col:'#e9eef5'});}",
    "else{sendBrothers(UP('sworn')?5:3,15,'brother');}", label='brothers')
rep("for(const e of G.enemies){e.slow=1;e.mark=1;e.blockedBy=null;e.hasted=1;}",
    "for(const e of G.enemies){e.slow=1;e.mark=1;e.pblk=e.blockedBy;e.blockedBy=null;e.hasted=1;}", label='pblk')
i = s.find('  for(const a of G.allies){\n    a.t-=dt;a.atkT-=dt;'); j = s.find('  for(const p of G.projs){', i); assert 0 < i < j and j - i < 900
s = s[:i] + mod('ally_step.js') + s[j:]
rep("else if(!e.charge&&!e.air){for(const a of G.allies){if(a.eng<1&&dist(p.x,p.y,a.x,a.y)<=24+e.r){",
    "else if(!e.charge&&!e.air){for(const a of G.allies){if(a.eng<1&&(a.bornT==null||G.time>=a.bornT)&&dist(p.x,p.y,a.x,a.y)<=24+e.r){", label='block')
rep("else{blocker.hp-=e.dps*0.7;if(e.knock)blocker.stunT=1.5;}}}", "else{blocker.hp-=e.dps*0.7;blocker.hitT=G.time;if(e.knock)blocker.stunT=1.5;}}}", label='allyhit')
rep("for(const a of G.allies)if(a.home===s0.id){a.rx=s0.tower.rx;a.ry=s0.tower.ry;}",
    "{let k=0;for(const a of G.allies)if(a.home===s0.id){const an=(k++)*2.2;a.rx=s0.tower.rx+Math.cos(an)*11;a.ry=s0.tower.ry+Math.sin(an)*7;}}", label='rallymove')
i = s.find('function drawAlly(a,now){'); j = s.find('function drawTower(s,now){', i); assert 0 < i < j
s = s[:i] + mod('ally_draw.js') + s[j:]
# spell text
rep("reinf:{e:'🛡️',n:'Brothers',cd:30,at:5,d:'Sworn brothers hold the gate for 15 s'}", "reinf:{e:'🛡️',n:'Brothers',cd:30,at:7,d:'Three sworn brothers march out of the gate and fight on the road for 15 s'}", label='reinfdesc')
rep("{id:'sworn',g:'power',s:'+2 men, keeps +1',e:'🛡️',n:'Sworn brothers',d:'Reinforcements send 4 men instead of 2.',c:2}",
    "{id:'sworn',g:'power',s:'+2 brothers, keeps +1',e:'🛡️',n:'Sworn brothers',d:'The Brothers spell sends 5 men instead of 3, and every Watch keep holds one more.',c:2}", label='sworndesc')
