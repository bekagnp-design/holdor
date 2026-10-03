# v1.0.75 — playing a friend by link (MR B could not): the link opens the duel by itself, the duel says what each side still has to do
# and starts the Hold run from its own button; an invitation refused because the friend already plays says so; a Duel card on the Hold tab.
# a friend's challenge link: remembered at start, joined as soon as the seat is on the server, and the Duel screen opens
rep("DUEL.pending=sp.slice(2);ecoToast('🤝 A friend challenged you — open Events → Duel');return;}", "DUEL.pending=sp.slice(2);return;}", 1, 'duel-link-no-toast')
hrep("if(tab==='battle'){setTimeout(dailyPopupCheck,1100);setTimeout(evPopupCheck,2600);}",
     "if(tab==='battle'){if(DUEL.pending)setTimeout(duelPendingOpen,500);else{setTimeout(dailyPopupCheck,1100);setTimeout(evPopupCheck,2600);}}", 1, 'duel-link-open')
# an invitation the server refuses (the friend already plays): say so, and point at the duel
rep("sbRpc('ref_join',{token:CLOUD.token,code:sp.slice(2)},{timeout:8000}).then(r=>{if(r&&r.by)ecoToast('👥 You joined '+r.by+'’s house of friends — clear 5 stages for a gift');}).catch(()=>{});",
    "sbRpc('ref_join',{token:CLOUD.token,code:sp.slice(2)},{timeout:8000}).then(r=>{if(r&&r.by)ecoToast('👥 You joined '+r.by+'’s house of friends — clear 5 stages for a gift');}).catch(e=>{const m=String(e&&e.message||e);if(/only a new player|already invited/.test(m))setTimeout(()=>ecoToast('👥 You already play HOLDOR — friend gifts are for new players. You can still duel your friend: ask for a duel link.'),2500);});", 1, 'ref-refused')
# the Hold tab: a Duel card on top (duels are fought with Hold runs)
hrep('  return `<div class="holdhead"><b>HOLD THE DOOR</b>', '  return `${duelCardHTML()}<div class="holdhead"><b>HOLD THE DOOR</b>', 1, 'hold-duel-card')
hrep("  $('#bHold').addEventListener('click',()=>{if(!ACC.holdTut){holdTutorial(go);}else go();});", "  $('#bHold').addEventListener('click',()=>{if(!ACC.holdTut){holdTutorial(go);}else go();});const bdc=$('#bDuelCard');if(bdc)bdc.addEventListener('click',()=>{SFX.play('tap',60);showDuel();});", 1, 'hold-duel-bind')
