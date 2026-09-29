# v1.0.62 — gear II: what the four new stats do in battle. Armor takes a share off every blow the champion takes (with Iron Skin and the shield
# still counting), lifesteal heals from the damage he deals (on top of the Bloodletting skill), regeneration mends him over time (also in a fight),
# and crit chance adds to the skill's chance of a triple blow. The numbers come from the champion's worn gear (gearEff, capped) when the battle starts.
rep("const is=skVal(h,'ironskin');if(is)a*=1-is/100;", "const is=skVal(h,'ironskin');if(is)a*=1-is/100;if(G.gearArmor)a*=1-G.gearArmor/100;", 1, 'gear-armor')
rep("let ls=skVal(h,'lifesteal')||0;", "let ls=(skVal(h,'lifesteal')||0)+(G.gearLs||0);", 1, 'gear-lifesteal')
rep("const cr=skVal(h,'crit');if(cr&&G.rng()*100<cr){a*=3;", "const cr=(skVal(h,'crit')||0)+(G.gearCrit||0);if(cr&&G.rng()*100<cr){a*=3;", 1, 'gear-crit')
rep("h.oocT-=dt;if(h.oocT<=0)h.hp=Math.min(h.max,h.hp+5*dt);", "h.oocT-=dt;if(h.oocT<=0)h.hp=Math.min(h.max,h.hp+5*dt);if(G.gearRegen)h.hp=Math.min(h.max,h.hp+h.max*G.gearRegen/1000*dt);", 1, 'gear-regen')
# a fresh battle starts without a champion's gear until makeHero has read it
rep("G.goldx2Until=0;G.dgUntil=0;", "G.goldx2Until=0;G.dgUntil=0;G.gearArmor=0;G.gearLs=0;G.gearRegen=0;G.gearCrit=0;", 1, 'gear-reset')
