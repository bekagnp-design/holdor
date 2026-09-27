# ---- v1.0.48: the 26-step tour becomes short tours per tab (coach.js) ----
hrep("if(tab==='battle')setTimeout(hubLessons,400);", "setTimeout(()=>hubTour(tab),400);", 1, 'hub-tour')
rep("    if(!ACC.tour)startTour();\n", "    startTour();\n", 1, 'win-tour')
rep("$('#bTut').addEventListener('click',()=>{ACC.tour=0;persist();SFX.play('tap',60);startTutorial();});", "$('#bTut').addEventListener('click',()=>{ACC.tour=0;ACC.tours={};persist();SFX.play('tap',60);startTutorial();});", 1, 'set-tour')
