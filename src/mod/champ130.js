/* v1.3.0: the champion grows during the battle. Campaign only (from stage 5, like the skill offers): kills raise his battle level (12, 32, 60, 100 and 150 kills);
   every level is +6% damage and +6% health, a fifth of his health back and a ring. Two skills of the same kind (his own plus the learned ones)
   make a synergy once, with a small bonus. Hold, duel and clash battles are untouched, so their recorded runs stay the same. */
const CLV={at:[12,32,60,100,150],minStage:5};
const SYN={aoe:['Area',h=>{h.dmg*=1.15;return '+15% damage';}],rain:['Volleys',h=>{h.dmg*=1.15;return '+15% damage';}],strike:['Duelling',h=>{h.dmg*=1.15;return '+15% damage';}],
  heal:['Mending',h=>{h.max=Math.round(h.max*1.15);h.hp=Math.min(h.max,h.hp+h.max*.15);return '+15% health';}],shield:['Bulwark',h=>{h.max=Math.round(h.max*1.15);h.hp=Math.min(h.max,h.hp+h.max*.15);return '+15% health';}],
  control:['Winter',h=>{h.spd*=1.12;return '+12% speed';}],dot:['Embers',h=>{h.dmg*=1.1;h.rate*=0.92;return '+10% damage, faster strikes';}],
  buff:['Command',h=>{G.gold+=80;return '+80 gold';}],summon:['Muster',h=>{G.gold+=80;return '+80 gold';}],gold:['Treasury',h=>{G.gold+=120;return '+120 gold';}]};
function champOn(){return G.mode==='campaign'&&!G.tutorial&&!G.tut&&G.level&&G.level.id>=CLV.minStage&&G.hero&&G.heroOn;}
function champTick(){if(!champOn())return;const n=G.hLv||0;if(n>=CLV.at.length||G.kills<CLV.at[n])return;
  const h=G.hero;G.hLv=n+1;h.dmg*=1.06;h.max=Math.round(h.max*1.06);h.hp=Math.min(h.max,h.hp+h.max*.2);
  try{addText(h.x,h.y-52,'LEVEL '+(G.hLv+1),'#ffd54a',1);addFx({t:'ring',x:h.x,y:h.y-10,r0:8,r1:70,life:0.7,col:'#ffd54a'});SFX.play('levelup');}catch(e){}}
function champSynergy(id){const cat=skCat(id),h=G.hero,S=SYN[cat];if(!S)return null;G.synDone=G.synDone||{};if(G.synDone[cat])return null;
  let n=0;for(const k of h.c.sk)if(skCat(k)===cat)n++;for(const k of (G.learned||[]))if(skCat(k)===cat&&!h.c.sk.includes(k))n++;
  if(n<2)return null;G.synDone[cat]=1;const t=S[1](h);return S[0]+' synergy: '+t;}
