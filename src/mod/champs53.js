/* =========================== CHAMPIONS II (v1.0.53) ===========================
   Lannister and Baratheon get unique kits: thirteen new skill mechanics and seven new ultimates.
   Seven old ultimates become signatures (Host → Kevan, Smash → the Mountain, Debts Paid → Tywin,
   Firestorm → Cersei, Wildfire → Tyrion, Fortify → Davos, War Cry → Renly). No skill pair and no
   ultimate is shared with any of the 28 champions redone so far. */
Object.assign(SK,{
 discipline:{n:'Discipline',e:'🛡️',v:[15,20,25,30,35],d:v=>`Soldiers within 90 px of the champion take ${v}% less damage`},
 ironskin:{n:'Iron Skin',e:'🪨',v:[15,20,25,30,35],d:v=>`The champion takes ${v}% less damage`},
 tribute:{n:'Tribute',e:'🪙',v:[8,12,16,20,25],cd:10,d:v=>`Every 10 s the champion collects ${v} gold`},
 parry:{n:'Parry',e:'🤺',v:[15,20,25,30,35],d:v=>`${v}% chance to turn a blow aside — no damage, and a riposte`},
 contempt:{n:'Contempt',e:'🍷',v:[20,25,30,35,40],d:v=>`Enemies within 80 px of the champion deal ${v}% less damage`},
 hand:{n:'Hand of the King',e:'📜',v:[6,8,10,12,15],d:v=>`Towers cost ${v}% less to build and upgrade in battle`},
 forge:{n:'Forged Steel',e:'⚒️',v:[10,14,18,22,26],d:v=>`Towers within 90 px of the champion deal ${v}% more damage`},
 duelist:{n:'Duelist',e:'⚔️',v:[30,45,60,80,100],d:v=>`Deals ${v}% more to giants, champions of the dead and bosses`},
 rations:{n:'Rations',e:'🧅',v:[40,60,80,100,130],cd:12,d:v=>`Every 12 s heals the champion and every soldier within 100 px by ${v}`},
 charm:{n:'Charm',e:'🌈',v:[8,12,16,20,25],d:v=>`${v}% chance a hit turns the target around: it walks back for 2 s (not bosses)`},
 bloodmagic:{n:'Blood Magic',e:'🩸',v:[4,6,8,10,13],d:v=>`Every enemy that dies within 100 px of the champion mends the door by ${v}`},
 warhammer:{n:'Warhammer',e:'🔨',v:[35,45,55,65,80],d:v=>`Melee blows also strike every enemy within 30 px of the target for ${v}%`},
 siegecraft:{n:'Siegecraft',e:'🏹',v:[8,10,12,14,16],d:v=>`Towers within 90 px of the champion reach ${v}% further`},
 twoforone:{n:'Two for One',e:'💰',v:[6,7,8,9,10],cd:40,ult:true,d:v=>`For ${v} s the champion shoots twice as fast and every shot finds one more target`},
 kingslayer:{n:'Kingslayer',e:'👑',v:[500,800,1150,1550,2000],cd:40,ult:true,d:v=>`One blow at the strongest enemy on the field — bosses too: ${v} damage`},
 dgblades:{n:'Dragonglass Blades',e:'🔷',v:[6,8,10,12,14],cd:45,ult:true,d:v=>`For ${v} s every tower ignores ice armour and cannot be frozen; frozen towers thaw at once`},
 thebold:{n:'The Bold',e:'🗡️',v:[200,300,420,560,720],cd:40,ult:true,d:v=>`Leaps to the enemy nearest the gate and strikes everything within 70 px for ${v}`},
 lordoflight:{n:'Lord of Light',e:'🔥',v:[15,20,25,30,35],cd:50,ult:true,d:v=>`Every enemy on the field burns away ${v}% of its current health (bosses half)`},
 fury:{n:'Ours Is the Fury',e:'🦌',v:[5,6,7,8,10],cd:45,ult:true,d:v=>`For ${v} s every blow lands on all enemies within 55 px, and he strikes 50% faster`},
 dawncharge:{n:'Horns at Dawn',e:'🐎',v:[150,220,300,390,500],cd:50,ult:true,d:v=>`Riders sweep the busiest road from the gate outward: ${v} to everything on it, thrown back 30 px`},
});
const KITS53={
 kevan:['rally','discipline','reinforce'], bronn:['multishot','pierce','twoforone'], gregor:['cleave','ironskin','smash'], tywin:['goldtouch','tribute','goldrain'],
 jaime:['crit','parry','kingslayer'], cersei:['slowaura','contempt','firestorm'], tyrion:['burn','hand','wildfire'],
 gendry:['stun','forge','dgblades'], barristan:['shield','duelist','thebold'], davos:['heal','rations','fortify'], renly:['summon','charm','warcry'],
 melisandre:['burn','bloodmagic','lordoflight'], robert:['blood','warhammer','fury'], stannis:['shield','siegecraft','dawncharge'],
};
for(const id in KITS53)if(CBY[id])CBY[id].sk=KITS53[id].slice();
Object.assign(TALENTS,{
 kevan:[{n:'Lannister Discipline',k:'skillmult',sk:'discipline',v:0.15,sc:1},{n:'Steady Hand',k:'hp',v:0.12,sc:1}],
 bronn:[{n:'Sellsword',k:'goldkill',v:0.12,sc:1},{n:'Crossbowman',k:'range',v:0.09,sc:1}],
 gregor:[{n:'Unstoppable',k:'skillmult',sk:'ironskin',v:0.15,sc:1},{n:'Brute',k:'dmg',v:0.11,sc:1}],
 tywin:[{n:'The Lion Pays',k:'skillmult',sk:'tribute',v:0.15,sc:1},{n:'Hand of Three Kings',k:'cdr',v:0.12,sc:1}],
 jaime:[{n:'Golden Hand',k:'skillmult',sk:'parry',v:0.15,sc:1},{n:'Kingsguard',k:'rate',v:0.09,sc:1}],
 cersei:[{n:'Queen Regent',k:'skillmult',sk:'contempt',v:0.15,sc:1},{n:'Wildfire Cache',k:'skillmult',sk:'firestorm',v:0.11,sc:1}],
 tyrion:[{n:'Master of Coin',k:'skillmult',sk:'hand',v:0.15,sc:1},{n:'Blackwater',k:'skillmult',sk:'wildfire',v:0.11,sc:1}],
 gendry:[{n:'Bull Helm',k:'skillmult',sk:'forge',v:0.15,sc:1},{n:'Hammer Arm',k:'dmg',v:0.11,sc:1}],
 barristan:[{n:'Barristan the Bold',k:'skillmult',sk:'duelist',v:0.15,sc:1},{n:'Lord Commander',k:'hp',v:0.12,sc:1}],
 davos:[{n:'Onion Knight',k:'skillmult',sk:'rations',v:0.15,sc:1},{n:'Smuggler',k:'goldkill',v:0.12,sc:1}],
 renly:[{n:'Rainbow Guard',k:'skillmult',sk:'summon',v:0.15,sc:1},{n:'Charming',k:'skillmult',sk:'charm',v:0.15,sc:1}],
 melisandre:[{n:'Red Priestess',k:'skillmult',sk:'bloodmagic',v:0.15,sc:1},{n:'The Night Is Dark',k:'cdr',v:0.12,sc:1}],
 robert:[{n:'Demon of the Trident',k:'skillmult',sk:'warhammer',v:0.15,sc:1},{n:'The Stag King',k:'hp',v:0.12,sc:1}],
 stannis:[{n:'Mannis',k:'skillmult',sk:'siegecraft',v:0.15,sc:1},{n:'By Right',k:'block',v:1,sc:1}],
});
/* the champion who will ride — even before they are on the field (tower prices at the start of a battle) */
function selSk(id){if(!ACC)return 0;const c=CBY[ACC.sel];if(!c)return 0;const i=c.sk.indexOf(id);if(i<0)return 0;const p=cprog(null,c.id);const l=Math.max(1,Math.min(SK_MAX,(p.sk&&p.sk[i])||1));let v=SK[id].v[l-1];
  if(p.lvl>=TAL_AT&&p.tal){const t=heroTalent(c.id,p.tal);if(t&&t.k==='skillmult'&&t.sk===id)v=Math.round(v*(1+t.v));}return v;}
function handMul(){const v=G.hero&&G.hero.c&&G.hero.c.id===ACC.sel?skVal(G.hero,'hand'):selSk('hand');return 1-(v||0)/100;}
function heroParry(e){const h=G.hero;if(!h||h.dead)return false;const pv=skVal(h,'parry');if(!pv||G.rng()*100>=pv)return false;
  dmg(e,h.dmg*0.8,'hero');const p=posE(e);addFx({t:'arc',x:h.x,y:h.y-12,a:Math.atan2(p.y-h.y,p.x-h.x),r:19,life:0.2,col:'#ffd23c'});addText(h.x,h.y-34,'parry!','#ffd23c');SFX.play('slash',90);return true;}
