/* =========================== CHEST OPENING (chest145) ===========================
   One drawn chest per tier (oak + black iron, walnut + steel, Valyrian ebony + rippled steel, dragon lacquer + gold), with a lid that
   swings back, light from inside and a burst. The rewards fly out face down and flip, one at a time; Epic and Legendary get a shine and a
   burst. After the chest is open ANY tap moves on: the card on show goes to the row at once and the next one comes; SKIP › lays out all
   the rest. Then one grid of everything and COLLECT. What a chest gives is rolled exactly as before (rollChest, ECO.roll for a seat kept
   by the server) — this file only shows it. lucky.js still wraps openChest: its three taps come first, then this scene. */
let C5U=0;
const C5={dwell:[620,620,760,1050,1400],gap:100,fly:380,shake:260,burst:380,
  P:{wood:{w1:'#c98d4e',w2:'#8d5527',w3:'#55300f',gr:'#3a1e0a',m1:'#b4bac0',m2:'#6a7077',m3:'#2c3034',gem:null,glow:'#ffc977',bg:'#3a2412'},
     iron:{w1:'#7e5d42',w2:'#523a27',w3:'#2c1e12',gr:'#1c120a',m1:'#f4f8fc',m2:'#a4b1be',m3:'#4b5765',gem:'#4fb0ff',glow:'#8fd2ff',bg:'#14304f'},
     valyrian:{w1:'#5b4a8c',w2:'#372a5c',w3:'#1c1433',gr:'#110b20',m1:'#efe9ff',m2:'#a99bdb',m3:'#4a3d7a',gem:'#c77dff',glow:'#c9a3ff',bg:'#2a1a4a'},
     dragon:{w1:'#d4473a',w2:'#901e16',w3:'#4c0a06',gr:'#2c0402',m1:'#fff3c0',m2:'#f2bb40',m3:'#8a5410',gem:'#ff5a2a',glow:'#ffbf55',bg:'#4a120a'}}};
function c5Reduced(){try{return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return false;}}
/* mode: false = closed, true = open (a still picture), 'anim' = both lids, the scene's CSS swings one into the other */
function chest145SVG(t,mode){
  const P=C5.P[t]||C5.P.wood,u='c5'+(++C5U),O='#160b04',open=mode===true,anim=mode==='anim';
  const rv=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r||2.8}" fill="url(#${u}r)" stroke="${O}" stroke-width="1.1"/>`;
  /* ---- the body: three planks, two straps, corner plates, a plinth ---- */
  const planks=[0,1,2].map(i=>{const y=100+i*17.5;return `<rect x="31" y="${y}" width="138" height="17.5" fill="url(#${u}w)"/><path d="M31 ${y+.9}h138" stroke="#fff" stroke-opacity=".28" stroke-width="1.4"/><path d="M31 ${y+17}h138" stroke="${P.gr}" stroke-opacity=".8" stroke-width="1.4"/>`;}).join('');
  const grain=t==='dragon'?[0,1,2].map(j=>[...Array(12)].map((_,i)=>`<path d="M${31+i*12+(j%2)*6} ${104+j*17.5} q6 7 12 0" fill="none" stroke="${P.gr}" stroke-opacity=".55" stroke-width="1.2"/>`).join('')).join('')
    :t==='valyrian'?[0,1,2].map(j=>`<path d="M33 ${108+j*17.5} q9 -5 18 0 t18 0 t18 0 t18 0 t18 0 t18 0 t18 0" fill="none" stroke="${P.glow}" stroke-opacity=".28" stroke-width="1.2"/>`).join('')+[72,128].map(x=>`<path d="M${x-3} 139 v-12 l6 4 l-6 4 l6 4 M${x+7} 127 v12" fill="none" stroke="${P.glow}" stroke-opacity=".85" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
    :[0,1,2].map(j=>`<path d="M${36+j*9} ${106+j*17.5} q22 -3 44 1 t44 -1" fill="none" stroke="${P.gr}" stroke-opacity=".45" stroke-width="1.1"/><path d="M${80-j*7} ${111+j*17.5} q18 2 40 -1" fill="none" stroke="${P.gr}" stroke-opacity=".35" stroke-width="1"/>${t==='wood'?`<ellipse cx="${74+j*31}" cy="${108+j*17.5}" rx="3.4" ry="1.8" fill="none" stroke="${P.gr}" stroke-opacity=".6" stroke-width="1"/>`:''}`).join('');
  const strap=x=>`<rect x="${x}" y="99" width="15" height="54" fill="url(#${u}h)" stroke="${O}" stroke-width="2"/><path d="M${x+2.5} 100v52" stroke="#fff" stroke-opacity=".5" stroke-width="1.3"/>${t==='valyrian'?`<path d="M${x+7.5} 101 q-3 6 0 12 t0 12 t0 12 t0 12" fill="none" stroke="${P.m1}" stroke-opacity=".7" stroke-width=".9"/>`:''}${[110,126,142].map(y=>rv(x+7.5,y)).join('')}`;
  const plate=(x,y,sx,sy)=>`<path d="M${x} ${y}h${15*sx}v${6*sy}h${-9*sx}v${9*sy}h${-6*sx}z" fill="url(#${u}m)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>${rv(x+3.6*sx,y+3.6*sy,2.1)}`;
  const band=t==='iron'?`<rect x="31" y="122" width="138" height="8" fill="url(#${u}m)" stroke="${O}" stroke-width="1.6"/>${[40,90,110,160].map(x=>rv(x,126,2)).join('')}`:'';
  const feet=t==='dragon'?`<path d="M28 162 q-8 1 -11 9 h14 l5 -9z M172 162 q8 1 11 9 h-14 l-5 -9z" fill="url(#${u}m)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>`:'';
  const body=`<rect x="29" y="98" width="142" height="58" rx="3" fill="${P.w3}" stroke="${O}" stroke-width="3.2"/>${planks}<g clip-path="url(#${u}q)">${grain}</g>${band}
    <rect x="31" y="99" width="138" height="56" fill="url(#${u}s)"/><rect x="31" y="103" width="138" height="9" fill="url(#${u}o)"/>${strap(48)}${strap(137)}
    ${plate(31,100,1,1)}${plate(169,100,-1,1)}${feet}
    <rect x="25" y="151" width="150" height="13" rx="3.5" fill="url(#${u}m)" stroke="${O}" stroke-width="2.6"/><path d="M28 153.6h144" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/>${[34,62,100,138,166].map(x=>rv(x,158.5,2.2)).join('')}`;
  /* ---- the closed lid: a barrel top, straps over it, a rim, the lock hanging from it ---- */
  const LID='M25 103 L25 74 C25 47 61 34 100 34 C139 34 175 47 175 74 L175 103 Z';
  const lidPl=`<path d="M27 63 C44 50 70 46 100 46 C130 46 156 50 173 63" fill="none" stroke="${P.gr}" stroke-opacity=".6" stroke-width="1.5"/><path d="M26 81 C46 72 72 70 100 70 C128 70 154 72 174 81" fill="none" stroke="${P.gr}" stroke-opacity=".6" stroke-width="1.5"/>
    <path d="M28 64.5 C45 52 70 48 100 48 C130 48 155 52 172 64.5" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.2"/>`;
  const lidDeco=t==='dragon'?[0,1,2].map(j=>[...Array(12)].map((_,i)=>`<path d="M${27+i*13+j*6.5} ${92-j*13} q6.5 6 13 0" fill="none" stroke="${P.gr}" stroke-opacity=".5" stroke-width="1.2"/>`).join('')).join('')
    :t==='valyrian'?[0,1,2].map(j=>`<path d="M24 ${86-j*14} q9 -6 18 0 t18 0 t18 0 t18 0 t18 0 t18 0 t18 0 t18 0" fill="none" stroke="${P.m2}" stroke-opacity=".55" stroke-width="1.3"/>`).join('')
    :t==='iron'?[0,1].map(j=>[...Array(13)].map((_,i)=>rv(32+i*11.3,j?88:66+Math.abs(i-6)*1.6,1.5)).join('')).join(''):'';
  const lidSide=`<rect x="25" y="56" width="13" height="50" fill="url(#${u}m)" stroke="${O}" stroke-width="1.8"/><rect x="162" y="56" width="13" height="50" fill="url(#${u}m)" stroke="${O}" stroke-width="1.8"/>${rv(31.5,78,2)}${rv(168.5,78,2)}`;
  const lidStrap=x=>`<rect x="${x}" y="28" width="15" height="76" fill="url(#${u}h)" stroke="${O}" stroke-width="2"/><path d="M${x+2.5} 30v72" stroke="#fff" stroke-opacity=".5" stroke-width="1.3"/>${[58,80].map(y=>rv(x+7.5,y)).join('')}`;
  const gem=(x,y,s)=>P.gem?`<path d="M${x} ${y-s} l${s*.9} ${s} l${-s*.9} ${s} l${-s*.9} ${-s}z" fill="${P.gem}" stroke="${O}" stroke-width="1.5"/><path d="M${x} ${y-s+1.5} l${s*.45} ${s*.7} l${-s*.45} ${s*.25}z" fill="#fff" opacity=".75"/>`:'';
  const emb=t==='dragon'?`<path d="M100 110 c-6 -2 -9 -7 -9 -12 c3 2 5 2 7 1 l2 -5 l2 5 c2 1 4 1 7 -1 c0 5 -3 10 -9 12z" fill="${P.m3}"/>`
    :`<circle cx="100" cy="103" r="3.6" fill="${O}"/><path d="M98.2 104.5h3.6l1.3 7h-6.2z" fill="${O}"/>`;
  const lock=`<path d="M86 88h28v19q0 13 -14 19q-14 -6 -14 -19z" fill="url(#${u}k)" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M89.5 91h8v16q0 8 -5 12" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>${emb}${gem(100,81,7)}`;
  const horns=t==='dragon'?`<path d="M27 72 q-14 -8 -16 -26 q8 10 20 14z M173 72 q14 -8 16 -26 q-8 10 -20 14z" fill="url(#${u}m)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>`:'';
  const wing=`<path d="M100 66 C92 54 78 47 58 50 C66 53 70 56 72 60 C64 58 56 60 50 66 C60 65 68 67 74 71 C68 71 62 74 58 79 C72 76 86 74 100 72Z" fill="url(#${u}m)" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/><path d="M97 63 C88 56 78 52 66 52" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>`;
  const lidEmb=t==='dragon'?`${wing}<g transform="translate(200 0) scale(-1 1)">${wing}</g><path d="M100 50 l7 10 l-7 14 l-7 -14z" fill="url(#${u}m)" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>${gem(100,61,4.6)}`
    :t==='valyrian'?`<circle cx="100" cy="62" r="15" fill="${P.w3}" stroke="url(#${u}m)" stroke-width="4"/><circle cx="100" cy="62" r="17" fill="none" stroke="${O}" stroke-width="1"/><circle cx="100" cy="62" r="9" fill="none" stroke="${P.glow}" stroke-width="1.6" stroke-dasharray="3 2.4"/><circle cx="100" cy="62" r="4" fill="${P.gem}" stroke="${O}" stroke-width="1"/><circle cx="98.8" cy="60.8" r="1.3" fill="#fff" opacity=".8"/>`
    :t==='iron'?`<circle cx="100" cy="60" r="13" fill="url(#${u}k)" stroke="${O}" stroke-width="2"/><circle cx="100" cy="60" r="6.5" fill="url(#${u}m)" stroke="${O}" stroke-width="1.2"/>${[0,1,2,3,4,5,6,7].map(i=>rv(100+Math.cos(i*Math.PI/4)*9.8,60+Math.sin(i*Math.PI/4)*9.8,1.3)).join('')}`
    :`<path d="M86 62 a14 10 0 0 1 28 0" fill="none" stroke="${O}" stroke-width="6.5" stroke-linecap="round"/><path d="M86 62 a14 10 0 0 1 28 0" fill="none" stroke="${P.m2}" stroke-width="3.6" stroke-linecap="round"/><path d="M88 59 a13 9 0 0 1 12 -6" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2" stroke-linecap="round"/>${rv(86,63,3)}${rv(114,63,3)}`;
  const lid=`${horns}<path d="${LID}" fill="${t==='iron'?`url(#${u}p)`:`url(#${u}l)`}" stroke="${O}" stroke-width="3.2" stroke-linejoin="round"/>
    <g clip-path="url(#${u}c)">${t==='iron'?'':lidPl}${lidDeco}${lidStrap(48)}${lidStrap(137)}${lidSide}<rect x="25" y="30" width="150" height="74" fill="url(#${u}s)"/></g>
    <path d="M25 74 C25 47 61 34 100 34 C139 34 175 47 175 74" fill="none" stroke="${O}" stroke-width="3.2"/>
    <path d="M44 50 C62 40 138 40 156 50" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="3.4" stroke-linecap="round"/>${lidEmb}
    <rect x="22" y="93" width="156" height="11" rx="3" fill="url(#${u}m)" stroke="${O}" stroke-width="2.6"/><path d="M25 95.4h150" stroke="${t==='valyrian'?P.glow:'#fff'}" stroke-opacity="${t==='valyrian'?.95:.6}" stroke-width="1.3"/>${[30,72,128,170].map(x=>rv(x,98.6,2)).join('')}${lock}`;
  /* ---- the lid thrown back: its inside, lit from below ---- */
  const lidO=`<path d="M30 86 L21 24 C58 11 142 11 179 24 L170 86 Z" fill="url(#${u}i)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    ${[44,62].map(y=>`<path d="M${27-(y-44)*.1} ${y} C70 ${y-6} 130 ${y-6} ${173+(y-44)*.1} ${y}" fill="none" stroke="${P.gr}" stroke-opacity=".7" stroke-width="1.4"/>`).join('')}
    <path d="M49 86 L46 18 L61 16.5 L63 86z M137 86 L139 16.5 L154 18 L151 86z" fill="url(#${u}h)" stroke="${O}" stroke-width="1.8"/>
    <path d="M21 24 C58 11 142 11 179 24 L178 33 C142 21 58 21 22 33z" fill="url(#${u}m)" stroke="${O}" stroke-width="2.2"/>
    <path d="M30 86 L21 24 C58 11 142 11 179 24 L170 86 Z" fill="url(#${u}j)"/>`;
  /* ---- inside: the dark hold, the light, coins (and gems) ---- */
  const coins=[[-46,8,5],[-34,4,6],[-21,1,6.4],[-8,-1,6.6],[6,-1,6.4],[19,1,6.2],[32,3,6],[45,7,5.2],[-28,9,5.6],[-13,7,6],[2,6,6.2],[16,8,5.8],[30,10,5.2],[-40,12,4.6],[40,13,4.6],[-4,12,5.4],[10,13,5]]
    .map(([dx,dy,r])=>`<ellipse cx="${100+dx}" cy="${85+dy}" rx="${r}" ry="${r*.6}" fill="#ffd54a" stroke="#7a4c08" stroke-width="1"/><ellipse cx="${100+dx-1}" cy="${85+dy-1}" rx="${r*.45}" ry="${r*.22}" fill="#fff7cf" opacity=".85"/>`).join('');
  const gemsIn=P.gem?[[-24,-2,6],[12,-4,7],[34,0,5]].map(([dx,dy,s])=>gem(100+dx,85+dy,s)).join(''):'';
  const mouth=`<path d="M31 99 L169 99 L165 82 L35 82 Z" fill="${P.w3}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
    <ellipse cx="100" cy="90" rx="74" ry="20" fill="url(#${u}g)"/>${coins}${gemsIn}<ellipse cx="100" cy="86" rx="40" ry="9" fill="#fff" opacity=".55" class="c5hot"/>`;
  const rays=open?`<g opacity=".8">${[...Array(9)].map((_,i)=>{const a=-Math.PI/2+(i-4)*.28,R=96;return `<path d="M100 88 L${100+Math.cos(a-.06)*R} ${88+Math.sin(a-.06)*R} L${100+Math.cos(a+.06)*R} ${88+Math.sin(a+.06)*R}Z" fill="url(#${u}y)"/>`;}).join('')}</g>`:'';
  const defs=`<defs>
    <linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.w1}"/><stop offset=".55" stop-color="${P.w2}"/><stop offset="1" stop-color="${P.w3}"/></linearGradient>
    <linearGradient id="${u}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.w1}"/><stop offset=".5" stop-color="${P.w2}"/><stop offset="1" stop-color="${P.w3}"/></linearGradient>
    <linearGradient id="${u}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.w3}"/><stop offset="1" stop-color="${P.w2}"/></linearGradient>
    <linearGradient id="${u}j" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${P.glow}" stop-opacity=".75"/><stop offset=".55" stop-color="${P.glow}" stop-opacity=".12"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${u}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.m1}"/><stop offset=".5" stop-color="${P.m2}"/><stop offset="1" stop-color="${P.m3}"/></linearGradient>
    <linearGradient id="${u}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${P.m1}"/><stop offset=".7" stop-color="${P.m2}"/><stop offset="1" stop-color="${P.m3}"/></linearGradient>
    <linearGradient id="${u}h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.m3}"/><stop offset=".3" stop-color="${P.m1}"/><stop offset=".65" stop-color="${P.m2}"/><stop offset="1" stop-color="${P.m3}"/></linearGradient>
    <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
    <radialGradient id="${u}r" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${P.m1}"/><stop offset="1" stop-color="${P.m3}"/></radialGradient>
    <radialGradient id="${u}g" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="${P.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${u}y" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${u}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d0da"/><stop offset=".5" stop-color="#7f8a97"/><stop offset="1" stop-color="#3e4752"/></linearGradient>
    <linearGradient id="${u}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <clipPath id="${u}c"><path d="${LID}"/></clipPath><clipPath id="${u}q"><rect x="31" y="99" width="138" height="54"/></clipPath></defs>`;
  const shadow=`<ellipse cx="100" cy="168" rx="80" ry="8" fill="#000" opacity=".4"/>`;
  return `<svg class="c5svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">${defs}${shadow}${
    anim?`<g class="c5lidO">${lidO}</g><g class="c5mouth">${mouth}</g><g class="c5body">${body}</g><g class="c5lid">${lid}</g>`
    :open?`${rays}${lidO}${mouth}${body}`:`${body}${lid}`}</svg>`;}
/* the card back: the tier's colour, a lattice and a door in a ring */
function c5Back(P){return `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="${P.m1}" stroke-width="2.4"/><circle cx="30" cy="30" r="17" fill="${P.w3}" stroke="${P.m2}" stroke-width="1.4"/><path d="M22 42V28a8 8 0 0 1 16 0v14z" fill="${P.m2}" stroke="#160b04" stroke-width="1.6"/><path d="M30 20v22M22 33h16" stroke="#160b04" stroke-width="1.2"/></svg>`;}
function c5Icon(r){return r.k==='card'?cardIcon(r.key,96):r.k==='champ'||r.k==='skill'?(CHAMP_ART[r.c.id+'_portrait']?`<img src="${CHAMP_ART[r.c.id+'_portrait']}" alt="">`:`<span style="font-size:40px">${r.c.e}</span>`):r.k==='gems'?GEM_SVG:r.k==='gold'?GOLD_SVG:r.k==='upg'?`<span style="font-size:44px">${r.u.e}</span>`:r.k==='att'?HUB_ICON.hold:STAR_SVG;}
/* chest150: under a card stack, the copies held now against the card's next level (have/need; READY ⬆ when they suffice), the bar
   filling as the stack lands (cardHave already counts the new copies: a guest's rollChest added them, a seat's server state came first).
   A +100 gold with fill:1 stood in for a stack because every card is owned (v1.4.9 cardPool / ec_pool): the card says so, the grid too. */
function c5Prog(r){if(r.k!=='card'||!r.key||!/^[cts]:/.test(r.key))return null;try{const key=r.key,h=cardHave(key),n=cardNeed(key);
  if(!n)return{max:1,h,n:0,ready:false,w0:100,w1:100};const h0=Math.max(0,h-(r.cnt||0));
  return{max:0,h,n,ready:cardReady(key),w0:Math.min(100,Math.round(100*h0/n)),w1:Math.min(100,Math.round(100*h/n))};}catch(e){return null;}}
function c5ProgHTML(p,w){return p?`<span class="c5prog${p.max?' max':p.ready?' ok':''}"><i style="width:${w}%"></i><em>${p.max?'MAX':p.h+'/'+p.n}</em></span>${p.ready?'<span class="c5ready">READY ⬆</span>':''}`:'';}
function c5Fill(r){return r.k==='gold'&&!!r.fill;}
function chest145Open(t,done,fixed){   /* fixed: a list of rewards to show instead of rolling (previews and tests only) */
  const T=CHEST_TIERS[t]||CHEST_TIERS.wood,P=C5.P[t]||C5.P.wood,RC=RAR_C,RN=RAR_N,RM=c5Reduced();
  let el=$('#cer');if(!el){el=document.createElement('div');el.id='cer';document.getElementById('app').appendChild(el);}
  const rewards=fixed||rollChest(t);if(!fixed)persist();const N=rewards.length;
  const S={phase:'closed',idx:-1,cur:null,timer:0,timers:[]},fills=rewards.filter(c5Fill).length;el._c5=S;
  el.className='c145 t-'+t+(N>6?' many':'');el.style.setProperty('--tg',P.glow);el.style.setProperty('--tbg',P.bg);
  el.innerHTML=`<div class="c5bg"><i class="c5rays"></i><i class="c5flash" id="c5fl"></i></div>
    <h2>${T.n}</h2><div class="c5sub"><b>${esc(T.sub)}</b> · ${N} reward${N>1?'s':''}</div>
    <div class="rw" id="crw"></div><div class="cbig" id="cbig"></div>
    <div class="cchest" id="cch"><div class="glow" id="cglow"></div><div class="c5beams">${[-48,-30,-14,0,14,30,48].map((a,i)=>`<i style="--a:${a}deg;--d:${i*40}ms"></i>`).join('')}</div><div class="cimg" id="cimg">${CHEST_ART[t]?chestSVG(t):chest145SVG(t,'anim')}</div><b class="c5left" id="c5left"></b></div>
    <div class="tap" id="ctap">TAP TO OPEN</div><div class="c5hint" id="c5hint">TAP FOR THE NEXT</div>
    <button class="c5skip" id="cskip">SKIP ›</button><div class="c5note" id="c5note"></div><button class="collect" id="ccol">COLLECT</button>`;
  const q=id=>document.getElementById(id),live=()=>el._c5===S;
  const later=(f,ms)=>{const h=setTimeout(()=>{if(live())f();},ms);S.timers.push(h);return h;};
  const clearAll=()=>{S.timers.forEach(clearTimeout);S.timers=[];};
  const sparks=(host,n,cx,cy,spread,col)=>{if(RM||!host)return;for(let k=0;k<n;k++){const s=document.createElement('i');s.className='c5sp';const a=Math.random()*Math.PI*2,d=spread*(.45+Math.random()*.55);
      s.style.left=cx;s.style.top=cy;s.style.setProperty('--dx',Math.cos(a)*d+'px');s.style.setProperty('--dy',(Math.sin(a)*d-spread*.35)+'px');s.style.setProperty('--c',col||P.glow);s.style.setProperty('--s',(3+Math.random()*4)+'px');
      host.appendChild(s);setTimeout(()=>s.remove(),1000);}};
  const flash=cls=>{const f=q('c5fl');if(!f)return;f.className='c5flash';void f.offsetWidth;f.className='c5flash '+(cls||'on');};
  const left=()=>{const b=q('c5left');if(!b)return;const n=N-S.idx-1;b.textContent=n>0?'×'+n:'';b.classList.toggle('on',n>0);};
  const smHTML=r=>{const p=c5Prog(r);return `<span class="im">${c5Icon(r)}</span><b>${esc(r.n)}</b><small>${esc(r.s)}</small><span class="rar${c5Fill(r)?' fl':''}">${c5Fill(r)?'all owned':(RN[r.r]||'')}</span>${c5ProgHTML(p,p?p.w1:0)}`;};
  const addSm=(r,i,delay)=>{const d=document.createElement('div');d.className='rcard sm in r'+r.r;d.style.setProperty('--rc',RC[r.r]);if(delay)d.style.animationDelay=delay+'ms';d.innerHTML=smHTML(r);const w=q('crw');if(w)w.appendChild(d);};
  /* count "+320" up while the card lands */
  const countUp=(node,s)=>{const m=/^\+(\d+)$/.exec(s);if(!m||RM)return;const to=+m[1],t0=performance.now(),D=420;
    const f=now=>{if(!node.isConnected)return;const k=Math.min(1,(now-t0-C5.fly*.5)/D);node.textContent='+'+Math.round(to*Math.max(0,k));if(k<1)requestAnimationFrame(f);};node.textContent='+0';requestAnimationFrame(f);};
  const showNext=()=>{S.idx++;left();if(S.idx>=N){finish();return;}
    const r=rewards[S.idx],rr=r.r|0,big=q('cbig');if(!big)return;
    big.innerHTML='';const c=document.createElement('div'),p=c5Prog(r),fl=c5Fill(r);c.className='c5card r'+rr+(rr>=3?' shine':'')+(rr>=4?' legend':'');c.style.setProperty('--rc',RC[rr]);
    c.innerHTML=`<i class="c5burst"></i><div class="c5in"><div class="c5b">${c5Back(P)}</div><div class="c5f${p||fl?' hasp':''}"><span class="c5rib">${RN[rr]||''}</span><span class="c5med">${c5Icon(r)}</span><b class="c5nm">${esc(r.n)}</b><span class="c5amt">${esc(r.s)}</span>${fl?'<small class="c5fill">All cards owned → gold</small>':c5ProgHTML(p,p&&!RM?p.w0:p?p.w1:0)}</div></div>`;
    big.appendChild(c);S.cur={r,c,i:S.idx};countUp(c.querySelector('.c5amt'),r.s);
    if(p&&!p.max&&!RM)later(()=>{const b=c.querySelector('.c5prog i');if(b)b.style.width=p.w1+'%';},C5.fly*.9);
    try{SFX.play(rr>=4?'legend':rr>=3?'epic':'card',60);}catch(e){}
    if(rr>=3)later(()=>{flash(rr>=4?'gold':'on');sparks(big,rr>=4?34:18,'50%','45%',rr>=4?190:140,RC[rr]);if(rr>=4){el.classList.remove('quake');void el.offsetWidth;el.classList.add('quake');}},C5.fly*.75);
    S.timer=later(autoNext,C5.dwell[rr]||C5.dwell[0]);};
  /* the card on show goes to the row: animated when its time is up, at once when tapped */
  const commit=quick=>{const cu=S.cur;if(!cu)return;S.cur=null;addSm(cu.r,cu.i);if(quick||RM)cu.c.remove();else{cu.c.classList.add('out');setTimeout(()=>cu.c.remove(),240);}};
  const autoNext=()=>{commit(false);try{SFX.play('tap',40);}catch(e){}later(showNext,C5.gap);};
  const burst=()=>{if(S.burst)return;S.burst=1;const ch=q('cch');if(ch)ch.classList.remove('shake');el.classList.add('opened');const im=q('cimg');if(im)im.classList.add('open');const g=q('cglow');if(g)g.classList.add('on');
    flash('on');sparks(ch,28,'50%','42%',170);try{SFX.play('chestopen');}catch(e){}};
  const open=()=>{if(S.phase!=='closed')return;S.phase='opening';el.classList.add('going');const tp=q('ctap');if(tp)tp.textContent='';const ch=q('cch');if(ch)ch.classList.add('shake');try{SFX.play('chest');}catch(e){}
    later(()=>{burst();later(()=>{S.phase='show';showNext();},C5.burst);},RM?60:C5.shake);};
  const advance=()=>{if(S.phase==='opening'){clearAll();burst();S.phase='show';showNext();return;}
    if(S.phase!=='show')return;clearAll();commit(true);showNext();};
  const finish=()=>{if(S.phase==='done')return;S.phase='done';clearAll();const big=q('cbig');if(big)big.innerHTML='';
    el.classList.add('done');if(fills){el.classList.add('fills');const nt=q('c5note');if(nt)nt.textContent='Your cards are complete — the chest paid gold instead';}
    [...el.querySelectorAll('#crw .rcard')].forEach((d,i)=>{d.classList.remove('fin');void d.offsetWidth;d.style.animationDelay=(i*45)+'ms';d.classList.add('fin');});
    const cc=q('ccol');if(cc)cc.classList.add('in');try{SFX.play('collect');}catch(e){}};
  const skip=()=>{if(S.phase==='closed'||S.phase==='done')return;clearAll();burst();commit(true);
    for(let i=S.idx+1;i<N;i++)addSm(rewards[i],i);S.idx=N-1;left();finish();};
  el.onclick=e=>{const tg=e.target&&e.target.closest?e.target:null;if(tg&&tg.closest('#ccol,#cskip'))return;
    if(S.phase==='closed'){if(tg&&tg.closest('#cch,#ctap'))open();return;}advance();};
  q('cskip').addEventListener('click',e=>{e.stopPropagation();skip();});
  q('ccol').addEventListener('click',e=>{e.stopPropagation();if(!q('ccol').classList.contains('in'))return;clearAll();el._c5=null;el.onclick=null;el.className='hidden';el.innerHTML='';done&&done();});
  S.api={open,advance,skip,finish,rewards,state:()=>({phase:S.phase,idx:S.idx,n:N,fills,shown:el.querySelectorAll('#crw .rcard').length})};
}
