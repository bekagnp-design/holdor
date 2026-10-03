/* =========================== FEEL (v1.0.81) ===========================
   The phone answers the hand: Telegram's haptic feedback on taps and rewards, and big kills that land.
   · a light tap on every button; success on claims, chests, level-ups and wins; a warning on a refusal; a heavy thump for the
     Night King, a lieutenant or a roar; a medium knock when the door is hit (at most every 0.4 s)
   · a boss, a lieutenant, a giant or a mini-boss going down: a short hit-stop, a shake, a white flash and a ring — display only
     (the frame waits a moment; the simulation runs the same steps)
   Off when Telegram has no haptics (a browser) or the sound is muted. */
const FEEL={t:0,door:0};
function hapt(kind){try{if(typeof SFX!=='undefined'&&SFX.muted)return;const h=TG&&TG.HapticFeedback;if(!h)return;const now=performance.now();
  if(kind==='door'){if(now-FEEL.door<400)return;FEEL.door=now;}else if(now-FEEL.t<60)return;FEEL.t=now;
  if(kind==='ok')h.notificationOccurred('success');else if(kind==='no')h.notificationOccurred('error');else if(kind==='warn')h.notificationOccurred('warning');
  else h.impactOccurred(kind==='heavy'?'heavy':kind==='door'||kind==='mid'?'medium':kind==='soft'?'soft':'light');}catch(e){}}
const FEEL_SFX={tap:'light',swipe:'soft',collect:'ok',buy:'ok',levelup:'ok',win:'ok',chestopen:'mid',legend:'heavy',epic:'mid',deny:'no',lose:'warn',gate:'door',king:'heavy',roar:'heavy',dragon:'heavy',ult:'mid',upgrade:'ok',unlock:'ok'};
if(typeof SFX!=='undefined'&&SFX.play){const play0=SFX.play.bind(SFX);SFX.play=function(n,gap){play0(n,gap);const k=FEEL_SFX[n];if(k)hapt(k);};}
/* a big kill lands: called from kill() — reads the enemy, writes only display fields */
function feelKill(e,q){if(!(e.boss||e.lord||e.giant||e.mini||e.king))return;
  G.hitStop=Math.max(G.hitStop||0,e.king?0.22:e.boss||e.lord?0.14:0.08);G.shake=Math.min(10,(G.shake||0)+(e.king?8:e.boss||e.lord?5:3));
  addFx({t:'flash',x:q.x,y:q.y,life:e.king?0.5:0.3,col:'#ffffff'});addFx({t:'ring',x:q.x,y:q.y,r0:8,r1:e.king?200:110,life:0.5,col:e.walker||e.king?'#cdf1ff':'#ffe1a0'});
  hapt(e.king||e.boss||e.lord?'heavy':'mid');}
