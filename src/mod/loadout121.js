/* v1.2.1: the spell loadout (3 of 5), Long Night and Gate repair. ACC.loadout = three spell ids; the battle buttons #bP0..2 follow G.slots. */
Object.assign(SPELLS,{
  night:{e:'❄️',n:'Long Night',cd:45,at:8,d:'The cold falls on the whole road: every enemy is slowed for 6 seconds'},
  repair:{e:'🧱',n:'Gate repair',cd:90,at:12,d:'Masons mend the gate: it regains a third of its strength'}});
S_RAR.night=3;S_RAR.repair=2;
const SPELL_DEFAULT=['arrows','fire','reinf'];
function spellLoadout(){const out=[];for(const k of ((ACC&&ACC.loadout)||[]))if(SPELLS[k]&&!out.includes(k))out.push(k);
  for(const k of SPELL_DEFAULT)if(out.length<3&&!out.includes(k))out.push(k);return out.slice(0,3);}
function spellEquip(k,slot){if(!SPELLS[k]||slot<0||slot>2)return false;const L=spellLoadout().slice(),at=L.indexOf(k);if(at>=0)L[at]=L[slot];L[slot]=k;ACC.loadout=L;persist();return true;}
function spellSlots(){return (G.tutorial||(G.tut&&G.tut.key==='tut'))?SPELL_DEFAULT.slice():spellLoadout();}
/* the three battle buttons: arrows and fire are aimed (tap, then the road), the rest fly at once */
function spellBtn(i){const k=(G.slots||SPELL_DEFAULT)[i];if(!k||G.state!=='play'||!spellOpen(k))return;
  if(k==='arrows'||k==='fire'){if(G.powerCd[k]>0)return;G.armed=G.armed===k?null:k;G.heroSel=false;updateBar();return;}
  const was=G.powerCd[k];castPower(k);if(G.tut&&was<=0&&G.state==='play')tutEvent('power',k);}
/* the two new spells */
{const cp0=castPower;castPower=function(id,x,y){
  if(id!=='night'&&id!=='repair')return cp0(id,x,y);
  if(G.state!=='play'||G.powerCd[id]>0)return;G.powerCd[id]=G.powerMax[id];SFX.play('spell');G.log.push({t:G.tick,a:'power',id,x:Math.round(x||0),y:Math.round(y||0)});
  const m=spellMul(id);
  if(id==='night'){const v=Math.min(60,Math.round(40*m));for(const e of G.enemies){if(e.hp<=0||e.slowImmune)continue;e.chillT=G.time+6;e.chillV=v;}
    addFx({t:'ring',x:W/2,y:H*0.42,r0:20,r1:330,life:0.8,col:'#bfe6ff'});addText(W/2,H*0.3,'LONG NIGHT −'+v+'%','#bfe6ff',true);}
  else{const g=heldGate(),add=Math.round(G.doorMax*0.3*m);G.doorHp=Math.min(G.doorMax,G.doorHp+add);
    addFx({t:'ring',x:g.x,y:GATE_Y-20,r0:8,r1:70,life:0.6,col:'#7cff6b'});addText(g.x,GATE_Y-44,'+'+add,'#7cff6b',true);}
  updateBar();};}
/* spell lines and icons for the new spells */
{const sl0=spellLine;spellLine=function(k,l){const m=1+0.06*((l||spellLvl(k))-1);
  if(k==='night')return `every enemy ${Math.min(60,Math.round(40*m))}% slower for 6 s`;
  if(k==='repair')return `the gate regains ${Math.round(30*m)}% of its strength`;return sl0(k,l);};
 const sv0=spellSVG;spellSVG=function(k){
  if(k==='night')return '<svg viewBox="0 0 24 24" fill="none" stroke="#8fd3ff" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M4 7.5l16 9M4 16.5l16-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/></svg>';
  if(k==='repair')return '<svg viewBox="0 0 24 24" fill="none" stroke="#7cff6b" stroke-width="1.8"><path d="M3 20V9l3-2v13M21 20V9l-3-2v13M9 20v-6h6v6M3 20h18M10 9h4"/></svg>';
  return sv0(k);};}
/* the equip row in the spell room */
{const sr0=showSpellRoom;showSpellRoom=function(k){sr0(k);spellEquipUI(SPELLS[k]?k:'arrows');};}
function spellEquipUI(k){const foot=card.querySelector('#clist .cfoot');if(!foot)return;
  if(!(k==='arrows'||cleared()>=SPELLS[k].at))return;
  const L=spellLoadout();
  foot.insertAdjacentHTML('beforebegin',`<div class="eqrow"><small>In battle: tap a slot to put ${esc(SPELLS[k].n)} there</small><div class="eqslots">${L.map((s,i)=>`<button class="eqs ${s===k?'on':''}" data-eq="${i}"><span class="spi">${spellSVG(s)}</span><b>${i+1}</b></button>`).join('')}</div></div>`);
  card.querySelectorAll('[data-eq]').forEach(b=>b.addEventListener('click',()=>{spellEquip(k,+b.dataset.eq);SFX.play('tap',60);showSpellRoom(k);}));}
