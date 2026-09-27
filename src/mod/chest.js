function chestSVG(t,open){const T=CHEST_TIERS[t]||CHEST_TIERS.wood;const k=t+(open?'_open':'');if(CHEST_ART[k])return `<img src="${CHEST_ART[k]}" alt="" style="width:100%;height:100%;object-fit:contain">`;
  const u='c'+k.replace(/[^a-z]/g,'');
  const P={wood:{wood:'#9a6434',wood2:'#6b4020',grain:'#4a2a12',metal:'#8d949c',metal2:'#50565e',gem:null},
    iron:{wood:'#6f7f93',wood2:'#3f4b5c',grain:'#2a3340',metal:'#d5dde6',metal2:'#7d8896',gem:'#5fb4ff'},
    valyrian:{wood:'#5b3f8f',wood2:'#2c1d4c',grain:'#1d1233',metal:'#b9a4e6',metal2:'#5e4a8a',gem:'#d27cff'},
    dragon:{wood:'#b0352a',wood2:'#4f1410',grain:'#2e0a07',metal:'#ffd36b',metal2:'#a8741c',gem:'#ff5a3c'}}[t]||{};
  const O='#1b0e05';
  const rivet=(x,y)=>`<circle cx="${x}" cy="${y}" r="1.7" fill="${P.metal}" stroke="${O}" stroke-width=".8"/><circle cx="${x-.5}" cy="${y-.5}" r=".6" fill="#fff" opacity=".8"/>`;
  const corner=(x,y,sx,sy)=>`<path d="M${x} ${y} h${12*sx} v${4*sy} h${-8*sx} v${8*sy} h${-4*sx} z" fill="${P.metal}" stroke="${O}" stroke-width="1.3"/>${rivet(x+3*sx,y+3*sy)}${rivet(x+8*sx,y+2*sy)}`;
  /* body: front face + right side face */
  const planks=[30,46,74,90].map(x=>`<path d="M${x} 58 V94" stroke="${P.grain}" stroke-opacity=".45" stroke-width="1.3"/>`).join('');
  const grain=t==='dragon'?[0,1,2,3,4,5,6,7].map(i=>[0,1,2].map(j=>`<path d="M${20+i*11+(j%2)*5.5} ${64+j*9} q5.5 6 11 0" fill="none" stroke="${P.grain}" stroke-opacity=".55" stroke-width="1.1"/>`).join('')).join('')
    :t==='valyrian'?[0,1,2].map(j=>`<path d="M18 ${66+j*9} q10 -6 20 0 t20 0 t20 0 t20 0 t10 0" fill="none" stroke="#b58cff" stroke-opacity=".45" stroke-width="1.2"/>`).join('')
    :[0,1,2,3].map(j=>`<path d="M${22+j*20} ${64+(j%2)*10} q6 3 12 0" fill="none" stroke="${P.grain}" stroke-opacity=".4" stroke-width="1"/>`).join('');
  const body=`<path d="M104 58 L112 52 L112 88 L104 94 Z" fill="${P.wood2}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="14" y="56" width="90" height="38" rx="3" fill="url(#${u}b)" stroke="${O}" stroke-width="2.4"/>${planks}${grain}
    <rect x="14" y="86" width="90" height="8" rx="2" fill="${P.metal2}" stroke="${O}" stroke-width="1.6"/><rect x="16" y="87" width="86" height="2" fill="#fff" opacity=".25"/>
    ${corner(14,56,1,1)}${corner(104,56,-1,1)}${[20,30,40,78,88,98].map(x=>rivet(x,90)).join('')}
    <rect x="32.5" y="56" width="7" height="38" fill="${P.metal}" stroke="${O}" stroke-width="1.3"/><rect x="78.5" y="56" width="7" height="38" fill="${P.metal}" stroke="${O}" stroke-width="1.3"/>
    <rect x="33.6" y="57" width="1.8" height="36" fill="#fff" opacity=".45"/><rect x="79.6" y="57" width="1.8" height="36" fill="#fff" opacity=".45"/>
    ${[62,72,82].map(y=>rivet(36,y)+rivet(82,y)).join('')}
    ${t==='dragon'?`<path d="M14 94 q-6 2 -8 8 h10 l4 -8 z M104 94 q6 2 8 8 h-10 l-4 -8 z" fill="${P.metal}" stroke="${O}" stroke-width="1.3"/>`:''}`;
  /* closed lid: a barrel curve with two bands over it */
  const lid=`<path d="M104 58 L112 52 Q112 40 106 32 Z" fill="${P.wood2}" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M12 58 Q12 22 59 20 Q106 22 106 58 Z" fill="url(#${u}l)" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M24 34 Q59 18 94 34" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
    ${t==='dragon'?[0,1,2,3,4,5].map(i=>[0,1].map(j=>`<path d="M${22+i*13+j*6.5} ${46-j*8-(Math.abs(i-2.5)<1.5?3:0)} q6.5 6 13 0" fill="none" stroke="${P.grain}" stroke-opacity=".55" stroke-width="1.2"/>`).join('')).join(''):''}
    ${t==='valyrian'?`<path d="M20 50 q10 -8 20 0 t20 0 t20 0 t20 0" fill="none" stroke="#e0c7ff" stroke-opacity=".6" stroke-width="1.6"/><g fill="#e6cfff" opacity=".9">${[26,44,62,80,94].map(x=>`<circle cx="${x}" cy="${41+(x%3)}" r="1.4"/>`).join('')}</g>`:''}
    <path d="M32.5 57 Q32.5 26 36 24 L39.5 23.6 Q39.5 26 39.5 57 Z" fill="${P.metal}" stroke="${O}" stroke-width="1.3"/><path d="M78.5 57 Q78.5 26 82 23.6 L85.5 24 Q85.5 27 85.5 57 Z" fill="${P.metal}" stroke="${O}" stroke-width="1.3"/>
    <rect x="12" y="54" width="94" height="5" rx="2" fill="${P.metal2}" stroke="${O}" stroke-width="1.5"/>`;
  /* the lock */
  const emb=t==='iron'?`<path d="M59 49 q-4 1 -6 4 q3 0 4 1 l-3 4 q4 -1 6 -3 q2 2 5 3 l-2 -4 q2 -1 4 -1 q-3 -3 -8 -4 z" fill="#1b2430"/>`
    :t==='valyrian'?`<path d="M59 47 q5 3 0 7 q-5 4 0 8" fill="none" stroke="#e8d0ff" stroke-width="2" stroke-linecap="round"/><circle cx="59" cy="55" r="7.5" fill="none" stroke="#caa6ff" stroke-width="1" opacity=".8"/>`
    :t==='dragon'?`<path d="M52 58 q2 -9 9 -10 q5 0 6 4 l3 -1 l-2 4 q-1 5 -7 6 l1 3 l-4 -2 l-1 3 l-2 -4 z" fill="#7a1c10" stroke="#3a0b05" stroke-width=".8"/><circle cx="61.5" cy="53" r="1.3" fill="#ffe36e"/>`
    :`<circle cx="59" cy="53" r="3.3" fill="${O}"/><path d="M57.4 54 h3.2 l1.2 7 h-5.6 z" fill="${O}"/>`;
  const lock=`<path d="M48 44 h22 v14 q0 9 -11 13 q-11 -4 -11 -13 z" fill="url(#${u}m)" stroke="${O}" stroke-width="2"/><path d="M50.5 46 h6 v10 q0 5 -4 8" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>${emb}
    ${P.gem?`<path d="M59 38 l4 4 l-4 4 l-4 -4 z" fill="${P.gem}" stroke="${O}" stroke-width="1.1"/><path d="M59 38.8 l1.8 1.8 l-1.8 1 z" fill="#fff" opacity=".7"/>`:''}`;
  /* open state: lid thrown back, light and treasure */
  const lidUp=`<path d="M16 50 L22 10 Q59 0 96 10 L102 50 Z" fill="url(#${u}l)" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M22 44 L26 14 Q59 6 92 14 L96 44 Z" fill="${P.wood2}" stroke="${O}" stroke-opacity=".5" stroke-width="1.2"/>
    <rect x="31" y="10" width="7" height="40" fill="${P.metal}" stroke="${O}" stroke-width="1.3" transform="skewX(-4)"/><rect x="82" y="10" width="7" height="40" fill="${P.metal}" stroke="${O}" stroke-width="1.3" transform="skewX(4)"/>`;
  const coins=[[-26,0,4.6],[-15,-5,5],[-4,-8,5.2],[7,-6,5],[18,-3,4.8],[27,1,4.2],[-20,4,4.3],[0,-1,4.8],[12,3,4.4],[-9,3,4.2],[22,5,3.8]].map(([dx,dy,r])=>`<ellipse cx="${59+dx}" cy="${58+dy}" rx="${r}" ry="${r*0.62}" fill="#ffd54a" stroke="#8a5a10" stroke-width="1"/><ellipse cx="${59+dx-1}" cy="${58+dy-1}" rx="${r*0.45}" ry="${r*0.25}" fill="#fff6c9" opacity=".8"/>`).join('');
  const gems=P.gem?[[-12,-9],[10,-11],[-1,-13]].map(([dx,dy])=>`<path d="M${59+dx} ${58+dy} l4 5 l-4 5 l-4 -5 z" fill="${P.gem}" stroke="${O}" stroke-width="1"/>`).join(''):'';
  const mouth=`<ellipse cx="59" cy="58" rx="45" ry="10" fill="#2a1606"/><ellipse cx="59" cy="58" rx="45" ry="10" fill="url(#${u}g)"/>${coins}${gems}`;
  const rays=`<g opacity=".75">${[0,1,2,3,4,5,6,7,8].map(i=>{const a=-Math.PI/2+(i-4)*0.3;return `<path d="M59 56 L${59+Math.cos(a-0.07)*70} ${56+Math.sin(a-0.07)*70} L${59+Math.cos(a+0.07)*70} ${56+Math.sin(a+0.07)*70} Z" fill="url(#${u}r)"/>`;}).join('')}</g>`;
  const fire=t==='dragon'&&!open?`<path d="M10 60 q-6 -10 2 -18 q0 8 6 10 z M108 60 q6 -10 -2 -18 q0 8 -6 10 z" fill="#ff9a3c" opacity=".85"/>`:'';
  return `<svg viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg"><defs>
   <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.wood}"/><stop offset="1" stop-color="${P.wood2}"/></linearGradient>
   <linearGradient id="${u}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".35" stop-color="${P.wood}"/><stop offset="1" stop-color="${P.wood2}"/></linearGradient>
   <linearGradient id="${u}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${P.metal}"/><stop offset="1" stop-color="${P.metal2}"/></linearGradient>
   <radialGradient id="${u}g" cx=".5" cy=".4" r=".65"><stop offset="0" stop-color="#fff8d0" stop-opacity=".95"/><stop offset=".6" stop-color="#ffc85a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a2c" stop-opacity=".1"/></radialGradient>
   <linearGradient id="${u}r" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff3b0" stop-opacity=".9"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></linearGradient>
   </defs>
   <ellipse cx="62" cy="98" rx="50" ry="5.5" fill="rgba(0,0,0,.35)"/>
   ${open?`${rays}${lidUp}${body}${mouth}`:`${fire}${body}${lid}${lock}`}
   </svg>`;}
