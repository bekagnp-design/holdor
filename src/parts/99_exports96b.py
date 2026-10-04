# v1.0.96 test hooks: the menu motion layer, and a timer around the battle's draw() (only when a test turns it on).
rep("window.HOLDOR={", """window.HOLDOR_FXUI={FXUI,fxuiHub,fxuiOff,fxuiCalm,fxuiLive,fxuiParTo,ecoModal,homeRaf:()=>HOME.raf,
  drawTimer(){if(window.__fxDT)return window.__fxDT;const T={ms:0,n:0},d0=draw;draw=function(){const t=performance.now();const r=d0.apply(this,arguments);T.ms+=performance.now()-t;T.n++;return r;};window.__fxDT=T;return T;}};
window.HOLDOR={""", 1, 'exports96b')
