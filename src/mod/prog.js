/* =========================== PROGRESSION (v1.0.45): small steps, long road ===========================
   Champions: level 1–20 (+5% health, +4% damage per level), talent at 10, skill ranks 1–5 (a rank needs a champion level).
   Towers: a permanent level 1–16 bought in the Collection (+3% power per level), small milestone bonuses at 4 · 8 · 12 · 16. */
const CH_MAX=20,SK_MAX=5,TAL_AT=10,SK_CAP=[1,3,6,10,15],T_MAX=16,T_MILE=[4,8,12,16];
function rankCap(lvl){let r=1;for(let i=0;i<SK_CAP.length;i++)if(lvl>=SK_CAP[i])r=i+1;return r;}
(function(){const CNT=['taunt','multishot','pierce','summon','assassinate'];
  for(const k in SK){const S=SK[k],v=S.v;if(!v||v.length!==3)continue;const a=v[0],c=v[2],cnt=CNT.indexOf(k)>=0;
    const r=x=>cnt||Math.abs(c-a)<12?Math.round(x*2)/2:Math.abs(c-a)>=150?Math.round(x/5)*5:Math.round(x);
    S.v=[a,r(a+(c-a)/4),r(a+(c-a)/2),r(a+3*(c-a)/4),c];}})();
(function(){for(const k in TALENTS)for(const t of TALENTS[k])if(t.k!=='block'&&!t.sc){t.v=Math.round(t.v*0.6*100)/100;t.sc=1;}})();
function cntOf(v){const f=Math.floor(v);return f+(v-f>0&&G.rng()<v-f?1:0);}
function fc(v){return v%1?Math.floor(v)+'–'+Math.ceil(v):String(v);}
function tLvl(k,a){const A=a||ACC;return (A&&A.tlv&&A.tlv[k])||1;}
function tMile(k,i){return tLvl(k)>=T_MILE[i];}
const TMILE={
 watch:[['👁️','Keen eyes','+8% range'],['🏹','Long shafts','+8% damage'],['⚡','Rapid draw','+8% fire rate'],['🔥','Fire arrows','hits burn for 6 a second']],
 scorp:[['🎯','Heavy bolts','+8% damage'],['🪝','Barbed heads','×3 against giants (from ×2.5)'],['🧑‍🔧','Winch crew','+10% reload speed'],['🐉','Dragon hunter','+30% against dragons']],
 wild:[['🧪',"Alchemist's blend",'+12% splash'],['💚','Hotter mix','+8% damage'],['🫙','Sticky fire','burning +40%'],['☄️','Greek fire','+12% splash']],
 glass:[['🔷','Sharper glass','+8% damage'],['🗡️','Longer spears','+10% reach'],['❄️','Frozen grip','slows 5% harder'],['🖤','Obsidian edge','+10% damage']],
 weir:[['🌳','Deeper roots','slows 4% harder, +6% reach'],['👁️','Old gods','+5% damage taken inside'],['🌲','Heart tree','+8% reach'],['🍃','Greenseer','slows 4% harder']],
 keep:[['🛡️','Squires','+8% soldier health'],['⚔️','Sworn swords','+1 soldier'],['🗡️','Veterans','+10% soldier damage'],['🐎','Swift return','soldiers return 20% sooner']],
};
const TSHORT={watch:'Watchtower',scorp:'Scorpion',wild:'Wildfire',glass:'Dragonglass',weir:'Weirwood',keep:'Keep'};
