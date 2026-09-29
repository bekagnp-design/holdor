/* v1.0.60 — no accidental zoom. iOS ignores user-scalable=no: a double tap on a HUD button (the speed button is tapped again and again) zooms the
   whole page, the canvas is cut off and every later tap lands beside its target. touch-action: manipulation (CSS) removes the double-tap zoom;
   these handlers stop the pinch, and any zoom that still gets through is undone. */
(function(){try{
  const stop=e=>{try{if(e.cancelable)e.preventDefault();}catch(_){}};
  ['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,stop,{passive:false}));
  document.addEventListener('touchstart',e=>{if(e.touches&&e.touches.length>1)stop(e);},{passive:false});
  document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)stop(e);},{passive:false});
  const vv=window.visualViewport;
  if(vv)vv.addEventListener('resize',()=>{if(vv.scale>1.02){const m=document.querySelector('meta[name=viewport]');if(!m)return;const c=m.content;
    m.content=c+', maximum-scale=1, minimum-scale=1';setTimeout(()=>{m.content=c;window.scrollTo(0,0);},150);}});
}catch(e){}})();
