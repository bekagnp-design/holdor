/* =========================== RANKS (v1.0.50) ===========================
   Trophies: every campaign star (Easy and Hard) is one, every wave of the seat's best Hold run is two;
   Duel results join later. Trophies place the seat in a tier — Iron … Grandmaster — split into divisions IV–I;
   Challenger is the world's top 10 by the server's all-time standings, once past the Grandmaster mark.
   Every number here is the seat's own record (the same one the server keeps), never a guess. */
const RANKS=[{n:'Iron',c:'#a3a7ad',c2:'#4c5157'},{n:'Bronze',c:'#d0884d',c2:'#6b3f1d'},{n:'Silver',c:'#e3eaf0',c2:'#6e7f8f'},{n:'Gold',c:'#ffd45a',c2:'#8a5a10'},
  {n:'Platinum',c:'#8ff0e0',c2:'#1f6f68'},{n:'Diamond',c:'#9fd0ff',c2:'#1f4f8a'},{n:'Master',c:'#c98cff',c2:'#5a2a8a'},{n:'Grandmaster',c:'#ff7a7a',c2:'#7a1d1d'},{n:'Challenger',c:'#ffe27a',c2:'#b3541e'}];
const RANK_AT=[0,30,75,130,200,280,360,440];
const DIV_N=['','I','II','III','IV'];
function trophiesOf(a){a=a||ACC;if(!a)return 0;let st=0;for(const k in (a.campaign||{}))st+=a.campaign[k]||0;for(const k in (a.hard||{}))st+=a.hard[k]||0;return st+2*((a.stats&&a.stats.onlineBest)||0);}
function trophiesRow(p){return (+(p&&p.stars)||0)+2*(+(p&&p.waves)||0);}
function rankOf(tr,world){tr=Math.max(0,tr|0);let t=0;for(let i=0;i<RANK_AT.length;i++)if(tr>=RANK_AT[i])t=i;
  let div=0;if(t<7){const lo=RANK_AT[t],hi=RANK_AT[t+1];div=4-Math.min(3,Math.floor(4*(tr-lo)/(hi-lo)));}
  if(t>=7&&world&&world<=10)t=8;
  return{t,div,name:RANKS[t].n,full:RANKS[t].n+(t<7?' '+DIV_N[div]:''),next:t<7?RANK_AT[t+1]:null,tr,col:RANKS[t].c};}
function myWorldRank(){const m=lbMine(cachedLb()).me;return m&&m.rank?+m.rank:null;}
function myRank(){return rankOf(trophiesOf(),myWorldRank());}
function rankSVG(t,px,div){const R=RANKS[t]||RANKS[0];px=px||16;
  const inner=t>=8?'<path d="M12 6.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" fill="#fff8d6" stroke="#b3541e" stroke-width=".8"/>'
    :t>=7?'<path d="M7.5 8.5 12 6l4.5 2.5v4L12 17l-4.5-4.5z" fill="#fff" fill-opacity=".85"/>'
    :t>=6?'<path d="M12 6l4 5-4 6-4-6z" fill="#fff" fill-opacity=".85"/>'
    :div?`<text x="12" y="15.2" text-anchor="middle" font-family="Cinzel,serif" font-size="${div>=3?'8.5':'9.5'}" font-weight="900" fill="#fff" stroke="${R.c2}" stroke-width=".6">${DIV_N[div]}</text>`:'';
  return `<svg class="rksvg" viewBox="0 0 24 26" style="width:${px}px;height:${Math.round(px*26/24)}px"><path d="M12 1.5 21.5 5v7.5c0 5.6-4 9.6-9.5 11.8C6.5 22.1 2.5 18.1 2.5 12.5V5z" fill="${R.c}" stroke="${R.c2}" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 4 19 6.6v5.9c0 4.2-3 7.4-7 9.2-4-1.8-7-5-7-9.2V6.6z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>${inner}</svg>`;}
function rankChip(r,px){r=r||myRank();return `<span class="rkchip" style="--rkc:${r.col}">${rankSVG(r.t,px||14,r.div)}${r.full}</span>`;}
function showRankSheet(){const r=myRank(),w=myWorldRank(),tr=r.tr,a=ACC;let st=0;for(const k in (a.campaign||{}))st+=a.campaign[k]||0;for(const k in (a.hard||{}))st+=a.hard[k]||0;const hw=(a.stats&&a.stats.onlineBest)||0;
  const ladder=RANKS.map((R,i)=>`<div class="rkrow ${i===r.t?'me':''}"><span class="ic">${rankSVG(i,20,0)}</span><span class="nm">${R.n}</span><span class="v">${i<8?(i<7?RANK_AT[i]+' 🏆':RANK_AT[7]+' 🏆'):'top 10 in the world'}</span></div>`).join('');
  show(`<div class="topbar"><h1>${rankSVG(r.t,26,r.div)} ${r.full}<small>${tr} trophies · seat ${ROMAN3[Math.max(0,seatNo())]}${w?' · world rank #'+w:''}</small></h1><button class="back" id="bBack">✖</button></div>
  <div class="rkbig" style="--rkc:${r.col}">${rankSVG(r.t,84,r.div)}<b>${r.full}</b><small>${r.next!=null?`${r.next-tr} more for ${RANKS[r.t+1].n}`:r.t===7?'Grandmaster · the world\'s top 10 become Challenger':'The top of the world'}</small>
   ${r.next!=null?`<div class="rkbar"><i style="width:${Math.round(100*(tr-RANK_AT[r.t])/(r.next-RANK_AT[r.t]))}%"></i></div>`:''}</div>
  <div class="statbox"><div class="hd"><b>Where trophies come from</b></div>
   <div class="rkrow"><span class="ic">⭐</span><span class="nm">Campaign stars<small>Easy and Hard, 1 each</small></span><span class="v">${st} 🏆</span></div>
   <div class="rkrow"><span class="ic">🌊</span><span class="nm">Best Hold run<small>${hw} waves × 2</small></span><span class="v">${hw*2} 🏆</span></div>
   <div class="rkrow lk"><span class="ic">⚔️</span><span class="nm">Duel<small>wins and losses — with the Duel event</small></span><span class="v">soon</span></div></div>
  <div class="statbox" style="margin-top:8px"><div class="hd"><b>The ladder</b></div>${ladder}</div>
  <p class="m" style="font-size:11.5px">Each tier has four divisions, IV to I. Every seat is ranked on its own.</p>
  <button class="btn" id="bOk">✔ Back</button>`);
  const back=()=>showHub('battle');$('#bBack').addEventListener('click',back);$('#bOk').addEventListener('click',back);}
