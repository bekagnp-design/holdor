/* v1.3.6: every champion's blows look like him. The effect at the target follows the kind of his first skill (embers, frost, shock rings, slashes,
   green motes, gold stars, ghost smoke…) and his house colour. Display only: nothing here touches damage or the simulation. */
const SIGFX={dot:['fire','#ff8a3c',16],control:['burst','#9fe6ff',20],aoe:['ring','#ffd54a',30],rain:['slash','#ffe08a',0],heal:['burst','#8dffa0',16],shield:['hit','#bfe6ff',0],
  strike:['xslash','#fff3d0',0],buff:['burst','#ffd54a',18],summon:['puff','#9fb4cf',14],gold:['burst','#ffd23c',14],generic:['hit','#e9eef5',0]};
function sigStyle(c){const k=c&&c.sk&&c.sk[0];return SIGFX[skCat(k)]||SIGFX.generic;}
function heroSig(e){const h=G.hero;if(!h||!h.c||!e)return;const S=sigStyle(h.c),q=posE(e),hc=(HOUSES[ACC.house]||{}).col||'#fff';
  if(G.fx&&G.fx.length>90)return;
  if(S[0]==='fire')addFx({t:'fire',x:q.x,y:q.y-14,r0:3,r1:S[2],life:0.3,col:S[1]});
  else if(S[0]==='burst')addFx({t:'burst',x:q.x,y:q.y-14,r0:3,r1:S[2],life:0.3,col:S[1]});
  else if(S[0]==='ring')addFx({t:'ring',x:q.x,y:q.y-8,r0:4,r1:S[2],life:0.3,col:S[1]});
  else if(S[0]==='slash')addFx({t:'slash',x:q.x,y:q.y-14,life:0.25});
  else if(S[0]==='xslash')addFx({t:'xslash',x:q.x,y:q.y-14,life:0.3});
  else if(S[0]==='puff')addFx({t:'puff',x:q.x,y:q.y-16,r:S[2],life:0.4,dur:0.4,rgb:'150,170,200'});
  else addFx({t:'hit',x:q.x,y:q.y-14,life:0.2});
  addFx({t:'ring',x:q.x,y:q.y-14,r0:2,r1:9,life:0.18,col:hc});}
