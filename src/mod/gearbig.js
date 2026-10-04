/* =========================== THE ITEM UP CLOSE (v1.0.88) ===========================
   Tapping an item in the forge shows it large: the drawing (or the painted art) on a dark leather stand, swaying slowly, a glint of light
   passing over it, and a finger (or the mouse) tilts it in 3D. The rarity rims the stand; Legendary glows. Display only. */
function gearBig(it){const k=gearKind(it),art=GEAR_ART[it.slot+':'+k[0]]||GEAR_ART[it.slot];
  return `<div class="gbig r${it.r}" style="--gc:${GEAR_RAR[it.r][1]}"><div class="gbw">${art?`<img src="${art}" alt="">`:gearArt(it.slot,k[0],it.r,it.set)}<i class="gbsh"></i><i class="gbgl"></i></div><b class="gbset">${GEAR_SET[it.set][0]}</b></div>`;}
function gearBigTilt(e){const w=e.target&&e.target.closest&&e.target.closest('.gbw');if(!w)return;const r=w.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  w.style.setProperty('--ry',(x*36).toFixed(1)+'deg');w.style.setProperty('--rx',(-y*30).toFixed(1)+'deg');w.classList.add('tilt');}
function gearBigRest(e){const w=e.target&&e.target.closest&&e.target.closest('.gbw');if(!w)return;w.style.setProperty('--ry','0deg');w.style.setProperty('--rx','0deg');w.classList.remove('tilt');}
document.addEventListener('pointermove',gearBigTilt,{passive:true});document.addEventListener('pointerdown',gearBigTilt,{passive:true});
document.addEventListener('pointerup',gearBigRest,{passive:true});document.addEventListener('pointerleave',gearBigRest,{passive:true});document.addEventListener('pointercancel',gearBigRest,{passive:true});
