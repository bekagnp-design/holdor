/* battle-screen fixes.
   · The CALL WAVE button keeps off the build pads: per stage it takes the first free spot of bottom-left, bottom-right,
     then one row higher on either side (the default spot when none is free); it hides while a build ring is open, because
     the ring's buttons would sit under it. Placed once per stage and canvas size (CALLP.key).
   · The champion's speech bubble is not drawn while a ring is open; the new-enemy toast draws its name left-aligned after
     the icon (both patched in place by src/parts/98zc_battlefix.py). */
const CALLP={key:null,pick:null};
const CALL_SPOTS=[[10,null,108],[null,10,108],['c',null,108],[10,null,170],[null,10,170],['c',null,170],[10,null,232],[null,10,232],['c',null,232]];   /* left / right / centre, three heights */
function callBtnPlace(b){CALLP.pick=CALL_SPOTS[0];}   /* v1.5.1: the button keeps its v1.4.2 spot (left, above the spell bar); moving it off the build pads per stage was tried and dropped — the candidates still covered pads on a third of the stages */
