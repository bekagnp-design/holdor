/* v1.1.7: the first battle in six short steps, and a big CALL WAVE button (the ⚔ banner on the map hid under the tutorial text) */
(function(){
  if(TUT_STEPS.length===13){
    const keep=[0,1,2,3,4,5,12],S=TUT_STEPS.slice();
    const tx=(i,plain,story)=>{S[i].t=()=>ACC&&ACC.sv?(typeof story==='function'?story():story):(typeof plain==='function'?plain():plain);};
    tx(0,'The dead are marching on the door. Hodor holds it; you build the towers.','Seven hours to dawn. The dead march on the door. Hodor holds it; you build the towers.');
    tx(1,'Tap the big ⚔ CALL WAVE button. The tower by the door will shoot.','Tap the big ⚔ CALL WAVE button and count the knocks.');S[1].hint='Tap the glowing button';
    tx(3,'Gold builds towers. Tap the glowing ring and build a second one.','Gold builds towers. Tap the glowing ring and build a second one.');
    tx(4,'Your champion arrives. Tap the ground where they should stand.','Your champion arrives. Tap the ground where they should stand.');
    const sk=()=>{const u=SK[G.hero.c.sk[2]];return 'This is your champion\'s own skill: '+u.n+'. Tap it.';};
    tx(5,sk,sk);
    tx(12,'That is all. Hold the gate!','That is all. Hold the gate, and listen for the knock.');
    TUT_STEPS.length=0;keep.forEach(i=>TUT_STEPS.push(S[i]));
  }
})();
const CALLB={el:null,t:0};
function callBtnInit(){
  const st=document.getElementById('stage');if(!st||CALLB.el)return;
  const b=document.createElement('button');b.id='bCall';b.className='callbtn';b.hidden=true;b.textContent='⚔ CALL WAVE';
  b.addEventListener('click',()=>{callWave();callBtnTick();});st.appendChild(b);CALLB.el=b;
  setInterval(callBtnTick,250);
}
function callBtnTick(){
  const b=CALLB.el;if(!b)return;
  const ok=typeof G!=='undefined'&&G&&(G.mode==='campaign'||G.mode==='online')&&canCall();
  b.hidden=!ok;if(!ok)return;
  b.textContent='⚔ CALL WAVE'+(G.nextIn>1?'  +'+Math.ceil(G.nextIn)+'🪙':'');
  b.classList.toggle('want',!!(G.tut&&typeof tutWantBase==='function'&&tutWantBase()==='call'));
}
callBtnInit();
